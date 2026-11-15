import type { Geometry3D } from '../../rendering/world3d/Geometry3D.js';
import type { InstancedMesh3D, Skeleton3D } from '../../rendering/world3d/Mesh3D.js';
import { type AnimationTexture3D } from '../../rendering/world3d/AnimationTexture3D.js';
import { RenderTarget3D } from '../../rendering/world3d/Texture3D.js';
import type { CompressedFormat3D } from '../../rendering/world3d/Texture3D.js';
import type { CubeTexture3D, Texture3D } from '../../rendering/world3d/Texture3D.js';
import type { ShaderSources3D } from './shaders3D.js';
export interface Program3D {
    readonly id: number;
    readonly program: WebGLProgram;
    readonly uniforms: Readonly<Record<string, WebGLUniformLocation>>;
}
export interface GeometryGpu3D {
    readonly vao: WebGLVertexArrayObject;
    indexType: number;
    indexed: boolean;
    morph: {
        readonly texture: WebGLTexture;
        readonly width: number;
        readonly attributes: number;
        readonly vertexCount: number;
    } | undefined;
}
export interface RenderTargetGpu3D {
    readonly framebuffer: WebGLFramebuffer;
    readonly color: WebGLTexture;
    depth: WebGLRenderbuffer | undefined;
    /** Depth attachment as a texture, for targets created with `depthTexture`. */
    depthTexture: WebGLTexture | undefined;
    version: number;
    readonly unsubscribe: () => void;
}
export declare class GpuResources3D {
    #private;
    /** True when half-float color targets can be rendered to. */
    readonly floatTargets: boolean;
    constructor(gl: WebGL2RenderingContext);
    get counts(): {
        programs: number;
        geometries: number;
        textures: number;
    };
    program(key: string, sources: () => ShaderSources3D): Program3D;
    private upload;
    private glType;
    private buffer;
    /** Bind every known attribute of a geometry into the currently bound vertex array. */
    private bindAttributes;
    /** Create or refresh GPU buffers for a geometry and return its vertex array. */
    geometry(geometry: Geometry3D): GeometryGpu3D;
    private buildMorph;
    private dataTexture;
    /** Vertex array whose element buffer lists every triangle edge, for wireframe drawing. */
    wireframe(geometry: Geometry3D): {
        vao: WebGLVertexArrayObject;
        count: number;
        type: number;
    };
    private releaseWire;
    private releaseGeometry;
    /** Vertex array combining a geometry's attributes with per-instance transforms and colors. */
    instances(mesh: InstancedMesh3D, frame: number): WebGLVertexArrayObject;
    /** Float texture holding one 4x4 matrix per row (four RGBA texels). */
    bones(skeleton: Skeleton3D, frame: number): WebGLTexture;
    /** Float texture holding every baked frame: four texels per bone matrix, wrapped into rows of 2048. */
    animations(source: AnimationTexture3D): WebGLTexture;
    private applySampler;
    private image;
    private textureEntry;
    /** Bind a 2D texture to a unit, uploading new content first when its version changed. */
    bindTexture(unit: number, texture: Texture3D): void;
    /** Internal format for a compressed format on this context, or undefined when its extension is missing. */
    compressedFormat(format: CompressedFormat3D, srgb: boolean): number | undefined;
    private compressedImage;
    /** Bind a cube texture and return its highest mip level (used as a roughness scale). */
    bindCube(unit: number, texture: CubeTexture3D): number;
    /** Create or resize the framebuffer of a render target. */
    target(target: RenderTarget3D): RenderTargetGpu3D;
    private releaseTarget;
    /** Retire per-mesh and per-skeleton data that has not been drawn recently. */
    prune(frame: number): void;
    /** Forget every GPU handle without deleting it; used after the context was lost. */
    reset(): void;
    /** Delete every GPU object owned by this cache. */
    dispose(): void;
}
//# sourceMappingURL=gpuResources3D.d.ts.map