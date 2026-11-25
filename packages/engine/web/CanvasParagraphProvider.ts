// SPDX-License-Identifier: Apache-2.0
// A paragraph provider that needs no WebAssembly: words are measured and drawn with a canvas's 2D context, as a page or
// a WeChat mini game gives one, and wrapped by rules for Chinese, Japanese and English (no line starts with a closing
// mark such as ，。 and none ends with an opening one such as （《). It answers the same requests as the CanvasKit
// provider: a width, a minimum line height, alignment, a line cap with an ellipsis, styled runs with their own family,
// size and colour, and the geometry of every character for carets, hits and selections.
import { createImageData2D, IMAGE_LIMITS_2D } from '@egret/contracts';
import type { CancellationSignal } from '@egret/contracts';
import { EgretError } from '@egret/runtime';
import type {
  ParagraphLine,
  ParagraphProvider,
  ParagraphRaster,
  ParagraphRequest,
  ParagraphTextCluster,
  ParagraphTextLine
} from '@egret/engine/paragraph';

/** What the provider draws with: a canvas whose 2D context measures and fills words. */
export interface CanvasParagraphCanvas {
  width: number;
  height: number;
  getContext(kind: '2d', options?: object): CanvasParagraphContext | null;
}
/** The part of a 2D context the provider uses. */
export interface CanvasParagraphContext {
  font: string;
  fillStyle: unknown;
  textBaseline: string;
  textAlign: string;
  measureText(text: string): {
    readonly width: number;
    readonly actualBoundingBoxLeft?: number;
    readonly actualBoundingBoxRight?: number;
    readonly actualBoundingBoxAscent?: number;
    readonly actualBoundingBoxDescent?: number;
    readonly fontBoundingBoxAscent?: number;
    readonly fontBoundingBoxDescent?: number;
  };
  fillText(text: string, x: number, y: number): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  getImageData(x: number, y: number, width: number, height: number): { readonly data: ArrayLike<number> };
}
/** A canvas paragraph provider to make. */
export interface CanvasParagraphProviderOptions {
  /**
   * The families a request may name, as the canvas knows them: fonts the page or the mini game has loaded
   * (`FontFace`, `wx.loadFont`) or generic families such as `sans-serif`. Any family is admitted when not given.
   */
  readonly families?: readonly string[];
  /** Host-declared identity of those fonts, so that caches keep results of other fonts apart. */
  readonly buildIdentity?: string;
  /** Makes the canvas it draws on; `document.createElement('canvas')` unless given. */
  readonly createCanvas?: () => CanvasParagraphCanvas;
}
/** Lays out and draws paragraphs with a canvas's 2D context; dispose of it when done. */
export interface CanvasParagraphProvider extends ParagraphProvider {
  dispose(): void;
}

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'emoji', 'math']);
const HARD_BREAK = /^(?:\r\n|[\n\r\u2028\u2029])$/;
// Marks that may not start a line, and marks that may not end one (Chinese and Japanese line breaking).
const NO_START = new Set(
  Array.from(
    '，。、；：！？）》」』】〕〉〗〙〛’”…‥·・%‰℃,.;:!?)]}>ー々〻ゝゞヽヾぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ〜～'
  )
);
const NO_END = new Set(Array.from('（《「『【〔〈〖〘〚‘“([{<￥$£€#'));

function bounded(value: number, low: number, high: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high)
    throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  return value;
}
function token(value: unknown, limit: number): string {
  if (typeof value !== 'string' || !value.length || value.length > limit || /[\x00-\x1f\x7f]/.test(value))
    throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  return value;
}
/** Whether a code point is set in a script written without spaces, where a line may break between characters. */
function wide(point: number): boolean {
  return (
    (point >= 0x1100 && point <= 0x115f) ||
    (point >= 0x2e80 && point <= 0x303e) ||
    (point >= 0x3041 && point <= 0x33ff) ||
    (point >= 0x3400 && point <= 0x4dbf) ||
    (point >= 0x4e00 && point <= 0x9fff) ||
    (point >= 0xa960 && point <= 0xa97f) ||
    (point >= 0xac00 && point <= 0xd7ff) ||
    (point >= 0xf900 && point <= 0xfaff) ||
    (point >= 0xfe30 && point <= 0xfe4f) ||
    (point >= 0xff00 && point <= 0xff60) ||
    (point >= 0xffe0 && point <= 0xffe6) ||
    (point >= 0x1f300 && point <= 0x1faff) ||
    (point >= 0x20000 && point <= 0x3fffd)
  );
}
/** Letters of scripts set right to left, which this provider does not order. */
function rightToLeft(point: number): boolean {
  return (
    (point >= 0x0590 && point <= 0x08ff) ||
    (point >= 0xfb1d && point <= 0xfdff) ||
    (point >= 0xfe70 && point <= 0xfeff) ||
    (point >= 0x10800 && point <= 0x10fff) ||
    (point >= 0x1e800 && point <= 0x1efff)
  );
}
/** Marks that belong to the character before them. */
function joins(point: number): boolean {
  return (
    (point >= 0x0300 && point <= 0x036f) ||
    (point >= 0x1ab0 && point <= 0x1aff) ||
    (point >= 0x1dc0 && point <= 0x1dff) ||
    (point >= 0x20d0 && point <= 0x20ff) ||
    (point >= 0xfe00 && point <= 0xfe0f) ||
    (point >= 0xfe20 && point <= 0xfe2f) ||
    (point >= 0x1f3fb && point <= 0x1f3ff) ||
    (point >= 0xe0020 && point <= 0xe007f) ||
    (point >= 0xe0100 && point <= 0xe01ef) ||
    point === 0x200d ||
    point === 0x3099 ||
    point === 0x309a
  );
}
/** The characters of a text as a reader counts them: [start, end) in UTF-16 units. */
function graphemes(text: string): readonly (readonly [number, number])[] {
  const Segmenter = (
    Intl as {
      Segmenter?: new (
        locale?: string,
        options?: object
      ) => { segment(text: string): Iterable<{ index: number; segment: string }> };
    }
  ).Segmenter;
  const out: [number, number][] = [];
  if (typeof Segmenter === 'function') {
    for (const piece of new Segmenter(undefined, { granularity: 'grapheme' }).segment(text))
      out.push([piece.index, piece.index + piece.segment.length]);
    return out;
  }
  for (let index = 0; index < text.length; ) {
    let end = index;
    const step = (at: number): number => (text.codePointAt(at)! > 0xffff ? 2 : 1);
    if (text.charCodeAt(index) === 13 && text.charCodeAt(index + 1) === 10) end = index + 2;
    else {
      end = index + step(index);
      // Marks, joiners and what a joiner joins stay with the character.
      while (end < text.length) {
        const point = text.codePointAt(end)!;
        if (joins(point)) {
          const joiner = point === 0x200d;
          end += step(end);
          if (joiner && end < text.length) end += step(end);
        } else break;
      }
    }
    out.push([index, end]);
    index = end;
  }
  return out;
}

type Reading = ReturnType<CanvasParagraphContext['measureText']>;
interface Style {
  readonly families: readonly string[];
  readonly size: number;
  readonly color: number;
  readonly font: string;
}
interface Cluster {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly style: Style;
  readonly kind: 'space' | 'break' | 'wide' | 'word';
  width: number;
}
interface Laid {
  readonly clusters: Cluster[];
  /** Pen positions of the clusters from the line's left, before alignment. */
  readonly x: number[];
  /** The source range the line covers, its trailing spaces included and its hard break left out. */
  readonly start: number;
  end: number;
  /** Width of what shows: trailing spaces left out, but for a capped line, whose ellipsis is not counted. */
  width: number;
  /** For a capped line, the width it takes with its ellipsis, by which it is aligned. */
  reach?: number;
  /** Whether a hard break or the end of the text ends it. */
  readonly last: boolean;
}

/** Lays out and draws paragraphs with a canvas's 2D context, with no WebAssembly. */
export function createCanvasParagraphProvider(options: CanvasParagraphProviderOptions = {}): CanvasParagraphProvider {
  if (options === null || typeof options !== 'object') throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  const families = options.families === undefined ? undefined : new Set(options.families.map(name => token(name, 256)));
  if (families !== undefined && (families.size < 1 || families.size > 64))
    throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  if (options.buildIdentity !== undefined) token(options.buildIdentity, 512);
  const make =
    options.createCanvas ??
    ((): CanvasParagraphCanvas => {
      if (typeof document === 'undefined' || typeof document.createElement !== 'function')
        throw new EgretError('PARAGRAPH_BACKEND_UNAVAILABLE');
      return document.createElement('canvas') as unknown as CanvasParagraphCanvas;
    });
  if (typeof make !== 'function') throw new EgretError('PARAGRAPH_REQUEST_INVALID');
  // One canvas for measuring, kept for the provider's life; each raster draws on a canvas of its own.
  const measuring = make();
  measuring.width = 1;
  measuring.height = 1;
  const measured = measuring.getContext('2d');
  if (
    measured === null ||
    typeof measured !== 'object' ||
    typeof measured.measureText !== 'function' ||
    typeof measured.fillText !== 'function' ||
    typeof measured.getImageData !== 'function'
  )
    throw new EgretError('PARAGRAPH_BACKEND_UNAVAILABLE');
  const measure: CanvasParagraphContext = measured;
  const identity =
    'egret.canvas-paragraph.v1:' +
    JSON.stringify([options.buildIdentity ?? 'host-fonts', families === undefined ? '*' : [...families].sort()]);
  const capabilities = Object.freeze({ styledRuns: true, textAlign: true, textGeometry: true, maxLines: true });
  let closed = false,
    busy = false;
  const widths = new Map<string, number>();
  const fontMetrics = new Map<string, { ascent: number; descent: number }>();

  const fontOf = (names: readonly string[], size: number): string =>
    size + 'px ' + names.map(name => (GENERIC.has(name) ? name : '"' + name.replace(/["\\]/g, '') + '"')).join(', ');
  const widthOf = (font: string, text: string): number => {
    const key = font + '\u0000' + text;
    let width = widths.get(key);
    if (width === undefined) {
      measure.font = font;
      width = measure.measureText(text).width;
      if (typeof width !== 'number' || !Number.isFinite(width) || width < 0)
        throw new EgretError('PARAGRAPH_BACKEND_UNAVAILABLE');
      if (widths.size > 65536) widths.clear();
      widths.set(key, width);
    }
    return width;
  };
  /**
   * The ascent and descent of the first font of a CSS font, as the font gives them. They are read at a large size and
   * scaled, as a canvas gives them in whole pixels.
   */
  const metricsOf = (font: string, size: number): { ascent: number; descent: number } => {
    let found = fontMetrics.get(font);
    if (found === undefined) {
      measure.font = font.replace(/^[\d.]+px /, '1000px ');
      const read = measure.measureText('Hg');
      const scale = size / 1000;
      const sample = {
        fontBoundingBoxAscent:
          read.fontBoundingBoxAscent === undefined ? undefined : read.fontBoundingBoxAscent * scale,
        fontBoundingBoxDescent:
          read.fontBoundingBoxDescent === undefined ? undefined : read.fontBoundingBoxDescent * scale,
        actualBoundingBoxAscent:
          read.actualBoundingBoxAscent === undefined ? undefined : read.actualBoundingBoxAscent * scale,
        actualBoundingBoxDescent:
          read.actualBoundingBoxDescent === undefined ? undefined : read.actualBoundingBoxDescent * scale
      };
      // The font's own ascent and descent where the canvas gives them; otherwise what its tallest letters reach.
      const ascent =
        sample.fontBoundingBoxAscent ??
        (sample.actualBoundingBoxAscent !== undefined ? sample.actualBoundingBoxAscent * 1.25 : size * 0.95);
      const descent =
        sample.fontBoundingBoxDescent ??
        (sample.actualBoundingBoxDescent !== undefined ? sample.actualBoundingBoxDescent * 1.25 : size * 0.25);
      found = { ascent: Math.max(0, ascent), descent: Math.max(0, descent) };
      if (fontMetrics.size > 4096) fontMetrics.clear();
      fontMetrics.set(font, found);
    }
    return found;
  };
  const sameReading = (a: Reading, b: Reading): boolean => {
    const same = (x: number | undefined, y: number | undefined): boolean =>
      x === undefined || y === undefined || Math.abs(x - y) < 0.01;
    return (
      same(a.width, b.width) &&
      same(a.actualBoundingBoxLeft, b.actualBoundingBoxLeft) &&
      same(a.actualBoundingBoxRight, b.actualBoundingBoxRight) &&
      same(a.actualBoundingBoxAscent, b.actualBoundingBoxAscent) &&
      same(a.actualBoundingBoxDescent, b.actualBoundingBoxDescent)
    );
  };
  const resolved = new Map<string, string>();
  /**
   * The family of a style that draws a character. A canvas does not say which font it fell back to, so each family is
   * asked alone and its drawing compared with the whole list's. A family that lacks the character falls back to the
   * system's font, which may be the same design as a later family; the last family that matches is taken, so that a
   * character a later family draws is not given to an earlier one.
   */
  const familyOf = (style: Style, piece: string): string => {
    const first = style.families[0]!;
    if (style.families.length === 1 || GENERIC.has(first)) return first;
    const key = style.font + '\u0000' + piece;
    let found = resolved.get(key);
    if (found === undefined) {
      measure.font = style.font;
      const whole = measure.measureText(piece);
      let generic: string | undefined, matched: string | undefined;
      for (const family of style.families) {
        if (GENERIC.has(family)) {
          generic ??= family;
          continue;
        }
        measure.font = fontOf([family], style.size);
        if (sameReading(measure.measureText(piece), whole)) matched = family;
      }
      found = matched ?? generic ?? first;
      if (resolved.size > 65536) resolved.clear();
      resolved.set(key, found);
    }
    return found;
  };
  const owned = new Map<string, boolean>();
  /** Whether a family has a character of its own: drawn alike whichever font follows it. */
  const hasOwn = (family: string, size: number, piece: string): boolean => {
    if (GENERIC.has(family)) return true;
    const key = family + '\u0000' + size + '\u0000' + piece;
    let found = owned.get(key);
    if (found === undefined) {
      measure.font = fontOf([family, 'serif'], size);
      const serif = measure.measureText(piece);
      measure.font = fontOf([family, 'monospace'], size);
      found = sameReading(serif, measure.measureText(piece));
      if (owned.size > 4096) owned.clear();
      owned.set(key, found);
    }
    return found;
  };
  /** The ascent and descent of the font that draws a character. */
  const glyphMetrics = (cluster: Cluster): { ascent: number; descent: number } =>
    metricsOf(fontOf([familyOf(cluster.style, cluster.text)], cluster.style.size), cluster.style.size);

  const provider: CanvasParagraphProvider = Object.freeze({
    identity,
    capabilities,
    async prepare(
      this: CanvasParagraphProvider,
      request: ParagraphRequest,
      context: { signal: CancellationSignal }
    ): Promise<ParagraphRaster> {
      if (this !== provider || busy) throw new EgretError('PARAGRAPH_PROVIDER_BUSY');
      if (closed) throw new EgretError('PARAGRAPH_PROVIDER_DISPOSED');
      if (context?.signal?.aborted)
        throw new EgretError('PARAGRAPH_PREPARE_CANCELLED', { cause: context.signal.reason });
      busy = true;
      try {
        return layout(request);
      } finally {
        busy = false;
      }
    },
    dispose(this: CanvasParagraphProvider): void {
      if (this !== provider) throw new EgretError('PARAGRAPH_PROVIDER_INVALID');
      if (busy) throw new EgretError('PARAGRAPH_PROVIDER_BUSY');
      closed = true;
      widths.clear();
      fontMetrics.clear();
      resolved.clear();
      measuring.width = 0;
      measuring.height = 0;
    }
  });

  function layout(request: ParagraphRequest): ParagraphRaster {
    const text = request.text;
    if (typeof text !== 'string' || text.length > 8192) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
    const width = bounded(request.width, 0.25, 4096),
      density = bounded(request.density, 0.25, 4);
    bounded(request.fontSize, 1, 512);
    if (request.lineHeight !== undefined) bounded(request.lineHeight, 1, 1024);
    if (!Number.isInteger(request.fillColor) || request.fillColor < 0 || request.fillColor > 0xffffff)
      throw new EgretError('PARAGRAPH_REQUEST_INVALID');
    token(request.locale, 64);
    if (request.direction !== 'ltr') throw new EgretError('PARAGRAPH_FEATURE_UNSUPPORTED');
    const named = (names: unknown): readonly string[] => {
      if (!Array.isArray(names) || names.length < 1 || names.length > 16)
        throw new EgretError('PARAGRAPH_REQUEST_INVALID');
      for (const name of names) {
        token(name, 256);
        if (families !== undefined && !families.has(name)) throw new EgretError('PARAGRAPH_FONT_NOT_REGISTERED');
      }
      return Object.freeze([...names]);
    };
    const baseFamilies = named(request.fontFamilies);
    const base: Style = {
      families: baseFamilies,
      size: request.fontSize,
      color: request.fillColor,
      font: fontOf(baseFamilies, request.fontSize)
    };
    const textAlign = request.textAlign ?? 'left',
      maxLines = request.maxLines;
    if (!['left', 'right', 'center', 'start', 'end', 'justify'].includes(textAlign))
      throw new EgretError('PARAGRAPH_REQUEST_INVALID');
    if (maxLines !== undefined && (!Number.isSafeInteger(maxLines) || maxLines < 1 || maxLines > 8193))
      throw new EgretError('PARAGRAPH_REQUEST_INVALID');
    // The style of every UTF-16 unit: the request's, or the run that covers it.
    const styles: Style[] = new Array(text.length).fill(base);
    const runs = request.runs ?? [];
    if (!Array.isArray(runs) || runs.length > 256) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
    let previous = 0;
    for (const run of runs) {
      if (
        run === null ||
        typeof run !== 'object' ||
        !Number.isSafeInteger(run.start) ||
        !Number.isSafeInteger(run.end) ||
        run.start < previous ||
        run.end <= run.start ||
        run.end > text.length ||
        (run.fontFamilies === undefined && run.fontSize === undefined && run.fillColor === undefined)
      )
        throw new EgretError('PARAGRAPH_REQUEST_INVALID');
      const runFamilies = run.fontFamilies === undefined ? base.families : named(run.fontFamilies);
      const size = run.fontSize === undefined ? base.size : bounded(run.fontSize, 1, 512);
      const color = run.fillColor === undefined ? base.color : run.fillColor;
      if (!Number.isInteger(color) || color < 0 || color > 0xffffff) throw new EgretError('PARAGRAPH_REQUEST_INVALID');
      const style: Style = { families: runFamilies, size, color, font: fontOf(runFamilies, size) };
      for (let index = run.start; index < run.end; index++) styles[index] = style;
      previous = run.end;
    }

    // Characters, each with its kind and its own width.
    const clusters: Cluster[] = [];
    for (const [start, end] of graphemes(text)) {
      const piece = text.slice(start, end);
      const point = piece.codePointAt(0)!;
      if (rightToLeft(point)) throw new EgretError('PARAGRAPH_FEATURE_UNSUPPORTED');
      const kind = HARD_BREAK.test(piece)
        ? 'break'
        : piece === ' ' || piece === '\t'
          ? 'space'
          : wide(point)
            ? 'wide'
            : 'word';
      const style = styles[start]!;
      clusters.push({ start, end, text: piece === '\t' ? ' ' : piece, style, kind, width: 0 });
    }
    // Where a line may break: before each index in this set.
    const mayBreak = (index: number): boolean => {
      const before = clusters[index - 1]!,
        after = clusters[index]!;
      if (after.kind === 'space' || after.kind === 'break') return false;
      if (NO_START.has(after.text) || NO_END.has(before.text)) return false;
      if (before.kind === 'space') return true;
      if (before.kind === 'wide' || after.kind === 'wide') return true;
      return (before.text === '-' || before.text === '\u2010' || before.text === '/') && after.kind === 'word';
    };

    // Lines: units between break opportunities, as many as fit, measured by the runs of one font within each.
    const lines: Laid[] = [];
    // A run measured as one: letters and spaces of one font. A wide character is measured alone, as CanvasKit sets it:
    // no kerning in it and no trimming of the space of full-width marks next to each other.
    const together = (a: Cluster, b: Cluster): boolean =>
      a.style.font === b.style.font && a.kind !== 'wide' && b.kind !== 'wide';
    const segmentWidth = (from: number, to: number): number => {
      let total = 0;
      for (let index = from; index < to; ) {
        let end = index + 1;
        while (end < to && together(clusters[end - 1]!, clusters[end]!)) end++;
        total += widthOf(
          clusters[index]!.style.font,
          clusters
            .slice(index, end)
            .map(c => c.text)
            .join('')
        );
        index = end;
      }
      return total;
    };
    const visibleEnd = (from: number, to: number): number => {
      let end = to;
      while (end > from && clusters[end - 1]!.kind === 'space') end--;
      return end;
    };
    const pushLine = (from: number, to: number, last: boolean): void => {
      const own = clusters.slice(from, to);
      const x: number[] = [];
      // Pen positions: a run of letters is measured from its start, so kerning is kept, and a pair's kerning is given
      // to the first of the two, as a font's advances give it.
      let pen = 0;
      for (let k = 0; k < own.length; ) {
        let end = k + 1;
        while (end < own.length && together(own[end - 1]!, own[end]!)) end++;
        const font = own[k]!.style.font;
        let prefix = '';
        for (let at = k; at < end; at++) {
          prefix += own[at]!.text;
          const place =
            at === k ? pen : Math.max(x[at - 1]!, pen + widthOf(font, prefix) - widthOf(font, own[at]!.text));
          x.push(place);
        }
        const runEnd = Math.max(x[end - 1]!, pen + widthOf(font, prefix));
        for (let at = k; at < end; at++) own[at]!.width = Math.max(0, (at + 1 < end ? x[at + 1]! : runEnd) - x[at]!);
        pen = runEnd;
        k = end;
      }
      const shown = visibleEnd(from, to) - from;
      const at = from < clusters.length ? clusters[from]!.start : text.length;
      lines.push({
        clusters: own,
        x,
        start: own.length ? own[0]!.start : at,
        end: own.length ? own[own.length - 1]!.end : at,
        width: shown === 0 ? 0 : x[shown - 1]! + own[shown - 1]!.width,
        last
      });
    };
    const fits = (from: number, to: number): boolean => segmentWidth(from, visibleEnd(from, to)) <= width + 0.001;
    for (let index = 0; ; ) {
      // A hard break or the end of the text ends a run of lines.
      let stop = index;
      while (stop < clusters.length && clusters[stop]!.kind !== 'break') stop++;
      if (index === stop) pushLine(index, stop, true);
      for (let from = index; from < stop; ) {
        // As many whole units as fit; a unit is what lies between two places a line may break.
        let fit = from;
        while (fit < stop) {
          let unitEnd = fit + 1;
          while (unitEnd < stop && !mayBreak(unitEnd)) unitEnd++;
          if (!fits(from, unitEnd)) break;
          fit = unitEnd;
        }
        // A first unit wider than the line is cut between characters, at least one to a line.
        if (fit === from) {
          fit = from + 1;
          while (fit < stop && clusters[fit]!.kind !== 'space' && fits(from, fit + 1)) fit++;
        }
        // Spaces after the last unit stay on the line, hanging past its edge.
        while (fit < stop && clusters[fit]!.kind === 'space') fit++;
        pushLine(from, fit, fit >= stop);
        from = fit;
      }
      if (stop >= clusters.length) break;
      // After a hard break comes another line, empty when the text ends with the break.
      index = stop + 1;
    }
    if (!lines.length) pushLine(0, 0, true);

    // A line cap, as CanvasKit ends the last line kept: characters come off its end, trailing spaces among them,
    // until an ellipsis fits after the rest. The ellipsis is set in the font of the last character kept when that font
    // has one, and otherwise in the first family of that character's style that has one.
    let truncated: boolean | undefined = maxLines === undefined ? undefined : false;
    let ellipsis: { x: number; style: Style; width: number } | undefined;
    if (maxLines !== undefined && lines.length > maxLines) {
      truncated = true;
      lines.length = maxLines;
      const line = lines[maxLines - 1]!;
      const markAfter = (cluster: Cluster | undefined): Style => {
        const style = cluster?.style ?? base;
        const own = cluster === undefined ? undefined : familyOf(style, cluster.text);
        const family = own !== undefined && hasOwn(own, style.size, '\u2026') ? own : familyOf(style, '\u2026');
        return { ...style, families: [family], font: fontOf([family], style.size) };
      };
      let keep = line.clusters.length,
        mark = markAfter(undefined);
      for (; keep > 0; keep--) {
        mark = markAfter(line.clusters[keep - 1]);
        if (line.x[keep - 1]! + line.clusters[keep - 1]!.width + widthOf(mark.font, '\u2026') <= width + 0.001) break;
      }
      if (keep === 0) mark = markAfter(undefined);
      const markWidth = widthOf(mark.font, '\u2026');
      if (markWidth > width + 0.001) throw new EgretError('PARAGRAPH_ELLIPSIS_DOES_NOT_FIT');
      line.clusters.length = keep;
      line.x.length = keep;
      const shown = keep === 0 ? 0 : line.x[keep - 1]! + line.clusters[keep - 1]!.width;
      ellipsis = { x: shown, style: mark, width: markWidth };
      line.end = keep === 0 ? line.start : line.clusters[keep - 1]!.end;
      line.width = shown;
      line.reach = shown + markWidth;
    }

    // Vertical metrics: each line as tall as its tallest font, and at least the requested line height.
    let top = 0;
    const metricLines: ParagraphLine[] = [];
    const geometryLines: ParagraphTextLine[] = [];
    const geometryClusters: ParagraphTextCluster[] = [];
    const draws: { text: string; x: number; y: number; style: Style }[] = [];
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex]!;
      // As CanvasKit lays a line out: with a minimum line height, by that height, whose extra room is shared above and
      // below the first family's font, and by the first family's fonts at the sizes the line uses; without one, by
      // every font its characters are drawn in. The height is rounded to a whole unit, the difference taken above.
      // The fonts characters fall back to give their reach to what the line reports and to their boxes.
      const first = (size: number) => metricsOf(fontOf([base.families[0]!], size), size);
      const strut = request.lineHeight === undefined ? undefined : first(base.size);
      const room0 = strut === undefined ? 0 : request.lineHeight! - strut.ascent - strut.descent;
      let layoutAscent = strut === undefined ? 0 : strut.ascent + room0 / 2,
        layoutDescent = strut === undefined ? 0 : strut.descent + room0 / 2,
        ascent = 0,
        descent = 0;
      const shownClusters = line.clusters.filter(c => c.kind !== 'break');
      for (const cluster of shownClusters.length ? shownClusters : []) {
        const own = glyphMetrics(cluster),
          layout = metricsOf(fontOf([cluster.style.families[0]!], cluster.style.size), cluster.style.size);
        ascent = Math.max(ascent, own.ascent);
        descent = Math.max(descent, own.descent);
        layoutAscent = Math.max(layoutAscent, strut === undefined ? own.ascent : layout.ascent);
        layoutDescent = Math.max(layoutDescent, strut === undefined ? own.descent : layout.descent);
      }
      if (!shownClusters.length) {
        const own = first(base.size);
        ascent = own.ascent;
        descent = own.descent;
        layoutAscent = Math.max(layoutAscent, own.ascent);
        layoutDescent = Math.max(layoutDescent, own.descent);
      }
      const natural = layoutAscent + layoutDescent;
      const height = Math.max(Math.round(natural), request.lineHeight ?? 0);
      const baseline = top + layoutAscent + (height - natural);
      // Alignment, and for justified text the room shared between the gaps of every line but a last.
      const physical = textAlign === 'start' ? 'left' : textAlign === 'end' ? 'right' : textAlign;
      const room = Math.max(0, width - (line.reach ?? line.width));
      let left = physical === 'center' ? room / 2 : physical === 'right' ? room : 0;
      let stretch: number[] | undefined;
      if (physical === 'justify' && !line.last && !(truncated && lineIndex === lines.length - 1) && room > 0) {
        const shown = visibleEnd(0, line.clusters.length);
        const spaces = line.clusters
          .slice(0, shown)
          .map((c, k) => (c.kind === 'space' && k > 0 ? k : -1))
          .filter(k => k > 0);
        const gaps = spaces.length ? spaces : Array.from({ length: Math.max(0, shown - 1) }, (_, k) => k + 1);
        if (gaps.length) {
          const each = room / gaps.length;
          stretch = new Array(line.clusters.length).fill(0);
          let add = 0;
          for (let k = 0; k < line.clusters.length; k++) {
            if (gaps.includes(k)) add += each;
            stretch[k] = add;
          }
          line.width = width;
          left = 0;
        }
      }
      const lineTop = baseline - ascent,
        lineBottom = lineTop + height;
      for (let k = 0; k < line.clusters.length; k++) {
        const cluster = line.clusters[k]!;
        const x = left + line.x[k]! + (stretch?.[k] ?? 0);
        // The last character before an ellipsis answers for it as well, as CanvasKit gives the ellipsis to it.
        const right =
          x +
          cluster.width +
          (cluster.kind === 'space' && stretch && k + 1 < line.clusters.length ? stretch[k + 1]! - stretch[k]! : 0) +
          (ellipsis !== undefined && lineIndex === lines.length - 1 && k === line.clusters.length - 1
            ? ellipsis.width
            : 0);
        geometryClusters.push(
          Object.freeze({
            start: cluster.start,
            end: cluster.end,
            lineIndex,
            direction: 'ltr' as const,
            left: x,
            top: baseline - glyphMetrics(cluster).ascent,
            right: Math.max(x, right),
            bottom: baseline + glyphMetrics(cluster).descent
          })
        );
        if (cluster.kind !== 'space') draws.push({ text: cluster.text, x, y: baseline, style: cluster.style });
      }
      if (ellipsis !== undefined && lineIndex === lines.length - 1)
        draws.push({ text: '\u2026', x: left + ellipsis.x, y: baseline, style: ellipsis.style });
      const shownEnd = line.clusters.length ? line.clusters[line.clusters.length - 1]!.end : line.start;
      metricLines.push(
        Object.freeze({
          start: line.start,
          end: truncated && lineIndex === lines.length - 1 ? line.end : Math.max(line.end, shownEnd),
          baseline,
          ascent,
          descent,
          height,
          width: line.width
        })
      );
      geometryLines.push(
        Object.freeze({
          start: line.start,
          end: truncated && lineIndex === lines.length - 1 ? line.end : Math.max(line.end, shownEnd),
          left,
          right: left + (line.reach ?? line.width),
          top: lineTop,
          bottom: lineBottom
        })
      );
      top += height;
    }
    const metrics = Object.freeze({
      width,
      height: top,
      lines: Object.freeze(metricLines),
      ...(truncated === undefined ? {} : { truncated })
    });
    const geometry = request.textGeometry
      ? Object.freeze({ lines: Object.freeze(geometryLines), clusters: Object.freeze(geometryClusters) })
      : undefined;

    // Ink: where the drawn characters reach, from the canvas's own boxes where it gives them.
    let inkLeft = Infinity,
      inkTop = Infinity,
      inkRight = -Infinity,
      inkBottom = -Infinity;
    for (const draw of draws) {
      measure.font = draw.style.font;
      const box = measure.measureText(draw.text);
      const m = metricsOf(draw.style.font, draw.style.size);
      const l = draw.x - (box.actualBoundingBoxLeft ?? 0),
        r = draw.x + (box.actualBoundingBoxRight ?? box.width),
        t = draw.y - (box.actualBoundingBoxAscent ?? m.ascent),
        b = draw.y + (box.actualBoundingBoxDescent ?? m.descent);
      if (r > l && b > t) {
        inkLeft = Math.min(inkLeft, l);
        inkTop = Math.min(inkTop, t);
        inkRight = Math.max(inkRight, r);
        inkBottom = Math.max(inkBottom, b);
      }
    }
    if (!(inkLeft < inkRight && inkTop < inkBottom))
      return Object.freeze({ metrics, image: undefined, offsetX: 0, offsetY: 0, ...(geometry ? { geometry } : {}) });
    const pixelLeft = Math.floor(inkLeft * density) - 2,
      pixelTop = Math.floor(inkTop * density) - 2;
    const rasterWidth = Math.ceil(inkRight * density) + 2 - pixelLeft,
      rasterHeight = Math.ceil(inkBottom * density) + 2 - pixelTop;
    if (
      rasterWidth > IMAGE_LIMITS_2D.maxSourceEdge ||
      rasterHeight > IMAGE_LIMITS_2D.maxSourceEdge ||
      rasterWidth * rasterHeight > 1048576
    )
      throw new EgretError('PARAGRAPH_IMAGE_LIMIT');
    const canvas = make();
    try {
      canvas.width = rasterWidth;
      canvas.height = rasterHeight;
      const paint = canvas.getContext('2d', { willReadFrequently: true });
      if (paint === null || typeof paint.fillText !== 'function' || typeof paint.getImageData !== 'function')
        throw new EgretError('PARAGRAPH_BACKEND_UNAVAILABLE');
      (paint as { lang?: string }).lang = request.locale;
      paint.setTransform(density, 0, 0, density, -pixelLeft, -pixelTop);
      paint.textBaseline = 'alphabetic';
      paint.textAlign = 'left';
      for (const draw of draws) {
        paint.font = draw.style.font;
        paint.fillStyle = '#' + draw.style.color.toString(16).padStart(6, '0');
        paint.fillText(draw.text, draw.x, draw.y);
      }
      const data = paint.getImageData(0, 0, rasterWidth, rasterHeight).data;
      if (data.length !== rasterWidth * rasterHeight * 4) throw new EgretError('PARAGRAPH_READBACK_REFUSED');
      const image = createImageData2D({ width: rasterWidth, height: rasterHeight, pixels: Uint8Array.from(data) });
      return Object.freeze({
        metrics,
        image,
        offsetX: pixelLeft / density,
        offsetY: pixelTop / density,
        ...(geometry ? { geometry } : {})
      });
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  return provider;
}
