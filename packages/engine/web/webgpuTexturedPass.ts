const SHADER = `
struct DrawUniform { opacity: f32, padding0: f32, padding1: f32, padding2: f32, }
@group(0) @binding(0) var image: texture_2d<f32>;
@group(0) @binding(1) var imageSampler: sampler;
@group(0) @binding(2) var<uniform> draw: DrawUniform;
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) light: vec4<f32>,
}
@vertex fn vertexMain(@location(0) position: vec2<f32>, @location(1) uv: vec2<f32>, @location(2) light: vec4<f32>) -> VertexOutput {
    var out: VertexOutput;
    out.position = vec4<f32>(position, 0.0, 1.0); out.uv = uv; out.light = light; return out;
}
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let sampled = textureSampleLevel(image, imageSampler, input.uv, 0.0);
    return vec4<f32>(sampled.rgb * input.light.rgb * input.light.a * draw.opacity, sampled.a * input.light.a * draw.opacity);
}
`;

/** First-party XY/UV/straight-light ABI; the sole host owns scopes, methods and resources. */
export function createWebGPUTexturedPipeline(shader: (descriptor: GPUShaderModuleDescriptor) => GPUShaderModule,
    pipeline: (descriptor: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>, format: 'rgba8unorm' | 'bgra8unorm'): Promise<GPURenderPipeline> {
    // Crop bytes already contain encoded premultiplied RGB. Apply light alpha and opacity once.
    // All vertex positions have w=1, so the default interpolation is affine in this 2D pass.
    const module = shader({ code: SHADER });
    const blend: GPUBlendComponent = { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' };
    return pipeline({ layout: 'auto', vertex: { module, entryPoint: 'vertexMain', buffers: [{ arrayStride: 32, attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x2' }, { shaderLocation: 1, offset: 8, format: 'float32x2' },
        { shaderLocation: 2, offset: 16, format: 'float32x4' },
    ] }] }, fragment: { module, entryPoint: 'fragmentMain', targets: [{ format, blend: { color: blend, alpha: blend }, writeMask: 15 }] },
        primitive: { topology: 'triangle-list', cullMode: 'none' }, multisample: { count: 1, alphaToCoverageEnabled: false } });
}
