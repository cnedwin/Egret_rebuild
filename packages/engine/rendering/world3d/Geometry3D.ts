// SPDX-License-Identifier: Apache-2.0
// Indexed vertex data with named attributes, material groups, morph targets
// and cached bounds. Attribute arrays are caller-visible typed arrays: write
// into them, then call touch() on the attribute to schedule a GPU refresh.
import {Resource3D, World3DError, requireCount3D} from './core3D.js';
import {box3Empty, box3ExpandByPoint, sphereFromBox} from './math3D.js';

export type AttributeArray3D = Float32Array | Uint32Array | Uint16Array | Uint8Array | Int16Array | Int8Array;
export type Topology3D = 'triangles' | 'lines' | 'line-strip' | 'points';
export const GEOMETRY3D_LIMITS = Object.freeze({
    maxVertices: 4194304, maxIndices: 12582912, maxMorphTargets: 256, maxGroups: 1024,
} as const);

/** Well-known attribute names understood by the built-in materials. */
export const ATTRIBUTE_3D = Object.freeze({
    position: 'position', normal: 'normal', tangent: 'tangent', uv: 'uv', uv1: 'uv1', color: 'color',
    joints: 'joints', weights: 'weights',
} as const);

export class Attribute3D {
    readonly data: AttributeArray3D;
    readonly itemSize: number;
    /** Integer data is mapped to [0, 1] or [-1, 1] when sampled as float. */
    readonly normalized: boolean;
    /** Hint that data changes often, so the backend picks a streaming buffer. */
    dynamic = false;
    #version = 1;
    constructor(data: AttributeArray3D, itemSize: number, normalized = false) {
        if (!ArrayBuffer.isView(data) || data instanceof DataView) throw new World3DError('WORLD3D_INPUT_INVALID', 'attribute data');
        if (!Number.isSafeInteger(itemSize) || itemSize < 1 || itemSize > 4 || data.length % itemSize !== 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'attribute itemSize');
        this.data = data;
        this.itemSize = itemSize;
        this.normalized = normalized;
    }
    get count(): number { return this.data.length / this.itemSize; }
    get version(): number { return this.#version; }
    touch(): void { this.#version++; }
}

export interface GeometryGroup3D {
    readonly start: number;
    readonly count: number;
    readonly materialIndex: number;
}
export interface MorphTarget3D {
    readonly name: string;
    /** Per-vertex deltas relative to the base attribute. */
    readonly position?: Float32Array;
    readonly normal?: Float32Array;
}

export class Geometry3D extends Resource3D {
    topology: Topology3D = 'triangles';
    readonly #attributes = new Map<string, Attribute3D>();
    #index: Attribute3D | undefined;
    #groups: GeometryGroup3D[] = [];
    #morphTargets: MorphTarget3D[] = [];
    #boundingBox: Float32Array | undefined;
    #boundingSphere: Float32Array | undefined;
    /** Structure version: attribute set, index or morph targets changed. */
    #layoutVersion = 1;

    get attributes(): ReadonlyMap<string, Attribute3D> { return this.#attributes; }
    get index(): Attribute3D | undefined { return this.#index; }
    get groups(): readonly GeometryGroup3D[] { return this.#groups; }
    get morphTargets(): readonly MorphTarget3D[] { return this.#morphTargets; }
    get layoutVersion(): number { return this.#layoutVersion; }
    get vertexCount(): number { return this.#attributes.get('position')?.count ?? 0; }
    /** Number of indices, or vertices when the geometry is not indexed. */
    get drawCount(): number { return this.#index ? this.#index.count : this.vertexCount; }

    setAttribute(name: string, attribute: Attribute3D): this {
        this.assertLive();
        if (!(attribute instanceof Attribute3D) || typeof name !== 'string' || name.length === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'attribute');
        requireCount3D(attribute.count, 'vertex count', GEOMETRY3D_LIMITS.maxVertices);
        this.#attributes.set(name, attribute);
        if (name === 'position') this.invalidateBounds();
        this.#layoutVersion++;
        this.touch();
        return this;
    }
    getAttribute(name: string): Attribute3D | undefined { return this.#attributes.get(name); }
    removeAttribute(name: string): this {
        if (this.#attributes.delete(name)) { this.#layoutVersion++; this.touch(); }
        return this;
    }
    setIndex(index: Uint16Array | Uint32Array | readonly number[] | undefined): this {
        this.assertLive();
        if (index === undefined) this.#index = undefined;
        else {
            const data = ArrayBuffer.isView(index) ? index
                : (this.vertexCount > 65535 ? new Uint32Array(index) : new Uint16Array(index));
            requireCount3D(data.length, 'index count', GEOMETRY3D_LIMITS.maxIndices);
            // An index past the vertex data would read outside the vertex buffers.
            const vertexCount = this.vertexCount;
            if (vertexCount > 0) {
                for (let i = 0; i < data.length; i++) if (data[i]! >= vertexCount) throw new World3DError('WORLD3D_INPUT_INVALID', 'index out of range');
            }
            if (!ArrayBuffer.isView(index)) {
                for (let i = 0; i < index.length; i++) if (!Number.isSafeInteger(index[i]) || index[i]! < 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'index value');
            }
            this.#index = new Attribute3D(data, 1);
        }
        this.#layoutVersion++;
        this.touch();
        return this;
    }
    /** Assign a material slot to an index (or vertex) range. */
    addGroup(start: number, count: number, materialIndex = 0): this {
        requireCount3D(this.#groups.length + 1, 'groups', GEOMETRY3D_LIMITS.maxGroups);
        this.#groups.push(Object.freeze({start, count, materialIndex}));
        return this;
    }
    clearGroups(): this { this.#groups = []; return this; }
    setMorphTargets(targets: readonly MorphTarget3D[]): this {
        this.assertLive();
        requireCount3D(targets.length, 'morph targets', GEOMETRY3D_LIMITS.maxMorphTargets);
        const expected = this.vertexCount * 3;
        for (const target of targets) {
            if ((target.position && target.position.length !== expected) || (target.normal && target.normal.length !== expected)) {
                throw new World3DError('WORLD3D_INPUT_INVALID', 'morph target length');
            }
        }
        this.#morphTargets = targets.map(target => Object.freeze({...target}));
        this.#layoutVersion++;
        this.touch();
        return this;
    }

    // ---- bounds ------------------------------------------------------------
    /** Local-space [minX, minY, minZ, maxX, maxY, maxZ], cached until positions change. */
    get boundingBox(): Float32Array {
        if (this.#boundingBox) return this.#boundingBox;
        const box = box3Empty(new Float32Array(6)) as Float32Array;
        const position = this.#attributes.get('position');
        if (position) {
            const data = position.data, size = position.itemSize;
            for (let i = 0; i < data.length; i += size) box3ExpandByPoint(box, data[i]!, data[i + 1]!, size > 2 ? data[i + 2]! : 0);
            // Morph deltas can move vertices outside the base bounds.
            if (this.#morphTargets.length) {
                const grow = new Float32Array(3);
                for (const target of this.#morphTargets) {
                    const delta = target.position;
                    if (!delta) continue;
                    let x = 0, y = 0, z = 0;
                    for (let i = 0; i < delta.length; i += 3) {
                        x = Math.max(x, Math.abs(delta[i]!)); y = Math.max(y, Math.abs(delta[i + 1]!)); z = Math.max(z, Math.abs(delta[i + 2]!));
                    }
                    grow[0]! += x; grow[1]! += y; grow[2]! += z;
                }
                box[0]! -= grow[0]!; box[1]! -= grow[1]!; box[2]! -= grow[2]!;
                box[3]! += grow[0]!; box[4]! += grow[1]!; box[5]! += grow[2]!;
            }
        }
        return this.#boundingBox = box;
    }
    /** Local-space [x, y, z, radius]; radius is negative for an empty geometry. */
    get boundingSphere(): Float32Array {
        return this.#boundingSphere ??= sphereFromBox(new Float32Array(4), this.boundingBox) as Float32Array;
    }
    /** Call after editing position data in place. */
    invalidateBounds(): void {
        this.#boundingBox = undefined;
        this.#boundingSphere = undefined;
    }

    // ---- derived attributes ------------------------------------------------
    /** Area-weighted smooth normals for triangle geometry. */
    computeNormals(): this {
        const position = this.#attributes.get('position');
        if (!position || this.topology !== 'triangles') return this;
        const p = position.data, vertexCount = position.count, normals = new Float32Array(vertexCount * 3);
        const index = this.#index?.data, triangles = (index ? index.length : vertexCount) / 3;
        for (let t = 0; t < triangles; t++) {
            const a = (index ? index[t * 3]! : t * 3) * 3, b = (index ? index[t * 3 + 1]! : t * 3 + 1) * 3, c = (index ? index[t * 3 + 2]! : t * 3 + 2) * 3;
            const e1x = p[b]! - p[a]!, e1y = p[b + 1]! - p[a + 1]!, e1z = p[b + 2]! - p[a + 2]!;
            const e2x = p[c]! - p[a]!, e2y = p[c + 1]! - p[a + 1]!, e2z = p[c + 2]! - p[a + 2]!;
            const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
            for (const v of [a, b, c]) { normals[v]! += nx; normals[v + 1]! += ny; normals[v + 2]! += nz; }
        }
        for (let i = 0; i < normals.length; i += 3) {
            const length = Math.hypot(normals[i]!, normals[i + 1]!, normals[i + 2]!) || 1;
            normals[i]! /= length; normals[i + 1]! /= length; normals[i + 2]! /= length;
        }
        return this.setAttribute('normal', new Attribute3D(normals, 3));
    }
    /** Per-vertex tangents (xyz + handedness) from positions, normals and UVs. */
    computeTangents(): this {
        const position = this.#attributes.get('position'), normal = this.#attributes.get('normal'), uv = this.#attributes.get('uv');
        if (!position || !normal || !uv || this.topology !== 'triangles') return this;
        const p = position.data, n = normal.data, t = uv.data, vertexCount = position.count;
        const tan = new Float32Array(vertexCount * 3), bitan = new Float32Array(vertexCount * 3), out = new Float32Array(vertexCount * 4);
        const index = this.#index?.data, triangles = (index ? index.length : vertexCount) / 3;
        for (let k = 0; k < triangles; k++) {
            const a = index ? index[k * 3]! : k * 3, b = index ? index[k * 3 + 1]! : k * 3 + 1, c = index ? index[k * 3 + 2]! : k * 3 + 2;
            const e1x = p[b * 3]! - p[a * 3]!, e1y = p[b * 3 + 1]! - p[a * 3 + 1]!, e1z = p[b * 3 + 2]! - p[a * 3 + 2]!;
            const e2x = p[c * 3]! - p[a * 3]!, e2y = p[c * 3 + 1]! - p[a * 3 + 1]!, e2z = p[c * 3 + 2]! - p[a * 3 + 2]!;
            const du1 = t[b * 2]! - t[a * 2]!, dv1 = t[b * 2 + 1]! - t[a * 2 + 1]!, du2 = t[c * 2]! - t[a * 2]!, dv2 = t[c * 2 + 1]! - t[a * 2 + 1]!;
            const determinant = du1 * dv2 - du2 * dv1;
            if (determinant === 0) continue;
            const r = 1 / determinant;
            const tx = (e1x * dv2 - e2x * dv1) * r, ty = (e1y * dv2 - e2y * dv1) * r, tz = (e1z * dv2 - e2z * dv1) * r;
            const bx = (e2x * du1 - e1x * du2) * r, by = (e2y * du1 - e1y * du2) * r, bz = (e2z * du1 - e1z * du2) * r;
            for (const v of [a, b, c]) {
                tan[v * 3]! += tx; tan[v * 3 + 1]! += ty; tan[v * 3 + 2]! += tz;
                bitan[v * 3]! += bx; bitan[v * 3 + 1]! += by; bitan[v * 3 + 2]! += bz;
            }
        }
        for (let v = 0; v < vertexCount; v++) {
            const nx = n[v * 3]!, ny = n[v * 3 + 1]!, nz = n[v * 3 + 2]!;
            let tx = tan[v * 3]!, ty = tan[v * 3 + 1]!, tz = tan[v * 3 + 2]!;
            // Gram-Schmidt orthogonalization against the normal.
            const d = nx * tx + ny * ty + nz * tz;
            tx -= nx * d; ty -= ny * d; tz -= nz * d;
            const length = Math.hypot(tx, ty, tz);
            if (length > 0) { tx /= length; ty /= length; tz /= length; } else { tx = 1; ty = 0; tz = 0; }
            const cx = ny * tz - nz * ty, cy = nz * tx - nx * tz, cz = nx * ty - ny * tx;
            const handedness = cx * bitan[v * 3]! + cy * bitan[v * 3 + 1]! + cz * bitan[v * 3 + 2]! < 0 ? -1 : 1;
            out[v * 4] = tx; out[v * 4 + 1] = ty; out[v * 4 + 2] = tz; out[v * 4 + 3] = handedness;
        }
        return this.setAttribute('tangent', new Attribute3D(out, 4));
    }
}

export interface GeometryInput3D {
    readonly positions: ArrayLike<number>;
    readonly normals?: ArrayLike<number>;
    readonly uvs?: ArrayLike<number>;
    readonly colors?: ArrayLike<number>;
    readonly indices?: ArrayLike<number>;
    readonly topology?: Topology3D;
}
/** Build a geometry from plain arrays; missing normals are computed for triangles. */
export function createGeometry3D(input: GeometryInput3D): Geometry3D {
    if (!input || typeof input !== 'object' || !input.positions || input.positions.length % 3 !== 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'positions');
    const geometry = new Geometry3D();
    geometry.topology = input.topology ?? 'triangles';
    const vertexCount = input.positions.length / 3;
    geometry.setAttribute('position', new Attribute3D(Float32Array.from(input.positions), 3));
    if (input.uvs) {
        if (input.uvs.length !== vertexCount * 2) throw new World3DError('WORLD3D_INPUT_INVALID', 'uvs');
        geometry.setAttribute('uv', new Attribute3D(Float32Array.from(input.uvs), 2));
    }
    if (input.colors) {
        const size = input.colors.length / vertexCount;
        if (size !== 3 && size !== 4) throw new World3DError('WORLD3D_INPUT_INVALID', 'colors');
        geometry.setAttribute('color', new Attribute3D(Float32Array.from(input.colors), size));
    }
    if (input.indices) {
        for (let i = 0; i < input.indices.length; i++) {
            const value = input.indices[i]!;
            if (!Number.isSafeInteger(value) || value < 0 || value >= vertexCount) throw new World3DError('WORLD3D_INPUT_INVALID', 'indices');
        }
        geometry.setIndex(vertexCount > 65535 ? Uint32Array.from(input.indices) : Uint16Array.from(input.indices));
    }
    if (input.normals) {
        if (input.normals.length !== vertexCount * 3) throw new World3DError('WORLD3D_INPUT_INVALID', 'normals');
        geometry.setAttribute('normal', new Attribute3D(Float32Array.from(input.normals), 3));
    } else if (geometry.topology === 'triangles') geometry.computeNormals();
    return geometry;
}
