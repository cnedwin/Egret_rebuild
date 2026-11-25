// SPDX-License-Identifier: Apache-2.0
// What most games of the play kind draw for themselves: bars, short notices, a box of words that is read and
// answered, and a menu. Each is made of the game's own sprites and texts on its ui layer, so it scrolls with nothing,
// fades and is removed as they are, and a restart takes it away. Every one answers the keyboard, the pointer and a
// finger alike.
import { Sprite } from '@egret/engine';
import type { PlayGame, PlayText } from './BrowserPlay.js';

/** A bar to show, as for health: where and how large, its value and maximum, its colors and layer. */
export interface PlayBarOptions {
  readonly x: number;
  readonly y: number;
  /** 120 by 12 unless given. `x` and `y` are its left and its top. */
  readonly width?: number;
  readonly height?: number;
  /** How full it is: `value` out of `max`. 1 of 1 unless given. */
  readonly value?: number;
  readonly max?: number;
  readonly color?: number;
  /** The colour of the empty part. */
  readonly back?: number;
  readonly layer?: Sprite;
}
/** A bar of health, time or power. Setting `value` slides it there; a fall leaves a pale trail that catches up. */
export class PlayBar extends Sprite {
  #value: number;
  #max: number;
  #color: number;
  #shown: number;
  #trail: number;
  readonly #width: number;
  readonly #height: number;
  readonly #back: number;
  #drawn = '';
  public constructor(width: number, height: number, value: number, max: number, color: number, back: number) {
    super();
    this.#width = width;
    this.#height = height;
    this.#max = max;
    this.#value = this.#shown = this.#trail = Math.max(0, Math.min(max, value));
    this.#color = color;
    this.#back = back;
    this.draw();
  }
  public get value(): number {
    return this.#value;
  }
  public set value(next: number) {
    if (typeof next === 'number' && Number.isFinite(next)) this.#value = Math.max(0, Math.min(this.#max, next));
  }
  public get max(): number {
    return this.#max;
  }
  public set max(next: number) {
    if (typeof next !== 'number' || !Number.isFinite(next) || next <= 0) return;
    this.#max = next;
    this.#value = Math.min(this.#value, next);
  }
  public get color(): number {
    return this.#color;
  }
  public set color(next: number) {
    if (Number.isInteger(next) && next >= 0 && next <= 0xffffff) this.#color = next;
  }
  /** Moves what is shown towards the value, by the seconds since the last step. */
  public step(seconds: number): void {
    const toward = (from: number, rate: number): number =>
      Math.abs(this.#value - from) < this.#max / 1000
        ? this.#value
        : from + (this.#value - from) * Math.min(1, rate * seconds);
    this.#shown = toward(this.#shown, 14);
    // The trail of a fall waits a moment, then follows; a rise has no trail.
    this.#trail = this.#trail < this.#shown ? this.#shown : toward(this.#trail, 3);
    this.draw();
  }
  public draw(): void {
    const w = this.#width,
      h = this.#height,
      full = (this.#shown / this.#max) * w,
      trail = (this.#trail / this.#max) * w,
      key = full.toFixed(1) + ':' + trail.toFixed(1) + ':' + this.#color;
    if (key === this.#drawn) return;
    this.#drawn = key;
    const g = this.graphics.clear(),
      round = Math.min(h / 2, 6);
    g.beginFill(this.#back).drawRoundRect(0, 0, w, h, round).endFill();
    if (trail > full + 0.5)
      g.beginFill(0xffffff, 0.55)
        .drawRect(full, 1, trail - full, h - 2)
        .endFill();
    if (full > 0.5) {
      g.beginFill(this.#color)
        .drawRoundRect(0, 0, Math.max(full, Math.min(h, w)), h, round)
        .endFill();
      g.beginFill(0xffffff, 0.18)
        .drawRect(2, 1, Math.max(0, full - 4), Math.max(1, h * 0.3))
        .endFill();
    }
  }
}

/** A line of dialogue: who says it, the choices offered, its color and how fast it types. */
export interface PlaySayOptions {
  /** The name shown above the words. */
  readonly who?: string;
  /** Answers to choose from. `say` then gives the index of the one chosen. */
  readonly choices?: readonly string[];
  /** The colour of the name and of the chosen answer. */
  readonly color?: number;
  /** Letters a second as the words appear; 0 shows them at once. 40 unless given. */
  readonly speed?: number;
}
/** A menu to show: its title, where it goes, how wide and its color. */
export interface PlayMenuOptions {
  readonly title?: string;
  /** The middle of the menu. The middle of the stage unless given. */
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  /** The colour of the chosen item. */
  readonly color?: number;
}
/** A toast to show: how long and in what color. */
export interface PlayToastOptions {
  readonly seconds?: number;
  readonly color?: number;
}

/** How wide words are in units of their size: a character of Chinese, Japanese or Korean is one, any other about half. */
const wide = (character: string): boolean => /[⺀-鿿가-힯豈-﫿＀-￯]/.test(character);
const measure = (words: string): number => {
  let units = 0;
  for (const character of words) units += wide(character) ? 1 : 0.55;
  return units;
};
// The upright forms of marks in vertical writing, as Unicode gives them for CJK compatibility.
const VERTICAL_FORMS: Readonly<Record<string, string>> = Object.freeze({
  '，': '︐',
  '、': '︑',
  '。': '︒',
  '：': '︓',
  '；': '︔',
  '！': '︕',
  '？': '︖',
  '（': '︵',
  '）': '︶',
  '｛': '︷',
  '｝': '︸',
  '〔': '︹',
  '〕': '︺',
  '【': '︻',
  '】': '︼',
  '《': '︽',
  '》': '︾',
  '〈': '︿',
  '〉': '﹀',
  '「': '﹁',
  '」': '﹂',
  '『': '﹃',
  '』': '﹄',
  '…': '︙',
  '—': '︱',
  '－': '︲',
  ',': '︐',
  '.': '︒',
  ':': '︓',
  ';': '︔',
  '!': '︕',
  '?': '︖',
  '(': '︵',
  ')': '︶'
});
/**
 * Words written top to bottom in columns from right to left, as rows a line of text draws: one character under
 * another, marks turned to their upright forms, a `\n` or `column` characters ending a column, and an ideographic
 * space where a column is shorter than the longest. For titles and seals in Chinese and Japanese, whose characters
 * are of one width.
 */
export function verticalPlayWords(words: string, column = Infinity): string {
  if (typeof words !== 'string') throw new TypeError('words are a string');
  if (!(column >= 1)) throw new RangeError('a column holds at least one character');
  const columns: string[][] = [];
  for (const piece of words.split(/\r?\n/)) {
    const characters = [...piece].map(character => VERTICAL_FORMS[character] ?? character);
    if (characters.length === 0) columns.push([]);
    for (let at = 0; at < characters.length; at += column) columns.push(characters.slice(at, at + column));
  }
  const tall = Math.max(0, ...columns.map(one => one.length));
  const rows: string[] = [];
  for (let row = 0; row < tall; row++)
    rows.push(
      columns
        .map(one => one[row] ?? '\u3000')
        .reverse()
        .join('')
    );
  return rows.join('\n');
}
/** Breaks words into lines no wider than `units`: at a space where there is one, between any two wide characters. */
export function wrapPlayWords(words: string, units: number): string[] {
  const lines: string[] = [];
  for (const paragraph of words.split('\n')) {
    let line = '',
      lineUnits = 0;
    const pieces = paragraph.match(/[⺀-鿿가-힯豈-﫿＀-￯]|\s+|[^\s⺀-鿿가-힯豈-﫿＀-￯]+/g) ?? [];
    for (const piece of pieces) {
      const size = measure(piece);
      if (lineUnits + size > units && line.trim() !== '') {
        lines.push(line.trimEnd());
        line = /^\s+$/.test(piece) ? '' : piece;
        lineUnits = line === '' ? 0 : size;
        continue;
      }
      line += piece;
      lineUnits += size;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

const NEXT = ['space', 'enter', 'z', 'pad:a'],
  UP = ['up', 'w', 'pad:up'],
  DOWN = ['down', 's', 'pad:down'];

interface Choice {
  readonly items: readonly string[];
  readonly rows: { readonly back: Sprite; readonly label: PlayText }[];
  readonly color: number;
  readonly width: number;
  selected: number;
  readonly finish: (index: number) => void;
}

/** The widgets of one game. `tick` is called once a step, also while the game is paused, with seconds of the wall. */
export function createPlayWidgets(
  game: PlayGame,
  wake: () => void = () => {}
): {
  bar(options: PlayBarOptions): PlayBar;
  toast(words: string, options?: PlayToastOptions): void;
  say(words: string, options?: PlaySayOptions): Promise<number | undefined>;
  sayPage(words: string, options?: PlaySayOptions): Promise<number | undefined>;
  menu(items: readonly string[], options?: PlayMenuOptions): Promise<number>;
  readonly asking: boolean;
  tick(seconds: number): void;
  reset(): void;
} {
  const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  const colour = (value: unknown, fallback: number): number =>
    Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffff ? (value as number) : fallback;
  let bars: PlayBar[] = [];
  let toasts: Sprite[] = [];
  // What is open: a box of words being read, and a list being chosen from. At most one of each at a time.
  let talking:
    | {
        readonly panel: Sprite;
        readonly words: PlayText[];
        readonly covers: Sprite[];
        readonly lines: string[];
        readonly total: number;
        shown: number;
        readonly speed: number;
        readonly hint: PlayText;
        choice: Choice | undefined;
        readonly choices: readonly string[] | undefined;
        /** Whether the pointer went down while the box was open: a release of a press from before it does not count. */
        armed: boolean;
        readonly color: number;
        readonly finish: (index: number | undefined) => void;
      }
    | undefined;
  let menu: { readonly panel: Sprite; readonly choice: Choice } | undefined;
  let queue: (() => void)[] = [];
  const tap = (node: Sprite, run: () => void): void => game.onTap(node, run);
  const click = (): void => {
    try {
      game.sfx.play('click', { volume: 0.5 });
    } catch {
      // Sound never stops a game.
    }
  };

  /** A column of answers to choose from, each a bar that can be tapped. */
  const choose = (
    items: readonly string[],
    layer: Sprite,
    left: number,
    top: number,
    width: number,
    size: number,
    color: number,
    finish: (index: number) => void
  ): Choice => {
    const height = Math.round(size * 1.9),
      rows: Choice['rows'][number][] = [];
    const choice: Choice = { items, rows, color, width, selected: 0, finish };
    items.forEach((item, index) => {
      const back = game.sprite(undefined, layer);
      back.x = left;
      back.y = top + index * (height + 6);
      const label = game.text(item, { x: 16, y: height / 2, size, baseline: 'middle', layer: back });
      tap(back, () => {
        choice.selected = index;
        paint(choice);
        click();
        finish(index);
      });
      rows.push({ back, label });
    });
    paint(choice, height);
    return choice;
  };
  const paint = (choice: Choice, height = choice.rows[0] ? choice.rows[0].label.size * 1.9 : 0): void => {
    choice.rows.forEach(({ back, label }, index) => {
      const on = index === choice.selected;
      back.graphics
        .clear()
        .beginFill(on ? choice.color : 0xffffff, on ? 1 : 0.08)
        .drawRoundRect(0, 0, choice.width, Math.round(height), 8)
        .endFill();
      label.color = on ? 0x111827 : 0xffffff;
    });
  };
  /** The part of the screen nothing covers, in the game's units: where boxes, menus and notices go. */
  const area = (): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } =>
    game.safe;
  /** The size of the words of a box, and how many lines fit under its name. */
  const boxOf = (named: boolean): { size: number; width: number; lines: number } => {
    const size = Math.max(14, Math.round(game.height / 22)),
      h = Math.max(size * 4.6, Math.round(game.height * 0.28)),
      top = 14 + (named ? Math.round(size * 1.3) : 0),
      step = Math.round(size * 1.35);
    return { size, width: area().width - 32 - 36, lines: Math.max(1, Math.floor((h - top - 6) / step)) };
  };
  const pagesOf = (words: string, named: boolean): string[] => {
    const { size, width, lines } = boxOf(named),
      all = wrapPlayWords(words, width / size),
      pages: string[] = [];
    for (let at = 0; at < all.length; at += lines) pages.push(all.slice(at, at + lines).join('\n'));
    return pages.length > 0 ? pages : [''];
  };
  /** Moves the choice by the keys or a stick, and gives true when it is taken. */
  const steer = (choice: Choice): boolean => {
    const keys = game.keys,
      count = choice.items.length;
    let move = keys.pressed(...UP) ? -1 : keys.pressed(...DOWN) ? 1 : 0;
    // The arrows and W and S count in the axis too; a stick moves the choice only when none of them is held.
    if (keys.down(...UP, ...DOWN)) steered = true;
    const stick = keys.axis().y;
    if (move === 0 && Math.abs(stick) > 0.6) {
      if (!steered) move = stick > 0 ? 1 : -1;
      steered = true;
    } else if (Math.abs(stick) < 0.3) steered = false;
    if (move !== 0) {
      choice.selected = (choice.selected + move + count) % count;
      paint(choice);
      click();
    }
    return keys.pressed(...NEXT);
  };
  let steered = false;
  const PANEL = 0x0b1020;
  const panelOf = (x: number, y: number, w: number, h: number, alpha = 0.88): Sprite => {
    const panel = game.sprite(g => {
      g.beginFill(PANEL, alpha).drawRoundRect(0, 0, w, h, 12).endFill();
      g.lineStyle(2, 0xffffff, 0.18).drawRoundRect(1, 1, w - 2, h - 2, 11);
    }, game.ui);
    panel.x = x;
    panel.y = y;
    return panel;
  };

  const widgets = {
    bar(o: PlayBarOptions): PlayBar {
      if (o === null || typeof o !== 'object' || !finite(o.x) || !finite(o.y))
        throw new TypeError('a bar takes { x, y }');
      const w = finite(o.width) && o.width > 0 ? o.width : 120,
        h = finite(o.height) && o.height > 0 ? o.height : 12,
        max = finite(o.max) && o.max > 0 ? o.max : 1;
      const bar = game.scope.use(
        new PlayBar(w, h, finite(o.value) ? o.value : max, max, colour(o.color, 0x22c55e), colour(o.back, 0x1f2937))
      );
      bar.x = o.x;
      bar.y = o.y;
      (o.layer instanceof Sprite ? o.layer : game.ui).addChild(bar);
      bars.push(bar);
      return bar;
    },
    toast(words: string, o: PlayToastOptions = {}): void {
      const size = Math.max(14, Math.round(game.height / 24)),
        seconds = finite(o?.seconds) && o.seconds > 0 ? o.seconds : 2,
        w = Math.min(area().width - 32, measure(String(words)) * size + 40),
        h = Math.round(size * 2);
      toasts = toasts.filter(node => !node.isDisposed && node.parent !== null);
      const node = game.sprite(g => {
        g.beginFill(0x0b1020, 0.85)
          .drawRoundRect(-w / 2, 0, w, h, h / 2)
          .endFill();
      }, game.ui);
      node.x = area().x + area().width / 2;
      node.y = area().y + 12 + toasts.length * (h + 6);
      game.text(String(words), {
        y: h / 2,
        size,
        align: 'center',
        baseline: 'middle',
        color: colour(o?.color, 0xffffff),
        layer: node
      });
      toasts.push(node);
      node.alpha = 0;
      game
        .tween(node)
        .to({ alpha: 1 }, 0.15)
        .wait(seconds)
        .to({ alpha: 0 }, 0.3)
        .call(() => game.remove(node));
    },
    say(words: string, o: PlaySayOptions = {}): Promise<number | undefined> {
      // Words longer than a box holds are shown a box at a time; the answers, if any, come with the last.
      const pages = pagesOf(String(words), typeof o?.who === 'string' && o.who !== '');
      const { choices: _answers, ...rest } = o ?? {};
      for (const page of pages.slice(0, -1)) void widgets.sayPage(page, rest);
      return widgets.sayPage(pages[pages.length - 1]!, o);
    },
    sayPage(words: string, o: PlaySayOptions = {}): Promise<number | undefined> {
      const choices = Array.isArray(o?.choices) && o.choices.length > 0 ? o.choices.map(String) : undefined;
      return new Promise(resolve => {
        const open = (): void => {
          const margin = 16,
            safe = area(),
            w = safe.width - 2 * margin,
            size = Math.max(14, Math.round(game.height / 22)),
            h = Math.max(size * 4.6, Math.round(game.height * 0.28)),
            // Opaque, so the covers that hide words not yet shown are the panel's own colour.
            panel = panelOf(safe.x + margin, safe.y + safe.height - h - margin, w, h, 1),
            color = colour(o?.color, 0xfacc15);
          let top = 14;
          if (typeof o?.who === 'string' && o.who !== '') {
            game.text(o.who, { x: 18, y: 10, size: Math.round(size * 0.9), bold: true, color, layer: panel });
            top += Math.round(size * 1.3);
          }
          const lines = wrapPlayWords(String(words), (w - 36) / size),
            total = lines.reduce((sum, line) => sum + [...line].length, 0),
            step = Math.round(size * 1.35);
          // Each line is drawn whole once; a cover over it moves right as its letters appear. Changing the words
          // themselves each step would draw them again each step.
          const body = lines.map((line, index) =>
            game.text(line, { x: 18, y: top + index * step, size, layer: panel })
          );
          const covers = lines.map((_, index) => {
            const cover = game.sprite(g => g.beginFill(PANEL).drawRect(0, 0, 1, step).endFill(), panel);
            cover.x = 16;
            cover.y = top + index * step - 2;
            cover.scaleX = w - 32;
            return cover;
          });
          const hint = game.text('▼', {
            x: w - 22,
            y: h - size - 8,
            size: Math.round(size * 0.7),
            color,
            layer: panel
          });
          hint.visible = false;
          const speed = finite(o?.speed) && o.speed >= 0 ? o.speed : 40;
          const record: NonNullable<typeof talking> = {
            panel,
            words: body,
            covers,
            lines,
            total,
            shown: speed === 0 ? total : 0,
            speed,
            hint,
            choice: undefined,
            choices,
            armed: false,
            color,
            finish(index) {
              // A tap and a key in one step answer once.
              if (talking !== record) return;
              talking = undefined;
              game.remove(panel);
              resolve(index);
              const next = queue.shift();
              next?.();
            }
          };
          talking = record;
          show();
        };
        if (talking === undefined) open();
        else queue.push(open);
        wake();
      });
    },
    menu(items: readonly string[], o: PlayMenuOptions = {}): Promise<number> {
      if (!Array.isArray(items) || items.length === 0) throw new TypeError('a menu takes a list of items');
      const list = items.map(String);
      return new Promise(resolve => {
        menu?.choice.finish(-1);
        const size = Math.max(14, Math.round(game.height / 20)),
          row = Math.round(size * 1.9) + 6,
          titleLines = typeof o?.title === 'string' ? o.title.split('\n') : [],
          longest = Math.max(...list.map(measure), ...titleLines.map(line => measure(line) * 1.2)),
          w = finite(o?.width) && o.width > 0 ? o.width : Math.min(area().width - 32, longest * size + 64),
          titled = typeof o?.title === 'string' && o.title !== '',
          // A title of several lines takes as many lines of room, so the first item is never under it.
          titleHeight = titled ? Math.round(size * (0.35 + 1.45 * titleLines.length)) : 0,
          h = list.length * row + 24 + titleHeight,
          x = (finite(o?.x) ? o.x : area().x + area().width / 2) - w / 2,
          y = (finite(o?.y) ? o.y : area().y + area().height / 2) - h / 2;
        const panel = panelOf(x, y, w, h);
        if (titled)
          game.text(o.title!, {
            x: w / 2,
            y: 12,
            size: Math.round(size * 1.1),
            bold: true,
            align: 'center',
            layer: panel
          });
        const opened = { panel } as { panel: Sprite; choice: Choice };
        opened.choice = choose(
          list,
          panel,
          12,
          titled ? titleHeight + 8 : 12,
          w - 24,
          size,
          colour(o?.color, 0xfacc15),
          index => {
            if (menu !== opened) return;
            menu = undefined;
            game.remove(panel);
            if (index >= 0) resolve(index);
          }
        );
        menu = opened;
        wake();
      });
    },
    get asking(): boolean {
      return talking !== undefined || menu !== undefined;
    },
    tick(seconds: number): void {
      bars = bars.filter(bar => !bar.isDisposed);
      for (const bar of bars) bar.step(seconds);
      if (menu !== undefined) {
        const open = menu;
        if (steer(open.choice)) {
          click();
          open.choice.finish(open.choice.selected);
        }
        return;
      }
      if (talking === undefined) return;
      const open = talking;
      if (game.pointer.pressed) open.armed = true;
      const pressed = game.keys.pressed(...NEXT) || (open.armed && game.pointer.released);
      if (open.choice !== undefined) {
        if (steer(open.choice)) {
          click();
          open.choice.finish(open.choice.selected);
        }
        return;
      }
      if (open.shown < open.total) {
        if (pressed) open.shown = open.total;
        else open.shown = Math.min(open.total, open.shown + open.speed * seconds);
        show();
        return;
      }
      if (open.choices !== undefined) return;
      if (pressed) {
        click();
        open.finish(undefined);
      }
    },
    reset(): void {
      // A restart has taken their sprites; what was being awaited is not answered.
      bars = [];
      toasts = [];
      talking = undefined;
      menu = undefined;
      queue = [];
    }
  };
  /** Shows as many letters as have appeared, and the answers once all have. */
  function show(): void {
    const open = talking;
    if (open === undefined) return;
    let left = Math.floor(open.shown);
    open.lines.forEach((line, index) => {
      const characters = [...line],
        cover = open.covers[index]!,
        shown = Math.max(0, Math.min(characters.length, left));
      left -= characters.length;
      const from = 18 + measure(characters.slice(0, shown).join('')) * open.words[index]!.size;
      cover.visible = shown < characters.length;
      cover.x = from;
      cover.scaleX = Math.max(1, area().width - 48 - from);
    });
    const done = open.shown >= open.total;
    open.hint.visible = done && open.choices === undefined;
    if (done && open.choices !== undefined && open.choice === undefined) {
      const size = open.words[0]!.size,
        row = Math.round(size * 1.9) + 6,
        w = Math.min(area().width - 32, Math.max(...open.choices.map(measure)) * size + 64),
        x = area().x + area().width - 16 - w,
        y = open.panel.y - open.choices.length * row - 20;
      const holder = panelOf(x, y, w, open.choices.length * row + 14);
      const close = open.finish;
      open.choice = choose(open.choices, holder, 8, 8, w - 16, size, open.color, index => {
        game.remove(holder);
        close(index);
      });
    }
  }
  return widgets;
}
