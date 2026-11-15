import type { Disposable } from '@egret/contracts';
import type { Camera3D } from '../../rendering/world3d/Camera3D.js';
export interface OrbitControlsOptions3D {
    readonly target?: readonly [number, number, number];
    readonly minDistance?: number;
    readonly maxDistance?: number;
    /** Polar angle limits in radians, measured from the +Y axis. */
    readonly minPolarAngle?: number;
    readonly maxPolarAngle?: number;
    readonly rotateSpeed?: number;
    readonly panSpeed?: number;
    readonly zoomSpeed?: number;
    /** Fraction of motion kept per 1/60 s; 0 disables inertia. */
    readonly damping?: number;
    readonly enablePan?: boolean;
    readonly enableZoom?: boolean;
    readonly enableRotate?: boolean;
    /** Radians per second of automatic rotation about the Y axis. */
    readonly autoRotateSpeed?: number;
}
export declare class OrbitControls3D implements Disposable {
    #private;
    readonly camera: Camera3D;
    readonly element: HTMLElement;
    readonly target: Float32Array<ArrayBuffer>;
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    rotateSpeed: number;
    panSpeed: number;
    zoomSpeed: number;
    damping: number;
    enablePan: boolean;
    enableZoom: boolean;
    enableRotate: boolean;
    autoRotateSpeed: number;
    enabled: boolean;
    constructor(camera: Camera3D, element: HTMLElement, options?: OrbitControlsOptions3D);
    /** Recompute the orbit parameters after moving the camera or target directly. */
    syncFromCamera(): void;
    private readonly onContextMenu;
    private readonly onPointerDown;
    private readonly onPointerUp;
    private pinchDistance;
    private readonly onPointerMove;
    private addPan;
    private readonly onWheel;
    /** Apply pending input and place the camera. Returns true while the view is still moving. */
    update(deltaSeconds?: number): boolean;
    /** Detach every listener. Idempotent. */
    dispose(): void;
}
export declare function createOrbitControls3D(camera: Camera3D, element: HTMLElement, options?: OrbitControlsOptions3D): OrbitControls3D;
//# sourceMappingURL=OrbitControls3D.d.ts.map