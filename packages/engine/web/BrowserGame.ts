// SPDX-License-Identifier: Apache-2.0
// A game in a page from one call: a Host chosen for the browser, an Engine, a scope, pointer and keyboard input and
// a frame loop, each made the way its own entry makes it, and all of them ended by one dispose.
import { EgretError, Scope as RuntimeScope } from '@egret/runtime';
import {
  Bitmap,
  copyImageData2DPixels,
  createAssetRef,
  createAssetType,
  createEngineForProfile,
  createImageData2D,
  createTexture,
  isTexture,
  SHARED_FRAME_PROFILE_2D,
  Sprite
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
import { createBrowserTextWork } from './browserTextWork.js';
import type { CanvasWorkSchedule } from './browserTextWork.js';
import { createBrowserStaticLayers } from './browserStaticLayers.js';
import type { BrowserGameStaticLayers } from './browserStaticLayers.js';
import { decodeBrowserImage, sniffBrowserImageFormat } from './BrowserImageTextures.js';
import { createGameImageAdmission } from './GameImageAdmission.js';
import { createTextField, createTextRasterCache } from '@egret/engine/text';
import type { TextField, TextRasterCache } from '@egret/engine/text';
import type {
  BrowserGameParagraphLabel,
  BrowserGameParagraphLabelCreateOptions,
  createGameParagraphs
} from './browserGameParagraph.js';
import type { BrowserGameGlyphFont, BrowserGameGlyphFontOptions } from './browserGameGlyphFont.js';
import { createBrowserFrameLoop } from './loop.js';
import type { BrowserFrameLoop, BrowserFrameLoopOptions, BrowserFrameTiming } from './loop.js';
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
import type { ScreenFit, ScreenInsets, ScreenPlan, ScreenSize, ScreenUiScale } from './screen.js';
import type { SharedWebGL2StartupTiming, SharedWebGL2PageBatching } from './webgl2.js';

/** Which GPU interface a browser game draws with. */
export type BrowserGameBackend = 'webgpu' | 'webgl2';
/**
 * How the canvas fills the element it is in: not at all, whole inside it, covering it, stretched to it, filling it with
 * a stage that grows around the design (`'expand'`), or filling it as the stage scale modes of Egret 5 did
 * (`'fixedWidth'`, `'fixedHeight'`, `'fixedNarrow'`, `'fixedWide'`; see `planScreen` of `@egret/engine/web/screen`).
 */
export type BrowserGameFit = 'none' | 'cover' | 'stretch' | ScreenFit;
const GAME_FITS: readonly BrowserGameFit[] = [
  'none',
  'contain',
  'cover',
  'stretch',
  'expand',
  'fixedWidth',
  'fixedHeight',
  'fixedNarrow',
  'fixedWide'
];
/** The fits of which the stage follows the plan of the screen, its size included. */
const plannedFit = (fit: BrowserGameFit): ScreenFit | undefined =>
  fit === 'none' || fit === 'cover' || fit === 'stretch' ? undefined : fit;
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
  /** Outline radius in stage units, from 0 to 512. Zero draws only the fill. */
  readonly strokeWidth?: number;
  /** Outline RGB color. Defaults to black. */
  readonly strokeColor?: number;
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
  /** Hidden pages can release their label raster while keeping the label's text and style. */
  setRasterActive(active: boolean): void;
  dispose(): void;
}
/** A line of text drawn on a page of images shared with other such labels. */
export interface BrowserGameAtlasLabel {
  /**
   * A sprite holding the words: place it with `x` and `y` and add it where it belongs, as a label's display. Its origin
   * is where a label's is, and the words are drawn where a label draws them.
   */
  readonly display: Sprite;
  /** Setting it draws the new words when they are ready; until then the old ones stay. */
  text: string;
  /** Settles when the words last set are on the stage, and rejects if they could not be drawn. */
  readonly ready: Promise<void>;
  /** The box of the words in the display's units, as a label's display measures it: its width and height place it. */
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** Changes any of the options; what is left out stays. */
  set(options: BrowserGameLabelOptions): void;
  /** Hidden pages can give back their place on the shared page while keeping the words and style. */
  setRasterActive(active: boolean): void;
  dispose(): void;
}
/** What the last frame drawn held of a frame's images, against what one frame may hold. */
export interface BrowserGameFrameUsage {
  /** Different images (pages) the frame drew from. A frame holds at most 64. */
  readonly pages: number;
  /** Different rectangles of those images. A frame holds at most 4,096. */
  readonly regions: number;
  /** Bytes of those images. A frame holds at most 64 MiB. */
  readonly imageBytes: number;
  readonly limits: { readonly pages: number; readonly regions: number; readonly imageBytes: number };
  /** Frames not drawn because they held more images than that, since the game began. The loop went on after each. */
  readonly refusedFrames: number;
}
/**
 * Something to know before it shows: `FRAME_IMAGES_NEAR_LIMIT` when a frame holds four fifths of what a frame may hold
 * of images, `FRAME_IMAGE_BUDGET` when a frame held more and was not drawn (the loop goes on), `LABEL_NOT_DRAWN` when a
 * label's words could not be drawn, `LABEL_CACHE_NEAR_LIMIT` when the labels hold four fifths of the text cache, and from
 * `play`, `PLAY_MADE_EVERY_FRAME` when `update` made a text, a shape or a sprite in each of the last 60 frames.
 *
 * A page whose `globalThis.__egretAgent` has a `warning` function is told every warning as well, whether or not the
 * game asked for them: a tool that runs the game for an agent (tools/verify-game.mjs) puts it there before the game
 * starts. What that function throws is the tool's, and is not told.
 */
export interface BrowserGameWarning {
  readonly code:
    | 'FRAME_IMAGES_NEAR_LIMIT'
    | 'FRAME_IMAGE_BUDGET'
    | 'LABEL_NOT_DRAWN'
    | 'LABEL_CACHE_NEAR_LIMIT'
    | 'PLAY_MADE_EVERY_FRAME';
  readonly message: string;
  readonly usage?: BrowserGameFrameUsage;
  readonly cause?: unknown;
}
/** A browser game to make: its canvas and size, its backend and colors, its update, its input and stats, and how it fits the page. */
/** Continuous presentation or a retained frame, with the same simulation clock in either mode. */
export type BrowserGameRenderMode = 'continuous' | 'on-demand';
/** Wall-clock preparation durations, and the first accepted SDK submission (not GPU completion or presentation). */
export interface BrowserGameStartupTiming {
  readonly backendSelectMs: number;
  readonly backendModuleMs: number;
  readonly hostCreateMs: number;
  readonly engineOpenMs: number;
  readonly setupMs: number;
  readonly readyMs: number;
  readonly firstSubmitMs?: number;
  readonly webgl2?: SharedWebGL2StartupTiming;
}
/** A loop sample with the game's image-budget refusal distinguished from a submitted frame. */
export interface BrowserGameFrameTiming extends Omit<BrowserFrameTiming, 'outcome'> {
  readonly outcome: Exclude<BrowserFrameTiming['outcome'], 'rendered'> | 'submitted' | 'refused';
}
export interface BrowserGameOptions {
  /** The canvas the game is drawn on. The page gives it its size on the screen. */
  readonly canvas: HTMLCanvasElement;
  /** The size of the stage, in the game's own units, whatever the size of the canvas on the page. */
  readonly width: number;
  readonly height: number;
  /** "auto", unless given: WebGPU where the browser gives an adapter, WebGL2 otherwise. */
  readonly backend?: 'auto' | BrowserGameBackend;
  /**
   * Canvas pixels for each unit of the canvas's own width. The device's ratio unless given, and then never more than 2;
   * 1 with `wholeScale`, which takes no other.
   */
  readonly pixelRatio?: number;
  /**
   * With a fit other than "none", "cover" and "stretch": a stage unit covers a whole number of the device's pixels, the
   * canvas is drawn at a pixel a unit and enlarged without smoothing, and what the whole steps leave of the element is
   * bars. For pixel art. False unless given.
   */
  readonly wholeScale?: boolean;
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
  /** Opt into explicit retained GPU background placements when the chosen backend is WebGL2. */
  readonly staticLayers?: boolean;
  /** On demand retains the last frame until visual, screen, native-generation or explicit invalidation changes. */
  readonly renderMode?: BrowserGameRenderMode;
  /** Opt-in Canvas text work budget (milliseconds between display frames, > 0 and <= 16). */
  readonly textWorkBudgetMs?: number;
  /** With a budget, pace new Canvas jobs only while this predicate returns true. */
  readonly textWorkBudgetWhen?: () => boolean;
  /** Opt-in CPU frame timing; submitted does not mean GPU complete or presented. */
  readonly onFrameTiming?: (sample: BrowserGameFrameTiming) => void;
  /** Enable the existing bounded shared WebGL2 Host phase samples (available on game.host). */
  readonly measureSharedFrames?: boolean;
  /** WebGL2-only: single-page omits the multi-page shader at startup, trading extra draws across pages. */
  readonly webgl2PageBatching?: SharedWebGL2PageBatching;
  /** One step of the game, called before each frame with the seconds since the step before. */
  readonly update?: (deltaSeconds: number) => void;
  /** Presentation-only work after frame admission, before capture. */
  readonly beforeRender?: BrowserFrameLoopOptions<unknown>['beforeRender'];
  /** Synchronous presentation work after this turn's primary submission or retention. */
  readonly afterFrame?: BrowserFrameLoopOptions<unknown>['afterFrame'];
  /** Optional bounded recovery of a render failure. Game logic and preparation errors still stop the loop. */
  readonly renderRetry?: BrowserFrameLoopOptions<unknown>['renderRetry'];
  /** Told once of what stopped the game's loop. Without it the failure is thrown where the console shows it. */
  readonly onError?: (error: unknown) => void;
  /**
   * Told of what a game should know before it shows: a frame near its limit of images, a frame not drawn for holding
   * more, a label whose words could not be drawn. Each is told when it begins, not on every frame. Without it they are
   * not told: the engine writes nothing to the console.
   */
  readonly onWarning?: (warning: BrowserGameWarning) => void;
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
   * The stage's size while the element is taller than it is wide, with a fit other than "none", "cover" and
   * "stretch". `width` × `height` otherwise. The stage changes size when the element changes shape;
   * `game.onScreenChange` tells of it.
   */
  readonly portrait?: ScreenSize;
  /**
   * What covers the edges of the element, in CSS pixels, for `game.screen.safe`. The page's own `safe-area-inset`
   * values unless given, which the page has when its viewport meta tag says `viewport-fit=cover`. A page whose
   * `globalThis.__egretAgent` has `insets` (`{ top, right, bottom, left }`, CSS pixels of the window) takes those as the
   * window's instead: a tool stands in that way for the notch and the home bar of a phone a headless browser lacks.
   */
  readonly insets?: ScreenInsets;
  /** Bounds CSS pixels per interface unit for the filling fits. The stage and all input follow the new plan. */
  readonly uiScale?: ScreenUiScale;
  /** The loop starts at once unless false is given; then `game.loop.start()` starts it. */
  readonly autoStart?: boolean;
}
/** A game in a canvas: its Engine, host and stage, its frame loop and input, and calls that load textures and make labels. */
export interface BrowserGame {
  /** Request a new frame in on-demand mode; useful for presentation data outside the display tree. */
  invalidate(): void;
  getStartupTiming(): BrowserGameStartupTiming;
  readonly backend: BrowserGameBackend;
  readonly engine: Engine;
  /** The Host that draws: its status says what it holds and what last went wrong. It ends with the game. */
  readonly host: { getStatus(): { readonly pendingFrames: number }; whenIdle(): Promise<void> };
  /** Available only on opted-in WebGL2 games. WebGPU and ordinary games keep their original rendering path. */
  readonly staticLayers?: BrowserGameStaticLayers;
  /** The stage of the Engine: what is added to it is drawn. */
  readonly stage: Stage;
  /** A scope for what the game creates. It is disposed with the game. */
  readonly scope: Scope;
  /** The frame the loop draws: the stage's size and what it is cleared to. */
  readonly frame: SharedFrameOptions2D;
  /**
   * Where the stage is on the screen now: its size in stage units, the scale, the design's place on it and the part
   * no notch or home bar covers. With a fit other than "none", "cover" and "stretch" it follows the element;
   * otherwise the stage is `width` × `height` and all of it is safe.
   */
  readonly screen: ScreenPlan;
  /** Calls `listener` with the new plan after the stage size, CSS scale or safe part changes. Returns its removal. */
  onScreenChange(listener: (screen: ScreenPlan) => void): () => void;
  readonly loop: BrowserFrameLoop;
  readonly pointer: PointerInput | undefined;
  readonly keyboard: KeyboardInput | undefined;
  /** The hover and wheel input, when `hover: true` was given. */
  readonly hover: BrowserGameHoverInput | undefined;
  readonly stats: BrowserStatsPanel | undefined;
  /**
   * Loads a PNG, JPEG, WebP, GIF or AVIF image and gives the lease of its texture, for `new Bitmap(lease)` or
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
   * A line of text drawn on a page of images it shares with other such labels, so that many short labels on one screen
   * take a few of the 64 images a frame may hold, and give back their place in the text cache once drawn. The words
   * are drawn as `createLabel` draws them. A label's display, its parent or an ancestor disposed ends it.
   */
  createAtlasLabel(options?: BrowserGameLabelCreateOptions): Promise<BrowserGameAtlasLabel>;
  /** The same optional budget for a caller-owned Canvas paragraph provider; owned by the game. */
  readonly scheduleTextWork?: CanvasWorkSchedule;
  /** Measured, width-wrapped text using the existing Canvas paragraph provider and cache. */
  createParagraphLabel(options: BrowserGameParagraphLabelCreateOptions): Promise<BrowserGameParagraphLabel>;
  /** Build one reusable immutable page of fixed-advance glyphs for ordinary BitmapText counters. */
  createGlyphFont(options: BrowserGameGlyphFontOptions): Promise<BrowserGameGlyphFont>;
  /** What the last frame drawn held of a frame's images. */
  getFrameUsage(): BrowserGameFrameUsage;
  /**
   * Draws one frame as the game's loop draws it, for a loop of the game's own: it ends labels whose display is gone,
   * measures what the frame holds, and leaves a frame of more images than a frame may hold undrawn, with a warning, and
   * gives undefined for it. Other failures are thrown.
   */
  drawFrame(frame: SharedFrameOptions2D): SharedRenderFrame2D | undefined;
  /**
   * Text scheduler and logical cache accounting. Available before the first label is prepared. A label whose display
   * was disposed, or taken off a parent that was then disposed, is ended first, so its place in the cache is counted
   * as given back.
   */
  getLabelStatus(): Readonly<{
    drawing: number;
    queued: number;
    refusals: number;
    releasedRasters: number;
    cache: ReturnType<TextRasterCache['getStatus']> | undefined;
    /** Labels of `createAtlasLabel` that are drawn, the shared pages that hold them, and those still being drawn. */
    atlasLabels: number;
    atlasPages: number;
    atlasPending: number;
  }>;
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
const MAX_GAME_IMAGE_JOBS = 4;
const MAX_GAME_IMAGE_BYTES = 8 * 1024 * 1024;

function gameImageLimit(): EgretError {
  return new EgretError('WEB_PNG_INPUT_LIMIT', { cause: new RangeError('Game image encoded payload limit') });
}

async function boundedGameImageBytes(response: Response): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(response.headers.get('content-length')) > MAX_GAME_IMAGE_BYTES) throw gameImageLimit();
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBufferLike>[] = [];
  let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_GAME_IMAGE_BYTES) throw gameImageLimit();
      chunks.push(chunk.value);
    }
  } catch (cause) {
    void reader.cancel().catch(() => {});
    throw cause;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

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

/** Tells a tool's `globalThis.__egretAgent.warning`, where a page has one, of a warning; what it throws is the tool's. */
function tellAgent(warning: BrowserGameWarning): void {
  const agent = (globalThis as { readonly __egretAgent?: { readonly warning?: unknown } }).__egretAgent;
  if (typeof agent?.warning !== 'function') return;
  try {
    (agent.warning as (warning: BrowserGameWarning) => void)(warning);
  } catch {
    /* The tool's own failure, not the game's. */
  }
}

/**
 * The safe-area insets a tool's `globalThis.__egretAgent.insets` gives, in the window's CSS pixels, to fit the game as
 * a phone with a notch would; undefined where a page has none, or none of 0 or more on each side.
 */
function agentInsets(): ScreenInsets | undefined {
  const agent = (globalThis as { readonly __egretAgent?: { readonly insets?: unknown } }).__egretAgent;
  const insets = agent?.insets as Partial<ScreenInsets> | undefined;
  if (insets === null || typeof insets !== 'object') return undefined;
  const sides = [insets.top, insets.right, insets.bottom, insets.left];
  if (!sides.every(side => typeof side === 'number' && Number.isFinite(side) && side >= 0)) return undefined;
  return { top: insets.top!, right: insets.right!, bottom: insets.bottom!, left: insets.left! };
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
  const started = performance.now();
  if (options === null || typeof options !== 'object') throw invalid();
  const { canvas, width, height, update, onError, onWarning, onFrameTiming } = options;
  const asked = options.backend ?? 'auto',
    clearColor = options.clearColor ?? 0,
    clearAlpha = options.clearAlpha ?? 1,
    blendSpace = options.blendSpace ?? 'linear',
    enableEffects = options.effects ?? false,
    renderMode = options.renderMode ?? 'continuous';
  const deviceRatio = (): number => {
    const ratio = Number((globalThis as { readonly devicePixelRatio?: unknown }).devicePixelRatio);
    return ratio > 0 && Number.isFinite(ratio) ? ratio : 1;
  };
  const wholeScale = options.wholeScale ?? false,
    pixelRatio = options.pixelRatio ?? (wholeScale ? 1 : Math.min(deviceRatio(), 2));
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
    (renderMode !== 'continuous' && renderMode !== 'on-demand') ||
    (options.textWorkBudgetMs !== undefined &&
      (!Number.isFinite(options.textWorkBudgetMs) || options.textWorkBudgetMs <= 0 || options.textWorkBudgetMs > 16)) ||
    (options.textWorkBudgetWhen !== undefined &&
      (options.textWorkBudgetMs === undefined || typeof options.textWorkBudgetWhen !== 'function')) ||
    (options.webgl2PageBatching !== undefined &&
      options.webgl2PageBatching !== 'single-page' &&
      options.webgl2PageBatching !== 'multi-page') ||
    (options.uiScale !== undefined && (plannedFit(options.fit ?? 'none') === undefined || wholeScale)) ||
    (update !== undefined && typeof update !== 'function') ||
    (onError !== undefined && typeof onError !== 'function') ||
    (options.beforeRender !== undefined && typeof options.beforeRender !== 'function') ||
    (options.afterFrame !== undefined && typeof options.afterFrame !== 'function') ||
    (onFrameTiming !== undefined && typeof onFrameTiming !== 'function') ||
    (options.measureSharedFrames !== undefined && typeof options.measureSharedFrames !== 'boolean') ||
    (options.renderRetry !== undefined &&
      (options.renderRetry === null ||
        typeof options.renderRetry !== 'object' ||
        !Number.isSafeInteger(options.renderRetry.maxConsecutive) ||
        options.renderRetry.maxConsecutive < 1 ||
        options.renderRetry.maxConsecutive > 8 ||
        typeof options.renderRetry.shouldRetry !== 'function')) ||
    (onWarning !== undefined && typeof onWarning !== 'function') ||
    [options.pointer, options.keyboard, options.hover, options.autoStart, options.stats, options.staticLayers].some(
      flag => flag !== undefined && typeof flag !== 'boolean'
    ) ||
    !GAME_FITS.includes(options.fit ?? 'none') ||
    typeof wholeScale !== 'boolean' ||
    (wholeScale && (plannedFit(options.fit ?? 'none') === undefined || pixelRatio !== 1)) ||
    (options.fitTo !== undefined && (options.fitTo === null || typeof options.fitTo !== 'object'))
  )
    throw invalid();
  // The plan of the stage: refused here, before anything is made, when the portrait size or the insets are not valid.
  const planFor = (box: ScreenSize, insets?: ScreenInsets): ScreenPlan =>
    planScreen({
      box,
      design: { width, height },
      ...(options.portrait === undefined ? {} : { portrait: options.portrait }),
      fit: plannedFit(options.fit ?? 'none') ?? 'contain',
      ...(wholeScale ? { wholeScale, pixelRatio: deviceRatio() } : {}),
      ...(insets === undefined ? {} : { insets }),
      ...(options.uiScale === undefined ? {} : { uiScale: options.uiScale })
    });
  try {
    planFor({ width, height }, options.insets);
  } catch {
    throw invalid();
  }
  let screen = planFor({ width, height });
  const backend = await chooseBackend(asked),
    backendReady = performance.now();
  // Measure the selected module and native host separately. Neither needs to load the other backend.
  let moduleReady = backendReady;
  const host =
    backend === 'webgpu'
      ? await import('./webgpu.js').then(module => {
          moduleReady = performance.now();
          return module.createSharedWebGPUHost({ canvas, pixelRatio, blendSpace, enableEffects });
        })
      : await import('./webgl2.js').then(module => {
          moduleReady = performance.now();
          return module.createSharedWebGL2Host({
            canvas,
            pixelRatio,
            blendSpace,
            enableEffects,
            ...(options.measureSharedFrames === undefined ? {} : { measureSharedFrames: options.measureSharedFrames }),
            ...(options.webgl2PageBatching === undefined ? {} : { pageBatching: options.webgl2PageBatching })
          });
        });
  const hostCreated = performance.now();
  const staticCache =
    options.staticLayers === true && 'createSharedLayer2D' in host ? createBrowserStaticLayers(host) : undefined;
  let engine: Engine;
  try {
    engine = await createEngineForProfile(
      { host: staticCache?.adapter ?? host, onDiagnostic: gameDiagnostics(onError) },
      SHARED_FRAME_PROFILE_2D
    );
  } catch (cause) {
    try {
      await host.close();
    } catch {
      /* The first failure is the one to tell. */
    }
    throw cause;
  }
  const engineOpened = performance.now();
  const webgl2Startup = 'getStartupTiming' in host ? host.getStartupTiming() : undefined;
  let ready = engineOpened,
    firstSubmit: number | undefined;
  let loop: BrowserFrameLoop | undefined, stats: BrowserStatsPanel | undefined, disposal: Promise<void> | undefined;
  try {
    const scope = engine.createScope(),
      initialFrame: SharedFrameOptions2D = Object.freeze({ width, height, clearColor, clearAlpha });
    const textWork =
      options.textWorkBudgetMs === undefined
        ? undefined
        : scope.use(createBrowserTextWork(options.textWorkBudgetMs, options.textWorkBudgetWhen));
    const scheduleTextWork = textWork?.schedule;
    let frame = initialFrame;
    const revision = renderMode === 'on-demand' ? engine.watchDisplayRevision(scope) : undefined;
    let lastFrame: SharedFrameOptions2D | undefined,
      lastScreen: ScreenPlan | undefined,
      lastRevision = -1,
      lastLayerRevision = -1,
      lastGeneration = -1,
      redraw = 0,
      shownRedraw = -1;
    const invalidate = (): void => {
      if (revision !== undefined) redraw++;
    };
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
    let lastDrawAccepted = false;
    // What the last frame drawn held of a frame's images, and the frames not drawn for holding more.
    const FRAME_PAGES = 64,
      FRAME_REGIONS = 4096,
      FRAME_IMAGE_BYTES = 67108864;
    let usage: BrowserGameFrameUsage = Object.freeze({
      pages: 0,
      regions: 0,
      imageBytes: 0,
      limits: Object.freeze({ pages: FRAME_PAGES, regions: FRAME_REGIONS, imageBytes: FRAME_IMAGE_BYTES }),
      refusedFrames: 0
    });
    let nearLimit = false,
      refusing = false;
    const warn = (warning: BrowserGameWarning): void => {
      tellAgent(Object.freeze(warning));
      if (onWarning === undefined) return;
      try {
        onWarning(Object.freeze(warning));
      } catch (cause) {
        // A warning handler that throws stops the game, as an update that throws does.
        made.stop();
        if (onError === undefined) throw cause;
        onError(cause);
      }
    };
    const measureFrame = (frame: SharedRenderFrame2D): void => {
      let bytes = 0;
      for (const page of frame.pages) if (page.builtin === undefined) bytes += page.source.byteLength;
      usage = Object.freeze({
        pages: frame.pages.length,
        regions: frame.regions.length,
        imageBytes: bytes,
        limits: usage.limits,
        refusedFrames: usage.refusedFrames
      });
      refusing = false;
      // Told when a frame first comes within a fifth of a limit, and again only after it has gone back below seven
      // tenths of every one.
      const share = Math.max(
        usage.pages / FRAME_PAGES,
        usage.regions / FRAME_REGIONS,
        usage.imageBytes / FRAME_IMAGE_BYTES
      );
      if (!nearLimit && share >= 0.8) {
        nearLimit = true;
        warn({
          code: 'FRAME_IMAGES_NEAR_LIMIT',
          message:
            'A frame holds ' +
            usage.pages +
            ' of ' +
            FRAME_PAGES +
            ' images and ' +
            usage.regions +
            ' of ' +
            FRAME_REGIONS +
            ' regions. Labels of createAtlasLabel share images.',
          usage
        });
      } else if (nearLimit && share < 0.7) nearLimit = false;
    };
    // Each frame is drawn through this, which ends the labels whose display is gone, keeps the frame for the usage and
    // the panel, and lets a frame that holds more images than a frame may go undrawn, with a warning, rather than stop
    // the game.
    const drawFrame = (given: SharedFrameOptions2D): SharedRenderFrame2D | undefined => {
      // Continuous mode keeps its old frame-time maintenance. On-demand performs it each display step below.
      if (revision === undefined) {
        sweepLabels();
        waitAtlas();
      }
      const pending = redraw,
        nextRevision = revision?.revision,
        nextLayer = staticCache?.api.revision ?? 0,
        nextScreen = screen,
        nextGeneration = revision === undefined ? -1 : host.getSessionStatus().generation;
      {
        let frame: SharedRenderFrame2D;
        try {
          frame = engine.renderSharedFrame(given);
        } catch (cause) {
          if (!(cause instanceof EgretError) || cause.code !== 'FRAME_IMAGE_BUDGET') throw cause;
          usage = Object.freeze({ ...usage, refusedFrames: usage.refusedFrames + 1 });
          if (!refusing) {
            refusing = true;
            warn({
              code: 'FRAME_IMAGE_BUDGET',
              message:
                'A frame held more images than a frame may (' +
                FRAME_PAGES +
                ' images, ' +
                FRAME_REGIONS +
                ' regions, 64 MiB), and was not drawn; the last frame stays on the screen until one fits.',
              usage,
              cause
            });
          }
          return undefined;
        }
        drawn = frame;
        if (firstSubmit === undefined) firstSubmit = performance.now();
        // A refused frame leaves the dirty request pending; a late mutation after capture is not acknowledged.
        if (nextRevision !== undefined) {
          lastFrame = given;
          lastScreen = nextScreen;
          lastRevision = nextRevision;
          lastLayerRevision = nextLayer;
          lastGeneration = nextGeneration;
          shownRedraw = pending;
        }
        measureFrame(frame);
        return frame;
      }
    };
    const drawing = {
      clock: engine.clock,
      advanceTime: (seconds: number) => engine.advanceTime(seconds),
      renderSharedFrame:
        onFrameTiming === undefined
          ? drawFrame
          : (given: SharedFrameOptions2D) => {
              const result = drawFrame(given);
              lastDrawAccepted = result !== undefined;
              return result;
            }
    };
    // With a panel, each step tells it what the last one did.
    const made: BrowserFrameLoop = (loop = createBrowserFrameLoop({
      engine: drawing,
      host,
      frame: frameNow,
      ...(revision === undefined
        ? {}
        : {
            shouldRender: () => {
              // Raster packing/disposal is work that must settle even when a static frame is retained.
              sweepLabels();
              waitAtlas();
              return (
                lastRevision !== revision.revision ||
                lastLayerRevision !== (staticCache?.api.revision ?? 0) ||
                lastGeneration !== host.getSessionStatus().generation ||
                shownRedraw !== redraw ||
                lastFrame !== frame ||
                lastScreen !== screen
              );
            }
          }),
      ...(onFrameTiming === undefined
        ? {}
        : {
            onFrameTiming: (sample: BrowserFrameTiming) => {
              const outcome =
                sample.outcome === 'rendered' ? (lastDrawAccepted ? 'submitted' : 'refused') : sample.outcome;
              onFrameTiming(Object.freeze({ ...sample, outcome }));
            }
          }),
      ...(options.beforeRender === undefined ? {} : { beforeRender: options.beforeRender }),
      ...(options.afterFrame === undefined ? {} : { afterFrame: options.afterFrame }),
      ...(options.renderRetry === undefined ? {} : { renderRetry: options.renderRetry }),
      ...(onError === undefined ? {} : { onError }),
      update(seconds: number): void {
        if (panel !== undefined) {
          const now = made.snapshot();
          panel.sample({
            ...(drawn === undefined ? {} : { frame: drawn }),
            pendingFrames: host.getStatus().pendingFrames,
            drawCalls: host.getFrameDrawCalls(),
            frames: now.frames,
            skipped: now.skipped
          });
        }
        drawn = undefined;
        update?.(seconds);
      }
    }));
    // Keep the strict PNG decoder and its ownership contract. Route other known encodings by
    // bytes so file names, query strings and response content types cannot select a wrong decoder.
    const imageType = createAssetType<Texture>('egret.browser-game.image', isTexture);
    const pendingPngBytes = new WeakMap<object, Uint8Array<ArrayBuffer>>();
    const pngTextures = new WeakSet<Texture>();
    const imageJobs = createGameImageAdmission(MAX_GAME_IMAGE_JOBS);
    const images = createBrowserTextureProvider({
      async readBytes(_ref, context) {
        const bytes = pendingPngBytes.get(context);
        if (bytes === undefined) throw new Error('Missing PNG bytes for the current image load');
        return bytes;
      }
    });
    engine.assets.register(imageType, {
      async load(ref, context) {
        // Hold the original admission budget through fetch and decode for every format.
        // Even a cancelled native decode retains its slot until the browser settles it.
        const release = await imageJobs.admit(context.signal);
        const stop = new AbortController(),
          abort = (): void => stop.abort();
        try {
          context.signal.addEventListener('abort', abort, { once: true });
          if (context.signal.aborted) throw context.signal.reason;
          let bytes: Uint8Array<ArrayBuffer>;
          try {
            const response = await globalThis.fetch(ref.id, { signal: stop.signal });
            if (!response.ok)
              throw new EgretError('WEB_PNG_READ_FAILED', {
                cause: new EgretError('BROWSER_GAME_IMAGE_FAILED', { cause: new Error(response.status + ' ' + ref.id) })
              });
            bytes = await boundedGameImageBytes(response);
          } catch (cause) {
            stop.abort();
            if (context.signal.aborted) throw context.signal.reason;
            if (cause instanceof EgretError) throw cause;
            throw new EgretError('WEB_PNG_READ_FAILED', { cause });
          }
          if (context.signal.aborted) throw context.signal.reason;
          const format = sniffBrowserImageFormat(bytes);
          if (format !== undefined && format !== 'png') {
            const texture = await decodeBrowserImage(bytes);
            if (!context.signal.aborted) return texture;
            texture.dispose();
            throw context.signal.reason;
          }
          pendingPngBytes.set(context, bytes);
          const texture = await images.load(ref, context);
          pngTextures.add(texture);
          return texture;
        } finally {
          context.signal.removeEventListener('abort', abort);
          pendingPngBytes.delete(context);
          release();
        }
      },
      dispose(texture) {
        if (pngTextures.has(texture)) images.dispose(texture);
        else texture.dispose();
      }
    });
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
      pixels: Uint8Array | Uint8ClampedArray,
      owner = scope
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
        const lease = await engine.assets.acquire(createAssetRef(paintedType, key), { signal: owner.signal });
        try {
          return owner.use(lease);
        } catch (cause) {
          lease.release();
          throw cause;
        }
      } finally {
        // Not loaded (the scope ended first): the texture is ended here.
        if (painted.delete(key)) texture.dispose();
      }
    };
    // The canvas in its element: sized now and whenever the element changes size. With the planned fits the
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
      // A tool may stand in for a phone's notch and home bar, which a headless browser does not have.
      const standIn = agentInsets(),
        edges = standIn ?? {
          top: read(style.paddingTop),
          right: read(style.paddingRight),
          bottom: read(style.paddingBottom),
          left: read(style.paddingLeft)
        };
      // Insets are of the window; the element may be anywhere in it.
      const box = (holder ?? canvas).getBoundingClientRect(),
        across = view.innerWidth,
        down = view.innerHeight;
      return {
        top: Math.max(0, edges.top - box.top),
        left: Math.max(0, edges.left - box.left),
        right: Math.max(0, edges.right - (finite(across) ? across - box.right : 0)),
        bottom: Math.max(0, edges.bottom - (finite(down) ? down - box.bottom : 0))
      };
    };
    if (fit !== 'none' && holder !== null) {
      const place = (): void => {
        const projected = holder.getBoundingClientRect();
        // CSS dimensions are set in the holder's layout space. A transformed bounding box is
        // measured in page space and would multiply the ancestor scale a second time.
        const box = { width: holder.clientWidth || projected.width, height: holder.clientHeight || projected.height };
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
        // Whole steps are enlarged as they are, a canvas pixel to a square of the device's.
        if (wholeScale) style.imageRendering = 'pixelated';
        style.marginLeft = next.left + 'px';
        style.marginTop = next.top + 'px';
        const moved =
          next.width !== before.width ||
          next.height !== before.height ||
          next.scale !== before.scale ||
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
    let currentTextCache: TextRasterCache | undefined;
    // Leave headroom for cache actors settling after delivery. Queue entries are cancellable and bounded.
    const LABEL_LANES = 2,
      MAX_QUEUED_LABELS = 128;
    let labelsDrawing = 0,
      labelRefusals = 0,
      releasedRasters = 0;
    const labelsWaiting: ((entered: boolean) => void)[] = [];
    // Labels alive, each with its display and the parent it was last seen under. A label whose display was disposed,
    // or taken off a parent that was then disposed (a display of another scope is taken off, not disposed, with its
    // parent), is ended at the next step, so that its place in the text cache is given back.
    interface LiveLabel {
      readonly display: DisplayObject;
      readonly end: () => void;
      parent: DisplayObject | undefined;
    }
    const liveLabels = new Set<LiveLabel>();
    const sweepLabels = (): void => {
      for (const live of [...liveLabels]) {
        const display = live.display;
        if (display.isDisposed) live.end();
        else if (display.parent !== undefined) live.parent = display.parent;
        else if (live.parent !== undefined && live.parent.isDisposed) live.end();
      }
      watchCache();
      tellNotDrawn();
    };
    // Told once while the labels hold four fifths of what the text cache may hold, and again after they fall below.
    let cacheNearLimit = false;
    const watchCache = (): void => {
      const status = currentTextCache?.getStatus();
      if (status === undefined) return;
      const share = Math.max(
        status.callerLeaseSlots / 128,
        (status.currentGenerations + status.retiredGenerations) / 64
      );
      if (!cacheNearLimit && share >= 0.8) {
        cacheNearLimit = true;
        warn({
          code: 'LABEL_CACHE_NEAR_LIMIT',
          message:
            'Labels hold ' +
            status.callerLeaseSlots +
            ' of 128 places and ' +
            (status.currentGenerations + status.retiredGenerations) +
            ' of 64 texts in the text cache. ' +
            'Labels of createAtlasLabel give theirs back once drawn.'
        });
      } else if (cacheNearLimit && share < 0.6) cacheNearLimit = false;
    };
    // Labels not drawn since the last step: told once a step, with the first cause.
    let notDrawnCount = 0,
      notDrawnCause: unknown;
    const notDrawn = (cause: unknown): void => {
      if (notDrawnCount++ === 0) notDrawnCause = cause;
    };
    const tellNotDrawn = (): void => {
      if (notDrawnCount === 0) return;
      const count = notDrawnCount,
        cause = notDrawnCause;
      notDrawnCount = 0;
      notDrawnCause = undefined;
      warn({
        code: 'LABEL_NOT_DRAWN',
        message:
          (count === 1 ? "A label's words" : 'The words of ' + count + ' labels') +
          ' could not be drawn' +
          (cause instanceof EgretError ? ': ' + cause.code : '') +
          '.',
        cause
      });
    };
    // Labels of createAtlasLabel wait for the same lanes in a longer line: once drawn they hold nothing in the cache.
    const MAX_QUEUED_ATLAS_LABELS = 4096;
    const atlasLaneWaiting: ((entered: boolean) => void)[] = [];
    const leaveLabelLane = (): void => {
      const next = labelsWaiting.shift() ?? atlasLaneWaiting.shift();
      if (next) next(true);
      else labelsDrawing--;
    };
    const enterAtlasLane = (): boolean | Promise<boolean> => {
      if (labelsDrawing < LABEL_LANES) {
        labelsDrawing++;
        return true;
      }
      if (atlasLaneWaiting.length >= MAX_QUEUED_ATLAS_LABELS) {
        labelRefusals++;
        throw new EgretError('TEXT_CACHE_BUDGET');
      }
      return new Promise(resolve => atlasLaneWaiting.push(resolve));
    };
    const leaveAtlasLane = leaveLabelLane;
    async function createLabel(options: BrowserGameLabelCreateOptions = {}): Promise<BrowserGameLabel> {
      if (options === null || typeof options !== 'object') throw invalid();
      const { scope: owner = scope, ...given } = options;
      if (owner === null || typeof owner !== 'object') throw invalid();
      textCache ??= import('./text.js').then(
        text =>
          (currentTextCache = createTextRasterCache(engine.assets, {
            provider: text.createCanvasTextRasterProvider(
              { compatibility: 'game-labels', ...(scheduleTextWork === undefined ? {} : { schedule: scheduleTextWork }) }
            )
          }))
      );
      const cache = await textCache;
      const field = createTextField(engine, owner, cache);
      let now: Required<BrowserGameLabelOptions> = {
        text: '',
        fontFamily: 'sans-serif',
        fontSize: 24,
        fontWeight: 400,
        italic: false,
        lineHeight: 0,
        color: 0xffffff,
        strokeWidth: 0,
        strokeColor: 0,
        locale: 'en',
        direction: 'ltr'
      };
      let ready: Promise<void> = Promise.resolve(),
        asked = 0,
        adopted = -1,
        active = true,
        disposed = false,
        generation = 0,
        preparing: number | undefined,
        cancelQueued: (() => void) | undefined,
        running: Promise<void> | undefined;
      const current = (epoch: number): boolean => active && !disposed && !field.isDisposed && generation === epoch;
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
          fillColor: now.color,
          strokeWidth: now.strokeWidth,
          strokeColor: now.strokeColor
        });
      const enterLabelLane = (): boolean | Promise<boolean> => {
        if (labelsDrawing < LABEL_LANES) {
          labelsDrawing++;
          return true;
        }
        if (labelsWaiting.length >= MAX_QUEUED_LABELS) {
          labelRefusals++;
          throw new EgretError('TEXT_CACHE_BUDGET');
        }
        return new Promise(resolve => {
          labelsWaiting.push(resolve);
          cancelQueued = () => {
            const at = labelsWaiting.indexOf(resolve);
            if (at < 0) return; // The lane has already been handed to this draw.
            labelsWaiting.splice(at, 1);
            resolve(false);
          };
        });
      };
      // A label coalesces changes made while drawing and keeps only its latest request.
      const draw = async (epoch: number): Promise<void> => {
        let entered = false;
        try {
          if (!current(epoch)) return;
          entered = await enterLabelLane();
          if (!entered) return;
          if (generation === epoch) cancelQueued = undefined;
          for (let shown = -1; current(epoch) && shown !== asked; ) {
            if (adopted !== asked) {
              request();
              adopted = asked;
            }
            shown = asked;
            preparing = epoch;
            try {
              await field.prepare();
            } catch (cause) {
              if (!current(epoch)) return;
              if (!(cause instanceof EgretError) || cause.code !== 'TEXT_CACHE_BUDGET') throw cause;
              // Delivery can precede actor retirement. Retry once after actual settlement, without polling.
              await cache.whenIdle();
              if (!current(epoch)) return;
              try {
                await field.prepare();
              } catch (retry) {
                if (!current(epoch)) return;
                if (retry instanceof EgretError && retry.code === 'TEXT_CACHE_BUDGET') labelRefusals++;
                throw retry;
              }
            } finally {
              if (preparing === epoch) preparing = undefined;
            }
          }
        } finally {
          if (generation === epoch) running = undefined;
          if (entered) leaveLabelLane();
        }
      };
      const schedule = (): void => {
        if (!active || running !== undefined) return;
        const epoch = generation;
        const job = Promise.resolve().then(() => draw(epoch));
        running = ready = job;
        // Observe rejection while keeping it available on ready; a label still wanted is told of as not drawn.
        void job.catch(cause => {
          if (!disposed) notDrawn(cause);
        });
      };
      const apply = (next: BrowserGameLabelOptions): void => {
        if (next === null || typeof next !== 'object') throw invalid();
        now = { ...now, ...next };
        // Refused at once when nothing is being drawn; otherwise when its turn comes, through `ready`.
        if (preparing !== generation) {
          request();
          adopted = asked + 1;
        }
        asked++;
        schedule();
      };
      const supersede = (): void => {
        generation++;
        cancelQueued?.();
        cancelQueued = undefined;
        running = undefined;
      };
      const countRelease = (): void => {
        if (field.getStatus().metrics?.raster !== undefined) releasedRasters++;
      };
      const live: LiveLabel = { display: field, end: () => close(), parent: undefined };
      const close = (): void => {
        if (disposed) return;
        disposed = true;
        liveLabels.delete(live);
        supersede();
        owner.signal.removeEventListener('abort', close);
        countRelease();
        if (!field.isDisposed) field.dispose();
      };
      try {
        apply(given);
        owner.signal.addEventListener('abort', close, { once: true });
        liveLabels.add(live);
      } catch (cause) {
        close();
        throw cause;
      }
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
        setRasterActive(next: boolean) {
          if (typeof next !== 'boolean') throw invalid();
          if (active === next || disposed || field.isDisposed) return;
          active = next;
          supersede();
          if (active) schedule();
          else {
            countRelease();
            field.releaseRaster();
            ready = Promise.resolve();
          }
        },
        dispose: close
      });
    }
    // Labels on shared pages. The text cache draws their words as a label's; the pixels are copied onto a page with
    // the words of the other labels drawn with them, and the cache's raster is given back at once, so a label holds no
    // place in the cache once its words are drawn.
    const ATLAS_EDGE = 1024,
      ATLAS_GAP = 2,
      // Words wait for those drawn with them at most this many frames before their page is made.
      ATLAS_WAIT_FRAMES = 15,
      // With this many pages, every label's words are packed again onto as few as they fit.
      ATLAS_COMPACT_PAGES = 16;
    interface AtlasPage {
      textures: number;
    }
    interface AtlasItem {
      readonly width: number;
      readonly height: number;
      readonly pixels: Uint8Array;
      readonly resolve: (key: string) => void;
    }
    /** A label's words on a page: packed again with all the others when the pages are many. */
    interface AtlasHolder {
      readonly width: number;
      readonly height: number;
      readonly pixels: Uint8Array;
      adopt(key: string): void;
    }
    const atlasType = createAssetType<Texture>('egret.browser-game.atlas-label', isTexture),
      atlasWaiting = new Map<string, { readonly texture: Texture; readonly page: AtlasPage }>(),
      atlasPageOf = new WeakMap<Texture, AtlasPage>(),
      atlasHolders = new Set<AtlasHolder>();
    let atlasCount = 0,
      atlasPages = 0,
      atlasLabels = 0,
      atlasInFlight = 0,
      atlasQueue: AtlasItem[] = [],
      atlasWaited = 0,
      atlasSoon = false;
    const releaseAtlas = (texture: Texture): void => {
      const page = atlasPageOf.get(texture);
      atlasPageOf.delete(texture);
      texture.dispose();
      if (page !== undefined && --page.textures === 0) atlasPages--;
    };
    engine.assets.register(atlasType, {
      async load(ref) {
        const waiting = atlasWaiting.get(ref.id);
        atlasWaiting.delete(ref.id);
        if (waiting === undefined) throw invalid();
        atlasPageOf.set(waiting.texture, waiting.page);
        return waiting.texture;
      },
      dispose: releaseAtlas
    });
    /** A texture placed but never leased: its place on the page is given back. */
    const dropAtlasKey = (key: string): void => {
      const waiting = atlasWaiting.get(key);
      if (waiting === undefined) return;
      atlasWaiting.delete(key);
      waiting.texture.dispose();
      if (--waiting.page.textures === 0) atlasPages--;
    };
    // Rows of words, tallest first, on pages as wide as ATLAS_EDGE and no taller than they need, with a gap of clear
    // pixels around each so that no word bleeds into the next when it is drawn scaled. Words wider or taller than a
    // page have a page of their own.
    const packAtlas = (): void => {
      atlasWaited = 0;
      atlasSoon = false;
      if (scope.signal.aborted || atlasQueue.length === 0) return;
      const items = atlasQueue;
      atlasQueue = [];
      if (atlasPages >= ATLAS_COMPACT_PAGES)
        for (const holder of atlasHolders)
          items.push({
            width: holder.width,
            height: holder.height,
            pixels: holder.pixels,
            resolve: key => holder.adopt(key)
          });
      items.sort((a, b) => b.height - a.height);
      while (items.length !== 0) {
        const placed: { readonly item: AtlasItem; readonly x: number; readonly y: number }[] = [];
        const first = items[0]!;
        let pageWidth: number, pageHeight: number;
        if (first.width + ATLAS_GAP > ATLAS_EDGE || first.height + ATLAS_GAP > ATLAS_EDGE) {
          placed.push({ item: first, x: 0, y: 0 });
          items.shift();
          pageWidth = first.width;
          pageHeight = first.height;
        } else {
          let x = 0,
            y = 0,
            row = 0;
          pageWidth = 0;
          for (let index = 0; index < items.length; ) {
            const item = items[index]!,
              w = item.width + ATLAS_GAP,
              h = item.height + ATLAS_GAP;
            if (w > ATLAS_EDGE || h > ATLAS_EDGE) {
              index++;
              continue;
            }
            if (x + w > ATLAS_EDGE) {
              x = 0;
              y += row;
              row = 0;
            }
            if (y + h > ATLAS_EDGE) break;
            placed.push({ item, x, y });
            items.splice(index, 1);
            x += w;
            row = Math.max(row, h);
            pageWidth = Math.max(pageWidth, x);
          }
          pageHeight = y + row;
        }
        const pixels = new Uint8Array(pageWidth * pageHeight * 4);
        for (const { item, x: left, y: top } of placed)
          for (let line = 0; line < item.height; line++)
            pixels.set(
              item.pixels.subarray(line * item.width * 4, (line + 1) * item.width * 4),
              ((top + line) * pageWidth + left) * 4
            );
        const image = createImageData2D({
          width: pageWidth,
          height: pageHeight,
          pixels: pixels as Uint8Array<ArrayBuffer>
        });
        const page: AtlasPage = { textures: 0 };
        atlasPages++;
        for (const { item, x: left, y: top } of placed) {
          const key = 'atlas-' + ++atlasCount;
          page.textures++;
          atlasWaiting.set(key, {
            texture: createTexture(image, { x: left, y: top, width: item.width, height: item.height }),
            page
          });
          item.resolve(key);
        }
      }
    };
    // A page is made once no label in flight has yet to give its words, or after ATLAS_WAIT_FRAMES frames, whichever
    // is first (the frames are counted by waitAtlas, as each frame is drawn).
    const scheduleAtlas = (): void => {
      if (atlasQueue.length === 0 || atlasInFlight !== 0 || atlasSoon) return;
      atlasSoon = true;
      queueMicrotask(packAtlas);
    };
    const waitAtlas = (): void => {
      if (atlasQueue.length !== 0 && ++atlasWaited >= ATLAS_WAIT_FRAMES) packAtlas();
    };
    /** The key of a texture of these pixels on a shared page, once the words drawn with them are packed. */
    const placeOnAtlas = (width: number, height: number, pixels: Uint8Array): Promise<string> =>
      new Promise(resolve => {
        atlasQueue.push({ width, height, pixels, resolve });
        scheduleAtlas();
      });
    async function createAtlasLabel(options: BrowserGameLabelCreateOptions = {}): Promise<BrowserGameAtlasLabel> {
      if (options === null || typeof options !== 'object') throw invalid();
      const { scope: owner = scope, ...given } = options;
      if (owner === null || typeof owner !== 'object') throw invalid();
      textCache ??= import('./text.js').then(
        text =>
          (currentTextCache = createTextRasterCache(engine.assets, {
            provider: text.createCanvasTextRasterProvider(
              { compatibility: 'game-labels', ...(scheduleTextWork === undefined ? {} : { schedule: scheduleTextWork }) }
            )
          }))
      );
      const cache = await textCache;
      const display = owner.use(new Sprite());
      let now: Required<BrowserGameLabelOptions> = {
        text: '',
        fontFamily: 'sans-serif',
        fontSize: 24,
        fontWeight: 400,
        italic: false,
        lineHeight: 0,
        color: 0xffffff,
        strokeWidth: 0,
        strokeColor: 0,
        locale: 'en',
        direction: 'ltr'
      };
      let bounds: BrowserGameAtlasLabel['bounds'] = Object.freeze({ x: 0, y: 0, width: 0, height: 0 }),
        picture: Bitmap | undefined,
        held: AssetLease<Texture> | undefined,
        holder: AtlasHolder | undefined,
        ready: Promise<void> = Promise.resolve(),
        active = true,
        disposed = false,
        generation = 0,
        running: Promise<void> | undefined,
        asked = 0;
      const current = (epoch: number): boolean => active && !disposed && !display.isDisposed && generation === epoch;
      const forget = (): void => {
        const lease = held;
        held = undefined;
        if (holder !== undefined) atlasHolders.delete(holder);
        holder = undefined;
        if (picture !== undefined && !picture.isDisposed) picture.dispose();
        picture = undefined;
        if (lease !== undefined) {
          atlasLabels--;
          lease.release();
        }
      };
      /** The lease of a placed texture, for the label's scope; the key is given back whatever happens. */
      const lease = async (key: string): Promise<AssetLease<Texture>> => {
        try {
          return owner.use(await engine.assets.acquire(createAssetRef(atlasType, key), { signal: owner.signal }));
        } finally {
          dropAtlasKey(key);
        }
      };
      const draw = async (epoch: number): Promise<void> => {
        let entered = false,
          flying = true;
        const land = (): void => {
          if (!flying) return;
          flying = false;
          atlasInFlight--;
          scheduleAtlas();
        };
        atlasInFlight++;
        try {
          if (!current(epoch)) return;
          entered = await enterAtlasLane();
          if (!entered || !current(epoch)) return;
          for (let shown = -1; current(epoch) && shown !== asked; ) {
            shown = asked;
            if (!entered) {
              entered = await enterAtlasLane();
              if (!entered || !current(epoch)) return;
            }
            const words = {
              text: now.text,
              fontFamily: now.fontFamily,
              fontSize: now.fontSize,
              fontWeight: now.fontWeight,
              fontStyle: now.italic ? 'italic' : 'normal',
              lineHeight: now.lineHeight > 0 ? now.lineHeight : now.fontSize * 1.25,
              locale: now.locale,
              direction: now.direction,
              density: pixelRatio,
              fillColor: now.color,
              strokeWidth: now.strokeWidth,
              strokeColor: now.strokeColor
            } as const;
            let prepared: Awaited<ReturnType<TextRasterCache['acquire']>>;
            try {
              prepared = await cache.acquire(words, { signal: owner.signal });
            } catch (cause) {
              if (!current(epoch)) return;
              if (!(cause instanceof EgretError) || cause.code !== 'TEXT_CACHE_BUDGET') throw cause;
              // Delivery can precede actor retirement. Retry once after actual settlement, as labels do.
              await cache.whenIdle();
              if (!current(epoch)) return;
              prepared = await cache.acquire(words, { signal: owner.signal });
            }
            let copied: { readonly width: number; readonly height: number; readonly pixels: Uint8Array } | undefined;
            try {
              if (prepared.kind === 'image') {
                const image = prepared.lease.value.imageData;
                copied = { width: image.width, height: image.height, pixels: copyImageData2DPixels(image) };
              }
            } finally {
              if (prepared.kind === 'image') prepared.lease.release();
            }
            const metrics = prepared.metrics,
              raster = metrics.raster;
            let given: AssetLease<Texture> | undefined;
            if (copied !== undefined && raster !== undefined) {
              const placing = placeOnAtlas(copied.width, copied.height, copied.pixels);
              land();
              // The lane is for the cache's drawing: the page is waited for without it.
              if (entered) {
                entered = false;
                leaveAtlasLane();
              }
              const key = await placing;
              if (!current(epoch) || shown !== asked) {
                dropAtlasKey(key);
                continue;
              }
              given = await lease(key);
            }
            if (!current(epoch) || shown !== asked) {
              given?.release();
              continue;
            }
            forget();
            if (given !== undefined && raster !== undefined && copied !== undefined) {
              held = given;
              atlasLabels++;
              const made = owner.use(new Bitmap(given));
              made.x = raster.x;
              made.y = raster.y;
              made.scaleX = raster.logicalWidth / raster.width;
              made.scaleY = raster.logicalHeight / raster.height;
              display.addChild(made);
              picture = made;
              // Packed again with the others when the pages are many: the picture takes the new place.
              const mine: AtlasHolder = {
                ...copied,
                adopt(key) {
                  if (holder !== mine || picture === undefined) return dropAtlasKey(key);
                  void lease(key).then(
                    next => {
                      if (holder !== mine || picture === undefined || picture.isDisposed) return next.release();
                      const before = held;
                      held = next;
                      picture.textureLease = next;
                      before?.release();
                    },
                    () => {}
                  );
                }
              };
              holder = mine;
              atlasHolders.add(mine);
            }
            const box = metrics.contentBounds;
            bounds = Object.freeze({ x: box.x, y: box.y, width: box.width, height: box.height });
          }
        } finally {
          land();
          if (generation === epoch) running = undefined;
          if (entered) leaveAtlasLane();
        }
      };
      const schedule = (): void => {
        if (!active || disposed || running !== undefined) return;
        const epoch = generation;
        const job = Promise.resolve().then(() => draw(epoch));
        running = ready = job;
        void job.catch(cause => {
          if (!disposed) notDrawn(cause);
        });
      };
      const apply = (next: BrowserGameLabelOptions): void => {
        if (next === null || typeof next !== 'object') throw invalid();
        now = { ...now, ...next };
        asked++;
        schedule();
      };
      const live: LiveLabel = { display, end: () => close(), parent: undefined };
      const close = (): void => {
        if (disposed) return;
        disposed = true;
        generation++;
        liveLabels.delete(live);
        owner.signal.removeEventListener('abort', close);
        forget();
        if (!display.isDisposed) display.dispose();
      };
      try {
        apply(given);
        owner.signal.addEventListener('abort', close, { once: true });
        liveLabels.add(live);
      } catch (cause) {
        close();
        throw cause;
      }
      return Object.freeze({
        display,
        get text() {
          return now.text;
        },
        set text(value: string) {
          if (value !== now.text) apply({ text: value });
        },
        get ready() {
          return ready;
        },
        get bounds() {
          return bounds;
        },
        set: apply,
        setRasterActive(next: boolean) {
          if (typeof next !== 'boolean') throw invalid();
          if (active === next || disposed || display.isDisposed) return;
          active = next;
          generation++;
          running = undefined;
          if (active) schedule();
          else {
            forget();
            ready = Promise.resolve();
          }
        },
        dispose: close
      });
    }
    // The two extra text paths load only on first use; ordinary labels keep the existing T1 provider and identity.
    let paragraphLabels: Promise<ReturnType<typeof createGameParagraphs>> | undefined;
    const createParagraphLabel = async (
      options: BrowserGameParagraphLabelCreateOptions
    ): Promise<BrowserGameParagraphLabel> => {
      if (options === null || typeof options !== 'object' || options.width === undefined) throw invalid();
      const { scope: owner = scope, ...given } = options;
      if (!(owner instanceof RuntimeScope) || owner.state !== 'open' || scope.state !== 'open') throw invalid();
      // Capture family candidates before the optional module is loaded.
      if (given.fontFamilies !== undefined && (!Array.isArray(given.fontFamilies) || given.fontFamilies.length > 16))
        throw invalid();
      const captured = given.fontFamilies === undefined ? given : { ...given, fontFamilies: [...given.fontFamilies] };
      paragraphLabels ??= import('./browserGameParagraph.js').then(({ createGameParagraphs }) => {
        if (scope.state !== 'open') throw new EgretError('SCOPE_CLOSED');
        return createGameParagraphs(engine, scheduleTextWork);
      });
      const labels = await paragraphLabels;
      const label = labels.create(owner, captured, Math.max(0.25, Math.min(4, pixelRatio)), notDrawn);
      const close = (): void => {
        liveLabels.delete(live);
        owner.signal.removeEventListener('abort', close);
        label.dispose();
      };
      const live: LiveLabel = { display: label.display, end: close, parent: undefined };
      owner.signal.addEventListener('abort', close, { once: true });
      liveLabels.add(live);
      return Object.freeze({
        display: label.display,
        get text() {
          return label.text;
        },
        set text(value: string) {
          label.text = value;
        },
        get ready() {
          return label.ready;
        },
        get metrics() {
          return label.metrics;
        },
        get bounds() {
          return label.bounds;
        },
        set: label.set,
        dispose: close
      });
    };
    const createGlyphFont = async (options: BrowserGameGlyphFontOptions): Promise<BrowserGameGlyphFont> => {
      if (options === null || typeof options !== 'object') throw invalid();
      const { scope: owner = scope, ...given } = options;
      if (!(owner instanceof RuntimeScope) || owner.state !== 'open' || scope.state !== 'open') throw invalid();
      if (given.fontFamilies !== undefined && (!Array.isArray(given.fontFamilies) || given.fontFamilies.length > 16))
        throw invalid();
      const captured = given.fontFamilies === undefined ? given : { ...given, fontFamilies: [...given.fontFamilies] };
      const { buildGameGlyphFont } = await import('./browserGameGlyphFont.js');
      if (owner.state !== 'open' || scope.state !== 'open') throw new EgretError('SCOPE_CLOSED');
      return buildGameGlyphFont(canvas.ownerDocument, captured, (width, height, pixels) =>
        leasePixels(width, height, pixels, owner)
      );
    };
    const game: BrowserGame = Object.freeze({
      invalidate,
      getStartupTiming: () =>
        Object.freeze({
          backendSelectMs: backendReady - started,
          backendModuleMs: moduleReady - backendReady,
          hostCreateMs: hostCreated - moduleReady,
          engineOpenMs: engineOpened - hostCreated,
          setupMs: ready - engineOpened,
          readyMs: ready - started,
          ...(firstSubmit === undefined ? {} : { firstSubmitMs: firstSubmit - started }),
          ...(webgl2Startup === undefined ? {} : { webgl2: webgl2Startup })
        }),
      backend,
      engine,
      host,
      ...(staticCache === undefined ? {} : { staticLayers: staticCache.api }),
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
      ...(scheduleTextWork === undefined ? {} : { scheduleTextWork }),
      getLabelStatus() {
        sweepLabels();
        return Object.freeze({
          drawing: labelsDrawing,
          queued: labelsWaiting.length + atlasLaneWaiting.length,
          refusals: labelRefusals,
          releasedRasters,
          cache: currentTextCache?.getStatus(),
          atlasLabels,
          atlasPages,
          atlasPending: atlasInFlight + atlasQueue.length
        });
      },
      createAtlasLabel,
      createParagraphLabel,
      createGlyphFont,
      getFrameUsage: () => usage,
      drawFrame,
      async loadTexture(url: string) {
        if (typeof url !== 'string' || url === '') throw invalid();
        return scope.use(await engine.assets.acquire(createAssetRef(imageType, url), { signal: scope.signal }));
      },
      textureFromPixels: (width: number, height: number, pixels: Uint8Array | Uint8ClampedArray) =>
        leasePixels(width, height, pixels),
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
          if (paragraphLabels !== undefined) (await paragraphLabels.catch(() => undefined))?.dispose();
          await engine.dispose();
          await images.close();
        })());
      }
    });
    ready = performance.now();
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
