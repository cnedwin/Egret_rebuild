// SPDX-License-Identifier: Apache-2.0
// Readers for values the renderers already publish. Each reads a public
// status object when a snapshot is taken and keeps no reference to its result.
import type { PerformanceMonitor, SourceValues } from '../core/index.js';

interface SharedHostLike {
    getSharedStatus(): {
        readonly host?: { readonly state?: unknown; readonly generation?: unknown; readonly pendingFrames?: unknown; readonly pendingUploadBytes?: unknown; readonly firstFailure?: { readonly code?: unknown } | null };
        readonly pendingGeometryBytes?: unknown;
        readonly pendingColorBytes?: unknown;
        readonly retention?: { readonly idleBytes?: unknown; readonly reservedBytes?: unknown };
    };
}

interface Renderer3DLike {
    readonly info: { readonly drawCalls?: unknown; readonly triangles?: unknown; readonly culled?: unknown; readonly shadowMaps?: unknown; readonly programs?: unknown; readonly geometries?: unknown; readonly textures?: unknown };
}

function put(out: Record<string, number | string | boolean | null>, key: string, value: unknown): void {
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') out[key] = value;
}

/** Status of a shared 2D host: createSharedWebGL2Host or createSharedWebGPUHost. */
export function sharedHostSource(host: SharedHostLike): () => SourceValues {
    return () => {
        const status = host.getSharedStatus(), out: Record<string, number | string | boolean | null> = {};
        put(out, 'state', status.host?.state);
        put(out, 'generation', status.host?.generation);
        put(out, 'pendingFrames', status.host?.pendingFrames);
        put(out, 'pendingUploadBytes', status.host?.pendingUploadBytes);
        put(out, 'pendingGeometryBytes', status.pendingGeometryBytes);
        put(out, 'pendingColorBytes', status.pendingColorBytes);
        put(out, 'retainedIdleBytes', status.retention?.idleBytes);
        put(out, 'retainedReservedBytes', status.retention?.reservedBytes);
        put(out, 'firstFailure', status.host?.firstFailure?.code);
        return out;
    };
}

/** Counters of a World3D renderer, as left by its latest render call. */
export function world3DSource(renderer: Renderer3DLike): () => SourceValues {
    return () => {
        const info = renderer.info, out: Record<string, number | string | boolean | null> = {};
        for (const key of ['drawCalls', 'triangles', 'culled', 'shadowMaps', 'programs', 'geometries', 'textures'] as const) put(out, key, info[key]);
        return out;
    };
}

/** The graphics adapter behind a WebGL context, or null when the browser hides it. */
export function describeWebGLAdapter(gl: WebGLRenderingContext | WebGL2RenderingContext): string | null {
    try {
        const extension = gl.getExtension('WEBGL_debug_renderer_info');
        const value: unknown = gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
        return typeof value === 'string' && value.length > 0 ? value : null;
    } catch { return null; }
}

interface TimedSharedHostLike {
    getSharedFrameTiming(): { readonly totals: Readonly<Record<string, { readonly count: number; readonly totalMs: number; readonly maxMs: number }>>; readonly dropped: number } | null;
}

/**
 * Time inside a shared WebGL2 host, by phase: mean and longest in milliseconds.
 * The host records it only when created with measureSharedFrames: true.
 */
export function sharedWebGL2TimingSource(host: TimedSharedHostLike): () => SourceValues {
    return () => {
        const timing = host.getSharedFrameTiming(), out: Record<string, number | string | boolean | null> = {};
        if (timing === null) { out['measureSharedFrames'] = false; return out; }
        for (const [phase, total] of Object.entries(timing.totals)) {
            if (total.count > 0) out[phase] = `${(total.totalMs / total.count).toFixed(2)} / ${total.maxMs.toFixed(2)}`;
        }
        if (timing.dropped > 0) out['dropped'] = timing.dropped;
        return out;
    };
}

interface World3DFrameMetricsLike {
    readonly drawCalls: number;
    readonly triangles: number;
    readonly cpuSubmissionMs: number;
    readonly passes: readonly { readonly gpuTime: { readonly status: string; readonly milliseconds?: number } }[];
}

/**
 * Record what a World3D WebGL2 renderer measured for one frame: its CPU time
 * as the world3d section, and draw calls, triangles and passes as gauges. GPU
 * time is shown once the renderer has resolved it for every pass.
 */
export function recordWorld3DFrame(monitor: Pick<PerformanceMonitor, 'addTime' | 'setGauge'>, metrics: World3DFrameMetricsLike): void {
    monitor.addTime('world3d', metrics.cpuSubmissionMs);
    monitor.setGauge('world3d draw calls', metrics.drawCalls);
    monitor.setGauge('world3d triangles', metrics.triangles);
    monitor.setGauge('world3d passes', metrics.passes.length);
    let gpu = 0, ready = metrics.passes.length > 0;
    for (const pass of metrics.passes) {
        if (pass.gpuTime.status === 'ready' && typeof pass.gpuTime.milliseconds === 'number') gpu += pass.gpuTime.milliseconds; else ready = false;
    }
    if (ready) monitor.setGauge('world3d gpu ms', Math.round(gpu * 100) / 100);
}
