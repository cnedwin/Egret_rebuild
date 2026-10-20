// SPDX-License-Identifier: Apache-2.0
// Finite public M1.5 consumers; actual compiler diagnostics, no SDK execution.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprintFile,ownerRelativePath,samePhysicalPath} from './lib/file-identity.mjs';

const root=realpathSync(fileURLToPath(new URL('..',import.meta.url)));
const inventoryPath='tests/types/resource-recovery-diagnostic-expectations.json';
const inventory=JSON.parse(readFileSync(path.join(root,inventoryPath),'utf8'));
const pairs=[
  ['resources-group',11,true],
  ['manifest-browser',17,false],
  ['candidate-shared-frame',14,true],
  ['manifest-resource-diagnostics',16,false],
  ['shared-frame-upload-gpu',20,false],
  ['shared-frame-upload-webgl2',26,false],
  ['shared-host-resource-diagnostics',13,false],
];
const expectedInputs=pairs.flatMap(([name])=>[
  name+'-positive.ts',name+'-negative.ts',
  'tsconfig.'+name+'-positive.json','tsconfig.'+name+'-negative.json',
].map(file=>'tests/types/'+file)).concat([
  'tests/types/tsconfig.dom-free.json','tests/types/tsconfig.web.json',
  'tests/types/tsconfig.json','tsconfig.base.json',
]);
assert.equal(inventory.schemaVersion,1);
assert.equal(inventory.kind,'RESOURCE_RECOVERY_ACTUAL_STRICT_DIAGNOSTICS');
assert.equal(inventory.status,'OBSERVED_TS7_DIAGNOSTICS');
assert.equal(inventory.compilerVersion,'7.0.2');
assert.deepEqual(inventory.tupleFormat,['file','line','column','code']);
assert.deepEqual(inventory.inputPins.map(pin=>pin.path),expectedInputs);
assert.deepEqual(inventory.pairs.map(row=>row.pair),pairs.map(row=>row[0]));
const snapshot=[inventoryPath,'tools/resource-recovery-types.mjs','tools/lib/file-identity.mjs',
  ...expectedInputs].map(file=>fingerprintFile(root,file));
const compilerRoot=realpathSync(path.join(root,'node_modules/typescript'));
const compilerSnapshot=['package.json','bin/tsc'].map(file=>fingerprintFile(compilerRoot,file));

function verify(){
  for(const pin of [...snapshot,...inventory.inputPins])
    assert.deepEqual(fingerprintFile(root,pin.path),pin,'M1.5 strict input changed: '+pin.path);
  assert.ok(samePhysicalPath(realpathSync(path.join(root,'node_modules/typescript')),compilerRoot),'changed compiler owner');
  for(const pin of compilerSnapshot)
    assert.deepEqual(fingerprintFile(compilerRoot,pin.path),pin,'changed compiler wrapper: '+pin.path);
  assert.equal(JSON.parse(readFileSync(path.join(compilerRoot,'package.json'),'utf8')).version,inventory.compilerVersion);
  for(const name of ['contracts','runtime','engine','project'])assert.ok(samePhysicalPath(
    realpathSync(path.join(root,'node_modules/@egret',name)),
    realpathSync(path.join(root,'packages',name)),process.platform),'foreign SDK alias: '+name);
}

// Existing core pairs already compile with ES2022 and no ambient type packages.
// The five browser/Host pairs keep their original explicit DOM configurations.
const base=JSON.parse(readFileSync(path.join(root,'tsconfig.base.json'),'utf8'));
assert.deepEqual(base.compilerOptions.lib,['ES2022']);
assert.deepEqual(base.compilerOptions.types,[]);
for(const key of ['strict','noUncheckedIndexedAccess','exactOptionalPropertyTypes','verbatimModuleSyntax'])
  assert.equal(base.compilerOptions[key],true,'required strict base option: '+key);

// Consume every line; unknown/unlocated output is a refusal. Continuation
// wording is retained in raw compiler evidence, not a cross-platform tuple ABI.
function diagnostics(stdout){
  const tuples=[];
  for(const line of stdout.replaceAll('\r\n','\n').split('\n')){
    if(line==='')continue;
    const match=/^(.+)\((\d+),(\d+)\): error TS(\d+): (.+)$/.exec(line);
    if(match){
      const physical=path.isAbsolute(match[1])?match[1]:path.resolve(root,match[1]);
      tuples.push([ownerRelativePath(root,physical,process.platform),+match[2],+match[3],+match[4]]);
    } else assert.ok(/^ {2,}\S/.test(line)&&tuples.length>0,'unconsumed compiler output');
  }
  return tuples;
}

// Qualify all seven input/case tables before launching the first compiler.
verify();
for(const [index,[name,count,domFree]] of pairs.entries()){
  const row=inventory.pairs[index],file='tests/types/'+name+'-negative.ts';
  assert.equal(row.domFree,domFree);
  assert.equal(row.cases.length,count);
  assert.equal(row.tuples.length,count,'M1.5 diagnostic tuple count mismatch: '+name);
  assert.equal(new Set(row.cases.map(item=>item.name)).size,count);
  assert.equal(new Set(row.tuples.map(tuple=>JSON.stringify(tuple))).size,count);
  const lines=readFileSync(path.join(root,file),'utf8').split('\n');
  for(const [caseIndex,item] of row.cases.entries()){
    assert.equal(item.name,name+'-N'+String(caseIndex+1).padStart(2,'0'));
    assert.ok(Number.isSafeInteger(item.line)&&item.line>0&&item.line<=lines.length);
    assert.equal(lines[item.line-1].trim(),item.statement,'changed negative statement');
    assert.ok(item.statement.length>0&&!item.statement.startsWith('//'));
    const tuple=row.tuples[caseIndex];
    assert.equal(tuple.length,4);
    assert.equal(tuple[0],file);
    assert.equal(tuple[1],item.line);
    assert.ok(Number.isSafeInteger(tuple[2])&&tuple[2]>0);
    assert.ok(Number.isSafeInteger(tuple[3])&&tuple[3]>0&&tuple[3]!==2307,
      'unresolved imports do not prove type safety');
  }
  for(const lane of ['positive','negative']){
    const source=readFileSync(path.join(root,'tests/types/'+name+'-'+lane+'.ts'),'utf8');
    assert.equal(/@ts-(?:expect-error|ignore|nocheck)\b/.test(source),false,'suppressed M1.5 consumer');
    const config=JSON.parse(readFileSync(path.join(root,'tests/types/tsconfig.'+name+'-'+lane+'.json'),'utf8'));
    assert.deepEqual(config.include,[name+'-'+lane+'.ts']);
    assert.equal(config.compilerOptions.skipLibCheck,false);
    if(domFree){
      if(name==='resources-group')assert.equal(config.extends,'./tsconfig.dom-free.json');
      else {assert.equal(config.extends,'../../tsconfig.base.json');assert.deepEqual(config.compilerOptions.lib,['ES2022']);}
    }
  }
}

for(const [index,[name]] of pairs.entries())for(const lane of ['positive','negative']){
  verify();
  const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project',
    'tests/types/tsconfig.'+name+'-'+lane+'.json','--pretty','false'],
    {cwd:root,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4*1024*1024});
  verify();
  assert.equal(result.error,undefined);
  assert.equal(result.signal,null);
  assert.equal(result.status,lane==='positive'?0:1);
  assert.equal(result.stderr,'');
  if(lane==='positive')assert.equal(result.stdout,'','positive compiler output must be empty');
  assert.deepEqual(diagnostics(result.stdout),lane==='positive'?[]:inventory.pairs[index].tuples,
    'M1.5 exact diagnostic tuples mismatch: '+name+' '+lane);
  console.log('Resource recovery strict '+name+' '+lane+' PASS: '+
    (lane==='positive'?0:inventory.pairs[index].tuples.length)+' actual diagnostics.');
}
console.log('Resource recovery types PASS: seven public consumer pairs, 117 exact unsuppressed refusals; runtime/native acceptance is separate.');
