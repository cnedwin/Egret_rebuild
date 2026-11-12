// SPDX-License-Identifier: Apache-2.0
// Height-map terrain: a grid of heights that answers gameplay queries, a
// chunked mesh whose pieces drop detail with distance, and a collision shape
// built from the same triangles. DOM-free; decode images in the host and pass
// the pixels in.
import {World3DError, requireCount3D, requireFinite3D, requirePositive3D} from './core3D.js';
import {Attribute3D, Geometry3D} from './Geometry3D.js';
import {type Material3D, type StandardMaterialOptions3D, createStandardMaterial3D} from './Material3D.js';
import {DECAL3D_LIMITS, type DecalOptions3D, createDecalGeometry3D} from './Decal3D.js';
import {mat4Invert, vec3TransformMat4} from './math3D.js';
import type {Texture3D} from './Texture3D.js';
import {Mesh3D} from './Mesh3D.js';
import {Object3D} from './Object3D.js';
import {TriangleMeshShape3D} from './PhysicsMesh3D.js';
import type {Camera3D} from './Camera3D.js';

export const TERRAIN3D_LIMITS = Object.freeze({
    maxSamplesPerSide: 4097, maxChunkCells: 254, maxLevels: 8, maxChunks: 4096, maxCachedGeometryBytes: 128 * 1024 * 1024,
    maxStreamTiles: 256, maxStreamPending: 32,
} as const);

export interface HeightFieldOptions3D {
    /** Samples along X and along Z; a field of n samples has n - 1 cells. */
    readonly columns: number;
    readonly rows: number;
    /** World size along X and Z. The field is centered on its origin. */
    readonly width: number;
    readonly depth: number;
    /** Row-major heights, `rows * columns` values starting at the -X, -Z corner. */
    readonly heights?: ArrayLike<number>;
    /** Called for each sample with its local x and z when `heights` is absent. */
    readonly sample?: (x: number, z: number) => number;
}

/**
 * Heights on a regular grid in the XZ plane. Every cell is split into two
 * triangles along the same diagonal, and `heightAt` follows those triangles
 * exactly, so an object placed with it sits on the full-detail mesh and on the
 * collision shape alike.
 */
export class HeightField3D {
    readonly columns: number;
    readonly rows: number;
    readonly width: number;
    readonly depth: number;
    readonly heights: Float32Array;
    /** Increases on refresh(); terrains rebuild their meshes when it changes. */
    version = 1;
    #min = 0;
    #max = 0;

    constructor(options: HeightFieldOptions3D) {
        if (!options) throw new World3DError('WORLD3D_INPUT_INVALID', 'height field options');
        this.columns = requireCount3D(options.columns, 'columns', TERRAIN3D_LIMITS.maxSamplesPerSide);
        this.rows = requireCount3D(options.rows, 'rows', TERRAIN3D_LIMITS.maxSamplesPerSide);
        if (this.columns < 2 || this.rows < 2) throw new World3DError('WORLD3D_INPUT_INVALID', 'a height field needs at least 2 x 2 samples');
        this.width = requirePositive3D(options.width, 'width');
        this.depth = requirePositive3D(options.depth, 'depth');
        const count = this.columns * this.rows;
        this.heights = new Float32Array(count);
        if (options.heights !== undefined) {
            if (options.heights.length !== count) throw new World3DError('WORLD3D_INPUT_INVALID', 'heights length');
            for (let i = 0; i < count; i++) this.heights[i] = requireFinite3D(options.heights[i], 'heights');
        } else if (options.sample !== undefined) {
            for (let row = 0; row < this.rows; row++) {
                for (let column = 0; column < this.columns; column++) this.heights[row * this.columns + column] = requireFinite3D(options.sample(this.columnX(column), this.rowZ(row)), 'sample');
            }
        }
        this.refresh();
    }
    get minHeight(): number { return this.#min; }
    get maxHeight(): number { return this.#max; }
    get cellWidth(): number { return this.width / (this.columns - 1); }
    get cellDepth(): number { return this.depth / (this.rows - 1); }
    /** Local x of a sample column and local z of a sample row. */
    columnX(column: number): number { return column / (this.columns - 1) * this.width - this.width / 2; }
    rowZ(row: number): number { return row / (this.rows - 1) * this.depth - this.depth / 2; }
    /** Height stored at a sample; indices are clamped to the grid. */
    sampleAt(column: number, row: number): number {
        const c = column < 0 ? 0 : column >= this.columns ? this.columns - 1 : column | 0, r = row < 0 ? 0 : row >= this.rows ? this.rows - 1 : row | 0;
        return this.heights[r * this.columns + c]!;
    }
    /** Call after writing to `heights`: recomputes the range and bumps the version. */
    refresh(): void {
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < this.heights.length; i++) {
            const h = this.heights[i]!;
            if (!Number.isFinite(h)) throw new World3DError('WORLD3D_INPUT_INVALID', 'heights');
            if (h < min) min = h;
            if (h > max) max = h;
        }
        this.#min = min; this.#max = max;
        this.version++;
    }
    /** True when the local point lies over the grid. */
    contains(x: number, z: number): boolean {
        return Math.abs(x) <= this.width / 2 && Math.abs(z) <= this.depth / 2;
    }
    /** Surface height under a local point; points outside the grid use the nearest edge. */
    heightAt(x: number, z: number): number {
        const columns = this.columns, h = this.heights;
        let gx = (x / this.width + 0.5) * (columns - 1), gz = (z / this.depth + 0.5) * (this.rows - 1);
        gx = gx < 0 ? 0 : gx > columns - 1 ? columns - 1 : gx; gz = gz < 0 ? 0 : gz > this.rows - 1 ? this.rows - 1 : gz;
        const c = Math.min(gx | 0, columns - 2), r = Math.min(gz | 0, this.rows - 2), fx = gx - c, fz = gz - r, at = r * columns + c;
        const a = h[at]!, b = h[at + 1]!, d = h[at + columns]!, e = h[at + columns + 1]!;
        // The cell's diagonal runs from the +X corner to the +Z corner.
        return fx + fz <= 1 ? a + (b - a) * fx + (d - a) * fz : e + (d - e) * (1 - fx) + (b - e) * (1 - fz);
    }
    /** Smoothed unit surface normal at a local point, from the neighbouring samples. */
    normalAt(x: number, z: number, out: number[] | Float32Array = [0, 0, 0]): number[] | Float32Array {
        const dx = this.cellWidth, dz = this.cellDepth;
        const nx = (this.heightAt(x - dx, z) - this.heightAt(x + dx, z)) / (2 * dx), nz = (this.heightAt(x, z - dz) - this.heightAt(x, z + dz)) / (2 * dz), length = Math.hypot(nx, 1, nz);
        out[0] = nx / length; out[1] = 1 / length; out[2] = nz / length;
        return out;
    }
    /**
     * Distance along a unit local ray to where it first drops below the
     * surface, or -1 within `limit`. The ray is walked in half-cell steps and
     * the crossing refined, so features thinner than a cell can be skipped.
     */
    raycast(origin: ArrayLike<number>, direction: ArrayLike<number>, limit = Infinity): number {
        const ox = origin[0]!, oy = origin[1]!, oz = origin[2]!, dx = direction[0]!, dy = direction[1]!, dz = direction[2]!;
        const hx = this.width / 2, hz = this.depth / 2;
        // Clip the ray to the slab that holds the terrain.
        let near = 0, far = limit;
        const clip = (o: number, d: number, low: number, high: number): boolean => {
            if (Math.abs(d) < 1e-12) return o >= low && o <= high;
            let t0 = (low - o) / d, t1 = (high - o) / d;
            if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
            if (t0 > near) near = t0;
            if (t1 < far) far = t1;
            return near <= far;
        };
        if (!clip(ox, dx, -hx, hx) || !clip(oz, dz, -hz, hz) || !clip(oy, dy, this.#min - 1e-3, Infinity)) return -1;
        if (!Number.isFinite(far)) return -1;
        const step = Math.min(this.cellWidth, this.cellDepth) * 0.5;
        let previous = near;
        if (oy + dy * near < this.heightAt(ox + dx * near, oz + dz * near)) return near > 0 ? near : -1;
        for (let t = near + step; ; t += step) {
            const at = Math.min(t, far);
            if (oy + dy * at <= this.heightAt(ox + dx * at, oz + dz * at)) {
                let low = previous, high = at;
                for (let i = 0; i < 24; i++) {
                    const middle = (low + high) / 2;
                    if (oy + dy * middle <= this.heightAt(ox + dx * middle, oz + dz * middle)) high = middle; else low = middle;
                }
                return high;
            }
            if (at >= far) return -1;
            previous = at;
        }
    }
    /**
     * Collision shape for a static physics body placed at the terrain's
     * origin: the full-detail triangles, indexed by a bounding-volume
     * hierarchy so bodies only test the ground near them.
     */
    createShape(): {readonly type: 'mesh'; readonly mesh: TriangleMeshShape3D} {
        const columns = this.columns, rows = this.rows, positions = new Float32Array(columns * rows * 3), indices = new Uint32Array((columns - 1) * (rows - 1) * 6);
        for (let row = 0, at = 0; row < rows; row++) {
            for (let column = 0; column < columns; column++) { positions[at++] = this.columnX(column); positions[at++] = this.heights[row * columns + column]!; positions[at++] = this.rowZ(row); }
        }
        for (let row = 0, at = 0; row < rows - 1; row++) {
            for (let column = 0; column < columns - 1; column++) {
                const a = row * columns + column, b = a + 1, d = a + columns, e = d + 1;
                indices[at++] = a; indices[at++] = d; indices[at++] = b; indices[at++] = b; indices[at++] = d; indices[at++] = e;
            }
        }
        return {type: 'mesh', mesh: new TriangleMeshShape3D(positions, indices)};
    }
}
export function createHeightField3D(options: HeightFieldOptions3D): HeightField3D { return new HeightField3D(options); }

export interface HeightImageOptions3D {
    readonly width: number;
    readonly depth: number;
    /** Heights the darkest and the brightest pixel map to. Defaults: 0 and 1. */
    readonly minHeight?: number;
    readonly maxHeight?: number;
    /** `red` reads 8 bits from the red channel; `rg16` reads 16 bits with red as the high byte. */
    readonly encoding?: 'red' | 'rg16';
}
/** Height field with one sample per pixel of a decoded RGBA image; the image's top row is the -Z edge. */
export function createHeightFieldFromPixels3D(pixels: {readonly width: number; readonly height: number; readonly data: ArrayLike<number>}, options: HeightImageOptions3D): HeightField3D {
    if (!pixels || !pixels.data || pixels.data.length !== pixels.width * pixels.height * 4) throw new World3DError('WORLD3D_INPUT_INVALID', 'height image pixels');
    const low = requireFinite3D(options.minHeight ?? 0, 'minHeight'), high = requireFinite3D(options.maxHeight ?? 1, 'maxHeight'), wide = options.encoding === 'rg16';
    if (options.encoding !== undefined && options.encoding !== 'red' && !wide) throw new World3DError('WORLD3D_INPUT_INVALID', 'height image encoding');
    const count = pixels.width * pixels.height, heights = new Float32Array(count), data = pixels.data;
    for (let i = 0; i < count; i++) heights[i] = low + (high - low) * (wide ? (data[i * 4]! * 256 + data[i * 4 + 1]!) / 65535 : data[i * 4]! / 255);
    return new HeightField3D({columns: pixels.width, rows: pixels.height, width: options.width, depth: options.depth, heights});
}

export interface TerrainOptions3D {
    /** Cells along each side of a chunk. Default 32. */
    readonly chunkCells?: number;
    /** Number of detail levels; each halves the one before. Default 4. */
    readonly levels?: number;
    /** Distance from the camera to a chunk at which the first coarser level takes over; each further level doubles it. Default: two chunk widths. */
    readonly lodDistance?: number;
    /** How far the border strips that hide gaps between levels hang down. Default: 2% of the larger side. */
    readonly skirtDepth?: number;
    /** Texture repeats across the whole terrain. Default 1. */
    readonly uvScale?: number;
    /**
     * Writes a linear RGB vertex color for a sample; enable `vertexColors` on
     * the material to see it. `slope` is 0 on flat ground and 1 on a vertical face.
     */
    readonly colorAt?: (height: number, slope: number, x: number, z: number, out: number[]) => void;
}

function chunkBufferLayout(nx: number, nz: number, skirts: boolean) {
    const vertexCount = nx * nz + (skirts ? 2 * (nx + nz) : 0);
    const indexCount = 6 * ((nx - 1) * (nz - 1) + (skirts ? 2 * (nx + nz - 2) : 0));
    return {vertexCount, indexCount, indexBytes: vertexCount > 65535 ? 4 : 2};
}

interface Chunk {
    readonly mesh: Mesh3D;
    readonly column: number; readonly row: number; readonly columns: number; readonly rows: number;
    readonly geometries: (Geometry3D | undefined)[];
    level: number;
}

/**
 * A height field drawn as a grid of chunk meshes. Before each frame every
 * chunk picks a detail level from its distance to the camera; neighbouring
 * chunks at different levels are sealed by skirts hanging from their borders.
 * Normals always come from the full-detail field, so lighting does not shift
 * when a chunk changes level.
 */
export class Terrain3D extends Object3D {
    readonly field: HeightField3D;
    readonly chunkCells: number;
    readonly levels: number;
    lodDistance: number;
    /** Added to every chunk's level: raise it to lower the detail of the whole terrain. */
    lodBias = 0;
    readonly #chunks: Chunk[] = [];
    readonly #decalGeometries = new WeakMap<Object3D, Geometry3D>();
    readonly #skirt: number;
    readonly #uvScale: number;
    readonly #colorAt: TerrainOptions3D['colorAt'];
    #fieldVersion: number;
    #material: Material3D;

    constructor(field: HeightField3D, material: Material3D, options: TerrainOptions3D = {}) {
        super();
        if (!(field instanceof HeightField3D)) throw new World3DError('WORLD3D_INPUT_INVALID', 'terrain field');
        this.field = field;
        this.#material = material;
        this.chunkCells = requireCount3D(options.chunkCells ?? 32, 'chunkCells', TERRAIN3D_LIMITS.maxChunkCells);
        this.levels = requireCount3D(options.levels ?? 4, 'levels', TERRAIN3D_LIMITS.maxLevels);
        if (this.chunkCells < 1 || this.levels < 1) throw new World3DError('WORLD3D_INPUT_INVALID', 'terrain chunks and levels');
        this.lodDistance = requirePositive3D(options.lodDistance ?? Math.max(field.cellWidth, field.cellDepth) * this.chunkCells * 2, 'lodDistance');
        this.#skirt = options.skirtDepth === undefined ? Math.max(field.width, field.depth) * 0.02 : requireFinite3D(options.skirtDepth, 'skirtDepth');
        if (this.#skirt < 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'skirtDepth');
        this.#uvScale = requirePositive3D(options.uvScale ?? 1, 'uvScale');
        this.#colorAt = options.colorAt;
        this.checkGeometryBudget();
        this.#fieldVersion = field.version;
        for (let row = 0; row < field.rows - 1; row += this.chunkCells) {
            for (let column = 0; column < field.columns - 1; column += this.chunkCells) {
                const mesh = new Mesh3D(new Geometry3D(), material);
                const chunk: Chunk = {mesh, column, row, columns: Math.min(this.chunkCells, field.columns - 1 - column), rows: Math.min(this.chunkCells, field.rows - 1 - row), geometries: [], level: -1};
                mesh.name = 'terrain-chunk';
                mesh.beforeRender = (camera: Camera3D) => this.select(chunk, camera);
                this.#chunks.push(chunk);
                this.addChild(mesh);
                this.use(chunk, this.levels - 1);
            }
        }
    }
    get material(): Material3D { return this.#material; }
    set material(value: Material3D) { this.#material = value; for (const chunk of this.#chunks) chunk.mesh.material = value; }
    get chunkCount(): number { return this.#chunks.length; }
    /** Detail level each chunk is currently drawn at, in row-major chunk order. */
    get chunkLevels(): number[] { return this.#chunks.map((chunk) => chunk.level); }
    /** Triangles in the levels the chunks currently use. */
    get triangleCount(): number { let total = 0; for (const chunk of this.#chunks) total += chunk.mesh.geometry.drawCount / 3; return total; }
    /** Set shadow casting and receiving on every chunk. */
    setShadows(cast: boolean, receive: boolean): this { for (const chunk of this.#chunks) { chunk.mesh.castShadow = cast; chunk.mesh.receiveShadow = receive; } return this; }
    /**
     * Choose every chunk's level for a camera now. Rendering does this by
     * itself; call it when you read `chunkLevels` or `triangleCount` first.
     */
    update(camera: Camera3D): void {
        this.updateWorldMatrices();
        for (const chunk of this.#chunks) this.select(chunk, camera);
    }
    /** Rebuild the meshes after the field's heights changed and `field.refresh()` ran. Rendering checks this by itself. */
    rebuild(): void {
        this.#fieldVersion = this.field.version;
        for (const chunk of this.#chunks) {
            for (const geometry of chunk.geometries) geometry?.dispose();
            chunk.geometries.length = 0;
            const level = chunk.level < 0 ? this.levels - 1 : chunk.level;
            chunk.level = -1;
            this.use(chunk, level);
        }
    }
    /**
     * Lay a decal on the terrain. It is cut from the full-detail heights, not
     * from whichever level a chunk happens to show, so it stays put when the
     * levels change; far away, where chunks are coarse, it can sink slightly
     * into them. Attached decal geometry is released with the terrain; a
     * reparented decal belongs to the caller. Returns undefined when the box misses the ground.
     */
    createDecal(material: Material3D, options: DecalOptions3D): Mesh3D | undefined {
        const field = this.field, inverse = new Float64Array(16), local = [0, 0, 0];
        this.updateWorldMatrix();
        if (!mat4Invert(inverse, this.matrixWorld)) throw new World3DError('WORLD3D_INPUT_INVALID', 'singular world matrix');
        const position = options.position;
        vec3TransformMat4(local, [
            requireFinite3D(position[0], 'position'), requireFinite3D(position[1], 'position'), requireFinite3D(position[2], 'position'),
        ], inverse);
        const width = requirePositive3D(options.width ?? 1, 'width'), height = requirePositive3D(options.height ?? 1, 'height');
        const depth = requirePositive3D(options.depth ?? Math.max(width, height) / 2, 'depth');
        // The world-space sphere encloses the rotated decal box. Project it onto local X and Z.
        const reach = Math.hypot(width, height, depth) / 2;
        const reachX = reach * Math.hypot(inverse[0]!, inverse[4]!, inverse[8]!);
        const reachZ = reach * Math.hypot(inverse[2]!, inverse[6]!, inverse[10]!);
        const toColumn = (x: number): number => (x / field.width + 0.5) * (field.columns - 1), toRow = (z: number): number => (z / field.depth + 0.5) * (field.rows - 1);
        const c0 = Math.max(0, Math.floor(toColumn(local[0]! - reachX))), c1 = Math.min(field.columns - 1, Math.ceil(toColumn(local[0]! + reachX)));
        const r0 = Math.max(0, Math.floor(toRow(local[2]! - reachZ))), r1 = Math.min(field.rows - 1, Math.ceil(toRow(local[2]! + reachZ)));
        if (c1 <= c0 || r1 <= r0) return undefined;
        const triangleCount = 2 * (c1 - c0) * (r1 - r0);
        if (triangleCount > DECAL3D_LIMITS.maxTriangles) throw new World3DError('WORLD3D_BUDGET', 'terrain decal patch triangles');
        // The bounded full-detail ground patch supplies the triangles for the exact decal clip.
        const nx = c1 - c0 + 1, nz = r1 - r0 + 1, positions = new Float32Array(nx * nz * 3), normals = new Float32Array(nx * nz * 3);
        const indices = new Uint32Array(triangleCount * 3), normal = [0, 0, 0];
        for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
            const o = (iz * nx + ix) * 3, x = field.columnX(c0 + ix), z = field.rowZ(r0 + iz);
            positions[o] = x; positions[o + 1] = field.heights[(r0 + iz) * field.columns + c0 + ix]!; positions[o + 2] = z;
            field.normalAt(x, z, normal); normals[o] = normal[0]!; normals[o + 1] = normal[1]!; normals[o + 2] = normal[2]!;
        }
        let at = 0;
        for (let iz = 0; iz < nz - 1; iz++) for (let ix = 0; ix < nx - 1; ix++) {
            const a = iz * nx + ix, b = a + 1, d = a + nx, e = d + 1;
            indices[at++] = a; indices[at++] = d; indices[at++] = b;
            indices[at++] = b; indices[at++] = d; indices[at++] = e;
        }
        const patch = new Geometry3D();
        patch.setAttribute('position', new Attribute3D(positions, 3)); patch.setAttribute('normal', new Attribute3D(normals, 3)); patch.setIndex(indices);
        const source = new Mesh3D(patch, material);
        this.addChild(source);
        let geometry: Geometry3D | undefined;
        try { geometry = createDecalGeometry3D(source, {offset: 0.03, ...options}); }
        finally { source.removeFromParent(); patch.dispose(); }
        if (!geometry) return undefined;
        material.depthWrite = false;
        material.polygonOffset ??= [-4, -8];
        const decal = new Mesh3D(geometry, material);
        decal.name = 'decal'; decal.castShadow = false; decal.receiveShadow = true;
        this.addChild(decal);
        this.#decalGeometries.set(decal, geometry);
        return decal;
    }
    /** Release chunk geometry and attached factory decals. Materials and the field stay with the caller. */
    dispose(): void {
        const failures: unknown[] = [];
        for (const chunk of this.#chunks.splice(0)) {
            chunk.mesh.removeFromParent();
            for (const geometry of chunk.geometries.splice(0)) {
                try { geometry?.dispose(); }
                catch (cause) { failures.push(cause); }
            }
        }
        for (const child of [...this.children]) {
            if (child.parent !== this) continue;
            const geometry = this.#decalGeometries.get(child);
            if (!geometry) continue;
            this.#decalGeometries.delete(child);
            child.removeFromParent();
            try { geometry.dispose(); }
            catch (cause) { failures.push(cause); }
        }
        if (failures.length === 1) throw failures[0];
        if (failures.length > 1) throw new AggregateError(failures, 'WORLD3D_TERRAIN_DISPOSE_FAILED');
    }
    private checkGeometryBudget(): void {
        const columns = this.field.columns - 1, rows = this.field.rows - 1, chunkCells = this.chunkCells;
        if (Math.ceil(columns / chunkCells) * Math.ceil(rows / chunkCells) > TERRAIN3D_LIMITS.maxChunks) {
            throw new World3DError('WORLD3D_BUDGET', 'terrain chunk count');
        }
        // Every LOD may remain cached. Count all retained attribute and index bytes before building any mesh.
        const bytesPerVertex = (this.#colorAt ? 11 : 8) * Float32Array.BYTES_PER_ELEMENT;
        const skirts = this.#skirt > 0;
        let bytes = 0;
        for (let row = 0; row < rows; row += chunkCells) {
            for (let column = 0; column < columns; column += chunkCells) {
                const width = Math.min(chunkCells, columns - column), depth = Math.min(chunkCells, rows - row);
                for (let level = 0; level < this.levels; level++) {
                    const stride = 1 << level;
                    const {vertexCount, indexCount, indexBytes} = chunkBufferLayout(
                        Math.ceil(width / stride) + 1, Math.ceil(depth / stride) + 1, skirts,
                    );
                    bytes += vertexCount * bytesPerVertex + indexCount * indexBytes;
                    if (bytes > TERRAIN3D_LIMITS.maxCachedGeometryBytes) {
                        throw new World3DError('WORLD3D_BUDGET', 'terrain cached geometry bytes');
                    }
                }
            }
        }
    }
    private select(chunk: Chunk, camera: Camera3D): void {
        if (this.#fieldVersion !== this.field.version) this.rebuild();
        const sphere = chunk.mesh.worldBoundingSphere, eye = camera.matrixWorld;
        const distance = Math.hypot(eye[12]! - sphere[0]!, eye[13]! - sphere[1]!, eye[14]! - sphere[2]!) - sphere[3]!;
        let level = distance <= this.lodDistance ? 0 : Math.floor(Math.log2(distance / this.lodDistance)) + 1;
        level = Math.max(0, Math.min(this.levels - 1, level + this.lodBias));
        if (level !== chunk.level) this.use(chunk, level);
    }
    private use(chunk: Chunk, level: number): void {
        chunk.mesh.geometry = chunk.geometries[level] ??= this.build(chunk, level);
        chunk.level = level;
    }
    private build(chunk: Chunk, level: number): Geometry3D {
        const field = this.field, stride = 1 << level;
        // Sample lines of this level; the last one always lands on the chunk's edge.
        const line = (start: number, cells: number): number[] => {
            const out: number[] = [];
            for (let i = 0; i < cells; i += stride) out.push(start + i);
            out.push(start + cells);
            return out;
        };
        const xs = line(chunk.column, chunk.columns), zs = line(chunk.row, chunk.rows), nx = xs.length, nz = zs.length;
        const skirts = this.#skirt > 0;
        const {vertexCount, indexCount, indexBytes} = chunkBufferLayout(nx, nz, skirts);
        const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), uvs = new Float32Array(vertexCount * 2);
        const colors = this.#colorAt ? new Float32Array(vertexCount * 3) : undefined, normal = [0, 0, 0], color = [1, 1, 1];
        const write = (to: number, column: number, row: number, drop: number): void => {
            const x = field.columnX(column), z = field.rowZ(row), y = field.heights[row * field.columns + column]!;
            field.normalAt(x, z, normal);
            positions[to * 3] = x; positions[to * 3 + 1] = y - drop; positions[to * 3 + 2] = z;
            normals[to * 3] = normal[0]!; normals[to * 3 + 1] = normal[1]!; normals[to * 3 + 2] = normal[2]!;
            uvs[to * 2] = column / (field.columns - 1) * this.#uvScale; uvs[to * 2 + 1] = row / (field.rows - 1) * this.#uvScale;
            if (colors) {
                color[0] = color[1] = color[2] = 1;
                this.#colorAt!(y, 1 - normal[1]!, x, z, color);
                colors[to * 3] = color[0]!; colors[to * 3 + 1] = color[1]!; colors[to * 3 + 2] = color[2]!;
            }
        };
        for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) write(iz * nx + ix, xs[ix]!, zs[iz]!, 0);
        const indices = indexBytes === 4 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
        let at = 0;
        const quad = (a: number, b: number, c: number, d: number, e: number, f: number): void => {
            indices[at++] = a; indices[at++] = b; indices[at++] = c;
            indices[at++] = d; indices[at++] = e; indices[at++] = f;
        };
        for (let iz = 0; iz < nz - 1; iz++) {
            for (let ix = 0; ix < nx - 1; ix++) {
                const a = iz * nx + ix, b = a + 1, d = a + nx, e = d + 1;
                quad(a, d, b, b, d, e);
            }
        }
        if (skirts) {
            // Each border gets a strip hanging down; `flip` keeps its face pointing outward.
            let next = nx * nz;
            const side = (length: number, top: (i: number) => number, column: (i: number) => number, row: (i: number) => number, flip: boolean): void => {
                const first = next;
                for (let i = 0; i < length; i++) write(next++, column(i), row(i), this.#skirt);
                for (let i = 0; i < length - 1; i++) {
                    const t0 = top(i), t1 = top(i + 1), b0 = first + i, b1 = b0 + 1;
                    if (flip) quad(t0, t1, b0, t1, b1, b0); else quad(t0, b0, t1, t1, b0, b1);
                }
            };
            side(nx, (i) => i, (i) => xs[i]!, () => zs[0]!, true);
            side(nx, (i) => (nz - 1) * nx + i, (i) => xs[i]!, () => zs[nz - 1]!, false);
            side(nz, (i) => i * nx, () => xs[0]!, (i) => zs[i]!, false);
            side(nz, (i) => i * nx + nx - 1, () => xs[nx - 1]!, (i) => zs[i]!, true);
        }
        const geometry = new Geometry3D();
        geometry.setAttribute('position', new Attribute3D(positions, 3));
        geometry.setAttribute('normal', new Attribute3D(normals, 3));
        geometry.setAttribute('uv', new Attribute3D(uvs, 2));
        if (colors) geometry.setAttribute('color', new Attribute3D(colors, 3));
        geometry.setIndex(indices);
        return geometry;
    }
}
export function createTerrain3D(field: HeightField3D, material: Material3D, options: TerrainOptions3D = {}): Terrain3D { return new Terrain3D(field, material, options); }

export interface TerrainMaterialOptions3D extends StandardMaterialOptions3D {
    /** One to four tiling ground textures. */
    readonly layers: readonly Texture3D[];
    /** Where each layer shows: its R, G, B and A channels weigh layers 0 to 3 across the whole terrain. */
    readonly weights: Texture3D;
    /** How often each layer repeats across the terrain. Default 32 each. */
    readonly repeat?: number | readonly number[];
}
/**
 * A standard material whose color is a blend of ground textures, such as
 * sand, grass, rock and snow, painted by a weight map. Use it on a terrain
 * with `uvScale` 1 so the weight map covers the terrain once.
 */
export function createTerrainMaterial3D(options: TerrainMaterialOptions3D): Material3D {
    if (!options || !Array.isArray(options.layers) || options.layers.length < 1 || options.layers.length > 4 || !options.weights) throw new World3DError('WORLD3D_INPUT_INVALID', 'terrain layers');
    const repeat = [0, 1, 2, 3].map((i) => requirePositive3D(typeof options.repeat === 'number' ? options.repeat : options.repeat?.[i] ?? 32, 'repeat'));
    const material = createStandardMaterial3D({roughness: 0.95, ...options});
    material.splat = Object.freeze({weights: options.weights, layers: Object.freeze([...options.layers]), repeat: Object.freeze(repeat)});
    return material;
}

export interface TerrainTile3D {
    readonly x: number;
    readonly z: number;
    readonly field: HeightField3D;
    readonly terrain: Terrain3D;
}
export interface TerrainStreamOptions3D {
    /** World size of one square tile. Tile (x, z) covers x * size to (x + 1) * size on each axis. */
    readonly tileSize: number;
    /** Tiles whose nearest point is within this distance of the viewer are kept loaded. */
    readonly viewDistance: number;
    /**
     * Supplies the heights of a tile, now or later, as a field `tileSize`
     * wide and deep; undefined leaves the tile empty. Neighbouring tiles
     * should share the samples along their common edge.
     */
    readonly load: (x: number, z: number) => HeightField3D | undefined | Promise<HeightField3D | undefined>;
    readonly material: Material3D | ((x: number, z: number, field: HeightField3D) => Material3D);
    readonly terrain?: TerrainOptions3D;
    /** Tiles requested per update, nearest first. Default 2. */
    readonly loadsPerUpdate?: number;
    /** Called when a tile has been added to or removed from the scene, as for creating and removing its collision body. */
    readonly onLoad?: (tile: TerrainTile3D) => void;
    readonly onUnload?: (tile: TerrainTile3D) => void;
}

/**
 * Terrain that comes and goes around the viewer: a grid of tiles, each its
 * own height field and Terrain3D, requested as the viewer approaches and
 * released once it has moved away. Where the heights come from is up to
 * `load`: a file, a server or a formula. Call `update(x, z)` with the
 * viewer's position each frame.
 */
interface TerrainStreamRequest3D {
    readonly x: number;
    readonly z: number;
}
type TerrainStreamFailure3D = Readonly<{
    x: number;
    z: number;
    phase: 'load' | 'prepare' | 'onLoad' | 'dispose' | 'onUnload';
    cause: unknown;
}>;

export class TerrainStream3D extends Object3D {
    readonly tileSize: number;
    viewDistance: number;
    readonly #options: TerrainStreamOptions3D;
    readonly #loadsPerUpdate: number;
    readonly #tiles = new Map<string, TerrainTile3D>();
    // Each request owns its key until it leaves retention or is published.
    readonly #requests = new Map<string, TerrainStreamRequest3D>();
    #outstanding = 0;
    #disposed = false;
    #updating = false;
    #lastFailure: TerrainStreamFailure3D | undefined;

    constructor(options: TerrainStreamOptions3D) {
        super();
        if (!options || typeof options.load !== 'function' || !options.material) throw new World3DError('WORLD3D_INPUT_INVALID', 'terrain stream options');
        this.tileSize = requirePositive3D(options.tileSize, 'tileSize');
        if (!Number.isFinite(Math.fround(this.tileSize))) throw new World3DError('WORLD3D_BUDGET', 'terrain tile size');
        this.viewDistance = requirePositive3D(options.viewDistance, 'viewDistance');
        this.#loadsPerUpdate = requireCount3D(options.loadsPerUpdate ?? 2, 'loadsPerUpdate', TERRAIN3D_LIMITS.maxStreamPending);
        if (this.#loadsPerUpdate === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'loadsPerUpdate');
        this.#options = options;
    }
    get tiles(): readonly TerrainTile3D[] { return [...this.#tiles.values()]; }
    /** Outstanding loader calls, including retired requests that have yet to settle. */
    get pendingCount(): number { return this.#outstanding; }
    /** Most recent failure in a loader, tile preparation, or lifecycle callback. */
    get lastFailure(): TerrainStreamFailure3D | undefined { return this.#lastFailure; }
    tileAt(x: number, z: number): TerrainTile3D | undefined { return this.#tiles.get(Math.floor(x / this.tileSize) + ',' + Math.floor(z / this.tileSize)); }
    /** Ground height at a world point of this node's space, or undefined where no tile is loaded. */
    heightAt(x: number, z: number): number | undefined {
        const tile = this.tileAt(x, z);
        return tile ? tile.field.heightAt(x - (tile.x + 0.5) * this.tileSize, z - (tile.z + 0.5) * this.tileSize) : undefined;
    }
    /** Request the tiles near a position and release those that fell out of range. */
    update(x: number, z: number): void {
        if (this.#disposed) throw new World3DError('WORLD3D_DISPOSED', 'terrain stream');
        if (this.#updating) throw new World3DError('WORLD3D_INPUT_INVALID', 'terrain stream update is reentrant');
        requireFinite3D(x, 'viewer x');
        requireFinite3D(z, 'viewer z');
        const size = this.tileSize, reach = requirePositive3D(this.viewDistance, 'viewDistance');
        const retention = reach * 1.25 + size * 0.25;
        const minX = Math.floor((x - retention) / size), maxX = Math.floor((x + retention) / size);
        const minZ = Math.floor((z - retention) / size), maxZ = Math.floor((z + retention) / size);
        const bounds = [minX, maxX, minZ, maxZ];
        if (!bounds.every(value => Number.isSafeInteger(value) && Number.isFinite(Math.fround((value + 0.5) * size)))
            || (maxX - minX + 1) * (maxZ - minZ + 1) > TERRAIN3D_LIMITS.maxStreamTiles) {
            throw new World3DError('WORLD3D_BUDGET', 'terrain stream tile range');
        }
        const near = (tx: number, tz: number): number => Math.hypot(
            Math.max(tx * size - x, 0, x - (tx + 1) * size), Math.max(tz * size - z, 0, z - (tz + 1) * size),
        );

        this.#updating = true;
        try {
            for (const [key, tile] of this.#tiles) if (near(tile.x, tile.z) > retention) this.release(key, tile);
            for (const [key, request] of this.#requests) if (near(request.x, request.z) > retention) this.#requests.delete(key);
            const budget = Math.min(this.#loadsPerUpdate, TERRAIN3D_LIMITS.maxStreamPending - this.#outstanding);
            if (budget <= 0 || this.#disposed) return;
            const wanted: {x: number; z: number; distance: number}[] = [];
            for (let tz = Math.floor((z - reach) / size); tz <= Math.floor((z + reach) / size); tz++) {
                for (let tx = Math.floor((x - reach) / size); tx <= Math.floor((x + reach) / size); tx++) {
                    const key = tx + ',' + tz, distance = near(tx, tz);
                    if (distance <= reach && !this.#tiles.has(key) && !this.#requests.has(key)) wanted.push({x: tx, z: tz, distance});
                }
            }
            wanted.sort((a, b) => a.distance - b.distance);
            for (const want of wanted.slice(0, budget)) {
                if (this.#disposed) break;
                this.request(want.x, want.z);
            }
        } finally { this.#updating = false; }
    }
    /** Retire the stream and release all tile geometry. Outstanding loads cannot publish. */
    dispose(): void {
        if (this.#disposed) return;
        this.#disposed = true;
        this.#requests.clear();
        for (const [key, tile] of this.#tiles) this.release(key, tile);
    }
    private request(x: number, z: number): void {
        const key = x + ',' + z, request: TerrainStreamRequest3D = {x, z};
        this.#requests.set(key, request);
        this.#outstanding++;
        const current = (): boolean => this.#requests.get(key) === request;
        const reject = (cause: unknown): void => {
            this.#outstanding--;
            if (!current()) return;
            this.recordFailure(request, 'load', cause);
        };
        const accept = (field: HeightField3D | undefined): void => {
            let staged: Terrain3D | undefined;
            try {
                if (!current()) return;
                    if (field === undefined) return;
                if (!(field instanceof HeightField3D) || field.width !== this.tileSize || field.depth !== this.tileSize) {
                    throw new World3DError('WORLD3D_INPUT_INVALID', 'terrain tile field size');
                }
                const material = typeof this.#options.material === 'function' ? this.#options.material(x, z, field) : this.#options.material;
                if (!current()) return;
                const terrain = new Terrain3D(field, material, this.#options.terrain);
                staged = terrain;
                if (!current()) return;
                terrain.setPosition((x + 0.5) * this.tileSize, 0, (z + 0.5) * this.tileSize);
                this.addChild(terrain);
                const tile: TerrainTile3D = Object.freeze({x, z, field, terrain});
                this.#tiles.set(key, tile);
                this.#requests.delete(key);
                staged = undefined;
                try { this.#options.onLoad?.(tile); }
                catch (cause) { this.recordFailure(tile, 'onLoad', cause); }
            } catch (cause) {
                if (current()) this.recordFailure(request, 'prepare', cause);
            } finally {
                this.#outstanding--;
                if (staged) {
                    try { staged.dispose(); }
                    catch (cause) { this.recordFailure(request, 'dispose', cause); }
                }
            }
        };
        let result: HeightField3D | undefined | Promise<HeightField3D | undefined>;
        try { result = this.#options.load(x, z); }
        catch (cause) { reject(cause); return; }
        if (result === undefined || result instanceof HeightField3D) accept(result);
        else void Promise.resolve(result).then(accept, reject);
    }
    private release(key: string, tile: TerrainTile3D): void {
        this.#tiles.delete(key);
        tile.terrain.removeFromParent();
        try { tile.terrain.dispose(); }
        catch (cause) { this.recordFailure(tile, 'dispose', cause); }
        try { this.#options.onUnload?.(tile); }
        catch (cause) { this.recordFailure(tile, 'onUnload', cause); }
    }
    private recordFailure(location: {readonly x: number; readonly z: number}, phase: TerrainStreamFailure3D['phase'], cause: unknown): void {
        this.#lastFailure = Object.freeze({x: location.x, z: location.z, phase, cause});
    }
}
export function createTerrainStream3D(options: TerrainStreamOptions3D): TerrainStream3D { return new TerrainStream3D(options); }
