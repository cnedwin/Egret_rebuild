import type { Camera3D } from './Camera3D.js';
import { Object3D } from './Object3D.js';
export type GizmoMode3D = 'translate' | 'rotate' | 'scale';
export type GizmoSpace3D = 'world' | 'local';
/** A single axis, a plane spanned by two axes, or 'xyz' for the center handle of the scale mode. */
export type GizmoHandle3D = 'x' | 'y' | 'z' | 'xy' | 'yz' | 'xz' | 'xyz';
export interface TransformGizmoOptions3D {
    readonly mode?: GizmoMode3D;
    readonly space?: GizmoSpace3D;
    /** Length of the handles as a share of the view height. Defaults to 0.18. */
    readonly size?: number;
}
export declare class TransformGizmo3D extends Object3D {
    #private;
    readonly camera: Camera3D;
    mode: GizmoMode3D;
    space: GizmoSpace3D;
    size: number;
    /** Step sizes for dragging: world units, radians and scale factor. Undefined moves freely. */
    translationSnap: number | undefined;
    rotationSnap: number | undefined;
    scaleSnap: number | undefined;
    enabled: boolean;
    /** Called while a drag changes the attached object. */
    onChange: ((object: Object3D) => void) | undefined;
    /** Called when a drag starts (true) or ends (false), for example to pause camera controls. */
    onDraggingChanged: ((dragging: boolean) => void) | undefined;
    constructor(camera: Camera3D, options?: TransformGizmoOptions3D);
    /** The object being edited. */
    get object(): Object3D | undefined;
    get dragging(): boolean;
    /** The handle under the last hover ray, or the one being dragged. */
    get activeHandle(): GizmoHandle3D | undefined;
    attach(object: Object3D): this;
    detach(): this;
    private handleMaterial;
    private part;
    private build;
    /** World scale that keeps the handles the same size on screen. */
    private screenScale;
    /** World pose of the attached object. */
    private pose;
    /**
     * Place the handles on the attached object and size them for the camera.
     * Call once per frame before rendering, after moving the camera or object.
     */
    update(): void;
    private highlight;
    /** World directions of the three handle axes. */
    private axes;
    /** Handle met by a world-space ray, or undefined. Also sets the highlight. */
    hover(origin: ArrayLike<number>, direction: ArrayLike<number>): GizmoHandle3D | undefined;
    private pick;
    private raySphere;
    /** Distance along the line (point, axis) at which it comes closest to a ray. */
    private alongAxis;
    /** Point where a ray meets the plane through `point` with normal `normal`, or undefined when it runs alongside. */
    private onPlane;
    /** Direction from the object toward the camera, used as a drag plane that always faces the viewer. */
    private towardCamera;
    /** Start dragging the handle under the ray. Returns false when the ray misses every handle. */
    beginDrag(origin: ArrayLike<number>, direction: ArrayLike<number>): boolean;
    /** Continue a drag with the current ray, updating the attached object. */
    drag(origin: ArrayLike<number>, direction: ArrayLike<number>): void;
    /** Finish the current drag, keeping the object where it is. */
    endDrag(): void;
    /** Abandon the current drag and put the object back where it started. */
    cancelDrag(): void;
    private setWorldPosition;
    private setWorldQuaternion;
    /** Release the handle geometry and materials. */
    dispose(): void;
}
export declare function createTransformGizmo3D(camera: Camera3D, options?: TransformGizmoOptions3D): TransformGizmo3D;
//# sourceMappingURL=Gizmo3D.d.ts.map