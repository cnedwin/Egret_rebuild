import { noteOwnedPreparationFailure } from './ownedPreparationFailure2D.js';
import type { PreparedStageCost2D } from './prepareRectangles2D.js';
import { GeometryPreparationError } from './prepareRectangles2D.js';
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
function fail(reason: 'precision' | 'budget'): never {
  throw noteOwnedPreparationFailure(new GeometryPreparationError(reason));
}
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
      maxTupleComparisons: limit(limits.maxTupleComparisons, 1_048_576)
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
  /** The three charges a stage replays, as they stand; a stage's cost is their difference across it. */
  public get preparedVerticesCharged(): number {
    return this.#preparedVerticesCharged;
  }
  public get predicatesCharged(): number {
    return this.#predicatesCharged;
  }
  public get tupleComparisonsCharged(): number {
    return this.#tupleComparisonsCharged;
  }
  /** A rejected replay changes no dimension; the original stage then decides its first error. */
  public tryReplayStageCost(cost: PreparedStageCost2D): boolean {
    const vertices = cost.preparedVertices,
      predicates = cost.predicates,
      tuples = cost.tupleComparisons;
    if (
      !Number.isSafeInteger(vertices) ||
      vertices < 0 ||
      vertices > this.#limits.maxPreparedVertices - this.#preparedVerticesCharged ||
      !Number.isSafeInteger(predicates) ||
      predicates < 0 ||
      predicates > this.#limits.maxClipEdgeTests - this.#predicatesCharged ||
      !Number.isSafeInteger(tuples) ||
      tuples < 0 ||
      tuples > this.#limits.maxTupleComparisons - this.#tupleComparisonsCharged
    )
      return false;
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
      tupleComparisonsCharged: this.#tupleComparisonsCharged
    });
  }
}
