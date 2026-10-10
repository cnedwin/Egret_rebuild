import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
// Private geometry-unit exception from AGENTS; these are not public host tests.
// This file is prepared for R/tests/textured-preparation-budget.test.mjs.
import { copyFrame2D } from '../packages/engine/dist/rendering/copyFrame2D.js';
import {
  Preparation, GeometryPreparationError, prepareRectangles2D, clipPolygon2D,
} from '../packages/engine/dist/rendering/prepareRectangles2D.js';
import { prepareImage2D } from '../packages/engine/dist/rendering/prepareImages2D.js';
import { packedOrientation } from '../packages/engine/dist/rendering/packedOrientation.js';
import { packImageVertices2D } from '../packages/engine/dist/rendering/packImageVertices2D.js';
import { packWebGPUVertices } from '../packages/engine/dist/web/webgpuPass.js';

const BUDGET_URL = new URL('../packages/engine/dist/rendering/texturedPreparationBudget2D.js', import.meta.url);
let budgetModule = Object.freeze({});
try {
  budgetModule = await import(BUDGET_URL.href);
} catch (error) {
  // Only this exact absent new module may become the scheduled A01 assertion.
  // A missing dependency, parse error, or unrelated import fault is a setup failure.
  if (error?.code !== 'ERR_MODULE_NOT_FOUND' || error.url !== BUDGET_URL.href) throw error;
}

const HARD = Object.freeze({
  maxSourceTriangles: 65536,
  maxPreparedVertices: 1048576,
  maxClipEdgeTests: 4194304,
  maxTupleComparisons: 1048576,
});
const OPTIONS = Object.freeze({ pixelRatio: 1, maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304 });
const IDENTITY = Object.freeze({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
const COPY_OPTIONS = Object.freeze({ pixelRatio: 1, maxBackingPixels: 16777216, maxCommands: 65536, maxClipRectangles: 262144 });

function ledger(overrides = {}) {
  assert.equal(typeof budgetModule.TexturedPreparationBudget2D, 'function', 'Task1 ledger must exist');
  return new budgetModule.TexturedPreparationBudget2D({ ...HARD, ...overrides });
}
function meshPolicy(budget) {
  assert.equal(typeof budgetModule.createMeshClipPolicy2D, 'function', 'Private charged mesh policy must exist');
  return budgetModule.createMeshClipPolicy2D(budget);
}
function snapshot(budget, source, prepared, predicates, comparisons) {
  assert.deepEqual(budget.snapshot(), {
    sourceTrianglesCharged: source,
    preparedVerticesCharged: prepared,
    predicatesCharged: predicates,
    tupleComparisonsCharged: comparisons,
  });
}
const reason = expected => error => error instanceof GeometryPreparationError && error.reason === expected;
function tuple(x, y, attributes = {}) {
  return { x, y, u: 0, v: 0, r: 1, g: 1, b: 1, a: 1, ...attributes };
}
function rectCommand() {
  return { kind: 'rect', matrix: IDENTITY, rect: { x: 1, y: 1, width: 2, height: 2 }, color: 0xff0000, alpha: 1, clips: [] };
}
function rectangleFrame() {
  return { frameId: 1, width: 8, height: 8, clearColor: 0, clearAlpha: 0, commands: [rectCommand()] };
}
function imageCommand() {
  return { kind: 'image', matrix: IDENTITY, rect: { x: 1, y: 1, width: 2, height: 2 }, alpha: 1, clips: [], imageIndex: 0, sourceRect: { x: 0, y: 0, width: 1, height: 1 } };
}
function poisonPoint(counter) {
  return new Proxy({}, { get() { counter.reads++; throw new Error('Forbidden operand read after exhaustion'); } });
}
const IDENTITY_NORMALIZE = (_preparation, points) => [...points];
const ATTACH_CONSTANT = (_p, _q, _weight, _complementary, x, y) => tuple(x, y);

test('A01 new-profile ledger exists after genuine public geometry and accepted rectangle setup', () => {
  // Catches: missing budget API after a real successful accepted dependency setup.
  const geometry = egret.createTexturedGeometry2D({
    positions: new Float64Array([1, 1, 3, 1, 1, 3]),
    uvs: new Float64Array([0, 0, 1, 0, 0, 1]),
    lightColors: new Float64Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    indices: new Uint16Array([0, 1, 2]),
  });
  assert.equal(egret.isTexturedGeometry2D(geometry), true);
  assert.equal(geometry.vertexCount, 3);
  assert.equal(geometry.triangleCount, 1);
  const copied = copyFrame2D(rectangleFrame(), COPY_OPTIONS);
  const prepared = prepareRectangles2D(copied.frame, copied.width, copied.height, OPTIONS);
  assert.deepEqual(prepared, {
    points: [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }],
    commands: [{ pointIndices: [0, 1, 2, 3], color: 0xff0000, alpha: 1 }],
    edgeTests: 57,
  });
  assert.equal(typeof budgetModule.TexturedPreparationBudget2D, 'function', 'A01 missing TexturedPreparationBudget2D');
});

test('A02_SOURCE whole-count exact hard cap rejects a repeated occurrence without partial charge', () => {
  // Ledger unit, not a claim that authentic capture can supply hard-cap+1.
  const budget = ledger();
  budget.admitSourceTriangles(65536);
  snapshot(budget, 65536, 0, 0, 0);
  assert.throws(() => budget.admitSourceTriangles(1), reason('budget'));
  assert.throws(() => budget.admitSourceTriangles(65536), reason('budget'));
  snapshot(budget, 65536, 0, 0, 0);
});

test('A02_SOURCE_PREPARED subtraction admission keeps remaining capacity usable after rejected whole work', () => {
  const budget = ledger({ maxSourceTriangles: 2, maxPreparedVertices: 6 });
  budget.admitSourceTriangles(1);
  budget.admitPreparedVertices(3);
  assert.throws(() => budget.admitSourceTriangles(2), reason('budget'));
  assert.throws(() => budget.admitPreparedVertices(4), reason('budget'));
  snapshot(budget, 1, 3, 0, 0);
  budget.admitSourceTriangles(1);
  budget.admitPreparedVertices(3);
  snapshot(budget, 2, 6, 0, 0);
});

test('A02_COUNTS unsafe negative fractional and nonfinite whole debits never change counters', () => {
  const budget = ledger();
  for (const count of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => budget.admitSourceTriangles(count), reason('budget'));
    assert.throws(() => budget.admitPreparedVertices(count), reason('budget'));
    snapshot(budget, 0, 0, 0, 0);
  }
  budget.admitSourceTriangles(0);
  budget.admitPreparedVertices(0);
  snapshot(budget, 0, 0, 0, 0);
});

test('A02_PREPARED direct ledger hard-cap exact and plus-one are synthetic integer units', () => {
  const budget = ledger();
  budget.admitPreparedVertices(1048576);
  assert.throws(() => budget.admitPreparedVertices(1), reason('budget'));
  snapshot(budget, 0, 1048576, 0, 0);
});

test('A02_FAN synthetic fan-multiple aggregate first exceeds the prepared hard cap at 1048578', () => {
  // 349525 output triangles reserve 1048575; another output triangle reserves 3.
  // 1048578 is the smallest multiple of 3 above 1048576. This direct ledger
  // aggregate is not a public Mesh/source-triangle construction or host proof.
  const budget = ledger();
  budget.admitPreparedVertices(1048575);
  assert.throws(() => budget.admitPreparedVertices(3), reason('budget'));
  snapshot(budget, 0, 1048575, 0, 0);
  budget.admitPreparedVertices(1); // Direct synthetic residual-unit control.
  snapshot(budget, 0, 1048576, 0, 0);
});

for (const row of [
  { name: 'A02_PREDICATE', method: 'admitPredicate', count: 4194304, want: [0, 0, 4194304, 0] },
  { name: 'A03_TUPLE', method: 'admitTupleComparison', count: 1048576, want: [0, 0, 0, 1048576] },
]) {
  test(row.name + ' configured cap1 charges the first operation and rejects the second atomically', () => {
    const budget = ledger(row.method === 'admitPredicate' ? { maxClipEdgeTests: 1 } : { maxTupleComparisons: 1 });
    budget[row.method]();
    assert.throws(() => budget[row.method](), reason('budget'));
    snapshot(budget, 0, 0, row.method === 'admitPredicate' ? 1 : 0, row.method === 'admitTupleComparison' ? 1 : 0);
  });
  test(row.name + ' direct per-operation exact hard cap rejects the next attempt without refund', () => {
    const budget = ledger();
    for (let attempt = 0; attempt < row.count; attempt++) budget[row.method]();
    assert.throws(() => budget[row.method](), reason('budget'));
    snapshot(budget, ...row.want);
  });
}

test('A02_SIGN exhausted predicate ledger rejects before reading either geometry operand', () => {
  const budget = ledger({ maxClipEdgeTests: 1 });
  budget.admitPredicate();
  const preparation = new Preparation(OPTIONS, budget);
  const counter = { reads: 0 }, poison = poisonPoint(counter);
  assert.throws(() => preparation.sign(poison, poison, poison), reason('budget'));
  assert.equal(counter.reads, 0);
  snapshot(budget, 0, 0, 1, 0);
});

test('A02_CROSSING second determinant rejection retains first charge and avoids second-predicate operand read', () => {
  const budget = ledger({ maxClipEdgeTests: 1 });
  const preparation = new Preparation(OPTIONS, budget);
  let lateReads = 0, attachCalls = 0;
  const second = tuple(1, 2);
  Object.defineProperty(second, 'x', { get() {
    if (budget.snapshot().predicatesCharged >= 1) { lateReads++; throw new Error('Second determinant operand read'); }
    return 1;
  } });
  assert.throws(() => preparation.crossing(
    { x: 0, y: 0 }, { x: 0, y: 4 }, tuple(-1, 2), second,
    () => { attachCalls++; throw new Error('Crossing must not attach after exhaustion'); },
  ), reason('budget'));
  assert.equal(lateReads, 0);
  assert.equal(attachCalls, 0);
  snapshot(budget, 0, 0, 1, 0);
});

test('A02_RECT_IMAGE preparation and packing share the real ledger across legacy consumers', () => {
  // Frozen traversal prediction: rect57 + image37 + two fan predicates per pack.
  const budget = ledger({ maxClipEdgeTests: 98, maxPreparedVertices: 12 });
  const rectangle = prepareRectangles2D(rectangleFrame(), 8, 8, OPTIONS, budget);
  snapshot(budget, 0, 6, 57, 0);
  const image = prepareImage2D(imageCommand(), 8, 8, OPTIONS, budget);
  snapshot(budget, 0, 12, 94, 0);
  assert.equal(packWebGPUVertices(rectangle, 8, 8, { maxUploadBytes: 144, maxBufferSize: 144 }, budget).data.byteLength, 144);
  snapshot(budget, 0, 12, 96, 0);
  assert.equal(packImageVertices2D(image, 8, 8, 96, budget).data.byteLength, 96);
  snapshot(budget, 0, 12, 98, 0);
  assert.throws(() => packedOrientation(0, 0, 1, 0, 0, 1, budget), reason('budget'));
  snapshot(budget, 0, 12, 98, 0);
});

for (const row of [
  { kind: 'rect', predicates: 57, failAt: 56 },
  { kind: 'image', predicates: 37, failAt: 36 },
]) {
  test('A02_' + row.kind.toUpperCase() + ' configured one-below rejects its last actual preparation predicate', () => {
    const budget = ledger({ maxClipEdgeTests: row.failAt });
    const prepare = () => row.kind === 'rect'
      ? prepareRectangles2D(rectangleFrame(), 8, 8, OPTIONS, budget)
      : prepareImage2D(imageCommand(), 8, 8, OPTIONS, budget);
    assert.throws(prepare, reason('budget'));
    snapshot(budget, 0, 0, row.failAt, 0);
  });
  test('A02_' + row.kind.toUpperCase() + ' fan debit rejects before prepared output despite available predicate budget', () => {
    const budget = ledger({ maxPreparedVertices: 5 });
    const prepare = () => row.kind === 'rect'
      ? prepareRectangles2D(rectangleFrame(), 8, 8, OPTIONS, budget)
      : prepareImage2D(imageCommand(), 8, 8, OPTIONS, budget);
    assert.throws(prepare, reason('budget'));
    snapshot(budget, 0, 0, row.predicates, 0);
  });
}

test('A02_MESH_STAGE_SEAMS authored rank transformed and packed calls each consume one actual predicate', () => {
  // Existing generic private seam used by future Mesh stages; not a full Mesh preparer.
  const budget = ledger({ maxClipEdgeTests: 4 });
  const preparation = new Preparation(OPTIONS, budget);
  assert.equal(preparation.sign(tuple(2, 2), tuple(6, 2), tuple(2, 6)), 1); // A
  assert.equal(preparation.sign(tuple(0, 0), tuple(1, 0), tuple(0, 1)), 1); // M
  assert.equal(preparation.sign(tuple(3, 3), tuple(7, 3), tuple(3, 7)), 1); // T
  assert.equal(packedOrientation(-.5, .5, .5, .5, -.5, -.5, budget), -1); // Packed
  snapshot(budget, 0, 0, 4, 0);
  assert.throws(() => preparation.sign(tuple(0, 0), tuple(1, 0), tuple(0, 1)), reason('budget'));
  snapshot(budget, 0, 0, 4, 0);
});

test('A02_COLLAPSE packing suppression keeps the admitted fan charge', () => {
  const budget = ledger({ maxPreparedVertices: 3, maxClipEdgeTests: 1 });
  budget.admitPreparedVertices(3); // Private already-prepared triangle fixture.
  const prepared = {
    points: [{ x: 1, y: 1, u: 0, v: 0 }, { x: 9, y: 1, u: 1, v: 0 }, { x: 1, y: 1 + 2 ** -40, u: 0, v: 1 }],
    pointIndices: [0, 1, 2], imageIndex: 0, sourceRect: { x: 0, y: 0, width: 1, height: 1 }, alpha: 1, edgeTests: 0,
  };
  const packed = packImageVertices2D(prepared, 16, 16, 48, budget);
  assert.equal(packed.vertexCount, 0);
  assert.equal(packed.data.byteLength, 0);
  assert.equal(packed.collapsedTriangles, 1);
  snapshot(budget, 0, 3, 1, 0);
});

test('A03_ORDER exhausted canonical-order comparison reads neither operand', () => {
  const budget = ledger({ maxTupleComparisons: 1 }), policy = meshPolicy(budget), counter = { reads: 0 };
  assert.equal(policy.before(tuple(0, 0), tuple(1, 0)), true);
  assert.throws(() => policy.before(poisonPoint(counter), poisonPoint(counter)), reason('budget'));
  assert.equal(counter.reads, 0);
  snapshot(budget, 0, 0, 0, 1);
});

test('A03_XY early mismatch charges one attempt and never accesses attributes', () => {
  const budget = ledger({ maxTupleComparisons: 1 }), policy = meshPolicy(budget);
  let attributes = 0;
  const left = tuple(0, 0), right = tuple(1, 0);
  for (const point of [left, right]) Object.defineProperty(point, 'u', { get() { attributes++; throw new Error('Early mismatch attribute read'); } });
  assert.equal(policy.sameTuple(left, right), false);
  assert.equal(attributes, 0);
  snapshot(budget, 0, 0, 0, 1);
});

test('A03_ATTRIBUTES agreeing XY requires a second debit before any full-attribute comparison', () => {
  const budget = ledger({ maxTupleComparisons: 1 }), policy = meshPolicy(budget);
  let reads = 0;
  const left = tuple(0, 0), right = tuple(0, 0);
  for (const point of [left, right]) Object.defineProperty(point, 'u', { get() { reads++; throw new Error('Attribute read after exhausted XY debit'); } });
  assert.throws(() => policy.sameTuple(left, right), reason('budget'));
  assert.equal(reads, 0);
  snapshot(budget, 0, 0, 0, 1);
  const two = ledger({ maxTupleComparisons: 2 });
  assert.equal(meshPolicy(two).sameTuple(tuple(0, 0), tuple(0, 0)), true);
  snapshot(two, 0, 0, 0, 2);
});

test('A03_NORMALIZE distinct triangle charges adjacent closing and all remaining XY pairs before winding', () => {
  // Reviewed policy schedule:2 adjacent+1 closing+3 i<j pairs=6; winding3.
  const input = [tuple(2, 2), tuple(6, 2), tuple(2, 6)];
  const exact = ledger({ maxTupleComparisons: 6, maxClipEdgeTests: 3 }), exactPolicy = meshPolicy(exact);
  assert.deepEqual(exactPolicy.normalize(new Preparation(OPTIONS, exact), input), input);
  snapshot(exact, 0, 0, 3, 6);
  const over = ledger({ maxTupleComparisons: 5 });
  assert.throws(() => meshPolicy(over).normalize(new Preparation(OPTIONS, over), input), reason('budget'));
  snapshot(over, 0, 0, 0, 5);
});

test('A03_NORMALIZE adjacent closing full tuples deduplicate with ten charged comparisons', () => {
  const a = tuple(2, 2), b = tuple(6, 2), c = tuple(2, 6);
  const budget = ledger({ maxTupleComparisons: 10, maxClipEdgeTests: 3 }), policy = meshPolicy(budget);
  assert.deepEqual(policy.normalize(new Preparation(OPTIONS, budget), [a, { ...a }, b, c, { ...a }]), [a, b, c]);
  //5 adjacent attempts (one matching XY+attributes),2 closing,3 remaining pairs.
  snapshot(budget, 0, 0, 3, 10);
});

test('A03_NORMALIZE equal XY unequal attributes and nonadjacent repetition cannot get free work', () => {
  const a = tuple(2, 2), b = tuple(6, 2), c = tuple(2, 6);
  const conflict = ledger(), repeat = ledger();
  assert.throws(() => meshPolicy(conflict).normalize(new Preparation(OPTIONS, conflict), [a, { ...a, u: 1 }, b, c]), reason('precision'));
  snapshot(conflict, 0, 0, 0, 2);
  assert.throws(() => meshPolicy(repeat).normalize(new Preparation(OPTIONS, repeat), [a, b, c, { ...b }]), reason('precision'));
  //3 adjacent+1 closing+five pair XY attempts+one agreeing pair attribute attempt.
  snapshot(repeat, 0, 0, 0, 10);
});

for (const row of [{ cap: 5, watched: 'x' }, { cap: 6, watched: 'u' }]) {
  test('A03_CACHE both endpoint comparisons reject before ' + row.watched + ' access at tuple cap' + row.cap, () => {
    const budget = ledger({ maxTupleComparisons: row.cap }), policy = meshPolicy(budget);
    let lateReads = 0;
    const p = tuple(-1, 1), q = tuple(1, 1);
    Object.defineProperty(q, row.watched, { get() {
      if (budget.snapshot().tupleComparisonsCharged >= row.cap) { lateReads++; throw new Error('Unadmitted cache operand'); }
      return row.watched === 'x' ? 1 : 0;
    } });
    const clip = [{ x: 0, y: 4 }, { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }];
    // Deliberate trusted generic-cache unit: repeated source edges and identity
    // normalization isolate cache accounting, not a valid public Mesh polygon.
    assert.throws(() => clipPolygon2D(new Preparation(OPTIONS, budget), [p, q, p, q], clip, IDENTITY_NORMALIZE, ATTACH_CONSTANT, policy), reason('budget'));
    assert.equal(lateReads, 0);
    snapshot(budget, 0, 0, 6, row.cap);
  });
}

test('A03_CACHE repeated canonical edge reuses its full constant tuple with seventeen comparison attempts', () => {
  const budget = ledger({ maxTupleComparisons: 17, maxClipEdgeTests: 24 }), policy = meshPolicy(budget);
  const p = tuple(-1, 1), q = tuple(1, 1);
  const clip = [{ x: 0, y: 4 }, { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }];
  const out = clipPolygon2D(new Preparation(OPTIONS, budget), [p, q, p, q], clip, IDENTITY_NORMALIZE, ATTACH_CONSTANT, policy);
  assert.deepEqual(out.map(point => [point.x, point.y]), [[0, 1], [1, 1], [0, 1], [0, 1], [1, 1], [0, 1]]);
  //First edge:4 canonical orders+1 crossing order+3 cache hits*4; predicates4+2.
  //Remaining three edges classify6 each; no crossings/comparisons.
  snapshot(budget, 0, 0, 24, 17);
});

test('A03_CORNERS mesh64 append and legacy1024 append remain independent inclusive bounds', () => {
  const clip = [{ x: 0, y: 0 }, { x: 2048, y: 0 }, { x: 2048, y: 4 }, { x: 0, y: 4 }];
  const points = count => Array.from({ length: count }, (_, index) => tuple(index + 1, 1));
  const mesh = ledger(), policy = meshPolicy(mesh);
  assert.equal(clipPolygon2D(new Preparation(OPTIONS, mesh), points(64), clip, IDENTITY_NORMALIZE, ATTACH_CONSTANT, policy).length, 64);
  snapshot(mesh, 0, 0, 256, 0);
  const meshOver = ledger();
  assert.throws(() => clipPolygon2D(new Preparation(OPTIONS, meshOver), points(65), clip, IDENTITY_NORMALIZE, ATTACH_CONSTANT, meshPolicy(meshOver)), reason('budget'));
  snapshot(meshOver, 0, 0, 65, 0);
  assert.equal(clipPolygon2D(new Preparation(OPTIONS), points(1024), clip, IDENTITY_NORMALIZE, ATTACH_CONSTANT).length, 1024);
  assert.throws(() => clipPolygon2D(new Preparation(OPTIONS), points(1025), clip, IDENTITY_NORMALIZE, ATTACH_CONSTANT), reason('budget'));
  //Private generic append units use collinear input+identity normalization.
  //Storage guard placement itself still requires a source audit before push.
});

test('A03_CORNERS proposed mesh append guard accepts length63 and rejects length64 without operand work', () => {
  const budget = ledger(), policy = meshPolicy(budget);
  policy.assertAppend(63);
  assert.throws(() => policy.assertAppend(64), reason('budget'));
  snapshot(budget, 0, 0, 0, 0);
});

test('A04_LEGACY argument omission preserves rectangle points counts and permissive image UV packing', () => {
  const prepared = prepareRectangles2D(rectangleFrame(), 8, 8, OPTIONS);
  assert.equal(prepared.edgeTests, 57);
  assert.deepEqual(prepared.points, [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }]);
  assert.equal(packWebGPUVertices(prepared, 8, 8, { maxUploadBytes: 144, maxBufferSize: 144 }).data.byteLength, 144);
  const image = {
    points: [{ x: 1, y: 1, u: -1, v: 2 }, { x: 3, y: 1, u: 2, v: 2 }, { x: 1, y: 3, u: -1, v: -1 }],
    pointIndices: [0, 1, 2], imageIndex: 0, sourceRect: { x: 0, y: 0, width: 1, height: 1 }, alpha: 1, edgeTests: 0,
  };
  const packed = packImageVertices2D(image, 8, 8, 48);
  assert.equal(packed.vertexCount, 3);
  assert.deepEqual([...packed.data].filter((_value, index) => index % 4 >= 2), [-1, 2, 2, 2, -1, -1]);
});
