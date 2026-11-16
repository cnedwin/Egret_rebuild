import { World3DError } from '../../rendering/world3d/core3D.js';
import { linearToSrgb, mat3NormalFromMat4, mat4Invert } from '../../rendering/world3d/math3D.js';
import { SkinnedInstancedMesh3D } from '../../rendering/world3d/AnimationTexture3D.js';
import { GpuParticles3D } from '../../rendering/world3d/GpuParticles3D.js';
import { RenderList3D } from '../../rendering/world3d/RenderList3D.js';
import { CubeTexture3D, RenderTarget3D } from '../../rendering/world3d/Texture3D.js';
import { FRAME_BLOCK_FLOATS_3D, FRAME_OFFSETS_3D, planShadows3D, writeFrameBlock3D } from './frame3D.js';
import { createPostProcessSettings3D, outlineActive3D, postViewFromCamera3D } from './post3D.js';
import { PostChainWebGL23D } from './postWebGL23D.js';
import { WebGL2FrameMetrics3D } from './webGL2FrameMetrics3D.js';
import { GpuResources3D } from './gpuResources3D.js';
import { applyMaterialWebGL23D, buildMaterialDefinesWebGL23D, MATERIAL_VARIANT_WEBGL2_3D as V } from './materialWebGL23D.js';
import { MAX_MORPH_INFLUENCES_3D, SKYBOX_SHADER_3D, TEXTURE_UNITS_3D, buildMaterialShader3D } from './shaders3D.js';
const IDENTITY4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
export class WebGL2Renderer3D {
    canvas;
    toneMapping;
    exposure;
    shadowsEnabled;
    /** Bloom, color grading and FXAA; set `enabled` to turn the chain on. */
    postProcess = createPostProcessSettings3D();
    viewport;
    autoClear = true;
    #post;
    #frameMetrics;
    #viewKind = 'main';
    #reflectionTarget;
    #validReflections = new WeakSet();
    #viewIndex = -1;
    #frameToneMapping = 'none';
    info = {
        frame: 0,
        drawCalls: 0,
        triangles: 0,
        visited: 0,
        culled: 0,
        shadowMaps: 0,
        programs: 0,
        geometries: 0,
        textures: 0
    };
    #gl;
    #alpha;
    #options;
    #list = new RenderList3D();
    #frameData = new Float32Array(FRAME_BLOCK_FLOATS_3D);
    #materialPrograms = new Map();
    #resources;
    #frameBuffer = null;
    #emptyVao = null;
    #shadowAtlas;
    #shadowFallback;
    #sceneDepth;
    #sceneDepthReady = false;
    #shadowAtlasSize;
    #shadowCount = 0;
    #lost = false;
    #disposed = false;
    // Cached pipeline state avoids redundant driver calls.
    #program;
    #cull = '';
    #blend = '';
    #depthTest;
    #depthWrite;
    #frontCw = false;
    #offset;
    #scratch16 = new Float32Array(16);
    #scratch9 = new Float32Array(9);
    #lightMatrix = new Float32Array(16);
    #morphIndices = new Int32Array(MAX_MORPH_INFLUENCES_3D);
    #morphWeights = new Float32Array(MAX_MORPH_INFLUENCES_3D);
    #onLost;
    #onRestored;
    constructor(options) {
        const canvas = options?.canvas;
        if (!canvas || typeof canvas.getContext !== 'function')
            throw new World3DError('WORLD3D_INPUT_INVALID', 'canvas');
        this.#options = options;
        this.#alpha = options.alpha ?? false;
        const gl = canvas.getContext('webgl2', {
            alpha: this.#alpha,
            antialias: options.antialias ?? true,
            depth: true,
            stencil: false,
            premultipliedAlpha: true,
            powerPreference: options.powerPreference ?? 'high-performance',
            preserveDrawingBuffer: options.preserveDrawingBuffer ?? false
        });
        if (!gl)
            throw new World3DError('WORLD3D_CONTEXT_UNAVAILABLE', 'webgl2');
        this.canvas = canvas;
        this.#gl = gl;
        this.#frameMetrics = new WebGL2FrameMetrics3D(gl);
        this.toneMapping = options.toneMapping ?? 'aces';
        this.exposure = options.exposure ?? 1;
        this.shadowsEnabled = options.shadows ?? true;
        this.#shadowAtlasSize = Math.min(options.shadowAtlasSize ?? 2048, gl.getParameter(gl.MAX_TEXTURE_SIZE));
        this.#resources = new GpuResources3D(gl);
        this.#onLost = (event) => {
            // Without preventDefault the browser never restores the context.
            event.preventDefault();
            this.#lost = true;
            this.#frameMetrics.reset(true);
            this.#validReflections = new WeakSet();
            options.onContextLost?.();
        };
        this.#onRestored = () => {
            this.#resources.reset();
            this.#resources = new GpuResources3D(gl);
            this.#post?.dispose(true);
            this.#post = undefined;
            this.clearMaterialPrograms();
            this.#frameBuffer = this.#emptyVao = null;
            this.#shadowAtlas = this.#shadowFallback = undefined;
            this.#sceneDepth = undefined;
            this.#sceneDepthReady = false;
            this.#grab = undefined;
            this.resetState();
            this.#lost = false;
            options.onContextRestored?.();
        };
        canvas.addEventListener('webglcontextlost', this.#onLost);
        canvas.addEventListener('webglcontextrestored', this.#onRestored);
    }
    get isContextLost() {
        return this.#lost || this.#gl.isContextLost();
    }
    /** The underlying context, for advanced interop. Restore any state you change. */
    get context() {
        return this.#gl;
    }
    /** Resize the drawing buffer; `pixelRatio` multiplies the logical size. */
    setSize(width, height, pixelRatio = 1) {
        const w = Math.max(1, Math.floor(width * pixelRatio)), h = Math.max(1, Math.floor(height * pixelRatio));
        if (!Number.isFinite(w) || !Number.isFinite(h))
            throw new World3DError('WORLD3D_INPUT_INVALID', 'size');
        if (this.canvas.width !== w)
            this.canvas.width = w;
        if (this.canvas.height !== h)
            this.canvas.height = h;
    }
    /** Match the drawing buffer to the canvas's CSS size. Returns true when it changed. */
    resizeToDisplaySize(pixelRatio = 1) {
        const element = this.canvas;
        if (typeof element.clientWidth !== 'number')
            return false;
        const w = Math.max(1, Math.floor(element.clientWidth * pixelRatio)), h = Math.max(1, Math.floor(element.clientHeight * pixelRatio));
        if (element.width === w && element.height === h)
            return false;
        element.width = w;
        element.height = h;
        return true;
    }
    // ---- frame ---------------------------------------------------------------
    /**
     * Draw one frame to the canvas, or into `target` when given. Returns false
     * when the context is lost and nothing was drawn.
     */
    /**
     * Draw runs of plain meshes that share a geometry and a material as one
     * instanced draw each, in the main view and in shadow maps. On by default;
     * the meshes themselves are untouched.
     */
    get autoInstancing() {
        return this.#list.autoInstanceThreshold > 1;
    }
    set autoInstancing(value) {
        this.#list.autoInstanceThreshold = value ? 8 : 0;
    }
    /** Measure the WebGL2 renderer calls made synchronously by one application frame. */
    measureFrame(draw, options) {
        if (this.#disposed)
            throw new World3DError('WORLD3D_DISPOSED', 'renderer');
        return this.#frameMetrics.capture(draw, options?.gpuTiming === true);
    }
    /** Resolve ready GPU samples without waiting. Call from a later browser turn. */
    pollFrameTimings() {
        this.#frameMetrics.poll();
    }
    render(scene, camera, target) {
        return this.renderMeasuredView(scene, camera, target, target !== undefined && this.#reflectionTarget === target ? 'reflection' : target ? 'offscreen' : 'main');
    }
    /** Draw the view prepared by PlanarReflection3D and identify it in frame metrics. */
    renderReflection(scene, camera, target) {
        const saved = this.#reflectionTarget;
        this.#reflectionTarget = target;
        try {
            const rendered = this.render(scene, camera, target);
            if (rendered) {
                this.#validReflections.add(target);
                this.#frameMetrics.recordReflection('rendered');
            }
            return rendered;
        }
        finally {
            this.#reflectionTarget = saved;
        }
    }
    /** The retained mirror image must still belong to the live WebGL2 context. */
    reuseReflection(target) {
        if (this.#disposed || this.isContextLost || !this.#validReflections.has(target))
            return false;
        this.#frameMetrics.recordReflection('reused');
        return true;
    }
    renderMeasuredView(scene, camera, target, kind) {
        if (this.#disposed)
            throw new World3DError('WORLD3D_DISPOSED', 'renderer');
        if (this.isContextLost)
            return false;
        const viewIndex = this.#frameMetrics.beginView();
        if (viewIndex < 0)
            return this.postProcess.enabled ? this.renderPost(scene, camera, target) : this.renderView(scene, camera, target);
        const start = performance.now(), oldIndex = this.#viewIndex, oldKind = this.#viewKind;
        this.#viewIndex = viewIndex;
        this.#viewKind = kind;
        try {
            return this.postProcess.enabled ? this.renderPost(scene, camera, target) : this.renderView(scene, camera, target);
        }
        finally {
            this.#viewIndex = oldIndex;
            this.#viewKind = oldKind;
            this.#frameMetrics.endView(start);
        }
    }
    renderView(scene, camera, target, passKind = 'color') {
        if (target?.isDisposed)
            throw new World3DError('WORLD3D_DISPOSED', 'render target');
        const gl = this.#gl, list = this.#list, info = this.info;
        // Half-float targets keep scene-referred light; tone mapping happens when they are displayed.
        const toneMapping = (this.#frameToneMapping = target?.format === 'rgba16f' ? 'none' : this.toneMapping);
        list.build(scene, camera);
        info.frame = list.frame;
        info.drawCalls = info.triangles = 0;
        info.visited = list.stats.visited;
        info.culled = list.stats.culled;
        this.resetState();
        this.bindFrameBlock();
        this.renderShadows(camera);
        // Surfaces that fade near solid geometry read its depth, drawn once up front.
        this.#sceneDepthReady =
            list.transparent.some(item => item.material.softness > 0) && this.renderSceneDepth(camera, target);
        const view = this.viewport, width = target?.width ?? gl.drawingBufferWidth, height = target?.height ?? gl.drawingBufferHeight;
        const viewWidth = view ? Math.max(Math.round(view[2] * width), 1) : width;
        const viewHeight = view ? Math.max(Math.round(view[3] * height), 1) : height;
        const pass = this.#frameMetrics.begin(this.#viewKind, this.#viewIndex, passKind, width, height);
        try {
            if (target) {
                const entry = this.#resources.target(target);
                gl.bindFramebuffer(gl.FRAMEBUFFER, entry.framebuffer);
                gl.viewport(0, 0, target.width, target.height);
            }
            else {
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            }
            this.#linearOutput = target !== undefined;
            const background = scene.background;
            gl.depthMask(true);
            this.#depthWrite = true;
            // sRGB targets encode on write, so they are cleared with linear values.
            const encode = target ? (value) => value : linearToSrgb;
            if (Array.isArray(background))
                gl.clearColor(encode(background[0]), encode(background[1]), encode(background[2]), 1);
            else
                gl.clearColor(0, 0, 0, (target || this.#alpha) && !background ? 0 : 1);
            gl.clear(this.autoClear ? gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT : gl.DEPTH_BUFFER_BIT);
            if (view) {
                const x = Math.round(view[0] * width), y = Math.round(view[1] * height);
                gl.viewport(x, y, viewWidth, viewHeight);
                gl.enable(gl.SCISSOR_TEST);
                gl.scissor(x, y, viewWidth, viewHeight);
            }
            let environmentMaxMip = 0;
            this.#lastEnvironment = scene.environment;
            if (scene.environment)
                environmentMaxMip = this.#resources.bindCube(TEXTURE_UNITS_3D.environment, scene.environment);
            writeFrameBlock3D(this.#frameData, scene, camera, list, this.#shadowSlots, {
                exposure: this.exposure,
                toneMapping,
                environmentMaxMip
            });
            this.#frameData[FRAME_OFFSETS_3D.clipInfo + 2] = view ? view[2] : 1;
            this.#frameData[FRAME_OFFSETS_3D.clipInfo + 3] = view ? view[3] : 1;
            this.uploadFrameBlock();
            const flags = (scene.fog ? V.fog : 0) |
                (toneMapping !== 'none' ? V.toneMapped : 0) |
                (scene.environment ? V.environment : 0) |
                (target ? V.linearOutput : 0);
            for (const item of list.opaque)
                this.draw(item, flags);
            if (background instanceof CubeTexture3D)
                this.drawSkybox(background, scene.backgroundIntensity, camera);
            // See-through surfaces read a copy of everything drawn so far.
            this.#grabbed = false;
            for (const item of list.transparent)
                if (item.material.transmission > 0 && item.material.shading === 'standard') {
                    this.#grabbed = this.grabScene(target);
                    break;
                }
            for (const item of list.transparent)
                this.draw(item, flags);
            this.#grabbed = false;
            gl.bindVertexArray(null);
            if (view)
                gl.disable(gl.SCISSOR_TEST);
            if (target)
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        finally {
            this.#frameMetrics.end(pass);
        }
        this.#resources.prune(list.frame);
        const counts = this.#resources.counts;
        info.programs = counts.programs;
        info.geometries = counts.geometries;
        info.textures = counts.textures;
        info.shadowMaps = this.#shadowCount;
        return true;
    }
    /** Draw the scene into the half-float chain target, then post-process into the output. */
    renderPost(scene, camera, target) {
        const gl = this.#gl;
        if (target?.isDisposed)
            throw new World3DError('WORLD3D_DISPOSED', 'render target');
        const width = target ? target.width : gl.drawingBufferWidth, height = target ? target.height : gl.drawingBufferHeight;
        const post = (this.#post ??= new PostChainWebGL23D(gl, this.#resources));
        post.scene.setSize(Math.max(width, 1), Math.max(height, 1));
        if (this.isContextLost || !this.renderView(scene, camera, post.scene))
            return false;
        const output = target ? this.#resources.target(target).framebuffer : null;
        // 8-bit targets encode sRGB on write and half-float targets store linear light; only the canvas needs encoded values.
        // Outlined objects are drawn once more, flat white, into a mask the composite traces.
        let maskTexture;
        if (outlineActive3D(this.postProcess)) {
            post.mask.setSize(Math.max(width, 1), Math.max(height, 1));
            const saved = {
                layerMask: camera.layerMask,
                override: scene.overrideMaterial,
                background: scene.background,
                shadows: this.shadowsEnabled,
                planes: scene.clippingPlanes
            };
            camera.layerMask = this.postProcess.outlineLayers;
            scene.overrideMaterial = post.maskMaterial;
            scene.background = [0, 0, 0];
            this.shadowsEnabled = false;
            // Legacy scene counters exclude the helper pass, which frame metrics include.
            const counted = { ...this.info };
            try {
                if (!this.isContextLost && this.renderView(scene, camera, post.mask, 'outline-mask'))
                    maskTexture = this.#resources.target(post.mask).color;
            }
            finally {
                camera.layerMask = saved.layerMask;
                scene.overrideMaterial = saved.override;
                scene.background = saved.background;
                this.shadowsEnabled = saved.shadows;
                Object.assign(this.info, counted);
            }
        }
        const sceneEntry = this.#resources.target(post.scene);
        const postPass = this.#frameMetrics.begin(this.#viewKind, this.#viewIndex, 'postprocess', width, height);
        try {
            const draws = post.run(sceneEntry.color, sceneEntry.depthTexture, maskTexture, postViewFromCamera3D(camera), width, height, output, target !== undefined, this.postProcess, target?.format === 'rgba16f' ? 'none' : this.toneMapping, (this.#emptyVao ??= gl.createVertexArray()));
            this.info.drawCalls += draws;
            this.#frameMetrics.record(draws, draws);
        }
        finally {
            this.#frameMetrics.end(postPass);
        }
        this.resetState();
        return true;
    }
    /** Copy the output drawn so far into a texture on the scene-color unit. */
    grabScene(target) {
        const gl = this.#gl, source = target ? this.#resources.target(target).framebuffer : null;
        const width = target ? target.width : gl.drawingBufferWidth, height = target ? target.height : gl.drawingBufferHeight;
        const format = target
            ? target.format === 'rgba16f' && this.#resources.floatTargets
                ? gl.RGBA16F
                : gl.SRGB8_ALPHA8
            : this.#alpha
                ? gl.RGBA8
                : gl.RGB8;
        let grab = this.#grab;
        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.sceneColor);
        if (!grab) {
            const texture = gl.createTexture(), framebuffer = gl.createFramebuffer();
            if (!texture || !framebuffer) {
                if (texture)
                    gl.deleteTexture(texture);
                if (framebuffer)
                    gl.deleteFramebuffer(framebuffer);
                gl.activeTexture(gl.TEXTURE0);
                return false;
            }
            grab = this.#grab = { texture, framebuffer, width: 0, height: 0, format: 0 };
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        else
            gl.bindTexture(gl.TEXTURE_2D, grab.texture);
        if (grab.width !== width || grab.height !== height || grab.format !== format) {
            if (format === gl.RGBA16F)
                gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
            else if (format === gl.RGB8)
                gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
            else
                gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            grab.width = width;
            grab.height = height;
            grab.format = format;
            gl.bindFramebuffer(gl.FRAMEBUFFER, grab.framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, grab.texture, 0);
        }
        if (target) {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, grab.framebuffer);
            gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
            gl.bindFramebuffer(gl.FRAMEBUFFER, source);
        }
        else {
            // The canvas may be antialiased; a texture copy reads its resolved image.
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, width, height);
        }
        gl.activeTexture(gl.TEXTURE0);
        return true;
    }
    #grab;
    #grabbed = false;
    /** Stands for every plain opaque material while drawing depth only. */
    #plainDepth = {};
    resetState() {
        const gl = this.#gl;
        this.#appliedProgram = undefined;
        this.#appliedMaterial = undefined;
        this.#program = undefined;
        this.#cull = '';
        this.#blend = '';
        this.#depthTest = undefined;
        this.#depthWrite = undefined;
        this.#offset = undefined;
        this.#frontCw = false;
        if (this.#gl.isContextLost())
            return;
        gl.frontFace(gl.CCW);
        gl.depthFunc(gl.LEQUAL);
        gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.disable(gl.SCISSOR_TEST);
        gl.colorMask(true, true, true, true);
    }
    /** std140 blocks stay active even when unused, so the buffer must be bound before the shadow pass. */
    bindFrameBlock() {
        const gl = this.#gl;
        if (!this.#frameBuffer) {
            this.#frameBuffer = gl.createBuffer();
            gl.bindBuffer(gl.UNIFORM_BUFFER, this.#frameBuffer);
            gl.bufferData(gl.UNIFORM_BUFFER, this.#frameData.byteLength, gl.DYNAMIC_DRAW);
        }
        gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.#frameBuffer);
    }
    uploadFrameBlock() {
        const gl = this.#gl;
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.#frameBuffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.#frameData);
    }
    // ---- shadows -------------------------------------------------------------
    #shadowSlots = new Map();
    createShadowAtlas(size) {
        const gl = this.#gl;
        const texture = gl.createTexture(), framebuffer = gl.createFramebuffer();
        if (!texture || !framebuffer) {
            if (texture)
                gl.deleteTexture(texture);
            if (framebuffer)
                gl.deleteFramebuffer(framebuffer);
            throw new World3DError('WORLD3D_CONTEXT_LOST', 'shadow atlas');
        }
        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.shadow);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
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
        return { texture, framebuffer, size };
    }
    renderShadows(camera) {
        const gl = this.#gl, enabled = this.shadowsEnabled;
        // A shadow-free reflection can run before the main view. Keep its comparison sampler complete
        // without replacing the full atlas needed by the next pass.
        const atlas = enabled
            ? (this.#shadowAtlas ??= this.createShadowAtlas(this.#shadowAtlasSize))
            : (this.#shadowFallback ??= this.createShadowAtlas(1));
        this.#shadowCount = 0;
        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.shadow);
        gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
        const plans = planShadows3D(this.#frameData, this.#list, atlas.size, enabled, false, this.#shadowSlots, camera);
        if (plans.length === 0)
            return;
        const pass = this.#viewIndex < 0
            ? undefined
            : this.#frameMetrics.begin(this.#viewKind, this.#viewIndex, 'shadow', atlas.size, atlas.size, plans.map(plan => plan.tile));
        try {
            // Unbind the atlas while rendering into it to avoid a feedback loop.
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, atlas.framebuffer);
            gl.viewport(0, 0, atlas.size, atlas.size);
            gl.depthMask(true);
            this.#depthWrite = true;
            gl.clear(gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.SCISSOR_TEST);
            gl.enable(gl.POLYGON_OFFSET_FILL);
            gl.polygonOffset(1.5, 4);
            gl.colorMask(false, false, false, false);
            for (const plan of plans) {
                gl.viewport(plan.x, plan.y, plan.tile, plan.tile);
                gl.scissor(plan.x, plan.y, plan.tile, plan.tile);
                this.#lightMatrix = plan.matrix;
                for (const mesh of plan.casters)
                    this.drawDepth(mesh);
            }
            gl.colorMask(true, true, true, true);
            gl.disable(gl.SCISSOR_TEST);
            gl.disable(gl.POLYGON_OFFSET_FILL);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.shadow);
            gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
            this.#shadowCount = plans.length;
            this.#program = undefined;
            this.#appliedProgram = undefined;
        }
        finally {
            this.#frameMetrics.end(pass);
        }
    }
    /** Draw the depth of the opaque scene, as the camera sees it, into a texture of the output's size. */
    renderSceneDepth(camera, target) {
        const gl = this.#gl, width = target ? target.width : gl.drawingBufferWidth, height = target ? target.height : gl.drawingBufferHeight;
        const view = this.viewport;
        const viewWidth = view ? Math.max(Math.round(view[2] * width), 1) : width;
        const viewHeight = view ? Math.max(Math.round(view[3] * height), 1) : height;
        const pass = this.#frameMetrics.begin(this.#viewKind, this.#viewIndex, 'depth-prepass', width, height);
        try {
            let entry = this.#sceneDepth;
            if (!entry || entry.width !== width || entry.height !== height) {
                if (entry) {
                    gl.deleteTexture(entry.texture);
                    gl.deleteFramebuffer(entry.framebuffer);
                    this.#sceneDepth = undefined;
                }
                const texture = gl.createTexture(), framebuffer = gl.createFramebuffer();
                if (!texture || !framebuffer) {
                    if (texture)
                        gl.deleteTexture(texture);
                    if (framebuffer)
                        gl.deleteFramebuffer(framebuffer);
                    return false;
                }
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
                entry = this.#sceneDepth = { texture, framebuffer, width, height };
            }
            // The texture must not be bound for reading while it is drawn into.
            gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.sceneDepth);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, entry.framebuffer);
            if (view)
                gl.viewport(Math.round(view[0] * width), Math.round(view[1] * height), viewWidth, viewHeight);
            else
                gl.viewport(0, 0, width, height);
            gl.depthMask(true);
            this.#depthWrite = true;
            gl.clearDepth(1);
            gl.clear(gl.DEPTH_BUFFER_BIT);
            this.#lightMatrix = camera.viewProjectionMatrix;
            // Keep the camera view's face culling and material offset.
            for (const item of this.#list.opaque) {
                if (item.geometry.topology === 'triangles' &&
                    item.material.depthWrite &&
                    !item.material.billboard &&
                    !item.material.screenSpace)
                    this.draw(item, 0, 'scene');
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.sceneDepth);
            gl.bindTexture(gl.TEXTURE_2D, entry.texture);
            this.#program = undefined;
            this.#appliedProgram = undefined;
            return true;
        }
        finally {
            this.#frameMetrics.end(pass);
        }
    }
    depthItem = {
        mesh: undefined,
        geometry: undefined,
        material: undefined,
        start: 0,
        count: 0,
        depth: 0
    };
    drawDepth(mesh) {
        const geometry = mesh.geometry, item = this.depthItem, groups = geometry.groups;
        if (geometry.topology !== 'triangles')
            return;
        item.mesh = mesh;
        item.geometry = geometry;
        if (Array.isArray(mesh.material) && groups.length > 0) {
            for (const group of groups) {
                item.material = mesh.materialAt(group.materialIndex);
                item.start = group.start;
                item.count = group.count;
                if (item.material.visible && !item.material.isDisposed && !item.material.billboard)
                    this.draw(item, 0, 'shadow');
            }
        }
        else {
            item.material = mesh.materialAt(0);
            item.start = 0;
            item.count = geometry.drawCount;
            if (item.material.visible && !item.material.isDisposed && !item.material.billboard)
                this.draw(item, 0, 'shadow');
        }
    }
    // ---- programs --------------------------------------------------------------
    selectProgram(material, variant) {
        let cache = this.#materialPrograms.get(material.id);
        if (!cache) {
            const unsubscribe = material.onDispose(() => {
                this.#materialPrograms.delete(material.id);
            });
            cache = { version: material.version, variants: new Map(), unsubscribe };
            this.#materialPrograms.set(material.id, cache);
        }
        else if (cache.version !== material.version) {
            cache.version = material.version;
            cache.variants.clear();
        }
        let program = cache.variants.get(variant);
        if (program)
            return program;
        const depthOnly = (variant & V.depthOnly) !== 0;
        const defines = buildMaterialDefinesWebGL23D(material, variant, depthOnly);
        const custom = depthOnly ? undefined : material.shader?.glsl, customVertex = material.shader?.glslVertex;
        const customNormal = depthOnly || material.shading === 'unlit' || material.shading === 'matcap'
            ? undefined
            : material.shader?.glslNormal;
        if (custom !== undefined)
            defines.push('CUSTOM_FRAGMENT');
        if (customVertex !== undefined)
            defines.push('CUSTOM_VERTEX');
        if (customNormal !== undefined)
            defines.push('CUSTOM_NORMAL');
        program = this.#resources.program(defines.join(' ') +
            (custom === undefined && customVertex === undefined && customNormal === undefined
                ? ''
                : '|' + material.shader.key), () => buildMaterialShader3D(defines, custom, customVertex, customNormal));
        cache.variants.set(variant, program);
        return program;
    }
    applyMaterial(program, material, depthOnly) {
        applyMaterialWebGL23D(this.#gl, program.uniforms, this.#resources, this.#scratch9, material, depthOnly);
    }
    applyState(material, shadow, mirrored) {
        const gl = this.#gl;
        // Shadow maps draw both faces: closed and open meshes then cast alike.
        const cull = shadow || material.side === 'double' || material.billboard ? 'none' : material.side;
        if (cull !== this.#cull) {
            if (cull === 'none')
                gl.disable(gl.CULL_FACE);
            else {
                gl.enable(gl.CULL_FACE);
                gl.cullFace(cull === 'back' ? gl.FRONT : gl.BACK);
            }
            this.#cull = cull;
        }
        if (mirrored !== this.#frontCw) {
            gl.frontFace(mirrored ? gl.CW : gl.CCW);
            this.#frontCw = mirrored;
        }
        const depthTest = material.depthTest, depthWrite = shadow || material.depthWrite;
        if (depthTest !== this.#depthTest) {
            if (depthTest)
                gl.enable(gl.DEPTH_TEST);
            else
                gl.disable(gl.DEPTH_TEST);
            this.#depthTest = depthTest;
        }
        if (depthWrite !== this.#depthWrite) {
            gl.depthMask(depthWrite);
            this.#depthWrite = depthWrite;
        }
        if (shadow)
            return;
        const blend = material.alphaMode === 'blend' ? material.blending : 'off';
        if (blend !== this.#blend) {
            if (blend === 'off')
                gl.disable(gl.BLEND);
            else {
                gl.enable(gl.BLEND);
                if (blend === 'additive')
                    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);
                else if (blend === 'multiply')
                    gl.blendFuncSeparate(gl.DST_COLOR, gl.ZERO, gl.ZERO, gl.ONE);
                else if (blend === 'premultiplied')
                    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                else
                    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            }
            this.#blend = blend;
        }
        const offset = material.polygonOffset;
        if (offset !== this.#offset) {
            if (offset) {
                gl.enable(gl.POLYGON_OFFSET_FILL);
                gl.polygonOffset(offset[0], offset[1]);
            }
            else
                gl.disable(gl.POLYGON_OFFSET_FILL);
            this.#offset = offset;
        }
    }
    // ---- drawing -----------------------------------------------------------------
    draw(item, frameFlags, depthPass) {
        const depthOnly = depthPass !== undefined, shadow = depthPass === 'shadow';
        const gl = this.#gl, { mesh, geometry, material } = item, resources = this.#resources;
        const gpu = resources.geometry(geometry);
        const instanced = mesh.isInstanced, skinned = mesh.skeleton !== undefined &&
            geometry.getAttribute('joints') !== undefined &&
            geometry.getAttribute('weights') !== undefined;
        let variant = depthOnly ? V.depthOnly : frameFlags;
        if (geometry.getAttribute('normal'))
            variant |= V.normal;
        // Baked instances already fill the vertex inputs both backends can count on; they do without tangents, vertex colors and second coordinates.
        const baked = mesh instanceof SkinnedInstancedMesh3D && mesh.skeleton === undefined;
        if (geometry.getAttribute('tangent') && !baked)
            variant |= V.tangent;
        if (geometry.getAttribute('uv1') && !baked) {
            variant |= V.uv1;
            // A texture's coordinate set can change without changing the material version.
            if (!depthOnly && material.occlusionMap?.channel === 1)
                variant |= V.occlusionSecond;
            if (!depthOnly && material.emissiveMap?.channel === 1)
                variant |= V.emissiveSecond;
            if (!depthOnly && material.lightMap?.channel === 1)
                variant |= V.lightSecond;
        }
        if (geometry.getAttribute('uv')) {
            variant |= V.uv;
            // A texture can change its source without changing the material version.
            if (!depthOnly && material.map?.source instanceof RenderTarget3D)
                variant |= V.mapFromTarget;
        }
        if (material.vertexColors && geometry.getAttribute('color') && !baked)
            variant |= V.color;
        if (skinned)
            variant |= V.skin;
        if (gpu.morph)
            variant |= V.morph | (gpu.morph.attributes === 2 ? V.morphNormals : 0);
        if (instanced)
            variant |= V.instancing | (mesh.instanceColors ? V.instanceColor : 0);
        const crowd = !skinned &&
            mesh instanceof SkinnedInstancedMesh3D &&
            geometry.getAttribute('joints') !== undefined &&
            geometry.getAttribute('weights') !== undefined
            ? mesh
            : undefined;
        if (crowd)
            variant |= V.skinInstancing;
        if (instanced && mesh instanceof GpuParticles3D)
            variant |= V.gpuParticles;
        if (!depthOnly && material.softness > 0 && this.#sceneDepthReady)
            variant |= V.softDepth;
        if (geometry.topology === 'points')
            variant |= V.points;
        if (!depthOnly && mesh.receiveShadow && this.#shadowCount > 0)
            variant |= V.receiveShadow;
        if (!depthOnly && material.transmission > 0 && this.#grabbed)
            variant |= V.transmission;
        const program = this.selectProgram(material, variant), u = program.uniforms, frame = this.#list.frame;
        if (program !== this.#program) {
            gl.useProgram(program.program);
            this.#program = program;
        }
        // Texture units are shared by all programs, so material state is reapplied
        // whenever either the program or the material differs from the previous draw.
        // In a shadow pass an opaque material without a vertex hook contributes nothing but its
        // program, so casters that share the program need no per-material work.
        const applied = depthOnly && material.alphaMode === 'opaque' && material.shader === undefined ? this.#plainDepth : material;
        if (program !== this.#appliedProgram || applied !== this.#appliedMaterial) {
            this.applyMaterial(program, material, depthOnly);
            this.#appliedProgram = program;
            this.#appliedMaterial = applied;
        }
        if (depthOnly && u['uDepthViewProjection'])
            gl.uniformMatrix4fv(u['uDepthViewProjection'], false, this.#lightMatrix);
        const world = mesh.matrixWorld;
        const determinant = world[0] * (world[5] * world[10] - world[6] * world[9]) -
            world[4] * (world[1] * world[10] - world[2] * world[9]) +
            world[8] * (world[1] * world[6] - world[2] * world[5]);
        this.applyState(material, shadow, determinant < 0 && !skinned);
        if (skinned) {
            const bones = resources.bones(mesh.skeleton, frame);
            gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.bones);
            gl.bindTexture(gl.TEXTURE_2D, bones);
            if (u['uBindMatrix'])
                gl.uniformMatrix4fv(u['uBindMatrix'], false, mesh.bindMatrix);
            if (u['uModel'])
                gl.uniformMatrix4fv(u['uModel'], false, IDENTITY4);
        }
        else {
            if (crowd) {
                // Creating the table binds another unit, so fetch it before selecting this one.
                const table = resources.animations(crowd.animations);
                gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.bones);
                gl.bindTexture(gl.TEXTURE_2D, table);
            }
            if (u['uModel'])
                gl.uniformMatrix4fv(u['uModel'], false, world);
            if (u['uNormalMatrix'])
                gl.uniformMatrix3fv(u['uNormalMatrix'], false, mat3NormalFromMat4(this.#scratch9, world));
        }
        if (gpu.morph)
            this.applyMorph(program, mesh, gpu);
        // Baked instances take their morph weights from the table; the shader only needs to know how many targets to read.
        if (gpu.morph && crowd && u['uMorphCount'])
            gl.uniform1i(u['uMorphCount'], Math.min(MAX_MORPH_INFLUENCES_3D, crowd.animations.morphCount, geometry.morphTargets.length));
        const wire = material.wireframe && !shadow && geometry.topology === 'triangles' ? resources.wireframe(geometry) : undefined;
        gl.bindVertexArray(wire ? wire.vao : instanced ? resources.instances(mesh, frame) : gpu.vao);
        const topology = geometry.topology;
        const mode = wire
            ? gl.LINES
            : topology === 'triangles'
                ? gl.TRIANGLES
                : topology === 'lines'
                    ? gl.LINES
                    : topology === 'line-strip'
                        ? gl.LINE_STRIP
                        : gl.POINTS;
        const instances = mesh instanceof SkinnedInstancedMesh3D ? mesh.drawCount : instanced ? mesh.count : 1;
        if (instances <= 0)
            return;
        if (wire) {
            // Wireframe draws the whole geometry: its edge list is not split by groups.
            if (instanced)
                gl.drawElementsInstanced(mode, wire.count, wire.type, 0, instances);
            else
                gl.drawElements(mode, wire.count, wire.type, 0);
        }
        else if (gpu.indexed) {
            const bytes = gpu.indexType === gl.UNSIGNED_INT ? 4 : gpu.indexType === gl.UNSIGNED_SHORT ? 2 : 1;
            if (instanced)
                gl.drawElementsInstanced(mode, item.count, gpu.indexType, item.start * bytes, instances);
            else
                gl.drawElements(mode, item.count, gpu.indexType, item.start * bytes);
        }
        else if (instanced)
            gl.drawArraysInstanced(mode, item.start, item.count, instances);
        else
            gl.drawArrays(mode, item.start, item.count);
        if (this.#viewIndex >= 0)
            this.#frameMetrics.record(1, mode === gl.TRIANGLES ? Math.floor(item.count / 3) * instances : 0);
        if (!depthOnly) {
            this.info.drawCalls++;
            if (mode === gl.TRIANGLES)
                this.info.triangles += (item.count / 3) * instances;
        }
    }
    /** Upload the strongest morph influences; the shader blends at most a fixed number. */
    applyMorph(program, mesh, gpu) {
        const gl = this.#gl, u = program.uniforms, morph = gpu.morph, weights = mesh.morphWeights;
        const indices = this.#morphIndices, values = this.#morphWeights;
        let count = 0;
        for (let i = 0; i < weights.length; i++) {
            const weight = weights[i];
            if (weight === 0)
                continue;
            if (count < MAX_MORPH_INFLUENCES_3D) {
                indices[count] = i;
                values[count] = weight;
                count++;
                continue;
            }
            // Replace the weakest selected influence when this one is stronger.
            let weakest = 0;
            for (let k = 1; k < count; k++)
                if (Math.abs(values[k]) < Math.abs(values[weakest]))
                    weakest = k;
            if (Math.abs(weight) > Math.abs(values[weakest])) {
                indices[weakest] = i;
                values[weakest] = weight;
            }
        }
        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS_3D.morph);
        gl.bindTexture(gl.TEXTURE_2D, morph.texture);
        if (u['uMorphLayout'])
            gl.uniform3i(u['uMorphLayout'], morph.vertexCount, morph.width, morph.attributes);
        if (u['uMorphCount'])
            gl.uniform1i(u['uMorphCount'], count);
        if (u['uMorphIndices'])
            gl.uniform1iv(u['uMorphIndices'], indices);
        if (u['uMorphWeights'])
            gl.uniform1fv(u['uMorphWeights'], values);
    }
    drawSkybox(texture, intensity, camera) {
        const gl = this.#gl, program = this.#resources.program('skybox', () => SKYBOX_SHADER_3D), u = program.uniforms;
        gl.useProgram(program.program);
        this.#program = program;
        this.#appliedProgram = undefined;
        this.#resources.bindCube(TEXTURE_UNITS_3D.environment, texture);
        if (!mat4Invert(this.#scratch16, camera.viewProjectionMatrix))
            return;
        if (u['uInverseViewProjection'])
            gl.uniformMatrix4fv(u['uInverseViewProjection'], false, this.#scratch16);
        if (u['uOutput'])
            gl.uniform4f(u['uOutput'], intensity, this.#linearOutput ? 1 : 0, this.exposure, this.#frameToneMapping === 'aces' ? 2 : this.#frameToneMapping === 'reinhard' ? 1 : 0);
        gl.disable(gl.CULL_FACE);
        this.#cull = 'none';
        gl.disable(gl.BLEND);
        this.#blend = 'off';
        gl.enable(gl.DEPTH_TEST);
        this.#depthTest = true;
        gl.depthMask(false);
        this.#depthWrite = false;
        gl.bindVertexArray((this.#emptyVao ??= gl.createVertexArray()));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (this.#viewIndex >= 0)
            this.#frameMetrics.record(1, 1);
        this.info.drawCalls++;
        // Restore the scene environment binding the skybox may have replaced.
        const environment = this.#lastEnvironment;
        if (environment && environment !== texture)
            this.#resources.bindCube(TEXTURE_UNITS_3D.environment, environment);
    }
    #lastEnvironment;
    #linearOutput = false;
    #appliedProgram;
    #appliedMaterial;
    assertReadbackAvailable() {
        if (this.#disposed)
            throw new World3DError('WORLD3D_DISPOSED', 'renderer');
        if (this.isContextLost)
            throw new World3DError('WORLD3D_CONTEXT_LOST', 'readback');
    }
    readFramebuffer(framebuffer, x, y, width, height) {
        const gl = this.#gl, out = new Uint8Array(width * height * 4);
        const previousRead = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
        try {
            gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, out);
        }
        finally {
            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previousRead);
        }
        return out;
    }
    /** Read back RGBA8 pixels of the last frame; requires preserveDrawingBuffer or a call right after render(). */
    readPixels(x = 0, y = 0, width = this.#gl.drawingBufferWidth, height = this.#gl.drawingBufferHeight) {
        this.assertReadbackAvailable();
        return this.readFramebuffer(null, x, y, width, height);
    }
    /** RGBA8 pixels of a render target, top row first. Resolves immediately on WebGL2. */
    async readRenderTargetPixels(target) {
        this.assertReadbackAvailable();
        const width = target.width, height = target.height;
        if (target.format === 'rgba16f')
            throw new World3DError('WORLD3D_INPUT_INVALID', 'half-float targets cannot be read back as bytes');
        const rows = this.readFramebuffer(this.#resources.target(target).framebuffer, 0, 0, width, height);
        const out = new Uint8Array(rows.length);
        // WebGL returns the bottom row first; flip to the shared top-first order.
        for (let y = 0; y < height; y++)
            out.set(rows.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
        return out;
    }
    clearMaterialPrograms() {
        for (const entry of this.#materialPrograms.values())
            entry.unsubscribe();
        this.#materialPrograms.clear();
    }
    /** True when textures in this compressed format can be used on this device. */
    supportsCompressedFormat(format) {
        return this.#resources.compressedFormat(format, false) !== undefined;
    }
    /** Release every GPU object and detach from the canvas. Idempotent. */
    dispose() {
        if (this.#disposed)
            return;
        this.#disposed = true;
        this.#frameMetrics.reset(this.isContextLost);
        const gl = this.#gl;
        this.canvas.removeEventListener('webglcontextlost', this.#onLost);
        this.canvas.removeEventListener('webglcontextrestored', this.#onRestored);
        this.#list.clear();
        this.clearMaterialPrograms();
        if (this.isContextLost) {
            this.#post?.dispose(true);
            this.#post = undefined;
            this.#resources.reset();
            return;
        }
        this.#post?.dispose();
        this.#post = undefined;
        this.#resources.dispose();
        if (this.#frameBuffer)
            gl.deleteBuffer(this.#frameBuffer);
        if (this.#emptyVao)
            gl.deleteVertexArray(this.#emptyVao);
        for (const atlas of [this.#shadowAtlas, this.#shadowFallback]) {
            if (!atlas)
                continue;
            gl.deleteTexture(atlas.texture);
            gl.deleteFramebuffer(atlas.framebuffer);
        }
        this.#shadowAtlas = this.#shadowFallback = undefined;
        if (this.#grab) {
            gl.deleteTexture(this.#grab.texture);
            gl.deleteFramebuffer(this.#grab.framebuffer);
            this.#grab = undefined;
        }
        if (this.#sceneDepth) {
            gl.deleteTexture(this.#sceneDepth.texture);
            gl.deleteFramebuffer(this.#sceneDepth.framebuffer);
            this.#sceneDepth = undefined;
        }
    }
}
export function createWebGL2Renderer3D(options) {
    return new WebGL2Renderer3D(options);
}
//# sourceMappingURL=WebGL2Renderer3D.js.map