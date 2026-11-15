import { Object3D } from './Object3D.js';
export interface PerspectiveCameraOptions3D {
    /** Vertical field of view in degrees. */
    readonly fov?: number;
    readonly aspect?: number;
    readonly near?: number;
    readonly far?: number;
}
export interface OrthographicCameraOptions3D {
    /** Visible world height; width follows from the aspect ratio. */
    readonly height?: number;
    readonly aspect?: number;
    readonly near?: number;
    readonly far?: number;
}
export declare class Camera3D extends Object3D {
    #private;
    readonly projectionKind: 'perspective' | 'orthographic';
    fov: number;
    orthographicHeight: number;
    aspect: number;
    near: number;
    far: number;
    /** Extra magnification applied to either projection. */
    zoom: number;
    /** Objects render when (object.layers & camera.layerMask) is non-zero. */
    layerMask: number;
    /**
     * A complete projection matrix (OpenGL clip conventions, column-major) used
     * instead of the one derived from fov, aspect, near and far: for off-center
     * frusta, oblique near planes and portals. Assign undefined to return to the
     * derived projection.
     */
    customProjection: ArrayLike<number> | undefined;
    readonly projectionMatrix: Float32Array<ArrayBuffer>;
    readonly viewMatrix: Float32Array<ArrayBuffer>;
    readonly viewProjectionMatrix: Float32Array<ArrayBuffer>;
    /** Six inward world-space planes, refreshed by updateViewMatrices(). */
    readonly frustum: Float32Array<ArrayBuffer>;
    constructor(kind?: 'perspective' | 'orthographic');
    /** Recompute the projection when a parameter changed since the last call. */
    updateProjectionMatrix(): void;
    /** Refresh view, view-projection and frustum from the current world matrix. */
    updateViewMatrices(): void;
    /**
     * World-space ray through normalized device coordinates (x, y in [-1, 1],
     * y up). Writes the origin and unit direction; call updateViewMatrices() first.
     */
    screenPointToRay(ndcX: number, ndcY: number, origin: Float32Array | number[], direction: Float32Array | number[]): void;
    /** Project a world point to normalized device coordinates; z in [-1, 1] is depth. */
    worldToScreenPoint(out: Float32Array | number[], point: ArrayLike<number>): Float32Array | number[];
    clone(recursive?: boolean): this;
    protected copyFrom(source: this): void;
}
export declare function createPerspectiveCamera3D(options?: PerspectiveCameraOptions3D): Camera3D;
export declare function createOrthographicCamera3D(options?: OrthographicCameraOptions3D): Camera3D;
//# sourceMappingURL=Camera3D.d.ts.map