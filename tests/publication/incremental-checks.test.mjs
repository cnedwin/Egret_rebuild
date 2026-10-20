// SPDX-License-Identifier: Apache-2.0
// Real Git changes prove conservative selection across all contributor states.
import test from 'node:test';
import vm from 'node:vm';
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

test('dependency feedback builds current code and checks boundaries before selected behavior',()=>{
 const commands=selector.feedbackCommands({profile:'dependency',selectedTests:['tests/project.test.mjs']});
 const position=name=>commands.findIndex(args=>args.includes(name));
 for(const name of ['tools/doctor.mjs','tools/check-repository-hygiene.mjs','tools/build.mjs','tools/check-boundaries.mjs','tests/project.test.mjs'])assert.notEqual(position(name),-1,name);
 assert.ok(position('tools/build.mjs')<position('tools/check-boundaries.mjs'));
 assert.ok(position('tools/check-boundaries.mjs')<position('tests/project.test.mjs'));
 assert.equal(position('tools/test.mjs'),-1);
 assert.equal(position('tools/prepush.mjs'),-1);
 assert.equal(position('tools/check-types.mjs'),-1,'historical type admission belongs to merge checks');
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

test('conservative fallback runs all behavior without recursively invoking merge admission',()=>{
 const commands=selector.feedbackCommands({profile:'full'});
 assert.ok(commands.some(args=>args.includes('tools/test.mjs')));
 for(const name of ['tools/prepush.mjs','tools/verify.mjs','tools/spritesheet-boundary.mjs','tools/check-types.mjs'])assert.ok(!commands.some(args=>args.includes(name)),name);
 assert.throws(()=>selector.feedbackCommands({profile:'unknown'}));
 assert.throws(()=>selector.feedbackCommands({profile:'dependency',selectedTests:[]}));
});

test('documentation feedback keeps publication and read-only knowledge-base checks without compilation',()=>{
 const commands=selector.feedbackCommands({profile:'documentation'});
 assert.ok(commands.some(args=>args.includes('tools/check-publication.mjs')&&args.includes('--contribution')));
 assert.ok(commands.some(args=>args.includes('knowledge-base/tools/Validate-KnowledgeBase.ps1')&&args.includes('-CheckOnly')));
 assert.ok(!commands.some(args=>args.includes('tools/build.mjs')||args.includes('tools/test.mjs')));
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
 f.put('tools/spritesheet-boundary.mjs','const graphPins = '+JSON.stringify([pin])+';\nconst configurationPins = [];\nconst ss1AtlasGraphSuccessor = [];\nconst m11WarmSubmissionGraphSuccessor = [];\nconst m12IncrementalRenderingGraphSuccessor = [];\nconst m13SharedRenderingGraphSuccessor = [];\n');
 f.put('tools/browser-png-boundary.mjs','const acceptedSnapshot = '+JSON.stringify({graph:[pin],stablePins:[]})+';\nconst atlasGraphSuccessor = [];\nconst m11WarmSubmissionGraphSuccessor = [];\nconst m12IncrementalRenderingGraphSuccessor = [];\nconst m13SharedRenderingGraphSuccessor = [];\n');
 f.put('tools/sequence-playback-boundary.mjs','const seqpbPackages = [];\nconst seqpbStableEntries = '+JSON.stringify([pin])+';\nconst seqpbConfigurations = [];\nconst m13SequenceInterfaceSuccessor = [];\n');
 const extra=f.pin('packages/engine/src/value.ts');
 for(const [stem,kind]of [['bitmap-resource-slot','BITMAP_RESOURCE_SLOT_FINITE_INTERFACE_POLICY'],['bitmap-binding-ticket','BITMAP_BINDING_TICKET_FINITE_INTERFACE_POLICY']]){
  const policy={schemaVersion:1,kind,packages:[],configurations:[],stableEntries:[extra],oldRootPins:[extra],oldEngineDeclarationPin:extra,workspacePins:[],...(stem==='bitmap-binding-ticket'?{selectedProductPins:[extra]}:{})};
  f.put('tools/'+stem+'-policy.json',JSON.stringify(policy));f.put('tools/'+stem+'-boundary.mjs','const policyPin = '+JSON.stringify(f.pin('tools/'+stem+'-policy.json'))+';\n'+(stem==='bitmap-binding-ticket'?'const m12IncrementalOwnershipSuccessor = [];\n':'')+'const m13InterfaceRawSuccessor = [];\nconst m13InterfaceProjectedSuccessor = [];\nconst m13InterfaceStableSuccessor = [];\n');
 }
 f.put('tests/types/atlas-import-diagnostic-expectations.json',JSON.stringify({kind:'ATLAS_IMPORT_ACTUAL_STRICT_DIAGNOSTICS',status:'OBSERVED_FROZEN_TS7_DIAGNOSTICS',sourcePolicy:{modules:[extra],configurationPins:[]}}));
 f.put('tools/atlas-import-boundary.mjs','const inventoryPin = '+JSON.stringify(f.pin('tests/types/atlas-import-diagnostic-expectations.json'))+';\nconst m11WarmSubmissionGraphSuccessor = [];\nconst m12IncrementalRenderingGraphSuccessor = [];\nconst m13SharedRenderingGraphSuccessor = [];\n');
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
  const successors=p.declarations.filter(x=>x.binding.includes('Successor')).map(x=>[x.owner,x.binding]);
  const historical=[
   ['tools/spritesheet-boundary.mjs','ss1AtlasGraphSuccessor'],
   ['tools/browser-png-boundary.mjs','atlasGraphSuccessor'],
   ...['tools/spritesheet-boundary.mjs','tools/browser-png-boundary.mjs','tools/atlas-import-boundary.mjs'].map(owner=>[owner,'m11WarmSubmissionGraphSuccessor']),
   ...['tools/spritesheet-boundary.mjs','tools/browser-png-boundary.mjs','tools/atlas-import-boundary.mjs'].map(owner=>[owner,'m12IncrementalRenderingGraphSuccessor']),
   ['tools/bitmap-binding-ticket-boundary.mjs','m12IncrementalOwnershipSuccessor']
  ];
  const shared=[
   ...['tools/spritesheet-boundary.mjs','tools/browser-png-boundary.mjs','tools/atlas-import-boundary.mjs'].map(owner=>[owner,'m13SharedRenderingGraphSuccessor']),
   ...['tools/bitmap-resource-slot-boundary.mjs','tools/bitmap-binding-ticket-boundary.mjs'].map(owner=>[owner,'m13InterfaceRawSuccessor'])
  ];
  assert.deepEqual(successors.filter(([,binding])=>!binding.startsWith('m13')),historical);
  assert.deepEqual(successors.filter(([,binding])=>binding.startsWith('m13')),shared);
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
  const owner='tools/bitmap-resource-slot-boundary.mjs',ownerSource=fs.readFileSync(path.join(f.root,owner),'utf8');
  f.put(owner,ownerSource.replace(/^const policyPin = .*;$/m,'const policyPin = '+JSON.stringify(f.pin('tools/bitmap-binding-ticket-policy.json'))+';'));
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
  const historicalPairs=proposal=>{
   const pairs=proposal.successorPairs.filter(row=>row.binding==='imageResidencySuccessors');
   assert.deepEqual(pairs.map(row=>row.owner),['tools/spritesheet-boundary.mjs','tools/browser-png-boundary.mjs']);
   assert.ok(pairs.every(row=>row.rows.length===1));return pairs;
  };
  let p=m.prepareBaselineReview(f.root);assert.equal(p.successorPairs.length,7);assert.ok(historicalPairs(p).every(x=>x.rows[0].identity==='current'));
  f.put(target,'');p=m.prepareBaselineReview(f.root);assert.ok(historicalPairs(p).every(x=>x.rows[0].identity==='neither'));
  for(const owner of ['tools/spritesheet-boundary.mjs','tools/browser-png-boundary.mjs'])f.put(owner,fs.readFileSync(path.join(f.root,owner),'utf8').replace('"base":{"bytes":0,"sha256":"'+'0'.repeat(64)+'"}', '"base":{"bytes":0,"sha256":"'+f.pin(target).sha256+'"}'));
  p=m.prepareBaselineReview(f.root);assert.ok(historicalPairs(p).every(x=>x.rows[0].identity==='base'));
  fs.unlinkSync(path.join(f.root,target));p=m.prepareBaselineReview(f.root);assert.ok(historicalPairs(p).every(x=>x.rows[0].identity==='missing'));f.put(target,original);
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
 put('tools/shared-render-types.mjs','throw Error("never execute shared gate");');
 const sharedInputs=["tests/types/shared-render-positive.ts","tests/types/shared-render-negative.ts","tests/types/tsconfig.shared-render-positive.json","tests/types/tsconfig.shared-render-negative.json","tests/types/tsconfig.dom-free.json","tests/types/tsconfig.json","tsconfig.base.json"];
 for(const file of sharedInputs)put(file,file.endsWith('.ts')?'export {};':'{}');
 put('tests/types/shared-render-diagnostic-expectations.json',JSON.stringify({schemaVersion:1,kind:'SHARED_RENDER_ACTUAL_STRICT_DIAGNOSTICS',status:'OBSERVED_TS7_DIAGNOSTICS',compilerVersion:'7.0.2',tupleFormat:['file','line','column','code'],inputPins:sharedInputs.map(pin),cases:[],tuples:[]}));
 return {root,put,pin,close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('compiler preparation retains registered declaration owners and shared raw references without execution',async()=>{
 const m=await compilerTool(),f=compilerFixture();try{
  const p=m.prepareCompilerReview(f.root);assert.equal(p.status,'review-required');assert.equal(p.acceptance,'none');assert.equal(p.coverage.registered.length,18);assert.deepEqual(p.coverage.unregistered,[]);
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
const m15BootstrapBefore="m13HelperPin.bytes !== 11980 || m13HelperPin.sha256 !== '7f4a82751f0e9e5b3f1b9de5a17816b20cd169ed02f9130b1a7c3989c547b634'";
const m15BootstrapAfter="m13HelperPin.bytes !== 12701 || m13HelperPin.sha256 !== '0c8ae45e31b879ca8e84633091f3a5e938d7712c4f2dff7cf1af3013859b91ad'";
function inlineCompilerFixture({m15=false}={}){
 const f=compilerFixture();
 for(const name of ['check-types','bitmap-resource-slot-types','bitmap-binding-ticket-types','linear-layout-types','bitmap-button-types','display-anchor-offsets-types','display-container-add-child-at-types','display-container-child-index-types','display-container-remove-children-types','sequence-playback-types']){const raw=fs.readFileSync(new URL('../../tools/'+name+'.mjs',import.meta.url));f.put('tools/'+name+'.mjs',m15?raw:Buffer.from(raw.toString().replace(m15BootstrapAfter,m15BootstrapBefore)));}
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
  const p=m.prepareCompilerReview(f.root,{inlinePolicies:true}),inline=p.inlinePolicies;assert.equal(inline.sources.length,10);assert.equal(inline.literals.length,10);assert.equal(inline.conditions.length,13);assert.equal(inline.sourceRevisions.length,10);
  for(const literal of [...inline.literals,...inline.conditions.filter(x=>x.branch).map(x=>x.branch)]){const raw=fs.readFileSync(path.join(f.root,literal.owner)),selected=raw.subarray(literal.startByte,literal.endByte);assert.equal(selected.length,literal.bytes);assert.equal(createHash('sha256').update(selected).digest('hex'),literal.sha256);}
  const rows=p.declarations.filter(x=>x.owner==='tools/check-types.mjs').flatMap(x=>x.rows);assert.equal(rows.length,11);assert(rows.every(x=>x.comparison==='sha256-only'&&!Object.hasOwn(x.expected,'bytes')));
  const native=inline.conditions.filter(x=>x.kind==='saved-native-host');assert.equal(native.length,8);assert(native.every(x=>x.admission==='not-evaluated'&&x.savedHost.platform==='win32'&&x.readerHost.platform===process.platform));
  assert(inline.conditions.filter(x=>x.kind==='container-successor').every(x=>x.historyAgreement&&x.successorAgreement));assert.equal(inline.conditions.find(x=>x.kind==='sequence-negative-successor').sourceAgreement,true);
 }finally{f.close();}
});
// Project only the genuine reviewed M1.5 bytes to the historical fixture.
function m15InlineGateHistory(raw){
 const file='tools/check-types.mjs',identity=body=>({bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});
 const pins={"m13":{"bytes":121118,"sha256":"64d5996ebf925b8b2eda7e04d20e939e399d50953da0023a48ffd02223985093"},"m14":{"bytes":121161,"sha256":"c85407cbdc9c6222cbf240de21e82afd37725e6c8a68bed9ca0d098d7b6dc343"},"delegate":{"bytes":121293,"sha256":"a4cde570d560924537f8caabb7fa8a9b5059241fedda6edfc4968dba443a7e2e"},"scene":{"bytes":141012,"sha256":"b584aa0dc9368285380a3f1569b49430e6fceee3f994a2be4d37acbbc1e9785e"}};
 assert([pins.m14,pins.delegate,pins.scene].some(pin=>JSON.stringify(identity(raw))===JSON.stringify(pin)));
 let text=raw.toString(),scene=null;
 if(JSON.stringify(identity(raw))===JSON.stringify(pins.scene)){
  scene=raw;
  const lines=text.split('\n'),first=lines.findIndex(line=>line==='// The separately observed M1.5 closure retains the complete M1.3 table above.');
  assert(first>=0);assert.equal(lines[first+1].startsWith('const sceneDomM15Successor = '),true);
  assert.equal(lines[first+5],"const sceneDomLabel = sceneDomM15Selected ? 'S3D1 M1.5' : 'S3D1 M1.3';");
  lines.splice(first,6);
  text=lines.filter(line=>!line.includes("throw Error(sceneDomLabel+' incomplete declaration markers')")).join('\n')
   .replace('sceneDomM13Selected = sceneDomM15Selected || existsSync','sceneDomM13Selected = existsSync')
   .replaceAll('sceneDomSuccessor.','sceneDomM13Successor.').replaceAll("Error(sceneDomLabel+'","Error('S3D1 M1.3");
 }
 let delegate=null,m14=Buffer.from(text);
 if(JSON.stringify(identity(m14))!==JSON.stringify(pins.m14)){
  delegate=m14;assert.deepEqual(identity(delegate),pins.delegate);
  const suffix=Buffer.from("\n// Preserve every retained strict lane before the seven M1.5 public consumer pairs.\nawait import('./resource-recovery-types.mjs');\n");assert(delegate.subarray(delegate.length-suffix.length).equals(suffix));m14=delegate.subarray(0,delegate.length-suffix.length);
 }
 assert.deepEqual(identity(m14),pins.m14);
 const suffix=Buffer.from("await import('./shared-webgl2-types.mjs');\n");assert(m14.subarray(m14.length-suffix.length).equals(suffix));
 const m13=m14.subarray(0,m14.length-suffix.length);assert.deepEqual(identity(m13),pins.m13);
 return {file,pins,scene,delegate,m14,m13};
}

// UNIT: admit one appended checker import without moving or replacing inline history.
test('M1.4 compiler maintenance admits only the exact appended WebGL2 checker revision',async()=>{
 const m=await compilerTool(),f=inlineCompilerFixture();try{
  f.put('tools/check-types.mjs',m15InlineGateHistory(fs.readFileSync(path.join(f.root,'tools/check-types.mjs'))).m14);
  const file='tools/check-types.mjs',raw=fs.readFileSync(path.join(f.root,file));
  const suffix=Buffer.from("await import('./shared-webgl2-types.mjs');\n"),prior=raw.subarray(0,raw.length-suffix.length);
  const identity=body=>({path:file,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});
  const oldPin={path:file,bytes:121118,sha256:'64d5996ebf925b8b2eda7e04d20e939e399d50953da0023a48ffd02223985093'};
  const newPin={path:file,bytes:121161,sha256:'c85407cbdc9c6222cbf240de21e82afd37725e6c8a68bed9ca0d098d7b6dc343'};
  assert.deepEqual(raw.subarray(raw.length-suffix.length),suffix);assert.deepEqual(identity(prior),oldPin);assert.deepEqual(identity(raw),newPin);
  const collect=()=>m.prepareCompilerReview(f.root,{inlinePolicies:true}),current=collect();
  const revision=current.inlinePolicies.sourceRevisions.find(row=>row.current.path===file);
  assert.equal(revision.base.bytes,94916);assert.equal(revision.base.sha256,'13080da8e72418df9b8e8279d09b53e36839a5826953f84143c5787d1d1bff7a');
  assert.equal(revision.predecessor,null);assert.deepEqual(revision.successor,oldPin);assert.deepEqual(revision.m14Successor,newPin);
  assert.equal(revision.selection,'m14-current');assert.equal(revision.admission,'not-evaluated');
  f.put(file,prior);const previous=collect();
  assert.equal(previous.inlinePolicies.sourceRevisions.find(row=>row.current.path===file).selection,'current');
  assert.deepEqual(previous.inlinePolicies.literals,current.inlinePolicies.literals);
  assert.deepEqual(previous.declarations.filter(row=>row.owner===file),current.declarations.filter(row=>row.owner===file));
  assert.throws(()=>m.verifyCompilerProposal(f.root,current,{inlinePolicies:true}),/changed/);
  f.put(file,raw);assert.equal(m.verifyCompilerProposal(f.root,current,{inlinePolicies:true}).status,'current-inputs');
  const literal=current.inlinePolicies.literals.find(row=>row.owner===file),changedLiteral=Buffer.from(raw);changedLiteral[literal.startByte]^=1;
  const variants=[Buffer.concat([raw,suffix]),Buffer.concat([suffix,prior]),Buffer.from(raw.toString().replace('./shared-webgl2-types.mjs','./shared-webgl2-typez.mjs')),changedLiteral,Buffer.concat([raw,Buffer.from('// unreviewed drift\n')])];
  for(const altered of variants){
   f.put(file,raw);const baseline=collect();
   assert.equal(m.verifyCompilerProposal(f.root,baseline,{inlinePolicies:true}).status,'current-inputs');
   f.put(file,altered);
   assert.throws(collect,/Unreviewed inline policy source: tools\/check-types\.mjs/);
   assert.throws(()=>m.verifyCompilerProposal(f.root,baseline,{inlinePolicies:true}));
  }
  f.put(file,raw);assert.equal(m.verifyCompilerProposal(f.root,current,{inlinePolicies:true}).status,'current-inputs');
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
  assert.equal(p.declarations.length,36);assert.equal(p.policyLinks.length,3);assert.equal(p.successorPairs.length,7);
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

// UNIT: source succession is a raw relationship, never compiler acceptance.
test('M1.2 compiler maintenance keeps both complete sequence source pairs and saved diagnostics',async()=>{
 const m=await compilerTool(),f=inlineCompilerFixture();try{
  const source='packages/runtime/src/DisplayObject.ts',declaration='packages/runtime/dist/DisplayObject.d.ts';
  for(const file of [source,declaration])f.put(file,fs.readFileSync(new URL('../../'+file,import.meta.url)));
  const collect=()=>m.prepareCompilerReview(f.root,{inlinePolicies:true});
  const baseline=collect(),condition=baseline.inlinePolicies.conditions.find(row=>row.kind==='sequence-source-successor');
  assert.deepEqual([condition.pathsAgreement,condition.unchangedDeclaration,condition.completeBaseMatch,condition.completeCurrentMatch],[true,true,false,false]);
  assert.equal(condition.admission,'not-evaluated');
  const revision=baseline.inlinePolicies.sourceRevisions.find(row=>row.current.path==='tools/sequence-playback-types.mjs');assert.equal(revision.selection,'m14-strict-current');assert.notDeepEqual(revision.base,revision.current);
  assert.equal(revision.base.bytes,17296);assert.equal(revision.base.sha256,'8b2d266f7aacd680f7a1581afb2ea1a1381f02fc44cd70b340ee8961c7584222');
  const groups=baseline.declarations.filter(row=>row.owner==='tools/sequence-playback-types.mjs');
  assert.equal(groups.find(row=>row.selector==='expectedCurrentSourcePins').rows[0].identity,'different');
  assert(groups.find(row=>row.selector==='m12IncrementalSourcePins').rows.every(row=>row.identity==='different'));
  assert.equal(revision.predecessor.bytes,18474);assert.equal(revision.predecessor.sha256,'e9388c73080d4db112b3260e17bdfc7d1ff1ca6130fa8cccdae7d3b60084ba6b');
  assert.equal(baseline.inlinePolicies.conditions.find(row=>row.kind==='sequence-negative-successor').sourceAgreement,true);
  for(const file of [source,declaration]){
   const raw=fs.readFileSync(path.join(f.root,file));
   try{
    f.put(file,Buffer.concat([raw,Buffer.from('\n// unregistered source identity\n')]));
    assert.throws(()=>m.verifyCompilerProposal(f.root,baseline,{inlinePolicies:true}),/changed/);
    const changed=collect().inlinePolicies.conditions.find(row=>row.kind==='sequence-source-successor');
    assert.equal(changed.completeBaseMatch,false);assert.equal(changed.completeCurrentMatch,false);
   }finally{f.put(file,raw);}
  }
  assert.equal(m.verifyCompilerProposal(f.root,baseline,{inlinePolicies:true}).status,'current-inputs');
 }finally{f.close();}
});

// UNIT: explicit M1.2 owners remain observations, never automatic gate authority.
test('M1.2 maintenance retains complete successor owners and historical cross-owner references',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const file='packages/runtime/src/frameCaptureCache.ts';f.put(file,'export {};\n');const pin=f.pin(file);
  const owners=['tools/spritesheet-boundary.mjs','tools/browser-png-boundary.mjs','tools/atlas-import-boundary.mjs'];
  for(const owner of owners){const raw=fs.readFileSync(path.join(f.root,owner),'utf8');f.put(owner,raw.replace('const m12IncrementalRenderingGraphSuccessor = [];','const m12IncrementalRenderingGraphSuccessor = '+JSON.stringify([pin])+';'));}
  const bbt='tools/bitmap-binding-ticket-boundary.mjs',owned=f.pin('packages/engine/src/value.ts');
  f.put(bbt,fs.readFileSync(path.join(f.root,bbt),'utf8').replace('const m12IncrementalOwnershipSuccessor = [];','const m12IncrementalOwnershipSuccessor = '+JSON.stringify([owned])+';'));
  const extra='packages/runtime/src/unreviewed.ts';f.put(extra,'export {};\n');
  const p=m.prepareBaselineReview(f.root);
  assert.equal(p.status,'review-required');assert.equal(p.declarations.length,36);assert.equal(p.policyLinks.length,3);assert.equal(p.successorPairs.length,7);
  assert.deepEqual(p.declarations.filter(row=>row.binding==='m12IncrementalRenderingGraphSuccessor').map(row=>row.owner),owners);
  assert.deepEqual(p.declarations.filter(row=>row.binding==='m12IncrementalOwnershipSuccessor').map(row=>row.owner),[bbt]);
  for(const [index,coverage]of p.graphCoverage.entries()){
   assert.deepEqual(coverage.incrementalSuccessor,{owner:owners[index],binding:'m12IncrementalRenderingGraphSuccessor'});
   assert.deepEqual(coverage.warmSuccessor,{owner:owners[index],binding:'m11WarmSubmissionGraphSuccessor'});
   assert.equal(coverage.unlisted.some(row=>row.path===file),false);assert.ok(coverage.unlisted.some(row=>row.path===extra));
  }
  assert.deepEqual(p.references.find(row=>row.path===file).references.map(row=>[row.owner,row.binding]),owners.map(owner=>[owner,'m12IncrementalRenderingGraphSuccessor']));
  const old=p.references.find(row=>row.path===owned.path).references;
  assert.ok(old.some(row=>row.owner==='tools/bitmap-binding-ticket-policy.json'&&row.binding==='selectedProductPins'));
  assert.ok(old.some(row=>row.owner===bbt&&row.binding==='m12IncrementalOwnershipSuccessor'));
  assert.equal(old.filter(row=>row.binding==='imageResidencySuccessors'&&row.branch==='base').length,2);
  assert.equal(old.filter(row=>row.binding==='imageResidencySuccessors'&&row.branch==='current').length,2);
  assert.equal(m.verifyMaintenanceProposal(f.root,p),true);
  f.put(file,'export const changed = 1;\n');assert.throws(()=>m.verifyMaintenanceProposal(f.root,p),/changed/);
  assert.ok(m.prepareBaselineReview(f.root).declarations.filter(row=>row.binding==='m12IncrementalRenderingGraphSuccessor').every(row=>row.rows[0].identity==='different'));
 }finally{f.close();}
});

// UNIT: exact M1.3 registration is raw review data, not source/strict acceptance.
test('M1.3 maintenance retains complete graph groups and both interface pair arms',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const file='packages/contracts/src/SharedGeometry2D.ts';f.put(file,'export {};\n');const current=f.pin(file),base={...current,bytes:0,sha256:'0'.repeat(64)};
  const owners=['tools/spritesheet-boundary.mjs','tools/browser-png-boundary.mjs','tools/atlas-import-boundary.mjs'];
  for(const owner of owners)f.put(owner,fs.readFileSync(path.join(f.root,owner),'utf8').replace('const m13SharedRenderingGraphSuccessor = [];','const m13SharedRenderingGraphSuccessor = '+JSON.stringify([current])+';'));
  const interfaces=[['tools/sequence-playback-boundary.mjs','m13SequenceInterfaceSuccessor'],['tools/bitmap-resource-slot-boundary.mjs','m13InterfaceStableSuccessor'],['tools/bitmap-binding-ticket-boundary.mjs','m13InterfaceProjectedSuccessor']];
  for(const [owner,binding]of interfaces)f.put(owner,fs.readFileSync(path.join(f.root,owner),'utf8').replace('const '+binding+' = [];','const '+binding+' = '+JSON.stringify([{base,current}])+';'));
  const p=m.prepareBaselineReview(f.root);assert.equal(p.declarations.length,36);assert.equal(p.successorPairs.length,7);
  for(const [i,coverage]of p.graphCoverage.entries()){assert.deepEqual(coverage.sharedSuccessor,{owner:owners[i],binding:'m13SharedRenderingGraphSuccessor'});assert.equal(coverage.unlisted.some(row=>row.path===file),false);}
  const refs=p.references.find(row=>row.path===file).references;assert.equal(refs.length,9);assert.equal(refs.filter(row=>row.branch==='base').length,3);assert.equal(refs.filter(row=>row.branch==='current').length,3);
  assert.equal(p.successorPairs.filter(group=>interfaces.some(([owner,binding])=>owner===group.owner&&binding===group.binding)).every(group=>group.rows[0].identity==='current'),true);
  const [owner,binding]=interfaces[0],raw=fs.readFileSync(path.join(f.root,owner),'utf8');
  f.put(owner,raw+'const '+binding+' = [];\n');assert.throws(()=>m.prepareBaselineReview(f.root),/ambiguous/);f.put(owner,raw);
  f.put(owner,raw.replace(JSON.stringify([{base,current}]),JSON.stringify([{base,current:{...current,path:'packages/contracts/src/Other.ts'}}])));assert.throws(()=>m.prepareBaselineReview(f.root),/path differs/);f.put(owner,raw);
  assert.equal(m.verifyMaintenanceProposal(f.root,p),true);
 }finally{f.close();}
});

test('shared compiler maintenance admits only its seven fixed raw input roles',async()=>{
 const m=await compilerTool(),f=compilerFixture();try{
  const file='tests/types/shared-render-diagnostic-expectations.json',raw=fs.readFileSync(path.join(f.root,file),'utf8'),value=JSON.parse(raw),p=m.prepareCompilerReview(f.root);
  const rows=p.declarations.find(row=>row.owner===file&&row.selector==='inputPins').rows;assert.equal(rows.length,7);assert(rows.every(row=>row.identity==='same'));
  f.put(file,JSON.stringify({...value,inputPins:[...value.inputPins.slice(0,6),{...value.inputPins[6],path:'tests/types/foreign.json'}]}));assert.throws(()=>m.prepareCompilerReview(f.root),/shared strict inputs/);
  f.put(file,JSON.stringify({...value,tupleFormat:['file','line','code']}));assert.throws(()=>m.prepareCompilerReview(f.root),/shared strict schema/);
  f.put(file,raw);assert.equal(m.verifyCompilerProposal(f.root,p).status,'current-inputs');
 }finally{f.close();}
});

// UNIT: this finite inventory extension retains every older declaration and pair arm.
test('M1.4 maintenance records only the three named WebGL2 graph successors',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const file='packages/engine/web/webgl2.ts';f.put(file,'export {};\n');const current=f.pin(file);
  const owners=["tools/spritesheet-boundary.mjs","tools/browser-png-boundary.mjs","tools/atlas-import-boundary.mjs"],binding='m14WebGL2GraphSuccessor';
  const historical=m.prepareBaselineReview(f.root);
  for(const owner of owners)f.put(owner,fs.readFileSync(path.join(f.root,owner),'utf8')+'const '+binding+' = '+JSON.stringify([current])+';\n');
  const complete=m.prepareBaselineReview(f.root);
  assert.deepEqual(complete.declarations.filter(row=>row.binding!==binding),historical.declarations);
  assert.deepEqual(complete.successorPairs,historical.successorPairs);
  assert.deepEqual(complete.declarations.filter(row=>row.binding===binding).map(row=>row.owner),owners);
  for(const [index,coverage]of complete.graphCoverage.entries()){assert.deepEqual(coverage.webglSuccessor,{owner:owners[index],binding});assert.equal(coverage.unlisted.some(row=>row.path===file),false);}
  assert.equal(m.verifyMaintenanceProposal(f.root,complete),true);
  for(const owner of owners){
   const raw=fs.readFileSync(path.join(f.root,owner));
   try{
    const baseline=m.prepareBaselineReview(f.root);assert.equal(m.verifyMaintenanceProposal(f.root,baseline),true);
    f.put(owner,Buffer.concat([raw,Buffer.from('const '+binding+' = [];\n')]));
    assert.throws(()=>m.prepareBaselineReview(f.root),/ambiguous/);assert.throws(()=>m.verifyMaintenanceProposal(f.root,baseline));
   }finally{f.put(owner,raw);assert.equal(m.verifyMaintenanceProposal(f.root,complete),true);}
  }
 }finally{f.close();}
});

// UNIT: bootstrap succession never changes the retained inline compiler observations.
test('M1.4 strict bootstrap preserves complete sequence history and refuses unrelated bytes',async()=>{
 const m=await compilerTool(),f=inlineCompilerFixture();try{
  const file='tools/sequence-playback-types.mjs',raw=fs.readFileSync(path.join(f.root,file)),text=raw.toString();
  const before="m13HelperPin.bytes !== 10785 || m13HelperPin.sha256 !== '61a14bb8be2162d861a26b822ded713c552b4032d755e291578b225cd13ef337'",after="m13HelperPin.bytes !== 11980 || m13HelperPin.sha256 !== '7f4a82751f0e9e5b3f1b9de5a17816b20cd169ed02f9130b1a7c3989c547b634'";
  assert.equal(text.split(after).length,2);const prior=Buffer.from(text.replace(after,before));
  assert.equal(prior.length,19255);assert.equal(createHash('sha256').update(prior).digest('hex'),'42a0bad83c5f68f74d2b1e26bd9c5183be9e94e1cb4c36a01a4b60c373e4a6ea');
  const collect=()=>m.prepareCompilerReview(f.root,{inlinePolicies:true}),current=collect();
  assert.equal(current.inlinePolicies.sourceRevisions.find(row=>row.current.path===file).selection,'m14-strict-current');
  f.put(file,prior);const historical=collect();assert.equal(historical.inlinePolicies.sourceRevisions.find(row=>row.current.path===file).selection,'current');
  assert.deepEqual(historical.inlinePolicies.literals,current.inlinePolicies.literals);assert.deepEqual(historical.inlinePolicies.conditions,current.inlinePolicies.conditions);
  assert.throws(()=>m.verifyCompilerProposal(f.root,current,{inlinePolicies:true}),/changed/);
  f.put(file,raw);const baseline=collect();assert.equal(m.verifyCompilerProposal(f.root,baseline,{inlinePolicies:true}).status,'current-inputs');
  f.put(file,Buffer.concat([raw,Buffer.from('// unreviewed strict source\n')]));
  assert.throws(collect,/Unreviewed inline policy source/);assert.throws(()=>m.verifyCompilerProposal(f.root,baseline,{inlinePolicies:true}));
  f.put(file,raw);assert.equal(m.verifyCompilerProposal(f.root,current,{inlinePolicies:true}).status,'current-inputs');
 }finally{f.close();}
});

// Runner controls execute first-party tool code with owned gates, not SDK acceptance.

function withPushFixture(body){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'egret push feedback '));
 try{
  fs.mkdirSync(path.join(root,'tools'));
  fs.copyFileSync(new URL('../../tools/check-push.mjs',import.meta.url),path.join(root,'tools/check-push.mjs'));
  for(const gate of ['doctor','check-repository-hygiene','check-publication']){
   fs.writeFileSync(path.join(root,'tools',gate+'.mjs'),
    "import fs from 'node:fs'; fs.appendFileSync('calls.jsonl',JSON.stringify({gate:"+JSON.stringify(gate)+",args:process.argv.slice(2)})+String.fromCharCode(10)); if(process.env.EGRET_FIXTURE_FAILURE==="+JSON.stringify(gate)+")process.exit(23);\n");
  }
  fs.mkdirSync(path.join(root,'knowledge-base/tools'),{recursive:true});
  fs.writeFileSync(path.join(root,'knowledge-base/tools/Validate-KnowledgeBase.ps1'),
   "param([switch]$CheckOnly)\n$arguments = @()\nif ($CheckOnly) { $arguments += '-CheckOnly' }\n@{ gate = 'knowledge-base'; args = $arguments } | ConvertTo-Json -Compress | Add-Content -LiteralPath 'calls.jsonl' -Encoding utf8\nif ($env:EGRET_FIXTURE_FAILURE -eq 'knowledge-base') { exit 23 }\n");
  const run=(args=[],failure)=>spawnSync(process.execPath,['tools/check-push.mjs',...args],{cwd:root,encoding:'utf8',env:{...process.env,EGRET_FIXTURE_FAILURE:failure??''}});
  const calls=()=>fs.existsSync(path.join(root,'calls.jsonl'))?fs.readFileSync(path.join(root,'calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse):[];
  body({run,calls});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('push checks inspect the committed snapshot and publication without building',()=>withPushFixture(({run,calls})=>{
 const r=run(['--committed']);assert.equal(r.status,0,r.stderr);
 assert.deepEqual(calls(),[{gate:'doctor',args:[]},{gate:'check-repository-hygiene',args:['--committed']},{gate:'check-publication',args:['--contribution']},{gate:'knowledge-base',args:['-CheckOnly']}]);
 assert.match(r.stdout,/not.*merge|merge.*required/i);
}));
test('every push gate failure stops publication and propagates its exit status',()=>{
 for(const [i,gate]of ['doctor','check-repository-hygiene','check-publication','knowledge-base'].entries())withPushFixture(({run,calls})=>{
  const r=run(['--committed'],gate);assert.equal(r.status,23,r.stderr);assert.equal(calls().length,i+1);
 });
});
test('push feedback rejects unknown and repeated flags before running checks',()=>{
 for(const args of [['--integrated'],['--committed','--committed'],['--skip-tests']])withPushFixture(({run,calls})=>{
  const r=run(args);assert.notEqual(r.status,0);assert.deepEqual(calls(),[]);
 });
});

// Execute the actual setup orchestration with controlled prerequisite and child
// process ports. Installation, SDK compilation and Git configuration do not run.
function setupControl(args){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'egret setup feedback '));
 const calls=[];
 try{
  const cli=path.join(root,'pnpm/bin/pnpm.cjs');fs.mkdirSync(path.dirname(cli),{recursive:true});
  fs.writeFileSync(path.join(root,'pnpm/package.json'),JSON.stringify({name:'pnpm',version:'11.25.0'}));
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({packageManager:'pnpm@11.25.0'}));
  const dependency=path.join(root,'node_modules/robust-predicates');fs.mkdirSync(dependency,{recursive:true});
  fs.writeFileSync(path.join(dependency,'package.json'),JSON.stringify({name:'robust-predicates',version:'3.0.3'}));
  const engineModules=path.join(root,'packages/engine/node_modules');fs.mkdirSync(engineModules,{recursive:true});
  fs.symlinkSync(dependency,path.join(engineModules,'robust-predicates'),process.platform==='win32'?'junction':'dir');
  let source=fs.readFileSync(new URL('../../tools/setup-dev.mjs',import.meta.url),'utf8');
  source=source.replace(/^import .*;\r?$/gm,'');
  const context={fs,path,repository:root,localPackage:(_root,p)=>p,samePhysicalPath:(a,b)=>a===b,
   createRequire:()=>{throw Error('Unexpected native branch in Linux control');},inspectEnvironment:()=>({ok:true}),console:{log(){},error(){}},
   process:{argv:['node','setup-dev.mjs',...args],execPath:process.execPath,platform:'linux',arch:'x64',env:{npm_execpath:cli},exit(code){throw Error('exit '+code);}},
   spawnSync(command,argv){calls.push({command,args:[...argv]});return {status:command==='git'&&argv.includes('--get')?1:0};}};
  vm.runInNewContext(source,context,{filename:'setup-dev.mjs'});
  return calls.map(call=>({...call,args:call.args.map(arg=>arg===cli?'<fixture-pnpm>':arg)}));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('setup skips only its build when CI explicitly requests no-build',()=>{
 const normal=setupControl([]),setupOnly=setupControl(['--no-build']);
 assert.equal(normal.filter(v=>v.args.includes('tools/build.mjs')).length,1);
 assert.equal(setupOnly.filter(v=>v.args.includes('tools/build.mjs')).length,0);
 assert.deepEqual(setupOnly,normal.filter(v=>!v.args.includes('tools/build.mjs')));
 assert.ok(setupOnly.some(v=>v.args.includes('install')&&v.args.includes('--frozen-lockfile')&&v.args.includes('--ignore-scripts')));
 assert.ok(setupOnly.some(v=>v.args.includes('tools/doctor.mjs')));
});
test('setup refuses unknown and duplicate options',()=>{
 for(const args of [['--no-build','--no-build'],['--skip-install'],['--build']])assert.throws(()=>setupControl(args),/Usage/);
});


// Actual merge/verify entry points run against owned child gates. A missing
// output marker models clean-checkout ordering, not a real SDK compilation.
function withMergeRunner(body){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'egret merge order '));
 const put=(file,text)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),text);};
 try{
  const prepush=fs.readFileSync(new URL('../../tools/prepush.mjs',import.meta.url),'utf8');
  put('tools/prepush.mjs',prepush);
  put('tools/verify.mjs',fs.readFileSync(new URL('../../tools/verify.mjs',import.meta.url),'utf8'));
  const gates=['check-repository-hygiene','contribution-metadata','check-publication','build','check-boundaries','spritesheet-boundary','sequence-playback-boundary','browser-png-boundary','bitmap-resource-slot-boundary','bitmap-binding-ticket-boundary','resource-scene-boundary','atlas-frame/boundary','atlas-import-boundary','check-types','browser-png-types','test','verify-spine-f2-source'];
  function child(gate){
   const setup="import fs from 'node:fs';fs.appendFileSync('calls.jsonl',JSON.stringify({gate:"+JSON.stringify(gate)+",args:process.argv.slice(2)})+String.fromCharCode(10));if(process.env.EGRET_FIXTURE_FAILURE==="+JSON.stringify(gate)+")process.exit(23);";
   if(gate==='build')return setup+"fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/ready','controlled runner output');\n";
   if(['check-repository-hygiene','contribution-metadata'].includes(gate))return setup;
   return setup+"if(!fs.existsSync('dist/ready')){console.error('BUILD_REQUIRED_BEFORE_GATE');process.exit(29);}\n";
  }
  for(const gate of gates)put('tools/'+gate+'.mjs',child(gate));
  for(const name of ['headless','nine-slice-bitmap-headless'])put('examples/'+name+'.mjs',child(name));
  const publication=[...prepush.matchAll(/'(tests\/publication\/[^']+\.test\.mjs)'/g)].map(row=>row[1]);
  assert.ok(publication.length>0,'the actual merge runner must execute publication regressions');
  for(const name of publication)put(name,child('publication-test'));
  put('knowledge-base/tools/Validate-KnowledgeBase.ps1',"param([switch]$CheckOnly)\nif (-not $CheckOnly) { exit 29 }\nif (-not (Test-Path -LiteralPath 'dist/ready')) { exit 29 }\n@{ gate = 'knowledge-base'; args = @('-CheckOnly') } | ConvertTo-Json -Compress | Add-Content -LiteralPath 'calls.jsonl' -Encoding utf8\n");
  // Start the nested publication runner as a separate test session.
  const environment={...process.env,EGRET_METADATA_BASE:''};delete environment.NODE_TEST_CONTEXT;
  const run=(tool,args=[],failure)=>spawnSync(process.execPath,['tools/'+tool+'.mjs',...args],{cwd:root,encoding:'utf8',env:{...environment,EGRET_FIXTURE_FAILURE:failure??''}});
  const calls=()=>fs.existsSync(path.join(root,'calls.jsonl'))?fs.readFileSync(path.join(root,'calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse):[];
  assert.equal(fs.existsSync(path.join(root,'dist')),false);
  body({run,calls});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('complete merge checks build once before publication from an empty output tree',()=>{
 for(const args of [[],['--committed','--integrated']])withMergeRunner(({run,calls})=>{
  const r=run('prepush',args);assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
  const rows=calls(),build=rows.findIndex(v=>v.gate==='build'),publication=rows.findIndex(v=>v.gate==='check-publication');
  assert.equal(rows.filter(v=>v.gate==='build').length,1);
  assert.ok(build>=0&&build<publication);
  assert.ok(rows.some(v=>v.gate==='publication-test'),r.stdout+'\n'+JSON.stringify(rows));
  for(const gate of ['check-types','browser-png-types','test','verify-spine-f2-source','headless','nine-slice-bitmap-headless','knowledge-base'])assert.ok(rows.some(v=>v.gate===gate),gate);
  assert.deepEqual(rows.find(v=>v.gate==='check-repository-hygiene').args,args.includes('--committed')?['--committed']:[]);
  assert.equal(rows.some(v=>v.gate==='contribution-metadata'),args.includes('--integrated'));
 });
});
test('initial build failure stops the merge runner before publication',()=>withMergeRunner(({run,calls})=>{
 const r=run('prepush',[],'build');assert.equal(r.status,23,r.stderr);
 assert.deepEqual(calls().map(v=>v.gate),['check-repository-hygiene','build']);
}));
test('standalone verify builds by default and explicit no-build reuses prepared output',()=>{
 withMergeRunner(({run,calls})=>{const r=run('verify');assert.equal(r.status,0,r.stderr);assert.equal(calls().filter(v=>v.gate==='build').length,1);});
 withMergeRunner(({run,calls})=>{
  assert.equal(run('build').status,0);const r=run('verify',['--no-build']);assert.equal(r.status,0,r.stderr);
  assert.equal(calls().filter(v=>v.gate==='build').length,1,'verify must not rebuild prepared output');
 });
 withMergeRunner(({run,calls})=>{const r=run('verify',['--no-build']);assert.equal(r.status,29,r.stderr);assert.equal(calls()[0].gate,'check-boundaries');});
});
test('verify rejects unknown and duplicate options before starting children',()=>{
 for(const args of [['--no-build','--no-build'],['--skip-tests'],['--integrated']])withMergeRunner(({run,calls})=>{
  assert.notEqual(run('verify',args).status,0);assert.deepEqual(calls(),[]);
 });
});

// UNIT: genuine current gate bytes and both exact historical inverses; no compiler execution.
test('M1.5 strict bootstrap admits nine exact revisions and preserves both predecessor stages',async()=>{
 const m=await compilerTool(),f=inlineCompilerFixture({m15:true});try{
  const expected=[{"path":"tools/bitmap-resource-slot-types.mjs","predecessor":{"bytes":11184,"sha256":"2f1c767bc1701c5bcf087b7eb48857006334ffc36c205a82cf81d9fa2b857315"},"current":{"bytes":11184,"sha256":"c97f8b75d9103477c7f5e5932f0fb75e588d42eec31a73e6f66327fae9275eaf"}},{"path":"tools/bitmap-binding-ticket-types.mjs","predecessor":{"bytes":13887,"sha256":"1e80a8a04ae0b35dd1084762172aed96e966fe3a3e9e47a86da383cd853bfb32"},"current":{"bytes":13887,"sha256":"b36874eaab10b6c275424584d062b599f8e14a215336a7722e9a3783190a8782"}},{"path":"tools/linear-layout-types.mjs","predecessor":{"bytes":11073,"sha256":"1d9a07307a4725eb8234cbb062f23474c2c4ce28ef0a43706a041cecbe246085"},"current":{"bytes":11073,"sha256":"89cf1e6e5fd099871ff0d7388df1b0b6e6accd36c78aef9aa33e1e5426fa71c3"}},{"path":"tools/bitmap-button-types.mjs","predecessor":{"bytes":17175,"sha256":"74c55fbc100d49ed03278b2d8eb85d4833379a8219c932fce5325ec9cd448fe1"},"current":{"bytes":17175,"sha256":"919546bc07a51a78d499ae070618d7000e2d87774ad4af3c8a540b395924bbb8"}},{"path":"tools/display-anchor-offsets-types.mjs","predecessor":{"bytes":16526,"sha256":"04fcc94308c627433412348d9088fb98d032808d9029ef5e8fc154cf28868ae4"},"current":{"bytes":16526,"sha256":"9d37f5989501d97094b25a0d9130f98c906cdc60bea4b1f9a042279b7279f90c"}},{"path":"tools/display-container-add-child-at-types.mjs","predecessor":{"bytes":18718,"sha256":"64d67885a2c91e19beda887da12a44d09938d71afceff3c001a6cf51c4523563"},"current":{"bytes":18718,"sha256":"f25ded3a21e455bfc45d5181025d7fd6dcd43cd666a08bc246855fce4452ee91"}},{"path":"tools/display-container-child-index-types.mjs","predecessor":{"bytes":17112,"sha256":"eea91a2a74aaf1a7d210a923106afd305e0028bd29a24482f9669a368d2c689f"},"current":{"bytes":17112,"sha256":"fb2d518381df6f41795f198c5b353b03fc194361151bbdd5963fde78e7f38929"}},{"path":"tools/display-container-remove-children-types.mjs","predecessor":{"bytes":15268,"sha256":"df1dd4a369ac4d19f892aed8d684e5097f86935f470e6f02deed48c5c3f20159"},"current":{"bytes":15268,"sha256":"f03e8cfc77240d8ea40021333bf13e56cc15e0e0f469442fd6a72dee7e5bd31b"}},{"path":"tools/sequence-playback-types.mjs","predecessor":{"bytes":19255,"sha256":"904cc980cc1ae6bc8542ea37cf5f876020c8ba5576fd6f3066536e35de33c6b6"},"current":{"bytes":19255,"sha256":"6dffcc40c3654db9c9faa2f9983eafea7b6e91960aab20f279b0f5caba9a66be"}}];
  const collect=()=>m.prepareCompilerReview(f.root,{inlinePolicies:true}),current=collect();
  for(const row of expected){
   const file=row.path,raw=fs.readFileSync(path.join(f.root,file)),text=raw.toString();
   assert.deepEqual({bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')},row.current);assert.equal(text.split(m15BootstrapAfter).length,2);
   const revision=current.inlinePolicies.sourceRevisions.find(value=>value.current.path===file);assert.equal(revision.selection,'m15-strict-current');assert.equal(revision.admission,'not-evaluated');
   assert.deepEqual(revision.m14StrictSuccessor,{path:file,...row.predecessor});assert.deepEqual(revision.m15StrictSuccessor,{path:file,...row.current});
   const predecessor=Buffer.from(text.replace(m15BootstrapAfter,m15BootstrapBefore));assert.deepEqual({bytes:predecessor.length,sha256:createHash('sha256').update(predecessor).digest('hex')},row.predecessor);
   f.put(file,predecessor);const historical=collect();assert.equal(historical.inlinePolicies.sourceRevisions.find(value=>value.current.path===file).selection,'m14-strict-current');
   assert.deepEqual(historical.inlinePolicies.literals,current.inlinePolicies.literals);assert.deepEqual(historical.inlinePolicies.conditions,current.inlinePolicies.conditions);assert.throws(()=>m.verifyCompilerProposal(f.root,current,{inlinePolicies:true}),/changed/);
   f.put(file,raw);assert.equal(m.verifyCompilerProposal(f.root,current,{inlinePolicies:true}).status,'current-inputs');
   for(const altered of [Buffer.from(text.replace(m15BootstrapAfter,m15BootstrapAfter.replace('12701','12702'))),Buffer.concat([raw,Buffer.from('// unreviewed M1.5 drift\n')])]){
    f.put(file,raw);const baseline=collect();assert.equal(m.verifyCompilerProposal(f.root,baseline,{inlinePolicies:true}).status,'current-inputs');
    f.put(file,altered);assert.throws(collect,/Unreviewed inline policy source/);assert.throws(()=>m.verifyCompilerProposal(f.root,baseline,{inlinePolicies:true}));
    f.put(file,raw);assert.equal(m.verifyCompilerProposal(f.root,baseline,{inlinePolicies:true}).status,'current-inputs');
   }
  }
 }finally{f.close();}
});


// UNIT: fixed M1.5 roles reuse raw observations; no adapter or SDK is executed.
test('M1.5 maintenance keeps three graph groups and seventeen pair roles beside all history',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const owners=['tools/spritesheet-boundary.mjs','tools/browser-png-boundary.mjs','tools/atlas-import-boundary.mjs'];
  const roles=[["tools/spritesheet-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/spritesheet-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/browser-png-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/atlas-import-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m15ResourcePackageSuccessors","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m15ResourceAtlasPackageSuccessor","raw-pair-observation-only"],["tools/sequence-playback-boundary.mjs","m15SequenceInterfaceSuccessor","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m15InterfaceRawSuccessor","raw-pair-observation-only"],["tools/bitmap-resource-slot-boundary.mjs","m15InterfaceProjectedSuccessor","transformed-pair-raw-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m15InterfaceRawSuccessor","raw-pair-observation-only"],["tools/bitmap-binding-ticket-boundary.mjs","m15InterfaceProjectedSuccessor","transformed-pair-raw-observation-only"]],graphBinding='m15ResourceRecoveryGraphSuccessor';
  const file='packages/contracts/src/ResourceManifest.ts';f.put(file,'export {};\n');
  const current=f.pin(file),base={...current,bytes:0,sha256:'0'.repeat(64)},pair={base,current};
  const historical=m.prepareBaselineReview(f.root);
  for(const owner of owners)f.put(owner,fs.readFileSync(path.join(f.root,owner),'utf8')+'const '+graphBinding+' = '+JSON.stringify([current])+';\n');
  for(const [owner,binding]of roles)f.put(owner,fs.readFileSync(path.join(f.root,owner),'utf8')+'const '+binding+' = '+JSON.stringify([pair])+';\n');
  const collect=()=>m.prepareBaselineReview(f.root),complete=collect();
  assert.equal(complete.status,'review-required');assert.equal(complete.declarations.length,39);assert.equal(complete.successorPairs.length,24);
  assert.deepEqual(complete.declarations.filter(row=>row.binding!==graphBinding),historical.declarations);
  assert.deepEqual(complete.successorPairs.filter(row=>!roles.some(([owner,binding])=>row.owner===owner&&row.binding===binding)),historical.successorPairs);
  assert.deepEqual(complete.declarations.filter(row=>row.binding===graphBinding).map(row=>row.owner),owners);
  for(const [index,coverage]of complete.graphCoverage.entries()){assert.deepEqual(coverage.resourceRecoverySuccessor,{owner:owners[index],binding:graphBinding});assert.equal(coverage.unlisted.some(row=>row.path===file),false);}
  for(const [owner,binding,comparison]of roles){
   const group=complete.successorPairs.find(row=>row.owner===owner&&row.binding===binding);
   assert.equal(group.comparison,comparison);assert.equal(group.rows.length,1);assert.equal(group.rows[0].identity,'current');assert.deepEqual(group.rows[0].base,base);assert.deepEqual(group.rows[0].successor,current);
  }
  const refs=complete.references.find(row=>row.path===file).references;
  assert.equal(refs.length,37);assert.equal(refs.filter(row=>row.branch==='base').length,17);assert.equal(refs.filter(row=>row.branch==='current').length,17);
  assert.equal(m.verifyMaintenanceProposal(f.root,complete),true);
  for(const [owner,binding]of roles){
   const raw=fs.readFileSync(path.join(f.root,owner),'utf8'),line='const '+binding+' = '+JSON.stringify([pair])+';';
   assert.equal(raw.split(line).length,2);
   const variants=[
    raw+'\nconst '+binding+' = [];\n',
    raw.replace(line,'const '+binding+' = '+JSON.stringify([pair,pair])+';'),
    raw.replace(line,'const '+binding+' = '+JSON.stringify([{base,current:{...current,path:'packages/contracts/src/Other.ts'}}])+';'),
    raw.replace(line,'const '+binding+' = '+JSON.stringify([{...pair,extra:true}])+';'),
    raw.replace(line,'const '+binding+' = '+JSON.stringify([{base,current:{...current,sha256:'invalid'}}])+';')
   ];
   for(const altered of variants){
    f.put(owner,raw);const baseline=collect();assert.equal(m.verifyMaintenanceProposal(f.root,baseline),true);
    f.put(owner,altered);assert.throws(collect);assert.throws(()=>m.verifyMaintenanceProposal(f.root,baseline));
    f.put(owner,raw);assert.equal(m.verifyMaintenanceProposal(f.root,baseline),true);
   }
  }
  for(const owner of owners){
   const raw=fs.readFileSync(path.join(f.root,owner),'utf8'),line='const '+graphBinding+' = '+JSON.stringify([current])+';';
   for(const altered of [raw+'\nconst '+graphBinding+' = [];\n',raw.replace(line,'const '+graphBinding+' = '+JSON.stringify([current,current])+';')]){
    const baseline=collect();assert.equal(m.verifyMaintenanceProposal(f.root,baseline),true);
    f.put(owner,altered);assert.throws(collect);assert.throws(()=>m.verifyMaintenanceProposal(f.root,baseline));
    f.put(owner,raw);assert.equal(m.verifyMaintenanceProposal(f.root,baseline),true);
   }
  }
  const extra='packages/contracts/src/unregistered-m15.ts';f.put(extra,'export {};\n');
  assert.throws(()=>m.verifyMaintenanceProposal(f.root,complete),/changed/);
  assert(collect().graphCoverage.every(row=>row.unlisted.some(pin=>pin.path===extra)));
  fs.unlinkSync(path.join(f.root,extra));assert.equal(m.verifyMaintenanceProposal(f.root,complete),true);
 }finally{f.close();}
});

// UNIT: genuine adapter bytes authenticate exceptional JSON extraction, not gate acceptance.
test('M1.5 maintenance reads six exact source owners and refuses unreviewed post-preamble extraction',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const expected=[{"path":"tools/spritesheet-boundary.mjs","bytes":185549,"sha256":"bfb4fb02f29cd66442a6f5124c1e209d87b305550ec5a48978c104f09163fb3f"},{"path":"tools/browser-png-boundary.mjs","bytes":191467,"sha256":"ce40f1363774bec52a053a5a0b2001aab2f3e4701b49e822e1a61097c7a4299d"},{"path":"tools/atlas-import-boundary.mjs","bytes":90249,"sha256":"4dee83aecfeb345647356ee3a8f5aef36e6b984333dcd8699ff40bfd7de6d581"},{"path":"tools/sequence-playback-boundary.mjs","bytes":43012,"sha256":"2d95757ddd9c3a6d1762fd44ba02461ef92504690f2e1e4c342a5f6d71f10a62"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":38244,"sha256":"1a4046d1bd5003714ca030ade053f412c98ca1f787d35357b823a12005e791a3"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":44823,"sha256":"690d56e1eb726d55990d6a8cd37b2215b1f3bb44430ca5c54abc67cdcffe8026"}];
  for(const pin of expected){
   const raw=fs.readFileSync(new URL('../../'+pin.path,import.meta.url));
   assert.deepEqual({path:pin.path,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')},pin);
   f.put(pin.path,raw);
  }
  for(const file of ['tools/bitmap-resource-slot-policy.json','tools/bitmap-binding-ticket-policy.json','tests/types/atlas-import-diagnostic-expectations.json','packages/engine/dist/Engine.d.ts','packages/contracts/package.json','packages/engine/package.json','packages/project/package.json'])f.put(file,fs.readFileSync(new URL('../../'+file,import.meta.url)));
  const collect=()=>m.prepareBaselineReview(f.root),baseline=collect();
  assert.equal(baseline.status,'review-required');
  const graphs=baseline.declarations.filter(row=>row.binding==='m15ResourceRecoveryGraphSuccessor');
  assert.equal(graphs.length,3);assert(graphs.every(row=>row.rows.length===98));
  const newPairs=baseline.successorPairs.filter(row=>row.binding.startsWith('m15'));
  assert.equal(newPairs.length,17);assert.equal(newPairs.reduce((sum,row)=>sum+row.rows.length,0),52);
  assert(newPairs.filter(row=>row.binding.startsWith('m15Resource')).every(row=>row.rows.every(value=>value.identity==='current')));
  for(const row of newPairs.filter(row=>row.binding==='m15InterfaceProjectedSuccessor')){
   assert.equal(row.comparison,'transformed-pair-raw-observation-only');assert.equal(row.rows[0].identity,'neither');
   assert.equal(row.rows[0].current.bytes,4824);
  }
  assert.equal(m.verifyMaintenanceProposal(f.root,baseline),true);
  for(const pin of expected){
   const raw=fs.readFileSync(path.join(f.root,pin.path),'utf8');
   // Ordinary preamble parsing remains allowed; any byte drift still invalidates the saved proposal.
   f.put(pin.path,raw+'\n// unreviewed source drift\n');assert.throws(()=>m.verifyMaintenanceProposal(f.root,baseline));
   f.put(pin.path,raw);assert.equal(m.verifyMaintenanceProposal(f.root,baseline),true);
   const binding=pin.path.includes('sequence-playback')?'m15SequenceInterfaceSuccessor':pin.path.includes('bitmap-')?'m15InterfaceRawSuccessor':'m15ResourceRecoveryGraphSuccessor';
   const anchor='const '+binding+' = ';assert.equal(raw.split(anchor).length,2);
   f.put(pin.path,raw.replace(anchor,'const unreviewedPrefix = /m15/;\n'+anchor));
   assert.throws(collect,/Unsupported declaration preamble/);assert.throws(()=>m.verifyMaintenanceProposal(f.root,baseline));
   f.put(pin.path,raw);assert.equal(m.verifyMaintenanceProposal(f.root,baseline),true);
  }
 }finally{f.close();}
});

// UNIT: genuine complete source revisions; no strict gate or compiler is executed.
test('M1.5 inline maintenance preserves delegate and scene revisions with exact historical inverses',async()=>{
 const m=await compilerTool(),f=inlineCompilerFixture({m15:true});try{
  const file='tools/check-types.mjs',raw=fs.readFileSync(path.join(f.root,file)),history=m15InlineGateHistory(raw);
  assert(history.scene&&history.delegate);assert.deepEqual(history.scene,raw);
  const collect=()=>m.prepareCompilerReview(f.root,{inlinePolicies:true});
  const stages=[['m13','current'],['m14','m14-current'],['delegate','m15-delegate-current'],['scene','m15-scene-current']];
  let original=null;
  for(const [stage,selection]of stages){
   f.put(file,history[stage]);const p=collect(),revision=p.inlinePolicies.sourceRevisions.find(row=>row.current.path===file);
   assert.equal(revision.selection,selection);assert.equal(revision.admission,'not-evaluated');
   assert.deepEqual(revision.successor,{path:file,...history.pins.m13});assert.deepEqual(revision.m14Successor,{path:file,...history.pins.m14});
   assert.deepEqual(revision.m15DelegateSuccessor,{path:file,...history.pins.delegate});assert.deepEqual(revision.m15SceneSuccessor,{path:file,...history.pins.scene});
   const literals=p.inlinePolicies.literals.filter(row=>row.owner===file).map(({binding,bytes,sha256})=>({binding,bytes,sha256})),declarations=p.declarations.filter(row=>row.owner===file);
   if(original===null)original={literals,declarations};else assert.deepEqual({literals,declarations},original);
   for(const row of p.inlinePolicies.literals.filter(row=>row.owner===file)){const value=history[stage].subarray(row.startByte,row.endByte);assert.equal(value.length,row.bytes);assert.equal(createHash('sha256').update(value).digest('hex'),row.sha256);}
   assert.equal(m.verifyCompilerProposal(f.root,p,{inlinePolicies:true}).status,'current-inputs');
  }
  f.put(file,raw);const baseline=collect(),text=raw.toString();
  const variants=[
   Buffer.concat([raw,Buffer.from("await import('./resource-recovery-types.mjs');\n")]),
   Buffer.from(text.replace("await import('./resource-recovery-types.mjs');","await import('./resource-recovery-typez.mjs');")),
   Buffer.from(text.replace('"name":"m15-browser-dom-01"','"name":"m15-browser-dom-XX"')),
   Buffer.from(text.replace('sharedFrameUpload.d.ts','sharedFrameUploaz.d.ts')),
   Buffer.concat([raw,Buffer.from('// unreviewed inline scene drift\n')])
  ];
  for(const altered of variants){
   assert.notDeepEqual(altered,raw);f.put(file,raw);const before=collect(),plain=m.prepareCompilerReview(f.root);
   assert.equal(m.verifyCompilerProposal(f.root,before,{inlinePolicies:true}).status,'current-inputs');
   try{
    f.put(file,altered);assert.throws(collect,/Unreviewed inline policy source: tools\/check-types\.mjs/);
    assert.throws(()=>m.verifyCompilerProposal(f.root,before,{inlinePolicies:true}));assert.throws(()=>m.verifyCompilerProposal(f.root,plain),/changed/);
   }finally{
    f.put(file,raw);assert.deepEqual(fs.readFileSync(path.join(f.root,file)),raw);assert.equal(m.verifyCompilerProposal(f.root,before,{inlinePolicies:true}).status,'current-inputs');assert.deepEqual(collect(),before);
   }
  }
  assert.equal(m.verifyCompilerProposal(f.root,baseline,{inlinePolicies:true}).status,'current-inputs');
 }finally{f.close();}
});
