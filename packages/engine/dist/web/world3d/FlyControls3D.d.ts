import type { Disposable } from '@egret/contracts';
import type { Camera3D } from '../../rendering/world3d/Camera3D.js';
export interface FlyControlsOptions3D {
    /** Units per second. */
    readonly moveSpeed?: number;
    /** Multiplier while the sprint key is held. */
    readonly sprintMultiplier?: number;
    /** Radians per pixel of pointer movement. */
    readonly lookSpeed?: number;
    /** Move along the view direction and allow vertical keys; otherwise stay level. */
    readonly fly?: boolean;
    /** Request pointer lock on click. Without it, drag to look. */
    readonly pointerLock?: boolean;
    /** Fraction of velocity kept per 1/60 s; 0 stops at once. */
    readonly damping?: number;
    /** Key codes (KeyboardEvent.code) for each action. */
    readonly keys?: Partial<FlyControlsKeys3D>;
}
export interface FlyControlsKeys3D {
    readonly forward: readonly string[];
    readonly back: readonly string[];
    readonly left: readonly string[];
    readonly right: readonly string[];
    readonly up: readonly string[];
    readonly down: readonly string[];
    readonly sprint: readonly string[];
}
export declare class FlyControls3D implements Disposable {
    #private;
    readonly camera: Camera3D;
    readonly element: HTMLElement;
    moveSpeed: number;
    sprintMultiplier: number;
    lookSpeed: number;
    fly: boolean;
    pointerLock: boolean;
    damping: number;
    enabled: boolean;
    /** Heading about +Y and elevation, in radians. Write them to aim the camera. */
    yaw: number;
    pitch: number;
    /** Current velocity in world units per second. */
    readonly velocity: Float32Array<ArrayBuffer>;
    constructor(camera: Camera3D, element: HTMLElement, options?: FlyControlsOptions3D);
    private isLooking;
    /** True while the pointer is captured for looking around. */
    get isLocked(): boolean;
    /** Release pointer lock, as when opening a menu. */
    unlock(): void;
    private pressed;
    update(deltaSeconds: number): void;
    dispose(): void;
}
export declare function createFlyControls3D(camera: Camera3D, element: HTMLElement, options?: FlyControlsOptions3D): FlyControls3D;
//# sourceMappingURL=FlyControls3D.d.ts.map