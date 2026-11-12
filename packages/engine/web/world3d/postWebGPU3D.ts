// SPDX-License-Identifier: Apache-2.0
// WebGPU side of the world3d post-processing chain; mirrors postWebGL23D.
import {Material3D} from '../../rendering/world3d/Material3D.js';
import {RenderTarget3D} from '../../rendering/world3d/Texture3D.js';
import type {ToneMapping3D} from './frame3D.js';
import {POST_DOWN_WGSL_3D, POST_FXAA_WGSL_3D, POST_PARAMS_FLOATS_3D, POST_SSAO_WGSL_3D, POST_UP_WGSL_3D, bloomLevelCount3D, postCompositeWgsl3D, writeCompositeParams3D, writePostParams3D} from './post3D.js';
import type {CustomPost3D, PostProcessSettings3D, PostView3D} from './post3D.js';

// Numeric WebGPU flags, so this module does not depend on the browser globals at load time.
const UNIFORM = 0x40, COPY_DST = 0x08, TEXTURE_COPY_DST = 0x02, RENDER_ATTACHMENT = 0x10, TEXTURE_BINDING = 0x04, FRAGMENT = 0x2;
const HDR: GPUTextureFormat = 'rgba16float', LDR: GPUTextureFormat = 'rgba8unorm';
interface Surface { texture: GPUTexture; view: GPUTextureView; width: number; height: number }
interface Slot { buffer: GPUBuffer; group: GPUBindGroup | undefined; source: GPUTextureView | undefined; bloom: GPUTextureView | undefined; depth: GPUTextureView | undefined; ao: GPUTextureView | undefined; mask: GPUTextureView | undefined }
const SHADERS = {down: POST_DOWN_WGSL_3D, up: POST_UP_WGSL_3D, fxaa: POST_FXAA_WGSL_3D, ssao: POST_SSAO_WGSL_3D} as const;

export class PostChainWebGPU3D {
    /** Half-float scene target the renderer draws into before run(). */
    readonly scene = new RenderTarget3D(1, 1, {format: 'rgba16f', depthTexture: true, name: 'world3d.post.scene'});
    /** Target and flat white material for the outline mask. */
    readonly mask = new RenderTarget3D(1, 1, {name: 'world3d.post.mask'});
    readonly maskMaterial = (() => { const material = new Material3D('unlit', {side: 'double'}); material.fog = false; material.toneMapped = false; return material; })();
    readonly #device: GPUDevice;
    readonly #layout: GPUBindGroupLayout;
    readonly #pipelineLayout: GPUPipelineLayout;
    readonly #sampler: GPUSampler;
    readonly #black: GPUTexture;
    readonly #blackView: GPUTextureView;
    readonly #modules = new Map<string, GPUShaderModule>();
    readonly #pipelines = new Map<string, GPURenderPipeline>();
    readonly #levels: Surface[] = [];
    readonly #slots: Slot[] = [];
    #ldr: Surface | undefined;
    #ao: Surface | undefined;
    #slot = 0;
    readonly #params = new Float32Array(POST_PARAMS_FLOATS_3D);
    #maskView: GPUTextureView | undefined;
    #outline: PostProcessSettings3D | undefined;
    readonly #noDepth: GPUTexture;
    readonly #noDepthView: GPUTextureView;
    // State shared by the passes of one run().
    #view: PostView3D = {inverseProjection: new Float32Array(16)};
    #depthView: GPUTextureView | undefined;
    #aoView: GPUTextureView | undefined;
    #custom: CustomPost3D | undefined;
    #width = 1;
    #height = 1;

    constructor(device: GPUDevice) {
        this.#device = device;
        this.#layout = device.createBindGroupLayout({entries: [
            {binding: 0, visibility: FRAGMENT, buffer: {}}, {binding: 1, visibility: FRAGMENT, texture: {}},
            {binding: 2, visibility: FRAGMENT, sampler: {}}, {binding: 3, visibility: FRAGMENT, texture: {}},
            {binding: 4, visibility: FRAGMENT, texture: {sampleType: 'depth'}}, {binding: 5, visibility: FRAGMENT, texture: {}},
            {binding: 6, visibility: FRAGMENT, texture: {}},
        ]});
        this.#pipelineLayout = device.createPipelineLayout({bindGroupLayouts: [this.#layout]});
        this.#sampler = device.createSampler({magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge'});
        this.#black = device.createTexture({size: [1, 1], format: LDR, usage: TEXTURE_BINDING | TEXTURE_COPY_DST});
        device.queue.writeTexture({texture: this.#black}, new Uint8Array(4), {}, [1, 1]);
        this.#blackView = this.#black.createView();
        // Stands in when the scene target has no readable depth; it reads as the near plane and is never used for effects.
        this.#noDepth = device.createTexture({size: [1, 1], format: 'depth24plus', usage: TEXTURE_BINDING | RENDER_ATTACHMENT});
        this.#noDepthView = this.#noDepth.createView();
    }
    private surface(existing: Surface | undefined, width: number, height: number, format: GPUTextureFormat): Surface {
        if (existing && existing.width === width && existing.height === height) return existing;
        existing?.texture.destroy();
        const texture = this.#device.createTexture({size: [width, height], format, usage: RENDER_ATTACHMENT | TEXTURE_BINDING});
        return {texture, view: texture.createView(), width, height};
    }
    private pipeline(name: keyof typeof SHADERS | 'composite', format: GPUTextureFormat, additive: boolean): GPURenderPipeline {
        // The composite source depends on the application's hook, so its module is keyed by the hook.
        const custom = name === 'composite' ? this.#custom : undefined, moduleKey = custom ? 'composite|' + custom.key : name;
        const key = moduleKey + '/' + format + (additive ? '/add' : '');
        let pipeline = this.#pipelines.get(key);
        if (pipeline) return pipeline;
        let module = this.#modules.get(moduleKey);
        if (!module) this.#modules.set(moduleKey, module = this.#device.createShaderModule({code: name === 'composite' ? postCompositeWgsl3D(custom?.wgsl) : SHADERS[name], label: 'post/' + moduleKey}));
        const blend: GPUBlendState = {color: {srcFactor: 'one', dstFactor: 'one'}, alpha: {srcFactor: 'one', dstFactor: 'one'}};
        pipeline = this.#device.createRenderPipeline({
            label: 'post/' + key, layout: this.#pipelineLayout, vertex: {module, entryPoint: 'vertexMain'},
            fragment: {module, entryPoint: 'fragmentMain', targets: [{format, ...(additive ? {blend} : {})}]}, primitive: {topology: 'triangle-list'},
        });
        this.#pipelines.set(key, pipeline);
        return pipeline;
    }
    private pass(encoder: GPUCommandEncoder, pipeline: GPURenderPipeline, source: GPUTextureView, bloom: GPUTextureView, output: GPUTextureView,
        load: boolean, a: readonly number[], b: readonly number[]): void {
        const device = this.#device;
        // Each pass in a frame owns one small uniform buffer, since all writes land before the encoder runs.
        let slot = this.#slots[this.#slot];
        if (!slot) slot = this.#slots[this.#slot] = {buffer: device.createBuffer({size: this.#params.byteLength, usage: UNIFORM | COPY_DST}), group: undefined, source: undefined, bloom: undefined, depth: undefined, ao: undefined, mask: undefined};
        this.#slot++;
        const p = this.#params, depth = this.#depthView ?? this.#noDepthView, ao = this.#aoView ?? this.#blackView;
        const mask = this.#maskView ?? this.#blackView;
        writePostParams3D(p, a, b, this.#view, this.#aoView !== undefined, this.#width, this.#height, this.#custom, this.#outline);
        device.queue.writeBuffer(slot.buffer, 0, p);
        // A surface cannot be sampled by the pass that renders into it.
        const aoInput = ao === output ? this.#blackView : ao;
        if (!slot.group || slot.source !== source || slot.bloom !== bloom || slot.depth !== depth || slot.ao !== aoInput || slot.mask !== mask) {
            slot.group = device.createBindGroup({layout: this.#layout, entries: [
                {binding: 0, resource: {buffer: slot.buffer}}, {binding: 1, resource: source}, {binding: 2, resource: this.#sampler}, {binding: 3, resource: bloom},
                {binding: 4, resource: depth}, {binding: 5, resource: aoInput}, {binding: 6, resource: mask},
            ]});
            slot.source = source; slot.bloom = bloom; slot.depth = depth; slot.ao = aoInput; slot.mask = mask;
        }
        const pass = encoder.beginRenderPass({colorAttachments: [{view: output, loadOp: load ? 'load' : 'clear', storeOp: 'store', clearValue: [0, 0, 0, 0]}]});
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, slot.group);
        pass.draw(3);
        pass.end();
    }
    /**
     * Process `sceneView` into `output`. `outputEncodes` is true when the
     * output format converts linear values to sRGB on write.
     */
    run(encoder: GPUCommandEncoder, sceneView: GPUTextureView, depthView: GPUTextureView | undefined, maskView: GPUTextureView | undefined, view: PostView3D, width: number, height: number, output: GPUTextureView, outputFormat: GPUTextureFormat,
        outputEncodes: boolean, settings: PostProcessSettings3D, toneMapping: ToneMapping3D): number {
        this.#slot = 0;
        this.#view = view; this.#depthView = depthView; this.#aoView = undefined; this.#custom = undefined; this.#width = width; this.#height = height;
        this.#maskView = maskView; this.#outline = maskView ? settings : undefined;
        const black = this.#blackView;
        if (settings.ssao && depthView && settings.ssaoIntensity > 0) {
            const ao = this.#ao = this.surface(this.#ao, width, height, LDR);
            this.pass(encoder, this.pipeline('ssao', LDR, false), sceneView, black, ao.view, false, [Math.max(settings.ssaoRadius, 0.001), settings.ssaoIntensity, settings.ssaoBias, 0], [0, 0, 0, 0]);
            this.#aoView = ao.view;
        }
        const levels = bloomLevelCount3D(settings, width, height);
        if (levels > 0) {
            const down = this.pipeline('down', HDR, false), up = this.pipeline('up', HDR, true);
            let w = width, h = height, source = sceneView;
            for (let i = 0; i < levels; i++) {
                const sourceWidth = w, sourceHeight = h;
                w = Math.max(w >> 1, 1); h = Math.max(h >> 1, 1);
                const level = this.#levels[i] = this.surface(this.#levels[i], w, h, HDR);
                this.pass(encoder, down, source, black, level.view, false, [1 / sourceWidth, 1 / sourceHeight, settings.bloomThreshold, Math.min(Math.max(settings.bloomKnee, 0), 1)], [i === 0 ? 1 : 0, 0, 0, 0]);
                source = level.view;
            }
            for (let i = levels - 1; i > 0; i--) {
                const from = this.#levels[i]!, to = this.#levels[i - 1]!;
                this.pass(encoder, up, from.view, black, to.view, true, [1 / from.width, 1 / from.height, 0, 0], [0, 0, 0, 0]);
            }
        }
        // The hook needs depth; without a depth texture it is left out rather than reading garbage.
        this.#custom = depthView && settings.custom?.wgsl !== undefined ? settings.custom : undefined;
        const bloom = levels > 0 ? this.#levels[0]!.view : black, p = new Float32Array(8);
        if (settings.fxaa) {
            const ldr = this.#ldr = this.surface(this.#ldr, width, height, LDR);
            writeCompositeParams3D(p, settings, levels, toneMapping, true);
            this.pass(encoder, this.pipeline('composite', LDR, false), sceneView, bloom, ldr.view, false, [...p.subarray(0, 4)], [...p.subarray(4, 8)]);
            this.pass(encoder, this.pipeline('fxaa', outputFormat, false), ldr.view, black, output, false, [1 / width, 1 / height, outputEncodes ? 1 : 0, 0], [0, 0, 0, 0]);
        } else {
            writeCompositeParams3D(p, settings, levels, toneMapping, !outputEncodes);
            this.pass(encoder, this.pipeline('composite', outputFormat, false), sceneView, bloom, output, false, [...p.subarray(0, 4)], [...p.subarray(4, 8)]);
        }
        return this.#slot;
    }
    dispose(): void {
        for (const surface of this.#levels) surface.texture.destroy();
        this.#ldr?.texture.destroy(); this.#ao?.texture.destroy(); this.#noDepth.destroy();
        for (const slot of this.#slots) slot.buffer.destroy();
        this.#black.destroy();
        this.#levels.length = 0; this.#slots.length = 0; this.#ldr = undefined; this.#ao = undefined;
        this.#pipelines.clear(); this.#modules.clear();
        this.scene.dispose(); this.mask.dispose(); this.maskMaterial.dispose();
    }
}
