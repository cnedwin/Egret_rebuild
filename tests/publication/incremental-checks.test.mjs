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
 f.put('tools/spritesheet-boundary.mjs','const graphPins = '+JSON.stringify([pin])+';\nconst configurationPins = [];\nconst ss1AtlasGraphSuccessor = [];\nconst m11WarmSubmissionGraphSuccessor = [];\n');
 f.put('tools/browser-png-boundary.mjs','const acceptedSnapshot = '+JSON.stringify({graph:[pin],stablePins:[]})+';\nconst atlasGraphSuccessor = [];\nconst m11WarmSubmissionGraphSuccessor = [];\n');
 f.put('tools/sequence-playback-boundary.mjs','const seqpbPackages = [];\nconst seqpbStableEntries = '+JSON.stringify([pin])+';\nconst seqpbConfigurations = [];\n');
 const extra=f.pin('packages/engine/src/value.ts');
 for(const [stem,kind]of [['bitmap-resource-slot','BITMAP_RESOURCE_SLOT_FINITE_INTERFACE_POLICY'],['bitmap-binding-ticket','BITMAP_BINDING_TICKET_FINITE_INTERFACE_POLICY']]){
  const policy={schemaVersion:1,kind,packages:[],configurations:[],stableEntries:[extra],oldRootPins:[extra],oldEngineDeclarationPin:extra,workspacePins:[],...(stem==='bitmap-binding-ticket'?{selectedProductPins:[extra]}:{})};
  f.put('tools/'+stem+'-policy.json',JSON.stringify(policy));f.put('tools/'+stem+'-boundary.mjs','const policyPin = '+JSON.stringify(f.pin('tools/'+stem+'-policy.json'))+';\n');
 }
 f.put('tests/types/atlas-import-diagnostic-expectations.json',JSON.stringify({kind:'ATLAS_IMPORT_ACTUAL_STRICT_DIAGNOSTICS',status:'OBSERVED_FROZEN_TS7_DIAGNOSTICS',sourcePolicy:{modules:[extra],configurationPins:[]}}));
 f.put('tools/atlas-import-boundary.mjs','const inventoryPin = '+JSON.stringify(f.pin('tests/types/atlas-import-diagnostic-expectations.json'))+';\nconst m11WarmSubmissionGraphSuccessor = [];\n');
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
  assert.equal(p.declarations.filter(x=>x.binding.includes('Successor')).length,5);
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


// Synthetic snapshot comparison units are separate from actual collector evidence.
const snapshotTool=()=>import('../../tools/prepare-snapshot-maintenance.mjs');
function snapshotFixture(){
 const pin={path:'same.js',bytes:1,sha256:'a'.repeat(64)};
 return {schemaVersion:1,sourceOnly:true,owners:Object.fromEntries(['repository','compiler','compiler-native','project-json','foundation'].map(x=>[x,path.resolve('synthetic',x)])),aliases:[],buildResolutions:[],importMap:{},inventory:[{owner:'repository',...pin},{owner:'foundation',...pin}],modules:[],routes:[]};
}
test('snapshot comparison retains owner identity and reports added removed and changed inputs',async()=>{
 const {compareSnapshots}=await snapshotTool(),before=snapshotFixture(),after=structuredClone(before);
 after.inventory[0].sha256='b'.repeat(64);after.inventory.splice(1,1);after.inventory.push({...before.inventory[1],path:'new.js'});
 const r=compareSnapshots('atlas-frame',before,after);
 assert.deepEqual(r.changes.map(x=>[x.owner,x.path,x.change]),[['foundation','new.js','added'],['foundation','same.js','removed'],['repository','same.js','changed']]);
 assert.equal(r.counts.changed,1);assert.equal(r.counts.removed,1);assert.equal(r.counts.added,1);
});
test('snapshot comparison has no implied changes without a baseline',async()=>{
 const {compareSnapshots}=await snapshotTool();const r=compareSnapshots('atlas-frame',null,snapshotFixture());
 assert.equal(r.comparison,'not-provided');assert.deepEqual(r.changes,[]);assert.equal(r.counts.observed,2);
});
test('snapshot owners and non-inventory structure remain independent review differences',async()=>{
 const {compareSnapshots}=await snapshotTool(),before=snapshotFixture(),after=structuredClone(before);
 after.owners.foundation=path.resolve('relocated');after.aliases.push({alias:'observed change'});after.routes.push({route:'/changed'});
 const r=compareSnapshots('atlas-frame',before,after);
 assert.equal(r.ownerChanges.length,1);assert.equal(r.ownerChanges[0].owner,'foundation');assert.deepEqual(r.structureChanges,['aliases','routes']);assert.deepEqual(r.changes,[]);
});
test('snapshot identity refuses duplicates foreign owners path aliases and unsupported schemas',async()=>{
 const {compareSnapshots}=await snapshotTool();assert.throws(()=>compareSnapshots(['atlas-frame'],null,snapshotFixture()));
 for(const mutate of [s=>s.inventory.push(s.inventory[0]),s=>s.inventory[0].sha256=['a'.repeat(64)],s=>s.inventory[0].owner='foreign',s=>s.inventory[0].path='../escape',s=>s.inventory[0].path='dir\\same.js',s=>s.sourceOnly=false,s=>s.owners.foreign=path.resolve('foreign'),s=>s.extra=true,s=>s.modules.push({owner:'foreign',path:'same.js'})]){
  const s=snapshotFixture();mutate(s);assert.throws(()=>compareSnapshots('atlas-frame',null,s));
 }
});
test('resource snapshot row roles remain visible even when raw bytes agree',async()=>{
 const {compareSnapshots}=await snapshotTool();
 const s={schemaVersion:1,kind:'RESOURCE_SCENE_SOURCE_SNAPSHOT_NO_BROWSER',sourceOnly:true,owners:Object.fromEntries(['sdk','application','foundation'].map(x=>[x,path.resolve('synthetic',x)])),helperBootstrap:{},collectorImplementation:{},foundationAdmission:{},authoredImportMap:{},servedOriginalHTML:{},inventory:[{owner:'sdk',path:'same.js',bytes:1,sha256:'a'.repeat(64),roles:['source']}],modules:[],closures:{},routes:[],limits:{},moduleBytes:1,routeBytes:1,acceptance:{}};
 const after=structuredClone(s);after.inventory[0].roles.push('module');after.acceptance.changed=true;
 const r=compareSnapshots('resource-scene',s,after);assert.equal(r.changes[0].change,'changed');assert.deepEqual(r.structureChanges,['acceptance']);
});
test('baseline proposal is comparison data and never follows nested artifact or owner paths',async()=>{
 const {readSnapshotBaseline}=await snapshotTool();const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'egret snapshot ')));
 try{
  const file=path.join(root,'baseline.json'),snapshot=snapshotFixture();
  fs.writeFileSync(file,JSON.stringify({kind:'snapshot-maintenance',schemaVersion:1,family:'atlas-frame',status:'untrusted-success',snapshot,baseline:{path:path.join(root,'does-not-exist.json')}}));
  const r=readSnapshotBaseline('atlas-frame',file);assert.deepEqual(r.snapshot,snapshot);assert.equal(r.pin.bytes,fs.statSync(file).size);
  fs.writeFileSync(file,'{"schemaVersion":1,"schema\\u0056ersion":1}');assert.throws(()=>readSnapshotBaseline('atlas-frame',file),/Duplicate/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('snapshot options allow only explicit families baseline and check modes',async()=>{
 const {parseSnapshotOptions}=await snapshotTool();
 assert.deepEqual(parseSnapshotOptions(['--family','atlas-frame']),{family:'atlas-frame'});
 assert.deepEqual(parseSnapshotOptions(['--check',path.resolve('proposal.json')]),{check:path.resolve('proposal.json')});
 for(const args of [[],['--family','foreign'],['--family','atlas-frame','--family','atlas-frame'],['--family','atlas-frame','--baseline','relative.json'],['--check',path.resolve('proposal.json'),'--family','atlas-frame'],['--family','atlas-frame','--collector',path.resolve('evil.mjs')]])assert.throws(()=>parseSnapshotOptions(args));
});

test('snapshot collection is CLI-only and refuses preloaded Node processes',async()=>{
 const tool=await snapshotTool();assert.equal(tool.prepareSnapshotReview,undefined);assert.equal(tool.runSnapshotMaintenance,undefined);
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'egret snapshot preload ')));
 try{
  const preload=path.join(root,'preload.mjs');fs.writeFileSync(preload,'export {};');
  const {pathToFileURL,fileURLToPath}=await import('node:url');
  const run=spawnSync(process.execPath,['--import',pathToFileURL(preload).href,fileURLToPath(new URL('../../tools/prepare-snapshot-maintenance.mjs',import.meta.url)),'--family','resource-scene'],{encoding:'utf8'});
  assert.notEqual(run.status,0);assert.match(run.stderr,/Fresh Node CLI/);assert.equal(run.stdout,'');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});


test('split application selection requires explicit absolute resource-family authority',async()=>{
 const {parseSnapshotOptions}=await snapshotTool(),app=path.resolve('separate app'),proposal=path.resolve('proposal.json');
 assert.deepEqual(parseSnapshotOptions(['--family','resource-scene','--application-root',app]),{family:'resource-scene','application-root':app});
 assert.deepEqual(parseSnapshotOptions(['--check',proposal,'--application-root',app]),{check:proposal,'application-root':app});
 for(const args of [['--family','atlas-frame','--application-root',app],['--family','resource-scene','--application-root','relative'],['--check',proposal,'--application-root','relative']])assert.throws(()=>parseSnapshotOptions(args));
});
const compilerTool=()=>import('../../tools/prepare-compiler-maintenance.mjs');
function compilerFixture(){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'egret compiler maintenance ')));
 const put=(file,body)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),body);};
 const pin=file=>{const raw=fs.readFileSync(path.join(root,file));return {path:file,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};};
 const names=['atlas-import','atlas-frame','bitmap-resource-slot','bitmap-binding-ticket','linear-layout','bitmap-button','display-anchor-offsets','display-container-add-child-at','display-container-child-index','display-container-remove-children','nine-slice-bitmap'];
 const nativeNames=names.slice(2,-1),specs=names.map(name=>[name,name.replaceAll('-','_').toUpperCase()]);
 const native='node_modules/@typescript/typescript-win32-x64/';
 for(const file of ['lib/lib.es5.d.ts','lib/tsc.exe'])put(native+file,'native fixture');
 put('node_modules/typescript/lib/lib.es5.d.ts','native fixture');
 const nativePin=file=>({...pin(native+file),path:file});
 for(const file of ['tools/prepare-compiler-maintenance.mjs','tools/prepare-check-maintenance.mjs','tools/lib/file-identity.mjs','packages/engine/dist/index.d.ts'])put(file,'// Synthetic nonexecuting fixture\n');
 for(const [name,version]of [['typescript','7.0.2'],['@typescript/typescript-win32-x64','7.0.2'],['jsonc-parser','3.3.1']]){
  put('node_modules/'+name+'/package.json',JSON.stringify({name,version,...(name.startsWith('@typescript/')?{exports:{'./package.json':'./package.json'}}:{})}));put('node_modules/'+name+'/index.js','throw Error("must never execute compiler or dependency");\n');
 }
 for(const [name,kind]of specs){
  put('tools/'+name+'-types.mjs','throw Error("must never execute strict gate");\n');
  const v={...(['atlas-import','atlas-frame'].includes(name)?{}:{schemaVersion:1}),kind:kind+'_ACTUAL_STRICT_DIAGNOSTICS',status:'OBSERVED_FROZEN_TS7_DIAGNOSTICS',inputPins:['tools/'+name+'-types.mjs','packages/engine/dist/index.d.ts','node_modules/typescript/index.js','node_modules/@typescript/typescript-win32-x64/index.js'].map(pin)};
  if(nativeNames.includes(name)){v.nativeLibraryPins=[nativePin('lib/lib.es5.d.ts')];v.originalCompilerObservation={platform:'win32',arch:'x64',version:'7.0.2',nativePackage:'@typescript/typescript-win32-x64',nativeMetadataPin:nativePin('package.json'),nativeBinaryPin:nativePin('lib/tsc.exe')};}
  if(name.startsWith('display-container-'))v.currentInputIdentitySuccessor={rows:[pin('packages/engine/dist/index.d.ts')]};
  if(name==='atlas-import')v.sourcePolicy={jsoncPins:[pin('node_modules/jsonc-parser/index.js')]};
  put('tests/types/'+name+'-diagnostic-expectations.json',JSON.stringify(v));
 }
 put('tools/check-types.mjs','throw Error("never run legacy gate");');
 put('node_modules/typescript/bin/tsc','throw Error("never execute compiler");');
 put('tests/types/sample.ts','export {};');put('tests/types/tsconfig.sample.json','{}');
 const fixture=pin('tests/types/sample.ts'),config=pin('tests/types/tsconfig.sample.json');
 for(const name of ['browser-png','spritesheet','sequence-playback','byte-writer','nine-slice','scene3d']){
  put('tools/'+name+'-types.mjs','throw Error("never run gate");');
  let v={schemaVersion:1};
  if(['browser-png','spritesheet','sequence-playback'].includes(name)){
   Object.assign(v,{kind:name.replaceAll('-','_').toUpperCase()+'_ACTUAL_STRICT_CONSUMER_DIAGNOSTICS',compiler:{pins:[pin('node_modules/typescript/index.js'),config]},configurationPins:[config]});
   if(name==='browser-png'){v.productPins=[pin('packages/engine/dist/index.d.ts')];v.lanes=[{sourcePin:fixture,configPin:config}];}
   else v.groups=[{fixture,config}];
   if(name==='sequence-playback'){v.status='SAVED_ACTUAL_DATA_FROZEN_REUSABLE_GATE_NOT_RUN';v.compiler.observedNative={platform:'win32',arch:'x64',package:'@typescript/typescript-win32-x64',pins:[nativePin('package.json'),nativePin('lib/tsc.exe')]};v.currentDeclarationSuccessor={sourcePins:[pin('packages/engine/dist/index.d.ts')],fixture,config};}
  }else if(name==='scene3d'){
   v.status='OBSERVED_FROZEN_TS7_DIAGNOSTICS';v.compiler={packageSHA256:pin('node_modules/typescript/package.json').sha256,tscSHA256:pin('node_modules/typescript/bin/tsc').sha256};v.fixtureSHA256={};
   for(const lane of ['positive','web-positive','negative','web-negative','import-negative','web-dom-free-negative']){const f='tests/types/scene3d-'+lane+'.ts';put(f,'export {};');v.fixtureSHA256[f]=pin(f).sha256;}
  }else{
   v.scope=(name==='byte-writer'?'BW1':'NS1')+' actual strict consumer diagnostic inventory';v.positive={fixture};v.groups={negative:{fixture},'import-negative':{fixture}};
   if(name==='nine-slice'){v.configurationPins=[config];v.compiler={platform:'win32',arch:'x64',wrapperPins:[pin('node_modules/typescript/index.js')],nativePlatform:{package:{...nativePin('package.json'),path:'@typescript/typescript-win32-x64/package.json'},executable:{...nativePin('lib/tsc.exe'),path:'@typescript/typescript-win32-x64/lib/tsc.exe'}}};}
  }
  put('tests/types/'+name+'-diagnostic-expectations.json',JSON.stringify(v));
 }
 return {root,put,pin,close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('compiler preparation retains registered declaration owners and shared raw references without execution',async()=>{
 const m=await compilerTool(),f=compilerFixture();try{
  const p=m.prepareCompilerReview(f.root);assert.equal(p.status,'review-required');assert.equal(p.acceptance,'none');assert.equal(p.coverage.registered.length,17);assert.deepEqual(p.coverage.unregistered,[]);
  const row=p.references.find(x=>x.owner==='compiler'&&x.path==='index.js');assert.equal(row.references.length,15);assert.equal(row.identity,'same');assert.equal(p.dependencies.length,3);
  assert.equal(m.verifyCompilerProposal(f.root,p).status,'current-inputs');
 }finally{f.close();}
});
test('compiler input edits additions missing files and owner metadata invalidate prior proposals',async()=>{
 const m=await compilerTool(),f=compilerFixture();try{
  const p=m.prepareCompilerReview(f.root);f.put('node_modules/typescript/new.js','new');assert.throws(()=>m.verifyCompilerProposal(f.root,p),/changed/);
  const fresh=m.prepareCompilerReview(f.root);assert.ok(fresh.dependencies.find(x=>x.owner==='compiler').inventory.some(x=>x.path==='new.js'));
  fs.unlinkSync(path.join(f.root,'node_modules/typescript/index.js'));const missing=m.prepareCompilerReview(f.root);assert.equal(missing.references.find(x=>x.owner==='compiler'&&x.path==='index.js').identity,'missing');
  f.put('node_modules/typescript/package.json',JSON.stringify({name:'foreign',version:'7.0.2'}));assert.throws(()=>m.prepareCompilerReview(f.root),/package name/);
 }finally{f.close();}
});
test('compiler registry refuses duplicate keys paths unsupported owners and coerced raw pins',async()=>{
 const m=await compilerTool(),f=compilerFixture();try{
  const file='tests/types/linear-layout-diagnostic-expectations.json',raw=fs.readFileSync(path.join(f.root,file),'utf8'),v=JSON.parse(raw);
  for(const value of [raw.replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1'),JSON.stringify({...v,inputPins:[v.inputPins[0],v.inputPins[0]]}),JSON.stringify({...v,inputPins:[{...v.inputPins[0],path:'node_modules/foreign/index.js'}]}),JSON.stringify({...v,inputPins:[{...v.inputPins[0],sha256:[v.inputPins[0].sha256]}]})]){f.put(file,value);assert.throws(()=>m.prepareCompilerReview(f.root));}
 }finally{f.close();}
});
test('compiler raw comparisons preserve independent historical expectations and reject tampering',async()=>{
 const m=await compilerTool(),f=compilerFixture();try{
  const file='tests/types/linear-layout-diagnostic-expectations.json',v=JSON.parse(fs.readFileSync(path.join(f.root,file)));v.inputPins.find(x=>x.path==='node_modules/typescript/index.js').sha256='0'.repeat(64);f.put(file,JSON.stringify(v));
  const p=m.prepareCompilerReview(f.root),r=p.references.find(x=>x.owner==='compiler'&&x.path==='index.js');assert.equal(r.identity,'different');assert.equal(r.references.filter(x=>x.matches).length,14);
  p.acceptance='PASS';assert.throws(()=>m.verifyCompilerProposal(f.root,p),/changed/);
 }finally{f.close();}
});


test('compiler observations bind uninterpreted provenance fields and gate source bytes',async()=>{
 const m=await compilerTool(),f=compilerFixture();try{
  const p=m.prepareCompilerReview(f.root),file='tests/types/linear-layout-diagnostic-expectations.json',v=JSON.parse(fs.readFileSync(path.join(f.root,file)));
  v.originalCompilerObservation.setupReceiptPin={path:'never-follow-this-historical-path'};f.put(file,JSON.stringify(v));assert.throws(()=>m.verifyCompilerProposal(f.root,p),/changed/);
  const fresh=m.prepareCompilerReview(f.root);assert.equal(fresh.status,'review-required');f.put('tools/linear-layout-types.mjs','throw Error("changed source is not executed");');assert.throws(()=>m.verifyCompilerProposal(f.root,fresh),/changed/);
 }finally{f.close();}
});
test('compiler inventory rejects internal links and mismatched wrapper-native resolution',async()=>{
 const m=await compilerTool(),f=compilerFixture();try{
  const nested=path.join(f.root,'node_modules/typescript/linked');fs.symlinkSync(path.join(f.root,'packages'),nested,process.platform==='win32'?'junction':'dir');
  assert.throws(()=>m.prepareCompilerReview(f.root),/Nonregular/);fs.unlinkSync(nested);
  const alternate='node_modules/typescript/node_modules/@typescript/typescript-win32-x64';f.put(alternate+'/package.json',JSON.stringify({name:'@typescript/typescript-win32-x64',version:'7.0.2'}));
  assert.throws(()=>m.prepareCompilerReview(f.root),/native owners differ|Nonregular/);
 }finally{f.close();}
});


test('compiler metadata reader refuses redirected or conditional native exports',async()=>{
 const m=await compilerTool(),f=compilerFixture();try{
  const file='node_modules/@typescript/typescript-win32-x64/package.json',v=JSON.parse(fs.readFileSync(path.join(f.root,file)));
  for(const exports of [{'./package.json':'./alternate.json'},{'./package.json':{default:'./package.json'}}]){f.put(file,JSON.stringify({...v,exports}));assert.throws(()=>m.prepareCompilerReview(f.root),/export mapping/);}
 }finally{f.close();}
});


test('native declarations retain explicit owners and historical expectations',async()=>{
 const m=await compilerTool(),f=compilerFixture();try{
  const p=m.prepareCompilerReview(f.root),row=p.references.find(x=>x.owner==='compiler-native'&&x.path==='lib/lib.es5.d.ts');assert.equal(row.references.length,8);assert.equal(row.identity,'same');
  f.put('node_modules/typescript/lib/lib.es5.d.ts','wrapper drift');const wrapper=m.prepareCompilerReview(f.root);assert.equal(wrapper.references.find(x=>x.owner==='compiler-native'&&x.path==='lib/lib.es5.d.ts').identity,'same');assert.throws(()=>m.verifyCompilerProposal(f.root,p),/changed/);
  f.put('node_modules/@typescript/typescript-win32-x64/lib/lib.es5.d.ts','native drift');const changed=m.prepareCompilerReview(f.root);assert.equal(changed.references.find(x=>x.owner==='compiler-native'&&x.path==='lib/lib.es5.d.ts').identity,'different');
  fs.unlinkSync(path.join(f.root,'node_modules/@typescript/typescript-win32-x64/lib/lib.es5.d.ts'));assert.equal(m.prepareCompilerReview(f.root).references.find(x=>x.owner==='compiler-native'&&x.path==='lib/lib.es5.d.ts').identity,'missing');
 }finally{f.close();}
});
test('native selectors fail closed on platform path duplicates and absent lists',async()=>{
 const m=await compilerTool(),f=compilerFixture();try{
  const file='tests/types/linear-layout-diagnostic-expectations.json',raw=fs.readFileSync(path.join(f.root,file));
  for(const mutate of [v=>delete v.nativeLibraryPins,v=>v.nativeLibraryPins.push(v.nativeLibraryPins[0]),v=>v.nativeLibraryPins[0].path='lib/lib.dom.d.ts',v=>v.nativeLibraryPins[0].path='../lib.es5.d.ts',v=>v.originalCompilerObservation.platform='linux',v=>v.originalCompilerObservation.nativePackage='foreign',v=>v.originalCompilerObservation.nativeBinaryPin.path='index.js']){f.put(file,raw);assert.equal(m.prepareCompilerReview(f.root).acceptance,'none');const v=JSON.parse(raw);mutate(v);f.put(file,JSON.stringify(v));assert.throws(()=>m.prepareCompilerReview(f.root));}
  f.put(file,raw);const ns='tests/types/nine-slice-diagnostic-expectations.json',v=JSON.parse(fs.readFileSync(path.join(f.root,ns)));v.compiler.nativePlatform.package.path='node_modules/@typescript/typescript-win32-x64/package.json';f.put(ns,JSON.stringify(v));assert.throws(()=>m.prepareCompilerReview(f.root));
 }finally{f.close();}
});
test('legacy digest expectations never invent bytes or follow provenance paths',async()=>{
 const m=await compilerTool(),f=compilerFixture();try{
  const file='tests/types/scene3d-diagnostic-expectations.json',v=JSON.parse(fs.readFileSync(path.join(f.root,file)));v.compiler.packageSHA256='0'.repeat(64);f.put(file,JSON.stringify(v));
  const legacy='tests/types/spritesheet-diagnostic-expectations.json',s=JSON.parse(fs.readFileSync(path.join(f.root,legacy)));s.observedProvenance={physicalOwnerObservations:[{path:'C:/private/never-follow',sha256:'untrusted'}]};f.put(legacy,JSON.stringify(s));
  const p=m.prepareCompilerReview(f.root),row=p.declarations.find(x=>x.selector==='compiler.packageSHA256').rows[0];assert.equal(row.comparison,'sha256-only');assert.equal(row.identity,'different');assert.equal(Object.hasOwn(row.expected,'bytes'),false);assert(!p.inputs.some(x=>x.path.includes('private')));
  v.fixtureSHA256['tests/types/foreign.ts']='0'.repeat(64);f.put(file,JSON.stringify(v));assert.throws(()=>m.prepareCompilerReview(f.root),/fixture/i);
 }finally{f.close();}
});
test('registered coverage records new inventory names without reading or trusting their content',async()=>{
 const m=await compilerTool(),f=compilerFixture();try{
  const p=m.prepareCompilerReview(f.root);f.put('tests/types/future-diagnostic-expectations.json','not parsed');assert.throws(()=>m.verifyCompilerProposal(f.root,p),/changed/);const next=m.prepareCompilerReview(f.root);assert.deepEqual(next.coverage.unregistered,['tests/types/future-diagnostic-expectations.json']);assert.equal(next.acceptance,'none');
  fs.unlinkSync(path.join(f.root,'tests/types/atlas-frame-diagnostic-expectations.json'));assert.throws(()=>m.prepareCompilerReview(f.root),/missing/i);
 }finally{f.close();}
});
test('registered successors stay separate from original raw expectations',async()=>{
 const m=await compilerTool(),f=compilerFixture();try{
  const file='tests/types/display-container-child-index-diagnostic-expectations.json',v=JSON.parse(fs.readFileSync(path.join(f.root,file)));v.inputPins.find(x=>x.path==='packages/engine/dist/index.d.ts').sha256='0'.repeat(64);f.put(file,JSON.stringify(v));
  const p=m.prepareCompilerReview(f.root),groups=p.declarations.filter(x=>x.owner===file);assert.equal(groups.find(x=>x.selector==='inputPins').rows.find(x=>x.path==='packages/engine/dist/index.d.ts').identity,'different');assert.equal(groups.find(x=>x.selector==='currentInputIdentitySuccessor.rows').rows[0].identity,'same');assert.equal(p.acceptance,'none');
 }finally{f.close();}
});


// Genuine source bytes authenticate extraction; synthetic dependencies are never executed.
function inlineCompilerFixture(){
 const f=compilerFixture();
 for(const name of ['check-types','bitmap-resource-slot-types','bitmap-binding-ticket-types','linear-layout-types','bitmap-button-types','display-anchor-offsets-types','display-container-add-child-at-types','display-container-child-index-types','display-container-remove-children-types','sequence-playback-types'])f.put('tools/'+name+'.mjs',fs.readFileSync(new URL('../../tools/'+name+'.mjs',import.meta.url)));
 for(const [family,lanes]of [['mouse-input',['positive','negative','import-negative','dom-free-negative']],['spine-import-plan',['positive','negative','import-negative']]])for(const lane of lanes){const file='tests/types/'+family+'-'+lane+'.ts';f.put(file,fs.readFileSync(new URL('../../'+file,import.meta.url)));}
 for(const name of ['display-container-add-child-at','display-container-child-index','display-container-remove-children','sequence-playback']){
  const file='tests/types/'+name+'-diagnostic-expectations.json',v=JSON.parse(fs.readFileSync(path.join(f.root,file))),original=JSON.parse(fs.readFileSync(new URL('../../'+file,import.meta.url)));
  if(name==='sequence-playback')v.currentDeclarationSuccessor.sourcePins=original.currentDeclarationSuccessor.sourcePins;
  else {v.currentInputIdentitySuccessor.rows=original.currentInputIdentitySuccessor.rows;v.inputPins.push(original.inputPins.find(x=>x.path==='packages/runtime/dist/DisplayObject.d.ts'));}
  f.put(file,JSON.stringify(v));
 }
 return f;
}
test('inline policy mode is explicit on preparation and freshness checking',async()=>{
 const m=await compilerTool(),f=inlineCompilerFixture();try{
  assert.deepEqual(m.parseCompilerOptions(['--inline-policies']),{inlinePolicies:true});
  assert.deepEqual(m.parseCompilerOptions(['--check',path.resolve('review.json'),'--inline-policies']),{inlinePolicies:true,check:path.resolve('review.json')});
  for(const args of [['--inline-policies','--inline-policies'],['--gate','evil.mjs'],['--check','relative.json']])assert.throws(()=>m.parseCompilerOptions(args));
  for(const options of [{inlinePolicies:'true'},{sourcePins:[]},{inlinePolicies:true,extra:true}])assert.throws(()=>m.prepareCompilerReview(f.root,options));
  const plain=m.prepareCompilerReview(f.root),p=m.prepareCompilerReview(f.root,{inlinePolicies:true});assert.equal(plain.inlinePolicies,null);assert.equal(p.acceptance,'none');assert.equal(p.schemaVersion,3);
  assert.equal(m.verifyCompilerProposal(f.root,p,{inlinePolicies:true}).status,'current-inputs');assert.throws(()=>m.verifyCompilerProposal(f.root,p),/mode/i);assert.throws(()=>m.verifyCompilerProposal(f.root,plain,{inlinePolicies:true}),/mode/i);
 }finally{f.close();}
});
test('sealed inline declarations preserve digest strength source spans and conditional review limits',async()=>{
 const m=await compilerTool(),f=inlineCompilerFixture();try{
  const p=m.prepareCompilerReview(f.root,{inlinePolicies:true}),inline=p.inlinePolicies;assert.equal(inline.sources.length,10);assert.equal(inline.literals.length,9);assert.equal(inline.conditions.length,12);
  for(const literal of [...inline.literals,...inline.conditions.filter(x=>x.branch).map(x=>x.branch)]){const raw=fs.readFileSync(path.join(f.root,literal.owner)),selected=raw.subarray(literal.startByte,literal.endByte);assert.equal(selected.length,literal.bytes);assert.equal(createHash('sha256').update(selected).digest('hex'),literal.sha256);}
  const rows=p.declarations.filter(x=>x.owner==='tools/check-types.mjs').flatMap(x=>x.rows);assert.equal(rows.length,11);assert(rows.every(x=>x.comparison==='sha256-only'&&!Object.hasOwn(x.expected,'bytes')));
  const native=inline.conditions.filter(x=>x.kind==='saved-native-host');assert.equal(native.length,8);assert(native.every(x=>x.admission==='not-evaluated'&&x.savedHost.platform==='win32'&&x.readerHost.platform===process.platform));
  assert(inline.conditions.filter(x=>x.kind==='container-successor').every(x=>x.historyAgreement&&x.successorAgreement));assert.equal(inline.conditions.find(x=>x.kind==='sequence-negative-successor').sourceAgreement,true);
 }finally{f.close();}
});
test('any registered gate byte change refuses opt-in extraction and invalidates default freshness',async()=>{
 const m=await compilerTool(),f=inlineCompilerFixture();try{
  const paths=m.prepareCompilerReview(f.root,{inlinePolicies:true}).inlinePolicies.sources.map(x=>x.path);
  for(const file of paths){const raw=fs.readFileSync(path.join(f.root,file));const baseline=m.prepareCompilerReview(f.root,{inlinePolicies:true}),plain=m.prepareCompilerReview(f.root);try{f.put(file,Buffer.concat([raw,Buffer.from('\n// changed policy source\n')]));assert.throws(()=>m.prepareCompilerReview(f.root,{inlinePolicies:true}),/reviewed.*source|source.*review/i);assert.throws(()=>m.verifyCompilerProposal(f.root,baseline,{inlinePolicies:true}));assert.throws(()=>m.verifyCompilerProposal(f.root,plain),/changed/);}finally{f.put(file,raw);}}
  const file='tools/check-types.mjs',raw=fs.readFileSync(path.join(f.root,file));f.put(file,Buffer.concat([Buffer.from('/* fake declaration context\n'),raw,Buffer.from('\n*/')]));assert.throws(()=>m.prepareCompilerReview(f.root,{inlinePolicies:true}),/source/i);
 }finally{f.close();}
});
test('condition disagreements remain observations and never silently replace history',async()=>{
 const m=await compilerTool(),f=inlineCompilerFixture();try{
  const file='tests/types/display-container-child-index-diagnostic-expectations.json',raw=fs.readFileSync(path.join(f.root,file)),p=m.prepareCompilerReview(f.root,{inlinePolicies:true}),v=JSON.parse(raw);v.currentInputIdentitySuccessor.rows[0].sha256='0'.repeat(64);f.put(file,JSON.stringify(v));
  assert.throws(()=>m.verifyCompilerProposal(f.root,p,{inlinePolicies:true}),/changed/);const r=m.prepareCompilerReview(f.root,{inlinePolicies:true}),condition=r.inlinePolicies.conditions.find(x=>x.kind==='container-successor'&&x.inventory===file);assert.equal(condition.historyAgreement,true);assert.equal(condition.successorAgreement,false);assert.equal(condition.admission,'not-evaluated');
  const declarations=r.declarations.filter(x=>x.owner==='tools/display-container-child-index-types.mjs');assert.equal(declarations.length,2);assert.notEqual(declarations[0].rows[0].expected.sha256,declarations[1].rows[0].expected.sha256);
 }finally{f.close();}
});
test('inline fixture drift and missing inputs preserve raw comparisons without diagnostic execution',async()=>{
 const m=await compilerTool(),f=inlineCompilerFixture();try{
  const file='tests/types/spine-import-plan-negative.ts',raw=fs.readFileSync(path.join(f.root,file));
  for(const missing of [false,true]){f.put(file,raw);const p=m.prepareCompilerReview(f.root,{inlinePolicies:true});assert.equal(p.references.find(x=>x.owner==='repository'&&x.path===file).identity,'same');if(missing)fs.unlinkSync(path.join(f.root,file));else f.put(file,Buffer.concat([raw,Buffer.from('\n// drift')]));assert.throws(()=>m.verifyCompilerProposal(f.root,p,{inlinePolicies:true}),/changed/);const fresh=m.prepareCompilerReview(f.root,{inlinePolicies:true});assert.equal(fresh.references.find(x=>x.owner==='repository'&&x.path===file).identity,missing?'missing':'different');}
 }finally{f.close();}
});

// UNIT: maintenance records raw declarations; it does not grant source admission.
test('M1.1 maintenance keeps three explicit successor owners and cross-owner graph coverage',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const file='packages/engine/web/webgpuBufferPool.ts';f.put(file,'export {};\n');const pin=f.pin(file);
  const owners=['tools/spritesheet-boundary.mjs','tools/browser-png-boundary.mjs','tools/atlas-import-boundary.mjs'];
  for(const owner of owners){const raw=fs.readFileSync(path.join(f.root,owner),'utf8');f.put(owner,raw.replace('const m11WarmSubmissionGraphSuccessor = [];','const m11WarmSubmissionGraphSuccessor = '+JSON.stringify([pin])+';'));}
  const unlisted='packages/engine/web/unregistered.ts';f.put(unlisted,'export {};\n');
  const p=m.prepareBaselineReview(f.root);
  assert.equal(p.declarations.length,27);assert.equal(p.policyLinks.length,3);assert.equal(p.successorPairs.length,2);
  assert.deepEqual(p.declarations.filter(row=>row.binding==='m11WarmSubmissionGraphSuccessor').map(row=>row.owner),owners);
  for(const [index,coverage]of p.graphCoverage.entries()){
   assert.deepEqual(coverage.warmSuccessor,{owner:owners[index],binding:'m11WarmSubmissionGraphSuccessor'});
   assert.equal(coverage.unlisted.some(row=>row.path===file),false);
   assert.ok(coverage.unlisted.some(row=>row.path===unlisted));
  }
  assert.deepEqual(p.references.find(row=>row.path===file).references.map(row=>[row.owner,row.binding,row.branch]),owners.map(owner=>[owner,'m11WarmSubmissionGraphSuccessor','expected']));
  const historical=p.references.find(row=>row.path==='packages/engine/src/value.ts').references;
  assert.equal(historical.filter(row=>row.binding==='imageResidencySuccessors'&&row.branch==='base').length,2);
  assert.equal(historical.filter(row=>row.binding==='imageResidencySuccessors'&&row.branch==='current').length,2);
  assert.equal(m.verifyMaintenanceProposal(f.root,p),true);
  f.put(file,'export const changed = 1;\n');
  assert.throws(()=>m.verifyMaintenanceProposal(f.root,p),/changed/);
  assert.ok(m.prepareBaselineReview(f.root).declarations.filter(row=>row.binding==='m11WarmSubmissionGraphSuccessor').every(row=>row.rows[0].identity==='different'));
 }finally{f.close();}
});
