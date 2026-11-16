import type { PreparedStageCost2D } from './prepareRectangles2D.js';
import type { PreparationBudget2D } from './prepareRectangles2D.js';
export interface TexturedPreparationLimits2D {
    readonly maxSourceTriangles: number;
    readonly maxPreparedVertices: number;
    readonly maxClipEdgeTests: number;
    readonly maxTupleComparisons: number;
}
export interface TexturedPreparationSnapshot2D {
    readonly sourceTrianglesCharged: number;
    readonly preparedVerticesCharged: number;
    readonly predicatesCharged: number;
    readonly tupleComparisonsCharged: number;
}
/** One private frame ledger is shared by preparation and represented packing. */
export declare class TexturedPreparationBudget2D implements PreparationBudget2D {
    #private;
    constructor(limits: TexturedPreparationLimits2D);
    admitSourceTriangles(count: number): void;
    admitPreparedVertices(count: number): void;
    admitPredicate(): void;
    admitTupleComparison(): void;
    /** The three charges a stage replays, as they stand; a stage's cost is their difference across it. */
    get preparedVerticesCharged(): number;
    get predicatesCharged(): number;
    get tupleComparisonsCharged(): number;
    /** A rejected replay changes no dimension; the original stage then decides its first error. */
    tryReplayStageCost(cost: PreparedStageCost2D): boolean;
    snapshot(): Readonly<TexturedPreparationSnapshot2D>;
}
//# sourceMappingURL=texturedPreparationBudget2D.d.ts.map