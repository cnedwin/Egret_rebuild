import type { PreparedEffects2D } from './sharedEffects2D.js';
import type { SharedRenderFrame2D, SharedRenderCommand2D, SharedMaterial2D, SharedRegion2D } from '@egret/contracts';
import { TexturedPreparationBudget2D } from './texturedPreparationBudget2D.js';
import type { TexturedPreparationLimits2D } from './texturedPreparationBudget2D.js';
import type { RetainedSharedDraw2D, SharedPreparationRetention2D } from './sharedPreparationRetention2D.js';
export declare class SharedPreparationError extends Error {
    readonly reason: 'frame' | 'profile' | 'precision' | 'budget';
    constructor(reason: 'frame' | 'profile' | 'precision' | 'budget');
}
export declare function sharedFailure(reason: SharedPreparationError['reason']): never;
export interface SharedPoint2D {
    readonly x: number;
    readonly y: number;
    readonly u: number;
    readonly v: number;
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
    readonly dr: number;
    readonly dg: number;
    readonly db: number;
}
export type SharedDrawCommand2D = Exclude<SharedRenderCommand2D, {
    kind: 'barrier';
}>;
export interface PreparedSharedDraw2D {
    readonly kind: 'draw';
    readonly command: SharedDrawCommand2D;
    readonly material: SharedMaterial2D;
    readonly region: SharedRegion2D | undefined;
    readonly pageIndex: number | undefined;
    readonly polygons: readonly (readonly SharedPoint2D[])[];
    readonly vertexReservation: number;
}
export interface PreparedSharedBarrier2D {
    readonly kind: 'barrier';
    readonly ordinal: number;
    readonly occurrenceId: number;
}
export type PreparedSharedEntry2D = PreparedSharedDraw2D | PreparedSharedBarrier2D;
/** What one shared frame may hold at most, whatever a Host is configured to admit. */
export declare const SHARED_FRAME_REGIONS_2D = 4096, SHARED_FRAME_PAGE_BYTES_2D = 67108864;
/** A Host option may lower the two frame ceilings; an absent one leaves the profile's own. */
export interface SharedPreparationOptions2D extends TexturedPreparationLimits2D {
    readonly enableEffects?: boolean;
    readonly pixelRatio: number;
    readonly maxCommands: number;
    readonly maxClipRectangles: number;
    readonly maxFrameGeometryBytes: number;
    readonly maxFrameRegions?: number;
    readonly maxFramePageBytes?: number;
}
/**
 * `retention` is the Host's kept draws, when the frame was prepared with them, and `retained` names for each
 * entry the kept draw that packing may take its rows from or give them to.
 */
export interface PreparedSharedFrame2D {
    readonly effects: PreparedEffects2D;
    readonly frame: SharedRenderFrame2D;
    readonly width: number;
    readonly height: number;
    readonly entries: readonly PreparedSharedEntry2D[];
    readonly budget: TexturedPreparationBudget2D;
    readonly geometryBytes: number;
    readonly pageBytes: number;
    readonly upload: number;
    readonly retention?: SharedPreparationRetention2D;
    readonly retained?: readonly (RetainedSharedDraw2D | undefined)[];
}
/** Address qualification follows f32 preparation and never clamps/modulos authored vertices. */
export declare function qualifySharedUV(point: SharedPoint2D, draw: Pick<PreparedSharedDraw2D, 'region' | 'material' | 'pageIndex'>, frame: SharedRenderFrame2D): void;
/** What address qualification reads of a draw: the same for each of its corners, so it is found once a draw. */
export interface SharedUVDomain2D {
    readonly width: number;
    readonly height: number;
    readonly limit: number;
}
/** Undefined for a draw without a page, whose corners are not qualified. */
export declare function sharedUVDomain(draw: Pick<PreparedSharedDraw2D, 'region' | 'material' | 'pageIndex'>, frame: SharedRenderFrame2D): SharedUVDomain2D | undefined;
/** `qualifySharedUV` of one corner's two texture coordinates, with the draw's domain already found. */
export declare function qualifySharedUVIn(pointU: number, pointV: number, domain: SharedUVDomain2D): void;
/**
 * Authentic completion is checked by Host; this helper still defends all table references. With `retention`,
 * a draw whose every input is the same as in the last frame takes the geometry kept for it, once the charges
 * recorded with that geometry fit what is left of the budget; any other draw is prepared here and kept.
 * The frame's tables, every command's own numbers and every frame-wide charge are checked for every frame.
 */
export declare function prepareSharedDraws2D(frame: SharedRenderFrame2D, width: number, height: number, options: SharedPreparationOptions2D, retention?: SharedPreparationRetention2D): PreparedSharedFrame2D;
//# sourceMappingURL=prepareSharedDraws2D.d.ts.map