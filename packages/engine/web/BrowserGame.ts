// SPDX-License-Identifier: Apache-2.0
// A game in a page from one call: a Host chosen for the browser, an Engine, a scope, pointer and keyboard input and
// a frame loop, each made the way its own entry makes it, and all of them ended by one dispose.
import { EgretError } from '@egret/runtime';
import { createAssetRef, createAssetType, createEngineForProfile, isTexture, SHARED_FRAME_PROFILE_2D } from '@egret/engine';
import type { AssetLease, Engine, Scope, Stage, SharedFrameOptions2D, SharedRenderFrame2D, Texture } from '@egret/engine';
import { createBrowserTextureProvider } from './image.js';
import { createBrowserFrameLoop } from './loop.js';
import type { BrowserFrameLoop } from './loop.js';
import { createBrowserPointerInput } from './pointer.js';
import type { PointerInput } from './pointer.js';
import { createBrowserKeyboardInput } from './keyboard.js';
import type { KeyboardInput } from './keyboard.js';
import { createBrowserStatsPanel } from './BrowserStatsPanel.js';
import type { BrowserStatsPanel } from './BrowserStatsPanel.js';

export type BrowserGameBackend = 'webgpu' | 'webgl2';
export interface BrowserGameOptions {
  /** The canvas the game is drawn on. The page gives it its size on the screen. */
  readonly canvas: HTMLCanvasElement;
  /** The size of the stage, in the game's own units, whatever the size of the canvas on the page. */
  readonly width: number;
  readonly height: number;
  /** "auto", unless given: WebGPU where the browser gives an adapter, WebGL2 otherwise. */
  readonly backend?: 'auto' | BrowserGameBackend;
  /** Canvas pixels for each unit of the canvas's own width. The device's ratio unless given, and then never more than 2. */
  readonly pixelRatio?: number;
  /** What a frame is cleared to before the stage is drawn: 0x000000 and 1 unless given. */
  readonly clearColor?: number;
  readonly clearAlpha?: number;
  /** One step of the game, called before each frame with the seconds since the step before. */
  readonly update?: (deltaSeconds: number) => void;
  /** Told once of what stopped the game's loop. Without it the failure is thrown where the console shows it. */
  readonly onError?: (error: unknown) => void;
  /** Touch, mouse and pen on display objects, and the keyboard. Both are made unless false is given. */
  readonly pointer?: boolean;
  readonly keyboard?: boolean;
  /** A panel over the canvas with frames a second, what a frame holds and how busy the Host is. Not made unless true is given. */
  readonly stats?: boolean;
  /** The loop starts at once unless false is given; then `game.loop.start()` starts it. */
  readonly autoStart?: boolean;
}
export interface BrowserGame {
  readonly backend: BrowserGameBackend;
  readonly engine: Engine;
  /** The Host that draws: its status says what it holds and what last went wrong. It ends with the game. */
  readonly host: { getStatus(): { readonly pendingFrames: number }; whenIdle(): Promise<void> };
  /** The stage of the Engine: what is added to it is drawn. */
  readonly stage: Stage;
  /** A scope for what the game creates. It is disposed with the game. */
  readonly scope: Scope;
  /** The frame the loop draws: the stage's size and what it is cleared to. */
  readonly frame: SharedFrameOptions2D;
  readonly loop: BrowserFrameLoop;
  readonly pointer: PointerInput | undefined;
  readonly keyboard: KeyboardInput | undefined;
  readonly stats: BrowserStatsPanel | undefined;
  /**
   * Loads a PNG image from an address and gives the lease of its texture, for `new Bitmap(lease)` or
   * `graphics.beginBitmapFill(lease)`. The lease belongs to the game's scope. The same address loaded twice is one texture.
   */
  loadTexture(url: string): Promise<AssetLease<Texture>>;
  /** A place in the page, as a pointer event gives it in `clientX` and `clientY`, as a place on the stage. */
  toStage(clientX: number, clientY: number): { x: number; y: number };
  /** Stops the loop and ends the input, the scope, the Engine and its Host. */
  dispose(): Promise<void>;
}

const invalid = (): EgretError => new EgretError('BROWSER_GAME_OPTIONS_INVALID');
const whole = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** WebGPU where the browser has it and gives an adapter. Asking for an adapter does not touch the canvas, which can hold one kind of context only. */
async function chooseBackend(asked: 'auto' | BrowserGameBackend): Promise<BrowserGameBackend> {
  if (asked !== 'auto') return asked;
  const gpu = (globalThis.navigator as { readonly gpu?: { requestAdapter(): Promise<unknown> } } | undefined)?.gpu;
  if (gpu === undefined || gpu === null) return 'webgl2';
  try { return (await gpu.requestAdapter()) ? 'webgpu' : 'webgl2'; } catch { return 'webgl2'; }
}

/**
 * Makes a game ready to draw: `await createBrowserGame({ canvas, width, height, update })`, then add display objects
 * to `game.stage`. Everything it makes is what the separate entries make; a game that outgrows it takes them apart.
 */
export async function createBrowserGame(options: BrowserGameOptions): Promise<BrowserGame> {
  if (options === null || typeof options !== 'object') throw invalid();
  const { canvas, width, height, update, onError } = options;
  const asked = options.backend ?? 'auto', clearColor = options.clearColor ?? 0, clearAlpha = options.clearAlpha ?? 1;
  const device = Number((globalThis as { readonly devicePixelRatio?: unknown }).devicePixelRatio), pixelRatio = options.pixelRatio ?? (device > 0 ? Math.min(device, 2) : 1);
  if (canvas === null || typeof canvas !== 'object' || typeof canvas.getBoundingClientRect !== 'function' || !whole(width) || !whole(height)
    || (asked !== 'auto' && asked !== 'webgpu' && asked !== 'webgl2') || typeof pixelRatio !== 'number' || !(pixelRatio > 0) || !Number.isFinite(pixelRatio)
    || !Number.isInteger(clearColor) || clearColor < 0 || clearColor > 0xffffff || typeof clearAlpha !== 'number' || !(clearAlpha >= 0 && clearAlpha <= 1)
    || (update !== undefined && typeof update !== 'function') || (onError !== undefined && typeof onError !== 'function')
    || [options.pointer, options.keyboard, options.autoStart, options.stats].some(flag => flag !== undefined && typeof flag !== 'boolean')) throw invalid();
  const backend = await chooseBackend(asked);
  // Only the chosen backend's module is loaded.
  const host = backend === 'webgpu' ? (await import('./webgpu.js')).createSharedWebGPUHost({ canvas, pixelRatio }) : (await import('./webgl2.js')).createSharedWebGL2Host({ canvas, pixelRatio });
  let engine: Engine;
  try { engine = await createEngineForProfile({ host }, SHARED_FRAME_PROFILE_2D); }
  catch (cause) { try { await host.close(); } catch { /* The first failure is the one to tell. */ } throw cause; }
  let loop: BrowserFrameLoop | undefined, stats: BrowserStatsPanel | undefined, disposal: Promise<void> | undefined;
  try {
    const scope = engine.createScope(), frame: SharedFrameOptions2D = Object.freeze({ width, height, clearColor, clearAlpha });
    const pointer = options.pointer === false ? undefined : createBrowserPointerInput({ engine, scope, width, height });
    const keyboard = options.keyboard === false ? undefined : createBrowserKeyboardInput({ engine, scope });
    const panel = stats = options.stats === true ? createBrowserStatsPanel({ canvas, label: backend }) : undefined;
    let drawn: SharedRenderFrame2D | undefined;
    // With a panel, the loop draws through a step that keeps the frame, and each step tells the panel what the last one did.
    const made: BrowserFrameLoop = loop = panel === undefined
      ? createBrowserFrameLoop({ engine, host, frame, ...(update === undefined ? {} : { update }), ...(onError === undefined ? {} : { onError }) })
      : createBrowserFrameLoop({
        engine: { clock: engine.clock, advanceTime: (seconds: number) => engine.advanceTime(seconds), renderSharedFrame: (given: SharedFrameOptions2D) => drawn = engine.renderSharedFrame(given) },
        host, frame, ...(onError === undefined ? {} : { onError }),
        update(seconds: number): void {
          const now = made.snapshot();
          panel.sample({ ...(drawn === undefined ? {} : { frame: drawn }), pendingFrames: host.getStatus().pendingFrames, frames: now.frames, skipped: now.skipped });
          drawn = undefined;
          update?.(seconds);
        },
      });
    // Images by address: one asset type whose key is the address, read with the page's own request and decoded as PNG.
    const imageType = createAssetType<Texture>('egret.browser-game.image', isTexture);
    const images = createBrowserTextureProvider({ async readBytes(ref, context) {
      const stop = new AbortController(), abort = (): void => stop.abort();
      if (context.signal.aborted) abort(); else context.signal.addEventListener('abort', abort, { once: true });
      try {
        const response = await globalThis.fetch(ref.id, { signal: stop.signal });
        if (!response.ok) throw new EgretError('BROWSER_GAME_IMAGE_FAILED', { cause: new Error(response.status + ' ' + ref.id) });
        return new Uint8Array(await response.arrayBuffer());
      } finally { context.signal.removeEventListener('abort', abort); }
    } });
    engine.assets.register(imageType, images);
    const game: BrowserGame = Object.freeze({
      backend, engine, host, stage: engine.stage, scope, frame, loop: made, pointer, keyboard, stats: panel,
      async loadTexture(url: string) {
        if (typeof url !== 'string' || url === '') throw invalid();
        return scope.use(await engine.assets.acquire(createAssetRef(imageType, url), { signal: scope.signal }));
      },
      toStage(clientX: number, clientY: number) {
        const box = canvas.getBoundingClientRect();
        return { x: (clientX - box.left) * width / box.width, y: (clientY - box.top) * height / box.height };
      },
      dispose() {
        // The scope ends the input it was given; the Engine ends its scopes and its Host.
        return disposal ??= (async () => { made.dispose(); panel?.dispose(); await engine.dispose(); await images.close(); })();
      },
    });
    if (options.autoStart !== false) made.start();
    return game;
  } catch (cause) {
    loop?.dispose(); stats?.dispose();
    try { await engine.dispose(); } catch { /* The first failure is the one to tell. */ }
    throw cause;
  }
}
