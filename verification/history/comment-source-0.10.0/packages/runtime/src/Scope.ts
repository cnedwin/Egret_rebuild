import type { CancellationSignal, ScopeValue } from "@egret/contracts";
import { CancellationController } from "./CancellationController.js";
import { EgretError } from "./EgretError.js";
import { claimOwner, commitBinding, engineOf, ownerOf, preflightBinding, validateBinding } from "./ownership.js";
import type { EngineContext } from "./ownership.js";

export type ScopeState = "open" | "closing" | "closed";

export let createScope: (engine: EngineContext, onClosed: (scope: Scope) => void) => Scope;
const CREATION_TOKEN: unique symbol = Symbol("egret.scopeFactory");
const activeRegistrations = new WeakSet<object>();

function cleanup(value: ScopeValue): void {
  if ("dispose" in value) value.dispose();
  else value.release();
}

/** Synchronous ownership boundary. Use Engine.createScope() to obtain one. */
export class Scope {
  private currentState: ScopeState = "open";
  private readonly values: ScopeValue[] = [];
  private readonly controller: CancellationController;
  private readonly engine: EngineContext;
  private readonly onClosed: (scope: Scope) => void;
  public readonly signal: CancellationSignal;

  private constructor(engine: EngineContext, onClosed: (scope: Scope) => void, token: typeof CREATION_TOKEN) {
    if (token !== CREATION_TOKEN) throw new EgretError("SCOPE_FACTORY_REQUIRED");
    this.engine = engine;
    this.onClosed = onClosed;
    this.controller = new CancellationController((diagnostic) => {
      this.engine.captureCleanup(diagnostic.cause);
      this.engine.report(diagnostic);
    });
    this.signal = this.controller.signal;
  }

  static {
    createScope = (engine, onClosed): Scope => new Scope(engine, onClosed, CREATION_TOKEN);
  }

  public get state(): ScopeState { return this.currentState; }

  /** Accept one cleanup owner after callback-free validation of the current tree. */
  public use<T extends ScopeValue>(value: T): T {
    if (activeRegistrations.has(value)) throw new EgretError("SCOPE_REGISTRATION_ACTIVE");
    activeRegistrations.add(value);
    try {
      const existingOwner = this.validateAcceptance(value);
      if (existingOwner === this) return value;
      preflightBinding(value, this.engine);
      // Subclass preflight may close a Scope/Engine or mutate the tree. Nothing
      // can invoke user code between the checks below and the ownership commit.
      this.validateAcceptance(value);
      const binding = validateBinding(value, this.engine);
      commitBinding(binding, this.engine);
      claimOwner(value, this);
      this.values.push(value);
      return value;
    } finally {
      activeRegistrations.delete(value);
    }
  }

  private validateAcceptance(value: ScopeValue): object | undefined {
    const existingOwner = ownerOf(value);
    if (existingOwner !== undefined && existingOwner !== this) throw new EgretError("OWNERSHIP_CONFLICT");
    const existingEngine = engineOf(value);
    if (existingEngine !== undefined && existingEngine !== this.engine) throw new EgretError("ENGINE_MISMATCH");
    let closedError: EgretError | undefined;
    if (this.currentState !== "open") closedError = new EgretError("SCOPE_CLOSED");
    else {
      try { this.engine.assertOpen(); }
      catch (cause) {
        closedError = cause instanceof EgretError ? cause : new EgretError("ENGINE_CLOSED", { cause });
      }
    }
    if (closedError !== undefined) {
      const cleanupErrors: unknown[] = [];
      // A late unowned value must be cleaned up; a foreign owner stays authoritative.
      if (existingOwner === undefined) {
        try { cleanup(value); }
        catch (cause) {
          cleanupErrors.push(cause);
          this.engine.captureCleanup(cause);
          this.engine.report({ code: "SCOPE_LATE_CLEANUP_FAILED", phase: "scope", severity: "error", cause });
        }
      }
      throw new EgretError(closedError.code, { cause: closedError.cause, cleanupErrors });
    }
    return existingOwner;
  }

  /** Cancel first, then clean up in reverse acquisition order despite failures. */
  public dispose(): void {
    if (this.currentState !== "open") return;
    this.currentState = "closing";
    try {
      this.controller.abort(new EgretError("SCOPE_CLOSED"));
      for (let index = this.values.length - 1; index >= 0; index--) {
        const value = this.values[index];
        if (value === undefined) continue;
        try { cleanup(value); }
        catch (cause) {
          this.engine.captureCleanup(cause);
          this.engine.report({ code: "SCOPE_CLEANUP_FAILED", phase: "scope", severity: "error", cause });
        }
      }
    } finally {
      this.values.length = 0;
      this.currentState = "closed";
      this.onClosed(this);
    }
  }
}
