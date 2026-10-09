import type { FrameOptions2D, RenderFrame2D } from '@egret/contracts';
import { collectFrameCommands } from '@egret/runtime';
import type { Diagnostic, DiagnosticHandler, HostAdapter } from "@egret/contracts";
import { EgretError, createScope, createStage, createAssetManager, reportDiagnostic } from "@egret/runtime";
import type { AssetManager, Scope, Stage } from "@egret/runtime";
import type { EngineContext } from "@egret/runtime";
import { closeHost } from "./closeHost.js";

export interface EngineOptions {
  readonly host: HostAdapter;
  readonly shutdownTimeoutMs?: number;
  readonly onDiagnostic?: DiagnosticHandler;
}

export let constructEngine: (options: EngineOptions, timeoutMs: number, releaseSurface: () => void, renderer: ((frame: RenderFrame2D) => unknown) | undefined) => Engine;
const CREATION_TOKEN: unique symbol = Symbol("egret.engineFactory");

/** Observation does not accept asynchronous submission or prove host completion. */
function observeRejectedRenderResult(result: unknown): void {
  const ignoreRejection = (): void => {};
  try {
    // Intrinsic brand checking recognizes native Promises from other realms and
    // avoids consulting an overridden .then property on a native Promise.
    void Reflect.apply(Promise.prototype.then, result, [undefined, ignoreRejection]);
  } catch {
    // Ordinary thenables (including throwing then getters) are assimilated into
    // a handled Promise. Observation must not replace the invalid-port cause.
    try { void Promise.resolve(result).then(undefined, ignoreRejection); }
    catch { /* A hostile constructor cannot make this return type acceptable. */ }
  }
}
/** One headless run. Construct with createEngine(), not directly. */
export class Engine {
  private frameBusy = false;
  private nextFrameId = 1;
  private frameIdle: Promise<void> | undefined;
  private releaseFrame: (() => void) | undefined;
  private readonly renderer: ((frame: RenderFrame2D) => unknown) | undefined;
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
  public readonly assets: AssetManager;

  private constructor(options: EngineOptions, timeoutMs: number, releaseSurface: () => void, renderer: ((frame: RenderFrame2D) => unknown) | undefined, token: typeof CREATION_TOKEN) {
    if (token !== CREATION_TOKEN) throw new EgretError("ENGINE_FACTORY_REQUIRED");
    this.host = options.host;
    this.renderer = renderer;
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
    this.assets = createAssetManager(this.context);
  }

  static {
    constructEngine = (options, timeoutMs, releaseSurface, renderer): Engine => new Engine(options, timeoutMs, releaseSurface, renderer, CREATION_TOKEN);
  }

  public captureFrame(options: FrameOptions2D): RenderFrame2D {
    return this.executeFrame(options, false);
  }

  public renderFrame(options: FrameOptions2D): RenderFrame2D {
    return this.executeFrame(options, true);
  }

  /** Busy precedes all external reads; cleanup waits for the finally barrier. */
  private executeFrame(options: FrameOptions2D, render: boolean): RenderFrame2D {
    this.context.assertOpen();
    if (this.frameBusy) throw new EgretError("FRAME_REENTRANT");
    this.frameBusy = true;
    this.frameIdle = new Promise<void>(resolve => { this.releaseFrame = resolve; });
    try {
      if (render && this.renderer === undefined) throw new EgretError("RENDERER_REQUIRED");
      let width: number;
      let height: number;
      let clearColor: number;
      let clearAlpha: number;
      try {
        width = options.width;
        height = options.height;
        const color = options.clearColor;
        const alpha = options.clearAlpha;
        // Null is invalid rather than an omitted optional value.
        clearColor = color === undefined ? 0 : color;
        clearAlpha = alpha === undefined ? 0 : alpha;
        if (typeof width !== "number" || !Number.isFinite(width) || width <= 0
          || typeof height !== "number" || !Number.isFinite(height) || height <= 0
          || typeof clearColor !== "number" || !Number.isInteger(clearColor)
          || clearColor < 0 || clearColor > 0xffffff
          || typeof clearAlpha !== "number" || !Number.isFinite(clearAlpha)
          || clearAlpha < 0 || clearAlpha > 1) {
          throw new EgretError("INVALID_FRAME_OPTIONS");
        }
      } catch (cause) {
        if (cause instanceof EgretError) throw cause;
        throw new EgretError("INVALID_FRAME_OPTIONS", { cause });
      }
      this.context.assertOpen();
      const commands = collectFrameCommands(this.stage);
      this.context.assertOpen();
      if (!Number.isSafeInteger(this.nextFrameId) || this.nextFrameId <= 0) {
        throw new EgretError("FRAME_ID_EXHAUSTED");
      }
      const frame = Object.freeze({
        frameId: this.nextFrameId++, width, height, clearColor, clearAlpha, commands,
      });
      if (render) {
        try {
          const result = Reflect.apply(this.renderer!, this.host, [frame]);
          if (result !== undefined) {
            observeRejectedRenderResult(result);
            throw new EgretError("INVALID_RENDERER");
          }
        } catch (cause) {
          this.context.report({ code: "FRAME_RENDER_FAILED", phase: "graphics", severity: "error", cause });
          throw new EgretError("FRAME_RENDER_FAILED", { cause });
        }
      }
      return frame;
    } finally {
      this.frameBusy = false;
      const release = this.releaseFrame;
      this.releaseFrame = undefined;
      this.frameIdle = undefined;
      release?.();
    }
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

  // Scope and Stage cleanup precede CPU assets, stop and asynchronous host close.
  private async runClose(): Promise<void> {
    try {
      if (this.frameIdle !== undefined) await this.frameIdle;
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
      try { this.assets.dispose(); }
      catch (cause) {
        this.cleanupErrors.push(cause);
        this.context.report({ code: "ENGINE_ASSETS_CLEANUP_FAILED", phase: "assets", severity: "error", cause });
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





