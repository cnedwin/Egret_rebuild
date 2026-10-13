// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, realpathSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// A hook cannot unload a module cache. Every baseline, fault and restoration
// therefore uses a different process and the same unchanged on-disk SDK.
const root = fileURLToPath(new URL('../', import.meta.url));
const child = fileURLToPath(new URL('./spritesheet-fault-child.mjs', import.meta.url));
const sourceRoots = ['packages/contracts/src', 'packages/runtime/src',
  'packages/engine/src', 'packages/engine/web', 'packages/engine/rendering', 'packages/project/src'];
const emissionRoots = ['packages/contracts/dist', 'packages/runtime/dist',
  'packages/engine/dist', 'packages/project/dist'];
const configurationPaths = ['node_modules/typescript/bin/tsc', 'node_modules/typescript/package.json',
  'package.json', 'packages/contracts/package.json', 'packages/contracts/schema/project-format.schema.json',
  'packages/contracts/tsconfig.json', 'packages/engine/package.json', 'packages/engine/tsconfig.json',
  'packages/engine/tsconfig.rendering.json', 'packages/engine/tsconfig.web.json',
  'packages/project/package.json', 'packages/project/tsconfig.json', 'packages/runtime/package.json',
  'packages/runtime/tsconfig.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tools/build.mjs',
  'tools/generate-project-format.mjs', 'tsconfig.base.json', 'tsconfig.json'];
const cases = ['before-entry', 'after-entry', 'ctor-undefined', 'crop-undefined',
  'crop-dispose', 'reentry', 'sheet-terminal', 'throw-terminal', 'engine-terminal', 'closing-cleanup'];

function pin(relative) {
  const bytes = readFileSync(path.join(root, relative));
  return { path: relative, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
function walk(relative, accept, results) {
  const absolute = path.join(root, relative);
  assert.equal(lstatSync(absolute).isSymbolicLink(), false, 'SDK graph directories must be clone owned');
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const selected = `${relative}/${entry.name}`;
    assert.equal(entry.isSymbolicLink(), false, 'no unobserved SDK source/emission alias');
    if (entry.isDirectory()) walk(selected, accept, results);
    else if (entry.isFile() && accept(entry.name)) results.push(pin(selected));
    else assert.equal(entry.isFile(), true, 'SDK graph contains only ordinary files/directories');
  }
}
function sdkSnapshot() {
  const results = [];
  for (const directory of sourceRoots) walk(directory, name => name.endsWith('.ts'), results);
  for (const directory of emissionRoots) walk(directory, name => name.endsWith('.js') || name.endsWith('.d.ts'), results);
  for (const relative of configurationPaths) results.push(pin(relative));
  // Include the unit permissions and source, rather than silently trusting a child.
  for (const relative of ['AGENTS.md', 'AGENTS.zh-CN.md',
    'tests/spritesheet-fault.test.mjs', 'tests/spritesheet-fault-child.mjs']) results.push(pin(relative));
  results.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  assert.equal(new Set(results.map(value => value.path)).size, results.length);
  return results;
}
function aliases() {
  return ['contracts', 'runtime', 'engine', 'project'].map(name => {
    const logical = path.join(root, 'node_modules/@egret', name);
    const expected = path.join(realpathSync(root), 'packages', name);
    assert.equal(realpathSync(expected), expected, 'package directory must itself be clone owned');
    const physical = realpathSync(logical);
    assert.equal(physical, expected, 'first-party package alias must belong to this clone');
    return { name, physical };
  });
}
const initialAliases = aliases();
const initialSdk = sdkSnapshot();
for (const [relative, bytes, sha256] of [
  ['packages/runtime/dist/Bitmap.js', 7905, '0ef6158d9d3dd21fe4f623c8e24a265dc62bf57e5a57a848f774c0312e9a52f3'],
  ['packages/runtime/dist/spriteSheet.js', 10813, '654ccff10a7896ee9d008041f099855f7f42663b544017daec2e9b9010a4ba71'],
]) assert.deepEqual(pin(relative), { path: relative, bytes, sha256 }, 'original qualified compiled module');

function unchanged() {
  assert.deepEqual(aliases(), initialAliases, 'workspace aliases unchanged');
  assert.deepEqual(sdkSnapshot(), initialSdk, 'source/emission/config/permission/unit bytes unchanged');
}
function run(stage, caseId) {
  unchanged();
  let result;
  try {
    result = spawnSync(process.execPath, [child, stage, caseId], {
      cwd: root, encoding: 'utf8', shell: false, timeout: 30000, maxBuffer: 16 * 1024 * 1024,
    });
    assert.equal(result.error, undefined, 'no child launch/timeout/output-limit failure');
    assert.equal(result.signal, null, 'child must finish without a signal');
    assert.equal(result.status, 0, `SS1_UNIT_CHILD_FAILED ${stage}/${caseId}\n${result.stdout}\n${result.stderr}`);
    assert.equal(result.stderr, '', 'no hidden child setup/cleanup diagnostics');
    const lines = result.stdout.trimEnd().split(/\r?\n/);
    assert.equal(lines.length, 1, 'one complete child result and no unclassified stdout');
    assert.ok(lines[0].startsWith('SS1_CONTROL_CHILD_RESULT '));
    const value = JSON.parse(lines[0].slice('SS1_CONTROL_CHILD_RESULT '.length));
    assert.equal(value.stage, stage); assert.equal(value.caseId, caseId);
    assert.equal(value.status, 'SS1_CONTROL_CHILD_COMPLETE');
    assert.equal(value.diskUnchanged, true);
    assert.equal(value.transformedLoads, stage === 'mutant' ? 1 : 0);
    assert.deepEqual(value.cleanup, {
      hostStarts: 1, hostStops: 1, hostCloses: 1, providerLoads: 1, providerDisposals: 1,
      timers: 0, allCreatedBitmapsDisposed: true, allCreatedSheetsDisposed: true,
      diagnostics: stage === 'mutant' && ['crop-dispose', 'closing-cleanup'].includes(caseId) ? 1 : 0,
    });
    if (stage !== 'mutant') assert.deepEqual(value.assigned, { genuineNoHookBaseline: true });
    else if (['before-entry', 'after-entry', 'reentry'].includes(caseId)) {
      const expected = caseId === 'reentry' ? 2 : 1;
      assert.deepEqual(value.assigned, { success: true,
        counters: { construct: expected, crop: expected, dispose: 0, returned: expected, retired: 0 },
        patchedSetterCalls: 0, patchedDisposerCalls: 0 });
    } else {
      const expected = caseId === 'ctor-undefined' ? 0 : 1;
      assert.deepEqual(value.assigned, {
        code: caseId === 'sheet-terminal' ? 'SPRITE_SHEET_DISPOSED'
          : ['engine-terminal', 'closing-cleanup'].includes(caseId) ? 'ENGINE_CLOSED' : 'SPRITE_SHEET_BITMAP_FAILED',
        causeWasUndefined: true,
        cleanupErrors: ['crop-dispose', 'closing-cleanup'].includes(caseId) ? 1 : 0,
        counters: { construct: 1, crop: expected, dispose: expected, returned: expected, retired: expected },
      });
    }
    assert.equal(value.retry, stage === 'mutant' && ['ctor-undefined', 'crop-undefined', 'crop-dispose', 'reentry'].includes(caseId));
    return value;
  } finally {
    // Even a failed child cannot be allowed to hide an on-disk mutation.
    unchanged();
  }
}

for (const caseId of cases) test(`SS1 privileged original-operation unit: ${caseId}`, t => {
  const baseline = run('baseline', caseId);
  let mutant, restored, failed = false, primary;
  try { mutant = run('mutant', caseId); }
  catch (error) { failed = true; primary = error; }
  // Attempt the fresh restored baseline even when the assigned child failed.
  try { restored = run('restored', caseId); }
  catch (error) {
    if (failed) throw new AggregateError([primary, error], 'SS1_UNIT_AND_RESTORED_BASELINE_FAILED');
    throw error;
  }
  if (failed) throw primary;
  assert.notEqual(baseline.stage, restored.stage);
  t.diagnostic(`SS1_UNIT_CASE_COMPLETE ${JSON.stringify({ caseId,
    baseline: baseline.status, assigned: mutant.assigned, retry: mutant.retry,
    restored: restored.status, diskUnchanged: true, freshProcesses: 3 })}`);
});
