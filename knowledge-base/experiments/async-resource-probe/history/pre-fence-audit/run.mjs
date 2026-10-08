import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const legacy = process.argv.includes('--legacy-red');
const modulePath = legacy ? '../contract-probe/model.mjs' : './model.mjs';
const imported = await import(modulePath);
// Test utility only: expose the old combined completion and owner Set policy
// through a common observation interface. It adds no safety to ResourceModel.
class LegacyAdapter {
  constructor() { this.old = new imported.ResourceModel(); this.serial = 0; }
  acquire(id, owner) { return { ...this.old.acquire(id, owner), owner, leaseId: ++this.serial }; }
  release(h) { this.old.release(h, h.owner); return true; }
  cancel(h) { return this.release(h); }
  decodeStart(h) { return h; }
  completeDecode(h) { return this.old.complete(h); }
  uploadStart(h) { return h; }
  completeUpload(h, result) { return result.ok ? this.old.complete(h) : false; }
  use(h, frame) { this.old.use(h, frame); return true; }
  fence(frame, epoch) { this.old.fence(frame); }
  loseDevice() { this.old.loseDevice(); }
  restoreDevice() { this.old.rebuild(); }
  snapshot(id) {
    const r = this.old.resources.get(id);
    return r ? { leaseCount: r.owners.size, cpuState: r.ready ? 'decoded' : 'empty',
      gpuState: r.resident ? 'resident' : 'empty', resident: r.resident,
      cpuData: r.ready ? 'pixels' : null, deviceEpoch: this.old.deviceEpoch,
      resourceGeneration: r.generation, error: null } : null;
  }
}
const Model = legacy ? LegacyAdapter : imported.AsyncResourceModel;
const results = [];
function test(name, breaks, fn, legacyCase = false) {
  if (legacy && !legacyCase) return;
  const observations = { breaks, checkpoints: [] };
  const observe = (m, label, id = 'texture') => observations.checkpoints.push({ label, state: m.snapshot(id) });
  try { fn(observe, observations); results.push({ name, status: 'passed', observations }); }
  catch (error) { results.push({ name, status: 'failed', observations, error: error.message }); }
}
function decoded(m, lease) { const task = m.decodeStart(lease); assert.equal(m.completeDecode(task, { ok: true, data: 'pixels' }), true); return task; }
function resident(m, lease) { decoded(m, lease); const task = m.uploadStart(lease); assert.equal(m.completeUpload(task, { ok: true }), true); return task; }

test('One release preserves the other lease acquired by the same owner', 'Replacing independent leases with an owner Set destroys a live resource', (observe) => {
  const m = new Model(), a = m.acquire('texture', 'scene'), b = m.acquire('texture', 'scene');
  resident(m, b); observe(m, 'two-acquires'); m.release(a); observe(m, 'one-release');
  assert.doesNotThrow(() => m.use(b, 2)); assert.equal(m.snapshot('texture').leaseCount, 1);
}, true);

test('Lease count records repeated acquisition by one owner', 'Counting distinct owners undercounts references', (observe) => {
  const m = new Model(); m.acquire('texture', 'scene'); m.acquire('texture', 'scene'); m.acquire('texture', 'overlay');
  observe(m, 'three-leases'); assert.equal(m.snapshot('texture').leaseCount, 3);
}, true);

test('Canceling one lease keeps another same-owner lease usable', 'Owner-wide cancel removes an unrelated acquisition', (observe) => {
  const m = new Model(), a = m.acquire('texture', 'scene'), b = m.acquire('texture', 'scene'); resident(m, b);
  m.cancel(a); observe(m, 'cancel-one'); assert.doesNotThrow(() => m.use(b, 1));
}, true);

test('CPU decode completion during device loss remains reusable', 'Device epoch incorrectly invalidates CPU decode', (observe) => {
  const m = new Model(), h = m.acquire('texture', 'scene'), task = m.decodeStart(h);
  m.loseDevice(); assert.equal(m.completeDecode(task, { ok: true, data: 'pixels' }), true);
  observe(m, 'decoded-while-device-lost'); assert.equal(m.snapshot('texture').cpuState, 'decoded');
  assert.equal(m.snapshot('texture').resident, false); assert.throws(() => m.use(h, 1));
  m.restoreDevice(); const upload = m.uploadStart(h); assert.equal(m.completeUpload(upload, { ok: true }), true); m.use(h, 2);
}, true);

test('CPU success cannot report GPU residency before upload success', 'Combined decode and upload completion exposes unavailable GPU data', (observe) => {
  const m = new Model(), h = m.acquire('texture', 'scene'); decoded(m, h); observe(m, 'CPU-only');
  assert.equal(m.snapshot('texture').resident, false); assert.throws(() => m.use(h, 1));
  const task = m.uploadStart(h); observe(m, 'upload-pending'); assert.equal(m.snapshot('texture').gpuState, 'uploading');
  assert.throws(() => m.use(h, 1)); m.completeUpload(task, { ok: true }); assert.doesNotThrow(() => m.use(h, 1));
}, true);

test('Device restoration requires asynchronous reupload of preserved CPU data', 'Synchronous rebuild falsely reports resident', (observe) => {
  const m = new Model(), h = m.acquire('texture', 'scene'); resident(m, h); m.loseDevice(); m.restoreDevice();
  observe(m, 'device-restored-before-upload'); assert.equal(m.snapshot('texture').resident, false);
  assert.equal(m.snapshot('texture').cpuData, 'pixels'); assert.throws(() => m.use(h, 2));
  const task = m.uploadStart(h); observe(m, 'reupload-pending'); m.completeUpload(task, { ok: true }); m.use(h, 3);
}, true);

test('Upload OOM is attributable and never marks a resource resident', 'GPU errors are dropped or interpreted as successful upload', (observe) => {
  const m = new Model(), h = m.acquire('texture', 'scene'); decoded(m, h); const task = m.uploadStart(h);
  assert.equal(m.completeUpload(task, { ok: false, code: 'OOM' }), true); observe(m, 'OOM');
  const state = m.snapshot('texture'); assert.equal(state.resident, false); assert.equal(state.gpuState, 'upload_failed');
  assert.equal(state.error.stage, 'upload'); assert.equal(state.error.code, 'OOM');
  assert.equal(state.error.deviceEpoch, task.deviceEpoch); assert.equal(state.error.taskId, task.taskId);
  assert.throws(() => m.use(h, 1));
}, true);

test('Released handle cannot consume or release a reacquired lease behind a fence', 'Stale handle removes a new acquisition', (observe) => {
  const m = new Model(), old = m.acquire('texture', 'scene'); resident(m, old); m.use(old, 7); m.release(old);
  const fresh = m.acquire('texture', 'scene'); observe(m, 'reacquired');
  assert.equal(m.release(old), false); assert.throws(() => m.use(old, 8)); assert.equal(m.snapshot('texture').leaseCount, 1); m.use(fresh, 8);
});

test('Final release retains resource until its actual use fence completes', 'Collection frees a resource still in flight', (observe) => {
  const m = new Model(), h = m.acquire('texture', 'scene'); resident(m, h); m.use(h, 9); m.release(h);
  m.fence(8); observe(m, 'fence-not-yet-complete'); assert.notEqual(m.snapshot('texture'), null);
  assert.throws(() => m.use(h, 10)); m.fence(9); observe(m, 'fence-complete'); assert.equal(m.snapshot('texture'), null);
});

test('Old device fence cannot free an in-flight resource on the new device', 'Frame numbers collide across device epochs', (observe) => {
  const m = new Model(), h = m.acquire('texture', 'scene'); resident(m, h); const epoch = m.snapshot('texture').deviceEpoch;
  m.use(h, 100); m.loseDevice(); m.restoreDevice(); const task = m.uploadStart(h); m.completeUpload(task, { ok: true });
  m.use(h, 2); m.release(h); m.fence(100, epoch); observe(m, 'stale-device-fence'); assert.notEqual(m.snapshot('texture'), null);
  m.fence(2, task.deviceEpoch); assert.equal(m.snapshot('texture'), null);
});

test('Stale upload completion is rejected both during loss and after restore', 'Old upload resurrects residency after epoch changes', (observe) => {
  const m = new Model(), h = m.acquire('texture', 'scene'); decoded(m, h); const old = m.uploadStart(h); m.loseDevice();
  assert.equal(m.completeUpload(old, { ok: true }), false); m.restoreDevice(); const fresh = m.uploadStart(h);
  assert.equal(m.completeUpload(old, { ok: true }), false); observe(m, 'stale-upload-rejected');
  assert.equal(m.snapshot('texture').resident, false); m.completeUpload(fresh, { ok: true }); m.use(h, 1);
});

test('Shared CPU task survives cancel of its initiating lease when another remains', 'Cancel ties a shared task to one caller', (observe) => {
  const m = new Model(), a = m.acquire('texture', 'scene'), b = m.acquire('texture', 'overlay'), task = m.decodeStart(a);
  m.cancel(a); assert.equal(m.completeDecode(task, { ok: true, data: 'pixels' }), true);
  const upload = m.uploadStart(b); m.completeUpload(upload, { ok: true }); observe(m, 'remaining-owner'); m.use(b, 1);
});

test('Final cancel invalidates an old decode completion after reacquisition', 'Canceled decode can complete into a new resource generation', (observe) => {
  const m = new Model(), a = m.acquire('texture', 'scene'), old = m.decodeStart(a); m.cancel(a);
  const b = m.acquire('texture', 'scene'), fresh = m.decodeStart(b);
  assert.equal(m.completeDecode(old, { ok: true, data: 'stale' }), false); observe(m, 'old-decode-rejected');
  assert.equal(m.snapshot('texture').cpuData, null); m.completeDecode(fresh, { ok: true, data: 'pixels' });
});

test('Final cancel invalidates upload after loss and reacquisition', 'Reacquisition reaccepts canceled upload tasks', (observe) => {
  const m = new Model(), a = m.acquire('texture', 'scene'); resident(m, a); m.use(a, 8); m.loseDevice(); m.restoreDevice();
  const task = m.uploadStart(a); m.cancel(a); const b = m.acquire('texture', 'scene');
  assert.equal(m.completeUpload(task, { ok: true }), false); observe(m, 'cancelled-upload-rejected');
  assert.equal(m.snapshot('texture').resident, false); decoded(m, b); const fresh = m.uploadStart(b); m.completeUpload(fresh, { ok: true }); m.use(b, 1);
});

test('Upload retry uses a new task and rejects a late prior success', 'Retry reuses task identity and accepts outdated success', (observe) => {
  const m = new Model(), h = m.acquire('texture', 'scene'); decoded(m, h); const old = m.uploadStart(h);
  m.completeUpload(old, { ok: false, code: 'UPLOAD_FAILED' }); const fresh = m.uploadStart(h);
  assert.notEqual(fresh.taskId, old.taskId); assert.equal(m.completeUpload(old, { ok: true }), false);
  assert.equal(m.snapshot('texture').resident, false); m.completeUpload(fresh, { ok: true }); observe(m, 'retry-complete'); m.use(h, 1);
});

test('Decode failure is retained with task identity and explicit retry', 'Decode errors lose stage identity or permit upload', (observe) => {
  const m = new Model(), h = m.acquire('texture', 'scene'), old = m.decodeStart(h);
  m.completeDecode(old, { ok: false, code: 'BAD_FORMAT' }); observe(m, 'decode-failed');
  assert.equal(m.snapshot('texture').error.stage, 'decode'); assert.equal(m.snapshot('texture').error.taskId, old.taskId);
  assert.throws(() => m.uploadStart(h)); const fresh = m.decodeStart(h);
  assert.equal(m.completeDecode(old, { ok: true, data: 'stale' }), false); m.completeDecode(fresh, { ok: true, data: 'pixels' });
});

test('Duplicate callbacks cannot replace successful CPU or GPU results', 'Duplicate result mutates a terminal task', (observe) => {
  const m = new Model(), h = m.acquire('texture', 'scene'), decode = decoded(m, h);
  assert.equal(m.completeDecode(decode, { ok: true, data: 'replacement' }), false);
  const upload = m.uploadStart(h); m.completeUpload(upload, { ok: true });
  assert.equal(m.completeUpload(upload, { ok: false, code: 'OOM' }), false); observe(m, 'duplicates-rejected');
  assert.equal(m.snapshot('texture').cpuData, 'pixels'); assert.equal(m.snapshot('texture').resident, true);
});

test('Released lease cannot start CPU or GPU work for remaining owners', 'Work-start trusts resource identity instead of active lease', (observe) => {
  const m = new Model(), a = m.acquire('texture', 'scene'), b = m.acquire('texture', 'overlay'); m.release(a);
  assert.throws(() => m.decodeStart(a)); decoded(m, b); assert.throws(() => m.uploadStart(a)); observe(m, 'stale-start-denied');
});

test('Resource identity is independent of lease owner and other resource IDs', 'Completion or release crosses resource records', (observe) => {
  const m = new Model(), a = m.acquire('texture', 'scene'), b = m.acquire('other', 'scene'); resident(m, a); resident(m, b);
  m.release(a); assert.doesNotThrow(() => m.use(b, 1)); observe(m, 'other-still-usable', 'other');
  assert.equal(m.release({ ...b, owner: 'other-owner' }), false); assert.equal(m.snapshot('other').leaseCount, 1);
});

test('Device restoration cannot upload before an unfinished CPU task completes', 'Restore promotes undecoded resources', (observe) => {
  const m = new Model(), h = m.acquire('texture', 'scene'), decode = m.decodeStart(h); m.loseDevice(); m.restoreDevice();
  assert.throws(() => m.uploadStart(h)); assert.equal(m.completeDecode(decode, { ok: true, data: 'pixels' }), true);
  observe(m, 'CPU-result-after-restore'); assert.equal(m.snapshot('texture').resident, false);
});

test('Repeated losses reject both earlier upload epochs while preserving CPU', 'Only one preceding epoch is invalidated', (observe) => {
  const m = new Model(), h = m.acquire('texture', 'scene'); decoded(m, h); const first = m.uploadStart(h);
  m.loseDevice(); m.restoreDevice(); const second = m.uploadStart(h); m.loseDevice(); m.restoreDevice(); const third = m.uploadStart(h);
  assert.equal(m.completeUpload(first, { ok: true }), false); assert.equal(m.completeUpload(second, { ok: true }), false);
  assert.equal(m.snapshot('texture').cpuData, 'pixels'); m.completeUpload(third, { ok: true }); observe(m, 'third-epoch-resident'); m.use(h, 1);
});

test('Malformed completion leaves the current task pending for a valid result', 'Invalid result advances a task or corrupts state', (observe) => {
  const m = new Model(), h = m.acquire('texture', 'scene'), decode = m.decodeStart(h);
  assert.throws(() => m.completeDecode(decode, { ok: true })); assert.equal(m.snapshot('texture').cpuState, 'decoding');
  m.completeDecode(decode, { ok: true, data: 'pixels' }); const upload = m.uploadStart(h);
  assert.throws(() => m.completeUpload(upload, { ok: false })); assert.equal(m.snapshot('texture').gpuState, 'uploading');
  m.completeUpload(upload, { ok: true }); observe(m, 'valid-result-accepted');
});

test('Invalid frame values cannot poison fence or last-use tracking', 'NaN or negative frame permits premature collection', (observe) => {
  const m = new Model(), h = m.acquire('texture', 'scene'); resident(m, h);
  for (const frame of [-1, NaN, Infinity, 1.5]) { assert.throws(() => m.use(h, frame)); assert.throws(() => m.fence(frame)); }
  m.use(h, 4); m.release(h); m.fence(3); observe(m, 'valid-fence-still-pending'); assert.notEqual(m.snapshot('texture'), null);
  m.fence(4); assert.equal(m.snapshot('texture'), null);
});

test('Unissued lease and task fields cannot act on an active resource', 'Partial identity checks accept malformed capabilities', (observe) => {
  const m = new Model(), h = m.acquire('texture', 'scene'), decode = m.decodeStart(h);
  assert.equal(m.completeDecode({ ...decode, resourceGeneration: decode.resourceGeneration + 1 }, { ok: true, data: 'bad' }), false);
  assert.equal(m.release({ ...h, leaseId: 999999 }), false); assert.throws(() => m.use({ ...h, leaseId: 999999 }, 1));
  m.completeDecode(decode, { ok: true, data: 'pixels' }); const upload = m.uploadStart(h);
  assert.equal(m.completeUpload({ ...upload, deviceEpoch: 999999 }, { ok: true }), false); observe(m, 'invalid-identities-denied');
});

const sourcePaths = legacy ? ['run.mjs', '../contract-probe/model.mjs'] : ['run.mjs', 'model.mjs'];
const sourceHashes = await Promise.all(sourcePaths.map(async path => ({ path: `experiments/async-resource-probe/${path}`, sha256: createHash('sha256').update(await readFile(new URL(path, import.meta.url))).digest('hex') })));
const passed = results.filter(r => r.status === 'passed').length;
const report = {
  schemaVersion: 1, experiment: legacy ? 'async-resource-probe-legacy-red' : 'async-resource-probe',
  checkedAtUtc: new Date().toISOString(), environment: { node: process.version, platform: process.platform, architecture: process.arch, realGpu: false },
  counts: { total: results.length, passed, failed: results.length - passed }, results, sourceHashes,
  limitations: ['Finite manually ordered callback model, not production Egret.', 'No actual CPU decoding, GPU uploads, browser/native device testing, performance, allocation size, worker scheduling, or full thread-safety proof.', 'Fence completion is injected; this does not validate a real driver fence.', 'Legacy adapter only exposes actual previous-model policies for seven targeted counterexamples; it is not an alternate implementation.'],
};
const filename = legacy ? 'async-resource-probe-legacy-red-results.json' : 'async-resource-probe-results.json';
await writeFile(new URL(`../../evidence/${filename}`, import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ report: fileURLToPath(new URL(`../../evidence/${filename}`, import.meta.url)), counts: report.counts }));
process.exitCode = report.counts.failed ? 1 : 0;
