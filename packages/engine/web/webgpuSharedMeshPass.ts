// One 64-byte column-major MVP transforms homogeneous positions without division
// or Y negation. RGB is already decoded linear float32 data; the fragment is opaque.
// The sRGB working attachment encodes storage after interpolation.
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
export function createSharedWebGPUMeshPipeline(
    shader: (descriptor: GPUShaderModuleDescriptor) => GPUShaderModule,
    pipeline: (descriptor: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>,
    format: 'rgba8unorm-srgb',
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
export function encodeSharedWebGPUMesh(
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

// Cards sample canonical linear-PMA texels from the same sRGB pages as the HUD.
// Accepted fragments are opaque so depth and color have identical coverage.
const CARD_SHADER = `struct CardUniform {
    mvp: mat4x4<f32>,
    bounds: vec4<f32>,
    region: vec4<f32>,
    params: vec4<f32>,
}
@group(0) @binding(0) var<uniform> card: CardUniform;
@group(0) @binding(1) var page: texture_2d<f32>;

const corners = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0), vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 1.0),
);
struct CardVertexOutput {
    @builtin(position) clip: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> CardVertexOutput {
    let corner = corners[index];
    var result: CardVertexOutput;
    // Select exact endpoints; an admitted pair need not have a finite f32 span.
    let xy = vec2<f32>(select(card.bounds.x, card.bounds.z, corner.x == 1.0),
        select(card.bounds.w, card.bounds.y, corner.y == 1.0));
    result.clip = card.mvp * vec4<f32>(xy, 0.0, 1.0);
    result.uv = corner;
    return result;
}

@fragment fn fragmentMain(input: CardVertexOutput) -> @location(0) vec4<f32> {
    let edge = vec2<i32>(card.region.zw) - vec2<i32>(1);
    let offset = clamp(vec2<i32>(floor(input.uv * card.region.zw)), vec2<i32>(0), edge);
    let texel = textureLoad(page, vec2<i32>(card.region.xy) + offset, 0);
    if (round(texel.a * 255.0) < round(card.params.x * 255.0)) { discard; }
    return vec4<f32>(clamp(texel.rgb / texel.a, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`;

/** Private cutout pass on the shared scene's existing color and reversed-depth targets. */
export function createSharedWebGPUCardPipeline(
    shader: Parameters<typeof createSharedWebGPUMeshPipeline>[0],
    pipeline: Parameters<typeof createSharedWebGPUMeshPipeline>[1],
): ReturnType<typeof createSharedWebGPUMeshPipeline> {
    const module = shader({ code: CARD_SHADER });
    return pipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vertexMain' },
        fragment: { module, entryPoint: 'fragmentMain', targets: [{ format: 'rgba8unorm-srgb', writeMask: 15 }] },
        primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'none', unclippedDepth: false },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater', depthBias: 0, depthBiasSlopeScale: 0, depthBiasClamp: 0 },
        multisample: { count: 1, alphaToCoverageEnabled: false },
    });
}

// The page's sRGB view decodes the opaque base-color texel to linear RGB.
// UVs are perspective-correct and top-left, with nearest sampling clamped to the page.
const TEXTURED_MESH_SHADER = `struct MeshUniform {
    mvp: mat4x4<f32>,
}
@group(0) @binding(0) var<uniform> draw: MeshUniform;
@group(0) @binding(1) var page: texture_2d<f32>;

struct MeshVertexOutput {
    @builtin(position) clip: vec4<f32>,
    @location(0) rgb: vec3<f32>,
    @location(1) uv: vec2<f32>,
}

@vertex fn vertexMain(
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
    @location(2) uv: vec2<f32>,
) -> MeshVertexOutput {
    var result: MeshVertexOutput;
    result.clip = draw.mvp * vec4<f32>(position, 1.0);
    result.rgb = color;
    result.uv = uv;
    return result;
}

@fragment fn fragmentMain(input: MeshVertexOutput) -> @location(0) vec4<f32> {
    let size = textureDimensions(page, 0);
    let uv = clamp(input.uv, vec2<f32>(0.0), vec2<f32>(1.0));
    let coordinate = min(vec2<u32>(floor(uv * vec2<f32>(size))), size - vec2<u32>(1));
    let texel = textureLoad(page, vec2<i32>(coordinate), 0);
    return vec4<f32>(input.rgb * texel.rgb, 1.0);
}
`;

/** Private authored textured meshes share the same opaque reversed-depth pass as untextured meshes. */
export function createSharedWebGPUTexturedMeshPipeline(
    shader: Parameters<typeof createSharedWebGPUMeshPipeline>[0],
    pipeline: Parameters<typeof createSharedWebGPUMeshPipeline>[1],
): ReturnType<typeof createSharedWebGPUMeshPipeline> {
    const module = shader({ code: TEXTURED_MESH_SHADER });
    return pipeline({
        layout: 'auto',
        vertex: {
            module, entryPoint: 'vertexMain',
            buffers: [{ arrayStride: 32, stepMode: 'vertex', attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x3' },
                { shaderLocation: 1, offset: 12, format: 'float32x3' },
                { shaderLocation: 2, offset: 24, format: 'float32x2' },
            ] }],
        },
        fragment: { module, entryPoint: 'fragmentMain', targets: [{ format: 'rgba8unorm-srgb', writeMask: 15 }] },
        primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'none', unclippedDepth: false },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater', depthBias: 0, depthBiasSlopeScale: 0, depthBiasClamp: 0 },
        multisample: { count: 1, alphaToCoverageEnabled: false },
    });
}

// The shared color page decodes opaque sRGB texels before applying linear light.
const LAMBERT_MESH_SHADER = `struct LambertUniform {
    mvp: mat4x4<f32>,
    normalColumn0: vec4<f32>,
    normalColumn1: vec4<f32>,
    normalColumn2: vec4<f32>,
    light: vec4<f32>,
}
@group(0) @binding(0) var<uniform> draw: LambertUniform;
@group(0) @binding(1) var page: texture_2d<f32>;

struct LambertVertexOutput {
    @builtin(position) clip: vec4<f32>,
    @location(0) rgb: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) normal: vec3<f32>,
}

@vertex fn vertexMain(
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
    @location(2) uv: vec2<f32>,
    @location(3) normal: vec3<f32>,
) -> LambertVertexOutput {
    var result: LambertVertexOutput;
    result.clip = draw.mvp * vec4<f32>(position, 1.0);
    result.rgb = color;
    result.uv = uv;
    result.normal = mat3x3<f32>(draw.normalColumn0.xyz, draw.normalColumn1.xyz, draw.normalColumn2.xyz) * normal;
    return result;
}

@fragment fn fragmentMain(input: LambertVertexOutput, @builtin(front_facing) front: bool) -> @location(0) vec4<f32> {
    let size = textureDimensions(page, 0);
    let uv = clamp(input.uv, vec2<f32>(0.0), vec2<f32>(1.0));
    let coordinate = min(vec2<u32>(floor(uv * vec2<f32>(size))), size - vec2<u32>(1));
    let texel = textureLoad(page, vec2<i32>(coordinate), 0);
    // Scale before normalization to avoid a near-cancelled normal squaring to zero.
    let magnitude = max(max(abs(input.normal.x), abs(input.normal.y)), abs(input.normal.z));
    var diffuse = 0.0;
    if (magnitude >= 1.17549435e-38) {
        let normal = normalize(input.normal / magnitude);
        let authoredFront = front != (draw.normalColumn1.w < 0.0);
        diffuse = max(0.0, dot(select(-normal, normal, authoredFront), draw.light.xyz));
    }
    let amount = draw.normalColumn0.w + draw.light.w * diffuse;
    return vec4<f32>(input.rgb * texel.rgb * amount, 1.0);
}
`;

/** Private Lambert role on the existing opaque reversed-depth scene attachment. */
export function createSharedWebGPULambertMeshPipeline(
    shader: Parameters<typeof createSharedWebGPUMeshPipeline>[0],
    pipeline: Parameters<typeof createSharedWebGPUMeshPipeline>[1],
): ReturnType<typeof createSharedWebGPUMeshPipeline> {
    const module = shader({ code: LAMBERT_MESH_SHADER });
    return pipeline({
        layout: 'auto',
        vertex: {
            module, entryPoint: 'vertexMain',
            buffers: [{ arrayStride: 44, stepMode: 'vertex', attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x3' },
                { shaderLocation: 1, offset: 12, format: 'float32x3' },
                { shaderLocation: 2, offset: 24, format: 'float32x2' },
                { shaderLocation: 3, offset: 32, format: 'float32x3' },
            ] }],
        },
        fragment: { module, entryPoint: 'fragmentMain', targets: [{ format: 'rgba8unorm-srgb', writeMask: 15 }] },
        primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'none', unclippedDepth: false },
        depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater', depthBias: 0, depthBiasSlopeScale: 0, depthBiasClamp: 0 },
        multisample: { count: 1, alphaToCoverageEnabled: false },
    });
}
