// SPDX-License-Identifier: Apache-2.0
// Internal common geometry for the native screen report and Play semantics.
import type { DisplayObject } from '@egret/runtime';
import type { ScreenRect } from './screen.js';

export interface ClipPoint {
  readonly x: number;
  readonly y: number;
}

const edge = (a: ClipPoint, b: ClipPoint, c: ClipPoint): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

const signedAreaTwice = (points: readonly ClipPoint[]): number => {
  let area = 0;
  for (let index = 1; index + 1 < points.length; index++)
    area += edge(points[0]!, points[index]!, points[index + 1]!);
  return area;
};

export function rectanglePolygon({ x, y, width, height }: ScreenRect, node?: DisplayObject): ClipPoint[] {
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return [];
  const points = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
  return node === undefined ? points : points.map(at => node.localToGlobal(at.x, at.y));
}

/** Intersect two convex shapes before enclosing the actual remaining polygon. */
export function intersectClipPolygons(points: ClipPoint[], clip: readonly ClipPoint[]): ClipPoint[] {
  if (clip.length < 3 || points.length < 3) return [];
  const winding = Math.sign(signedAreaTwice(clip));
  if (!winding) return [];
  for (let index = 0; index < clip.length && points.length > 0; index++) {
    const from = clip[index]!,
      to = clip[(index + 1) % clip.length]!,
      distances = points.map(point => winding * edge(from, to, point)),
      out: ClipPoint[] = [];
    for (let at = 0; at < points.length; at++) {
      const prior = (at + points.length - 1) % points.length,
        start = points[prior]!,
        end = points[at]!,
        a = distances[prior]!,
        b = distances[at]!;
      if (a < 0 !== b < 0) {
        const fraction = a / (a - b);
        out.push({ x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction });
      }
      if (b >= 0) out.push(end);
    }
    points = out;
  }
  return points;
}

export function polygonBounds(points: readonly ClipPoint[]): ScreenRect | undefined {
  if (points.length < 3) return undefined;
  const area = signedAreaTwice(points);
  if (!Number.isFinite(area) || area === 0) return undefined;
  const xs = points.map(point => point.x),
    ys = points.map(point => point.y),
    x = Math.min(...xs),
    y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Screen is an additional clip for semantic projection only, not native diagnostics. */
export function clippedDisplayRect(node: DisplayObject, area: ScreenRect, screen?: ScreenRect): ScreenRect | undefined {
  if (node.isDisposed) return undefined;
  let points = rectanglePolygon(area, node);
  if (!polygonBounds(points)) return undefined;
  for (let at: DisplayObject | undefined = node; at !== undefined && points.length !== 0; at = at.parent) {
    const clip = at.clipRect;
    if (clip !== undefined) points = intersectClipPolygons(points, rectanglePolygon(clip, at));
  }
  if (screen !== undefined)
    points = intersectClipPolygons(points, rectanglePolygon({ x: 0, y: 0, width: screen.width, height: screen.height }));
  return polygonBounds(points);
}
