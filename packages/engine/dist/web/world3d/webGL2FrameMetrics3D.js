// SPDX-License-Identifier: Apache-2.0
import { World3DError } from '../../rendering/world3d/core3D.js';
const MAX_PENDING_QUERIES = 64;
/** Measures only opt-in WebGL2 application frames. Draw paths never wait for GPU results. */
export class WebGL2FrameMetrics3D {
    gl;
    #capture;
    #pass;
    #extension;
    #pending = [];
    constructor(gl) {
        this.gl = gl;
    }
    capture(draw, gpu) {
        if (this.#capture)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'nested frame measurement');
        if (gpu || this.#pending.length > 0)
            this.poll();
        const capture = {
            passes: [],
            gpu,
            cpuSubmissionMs: 0,
            viewIndex: 0,
            reflections: { rendered: 0, reused: 0 }
        };
        this.#capture = capture;
        try {
            const result = draw();
            if (result && typeof result.then === 'function') {
                void Promise.resolve(result).catch(() => { });
                throw new World3DError('WORLD3D_INPUT_INVALID', 'frame measurement must be synchronous');
            }
            const passes = Object.freeze(capture.passes);
            let drawCalls = 0, triangles = 0;
            for (const pass of passes) {
                drawCalls += pass.drawCalls;
                triangles += pass.triangles;
            }
            return Object.freeze({
                drawCalls,
                triangles,
                cpuSubmissionMs: capture.cpuSubmissionMs,
                passes,
                reflections: Object.freeze(capture.reflections)
            });
        }
        finally {
            this.#capture = undefined;
        }
    }
    recordReflection(kind) {
        if (this.#capture)
            this.#capture.reflections[kind]++;
    }
    beginView() {
        return this.#capture ? this.#capture.viewIndex++ : -1;
    }
    endView(started) {
        if (this.#capture)
            this.#capture.cpuSubmissionMs += performance.now() - started;
    }
    begin(view, viewIndex, kind, width, height, shadowMapSizes) {
        const capture = this.#capture;
        if (!capture)
            return undefined;
        let gpuTime = Object.freeze({ status: 'disabled' });
        const pass = {
            view,
            viewIndex,
            kind,
            width,
            height,
            ...(shadowMapSizes ? { shadowMapSizes: Object.freeze(shadowMapSizes) } : {}),
            drawCalls: 0,
            triangles: 0,
            cpuSubmissionMs: 0,
            get gpuTime() {
                return gpuTime;
            }
        };
        const timer = capture.gpu
            ? this.startQuery(timing => {
                gpuTime = Object.freeze(timing);
            })
            : undefined;
        this.#pass = pass;
        return { pass, started: performance.now(), ...(timer ? { timer } : {}) };
    }
    end(active) {
        if (!active)
            return;
        const { pass, timer } = active;
        pass.cpuSubmissionMs = performance.now() - active.started;
        this.#pass = undefined;
        this.#capture?.passes.push(Object.freeze(pass));
        if (!timer)
            return;
        if (this.gl.isContextLost()) {
            timer.setResult({ status: 'context-lost' });
            return;
        }
        this.gl.endQuery(this.#extension.TIME_ELAPSED_EXT);
        this.#pending.push(timer);
    }
    record(drawCalls, triangles) {
        const pass = this.#pass;
        if (pass) {
            pass.drawCalls += drawCalls;
            pass.triangles += triangles;
        }
    }
    startQuery(setResult) {
        const gl = this.gl;
        if (gl.isContextLost()) {
            setResult({ status: 'context-lost' });
            return undefined;
        }
        if (this.#extension === undefined) {
            const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
            const counterBits = extension && gl.getQuery(extension.TIME_ELAPSED_EXT, extension.QUERY_COUNTER_BITS_EXT);
            this.#extension = typeof counterBits === 'number' && counterBits > 0 ? extension : null;
        }
        const extension = this.#extension;
        if (!extension) {
            setResult({ status: 'unsupported' });
            return undefined;
        }
        // Interop can already own a TIME_ELAPSED query on this context.
        if (this.#pending.length >= MAX_PENDING_QUERIES || gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) {
            setResult({ status: 'unavailable' });
            return undefined;
        }
        const query = gl.createQuery();
        if (!query) {
            setResult({ status: 'unavailable' });
            return undefined;
        }
        // Clear a stale disjoint flag before the first query of a new batch.
        if (!this.#pending.length)
            gl.getParameter(extension.GPU_DISJOINT_EXT);
        gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
        setResult({ status: 'pending' });
        return { query, setResult };
    }
    poll() {
        if (!this.#pending.length)
            return;
        const gl = this.gl, extension = this.#extension;
        if (gl.isContextLost()) {
            this.reset(true);
            return;
        }
        // Elapsed query results become available in submission order.
        let ready = 0;
        while (ready < this.#pending.length && gl.getQueryParameter(this.#pending[ready].query, gl.QUERY_RESULT_AVAILABLE))
            ready++;
        if (gl.getParameter(extension.GPU_DISJOINT_EXT)) {
            this.settlePending('disjoint', true);
            return;
        }
        for (let i = 0; i < ready; i++) {
            const { query, setResult } = this.#pending[i];
            const elapsed = gl.getQueryParameter(query, gl.QUERY_RESULT);
            gl.deleteQuery(query);
            setResult(typeof elapsed === 'number' && Number.isFinite(elapsed) && elapsed >= 0
                ? { status: 'ready', milliseconds: elapsed / 1e6 }
                : { status: 'unavailable' });
        }
        if (ready > 0)
            this.#pending.splice(0, ready);
    }
    reset(lost) {
        this.settlePending(lost ? 'context-lost' : 'unavailable', !lost);
        this.#extension = undefined;
    }
    settlePending(status, remove) {
        for (const { query, setResult } of this.#pending) {
            if (remove)
                this.gl.deleteQuery(query);
            setResult({ status });
        }
        this.#pending.length = 0;
    }
}
//# sourceMappingURL=webGL2FrameMetrics3D.js.map