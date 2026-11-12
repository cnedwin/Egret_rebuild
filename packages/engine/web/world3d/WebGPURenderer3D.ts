// SPDX-License-Identifier: Apache-2.0
// WebGPU backend for the world3d scene graph. It consumes the same render
// list, frame block and shadow plan as the WebGL2 backend and mirrors its
// passes: shadow atlas, sorted opaque draws, skybox, back-to-front blending.
// Scene matrices keep OpenGL clip conventions; the shaders remap depth.
import type {Camera3D} from '../../rendering/world3d/Camera3D.js';
import {World3DError} from '../../rendering/world3d/core3D.js';
import type {Attribute3D, Geometry3D} from '../../rendering/world3d/Geometry3D.js';
import type {Light3D} from '../../rendering/world3d/Light3D.js';
import type {Material3D} from '../../rendering/world3d/Material3D.js';
import {linearToSrgb, mat3NormalFromMat4, mat4Invert} from '../../rendering/world3d/math3D.js';
import type {InstancedMesh3D, Mesh3D, Skeleton3D} from '../../rendering/world3d/Mesh3D.js';
import {type AnimationTexture3D, SkinnedInstancedMesh3D} from '../../rendering/world3d/AnimationTexture3D.js';
import {GpuParticles3D} from '../../rendering/world3d/GpuParticles3D.js';
import type {Scene3D} from '../../rendering/world3d/Object3D.js';
import {RenderList3D} from '../../rendering/world3d/RenderList3D.js';
import type {RenderItem3D} from '../../rendering/world3d/RenderList3D.js';
import {COMPRESSED_BLOCK_BYTES_3D, CubeTexture3D, RenderTarget3D, isCompressedPixels3D, isTexturePixels3D} from '../../rendering/world3d/Texture3D.js';
import type {CompressedFormat3D} from '../../rendering/world3d/Texture3D.js';
import type {Texture3D, TextureSource3D} from '../../rendering/world3d/Texture3D.js';
import {FRAME_BLOCK_FLOATS_3D, FRAME_OFFSETS_3D, planShadows3D, writeFrameBlock3D} from './frame3D.js';
import {createPostProcessSettings3D, outlineActive3D, postViewFromCamera3D} from './post3D.js';
import type {PostProcessSettings3D} from './post3D.js';
import {PostChainWebGPU3D} from './postWebGPU3D.js';
import type {Renderer3D, Renderer3DInfo, ToneMapping3D} from './frame3D.js';
import {
    MATERIAL_BLOCK_BYTES_3D, MAX_MORPH_INFLUENCES_WGSL_3D, MIPMAP_WGSL_3D, OBJECT_BLOCK_BYTES_3D, SKYBOX_WGSL_3D, buildMaterialWgsl3D,
    shaderFeatureKey3D,
} from './wgsl3D.js';
import type {ShaderFeatures3D} from './wgsl3D.js';

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

type PassKind = 'canvas' | 'target' | 'hdr' | 'depth' | 'scene-depth';
interface BufferGpu { buffer: GPUBuffer; version: number; bytes: number; }
interface GeometryGpu {
    readonly buffers: Map<string, BufferGpu>;
    index: (BufferGpu & {format: GPUIndexFormat}) | undefined;
    wire: {buffer: GPUBuffer; count: number; version: number} | undefined;
    morph: {buffer: GPUBuffer; channels: number; vertexCount: number} | undefined;
    layoutVersion: number;
    /** Render-call serial of the last version check. */
    serial: number;
    readonly unsubscribe: () => void;
}
interface InstanceGpu { matrices: BufferGpu; colors: BufferGpu | undefined; animation?: BufferGpu; version: number; lastFrame: number; }
interface TextureGpu { texture: GPUTexture; view: GPUTextureView; sampler: GPUSampler; version: number; maxMip: number; readonly unsubscribe: () => void; }
interface TargetGpu { color: GPUTexture; colorView: GPUTextureView; depth: GPUTexture | undefined; depthView: GPUTextureView | undefined; version: number; readonly unsubscribe: () => void; }
interface MaterialGpu { readonly buffer: GPUBuffer; group: GPUBindGroup | undefined; key: string; serial: number; readonly unsubscribe: () => void; }
interface SkinGpu { group: GPUBindGroup; bones: GPUBuffer; morph: GPUBuffer; }
interface BonesGpu { buffer: GPUBuffer; version: number; count: number; lastFrame: number; }

// WebGPU flag values, spelled out so this module needs no global constant namespaces.
const SHADER_STAGE = Object.freeze({VERTEX: 1, FRAGMENT: 2} as const);
const BUFFER_USAGE = Object.freeze({MAP_READ: 1, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128} as const);
const TEXTURE_USAGE = Object.freeze({COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, RENDER_ATTACHMENT: 16} as const);
const MAP_MODE_READ = 1;
const ATTRIBUTE_SLOTS = ['position', 'normal', 'uv', 'tangent', 'color', 'joints', 'weights', 'uv1'] as const;
const TARGET_FORMAT: GPUTextureFormat = 'rgba8unorm-srgb', HDR_FORMAT: GPUTextureFormat = 'rgba16float';
const SHADOW_FORMAT: GPUTextureFormat = 'depth32float';
const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';
const IDENTITY4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const PRUNE_INTERVAL = 600;

function hostSize(source: object): [number, number] {
    const size = source as {width?: number; height?: number; videoWidth?: number; videoHeight?: number};
    return [Math.max(1, size.videoWidth ?? size.width ?? 1), Math.max(1, size.videoHeight ?? size.height ?? 1)];
}

// The device loss promise can outlive a renderer that borrows the device.
function observeDeviceLoss(device: GPUDevice, listener: ((info: GPUDeviceLostInfo) => void) | undefined): () => void {
    void device.lost.then(info => {
        const callback = listener;
        listener = undefined;
        callback?.(info);
    });
    return () => { listener = undefined; };
}

export class WebGPURenderer3D implements Renderer3D {
    readonly canvas: HTMLCanvasElement | OffscreenCanvas;
    readonly device: GPUDevice;
    toneMapping: ToneMapping3D;
    exposure: number;
    shadowsEnabled: boolean;
    /** Bloom, color grading and FXAA; set `enabled` to turn the chain on. */
    readonly postProcess: PostProcessSettings3D = createPostProcessSettings3D();
    viewport: readonly [number, number, number, number] | undefined;
    autoClear = true;
    #post: PostChainWebGPU3D | undefined;
    #inPost = false;
    readonly info: Renderer3DInfo = {frame: 0, drawCalls: 0, triangles: 0, visited: 0, culled: 0, shadowMaps: 0, programs: 0, geometries: 0, textures: 0};
    readonly #context: GPUCanvasContext;
    readonly #format: GPUTextureFormat;
    readonly #sampleCount: number;
    readonly #alpha: boolean;
    readonly #ownsDevice: boolean;
    readonly #list = new RenderList3D();
    readonly #frameData = new Float32Array(FRAME_BLOCK_FLOATS_3D);
    readonly #frameBuffer: GPUBuffer;
    readonly #frameLayout: GPUBindGroupLayout;
    readonly #depthFrameLayout: GPUBindGroupLayout;
    readonly #materialLayout: GPUBindGroupLayout;
    readonly #objectLayout: GPUBindGroupLayout;
    readonly #skinLayout: GPUBindGroupLayout;
    readonly #pipelineLayout: GPUPipelineLayout;
    readonly #depthPipelineLayout: GPUPipelineLayout;
    readonly #modules = new Map<string, GPUShaderModule>();
    readonly #pipelines = new Map<string, GPURenderPipeline>();
    readonly #geometries = new Map<Geometry3D, GeometryGpu>();
    readonly #instances = new Map<InstancedMesh3D, InstanceGpu>();
    readonly #textures = new Map<Texture3D | CubeTexture3D, TextureGpu>();
    readonly #targets = new Map<RenderTarget3D, TargetGpu>();
    readonly #materials = new Map<Material3D, MaterialGpu>();
    readonly #bones = new Map<Skeleton3D, BonesGpu>();
    readonly #animations = new Map<AnimationTexture3D, GPUBuffer>();
    #sceneDepth: {texture: GPUTexture; view: GPUTextureView; buffer: GPUBuffer; group: GPUBindGroup} | undefined;
    /** True while the frame being drawn has a depth image of its solid geometry. */
    #softDepth = false;
    #sceneDepthSerial = 0;
    readonly #skins = new WeakMap<Mesh3D, SkinGpu>();
    readonly #samplers = new Map<string, GPUSampler>();
    readonly #mipPipelines = new Map<GPUTextureFormat, GPURenderPipeline>();
    readonly #shadowSlots = new Map<Light3D, number>();
    readonly #depthFrames: {buffer: GPUBuffer; group: GPUBindGroup}[] = [];
    readonly #whiteTexture: GPUTexture;
    readonly #whiteCubeTexture: GPUTexture;
    readonly #white: GPUTextureView;
    readonly #whiteCube: GPUTextureView;
    readonly #unsubscribeDeviceLoss: () => void;
    readonly #defaultSampler: GPUSampler;
    readonly #shadowSampler: GPUSampler;
    readonly #dummyBones: GPUBuffer;
    readonly #dummyMorph: GPUBuffer;
    readonly #dummySkin: GPUBindGroup;
    readonly #shadowAtlasSize: number;
    #shadowTexture: GPUTexture | undefined;
    #shadowView: GPUTextureView | undefined;
    #frameGroup: GPUBindGroup | undefined;
    readonly #grabSampler: GPUSampler;
    /** Copies of the output for see-through surfaces, one per kind of output. */
    readonly #grabs = new Map<string, {texture: GPUTexture; view: GPUTextureView; group: GPUBindGroup | undefined; key: string}>();
    #frameGroupKey = '';
    #objectBuffer: GPUBuffer;
    #objectGroup: GPUBindGroup;
    #objectCapacity = 256;
    #objectStaging = new ArrayBuffer(256 * OBJECT_BLOCK_BYTES_3D);
    #objectFloats = new Float32Array(this.#objectStaging);
    #objectInts = new Int32Array(this.#objectStaging);
    #objectCount = 0;
    #canvasDepth: GPUTexture | undefined;
    #canvasColor: GPUTexture | undefined;
    #canvasKey = '';
    #skyBuffer: GPUBuffer | undefined;
    #skyGroup: {group: GPUBindGroup; key: string} | undefined;
    #skyLayout: GPUBindGroupLayout | undefined;
    #serial = 0;
    #shadowCount = 0;
    #lost = false;
    #disposed = false;
    readonly #scratch16 = new Float32Array(16);
    readonly #scratch9 = new Float32Array(9);
    readonly #materialData = new Float32Array(MATERIAL_BLOCK_BYTES_3D / 4);

    /** Use createWebGPURenderer3D(); the constructor needs an acquired device. */
    constructor(options: WebGPURenderer3DOptions, device: GPUDevice, ownsDevice: boolean) {
        const canvas = options.canvas;
        const context = (canvas as HTMLCanvasElement).getContext('webgpu') as GPUCanvasContext | null;
        if (!context) throw new World3DError('WORLD3D_CONTEXT_UNAVAILABLE', 'webgpu canvas context');
        this.canvas = canvas;
        this.device = device;
        this.#ownsDevice = ownsDevice;
        this.#context = context;
        this.#format = navigator.gpu.getPreferredCanvasFormat();
        this.#alpha = options.alpha ?? false;
        this.#sampleCount = (options.antialias ?? true) ? 4 : 1;
        this.toneMapping = options.toneMapping ?? 'aces';
        this.exposure = options.exposure ?? 1;
        this.shadowsEnabled = options.shadows ?? true;
        this.#shadowAtlasSize = Math.min(options.shadowAtlasSize ?? 2048, device.limits.maxTextureDimension2D);
        // The canvas image is copied when see-through surfaces need what lies behind them.
        context.configure({device, format: this.#format, alphaMode: this.#alpha ? 'premultiplied' : 'opaque', usage: TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.COPY_SRC});

        const filtering: GPUBindGroupLayoutEntry[] = [];
        for (let i = 0; i < 7; i++) {
            filtering.push({binding: 1 + i * 2, visibility: SHADER_STAGE.FRAGMENT, texture: {}});
            filtering.push({binding: 2 + i * 2, visibility: SHADER_STAGE.FRAGMENT, sampler: {}});
        }
        const both = SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT;
        this.#frameLayout = device.createBindGroupLayout({entries: [
            {binding: 0, visibility: both, buffer: {}},
            {binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: {sampleType: 'depth'}},
            {binding: 2, visibility: SHADER_STAGE.FRAGMENT, sampler: {type: 'comparison'}},
            {binding: 3, visibility: SHADER_STAGE.FRAGMENT, texture: {viewDimension: 'cube'}},
            {binding: 4, visibility: SHADER_STAGE.FRAGMENT, sampler: {}},
            {binding: 5, visibility: SHADER_STAGE.FRAGMENT, texture: {}},
            {binding: 6, visibility: SHADER_STAGE.FRAGMENT, sampler: {}},
            {binding: 7, visibility: SHADER_STAGE.FRAGMENT, texture: {sampleType: 'depth'}},
        ]});
        this.#depthFrameLayout = device.createBindGroupLayout({entries: [{binding: 0, visibility: both, buffer: {}}]});
        this.#materialLayout = device.createBindGroupLayout({entries: [{binding: 0, visibility: both, buffer: {}}, ...filtering]});
        this.#objectLayout = device.createBindGroupLayout({entries: [
            {binding: 0, visibility: both, buffer: {hasDynamicOffset: true, minBindingSize: OBJECT_BLOCK_BYTES_3D}},
        ]});
        this.#skinLayout = device.createBindGroupLayout({entries: [
            {binding: 0, visibility: SHADER_STAGE.VERTEX, buffer: {type: 'read-only-storage'}},
            {binding: 1, visibility: SHADER_STAGE.VERTEX, buffer: {type: 'read-only-storage'}},
        ]});
        this.#pipelineLayout = device.createPipelineLayout({bindGroupLayouts: [this.#frameLayout, this.#materialLayout, this.#objectLayout, this.#skinLayout]});
        this.#depthPipelineLayout = device.createPipelineLayout({bindGroupLayouts: [this.#depthFrameLayout, this.#materialLayout, this.#objectLayout, this.#skinLayout]});

        this.#frameBuffer = device.createBuffer({size: FRAME_BLOCK_FLOATS_3D * 4, usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST});
        this.#objectBuffer = this.createObjectBuffer();
        this.#objectGroup = this.createObjectGroup();
        const white = this.#whiteTexture = device.createTexture({size: [1, 1], format: 'rgba8unorm', usage: TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST});
        device.queue.writeTexture({texture: white}, new Uint8Array([255, 255, 255, 255]), {}, [1, 1]);
        this.#white = white.createView();
        const whiteCube = this.#whiteCubeTexture = device.createTexture({size: [1, 1, 6], format: 'rgba8unorm', usage: TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST});
        for (let face = 0; face < 6; face++) device.queue.writeTexture({texture: whiteCube, origin: [0, 0, face]}, new Uint8Array([255, 255, 255, 255]), {}, [1, 1]);
        this.#whiteCube = whiteCube.createView({dimension: 'cube'});
        this.#defaultSampler = device.createSampler({magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear'});
        this.#shadowSampler = device.createSampler({compare: 'less-equal', magFilter: 'linear', minFilter: 'linear'});
        this.#grabSampler = device.createSampler({magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge'});
        this.#dummyBones = device.createBuffer({size: 64, usage: BUFFER_USAGE.STORAGE});
        this.#dummyMorph = device.createBuffer({size: 16, usage: BUFFER_USAGE.STORAGE});
        this.#dummySkin = this.createSkinGroup(this.#dummyBones, this.#dummyMorph);
        this.#unsubscribeDeviceLoss = observeDeviceLoss(device, info => {
            this.#lost = true;
            options.onDeviceLost?.(info.message);
        });
    }
    get isDeviceLost(): boolean { return this.#lost; }

    setSize(width: number, height: number, pixelRatio = 1): void {
        const w = Math.max(1, Math.floor(width * pixelRatio)), h = Math.max(1, Math.floor(height * pixelRatio));
        if (!Number.isFinite(w) || !Number.isFinite(h)) throw new World3DError('WORLD3D_INPUT_INVALID', 'size');
        if (this.canvas.width !== w) this.canvas.width = w;
        if (this.canvas.height !== h) this.canvas.height = h;
    }
    resizeToDisplaySize(pixelRatio = 1): boolean {
        const element = this.canvas as HTMLCanvasElement;
        if (typeof element.clientWidth !== 'number') return false;
        const w = Math.max(1, Math.floor(element.clientWidth * pixelRatio)), h = Math.max(1, Math.floor(element.clientHeight * pixelRatio));
        if (element.width === w && element.height === h) return false;
        element.width = w; element.height = h;
        return true;
    }

    // ---- small GPU helpers -----------------------------------------------------
    private createObjectBuffer(): GPUBuffer {
        return this.device.createBuffer({size: this.#objectCapacity * OBJECT_BLOCK_BYTES_3D, usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST});
    }
    private createObjectGroup(): GPUBindGroup {
        return this.device.createBindGroup({layout: this.#objectLayout, entries: [{binding: 0, resource: {buffer: this.#objectBuffer, size: OBJECT_BLOCK_BYTES_3D}}]});
    }
    private createSkinGroup(bones: GPUBuffer, morph: GPUBuffer): GPUBindGroup {
        return this.device.createBindGroup({layout: this.#skinLayout, entries: [{binding: 0, resource: {buffer: bones}}, {binding: 1, resource: {buffer: morph}}]});
    }
    /** Write `data` into a buffer of at least its size, recreating the buffer when it must grow. */
    private writeBuffer(entry: BufferGpu | undefined, data: Float32Array | Uint32Array | Uint16Array, usage: number, length = data.length): BufferGpu {
        const bytes = Math.max(4, Math.ceil(length * data.BYTES_PER_ELEMENT / 4) * 4);
        let target = entry;
        if (!target || target.bytes < bytes) {
            target?.buffer.destroy();
            target = {buffer: this.device.createBuffer({size: bytes, usage: usage | BUFFER_USAGE.COPY_DST}), version: -1, bytes};
        }
        // Uint16 index data may end on a 2-byte boundary; pad the final write to 4 bytes.
        if ((length * data.BYTES_PER_ELEMENT) % 4 === 0) this.device.queue.writeBuffer(target.buffer, 0, data.buffer as ArrayBuffer, data.byteOffset, length * data.BYTES_PER_ELEMENT);
        else {
            const padded = new Uint16Array(length + 1);
            padded.set((data as Uint16Array).subarray(0, length));
            this.device.queue.writeBuffer(target.buffer, 0, padded);
        }
        return target;
    }
    private sampler(texture: Texture3D | CubeTexture3D): GPUSampler {
        const anisotropy = texture.magFilter === 'linear' && texture.minFilter === 'linear' && texture.mipmaps ? Math.min(Math.max(Math.floor(texture.anisotropy), 1), 16) : 1;
        const key = texture.wrapS + texture.wrapT + texture.magFilter + texture.minFilter + texture.mipmaps + anisotropy;
        let sampler = this.#samplers.get(key);
        if (!sampler) {
            const wrap = (mode: string): GPUAddressMode => mode === 'clamp' ? 'clamp-to-edge' : mode === 'mirror' ? 'mirror-repeat' : 'repeat';
            sampler = this.device.createSampler({
                addressModeU: wrap(texture.wrapS), addressModeV: wrap(texture.wrapT), addressModeW: 'clamp-to-edge',
                magFilter: texture.magFilter, minFilter: texture.minFilter, mipmapFilter: texture.mipmaps ? 'linear' : 'nearest', maxAnisotropy: anisotropy,
            });
            this.#samplers.set(key, sampler);
        }
        return sampler;
    }

    // ---- textures ---------------------------------------------------------------
    private uploadSource(texture: GPUTexture, source: TextureSource3D, layer: number, flipY: boolean): void {
        const queue = this.device.queue;
        if (isTexturePixels3D(source)) {
            let data = source.data;
            if (flipY) {
                const row = source.width * 4, flipped = new Uint8Array(data.length);
                for (let y = 0; y < source.height; y++) flipped.set(data.subarray(y * row, y * row + row), (source.height - 1 - y) * row);
                data = flipped;
            }
            queue.writeTexture({texture, origin: [0, 0, layer]}, data.buffer as ArrayBuffer, {offset: data.byteOffset, bytesPerRow: source.width * 4, rowsPerImage: source.height}, [source.width, source.height]);
            return;
        }
        const [width, height] = hostSize(source);
        queue.copyExternalImageToTexture({source: source as GPUCopyExternalImageSource, flipY}, {texture, origin: [0, 0, layer]}, [width, height]);
    }
    private generateMipmaps(texture: GPUTexture, layers: number): void {
        const device = this.device, format = texture.format;
        let pipeline = this.#mipPipelines.get(format);
        if (!pipeline) {
            const module = device.createShaderModule({code: MIPMAP_WGSL_3D});
            pipeline = device.createRenderPipeline({
                layout: 'auto', vertex: {module, entryPoint: 'vertexMain'}, fragment: {module, entryPoint: 'fragmentMain', targets: [{format}]},
                primitive: {topology: 'triangle-list'},
            });
            this.#mipPipelines.set(format, pipeline);
        }
        const encoder = device.createCommandEncoder();
        for (let layer = 0; layer < layers; layer++) {
            for (let level = 1; level < texture.mipLevelCount; level++) {
                const source = texture.createView({dimension: '2d', baseMipLevel: level - 1, mipLevelCount: 1, baseArrayLayer: layer, arrayLayerCount: 1});
                const pass = encoder.beginRenderPass({colorAttachments: [{
                    view: texture.createView({dimension: '2d', baseMipLevel: level, mipLevelCount: 1, baseArrayLayer: layer, arrayLayerCount: 1}),
                    loadOp: 'clear', storeOp: 'store',
                }]});
                pass.setPipeline(pipeline);
                pass.setBindGroup(0, device.createBindGroup({layout: pipeline.getBindGroupLayout(0), entries: [{binding: 0, resource: source}, {binding: 1, resource: this.#defaultSampler}]}));
                pass.draw(3);
                pass.end();
            }
        }
        device.queue.submit([encoder.finish()]);
    }
    private createColorTexture(width: number, height: number, layers: number, texture: Texture3D | CubeTexture3D): GPUTexture {
        const limit = this.device.limits.maxTextureDimension2D;
        if (width > limit || height > limit) throw new World3DError('WORLD3D_BUDGET', 'texture size');
        return this.device.createTexture({
            size: [width, height, layers], format: texture.colorSpace === 'srgb' ? 'rgba8unorm-srgb' : 'rgba8unorm',
            mipLevelCount: texture.mipmaps ? Math.floor(Math.log2(Math.max(width, height))) + 1 : 1,
            usage: TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST | TEXTURE_USAGE.RENDER_ATTACHMENT,
        });
    }
    private textureEntry(texture: Texture3D | CubeTexture3D, create: () => {texture: GPUTexture; view: GPUTextureView}): TextureGpu {
        let entry = this.#textures.get(texture);
        if (entry && entry.version === texture.version) return entry;
        const {texture: gpu, view} = create();
        const previous = entry?.texture;
        if (entry) { entry.texture = gpu; entry.view = view; }
        else {
            const created: TextureGpu = {texture: gpu, view, sampler: this.#defaultSampler, version: -1, maxMip: 0, unsubscribe: texture.onDispose(() => {
                const current = this.#textures.get(texture);
                if (current && this.#textures.delete(texture)) current.texture.destroy();
            })};
            this.#textures.set(texture, entry = created);
        }
        previous?.destroy();
        entry.sampler = this.sampler(texture);
        entry.maxMip = gpu.mipLevelCount - 1;
        entry.version = texture.version;
        return entry;
    }
    /** GPU view and sampler for a 2D texture, uploading when its version changed. */
    private texture2d(texture: Texture3D): {view: GPUTextureView; sampler: GPUSampler; key: string} {
        const source = texture.source;
        if (source instanceof RenderTarget3D) {
            // A target's texture samples the color attachment directly.
            const target = this.target(source);
            return {view: target.colorView, sampler: this.sampler(texture), key: 't' + source.id + ':' + source.version};
        }
        const entry = this.textureEntry(texture, () => {
            if (isCompressedPixels3D(source)) {
                const format = this.compressedFormat(source.format, texture.colorSpace === 'srgb');
                if (!format) throw new World3DError('WORLD3D_RESOURCE_FAILED', 'compressed format ' + source.format + ' is not supported by this device');
                const block = COMPRESSED_BLOCK_BYTES_3D[source.format];
                // The base size must be block-aligned; smaller mips are padded to whole blocks on upload.
                const gpu = this.device.createTexture({
                    size: [Math.ceil(source.width / 4) * 4, Math.ceil(source.height / 4) * 4], format, mipLevelCount: source.levels.length,
                    usage: TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST,
                });
                let width = gpu.width, height = gpu.height;
                source.levels.forEach((level, mipLevel) => {
                    const columns = Math.ceil(width / 4), rows = Math.ceil(height / 4);
                    this.device.queue.writeTexture({texture: gpu, mipLevel}, level.buffer as ArrayBuffer, {offset: level.byteOffset, bytesPerRow: columns * block, rowsPerImage: rows}, [columns * 4, rows * 4]);
                    width = Math.max(1, width >> 1); height = Math.max(1, height >> 1);
                });
                return {texture: gpu, view: gpu.createView()};
            }
            const [width, height] = isTexturePixels3D(source) ? [source.width, source.height] : hostSize(source);
            const gpu = this.createColorTexture(width, height, 1, texture);
            this.uploadSource(gpu, source, 0, texture.flipY);
            if (gpu.mipLevelCount > 1) this.generateMipmaps(gpu, 1);
            return {texture: gpu, view: gpu.createView()};
        });
        return {view: entry.view, sampler: entry.sampler, key: texture.id + ':' + texture.version};
    }
    private compressedFormat(format: CompressedFormat3D, srgb: boolean): GPUTextureFormat | undefined {
        const table: Record<CompressedFormat3D, [GPUFeatureName, string]> = {
            'bc1': ['texture-compression-bc', 'bc1-rgba-unorm'], 'bc3': ['texture-compression-bc', 'bc3-rgba-unorm'], 'bc7': ['texture-compression-bc', 'bc7-rgba-unorm'],
            'etc2-rgb8': ['texture-compression-etc2', 'etc2-rgb8unorm'], 'etc2-rgba8': ['texture-compression-etc2', 'etc2-rgba8unorm'],
            'astc-4x4': ['texture-compression-astc', 'astc-4x4-unorm'],
        };
        const entry = table[format];
        if (!entry || !this.device.features.has(entry[0])) return undefined;
        return (entry[1] + (srgb ? '-srgb' : '')) as GPUTextureFormat;
    }
    /** True when textures in this compressed format can be used on this device. */
    supportsCompressedFormat(format: CompressedFormat3D): boolean {
        return this.compressedFormat(format, false) !== undefined;
    }
    private textureCube(texture: CubeTexture3D): TextureGpu {
        return this.textureEntry(texture, () => {
            const first = texture.faces[0]!, size = isTexturePixels3D(first) ? first.width : hostSize(first)[0];
            const gpu = this.createColorTexture(size, size, 6, texture);
            texture.faces.forEach((face, layer) => this.uploadSource(gpu, face, layer, false));
            if (gpu.mipLevelCount > 1) this.generateMipmaps(gpu, 6);
            return {texture: gpu, view: gpu.createView({dimension: 'cube'})};
        });
    }
    private target(target: RenderTarget3D): TargetGpu {
        if (target.isDisposed) throw new World3DError('WORLD3D_DISPOSED', 'render target');
        let entry = this.#targets.get(target);
        if (entry && entry.version === target.version) return entry;
        const limit = this.device.limits.maxTextureDimension2D;
        if (target.width > limit || target.height > limit) throw new World3DError('WORLD3D_BUDGET', 'render target size');
        const color = this.device.createTexture({
            size: [target.width, target.height], format: target.format === 'rgba16f' ? HDR_FORMAT : TARGET_FORMAT,
            usage: TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_SRC,
        });
        const depth = target.depth ? this.device.createTexture({size: [target.width, target.height], format: DEPTH_FORMAT, usage: target.depthTexture ? TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING : TEXTURE_USAGE.RENDER_ATTACHMENT}) : undefined;
        if (entry) {
            entry.color.destroy(); entry.depth?.destroy();
            entry.color = color; entry.colorView = color.createView(); entry.depth = depth; entry.depthView = depth?.createView();
        } else {
            const created: TargetGpu = {color, colorView: color.createView(), depth, depthView: depth?.createView(), version: -1, unsubscribe: target.onDispose(() => {
                const current = this.#targets.get(target);
                if (current && this.#targets.delete(target)) { current.color.destroy(); current.depth?.destroy(); }
            })};
            this.#targets.set(target, entry = created);
        }
        entry.version = target.version;
        return entry;
    }

    // ---- geometry ---------------------------------------------------------------
    private convert(name: string, attribute: Attribute3D): Float32Array | Uint32Array {
        const data = attribute.data;
        // Joint indices stay integers; everything else is uploaded as 32-bit floats,
        // which sidesteps the vertex formats WebGPU does not offer.
        if (name === 'joints') return data instanceof Uint32Array ? data : Uint32Array.from(data);
        if (data instanceof Float32Array) return data;
        const out = new Float32Array(data.length);
        if (!attribute.normalized) { out.set(data); return out; }
        const signed = data instanceof Int8Array || data instanceof Int16Array, max = signed ? (data instanceof Int8Array ? 127 : 32767) : (data instanceof Uint8Array ? 255 : data instanceof Uint16Array ? 65535 : 4294967295);
        for (let i = 0; i < data.length; i++) out[i] = signed ? Math.max(data[i]! / max, -1) : data[i]! / max;
        return out;
    }
    private geometry(geometry: Geometry3D): GeometryGpu {
        let entry = this.#geometries.get(geometry);
        // Buffers are checked against the CPU versions once per render call.
        if (entry && entry.serial === this.#serial) return entry;
        if (!entry) {
            const created: GeometryGpu = {buffers: new Map(), index: undefined, wire: undefined, morph: undefined, layoutVersion: -1, serial: -1, unsubscribe: geometry.onDispose(() => this.releaseGeometry(geometry))};
            this.#geometries.set(geometry, entry = created);
        }
        for (const name of ATTRIBUTE_SLOTS) {
            const attribute = geometry.getAttribute(name), current = entry.buffers.get(name);
            if (!attribute) { if (current) { current.buffer.destroy(); entry.buffers.delete(name); } continue; }
            if (current && current.version === attribute.version) continue;
            const next = this.writeBuffer(current, this.convert(name, attribute), BUFFER_USAGE.VERTEX);
            next.version = attribute.version;
            entry.buffers.set(name, next);
        }
        const index = geometry.index;
        if (index) {
            if (!entry.index || entry.index.version !== index.version) {
                const data = index.data instanceof Uint32Array || index.data instanceof Uint16Array ? index.data : Uint16Array.from(index.data);
                const next = this.writeBuffer(entry.index, data, BUFFER_USAGE.INDEX);
                entry.index = {buffer: next.buffer, bytes: next.bytes, version: index.version, format: data instanceof Uint32Array ? 'uint32' : 'uint16'};
            }
        } else if (entry.index) { entry.index.buffer.destroy(); entry.index = undefined; }
        if (entry.layoutVersion !== geometry.layoutVersion) {
            entry.morph?.buffer.destroy();
            entry.morph = undefined;
            const targets = geometry.morphTargets;
            if (targets.length > 0) {
                const vertexCount = geometry.vertexCount, channels = targets.some(target => target.normal) ? 2 : 1;
                const data = new Float32Array(targets.length * channels * vertexCount * 4);
                targets.forEach((target, t) => {
                    [target.position, target.normal].slice(0, channels).forEach((source, k) => {
                        if (!source) return;
                        const base = (t * channels + k) * vertexCount * 4;
                        for (let v = 0; v < vertexCount; v++) {
                            data[base + v * 4] = source[v * 3]!; data[base + v * 4 + 1] = source[v * 3 + 1]!; data[base + v * 4 + 2] = source[v * 3 + 2]!;
                        }
                    });
                });
                if (data.byteLength > this.device.limits.maxStorageBufferBindingSize) throw new World3DError('WORLD3D_BUDGET', 'morph target data');
                entry.morph = {buffer: this.writeBuffer(undefined, data, BUFFER_USAGE.STORAGE).buffer, channels, vertexCount};
            }
            entry.wire?.buffer.destroy();
            entry.wire = undefined;
            entry.layoutVersion = geometry.layoutVersion;
        }
        entry.serial = this.#serial;
        return entry;
    }
    private wireframe(geometry: Geometry3D, entry: GeometryGpu): {buffer: GPUBuffer; count: number} {
        if (entry.wire && entry.wire.version === geometry.version) return entry.wire;
        const source = geometry.index?.data, triangles = Math.floor(geometry.drawCount / 3), lines = new Uint32Array(triangles * 6);
        for (let t = 0; t < triangles; t++) {
            const a = source ? source[t * 3]! : t * 3, b = source ? source[t * 3 + 1]! : t * 3 + 1, c = source ? source[t * 3 + 2]! : t * 3 + 2;
            lines.set([a, b, b, c, c, a], t * 6);
        }
        entry.wire?.buffer.destroy();
        const wire = {buffer: this.writeBuffer(undefined, lines, BUFFER_USAGE.INDEX).buffer, count: lines.length, version: geometry.version};
        entry.wire = wire;
        return wire;
    }
    private releaseGeometry(geometry: Geometry3D): void {
        const entry = this.#geometries.get(geometry);
        if (!entry) return;
        this.#geometries.delete(geometry);
        for (const buffer of entry.buffers.values()) buffer.buffer.destroy();
        entry.index?.buffer.destroy(); entry.wire?.buffer.destroy(); entry.morph?.buffer.destroy();
    }
    private instances(mesh: InstancedMesh3D, frame: number): InstanceGpu {
        let entry = this.#instances.get(mesh);
        if (!entry) this.#instances.set(mesh, entry = {matrices: this.writeBuffer(undefined, mesh.instanceMatrices, BUFFER_USAGE.VERTEX), colors: undefined, version: -1, lastFrame: frame});
        entry.lastFrame = frame;
        if (entry.version !== mesh.instanceVersion) {
            entry.matrices = this.writeBuffer(entry.matrices, mesh.instanceMatrices, BUFFER_USAGE.VERTEX);
            if (mesh.instanceColors) entry.colors = this.writeBuffer(entry.colors, mesh.instanceColors, BUFFER_USAGE.VERTEX);
            if (mesh instanceof SkinnedInstancedMesh3D) entry.animation = this.writeBuffer(entry.animation, mesh.instanceAnimation, BUFFER_USAGE.VERTEX);
            entry.version = mesh.instanceVersion;
        }
        return entry;
    }
    /** Bind group holding the bone matrices and morph deltas for a mesh. */
    private skin(mesh: Mesh3D, gpu: GeometryGpu, skinned: boolean, frame: number): GPUBindGroup {
        const crowd = !skinned && mesh instanceof SkinnedInstancedMesh3D ? mesh.animations : undefined;
        if (!skinned && !gpu.morph && !crowd) return this.#dummySkin;
        let bonesBuffer = this.#dummyBones;
        if (crowd) {
            // Baked poses are uploaded once and stay until the table is disposed.
            let table = this.#animations.get(crowd);
            if (!table) {
                table = this.device.createBuffer({size: crowd.data.byteLength, usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST});
                this.device.queue.writeBuffer(table, 0, crowd.data.buffer as ArrayBuffer, crowd.data.byteOffset, crowd.data.byteLength);
                this.#animations.set(crowd, table);
                const created = table;
                crowd.onDispose(() => { if (this.#animations.get(crowd) === created) { created.destroy(); this.#animations.delete(crowd); } });
            }
            bonesBuffer = table;
        }
        if (skinned) {
            const skeleton = mesh.skeleton!, count = skeleton.bones.length;
            let bones = this.#bones.get(skeleton);
            if (!bones || bones.count !== count) {
                bones?.buffer.destroy();
                bones = {buffer: this.device.createBuffer({size: Math.max(count, 1) * 64, usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST}), version: -1, count, lastFrame: frame};
                this.#bones.set(skeleton, bones);
            }
            bones.lastFrame = frame;
            if (bones.version !== skeleton.version && count > 0) {
                this.device.queue.writeBuffer(bones.buffer, 0, skeleton.boneMatrices.buffer as ArrayBuffer, skeleton.boneMatrices.byteOffset, skeleton.boneMatrices.byteLength);
                bones.version = skeleton.version;
            }
            bonesBuffer = bones.buffer;
        }
        const morphBuffer = gpu.morph?.buffer ?? this.#dummyMorph;
        let entry = this.#skins.get(mesh);
        if (!entry || entry.bones !== bonesBuffer || entry.morph !== morphBuffer) {
            entry = {group: this.createSkinGroup(bonesBuffer, morphBuffer), bones: bonesBuffer, morph: morphBuffer};
            this.#skins.set(mesh, entry);
        }
        return entry.group;
    }

    // ---- materials and pipelines ---------------------------------------------------
    private material(material: Material3D): GPUBindGroup {
        let entry = this.#materials.get(material);
        if (!entry) {
            const buffer = this.device.createBuffer({size: MATERIAL_BLOCK_BYTES_3D, usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST});
            const created: MaterialGpu = {buffer, group: undefined, key: '', serial: -1, unsubscribe: material.onDispose(() => {
                if (this.#materials.delete(material)) buffer.destroy();
            })};
            this.#materials.set(material, entry = created);
        }
        if (entry.serial === this.#serial && entry.group) return entry.group;
        entry.serial = this.#serial;
        // Scalars are rewritten once per frame so plain field edits need no touch().
        const data = this.#materialData, e = material.emissiveIntensity, map = material.map;
        data[0] = material.color[0]!; data[1] = material.color[1]!; data[2] = material.color[2]!; data[3] = material.opacity;
        data[4] = material.emissive[0]! * e; data[5] = material.emissive[1]! * e; data[6] = material.emissive[2]! * e; data[7] = material.softness;
        data[8] = material.metallic; data[9] = material.roughness; data[10] = material.normalScale; data[11] = material.occlusionStrength;
        data[12] = material.specular[0]!; data[13] = material.specular[1]!; data[14] = material.specular[2]!; data[15] = material.shading === 'toon' ? material.toonSteps : material.shininess;
        data[16] = material.alphaCutoff; data[17] = material.environmentIntensity; data[18] = material.clearcoat; data[19] = material.clearcoatRoughness;
        let ax = 1, bx = 0, tx = 0, ay = 0, by = 1, ty = 0;
        if (map?.hasTransform) {
            const c = Math.cos(map.rotation), s = Math.sin(map.rotation);
            ax = c * map.repeat[0]!; bx = -s * map.repeat[1]!; tx = map.offset[0]!;
            ay = s * map.repeat[0]!; by = c * map.repeat[1]!; ty = map.offset[1]!;
        }
        // WebGPU stores rendered images top row first, so target textures are read with V flipped.
        if (map?.source instanceof RenderTarget3D) { ay = -ay; by = -by; ty = 1 - ty; }
        data[20] = ax; data[21] = bx; data[22] = tx; data[23] = 0;
        data[24] = ay; data[25] = by; data[26] = ty; data[27] = 0;
        data[28] = material.rotation; data[29] = material.sizeAttenuation ? 1 : 0; data[30] = material.reflectionDistortion; data[31] = material.reflectionStrength;
        if (material.shader) data.set(material.shader.uniforms, 32); else data.fill(0, 32, 48);
        data[48] = material.sheenColor[0]! * material.sheen; data[49] = material.sheenColor[1]! * material.sheen; data[50] = material.sheenColor[2]! * material.sheen; data[51] = material.sheenRoughness;
        data[52] = material.lightMapIntensity; data[53] = material.transmission; data[54] = material.ior; data[55] = material.thickness;
        data[56] = material.attenuationColor[0]!; data[57] = material.attenuationColor[1]!; data[58] = material.attenuationColor[2]!; data[59] = Number.isFinite(material.attenuationDistance) ? material.attenuationDistance : 0;
        const splat = material.splat;
        data[60] = splat?.repeat[0] ?? 1; data[61] = splat?.repeat[1] ?? 1; data[62] = splat?.repeat[2] ?? 1; data[63] = splat?.repeat[3] ?? 1;
        this.device.queue.writeBuffer(entry.buffer, 0, data);
        const entries: GPUBindGroupEntry[] = [{binding: 0, resource: {buffer: entry.buffer}}];
        let key = '';
        // Ground layers borrow the slots of the maps they stand in for; a missing layer reads the first.
        (splat ? [splat.layers[0], material.normalMap, splat.layers[3] ?? splat.layers[0], splat.layers[2] ?? splat.layers[0], splat.layers[1] ?? splat.layers[0], splat.weights, material.reflectionMap]
            : [material.map, material.normalMap, material.metallicRoughnessMap, material.occlusionMap, material.emissiveMap, material.lightMap, material.reflectionMap]).forEach((texture, i) => {
            const gpu = texture && !texture.isDisposed ? this.texture2d(texture) : undefined;
            entries.push({binding: 1 + i * 2, resource: gpu?.view ?? this.#white}, {binding: 2 + i * 2, resource: gpu?.sampler ?? this.#defaultSampler});
            key += (gpu?.key ?? '-') + '|';
        });
        if (!entry.group || entry.key !== key) {
            entry.group = this.device.createBindGroup({layout: this.#materialLayout, entries});
            entry.key = key;
        }
        return entry.group;
    }
    private features(item: RenderItem3D, gpu: GeometryGpu, kind: PassKind, frameFlags: {fog: boolean; environment: boolean}): ShaderFeatures3D {
        const {mesh, material} = item, depthOnly = kind === 'depth' || kind === 'scene-depth';
        const lit = material.shading !== 'unlit' && material.shading !== 'matcap' && !depthOnly;
        const uv = gpu.buffers.has('uv'), instanced = mesh.isInstanced;
        // A map on the second coordinate set needs only that set; it falls back to the first when the geometry lacks it.
        const second = gpu.buffers.has('uv1') && !depthOnly, occlusionUv1 = second && lit && material.occlusionMap?.channel === 1;
        const emissiveUv1 = second && material.shading !== 'matcap' && material.emissiveMap?.channel === 1;
        const lightUv1 = second && lit && material.lightMap?.channel === 1, lightMap = lit && material.lightMap !== undefined && (uv || lightUv1);
        const skinning = mesh.skeleton !== undefined && gpu.buffers.has('joints') && gpu.buffers.has('weights');
        // A draw may bind eight vertex buffers. Baked instances use them up, so they do without tangents, vertex colors and second coordinates.
        const baked = instanced && !skinning && mesh instanceof SkinnedInstancedMesh3D;
        return {
            shading: material.shading, depthOnly,
            normal: gpu.buffers.has('normal') && (!depthOnly || material.shader?.wgslVertex !== undefined),
            uv: uv && (!depthOnly || (material.map !== undefined && material.alphaMode !== 'opaque') || material.shader?.wgslVertex !== undefined),
            tangent: lit && uv && material.normalMap !== undefined && gpu.buffers.has('tangent') && !baked,
            vertexColor: material.vertexColors && gpu.buffers.has('color') && !baked,
            skinning, morph: gpu.morph !== undefined, morphNormals: gpu.morph?.channels === 2,
            skinInstancing: instanced && !skinning && mesh instanceof SkinnedInstancedMesh3D && gpu.buffers.has('joints') && gpu.buffers.has('weights'),
            splat: !depthOnly && uv && material.splat !== undefined,
            gpuParticles: instanced && !depthOnly && mesh instanceof GpuParticles3D, softDepth: !depthOnly && material.softness > 0 && this.#softDepth,
            instancing: instanced, instanceColor: instanced && !depthOnly && (mesh as InstancedMesh3D).instanceColors !== undefined,
            billboard: material.billboard && !material.screenSpace, screenSpace: material.screenSpace,
            map: uv && material.map !== undefined && (!depthOnly || material.alphaMode !== 'opaque'),
            mapFromTarget: !depthOnly && uv && material.map?.source instanceof RenderTarget3D,
            normalMap: lit && uv && material.normalMap !== undefined,
            metallicRoughnessMap: lit && uv && material.metallicRoughnessMap !== undefined && material.shading === 'standard',
            occlusionMap: lit && (uv || occlusionUv1) && material.occlusionMap !== undefined,
            uv1: (occlusionUv1 || emissiveUv1 || lightUv1) && !baked, occlusionUv1: occlusionUv1 && !baked, emissiveUv1: emissiveUv1 && !baked, lightMap, lightUv1: lightUv1 && !baked,
            transmission: !depthOnly && this.#grabbed && material.shading === 'standard' && material.transmission > 0,
            emissiveMap: !depthOnly && (uv || emissiveUv1) && material.emissiveMap !== undefined && material.shading !== 'matcap',
            alphaMask: material.alphaMode === 'mask', alphaBlend: material.alphaMode === 'blend',
            premultipliedAlpha: !depthOnly && material.alphaMode === 'blend' && material.blending === 'premultiplied',
            flatShading: material.flatShading, doubleSided: material.side === 'double',
            receiveShadow: lit && mesh.receiveShadow && this.#shadowCount > 0,
            environment: lit && frameFlags.environment, fog: !depthOnly && frameFlags.fog && material.fog,
            ...(!depthOnly && material.shader?.wgsl !== undefined ? {customKey: material.shader.key, customWgsl: material.shader.wgsl} : {}),
            ...(material.shader?.wgslVertex !== undefined ? {customKey: material.shader.key, customVertexWgsl: material.shader.wgslVertex} : {}),
            ...(lit && material.shader?.wgslNormal !== undefined ? {customKey: material.shader.key, customNormalWgsl: material.shader.wgslNormal} : {}),
            reflectionMap: lit && material.shading === 'standard' && material.reflectionMap !== undefined,
            toneMapped: !depthOnly && kind !== 'hdr' && this.toneMapping !== 'none' && material.toneMapped, linearOutput: kind === 'target' || kind === 'hdr',
        };
    }
    private pipeline(features: ShaderFeatures3D, item: RenderItem3D, gpu: GeometryGpu, kind: PassKind, mirrored: boolean, wire: boolean): GPURenderPipeline {
        const {geometry, material, mesh} = item, shadow = kind === 'depth', depthOnly = shadow || kind === 'scene-depth';
        const featureKey = shaderFeatureKey3D(features);
        const topology: GPUPrimitiveTopology = wire ? 'line-list' : geometry.topology === 'triangles' ? 'triangle-list' : geometry.topology === 'lines' ? 'line-list'
            : geometry.topology === 'line-strip' ? 'line-strip' : 'point-list';
        // Shadow maps draw both faces: closed and open meshes then cast alike.
        const cull: GPUCullMode = shadow || material.side === 'double' || material.billboard ? 'none' : material.side === 'back' ? 'front' : 'back';
        const blend = !depthOnly && material.alphaMode === 'blend' ? material.blending : 'off';
        const depthWrite = shadow || material.depthWrite, offset = shadow ? '1.5,2' : material.polygonOffset ? material.polygonOffset.join(',') : '';
        const colorSize = geometry.getAttribute('color')?.itemSize ?? 4, instanceColorSize = mesh.isInstanced ? (mesh as InstancedMesh3D).instanceColorSize : 4;
        const strip = topology === 'line-strip' && gpu.index ? gpu.index.format : '';
        const key = [featureKey, kind, topology, cull, mirrored ? 'cw' : 'ccw', blend, depthWrite, material.depthTest, offset, colorSize, instanceColorSize, strip].join('/');
        let pipeline = this.#pipelines.get(key);
        if (pipeline) return pipeline;
        let module = this.#modules.get(featureKey);
        if (!module) {
            module = this.device.createShaderModule({code: buildMaterialWgsl3D(features), label: featureKey});
            this.#modules.set(featureKey, module);
        }
        const buffers: GPUVertexBufferLayout[] = [];
        const add = (enabled: boolean, location: number, format: GPUVertexFormat, stride: number): void => {
            if (enabled) buffers.push({arrayStride: stride, attributes: [{shaderLocation: location, offset: 0, format}]});
        };
        add(true, 0, 'float32x3', 12);
        add(features.normal, 1, 'float32x3', 12);
        add(features.uv, 2, 'float32x2', 8);
        add(features.tangent, 3, 'float32x4', 16);
        add(features.vertexColor, 4, colorSize === 3 ? 'float32x3' : 'float32x4', colorSize * 4);
        add(features.skinning || features.skinInstancing === true, 5, 'uint32x4', 16);
        add(features.skinning || features.skinInstancing === true, 6, 'float32x4', 16);
        add(features.uv1, 7, 'float32x2', 8);
        if (features.instancing) {
            buffers.push({arrayStride: 64, stepMode: 'instance', attributes: [0, 1, 2, 3].map(column => ({shaderLocation: 8 + column, offset: column * 16, format: 'float32x4' as GPUVertexFormat}))});
        }
        if (features.instanceColor) {
            buffers.push({arrayStride: instanceColorSize * 4, stepMode: 'instance', attributes: [{shaderLocation: 12, offset: 0, format: instanceColorSize === 3 ? 'float32x3' : 'float32x4'}]});
        }
        if (features.skinInstancing) buffers.push({arrayStride: 48, stepMode: 'instance', attributes: [0, 1, 2].map(part => ({shaderLocation: 13 + part, offset: part * 16, format: 'float32x4' as GPUVertexFormat}))});
        const blendState: GPUBlendState | undefined = blend === 'off' ? undefined
            : blend === 'additive' ? {color: {srcFactor: 'src-alpha', dstFactor: 'one'}, alpha: {srcFactor: 'zero', dstFactor: 'one'}}
            : blend === 'multiply' ? {color: {srcFactor: 'dst', dstFactor: 'zero'}, alpha: {srcFactor: 'zero', dstFactor: 'one'}}
            : blend === 'premultiplied' ? {color: {srcFactor: 'one', dstFactor: 'one-minus-src-alpha'}, alpha: {srcFactor: 'one', dstFactor: 'one-minus-src-alpha'}}
            : {color: {srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha'}, alpha: {srcFactor: 'one', dstFactor: 'one-minus-src-alpha'}};
        const needsFragment = !depthOnly || features.alphaMask || features.alphaBlend;
        const filled = topology === 'triangle-list';
        const descriptor: GPURenderPipelineDescriptor = {
            label: key,
            layout: depthOnly ? this.#depthPipelineLayout : this.#pipelineLayout,
            vertex: {module, entryPoint: 'vertexMain', buffers},
            primitive: {topology, cullMode: cull, frontFace: mirrored ? 'cw' : 'ccw', ...(strip ? {stripIndexFormat: strip as GPUIndexFormat} : {})},
            depthStencil: {
                format: depthOnly ? SHADOW_FORMAT : DEPTH_FORMAT, depthWriteEnabled: depthWrite,
                depthCompare: material.depthTest || shadow ? 'less-equal' : 'always',
                // Depth bias applies to filled triangles only.
                ...(filled && shadow ? {depthBias: 2, depthBiasSlopeScale: 1.5} : {}),
                ...(filled && !shadow && material.polygonOffset ? {depthBias: Math.round(material.polygonOffset[1]), depthBiasSlopeScale: material.polygonOffset[0]} : {}),
            },
            multisample: {count: kind === 'canvas' ? this.#sampleCount : 1},
            ...(needsFragment ? {fragment: {
                module, entryPoint: 'fragmentMain',
                targets: depthOnly ? [] : [{format: this.colorFormat(kind), ...(blendState ? {blend: blendState} : {})}],
            }} : {}),
        };
        pipeline = this.device.createRenderPipeline(descriptor);
        this.#pipelines.set(key, pipeline);
        return pipeline;
    }

    // ---- drawing -----------------------------------------------------------------
    private writeObject(mesh: Mesh3D, gpu: GeometryGpu, skinned: boolean): number {
        const index = this.#objectCount++, o = index * (OBJECT_BLOCK_BYTES_3D / 4), floats = this.#objectFloats, ints = this.#objectInts;
        if (skinned) {
            floats.set(IDENTITY4, o);
            floats.set(mesh.bindMatrix, o + 28);
        } else {
            floats.set(mesh.matrixWorld, o);
            const normal = mat3NormalFromMat4(this.#scratch9, mesh.matrixWorld) as Float32Array;
            for (let column = 0; column < 3; column++) {
                floats[o + 16 + column * 4] = normal[column * 3]!; floats[o + 17 + column * 4] = normal[column * 3 + 1]!; floats[o + 18 + column * 4] = normal[column * 3 + 2]!;
            }
        }
        if (gpu.morph) {
            // Keep the strongest influences; the shader blends at most a fixed number.
            const weights = mesh.morphWeights, indices = o + 48, values = o + 56;
            let count = 0;
            for (let i = 0; i < weights.length; i++) {
                const weight = weights[i]!;
                if (weight === 0) continue;
                if (count < MAX_MORPH_INFLUENCES_WGSL_3D) { ints[indices + count] = i; floats[values + count] = weight; count++; continue; }
                let weakest = 0;
                for (let k = 1; k < count; k++) if (Math.abs(floats[values + k]!) < Math.abs(floats[values + weakest]!)) weakest = k;
                if (Math.abs(weight) > Math.abs(floats[values + weakest]!)) { ints[indices + weakest] = i; floats[values + weakest] = weight; }
            }
            // Baked instances take their morph weights from the table; the shader only needs to know how many targets to read.
            if (mesh instanceof SkinnedInstancedMesh3D && !mesh.skeleton) count = Math.min(MAX_MORPH_INFLUENCES_WGSL_3D, mesh.animations.morphCount, mesh.geometry.morphTargets.length);
            ints[o + 44] = gpu.morph.vertexCount; ints[o + 45] = gpu.morph.channels; ints[o + 46] = count; ints[o + 47] = 0;
        } else ints[o + 46] = 0;
        return index * OBJECT_BLOCK_BYTES_3D;
    }
    // Pass-local memo of the last bound state; consecutive draws that share it skip the redundant calls.
    #boundPipeline: GPURenderPipeline | undefined;
    #boundMaterial: GPUBindGroup | undefined;
    #boundSkin: GPUBindGroup | undefined;
    #boundVertices: unknown;
    #boundIndex: GPUBuffer | undefined;
    readonly #drawVariants = new WeakMap<Material3D, {version: number; variants: Map<number, Map<number, {pipeline: GPURenderPipeline; features: ShaderFeatures3D; layoutVersion: number}>>}>();
    #grabbed = false;
    private resetPassState(): void {
        this.#boundPipeline = undefined; this.#boundMaterial = undefined; this.#boundSkin = undefined; this.#boundVertices = undefined; this.#boundIndex = undefined;
    }
    private draw(pass: GPURenderPassEncoder, item: RenderItem3D, kind: PassKind, frameFlags: {fog: boolean; environment: boolean}): void {
        const {mesh, geometry, material} = item, frame = this.#list.frame;
        const gpu = this.geometry(geometry);
        if (!gpu.buffers.has('position')) return;
        const instanced = mesh.isInstanced, instances = instanced ? (mesh as InstancedMesh3D).count : 1;
        if (instances <= 0 || this.#objectCount >= this.#objectCapacity) return;
        const world = mesh.matrixWorld;
        const determinant = world[0]! * (world[5]! * world[10]! - world[6]! * world[9]!) - world[4]! * (world[1]! * world[10]! - world[2]! * world[9]!)
            + world[8]! * (world[1]! * world[6]! - world[2]! * world[5]!);
        const wire = material.wireframe && kind !== 'depth' && geometry.topology === 'triangles';
        // Everything that selects a pipeline besides the material and geometry themselves,
        // packed into one number so the common case is a single map lookup.
        const bits = (kind === 'canvas' ? 0 : kind === 'target' ? 1 : kind === 'depth' ? 2 : kind === 'hdr' ? 3 : 65536) | (wire ? 4 : 0) | (determinant < 0 ? 8 : 0) | (instanced ? 16 : 0)
            | (instanced && (mesh as InstancedMesh3D).instanceColors ? 32 : 0) | (mesh.skeleton ? 64 : 0) | (mesh.receiveShadow && this.#shadowCount > 0 ? 128 : 0)
            | (frameFlags.fog ? 256 : 0) | (frameFlags.environment ? 512 : 0) | (this.toneMapping !== 'none' ? 1024 : 0)
            | (instanced && (mesh as InstancedMesh3D).instanceColorSize === 4 ? 2048 : 0)
            | (material.side === 'double' ? 4096 : material.side === 'back' ? 8192 : 0) | (mesh instanceof SkinnedInstancedMesh3D ? 16384 : 0) | (mesh instanceof GpuParticles3D ? 32768 : 0);
        let cache = this.#drawVariants.get(material);
        if (!cache || cache.version !== material.version) this.#drawVariants.set(material, cache = {version: material.version, variants: new Map()});
        // Material fields that select shader features or pipeline state. They are read every
        // draw so plain assignments (a new map, another blend mode) need no touch().
        const map = material.map;
        const surface = (map ? 1 : 0) | (map?.source instanceof RenderTarget3D ? 2 : 0) | (material.normalMap ? 4 : 0) | (material.metallicRoughnessMap ? 8 : 0)
            | (material.occlusionMap ? 16 : 0) | (material.emissiveMap ? 32 : 0) | (material.alphaMode === 'mask' ? 64 : material.alphaMode === 'blend' ? 128 : 0)
            | (material.blending === 'premultiplied' ? 256 : material.blending === 'additive' ? 32768 : material.blending === 'multiply' ? 65536 : 0)
            | (material.flatShading ? 512 : 0) | (material.vertexColors ? 1024 : 0) | (material.billboard ? 2048 : 0) | (material.screenSpace ? 4096 : 0)
            | (material.depthTest ? 8192 : 0) | (material.depthWrite ? 16384 : 0) | (material.fog ? 131072 : 0) | (material.toneMapped ? 262144 : 0)
            | (material.polygonOffset ? 524288 : 0) | (material.occlusionMap?.channel === 1 ? 1048576 : 0) | (material.emissiveMap?.channel === 1 ? 2097152 : 0)
            | (material.lightMap ? 4194304 : 0) | (material.lightMap?.channel === 1 ? 8388608 : 0) | (material.reflectionMap ? 16777216 : 0) | (material.softness > 0 && this.#softDepth ? 33554432 : 0) | (material.splat ? 67108864 : 0);
        const variantKey = surface * 131072 + bits;
        let byGeometry = cache.variants.get(geometry.id);
        if (!byGeometry) cache.variants.set(geometry.id, byGeometry = new Map());
        let variant = byGeometry.get(variantKey);
        if (!variant || variant.layoutVersion !== gpu.layoutVersion) {
            const built = this.features(item, gpu, kind, frameFlags);
            variant = {features: built, pipeline: this.pipeline(built, item, gpu, kind, determinant < 0 && !built.skinning, wire), layoutVersion: gpu.layoutVersion};
            byGeometry.set(variantKey, variant);
        }
        const features = variant.features;
        if (variant.pipeline !== this.#boundPipeline) { pass.setPipeline(variant.pipeline); this.#boundPipeline = variant.pipeline; }
        const materialGroup = this.material(material);
        if (materialGroup !== this.#boundMaterial) { pass.setBindGroup(1, materialGroup); this.#boundMaterial = materialGroup; }
        pass.setBindGroup(2, this.#objectGroup, [this.writeObject(mesh, gpu, features.skinning)]);
        const skinGroup = this.skin(mesh, gpu, features.skinning, frame);
        if (skinGroup !== this.#boundSkin) { pass.setBindGroup(3, skinGroup); this.#boundSkin = skinGroup; }
        // Vertex bindings depend on the geometry and on which attributes this variant reads.
        if (instanced || this.#boundVertices !== variant || this.#boundPipeline !== variant.pipeline) {
            let slot = 0;
            const bind = (enabled: boolean, name: string): void => { if (enabled) pass.setVertexBuffer(slot++, gpu.buffers.get(name)!.buffer); };
            bind(true, 'position'); bind(features.normal, 'normal'); bind(features.uv, 'uv'); bind(features.tangent, 'tangent');
            bind(features.vertexColor, 'color'); bind(features.skinning || features.skinInstancing === true, 'joints'); bind(features.skinning || features.skinInstancing === true, 'weights'); bind(features.uv1, 'uv1');
            if (instanced) {
                const instance = this.instances(mesh as InstancedMesh3D, frame);
                pass.setVertexBuffer(slot++, instance.matrices.buffer);
                if (features.instanceColor) pass.setVertexBuffer(slot++, instance.colors!.buffer);
                if (features.skinInstancing) pass.setVertexBuffer(slot++, instance.animation!.buffer);
            }
            this.#boundVertices = instanced ? undefined : variant;
            this.#boundIndex = undefined;
        }
        if (wire) {
            // Wireframe draws the whole geometry: its edge list is not split by groups.
            const lines = this.wireframe(geometry, gpu);
            pass.setIndexBuffer(lines.buffer, 'uint32');
            pass.drawIndexed(lines.count, instances);
            this.#boundIndex = undefined;
        } else if (gpu.index) {
            if (gpu.index.buffer !== this.#boundIndex) { pass.setIndexBuffer(gpu.index.buffer, gpu.index.format); this.#boundIndex = gpu.index.buffer; }
            pass.drawIndexed(item.count, instances, item.start);
        } else pass.draw(item.count, instances, item.start);
        if (kind !== 'depth' && kind !== 'scene-depth') {
            this.info.drawCalls++;
            if (!wire && geometry.topology === 'triangles') this.info.triangles += item.count / 3 * instances;
        }
    }
    private readonly depthItem: RenderItem3D = {mesh: undefined as unknown as Mesh3D, geometry: undefined as unknown as Geometry3D, material: undefined as unknown as Material3D, start: 0, count: 0, depth: 0};
    private drawDepth(pass: GPURenderPassEncoder, mesh: Mesh3D): void {
        const geometry = mesh.geometry, item = this.depthItem, groups = geometry.groups, flags = {fog: false, environment: false};
        if (geometry.topology !== 'triangles') return;
        item.mesh = mesh; item.geometry = geometry;
        if (Array.isArray(mesh.material) && groups.length > 0) {
            for (const group of groups) {
                item.material = mesh.materialAt(group.materialIndex); item.start = group.start; item.count = group.count;
                if (item.material.visible && !item.material.isDisposed && !item.material.billboard) this.draw(pass, item, 'depth', flags);
            }
        } else {
            item.material = mesh.materialAt(0); item.start = 0; item.count = geometry.drawCount;
            if (item.material.visible && !item.material.isDisposed && !item.material.billboard) this.draw(pass, item, 'depth', flags);
        }
    }
    private ensureShadowAtlas(): GPUTextureView {
        if (!this.#shadowTexture) {
            const size = this.#shadowAtlasSize;
            this.#shadowTexture = this.device.createTexture({size: [size, size], format: SHADOW_FORMAT, usage: TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING});
            this.#shadowView = this.#shadowTexture.createView();
        }
        return this.#shadowView!;
    }
    private canvasAttachments(texture: GPUTexture): {color: GPUTextureView | undefined; depth: GPUTextureView} {
        const key = texture.width + 'x' + texture.height;
        if (key !== this.#canvasKey || !this.#canvasDepth) {
            this.#canvasDepth?.destroy(); this.#canvasColor?.destroy();
            const size = [texture.width, texture.height];
            this.#canvasDepth = this.device.createTexture({size, format: DEPTH_FORMAT, sampleCount: this.#sampleCount, usage: TEXTURE_USAGE.RENDER_ATTACHMENT});
            this.#canvasColor = this.#sampleCount > 1 ? this.device.createTexture({size, format: this.#format, sampleCount: this.#sampleCount, usage: TEXTURE_USAGE.RENDER_ATTACHMENT}) : undefined;
            this.#canvasKey = key;
        }
        return {color: this.#canvasColor?.createView(), depth: this.#canvasDepth.createView()};
    }
    private colorFormat(kind: PassKind): GPUTextureFormat {
        return kind === 'target' ? TARGET_FORMAT : kind === 'hdr' ? HDR_FORMAT : this.#format;
    }
    private drawSkybox(pass: GPURenderPassEncoder, texture: CubeTexture3D, intensity: number, camera: Camera3D, kind: PassKind): void {
        const device = this.device, key = 'skybox/' + kind;
        if (!mat4Invert(this.#scratch16, camera.viewProjectionMatrix)) return;
        let pipeline = this.#pipelines.get(key);
        if (!pipeline) {
            this.#skyLayout ??= device.createBindGroupLayout({entries: [
                {binding: 0, visibility: SHADER_STAGE.VERTEX | SHADER_STAGE.FRAGMENT, buffer: {}},
                {binding: 1, visibility: SHADER_STAGE.FRAGMENT, texture: {viewDimension: 'cube'}},
                {binding: 2, visibility: SHADER_STAGE.FRAGMENT, sampler: {}},
            ]});
            const module = device.createShaderModule({code: SKYBOX_WGSL_3D, label: 'skybox'});
            pipeline = device.createRenderPipeline({
                label: key, layout: device.createPipelineLayout({bindGroupLayouts: [this.#skyLayout]}),
                vertex: {module, entryPoint: 'vertexMain'},
                fragment: {module, entryPoint: 'fragmentMain', targets: [{format: this.colorFormat(kind)}]},
                primitive: {topology: 'triangle-list'},
                depthStencil: {format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'less-equal'},
                multisample: {count: kind === 'canvas' ? this.#sampleCount : 1},
            });
            this.#pipelines.set(key, pipeline);
        }
        this.#skyBuffer ??= device.createBuffer({size: 80, usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST});
        const data = new Float32Array(20);
        data.set(this.#scratch16);
        data[16] = intensity; data[17] = kind === 'canvas' ? 0 : 1; data[18] = this.exposure;
        data[19] = kind === 'hdr' ? 0 : this.toneMapping === 'aces' ? 2 : this.toneMapping === 'reinhard' ? 1 : 0;
        device.queue.writeBuffer(this.#skyBuffer, 0, data);
        const cube = this.textureCube(texture), groupKey = texture.id + ':' + texture.version;
        if (!this.#skyGroup || this.#skyGroup.key !== groupKey) {
            this.#skyGroup = {key: groupKey, group: device.createBindGroup({layout: this.#skyLayout!, entries: [
                {binding: 0, resource: {buffer: this.#skyBuffer}}, {binding: 1, resource: cube.view}, {binding: 2, resource: cube.sampler},
            ]})};
        }
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, this.#skyGroup.group);
        pass.draw(3);
        this.info.drawCalls++;
    }

    /**
     * Draw one frame to the canvas, or into `target` when given. Returns false
     * when the device is lost and nothing was drawn.
     */
    render(scene: Scene3D, camera: Camera3D, target?: RenderTarget3D): boolean {
        if (this.#disposed) throw new World3DError('WORLD3D_DISPOSED', 'renderer');
        if (this.#lost) return false;
        if (this.postProcess.enabled && !this.#inPost) return this.renderPost(scene, camera, target);
        // Half-float targets keep scene-referred light; tone mapping happens when they are displayed.
        const device = this.device, list = this.#list, info = this.info, kind: PassKind = target ? (target.format === 'rgba16f' ? 'hdr' : 'target') : 'canvas';
        if (target?.isDisposed) throw new World3DError('WORLD3D_DISPOSED', 'render target');
        list.build(scene, camera);
        this.#serial++;
        this.#objectCount = 0;
        info.frame = list.frame; info.drawCalls = info.triangles = 0;
        info.visited = list.stats.visited; info.culled = list.stats.culled;

        const atlas = this.ensureShadowAtlas();
        const plans = planShadows3D(this.#frameData, list, this.#shadowAtlasSize, this.shadowsEnabled, true, this.#shadowSlots, camera);
        this.#shadowCount = plans.length;
        const environment = scene.environment && !scene.environment.isDisposed ? this.textureCube(scene.environment) : undefined;
        writeFrameBlock3D(this.#frameData, scene, camera, list, this.#shadowSlots, {exposure: this.exposure, toneMapping: kind === 'hdr' ? 'none' : this.toneMapping, environmentMaxMip: environment?.maxMip ?? 0});
        this.#frameData[FRAME_OFFSETS_3D.clipInfo + 2] = this.viewport ? this.viewport[2] : 1; this.#frameData[FRAME_OFFSETS_3D.clipInfo + 3] = this.viewport ? this.viewport[3] : 1;
        device.queue.writeBuffer(this.#frameBuffer, 0, this.#frameData);
        // Surfaces that fade near solid geometry read its depth, drawn once before the frame.
        const soft = list.transparent.some(item => item.material.softness > 0);
        const softWidth = target ? target.width : this.#context.getCurrentTexture().width, softHeight = target ? target.height : this.#context.getCurrentTexture().height;
        if (soft && (!this.#sceneDepth || this.#sceneDepth.texture.width !== softWidth || this.#sceneDepth.texture.height !== softHeight)) {
            this.#sceneDepth?.texture.destroy(); this.#sceneDepth?.buffer.destroy();
            const texture = device.createTexture({size: [softWidth, softHeight], format: SHADOW_FORMAT, usage: TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.TEXTURE_BINDING});
            const buffer = device.createBuffer({size: 128, usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST});
            this.#sceneDepth = {texture, view: texture.createView(), buffer, group: device.createBindGroup({layout: this.#depthFrameLayout, entries: [{binding: 0, resource: {buffer}}]})};
            this.#sceneDepthSerial++;
        }
        this.#softDepth = soft;
        const sceneDepthView = soft ? this.#sceneDepth!.view : atlas;
        const frameKey = (environment ? scene.environment!.id + ':' + scene.environment!.version : '-') + (soft ? '|d' + this.#sceneDepthSerial : '');
        if (!this.#frameGroup || this.#frameGroupKey !== frameKey) {
            this.#frameGroup = device.createBindGroup({layout: this.#frameLayout, entries: [
                {binding: 0, resource: {buffer: this.#frameBuffer}}, {binding: 1, resource: atlas}, {binding: 2, resource: this.#shadowSampler},
                {binding: 3, resource: environment?.view ?? this.#whiteCube}, {binding: 4, resource: environment?.sampler ?? this.#defaultSampler},
                {binding: 5, resource: this.#white}, {binding: 6, resource: this.#grabSampler}, {binding: 7, resource: sceneDepthView},
            ]});
            this.#frameGroupKey = frameKey;
        }
        // Size the per-draw uniform buffer before any pass references its bind group.
        let needed = list.opaque.length * (soft ? 2 : 1) + list.transparent.length;
        for (const plan of plans) for (const mesh of plan.casters) needed += Array.isArray(mesh.material) ? Math.max(mesh.geometry.groups.length, 1) : 1;
        if (needed > this.#objectCapacity) {
            while (this.#objectCapacity < needed) this.#objectCapacity *= 2;
            this.#objectBuffer.destroy();
            this.#objectBuffer = this.createObjectBuffer();
            this.#objectGroup = this.createObjectGroup();
            this.#objectStaging = new ArrayBuffer(this.#objectCapacity * OBJECT_BLOCK_BYTES_3D);
            this.#objectFloats = new Float32Array(this.#objectStaging); this.#objectInts = new Int32Array(this.#objectStaging);
        }

        const encoder = device.createCommandEncoder();
        if (plans.length > 0) {
            this.resetPassState();
            const pass = encoder.beginRenderPass({colorAttachments: [], depthStencilAttachment: {view: atlas, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store'}});
            for (const plan of plans) {
                let slot = this.#depthFrames[plan.slot];
                if (!slot) {
                    const buffer = device.createBuffer({size: 128, usage: BUFFER_USAGE.UNIFORM | BUFFER_USAGE.COPY_DST});
                    slot = this.#depthFrames[plan.slot] = {buffer, group: device.createBindGroup({layout: this.#depthFrameLayout, entries: [{binding: 0, resource: {buffer}}]})};
                }
                device.queue.writeBuffer(slot.buffer, 0, plan.matrix);
                pass.setViewport(plan.x, plan.y, plan.tile, plan.tile, 0, 1);
                pass.setScissorRect(plan.x, plan.y, plan.tile, plan.tile);
                pass.setBindGroup(0, slot.group);
                for (const mesh of plan.casters) this.drawDepth(pass, mesh);
            }
            pass.end();
        }
        if (soft) {
            const depth = this.#sceneDepth!;
            // The depth-only frame block holds a view-projection matrix followed by the view matrix.
            device.queue.writeBuffer(depth.buffer, 0, camera.viewProjectionMatrix);
            device.queue.writeBuffer(depth.buffer, 64, camera.viewMatrix);
            this.resetPassState();
            const pass = encoder.beginRenderPass({colorAttachments: [], depthStencilAttachment: {view: depth.view, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store'}});
            const rect = this.viewport;
            if (rect) {
                const w = Math.max(Math.round(rect[2] * softWidth), 1), h = Math.max(Math.round(rect[3] * softHeight), 1);
                const x = Math.min(Math.max(Math.round(rect[0] * softWidth), 0), softWidth - 1), y = Math.min(Math.max(softHeight - Math.round(rect[1] * softHeight) - h, 0), softHeight - 1);
                pass.setViewport(x, y, Math.min(w, softWidth - x), Math.min(h, softHeight - y), 0, 1);
            }
            pass.setBindGroup(0, depth.group);
            const none = {fog: false, environment: false};
            // Scene depth follows the main view's culling and material offset.
            for (const item of list.opaque) {
                if (item.geometry.topology === 'triangles' && item.material.depthWrite && !item.material.billboard && !item.material.screenSpace) this.draw(pass, item, 'scene-depth', none);
            }
            pass.end();
        }

        const background = scene.background;
        // sRGB targets encode on write, so they are cleared with linear values.
        const encode = target ? (value: number): number => value : linearToSrgb;
        const clearValue: GPUColor = Array.isArray(background) ? [encode(background[0]!), encode(background[1]!), encode(background[2]!), 1]
            : [0, 0, 0, (target || this.#alpha) && !background ? 0 : 1];
        let colorAttachment: GPURenderPassColorAttachment, depthView: GPUTextureView | undefined, outputWidth: number, outputHeight: number, outputTexture: GPUTexture;
        // See-through surfaces read a copy of everything drawn before them, which splits the pass in two.
        const grab = list.transparent.some(item => item.material.transmission > 0 && item.material.shading === 'standard');
        const loadOp: GPULoadOp = this.autoClear ? 'clear' : 'load';
        if (target) {
            const entry = this.target(target);
            colorAttachment = {view: entry.colorView, clearValue, loadOp, storeOp: 'store'};
            depthView = entry.depthView; outputTexture = entry.color;
            outputWidth = target.width; outputHeight = target.height;
            if (!depthView) throw new World3DError('WORLD3D_INPUT_INVALID', 'the WebGPU backend requires render targets with depth');
        } else {
            const current = this.#context.getCurrentTexture(), attachments = this.canvasAttachments(current), view = current.createView();
            // The multisampled color is kept so a later view of the same frame can load it.
            colorAttachment = attachments.color ? {view: attachments.color, resolveTarget: view, clearValue, loadOp, storeOp: 'store'}
                : {view, clearValue, loadOp, storeOp: 'store'};
            depthView = attachments.depth; outputTexture = current;
            outputWidth = current.width; outputHeight = current.height;
        }
        this.resetPassState();
        const depthStoreOp: GPUStoreOp = target?.depthTexture || grab ? 'store' : 'discard';
        let pass = encoder.beginRenderPass({colorAttachments: [colorAttachment], depthStencilAttachment: {view: depthView, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp}});
        const view = this.viewport;
        const frame = (): void => {
            if (!view) return;
            // The public rectangle has its origin at the bottom left; WebGPU's is at the top left.
            const w = Math.max(Math.round(view[2] * outputWidth), 1), h = Math.max(Math.round(view[3] * outputHeight), 1);
            const x = Math.min(Math.max(Math.round(view[0] * outputWidth), 0), outputWidth - 1), y = Math.min(Math.max(outputHeight - Math.round(view[1] * outputHeight) - h, 0), outputHeight - 1);
            const cw = Math.min(w, outputWidth - x), ch = Math.min(h, outputHeight - y);
            pass.setViewport(x, y, cw, ch, 0, 1); pass.setScissorRect(x, y, cw, ch);
        };
        frame();
        const flags = {fog: scene.fog !== undefined, environment: environment !== undefined};
        pass.setBindGroup(0, this.#frameGroup);
        for (const item of list.opaque) this.draw(pass, item, kind, flags);
        if (background instanceof CubeTexture3D && !background.isDisposed) {
            this.drawSkybox(pass, background, scene.backgroundIntensity, camera, kind);
            this.resetPassState();
            pass.setBindGroup(0, this.#frameGroup);
        }
        if (grab) {
            pass.end();
            const format = this.colorFormat(kind);
            let entry = this.#grabs.get(kind);
            if (!entry || entry.texture.width !== outputWidth || entry.texture.height !== outputHeight || entry.texture.format !== format) {
                entry?.texture.destroy();
                const texture = device.createTexture({size: [outputWidth, outputHeight], format, usage: TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST});
                this.#grabs.set(kind, entry = {texture, view: texture.createView(), group: undefined, key: ''});
            }
            if (!entry.group || entry.key !== frameKey) {
                entry.group = device.createBindGroup({layout: this.#frameLayout, entries: [
                    {binding: 0, resource: {buffer: this.#frameBuffer}}, {binding: 1, resource: atlas}, {binding: 2, resource: this.#shadowSampler},
                    {binding: 3, resource: environment?.view ?? this.#whiteCube}, {binding: 4, resource: environment?.sampler ?? this.#defaultSampler},
                    {binding: 5, resource: entry.view}, {binding: 6, resource: this.#grabSampler}, {binding: 7, resource: sceneDepthView},
                ]});
                entry.key = frameKey;
            }
            encoder.copyTextureToTexture({texture: outputTexture}, {texture: entry.texture}, [outputWidth, outputHeight]);
            pass = encoder.beginRenderPass({colorAttachments: [{...colorAttachment, loadOp: 'load'}], depthStencilAttachment: {view: depthView, depthLoadOp: 'load', depthStoreOp: target?.depthTexture ? 'store' : 'discard'}});
            frame();
            this.resetPassState();
            pass.setBindGroup(0, entry.group);
            this.#grabbed = true;
        }
        for (const item of list.transparent) this.draw(pass, item, kind, flags);
        this.#grabbed = false;
        pass.end();
        if (this.#objectCount > 0) device.queue.writeBuffer(this.#objectBuffer, 0, this.#objectStaging, 0, this.#objectCount * OBJECT_BLOCK_BYTES_3D);
        device.queue.submit([encoder.finish()]);

        this.prune(list.frame);
        info.programs = this.#pipelines.size; info.geometries = this.#geometries.size; info.textures = this.#textures.size;
        info.shadowMaps = plans.length;
        return true;
    }
    /** Draw the scene into the half-float chain target, then post-process into the output. */
    private renderPost(scene: Scene3D, camera: Camera3D, target: RenderTarget3D | undefined): boolean {
        if (target?.isDisposed) throw new World3DError('WORLD3D_DISPOSED', 'render target');
        const current = target ? undefined : this.#context.getCurrentTexture();
        const width = target ? target.width : current!.width, height = target ? target.height : current!.height;
        const post = this.#post ??= new PostChainWebGPU3D(this.device);
        post.scene.setSize(Math.max(width, 1), Math.max(height, 1));
        this.#inPost = true;
        try { if (!this.render(scene, camera, post.scene)) return false; }
        finally { this.#inPost = false; }
        const encoder = this.device.createCommandEncoder();
        const output = target ? this.target(target).colorView : current!.createView();
        const format = target ? (target.format === 'rgba16f' ? HDR_FORMAT : TARGET_FORMAT) : this.#format;
        // 8-bit targets encode sRGB on write and half-float targets store linear light; only the canvas needs encoded values.
        // Outlined objects are drawn once more, flat white, into a mask the composite traces.
        let maskView: GPUTextureView | undefined;
        if (outlineActive3D(this.postProcess)) {
            post.mask.setSize(Math.max(width, 1), Math.max(height, 1));
            const saved = {layerMask: camera.layerMask, override: scene.overrideMaterial, background: scene.background, shadows: this.shadowsEnabled, planes: scene.clippingPlanes};
            camera.layerMask = this.postProcess.outlineLayers; scene.overrideMaterial = post.maskMaterial; scene.background = [0, 0, 0]; this.shadowsEnabled = false;
            this.#inPost = true;
            // The counters describe the scene, not this helper pass.
            const counted = {...this.info};
            try { if (this.render(scene, camera, post.mask)) maskView = this.target(post.mask).colorView; }
            finally { this.#inPost = false; camera.layerMask = saved.layerMask; scene.overrideMaterial = saved.override; scene.background = saved.background; this.shadowsEnabled = saved.shadows; Object.assign(this.info, counted); }
        }
        const sceneEntry = this.target(post.scene);
        this.info.drawCalls += post.run(encoder, sceneEntry.colorView, sceneEntry.depthView, maskView, postViewFromCamera3D(camera), width, height, output, format, target !== undefined,
            this.postProcess, target?.format === 'rgba16f' ? 'none' : this.toneMapping);
        this.device.queue.submit([encoder.finish()]);
        return true;
    }
    /** Retire per-mesh and per-skeleton buffers that have not been drawn recently. */
    private prune(frame: number): void {
        if (frame % PRUNE_INTERVAL !== 0) return;
        for (const [mesh, entry] of this.#instances) {
            if (frame - entry.lastFrame < PRUNE_INTERVAL) continue;
            entry.matrices.buffer.destroy(); entry.colors?.buffer.destroy(); entry.animation?.buffer.destroy();
            this.#instances.delete(mesh);
        }
        for (const [skeleton, entry] of this.#bones) {
            if (frame - entry.lastFrame < PRUNE_INTERVAL) continue;
            entry.buffer.destroy();
            this.#bones.delete(skeleton);
        }
    }
    /** RGBA8 pixels of a render target, top row first. */
    async readRenderTargetPixels(target: RenderTarget3D): Promise<Uint8Array> {
        if (target.format === 'rgba16f') throw new World3DError('WORLD3D_INPUT_INVALID', 'half-float targets cannot be read back as bytes');
        if (this.#disposed) throw new World3DError('WORLD3D_DISPOSED', 'renderer');
        if (this.#lost) throw new World3DError('WORLD3D_CONTEXT_LOST', 'readback');
        const device = this.device, entry = this.target(target), width = target.width, height = target.height;
        // Buffer rows must be padded to a multiple of 256 bytes.
        const bytesPerRow = Math.ceil(width * 4 / 256) * 256;
        const buffer = device.createBuffer({size: bytesPerRow * height, usage: BUFFER_USAGE.COPY_DST | BUFFER_USAGE.MAP_READ});
        try {
            const encoder = device.createCommandEncoder();
            encoder.copyTextureToBuffer({texture: entry.color}, {buffer, bytesPerRow, rowsPerImage: height}, [width, height]);
            device.queue.submit([encoder.finish()]);
            await buffer.mapAsync(MAP_MODE_READ);
            const mapped = new Uint8Array(buffer.getMappedRange()), out = new Uint8Array(width * height * 4);
            for (let y = 0; y < height; y++) out.set(mapped.subarray(y * bytesPerRow, y * bytesPerRow + width * 4), y * width * 4);
            buffer.unmap();
            return out;
        } catch (cause) {
            throw new World3DError('WORLD3D_RESOURCE_FAILED', 'render target readback', cause);
        } finally {
            buffer.destroy();
        }
    }
    /** Release every GPU object and unconfigure the canvas. Idempotent. */
    dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#unsubscribeDeviceLoss();
        this.#list.clear();
        this.#post?.dispose(); this.#post = undefined;
        for (const geometry of [...this.#geometries.keys()]) { this.#geometries.get(geometry)!.unsubscribe(); this.releaseGeometry(geometry); }
        for (const entry of this.#textures.values()) { entry.unsubscribe(); entry.texture.destroy(); }
        for (const entry of this.#targets.values()) { entry.unsubscribe(); entry.color.destroy(); entry.depth?.destroy(); }
        for (const entry of this.#materials.values()) { entry.unsubscribe(); entry.buffer.destroy(); }
        for (const entry of this.#instances.values()) { entry.matrices.buffer.destroy(); entry.colors?.buffer.destroy(); entry.animation?.buffer.destroy(); }
        for (const entry of this.#bones.values()) entry.buffer.destroy();
        for (const table of this.#animations.values()) table.destroy();
        this.#animations.clear();
        for (const slot of this.#depthFrames) slot?.buffer.destroy();
        this.#textures.clear(); this.#targets.clear(); this.#materials.clear(); this.#instances.clear(); this.#bones.clear();
        this.#pipelines.clear(); this.#modules.clear();
        this.#frameBuffer.destroy(); this.#objectBuffer.destroy(); this.#skyBuffer?.destroy();
        this.#dummyBones.destroy(); this.#dummyMorph.destroy();
        this.#whiteTexture.destroy(); this.#whiteCubeTexture.destroy();
        for (const entry of this.#grabs.values()) entry.texture.destroy();
        this.#grabs.clear();
        this.#shadowTexture?.destroy(); this.#canvasDepth?.destroy(); this.#canvasColor?.destroy();
        this.#sceneDepth?.texture.destroy(); this.#sceneDepth?.buffer.destroy(); this.#sceneDepth = undefined;
        try { this.#context.unconfigure(); } catch { /* The canvas may already be detached. */ }
        if (this.#ownsDevice) this.device.destroy();
    }
}

/** Acquire a device (unless one is borrowed) and create the WebGPU renderer. */
export async function createWebGPURenderer3D(options: WebGPURenderer3DOptions): Promise<WebGPURenderer3D> {
    const canvas = options?.canvas;
    if (!canvas || typeof (canvas as HTMLCanvasElement).getContext !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'canvas');
    if (options.device) return new WebGPURenderer3D(options, options.device, false);
    if (typeof navigator === 'undefined' || !navigator.gpu) throw new World3DError('WORLD3D_CONTEXT_UNAVAILABLE', 'webgpu');
    const adapter = await navigator.gpu.requestAdapter({powerPreference: options.powerPreference ?? 'high-performance'});
    if (!adapter) throw new World3DError('WORLD3D_CONTEXT_UNAVAILABLE', 'webgpu adapter');
    let device: GPUDevice;
    // Enable every block-compression family the adapter offers so compressed textures can be uploaded.
    const requiredFeatures = (['texture-compression-bc', 'texture-compression-etc2', 'texture-compression-astc'] as GPUFeatureName[]).filter(feature => adapter.features.has(feature));
    try { device = await adapter.requestDevice({requiredFeatures}); }
    catch (cause) { throw new World3DError('WORLD3D_CONTEXT_UNAVAILABLE', 'webgpu device', cause); }
    try { return new WebGPURenderer3D(options, device, true); }
    catch (cause) { device.destroy(); throw cause; }
}
