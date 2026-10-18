// SPDX-License-Identifier: Apache-2.0
// Finite unsuppressed consumers of the two explicit built WebGL2 entries.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprintFile,ownerRelativePath,samePhysicalPath} from './lib/file-identity.mjs';

const root=realpathSync(fileURLToPath(new URL('..',import.meta.url)));
const inventoryPath='tests/types/shared-webgl2-diagnostic-expectations.json';
const inventory=JSON.parse(readFileSync(path.join(root,inventoryPath),'utf8'));
assert.equal(inventory.schemaVersion,1);
assert.equal(inventory.kind,'SHARED_WEBGL2_ACTUAL_STRICT_DIAGNOSTICS');
assert.equal(inventory.status,'OBSERVED_TS7_DIAGNOSTICS');
assert.deepEqual(inventory.tupleFormat,['file','line','column','code']);
const expectedInputs=['tests/types/shared-webgl2-positive.ts','tests/types/shared-webgl2-negative.ts',
  'tests/types/tsconfig.shared-webgl2-positive.json','tests/types/tsconfig.shared-webgl2-negative.json',
  'tests/types/tsconfig.json','tsconfig.base.json'];
assert.deepEqual(inventory.inputPins.map(pin=>pin.path),expectedInputs);
assert.deepEqual(inventory.preservedSharedPins.map(pin=>pin.path),[
  'tools/shared-render-types.mjs','tests/types/shared-render-diagnostic-expectations.json',
  'tests/types/shared-render-positive.ts','tests/types/shared-render-negative.ts',
  'tests/types/tsconfig.shared-render-positive.json','tests/types/tsconfig.shared-render-negative.json',
  'tests/types/tsconfig.dom-free.json']);
const snapshot=[inventoryPath,'tools/shared-webgl2-types.mjs',...expectedInputs].map(file=>fingerprintFile(root,file));
function verify(){
  for(const pin of [...snapshot,...inventory.inputPins,...inventory.preservedSharedPins])
    assert.deepEqual(fingerprintFile(root,pin.path),pin,'strict input changed: '+pin.path);
  const retained=JSON.parse(readFileSync(path.join(root,'tests/types/shared-render-diagnostic-expectations.json'),'utf8'));
  assert.equal(retained.cases.length,24);assert.equal(retained.tuples.length,24);
  for(const name of ['contracts','runtime','engine'])assert.ok(samePhysicalPath(
    realpathSync(path.join(root,'node_modules/@egret',name)),realpathSync(path.join(root,'packages',name)),process.platform),'foreign SDK alias');
  assert.equal(JSON.parse(readFileSync(path.join(root,'node_modules/typescript/package.json'),'utf8')).version,inventory.compilerVersion);
}
function diagnostics(stdout){
  const tuples=[];
  for(const line of stdout.replaceAll('\r\n','\n').split('\n')){
    if(line==='')continue;
    const match=/^(.+)\((\d+),(\d+)\): error TS(\d+): (.+)$/.exec(line);
    if(match){
      const physical=path.isAbsolute(match[1])?match[1]:path.resolve(root,match[1]);
      tuples.push([ownerRelativePath(root,physical,process.platform),+match[2],+match[3],+match[4]]);
    }else assert.ok(/^ {2,}\S/.test(line)&&tuples.length>0,'unconsumed compiler output');
  }
  return tuples;
}
assert.equal(inventory.cases.length,26);
assert.equal(new Set(inventory.cases.map(row=>row.name)).size,26);
assert.equal(inventory.tuples.length,26);
for(const lane of ['positive','negative']){
  verify();
  const file='tests/types/shared-webgl2-'+lane+'.ts';
  const source=readFileSync(path.join(root,file),'utf8');
  assert.equal(/@ts-(?:expect-error|ignore|nocheck)\b/.test(source),false,'suppressed WebGL2 consumer');
  if(lane==='negative'){
    const cases=source.split('\n').flatMap((line,index)=>{
      const match=/^\s*\/\/ WEBGL2_TYPE_CASE (GL-N\d{2}):/.exec(line);
      return match?[{name:match[1],line:index+2}]:[];
    });
    assert.deepEqual(cases,inventory.cases);
    assert.deepEqual(inventory.tuples.map(tuple=>[tuple[0],tuple[1]]),cases.map(row=>[file,row.line]));
    assert.ok(inventory.tuples.every(tuple=>tuple[3]!==2307),'unresolved imports do not prove type safety');
  }
  const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project',
    'tests/types/tsconfig.shared-webgl2-'+lane+'.json','--pretty','false'],
    {cwd:root,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4*1024*1024});
  verify();
  assert.equal(result.error,undefined);assert.equal(result.signal,null);
  assert.equal(result.status,lane==='positive'?0:1);assert.equal(result.stderr,'');
  assert.deepEqual(diagnostics(result.stdout),lane==='positive'?[]:inventory.tuples);
  console.log('Shared WebGL2 strict '+lane+' PASS: '+(lane==='positive'?0:inventory.tuples.length)+' actual diagnostics.');
}
