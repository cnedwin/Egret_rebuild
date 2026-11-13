import type { WebGPUHostDiagnostic, WebGPUHostOptions } from './WebGPUHost.js';

/** Each may only lower the profile's own bound: 4,096 regions and 64 MiB of pages in a frame, 128 MiB of ready pages. */
export interface SharedPageLimits2D { readonly maxFrameRegions: number; readonly maxFramePageBytes: number; readonly maxReadyPageBytes: number; }
export interface SharedWebGPUHostOptions extends WebGPUHostOptions, Partial<SharedPageLimits2D> {
    readonly maxSourceTriangles?: number; readonly maxFrameGeometryBytes?: number; readonly maxPendingGeometryBytes?: number; readonly maxTupleComparisons?: number;
    readonly enableEffects?: boolean; readonly outputAlpha?: 'premultiplied' | 'opaque'; readonly recovery?: { readonly mode: 'manual' | 'automatic'; readonly timeoutMs?: number }; }
type BaseConfiguration = Required<Omit<SharedWebGPUHostOptions, 'canvas' | 'device' | 'onDiagnostic' | 'enableEffects' | 'outputAlpha' | 'recovery' | keyof SharedPageLimits2D>>;
export type SharedWebGPUConfiguration = BaseConfiguration & SharedPageLimits2D & { readonly enableEffects:boolean; readonly outputAlpha: 'premultiplied' | 'opaque'; readonly recovery: { readonly mode: 'manual' | 'automatic'; readonly timeoutMs: number } | undefined };
const DEFAULTS: BaseConfiguration = Object.freeze({
    pixelRatio: 1, maxBackingPixels: 16777216, maxCommands: 65536, maxClipRectangles: 262144,
    maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304, maxUploadBytes: 33554432,
    maxPendingUploadBytes: 67108864, maxPendingFrames: 2, maxReadbackBytes: 67108864, enableReadback: false,
    maxSourceTriangles: 65536, maxFrameGeometryBytes: 16777216, maxPendingGeometryBytes: 33554432, maxTupleComparisons: 1048576,
});
const PAGE_LIMITS: SharedPageLimits2D = Object.freeze({ maxFrameRegions: 4096, maxFramePageBytes: 67108864, maxReadyPageBytes: 134217728 });
const PAGE_KEYS = ['maxFrameRegions', 'maxFramePageBytes', 'maxReadyPageBytes'] as const;
const KEYS = ['canvas', 'device', 'onDiagnostic', 'pixelRatio', 'maxBackingPixels', 'maxCommands', 'maxClipRectangles',
    'maxPreparedVertices', 'maxClipEdgeTests', 'maxUploadBytes', 'maxPendingUploadBytes', 'maxPendingFrames',
    'maxReadbackBytes', 'enableReadback', 'maxSourceTriangles', 'maxFrameGeometryBytes', 'maxPendingGeometryBytes', 'maxTupleComparisons', 'outputAlpha', 'recovery', 'enableEffects',
    ...PAGE_KEYS] as const;
function object(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }

/** Snapshot every top-level read, then the selected policy reads, before any semantic refusal. */
export function admitSharedWebGPUOptions(input: SharedWebGPUHostOptions): {
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
    const configuration = {} as BaseConfiguration;
    for (const key of Object.keys(DEFAULTS) as (keyof BaseConfiguration)[]) {
        const value = captured[key] === undefined ? DEFAULTS[key] : captured[key];
        if (key === 'enableReadback') { if (typeof value !== 'boolean') throw new TypeError(key); }
        else {
            if (typeof value !== 'number' || !Number.isFinite(value) || (key !== 'pixelRatio' && !Number.isSafeInteger(value))) throw new TypeError(key);
            if (value <= 0 || (key !== 'pixelRatio' && value > DEFAULTS[key])) throw new RangeError(key);
        }
        Object.defineProperty(configuration, key, { value, enumerable: true });
    }
    const enableEffects=captured.enableEffects??false;if(typeof enableEffects!=='boolean')throw new TypeError('enableEffects');
    const outputAlpha = captured.outputAlpha === undefined ? 'premultiplied' : captured.outputAlpha;
    if (outputAlpha !== 'premultiplied' && outputAlpha !== 'opaque') throw new TypeError('outputAlpha');
    // Judged last, so their arrival changes no earlier refusal.
    const pages = {} as { -readonly [K in keyof SharedPageLimits2D]: number };
    for (const key of PAGE_KEYS) {
        const value = captured[key] === undefined ? PAGE_LIMITS[key] : captured[key];
        if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new TypeError(key);
        if (value <= 0 || value > PAGE_LIMITS[key]) throw new RangeError(key);
        pages[key] = value;
    }
    return { surface: captured.canvas as unknown as HTMLCanvasElement, configuration: Object.freeze({ ...configuration, enableEffects, outputAlpha, recovery, ...pages }),
        borrowed: kind === 'borrow' ? borrowed as GPUDevice : undefined,
        callback: captured.onDiagnostic as ((diagnostic: WebGPUHostDiagnostic) => unknown) | undefined };
}
