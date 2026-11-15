export type NumericArray3D = Float32Array | Float64Array | number[];
export declare const EPSILON_3D = 1e-8;
export declare function vec3Set(out: NumericArray3D, x: number, y: number, z: number): NumericArray3D;
export declare function vec3Copy(out: NumericArray3D, a: ArrayLike<number>): NumericArray3D;
export declare function vec3Add(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>): NumericArray3D;
export declare function vec3Sub(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>): NumericArray3D;
export declare function vec3Scale(out: NumericArray3D, a: ArrayLike<number>, s: number): NumericArray3D;
export declare function vec3Dot(a: ArrayLike<number>, b: ArrayLike<number>): number;
export declare function vec3Cross(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>): NumericArray3D;
export declare function vec3Length(a: ArrayLike<number>): number;
export declare function vec3Distance(a: ArrayLike<number>, b: ArrayLike<number>): number;
/** A zero-length input yields the zero vector instead of NaN. */
export declare function vec3Normalize(out: NumericArray3D, a: ArrayLike<number>): NumericArray3D;
export declare function vec3Lerp(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>, t: number): NumericArray3D;
/** Transform a point (w = 1) with perspective division. */
export declare function vec3TransformMat4(out: NumericArray3D, a: ArrayLike<number>, m: ArrayLike<number>): NumericArray3D;
/** Transform a direction (w = 0) by the upper 3x3; the result is not normalized. */
export declare function vec3TransformDirection(out: NumericArray3D, a: ArrayLike<number>, m: ArrayLike<number>): NumericArray3D;
export declare function vec3TransformQuat(out: NumericArray3D, a: ArrayLike<number>, q: ArrayLike<number>): NumericArray3D;
export declare function quatIdentity(out: NumericArray3D): NumericArray3D;
export declare function quatCopy(out: NumericArray3D, a: ArrayLike<number>): NumericArray3D;
export declare function quatNormalize(out: NumericArray3D, a: ArrayLike<number>): NumericArray3D;
export declare function quatMultiply(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>): NumericArray3D;
export declare function quatFromAxisAngle(out: NumericArray3D, axis: ArrayLike<number>, radians: number): NumericArray3D;
/** Intrinsic XYZ Euler angles in radians (rotate X, then Y, then Z in local axes). */
export declare function quatFromEuler(out: NumericArray3D, x: number, y: number, z: number): NumericArray3D;
/** Inverse of quatFromEuler; writes radians into out[0..2]. */
export declare function quatToEuler(out: NumericArray3D, q: ArrayLike<number>): NumericArray3D;
/** Shortest-arc spherical interpolation; falls back to nlerp for close inputs. */
export declare function quatSlerp(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>, t: number): NumericArray3D;
/** Rotation part of a matrix without scale or shear. */
export declare function quatFromRotationMatrix(out: NumericArray3D, m: ArrayLike<number>): NumericArray3D;
export declare function mat4Identity(out: NumericArray3D): NumericArray3D;
export declare function mat4Copy(out: NumericArray3D, a: ArrayLike<number>): NumericArray3D;
/** out = a * b: with column vectors, b applies first. */
export declare function mat4Multiply(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>): NumericArray3D;
/** Affine matrix from translation, unit quaternion and scale. */
export declare function mat4Compose(out: NumericArray3D, t: ArrayLike<number>, q: ArrayLike<number>, s: ArrayLike<number>): NumericArray3D;
/** Split an affine matrix; a negative determinant is folded into scale X. */
export declare function mat4Decompose(m: ArrayLike<number>, t: NumericArray3D, q: NumericArray3D, s: NumericArray3D): void;
export declare function mat4Determinant(m: ArrayLike<number>): number;
/** Returns false and leaves `out` untouched when the matrix is singular. */
export declare function mat4Invert(out: NumericArray3D, m: ArrayLike<number>): boolean;
/** World matrix of an object at `eye` whose negative Z axis points at `target`. */
export declare function mat4LookAt(out: NumericArray3D, eye: ArrayLike<number>, target: ArrayLike<number>, up: ArrayLike<number>): NumericArray3D;
/** Right-handed perspective projection to clip depth [-1, 1]. */
export declare function mat4Perspective(out: NumericArray3D, verticalFov: number, aspect: number, near: number, far: number): NumericArray3D;
export declare function mat4Orthographic(out: NumericArray3D, left: number, right: number, bottom: number, top: number, near: number, far: number): NumericArray3D;
/** 3x3 inverse transpose of the upper-left block, written as nine column-major floats. */
export declare function mat3NormalFromMat4(out: NumericArray3D, m: ArrayLike<number>): NumericArray3D;
export declare function mat4MaxScaleOnAxis(m: ArrayLike<number>): number;
export declare function box3Empty(out: NumericArray3D): NumericArray3D;
export declare function box3IsEmpty(box: ArrayLike<number>): boolean;
export declare function box3ExpandByPoint(box: NumericArray3D, x: number, y: number, z: number): void;
export declare function box3Union(out: NumericArray3D, a: ArrayLike<number>, b: ArrayLike<number>): NumericArray3D;
/** Axis-aligned bounds of a transformed box (Arvo's method). */
export declare function box3Transform(out: NumericArray3D, box: ArrayLike<number>, m: ArrayLike<number>): NumericArray3D;
export declare function sphereFromBox(out: NumericArray3D, box: ArrayLike<number>): NumericArray3D;
export declare function sphereTransform(out: NumericArray3D, sphere: ArrayLike<number>, m: ArrayLike<number>): NumericArray3D;
export declare function frustumFromMatrix(out: NumericArray3D, m: ArrayLike<number>): NumericArray3D;
export declare function frustumIntersectsSphere(frustum: ArrayLike<number>, sphere: ArrayLike<number>): boolean;
export declare function frustumIntersectsBox(frustum: ArrayLike<number>, box: ArrayLike<number>): boolean;
/** Distance along the ray to the sphere, or -1 when it misses. */
export declare function rayIntersectSphere(origin: ArrayLike<number>, direction: ArrayLike<number>, sphere: ArrayLike<number>): number;
/** Slab test; returns the entry distance (0 when the origin is inside) or -1. */
export declare function rayIntersectBox(origin: ArrayLike<number>, direction: ArrayLike<number>, box: ArrayLike<number>): number;
/**
 * Moller-Trumbore. Writes [distance, u, v] into `out` and returns true on a hit.
 * `cull` rejects back faces (counter-clockwise triangles face the ray origin).
 */
export declare function rayIntersectTriangle(out: NumericArray3D, origin: ArrayLike<number>, direction: ArrayLike<number>, p: ArrayLike<number>, a: number, b: number, c: number, cull: boolean): boolean;
export declare function srgbToLinear(value: number): number;
export declare function linearToSrgb(value: number): number;
/** Decode a 0xRRGGBB sRGB color into linear RGB in [0, 1]. */
export declare function colorFromHex(out: NumericArray3D, hex: number): NumericArray3D;
export declare function clamp(value: number, min: number, max: number): number;
export declare const DEG_TO_RAD_3D: number;
//# sourceMappingURL=math3D.d.ts.map