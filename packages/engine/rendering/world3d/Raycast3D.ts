// SPDX-License-Identifier: Apache-2.0
// CPU ray picking against mesh triangles. Skinned and morphed meshes are
// tested in their rest shape; sprites are tested as their camera-facing quad
// bounds. Results are sorted nearest first.
import {World3DError, requireFinite3D} from './core3D.js';
import type {Camera3D} from './Camera3D.js';
import {mat4Invert, mat4Multiply, rayIntersectBox, rayIntersectSphere, rayIntersectTriangle, vec3Normalize, vec3TransformDirection, vec3TransformMat4} from './math3D.js';
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
            if (object instanceof Mesh3D && (object.layers & mask) !== 0) this.intersectMesh(object, near, far, options.firstHitOnly === true, hits);
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
        for (let face = 0; face < count; face++) {
            const a = index ? index[face * 3]! : face * 3, b = index ? index[face * 3 + 1]! : face * 3 + 1, c = index ? index[face * 3 + 2]! : face * 3 + 2;
            if (!rayIntersectTriangle(hit, localOrigin, localDirection, positions, a * 3, b * 3, c * 3, cull)) continue;
            // Convert the local hit distance back to world units.
            const distance = hit[0]! / scale;
            if (distance < near || distance > far) continue;
            if (firstOnly && best && best.distance <= distance) continue;
            worldPoint[0] = this.origin[0]! + this.direction[0]! * distance;
            worldPoint[1] = this.origin[1]! + this.direction[1]! * distance;
            worldPoint[2] = this.origin[2]! + this.direction[2]! * distance;
            const u = hit[1]!, v = hit[2]!, w = 1 - u - v;
            const record: RaycastHit3D = {
                distance, point: [worldPoint[0]!, worldPoint[1]!, worldPoint[2]!], object: mesh, faceIndex: face, instanceId,
                uv: uvs ? [uvs[a * 2]! * w + uvs[b * 2]! * u + uvs[c * 2]! * v, uvs[a * 2 + 1]! * w + uvs[b * 2 + 1]! * u + uvs[c * 2 + 1]! * v] : undefined,
            };
            if (firstOnly) best = record; else hits.push(record);
        }
        if (firstOnly && best) hits.push(best);
    }
}
function mat4DeterminantSign(m: ArrayLike<number>): number {
    // Sign of the upper 3x3 determinant: negative means a mirrored transform.
    return m[0]! * (m[5]! * m[10]! - m[6]! * m[9]!) - m[4]! * (m[1]! * m[10]! - m[2]! * m[9]!) + m[8]! * (m[1]! * m[6]! - m[2]! * m[5]!);
}
