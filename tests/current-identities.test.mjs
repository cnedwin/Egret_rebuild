// SPDX-License-Identifier: Apache-2.0
// UNIT: the identity table and the evidence freshness report, on a small owned directory.
// They describe files; they never refuse a change.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PRODUCT_PATH, currentIdentities, evidenceFreshness } from '../tools/current-identities.mjs';

const pin = (relative, text) => ({ path: relative, bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') });
function fixture(body) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'egret-identities-')));
  const put = (relative, text) => { fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true }); fs.writeFileSync(path.join(root, relative), text); };
  try { return body(root, put); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('CID01 the table lists every source and emitted file of every package, by path', () => fixture((root, put) => {
  put('packages/runtime/src/b.ts', 'export const b = 2;\n'); put('packages/runtime/src/a.ts', 'export const a = 1;\n');
  put('packages/runtime/dist/a.js', 'export const a = 1;\n'); put('packages/engine/rendering/deep/c.ts', 'export {};\n');
  put('packages/engine/web/d.ts', 'export {};\n'); put('packages/engine/package.json', '{}\n'); put('packages/engine/node_modules/x/src/y.js', '');
  const table = currentIdentities(root);
  assert.equal(table.kind, 'egret.current-identities/1');
  assert.deepEqual(table.files, [pin('packages/engine/rendering/deep/c.ts', 'export {};\n'), pin('packages/engine/web/d.ts', 'export {};\n'),
    pin('packages/runtime/dist/a.js', 'export const a = 1;\n'), pin('packages/runtime/src/a.ts', 'export const a = 1;\n'), pin('packages/runtime/src/b.ts', 'export const b = 2;\n')]);
  // Package configuration is not a product path: its bytes still gate a change elsewhere.
  for (const row of table.files) assert.ok(PRODUCT_PATH.test(row.path));
  assert.equal(PRODUCT_PATH.test('packages/engine/package.json'), false);
  assert.equal(PRODUCT_PATH.test('tools/check-types.mjs'), false);
}));

test('CID02 the report names evidence recorded under another identity and evidence of a file that is gone', () => fixture((root, put) => {
  put('packages/runtime/src/a.ts', 'export const a = 1;\n'); put('packages/runtime/dist/a.js', 'export const a = 1;\n');
  put('knowledge-base/evidence/fresh.json', JSON.stringify({ inputs: [pin('packages/runtime/src/a.ts', 'export const a = 1;\n')] }));
  put('examples/demo/summary.json', JSON.stringify({ groups: [{ files: [pin('packages/runtime/dist/a.js', 'export const a = 0;\n'), pin('packages/runtime/src/a.ts', 'export const a = 1;\n')] }],
    other: { nested: pin('packages/runtime/src/removed.ts', 'gone') } }));
  put('verification/unrelated.json', JSON.stringify({ files: [pin('tools/thing.mjs', 'x')] }));
  put('verification/broken.json', '{');
  assert.deepEqual(evidenceFreshness(root), [
    { evidence: 'examples/demo/summary.json', recorded: 3, changed: ['packages/runtime/dist/a.js'], missing: ['packages/runtime/src/removed.ts'] },
    { evidence: 'knowledge-base/evidence/fresh.json', recorded: 1, changed: [], missing: [] },
  ]);
}));

test('CID03 the command reports and exits normally however much evidence is stale', () => {
  const tool = fileURLToPath(new URL('../tools/current-identities.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [tool, '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(Array.isArray(report) && report.length > 0);
  for (const row of report) assert.deepEqual(Object.keys(row), ['evidence', 'recorded', 'changed', 'missing']);
  assert.notEqual(spawnSync(process.execPath, [tool, '--refuse'], { encoding: 'utf8' }).status, 0);
});
