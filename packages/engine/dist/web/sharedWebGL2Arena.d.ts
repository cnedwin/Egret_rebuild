import type { PackedSharedDraw2D } from '../rendering/packSharedDraws2D.js';
export interface SharedWebGL2ArenaStrides {
    readonly sharedStride: number;
}
interface SharedRange {
    readonly draw: PackedSharedDraw2D;
    readonly vertexOffset: number;
    readonly firstVertex: number;
    readonly uniformOffset: number;
    readonly uniformSize: 128;
}
/** The region table of one record: its own uniform buffer, one window after another, each at an aligned offset. */
export interface SharedWebGL2RegionTable {
    readonly bytes: number;
    readonly stride: number;
    /** The rows of each window, to be written at `offset`. */
    readonly windows: readonly {
        readonly offset: number;
        readonly data: Uint32Array<ArrayBuffer>;
    }[];
}
export interface SharedWebGL2ArenaPlan {
    readonly vertexBytes: number;
    readonly uniformBytes: number;
    readonly sharedRanges: readonly SharedRange[];
    /** Present when a draw of the record has a region. Not part of `uniformBytes`. */
    readonly regionTable: SharedWebGL2RegionTable | undefined;
}
export interface SharedWebGL2ArenaOwner {
    readonly pendingVertexArenaBytes: number;
    readonly pendingUniformArenaBytes: number;
}
/** Actual GL alignment is finite but need not be a power of two. */
export declare function qualifySharedWebGL2Alignment(alignment: number): SharedWebGL2ArenaStrides;
/** Plan only native addresses; existing private payload arrays remain their original owners. */
export declare function planSharedWebGL2Arenas(draws: readonly PackedSharedDraw2D[], alignment: number, regions?: Uint32Array<ArrayBuffer>): SharedWebGL2ArenaPlan;
/** Pure check: Host repeats it with current counters immediately before owner/serial commit. */
export declare function checkSharedWebGL2ArenaCapacity(plan: SharedWebGL2ArenaPlan, owner: SharedWebGL2ArenaOwner): void;
export {};
//# sourceMappingURL=sharedWebGL2Arena.d.ts.map