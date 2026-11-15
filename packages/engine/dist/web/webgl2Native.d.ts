import { EgretError } from '@egret/runtime';
import type { SharedWebGL2TimingPhase, WebGL2HostErrorCode } from './webgl2Types.js';
import type { NativeUnknownDiagnostics } from './sharedRetentionLedger.js';
export interface GLNativeResourceDiagnostics {
    pageBytes: number;
    highPageBytes: number;
    reservedPageBytes: number;
    highReservedPageBytes: number;
    unknown: NativeUnknownDiagnostics;
    totals: {
        pageWriteCalls: number;
        pageWriteBytes: number;
    };
    saturated: boolean;
}
export type GLNativeKind = 'Buffer' | 'Texture' | 'Renderbuffer' | 'Framebuffer' | 'Shader' | 'Program' | 'VertexArray' | 'Sync';
export interface GLNativeOwner {
    readonly kind: GLNativeKind;
    readonly bytes: number;
    value: object | undefined;
    outcome: 'owned' | 'deleted' | 'context-invalidated' | 'unknown';
    cleanupCause?: unknown;
    accounting: 'native' | 'retention';
    readonly page?: boolean;
    diagnosticPageOwned?: boolean;
    diagnosticUnknown?: boolean;
}
export declare function glFailure(code: WebGL2HostErrorCode, cause?: unknown): EgretError;
export declare function isGLFailure(value: unknown): value is EgretError;
/** One context generation owns every returned native object before another native call. */
export declare class GLNativeSession {
    readonly context: WebGL2RenderingContext;
    private readonly gate;
    private readonly diagnostics?;
    private readonly timing?;
    readonly gl: WebGL2RenderingContext;
    readonly owners: Set<GLNativeOwner>;
    invalidated: boolean;
    cleanupFailure: {
        readonly cause: unknown;
    } | undefined;
    recordOwners: GLNativeOwner[] | undefined;
    timingSerial: number | null;
    private readonly calls;
    private readonly qualifiedColorTargets;
    private readonly qualifiedDepthTargets;
    constructor(context: WebGL2RenderingContext, gate: () => void, diagnostics?: GLNativeResourceDiagnostics | undefined, timing?: ((phase: SharedWebGL2TimingPhase, started: number, serial: number | null) => void) | undefined);
    startTiming(): number | undefined;
    finishTiming(phase: SharedWebGL2TimingPhase, start: number | undefined): void;
    /** Observe original owner transitions; established unknown remains a once-only obligation. */
    observeResource(owner: GLNativeOwner): void;
    create(kind: GLNativeKind, bytes?: number, parameter?: number, page?: {
        reservedPageBytes: number;
    }): GLNativeOwner;
    cleanup(owner: GLNativeOwner): boolean;
    lose(): void;
    cleanupAll(): boolean;
    unknown(): {
        bytes: number;
        objects: number;
    };
    check(): void;
    program(vertex: string, fragment: string): WebGLProgram;
    block(program: WebGLProgram, name: string, members: readonly string[], bytes: number, binding?: number): void;
    workingAttachment(color: WebGLTexture, depth: WebGLRenderbuffer | null): void;
    attachment(working: boolean): void;
    reset(width: number, height: number): void;
    texture(owner: GLNativeOwner, width: number, height: number, working: boolean): void;
}
//# sourceMappingURL=webgl2Native.d.ts.map