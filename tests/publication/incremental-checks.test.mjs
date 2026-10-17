// SPDX-License-Identifier: Apache-2.0
// Real Git changes prove conservative selection across all contributor states.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {createHash} from 'node:crypto';
import * as selector from '../../tools/check-incremental.mjs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {selectChecks} from '../../tools/check-incremental.mjs';
import {isolatedGitEnvironment} from '../../tools/contribution-metadata.mjs';
function fixture(){
 const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'egret incremental ')));
 const git=(...args)=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8',env:{...isolatedGitEnvironment(),GIT_CONFIG_GLOBAL:path.join(root,'.git','isolated-global.conf'),GIT_CONFIG_NOSYSTEM:'1'}});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 const put=(f,s)=>{fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),s);};
 put('knowledge-base/en/docs/guide.md','# Guide\n');put('README.md','# Intro\n');put('tools/example.mjs','export {};\n');
 git('init','-q');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','baseline');
 return {root,git,put,base:git('rev-parse','HEAD'),close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('existing reading edits alone select documentation feedback; no change still selects full',()=>{
 const f=fixture();try{
  assert.equal(selectChecks(f.root,{base:f.base}).profile,'full');
  f.put('knowledge-base/en/docs/guide.md','# Updated\n');
  assert.equal(selectChecks(f.root,{base:f.base}).profile,'documentation');
  f.git('add','.');assert.equal(selectChecks(f.root,{base:f.base}).profile,'documentation');
  f.git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','docs');
  assert.equal(selectChecks(f.root,{base:f.base}).profile,'documentation');
  f.put('tools/example.mjs','throw Error("behavior changed");\n');
  assert.equal(selectChecks(f.root,{base:f.base}).profile,'full');
 }finally{f.close();}
});
test('untracked inputs, metadata, policy, deletion and rename never reduce checks',()=>{
 const f=fixture();try{
  f.put('README.md','# Updated\n');
  for(const file of ['unknown.txt','knowledge-base/en/docs/new.md','source-origin.json','AGENTS.md','package.json','.github/workflows/check.yml']){
   f.put(file,'changed\n');assert.equal(selectChecks(f.root,{base:f.base}).profile,'full',file);fs.unlinkSync(path.join(f.root,file));
  }
  f.git('mv','knowledge-base/en/docs/guide.md','knowledge-base/en/docs/renamed.md');
  assert.equal(selectChecks(f.root,{base:f.base}).profile,'full');
 }finally{f.close();}
});
test('unrelated or malformed base cannot authorize reduced checks',()=>{
 const f=fixture();try{
  assert.throws(()=>selectChecks(f.root,{base:'--all'}));
  assert.throws(()=>selectChecks(f.root,{base:'missing'}));
  f.git('switch','--orphan','foreign');f.put('foreign','x');f.git('add','.');f.git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','foreign');
  assert.throws(()=>selectChecks(f.root,{base:f.base}),/ancestor/);
 }finally{f.close();}
});

test('opposing index/worktree and commit/index edits cannot cancel a risky change',()=>{
 const f=fixture();try{
  f.put('tools/example.mjs','throw Error("staged behavior");\n');f.git('add','tools/example.mjs');
  f.put('tools/example.mjs','export {};\n');f.put('README.md','# Reading edit\n');
  assert.equal(selectChecks(f.root,{base:f.base}).profile,'full');
  f.git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','staged change');
  f.git('add','tools/example.mjs');
  assert.equal(selectChecks(f.root,{base:f.base}).profile,'full');
 }finally{f.close();}
});


function dependencyFixture(){
 const f=fixture();
 const pin=file=>{const raw=fs.readFileSync(path.join(f.root,file));return {path:file,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};};
 const graph={contracts:[],runtime:['contracts'],engine:['contracts','runtime'],project:['contracts']};
 const packages={};
 for(const [name,deps]of Object.entries(graph)){
  const manifest='packages/'+name+'/package.json';
  f.put(manifest,JSON.stringify({name:'@egret/'+name,dependencies:Object.fromEntries(deps.map(d=>['@egret/'+d,'workspace:*']))}));
  f.put('packages/'+name+'/src/value.ts','export const value = 1;\n'.replace('\\n','\n'));
  packages[name]={manifest:pin(manifest),dependencies:deps};
 }
 const tests=[];
 for(const [name,deps]of [['engine',['engine']],['runtime',['runtime']],['project',['project']],['shared',null]]){
  const file='tests/'+name+'.test.mjs';f.put(file,'export {};\n');tests.push({file:pin(file),packages:deps,support:[]});
 }
 tests.sort((a,b)=>a.file.path.localeCompare(b.file.path));
 const policy=['tools/prepush.mjs','tools/test.mjs','tools/verify.mjs'].map(file=>{f.put(file,'export {};\n');return pin(file);});
 const catalog={schemaVersion:1,packages,tests,policy};
 f.put('tools/incremental-test-catalog.json',JSON.stringify(catalog));
 f.git('add','.');f.git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','catalog');
 return {...f,base:f.git('rev-parse','HEAD'),catalog,pin};
}

test('package changes propagate to reverse dependents and retain shared tests',()=>{
 const f=dependencyFixture();try{
  for(const [name,affected,wanted]of [
   ['engine',['engine'],['engine','shared']],
   ['runtime',['engine','runtime'],['engine','runtime','shared']],
   ['project',['project'],['project','shared']],
  ]){
   const file='packages/'+name+'/src/value.ts',original=fs.readFileSync(path.join(f.root,file));
   f.put(file,'export const value = 2;\n');const p=selectChecks(f.root,{base:f.base});
   assert.equal(p.profile,'dependency');assert.deepEqual(p.affectedPackages,affected);
   assert.deepEqual(p.selectedTests,wanted.map(x=>'tests/'+x+'.test.mjs'));
   assert.ok(p.omittedTests.length>0);fs.writeFileSync(path.join(f.root,file),original);
  }
  f.put('packages/contracts/src/value.ts','export const value = 2;\n');
  assert.equal(selectChecks(f.root,{base:f.base}).profile,'full','shared contracts affect every package');
 }finally{f.close();}
});

test('dependency feedback refuses stale ownership, test bytes and incomplete membership',()=>{
 const f=dependencyFixture();try{
  f.put('packages/project/src/value.ts','export const value = 2;\n');
  f.git('update-index','--assume-unchanged','tests/engine.test.mjs');
  f.put('tests/engine.test.mjs','throw Error("changed omitted test");\n');
  assert.equal(selectChecks(f.root,{base:f.base}).profile,'full');
  f.put('tests/engine.test.mjs','export {};\n');f.git('update-index','--no-assume-unchanged','tests/engine.test.mjs');
  f.put('tests/new.test.mjs','export {};\n');assert.equal(selectChecks(f.root,{base:f.base}).profile,'full');fs.unlinkSync(path.join(f.root,'tests/new.test.mjs'));
  f.git('update-index','--assume-unchanged','packages/engine/package.json');
  f.put('packages/engine/package.json',JSON.stringify({name:'@egret/engine',dependencies:{'@egret/project':'workspace:*'}}));
  assert.equal(selectChecks(f.root,{base:f.base}).profile,'full');
 }finally{f.close();}
});

test('source selection includes all Git layers and rejects configuration and new source',()=>{
 const f=dependencyFixture();try{
  f.put('packages/engine/src/value.ts','export const value = 2;\n');f.git('add','packages/engine/src/value.ts');
  f.put('packages/engine/src/value.ts','export const value = 3;\n');
  f.put('packages/project/src/value.ts','export const value = 2;\n');
  let p=selectChecks(f.root,{base:f.base});assert.equal(p.profile,'dependency');assert.deepEqual(p.affectedPackages,['engine','project']);
  assert.ok(p.changes.some(x=>x.layer==='staged'));assert.ok(p.changes.some(x=>x.layer==='working'));
  f.put('packages/project/src/new.ts','export {};\n');assert.equal(selectChecks(f.root,{base:f.base}).profile,'full');fs.unlinkSync(path.join(f.root,'packages/project/src/new.ts'));
  f.put('tsconfig.json','{}\n');assert.equal(selectChecks(f.root,{base:f.base}).profile,'full');
 }finally{f.close();}
});

test('dependency commands retain complete compilation, strict and source boundaries',()=>{
 assert.equal(typeof selector.feedbackCommands,'function');
 const commands=selector.feedbackCommands({profile:'dependency',selectedTests:['tests/project.test.mjs']});
 const flat=commands.map(x=>x.join(' ')).join('\n');
 for(const script of ['build','check-boundaries','spritesheet-boundary','sequence-playback-boundary','browser-png-boundary','bitmap-resource-slot-boundary','bitmap-binding-ticket-boundary','resource-scene-boundary','atlas-frame/boundary','atlas-import-boundary','check-types','browser-png-types','verify-spine-f2-source'])assert.ok(flat.includes('tools/'+script+'.mjs'),script);
 assert.ok(flat.includes('--test tests/project.test.mjs'));assert.ok(!flat.includes('tools/test.mjs'));
 assert.deepEqual(selector.feedbackCommands({profile:'full'}),[['tools/prepush.mjs']]);
});


test('hidden worktree and sparse-index flags cannot omit another changed package',()=>{
 const f=dependencyFixture();try{
  f.put('packages/engine/src/value.ts','export const value = 2;\n');
  for(const [set,unset]of [['--assume-unchanged','--no-assume-unchanged'],['--skip-worktree','--no-skip-worktree']]){
   f.git('update-index',set,'packages/project/src/value.ts');
   f.put('packages/project/src/value.ts','export const value = 3;\n');
   assert.equal(selectChecks(f.root,{base:f.base}).profile,'full');
   f.git('update-index',unset,'packages/project/src/value.ts');
  }
 }finally{f.close();}
});

test('feedback identity binds raw worktree bytes and opposing index content',()=>{
 const f=dependencyFixture();try{
  const a=selector.feedbackIdentity(f.root);
  f.put('packages/engine/src/value.ts','export const value = 2;\n');
  const b=selector.feedbackIdentity(f.root);assert.notEqual(a,b);
  f.git('add','packages/engine/src/value.ts');
  const c=selector.feedbackIdentity(f.root);assert.notEqual(b,c);
  f.put('packages/engine/src/value.ts','export const value = 1;\n'.replace('\\n','\n'));
  assert.notEqual(a,selector.feedbackIdentity(f.root));
 }finally{f.close();}
});


test('accepted runner schedule changes invalidate the earlier dependency catalog',()=>{
 const f=dependencyFixture();try{
  f.put('tools/verify.mjs','throw Error("new mandatory lane");\n');f.git('add','tools/verify.mjs');
  f.git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','new gate');
  const base=f.git('rev-parse','HEAD');f.put('packages/project/src/value.ts','export const value = 2;\n');
  assert.equal(selectChecks(f.root,{base}).profile,'full');
 }finally{f.close();}
});

test('unbound example-import test closures remain shared in the current catalog',()=>{
 const catalog=JSON.parse(fs.readFileSync(new URL('../../tools/incremental-test-catalog.json',import.meta.url)));
 for(const name of ['prepared-outfit-coordinator-heldout','resource-scene-gpu','resource-scene-session','resource-scene-session-heldout']){
  const row=catalog.tests.find(x=>x.file.path==='tests/'+name+'.test.mjs');assert.equal(row.packages,null,name);
 }
});


test('execution binding refuses a package change after initial selection',()=>{
 const f=dependencyFixture();try{
  f.put('packages/project/src/value.ts','export const value = 2;\n');const plan=selectChecks(f.root,{base:f.base});
  assert.equal(typeof selector.bindFeedback,'function');assert.equal(typeof selector.bindFeedback(f.root,plan),'string');
  f.put('packages/engine/src/value.ts','export const value = 3;\n');
  assert.throws(()=>selector.bindFeedback(f.root,plan),/selection changed/i);
 }finally{f.close();}
});

test('dependency feedback preserves every publication regression in the full gate',()=>{
 const source=fs.readFileSync(new URL('../../tools/prepush.mjs',import.meta.url),'utf8');
 const expected=[...source.matchAll(/'((?:tests\/publication\/)[^']+\.test\.mjs)'/g)].map(x=>x[1]);
 const commands=selector.feedbackCommands({profile:'dependency',selectedTests:['tests/project.test.mjs']});
 assert.ok(expected.length>1);
 for(const name of expected)assert.ok(commands.some(args=>args[0]==='--test'&&args.includes(name)),name);
});

test('behavior feedback precedes frozen admission without bypassing any gate',()=>{
 const commands=selector.feedbackCommands({profile:'dependency',selectedTests:['tests/project.test.mjs']});
 const position=name=>commands.findIndex(args=>args.includes(name));
 assert.ok(position('tools/build.mjs')<position('tools/check-boundaries.mjs'));
 assert.ok(position('tools/check-boundaries.mjs')<position('tests/project.test.mjs'));
 assert.ok(position('tests/project.test.mjs')<position('tools/spritesheet-boundary.mjs'));
 assert.ok(position('tools/spritesheet-boundary.mjs')<position('tools/check-types.mjs'));
});


// Maintenance proposals are review inputs, never gate acceptance or writable baselines.
const maintenance=()=>import('../../tools/prepare-check-maintenance.mjs');
function maintenanceFixture(){
 const f=dependencyFixture();
 for(const file of ['tools/prepare-check-maintenance.mjs','tools/lib/file-identity.mjs'])f.put(file,fs.readFileSync(new URL('../../'+file,import.meta.url)));
 return f;
}
function baselineFixture(){
 const f=maintenanceFixture();
 for(const name of ['contracts','runtime','engine','project'])for(const area of ['src','dist',...(name==='engine'?['web','rendering']:[])])fs.mkdirSync(path.join(f.root,'packages',name,area),{recursive:true});
 const pin=f.pin('packages/project/src/value.ts');
 f.put('tools/spritesheet-boundary.mjs','const graphPins = '+JSON.stringify([pin])+';\nconst configurationPins = [];\nconst ss1AtlasGraphSuccessor = [];\n');
 f.put('tools/browser-png-boundary.mjs','const acceptedSnapshot = '+JSON.stringify({graph:[pin],stablePins:[]})+';\nconst atlasGraphSuccessor = [];\n');
 f.put('tools/sequence-playback-boundary.mjs','const seqpbPackages = [];\nconst seqpbStableEntries = '+JSON.stringify([pin])+';\nconst seqpbConfigurations = [];\n');
 const extra=f.pin('packages/engine/src/value.ts');
 for(const [stem,kind]of [['bitmap-resource-slot','BITMAP_RESOURCE_SLOT_FINITE_INTERFACE_POLICY'],['bitmap-binding-ticket','BITMAP_BINDING_TICKET_FINITE_INTERFACE_POLICY']]){
  const policy={schemaVersion:1,kind,packages:[],configurations:[],stableEntries:[extra],oldRootPins:[extra],oldEngineDeclarationPin:extra,workspacePins:[],...(stem==='bitmap-binding-ticket'?{selectedProductPins:[extra]}:{})};
  f.put('tools/'+stem+'-policy.json',JSON.stringify(policy));f.put('tools/'+stem+'-boundary.mjs','const policyPin = '+JSON.stringify(f.pin('tools/'+stem+'-policy.json'))+';\n');
 }
 f.put('tests/types/atlas-import-diagnostic-expectations.json',JSON.stringify({kind:'ATLAS_IMPORT_ACTUAL_STRICT_DIAGNOSTICS',status:'OBSERVED_FROZEN_TS7_DIAGNOSTICS',sourcePolicy:{modules:[extra],configurationPins:[]}}));
 f.put('tools/atlas-import-boundary.mjs','const inventoryPin = '+JSON.stringify(f.pin('tests/types/atlas-import-diagnostic-expectations.json'))+';\n');
 for(const owner of ['tools/spritesheet-boundary.mjs','tools/browser-png-boundary.mjs'])f.put(owner,fs.readFileSync(path.join(f.root,owner),'utf8')+'const imageResidencySuccessors = '+JSON.stringify([{path:extra.path,base:{bytes:0,sha256:'0'.repeat(64)},current:{bytes:extra.bytes,sha256:extra.sha256}}])+';\n');
 return f;
}
test('baseline proposals retain distinct declaration references and never edit source',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const original=fs.readFileSync(path.join(f.root,'tools/spritesheet-boundary.mjs'));
  f.put('packages/project/src/value.ts','export const value = 2;\n');
  const p=m.prepareBaselineReview(f.root);assert.equal(p.status,'review-required');
  const rows=p.declarations.flatMap(x=>x.rows).filter(x=>x.expected.path==='packages/project/src/value.ts');
  assert.equal(rows.length,3);assert.ok(rows.every(x=>x.identity==='different'&&x.current.sha256!==x.expected.sha256));
  assert.deepEqual(fs.readFileSync(path.join(f.root,'tools/spritesheet-boundary.mjs')),original);
  assert.equal(m.verifyMaintenanceProposal(f.root,p),true);
 }finally{f.close();}
});
test('baseline proposal recheck rejects new ignored output and changed owner bytes',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const p=m.prepareBaselineReview(f.root);f.put('packages/project/dist/new.js','export {};\n');
  assert.throws(()=>m.verifyMaintenanceProposal(f.root,p),/changed/i);fs.unlinkSync(path.join(f.root,'packages/project/dist/new.js'));
  f.put('tools/spritesheet-boundary.mjs',fs.readFileSync(path.join(f.root,'tools/spritesheet-boundary.mjs'),'utf8')+'// changed owner\n');
  assert.throws(()=>m.verifyMaintenanceProposal(f.root,p),/changed/i);
 }finally{f.close();}
});
test('baseline parser refuses duplicate or executable declarations without evaluating them',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const file='tools/spritesheet-boundary.mjs',original=fs.readFileSync(path.join(f.root,file),'utf8');
  f.put(file,original+'const graphPins = [];\n');assert.throws(()=>m.prepareBaselineReview(f.root),/declaration/i);
  f.put(file,original.replace(/const graphPins = .*;/,'const graphPins = (()=>{throw Error("EXECUTED");})();'));
  assert.throws(()=>m.prepareBaselineReview(f.root),e=>!/EXECUTED$/.test(e.message)&&/JSON|declaration/i.test(e.message));
 }finally{f.close();}
});
test('baseline missing paths are distinct from wrong spelling and malformed pins',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  fs.unlinkSync(path.join(f.root,'packages/project/src/value.ts'));
  assert.ok(m.prepareBaselineReview(f.root).declarations.flatMap(x=>x.rows).some(x=>x.identity==='missing'));
  f.put('packages/project/src/Value.ts','export {};\n');assert.throws(()=>m.prepareBaselineReview(f.root),/spelling/i);
  fs.unlinkSync(path.join(f.root,'packages/project/src/Value.ts'));
  f.put('tools/spritesheet-boundary.mjs','const graphPins = [{"path":"../foreign","bytes":0,"sha256":"'+ '0'.repeat(64)+'"}];\nconst configurationPins = [];\nconst ss1AtlasGraphSuccessor = [];\n');
  assert.throws(()=>m.prepareBaselineReview(f.root),/path|identity/i);
 }finally{f.close();}
});
test('unchanged catalog proposal preserves reviewed ownership and cannot approve itself',async()=>{
 const m=await maintenance(),f=maintenanceFixture();try{
  const p=m.prepareCatalogReview(f.root);assert.equal(p.status,'review-required');assert.deepEqual(p.catalog,f.catalog);
  assert.equal(m.verifyMaintenanceProposal(f.root,p),true);p.status='accepted';assert.throws(()=>m.verifyMaintenanceProposal(f.root,p),/changed|proposal/i);
 }finally{f.close();}
});
test('changed and new tests become shared while unrelated ownership survives',async()=>{
 const m=await maintenance(),f=maintenanceFixture();try{
  f.put('tests/engine.test.mjs','// changed\n');f.put('tests/new.test.mjs','// new\n');
  const p=m.prepareCatalogReview(f.root);assert.equal(p.catalog.tests.find(x=>x.file.path==='tests/engine.test.mjs').packages,null);
  assert.equal(p.catalog.tests.find(x=>x.file.path==='tests/new.test.mjs').packages,null);
  assert.deepEqual(p.catalog.tests.find(x=>x.file.path==='tests/project.test.mjs').packages,['project']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.root,'tools/incremental-test-catalog.json'))),f.catalog);
  fs.unlinkSync(path.join(f.root,'tests/shared.test.mjs'));assert.throws(()=>m.verifyMaintenanceProposal(f.root,p),/changed/i);
 }finally{f.close();}
});
test('support drift or absence demotes its owner and stays visible in proposal inputs',async()=>{
 const m=await maintenance(),f=maintenanceFixture();try{
  const helper='tests/helpers.mjs';f.put(helper,'export {};\n');f.catalog.tests.find(x=>x.file.path==='tests/engine.test.mjs').support=[f.pin(helper)];
  f.put('tools/incremental-test-catalog.json',JSON.stringify(f.catalog));f.put(helper,'// changed\n');
  let p=m.prepareCatalogReview(f.root);assert.equal(p.catalog.tests.find(x=>x.file.path==='tests/engine.test.mjs').packages,null);
  fs.unlinkSync(path.join(f.root,helper));p=m.prepareCatalogReview(f.root);assert.ok(p.unavailable.includes(helper));
  assert.equal(p.catalog.tests.find(x=>x.file.path==='tests/engine.test.mjs').packages,null);
  f.put(helper,'// returned\n');assert.throws(()=>m.verifyMaintenanceProposal(f.root,p),/changed/i);
 }finally{f.close();}
});
test('manifest and full-runner changes conservatively clear all package ownership',async()=>{
 const m=await maintenance(),f=maintenanceFixture();try{
  f.put('tools/verify.mjs','// changed schedule\n');let p=m.prepareCatalogReview(f.root);assert.ok(p.catalog.tests.every(x=>x.packages===null));
  f.put('tools/verify.mjs','export {};\n');const file='packages/project/package.json';f.put(file,fs.readFileSync(path.join(f.root,file),'utf8')+'\n');
  p=m.prepareCatalogReview(f.root);assert.ok(p.catalog.tests.every(x=>x.packages===null));
 }finally{f.close();}
});

test('maintenance proposals bind the generator and raw identity helper',async()=>{
 const m=await maintenance(),f=maintenanceFixture();try{
  const p=m.prepareCatalogReview(f.root);f.put('tools/lib/file-identity.mjs','// changed helper\n');
  assert.throws(()=>m.verifyMaintenanceProposal(f.root,p),/changed/i);
 }finally{f.close();}
});


test('baseline reader refuses comment and template decoys and accepts indented real JSON',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const file='tools/spritesheet-boundary.mjs',original=fs.readFileSync(path.join(f.root,file),'utf8');
  f.put(file,original.replace('const graphPins','  const graphPins'));assert.equal(m.prepareBaselineReview(f.root).declarations[0].rows.length,1);
  for(const decoy of ['/*\nconst graphPins = [];\n*/\n','const decoy = '+String.fromCharCode(96)+'\nconst graphPins = [];\n'+String.fromCharCode(96)+';\n']){
   f.put(file,decoy+original.replace(/const graphPins = .*;/,'  const graphPins = dangerous();'));
   assert.throws(()=>m.prepareBaselineReview(f.root),/declaration/i);
   f.put(file,decoy+original.replace(/const graphPins = .*;\n/,''));
   assert.throws(()=>m.prepareBaselineReview(f.root),/declaration/i);
  }
  f.put(file,'const literal = '+JSON.stringify('escaped " and /* comment */ // { }')+';\n'+original);assert.equal(m.prepareBaselineReview(f.root).declarations[0].rows.length,1);
  for(const prefix of ['}\n','(]\n','/* unfinished\n',"'unfinished\\\n",'const ratio = 2 / 1;\n','const regex = /x/;\n']){
   f.put(file,prefix+original);assert.throws(()=>m.prepareBaselineReview(f.root),/declaration/i);
  }
  f.put(file,'function nested(){\n'+original+'}\n');assert.throws(()=>m.prepareBaselineReview(f.root),/declaration/i);
 }finally{f.close();}
});

test('raw pin field order does not imply baseline drift or catalog demotion',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const reorder=pin=>({sha256:pin.sha256,bytes:pin.bytes,path:pin.path});
  const file='tools/spritesheet-boundary.mjs',original=fs.readFileSync(path.join(f.root,file),'utf8');
  f.put(file,original.replace(/const graphPins = .*;/,'const graphPins = '+JSON.stringify([reorder(f.pin('packages/project/src/value.ts'))])+';'));
  assert.equal(m.prepareBaselineReview(f.root).declarations[0].rows[0].identity,'same');
  for(const item of Object.values(f.catalog.packages))item.manifest=reorder(item.manifest);
  f.catalog.policy=f.catalog.policy.map(reorder);for(const row of f.catalog.tests){row.file=reorder(row.file);row.support=row.support.map(reorder);}
  f.put('tools/incremental-test-catalog.json',JSON.stringify(f.catalog));
  assert.deepEqual(m.prepareCatalogReview(f.root).catalog.tests.map(x=>x.packages),f.catalog.tests.map(x=>x.packages));
 }finally{f.close();}
});

test('complete graph proposals expose unlisted code separately from named successor rows',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const file='packages/project/dist/new.js';f.put(file,'export {};\n');
  const p=m.prepareBaselineReview(f.root);assert.equal(p.graphCoverage.length,3);
  for(const group of p.graphCoverage){assert.ok(group.unlisted.some(pin=>pin.path===file));assert.ok(group.baseBinding);}
  assert.equal(p.declarations.filter(x=>x.binding.includes('Successor')).length,2);
 }finally{f.close();}
});


test('additional JSON baselines retain boundary links, selectors and transformed history',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const p=m.prepareBaselineReview(f.root);assert.equal(p.policyLinks.length,3);
  assert.ok(p.policyLinks.every(x=>x.row.identity==='same'));
  const rows=p.declarations.filter(x=>x.owner==='tools/bitmap-binding-ticket-policy.json');assert.equal(rows.length,7);
  assert.equal(rows.find(x=>x.binding==='oldEngineDeclarationPin').comparison,'transformed-baseline-raw-observation');
  assert.equal(p.declarations.find(x=>x.binding==='sourcePolicy.modules').rows.length,1);
  assert.equal(m.verifyMaintenanceProposal(f.root,p),true);
 }finally{f.close();}
});

test('policy replacement is exposed as a link difference and invalidates old proposals',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const p=m.prepareBaselineReview(f.root),file='tools/bitmap-resource-slot-policy.json';
  f.put(file,fs.readFileSync(path.join(f.root,file),'utf8')+'\n');
  assert.throws(()=>m.verifyMaintenanceProposal(f.root,p),/changed/);
  assert.equal(m.prepareBaselineReview(f.root).policyLinks.find(x=>x.owner==='tools/bitmap-resource-slot-boundary.mjs').row.identity,'different');
  f.put('tools/bitmap-resource-slot-boundary.mjs','const policyPin = '+JSON.stringify(f.pin('tools/bitmap-binding-ticket-policy.json'))+';\n');
  assert.throws(()=>m.prepareBaselineReview(f.root),/policy.*path/i);
 }finally{f.close();}
});

test('policy schemas, duplicate JSON keys, duplicate paths and foreign owners fail closed',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const file='tools/bitmap-resource-slot-policy.json',raw=fs.readFileSync(path.join(f.root,file),'utf8'),v=JSON.parse(raw);
  for(const changed of [raw.replace('"schemaVersion":1','"schemaVersion":2'),raw.replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1'),JSON.stringify({...v,stableEntries:[...v.stableEntries,...v.stableEntries]}),JSON.stringify({...v,stableEntries:[{...v.stableEntries[0],path:'node_modules/external/index.js'}]})]){
   f.put(file,changed);assert.throws(()=>m.prepareBaselineReview(f.root),/schema|Duplicate|owner/i);
  }
 }finally{f.close();}
});

test('Host pair observations distinguish base, current, neither and missing without admission',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const target='packages/engine/src/value.ts',original=fs.readFileSync(path.join(f.root,target));
  let p=m.prepareBaselineReview(f.root);assert.equal(p.successorPairs.length,2);assert.ok(p.successorPairs.every(x=>x.rows[0].identity==='current'));
  f.put(target,'');p=m.prepareBaselineReview(f.root);assert.ok(p.successorPairs.every(x=>x.rows[0].identity==='neither'));
  for(const owner of ['tools/spritesheet-boundary.mjs','tools/browser-png-boundary.mjs'])f.put(owner,fs.readFileSync(path.join(f.root,owner),'utf8').replace('"base":{"bytes":0,"sha256":"'+'0'.repeat(64)+'"}', '"base":{"bytes":0,"sha256":"'+f.pin(target).sha256+'"}'));
  p=m.prepareBaselineReview(f.root);assert.ok(p.successorPairs.every(x=>x.rows[0].identity==='base'));
  fs.unlinkSync(path.join(f.root,target));p=m.prepareBaselineReview(f.root);assert.ok(p.successorPairs.every(x=>x.rows[0].identity==='missing'));f.put(target,original);
 }finally{f.close();}
});

test('raw reference index preserves every duplicate-owner declaration and pair branch',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const p=m.prepareBaselineReview(f.root),row=p.references.find(x=>x.path==='packages/engine/src/value.ts');
  assert.ok(row.references.some(x=>x.owner==='tools/bitmap-resource-slot-policy.json'&&x.binding==='oldEngineDeclarationPin'));
  assert.ok(row.references.some(x=>x.owner==='tools/bitmap-binding-ticket-policy.json'&&x.binding==='selectedProductPins'));
  assert.equal(row.references.filter(x=>x.branch==='base').length,2);assert.equal(row.references.filter(x=>x.branch==='current').length,2);
  assert.equal(row.references.find(x=>x.binding==='oldEngineDeclarationPin').comparison,'transformed-baseline-raw-observation');
 }finally{f.close();}
});

test('excluded dependency payloads stay bound but are not read as repository pins',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const file='tests/types/atlas-import-diagnostic-expectations.json',v=JSON.parse(fs.readFileSync(path.join(f.root,file)));
  v.inputPins=[{path:'node_modules/not-installed/compiler',bytes:0,sha256:'0'.repeat(64)}];v.sourcePolicy.jsoncPins=v.inputPins;f.put(file,JSON.stringify(v));
  const p=m.prepareBaselineReview(f.root);assert.ok(!p.inputs.some(x=>x.path.includes('node_modules')));
  v.inputPins[0].bytes=1;f.put(file,JSON.stringify(v));assert.throws(()=>m.verifyMaintenanceProposal(f.root,p),/changed/);
 }finally{f.close();}
});


test('Host pairs refuse hidden path overrides, malformed arms and duplicate paths',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const file='tools/spritesheet-boundary.mjs',raw=fs.readFileSync(path.join(f.root,file),'utf8'),pin=f.pin('packages/engine/src/value.ts'),arm={bytes:pin.bytes,sha256:pin.sha256},pair={path:pin.path,base:arm,current:arm};
  const install=pairs=>f.put(file,raw.replace(/const imageResidencySuccessors = .*;/,'const imageResidencySuccessors = '+JSON.stringify(pairs)+';'));
  for(const pairs of [[{...pair,base:{...arm,path:pin.path}}],[{...pair,current:{bytes:-1,sha256:pin.sha256}}],[pair,pair],[{...pair,path:'work/private.ts'}]]){
   install(pairs);assert.throws(()=>m.prepareBaselineReview(f.root),/arm|identity|Duplicate|owner/i);
  }
  install([pair]);assert.equal(m.prepareBaselineReview(f.root).successorPairs[0].rows[0].identity,'both');
 }finally{f.close();}
});

test('JSON selectors fail closed and decode duplicate keys without losing literal content',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const file='tools/bitmap-binding-ticket-policy.json',raw=fs.readFileSync(path.join(f.root,file),'utf8'),v=JSON.parse(raw);
  delete v.selectedProductPins;f.put(file,JSON.stringify(v));assert.throws(()=>m.prepareBaselineReview(f.root),/selector/i);
  f.put(file,raw.replace('"schemaVersion":1','"schemaVersion":1,"schema\\u0056ersion":1'));assert.ok(fs.readFileSync(path.join(f.root,file),'utf8').includes('schema\\u0056ersion'));assert.throws(()=>m.prepareBaselineReview(f.root),/Duplicate/i);
  const valid=JSON.parse(raw);valid.uninterpreted={literal:'escaped " \\ and { [ ] }',numeric:1.5e-12,nested:[null,true,false,{unicode:'汉字'}]};
  f.put(file,JSON.stringify(valid));assert.equal(m.prepareBaselineReview(f.root).policyLinks.length,3);
 }finally{f.close();}
});
