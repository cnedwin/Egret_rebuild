// SPDX-License-Identifier: Apache-2.0
// Post-processing shared by both world3d backends: the settings object and
// the full-screen shaders in GLSL ES 3.00 and WGSL. The chain is
//   scene (half-float, linear) -> bloom pyramid -> composite (tone map, grade)
//   -> optional FXAA -> canvas or target.
// Bloom uses a dual-filter pyramid: each level is one 5-tap downsample and
// one 8-tap upsample, which is cheap enough for integrated and mobile GPUs.
import type {Camera3D} from '../../rendering/world3d/Camera3D.js';
import {World3DError} from '../../rendering/world3d/core3D.js';
import type {ToneMapping3D} from './frame3D.js';

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
export function createCustomPost3D(input: {readonly key: string; readonly glsl?: string; readonly wgsl?: string; readonly uniforms?: ArrayLike<number>}): CustomPost3D {
    if (!input || typeof input.key !== 'string' || input.key.length === 0 || /[\s|/]/.test(input.key)) throw new World3DError('WORLD3D_INPUT_INVALID', 'post key');
    if (input.glsl === undefined && input.wgsl === undefined) throw new World3DError('WORLD3D_INPUT_INVALID', 'post source');
    const uniforms = new Float32Array(16);
    if (input.uniforms) uniforms.set(Array.from(input.uniforms).slice(0, 16));
    return Object.freeze({key: input.key, ...(input.glsl === undefined ? {} : {glsl: input.glsl}), ...(input.wgsl === undefined ? {} : {wgsl: input.wgsl}), uniforms});
}
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
    /** Reciprocals of the projection's X and Y scales. */
    readonly scaleX: number; readonly scaleY: number;
    /** Off-center shift of the view volume, zero for a symmetric projection. */
    readonly offsetX: number; readonly offsetY: number;
    /** Projection entries that map view depth to clip depth and clip w: [2][2], [2][3], [3][2], [3][3]. */
    readonly depth: readonly [number, number, number, number];
    readonly orthographic: boolean;
}
export function postViewFromCamera3D(camera: Camera3D): PostView3D {
    // Everything is read from the matrix itself, not from the camera's fov, near and far,
    // so off-center, oblique and hand-written projections reconstruct correctly too.
    const p = camera.projectionMatrix, orthographic = p[11] === 0;
    return {
        scaleX: 1 / p[0]!, scaleY: 1 / p[5]!, offsetX: orthographic ? -p[12]! : p[8]!, offsetY: orthographic ? -p[13]! : p[9]!,
        depth: [p[10]!, p[11]!, p[14]!, p[15]!], orthographic,
    };
}
/** True when the settings ask for outlines. */
export function outlineActive3D(settings: PostProcessSettings3D): boolean { return settings.outlineLayers !== 0 && settings.outlineThickness > 0; }
/** Fill the 40 floats every post pass reads: a, b, projection, flags, custom[4], outline, depth mapping. */
export function writePostParams3D(out: Float32Array, a: ArrayLike<number>, b: ArrayLike<number>, view: PostView3D, aoEnabled: boolean, width: number, height: number, custom?: CustomPost3D,
    outline?: PostProcessSettings3D): void {
    out.fill(0);
    out.set(a, 0); out.set(b, 4);
    out[8] = view.scaleX; out[9] = view.scaleY; out[10] = view.offsetX; out[11] = view.offsetY;
    out.set(view.depth, 36);
    out[12] = view.orthographic ? 1 : 0; out[13] = aoEnabled ? 1 : 0; out[14] = 1 / width; out[15] = 1 / height;
    if (custom) out.set(custom.uniforms, 16);
    if (outline) { out.set(outline.outlineColor, 32); out[35] = outline.outlineThickness; }
}
export const POST3D_LIMITS = Object.freeze({maxBloomLevels: 8} as const);
export function createPostProcessSettings3D(): PostProcessSettings3D {
    return {enabled: false, bloom: true, bloomThreshold: 1, bloomKnee: 0.5, bloomIntensity: 0.6, bloomLevels: 5, fxaa: true, saturation: 1, contrast: 1, brightness: 1, vignette: 0,
        ssao: false, ssaoRadius: 0.5, ssaoIntensity: 1, ssaoBias: 0.025, dof: false, dofFocus: 10, dofRange: 3, dofRadius: 6, custom: undefined,
        outlineLayers: 0, outlineColor: [1, 0.6, 0.1], outlineThickness: 2};
}
/** Number of bloom levels that fit the output size. */
export function bloomLevelCount3D(settings: PostProcessSettings3D, width: number, height: number): number {
    if (!settings.bloom || !(settings.bloomIntensity > 0)) return 0;
    const wanted = Math.min(Math.max(Math.floor(settings.bloomLevels) || 1, 1), POST3D_LIMITS.maxBloomLevels);
    let levels = 0, w = width, h = height;
    while (levels < wanted && w >= 4 && h >= 4) { w >>= 1; h >>= 1; levels++; }
    return levels;
}
/** Composite parameters in the order both shader languages read them: two vec4. */
export function writeCompositeParams3D(out: Float32Array, settings: PostProcessSettings3D, levels: number, toneMapping: ToneMapping3D, encode: boolean): void {
    out[0] = levels > 0 ? settings.bloomIntensity / levels : 0;
    out[1] = toneMapping === 'aces' ? 2 : toneMapping === 'reinhard' ? 1 : 0;
    out[2] = encode ? 1 : 0;
    out[3] = Math.min(Math.max(settings.vignette, 0), 1);
    out[4] = Math.max(settings.saturation, 0); out[5] = Math.max(settings.contrast, 0); out[6] = Math.max(settings.brightness, 0); out[7] = 0;
}

export const POST_VERTEX_GLSL_3D = /* glsl */`#version 300 es
out vec2 vUv;
void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    vUv = p;
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const GLSL_HEAD = /* glsl */`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSource;
uniform vec4 uA; // per pass, see below
uniform vec4 uB;
`;
const GLSL_DEPTH = /* glsl */`
uniform highp sampler2D uDepth;
uniform vec4 uProj;        // x, y: reciprocal projection scales; z, w: off-center shift
uniform vec4 uDepthParams; // projection entries [2][2], [2][3], [3][2], [3][3]
uniform vec4 uFlags;       // x: orthographic; y: ambient occlusion on; z, w: texel size
/** Stored depth, 0 at the near plane and 1 at the far plane. */
float rawDepth(vec2 uv) {
    ivec2 size = textureSize(uDepth, 0);
    return texelFetch(uDepth, clamp(ivec2(uv * vec2(size)), ivec2(0), size - 1), 0).r;
}
/** Distance from the camera plane, in world units, for any projection matrix. */
float sceneDepth(vec2 uv) {
    float ndc = rawDepth(uv) * 2.0 - 1.0;
    return (uDepthParams.w * ndc - uDepthParams.z) / (uDepthParams.y * ndc - uDepthParams.x);
}
`;
/** uA: radius, intensity, bias. Writes occlusion (1 = open) to every channel. */
export const POST_SSAO_GLSL_3D = GLSL_HEAD + GLSL_DEPTH + /* glsl */`
vec3 viewPosition(vec2 uv) {
    float d = sceneDepth(uv);
    return vec3((uv * 2.0 - 1.0 + uProj.zw) * uProj.xy * (uFlags.x > 0.5 ? 1.0 : d), -d);
}
void main() {
    vec3 p = viewPosition(vUv);
    // The surface normal comes from neighbouring depths, so no extra buffer is needed.
    vec3 n = normalize(cross(dFdx(p), dFdy(p)));
    float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2831853;
    vec2 radiusUv = uA.x / (uProj.xy * (uFlags.x > 0.5 ? 1.0 : -p.z)) * 0.5;
    float occlusion = 0.0, reach = uA.x * uA.x;
    for (int i = 0; i < 12; i++) {
        float angle = noise + float(i) * 2.399963;
        vec3 v = viewPosition(vUv + vec2(cos(angle), sin(angle)) * ((float(i) + 0.5) / 12.0) * radiusUv) - p;
        float d2 = dot(v, v);
        occlusion += max(dot(n, v) * inversesqrt(d2 + 0.000001) - uA.z, 0.0) / (1.0 + d2 / reach) * step(d2, reach * 4.0);
    }
    float open = clamp(1.0 - uA.y * occlusion / 12.0 * 2.5, 0.0, 1.0);
    // The far plane is sky: never occluded.
    if (rawDepth(vUv) >= 0.99999) open = 1.0;
    outColor = vec4(vec3(open), 1.0);
}`;
/** uA: xy source texel, z threshold, w knee. uB.x: 1 applies the brightness prefilter. */
export const POST_DOWN_GLSL_3D = GLSL_HEAD + /* glsl */`
void main() {
    vec3 c = texture(uSource, vUv).rgb * 4.0;
    c += texture(uSource, vUv + uA.xy).rgb + texture(uSource, vUv - uA.xy).rgb;
    c += texture(uSource, vUv + vec2(uA.x, -uA.y)).rgb + texture(uSource, vUv + vec2(-uA.x, uA.y)).rgb;
    c *= 0.125;
    if (uB.x > 0.5) {
        // Clamp runaway highlights so single pixels cannot flicker across the whole pyramid.
        c = min(c, vec3(64.0));
        float brightness = max(c.r, max(c.g, c.b)), knee = uA.z * uA.w;
        float soft = clamp(brightness - uA.z + knee, 0.0, 2.0 * knee);
        soft = soft * soft / (4.0 * knee + 0.0001);
        c *= max(soft, brightness - uA.z) / max(brightness, 0.0001);
    }
    outColor = vec4(c, 1.0);
}`;
/** uA.xy: source texel. Drawn with additive blending onto the next larger level. */
export const POST_UP_GLSL_3D = GLSL_HEAD + /* glsl */`
void main() {
    vec2 h = uA.xy;
    vec3 c = texture(uSource, vUv + vec2(-2.0 * h.x, 0.0)).rgb + texture(uSource, vUv + vec2(2.0 * h.x, 0.0)).rgb
        + texture(uSource, vUv + vec2(0.0, 2.0 * h.y)).rgb + texture(uSource, vUv + vec2(0.0, -2.0 * h.y)).rgb;
    c += 2.0 * (texture(uSource, vUv + vec2(-h.x, h.y)).rgb + texture(uSource, vUv + vec2(h.x, h.y)).rgb
        + texture(uSource, vUv + vec2(h.x, -h.y)).rgb + texture(uSource, vUv + vec2(-h.x, -h.y)).rgb);
    outColor = vec4(c / 12.0, 1.0);
}`;
/** uA: focus distance, sharp half-range, largest radius in pixels. Blurs by distance from the focused zone. */
export const POST_DOF_GLSL_3D = GLSL_HEAD + GLSL_DEPTH + /* glsl */`
float blurRadius(vec2 uv) { return clamp((abs(sceneDepth(uv) - uA.x) - uA.y) / max(uA.y, 0.001), 0.0, 1.0) * uA.z; }
void main() {
    vec4 center = texture(uSource, vUv);
    float radius = blurRadius(vUv);
    vec3 sum = center.rgb;
    float weight = 1.0;
    // A sharp pixel gathers nothing, so focused objects keep crisp edges against a blurred backdrop.
    if (radius > 0.5) {
        for (int i = 0; i < 16; i++) {
            float angle = float(i) * 2.399963;
            vec2 uv = vUv + vec2(cos(angle), sin(angle)) * sqrt((float(i) + 0.5) / 16.0) * radius * uFlags.zw;
            // Sharp neighbours contribute little, which keeps them from smearing into the blur.
            float w = mix(0.15, 1.0, clamp(blurRadius(uv) / radius, 0.0, 1.0));
            sum += texture(uSource, uv).rgb * w;
            weight += w;
        }
    }
    outColor = vec4(sum / weight, center.a);
}`;
/** uA: bloom scale, tone mapping, sRGB encode, vignette. uB: saturation, contrast, brightness. */
export function postCompositeGlsl3D(customPost?: string): string {
    return GLSL_HEAD.replace('#version 300 es\n', '#version 300 es\n' + (customPost === undefined ? '' : '#define CUSTOM_POST\n')) + GLSL_DEPTH + /* glsl */`
uniform sampler2D uBloom;
uniform sampler2D uAo;
uniform sampler2D uMask;
uniform vec4 uOutline; // rgb and width in pixels; 0 width is off
float maskAt(vec2 uv) { return texture(uMask, uv).r; }
vec3 sceneColor(vec2 uv) { return texture(uSource, uv).rgb; }
#ifdef CUSTOM_POST
uniform vec4 uPostCustom[4];
${customPost ?? ''}
#endif
void main() {
    vec4 scene = texture(uSource, vUv);
    vec3 c = scene.rgb;
    if (uFlags.y > 0.5) {
        // Five taps hide the per-pixel sampling pattern of the occlusion pass.
        vec2 t = uFlags.zw * 1.5;
        c *= 0.2 * (texture(uAo, vUv).r + texture(uAo, vUv + t).r + texture(uAo, vUv - t).r + texture(uAo, vUv + vec2(t.x, -t.y)).r + texture(uAo, vUv + vec2(-t.x, t.y)).r);
    }
    if (uA.x > 0.0) c += texture(uBloom, vUv).rgb * uA.x;
    #ifdef CUSTOM_POST
    c = max(customPost(c, vUv), vec3(0.0));
    #endif
    c *= uB.z;
    if (uA.y > 1.5) c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
    else if (uA.y > 0.5) c = c / (1.0 + c);
    c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, uB.x);
    c = (c - 0.18) * uB.y + 0.18;
    c *= 1.0 - uA.w * smoothstep(0.3, 0.75, distance(vUv, vec2(0.5)));
    c = clamp(c, 0.0, 1.0);
    if (uOutline.w > 0.0) {
        // The outline is where the mask is present nearby but not at this pixel.
        vec2 t = uFlags.zw * uOutline.w, d = t * 0.7071;
        float around = max(max(maskAt(vUv + vec2(t.x, 0.0)), maskAt(vUv - vec2(t.x, 0.0))), max(maskAt(vUv + vec2(0.0, t.y)), maskAt(vUv - vec2(0.0, t.y))));
        around = max(around, max(max(maskAt(vUv + d), maskAt(vUv - d)), max(maskAt(vUv + vec2(d.x, -d.y)), maskAt(vUv + vec2(-d.x, d.y)))));
        c = mix(c, uOutline.rgb, clamp(around - maskAt(vUv), 0.0, 1.0));
    }
    if (uA.z > 0.5) c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
    outColor = vec4(c, scene.a);
}`;
}
/** uA.xy: source texel; uA.z: 1 converts the sRGB-encoded result back to linear for an encoding target. */
export const POST_FXAA_GLSL_3D = GLSL_HEAD + /* glsl */`
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
    vec2 t = uA.xy;
    vec4 middle = texture(uSource, vUv);
    float nw = luma(texture(uSource, vUv + vec2(-t.x, -t.y)).rgb), ne = luma(texture(uSource, vUv + vec2(t.x, -t.y)).rgb);
    float sw = luma(texture(uSource, vUv + vec2(-t.x, t.y)).rgb), se = luma(texture(uSource, vUv + vec2(t.x, t.y)).rgb), m = luma(middle.rgb);
    float low = min(m, min(min(nw, ne), min(sw, se))), high = max(m, max(max(nw, ne), max(sw, se)));
    vec3 result = middle.rgb;
    // Skip flat regions: only edges with visible contrast are filtered.
    if (high - low > max(0.0312, high * 0.125)) {
        vec2 dir = vec2(-((nw + ne) - (sw + se)), (nw + sw) - (ne + se));
        float reduce = max((nw + ne + sw + se) * 0.03125, 0.0078125);
        dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), vec2(-8.0), vec2(8.0)) * t;
        vec3 a = 0.5 * (texture(uSource, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture(uSource, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
        vec3 b = a * 0.5 + 0.25 * (texture(uSource, vUv - dir * 0.5).rgb + texture(uSource, vUv + dir * 0.5).rgb);
        float lb = luma(b);
        result = lb < low || lb > high ? a : b;
    }
    if (uA.z > 0.5) result = mix(result / 12.92, pow((result + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), result));
    outColor = vec4(result, middle.a);
}`;

const WGSL_HEAD = /* wgsl */`
struct Params {
    a: vec4f,
    b: vec4f,
    proj: vec4f,   // x, y: reciprocal projection scales; z, w: off-center shift
    flags: vec4f,  // x: orthographic; y: ambient occlusion on; z, w: texel size
    custom: array<vec4f, 4>,
    outline: vec4f, // rgb and width in pixels; 0 width is off
    depth: vec4f,   // projection entries [2][2], [2][3], [3][2], [3][3]
}
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var source: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;
@group(0) @binding(3) var bloom: texture_2d<f32>;
@group(0) @binding(4) var depthTexture: texture_depth_2d;
@group(0) @binding(5) var aoTexture: texture_2d<f32>;
@group(0) @binding(6) var maskTexture: texture_2d<f32>;
struct VertexOutput { @builtin(position) position: vec4f, @location(0) uv: vec2f }
@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> VertexOutput {
    let p = vec2f(f32((index << 1u) & 2u), f32(index & 2u));
    var output: VertexOutput;
    output.position = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
    // Texture rows run top-down, so V is flipped relative to clip space.
    output.uv = vec2f(p.x, 1.0 - p.y);
    return output;
}
fn tap(uv: vec2f) -> vec3f { return textureSampleLevel(source, linearSampler, uv, 0.0).rgb; }
fn sceneColor(uv: vec2f) -> vec3f { return tap(uv); }
/** Stored depth, 0 at the near plane and 1 at the far plane. */
fn rawDepth(uv: vec2f) -> f32 {
    let size = vec2f(textureDimensions(depthTexture));
    return textureLoad(depthTexture, vec2i(clamp(uv * size, vec2f(0.0), size - 1.0)), 0);
}
/** Distance from the camera plane, in world units, for any projection matrix. */
fn sceneDepth(uv: vec2f) -> f32 {
    let ndc = rawDepth(uv) * 2.0 - 1.0;
    return (params.depth.w * ndc - params.depth.z) / (params.depth.y * ndc - params.depth.x);
}
`;
export const POST_SSAO_WGSL_3D = WGSL_HEAD + /* wgsl */`
fn viewPosition(uv: vec2f) -> vec3f {
    let d = sceneDepth(uv);
    var scale = d;
    if (params.flags.x > 0.5) { scale = 1.0; }
    // UV rows run top-down here, so Y is flipped back to view space.
    return vec3f((uv.x * 2.0 - 1.0 + params.proj.z) * params.proj.x * scale, (1.0 - uv.y * 2.0 + params.proj.w) * params.proj.y * scale, -d);
}
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    let p = viewPosition(input.uv);
    // Framebuffer Y points down, so the Y derivative is negated to keep the normal facing the camera.
    let n = normalize(cross(dpdx(p), -dpdy(p)));
    let noise = fract(52.9829189 * fract(dot(input.position.xy, vec2f(0.06711056, 0.00583715)))) * 6.2831853;
    var scale = -p.z;
    if (params.flags.x > 0.5) { scale = 1.0; }
    let radiusUv = params.a.x / (params.proj.xy * scale) * 0.5;
    let reach = params.a.x * params.a.x;
    var occlusion = 0.0;
    for (var i = 0; i < 12; i++) {
        let angle = noise + f32(i) * 2.399963;
        // The disc is mirrored in Y so both backends sample the same scene points.
        let v = viewPosition(input.uv + vec2f(cos(angle), -sin(angle)) * ((f32(i) + 0.5) / 12.0) * radiusUv) - p;
        let d2 = dot(v, v);
        occlusion += max(dot(n, v) * inverseSqrt(d2 + 0.000001) - params.a.z, 0.0) / (1.0 + d2 / reach) * step(d2, reach * 4.0);
    }
    var open = clamp(1.0 - params.a.y * occlusion / 12.0 * 2.5, 0.0, 1.0);
    if (rawDepth(input.uv) >= 0.99999) { open = 1.0; }
    return vec4f(vec3f(open), 1.0);
}`;
export const POST_DOWN_WGSL_3D = WGSL_HEAD + /* wgsl */`
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    let o = params.a.xy;
    var c = tap(input.uv) * 4.0 + tap(input.uv + o) + tap(input.uv - o) + tap(input.uv + vec2f(o.x, -o.y)) + tap(input.uv + vec2f(-o.x, o.y));
    c *= 0.125;
    if (params.b.x > 0.5) {
        c = min(c, vec3f(64.0));
        let brightness = max(c.r, max(c.g, c.b));
        let knee = params.a.z * params.a.w;
        var soft = clamp(brightness - params.a.z + knee, 0.0, 2.0 * knee);
        soft = soft * soft / (4.0 * knee + 0.0001);
        c *= max(soft, brightness - params.a.z) / max(brightness, 0.0001);
    }
    return vec4f(c, 1.0);
}`;
export const POST_UP_WGSL_3D = WGSL_HEAD + /* wgsl */`
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    let h = params.a.xy;
    let uv = input.uv;
    var c = tap(uv + vec2f(-2.0 * h.x, 0.0)) + tap(uv + vec2f(2.0 * h.x, 0.0)) + tap(uv + vec2f(0.0, 2.0 * h.y)) + tap(uv + vec2f(0.0, -2.0 * h.y));
    c += 2.0 * (tap(uv + vec2f(-h.x, h.y)) + tap(uv + vec2f(h.x, h.y)) + tap(uv + vec2f(h.x, -h.y)) + tap(uv + vec2f(-h.x, -h.y)));
    return vec4f(c / 12.0, 1.0);
}`;
export const POST_DOF_WGSL_3D = WGSL_HEAD + /* wgsl */`
fn blurRadius(uv: vec2f) -> f32 { return clamp((abs(sceneDepth(uv) - params.a.x) - params.a.y) / max(params.a.y, 0.001), 0.0, 1.0) * params.a.z; }
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    let center = textureSampleLevel(source, linearSampler, input.uv, 0.0);
    let radius = blurRadius(input.uv);
    var sum = center.rgb;
    var weight = 1.0;
    // A sharp pixel gathers nothing, so focused objects keep crisp edges against a blurred backdrop.
    if (radius > 0.5) {
        for (var i = 0; i < 16; i++) {
            let angle = f32(i) * 2.399963;
            let uv = input.uv + vec2f(cos(angle), -sin(angle)) * sqrt((f32(i) + 0.5) / 16.0) * radius * params.flags.zw;
            // Sharp neighbours contribute little, which keeps them from smearing into the blur.
            let w = mix(0.15, 1.0, clamp(blurRadius(uv) / radius, 0.0, 1.0));
            sum += tap(uv) * w;
            weight += w;
        }
    }
    return vec4f(sum / weight, center.a);
}`;
export function postCompositeWgsl3D(customPost?: string): string {
    return WGSL_HEAD + (customPost ?? '') + /* wgsl */`
fn occlusionTap(uv: vec2f) -> f32 { return textureSampleLevel(aoTexture, linearSampler, uv, 0.0).r; }
fn maskAt(uv: vec2f) -> f32 { return textureSampleLevel(maskTexture, linearSampler, uv, 0.0).r; }
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    let scene = textureSampleLevel(source, linearSampler, input.uv, 0.0);
    var c = scene.rgb;
    if (params.flags.y > 0.5) {
        // Five taps hide the per-pixel sampling pattern of the occlusion pass.
        let t = params.flags.zw * 1.5;
        c *= 0.2 * (occlusionTap(input.uv) + occlusionTap(input.uv + t) + occlusionTap(input.uv - t) + occlusionTap(input.uv + vec2f(t.x, -t.y)) + occlusionTap(input.uv + vec2f(-t.x, t.y)));
    }
    c += textureSampleLevel(bloom, linearSampler, input.uv, 0.0).rgb * params.a.x;
    ${customPost === undefined ? '' : 'c = max(customPost(c, input.uv), vec3f(0.0));'}
    c *= params.b.z;
    if (params.a.y > 1.5) { c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), vec3f(0.0), vec3f(1.0)); }
    else if (params.a.y > 0.5) { c = c / (1.0 + c); }
    c = mix(vec3f(dot(c, vec3f(0.2126, 0.7152, 0.0722))), c, params.b.x);
    c = (c - 0.18) * params.b.y + 0.18;
    c *= 1.0 - params.a.w * smoothstep(0.3, 0.75, distance(input.uv, vec2f(0.5)));
    c = clamp(c, vec3f(0.0), vec3f(1.0));
    if (params.outline.w > 0.0) {
        // The outline is where the mask is present nearby but not at this pixel.
        let t = params.flags.zw * params.outline.w;
        let d = t * 0.7071;
        let uv = input.uv;
        var around = max(max(maskAt(uv + vec2f(t.x, 0.0)), maskAt(uv - vec2f(t.x, 0.0))), max(maskAt(uv + vec2f(0.0, t.y)), maskAt(uv - vec2f(0.0, t.y))));
        around = max(around, max(max(maskAt(uv + d), maskAt(uv - d)), max(maskAt(uv + vec2f(d.x, -d.y)), maskAt(uv + vec2f(-d.x, d.y)))));
        c = mix(c, params.outline.rgb, clamp(around - maskAt(uv), 0.0, 1.0));
    }
    if (params.a.z > 0.5) { c = mix(c * 12.92, 1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055, step(vec3f(0.0031308), c)); }
    return vec4f(c, scene.a);
}`;
}
export const POST_FXAA_WGSL_3D = WGSL_HEAD + /* wgsl */`
fn luma(c: vec3f) -> f32 { return dot(c, vec3f(0.299, 0.587, 0.114)); }
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    let t = params.a.xy;
    let uv = input.uv;
    let middle = textureSampleLevel(source, linearSampler, uv, 0.0);
    let nw = luma(tap(uv + vec2f(-t.x, -t.y)));
    let ne = luma(tap(uv + vec2f(t.x, -t.y)));
    let sw = luma(tap(uv + vec2f(-t.x, t.y)));
    let se = luma(tap(uv + vec2f(t.x, t.y)));
    let m = luma(middle.rgb);
    let low = min(m, min(min(nw, ne), min(sw, se)));
    let high = max(m, max(max(nw, ne), max(sw, se)));
    var result = middle.rgb;
    if (high - low > max(0.0312, high * 0.125)) {
        var dir = vec2f(-((nw + ne) - (sw + se)), (nw + sw) - (ne + se));
        let reduce = max((nw + ne + sw + se) * 0.03125, 0.0078125);
        dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), vec2f(-8.0), vec2f(8.0)) * t;
        let a = 0.5 * (tap(uv + dir * (1.0 / 3.0 - 0.5)) + tap(uv + dir * (2.0 / 3.0 - 0.5)));
        let b = a * 0.5 + 0.25 * (tap(uv - dir * 0.5) + tap(uv + dir * 0.5));
        let lb = luma(b);
        if (lb < low || lb > high) { result = a; } else { result = b; }
    }
    if (params.a.z > 0.5) { result = mix(result / 12.92, pow((result + 0.055) / 1.055, vec3f(2.4)), step(vec3f(0.04045), result)); }
    return vec4f(result, middle.a);
}`;
