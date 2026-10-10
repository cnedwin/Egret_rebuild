import {isMeshGeometry3D, type MeshGeometry3D} from './meshGeometry3D.js';
/** Private upload storage: only the wrapper is frozen, not its owned buffers. */
export interface PackedMeshGeometry3D {
    readonly vertices: Float32Array<ArrayBuffer>;
    readonly indices: Uint32Array<ArrayBuffer>;
    readonly vertexCount: number;
    readonly indexCount: number;
    readonly vertexBytes: number;
    readonly indexBytes: number;
}
export type MeshPacking3DErrorCode = 'MESH3D_PACK_INPUT_INVALID' | 'MESH3D_PACK_BUDGET' | 'MESH3D_PACK_F32_UNSUPPORTED' | 'MESH3D_PACK_NATIVE_FAILED';
export type MeshPacking3DErrorOrigin = 'validation' | 'budget' | 'native';
export class MeshPacking3DError extends Error {
    constructor(readonly code: MeshPacking3DErrorCode, cause?: unknown) {
        super(code, {cause});
        this.name = 'MeshPacking3DError';
    }
}
const origins = new WeakMap<object, MeshPacking3DErrorOrigin>();
function fail(code: MeshPacking3DErrorCode, origin: MeshPacking3DErrorOrigin, cause?: unknown): never {
    let error: MeshPacking3DError;
    try {
        error = new MeshPacking3DError(code, cause);
        // Authority belongs to this module's throw sites, never caller-created
        // classes, code strings or proxies around a registered error.
        origins.set(error, origin);
    } catch (nativeCause) {
        // A one-shot construction/registration fault can still be reported.
        // This recovery requires the second construction and registration to
        // work; it makes no promise for real OOM or permanently poisoned paths.
        const nativeError = new MeshPacking3DError('MESH3D_PACK_NATIVE_FAILED', nativeCause);
        origins.set(nativeError, 'native');
        throw nativeError;
    }
    throw error;
}
function native<T>(operation: () => T): T {
    try { return operation(); }
    catch (cause) { return fail('MESH3D_PACK_NATIVE_FAILED', 'native', cause); }
}
function preflight(values: readonly number[]): void {
    for (let index = 0; index < values.length; index++) {
        // Authentic geometry owns dense arrays whose entire payload was
        // validated before registration; this bounded access cannot be a hole.
        const value = values[index]!;
        const admitted = native(() => value === 0 || (Number.isFinite(value)
            && Math.abs(value) >= 1.1754943508222875e-38
            && Math.abs(value) <= 3.4028234663852886e38 && Math.fround(value) === value));
        // This deliberately narrow verification profile is not a general
        // asset importer policy: rounded values and subnormals are unsupported.
        if (!admitted) fail('MESH3D_PACK_F32_UNSUPPORTED', 'validation');
    }
}
export function packMeshGeometry3D(geometry: MeshGeometry3D): PackedMeshGeometry3D {
    // A static annotation grants no runtime authority. WeakMap identity must
    // succeed before even one geometry field is read; no lookalike is reflected.
    if (!native(() => isMeshGeometry3D(geometry))) fail('MESH3D_PACK_INPUT_INVALID', 'validation');
    const vertexCount = geometry.vertexCount;
    const indexCount = geometry.indexCount;
    const countsAdmitted = native(() => Number.isSafeInteger(vertexCount) && vertexCount >= 0 && vertexCount <= 65536
        && Number.isSafeInteger(indexCount) && indexCount >= 0 && indexCount <= 196608);
    if (!countsAdmitted) fail('MESH3D_PACK_BUDGET', 'budget');
    const logicalBytes = 8 * (6 * vertexCount + indexCount);
    const vertexBytes = 24 * vertexCount;
    const indexBytes = 4 * indexCount;
    const bytesAdmitted = native(() => Number.isSafeInteger(logicalBytes) && logicalBytes <= 4194304
        && Number.isSafeInteger(vertexBytes) && Number.isSafeInteger(indexBytes));
    // Authentic Task1 snapshots already obey these quotas. This defense is
    // intentionally unreachable for ordinary accepted values; byte accounting
    // is deterministic numeric accounting, not heap/GPU memory measurement.
    if (!bytesAdmitted) fail('MESH3D_PACK_BUDGET', 'budget');
    const positions = geometry.positions;
    const colors = geometry.colors;
    const sourceIndices = geometry.indices;
    // Every component, including unused vertices, is admitted in this order
    // before either typed buffer is allocated. The CPU snapshot stays binary64.
    preflight(positions);
    preflight(colors);
    const vertices = native(() => new Float32Array(6 * vertexCount));
    const indices = native(() => new Uint32Array(indexCount));
    native(() => {
        for (let vertex = 0; vertex < vertexCount; vertex++) {
            for (let component = 0; component < 3; component++) {
                const position = positions[3 * vertex + component]!;
                const color = colors[3 * vertex + component]!;
                vertices[6 * vertex + component] = position === 0 ? 0 : position;
                vertices[6 * vertex + 3 + component] = color === 0 ? 0 : color;
            }
        }
        for (let index = 0; index < indexCount; index++) {
            const value = sourceIndices[index]!;
            indices[index] = value === 0 ? 0 : value;
        }
    });
    // Publication is last. The arrays and backing buffers are fresh mutable
    // trusted upload data; no cache, caller destination or GPU object escapes.
    return native(() => Object.freeze({vertices, indices, vertexCount, indexCount, vertexBytes, indexBytes}));
}
export function getMeshPacking3DErrorOrigin(value: unknown): MeshPacking3DErrorOrigin | undefined {
    return value !== null && typeof value === 'object' ? origins.get(value) : undefined;
}
