// SPDX-License-Identifier: Apache-2.0
// Light nodes. Directional and spot lights shine along their local negative
// Z axis, matching cameras and glTF punctual lights. Colors are linear RGB.
import { setColor3D } from './Material3D.js';
import type { ColorInput3D } from './Material3D.js';
import { Object3D } from './Object3D.js';

/** The kind of a light: ambient, hemisphere, directional, point or spot. */
export type LightType3D = 'ambient' | 'hemisphere' | 'directional' | 'point' | 'spot';
/** The most directional, point, tiled point and spot lights a scene lights, and the most shadows. */
export const LIGHT3D_LIMITS = Object.freeze({
  maxDirectional: 4,
  maxPoint: 8,
  /** Point lights with a range lit through the tiled list, beyond the eight lit directly. */
  maxTiledPoint: 256,
  maxSpot: 4,
  maxShadows: 4
} as const);

/** How a light casts shadows: its map size, biases, range, extent, softness and cascades. */
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

/** A light to make: its color and intensity, and whether it casts shadows. */
export interface LightOptions3D {
  readonly color?: ColorInput3D;
  readonly intensity?: number;
  readonly castShadow?: boolean;
}
/** A point light to make: how far it reaches. */
export interface PointLightOptions3D extends LightOptions3D {
  /** Distance at which the light fades to zero; 0 means unbounded inverse-square falloff. */
  readonly range?: number;
}
/** A spot light to make: its cone's angle and soft edge. */
export interface SpotLightOptions3D extends PointLightOptions3D {
  /** Half angle of the cone in radians. */
  readonly angle?: number;
  /** Fraction of the cone over which intensity falls off, in [0, 1]. */
  readonly penumbra?: number;
}

/** A light in a scene: its kind and its shadow. */
export class Light3D extends Object3D {
  readonly lightType: LightType3D;
  readonly color = new Float32Array([1, 1, 1]);
  intensity = 1;
  /** Lower hemisphere color for hemisphere lights. */
  readonly groundColor = new Float32Array([0, 0, 0]);
  range = 0;
  angle = Math.PI / 4;
  penumbra = 0.1;
  readonly shadow: LightShadow3D = {
    mapSize: 1024,
    bias: 0.0005,
    normalBias: 0.02,
    near: 0.1,
    far: 100,
    extent: 10,
    radius: 1,
    cascades: 1,
    cascadeDistance: 100,
    cascadeLambda: 0.7
  };

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
    this.color.set(source.color);
    this.groundColor.set(source.groundColor);
    this.intensity = source.intensity;
    this.range = source.range;
    this.angle = source.angle;
    this.penumbra = source.penumbra;
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
  return base(new Light3D('ambient'), { ...options, castShadow: false });
}
/** Sky color from above blending to a ground color from below (world Y axis). */
export function createHemisphereLight3D(
  options: LightOptions3D & { readonly groundColor?: ColorInput3D } = {}
): Light3D {
  const light = base(new Light3D('hemisphere'), { ...options, castShadow: false });
  if (options.groundColor !== undefined) setColor3D(light.groundColor, options.groundColor);
  return light;
}
/** Parallel rays, such as sunlight. Aim it with lookAt(). */
export function createDirectionalLight3D(options: LightOptions3D = {}): Light3D {
  return base(new Light3D('directional'), options);
}
/** Makes a light that shines from a point in every direction. */
export function createPointLight3D(options: PointLightOptions3D = {}): Light3D {
  const light = base(new Light3D('point'), options);
  light.range = options.range ?? 0;
  return light;
}
/** Makes a light that shines from a point in a cone. */
export function createSpotLight3D(options: SpotLightOptions3D = {}): Light3D {
  const light = base(new Light3D('spot'), options);
  light.range = options.range ?? 0;
  light.angle = options.angle ?? Math.PI / 4;
  light.penumbra = options.penumbra ?? 0.1;
  return light;
}
