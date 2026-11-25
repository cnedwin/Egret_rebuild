// SPDX-License-Identifier: Apache-2.0
// A game in a page from one call: a Host chosen for the browser, an Engine, a scope, pointer and keyboard input and
// a frame loop, each made the way its own entry makes it, and all of them ended by one dispose.
import { EgretError } from '@egret/runtime';
import {
  createAssetRef,
  createAssetType,
  createEngineForProfile,
  createImageData2D,
  createTexture,
  isTexture,
  SHARED_FRAME_PROFILE_2D
} from '@egret/engine';
import type {
  AssetLease,
  DisplayObject,
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
import type { createBrowserHoverInput } from './hover.js';

/** The hover and wheel input of the page, as `createBrowserHoverInput` of `@egret/engine/web/hover` makes it. */
type BrowserGameHoverInput = ReturnType<typeof createBrowserHoverInput>;
import { createBrowserStatsPanel } from './BrowserStatsPanel.js';
import type { BrowserStatsPanel } from './BrowserStatsPanel.js';
import { planScreen } from './screen.js';
import type { ScreenInsets, ScreenPlan, ScreenSize } from './screen.js';

/** Which GPU interface a browser game draws with. */
export type BrowserGameBackend = 'webgpu' | 'webgl2';
/**
 * How the canvas fills the element it is in: not at all, whole inside it, covering it, stretched to it, or filling it
 * with a stage that grows around the design (`'expand'`).
 */
export type BrowserGameFit = 'none' | 'contain' | 'cover' | 'stretch' | 'expand';
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
/** A label to make: its words and style, and the scope that owns it. */
export interface BrowserGameLabelCreateOptions extends BrowserGameLabelOptions {
  /**
   * The scope that owns the label's display object. Defaults to `game.scope`. Give the `context.scope` of a UI leaf to
   * use the label as that leaf's content; the label then ends with that scope.
   */
  readonly scope?: Scope;
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
  /**
   * Hover and the mouse wheel over display objects, as `createBrowserHoverInput` makes them: what a scroll control's
   * `wheel` and a button's hover look need. Made only when true is given; its module is loaded only then.
   */
  readonly hover?: boolean;
  /** A panel over the canvas with frames a second, what a frame holds and how busy the Host is. Not made unless true is given. */
  readonly stats?: boolean;
  /**
   * "none" unless given. The canvas is sized inside `fitTo`, or its parent element, and again whenever that changes
   * size. With "expand" the stage keeps the scale at which `width` × `height` fits whole and grows to fill the element,
   * so `game.screen` gives a stage at least that size, and the design in its middle.
   */
  readonly fit?: BrowserGameFit;
  readonly fitTo?: HTMLElement;
  /**
   * The stage's size while the element is taller than it is wide, with "contain" or "expand". `width` × `height`
   * otherwise. The stage changes size when the element changes shape; `game.onScreenChange` tells of it.
   */
  readonly portrait?: ScreenSize;
  /**
   * What covers the edges of the element, in CSS pixels, for `game.screen.safe`. The page's own `safe-area-inset`
   * values unless given, which the page has when its viewport meta tag says `viewport-fit=cover`.
   */
  readonly insets?: ScreenInsets;
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
  /**
   * Where the stage is on the screen now: its size in stage units, the scale, the design's place on it and the part
   * no notch or home bar covers. With "contain" or "expand" it follows the element; otherwise the stage is
   * `width` × `height` and all of it is safe.
   */
  readonly screen: ScreenPlan;
  /** Calls `listener` with the new plan after the stage changes size or its safe part moves. Returns its removal. */
  onScreenChange(listener: (screen: ScreenPlan) => void): () => void;
  readonly loop: BrowserFrameLoop;
  readonly pointer: PointerInput | undefined;
  readonly keyboard: KeyboardInput | undefined;
  /** The hover and wheel input, when `hover: true` was given. */
  readonly hover: BrowserGameHoverInput | undefined;
  readonly stats: BrowserStatsPanel | undefined;
  /**
   * Loads a PNG image from an address and gives the lease of its texture, for `new Bitmap(lease)` or
   * `graphics.beginBitmapFill(lease)`. The lease belongs to the game's scope. The same address loaded twice is one texture.
   */
  loadTexture(url: string): Promise<AssetLease<Texture>>;
  /**
   * The lease of a texture of pixels painted in code: `width` × `height` pixels of 4 bytes each, red, green, blue and
   * alpha, rows from the top, alpha not multiplied in (as `ImageData` holds them). The bytes are copied, so the array can
   * be changed after. At most 4,096 pixels on an edge and 4,194,304 in all. The lease belongs to the game's scope; each
   * call is a texture of its own, ended with its lease.
   */
  textureFromPixels(
    width: number,
    height: number,
    pixels: Uint8Array | Uint8ClampedArray
  ): Promise<AssetLease<Texture>>;
  /**
   * The lease of a texture of what a canvas holds now, as `textureFromPixels` of its pixels. A canvas with a 2D context,
   * or none yet, is read with that context; one drawn by WebGL or WebGPU is copied through a 2D canvas first. To scale
   * down a larger picture, or read an image or bitmap, `textureFromCanvas` of `@egret/engine/web/kit` gives a texture.
   */
  textureFromCanvas(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<AssetLease<Texture>>;
  /** A line of text for the stage. The first call loads the page's text rasterizer. */
  createLabel(options?: BrowserGameLabelCreateOptions): Promise<BrowserGameLabel>;
  /**
   * Stage units in one CSS pixel as the canvas is shown now, the larger of across and down: `44 * game.unitsPerCssPixel`
   * is a touch target a finger can hit. 1 before the canvas is laid out.
   */
  readonly unitsPerCssPixel: number;
  /**
   * Gives a display object a hit area at least `cssPixels` (44 unless given) square as the canvas is shown now, centred
   * on what it draws and never smaller than it, so a small icon is as easy to press as a finger needs. Call it again
   * after the node, its ancestors or the canvas change transform or size. Returns the area, in the node's own units.
   */
  padHitArea(
    node: DisplayObject,
    cssPixels?: number
  ): { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** A place in the page, as a pointer event gives it in `clientX` and `clientY`, as a place on the stage. */
  toStage(clientX: number, clientY: number): { x: number; y: number };
  /** Stops the loop and ends the input, the scope, the Engine and its Host. */
  dispose(): Promise<void>;
}

const invalid = (): EgretError => new EgretError('BROWSER_GAME_OPTIONS_INVALID');
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

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
    [options.pointer, options.keyboard, options.hover, options.autoStart, options.stats].some(
      flag => flag !== undefined && typeof flag !== 'boolean'
    ) ||
    !['none', 'contain', 'cover', 'stretch', 'expand'].includes(options.fit ?? 'none') ||
    (options.fitTo !== undefined && (options.fitTo === null || typeof options.fitTo !== 'object'))
  )
    throw invalid();
  // The plan of the stage: refused here, before anything is made, when the portrait size or the insets are not valid.
  const planFor = (box: ScreenSize, insets?: ScreenInsets): ScreenPlan =>
    planScreen({
      box,
      design: { width, height },
      ...(options.portrait === undefined ? {} : { portrait: options.portrait }),
      fit: options.fit === 'expand' ? 'expand' : 'contain',
      ...(insets === undefined ? {} : { insets })
    });
  try {
    planFor({ width, height }, options.insets);
  } catch {
    throw invalid();
  }
  let screen = planFor({ width, height });
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
      initialFrame: SharedFrameOptions2D = Object.freeze({ width, height, clearColor, clearAlpha });
    let frame = initialFrame;
    const frameNow = (): SharedFrameOptions2D => frame;
    const stageSize = (): { readonly width: number; readonly height: number } => frame;
    const pointer =
      options.pointer === false
        ? undefined
        : createBrowserPointerInput({ engine, scope, width, height, size: stageSize });
    const keyboard = options.keyboard === false ? undefined : createBrowserKeyboardInput({ engine, scope });
    const hover =
      options.hover === true
        ? scope.use(
            (await import('./hover.js')).createBrowserHoverInput({
              engine,
              scope,
              canvas,
              width,
              height,
              size: stageSize,
              ...(onError === undefined ? {} : { onError })
            })
          )
        : undefined;
    const panel = (stats = options.stats === true ? createBrowserStatsPanel({ canvas, label: backend }) : undefined);
    let drawn: SharedRenderFrame2D | undefined;
    // With a panel, the loop draws through a step that keeps the frame, and each step tells the panel what the last one did.
    const made: BrowserFrameLoop = (loop =
      panel === undefined
        ? createBrowserFrameLoop({
            engine,
            host,
            frame: frameNow,
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
            frame: frameNow,
            ...(onError === undefined ? {} : { onError }),
            update(seconds: number): void {
              const now = made.snapshot();
              panel.sample({
                ...(drawn === undefined ? {} : { frame: drawn }),
                pendingFrames: host.getStatus().pendingFrames,
                drawCalls: host.getFrameDrawCalls(),
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
    // Textures painted in code: each call puts its texture under a key of its own, and its lease ends it.
    const paintedType = createAssetType<Texture>('egret.browser-game.painted', isTexture),
      painted = new Map<string, Texture>();
    let paintedCount = 0;
    engine.assets.register(paintedType, {
      async load(ref) {
        const texture = painted.get(ref.id);
        painted.delete(ref.id);
        if (texture === undefined) throw invalid();
        return texture;
      },
      dispose(texture) {
        texture.dispose();
      }
    });
    const leasePixels = async (
      width: number,
      height: number,
      pixels: Uint8Array | Uint8ClampedArray
    ): Promise<AssetLease<Texture>> => {
      if (
        !whole(width) ||
        !whole(height) ||
        !(pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray) ||
        pixels.length !== width * height * 4
      )
        throw invalid();
      let texture: Texture;
      try {
        texture = createTexture(
          createImageData2D({ width, height, pixels: new Uint8Array(pixels) as Uint8Array<ArrayBuffer> })
        );
      } catch (cause) {
        // Larger than the 2D image limits: 4,096 pixels on an edge, 4,194,304 in all.
        throw new EgretError('BROWSER_GAME_OPTIONS_INVALID', { cause });
      }
      const key = 'painted-' + ++paintedCount;
      painted.set(key, texture);
      try {
        return scope.use(await engine.assets.acquire(createAssetRef(paintedType, key), { signal: scope.signal }));
      } finally {
        // Not loaded (the scope ended first): the texture is ended here.
        if (painted.delete(key)) texture.dispose();
      }
    };
    // The canvas in its element: sized now and whenever the element changes size. With "contain" and "expand" the
    // stage follows the plan of the screen: its size, and, with a portrait size, its shape.
    const fit = options.fit ?? 'none',
      holder = options.fitTo ?? canvas.parentElement;
    const screenListeners = new Set<(screen: ScreenPlan) => void>();
    let watcher: ResizeObserver | undefined, probe: HTMLElement | undefined;
    // The page's safe-area insets, read from an element that is padded by them and shows nothing.
    const pageInsets = (): ScreenInsets | undefined => {
      if (options.insets !== undefined) return options.insets;
      const page = canvas.ownerDocument as Document | undefined,
        view = page?.defaultView;
      if (
        page === undefined ||
        page === null ||
        view === null ||
        view === undefined ||
        typeof view.getComputedStyle !== 'function' ||
        typeof page.createElement !== 'function' ||
        page.body === null ||
        page.body === undefined
      )
        return undefined;
      if (probe === undefined) {
        probe = page.createElement('div');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText =
          'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
          'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
        page.body.appendChild(probe);
      }
      const style = view.getComputedStyle(probe),
        read = (value: string): number => (Number.isFinite(parseFloat(value)) ? Math.max(0, parseFloat(value)) : 0);
      // Insets are of the window; the element may be anywhere in it.
      const box = (holder ?? canvas).getBoundingClientRect(),
        across = view.innerWidth,
        down = view.innerHeight;
      return {
        top: Math.max(0, read(style.paddingTop) - box.top),
        left: Math.max(0, read(style.paddingLeft) - box.left),
        right: Math.max(0, read(style.paddingRight) - (finite(across) ? across - box.right : 0)),
        bottom: Math.max(0, read(style.paddingBottom) - (finite(down) ? down - box.bottom : 0))
      };
    };
    if (fit !== 'none' && holder !== null) {
      const place = (): void => {
        const box = holder.getBoundingClientRect();
        const style = canvas.style;
        if (fit === 'cover' || fit === 'stretch') {
          const wide = box.width / width,
            tall = box.height / height;
          const scaleX = fit === 'stretch' ? wide : Math.max(wide, tall),
            scaleY = fit === 'stretch' ? tall : scaleX;
          style.width = width * scaleX + 'px';
          style.height = height * scaleY + 'px';
          // Centred in its element; with "cover" what does not fit is outside it, for the element to cut off.
          style.marginLeft = (box.width - width * scaleX) / 2 + 'px';
          style.marginTop = (box.height - height * scaleY) / 2 + 'px';
          return;
        }
        if (!(box.width > 0 && box.height > 0)) return;
        const next = planFor({ width: box.width, height: box.height }, pageInsets()),
          before = screen;
        screen = next;
        if (next.width !== frame.width || next.height !== frame.height)
          frame = Object.freeze({ width: next.width, height: next.height, clearColor, clearAlpha });
        style.width = next.width * next.scale + 'px';
        style.height = next.height * next.scale + 'px';
        style.marginLeft = next.left + 'px';
        style.marginTop = next.top + 'px';
        const moved =
          next.width !== before.width ||
          next.height !== before.height ||
          next.orientation !== before.orientation ||
          (['x', 'y', 'width', 'height'] as const).some(key => next.safe[key] !== before.safe[key]);
        if (moved) for (const listener of [...screenListeners]) listener(next);
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
    async function createLabel(options: BrowserGameLabelCreateOptions = {}): Promise<BrowserGameLabel> {
      if (options === null || typeof options !== 'object') throw invalid();
      const { scope: owner = scope, ...given } = options;
      if (owner === null || typeof owner !== 'object') throw invalid();
      textCache ??= import('./text.js').then(text =>
        createTextRasterCache(engine.assets, { provider: text.createCanvasTextRasterProvider() })
      );
      const field = createTextField(engine, owner, await textCache);
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
      get frame() {
        return frame;
      },
      get screen() {
        return screen;
      },
      onScreenChange(listener: (screen: ScreenPlan) => void) {
        if (typeof listener !== 'function') throw invalid();
        screenListeners.add(listener);
        return () => {
          screenListeners.delete(listener);
        };
      },
      loop: made,
      pointer,
      keyboard,
      hover,
      stats: panel,
      createLabel,
      async loadTexture(url: string) {
        if (typeof url !== 'string' || url === '') throw invalid();
        return scope.use(await engine.assets.acquire(createAssetRef(imageType, url), { signal: scope.signal }));
      },
      textureFromPixels: leasePixels,
      async textureFromCanvas(source: HTMLCanvasElement | OffscreenCanvas) {
        if (source === null || typeof source !== 'object' || typeof source.getContext !== 'function') throw invalid();
        const { width, height } = source;
        if (!whole(width) || !whole(height)) throw invalid();
        let context = source.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
        if (context === null) {
          // A canvas of another kind of context: drawn onto a 2D canvas of its size, and read there.
          const copy =
            typeof OffscreenCanvas === 'function'
              ? new OffscreenCanvas(width, height)
              : Object.assign(document.createElement('canvas'), { width, height });
          context = copy.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
          if (context === null) throw invalid();
          context.drawImage(source, 0, 0);
        }
        return leasePixels(width, height, context.getImageData(0, 0, width, height).data);
      },
      padHitArea(node: DisplayObject, cssPixels = 44) {
        if (
          node === null ||
          typeof node !== 'object' ||
          typeof node.getBounds !== 'function' ||
          !(typeof cssPixels === 'number' && cssPixels >= 0 && Number.isFinite(cssPixels))
        )
          throw invalid();
        const drawn = node.getBounds(),
          box = canvas.getBoundingClientRect();
        const laidOut = box.width > 0 && box.height > 0;
        const halfX = (cssPixels / 2) * (laidOut ? frame.width / box.width : 1);
        const halfY = (cssPixels / 2) * (laidOut ? frame.height / box.height : 1);
        let wide = drawn.width,
          tall = drawn.height;
        if (cssPixels > 0) {
          const cx = drawn.x + drawn.width / 2,
            cy = drawn.y + drawn.height / 2;
          const center = node.localToGlobal(cx, cy);
          try {
            // Opposite corners are symmetric. Two adjacent corners give the local extents of the entire CSS square.
            const top = node.globalToLocal(center.x + halfX, center.y - halfY);
            const bottom = node.globalToLocal(center.x + halfX, center.y + halfY);
            wide = Math.max(wide, 2 * Math.abs(top.x - cx), 2 * Math.abs(bottom.x - cx));
            tall = Math.max(tall, 2 * Math.abs(top.y - cy), 2 * Math.abs(bottom.y - cy));
          } catch (cause) {
            if (!(cause instanceof EgretError) || cause.code !== 'COORDINATE_TRANSFORM_SINGULAR') throw cause;
            // A collapsed node cannot receive a two-dimensional hit. Keep a finite area until it is laid out again.
            const perCss = laidOut ? Math.max(frame.width / box.width, frame.height / box.height) : 1;
            wide = Math.max(wide, (cssPixels * perCss) / (Math.abs(node.scaleX) || 1));
            tall = Math.max(tall, (cssPixels * perCss) / (Math.abs(node.scaleY) || 1));
          }
        }
        const area = Object.freeze({
          x: drawn.x - (wide - drawn.width) / 2,
          y: drawn.y - (tall - drawn.height) / 2,
          width: wide,
          height: tall
        });
        node.hitArea = area;
        return area;
      },
      get unitsPerCssPixel() {
        const box = canvas.getBoundingClientRect();
        // Before the page lays the canvas out, one unit is one pixel.
        return box.width > 0 && box.height > 0 ? Math.max(frame.width / box.width, frame.height / box.height) : 1;
      },
      toStage(clientX: number, clientY: number) {
        const box = canvas.getBoundingClientRect();
        return {
          x: ((clientX - box.left) * frame.width) / box.width,
          y: ((clientY - box.top) * frame.height) / box.height
        };
      },
      dispose() {
        // The scope ends the input it was given; the Engine ends its scopes and its Host.
        return (disposal ??= (async () => {
          made.dispose();
          panel?.dispose();
          watcher?.disconnect();
          probe?.remove();
          screenListeners.clear();
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
