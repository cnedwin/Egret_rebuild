import { AssetLease, createAssetLease, isAssetLease, readAssetLeaseValue, revokeAssetLease } from "./AssetLease.js";
import { assertAssetRef, assertAssetType } from "./AssetRef.js";
import { CancellationController } from "./CancellationController.js";
import { EgretError } from "./EgretError.js";
import { closeOwnedTextCache, markAssetManagerOwnerClosed, registerAssetManagerOwner } from "./assetManagerOwnerState.js";
import { claimOwner, engineOf, ownerOf } from "./ownership.js";
const CREATION_TOKEN = Symbol("egret.assetManagerFactory");
const APPLY = Reflect.apply;
const FREEZE = Object.freeze;
let bindAssetManagerOwner;
export let createAssetManager;
function nextIdentity(value) {
    const next = value + 1;
    if (!Number.isSafeInteger(next))
        throw new EgretError("ASSET_ID_EXHAUSTED");
    return next;
}
/** CPU acquisition only: demand retains values; completed unused values are evicted. */
export class AssetManager {
    closed = false;
    taskId = 0;
    leaseId = 0;
    #engine;
    providers = new Map();
    identities = new Map();
    current = new Map();
    entries = new Set();
    constructor(engine, token) {
        if (token !== CREATION_TOKEN)
            throw new EgretError("ASSET_MANAGER_FACTORY_REQUIRED");
        this.#engine = engine;
        bindAssetManagerOwner(this, engine);
    }
    static {
        // Capture original operations before any manager or later explicit entry is exposed.
        const assertOpen = this.prototype.assertOpen;
        const register = this.prototype.register;
        const acquire = this.prototype.acquire;
        const invalidate = this.prototype.invalidate;
        const admitGroupRefs = this.prototype.admitGroupRefs;
        const claimGroupLease = this.prototype.claimGroupLease;
        const releaseGroupLease = AssetLease.prototype.release;
        bindAssetManagerOwner = (manager, context) => {
            registerAssetManagerOwner(manager, FREEZE({
                context,
                assertOpen: () => {
                    APPLY(assertOpen, manager, []);
                },
                register: (type, provider) => {
                    APPLY(register, manager, [type, provider]);
                },
                acquire: (ref, options) => APPLY(acquire, manager, [ref, options]),
                invalidate: (ref) => {
                    APPLY(invalidate, manager, [ref]);
                }
            }));
            // Genuine construction alone supplies the captured, frozen narrow bridge.
            // Text-cache owner state and contexts without this callback are unchanged.
            const registerGroupOperations = context.registerAssetGroupOperations;
            if (registerGroupOperations !== undefined) {
                const operations = FREEZE({
                    admitGroupRefs: (refs) => {
                        APPLY(admitGroupRefs, manager, [refs]);
                    },
                    acquire: (ref, options) => APPLY(acquire, manager, [ref, options]),
                    claimGroupLease: (lease, group) => {
                        APPLY(claimGroupLease, manager, [lease, group]);
                    },
                    releaseGroupLease: (lease) => {
                        APPLY(releaseGroupLease, lease, []);
                    }
                });
                APPLY(registerGroupOperations, context, [operations]);
            }
        };
        createAssetManager = (engine) => new AssetManager(engine, CREATION_TOKEN);
    }
    assertOpen() {
        if (this.closed)
            throw new EgretError("ASSET_MANAGER_CLOSED");
        try {
            this.#engine.assertOpen();
        }
        catch (cause) {
            throw new EgretError("ASSET_MANAGER_CLOSED", { cause });
        }
    }
    /** Snapshot method identity and receiver once, including getter reentry checks. */
    register(type, provider) {
        this.assertOpen();
        assertAssetType(type);
        if (this.providers.has(type))
            throw new EgretError("ASSET_PROVIDER_REGISTERED");
        const load = provider?.load;
        const dispose = provider?.dispose;
        if (typeof load !== "function" || typeof dispose !== "function")
            throw new EgretError("ASSET_PROVIDER_INVALID");
        this.assertOpen();
        if (this.providers.has(type))
            throw new EgretError("ASSET_PROVIDER_REGISTERED");
        this.providers.set(type, {
            // Intrinsic invocation ignores mutable own .call properties on callbacks.
            load: (ref, context) => Reflect.apply(load, provider, [ref, context]),
            dispose: value => {
                Reflect.apply(dispose, provider, [value]);
            }
        });
    }
    /** The executor commits an entry and its first waiter before any loader callback. */
    acquire(ref, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                this.assertOpen();
                assertAssetRef(ref);
                const provider = this.providers.get(ref.type);
                if (provider === undefined)
                    throw new EgretError("ASSET_PROVIDER_MISSING");
                let signal;
                let alreadyAborted = false;
                let cancellationReason;
                try {
                    signal = options.signal;
                    alreadyAborted = signal?.aborted ?? false;
                    if (alreadyAborted)
                        cancellationReason = signal?.reason;
                }
                catch (cause) {
                    this.diagnose("ASSET_SIGNAL_FAILED", cause);
                    throw new EgretError("ASSET_SIGNAL_FAILED", { cause });
                }
                if (alreadyAborted)
                    throw new EgretError("ASSET_ACQUIRE_CANCELLED", { cause: cancellationReason });
                this.assertOpen();
                const identity = this.identityFor(ref);
                let entry = this.current.get(ref.id);
                if (entry === undefined) {
                    const generation = nextIdentity(identity.generation);
                    const taskId = nextIdentity(this.taskId);
                    identity.generation = generation;
                    this.taskId = taskId;
                    entry = {
                        ref,
                        provider,
                        generation,
                        taskId,
                        controller: new CancellationController(diagnostic => this.diagnose(diagnostic.code, diagnostic.cause)),
                        waiters: new Set(),
                        leases: new Set(),
                        state: "loading",
                        started: false,
                        hasValue: false,
                        cleanupAttempted: false,
                        value: undefined
                    };
                    this.current.set(ref.id, entry);
                    this.entries.add(entry);
                }
                const waiter = {
                    entry,
                    signal,
                    pending: true,
                    installing: false,
                    listening: false,
                    resolve: lease => resolve(lease),
                    reject,
                    listener: () => {
                        if (!waiter.pending)
                            return;
                        let reason;
                        try {
                            reason = signal?.reason;
                        }
                        catch (cause) {
                            this.failWaiter(waiter, new EgretError("ASSET_SIGNAL_FAILED", { cause }));
                            this.diagnose("ASSET_SIGNAL_FAILED", cause);
                            return;
                        }
                        this.failWaiter(waiter, new EgretError("ASSET_ACQUIRE_CANCELLED", { cause: reason }));
                    }
                };
                entry.waiters.add(waiter);
                this.installSignal(waiter);
                if (!waiter.pending)
                    return;
                if (entry.state === "ready")
                    this.deliver(waiter);
                else if (entry.state === "loading" && !entry.started)
                    this.start(entry);
            }
            catch (cause) {
                reject(cause instanceof EgretError ? cause : new EgretError("ASSET_ACQUIRE_FAILED", { cause }));
            }
        });
    }
    identityFor(ref) {
        let identity = this.identities.get(ref.id);
        if (identity !== undefined && identity.type !== ref.type)
            throw new EgretError("ASSET_TYPE_MISMATCH");
        if (identity === undefined) {
            identity = { type: ref.type, generation: 0 };
            this.identities.set(ref.id, identity);
        }
        return identity;
    }
    /** Authenticate all positions without reserving identity or creating demand. */
    admitGroupRefs(refs) {
        this.assertOpen();
        const admitted = new Map();
        for (const ref of refs) {
            assertAssetRef(ref);
            if (!this.providers.has(ref.type))
                throw new EgretError("ASSET_PROVIDER_MISSING");
            const existing = this.identities.get(ref.id);
            const inputType = admitted.get(ref.id);
            if ((existing !== undefined && existing.type !== ref.type) || (inputType !== undefined && inputType !== ref.type))
                throw new EgretError("ASSET_TYPE_MISMATCH");
            admitted.set(ref.id, ref.type);
        }
    }
    /** Lease identity, affinity and one cleanup owner are checked before publication. */
    claimGroupLease(lease, group) {
        this.assertOpen();
        if (!isAssetLease(lease) || engineOf(lease) !== this.#engine || ownerOf(lease) !== undefined)
            throw new EgretError("ASSET_GROUP_MEMBER_INVALID");
        try {
            readAssetLeaseValue(lease);
        }
        catch (cause) {
            throw new EgretError("ASSET_GROUP_MEMBER_INVALID", { cause });
        }
        claimOwner(lease, group);
    }
    /** Invalidation changes future routing, while old demand keeps its own entry. */
    invalidate(ref) {
        this.assertOpen();
        assertAssetRef(ref);
        this.identityFor(ref);
        this.current.delete(ref.id);
    }
    installSignal(waiter) {
        if (waiter.signal === undefined)
            return;
        waiter.installing = true;
        waiter.listening = true;
        let failure;
        let failed = false;
        try {
            waiter.signal.addEventListener("abort", waiter.listener, { once: true });
            // Adapters may abort without dispatching, or close the manager during add.
            if (waiter.pending && waiter.signal.aborted)
                waiter.listener();
        }
        catch (cause) {
            failure = cause;
            failed = true;
            this.failWaiter(waiter, new EgretError("ASSET_SIGNAL_FAILED", { cause }));
        }
        finally {
            waiter.installing = false;
        }
        if (!waiter.pending) {
            const removal = this.detach(waiter);
            if (removal.failed)
                this.diagnose("ASSET_SIGNAL_FAILED", removal.cause);
        }
        if (failed)
            this.diagnose("ASSET_SIGNAL_FAILED", failure);
    }
    /** Mark local subscription inert before adapter removal; throws retain diagnostics. */
    detach(waiter) {
        if (waiter.installing || !waiter.listening || waiter.signal === undefined)
            return { failed: false };
        waiter.listening = false;
        try {
            waiter.signal.removeEventListener("abort", waiter.listener);
            return { failed: false };
        }
        catch (cause) {
            return { failed: true, cause };
        }
    }
    start(entry) {
        entry.started = true;
        let promise;
        try {
            promise = entry.provider.load(entry.ref, Object.freeze({ signal: entry.controller.signal, resourceGeneration: entry.generation, taskId: entry.taskId }));
        }
        catch (cause) {
            this.failEntry(entry, new EgretError("ASSET_LOAD_FAILED", { cause }));
            return;
        }
        // Resolve thenables through Promise machinery; every internal rejection is observed.
        void Promise.resolve(promise)
            .then(value => this.receive(entry, value), cause => this.failEntry(entry, new EgretError("ASSET_LOAD_FAILED", { cause })))
            .catch(cause => {
            this.failEntry(entry, new EgretError("ASSET_LOAD_FAILED", { cause }));
        });
    }
    receive(entry, value) {
        entry.hasValue = true;
        entry.value = value;
        if (this.isTerminal(entry)) {
            this.cleanup(entry);
            return;
        }
        let valid;
        try {
            valid = entry.ref.type.is(value);
        }
        catch (cause) {
            this.failEntry(entry, new EgretError("ASSET_VALUE_INVALID", { cause }));
            return;
        }
        // Validator callbacks can cancel demand or close the manager synchronously.
        if (this.isTerminal(entry)) {
            this.cleanup(entry);
            return;
        }
        if (!valid) {
            this.failEntry(entry, new EgretError("ASSET_VALUE_INVALID"));
            return;
        }
        entry.state = "ready";
        for (const waiter of [...entry.waiters])
            this.deliver(waiter);
        this.retireUnused(entry);
    }
    deliver(waiter) {
        const entry = waiter.entry;
        if (!waiter.pending || entry.state !== "ready")
            return;
        let lease;
        try {
            this.leaseId = nextIdentity(this.leaseId);
            lease = createAssetLease(this.#engine, this.leaseId, entry.generation, () => entry.value, () => {
                entry.leases.delete(lease);
                this.retireUnused(entry);
            });
        }
        catch (cause) {
            this.failWaiter(waiter, cause instanceof EgretError ? cause : new EgretError("ASSET_ACQUIRE_FAILED", { cause }));
            return;
        }
        // Successful delivery wins against later abort, including removal callback reentry.
        waiter.pending = false;
        entry.waiters.delete(waiter);
        entry.leases.add(lease);
        const removal = this.detach(waiter);
        if (removal.failed) {
            lease.release();
            waiter.reject(new EgretError("ASSET_SIGNAL_FAILED", { cause: removal.cause }));
            this.diagnose("ASSET_SIGNAL_FAILED", removal.cause);
        }
        else
            waiter.resolve(lease);
    }
    failWaiter(waiter, error) {
        if (!waiter.pending)
            return;
        waiter.pending = false;
        waiter.entry.waiters.delete(waiter);
        this.retireUnused(waiter.entry);
        const removal = this.detach(waiter);
        waiter.reject(error);
        if (removal.failed)
            this.diagnose("ASSET_SIGNAL_FAILED", removal.cause);
    }
    failEntry(entry, error) {
        if (entry.state === "terminal")
            return;
        const waiters = [...entry.waiters];
        this.markTerminal(entry);
        for (const waiter of waiters)
            waiter.pending = false;
        for (const waiter of waiters) {
            const removal = this.detach(waiter);
            waiter.reject(error);
            if (removal.failed)
                this.diagnose("ASSET_SIGNAL_FAILED", removal.cause);
        }
        entry.controller.abort(error);
        this.cleanup(entry);
    }
    /** Remove only this entry: old-generation cleanup cannot delete its replacement. */
    markTerminal(entry) {
        entry.state = "terminal";
        if (this.current.get(entry.ref.id) === entry)
            this.current.delete(entry.ref.id);
        this.entries.delete(entry);
        entry.waiters.clear();
        for (const lease of entry.leases)
            revokeAssetLease(lease);
        entry.leases.clear();
    }
    isTerminal(entry) {
        return entry.state === "terminal";
    }
    retireUnused(entry) {
        if (entry.state === "terminal" || entry.waiters.size !== 0 || entry.leases.size !== 0)
            return;
        this.markTerminal(entry);
        entry.controller.abort(new EgretError("ASSET_NO_DEMAND"));
        this.cleanup(entry);
    }
    /** One attempted disposal per successful result, even if the disposer throws. */
    cleanup(entry) {
        if (!entry.hasValue || entry.cleanupAttempted)
            return;
        entry.cleanupAttempted = true;
        entry.hasValue = false;
        const value = entry.value;
        entry.value = undefined;
        try {
            entry.provider.dispose(value);
        }
        catch (cause) {
            this.diagnose("ASSET_CLEANUP_FAILED", cause);
        }
    }
    diagnose(code, cause) {
        this.#engine.captureCleanup(cause);
        this.#engine.report({ code, phase: "assets", severity: "error", cause });
    }
    /** Close the gate and revoke every local demand before the first external hook. */
    dispose() {
        if (this.closed)
            return;
        this.closed = true;
        markAssetManagerOwnerClosed(this);
        const entries = [...this.entries];
        const waiters = entries.flatMap(entry => [...entry.waiters]);
        for (const entry of entries)
            this.markTerminal(entry);
        for (const waiter of waiters)
            waiter.pending = false;
        // All manager demand is inert before the trusted cache close or external hooks.
        closeOwnedTextCache(this);
        const error = new EgretError("ASSET_MANAGER_CLOSED");
        for (const waiter of waiters) {
            const removal = this.detach(waiter);
            waiter.reject(error);
            if (removal.failed)
                this.diagnose("ASSET_SIGNAL_FAILED", removal.cause);
        }
        for (const entry of entries) {
            entry.controller.abort(error);
            this.cleanup(entry);
        }
    }
}
//# sourceMappingURL=AssetManager.js.map