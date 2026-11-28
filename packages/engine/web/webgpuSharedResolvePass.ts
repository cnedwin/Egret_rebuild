/** Integer target loads and one explicit output transfer; the canvas view is ordinary UNORM. */
export function createSharedResolvePipeline(
  shader: (d: GPUShaderModuleDescriptor) => GPUShaderModule,
  pipeline: (d: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>,
  format: 'rgba8unorm' | 'bgra8unorm',
  opaque: boolean,
  srgb = false
): Promise<GPURenderPipeline> {
  const module = shader({
    code:
      `@group(0) @binding(0) var workingTexture: texture_2d<f32>;
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
    ` +
      // A target that mixes codes already holds the canvas's codes.
      (srgb
        ? opaque
          ? 'return vec4<f32>(clamp(value.rgb, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);'
          : 'if (a == 0.0) { return vec4<f32>(0.0); } return vec4<f32>(c, a);'
        : opaque
          ? 'return vec4<f32>(encoded(clamp(value.rgb, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);'
          : 'if (a == 0.0) { return vec4<f32>(0.0); } return vec4<f32>(a * encoded(c / a), a);') +
      '\n}'
  });
  return pipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vertexMain' },
    fragment: { module, entryPoint: 'fragmentMain', targets: [{ format, writeMask: 15 }] },
    primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'none' },
    multisample: { count: 1, alphaToCoverageEnabled: false }
  });
}
/** The bytes of a placement's block: origin and extent, viewport and effect minimum, effect maximum, multiply and add. */
export const SHARED_LAYER_UNIFORM_BYTES = 80;
/**
 * A kept layer drawn into the working target at its placement: six corners, its texels sampled nearest and laid
 * source-over in premultiplied alpha. With an effect, a pixel whose centre lies in the effect's bounds takes
 * `min(rgb × multiply + alpha × add, alpha)` and keeps its alpha.
 */
export function createSharedWebGPULayerPipeline(
  shader: (d: GPUShaderModuleDescriptor) => GPUShaderModule,
  pipeline: (d: GPURenderPipelineDescriptor) => Promise<GPURenderPipeline>,
  effect: boolean,
  srgb = false
): Promise<GPURenderPipeline> {
  const module = shader({
    code:
      `struct Layer { place: vec4<f32>, view: vec4<f32>, bound: vec4<f32>, scale: vec4<f32>, add: vec4<f32> }
@group(0) @binding(0) var<uniform> layer: Layer;
@group(0) @binding(1) var layerTexture: texture_2d<f32>;
@group(0) @binding(2) var layerSampler: sampler;
struct Corner { @builtin(position) position: vec4<f32>, @location(0) uv: vec2<f32> }
@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> Corner {
    let corners = array<vec2<f32>, 6>(vec2<f32>(0.0, 0.0), vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0),
        vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 1.0));
    let corner = corners[index];
    let p = (layer.place.xy + layer.place.zw * corner) / layer.view.xy;
    var out: Corner;
    out.position = vec4<f32>(2.0 * p.x - 1.0, 1.0 - 2.0 * p.y, 0.0, 1.0);
    // Row zero of a WebGPU target is its top, so the top of the placement samples the top of the layer.
    out.uv = corner;
    return out;
}
@fragment fn fragmentMain(input: Corner) -> @location(0) vec4<f32> {
    var color = textureSample(layerTexture, layerSampler, input.uv);
` +
      (effect
        ? `    let center = input.position.xy;
    if (all(center >= layer.view.zw) && all(center < layer.bound.xy)) {
        // Add light in premultiplied space and keep coverage.
        color = vec4<f32>(min(color.rgb * layer.scale.rgb + color.a * layer.add.rgb, vec3<f32>(color.a)), color.a);
    }
`
        : '') +
      `    return color;
}
`
  });
  const over: GPUBlendComponent = { operation: 'add', srcFactor: 'one', dstFactor: 'one-minus-src-alpha' };
  return pipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vertexMain' },
    fragment: {
      module,
      entryPoint: 'fragmentMain',
      targets: [{ format: srgb ? 'rgba8unorm' : 'rgba8unorm-srgb', writeMask: 15, blend: { color: over, alpha: over } }]
    },
    primitive: { topology: 'triangle-list', frontFace: 'ccw', cullMode: 'none' },
    multisample: { count: 1, alphaToCoverageEnabled: false }
  });
}
