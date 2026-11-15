import { Geometry3D } from './Geometry3D.js';
import { Material3D } from './Material3D.js';
import type { ColorInput3D } from './Material3D.js';
import { Mesh3D } from './Mesh3D.js';
import { Texture3D } from './Texture3D.js';
import type { TextureSource3D } from './Texture3D.js';
import { Object3D } from './Object3D.js';
/** Square grid of lines on the XZ plane, centered at the origin. */
export declare function createGridGeometry3D(size?: number, divisions?: number): Geometry3D;
/** Three colored segments from the origin along +X (red), +Y (green) and +Z (blue). */
export declare function createAxesGeometry3D(length?: number): Geometry3D;
/** The twelve edges of an axis-aligned box given as [minX, minY, minZ, maxX, maxY, maxZ]. */
export declare function createBoxEdgesGeometry3D(box: ArrayLike<number>): Geometry3D;
/** Unlit line or point material; pair it with a 'lines', 'line-strip' or 'points' geometry. */
export declare function createLineMaterial3D(color?: ColorInput3D, vertexColors?: boolean): Material3D;
/** Ready-made grid node for editors and debug views. */
export declare function createGridHelper3D(size?: number, divisions?: number, color?: ColorInput3D): Mesh3D;
/** Ready-made axes node colored X red, Y green, Z blue. */
export declare function createAxesHelper3D(length?: number): Mesh3D;
/**
 * Shows exactly one child depending on the distance to the camera. Levels are
 * kept sorted by distance; the render list calls select() once per frame.
 */
export declare class Lod3D extends Object3D {
    #private;
    /** Index of the level shown by the last select(), or -1 before the first. */
    currentLevel: number;
    constructor();
    get levels(): readonly {
        readonly object: Object3D;
        readonly distance: number;
    }[];
    /** Show `object` once the camera is at least `distance` world units away. */
    addLevel(object: Object3D, distance?: number): this;
    /** Pick the level for a camera at world position (x, y, z). */
    select(x: number, y: number, z: number): void;
    clone(): this;
}
export interface ScreenLayerOptions3D {
    /** 'overlay' draws after the scene with blending; 'underlay' draws first and is covered by it. */
    readonly order?: 'overlay' | 'underlay';
    /** Multiplies the layer's alpha. */
    readonly opacity?: number;
    /** Re-upload the source every frame. Disable for layers that change rarely and call refreshSource() instead. */
    readonly autoUpdate?: boolean;
    /** Source rows start at the top, as canvases and images do. Defaults to true. */
    readonly topRowFirst?: boolean;
}
/**
 * Full-screen image drawn in the same pass as the 3D scene, typically the
 * canvas of a 2D stage. An overlay is composited above the scene and an
 * underlay beneath it, so interface, scene and backdrop share one surface.
 */
export declare class ScreenLayer3D extends Mesh3D {
    readonly texture: Texture3D;
    autoUpdate: boolean;
    constructor(source: TextureSource3D, options?: ScreenLayerOptions3D);
    /** Schedule a new upload of the source pixels. */
    refreshSource(): void;
    /** Release the layer's texture and material. The shared quad geometry stays alive. */
    dispose(): void;
    clone(): this;
}
export declare function createScreenLayer3D(source: TextureSource3D, options?: ScreenLayerOptions3D): ScreenLayer3D;
//# sourceMappingURL=helpers3D.d.ts.map