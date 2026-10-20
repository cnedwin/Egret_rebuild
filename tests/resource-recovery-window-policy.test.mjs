// SPDX-License-Identifier: Apache-2.0
// Tool-policy controls only. Execute selected fixture logic, never SDK or native methods.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { readFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fingerprintFile, physicalPathKey } from '../tools/lib/file-identity.mjs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../tools/shared-rendering/resource-recovery-window.mjs', import.meta.url), 'utf8');
function section(start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first && source.indexOf(start, first + start.length) < 0);
  return source.slice(first, last);
}
const cancellation = section('  async function cancelledUploadRetirement(', '  const visibility=');
const originalUntil = section('  async function until(', '  const closeHost=');
const raceBranch = section("    if(closeMode==='restore-close'){", '      closeRequestedAt=');
const requireValue = (value, code) => { if (!value) throw Error(code); };
const check = (code, value) => requireValue(value, code);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function cancellationFixture(backend, { retirement, status = {}, session = {} } = {}) {
  const controller = new AbortController(), reason = Error('owned cancellation'); controller.abort(reason);
  const cause = Object.assign(Error('owned upload refusal'), { code: backend === 'gl' ? 'WEBGL2_UPLOAD_ABORTED' : 'WEBGPU_UPLOAD_ABORTED', cause: reason });
  const state = { idleCalls: 0, retired: false };
  let rejectIdle;
  const pending = new Promise((_resolve, reject) => { rejectIdle = reject; });
  const host = { whenIdle() { state.idleCalls++; return pending; }, getSessionStatus() { assert.equal(state.retired, true); return { state: 'ready', generationFailure: null, ...session }; }, getStatus() { return { state: 'active', pendingFrames: 0, pendingUploadBytes: 0, pendingReadbackBytes: 0, ...status }; } };
  const run = runInNewContext('(' + cancellation.trim() + ')', { def: { backend }, check, host, wait: async (_label, promise) => await promise });
  return { cause, controller, state, run: () => run('actual-retirement', cause, controller), release: () => { state.retired = true; rejectIdle(retirement ?? cause); } };
}
async function healthyCancellation(backend) {
  const f = cancellationFixture(backend); let finished = false;
  const pending = f.run().then(() => { finished = true; });
  await Promise.resolve(); assert.equal(finished, false); assert.equal(f.state.idleCalls, 1);
  f.release(); await pending; assert.equal(finished, true);
}
for (const backend of ['gl', 'gpu']) {
  test(backend + ' cancellation waits for original retirement and accepts only its own cancellation', async () => { await healthyCancellation(backend); });
  test(backend + ' cancellation preserves unrelated retirement errors and unhealthy owner refusal', async () => {
    const foreign = Error('independent native retirement failure');
    for (const options of [{ retirement: foreign }, { status: { pendingUploadBytes: 1 } }, { session: { state: 'lost' } }]) {
      await healthyCancellation(backend); const f = cancellationFixture(backend, options), failures = [];
      try { const rejected = assert.rejects(f.run(), error => options.retirement ? error === foreign : error.message === 'C_CANCELLED_UPLOAD_RETIRED'); f.release(); await rejected; } catch (error) { failures.push(error); }
      try { await healthyCancellation(backend); } catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, 'Cancellation refusal and restoration');
    }
  });
}
function selectedRace(acquisitions, remainingMs = 1000, lossAgeMs = 0) {
  const now = performance.now();
  return runInNewContext('(' + 'async function selectedRace() { ' + originalUntil + raceBranch + '\n} }' + ')', {
    def: { backend: 'gpu' }, closeMode: 'restore-close', generation: 1,
    acquisitions, lostAt: now - lossAgeMs, deadline: now + remainingMs, requireValue, sleep, performance,
  })();
}
async function healthyRace() { await selectedRace({ snapshot: () => ({ requests: [{ id: 2, returned: true, settled: false }] }) }); }
test('GPU close race waits until an actual request has returned, before claiming its pending interval', async () => {
  const requests = []; let observed = false;
  queueMicrotask(() => { requests.push({ id: 2, returned: true, settled: false }); });
  await selectedRace({ snapshot: () => { observed ||= requests.length === 1; return { requests }; } });
  assert.equal(observed, true);
});
test('GPU close race refuses settled, absent and out-of-deadline requests', async () => {
  for (const fixture of [
    { requests: [{ id: 2, returned: true, settled: true }], remaining: 1000, message: 'C_NATIVE_ACQUISITION_RACE_NOT_OBSERVED' },
    { requests: [], remaining: -1, message: 'C_WAIT:native-requestDevice-pending' },
    { requests: [{ id: 2, returned: true, settled: false }], remaining: -1, message: 'C_WAIT:native-requestDevice-pending' },
    { requests: [{ id: 2, returned: true, settled: false }], remaining: 1000, lossAge: 5001, message: 'C_WAIT:native-requestDevice-pending' },
  ]) {
    await healthyRace(); const failures = [];
    try { await assert.rejects(selectedRace({ snapshot: () => ({ requests: fixture.requests }) }, fixture.remaining, fixture.lossAge), error => error.message === fixture.message); } catch (error) { failures.push(error); }
    try { await healthyRace(); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, 'Acquisition refusal and restored baseline');
  }
});

// Exercise the collector's actual option and file-identity logic without a browser.
function collectorConfiguration() {
  const collector = readFileSync(new URL('../tools/shared-rendering/resource-recovery-collector.mjs', import.meta.url), 'utf8');
  const first = collector.indexOf('function options('), last = collector.indexOf('function validateCatalog(', first);
  assert.ok(first >= 0 && last > first);
  return runInNewContext('(()=>{' + collector.slice(first, last) + ";return {options, selectBrowser:typeof selectBrowser==='function'?selectBrowser:undefined};})()", { assert, path, fs, fingerprintFile, physicalPathKey });
}
const collectorPaths = { playwright: path.resolve('playwright-fixture'), output: path.resolve('fresh-collector-output'), executable: path.resolve('browser-fixture.exe') };
const collectorArgs = browser => ['--playwright', collectorPaths.playwright, ...browser, '--output', collectorPaths.output];
test('C collector accepts either the original Edge channel or one absolute executable', () => {
  const { options } = collectorConfiguration();
  assert.equal(options(collectorArgs(['--channel', 'msedge']))['--channel'], 'msedge');
  const selected = options(collectorArgs(['--executable', collectorPaths.executable]));
  assert.equal(selected['--executable'], collectorPaths.executable);
  assert.equal(Object.hasOwn(selected, '--channel'), false);
});
test('C collector rejects unknown, duplicate, mixed and relative browser CLI selections', () => {
  const { options } = collectorConfiguration();
  for (const args of [
    collectorArgs(['--channel', 'chrome']),
    collectorArgs(['--executable', 'browser.exe']),
    collectorArgs(['--executable', './browser.exe']),
    ...(path.sep === String.fromCharCode(92) ? ['C:browser.exe', String.fromCharCode(92) + 'browser.exe', '/browser.exe'].map(file => collectorArgs(['--executable', file])) : []),
    collectorArgs(['--browser', collectorPaths.executable]),
    collectorArgs(['--channel', 'msedge', '--executable', collectorPaths.executable]),
    ['--executable', collectorPaths.executable, '--executable', collectorPaths.executable, '--output', collectorPaths.output],
    ['--playwright', collectorPaths.playwright, '--output', collectorPaths.output],
    [...collectorArgs(['--executable', collectorPaths.executable]), '--flags', '--no-sandbox'],
    ['--playwright', 'relative-playwright', '--channel', 'msedge', '--output', collectorPaths.output],
    ['--playwright', collectorPaths.playwright, '--channel', 'msedge', '--output', 'relative-output'],
  ]) assert.throws(() => options(args));
});
test('C collector pins real executable bytes and refuses later replacement or removal', () => {
  const { options, selectBrowser } = collectorConfiguration();
  assert.equal(typeof selectBrowser, 'function');
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'egret-recovery-browser-'));
  const file = path.join(directory, 'browser.exe'), original = Buffer.from([0, 13, 10, 255, 65]);
  try {
    fs.writeFileSync(file, original);
    const selected = selectBrowser(options(collectorArgs(['--executable', file])));
    const canonical = fs.realpathSync(file);
    assert.equal(selected.launch.executablePath, canonical);
    assert.deepEqual(Object.keys(selected.launch), ['executablePath']);
    assert.deepEqual(JSON.parse(JSON.stringify(selected.record.executable)), {
      path: canonical, bytes: original.length, sha256: createHash('sha256').update(original).digest('hex'),
    });
    selected.verifyStable();
    fs.writeFileSync(file, Buffer.from([0, 10, 13, 255, 65]));
    assert.throws(() => selected.verifyStable());
    fs.writeFileSync(file, original); selected.verifyStable();
    fs.unlinkSync(file); assert.throws(() => selected.verifyStable());
    fs.writeFileSync(file, original); selected.verifyStable();
    const channel = selectBrowser(options(collectorArgs(['--channel', 'msedge'])));
    assert.deepEqual(JSON.parse(JSON.stringify(channel.launch)), { channel: 'msedge' });
    assert.deepEqual(JSON.parse(JSON.stringify(channel.record)), { channel: 'msedge' });
    channel.verifyStable();
  } finally {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(directory);
  }
});
