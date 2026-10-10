// First-party frozen prospective Task2 literals. No production imports.
// Arithmetic witnesses are separately bound by the preparation input manifest.
export const IDENTITY = Object.freeze({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
export const OPTIONS = Object.freeze({ pixelRatio: 1, maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304 });
export const HARD = Object.freeze({ maxSourceTriangles: 65536, maxPreparedVertices: 1048576,
  maxClipEdgeTests: 4194304, maxTupleComparisons: 1048576 });
export const ZERO_COUNTERS = Object.freeze({ authoredDegenerateTriangles: 0, singularSuppressedTriangles: 0,
  transformedCollapsedTriangles: 0, clippedCollapsedTriangles: 0, packedCollapsedTriangles: 0 });
export const INTERIOR = Object.freeze([
  Object.freeze([2, 2, 0, 0, 1, 0, 0, 1]),
  Object.freeze([6, 2, 1, 0, 0, 1, 0, 1 / 2]),
  Object.freeze([2, 6, 0, 1, 0, 0, 1, 1 / 4]),
]);
export const CLIPPED = Object.freeze([
  Object.freeze([2, 0, 1 / 4, 0, 3 / 4, 1 / 4, 0, 7 / 8]),
  Object.freeze([6, 0, 3 / 4, 0, 1 / 4, 3 / 4, 0, 5 / 8]),
  Object.freeze([6, 2, 3 / 4, 1 / 4, 0, 3 / 4, 1 / 4, 7 / 16]),
  Object.freeze([2, 6, 1 / 4, 3 / 4, 0, 1 / 4, 3 / 4, 5 / 16]),
]);
export const COMPLEMENT = Object.freeze({
  edgeA: Object.freeze({ x: 15.999999999999996, y: 36 }),
  edgeB: Object.freeze({ x: 16.000000000000004, y: -4 }),
  p: Object.freeze([4, 16, 1, 1, 1, 1, 1, 1]),
  q: Object.freeze([15.999999999999998, 28, 0, 0, 0, 0, 0, 0]),
  u: 480, v: 2 ** -46,
  // u+v rounds to 480; direct s = 2^-46/480 = 1/(15*2^51).
  // Represented binary64 s has hexadecimal bits 3c81111111111111.
  smallWeight: 2 ** -46 / 480, smallWeightBits: '3c81111111111111',
});
export const AFFINE_REVERSAL = Object.freeze({
  authored: Object.freeze([Object.freeze([0, 0]), Object.freeze([2 ** -34, 2 ** -34]),
    Object.freeze([3 * 2 ** -34, 13 * 2 ** -34 / 4])]),
  matrix: Object.freeze({ ...IDENTITY, tx: 2 ** 19 }),
  represented: Object.freeze([Object.freeze([2 ** 19, 0]), Object.freeze([2 ** 19, 2 ** -34]),
    Object.freeze([2 ** 19 + 4 * 2 ** -34, 13 * 2 ** -34 / 4])]),
  authoredDeterminant: Object.freeze({ integer: '1', exponent: -70 }),
  representedDeterminant: Object.freeze({ integer: '-1', exponent: -66 }),
});
export const PACKED_REVERSAL = Object.freeze({
  backing: Object.freeze([Object.freeze([12, 4]),
    Object.freeze([12 + 2 ** -21, 4 - 95 * 2 ** -27]),
    Object.freeze([12 + 2 ** -20, 4 - 161 * 2 ** -27])]),
  packed: Object.freeze([Object.freeze([.5, .5]),
    Object.freeze([.5 + 2 ** -24, .5 + 2 ** -24]),
    Object.freeze([.5 + 2 ** -23, .5 + 3 * 2 ** -24])]),
  bits: Object.freeze([Object.freeze(['3f000000', '3f000000']),
    Object.freeze(['3f000001', '3f000001']), Object.freeze(['3f000002', '3f000003'])]),
  determinants: Object.freeze([Object.freeze({ integer: '29', exponent: -48 }),
    Object.freeze({ integer: '-29', exponent: -54 }), Object.freeze({ integer: '1', exponent: -48 })]),
});
export const ACCOUNTING = Object.freeze({
  preparationPredicates: 30, packingPredicates: 1, totalPredicates: 31, tupleAttempts: 30,
  sourceTriangles: 1, preparedVertices: 3, admittedVertexBytes: 96, admittedUploadBytes: 112,
  // A/M/T=3; initial winding=3; four*(classify3+winding3)=24; pack=1.
  // Five normalizations each: adjacent2+closing1+remaining pairs3=6.
  tupleCap29PredicatesBeforeRefusal: 27,
});
