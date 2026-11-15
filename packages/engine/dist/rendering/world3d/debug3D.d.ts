import { Camera3D } from './Camera3D.js';
import { Light3D } from './Light3D.js';
import type { ColorInput3D } from './Material3D.js';
import { Bone3D, Mesh3D } from './Mesh3D.js';
import { Object3D } from './Object3D.js';
/**
 * World-space bounds of an object and its descendants as
 * [minX, minY, minZ, maxX, maxY, maxZ]. Empty (min > max) when nothing has geometry.
 */
export declare function computeObjectBounds3D(object: Object3D, out?: Float32Array): Float32Array;
/** Shared base: a line mesh whose vertices are rewritten by update(). */
export declare abstract class LineHelper3D extends Mesh3D {
    #private;
    protected readonly positions: Float32Array;
    constructor(segments: number, color: ColorInput3D, name: string);
    /** Recompute the lines from the subject's current state. */
    abstract update(): void;
    protected segment(index: number, a: ArrayLike<number>, b: ArrayLike<number>): void;
    protected commit(): void;
    /** Release the helper's own geometry and material. */
    dispose(): void;
}
/** Wire box around an object's world bounds. */
export declare class BoxHelper3D extends LineHelper3D {
    #private;
    readonly target: Object3D;
    constructor(target: Object3D, color?: ColorInput3D);
    update(): void;
}
/** Arrow from `origin` along `direction`; change them and call update(). */
export declare class ArrowHelper3D extends LineHelper3D {
    readonly origin: Float32Array<ArrayBuffer>;
    readonly direction: Float32Array<ArrayBuffer>;
    length: number;
    constructor(direction: ArrayLike<number>, origin?: ArrayLike<number>, length?: number, color?: ColorInput3D);
    update(): void;
}
/** Outline of a camera's view volume. */
export declare class CameraHelper3D extends LineHelper3D {
    readonly camera: Camera3D;
    constructor(camera: Camera3D, color?: ColorInput3D);
    update(): void;
}
/** Shows where a light is and where it points: a ray for directional, a cone for spot, a range sphere for point lights. */
export declare class LightHelper3D extends LineHelper3D {
    readonly light: Light3D;
    /** Drawn size for lights without a range. */
    size: number;
    constructor(light: Light3D, size?: number, color?: ColorInput3D);
    update(): void;
}
/** A line from every bone to its parent bone. */
export declare class SkeletonHelper3D extends LineHelper3D {
    readonly root: Object3D;
    readonly bones: readonly Bone3D[];
    constructor(root: Object3D, color?: ColorInput3D);
    update(): void;
}
export declare function createBoxHelper3D(target: Object3D, color?: ColorInput3D): BoxHelper3D;
export declare function createArrowHelper3D(direction: ArrayLike<number>, origin?: ArrayLike<number>, length?: number, color?: ColorInput3D): ArrowHelper3D;
export declare function createCameraHelper3D(camera: Camera3D, color?: ColorInput3D): CameraHelper3D;
export declare function createLightHelper3D(light: Light3D, size?: number, color?: ColorInput3D): LightHelper3D;
export declare function createSkeletonHelper3D(root: Object3D, color?: ColorInput3D): SkeletonHelper3D;
//# sourceMappingURL=debug3D.d.ts.map