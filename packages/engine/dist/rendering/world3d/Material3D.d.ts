import { Resource3D } from './core3D.js';
import type { Texture3D } from './Texture3D.js';
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
 *
 * A normal hook replaces the shading normal of a lit material before any
 * light is computed, for surfaces whose detail is a formula rather than a
 * texture, such as ripples on water:
 *   GLSL:  vec3 customNormal(vec3 normal, vec3 worldPosition, vec2 uv)
 *   WGSL:  fn customNormal(normal: vec3f, worldPosition: vec3f, uv: vec2f) -> vec3f
 * The result is normalized for you.
 */
export interface CustomShader3D {
    /** Identifies the source; materials with the same key share compiled programs. */
    readonly key: string;
    readonly glsl?: string;
    readonly wgsl?: string;
    readonly glslVertex?: string;
    readonly wgslVertex?: string;
    readonly glslNormal?: string;
    readonly wgslNormal?: string;
    /** Four vec4 parameters, written by the application (time, colors, thresholds). */
    readonly uniforms: Float32Array;
}
export declare function createCustomShader3D(input: {
    readonly key: string;
    readonly glsl?: string;
    readonly wgsl?: string;
    readonly glslVertex?: string;
    readonly wgslVertex?: string;
    readonly glslNormal?: string;
    readonly wgslNormal?: string;
    readonly uniforms?: ArrayLike<number>;
}): CustomShader3D;
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
export declare function setColor3D(out: Float32Array, input: ColorInput3D): Float32Array;
/**
 * One material class carries the superset of surface parameters; `shading`
 * selects the lighting model. Assign fields freely and call touch() when a
 * change alters shader features (maps added or removed, alpha mode, side).
 * Scalar and color edits take effect on the next draw without touch().
 */
export declare class Material3D extends Resource3D {
    readonly shading: Shading3D;
    readonly color: Float32Array<ArrayBuffer>;
    opacity: number;
    map: Texture3D | undefined;
    side: Side3D;
    alphaMode: AlphaMode3D;
    /** Fragments below this alpha are discarded in 'mask' mode. */
    alphaCutoff: number;
    blending: Blending3D;
    depthTest: boolean;
    depthWrite: boolean;
    /** Multiply the base color by the geometry's `color` attribute. */
    vertexColors: boolean;
    fog: boolean;
    toneMapped: boolean;
    visible: boolean;
    readonly emissive: Float32Array<ArrayBuffer>;
    emissiveIntensity: number;
    emissiveMap: Texture3D | undefined;
    normalMap: Texture3D | undefined;
    normalScale: number;
    occlusionMap: Texture3D | undefined;
    occlusionStrength: number;
    flatShading: boolean;
    wireframe: boolean;
    readonly specular: Float32Array<ArrayBuffer>;
    shininess: number;
    /** Optional fragment hook. Call touch() after assigning a different shader. */
    shader: CustomShader3D | undefined;
    /**
     * Baked lighting added to the indirect light of lit materials. It is sampled
     * with the texture's `channel`, normally 1 for a second, non-overlapping UV set.
     */
    lightMap: Texture3D | undefined;
    lightMapIntensity: number;
    /**
     * A mirror image of the scene for a flat reflective surface on a standard
     * material, normally the texture of a PlanarReflection3D. It is read at
     * the pixel's own place on screen, so the mesh needs no coordinates for
     * it, and it takes the place of the environment map's reflection.
     */
    reflectionMap: Texture3D | undefined;
    reflectionStrength: number;
    /** How far the surface normal pushes the mirror image sideways, as a share of the screen. */
    reflectionDistortion: number;
    /**
     * For blended materials such as particles and haze: the distance over which
     * the surface fades out where it comes close to the solid geometry behind
     * it, instead of ending in a hard line. 0 turns the fade off.
     */
    softness: number;
    /**
     * Ground layers blended by a weight map, for terrain: up to four tiling
     * textures, each shown where its channel of `weights` (R, G, B, A) is
     * strong. Weights are read with the mesh's coordinates as they are and
     * layers with those coordinates times their `repeat`. The layers take
     * the texture slots of map, emissiveMap, occlusionMap, metallicRoughnessMap
     * and lightMap, so leave those unset. Call touch() after assigning.
     */
    splat: {
        readonly weights: Texture3D;
        readonly layers: readonly Texture3D[];
        readonly repeat: readonly number[];
    } | undefined;
    /** Strength, 0 to 1, of a soft rim lobe for cloth and velvet on a standard material. */
    sheen: number;
    readonly sheenColor: Float32Array<ArrayBuffer>;
    sheenRoughness: number;
    /**
     * How much light passes through a standard material, 0 to 1, as for glass.
     * What lies behind is drawn first and then seen through the surface,
     * tinted by its color and blurred by its roughness. Such a material is
     * drawn with the transparent objects whatever its alphaMode; other
     * see-through and transparent objects behind it do not show through.
     */
    transmission: number;
    /** Index of refraction for transmission: 1 does not bend light, 1.5 is glass, 1.33 water. */
    ior: number;
    /** How far, in world units, light travels inside a transmitting object. Zero means a thin sheet that does not bend the view. */
    thickness: number;
    /** Color white light takes on after travelling `attenuationDistance` inside a transmitting object. */
    readonly attenuationColor: Float32Array<ArrayBuffer>;
    attenuationDistance: number;
    /** Strength, 0 to 1, of a clear lacquer layer over a standard material (car paint, varnish). */
    clearcoat: number;
    clearcoatRoughness: number;
    /** Number of light bands for toon shading. */
    toonSteps: number;
    metallic: number;
    roughness: number;
    metallicRoughnessMap: Texture3D | undefined;
    environmentIntensity: number;
    billboard: boolean;
    /** Treat vertex positions as normalized device coordinates; used by full-screen layers. */
    screenSpace: boolean;
    sizeAttenuation: boolean;
    rotation: number;
    pointSize: number;
    /** Polygon offset to resolve coplanar decals: [factor, units]. */
    polygonOffset: readonly [number, number] | undefined;
    constructor(shading: Shading3D, options?: MaterialOptions3D);
    /** True when the material must be drawn in the sorted transparent pass. */
    get isTransparent(): boolean;
    setColor(color: ColorInput3D): this;
    setEmissive(color: ColorInput3D): this;
    /** Independent copy sharing texture references. */
    clone(): Material3D;
}
/** Constant color, unaffected by lights. */
export declare function createUnlitMaterial3D(options?: MaterialOptions3D): Material3D;
/** Diffuse-only lighting; the cheapest lit model. */
export declare function createLambertMaterial3D(options?: MaterialOptions3D): Material3D;
/** Diffuse plus Blinn-Phong specular highlights. */
export declare function createPhongMaterial3D(options?: PhongMaterialOptions3D): Material3D;
/** Cel shading: diffuse light quantized into `steps` flat bands. */
export declare function createToonMaterial3D(options?: MaterialOptions3D & {
    readonly steps?: number;
}): Material3D;
/**
 * Lighting baked into a sphere image: the surface color is looked up by the
 * view-space normal, so no lights are needed. The image is held in `emissiveMap`.
 */
export declare function createMatcapMaterial3D(options: MaterialOptions3D & {
    readonly matcap: Texture3D;
}): Material3D;
/**
 * A standard material set up as glass: smooth and see-through, with
 * reflections kept. Give it a `thickness` to bend the view like a solid block.
 */
export declare function createGlassMaterial3D(options?: StandardMaterialOptions3D & {
    readonly transmission?: number;
    readonly ior?: number;
    readonly thickness?: number;
}): Material3D;
/** Physically based metallic-roughness model, matching glTF 2.0 materials. */
export declare function createStandardMaterial3D(options?: StandardMaterialOptions3D): Material3D;
/** Camera-facing unlit quad material for Sprite3D. */
export declare function createSpriteMaterial3D(options?: SpriteMaterialOptions3D): Material3D;
//# sourceMappingURL=Material3D.d.ts.map