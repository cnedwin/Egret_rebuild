import { noteOwnedPreparationFailure } from './ownedPreparationFailure2D.js';
import { GeometryPreparationError } from './prepareRectangles2D.js';
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
//# sourceMappingURL=texturedPreparationBudget2D.js.map