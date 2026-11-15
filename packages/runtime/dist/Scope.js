import { cleanupManagedWrapper } from "./ui/managedState.js";
import { CancellationController } from "./CancellationController.js";
import { EgretError } from "./EgretError.js";
import { claimOwner, commitBinding, engineOf, ownerOf, preflightBinding, validateBinding } from "./ownership.js";
export let createScope;
const CREATION_TOKEN = Symbol("egret.scopeFactory");
const scopes = new WeakSet();
/** Runtime-private identity for owner-chain lifetime validation. */
export function isScope(value) {
    return scopes.has(value);
}
const activeRegistrations = new WeakSet();
function cleanup(value) {
    if (cleanupManagedWrapper(value))
        return;
    if ("dispose" in value)
        value.dispose();
    else
        value.release();
}
/** Synchronous ownership boundary. Use Engine.createScope() to obtain one. */
export class Scope {
    #currentState = "open";
    // Runtime-private ownership paths ignore harmless public old-name shadows.
    #values = [];
    #controller;
    #engine;
    #onClosed;
    signal;
    constructor(engine, onClosed, token) {
        if (token !== CREATION_TOKEN)
            throw new EgretError("SCOPE_FACTORY_REQUIRED");
        scopes.add(this);
        this.#engine = engine;
        this.#onClosed = onClosed;
        this.#controller = new CancellationController(diagnostic => {
            this.#engine.captureCleanup(diagnostic.cause);
            this.#engine.report(diagnostic);
        });
        this.signal = this.#controller.signal;
    }
    static {
        createScope = (engine, onClosed) => new Scope(engine, onClosed, CREATION_TOKEN);
    }
    get state() {
        return this.#currentState;
    }
    /** Accept one cleanup owner after callback-free validation of the current tree. */
    use(value) {
        if (activeRegistrations.has(value))
            throw new EgretError("SCOPE_REGISTRATION_ACTIVE");
        activeRegistrations.add(value);
        try {
            const existingOwner = this.#validateAcceptance(value);
            if (existingOwner === this)
                return value;
            preflightBinding(value, this.#engine);
            // Subclass preflight may close a Scope/Engine or mutate the tree. Nothing
            // can invoke user code between the checks below and the ownership commit.
            this.#validateAcceptance(value);
            const binding = validateBinding(value, this.#engine);
            commitBinding(binding, this.#engine);
            claimOwner(value, this);
            this.#values.push(value);
            return value;
        }
        finally {
            activeRegistrations.delete(value);
        }
    }
    #validateAcceptance(value) {
        const existingOwner = ownerOf(value);
        if (existingOwner !== undefined && existingOwner !== this)
            throw new EgretError("OWNERSHIP_CONFLICT");
        const existingEngine = engineOf(value);
        if (existingEngine !== undefined && existingEngine !== this.#engine)
            throw new EgretError("ENGINE_MISMATCH");
        let closedError;
        if (this.#currentState !== "open")
            closedError = new EgretError("SCOPE_CLOSED");
        else {
            try {
                this.#engine.assertOpen();
            }
            catch (cause) {
                closedError = cause instanceof EgretError ? cause : new EgretError("ENGINE_CLOSED", { cause });
            }
        }
        if (closedError !== undefined) {
            const cleanupErrors = [];
            // A late unowned value must be cleaned up; a foreign owner stays authoritative.
            if (existingOwner === undefined) {
                try {
                    cleanup(value);
                }
                catch (cause) {
                    cleanupErrors.push(cause);
                    this.#engine.captureCleanup(cause);
                    this.#engine.report({ code: "SCOPE_LATE_CLEANUP_FAILED", phase: "scope", severity: "error", cause });
                }
            }
            throw new EgretError(closedError.code, { cause: closedError.cause, cleanupErrors });
        }
        return existingOwner;
    }
    /** Cancel first, then clean up in reverse acquisition order despite failures. */
    dispose() {
        if (this.#currentState !== "open")
            return;
        this.#currentState = "closing";
        try {
            this.#controller.abort(new EgretError("SCOPE_CLOSED"));
            for (let index = this.#values.length - 1; index >= 0; index--) {
                const value = this.#values[index];
                if (value === undefined)
                    continue;
                try {
                    cleanup(value);
                }
                catch (cause) {
                    this.#engine.captureCleanup(cause);
                    this.#engine.report({ code: "SCOPE_CLEANUP_FAILED", phase: "scope", severity: "error", cause });
                }
            }
        }
        finally {
            this.#values.length = 0;
            this.#currentState = "closed";
            this.#onClosed(this);
        }
    }
}
//# sourceMappingURL=Scope.js.map