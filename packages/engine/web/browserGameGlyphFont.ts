// SPDX-License-Identifier: Apache-2.0
// Build one bounded, immutable bitmap-font page at setup. Changing counters are ordinary
// BitmapText meshes, with no canvas calls, raster cache jobs or new font texture per value.
import { parseBitmapFont } from '@egret/engine/bitmapfont';
import type { BitmapFont } from '@egret/engine/bitmapfont';
import { EgretError } from '@egret/runtime';
import type { AssetLease, Scope, Texture } from '@egret/runtime';
import { gameFontFamilies } from './browserGameFamilies.js';

export interface BrowserGameGlyphFontOptions {
  /** One to 64 distinct Unicode code points drawn separately (no line breaks or contextual shaping). */
  readonly characters: string;
  readonly fontFamily?: string;
  readonly fontFamilies?: readonly string[];
  /** Font size in page pixels, from 1 to 128; 32 by default. Scale a BitmapText display to the required stage size. */
  readonly fontSize?: number;
  readonly fontWeight?: number;
  readonly italic?: boolean;
  /** Stroke radius in page pixels, from 0 to 16; 0 by default. */
  readonly strokeWidth?: number;
  readonly strokeColor?: number;
  /** The scope owning the shared page, game.scope by default. */
  readonly scope?: Scope;
}
/** Spread font and pages into createBitmapText; retire all borrowers before releasing the shared page. */
export interface BrowserGameGlyphFont {
  readonly font: BitmapFont;
  readonly pages: readonly AssetLease<Texture>[];
  dispose(): void;
}

const generics = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'emoji', 'math']);
const invalid = (): EgretError => new EgretError('BROWSER_GAME_OPTIONS_INVALID');
const metric = (value: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 4096) throw invalid();
  return value;
};
const integer = (value: number, low: number, high: number): boolean =>
  Number.isSafeInteger(value) && value >= low && value <= high;
const edge = 4096,
  area = 4194304;
const cssName = (name: string): string =>
  generics.has(name) ? name : '"' + name.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

export async function buildGameGlyphFont(
  document: Document,
  options: BrowserGameGlyphFontOptions,
  leasePixels: (width: number, height: number, pixels: Uint8ClampedArray) => Promise<AssetLease<Texture>>
): Promise<BrowserGameGlyphFont> {
  if (options === null || typeof options !== 'object') throw invalid();
  const { characters, fontSize = 32, fontWeight = 400, italic = false, strokeWidth = 0, strokeColor = 0 } = options;
  const families = gameFontFamilies(options);
  if (
    typeof characters !== 'string' ||
    characters.length > 128 ||
    !integer(fontSize, 1, 128) ||
    !integer(fontWeight, 1, 1000) ||
    typeof italic !== 'boolean' ||
    !Number.isFinite(strokeWidth) ||
    strokeWidth < 0 ||
    strokeWidth > 16 ||
    !integer(strokeColor, 0, 0xffffff)
  )
    throw invalid();
  const chars = [...characters];
  if (
    chars.length < 1 ||
    chars.length > 64 ||
    new Set(chars).size !== chars.length ||
    chars.some(char => /[\x00-\x1f\x7f-\x9f\u2028\u2029\ud800-\udfff]/u.test(char))
  )
    throw invalid();
  const fontName =
    (italic ? 'italic' : 'normal') + ' ' + fontWeight + ' ' + fontSize + 'px ' + families.map(cssName).join(', ');
  // Like the short labels, the page must load any web fonts before asking for fixed glyphs.
  if (document.fonts?.check && !document.fonts.check(fontName, characters))
    throw new EgretError('WEB_TEXT_FONT_NOT_READY');
  const canvas = document.createElement('canvas');
  try {
    canvas.width = canvas.height = 1;
    const context = (): CanvasRenderingContext2D => {
      const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
      if (!ctx) throw new EgretError('WEB_TEXT_UNAVAILABLE');
      ctx.font = fontName;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      return ctx;
    };
    const measure = context();
    const readings = chars.map(char => {
      const m = measure.measureText(char);
      const width = metric(m.width);
      if (width < 0) throw invalid();
      return {
        width,
        left: metric(m.actualBoundingBoxLeft),
        right: metric(m.actualBoundingBoxRight),
        ascent: metric(m.actualBoundingBoxAscent),
        descent: metric(m.actualBoundingBoxDescent)
      };
    });
    // Center each glyph by its advance; include both ink overhangs, the stroke, and clear guard pixels.
    const half = Math.max(0, ...readings.map(m => Math.max(m.width / 2, m.width / 2 + m.left, m.right - m.width / 2)));
    const ascent = Math.max(fontSize * 0.75, ...readings.map(m => m.ascent));
    const descent = Math.max(fontSize * 0.25, ...readings.map(m => m.descent));
    const guard = strokeWidth + 2;
    const cellW = Math.ceil(2 * (half + guard)),
      base = Math.ceil(ascent + guard);
    const cellH = base + Math.ceil(descent + guard);
    const minColumns = Math.ceil(chars.length / Math.floor(edge / cellH));
    const maxColumns = Math.min(chars.length, Math.floor(edge / cellW));
    if (minColumns > maxColumns || maxColumns < 1) throw invalid();
    const columns = Math.min(maxColumns, Math.max(minColumns, Math.ceil(Math.sqrt((chars.length * cellH) / cellW))));
    const width = columns * cellW,
      height = Math.ceil(chars.length / columns) * cellH;
    if (width * height > area) throw invalid();
    canvas.width = width;
    canvas.height = height;
    const paint = context();
    paint.fillStyle = '#ffffff';
    if (strokeWidth > 0) {
      paint.strokeStyle = '#' + strokeColor.toString(16).padStart(6, '0');
      paint.lineWidth = strokeWidth * 2;
      paint.lineJoin = 'round';
    }
    const glyphs = chars.map((char, i) => {
      const x = (i % columns) * cellW,
        y = Math.floor(i / columns) * cellH;
      const pen = x + (cellW - readings[i]!.width) / 2,
        baseline = y + base;
      if (strokeWidth > 0) paint.strokeText(char, pen, baseline);
      paint.fillText(char, pen, baseline);
      return {
        id: char.codePointAt(0)!,
        x,
        y,
        width: cellW,
        height: cellH,
        xoffset: 0,
        yoffset: 0,
        xadvance: cellW,
        page: 0
      };
    });
    const font = parseBitmapFont({
      info: { face: families[0]!, size: fontSize },
      common: { lineHeight: cellH, base, scaleW: width, scaleH: height },
      pages: ['browser-game-glyphs'],
      chars: glyphs,
      kernings: []
    });
    const pixels = paint.getImageData(0, 0, width, height).data;
    const lease = await leasePixels(width, height, pixels);
    return Object.freeze({
      font,
      pages: Object.freeze([lease]),
      dispose() {
        lease.release();
      }
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
