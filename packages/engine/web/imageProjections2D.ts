import type { ImageData2D, TextureRegion2D } from '@egret/contracts';

/** One uploaded crop of one source image, as the shared WebGPU Host plans its uploads. */
export interface ProjectionView2D {
    readonly image: ImageData2D;
    readonly region: TextureRegion2D;
    readonly byteLength: number;
}

export interface ProjectionPlan2D {
    readonly views: readonly ProjectionView2D[];
    readonly commandViews: readonly (number | undefined)[];
    readonly projectionBytes: number;
    readonly scratchBytes: number;
}
