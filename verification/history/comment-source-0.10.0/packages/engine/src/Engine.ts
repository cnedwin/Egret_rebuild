import type { Diagnostic, DiagnosticHandler, HostAdapter } from "@egret/contracts";
import { EgretError, createScope, createStage, reportDiagnostic } from "@egret/runtime";
import type { Scope, Stage } from "@egret/runtime";
import type { EngineContext } from "@egret/runtime";
import { closeHost } from "./closeHost.js";

export interface EngineOptions {
  readonly host: HostAdapter;
  readonly shutdownTimeoutMs?: number;
  readonly onDiagnostic?: DiagnosticHandler;
}

export let constructEngine: (options: EngineOptions, timeoutMs: number, releaseSurface: () => void) => Engine;
const CREATION_TOKEN: unique symbol = Symbol("egret.engineFactory");

/** One headless run. Construct with createEngine(), not directly. */
export class Engine {
  private currentState: "open" | "closing" | "closed" = "open";
  private readonly scopes = new Set<Scope>();
  private readonly cleanupErrors: unknown[] = [];
  private closePromise: Promise<void> | undefined;
  private readonly host: HostAdapter;
  private readonly timeoutMs: number;
  private readonly onDiagnostic: DiagnosticHandler | undefined;
  private readonly releaseSurface: () => void;
  private readonly context: EngineContext;
  public readonly stage: Stage;

  private constructor(options: EngineOptions, timeoutMs: number, releaseSurface: () => void, token: typeof CREATION_TOKEN) {
    if (token !== CREATION_TOKEN) throw new EgretError("ENGINE_FACTORY_REQUIRED");
    this.host = options.host;
    this.timeoutMs = timeoutMs;
    this.onDiagnostic = options.onDiagnostic;
    this.releaseSurface = releaseSurface;
    this.context = {
      assertOpen: (): void => {
        if (this.currentState !== "open") throw new EgretError("ENGINE_CLOSED");
      },
      report: (diagnostic: Diagnostic): void => reportDiagnostic(this.onDiagnostic, diagnostic),
      captureCleanup: (cause: unknown): void => {
        if (this.currentState === "closing") this.cleanupErrors.push(cause);
      },
    };
    this.stage = createStage(this.context);
  }

  static {
    constructEngine = (options, timeoutMs, releaseSurface): Engine => new Engine(options, timeoutMs, releaseSurface, CREATION_TOKEN);
  }

  public createScope(): Scope {
    this.context.assertOpen();
    const scope = createScope(this.context, (closed): void => { this.scopes.delete(closed); });
    this.scopes.add(scope);
    return scope;
  }

  /** Every caller shares one close promise, including reentrant cleanup callbacks. */
  public dispose(): Promise<void> {
    if (this.closePromise !== undefined) return this.closePromise;
    let resolveClose: () => void = (): void => {};
    let rejectClose: (cause: unknown) => void = (): void => {};
    this.closePromise = new Promise<void>((resolve, reject) => { resolveClose = resolve; rejectClose = reject; });
    // Cache the result before abort/cleanup/diagnostic callbacks can reenter.
    this.currentState = "closing";
    void this.runClose().then(resolveClose, rejectClose);
    return this.closePromise;
  }

  // Scope cleanup precedes Stage cleanup, stop and the asynchronous host close.
  private async runClose(): Promise<void> {
    try {
      for (const scope of [...this.scopes].reverse()) {
        try { scope.dispose(); }
        catch (cause) {
          this.cleanupErrors.push(cause);
          this.context.report({ code: "ENGINE_SCOPE_CLEANUP_FAILED", phase: "engine", severity: "error", cause });
        }
      }
      try { this.stage.dispose(); }
      catch (cause) {
        this.cleanupErrors.push(cause);
        this.context.report({ code: "ENGINE_STAGE_CLEANUP_FAILED", phase: "engine", severity: "error", cause });
      }
      try { this.host.stop?.(); }
      catch (cause) {
        this.cleanupErrors.push(cause);
        this.context.report({ code: "HOST_STOP_FAILED", phase: "engine", severity: "error", cause });
      }
      await closeHost(this.host, this.timeoutMs, this.releaseSurface, this.cleanupErrors, this.onDiagnostic);
    } finally {
      this.currentState = "closed";
    }
  }
}
