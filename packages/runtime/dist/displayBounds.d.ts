import type { Rectangle2D } from '@egret/contracts';
/** Receiver-inclusive node and content budgets for logical local measurement. */
export interface BoundsQueryOptions {
    readonly maxNodes?: number;
    readonly maxPrimitives?: number;
}
/** Private state only: no display-class value import, resource lookup or public hook. */
export declare function queryDisplayBounds(receiver: unknown, options: unknown): Rectangle2D;
//# sourceMappingURL=displayBounds.d.ts.map