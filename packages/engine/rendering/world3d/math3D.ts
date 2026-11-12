// SPDX-License-Identifier: Apache-2.0
// Allocation-free 3D math over caller-owned numeric storage. Matrices are
// column-major with column vectors; cameras look down negative view Z.
// Every function writes into `out` and tolerates `out` aliasing an input.

export type NumericArray3D = Float32Array | Float64Array | number[];
export const EPSILON_3D = 1e-8;

// ---- vec3 -----------------------------------------------------------------
export function vec3Set(out: NumericArray3D, x: number, y: number, z: number): NumericArray3D {
    out[0] = x; out[1] = y; out[2] = z;
    return out;
}
export function vec3Copy(out: NumericArray3D, a: ArrayLike<number>): NumericArray3D {
    out[0] = a[0]!; out[1] = a[1]!; out[2] = a[2]!;
    return out;
}
export function vec3Add(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>): NumericArray3D {
    out[0] = a[0]! + b[0]!; out[1] = a[1]! + b[1]!; out[2] = a[2]! + b[2]!;
    return out;
}
export function vec3Sub(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>): NumericArray3D {
    out[0] = a[0]! - b[0]!; out[1] = a[1]! - b[1]!; out[2] = a[2]! - b[2]!;
    return out;
}
export function vec3Scale(out: NumericArray3D, a: ArrayLike<number>, s: number): NumericArray3D {
    out[0] = a[0]! * s; out[1] = a[1]! * s; out[2] = a[2]! * s;
    return out;
}
export function vec3Dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
    return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}
export function vec3Cross(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>): NumericArray3D {
    const ax = a[0]!, ay = a[1]!, az = a[2]!, bx = b[0]!, by = b[1]!, bz = b[2]!;
    out[0] = ay * bz - az * by; out[1] = az * bx - ax * bz; out[2] = ax * by - ay * bx;
    return out;
}
export function vec3Length(a: ArrayLike<number>): number {
    return Math.hypot(a[0]!, a[1]!, a[2]!);
}
export function vec3Distance(a: ArrayLike<number>, b: ArrayLike<number>): number {
    return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
}
/** A zero-length input yields the zero vector instead of NaN. */
export function vec3Normalize(out: NumericArray3D, a: ArrayLike<number>): NumericArray3D {
    const length = Math.hypot(a[0]!, a[1]!, a[2]!);
    const inverse = length > 0 ? 1 / length : 0;
    out[0] = a[0]! * inverse; out[1] = a[1]! * inverse; out[2] = a[2]! * inverse;
    return out;
}
export function vec3Lerp(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>, t: number): NumericArray3D {
    out[0] = a[0]! + (b[0]! - a[0]!) * t; out[1] = a[1]! + (b[1]! - a[1]!) * t; out[2] = a[2]! + (b[2]! - a[2]!) * t;
    return out;
}
/** Transform a point (w = 1) with perspective division. */
export function vec3TransformMat4(out: NumericArray3D, a: ArrayLike<number>, m: ArrayLike<number>): NumericArray3D {
    const x = a[0]!, y = a[1]!, z = a[2]!;
    const w = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;
    const inverse = w !== 0 ? 1 / w : 1;
    out[0] = (m[0]! * x + m[4]! * y + m[8]! * z + m[12]!) * inverse;
    out[1] = (m[1]! * x + m[5]! * y + m[9]! * z + m[13]!) * inverse;
    out[2] = (m[2]! * x + m[6]! * y + m[10]! * z + m[14]!) * inverse;
    return out;
}
/** Transform a direction (w = 0) by the upper 3x3; the result is not normalized. */
export function vec3TransformDirection(out: NumericArray3D, a: ArrayLike<number>, m: ArrayLike<number>): NumericArray3D {
    const x = a[0]!, y = a[1]!, z = a[2]!;
    out[0] = m[0]! * x + m[4]! * y + m[8]! * z;
    out[1] = m[1]! * x + m[5]! * y + m[9]! * z;
    out[2] = m[2]! * x + m[6]! * y + m[10]! * z;
    return out;
}
export function vec3TransformQuat(out: NumericArray3D, a: ArrayLike<number>, q: ArrayLike<number>): NumericArray3D {
    const x = a[0]!, y = a[1]!, z = a[2]!, qx = q[0]!, qy = q[1]!, qz = q[2]!, qw = q[3]!;
    // t = 2 * cross(q.xyz, v); v' = v + qw * t + cross(q.xyz, t)
    const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
    out[0] = x + qw * tx + (qy * tz - qz * ty);
    out[1] = y + qw * ty + (qz * tx - qx * tz);
    out[2] = z + qw * tz + (qx * ty - qy * tx);
    return out;
}

// ---- quaternion (x, y, z, w) -----------------------------------------------
export function quatIdentity(out: NumericArray3D): NumericArray3D {
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 1;
    return out;
}
export function quatCopy(out: NumericArray3D, a: ArrayLike<number>): NumericArray3D {
    out[0] = a[0]!; out[1] = a[1]!; out[2] = a[2]!; out[3] = a[3]!;
    return out;
}
export function quatNormalize(out: NumericArray3D, a: ArrayLike<number>): NumericArray3D {
    const length = Math.hypot(a[0]!, a[1]!, a[2]!, a[3]!);
    if (length === 0) return quatIdentity(out);
    const inverse = 1 / length;
    out[0] = a[0]! * inverse; out[1] = a[1]! * inverse; out[2] = a[2]! * inverse; out[3] = a[3]! * inverse;
    return out;
}
export function quatMultiply(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>): NumericArray3D {
    const ax = a[0]!, ay = a[1]!, az = a[2]!, aw = a[3]!, bx = b[0]!, by = b[1]!, bz = b[2]!, bw = b[3]!;
    out[0] = ax * bw + aw * bx + ay * bz - az * by;
    out[1] = ay * bw + aw * by + az * bx - ax * bz;
    out[2] = az * bw + aw * bz + ax * by - ay * bx;
    out[3] = aw * bw - ax * bx - ay * by - az * bz;
    return out;
}
export function quatFromAxisAngle(out: NumericArray3D, axis: ArrayLike<number>, radians: number): NumericArray3D {
    const half = radians * 0.5, s = Math.sin(half);
    const length = Math.hypot(axis[0]!, axis[1]!, axis[2]!) || 1;
    out[0] = axis[0]! / length * s; out[1] = axis[1]! / length * s; out[2] = axis[2]! / length * s; out[3] = Math.cos(half);
    return out;
}
/** Intrinsic XYZ Euler angles in radians (rotate X, then Y, then Z in local axes). */
export function quatFromEuler(out: NumericArray3D, x: number, y: number, z: number): NumericArray3D {
    const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
    const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
    out[0] = s1 * c2 * c3 + c1 * s2 * s3;
    out[1] = c1 * s2 * c3 - s1 * c2 * s3;
    out[2] = c1 * c2 * s3 + s1 * s2 * c3;
    out[3] = c1 * c2 * c3 - s1 * s2 * s3;
    return out;
}
/** Inverse of quatFromEuler; writes radians into out[0..2]. */
export function quatToEuler(out: NumericArray3D, q: ArrayLike<number>): NumericArray3D {
    const x = q[0]!, y = q[1]!, z = q[2]!, w = q[3]!;
    const m13 = 2 * (x * z + w * y);
    out[1] = Math.asin(Math.max(-1, Math.min(1, m13)));
    if (Math.abs(m13) < 0.9999999) {
        out[0] = Math.atan2(-2 * (y * z - w * x), 1 - 2 * (x * x + y * y));
        out[2] = Math.atan2(-2 * (x * y - w * z), 1 - 2 * (y * y + z * z));
    } else {
        out[0] = Math.atan2(2 * (y * z + w * x), 1 - 2 * (x * x + z * z));
        out[2] = 0;
    }
    return out;
}
/** Shortest-arc spherical interpolation; falls back to nlerp for close inputs. */
export function quatSlerp(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>, t: number): NumericArray3D {
    const ax = a[0]!, ay = a[1]!, az = a[2]!, aw = a[3]!;
    let bx = b[0]!, by = b[1]!, bz = b[2]!, bw = b[3]!;
    let cosine = ax * bx + ay * by + az * bz + aw * bw;
    if (cosine < 0) { cosine = -cosine; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    let s0: number, s1: number;
    if (1 - cosine > 1e-6) {
        const omega = Math.acos(cosine), sine = Math.sin(omega);
        s0 = Math.sin((1 - t) * omega) / sine; s1 = Math.sin(t * omega) / sine;
    } else { s0 = 1 - t; s1 = t; }
    out[0] = s0 * ax + s1 * bx; out[1] = s0 * ay + s1 * by; out[2] = s0 * az + s1 * bz; out[3] = s0 * aw + s1 * bw;
    return out;
}
/** Rotation part of a matrix without scale or shear. */
export function quatFromRotationMatrix(out: NumericArray3D, m: ArrayLike<number>): NumericArray3D {
    const m00 = m[0]!, m01 = m[4]!, m02 = m[8]!, m10 = m[1]!, m11 = m[5]!, m12 = m[9]!, m20 = m[2]!, m21 = m[6]!, m22 = m[10]!;
    const trace = m00 + m11 + m22;
    if (trace > 0) {
        const s = 0.5 / Math.sqrt(trace + 1);
        out[3] = 0.25 / s; out[0] = (m21 - m12) * s; out[1] = (m02 - m20) * s; out[2] = (m10 - m01) * s;
    } else if (m00 > m11 && m00 > m22) {
        const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
        out[3] = (m21 - m12) / s; out[0] = 0.25 * s; out[1] = (m01 + m10) / s; out[2] = (m02 + m20) / s;
    } else if (m11 > m22) {
        const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
        out[3] = (m02 - m20) / s; out[0] = (m01 + m10) / s; out[1] = 0.25 * s; out[2] = (m12 + m21) / s;
    } else {
        const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
        out[3] = (m10 - m01) / s; out[0] = (m02 + m20) / s; out[1] = (m12 + m21) / s; out[2] = 0.25 * s;
    }
    return out;
}

// ---- mat4 -------------------------------------------------------------------
export function mat4Identity(out: NumericArray3D): NumericArray3D {
    out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0; out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0; out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
    return out;
}
export function mat4Copy(out: NumericArray3D, a: ArrayLike<number>): NumericArray3D {
    for (let i = 0; i < 16; i++) out[i] = a[i]!;
    return out;
}
/** out = a * b: with column vectors, b applies first. */
export function mat4Multiply(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>): NumericArray3D {
    const a00 = a[0]!, a01 = a[1]!, a02 = a[2]!, a03 = a[3]!, a10 = a[4]!, a11 = a[5]!, a12 = a[6]!, a13 = a[7]!;
    const a20 = a[8]!, a21 = a[9]!, a22 = a[10]!, a23 = a[11]!, a30 = a[12]!, a31 = a[13]!, a32 = a[14]!, a33 = a[15]!;
    for (let column = 0; column < 4; column++) {
        const o = column * 4, b0 = b[o]!, b1 = b[o + 1]!, b2 = b[o + 2]!, b3 = b[o + 3]!;
        out[o] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
        out[o + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
        out[o + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
        out[o + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    }
    return out;
}
/** Affine matrix from translation, unit quaternion and scale. */
export function mat4Compose(out: NumericArray3D, t: ArrayLike<number>, q: ArrayLike<number>, s: ArrayLike<number>): NumericArray3D {
    const x = q[0]!, y = q[1]!, z = q[2]!, w = q[3]!;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = s[0]!, sy = s[1]!, sz = s[2]!;
    out[0] = (1 - (yy + zz)) * sx; out[1] = (xy + wz) * sx; out[2] = (xz - wy) * sx; out[3] = 0;
    out[4] = (xy - wz) * sy; out[5] = (1 - (xx + zz)) * sy; out[6] = (yz + wx) * sy; out[7] = 0;
    out[8] = (xz + wy) * sz; out[9] = (yz - wx) * sz; out[10] = (1 - (xx + yy)) * sz; out[11] = 0;
    out[12] = t[0]!; out[13] = t[1]!; out[14] = t[2]!; out[15] = 1;
    return out;
}
const scratchRotation = new Float64Array(16);
/** Split an affine matrix; a negative determinant is folded into scale X. */
export function mat4Decompose(m: ArrayLike<number>, t: NumericArray3D, q: NumericArray3D, s: NumericArray3D): void {
    let sx = Math.hypot(m[0]!, m[1]!, m[2]!);
    const sy = Math.hypot(m[4]!, m[5]!, m[6]!), sz = Math.hypot(m[8]!, m[9]!, m[10]!);
    if (mat4Determinant(m) < 0) sx = -sx;
    t[0] = m[12]!; t[1] = m[13]!; t[2] = m[14]!;
    const ix = sx !== 0 ? 1 / sx : 0, iy = sy !== 0 ? 1 / sy : 0, iz = sz !== 0 ? 1 / sz : 0;
    const r = scratchRotation;
    r[0] = m[0]! * ix; r[1] = m[1]! * ix; r[2] = m[2]! * ix;
    r[4] = m[4]! * iy; r[5] = m[5]! * iy; r[6] = m[6]! * iy;
    r[8] = m[8]! * iz; r[9] = m[9]! * iz; r[10] = m[10]! * iz;
    quatFromRotationMatrix(q, r);
    s[0] = sx; s[1] = sy; s[2] = sz;
}
export function mat4Determinant(m: ArrayLike<number>): number {
    const a00 = m[0]!, a01 = m[1]!, a02 = m[2]!, a03 = m[3]!, a10 = m[4]!, a11 = m[5]!, a12 = m[6]!, a13 = m[7]!;
    const a20 = m[8]!, a21 = m[9]!, a22 = m[10]!, a23 = m[11]!, a30 = m[12]!, a31 = m[13]!, a32 = m[14]!, a33 = m[15]!;
    const b0 = a00 * a11 - a01 * a10, b1 = a00 * a12 - a02 * a10, b2 = a01 * a12 - a02 * a11;
    const b3 = a20 * a31 - a21 * a30, b4 = a20 * a32 - a22 * a30, b5 = a21 * a32 - a22 * a31;
    const b6 = a00 * b5 - a01 * b4 + a02 * b3, b7 = a10 * b5 - a11 * b4 + a12 * b3;
    const b8 = a20 * b2 - a21 * b1 + a22 * b0, b9 = a30 * b2 - a31 * b1 + a32 * b0;
    return a13 * b6 - a03 * b7 + a33 * b8 - a23 * b9;
}
/** Returns false and leaves `out` untouched when the matrix is singular. */
export function mat4Invert(out: NumericArray3D, m: ArrayLike<number>): boolean {
    const a00 = m[0]!, a01 = m[1]!, a02 = m[2]!, a03 = m[3]!, a10 = m[4]!, a11 = m[5]!, a12 = m[6]!, a13 = m[7]!;
    const a20 = m[8]!, a21 = m[9]!, a22 = m[10]!, a23 = m[11]!, a30 = m[12]!, a31 = m[13]!, a32 = m[14]!, a33 = m[15]!;
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    const determinant = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (determinant === 0 || !Number.isFinite(determinant)) return false;
    const d = 1 / determinant;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
    return true;
}
/** World matrix of an object at `eye` whose negative Z axis points at `target`. */
export function mat4LookAt(out: NumericArray3D, eye: ArrayLike<number>, target: ArrayLike<number>, up: ArrayLike<number>): NumericArray3D {
    let zx = eye[0]! - target[0]!, zy = eye[1]! - target[1]!, zz = eye[2]! - target[2]!;
    let length = Math.hypot(zx, zy, zz);
    if (length === 0) { zz = 1; length = 1; }
    zx /= length; zy /= length; zz /= length;
    let xx = up[1]! * zz - up[2]! * zy, xy = up[2]! * zx - up[0]! * zz, xz = up[0]! * zy - up[1]! * zx;
    length = Math.hypot(xx, xy, xz);
    if (length === 0) {
        // `up` is parallel to the view direction: pick any perpendicular axis.
        if (Math.abs(zy) > 0.999) { xx = 1; xy = 0; xz = 0; } else { xx = zz; xy = 0; xz = -zx; }
        length = Math.hypot(xx, xy, xz);
    }
    xx /= length; xy /= length; xz /= length;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    out[0] = xx; out[1] = xy; out[2] = xz; out[3] = 0; out[4] = yx; out[5] = yy; out[6] = yz; out[7] = 0;
    out[8] = zx; out[9] = zy; out[10] = zz; out[11] = 0; out[12] = eye[0]!; out[13] = eye[1]!; out[14] = eye[2]!; out[15] = 1;
    return out;
}
/** Right-handed perspective projection to clip depth [-1, 1]. */
export function mat4Perspective(out: NumericArray3D, verticalFov: number, aspect: number, near: number, far: number): NumericArray3D {
    const f = 1 / Math.tan(verticalFov / 2), range = 1 / (near - far);
    mat4Identity(out);
    out[0] = f / aspect; out[5] = f; out[10] = (far + near) * range; out[11] = -1; out[14] = 2 * far * near * range; out[15] = 0;
    return out;
}
export function mat4Orthographic(out: NumericArray3D, left: number, right: number, bottom: number, top: number, near: number, far: number): NumericArray3D {
    const w = 1 / (right - left), h = 1 / (top - bottom), d = 1 / (near - far);
    mat4Identity(out);
    out[0] = 2 * w; out[5] = 2 * h; out[10] = 2 * d; out[12] = -(right + left) * w; out[13] = -(top + bottom) * h; out[14] = (far + near) * d;
    return out;
}
/** 3x3 inverse transpose of the upper-left block, written as nine column-major floats. */
export function mat3NormalFromMat4(out: NumericArray3D, m: ArrayLike<number>): NumericArray3D {
    const a00 = m[0]!, a01 = m[1]!, a02 = m[2]!, a10 = m[4]!, a11 = m[5]!, a12 = m[6]!, a20 = m[8]!, a21 = m[9]!, a22 = m[10]!;
    const c00 = a11 * a22 - a12 * a21, c01 = a12 * a20 - a10 * a22, c02 = a10 * a21 - a11 * a20;
    const determinant = a00 * c00 + a01 * c01 + a02 * c02;
    const d = determinant !== 0 ? 1 / determinant : 0;
    out[0] = c00 * d; out[1] = c01 * d; out[2] = c02 * d;
    out[3] = (a02 * a21 - a01 * a22) * d; out[4] = (a00 * a22 - a02 * a20) * d; out[5] = (a01 * a20 - a00 * a21) * d;
    out[6] = (a01 * a12 - a02 * a11) * d; out[7] = (a02 * a10 - a00 * a12) * d; out[8] = (a00 * a11 - a01 * a10) * d;
    return out;
}
export function mat4MaxScaleOnAxis(m: ArrayLike<number>): number {
    const x = m[0]! * m[0]! + m[1]! * m[1]! + m[2]! * m[2]!;
    const y = m[4]! * m[4]! + m[5]! * m[5]! + m[6]! * m[6]!;
    const z = m[8]! * m[8]! + m[9]! * m[9]! + m[10]! * m[10]!;
    return Math.sqrt(Math.max(x, y, z));
}

// ---- bounds: box = [minX, minY, minZ, maxX, maxY, maxZ], sphere = [x, y, z, radius]
export function box3Empty(out: NumericArray3D): NumericArray3D {
    out[0] = out[1] = out[2] = Infinity; out[3] = out[4] = out[5] = -Infinity;
    return out;
}
export function box3IsEmpty(box: ArrayLike<number>): boolean {
    return box[3]! < box[0]! || box[4]! < box[1]! || box[5]! < box[2]!;
}
export function box3ExpandByPoint(box: NumericArray3D, x: number, y: number, z: number): void {
    if (x < box[0]!) box[0] = x; if (y < box[1]!) box[1] = y; if (z < box[2]!) box[2] = z;
    if (x > box[3]!) box[3] = x; if (y > box[4]!) box[4] = y; if (z > box[5]!) box[5] = z;
}
export function box3Union(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>): NumericArray3D {
    out[0] = Math.min(a[0]!, b[0]!); out[1] = Math.min(a[1]!, b[1]!); out[2] = Math.min(a[2]!, b[2]!);
    out[3] = Math.max(a[3]!, b[3]!); out[4] = Math.max(a[4]!, b[4]!); out[5] = Math.max(a[5]!, b[5]!);
    return out;
}
/** Axis-aligned bounds of a transformed box (Arvo's method). */
export function box3Transform(out: NumericArray3D, box: ArrayLike<number>, m: ArrayLike<number>): NumericArray3D {
    if (box3IsEmpty(box)) return box3Empty(out);
    const min = [m[12]!, m[13]!, m[14]!], max = [m[12]!, m[13]!, m[14]!];
    for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
            const e = m[column * 4 + row]!, a = e * box[column]!, b = e * box[column + 3]!;
            min[row]! += Math.min(a, b); max[row]! += Math.max(a, b);
        }
    }
    out[0] = min[0]!; out[1] = min[1]!; out[2] = min[2]!; out[3] = max[0]!; out[4] = max[1]!; out[5] = max[2]!;
    return out;
}
export function sphereFromBox(out: NumericArray3D, box: ArrayLike<number>): NumericArray3D {
    if (box3IsEmpty(box)) { out[0] = out[1] = out[2] = 0; out[3] = -1; return out; }
    out[0] = (box[0]! + box[3]!) / 2; out[1] = (box[1]! + box[4]!) / 2; out[2] = (box[2]! + box[5]!) / 2;
    out[3] = Math.hypot(box[3]! - box[0]!, box[4]! - box[1]!, box[5]! - box[2]!) / 2;
    return out;
}
export function sphereTransform(out: NumericArray3D, sphere: ArrayLike<number>, m: ArrayLike<number>): NumericArray3D {
    const radius = sphere[3]!;
    vec3TransformMat4(out, sphere, m);
    out[3] = radius < 0 ? radius : radius * mat4MaxScaleOnAxis(m);
    return out;
}

// ---- frustum: six inward planes [nx, ny, nz, d] from a view-projection matrix
export function frustumFromMatrix(out: NumericArray3D, m: ArrayLike<number>): NumericArray3D {
    const rows = [0, 1, 2];
    let o = 0;
    for (const row of rows) {
        for (const sign of [1, -1]) {
            let x = m[3]! + sign * m[row]!, y = m[7]! + sign * m[4 + row]!, z = m[11]! + sign * m[8 + row]!, d = m[15]! + sign * m[12 + row]!;
            const length = Math.hypot(x, y, z) || 1;
            x /= length; y /= length; z /= length; d /= length;
            out[o++] = x; out[o++] = y; out[o++] = z; out[o++] = d;
        }
    }
    return out;
}
export function frustumIntersectsSphere(frustum: ArrayLike<number>, sphere: ArrayLike<number>): boolean {
    const x = sphere[0]!, y = sphere[1]!, z = sphere[2]!, negativeRadius = -sphere[3]!;
    for (let o = 0; o < 24; o += 4) {
        if (frustum[o]! * x + frustum[o + 1]! * y + frustum[o + 2]! * z + frustum[o + 3]! < negativeRadius) return false;
    }
    return true;
}
export function frustumIntersectsBox(frustum: ArrayLike<number>, box: ArrayLike<number>): boolean {
    for (let o = 0; o < 24; o += 4) {
        const nx = frustum[o]!, ny = frustum[o + 1]!, nz = frustum[o + 2]!;
        // Test the box corner farthest along the plane normal.
        const x = nx > 0 ? box[3]! : box[0]!, y = ny > 0 ? box[4]! : box[1]!, z = nz > 0 ? box[5]! : box[2]!;
        if (nx * x + ny * y + nz * z + frustum[o + 3]! < 0) return false;
    }
    return true;
}

// ---- rays: origin and unit direction ----------------------------------------
/** Distance along the ray to the sphere, or -1 when it misses. */
export function rayIntersectSphere(origin: ArrayLike<number>, direction: ArrayLike<number>, sphere: ArrayLike<number>): number {
    const ox = sphere[0]! - origin[0]!, oy = sphere[1]! - origin[1]!, oz = sphere[2]! - origin[2]!;
    const along = ox * direction[0]! + oy * direction[1]! + oz * direction[2]!;
    const distance2 = ox * ox + oy * oy + oz * oz - along * along, radius2 = sphere[3]! * sphere[3]!;
    if (distance2 > radius2) return -1;
    const half = Math.sqrt(radius2 - distance2), near = along - half, far = along + half;
    if (far < 0) return -1;
    return near >= 0 ? near : far;
}
/** Slab test; returns the entry distance (0 when the origin is inside) or -1. */
export function rayIntersectBox(origin: ArrayLike<number>, direction: ArrayLike<number>, box: ArrayLike<number>): number {
    let near = -Infinity, far = Infinity;
    for (let axis = 0; axis < 3; axis++) {
        const inverse = 1 / direction[axis]!;
        let t0 = (box[axis]! - origin[axis]!) * inverse, t1 = (box[axis + 3]! - origin[axis]!) * inverse;
        if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
        if (Number.isNaN(t0) || Number.isNaN(t1)) continue;
        if (t0 > near) near = t0;
        if (t1 < far) far = t1;
        if (near > far) return -1;
    }
    if (far < 0) return -1;
    return near >= 0 ? near : 0;
}
/**
 * Moller-Trumbore. Writes [distance, u, v] into `out` and returns true on a hit.
 * `cull` rejects back faces (counter-clockwise triangles face the ray origin).
 */
export function rayIntersectTriangle(out: NumericArray3D, origin: ArrayLike<number>, direction: ArrayLike<number>,
    p: ArrayLike<number>, a: number, b: number, c: number, cull: boolean): boolean {
    const ax = p[a]!, ay = p[a + 1]!, az = p[a + 2]!;
    const e1x = p[b]! - ax, e1y = p[b + 1]! - ay, e1z = p[b + 2]! - az;
    const e2x = p[c]! - ax, e2y = p[c + 1]! - ay, e2z = p[c + 2]! - az;
    const dx = direction[0]!, dy = direction[1]!, dz = direction[2]!;
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    const determinant = e1x * px + e1y * py + e1z * pz;
    if (cull ? determinant < EPSILON_3D : Math.abs(determinant) < EPSILON_3D) return false;
    const inverse = 1 / determinant;
    const tx = origin[0]! - ax, ty = origin[1]! - ay, tz = origin[2]! - az;
    const u = (tx * px + ty * py + tz * pz) * inverse;
    if (u < 0 || u > 1) return false;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inverse;
    if (v < 0 || u + v > 1) return false;
    const distance = (e2x * qx + e2y * qy + e2z * qz) * inverse;
    if (distance < 0) return false;
    out[0] = distance; out[1] = u; out[2] = v;
    return true;
}

// ---- color -------------------------------------------------------------------
export function srgbToLinear(value: number): number {
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}
export function linearToSrgb(value: number): number {
    return value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}
/** Decode a 0xRRGGBB sRGB color into linear RGB in [0, 1]. */
export function colorFromHex(out: NumericArray3D, hex: number): NumericArray3D {
    out[0] = srgbToLinear(((hex >> 16) & 255) / 255);
    out[1] = srgbToLinear(((hex >> 8) & 255) / 255);
    out[2] = srgbToLinear((hex & 255) / 255);
    return out;
}
export function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}
export const DEG_TO_RAD_3D = Math.PI / 180;
