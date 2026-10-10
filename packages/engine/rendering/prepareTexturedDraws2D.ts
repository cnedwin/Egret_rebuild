import type { ImageData2D, RectangleCommand2D, TexturedGeometry2D, TexturedRenderCommand2D, TexturedRenderFrame2D } from '@egret/contracts';
import { coordinate, GeometryPreparationError, prepareRectangles2D } from './prepareRectangles2D.js';
import type { PreparedRectangles2D, RectanglePreparationOptions } from './prepareRectangles2D.js';
import { prepareImage2D } from './prepareImages2D.js';
import type { PreparedImage2D } from './prepareImages2D.js';
import { prepareTexturedMesh2D } from './prepareTexturedMesh2D.js';
import type { PreparedMesh2D } from './prepareTexturedMesh2D.js';
import type { TexturedPreparationBudget2D } from './texturedPreparationBudget2D.js';

/** Private canonical metadata records; the admission owner alone charges source triangles. */
export interface AdmittedTexturedCommand2D {
    readonly command: TexturedRenderCommand2D;
    readonly commandIndex: number;
    readonly geometry?: TexturedGeometry2D;
    readonly image?: ImageData2D;
}
export interface TexturedFrameAdmission2D {
    readonly frame: TexturedRenderFrame2D;
    readonly width: number;
    readonly height: number;
    readonly uniqueGeometryBytes: number;
    readonly commands: readonly AdmittedTexturedCommand2D[];
}
export type PreparedTexturedDraw2D =
    { readonly kind: 'rect'; readonly prepared: PreparedRectangles2D } |
    { readonly kind: 'image'; readonly prepared: PreparedImage2D; readonly commandIndex: number } |
    { readonly kind: 'mesh'; readonly prepared: PreparedMesh2D; readonly commandIndex: number };

/** Preserve painter barriers and share one frame ledger across all three preparation paths. */
export function prepareTexturedDraws2D(admitted: TexturedFrameAdmission2D,
    options: RectanglePreparationOptions, budget: TexturedPreparationBudget2D): readonly PreparedTexturedDraw2D[] {
    coordinate(options.pixelRatio);
    const { frame, width, height } = admitted, draws: PreparedTexturedDraw2D[] = [];
    let rectangles: RectangleCommand2D[] = [];
    const flush = (): void => {
        if (rectangles.length === 0) return;
        // No frame spread: rectangle preparation has no image or geometry payload authority.
        const prepared = prepareRectangles2D({ frameId: frame.frameId, width: frame.width, height: frame.height,
            clearColor: frame.clearColor, clearAlpha: frame.clearAlpha, commands: rectangles }, width, height, options, budget);
        draws.push({ kind: 'rect', prepared });
        rectangles = [];
    };
    for (const record of admitted.commands) {
        const command = record.command;
        if (command.kind === 'rect') { rectangles.push(command); continue; }
        flush();
        if (command.kind === 'image') {
            const prepared = prepareImage2D(command, width, height, options, budget);
            draws.push({ kind: 'image', prepared, commandIndex: record.commandIndex });
        } else {
            if (record.geometry === undefined) throw new GeometryPreparationError('precision');
            const prepared = prepareTexturedMesh2D(command, record.geometry, width, height, options, budget);
            draws.push({ kind: 'mesh', prepared, commandIndex: record.commandIndex });
        }
        // Empty image/mesh rows remain barriers; fan/source debits are never repeated here.
    }
    flush();
    return draws;
}
