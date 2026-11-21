// SPDX-License-Identifier: Apache-2.0
// Fewer triangles for the same shape: a model made in code, a scanned or generated asset, a far version for a level
// of detail. Edges are collapsed one by one, cheapest first, where the cost of a collapse is how far the kept vertex
// lies from the planes of the triangles around both ends (the quadric error metric of Garland and Heckbert, 1997).
// A collapse that would turn a triangle over, pinch the surface or move an open edge is refused. Each kept vertex
// keeps its own normal, colour and texture coordinates, so seams and painted parts stay where they were.
import { World3DError } from './core3D.js';
import { Attribute3D, Geometry3D } from './Geometry3D.js';

/** How far to simplify. */
export interface SimplifyOptions3D {
  /** Stop at this many triangles or fewer. */
  readonly triangles?: number;
  /** Or keep this share of the triangles, from 0 to 1. Ignored when `triangles` is given. */
  readonly ratio?: number;
  /**
   * Never move the surface further than this, in the model's units, even short of the target: the target is then
   * not reached. No limit unless given.
   */
  readonly maxError?: number;
}

/** How a simplification went. */
export interface SimplifyResult3D {
  readonly geometry: Geometry3D;
  /** Triangles before and after. */
  readonly before: number;
  readonly after: number;
  /** The largest distance, in the model's units, a collapse moved the surface by. */
  readonly error: number;
}

function invalid(what: string): World3DError {
  return new World3DError('WORLD3D_INPUT_INVALID', what);
}

class Heap {
  readonly cost: number[] = [];
  readonly a: number[] = [];
  readonly b: number[] = [];
  readonly stamp: number[] = [];
  get size(): number {
    return this.cost.length;
  }
  push(cost: number, a: number, b: number, stamp: number): void {
    let i = this.cost.length;
    this.cost.push(cost);
    this.a.push(a);
    this.b.push(b);
    this.stamp.push(stamp);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cost[p]! <= cost) break;
      this.#swap(i, p);
      i = p;
    }
  }
  pop(): [number, number, number, number] {
    const top: [number, number, number, number] = [this.cost[0]!, this.a[0]!, this.b[0]!, this.stamp[0]!];
    const last = this.cost.length - 1;
    this.#swap(0, last);
    this.cost.pop();
    this.a.pop();
    this.b.pop();
    this.stamp.pop();
    let i = 0;
    for (;;) {
      const l = i * 2 + 1,
        r = l + 1;
      let m = i;
      if (l < this.cost.length && this.cost[l]! < this.cost[m]!) m = l;
      if (r < this.cost.length && this.cost[r]! < this.cost[m]!) m = r;
      if (m === i) break;
      this.#swap(i, m);
      i = m;
    }
    return top;
  }
  #swap(i: number, j: number): void {
    for (const list of [this.cost, this.a, this.b, this.stamp]) {
      const t = list[i]!;
      list[i] = list[j]!;
      list[j] = t;
    }
  }
}

/**
 * A copy of an indexed triangle geometry with fewer triangles; the geometry given is not changed. Groups (one material per range) are kept;
 * geometries with morph targets are refused. Vertices that sit
 * on an open edge (a hole, or a texture seam where vertices are split) are kept in place.
 */
export function simplifyGeometry3D(geometry: Geometry3D, options: SimplifyOptions3D = {}): SimplifyResult3D {
  if (!(geometry instanceof Geometry3D)) throw invalid('simplify geometry');
  if (geometry.topology !== 'triangles') throw invalid('simplify topology');
  // Morph targets move vertices a collapse would join.
  if (geometry.morphTargets.length > 0) throw invalid('simplify morph targets');
  if (options === null || typeof options !== 'object') throw invalid('simplify options');
  const position = geometry.getAttribute('position');
  if (!position || position.itemSize !== 3) throw invalid('simplify positions');
  const P = position.data;
  const n = P.length / 3;
  const source = geometry.index ? Array.from(geometry.index.data) : Array.from({ length: n }, (_, i) => i);
  if (source.length % 3 !== 0) throw invalid('simplify indices');
  const faces = source.length / 3;
  let target: number;
  if (options.triangles !== undefined) {
    if (!Number.isInteger(options.triangles) || options.triangles < 0) throw invalid('simplify triangles');
    target = options.triangles;
  } else if (options.ratio !== undefined) {
    if (typeof options.ratio !== 'number' || !(options.ratio >= 0 && options.ratio <= 1))
      throw invalid('simplify ratio');
    target = Math.floor(faces * options.ratio);
  } else target = Math.floor(faces / 2);
  let maxError = Infinity;
  if (options.maxError !== undefined) {
    if (typeof options.maxError !== 'number' || !(options.maxError >= 0)) throw invalid('simplify maxError');
    maxError = options.maxError;
  }

  const F = Int32Array.from(source);
  // The material of each triangle, from the groups: a collapse never changes it.
  const groupOf = new Int32Array(faces).fill(-1);
  for (const group of geometry.groups)
    for (let i = Math.floor(group.start / 3); i < Math.min(faces, Math.floor((group.start + group.count) / 3)); i++)
      groupOf[i] = group.materialIndex;
  const alive = new Uint8Array(faces).fill(1);
  const vertexFaces: number[][] = Array.from({ length: n }, () => []);
  for (let f = 0; f < faces; f++) for (let c = 0; c < 3; c++) vertexFaces[F[f * 3 + c]!]!.push(f);

  // Open edges: an edge used by one triangle only. Their vertices stay.
  const edgeUse = new Map<number, number>();
  const key = (a: number, b: number): number => (a < b ? a * n + b : b * n + a);
  for (let f = 0; f < faces; f++)
    for (let c = 0; c < 3; c++) {
      const k = key(F[f * 3 + c]!, F[f * 3 + ((c + 1) % 3)]!);
      edgeUse.set(k, (edgeUse.get(k) ?? 0) + 1);
    }
  const locked = new Uint8Array(n);
  for (let f = 0; f < faces; f++)
    for (let c = 0; c < 3; c++) {
      const a = F[f * 3 + c]!,
        b = F[f * 3 + ((c + 1) % 3)]!;
      if (edgeUse.get(key(a, b)) !== 1) continue;
      locked[a] = 1;
      locked[b] = 1;
    }

  // One quadric per vertex: the sum of the squared distances to the planes of its triangles, area-weighted.
  const Q = new Float64Array(n * 10);
  const addPlane = (v: number, a: number, b: number, c: number, d: number, w: number): void => {
    const q = v * 10;
    Q[q] = Q[q]! + w * a * a;
    Q[q + 1] = Q[q + 1]! + w * a * b;
    Q[q + 2] = Q[q + 2]! + w * a * c;
    Q[q + 3] = Q[q + 3]! + w * a * d;
    Q[q + 4] = Q[q + 4]! + w * b * b;
    Q[q + 5] = Q[q + 5]! + w * b * c;
    Q[q + 6] = Q[q + 6]! + w * b * d;
    Q[q + 7] = Q[q + 7]! + w * c * c;
    Q[q + 8] = Q[q + 8]! + w * c * d;
    Q[q + 9] = Q[q + 9]! + w * d * d;
  };
  const faceNormal = (i0: number, i1: number, i2: number): [number, number, number, number] => {
    const ux = P[i1 * 3]! - P[i0 * 3]!,
      uy = P[i1 * 3 + 1]! - P[i0 * 3 + 1]!,
      uz = P[i1 * 3 + 2]! - P[i0 * 3 + 2]!;
    const vx = P[i2 * 3]! - P[i0 * 3]!,
      vy = P[i2 * 3 + 1]! - P[i0 * 3 + 1]!,
      vz = P[i2 * 3 + 2]! - P[i0 * 3 + 2]!;
    const x = uy * vz - uz * vy,
      y = uz * vx - ux * vz,
      z = ux * vy - uy * vx;
    const l = Math.hypot(x, y, z);
    return l > 0 ? [x / l, y / l, z / l, l / 2] : [0, 0, 0, 0];
  };
  for (let f = 0; f < faces; f++) {
    const i0 = F[f * 3]!,
      i1 = F[f * 3 + 1]!,
      i2 = F[f * 3 + 2]!;
    const [a, b, c, area] = faceNormal(i0, i1, i2);
    if (area === 0) continue;
    const d = -(a * P[i0 * 3]! + b * P[i0 * 3 + 1]! + c * P[i0 * 3 + 2]!);
    for (const v of [i0, i1, i2]) addPlane(v, a, b, c, d, area);
  }
  const errorAt = (q: number, r: number, v: number): number => {
    // The quadric of q plus that of r, at the position of v.
    const x = P[v * 3]!,
      y = P[v * 3 + 1]!,
      z = P[v * 3 + 2]!;
    const s = (i: number): number => Q[q * 10 + i]! + Q[r * 10 + i]!;
    return Math.max(
      0,
      s(0) * x * x +
        2 * s(1) * x * y +
        2 * s(2) * x * z +
        2 * s(3) * x +
        s(4) * y * y +
        2 * s(5) * y * z +
        2 * s(6) * y +
        s(7) * z * z +
        2 * s(8) * z +
        s(9)
    );
  };
  const areaOf = new Float64Array(n);
  for (let f = 0; f < faces; f++) {
    const area = faceNormal(F[f * 3]!, F[f * 3 + 1]!, F[f * 3 + 2]!)[3];
    for (let c = 0; c < 3; c++) {
      const v = F[f * 3 + c]!;
      areaOf[v] = areaOf[v]! + area;
    }
  }
  // The quadric error is an area-weighted squared distance; this turns it back into a distance.
  const distanceOf = (cost: number, u: number, v: number): number =>
    Math.sqrt(cost / Math.max(areaOf[u]! + areaOf[v]!, 1e-30));

  const stamp = new Int32Array(n);
  const heap = new Heap();
  // The cost of moving u onto v, Infinity when u may not move.
  const costOf = (u: number, v: number): number => (locked[u] ? Infinity : errorAt(u, v, v));
  const offer = (a: number, b: number): void => {
    const ab = costOf(a, b),
      ba = costOf(b, a);
    if (ab === Infinity && ba === Infinity) return;
    if (ab <= ba) heap.push(ab, a, b, stamp[a]! + stamp[b]! * 65536);
    else heap.push(ba, b, a, stamp[a]! + stamp[b]! * 65536);
  };
  for (let f = 0; f < faces; f++)
    for (let c = 0; c < 3; c++) {
      const a = F[f * 3 + c]!,
        b = F[f * 3 + ((c + 1) % 3)]!;
      if (a < b) offer(a, b);
      else if (edgeUse.get(key(a, b)) === 1) offer(b, a);
    }

  const neighbours = (v: number): Set<number> => {
    const out = new Set<number>();
    for (const f of vertexFaces[v]!) if (alive[f]) for (let c = 0; c < 3; c++) out.add(F[f * 3 + c]!);
    out.delete(v);
    return out;
  };
  let live = faces,
    worst = 0;
  while (live > target && heap.size > 0) {
    const [cost, u, v, s] = heap.pop();
    const a = Math.min(u, v),
      b = Math.max(u, v);
    if (s !== stamp[a]! + stamp[b]! * 65536) continue;
    if (cost === Infinity) break;
    const moved = distanceOf(cost, u, v);
    if (moved > maxError) break;
    // The edge must still be there, and the two ends must share exactly the two vertices across the edge.
    const nu = neighbours(u);
    if (!nu.has(v)) continue;
    const nv = neighbours(v);
    let shared = 0;
    for (const w of nu) if (nv.has(w)) shared++;
    if (shared !== 2) continue;
    // No triangle of u that stays may turn over or become a sliver.
    let flips = false;
    for (const f of vertexFaces[u]!) {
      if (!alive[f]) continue;
      const i0 = F[f * 3]!,
        i1 = F[f * 3 + 1]!,
        i2 = F[f * 3 + 2]!;
      if (i0 === v || i1 === v || i2 === v) continue;
      const before = faceNormal(i0, i1, i2);
      const after = faceNormal(i0 === u ? v : i0, i1 === u ? v : i1, i2 === u ? v : i2);
      if (after[3] === 0 || before[0] * after[0] + before[1] * after[1] + before[2] * after[2] < 0.3) {
        flips = true;
        break;
      }
    }
    if (flips) continue;
    for (const f of vertexFaces[u]!) {
      if (!alive[f]) continue;
      let hasV = false;
      for (let c = 0; c < 3; c++) if (F[f * 3 + c] === v) hasV = true;
      if (hasV) {
        alive[f] = 0;
        live--;
        continue;
      }
      for (let c = 0; c < 3; c++) if (F[f * 3 + c] === u) F[f * 3 + c] = v;
      vertexFaces[v]!.push(f);
    }
    vertexFaces[u] = [];
    for (let i = 0; i < 10; i++) Q[v * 10 + i] = Q[v * 10 + i]! + Q[u * 10 + i]!;
    areaOf[v] = areaOf[v]! + areaOf[u]!;
    if (moved > worst) worst = moved;
    stamp[v] = stamp[v]! + 1;
    stamp[u] = stamp[u]! + 1;
    vertexFaces[v] = vertexFaces[v]!.filter(f => alive[f]);
    for (const w of neighbours(v)) offer(v, w);
  }

  // Keep the vertices still used, in their first order, with every attribute they had.
  const remap = new Int32Array(n).fill(-1);
  const order: number[] = [];
  const indices: number[] = [];
  const order3 = Array.from({ length: faces }, (_, f) => f).filter(f => alive[f] === 1);
  if (geometry.groups.length > 0) order3.sort((a, b) => groupOf[a]! - groupOf[b]! || a - b);
  for (const f of order3) {
    for (let c = 0; c < 3; c++) {
      const v = F[f * 3 + c]!;
      if (remap[v] === -1) {
        remap[v] = order.length;
        order.push(v);
      }
      indices.push(remap[v]!);
    }
  }
  const out = new Geometry3D();
  out.topology = 'triangles';
  for (const [name, attribute] of geometry.attributes) {
    const size = attribute.itemSize,
      data = attribute.data;
    const copy = new (data.constructor as new (length: number) => typeof data)(order.length * size);
    for (let i = 0; i < order.length; i++)
      for (let c = 0; c < size; c++) copy[i * size + c] = data[order[i]! * size + c]!;
    out.setAttribute(name, new Attribute3D(copy, size, attribute.normalized));
  }
  out.setIndex(order.length > 65535 ? Uint32Array.from(indices) : Uint16Array.from(indices));
  if (geometry.groups.length > 0) {
    let start = 0;
    while (start < order3.length) {
      let end = start;
      while (end < order3.length && groupOf[order3[end]!] === groupOf[order3[start]!]) end++;
      const material = groupOf[order3[start]!]!;
      if (material >= 0) out.addGroup(start * 3, (end - start) * 3, material);
      start = end;
    }
  }
  return { geometry: out, before: faces, after: live, error: worst };
}
