// SPDX-License-Identifier: Apache-2.0
// The labels of a browser game: text fields drawn through one text cache of the game, labels whose words are packed onto
// shared pages, paragraph labels and glyph fonts. Two lanes draw at a time, and a label whose display is gone is ended
// at the next frame. The game gives the Engine, its scope and the loaders of the optional text modules.
import { EgretError, Scope as RuntimeScope } from '@egret/runtime';
import {
  Bitmap,
  copyImageData2DPixels,
  createAssetRef,
  createAssetType,
  createImageData2D,
  createTexture,
  isTexture,
  Sprite
} from '@egret/engine';
import type { AssetLease, DisplayObject, Engine, Scope, Texture } from '@egret/engine';
import { createTextField } from '@egret/engine/text';
import type { TextField, TextRasterCache } from '@egret/engine/text';
import type { CanvasWorkSchedule } from './browserTextWork.js';
import type {
  BrowserGameParagraphLabel,
  BrowserGameParagraphLabelCreateOptions,
  createGameParagraphs
} from './browserGameParagraph.js';
import type { BrowserGameGlyphFont, BrowserGameGlyphFontOptions, buildGameGlyphFont } from './browserGameGlyphFont.js';

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
/** What the labels tell the game: words not drawn, and a text cache nearly full. */
interface GameLabelWarning {
  readonly code: 'LABEL_NOT_DRAWN' | 'LABEL_CACHE_NEAR_LIMIT';
  readonly message: string;
  readonly cause?: unknown;
}
/** What the labels of a game are made from. The game loads the optional text modules; the labels never do. */
export interface GameLabelsContext {
  readonly engine: Engine;
  /** The game's scope: labels belong to it unless given another, and its end ends them. */
  readonly scope: Scope;
  readonly pixelRatio: number;
  readonly scheduleTextWork: CanvasWorkSchedule | undefined;
  /** The page whose fonts glyph fonts are drawn with, as it is when one is asked for. */
  readonly page: () => Document;
  readonly warn: (warning: GameLabelWarning) => void;
  readonly leasePixels: (
    width: number,
    height: number,
    pixels: Uint8Array | Uint8ClampedArray,
    owner: Scope
  ) => Promise<AssetLease<Texture>>;
  /** Opens the game's one text cache with the page's rasterizer, giving it to `adopt` as soon as it is made. */
  readonly openTextCache: (adopt: (cache: TextRasterCache) => void) => Promise<TextRasterCache>;
  readonly loadParagraphs: () => Promise<{ readonly createGameParagraphs: typeof createGameParagraphs }>;
  readonly loadGlyphFont: () => Promise<{ readonly buildGameGlyphFont: typeof buildGameGlyphFont }>;
}
/** The labels of a game, and what its frames and its end do with them. */
export interface GameLabels {
  createLabel(options?: BrowserGameLabelCreateOptions): Promise<BrowserGameLabel>;
  createAtlasLabel(options?: BrowserGameLabelCreateOptions): Promise<BrowserGameAtlasLabel>;
  createParagraphLabel(options: BrowserGameParagraphLabelCreateOptions): Promise<BrowserGameParagraphLabel>;
  createGlyphFont(options: BrowserGameGlyphFontOptions): Promise<BrowserGameGlyphFont>;
  /** Ends the labels whose display is gone, and tells of a nearly full cache and of words not drawn. */
  sweep(): void;
  /** Counts a frame for the words that wait for their shared page. */
  waitAtlas(): void;
  /** What the labels hold now, after a sweep. */
  status(): Readonly<{
    drawing: number;
    queued: number;
    refusals: number;
    releasedRasters: number;
    cache: ReturnType<TextRasterCache['getStatus']> | undefined;
    atlasLabels: number;
    atlasPages: number;
    atlasPending: number;
  }>;
  /** After the game's scope has ended: the text cache and the paragraph labels end. */
  close(): Promise<void>;
}
const invalid = (): EgretError => new EgretError('BROWSER_GAME_OPTIONS_INVALID');

export function createGameLabels(context: GameLabelsContext): GameLabels {
  const { engine, scope, pixelRatio, scheduleTextWork, page, warn, openTextCache, loadParagraphs, loadGlyphFont } =
    context;
  const leasePixels = context.leasePixels;
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
    const share = Math.max(status.callerLeaseSlots / 128, (status.currentGenerations + status.retiredGenerations) / 64);
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
    textCache ??= openTextCache(cache => (currentTextCache = cache));
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
    textCache ??= openTextCache(cache => (currentTextCache = cache));
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
    paragraphLabels ??= loadParagraphs().then(({ createGameParagraphs }) => {
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
    const { buildGameGlyphFont } = await loadGlyphFont();
    if (owner.state !== 'open' || scope.state !== 'open') throw new EgretError('SCOPE_CLOSED');
    return buildGameGlyphFont(page(), captured, (width, height, pixels) => leasePixels(width, height, pixels, owner));
  };

  return {
    createLabel,
    createAtlasLabel,
    createParagraphLabel,
    createGlyphFont,
    sweep: sweepLabels,
    waitAtlas,
    status() {
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
    async close() {
      if (textCache !== undefined) {
        const cache = await textCache.catch(() => undefined);
        cache?.dispose();
        await cache?.whenIdle();
      }
      if (paragraphLabels !== undefined) (await paragraphLabels.catch(() => undefined))?.dispose();
    }
  };
}
