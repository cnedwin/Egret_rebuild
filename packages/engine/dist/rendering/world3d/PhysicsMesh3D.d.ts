import { Geometry3D } from './Geometry3D.js';
import { Object3D } from './Object3D.js';
export declare const PHYSICS_MESH3D_LIMITS: Readonly<{
    readonly maxTriangles: 4194304;
    readonly leafTriangles: 4;
}>;
export declare class TriangleMeshShape3D {
    #private;
    /** Vertex positions, three floats each, in the shape's local space. */
    readonly positions: Float32Array;
    /** Vertex indices, three per triangle, reordered for the hierarchy. */
    readonly indices: Uint32Array;
    readonly triangleCount: number;
    /** Local bounds as [minX, minY, minZ, maxX, maxY, maxZ]. */
    readonly bounds: Float32Array<ArrayBuffer>;
    constructor(positions: ArrayLike<number>, indices?: ArrayLike<number>);
    /** Call `visit` with each triangle index whose bounds may touch the box. */
    query(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, visit: (triangle: number) => void): void;
    /** Unit normal of a triangle's front side. */
    triangleNormal(triangle: number, out: number[]): number[];
    /**
     * Closest point on a triangle to (x, y, z). Returns true when it lies in
     * the triangle's interior rather than on an edge or a corner.
     */
    closestPoint(triangle: number, x: number, y: number, z: number, out: number[]): boolean;
    /**
     * Distance along a unit ray to the nearest front-facing triangle within
     * `limit`, or -1. Writes that triangle's normal.
     */
    raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, limit: number, normal: number[]): number;
}
/**
 * Build a collision mesh from a geometry or the unskinned, non-instanced
 * triangle meshes under an object. Bake their base positions in world space.
 * Use the result as
 * `{type: 'mesh', mesh}` on a static body left at the origin.
 */
export declare function createMeshShape3D(source: Geometry3D | Object3D): TriangleMeshShape3D;
//# sourceMappingURL=PhysicsMesh3D.d.ts.map