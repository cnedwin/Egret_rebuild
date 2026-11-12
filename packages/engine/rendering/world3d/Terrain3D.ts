// SPDX-License-Identifier: Apache-2.0
// Height-map terrain: a grid of heights that answers gameplay queries, a
// chunked mesh whose pieces drop detail with distance, and a collision shape
// built from the same triangles. DOM-free; decode images in the host and pass
// the pixels in.
import {World3DError, requireCount3D, requireFinite3D, requirePositive3D} from './core3D.js';
import {Attribute3D, Geometry3D} from './Geometry3D.js';
import type {Material3D} from './Material3D.js';
import {Mesh3D} from './Mesh3D.js';
import {Object3D} from './Object3D.js';
import {TriangleMeshShape3D} from './PhysicsMesh3D.js';
import type {Camera3D} from './Camera3D.js';

export const TERRAIN3D_LIMITS = Object.freeze({
    maxSamplesPerSide: 4097, maxChunkCells: 254, maxLevels: 8, maxChunks: 4096, maxCachedGeometryBytes: 128 * 1024 * 1024,
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
    /** Release every chunk geometry. The material and the field stay with the caller. */
    dispose(): void {
        for (const chunk of this.#chunks) {
            for (const geometry of chunk.geometries) geometry?.dispose();
            chunk.geometries.length = 0;
            chunk.mesh.removeFromParent();
        }
        this.#chunks.length = 0;
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
