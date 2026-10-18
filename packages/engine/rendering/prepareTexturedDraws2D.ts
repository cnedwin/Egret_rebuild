import type { ImageData2D, RectangleCommand2D, TexturedGeometry2D, TexturedRenderCommand2D, TexturedRenderFrame2D } from '@egret/contracts';
import { coordinate, GeometryPreparationError, prepareRectangles2D } from './prepareRectangles2D.js';
import type { PreparedRectangles2D, RectanglePreparationOptions } from './prepareRectangles2D.js';
import { prepareImage2D } from './prepareImages2D.js';
import type { PreparedImage2D } from './prepareImages2D.js';
import { prepareTexturedMesh2D } from './prepareTexturedMesh2D.js';
import type { PreparedMesh2D } from './prepareTexturedMesh2D.js';
import type { TexturedPreparationBudget2D } from './texturedPreparationBudget2D.js';
import type { PreparedCacheContext2D, PreparedCacheSlot2D } from './preparedFrameCache2D.js';

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
    { readonly kind: 'rect'; readonly prepared: PreparedRectangles2D; readonly commandIndices: readonly number[]; readonly cacheSlot?: PreparedCacheSlot2D } |
    { readonly kind: 'image'; readonly prepared: PreparedImage2D; readonly commandIndex: number; readonly cacheSlot?: PreparedCacheSlot2D } |
    { readonly kind: 'mesh'; readonly prepared: PreparedMesh2D; readonly commandIndex: number; readonly cacheSlot?: PreparedCacheSlot2D };

/** Preserve painter barriers and share one frame ledger across all three preparation paths. */
export function prepareTexturedDraws2D(admitted: TexturedFrameAdmission2D,
    options: RectanglePreparationOptions, budget: TexturedPreparationBudget2D, cache?: PreparedCacheContext2D): readonly PreparedTexturedDraw2D[] {
    coordinate(options.pixelRatio);
    const { frame, width, height } = admitted, draws: PreparedTexturedDraw2D[] = [];
    let rectangles: RectangleCommand2D[] = [], sourceCommandIndices: number[] = [];
    const flush = (): void => {
        if (rectangles.length === 0) return;
        // No frame spread: rectangle preparation has no image or geometry payload authority.
        const commandIndices: number[] = [];
        const cacheSlot = cache?.cache.slot(cache, rectangles, width, height, undefined, undefined, true, sourceCommandIndices[0]!);
        const prepared = prepareRectangles2D({ frameId: frame.frameId, width: frame.width, height: frame.height,
            clearColor: frame.clearColor, clearAlpha: frame.clearAlpha, commands: rectangles }, width, height, options, budget, commandIndices, cache, sourceCommandIndices);
        draws.push({ kind: 'rect', prepared, commandIndices: commandIndices.map(index => sourceCommandIndices[index]!), ...(cacheSlot ? { cacheSlot } : {}) });
        rectangles = []; sourceCommandIndices = [];
    };
    for (const record of admitted.commands) {
        const command = record.command;
        if (command.kind === 'rect') { rectangles.push(command); sourceCommandIndices.push(record.commandIndex); continue; }
        flush();
        const cacheSlot = cache?.cache.slot(cache, [command], width, height, record.image, record.geometry, false, record.commandIndex);
        if (command.kind === 'image') {
            const prepared = prepareImage2D(command, width, height, options, budget, cacheSlot);
            draws.push({ kind: 'image', prepared, commandIndex: record.commandIndex, ...(cacheSlot ? { cacheSlot } : {}) });
        } else {
            if (record.geometry === undefined) throw new GeometryPreparationError('precision');
            const prepared = prepareTexturedMesh2D(command, record.geometry, width, height, options, budget, cacheSlot);
            draws.push({ kind: 'mesh', prepared, commandIndex: record.commandIndex, ...(cacheSlot ? { cacheSlot } : {}) });
        }
        // Empty image/mesh rows remain barriers; fan/source debits are never repeated here.
    }
    flush();
    return draws;
}
