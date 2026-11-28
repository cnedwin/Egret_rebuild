import type { SharedPoint2D } from './prepareSharedDraws2D.js';

/** A placed, unclipped solid-colour quad with the ordinary four unit UV corners. */
export interface SharedContainedQuad2D {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly reversed: boolean;
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

/** The general polygon representation is needed only by a caller that actually retains or inspects it. */
export function expandSharedContainedQuad2D(quad: SharedContainedQuad2D): SharedPoint2D[][] {
  const points: SharedPoint2D[] = [];
  for (let i = 0; i < 4; i++) {
    const corner = quad.reversed ? 3 - i : i;
    const right = corner === 1 || corner === 2,
      bottom = corner >= 2;
    points.push({
      x: right ? quad.x1 : quad.x0,
      y: bottom ? quad.y1 : quad.y0,
      u: right ? 1 : 0,
      v: bottom ? 1 : 0,
      r: quad.red,
      g: quad.green,
      b: quad.blue,
      a: quad.alpha,
      dr: 0,
      dg: 0,
      db: 0
    });
  }
  return [points];
}

const fan = [0, 1, 2, 0, 2, 3];

/** Writes the same two positively oriented represented triangles as the generic polygon fan. */
export function writeSharedContainedQuad2D(
  quad: SharedContainedQuad2D,
  rows: Float32Array<ArrayBuffer>,
  offset: number,
  slot: number,
  opacity: number
): void {
  for (const i of fan) {
    const corner = quad.reversed ? 3 - i : i;
    const right = corner === 1 || corner === 2,
      bottom = corner >= 2;
    rows[offset] = right ? quad.x1 : quad.x0;
    rows[offset + 1] = bottom ? quad.y1 : quad.y0;
    rows[offset + 2] = right ? 1 : 0;
    rows[offset + 3] = bottom ? 1 : 0;
    rows[offset + 4] = quad.red;
    rows[offset + 5] = quad.green;
    rows[offset + 6] = quad.blue;
    rows[offset + 7] = quad.alpha;
    rows[offset + 8] = 0;
    rows[offset + 9] = 0;
    rows[offset + 10] = 0;
    rows[offset + 11] = slot;
    rows[offset + 12] = opacity;
    offset += 13;
  }
}
