import { Geometry3D } from './Geometry3D.js';
export declare const PHYSICS_HULL3D_LIMITS: Readonly<{
    readonly maxPoints: 64;
    readonly maxInputPoints: 1048576;
}>;
export declare class ConvexHullShape3D {
    /** Corner points, three floats each, around the body origin. */
    readonly points: Float32Array;
    /** Face planes as [nx, ny, nz, d] with unit outward normals; inside is n . p + d < 0. */
    readonly planes: Float32Array;
    /** Distance from the origin to the farthest corner. */
    readonly radius: number;
    /** Half extents of the axis-aligned box around the points. */
    readonly halfExtents: readonly [number, number, number];
    /** Edges as pairs of corner indices. */
    readonly edges: Uint8Array;
    /** Radius of the largest sphere around the origin that fits inside. */
    readonly innerRadius: number;
    /**
     * @param points Flat [x, y, z, ...] corner candidates. Interior points are
     * dropped; more than 64 corners are reduced to the 64 most extreme ones.
     * The points should surround the origin, which acts as the center of mass.
     */
    constructor(points: ArrayLike<number>);
    /**
     * Largest signed plane distance of a local point: negative inside, and the
     * penetration depth when negated. Writes that plane's normal.
     */
    signedDistance(x: number, y: number, z: number, normal: number[]): number;
    /** Distance along a local unit ray to the solid, or -1. Writes the entry face normal. */
    raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, limit: number, normal: number[]): number;
}
/** Build a convex hull shape from a geometry's vertices, or from a flat list of points. */
export declare function createConvexHullShape3D(source: Geometry3D | ArrayLike<number>): ConvexHullShape3D;
//# sourceMappingURL=PhysicsHull3D.d.ts.map