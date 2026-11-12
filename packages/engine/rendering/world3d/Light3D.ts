// SPDX-License-Identifier: Apache-2.0
// Light nodes. Directional and spot lights shine along their local negative
// Z axis, matching cameras and glTF punctual lights. Colors are linear RGB.
import {setColor3D} from './Material3D.js';
import type {ColorInput3D} from './Material3D.js';
import {Object3D} from './Object3D.js';

export type LightType3D = 'ambient' | 'hemisphere' | 'directional' | 'point' | 'spot';
export const LIGHT3D_LIMITS = Object.freeze({
    maxDirectional: 4, maxPoint: 8, maxSpot: 4, maxShadows: 4,
} as const);

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

export class Light3D extends Object3D {
    readonly lightType: LightType3D;
    readonly color = new Float32Array([1, 1, 1]);
    intensity = 1;
    /** Lower hemisphere color for hemisphere lights. */
    readonly groundColor = new Float32Array([0, 0, 0]);
    range = 0;
    angle = Math.PI / 4;
    penumbra = 0.1;
    readonly shadow: LightShadow3D = {mapSize: 1024, bias: 0.0005, normalBias: 0.02, near: 0.1, far: 100, extent: 10, radius: 1};

    constructor(lightType: LightType3D = 'directional') {
        super('light');
        this.lightType = lightType;
        this.castShadow = false;
    }
    override clone(recursive = true): this {
        const copy = new Light3D(this.lightType) as this;
        copy.copyFrom(this);
        if (recursive) for (const child of this.children) copy.addChild(child.clone(true));
        return copy;
    }
    protected override copyFrom(source: this): void {
        super.copyFrom(source);
        this.color.set(source.color); this.groundColor.set(source.groundColor);
        this.intensity = source.intensity; this.range = source.range; this.angle = source.angle; this.penumbra = source.penumbra;
        Object.assign(this.shadow, source.shadow);
    }
}

function base(light: Light3D, options: LightOptions3D): Light3D {
    if (options.color !== undefined) setColor3D(light.color, options.color);
    light.intensity = options.intensity ?? 1;
    light.castShadow = options.castShadow ?? false;
    return light;
}
/** Uniform light from every direction. */
export function createAmbientLight3D(options: LightOptions3D = {}): Light3D {
    return base(new Light3D('ambient'), {...options, castShadow: false});
}
/** Sky color from above blending to a ground color from below (world Y axis). */
export function createHemisphereLight3D(options: LightOptions3D & {readonly groundColor?: ColorInput3D} = {}): Light3D {
    const light = base(new Light3D('hemisphere'), {...options, castShadow: false});
    if (options.groundColor !== undefined) setColor3D(light.groundColor, options.groundColor);
    return light;
}
/** Parallel rays, such as sunlight. Aim it with lookAt(). */
export function createDirectionalLight3D(options: LightOptions3D = {}): Light3D {
    return base(new Light3D('directional'), options);
}
export function createPointLight3D(options: PointLightOptions3D = {}): Light3D {
    const light = base(new Light3D('point'), {...options, castShadow: false});
    light.range = options.range ?? 0;
    return light;
}
export function createSpotLight3D(options: SpotLightOptions3D = {}): Light3D {
    const light = base(new Light3D('spot'), options);
    light.range = options.range ?? 0;
    light.angle = options.angle ?? Math.PI / 4;
    light.penumbra = options.penumbra ?? 0.1;
    return light;
}
