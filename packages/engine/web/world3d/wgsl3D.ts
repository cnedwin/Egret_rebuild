// SPDX-License-Identifier: Apache-2.0
// First-party WGSL shader library for the WebGPU world3d renderer. WGSL has
// no preprocessor, so each material variant is assembled from feature flags.
// The lighting model mirrors the GLSL library in shaders3D.ts.

export interface ShaderFeatures3D {
    readonly shading: 'unlit' | 'lambert' | 'phong' | 'standard' | 'toon' | 'matcap';
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
    readonly screenSpace: boolean;
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
    /** The geometry's second coordinate set is bound, for occlusion or emissive maps that ask for it. */
    readonly uv1: boolean;
    readonly lightMap: boolean;
    readonly lightUv1: boolean;
    /** Standard material that lets light through and reads the stored scene behind it. */
    readonly transmission: boolean;
    readonly occlusionUv1: boolean;
    readonly emissiveUv1: boolean;
    /** Key and WGSL source of the material's fragment hook, when it has one. */
    readonly customKey?: string;
    readonly customWgsl?: string;
    readonly customVertexWgsl?: string;
    readonly customNormalWgsl?: string;
    /** Standard material with a mirror image read at the pixel's place on screen. */
    readonly reflectionMap?: boolean;
    /** Instances posed from a table of baked bone matrices. */
    readonly skinInstancing?: boolean;
    /** Instance slots hold particle parameters and the vertex stage moves the particles. */
    readonly gpuParticles?: boolean;
    /** Blended surface that fades where it nears the solid scene. */
    readonly softDepth?: boolean;
    /** Ground layers blended by a weight map; they use the map, emissive, occlusion, metallic-roughness and light map slots. */
    readonly splat?: boolean;
}

export const MAX_MORPH_INFLUENCES_WGSL_3D = 8;
/** Bytes of the per-draw Object uniform block; also its dynamic-offset stride. */
export const OBJECT_BLOCK_BYTES_3D = 256;
/** Bytes of the per-material uniform block. */
export const MATERIAL_BLOCK_BYTES_3D = 256;

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
    cascadeSplits: vec4f,
    cascadeInfo: vec4f,
    pointShadow: vec4f,
    clipPlanes: array<vec4f, 4>,
    clipInfo: vec4f,
}
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(0) @binding(2) var shadowSampler: sampler_comparison;
@group(0) @binding(3) var environmentMap: texture_cube<f32>;
@group(0) @binding(4) var environmentSampler: sampler;
@group(0) @binding(5) var sceneColor: texture_2d<f32>;
@group(0) @binding(6) var sceneColorSampler: sampler;
@group(0) @binding(7) var sceneDepthMap: texture_depth_2d;
// Distance from the camera plane to the solid scene behind this pixel and to the surface itself;
// hooks may read them. Without a depth image the scene counts as far away.
var<private> sceneDistance: f32 = 1.0e9;
var<private> surfaceDistance: f32 = 0.0;
// This pixel's place on the output, counted from the top row.
var<private> surfacePixel: vec2f = vec2f(0.0);
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
    params: vec4f,       // alpha cutoff, environment scale, clearcoat strength, clearcoat roughness
    uvRow0: vec4f,       // uv' = (dot(uvRow0.xyz, (uv, 1)), dot(uvRow1.xyz, (uv, 1)))
    uvRow1: vec4f,
    sprite: vec4f,       // rotation, size attenuation flag, mirror image distortion and strength
    custom: array<vec4f, 4>, // parameters of the optional fragment hook
    sheen: vec4f,        // color scaled by strength, roughness
    extra: vec4f,        // light map intensity, transmission, index of refraction, thickness
    attenuation: vec4f,  // color after the attenuation distance; w: that distance (0 = none)
    splat: vec4f,        // how often each ground layer repeats
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
@group(1) @binding(11) var lightTexture: texture_2d<f32>;
@group(1) @binding(12) var lightSampler: sampler;
@group(1) @binding(13) var reflectionTexture: texture_2d<f32>;
@group(1) @binding(14) var reflectionSampler: sampler;

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
    if (f.uv1) inputs.push('@location(7) uv1: vec2f');
    if (f.skinning || f.skinInstancing) inputs.push('@location(5) joints: vec4u', '@location(6) weights: vec4f');
    if (f.skinInstancing) inputs.push('@location(13) instanceAnimation: vec4f', '@location(14) instanceAnimation2: vec4f', '@location(15) instanceLook: vec4f');
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
    @location(5) uv1: vec2f,
}
fn morphDelta(targetIndex: i32, channel: i32, vertexIndex: u32) -> vec3f {
    let texel = (targetIndex * object.morph.y + channel) * object.morph.x + i32(vertexIndex);
    return morphData[texel].xyz;
}
${f.skinInstancing ? /* wgsl */`
// The bones table holds every frame of every clip. The fourth float of an instance carries what all
// instances share: matrices per frame, and the bone that may turn.
fn bakedBone(joint: u32, frame: f32, packed: f32) -> mat4x4f {
    return bones[u32(frame) * (u32(packed) % 2048u) + joint];
}
// One table entry for an instance: between two frames of its clip, and of a second clip when it has one.
fn bakedBlend(joint: u32, a: vec4f, b: vec4f) -> mat4x4f {
    var pose = bakedBone(joint, a.x, a.w) * (1.0 - a.z) + bakedBone(joint, a.y, a.w) * a.z;
    if (b.w > 0.0) { pose = pose * (1.0 - b.w) + (bakedBone(joint, b.x, a.w) * (1.0 - b.z) + bakedBone(joint, b.y, a.w) * b.z) * b.w; }
    return pose;
}
fn bakedJoint(joint: u32, a: vec4f, b: vec4f, look: vec4f) -> mat4x4f {
    var pose = bakedBlend(joint, a, b);
    let bone = i32(u32(a.w) / 2048u) - 1;
    if (i32(joint) == bone) {
        // Turn the bone about its joint, whose place in the bind pose is kept in frame 0.
        let pivot = bakedBone(joint, 0.0, a.w)[3].xyz;
        let v = look.xyz;
        let w = look.w;
        let turn = mat3x3f(1.0 - 2.0 * (v.y * v.y + v.z * v.z), 2.0 * (v.x * v.y + v.z * w), 2.0 * (v.x * v.z - v.y * w),
            2.0 * (v.x * v.y - v.z * w), 1.0 - 2.0 * (v.x * v.x + v.z * v.z), 2.0 * (v.y * v.z + v.x * w),
            2.0 * (v.x * v.z + v.y * w), 2.0 * (v.y * v.z - v.x * w), 1.0 - 2.0 * (v.x * v.x + v.y * v.y));
        pose = pose * mat4x4f(vec4f(turn[0], 0.0), vec4f(turn[1], 0.0), vec4f(turn[2], 0.0), vec4f(pivot - turn * pivot, 1.0));
    }
    return pose;
}` : ''}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var position = input.position;
    var normal = ${f.normal ? 'input.normal' : 'vec3f(0.0, 0.0, 1.0)'};
    ${f.morph && f.skinInstancing ? /* wgsl */`
    // Baked instances read their morph weights from the last entry of their frames.
    let bakedWeights = bakedBlend(u32(input.instanceAnimation.w) % 2048u - 1u, input.instanceAnimation, input.instanceAnimation2);
    for (var i = 0; i < object.morph.z; i++) {
        position += morphDelta(i, 0, input.vertexIndex) * bakedWeights[i / 4][i % 4];
        ${f.morphNormals && (!f.depthOnly || f.customVertexWgsl !== undefined) ? 'normal += morphDelta(i, 1, input.vertexIndex) * bakedWeights[i / 4][i % 4];' : ''}
    }` : f.morph ? /* wgsl */`
    for (var i = 0; i < object.morph.z; i++) {
        let targetIndex = object.morphIndices[i / 4][i % 4];
        let weight = object.morphWeights[i / 4][i % 4];
        position += morphDelta(targetIndex, 0, input.vertexIndex) * weight;
        ${f.morphNormals && (!f.depthOnly || f.customVertexWgsl !== undefined) ? 'normal += morphDelta(targetIndex, 1, input.vertexIndex) * weight;' : ''}
    }` : ''}
    var model = object.model;
    var normalMatrix = mat3x3f(object.normal0.xyz, object.normal1.xyz, object.normal2.xyz);
    ${f.skinning ? /* wgsl */`
    let skin = input.weights.x * bones[input.joints.x] + input.weights.y * bones[input.joints.y]
        + input.weights.z * bones[input.joints.z] + input.weights.w * bones[input.joints.w];
    model = skin * object.bind;
    normalMatrix = mat3x3f(model[0].xyz, model[1].xyz, model[2].xyz);` : ''}
    var spriteTurn = 0.0;
    ${f.gpuParticles ? /* wgsl */`
    // The instance slots carry a particle's start and birth, velocity and life, sizes and angles;
    // where it is now follows from the time alone.
    let particleLife = max(input.instance1.w, 0.0001);
    var particleTime = material.custom[0].x - input.instance0.w;
    var particleAlive = true;
    if (material.custom[0].y > 0.5) { particleTime = particleTime - floor(particleTime / particleLife) * particleLife; }
    else { particleAlive = particleTime >= 0.0 && particleTime <= particleLife; }
    let particleAge = clamp(particleTime / particleLife, 0.0, 1.0);
    var particleTravel = particleTime;
    if (material.custom[1].w > 0.0001) { particleTravel = (1.0 - exp(-material.custom[1].w * particleTime)) / material.custom[1].w; }
    var particleCenter = input.instance0.xyz + input.instance1.xyz * particleTravel + material.custom[1].xyz * (0.5 * particleTime * particleTime);
    if (material.custom[3].y > 0.5) {
        // A floor: find when the particle comes down on it, then let it leave again slower, once. Drag is not applied on this path.
        let pull = material.custom[1].xyz;
        let launch = input.instance1.xyz;
        let a = 0.5 * pull.y;
        let b = launch.y;
        let c = input.instance0.y - material.custom[3].z;
        var hit = -1.0;
        if (c == 0.0 && (b < 0.0 || (b == 0.0 && a < 0.0))) { hit = 0.0; }
        else if (abs(a) > 0.000001) {
            let discriminant = b * b - 4.0 * a * c;
            if (discriminant > 0.0) {
                let root = sqrt(discriminant);
                if (b < 0.0) { hit = 2.0 * c / (root - b); } else { hit = (-b - root) / (2.0 * a); }
            }
        } else if (b < 0.0) { hit = -c / b; }
        particleCenter = input.instance0.xyz + launch * particleTime + pull * (0.5 * particleTime * particleTime);
        if (c >= 0.0 && hit >= 0.0 && particleTime >= hit) {
            let landed = input.instance0.xyz + launch * hit + pull * (0.5 * hit * hit);
            let away = (launch + pull * hit) * vec3f(material.custom[3].w, -material.custom[3].w, material.custom[3].w);
            let since = particleTime - hit;
            particleCenter = landed + away * since + pull * (0.5 * since * since);
            particleCenter.y = max(particleCenter.y, material.custom[3].z);
        }
    }
    // Particles left behind in the world carry world positions and ignore the emitter's transform.
    if (material.custom[3].x > 0.5) { model = mat4x4f(vec4f(1.0, 0.0, 0.0, 0.0), vec4f(0.0, 1.0, 0.0, 0.0), vec4f(0.0, 0.0, 1.0, 0.0), vec4f(0.0, 0.0, 0.0, 1.0)); }
    let particleSize = mix(input.instance2.x, input.instance2.y, particleAge);
    model = model * mat4x4f(vec4f(particleSize, 0.0, 0.0, 0.0), vec4f(0.0, particleSize, 0.0, 0.0), vec4f(0.0, 0.0, particleSize, 0.0), vec4f(particleCenter, 1.0));
    spriteTurn = input.instance2.z + input.instance2.w * particleTime;` : ''}
    ${f.instancing && !f.gpuParticles ? /* wgsl */`
    let instance = mat4x4f(input.instance0, input.instance1, input.instance2, input.instance3);
    model = model * instance;
    normalMatrix = normalMatrix * mat3x3f(instance[0].xyz, instance[1].xyz, instance[2].xyz);` : ''}
    ${f.skinInstancing ? /* wgsl */`
    // Each instance is posed in its own space before its transform places it.
    let first = input.instanceAnimation;
    let second = input.instanceAnimation2;
    model = model * (input.weights.x * bakedJoint(input.joints.x, first, second, input.instanceLook) + input.weights.y * bakedJoint(input.joints.y, first, second, input.instanceLook)
        + input.weights.z * bakedJoint(input.joints.z, first, second, input.instanceLook) + input.weights.w * bakedJoint(input.joints.w, first, second, input.instanceLook));
    normalMatrix = mat3x3f(model[0].xyz, model[1].xyz, model[2].xyz);` : ''}
    var world = model * vec4f(position, 1.0);
    ${f.customVertexWgsl !== undefined ? `world = vec4f(customVertex(world.xyz, position, normal, ${f.uv ? 'input.uv' : 'vec2f(0.0)'}, ${f.vertexColor ? 'input.color' : 'vec4f(1.0)'}), world.w);` : ''}
    ${f.billboard ? /* wgsl */`
    // Expand the quad along the camera's right and up axes around the node origin.
    let origin = model * vec4f(0.0, 0.0, 0.0, 1.0);
    let right = vec3f(frame.view[0].x, frame.view[1].x, frame.view[2].x);
    let up = vec3f(frame.view[0].y, frame.view[1].y, frame.view[2].y);
    var scale = vec2f(length(model[0].xyz), length(model[1].xyz));
    if (material.sprite.y < 0.5) { scale *= -(frame.view * origin).z; }
    let c = cos(material.sprite.x + spriteTurn);
    let s = sin(material.sprite.x + spriteTurn);
    let corner = position.xy * scale;
    let turned = vec2f(c * corner.x - s * corner.y, s * corner.x + c * corner.y);
    world = vec4f(origin.xyz + right * turned.x + up * turned.y, 1.0);
    normal = vec3f(0.0, 0.0, 1.0);
    normalMatrix = transpose(mat3x3f(frame.view[0].xyz, frame.view[1].xyz, frame.view[2].xyz));` : ''}
    var output: VertexOutput;
    var clip = frame.viewProjection * world;
    ${f.screenSpace ? '// Positions are already in normalized device coordinates; depth is remapped below.\n    clip = vec4f(position.xy, -1.0, 1.0);' : ''}
    // Matrices follow OpenGL clip conventions; WebGPU depth spans [0, 1].
    output.clip = vec4f(clip.xy, (clip.z + clip.w) * 0.5, clip.w);
    output.worldPosition = world.xyz;
    output.normal = normalMatrix * normal;
    let uv = vec3f(${f.uv ? 'input.uv' : 'vec2f(0.0)'}, 1.0);
    output.uv = vec2f(dot(material.uvRow0.xyz, uv), dot(material.uvRow1.xyz, uv));
    output.tangent = ${f.tangent ? 'vec4f(mat3x3f(model[0].xyz, model[1].xyz, model[2].xyz) * input.tangent.xyz, input.tangent.w)' : 'vec4f(1.0, 0.0, 0.0, 1.0)'};
    output.color = ${f.vertexColor ? 'input.color' : 'vec4f(1.0)'};
    output.uv1 = ${f.uv1 ? 'input.uv1' : 'vec2f(0.0)'};
    ${f.instanceColor ? 'output.color *= input.instanceColor;' : ''}
    ${f.gpuParticles ? /* wgsl */`
    // From the instance's color to the shared end color over the particle's life, fading at both ends.
    output.color = mix(input.instanceColor, material.custom[2], particleAge);
    output.color.a *= smoothstep(0.0, max(material.custom[0].z, 0.0001), particleAge) * (1.0 - smoothstep(1.0 - max(material.custom[0].w, 0.0001), 1.0, particleAge));
    if (!particleAlive) { output.clip = vec4f(2.0, 2.0, 2.0, 1.0); }` : ''}
    return output;
}
`;
}

function fragmentSource(f: ShaderFeatures3D): string {
    const lit = f.shading !== 'unlit' && f.shading !== 'matcap';
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
    const shade = f.shading === 'lambert' ? 'return s.albedo * radiance * nl;'
        // material.specular.w carries the band count for toon shading.
        : f.shading === 'toon' ? 'return s.albedo * radiance * (ceil(nl * material.specular.w - 0.001) / max(material.specular.w, 1.0));' : f.shading === 'phong' ? /* wgsl */`
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
    var lit = diffuse + distribution * visibility * fresnel * PI;
    if (material.sheen.r + material.sheen.g + material.sheen.b > 0.0) {
        // Cloth lobe: an inverted Gaussian that brightens toward grazing angles.
        let inverse = 1.0 / max(material.sheen.w, 0.07);
        lit += material.sheen.rgb * ((2.0 + inverse) * pow(max(1.0 - nh * nh, 0.0), inverse * 0.5) / (2.0 * PI)) / (4.0 * (nl + nv - nl * nv)) * PI;
    }
    if (material.params.z > 0.0) {
        // A second, dielectric lobe on top; the base layer loses what the coat reflects.
        var ca = max(material.params.w, 0.045);
        ca *= ca;
        let ca2 = ca * ca;
        let cd = nh * nh * (ca2 - 1.0) + 1.0;
        let coatFresnel = (0.04 + 0.96 * pow(1.0 - vh, 5.0)) * material.params.z;
        lit = lit * (1.0 - coatFresnel) + ca2 / (PI * cd * cd) * (0.25 / max(vh * vh, 0.0001)) * coatFresnel * PI;
    }
    return lit * radiance * nl;`;
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
// One unfiltered lookup for a point in the air, as fog marching needs many; the flag picks the cascade for that depth.
fn volumeShadow(first: i32, at: vec3f, cascaded: bool) -> f32 {
    var slot = first;
    if (cascaded) {
        let viewDepth = -(frame.view * vec4f(at, 1.0)).z;
        let count = i32(frame.cascadeInfo.y);
        var cascade = 0;
        for (var c = 0; c < 3; c++) { if (c < count - 1 && viewDepth > frame.cascadeSplits[c]) { cascade = c + 1; } }
        if (viewDepth >= frame.cascadeSplits[cascade]) { return 1.0; }
        slot += cascade;
    }
    let clip = frame.shadowMatrix[slot] * vec4f(at, 1.0);
    if (clip.w <= 0.0) { return 1.0; }
    let ndc = clip.xyz / clip.w * 0.5 + 0.5;
    if (any(ndc < vec3f(0.0)) || any(ndc > vec3f(1.0))) { return 1.0; }
    let rect = frame.shadowRect[slot];
    return textureSampleCompareLevel(shadowMap, shadowSampler, rect.xy + ndc.xy * rect.zw, ndc.z - frame.shadowParams[slot].x);
}
fn pointShadowFactor(slot: i32, fromLight: vec3f, worldPosition: vec3f, normal: vec3f) -> f32 {
    // Faces of the tetrahedron the four maps were rendered through.
    let k = 0.5773502691896258;
    let d1 = dot(fromLight, vec3f(-k, -k, k));
    let d2 = dot(fromLight, vec3f(-k, k, -k));
    let d3 = dot(fromLight, vec3f(k, -k, -k));
    var face = 0;
    var best = dot(fromLight, vec3f(k, k, k));
    if (d1 > best) { best = d1; face = 1; }
    if (d2 > best) { best = d2; face = 2; }
    if (d3 > best) { face = 3; }
    return shadowFactor(slot + face, worldPosition, normal);
}
fn cascadedShadowFactor(slot: i32, worldPosition: vec3f, normal: vec3f) -> f32 {
    let viewDepth = -(frame.view * vec4f(worldPosition, 1.0)).z;
    let count = i32(frame.cascadeInfo.y);
    var cascade = 0;
    for (var c = 0; c < 3; c++) { if (c < count - 1 && viewDepth > frame.cascadeSplits[c]) { cascade = c + 1; } }
    let edge = frame.cascadeSplits[cascade];
    if (viewDepth >= edge) { return 1.0; }
    var visible = shadowFactor(slot + cascade, worldPosition, normal);
    // Blend into the next cascade, or out to unshadowed past the last one.
    let t = smoothstep(edge * (1.0 - frame.cascadeInfo.z), edge, viewDepth);
    if (t > 0.0) {
        var next = 1.0;
        if (cascade < count - 1) { next = shadowFactor(slot + cascade + 1, worldPosition, normal); }
        visible = mix(visible, next, t);
    }
    return visible;
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
    surfacePixel = input.clip.xy;
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
    ${f.splat ? /* wgsl */`
    {
        // Ground layers, each weighted by its channel of the weight map.
        var share = textureSample(lightTexture, lightSampler, input.uv);
        let total = share.r + share.g + share.b + share.a;
        if (total > 0.0001) { share = share / total; } else { share = vec4f(1.0, 0.0, 0.0, 0.0); }
        base = vec4f(base.rgb * (textureSample(mapTexture, mapSampler, input.uv * material.splat.x).rgb * share.r + textureSample(emissiveTexture, emissiveSampler, input.uv * material.splat.y).rgb * share.g
            + textureSample(occlusionTexture, occlusionSampler, input.uv * material.splat.z).rgb * share.b + textureSample(metallicRoughnessTexture, metallicRoughnessSampler, input.uv * material.splat.w).rgb * share.a), base.a);
    }` : ''}
    ${f.softDepth ? /* wgsl */`
    {
        // Fade out over the last stretch before the solid surface behind this pixel.
        let stored = textureLoad(sceneDepthMap, vec2i(input.clip.xy), 0) * 2.0 - 1.0;
        sceneDistance = frame.pointShadow.w / (stored + frame.pointShadow.z);
        if (frame.lightCounts.w > 0.5) { sceneDistance = (frame.pointShadow.w - stored) / frame.pointShadow.z; }
        surfaceDistance = -(frame.view * vec4f(input.worldPosition, 1.0)).z;
        ${f.transmission ? '' : 'base.a *= clamp((sceneDistance - surfaceDistance) / max(material.emissive.w, 0.0001), 0.0, 1.0);'}
    }` : ''}
    ${f.normalMap ? 'let normalSample = textureSample(normalTexture, normalSampler, input.uv).xyz;' : ''}
    ${f.metallicRoughnessMap ? 'let mrSample = textureSample(metallicRoughnessTexture, metallicRoughnessSampler, input.uv);' : ''}
    ${f.occlusionMap ? 'let occlusionSample = textureSample(occlusionTexture, occlusionSampler, ' + (f.occlusionUv1 ? 'input.uv1' : 'input.uv') + ').r;' : ''}
    ${f.lightMap ? 'let lightSample = textureSample(lightTexture, lightSampler, ' + (f.lightUv1 ? 'input.uv1' : 'input.uv') + ').rgb;' : ''}
    ${f.emissiveMap ? 'let emissiveSample = textureSample(emissiveTexture, emissiveSampler, ' + (f.emissiveUv1 ? 'input.uv1' : 'input.uv') + ').rgb;' : ''}
    ${f.shading === 'matcap' ? /* wgsl */`
    var matcapNormal = normalize(${f.normal ? 'input.normal' : 'cross(dpx, -dpy)'});
    ${f.doubleSided ? 'if (!frontFacing) { matcapNormal = -matcapNormal; }' : ''}
    let matcapView = normalize((frame.view * vec4f(matcapNormal, 0.0)).xyz);
    let matcapSample = textureSampleLevel(emissiveTexture, emissiveSampler, matcapView.xy * 0.5 + 0.5, 0.0).rgb;` : ''}
    ${f.alphaMask ? 'if (base.a < material.params.x) { discard; }' : ''}
    for (var plane = 0; plane < i32(frame.clipInfo.x); plane++) {
        if (dot(input.worldPosition, frame.clipPlanes[plane].xyz) + frame.clipPlanes[plane].w < 0.0) { discard; }
    }
    var color = base.rgb${f.shading === 'matcap' ? ' * matcapSample' : ''};
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
    ${f.customNormalWgsl !== undefined ? 'n = normalize(customNormal(n, input.worldPosition, ' + (f.uv ? 'input.uv' : 'vec2f(0.0)') + '));' : ''}
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
    ${f.transmission ? /* wgsl */`
    // Light that passes through replaces that share of the diffuse reflection.
    // What the surface reflects at this angle does not pass through it.
    var through = material.extra.y * (1.0 - s.metallic) * (1.0 - (0.04 + 0.96 * pow(1.0 - max(dot(s.normal, s.view), 0.0), 5.0)));
    var passed = vec3f(0.0);
    {
        let bent = refract(-s.view, s.normal, 1.0 / max(material.extra.z, 1.0));
        let here = frame.viewProjection * vec4f(input.worldPosition, 1.0);
        let there = frame.viewProjection * vec4f(input.worldPosition + bent * material.extra.w, 1.0);
        let shift = (there.xy / max(there.w, 0.0001) - here.xy / here.w) * 0.5 * frame.clipInfo.zw;
        let at = input.clip.xy / vec2f(textureDimensions(sceneColor)) + vec2f(shift.x, -shift.y);
        // A rough surface scatters the view: average a spiral of taps that widens with roughness.
        let spread = s.roughness * s.roughness * 0.25 / max(here.w, 1.0);
        for (var i = 0; i < 12; i++) {
            let turn = f32(i) * 2.399963;
            let reach = sqrt((f32(i) + 0.5) / 12.0) * spread;
            // The stored image is top row first, so an upward step is a downward one in it.
            passed += textureSampleLevel(sceneColor, sceneColorSampler, clamp(at + vec2f(cos(turn), -sin(turn)) * reach, vec2f(0.0), vec2f(1.0)), 0.0).rgb;
        }
        passed /= 12.0;
    }
    // Tint of the material, deepened by the distance travelled inside it.
    var tint = s.albedo;
    // With a depth image the light's path through the material is the real gap to what lies behind.
    let travelled = ${f.softDepth ? 'max(sceneDistance - surfaceDistance, 0.0)' : 'material.extra.w'};
    if (material.attenuation.w > 0.0) { tint *= pow(max(material.attenuation.rgb, vec3f(0.0001)), vec3f(travelled / material.attenuation.w)); }
    s.albedo *= 1.0 - through;
    var clear = 1.0;` : ''}
    ${f.reflectionMap ? /* wgsl */`
    var mirrorClear = 1.0;
    // The mirror camera sees the scene flipped left to right; stored images are top row first.
    let mirrorAt = frame.viewProjection * vec4f(input.worldPosition, 1.0);
    let mirrorNdc = mirrorAt.xy / max(mirrorAt.w, 0.0001);
    let mirrorUv = vec2f(0.5 - mirrorNdc.x * 0.5, 0.5 - mirrorNdc.y * 0.5) + vec2f(s.normal.x, -s.normal.z) * material.sprite.z;
    let mirrored = textureSampleLevel(reflectionTexture, reflectionSampler, clamp(mirrorUv, vec2f(0.002), vec2f(0.998)), 0.0).rgb
        * (s.f0 + (1.0 - s.f0) * pow(1.0 - max(dot(s.normal, s.view), 0.0), 5.0)) * material.sprite.w;` : ''}
    var diffuseAlbedo = s.albedo;
    ${f.shading === 'standard' ? 'diffuseAlbedo *= 1.0 - s.metallic;' : ''}
    var irradiance = frame.ambient.rgb + mix(frame.hemisphereGround.rgb, frame.hemisphereSky.rgb, s.normal.y * 0.5 + 0.5);
    ${f.environment ? 'irradiance += textureSampleLevel(environmentMap, environmentSampler, s.normal, frame.output.y).rgb * frame.output.x * material.params.y;' : ''}
    ${f.lightMap ? 'irradiance += lightSample * material.extra.x;' : ''}
    color = diffuseAlbedo * irradiance * occlusion;
    ${f.environment && f.shading === 'standard' && !f.reflectionMap ? /* wgsl */`
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
        ${f.receiveShadow ? `if (frame.directionalDirection[i].w >= 0.0) {
            if (f32(i) == frame.cascadeInfo.x) { visible = cascadedShadowFactor(i32(frame.directionalDirection[i].w), input.worldPosition, s.normal); }
            else { visible = shadowFactor(i32(frame.directionalDirection[i].w), input.worldPosition, s.normal); }
        }` : ''}
        color += shade(s, -frame.directionalDirection[i].xyz, frame.directionalColor[i].rgb) * visible;
    }
    for (var i = 0; i < pointCount; i++) {
        let toLight = frame.pointPosition[i].xyz - input.worldPosition;
        let dist = length(toLight);
        var visible = 1.0;
        ${f.receiveShadow ? 'if (f32(i) == frame.pointShadow.x) { visible = pointShadowFactor(i32(frame.pointShadow.y), -toLight, input.worldPosition, s.normal); }' : ''}
        color += shade(s, toLight / max(dist, 0.0001), frame.pointColor[i].rgb * rangeFalloff(dist, frame.pointPosition[i].w)) * visible;
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
    ${f.shading === 'matcap' ? '' : /* wgsl */`
    var emissive = material.emissive.rgb;
    ${f.emissiveMap ? 'emissive *= emissiveSample;' : ''}
    color += emissive;`}
    ${f.customWgsl !== undefined ? /* wgsl */`
    let customized = customFragment(vec4f(color, base.a), input.worldPosition, normalize(input.normal), input.uv);
    color = customized.rgb;
    base.a = customized.a;
    ${f.transmission ? '// On a see-through material the hook\'s alpha is how much still passes: 0 covers what lies behind.\n    through *= clamp(customized.a, 0.0, 1.0);' : ''}` : ''}
    ${f.fog ? /* wgsl */`
    if (frame.fogParams.x > 0.5) {
        let dist = length(frame.cameraPosition.xyz - input.worldPosition);
        var fog = smoothstep(frame.fogParams.y, frame.fogParams.z, dist);
        if (frame.fogParams.x > 1.5) { fog = 1.0 - exp(-frame.fogParams.y * frame.fogParams.y * dist * dist); }
        color = mix(color, frame.fogColor.rgb, clamp(fog, 0.0, 1.0));
        ${f.transmission ? 'clear = 1.0 - clamp(fog, 0.0, 1.0);' : ''}
        ${f.reflectionMap ? 'mirrorClear = 1.0 - clamp(fog, 0.0, 1.0);' : ''}
    }` : ''}
    ${f.toneMapped ? 'color = toneMap(color);' : ''}
    ${f.transmission ? /* wgsl */`
    // The stored scene is display-ready, so it joins after tone mapping; the canvas holds it sRGB-encoded.
    ${f.linearOutput ? '' : 'passed = mix(passed / 12.92, pow((passed + 0.055) / 1.055, vec3f(2.4)), step(vec3f(0.04045), passed));'}
    color += passed * tint * through * clear;` : ''}
    ${f.reflectionMap ? 'color += mirrored * mirrorClear;' : ''}
    ${f.linearOutput ? 'color = max(color, vec3f(0.0));' : 'color = encodeSrgb(color);'}
    ${f.premultipliedAlpha ? 'color *= base.a;' : ''}
    return vec4f(color, ${f.alphaBlend ? 'base.a' : '1.0'});
}
`;
}

/** Assemble the complete WGSL module for one material variant. */
export function buildMaterialWgsl3D(features: ShaderFeatures3D): string {
    return (features.depthOnly ? DEPTH_FRAME : FRAME) + SHARED + (features.customVertexWgsl ?? '') + '\n' + vertexSource(features) + (features.customWgsl ?? '') + '\n' + (features.customNormalWgsl ?? '') + '\n' + fragmentSource(features);
}
/** Stable cache key for a feature set. */
export function shaderFeatureKey3D(features: ShaderFeatures3D): string {
    let key = features.shading;
    for (const name of Object.keys(features).sort()) {
        if (name !== 'shading' && (features as unknown as Record<string, unknown>)[name] === true) key += ' ' + name;
    }
    if (features.customKey !== undefined) key += ' custom:' + features.customKey;
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
    if (sky.output.y < 0.5) { color = clamp(color, vec3f(0.0), vec3f(1.0)); color = mix(color * 12.92, 1.055 * pow(color, vec3f(1.0 / 2.4)) - 0.055, step(vec3f(0.0031308), color)); }
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
