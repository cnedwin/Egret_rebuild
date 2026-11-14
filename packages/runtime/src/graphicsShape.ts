// SPDX-License-Identifier: Apache-2.0
// The shapes of a Graphics, as triangles. A node whose drawing is more than filled rectangles keeps one list of
// coloured triangles, in drawing order, and a path still being drawn. Capture reads them as one shared geometry.
import { createImageData2D, createSharedGeometry2D } from '@egret/contracts';
import type { ImageData2D, Rectangle2D, SharedGeometry2D } from '@egret/contracts';
import { decodeSRGBByte } from './srgbBytes.js';
import { fillNonZero, gradientColor, outlineCrosses, refineForGradient } from './graphicsFill.js';
import type { ShapeGradient } from './graphicsFill.js';

export interface ShapePaint { readonly color: number; readonly alpha: number; readonly gradient?: ShapeGradient | undefined; }
export type LineCaps = 'none' | 'round' | 'square';
export type LineJoints = 'miter' | 'round' | 'bevel';
/** A line: its width, how its ends and corners are drawn, and the lengths of its dashes and gaps in turn, if it is dashed. */
export interface ShapeLine extends ShapePaint { readonly width: number; readonly caps: LineCaps; readonly joints: LineJoints; readonly miterLimit: number; readonly dash: readonly number[] | undefined; }
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
export const GRAPHICS_SHAPE_LIMITS = Object.freeze({ maxVertices: 65536, maxIndices: 196608, maxLogicalBytes: 4980736, maxPathPoints: 8192, maxLineWidth: 1024, maxDashes: 16384, maxGradientStops: 16, maxFillTriangles: 16384 });

/** The one white pixel every shape samples: its colour is the colour of its vertices. */
export const SHAPE_PAGE: ImageData2D = createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([255, 255, 255, 255]) });
export const SHAPE_REGION = Object.freeze({ packed: Object.freeze({ x: 0, y: 0, width: 1, height: 1 }), logicalWidth: 1, logicalHeight: 1, trimX: 0, trimY: 0, quarterTurn: 0 as const });

export function createShapeState(): ShapeState { return { positions: [], colors: [], indices: [], path: undefined, resolved: undefined }; }

interface Target { positions: number[]; colors: number[]; indices: number[]; }
function paint(target: Target, points: readonly number[], color: ShapePaint): number {
  const first = target.positions.length / 2;
  const r = decodeSRGBByte(color.color >> 16), g = decodeSRGBByte(color.color >> 8), b = decodeSRGBByte(color.color);
  for (let i = 0; i < points.length; i += 2) {
    target.positions.push(points[i]!, points[i + 1]!);
    if (color.gradient === undefined) target.colors.push(r, g, b, color.alpha); else gradientColor(color.gradient, points[i]!, points[i + 1]!, target.colors, target.colors.length);
  }
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
/** Triangles given as x, y of each corner, added with one vertex for each different corner. */
function addTriangles(target: Target, triangles: readonly number[], color: ShapePaint): void {
  const known = new Map<string, number>(), one = [0, 0], corner = [0, 0, 0];
  for (let i = 0; i < triangles.length; i += 6) {
    for (let k = 0; k < 3; k++) {
      const x = triangles[i + 2 * k]!, y = triangles[i + 2 * k + 1]!, key = x + ',' + y;
      let index = known.get(key);
      if (index === undefined) { one[0] = x; one[1] = y; index = paint(target, one, color); known.set(key, index); }
      corner[k] = index;
    }
    if (corner[0] !== corner[1] && corner[1] !== corner[2] && corner[2] !== corner[0]) target.indices.push(corner[0]!, corner[1]!, corner[2]!);
  }
}
/** The triangles added to a target since a mark, taken back out of it as x, y of each corner. */
function takeTriangles(target: Target, vertices: number, indices: number): number[] {
  const out: number[] = [];
  for (let i = indices; i < target.indices.length; i++) { const v = target.indices[i]!; out.push(target.positions[2 * v]!, target.positions[2 * v + 1]!); }
  target.positions.length = 2 * vertices; target.colors.length = 4 * vertices; target.indices.length = indices;
  return out;
}
/**
 * What closed outlines cover, filled. One outline that does not cross itself is cut into ears; several, or one that
 * crosses itself, are filled by the non-zero rule, so an outline drawn the other way round inside another is a hole.
 * A gradient is given as the colours of the corners, with triangles cut until that is close enough.
 * False when the fill would take more triangles than one fill may.
 */
export function fillOutlines(target: Target, outlines: readonly (readonly number[])[], convex: boolean, color: ShapePaint): boolean {
  const vertices = target.positions.length / 2, indices = target.indices.length, max = GRAPHICS_SHAPE_LIMITS.maxFillTriangles;
  const closed = outlines.map(points => distinct(points, true)).filter(points => points.length >= 6);
  if (closed.length === 0) return true;
  if (closed.length === 1 && (convex || !outlineCrosses(closed[0]!))) (convex ? fillConvex : fillPolygon)(target, closed[0]!, color);
  else {
    const triangles = fillNonZero(closed, max);
    if (triangles === undefined) return false;
    addTriangles(target, triangles, color);
  }
  if (color.gradient !== undefined) addTriangles(target, refineForGradient(takeTriangles(target, vertices, indices), color.gradient, max), color);
  return true;
}

/** The pieces of a line that its dashes cover, each a line of its own; undefined when there are too many. */
function dashPieces(points: readonly number[], loop: boolean, dash: readonly number[]): number[][] | undefined {
  const pattern = dash.length % 2 === 0 ? dash : [...dash, ...dash], count = points.length / 2, pieces: number[][] = [];
  let entry = 0, left = pattern[0]!, piece: number[] | undefined = [points[0]!, points[1]!];
  for (let i = 0; i + 1 < count || (loop && i < count); i++) {
    const ax = points[2 * i]!, ay = points[2 * i + 1]!, j = (i + 1) % count, bx = points[2 * j]!, by = points[2 * j + 1]!, length = Math.hypot(bx - ax, by - ay);
    let done = 0;
    while (length - done > left) {
      done += left;
      const x = ax + (bx - ax) * done / length, y = ay + (by - ay) * done / length;
      if (piece !== undefined) { piece.push(x, y); pieces.push(piece); piece = undefined; if (pieces.length > GRAPHICS_SHAPE_LIMITS.maxDashes) return undefined; } else piece = [x, y];
      entry = (entry + 1) % pattern.length; left = pattern[entry]!;
    }
    left -= length - done;
    if (piece !== undefined) piece.push(bx, by);
  }
  if (piece !== undefined && piece.length >= 4) pieces.push(piece);
  return pieces;
}
/**
 * A line of a width along points. Two pieces meet at a corner in one point on its inside, so a translucent line is not
 * darker there; its outside is a mitre, cut to a bevel when longer than `miterLimit` half-widths, a bevel or an arc.
 * An open line ends flat, in a half square or in a half circle. False when its dashes are more than a line may have.
 */
export function strokeLine(target: Target, line: readonly number[], closed: boolean, style: ShapeLine): boolean {
  const points = distinct(line, closed);
  if (points.length < 4 || style.width <= 0) return true;
  const loop = closed && points.length >= 6;
  if (style.dash === undefined) { strokeSolid(target, points, loop, style); return true; }
  const pieces = dashPieces(points, loop, style.dash);
  if (pieces === undefined) return false;
  for (const piece of pieces) { const part = distinct(piece, false); if (part.length >= 4) strokeSolid(target, part, false, style); }
  return true;
}
function strokeSolid(target: Target, points: readonly number[], loop: boolean, style: ShapeLine): void {
  const count = points.length / 2, half = style.width / 2, segments = loop ? count : count - 1, arc = curveSegments(half);
  const out: number[] = [], triangles: number[] = [];
  const add = (x: number, y: number): number => { out.push(x, y); return out.length / 2 - 1; };
  // Each piece's unit direction and length; its normal is that direction turned a quarter.
  const dx: number[] = [], dy: number[] = [], lengths: number[] = [];
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % count, x = points[2 * j]! - points[2 * i]!, y = points[2 * j + 1]! - points[2 * i + 1]!, length = Math.hypot(x, y);
    dx.push(x / length); dy.push(y / length); lengths.push(length);
  }
  /** A fan about a centre from one direction to another, the short way round by `sweep` radians, between two vertices already there. */
  const fan = (hub: number, cx: number, cy: number, fromX: number, fromY: number, sweep: number, first: number, last: number): void => {
    const steps = Math.max(1, Math.ceil(arc * Math.abs(sweep) / (2 * Math.PI)));
    let before = first;
    for (let i = 1; i < steps; i++) {
      const angle = sweep * i / steps, cos = Math.cos(angle), sin = Math.sin(angle), now = add(cx + fromX * cos - fromY * sin, cy + fromX * sin + fromY * cos);
      triangles.push(hub, before, now); before = now;
    }
    triangles.push(hub, before, last);
  };
  // For each piece, the vertices on its normal's side and on the other, at its start and at its end.
  const startPlus: number[] = [], startMinus: number[] = [], endPlus: number[] = [], endMinus: number[] = [];
  for (let i = 0; i < count; i++) {
    const before = i > 0 ? i - 1 : loop ? segments - 1 : -1, after = i < segments ? i : loop ? 0 : -1, x = points[2 * i]!, y = points[2 * i + 1]!;
    if (before < 0 || after < 0) {
      // An end of an open line.
      const piece = before < 0 ? after : before, away = before < 0 ? -1 : 1, nx = -dy[piece]! * half, ny = dx[piece]! * half;
      const ex = style.caps === 'square' ? x + away * dx[piece]! * half : x, ey = style.caps === 'square' ? y + away * dy[piece]! * half : y;
      const plus = add(ex + nx, ey + ny), minus = add(ex - nx, ey - ny);
      if (before < 0) { startPlus[piece] = plus; startMinus[piece] = minus; } else { endPlus[piece] = plus; endMinus[piece] = minus; }
      if (style.caps === 'round') fan(add(x, y), x, y, nx, ny, away * -Math.PI, plus, minus);
      continue;
    }
    const ax = -dy[before]!, ay = dx[before]!, bx = -dy[after]!, by = dx[after]!, cross = dx[before]! * dy[after]! - dy[before]! * dx[after]!, dot = dx[before]! * dx[after]! + dy[before]! * dy[after]!;
    if (Math.abs(cross) < 1e-9 && dot > 0) {
      // Straight on: the two pieces share both vertices.
      endPlus[before] = startPlus[after] = add(x + ax * half, y + ay * half); endMinus[before] = startMinus[after] = add(x - ax * half, y - ay * half);
      continue;
    }
    if (Math.abs(cross) < 1e-9) {
      // Straight back: each piece ends square, and a round corner is a half circle about the point.
      const plus = endPlus[before] = add(x + ax * half, y + ay * half), minus = endMinus[before] = add(x - ax * half, y - ay * half);
      startPlus[after] = minus; startMinus[after] = plus;
      if (style.joints === 'round') fan(add(x, y), x, y, ax * half, ay * half, -Math.PI, plus, minus);
      continue;
    }
    // The inside of the corner is on the normal's side when the line turns that way.
    const side = cross > 0 ? 1 : -1;
    let mx = ax + bx, my = ay + by;
    const length = Math.hypot(mx, my); mx /= length; my /= length;
    const ratio = 1 / (mx * ax + my * ay);
    // The inside point is kept on the pieces it joins, however sharp the corner.
    const reach = Math.min(ratio * half, Math.hypot(half, Math.min(lengths[before]!, lengths[after]!)));
    const inside = add(x + side * mx * reach, y + side * my * reach);
    const outA = add(x - side * ax * half, y - side * ay * half), outB = add(x - side * bx * half, y - side * by * half);
    if (side > 0) { endPlus[before] = inside; endMinus[before] = outA; startPlus[after] = inside; startMinus[after] = outB; }
    else { endMinus[before] = inside; endPlus[before] = outA; startMinus[after] = inside; startPlus[after] = outB; }
    if (style.joints === 'round') fan(inside, x, y, -side * ax * half, -side * ay * half, Math.atan2(cross, dot), outA, outB);
    else if (style.joints === 'miter' && ratio <= style.miterLimit) { const tip = add(x - side * mx * ratio * half, y - side * my * ratio * half); triangles.push(inside, outA, tip, inside, tip, outB); }
    else triangles.push(inside, outA, outB);
  }
  for (let i = 0; i < segments; i++) triangles.push(startPlus[i]!, startMinus[i]!, endMinus[i]!, startPlus[i]!, endMinus[i]!, endPlus[i]!);
  const first = paint(target, out, style);
  for (const index of triangles) target.indices.push(first + index);
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

/** A shape drawn at once: its fill under its line. False when it is more than a fill or a line may be. */
export function addOutline(target: Target, outline: readonly number[], convex: boolean, fill: ShapePaint | undefined, line: ShapeLine | undefined): boolean {
  return (fill === undefined || fillOutlines(target, [outline], convex, fill)) && (line === undefined || strokeLine(target, outline, true, line));
}
/** The triangles of a path: its parts filled together as closed outlines, then each lined, closed only where its ends meet. */
export function addPath(target: Target, path: ShapePath): boolean {
  if (path.fill !== undefined && !fillOutlines(target, path.subpaths, false, path.fill)) return false;
  if (path.line !== undefined) for (const points of path.subpaths) {
    const n = points.length;
    if (!strokeLine(target, points, n >= 6 && points[0] === points[n - 2] && points[1] === points[n - 1], path.line)) return false;
  }
  return true;
}
/** Whether a drawing of this many vertices and indices is one a node may hold. */
export function shapeFits(vertices: number, indices: number): boolean {
  return vertices <= GRAPHICS_SHAPE_LIMITS.maxVertices && indices <= GRAPHICS_SHAPE_LIMITS.maxIndices && 88 * vertices + 4 * indices <= GRAPHICS_SHAPE_LIMITS.maxLogicalBytes;
}

// Shapes drawn the same way, on any number of nodes, are one geometry: a frame admits 128 of them.
const shared = new Map<string, ResolvedShape>();
/** The geometry and bounds of a node's shapes, or undefined while they hold no triangle. */
export function resolveShape(shape: ShapeState): ResolvedShape | undefined {
  if (shape.resolved !== undefined) return shape.resolved;
  let target: Target = shape;
  if (shape.path !== undefined) {
    target = { positions: shape.positions.slice(), colors: shape.colors.slice(), indices: shape.indices.slice() };
    // A path still being drawn that has grown past what a node may hold is not drawn; Graphics refuses it when it is finished.
    if (!addPath(target, shape.path) || !shapeFits(target.positions.length / 2, target.indices.length)) target = shape;
  }
  const { positions, colors, indices } = target, vertices = positions.length / 2;
  if (indices.length === 0 || !shapeFits(vertices, indices.length)) return undefined;
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
