import { noteOwnedPreparationFailure } from './ownedPreparationFailure2D.js';
import type { PreparedStageCost2D } from './preparedFrameCache2D.js';
import { GeometryPreparationError, coordinate, finishPolygonWinding2D } from './prepareRectangles2D.js';
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
    readonly u: number; readonly v: number;
    readonly r: number; readonly g: number; readonly b: number; readonly a: number;
}
export interface MeshClipPolicy2D extends PolygonClipPolicy2D<MeshPoint2D> {
    readonly maxCorners: 64;
    sameXY(first: MeshPoint2D, second: MeshPoint2D): boolean;
    sameAttributes(first: MeshPoint2D, second: MeshPoint2D): boolean;
    normalize(preparation: Preparation, input: readonly MeshPoint2D[]): MeshPoint2D[];
}
function fail(reason: 'precision' | 'budget'): never { throw noteOwnedPreparationFailure(new GeometryPreparationError(reason)); }
function limit(value: number, maximum: number): number {
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum) fail('budget');
    return value;
}
/** Whole admission is atomic; accepted earlier work is never refunded. */
function admit(count: number, charged: number, maximum: number): number {
    if (!Number.isSafeInteger(count) || count < 0 || count > maximum - charged) fail('budget');
    return charged + count;
}
/** One private frame ledger is shared by preparation and represented packing. */
export class TexturedPreparationBudget2D implements PreparationBudget2D {
    readonly #limits: TexturedPreparationLimits2D;
    #sourceTrianglesCharged = 0;
    #preparedVerticesCharged = 0;
    #predicatesCharged = 0;
    #tupleComparisonsCharged = 0;
    public constructor(limits: TexturedPreparationLimits2D) {
        this.#limits = Object.freeze({
            maxSourceTriangles: limit(limits.maxSourceTriangles, 65_536),
            maxPreparedVertices: limit(limits.maxPreparedVertices, 1_048_576),
            maxClipEdgeTests: limit(limits.maxClipEdgeTests, 4_194_304),
            maxTupleComparisons: limit(limits.maxTupleComparisons, 1_048_576),
        });
    }
    public admitSourceTriangles(count: number): void {
        this.#sourceTrianglesCharged = admit(count, this.#sourceTrianglesCharged, this.#limits.maxSourceTriangles);
    }
    public admitPreparedVertices(count: number): void {
        this.#preparedVerticesCharged = admit(count, this.#preparedVerticesCharged, this.#limits.maxPreparedVertices);
    }
    public admitPredicate(): void {
        this.#predicatesCharged = admit(1, this.#predicatesCharged, this.#limits.maxClipEdgeTests);
    }
    public admitTupleComparison(): void {
        this.#tupleComparisonsCharged = admit(1, this.#tupleComparisonsCharged, this.#limits.maxTupleComparisons);
    }
    /** A rejected replay changes no dimension; the original stage then decides its first error. */
    public tryReplayStageCost(cost: PreparedStageCost2D): boolean {
        const vertices = cost.preparedVertices, predicates = cost.predicates, tuples = cost.tupleComparisons;
        if (!Number.isSafeInteger(vertices) || vertices < 0 || vertices > this.#limits.maxPreparedVertices - this.#preparedVerticesCharged
            || !Number.isSafeInteger(predicates) || predicates < 0 || predicates > this.#limits.maxClipEdgeTests - this.#predicatesCharged
            || !Number.isSafeInteger(tuples) || tuples < 0 || tuples > this.#limits.maxTupleComparisons - this.#tupleComparisonsCharged) return false;
        this.#preparedVerticesCharged += vertices;
        this.#predicatesCharged += predicates;
        this.#tupleComparisonsCharged += tuples;
        return true;
    }
    public snapshot(): Readonly<TexturedPreparationSnapshot2D> {
        return Object.freeze({
            sourceTrianglesCharged: this.#sourceTrianglesCharged,
            preparedVerticesCharged: this.#preparedVerticesCharged,
            predicatesCharged: this.#predicatesCharged,
            tupleComparisonsCharged: this.#tupleComparisonsCharged,
        });
    }
}
function attribute(value: number): number {
    if (!Number.isFinite(value) || value < 0 || value > 1) fail('precision');
    return value === 0 ? 0 : value;
}
/** Complete tuples remain attached to collinear corners, reversal and crossing caches. */
export function createMeshClipPolicy2D(budget: TexturedPreparationBudget2D): MeshClipPolicy2D {
    const before = (first: MeshPoint2D, second: MeshPoint2D): boolean => {
        budget.admitTupleComparison();
        return first.x < second.x || (first.x === second.x && first.y < second.y);
    };
    const sameXY = (first: MeshPoint2D, second: MeshPoint2D): boolean => {
        budget.admitTupleComparison();
        return first.x === second.x && first.y === second.y;
    };
    const sameAttributes = (first: MeshPoint2D, second: MeshPoint2D): boolean => {
        budget.admitTupleComparison();
        return first.u === second.u && first.v === second.v
            && first.r === second.r && first.g === second.g && first.b === second.b && first.a === second.a;
    };
    const sameTuple = (first: MeshPoint2D, second: MeshPoint2D): boolean => sameXY(first, second) && sameAttributes(first, second);
    const assertAppend = (currentLength: number): void => {
        if (!Number.isSafeInteger(currentLength) || currentLength < 0 || currentLength >= 64) fail('budget');
    };
    const normalize = (preparation: Preparation, input: readonly MeshPoint2D[]): MeshPoint2D[] => {
        if (input.length > 64) fail('budget');
        const points: MeshPoint2D[] = [];
        for (const point of input) {
            const owned: MeshPoint2D = {
                x: coordinate(point.x), y: coordinate(point.y),
                u: attribute(point.u), v: attribute(point.v),
                r: attribute(point.r), g: attribute(point.g), b: attribute(point.b), a: attribute(point.a),
            };
            const previous = points[points.length - 1];
            if (previous && sameXY(previous, owned)) {
                if (!sameAttributes(previous, owned)) fail('precision');
            } else {
                assertAppend(points.length);
                points.push(owned);
            }
        }
        if (points.length > 1 && sameXY(points[0]!, points[points.length - 1]!)) {
            if (!sameAttributes(points[0]!, points[points.length - 1]!)) fail('precision');
            points.pop();
        }
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                if (sameXY(points[i]!, points[j]!)) {
                    // A nonadjacent repeat is invalid even when all six attributes agree.
                    sameAttributes(points[i]!, points[j]!);
                    fail('precision');
                }
            }
        }
        if (points.length < 3) return [];
        return finishPolygonWinding2D(preparation, points);
    };
    const policy: MeshClipPolicy2D = { maxCorners: 64, before, sameXY, sameAttributes, sameTuple, assertAppend, normalize };
    return Object.freeze(policy);
}
