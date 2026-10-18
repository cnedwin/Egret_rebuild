/** Integer target loads and one explicit output transfer; the canvas view is ordinary UNORM. */
export function createSharedResolvePipeline(shader: (d: GPUShaderModuleDescriptor) => GPUShaderModule,
    pipeline: (d: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>, format: 'rgba8unorm' | 'bgra8unorm', opaque: boolean): Promise<GPURenderPipeline> {
    const module = shader({ code: `@group(0) @binding(0) var workingTexture: texture_2d<f32>;
fn encoded(c: vec3<f32>) -> vec3<f32> {
    return select(12.92 * c, 1.055 * pow(c, vec3<f32>(1.0 / 2.4)) - vec3<f32>(0.055), c > vec3<f32>(0.0031308));
}
@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4<f32> {
    let positions = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
    return vec4<f32>(positions[index], 0.0, 1.0);
}
@fragment fn fragmentMain(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
    let value = textureLoad(workingTexture, vec2<i32>(position.xy), 0);
    let a = clamp(value.a, 0.0, 1.0); let c = clamp(value.rgb, vec3<f32>(0.0), vec3<f32>(a));
    ` + (opaque ? 'return vec4<f32>(encoded(clamp(value.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);' :
        'if (a == 0.0) { return vec4<f32>(0.0); } return vec4<f32>(a * encoded(c / a), a);') + '\n}' });
    return pipeline({ layout: 'auto', vertex: { module, entryPoint: 'vertexMain' }, fragment: { module, entryPoint: 'fragmentMain', targets: [{ format, writeMask: 15 }] },
        primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'none' }, multisample: { count: 1, alphaToCoverageEnabled: false } });
}
