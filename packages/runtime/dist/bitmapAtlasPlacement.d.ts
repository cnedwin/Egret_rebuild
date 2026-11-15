import type { Matrix2D, Rectangle2D } from '@egret/contracts';
import type { BitmapCaptureState } from './bitmapDisplayState.js';
/** Packed-local to logical placement; scene, anchors and clips keep their original M. */
export declare function bitmapAtlasPlacement(state: BitmapCaptureState, matrix: Matrix2D): {
    readonly matrix: Matrix2D;
    readonly rect: Rectangle2D;
};
//# sourceMappingURL=bitmapAtlasPlacement.d.ts.map