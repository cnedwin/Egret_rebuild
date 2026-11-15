import { Material3D } from '../../rendering/world3d/Material3D.js';
import { RenderTarget3D } from '../../rendering/world3d/Texture3D.js';
import type { ToneMapping3D } from './frame3D.js';
import type { GpuResources3D } from './gpuResources3D.js';
import type { PostProcessSettings3D, PostView3D } from './post3D.js';
export declare class PostChainWebGL23D {
    #private;
    /** Half-float scene target the renderer draws into before run(). */
    readonly scene: RenderTarget3D;
    /** Target and flat white material for the outline mask. */
    readonly mask: RenderTarget3D;
    readonly maskMaterial: Material3D;
    constructor(gl: WebGL2RenderingContext, resources: GpuResources3D);
    private surface;
    private pass;
    /**
     * Process `sceneTexture` into `output` (null for the canvas).
     * `outputEncodes` is true when the output converts linear values to sRGB on write.
     */
    run(sceneTexture: WebGLTexture, depthTexture: WebGLTexture | undefined, maskTexture: WebGLTexture | undefined, view: PostView3D, width: number, height: number, output: WebGLFramebuffer | null, outputEncodes: boolean, settings: PostProcessSettings3D, toneMapping: ToneMapping3D, vao: WebGLVertexArrayObject | null): number;
    /** Release GPU objects. Pass `lost` after a context loss, when they are already gone. */
    dispose(lost?: boolean): void;
}
//# sourceMappingURL=postWebGL23D.d.ts.map