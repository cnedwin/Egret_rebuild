// SPDX-License-Identifier: Apache-2.0
// CPU ray picking against mesh triangles. Skinned and morphed meshes are
// tested in their rest shape; sprites are tested as their camera-facing quad
// bounds. Results are sorted nearest first.
import {World3DError, requireFinite3D} from './core3D.js';
import type {Camera3D} from './Camera3D.js';
import {mat4Invert, mat4Multiply, rayIntersectBox, rayIntersectSphere, rayIntersectTriangle, vec3Normalize, vec3TransformDirection, vec3TransformMat4} from './math3D.js';
import type {Geometry3D} from './Geometry3D.js';
import {InstancedMesh3D, Mesh3D} from './Mesh3D.js';
import type {Object3D} from './Object3D.js';

export interface RaycastHit3D {
    /** Distance from the ray origin in world units. */
    readonly distance: number;
    /** World-space hit position. */
    readonly point: readonly [number, number, number];
    readonly object: Mesh3D;
    /** Index of the hit triangle within the geometry. */
    readonly faceIndex: number;
    /** Interpolated texture coordinates when the geometry has a `uv` attribute. */
    readonly uv: readonly [number, number] | undefined;
    /** Instance index for instanced meshes. */
    readonly instanceId: number | undefined;
}
export interface RaycastOptions3D {
    readonly near?: number;
    readonly far?: number;
    /** Only objects whose layers intersect this mask are tested. */
    readonly layerMask?: number;
    /** Stop at the first hit per mesh and skip sorting of further triangles. */
    readonly firstHitOnly?: boolean;
}

const inverse = new Float32Array(16), instanceWorld = new Float32Array(16);
const localOrigin = new Float32Array(3), localDirection = new Float32Array(3);
const hit = new Float32Array(3), worldPoint = new Float32Array(3);

export class Raycaster3D {
    readonly origin = new Float32Array(3);
    readonly direction = new Float32Array([0, 0, -1]);

    /** Set a world-space ray; the direction is normalized. */
    set(origin: ArrayLike<number>, direction: ArrayLike<number>): this {
        for (let i = 0; i < 3; i++) { this.origin[i] = requireFinite3D(origin[i], 'ray origin'); this.direction[i] = requireFinite3D(direction[i], 'ray direction'); }
        vec3Normalize(this.direction, this.direction);
        if (this.direction[0] === 0 && this.direction[1] === 0 && this.direction[2] === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'ray direction');
        return this;
    }
    /** Ray through normalized device coordinates (x, y in [-1, 1], y up). */
    setFromCamera(ndcX: number, ndcY: number, camera: Camera3D): this {
        camera.updateViewMatrices();
        camera.screenPointToRay(requireFinite3D(ndcX, 'ndcX'), requireFinite3D(ndcY, 'ndcY'), this.origin, this.direction);
        return this;
    }
    /** Intersect the subtree under `root`. World matrices are refreshed first. */
    intersect(root: Object3D, options: RaycastOptions3D = {}): RaycastHit3D[] {
        const near = options.near ?? 0, far = options.far ?? Infinity, mask = options.layerMask ?? 0xffffffff;
        const hits: RaycastHit3D[] = [];
        root.updateWorldMatrix();
        root.updateWorldMatrices();
        root.traverse(object => {
            if (!object.visible) return false;
            if (object instanceof Mesh3D && object.pickable && (object.layers & mask) !== 0) this.intersectMesh(object, near, far, options.firstHitOnly === true, hits);
            return true;
        });
        return hits.sort((a, b) => a.distance - b.distance);
    }
    private intersectMesh(mesh: Mesh3D, near: number, far: number, firstOnly: boolean, hits: RaycastHit3D[]): void {
        const geometry = mesh.geometry;
        if (geometry.topology !== 'triangles' || !geometry.getAttribute('position')) return;
        if (rayIntersectSphere(this.origin, this.direction, mesh.worldBoundingSphere) < 0) return;
        if (mesh instanceof InstancedMesh3D) {
            for (let i = 0; i < mesh.count; i++) {
                mat4Multiply(instanceWorld, mesh.matrixWorld, mesh.instanceMatrices.subarray(i * 16, i * 16 + 16));
                this.intersectTriangles(mesh, instanceWorld, i, near, far, firstOnly, hits);
            }
        } else this.intersectTriangles(mesh, mesh.matrixWorld, undefined, near, far, firstOnly, hits);
    }
    private intersectTriangles(mesh: Mesh3D, world: Float32Array, instanceId: number | undefined, near: number, far: number, firstOnly: boolean, hits: RaycastHit3D[]): void {
        if (!mat4Invert(inverse, world)) return;
        // Work in local space so vertices need no transformation.
        vec3TransformMat4(localOrigin, this.origin, inverse);
        vec3TransformDirection(localDirection, this.direction, inverse);
        const scale = Math.hypot(localDirection[0]!, localDirection[1]!, localDirection[2]!);
        if (scale === 0) return;
        vec3Normalize(localDirection, localDirection);
        const geometry = mesh.geometry;
        if (rayIntersectBox(localOrigin, localDirection, geometry.boundingBox) < 0) return;
        const positions = geometry.getAttribute('position')!.data, index = geometry.index?.data, uvs = geometry.getAttribute('uv')?.data;
        const count = (index ? index.length : positions.length / 3) / 3;
        const material = mesh.materialAt(0), cull = material.side === 'front' && mat4DeterminantSign(world) > 0;
        let best: RaycastHit3D | undefined;
        const test = (face: number): void => {
            const a = index ? index[face * 3]! : face * 3, b = index ? index[face * 3 + 1]! : face * 3 + 1, c = index ? index[face * 3 + 2]! : face * 3 + 2;
            if (!rayIntersectTriangle(hit, localOrigin, localDirection, positions, a * 3, b * 3, c * 3, cull)) return;
            // Convert the local hit distance back to world units.
            const distance = hit[0]! / scale;
            if (distance < near || distance > far) return;
            if (firstOnly && best && best.distance <= distance) return;
            worldPoint[0] = this.origin[0]! + this.direction[0]! * distance;
            worldPoint[1] = this.origin[1]! + this.direction[1]! * distance;
            worldPoint[2] = this.origin[2]! + this.direction[2]! * distance;
            const u = hit[1]!, v = hit[2]!, w = 1 - u - v;
            const record: RaycastHit3D = {
                distance, point: [worldPoint[0]!, worldPoint[1]!, worldPoint[2]!], object: mesh, faceIndex: face, instanceId,
                uv: uvs ? [uvs[a * 2]! * w + uvs[b * 2]! * u + uvs[c * 2]! * v, uvs[a * 2 + 1]! * w + uvs[b * 2 + 1]! * u + uvs[c * 2 + 1]! * v] : undefined,
            };
            if (firstOnly) best = record; else hits.push(record);
        };
        // Dense geometry is searched through a hierarchy of boxes, built once and kept until the geometry changes.
        const tree = count >= PICK_TREE_MINIMUM ? pickTree(geometry, count) : undefined;
        if (tree) {
            const first = hits.length, bounds = tree.bounds, stack = pickStack, ox = localOrigin[0]!, oy = localOrigin[1]!, oz = localOrigin[2]!;
            // A ray along an axis gets a huge, finite reciprocal there instead of an infinite one.
            const safe = (d: number): number => 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d);
            const ix = safe(localDirection[0]!), iy = safe(localDirection[1]!), iz = safe(localDirection[2]!);
            let top = 0;
            stack[top++] = 0;
            while (top > 0) {
                const node = stack[--top]!, at = node * 6;
                // Slab test; a box the ray misses, or that lies wholly behind it, is skipped with everything in it.
                let t0 = (bounds[at]! - ox) * ix, t1 = (bounds[at + 3]! - ox) * ix, low = Math.min(t0, t1), high = Math.max(t0, t1);
                t0 = (bounds[at + 1]! - oy) * iy; t1 = (bounds[at + 4]! - oy) * iy; low = Math.max(low, Math.min(t0, t1)); high = Math.min(high, Math.max(t0, t1));
                t0 = (bounds[at + 2]! - oz) * iz; t1 = (bounds[at + 5]! - oz) * iz; low = Math.max(low, Math.min(t0, t1)); high = Math.min(high, Math.max(t0, t1));
                if (!(high >= Math.max(low, 0))) continue;
                const child = tree.left[node]!;
                if (child >= 0) { if (top < pickStack.length - 1) { stack[top++] = child; stack[top++] = child + 1; } continue; }
                for (let i = tree.start[node]!, end = i + tree.count[node]!; i < end; i++) test(tree.faces[i]!);
            }
            // Faces come out in tree order; callers were promised face order among equal distances.
            if (!firstOnly && hits.length - first > 1) { const found = hits.splice(first).sort((p, q) => p.faceIndex - q.faceIndex); for (const record of found) hits.push(record); }
        } else for (let face = 0; face < count; face++) test(face);
        if (firstOnly && best) hits.push(best);
    }
}
function mat4DeterminantSign(m: ArrayLike<number>): number {
    // Sign of the upper 3x3 determinant: negative means a mirrored transform.
    return m[0]! * (m[5]! * m[10]! - m[6]! * m[9]!) - m[4]! * (m[1]! * m[10]! - m[2]! * m[9]!) + m[8]! * (m[1]! * m[6]! - m[2]! * m[5]!);
}

const PICK_TREE_MINIMUM = 512, pickStack = new Int32Array(96);
interface PickTree { key: number; positions: unknown; index: unknown; bounds: Float32Array; left: Int32Array; start: Int32Array; count: Int32Array; faces: Uint32Array }
const pickTrees = new WeakMap<Geometry3D, PickTree>();
/** A hierarchy of boxes over a geometry's triangles, rebuilt when its positions or indices change. */
function pickTree(geometry: Geometry3D, faceCount: number): PickTree {
    const position = geometry.getAttribute('position')!, indexAttribute = geometry.index, key = position.version * 1048576 + (indexAttribute?.version ?? 0);
    const known = pickTrees.get(geometry);
    if (known && known.key === key && known.positions === position.data && known.index === indexAttribute?.data) return known;
    const p = position.data, index = indexAttribute?.data, boxes = new Float32Array(faceCount * 6), centers = new Float32Array(faceCount * 3), faces = new Uint32Array(faceCount);
    for (let face = 0; face < faceCount; face++) {
        faces[face] = face;
        const a = (index ? index[face * 3]! : face * 3) * 3, b = (index ? index[face * 3 + 1]! : face * 3 + 1) * 3, c = (index ? index[face * 3 + 2]! : face * 3 + 2) * 3;
        for (let axis = 0; axis < 3; axis++) {
            const x = p[a + axis]!, y = p[b + axis]!, z = p[c + axis]!;
            boxes[face * 6 + axis] = Math.min(x, y, z); boxes[face * 6 + 3 + axis] = Math.max(x, y, z); centers[face * 3 + axis] = (x + y + z) / 3;
        }
    }
    const most = Math.max(2 * faceCount, 2), bounds = new Float32Array(most * 6), left = new Int32Array(most).fill(-1), start = new Int32Array(most), count = new Int32Array(most), pending = [0];
    let used = 1;
    count[0] = faceCount;
    while (pending.length > 0) {
        const node = pending.pop()!, from = start[node]!, size = count[node]!;
        let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, cx0 = Infinity, cy0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cy1 = -Infinity, cz1 = -Infinity;
        for (let i = from; i < from + size; i++) {
            const f = faces[i]!;
            x0 = Math.min(x0, boxes[f * 6]!); y0 = Math.min(y0, boxes[f * 6 + 1]!); z0 = Math.min(z0, boxes[f * 6 + 2]!); x1 = Math.max(x1, boxes[f * 6 + 3]!); y1 = Math.max(y1, boxes[f * 6 + 4]!); z1 = Math.max(z1, boxes[f * 6 + 5]!);
            cx0 = Math.min(cx0, centers[f * 3]!); cy0 = Math.min(cy0, centers[f * 3 + 1]!); cz0 = Math.min(cz0, centers[f * 3 + 2]!); cx1 = Math.max(cx1, centers[f * 3]!); cy1 = Math.max(cy1, centers[f * 3 + 1]!); cz1 = Math.max(cz1, centers[f * 3 + 2]!);
        }
        // A hair of padding keeps triangles lying exactly in a box face from being missed.
        const pad = 1e-6 * Math.max(x1 - x0, y1 - y0, z1 - z0, 1e-6);
        bounds.set([x0 - pad, y0 - pad, z0 - pad, x1 + pad, y1 + pad, z1 + pad], node * 6);
        if (size <= 8) continue;
        const ex = cx1 - cx0, ey = cy1 - cy0, ez = cz1 - cz0, axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2, middle = axis === 0 ? (cx0 + cx1) / 2 : axis === 1 ? (cy0 + cy1) / 2 : (cz0 + cz1) / 2;
        let i = from, j = from + size - 1;
        while (i <= j) {
            if (centers[faces[i]! * 3 + axis]! < middle) i++;
            else { const swap = faces[i]!; faces[i] = faces[j]!; faces[j] = swap; j--; }
        }
        let leftSize = i - from;
        if (leftSize === 0 || leftSize === size) leftSize = size >> 1;
        const child = used; used += 2;
        left[node] = child;
        start[child] = from; count[child] = leftSize; start[child + 1] = from + leftSize; count[child + 1] = size - leftSize;
        pending.push(child, child + 1);
    }
    const tree: PickTree = {key, positions: p, index, bounds: bounds.slice(0, used * 6), left: left.slice(0, used), start: start.slice(0, used), count: count.slice(0, used), faces};
    pickTrees.set(geometry, tree);
    return tree;
}
