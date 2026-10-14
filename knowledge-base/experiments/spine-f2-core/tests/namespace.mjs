// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
export function namespace(entry){assert.deepEqual(Object.keys(entry).sort(),['createF2CoreResources']);assert.equal(typeof entry.createF2CoreResources,'function');}
