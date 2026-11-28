// SPDX-License-Identifier: Apache-2.0
// A World3D game in a page from one call: the backend chosen from the address or the device, an Engine on a
// World3D host, a renderer set up for a picture quality, a frame loop, and a drawing resolution that follows the
// frame rate. Each piece is made the way its own module makes it, and one dispose ends them all.
import { createEngine } from '@egret/engine';
import type { Engine } from '@egret/engine';
import type { Scope } from '@egret/runtime';
import type { Disposable } from '@egret/contracts';
import { World3DError } from '../../rendering/world3d/core3D.js';
import type { Camera3D } from '../../rendering/world3d/Camera3D.js';
import type { Scene3D } from '../../rendering/world3d/Object3D.js';
import type { AnimationMixer3D } from '../../rendering/world3d/Animation3D.js';
import type { Renderer3D, ToneMapping3D } from './frame3D.js';
import { createWorld3DHost, startWorld3DLoop } from './host3D.js';
import { World3DView } from './World3DView.js';
import type { World3DViewTiming } from './World3DView.js';
import type { World3DLoopTiming } from './host3D.js';
import type { OrbitControls3D } from './OrbitControls3D.js';

/** Which GPU interface a 3D app draws with. */
export type World3DBackend = 'webgl2' | 'webgpu';
/** How much a 3D app draws: low, medium or high quality. */
export type World3DQuality = 'low' | 'medium' | 'high';

/** What one picture quality turns on. */
export interface World3DQualityPreset {
  /** Largest device pixel ratio drawn at. */
  readonly pixelRatio: number;
  /** Multisampling of the canvas; fixed when the renderer is made. */
  readonly antialias: boolean;
  readonly shadows: boolean;
  /** Edge of the shadow atlas in texels; fixed when the renderer is made. */
  readonly shadowAtlasSize: number;
  /** The post-processing chain, and which of its parts run. */
  readonly post: boolean;
  readonly bloom: boolean;
  readonly ssao: boolean;
  readonly fxaa: boolean;
}

/** The three qualities. A phone gets `low`, a desktop `high`; `medium` sits between for weaker computers. */
export const WORLD3D_QUALITY_PRESETS: Readonly<Record<World3DQuality, World3DQualityPreset>> = Object.freeze({
  low: Object.freeze({
    pixelRatio: 1,
    antialias: false,
    shadows: false,
    shadowAtlasSize: 1024,
    post: false,
    bloom: false,
    ssao: false,
    fxaa: false
  }),
  medium: Object.freeze({
    pixelRatio: 1.5,
    antialias: true,
    shadows: true,
    shadowAtlasSize: 2048,
    post: true,
    bloom: true,
    ssao: false,
    fxaa: true
  }),
  high: Object.freeze({
    pixelRatio: 2,
    antialias: true,
    shadows: true,
    shadowAtlasSize: 4096,
    post: true,
    bloom: true,
    ssao: true,
    fxaa: true
  })
});

/** What `pickWorld3DQuality` reads about the device. Every field is optional; missing ones are read from the page. */
export interface World3DDeviceHints {
  /** The page address's query, as `location.search` or its parsed form. `quality=low|medium|high` wins. */
  readonly query?: string | URLSearchParams;
  /** A quality the player chose before, as kept in a save. Wins over the device, not over the address. */
  readonly stored?: string | null;
  /** True when the main pointer is a finger. */
  readonly coarsePointer?: boolean;
  /** The shorter side of the window, in CSS pixels. */
  readonly shortSide?: number;
  /** `navigator.deviceMemory`, in gigabytes, where the browser reports it. */
  readonly deviceMemory?: number;
  /** True when the page is drawn by software, without a graphics card. Not read from the page: see `isSoftwareRendered3D`. */
  readonly softwareRenderer?: boolean;
}

const QUALITIES: readonly string[] = ['low', 'medium', 'high'];
const isQuality = (value: unknown): value is World3DQuality => typeof value === 'string' && QUALITIES.includes(value);
const params = (query: string | URLSearchParams | undefined): URLSearchParams | undefined => {
  if (query instanceof URLSearchParams) return query;
  if (typeof query === 'string') return new URLSearchParams(query);
  const search = (globalThis as { location?: { search?: string } }).location?.search;
  return typeof search === 'string' ? new URLSearchParams(search) : undefined;
};

/**
 * The picture quality for this device: the address's `quality`, then a stored choice, then `low` for software
 * rendering, a finger or a window shorter than 600 pixels, `medium` for 4 GB of memory or less, and `high` otherwise.
 */
export function pickWorld3DQuality(hints: World3DDeviceHints = {}): World3DQuality {
  const asked = params(hints.query)?.get('quality');
  if (isQuality(asked)) return asked;
  if (isQuality(hints.stored)) return hints.stored;
  const g = globalThis as {
    matchMedia?: (query: string) => { matches: boolean };
    innerWidth?: number;
    innerHeight?: number;
    navigator?: { deviceMemory?: number };
  };
  // Drawn by the processor, every effect is paid for many times over.
  if (hints.softwareRenderer === true) return 'low';
  const coarse = hints.coarsePointer ?? g.matchMedia?.('(pointer: coarse)').matches ?? false;
  const shortSide = hints.shortSide ?? Math.min(g.innerWidth ?? 1200, g.innerHeight ?? 800);
  if (coarse || shortSide < 600) return 'low';
  const memory = hints.deviceMemory ?? g.navigator?.deviceMemory;
  if (typeof memory === 'number' && memory <= 4) return 'medium';
  return 'high';
}

/**
 * Whether WebGL here is drawn by software (SwiftShader, llvmpipe and the like), as in a headless browser, a virtual
 * machine or a page whose graphics card is blocked. It asks a throwaway context for its renderer's name.
 */
export function isSoftwareRendered3D(document: Document = globalThis.document): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software/i.test(name);
  } catch {
    return false;
  }
}

/** The backend asked for by the address (`backend=webgpu`), or `fallback`. */
export function pickWorld3DBackend(
  query?: string | URLSearchParams,
  fallback: World3DBackend = 'webgl2'
): World3DBackend {
  const asked = params(query)?.get('backend');
  return asked === 'webgpu' || asked === 'webgl2' ? asked : fallback;
}

/** How dynamic resolution moves: its least and greatest scale, its step, and the frame rates and times that move it. */
export interface DynamicResolutionOptions3D {
  /** Smallest share of the quality's pixel ratio drawn at. Defaults to 0.6. */
  readonly min?: number;
  /** Largest share. Defaults to 1. */
  readonly max?: number;
  /** How much one change moves the share. Defaults to 0.15. */
  readonly step?: number;
  /** Below this smoothed frame rate the share goes down. Defaults to 45. */
  readonly lowFps?: number;
  /** Above this smoothed frame rate the share goes up. Defaults to 57. */
  readonly highFps?: number;
  /** Seconds the rate must stay low before going down. Defaults to 1.5. */
  readonly downAfter?: number;
  /** Seconds the rate must stay high before going up. Defaults to 6. */
  readonly upAfter?: number;
}
/** A drawing resolution that follows the frame rate: down quickly when frames are slow, up slowly when they are not. */
export interface DynamicResolution3D {
  /** The share of the pixel ratio to draw at now. */
  readonly scale: number;
  /** The smoothed frame rate. */
  readonly fps: number;
  /** Takes one frame's seconds and returns the share to draw at. */
  update(deltaSeconds: number): number;
  /** Back to the largest share, as after a change of scene. */
  reset(): void;
}

/** Makes a resolution scale that drops when frames are slow and rises when they are fast. */
export function createDynamicResolution3D(options: DynamicResolutionOptions3D = {}): DynamicResolution3D {
  const min = options.min ?? 0.6,
    max = options.max ?? 1,
    step = options.step ?? 0.15,
    lowFps = options.lowFps ?? 45,
    highFps = options.highFps ?? 57,
    downAfter = options.downAfter ?? 1.5,
    upAfter = options.upAfter ?? 6;
  const numbers = [min, max, step, lowFps, highFps, downAfter, upAfter];
  if (!numbers.every(n => typeof n === 'number' && Number.isFinite(n) && n > 0) || min > max || lowFps >= highFps)
    throw new World3DError('WORLD3D_INPUT_INVALID', 'dynamic resolution');
  let scale = max,
    fps = 60,
    slow = 0,
    fast = 0;
  return {
    get scale() {
      return scale;
    },
    get fps() {
      return fps;
    },
    update(deltaSeconds: number): number {
      // A frame of zero or of a hidden tab says nothing about the device.
      if (!(deltaSeconds > 0) || deltaSeconds > 0.5) return scale;
      fps += (1 / deltaSeconds - fps) * 0.05;
      slow = fps < lowFps ? slow + deltaSeconds : 0;
      fast = fps > highFps ? fast + deltaSeconds : 0;
      if (slow >= downAfter && scale > min) {
        scale = Math.max(min, scale - step);
        slow = 0;
      } else if (fast >= upAfter && scale < max) {
        scale = Math.min(max, scale + step);
        fast = 0;
      }
      return scale;
    },
    reset(): void {
      scale = max;
      fps = 60;
      slow = fast = 0;
    }
  };
}

// Only an actual page canvas uses this browser compositor presentation policy.
function mobileAppleWebKit3D(canvas: HTMLCanvasElement | OffscreenCanvas): boolean {
  if (!('ownerDocument' in canvas)) return false;
  const nav = globalThis.navigator;
  if (!nav?.userAgent?.includes('AppleWebKit/')) return false;
  if (/\b(?:iPhone|iPad|iPod)\b/.test(nav.userAgent)) return true;
  return nav.userAgent.includes('Macintosh') && (nav.maxTouchPoints ?? 0) > 1;
}

/** A 3D app to make: its backend and quality, dynamic resolution, tone mapping and failure callbacks. */
export interface World3DAppOptions {
  /** `webgl2` or `webgpu`. Defaults to what the address asks (`backend=`), else WebGL2. */
  readonly backend?: World3DBackend;
  /** A fixed quality, or `auto` (the default) for `pickWorld3DQuality`. */
  readonly quality?: World3DQuality | 'auto';
  /** A quality the player chose before; used by `auto` after the address. */
  readonly storedQuality?: string | null;
  /** The address's query; `location.search` by default. */
  readonly query?: string | URLSearchParams;
  /** Let the drawing resolution follow the frame rate. On by default; pass options or `false`. */
  readonly dynamicResolution?: boolean | DynamicResolutionOptions3D;
  /**
   * WebGL2 canvas resize policy. Auto (default) requests stable presentation on mobile
   * Apple WebKit; direct retains canvas backing resize, and stable can be chosen explicitly.
   * The adaptive scene resolution still changes in stable mode. WebGPU is unaffected.
   */
  readonly presentationResize?: 'auto' | 'direct' | 'stable';
  readonly toneMapping?: ToneMapping3D;
  readonly exposure?: number;
  readonly powerPreference?: 'default' | 'low-power' | 'high-performance';
  /** Told of failures while updating or drawing and of a stopped loop. Without it they are thrown. */
  readonly onError?: (cause: unknown) => void;
  /** Told once when the graphics device is lost. */
  readonly onDeviceLost?: (message: string) => void;
  /** Opt-in time-origin observations for the app's 3D animation-frame loop. */
  readonly onLoopTiming?: (sample: World3DLoopTiming) => void;
}
/** What a 3D app shows: its update, mixers and controls. */
export interface World3DShowOptions {
  /** Called every frame before animation and drawing. */
  readonly onUpdate?: (deltaSeconds: number, elapsedSeconds: number) => void;
  readonly onFrameTiming?: (sample: World3DViewTiming) => void;
  readonly mixers?: readonly AnimationMixer3D[];
  readonly controls?: OrbitControls3D;
}
/** A 3D app: its Engine, renderer and view, its quality and resolution, and calls that show a scene and start and stop it. */
export interface World3DApp extends Disposable {
  readonly engine: Engine;
  /** The Engine scope the app's view and renderer belong to. */
  readonly scope: Scope;
  readonly renderer: Renderer3D;
  /** The backend in use. A WebGPU request falls back to WebGL2 when the browser has no adapter. */
  readonly backend: World3DBackend;
  /** True when WebGPU was asked for and WebGL2 is drawing instead. */
  readonly fellBack: boolean;
  readonly quality: World3DQuality;
  /** The share of the quality's pixel ratio drawn at, 1 without dynamic resolution. */
  readonly resolutionScale: number;
  /** The view showing now, if any. */
  readonly view: World3DView | undefined;
  /** Applies another quality's shadows, post-processing and pixel ratio. Antialiasing and the atlas size stay. */
  setQuality(quality: World3DQuality): void;
  /** Shows a scene through a camera, replacing what was shown. The loop starts if it is not running. */
  show(scene: Scene3D, camera: Camera3D, options?: World3DShowOptions): World3DView;
  /** Starts or stops the frame loop. */
  start(): void;
  stop(): void;
}

async function hasWebGPUAdapter(powerPreference: string | undefined): Promise<boolean> {
  const gpu = (globalThis as { navigator?: { gpu?: { requestAdapter(options?: object): Promise<unknown> } } }).navigator
    ?.gpu;
  if (!gpu || typeof gpu.requestAdapter !== 'function') return false;
  try {
    const options = powerPreference && powerPreference !== 'default' ? { powerPreference } : undefined;
    return (await gpu.requestAdapter(options)) != null;
  } catch {
    return false;
  }
}

/**
 * Starts a World3D game on `canvas`: an Engine, a renderer for the chosen backend and quality, and a frame loop.
 * Call `show(scene, camera)` to draw. `dispose()` ends the loop, the view, the renderer and the Engine.
 */
export async function createWorld3DApp(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  options: World3DAppOptions = {}
): Promise<World3DApp> {
  if (typeof canvas !== 'object' || canvas === null) throw new World3DError('WORLD3D_INPUT_INVALID', 'canvas');
  if (
    typeof options !== 'object' ||
    options === null ||
    (options.onLoopTiming !== undefined && typeof options.onLoopTiming !== 'function')
  )
    throw new World3DError('WORLD3D_INPUT_INVALID', 'options');
  if (
    options.presentationResize !== undefined &&
    options.presentationResize !== 'direct' &&
    options.presentationResize !== 'stable' &&
    options.presentationResize !== 'auto'
  )
    throw new World3DError('WORLD3D_INPUT_INVALID', 'presentation resize');
  const asked = options.backend ?? pickWorld3DBackend(options.query);
  if (asked !== 'webgl2' && asked !== 'webgpu') throw new World3DError('WORLD3D_INPUT_INVALID', 'backend');
  const askedQuality = options.quality ?? 'auto';
  if (askedQuality !== 'auto' && !isQuality(askedQuality)) throw new World3DError('WORLD3D_INPUT_INVALID', 'quality');
  let quality: World3DQuality =
    askedQuality === 'auto'
      ? pickWorld3DQuality({
          ...(options.query === undefined ? {} : { query: options.query }),
          ...(options.storedQuality === undefined ? {} : { stored: options.storedQuality }),
          softwareRenderer: isSoftwareRendered3D('ownerDocument' in canvas ? canvas.ownerDocument : undefined)
        })
      : askedQuality;
  const preset = WORLD3D_QUALITY_PRESETS[quality];
  const resolution =
    options.dynamicResolution === false
      ? undefined
      : createDynamicResolution3D(options.dynamicResolution === true ? {} : options.dynamicResolution);

  const backend: World3DBackend =
    asked === 'webgpu' && (await hasWebGPUAdapter(options.powerPreference)) ? 'webgpu' : 'webgl2';
  const common = {
    canvas,
    antialias: preset.antialias,
    shadows: preset.shadows,
    shadowAtlasSize: preset.shadowAtlasSize,
    ...(options.toneMapping === undefined ? {} : { toneMapping: options.toneMapping }),
    ...(options.exposure === undefined ? {} : { exposure: options.exposure })
  };
  const engine = await createEngine({ host: createWorld3DHost(canvas) });
  let renderer: Renderer3D;
  try {
    if (backend === 'webgpu') {
      const { createWebGPURenderer3D } = await import('./WebGPURenderer3D.js');
      renderer = await createWebGPURenderer3D({
        ...common,
        ...(options.powerPreference && options.powerPreference !== 'default'
          ? { powerPreference: options.powerPreference }
          : {}),
        ...(options.onDeviceLost ? { onDeviceLost: options.onDeviceLost } : {})
      });
    } else {
      const { createWebGL2Renderer3D } = await import('./WebGL2Renderer3D.js');
      renderer = createWebGL2Renderer3D({
        ...common,
        presentationResize:
          options.presentationResize === undefined || options.presentationResize === 'auto'
            ? mobileAppleWebKit3D(canvas)
              ? 'stable'
              : 'direct'
            : options.presentationResize,
        ...(options.powerPreference ? { powerPreference: options.powerPreference } : {}),
        ...(options.onDeviceLost ? { onContextLost: () => options.onDeviceLost!('context lost') } : {})
      });
    }
  } catch (cause) {
    await engine.dispose();
    throw cause;
  }
  const scope = engine.createScope();
  scope.use(renderer);

  const apply = (next: World3DQualityPreset): void => {
    renderer.shadowsEnabled = next.shadows;
    const post = renderer.postProcess;
    post.enabled = next.post;
    post.bloom = next.bloom;
    post.ssao = next.ssao;
    post.fxaa = next.fxaa;
  };
  apply(preset);

  let view: World3DView | undefined,
    loop: Disposable | undefined,
    disposed = false;
  const fail = (cause: unknown): void => {
    if (!options.onError) throw cause;
    options.onError(cause);
  };
  const resize = (camera: Camera3D): void => {
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    const ratio = Math.min(dpr, WORLD3D_QUALITY_PRESETS[quality].pixelRatio) * (resolution?.scale ?? 1);
    renderer.resizeToDisplaySize(ratio);
    const drawn = renderer.renderSize ?? renderer.canvas;
    if (drawn.height > 0) camera.aspect = drawn.width / drawn.height;
  };

  const app: World3DApp = {
    engine,
    scope,
    renderer,
    backend,
    fellBack: asked === 'webgpu' && backend === 'webgl2',
    get quality() {
      return quality;
    },
    get resolutionScale() {
      return resolution?.scale ?? 1;
    },
    get view() {
      return view;
    },
    setQuality(next: World3DQuality): void {
      if (!isQuality(next)) throw new World3DError('WORLD3D_INPUT_INVALID', 'quality');
      quality = next;
      apply(WORLD3D_QUALITY_PRESETS[next]);
      resolution?.reset();
    },
    show(scene: Scene3D, camera: Camera3D, show: World3DShowOptions = {}): World3DView {
      if (disposed) throw new World3DError('WORLD3D_DISPOSED', 'app');
      view?.dispose();
      resolution?.reset();
      const created = new World3DView(engine, scope, {
        renderer,
        scene,
        camera,
        autoResize: false,
        ...(show.mixers ? { mixers: show.mixers } : {}),
        ...(show.controls ? { controls: show.controls } : {}),
        ...(show.onFrameTiming === undefined ? {} : { onFrameTiming: show.onFrameTiming }),
        ...(options.onError ? { onError: options.onError } : {}),
        onUpdate(deltaSeconds, elapsedSeconds) {
          resolution?.update(deltaSeconds);
          resize(created.camera);
          show.onUpdate?.(deltaSeconds, elapsedSeconds);
        }
      });
      view = created;
      app.start();
      return created;
    },
    start(): void {
      if (disposed) throw new World3DError('WORLD3D_DISPOSED', 'app');
      loop ??= startWorld3DLoop(
        engine,
        cause => {
          loop = undefined;
          fail(cause);
        },
        options.onLoopTiming === undefined ? {} : { onFrameTiming: options.onLoopTiming }
      );
    },
    stop(): void {
      loop?.dispose();
      loop = undefined;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      app.stop();
      view?.dispose();
      view = undefined;
      // Closing the Engine closes its scopes, which dispose the renderer.
      void engine.dispose();
    }
  };
  return app;
}
