import type { PackedSharedDraw2D, PackedSharedEntry2D } from './packSharedDraws2D.js';
import type { PreparedBatchScratch2D } from './preparedBatches2D.js';
export interface PreparedSharedBatchPlan2D {
    readonly draws: PackedSharedDraw2D[];
    logicalDraws: readonly PackedSharedEntry2D[] | undefined;
    readonly logicalSpans: {
        first: number;
        count: number;
    }[];
    bytes: number;
    released: boolean;
    transferred: boolean;
}
/** What the batches of a frame ask of the records a Host keeps between frames. */
export interface KeptSharedBatches2D {
    beginBatches(): void;
    findBatch(ordinal: number): KeptSharedBatch2D | undefined;
    carryBatch(batch: KeptSharedBatch2D): void;
    roomForBatch(draws: number, joinedBytes: number): boolean;
    keepBatch(members: (PackedSharedDraw2D | undefined)[], lengths: Uint32Array<ArrayBuffer>, pages: Int32Array<ArrayBuffer>, joined: PackedSharedDraw2D): void;
    commitBatches(): void;
}
interface KeptSharedBatch2D {
    readonly members: (PackedSharedDraw2D | undefined)[];
    readonly lengths: Uint32Array<ArrayBuffer>;
    readonly pages: Int32Array<ArrayBuffer>;
    joined: PackedSharedDraw2D;
}
/**
 * No logical charge is refunded when a physical upload is concatenated.
 *
 * With `kept`, a batch joined here is kept, and the batch that begins at the same place in the next frame is
 * not joined again if it is certain that joining would take the same number of draws, each with as many
 * rows as the kept batch has for it, and would be given the same room. The rows of every draw that is
 * another record than the batch holds are then written over the rows the batch had for it, in the kept array
 * itself, and nothing is written for a draw that is the same record. The batches are the same draws, with
 * the same rows, as without `kept`.
 *
 * So the rows of a batch given with `kept` are only good until the next call with the same `kept`. A caller
 * that reads them later than that must not pass `kept`.
 */
export declare function prepareSharedBatches2D(input: readonly PackedSharedEntry2D[], maxBufferSize: number, scratch: PreparedBatchScratch2D, kept?: KeptSharedBatches2D): PreparedSharedBatchPlan2D;
export {};
//# sourceMappingURL=preparedSharedBatches2D.d.ts.map