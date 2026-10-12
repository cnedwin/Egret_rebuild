// SPDX-License-Identifier: Apache-2.0
// Missing files or public package setup errors are not the named API-missing RED.
import test from 'node:test';
import assert from 'node:assert/strict';
import { publicBaseline } from './fixtures.mjs';

test('F2A00 genuine SP1 baseline before the named experiment API assertion', async () => {
  publicBaseline();
  console.log('F2A_SP1_BASELINE_COMPLETE');
  // Root supplies a loadable dist/index.js containing only export {} for the first RED.
  const namespace = await import('../dist/index.js');
  assert.equal(typeof namespace.createF2MeshSourcePlan, 'function', 'F2_MESH_SOURCE_PLAN_REQUIRED');
});
