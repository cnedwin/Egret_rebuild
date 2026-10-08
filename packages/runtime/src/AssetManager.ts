import type { CancellationSignal } from "@egret/contracts";
import { AssetLease, createAssetLease, revokeAssetLease } from "./AssetLease.js";
import { assertAssetRef, assertAssetType } from "./AssetRef.js";
import type { AssetRef, AssetType } from "./AssetRef.js";
import { CancellationController } from "./CancellationController.js";
import { EgretError } from "./EgretError.js";
import type { EngineContext } from "./ownership.js";
import type { AssetLoadContext, Entry, Identity, ProviderBinding, Waiter } from "./assetState.js";

export type { AssetLoadContext } from "./assetState.js";

export interface AssetProvider<T> {
  load(ref: AssetRef<T>, context: AssetLoadContext): Promise<T>;
  dispose(value: T): void;
}

export interface AssetAcquireOptions {
  readonly signal?: CancellationSignal;
}

const CREATION_TOKEN: unique symbol = Symbol("egret.assetManagerFactory");
export let createAssetManager: (engine: EngineContext) => AssetManager;

function nextIdentity(value: number): number {
  const next = value + 1;
  if (!Number.isSafeInteger(next)) throw new EgretError("ASSET_ID_EXHAUSTED");
  return next;
}

/** CPU acquisition only: demand retains values; completed unused values are evicted. */
export class AssetManager {
  private closed = false;
  private taskId = 0;
  private leaseId = 0;
  private readonly engine: EngineContext;
  private readonly providers = new Map<object, ProviderBinding>();
  private readonly identities = new Map<string, Identity>();
  private readonly current = new Map<string, Entry>();
  private readonly entries = new Set<Entry>();

  private constructor(engine: EngineContext, token: typeof CREATION_TOKEN) {
    if (token !== CREATION_TOKEN) throw new EgretError("ASSET_MANAGER_FACTORY_REQUIRED");
    this.engine = engine;
  }

  static {
    createAssetManager = (engine): AssetManager => new AssetManager(engine, CREATION_TOKEN);
  }

  private assertOpen(): void {
    if (this.closed) throw new EgretError("ASSET_MANAGER_CLOSED");
    try { this.engine.assertOpen(); }
    catch (cause) { throw new EgretError("ASSET_MANAGER_CLOSED", { cause }); }
  }

  /** Snapshot method identity and receiver once, including getter reentry checks. */
  public register<T>(type: AssetType<T>, provider: AssetProvider<NoInfer<T>>): void {
    this.assertOpen();
    assertAssetType(type);
    if (this.providers.has(type)) throw new EgretError("ASSET_PROVIDER_REGISTERED");
    const load = provider?.load;
    const dispose = provider?.dispose;
    if (typeof load !== "function" || typeof dispose !== "function") throw new EgretError("ASSET_PROVIDER_INVALID");
    this.assertOpen();
    if (this.providers.has(type)) throw new EgretError("ASSET_PROVIDER_REGISTERED");
    this.providers.set(type, {
      // Intrinsic invocation ignores mutable own .call properties on callbacks.
      load: (ref, context) => Reflect.apply(load, provider, [ref as unknown as AssetRef<T>, context]) as Promise<T>,
      dispose: (value) => { Reflect.apply(dispose, provider, [value as T]); },
    });
  }

  /** The executor commits an entry and its first waiter before any loader callback. */
  public acquire<T>(ref: AssetRef<T>, options: AssetAcquireOptions = {}): Promise<AssetLease<T>> {
    return new Promise<AssetLease<T>>((resolve, reject) => {
      try {
        this.assertOpen();
        assertAssetRef(ref);
        const provider = this.providers.get(ref.type);
        if (provider === undefined) throw new EgretError("ASSET_PROVIDER_MISSING");
        let signal: CancellationSignal | undefined;
        let alreadyAborted = false;
        let cancellationReason: unknown;
        try {
          signal = options.signal;
          alreadyAborted = signal?.aborted ?? false;
          if (alreadyAborted) cancellationReason = signal?.reason;
        } catch (cause) {
          this.diagnose("ASSET_SIGNAL_FAILED", cause);
          throw new EgretError("ASSET_SIGNAL_FAILED", { cause });
        }
        if (alreadyAborted) throw new EgretError("ASSET_ACQUIRE_CANCELLED", { cause: cancellationReason });
        this.assertOpen();
        const identity = this.identityFor(ref);
        let entry = this.current.get(ref.id);
        if (entry === undefined) {
          const generation = nextIdentity(identity.generation);
          const taskId = nextIdentity(this.taskId);
          identity.generation = generation;
          this.taskId = taskId;
          entry = {
            ref, provider, generation, taskId,
            controller: new CancellationController((diagnostic) => this.diagnose(diagnostic.code, diagnostic.cause)),
            waiters: new Set(), leases: new Set(), state: "loading", started: false,
            hasValue: false, cleanupAttempted: false, value: undefined,
          };
          this.current.set(ref.id, entry);
          this.entries.add(entry);
        }
        const waiter: Waiter = {
          entry, signal, pending: true, installing: false, listening: false,
          resolve: lease => resolve(lease as unknown as AssetLease<T>), reject,
          listener: () => {
            if (!waiter.pending) return;
            let reason: unknown;
            try { reason = signal?.reason; }
            catch (cause) { this.failWaiter(waiter, new EgretError("ASSET_SIGNAL_FAILED", { cause })); this.diagnose("ASSET_SIGNAL_FAILED", cause); return; }
            this.failWaiter(waiter, new EgretError("ASSET_ACQUIRE_CANCELLED", { cause: reason }));
          },
        };
        entry.waiters.add(waiter);
        this.installSignal(waiter);
        if (!waiter.pending) return;
        if (entry.state === "ready") this.deliver(waiter);
        else if (entry.state === "loading" && !entry.started) this.start(entry);
      } catch (cause) {
        reject(cause instanceof EgretError ? cause : new EgretError("ASSET_ACQUIRE_FAILED", { cause }));
      }
    });
  }

  private identityFor(ref: AssetRef<never>): Identity {
    let identity = this.identities.get(ref.id);
    if (identity !== undefined && identity.type !== ref.type) throw new EgretError("ASSET_TYPE_MISMATCH");
    if (identity === undefined) {
      identity = { type: ref.type, generation: 0 };
      this.identities.set(ref.id, identity);
    }
    return identity;
  }

  /** Invalidation changes future routing, while old demand keeps its own entry. */
  public invalidate<T>(ref: AssetRef<T>): void {
    this.assertOpen();
    assertAssetRef(ref);
    this.identityFor(ref);
    this.current.delete(ref.id);
  }

  private installSignal(waiter: Waiter): void {
    if (waiter.signal === undefined) return;
    waiter.installing = true;
    waiter.listening = true;
    let failure: unknown;
    let failed = false;
    try {
      waiter.signal.addEventListener("abort", waiter.listener, { once: true });
      // Adapters may abort without dispatching, or close the manager during add.
      if (waiter.pending && waiter.signal.aborted) waiter.listener();
    } catch (cause) {
      failure = cause;
      failed = true;
      this.failWaiter(waiter, new EgretError("ASSET_SIGNAL_FAILED", { cause }));
    } finally {
      waiter.installing = false;
    }
    if (!waiter.pending) {
      const removal = this.detach(waiter);
      if (removal.failed) this.diagnose("ASSET_SIGNAL_FAILED", removal.cause);
    }
    if (failed) this.diagnose("ASSET_SIGNAL_FAILED", failure);
  }

  /** Mark local subscription inert before adapter removal; throws retain diagnostics. */
  private detach(waiter: Waiter): { readonly failed: boolean; readonly cause?: unknown } {
    if (waiter.installing || !waiter.listening || waiter.signal === undefined) return { failed: false };
    waiter.listening = false;
    try { waiter.signal.removeEventListener("abort", waiter.listener); return { failed: false }; }
    catch (cause) { return { failed: true, cause }; }
  }

  private start(entry: Entry): void {
    entry.started = true;
    let promise: Promise<unknown>;
    try {
      promise = entry.provider.load(entry.ref, Object.freeze({ signal: entry.controller.signal, resourceGeneration: entry.generation, taskId: entry.taskId }));
    } catch (cause) {
      this.failEntry(entry, new EgretError("ASSET_LOAD_FAILED", { cause }));
      return;
    }
    // Resolve thenables through Promise machinery; every internal rejection is observed.
    void Promise.resolve(promise).then(
      value => this.receive(entry, value),
      cause => this.failEntry(entry, new EgretError("ASSET_LOAD_FAILED", { cause })),
    ).catch(cause => { this.failEntry(entry, new EgretError("ASSET_LOAD_FAILED", { cause })); });
  }

  private receive(entry: Entry, value: unknown): void {
    entry.hasValue = true;
    entry.value = value;
    if (this.isTerminal(entry)) { this.cleanup(entry); return; }
    let valid: boolean;
    try { valid = entry.ref.type.is(value); }
    catch (cause) { this.failEntry(entry, new EgretError("ASSET_VALUE_INVALID", { cause })); return; }
    // Validator callbacks can cancel demand or close the manager synchronously.
    if (this.isTerminal(entry)) { this.cleanup(entry); return; }
    if (!valid) { this.failEntry(entry, new EgretError("ASSET_VALUE_INVALID")); return; }
    entry.state = "ready";
    for (const waiter of [...entry.waiters]) this.deliver(waiter);
    this.retireUnused(entry);
  }

  private deliver(waiter: Waiter): void {
    const entry = waiter.entry;
    if (!waiter.pending || entry.state !== "ready") return;
    let lease: AssetLease<unknown>;
    try {
      this.leaseId = nextIdentity(this.leaseId);
      lease = createAssetLease(this.engine, this.leaseId, entry.generation, () => entry.value, () => {
        entry.leases.delete(lease);
        this.retireUnused(entry);
      });
    } catch (cause) {
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
    } else waiter.resolve(lease);
  }

  private failWaiter(waiter: Waiter, error: EgretError): void {
    if (!waiter.pending) return;
    waiter.pending = false;
    waiter.entry.waiters.delete(waiter);
    this.retireUnused(waiter.entry);
    const removal = this.detach(waiter);
    waiter.reject(error);
    if (removal.failed) this.diagnose("ASSET_SIGNAL_FAILED", removal.cause);
  }

  private failEntry(entry: Entry, error: EgretError): void {
    if (entry.state === "terminal") return;
    const waiters = [...entry.waiters];
    this.markTerminal(entry);
    for (const waiter of waiters) waiter.pending = false;
    for (const waiter of waiters) {
      const removal = this.detach(waiter);
      waiter.reject(error);
      if (removal.failed) this.diagnose("ASSET_SIGNAL_FAILED", removal.cause);
    }
    entry.controller.abort(error);
    this.cleanup(entry);
  }

  /** Remove only this entry: old-generation cleanup cannot delete its replacement. */
  private markTerminal(entry: Entry): void {
    entry.state = "terminal";
    if (this.current.get(entry.ref.id) === entry) this.current.delete(entry.ref.id);
    this.entries.delete(entry);
    entry.waiters.clear();
    for (const lease of entry.leases) revokeAssetLease(lease);
    entry.leases.clear();
  }

  private isTerminal(entry: Entry): boolean { return entry.state === "terminal"; }

  private retireUnused(entry: Entry): void {
    if (entry.state === "terminal" || entry.waiters.size !== 0 || entry.leases.size !== 0) return;
    this.markTerminal(entry);
    entry.controller.abort(new EgretError("ASSET_NO_DEMAND"));
    this.cleanup(entry);
  }

  /** One attempted disposal per successful result, even if the disposer throws. */
  private cleanup(entry: Entry): void {
    if (!entry.hasValue || entry.cleanupAttempted) return;
    entry.cleanupAttempted = true;
    entry.hasValue = false;
    const value = entry.value;
    entry.value = undefined;
    try { entry.provider.dispose(value); }
    catch (cause) { this.diagnose("ASSET_CLEANUP_FAILED", cause); }
  }

  private diagnose(code: string, cause: unknown): void {
    this.engine.captureCleanup(cause);
    this.engine.report({ code, phase: "assets", severity: "error", cause });
  }

  /** Close the gate and revoke every local demand before the first external hook. */
  public dispose(): void {
    if (this.closed) return;
    this.closed = true;
    const entries = [...this.entries];
    const waiters = entries.flatMap(entry => [...entry.waiters]);
    for (const entry of entries) this.markTerminal(entry);
    for (const waiter of waiters) waiter.pending = false;
    const error = new EgretError("ASSET_MANAGER_CLOSED");
    for (const waiter of waiters) {
      const removal = this.detach(waiter);
      waiter.reject(error);
      if (removal.failed) this.diagnose("ASSET_SIGNAL_FAILED", removal.cause);
    }
    for (const entry of entries) { entry.controller.abort(error); this.cleanup(entry); }
  }
}
