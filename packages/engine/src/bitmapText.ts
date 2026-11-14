// SPDX-License-Identifier: Apache-2.0
import { AssetLease, DisplayObjectContainer, EgretError, Mesh2D } from '@egret/runtime';
import type { Texture } from '@egret/runtime';
import { createTexturedGeometry2D } from '@egret/contracts';
import { isBitmapFont } from './bitmapFontParse.js';
import type { BitmapFont, BitmapGlyph, BitmapText, BitmapTextGlyph, BitmapTextLayout, BitmapTextLayoutOptions, BitmapTextLine, BitmapTextOptions } from './bitmapFontTypes.js';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const invalid = (): EgretError => new EgretError('BITMAP_TEXT_OPTIONS_INVALID');
/** A channel of a colour as it is seen, in the linear light the renderer multiplies a texture by, so that white drawn in a colour shows that colour. */
const linear = (channel: number): number => { const c = channel / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
/** The most characters one page can draw in one mesh: four corners each, and no more corners than a mesh may have. */
const MOST_PER_PAGE = 16384;

const SPACE = 32, IDEOGRAPHIC_SPACE = 0x3000;
const isSpace = (code: number): boolean => code === SPACE || code === IDEOGRAPHIC_SPACE;
/** Scripts written without spaces between words, which may be broken between any two of their characters. */
const isIdeograph = (code: number): boolean => (code >= 0x2e80 && code <= 0x9fff) || (code >= 0xac00 && code <= 0xd7af) || (code >= 0xf900 && code <= 0xfaff)
  || (code >= 0xff00 && code <= 0xffef) || (code >= 0x20000 && code <= 0x3ffff);
/** Marks that stay with what is before them, and marks that stay with what is after them, so that no line starts or ends with one. */
const CLOSING = new Set([...'，。、；：！？）》」』】〕〉…·”’,.;:!?)]}%'].map(c => c.codePointAt(0)!));
const OPENING = new Set([...'（《「『【〔〈“‘([{'].map(c => c.codePointAt(0)!));

interface Options { maxWidth: number | undefined; align: 'left' | 'center' | 'right'; letterSpacing: number; lineSpacing: number; kerning: boolean; fallback: string | null | undefined }
function optionsOf(o: BitmapTextLayoutOptions): Options {
  if (!record(o)) throw invalid();
  const { maxWidth, align = 'left', letterSpacing = 0, lineSpacing = 0, kerning = true, fallback } = o;
  if ((maxWidth !== undefined && (!finite(maxWidth) || maxWidth < 0)) || (align !== 'left' && align !== 'center' && align !== 'right') || !finite(letterSpacing) || !finite(lineSpacing)
    || typeof kerning !== 'boolean' || (fallback !== undefined && fallback !== null && (typeof fallback !== 'string' || [...fallback].length !== 1))) throw invalid();
  return { maxWidth, align, letterSpacing, lineSpacing, kerning, fallback };
}

interface Char { code: number; glyph: BitmapGlyph | undefined; advance: number }
function layout(font: BitmapFont, text: string, o: Options): BitmapTextLayout {
  if (typeof text !== 'string') throw invalid();
  const fallbackCode = o.fallback === null ? undefined : (o.fallback ?? '?').codePointAt(0)!, fallback = fallbackCode === undefined ? undefined : font.glyph(fallbackCode);
  // A font without a space still has one: a third of the height of its line, as Egret's bitmap text had.
  const blank = Math.ceil(font.lineHeight * 0.33);
  let missing = 0;
  const charOf = (code: number): Char => {
    const own = font.glyph(code);
    if (own !== undefined) return { code, glyph: own, advance: own.xAdvance };
    if (isSpace(code)) { const space = font.glyph(SPACE); return { code, glyph: undefined, advance: space !== undefined && code === IDEOGRAPHIC_SPACE ? space.xAdvance * 2 : blank }; }
    missing++;
    return fallback === undefined ? { code, glyph: undefined, advance: 0 } : { code, glyph: fallback, advance: fallback.xAdvance };
  };
  const between = (a: Char, b: Char): number => o.letterSpacing + (o.kerning && a.glyph !== undefined && b.glyph !== undefined ? font.kerning(a.glyph.id, b.glyph.id) : 0);
  /** May a line end before the character at `i` and the next start with it. */
  const breakBefore = (chars: readonly Char[], i: number): boolean => {
    const before = chars[i - 1]!.code, here = chars[i]!.code;
    if (CLOSING.has(here) || OPENING.has(before)) return false;
    return isSpace(before) || isIdeograph(before) || isIdeograph(here) || OPENING.has(here);
  };
  const width = (chars: readonly Char[], from: number, to: number): number => {
    let end = to;
    while (end > from && isSpace(chars[end - 1]!.code)) end--;
    let pen = 0;
    for (let i = from; i < end; i++) pen += (i > from ? between(chars[i - 1]!, chars[i]!) : 0) + chars[i]!.advance;
    return pen;
  };

  const spans: { chars: readonly Char[]; from: number; to: number }[] = [];
  if (text.length > 0) for (const paragraph of text.split(/\r\n|\r|\n/)) {
    const chars = [...paragraph].map(c => charOf(c.codePointAt(0)!));
    if (o.maxWidth === undefined || chars.length === 0) { spans.push({ chars, from: 0, to: chars.length }); continue; }
    let from = 0;
    while (from < chars.length) {
      let pen = 0, to = chars.length, lastBreak = -1;
      for (let i = from; i < chars.length; i++) {
        const next = pen + (i > from ? between(chars[i - 1]!, chars[i]!) : 0) + chars[i]!.advance;
        const breakable = i > from && breakBefore(chars, i);
        if (breakable) lastBreak = i;
        // Spaces may hang past the edge; anything else that would pass it ends the line.
        if (i > from && !isSpace(chars[i]!.code) && next > o.maxWidth + 1e-9) { to = breakable ? i : lastBreak > from ? lastBreak : i; break; }
        pen = next;
      }
      spans.push({ chars, from, to });
      from = to;
      // A line made by breaking does not start with the spaces it was broken at.
      while (from < chars.length && isSpace(chars[from]!.code)) from++;
    }
  }

  const widths = spans.map(span => width(span.chars, span.from, span.to)), box = o.maxWidth ?? Math.max(0, ...widths);
  const lines: BitmapTextLine[] = [], glyphs: BitmapTextGlyph[] = [];
  spans.forEach((span, index) => {
    const w = widths[index]!, left = o.align === 'left' ? 0 : o.align === 'right' ? box - w : Math.round((box - w) / 2), top = index * (font.lineHeight + o.lineSpacing);
    let pen = 0;
    for (let i = span.from; i < span.to; i++) {
      const char = span.chars[i]!;
      if (i > span.from) pen += between(span.chars[i - 1]!, char);
      const g = char.glyph;
      if (g !== undefined && g.width > 0 && g.height > 0) {
        glyphs.push(Object.freeze({ codePoint: char.code, page: g.page, line: index, x: left + pen + g.xOffset, y: top + g.yOffset, width: g.width, height: g.height, sourceX: g.x, sourceY: g.y }));
      }
      pen += char.advance;
    }
    let end = span.to;
    while (end > span.from && isSpace(span.chars[end - 1]!.code)) end--;
    lines.push(Object.freeze({ text: span.chars.slice(span.from, end).map(c => String.fromCodePoint(c.code)).join(''), width: w, x: left, y: top }));
  });
  const height = spans.length === 0 ? 0 : spans.length * font.lineHeight + (spans.length - 1) * o.lineSpacing;
  return Object.freeze({ width: box, height, lines: Object.freeze(lines), glyphs: Object.freeze(glyphs), missing });
}

/** Lays text out in a bitmap font without drawing it: its lines, where each character goes, and its size. */
export function layoutBitmapText(font: BitmapFont, text: string, options: BitmapTextLayoutOptions = {}): BitmapTextLayout {
  if (!isBitmapFont(font)) throw invalid();
  return layout(font, text, optionsOf(options));
}

/** Draws text in a bitmap font as one mesh for each page it uses, laid out again whenever what it shows changes. */
export function createBitmapText(options: BitmapTextOptions): BitmapText {
  if (!record(options)) throw invalid();
  const { font, pages, text: text0 = '', color: color0 = 0xffffff } = options;
  if (!isBitmapFont(font) || !Array.isArray(pages) || pages.length !== font.pages.length || !pages.every(page => page instanceof AssetLease)) throw invalid();
  const o = optionsOf(options);
  const colorOk = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffff;
  if (typeof text0 !== 'string' || !colorOk(color0)) throw invalid();
  // Each character must lie on its page, so that no character samples beyond the image.
  const sizes = pages.map(page => { const texture = (page as AssetLease<Texture>).value; return { width: texture.width, height: texture.height }; });
  for (const g of font.glyphs) {
    const size = sizes[g.page]!;
    if (g.x + g.width > size.width || g.y + g.height > size.height) throw new EgretError('BITMAP_FONT_INVALID', { cause: new TypeError('character ' + g.id + ' lies outside page ' + g.page) });
  }
  const display = new DisplayObjectContainer(), meshes: (Mesh2D | undefined)[] = pages.map(() => undefined);
  let text = text0, color = color0, current: BitmapTextLayout, closed = false;

  function draw(next: Options, nextText: string, nextColor: number): void {
    const laid = layout(font, nextText, next), byPage = pages.map((): BitmapTextGlyph[] => []);
    for (const g of laid.glyphs) byPage[g.page]!.push(g);
    if (byPage.some(list => list.length > MOST_PER_PAGE)) throw new EgretError('BITMAP_TEXT_TOO_LONG');
    const r = linear((nextColor >> 16) & 255), gr = linear((nextColor >> 8) & 255), b = linear(nextColor & 255);
    byPage.forEach((list, page) => {
      const mesh = meshes[page];
      if (list.length === 0) { if (mesh !== undefined) mesh.visible = false; return; }
      const size = sizes[page]!, n = list.length, positions = new Float64Array(n * 8), uvs = new Float64Array(n * 8), indices = new Uint32Array(n * 6), lightColors = new Float64Array(n * 16);
      list.forEach((g, k) => {
        positions.set([g.x, g.y, g.x + g.width, g.y, g.x + g.width, g.y + g.height, g.x, g.y + g.height], k * 8);
        const u0 = g.sourceX / size.width, v0 = g.sourceY / size.height, u1 = (g.sourceX + g.width) / size.width, v1 = (g.sourceY + g.height) / size.height;
        uvs.set([u0, v0, u1, v0, u1, v1, u0, v1], k * 8);
        for (let c = 0; c < 4; c++) lightColors.set([r, gr, b, 1], k * 16 + c * 4);
        indices.set([k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3], k * 6);
      });
      const geometry = createTexturedGeometry2D({ positions, uvs, lightColors, indices });
      if (mesh === undefined) { const made = new Mesh2D(pages[page]!, geometry); meshes[page] = made; display.addChild(made); }
      else { mesh.setContent(pages[page]!, geometry); mesh.visible = true; }
    });
    Object.assign(o, next); text = nextText; color = nextColor; current = laid;
  }
  const open = (): void => { if (closed) throw new EgretError('BITMAP_TEXT_CLOSED'); };
  /** Lays out with one option changed, checked as the options are, and draws it; nothing changes when it is refused. */
  const change = (patch: Partial<Options>, required = true): void => {
    if (required && Object.values(patch).includes(undefined)) throw invalid();
    open(); draw(optionsOf({ ...o, ...patch } as BitmapTextLayoutOptions), text, color);
  };
  draw(o, text, color);

  return Object.freeze({
    get state(): 'active' | 'closed' { return closed ? 'closed' : 'active'; },
    display,
    get text(): string { return text; },
    set text(value: string) { if (typeof value !== 'string') throw invalid(); open(); if (value !== text) draw(o, value, color); },
    get color(): number { return color; },
    set color(value: number) { if (!colorOk(value)) throw invalid(); open(); if (value !== color) draw(o, text, value); },
    get maxWidth(): number | undefined { return o.maxWidth; }, set maxWidth(value: number | undefined) { change({ maxWidth: value }, false); },
    get align(): 'left' | 'center' | 'right' { return o.align; }, set align(value: 'left' | 'center' | 'right') { change({ align: value }); },
    get letterSpacing(): number { return o.letterSpacing; }, set letterSpacing(value: number) { change({ letterSpacing: value }); },
    get lineSpacing(): number { return o.lineSpacing; }, set lineSpacing(value: number) { change({ lineSpacing: value }); },
    get width(): number { return current.width; },
    get height(): number { return current.height; },
    get layout(): BitmapTextLayout { return current; },
    get meshes(): readonly Mesh2D[] { return Object.freeze(meshes.filter((mesh): mesh is Mesh2D => mesh !== undefined && mesh.visible)); },
    dispose(): void {
      if (closed) return;
      closed = true;
      const failures: unknown[] = [];
      for (const mesh of meshes) try { mesh?.dispose(); } catch (cause) { failures.push(cause); }
      try { display.dispose(); } catch (cause) { failures.push(cause); }
      meshes.fill(undefined);
      if (failures.length > 0) throw new EgretError('BITMAP_TEXT_CLEANUP_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
    },
  });
}
