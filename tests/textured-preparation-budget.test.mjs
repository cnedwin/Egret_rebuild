import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
// Private geometry-unit exception from AGENTS; these are not public host tests.
// This file is prepared for R/tests/textured-preparation-budget.test.mjs.
import { copyFrame2D } from '../packages/engine/dist/rendering/copyFrame2D.js';
import {
  Preparation, GeometryPreparationError, prepareRectangles2D, clipPolygon2D,
} from '../packages/engine/dist/rendering/prepareRectangles2D.js';
import { prepareImage2D, normalizeImagePolygon } from '../packages/engine/dist/rendering/prepareImages2D.js';
import { prepareTexturedMesh2D } from '../packages/engine/dist/rendering/prepareTexturedMesh2D.js';
import { packedOrientation } from '../packages/engine/dist/rendering/packedOrientation.js';
import * as rectanglePreparation from '../packages/engine/dist/rendering/prepareRectangles2D.js';
import * as texturedPreparation from '../packages/engine/dist/rendering/prepareTexturedDraws2D.js';
import { admitTexturedFrame2D } from '../packages/engine/dist/rendering/admitTexturedFrame2D.js';
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


// These private units use real normalization and ledgers. Explicit opt-in stands
// for the ordinary TEXTURED Host-owned call chain, not a public helper default.
const CONTAINED_CLIP = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
function containedAttempt(preparation, points, clip, kind) {
  assert.equal(typeof preparation.tryContainedClip, 'function', 'contained clip operation must exist');
  return preparation.tryContainedClip(points, clip, kind);
}
function f64Rows(points, fields) {
  const bytes = Buffer.alloc(points.length * fields.length * 8);
  let offset = 0;
  for (const point of points) for (const field of fields) { bytes.writeDoubleLE(point[field], offset); offset += 8; }
  return bytes;
}

test('A05_CONTAINED rectangle keeps literal vertices and the original classification and normalization debit', () => {
  // Catches skipping the repeat-normalize cost or returning a reordered polygon.
  const budget = ledger(), preparation = new Preparation(OPTIONS, budget, true);
  const literal = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
  const normalized = preparation.normalize(literal);
  snapshot(budget, 0, 0, 8, 0);
  const output = containedAttempt(preparation, normalized, CONTAINED_CLIP, 'rectangle');
  assert.deepEqual(output, literal); assert.notEqual(output, normalized);
  assert.ok(output.every((point, index) => point === normalized[index]));
  assert.equal(preparation.edgeTests, 56); snapshot(budget, 0, 0, 56, 0);
});

test('A05_CONTAINED image retains collinear UV values and their exact floating-point bytes', () => {
  // Catches treating image normalization like rectangle collinear removal.
  const literal = [{ x: 0, y: 0, u: -0, v: 0 }, { x: 1, y: 0, u: .125, v: 0 },
    { x: 2, y: 0, u: .75, v: 0 }, { x: 2, y: 2, u: 1, v: 1 }, { x: 0, y: 2, u: 0, v: 1 }];
  const normalized = normalizeImagePolygon(literal, OPTIONS).points;
  const budget = ledger(), preparation = new Preparation(OPTIONS, budget, true);
  const output = containedAttempt(preparation, normalized, CONTAINED_CLIP, 'image');
  assert.deepEqual(output, literal); assert.equal(output.length, 5);
  assert.deepEqual(f64Rows(output, ['x', 'y', 'u', 'v']), f64Rows(literal, ['x', 'y', 'u', 'v']));
  assert.ok(output.every((point, index) => point === normalized[index]));
  assert.equal(preparation.edgeTests, 40); snapshot(budget, 0, 0, 40, 0);
});

test('A05_CONTAINED mesh retains every collinear attribute and the original predicate and tuple debits', () => {
  // Five corners: normalization costs 5 predicates/15 tuples; contained clipping
  // costs 40 predicates/60 tuples, without removing the authored middle color.
  const literal = [tuple(0, 0), tuple(1, 0, { u: .125, r: .25, g: .5, b: .75, a: .5 }),
    tuple(2, 0, { u: .75 }), tuple(2, 2, { u: 1, v: 1 }), tuple(0, 2, { v: 1 })];
  const budget = ledger(), preparation = new Preparation(OPTIONS, budget, true);
  const normalized = meshPolicy(budget).normalize(preparation, literal);
  snapshot(budget, 0, 0, 5, 15);
  const output = containedAttempt(preparation, normalized, CONTAINED_CLIP, 'mesh');
  assert.deepEqual(output, literal); assert.equal(output.length, 5);
  assert.deepEqual(f64Rows(output, ['x', 'y', 'u', 'v', 'r', 'g', 'b', 'a']), f64Rows(literal, ['x', 'y', 'u', 'v', 'r', 'g', 'b', 'a']));
  assert.ok(output.every((point, index) => point !== normalized[index]));
  assert.equal(preparation.edgeTests, 45); snapshot(budget, 0, 0, 45, 75);
});

for (const row of [
  { label: 'predicate one short', predicates: 26, tuples: 30, local: 4194304, final: [26, 30] },
  { label: 'tuple one short', predicates: 27, tuples: 29, local: 4194304, final: [24, 29] },
  { label: 'both one short', predicates: 26, tuples: 29, local: 4194304, final: [24, 29] },
  { label: 'local predicate one short', predicates: 27, tuples: 30, local: 26, final: [26, 30] },
]) {
  test('A05_CONTAINED atomic miss preserves the original first refusal and partial debits: ' + row.label, () => {
    // Catches partial precharging, a direct shortcut refusal, or reordered dimensions.
    const budget = ledger({ maxClipEdgeTests: row.predicates, maxTupleComparisons: row.tuples });
    const preparation = new Preparation({ ...OPTIONS, maxClipEdgeTests: row.local }, budget, true), policy = meshPolicy(budget);
    const points = policy.normalize(preparation, [tuple(0, 0), tuple(4, 0), tuple(0, 4)]);
    assert.equal(containedAttempt(preparation, points, CONTAINED_CLIP, 'mesh'), undefined);
    assert.equal(preparation.edgeTests, 3); snapshot(budget, 0, 0, 3, 6);
    assert.throws(() => clipPolygon2D(preparation, points, CONTAINED_CLIP, policy.normalize, ATTACH_CONSTANT, policy), reason('budget'));
    assert.equal(preparation.edgeTests, row.final[0]); snapshot(budget, 0, 0, ...row.final);
  });
}

test('A05_CONTAINED exact mesh admission retains the original complete logical quota', () => {
  const budget = ledger({ maxClipEdgeTests: 27, maxTupleComparisons: 30 });
  const preparation = new Preparation({ ...OPTIONS, maxClipEdgeTests: 27 }, budget, true);
  const points = meshPolicy(budget).normalize(preparation, [tuple(0, 0), tuple(4, 0), tuple(0, 4)]);
  assert.deepEqual(containedAttempt(preparation, points, CONTAINED_CLIP, 'mesh'), points);
  assert.equal(preparation.edgeTests, 27); snapshot(budget, 0, 0, 27, 30);
});

test('A05_CONTAINED missing ledger and default context do not inspect operands or authorize replay', () => {
  // Catches tryReplayPreparedStage2D(undefined) being mistaken for Host authority.
  const noReplay = { admitPreparedVertices() { throw new Error('unexpected vertex debit'); }, admitPredicate() { throw new Error('unexpected predicate debit'); } };
  for (const preparation of [new Preparation(OPTIONS), new Preparation(OPTIONS, undefined, true), new Preparation(OPTIONS, ledger()),
    new Preparation(OPTIONS, noReplay, true)]) {
    const counter = { reads: 0 }, points = [poisonPoint(counter), poisonPoint(counter), poisonPoint(counter)];
    assert.equal(containedAttempt(preparation, points, CONTAINED_CLIP, 'rectangle'), undefined);
    assert.equal(counter.reads, 0); assert.equal(preparation.edgeTests, 0);
  }
});

test('A05_CONTAINED a custom default budget retains each original callback and its exact exception', () => {
  const failure = new Error('twelfth predicate callback'), calls = { predicates: 0, replay: 0 };
  const budget = { admitPreparedVertices() {}, admitPredicate() { if (++calls.predicates === 12) throw failure; },
    tryReplayStageCost() { calls.replay++; throw new Error('custom replay must not run'); } };
  assert.throws(() => prepareRectangles2D(rectangleFrame(), 8, 8, OPTIONS, budget), error => error === failure);
  assert.deepEqual(calls, { predicates: 12, replay: 0 });
});

test('A05_CONTAINED outside, noncanonical, degenerate and reversed clips leave the original path untouched', () => {
  const outside = [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
  const budget = ledger(), preparation = new Preparation(OPTIONS, budget, true);
  const points = preparation.normalize([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }]);
  const before = budget.snapshot(), count = preparation.edgeTests;
  for (const [subject, clip] of [[outside, CONTAINED_CLIP], [points, [...CONTAINED_CLIP].reverse()],
    [points, CONTAINED_CLIP.slice(1).concat(CONTAINED_CLIP[0])], [points, CONTAINED_CLIP.map(point => ({ ...point, x: 0 }))],
    [points, [{ x: 0, y: 0 }, { x: 4, y: 1 }, { x: 3, y: 4 }, { x: -1, y: 3 }]], [points, []]]) {
    assert.equal(containedAttempt(preparation, subject, clip, 'rectangle'), undefined);
    assert.deepEqual(budget.snapshot(), before); assert.equal(preparation.edgeTests, count);
  }
});

test('A05_CONTAINED opted-in complete rectangle and image helpers retain literal results and cumulative failure quotas', () => {
  const rectangleBudget = ledger(), imageBudget = ledger();
  const rectangle = prepareRectangles2D(rectangleFrame(), 8, 8, OPTIONS, rectangleBudget, undefined, undefined, undefined, true);
  assert.deepEqual(rectangle.points, [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }]);
  assert.equal(rectangle.edgeTests, 57); snapshot(rectangleBudget, 0, 6, 57, 0);
  const image = prepareImage2D(imageCommand(), 8, 8, OPTIONS, imageBudget, undefined, true);
  assert.deepEqual(image.points, [{ x: 1, y: 1, u: 0, v: 0 }, { x: 3, y: 1, u: 1, v: 0 },
    { x: 3, y: 3, u: 1, v: 1 }, { x: 1, y: 3, u: 0, v: 1 }]);
  assert.equal(image.edgeTests, 37); snapshot(imageBudget, 0, 6, 37, 0);
  const repeated = { ...rectangleFrame(), commands: [rectCommand(), rectCommand()] }, short = ledger();
  assert.throws(() => prepareRectangles2D(repeated, 8, 8, { ...OPTIONS, maxClipEdgeTests: 113 }, short,
    undefined, undefined, undefined, true), reason('budget'));
  snapshot(short, 0, 6, 113, 0);
  const exact = ledger(), result = prepareRectangles2D(repeated, 8, 8, { ...OPTIONS, maxClipEdgeTests: 114 }, exact,
    undefined, undefined, undefined, true);
  assert.equal(result.points.length, 8); assert.equal(result.edgeTests, 114); snapshot(exact, 0, 12, 114, 0);
});

test('A05_CONTAINED complete mesh helper retains literal full tuples and original authored checks', () => {
  const geometry = egret.createTexturedGeometry2D({ positions: new Float64Array([0, 0, 4, 0, 0, 4]),
    uvs: new Float64Array([0, 0, 1, 0, 0, 1]), lightColors: new Float64Array([1, 0, 0, 1, 0, 1, 0, .5, 0, 0, 1, .25]), indices: new Uint16Array([0, 1, 2]) });
  const command = { kind: 'mesh', matrix: IDENTITY, alpha: 1, clips: [], imageIndex: 0, sourceRect: { x: 0, y: 0, width: 1, height: 1 }, geometryIndex: 0 };
  const budget = ledger(); budget.admitSourceTriangles(1);
  const result = prepareTexturedMesh2D(command, geometry, 4, 4, OPTIONS, budget, undefined, true);
  assert.deepEqual(result.polygons, [[tuple(0, 0, { r: 1, g: 0, b: 0 }), tuple(4, 0, { u: 1, r: 0, g: 1, b: 0, a: .5 }),
    tuple(0, 4, { v: 1, r: 0, g: 0, b: 1, a: .25 })]]);
  snapshot(budget, 1, 3, 30, 30);
  assert.deepEqual(result.counters, { authoredDegenerateTriangles: 0, singularSuppressedTriangles: 0,
    transformedCollapsedTriangles: 0, clippedCollapsedTriangles: 0, packedCollapsedTriangles: 0 });
  for (const enabled of [false, true]) {
    const badLaterClip = { matrix: { ...IDENTITY, tx: 2 ** 21 }, rect: { x: 0, y: 0, width: 4, height: 4 } };
    assert.throws(() => prepareTexturedMesh2D({ ...command, alpha: 0, clips: [badLaterClip] }, geometry, 4, 4,
      OPTIONS, ledger(), undefined, enabled), reason('range'));
  }
});

// Private geometry units exercise the real dispatcher, numeric preparation and
// ledger. A context here models the already authenticated ordinary Host call.
const CLIP_ADMISSION = Object.freeze({ ...OPTIONS, maxBackingPixels: 16777216, maxCommands: 65536,
  maxClipRectangles: 262144, maxSourceTriangles: 65536, maxFrameGeometryBytes: 16777216 });
function clipRecord(x = 0) {
  return Object.freeze({ matrix: Object.freeze({ ...IDENTITY }),
    rect: Object.freeze({ x, y: 0, width: 8, height: 8 }) });
}
function clipFixture(commands) {
  const image = egret.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([255, 128, 64, 255]) });
  const geometry = egret.createTexturedGeometry2D({ positions: new Float64Array([1, 1, 3, 1, 1, 3]),
    uvs: new Float64Array([0, 0, 1, 0, 0, 1]), lightColors: new Float64Array(12).fill(1), indices: new Uint16Array([0, 1, 2]) });
  const frame = { profile: egret.TEXTURED_FRAME_PROFILE_2D, frameId: 1, width: 8, height: 8,
    clearColor: 0, clearAlpha: 0, images: [image], geometries: [geometry], commands };
  return frame;
}
function clipMesh(clips) {
  return { kind: 'mesh', matrix: IDENTITY, alpha: 1, clips, imageIndex: 0,
    sourceRect: { x: 0, y: 0, width: 1, height: 1 }, geometryIndex: 0 };
}
function dispatchClipFrame(frame, enabled, options = OPTIONS, budget = ledger()) {
  const admitted = admitTexturedFrame2D(frame, { ...CLIP_ADMISSION, ...options }, budget);
  const draws = texturedPreparation.prepareTexturedDraws2D(admitted, options, budget, undefined, enabled);
  return { draws, budget: budget.snapshot() };
}
function clipContext(options, budget) {
  assert.equal(typeof texturedPreparation.createClipRectangleContext2D, 'function', 'private call-local clip context must exist');
  return texturedPreparation.createClipRectangleContext2D(options, budget);
}
function closeClipContext(context) {
  assert.equal(typeof rectanglePreparation.clearClipRectangleContext2D, 'function', 'private clip context cleanup must exist');
  rectanglePreparation.clearClipRectangleContext2D(context);
}
function prepareClip(preparation, clip, context) {
  assert.equal(typeof preparation.clipRectangle, 'function', 'clip-only preparation operation must exist');
  return preparation.clipRectangle(clip, context);
}
function observeRectangles(targets, run) {
  const original = Preparation.prototype.rectangle, calls = new Map([...targets].map(clip => [clip, 0]));
  Preparation.prototype.rectangle = function(input) {
    if (calls.has(input)) calls.set(input, calls.get(input) + 1);
    return original.call(this, input);
  };
  try { return { value: run(), calls }; }
  finally { Preparation.prototype.rectangle = original; }
}

test('A06_CLIP_REUSE shared clips across rectangle image and mesh preserve full output and all semantic debits', () => {
  const clip = clipRecord(), clips = Object.freeze([clip]);
  const commands = [{ ...rectCommand(), clips }, { ...imageCommand(), clips }, clipMesh(clips),
    { ...rectCommand(), clips }, { ...imageCommand(), clips }, clipMesh(clips)];
  const frame = clipFixture(commands), cold = observeRectangles([clip], () => dispatchClipFrame(frame, false));
  const reused = observeRectangles([clip], () => dispatchClipFrame(frame, true));
  assert.equal(cold.calls.get(clip), 6);
  assert.equal(reused.calls.get(clip), 1, 'one successful clip calculation must serve all three paths');
  assert.deepStrictEqual(reused.value, cold.value);
  assert.deepEqual(reused.value.draws[0].prepared.points,
    [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }]);
});

test('A06_CLIP_REUSE distinct identity and later calls with another ratio cannot share entries', () => {
  const first = clipRecord(), second = clipRecord(), frame = clipFixture([
    { ...imageCommand(), clips: [first, second] }, { ...imageCommand(), clips: [first, second] }]);
  for (const ratio of [1, 2, 1]) {
    const options = { ...OPTIONS, pixelRatio: ratio };
    const cold = dispatchClipFrame(frame, false, options);
    const reused = observeRectangles([first, second], () => dispatchClipFrame(frame, true, options));
    assert.deepStrictEqual(reused.value, cold);
    assert.deepEqual([...reused.calls.values()], [1, 1]);
  }
});

test('A06_CLIP_REUSE capacity retains 64 identities while the 65th remains cold and earlier entries remain usable', () => {
  const clips = Array.from({ length: 65 }, () => clipRecord());
  const budget = ledger(), context = clipContext(OPTIONS, budget);
  try {
    const preparation = new Preparation(OPTIONS, budget, true);
    const observed = observeRectangles(clips, () => {
      for (const clip of clips) prepareClip(preparation, clip, context);
      prepareClip(preparation, clips[0], context);
      prepareClip(preparation, clips[64], context);
    });
    assert.equal(context.entries.size, 64);
    assert.equal(observed.calls.get(clips[0]), 1);
    assert.equal(observed.calls.get(clips[64]), 2);
    assert.equal(preparation.edgeTests, 67 * 9);
    snapshot(budget, 0, 0, 67 * 9, 0);
  } finally { closeClipContext(context); }
  assert.equal(context.active, false); assert.equal(context.entries, undefined);
});

for (const dimension of ['local', 'global']) {
  test('A06_CLIP_REUSE ' + dimension + ' replay refusal preserves the original first error and partial predicate count', () => {
    const clip = clipRecord(), frame = clipFixture([{ ...rectCommand(), clips: [clip] }, { ...rectCommand(), clips: [clip] }]);
    const outcomes = [];
    for (const enabled of [false, true]) {
      const budget = ledger(dimension === 'global' ? { maxClipEdgeTests: 131 } : {});
      const options = dimension === 'local' ? { ...OPTIONS, maxClipEdgeTests: 131 } : OPTIONS;
      assert.throws(() => dispatchClipFrame(frame, enabled, options, budget), reason('budget'));
      outcomes.push(budget.snapshot());
    }
    assert.deepEqual(outcomes[1], outcomes[0]);
    assert.deepEqual(outcomes[1], { sourceTrianglesCharged: 0, preparedVerticesCharged: 6,
      predicatesCharged: 131, tupleComparisonsCharged: 0 });
  });
}

test('A06_CLIP_REUSE successful empty clips are reusable but later invalid clips remain ordered before suppression', () => {
  const empty = Object.freeze({ matrix: IDENTITY, rect: Object.freeze({ x: 0, y: 0, width: 0, height: 8 }) });
  const budget = ledger(), context = clipContext(OPTIONS, budget), preparation = new Preparation(OPTIONS, budget, true);
  try {
    const observed = observeRectangles([empty], () => [prepareClip(preparation, empty, context), prepareClip(preparation, empty, context)]);
    assert.deepEqual(observed.value, [[], []]); assert.equal(observed.calls.get(empty), 1);
    snapshot(budget, 0, 0, 2, 0);
  } finally { closeClipContext(context); }
  const good = clipRecord(), bad = Object.freeze({ matrix: Object.freeze({ ...IDENTITY, tx: 2 ** 21 }), rect: good.rect });
  for (const command of [{ ...rectCommand(), alpha: 0 }, { ...imageCommand(), alpha: 0 }, { ...clipMesh([]), alpha: 0 },
    { ...rectCommand(), rect: { x: 1, y: 1, width: 0, height: 2 } }]) {
    const outcomes = [];
    for (const enabled of [false, true]) {
      const current = ledger(), selected = enabled ? clipContext(OPTIONS, current) : undefined;
      try {
        // Direct numeric units deliberately reach the preparation preflight:
        // ordinary metadata admission would reject this range error earlier.
        prepareClip(new Preparation(OPTIONS, current, enabled), good, selected);
        const target = { ...command, clips: [good, bad] };
        if (command.kind === 'rect') {
          assert.throws(() => prepareRectangles2D({ ...rectangleFrame(), commands: [target] }, 8, 8,
            OPTIONS, current, undefined, undefined, undefined, enabled, selected), reason('range'));
        } else if (command.kind === 'image') {
          assert.throws(() => prepareImage2D(target, 8, 8, OPTIONS, current, undefined, enabled, selected), reason('range'));
        } else {
          const geometry = clipFixture([]).geometries[0];
          current.admitSourceTriangles(geometry.triangleCount);
          assert.throws(() => prepareTexturedMesh2D(target, geometry, 8, 8,
            OPTIONS, current, undefined, enabled, selected), reason('range'));
        }
        outcomes.push(current.snapshot());
      } finally { closeClipContext(selected); }
    }
    assert.deepEqual(outcomes[1], outcomes[0]);
  }
});

test('A06_CLIP_REUSE failed rectangle calculations never publish entries or hide a repeated original error', () => {
  const bad = { matrix: { ...IDENTITY, tx: 2 ** 21 }, rect: { x: 0, y: 0, width: 8, height: 8 } };
  const budget = ledger(), context = clipContext(OPTIONS, budget), preparation = new Preparation(OPTIONS, budget, true);
  try {
    const observed = observeRectangles([bad], () => {
      assert.throws(() => prepareClip(preparation, bad, context), reason('range'));
      assert.throws(() => prepareClip(preparation, bad, context), reason('range'));
    });
    assert.equal(observed.calls.get(bad), 2); assert.equal(context.entries.size, 0);
    snapshot(budget, 0, 0, 0, 0);
  } finally { closeClipContext(context); }
});

test('A06_CLIP_REUSE context binding and explicit closure keep mismatched and later calls cold', () => {
  const clip = clipRecord(), budget = ledger(), context = clipContext(OPTIONS, budget);
  try {
    prepareClip(new Preparation(OPTIONS, budget, true), clip, context);
    const other = ledger(), changed = { ...OPTIONS, pixelRatio: 2 };
    const observed = observeRectangles([clip], () => [
      prepareClip(new Preparation(changed, budget, true), clip, context),
      prepareClip(new Preparation(OPTIONS, other, true), clip, context),
      prepareClip(new Preparation(OPTIONS, budget), clip, context),
    ]);
    assert.equal(observed.calls.get(clip), 3);
    assert.equal(observed.value[0][1].x, 16);
    assert.equal(observed.value[1][1].x, 8);
  } finally { closeClipContext(context); }
  const observed = observeRectangles([clip], () => prepareClip(new Preparation(OPTIONS, budget, true), clip, context));
  assert.equal(observed.calls.get(clip), 1);
});

test('A06_CLIP_REUSE default mutable getter inputs and custom callbacks keep their original reads and exceptions', () => {
  let reads = 0;
  const clip = { get matrix() { reads++; return IDENTITY; }, rect: { x: 0, y: 0, width: 8, height: 8 } };
  const preparation = new Preparation(OPTIONS, ledger());
  assert.equal(prepareClip(preparation, clip)[1].x, 8);
  clip.rect.width = 4;
  assert.equal(prepareClip(preparation, clip)[1].x, 4); assert.equal(reads, 2);
  const traces = [];
  for (const useClipOperation of [false, true]) {
    const trace = [], proxy = new Proxy({ matrix: IDENTITY, rect: clip.rect }, {
      get(target, key, receiver) { trace.push(key); return Reflect.get(target, key, receiver); },
    });
    const current = new Preparation(OPTIONS, ledger());
    const result = useClipOperation ? prepareClip(current, proxy) : current.rectangle(proxy);
    traces.push({ trace, result, predicates: current.edgeTests });
  }
  assert.deepStrictEqual(traces[1], traces[0]);
  const failure = new Error('custom fifth predicate'), calls = { predicates: 0, replay: 0 };
  const custom = { admitPreparedVertices() {}, admitPredicate() { if (++calls.predicates === 5) throw failure; },
    tryReplayStageCost() { calls.replay++; throw new Error('custom replay'); } };
  assert.equal(clipContext(OPTIONS, custom), undefined);
  assert.throws(() => prepareClip(new Preparation(OPTIONS, custom, true), clip), error => error === failure);
  assert.deepEqual(calls, { predicates: 5, replay: 0 });
  const actual = ledger(), replacement = () => { throw failure; };
  actual.tryReplayStageCost = replacement;
  assert.equal(clipContext(OPTIONS, actual), undefined, 'an overridden ledger must not gain callback-skipping reuse');
  // The seventh call follows the real initial Mesh normalization. Aggregate
  // contained replay would skip it, hiding this exact caller-owned exception.
  const tupleFailure = new Error('custom seventh tuple comparison');
  const frame = clipFixture([clipMesh([clipRecord()])]);
  for (const failAt of [7, undefined]) {
    const outcomes = [];
    for (const enabled of [false, true]) {
      const current = ledger(), originalTuple = current.admitTupleComparison;
      let tupleCalls = 0, result, thrown;
      current.admitTupleComparison = function() {
        tupleCalls++;
        if (tupleCalls === failAt) throw tupleFailure;
        return originalTuple.call(this);
      };
      const context = clipContext(OPTIONS, current), contextRejected = context === undefined;
      closeClipContext(context);
      try { result = dispatchClipFrame(frame, enabled, OPTIONS, current); }
      catch (error) { thrown = error; }
      outcomes.push({ tupleCalls, result, thrown, contextRejected, budget: current.snapshot() });
    }
    assert.deepStrictEqual(outcomes[1], outcomes[0], 'Mesh opt-in must retain every custom tuple callback and partial debit');
    for (const outcome of outcomes) {
      assert.equal(outcome.contextRejected, true);
      assert.equal(outcome.thrown, failAt === undefined ? undefined : tupleFailure);
      assert.equal(outcome.tupleCalls, failAt === undefined ? 54 : 7);
      if (failAt === undefined) assert.ok(outcome.result.draws[0].prepared.polygons.length > 0);
    }
  }
});

test('A06_CLIP_REUSE cache-owned points cannot be modified through the original miss result', () => {
  const clip = clipRecord(), budget = ledger(), context = clipContext(OPTIONS, budget);
  try {
    const preparation = new Preparation(OPTIONS, budget, true), first = prepareClip(preparation, clip, context);
    first[0].x = 7;
    const second = prepareClip(preparation, clip, context);
    assert.deepEqual(second, [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 }]);
    assert.ok(Object.isFrozen(second) && second.every(Object.isFrozen));
    snapshot(budget, 0, 0, 18, 0);
  } finally { closeClipContext(context); }
});

for (const failurePoint of ['map construction', 'point copy', 'map insertion']) {
  test('A06_CLIP_REUSE optional ' + failurePoint + ' failure only disables reuse and preserves the successful original result', () => {
    const clip = clipRecord(), frame = clipFixture([{ ...imageCommand(), clips: [clip] }, { ...imageCommand(), clips: [clip] }]);
    const cold = dispatchClipFrame(frame, false);
    const NativeMap = globalThis.Map, freeze = Object.freeze, set = Map.prototype.set;
    let injected = 0, result;
    const failure = new Error('optional clip cache allocation');
    try {
      if (failurePoint === 'map construction') globalThis.Map = class extends NativeMap {
        constructor(...args) { super(...args); injected++; throw failure; }
      };
      if (failurePoint === 'point copy') Object.freeze = value => {
        if (value && typeof value === 'object' && Object.hasOwn(value, 'x') && Object.hasOwn(value, 'y')) { injected++; throw failure; }
        return freeze(value);
      };
      if (failurePoint === 'map insertion') Map.prototype.set = function(key, value) {
        if (key === clip) { injected++; throw failure; }
        return set.call(this, key, value);
      };
      result = dispatchClipFrame(frame, true);
    } finally {
      globalThis.Map = NativeMap; Object.freeze = freeze; NativeMap.prototype.set = set;
    }
    assert.equal(injected, 1);
    assert.deepStrictEqual(result, cold);
  });
}

test('A06_CLIP_REUSE dispatcher finally clears every context on success and on an original preparation failure', () => {
  assert.equal(typeof Preparation.prototype.clipRectangle, 'function');
  const original = Preparation.prototype.clipRectangle, seen = new Set(), maps = new Set();
  Preparation.prototype.clipRectangle = function(clip, context) {
    if (context) { seen.add(context); if (context.entries) maps.add(context.entries); }
    return original.call(this, clip, context);
  };
  try {
    const good = clipRecord();
    dispatchClipFrame(clipFixture([{ ...imageCommand(), clips: [good] }]), true);
    const failure = new Error('required rectangle operation'), rectangle = Preparation.prototype.rectangle;
    Preparation.prototype.rectangle = function(input) { if (input === good) throw failure; return rectangle.call(this, input); };
    try {
      assert.throws(() => dispatchClipFrame(clipFixture([{ ...imageCommand(), clips: [good] }]), true), error => error === failure);
    } finally { Preparation.prototype.rectangle = rectangle; }
  } finally { Preparation.prototype.clipRectangle = original; }
  assert.equal(seen.size, 2);
  for (const context of seen) { assert.equal(context.active, false); assert.equal(context.entries, undefined); }
  for (const map of maps) assert.equal(map.size, 0);
});

// These labelled private units supply a real successful normalization before
// selecting an edge kind. Generic callers and custom policies gain no default.
function containedEdgeAttempt(preparation, subject, clip, edge, kind) {
  assert.equal(typeof preparation.tryContainedEdge, 'function', 'contained edge operation must exist');
  return preparation.tryContainedEdge(subject, clip, edge, kind);
}
function observeContainedEdges(run) {
  const descriptor = Object.getOwnPropertyDescriptor(Preparation.prototype, 'tryContainedEdge');
  assert.equal(typeof descriptor?.value, 'function', 'contained edge operation must exist');
  const calls = [];
  Object.defineProperty(Preparation.prototype, 'tryContainedEdge', { ...descriptor, value: function(subject, clip, edge, kind) {
    const output = Reflect.apply(descriptor.value, this, arguments);
    calls.push({ kind, edge, n: subject.length, hit: output !== undefined });
    return output;
  } });
  try { return { value: run(), calls }; }
  finally { Object.defineProperty(Preparation.prototype, 'tryContainedEdge', descriptor); }
}

test('A07_EDGE rectangle charges classification plus both normalization scans at every canonical boundary', () => {
  const budget = ledger(), preparation = new Preparation(OPTIONS, budget, true);
  let points = preparation.normalize(CONTAINED_CLIP);
  for (let edge = 0; edge < 4; edge++) {
    const previous = points;
    points = containedEdgeAttempt(preparation, points, CONTAINED_CLIP, edge, 'rectangle');
    assert.deepEqual(points, CONTAINED_CLIP); assert.notEqual(points, previous);
    assert.ok(points.every((point, index) => point === previous[index]));
    assert.equal(preparation.edgeTests, 8 + 12 * (edge + 1));
    snapshot(budget, 0, 0, 8 + 12 * (edge + 1), 0);
  }
});

test('A07_EDGE image keeps attributed collinear vertices and exact f64 values for one edge', () => {
  const literal = [{ x: 0, y: 0, u: -0, v: 0 }, { x: 1, y: 0, u: .125, v: 0 },
    { x: 2, y: 0, u: .75, v: 0 }, { x: 2, y: 2, u: 1, v: 1 }, { x: 0, y: 2, u: 0, v: 1 }];
  const points = normalizeImagePolygon(literal, OPTIONS).points;
  const budget = ledger(), preparation = new Preparation(OPTIONS, budget, true);
  const output = containedEdgeAttempt(preparation, points, CONTAINED_CLIP, 0, 'image');
  assert.deepEqual(f64Rows(output, ['x', 'y', 'u', 'v']), f64Rows(literal, ['x', 'y', 'u', 'v']));
  assert.equal(output.length, 5); assert.notEqual(output, points);
  assert.ok(output.every((point, index) => point === points[index]));
  assert.equal(preparation.edgeTests, 10); snapshot(budget, 0, 0, 10, 0);
});

test('A07_EDGE mesh clones complete collinear tuples and charges n adjacent plus all unique XY pairs', () => {
  const literal = [tuple(0, 0), tuple(1, 0, { u: .125, r: .25, g: .5, b: .75, a: .5 }),
    tuple(2, 0, { u: .75 }), tuple(2, 2, { u: 1, v: 1 }), tuple(0, 2, { v: 1 })];
  const budget = ledger(), preparation = new Preparation(OPTIONS, budget, true);
  const points = meshPolicy(budget).normalize(preparation, literal);
  const output = containedEdgeAttempt(preparation, points, CONTAINED_CLIP, 0, 'mesh');
  assert.deepEqual(f64Rows(output, ['x', 'y', 'u', 'v', 'r', 'g', 'b', 'a']), f64Rows(literal, ['x', 'y', 'u', 'v', 'r', 'g', 'b', 'a']));
  assert.equal(output.length, 5); assert.notEqual(output, points);
  assert.ok(output.every((point, index) => point !== points[index]));
  assert.equal(preparation.edgeTests, 15); snapshot(budget, 0, 0, 15, 30);
});

for (const row of [
  { label: 'predicate one short', predicates: 8, tuples: 12, local: 4194304, final: [8, 12] },
  { label: 'tuple one short', predicates: 9, tuples: 11, local: 4194304, final: [6, 11] },
  { label: 'both one short', predicates: 8, tuples: 11, local: 4194304, final: [6, 11] },
  { label: 'local predicate one short', predicates: 9, tuples: 12, local: 8, final: [8, 12] },
  { label: 'classification before tuples', predicates: 9, tuples: 6, local: 5, final: [5, 6] },
]) {
  test('A07_EDGE atomic miss retains exact original first failure and partial debit: ' + row.label, () => {
    const outcomes = [];
    for (const enabled of [false, true]) {
      const budget = ledger({ maxClipEdgeTests: row.predicates, maxTupleComparisons: row.tuples });
      const preparation = new Preparation({ ...OPTIONS, maxClipEdgeTests: row.local }, budget, enabled), policy = meshPolicy(budget);
      const points = policy.normalize(preparation, [tuple(0, 0), tuple(4, 0), tuple(0, 4)]);
      if (enabled) {
        assert.equal(containedEdgeAttempt(preparation, points, CONTAINED_CLIP, 0, 'mesh'), undefined);
        assert.equal(preparation.edgeTests, 3); snapshot(budget, 0, 0, 3, 6);
      }
      assert.throws(() => clipPolygon2D(preparation, points, CONTAINED_CLIP,
        policy.normalize, ATTACH_CONSTANT, policy, enabled ? 'mesh' : undefined), reason('budget'));
      outcomes.push({ local: preparation.edgeTests, budget: budget.snapshot() });
      assert.equal(preparation.edgeTests, row.final[0]); snapshot(budget, 0, 0, ...row.final);
    }
    assert.deepStrictEqual(outcomes[1], outcomes[0]);
  });
}

test('A07_EDGE exact single edge mesh limits succeed without discounting semantic work', () => {
  const budget = ledger({ maxClipEdgeTests: 9, maxTupleComparisons: 12 });
  const preparation = new Preparation({ ...OPTIONS, maxClipEdgeTests: 9 }, budget, true);
  const points = meshPolicy(budget).normalize(preparation, [tuple(0, 0), tuple(4, 0), tuple(0, 4)]);
  assert.deepEqual(containedEdgeAttempt(preparation, points, CONTAINED_CLIP, 0, 'mesh'), points);
  assert.equal(preparation.edgeTests, 9); snapshot(budget, 0, 0, 9, 12);
});

test('A07_EDGE partial clipping reaches all three real preparation routes with unchanged output and fees', () => {
  const clip = clipRecord(), clips = [clip];
  const commands = [
    { ...rectCommand(), rect: { x: -1, y: 1, width: 4, height: 2 }, clips },
    { ...imageCommand(), rect: { x: -1, y: 1, width: 4, height: 2 }, clips },
    { ...clipMesh(clips), matrix: { ...IDENTITY, tx: -2 } },
  ];
  const frame = clipFixture(commands), cold = dispatchClipFrame(frame, false);
  const observed = observeContainedEdges(() => dispatchClipFrame(frame, true));
  assert.deepStrictEqual(observed.value, cold);
  for (const kind of ['rectangle', 'image', 'mesh']) {
    assert.ok(observed.calls.some(call => call.kind === kind && call.hit), kind + ' must reach its real edge shortcut');
    assert.ok(observed.calls.some(call => call.kind === kind && !call.hit), kind + ' must retain its intersecting edge');
  }
  assert.deepEqual(observed.value.draws[0].prepared.points,
    [{ x: 0, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 0, y: 3 }]);
});

test('A07_EDGE current n follows a real preceding cut and empty subjects stop later edges', () => {
  const normalized = new Preparation(OPTIONS).normalize([{ x: -2, y: 1 }, { x: 12, y: 1 }, { x: 5, y: 9 }]);
  const clip = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const coldBudget = ledger(), hotBudget = ledger();
  const cold = new Preparation(OPTIONS, coldBudget).intersect(normalized, clip);
  const observed = observeContainedEdges(() => new Preparation(OPTIONS, hotBudget, true).intersect(normalized, clip, true));
  assert.deepStrictEqual(observed.value, cold); assert.deepStrictEqual(hotBudget.snapshot(), coldBudget.snapshot());
  assert.ok(observed.calls.some(call => call.edge === 0 && call.n === 3 && call.hit));
  assert.ok(observed.calls.some(call => call.edge === 2 && call.n === 4 && call.hit));
  const outside = [{ x: 1, y: -2 }, { x: 3, y: -2 }, { x: 1, y: -1 }];
  const empty = observeContainedEdges(() => new Preparation(OPTIONS, ledger(), true).intersect(outside, clip, true));
  assert.deepEqual(empty.value, []);
  assert.deepEqual(empty.calls.map(call => call.edge), [0]);
});

test('A07_EDGE generic intersect and custom normalize stay unqualified despite an enabled Preparation', () => {
  const unnormalized = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
  const coldBudget = ledger(), hotBudget = ledger();
  const cold = new Preparation(OPTIONS, coldBudget).intersect(unnormalized, CONTAINED_CLIP);
  const observed = observeContainedEdges(() => new Preparation(OPTIONS, hotBudget, true).intersect(unnormalized, CONTAINED_CLIP));
  assert.deepStrictEqual(observed.value, cold); assert.equal(cold.length, 4);
  assert.deepStrictEqual(hotBudget.snapshot(), coldBudget.snapshot()); assert.deepEqual(observed.calls, []);
  const sentinel = new Error('custom second normalize'), traces = [];
  for (const enabled of [false, true]) {
    const budget = ledger(), preparation = new Preparation(OPTIONS, budget, enabled), trace = [];
    const normalize = (_preparation, points) => {
      trace.push(points.map(point => [point.x, point.y])); if (trace.length === 2) throw sentinel; return points.slice();
    };
    assert.throws(() => clipPolygon2D(preparation, cold, CONTAINED_CLIP, normalize, ATTACH_CONSTANT), error => error === sentinel);
    traces.push({ trace, budget: budget.snapshot() });
  }
  assert.deepStrictEqual(traces[1], traces[0]);
});

test('A07_EDGE a kind alone, absent ledger and noncanonical or outside inputs cannot authorize replay', () => {
  for (const preparation of [new Preparation(OPTIONS), new Preparation(OPTIONS, undefined, true), new Preparation(OPTIONS, ledger())]) {
    const counter = { reads: 0 }, points = [poisonPoint(counter), poisonPoint(counter), poisonPoint(counter)];
    assert.equal(containedEdgeAttempt(preparation, points, CONTAINED_CLIP, 0, 'rectangle'), undefined);
    assert.equal(counter.reads, 0); assert.equal(preparation.edgeTests, 0);
  }
  const budget = ledger(), preparation = new Preparation(OPTIONS, budget, true);
  const points = preparation.normalize([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }]);
  const before = budget.snapshot(), local = preparation.edgeTests;
  for (const clip of [[...CONTAINED_CLIP].reverse(), CONTAINED_CLIP.slice(1).concat(CONTAINED_CLIP[0]),
    CONTAINED_CLIP.map(point => ({ ...point, x: 0 })), [{ x: 0, y: 0 }, { x: 4, y: 1 }, { x: 3, y: 4 }, { x: -1, y: 3 }], []]) {
    assert.equal(containedEdgeAttempt(preparation, points, clip, 0, 'rectangle'), undefined);
  }
  assert.equal(containedEdgeAttempt(preparation, points.map(point => ({ ...point, y: point.y - 3 })), CONTAINED_CLIP, 0, 'rectangle'), undefined);
  for (const edge of [-1, .5, 4]) assert.equal(containedEdgeAttempt(preparation, points, CONTAINED_CLIP, edge, 'rectangle'), undefined);
  assert.deepStrictEqual(budget.snapshot(), before); assert.equal(preparation.edgeTests, local);
});

test('A07_EDGE real dispatcher rejects custom tuple replay and preflights later invalid clips first', () => {
  const clip = clipRecord(), command = { ...clipMesh([clip]), matrix: { ...IDENTITY, tx: -2 } };
  const frame = clipFixture([command]), sentinel = new Error('custom seventh tuple'), outcomes = [];
  for (const enabled of [false, true]) {
    const budget = ledger(), original = budget.admitTupleComparison;
    let calls = 0;
    budget.admitTupleComparison = function() { if (++calls === 7) throw sentinel; return original.call(this); };
    assert.throws(() => dispatchClipFrame(frame, enabled, OPTIONS, budget), error => error === sentinel);
    outcomes.push({ calls, budget: budget.snapshot() });
  }
  assert.deepStrictEqual(outcomes[1], outcomes[0]); assert.equal(outcomes[0].calls, 7);
  const bad = { matrix: { ...IDENTITY, tx: 2 ** 21 }, rect: clip.rect };
  const observed = observeContainedEdges(() => {
    const budget = ledger(), geometry = frame.geometries[0]; budget.admitSourceTriangles(1);
    assert.throws(() => prepareTexturedMesh2D({ ...command, alpha: 0, clips: [clip, bad] }, geometry,
      8, 8, OPTIONS, budget, undefined, true), reason('range'));
  });
  assert.deepEqual(observed.calls, []);
});
