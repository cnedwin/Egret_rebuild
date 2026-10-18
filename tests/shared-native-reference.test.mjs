// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('REFERENCE: fixed shared native targets agree with authored pages and draws', () => {
  // This checks authored numeric data, not product behavior or native acceptance.
  const execution=spawnSync(process.execPath,['tools/shared-rendering/check-native-cases.mjs'],{
    cwd:fileURLToPath(new URL('..',import.meta.url)),encoding:'utf8',windowsHide:true,timeout:30000,
  });
  assert.equal(execution.error,undefined);
  assert.equal(execution.status,0,execution.stderr);
  const result=JSON.parse(execution.stdout);
  assert.equal(result.status,'SOURCE_AND_REFERENCE_REVIEW_PASS');
  assert.deepEqual([result.cases,result.totalPoints,result.channels,result.bleed,result.negatives],[30,321,1236,104,11]);
});

for(const [id,change,diagnostic] of [
  ['missing-negative',data=>{data.negatives.pop();},'fixed negative schedule'],
  ['stale-reference-pin',data=>{data.reference.sha256='0'.repeat(64);},'reference raw identity'],
  ['wrong-literal-target',data=>{data.cases[0].points[0].expectedRGBA[0]=1;},'A00-endpoints/zero-hidden target'],
])test('REFERENCE refusal: '+id,()=>{
  // Disposable data-only copies; no product, installed module or source is patched.
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'egret-shared-reference-'));
  const names=['check-native-cases.mjs','oracle.mjs','native-cases.json'];
  try{
    for(const name of names)fs.copyFileSync(new URL('../tools/shared-rendering/'+name,import.meta.url),path.join(directory,name));
    const input=JSON.parse(fs.readFileSync(path.join(directory,'native-cases.json')));change(input);
    fs.writeFileSync(path.join(directory,'native-cases.json'),JSON.stringify(input));
    const result=spawnSync(process.execPath,[path.join(directory,'check-native-cases.mjs')],{
      encoding:'utf8',windowsHide:true,timeout:30000,
    });
    assert.equal(result.error,undefined);assert.equal(result.status,1);
    assert.ok(result.stderr.includes(diagnostic),result.stderr);
  }finally{
    for(const name of names){const file=path.join(directory,name);if(fs.existsSync(file))fs.unlinkSync(file);}
    fs.rmdirSync(directory);
  }
});
