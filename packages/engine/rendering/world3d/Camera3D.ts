// SPDX-License-Identifier: Apache-2.0
// Perspective and orthographic cameras. A camera is an ordinary scene node
// that looks down its local negative Z axis.
import {World3DError, requireFinite3D, requirePositive3D} from './core3D.js';
import {frustumFromMatrix, mat4Invert, mat4Multiply, mat4Orthographic, mat4Perspective, vec3Normalize, vec3Sub, vec3TransformMat4} from './math3D.js';
import {Object3D} from './Object3D.js';

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

export class Camera3D extends Object3D {
    readonly projectionKind: 'perspective' | 'orthographic';
    fov = 50;
    orthographicHeight = 10;
    aspect = 1;
    near = 0.1;
    far = 1000;
    /** Extra magnification applied to either projection. */
    zoom = 1;
    /** Objects render when (object.layers & camera.layerMask) is non-zero. */
    layerMask = 0xffffffff;
    /**
     * A complete projection matrix (OpenGL clip conventions, column-major) used
     * instead of the one derived from fov, aspect, near and far: for off-center
     * frusta, oblique near planes and portals. Assign undefined to return to the
     * derived projection.
     */
    customProjection: ArrayLike<number> | undefined;
    readonly projectionMatrix = new Float32Array(16);
    readonly viewMatrix = new Float32Array(16);
    readonly viewProjectionMatrix = new Float32Array(16);
    /** Six inward world-space planes, refreshed by updateViewMatrices(). */
    readonly frustum = new Float32Array(24);
    #projectionKey = '';

    constructor(kind: 'perspective' | 'orthographic' = 'perspective') {
        super('camera');
        this.projectionKind = kind;
    }
    /** Recompute the projection when a parameter changed since the last call. */
    updateProjectionMatrix(): void {
        const custom = this.customProjection;
        if (custom) {
            if (custom.length !== 16) throw new World3DError('WORLD3D_INPUT_INVALID', 'camera.customProjection');
            for (let i = 0; i < 16; i++) this.projectionMatrix[i] = requireFinite3D(custom[i], 'camera.customProjection');
            this.#projectionKey = 'custom';
            return;
        }
        const key = this.fov + '|' + this.orthographicHeight + '|' + this.aspect + '|' + this.near + '|' + this.far + '|' + this.zoom;
        if (key === this.#projectionKey) return;
        const aspect = requirePositive3D(this.aspect, 'camera.aspect'), zoom = requirePositive3D(this.zoom, 'camera.zoom');
        const near = requireFinite3D(this.near, 'camera.near'), far = requireFinite3D(this.far, 'camera.far');
        if (far <= near) throw new World3DError('WORLD3D_INPUT_INVALID', 'camera.far');
        if (this.projectionKind === 'perspective') {
            const fov = requirePositive3D(this.fov, 'camera.fov');
            if (fov >= 180 || near <= 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'camera.fov/near');
            const zoomed = 2 * Math.atan(Math.tan(fov * Math.PI / 360) / zoom);
            mat4Perspective(this.projectionMatrix, zoomed, aspect, near, far);
        } else {
            const halfHeight = requirePositive3D(this.orthographicHeight, 'camera.orthographicHeight') / (2 * zoom), halfWidth = halfHeight * aspect;
            mat4Orthographic(this.projectionMatrix, -halfWidth, halfWidth, -halfHeight, halfHeight, near, far);
        }
        this.#projectionKey = key;
    }
    /** Refresh view, view-projection and frustum from the current world matrix. */
    updateViewMatrices(): void {
        this.updateWorldMatrix();
        this.updateProjectionMatrix();
        if (!mat4Invert(this.viewMatrix, this.matrixWorld)) throw new World3DError('WORLD3D_INPUT_INVALID', 'camera transform is singular');
        mat4Multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);
        frustumFromMatrix(this.frustum, this.viewProjectionMatrix);
    }
    /**
     * World-space ray through normalized device coordinates (x, y in [-1, 1],
     * y up). Writes the origin and unit direction; call updateViewMatrices() first.
     */
    screenPointToRay(ndcX: number, ndcY: number, origin: Float32Array | number[], direction: Float32Array | number[]): void {
        const inverse = new Float32Array(16);
        if (!mat4Invert(inverse, this.viewProjectionMatrix)) throw new World3DError('WORLD3D_INPUT_INVALID', 'camera matrices');
        const far = vec3TransformMat4(new Float32Array(3), [ndcX, ndcY, 1], inverse);
        vec3TransformMat4(origin, [ndcX, ndcY, -1], inverse);
        vec3Normalize(direction, vec3Sub(direction, far, origin));
    }
    /** Project a world point to normalized device coordinates; z in [-1, 1] is depth. */
    worldToScreenPoint(out: Float32Array | number[], point: ArrayLike<number>): Float32Array | number[] {
        return vec3TransformMat4(out, point, this.viewProjectionMatrix) as Float32Array | number[];
    }
    override clone(recursive = true): this {
        const copy = new Camera3D(this.projectionKind) as this;
        copy.copyFrom(this);
        if (recursive) for (const child of this.children) copy.addChild(child.clone(true));
        return copy;
    }
    protected override copyFrom(source: this): void {
        super.copyFrom(source);
        this.fov = source.fov; this.orthographicHeight = source.orthographicHeight; this.aspect = source.aspect;
        this.near = source.near; this.far = source.far; this.zoom = source.zoom; this.layerMask = source.layerMask;
        this.customProjection = source.customProjection === undefined ? undefined : Array.from(source.customProjection);
    }
}

export function createPerspectiveCamera3D(options: PerspectiveCameraOptions3D = {}): Camera3D {
    const camera = new Camera3D('perspective');
    camera.fov = options.fov ?? 50; camera.aspect = options.aspect ?? 1; camera.near = options.near ?? 0.1; camera.far = options.far ?? 1000;
    camera.updateProjectionMatrix();
    return camera;
}
export function createOrthographicCamera3D(options: OrthographicCameraOptions3D = {}): Camera3D {
    const camera = new Camera3D('orthographic');
    camera.orthographicHeight = options.height ?? 10; camera.aspect = options.aspect ?? 1; camera.near = options.near ?? 0.1; camera.far = options.far ?? 1000;
    camera.updateProjectionMatrix();
    return camera;
}
