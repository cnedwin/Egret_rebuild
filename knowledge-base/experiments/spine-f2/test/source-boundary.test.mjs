// SPDX-License-Identifier: Apache-2.0
// Each assigned control starts with a fresh complete real-source boundary baseline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readF2SourceInput, checkF2SourceBoundary } from '../../../../tools/spine-f2-source-boundary.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const baseline = () => {
  const input = readF2SourceInput(root);
  const result = checkF2SourceBoundary(input);
  assert.equal(result.status, 'F2_SOURCE_BOUNDARY_PASS');
  assert.equal(result.compilerVersion, '7.0.2');
  assert.deepEqual([result.publicValues, result.publicTypes, result.modules], [2, 10, 5]);
  return input;
};
const replaceOnce = (text, before, after) => {
  const index = text.indexOf(before);
  assert.notEqual(index, -1, 'CONTROL_SOURCE_ANCHOR_REQUIRED');
  assert.equal(text.indexOf(before, index + before.length), -1, 'CONTROL_SOURCE_ANCHOR_UNIQUE');
  const result = text.slice(0, index) + after + text.slice(index + before.length);
  assert.equal(result.slice(0, index) + before + result.slice(index + after.length), text);
  return result;
};
const refusal = (input, reason) => assert.throws(() => checkF2SourceBoundary(input), error => {
  assert.equal(error.constructor, Error);
  assert.equal(error.message, reason);
  return true;
});

test('F2S00 complete current source boundary baseline', () => { baseline(); });
test('F2S01 private SP1 import is refused at the import boundary', () => {
  const input = baseline();
  input.sources['source-plan.ts'] = replaceOnce(input.sources['source-plan.ts'],
    "import { createSpineImportPlan, SPINE_IMPORT_LIMITS } from '@egret/project/spine';",
    "import { createSpineImportPlan, SPINE_IMPORT_LIMITS } from '@egret/project/dist/spine/preflight.js';");
  refusal(input, 'F2_BOUNDARY_IMPORT');
});
test('F2S02 Core import is refused at the import boundary', () => {
  const input = baseline();
  input.sources['source-plan.ts'] = "import { Skeleton } from '@esotericsoftware/spine-core';\n" + input.sources['source-plan.ts'];
  refusal(input, 'F2_BOUNDARY_IMPORT');
});
test('F2S03 DOM library is refused before parsing source', () => {
  const input = baseline();
  input.config.compilerOptions.lib.push('DOM');
  refusal(input, 'F2_BOUNDARY_CONFIG');
});
test('F2S04 extra entry value is refused by the exact entry inventory', () => {
  const input = baseline();
  input.sources['index.ts'] += '\nexport const extraEntryValue = 1;\n';
  refusal(input, 'F2_BOUNDARY_ENTRY');
});
test('F2S05 Uint16 conversion is refused before entry admission', () => {
  const input = baseline();
  input.sources['source-plan.ts'] += '\nconst forbiddenIndexNarrowing = new Uint16Array([65536]);\n';
  refusal(input, 'F2_BOUNDARY_NARROWING');
});

test('F2S06 profile module Float32 storage is refused while scalar qualification remains allowed', () => {
  const input = baseline();
  input.sources['profile-source.ts'] += '\nconst forbiddenTimeStorage = new Float32Array([0, 1]);\n';
  refusal(input, 'F2_BOUNDARY_NARROWING');
});
test('F2S07 an unchanged entry name cannot move to the wrong source module', () => {
  const input = baseline();
  input.sources['index.ts'] = replaceOnce(input.sources['index.ts'],
    "export { createF2MeshProfilePlan } from './profile-plan.js';",
    "export { createF2MeshProfilePlan } from './source-plan.js';");
  refusal(input, 'F2_BOUNDARY_ENTRY');
});
