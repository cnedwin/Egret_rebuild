import type { WebGPUHostDiagnostic } from './WebGPUHost.js';

import type { TexturedWebGPUHostOptions, TexturedWebGPUConfiguration } from './texturedWebGPUOptions.js';
export interface SharedWebGPUHostOptions extends TexturedWebGPUHostOptions { readonly outputAlpha?: 'premultiplied' | 'opaque'; readonly recovery?: { readonly mode: 'manual' | 'automatic'; readonly timeoutMs?: number }; }
export type SharedSceneWebGPUHostOptions = Omit<SharedWebGPUHostOptions, 'outputAlpha'> & { readonly outputAlpha: 'opaque' };
export type SharedWebGPUConfiguration = TexturedWebGPUConfiguration & { readonly outputAlpha: 'premultiplied' | 'opaque'; readonly recovery: { readonly mode: 'manual' | 'automatic'; readonly timeoutMs: number } | undefined };
const DEFAULTS: TexturedWebGPUConfiguration = Object.freeze({
    pixelRatio: 1, maxBackingPixels: 16777216, maxCommands: 65536, maxClipRectangles: 262144,
    maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304, maxUploadBytes: 33554432,
    maxPendingUploadBytes: 67108864, maxPendingFrames: 2, maxReadbackBytes: 67108864, enableReadback: false,
    maxSourceTriangles: 65536, maxFrameGeometryBytes: 16777216, maxPendingGeometryBytes: 33554432, maxTupleComparisons: 1048576,
});
const KEYS = ['canvas', 'device', 'onDiagnostic', 'pixelRatio', 'maxBackingPixels', 'maxCommands', 'maxClipRectangles',
    'maxPreparedVertices', 'maxClipEdgeTests', 'maxUploadBytes', 'maxPendingUploadBytes', 'maxPendingFrames',
    'maxReadbackBytes', 'enableReadback', 'maxSourceTriangles', 'maxFrameGeometryBytes', 'maxPendingGeometryBytes', 'maxTupleComparisons', 'outputAlpha', 'recovery'] as const;
function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }

/** Snapshot every top-level read, then the selected policy reads, before any semantic refusal. */
export function admitSharedWebGPUOptions(input: SharedWebGPUHostOptions, scene: boolean): {
    surface: HTMLCanvasElement; configuration: SharedWebGPUConfiguration; borrowed: GPUDevice | undefined;
    callback: ((diagnostic: WebGPUHostDiagnostic) => unknown) | undefined;
} {
    if (!object(input)) throw new TypeError('options');
    const captured = {} as Record<typeof KEYS[number], unknown>;
    for (const key of KEYS) captured[key] = input[key];
    const policy = captured.device;
    let kind: unknown, borrowed: unknown;
    if (object(policy)) { kind = policy['kind']; if (kind === 'borrow') borrowed = policy['device']; }
    let recovery: SharedWebGPUConfiguration['recovery'];
    if (captured.recovery !== undefined) {
        if (!object(captured.recovery)) throw new TypeError('recovery');
        const mode = captured.recovery['mode'], suppliedTimeout = captured.recovery['timeoutMs'];
        const timeoutMs = suppliedTimeout === undefined ? 10000 : suppliedTimeout;
        if (mode !== 'manual' && mode !== 'automatic') throw new TypeError('recovery mode');
        if (typeof timeoutMs !== 'number' || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30000) throw new RangeError('recovery timeout');
        if (mode === 'automatic' && kind === 'borrow') throw new TypeError('automatic borrowed recovery');
        recovery = Object.freeze({ mode, timeoutMs });
    }
    if (!object(captured.canvas)) throw new TypeError('canvas');
    if (policy !== undefined && (!object(policy) || (kind !== 'acquire' && kind !== 'borrow') || (kind === 'borrow' && !object(borrowed)))) throw new TypeError('device policy');
    if (captured.onDiagnostic !== undefined && typeof captured.onDiagnostic !== 'function') throw new TypeError('diagnostic callback');
    const configuration = {} as TexturedWebGPUConfiguration;
    for (const key of Object.keys(DEFAULTS) as (keyof TexturedWebGPUConfiguration)[]) {
        const value = captured[key] === undefined ? DEFAULTS[key] : captured[key];
        if (key === 'enableReadback') { if (typeof value !== 'boolean') throw new TypeError(key); }
        else {
            if (typeof value !== 'number' || !Number.isFinite(value) || (key !== 'pixelRatio' && !Number.isSafeInteger(value))) throw new TypeError(key);
            if (value <= 0 || (key !== 'pixelRatio' && value > DEFAULTS[key])) throw new RangeError(key);
        }
        Object.defineProperty(configuration, key, { value, enumerable: true });
    }
    const outputAlpha = captured.outputAlpha === undefined && !scene ? 'premultiplied' : captured.outputAlpha;
    if ((outputAlpha !== 'premultiplied' && outputAlpha !== 'opaque') || (scene && outputAlpha !== 'opaque')) throw new TypeError('outputAlpha');
    return { surface: captured.canvas as unknown as HTMLCanvasElement, configuration: Object.freeze({ ...configuration, outputAlpha, recovery }),
        borrowed: kind === 'borrow' ? borrowed as GPUDevice : undefined,
        callback: captured.onDiagnostic as ((diagnostic: WebGPUHostDiagnostic) => unknown) | undefined };
}
