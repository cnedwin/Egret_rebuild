import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageData2D, createTexturedGeometry2D } from '@egret/engine';
// UNIT: only the exact built private preparation helpers authorized in AGENTS.
// These controlled inputs establish CPU cache behavior, not public frame authority,
// physical memory usage, GPU execution, timing or browser acceptance.
import {
  PreparedFrameCache2D, readPreparedStage2D, publishPreparedStage2D,
  acceptPreparedStage2D, tryReplayPreparedStage2D,
} from '../packages/engine/dist/rendering/preparedFrameCache2D.js';
import { prepareMixedDraws2D } from '../packages/engine/dist/rendering/prepareMixedDraws2D.js';
import { prepareTexturedDraws2D } from '../packages/engine/dist/rendering/prepareTexturedDraws2D.js';
import { prepareRectangles2D, GeometryPreparationError } from '../packages/engine/dist/rendering/prepareRectangles2D.js';
import { prepareImage2D } from '../packages/engine/dist/rendering/prepareImages2D.js';
import { prepareTexturedMesh2D } from '../packages/engine/dist/rendering/prepareTexturedMesh2D.js';
import { packImageVertices2D } from '../packages/engine/dist/rendering/packImageVertices2D.js';
import { packTexturedMesh2D } from '../packages/engine/dist/rendering/packTexturedMesh2D.js';
import { TexturedPreparationBudget2D } from '../packages/engine/dist/rendering/texturedPreparationBudget2D.js';
import { packWebGPUVertices } from '../packages/engine/dist/web/webgpuPass.js';

const LIMITS = Object.freeze({ maxSourceTriangles: 65536, maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304, maxTupleComparisons: 1048576 });
const OPTIONS = Object.freeze({ pixelRatio: 1, ...LIMITS });
const ZERO = Object.freeze({ preparedVertices: 0, predicates: 0, tupleComparisons: 0 });
const CAP = 16_777_216;
const matrix = () => ({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
const region = () => ({ x: 0, y: 0, width: 1, height: 1 });
function rect(overrides = {}) {
  return { kind: 'rect', matrix: matrix(), rect: { x: 1, y: 1, width: 2, height: 2 }, color: 0x405060, alpha: 1, clips: [], ...overrides };
}
function imageCommand(overrides = {}) {
  return { kind: 'image', matrix: matrix(), rect: { x: 1, y: 1, width: 2, height: 2 }, alpha: 0.75, clips: [], imageIndex: 0, sourceRect: region(), ...overrides };
}
function meshCommand(overrides = {}) {
  return { kind: 'mesh', matrix: matrix(), alpha: 0.75, clips: [], imageIndex: 0, sourceRect: region(), geometryIndex: 0, ...overrides };
}
const image = () => createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([255, 64, 32, 128]) });
const geometry = () => createTexturedGeometry2D({
  positions: new Float64Array([1, 1, 3, 1, 3, 3, 1, 3]),
  uvs: new Float64Array([0, 0, 1, 0, 1, 1, 0, 1]),
  lightColors: new Float64Array(16).fill(1), indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
});
const frame = (commands, images = [], frameId = 1) => ({ frameId, width: 16, height: 16, clearColor: 0, clearAlpha: 0, commands, images });
const ledger = (overrides = {}) => new TexturedPreparationBudget2D({ ...LIMITS, ...overrides });
function setup(profile = 1, settings = OPTIONS) {
  const cache = new PreparedFrameCache2D(), context = cache.context(profile, settings);
  assert.ok(context); return { cache, context };
}
function slot(context, command, { width = 16, height = 16, image, geometry, ordinal = 0, run = false } = {}) {
  const selected = context.cache.slot(context, Array.isArray(command) ? command : [command], width, height, image, geometry, run, ordinal);
  assert.ok(selected); return selected;
}
const read = selected => readPreparedStage2D(selected, 'geometry');
const publish = (selected, value = { marker: 1 }) => publishPreparedStage2D(selected, 'geometry', value, ZERO);

test('UNIT P01 complete rectangle key compares each matrix, rect, ordered clip, alpha, color and signed zero', () => {
  const { context } = setup();
  const original = rect({ clips: [
    { matrix: matrix(), rect: { x: 0, y: 0, width: 12, height: 12 } },
    { matrix: { ...matrix(), tx: 1 }, rect: { x: 1, y: 1, width: 8, height: 8 } },
  ] });
  const selected = slot(context, original); publish(selected);
  assert.equal(read(slot(context, structuredClone(original))).value.marker, 1);
  const changes = [];
  for (const field of ['a', 'b', 'c', 'd', 'tx', 'ty']) changes.push([`matrix.${field}`, value => { value.matrix[field] += 0.25; }]);
  for (const field of ['x', 'y', 'width', 'height']) changes.push([`rect.${field}`, value => { value.rect[field] += 0.25; }]);
  for (let i = 0; i < 2; i++) {
    for (const field of ['a', 'b', 'c', 'd', 'tx', 'ty']) changes.push([`clip${i}.matrix.${field}`, value => { value.clips[i].matrix[field] += 0.25; }]);
    for (const field of ['x', 'y', 'width', 'height']) changes.push([`clip${i}.rect.${field}`, value => { value.clips[i].rect[field] += 0.25; }]);
  }
  changes.push(['alpha', value => { value.alpha = 0.5; }], ['color', value => { value.color++; }],
    ['clip order', value => value.clips.reverse()], ['clip count', value => value.clips.pop()],
    ['signed zero', value => { value.matrix.b = -0; }]);
  for (const [name, change] of changes) {
    const changed = structuredClone(original); change(changed);
    assert.equal(read(slot(context, changed)), undefined, name);
  }
  assert.equal(read(selected).value.marker, 1, 'misses must not rewrite the successful candidate');
});

test('UNIT P02 complete key includes profile, dimensions, every preparation option and command family', () => {
  const { cache, context } = setup(); const command = rect(); publish(slot(context, command));
  for (const [field, value] of Object.entries(OPTIONS)) {
    const changed = cache.context(1, { ...OPTIONS, [field]: value + 1 });
    assert.equal(read(slot(changed, command)), undefined, field);
  }
  assert.equal(read(slot(context, command, { width: 17 })), undefined);
  assert.equal(read(slot(context, command, { height: 17 })), undefined);
  for (const profile of [0, 2, 3]) assert.equal(read(slot(cache.context(profile, OPTIONS), command)), undefined);
  assert.equal(read(slot(context, imageCommand())), undefined);
  assert.equal(read(slot(context, meshCommand())), undefined);
  assert.equal(read(slot(context, command, { run: true })), undefined);
  assert.equal(read(slot(context, [command, command], { run: true })), undefined);
});

test('UNIT P03 crop and exact image/geometry identities matter; current table indices do not', () => {
  const { context } = setup(); const pixels = image(), samePixels = image(), mesh = geometry(), sameMesh = geometry();
  const command = meshCommand(), selected = slot(context, command, { image: pixels, geometry: mesh }); publish(selected);
  for (const field of ['x', 'y', 'width', 'height']) {
    const changed = structuredClone(command); changed.sourceRect[field] += 0.25;
    assert.equal(read(slot(context, changed, { image: pixels, geometry: mesh })), undefined, field);
  }
  const negativeZero = structuredClone(command); negativeZero.sourceRect.x = -0;
  assert.equal(read(slot(context, negativeZero, { image: pixels, geometry: mesh })), undefined);
  assert.equal(read(slot(context, command, { image: samePixels, geometry: mesh })), undefined);
  assert.equal(read(slot(context, command, { image: pixels, geometry: sameMesh })), undefined);
  assert.equal(read(slot(context, command, { image: pixels })), undefined);
  assert.equal(read(slot(context, { ...command, imageIndex: 9, geometryIndex: 7 }, { image: pixels, geometry: mesh })).value.marker, 1);
});

test('UNIT P04 ordinal selects one candidate and full values authorize replacement', () => {
  const { cache, context } = setup(); const command = rect();
  const first = slot(context, command, { ordinal: 4 }); publish(first);
  const moved = slot(context, command, { ordinal: 5 }); assert.equal(read(moved), undefined); publish(moved, { marker: 2 });
  assert.equal(read(first).value.marker, 1); assert.equal(read(moved).value.marker, 2);
  const changed = slot(context, rect({ alpha: 0.5 }), { ordinal: 4 }); assert.equal(read(changed), undefined); publish(changed, { marker: 3 });
  assert.equal(read(first), undefined); assert.equal(read(changed).value.marker, 3);
  assert.equal(cache.snapshot().entries, 2);
});

test('UNIT P05 one entry owns both stages, copies their records and counts shared allowance', () => {
  const { cache, context } = setup(); const selected = slot(context, rect());
  const value = { marker: 1 }; publish(selected, value);
  // Policy arithmetic: 256 base + 296 complete key + 56 stage + 40 value + 56 cost.
  assert.equal(cache.snapshot().bytes, 704); assert.equal(cache.snapshot().entries, 1);
  value.marker = 9; assert.equal(read(selected).value.marker, 1);
  const data = new Float32Array([3]); publishPreparedStage2D(selected, 'packing', { data }, ZERO);
  // Packing adds 56 stage + 40 record + 56 view + 4 backing + 56 cost.
  assert.equal(cache.snapshot().bytes, 916); assert.equal(cache.snapshot().entries, 1);
  data[0] = 99; assert.equal(readPreparedStage2D(selected, 'packing').value.data[0], 3);
  assert.equal(read(selected).value.marker, 1); assert.equal(cache.snapshot().reservedBytes, 0);
});

test('UNIT P06 LRU bounds all profiles together at 4096 and accepted hits touch the candidate', () => {
  const { cache, context } = setup(); const selected = [];
  for (let ordinal = 0; ordinal < 4096; ordinal++) {
    const current = slot(context, rect(), { ordinal }); selected.push(current); publish(current, { marker: ordinal });
  }
  assert.equal(cache.snapshot().entries, 4096);
  assert.equal(read(selected[1]).value.marker, 1, 'Prime the soon-to-be-evicted slot without touching LRU order');
  acceptPreparedStage2D(selected[0]);
  const extra = slot(cache.context(2, OPTIONS), rect(), { ordinal: 4096 }); publish(extra);
  assert.equal(cache.snapshot().entries, 4096); assert.equal(cache.snapshot().peakEntries, 4096);
  assert.equal(read(selected[1]), undefined); assert.equal(read(selected[0]).value.marker, 0);
  assert.ok(read(extra)); assert.ok(cache.snapshot().peakBytes <= CAP);
});

test('UNIT P07 exact 16 MiB candidate reserves before owned copy and typed cap overflow stays optional', () => {
  const { cache, context } = setup(); const selected = slot(context, rect());
  // 760 bytes are this explicit key/stage/data-view record; all remaining bytes are typed backing.
  publishPreparedStage2D(selected, 'packing', { data: new Float32Array((CAP - 760) / 4) }, ZERO);
  assert.equal(cache.snapshot().bytes, CAP); assert.equal(cache.snapshot().peakBytes, CAP);
  assert.equal(cache.snapshot().entries, 1); assert.equal(cache.snapshot().reservedBytes, 0);
  const overflow = slot(context, rect(), { ordinal: 1 });
  // Float32 backing grows by four bytes; this is its smallest representable over-cap case.
  publishPreparedStage2D(overflow, 'packing', { data: new Float32Array((CAP - 760) / 4 + 1) }, ZERO);
  assert.equal(readPreparedStage2D(overflow, 'packing'), undefined);
  assert.ok(readPreparedStage2D(selected, 'packing')); assert.equal(cache.snapshot().bytes, CAP);
  assert.equal(cache.snapshot().enabled, true);
  publish(overflow); assert.equal(cache.snapshot().entries, 1); assert.equal(readPreparedStage2D(selected, 'packing'), undefined);
  assert.equal(cache.snapshot().bytes, 704);
});

test('UNIT P08 clear disables publication through existing slots and releases searchable references', () => {
  const { cache, context } = setup(); const selected = slot(context, rect()); publish(selected);
  assert.equal(read(selected).value.marker, 1, 'Prime the slot before terminal invalidation');
  publishPreparedStage2D(selected, 'packing', { data: new Float32Array([2]) }, ZERO);
  assert.equal(readPreparedStage2D(selected, 'packing').value.data[0], 2);
  cache.clear(); assert.equal(read(selected), undefined); publish(selected);
  assert.equal(readPreparedStage2D(selected, 'packing'), undefined); acceptPreparedStage2D(selected);
  assert.equal(cache.context(1, OPTIONS), undefined); assert.equal(cache.slot(context, [rect()], 16, 16), undefined);
  assert.deepEqual([cache.snapshot().entries, cache.snapshot().bytes, cache.snapshot().reservedBytes, cache.snapshot().enabled], [0, 0, 0, false]);
  assert.equal(read({ kind: 'prepared-cache-slot' }), undefined);
  publish({ kind: 'prepared-cache-slot' }); assert.equal(cache.snapshot().entries, 0);
});

test('UNIT P09 invalid optional record metadata clears the cache without executing its getter', () => {
  const { cache, context } = setup(); const selected = slot(context, rect()); publish(selected);
  let reads = 0; const value = Object.defineProperty({}, 'marker', { enumerable: true, get() { reads++; throw new Error('must not execute'); } });
  publish(selected, value);
  assert.equal(reads, 0); assert.equal(read(selected), undefined); assert.equal(cache.snapshot().enabled, false);
  assert.equal(cache.snapshot().bytes, 0); assert.equal(cache.snapshot().reservedBytes, 0);
});

test('UNIT P10 replay debits all stage dimensions atomically and never recharges source triangles', () => {
  const budget = ledger({ maxPreparedVertices: 6, maxClipEdgeTests: 8, maxTupleComparisons: 4 });
  budget.admitSourceTriangles(2); budget.admitPreparedVertices(1); budget.admitPredicate(); budget.admitTupleComparison();
  const before = budget.snapshot();
  for (const cost of [
    { preparedVertices: 6, predicates: 1, tupleComparisons: 1 },
    { preparedVertices: 1, predicates: 8, tupleComparisons: 1 },
    { preparedVertices: 1, predicates: 1, tupleComparisons: 4 },
    { preparedVertices: 6, predicates: 8, tupleComparisons: 4 },
    { preparedVertices: -1, predicates: 0, tupleComparisons: 0 },
    { preparedVertices: 0, predicates: 0.5, tupleComparisons: 0 },
  ]) { assert.equal(tryReplayPreparedStage2D(budget, cost), false); assert.deepEqual(budget.snapshot(), before); }
  assert.equal(tryReplayPreparedStage2D(budget, { preparedVertices: 5, predicates: 7, tupleComparisons: 3 }), true);
  assert.deepEqual(budget.snapshot(), { sourceTrianglesCharged: 2, preparedVerticesCharged: 6, predicatesCharged: 8, tupleComparisonsCharged: 4 });
  assert.equal(tryReplayPreparedStage2D({ admitPreparedVertices() { assert.fail(); }, admitPredicate() { assert.fail(); } }, ZERO), false);
});

test('UNIT P11 current image table indices are rebound on warm geometry and packed payloads remain isolated', () => {
  const { cache, context } = setup(0); const a = image(), b = image();
  const first = prepareMixedDraws2D(frame([imageCommand()], [a, b]), 16, 16, OPTIONS, context)[0];
  const stored = read(first.cacheSlot).value;
  const initial = packImageVertices2D(first.prepared, 16, 16, 4096, undefined, first.cacheSlot);
  const expected = Array.from(initial.data); initial.data.fill(99);
  const second = prepareMixedDraws2D(frame([imageCommand({ imageIndex: 1 })], [b, a], 2), 16, 16, OPTIONS, context)[0];
  assert.equal(second.prepared.imageIndex, 1); assert.equal(second.prepared.points, stored.points);
  const repeated = packImageVertices2D(second.prepared, 16, 16, 4096, undefined, second.cacheSlot);
  assert.deepEqual(Array.from(repeated.data), expected); assert.notEqual(repeated.data, readPreparedStage2D(second.cacheSlot, 'packing').value.data);
  repeated.data.fill(-99);
  assert.deepEqual(Array.from(packImageVertices2D(second.prepared, 16, 16, 4096, undefined, second.cacheSlot).data), expected);
  const changed = prepareMixedDraws2D(frame([imageCommand({ imageIndex: 1 })], [a, b], 3), 16, 16, OPTIONS, context)[0];
  assert.notEqual(changed.prepared.points, stored.points, 'equal pixels do not substitute a new image identity');
  assert.equal(cache.snapshot().entries, 1);
});

test('UNIT P12 both rectangle filtering stages preserve actual source holes on cold and warm runs', () => {
  const { context } = setup(0);
  const commands = [rect(), rect({ alpha: 0 }), rect({ rect: { x: 1, y: 1, width: 2 ** -30, height: 2 } }), rect({ matrix: { ...matrix(), tx: 5 } })];
  for (let pass = 0; pass < 2; pass++) {
    const draw = prepareMixedDraws2D(frame(commands, [], pass + 1), 16, 16, OPTIONS, context)[0];
    assert.deepEqual(draw.commandIndices, [0, 2, 3]);
    const sources = [], packed = packWebGPUVertices(draw.prepared, 16, 16, { maxUploadBytes: 4096, maxBufferSize: 4096 }, undefined, sources, draw.cacheSlot);
    assert.deepEqual(sources, [0, 2]); assert.deepEqual(sources.map(index => draw.commandIndices[index]), [0, 3]);
    assert.equal(packed.ranges.length, 2); assert.equal(packed.collapsedTriangles, 2);
  }
});

test('UNIT P13 geometry and packing replay match original whole-ledger charges without source duplication', () => {
  const { context } = setup(1); const a = image(), g = geometry();
  const commands = [rect(), imageCommand(), meshCommand()];
  const admitted = { frame: { ...frame(commands, [a]), geometries: [g] }, width: 16, height: 16, uniqueGeometryBytes: g.logicalByteLength,
    commands: commands.map((command, commandIndex) => ({ command, commandIndex, ...(command.kind !== 'rect' ? { image: a } : {}), ...(command.kind === 'mesh' ? { geometry: g } : {}) })) };
  const execute = cache => {
    const budget = ledger(); budget.admitSourceTriangles(g.triangleCount);
    const draws = prepareTexturedDraws2D(admitted, OPTIONS, budget, cache);
    const geometryCharges = budget.snapshot(), payloads = [];
    for (const draw of draws) {
      if (draw.kind === 'rect') payloads.push(packWebGPUVertices(draw.prepared, 16, 16, { maxUploadBytes: 4096, maxBufferSize: 4096 }, budget, [], draw.cacheSlot));
      else if (draw.kind === 'image') payloads.push(packImageVertices2D(draw.prepared, 16, 16, 4096, budget, draw.cacheSlot));
      else payloads.push(packTexturedMesh2D(draw.prepared, 16, 16, 4096, budget, draw.cacheSlot));
    }
    return { geometryCharges, finalCharges: budget.snapshot(), payloads };
  };
  const uncached = execute(undefined), cold = execute(context), warm = execute(context);
  assert.deepEqual(cold, uncached); assert.deepEqual(warm, uncached);
  assert.equal(warm.finalCharges.sourceTrianglesCharged, 2);
  assert.ok(warm.finalCharges.predicatesCharged > warm.geometryCharges.predicatesCharged);
  assert.ok(warm.finalCharges.tupleComparisonsCharged > 0);
  for (let i = 0; i < warm.payloads.length; i++) assert.notEqual(warm.payloads[i].data, cold.payloads[i].data);
});

test('UNIT P14 insufficient warm stage capacity reruns original operations with identical first error and debit', () => {
  const { context } = setup(); const input = frame([rect()]);
  prepareRectangles2D(input, 16, 16, OPTIONS, ledger(), [], context);
  const execute = cache => {
    const budget = ledger({ maxPreparedVertices: 1, maxClipEdgeTests: 1, maxTupleComparisons: 1 });
    let error;
    try { prepareRectangles2D(input, 16, 16, OPTIONS, budget, [], cache); } catch (cause) { error = cause; }
    assert.ok(error instanceof GeometryPreparationError); assert.equal(error.reason, 'budget');
    return { reason: error.reason, cause: error.cause, charged: budget.snapshot() };
  };
  assert.deepEqual(execute(context), execute(undefined));
  assert.deepEqual(execute(context).charged, { sourceTrianglesCharged: 0, preparedVerticesCharged: 0, predicatesCharged: 1, tupleComparisonsCharged: 0 });
});

test('UNIT P15 image and mesh warm stages retain current metadata and exact successful preparation values', () => {
  const { context } = setup(); const a = image(), g = geometry();
  const command = imageCommand(), selected = slot(context, command, { image: a });
  const original = prepareImage2D(command, 16, 16, OPTIONS, ledger(), selected);
  const current = prepareImage2D({ ...command, imageIndex: 7 }, 16, 16, OPTIONS, ledger(), selected);
  assert.equal(current.imageIndex, 7); assert.deepEqual(current.points, original.points);
  assert.equal(current.points, read(selected).value.points);
  const mesh = meshCommand(), meshSlot = slot(context, mesh, { image: a, geometry: g, ordinal: 1 });
  const firstBudget = ledger(); firstBudget.admitSourceTriangles(2);
  const first = prepareTexturedMesh2D(mesh, g, 16, 16, OPTIONS, firstBudget, meshSlot);
  const nextBudget = ledger(); nextBudget.admitSourceTriangles(2);
  const next = prepareTexturedMesh2D({ ...mesh, imageIndex: 4, geometryIndex: 8 }, g, 16, 16, OPTIONS, nextBudget, meshSlot);
  assert.deepEqual(next, first); assert.equal(next, read(meshSlot).value); assert.deepEqual(nextBudget.snapshot(), firstBudget.snapshot());
});

test('UNIT P05a cross-stage owned source reuse charges both independently retained typed copies', () => {
  // Bounded private alias counterexample; this does not claim that a public
  // preparation path currently republishes this exact owned-stage alias.
  const { cache, context } = setup(); const selected = slot(context, rect());
  try {
    const source = { data: new Float32Array([1, 2]) };
    publish(selected, source);
    const geometryStage = read(selected); assert.ok(geometryStage);
    assert.notEqual(geometryStage.value, source);
    assert.notEqual(geometryStage.value.data, source.data);
    source.data[0] = 99;
    assert.deepEqual(Array.from(geometryStage.value.data), [1, 2]);

    publishPreparedStage2D(selected, 'packing', geometryStage.value, ZERO);
    const packingStage = readPreparedStage2D(selected, 'packing'); assert.ok(packingStage);
    assert.equal(read(selected), geometryStage);
    assert.notEqual(packingStage.value, geometryStage.value);
    assert.notEqual(packingStage.value.data, geometryStage.value.data);
    assert.deepEqual(Array.from(packingStage.value.data), [1, 2]);
    geometryStage.value.data[0] = 7;
    assert.deepEqual(Array.from(packingStage.value.data), [1, 2], 'Packing owns a separate backing');
    assert.equal(cache.snapshot().entries, 1); assert.equal(cache.snapshot().reservedBytes, 0);
    // 256 base + 296 key + two separately owned stages, each containing:
    // 56 stage + 40 value record + 56 view + 8 backing + 56 cost = 216.
    assert.equal(cache.snapshot().bytes, 984, 'Independent owned copies cannot share one logical byte charge');
  } finally {
    cache.clear();
    assert.deepEqual([cache.snapshot().entries, cache.snapshot().bytes, cache.snapshot().reservedBytes], [0, 0, 0]);
  }
});

test('UNIT P16 changing calls release both owned stages into one fully charged numeric probe', () => {
  const cache = new PreparedFrameCache2D();
  const next = tx => slot(cache.context(1, OPTIONS), rect({ matrix: { ...matrix(), tx } }));
  const produce = (selected, marker) => {
    publish(selected, { marker });
    publishPreparedStage2D(selected, 'packing', { data: new Float32Array([marker, 2]) }, ZERO);
  };
  try {
    for (const marker of [0, 1]) {
      const selected = next(marker); assert.equal(read(selected), undefined); produce(selected, marker);
      assert.equal(read(selected).value.marker, marker);
      assert.deepEqual(Array.from(readPreparedStage2D(selected, 'packing').value.data), [marker, 2]);
    }
    for (const marker of [2, 3, 4, 5]) {
      const selected = next(marker); assert.equal(read(selected), undefined); produce(selected, marker);
      assert.equal(read(selected), undefined, 'Second and continuing replacement misses retain no geometry stage');
      assert.equal(readPreparedStage2D(selected, 'packing'), undefined, 'Packing in the same call cannot rearm the probe');
      // Rectangle key: 24 numbers. No resource or stage is retained by a probe.
      assert.equal(cache.snapshot().bytes, 256 + 80 + 24 + 8 * 24);
      assert.equal(cache.snapshot().entries, 1); assert.equal(cache.snapshot().reservedBytes, 0);
      assert.ok(cache.snapshot().peakBytes <= CAP);
    }
  } finally {
    cache.clear();
    assert.deepEqual([cache.snapshot().entries, cache.snapshot().bytes, cache.snapshot().reservedBytes], [0, 0, 0]);
  }
});

test('UNIT P17 stages and duplicate slots count one call; stale publication cannot confirm a newer probe observation', () => {
  const cache = new PreparedFrameCache2D();
  const command = tx => rect({ matrix: { ...matrix(), tx } });
  const context = () => cache.context(1, OPTIONS);
  const produce = (selected, marker) => {
    publish(selected, { marker });
    publishPreparedStage2D(selected, 'packing', { data: new Float32Array([marker, 2]) }, ZERO);
  };
  try {
    produce(slot(context(), command(0)), 0);
    const firstCall = context(), first = slot(firstCall, command(1)); produce(first, 1);
    const duplicate = slot(firstCall, command(1)); produce(duplicate, 1);
    assert.equal(read(first).value.marker, 1, 'Two stages and two slots are still one replacement call');
    assert.deepEqual(Array.from(readPreparedStage2D(duplicate, 'packing').value.data), [1, 2]);

    const secondCall = context(), second = slot(secondCall, command(2)); produce(second, 2);
    assert.equal(read(second), undefined, 'The next changing call converts the candidate');
    const suppressed = slot(secondCall, command(2)); produce(suppressed, 20);
    assert.equal(read(suppressed), undefined, 'A same-call duplicate cannot cold-rearm');
    assert.equal(readPreparedStage2D(second, 'packing'), undefined);

    const pendingCall = context(), stale = slot(pendingCall, command(3));
    const unpublished = slot(pendingCall, command(4));
    assert.equal(read(stale), undefined); assert.equal(read(unpublished), undefined);
    produce(stale, 3); // This producer belongs to the superseded numerical observation.
    const notYetStable = slot(context(), command(4)); produce(notYetStable, 4);
    assert.equal(read(notYetStable), undefined, 'A stale producer cannot mark the unpublished newer numbers successful');
    assert.equal(readPreparedStage2D(notYetStable, 'packing'), undefined);
    assert.equal(cache.snapshot().bytes, 552);

    const restored = slot(context(), command(4));
    assert.equal(read(restored), undefined, 'An observed stable probe permits only complete cold production');
    produce(restored, 40);
    assert.equal(read(restored).value.marker, 40);
    assert.deepEqual(Array.from(readPreparedStage2D(restored, 'packing').value.data), [40, 2]);
  } finally {
    cache.clear();
    assert.deepEqual([cache.snapshot().entries, cache.snapshot().bytes, cache.snapshot().reservedBytes], [0, 0, 0]);
  }
});

test('UNIT P18 probe rearming retains current resource identity, signed zero, accepted-hit history and terminal clear', () => {
  const cache = new PreparedFrameCache2D(), a = image(), b = image();
  assert.notEqual(a, b); assert.equal(a.byteLength, b.byteLength);
  const command = (tx, zero = 0, clips = []) => imageCommand({ matrix: { ...matrix(), tx, b: zero }, clips });
  const next = (resource, tx, zero = 0, clips = []) => slot(cache.context(1, OPTIONS), command(tx, zero, clips), { image: resource });
  const produce = (selected, marker) => {
    publish(selected, { marker });
    publishPreparedStage2D(selected, 'packing', { data: new Float32Array([marker, 2]) }, ZERO);
  };
  const absent = selected => {
    assert.equal(read(selected), undefined); assert.equal(readPreparedStage2D(selected, 'packing'), undefined);
  };
  try {
    produce(next(a, 0), 0); produce(next(a, 1), 1);
    const probe = next(a, 2); produce(probe, 2); absent(probe);
    // Image key: 27 numbers; equal-size image identities are not retained by the probe.
    assert.equal(cache.snapshot().bytes, 576);
    const current = next(b, 2); absent(current); produce(current, 200);
    assert.equal(read(current).value.marker, 200);
    assert.deepEqual(Array.from(readPreparedStage2D(current, 'packing').value.data), [200, 2]);
    absent(next(a, 2));
    const readOnlyReplacement = next(a, 2); produce(readOnlyReplacement, 300); absent(readOnlyReplacement);
    assert.equal(cache.snapshot().bytes, 576, 'Read alone did not reset the rearmed replacement marker');

    const accepted = next(b, 2); absent(accepted); produce(accepted, 400);
    assert.equal(read(accepted).value.marker, 400); acceptPreparedStage2D(accepted);
    const afterAccepted = next(a, 2); absent(afterAccepted); produce(afterAccepted, 500);
    assert.equal(read(afterAccepted).value.marker, 500, 'A real accepted stage hit resets replacement history');
    const changedAgain = next(b, 2); produce(changedAgain, 501); absent(changedAgain);

    const negativeZero = next(b, 2, -0); produce(negativeZero, 600); absent(negativeZero);
    const stableNegativeZero = next(b, 2, -0); absent(stableNegativeZero); produce(stableNegativeZero, 700);
    assert.equal(read(stableNegativeZero).value.marker, 700);
    absent(next(b, 2, +0));
    const changedNumber = next(b, 3, -0); produce(changedNumber, 701); absent(changedNumber);

    const clips = [{ matrix: matrix(), rect: { x: 0, y: 0, width: 12, height: 12 } }];
    // A different sequence length may return a disabled slot. Either way, its
    // later geometry/packing publications cannot rebuild a cache in that call.
    const lengthCall = cache.context(1, OPTIONS);
    const lengthChanged = cache.slot(lengthCall, [command(3, -0, clips)], 16, 16, b);
    produce(lengthChanged, 800); absent(lengthChanged);
    assert.equal(cache.snapshot().entries, 0); assert.equal(cache.snapshot().bytes, 0);
    const freshLength = next(b, 3, -0, clips); absent(freshLength); produce(freshLength, 801);
    assert.equal(read(freshLength).value.marker, 801);
    produce(next(b, 4, -0, clips), 802);
    const terminalProbe = next(b, 5, -0, clips); produce(terminalProbe, 803); absent(terminalProbe);
    assert.equal(cache.snapshot().bytes, 656, 'The ten extra clip numbers remain charged');
    cache.clear(); produce(terminalProbe, 999); produce(current, 999); absent(terminalProbe); absent(current);
    assert.equal(cache.context(1, OPTIONS), undefined);
    assert.deepEqual([cache.snapshot().entries, cache.snapshot().bytes, cache.snapshot().reservedBytes, cache.snapshot().enabled], [0, 0, 0, false]);
  } finally {
    cache.clear();
    assert.deepEqual([cache.snapshot().entries, cache.snapshot().bytes, cache.snapshot().reservedBytes], [0, 0, 0]);
  }
});

test('UNIT P19 a warm slot reads current stages after exact-key transfer and rejects a new key', () => {
  const { cache, context } = setup();
  const command = rect({ clips: Array.from({ length: 8 }, (_, index) => ({ matrix: matrix(), rect: { x: index / 16, y: 0, width: 12, height: 12 } })) });
  const first = slot(context, command);
  try {
    publish(first, { marker: 1 });
    publishPreparedStage2D(first, 'packing', { data: new Float32Array([1]) }, ZERO);
    const warm = slot(cache.context(1, OPTIONS), command);
    const oldGeometry = read(warm), oldPacking = readPreparedStage2D(warm, 'packing');
    assert.equal(oldGeometry.value.marker, 1); assert.equal(oldPacking.value.data[0], 1);
    acceptPreparedStage2D(warm);

    const same = slot(cache.context(1, OPTIONS), structuredClone(command));
    publish(same, { marker: 2 });
    assert.equal(read(warm).value.marker, 2, 'A key match never pins the old Entry or geometry');
    assert.equal(readPreparedStage2D(warm, 'packing'), oldPacking, 'Unchanged other-stage ownership transfers');
    publishPreparedStage2D(same, 'packing', { data: new Float32Array([3]) }, ZERO);
    assert.equal(readPreparedStage2D(warm, 'packing').value.data[0], 3);
    assert.equal(oldGeometry.value.marker, 1); assert.equal(oldPacking.value.data[0], 1);

    const changed = structuredClone(command); changed.clips[7].matrix.tx = 0.25;
    const replacement = slot(cache.context(1, OPTIONS), changed);
    assert.equal(read(replacement), undefined, 'A new slot still compares the entire ordered clip key');
    publish(replacement, { marker: 4 });
    assert.equal(read(replacement).value.marker, 4);
    assert.equal(read(warm), undefined); assert.equal(readPreparedStage2D(warm, 'packing'), undefined);
  } finally { cache.clear(); }
});

test('UNIT P20 reentrant replay cannot let an old slot touch a replacement, probe or rearmed key', () => {
  const cache = new PreparedFrameCache2D(), pixels = image();
  const command = tx => imageCommand({ matrix: { ...matrix(), tx } });
  const next = tx => slot(cache.context(1, OPTIONS), command(tx), { image: pixels });
  try {
    const first = next(0); prepareImage2D(command(0), 16, 16, OPTIONS, ledger(), first);
    const warm = next(0), retained = read(warm); assert.ok(retained);
    let replacement, replayed = 0;
    const result = prepareImage2D(command(0), 16, 16, OPTIONS, {
      admitPreparedVertices() { assert.fail('Warm replay must not enter cold preparation'); },
      admitPredicate() { assert.fail('Warm replay must not enter cold preparation'); },
      tryReplayStageCost(cost) {
        replayed++; assert.deepEqual(cost, retained.cost);
        replacement = next(1); prepareImage2D(command(1), 16, 16, OPTIONS, ledger(), replacement);
        assert.ok(read(replacement)); return true;
      },
    }, warm);
    assert.equal(replayed, 1); assert.equal(result.points, retained.value.points, 'Already-read successful geometry remains the current call result');
    assert.equal(read(warm), undefined);

    const probe = next(2); prepareImage2D(command(2), 16, 16, OPTIONS, ledger(), probe);
    assert.equal(read(probe), undefined, 'The old slot did not reset replacement history during reentrant accept');
    assert.equal(read(replacement), undefined, 'The formerly successful identity cannot authorize a numeric probe');
    const rearmed = next(2); prepareImage2D(command(2), 16, 16, OPTIONS, ledger(), rearmed);
    assert.ok(read(rearmed)); assert.equal(read(replacement), undefined); assert.equal(read(warm), undefined);

    const current = next(2), beforeClear = read(current); assert.ok(beforeClear);
    const afterClear = prepareImage2D(command(2), 16, 16, OPTIONS, {
      admitPreparedVertices() { assert.fail('Warm replay must not enter cold preparation'); },
      admitPredicate() { assert.fail('Warm replay must not enter cold preparation'); },
      tryReplayStageCost(cost) { assert.deepEqual(cost, beforeClear.cost); cache.clear(); return true; },
    }, current);
    assert.equal(afterClear.points, beforeClear.value.points);
    assert.equal(read(current), undefined); assert.equal(cache.snapshot().enabled, false);
    assert.deepEqual([cache.snapshot().entries, cache.snapshot().bytes, cache.snapshot().reservedBytes], [0, 0, 0]);
  } finally { cache.clear(); }
});

test('UNIT P21 exhausted numeric key identities stay on full comparison without reusing a slot match', () => {
  const cache = new PreparedFrameCache2D();
  // UNIT-only near-exhaustion state on the existing private cache instance;
  // no loader interception, product hook or new export is needed.
  cache.nextKeyIdentity = Number.MAX_SAFE_INTEGER - 1;
  const next = tx => slot(cache.context(1, OPTIONS), rect({ matrix: { ...matrix(), tx } }));
  try {
    const last = next(0); publish(last, { marker: 0 }); assert.equal(read(last).value.marker, 0); acceptPreparedStage2D(last);
    assert.equal(cache.nextKeyIdentity, Number.MAX_SAFE_INTEGER);
    const firstFallback = next(1); assert.equal(read(firstFallback), undefined);
    publish(firstFallback, { marker: 1 }); assert.equal(read(firstFallback).value.marker, 1); acceptPreparedStage2D(firstFallback);
    assert.equal(read(last), undefined);
    const secondFallback = next(2); assert.equal(read(secondFallback), undefined, 'Zero is not a reusable match identity');
    publish(secondFallback, { marker: 2 }); assert.equal(read(secondFallback).value.marker, 2); acceptPreparedStage2D(secondFallback);
    assert.equal(read(firstFallback), undefined); assert.equal(read(next(1)), undefined);
    assert.equal(cache.nextKeyIdentity, Number.MAX_SAFE_INTEGER, 'The exhausted counter neither wraps nor advances');
    assert.equal(read(next(2)).value.marker, 2, 'Exact values still hit through the original comparison');
  } finally { cache.clear(); }
});
