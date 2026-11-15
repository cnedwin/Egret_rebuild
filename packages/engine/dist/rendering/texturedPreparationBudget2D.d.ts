import type { PreparedStageCost2D } from './prepareRectangles2D.js';
import type { Preparation, PreparedPoint2D, PreparationBudget2D, PolygonClipPolicy2D } from './prepareRectangles2D.js';
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
export interface MeshPoint2D extends PreparedPoint2D {
    readonly u: number;
    readonly v: number;
    readonly r: number;
    readonly g: number;
    readonly b: number;
    readonly a: number;
}
export interface MeshClipPolicy2D extends PolygonClipPolicy2D<MeshPoint2D> {
    readonly maxCorners: 64;
    sameXY(first: MeshPoint2D, second: MeshPoint2D): boolean;
    sameAttributes(first: MeshPoint2D, second: MeshPoint2D): boolean;
    normalize(preparation: Preparation, input: readonly MeshPoint2D[]): MeshPoint2D[];
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
/** Complete tuples remain attached to collinear corners, reversal and crossing caches. */
export declare function createMeshClipPolicy2D(budget: TexturedPreparationBudget2D): MeshClipPolicy2D;
//# sourceMappingURL=texturedPreparationBudget2D.d.ts.map