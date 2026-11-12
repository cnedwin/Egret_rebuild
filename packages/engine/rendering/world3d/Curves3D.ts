// SPDX-License-Identifier: Apache-2.0
// Parametric curves in 3D and flat outlines in 2D. Curves answer positions
// and tangents by parameter or by distance travelled, and feed the tube,
// lathe, extrude and shape geometries. Points are plain [x, y, z] arrays.
import {World3DError, requireCount3D, requireFinite3D} from './core3D.js';

export type Point3D = [number, number, number];
export type Point2D = [number, number];
export const CURVE3D_LIMITS = Object.freeze({maxPoints: 65536, maxDivisions: 16384} as const);

function point(value: ArrayLike<number>, field: string): Point3D {
    if (!value || value.length < 3) throw new World3DError('WORLD3D_INPUT_INVALID', field);
    return [requireFinite3D(value[0], field), requireFinite3D(value[1], field), requireFinite3D(value[2], field)];
}

/** Base for every curve: subclasses implement getPoint(t) for t in [0, 1]. */
export abstract class Curve3D {
    /** Samples used to measure length and to map distance to parameter. */
    arcLengthDivisions = 200;
    #lengths: Float64Array | undefined;

    /** Position at parameter `t` in [0, 1]. The parameter need not advance at constant speed. */
    abstract getPoint(t: number, out?: Point3D): Point3D;

    /** Call after changing the curve's control points. */
    invalidate(): void { this.#lengths = undefined; }
    /** Cumulative chord lengths at each arc-length division. */
    getLengths(): Float64Array {
        const divisions = Math.max(1, Math.min(Math.floor(this.arcLengthDivisions), CURVE3D_LIMITS.maxDivisions));
        if (this.#lengths && this.#lengths.length === divisions + 1) return this.#lengths;
        const lengths = new Float64Array(divisions + 1), previous: Point3D = [0, 0, 0], current: Point3D = [0, 0, 0];
        this.getPoint(0, previous);
        for (let i = 1; i <= divisions; i++) {
            this.getPoint(i / divisions, current);
            lengths[i] = lengths[i - 1]! + Math.hypot(current[0] - previous[0], current[1] - previous[1], current[2] - previous[2]);
            previous[0] = current[0]; previous[1] = current[1]; previous[2] = current[2];
        }
        return this.#lengths = lengths;
    }
    getLength(): number { const lengths = this.getLengths(); return lengths[lengths.length - 1]!; }
    /** Parameter t that lies the fraction `u` of the way along the curve by distance. */
    parameterAt(u: number): number {
        const lengths = this.getLengths(), last = lengths.length - 1, target = Math.min(Math.max(u, 0), 1) * lengths[last]!;
        let low = 0, high = last;
        while (low < high - 1) { const middle = (low + high) >> 1; if (lengths[middle]! <= target) low = middle; else high = middle; }
        const span = lengths[high]! - lengths[low]!;
        return (low + (span > 0 ? (target - lengths[low]!) / span : 0)) / last;
    }
    /** Position the fraction `u` of the way along the curve, at constant speed. */
    getPointAt(u: number, out?: Point3D): Point3D { return this.getPoint(this.parameterAt(u), out); }
    /** Unit tangent at parameter `t`, by central difference. */
    getTangent(t: number, out: Point3D = [0, 0, 0]): Point3D {
        const delta = 1e-4, a = this.getPoint(Math.max(t - delta, 0)), b = this.getPoint(Math.min(t + delta, 1));
        const x = b[0] - a[0], y = b[1] - a[1], z = b[2] - a[2], length = Math.hypot(x, y, z) || 1;
        out[0] = x / length; out[1] = y / length; out[2] = z / length;
        return out;
    }
    getTangentAt(u: number, out?: Point3D): Point3D { return this.getTangent(this.parameterAt(u), out); }
    /** `divisions + 1` points at equal parameter steps. */
    getPoints(divisions = 32): Point3D[] {
        const count = Math.max(1, requireCount3D(divisions, 'divisions', CURVE3D_LIMITS.maxDivisions)), points: Point3D[] = [];
        for (let i = 0; i <= count; i++) points.push(this.getPoint(i / count));
        return points;
    }
    /** `divisions + 1` points at equal distances. */
    getSpacedPoints(divisions = 32): Point3D[] {
        const count = Math.max(1, requireCount3D(divisions, 'divisions', CURVE3D_LIMITS.maxDivisions)), points: Point3D[] = [];
        for (let i = 0; i <= count; i++) points.push(this.getPointAt(i / count));
        return points;
    }
    /**
     * Tangent, normal and binormal at `segments + 1` stations, transported
     * along the curve without twisting. A closed curve's last frame is rotated
     * to meet its first.
     */
    computeFrames(segments: number, closed = false): {tangents: Point3D[]; normals: Point3D[]; binormals: Point3D[]} {
        const count = Math.max(1, requireCount3D(segments, 'segments', CURVE3D_LIMITS.maxDivisions));
        const tangents: Point3D[] = [], normals: Point3D[] = [], binormals: Point3D[] = [];
        for (let i = 0; i <= count; i++) tangents.push(this.getTangentAt(i / count));
        // Start with the world axis least aligned with the first tangent.
        const t0 = tangents[0]!, ax = Math.abs(t0[0]), ay = Math.abs(t0[1]), az = Math.abs(t0[2]);
        const seed: Point3D = ax <= ay && ax <= az ? [1, 0, 0] : ay <= az ? [0, 1, 0] : [0, 0, 1];
        const first = normalize(cross(cross(t0, seed), t0));
        normals.push(first); binormals.push(cross(t0, first));
        for (let i = 1; i <= count; i++) {
            const previous = tangents[i - 1]!, tangent = tangents[i]!, axis = cross(previous, tangent), length = Math.hypot(axis[0], axis[1], axis[2]);
            let normal = normals[i - 1]!;
            if (length > 1e-9) {
                const angle = Math.acos(Math.min(Math.max(previous[0] * tangent[0] + previous[1] * tangent[1] + previous[2] * tangent[2], -1), 1));
                normal = rotate(normal, [axis[0] / length, axis[1] / length, axis[2] / length], angle);
            }
            normals.push(normal); binormals.push(cross(tangent, normal));
        }
        if (closed) {
            // Spread the leftover twist evenly so the seam closes.
            const a = normals[0]!, b = normals[count]!;
            let twist = Math.acos(Math.min(Math.max(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1), 1)) / count;
            const side = cross(a, b);
            if (tangents[0]![0] * side[0] + tangents[0]![1] * side[1] + tangents[0]![2] * side[2] > 0) twist = -twist;
            for (let i = 1; i <= count; i++) { normals[i] = rotate(normals[i]!, tangents[i]!, twist * i); binormals[i] = cross(tangents[i]!, normals[i]!); }
        }
        return {tangents, normals, binormals};
    }
}
function cross(a: Point3D, b: Point3D): Point3D { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function normalize(a: Point3D): Point3D { const length = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / length, a[1] / length, a[2] / length]; }
/** Rotate `v` about a unit `axis` (Rodrigues). */
function rotate(v: Point3D, axis: Point3D, angle: number): Point3D {
    const c = Math.cos(angle), s = Math.sin(angle), d = (axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2]) * (1 - c), k = cross(axis, v);
    return [v[0] * c + k[0] * s + axis[0] * d, v[1] * c + k[1] * s + axis[1] * d, v[2] * c + k[2] * s + axis[2] * d];
}

export class LineCurve3D extends Curve3D {
    readonly start: Point3D; readonly end: Point3D;
    constructor(start: ArrayLike<number>, end: ArrayLike<number>) { super(); this.start = point(start, 'start'); this.end = point(end, 'end'); }
    getPoint(t: number, out: Point3D = [0, 0, 0]): Point3D {
        const a = this.start, b = this.end;
        out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t;
        return out;
    }
}
export class QuadraticBezierCurve3D extends Curve3D {
    readonly p0: Point3D; readonly p1: Point3D; readonly p2: Point3D;
    constructor(p0: ArrayLike<number>, p1: ArrayLike<number>, p2: ArrayLike<number>) { super(); this.p0 = point(p0, 'p0'); this.p1 = point(p1, 'p1'); this.p2 = point(p2, 'p2'); }
    getPoint(t: number, out: Point3D = [0, 0, 0]): Point3D {
        const k = 1 - t, a = k * k, b = 2 * k * t, c = t * t;
        for (let i = 0; i < 3; i++) out[i] = a * this.p0[i]! + b * this.p1[i]! + c * this.p2[i]!;
        return out;
    }
}
export class CubicBezierCurve3D extends Curve3D {
    readonly p0: Point3D; readonly p1: Point3D; readonly p2: Point3D; readonly p3: Point3D;
    constructor(p0: ArrayLike<number>, p1: ArrayLike<number>, p2: ArrayLike<number>, p3: ArrayLike<number>) {
        super(); this.p0 = point(p0, 'p0'); this.p1 = point(p1, 'p1'); this.p2 = point(p2, 'p2'); this.p3 = point(p3, 'p3');
    }
    getPoint(t: number, out: Point3D = [0, 0, 0]): Point3D {
        const k = 1 - t, a = k * k * k, b = 3 * k * k * t, c = 3 * k * t * t, d = t * t * t;
        for (let i = 0; i < 3; i++) out[i] = a * this.p0[i]! + b * this.p1[i]! + c * this.p2[i]! + d * this.p3[i]!;
        return out;
    }
}
export type CatmullRomKind3D = 'centripetal' | 'chordal' | 'uniform';
/** Smooth curve through every control point. Centripetal spacing avoids loops and cusps. */
export class CatmullRomCurve3D extends Curve3D {
    readonly points: Point3D[];
    closed: boolean;
    kind: CatmullRomKind3D;
    constructor(points: readonly ArrayLike<number>[], options: {readonly closed?: boolean; readonly kind?: CatmullRomKind3D} = {}) {
        super();
        if (!Array.isArray(points) || points.length < 2 || points.length > CURVE3D_LIMITS.maxPoints) throw new World3DError('WORLD3D_INPUT_INVALID', 'curve points');
        this.points = points.map(p => point(p, 'curve point'));
        this.closed = options.closed ?? false;
        this.kind = options.kind ?? 'centripetal';
    }
    getPoint(t: number, out: Point3D = [0, 0, 0]): Point3D {
        const points = this.points, count = points.length, scaled = Math.min(Math.max(t, 0), 1) * (this.closed ? count : count - 1);
        let index = Math.floor(scaled), weight = scaled - index;
        if (!this.closed && index >= count - 1) { index = count - 2; weight = 1; }
        const at = (i: number): Point3D => {
            if (this.closed) return points[((i % count) + count) % count]!;
            if (i < 0) { const a = points[0]!, b = points[1]!; return [2 * a[0] - b[0], 2 * a[1] - b[1], 2 * a[2] - b[2]]; }   // mirrored end
            if (i >= count) { const a = points[count - 1]!, b = points[count - 2]!; return [2 * a[0] - b[0], 2 * a[1] - b[1], 2 * a[2] - b[2]]; }
            return points[i]!;
        };
        const p0 = at(index - 1), p1 = at(index), p2 = at(index + 1), p3 = at(index + 2);
        const power = this.kind === 'uniform' ? 0 : this.kind === 'chordal' ? 0.5 : 0.25;
        let dt0 = Math.pow((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2 + (p1[2] - p0[2]) ** 2, power);
        let dt1 = Math.pow((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2 + (p2[2] - p1[2]) ** 2, power);
        let dt2 = Math.pow((p3[0] - p2[0]) ** 2 + (p3[1] - p2[1]) ** 2 + (p3[2] - p2[2]) ** 2, power);
        // Repeated points give zero intervals; fall back to the neighbouring one.
        if (dt1 < 1e-6) dt1 = 1;
        if (dt0 < 1e-6) dt0 = dt1;
        if (dt2 < 1e-6) dt2 = dt1;
        for (let i = 0; i < 3; i++) {
            const x0 = p0[i]!, x1 = p1[i]!, x2 = p2[i]!, x3 = p3[i]!;
            const t1 = ((x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1) * dt1, t2 = ((x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2) * dt1;
            const c2 = -3 * x1 + 3 * x2 - 2 * t1 - t2, c3 = 2 * x1 - 2 * x2 + t1 + t2;
            out[i] = x1 + t1 * weight + c2 * weight * weight + c3 * weight * weight * weight;
        }
        return out;
    }
}
/** Several curves joined end to end and traversed as one, by length. */
export class CurvePath3D extends Curve3D {
    readonly curves: Curve3D[] = [];
    add(curve: Curve3D): this { this.curves.push(curve); this.invalidate(); return this; }
    getPoint(t: number, out: Point3D = [0, 0, 0]): Point3D {
        const curves = this.curves;
        if (curves.length === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'empty curve path');
        let total = 0;
        for (const curve of curves) total += curve.getLength();
        let target = Math.min(Math.max(t, 0), 1) * total;
        for (let i = 0; i < curves.length; i++) {
            const length = curves[i]!.getLength();
            if (target <= length || i === curves.length - 1) return curves[i]!.getPointAt(length > 0 ? Math.min(target / length, 1) : 0, out);
            target -= length;
        }
        return out;
    }
}

// ---- flat outlines ----------------------------------------------------------------
/** A 2D outline built with pen commands; used as a contour or a hole. */
export class Path2D3D {
    /** Flattened vertices in drawing order. */
    readonly points: Point2D[] = [];
    /** Segments used for each curved command. */
    curveSegments = 12;
    moveTo(x: number, y: number): this { this.points.push([requireFinite3D(x, 'x'), requireFinite3D(y, 'y')]); return this; }
    lineTo(x: number, y: number): this { return this.moveTo(x, y); }
    private last(): Point2D {
        const last = this.points[this.points.length - 1];
        if (!last) throw new World3DError('WORLD3D_INPUT_INVALID', 'path needs moveTo first');
        return last;
    }
    quadraticCurveTo(cx: number, cy: number, x: number, y: number): this {
        const [x0, y0] = this.last(), n = this.curveSegments;
        for (let i = 1; i <= n; i++) { const t = i / n, k = 1 - t; this.points.push([k * k * x0 + 2 * k * t * cx + t * t * x, k * k * y0 + 2 * k * t * cy + t * t * y]); }
        return this;
    }
    bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): this {
        const [x0, y0] = this.last(), n = this.curveSegments;
        for (let i = 1; i <= n; i++) {
            const t = i / n, k = 1 - t, a = k * k * k, b = 3 * k * k * t, c = 3 * k * t * t, d = t * t * t;
            this.points.push([a * x0 + b * c1x + c * c2x + d * x, a * y0 + b * c1y + c * c2y + d * y]);
        }
        return this;
    }
    /** Circular arc around (cx, cy); angles in radians, counter-clockwise unless `clockwise`. */
    arc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number, clockwise = false): this {
        let sweep = endAngle - startAngle;
        if (clockwise && sweep > 0) sweep -= Math.PI * 2; else if (!clockwise && sweep < 0) sweep += Math.PI * 2;
        const n = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI * 2) * this.curveSegments * 4));
        for (let i = 0; i <= n; i++) { const angle = startAngle + sweep * i / n; this.points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]); }
        return this;
    }
    /** Outline without a repeated closing vertex. */
    contour(): Point2D[] {
        const points = this.points.slice(), first = points[0], last = points[points.length - 1];
        if (points.length > 1 && first && last && Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) points.pop();
        if (points.length < 3) throw new World3DError('WORLD3D_INPUT_INVALID', 'outline needs three points');
        return points;
    }
}
/** A filled outline with optional holes. */
export class Shape3D extends Path2D3D {
    readonly holes: Path2D3D[] = [];
    constructor(points?: readonly (readonly [number, number])[]) { super(); if (points) for (const p of points) this.moveTo(p[0], p[1]); }
}
export function signedArea2D(points: readonly Point2D[]): number {
    let area = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) area += points[j]![0] * points[i]![1] - points[i]![0] * points[j]![1];
    return area / 2;
}
/**
 * Triangulate an outline with holes by ear clipping. Returns the merged
 * vertex list (outer contour counter-clockwise, then each hole) and triangle
 * indices into it.
 */
export function triangulateShape3D(contour: readonly Point2D[], holes: readonly (readonly Point2D[])[] = []): {vertices: Point2D[]; indices: number[]} {
    const outer = contour.slice();
    if (signedArea2D(outer) < 0) outer.reverse();
    const vertices: Point2D[] = outer.slice();
    // Working polygon as indices into `vertices`; holes are spliced in through bridges.
    let ring = outer.map((_, i) => i);
    const prepared = holes.map(hole => { const copy = hole.slice(); if (signedArea2D(copy) > 0) copy.reverse(); return copy; })
        .sort((a, b) => Math.max(...b.map(p => p[0])) - Math.max(...a.map(p => p[0])));
    for (const hole of prepared) {
        const base = vertices.length;
        vertices.push(...hole);
        // Bridge from the hole's rightmost vertex to a visible ring vertex.
        let holeIndex = 0;
        for (let i = 1; i < hole.length; i++) if (hole[i]![0] > hole[holeIndex]![0]) holeIndex = i;
        const h = hole[holeIndex]!;
        let best = -1, bestDistance = Infinity;
        for (let i = 0; i < ring.length; i++) {
            const candidate = vertices[ring[i]!]!, distance = (candidate[0] - h[0]) ** 2 + (candidate[1] - h[1]) ** 2;
            if (distance >= bestDistance) continue;
            let blocked = false;
            for (let j = 0; j < ring.length && !blocked; j++) {
                const a = ring[j]!, b = ring[(j + 1) % ring.length]!;
                if (a === ring[i] || b === ring[i]) continue;
                blocked = segmentsCross(h, candidate, vertices[a]!, vertices[b]!);
            }
            for (let j = 0; j < hole.length && !blocked; j++) {
                const a = j, b = (j + 1) % hole.length;
                if (a === holeIndex || b === holeIndex) continue;
                blocked = segmentsCross(h, candidate, hole[a]!, hole[b]!);
            }
            if (!blocked) { best = i; bestDistance = distance; }
        }
        if (best < 0) best = 0;
        const loop: number[] = [];
        for (let i = 0; i <= hole.length; i++) loop.push(base + (holeIndex + i) % hole.length);
        ring = [...ring.slice(0, best + 1), ...loop, ring[best]!, ...ring.slice(best + 1)];
    }
    const indices: number[] = [];
    let guard = ring.length * ring.length + 16;
    while (ring.length > 3 && guard-- > 0) {
        let clipped = false;
        for (let i = 0; i < ring.length; i++) {
            const ia = ring[(i + ring.length - 1) % ring.length]!, ib = ring[i]!, ic = ring[(i + 1) % ring.length]!;
            const a = vertices[ia]!, b = vertices[ib]!, c = vertices[ic]!;
            if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) <= 1e-12) continue;   // reflex or flat corner
            let empty = true;
            for (const other of ring) {
                if (other === ia || other === ib || other === ic) continue;
                const p = vertices[other]!;
                // Bridge duplicates share coordinates with a corner; they are not inside.
                if ((p[0] === a[0] && p[1] === a[1]) || (p[0] === b[0] && p[1] === b[1]) || (p[0] === c[0] && p[1] === c[1])) continue;
                if (insideTriangle(p, a, b, c)) { empty = false; break; }
            }
            if (!empty) continue;
            indices.push(ia, ib, ic);
            ring.splice(i, 1);
            clipped = true;
            break;
        }
        if (!clipped) break;   // Degenerate input: stop instead of looping forever.
    }
    if (ring.length === 3) indices.push(ring[0]!, ring[1]!, ring[2]!);
    return {vertices, indices};
}
function insideTriangle(p: Point2D, a: Point2D, b: Point2D, c: Point2D): boolean {
    const d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]), d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1]);
    const d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1]);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
function segmentsCross(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): boolean {
    const d = (a: Point2D, b: Point2D, c: Point2D): number => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
