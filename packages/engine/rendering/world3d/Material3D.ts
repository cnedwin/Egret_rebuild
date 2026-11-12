// SPDX-License-Identifier: Apache-2.0
// Surface descriptions consumed by the first-party shader library. All color
// values are linear RGB; factories accept 0xRRGGBB sRGB hex for convenience.
import {Resource3D, World3DError} from './core3D.js';
import {colorFromHex} from './math3D.js';
import type {Texture3D} from './Texture3D.js';

/**
 * A fragment hook that post-processes a material's shaded color. Supply the
 * function in each shading language you target:
 *   GLSL:  vec4 customFragment(vec4 color, vec3 worldPosition, vec3 normal, vec2 uv)  reading uCustom[0..3]
 *   WGSL:  fn customFragment(color: vec4f, worldPosition: vec3f, normal: vec3f, uv: vec2f) -> vec4f  reading material.custom[0..3]
 * `color` is linear and not yet fogged or tone mapped; return the new color and alpha.
 * A backend without source for its language draws the material unchanged.
 *
 * A vertex hook displaces vertices in world space, in the visible pass and in
 * shadow maps alike, so swaying foliage casts swaying shadows:
 *   GLSL:  vec3 customVertex(vec3 worldPosition, vec3 localPosition, vec3 normal, vec2 uv, vec4 color)
 *   WGSL:  fn customVertex(worldPosition: vec3f, localPosition: vec3f, normal: vec3f, uv: vec2f, color: vec4f) -> vec3f
 * Return the new world position. Use only the arguments and the custom
 * parameters; per-frame camera data is not available while drawing shadows.
 * `color` is the vertex color when the material enables vertexColors, else white.
 */
export interface CustomShader3D {
    /** Identifies the source; materials with the same key share compiled programs. */
    readonly key: string;
    readonly glsl?: string;
    readonly wgsl?: string;
    readonly glslVertex?: string;
    readonly wgslVertex?: string;
    /** Four vec4 parameters, written by the application (time, colors, thresholds). */
    readonly uniforms: Float32Array;
}
export function createCustomShader3D(input: {readonly key: string; readonly glsl?: string; readonly wgsl?: string; readonly glslVertex?: string; readonly wgslVertex?: string; readonly uniforms?: ArrayLike<number>}): CustomShader3D {
    if (!input || typeof input.key !== 'string' || input.key.length === 0 || /[\s|/]/.test(input.key)) throw new World3DError('WORLD3D_INPUT_INVALID', 'shader key');
    if (input.glsl === undefined && input.wgsl === undefined && input.glslVertex === undefined && input.wgslVertex === undefined) throw new World3DError('WORLD3D_INPUT_INVALID', 'shader source');
    const uniforms = new Float32Array(16);
    if (input.uniforms) uniforms.set(Array.from(input.uniforms).slice(0, 16));
    return Object.freeze({key: input.key, ...(input.glsl === undefined ? {} : {glsl: input.glsl}), ...(input.wgsl === undefined ? {} : {wgsl: input.wgsl}),
        ...(input.glslVertex === undefined ? {} : {glslVertex: input.glslVertex}), ...(input.wgslVertex === undefined ? {} : {wgslVertex: input.wgslVertex}), uniforms});
}
export type Shading3D = 'unlit' | 'lambert' | 'phong' | 'standard' | 'toon' | 'matcap';
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
    /** Optional fragment hook. Call touch() after assigning a different shader. */
    shader: CustomShader3D | undefined;
    /** Strength, 0 to 1, of a clear lacquer layer over a standard material (car paint, varnish). */
    clearcoat = 0;
    clearcoatRoughness = 0.1;
    /** Number of light bands for toon shading. */
    toonSteps = 3;
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
/** Cel shading: diffuse light quantized into `steps` flat bands. */
export function createToonMaterial3D(options: MaterialOptions3D & {readonly steps?: number} = {}): Material3D {
    const material = new Material3D('toon', options);
    material.toonSteps = Math.max(1, Math.floor(options.steps ?? 3));
    return material;
}
/**
 * Lighting baked into a sphere image: the surface color is looked up by the
 * view-space normal, so no lights are needed. The image is held in `emissiveMap`.
 */
export function createMatcapMaterial3D(options: MaterialOptions3D & {readonly matcap: Texture3D}): Material3D {
    const material = new Material3D('matcap', options);
    material.emissiveMap = options.matcap;
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
