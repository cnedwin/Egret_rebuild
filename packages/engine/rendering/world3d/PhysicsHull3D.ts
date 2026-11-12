// SPDX-License-Identifier: Apache-2.0
// Convex hull collision shape: a closed convex solid described by its corner
// points and the outward planes of its faces. It fills the gap between boxes
// and full triangle meshes for moving props such as rocks, crates with
// bevels and furniture.
import {World3DError} from './core3D.js';
import {Geometry3D} from './Geometry3D.js';

export const PHYSICS_HULL3D_LIMITS = Object.freeze({maxPoints: 64, maxInputPoints: 1048576} as const);

export class ConvexHullShape3D {
    /** Corner points, three floats each, around the body origin. */
    readonly points: Float32Array;
    /** Face planes as [nx, ny, nz, d] with unit outward normals; inside is n . p + d < 0. */
    readonly planes: Float32Array;
    /** Distance from the origin to the farthest corner. */
    readonly radius: number;
    /** Half extents of the axis-aligned box around the points. */
    readonly halfExtents: readonly [number, number, number];

    /**
     * @param points Flat [x, y, z, ...] corner candidates. Interior points are
     * dropped; more than 64 corners are reduced to the 64 most extreme ones.
     * The points should surround the origin, which acts as the center of mass.
     */
    constructor(points: ArrayLike<number>) {
        if (!points || points.length < 12 || points.length % 3 !== 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'hull points');
        if (points.length / 3 > PHYSICS_HULL3D_LIMITS.maxInputPoints) throw new World3DError('WORLD3D_BUDGET', 'hull points');
        // Weld duplicates first.
        const unique: number[] = [], seen = new Set<string>();
        for (let i = 0; i < points.length; i += 3) {
            const x = points[i]!, y = points[i + 1]!, z = points[i + 2]!;
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) throw new World3DError('WORLD3D_INPUT_INVALID', 'hull points');
            const key = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
            if (!seen.has(key)) { seen.add(key); unique.push(x, y, z); }
        }
        let candidates = unique;
        if (unique.length / 3 > PHYSICS_HULL3D_LIMITS.maxPoints) {
            // Keep the points that reach farthest along directions spread evenly over the sphere.
            const picked = new Set<number>(), directions = PHYSICS_HULL3D_LIMITS.maxPoints;
            for (let k = 0; k < directions; k++) {
                const y = 1 - (k + 0.5) * 2 / directions, ring = Math.sqrt(1 - y * y), angle = k * 2.399963, dx = Math.cos(angle) * ring, dz = Math.sin(angle) * ring;
                let best = 0, reach = -Infinity;
                for (let i = 0; i < unique.length; i += 3) { const d = unique[i]! * dx + unique[i + 1]! * y + unique[i + 2]! * dz; if (d > reach) { reach = d; best = i; } }
                picked.add(best);
            }
            candidates = [];
            for (const i of picked) candidates.push(unique[i]!, unique[i + 1]!, unique[i + 2]!);
        }
        const count = candidates.length / 3, planes: number[] = [], used = new Set<number>();
        // A triple of points spans a face when every other point lies on one side of its plane.
        for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) for (let c = b + 1; c < count; c++) {
            const ax = candidates[a * 3]!, ay = candidates[a * 3 + 1]!, az = candidates[a * 3 + 2]!;
            const ux = candidates[b * 3]! - ax, uy = candidates[b * 3 + 1]! - ay, uz = candidates[b * 3 + 2]! - az, vx = candidates[c * 3]! - ax, vy = candidates[c * 3 + 1]! - ay, vz = candidates[c * 3 + 2]! - az;
            let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            const length = Math.hypot(nx, ny, nz);
            if (length < 1e-9) continue;
            nx /= length; ny /= length; nz /= length;
            let d = -(nx * ax + ny * ay + nz * az), front = false, back = false;
            for (let i = 0; i < count && !(front && back); i++) {
                const side = nx * candidates[i * 3]! + ny * candidates[i * 3 + 1]! + nz * candidates[i * 3 + 2]! + d;
                if (side > 1e-5) front = true; else if (side < -1e-5) back = true;
            }
            if (front && back) continue;
            if (!front && !back) continue;   // every point is coplanar: no volume
            if (front) { nx = -nx; ny = -ny; nz = -nz; d = -d; }
            used.add(a); used.add(b); used.add(c);
            let known = false;
            for (let i = 0; i < planes.length && !known; i += 4) known = planes[i]! * nx + planes[i + 1]! * ny + planes[i + 2]! * nz > 0.99999 && Math.abs(planes[i + 3]! - d) < 1e-4;
            if (!known) planes.push(nx, ny, nz, d);
        }
        if (planes.length < 16) throw new World3DError('WORLD3D_INPUT_INVALID', 'hull points do not enclose a volume');
        const corners: number[] = [];
        for (const i of [...used].sort((x, y) => x - y)) corners.push(candidates[i * 3]!, candidates[i * 3 + 1]!, candidates[i * 3 + 2]!);
        this.points = Float32Array.from(corners);
        this.planes = Float32Array.from(planes);
        let radius = 0, hx = 0, hy = 0, hz = 0;
        for (let i = 0; i < corners.length; i += 3) {
            radius = Math.max(radius, Math.hypot(corners[i]!, corners[i + 1]!, corners[i + 2]!));
            hx = Math.max(hx, Math.abs(corners[i]!)); hy = Math.max(hy, Math.abs(corners[i + 1]!)); hz = Math.max(hz, Math.abs(corners[i + 2]!));
        }
        this.radius = radius;
        this.halfExtents = [hx, hy, hz];
    }
    /**
     * Largest signed plane distance of a local point: negative inside, and the
     * penetration depth when negated. Writes that plane's normal.
     */
    signedDistance(x: number, y: number, z: number, normal: number[]): number {
        const planes = this.planes;
        let best = -Infinity, at = 0;
        for (let i = 0; i < planes.length; i += 4) {
            const d = planes[i]! * x + planes[i + 1]! * y + planes[i + 2]! * z + planes[i + 3]!;
            if (d > best) { best = d; at = i; }
        }
        normal[0] = planes[at]!; normal[1] = planes[at + 1]!; normal[2] = planes[at + 2]!;
        return best;
    }
    /** Distance along a local unit ray to the solid, or -1. Writes the entry face normal. */
    raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, limit: number, normal: number[]): number {
        const planes = this.planes;
        let enter = 0, exit = limit, face = -1;
        for (let i = 0; i < planes.length; i += 4) {
            const along = planes[i]! * dx + planes[i + 1]! * dy + planes[i + 2]! * dz, side = planes[i]! * ox + planes[i + 1]! * oy + planes[i + 2]! * oz + planes[i + 3]!;
            if (Math.abs(along) < 1e-12) { if (side > 0) return -1; continue; }
            const t = -side / along;
            if (along < 0) { if (t > enter) { enter = t; face = i; } } else if (t < exit) exit = t;
            if (enter > exit) return -1;
        }
        if (face < 0) return -1;   // The ray starts inside.
        normal[0] = planes[face]!; normal[1] = planes[face + 1]!; normal[2] = planes[face + 2]!;
        return enter;
    }
}

/** Build a convex hull shape from a geometry's vertices, or from a flat list of points. */
export function createConvexHullShape3D(source: Geometry3D | ArrayLike<number>): ConvexHullShape3D {
    if (source instanceof Geometry3D) {
        const position = source.getAttribute('position');
        if (!position) throw new World3DError('WORLD3D_INPUT_INVALID', 'hull geometry');
        return new ConvexHullShape3D(position.data);
    }
    return new ConvexHullShape3D(source);
}
