import type { RectangleCommand2D, RenderFrame2D } from '@egret/contracts';
import { prepareRectangles2D, coordinate } from './prepareRectangles2D.js';
import type { PreparedRectangles2D, RectanglePreparationOptions } from './prepareRectangles2D.js';
import { prepareImage2D } from './prepareImages2D.js';
import type { PreparedImage2D } from './prepareImages2D.js';

export type PreparedMixedDraw2D =
    { readonly kind: 'rect'; readonly prepared: PreparedRectangles2D } |
    { readonly kind: 'image'; readonly prepared: PreparedImage2D; readonly commandIndex: number };

/** Consume a trusted copied frame; runs preserve painter order and share preparation caps. */
export function prepareMixedDraws2D(frame: RenderFrame2D, width: number, height: number, options: RectanglePreparationOptions): readonly PreparedMixedDraw2D[] {
    // Clear-only frames retain the rectangle preparer's unconditional nominal-DPR envelope.
    coordinate(options.pixelRatio);
    const draws: PreparedMixedDraw2D[] = [];
    let rectangles: RectangleCommand2D[] = [];
    let remainingVertices = Math.min(options.maxPreparedVertices, 4294967295);
    let remainingEdgeTests = options.maxClipEdgeTests;
    const remaining = (): RectanglePreparationOptions => ({ pixelRatio: options.pixelRatio, maxPreparedVertices: remainingVertices, maxClipEdgeTests: remainingEdgeTests });
    const debit = (vertices: number, edgeTests: number): void => {
        // Existing preparers admit bounded fan vertices and determinant calls, not packed bytes.
        // Float32 fan collapse happens later and never refunds these whole-frame charges.
        remainingVertices -= vertices;
        remainingEdgeTests -= edgeTests;
    };
    const flushRectangles = (): void => {
        if (!rectangles.length) return;
        // Do not spread the frame: rectangle preparation has no image-table read authority.
        const prepared = prepareRectangles2D({ frameId: frame.frameId, width: frame.width, height: frame.height, clearColor: frame.clearColor, clearAlpha: frame.clearAlpha, commands: rectangles }, width, height, remaining());
        let vertices = 0;
        for (const command of prepared.commands) vertices += (command.pointIndices.length - 2) * 3;
        debit(vertices, prepared.edgeTests);
        draws.push({ kind: 'rect', prepared });
        rectangles = [];
    };
    for (let commandIndex = 0; commandIndex < frame.commands.length; commandIndex++) {
        const command = frame.commands[commandIndex]!;
        if (command.kind === 'rect') {
            rectangles.push(command);
        } else {
            flushRectangles();
            const prepared = prepareImage2D(command, width, height, remaining());
            debit(prepared.pointIndices.length ? (prepared.pointIndices.length - 2) * 3 : 0, prepared.edgeTests);
            // Empty images still separate runs and retain their original projection association.
            // The existing attributed geometry keeps full position/UV tuples attached.
            draws.push({ kind: 'image', prepared, commandIndex });
        }
    }
    flushRectangles();
    return draws;
}
