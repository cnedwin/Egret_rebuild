import type { PreparedSharedDraw2D, PreparedSharedFrame2D } from './prepareSharedDraws2D.js';
/**
 * `regionWindow` is the window of the region table this draw's region is in, or -1 for a draw without a region.
 * `pages` are the pages of the frame the draw samples, in the order of the texture units that hold them: the
 * one page of a draw as it is packed, up to eight for a batch, none for a draw without a region.
 * Nothing of a record is written once it is given, except the rows of a batch a Host keeps between frames:
 * see `prepareSharedBatches2D`. Draws next to each other may share one `uniform`, and one `pages`.
 */
export interface PackedSharedDraw2D {
    readonly prepared: PreparedSharedDraw2D;
    readonly data: Float32Array<ArrayBuffer>;
    readonly vertexCount: number;
    readonly uniform: Uint8Array<ArrayBuffer>;
    readonly regionWindow: number;
    readonly pages: readonly number[];
}
export type PackedSharedEntry2D = PackedSharedDraw2D | {
    readonly barrier: true;
    readonly ordinal: number;
};
/**
 * One vertex is thirteen f32 values: x y u v r g b a dr dg db slot opacity. `slot` is the place of the
 * draw's region in its window of the region table, and `opacity` the opacity of the draw; both are the
 * same at every vertex of a draw, so that draws which differ only in them share a batch.
 */
export declare const SHARED_VERTEX_BYTES_2D = 52;
/**
 * The region table holds twelve u32 values for every region of a frame, in frame order: logical width and
 * height, trim x and y; content width and height, packed x and y; quarter turn, the index of the region's
 * page in the frame, and the width and height of that page. A draw reads it through a window of 341
 * consecutive regions, the most that fit the 16,384 bytes every WebGL2 context gives one uniform block.
 */
export declare const SHARED_REGION_WINDOW_2D = 341, SHARED_REGION_WINDOW_BYTES_2D = 16368;
/**
 * A batch samples at most this many pages. Words 12 to 19 of its block name them: the word of a texture
 * unit is the index in the frame of the page that unit holds, and 0xffffffff for a unit that holds none.
 * A vertex finds its page's unit by the page index in its region's row of the region table.
 */
export declare const SHARED_BATCH_PAGES_2D = 8, SHARED_NO_PAGE_2D = 4294967295;
/** The region table of one frame. Every region is written, whether or not a draw of the frame uses it. */
export declare function packSharedRegions2D(frame: PreparedSharedFrame2D['frame']): Uint32Array<ArrayBuffer>;
/**
 * Backing coordinates stay backing coordinates until the fixed vertex shader. A draw whose geometry was kept
 * from the last frame takes the rows kept with it, once the charges recorded with those rows fit: the rows of
 * a draw depend on its geometry alone, except the place of its region and its opacity, which are written anew.
 * A kept draw that rested, whose record preparation gave again, is packed once and its packed record kept:
 * the next frame is given that record, while the draw goes on resting, for the charges alone.
 */
export declare function packSharedDraws2D(prepared: PreparedSharedFrame2D): PackedSharedEntry2D[];
//# sourceMappingURL=packSharedDraws2D.d.ts.map