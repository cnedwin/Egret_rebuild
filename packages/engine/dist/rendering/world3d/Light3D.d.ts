import type { ColorInput3D } from './Material3D.js';
import { Object3D } from './Object3D.js';
export type LightType3D = 'ambient' | 'hemisphere' | 'directional' | 'point' | 'spot';
export declare const LIGHT3D_LIMITS: Readonly<{
    readonly maxDirectional: 4;
    readonly maxPoint: 8;
    readonly maxSpot: 4;
    readonly maxShadows: 4;
}>;
export interface LightShadow3D {
    /** Edge of this light's square tile in the shared shadow atlas, in texels. */
    mapSize: number;
    /** Constant depth offset against shadow acne. */
    bias: number;
    /** Offset along the surface normal, in world units. */
    normalBias: number;
    near: number;
    far: number;
    /** Half extent of the orthographic volume used by directional lights. */
    extent: number;
    /** Percentage-closer filter radius in texels; 0 samples once. */
    radius: number;
    /**
     * Number of cascades for a directional light, 1 to 4. Each cascade takes
     * one atlas tile and follows the camera, so `extent` is ignored above 1.
     * Only the first cascaded directional light in a scene is split.
     */
    cascades: number;
    /** Distance from the camera, in world units, that cascaded shadows cover. */
    cascadeDistance: number;
    /** Split distribution: 0 spaces cascades evenly, 1 logarithmically. */
    cascadeLambda: number;
}
export interface LightOptions3D {
    readonly color?: ColorInput3D;
    readonly intensity?: number;
    readonly castShadow?: boolean;
}
export interface PointLightOptions3D extends LightOptions3D {
    /** Distance at which the light fades to zero; 0 means unbounded inverse-square falloff. */
    readonly range?: number;
}
export interface SpotLightOptions3D extends PointLightOptions3D {
    /** Half angle of the cone in radians. */
    readonly angle?: number;
    /** Fraction of the cone over which intensity falls off, in [0, 1]. */
    readonly penumbra?: number;
}
export declare class Light3D extends Object3D {
    readonly lightType: LightType3D;
    readonly color: Float32Array<ArrayBuffer>;
    intensity: number;
    /** Lower hemisphere color for hemisphere lights. */
    readonly groundColor: Float32Array<ArrayBuffer>;
    range: number;
    angle: number;
    penumbra: number;
    readonly shadow: LightShadow3D;
    constructor(lightType?: LightType3D);
    clone(recursive?: boolean): this;
    protected copyFrom(source: this): void;
}
/** Uniform light from every direction. */
export declare function createAmbientLight3D(options?: LightOptions3D): Light3D;
/** Sky color from above blending to a ground color from below (world Y axis). */
export declare function createHemisphereLight3D(options?: LightOptions3D & {
    readonly groundColor?: ColorInput3D;
}): Light3D;
/** Parallel rays, such as sunlight. Aim it with lookAt(). */
export declare function createDirectionalLight3D(options?: LightOptions3D): Light3D;
export declare function createPointLight3D(options?: PointLightOptions3D): Light3D;
export declare function createSpotLight3D(options?: SpotLightOptions3D): Light3D;
//# sourceMappingURL=Light3D.d.ts.map