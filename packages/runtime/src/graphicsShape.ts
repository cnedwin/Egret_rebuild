// SPDX-License-Identifier: Apache-2.0
// The shapes of a Graphics, as triangles. A node whose drawing is more than filled rectangles keeps one list of
// coloured triangles, in drawing order, and a path still being drawn. Capture reads them as one shared geometry.
import { createImageData2D, createSharedGeometry2D } from '@egret/contracts';
import type { ImageData2D, Rectangle2D, SharedGeometry2D } from '@egret/contracts';
import { decodeSRGBByte } from './srgbBytes.js';

export interface ShapePaint { readonly color: number; readonly alpha: number; }
export interface ShapeLine extends ShapePaint { readonly width: number; }
/** A path being drawn with moveTo and lineTo: its paints, and each subpath as x, y pairs. */
export interface ShapePath { readonly fill: ShapePaint | undefined; readonly line: ShapeLine | undefined; readonly subpaths: number[][]; }
export interface ShapeState {
  /** x, y of each vertex; linear-light r, g, b and alpha of each vertex; three vertex numbers for each triangle. */
  positions: number[]; colors: number[]; indices: number[];
  path: ShapePath | undefined;
  /** What the lists and the path give, made when capture or bounds first ask after a change. */
  resolved: ResolvedShape | undefined;
}
export interface ResolvedShape { readonly geometry: SharedGeometry2D; readonly bounds: Rectangle2D; }

/** The most one node's shapes may hold: what one shared geometry takes. */
export const GRAPHICS_SHAPE_LIMITS = Object.freeze({ maxVertices: 65536, maxIndices: 196608, maxLogicalBytes: 4980736, maxPathPoints: 8192, maxLineWidth: 1024 });

/** The one white pixel every shape samples: its colour is the colour of its vertices. */
export const SHAPE_PAGE: ImageData2D = createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([255, 255, 255, 255]) });
export const SHAPE_REGION = Object.freeze({ packed: Object.freeze({ x: 0, y: 0, width: 1, height: 1 }), logicalWidth: 1, logicalHeight: 1, trimX: 0, trimY: 0, quarterTurn: 0 as const });

export function createShapeState(): ShapeState { return { positions: [], colors: [], indices: [], path: undefined, resolved: undefined }; }

interface Target { positions: number[]; colors: number[]; indices: number[]; }
function paint(target: Target, points: readonly number[], color: ShapePaint): number {
  const first = target.positions.length / 2;
  const r = decodeSRGBByte(color.color >> 16), g = decodeSRGBByte(color.color >> 8), b = decodeSRGBByte(color.color);
  for (let i = 0; i < points.length; i += 2) { target.positions.push(points[i]!, points[i + 1]!); target.colors.push(r, g, b, color.alpha); }
  return first;
}
/** Twice the signed area of a polygon given as x, y pairs. */
function area2(points: readonly number[]): number {
  let sum = 0;
  for (let i = 0, n = points.length; i < n; i += 2) { const j = (i + 2) % n; sum += points[i]! * points[j + 1]! - points[j]! * points[i + 1]!; }
  return sum;
}
/** Drops a point equal to the one before it, and a last point equal to the first. */
function distinct(points: readonly number[], closed: boolean): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i]!, y = points[i + 1]!, n = out.length;
    if (n === 0 || out[n - 2] !== x || out[n - 1] !== y) out.push(x, y);
  }
  if (closed && out.length >= 4 && out[0] === out[out.length - 2] && out[1] === out[out.length - 1]) out.length -= 2;
  return out;
}

/** A convex outline as a fan from its first corner. */
export function fillConvex(target: Target, outline: readonly number[], color: ShapePaint): void {
  const points = distinct(outline, true), count = points.length / 2;
  if (count < 3 || area2(points) === 0) return;
  const first = paint(target, points, color);
  for (let i = 1; i + 1 < count; i++) target.indices.push(first, first + i, first + i + 1);
}
/** Any simple outline, by cutting ears. An outline that crosses itself is filled without a promise about where. */
export function fillPolygon(target: Target, outline: readonly number[], color: ShapePaint): void {
  const points = distinct(outline, true), count = points.length / 2, area = area2(points);
  if (count < 3 || area === 0) return;
  const first = paint(target, points, color), sign = area > 0 ? 1 : -1;
  const ring: number[] = []; for (let i = 0; i < count; i++) ring.push(i);
  const cross = (a: number, b: number, c: number): number =>
    (points[2 * b]! - points[2 * a]!) * (points[2 * c + 1]! - points[2 * a + 1]!) - (points[2 * b + 1]! - points[2 * a + 1]!) * (points[2 * c]! - points[2 * a]!);
  const inside = (a: number, b: number, c: number, p: number): boolean => sign * cross(a, b, p) >= 0 && sign * cross(b, c, p) >= 0 && sign * cross(c, a, p) >= 0;
  let guard = 2 * count * count;
  for (let at = 0; ring.length > 3 && guard-- > 0;) {
    const n = ring.length, a = ring[(at + n - 1) % n]!, b = ring[at % n]!, c = ring[(at + 1) % n]!;
    let ear = sign * cross(a, b, c) > 0;
    for (let k = 0; ear && k < n; k++) { const p = ring[k]!; if (p !== a && p !== b && p !== c && inside(a, b, c, p)) ear = false; }
    if (ear) { target.indices.push(first + a, first + b, first + c); ring.splice(at % n, 1); at = at % ring.length; }
    else if (sign * cross(a, b, c) === 0) { ring.splice(at % n, 1); at = at % ring.length; }
    else at = (at + 1) % n;
  }
  // What no ear could be cut from is closed as a fan, so that a degenerate outline still ends.
  for (let i = 1; i + 1 < ring.length; i++) target.indices.push(first + ring[0]!, first + ring[i]!, first + ring[i + 1]!);
}
/**
 * A line of a width along points, with flat ends and mitred corners. A corner sharper than a mitre four half-widths
 * long is cut at that length. Segments share their corners, so a translucent line is not darker at a corner.
 */
export function strokeLine(target: Target, line: readonly number[], closed: boolean, style: ShapeLine): void {
  const points = distinct(line, closed), count = points.length / 2;
  if (count < 2 || style.width <= 0) return;
  const loop = closed && count >= 3, half = style.width / 2, sides: number[] = [];
  const normal = (from: number, to: number): [number, number] => {
    const dx = points[2 * to]! - points[2 * from]!, dy = points[2 * to + 1]! - points[2 * from + 1]!, length = Math.hypot(dx, dy);
    return [-dy / length, dx / length];
  };
  for (let i = 0; i < count; i++) {
    const before = i > 0 ? normal(i - 1, i) : loop ? normal(count - 1, 0) : undefined;
    const after = i + 1 < count ? normal(i, i + 1) : loop ? normal(i, 0) : undefined;
    const a = before ?? after!, b = after ?? before!;
    let mx = a[0] + b[0], my = a[1] + b[1];
    const length = Math.hypot(mx, my);
    // A line that turns straight back has no mitre; its corner is squared across the segment before it.
    if (length < 1e-9) { mx = a[0]; my = a[1]; } else { mx /= length; my /= length; }
    const scale = Math.min(4, 1 / Math.max(1e-9, mx * a[0] + my * a[1])) * half, x = points[2 * i]!, y = points[2 * i + 1]!;
    sides.push(x + mx * scale, y + my * scale, x - mx * scale, y - my * scale);
  }
  const first = paint(target, sides, style);
  for (let i = 0; i + 1 < count || (loop && i < count); i++) {
    const a = first + 2 * i, b = first + 2 * ((i + 1) % count);
    target.indices.push(a, a + 1, b + 1, a, b + 1, b);
  }
}

/** How many straight pieces a curve of this radius is drawn with: each is within a quarter unit of the curve. */
export function curveSegments(radius: number): number {
  if (!(radius > 0.25)) return 8;
  // A multiple of four, so that a whole circle has a corner at each of its four extremes.
  return Math.max(8, Math.min(128, 4 * Math.ceil(Math.PI / Math.acos(1 - 0.25 / radius) / 4)));
}
/** The cosine and sine of a quarter-turn multiple are whole numbers here, so an extreme of a circle is where it is told. */
function unitAt(step: number, count: number): [number, number] {
  const quarter = 4 * step / count;
  if (Number.isInteger(quarter)) return [[1, 0, -1, 0][((quarter % 4) + 4) % 4]!, [0, 1, 0, -1][((quarter % 4) + 4) % 4]!];
  const angle = 2 * Math.PI * step / count;
  return [Math.cos(angle), Math.sin(angle)];
}
/** An ellipse as an outline, starting at its right and going on through its bottom. */
export function ellipseOutline(cx: number, cy: number, rx: number, ry: number): number[] {
  const count = curveSegments(Math.max(rx, ry)), out: number[] = [];
  for (let i = 0; i < count; i++) { const [cos, sin] = unitAt(i, count); out.push(cx + rx * cos, cy + ry * sin); }
  return out;
}
/** A rectangle whose corners are quarter ellipses of the two radii. */
export function roundRectOutline(x: number, y: number, width: number, height: number, rx: number, ry: number): number[] {
  if (rx <= 0 || ry <= 0) return [x, y, x + width, y, x + width, y + height, x, y + height];
  const count = curveSegments(Math.max(rx, ry)) / 4, out: number[] = [];
  // Each corner is a quarter of the ellipse, from the top right round through the bottom to the top left.
  const corners: [number, number, number][] = [[x + width - rx, y + ry, 3], [x + width - rx, y + height - ry, 0], [x + rx, y + height - ry, 1], [x + rx, y + ry, 2]];
  for (const [cx, cy, quarter] of corners) for (let i = 0; i <= count; i++) { const [cos, sin] = unitAt(quarter * count + i, 4 * count); out.push(cx + rx * cos, cy + ry * sin); }
  return out;
}
/** The points of an arc after its first, which the caller has already placed. */
export function arcPoints(cx: number, cy: number, radius: number, start: number, end: number, anticlockwise: boolean): number[] {
  let sweep = end - start;
  const turn = 2 * Math.PI;
  if (anticlockwise) { if (sweep > 0) sweep -= turn * Math.ceil(sweep / turn); if (sweep === 0 && end !== start) sweep = -turn; }
  else { if (sweep < 0) sweep += turn * Math.ceil(-sweep / turn); if (sweep === 0 && end !== start) sweep = turn; }
  if (Math.abs(end - start) >= turn) sweep = anticlockwise ? -turn : turn;
  const count = Math.max(1, Math.ceil(curveSegments(radius) * Math.abs(sweep) / turn)), out: number[] = [];
  for (let i = 1; i <= count; i++) { const angle = start + sweep * i / count; out.push(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)); }
  return out;
}
/** The points of a curve of two or three control points after its first, which is `from`. */
export function bezierPoints(from: readonly [number, number], controls: readonly number[], to: readonly [number, number]): number[] {
  const xs = [from[0], ...controls.filter((_, i) => i % 2 === 0), to[0]], ys = [from[1], ...controls.filter((_, i) => i % 2 === 1), to[1]];
  let length = 0;
  for (let i = 1; i < xs.length; i++) length += Math.hypot(xs[i]! - xs[i - 1]!, ys[i]! - ys[i - 1]!);
  const count = Math.max(4, Math.min(96, Math.ceil(length / 6))), out: number[] = [];
  for (let step = 1; step <= count; step++) {
    const t = step / count, px = xs.slice(), py = ys.slice();
    for (let level = px.length - 1; level > 0; level--) for (let i = 0; i < level; i++) { px[i] = px[i]! + (px[i + 1]! - px[i]!) * t; py[i] = py[i]! + (py[i + 1]! - py[i]!) * t; }
    out.push(px[0]!, py[0]!);
  }
  // The last point is the end itself, not a sum that comes close to it.
  out[out.length - 2] = to[0]; out[out.length - 1] = to[1];
  return out;
}

/** A shape drawn at once: its fill under its line. */
export function addOutline(target: Target, outline: readonly number[], convex: boolean, fill: ShapePaint | undefined, line: ShapeLine | undefined): void {
  if (fill !== undefined) (convex ? fillConvex : fillPolygon)(target, outline, fill);
  if (line !== undefined) strokeLine(target, outline, true, line);
}
/** The triangles of a path: every subpath filled as a closed outline, then lined, closed only where its ends meet. */
export function addPath(target: Target, path: ShapePath): void {
  for (const points of path.subpaths) if (path.fill !== undefined) fillPolygon(target, points, path.fill);
  if (path.line !== undefined) for (const points of path.subpaths) {
    const n = points.length;
    strokeLine(target, points, n >= 6 && points[0] === points[n - 2] && points[1] === points[n - 1], path.line);
  }
}

// Shapes drawn the same way, on any number of nodes, are one geometry: a frame admits 128 of them.
const shared = new Map<string, ResolvedShape>();
/** The geometry and bounds of a node's shapes, or undefined while they hold no triangle. */
export function resolveShape(shape: ShapeState): ResolvedShape | undefined {
  if (shape.resolved !== undefined) return shape.resolved;
  let target: Target = shape;
  if (shape.path !== undefined) { target = { positions: shape.positions.slice(), colors: shape.colors.slice(), indices: shape.indices.slice() }; addPath(target, shape.path); }
  const { positions, colors, indices } = target, vertices = positions.length / 2;
  // Graphics refuses a drawing beyond these limits when it is drawn, so only an empty one gives nothing here.
  if (indices.length === 0 || vertices > GRAPHICS_SHAPE_LIMITS.maxVertices || indices.length > GRAPHICS_SHAPE_LIMITS.maxIndices
    || 88 * vertices + 4 * indices.length > GRAPHICS_SHAPE_LIMITS.maxLogicalBytes) return undefined;
  const key = positions.join() + '|' + colors.join() + '|' + indices.join();
  let resolved = shared.get(key);
  if (resolved === undefined) {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (let i = 0; i < positions.length; i += 2) { const x = positions[i]!, y = positions[i + 1]!; if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; if (y > bottom) bottom = y; }
    const geometry = createSharedGeometry2D({ positions: Float64Array.from(positions), uvs: new Float64Array(positions.length).fill(0.5), lightColors: Float64Array.from(colors),
      darkColors: new Float64Array(3 * vertices), indices: vertices > 65535 ? Uint32Array.from(indices) : Uint16Array.from(indices) });
    resolved = Object.freeze({ geometry, bounds: Object.freeze({ x: left, y: top, width: right - left, height: bottom - top }) });
    if (shared.size >= 512) shared.clear();
    shared.set(key, resolved);
  }
  return shape.resolved = resolved;
}
