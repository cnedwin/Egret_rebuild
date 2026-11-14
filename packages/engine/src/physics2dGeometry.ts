// SPDX-License-Identifier: Apache-2.0
// The geometry of shapes in the world: their boxes, whether two meet and how deep, and where a ray meets one.
import type { PhysicsShape, PhysicsVector } from './physics2dTypes.js';

export interface Placed { readonly kind: 'circle' | 'polygon'; readonly x: number; readonly y: number; readonly radius: number; readonly points: Float64Array; }
export interface Box { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number; }
/** How two shapes meet: the normal from the first to the second, and how far they reach into each other. */
export interface Meeting { readonly nx: number; readonly ny: number; readonly depth: number; }

/** A shape in the world, at a place and a turn: a circle, or the corners of a convex polygon. */
export function place(shape: PhysicsShape, x: number, y: number, degrees: number): Placed {
  if (shape.kind === 'circle') return { kind: 'circle', x, y, radius: shape.radius, points: new Float64Array(0) };
  const local = shape.kind === 'box'
    ? [{ x: -shape.width / 2, y: -shape.height / 2 }, { x: shape.width / 2, y: -shape.height / 2 }, { x: shape.width / 2, y: shape.height / 2 }, { x: -shape.width / 2, y: shape.height / 2 }]
    : shape.points;
  const a = degrees * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), points = new Float64Array(local.length * 2);
  local.forEach((p, i) => { points[i * 2] = x + p.x * cos - p.y * sin; points[i * 2 + 1] = y + p.x * sin + p.y * cos; });
  return { kind: 'polygon', x, y, radius: 0, points };
}
export function boxOf(shape: Placed): Box {
  if (shape.kind === 'circle') return { minX: shape.x - shape.radius, minY: shape.y - shape.radius, maxX: shape.x + shape.radius, maxY: shape.y + shape.radius };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < shape.points.length; i += 2) {
    const px = shape.points[i]!, py = shape.points[i + 1]!;
    if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py;
  }
  return { minX, minY, maxX, maxY };
}
export const boxesMeet = (a: Box, b: Box): boolean => a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
/** The area of a shape, for the mass of a body. */
export function areaOf(shape: PhysicsShape): number {
  if (shape.kind === 'circle') return Math.PI * shape.radius * shape.radius;
  if (shape.kind === 'box') return shape.width * shape.height;
  let twice = 0;
  for (let i = 0; i < shape.points.length; i++) { const p = shape.points[i]!, q = shape.points[(i + 1) % shape.points.length]!; twice += p.x * q.y - q.x * p.y; }
  return Math.abs(twice) / 2;
}
/** Whether points make a convex polygon of some area, in either turning. */
export function convex(points: readonly PhysicsVector[]): boolean {
  if (points.length < 3 || points.length > 64) return false;
  let sign = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!, c = points[(i + 2) % points.length]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross); else if (Math.sign(cross) !== sign) return false;
  }
  return sign !== 0;
}
function project(shape: Placed, ax: number, ay: number): [number, number] {
  if (shape.kind === 'circle') { const c = shape.x * ax + shape.y * ay; return [c - shape.radius, c + shape.radius]; }
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < shape.points.length; i += 2) { const d = shape.points[i]! * ax + shape.points[i + 1]! * ay; if (d < min) min = d; if (d > max) max = d; }
  return [min, max];
}
/** The axes that can part two shapes: the normals of the edges, and for a circle the way to the nearest corner. */
function axes(shape: Placed, other: Placed, into: number[]): void {
  if (shape.kind === 'polygon') {
    const n = shape.points.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ex = shape.points[j * 2]! - shape.points[i * 2]!, ey = shape.points[j * 2 + 1]! - shape.points[i * 2 + 1]!, length = Math.hypot(ex, ey);
      if (length > 0) into.push(ey / length, -ex / length);
    }
  } else if (other.kind === 'polygon') {
    let best = Infinity, bx = 0, by = 0;
    for (let i = 0; i < other.points.length; i += 2) {
      const dx = other.points[i]! - shape.x, dy = other.points[i + 1]! - shape.y, d = dx * dx + dy * dy;
      if (d < best) { best = d; bx = dx; by = dy; }
    }
    const length = Math.hypot(bx, by);
    if (length > 0) into.push(bx / length, by / length);
  }
}
/** Whether two shapes meet, by separating axes; when they do, the shortest way out of each other. */
export function meet(a: Placed, b: Placed): Meeting | undefined {
  if (a.kind === 'circle' && b.kind === 'circle') {
    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy), reach = a.radius + b.radius;
    if (distance > reach) return undefined;
    return distance === 0 ? { nx: 0, ny: 1, depth: reach } : { nx: dx / distance, ny: dy / distance, depth: reach - distance };
  }
  const list: number[] = [];
  axes(a, b, list); axes(b, a, list);
  let depth = Infinity, nx = 0, ny = 0;
  for (let i = 0; i < list.length; i += 2) {
    const ax = list[i]!, ay = list[i + 1]!, [a0, a1] = project(a, ax, ay), [b0, b1] = project(b, ax, ay);
    const overlap = Math.min(a1, b1) - Math.max(a0, b0);
    if (overlap < 0) return undefined;
    if (overlap < depth) { depth = overlap; nx = ax; ny = ay; }
  }
  // The normal points from the first to the second.
  const [ax, ay] = centre(a), [bx, by] = centre(b);
  if ((bx - ax) * nx + (by - ay) * ny < 0) { nx = -nx; ny = -ny; }
  return { nx: nx + 0, ny: ny + 0, depth };
}
function centre(shape: Placed): [number, number] {
  if (shape.kind === 'circle') return [shape.x, shape.y];
  let x = 0, y = 0;
  const n = shape.points.length / 2;
  for (let i = 0; i < shape.points.length; i += 2) { x += shape.points[i]!; y += shape.points[i + 1]!; }
  return [x / n, y / n];
}
/** Whether a point is inside a shape, its edge included. */
export function holds(shape: Placed, x: number, y: number): boolean {
  if (shape.kind === 'circle') return Math.hypot(x - shape.x, y - shape.y) <= shape.radius;
  const n = shape.points.length / 2;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, ax = shape.points[i * 2]!, ay = shape.points[i * 2 + 1]!, cross = (shape.points[j * 2]! - ax) * (y - ay) - (shape.points[j * 2 + 1]! - ay) * (x - ax);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross); else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}
/** Where a segment from (x0, y0) by (dx, dy) first meets a shape it starts outside of: the fraction along it and the normal there. */
export function cast(shape: Placed, x0: number, y0: number, dx: number, dy: number): { readonly t: number; readonly nx: number; readonly ny: number } | undefined {
  if (shape.kind === 'circle') {
    const fx = x0 - shape.x, fy = y0 - shape.y, a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - shape.radius * shape.radius;
    if (a === 0 || c < 0) return undefined;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return undefined;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0 || t > 1) return undefined;
    const hx = x0 + dx * t - shape.x, hy = y0 + dy * t - shape.y, length = Math.hypot(hx, hy) || 1;
    return { t, nx: hx / length, ny: hy / length };
  }
  // Clipping the segment by each edge of the convex polygon: where it enters last is where it meets it.
  const n = shape.points.length / 2, [cx, cy] = centre(shape);
  let enter = 0, leave = 1, nx = 0, ny = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, px = shape.points[i * 2]!, py = shape.points[i * 2 + 1]!, ex = shape.points[j * 2]! - px, ey = shape.points[j * 2 + 1]! - py;
    let ox = ey, oy = -ex;
    // The outward normal of the edge, away from the middle of the polygon.
    if ((px - cx) * ox + (py - cy) * oy < 0) { ox = -ox; oy = -oy; }
    const length = Math.hypot(ox, oy);
    if (length === 0) continue;
    ox /= length; oy /= length;
    const numerator = (px - x0) * ox + (py - y0) * oy, denominator = dx * ox + dy * oy;
    if (denominator === 0) { if (numerator < 0) return undefined; continue; }
    const t = numerator / denominator;
    if (denominator < 0) { if (t > enter) { enter = t; nx = ox; ny = oy; } }
    else if (t < leave) leave = t;
    if (enter > leave) return undefined;
  }
  // A segment that starts inside does not meet the shape from outside.
  if (nx === 0 && ny === 0) return undefined;
  // No negative zero in what is told.
  return { t: enter, nx: nx + 0, ny: ny + 0 };
}
