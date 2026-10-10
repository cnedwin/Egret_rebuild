const SHADER = `
struct DrawUniform { opacity: f32, padding0: f32, padding1: f32, padding2: f32, }
@group(0) @binding(0) var image: texture_2d<f32>;
@group(0) @binding(1) var imageSampler: sampler;
@group(0) @binding(2) var<uniform> draw: DrawUniform;
struct VertexOutput { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32>, }
@vertex fn vertexMain(@location(0) position: vec2<f32>, @location(1) uv: vec2<f32>) -> VertexOutput {
    var out: VertexOutput; out.position = vec4<f32>(position, 0.0, 1.0); out.uv = uv; return out;
}
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    return textureSampleLevel(image, imageSampler, input.uv, 0.0) * draw.opacity;
}
`;

/** Host supplies captured methods, lifecycle gates and surrounding validation scopes. */
export function createWebGPUImagePipeline(shader: (descriptor: GPUShaderModuleDescriptor) => GPUShaderModule, pipeline: (descriptor: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>, format: 'rgba8unorm' | 'bgra8unorm'): Promise<GPURenderPipeline> {
    // Encoded-premultiplied crop bytes are sampled at mip0; inherited opacity is applied once.
    // Each draw supplies its own 16-byte uniform through binding2, even for a shared view.
    // The host owns nearest/clamp sampler creation and actual allocation/device admission.
    const module = shader({ code: SHADER });
    const blend: GPUBlendComponent = { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' };
    return pipeline({ layout: 'auto', vertex: { module, entryPoint: 'vertexMain', buffers: [{ arrayStride: 16, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }, { shaderLocation: 1, offset: 8, format: 'float32x2' }] }] }, fragment: { module, entryPoint: 'fragmentMain', targets: [{ format, blend: { color: blend, alpha: blend }, writeMask: 15 }] }, primitive: { topology: 'triangle-list', cullMode: 'none' }, multisample: { count: 1, alphaToCoverageEnabled: false } });
}

/** Encode one supplied draw; the host retains pass end, resources and settlement authority. */
export function encodeWebGPUImage(pass: GPURenderPassEncoder, pipeline: GPURenderPipeline, vertices: GPUBuffer, bindings: GPUBindGroup, vertexCount: number, width: number, height: number): void {
    // Represented fan collapse needs neither an upload nor any pass method call.
    if (vertexCount === 0) return;
    pass.setPipeline(pipeline); pass.setViewport(0, 0, width, height, 0, 1); pass.setScissorRect(0, 0, width, height);
    pass.setVertexBuffer(0, vertices); pass.setBindGroup(0, bindings); pass.draw(vertexCount, 1, 0, 0);
}
