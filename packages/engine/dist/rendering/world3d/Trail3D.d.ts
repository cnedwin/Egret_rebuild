import { type Blending3D, type ColorInput3D } from './Material3D.js';
import { Mesh3D } from './Mesh3D.js';
import type { Object3D } from './Object3D.js';
import type { Texture3D } from './Texture3D.js';
export declare const TRAIL3D_LIMITS: Readonly<{
    readonly maxPoints: 4096;
}>;
export interface TrailOptions3D {
    /** The object whose world position the trail follows. Without one, feed points with `push`. */
    readonly target?: Object3D;
    /** Seconds a point of the trail stays visible. Default 0.6. */
    readonly lifetime?: number;
    /** Most points kept; older ones drop off the end. Default 64. */
    readonly points?: number;
    /** A new point is recorded once the head has moved this far. Default 0.05. */
    readonly minDistance?: number;
    /** Width at the head and at the tail. Defaults: 0.3 and 0. */
    readonly width?: number;
    readonly endWidth?: number;
    readonly color?: ColorInput3D;
    readonly endColor?: ColorInput3D;
    /** Opacity at the head and at the tail. Defaults: 1 and 0. */
    readonly opacity?: number;
    readonly endOpacity?: number;
    /** Sampled with u running from head to tail and v across the ribbon. */
    readonly map?: Texture3D;
    readonly blending?: Blending3D;
}
/**
 * Add the trail to the scene itself, not under the object it follows: its
 * vertices are world positions. Call `update(deltaSeconds)` once per frame.
 */
export declare class Trail3D extends Mesh3D {
    #private;
    target: Object3D | undefined;
    lifetime: number;
    minDistance: number;
    width: number;
    endWidth: number;
    opacity: number;
    endOpacity: number;
    readonly color: Float32Array<ArrayBuffer>;
    readonly endColor: Float32Array<ArrayBuffer>;
    readonly capacity: number;
    constructor(options?: TrailOptions3D);
    /** Points currently in the trail, the moving head included. */
    get pointCount(): number;
    /** Age every point, drop the expired ones, and follow the target. */
    update(deltaSeconds: number): void;
    /** Move the head of the trail to a world position; a point is recorded once it has moved far enough. */
    push(x: number, y: number, z: number): void;
    /** Remove every point, as after teleporting the target. */
    clear(): void;
    /** Release the geometry and the material. */
    dispose(): void;
    private build;
}
export declare function createTrail3D(options?: TrailOptions3D): Trail3D;
//# sourceMappingURL=Trail3D.d.ts.map