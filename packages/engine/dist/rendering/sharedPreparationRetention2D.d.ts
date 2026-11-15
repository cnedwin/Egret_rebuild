import type { ImageData2D, SharedGeometry2D, SharedMaterial2D, SharedRegion2D, TexturedGeometry2D } from '@egret/contracts';
import type { PreparedStageCost2D } from './prepareRectangles2D.js';
import type { PreparedSharedDraw2D, SharedDrawCommand2D, SharedPoint2D } from './prepareSharedDraws2D.js';
import type { PackedSharedDraw2D } from './packSharedDraws2D.js';
/**
 * What one Host keeps of the last frame it prepared, so that a draw which is the same in the next frame is
 * not clipped and packed again, and a batch that takes the same draws is not joined again: only the rows of
 * its draws that changed are written. A kept result is used only for a draw whose every input is the same
 * value, and only after its recorded charges fit the frame's budget, so a frame prepared with kept results
 * has the same geometry, rows, batches, charges and refusals as one prepared without them.
 *
 * The limits are logical: a record counts 32 bytes and 8 for each field, an array 24 and 8 for each element,
 * a typed array its byte length, and every kept draw 256 for itself. A frame the largest limits admit keeps
 * less than the byte limit; a Host is given no other.
 */
export declare const SHARED_RETAINED_DRAWS_2D = 65536, SHARED_RETAINED_BYTES_2D = 50331648;
type Geometry = TexturedGeometry2D | SharedGeometry2D;
/**
 * One draw of the last frame. `polygons` is absent in a draw that changed twice running; it is kept again once it rests.
 * `prepared` is the record preparation gave for the draw, and `rested` says that the frame being prepared was given
 * that same record again. `packed` is the packed record of a draw that rested; its rows are `rows`.
 */
export interface RetainedSharedDraw2D {
    command: SharedDrawCommand2D;
    material: SharedMaterial2D;
    region: SharedRegion2D | undefined;
    page: ImageData2D | undefined;
    geometry: Geometry | undefined;
    polygons: readonly (readonly SharedPoint2D[])[] | undefined;
    vertexReservation: number;
    geometryCost: PreparedStageCost2D | undefined;
    rows: Float32Array<ArrayBuffer> | undefined;
    vertexCount: number;
    rowsCost: PreparedStageCost2D | undefined;
    prepared: PreparedSharedDraw2D | undefined;
    rested: boolean;
    packed: PackedSharedDraw2D | undefined;
    changes: number;
    bytes: number;
    frame: number;
}
/**
 * A batch joined out of several draws: the place in the frame of its first draw, what is held of each draw in
 * order, and the draw that joins them. `lengths` are the numbers of f32 values each draw has in the rows of
 * `joined`, one draw after another, and `pages` their pages, -1 for none. `members` holds the packed record of
 * a draw only where that keeps nothing else alive; the first is always a record, which may stand for the draw's.
 * The batches of a later frame write all of these: see `prepareSharedBatches2D`.
 */
export interface RetainedSharedBatch2D {
    readonly ordinal: number;
    readonly members: (PackedSharedDraw2D | undefined)[];
    readonly lengths: Uint32Array<ArrayBuffer>;
    readonly pages: Int32Array<ArrayBuffer>;
    joined: PackedSharedDraw2D;
    readonly bytes: number;
}
export declare class SharedPreparationRetention2D {
    #private;
    /** `maxBytes` may only lower the limit on what is kept. */
    constructor(maxBytes?: number);
    /** The logical bytes and the draws kept now. */
    get bytes(): number;
    /** The batches kept now. */
    get batches(): number;
    get draws(): number;
    /** Everything kept is dropped; a frame being prepared keeps nothing. */
    clear(): void;
    /** Starts a frame. Results kept for another size, pixel ratio or set of limits are dropped first. */
    begin(commands: number, width: number, height: number, ratio: number, options: object): void;
    /**
     * The kept draw that has every input of this one, if the last frame had it at this place or up to two places
     * to either side of where the draw before it was found, so that a draw or two added or removed do not part
     * every later draw from its result. After eight draws running that were not found, only this place is
     * looked at until one is found again: a frame in which everything changed is not searched in vain.
     * A kept draw answers one draw of a frame.
     */
    find(ordinal: number, command: SharedDrawCommand2D, material: SharedMaterial2D, region: SharedRegion2D | undefined, page: ImageData2D | undefined, geometry: Geometry | undefined): RetainedSharedDraw2D | undefined;
    /**
     * The record the last frame was given for a kept draw, to be given again: while the command is the same
     * object and the draw's page has the same place among the frame's pages. Then the draw has rested.
     */
    rest(entry: RetainedSharedDraw2D, command: SharedDrawCommand2D, pageIndex: number | undefined): PreparedSharedDraw2D | undefined;
    /** The new record of a kept draw that did not rest. A packed record kept for its old one is dropped. */
    give(entry: RetainedSharedDraw2D, prepared: PreparedSharedDraw2D): void;
    /** A kept draw found for this frame stays kept, under the records of this frame. */
    carry(ordinal: number, entry: RetainedSharedDraw2D, command: SharedDrawCommand2D, region: SharedRegion2D | undefined): void;
    /**
     * Keeps the geometry a draw of this frame was just given, with the three charges it was given, and the record
     * `prepared` that holds it. `found` is
     * the kept draw with the same inputs, when there was one without geometry. A draw whose place held another
     * draw twice running is kept without its geometry until it is found the same once; a record without
     * geometry that stood at its place is written over, so a draw that changes in every frame allocates nothing here.
     */
    keep(ordinal: number, found: RetainedSharedDraw2D | undefined, command: SharedDrawCommand2D, material: SharedMaterial2D, region: SharedRegion2D | undefined, page: ImageData2D | undefined, geometry: Geometry | undefined, prepared: PreparedSharedDraw2D, preparedVertices: number, predicates: number, tupleComparisons: number): RetainedSharedDraw2D | undefined;
    /** The geometry of the frame is complete: what it kept replaces what was kept before. */
    commit(): void;
    /** A frame that did not complete its geometry leaves what was kept before as it was. */
    abandon(): void;
    /** Keeps a copy of the rows a kept draw was just given, while there is room. */
    keepRows(entry: RetainedSharedDraw2D, rows: Float32Array<ArrayBuffer>, vertexCount: number, cost: PreparedStageCost2D): void;
    /**
     * Keeps the packed record of a draw that rested, while there is room. The rows of the record become the
     * kept rows of the draw: they are the same rows, with the place of the region and the opacity of this frame.
     */
    keepPacked(entry: RetainedSharedDraw2D, packed: PackedSharedDraw2D): boolean;
    /** Starts the batches of a frame. Until they are complete, the batches kept before stay kept. */
    beginBatches(): void;
    /** The kept batch whose first draw was at this place in its frame. */
    findBatch(ordinal: number): RetainedSharedBatch2D | undefined;
    /** A kept batch that is a batch of this frame stays kept. */
    carryBatch(batch: RetainedSharedBatch2D): void;
    /** Whether there is room to keep a batch of this many draws with these joined rows. */
    roomForBatch(draws: number, joinedBytes: number): boolean;
    /** Keeps a batch this frame joined. The caller has asked whether there is room. */
    keepBatch(members: (PackedSharedDraw2D | undefined)[], lengths: Uint32Array<ArrayBuffer>, pages: Int32Array<ArrayBuffer>, joined: PackedSharedDraw2D): void;
    /** The batches of the frame are complete: what it kept replaces what was kept before. */
    commitBatches(): void;
}
export {};
//# sourceMappingURL=sharedPreparationRetention2D.d.ts.map