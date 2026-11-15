export type World3DViewKind = 'main' | 'reflection' | 'offscreen';
export type World3DPassKind = 'color' | 'shadow' | 'depth-prepass' | 'outline-mask' | 'postprocess';
export type World3DGpuTiming = {
    readonly status: 'ready';
    readonly milliseconds: number;
} | {
    readonly status: 'disabled' | 'unsupported' | 'pending' | 'unavailable' | 'disjoint' | 'context-lost';
};
export interface World3DFramePass {
    readonly view: World3DViewKind;
    /** Zero-based render() call within this application frame. */
    readonly viewIndex: number;
    readonly kind: World3DPassKind;
    readonly width: number;
    readonly height: number;
    /** Shadow map edge lengths, including each cascade and point-light face. */
    readonly shadowMapSizes?: readonly number[];
    readonly drawCalls: number;
    readonly triangles: number;
    readonly cpuSubmissionMs: number;
    /** Re-read after pollFrameTimings() to observe an asynchronously resolved sample. */
    readonly gpuTime: World3DGpuTiming;
}
export interface World3DFrameMetrics {
    readonly drawCalls: number;
    readonly triangles: number;
    /** Time in renderer calls, including render list preparation and WebGL submission. */
    readonly cpuSubmissionMs: number;
    readonly passes: readonly World3DFramePass[];
    /** Successful planar reflection draws and scheduled reuse of an existing reflection. */
    readonly reflections: {
        readonly rendered: number;
        readonly reused: number;
    };
}
type MutablePass = {
    -readonly [Key in keyof World3DFramePass]: World3DFramePass[Key];
};
interface PendingQuery {
    readonly query: WebGLQuery;
    readonly setResult: (timing: World3DGpuTiming) => void;
}
interface ActivePass {
    readonly pass: MutablePass;
    readonly started: number;
    readonly timer?: PendingQuery;
}
/** Measures only opt-in WebGL2 application frames. Draw paths never wait for GPU results. */
export declare class WebGL2FrameMetrics3D {
    #private;
    private readonly gl;
    constructor(gl: WebGL2RenderingContext);
    capture(draw: () => void, gpu: boolean): World3DFrameMetrics;
    recordReflection(kind: 'rendered' | 'reused'): void;
    beginView(): number;
    endView(started: number): void;
    begin(view: World3DViewKind, viewIndex: number, kind: World3DPassKind, width: number, height: number, shadowMapSizes?: readonly number[]): ActivePass | undefined;
    end(active: ActivePass | undefined): void;
    record(drawCalls: number, triangles: number): void;
    private startQuery;
    poll(): void;
    reset(lost: boolean): void;
    private settlePending;
}
export {};
//# sourceMappingURL=webGL2FrameMetrics3D.d.ts.map