// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('sequence RESET strict public declarations, complete closures and four unsuppressed refusals',()=>{
 const result=spawnSync(process.execPath,['tools/sequence-reset-types.mjs'],{encoding:'utf8',windowsHide:true,timeout:30000});assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(result.stderr,'');assert.match(result.stdout,/Sequence RESET strict PASS/);
});
