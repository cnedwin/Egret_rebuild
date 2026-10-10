import {createMatrix4, multiplyMatrix4, Math3DError} from './matrix4.js';
import type {Matrix4} from './matrix4.js';
import {createPerspectiveProjection3D, createOrthographicProjection3D} from './projection3D.js';
import {isMeshGeometry3D} from './meshGeometry3D.js';
import type {MeshGeometry3D} from './meshGeometry3D.js';

export interface SceneProjectionInput3D {
    readonly kind: 'perspective' | 'orthographic';
    readonly left: number; readonly right: number;
    readonly bottom: number; readonly top: number;
    readonly near: number; readonly far: number;
}
export interface SceneDrawInput3D {
    readonly geometry: MeshGeometry3D;
    readonly modelView: Matrix4;
}
export interface SceneInput3D {
    readonly projection: SceneProjectionInput3D;
    readonly draws: readonly SceneDrawInput3D[];
}
export interface SceneDraw3D {
    readonly geometry: MeshGeometry3D;
    readonly mvp: Matrix4;
}
export interface SceneFrame3D {
    readonly draws: readonly SceneDraw3D[];
    readonly geometries: readonly MeshGeometry3D[];
    readonly cpuLogicalBytes: number;
    readonly sceneBytes: number;
    readonly uniformBytes: number;
}
export type Scene3DErrorOrigin = 'validation' | 'budget' | 'source' | 'native';
export type Scene3DErrorCode = 'SCENE3D_INPUT_INVALID' | 'SCENE3D_INPUT_READ_FAILED'
    | 'SCENE3D_BUDGET' | 'SCENE3D_PRECISION_UNSUPPORTED'
    | 'SCENE3D_ARITHMETIC_RANGE' | 'SCENE3D_NATIVE_FAILED';
export class Scene3DError extends Error {
    constructor(readonly code: Scene3DErrorCode, cause?: unknown) {
        super(code, {cause});
        this.name = 'Scene3DError';
    }
}
const scenes = new WeakMap<object, true>();
const origins = new WeakMap<object, Scene3DErrorOrigin>();
const missing = Symbol('missing own scene field');
const projectionFields = ['kind', 'left', 'right', 'bottom', 'top', 'near', 'far'] as const;

function fail(code: Scene3DErrorCode, origin: Scene3DErrorOrigin, cause?: unknown): never {
    let error: Scene3DError;
    try {
        error = new Scene3DError(code, cause);
        origins.set(error, origin);
    } catch (nativeCause) {
        // One-shot construction/registration recovery requires this second
        // path to work. Real OOM and permanent intrinsic poisoning are unproved.
        const nativeError = new Scene3DError('SCENE3D_NATIVE_FAILED', nativeCause);
        origins.set(nativeError, 'native');
        throw nativeError;
    }
    throw error;
}
function source<T>(operation: () => T): T {
    try { return operation(); }
    catch (cause) { return fail('SCENE3D_INPUT_READ_FAILED', 'source', cause); }
}
function native<T>(operation: () => T): T {
    try { return operation(); }
    catch (cause) { return fail('SCENE3D_NATIVE_FAILED', 'native', cause); }
}
function own(record: object, key: string): unknown {
    if (!source(() => Object.hasOwn(record, key))) return missing;
    return source(() => (record as Record<string, unknown>)[key]);
}
function record(value: unknown): value is object {
    return value !== null && typeof value === 'object' && !source(() => Array.isArray(value));
}
function write<T>(values: T[], index: number, value: T): void {
    native(() => { values[index] = value; });
}
function trustedMath<T>(operation: () => T): T {
    // Only these actual B0 invocation boundaries map its closed throw paths.
    // Math3DError has no private authenticity predicate: caller classes/codes
    // outside this boundary never confer origin. Keep both wrapper and cause.
    try { return operation(); }
    catch (cause) {
        if (cause instanceof Math3DError) {
            switch (cause.code) {
                case 'MATH3D_INPUT_INVALID':
                case 'MATH3D_GEOMETRY_INVALID': return fail('SCENE3D_INPUT_INVALID', 'validation', cause);
                case 'MATH3D_INPUT_READ_FAILED': return fail('SCENE3D_INPUT_READ_FAILED', 'source', cause);
                case 'MATH3D_ARITHMETIC_RANGE': return fail('SCENE3D_ARITHMETIC_RANGE', 'validation', cause);
                case 'MATH3D_NATIVE_FAILED': return fail('SCENE3D_NATIVE_FAILED', 'native', cause);
            }
        }
        return fail('SCENE3D_NATIVE_FAILED', 'native', cause);
    }
}
function profile(values: readonly number[]): void {
    for (let index = 0; index < values.length; index++) {
        const value = values[index]!;
        const admitted = native(() => value === 0 || (Number.isFinite(value)
            && Math.abs(value) >= 1.1754943508222875e-38
            && Math.abs(value) <= 3.4028234663852886e38 && Math.fround(value) === value));
        if (!admitted) fail('SCENE3D_PRECISION_UNSUPPORTED', 'validation');
    }
}
function finite(value: number): number {
    if (!native(() => Number.isFinite(value))) fail('SCENE3D_ARITHMETIC_RANGE', 'validation');
    return value;
}
function headroom(positions: readonly number[], mvp: Matrix4): void {
    // Fixed binary64 absolute products k0..3, then ((p0+p1)+p2)+p3.
    // This restrictive headroom policy is not an outward-rounded bound, shader
    // precision/visibility result or a reason to divide/discard raw clip w.
    for (let vertex = 0; vertex < positions.length / 3; vertex++) {
        const x = positions[3 * vertex]!, y = positions[3 * vertex + 1]!, z = positions[3 * vertex + 2]!;
        for (let row = 0; row < 4; row++) {
            const p0 = finite(native(() => Math.abs(mvp[row]! * x)));
            const p1 = finite(native(() => Math.abs(mvp[4 + row]! * y)));
            const p2 = finite(native(() => Math.abs(mvp[8 + row]! * z)));
            const p3 = finite(native(() => Math.abs(mvp[12 + row]!)));
            const s01 = finite(p0 + p1), s012 = finite(s01 + p2), sum = finite(s012 + p3);
            if (sum > 1.329227995784916e36) fail('SCENE3D_ARITHMETIC_RANGE', 'validation');
        }
    }
}
export function createSceneFrame3D(input: unknown): SceneFrame3D {
    if (input === null || typeof input !== 'object') fail('SCENE3D_INPUT_INVALID', 'validation');
    const projection = own(input, 'projection'), draws = own(input, 'draws');
    if (projection === missing || draws === missing) fail('SCENE3D_INPUT_INVALID', 'validation');
    if (!source(() => Array.isArray(draws))) fail('SCENE3D_INPUT_INVALID', 'validation');
    const count = own(draws as object, 'length');
    if (typeof count !== 'number' || !native(() => Number.isSafeInteger(count)) || count < 0) {
        fail('SCENE3D_INPUT_INVALID', 'validation');
    }
    // Fixed length/quota admission precedes any payload scratch or indexed read.
    if (count > 64) fail('SCENE3D_BUDGET', 'budget');
    if (!record(projection)) fail('SCENE3D_INPUT_INVALID', 'validation');
    const parameters = native(() => new Array<unknown>(7));
    const records = native(() => new Array<unknown>(count));
    let absent = false;
    for (let index = 0; index < 7; index++) {
        const value = own(projection, projectionFields[index]!);
        if (value === missing) absent = true;
        write(parameters, index, value);
    }
    for (let index = 0; index < count; index++) {
        const value = own(draws as object, String(index));
        if (value === missing) absent = true;
        write(records, index, value);
    }
    if (absent) fail('SCENE3D_INPUT_INVALID', 'validation');
    const geometries = native(() => new Array<unknown>(count));
    const modelInputs = native(() => new Array<unknown>(count));
    for (let index = 0; index < count; index++) {
        const draw = records[index];
        // Shape refusal intentionally prevents subsequent payload access;
        // admitted fields finish before deferred missing/value semantics.
        if (!record(draw)) fail('SCENE3D_INPUT_INVALID', 'validation');
        const geometry = own(draw, 'geometry'), modelView = own(draw, 'modelView');
        if (geometry === missing || modelView === missing) absent = true;
        write(geometries, index, geometry);
        write(modelInputs, index, modelView);
    }
    if (absent) fail('SCENE3D_INPUT_INVALID', 'validation');
    for (let index = 0; index < count; index++) {
        if (!native(() => isMeshGeometry3D(geometries[index]))) fail('SCENE3D_INPUT_INVALID', 'validation');
    }
    const models = native(() => new Array<Matrix4>(count));
    for (let index = 0; index < count; index++) {
        // Each B0 capture completes semantics before the next call. Only its
        // immutable result reaches multiplication; no cross-call fault theorem.
        write(models, index, trustedMath(() => createMatrix4(modelInputs[index])));
    }
    const kind = parameters[0];
    if (kind !== 'perspective' && kind !== 'orthographic') fail('SCENE3D_INPUT_INVALID', 'validation');
    const projectionInput = native(() => ({left: parameters[1], right: parameters[2],
        bottom: parameters[3], top: parameters[4], near: parameters[5], far: parameters[6],
        depthRange: 'zeroToOne', depthDirection: 'reverse'}));
    const matrix = trustedMath(() => (kind === 'perspective'
        ? createPerspectiveProjection3D(projectionInput) : createOrthographicProjection3D(projectionInput))).matrix;
    const ownedDraws = native(() => new Array<SceneDraw3D>(count));
    const distinct = native(() => new Array<MeshGeometry3D>());
    let cpuLogicalBytes = 0, sceneBytes = 0;
    const uniformBytes = count * 64;
    if (uniformBytes > 4096) fail('SCENE3D_BUDGET', 'budget');
    for (let index = 0; index < count; index++) {
        const geometry = geometries[index] as MeshGeometry3D;
        const mvp = trustedMath(() => multiplyMatrix4(matrix, models[index]));
        let seen = false;
        for (let item = 0; item < distinct.length; item++) if (distinct[item] === geometry) seen = true;
        if (!seen) {
            const logical = 8 * (6 * geometry.vertexCount + geometry.indexCount);
            const packed = 24 * geometry.vertexCount + 4 * geometry.indexCount;
            cpuLogicalBytes += logical; sceneBytes += packed;
            const admitted = native(() => Number.isSafeInteger(logical) && Number.isSafeInteger(packed)
                && Number.isSafeInteger(cpuLogicalBytes) && Number.isSafeInteger(sceneBytes));
            if (!admitted || cpuLogicalBytes > 8388608 || sceneBytes > 4194304 || distinct.length >= 64) {
                fail('SCENE3D_BUDGET', 'budget');
            }
            // Identity charges precede this identity's payload profile. Counts
            // are logical numeric accounting, not JS heap/physical GPU memory.
            write(distinct, distinct.length, geometry);
        }
        profile(geometry.positions); profile(geometry.colors); profile(mvp);
        headroom(geometry.positions, mvp);
        write(ownedDraws, index, native(() => Object.freeze({geometry, mvp})));
    }
    native(() => Object.freeze(ownedDraws));
    native(() => Object.freeze(distinct));
    const result = native(() => Object.freeze({draws: ownedDraws, geometries: distinct,
        cpuLogicalBytes, sceneBytes, uniformBytes}));
    // Publication/authentication is last. Failed registration returns no frame.
    native(() => scenes.set(result, true));
    return result;
}
export function isSceneFrame3D(value: unknown): value is SceneFrame3D {
    return value !== null && typeof value === 'object' && scenes.has(value);
}
export function getScene3DErrorOrigin(value: unknown): Scene3DErrorOrigin | undefined {
    return value !== null && typeof value === 'object' ? origins.get(value) : undefined;
}
