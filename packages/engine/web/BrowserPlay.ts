// SPDX-License-Identifier: Apache-2.0
// A whole small game from one call. `play` makes the canvas and fits it to the page, runs the game's setup before
// the first update, and gives the parts most games write for themselves: keys and a pointer to ask each frame,
// sound effects made in code, overlap tests, timers, text that can be centred, tweens, bursts of particles, a
// shake, a flash and a hit stop. Everything is built from the public entries, which stay there for a game that
// outgrows this one.
import { EgretError } from '@egret/runtime';
import { Sprite, animate } from '@egret/engine';
import type { DisplayObject, Engine, Graphics, Motion, Scope } from '@egret/engine';
import { createRandom, encodeWav } from '@egret/engine/kit';
import type { Random } from '@egret/engine/kit';
import { createBrowserAudio } from './audio.js';
import { createBrowserGame } from './game.js';
import type { BrowserGame, BrowserGameBackend, BrowserGameLabel } from './game.js';
import { SFX_PRESETS, isSfxRecipe, synthesizeSfx } from './playSfx.js';
import type { SfxRecipe } from './playSfx.js';

export interface PlayOptions {
  /** The size of the stage, in the game's own units: whole numbers above 0. The canvas is scaled to fit. */
  readonly width: number;
  readonly height: number;
  /** What a frame is cleared to. Black unless given. */
  readonly background?: number;
  /** Where the canvas goes. Without it the game fills the window. */
  readonly parent?: HTMLElement;
  /** A canvas of the page to draw on, as it is placed there. Without it one is made and fitted. */
  readonly canvas?: HTMLCanvasElement;
  /** Builds the game. Updates begin when it has returned, or when the promise it returns has resolved. */
  readonly setup?: (game: PlayGame) => void | Promise<void>;
  /** One step of the game, with the seconds since the step before. */
  readonly update?: (seconds: number, game: PlayGame) => void;
  /** Told of what stopped the game. Without it the failure is thrown where the console shows it. */
  readonly onError?: (error: unknown) => void;
  /** The seed of `game.random`. A different one each time unless given. */
  readonly seed?: number | string;
  /** `'auto'` unless given. */
  readonly backend?: 'auto' | BrowserGameBackend;
  /** Under what name `game.save` keeps its values in the page's storage. The page's path unless given. */
  readonly saveKey?: string;
}

export interface PlayTextOptions {
  readonly x?: number;
  readonly y?: number;
  /** The height of the letters, in stage units. 24 unless given. */
  readonly size?: number;
  /** White unless given. */
  readonly color?: number;
  /** Which part of the words `x` is: their left end (the default), their middle or their right end. */
  readonly align?: 'left' | 'center' | 'right';
  readonly bold?: boolean;
  /**
   * Where the text goes. `'ui'` (the default) stays put over the game; `'world'` moves with `game.view` and the
   * shake; a sprite makes the text its child, so the two move, turn, fade and go together, and `x` and `y` are
   * then measured from the sprite's own origin.
   */
  readonly layer?: 'ui' | 'world' | Sprite;
  /** Which part of the words `y` is: their top (the default) or their middle. */
  readonly baseline?: 'top' | 'middle';
  /** The language of the words, as `'zh'` or `'en'`. Chosen from the words unless given. */
  readonly locale?: string;
}
/** A line of text: a sprite to place, fade, tween and remove like any other, with words that can be changed. */
export class PlayText extends Sprite {
  #text: string;
  #changed: (text: string) => void;
  /** @internal */
  public constructor(text: string, changed: (text: string) => void) {
    super();
    this.#text = text;
    this.#changed = changed;
  }
  public get text(): string {
    return this.#text;
  }
  /** Anything is taken and shown as its string, so a score can be given as the number it is. */
  public set text(value: string | number) {
    const next = String(value);
    if (next === this.#text) return;
    this.#text = next;
    this.#changed(next);
  }
}

export interface PlayKeys {
  /** Whether any of the keys is held. A key is `'left'`, `'right'`, `'up'`, `'down'`, `'space'`, `'enter'`, `'escape'`, `'shift'`, a letter, a digit, or a `KeyboardEvent.code`. */
  down(...keys: string[]): boolean;
  /** Whether any of the keys went down since the last update. */
  pressed(...keys: string[]): boolean;
  /** Whether any of the keys came up since the last update. */
  released(...keys: string[]): boolean;
  /** The arrows and WASD as a direction: x and y from -1 to 1, y down, of length 1 at most. */
  axis(): { x: number; y: number };
}
export interface PlayPointer {
  /** Where the mouse, pen or finger is, on the stage. It follows the mouse whether or not a button is held. */
  readonly x: number;
  readonly y: number;
  /** Whether a button or a finger is down. */
  readonly down: boolean;
  /** Whether it went down, or came up, since the last update. */
  readonly pressed: boolean;
  readonly released: boolean;
  /** The way of a swipe that ended since the last update. */
  readonly swipe: 'left' | 'right' | 'up' | 'down' | undefined;
  /** Whether the pointer is over what a sprite draws, taken as an upright box. */
  over(node: DisplayObject): boolean;
}
/** A tween of `game.tween`: a motion that can be waited for. */
export type PlayMotion<T extends object> = Motion<T> & {
  /** Resolves when the motion has finished or been stopped: `await game.tween(s).to({ x: 9 }, 0.2).done`. */
  readonly done: Promise<void>;
};
export interface PlayButtonOptions {
  readonly x: number;
  readonly y: number;
  /** 160 by 44 unless given. */
  readonly width?: number;
  readonly height?: number;
  readonly color?: number;
  readonly textColor?: number;
  /** The height of the letters; 0.45 of the button's height unless given. */
  readonly size?: number;
  /** `game.ui` unless given. */
  readonly layer?: Sprite;
}
/** A button: a sprite whose middle is at (x, y), with its words in `label`. */
export type PlayButton = Sprite & { readonly label: PlayText };
export interface PlaySfx {
  /** Plays an effect by name: one of `names`. `pitch` is 1 as written, 2 an octave up. */
  play(name: string, options?: { readonly volume?: number; readonly pitch?: number }): void;
  /** Adds an effect, or replaces one. It can be played from the next update on. */
  define(name: string, recipe: SfxRecipe): void;
  /** The names that can be played. */
  readonly names: readonly string[];
  /** 0 to 1, for every effect. */
  volume: number;
  muted: boolean;
}
export interface PlayBurstOptions {
  readonly color?: number;
  /** How many pieces; 12 unless given. */
  readonly count?: number;
  /** How fast they fly, in units a second; 160 unless given. */
  readonly speed?: number;
  /** How long they last, in seconds; 0.5 unless given. */
  readonly life?: number;
  /** Their radius; 3 unless given. */
  readonly size?: number;
  /** How hard they fall, in units a second each second; 0 unless given. */
  readonly gravity?: number;
}

/**
 * The listener the Engine is given for a tap. A listener of the Engine runs to its end and returns nothing, and one
 * that returns a promise is refused, which ends pointer input; so what the game's function returns is not handed on.
 * When it is a promise, as an `async` function returns, its failure is told as the function's own would be.
 */
export function tapListener(callback: () => unknown, fail: (cause: unknown) => void): () => void {
  return () => {
    try {
      const result = callback() as { then?: unknown } | null | undefined;
      if (result !== null && result !== undefined && typeof result.then === 'function')
        (result as PromiseLike<unknown>).then(undefined, fail);
    } catch (cause) {
      fail(cause);
    }
  };
}

export interface PlayGame {
  readonly width: number;
  readonly height: number;
  /** Seconds of play so far: it stands still while the game is paused or stopped by `hitStop`. */
  readonly time: number;
  /** The layer the game is drawn in. It moves with `view` and shakes. */
  readonly world: Sprite;
  /** A layer over the world that stays put: scores, buttons, messages. */
  readonly ui: Sprite;
  /** Which part of the world is seen: the world's point (`view.x`, `view.y`) is drawn at the stage's corner. */
  readonly view: { x: number; y: number };
  readonly keys: PlayKeys;
  readonly pointer: PlayPointer;
  readonly sfx: PlaySfx;
  /** Random numbers that repeat for the same `seed`: `int(1, 6)`, `range(0, 1)`, `chance(0.25)`, `pick(list)`. */
  readonly random: Random;
  /** 1 as played; 0.5 is slow motion. */
  timeScale: number;
  /** A new sprite in the world (or in `layer`), with what `draw` draws in it. */
  sprite(draw?: (graphics: Graphics) => void, layer?: Sprite): Sprite;
  /** A filled rectangle whose middle is at (x, y), in the world or in `layer`. */
  rect(x: number, y: number, width: number, height: number, color: number, layer?: Sprite): Sprite;
  /** A filled circle whose middle is at (x, y), in the world or in `layer`. */
  circle(x: number, y: number, radius: number, color: number, layer?: Sprite): Sprite;
  /** A button with words on it, in the `ui` layer. `onTap` is called when it is tapped or clicked. */
  button(words: string, options: PlayButtonOptions, onTap: () => void): PlayButton;
  /** Puts a sprite in front of the others of its layer. Sprites are otherwise drawn in the order they were made. */
  toFront(node: DisplayObject): void;
  /** A line of text. It appears a moment after it is made; nothing has to wait for it. */
  text(text: string | number, options?: PlayTextOptions): PlayText;
  /** Takes a sprite off the stage and ends it. */
  remove(node: DisplayObject): void;
  /** Calls a function when the sprite is tapped or clicked. */
  onTap(node: DisplayObject, callback: () => void): void;
  /** Whether what two sprites draw overlaps, taken as upright boxes. `shrink` takes that much off every side of both. */
  overlaps(a: DisplayObject, b: DisplayObject, shrink?: number): boolean;
  /** The first of the sprites that overlaps `a`, or undefined. */
  hits<T extends DisplayObject>(a: DisplayObject, others: readonly T[], shrink?: number): T | undefined;
  /** Every one of the sprites that overlaps `a`. */
  hitsAll<T extends DisplayObject>(a: DisplayObject, others: readonly T[], shrink?: number): T[];
  /**
   * How far to move `a` so that it no longer overlaps `b`, by the shorter way out: `{ x, y }`, one of them 0, or
   * undefined when they do not overlap. A `y` below 0 means `a` was pushed up, onto `b`.
   */
  pushOut(a: DisplayObject, b: DisplayObject): { x: number; y: number } | undefined;
  /** Whether the middles of what two sprites draw are within `distance` of each other: a test of circles. */
  near(a: DisplayObject, b: DisplayObject, distance: number): boolean;
  /** Moves numbers of an object over time: `game.tween(s).to({ x: 100, alpha: 0 }, 0.3, 'quadOut')`. It starts by itself. */
  tween<T extends object>(target: T): PlayMotion<T>;
  /** Calls a function once, after seconds of play. The function returned calls it off. */
  after(seconds: number, callback: () => void): () => void;
  /** A promise that resolves after seconds of play: `await game.wait(0.3)`. */
  wait(seconds: number): Promise<void>;
  /** Calls a function again and again, seconds of play apart. The function returned ends it. */
  every(seconds: number, callback: () => void): () => void;
  /** Shakes the world by up to `amount` units for `seconds`. */
  shake(amount?: number, seconds?: number): void;
  /** Covers the stage with a colour that fades away over `seconds`. */
  flash(color?: number, seconds?: number): void;
  /** Stops play for a moment, as a hard hit does: no updates and no timers for `seconds`. */
  hitStop(seconds?: number): void;
  /** Throws pieces out from a point of the world. */
  burst(x: number, y: number, options?: PlayBurstOptions): void;
  /** Keeps a value in the page's storage, as JSON, and reads one back. */
  save(key: string, value: unknown): void;
  load<T>(key: string, fallback: T): T;
  /** Stops updates and timers; `update` is not called while paused. The keys and the pointer can still be asked from a tap or a timer of the page. */
  pause(): void;
  resume(): void;
  readonly paused: boolean;
  /**
   * Starts the game again: everything in the world and the `ui` layer is removed, timers and tweens are called
   * off, and `setup` runs again. Updates begin when it has finished.
   */
  restart(): Promise<void>;
  /** The game `play` is built on: its Engine, scope, loop and input, for what this entry does not cover. */
  readonly browser: BrowserGame;
  readonly engine: Engine;
  readonly scope: Scope;
  readonly canvas: HTMLCanvasElement;
  /** Ends the game and takes away the canvas `play` made. */
  dispose(): Promise<void>;
}

const invalid = (why: string): EgretError => new EgretError('PLAY_OPTIONS_INVALID', { cause: new Error(why) });
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const colour = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff;
const KEY_NAMES: Readonly<Record<string, string>> = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  space: 'Space',
  enter: 'Enter',
  escape: 'Escape',
  esc: 'Escape',
  shift: 'ShiftLeft',
  tab: 'Tab'
};
/** Keys a game uses that would otherwise scroll or move about the page. */
const KEPT_FROM_PAGE = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Tab']);
function codeOf(key: string): string {
  const named = KEY_NAMES[key.toLowerCase()];
  if (named !== undefined) return named;
  if (/^[a-zA-Z]$/.test(key)) return 'Key' + key.toUpperCase();
  if (/^[0-9]$/.test(key)) return 'Digit' + key;
  return key;
}
const SWIPE = 24;
const PIECES = 256;

/** Starts a game in the page. See the guide `play.md`. */
export async function play(options: PlayOptions): Promise<PlayGame> {
  if (options === null || typeof options !== 'object') throw invalid('play takes an object of options');
  const { width, height, background = 0, setup, update, onError } = options;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0)
    throw invalid('width and height are whole numbers above 0');
  if (!colour(background)) throw invalid('background is a colour from 0 to 0xffffff');
  if (setup !== undefined && typeof setup !== 'function') throw invalid('setup is a function');
  if (update !== undefined && typeof update !== 'function') throw invalid('update is a function');
  if (onError !== undefined && typeof onError !== 'function') throw invalid('onError is a function');
  const page = options.canvas?.ownerDocument ?? options.parent?.ownerDocument ?? globalThis.document;
  if (page === undefined) throw invalid('play needs a page');
  const win = page.defaultView ?? (globalThis as unknown as Window);

  // The canvas: the caller's as it stands, or one of our own in a holder it is fitted into.
  let holder: HTMLElement | undefined,
    canvas = options.canvas;
  if (canvas === undefined) {
    holder = page.createElement('div');
    const parent = options.parent;
    holder.style.cssText =
      parent === undefined
        ? 'position:fixed;left:0;top:0;width:100%;height:100%;overflow:hidden;background:#000'
        : 'position:relative;width:100%;overflow:hidden;background:#000;' +
          // A parent with no height of its own is given the stage's shape.
          (parent.clientHeight > 0 ? 'height:100%' : `aspect-ratio:${width}/${height}`);
    canvas = page.createElement('canvas');
    canvas.style.cssText = 'display:block;touch-action:none;outline:none';
    holder.appendChild(canvas);
    (parent ?? page.body).appendChild(holder);
  }
  const surface = canvas;

  let api: PlayGame | undefined;
  const browser = await createBrowserGame({
    canvas: surface,
    width,
    height,
    clearColor: background,
    autoStart: false,
    keyboard: false,
    ...(holder === undefined ? {} : { fit: 'contain' as const, fitTo: holder }),
    ...(options.backend === undefined ? {} : { backend: options.backend }),
    update: seconds => step(seconds),
    ...(onError === undefined ? {} : { onError })
  }).catch((cause: unknown) => {
    holder?.remove();
    throw cause;
  });
  const { engine, scope, stage } = browser;
  const layer = (): Sprite => stage.addChild(scope.use(new Sprite()));
  const world = layer(),
    effects = layer(),
    ui = layer(),
    cover = layer();
  const view = { x: 0, y: 0 };
  const random = createRandom(options.seed ?? Date.now() + ':' + Math.random());

  // Keys: a set of what is held, and what changed since the last update.
  const held = new Set<string>(),
    wentDown = new Set<string>(),
    cameUp = new Set<string>();
  const typing = (target: EventTarget | null): boolean => {
    const element = target as { tagName?: string; isContentEditable?: boolean } | null;
    return (
      element?.isContentEditable === true ||
      element?.tagName === 'INPUT' ||
      element?.tagName === 'TEXTAREA' ||
      element?.tagName === 'SELECT'
    );
  };
  const keyDown = (event: KeyboardEvent): void => {
    if (typing(event.target)) return;
    if (KEPT_FROM_PAGE.has(event.code)) event.preventDefault();
    if (event.repeat || held.has(event.code)) return;
    held.add(event.code);
    wentDown.add(event.code);
  };
  const keyUp = (event: KeyboardEvent): void => {
    if (held.delete(event.code)) cameUp.add(event.code);
  };
  const letGo = (): void => {
    for (const code of held) cameUp.add(code);
    held.clear();
    point.down = false;
  };
  const any = (set: Set<string>, keys: readonly string[]): boolean => keys.some(key => set.has(codeOf(String(key))));
  const keys: PlayKeys = {
    down: (...names) => any(held, names),
    pressed: (...names) => any(wentDown, names),
    released: (...names) => any(cameUp, names),
    axis() {
      const x = (any(held, ['right', 'd']) ? 1 : 0) - (any(held, ['left', 'a']) ? 1 : 0),
        y = (any(held, ['down', 's']) ? 1 : 0) - (any(held, ['up', 'w']) ? 1 : 0);
      const length = x !== 0 && y !== 0 ? Math.SQRT1_2 : 1;
      return { x: x * length, y: y * length };
    }
  };

  // The pointer: where it is, on the stage, and what changed since the last update.
  const point = {
    x: width / 2,
    y: height / 2,
    down: false,
    pressed: false,
    released: false,
    swipe: undefined as PlayPointer['swipe'],
    fromX: 0,
    fromY: 0
  };
  const place = (event: PointerEvent): void => {
    const at = browser.toStage(event.clientX, event.clientY);
    if (finite(at.x) && finite(at.y)) {
      point.x = at.x;
      point.y = at.y;
    }
  };
  const pointerDown = (event: PointerEvent): void => {
    place(event);
    point.down = true;
    point.pressed = true;
    point.fromX = point.x;
    point.fromY = point.y;
    // Keys reach the page only once it has been clicked, where the game sits in a frame.
    win.focus?.();
  };
  const pointerUp = (event: PointerEvent): void => {
    place(event);
    if (!point.down) return;
    point.down = false;
    point.released = true;
    const dx = point.x - point.fromX,
      dy = point.y - point.fromY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE)
      point.swipe = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  };
  const pointerCancel = (): void => {
    point.down = false;
  };
  const pointer: PlayPointer = {
    get x() {
      return point.x;
    },
    get y() {
      return point.y;
    },
    get down() {
      return point.down;
    },
    get pressed() {
      return point.pressed;
    },
    get released() {
      return point.released;
    },
    get swipe() {
      return point.swipe;
    },
    over(node) {
      if (!seen(node)) return false;
      const box = boxOf(node);
      return (
        box !== undefined && point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom
      );
    }
  };
  const listening: [EventTarget, string, EventListener][] = [
    [win, 'keydown', keyDown as EventListener],
    [win, 'keyup', keyUp as EventListener],
    [win, 'blur', letGo],
    [surface, 'pointerdown', pointerDown as EventListener],
    [win, 'pointermove', place as EventListener],
    [win, 'pointerup', pointerUp as EventListener],
    [win, 'pointercancel', pointerCancel]
  ];
  for (const [target, type, listener] of listening) target.addEventListener(type, listener, { passive: false });

  // Sound: every effect is made and decoded before the game is set up, so the first one plays at once.
  const audio = scope.use(createBrowserAudio({ limiter: true }));
  type Sound = Awaited<ReturnType<typeof audio.mixer.decode>>;
  const sounds = new Map<string, Sound>();
  const RATE = 22050;
  const make = async (name: string, recipe: SfxRecipe): Promise<void> => {
    try {
      sounds.set(name, await audio.mixer.decode(encodeWav([synthesizeSfx(recipe, RATE)], RATE)));
    } catch {
      // A page without sound still plays the game.
    }
  };
  const names = new Set(Object.keys(SFX_PRESETS));
  let volume = 1,
    muted = false;
  const sfx: PlaySfx = {
    play(name, given = {}) {
      if (!names.has(name))
        throw new EgretError('PLAY_SFX_UNKNOWN', {
          cause: new Error(`"${String(name)}" is not one of: ${[...names].join(', ')}`)
        });
      const sound = sounds.get(name);
      if (sound === undefined || muted) return;
      const loud = Math.max(0, Math.min(1, (finite(given.volume) ? given.volume : 1) * volume)),
        rate = Math.max(0.25, Math.min(4, finite(given.pitch) ? given.pitch : 1));
      try {
        audio.mixer.play(sound, { volume: loud, rate, maxInstances: 6 });
      } catch {
        // Sound never stops a game.
      }
    },
    define(name, recipe) {
      if (typeof name !== 'string' || name === '' || !isSfxRecipe(recipe))
        throw invalid('an effect is a name and one tone, or a list of tones, each with `from` and `seconds`');
      names.add(name);
      void make(name, recipe);
    },
    get names() {
      return [...names];
    },
    get volume() {
      return volume;
    },
    set volume(value: number) {
      if (finite(value)) volume = Math.max(0, Math.min(1, value));
    },
    get muted() {
      return muted;
    },
    set muted(value: boolean) {
      muted = Boolean(value);
    }
  };

  // Timers, in seconds of play.
  interface Timer {
    at: number;
    readonly every: number;
    readonly callback: () => void;
    live: boolean;
  }
  let timers: Timer[] = [];
  const timer = (seconds: number, callback: () => void, repeat: boolean): (() => void) => {
    if (!finite(seconds) || seconds < 0 || typeof callback !== 'function')
      throw invalid('a timer is a number of seconds, 0 or more, and a function');
    // A repeat of no length would never let the frame end.
    const entry: Timer = { at: time + seconds, every: repeat ? Math.max(seconds, 1 / 240) : 0, callback, live: true };
    timers.push(entry);
    return () => {
      entry.live = false;
    };
  };

  // Tweens start by themselves at the next update, so a chain is written without a last `.start()`. Each is
  // watched until it has finished or been stopped, which is when its `done` resolves.
  let waiting: Motion<object>[] = [];
  let moving: { readonly motion: Motion<object>; readonly settle: () => void }[] = [];

  // Pieces of a burst: a pool of small sprites, drawn again only when their colour or size changes.
  interface Piece {
    readonly node: Sprite;
    vx: number;
    vy: number;
    gravity: number;
    life: number;
    span: number;
    drawn: string;
  }
  const pieces: Piece[] = [];
  let nextPiece = 0;

  // Text.
  const removers = new WeakMap<object, () => void>();
  const text = (given: string | number, o: PlayTextOptions = {}): PlayText => {
    if (o === null || typeof o !== 'object') throw invalid('the options of a text are an object');
    const { size = 24, color = 0xffffff, align = 'left', bold = false } = o;
    if (!finite(size) || size <= 0 || !colour(color)) throw invalid('a text has a size above 0 and a colour');
    if (align !== 'left' && align !== 'center' && align !== 'right')
      throw invalid("align is 'left', 'center' or 'right'");
    let label: BrowserGameLabel | undefined,
      gone = false;
    const settle = (): void => {
      if (label === undefined || gone) return;
      const made = label;
      made.ready.then(
        () => {
          if (gone) return;
          made.display.x = align === 'center' ? -made.display.width / 2 : align === 'right' ? -made.display.width : 0;
          made.display.y = o.baseline === 'middle' ? -made.display.height / 2 : 0;
          made.display.visible = true;
        },
        () => {}
      );
    };
    const node = scope.use(
      new PlayText(String(given), next => {
        if (label === undefined) return;
        label.text = next;
        settle();
      })
    );
    node.x = finite(o.x) ? o.x : 0;
    node.y = finite(o.y) ? o.y : 0;
    if (o.baseline !== undefined && o.baseline !== 'top' && o.baseline !== 'middle')
      throw invalid("baseline is 'top' or 'middle'");
    const into = o.layer === undefined || o.layer === 'ui' ? ui : o.layer === 'world' ? world : o.layer;
    if (!(into instanceof Sprite) || into.isDisposed) throw invalid("layer is 'ui', 'world' or a sprite");
    into.addChild(node);
    const words = node.text;
    browser
      .createLabel({
        text: words,
        fontSize: size,
        color,
        fontWeight: bold ? 700 : 400,
        locale: o.locale ?? (/[぀-ヿ㐀-鿿가-힯]/.test(words) ? 'zh' : 'en')
      })
      .then(
        made => {
          if (gone || node.isDisposed) {
            made.dispose();
            return;
          }
          label = made;
          // Hidden until it has been measured, so centred words never show at the wrong place first.
          made.display.visible = false;
          node.addChild(made.display);
          if (node.text !== words) made.text = node.text;
          settle();
        },
        () => {}
      );
    removers.set(node, () => {
      gone = true;
      label?.dispose();
    });
    return node;
  };

  // Overlap, as upright boxes on the stage.
  interface Box {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }
  const boxOf = (node: DisplayObject): Box | undefined => {
    const own = node.getBounds();
    if (!(own.width > 0) || !(own.height > 0)) return undefined;
    let left = Infinity,
      top = Infinity,
      right = -Infinity,
      bottom = -Infinity;
    for (const [x, y] of [
      [own.x, own.y],
      [own.x + own.width, own.y],
      [own.x, own.y + own.height],
      [own.x + own.width, own.y + own.height]
    ] as const) {
      const at = node.localToGlobal(x, y);
      left = Math.min(left, at.x);
      right = Math.max(right, at.x);
      top = Math.min(top, at.y);
      bottom = Math.max(bottom, at.y);
    }
    return { left, top, right, bottom };
  };
  const meet = (a: Box, b: Box, shrink: number): boolean =>
    a.left + shrink < b.right - shrink &&
    b.left + shrink < a.right - shrink &&
    a.top + shrink < b.bottom - shrink &&
    b.top + shrink < a.bottom - shrink;
  const seen = (node: DisplayObject): boolean => !node.isDisposed && node.visible && node.parent !== undefined;

  // The step of every frame.
  let time = 0,
    timeScale = 1,
    paused = false,
    stopped = 0,
    shakeAmount = 0,
    shakeLeft = 0,
    shakeSpan = 1,
    flashLeft = 0,
    flashSpan = 1,
    disposed = false;
  const endFrame = (): void => {
    wentDown.clear();
    cameUp.clear();
    point.pressed = false;
    point.released = false;
    point.swipe = undefined;
  };
  // What the function of a tap threw, now or when its promise failed: it stops the game at the next step, as what
  // `update` throws does, and is told the same way.
  let failure: { readonly cause: unknown } | undefined;
  const fail = (cause: unknown): void => {
    failure ??= { cause };
  };
  function step(real: number): void {
    if (failure !== undefined) {
      const { cause } = failure;
      failure = undefined;
      throw cause;
    }
    if (api === undefined || paused) {
      endFrame();
      return;
    }
    let seconds = real * timeScale;
    if (stopped > 0) {
      stopped -= real;
      seconds = 0;
    }
    if (seconds > 0) {
      time += seconds;
      if (waiting.length > 0) {
        const starting = waiting;
        waiting = [];
        for (const motion of starting) if (motion.state === 'idle') motion.start();
      }
      if (moving.length > 0)
        moving = moving.filter(entry => {
          if (entry.motion.state !== 'finished' && entry.motion.state !== 'stopped') return true;
          entry.settle();
          return false;
        });
      if (timers.length > 0) {
        // A timer may add or call off timers; those added now wait for the next step.
        const due = timers;
        timers = [];
        for (const entry of due) {
          if (!entry.live) continue;
          if (entry.at <= time) {
            if (entry.every > 0) entry.at = Math.max(entry.at + entry.every, time);
            else entry.live = false;
            entry.callback();
          }
          if (entry.live) timers.push(entry);
        }
      }
      update?.(seconds, api);
      for (const piece of pieces) {
        if (piece.life <= 0) continue;
        piece.life -= seconds;
        if (piece.life <= 0) {
          piece.node.visible = false;
          continue;
        }
        piece.vy += piece.gravity * seconds;
        piece.node.x += piece.vx * seconds;
        piece.node.y += piece.vy * seconds;
        const left = piece.life / piece.span;
        piece.node.alpha = left;
        piece.node.scaleX = piece.node.scaleY = 0.4 + 0.6 * left;
      }
    }
    // The shake and the flash run on the clock of the wall, so a hit stop does not freeze them.
    let dx = 0,
      dy = 0;
    if (shakeLeft > 0) {
      shakeLeft -= real;
      const strength = shakeAmount * Math.max(0, shakeLeft / shakeSpan);
      dx = (Math.random() * 2 - 1) * strength;
      dy = (Math.random() * 2 - 1) * strength;
    }
    world.x = effects.x = dx - view.x;
    world.y = effects.y = dy - view.y;
    if (flashLeft > 0) {
      flashLeft -= real;
      cover.alpha = Math.max(0, flashLeft / flashSpan) * 0.85;
      if (flashLeft <= 0) cover.visible = false;
    }
    endFrame();
  }

  const storage = ((): Storage | undefined => {
    try {
      return win.localStorage;
    } catch {
      return undefined;
    }
  })();
  const kept = new Map<string, string>();
  const saveKey = (key: string): string =>
    'egret.play:' + (options.saveKey ?? win.location?.pathname ?? '') + ':' + key;

  const game: PlayGame = {
    width,
    height,
    get time() {
      return time;
    },
    world,
    ui,
    view,
    keys,
    pointer,
    sfx,
    random,
    get timeScale() {
      return timeScale;
    },
    set timeScale(value: number) {
      if (finite(value) && value >= 0) timeScale = Math.min(value, 8);
    },
    sprite(draw, into = world) {
      const node = scope.use(new Sprite());
      if (draw !== undefined) draw(node.graphics);
      into.addChild(node);
      return node;
    },
    rect(x, y, w, h, color, into) {
      if (![x, y, w, h].every(finite) || w < 0 || h < 0 || !colour(color))
        throw invalid('rect takes x, y, a width, a height and a colour');
      if (into !== undefined && !(into instanceof Sprite)) throw invalid('the layer of a rect is a sprite');
      const node = game.sprite(g => {
        g.beginFill(color)
          .drawRect(-w / 2, -h / 2, w, h)
          .endFill();
      }, into);
      node.x = x;
      node.y = y;
      return node;
    },
    circle(x, y, radius, color, into) {
      if (![x, y, radius].every(finite) || radius < 0 || !colour(color))
        throw invalid('circle takes x, y, a radius and a colour');
      if (into !== undefined && !(into instanceof Sprite)) throw invalid('the layer of a circle is a sprite');
      const node = game.sprite(g => {
        g.beginFill(color).drawCircle(0, 0, radius).endFill();
      }, into);
      node.x = x;
      node.y = y;
      return node;
    },
    text,
    button(words, o, onTap) {
      if (o === null || typeof o !== 'object' || !finite(o.x) || !finite(o.y) || typeof onTap !== 'function')
        throw invalid('a button takes its words, { x, y } and a function');
      const { width: w = 160, height: h = 44, color = 0x3b82f6, textColor = 0xffffff } = o;
      if (!finite(w) || !finite(h) || w <= 0 || h <= 0 || !colour(color) || !colour(textColor))
        throw invalid('a button has a width and a height above 0 and colours');
      const node = game.sprite(g => {
        g.beginFill(color)
          .drawRoundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.25)
          .endFill();
      }, o.layer ?? ui) as Sprite & { label: PlayText };
      node.x = o.x;
      node.y = o.y;
      node.label = text(words, {
        size: finite(o.size) && o.size > 0 ? o.size : h * 0.45,
        color: textColor,
        align: 'center',
        baseline: 'middle',
        layer: node
      });
      game.onTap(node, onTap);
      return node;
    },
    toFront(node) {
      if (node === undefined || node === null || node.isDisposed) return;
      node.parent?.addChild(node);
    },
    remove(node) {
      if (node === undefined || node === null || node.isDisposed) return;
      removers.get(node)?.();
      node.dispose();
    },
    onTap(node, callback) {
      if (typeof callback !== 'function') throw invalid('onTap takes a sprite and a function');
      if (browser.pointer === undefined) return;
      node.touchEnabled = true;
      node.on(browser.pointer.events.tap, tapListener(callback, fail));
    },
    overlaps(a, b, shrink = 0) {
      if (!seen(a) || !seen(b)) return false;
      const first = boxOf(a),
        second = boxOf(b);
      return first !== undefined && second !== undefined && meet(first, second, shrink);
    },
    hits(a, others, shrink = 0) {
      if (!seen(a)) return undefined;
      const first = boxOf(a);
      if (first === undefined) return undefined;
      for (const other of others) {
        // A sprite does not hit itself, so a list may hold it.
        if ((other as DisplayObject) === a || !seen(other)) continue;
        const second = boxOf(other);
        if (second !== undefined && meet(first, second, shrink)) return other;
      }
      return undefined;
    },
    hitsAll(a, others, shrink = 0) {
      const found: (typeof others)[number][] = [];
      if (!seen(a)) return found;
      const first = boxOf(a);
      if (first === undefined) return found;
      for (const other of others) {
        if ((other as DisplayObject) === a || !seen(other)) continue;
        const second = boxOf(other);
        if (second !== undefined && meet(first, second, shrink)) found.push(other);
      }
      return found;
    },
    pushOut(a, b) {
      if (!seen(a) || !seen(b)) return undefined;
      const first = boxOf(a),
        second = boxOf(b);
      if (first === undefined || second === undefined || !meet(first, second, 0)) return undefined;
      // The four ways out; the shortest is taken, and of two the same length the vertical one, so a box set
      // down on a floor is lifted and not slid.
      const left = second.left - first.right,
        right = second.right - first.left,
        up = second.top - first.bottom,
        down = second.bottom - first.top;
      const x = -left < right ? left : right,
        y = -up < down ? up : down;
      return Math.abs(x) < Math.abs(y) ? { x, y: 0 } : { x: 0, y };
    },
    near(a, b, distance) {
      if (!finite(distance) || !seen(a) || !seen(b)) return false;
      const first = boxOf(a),
        second = boxOf(b);
      if (first === undefined || second === undefined) return false;
      const dx = (first.left + first.right - second.left - second.right) / 2,
        dy = (first.top + first.bottom - second.top - second.bottom) / 2;
      return dx * dx + dy * dy <= distance * distance;
    },
    tween(target) {
      const motion = animate(engine, scope, target) as PlayMotion<typeof target>;
      let settle!: () => void;
      const done = new Promise<void>(resolve => {
        settle = resolve;
      });
      Object.defineProperty(motion, 'done', { value: done, enumerable: true });
      waiting.push(motion as Motion<object>);
      moving.push({ motion: motion as Motion<object>, settle });
      return motion;
    },
    wait(seconds) {
      return new Promise<void>(resolve => {
        timer(seconds, resolve, false);
      });
    },
    after: (seconds, callback) => timer(seconds, callback, false),
    every: (seconds, callback) => timer(seconds, callback, true),
    shake(amount = 6, seconds = 0.25) {
      if (!finite(amount) || !finite(seconds) || amount <= 0 || seconds <= 0) return;
      shakeAmount = Math.max(shakeLeft > 0 ? shakeAmount : 0, Math.min(amount, Math.max(width, height)));
      shakeLeft = shakeSpan = Math.min(seconds, 5);
    },
    flash(color = 0xffffff, seconds = 0.15) {
      if (!colour(color) || !finite(seconds) || seconds <= 0) return;
      cover.graphics.clear().beginFill(color).drawRect(0, 0, width, height).endFill();
      cover.visible = true;
      cover.alpha = 0.85;
      flashLeft = flashSpan = Math.min(seconds, 5);
    },
    hitStop(seconds = 0.06) {
      if (finite(seconds) && seconds > 0) stopped = Math.max(stopped, Math.min(seconds, 1));
    },
    burst(x, y, o = {}) {
      if (!finite(x) || !finite(y) || o === null || typeof o !== 'object') return;
      const color = colour(o.color) ? o.color : 0xffffff,
        size = finite(o.size) && o.size > 0 ? o.size : 3,
        count = Math.max(0, Math.min(64, finite(o.count) ? Math.round(o.count) : 12)),
        speed = finite(o.speed) ? o.speed : 160,
        life = finite(o.life) && o.life > 0 ? o.life : 0.5,
        gravity = finite(o.gravity) ? o.gravity : 0;
      const drawn = color + ':' + size;
      for (let i = 0; i < count; i++) {
        let piece = pieces[nextPiece];
        if (piece === undefined) {
          piece = {
            node: effects.addChild(scope.use(new Sprite())),
            vx: 0,
            vy: 0,
            gravity: 0,
            life: 0,
            span: 1,
            drawn: ''
          };
          pieces[nextPiece] = piece;
        }
        nextPiece = (nextPiece + 1) % PIECES;
        if (piece.drawn !== drawn) {
          piece.node.graphics.clear().beginFill(color).drawCircle(0, 0, size).endFill();
          piece.drawn = drawn;
        }
        const angle = Math.random() * Math.PI * 2,
          fast = speed * (0.35 + Math.random() * 0.65);
        piece.vx = Math.cos(angle) * fast;
        piece.vy = Math.sin(angle) * fast;
        piece.gravity = gravity;
        piece.life = piece.span = life * (0.6 + Math.random() * 0.4);
        piece.node.x = x;
        piece.node.y = y;
        piece.node.alpha = 1;
        piece.node.scaleX = piece.node.scaleY = 1;
        piece.node.visible = true;
      }
    },
    save(key, value) {
      let written: string;
      try {
        written = JSON.stringify(value);
      } catch {
        return;
      }
      if (written === undefined) return;
      kept.set(key, written);
      try {
        storage?.setItem(saveKey(key), written);
      } catch {
        // Full or blocked storage: the value is kept for this visit.
      }
    },
    load(key, fallback) {
      let written = kept.get(key);
      if (written === undefined) {
        try {
          written = storage?.getItem(saveKey(key)) ?? undefined;
        } catch {
          written = undefined;
        }
      }
      if (written === undefined) return fallback;
      try {
        return JSON.parse(written);
      } catch {
        return fallback;
      }
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    get paused() {
      return paused;
    },
    async restart() {
      if (disposed) return;
      // No update runs while the game is taken down and set up again.
      api = undefined;
      timers = [];
      waiting = [];
      for (const entry of moving) {
        entry.motion.stop();
        entry.settle();
      }
      moving = [];
      for (const made of [world, ui]) while (made.numChildren > 0) game.remove(made.getChildAt(0));
      for (const piece of pieces) {
        piece.life = 0;
        piece.node.visible = false;
      }
      view.x = view.y = 0;
      time = 0;
      timeScale = 1;
      paused = false;
      stopped = shakeLeft = flashLeft = 0;
      cover.visible = false;
      try {
        await setup?.(game);
      } finally {
        api = game;
      }
    },
    browser,
    engine,
    scope,
    canvas: surface,
    async dispose() {
      if (disposed) return;
      disposed = true;
      for (const [target, type, listener] of listening) target.removeEventListener(type, listener);
      await browser.dispose();
      holder?.remove();
    }
  };
  cover.visible = false;

  try {
    await Promise.all(Object.entries(SFX_PRESETS).map(([name, recipe]) => make(name, recipe)));
    await setup?.(game);
  } catch (cause) {
    await game.dispose();
    throw cause;
  }
  api = game;
  browser.loop.start();
  return game;
}
