import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { LayoutModel, adjacentBatches, Mirror, BoundedQueue, ResourceModel } from './model.mjs';

const results = [];
const seed = 20261008;
let state = seed;
const random = n => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n; };
function test(name, fn) {
  try { const observations = fn(); results.push({ name, status: 'passed', observations: observations ?? {} }); }
  catch (error) { results.push({ name, status: 'failed', error: error.message }); }
}
function reference(regions) {
  // Independent full-layout oracle reads source dimensions, ignoring incremental caches.
  return regions.map(region => {
    const children = region.items.map((item, index) => ({
      x: region.x, y: region.items.slice(0, index).reduce((sum, prior) => sum + prior.h, 0), w: item.w, h: item.h,
    }));
    return { x: region.x, width: Math.max(...children.map(c => c.w)), height: children.reduce((sum, c) => sum + c.h, 0), children };
  });
}
test('UI incremental result equals independent full oracle for 200 seeded frames', () => {
  const model = new LayoutModel();
  for (let frame = 0; frame < 200; frame++) {
    for (let n = 0; n < 1 + random(40); n++) model.update(random(8), random(128), { w: 1 + random(40), h: 1 + random(20) });
    model.flush(); assert.deepEqual(model.snapshot(), reference(model.regions));
  }
  return { frames: 200, objects: 1024, seed };
});
test('UI unchanged frame performs no layout work', () => {
  assert.deepEqual(new LayoutModel().flush(), { changedRegions: 0, propertyWrites: 0, aggregateReads: 0, placementWrites: 0 });
});
test('UI isolated height change updates following siblings but not other regions', () => {
  const model = new LayoutModel(); const before = model.snapshot();
  model.update(2, 12, { h: 100 }); const work = model.flush();
  assert.deepEqual(model.snapshot(), reference(model.regions));
  assert.deepEqual(model.snapshot()[3], before[3]);
  assert.notEqual(model.snapshot()[2].children[13].y, before[2].children[13].y);
  assert.equal(work.changedRegions, 1); assert.equal(work.aggregateReads, 128); assert.equal(work.placementWrites, 128);
  return { sparseWork: work, fullReferenceRegionCount: 8, note: 'Work counts, not timing or engine speedups; dirty parent still reads 128 siblings.' };
});
test('UI repeated invalidation coalesces state without losing final dimensions', () => {
  const model = new LayoutModel(); for (let i = 0; i < 1000; i++) model.update(0, 0, { h: i + 1 });
  const work = model.flush(); assert.equal(work.propertyWrites, 1); assert.deepEqual(model.snapshot(), reference(model.regions));
});
test('UI fully dirty workload remains correct and is not claimed cheap', () => {
  const model = new LayoutModel();
  for (let r = 0; r < 8; r++) for (let i = 0; i < 128; i++) model.update(r, i, { h: 2 + i % 11 });
  const work = model.flush(); assert.equal(work.placementWrites, 1024); assert.deepEqual(model.snapshot(), reference(model.regions));
  return work;
});

function paint(commands, size = 12) {
  const pixels = new Float64Array(size * size * 3);
  for (const c of commands) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (x < c.rect[0] || y < c.rect[1] || x >= c.rect[2] || y >= c.rect[3]) continue;
    if (c.clip && (x < c.clip[0] || y < c.clip[1] || x >= c.clip[2] || y >= c.clip[3])) continue;
    const at = (y * size + x) * 3;
    for (let k = 0; k < 3; k++) pixels[at + k] = c.color[k] * c.alpha + pixels[at + k] * (1 - c.alpha);
  }
  return Array.from(pixels);
}
const command = (texture, color, alpha = .5, clip = null, rect = [0, 0, 12, 12]) => ({ texture, color, alpha, clip, rect, pipeline: 'straight_alpha' });
test('Ordered adjacent batches preserve CPU pixels for seeded transparent and clipped scenes', () => {
  for (let scene = 0; scene < 80; scene++) {
    const draws = Array.from({ length: 20 }, () => command(String(random(3)), [random(100) / 100, random(100) / 100, random(100) / 100], .2 + random(70) / 100,
      random(2) ? [2, 2, 9, 9] : null, [random(5), random(5), 8 + random(4), 8 + random(4)]));
    const batched = adjacentBatches(draws).flatMap(b => b.commands);
    assert.deepEqual(paint(batched), paint(draws));
  }
  return { scenes: 80, dimensions: [12, 12], limitation: 'CPU rectangles only; not fonts, arbitrary masks, skeletons or GPU output.' };
});
test('Global texture sorting provides a falsifying transparent-order counterexample', () => {
  const draws = [command('a', [1, 0, 0]), command('b', [0, 1, 0]), command('a', [0, 0, 1])];
  const wrong = [...draws].sort((a, b) => a.texture.localeCompare(b.texture));
  assert.notDeepEqual(paint(wrong), paint(draws));
  return { originalFirstPixel: paint(draws).slice(0, 3), wronglySortedFirstPixel: paint(wrong).slice(0, 3) };
});
test('Clip-state changes create batch boundaries even for equal texture', () => {
  const batches = adjacentBatches([command('a', [1, 0, 0]), command('a', [1, 0, 0], .5, [1, 1, 9, 9])]);
  assert.equal(batches.length, 2);
});

const packet = (sequence, commands, epoch = 1, version = 1) => ({ sequence, commands, epoch, version });
const create = (generation = 1, value = 1) => ({ kind: 'create', id: 7, generation, value });
test('Mirror duplicate packet does not replay consumed event', () => {
  const m = new Mirror(); const p = packet(1, [create(), { kind: 'event', name: 'damage' }]);
  assert.equal(m.apply(p).status, 'applied'); assert.equal(m.apply(p).status, 'duplicate'); assert.deepEqual(m.events, ['damage']);
});
test('Mirror invalid command rolls back entire packet and event', () => {
  const m = new Mirror();
  assert.equal(m.apply(packet(1, [create(), { kind: 'event', name: 'bad' }, { kind: 'update', id: 99, generation: 1, value: 5 }])).status, 'invalid_generation');
  assert.equal(m.objects.size, 0); assert.equal(m.next, 1); assert.deepEqual(m.events, []);
});
test('Mirror stale generation cannot mutate reused ID', () => {
  const m = new Mirror(); m.apply(packet(1, [create()])); m.apply(packet(2, [{ kind: 'destroy', id: 7, generation: 1 }]));
  m.apply(packet(3, [create(2, 10)]));
  assert.equal(m.apply(packet(4, [{ kind: 'update', id: 7, generation: 1, value: 99 }])).status, 'invalid_generation');
  assert.equal(m.objects.get(7).value, 10);
});
test('Mirror sequence gap stops incremental application until a new-epoch snapshot', () => {
  const m = new Mirror(); m.apply(packet(1, [create(), { kind: 'event', name: 'once' }]));
  assert.equal(m.apply(packet(3, [])).status, 'sequence_gap'); assert.equal(m.apply(packet(2, [])).status, 'snapshot_required');
  m.restore({ epoch: 2, next: 4, objects: [{ id: 7, generation: 1, value: 8 }], generations: [[7, 1]] });
  assert.equal(m.apply(packet(2, [])).status, 'wrong_epoch'); assert.equal(m.apply(packet(4, [], 2)).status, 'applied');
  assert.deepEqual(m.events, ['once']); assert.equal(m.objects.get(7).value, 8);
});
test('Mirror incompatible protocol changes no state', () => {
  const m = new Mirror(); assert.equal(m.apply(packet(1, [create()], 1, 2)).status, 'incompatible'); assert.equal(m.objects.size, 0);
});
test('Bounded queue applies backpressure without silently dropping events', () => {
  const q = new BoundedQueue(3); assert(q.push('a')); assert(q.push('b')); assert(q.push('c')); assert.equal(q.push('d'), false);
  assert.deepEqual([q.pop(), q.pop(), q.pop()], ['a', 'b', 'c']); assert(q.push('d'));
});
test('Released resource rejects stale asynchronous completion after ID reuse', () => {
  const r = new ResourceModel(); const old = r.acquire('texture', 'sceneA'); r.release(old, 'sceneA');
  const fresh = r.acquire('texture', 'sceneB'); assert.equal(r.complete(old), false); assert.equal(r.complete(fresh), true);
});
test('Shared resource keeps GPU residency until last owner and completed fence', () => {
  const r = new ResourceModel(); const h = r.acquire('texture', 'sceneA'); r.acquire('texture', 'sceneB'); r.complete(h); r.use(h, 3);
  r.release(h, 'sceneA'); assert(r.resources.has('texture')); r.release(h, 'sceneB'); r.fence(2); assert(r.resources.has('texture'));
  r.fence(3); assert.equal(r.resources.has('texture'), false);
});
test('Device loss rebuilds owned GPU projection without inventing a new resource identity', () => {
  const r = new ResourceModel(); const h = r.acquire('texture', 'sceneA'); r.complete(h); r.loseDevice();
  assert.throws(() => r.use(h, 1), /unavailable/); r.rebuild(); r.use(h, 1); assert.equal(r.resources.get('texture').generation, h.generation);
});
const files = ['model.mjs', 'run.mjs'];
const hashes = [];
for (const path of files) hashes.push({ path, sha256: createHash('sha256').update(await readFile(new URL(path, import.meta.url))).digest('hex') });
const report = { schemaVersion: 1, experiment: 'architecture_contract_probe', checkedAtUtc: new Date().toISOString(),
  status: results.every(r => r.status === 'passed') ? 'passed' : 'failed', seed,
  environment: { node: process.version, platform: process.platform, architecture: process.arch },
  counts: { total: results.length, passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status !== 'passed').length },
  results, sourceHashes: hashes, limitations: ['Research model, not production engine code.', 'No actual JS/C++/WASM crossing, GPU timing, mobile or host performance measurement.', 'No fonts/skeleton animation, complete EUI layout or old-project migration acceptance.'] };
const target = new URL('../../evidence/contract-probe-results.json', import.meta.url);
await writeFile(target, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ experiment: report.experiment, status: report.status, counts: report.counts }));
process.exitCode = report.counts.failed ? 1 : 0;
