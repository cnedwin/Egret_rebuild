// SPDX-License-Identifier: Apache-2.0
// WebGL2 backend for the world3d scene graph. One frame runs a shadow-atlas
// pass, an opaque pass sorted for minimal state changes, an optional skybox
// and a back-to-front transparent pass. The renderer owns its context and
// every GPU object; scene objects stay backend-free.
import type {Camera3D} from '../../rendering/world3d/Camera3D.js';
import {World3DError} from '../../rendering/world3d/core3D.js';
import type {Geometry3D} from '../../rendering/world3d/Geometry3D.js';
import type {Light3D} from '../../rendering/world3d/Light3D.js';
import type {Material3D} from '../../rendering/world3d/Material3D.js';
import {linearToSrgb, mat3NormalFromMat4, mat4Invert} from '../../rendering/world3d/math3D.js';
import type {InstancedMesh3D, Mesh3D} from '../../rendering/world3d/Mesh3D.js';
import {SkinnedInstancedMesh3D} from '../../rendering/world3d/AnimationTexture3D.js';
import {GpuParticles3D} from '../../rendering/world3d/GpuParticles3D.js';
import type {Scene3D} from '../../rendering/world3d/Object3D.js';
import {RenderList3D} from '../../rendering/world3d/RenderList3D.js';
import type {RenderItem3D} from '../../rendering/world3d/RenderList3D.js';
import {CubeTexture3D, RenderTarget3D, type Texture3D} from '../../rendering/world3d/Texture3D.js';
import type {CompressedFormat3D} from '../../rendering/world3d/Texture3D.js';
import {FRAME_BLOCK_FLOATS_3D, FRAME_OFFSETS_3D, planShadows3D, writeFrameBlock3D} from './frame3D.js';
import {createPostProcessSettings3D, outlineActive3D, postViewFromCamera3D} from './post3D.js';
import type {PostProcessSettings3D} from './post3D.js';
import {PostChainWebGL23D} from './postWebGL23D.js';
import type {Renderer3D, Renderer3DInfo, ToneMapping3D} from './frame3D.js';
import {GpuResources3D} from './gpuResources3D.js';
import type {GeometryGpu3D, Program3D} from './gpuResources3D.js';
import {MAX_MORPH_INFLUENCES_3D, SKYBOX_SHADER_3D, TEXTURE_UNITS_3D, buildMaterialShader3D} from './shaders3D.js';

export interface WebGL2Renderer3DOptions {
    readonly canvas: HTMLCanvasElement | OffscreenCanvas;
    readonly antialias?: boolean;
    /** Keep an alpha channel so the page shows through where nothing is drawn. */
    readonly alpha?: boolean;
    readonly powerPreference?: WebGLPowerPreference;
    readonly preserveDrawingBuffer?: boolean;
    readonly toneMapping?: ToneMapping3D;
    readonly exposure?: number;
    readonly shadows?: boolean;
    /** Edge of the shared shadow atlas in texels; each shadow light receives a quarter. */
    readonly shadowAtlasSize?: number;
    readonly onContextLost?: () => void;
    readonly onContextRestored?: () => void;
}
// Program variant bits contributed by geometry, mesh and frame state.
const V = Object.freeze({
    normal: 1, tangent: 2, uv: 4, color: 8, skin: 16, morph: 32, morphNormals: 64, instancing: 128, instanceColor: 256,
    receiveShadow: 512, fog: 1024, toneMapped: 2048, environment: 4096, points: 8192, depthOnly: 16384, linearOutput: 32768,
    mapFromTarget: 65536, uv1: 131072, occlusionSecond: 262144, emissiveSecond: 524288, lightSecond: 1048576, transmission: 2097152, skinInstancing: 4194304, gpuParticles: 8388608, softDepth: 16777216,
} as const);
const IDENTITY3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const IDENTITY4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export class WebGL2Renderer3D implements Renderer3D {
    readonly canvas: HTMLCanvasElement | OffscreenCanvas;
    toneMapping: ToneMapping3D;
    exposure: number;
    shadowsEnabled: boolean;
    /** Bloom, color grading and FXAA; set `enabled` to turn the chain on. */
    readonly postProcess: PostProcessSettings3D = createPostProcessSettings3D();
    viewport: readonly [number, number, number, number] | undefined;
    autoClear = true;
    #post: PostChainWebGL23D | undefined;
    #inPost = false;
    #frameToneMapping: ToneMapping3D = 'none';
    readonly info: Renderer3DInfo = {frame: 0, drawCalls: 0, triangles: 0, visited: 0, culled: 0, shadowMaps: 0, programs: 0, geometries: 0, textures: 0};
    readonly #gl: WebGL2RenderingContext;
    readonly #alpha: boolean;
    readonly #options: WebGL2Renderer3DOptions;
    readonly #list = new RenderList3D();
    readonly #frameData = new Float32Array(FRAME_BLOCK_FLOATS_3D);
    readonly #materialPrograms = new Map<number, {version: number; variants: Map<number, Program3D>; unsubscribe: () => void}>();
    #resources: GpuResources3D;
    #frameBuffer: WebGLBuffer | null = null;
    #emptyVao: WebGLVertexArrayObject | null = null;
    #shadowTexture: WebGLTexture | null = null;
    #shadowFramebuffer: WebGLFramebuffer | null = null;
    #sceneDepth: {texture: WebGLTexture; framebuffer: WebGLFramebuffer; width: number; height: number} | undefined;
    #sceneDepthReady = false;
    #shadowSize = 0;
    readonly #shadowAtlasSize: number;
    #shadowCount = 0;
    #lost = false;
    #disposed = false;
    // Cached pipeline state avoids redundant driver calls.
    #program: Program3D | undefined;
    #cull = '';
    #blend = '';
    #depthTest: boolean | undefined;
    #depthWrite: boolean | undefined;
    #frontCw = false;
    #offset: readonly [number, number] | undefined;
    readonly #scratch16 = new Float32Array(16);
    readonly #scratch9 = new Float32Array(9);
    #lightMatrix: Float32Array = new Float32Array(16);
    readonly #morphIndices = new Int32Array(MAX_MORPH_INFLUENCES_3D);
    readonly #morphWeights = new Float32Array(MAX_MORPH_INFLUENCES_3D);
    readonly #onLost: (event: Event) => void;
    readonly #onRestored: () => void;

    constructor(options: WebGL2Renderer3DOptions) {
        const canvas = options?.canvas;
        if (!canvas || typeof (canvas as HTMLCanvasElement).getContext !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'canvas');
        this.#options = options;
        this.#alpha = options.alpha ?? false;
        const gl = (canvas as HTMLCanvasElement).getContext('webgl2', {
            alpha: this.#alpha, antialias: options.antialias ?? true, depth: true, stencil: false, premultipliedAlpha: true,
            powerPreference: options.powerPreference ?? 'high-performance', preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
        }) as WebGL2RenderingContext | null;
        if (!gl) throw new World3DError('WORLD3D_CONTEXT_UNAVAILABLE', 'webgl2');
        this.canvas = canvas;
        this.#gl = gl;
        this.toneMapping = options.toneMapping ?? 'aces';
        this.exposure = options.exposure ?? 1;
        this.shadowsEnabled = options.shadows ?? true;
        this.#shadowAtlasSize = Math.min(options.shadowAtlasSize ?? 2048, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
        this.#resources = new GpuResources3D(gl);
        this.#onLost = (event: Event): void => {
            // Without preventDefault the browser never restores the context.
            event.preventDefault();
            this.#lost = true;
            options.onContextLost?.();
        };
        this.#onRestored = (): void => {
            this.#resources.reset();
            this.#resources = new GpuResources3D(gl);
            this.#post?.dispose(true); this.#post = undefined;
            this.clearMaterialPrograms();
            this.#frameBuffer = this.#emptyVao = this.#shadowTexture = this.#shadowFramebuffer = null;
            this.#sceneDepth = undefined; this.#sceneDepthReady = false;
            this.#grab = undefined;
            this.#shadowSize = 0;
            this.resetState();
            this.#lost = false;
            options.onContextRestored?.();
        };
        canvas.addEventListener('webglcontextlost', this.#onLost);
        canvas.addEventListener('webglcontextrestored', this.#onRestored);
    }
    get isContextLost(): boolean { return this.#lost || this.#gl.isContextLost(); }
    /** The underlying context, for advanced interop. Restore any state you change. */
    get context(): WebGL2RenderingContext { return this.#gl; }

    /** Resize the drawing buffer; `pixelRatio` multiplies the logical size. */
    setSize(width: number, height: number, pixelRatio = 1): void {
        const w = Math.max(1, Math.floor(width * pixelRatio)), h = Math.max(1, Math.floor(height * pixelRatio));
        if (!Number.isFinite(w) || !Number.isFinite(h)) throw new World3DError('WORLD3D_INPUT_INVALID', 'size');
        if (this.canvas.width !== w) this.canvas.width = w;
        if (this.canvas.height !== h) this.canvas.height = h;
    }
    /** Match the drawing buffer to the canvas's CSS size. Returns true when it changed. */
    resizeToDisplaySize(pixelRatio = 1): boolean {
        const element = this.canvas as HTMLCanvasElement;
        if (typeof element.clientWidth !== 'number') return false;
        const w = Math.max(1, Math.floor(element.clientWidth * pixelRatio)), h = Math.max(1, Math.floor(element.clientHeight * pixelRatio));
        if (element.width === w && element.height === h) return false;
        element.width = w; element.height = h;
        return true;
    }

    // ---- frame ---------------------------------------------------------------
    /**
     * Draw one frame to the canvas, or into `target` when given. Returns false
     * when the context is lost and nothing was drawn.
     */
    render(scene: Scene3D, camera: Camera3D, target?: RenderTarget3D): boolean {
        if (this.#disposed) throw new World3DError('WORLD3D_DISPOSED', 'renderer');
        if (this.isContextLost) return false;
        if (this.postProcess.enabled && !this.#inPost) return this.renderPost(scene, camera, target);
        const gl = this.#gl, list = this.#list, info = this.info;
        // Half-float targets keep scene-referred light; tone mapping happens when they are displayed.
        const toneMapping = this.#frameToneMapping = target?.format === 'rgba16f' ? 'none' : this.toneMapping;
        list.build(scene, camera);
        info.frame = list.frame; info.drawCalls = info.triangles = 0;
        info.visited = list.stats.visited; info.culled = list.stats.culled;
        this.resetState();
        this.bindFrameBlock();
        this.ensureShadowAtlas();
        this.renderShadows(camera);
        // Surfaces that fade near solid geometry read its depth, drawn once up front.
        this.#sceneDepthReady = list.transparent.some(item => item.material.softness > 0) && this.renderSceneDepth(camera, target);

        if (target) {
            if (target.isDisposed) throw new World3DError('WORLD3D_DISPOSED', 'render target');
            const entry = this.#resources.target(target);
            gl.bindFramebuffer(gl.FRAMEBUFFER, entry.framebuffer);
            gl.viewport(0, 0, target.width, target.height);
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        }
        this.#linearOutput = target !== undefined;
        const background = scene.background;
        gl.depthMask(true);
        this.#depthWrite = true;
        // sRGB targets encode on write, so they are cleared with linear values.
        const encode = target ? (value: number): number => value : linearToSrgb;
        if (Array.isArray(background)) gl.clearColor(encode(background[0]!), encode(background[1]!), encode(background[2]!), 1);
        else gl.clearColor(0, 0, 0, (target || this.#alpha) && !background ? 0 : 1);
        gl.clear(this.autoClear ? gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT : gl.DEPTH_BUFFER_BIT);
        const view = this.viewport;
        if (view) {
            const fullWidth = target ? target.width : gl.drawingBufferWidth, fullHeight = target ? target.height : gl.drawingBufferHeight;
            const x = Math.round(view[0] * fullWidth), y = Math.round(view[1] * fullHeight), w = Math.max(Math.round(view[2] * fullWidth), 1), h = Math.max(Math.round(view[3] * fullHeight), 1);
            gl.viewport(x, y, w, h);
            gl.enable(gl.SCISSOR_TEST); gl.scissor(x, y, w, h);
        }

        let environmentMaxMip = 0;
        this.#lastEnvironment = scene.environment;
        if (scene.environment) environmentMaxMip = this.#resources.bindCube(TEXTURE_UNITS_3D.environment, scene.environment);
        writeFrameBlock3D(this.#frameData, scene, camera, list, this.#shadowSlots, {exposure: this.exposure, toneMapping, environmentMaxMip});
        this.#frameData[FRAME_OFFSETS_3D.clipInfo + 2] = view ? view[2] : 1; this.#frameData[FRAME_OFFSETS_3D.clipInfo + 3] = view ? view[3] : 1;
        this.uploadFrameBlock();
        const flags = (scene.fog ? V.fog : 0) | (toneMapping !== 'none' ? V.toneMapped : 0) | (scene.environment ? V.environment : 0)
            | (target ? V.linearOutput : 0);
        for (const item of list.opaque) this.draw(item, flags, false);
        if (background instanceof CubeTexture3D) this.drawSkybox(background, scene.backgroundIntensity, camera);
        // See-through surfaces read a copy of everything drawn so far.
        this.#grabbed = false;
        for (const item of list.transparent) if (item.material.transmission > 0 && item.material.shading === 'standard') { this.#grabbed = this.grabScene(target); break; }
        for (const item of list.transparent) this.draw(item, flags, false);
        this.#grabbed = false;
        gl.bindVertexArray(null);
        if (view) gl.disable(gl.SCISSOR_TEST);
        if (target) gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.#resources.prune(list.frame);
        const counts = this.#resources.counts;
        info.programs = counts.programs; info.geometries = counts.geometries; info.textures = counts.textures;
        info.shadowMaps = this.#shadowCount;
        return true;
    }
    /** Draw the scene into the half-float chain target, then post-process into the output. */
    private renderPost(scene: Scene3D, camera: Camera3D, target: RenderTarget3D | undefined): boolean {
        const gl = this.#gl;
        if (target?.isDisposed) throw new World3DError('WORLD3D_DISPOSED', 'render target');
        const width = target ? target.width : gl.drawingBufferWidth, height = target ? target.height : gl.drawingBufferHeight;
        const post = this.#post ??= new PostChainWebGL23D(gl, this.#resources);
        post.scene.setSize(Math.max(width, 1), Math.max(height, 1));
        this.#inPost = true;
        try { if (!this.render(scene, camera, post.scene)) return false; }
        finally { this.#inPost = false; }
        const output = target ? this.#resources.target(target).framebuffer : null;
        // 8-bit targets encode sRGB on write and half-float targets store linear light; only the canvas needs encoded values.
        // Outlined objects are drawn once more, flat white, into a mask the composite traces.
        let maskTexture: WebGLTexture | undefined;
        if (outlineActive3D(this.postProcess)) {
            post.mask.setSize(Math.max(width, 1), Math.max(height, 1));
            const saved = {layerMask: camera.layerMask, override: scene.overrideMaterial, background: scene.background, shadows: this.shadowsEnabled, planes: scene.clippingPlanes};
            camera.layerMask = this.postProcess.outlineLayers; scene.overrideMaterial = post.maskMaterial; scene.background = [0, 0, 0]; this.shadowsEnabled = false;
            this.#inPost = true;
            // The counters describe the scene, not this helper pass.
            const counted = {...this.info};
            try { if (this.render(scene, camera, post.mask)) maskTexture = this.#resources.target(post.mask).color; }
            finally { this.#inPost = false; camera.layerMask = saved.layerMask; scene.overrideMaterial = saved.override; scene.background = saved.background; this.shadowsEnabled = saved.shadows; Object.assign(this.info, counted); }
        }
        const sceneEntry = this.#resources.target(post.scene);
        this.info.drawCalls += post.run(sceneEntry.color, sceneEntry.depthTexture, maskTexture, postViewFromCamera3D(camera), width, height, output, target !== undefined,
            this.postProcess, target?.format === 'rgba16f' ? 'none' : this.toneMapping, this.#emptyVao ??= gl.createVertexArray());
        this.resetState();
        return true;
    }
    /** Copy the output drawn so far into a texture on the scene-color unit. */
    private grabScene(target: RenderTarget3D | undefined): boolean {
        const gl = this.#gl, source = target ? this.#resources.target(target).framebuffer : null;
        const width = target ? target.width : gl.drawingBufferWidth, height = target ? target.height : gl.drawingBufferHeight;
        const format = target ? (target.format === 'rgba16f' && this.#resources.floatTargets ? gl.RGBA16F : gl.SRGB8_ALPHA8) : this.#alpha ? gl.RGBA8 : gl.RGB8;
        let grab = this.#grab;
        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.sceneColor);
        if (!grab) {
            const texture = gl.createTexture(), framebuffer = gl.createFramebuffer();
            if (!texture || !framebuffer) { if (texture) gl.deleteTexture(texture); if (framebuffer) gl.deleteFramebuffer(framebuffer); gl.activeTexture(gl.TEXTURE0); return false; }
            grab = this.#grab = {texture, framebuffer, width: 0, height: 0, format: 0};
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        } else gl.bindTexture(gl.TEXTURE_2D, grab.texture);
        if (grab.width !== width || grab.height !== height || grab.format !== format) {
            if (format === gl.RGBA16F) gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
            else if (format === gl.RGB8) gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
            else gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            grab.width = width; grab.height = height; grab.format = format;
            gl.bindFramebuffer(gl.FRAMEBUFFER, grab.framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, grab.texture, 0);
        }
        if (target) {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, grab.framebuffer);
            gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
            gl.bindFramebuffer(gl.FRAMEBUFFER, source);
        } else {
            // The canvas may be antialiased; a texture copy reads its resolved image.
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, width, height);
        }
        gl.activeTexture(gl.TEXTURE0);
        return true;
    }
    #grab: {texture: WebGLTexture; framebuffer: WebGLFramebuffer; width: number; height: number; format: number} | undefined;
    #grabbed = false;
    /** Stands for every plain opaque material while drawing depth only. */
    readonly #plainDepth = {} as Material3D;
    private resetState(): void {
        const gl = this.#gl;
        this.#appliedProgram = undefined; this.#appliedMaterial = undefined;
        this.#program = undefined; this.#cull = ''; this.#blend = ''; this.#depthTest = undefined; this.#depthWrite = undefined; this.#offset = undefined;
        this.#frontCw = false;
        if (this.#gl.isContextLost()) return;
        gl.frontFace(gl.CCW);
        gl.depthFunc(gl.LEQUAL);
        gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.disable(gl.SCISSOR_TEST);
        gl.colorMask(true, true, true, true);
    }
    /** std140 blocks stay active even when unused, so the buffer must be bound before the shadow pass. */
    private bindFrameBlock(): void {
        const gl = this.#gl;
        if (!this.#frameBuffer) {
            this.#frameBuffer = gl.createBuffer();
            gl.bindBuffer(gl.UNIFORM_BUFFER, this.#frameBuffer);
            gl.bufferData(gl.UNIFORM_BUFFER, this.#frameData.byteLength, gl.DYNAMIC_DRAW);
        }
        gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.#frameBuffer);
    }
    private uploadFrameBlock(): void {
        const gl = this.#gl;
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.#frameBuffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.#frameData);
    }

    // ---- shadows -------------------------------------------------------------
    readonly #shadowSlots = new Map<Light3D, number>();
    private ensureShadowAtlas(): void {
        const gl = this.#gl;
        // A 1x1 atlas keeps the comparison sampler complete when shadows are off.
        const wanted = this.shadowsEnabled ? this.#shadowAtlasSize : 1;
        if (this.#shadowTexture && this.#shadowSize === wanted) return;
        if (this.#shadowTexture) gl.deleteTexture(this.#shadowTexture);
        if (this.#shadowFramebuffer) gl.deleteFramebuffer(this.#shadowFramebuffer);
        const texture = gl.createTexture(), framebuffer = gl.createFramebuffer();
        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.shadow);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, wanted, wanted);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture, 0);
        gl.drawBuffers([gl.NONE]);
        gl.readBuffer(gl.NONE);
        gl.clearDepth(1);
        gl.depthMask(true);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        this.#shadowTexture = texture; this.#shadowFramebuffer = framebuffer; this.#shadowSize = wanted;
    }
    private renderShadows(camera: Camera3D): void {
        const gl = this.#gl;
        this.#shadowCount = 0;
        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.shadow);
        gl.bindTexture(gl.TEXTURE_2D, this.#shadowTexture);
        const plans = planShadows3D(this.#frameData, this.#list, this.#shadowSize, this.shadowsEnabled, false, this.#shadowSlots, camera);
        if (plans.length === 0) return;
        const size = this.#shadowSize;
        // Unbind the atlas while rendering into it to avoid a feedback loop.
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.#shadowFramebuffer);
        gl.viewport(0, 0, size, size);
        gl.depthMask(true); this.#depthWrite = true;
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.SCISSOR_TEST);
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1.5, 4);
        gl.colorMask(false, false, false, false);
        for (const plan of plans) {
            gl.viewport(plan.x, plan.y, plan.tile, plan.tile);
            gl.scissor(plan.x, plan.y, plan.tile, plan.tile);
            this.#lightMatrix = plan.matrix;
            for (const mesh of plan.casters) this.drawDepth(mesh);
        }
        gl.colorMask(true, true, true, true);
        gl.disable(gl.SCISSOR_TEST);
        gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.shadow);
        gl.bindTexture(gl.TEXTURE_2D, this.#shadowTexture);
        this.#shadowCount = plans.length;
        this.#program = undefined; this.#appliedProgram = undefined;
    }
    /** Draw the depth of the opaque scene, as the camera sees it, into a texture of the output's size. */
    private renderSceneDepth(camera: Camera3D, target: RenderTarget3D | undefined): boolean {
        const gl = this.#gl, width = target ? target.width : gl.drawingBufferWidth, height = target ? target.height : gl.drawingBufferHeight;
        let entry = this.#sceneDepth;
        if (!entry || entry.width !== width || entry.height !== height) {
            if (entry) { gl.deleteTexture(entry.texture); gl.deleteFramebuffer(entry.framebuffer); this.#sceneDepth = undefined; }
            const texture = gl.createTexture(), framebuffer = gl.createFramebuffer();
            if (!texture || !framebuffer) { if (texture) gl.deleteTexture(texture); if (framebuffer) gl.deleteFramebuffer(framebuffer); return false; }
            gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.sceneDepth);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, width, height);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture, 0);
            gl.drawBuffers([gl.NONE]);
            gl.readBuffer(gl.NONE);
            entry = this.#sceneDepth = {texture, framebuffer, width, height};
        }
        // The texture must not be bound for reading while it is drawn into.
        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.sceneDepth);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, entry.framebuffer);
        const view = this.viewport;
        if (view) gl.viewport(Math.round(view[0] * width), Math.round(view[1] * height), Math.max(Math.round(view[2] * width), 1), Math.max(Math.round(view[3] * height), 1));
        else gl.viewport(0, 0, width, height);
        gl.depthMask(true); this.#depthWrite = true;
        gl.clearDepth(1);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        this.#lightMatrix = camera.viewProjectionMatrix;
        for (const item of this.#list.opaque) {
            if (item.geometry.topology === 'triangles' && item.material.depthWrite && !item.material.billboard && !item.material.screenSpace) this.draw(item, 0, true);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.sceneDepth);
        gl.bindTexture(gl.TEXTURE_2D, entry.texture);
        this.#program = undefined; this.#appliedProgram = undefined;
        return true;
    }
    private readonly depthItem: RenderItem3D = {mesh: undefined as unknown as Mesh3D, geometry: undefined as unknown as Geometry3D, material: undefined as unknown as Material3D, start: 0, count: 0, depth: 0};
    private drawDepth(mesh: Mesh3D): void {
        const geometry = mesh.geometry, item = this.depthItem, groups = geometry.groups;
        if (geometry.topology !== 'triangles') return;
        item.mesh = mesh; item.geometry = geometry;
        if (Array.isArray(mesh.material) && groups.length > 0) {
            for (const group of groups) {
                item.material = mesh.materialAt(group.materialIndex); item.start = group.start; item.count = group.count;
                if (item.material.visible && !item.material.isDisposed && !item.material.billboard) this.draw(item, 0, true);
            }
        } else {
            item.material = mesh.materialAt(0); item.start = 0; item.count = geometry.drawCount;
            if (item.material.visible && !item.material.isDisposed && !item.material.billboard) this.draw(item, 0, true);
        }
    }

    // ---- programs --------------------------------------------------------------
    private selectProgram(material: Material3D, variant: number): Program3D {
        let cache = this.#materialPrograms.get(material.id);
        if (!cache) {
            const unsubscribe = material.onDispose(() => { this.#materialPrograms.delete(material.id); });
            cache = {version: material.version, variants: new Map(), unsubscribe};
            this.#materialPrograms.set(material.id, cache);
        } else if (cache.version !== material.version) {
            cache.version = material.version;
            cache.variants.clear();
        }
        let program = cache.variants.get(variant);
        if (program) return program;
        const has = (bit: number): boolean => (variant & bit) !== 0;
        const depthOnly = has(V.depthOnly), uv = has(V.uv), defines: string[] = [];
        if (depthOnly) defines.push('DEPTH_ONLY');
        else defines.push(material.shading === 'unlit' ? 'SHADING_UNLIT' : material.shading === 'lambert' ? 'SHADING_LAMBERT' : material.shading === 'phong' ? 'SHADING_PHONG'
            : material.shading === 'toon' ? 'SHADING_TOON' : material.shading === 'matcap' ? 'SHADING_MATCAP' : 'SHADING_STANDARD');
        if (has(V.normal)) defines.push('USE_NORMAL');
        if (has(V.skin)) defines.push('USE_SKINNING');
        if (has(V.morph)) defines.push('USE_MORPH');
        if (has(V.morphNormals) && (!depthOnly || material.shader?.glslVertex !== undefined)) defines.push('USE_MORPH_NORMALS');
        if (has(V.instancing)) defines.push('USE_INSTANCING');
        if (has(V.skinInstancing)) defines.push('USE_SKIN_INSTANCING');
        if (has(V.gpuParticles) && !depthOnly) defines.push('GPU_PARTICLES');
        if (has(V.softDepth)) defines.push('USE_SOFT_DEPTH');
        if (has(V.points)) defines.push('POINTS');
        if (material.screenSpace) defines.push('SCREEN_SPACE');
        else if (material.billboard) defines.push('BILLBOARD');
        if (uv && material.map) {
            defines.push('USE_MAP');
            if (has(V.mapFromTarget)) defines.push('MAP_FROM_TARGET');
        }
        if (uv && material.splat && !depthOnly) defines.push('USE_SPLAT');
        if (material.alphaMode === 'mask') defines.push('ALPHA_MASK');
        if (material.alphaMode === 'blend') {
            defines.push('ALPHA_BLEND');
            if (!depthOnly && material.blending === 'premultiplied') defines.push('PREMULTIPLIED_ALPHA');
        }
        if (has(V.color)) defines.push('USE_VERTEX_COLOR');
        if (!depthOnly) {
            const lit = material.shading !== 'unlit' && material.shading !== 'matcap';
            if (has(V.instanceColor)) defines.push('USE_INSTANCE_COLOR');
            if (lit && uv && material.normalMap) { defines.push('USE_NORMAL_MAP'); if (has(V.tangent)) defines.push('USE_TANGENT'); }
            if (lit && uv && material.metallicRoughnessMap && material.shading === 'standard') defines.push('USE_MR_MAP');
            // A map on the second coordinate set needs only that set; it falls back to the first when the geometry lacks it.
            const aoSecond = has(V.occlusionSecond), emissiveSecond = has(V.emissiveSecond);
            if (lit && (uv || aoSecond) && material.occlusionMap) { defines.push('USE_AO_MAP'); if (aoSecond) defines.push('AO_UV1'); }
            if ((uv || emissiveSecond) && material.emissiveMap && material.shading !== 'matcap') { defines.push('USE_EMISSIVE_MAP'); if (emissiveSecond) defines.push('EMISSIVE_UV1'); }
            if (lit && material.lightMap && (uv || has(V.lightSecond))) { defines.push('USE_LIGHT_MAP'); if (has(V.lightSecond)) defines.push('LIGHT_UV1'); }
            if (material.flatShading) defines.push('FLAT_SHADED');
            if (material.side === 'double') defines.push('DOUBLE_SIDED');
            if (lit && has(V.receiveShadow)) defines.push('RECEIVE_SHADOW');
            if (lit && has(V.environment)) defines.push('USE_ENVIRONMENT');
            if (has(V.fog) && material.fog) defines.push('USE_FOG');
            if (has(V.toneMapped) && material.toneMapped) defines.push('TONE_MAPPED');
            if (has(V.linearOutput)) defines.push('LINEAR_OUTPUT');
            if (has(V.transmission) && material.shading === 'standard') defines.push('USE_TRANSMISSION');
            if (material.reflectionMap && material.shading === 'standard') defines.push('USE_REFLECTION_MAP');
        }
        const custom = depthOnly ? undefined : material.shader?.glsl, customVertex = material.shader?.glslVertex;
        const customNormal = depthOnly || material.shading === 'unlit' || material.shading === 'matcap' ? undefined : material.shader?.glslNormal;
        if (custom !== undefined) defines.push('CUSTOM_FRAGMENT');
        if (customVertex !== undefined) defines.push('CUSTOM_VERTEX');
        if (customNormal !== undefined) defines.push('CUSTOM_NORMAL');
        program = this.#resources.program(defines.join(' ') + (custom === undefined && customVertex === undefined && customNormal === undefined ? '' : '|' + material.shader!.key), () => buildMaterialShader3D(defines, custom, customVertex, customNormal));
        cache.variants.set(variant, program);
        return program;
    }
    private applyMaterial(program: Program3D, material: Material3D, depthOnly: boolean): void {
        const gl = this.#gl, u = program.uniforms, resources = this.#resources;
        if (u['uColor']) gl.uniform4f(u['uColor'], material.color[0]!, material.color[1]!, material.color[2]!, material.opacity);
        if (u['uAlphaCutoff']) gl.uniform1f(u['uAlphaCutoff'], material.alphaCutoff);
        const customLocation = u['uCustom[0]'] ?? u['uCustom'];
        if (customLocation && material.shader) gl.uniform4fv(customLocation, material.shader.uniforms);
        if (u['uMap'] && material.map) resources.bindTexture(TEXTURE_UNITS_3D.map, material.map);
        if (u['uUvTransform']) {
            const map = material.map;
            if (map?.hasTransform) {
                const c = Math.cos(map.rotation), s = Math.sin(map.rotation), m = this.#scratch9;
                m[0] = c * map.repeat[0]!; m[1] = s * map.repeat[0]!; m[2] = 0;
                m[3] = -s * map.repeat[1]!; m[4] = c * map.repeat[1]!; m[5] = 0;
                m[6] = map.offset[0]!; m[7] = map.offset[1]!; m[8] = 1;
                gl.uniformMatrix3fv(u['uUvTransform'], false, m);
            } else gl.uniformMatrix3fv(u['uUvTransform'], false, IDENTITY3);
        }
        if (u['uSprite']) gl.uniform4f(u['uSprite'], material.rotation, material.sizeAttenuation ? 1 : 0, 0, 0);
        if (u['uPointSize']) gl.uniform2f(u['uPointSize'], material.pointSize, material.sizeAttenuation ? 1 : 0);
        if (depthOnly) return;
        const e = material.emissiveIntensity;
        if (u['uEmissive']) gl.uniform3f(u['uEmissive'], material.emissive[0]! * e, material.emissive[1]! * e, material.emissive[2]! * e);
        if (u['uClearcoat']) gl.uniform2f(u['uClearcoat'], material.clearcoat, material.clearcoatRoughness);
        if (u['uSurface']) gl.uniform4f(u['uSurface'], material.metallic, material.roughness, material.normalScale, material.occlusionStrength);
        if (u['uSpecular']) gl.uniform4f(u['uSpecular'], material.specular[0]!, material.specular[1]!, material.specular[2]!, material.shading === 'toon' ? material.toonSteps : material.shininess);
        if (u['uEnvironmentScale']) gl.uniform1f(u['uEnvironmentScale'], material.environmentIntensity);
        if (u['uNormalMap'] && material.normalMap) resources.bindTexture(TEXTURE_UNITS_3D.normalMap, material.normalMap);
        if (u['uMetallicRoughnessMap'] && material.metallicRoughnessMap) resources.bindTexture(TEXTURE_UNITS_3D.metallicRoughnessMap, material.metallicRoughnessMap);
        if (u['uOcclusionMap'] && material.occlusionMap) resources.bindTexture(TEXTURE_UNITS_3D.occlusionMap, material.occlusionMap);
        if (u['uEmissiveMap'] && material.emissiveMap) resources.bindTexture(TEXTURE_UNITS_3D.emissiveMap, material.emissiveMap);
        if (u['uLightMap'] && material.lightMap) resources.bindTexture(TEXTURE_UNITS_3D.lightMap, material.lightMap);
        if (u['uReflectionMap'] && material.reflectionMap) resources.bindTexture(TEXTURE_UNITS_3D.reflectionMap, material.reflectionMap);
        const splat = material.splat;
        if (u['uSplatRepeat'] && splat) {
            // Layers borrow the units of the maps they stand in for; a missing layer reads the first.
            const layer = (i: number): Texture3D => splat.layers[i] ?? splat.layers[0]!;
            resources.bindTexture(TEXTURE_UNITS_3D.map, layer(0)); resources.bindTexture(TEXTURE_UNITS_3D.emissiveMap, layer(1));
            resources.bindTexture(TEXTURE_UNITS_3D.occlusionMap, layer(2)); resources.bindTexture(TEXTURE_UNITS_3D.metallicRoughnessMap, layer(3));
            resources.bindTexture(TEXTURE_UNITS_3D.lightMap, splat.weights);
            gl.uniform4f(u['uSplatRepeat'], splat.repeat[0] ?? 1, splat.repeat[1] ?? 1, splat.repeat[2] ?? 1, splat.repeat[3] ?? 1);
        }
        if (u['uSoftness']) gl.uniform1f(u['uSoftness'], material.softness);
        if (u['uReflection']) gl.uniform2f(u['uReflection'], material.reflectionStrength, material.reflectionDistortion);
        if (u['uSheen']) gl.uniform4f(u['uSheen'], material.sheenColor[0]! * material.sheen, material.sheenColor[1]! * material.sheen, material.sheenColor[2]! * material.sheen, material.sheenRoughness);
        if (u['uExtra']) gl.uniform2f(u['uExtra'], material.lightMapIntensity, material.transmission);
        if (u['uRefraction']) gl.uniform4f(u['uRefraction'], material.ior, material.thickness, Number.isFinite(material.attenuationDistance) ? material.attenuationDistance : 0, 0);
        if (u['uAttenuation']) gl.uniform3f(u['uAttenuation'], material.attenuationColor[0]!, material.attenuationColor[1]!, material.attenuationColor[2]!);
    }
    private applyState(material: Material3D, depthOnly: boolean, mirrored: boolean): void {
        const gl = this.#gl;
        // Shadow maps draw both faces: closed and open meshes then cast alike.
        const cull = depthOnly || material.side === 'double' || material.billboard ? 'none' : material.side;
        if (cull !== this.#cull) {
            if (cull === 'none') gl.disable(gl.CULL_FACE);
            else { gl.enable(gl.CULL_FACE); gl.cullFace(cull === 'back' ? gl.FRONT : gl.BACK); }
            this.#cull = cull;
        }
        if (mirrored !== this.#frontCw) { gl.frontFace(mirrored ? gl.CW : gl.CCW); this.#frontCw = mirrored; }
        const depthTest = material.depthTest, depthWrite = depthOnly || material.depthWrite;
        if (depthTest !== this.#depthTest) { if (depthTest) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST); this.#depthTest = depthTest; }
        if (depthWrite !== this.#depthWrite) { gl.depthMask(depthWrite); this.#depthWrite = depthWrite; }
        if (depthOnly) return;
        const blend = material.alphaMode === 'blend' ? material.blending : 'off';
        if (blend !== this.#blend) {
            if (blend === 'off') gl.disable(gl.BLEND);
            else {
                gl.enable(gl.BLEND);
                if (blend === 'additive') gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);
                else if (blend === 'multiply') gl.blendFuncSeparate(gl.DST_COLOR, gl.ZERO, gl.ZERO, gl.ONE);
                else if (blend === 'premultiplied') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            }
            this.#blend = blend;
        }
        const offset = material.polygonOffset;
        if (offset !== this.#offset) {
            if (offset) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(offset[0], offset[1]); } else gl.disable(gl.POLYGON_OFFSET_FILL);
            this.#offset = offset;
        }
    }

    // ---- drawing -----------------------------------------------------------------
    private draw(item: RenderItem3D, frameFlags: number, depthOnly: boolean): void {
        const gl = this.#gl, {mesh, geometry, material} = item, resources = this.#resources;
        const gpu: GeometryGpu3D = resources.geometry(geometry);
        const instanced = mesh.isInstanced, skinned = mesh.skeleton !== undefined && geometry.getAttribute('joints') !== undefined && geometry.getAttribute('weights') !== undefined;
        let variant = depthOnly ? V.depthOnly : frameFlags;
        if (geometry.getAttribute('normal')) variant |= V.normal;
        // Baked instances already fill the vertex inputs both backends can count on; they do without tangents, vertex colors and second coordinates.
        const baked = mesh instanceof SkinnedInstancedMesh3D && mesh.skeleton === undefined;
        if (geometry.getAttribute('tangent') && !baked) variant |= V.tangent;
        if (geometry.getAttribute('uv1') && !baked) {
            variant |= V.uv1;
            // A texture's coordinate set can change without changing the material version.
            if (!depthOnly && material.occlusionMap?.channel === 1) variant |= V.occlusionSecond;
            if (!depthOnly && material.emissiveMap?.channel === 1) variant |= V.emissiveSecond;
            if (!depthOnly && material.lightMap?.channel === 1) variant |= V.lightSecond;
        }
        if (geometry.getAttribute('uv')) {
            variant |= V.uv;
            // A texture can change its source without changing the material version.
            if (!depthOnly && material.map?.source instanceof RenderTarget3D) variant |= V.mapFromTarget;
        }
        if (material.vertexColors && geometry.getAttribute('color') && !baked) variant |= V.color;
        if (skinned) variant |= V.skin;
        if (gpu.morph) variant |= V.morph | (gpu.morph.attributes === 2 ? V.morphNormals : 0);
        if (instanced) variant |= V.instancing | ((mesh as InstancedMesh3D).instanceColors ? V.instanceColor : 0);
        const crowd = !skinned && mesh instanceof SkinnedInstancedMesh3D && geometry.getAttribute('joints') !== undefined && geometry.getAttribute('weights') !== undefined ? mesh : undefined;
        if (crowd) variant |= V.skinInstancing;
        if (instanced && mesh instanceof GpuParticles3D) variant |= V.gpuParticles;
        if (!depthOnly && material.softness > 0 && this.#sceneDepthReady) variant |= V.softDepth;
        if (geometry.topology === 'points') variant |= V.points;
        if (!depthOnly && mesh.receiveShadow && this.#shadowCount > 0) variant |= V.receiveShadow;
        if (!depthOnly && material.transmission > 0 && this.#grabbed) variant |= V.transmission;
        const program = this.selectProgram(material, variant), u = program.uniforms, frame = this.#list.frame;
        if (program !== this.#program) { gl.useProgram(program.program); this.#program = program; }
        // Texture units are shared by all programs, so material state is reapplied
        // whenever either the program or the material differs from the previous draw.
        // In a shadow pass an opaque material without a vertex hook contributes nothing but its
        // program, so casters that share the program need no per-material work.
        const applied = depthOnly && material.alphaMode === 'opaque' && material.shader === undefined ? this.#plainDepth : material;
        if (program !== this.#appliedProgram || applied !== this.#appliedMaterial) {
            this.applyMaterial(program, material, depthOnly);
            this.#appliedProgram = program; this.#appliedMaterial = applied;
        }
        if (depthOnly && u['uDepthViewProjection']) gl.uniformMatrix4fv(u['uDepthViewProjection'], false, this.#lightMatrix);
        const world = mesh.matrixWorld;
        const determinant = world[0]! * (world[5]! * world[10]! - world[6]! * world[9]!) - world[4]! * (world[1]! * world[10]! - world[2]! * world[9]!)
            + world[8]! * (world[1]! * world[6]! - world[2]! * world[5]!);
        this.applyState(material, depthOnly, determinant < 0 && !skinned);
        if (skinned) {
            const bones = resources.bones(mesh.skeleton!, frame);
            gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.bones);
            gl.bindTexture(gl.TEXTURE_2D, bones);
            if (u['uBindMatrix']) gl.uniformMatrix4fv(u['uBindMatrix'], false, mesh.bindMatrix);
            if (u['uModel']) gl.uniformMatrix4fv(u['uModel'], false, IDENTITY4);
        } else {
            if (crowd) {
                // Creating the table binds another unit, so fetch it before selecting this one.
                const table = resources.animations(crowd.animations);
                gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.bones);
                gl.bindTexture(gl.TEXTURE_2D, table);
            }
            if (u['uModel']) gl.uniformMatrix4fv(u['uModel'], false, world);
            if (u['uNormalMatrix']) gl.uniformMatrix3fv(u['uNormalMatrix'], false, mat3NormalFromMat4(this.#scratch9, world) as Float32Array);
        }
        if (gpu.morph) this.applyMorph(program, mesh, gpu);
        // Baked instances take their morph weights from the table; the shader only needs to know how many targets to read.
        if (gpu.morph && crowd && u['uMorphCount']) gl.uniform1i(u['uMorphCount'], Math.min(MAX_MORPH_INFLUENCES_3D, crowd.animations.morphCount, geometry.morphTargets.length));
        const wire = material.wireframe && !depthOnly && geometry.topology === 'triangles' ? resources.wireframe(geometry) : undefined;
        gl.bindVertexArray(wire ? wire.vao : instanced ? resources.instances(mesh as InstancedMesh3D, frame) : gpu.vao);
        const topology = geometry.topology;
        const mode = wire ? gl.LINES : topology === 'triangles' ? gl.TRIANGLES : topology === 'lines' ? gl.LINES : topology === 'line-strip' ? gl.LINE_STRIP : gl.POINTS;
        const instances = instanced ? (mesh as InstancedMesh3D).count : 1;
        if (instances <= 0) return;
        if (wire) {
            // Wireframe draws the whole geometry: its edge list is not split by groups.
            if (instanced) gl.drawElementsInstanced(mode, wire.count, wire.type, 0, instances); else gl.drawElements(mode, wire.count, wire.type, 0);
        } else if (gpu.indexed) {
            const bytes = gpu.indexType === gl.UNSIGNED_INT ? 4 : gpu.indexType === gl.UNSIGNED_SHORT ? 2 : 1;
            if (instanced) gl.drawElementsInstanced(mode, item.count, gpu.indexType, item.start * bytes, instances);
            else gl.drawElements(mode, item.count, gpu.indexType, item.start * bytes);
        } else if (instanced) gl.drawArraysInstanced(mode, item.start, item.count, instances);
        else gl.drawArrays(mode, item.start, item.count);
        if (!depthOnly) {
            this.info.drawCalls++;
            if (mode === gl.TRIANGLES) this.info.triangles += item.count / 3 * instances;
        }
    }
    /** Upload the strongest morph influences; the shader blends at most a fixed number. */
    private applyMorph(program: Program3D, mesh: Mesh3D, gpu: GeometryGpu3D): void {
        const gl = this.#gl, u = program.uniforms, morph = gpu.morph!, weights = mesh.morphWeights;
        const indices = this.#morphIndices, values = this.#morphWeights;
        let count = 0;
        for (let i = 0; i < weights.length; i++) {
            const weight = weights[i]!;
            if (weight === 0) continue;
            if (count < MAX_MORPH_INFLUENCES_3D) { indices[count] = i; values[count] = weight; count++; continue; }
            // Replace the weakest selected influence when this one is stronger.
            let weakest = 0;
            for (let k = 1; k < count; k++) if (Math.abs(values[k]!) < Math.abs(values[weakest]!)) weakest = k;
            if (Math.abs(weight) > Math.abs(values[weakest]!)) { indices[weakest] = i; values[weakest] = weight; }
        }
        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.morph);
        gl.bindTexture(gl.TEXTURE_2D, morph.texture);
        if (u['uMorphLayout']) gl.uniform3i(u['uMorphLayout'], morph.vertexCount, morph.width, morph.attributes);
        if (u['uMorphCount']) gl.uniform1i(u['uMorphCount'], count);
        if (u['uMorphIndices']) gl.uniform1iv(u['uMorphIndices'], indices);
        if (u['uMorphWeights']) gl.uniform1fv(u['uMorphWeights'], values);
    }
    private drawSkybox(texture: CubeTexture3D, intensity: number, camera: Camera3D): void {
        const gl = this.#gl, program = this.#resources.program('skybox', () => SKYBOX_SHADER_3D), u = program.uniforms;
        gl.useProgram(program.program);
        this.#program = program;
        this.#appliedProgram = undefined;
        this.#resources.bindCube(TEXTURE_UNITS_3D.environment, texture);
        if (!mat4Invert(this.#scratch16, camera.viewProjectionMatrix)) return;
        if (u['uInverseViewProjection']) gl.uniformMatrix4fv(u['uInverseViewProjection'], false, this.#scratch16);
        if (u['uOutput']) gl.uniform4f(u['uOutput'], intensity, this.#linearOutput ? 1 : 0, this.exposure, this.#frameToneMapping === 'aces' ? 2 : this.#frameToneMapping === 'reinhard' ? 1 : 0);
        gl.disable(gl.CULL_FACE); this.#cull = 'none';
        gl.disable(gl.BLEND); this.#blend = 'off';
        gl.enable(gl.DEPTH_TEST); this.#depthTest = true;
        gl.depthMask(false); this.#depthWrite = false;
        gl.bindVertexArray(this.#emptyVao ??= gl.createVertexArray());
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        this.info.drawCalls++;
        // Restore the scene environment binding the skybox may have replaced.
        const environment = this.#lastEnvironment;
        if (environment && environment !== texture) this.#resources.bindCube(TEXTURE_UNITS_3D.environment, environment);
    }
    #lastEnvironment: CubeTexture3D | undefined;
    #linearOutput = false;
    #appliedProgram: Program3D | undefined;
    #appliedMaterial: Material3D | undefined;

    private assertReadbackAvailable(): void {
        if (this.#disposed) throw new World3DError('WORLD3D_DISPOSED', 'renderer');
        if (this.isContextLost) throw new World3DError('WORLD3D_CONTEXT_LOST', 'readback');
    }
    private readFramebuffer(framebuffer: WebGLFramebuffer | null, x: number, y: number, width: number, height: number): Uint8Array {
        const gl = this.#gl, out = new Uint8Array(width * height * 4);
        const previousRead = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
        try {
            gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, out);
        } finally {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previousRead);
        }
        return out;
    }
    /** Read back RGBA8 pixels of the last frame; requires preserveDrawingBuffer or a call right after render(). */
    readPixels(x = 0, y = 0, width = this.#gl.drawingBufferWidth, height = this.#gl.drawingBufferHeight): Uint8Array {
        this.assertReadbackAvailable();
        return this.readFramebuffer(null, x, y, width, height);
    }
    /** RGBA8 pixels of a render target, top row first. Resolves immediately on WebGL2. */
    async readRenderTargetPixels(target: RenderTarget3D): Promise<Uint8Array> {
        this.assertReadbackAvailable();
        const width = target.width, height = target.height;
        if (target.format === 'rgba16f') throw new World3DError('WORLD3D_INPUT_INVALID', 'half-float targets cannot be read back as bytes');
        const rows = this.readFramebuffer(this.#resources.target(target).framebuffer, 0, 0, width, height);
        const out = new Uint8Array(rows.length);
        // WebGL returns the bottom row first; flip to the shared top-first order.
        for (let y = 0; y < height; y++) out.set(rows.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
        return out;
    }
    private clearMaterialPrograms(): void {
        for (const entry of this.#materialPrograms.values()) entry.unsubscribe();
        this.#materialPrograms.clear();
    }
    /** True when textures in this compressed format can be used on this device. */
    supportsCompressedFormat(format: CompressedFormat3D): boolean {
        return this.#resources.compressedFormat(format, false) !== undefined;
    }
    /** Release every GPU object and detach from the canvas. Idempotent. */
    dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
        const gl = this.#gl;
        this.canvas.removeEventListener('webglcontextlost', this.#onLost);
        this.canvas.removeEventListener('webglcontextrestored', this.#onRestored);
        this.#list.clear();
        this.clearMaterialPrograms();
        if (this.isContextLost) {
            this.#post?.dispose(true); this.#post = undefined;
            this.#resources.reset();
            return;
        }
        this.#post?.dispose(); this.#post = undefined;
        this.#resources.dispose();
        if (this.#frameBuffer) gl.deleteBuffer(this.#frameBuffer);
        if (this.#emptyVao) gl.deleteVertexArray(this.#emptyVao);
        if (this.#shadowTexture) gl.deleteTexture(this.#shadowTexture);
        if (this.#shadowFramebuffer) gl.deleteFramebuffer(this.#shadowFramebuffer);
        if (this.#grab) { gl.deleteTexture(this.#grab.texture); gl.deleteFramebuffer(this.#grab.framebuffer); this.#grab = undefined; }
        if (this.#sceneDepth) { gl.deleteTexture(this.#sceneDepth.texture); gl.deleteFramebuffer(this.#sceneDepth.framebuffer); this.#sceneDepth = undefined; }
    }
}

export function createWebGL2Renderer3D(options: WebGL2Renderer3DOptions): WebGL2Renderer3D {
    return new WebGL2Renderer3D(options);
}
