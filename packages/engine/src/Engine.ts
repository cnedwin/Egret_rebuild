import { TEXTURED_FRAME_PROFILE_2D, SHARED_FRAME_PROFILE_2D } from '@egret/contracts';
import type { FrameOptions2D, RenderFrame2D, TexturedFrameProfile2D, TexturedRenderFrame2D, SharedFrameProfile2D, SharedFrameOptions2D, SharedRenderFrame2D } from '@egret/contracts';
import { collectFrameContent, collectTexturedFrameContent, collectSharedFrameContent } from '@egret/runtime';
import type { Diagnostic, DiagnosticHandler, HostAdapter } from "@egret/contracts";
import { EgretError, createScope, createStage, createAssetManager, reportDiagnostic, createDisplayInputOperations } from "@egret/runtime";
import type { AssetGroupOperations, AssetManager, AssetRef, Scope, Stage } from "@egret/runtime";
import type { EngineContext } from "@egret/runtime";
import { createBitmapResourceSlotOwner } from './bitmapResourceSlot.js';
import type { BitmapResourceSlot, BitmapResourceSlotOwner } from './bitmapResourceSlot.js';
import { createBitmapBindingOwner } from './bitmapBindingTicket.js';
import type { BitmapBindingOwner, BitmapBindingTicket } from './bitmapBindingTicket.js';
import { closeHost } from "./closeHost.js";
import { registerTexturedFrame, registerSharedFrame } from './internal/texturedFrameState.js';
import { createGameClockOwner } from './gameClock.js';
import type { AdmittedGameClockOptions, GameClockOwner } from './gameClock.js';
import type { GameClock, GameClockOptions, GameClockTick } from './gameClockTypes.js';
import { createTweenOwner } from './tween.js';
import type { TweenOwner } from './tween.js';
import type { Tween, TweenOptions } from './tweenTypes.js';
import { registerTextFieldEngine } from './internal/textFieldFactoryState.js';
import { createAssetGroupOwner } from './assetGroup.js';
import type { AssetGroupOwner } from './assetGroup.js';
import type { AssetGroup, AssetGroupOptions } from './assetGroupTypes.js';
import { createManifestAssetGroupOwner } from './manifestAssetGroup.js';
import type { ManifestAssetGroupOwner } from './manifestAssetGroup.js';
import type { ManifestAssetGroup, ManifestBinding, ManifestGroupOptions } from './manifestResourceTypes.js';
import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import { createMouseInputOwner } from './mouseInput.js';
import type { MouseInputOwner } from './mouseInput.js';
import { createSequencePlaybackOwner } from './sequencePlayback.js';
import type { SequencePlaybackOwner } from './sequencePlayback.js';
import type { SequencePlayback, SequencePlaybackOptions } from './sequencePlaybackTypes.js';
import type { Bitmap, SequenceClip } from '@egret/runtime';
import {registerUiEngine} from './internal/uiFactoryState.js';
import type {UiEngineOwner} from './internal/uiFactoryState.js';
import {createSequenceTargetClaims} from './sequenceTargetClaims.js';
import {registerSequenceControllerEngine} from './internal/sequenceControllerFactoryState.js';
import type {SequenceControllerEngineOwner} from './internal/sequenceControllerFactoryState.js';

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
  readonly shared?: ((frame: SharedRenderFrame2D) => unknown) | undefined;
  readonly sharedProfile?: SharedFrameProfile2D | undefined;
}
export let constructEngine: (options: EngineOptions, timeoutMs: number, surface: object, releaseSurface: () => void, ports: CapturedEngineFramePorts, clockOptions: AdmittedGameClockOptions) => Engine;
const freezeSharedFrame = Object.freeze;
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
  readonly #tweenOwner: TweenOwner;
  readonly #sequencePlaybackOwner: SequencePlaybackOwner;
  readonly #sequenceControllerOwner: SequenceControllerEngineOwner;
  readonly #assetGroupOwner: AssetGroupOwner;
  readonly #manifestAssetGroupOwner: ManifestAssetGroupOwner;
  readonly #bitmapResourceSlotOwner: BitmapResourceSlotOwner;
  readonly #bitmapBindingOwner: BitmapBindingOwner;
  readonly #bitmapResourceTargets = new WeakMap<Bitmap, Parameters<NonNullable<EngineContext['registerBitmapResourceTarget']>>[1]>();
  readonly #mouseInputOwner: MouseInputOwner;
  readonly #uiOwner: UiEngineOwner;
  readonly #engineScopes = new WeakSet<Scope>();
  private frameBusy = false;
  private nextFrameId = 1;
  private frameIdle: Promise<void> | undefined;
  private releaseFrame: (() => void) | undefined;
  private readonly renderer: ((frame: RenderFrame2D) => unknown) | undefined;
  private readonly sharedRenderer: ((frame: SharedRenderFrame2D) => unknown) | undefined;
  private readonly texturedRenderer: ((frame: TexturedRenderFrame2D) => unknown) | undefined;
   #currentState: "open" | "closing" | "closed" = "open";
  private readonly scopes = new Set<Scope>();
  private readonly cleanupErrors: unknown[] = [];
  private closePromise: Promise<void> | undefined;
  private readonly host: HostAdapter;
  private readonly timeoutMs: number;
  private readonly onDiagnostic: DiagnosticHandler | undefined;
  private readonly releaseSurface: () => void;
  readonly #context: EngineContext;
  public readonly stage: Stage;
  public readonly assets: AssetManager;
  public readonly sharedFrameProfile: SharedFrameProfile2D | undefined;
  public readonly texturedFrameProfile: TexturedFrameProfile2D | undefined;
  public readonly clock: GameClock;

  private constructor(options: EngineOptions, timeoutMs: number, surface: object, releaseSurface: () => void, ports: CapturedEngineFramePorts, clockOptions: AdmittedGameClockOptions, token: typeof CREATION_TOKEN) {
    if (token !== CREATION_TOKEN) throw new EgretError("ENGINE_FACTORY_REQUIRED");
    this.host = options.host;
    this.renderer = ports.legacy;
    this.sharedRenderer = ports.shared;
    this.sharedFrameProfile = ports.sharedProfile;
    this.texturedRenderer = ports.textured;
    this.texturedFrameProfile = ports.profile;
    this.timeoutMs = timeoutMs;
    this.onDiagnostic = options.onDiagnostic;
    this.releaseSurface = releaseSurface;
    const assertOpen = (): void => {
      if (this.#currentState !== 'open') throw new EgretError('ENGINE_CLOSED');
    };
    const textFields = registerTextFieldEngine(this, assertOpen,
      (scope: unknown): scope is Scope => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope as Scope));
    let assetGroupOperations: AssetGroupOperations | undefined;
    // The context is never retained in a named public property by its consumers.
    this.#context = Object.freeze({
      assertOpen: (): void => {
        if (this.#currentState !== "open") throw new EgretError("ENGINE_CLOSED");
      },
      report: (diagnostic: Diagnostic): void => reportDiagnostic(this.onDiagnostic, diagnostic),
      captureCleanup: (cause: unknown): void => {
        if (this.#currentState === "closing") this.cleanupErrors.push(cause);
      },
      registerTextFieldCache: textFields.registerCache,
      registerBitmapResourceTarget: (bitmap: Bitmap, operations: Parameters<NonNullable<EngineContext['registerBitmapResourceTarget']>>[1]): void => {
        this.#bitmapResourceTargets.set(bitmap, operations);
      },
      registerAssetGroupOperations: (operations: AssetGroupOperations): void => { assetGroupOperations = operations; },
    });
    // The inert owner precedes publication and uses private Scope membership.
    this.#gameClockOwner = createGameClockOwner({
      assertOpen: this.#context.assertOpen,
      isEngineScope: (scope: unknown): scope is Scope => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope as Scope),
      isFrameBusy: (): boolean => this.frameBusy,
      report: this.#context.report,
    }, clockOptions);
    // Tween assembly receives the authentic private clock before publication.
    this.#tweenOwner = createTweenOwner({
      assertOpen: this.#context.assertOpen,
      isEngineScope: (scope: unknown): scope is Scope => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope as Scope),
      clock: this.#gameClockOwner.clock,
    });
    const sequenceClaims = createSequenceTargetClaims();
    // Sequence playback borrows the private clock and authentic Scope authority.
    this.#sequencePlaybackOwner = createSequencePlaybackOwner({
      assertOpen: this.#context.assertOpen,
      isEngineScope: (scope: unknown): scope is Scope => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope as Scope),
      clock: this.#gameClockOwner.clock,
      claims: sequenceClaims,
      captureCleanup: this.#context.captureCleanup,
    });
    this.#sequenceControllerOwner = registerSequenceControllerEngine(this, {
      assertOpen: this.#context.assertOpen, createScope: (): Scope => this.#createScope(),
      clock: this.#gameClockOwner.clock, isClockBusy: this.#gameClockOwner.isBusy,
      claims: sequenceClaims, report: this.#context.report, captureCleanup: this.#context.captureCleanup,
    });
    this.clock = this.#gameClockOwner.clock;
    const stage = createStage(this.#context);
    this.#uiOwner = registerUiEngine(this, {
      stage, assertOpen: this.#context.assertOpen, isFrameBusy: (): boolean => this.frameBusy,
      createScope: (): Scope => this.#createScope(), report: this.#context.report,
      captureCleanup: this.#context.captureCleanup,
    });
    const rawInput = createDisplayInputOperations(stage);
    const deliverInput = this.#uiOwner.deliver;
    const inputOperations = Object.freeze({
      pick: rawInput.pick, isAttached: rawInput.isAttached,
      dispatch: <T>(...args: Parameters<typeof rawInput.dispatch<T>>): boolean =>
        deliverInput(() => rawInput.dispatch<T>(...args)),
    });
    // Capture original startup and Stage authority before publishing replaceable readonly fields.
    this.#mouseInputOwner = createMouseInputOwner(this, {
      surface, operations: inputOperations, assertOpen: this.#context.assertOpen,
      report: this.#context.report, captureCleanup: this.#context.captureCleanup,
    });
    this.stage = stage;
    this.assets = createAssetManager(this.#context);
    this.#bitmapBindingOwner = createBitmapBindingOwner({
      assertOpen: this.#context.assertOpen,
      isEngineScope: (scope: unknown): scope is Scope => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope as Scope),
    }, this.#bitmapResourceTargets);
    // Authentic manager construction captured the operations before publication.
    this.#bitmapResourceSlotOwner = createBitmapResourceSlotOwner({
      assertOpen: this.#context.assertOpen,
      isEngineScope: (scope: unknown): scope is Scope => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope as Scope),
      report: this.#context.report, captureCleanup: this.#context.captureCleanup,
    }, assetGroupOperations!, this.#bitmapResourceTargets);
    this.#assetGroupOwner = createAssetGroupOwner({
      assertOpen: this.#context.assertOpen,
      isEngineScope: (scope: unknown): scope is Scope => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope as Scope),
      report: this.#context.report,
      captureCleanup: this.#context.captureCleanup,
    }, assetGroupOperations!);
    this.#manifestAssetGroupOwner = createManifestAssetGroupOwner({
      assertOpen: this.#context.assertOpen,
      isEngineScope: (scope: unknown): scope is Scope => typeof scope === 'object' && scope !== null && this.#engineScopes.has(scope as Scope),
      report: this.#context.report,
      captureCleanup: this.#context.captureCleanup,
    }, assetGroupOperations!);
  }

  static {
    constructEngine = (options, timeoutMs, surface, releaseSurface, ports, clockOptions): Engine => new Engine(options, timeoutMs, surface, releaseSurface, ports, clockOptions, CREATION_TOKEN);
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

  public captureSharedFrame(options: SharedFrameOptions2D): SharedRenderFrame2D {
    return this.executeSharedFrame(options, false);
  }

  /** Capture a prepared binding view without publishing it to the live scene. */
  public capturePreparedSharedFrame(ticket: BitmapBindingTicket, options: SharedFrameOptions2D): SharedRenderFrame2D {
    return this.executeSharedFrame(options, false, [ticket]);
  }

  public renderSharedFrame(options: SharedFrameOptions2D): SharedRenderFrame2D {
    return this.executeSharedFrame(options, true);
  }

  /** Share the existing lifecycle barrier and ID sequence without changing old options. */
  private executeSharedFrame(options: SharedFrameOptions2D, render: boolean, candidate?: readonly [BitmapBindingTicket]): SharedRenderFrame2D {
    this.#context.assertOpen();
    if (this.frameBusy) throw new EgretError('FRAME_REENTRANT');
    if (this.#gameClockOwner.isBusy()) throw new EgretError('CLOCK_REENTRANT');
    this.frameBusy = true;
    this.frameIdle = new Promise<void>(resolve => { this.releaseFrame = resolve; });
    try {
      const renderer = this.sharedRenderer;
      if (render && renderer === undefined) throw new EgretError('RENDERER_REQUIRED');
      const prepared = candidate === undefined ? undefined : this.#bitmapBindingOwner.readPreparedForCapture(candidate[0]);
      let width: unknown, height: unknown, colorInput: unknown, alphaInput: unknown, outputInput: unknown;
      let optionsFailed = false, optionsCause: unknown;
      try {
        width = options.width;
        height = options.height;
        colorInput = options.clearColor;
        alphaInput = options.clearAlpha;
        outputInput = options.outputAlpha;
      } catch (cause) {
        // Even a caller-thrown EgretError is an external read failure here.
        if (prepared === undefined) throw new EgretError('INVALID_FRAME_OPTIONS', { cause });
        optionsFailed = true; optionsCause = cause;
      }
      // Candidate lifetime/phase wins even when an option getter threw undefined.
      // Binding, target and entitlement preflight waits for valid options below.
      prepared?.validate();
      if (optionsFailed) throw new EgretError('INVALID_FRAME_OPTIONS', { cause: optionsCause });
      const outputAlpha = outputInput === undefined ? 'premultiplied' : outputInput;
      const clearColor = colorInput === undefined ? 0 : colorInput;
      const clearAlpha = alphaInput === undefined ? (outputAlpha === 'opaque' ? 1 : 0) : alphaInput;
      if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0
        || typeof height !== 'number' || !Number.isFinite(height) || height <= 0
        || typeof clearColor !== 'number' || !Number.isInteger(clearColor) || clearColor < 0 || clearColor > 0xffffff
        || typeof clearAlpha !== 'number' || !Number.isFinite(clearAlpha) || clearAlpha < 0 || clearAlpha > 1
        || (outputAlpha !== 'opaque' && outputAlpha !== 'premultiplied')
        || (outputAlpha === 'opaque' && clearAlpha !== 1)) throw new EgretError('INVALID_FRAME_OPTIONS');
      this.#context.assertOpen();
      const content = prepared === undefined ? collectSharedFrameContent(this.stage) : prepared.captureContent(this.stage);
      this.#context.assertOpen();
      prepared?.validate();
      if (!Number.isSafeInteger(this.nextFrameId) || this.nextFrameId <= 0) throw new EgretError('FRAME_ID_EXHAUSTED');
      const frame = freezeSharedFrame({
        profile: SHARED_FRAME_PROFILE_2D, colorRecipe: 'egret.linear-srgb-pma/1',
        targetRepresentation: 'egret.srgb-pma8-target/1',
        outputRepresentation: outputAlpha === 'opaque' ? 'egret.srgb-opaque-unorm8/1' : 'egret.srgb-premultiplied-unorm8/1',
        frameId: this.nextFrameId, width, height, clearColor, clearAlpha, outputAlpha, ...content,
      }) as SharedRenderFrame2D;
      registerSharedFrame(frame);
      this.nextFrameId++;
      if (render) {
        try {
          const result = Reflect.apply(renderer!, this.host, [frame]);
          if (result !== undefined) {
            observeRejectedRenderResult(result);
            throw new EgretError('INVALID_RENDERER');
          }
        } catch (cause) {
          this.#context.report({ code: 'FRAME_RENDER_FAILED', phase: 'graphics', severity: 'error', cause });
          throw new EgretError('FRAME_RENDER_FAILED', { cause });
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

  /** Busy precedes all external reads; cleanup waits for the finally barrier. */
  private executeFrame(options: FrameOptions2D, render: boolean, textured: false): RenderFrame2D;
  private executeFrame(options: FrameOptions2D, render: boolean, textured: true): TexturedRenderFrame2D;
  private executeFrame(options: FrameOptions2D, render: boolean, textured: boolean): RenderFrame2D | TexturedRenderFrame2D {
    this.#context.assertOpen();
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
      this.#context.assertOpen();
      const content = textured ? collectTexturedFrameContent(this.stage) : collectFrameContent(this.stage);
      this.#context.assertOpen();
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
          this.#context.report({ code: "FRAME_RENDER_FAILED", phase: "graphics", severity: "error", cause });
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

  public createScope(): Scope { return this.#createScope(); }

  #createScope(): Scope {
    this.#context.assertOpen();
    const scope = createScope(this.#context, (closed): void => { this.scopes.delete(closed); });
    this.scopes.add(scope);
    this.#engineScopes.add(scope);
    this.#sequenceControllerOwner.registerScope(scope);
    this.#mouseInputOwner.registerScope(scope);
    this.#uiOwner.registerScope(scope);
    return scope;
  }

  public createTween(scope: Scope, options: TweenOptions): Tween {
    return this.#tweenOwner.create(scope, options);
  }

  /** Create an idle, Scope-owned sequence controller without rendering or ticking. */
  public createSequencePlayback(scope: Scope, bitmap: Bitmap, clip: SequenceClip, options?: SequencePlaybackOptions): SequencePlayback {
    return this.#sequencePlaybackOwner.create(scope, bitmap, clip, options);
  }

  /** Preserve the current image while an explicitly requested replacement loads. */
  public createBitmapResourceSlot(scope: Scope, bitmap: Bitmap): BitmapResourceSlot {
    return this.#bitmapResourceSlotOwner.create(scope, bitmap);
  }

  /** Capture exact Bitmap bindings before asynchronously preparing a borrowed group. */
  public captureBitmapBindings(scope: Scope, targets: readonly Bitmap[]): BitmapBindingTicket {
    return this.#bitmapBindingOwner.capture(scope, targets);
  }

  public createAssetGroup<T>(scope: Scope, refs: readonly AssetRef<T>[], options?: AssetGroupOptions): AssetGroup<T> {
    return this.#assetGroupOwner.create<T>(scope, refs, options);
  }

  /** Acquire an admitted dependency closure with independent group-owned leases. */
  public createManifestGroup(scope: Scope, manifest: AdmittedResourceManifest, roots: readonly string[], bindings: readonly ManifestBinding[], options?: ManifestGroupOptions): ManifestAssetGroup {
    return this.#manifestAssetGroupOwner.create(scope, manifest, roots, bindings, options);
  }

  /** Every caller shares one close promise, including reentrant cleanup callbacks. */
  public dispose(): Promise<void> {
    if (this.closePromise !== undefined) return this.closePromise;
    let resolveClose: () => void = (): void => {};
    let rejectClose: (cause: unknown) => void = (): void => {};
    this.closePromise = new Promise<void>((resolve, reject) => { resolveClose = resolve; rejectClose = reject; });
    // Cache the result before abort/cleanup/diagnostic callbacks can reenter.
    this.#currentState = "closing";
    // Detach managed UI before input and ordinary Scope/Stage cleanup.
    this.#uiOwner.close();
    // Revoke every manifest group before cleanup callbacks can reenter.
    this.#manifestAssetGroupOwner.close();
    this.#bitmapBindingOwner.close();
    this.#bitmapResourceSlotOwner.close();
    // Retire browser input before the remaining callback-capable owners or idle wait.
    this.#mouseInputOwner.close();
    // Terminal observations change now, before the existing idle barriers wait.
    this.#assetGroupOwner.close();
    this.#tweenOwner.close();
    this.#sequenceControllerOwner.close();
    this.#sequencePlaybackOwner.close();
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
          this.#context.report({ code: "ENGINE_SCOPE_CLEANUP_FAILED", phase: "engine", severity: "error", cause });
        }
      }
      try { this.stage.dispose(); }
      catch (cause) {
        this.cleanupErrors.push(cause);
        this.#context.report({ code: "ENGINE_STAGE_CLEANUP_FAILED", phase: "engine", severity: "error", cause });
      }
      try { this.assets.dispose(); }
      catch (cause) {
        this.cleanupErrors.push(cause);
        this.#context.report({ code: "ENGINE_ASSETS_CLEANUP_FAILED", phase: "assets", severity: "error", cause });
      }
      try { this.host.stop?.(); }
      catch (cause) {
        this.cleanupErrors.push(cause);
        this.#context.report({ code: "HOST_STOP_FAILED", phase: "engine", severity: "error", cause });
      }
      await closeHost(this.host, this.timeoutMs, this.releaseSurface, this.cleanupErrors, this.onDiagnostic);
    } finally {
      this.#currentState = "closed";
    }
  }
}
