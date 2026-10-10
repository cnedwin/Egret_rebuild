import type { RenderFrame2D, RectangleCommand2D } from '@egret/contracts';

/** Only the original rectangle copiers produce this private narrowed snapshot. */
export type RectangleFrame2D = Omit<RenderFrame2D, "commands" | "images"> & {
    readonly commands: readonly RectangleCommand2D[];
};
