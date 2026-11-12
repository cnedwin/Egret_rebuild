// SPDX-License-Identifier: Apache-2.0
// First-party WGSL shader library for the WebGPU world3d renderer. WGSL has
// no preprocessor, so each material variant is assembled from feature flags.
// The lighting model mirrors the GLSL library in shaders3D.ts.

export interface ShaderFeatures3D {
    readonly shading: 'unlit' | 'lambert' | 'phong' | 'standard';
    readonly depthOnly: boolean;
    readonly normal: boolean;
    readonly uv: boolean;
    readonly tangent: boolean;
    readonly vertexColor: boolean;
    readonly skinning: boolean;
    readonly morph: boolean;
    readonly morphNormals: boolean;
    readonly instancing: boolean;
    readonly instanceColor: boolean;
    readonly billboard: boolean;
    readonly map: boolean;
    readonly mapFromTarget: boolean;
    readonly normalMap: boolean;
    readonly metallicRoughnessMap: boolean;
    readonly occlusionMap: boolean;
    readonly emissiveMap: boolean;
    readonly alphaMask: boolean;
    readonly alphaBlend: boolean;
    readonly premultipliedAlpha: boolean;
    readonly flatShading: boolean;
    readonly doubleSided: boolean;
    readonly receiveShadow: boolean;
    readonly environment: boolean;
    readonly fog: boolean;
    readonly toneMapped: boolean;
    readonly linearOutput: boolean;
}

export const MAX_MORPH_INFLUENCES_WGSL_3D = 8;
/** Bytes of the per-draw Object uniform block; also its dynamic-offset stride. */
export const OBJECT_BLOCK_BYTES_3D = 256;
/** Bytes of the per-material uniform block. */
export const MATERIAL_BLOCK_BYTES_3D = 128;

const FRAME = /* wgsl */`
struct Frame {
    viewProjection: mat4x4f,
    view: mat4x4f,
    cameraPosition: vec4f,
    fogColor: vec4f,
    fogParams: vec4f,
    ambient: vec4f,
    hemisphereSky: vec4f,
    hemisphereGround: vec4f,
    lightCounts: vec4f,
    directionalDirection: array<vec4f, 4>,
    directionalColor: array<vec4f, 4>,
    pointPosition: array<vec4f, 8>,
    pointColor: array<vec4f, 8>,
    spotPosition: array<vec4f, 4>,
    spotDirection: array<vec4f, 4>,
    spotColor: array<vec4f, 4>,
    spotCone: array<vec4f, 4>,
    shadowMatrix: array<mat4x4f, 4>,
    shadowRect: array<vec4f, 4>,
    shadowParams: array<vec4f, 4>,
    output: vec4f,
}
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;
@group(0) @binding(3) var environmentMap: texture_cube<f32>;
@group(0) @binding(4) var environmentSampler: sampler;
`;
const DEPTH_FRAME = /* wgsl */`
struct Frame {
    viewProjection: mat4x4f,
    view: mat4x4f,
}
@group(0) @binding(0) var<uniform> frame: Frame;
`;
const SHARED = /* wgsl */`
struct Material {
    color: vec4f,
    emissive: vec4f,
    surface: vec4f,      // metallic, roughness, normal scale, occlusion strength
    specular: vec4f,     // rgb and shininess
    params: vec4f,       // alpha cutoff, environment scale
    uvRow0: vec4f,       // uv' = (dot(uvRow0.xyz, (uv, 1)), dot(uvRow1.xyz, (uv, 1)))
    uvRow1: vec4f,
    sprite: vec4f,       // rotation, size attenuation flag
}
@group(1) @binding(0) var<uniform> material: Material;
@group(1) @binding(1) var mapTexture: texture_2d<f32>;
@group(1) @binding(2) var mapSampler: sampler;
@group(1) @binding(3) var normalTexture: texture_2d<f32>;
@group(1) @binding(4) var normalSampler: sampler;
@group(1) @binding(5) var metallicRoughnessTexture: texture_2d<f32>;
@group(1) @binding(6) var metallicRoughnessSampler: sampler;
@group(1) @binding(7) var occlusionTexture: texture_2d<f32>;
@group(1) @binding(8) var occlusionSampler: sampler;
@group(1) @binding(9) var emissiveTexture: texture_2d<f32>;
@group(1) @binding(10) var emissiveSampler: sampler;

struct Object {
    model: mat4x4f,
    normal0: vec4f,
    normal1: vec4f,
    normal2: vec4f,
    bind: mat4x4f,
    morph: vec4i,                    // vertex count, channels per target, active count
    morphIndices: array<vec4i, 2>,
    morphWeights: array<vec4f, 2>,
}
@group(2) @binding(0) var<uniform> object: Object;
@group(3) @binding(0) var<storage, read> bones: array<mat4x4f>;
@group(3) @binding(1) var<storage, read> morphData: array<vec4f>;
`;

function vertexSource(f: ShaderFeatures3D): string {
    const inputs = ['@location(0) position: vec3f', '@builtin(vertex_index) vertexIndex: u32'];
    if (f.normal) inputs.push('@location(1) normal: vec3f');
    if (f.uv) inputs.push('@location(2) uv: vec2f');
    if (f.tangent) inputs.push('@location(3) tangent: vec4f');
    if (f.vertexColor) inputs.push('@location(4) color: vec4f');
    if (f.skinning) inputs.push('@location(5) joints: vec4u', '@location(6) weights: vec4f');
    if (f.instancing) inputs.push('@location(8) instance0: vec4f', '@location(9) instance1: vec4f', '@location(10) instance2: vec4f', '@location(11) instance3: vec4f');
    if (f.instanceColor) inputs.push('@location(12) instanceColor: vec4f');
    return /* wgsl */`
struct VertexInput {
    ${inputs.join(',\n    ')},
}
struct VertexOutput {
    @builtin(position) clip: vec4f,
    @location(0) worldPosition: vec3f,
    @location(1) normal: vec3f,
    @location(2) uv: vec2f,
    @location(3) tangent: vec4f,
    @location(4) color: vec4f,
}
fn morphDelta(targetIndex: i32, channel: i32, vertexIndex: u32) -> vec3f {
    let texel = (targetIndex * object.morph.y + channel) * object.morph.x + i32(vertexIndex);
    return morphData[texel].xyz;
}
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var position = input.position;
    var normal = ${f.normal ? 'input.normal' : 'vec3f(0.0, 0.0, 1.0)'};
    ${f.morph ? /* wgsl */`
    for (var i = 0; i < object.morph.z; i++) {
        let targetIndex = object.morphIndices[i / 4][i % 4];
        let weight = object.morphWeights[i / 4][i % 4];
        position += morphDelta(targetIndex, 0, input.vertexIndex) * weight;
        ${f.morphNormals && !f.depthOnly ? 'normal += morphDelta(targetIndex, 1, input.vertexIndex) * weight;' : ''}
    }` : ''}
    var model = object.model;
    var normalMatrix = mat3x3f(object.normal0.xyz, object.normal1.xyz, object.normal2.xyz);
    ${f.skinning ? /* wgsl */`
    let skin = input.weights.x * bones[input.joints.x] + input.weights.y * bones[input.joints.y]
        + input.weights.z * bones[input.joints.z] + input.weights.w * bones[input.joints.w];
    model = skin * object.bind;
    normalMatrix = mat3x3f(model[0].xyz, model[1].xyz, model[2].xyz);` : ''}
    ${f.instancing ? /* wgsl */`
    let instance = mat4x4f(input.instance0, input.instance1, input.instance2, input.instance3);
    model = model * instance;
    normalMatrix = normalMatrix * mat3x3f(instance[0].xyz, instance[1].xyz, instance[2].xyz);` : ''}
    var world = model * vec4f(position, 1.0);
    ${f.billboard ? /* wgsl */`
    // Expand the quad along the camera's right and up axes around the node origin.
    let origin = model * vec4f(0.0, 0.0, 0.0, 1.0);
    let right = vec3f(frame.view[0].x, frame.view[1].x, frame.view[2].x);
    let up = vec3f(frame.view[0].y, frame.view[1].y, frame.view[2].y);
    var scale = vec2f(length(model[0].xyz), length(model[1].xyz));
    if (material.sprite.y < 0.5) { scale *= -(frame.view * origin).z; }
    let c = cos(material.sprite.x);
    let s = sin(material.sprite.x);
    let corner = position.xy * scale;
    let turned = vec2f(c * corner.x - s * corner.y, s * corner.x + c * corner.y);
    world = vec4f(origin.xyz + right * turned.x + up * turned.y, 1.0);
    normal = vec3f(0.0, 0.0, 1.0);
    normalMatrix = transpose(mat3x3f(frame.view[0].xyz, frame.view[1].xyz, frame.view[2].xyz));` : ''}
    var output: VertexOutput;
    let clip = frame.viewProjection * world;
    // Matrices follow OpenGL clip conventions; WebGPU depth spans [0, 1].
    output.clip = vec4f(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
    output.worldPosition = world.xyz;
    output.normal = normalMatrix * normal;
    let uv = vec3f(${f.uv ? 'input.uv' : 'vec2f(0.0)'}, 1.0);
    output.uv = vec2f(dot(material.uvRow0.xyz, uv), dot(material.uvRow1.xyz, uv));
    output.tangent = ${f.tangent ? 'vec4f(mat3x3f(model[0].xyz, model[1].xyz, model[2].xyz) * input.tangent.xyz, input.tangent.w)' : 'vec4f(1.0, 0.0, 0.0, 1.0)'};
    output.color = ${f.vertexColor ? 'input.color' : 'vec4f(1.0)'};
    ${f.instanceColor ? 'output.color *= input.instanceColor;' : ''}
    return output;
}
`;
}

function fragmentSource(f: ShaderFeatures3D): string {
    const lit = f.shading !== 'unlit';
    if (f.depthOnly) {
        return /* wgsl */`
@fragment
fn fragmentMain(input: VertexOutput) {
    var base = material.color * input.color;
    ${f.map ? 'base *= textureSample(mapTexture, mapSampler, input.uv);' : ''}
    ${f.alphaMask ? 'if (base.a < material.params.x) { discard; }' : ''}
    ${f.alphaBlend ? 'if (base.a < 0.5) { discard; }' : ''}
}
`;
    }
    const shade = f.shading === 'lambert' ? 'return s.albedo * radiance * nl;' : f.shading === 'phong' ? /* wgsl */`
    let h = normalize(l + s.view);
    let specular = pow(max(dot(s.normal, h), 0.0), max(material.specular.w, 1.0));
    return (s.albedo + material.specular.rgb * specular) * radiance * nl;` : /* wgsl */`
    let h = normalize(l + s.view);
    let nv = max(dot(s.normal, s.view), 0.0001);
    let nh = max(dot(s.normal, h), 0.0);
    let vh = max(dot(s.view, h), 0.0);
    let a = s.roughness * s.roughness;
    let a2 = a * a;
    let d = nh * nh * (a2 - 1.0) + 1.0;
    let distribution = a2 / (PI * d * d);
    let visibility = 0.5 / max(nl * sqrt(nv * nv * (1.0 - a2) + a2) + nv * sqrt(nl * nl * (1.0 - a2) + a2), 0.0001);
    let fresnel = s.f0 + (1.0 - s.f0) * pow(1.0 - vh, 5.0);
    let diffuse = s.albedo * (1.0 - s.metallic) * (1.0 - fresnel);
    // Light units are scaled by PI so a unit white light fully lights a white diffuse surface.
    return (diffuse + distribution * visibility * fresnel * PI) * radiance * nl;`;
    return /* wgsl */`
const PI = 3.141592653589793;
struct Surface {
    albedo: vec3f,
    normal: vec3f,
    view: vec3f,
    f0: vec3f,
    roughness: f32,
    metallic: f32,
}
fn shadowFactor(slot: i32, worldPosition: vec3f, normal: vec3f) -> f32 {
    let params = frame.shadowParams[slot];
    let clip = frame.shadowMatrix[slot] * vec4f(worldPosition + normal * params.y, 1.0);
    if (clip.w <= 0.0) { return 1.0; }
    let ndc = clip.xyz / clip.w * 0.5 + 0.5;
    if (any(ndc < vec3f(0.0)) || any(ndc > vec3f(1.0))) { return 1.0; }
    let rect = frame.shadowRect[slot];
    let depth = ndc.z - params.x;
    let corner = rect.xy + rect.zw;
    let lower = min(rect.xy, corner) + params.z;
    let upper = max(rect.xy, corner) - params.z;
    var lit = 0.0;
    // 3x3 taps on top of hardware comparison filtering.
    for (var y = -1; y <= 1; y++) {
        for (var x = -1; x <= 1; x++) {
            let uv = clamp(rect.xy + ndc.xy * rect.zw + vec2f(f32(x), f32(y)) * params.z, lower, upper);
            lit += textureSampleCompareLevel(shadowMap, shadowSampler, uv, depth);
        }
    }
    return lit / 9.0;
}
fn rangeFalloff(dist: f32, range: f32) -> f32 {
    let inverseSquare = 1.0 / max(dist * dist, 0.0001);
    if (range <= 0.0) { return inverseSquare; }
    let ratio = dist / range;
    let window = clamp(1.0 - ratio * ratio * ratio * ratio, 0.0, 1.0);
    return inverseSquare * window * window;
}
fn shade(s: Surface, l: vec3f, radiance: vec3f) -> vec3f {
    let nl = max(dot(s.normal, l), 0.0);
    if (nl <= 0.0) { return vec3f(0.0); }
    ${lit ? shade : 'return vec3f(0.0);'}
}
fn toneMap(input: vec3f) -> vec3f {
    var color = input * frame.output.z;
    if (frame.output.w > 1.5) {
        // Filmic curve fit commonly used for ACES-like output.
        color = clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
    } else if (frame.output.w > 0.5) { color = color / (1.0 + color); }
    return color;
}
fn encodeSrgb(input: vec3f) -> vec3f {
    let color = clamp(input, vec3f(0.0), vec3f(1.0));
    return mix(color * 12.92, 1.055 * pow(color, vec3f(1.0 / 2.4)) - 0.055, step(vec3f(0.0031308), color));
}
@fragment
fn fragmentMain(input: VertexOutput, @builtin(front_facing) frontFacing: bool) -> @location(0) vec4f {
    // Implicit-derivative operations run first, before any non-uniform control flow.
    let dpx = dpdx(input.worldPosition);
    let dpy = dpdy(input.worldPosition);
    let duvx = dpdx(input.uv);
    let duvy = dpdy(input.uv);
    var base = material.color * input.color;
    ${f.mapFromTarget ? /* wgsl */`
    let mapColor = textureSample(mapTexture, mapSampler, input.uv);
    // Target pixels carry alpha-weighted RGB. Material shading uses straight color.
    var straightColor = vec3f(0.0);
    if (mapColor.a > 0.0) { straightColor = mapColor.rgb / mapColor.a; }
    base *= vec4f(straightColor, mapColor.a);`
    : f.map ? 'base *= textureSample(mapTexture, mapSampler, input.uv);' : ''}
    ${f.normalMap ? 'let normalSample = textureSample(normalTexture, normalSampler, input.uv).xyz;' : ''}
    ${f.metallicRoughnessMap ? 'let mrSample = textureSample(metallicRoughnessTexture, metallicRoughnessSampler, input.uv);' : ''}
    ${f.occlusionMap ? 'let occlusionSample = textureSample(occlusionTexture, occlusionSampler, input.uv).r;' : ''}
    ${f.emissiveMap ? 'let emissiveSample = textureSample(emissiveTexture, emissiveSampler, input.uv).rgb;' : ''}
    ${f.alphaMask ? 'if (base.a < material.params.x) { discard; }' : ''}
    var color = base.rgb;
    ${lit ? /* wgsl */`
    var s: Surface;
    ${f.flatShading || !f.normal ? 'var n = normalize(cross(dpy, dpx));' : /* wgsl */`var n = normalize(input.normal);
    ${f.doubleSided ? 'if (!frontFacing) { n = -n; }' : ''}`}
    ${f.normalMap ? /* wgsl */`
    var mapped = normalSample * 2.0 - 1.0;
    mapped = vec3f(mapped.xy * material.surface.z, mapped.z);
    ${f.tangent ? /* wgsl */`
    let t = normalize(input.tangent.xyz);
    let b = cross(n, t) * input.tangent.w;` : /* wgsl */`
    // Derive a cotangent frame from screen-space derivatives. Framebuffer Y
    // points down in WebGPU, so the Y derivatives are negated first.
    let dp2perp = cross(-dpy, n);
    let dp1perp = cross(n, dpx);
    var t = dp2perp * duvx.x - dp1perp * duvy.x;
    var b = dp2perp * duvx.y - dp1perp * duvy.y;
    let invmax = inverseSqrt(max(max(dot(t, t), dot(b, b)), 1e-12));
    t *= invmax;
    b *= invmax;`}
    n = normalize(mat3x3f(t, b, n) * mapped);` : ''}
    s.normal = n;
    s.view = normalize(frame.cameraPosition.xyz - input.worldPosition);
    s.albedo = base.rgb;
    s.metallic = material.surface.x;
    s.roughness = material.surface.y;
    ${f.metallicRoughnessMap ? 's.metallic *= mrSample.b; s.roughness *= mrSample.g;' : ''}
    s.roughness = clamp(s.roughness, 0.045, 1.0);
    s.f0 = mix(vec3f(0.04), s.albedo, s.metallic);
    var occlusion = 1.0;
    ${f.occlusionMap ? 'occlusion = mix(1.0, occlusionSample, material.surface.w);' : ''}
    var diffuseAlbedo = s.albedo;
    ${f.shading === 'standard' ? 'diffuseAlbedo *= 1.0 - s.metallic;' : ''}
    var irradiance = frame.ambient.rgb + mix(frame.hemisphereGround.rgb, frame.hemisphereSky.rgb, s.normal.y * 0.5 + 0.5);
    ${f.environment ? 'irradiance += textureSampleLevel(environmentMap, environmentSampler, s.normal, frame.output.y).rgb * frame.output.x * material.params.y;' : ''}
    color = diffuseAlbedo * irradiance * occlusion;
    ${f.environment && f.shading === 'standard' ? /* wgsl */`
    {
        let reflected = reflect(-s.view, s.normal);
        let nv = max(dot(s.normal, s.view), 0.0);
        let prefiltered = textureSampleLevel(environmentMap, environmentSampler, reflected, s.roughness * frame.output.y).rgb * frame.output.x * material.params.y;
        // Analytic approximation of the split-sum environment BRDF.
        let r = s.roughness * vec4f(-1.0, -0.0275, -0.572, 0.022) + vec4f(1.0, 0.0425, 1.04, -0.04);
        let a004 = min(r.x * r.x, exp2(-9.28 * nv)) * r.x + r.y;
        let scaleBias = vec2f(-1.04, 1.04) * a004 + r.zw;
        color += prefiltered * (s.f0 * scaleBias.x + scaleBias.y) * occlusion;
    }` : ''}
    let directionalCount = i32(frame.lightCounts.x);
    let pointCount = i32(frame.lightCounts.y);
    let spotCount = i32(frame.lightCounts.z);
    for (var i = 0; i < directionalCount; i++) {
        var visible = 1.0;
        ${f.receiveShadow ? 'if (frame.directionalDirection[i].w >= 0.0) { visible = shadowFactor(i32(frame.directionalDirection[i].w), input.worldPosition, s.normal); }' : ''}
        color += shade(s, -frame.directionalDirection[i].xyz, frame.directionalColor[i].rgb) * visible;
    }
    for (var i = 0; i < pointCount; i++) {
        let toLight = frame.pointPosition[i].xyz - input.worldPosition;
        let dist = length(toLight);
        color += shade(s, toLight / max(dist, 0.0001), frame.pointColor[i].rgb * rangeFalloff(dist, frame.pointPosition[i].w));
    }
    for (var i = 0; i < spotCount; i++) {
        let toLight = frame.spotPosition[i].xyz - input.worldPosition;
        let dist = length(toLight);
        let l = toLight / max(dist, 0.0001);
        let cone = smoothstep(frame.spotCone[i].x, frame.spotCone[i].y, dot(-l, frame.spotDirection[i].xyz));
        var visible = 1.0;
        ${f.receiveShadow ? 'if (cone > 0.0 && frame.spotDirection[i].w >= 0.0) { visible = shadowFactor(i32(frame.spotDirection[i].w), input.worldPosition, s.normal); }' : ''}
        color += shade(s, l, frame.spotColor[i].rgb * rangeFalloff(dist, frame.spotPosition[i].w) * cone) * visible;
    }` : ''}
    var emissive = material.emissive.rgb;
    ${f.emissiveMap ? 'emissive *= emissiveSample;' : ''}
    color += emissive;
    ${f.fog ? /* wgsl */`
    if (frame.fogParams.x > 0.5) {
        let dist = length(frame.cameraPosition.xyz - input.worldPosition);
        var fog = smoothstep(frame.fogParams.y, frame.fogParams.z, dist);
        if (frame.fogParams.x > 1.5) { fog = 1.0 - exp(-frame.fogParams.y * frame.fogParams.y * dist * dist); }
        color = mix(color, frame.fogColor.rgb, clamp(fog, 0.0, 1.0));
    }` : ''}
    ${f.toneMapped ? 'color = toneMap(color);' : ''}
    ${f.linearOutput ? 'color = clamp(color, vec3f(0.0), vec3f(1.0));' : 'color = encodeSrgb(color);'}
    ${f.premultipliedAlpha ? 'color *= base.a;' : ''}
    return vec4f(color, ${f.alphaBlend ? 'base.a' : '1.0'});
}
`;
}

/** Assemble the complete WGSL module for one material variant. */
export function buildMaterialWgsl3D(features: ShaderFeatures3D): string {
    return (features.depthOnly ? DEPTH_FRAME : FRAME) + SHARED + vertexSource(features) + fragmentSource(features);
}
/** Stable cache key for a feature set. */
export function shaderFeatureKey3D(features: ShaderFeatures3D): string {
    let key = features.shading;
    for (const name of Object.keys(features).sort()) {
        if (name !== 'shading' && (features as unknown as Record<string, unknown>)[name] === true) key += ' ' + name;
    }
    return key;
}

/** Full-screen triangle sampling a cube map along the view ray, drawn at the far plane. */
export const SKYBOX_WGSL_3D = /* wgsl */`
struct Sky {
    inverseViewProjection: mat4x4f,
    output: vec4f, // x: intensity, y: 1 keeps linear output, z: exposure, w: tone mapping
}
@group(0) @binding(0) var<uniform> sky: Sky;
@group(0) @binding(1) var skyMap: texture_cube<f32>;
@group(0) @binding(2) var skySampler: sampler;
struct SkyOutput {
    @builtin(position) clip: vec4f,
    @location(0) direction: vec3f,
}
@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> SkyOutput {
    let corner = vec2f(f32((index << 1u) & 2u), f32(index & 2u)) * 2.0 - 1.0;
    let far = sky.inverseViewProjection * vec4f(corner, 1.0, 1.0);
    let near = sky.inverseViewProjection * vec4f(corner, -1.0, 1.0);
    var output: SkyOutput;
    output.direction = far.xyz / far.w - near.xyz / near.w;
    output.clip = vec4f(corner, 1.0, 1.0);
    return output;
}
@fragment
fn fragmentMain(input: SkyOutput) -> @location(0) vec4f {
    var color = textureSample(skyMap, skySampler, normalize(input.direction)).rgb * sky.output.x * sky.output.z;
    if (sky.output.w > 1.5) { color = clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), vec3f(0.0), vec3f(1.0)); }
    else if (sky.output.w > 0.5) { color = color / (1.0 + color); }
    color = clamp(color, vec3f(0.0), vec3f(1.0));
    if (sky.output.y < 0.5) { color = mix(color * 12.92, 1.055 * pow(color, vec3f(1.0 / 2.4)) - 0.055, step(vec3f(0.0031308), color)); }
    return vec4f(color, 1.0);
}
`;

/** Downsample one mip level into the next with a linear filter. */
export const MIPMAP_WGSL_3D = /* wgsl */`
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var sourceSampler: sampler;
struct MipOutput {
    @builtin(position) clip: vec4f,
    @location(0) uv: vec2f,
}
@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> MipOutput {
    let corner = vec2f(f32((index << 1u) & 2u), f32(index & 2u));
    var output: MipOutput;
    output.uv = vec2f(corner.x, 1.0 - corner.y);
    output.clip = vec4f(corner * 2.0 - 1.0, 0.0, 1.0);
    return output;
}
@fragment
fn fragmentMain(input: MipOutput) -> @location(0) vec4f {
    return textureSample(source, sourceSampler, input.uv);
}
`;
