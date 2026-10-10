/** Private owned binary64 geometry; float32 admission is a separate policy. */
export interface MeshGeometry3D {
    readonly positions: readonly number[];
    readonly colors: readonly number[];
    readonly indices: readonly number[];
    readonly vertexCount: number;
    readonly indexCount: number;
    readonly logicalBytes: number;
}
export type MeshGeometry3DErrorCode = 'MESH3D_INPUT_INVALID' | 'MESH3D_INPUT_READ_FAILED' | 'MESH3D_BUDGET' | 'MESH3D_NATIVE_FAILED';
export type MeshGeometry3DErrorOrigin = 'validation' | 'budget' | 'source' | 'native';
export class MeshGeometry3DError extends Error {
    constructor(readonly code: MeshGeometry3DErrorCode, cause?: unknown) {
        super(code, {cause});
        this.name = 'MeshGeometry3DError';
    }
}
const geometries = new WeakMap<object, true>();
const origins = new WeakMap<object, MeshGeometry3DErrorOrigin>();
const missing = Symbol('missing own slot');

function fail(code: MeshGeometry3DErrorCode, origin: MeshGeometry3DErrorOrigin, cause?: unknown): never {
    const error = new MeshGeometry3DError(code, cause);
    // Only factory throw sites grant authority. Caller-constructed errors,
    // lookalikes and proxies do not acquire this private identity registration.
    origins.set(error, origin);
    throw error;
}
function source<T>(operation: () => T): T {
    // Catch only the external operation; never inspect a caught class/code to
    // decide whether a hostile getter was actually trusted validation.
    try { return operation(); }
    catch (cause) { return fail('MESH3D_INPUT_READ_FAILED', 'source', cause); }
}
function native<T>(operation: () => T): T {
    // Owned allocation, copy, freeze and publication faults retain exact causes.
    // Recovery requires the error construction/registration path to still work;
    // there is no universal poisoned-intrinsic or real-OOM recovery promise.
    try { return operation(); }
    catch (cause) { return fail('MESH3D_NATIVE_FAILED', 'native', cause); }
}
function own(record: object, key: string): unknown {
    if (!source(() => Object.hasOwn(record, key))) return missing;
    return source(() => (record as Record<string, unknown>)[key]);
}
function lengthValid(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function capture(array: unknown[], length: number): unknown[] {
    const values = native(() => new Array<unknown>(length));
    // Read each own slot once and record holes, without prototype or iteration.
    // All three captures finish before semantic validation, so a later source
    // fault wins over an earlier hole or invalid number in an admitted payload.
    for (let index = 0; index < length; index++) {
        const value = own(array, String(index));
        native(() => { values[index] = value; });
    }
    return values;
}
function validate(values: unknown[], kind: 'position' | 'color' | 'index', vertexCount: number): number[] {
    for (let index = 0; index < values.length; index++) {
        const value = values[index];
        if (typeof value !== 'number' || !Number.isFinite(value)
            || (kind === 'color' && (value < 0 || value > 1))
            || (kind === 'index' && (!Number.isSafeInteger(value) || value < 0 || value >= vertexCount))) {
            fail('MESH3D_INPUT_INVALID', 'validation');
        }
        // Normalize numeric -0 in every payload, including unreferenced vertices.
        native(() => { values[index] = value === 0 ? 0 : value; });
    }
    return values as number[];
}
export function createMeshGeometry3D(input: unknown): MeshGeometry3D {
    if (input === null || typeof input !== 'object') fail('MESH3D_INPUT_INVALID', 'validation');
    const positions = own(input, 'positions');
    const colors = own(input, 'colors');
    const indices = own(input, 'indices');
    // Capture every brand and every admitted own length before rejecting any
    // shape. Never read a non-Array's length; later source faults retain priority.
    const positionsArray = source(() => Array.isArray(positions));
    const positionsLength = positionsArray ? own(positions as object, 'length') : missing;
    const colorsArray = source(() => Array.isArray(colors));
    const colorsLength = colorsArray ? own(colors as object, 'length') : missing;
    const indicesArray = source(() => Array.isArray(indices));
    const indicesLength = indicesArray ? own(indices as object, 'length') : missing;
    if (!positionsArray || !colorsArray || !indicesArray
        || !lengthValid(positionsLength) || !lengthValid(colorsLength) || !lengthValid(indicesLength)
        || positionsLength !== colorsLength || positionsLength % 3 !== 0 || indicesLength % 3 !== 0) {
        fail('MESH3D_INPUT_INVALID', 'validation');
    }
    const vertexCount = positionsLength === 0 ? 0 : positionsLength / 3;
    const indexCount = indicesLength === 0 ? 0 : indicesLength;
    if (!((vertexCount === 0 && indexCount === 0) || (vertexCount >= 3 && indexCount >= 3))) {
        fail('MESH3D_INPUT_INVALID', 'validation');
    }
    if (vertexCount > 65536 || indexCount > 196608) fail('MESH3D_BUDGET', 'budget');
    // Fixed counts first bound the safe integer arithmetic. This deterministic
    // logical numeric accounting is not a measurement of JS heap or GPU memory.
    const logicalBytes = 8 * (6 * vertexCount + indexCount);
    if (!Number.isSafeInteger(logicalBytes) || logicalBytes > 4194304) fail('MESH3D_BUDGET', 'budget');
    // No payload allocation or indexed read occurs before complete quota admission.
    const capturedPositions = capture(positions as unknown[], positionsLength);
    const capturedColors = capture(colors as unknown[], colorsLength);
    const capturedIndices = capture(indices as unknown[], indicesLength);
    const ownedPositions = validate(capturedPositions, 'position', vertexCount);
    const ownedColors = validate(capturedColors, 'color', vertexCount);
    const ownedIndices = validate(capturedIndices, 'index', vertexCount);
    native(() => Object.freeze(ownedPositions));
    native(() => Object.freeze(ownedColors));
    native(() => Object.freeze(ownedIndices));
    const value: MeshGeometry3D = native(() => Object.freeze({
        positions: ownedPositions, colors: ownedColors, indices: ownedIndices,
        vertexCount, indexCount, logicalBytes,
    }));
    // Registration is last: failed publication never exposes an authentic
    // partial result, and successful snapshots retain no caller storage.
    native(() => geometries.set(value, true));
    return value;
}
export function isMeshGeometry3D(value: unknown): value is MeshGeometry3D {
    return value !== null && typeof value === 'object' && geometries.has(value);
}
export function getMeshGeometry3DErrorOrigin(value: unknown): MeshGeometry3DErrorOrigin | undefined {
    return value !== null && typeof value === 'object' ? origins.get(value) : undefined;
}
