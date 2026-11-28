// SPDX-License-Identifier: Apache-2.0
// Connects a world3d scene to an Egret Engine: the Engine clock advances
// animation and draws the frame, and the owning Scope retires the view. The
// 3D canvas is separate from the 2D stage surface, so a 2D host with a
// transparent background can be stacked above it for UI.
import type { Disposable } from '@egret/contracts';
import type { Scope } from '@egret/runtime';
import type { AnimationMixer3D } from '../../rendering/world3d/Animation3D.js';
import type { Camera3D } from '../../rendering/world3d/Camera3D.js';
import { World3DError } from '../../rendering/world3d/core3D.js';
import type { Scene3D } from '../../rendering/world3d/Object3D.js';
import { ParticleEmitter3D } from '../../rendering/world3d/Particles3D.js';
import type { OrbitControls3D } from './OrbitControls3D.js';
import type { Renderer3D } from './frame3D.js';

/** The part of an Engine this view needs: its explicit game clock. */
export interface World3DClockSource {
  readonly clock: {
    onTick(
      scope: Scope,
      handler: (tick: { readonly deltaSeconds: number; readonly elapsedSeconds: number }) => undefined
    ): Disposable;
  };
}
/** CPU phases of a World3D view tick; a rendered result is not GPU completion. */
export interface World3DViewTiming {
  readonly id: number;
  readonly elapsedSeconds: number;
  readonly deltaSeconds: number;
  readonly callbackStartMs: number;
  readonly callbackEndMs: number;
  readonly updateMs: number;
  readonly renderMs: number;
  readonly outcome: 'rendered' | 'refused' | 'failed';
}
/** A 3D view to make: its renderer, scene and camera, its mixers and controls, its update, and how it resizes. */
export interface World3DViewOptions {
  readonly renderer: Renderer3D;
  readonly scene: Scene3D;
  readonly camera: Camera3D;
  readonly mixers?: readonly AnimationMixer3D[];
  readonly controls?: OrbitControls3D;
  /** Called every tick before animation and rendering. */
  readonly onUpdate?: (deltaSeconds: number, elapsedSeconds: number) => void;
  /** Opt-in CPU timings for active ticks; observer failures cannot change the view. */
  readonly onFrameTiming?: (sample: World3DViewTiming) => void;
  /** Prepare on the Engine clock and draw explicitly in the same turn. Defaults to immediate drawing. */
  readonly deferRender?: boolean;
  /** Keep the drawing buffer and camera aspect matched to the canvas CSS size. Defaults to true. */
  readonly autoResize?: boolean;
  /** Upper bound for the device pixel ratio used by autoResize. Defaults to 2. */
  readonly maxPixelRatio?: number;
  /** Step particle emitters found in the scene. Defaults to true. */
  readonly updateParticles?: boolean;
  /** Receives failures thrown while updating or drawing; the view keeps ticking. */
  readonly onError?: (cause: unknown) => void;
}

interface PendingDraw3D {
  readonly scene: Scene3D;
  readonly camera: Camera3D;
  readonly deltaSeconds: number;
  readonly elapsedSeconds: number;
  readonly started: number;
  readonly updateMs: number;
}

/** Draws a scene from a camera on each tick of the Engine, updating its mixers and controls. */
export class World3DView implements Disposable {
  readonly renderer: Renderer3D;
  #scene: Scene3D;
  #camera: Camera3D;
  readonly mixers: AnimationMixer3D[];
  controls: OrbitControls3D | undefined;
  #paused = false;
  #deferRender: boolean;
  #pending: PendingDraw3D | undefined;
  #pendingTurn: object | undefined;
  #updating = 0;
  readonly #subscription: Disposable;
  readonly #options: World3DViewOptions;
  #disposed = false;
  #timingId = 0;

  constructor(engine: World3DClockSource, scope: Scope, options: World3DViewOptions) {
    if (!engine || typeof engine.clock?.onTick !== 'function')
      throw new World3DError('WORLD3D_INPUT_INVALID', 'engine');
    if (
      !options?.renderer ||
      !options.scene ||
      !options.camera ||
      (options.deferRender !== undefined && typeof options.deferRender !== 'boolean') ||
      (options.onFrameTiming !== undefined && typeof options.onFrameTiming !== 'function')
    )
      throw new World3DError('WORLD3D_INPUT_INVALID', 'view options');
    this.#options = options;
    this.renderer = options.renderer;
    this.#scene = options.scene;
    this.#camera = options.camera;
    this.#deferRender = options.deferRender ?? false;
    this.mixers = [...(options.mixers ?? [])];
    this.controls = options.controls;
    // The Scope owns this view: closing the Scope ends ticking before the Engine closes.
    this.#subscription = engine.clock.onTick(scope, tick => {
      this.tick(tick.deltaSeconds, tick.elapsedSeconds);
      return undefined;
    });
    scope.use(this);
  }
  get isDisposed(): boolean {
    return this.#disposed;
  }
  get scene(): Scene3D {
    return this.#scene;
  }
  set scene(value: Scene3D) {
    if (value !== this.#scene) this.clearPending();
    this.#scene = value;
  }
  get camera(): Camera3D {
    return this.#camera;
  }
  set camera(value: Camera3D) {
    if (value !== this.#camera) this.clearPending();
    this.#camera = value;
  }
  /** Skip animation and drawing while true; the clock subscription stays active. */
  get paused(): boolean {
    return this.#paused;
  }
  set paused(value: boolean) {
    if (value !== this.#paused) this.clearPending();
    this.#paused = value;
  }
  /** Change the submission order without resetting the Engine clock or retaining old work. */
  get deferRender(): boolean {
    return this.#deferRender;
  }
  set deferRender(value: boolean) {
    if (typeof value !== 'boolean') throw new World3DError('WORLD3D_INPUT_INVALID', 'deferRender');
    if (value !== this.#deferRender) this.clearPending();
    this.#deferRender = value;
  }
  private clearPending(): void {
    this.#pending = undefined;
    this.#pendingTurn = undefined;
  }
  private preparePending(deltaSeconds: number, elapsedSeconds: number, started: number, updateMs: number): void {
    const previous = this.#pending;
    this.#pending = {
      scene: this.scene,
      camera: this.camera,
      deltaSeconds: (previous?.deltaSeconds ?? 0) + deltaSeconds,
      elapsedSeconds,
      started: previous?.started ?? started,
      updateMs: (previous?.updateMs ?? 0) + updateMs
    };
    if (this.#pendingTurn === undefined) {
      const turn = {};
      this.#pendingTurn = turn;
      queueMicrotask(() => {
        // No implicit frame request or delayed draw. A missed synchronous consumer
        // must not replay the old view after a later event or context restoration.
        if (this.#pendingTurn === turn) this.clearPending();
      });
    }
  }
  private reportTiming(
    deltaSeconds: number,
    elapsedSeconds: number,
    started: number,
    updateMs: number,
    renderMs: number,
    outcome: World3DViewTiming['outcome']
  ): void {
    const observer = this.#options.onFrameTiming;
    if (observer === undefined) return;
    const sample = Object.freeze({
      id: ++this.#timingId,
      elapsedSeconds,
      deltaSeconds,
      callbackStartMs: started,
      callbackEndMs: performance.now(),
      updateMs,
      renderMs,
      outcome
    });
    try {
      observer(sample);
    } catch {
      /* Independent diagnostics must not stop the view. */
    }
  }
  /** Advance and draw one frame. Normally driven by the Engine clock. */
  tick(deltaSeconds: number, elapsedSeconds: number): void {
    if (this.#disposed || this.paused) return;
    const options = this.#options;
    const observer = options.onFrameTiming;
    const started = observer === undefined ? 0 : performance.now();
    let renderStart: number | undefined;
    let renderEnd: number | undefined;
    let updateFailureEnd: number | undefined;
    let outcome: World3DViewTiming['outcome'] = 'failed';
    let report = true;
    const deferredAtStart = this.#deferRender;
    this.#updating++;
    try {
      if (options.autoResize ?? true) {
        const ratio = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, options.maxPixelRatio ?? 2);
        this.renderer.resizeToDisplaySize(ratio);
        const canvas = this.renderer.canvas;
        if (canvas.height > 0) this.camera.aspect = canvas.width / canvas.height;
      }
      options.onUpdate?.(deltaSeconds, elapsedSeconds);
      for (const mixer of this.mixers) mixer.update(deltaSeconds);
      this.controls?.update(deltaSeconds);
      if (options.updateParticles ?? true) {
        this.scene.traverse(object => {
          if (object instanceof ParticleEmitter3D && object.visible) object.update(deltaSeconds);
        });
      }
      if ((this.#deferRender || deferredAtStart) && (this.#disposed || this.paused)) {
        report = false;
        return;
      }
      if (this.#deferRender) {
        this.preparePending(
          deltaSeconds,
          elapsedSeconds,
          started,
          observer === undefined ? 0 : performance.now() - started
        );
        report = false;
        return;
      }
      if (observer !== undefined) renderStart = performance.now();
      const accepted = this.renderer.render(this.scene, this.camera);
      if (observer !== undefined) renderEnd = performance.now();
      outcome = accepted ? 'rendered' : 'refused';
    } catch (cause) {
      this.clearPending();
      if (observer !== undefined) {
        if (renderStart !== undefined) renderEnd = performance.now();
        else updateFailureEnd = performance.now();
      }
      if (!options.onError) throw cause;
      options.onError(cause);
    } finally {
      this.#updating--;
      if (report && observer !== undefined) {
        const ended = performance.now();
        this.reportTiming(
          deltaSeconds,
          elapsedSeconds,
          started,
          (renderStart ?? updateFailureEnd ?? ended) - started,
          renderStart === undefined ? 0 : (renderEnd ?? ended) - renderStart,
          outcome
        );
      }
    }
  }
  /**
   * Consume the latest prepared draw synchronously, for example after the shared
   * 2D submission of the same browser frame. True only when the renderer accepted it.
   */
  drawPending(): boolean {
    if (this.#updating !== 0) return false;
    const pending = this.#pending;
    this.clearPending();
    if (
      !pending ||
      !this.#deferRender ||
      this.#disposed ||
      this.paused ||
      pending.scene !== this.scene ||
      pending.camera !== this.camera
    )
      return false;
    const options = this.#options;
    const observer = options.onFrameTiming;
    const renderStart = observer === undefined ? 0 : performance.now();
    let renderEnd = renderStart;
    let outcome: World3DViewTiming['outcome'] = 'failed';
    try {
      const accepted = this.renderer.render(pending.scene, pending.camera);
      if (observer !== undefined) renderEnd = performance.now();
      outcome = accepted ? 'rendered' : 'refused';
      return accepted;
    } catch (cause) {
      if (observer !== undefined) renderEnd = performance.now();
      if (!options.onError) throw cause;
      options.onError(cause);
      return false;
    } finally {
      this.reportTiming(
        pending.deltaSeconds,
        pending.elapsedSeconds,
        pending.started,
        pending.updateMs,
        renderEnd - renderStart,
        outcome
      );
    }
  }
  /** Stop ticking. The renderer, scene and controls stay owned by their creator. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.clearPending();
    this.#subscription.dispose();
  }
}

/** Makes a view that draws a scene on each tick of the Engine's clock. */
export function createWorld3DView(engine: World3DClockSource, scope: Scope, options: World3DViewOptions): World3DView {
  return new World3DView(engine, scope, options);
}
