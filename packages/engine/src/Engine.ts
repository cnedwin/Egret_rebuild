import { TEXTURED_FRAME_PROFILE_2D } from '@egret/contracts';
import type { FrameOptions2D, RenderFrame2D, TexturedFrameProfile2D, TexturedRenderFrame2D } from '@egret/contracts';
import { collectFrameContent, collectTexturedFrameContent } from '@egret/runtime';
import type { Diagnostic, DiagnosticHandler, HostAdapter } from "@egret/contracts";
import { EgretError, createScope, createStage, createAssetManager, reportDiagnostic } from "@egret/runtime";
import type { AssetManager, Scope, Stage } from "@egret/runtime";
import type { EngineContext } from "@egret/runtime";
import { closeHost } from "./closeHost.js";
import { registerTexturedFrame } from './internal/texturedFrameState.js';
import { createGameClockOwner } from './gameClock.js';
import type { AdmittedGameClockOptions, GameClockOwner } from './gameClock.js';
import type { GameClock, GameClockOptions, GameClockTick } from './gameClockTypes.js';

export interface EngineOptions {
  readonly host: HostAdapter;
  readonly shutdownTimeoutMs?: number;
  readonly onDiagnostic?: DiagnosticHandler;
  readonly clock?: GameClockOptions;
}

export interface CapturedEngineFramePorts {
  readonly legacy: ((frame: RenderFrame2D) => unknown) | undefined;
  readonly textured: ((frame: TexturedRenderFrame2D) => unknown) | undefined;
  readonly profile: TexturedFrameProfile2D | undefined;
}
export let constructEngine: (options: EngineOptions, timeoutMs: number, releaseSurface: () => void, ports: CapturedEngineFramePorts, clockOptions: AdmittedGameClockOptions) => Engine;
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
  readonly #gameClockOwner: GameClockOwner;
  readonly #engineScopes = new WeakSet<Scope>();
  private frameBusy = false;
  private nextFrameId = 1;
  private frameIdle: Promise<void> | undefined;
  private releaseFrame: (() => void) | undefined;
  private readonly renderer: ((frame: RenderFrame2D) => unknown) | undefined;
  private readonly texturedRenderer: ((frame: TexturedRenderFrame2D) => unknown) | undefined;
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
  public readonly texturedFrameProfile: TexturedFrameProfile2D | undefined;
  public readonly clock: GameClock;

  private constructor(options: EngineOptions, timeoutMs: number, releaseSurface: () => void, ports: CapturedEngineFramePorts, clockOptions: AdmittedGameClockOptions, token: typeof CREATION_TOKEN) {
    if (token !== CREATION_TOKEN) throw new EgretError("ENGINE_FACTORY_REQUIRED");
    this.host = options.host;
    this.renderer = ports.legacy;
    this.texturedRenderer = ports.textured;
    this.texturedFrameProfile = ports.profile;
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
    // The inert owner precedes publication and uses private Scope membership.
    this.#gameClockOwner = createGameClockOwner({
      assertOpen: this.context.assertOpen,
      isEngineScope: (scope: unknown): scope is Scope => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope as Scope),
      isFrameBusy: (): boolean => this.frameBusy,
      report: this.context.report,
    }, clockOptions);
    this.clock = this.#gameClockOwner.clock;
    this.stage = createStage(this.context);
    this.assets = createAssetManager(this.context);
  }

  static {
    constructEngine = (options, timeoutMs, releaseSurface, ports, clockOptions): Engine => new Engine(options, timeoutMs, releaseSurface, ports, clockOptions, CREATION_TOKEN);
  }

  public advanceTime(sourceSeconds: number): GameClockTick | undefined {
    return this.#gameClockOwner.advance(sourceSeconds);
  }

  public captureFrame(options: FrameOptions2D): RenderFrame2D {
    return this.executeFrame(options, false, false);
  }

  public renderFrame(options: FrameOptions2D): RenderFrame2D {
    return this.executeFrame(options, true, false);
  }

  public captureTexturedFrame(options: FrameOptions2D): TexturedRenderFrame2D {
    return this.executeFrame(options, false, true);
  }

  public renderTexturedFrame(options: FrameOptions2D): TexturedRenderFrame2D {
    return this.executeFrame(options, true, true);
  }

  /** Busy precedes all external reads; cleanup waits for the finally barrier. */
  private executeFrame(options: FrameOptions2D, render: boolean, textured: false): RenderFrame2D;
  private executeFrame(options: FrameOptions2D, render: boolean, textured: true): TexturedRenderFrame2D;
  private executeFrame(options: FrameOptions2D, render: boolean, textured: boolean): RenderFrame2D | TexturedRenderFrame2D {
    this.context.assertOpen();
    if (this.frameBusy) throw new EgretError("FRAME_REENTRANT");
    if (this.#gameClockOwner.isBusy()) throw new EgretError('CLOCK_REENTRANT');
    this.frameBusy = true;
    this.frameIdle = new Promise<void>(resolve => { this.releaseFrame = resolve; });
    try {
      const renderer = textured ? this.texturedRenderer : this.renderer;
      if (render && renderer === undefined) throw new EgretError("RENDERER_REQUIRED");
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
      const content = textured ? collectTexturedFrameContent(this.stage) : collectFrameContent(this.stage);
      this.context.assertOpen();
      if (!Number.isSafeInteger(this.nextFrameId) || this.nextFrameId <= 0) {
        throw new EgretError("FRAME_ID_EXHAUSTED");
      }
      const frame = Object.freeze({
        ...(textured ? { profile: TEXTURED_FRAME_PROFILE_2D } : {}),
        frameId: this.nextFrameId++, width, height, clearColor, clearAlpha, ...content,
      });
      // Only the Engine registers a fully captured, frozen new-profile record.
      if (textured) registerTexturedFrame(frame as TexturedRenderFrame2D);
      if (render) {
        try {
          const result = Reflect.apply(renderer!, this.host, [frame]);
          if (result !== undefined) {
            observeRejectedRenderResult(result);
            throw new EgretError("INVALID_RENDERER");
          }
        } catch (cause) {
          this.context.report({ code: "FRAME_RENDER_FAILED", phase: "graphics", severity: "error", cause });
          throw new EgretError("FRAME_RENDER_FAILED", { cause });
        }
      }
      return frame as RenderFrame2D | TexturedRenderFrame2D;
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
    this.#engineScopes.add(scope);
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
    this.#gameClockOwner.close();
    void this.runClose().then(resolveClose, rejectClose);
    return this.closePromise;
  }

  // Scope and Stage cleanup precede CPU assets, stop and asynchronous host close.
  private async runClose(): Promise<void> {
    try {
      if (this.frameIdle !== undefined) await this.frameIdle;
      if (this.#gameClockOwner.isBusy()) await this.#gameClockOwner.whenIdle();
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





