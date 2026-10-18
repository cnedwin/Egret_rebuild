// SPDX-License-Identifier: Apache-2.0
import type { SharedPreparationOptions2D } from '../rendering/prepareSharedDraws2D.js';
import type { SharedStorageLimits2D } from './sharedSubmissionStorage2D.js';
import type { WebGL2HostDiagnostic } from './webgl2Types.js';

export interface SharedWebGL2Configuration extends SharedPreparationOptions2D, SharedStorageLimits2D {
    readonly maxBackingPixels: number;
    readonly enableReadback: boolean;
    readonly outputAlpha: 'premultiplied' | 'opaque';
    readonly restoreTimeoutMs: number;
}
export interface SharedWebGL2HostOptions extends Partial<SharedWebGL2Configuration> {
    readonly canvas: HTMLCanvasElement;
    readonly onDiagnostic?: (diagnostic: WebGL2HostDiagnostic) => unknown;
}
export type SharedSceneWebGL2HostOptions = Omit<SharedWebGL2HostOptions, 'outputAlpha'> & { readonly outputAlpha: 'opaque' };

const DEFAULTS: SharedWebGL2Configuration = Object.freeze({
    pixelRatio: 1, maxBackingPixels: 16777216, maxCommands: 65536, maxClipRectangles: 262144,
    maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304, maxUploadBytes: 33554432,
    maxPendingUploadBytes: 67108864, maxPendingFrames: 2, maxReadbackBytes: 67108864,
    enableReadback: false, maxSourceTriangles: 65536, maxFrameGeometryBytes: 16777216,
    maxPendingGeometryBytes: 33554432, maxTupleComparisons: 1048576,
    outputAlpha: 'premultiplied', restoreTimeoutMs: 10000,
});
const KEYS = ['canvas', 'onDiagnostic', 'pixelRatio', 'maxBackingPixels', 'maxCommands',
    'maxClipRectangles', 'maxPreparedVertices', 'maxClipEdgeTests', 'maxUploadBytes',
    'maxPendingUploadBytes', 'maxPendingFrames', 'maxReadbackBytes', 'enableReadback',
    'maxSourceTriangles', 'maxFrameGeometryBytes', 'maxPendingGeometryBytes',
    'maxTupleComparisons', 'outputAlpha', 'restoreTimeoutMs'] as const;
function object(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/** Capture all successful reads before semantics; preserve the first thrown getter value. */
export function admitSharedWebGL2Options(input: SharedWebGL2HostOptions, scene: boolean): {
    surface: HTMLCanvasElement;
    configuration: SharedWebGL2Configuration;
    callback: ((diagnostic: WebGL2HostDiagnostic) => unknown) | undefined;
} {
    if (!object(input)) throw new TypeError('options');
    const captured = {} as Record<typeof KEYS[number], unknown>;
    for (const key of KEYS) captured[key] = input[key];
    if (!object(captured.canvas)) throw new TypeError('canvas');
    if (captured.onDiagnostic !== undefined && typeof captured.onDiagnostic !== 'function') throw new TypeError('diagnostic callback');
    const configuration = {} as SharedWebGL2Configuration;
    for (const key of Object.keys(DEFAULTS) as (keyof SharedWebGL2Configuration)[]) {
        const value = captured[key] === undefined ? DEFAULTS[key] : captured[key];
        if (key === 'enableReadback') {
            if (typeof value !== 'boolean') throw new TypeError(key);
        } else if (key === 'outputAlpha') {
            if ((value !== 'premultiplied' && value !== 'opaque') || (scene && value !== 'opaque')) throw new TypeError(key);
        } else {
            if (typeof value !== 'number' || !Number.isFinite(value) || (key !== 'pixelRatio' && !Number.isSafeInteger(value))) throw new TypeError(key);
            const maximum = key === 'restoreTimeoutMs' ? 30000 : DEFAULTS[key];
            if (value <= 0 || (key !== 'pixelRatio' && value > maximum)) throw new RangeError(key);
        }
        Object.defineProperty(configuration, key, { value, enumerable: true });
    }
    return {
        surface: captured.canvas as unknown as HTMLCanvasElement,
        configuration: Object.freeze(configuration),
        callback: captured.onDiagnostic as ((diagnostic: WebGL2HostDiagnostic) => unknown) | undefined,
    };
}
