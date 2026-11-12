// SPDX-License-Identifier: Apache-2.0
// Decals: a texture laid onto existing geometry, such as a bullet hole, a
// scorch mark or a painted sign. The triangles of the target that fall inside
// a box are cut out and returned as a new geometry that hugs the surface, so
// the decal is lit and shadowed like any other mesh on both backends.
import {World3DError, requireFinite3D, requirePositive3D} from './core3D.js';
import {Attribute3D, Geometry3D} from './Geometry3D.js';
import type {Material3D} from './Material3D.js';
import {Mesh3D} from './Mesh3D.js';
import {mat4Invert, mat4Multiply} from './math3D.js';

export const DECAL3D_LIMITS = Object.freeze({maxTriangles: 262144} as const);

export interface DecalOptions3D {
    /** Center of the decal on the surface, in world space. */
    readonly position: ArrayLike<number>;
    /** Direction the decal faces, away from the surface, in world space: usually the hit normal. */
    readonly normal: ArrayLike<number>;
    /** Width and height on the surface and the depth of the box around it. Defaults: 1, 1 and half the larger of the two. */
    readonly width?: number;
    readonly height?: number;
    readonly depth?: number;
    /** Turn about the normal, in radians. */
    readonly rotation?: number;
    /** Which way is up for the decal when the surface leaves a choice. Default +Y, or +Z on a floor. */
    readonly up?: ArrayLike<number>;
    /** Faces turned further than this from the decal's direction are left out, in radians. Default about 80 degrees. */
    readonly maxAngle?: number;
    /** Lift off the surface along each vertex normal, against flicker. Default 0.002. */
    readonly offset?: number;
}

// Decal-space position and normal, and for skinned targets the bones that move the vertex as joint, weight pairs.
type Vertex = [number, number, number, number, number, number] & {bones?: number[]};

/**
 * Cut the part of a mesh's surface that lies inside the decal box. The
 * result is in the mesh's local space, with coordinates running 0 to 1 across
 * the box, or undefined when nothing is inside. A skinned mesh is cut in its
 * bind pose, where `position` and `normal` must lie too, and the result keeps
 * joints and weights so it can follow the same skeleton.
 */
export function createDecalGeometry3D(mesh: Mesh3D, options: DecalOptions3D): Geometry3D | undefined {
    if (!(mesh instanceof Mesh3D) || !options) throw new World3DError('WORLD3D_INPUT_INVALID', 'decal target');
    const geometry = mesh.geometry, source = geometry.getAttribute('position');
    if (!source || geometry.topology !== 'triangles') throw new World3DError('WORLD3D_INPUT_INVALID', 'decal target needs triangles');
    const width = requirePositive3D(options.width ?? 1, 'width'), height = requirePositive3D(options.height ?? 1, 'height'), depth = requirePositive3D(options.depth ?? Math.max(width, height) / 2, 'depth');
    const limit = Math.cos(requireFinite3D(options.maxAngle ?? 1.4, 'maxAngle')), lift = requireFinite3D(options.offset ?? 0.002, 'offset');
    // The decal's frame in world space: Z faces away from the surface.
    let zx = requireFinite3D(options.normal[0], 'normal'), zy = requireFinite3D(options.normal[1], 'normal'), zz = requireFinite3D(options.normal[2], 'normal');
    const zl = Math.hypot(zx, zy, zz);
    if (zl < 1e-9) throw new World3DError('WORLD3D_INPUT_INVALID', 'normal');
    zx /= zl; zy /= zl; zz /= zl;
    const hint = options.up ?? (Math.abs(zy) > 0.99 ? [0, 0, -1] : [0, 1, 0]);
    let xx = hint[1]! * zz - hint[2]! * zy, xy = hint[2]! * zx - hint[0]! * zz, xz = hint[0]! * zy - hint[1]! * zx;
    const xl = Math.hypot(xx, xy, xz);
    if (xl < 1e-9) throw new World3DError('WORLD3D_INPUT_INVALID', 'up must not be parallel to the normal');
    xx /= xl; xy /= xl; xz /= xl;
    let yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    const turn = requireFinite3D(options.rotation ?? 0, 'rotation'), c = Math.cos(turn), s = Math.sin(turn);
    [xx, xy, xz, yx, yy, yz] = [xx * c + yx * s, xy * c + yy * s, xz * c + yz * s, yx * c - xx * s, yy * c - xy * s, yz * c - xz * s];
    const frame = new Float32Array([xx, xy, xz, 0, yx, yy, yz, 0, zx, zy, zz, 0,
        requireFinite3D(options.position[0], 'position'), requireFinite3D(options.position[1], 'position'), requireFinite3D(options.position[2], 'position'), 1]);
    mesh.updateWorldMatrix();
    // Mesh space to decal space and back.
    const toDecal = new Float32Array(16), toMesh = new Float32Array(16);
    if (!mat4Invert(toDecal, frame)) throw new World3DError('WORLD3D_INPUT_INVALID', 'decal frame');
    mat4Multiply(toDecal, toDecal, mesh.matrixWorld);
    if (!mat4Invert(toMesh, toDecal)) throw new World3DError('WORLD3D_INPUT_INVALID', 'mesh transform is singular');
    const p = source.data, normals = geometry.getAttribute('normal')?.data, index = geometry.index?.data, count = index ? index.length : source.count;
    if (count / 3 > DECAL3D_LIMITS.maxTriangles) throw new World3DError('WORLD3D_BUDGET', 'decal target triangles');
    const hx = width / 2, hy = height / 2, hz = depth / 2, m = toDecal;
    const joints = geometry.getAttribute('joints')?.data, weights = geometry.getAttribute('weights')?.data, skinned = joints !== undefined && weights !== undefined;
    // Reflected transforms reverse winding, but the renderers keep the same visible face.
    const determinant = m[0]! * (m[5]! * m[10]! - m[6]! * m[9]!) - m[4]! * (m[1]! * m[10]! - m[2]! * m[9]!)
        + m[8]! * (m[1]! * m[6]! - m[2]! * m[5]!);
    const facing = determinant < 0 ? -1 : 1;
    const read = (i: number): Vertex => {
        const x = p[i * 3]!, y = p[i * 3 + 1]!, z = p[i * 3 + 2]!;
        const out: Vertex = [m[0]! * x + m[4]! * y + m[8]! * z + m[12]!, m[1]! * x + m[5]! * y + m[9]! * z + m[13]!, m[2]! * x + m[6]! * y + m[10]! * z + m[14]!, 0, 0, 0];
        if (normals) {
            const nx = normals[i * 3]!, ny = normals[i * 3 + 1]!, nz = normals[i * 3 + 2]!;
            // Normals use the inverse transpose, so lifting the decal follows the surface under nonuniform scale.
            const inverse = toMesh;
            out[3] = inverse[0]! * nx + inverse[1]! * ny + inverse[2]! * nz;
            out[4] = inverse[4]! * nx + inverse[5]! * ny + inverse[6]! * nz;
            out[5] = inverse[8]! * nx + inverse[9]! * ny + inverse[10]! * nz;
        }
        if (skinned) { out.bones = []; for (let k = 0; k < 4; k++) if (weights[i * 4 + k]! > 0) out.bones.push(joints[i * 4 + k]!, weights[i * 4 + k]!); }
        return out;
    };
    // Sutherland-Hodgman: keep the part of a polygon on the inner side of one face of the box.
    const clip = (polygon: Vertex[], axis: number, sign: number, half: number): Vertex[] => {
        const out: Vertex[] = [];
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!, da = half - a[axis]! * sign, db = half - b[axis]! * sign;
            if (da >= 0) out.push(a);
            if ((da >= 0) !== (db >= 0)) {
                const t = da / (da - db);
                const cut: Vertex = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t, a[4] + (b[4] - a[4]) * t, a[5] + (b[5] - a[5]) * t];
                if (a.bones && b.bones) {
                    // A point on an edge is moved by the bones of both ends, in proportion.
                    cut.bones = [];
                    for (let k = 0; k < a.bones.length; k += 2) cut.bones.push(a.bones[k]!, a.bones[k + 1]! * (1 - t));
                    for (let k = 0; k < b.bones.length; k += 2) {
                        const known = cut.bones.findIndex((value, at) => at % 2 === 0 && value === b.bones![k]);
                        if (known >= 0) cut.bones[known + 1] = cut.bones[known + 1]! + b.bones[k + 1]! * t; else cut.bones.push(b.bones[k]!, b.bones[k + 1]! * t);
                    }
                }
                out.push(cut);
            }
        }
        return out;
    };
    const outPositions: number[] = [], outNormals: number[] = [], outUvs: number[] = [], outJoints: number[] = [], outWeights: number[] = [];
    for (let t = 0; t < count; t += 3) {
        const a = read(index ? index[t]! : t), b = read(index ? index[t + 1]! : t + 1), d = read(index ? index[t + 2]! : t + 2);
        // Quick rejects: wholly outside one face of the box, or turned away from the decal.
        if (Math.min(a[0], b[0], d[0]) > hx || Math.max(a[0], b[0], d[0]) < -hx || Math.min(a[1], b[1], d[1]) > hy || Math.max(a[1], b[1], d[1]) < -hy || Math.min(a[2], b[2], d[2]) > hz || Math.max(a[2], b[2], d[2]) < -hz) continue;
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
        let fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
        const fl = Math.hypot(fx, fy, fz);
        if (fl < 1e-12 || facing * fz / fl < limit) continue;
        const normalScale = facing / fl;
        fx *= normalScale; fy *= normalScale; fz *= normalScale;
        if (!normals) for (const vertex of [a, b, d]) { vertex[3] = fx; vertex[4] = fy; vertex[5] = fz; }
        let polygon: Vertex[] = [a, b, d];
        polygon = clip(polygon, 0, 1, hx); polygon = clip(polygon, 0, -1, hx);
        polygon = clip(polygon, 1, 1, hy); polygon = clip(polygon, 1, -1, hy);
        polygon = clip(polygon, 2, 1, hz); polygon = clip(polygon, 2, -1, hz);
        for (let i = 1; i + 1 < polygon.length; i++) {
            for (const vertex of [polygon[0]!, polygon[i]!, polygon[i + 1]!]) {
                const nl = Math.hypot(vertex[3], vertex[4], vertex[5]) || 1, nx = vertex[3] / nl, ny = vertex[4] / nl, nz = vertex[5] / nl;
                const x = vertex[0] + nx * lift, y = vertex[1] + ny * lift, z = vertex[2] + nz * lift, w = toMesh;
                outPositions.push(w[0]! * x + w[4]! * y + w[8]! * z + w[12]!, w[1]! * x + w[5]! * y + w[9]! * z + w[13]!, w[2]! * x + w[6]! * y + w[10]! * z + w[14]!);
                const mx = m[0]! * nx + m[1]! * ny + m[2]! * nz, my = m[4]! * nx + m[5]! * ny + m[6]! * nz, mz = m[8]! * nx + m[9]! * ny + m[10]! * nz;
                const ml = Math.hypot(mx, my, mz) || 1;
                outNormals.push(mx / ml, my / ml, mz / ml);
                outUvs.push(vertex[0] / width + 0.5, vertex[1] / height + 0.5);
                if (skinned) {
                    // Keep the four strongest bones and make their weights sum to one.
                    const pairs: [number, number][] = [];
                    for (let k = 0; k < (vertex.bones?.length ?? 0); k += 2) pairs.push([vertex.bones![k]!, vertex.bones![k + 1]!]);
                    pairs.sort((first, second) => second[1] - first[1]);
                    const kept = pairs.slice(0, 4), total = kept.reduce((sum, pair) => sum + pair[1], 0) || 1;
                    for (let k = 0; k < 4; k++) { outJoints.push(kept[k]?.[0] ?? 0); outWeights.push((kept[k]?.[1] ?? 0) / total); }
                }
            }
        }
    }
    if (outPositions.length === 0) return undefined;
    const out = new Geometry3D();
    out.setAttribute('position', new Attribute3D(new Float32Array(outPositions), 3));
    out.setAttribute('normal', new Attribute3D(new Float32Array(outNormals), 3));
    out.setAttribute('uv', new Attribute3D(new Float32Array(outUvs), 2));
    if (skinned) { out.setAttribute('joints', new Attribute3D(new Uint16Array(outJoints), 4)); out.setAttribute('weights', new Attribute3D(new Float32Array(outWeights), 4)); }
    return out;
}

/**
 * A decal mesh on a target mesh, added as its child so it moves with it.
 * The material is used as given except that it stops writing depth and gains a
 * depth offset when it has none. On a skinned mesh the decal follows the
 * skeleton. Returns undefined when the box misses the surface.
 */
export function createDecal3D(mesh: Mesh3D, material: Material3D, options: DecalOptions3D): Mesh3D | undefined {
    const geometry = createDecalGeometry3D(mesh, options);
    if (!geometry) return undefined;
    material.depthWrite = false;
    material.polygonOffset ??= [-2, -4];
    const decal = new Mesh3D(geometry, material);
    decal.name = 'decal';
    decal.castShadow = false;
    decal.receiveShadow = mesh.receiveShadow;
    mesh.addChild(decal);
    // On a skinned target the decal is moved by the same bones.
    if (mesh.skeleton && geometry.getAttribute('joints')) decal.bind(mesh.skeleton, mesh.bindMatrix);
    return decal;
}
