import type { Camera3D } from './Camera3D.js';
import { Geometry3D } from './Geometry3D.js';
import { Material3D } from './Material3D.js';
import type { ColorInput3D } from './Material3D.js';
import { Mesh3D } from './Mesh3D.js';
export declare const BATCH3D_LIMITS: Readonly<{
    readonly maxItems: 65536;
    readonly maxVertices: 4194304;
    readonly maxLinePoints: 65536;
}>;
/**
 * Many geometries drawn as one mesh with one material and one draw call.
 * Each added geometry keeps its own transform, visibility and tint, which
 * can change afterwards; the combined buffers are rebuilt only when something
 * did. Best for props that move rarely, since a change rewrites the batch.
 */
export declare class BatchedMesh3D extends Mesh3D {
    #private;
    constructor(material: Material3D);
    /** Number of geometries added and not deleted. */
    get itemCount(): number;
    /** Add a triangle geometry and return its id within this batch. The geometry itself is copied. */
    addGeometry(geometry: Geometry3D, matrix?: ArrayLike<number>): number;
    private checkedMatrix;
    private item;
    setMatrixAt(id: number, matrix: ArrayLike<number>): this;
    getMatrixAt(id: number, out?: Float32Array): Float32Array;
    setVisibleAt(id: number, visible: boolean): this;
    getVisibleAt(id: number): boolean;
    /** Tint one item through vertex colors; the material needs `vertexColors` enabled. */
    setColorAt(id: number, r: number, g: number, b: number): this;
    /** Remove an item. Its id is not reused. */
    deleteGeometry(id: number): this;
    /** Rebuild the combined buffers now instead of at the next frame. */
    flush(): void;
    beforeRender(): void;
    /** Release the combined geometry. The material stays with its owner. */
    dispose(): void;
}
export interface FatLineOptions3D {
    /** Width in world units, or in pixels when `screenSpace` is set. */
    readonly width?: number;
    /** Keep a constant width on screen; set `resolutionHeight` to the output height in pixels. */
    readonly screenSpace?: boolean;
    readonly color?: ColorInput3D;
    /** Join the last point back to the first. */
    readonly closed?: boolean;
}
/**
 * A polyline drawn as a ribbon of triangles that turns to face the camera,
 * so it can be wider than the one pixel that plain lines allow. Give points
 * in the line's local space; call setPoints() to change them.
 */
export declare class FatLine3D extends Mesh3D {
    #private;
    width: number;
    screenSpace: boolean;
    /** Output height in pixels, used to convert a pixel width to world units. */
    resolutionHeight: number;
    closed: boolean;
    constructor(points: ArrayLike<number> | readonly ArrayLike<number>[], options?: FatLineOptions3D);
    /** Replace the points: a flat [x, y, z, ...] array or a list of [x, y, z]. */
    setPoints(points: ArrayLike<number> | readonly ArrayLike<number>[]): this;
    /** Rebuild the ribbon so it faces `camera`. The render list calls this each frame. */
    beforeRender(camera: Camera3D): void;
    /** Release the line's own geometry and material. */
    dispose(): void;
}
export declare function createBatchedMesh3D(material: Material3D): BatchedMesh3D;
export declare function createFatLine3D(points: ArrayLike<number> | readonly ArrayLike<number>[], options?: FatLineOptions3D): FatLine3D;
//# sourceMappingURL=Batch3D.d.ts.map