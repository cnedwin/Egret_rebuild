// SPDX-License-Identifier: Apache-2.0
// The named profile API RED follows a genuine emitted A/SP1 positive control.
import test from 'node:test';
import assert from 'node:assert/strict';
import {f2Baseline, requireFactory} from './fixtures.mjs';

test('F2B00 retained source baseline before the named profile API assertion', async () => {
  const namespace = await import('../dist/index.js');
  f2Baseline(requireFactory(namespace));
  console.log('F2B_RETAINED_A_BASELINE_COMPLETE');
  assert.equal(typeof namespace.createF2MeshProfilePlan, 'function', 'F2_MESH_PROFILE_PLAN_REQUIRED');
  assert.deepEqual(Object.keys(namespace).sort(), ['createF2MeshProfilePlan', 'createF2MeshSourcePlan']);
});
