// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
const failures = new WeakSet();
export function glFailure(code, cause) {
    const failure = new EgretError(code, { cause });
    failures.add(failure);
    return failure;
}
export function isGLFailure(value) {
    return typeof value === 'object' && value !== null && failures.has(value);
}
const METHODS = [
    'getContextAttributes',
    'getError',
    'isContextLost',
    'getParameter',
    'getShaderPrecisionFormat',
    'getFramebufferAttachmentParameter',
    'checkFramebufferStatus',
    'bindFramebuffer',
    'bindBuffer',
    'bufferData',
    'bufferSubData',
    'getBufferSubData',
    'readPixels',
    'shaderSource',
    'attachShader',
    'getShaderParameter',
    'getProgramParameter',
    'getShaderInfoLog',
    'getProgramInfoLog',
    'getUniformBlockIndex',
    'getActiveUniformBlockParameter',
    'getUniformIndices',
    'getActiveUniforms',
    'getUniformLocation',
    'useProgram',
    'clientWaitSync',
    'activeTexture',
    'bindTexture',
    'bindRenderbuffer',
    'bindVertexArray',
    'bindSampler',
    'bindBufferRange',
    'enable',
    'disable',
    'colorMask',
    'depthMask',
    'depthFunc',
    'frontFace',
    'clearDepth',
    'clearColor',
    'clear',
    'viewport',
    'scissor',
    'depthRange',
    'blendEquationSeparate',
    'blendFuncSeparate',
    'pixelStorei',
    'texParameteri',
    'texStorage2D',
    'texSubImage2D',
    'renderbufferStorage',
    'framebufferTexture2D',
    'framebufferRenderbuffer',
    'drawBuffers',
    'readBuffer',
    'compileShader',
    'linkProgram',
    'detachShader',
    'uniformBlockBinding',
    'uniform1i',
    'uniform1f',
    'uniform2f',
    'enableVertexAttribArray',
    'disableVertexAttribArray',
    'vertexAttribPointer',
    'vertexAttribDivisor',
    'drawArrays',
    'drawElements',
    'flush'
];
const KINDS = [
    'Buffer',
    'Texture',
    'Renderbuffer',
    'Framebuffer',
    'Shader',
    'Program',
    'VertexArray',
    'Sync'
];
/** One context generation owns every returned native object before another native call. */
export class GLNativeSession {
    context;
    gate;
    diagnostics;
    timing;
    gl;
    owners = new Set();
    invalidated = false;
    cleanupFailure;
    recordOwners;
    timingSerial = null;
    calls = new Map();
    qualifiedColorTargets = new WeakSet();
    qualifiedDepthTargets = new WeakMap();
    constructor(context, gate, diagnostics, timing) {
        this.context = context;
        this.gate = gate;
        this.diagnostics = diagnostics;
        this.timing = timing;
        const captured = Object.create(null);
        // Capture only the finite methods used by this executor. Never enumerate a native context.
        for (const name of [
            ...METHODS,
            ...KINDS.flatMap(kind => [kind === 'Sync' ? 'fenceSync' : 'create' + kind, 'delete' + kind])
        ]) {
            const candidate = context[name];
            gate();
            if (typeof candidate !== 'function')
                throw new TypeError(name);
            const raw = candidate.bind(context);
            this.calls.set(name, raw);
            // Specialize once so ordinary native draws and binds never read the clock.
            const call = timing && name === 'texSubImage2D'
                ? (...args) => {
                    const start = this.recordOwners ? this.startTiming() : undefined;
                    try {
                        return raw(...args);
                    }
                    finally {
                        this.finishTiming('texture-upload', start);
                    }
                }
                : raw;
            Object.defineProperty(captured, name, {
                value: (...args) => {
                    gate();
                    const value = call(...args);
                    // Observe the real page write before the existing post-call gate can throw.
                    if (name === 'texSubImage2D' && this.diagnostics) {
                        const state = this.diagnostics, bytes = args[4] * args[5] * 4;
                        if (state.totals.pageWriteCalls === Number.MAX_SAFE_INTEGER ||
                            bytes > Number.MAX_SAFE_INTEGER - state.totals.pageWriteBytes)
                            state.saturated = true;
                        state.totals.pageWriteCalls = Math.min(Number.MAX_SAFE_INTEGER, state.totals.pageWriteCalls + 1);
                        state.totals.pageWriteBytes = Math.min(Number.MAX_SAFE_INTEGER, state.totals.pageWriteBytes + bytes);
                    }
                    gate();
                    return value;
                }
            });
        }
        // Constants are fixed WebGL2 specification tokens, independent of mutable context properties.
        const constants = {
            NO_ERROR: 0,
            OUT_OF_MEMORY: 1285,
            CONTEXT_LOST_WEBGL: 37442,
            ARRAY_BUFFER: 34962,
            ELEMENT_ARRAY_BUFFER: 34963,
            UNIFORM_BUFFER: 35345,
            PIXEL_PACK_BUFFER: 35051,
            PIXEL_UNPACK_BUFFER: 35052,
            DYNAMIC_DRAW: 35048,
            STREAM_READ: 35041,
            TEXTURE_2D: 3553,
            TEXTURE0: 33984,
            TEXTURE1: 33985,
            TEXTURE_MIN_FILTER: 10241,
            TEXTURE_MAG_FILTER: 10240,
            TEXTURE_WRAP_S: 10242,
            TEXTURE_WRAP_T: 10243,
            TEXTURE_BASE_LEVEL: 33084,
            TEXTURE_MAX_LEVEL: 33085,
            NEAREST: 9728,
            LINEAR: 9729,
            CLAMP_TO_EDGE: 33071,
            RGBA: 6408,
            RGBA8: 32856,
            SRGB8_ALPHA8: 35907,
            SRGB: 35904,
            UNSIGNED_NORMALIZED: 35863,
            UNSIGNED_BYTE: 5121,
            UNSIGNED_INT: 5125,
            FLOAT: 5126,
            FRAMEBUFFER: 36160,
            DRAW_FRAMEBUFFER: 36009,
            READ_FRAMEBUFFER: 36008,
            RENDERBUFFER: 36161,
            FRAMEBUFFER_COMPLETE: 36053,
            COLOR_ATTACHMENT0: 36064,
            DEPTH_ATTACHMENT: 36096,
            BACK: 1029,
            FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING: 33296,
            FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE: 33297,
            FRAMEBUFFER_ATTACHMENT_RED_SIZE: 33298,
            FRAMEBUFFER_ATTACHMENT_GREEN_SIZE: 33299,
            FRAMEBUFFER_ATTACHMENT_BLUE_SIZE: 33300,
            FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE: 33301,
            DEPTH_COMPONENT32F: 36012,
            COLOR_BUFFER_BIT: 16384,
            DEPTH_BUFFER_BIT: 256,
            VERTEX_SHADER: 35633,
            FRAGMENT_SHADER: 35632,
            COMPILE_STATUS: 35713,
            LINK_STATUS: 35714,
            HIGH_FLOAT: 36338,
            MAX_TEXTURE_SIZE: 3379,
            MAX_RENDERBUFFER_SIZE: 34024,
            MAX_VIEWPORT_DIMS: 3386,
            MAX_VERTEX_ATTRIBS: 34921,
            MAX_UNIFORM_BLOCK_SIZE: 35376,
            UNIFORM_BUFFER_OFFSET_ALIGNMENT: 35380,
            MAX_UNIFORM_BUFFER_BINDINGS: 35375,
            MAX_VERTEX_UNIFORM_BLOCKS: 35371,
            MAX_FRAGMENT_UNIFORM_BLOCKS: 35373,
            MAX_TEXTURE_IMAGE_UNITS: 34930,
            UNIFORM_BLOCK_DATA_SIZE: 35392,
            UNIFORM_OFFSET: 35387,
            INVALID_INDEX: 4294967295,
            PACK_ALIGNMENT: 3333,
            PACK_ROW_LENGTH: 3330,
            PACK_SKIP_ROWS: 3331,
            PACK_SKIP_PIXELS: 3332,
            UNPACK_ALIGNMENT: 3317,
            UNPACK_ROW_LENGTH: 3314,
            UNPACK_SKIP_ROWS: 3315,
            UNPACK_SKIP_PIXELS: 3316,
            UNPACK_IMAGE_HEIGHT: 32878,
            UNPACK_SKIP_IMAGES: 32877,
            UNPACK_FLIP_Y_WEBGL: 37440,
            UNPACK_PREMULTIPLY_ALPHA_WEBGL: 37441,
            UNPACK_COLORSPACE_CONVERSION_WEBGL: 37443,
            NONE: 0,
            BLEND: 3042,
            DEPTH_TEST: 2929,
            STENCIL_TEST: 2960,
            SCISSOR_TEST: 3089,
            CULL_FACE: 2884,
            DITHER: 3024,
            RASTERIZER_DISCARD: 35977,
            SAMPLE_ALPHA_TO_COVERAGE: 32926,
            SAMPLE_COVERAGE: 32928,
            POLYGON_OFFSET_FILL: 32823,
            FUNC_ADD: 32774,
            ONE: 1,
            ZERO: 0,
            ONE_MINUS_SRC_ALPHA: 771,
            ONE_MINUS_SRC_COLOR: 769,
            DST_COLOR: 774,
            GREATER: 516,
            CCW: 2305,
            TRIANGLES: 4,
            SYNC_GPU_COMMANDS_COMPLETE: 37143,
            ALREADY_SIGNALED: 37146,
            TIMEOUT_EXPIRED: 37147,
            CONDITION_SATISFIED: 37148,
            WAIT_FAILED: 37149
        };
        Object.assign(captured, constants);
        this.gl = captured;
    }
    startTiming() {
        if (!this.timing)
            return undefined;
        try {
            const value = performance.now();
            return Number.isFinite(value) ? value : undefined;
        }
        catch {
            return undefined;
        }
    }
    finishTiming(phase, start) {
        // Optional observations never alter the native result or resource ownership.
        if (start !== undefined)
            try {
                this.timing(phase, start, this.timingSerial);
            }
            catch { }
    }
    /** Observe original owner transitions; established unknown remains a once-only obligation. */
    observeResource(owner) {
        const diagnostics = this.diagnostics;
        if (!diagnostics)
            return;
        const page = owner.page === true && owner.value !== undefined && (owner.outcome === 'owned' || owner.outcome === 'unknown');
        if (page !== !!owner.diagnosticPageOwned) {
            diagnostics.pageBytes += (page ? 1 : -1) * owner.bytes;
            owner.diagnosticPageOwned = page;
            diagnostics.highPageBytes = Math.max(diagnostics.highPageBytes, diagnostics.pageBytes);
        }
        const unknown = owner.outcome === 'unknown' && owner.accounting === 'native';
        if (unknown && !owner.diagnosticUnknown) {
            const state = diagnostics.unknown, bytes = state.knownLogicalBytes + owner.bytes, objects = state.objects + 1;
            if (bytes > Number.MAX_SAFE_INTEGER || objects > Number.MAX_SAFE_INTEGER)
                state.saturated = true;
            state.knownLogicalBytes = Math.min(Number.MAX_SAFE_INTEGER, bytes);
            state.objects = Math.min(Number.MAX_SAFE_INTEGER, objects);
            state.highKnownLogicalBytes = Math.max(state.highKnownLogicalBytes, state.knownLogicalBytes);
            state.highObjects = Math.max(state.highObjects, state.objects);
            owner.diagnosticUnknown = true;
        }
    }
    create(kind, bytes = 0, parameter, page) {
        this.gate();
        const owner = {
            kind,
            bytes,
            value: undefined,
            outcome: 'owned',
            accounting: 'native',
            page: page !== undefined
        };
        // The slot exists before the native call; registration cannot lose a returned object.
        this.owners.add(owner);
        this.recordOwners?.push(owner);
        const call = this.calls.get(kind === 'Sync' ? 'fenceSync' : 'create' + kind);
        let value;
        try {
            value = kind === 'Sync' ? call(37143, 0) : kind === 'Shader' ? call(parameter) : call();
        }
        catch (cause) {
            owner.outcome = 'unknown';
            owner.cleanupCause = cause;
            this.cleanupFailure ??= { cause };
            this.observeResource(owner);
            throw cause;
        }
        if (value !== null && typeof value === 'object')
            owner.value = value;
        else {
            owner.outcome = 'deleted';
            this.owners.delete(owner);
            throw new Error('WebGL2 allocation returned null: ' + kind);
        }
        if (page) {
            page.reservedPageBytes -= bytes;
            if (this.diagnostics)
                this.diagnostics.reservedPageBytes -= bytes;
        }
        this.observeResource(owner);
        this.gate();
        return owner;
    }
    cleanup(owner) {
        if (owner.outcome !== 'owned')
            return owner.outcome !== 'unknown';
        if (!owner.value) {
            owner.outcome = 'deleted';
            this.observeResource(owner);
            this.owners.delete(owner);
            return true;
        }
        if (this.invalidated) {
            owner.outcome = 'context-invalidated';
            this.observeResource(owner);
            this.owners.delete(owner);
            return true;
        }
        // Mark before invoking externally controlled code; a thrown deletion is never retried/refunded.
        owner.outcome = 'unknown';
        try {
            this.calls.get('delete' + owner.kind)(owner.value);
            const lost = this.calls.get('isContextLost')();
            const query = this.calls.get('getError');
            let error;
            if (this.timing && owner.kind === 'Sync') {
                const start = this.startTiming();
                try {
                    error = query();
                }
                finally {
                    this.finishTiming('sync-delete-error-query', start);
                }
            }
            else
                error = query();
            if (lost === true) {
                this.invalidated = true;
                owner.outcome = 'context-invalidated';
            }
            else if (error === 0)
                owner.outcome = 'deleted';
            else
                owner.cleanupCause = error;
        }
        catch (cause) {
            owner.cleanupCause = cause;
        }
        this.observeResource(owner);
        if (owner.outcome !== 'unknown')
            this.owners.delete(owner);
        else
            this.cleanupFailure ??= { cause: owner.cleanupCause };
        return owner.outcome !== 'unknown';
    }
    lose() {
        this.invalidated = true;
        for (const owner of this.owners)
            if (owner.outcome === 'owned') {
                owner.outcome = 'context-invalidated';
                this.observeResource(owner);
                this.owners.delete(owner);
            }
    }
    cleanupAll() {
        let safe = true;
        for (const owner of this.owners)
            if (!this.cleanup(owner))
                safe = false;
        return safe;
    }
    unknown() {
        let bytes = 0, objects = 0;
        for (const owner of this.owners)
            if (owner.outcome === 'unknown' && owner.accounting === 'native') {
                bytes += owner.bytes;
                objects++;
            }
        return { bytes, objects };
    }
    check() {
        const value = this.gl.getError();
        if (value !== 0)
            throw glFailure(value === 1285 ? 'WEBGL2_OUT_OF_MEMORY' : value === 37442 ? 'WEBGL2_CONTEXT_LOST' : 'WEBGL2_VALIDATION', value);
    }
    program(vertex, fragment) {
        const gl = this.gl, v = this.create('Shader', 0, gl.VERTEX_SHADER), f = this.create('Shader', 0, gl.FRAGMENT_SHADER);
        for (const [owner, source] of [
            [v, vertex],
            [f, fragment]
        ]) {
            const shader = owner.value;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
                throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compilation');
        }
        const p = this.create('Program'), program = p.value;
        gl.attachShader(program, v.value);
        gl.attachShader(program, f.value);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            throw new Error(gl.getProgramInfoLog(program) ?? 'Program link');
        gl.detachShader(program, v.value);
        gl.detachShader(program, f.value);
        const vSafe = this.cleanup(v), fSafe = this.cleanup(f);
        if (!vSafe || !fSafe)
            throw glFailure('WEBGL2_CLOSE_UNSAFE', this.cleanupFailure?.cause);
        return program;
    }
    block(program, name, members, bytes, binding = 0) {
        const gl = this.gl, index = gl.getUniformBlockIndex(program, name);
        if (index === gl.INVALID_INDEX ||
            gl.getActiveUniformBlockParameter(program, index, gl.UNIFORM_BLOCK_DATA_SIZE) !== bytes)
            throw glFailure('WEBGL2_CONTEXT_LIMIT');
        const indices = gl.getUniformIndices(program, [...members]);
        if (!indices || indices.some(value => value === gl.INVALID_INDEX))
            throw glFailure('WEBGL2_CONTEXT_LIMIT');
        const offsets = gl.getActiveUniforms(program, indices, gl.UNIFORM_OFFSET);
        if (offsets.length !== members.length || offsets.some((value, i) => value !== i * 16))
            throw glFailure('WEBGL2_CONTEXT_LIMIT');
        gl.uniformBlockBinding(program, index, binding);
    }
    workingAttachment(color, depth) {
        // The host owns level-zero immutable color storage and allocates depth once per owner.
        // Weak keys keep the proof in this generation without retaining released targets.
        if (depth === null) {
            if (this.qualifiedColorTargets.has(color)) {
                this.check();
                return;
            }
            this.attachment(true);
            this.qualifiedColorTargets.add(color);
            return;
        }
        let qualified = this.qualifiedDepthTargets.get(color);
        if (qualified?.has(depth)) {
            this.check();
            return;
        }
        this.attachment(true);
        if (!qualified)
            this.qualifiedDepthTargets.set(color, (qualified = new WeakSet()));
        qualified.add(depth);
    }
    attachment(working) {
        const gl = this.gl, attachment = working ? gl.COLOR_ATTACHMENT0 : gl.BACK;
        const start = this.recordOwners ? this.startTiming() : undefined;
        try {
            for (const [name, expected] of [
                [gl.FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING, working ? gl.SRGB : gl.LINEAR],
                [gl.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE, gl.UNSIGNED_NORMALIZED],
                [gl.FRAMEBUFFER_ATTACHMENT_RED_SIZE, 8],
                [gl.FRAMEBUFFER_ATTACHMENT_GREEN_SIZE, 8],
                [gl.FRAMEBUFFER_ATTACHMENT_BLUE_SIZE, 8],
                [gl.FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE, 8]
            ])
                if (gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, attachment, name) !== expected)
                    throw glFailure('WEBGL2_FORMAT_UNSUPPORTED');
            if (working && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
                throw glFailure('WEBGL2_FORMAT_UNSUPPORTED');
        }
        finally {
            this.finishTiming(working ? 'working-framebuffer-validation' : 'default-framebuffer-validation', start);
        }
        this.check();
    }
    reset(width, height) {
        const gl = this.gl;
        for (const cap of [
            gl.BLEND,
            gl.DEPTH_TEST,
            gl.STENCIL_TEST,
            gl.SCISSOR_TEST,
            gl.CULL_FACE,
            gl.DITHER,
            gl.RASTERIZER_DISCARD,
            gl.SAMPLE_ALPHA_TO_COVERAGE,
            gl.SAMPLE_COVERAGE,
            gl.POLYGON_OFFSET_FILL
        ])
            gl.disable(cap);
        gl.colorMask(true, true, true, true);
        gl.depthMask(false);
        gl.depthRange(0, 1);
        gl.viewport(0, 0, width, height);
        gl.scissor(0, 0, width, height);
        gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindSampler(0, null);
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        for (const name of [
            gl.UNPACK_ROW_LENGTH,
            gl.UNPACK_SKIP_ROWS,
            gl.UNPACK_SKIP_PIXELS,
            gl.UNPACK_IMAGE_HEIGHT,
            gl.UNPACK_SKIP_IMAGES,
            gl.PACK_ROW_LENGTH,
            gl.PACK_SKIP_ROWS,
            gl.PACK_SKIP_PIXELS
        ])
            gl.pixelStorei(name, 0);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    }
    texture(owner, width, height, working) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, owner.value);
        gl.texStorage2D(gl.TEXTURE_2D, 1, working ? gl.SRGB8_ALPHA8 : gl.RGBA8, width, height);
        for (const [name, value] of [
            [gl.TEXTURE_MIN_FILTER, gl.NEAREST],
            [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
            [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
            [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
            [gl.TEXTURE_BASE_LEVEL, 0],
            [gl.TEXTURE_MAX_LEVEL, 0]
        ])
            gl.texParameteri(gl.TEXTURE_2D, name, value);
    }
}
//# sourceMappingURL=webgl2Native.js.map