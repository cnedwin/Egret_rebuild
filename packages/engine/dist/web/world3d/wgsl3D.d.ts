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
export declare const MAX_MORPH_INFLUENCES_WGSL_3D = 8;
/** Bytes of the per-draw Object uniform block; also its dynamic-offset stride. */
export declare const OBJECT_BLOCK_BYTES_3D = 256;
/** Bytes of the per-material uniform block. */
export declare const MATERIAL_BLOCK_BYTES_3D = 256;
/** Assemble the complete WGSL module for one material variant. */
export declare function buildMaterialWgsl3D(features: ShaderFeatures3D): string;
/** Stable cache key for a feature set. */
export declare function shaderFeatureKey3D(features: ShaderFeatures3D): string;
/** Full-screen triangle sampling a cube map along the view ray, drawn at the far plane. */
export declare const SKYBOX_WGSL_3D = "\nstruct Sky {\n    inverseViewProjection: mat4x4f,\n    output: vec4f, // x: intensity, y: 1 keeps linear output, z: exposure, w: tone mapping\n}\n@group(0) @binding(0) var<uniform> sky: Sky;\n@group(0) @binding(1) var skyMap: texture_cube<f32>;\n@group(0) @binding(2) var skySampler: sampler;\nstruct SkyOutput {\n    @builtin(position) clip: vec4f,\n    @location(0) direction: vec3f,\n}\n@vertex\nfn vertexMain(@builtin(vertex_index) index: u32) -> SkyOutput {\n    let corner = vec2f(f32((index << 1u) & 2u), f32(index & 2u)) * 2.0 - 1.0;\n    let far = sky.inverseViewProjection * vec4f(corner, 1.0, 1.0);\n    let near = sky.inverseViewProjection * vec4f(corner, -1.0, 1.0);\n    var output: SkyOutput;\n    output.direction = far.xyz / far.w - near.xyz / near.w;\n    output.clip = vec4f(corner, 1.0, 1.0);\n    return output;\n}\n@fragment\nfn fragmentMain(input: SkyOutput) -> @location(0) vec4f {\n    var color = textureSample(skyMap, skySampler, normalize(input.direction)).rgb * sky.output.x * sky.output.z;\n    if (sky.output.w > 1.5) { color = clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), vec3f(0.0), vec3f(1.0)); }\n    else if (sky.output.w > 0.5) { color = color / (1.0 + color); }\n    if (sky.output.y < 0.5) { color = clamp(color, vec3f(0.0), vec3f(1.0)); color = mix(color * 12.92, 1.055 * pow(color, vec3f(1.0 / 2.4)) - 0.055, step(vec3f(0.0031308), color)); }\n    return vec4f(color, 1.0);\n}\n";
/** Downsample one mip level into the next with a linear filter. */
export declare const MIPMAP_WGSL_3D = "\n@group(0) @binding(0) var source: texture_2d<f32>;\n@group(0) @binding(1) var sourceSampler: sampler;\nstruct MipOutput {\n    @builtin(position) clip: vec4f,\n    @location(0) uv: vec2f,\n}\n@vertex\nfn vertexMain(@builtin(vertex_index) index: u32) -> MipOutput {\n    let corner = vec2f(f32((index << 1u) & 2u), f32(index & 2u));\n    var output: MipOutput;\n    output.uv = vec2f(corner.x, 1.0 - corner.y);\n    output.clip = vec4f(corner * 2.0 - 1.0, 0.0, 1.0);\n    return output;\n}\n@fragment\nfn fragmentMain(input: MipOutput) -> @location(0) vec4f {\n    return textureSample(source, sourceSampler, input.uv);\n}\n";
//# sourceMappingURL=wgsl3D.d.ts.map