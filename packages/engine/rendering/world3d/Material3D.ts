// SPDX-License-Identifier: Apache-2.0
// Surface descriptions consumed by the first-party shader library. All color
// values are linear RGB; factories accept 0xRRGGBB sRGB hex for convenience.
import {Resource3D, World3DError} from './core3D.js';
import {colorFromHex} from './math3D.js';
import type {Texture3D} from './Texture3D.js';

export type Shading3D = 'unlit' | 'lambert' | 'phong' | 'standard';
export type Side3D = 'front' | 'back' | 'double';
export type AlphaMode3D = 'opaque' | 'mask' | 'blend';
export type Blending3D = 'normal' | 'additive' | 'multiply' | 'premultiplied';

/** A color as 0xRRGGBB sRGB hex or linear RGB components. */
export type ColorInput3D = number | readonly [number, number, number];

export interface MaterialOptions3D {
    readonly name?: string;
    readonly color?: ColorInput3D;
    readonly opacity?: number;
    readonly map?: Texture3D;
    readonly side?: Side3D;
    readonly alphaMode?: AlphaMode3D;
    readonly alphaCutoff?: number;
    readonly blending?: Blending3D;
    readonly depthTest?: boolean;
    readonly depthWrite?: boolean;
    readonly vertexColors?: boolean;
    readonly fog?: boolean;
    readonly toneMapped?: boolean;
    readonly emissive?: ColorInput3D;
    readonly emissiveIntensity?: number;
    readonly emissiveMap?: Texture3D;
    readonly normalMap?: Texture3D;
    readonly normalScale?: number;
    readonly occlusionMap?: Texture3D;
    readonly occlusionStrength?: number;
    readonly flatShading?: boolean;
    readonly wireframe?: boolean;
}
export interface PhongMaterialOptions3D extends MaterialOptions3D {
    readonly specular?: ColorInput3D;
    readonly shininess?: number;
}
export interface StandardMaterialOptions3D extends MaterialOptions3D {
    readonly metallic?: number;
    readonly roughness?: number;
    /** Roughness in G and metallic in B, as in glTF. */
    readonly metallicRoughnessMap?: Texture3D;
    readonly environmentIntensity?: number;
}
export interface SpriteMaterialOptions3D extends MaterialOptions3D {
    /** Keep a constant on-screen size regardless of distance. */
    readonly sizeAttenuation?: boolean;
    /** Rotation about the view axis in radians. */
    readonly rotation?: number;
}

export function setColor3D(out: Float32Array, input: ColorInput3D): Float32Array {
    if (typeof input === 'number') colorFromHex(out, input);
    else if (Array.isArray(input) && input.length === 3 && input.every(Number.isFinite)) { out[0] = input[0]!; out[1] = input[1]!; out[2] = input[2]!; }
    else throw new World3DError('WORLD3D_INPUT_INVALID', 'color');
    return out;
}

/**
 * One material class carries the superset of surface parameters; `shading`
 * selects the lighting model. Assign fields freely and call touch() when a
 * change alters shader features (maps added or removed, alpha mode, side).
 * Scalar and color edits take effect on the next draw without touch().
 */
export class Material3D extends Resource3D {
    readonly shading: Shading3D;
    readonly color = new Float32Array([1, 1, 1]);
    opacity = 1;
    map: Texture3D | undefined;
    side: Side3D = 'front';
    alphaMode: AlphaMode3D = 'opaque';
    /** Fragments below this alpha are discarded in 'mask' mode. */
    alphaCutoff = 0.5;
    blending: Blending3D = 'normal';
    depthTest = true;
    depthWrite = true;
    /** Multiply the base color by the geometry's `color` attribute. */
    vertexColors = false;
    fog = true;
    toneMapped = true;
    visible = true;
    readonly emissive = new Float32Array([0, 0, 0]);
    emissiveIntensity = 1;
    emissiveMap: Texture3D | undefined;
    normalMap: Texture3D | undefined;
    normalScale = 1;
    occlusionMap: Texture3D | undefined;
    occlusionStrength = 1;
    flatShading = false;
    wireframe = false;
    // Phong
    readonly specular = new Float32Array([0.07, 0.07, 0.07]);
    shininess = 30;
    // Standard (metallic-roughness PBR)
    metallic = 0;
    roughness = 1;
    metallicRoughnessMap: Texture3D | undefined;
    environmentIntensity = 1;
    // Sprite and point rendering
    billboard = false;
    /** Treat vertex positions as normalized device coordinates; used by full-screen layers. */
    screenSpace = false;
    sizeAttenuation = true;
    rotation = 0;
    pointSize = 1;
    /** Polygon offset to resolve coplanar decals: [factor, units]. */
    polygonOffset: readonly [number, number] | undefined;

    constructor(shading: Shading3D, options: MaterialOptions3D = {}) {
        super();
        this.shading = shading;
        this.name = options.name ?? '';
        if (options.color !== undefined) setColor3D(this.color, options.color);
        if (options.emissive !== undefined) setColor3D(this.emissive, options.emissive);
        this.opacity = options.opacity ?? 1;
        this.map = options.map;
        this.side = options.side ?? 'front';
        this.alphaMode = options.alphaMode ?? (this.opacity < 1 ? 'blend' : 'opaque');
        this.alphaCutoff = options.alphaCutoff ?? 0.5;
        this.blending = options.blending ?? 'normal';
        this.depthTest = options.depthTest ?? true;
        this.depthWrite = options.depthWrite ?? this.alphaMode !== 'blend';
        this.vertexColors = options.vertexColors ?? false;
        this.fog = options.fog ?? true;
        this.toneMapped = options.toneMapped ?? true;
        this.emissiveIntensity = options.emissiveIntensity ?? 1;
        this.emissiveMap = options.emissiveMap;
        this.normalMap = options.normalMap;
        this.normalScale = options.normalScale ?? 1;
        this.occlusionMap = options.occlusionMap;
        this.occlusionStrength = options.occlusionStrength ?? 1;
        this.flatShading = options.flatShading ?? false;
        this.wireframe = options.wireframe ?? false;
    }
    /** True when the material must be drawn in the sorted transparent pass. */
    get isTransparent(): boolean {
        return this.alphaMode === 'blend';
    }
    setColor(color: ColorInput3D): this { setColor3D(this.color, color); return this; }
    setEmissive(color: ColorInput3D): this { setColor3D(this.emissive, color); return this; }
    /** Independent copy sharing texture references. */
    clone(): Material3D {
        const copy = new Material3D(this.shading);
        const skip = new Set(['id', 'shading', 'color', 'emissive', 'specular']);
        for (const key of Object.keys(this) as (keyof Material3D)[]) {
            if (!skip.has(key)) (copy as unknown as Record<string, unknown>)[key] = this[key];
        }
        copy.color.set(this.color); copy.emissive.set(this.emissive); copy.specular.set(this.specular);
        return copy;
    }
}

/** Constant color, unaffected by lights. */
export function createUnlitMaterial3D(options: MaterialOptions3D = {}): Material3D {
    return new Material3D('unlit', options);
}
/** Diffuse-only lighting; the cheapest lit model. */
export function createLambertMaterial3D(options: MaterialOptions3D = {}): Material3D {
    return new Material3D('lambert', options);
}
/** Diffuse plus Blinn-Phong specular highlights. */
export function createPhongMaterial3D(options: PhongMaterialOptions3D = {}): Material3D {
    const material = new Material3D('phong', options);
    if (options.specular !== undefined) setColor3D(material.specular, options.specular);
    material.shininess = options.shininess ?? 30;
    return material;
}
/** Physically based metallic-roughness model, matching glTF 2.0 materials. */
export function createStandardMaterial3D(options: StandardMaterialOptions3D = {}): Material3D {
    const material = new Material3D('standard', options);
    material.metallic = options.metallic ?? 0;
    material.roughness = options.roughness ?? 1;
    material.metallicRoughnessMap = options.metallicRoughnessMap;
    material.environmentIntensity = options.environmentIntensity ?? 1;
    return material;
}
/** Camera-facing unlit quad material for Sprite3D. */
export function createSpriteMaterial3D(options: SpriteMaterialOptions3D = {}): Material3D {
    const material = new Material3D('unlit', {alphaMode: 'blend', side: 'double', ...options});
    material.billboard = true;
    material.sizeAttenuation = options.sizeAttenuation ?? true;
    material.rotation = options.rotation ?? 0;
    return material;
}
