// SPDX-License-Identifier: Apache-2.0
// The optional entry @egret/engine/web/view. A screen described as data: panels, rows and columns of texts, buttons,
// bars and toggles, each placed against an edge, the middle or its neighbours, and the controls a game reads or
// changes named. Pure: it checks a description and plans where each part of it goes on a screen of a given size, in
// the game's units. What draws it, `game.show` of play for one, paints the plan with a skin and binds the names.
import { EgretError } from '@egret/runtime';
export { createBadges, createRequest, formatCompact, keyCap } from './viewParts.js';
export type { Badges, CompactOptions, Request } from './viewParts.js';

/** Where in its panel a part is placed when the panel lays its parts out freely: an edge, a corner or the middle. */
export type ViewAnchor =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';
/** A width or height: units of the game, a share of the panel such as `'50%'`, or all that is left (`'fill'`). */
export type ViewSize = number | `${number}%` | 'fill';

/** What every part has: a name that code and tests reach it by, where it is placed, how large it is, and whether it shows. */
interface ViewPartBase {
  /** Letters, digits, `_`, `-` and `.`, starting with a letter or `_`; unique in a view. A part without one is drawn only. */
  readonly name?: string;
  /** Where it goes in a panel that lays out freely. `'top-left'` unless given. In a row or a column it is ignored. */
  readonly anchor?: ViewAnchor;
  /** How far in from the anchor, or, in a row or a column, a nudge from where it falls. */
  readonly x?: number;
  readonly y?: number;
  readonly width?: ViewSize;
  readonly height?: ViewSize;
  /** False to begin hidden. */
  readonly visible?: boolean;
  /** A stroke drawn inside the part's layout box. */
  readonly border?: { readonly color: number; readonly width: number };
}

/** Width-wrapped text in an explicitly sized view part. Uses the view's paragraph cache. */
export interface ViewParagraphStyle {
  readonly fontFamilies: readonly string[];
  readonly lineHeight?: number;
  readonly locale?: string;
  readonly direction?: 'ltr' | 'rtl';
  readonly maxLines?: number;
}
/** A panel: a card that is drawn, or only a place that holds parts. */
export interface ViewPanel extends ViewPartBase {
  readonly type: 'panel';
  /** `'free'` unless given: each part by its anchor. `'row'` and `'column'` place the parts one after another. */
  readonly layout?: 'free' | 'row' | 'column';
  /** The space between parts of a row or a column. */
  readonly gap?: number;
  /** The space inside the panel's edges. */
  readonly padding?: number;
  /** Across a row or a column: at the start, the middle, the end, or stretched. `'stretch'` unless given. */
  readonly align?: 'start' | 'center' | 'end' | 'stretch';
  /** Along a row or a column, when no part fills: where the parts gather. `'start'` unless given. */
  readonly justify?: 'start' | 'center' | 'end' | 'between';
  /** Drawn as a card of the skin. A panel is only a place unless this or `color` is given. */
  readonly card?: boolean;
  readonly color?: number;
  /** How opaque the card is, 0 to 1. */
  readonly alpha?: number;
  /** What the panel is called for assistive technology and tests; its name unless given. */
  readonly label?: string;
  /** Makes this panel a clipped vertical viewport; its children keep their declared layout inside it. */
  readonly scroll?: 'vertical';
  readonly children?: readonly ViewPart[];
}
/** A line of words. */
export interface ViewText extends ViewPartBase {
  readonly type: 'text';
  readonly text?: string | number;
  readonly size?: number;
  readonly color?: number;
  /** Across its place: `'left'` unless given. The words are in the middle of it up and down. */
  readonly align?: 'left' | 'center' | 'right';
  readonly bold?: boolean;
  readonly paragraph?: ViewParagraphStyle;
}
/** A button with words on it. */
export interface ViewButton extends ViewPartBase {
  readonly type: 'button';
  readonly text: string | number;
  readonly size?: number;
  readonly color?: number;
  readonly textColor?: number;
  /** Optional detail below the title. Give the button an explicit height. */
  readonly description?: string;
  /** Style of the width-wrapped description. Omit both detail fields for a single-line button. */
  readonly paragraph?: ViewParagraphStyle;
}
/** How full something is: a value from 0 to 1. */
export interface ViewBar extends ViewPartBase {
  readonly type: 'bar';
  readonly value?: number;
  readonly color?: number;
  /** What the bar measures, for assistive technology and tests; its name unless given. */
  readonly label?: string;
}
/** A switch that is on or off, with words before it. */
export interface ViewToggle extends ViewPartBase {
  readonly type: 'toggle';
  readonly text: string | number;
  readonly checked?: boolean;
  readonly size?: number;
}
/** Empty space: in a row or a column, `'fill'` pushes what follows to the end. */
export interface ViewSpace extends ViewPartBase {
  readonly type: 'space';
}
/** A picture contained in its layout box and centred with its original aspect ratio. */
export interface ViewImage extends ViewPartBase {
  readonly type: 'image';
  readonly src: string;
  /** Accessible image description. Without one, the picture is decorative. */
  readonly label?: string;
}
/** Any part of a view. */
export type ViewPart = ViewPanel | ViewText | ViewButton | ViewBar | ViewToggle | ViewSpace | ViewImage;

/** The colours and sizes a view is drawn with, where its parts do not give their own. */
export interface ViewSkin {
  /** Words. */
  readonly text: number;
  /** A card, and how opaque it is. */
  readonly panel: number;
  readonly panelAlpha: number;
  /** A button and its words. */
  readonly button: number;
  readonly buttonText: number;
  /** A button or a switch that cannot be used now. */
  readonly disabled: number;
  /** A bar's fill and a switch that is on. */
  readonly accent: number;
  /** A bar's track and a switch that is off. */
  readonly track: number;
  /** The rounding of cards, buttons and bars. */
  readonly radius: number;
  /** The size of words. */
  readonly size: number;
  /** How dark the screen behind a modal view is, 0 to 1. */
  readonly dim: number;
}
/** A dark skin that reads on any game: words in white on slate cards, blue buttons and a green accent. */
export const DEFAULT_VIEW_SKIN: ViewSkin = Object.freeze({
  text: 0xf8fafc,
  panel: 0x1e293b,
  panelAlpha: 0.92,
  button: 0x3b82f6,
  buttonText: 0xffffff,
  disabled: 0x64748b,
  accent: 0x22c55e,
  track: 0x334155,
  radius: 10,
  size: 24,
  dim: 0.55
});

/** A screen as data: its parts, the parts while the screen is taller than wide, and how it sits. */
export interface ViewDescription {
  /** What the view is called for assistive technology and tests. */
  readonly label?: string;
  /** The parts, laid out in `area`. A panel or any one part. */
  readonly root: ViewPart;
  /** The parts while the screen is taller than wide. The same names, of the same kinds, as `root`. */
  readonly portrait?: ViewPart;
  /** `'safe'` unless given: the part of the screen no notch or home bar covers. `'screen'`: all the screen shows. */
  readonly area?: 'safe' | 'screen';
  /** Over everything, with the screen behind it dimmed and closed to the pointer. */
  readonly modal?: boolean;
  /** Colours and sizes that differ from the default skin. */
  readonly skin?: Partial<ViewSkin>;
}

/** A rectangle in the game's units. */
export interface ViewRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
/** Where a view goes: the screen the game shows and the part of it that is safe, in the game's units. */
export interface ViewFrame {
  readonly screen: ViewRect;
  readonly safe: ViewRect;
  readonly orientation: 'landscape' | 'portrait';
}
/** A part where it goes: its place in the tree, what it is, and its rectangle in the game's units. */
export interface ViewPlannedPart {
  /** Its index in `parts`; parents come before what they hold. */
  readonly index: number;
  /** The index of the panel that holds it, or -1 for the root. */
  readonly parent: number;
  readonly part: ViewPart;
  readonly rect: ViewRect;
}
/** Where every part of a view goes on one screen. */
export interface ViewPlan {
  /** Which parts are used: `'portrait'` when the screen is taller than wide and the view has portrait parts. */
  readonly variant: 'landscape' | 'portrait';
  readonly area: ViewRect;
  readonly parts: readonly ViewPlannedPart[];
  /** The index of each named part. */
  readonly names: ReadonlyMap<string, number>;
  readonly skin: ViewSkin;
}

const MAX_PARTS = 1024,
  MAX_DEPTH = 32,
  NAME = /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/;
const ANCHORS = new Set([
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right'
]);
const BASE_KEYS = ['type', 'name', 'anchor', 'x', 'y', 'width', 'height', 'visible', 'border'];
const KEYS: Record<ViewPart['type'], ReadonlySet<string>> = {
  panel: new Set([
    ...BASE_KEYS,
    'layout',
    'gap',
    'padding',
    'align',
    'justify',
    'card',
    'color',
    'alpha',
    'label',
    'scroll',
    'children'
  ]),
  text: new Set([...BASE_KEYS, 'text', 'size', 'color', 'align', 'bold', 'paragraph']),
  button: new Set([...BASE_KEYS, 'text', 'size', 'color', 'textColor', 'description', 'paragraph']),
  bar: new Set([...BASE_KEYS, 'value', 'color', 'label']),
  toggle: new Set([...BASE_KEYS, 'text', 'checked', 'size']),
  space: new Set(BASE_KEYS),
  image: new Set([...BASE_KEYS, 'src', 'label'])
};
const SKIN_KEYS = Object.keys(DEFAULT_VIEW_SKIN) as (keyof ViewSkin)[];

const invalid = (where: string, what: string): EgretError =>
  new EgretError('UI_VIEW_INVALID', { cause: where + ': ' + what });
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const colour = (value: unknown): boolean =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffff;
const size = (value: unknown): boolean =>
  value === 'fill' ||
  (finite(value) && value >= 0) ||
  (typeof value === 'string' && /^\d+(?:\.\d+)?%$/.test(value) && Number.parseFloat(value) <= 100);

function partOptions(value: unknown, keys: readonly string[], label: string, field: string): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(key => !keys.includes(key))
  )
    throw invalid(label, field);
  return value as Record<string, unknown>;
}

function checkParagraph(value: unknown, label: string): void {
  const row = partOptions(value, ['fontFamilies', 'lineHeight', 'locale', 'direction', 'maxLines'], label, 'paragraph');
  const families = row['fontFamilies'],
    lineHeight = row['lineHeight'],
    maxLines = row['maxLines'];
  if (
    !Array.isArray(families) ||
    families.length === 0 ||
    families.length > 16 ||
    families.some(family => typeof family !== 'string' || !family.trim() || family.length > 256)
  )
    throw invalid(label, 'paragraph fontFamilies');
  if (lineHeight !== undefined && (!finite(lineHeight) || lineHeight < 1 || lineHeight > 1024))
    throw invalid(label, 'paragraph lineHeight');
  if (row['locale'] !== undefined && (typeof row['locale'] !== 'string' || !row['locale'].trim()))
    throw invalid(label, 'paragraph locale');
  if (row['direction'] !== undefined && row['direction'] !== 'ltr' && row['direction'] !== 'rtl')
    throw invalid(label, 'paragraph direction');
  if (maxLines !== undefined && (!finite(maxLines) || !Number.isInteger(maxLines) || maxLines < 1 || maxLines > 256))
    throw invalid(label, 'paragraph maxLines');
}

/** Checks the parts of one tree and returns its named parts with their kinds. */
function checkTree(root: unknown, where: string): Map<string, ViewPart['type']> {
  const names = new Map<string, ViewPart['type']>();
  let count = 0;
  const visit = (value: unknown, at: string, depth: number): void => {
    if (++count > MAX_PARTS) throw invalid(at, 'a view has at most ' + MAX_PARTS + ' parts');
    if (depth > MAX_DEPTH) throw invalid(at, 'parts are at most ' + MAX_DEPTH + ' deep');
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw invalid(at, 'a part is an object');
    const part = value as Record<string, unknown>;
    const type = part['type'];
    if (typeof type !== 'string' || !Object.hasOwn(KEYS, type))
      throw invalid(at, 'type is panel, text, button, bar, toggle, space or image');
    const keys = KEYS[type as ViewPart['type']];
    for (const key of Object.keys(part)) if (!keys.has(key)) throw invalid(at, 'a ' + type + ' has no ' + key);
    const name = part['name'];
    if (name !== undefined) {
      if (typeof name !== 'string' || !NAME.test(name)) throw invalid(at, 'name ' + String(name) + ' is not a name');
      if (names.has(name)) throw invalid(at, 'the name ' + name + ' is used twice');
      names.set(name, type as ViewPart['type']);
    }
    const label = name === undefined ? at : at + ' (' + name + ')';
    if (part['anchor'] !== undefined && !ANCHORS.has(part['anchor'] as string)) throw invalid(label, 'anchor');
    for (const key of ['x', 'y']) if (part[key] !== undefined && !finite(part[key])) throw invalid(label, key);
    for (const key of ['width', 'height']) if (part[key] !== undefined && !size(part[key])) throw invalid(label, key);
    if (part['border'] !== undefined) {
      const border = partOptions(part['border'], ['color', 'width'], label, 'border');
      if (!colour(border['color']) || !finite(border['width']) || border['width'] <= 0) throw invalid(label, 'border');
    }
    if (part['paragraph'] !== undefined) {
      checkParagraph(part['paragraph'], label);
      if (part['height'] === undefined || part['height'] === 0) throw invalid(label, 'paragraph needs a height');
    }
    if (
      type === 'button' &&
      ((part['description'] !== undefined && typeof part['description'] !== 'string') ||
        (part['description'] === undefined) !== (part['paragraph'] === undefined))
    )
      throw invalid(label, 'button description and paragraph are used together');
    if (
      type === 'image' &&
      (typeof part['src'] !== 'string' || !part['src'].trim() || part['width'] === 0 || part['height'] === 0)
    )
      throw invalid(label, 'image source and size');
    for (const key of ['size', 'gap', 'padding'])
      if (part[key] !== undefined && (!finite(part[key]) || (part[key] as number) < 0)) throw invalid(label, key);
    if (part['size'] !== undefined && (part['size'] as number) === 0) throw invalid(label, 'size');
    for (const key of ['color', 'textColor'])
      if (part[key] !== undefined && !colour(part[key])) throw invalid(label, key);
    for (const key of ['alpha', 'value'])
      if (part[key] !== undefined && (!finite(part[key]) || (part[key] as number) < 0 || (part[key] as number) > 1))
        throw invalid(label, key + ' is 0 to 1');
    for (const key of ['visible', 'card', 'bold', 'checked'])
      if (part[key] !== undefined && typeof part[key] !== 'boolean') throw invalid(label, key + ' is true or false');
    for (const key of ['text'])
      if (part[key] !== undefined && typeof part[key] !== 'string' && !finite(part[key])) throw invalid(label, 'text');
    if ((type === 'button' || type === 'toggle') && part['text'] === undefined)
      throw invalid(label, 'a ' + type + ' has text');
    if (part['label'] !== undefined && typeof part['label'] !== 'string') throw invalid(label, 'label');
    const choices: Record<string, readonly string[]> = {
      layout: ['free', 'row', 'column'],
      align: type === 'text' ? ['left', 'center', 'right'] : ['start', 'center', 'end', 'stretch'],
      justify: ['start', 'center', 'end', 'between'],
      scroll: ['vertical']
    };
    for (const [key, allowed] of Object.entries(choices))
      if (part[key] !== undefined && !allowed.includes(part[key] as string))
        throw invalid(label, key + ' is ' + allowed.join(', '));
    const children = part['children'];
    if (children !== undefined) {
      if (!Array.isArray(children)) throw invalid(label, 'children is a list');
      children.forEach((child, index) => {
        visit(child, at + '/' + index, depth + 1);
      });
    }
  };
  visit(root, where, 1);
  return names;
}

/**
 * Checks a description: every part of a known kind with only the fields of its kind, names that are names and are
 * used once, and portrait parts with the same names, of the same kinds, as the others. Returns the named parts with
 * their kinds. What is wrong is refused with `UI_VIEW_INVALID` or `UI_VIEW_VARIANT_MISMATCH`, saying where.
 */
export function checkView(description: ViewDescription): ReadonlyMap<string, ViewPart['type']> {
  if (description === null || typeof description !== 'object') throw invalid('view', 'a description is an object');
  for (const key of Object.keys(description))
    if (!['label', 'root', 'portrait', 'area', 'modal', 'skin'].includes(key))
      throw invalid('view', 'a view has no ' + key);
  if (description.label !== undefined && typeof description.label !== 'string') throw invalid('view', 'label');
  if (description.area !== undefined && description.area !== 'safe' && description.area !== 'screen')
    throw invalid('view', "area is 'safe' or 'screen'");
  if (description.modal !== undefined && typeof description.modal !== 'boolean')
    throw invalid('view', 'modal is true or false');
  if (description.skin !== undefined) {
    if (description.skin === null || typeof description.skin !== 'object') throw invalid('skin', 'a skin is an object');
    for (const [key, value] of Object.entries(description.skin)) {
      if (!SKIN_KEYS.includes(key as keyof ViewSkin)) throw invalid('skin', 'a skin has no ' + key);
      const ok =
        key === 'panelAlpha' || key === 'dim'
          ? finite(value) && value >= 0 && value <= 1
          : key === 'radius' || key === 'size'
            ? finite(value) && value >= 0 && (key === 'radius' || value > 0)
            : colour(value);
      if (!ok) throw invalid('skin', key);
    }
  }
  const names = checkTree(description.root, 'root');
  if (description.portrait !== undefined) {
    const other = checkTree(description.portrait, 'portrait');
    const missing = [...names.keys()].filter(name => !other.has(name)),
      extra = [...other.keys()].filter(name => !names.has(name)),
      changed = [...names].filter(([name, type]) => other.has(name) && other.get(name) !== type).map(([name]) => name);
    if (missing.length + extra.length + changed.length > 0)
      throw new EgretError('UI_VIEW_VARIANT_MISMATCH', {
        cause:
          [
            missing.length ? 'not in portrait: ' + missing.join(', ') : '',
            extra.length ? 'only in portrait: ' + extra.join(', ') : '',
            changed.length ? 'of another kind in portrait: ' + changed.join(', ') : ''
          ]
            .filter(Boolean)
            .join('; ') + '.'
      });
  }
  return names;
}

/** The size a part takes when it gives none. */
function natural(part: ViewPart, axis: 'width' | 'height', skin: ViewSkin): ViewSize {
  switch (part.type) {
    case 'panel':
      return 'fill';
    case 'text':
      return axis === 'width' ? 'fill' : Math.ceil((part.size ?? skin.size) * 1.4);
    case 'button':
      return axis === 'width' ? 160 : Math.ceil(Math.max(44, (part.size ?? skin.size) * 1.9));
    case 'bar':
      return axis === 'width' ? 200 : 16;
    case 'toggle':
      return axis === 'width' ? 220 : Math.ceil(Math.max(44, (part.size ?? skin.size) * 1.8));
    case 'space':
      return 0;
    case 'image':
      return 64;
  }
}
/** A size against the room it is in; `'fill'` is all of the room. */
const measure = (value: ViewSize, room: number): number =>
  value === 'fill' ? room : typeof value === 'number' ? value : (room * Number.parseFloat(value)) / 100;

/** Plans where each part of a view goes on a screen: the parts for its shape, each rectangle in the game's units. */
export function planView(description: ViewDescription, frame: ViewFrame): ViewPlan {
  checkView(description);
  const rect = (value: unknown): value is ViewRect =>
    value !== null &&
    typeof value === 'object' &&
    ['x', 'y', 'width', 'height'].every(key => finite((value as Record<string, unknown>)[key])) &&
    (value as ViewRect).width >= 0 &&
    (value as ViewRect).height >= 0;
  if (
    frame === null ||
    typeof frame !== 'object' ||
    !rect(frame.screen) ||
    !rect(frame.safe) ||
    (frame.orientation !== 'landscape' && frame.orientation !== 'portrait')
  )
    throw new EgretError('UI_VIEW_FRAME_INVALID');
  const skin: ViewSkin = Object.freeze({ ...DEFAULT_VIEW_SKIN, ...description.skin });
  const variant = frame.orientation === 'portrait' && description.portrait !== undefined ? 'portrait' : 'landscape';
  const area = Object.freeze({ ...(description.area === 'screen' ? frame.screen : frame.safe) });
  const parts: ViewPlannedPart[] = [];
  const names = new Map<string, number>();
  const put = (part: ViewPart, parent: number, at: ViewRect): void => {
    const index = parts.length;
    parts.push(Object.freeze({ index, parent, part, rect: Object.freeze({ ...at }) }));
    if (part.name !== undefined) names.set(part.name, index);
    if (part.type !== 'panel' || part.children === undefined || part.children.length === 0) return;
    const pad = part.padding ?? 0,
      inner = {
        x: at.x + pad,
        y: at.y + pad,
        width: Math.max(0, at.width - pad * 2),
        height: Math.max(0, at.height - pad * 2)
      };
    const layout = part.layout ?? 'free';
    if (layout === 'free') {
      for (const child of part.children) put(child, index, placeFree(child, inner, skin));
      return;
    }
    // A row or a column: fixed sizes first, then what is left shared by the parts that fill.
    const along = layout === 'row' ? 'width' : 'height',
      across = layout === 'row' ? 'height' : 'width';
    const room = inner[along],
      gap = part.gap ?? 0,
      gaps = gap * (part.children.length - 1);
    const wants = part.children.map(child => child[along] ?? natural(child, along, skin));
    const fixed = wants.reduce<number>((sum, want) => sum + (want === 'fill' ? 0 : measure(want, room)), 0);
    const fills = wants.filter(want => want === 'fill').length;
    const share = fills > 0 ? Math.max(0, room - gaps - fixed) / fills : 0;
    const used = fixed + share * fills + gaps;
    const justify = fills > 0 ? 'start' : (part.justify ?? 'start');
    let cursor = justify === 'center' ? (room - used) / 2 : justify === 'end' ? room - used : 0;
    const spread = justify === 'between' && part.children.length > 1 ? (room - used) / (part.children.length - 1) : 0;
    part.children.forEach((child, i) => {
      const length = wants[i] === 'fill' ? share : measure(wants[i]!, room);
      const align = part.align ?? 'stretch';
      const crossWant = child[across] ?? (align === 'stretch' ? 'fill' : natural(child, across, skin));
      const crossRoom = inner[across],
        crossLength = measure(crossWant, crossRoom);
      const crossAt =
        align === 'center' ? (crossRoom - crossLength) / 2 : align === 'end' ? crossRoom - crossLength : 0;
      const box =
        layout === 'row'
          ? { x: inner.x + cursor, y: inner.y + crossAt, width: length, height: crossLength }
          : { x: inner.x + crossAt, y: inner.y + cursor, width: crossLength, height: length };
      put(child, index, { ...box, x: box.x + (child.x ?? 0), y: box.y + (child.y ?? 0) });
      cursor += length + gap + spread;
    });
  };
  put(
    variant === 'portrait' ? description.portrait! : description.root,
    -1,
    placeFree(variant === 'portrait' ? description.portrait! : description.root, area, skin)
  );
  return Object.freeze({ variant, area, parts: Object.freeze(parts), names, skin });
}

/** A part in a panel that lays out freely: its size against the panel, then its place from its anchor, inward. */
function placeFree(part: ViewPart, inner: ViewRect, skin: ViewSkin): ViewRect {
  const width = measure(part.width ?? natural(part, 'width', skin), inner.width),
    height = measure(part.height ?? natural(part, 'height', skin), inner.height);
  const anchor = part.anchor ?? 'top-left',
    dx = part.x ?? 0,
    dy = part.y ?? 0;
  const across = anchor.endsWith('left') ? 'start' : anchor.endsWith('right') ? 'end' : 'middle',
    down = anchor.startsWith('top') ? 'start' : anchor.startsWith('bottom') ? 'end' : 'middle';
  const horizontal = anchor === 'left' ? 'start' : anchor === 'right' ? 'end' : across,
    vertical = anchor === 'left' || anchor === 'right' || anchor === 'center' ? 'middle' : down;
  return {
    x:
      horizontal === 'start'
        ? inner.x + dx
        : horizontal === 'end'
          ? inner.x + inner.width - width - dx
          : inner.x + (inner.width - width) / 2 + dx,
    y:
      vertical === 'start'
        ? inner.y + dy
        : vertical === 'end'
          ? inner.y + inner.height - height - dy
          : inner.y + (inner.height - height) / 2 + dy,
    width,
    height
  };
}
