// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { WebGL2HostErrorCode } from './webgl2Types.js';

export type GLNativeKind = 'Buffer' | 'Texture' | 'Renderbuffer' | 'Framebuffer' | 'Shader' | 'Program' | 'VertexArray' | 'Sync';
export interface GLNativeOwner {
    readonly kind: GLNativeKind;
    readonly bytes: number;
    value: object | undefined;
    outcome: 'owned' | 'deleted' | 'context-invalidated' | 'unknown';
    cleanupCause?: unknown;
    accounting: 'native'|'retention';
}
const failures = new WeakSet<object>();
export function glFailure(code: WebGL2HostErrorCode, cause?: unknown): EgretError {
    const failure = new EgretError(code, { cause }); failures.add(failure); return failure;
}
export function isGLFailure(value: unknown): value is EgretError {
    return typeof value === 'object' && value !== null && failures.has(value);
}
const METHODS = [
    'getContextAttributes','getError','isContextLost','getParameter','getShaderPrecisionFormat',
    'getFramebufferAttachmentParameter','checkFramebufferStatus','bindFramebuffer','bindBuffer',
    'bufferData','bufferSubData','getBufferSubData','readPixels','shaderSource','attachShader',
    'getShaderParameter','getProgramParameter','getShaderInfoLog','getProgramInfoLog',
    'getUniformBlockIndex','getActiveUniformBlockParameter','getUniformIndices','getActiveUniforms',
    'getUniformLocation','useProgram','clientWaitSync','activeTexture','bindTexture','bindRenderbuffer',
    'bindVertexArray','bindSampler','bindBufferRange','enable','disable','colorMask','depthMask','depthFunc',
    'clearDepth','clearColor','clear','viewport','scissor','depthRange','blendEquationSeparate','blendFuncSeparate',
    'pixelStorei','texParameteri','texStorage2D','texSubImage2D','renderbufferStorage','framebufferTexture2D',
    'framebufferRenderbuffer','drawBuffers','readBuffer','compileShader','linkProgram','detachShader',
    'uniformBlockBinding','uniform1i','uniform1f','uniform2f','enableVertexAttribArray',
    'disableVertexAttribArray','vertexAttribPointer','vertexAttribDivisor','drawArrays','drawElements','flush',
] as const;
const KINDS: readonly GLNativeKind[] = ['Buffer','Texture','Renderbuffer','Framebuffer','Shader','Program','VertexArray','Sync'];

/** One context generation owns every returned native object before another native call. */
export class GLNativeSession {
    public readonly gl: WebGL2RenderingContext;
    public readonly owners = new Set<GLNativeOwner>();
    public invalidated = false;
    public cleanupFailure: {readonly cause:unknown}|undefined;
    public recordOwners: GLNativeOwner[]|undefined;
    private readonly calls = new Map<string, (...args: unknown[]) => unknown>();
    public constructor(public readonly context: WebGL2RenderingContext, private readonly gate: () => void) {
        const captured = Object.create(null) as WebGL2RenderingContext;
        // Capture only the finite methods used by this executor. Never enumerate a native context.
        for (const name of [...METHODS, ...KINDS.flatMap(kind => [kind === 'Sync' ? 'fenceSync' : 'create'+kind, 'delete'+kind])]) {
            const candidate = (context as unknown as Record<string, unknown>)[name]; gate();
            if (typeof candidate !== 'function') throw new TypeError(name);
            const call = candidate.bind(context) as (...args: unknown[]) => unknown;
            this.calls.set(name, call);
            Object.defineProperty(captured, name, { value: (...args: unknown[]): unknown => {
                gate(); const value = call(...args); gate(); return value;
            } });
        }
        // Constants are fixed WebGL2 specification tokens, independent of mutable context properties.
        const constants = {
            NO_ERROR:0, OUT_OF_MEMORY:1285, CONTEXT_LOST_WEBGL:37442,
            ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,UNIFORM_BUFFER:35345,PIXEL_PACK_BUFFER:35051,PIXEL_UNPACK_BUFFER:35052,
            DYNAMIC_DRAW:35048,STREAM_READ:35041,TEXTURE_2D:3553,TEXTURE0:33984,TEXTURE_MIN_FILTER:10241,TEXTURE_MAG_FILTER:10240,
            TEXTURE_WRAP_S:10242,TEXTURE_WRAP_T:10243,TEXTURE_BASE_LEVEL:33084,TEXTURE_MAX_LEVEL:33085,
            NEAREST:9728,LINEAR:9729,CLAMP_TO_EDGE:33071,RGBA:6408,RGBA8:32856,SRGB8_ALPHA8:35907,SRGB:35904,
            UNSIGNED_NORMALIZED:35863,UNSIGNED_BYTE:5121,UNSIGNED_INT:5125,FLOAT:5126,
            FRAMEBUFFER:36160,DRAW_FRAMEBUFFER:36009,READ_FRAMEBUFFER:36008,RENDERBUFFER:36161,FRAMEBUFFER_COMPLETE:36053,
            COLOR_ATTACHMENT0:36064,DEPTH_ATTACHMENT:36096,BACK:1029,FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING:33296,
            FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE:33297,FRAMEBUFFER_ATTACHMENT_RED_SIZE:33298,FRAMEBUFFER_ATTACHMENT_GREEN_SIZE:33299,
            FRAMEBUFFER_ATTACHMENT_BLUE_SIZE:33300,FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE:33301,DEPTH_COMPONENT32F:36012,
            COLOR_BUFFER_BIT:16384,DEPTH_BUFFER_BIT:256,VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,HIGH_FLOAT:36338,
            MAX_TEXTURE_SIZE:3379,MAX_RENDERBUFFER_SIZE:34024,MAX_VIEWPORT_DIMS:3386,MAX_VERTEX_ATTRIBS:34921,
            MAX_UNIFORM_BLOCK_SIZE:35376,UNIFORM_BUFFER_OFFSET_ALIGNMENT:35380,MAX_UNIFORM_BUFFER_BINDINGS:35375,
            MAX_VERTEX_UNIFORM_BLOCKS:35371,MAX_FRAGMENT_UNIFORM_BLOCKS:35373,MAX_TEXTURE_IMAGE_UNITS:34930,
            UNIFORM_BLOCK_DATA_SIZE:35392,UNIFORM_OFFSET:35387,INVALID_INDEX:4294967295,
            PACK_ALIGNMENT:3333,PACK_ROW_LENGTH:3330,PACK_SKIP_ROWS:3331,PACK_SKIP_PIXELS:3332,
            UNPACK_ALIGNMENT:3317,UNPACK_ROW_LENGTH:3314,UNPACK_SKIP_ROWS:3315,UNPACK_SKIP_PIXELS:3316,
            UNPACK_IMAGE_HEIGHT:32878,UNPACK_SKIP_IMAGES:32877,UNPACK_FLIP_Y_WEBGL:37440,
            UNPACK_PREMULTIPLY_ALPHA_WEBGL:37441,UNPACK_COLORSPACE_CONVERSION_WEBGL:37443,NONE:0,
            BLEND:3042,DEPTH_TEST:2929,STENCIL_TEST:2960,SCISSOR_TEST:3089,CULL_FACE:2884,DITHER:3024,
            RASTERIZER_DISCARD:35977,SAMPLE_ALPHA_TO_COVERAGE:32926,SAMPLE_COVERAGE:32928,POLYGON_OFFSET_FILL:32823,
            FUNC_ADD:32774,ONE:1,ZERO:0,ONE_MINUS_SRC_ALPHA:771,ONE_MINUS_SRC_COLOR:769,DST_COLOR:774,
            GREATER:516,TRIANGLES:4,SYNC_GPU_COMMANDS_COMPLETE:37143,ALREADY_SIGNALED:37146,TIMEOUT_EXPIRED:37147,
            CONDITION_SATISFIED:37148,WAIT_FAILED:37149,
        };
        Object.assign(captured, constants); this.gl = captured;
    }
    public create(kind: GLNativeKind, bytes = 0, parameter?: number): GLNativeOwner {
        this.gate();
        const owner: GLNativeOwner = {kind, bytes, value:undefined, outcome:'owned',accounting:'native'};
        // The slot exists before the native call; registration cannot lose a returned object.
        this.owners.add(owner);
        this.recordOwners?.push(owner);
        const call = this.calls.get(kind === 'Sync' ? 'fenceSync' : 'create'+kind)!;
        let value:unknown;
        try{value = kind === 'Sync' ? call(37143,0) : kind === 'Shader' ? call(parameter) : call();}
        catch(cause){owner.outcome='unknown';owner.cleanupCause=cause;this.cleanupFailure??={cause};throw cause;}
        if (value !== null && typeof value === 'object') owner.value = value;
        else { owner.outcome = 'deleted'; this.owners.delete(owner); throw new Error('WebGL2 allocation returned null: '+kind); }
        this.gate(); return owner;
    }
    public cleanup(owner: GLNativeOwner): boolean {
        if (owner.outcome !== 'owned') return owner.outcome !== 'unknown';
        if (!owner.value) { owner.outcome = 'deleted'; this.owners.delete(owner); return true; }
        if (this.invalidated) { owner.outcome = 'context-invalidated'; this.owners.delete(owner); return true; }
        // Mark before invoking externally controlled code; a thrown deletion is never retried/refunded.
        owner.outcome = 'unknown';
        try {
            this.calls.get('delete'+owner.kind)!(owner.value);
            const lost = this.calls.get('isContextLost')!();
            const error = this.calls.get('getError')!();
            if (lost === true) { this.invalidated = true; owner.outcome = 'context-invalidated'; }
            else if (error === 0) owner.outcome = 'deleted';
            else owner.cleanupCause = error;
        } catch (cause) { owner.cleanupCause = cause; }
        if (owner.outcome !== 'unknown') this.owners.delete(owner);
        else this.cleanupFailure??={cause:owner.cleanupCause};
        return owner.outcome !== 'unknown';
    }
    public lose(): void {
        this.invalidated = true;
        for (const owner of this.owners) if (owner.outcome === 'owned') { owner.outcome = 'context-invalidated'; this.owners.delete(owner); }
    }
    public cleanupAll(): boolean {
        let safe = true;
        for (const owner of this.owners) if (!this.cleanup(owner)) safe = false;
        return safe;
    }
    public unknown(): {bytes:number;objects:number} {
        let bytes = 0, objects = 0;
        for (const owner of this.owners) if (owner.outcome === 'unknown'&&owner.accounting==='native') { bytes += owner.bytes; objects++; }
        return {bytes,objects};
    }
    public check(): void {
        const value = this.gl.getError();
        if (value !== 0) throw glFailure(value === 1285 ? 'WEBGL2_OUT_OF_MEMORY' : value === 37442 ? 'WEBGL2_CONTEXT_LOST' : 'WEBGL2_VALIDATION', value);
    }
    public program(vertex: string, fragment: string): WebGLProgram {
        const gl = this.gl, v = this.create('Shader',0,gl.VERTEX_SHADER), f = this.create('Shader',0,gl.FRAGMENT_SHADER);
        for (const [owner, source] of [[v,vertex],[f,fragment]] as const) {
            const shader = owner.value as WebGLShader;
            gl.shaderSource(shader,source); gl.compileShader(shader);
            if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compilation');
        }
        const p = this.create('Program'), program = p.value as WebGLProgram;
        gl.attachShader(program,v.value as WebGLShader); gl.attachShader(program,f.value as WebGLShader); gl.linkProgram(program);
        if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Program link');
        gl.detachShader(program,v.value as WebGLShader); gl.detachShader(program,f.value as WebGLShader);
        const vSafe=this.cleanup(v),fSafe=this.cleanup(f);
        if (!vSafe || !fSafe) throw glFailure('WEBGL2_CLOSE_UNSAFE',this.cleanupFailure?.cause);
        return program;
    }
    public block(program: WebGLProgram, name: string, members: readonly string[], bytes: number): void {
        const gl = this.gl, index = gl.getUniformBlockIndex(program,name);
        if (index === gl.INVALID_INDEX || gl.getActiveUniformBlockParameter(program,index,gl.UNIFORM_BLOCK_DATA_SIZE) !== bytes) throw glFailure('WEBGL2_CONTEXT_LIMIT');
        const indices = gl.getUniformIndices(program,[...members]);
        if (!indices || indices.some(value=>value===gl.INVALID_INDEX)) throw glFailure('WEBGL2_CONTEXT_LIMIT');
        const offsets = gl.getActiveUniforms(program,indices,gl.UNIFORM_OFFSET) as number[];
        if (offsets.length !== members.length || offsets.some((value,i)=>value!==i*16)) throw glFailure('WEBGL2_CONTEXT_LIMIT');
        gl.uniformBlockBinding(program,index,0);
    }
    public attachment(working: boolean): void {
        const gl = this.gl, attachment = working ? gl.COLOR_ATTACHMENT0 : gl.BACK;
        for (const [name,expected] of [
            [gl.FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING,working?gl.SRGB:gl.LINEAR],
            [gl.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE,gl.UNSIGNED_NORMALIZED],
            [gl.FRAMEBUFFER_ATTACHMENT_RED_SIZE,8],[gl.FRAMEBUFFER_ATTACHMENT_GREEN_SIZE,8],
            [gl.FRAMEBUFFER_ATTACHMENT_BLUE_SIZE,8],[gl.FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE,8],
        ]) if (gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER,attachment!,name!) !== expected) throw glFailure('WEBGL2_FORMAT_UNSUPPORTED');
        if (working && gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) throw glFailure('WEBGL2_FORMAT_UNSUPPORTED');
        this.check();
    }
    public reset(width: number, height: number): void {
        const gl = this.gl;
        for (const cap of [gl.BLEND,gl.DEPTH_TEST,gl.STENCIL_TEST,gl.SCISSOR_TEST,gl.CULL_FACE,gl.DITHER,gl.RASTERIZER_DISCARD,gl.SAMPLE_ALPHA_TO_COVERAGE,gl.SAMPLE_COVERAGE,gl.POLYGON_OFFSET_FILL]) gl.disable(cap);
        gl.colorMask(true,true,true,true); gl.depthMask(false); gl.depthRange(0,1); gl.viewport(0,0,width,height); gl.scissor(0,0,width,height);
        gl.blendEquationSeparate(gl.FUNC_ADD,gl.FUNC_ADD); gl.activeTexture(gl.TEXTURE0); gl.bindSampler(0,null);
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER,null); gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
        for (const name of [gl.UNPACK_ROW_LENGTH,gl.UNPACK_SKIP_ROWS,gl.UNPACK_SKIP_PIXELS,gl.UNPACK_IMAGE_HEIGHT,gl.UNPACK_SKIP_IMAGES,gl.PACK_ROW_LENGTH,gl.PACK_SKIP_ROWS,gl.PACK_SKIP_PIXELS]) gl.pixelStorei(name,0);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT,1); gl.pixelStorei(gl.PACK_ALIGNMENT,1);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
    }
    public texture(owner: GLNativeOwner, width: number, height: number, working: boolean): void {
        const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D,owner.value as WebGLTexture);
        gl.texStorage2D(gl.TEXTURE_2D,1,working?gl.SRGB8_ALPHA8:gl.RGBA8,width,height);
        for (const [name,value] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE],[gl.TEXTURE_BASE_LEVEL,0],[gl.TEXTURE_MAX_LEVEL,0]]) gl.texParameteri(gl.TEXTURE_2D,name!,value!);
    }
}
