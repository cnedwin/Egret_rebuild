// SPDX-License-Identifier: Apache-2.0
// Static triangle-mesh collision shape for level geometry: terrain, floors,
// walls and props. Triangles are solid on their front (counter-clockwise)
// side. A bounding-volume hierarchy keeps queries proportional to the
// triangles actually near the moving body rather than to the whole level.
import {World3DError} from './core3D.js';
import {Geometry3D} from './Geometry3D.js';
import {Mesh3D} from './Mesh3D.js';
import {Object3D} from './Object3D.js';

export const PHYSICS_MESH3D_LIMITS = Object.freeze({maxTriangles: 4194304, leafTriangles: 4} as const);

export class TriangleMeshShape3D {
    /** Vertex positions, three floats each, in the shape's local space. */
    readonly positions: Float32Array;
    /** Vertex indices, three per triangle, reordered for the hierarchy. */
    readonly indices: Uint32Array;
    readonly triangleCount: number;
    /** Local bounds as [minX, minY, minZ, maxX, maxY, maxZ]. */
    readonly bounds = new Float32Array(6);
    // Hierarchy nodes: bounds, then either two children (left, left + 1) or a triangle range.
    readonly #nodeBounds: Float32Array;
    readonly #nodeLeft: Int32Array;
    readonly #nodeStart: Int32Array;
    readonly #nodeCount: Int32Array;
    readonly #stack = new Int32Array(64);

    constructor(positions: ArrayLike<number>, indices?: ArrayLike<number>) {
        if (!positions || positions.length < 9 || positions.length % 3 !== 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'mesh positions');
        const vertexCount = positions.length / 3, source = indices ?? Array.from({length: vertexCount}, (_, i) => i);
        if (source.length < 3 || source.length % 3 !== 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'mesh indices');
        if (source.length / 3 > PHYSICS_MESH3D_LIMITS.maxTriangles) throw new World3DError('WORLD3D_BUDGET', 'mesh triangles');
        this.positions = Float32Array.from(positions);
        for (let i = 0; i < this.positions.length; i++) if (!Number.isFinite(this.positions[i]!)) throw new World3DError('WORLD3D_INPUT_INVALID', 'mesh positions');
        // Drop triangles without area: they have no normal and can never be hit.
        const kept: number[] = [], p = this.positions;
        for (let i = 0; i < source.length; i += 3) {
            const a = source[i]!, b = source[i + 1]!, c = source[i + 2]!;
            if (!(a >= 0 && a < vertexCount && b >= 0 && b < vertexCount && c >= 0 && c < vertexCount)) throw new World3DError('WORLD3D_INPUT_INVALID', 'mesh index range');
            const ux = p[b * 3]! - p[a * 3]!, uy = p[b * 3 + 1]! - p[a * 3 + 1]!, uz = p[b * 3 + 2]! - p[a * 3 + 2]!, vx = p[c * 3]! - p[a * 3]!, vy = p[c * 3 + 1]! - p[a * 3 + 1]!, vz = p[c * 3 + 2]! - p[a * 3 + 2]!;
            if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) > 1e-12) kept.push(a, b, c);
        }
        if (kept.length === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'mesh has no triangles with area');
        const count = this.triangleCount = kept.length / 3;
        // Per-triangle bounds and centroids drive the median splits.
        const boxes = new Float32Array(count * 6), centers = new Float32Array(count * 3), order = new Uint32Array(count);
        for (let t = 0; t < count; t++) {
            order[t] = t;
            for (let axis = 0; axis < 3; axis++) {
                const a = p[kept[t * 3]! * 3 + axis]!, b = p[kept[t * 3 + 1]! * 3 + axis]!, c = p[kept[t * 3 + 2]! * 3 + axis]!;
                boxes[t * 6 + axis] = Math.min(a, b, c); boxes[t * 6 + 3 + axis] = Math.max(a, b, c); centers[t * 3 + axis] = (a + b + c) / 3;
            }
        }
        const maxNodes = Math.max(2 * count, 2), nodeBounds = new Float32Array(maxNodes * 6), nodeLeft = new Int32Array(maxNodes).fill(-1), nodeStart = new Int32Array(maxNodes), nodeCount = new Int32Array(maxNodes);
        let used = 1;
        const pending: number[] = [0];
        nodeStart[0] = 0; nodeCount[0] = count;
        while (pending.length > 0) {
            const node = pending.pop()!, start = nodeStart[node]!, size = nodeCount[node]!;
            let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity;
            for (let i = start; i < start + size; i++) {
                const t = order[i]!;
                x0 = Math.min(x0, boxes[t * 6]!); y0 = Math.min(y0, boxes[t * 6 + 1]!); z0 = Math.min(z0, boxes[t * 6 + 2]!);
                x1 = Math.max(x1, boxes[t * 6 + 3]!); y1 = Math.max(y1, boxes[t * 6 + 4]!); z1 = Math.max(z1, boxes[t * 6 + 5]!);
                cx0 = Math.min(cx0, centers[t * 3]!); cy0 = Math.min(cy0, centers[t * 3 + 1]!); cz0 = Math.min(cz0, centers[t * 3 + 2]!);
                cx1 = Math.max(cx1, centers[t * 3]!); cy1 = Math.max(cy1, centers[t * 3 + 1]!); cz1 = Math.max(cz1, centers[t * 3 + 2]!);
            }
            nodeBounds.set([x0, y0, z0, x1, y1, z1], node * 6);
            if (size <= PHYSICS_MESH3D_LIMITS.leafTriangles) continue;
            const ex = cx1 - cx0, ey = cy1 - cy0, ez = cz1 - cz0, axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
            const middle = axis === 0 ? (cx0 + cx1) / 2 : axis === 1 ? (cy0 + cy1) / 2 : (cz0 + cz1) / 2;
            let i = start, j = start + size - 1;
            while (i <= j) {
                if (centers[order[i]! * 3 + axis]! < middle) i++;
                else { const swap = order[i]!; order[i] = order[j]!; order[j] = swap; j--; }
            }
            // Coincident centroids cannot be separated; split the range in half instead.
            let leftSize = i - start;
            if (leftSize === 0 || leftSize === size) leftSize = size >> 1;
            const left = used; used += 2;
            nodeLeft[node] = left;
            nodeStart[left] = start; nodeCount[left] = leftSize; nodeStart[left + 1] = start + leftSize; nodeCount[left + 1] = size - leftSize;
            pending.push(left, left + 1);
        }
        const sorted = new Uint32Array(count * 3);
        for (let i = 0; i < count; i++) { const t = order[i]!; sorted[i * 3] = kept[t * 3]!; sorted[i * 3 + 1] = kept[t * 3 + 1]!; sorted[i * 3 + 2] = kept[t * 3 + 2]!; }
        this.indices = sorted;
        this.#nodeBounds = nodeBounds.slice(0, used * 6); this.#nodeLeft = nodeLeft.slice(0, used); this.#nodeStart = nodeStart.slice(0, used); this.#nodeCount = nodeCount.slice(0, used);
        this.bounds.set(this.#nodeBounds.subarray(0, 6));
    }
    /** Call `visit` with each triangle index whose bounds may touch the box. */
    query(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, visit: (triangle: number) => void): void {
        const bounds = this.#nodeBounds, left = this.#nodeLeft, stack = this.#stack;
        let top = 0;
        stack[top++] = 0;
        while (top > 0) {
            const node = stack[--top]!, at = node * 6;
            if (bounds[at]! > maxX || bounds[at + 3]! < minX || bounds[at + 1]! > maxY || bounds[at + 4]! < minY || bounds[at + 2]! > maxZ || bounds[at + 5]! < minZ) continue;
            const child = left[node]!;
            if (child >= 0) { if (top < 62) { stack[top++] = child; stack[top++] = child + 1; } continue; }
            for (let i = this.#nodeStart[node]!, end = i + this.#nodeCount[node]!; i < end; i++) visit(i);
        }
    }
    /** Unit normal of a triangle's front side. */
    triangleNormal(triangle: number, out: number[]): number[] {
        const p = this.positions, a = this.indices[triangle * 3]! * 3, b = this.indices[triangle * 3 + 1]! * 3, c = this.indices[triangle * 3 + 2]! * 3;
        const ux = p[b]! - p[a]!, uy = p[b + 1]! - p[a + 1]!, uz = p[b + 2]! - p[a + 2]!, vx = p[c]! - p[a]!, vy = p[c + 1]! - p[a + 1]!, vz = p[c + 2]! - p[a + 2]!;
        const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx, length = Math.hypot(x, y, z) || 1;
        out[0] = x / length; out[1] = y / length; out[2] = z / length;
        return out;
    }
    /**
     * Closest point on a triangle to (x, y, z). Returns true when it lies in
     * the triangle's interior rather than on an edge or a corner.
     */
    closestPoint(triangle: number, x: number, y: number, z: number, out: number[]): boolean {
        const p = this.positions, ia = this.indices[triangle * 3]! * 3, ib = this.indices[triangle * 3 + 1]! * 3, ic = this.indices[triangle * 3 + 2]! * 3;
        const ax = p[ia]!, ay = p[ia + 1]!, az = p[ia + 2]!, bx = p[ib]!, by = p[ib + 1]!, bz = p[ib + 2]!, cx = p[ic]!, cy = p[ic + 1]!, cz = p[ic + 2]!;
        const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az, apx = x - ax, apy = y - ay, apz = z - az;
        const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
        if (d1 <= 0 && d2 <= 0) { out[0] = ax; out[1] = ay; out[2] = az; return false; }
        const bpx = x - bx, bpy = y - by, bpz = z - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
        if (d3 >= 0 && d4 <= d3) { out[0] = bx; out[1] = by; out[2] = bz; return false; }
        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); out[0] = ax + abx * v; out[1] = ay + aby * v; out[2] = az + abz * v; return false; }
        const cpx = x - cx, cpy = y - cy, cpz = z - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { out[0] = cx; out[1] = cy; out[2] = cz; return false; }
        const vb = d5 * d2 - d1 * d6;
        if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); out[0] = ax + acx * w; out[1] = ay + acy * w; out[2] = az + acz * w; return false; }
        const va = d3 * d6 - d5 * d4;
        if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
            const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
            out[0] = bx + (cx - bx) * w; out[1] = by + (cy - by) * w; out[2] = bz + (cz - bz) * w;
            return false;
        }
        const denominator = 1 / (va + vb + vc), v = vb * denominator, w = vc * denominator;
        out[0] = ax + abx * v + acx * w; out[1] = ay + aby * v + acy * w; out[2] = az + abz * v + acz * w;
        return true;
    }
    /**
     * Distance along a unit ray to the nearest front-facing triangle within
     * `limit`, or -1. Writes that triangle's normal.
     */
    raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, limit: number, normal: number[]): number {
        const bounds = this.#nodeBounds, left = this.#nodeLeft, stack = this.#stack, p = this.positions, indices = this.indices;
        let best = limit, hit = -1, top = 0;
        stack[top++] = 0;
        while (top > 0) {
            const node = stack[--top]!, at = node * 6;
            // Slab test against the node bounds, clipped to the best hit so far.
            let t0 = 0, t1 = best, outside = false;
            for (let axis = 0; axis < 3; axis++) {
                const origin = axis === 0 ? ox : axis === 1 ? oy : oz, direction = axis === 0 ? dx : axis === 1 ? dy : dz, low = bounds[at + axis]!, high = bounds[at + 3 + axis]!;
                // A ray parallel to a slab either stays inside it for its whole length or never enters.
                if (Math.abs(direction) < 1e-12) { if (origin < low || origin > high) outside = true; continue; }
                const near = (low - origin) / direction, far = (high - origin) / direction;
                t0 = Math.max(t0, Math.min(near, far)); t1 = Math.min(t1, Math.max(near, far));
            }
            if (outside) continue;
            if (!(t0 <= t1)) continue;
            const child = left[node]!;
            if (child >= 0) { if (top < 62) { stack[top++] = child; stack[top++] = child + 1; } continue; }
            for (let i = this.#nodeStart[node]!, end = i + this.#nodeCount[node]!; i < end; i++) {
                const a = indices[i * 3]! * 3, b = indices[i * 3 + 1]! * 3, c = indices[i * 3 + 2]! * 3;
                const e1x = p[b]! - p[a]!, e1y = p[b + 1]! - p[a + 1]!, e1z = p[b + 2]! - p[a + 2]!, e2x = p[c]! - p[a]!, e2y = p[c + 1]! - p[a + 1]!, e2z = p[c + 2]! - p[a + 2]!;
                const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, determinant = e1x * px + e1y * py + e1z * pz;
                // A positive determinant means the ray meets the front side.
                if (determinant < 1e-12) continue;
                const tx = ox - p[a]!, ty = oy - p[a + 1]!, tz = oz - p[a + 2]!, u = tx * px + ty * py + tz * pz;
                if (u < 0 || u > determinant) continue;
                const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = dx * qx + dy * qy + dz * qz;
                if (v < 0 || u + v > determinant) continue;
                const t = (e2x * qx + e2y * qy + e2z * qz) / determinant;
                if (t >= 0 && t < best) { best = t; hit = i; }
            }
        }
        if (hit < 0) return -1;
        this.triangleNormal(hit, normal);
        return best;
    }
}

/**
 * Build a collision mesh from a geometry, or from every triangle mesh under
 * an object with their world transforms baked in. Use the result as
 * `{type: 'mesh', mesh}` on a static body left at the origin.
 */
export function createMeshShape3D(source: Geometry3D | Object3D): TriangleMeshShape3D {
    const positions: number[] = [], indices: number[] = [];
    const append = (geometry: Geometry3D, m: ArrayLike<number> | undefined): void => {
        if (geometry.topology !== 'triangles') return;
        const attribute = geometry.getAttribute('position');
        if (!attribute) return;
        const data = attribute.data, base = positions.length / 3;
        for (let i = 0; i < data.length; i += 3) {
            const x = data[i]!, y = data[i + 1]!, z = data[i + 2]!;
            if (m) positions.push(m[0]! * x + m[4]! * y + m[8]! * z + m[12]!, m[1]! * x + m[5]! * y + m[9]! * z + m[13]!, m[2]! * x + m[6]! * y + m[10]! * z + m[14]!);
            else positions.push(x, y, z);
        }
        const index = geometry.index?.data, count = index ? index.length : attribute.count;
        // A mirrored transform reverses winding; swap two corners to keep the front side outward.
        const mirrored = m !== undefined && m[0]! * (m[5]! * m[10]! - m[6]! * m[9]!) - m[4]! * (m[1]! * m[10]! - m[2]! * m[9]!) + m[8]! * (m[1]! * m[6]! - m[2]! * m[5]!) < 0;
        for (let i = 0; i + 2 < count; i += 3) {
            const a = base + (index ? index[i]! : i), b = base + (index ? index[i + 1]! : i + 1), c = base + (index ? index[i + 2]! : i + 2);
            if (mirrored) indices.push(a, c, b); else indices.push(a, b, c);
        }
    };
    if (source instanceof Geometry3D) append(source, undefined);
    else if (source instanceof Object3D) {
        source.updateWorldMatrices();
        source.traverse(node => { if (node instanceof Mesh3D && !node.isInstanced && node.skeleton === undefined) append(node.geometry, node.matrixWorld); });
    } else throw new World3DError('WORLD3D_INPUT_INVALID', 'mesh shape source');
    return new TriangleMeshShape3D(positions, indices);
}
