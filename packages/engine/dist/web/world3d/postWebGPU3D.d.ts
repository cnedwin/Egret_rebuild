import { Material3D } from '../../rendering/world3d/Material3D.js';
import { RenderTarget3D } from '../../rendering/world3d/Texture3D.js';
import type { ToneMapping3D } from './frame3D.js';
import type { PostProcessSettings3D, PostView3D } from './post3D.js';
export declare class PostChainWebGPU3D {
    #private;
    /** Half-float scene target the renderer draws into before run(). */
    readonly scene: RenderTarget3D;
    /** Target and flat white material for the outline mask. */
    readonly mask: RenderTarget3D;
    readonly maskMaterial: Material3D;
    constructor(device: GPUDevice);
    private surface;
    private pipeline;
    private pass;
    /**
     * Process `sceneView` into `output`. `outputEncodes` is true when the
     * output format converts linear values to sRGB on write.
     */
    run(encoder: GPUCommandEncoder, sceneView: GPUTextureView, depthView: GPUTextureView | undefined, maskView: GPUTextureView | undefined, view: PostView3D, width: number, height: number, output: GPUTextureView, outputFormat: GPUTextureFormat, outputEncodes: boolean, settings: PostProcessSettings3D, toneMapping: ToneMapping3D): number;
    dispose(): void;
}
//# sourceMappingURL=postWebGPU3D.d.ts.map