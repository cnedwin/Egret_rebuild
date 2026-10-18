import type { TextureRegion2D } from './ImageData2D.js';

/** A packed page rectangle and its unrotated logical, top-left region. */
export interface TextureViewRegionInput2D {
    readonly packed: TextureRegion2D;
    readonly logicalWidth: number;
    readonly logicalHeight: number;
    readonly trimX: number;
    readonly trimY: number;
    readonly quarterTurn: 0 | 1 | 2 | 3;
}

/** Owned immutable metadata. Packed coordinates never stand in for logical size. */
export interface TextureViewRegion2D {
    readonly packed: TextureRegion2D;
    readonly logicalWidth: number;
    readonly logicalHeight: number;
    readonly trimX: number;
    readonly trimY: number;
    readonly quarterTurn: 0 | 1 | 2 | 3;
}
