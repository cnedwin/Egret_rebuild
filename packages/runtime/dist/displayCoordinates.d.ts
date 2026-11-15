import type { Point2D } from '@egret/contracts';
/** Receiver-inclusive ancestor budget; omitted maxNodes defaults to 4096. */
export interface CoordinateQueryOptions {
    readonly maxNodes?: number;
}
/** Private identity/state authority excludes getters and subclass hooks. */
export declare function queryDisplayPoint(receiver: unknown, x: unknown, y: unknown, options: unknown, inverse: boolean): Point2D;
//# sourceMappingURL=displayCoordinates.d.ts.map