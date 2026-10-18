import type { SharedMaterial2D } from '@egret/contracts';
export const SHARED_BLENDS = ['normal', 'add-accumulate', 'add-preserve', 'multiply-factor', 'screen'] as const;
const HEADER = `struct DrawUniform {
    viewportOpacity: vec4<f32>, materialLight: vec4<f32>, materialDark: vec4<f32>,
    logicalTrim: vec4<u32>, contentOrigin: vec4<u32>, packedTurnDomain: vec4<u32>,
    samplerPolicy: vec4<u32>, pageExecution: vec4<u32>,
}
@group(0) @binding(0) var<uniform> draw: DrawUniform;
struct VertexOutput {
    @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32>,
    @location(1) light: vec4<f32>, @location(2) dark: vec3<f32>,
}
@vertex fn vertexMain(@location(0) position: vec2<f32>, @location(1) uv: vec2<f32>,
    @location(2) light: vec4<f32>, @location(3) dark: vec3<f32>) -> VertexOutput {
    var result: VertexOutput;
    result.position = vec4<f32>(2.0 * position.x / draw.viewportOpacity.x - 1.0,
        1.0 - 2.0 * position.y / draw.viewportOpacity.y, 0.0, 1.0);
    result.uv = uv; result.light = light; result.dark = dark; return result;
}
fn tint(value: vec4<f32>, input: VertexOutput) -> vec4<f32> {
    let a = clamp(value.a, 0.0, 1.0);
    // A numerical guard after native sampling, not a per-tap recipe change.
    let p = clamp(value.rgb, vec3<f32>(0.0), vec3<f32>(a));
    let v = p * input.light.rgb + (vec3<f32>(a) - p) * input.dark;
    let factor = draw.viewportOpacity.z * input.light.a * draw.materialLight.a;
    return vec4<f32>(factor * (v * draw.materialLight.rgb + (vec3<f32>(a) - v) * draw.materialDark.rgb), factor * a);
}
`;
const SAMPLED = `@group(0) @binding(1) var page: texture_2d<f32>;
@group(0) @binding(2) var pageSampler: sampler;
fn addressed(value: i32, extent: i32, mode: u32) -> i32 {
    if (mode == 0u) { return clamp(value, 0, extent - 1); }
    if (mode == 1u) { return ((value % extent) + extent) % extent; }
    let period = 2 * extent; let index = ((value % period) + period) % period;
    return select(index, period - 1 - index, index >= extent);
}
fn regionTap(logical: vec2<i32>) -> vec4<f32> {
    let index = clamp(logical, vec2<i32>(0), vec2<i32>(draw.logicalTrim.xy) - vec2<i32>(1));
    let local = index - vec2<i32>(draw.logicalTrim.zw);
    let size = vec2<i32>(draw.contentOrigin.xy);
    if (any(local < vec2<i32>(0)) || any(local >= size)) { return vec4<f32>(0.0); }
    var packed = local;
    switch draw.packedTurnDomain.z {
        case 1u: { packed = vec2<i32>(size.y - 1 - local.y, local.x); }
        case 2u: { packed = size - vec2<i32>(1) - local; }
        case 3u: { packed = vec2<i32>(local.y, size.x - 1 - local.x); }
        default: {}
    }
    return textureLoad(page, vec2<i32>(draw.contentOrigin.zw) + packed, 0);
}
fn sampled(uv: vec2<f32>) -> vec4<f32> {
    let pageSize = vec2<f32>(draw.pageExecution.xy);
    if (draw.packedTurnDomain.w == 1u) {
        if (draw.samplerPolicy.z == 1u) { return textureSampleLevel(page, pageSampler, uv, 0.0); }
        let q = uv * pageSize;
        let index = vec2<i32>(floor(q));
        return textureLoad(page, vec2<i32>(addressed(index.x, i32(draw.pageExecution.x), draw.samplerPolicy.x),
            addressed(index.y, i32(draw.pageExecution.y), draw.samplerPolicy.y)), 0);
    }
    let extent = vec2<f32>(draw.logicalTrim.xy);
    // Clamp only after fragment interpolation, before any integer conversion.
    let q = clamp(uv * extent, vec2<f32>(0.0), extent);
    if (draw.samplerPolicy.z == 0u) { return regionTap(vec2<i32>(floor(q))); }
    if (draw.samplerPolicy.w == 1u) {
        let shifted = q - vec2<f32>(0.5); let base = vec2<i32>(floor(shifted)); let w = fract(shifted);
        return mix(mix(regionTap(base), regionTap(base + vec2<i32>(1, 0)), w.x),
            mix(regionTap(base + vec2<i32>(0, 1)), regionTap(base + vec2<i32>(1, 1)), w.x), w.y);
    }
    let r = clamp(q, vec2<f32>(0.5), extent - vec2<f32>(0.5));
    let trim = vec2<f32>(draw.logicalTrim.zw); let size = vec2<f32>(draw.contentOrigin.xy);
    let c = clamp(r, trim + vec2<f32>(0.5), trim + size - vec2<f32>(0.5));
    let coverage = min(vec2<f32>(1.0), min(max(vec2<f32>(0.0), r - trim + vec2<f32>(0.5)),
        max(vec2<f32>(0.0), trim + size + vec2<f32>(0.5) - r)));
    let local = c - trim; var packed = local;
    switch draw.packedTurnDomain.z {
        case 1u: { packed = vec2<f32>(size.y - local.y, local.x); }
        case 2u: { packed = size - local; }
        case 3u: { packed = vec2<f32>(local.y, size.x - local.x); }
        default: {}
    }
    return textureSampleLevel(page, pageSampler, (vec2<f32>(draw.contentOrigin.zw) + packed) / pageSize, 0.0)
        * (coverage.x * coverage.y);
}
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> { return tint(sampled(input.uv), input); }
`;
function blendState(blend: SharedMaterial2D['blend']): GPUBlendState {
    const alpha: GPUBlendComponent = { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' };
    if (blend === 'add-accumulate') return { color: { operation: 'add', srcFactor: 'one', dstFactor: 'one' }, alpha: { operation: 'add', srcFactor: 'one', dstFactor: 'one' } };
    if (blend === 'add-preserve') return { color: { operation: 'add', srcFactor: 'one', dstFactor: 'one' }, alpha: { operation: 'add', srcFactor: 'zero', dstFactor: 'one' } };
    return { color: { operation: 'add', srcFactor: blend === 'multiply-factor' ? 'dst' : 'one',
        dstFactor: blend === 'screen' ? 'one-minus-src' : 'one-minus-src-alpha' }, alpha };
}
/** All shaders and promises are immediately owned by the Host's captured startup boundaries. */
export function createSharedWebGPUPipeline(shader: (d: GPUShaderModuleDescriptor) => GPUShaderModule,
    pipeline: (d: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>, sampled: boolean, blend: SharedMaterial2D['blend']): Promise<GPURenderPipeline> {
    const module = shader({ code: HEADER + (sampled ? SAMPLED : '@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> { return tint(vec4<f32>(1.0), input); }') });
    return pipeline({ layout: 'auto', vertex: { module, entryPoint: 'vertexMain', buffers: [{ arrayStride: 44, stepMode: 'vertex', attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x2' }, { shaderLocation: 1, offset: 8, format: 'float32x2' },
        { shaderLocation: 2, offset: 16, format: 'float32x4' }, { shaderLocation: 3, offset: 32, format: 'float32x3' },
    ] }] }, fragment: { module, entryPoint: 'fragmentMain', targets: [{ format: 'rgba8unorm-srgb', writeMask: 15, blend: blendState(blend) }] },
    primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'none', unclippedDepth: false }, multisample: { count: 1, alphaToCoverageEnabled: false } });
}
