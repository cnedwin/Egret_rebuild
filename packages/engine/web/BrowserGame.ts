// SPDX-License-Identifier: Apache-2.0
// A game in a page from one call: a Host chosen for the browser, an Engine, a scope, pointer and keyboard input and
// a frame loop, each made the way its own entry makes it, and all of them ended by one dispose.
import { EgretError } from '@egret/runtime';
import {
  createAssetRef,
  createAssetType,
  createEngineForProfile,
  isTexture,
  SHARED_FRAME_PROFILE_2D
} from '@egret/engine';
import type {
  AssetLease,
  DiagnosticHandler,
  Engine,
  Scope,
  Stage,
  SharedFrameOptions2D,
  SharedRenderFrame2D,
  Texture
} from '@egret/engine';
import { createBrowserTextureProvider } from './image.js';
import { createTextField, createTextRasterCache } from '@egret/engine/text';
import type { TextField, TextRasterCache } from '@egret/engine/text';
import { createBrowserFrameLoop } from './loop.js';
import type { BrowserFrameLoop } from './loop.js';
import { createBrowserPointerInput } from './pointer.js';
import type { PointerInput } from './pointer.js';
import { createBrowserKeyboardInput } from './keyboard.js';
import type { KeyboardInput } from './keyboard.js';
import { createBrowserStatsPanel } from './BrowserStatsPanel.js';
import type { BrowserStatsPanel } from './BrowserStatsPanel.js';

/** Which GPU interface a browser game draws with. */
export type BrowserGameBackend = 'webgpu' | 'webgl2';
/** How the canvas fills the element it is in: not at all, whole inside it, covering it, or stretched to it. */
export type BrowserGameFit = 'none' | 'contain' | 'cover' | 'stretch';
/** A text label to make: its text, font, size and weight, line height, color, locale and direction. */
export interface BrowserGameLabelOptions {
  readonly text?: string;
  /** A font the page has: a family of the system, or one the page loaded. "sans-serif" unless given. */
  readonly fontFamily?: string;
  /** In stage units: 24 unless given. */
  readonly fontSize?: number;
  readonly fontWeight?: number;
  readonly italic?: boolean;
  /** In stage units: a quarter more than the font size unless given. */
  readonly lineHeight?: number;
  /** 0xffffff unless given. */
  readonly color?: number;
  /** The language of the text, such as "zh" or "en": "en" unless given. */
  readonly locale?: string;
  readonly direction?: 'ltr' | 'rtl';
}
/** A line of text on the stage whose words can be set like a value. */
export interface BrowserGameLabel {
  /** The text on the stage: place it with `display.x` and `display.y`, add it where it belongs. */
  readonly display: TextField;
  /** Setting it draws the new words when they are ready; until then the old ones stay. */
  text: string;
  /** Settles when the words last set are on the stage, and rejects if they could not be drawn. */
  readonly ready: Promise<void>;
  /** Changes any of the options; what is left out stays. */
  set(options: BrowserGameLabelOptions): void;
  dispose(): void;
}
/** A browser game to make: its canvas and size, its backend and colors, its update, its input and stats, and how it fits the page. */
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
  /**
   * Where translucent draws mix with what is under them: "linear" light unless given, or the stored "srgb"
   * codes, as a 2D canvas and Egret 5 mix them, so a faint white over a dark ground stays faint.
   */
  readonly blendSpace?: 'linear' | 'srgb';
  /**
   * Whether render effects are drawn: blurs, colour matrices, glows, outlines, and masks of images or of shapes.
   * Off unless given; a frame with an effect is refused without it.
   */
  readonly effects?: boolean;
  /** One step of the game, called before each frame with the seconds since the step before. */
  readonly update?: (deltaSeconds: number) => void;
  /** Told once of what stopped the game's loop. Without it the failure is thrown where the console shows it. */
  readonly onError?: (error: unknown) => void;
  /** Touch, mouse and pen on display objects, and the keyboard. Both are made unless false is given. */
  readonly pointer?: boolean;
  readonly keyboard?: boolean;
  /** A panel over the canvas with frames a second, what a frame holds and how busy the Host is. Not made unless true is given. */
  readonly stats?: boolean;
  /** "none" unless given. The canvas is sized inside `fitTo`, or its parent element, and again whenever that changes size. */
  readonly fit?: BrowserGameFit;
  readonly fitTo?: HTMLElement;
  /** The loop starts at once unless false is given; then `game.loop.start()` starts it. */
  readonly autoStart?: boolean;
}
/** A game in a canvas: its Engine, host and stage, its frame loop and input, and calls that load textures and make labels. */
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
  /** A line of text for the stage. The first call loads the page's text rasterizer. */
  createLabel(options?: BrowserGameLabelOptions): Promise<BrowserGameLabel>;
  /** A place in the page, as a pointer event gives it in `clientX` and `clientY`, as a place on the stage. */
  toStage(clientX: number, clientY: number): { x: number; y: number };
  /** Stops the loop and ends the input, the scope, the Engine and its Host. */
  dispose(): Promise<void>;
}

const invalid = (): EgretError => new EgretError('BROWSER_GAME_OPTIONS_INVALID');
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** WebGPU where the browser has it and gives an adapter. Asking for an adapter does not touch the canvas, which can hold one kind of context only. */
async function chooseBackend(asked: 'auto' | BrowserGameBackend): Promise<BrowserGameBackend> {
  if (asked !== 'auto') return asked;
  const gpu = (globalThis.navigator as { readonly gpu?: { requestAdapter(): Promise<unknown> } } | undefined)?.gpu;
  if (gpu === undefined || gpu === null) return 'webgl2';
  try {
    return (await gpu.requestAdapter()) ? 'webgpu' : 'webgl2';
  } catch {
    return 'webgl2';
  }
}

/**
 * What a game does with the diagnostics of its Engine. An error the Engine can only report, such as a listener of
 * pointer input that threw, which ends that input, is told as a failure of the loop is: to `onError`, or to the page,
 * where the console shows it. Without this it was told to no one, and the game went on without its input.
 */
export function gameDiagnostics(onError: ((error: unknown) => void) | undefined): DiagnosticHandler {
  return diagnostic => {
    if (diagnostic.severity !== 'error') return;
    const error = diagnostic.cause ?? new EgretError(diagnostic.code);
    if (onError !== undefined) {
      onError(error);
      return;
    }
    const tell = (globalThis as { reportError?: (error: unknown) => void }).reportError;
    if (typeof tell === 'function') tell(error);
    // A page without reportError still shows a promise that nothing handled.
    else void Promise.reject(error);
  };
}

/**
 * Makes a game ready to draw: `await createBrowserGame({ canvas, width, height, update })`, then add display objects
 * to `game.stage`. Everything it makes is what the separate entries make; a game that outgrows it takes them apart.
 */
export async function createBrowserGame(options: BrowserGameOptions): Promise<BrowserGame> {
  if (options === null || typeof options !== 'object') throw invalid();
  const { canvas, width, height, update, onError } = options;
  const asked = options.backend ?? 'auto',
    clearColor = options.clearColor ?? 0,
    clearAlpha = options.clearAlpha ?? 1,
    blendSpace = options.blendSpace ?? 'linear',
    enableEffects = options.effects ?? false;
  const device = Number((globalThis as { readonly devicePixelRatio?: unknown }).devicePixelRatio),
    pixelRatio = options.pixelRatio ?? (device > 0 ? Math.min(device, 2) : 1);
  if (
    canvas === null ||
    typeof canvas !== 'object' ||
    typeof canvas.getBoundingClientRect !== 'function' ||
    !whole(width) ||
    !whole(height) ||
    (asked !== 'auto' && asked !== 'webgpu' && asked !== 'webgl2') ||
    typeof pixelRatio !== 'number' ||
    !(pixelRatio > 0) ||
    !Number.isFinite(pixelRatio) ||
    !Number.isInteger(clearColor) ||
    clearColor < 0 ||
    clearColor > 0xffffff ||
    typeof clearAlpha !== 'number' ||
    !(clearAlpha >= 0 && clearAlpha <= 1) ||
    (blendSpace !== 'linear' && blendSpace !== 'srgb') ||
    typeof enableEffects !== 'boolean' ||
    (update !== undefined && typeof update !== 'function') ||
    (onError !== undefined && typeof onError !== 'function') ||
    [options.pointer, options.keyboard, options.autoStart, options.stats].some(
      flag => flag !== undefined && typeof flag !== 'boolean'
    ) ||
    !['none', 'contain', 'cover', 'stretch'].includes(options.fit ?? 'none') ||
    (options.fitTo !== undefined && (options.fitTo === null || typeof options.fitTo !== 'object'))
  )
    throw invalid();
  const backend = await chooseBackend(asked);
  // Only the chosen backend's module is loaded.
  const host =
    backend === 'webgpu'
      ? (await import('./webgpu.js')).createSharedWebGPUHost({ canvas, pixelRatio, blendSpace, enableEffects })
      : (await import('./webgl2.js')).createSharedWebGL2Host({ canvas, pixelRatio, blendSpace, enableEffects });
  let engine: Engine;
  try {
    engine = await createEngineForProfile({ host, onDiagnostic: gameDiagnostics(onError) }, SHARED_FRAME_PROFILE_2D);
  } catch (cause) {
    try {
      await host.close();
    } catch {
      /* The first failure is the one to tell. */
    }
    throw cause;
  }
  let loop: BrowserFrameLoop | undefined, stats: BrowserStatsPanel | undefined, disposal: Promise<void> | undefined;
  try {
    const scope = engine.createScope(),
      frame: SharedFrameOptions2D = Object.freeze({ width, height, clearColor, clearAlpha });
    const pointer = options.pointer === false ? undefined : createBrowserPointerInput({ engine, scope, width, height });
    const keyboard = options.keyboard === false ? undefined : createBrowserKeyboardInput({ engine, scope });
    const panel = (stats = options.stats === true ? createBrowserStatsPanel({ canvas, label: backend }) : undefined);
    let drawn: SharedRenderFrame2D | undefined;
    // With a panel, the loop draws through a step that keeps the frame, and each step tells the panel what the last one did.
    const made: BrowserFrameLoop = (loop =
      panel === undefined
        ? createBrowserFrameLoop({
            engine,
            host,
            frame,
            ...(update === undefined ? {} : { update }),
            ...(onError === undefined ? {} : { onError })
          })
        : createBrowserFrameLoop({
            engine: {
              clock: engine.clock,
              advanceTime: (seconds: number) => engine.advanceTime(seconds),
              renderSharedFrame: (given: SharedFrameOptions2D) => (drawn = engine.renderSharedFrame(given))
            },
            host,
            frame,
            ...(onError === undefined ? {} : { onError }),
            update(seconds: number): void {
              const now = made.snapshot();
              panel.sample({
                ...(drawn === undefined ? {} : { frame: drawn }),
                pendingFrames: host.getStatus().pendingFrames,
                drawCalls: host.getSharedStatus().lastFrameDrawCalls,
                frames: now.frames,
                skipped: now.skipped
              });
              drawn = undefined;
              update?.(seconds);
            }
          }));
    // Images by address: one asset type whose key is the address, read with the page's own request and decoded as PNG.
    const imageType = createAssetType<Texture>('egret.browser-game.image', isTexture);
    const images = createBrowserTextureProvider({
      async readBytes(ref, context) {
        const stop = new AbortController(),
          abort = (): void => stop.abort();
        if (context.signal.aborted) abort();
        else context.signal.addEventListener('abort', abort, { once: true });
        try {
          const response = await globalThis.fetch(ref.id, { signal: stop.signal });
          if (!response.ok)
            throw new EgretError('BROWSER_GAME_IMAGE_FAILED', { cause: new Error(response.status + ' ' + ref.id) });
          return new Uint8Array(await response.arrayBuffer());
        } finally {
          context.signal.removeEventListener('abort', abort);
        }
      }
    });
    engine.assets.register(imageType, images);
    // The canvas in its element: sized now and whenever the element changes size. The stage keeps its own units.
    const fit = options.fit ?? 'none',
      holder = options.fitTo ?? canvas.parentElement;
    let watcher: ResizeObserver | undefined;
    if (fit !== 'none' && holder !== null) {
      const place = (): void => {
        const box = holder.getBoundingClientRect(),
          wide = box.width / width,
          tall = box.height / height;
        const scaleX = fit === 'stretch' ? wide : fit === 'contain' ? Math.min(wide, tall) : Math.max(wide, tall),
          scaleY = fit === 'stretch' ? tall : scaleX;
        const style = canvas.style;
        style.width = width * scaleX + 'px';
        style.height = height * scaleY + 'px';
        // Centred in its element; with "cover" what does not fit is outside it, for the element to cut off.
        style.marginLeft = (box.width - width * scaleX) / 2 + 'px';
        style.marginTop = (box.height - height * scaleY) / 2 + 'px';
      };
      place();
      watcher = new ResizeObserver(place);
      watcher.observe(holder);
    }
    // Text: one cache for the Engine, made with the page's rasterizer when the first label is asked for.
    let textCache: Promise<TextRasterCache> | undefined;
    // The text cache takes four drawings at a time and refuses more. Labels wait their turn here instead, two at a
    // time, so a game may make or change any number of them together.
    const LABEL_LANES = 2;
    let labelsDrawing = 0;
    const labelsWaiting: (() => void)[] = [];
    const enterLabelLane = (): Promise<void> | void => {
      if (labelsDrawing < LABEL_LANES) {
        labelsDrawing++;
        return;
      }
      // The lane is handed over by the label that leaves it, so no newcomer takes it first.
      return new Promise<void>(resolve => labelsWaiting.push(resolve));
    };
    const leaveLabelLane = (): void => {
      const next = labelsWaiting.shift();
      if (next) next();
      else labelsDrawing--;
    };
    async function createLabel(given: BrowserGameLabelOptions = {}): Promise<BrowserGameLabel> {
      if (given === null || typeof given !== 'object') throw invalid();
      textCache ??= import('./text.js').then(text =>
        createTextRasterCache(engine.assets, { provider: text.createCanvasTextRasterProvider() })
      );
      const field = createTextField(engine, scope, await textCache);
      let now: Required<BrowserGameLabelOptions> = {
        text: '',
        fontFamily: 'sans-serif',
        fontSize: 24,
        fontWeight: 400,
        italic: false,
        lineHeight: 0,
        color: 0xffffff,
        locale: 'en',
        direction: 'ltr'
      };
      let ready: Promise<void> = Promise.resolve(),
        asked = 0,
        drawing = false,
        running: Promise<void> | undefined;
      const request = (): void =>
        field.setRequest({
          text: now.text,
          fontFamily: now.fontFamily,
          fontSize: now.fontSize,
          fontWeight: now.fontWeight,
          fontStyle: now.italic ? 'italic' : 'normal',
          lineHeight: now.lineHeight > 0 ? now.lineHeight : now.fontSize * 1.25,
          locale: now.locale,
          direction: now.direction,
          density: pixelRatio,
          fillColor: now.color
        });
      // Draws the label's newest words. Words changed while it draws are asked for when that drawing is done, never
      // over it, so a label holds one drawing of the text cache at a time however often its words change.
      const draw = async (): Promise<void> => {
        try {
          await enterLabelLane();
          try {
            for (let shown = -1; shown !== asked; ) {
              if (shown !== -1) request();
              shown = asked;
              drawing = true;
              try {
                // The cache frees a drawing's place a few turns after the drawing is handed over. A refusal for
                // want of a place is waited out, without a timer; one that lasts is the label's failure.
                for (let attempt = 0; ; attempt++) {
                  try {
                    await field.prepare();
                    break;
                  } catch (cause) {
                    if (!(cause instanceof EgretError) || cause.code !== 'TEXT_CACHE_BUDGET' || attempt >= 400)
                      throw cause;
                    await Promise.resolve();
                  }
                }
              } finally {
                drawing = false;
              }
            }
          } finally {
            leaveLabelLane();
          }
        } finally {
          running = undefined;
        }
      };
      const apply = (next: BrowserGameLabelOptions): void => {
        if (next === null || typeof next !== 'object') throw invalid();
        now = { ...now, ...next };
        // Refused at once when nothing is being drawn; otherwise when its turn comes, through `ready`.
        if (!drawing) request();
        asked++;
        running ??= draw();
        // A failure is the label's to tell through `ready`; it is not left unheard.
        running.catch(() => {});
        ready = running;
      };
      apply(given);
      return Object.freeze({
        display: field,
        get text() {
          return now.text;
        },
        set text(value: string) {
          if (value !== now.text) apply({ text: value });
        },
        get ready() {
          return ready;
        },
        set: apply,
        dispose() {
          field.dispose();
        }
      });
    }
    const game: BrowserGame = Object.freeze({
      backend,
      engine,
      host,
      stage: engine.stage,
      scope,
      frame,
      loop: made,
      pointer,
      keyboard,
      stats: panel,
      createLabel,
      async loadTexture(url: string) {
        if (typeof url !== 'string' || url === '') throw invalid();
        return scope.use(await engine.assets.acquire(createAssetRef(imageType, url), { signal: scope.signal }));
      },
      toStage(clientX: number, clientY: number) {
        const box = canvas.getBoundingClientRect();
        return { x: ((clientX - box.left) * width) / box.width, y: ((clientY - box.top) * height) / box.height };
      },
      dispose() {
        // The scope ends the input it was given; the Engine ends its scopes and its Host.
        return (disposal ??= (async () => {
          made.dispose();
          panel?.dispose();
          watcher?.disconnect();
          // The scope ends the labels; then the cache they were drawn from can end, before the Engine does.
          scope.dispose();
          if (textCache !== undefined) {
            const cache = await textCache.catch(() => undefined);
            cache?.dispose();
            await cache?.whenIdle();
          }
          await engine.dispose();
          await images.close();
        })());
      }
    });
    if (options.autoStart !== false) made.start();
    return game;
  } catch (cause) {
    loop?.dispose();
    stats?.dispose();
    try {
      await engine.dispose();
    } catch {
      /* The first failure is the one to tell. */
    }
    throw cause;
  }
}
