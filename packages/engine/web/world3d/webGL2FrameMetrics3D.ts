// SPDX-License-Identifier: Apache-2.0
import {World3DError} from '../../rendering/world3d/core3D.js';

export type World3DViewKind = 'main' | 'reflection' | 'offscreen';
export type World3DPassKind = 'color' | 'shadow' | 'depth-prepass' | 'outline-mask' | 'post-process';
export type World3DGpuTiming =
    | {readonly status: 'ready'; readonly milliseconds: number}
    | {readonly status: 'disabled' | 'unsupported' | 'pending' | 'unavailable' | 'disjoint' | 'context-lost'};

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
    readonly reflections: {readonly rendered: number; readonly reused: number};
}

type TimerExtension = {
    readonly QUERY_COUNTER_BITS_EXT: number;
    readonly TIME_ELAPSED_EXT: number;
    readonly GPU_DISJOINT_EXT: number;
};
type MutablePass = {-readonly [Key in keyof World3DFramePass]: World3DFramePass[Key]};
interface PendingQuery {
    readonly query: WebGLQuery;
    readonly setResult: (timing: World3DGpuTiming) => void;
}
interface Capture {
    readonly passes: World3DFramePass[];
    readonly gpu: boolean;
    cpuSubmissionMs: number;
    viewIndex: number;
    readonly reflections: {rendered: number; reused: number};
}
interface ActivePass {
    readonly pass: MutablePass;
    readonly started: number;
    readonly timer?: PendingQuery;
}

const MAX_PENDING_QUERIES = 64;

/** Measures only opt-in WebGL2 application frames. Draw paths never wait for GPU results. */
export class WebGL2FrameMetrics3D {
    #capture: Capture | undefined;
    #pass: MutablePass | undefined;
    #extension: TimerExtension | null | undefined;
    readonly #pending: PendingQuery[] = [];

    constructor(private readonly gl: WebGL2RenderingContext) {}

    capture(draw: () => void, gpu: boolean): World3DFrameMetrics {
        if (this.#capture) throw new World3DError('WORLD3D_INPUT_INVALID', 'nested frame measurement');
        if (gpu || this.#pending.length > 0) this.poll();
        const capture: Capture = {passes: [], gpu, cpuSubmissionMs: 0, viewIndex: 0, reflections: {rendered: 0, reused: 0}};
        this.#capture = capture;
        try {
            const result: unknown = draw();
            if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
                void Promise.resolve(result).catch(() => {});
                throw new World3DError('WORLD3D_INPUT_INVALID', 'frame measurement must be synchronous');
            }
            const passes = Object.freeze(capture.passes);
            let drawCalls = 0, triangles = 0;
            for (const pass of passes) { drawCalls += pass.drawCalls; triangles += pass.triangles; }
            return Object.freeze({drawCalls, triangles, cpuSubmissionMs: capture.cpuSubmissionMs, passes, reflections: Object.freeze(capture.reflections)});
        } finally {
            this.#capture = undefined;
        }
    }

    recordReflection(kind: 'rendered' | 'reused'): void {
        if (this.#capture) this.#capture.reflections[kind]++;
    }

    beginView(): number {
        return this.#capture ? this.#capture.viewIndex++ : -1;
    }

    endView(started: number): void {
        if (this.#capture) this.#capture.cpuSubmissionMs += performance.now() - started;
    }

    begin(view: World3DViewKind, viewIndex: number, kind: World3DPassKind, width: number, height: number, shadowMapSizes?: readonly number[]): ActivePass | undefined {
        const capture = this.#capture;
        if (!capture) return undefined;
        let gpuTime: World3DGpuTiming = Object.freeze({status: 'disabled'});
        const pass: MutablePass = {
            view, viewIndex, kind, width, height, ...(shadowMapSizes ? {shadowMapSizes: Object.freeze(shadowMapSizes)} : {}),
            drawCalls: 0, triangles: 0, cpuSubmissionMs: 0,
            get gpuTime() { return gpuTime; },
        };
        const timer = capture.gpu ? this.startQuery(timing => { gpuTime = Object.freeze(timing); }) : undefined;
        this.#pass = pass;
        return {pass, started: performance.now(), ...(timer ? {timer} : {})};
    }

    end(active: ActivePass | undefined): void {
        if (!active) return;
        const {pass, timer} = active;
        pass.cpuSubmissionMs = performance.now() - active.started;
        this.#pass = undefined;
        this.#capture?.passes.push(Object.freeze(pass));
        if (!timer) return;
        if (this.gl.isContextLost()) {
            timer.setResult({status: 'context-lost'});
            return;
        }
        this.gl.endQuery(this.#extension!.TIME_ELAPSED_EXT);
        this.#pending.push(timer);
    }

    record(drawCalls: number, triangles: number): void {
        const pass = this.#pass;
        if (pass) { pass.drawCalls += drawCalls; pass.triangles += triangles; }
    }

    private startQuery(setResult: PendingQuery['setResult']): PendingQuery | undefined {
        const gl = this.gl;
        if (gl.isContextLost()) { setResult({status: 'context-lost'}); return undefined; }
        if (this.#extension === undefined) {
            const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null;
            const counterBits: unknown = extension && gl.getQuery(extension.TIME_ELAPSED_EXT, extension.QUERY_COUNTER_BITS_EXT);
            this.#extension = typeof counterBits === 'number' && counterBits > 0 ? extension : null;
        }
        const extension = this.#extension;
        if (!extension) { setResult({status: 'unsupported'}); return undefined; }
        // Interop can already own a TIME_ELAPSED query on this context.
        if (this.#pending.length >= MAX_PENDING_QUERIES || gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) {
            setResult({status: 'unavailable'});
            return undefined;
        }
        const query = gl.createQuery();
        if (!query) { setResult({status: 'unavailable'}); return undefined; }
        // Clear a stale disjoint flag before the first query of a new batch.
        if (!this.#pending.length) gl.getParameter(extension.GPU_DISJOINT_EXT);
        gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
        setResult({status: 'pending'});
        return {query, setResult};
    }

    poll(): void {
        if (!this.#pending.length) return;
        const gl = this.gl, extension = this.#extension!;
        if (gl.isContextLost()) { this.reset(true); return; }
        // Elapsed query results become available in submission order.
        let ready = 0;
        while (ready < this.#pending.length && gl.getQueryParameter(this.#pending[ready]!.query, gl.QUERY_RESULT_AVAILABLE)) ready++;
        if (gl.getParameter(extension.GPU_DISJOINT_EXT)) { this.settlePending('disjoint', true); return; }
        for (let i = 0; i < ready; i++) {
            const {query, setResult} = this.#pending[i]!;
            const elapsed: unknown = gl.getQueryParameter(query, gl.QUERY_RESULT);
            gl.deleteQuery(query);
            setResult(typeof elapsed === 'number' && Number.isFinite(elapsed) && elapsed >= 0 ? {status: 'ready', milliseconds: elapsed / 1e6} : {status: 'unavailable'});
        }
        if (ready > 0) this.#pending.splice(0, ready);
    }

    reset(lost: boolean): void {
        this.settlePending(lost ? 'context-lost' : 'unavailable', !lost);
        this.#extension = undefined;
    }

    private settlePending(status: 'disjoint' | 'context-lost' | 'unavailable', remove: boolean): void {
        for (const {query, setResult} of this.#pending) {
            if (remove) this.gl.deleteQuery(query);
            setResult({status});
        }
        this.#pending.length = 0;
    }
}
