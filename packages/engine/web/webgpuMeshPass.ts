// One 64-byte column-major MVP transforms homogeneous positions without division
// or Y negation. RGB is encoded float32 data; the fragment is opaque, without
// gamma conversion, premultiplication or blending. Native validation is separate.
const MESH_SHADER = `struct MeshUniform {
    mvp: mat4x4<f32>,
}
@group(0) @binding(0) var<uniform> draw: MeshUniform;

struct MeshVertexOutput {
    @builtin(position) clip: vec4<f32>,
    @location(0) rgb: vec3<f32>,
}

@vertex fn vertexMain(
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
) -> MeshVertexOutput {
    var result: MeshVertexOutput;
    result.clip = draw.mvp * vec4<f32>(position, 1.0);
    result.rgb = color;
    return result;
}

@fragment fn fragmentMain(input: MeshVertexOutput) -> @location(0) vec4<f32> {
    return vec4<f32>(input.rgb, 1.0);
}
`;

/** The host supplies captured operations and owns scopes, gates and immediate Promise observation. */
export function createWebGPUMeshPipeline(
    shader: (descriptor: GPUShaderModuleDescriptor) => GPUShaderModule,
    pipeline: (descriptor: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>,
    format: 'rgba8unorm' | 'bgra8unorm',
): Promise<GPURenderPipeline> {
    const module = shader({ code: MESH_SHADER });
    // Preserve the callback's Promise and synchronous faults; the host observes settlement.
    // Reverse depth uses greater/write with zero bias; the host supplies clear depth zero.
    return pipeline({
        layout: 'auto',
        vertex: {
            module, entryPoint: 'vertexMain',
            buffers: [{ arrayStride: 24, stepMode: 'vertex', attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x3' },
                { shaderLocation: 1, offset: 12, format: 'float32x3' },
            ] }],
        },
        fragment: { module, entryPoint: 'fragmentMain', targets: [{ format, writeMask: 15 }] },
        primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'none', unclippedDepth: false },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater', depthBias: 0, depthBiasSlopeScale: 0, depthBiasClamp: 0 },
        multisample: { count: 1, alphaToCoverageEnabled: false },
    });
}

/** Encode supplied resources only; the host owns admission, allocation, pass end and submission. */
export function encodeWebGPUMesh(
    pass: GPURenderPassEncoder, pipeline: GPURenderPipeline,
    vertices: GPUBuffer, indices: GPUBuffer, bindings: GPUBindGroup,
    indexCount: number, width: number, height: number,
): void {
    // An empty draw must not read any pass property, including state-setting methods.
    if (indexCount === 0) return;
    pass.setPipeline(pipeline);
    pass.setViewport(0, 0, width, height, 0, 1);
    pass.setScissorRect(0, 0, width, height);
    pass.setVertexBuffer(0, vertices);
    pass.setIndexBuffer(indices, 'uint32');
    pass.setBindGroup(0, bindings);
    pass.drawIndexed(indexCount, 1, 0, 0, 0);
}
