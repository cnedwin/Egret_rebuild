const DEFAULTS = Object.freeze({
    pixelRatio: 1,
    maxBackingPixels: 16777216,
    maxCommands: 65536,
    maxClipRectangles: 262144,
    maxPreparedVertices: 1048576,
    maxClipEdgeTests: 4194304,
    maxUploadBytes: 33554432,
    maxPendingUploadBytes: 67108864,
    maxPendingFrames: 2,
    maxReadbackBytes: 67108864,
    enableReadback: false,
    maxSourceTriangles: 65536,
    maxFrameGeometryBytes: 16777216,
    maxPendingGeometryBytes: 33554432,
    maxTupleComparisons: 1048576
});
const PAGE_LIMITS = Object.freeze({
    maxFrameRegions: 4096,
    maxFramePageBytes: 67108864,
    maxReadyPageBytes: 134217728
});
const PAGE_KEYS = ['maxFrameRegions', 'maxFramePageBytes', 'maxReadyPageBytes'];
const KEYS = [
    'canvas',
    'device',
    'onDiagnostic',
    'pixelRatio',
    'maxBackingPixels',
    'maxCommands',
    'maxClipRectangles',
    'maxPreparedVertices',
    'maxClipEdgeTests',
    'maxUploadBytes',
    'maxPendingUploadBytes',
    'maxPendingFrames',
    'maxReadbackBytes',
    'enableReadback',
    'maxSourceTriangles',
    'maxFrameGeometryBytes',
    'maxPendingGeometryBytes',
    'maxTupleComparisons',
    'outputAlpha',
    'recovery',
    'enableEffects',
    ...PAGE_KEYS
];
function object(value) {
    return typeof value === 'object' && value !== null;
}
/** Snapshot every top-level read, then the selected policy reads, before any semantic refusal. */
export function admitSharedWebGPUOptions(input) {
    if (!object(input))
        throw new TypeError('options');
    const captured = {};
    for (const key of KEYS)
        captured[key] = input[key];
    const policy = captured.device;
    let kind, borrowed;
    if (object(policy)) {
        kind = policy['kind'];
        if (kind === 'borrow')
            borrowed = policy['device'];
    }
    let recovery;
    if (captured.recovery !== undefined) {
        if (!object(captured.recovery))
            throw new TypeError('recovery');
        const mode = captured.recovery['mode'], suppliedTimeout = captured.recovery['timeoutMs'];
        const timeoutMs = suppliedTimeout === undefined ? 10000 : suppliedTimeout;
        if (mode !== 'manual' && mode !== 'automatic')
            throw new TypeError('recovery mode');
        if (typeof timeoutMs !== 'number' || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30000)
            throw new RangeError('recovery timeout');
        if (mode === 'automatic' && kind === 'borrow')
            throw new TypeError('automatic borrowed recovery');
        recovery = Object.freeze({ mode, timeoutMs });
    }
    if (!object(captured.canvas))
        throw new TypeError('canvas');
    if (policy !== undefined &&
        (!object(policy) || (kind !== 'acquire' && kind !== 'borrow') || (kind === 'borrow' && !object(borrowed))))
        throw new TypeError('device policy');
    if (captured.onDiagnostic !== undefined && typeof captured.onDiagnostic !== 'function')
        throw new TypeError('diagnostic callback');
    const configuration = {};
    for (const key of Object.keys(DEFAULTS)) {
        const value = captured[key] === undefined ? DEFAULTS[key] : captured[key];
        if (key === 'enableReadback') {
            if (typeof value !== 'boolean')
                throw new TypeError(key);
        }
        else {
            if (typeof value !== 'number' ||
                !Number.isFinite(value) ||
                (key !== 'pixelRatio' && !Number.isSafeInteger(value)))
                throw new TypeError(key);
            if (value <= 0 || (key !== 'pixelRatio' && value > DEFAULTS[key]))
                throw new RangeError(key);
        }
        Object.defineProperty(configuration, key, { value, enumerable: true });
    }
    const enableEffects = captured.enableEffects ?? false;
    if (typeof enableEffects !== 'boolean')
        throw new TypeError('enableEffects');
    const outputAlpha = captured.outputAlpha === undefined ? 'premultiplied' : captured.outputAlpha;
    if (outputAlpha !== 'premultiplied' && outputAlpha !== 'opaque')
        throw new TypeError('outputAlpha');
    // Judged last, so their arrival changes no earlier refusal.
    const pages = {};
    for (const key of PAGE_KEYS) {
        const value = captured[key] === undefined ? PAGE_LIMITS[key] : captured[key];
        if (typeof value !== 'number' || !Number.isSafeInteger(value))
            throw new TypeError(key);
        if (value <= 0 || value > PAGE_LIMITS[key])
            throw new RangeError(key);
        pages[key] = value;
    }
    return {
        surface: captured.canvas,
        configuration: Object.freeze({ ...configuration, enableEffects, outputAlpha, recovery, ...pages }),
        borrowed: kind === 'borrow' ? borrowed : undefined,
        callback: captured.onDiagnostic
    };
}
//# sourceMappingURL=sharedWebGPUOptions.js.map