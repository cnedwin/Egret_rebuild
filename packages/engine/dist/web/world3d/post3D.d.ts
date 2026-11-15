import type { Camera3D } from '../../rendering/world3d/Camera3D.js';
import type { ToneMapping3D } from './frame3D.js';
/**
 * A full-screen hook that runs after ambient occlusion and bloom and before
 * tone mapping. Supply the function in each shading language you target:
 *   GLSL:  vec3 customPost(vec3 color, vec2 uv)   reading uPostCustom[0..3]
 *   WGSL:  fn customPost(color: vec3f, uv: vec2f) -> vec3f   reading params.custom[0..3]
 * Both may call sceneColor(uv) for the lit scene and sceneDepth(uv) for the
 * distance from the camera plane in world units, which is enough for fog
 * volumes, outlines, contact shadows and similar screen-space effects.
 */
export interface CustomPost3D {
    /** Identifies the source; equal keys share one compiled program. */
    readonly key: string;
    readonly glsl?: string;
    readonly wgsl?: string;
    /** Four vec4 parameters written by the application. */
    readonly uniforms: Float32Array;
}
export declare function createCustomPost3D(input: {
    readonly key: string;
    readonly glsl?: string;
    readonly wgsl?: string;
    readonly uniforms?: ArrayLike<number>;
}): CustomPost3D;
export interface PostProcessSettings3D {
    /** Master switch. While false the renderer draws directly and nothing here costs anything. */
    enabled: boolean;
    bloom: boolean;
    /** Linear brightness above which pixels start to glow. */
    bloomThreshold: number;
    /** Width of the soft transition below the threshold, in [0, 1]. */
    bloomKnee: number;
    bloomIntensity: number;
    /** Pyramid depth, 1 to 8; more levels give a wider glow. */
    bloomLevels: number;
    /** Fast approximate anti-aliasing on the final image. Canvas multisampling does not apply while post-processing is on. */
    fxaa: boolean;
    /** 0 is grayscale, 1 unchanged. */
    saturation: number;
    /** Contrast around middle gray; 1 unchanged. */
    contrast: number;
    /** Linear multiplier applied before tone mapping; 1 unchanged. */
    brightness: number;
    /** Darkening toward the corners, in [0, 1]; 0 disables it. */
    vignette: number;
    /** Screen-space ambient occlusion: darkens creases and contact areas using scene depth. */
    ssao: boolean;
    /** World-space reach of the occlusion search. */
    ssaoRadius: number;
    ssaoIntensity: number;
    /** Ignores occluders this close to the surface plane, against self-shadowing on flat faces. */
    ssaoBias: number;
    /** Depth of field: blur what lies nearer or farther than the focused range. */
    dof: boolean;
    /** Distance from the camera, in world units, that is perfectly sharp. */
    dofFocus: number;
    /** Half-depth of the sharp zone around the focus distance, in world units. */
    dofRange: number;
    /** Largest blur radius in pixels. */
    dofRadius: number;
    /** Optional application pass; see CustomPost3D. */
    custom: CustomPost3D | undefined;
    /**
     * Layer bits of the objects to outline; 0 turns outlines off. Give the
     * objects one of these bits in `layers` and they are traced on screen, even
     * where something stands in front of them.
     */
    outlineLayers: number;
    /** Linear RGB of the outline. */
    outlineColor: [number, number, number];
    /** Outline width in pixels. */
    outlineThickness: number;
}
/** Camera values the depth-reading passes need. */
export interface PostView3D {
    readonly inverseProjection: Float32Array;
}
export declare function postViewFromCamera3D(camera: Camera3D): PostView3D;
/** True when the settings ask for outlines. */
export declare function outlineActive3D(settings: PostProcessSettings3D): boolean;
/** Post uniform layout: a, b, flags, custom[4], outline and inverse projection. */
export declare const POST_PARAMS_FLOATS_3D = 48;
export declare function writePostParams3D(out: Float32Array, a: ArrayLike<number>, b: ArrayLike<number>, view: PostView3D, aoEnabled: boolean, width: number, height: number, custom?: CustomPost3D, outline?: PostProcessSettings3D): void;
export declare const POST3D_LIMITS: Readonly<{
    readonly maxBloomLevels: 8;
}>;
export declare function createPostProcessSettings3D(): PostProcessSettings3D;
/** Number of bloom levels that fit the output size. */
export declare function bloomLevelCount3D(settings: PostProcessSettings3D, width: number, height: number): number;
/** Composite parameters in the order both shader languages read them: two vec4. */
export declare function writeCompositeParams3D(out: Float32Array, settings: PostProcessSettings3D, levels: number, toneMapping: ToneMapping3D, encode: boolean): void;
export declare const POST_VERTEX_GLSL_3D = "#version 300 es\nout vec2 vUv;\nvoid main() {\n    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));\n    vUv = p;\n    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);\n}";
/** uA: radius, intensity, bias. Writes occlusion (1 = open) to every channel. */
export declare const POST_SSAO_GLSL_3D: string;
/** uA: xy source texel, z threshold, w knee. uB.x: 1 applies the brightness prefilter. */
export declare const POST_DOWN_GLSL_3D: string;
/** uA.xy: source texel. Drawn with additive blending onto the next larger level. */
export declare const POST_UP_GLSL_3D: string;
/** uA: focus distance, sharp half-range, largest radius in pixels. Blurs by distance from the focused zone. */
export declare const POST_DOF_GLSL_3D: string;
/** uA: bloom scale, tone mapping, sRGB encode, vignette. uB: saturation, contrast, brightness. */
export declare function postCompositeGlsl3D(customPost?: string): string;
/** uA.xy: source texel; uA.z: 1 converts the sRGB-encoded result back to linear for an encoding target. */
export declare const POST_FXAA_GLSL_3D: string;
export declare const POST_SSAO_WGSL_3D: string;
export declare const POST_DOWN_WGSL_3D: string;
export declare const POST_UP_WGSL_3D: string;
export declare const POST_DOF_WGSL_3D: string;
export declare function postCompositeWgsl3D(customPost?: string): string;
export declare const POST_FXAA_WGSL_3D: string;
//# sourceMappingURL=post3D.d.ts.map