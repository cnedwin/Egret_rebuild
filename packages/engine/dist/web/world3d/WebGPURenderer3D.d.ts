import type { Camera3D } from '../../rendering/world3d/Camera3D.js';
import type { Scene3D } from '../../rendering/world3d/Object3D.js';
import { RenderTarget3D } from '../../rendering/world3d/Texture3D.js';
import type { CompressedFormat3D } from '../../rendering/world3d/Texture3D.js';
import type { PostProcessSettings3D } from './post3D.js';
import type { Renderer3D, Renderer3DInfo, ToneMapping3D } from './frame3D.js';
export interface WebGPURenderer3DOptions {
    readonly canvas: HTMLCanvasElement | OffscreenCanvas;
    /** Four-sample multisampling of the canvas pass. Defaults to true. */
    readonly antialias?: boolean;
    /** Keep an alpha channel so the page shows through where nothing is drawn. */
    readonly alpha?: boolean;
    readonly powerPreference?: GPUPowerPreference;
    readonly toneMapping?: ToneMapping3D;
    readonly exposure?: number;
    readonly shadows?: boolean;
    /** Edge of the shared shadow atlas in texels; each shadow light receives a quarter. */
    readonly shadowAtlasSize?: number;
    /** Borrow an existing device instead of requesting one; the caller keeps ownership. */
    readonly device?: GPUDevice;
    /** Called once when the device is lost. Create a new renderer to continue. */
    readonly onDeviceLost?: (message: string) => void;
}
export declare class WebGPURenderer3D implements Renderer3D {
    #private;
    readonly canvas: HTMLCanvasElement | OffscreenCanvas;
    readonly device: GPUDevice;
    toneMapping: ToneMapping3D;
    exposure: number;
    shadowsEnabled: boolean;
    /** Bloom, color grading and FXAA; set `enabled` to turn the chain on. */
    readonly postProcess: PostProcessSettings3D;
    viewport: readonly [number, number, number, number] | undefined;
    autoClear: boolean;
    readonly info: Renderer3DInfo;
    /** Use createWebGPURenderer3D(); the constructor needs an acquired device. */
    constructor(options: WebGPURenderer3DOptions, device: GPUDevice, ownsDevice: boolean);
    get isDeviceLost(): boolean;
    setSize(width: number, height: number, pixelRatio?: number): void;
    resizeToDisplaySize(pixelRatio?: number): boolean;
    private createObjectBuffer;
    private createObjectGroup;
    private createSkinGroup;
    /** Write `data` into a buffer of at least its size, recreating the buffer when it must grow. */
    private writeBuffer;
    private sampler;
    private uploadSource;
    private generateMipmaps;
    private createColorTexture;
    private textureEntry;
    /** GPU view and sampler for a 2D texture, uploading when its version changed. */
    private texture2d;
    private compressedFormat;
    /** True when textures in this compressed format can be used on this device. */
    supportsCompressedFormat(format: CompressedFormat3D): boolean;
    private textureCube;
    private target;
    private convert;
    private geometry;
    private wireframe;
    private releaseGeometry;
    private instances;
    /** Bind group holding the bone matrices and morph deltas for a mesh. */
    private skin;
    private material;
    private features;
    private pipeline;
    private writeObject;
    private resetPassState;
    private draw;
    private readonly depthItem;
    private drawDepth;
    private ensureShadowAtlas;
    private canvasAttachments;
    private colorFormat;
    private drawSkybox;
    /**
     * Draw one frame to the canvas, or into `target` when given. Returns false
     * when the device is lost and nothing was drawn.
     */
    /**
     * Draw runs of plain meshes that share a geometry and a material as one
     * instanced draw each, in the main view and in shadow maps. On by default;
     * the meshes themselves are untouched.
     */
    get autoInstancing(): boolean;
    set autoInstancing(value: boolean);
    render(scene: Scene3D, camera: Camera3D, target?: RenderTarget3D): boolean;
    /** Draw the scene into the half-float chain target, then post-process into the output. */
    private renderPost;
    /** Retire per-mesh and per-skeleton buffers that have not been drawn recently. */
    private prune;
    /** RGBA8 pixels of a render target, top row first. */
    readRenderTargetPixels(target: RenderTarget3D): Promise<Uint8Array>;
    /** Release every GPU object and unconfigure the canvas. Idempotent. */
    dispose(): void;
}
/** Acquire a device (unless one is borrowed) and create the WebGPU renderer. */
export declare function createWebGPURenderer3D(options: WebGPURenderer3DOptions): Promise<WebGPURenderer3D>;
//# sourceMappingURL=WebGPURenderer3D.d.ts.map