// SPDX-License-Identifier: Apache-2.0
// A font for 3D text read from the page's own fonts: each character is drawn
// once onto a small canvas, its edge traced into outlines and smoothed, and
// handed to Font3D as straight segments. For a few dozen signs in any script,
// Chinese included, without shipping a font file.
import { Font3D } from '../../rendering/world3d/Text3D.js';
import type { GlyphOutline3D } from '../../rendering/world3d/Text3D.js';
import { World3DError } from '../../rendering/world3d/core3D.js';

/** A canvas font to make: the page's font family, weight and style, how finely it is traced, and how much it is smoothed. */
export interface CanvasFontOptions3D {
  /** A CSS font family the page has loaded. Defaults to `sans-serif`. */
  readonly family?: string;
  /** A CSS font weight, such as `bold` or `700`. Defaults to `normal`. */
  readonly weight?: string | number;
  readonly style?: 'normal' | 'italic';
  /** Canvas pixels to one em when a character is traced, 16 to 512. Defaults to 128; more is finer and slower. */
  readonly resolution?: number;
  /** How far, in traced pixels, a smoothed outline may stray from the pixel edge. Defaults to 0.75. */
  readonly tolerance?: number;
}

type Canvas2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function canvasOf(size: number): Canvas2D | undefined {
  const Offscreen = (globalThis as { OffscreenCanvas?: typeof OffscreenCanvas }).OffscreenCanvas;
  if (typeof Offscreen === 'function')
    return new Offscreen(size, size).getContext('2d', { willReadFrequently: true }) ?? undefined;
  const doc = (globalThis as { document?: Document }).document;
  if (doc === undefined) return undefined;
  const canvas = doc.createElement('canvas');
  canvas.width = canvas.height = size;
  return canvas.getContext('2d', { willReadFrequently: true }) ?? undefined;
}

/** The loops of pixel edges around the filled pixels of a mask, each a list of corner points. */
function traceEdges(filled: Uint8Array, width: number, height: number): number[][] {
  const at = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && filled[y * width + x] === 1;
  // Directed edges with the filled pixel on their left, keyed by their start corner.
  const next = new Map<number, number[]>();
  const key = (x: number, y: number): number => y * (width + 1) + x;
  const edge = (x0: number, y0: number, x1: number, y1: number): void => {
    const from = key(x0, y0),
      list = next.get(from);
    if (list) list.push(key(x1, y1));
    else next.set(from, [key(x1, y1)]);
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!at(x, y)) continue;
      // Rows run down: going round a pixel with it on the left is anticlockwise on screen.
      if (!at(x, y - 1)) edge(x + 1, y, x, y);
      if (!at(x - 1, y)) edge(x, y, x, y + 1);
      if (!at(x, y + 1)) edge(x, y + 1, x + 1, y + 1);
      if (!at(x + 1, y)) edge(x + 1, y + 1, x + 1, y);
    }
  const loops: number[][] = [];
  for (const [start, ends] of next) {
    while (ends.length > 0) {
      const loop: number[] = [];
      let from = start,
        to = ends.pop()!;
      loop.push(from % (width + 1), Math.floor(from / (width + 1)));
      while (to !== start) {
        loop.push(to % (width + 1), Math.floor(to / (width + 1)));
        const onward = next.get(to);
        if (!onward || onward.length === 0) break;
        from = to;
        to = onward.pop()!;
      }
      if (loop.length >= 6) loops.push(loop);
    }
  }
  return loops;
}

/** Fewer points along a closed loop, each removed one within `tolerance` of the line that replaces it. */
function simplify(loop: number[], tolerance: number): number[] {
  const count = loop.length / 2;
  if (count <= 4) return loop;
  const keep = new Uint8Array(count);
  // Split the loop at its first point and the point farthest from it, and simplify each half.
  let far = 0,
    best = -1;
  for (let i = 1; i < count; i++) {
    const d = (loop[i * 2]! - loop[0]!) ** 2 + (loop[i * 2 + 1]! - loop[1]!) ** 2;
    if (d > best) {
      best = d;
      far = i;
    }
  }
  keep[0] = keep[far] = 1;
  const stack: [number, number][] = [
    [0, far],
    [far, count]
  ];
  while (stack.length > 0) {
    const [a, b] = stack.pop()!;
    const ax = loop[a * 2]!,
      ay = loop[a * 2 + 1]!,
      bx = loop[(b % count) * 2]!,
      by = loop[(b % count) * 2 + 1]!,
      length = Math.hypot(bx - ax, by - ay) || 1;
    let worst = -1,
      distance = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - loop[i * 2 + 1]!) - (ax - loop[i * 2]!) * (by - ay)) / length;
      if (d > distance) {
        distance = d;
        worst = i;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < count; i++) if (keep[i]) out.push(loop[i * 2]!, loop[i * 2 + 1]!);
  return out.length >= 6 ? out : loop;
}

/**
 * A `Font3D` whose glyphs are traced from the page's own fonts, for 3D text in any script the page can draw, such as
 * the Chinese of a road sign, without a font file. Each character is drawn and traced once, when first used. The
 * outlines are straight segments following the drawn edge, so curves are as smooth as `resolution` allows. Where the
 * page has neither `OffscreenCanvas` nor a document, it throws `WORLD3D_CONTEXT_UNAVAILABLE`.
 */
export function createCanvasFont3D(options: CanvasFontOptions3D = {}): Font3D {
  if (options === null || typeof options !== 'object') throw new World3DError('WORLD3D_INPUT_INVALID', 'canvas font');
  const family = options.family ?? 'sans-serif',
    weight = options.weight ?? 'normal',
    style = options.style ?? 'normal',
    em = options.resolution ?? 128,
    tolerance = options.tolerance ?? 0.75;
  if (
    typeof family !== 'string' ||
    family.length === 0 ||
    /[;{}]/.test(family) ||
    (typeof weight !== 'string' && typeof weight !== 'number') ||
    (style !== 'normal' && style !== 'italic') ||
    !Number.isInteger(em) ||
    em < 16 ||
    em > 512 ||
    !(tolerance >= 0 && tolerance <= 8)
  )
    throw new World3DError('WORLD3D_INPUT_INVALID', 'canvas font');
  // Room for strokes that reach past the em box on every side.
  const size = em * 2,
    left = Math.round(em / 2),
    baseline = Math.round(em * 1.4);
  const context = canvasOf(size);
  if (context === undefined) throw new World3DError('WORLD3D_CONTEXT_UNAVAILABLE', 'canvas font');
  context.font = `${style} ${weight} ${em}px ${family}`;
  context.textBaseline = 'alphabetic';
  context.fillStyle = '#fff';
  const metrics = context.measureText('Hg中');
  const ascender = metrics.fontBoundingBoxAscent > 0 ? metrics.fontBoundingBoxAscent : em * 0.88,
    descender = metrics.fontBoundingBoxDescent > 0 ? -metrics.fontBoundingBoxDescent : -em * 0.12;
  const filled = new Uint8Array(size * size);
  return new Font3D({
    unitsPerEm: em,
    ascender,
    descender,
    lineHeight: Math.max(em * 1.2, ascender - descender),
    familyName: family,
    glyph(codePoint: number): GlyphOutline3D | undefined {
      if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return undefined;
      const text = String.fromCodePoint(codePoint),
        advance = context.measureText(text).width;
      context.clearRect(0, 0, size, size);
      context.fillText(text, left, baseline);
      const pixels = context.getImageData(0, 0, size, size).data;
      for (let i = 0; i < filled.length; i++) filled[i] = pixels[i * 4 + 3]! >= 128 ? 1 : 0;
      const commands: number[] = [];
      for (const loop of traceEdges(filled, size, size)) {
        const points = simplify(loop, tolerance);
        // Font units run up from the baseline; canvas rows run down.
        for (let i = 0; i < points.length; i += 2)
          commands.push(i === 0 ? 0 : 1, points[i]! - left, baseline - points[i + 1]!);
      }
      return { advance, commands };
    }
  });
}
