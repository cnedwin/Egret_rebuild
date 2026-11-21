// SPDX-License-Identifier: Apache-2.0
// Models made in code as distance fields: rounded primitives joined smoothly, cut and mirrored, then turned into
// one coloured mesh. A soft union lets an arm grow out of a body and a mouth be carved into a head without the
// seams of boxes pushed through each other; the mesh comes with normals from the field, colours blended where parts
// meet, and the shade of creases and hollows baked into its vertex colours. Each shape is a plain value: a game
// keeps the field to ask how far a point is from the model, and makes the mesh once.
//
// The distance functions are the standard closed forms of signed distance fields (sphere, rounded box, ellipsoid
// approximation, round cone, capped cone, torus) and the polynomial smooth minimum; the mesh is extracted by surface
// nets on a regular grid, with each vertex moved onto the surface along the field's gradient.
import { World3DError } from './core3D.js';
import { Attribute3D, Geometry3D } from './Geometry3D.js';
import { colorFromHex, quatFromEuler } from './math3D.js';
import type { ColorInput3D } from './Material3D.js';
import { simplifyGeometry3D } from './Simplify3D.js';

type Vec3 = readonly [number, number, number];

/** Where a shape goes and how it looks: moved by `at`, turned by `rotation`, scaled by `scale`, painted `color`. */
export interface SdfOptions3D {
  /** Where the shape's centre goes; [0, 0, 0] by default. */
  readonly at?: Vec3;
  /** Euler angles in radians, in the order of `quatFromEuler`. */
  readonly rotation?: Vec3;
  /** One factor for all three axes. A field stays a distance only when scaled the same way on every axis. */
  readonly scale?: number;
  /** A hex colour as seen on screen, or linear RGB. A shape without one takes the colour of the group it is in. */
  readonly color?: ColorInput3D;
}

/** A group of shapes: `smooth` is how far, in the model's units, the blend between them reaches. */
export interface SdfGroupOptions3D extends SdfOptions3D {
  /** 0 joins shapes with a crease; 0.05 to 0.2 of a part's size reads as one soft body. */
  readonly smooth?: number;
}

/** A shape as a signed distance field: negative inside, positive outside, zero on the surface. */
export abstract class SdfShape3D {
  /** The box the shape lies in, as [minX, minY, minZ, maxX, maxY, maxZ]. */
  readonly bounds: readonly [number, number, number, number, number, number];
  /** @internal */
  readonly paint: Float32Array | undefined;
  readonly #inverse: Float64Array | undefined;
  readonly #at: Vec3;
  readonly #scale: number;

  /** @internal */
  constructor(options: SdfOptions3D | undefined, local: readonly number[]) {
    const o = checkOptions(options);
    this.#at = o.at;
    this.#scale = o.scale;
    this.paint = o.color;
    let rotation: Float64Array | undefined;
    if (o.rotation[0] !== 0 || o.rotation[1] !== 0 || o.rotation[2] !== 0) {
      const q = quatFromEuler(new Float64Array(4), o.rotation[0], o.rotation[1], o.rotation[2]);
      rotation = matrixOf(q);
      // The transpose of a rotation turns it back.
      const t = new Float64Array(9);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) t[r * 3 + c] = rotation[c * 3 + r]!;
      this.#inverse = t;
    }
    this.bounds = Object.freeze(placeBounds(local, rotation, o.at, o.scale)) as SdfShape3D['bounds'];
  }

  /** How far the point is from the surface: negative inside. */
  distance(x: number, y: number, z: number): number {
    const p = this.#toLocal(x, y, z);
    return this.local(p[0], p[1], p[2]) * this.#scale;
  }

  /** @internal The linear colour of the shape at a point, written to `out`; `inherited` when it has none. */
  colorAt(x: number, y: number, z: number, out: Float32Array, inherited: Float32Array): void {
    const p = this.#toLocal(x, y, z);
    this.localColor(p[0], p[1], p[2], out, this.paint ?? inherited);
  }

  /** @internal */
  protected abstract local(x: number, y: number, z: number): number;
  /** @internal */
  protected localColor(_x: number, _y: number, _z: number, out: Float32Array, paint: Float32Array): void {
    out.set(paint);
  }

  #toLocal(x: number, y: number, z: number): [number, number, number] {
    const s = this.#scale;
    let px = x - this.#at[0],
      py = y - this.#at[1],
      pz = z - this.#at[2];
    const m = this.#inverse;
    if (m !== undefined) {
      const rx = m[0]! * px + m[1]! * py + m[2]! * pz,
        ry = m[3]! * px + m[4]! * py + m[5]! * pz,
        rz = m[6]! * px + m[7]! * py + m[8]! * pz;
      px = rx;
      py = ry;
      pz = rz;
    }
    return [px / s, py / s, pz / s];
  }
}

const ZERO: Vec3 = [0, 0, 0];

function invalid(what: string): World3DError {
  return new World3DError('WORLD3D_INPUT_INVALID', what);
}

function vec3(value: unknown, what: string): Vec3 {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) throw invalid(what);
  return value as unknown as Vec3;
}

function positive(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw invalid(what);
  return value;
}

function nonNegative(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw invalid(what);
  return value;
}

function linear(input: ColorInput3D, what: string): Float32Array {
  const out = new Float32Array(3);
  if (typeof input === 'number') {
    if (!Number.isInteger(input) || input < 0 || input > 0xffffff) throw invalid(what);
    return colorFromHex(out, input) as Float32Array;
  }
  if (Array.isArray(input) && input.length === 3 && input.every(Number.isFinite)) {
    out.set(input);
    return out;
  }
  throw invalid(what);
}

function checkOptions(options: SdfOptions3D | undefined): {
  at: Vec3;
  rotation: Vec3;
  scale: number;
  color: Float32Array | undefined;
} {
  if (options === undefined) return { at: ZERO, rotation: ZERO, scale: 1, color: undefined };
  if (options === null || typeof options !== 'object') throw invalid('sdf options');
  return {
    at: options.at === undefined ? ZERO : vec3(options.at, 'sdf at'),
    rotation: options.rotation === undefined ? ZERO : vec3(options.rotation, 'sdf rotation'),
    scale: options.scale === undefined ? 1 : positive(options.scale, 'sdf scale'),
    color: options.color === undefined ? undefined : linear(options.color, 'sdf color')
  };
}

function matrixOf(q: ArrayLike<number>): Float64Array {
  const x = q[0]!,
    y = q[1]!,
    z = q[2]!,
    w = q[3]!;
  // Row-major: row r, column c at r * 3 + c.
  return new Float64Array([
    1 - 2 * (y * y + z * z),
    2 * (x * y - z * w),
    2 * (x * z + y * w),
    2 * (x * y + z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z - x * w),
    2 * (x * z - y * w),
    2 * (y * z + x * w),
    1 - 2 * (x * x + y * y)
  ]);
}

function placeBounds(local: readonly number[], rotation: Float64Array | undefined, at: Vec3, scale: number): number[] {
  const out = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let corner = 0; corner < 8; corner++) {
    let x = (corner & 1 ? local[3]! : local[0]!) * scale,
      y = (corner & 2 ? local[4]! : local[1]!) * scale,
      z = (corner & 4 ? local[5]! : local[2]!) * scale;
    if (rotation !== undefined) {
      const rx = rotation[0]! * x + rotation[1]! * y + rotation[2]! * z,
        ry = rotation[3]! * x + rotation[4]! * y + rotation[5]! * z,
        rz = rotation[6]! * x + rotation[7]! * y + rotation[8]! * z;
      x = rx;
      y = ry;
      z = rz;
    }
    const p = [x + at[0], y + at[1], z + at[2]];
    for (let a = 0; a < 3; a++) {
      if (p[a]! < out[a]!) out[a] = p[a]!;
      if (p[a]! > out[a + 3]!) out[a + 3] = p[a]!;
    }
  }
  return out;
}

const box = (r: number): number[] => [-r, -r, -r, r, r, r];
const grow = (b: readonly number[], by: number): number[] => [
  b[0]! - by,
  b[1]! - by,
  b[2]! - by,
  b[3]! + by,
  b[4]! + by,
  b[5]! + by
];
const len2 = (x: number, y: number): number => Math.sqrt(x * x + y * y);
const len3 = (x: number, y: number, z: number): number => Math.sqrt(x * x + y * y + z * z);
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---- primitives ---------------------------------------------------------------------------------------------------

class Sphere extends SdfShape3D {
  constructor(
    readonly radius: number,
    options?: SdfOptions3D
  ) {
    super(options, box(radius));
  }
  protected local(x: number, y: number, z: number): number {
    return len3(x, y, z) - this.radius;
  }
}

class Box extends SdfShape3D {
  readonly #half: Vec3;
  readonly #round: number;
  constructor(size: Vec3, round: number, options?: SdfOptions3D) {
    const h: Vec3 = [size[0] / 2, size[1] / 2, size[2] / 2];
    super(options, [-h[0], -h[1], -h[2], h[0], h[1], h[2]]);
    this.#half = h;
    this.#round = round;
  }
  protected local(x: number, y: number, z: number): number {
    const r = this.#round;
    const qx = Math.abs(x) - this.#half[0] + r,
      qy = Math.abs(y) - this.#half[1] + r,
      qz = Math.abs(z) - this.#half[2] + r;
    return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
  }
}

class Ellipsoid extends SdfShape3D {
  readonly #r: Vec3;
  constructor(radii: Vec3, options?: SdfOptions3D) {
    super(options, [-radii[0], -radii[1], -radii[2], radii[0], radii[1], radii[2]]);
    this.#r = radii;
  }
  protected local(x: number, y: number, z: number): number {
    const r = this.#r;
    const k0 = len3(x / r[0], y / r[1], z / r[2]),
      k1 = len3(x / (r[0] * r[0]), y / (r[1] * r[1]), z / (r[2] * r[2]));
    if (k1 === 0) return -Math.min(r[0], r[1], r[2]);
    return (k0 * (k0 - 1)) / k1;
  }
}

class RoundCone extends SdfShape3D {
  readonly #a: Vec3;
  readonly #b: Vec3;
  readonly #r1: number;
  readonly #r2: number;
  constructor(from: Vec3, to: Vec3, r1: number, r2: number, options?: SdfOptions3D) {
    const r = Math.max(r1, r2);
    super(options, [
      Math.min(from[0], to[0]) - r,
      Math.min(from[1], to[1]) - r,
      Math.min(from[2], to[2]) - r,
      Math.max(from[0], to[0]) + r,
      Math.max(from[1], to[1]) + r,
      Math.max(from[2], to[2]) + r
    ]);
    this.#a = from;
    this.#b = to;
    this.#r1 = r1;
    this.#r2 = r2;
  }
  protected local(x: number, y: number, z: number): number {
    const a = this.#a,
      b = this.#b,
      r1 = this.#r1,
      r2 = this.#r2;
    const bax = b[0] - a[0],
      bay = b[1] - a[1],
      baz = b[2] - a[2];
    const l2 = bax * bax + bay * bay + baz * baz,
      rr = r1 - r2,
      a2 = l2 - rr * rr;
    const pax = x - a[0],
      pay = y - a[1],
      paz = z - a[2];
    // One end swallows the other: the shape is the larger ball.
    if (a2 <= 1e-12) {
      return r1 >= r2 ? len3(pax, pay, paz) - r1 : len3(x - b[0], y - b[1], z - b[2]) - r2;
    }
    const il2 = 1 / l2;
    const yy = pax * bax + pay * bay + paz * baz,
      zz = yy - l2;
    const cx = pax * l2 - bax * yy,
      cy = pay * l2 - bay * yy,
      cz = paz * l2 - baz * yy;
    const x2 = cx * cx + cy * cy + cz * cz,
      y2 = yy * yy * l2,
      z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
  }
}

class Cylinder extends SdfShape3D {
  readonly #r: number;
  readonly #h: number;
  readonly #round: number;
  constructor(radius: number, height: number, round: number, options?: SdfOptions3D) {
    super(options, [-radius, -height / 2, -radius, radius, height / 2, radius]);
    this.#r = radius;
    this.#h = height / 2;
    this.#round = round;
  }
  protected local(x: number, y: number, z: number): number {
    const r = this.#round;
    const dx = len2(x, z) - this.#r + r,
      dy = Math.abs(y) - this.#h + r;
    return Math.min(Math.max(dx, dy), 0) + len2(Math.max(dx, 0), Math.max(dy, 0)) - r;
  }
}

class Cone extends SdfShape3D {
  readonly #r1: number;
  readonly #r2: number;
  readonly #h: number;
  constructor(bottom: number, top: number, height: number, options?: SdfOptions3D) {
    const r = Math.max(bottom, top);
    super(options, [-r, -height / 2, -r, r, height / 2, r]);
    this.#r1 = bottom;
    this.#r2 = top;
    this.#h = height / 2;
  }
  protected local(x: number, y: number, z: number): number {
    const r1 = this.#r1,
      r2 = this.#r2,
      h = this.#h;
    const qx = len2(x, z),
      qy = y;
    const k2x = r2 - r1,
      k2y = 2 * h;
    const cax = qx - Math.min(qx, qy < 0 ? r1 : r2),
      cay = Math.abs(qy) - h;
    const t = clamp01(((r2 - qx) * k2x + (h - qy) * k2y) / (k2x * k2x + k2y * k2y));
    const cbx = qx - r2 + k2x * t,
      cby = qy - h + k2y * t;
    const s = cbx < 0 && cay < 0 ? -1 : 1;
    return s * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby));
  }
}

class Torus extends SdfShape3D {
  readonly #big: number;
  readonly #tube: number;
  constructor(radius: number, tube: number, options?: SdfOptions3D) {
    super(options, [-radius - tube, -tube, -radius - tube, radius + tube, tube, radius + tube]);
    this.#big = radius;
    this.#tube = tube;
  }
  protected local(x: number, y: number, z: number): number {
    return len2(len2(x, z) - this.#big, y) - this.#tube;
  }
}

/** A ball of `radius`. */
export function sdfSphere(radius: number, options?: SdfOptions3D): SdfShape3D {
  return new Sphere(positive(radius, 'sdf sphere radius'), options);
}

/** A box of `size` [width, height, depth], its edges rounded by `round` (0 for sharp; more than half the smallest side is taken as that). */
export function sdfBox(size: Vec3, options?: SdfOptions3D & { readonly round?: number }): SdfShape3D {
  const s = vec3(size, 'sdf box size');
  if (!s.every(v => v > 0)) throw invalid('sdf box size');
  const round = options?.round === undefined ? 0 : nonNegative(options.round, 'sdf box round');
  return new Box(s, Math.min(round, Math.min(s[0], s[1], s[2]) / 2), options);
}

/** A stretched ball with `radii` [x, y, z]: heads, bodies, eggs and stones. */
export function sdfEllipsoid(radii: Vec3, options?: SdfOptions3D): SdfShape3D {
  const r = vec3(radii, 'sdf ellipsoid radii');
  if (!r.every(v => v > 0)) throw invalid('sdf ellipsoid radii');
  return new Ellipsoid(r, options);
}

/**
 * A rounded limb from `from` to `to`: `radius` thick at the start, `radiusEnd` (the same unless given) at the end.
 * Arms, legs, necks, tails, branches and horns.
 */
export function sdfCapsule(
  from: Vec3,
  to: Vec3,
  radius: number,
  options?: SdfOptions3D & { readonly radiusEnd?: number }
): SdfShape3D {
  const r1 = positive(radius, 'sdf capsule radius');
  const r2 = options?.radiusEnd === undefined ? r1 : positive(options.radiusEnd, 'sdf capsule radiusEnd');
  return new RoundCone(vec3(from, 'sdf capsule from'), vec3(to, 'sdf capsule to'), r1, r2, options);
}

/** An upright cylinder of `radius` and `height` along y, its rims rounded by `round` (at most the radius or half the height). */
export function sdfCylinder(
  radius: number,
  height: number,
  options?: SdfOptions3D & { readonly round?: number }
): SdfShape3D {
  const r = positive(radius, 'sdf cylinder radius'),
    h = positive(height, 'sdf cylinder height');
  const round = options?.round === undefined ? 0 : nonNegative(options.round, 'sdf cylinder round');
  return new Cylinder(r, h, Math.min(round, r, h / 2), options);
}

/** An upright cone of `height` along y, `bottom` wide at its foot and `top` (0 for a point) at its head. */
export function sdfCone(bottom: number, top: number, height: number, options?: SdfOptions3D): SdfShape3D {
  const r1 = nonNegative(bottom, 'sdf cone bottom'),
    r2 = nonNegative(top, 'sdf cone top');
  if (r1 === 0 && r2 === 0) throw invalid('sdf cone radii');
  return new Cone(r1, r2, positive(height, 'sdf cone height'), options);
}

/** A ring lying flat: `radius` to the middle of the tube, `tube` the tube's radius. */
export function sdfTorus(radius: number, tube: number, options?: SdfOptions3D): SdfShape3D {
  return new Torus(positive(radius, 'sdf torus radius'), positive(tube, 'sdf torus tube'), options);
}

// ---- joining ------------------------------------------------------------------------------------------------------

function shapes(list: unknown, what: string): readonly SdfShape3D[] {
  const items = list instanceof SdfShape3D ? [list] : list;
  if (!Array.isArray(items) || items.length === 0 || !items.every(item => item instanceof SdfShape3D))
    throw invalid(what);
  return items as SdfShape3D[];
}

function smoothOf(options: SdfGroupOptions3D | undefined): number {
  return options?.smooth === undefined ? 0 : nonNegative(options.smooth, 'sdf smooth');
}

function unionBounds(list: readonly SdfShape3D[]): number[] {
  const out = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const item of list)
    for (let a = 0; a < 3; a++) {
      out[a] = Math.min(out[a]!, item.bounds[a]!);
      out[a + 3] = Math.max(out[a + 3]!, item.bounds[a + 3]!);
    }
  return out;
}

const mix3 = (out: Float32Array, a: Float32Array, b: Float32Array, t: number): void => {
  out[0] = a[0]! + (b[0]! - a[0]!) * t;
  out[1] = a[1]! + (b[1]! - a[1]!) * t;
  out[2] = a[2]! + (b[2]! - a[2]!) * t;
};

class Union extends SdfShape3D {
  readonly #items: readonly SdfShape3D[];
  readonly #k: number;
  constructor(items: readonly SdfShape3D[], k: number, options?: SdfOptions3D) {
    super(options, grow(unionBounds(items), k * 0.25));
    this.#items = items;
    this.#k = k;
  }
  protected local(x: number, y: number, z: number): number {
    const k = this.#k;
    let d = this.#items[0]!.distance(x, y, z);
    for (let i = 1; i < this.#items.length; i++) {
      const e = this.#items[i]!.distance(x, y, z);
      if (k === 0) d = Math.min(d, e);
      else {
        const h = clamp01(0.5 + (0.5 * (e - d)) / k);
        d = e + (d - e) * h - k * h * (1 - h);
      }
    }
    return d;
  }
  protected override localColor(x: number, y: number, z: number, out: Float32Array, paint: Float32Array): void {
    const k = this.#k,
      other = new Float32Array(3);
    this.#items[0]!.colorAt(x, y, z, out, paint);
    let d = this.#items[0]!.distance(x, y, z);
    for (let i = 1; i < this.#items.length; i++) {
      const item = this.#items[i]!,
        e = item.distance(x, y, z);
      item.colorAt(x, y, z, other, paint);
      // h is the share of what is joined so far; 1 - h that of this shape.
      const h = k === 0 ? (d <= e ? 1 : 0) : clamp01(0.5 + (0.5 * (e - d)) / k);
      mix3(out, other, out, h);
      d = k === 0 ? Math.min(d, e) : e + (d - e) * h - k * h * (1 - h);
    }
  }
}

class Subtract extends SdfShape3D {
  readonly #base: SdfShape3D;
  readonly #cut: readonly SdfShape3D[];
  readonly #k: number;
  constructor(base: SdfShape3D, cut: readonly SdfShape3D[], k: number, options?: SdfOptions3D) {
    super(options, grow(base.bounds, k * 0.25));
    this.#base = base;
    this.#cut = cut;
    this.#k = k;
  }
  #step(d: number, c: number): [number, number] {
    const k = this.#k;
    if (k === 0) return -c > d ? [-c, 1] : [d, 0];
    const h = clamp01(0.5 - (0.5 * (d + c)) / k);
    return [d + (-c - d) * h + k * h * (1 - h), h];
  }
  protected local(x: number, y: number, z: number): number {
    let d = this.#base.distance(x, y, z);
    for (const cut of this.#cut) d = this.#step(d, cut.distance(x, y, z))[0];
    return d;
  }
  protected override localColor(x: number, y: number, z: number, out: Float32Array, paint: Float32Array): void {
    const other = new Float32Array(3);
    this.#base.colorAt(x, y, z, out, paint);
    let d = this.#base.distance(x, y, z);
    for (const cut of this.#cut) {
      const [next, h] = this.#step(d, cut.distance(x, y, z));
      // A cut with its own colour paints the faces it leaves, as the inside of a mouth.
      if (cut.paint !== undefined) {
        cut.colorAt(x, y, z, other, paint);
        mix3(out, out, other, h);
      }
      d = next;
    }
  }
}

class Intersect extends SdfShape3D {
  readonly #items: readonly SdfShape3D[];
  readonly #k: number;
  constructor(items: readonly SdfShape3D[], k: number, options?: SdfOptions3D) {
    const b = items[0]!.bounds.slice();
    for (const item of items)
      for (let a = 0; a < 3; a++) {
        b[a] = Math.max(b[a]!, item.bounds[a]!);
        b[a + 3] = Math.min(b[a + 3]!, item.bounds[a + 3]!);
      }
    for (let a = 0; a < 3; a++) if (b[a]! > b[a + 3]!) b[a + 3] = b[a]!;
    super(options, grow(b, k * 0.25));
    this.#items = items;
    this.#k = k;
  }
  protected local(x: number, y: number, z: number): number {
    const k = this.#k;
    let d = this.#items[0]!.distance(x, y, z);
    for (let i = 1; i < this.#items.length; i++) {
      const e = this.#items[i]!.distance(x, y, z);
      if (k === 0) d = Math.max(d, e);
      else {
        const h = clamp01(0.5 - (0.5 * (e - d)) / k);
        d = e + (d - e) * h + k * h * (1 - h);
      }
    }
    return d;
  }
}

class Mirror extends SdfShape3D {
  readonly #shape: SdfShape3D;
  readonly #axis: 0 | 1 | 2;
  constructor(shape: SdfShape3D, axis: 0 | 1 | 2, options?: SdfOptions3D) {
    const b = shape.bounds.slice();
    const m = Math.max(Math.abs(b[axis]!), Math.abs(b[axis + 3]!));
    b[axis] = -m;
    b[axis + 3] = m;
    super(options, b);
    this.#shape = shape;
    this.#axis = axis;
  }
  #fold(x: number, y: number, z: number): [number, number, number] {
    return this.#axis === 0 ? [Math.abs(x), y, z] : this.#axis === 1 ? [x, Math.abs(y), z] : [x, y, Math.abs(z)];
  }
  protected local(x: number, y: number, z: number): number {
    const p = this.#fold(x, y, z);
    return this.#shape.distance(p[0], p[1], p[2]);
  }
  protected override localColor(x: number, y: number, z: number, out: Float32Array, paint: Float32Array): void {
    const p = this.#fold(x, y, z);
    this.#shape.colorAt(p[0], p[1], p[2], out, paint);
  }
}

class Modify extends SdfShape3D {
  readonly #shape: SdfShape3D;
  readonly #change: (d: number, x: number, y: number, z: number) => number;
  constructor(
    shape: SdfShape3D,
    by: number,
    change: (d: number, x: number, y: number, z: number) => number,
    options?: SdfOptions3D
  ) {
    super(options, grow(shape.bounds, by));
    this.#shape = shape;
    this.#change = change;
  }
  protected local(x: number, y: number, z: number): number {
    return this.#change(this.#shape.distance(x, y, z), x, y, z);
  }
  protected override localColor(x: number, y: number, z: number, out: Float32Array, paint: Float32Array): void {
    this.#shape.colorAt(x, y, z, out, paint);
  }
}

/** The shapes joined into one; with `smooth`, blended where they meet. */
export function sdfUnion(items: SdfShape3D | readonly SdfShape3D[], options?: SdfGroupOptions3D): SdfShape3D {
  return new Union(shapes(items, 'sdf union shapes'), smoothOf(options), options);
}

/**
 * `base` with `cut` taken away; with `smooth`, the edges of the hollow rounded. A cut that has a colour paints the
 * faces it leaves, as the inside of a mouth or a window.
 */
export function sdfSubtract(
  base: SdfShape3D,
  cut: SdfShape3D | readonly SdfShape3D[],
  options?: SdfGroupOptions3D
): SdfShape3D {
  return new Subtract(
    shapes(base, 'sdf subtract base')[0]!,
    shapes(cut, 'sdf subtract cut'),
    smoothOf(options),
    options
  );
}

/** What the shapes have in common; with `smooth`, its edges rounded. */
export function sdfIntersect(items: readonly SdfShape3D[], options?: SdfGroupOptions3D): SdfShape3D {
  return new Intersect(shapes(items, 'sdf intersect shapes'), smoothOf(options), options);
}

/**
 * The shape and its mirror image across the plane through the origin square to `axis` ('x' unless given): make one
 * eye, ear, arm or leg on the positive side and get the pair.
 */
export function sdfMirror(shape: SdfShape3D, options?: SdfOptions3D & { readonly axis?: 'x' | 'y' | 'z' }): SdfShape3D {
  const axis = options?.axis ?? 'x';
  if (axis !== 'x' && axis !== 'y' && axis !== 'z') throw invalid('sdf mirror axis');
  return new Mirror(shapes(shape, 'sdf mirror shape')[0]!, axis === 'x' ? 0 : axis === 'y' ? 1 : 2, options);
}

/** The shape grown by `radius` all round, its edges rounded by as much. */
export function sdfRound(shape: SdfShape3D, radius: number, options?: SdfOptions3D): SdfShape3D {
  const r = nonNegative(radius, 'sdf round radius');
  return new Modify(shapes(shape, 'sdf round shape')[0]!, r, d => d - r, options);
}

/** A hollow skin of the shape, `thickness` thick: bowls, pots, helmets, when cut open. */
export function sdfShell(shape: SdfShape3D, thickness: number, options?: SdfOptions3D): SdfShape3D {
  const t = positive(thickness, 'sdf shell thickness') / 2;
  return new Modify(shapes(shape, 'sdf shell shape')[0]!, t, d => Math.abs(d) - t, options);
}

/** What `sdfDisplace` does: how far, how fine and which noise. */
export interface SdfDisplaceOptions3D {
  /** How far the surface moves in and out, in the model's units. */
  readonly amount: number;
  /** How many bumps per unit; 4 unless given. */
  readonly frequency?: number;
  /** Which noise: the same seed gives the same bumps. 0 unless given. */
  readonly seed?: number;
}

/** The surface pushed in and out by smooth noise: rocks, bark, rough earth, a lumpy creature. */
export function sdfDisplace(shape: SdfShape3D, options: SdfDisplaceOptions3D): SdfShape3D {
  if (options === null || typeof options !== 'object') throw invalid('sdf displace options');
  const amount = nonNegative(options.amount, 'sdf displace amount');
  const f = options.frequency === undefined ? 4 : positive(options.frequency, 'sdf displace frequency');
  const seed = options.seed === undefined ? 0 : Math.floor(requireNumber(options.seed, 'sdf displace seed'));
  // The surface only: placing and painting belong to the shape displaced.
  return new Modify(shapes(shape, 'sdf displace shape')[0]!, amount, (d, x, y, z) => {
    return d + amount * noise3(x * f, y * f, z * f, seed);
  });
}

function requireNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid(what);
  return value;
}

// ---- noise --------------------------------------------------------------------------------------------------------

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h & 0xffffff) / 0x7fffff - 1;
}

/** Smooth value noise in [-1, 1]. */
function noise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const fx = x - ix,
    fy = y - iy,
    fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy),
    uz = fz * fz * (3 - 2 * fz);
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number): number => hash3(ix + dx, iy + dy, iz + dz, seed);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), ux), lerp(c(0, 1, 0), c(1, 1, 0), ux), uy),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), ux), lerp(c(0, 1, 1), c(1, 1, 1), ux), uy),
    uz
  );
}

// ---- the mesh -----------------------------------------------------------------------------------------------------

/** How a field becomes a mesh. */
export interface SdfMeshOptions3D {
  /** Cells along the longest side of the model: 64 unless given, from 8 to 192. More is finer and slower. */
  readonly resolution?: number;
  /** How dark creases and hollows get, from 0 (no shading baked) to 1; 0.7 unless given. */
  readonly occlusion?: number;
  /** How far, in the model's units, a hollow is looked into for that shade; a tenth of the model's size unless given. */
  readonly occlusionRadius?: number;
  /** Uneven colour, so a large part is not one flat tone: `amount` 0 to 1 of brightness, `frequency` per unit. */
  readonly variation?: { readonly amount: number; readonly frequency?: number; readonly seed?: number };
  /** The colour of shapes that have none; white unless given. */
  readonly color?: ColorInput3D;
  /**
   * At most this many triangles: the mesh is simplified to it with `simplifyGeometry3D`. 8000 unless given, enough for a
   * prop or a character seen close in a game; 0 keeps every triangle the grid gives.
   */
  readonly triangles?: number;
}

const MAX_RESOLUTION = 192;

/**
 * The mesh of the field's surface, with smooth normals and linear vertex colours (draw it with a material that has
 * `vertexColors: true`). Made once, when a level or a model is set up: at the default resolution a model takes a few
 * tens of milliseconds.
 */
export function createSdfGeometry3D(shape: SdfShape3D, options: SdfMeshOptions3D = {}): Geometry3D {
  if (!(shape instanceof SdfShape3D)) throw invalid('sdf shape');
  if (options === null || typeof options !== 'object') throw invalid('sdf mesh options');
  const resolution = options.resolution === undefined ? 64 : options.resolution;
  if (!Number.isInteger(resolution) || resolution < 8) throw invalid('sdf mesh resolution');
  if (resolution > MAX_RESOLUTION) throw new World3DError('WORLD3D_BUDGET', 'sdf mesh resolution');
  const occlusion = options.occlusion === undefined ? 0.7 : nonNegative(options.occlusion, 'sdf mesh occlusion');
  if (occlusion > 1) throw invalid('sdf mesh occlusion');
  const variation = options.variation;
  let varAmount = 0,
    varFrequency = 3,
    varSeed = 0;
  if (variation !== undefined) {
    if (variation === null || typeof variation !== 'object') throw invalid('sdf mesh variation');
    varAmount = nonNegative(variation.amount, 'sdf mesh variation amount');
    if (variation.frequency !== undefined) varFrequency = positive(variation.frequency, 'sdf mesh variation frequency');
    if (variation.seed !== undefined) varSeed = Math.floor(requireNumber(variation.seed, 'sdf mesh variation seed'));
  }
  const triangles = options.triangles === undefined ? 8000 : options.triangles;
  if (!Number.isInteger(triangles) || triangles < 0) throw invalid('sdf mesh triangles');
  const base = options.color === undefined ? new Float32Array([1, 1, 1]) : linear(options.color, 'sdf mesh color');

  const b = shape.bounds;
  if (!b.every(Number.isFinite)) throw invalid('sdf shape bounds');
  const size = Math.max(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
  if (!(size > 0)) throw invalid('sdf shape bounds');
  const cell = size / resolution;
  const radius =
    options.occlusionRadius === undefined
      ? Math.max(size * 0.1, cell * 2)
      : positive(options.occlusionRadius, 'sdf mesh occlusionRadius');
  // One cell of room on every side, so a surface touching the bounds is closed.
  const ox = b[0] - cell * 1.5,
    oy = b[1] - cell * 1.5,
    oz = b[2] - cell * 1.5;
  const nx = Math.ceil((b[3] - b[0]) / cell) + 3,
    ny = Math.ceil((b[4] - b[1]) / cell) + 3,
    nz = Math.ceil((b[5] - b[2]) / cell) + 3;
  const sx = nx + 1,
    sxy = (nx + 1) * (ny + 1);
  const field = new Float32Array(sxy * (nz + 1));
  // Blocks of corners far from the surface take the distance at their centre: only its sign is read there, since a
  // corner of a cell the surface crosses is never more than two cells from it.
  const B = 4,
    reach = (Math.sqrt(3) * B * cell) / 2 + cell * 2;
  for (let bk = 0; bk <= nz; bk += B)
    for (let bj = 0; bj <= ny; bj += B)
      for (let bi = 0; bi <= nx; bi += B) {
        const ek = Math.min(bk + B, nz + 1),
          ej = Math.min(bj + B, ny + 1),
          ei = Math.min(bi + B, nx + 1);
        const centre = shape.distance(
          ox + ((bi + ei - 1) / 2) * cell,
          oy + ((bj + ej - 1) / 2) * cell,
          oz + ((bk + ek - 1) / 2) * cell
        );
        const far = Math.abs(centre) > reach;
        for (let k = bk; k < ek; k++)
          for (let j = bj; j < ej; j++)
            for (let i = bi; i < ei; i++)
              field[i + j * sx + k * sxy] = far ? centre : shape.distance(ox + i * cell, oy + j * cell, oz + k * cell);
      }

  const at = (i: number, j: number, k: number): number => field[i + j * sx + k * sxy]!;
  const cellIndex = new Int32Array(nx * ny * nz).fill(-1);
  const positions: number[] = [];
  const corner = new Float64Array(8);
  const EDGES = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7]
  ] as const;
  const grad = (x: number, y: number, z: number): [number, number, number] => {
    const e = cell * 0.5;
    return [
      shape.distance(x + e, y, z) - shape.distance(x - e, y, z),
      shape.distance(x, y + e, z) - shape.distance(x, y - e, z),
      shape.distance(x, y, z + e) - shape.distance(x, y, z - e)
    ];
  };
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          corner[c] = at(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1));
          if (corner[c]! < 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        // The mean of the points where the surface crosses the cell's edges.
        let px = 0,
          py = 0,
          pz = 0,
          n = 0;
        for (const [a, c] of EDGES) {
          const da = corner[a]!,
            dc = corner[c]!;
          if (da < 0 === dc < 0) continue;
          const t = da / (da - dc);
          px += (a & 1) + ((c & 1) - (a & 1)) * t;
          py += ((a >> 1) & 1) + (((c >> 1) & 1) - ((a >> 1) & 1)) * t;
          pz += ((a >> 2) & 1) + (((c >> 2) & 1) - ((a >> 2) & 1)) * t;
          n++;
        }
        let x = ox + (i + px / n) * cell,
          y = oy + (j + py / n) * cell,
          z = oz + (k + pz / n) * cell;
        // Onto the surface along the gradient, kept in the cell so a sharp edge cannot fold the mesh.
        for (let step = 0; step < 2; step++) {
          const d = shape.distance(x, y, z),
            g = grad(x, y, z),
            gg = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
          if (gg < 1e-20) break;
          const f = (d * cell) / gg;
          x = Math.min(Math.max(x - g[0] * f, ox + i * cell), ox + (i + 1) * cell);
          y = Math.min(Math.max(y - g[1] * f, oy + j * cell), oy + (j + 1) * cell);
          z = Math.min(Math.max(z - g[2] * f, oz + k * cell), oz + (k + 1) * cell);
        }
        cellIndex[i + j * nx + k * nx * ny] = positions.length / 3;
        positions.push(x, y, z);
      }

  const indices: number[] = [];
  const cellOf = (i: number, j: number, k: number): number => cellIndex[i + j * nx + k * nx * ny]!;
  const quad = (a: number, b2: number, c: number, d: number, flip: boolean): void => {
    if (a < 0 || b2 < 0 || c < 0 || d < 0) return;
    if (flip) indices.push(a, c, b2, a, d, c);
    else indices.push(a, b2, c, a, c, d);
  };
  for (let k = 1; k < nz; k++)
    for (let j = 1; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const d0 = at(i, j, k),
          d1 = at(i + 1, j, k);
        if (d0 < 0 === d1 < 0) continue;
        quad(cellOf(i, j - 1, k - 1), cellOf(i, j, k - 1), cellOf(i, j, k), cellOf(i, j - 1, k), !(d0 < 0));
      }
  for (let k = 1; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 1; i < nx; i++) {
        const d0 = at(i, j, k),
          d1 = at(i, j + 1, k);
        if (d0 < 0 === d1 < 0) continue;
        quad(cellOf(i - 1, j, k - 1), cellOf(i - 1, j, k), cellOf(i, j, k), cellOf(i, j, k - 1), !(d0 < 0));
      }
  for (let k = 0; k < nz; k++)
    for (let j = 1; j < ny; j++)
      for (let i = 1; i < nx; i++) {
        const d0 = at(i, j, k),
          d1 = at(i, j, k + 1);
        if (d0 < 0 === d1 < 0) continue;
        quad(cellOf(i - 1, j - 1, k), cellOf(i, j - 1, k), cellOf(i, j, k), cellOf(i - 1, j, k), !(d0 < 0));
      }

  const count = positions.length / 3;
  const normals = new Float32Array(count * 3),
    colors = new Float32Array(count * 3),
    rgb = new Float32Array(3);
  for (let v = 0; v < count; v++) {
    const x = positions[v * 3]!,
      y = positions[v * 3 + 1]!,
      z = positions[v * 3 + 2]!;
    const g = grad(x, y, z),
      gl = Math.hypot(g[0], g[1], g[2]) || 1;
    const nxv = g[0] / gl,
      nyv = g[1] / gl,
      nzv = g[2] / gl;
    normals[v * 3] = nxv;
    normals[v * 3 + 1] = nyv;
    normals[v * 3 + 2] = nzv;
    shape.colorAt(x, y, z, rgb, base);
    let shade = 1;
    if (occlusion > 0) {
      // How much of the space along the normal is taken by the model itself, near samples counting most.
      let blocked = 0,
        weight = 0,
        w = 1;
      for (let s = 1; s <= 5; s++) {
        const r = (radius * s) / 5,
          d = shape.distance(x + nxv * r, y + nyv * r, z + nzv * r);
        blocked += w * clamp01((r - d) / r);
        weight += w;
        w *= 0.7;
      }
      shade = 1 - occlusion * clamp01((blocked / weight) * 1.6);
    }
    if (varAmount > 0)
      shade *= 1 + varAmount * noise3(x * varFrequency, y * varFrequency, z * varFrequency, varSeed + 7919);
    colors[v * 3] = Math.max(0, rgb[0]! * shade);
    colors[v * 3 + 1] = Math.max(0, rgb[1]! * shade);
    colors[v * 3 + 2] = Math.max(0, rgb[2]! * shade);
  }
  const geometry = new Geometry3D();
  geometry.setAttribute('position', new Attribute3D(Float32Array.from(positions), 3));
  geometry.setAttribute('normal', new Attribute3D(normals, 3));
  geometry.setAttribute('color', new Attribute3D(colors, 3));
  geometry.setIndex(count > 65535 ? Uint32Array.from(indices) : Uint16Array.from(indices));
  if (triangles === 0 || indices.length / 3 <= triangles) return geometry;
  const simple = simplifyGeometry3D(geometry, { triangles }).geometry;
  geometry.dispose();
  return simple;
}
