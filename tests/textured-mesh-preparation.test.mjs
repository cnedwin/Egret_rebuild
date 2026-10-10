import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
// AGENTS permits built private rendering imports only for geometry units.
// These tests do not submit structural records to any public host.
import { Preparation, GeometryPreparationError, clipPolygon2D } from '../packages/engine/dist/rendering/prepareRectangles2D.js';
import { IDENTITY, OPTIONS, HARD, ZERO_COUNTERS, INTERIOR, CLIPPED,
  COMPLEMENT, AFFINE_REVERSAL, PACKED_REVERSAL, ACCOUNTING } from './fixtures/textured-mesh-preparation-oracles.mjs';

async function optionalNewModule(relative) {
  const expected = new URL(relative, import.meta.url);
  try { return await import(expected.href); }
  catch (error) {
    // Only the exact absent new module becomes a capability assertion.
    // A transitive missing dependency, parse fault or other import error is setup failure.
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || error.url !== expected.href) throw error;
    return Object.freeze({});
  }
}
const meshModule = await optionalNewModule('../packages/engine/dist/rendering/prepareTexturedMesh2D.js');
const packModule = await optionalNewModule('../packages/engine/dist/rendering/packTexturedMesh2D.js');
const drawModule = await optionalNewModule('../packages/engine/dist/rendering/prepareTexturedDraws2D.js');
const budgetModule = await optionalNewModule('../packages/engine/dist/rendering/texturedPreparationBudget2D.js');
const FIELDS = Object.freeze(['x', 'y', 'u', 'v', 'r', 'g', 'b', 'a']);
const reason = expected => error => error instanceof GeometryPreparationError && error.reason === expected;
const point = row => Object.fromEntries(FIELDS.map((field, index) => [field, row[index]]));
const tuple = value => FIELDS.map(field => value[field]);
const white = (x, y) => [x, y, 0, 0, 1, 1, 1, 1];
function sortedTuples(points) { return points.map(tuple).sort((a, b) => a[0] - b[0] || a[1] - b[1]); }
function sortedLiterals(rows) { return rows.map(row => [...row]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); }
function geometry(rows = INTERIOR, indices = [0, 1, 2]) {
  assert.equal(typeof egret.createTexturedGeometry2D, 'function', 'accepted public geometry factory must initialize');
  return egret.createTexturedGeometry2D({
    positions: new Float64Array(rows.flatMap(row => row.slice(0, 2))),
    uvs: new Float64Array(rows.flatMap(row => row.slice(2, 4))),
    lightColors: new Float64Array(rows.flatMap(row => row.slice(4, 8))),
    indices: new Uint32Array(indices),
  });
}
function command(overrides = {}) {
  return { kind: 'mesh', matrix: IDENTITY, alpha: 1, clips: [], imageIndex: 0,
    sourceRect: { x: 0, y: 0, width: 1, height: 1 }, geometryIndex: 0, ...overrides };
}
function ledger(overrides = {}) {
  assert.equal(typeof budgetModule.TexturedPreparationBudget2D, 'function', 'accepted Task1 private ledger must exist');
  return new budgetModule.TexturedPreparationBudget2D({ ...HARD, ...overrides });
}
function policy(budget) {
  assert.equal(typeof budgetModule.createMeshClipPolicy2D, 'function', 'reviewed Task1 private mesh policy must exist');
  return budgetModule.createMeshClipPolicy2D(budget);
}
function prepareFunction() {
  assert.equal(typeof meshModule.prepareTexturedMesh2D, 'function', 'missing private prepareTexturedMesh2D capability');
  return meshModule.prepareTexturedMesh2D;
}
function pack(prepared, width, height, admittedVertexBytes, budget) {
  assert.equal(typeof packModule.packTexturedMesh2D, 'function', 'missing private packTexturedMesh2D capability');
  return packModule.packTexturedMesh2D(prepared, width, height, admittedVertexBytes, budget);
}
function attachment() {
  assert.equal(typeof meshModule.attachTexturedMeshAttributes2D, 'function', 'private real crossing attachment must exist');
  return meshModule.attachTexturedMeshAttributes2D;
}
function snapshot(budget, source, prepared, predicates, comparisons) {
  assert.deepEqual(budget.snapshot(), { sourceTrianglesCharged: source, preparedVerticesCharged: prepared,
    predicatesCharged: predicates, tupleComparisonsCharged: comparisons });
}
function counters(value, changes = {}) { assert.deepEqual(value.counters, { ...ZERO_COUNTERS, ...changes }); }
function unitPrepare(g, c = command(), width = 8, height = 8, budget = ledger(), options = OPTIONS) {
  // Standalone PRIVATE unit performs the whole metadata debit explicitly.
  // This wrapper is not proof of Task3's real metadata-before-index admission.
  budget.admitSourceTriangles(g.triangleCount);
  return { prepared: prepareFunction()(c, g, width, height, options, budget), budget };
}
function privatePrepared(rows, changes = {}) {
  return { polygons: [rows.map(point)], sourceTrianglesCharged: 1, preparedVerticesCharged: 3,
    counters: { ...ZERO_COUNTERS }, ...changes };
}
function packedUnit(rows, width = 16, height = 16, bytes = 96, limits = {}) {
  const budget = ledger(limits);
  budget.admitSourceTriangles(1); budget.admitPreparedVertices(3);
  return { result: pack(privatePrepared(rows), width, height, bytes, budget), budget };
}
function bits64(value) { const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false); return view.getBigUint64(0, false).toString(16).padStart(16, '0'); }
function bits32(value) { const view = new DataView(new ArrayBuffer(4)); view.setFloat32(0, value, false); return view.getUint32(0, false).toString(16).padStart(8, '0'); }

test('G01 full tuple preparation exists after accepted immutable public geometry', () => {
  const g = geometry();
  assert.equal(egret.isTexturedGeometry2D(g), true);
  assert.equal(Object.isFrozen(g), true);
  for (const field of ['positions', 'uvs', 'lightColors', 'indices']) assert.equal(Object.isFrozen(g[field]), true);
  assert.deepEqual([g.vertexCount, g.indexCount, g.triangleCount, g.logicalByteLength], [3, 3, 1, 204]);
  assert.deepEqual(g.positions, [2, 2, 6, 2, 2, 6]);
  assert.deepEqual(g.uvs, [0, 0, 1, 0, 0, 1]);
  assert.deepEqual(g.lightColors, [1, 0, 0, 1, 0, 1, 0, .5, 0, 0, 1, .25]);
  // Required genuine future RED is this assertion, after every baseline above passes.
  assert.equal(typeof meshModule.prepareTexturedMesh2D, 'function', 'G01 missing private prepareTexturedMesh2D capability');
});

test('G02 authored collinear h/T is suppressed before rounded affine work', () => {
  const h = 2 ** -34;
  const { prepared, budget } = unitPrepare(geometry([white(0, 0), white(h, h), white(3 * h, 3 * h)]), command({ matrix: { ...IDENTITY, tx: 2 ** 19 } }), 8, 8);
  assert.deepEqual(prepared.polygons, []);
  counters(prepared, { authoredDegenerateTriangles: 1 });
  assert.deepEqual([prepared.sourceTrianglesCharged, prepared.preparedVerticesCharged], [1, 0]);
  // With no authored clips: A only, no M/T/clipping predicate or normalization.
  snapshot(budget, 1, 0, 1, 0);
});

for (const rows of [[white(2, 2), white(2, 2), white(2, 2)], [white(1, 1), white(2, 2), white(3, 3)]]) {
  test('G02 authored point or line has raster suppression without changing geometry payload ' + rows[1][0], () => {
    const g = geometry(rows), before = [...g.positions];
    const { prepared } = unitPrepare(g);
    assert.deepEqual(prepared.polygons, []); counters(prepared, { authoredDegenerateTriangles: 1 });
    assert.deepEqual(g.positions, before); // Actual bounds semantics remain in accepted CPU bounds tests.
  });
}

test('G03 near-collinear positive authored triangle reaches exact singular-rank suppression', () => {
  const { prepared, budget } = unitPrepare(geometry([white(0, 0), white(1, 1), white(2, 2 + 2 ** -51)]),
    command({ matrix: { ...IDENTITY, a: 1, b: 1, c: 2, d: 2 } }));
  assert.deepEqual(prepared.polygons, []); counters(prepared, { singularSuppressedTriangles: 1 });
  snapshot(budget, 1, 0, 2, 0); // A nonzero, M zero; no transform or normalization.
});

test('G03 robust represented rank stays nonzero when rounded a*d-b*c is zero', () => {
  // Independent dyadic prediction: M=-2^-54; scaling both axes by h=2^-34
  // gives represented T=-2^-122. No translation or rounded cross-product oracle.
  const h = 2 ** -34, matrix = { ...IDENTITY, a: 1 + 2 ** -27, b: 1, c: 1, d: 1 - 2 ** -27 };
  assert.equal(matrix.a * matrix.d - matrix.b * matrix.c, 0);
  const rows = [[0, 0, 0, 0, 1, 0, 0, 1], [h, 0, 1, 0, 0, 1, 0, .5], [0, h, 0, 1, 0, 0, 1, .25]];
  const { prepared } = unitPrepare(geometry(rows), command({ matrix }));
  assert.deepEqual(prepared.polygons.map(polygon => polygon.map(tuple)), [[
    [h, h - 2 ** -61, 0, 1, 0, 0, 1, .25],
    [h + 2 ** -61, h, 1, 0, 0, 1, 0, .5], [0, 0, 0, 0, 1, 0, 0, 1],
  ]]);
  assert.equal(prepared.preparedVerticesCharged, 3); counters(prepared);
});

test('G03 reflection reverses entire tuples into positive backing winding', () => {
  const g = geometry(), matrix = { ...IDENTITY, a: -1, tx: 8 };
  const { prepared } = unitPrepare(g, command({ matrix }));
  assert.deepEqual(prepared.polygons.map(polygon => polygon.map(tuple)), [[
    [6, 6, 0, 1, 0, 0, 1, .25], [2, 2, 1, 0, 0, 1, 0, .5], [6, 2, 0, 0, 1, 0, 0, 1],
  ]]); counters(prepared);
  const reversed = unitPrepare(geometry(INTERIOR, [2, 1, 0]), command({ matrix })).prepared;
  assert.deepEqual(reversed.polygons, prepared.polygons);
  const broken = prepared.polygons[0].map((p, i, all) => ({ ...p,
    ...Object.fromEntries(FIELDS.slice(2).map(field => [field, all[all.length - 1 - i][field]])) }));
  assert.throws(() => assert.deepEqual(broken, prepared.polygons[0]), assert.AssertionError);
});

test('G04 positive authored triangle collapsed by represented translation has its own stage counter', () => {
  const h = 2 ** -34;
  const { prepared, budget } = unitPrepare(geometry([white(0, 0), white(h, 0), white(0, h)]),
    command({ matrix: { ...IDENTITY, tx: 2 ** 19, ty: 2 ** 19 } }));
  assert.deepEqual(prepared.polygons, []); counters(prepared, { transformedCollapsedTriangles: 1 });
  snapshot(budget, 1, 0, 3, 0);
});

test('G04 independently pinned binary64 affine reversal is precision refusal rather than collapse', () => {
  // Root's arithmetic-only receipt confirms A=+1*2^-70, T=-1*2^-66.
  const g = geometry(AFFINE_REVERSAL.authored.map(([x, y]) => white(x, y))), budget = ledger();
  assert.throws(() => unitPrepare(g, command({ matrix: AFFINE_REVERSAL.matrix }), 8, 8, budget), reason('precision'));
  snapshot(budget, 1, 0, 3, 0);
});

test('G05 literal slab crossings transport XY UV and all four straight light components', () => {
  const g = geometry([[0, 0, 0, 0, 1, 0, 0, 1], [8, 0, 1, 0, 0, 1, 0, .5], [0, 8, 0, 1, 0, 0, 1, .25]]);
  const clip = { matrix: IDENTITY, rect: { x: 2, y: 0, width: 4, height: 8 } };
  const outputs = [];
  for (const [indices, clips] of [[[0, 1, 2], [clip]], [[2, 1, 0], [clip]], [[0, 1, 2], [clip, clip]]]) {
    const chosen = indices[0] === 0 ? g : geometry([[0, 0, 0, 0, 1, 0, 0, 1], [8, 0, 1, 0, 0, 1, 0, .5], [0, 8, 0, 1, 0, 0, 1, .25]], indices);
    const { prepared } = unitPrepare(chosen, command({ clips }), 8, 8);
    assert.equal(prepared.polygons.length, 1);
    assert.deepEqual(sortedTuples(prepared.polygons[0]), sortedLiterals(CLIPPED));
    assert.equal(prepared.preparedVerticesCharged, 6); counters(prepared);
    outputs.push(sortedTuples(prepared.polygons[0]));
  }
  assert.deepEqual(outputs[0], outputs[1]); assert.deepEqual(outputs[0], outputs[2]);
});

test('G06 real private crossing attachment preserves the direct small complement in every attribute', () => {
  // Private crossing unit, not an authentic Mesh or complete clipped polygon.
  assert.equal(COMPLEMENT.u + COMPLEMENT.v, 480);
  assert.equal(COMPLEMENT.u / (COMPLEMENT.u + COMPLEMENT.v), 1);
  assert.equal(1 - COMPLEMENT.u / (COMPLEMENT.u + COMPLEMENT.v), 0);
  assert.equal(bits64(COMPLEMENT.smallWeight), COMPLEMENT.smallWeightBits);
  assert.ok(COMPLEMENT.smallWeight > 0);
  const p = point(COMPLEMENT.p), q = point(COMPLEMENT.q), budget = ledger();
  const preparation = new Preparation(OPTIONS, budget), meshPolicy = policy(budget);
  const expected = [COMPLEMENT.q[0], COMPLEMENT.q[1], ...Array(6).fill(COMPLEMENT.smallWeight)];
  const one = preparation.crossing(COMPLEMENT.edgeA, COMPLEMENT.edgeB, p, q, attachment(), meshPolicy);
  const reverse = preparation.crossing(COMPLEMENT.edgeA, COMPLEMENT.edgeB, q, p, attachment(), meshPolicy);
  assert.deepEqual(tuple(one), expected); assert.deepEqual(tuple(reverse), expected);
  for (const field of FIELDS.slice(2)) assert.equal(bits64(one[field]), COMPLEMENT.smallWeightBits);
  // The explicitly broken 1-t expectation loses all six nonzero components.
  assert.throws(() => assert.deepEqual(expected, [COMPLEMENT.q[0], COMPLEMENT.q[1], 0, 0, 0, 0, 0, 0]), assert.AssertionError);
});

for (const field of FIELDS.slice(2)) {
  test('G06 complete-tuple conflict refuses equal XY with different ' + field, () => {
    const budget = ledger(), input = INTERIOR.map(point);
    assert.throws(() => policy(budget).normalize(new Preparation(OPTIONS, budget),
      [input[0], { ...input[0], [field]: input[0][field] === 0 ? 1 : 0 }, input[1], input[2]]), reason('precision'));
    snapshot(budget, 0, 0, 0, 2);
  });
  test('G06 cache equality includes ' + field + ' on both canonical endpoints', () => {
    // Deliberately repeated private generic edges plus identity normalization
    // isolate cache identity. This input is not a valid public Mesh polygon.
    const p = point(white(-1, 1).map((v, i) => i >= 2 ? 0 : v)), q = point(white(1, 1).map((v, i) => i >= 2 ? 0 : v));
    const budget = ledger(), pOther = { ...p, [field]: 1 }, qOther = { ...q, [field]: 1 };
    const clip = [{ x: 0, y: 4 }, { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }];
    const run = subject => clipPolygon2D(new Preparation(OPTIONS, budget), subject, clip,
      (_preparation, rows) => [...rows], attachment(), policy(budget));
    const leftChanged = run([p, q, pOther, q]);
    assert.ok(leftChanged.some(v => v.x === 0 && v[field] === 0));
    assert.ok(leftChanged.some(v => v.x === 0 && v[field] === .5));
    const rightChanged = run([p, q, p, qOther]);
    assert.ok(rightChanged.some(v => v.x === 0 && v[field] === 0));
    assert.ok(rightChanged.some(v => v.x === 0 && v[field] === .5));
  });
}

test('G06 full-tuple normalization deduplicates adjacent closure and preserves attributed collinear corners', () => {
  const input = [[0, 0, 0, 0, 1, 0, 0, 1], [1, 0, .25, 0, .75, .25, 0, .875],
    [2, 0, 1, 0, 0, 1, 0, .5], [2, 2, 1, 1, 0, 0, 1, .25], [0, 2, 0, 1, 1, 1, 1, .75]].map(point);
  const budget = ledger(), normalize = rows => policy(budget).normalize(new Preparation(OPTIONS, budget), rows);
  assert.deepEqual(normalize(input), input);
  assert.deepEqual(normalize([input[0], { ...input[0] }, ...input.slice(1), { ...input[0] }]), input);
  assert.deepEqual(normalize([...input].reverse()), input);
  assert.throws(() => normalize([...input, { ...input[1] }]), reason('precision'));
  assert.deepEqual(normalize([white(0, 0), white(1, 0), white(2, 0)].map(point)), []);
  assert.throws(() => normalize([white(0, 0), white(2, 0), white(1, 1), white(2, 2), white(0, 2)].map(point)), reason('precision'));
});

for (const field of FIELDS.slice(2)) {
  test('G06 no attribute clamp for negative tiny or above-one private normalized ' + field, () => {
    for (const value of [-Number.MIN_VALUE, 1 + Number.EPSILON, Infinity, NaN]) {
      const budget = ledger(), rows = INTERIOR.map(point); rows[2][field] = value;
      assert.throws(() => policy(budget).normalize(new Preparation(OPTIONS, budget), rows), reason('precision'));
    }
  });
}

test('G07 thin positive backing triangle f32-collapses without any reservation refund', () => {
  const rows = [white(1, 1), white(9, 1), white(1, 1 + 2 ** -40)];
  const { result, budget } = packedUnit(rows);
  assert.equal(result.vertexCount, 0); assert.equal(result.data.byteLength, 0);
  assert.equal(result.maxBackingDisplacement, 2 ** -40);
  assert.equal(result.maxUVDisplacement, 0); assert.equal(result.maxLightColorDisplacement, 0);
  counters(result, { packedCollapsedTriangles: 1 });
  assert.deepEqual([result.sourceTrianglesCharged, result.preparedVerticesCharged], [1, 3]);
  snapshot(budget, 1, 3, 1, 0);
  assert.equal(3 * 32 + 16, 112); // Task3/host must retain this upload bound, not this packer's actual zero.
});

test('G07 positive represented f32 NDC reversal has precision refusal from pinned arithmetic witness', () => {
  const rows = PACKED_REVERSAL.backing.map(([x, y]) => white(x, y)), budget = ledger();
  budget.admitSourceTriangles(1); budget.admitPreparedVertices(3);
  assert.deepEqual(PACKED_REVERSAL.packed.map(row => row.map(bits32)), PACKED_REVERSAL.bits);
  assert.throws(() => pack(privatePrepared(rows), 16, 16, 96, budget), reason('precision'));
  snapshot(budget, 1, 3, 1, 0);
});

test('G07 ordinary positive backing uses exact nonindexed XY UV RGBA 32-byte layout and descriptive maxima', () => {
  const rows = [[1, 1, 1 / 3, 0, 1 / 10, .25, .5, 1], [9, 1, 1, 0, 1 / 10, .25, .5, 1], [1, 9, 0, 1, 1 / 10, .25, .5, 1]];
  const { result, budget } = packedUnit(rows);
  assert.equal(result.vertexCount, 3); assert.equal(result.data.byteLength, 96);
  assert.ok(result.data instanceof Float32Array);
  assert.deepEqual([...result.data], [-.875, .875, .3333333432674408, 0, .10000000149011612, .25, .5, 1,
    .125, .875, 1, 0, .10000000149011612, .25, .5, 1,
    -.875, -.125, 0, 1, .10000000149011612, .25, .5, 1]);
  assert.equal(result.maxBackingDisplacement, 0);
  assert.equal(result.maxUVDisplacement, Math.abs(.3333333432674408 - 1 / 3));
  assert.equal(result.maxLightColorDisplacement, Math.abs(.10000000149011612 - 1 / 10));
  counters(result); snapshot(budget, 1, 3, 1, 0);
});

test('G07 pack vertex byte cap96 succeeds and95 refuses without losing prepared charge', () => {
  const rows = [white(1, 1), white(9, 1), white(1, 9)];
  assert.equal(packedUnit(rows, 16, 16, 96).result.data.byteLength, 96);
  const budget = ledger(); budget.admitSourceTriangles(1); budget.admitPreparedVertices(3);
  assert.throws(() => pack(privatePrepared(rows), 16, 16, 95, budget), reason('budget'));
  assert.equal(budget.snapshot().preparedVerticesCharged, 3);
});

for (const field of FIELDS.slice(2)) {
  test('G07 private represented packed ' + field + ' admission rejects out-of-range rather than clamp', () => {
    // Trusted producer sanity unit: finite violations remain outside [0,1]
    // after fround. Tiny malformed pre-pack values are not an authentic input.
    for (const value of [-(2 ** -20), 1 + 2 ** -20, Infinity, NaN]) {
      const rows = [white(1, 1), white(9, 1), white(1, 9)].map(point); rows[2][field] = value;
      const budget = ledger(); budget.admitSourceTriangles(1); budget.admitPreparedVertices(3);
      assert.throws(() => pack({ ...privatePrepared([]), polygons: [rows] }, 16, 16, 96, budget), reason('precision'));
      assert.equal(budget.snapshot().preparedVerticesCharged, 3);
    }
  });
}

test('G08 whole source debit in standalone unit rejects before indexed operand access and is not doubled', () => {
  let reads = 0;
  const structural = { triangleCount: 2, get indices() { reads++; throw new Error('Unadmitted private indices'); } };
  const budget = ledger({ maxSourceTriangles: 1 });
  assert.throws(() => unitPrepare(structural, command(), 8, 8, budget), reason('budget'));
  assert.equal(reads, 0); snapshot(budget, 0, 0, 0, 0);
  const exact = ledger({ maxSourceTriangles: 1 });
  const { prepared } = unitPrepare(geometry(), command(), 8, 8, exact);
  assert.equal(prepared.sourceTrianglesCharged, 1); assert.equal(exact.snapshot().sourceTrianglesCharged, 1);
  // Genuine metadata-before-index placement remains Task3's separate source/test gate.
});

function watchedGeometry(rows, indices = [0, 1, 2]) {
  const log = [];
  const watch = (name, values) => new Proxy(values, { get(target, key, receiver) {
    if (typeof key === 'string' && /^\d+$/.test(key)) log.push(name + key);
    return Reflect.get(target, key, receiver);
  } });
  return { log, value: { vertexCount: rows.length, indexCount: indices.length, triangleCount: indices.length / 3,
    logicalByteLength: 64 * rows.length + 4 * indices.length,
    indices: watch('I', indices), positions: watch('P', rows.flatMap(row => row.slice(0, 2))),
    uvs: watch('U', rows.flatMap(row => row.slice(2, 4))), lightColors: watch('L', rows.flatMap(row => row.slice(4, 8))) } };
}
test('G08 private indexed read log validates three complete tuples before authored degeneracy', () => {
  const rows = [white(0, 0), white(0, 0), white(0, 0)]; rows[2][7] = -Number.MIN_VALUE;
  const watched = watchedGeometry(rows), budget = ledger();
  assert.throws(() => unitPrepare(watched.value, command(), 8, 8, budget), reason('precision'));
  assert.deepEqual(watched.log, ['I0', 'I1', 'I2', 'P0', 'P1', 'U0', 'U1', 'L0', 'L1', 'L2', 'L3',
    'P2', 'P3', 'U2', 'U3', 'L4', 'L5', 'L6', 'L7', 'P4', 'P5', 'U4', 'U5', 'L8', 'L9', 'L10', 'L11']);
  snapshot(budget, 1, 0, 0, 0);
});

test('G08 matrix and every authored clip preflight outrank private indexed work even when suppressed', () => {
  for (const overrides of [{ matrix: { ...IDENTITY, tx: 2 ** -101 } },
    { clips: [{ matrix: IDENTITY, rect: { x: 0, y: 0, width: 0, height: 0 } },
      { matrix: { ...IDENTITY, tx: 2 ** -101 }, rect: { x: 0, y: 0, width: 1, height: 1 } }] }]) {
    let reads = 0;
    const structural = { triangleCount: 1, get indices() { reads++; throw new Error('Private indices read before numeric preflight'); } };
    assert.throws(() => unitPrepare(structural, command({ alpha: 0, ...overrides })), reason('range'));
    assert.equal(reads, 0);
  }
});

test('G08 authentic unused finite out-of-envelope vertices are not rescanned per draw', () => {
  const g = geometry([...INTERIOR, white(2 ** 30, 2 ** -110)]);
  assert.equal(egret.isTexturedGeometry2D(g), true); assert.equal(g.vertexCount, 4);
  const { prepared } = unitPrepare(g); assert.equal(prepared.preparedVerticesCharged, 3);
  const referenced = geometry([...INTERIOR, white(2 ** 30, 2 ** -110)], [0, 1, 3]);
  assert.throws(() => unitPrepare(referenced), reason('range'));
});

test('G08 local matrix product sum translation and backing-ratio envelopes are admitted per operation', () => {
  const cases = [
    { rows: [white(2 ** -60, 0), white(2 ** -59, 0), white(2 ** -60, 2 ** -60)], matrix: { ...IDENTITY, a: 2 ** -60 } },
    { rows: [white(2, 1), white(3, 1), white(2, 2)], matrix: { ...IDENTITY, a: 2 ** 20 } },
    { rows: [white(2, 2), white(3, 2), white(2, 3)], matrix: { ...IDENTITY, a: 2 ** 19, c: 2 ** 19, tx: -(2 ** 20) } },
    { rows: INTERIOR, matrix: { ...IDENTITY, tx: 2 ** 20 } },
    { rows: INTERIOR, matrix: IDENTITY, ratio: 2 ** 20 },
  ];
  for (const row of cases) assert.throws(() => unitPrepare(geometry(row.rows), command({ matrix: row.matrix }), 8, 8, ledger(),
    { ...OPTIONS, pixelRatio: row.ratio ?? 1 }), reason('range'));
});

test('G08 private represented signed zero becomes positive zero in every prepared tuple field', () => {
  const zero = (x, y) => [x, y, -0, -0, -0, -0, -0, -0];
  const watched = watchedGeometry([zero(-0, -0), zero(1, -0), zero(-0, 1)]);
  const { prepared } = unitPrepare(watched.value, command(), 2, 2);
  assert.equal(prepared.polygons.length, 1);
  for (const p of prepared.polygons[0]) for (const field of FIELDS) assert.equal(Object.is(p[field], -0), false);
});

test('G08 zero-alpha still validates and clips but reserves no prepared vertices', () => {
  const { prepared, budget } = unitPrepare(geometry(), command({ alpha: 0 }));
  assert.deepEqual(prepared.polygons, []); counters(prepared);
  assert.deepEqual([prepared.sourceTrianglesCharged, prepared.preparedVerticesCharged], [1, 0]);
  snapshot(budget, 1, 0, 30, 30);
  const malformed = watchedGeometry([white(0, 0), white(1, 0), [0, 1, 0, 0, 1, 1, 1, -Number.MIN_VALUE]]);
  assert.throws(() => unitPrepare(malformed.value, command({ alpha: 0 })), reason('precision'));
});

test('G08 fully clipped triangle keeps source work and its separate clipped-collapse counter', () => {
  const { prepared, budget } = unitPrepare(geometry([white(10, 10), white(12, 10), white(10, 12)]));
  assert.deepEqual(prepared.polygons, []); counters(prepared, { clippedCollapsedTriangles: 1 });
  assert.deepEqual([prepared.sourceTrianglesCharged, prepared.preparedVerticesCharged], [1, 0]);
  assert.equal(budget.snapshot().sourceTrianglesCharged, 1);
  assert.ok(budget.snapshot().predicatesCharged > 3);
  assert.ok(budget.snapshot().tupleComparisonsCharged >= 6);
});

test('G08 frozen interior triangle has31 actual predicates30 tuple attempts including packing', () => {
  const budget = ledger({ maxClipEdgeTests: 31, maxTupleComparisons: 30, maxPreparedVertices: 3 });
  const { prepared } = unitPrepare(geometry(), command(), 8, 8, budget);
  assert.deepEqual(prepared.polygons.map(polygon => polygon.map(tuple)), [[...INTERIOR.map(row => [...row])]]);
  counters(prepared); snapshot(budget, 1, 3, ACCOUNTING.preparationPredicates, ACCOUNTING.tupleAttempts);
  const result = pack(prepared, 8, 8, 96, budget);
  assert.equal(result.vertexCount, 3); counters(result); snapshot(budget, 1, 3, 31, 30);
});

test('G08 predicate cap30 admits preparation then refuses the31st packed call without refund', () => {
  const budget = ledger({ maxClipEdgeTests: 30, maxTupleComparisons: 30, maxPreparedVertices: 3 });
  const { prepared } = unitPrepare(geometry(), command(), 8, 8, budget);
  assert.throws(() => pack(prepared, 8, 8, 96, budget), reason('budget'));
  snapshot(budget, 1, 3, 30, 30);
});

test('G08 tuple cap29 refuses its30th comparison before last viewport winding and fan append', () => {
  const budget = ledger({ maxTupleComparisons: 29 });
  assert.throws(() => unitPrepare(geometry(), command(), 8, 8, budget), reason('budget'));
  snapshot(budget, 1, 0, ACCOUNTING.tupleCap29PredicatesBeforeRefusal, 29);
});

test('G08 prepared fan exact3 succeeds and cap2 refuses before storing its polygon', () => {
  const exact = ledger({ maxPreparedVertices: 3 }); assert.equal(unitPrepare(geometry(), command(), 8, 8, exact).prepared.preparedVerticesCharged, 3);
  const over = ledger({ maxPreparedVertices: 2 });
  assert.throws(() => unitPrepare(geometry(), command(), 8, 8, over), reason('budget'));
  snapshot(over, 1, 0, 30, 30);
});

for (const cap of [1, 2]) {
  test('G08 authored rank transformed stage boundary cap' + cap + ' retains each completed debit', () => {
    const budget = ledger({ maxClipEdgeTests: cap });
    assert.throws(() => unitPrepare(geometry(), command(), 8, 8, budget), reason('budget'));
    snapshot(budget, 1, 0, cap, 0);
  });
}

test('G09 each shared fan corner is converted once with eight fround calls', () => {
  const rows = [white(1, 1), white(9, 1), white(9, 9), white(1, 9)], budget = ledger();
  budget.admitSourceTriangles(1); budget.admitPreparedVertices(6);
  const original = Math.fround; let calls = 0, result;
  try {
    Math.fround = value => { calls++; return original(value); };
    result = pack(privatePrepared(rows, { preparedVerticesCharged: 6 }), 16, 16, 192, budget);
  } finally { Math.fround = original; }
  assert.equal(calls, 32); assert.equal(result.vertexCount, 6); assert.equal(result.data.byteLength, 192);
  snapshot(budget, 1, 6, 2, 0);
});

test('G09 packing retains prior stage counters and adds collapse without mutating preparation', () => {
  const prior = { ...ZERO_COUNTERS, authoredDegenerateTriangles: 2, singularSuppressedTriangles: 3,
    transformedCollapsedTriangles: 4, clippedCollapsedTriangles: 5 };
  const prepared = privatePrepared([white(1, 1), white(9, 1), white(1, 1 + 2 ** -40)], { counters: Object.freeze(prior) });
  const budget = ledger(); budget.admitSourceTriangles(1); budget.admitPreparedVertices(3);
  const result = pack(prepared, 16, 16, 96, budget);
  assert.deepEqual(result.counters, { ...prior, packedCollapsedTriangles: 1 });
  assert.equal(prepared.counters.packedCollapsedTriangles, 0);
  assert.deepEqual([result.sourceTrianglesCharged, result.preparedVerticesCharged], [1, 3]);
});

test('G09 authored triangle order and five counters survive nonindexed fan expansion', () => {
  const red = (x, y) => [x, y, 0, 0, 1, 0, 0, 1], green = (x, y) => [x, y, 0, 0, 0, 1, 0, 1];
  const rows = [red(1, 1), red(3, 1), red(1, 3), green(5, 5), green(7, 5), green(5, 7)];
  const budget = ledger(), { prepared } = unitPrepare(geometry(rows, [0, 1, 2, 3, 4, 5]), command(), 8, 8, budget);
  assert.deepEqual(prepared.polygons.map(polygon => polygon.map(tuple)), [rows.slice(0, 3), rows.slice(3)]);
  assert.deepEqual([prepared.sourceTrianglesCharged, prepared.preparedVerticesCharged], [2, 6]); counters(prepared);
  const result = pack(prepared, 8, 8, 192, budget);
  const colorRows = Array.from({ length: 6 }, (_v, i) => [...result.data.slice(i * 8 + 4, i * 8 + 8)]);
  assert.deepEqual(colorRows, [[1, 0, 0, 1], [1, 0, 0, 1], [1, 0, 0, 1], [0, 1, 0, 1], [0, 1, 0, 1], [0, 1, 0, 1]]);
  assert.deepEqual([result.sourceTrianglesCharged, result.preparedVerticesCharged], [2, 6]); counters(result);
});

function rect(overrides = {}) { return { kind: 'rect', matrix: IDENTITY, rect: { x: 1, y: 1, width: 2, height: 2 }, color: 0xff0000, alpha: 1, clips: [], ...overrides }; }
function imageCommand(overrides = {}) { return { kind: 'image', matrix: IDENTITY, rect: { x: 1, y: 1, width: 2, height: 2 }, imageIndex: 0,
  sourceRect: { x: 0, y: 0, width: 1, height: 1 }, alpha: 1, clips: [], ...overrides }; }
function privateAdmitted(commands, g, budget) {
  // Trusted structural Task3-interface fixture only: no authentic-frame registry.
  const image = egret.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([255, 255, 255, 255]) });
  for (const c of commands) if (c.kind === 'mesh') budget.admitSourceTriangles(g.triangleCount);
  const frame = { profile: 'egret.textured-frame2d/1', frameId: 1, width: 8, height: 8, clearColor: 0, clearAlpha: 0,
    commands, images: [image], geometries: [g] };
  return { frame, width: 8, height: 8, uniqueGeometryBytes: g.logicalByteLength,
    commands: commands.map((c, commandIndex) => ({ command: c, commandIndex,
      ...(c.kind === 'mesh' ? { geometry: g, image } : c.kind === 'image' ? { image } : {}) })) };
}
function draws(admitted, budget) {
  assert.equal(typeof drawModule.prepareTexturedDraws2D, 'function', 'private ordered draw dispatcher must exist');
  return drawModule.prepareTexturedDraws2D(admitted, OPTIONS, budget);
}
test('G09 trusted unit rect image mesh image remains four ordered barriers', () => {
  const budget = ledger(), g = geometry();
  const out = draws(privateAdmitted([rect(), imageCommand(), command(), imageCommand()], g, budget), budget);
  assert.deepEqual(out.map(draw => draw.kind), ['rect', 'image', 'mesh', 'image']);
  assert.deepEqual(out.filter(draw => draw.kind !== 'rect').map(draw => draw.commandIndex), [1, 2, 3]);
  assert.equal(out[0].prepared.commands.length, 1);
  assert.equal(out[2].prepared.preparedVerticesCharged, 3);
  assert.equal(budget.snapshot().sourceTrianglesCharged, 1);
  assert.equal(budget.snapshot().preparedVerticesCharged, 21); //6rect+6image+3mesh+6image.
});

test('G09 trusted empty image and mesh are barriers between adjacent rectangle runs', () => {
  const budget = ledger(), g = geometry([], []);
  const out = draws(privateAdmitted([rect(), rect(), imageCommand({ alpha: 0 }), rect(), command(), rect()], g, budget), budget);
  assert.deepEqual(out.map(draw => draw.kind), ['rect', 'image', 'rect', 'mesh', 'rect']);
  assert.deepEqual(out.filter(draw => draw.kind === 'rect').map(draw => draw.prepared.commands.length), [2, 1, 1]);
  assert.deepEqual(out[1].prepared.pointIndices, []);
  assert.deepEqual(out[3].prepared.polygons, []);
  assert.deepEqual(out.filter(draw => draw.kind !== 'rect').map(draw => draw.commandIndex), [2, 4]);
  assert.equal(budget.snapshot().preparedVerticesCharged, 24);
  assert.equal(budget.snapshot().sourceTrianglesCharged, 0);
});
