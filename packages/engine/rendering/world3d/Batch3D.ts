// SPDX-License-Identifier: Apache-2.0
// Two meshes that assemble their own geometry: a batch that draws many
// different shapes sharing one material in a single call, and a line with
// real width that always faces the camera.
import type {Camera3D} from './Camera3D.js';
import {World3DError, requireFinite3D} from './core3D.js';
import {Attribute3D, Geometry3D} from './Geometry3D.js';
import {Material3D} from './Material3D.js';
import type {ColorInput3D} from './Material3D.js';
import {mat3NormalFromMat4, mat4Identity} from './math3D.js';
import {Mesh3D} from './Mesh3D.js';

export const BATCH3D_LIMITS = Object.freeze({maxItems: 65536, maxVertices: 4194304, maxLinePoints: 65536} as const);
interface BatchItem { positions: Float32Array; normals: Float32Array; uvs: Float32Array | undefined; indices: Uint32Array; matrix: Float32Array; visible: boolean; color: Float32Array | undefined }
const IDENTITY = mat4Identity(new Float32Array(16)) as Float32Array;

/**
 * Many geometries drawn as one mesh with one material and one draw call.
 * Each added geometry keeps its own transform, visibility and tint, which
 * can change afterwards; the combined buffers are rebuilt only when something
 * did. Best for props that move rarely, since a change rewrites the batch.
 */
export class BatchedMesh3D extends Mesh3D {
    readonly #items: (BatchItem | undefined)[] = [];
    readonly #normalMatrix = new Float32Array(9);
    #dirty = false;
    #useColors = false;

    constructor(material: Material3D) {
        const geometry = new Geometry3D();
        geometry.setAttribute('position', new Attribute3D(new Float32Array(9), 3));
        super(geometry, material);
        this.name = 'batch';
    }
    /** Number of geometries added and not deleted. */
    get itemCount(): number { let count = 0; for (const item of this.#items) if (item) count++; return count; }
    /** Add a triangle geometry and return its id within this batch. The geometry itself is copied. */
    addGeometry(geometry: Geometry3D, matrix: ArrayLike<number> = IDENTITY): number {
        if (!(geometry instanceof Geometry3D) || geometry.topology !== 'triangles') throw new World3DError('WORLD3D_INPUT_INVALID', 'batch geometry');
        const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
        if (!position || !normal) throw new World3DError('WORLD3D_INPUT_INVALID', 'batch geometry needs positions and normals');
        if (this.#items.length >= BATCH3D_LIMITS.maxItems) throw new World3DError('WORLD3D_BUDGET', 'batch items');
        const count = position.count, indices = geometry.index ? Uint32Array.from(geometry.index.data) : Uint32Array.from({length: count}, (_, i) => i);
        this.#items.push({
            positions: Float32Array.from(position.data), normals: Float32Array.from(normal.data), uvs: uv ? Float32Array.from(uv.data) : undefined,
            indices, matrix: this.checkedMatrix(matrix), visible: true, color: undefined,
        });
        this.#dirty = true;
        return this.#items.length - 1;
    }
    private checkedMatrix(matrix: ArrayLike<number>): Float32Array {
        if (!matrix || matrix.length !== 16) throw new World3DError('WORLD3D_INPUT_INVALID', 'batch matrix');
        const out = new Float32Array(16);
        for (let i = 0; i < 16; i++) out[i] = requireFinite3D(matrix[i], 'batch matrix');
        return out;
    }
    private item(id: number): BatchItem {
        const item = this.#items[id];
        if (!item) throw new World3DError('WORLD3D_INPUT_INVALID', 'batch id');
        return item;
    }
    setMatrixAt(id: number, matrix: ArrayLike<number>): this { this.item(id).matrix = this.checkedMatrix(matrix); this.#dirty = true; return this; }
    getMatrixAt(id: number, out: Float32Array = new Float32Array(16)): Float32Array { out.set(this.item(id).matrix); return out; }
    setVisibleAt(id: number, visible: boolean): this { const item = this.item(id); if (item.visible !== visible) { item.visible = visible; this.#dirty = true; } return this; }
    getVisibleAt(id: number): boolean { return this.item(id).visible; }
    /** Tint one item through vertex colors; the material needs `vertexColors` enabled. */
    setColorAt(id: number, r: number, g: number, b: number): this { this.item(id).color = new Float32Array([r, g, b]); this.#useColors = true; this.#dirty = true; return this; }
    /** Remove an item. Its id is not reused. */
    deleteGeometry(id: number): this { this.item(id); this.#items[id] = undefined; this.#dirty = true; return this; }
    /** Rebuild the combined buffers now instead of at the next frame. */
    flush(): void {
        if (!this.#dirty) return;
        this.#dirty = false;
        let vertexTotal = 0, indexTotal = 0, anyUv = false;
        for (const item of this.#items) {
            if (!item || !item.visible) continue;
            vertexTotal += item.positions.length / 3; indexTotal += item.indices.length;
            if (item.uvs) anyUv = true;
        }
        if (vertexTotal > BATCH3D_LIMITS.maxVertices) throw new World3DError('WORLD3D_BUDGET', 'batch vertices');
        const geometry = this.geometry;
        // An empty batch keeps one degenerate triangle so the geometry stays valid; it draws nothing.
        const positions = new Float32Array(Math.max(vertexTotal, 3) * 3), normals = new Float32Array(Math.max(vertexTotal, 3) * 3);
        const uvs = anyUv ? new Float32Array(Math.max(vertexTotal, 3) * 2) : undefined, colors = this.#useColors ? new Float32Array(Math.max(vertexTotal, 3) * 3).fill(1) : undefined;
        const indices = new Uint32Array(indexTotal);
        let vertex = 0, index = 0;
        for (const item of this.#items) {
            if (!item || !item.visible) continue;
            const m = item.matrix, n = mat3NormalFromMat4(this.#normalMatrix, m), count = item.positions.length / 3;
            for (let i = 0; i < count; i++) {
                const x = item.positions[i * 3]!, y = item.positions[i * 3 + 1]!, z = item.positions[i * 3 + 2]!, o = (vertex + i) * 3;
                positions[o] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!; positions[o + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!; positions[o + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
                const nx = item.normals[i * 3]!, ny = item.normals[i * 3 + 1]!, nz = item.normals[i * 3 + 2]!;
                const tx = n[0]! * nx + n[3]! * ny + n[6]! * nz, ty = n[1]! * nx + n[4]! * ny + n[7]! * nz, tz = n[2]! * nx + n[5]! * ny + n[8]! * nz, length = Math.hypot(tx, ty, tz) || 1;
                normals[o] = tx / length; normals[o + 1] = ty / length; normals[o + 2] = tz / length;
                if (colors && item.color) colors.set(item.color, o);
            }
            if (uvs && item.uvs) uvs.set(item.uvs, vertex * 2);
            // A mirrored transform flips winding; swap two corners so faces stay outward.
            const mirrored = m[0]! * (m[5]! * m[10]! - m[6]! * m[9]!) - m[4]! * (m[1]! * m[10]! - m[2]! * m[9]!) + m[8]! * (m[1]! * m[6]! - m[2]! * m[5]!) < 0;
            for (let i = 0; i < item.indices.length; i += 3) {
                indices[index + i] = item.indices[i]! + vertex;
                indices[index + i + 1] = item.indices[i + (mirrored ? 2 : 1)]! + vertex; indices[index + i + 2] = item.indices[i + (mirrored ? 1 : 2)]! + vertex;
            }
            vertex += count; index += item.indices.length;
        }
        geometry.setIndex(undefined);
        geometry.setAttribute('position', new Attribute3D(positions, 3));
        geometry.setAttribute('normal', new Attribute3D(normals, 3));
        if (uvs) geometry.setAttribute('uv', new Attribute3D(uvs, 2)); else geometry.removeAttribute('uv');
        if (colors) geometry.setAttribute('color', new Attribute3D(colors, 3)); else geometry.removeAttribute('color');
        geometry.setIndex(indices.length > 0 ? indices : new Uint32Array(3));
        geometry.invalidateBounds();
    }
    override beforeRender(): void { this.flush(); }
    /** Release the combined geometry. The material stays with its owner. */
    dispose(): void { this.geometry.dispose(); }
}

export interface FatLineOptions3D {
    /** Width in world units, or in pixels when `screenSpace` is set. */
    readonly width?: number;
    /** Keep a constant width on screen; set `resolutionHeight` to the output height in pixels. */
    readonly screenSpace?: boolean;
    readonly color?: ColorInput3D;
    /** Join the last point back to the first. */
    readonly closed?: boolean;
}
/**
 * A polyline drawn as a ribbon of triangles that turns to face the camera,
 * so it can be wider than the one pixel that plain lines allow. Give points
 * in the line's local space; call setPoints() to change them.
 */
export class FatLine3D extends Mesh3D {
    width: number;
    screenSpace: boolean;
    /** Output height in pixels, used to convert a pixel width to world units. */
    resolutionHeight = 720;
    closed: boolean;
    #points = new Float32Array(0);
    #count = 0;
    #positions = new Float32Array(0);
    #attribute: Attribute3D | undefined;
    readonly #local = new Float32Array(3);

    constructor(points: ArrayLike<number> | readonly ArrayLike<number>[], options: FatLineOptions3D = {}) {
        const material = new Material3D('unlit', {color: options.color ?? 0xffffff, side: 'double'});
        material.fog = false;
        const geometry = new Geometry3D();
        geometry.setAttribute('position', new Attribute3D(new Float32Array(9), 3));
        super(geometry, material);
        this.width = options.width ?? 0.05; this.screenSpace = options.screenSpace ?? false; this.closed = options.closed ?? false;
        this.castShadow = false; this.receiveShadow = false;
        // The ribbon is rebuilt around the camera each frame, so stale bounds must not cull it.
        this.frustumCulled = false;
        this.name = 'fat-line';
        this.setPoints(points);
    }
    /** Replace the points: a flat [x, y, z, ...] array or a list of [x, y, z]. */
    setPoints(points: ArrayLike<number> | readonly ArrayLike<number>[]): this {
        const flat: number[] = [];
        if (points.length > 0 && typeof (points as ArrayLike<unknown>)[0] === 'number') for (let i = 0; i < points.length; i++) flat.push((points as ArrayLike<number>)[i]!);
        else for (const p of points as readonly ArrayLike<number>[]) flat.push(p[0]!, p[1]!, p[2]!);
        if (flat.length < 6 || flat.length % 3 !== 0 || !flat.every(Number.isFinite)) throw new World3DError('WORLD3D_INPUT_INVALID', 'line points');
        if (flat.length / 3 > BATCH3D_LIMITS.maxLinePoints) throw new World3DError('WORLD3D_BUDGET', 'line points');
        this.#points = Float32Array.from(flat);
        const count = this.#count = flat.length / 3, segments = this.closed ? count : count - 1;
        // Two vertices per point (plus a repeated first pair when closed) and two triangles per segment.
        const pairs = this.closed ? count + 1 : count, indices = new Uint32Array(segments * 6);
        for (let i = 0; i < segments; i++) { const a = i * 2; indices.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6); }
        this.#positions = new Float32Array(pairs * 6);
        const geometry = this.geometry;
        geometry.setIndex(undefined);
        geometry.setAttribute('position', this.#attribute = new Attribute3D(this.#positions, 3));
        geometry.setIndex(indices);
        return this;
    }
    /** Rebuild the ribbon so it faces `camera`. The render list calls this each frame. */
    override beforeRender(camera: Camera3D): void {
        const count = this.#count, points = this.#points, out = this.#positions, attribute = this.#attribute;
        if (count < 2 || !attribute) return;
        // Camera position in the line's local space, so the ribbon can be built there directly.
        const eye = this.worldToLocal(this.#local, [camera.matrixWorld[12]!, camera.matrixWorld[13]!, camera.matrixWorld[14]!]);
        const ex = eye[0]!, ey = eye[1]!, ez = eye[2]!, pairs = this.closed ? count + 1 : count;
        const pixel = this.screenSpace && camera.projectionKind === 'perspective' ? 2 * Math.tan(camera.fov * Math.PI / 360) / (camera.zoom * Math.max(this.resolutionHeight, 1))
            : this.screenSpace ? camera.orthographicHeight / (camera.zoom * Math.max(this.resolutionHeight, 1)) : 0;
        for (let i = 0; i < pairs; i++) {
            const at = (i % count) * 3, x = points[at]!, y = points[at + 1]!, z = points[at + 2]!;
            // Direction of travel: toward the next point, blended with the previous one at joints.
            const wrap = this.closed, previous = (wrap ? (i - 1 + count) % count : Math.max(i - 1, 0)) * 3, next = (wrap ? (i + 1) % count : Math.min(i + 1, count - 1)) * 3;
            // Unit directions into and out of the point; their sum is the miter direction at a joint.
            let ax = x - points[previous]!, ay = y - points[previous + 1]!, az = z - points[previous + 2]!, bx = points[next]! - x, by = points[next + 1]! - y, bz = points[next + 2]! - z;
            const al = Math.hypot(ax, ay, az), bl = Math.hypot(bx, by, bz);
            if (al > 1e-12) { ax /= al; ay /= al; az /= al; }
            if (bl > 1e-12) { bx /= bl; by /= bl; bz /= bl; }
            let dx = ax + bx, dy = ay + by, dz = az + bz;
            const sum = Math.hypot(dx, dy, dz);
            // A hairpin has no usable miter; fall back to the outgoing direction.
            if (sum < 1e-6) { dx = bx; dy = by; dz = bz; }
            // Widen the joint so the ribbon keeps its width on both sides of a corner, within reason.
            const miter = al > 1e-12 && bl > 1e-12 && sum >= 1e-6 ? 1 / Math.max(sum / 2, 0.35) : 1;
            const vx = ex - x, vy = ey - y, vz = ez - z;
            // The ribbon's side vector is perpendicular to both the line and the view direction.
            let sx = dy * vz - dz * vy, sy = dz * vx - dx * vz, sz = dx * vy - dy * vx;
            const length = Math.hypot(sx, sy, sz);
            let half = this.width / 2;
            if (this.screenSpace && camera.projectionKind === 'perspective') {
                // A pixel's size grows with depth along the view axis, not with straight-line distance.
                const m = this.matrixWorld, wx = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!, wy = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!, wz = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
                const view = camera.viewMatrix;
                half *= pixel * Math.max(-(view[2]! * wx + view[6]! * wy + view[10]! * wz + view[14]!), 0);
            } else if (this.screenSpace) half *= pixel;
            half *= miter;
            if (length > 1e-12) { sx *= half / length; sy *= half / length; sz *= half / length; } else { sx = sy = sz = 0; }
            const o = i * 6;
            out[o] = x - sx; out[o + 1] = y - sy; out[o + 2] = z - sz; out[o + 3] = x + sx; out[o + 4] = y + sy; out[o + 5] = z + sz;
        }
        attribute.touch();
    }
    /** Release the line's own geometry and material. */
    dispose(): void { this.geometry.dispose(); (this.material as Material3D).dispose(); }
}
export function createBatchedMesh3D(material: Material3D): BatchedMesh3D { return new BatchedMesh3D(material); }
export function createFatLine3D(points: ArrayLike<number> | readonly ArrayLike<number>[], options: FatLineOptions3D = {}): FatLine3D { return new FatLine3D(points, options); }
