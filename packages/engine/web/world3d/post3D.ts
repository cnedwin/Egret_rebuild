// SPDX-License-Identifier: Apache-2.0
// Post-processing shared by both world3d backends: the settings object and
// the full-screen shaders in GLSL ES 3.00 and WGSL. The chain is
//   scene (half-float, linear) -> bloom pyramid -> composite (tone map, grade)
//   -> optional FXAA -> canvas or target.
// Bloom uses a dual-filter pyramid: each level is one 5-tap downsample and
// one 8-tap upsample, which is cheap enough for integrated and mobile GPUs.
import type {ToneMapping3D} from './frame3D.js';

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
}
export const POST3D_LIMITS = Object.freeze({maxBloomLevels: 8} as const);
export function createPostProcessSettings3D(): PostProcessSettings3D {
    return {enabled: false, bloom: true, bloomThreshold: 1, bloomKnee: 0.5, bloomIntensity: 0.6, bloomLevels: 5, fxaa: true, saturation: 1, contrast: 1, brightness: 1, vignette: 0};
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
/** uA: bloom scale, tone mapping, sRGB encode, vignette. uB: saturation, contrast, brightness. */
export const POST_COMPOSITE_GLSL_3D = GLSL_HEAD + /* glsl */`
uniform sampler2D uBloom;
void main() {
    vec4 scene = texture(uSource, vUv);
    vec3 c = scene.rgb;
    if (uA.x > 0.0) c += texture(uBloom, vUv).rgb * uA.x;
    c *= uB.z;
    if (uA.y > 1.5) c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
    else if (uA.y > 0.5) c = c / (1.0 + c);
    c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, uB.x);
    c = (c - 0.18) * uB.y + 0.18;
    c *= 1.0 - uA.w * smoothstep(0.3, 0.75, distance(vUv, vec2(0.5)));
    c = clamp(c, 0.0, 1.0);
    if (uA.z > 0.5) c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
    outColor = vec4(c, scene.a);
}`;
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
struct Params { a: vec4f, b: vec4f }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var source: texture_2d<f32>;
@group(0) @binding(2) var linearSampler: sampler;
@group(0) @binding(3) var bloom: texture_2d<f32>;
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
`;
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
export const POST_COMPOSITE_WGSL_3D = WGSL_HEAD + /* wgsl */`
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    let scene = textureSampleLevel(source, linearSampler, input.uv, 0.0);
    var c = scene.rgb + textureSampleLevel(bloom, linearSampler, input.uv, 0.0).rgb * params.a.x;
    c *= params.b.z;
    if (params.a.y > 1.5) { c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), vec3f(0.0), vec3f(1.0)); }
    else if (params.a.y > 0.5) { c = c / (1.0 + c); }
    c = mix(vec3f(dot(c, vec3f(0.2126, 0.7152, 0.0722))), c, params.b.x);
    c = (c - 0.18) * params.b.y + 0.18;
    c *= 1.0 - params.a.w * smoothstep(0.3, 0.75, distance(input.uv, vec2f(0.5)));
    c = clamp(c, vec3f(0.0), vec3f(1.0));
    if (params.a.z > 0.5) { c = mix(c * 12.92, 1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055, step(vec3f(0.0031308), c)); }
    return vec4f(c, scene.a);
}`;
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
