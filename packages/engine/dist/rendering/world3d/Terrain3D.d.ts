import { type Material3D, type StandardMaterialOptions3D } from './Material3D.js';
import { type DecalOptions3D } from './Decal3D.js';
import type { Texture3D } from './Texture3D.js';
import { Mesh3D } from './Mesh3D.js';
import { Object3D } from './Object3D.js';
import { TriangleMeshShape3D } from './PhysicsMesh3D.js';
import type { Camera3D } from './Camera3D.js';
export declare const TERRAIN3D_LIMITS: Readonly<{
    readonly maxSamplesPerSide: 4097;
    readonly maxChunkCells: 254;
    readonly maxLevels: 8;
    readonly maxChunks: 4096;
    readonly maxCachedGeometryBytes: number;
    readonly maxStreamTiles: 256;
    readonly maxStreamPending: 32;
}>;
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
export declare class HeightField3D {
    #private;
    readonly columns: number;
    readonly rows: number;
    readonly width: number;
    readonly depth: number;
    readonly heights: Float32Array;
    /** Increases on refresh(); terrains rebuild their meshes when it changes. */
    version: number;
    constructor(options: HeightFieldOptions3D);
    get minHeight(): number;
    get maxHeight(): number;
    get cellWidth(): number;
    get cellDepth(): number;
    /** Local x of a sample column and local z of a sample row. */
    columnX(column: number): number;
    rowZ(row: number): number;
    /** Height stored at a sample; indices are clamped to the grid. */
    sampleAt(column: number, row: number): number;
    /** Call after writing to `heights`: recomputes the range and bumps the version. */
    refresh(): void;
    /** True when the local point lies over the grid. */
    contains(x: number, z: number): boolean;
    /** Surface height under a local point; points outside the grid use the nearest edge. */
    heightAt(x: number, z: number): number;
    /** Smoothed unit surface normal at a local point, from the neighbouring samples. */
    normalAt(x: number, z: number, out?: number[] | Float32Array): number[] | Float32Array;
    /**
     * Distance along a unit local ray to where it first drops below the
     * surface, or -1 within `limit`. The ray is walked in half-cell steps and
     * the crossing refined, so features thinner than a cell can be skipped.
     */
    raycast(origin: ArrayLike<number>, direction: ArrayLike<number>, limit?: number): number;
    /**
     * Collision shape for a static physics body placed at the terrain's
     * origin: the full-detail triangles, indexed by a bounding-volume
     * hierarchy so bodies only test the ground near them.
     */
    createShape(): {
        readonly type: 'mesh';
        readonly mesh: TriangleMeshShape3D;
    };
}
export declare function createHeightField3D(options: HeightFieldOptions3D): HeightField3D;
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
export declare function createHeightFieldFromPixels3D(pixels: {
    readonly width: number;
    readonly height: number;
    readonly data: ArrayLike<number>;
}, options: HeightImageOptions3D): HeightField3D;
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
/**
 * A height field drawn as a grid of chunk meshes. Before each frame every
 * chunk picks a detail level from its distance to the camera; neighbouring
 * chunks at different levels are sealed by skirts hanging from their borders.
 * Normals always come from the full-detail field, so lighting does not shift
 * when a chunk changes level.
 */
export declare class Terrain3D extends Object3D {
    #private;
    readonly field: HeightField3D;
    readonly chunkCells: number;
    readonly levels: number;
    lodDistance: number;
    /** Added to every chunk's level: raise it to lower the detail of the whole terrain. */
    lodBias: number;
    constructor(field: HeightField3D, material: Material3D, options?: TerrainOptions3D);
    get material(): Material3D;
    set material(value: Material3D);
    get chunkCount(): number;
    /** Detail level each chunk is currently drawn at, in row-major chunk order. */
    get chunkLevels(): number[];
    /** Triangles in the levels the chunks currently use. */
    get triangleCount(): number;
    /** Set shadow casting and receiving on every chunk. */
    setShadows(cast: boolean, receive: boolean): this;
    /**
     * Choose every chunk's level for a camera now. Rendering does this by
     * itself; call it when you read `chunkLevels` or `triangleCount` first.
     */
    update(camera: Camera3D): void;
    /** Rebuild the meshes after the field's heights changed and `field.refresh()` ran. Rendering checks this by itself. */
    rebuild(): void;
    /**
     * Lay a decal on the terrain. It is cut from the full-detail heights, not
     * from whichever level a chunk happens to show, so it stays put when the
     * levels change; far away, where chunks are coarse, it can sink slightly
     * into them. Attached decal geometry is released with the terrain; a
     * reparented decal belongs to the caller. Returns undefined when the box misses the ground.
     */
    createDecal(material: Material3D, options: DecalOptions3D): Mesh3D | undefined;
    /** Release chunk geometry and attached factory decals. Materials and the field stay with the caller. */
    dispose(): void;
    private checkGeometryBudget;
    private select;
    private use;
    private build;
}
export declare function createTerrain3D(field: HeightField3D, material: Material3D, options?: TerrainOptions3D): Terrain3D;
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
export declare function createTerrainMaterial3D(options: TerrainMaterialOptions3D): Material3D;
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
type TerrainStreamFailure3D = Readonly<{
    x: number;
    z: number;
    phase: 'load' | 'prepare' | 'onLoad' | 'dispose' | 'onUnload';
    cause: unknown;
}>;
export declare class TerrainStream3D extends Object3D {
    #private;
    readonly tileSize: number;
    viewDistance: number;
    constructor(options: TerrainStreamOptions3D);
    get tiles(): readonly TerrainTile3D[];
    /** Outstanding loader calls, including retired requests that have yet to settle. */
    get pendingCount(): number;
    /** Most recent failure in a loader, tile preparation, or lifecycle callback. */
    get lastFailure(): TerrainStreamFailure3D | undefined;
    tileAt(x: number, z: number): TerrainTile3D | undefined;
    /** Ground height at a world point of this node's space, or undefined where no tile is loaded. */
    heightAt(x: number, z: number): number | undefined;
    /** Request the tiles near a position and release those that fell out of range. */
    update(x: number, z: number): void;
    /** Retire the stream and release all tile geometry. Outstanding loads cannot publish. */
    dispose(): void;
    private request;
    private release;
    private recordFailure;
}
export declare function createTerrainStream3D(options: TerrainStreamOptions3D): TerrainStream3D;
export {};
//# sourceMappingURL=Terrain3D.d.ts.map