import { Curve3D, Shape3D } from './Curves3D.js';
import { Geometry3D } from './Geometry3D.js';
export interface CircleGeometryOptions3D {
    readonly radius?: number;
    readonly segments?: number;
    readonly thetaStart?: number;
    readonly thetaLength?: number;
}
/** Flat disc or sector in the XY plane, facing +Z. */
export declare function createCircleGeometry3D(options?: CircleGeometryOptions3D): Geometry3D;
export interface RingGeometryOptions3D {
    readonly innerRadius?: number;
    readonly outerRadius?: number;
    readonly thetaSegments?: number;
    readonly phiSegments?: number;
    readonly thetaStart?: number;
    readonly thetaLength?: number;
}
/** Flat ring in the XY plane, facing +Z. An inner radius of 0 gives a disc. */
export declare function createRingGeometry3D(options?: RingGeometryOptions3D): Geometry3D;
export interface TorusKnotGeometryOptions3D {
    readonly radius?: number;
    readonly tube?: number;
    readonly tubularSegments?: number;
    readonly radialSegments?: number;
    /** Windings around the axis of symmetry and around the inside of the torus; coprime values give a knot. */
    readonly p?: number;
    readonly q?: number;
}
export declare function createTorusKnotGeometry3D(options?: TorusKnotGeometryOptions3D): Geometry3D;
/**
 * Project a convex solid's triangles onto a sphere, subdividing each `detail`
 * times. Vertices are not shared, so the result is faceted unless
 * `smooth` is set, which uses the sphere normal.
 */
export declare function createPolyhedronGeometry3D(vertices: ArrayLike<number>, indices: ArrayLike<number>, options?: {
    readonly radius?: number;
    readonly detail?: number;
    readonly smooth?: boolean;
}): Geometry3D;
export interface PolyhedronOptions3D {
    readonly radius?: number;
    readonly detail?: number;
    readonly smooth?: boolean;
}
export declare function createTetrahedronGeometry3D(options?: PolyhedronOptions3D): Geometry3D;
export declare function createOctahedronGeometry3D(options?: PolyhedronOptions3D): Geometry3D;
export declare function createIcosahedronGeometry3D(options?: PolyhedronOptions3D): Geometry3D;
export declare function createDodecahedronGeometry3D(options?: PolyhedronOptions3D): Geometry3D;
export interface LatheGeometryOptions3D {
    readonly segments?: number;
    readonly phiStart?: number;
    readonly phiLength?: number;
}
/** Revolve a profile of [x, y] points (x is the distance from the Y axis) around Y. */
export declare function createLatheGeometry3D(profile: readonly (readonly [number, number])[], options?: LatheGeometryOptions3D): Geometry3D;
export interface TubeGeometryOptions3D {
    readonly tubularSegments?: number;
    readonly radius?: number;
    readonly radialSegments?: number;
    readonly closed?: boolean;
}
/** Sweep a circle along a curve, using twist-free frames. */
export declare function createTubeGeometry3D(curve: Curve3D, options?: TubeGeometryOptions3D): Geometry3D;
/** Fill one or more outlines in the XY plane, facing +Z. UVs equal the XY coordinates. */
export declare function createShapeGeometry3D(shapes: Shape3D | readonly Shape3D[]): Geometry3D;
export interface ExtrudeGeometryOptions3D {
    /** Thickness along +Z. Ignored when `path` is given. */
    readonly depth?: number;
    /** Subdivisions along the extrusion. */
    readonly steps?: number;
    /** Sweep the outline along this curve instead of straight along Z. */
    readonly path?: Curve3D;
}
/**
 * Give an outline thickness. The result has two material groups: 0 for the
 * front and back caps, 1 for the side walls. Edges are sharp; bevels are not
 * generated.
 */
export declare function createExtrudeGeometry3D(shapes: Shape3D | readonly Shape3D[], options?: ExtrudeGeometryOptions3D): Geometry3D;
/** Line segments for every triangle edge, each drawn once. */
export declare function createWireframeGeometry3D(geometry: Geometry3D): Geometry3D;
/**
 * Line segments for outline and crease edges only: edges with one face, or
 * whose two faces meet at more than `thresholdAngle` radians.
 */
export declare function createEdgesGeometry3D(geometry: Geometry3D, thresholdAngle?: number): Geometry3D;
/** Copy with every triangle owning its vertices, as needed for per-face data. */
export declare function toNonIndexedGeometry3D(geometry: Geometry3D): Geometry3D;
/**
 * Join geometries that share the same attribute set into one. With
 * `useGroups`, each input becomes a material group in order.
 */
export declare function mergeGeometries3D(geometries: readonly Geometry3D[], useGroups?: boolean): Geometry3D;
/** Weld vertices whose every attribute matches within `tolerance`, producing an indexed geometry. */
export declare function mergeVertices3D(geometry: Geometry3D, tolerance?: number): Geometry3D;
/** Bake a 4x4 transform into positions, normals and tangents, in place. */
export declare function transformGeometry3D(geometry: Geometry3D, matrix: ArrayLike<number>): Geometry3D;
//# sourceMappingURL=geometries3D.d.ts.map