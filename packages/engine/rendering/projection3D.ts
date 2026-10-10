import { createMatrix4, Math3DError } from './matrix4.js';
import type { Matrix4 } from './matrix4.js';

export type DepthRange3D = 'zeroToOne' | 'minusOneToOne';
export type DepthDirection3D = 'forward' | 'reverse';
export interface DepthConvention3D {
    readonly range: DepthRange3D;
    readonly direction: DepthDirection3D;
}
export interface Projection3D {
    readonly kind: 'perspective' | 'orthographic';
    readonly matrix: Matrix4;
    readonly depth: DepthConvention3D;
}

type Captured = readonly [number, number, number, number, number, number, DepthRange3D, DepthDirection3D];
const fields = ['left', 'right', 'bottom', 'top', 'near', 'far', 'depthRange', 'depthDirection'] as const;
function source<T>(operation: () => T): T {
    // Caller-thrown classes/codes are never validation authority: only the
    // actual own-presence/property/array operation lies in this source catch.
    try { return operation(); }
    catch (cause) { throw new Math3DError('MATH3D_INPUT_READ_FAILED', cause); }
}
function native<T>(operation: () => T): T {
    // Owned allocation, writes and publication retain their exact cause;
    // semantic and arithmetic validation stays outside this native boundary.
    try { return operation(); }
    catch (cause) { throw new Math3DError('MATH3D_NATIVE_FAILED', cause); }
}
function capture(input: unknown): Captured {
    if (input === null || typeof input !== 'object' || source(() => Array.isArray(input))) {
        throw new Math3DError('MATH3D_INPUT_INVALID');
    }
    const record = input as Record<string, unknown>;
    const values = native(() => new Array<unknown>(8));
    let missing = false;
    // Exactly one ordered observation: read own fields before any semantics.
    // A later getter fault wins over an earlier hole/bad value; inherited and
    // extra fields, iteration and coercion machinery are never observed.
    for (let index = 0; index < 8; index++) {
        const key = fields[index]!;
        if (source(() => Object.hasOwn(record, key))) {
            const value = source(() => record[key]);
            native(() => { values[index] = value; });
        } else missing = true;
    }
    if (missing) throw new Math3DError('MATH3D_INPUT_INVALID');
    for (let index = 0; index < 6; index++) {
        const value = values[index];
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new Math3DError('MATH3D_INPUT_INVALID');
        native(() => { values[index] = value === 0 ? 0 : value; });
    }
    if ((values[6] !== 'zeroToOne' && values[6] !== 'minusOneToOne')
        || (values[7] !== 'forward' && values[7] !== 'reverse')) throw new Math3DError('MATH3D_INPUT_INVALID');
    return values as unknown as Captured;
}
function finite(value: number): number {
    if (!Number.isFinite(value)) throw new Math3DError('MATH3D_ARITHMETIC_RANGE');
    return value;
}
function nonzero(value: number): number {
    finite(value);
    // Required projection coefficients must survive binary64 representation;
    // finite zero underflow cannot silently collapse a geometric dimension.
    if (value === 0) throw new Math3DError('MATH3D_ARITHMETIC_RANGE');
    return value;
}
function positive(value: number): number {
    finite(value);
    if (value <= 0) throw new Math3DError('MATH3D_ARITHMETIC_RANGE');
    return value;
}
function project(input: unknown, perspective: boolean): Projection3D {
    const values = capture(input);
    const left = values[0], right = values[1], bottom = values[2], top = values[3];
    const near = values[4], far = values[5], range = values[6], direction = values[7];
    if (!(left < right && bottom < top && (perspective ? near > 0 : near >= 0) && far > near)) {
        throw new Math3DError('MATH3D_GEOMETRY_INVALID');
    }
    // Fixed binary64 intermediates are checked before the next expression.
    // Reassociation or an unused branch must not change admission or rounding.
    const dx = positive(right - left);
    const dy = positive(top - bottom);
    const dz = positive(far - near);
    const sumX = finite(right + left);
    const sumY = finite(top + bottom);
    let coefficients: number[];
    if (perspective) {
        const twoNear = finite(2 * near);
        const sx = nonzero(twoNear / dx);
        const sy = nonzero(twoNear / dy);
        const ox = finite(sumX / dx);
        const oy = finite(sumY / dy);
        const nf = finite(near * far);
        let az: number, bz: number;
        // Compute only the chosen depth branch. In particular, finite zero-to-
        // one projections need not represent the unused twoNF intermediate.
        if (range === 'zeroToOne') {
            if (direction === 'forward') {
                const az0 = finite(far / dz);
                az = nonzero(-az0);
                const bz0 = finite(nf / dz);
                bz = nonzero(-bz0);
            } else {
                az = nonzero(near / dz);
                bz = nonzero(nf / dz);
            }
        } else {
            const sumZ = finite(far + near);
            if (direction === 'forward') {
                const az0 = finite(sumZ / dz);
                az = nonzero(-az0);
                const twoNF = finite(2 * nf);
                const bz0 = finite(twoNF / dz);
                bz = nonzero(-bz0);
            } else {
                az = nonzero(sumZ / dz);
                const twoNF = finite(2 * nf);
                bz = nonzero(twoNF / dz);
            }
        }
        // Column-major, column vectors: asymmetric offsets multiply z and raw
        // clip w is -z. No division/clipping/visibility policy is introduced.
        coefficients = native(() => [sx,0,0,0,0,sy,0,0,ox,oy,az,-1,0,0,bz,0]);
    } else {
        const sx = nonzero(2 / dx);
        const sy = nonzero(2 / dy);
        const tx0 = finite(sumX / dx);
        const tx = finite(-tx0);
        const ty0 = finite(sumY / dy);
        const ty = finite(-ty0);
        let az: number, bz: number;
        if (range === 'zeroToOne') {
            if (direction === 'forward') {
                const az0 = finite(1 / dz);
                az = nonzero(-az0);
                const bz0 = finite(near / dz);
                bz = finite(-bz0);
                // Genuine near=0 has zero offset; a positive near whose offset
                // rounds to zero is unsupported representation, not this case.
                if (near > 0) nonzero(bz);
            } else {
                az = nonzero(1 / dz);
                bz = nonzero(far / dz);
            }
        } else {
            if (direction === 'forward') {
                const az0 = finite(2 / dz);
                az = nonzero(-az0);
                const sumZ = finite(far + near);
                const bz0 = finite(sumZ / dz);
                bz = nonzero(-bz0);
            } else {
                az = nonzero(2 / dz);
                const sumZ = finite(far + near);
                bz = nonzero(sumZ / dz);
            }
        }
        // Offsets multiply input w; the fourth row preserves that raw w.
        coefficients = native(() => [sx,0,0,0,0,sy,0,0,0,0,az,0,tx,ty,bz,1]);
    }
    // The trusted tuple port owns and normalizes all coefficients. Keep its
    // own error origin; never blanket-catch/reclassify the whole factory.
    const matrix = createMatrix4(coefficients);
    const depth: DepthConvention3D = native(() => Object.freeze({ range, direction }));
    // Publish only after matrix and convention are ready; every invocation owns
    // three fresh frozen objects. The convention is CPU mathematics, no backend.
    return native(() => Object.freeze({ kind: perspective ? 'perspective' : 'orthographic', matrix, depth }));
}
export function createPerspectiveProjection3D(input: unknown): Projection3D {
    return project(input, true);
}
export function createOrthographicProjection3D(input: unknown): Projection3D {
    return project(input, false);
}
