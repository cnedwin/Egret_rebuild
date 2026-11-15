import { noteOwnedPreparationFailure } from './ownedPreparationFailure2D.js';
import { GeometryPreparationError, coordinate, finishPolygonWinding2D } from './prepareRectangles2D.js';
function fail(reason) {
    throw noteOwnedPreparationFailure(new GeometryPreparationError(reason));
}
function limit(value, maximum) {
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
        fail('budget');
    return value;
}
/** Whole admission is atomic; accepted earlier work is never refunded. */
function admit(count, charged, maximum) {
    if (!Number.isSafeInteger(count) || count < 0 || count > maximum - charged)
        fail('budget');
    return charged + count;
}
/** One private frame ledger is shared by preparation and represented packing. */
export class TexturedPreparationBudget2D {
    #limits;
    #sourceTrianglesCharged = 0;
    #preparedVerticesCharged = 0;
    #predicatesCharged = 0;
    #tupleComparisonsCharged = 0;
    constructor(limits) {
        this.#limits = Object.freeze({
            maxSourceTriangles: limit(limits.maxSourceTriangles, 65_536),
            maxPreparedVertices: limit(limits.maxPreparedVertices, 1_048_576),
            maxClipEdgeTests: limit(limits.maxClipEdgeTests, 4_194_304),
            maxTupleComparisons: limit(limits.maxTupleComparisons, 1_048_576)
        });
    }
    admitSourceTriangles(count) {
        this.#sourceTrianglesCharged = admit(count, this.#sourceTrianglesCharged, this.#limits.maxSourceTriangles);
    }
    admitPreparedVertices(count) {
        this.#preparedVerticesCharged = admit(count, this.#preparedVerticesCharged, this.#limits.maxPreparedVertices);
    }
    admitPredicate() {
        this.#predicatesCharged = admit(1, this.#predicatesCharged, this.#limits.maxClipEdgeTests);
    }
    admitTupleComparison() {
        this.#tupleComparisonsCharged = admit(1, this.#tupleComparisonsCharged, this.#limits.maxTupleComparisons);
    }
    /** The three charges a stage replays, as they stand; a stage's cost is their difference across it. */
    get preparedVerticesCharged() {
        return this.#preparedVerticesCharged;
    }
    get predicatesCharged() {
        return this.#predicatesCharged;
    }
    get tupleComparisonsCharged() {
        return this.#tupleComparisonsCharged;
    }
    /** A rejected replay changes no dimension; the original stage then decides its first error. */
    tryReplayStageCost(cost) {
        const vertices = cost.preparedVertices, predicates = cost.predicates, tuples = cost.tupleComparisons;
        if (!Number.isSafeInteger(vertices) ||
            vertices < 0 ||
            vertices > this.#limits.maxPreparedVertices - this.#preparedVerticesCharged ||
            !Number.isSafeInteger(predicates) ||
            predicates < 0 ||
            predicates > this.#limits.maxClipEdgeTests - this.#predicatesCharged ||
            !Number.isSafeInteger(tuples) ||
            tuples < 0 ||
            tuples > this.#limits.maxTupleComparisons - this.#tupleComparisonsCharged)
            return false;
        this.#preparedVerticesCharged += vertices;
        this.#predicatesCharged += predicates;
        this.#tupleComparisonsCharged += tuples;
        return true;
    }
    snapshot() {
        return Object.freeze({
            sourceTrianglesCharged: this.#sourceTrianglesCharged,
            preparedVerticesCharged: this.#preparedVerticesCharged,
            predicatesCharged: this.#predicatesCharged,
            tupleComparisonsCharged: this.#tupleComparisonsCharged
        });
    }
}
function attribute(value) {
    if (!Number.isFinite(value) || value < 0 || value > 1)
        fail('precision');
    return value === 0 ? 0 : value;
}
/** Complete tuples remain attached to collinear corners, reversal and crossing caches. */
export function createMeshClipPolicy2D(budget) {
    const before = (first, second) => {
        budget.admitTupleComparison();
        return first.x < second.x || (first.x === second.x && first.y < second.y);
    };
    const sameXY = (first, second) => {
        budget.admitTupleComparison();
        return first.x === second.x && first.y === second.y;
    };
    const sameAttributes = (first, second) => {
        budget.admitTupleComparison();
        return (first.u === second.u &&
            first.v === second.v &&
            first.r === second.r &&
            first.g === second.g &&
            first.b === second.b &&
            first.a === second.a);
    };
    const sameTuple = (first, second) => sameXY(first, second) && sameAttributes(first, second);
    const assertAppend = (currentLength) => {
        if (!Number.isSafeInteger(currentLength) || currentLength < 0 || currentLength >= 64)
            fail('budget');
    };
    const normalize = (preparation, input) => {
        if (input.length > 64)
            fail('budget');
        const points = [];
        for (const point of input) {
            const owned = {
                x: coordinate(point.x),
                y: coordinate(point.y),
                u: attribute(point.u),
                v: attribute(point.v),
                r: attribute(point.r),
                g: attribute(point.g),
                b: attribute(point.b),
                a: attribute(point.a)
            };
            const previous = points[points.length - 1];
            if (previous && sameXY(previous, owned)) {
                if (!sameAttributes(previous, owned))
                    fail('precision');
            }
            else {
                assertAppend(points.length);
                points.push(owned);
            }
        }
        if (points.length > 1 && sameXY(points[0], points[points.length - 1])) {
            if (!sameAttributes(points[0], points[points.length - 1]))
                fail('precision');
            points.pop();
        }
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                if (sameXY(points[i], points[j])) {
                    // A nonadjacent repeat is invalid even when all six attributes agree.
                    sameAttributes(points[i], points[j]);
                    fail('precision');
                }
            }
        }
        if (points.length < 3)
            return [];
        return finishPolygonWinding2D(preparation, points);
    };
    const policy = {
        maxCorners: 64,
        before,
        sameXY,
        sameAttributes,
        sameTuple,
        assertAppend,
        normalize
    };
    return Object.freeze(policy);
}
//# sourceMappingURL=texturedPreparationBudget2D.js.map