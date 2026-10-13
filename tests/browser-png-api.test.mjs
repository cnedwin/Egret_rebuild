// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const child = fileURLToPath(new URL('./browser-png-cold-child.mjs', import.meta.url));
const environment = { ...process.env };
for (const key of Object.keys(environment)) if (/^(NODE_OPTIONS|NODE_PATH|NODE_V8_COVERAGE|NODE_COMPILE_CACHE|NODE_TEST_CONTEXT|NODE_TEST_WORKER_ID)$/i.test(key)) delete environment[key];
function run(mode) {
  const result = spawnSync(process.execPath, [child, mode], { cwd: repository, env: environment,
    encoding: 'utf8', windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 });
  assert.ifError(result.error); assert.equal(result.signal, null); assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stderr, '');
  const lines = result.stdout.trim().split(/\r?\n/);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].startsWith('BIP_COLD_PASS '));
  const observed = JSON.parse(lines[0].slice(14));
  assert.equal(observed.mode, mode);
  if (mode.startsWith('trap-')) assert.equal(observed.browserGlobalReads, 0);
  else assert.equal(observed.browserGlobalReads, null, 'No-trap child does not measure global reads');
  return observed;
}
test('BIP01 built public baseline precedes fresh optional/root cold imports and survives after them', { timeout: 130_000 }, () => {
  const before = run('baseline');
  assert.equal(before.publicBaselineCompleted, true);
  assert.deepEqual(before.optionalKeys, ['createBrowserTextureProvider']);
  const image = run('trap-image'), root = run('trap-root');
  assert.deepEqual(image.optionalKeys, ['createBrowserTextureProvider']);
  assert.equal(root.rootExcludesBrowserPng, true);
  assert.equal(image.descriptorsRestored, true); assert.equal(root.descriptorsRestored, true);
  const after = run('baseline');
  assert.equal(after.publicBaselineCompleted, true);
  assert.deepEqual(after.optionalKeys, before.optionalKeys);
});
test('BIP01 default factory capability refusal is a separate call after genuine baseline', { timeout: 35_000 }, () => {
  const result = run('capability');
  assert.equal(result.publicBaselineCompleted, true);
  assert.equal(result.defaultCapabilityRefusal, 'WEB_PNG_UNAVAILABLE');
});
