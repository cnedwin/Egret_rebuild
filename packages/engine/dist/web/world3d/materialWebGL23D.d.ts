import type { Material3D } from '../../rendering/world3d/Material3D.js';
import type { GpuResources3D, Program3D } from './gpuResources3D.js';
export declare const MATERIAL_VARIANT_WEBGL2_3D: Readonly<{
    readonly normal: 1;
    readonly tangent: 2;
    readonly uv: 4;
    readonly color: 8;
    readonly skin: 16;
    readonly morph: 32;
    readonly morphNormals: 64;
    readonly instancing: 128;
    readonly instanceColor: 256;
    readonly receiveShadow: 512;
    readonly fog: 1024;
    readonly toneMapped: 2048;
    readonly environment: 4096;
    readonly points: 8192;
    readonly depthOnly: 16384;
    readonly linearOutput: 32768;
    readonly mapFromTarget: 65536;
    readonly uv1: 131072;
    readonly occlusionSecond: 262144;
    readonly emissiveSecond: 524288;
    readonly lightSecond: 1048576;
    readonly transmission: 2097152;
    readonly skinInstancing: 4194304;
    readonly gpuParticles: 8388608;
    readonly softDepth: 16777216;
}>;
/** Preserve define order because the renderer uses it as part of the linked-program key. */
export declare function buildMaterialDefinesWebGL23D(material: Material3D, variant: number, depthOnly: boolean): string[];
/** Apply uniforms and textures in draw order using the renderer's existing scratch matrix. */
export declare function applyMaterialWebGL23D(gl: WebGL2RenderingContext, u: Program3D['uniforms'], resources: GpuResources3D, scratch9: Float32Array, material: Material3D, depthOnly: boolean): void;
//# sourceMappingURL=materialWebGL23D.d.ts.map