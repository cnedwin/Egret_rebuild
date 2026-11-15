import { type ColorInput3D } from './Material3D.js';
import { Mesh3D } from './Mesh3D.js';
export interface VolumetricFogOptions3D {
    readonly color?: ColorInput3D;
    /** Fog thickness per world unit at `height`. Default 0.02. */
    readonly density?: number;
    /** World height at which the fog has its stated density. Default 0. */
    readonly height?: number;
    /** How quickly the fog thins with height, per world unit; 0 gives uniform fog. Default 0.1. */
    readonly falloff?: number;
    /** The fog is walked no further than this from the camera. Default 120. */
    readonly distance?: number;
    /** -1 to 1: above 0 the fog glows toward each light, as haze around the sun does. Default 0.6. */
    readonly anisotropy?: number;
    /** How strongly directional lights, ambient light, and spot and point lights light the fog. Defaults: 0.3, 0.5 and 1. */
    readonly sunStrength?: number;
    readonly ambientStrength?: number;
    readonly lightStrength?: number;
}
/**
 * Add one to the scene's root and keep `receiveShadow` on. Before each draw
 * it places itself in front of whichever camera is rendering. It asks the
 * renderer for the depth of the solid scene, so the walk stops at walls, and
 * it replaces `scene.fog` and the atmosphere post hook rather than adding to
 * them. Each pixel takes 24 steps, each reading every light.
 */
export declare class VolumetricFog3D extends Mesh3D {
    #private;
    constructor(options?: VolumetricFogOptions3D);
    get density(): number;
    set density(value: number);
    get falloff(): number;
    set falloff(value: number);
    get height(): number;
    set height(value: number);
    get distance(): number;
    set distance(value: number);
    get anisotropy(): number;
    set anisotropy(value: number);
    get sunStrength(): number;
    set sunStrength(value: number);
    get ambientStrength(): number;
    set ambientStrength(value: number);
    get lightStrength(): number;
    set lightStrength(value: number);
    /** Linear RGB fog color. */
    setColor(color: ColorInput3D): void;
    /** Release the geometry and the material. */
    dispose(): void;
    /** Stand just beyond the camera's near plane, turned as it is and large enough to cover its view. */
    private face;
    private amount;
}
export declare function createVolumetricFog3D(options?: VolumetricFogOptions3D): VolumetricFog3D;
//# sourceMappingURL=VolumetricFog3D.d.ts.map