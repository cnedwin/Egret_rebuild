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


// M3.1 authenticates exact current bytes, then reconstructs the complete retained fixtures.
const m22SequenceSourceHistory = [{"path":"tools/spritesheet-boundary.mjs","predecessor":{"path":"tools/spritesheet-boundary.mjs","bytes":220067,"sha256":"b534701cdbcd7d0ef14019005234d29e69d5686999450654929b4524d09068b1"},"current":{"path":"tools/spritesheet-boundary.mjs","bytes":227274,"sha256":"afb93b0583b925d928ccc8ae7cdb44ac3202a39c0eddb3e8fc1f11e17f89218a"},"inverse":[{"from":"function m31UiPackageSuccessor(expected,raw){\n if(m22SequencePackageSuccessor(expected,raw))return true;","to":"function m31UiPackageSuccessor(expected,raw){"},{"from":"  graph=m31UiGraph(graph,present);\n  graph=m22SequenceGraph(graph,present);","to":"  graph=m31UiGraph(graph,present);"}],"block":"// M22-SEQUENCE-SUCCESSOR-BEGIN\n// Exact optional sequence profile; preceding source/package groups remain immutable.\nconst m22SequencePackagePairs = [{\"base\":{\"path\":\"packages/engine/package.json\",\"bytes\":2591,\"sha256\":\"817ff4de665885cae85bb3563aeb80f2955eda5c9fda3d0954e1a0a7c513bcc5\"},\"current\":{\"path\":\"packages/engine/package.json\",\"bytes\":2709,\"sha256\":\"3fba4431f23b5ccb6da6f13a023ecd5229550f1ca8ead591521e69eeb3960fa9\"}}];\nconst m22SequenceSourcePairs = [{\"base\":{\"path\":\"packages/engine/src/Engine.ts\",\"bytes\":25315,\"sha256\":\"ad13f34fd2229c081dd185322918a0043624eed36a8a06f69d7915991aa2110d\"},\"current\":{\"path\":\"packages/engine/src/Engine.ts\",\"bytes\":26196,\"sha256\":\"8a97531660d2d7d748574492b14fdd53e3a1a49af65fa6003cf4d3bfdb8e9653\"}},{\"base\":{\"path\":\"packages/engine/dist/Engine.js\",\"bytes\":22046,\"sha256\":\"42ea7f41b79061115a2ed3ac9312163201ca0a942627c8279b3484bf5a9b5239\"},\"current\":{\"path\":\"packages/engine/dist/Engine.js\",\"bytes\":22833,\"sha256\":\"115934363fe32ef2ed8f8279a4c04595155c2f664d8cc62dd54fff10ecebe822\"}},{\"base\":{\"path\":\"packages/engine/src/sequencePlayback.ts\",\"bytes\":13644,\"sha256\":\"dd72d68e12037cbfe4fb47d20e3133ed07ec1af14f88cb76bab1d3241a35c4f6\"},\"current\":{\"path\":\"packages/engine/src/sequencePlayback.ts\",\"bytes\":13879,\"sha256\":\"8673bd380e3c0b4e2b535dc11f4698867d42bb6331788d37b65bf81f8754c4d6\"}},{\"base\":{\"path\":\"packages/engine/dist/sequencePlayback.js\",\"bytes\":12959,\"sha256\":\"d608693c9d2a6219feba89fe5e357e2a4325331417a6e66fa41692896ad3980d\"},\"current\":{\"path\":\"packages/engine/dist/sequencePlayback.js\",\"bytes\":13139,\"sha256\":\"2ff3c2561326a8d101720becf3a9444448e22c698f8c342222dd96335fbabe6e\"}},{\"base\":{\"path\":\"packages/engine/dist/sequencePlayback.d.ts\",\"bytes\":819,\"sha256\":\"acca205bef6b10938ea7ab0e6e3c8e193a161bfe8cc42efc5ace0e4476b007d7\"},\"current\":{\"path\":\"packages/engine/dist/sequencePlayback.d.ts\",\"bytes\":933,\"sha256\":\"4297f7a6267b3ff97aa61e0001321f9f20352334ab2862ca4bfb5fe1c08f853d\"}}];\nconst m22SequenceAdditionPins = [{\"path\":\"packages/engine/src/sequenceTargetClaims.ts\",\"bytes\":1247,\"sha256\":\"77b7c2e73e1a4d8177607b3f63cac2f9414973ef46b327b0fd441a3f0a2a77e8\"},{\"path\":\"packages/engine/dist/sequenceTargetClaims.js\",\"bytes\":993,\"sha256\":\"de59c8d9d4057d7755da0756f835d316c64149330a8c7359cb6f9ec01d18b6ab\"},{\"path\":\"packages/engine/dist/sequenceTargetClaims.d.ts\",\"bytes\":465,\"sha256\":\"e05aab88aee6e174ae1f1d6dce46c76beaa8ae91dd18460e88b190089687550f\"},{\"path\":\"packages/engine/src/internal/sequenceControllerFactoryState.ts\",\"bytes\":4605,\"sha256\":\"a35c4bad63e15b8cd598f36836232dab8eeec87f65da2ebf1c9cbd972d073003\"},{\"path\":\"packages/engine/dist/internal/sequenceControllerFactoryState.js\",\"bytes\":3344,\"sha256\":\"cdd2354efcfa58e4fcfe83705c123494b0a358a518a8c47f646f7becc8f63aa9\"},{\"path\":\"packages/engine/dist/internal/sequenceControllerFactoryState.d.ts\",\"bytes\":1744,\"sha256\":\"d39891b4bbe7a78b221e780d83235880d4ea9c294002d421dc3e56fe74e5117e\"},{\"path\":\"packages/engine/src/animation/index.ts\",\"bytes\":425,\"sha256\":\"351f9bbdaa0f8d88accc0425fa1d6a4e330cd403b196026661e712d089ce3121\"},{\"path\":\"packages/engine/dist/animation/index.js\",\"bytes\":243,\"sha256\":\"a719aaf4422166978d12d9502a0a785582b675bc5629aec1c0bcad00282158d0\"},{\"path\":\"packages/engine/dist/animation/index.d.ts\",\"bytes\":421,\"sha256\":\"0ced976c4ae8f130974c7444135a8047fa98e3d908746fcf9c5a7ccf4ca33c33\"},{\"path\":\"packages/engine/src/animation/sequenceController.ts\",\"bytes\":20858,\"sha256\":\"e32359222216a0ff7592bbc0077249eaa38ded2330c38b4aed781835fe81e7d2\"},{\"path\":\"packages/engine/dist/animation/sequenceController.js\",\"bytes\":19724,\"sha256\":\"8735c09f8cef7de32738eedbb80f1df4774b39811e73b265a96130e4bcd42d85\"},{\"path\":\"packages/engine/dist/animation/sequenceController.d.ts\",\"bytes\":500,\"sha256\":\"81238f93ac7ddc3b73a783a05fb3a3493d806f2087a7957c9f865fecf5fc0433\"},{\"path\":\"packages/engine/src/animation/sequenceCoordinator.ts\",\"bytes\":4855,\"sha256\":\"d9c9c921f2280b0185a2621937a6f1862e0aea2a57d2a86301fabd409663b030\"},{\"path\":\"packages/engine/dist/animation/sequenceCoordinator.js\",\"bytes\":4402,\"sha256\":\"1dd7ef1e24009ef3b824a8533d41c3b72a2e9f9da7e9b57e1849a840f6084242\"},{\"path\":\"packages/engine/dist/animation/sequenceCoordinator.d.ts\",\"bytes\":1430,\"sha256\":\"e11b32113719de6259017004b7d0397dc0b4fafcef6ed057e98b2a3c8ef54180\"},{\"path\":\"packages/engine/src/animation/sequenceInput.ts\",\"bytes\":5039,\"sha256\":\"21f95b6bf8c67f931a0d5c94203e3e1d1e20c3e10c7d4304e01dfb96a75f8759\"},{\"path\":\"packages/engine/dist/animation/sequenceInput.js\",\"bytes\":4489,\"sha256\":\"dab5a07146c918d3d5eae6af91987f769dd242426e1218718ac7db9de5814c71\"},{\"path\":\"packages/engine/dist/animation/sequenceInput.d.ts\",\"bytes\":941,\"sha256\":\"26a62e81531745b2f3cbcdd505e4b381730495320857587d3cdb5efba2ab0f13\"},{\"path\":\"packages/engine/src/animation/sequenceMath.ts\",\"bytes\":7794,\"sha256\":\"1d74ee94266db45f27ce1e8e9bd24126a52a66a463e2f7c6a0817474471cbdde\"},{\"path\":\"packages/engine/dist/animation/sequenceMath.js\",\"bytes\":6947,\"sha256\":\"25055c262dbc31ded844c872063ebb979f4847921363645a6bb1f388f90cc43d\"},{\"path\":\"packages/engine/dist/animation/sequenceMath.d.ts\",\"bytes\":1433,\"sha256\":\"a48443c71b853dc719ca1ef93c5b21d1f3fe3beb176009dac0ec7927585cce65\"},{\"path\":\"packages/engine/src/animation/types.ts\",\"bytes\":2169,\"sha256\":\"122b1131210ecba97ff41f1c9520afe0be9c26d4ae2b95207270c21dd4687a20\"},{\"path\":\"packages/engine/dist/animation/types.js\",\"bytes\":44,\"sha256\":\"01ae2a5b120382f9a648ced7ee8507493a134f216d100fc61600c6c9738235d2\"},{\"path\":\"packages/engine/dist/animation/types.d.ts\",\"bytes\":2318,\"sha256\":\"4c5c89a2959326bdf35fd897aae7dd91181a79fd2e8ca4d1e17c27285d25db6e\"}];\nfunction m22SequenceGraph(base,present){\n if(!m22SequenceAdditionPins.some(row=>present.has(row.path)))return base;\n const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),paths=new Set(base.map(row=>row.path));\n if(base.length!==729||m22SequenceSourcePairs.length!==5||m22SequenceAdditionPins.length!==24\n  ||m22SequenceSourcePairs.some(pair=>pair.base.path!==pair.current.path||!base.some(row=>same(row,pair.base)))\n  ||m22SequenceAdditionPins.some(row=>paths.has(row.path))||new Set([...paths,...m22SequenceAdditionPins.map(row=>row.path)]).size!==base.length+24)throw Error('Invalid finite M2.2 sequence source group');\n return [...base.map(row=>m22SequenceSourcePairs.find(pair=>same(pair.base,row))?.current??row),...m22SequenceAdditionPins];\n}\nfunction m22SequencePackageSuccessor(expected,raw){\n const pair=m22SequencePackagePairs.find(pair=>pair.base.path===expected?.path),digest=raw=>createHash('sha256').update(raw).digest('hex');\n if(!pair||raw.length!==pair.current.bytes||digest(raw)!==pair.current.sha256)return false;\n const value=JSON.parse(raw.toString('utf8'));\n if(JSON.stringify(value.exports['./animation'])!==JSON.stringify({types:'./dist/animation/index.d.ts',import:'./dist/animation/index.js'}))return false;\n delete value.exports['./animation'];const previous=Buffer.from(JSON.stringify(value,null,2)+'\\n');\n if(previous.length!==pair.base.bytes||digest(previous)!==pair.base.sha256)return false;\n return JSON.stringify(expected)===JSON.stringify(pair.base)||m31UiPackageSuccessor(expected,previous);\n}\n// M22-SEQUENCE-SUCCESSOR-END\n\n"},{"path":"tools/sequence-playback-boundary.mjs","predecessor":{"path":"tools/sequence-playback-boundary.mjs","bytes":48793,"sha256":"fa09b4b2acaca3c70f0b4583b34dae3cf7a12b5de9fe754ee8bfe9815dca85dc"},"current":{"path":"tools/sequence-playback-boundary.mjs","bytes":51869,"sha256":"6339f84311f678d86d9996006a9b9435e8ddc49755e97ec6dc21a9e3794dd0ec"},"inverse":[{"from":"function m31UiPackageSuccessor(expected,raw){\n if(m22SequencePackageSuccessor(expected,raw))return true;","to":"function m31UiPackageSuccessor(expected,raw){"},{"from":"  pin = m31UiSourcePairs.find(pair=>JSON.stringify(pair.base)===JSON.stringify(pin))?.current??pin;\n  pin = m22SequenceSourcePairs.find(pair=>JSON.stringify(pair.base)===JSON.stringify(pin))?.current??pin;","to":"  pin = m31UiSourcePairs.find(pair=>JSON.stringify(pair.base)===JSON.stringify(pin))?.current??pin;"},{"from":"    if (!['@egret/contracts', '@egret/runtime', './gameClockTypes.js', './sequencePlaybackTypes.js'].includes(tokens[index + 1].value) && !(['packages/engine/src/sequencePlayback.ts','packages/engine/dist/sequencePlayback.d.ts'].includes(file)&&tokens[index + 1].value==='./sequenceTargetClaims.js'))","to":"    if (!['@egret/contracts', '@egret/runtime', './gameClockTypes.js', './sequencePlaybackTypes.js'].includes(tokens[index + 1].value))"}],"block":"// M22-SEQUENCE-SUCCESSOR-BEGIN\n// Exact optional sequence profile; preceding source/package groups remain immutable.\nconst m22SequencePackagePairs = [{\"base\":{\"path\":\"packages/engine/package.json\",\"bytes\":2591,\"sha256\":\"817ff4de665885cae85bb3563aeb80f2955eda5c9fda3d0954e1a0a7c513bcc5\"},\"current\":{\"path\":\"packages/engine/package.json\",\"bytes\":2709,\"sha256\":\"3fba4431f23b5ccb6da6f13a023ecd5229550f1ca8ead591521e69eeb3960fa9\"}}];\nconst m22SequenceSourcePairs = [{\"base\":{\"path\":\"packages/engine/src/Engine.ts\",\"bytes\":25315,\"sha256\":\"ad13f34fd2229c081dd185322918a0043624eed36a8a06f69d7915991aa2110d\"},\"current\":{\"path\":\"packages/engine/src/Engine.ts\",\"bytes\":26196,\"sha256\":\"8a97531660d2d7d748574492b14fdd53e3a1a49af65fa6003cf4d3bfdb8e9653\"}},{\"base\":{\"path\":\"packages/engine/dist/Engine.js\",\"bytes\":22046,\"sha256\":\"42ea7f41b79061115a2ed3ac9312163201ca0a942627c8279b3484bf5a9b5239\"},\"current\":{\"path\":\"packages/engine/dist/Engine.js\",\"bytes\":22833,\"sha256\":\"115934363fe32ef2ed8f8279a4c04595155c2f664d8cc62dd54fff10ecebe822\"}},{\"base\":{\"path\":\"packages/engine/src/sequencePlayback.ts\",\"bytes\":13644,\"sha256\":\"dd72d68e12037cbfe4fb47d20e3133ed07ec1af14f88cb76bab1d3241a35c4f6\"},\"current\":{\"path\":\"packages/engine/src/sequencePlayback.ts\",\"bytes\":13879,\"sha256\":\"8673bd380e3c0b4e2b535dc11f4698867d42bb6331788d37b65bf81f8754c4d6\"}},{\"base\":{\"path\":\"packages/engine/dist/sequencePlayback.js\",\"bytes\":12959,\"sha256\":\"d608693c9d2a6219feba89fe5e357e2a4325331417a6e66fa41692896ad3980d\"},\"current\":{\"path\":\"packages/engine/dist/sequencePlayback.js\",\"bytes\":13139,\"sha256\":\"2ff3c2561326a8d101720becf3a9444448e22c698f8c342222dd96335fbabe6e\"}},{\"base\":{\"path\":\"packages/engine/dist/sequencePlayback.d.ts\",\"bytes\":819,\"sha256\":\"acca205bef6b10938ea7ab0e6e3c8e193a161bfe8cc42efc5ace0e4476b007d7\"},\"current\":{\"path\":\"packages/engine/dist/sequencePlayback.d.ts\",\"bytes\":933,\"sha256\":\"4297f7a6267b3ff97aa61e0001321f9f20352334ab2862ca4bfb5fe1c08f853d\"}}];\nfunction m22SequencePackageSuccessor(expected,raw){\n const pair=m22SequencePackagePairs.find(pair=>pair.base.path===expected?.path),digest=raw=>createHash('sha256').update(raw).digest('hex');\n if(!pair||raw.length!==pair.current.bytes||digest(raw)!==pair.current.sha256)return false;\n const value=JSON.parse(raw.toString('utf8'));\n if(JSON.stringify(value.exports['./animation'])!==JSON.stringify({types:'./dist/animation/index.d.ts',import:'./dist/animation/index.js'}))return false;\n delete value.exports['./animation'];const previous=Buffer.from(JSON.stringify(value,null,2)+'\\n');\n if(previous.length!==pair.base.bytes||digest(previous)!==pair.base.sha256)return false;\n return JSON.stringify(expected)===JSON.stringify(pair.base)||m31UiPackageSuccessor(expected,previous);\n}\n// M22-SEQUENCE-SUCCESSOR-END\n\n"},{"path":"tools/browser-png-boundary.mjs","predecessor":{"path":"tools/browser-png-boundary.mjs","bytes":227685,"sha256":"dee49b3e1128b22bd999b367b178977825a0658744ed98f3893100ba8144093e"},"current":{"path":"tools/browser-png-boundary.mjs","bytes":235146,"sha256":"3e9a8dafeb073c2175517ae00d5d5dcc0cc03de70a720899cc89b056bf5950d6"},"inverse":[{"from":"function m31UiPackageSuccessor(expected,raw){\n if(m22SequencePackageSuccessor(expected,raw))return true;","to":"function m31UiPackageSuccessor(expected,raw){"},{"from":"  graph=m31UiGraph(graph,present);\n  graph=m22SequenceGraph(graph,present);","to":"  graph=m31UiGraph(graph,present);"},{"from":"    // Exact semantic projection preserves the original export/DAG refusal order.\n    if(name==='engine'&&equal(value.exports?.['./animation'],{types:'./dist/animation/index.d.ts',import:'./dist/animation/index.js'}))delete value.exports['./animation'];\n    // Preserve assigned export/DAG refusal precedence; complete raw package admission stays below.","to":"    // Preserve assigned export/DAG refusal precedence; complete raw package admission stays below."}],"block":"// M22-SEQUENCE-SUCCESSOR-BEGIN\n// Exact optional sequence profile; preceding source/package groups remain immutable.\nconst m22SequencePackagePairs = [{\"base\":{\"path\":\"packages/engine/package.json\",\"bytes\":2591,\"sha256\":\"817ff4de665885cae85bb3563aeb80f2955eda5c9fda3d0954e1a0a7c513bcc5\"},\"current\":{\"path\":\"packages/engine/package.json\",\"bytes\":2709,\"sha256\":\"3fba4431f23b5ccb6da6f13a023ecd5229550f1ca8ead591521e69eeb3960fa9\"}}];\nconst m22SequenceSourcePairs = [{\"base\":{\"path\":\"packages/engine/src/Engine.ts\",\"bytes\":25315,\"sha256\":\"ad13f34fd2229c081dd185322918a0043624eed36a8a06f69d7915991aa2110d\"},\"current\":{\"path\":\"packages/engine/src/Engine.ts\",\"bytes\":26196,\"sha256\":\"8a97531660d2d7d748574492b14fdd53e3a1a49af65fa6003cf4d3bfdb8e9653\"}},{\"base\":{\"path\":\"packages/engine/dist/Engine.js\",\"bytes\":22046,\"sha256\":\"42ea7f41b79061115a2ed3ac9312163201ca0a942627c8279b3484bf5a9b5239\"},\"current\":{\"path\":\"packages/engine/dist/Engine.js\",\"bytes\":22833,\"sha256\":\"115934363fe32ef2ed8f8279a4c04595155c2f664d8cc62dd54fff10ecebe822\"}},{\"base\":{\"path\":\"packages/engine/src/sequencePlayback.ts\",\"bytes\":13644,\"sha256\":\"dd72d68e12037cbfe4fb47d20e3133ed07ec1af14f88cb76bab1d3241a35c4f6\"},\"current\":{\"path\":\"packages/engine/src/sequencePlayback.ts\",\"bytes\":13879,\"sha256\":\"8673bd380e3c0b4e2b535dc11f4698867d42bb6331788d37b65bf81f8754c4d6\"}},{\"base\":{\"path\":\"packages/engine/dist/sequencePlayback.js\",\"bytes\":12959,\"sha256\":\"d608693c9d2a6219feba89fe5e357e2a4325331417a6e66fa41692896ad3980d\"},\"current\":{\"path\":\"packages/engine/dist/sequencePlayback.js\",\"bytes\":13139,\"sha256\":\"2ff3c2561326a8d101720becf3a9444448e22c698f8c342222dd96335fbabe6e\"}},{\"base\":{\"path\":\"packages/engine/dist/sequencePlayback.d.ts\",\"bytes\":819,\"sha256\":\"acca205bef6b10938ea7ab0e6e3c8e193a161bfe8cc42efc5ace0e4476b007d7\"},\"current\":{\"path\":\"packages/engine/dist/sequencePlayback.d.ts\",\"bytes\":933,\"sha256\":\"4297f7a6267b3ff97aa61e0001321f9f20352334ab2862ca4bfb5fe1c08f853d\"}}];\nconst m22SequenceAdditionPins = [{\"path\":\"packages/engine/src/sequenceTargetClaims.ts\",\"bytes\":1247,\"sha256\":\"77b7c2e73e1a4d8177607b3f63cac2f9414973ef46b327b0fd441a3f0a2a77e8\"},{\"path\":\"packages/engine/dist/sequenceTargetClaims.js\",\"bytes\":993,\"sha256\":\"de59c8d9d4057d7755da0756f835d316c64149330a8c7359cb6f9ec01d18b6ab\"},{\"path\":\"packages/engine/dist/sequenceTargetClaims.d.ts\",\"bytes\":465,\"sha256\":\"e05aab88aee6e174ae1f1d6dce46c76beaa8ae91dd18460e88b190089687550f\"},{\"path\":\"packages/engine/src/internal/sequenceControllerFactoryState.ts\",\"bytes\":4605,\"sha256\":\"a35c4bad63e15b8cd598f36836232dab8eeec87f65da2ebf1c9cbd972d073003\"},{\"path\":\"packages/engine/dist/internal/sequenceControllerFactoryState.js\",\"bytes\":3344,\"sha256\":\"cdd2354efcfa58e4fcfe83705c123494b0a358a518a8c47f646f7becc8f63aa9\"},{\"path\":\"packages/engine/dist/internal/sequenceControllerFactoryState.d.ts\",\"bytes\":1744,\"sha256\":\"d39891b4bbe7a78b221e780d83235880d4ea9c294002d421dc3e56fe74e5117e\"},{\"path\":\"packages/engine/src/animation/index.ts\",\"bytes\":425,\"sha256\":\"351f9bbdaa0f8d88accc0425fa1d6a4e330cd403b196026661e712d089ce3121\"},{\"path\":\"packages/engine/dist/animation/index.js\",\"bytes\":243,\"sha256\":\"a719aaf4422166978d12d9502a0a785582b675bc5629aec1c0bcad00282158d0\"},{\"path\":\"packages/engine/dist/animation/index.d.ts\",\"bytes\":421,\"sha256\":\"0ced976c4ae8f130974c7444135a8047fa98e3d908746fcf9c5a7ccf4ca33c33\"},{\"path\":\"packages/engine/src/animation/sequenceController.ts\",\"bytes\":20858,\"sha256\":\"e32359222216a0ff7592bbc0077249eaa38ded2330c38b4aed781835fe81e7d2\"},{\"path\":\"packages/engine/dist/animation/sequenceController.js\",\"bytes\":19724,\"sha256\":\"8735c09f8cef7de32738eedbb80f1df4774b39811e73b265a96130e4bcd42d85\"},{\"path\":\"packages/engine/dist/animation/sequenceController.d.ts\",\"bytes\":500,\"sha256\":\"81238f93ac7ddc3b73a783a05fb3a3493d806f2087a7957c9f865fecf5fc0433\"},{\"path\":\"packages/engine/src/animation/sequenceCoordinator.ts\",\"bytes\":4855,\"sha256\":\"d9c9c921f2280b0185a2621937a6f1862e0aea2a57d2a86301fabd409663b030\"},{\"path\":\"packages/engine/dist/animation/sequenceCoordinator.js\",\"bytes\":4402,\"sha256\":\"1dd7ef1e24009ef3b824a8533d41c3b72a2e9f9da7e9b57e1849a840f6084242\"},{\"path\":\"packages/engine/dist/animation/sequenceCoordinator.d.ts\",\"bytes\":1430,\"sha256\":\"e11b32113719de6259017004b7d0397dc0b4fafcef6ed057e98b2a3c8ef54180\"},{\"path\":\"packages/engine/src/animation/sequenceInput.ts\",\"bytes\":5039,\"sha256\":\"21f95b6bf8c67f931a0d5c94203e3e1d1e20c3e10c7d4304e01dfb96a75f8759\"},{\"path\":\"packages/engine/dist/animation/sequenceInput.js\",\"bytes\":4489,\"sha256\":\"dab5a07146c918d3d5eae6af91987f769dd242426e1218718ac7db9de5814c71\"},{\"path\":\"packages/engine/dist/animation/sequenceInput.d.ts\",\"bytes\":941,\"sha256\":\"26a62e81531745b2f3cbcdd505e4b381730495320857587d3cdb5efba2ab0f13\"},{\"path\":\"packages/engine/src/animation/sequenceMath.ts\",\"bytes\":7794,\"sha256\":\"1d74ee94266db45f27ce1e8e9bd24126a52a66a463e2f7c6a0817474471cbdde\"},{\"path\":\"packages/engine/dist/animation/sequenceMath.js\",\"bytes\":6947,\"sha256\":\"25055c262dbc31ded844c872063ebb979f4847921363645a6bb1f388f90cc43d\"},{\"path\":\"packages/engine/dist/animation/sequenceMath.d.ts\",\"bytes\":1433,\"sha256\":\"a48443c71b853dc719ca1ef93c5b21d1f3fe3beb176009dac0ec7927585cce65\"},{\"path\":\"packages/engine/src/animation/types.ts\",\"bytes\":2169,\"sha256\":\"122b1131210ecba97ff41f1c9520afe0be9c26d4ae2b95207270c21dd4687a20\"},{\"path\":\"packages/engine/dist/animation/types.js\",\"bytes\":44,\"sha256\":\"01ae2a5b120382f9a648ced7ee8507493a134f216d100fc61600c6c9738235d2\"},{\"path\":\"packages/engine/dist/animation/types.d.ts\",\"bytes\":2318,\"sha256\":\"4c5c89a2959326bdf35fd897aae7dd91181a79fd2e8ca4d1e17c27285d25db6e\"}];\nfunction m22SequenceGraph(base,present){\n if(!m22SequenceAdditionPins.some(row=>present.has(row.path)))return base;\n const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),paths=new Set(base.map(row=>row.path));\n if(base.length!==729||m22SequenceSourcePairs.length!==5||m22SequenceAdditionPins.length!==24\n  ||m22SequenceSourcePairs.some(pair=>pair.base.path!==pair.current.path||!base.some(row=>same(row,pair.base)))\n  ||m22SequenceAdditionPins.some(row=>paths.has(row.path))||new Set([...paths,...m22SequenceAdditionPins.map(row=>row.path)]).size!==base.length+24)throw Error('Invalid finite M2.2 sequence source group');\n return [...base.map(row=>m22SequenceSourcePairs.find(pair=>same(pair.base,row))?.current??row),...m22SequenceAdditionPins];\n}\nfunction m22SequencePackageSuccessor(expected,raw){\n const pair=m22SequencePackagePairs.find(pair=>pair.base.path===expected?.path),digest=raw=>createHash('sha256').update(raw).digest('hex');\n if(!pair||raw.length!==pair.current.bytes||digest(raw)!==pair.current.sha256)return false;\n const value=JSON.parse(raw.toString('utf8'));\n if(JSON.stringify(value.exports['./animation'])!==JSON.stringify({types:'./dist/animation/index.d.ts',import:'./dist/animation/index.js'}))return false;\n delete value.exports['./animation'];const previous=Buffer.from(JSON.stringify(value,null,2)+'\\n');\n if(previous.length!==pair.base.bytes||digest(previous)!==pair.base.sha256)return false;\n return JSON.stringify(expected)===JSON.stringify(pair.base)||m31UiPackageSuccessor(expected,previous);\n}\n// M22-SEQUENCE-SUCCESSOR-END\n\n"},{"path":"tools/bitmap-resource-slot-boundary.mjs","predecessor":{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":43941,"sha256":"d35fe029b5a4b94f7af3bbc151936a4c65d1bbb778dd412c48317156aaf57a67"},"current":{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":46820,"sha256":"14be583bc5e76198302e991fdbc7850ec9f01f368c385246946b3c16f14a43b4"},"inverse":[{"from":"function m31UiPackageSuccessor(expected,raw){\n if(m22SequencePackageSuccessor(expected,raw))return true;","to":"function m31UiPackageSuccessor(expected,raw){"},{"from":"pin=m31UiSourcePairs.find(pair=>equal(pair.base,pin))?.current??pin;pin=m22SequenceSourcePairs.find(pair=>equal(pair.base,pin))?.current??pin;","to":"pin=m31UiSourcePairs.find(pair=>equal(pair.base,pin))?.current??pin;"}],"block":"// M22-SEQUENCE-SUCCESSOR-BEGIN\n// Exact optional sequence profile; preceding source/package groups remain immutable.\nconst m22SequencePackagePairs = [{\"base\":{\"path\":\"packages/engine/package.json\",\"bytes\":2591,\"sha256\":\"817ff4de665885cae85bb3563aeb80f2955eda5c9fda3d0954e1a0a7c513bcc5\"},\"current\":{\"path\":\"packages/engine/package.json\",\"bytes\":2709,\"sha256\":\"3fba4431f23b5ccb6da6f13a023ecd5229550f1ca8ead591521e69eeb3960fa9\"}}];\nconst m22SequenceSourcePairs = [{\"base\":{\"path\":\"packages/engine/src/Engine.ts\",\"bytes\":25315,\"sha256\":\"ad13f34fd2229c081dd185322918a0043624eed36a8a06f69d7915991aa2110d\"},\"current\":{\"path\":\"packages/engine/src/Engine.ts\",\"bytes\":26196,\"sha256\":\"8a97531660d2d7d748574492b14fdd53e3a1a49af65fa6003cf4d3bfdb8e9653\"}},{\"base\":{\"path\":\"packages/engine/dist/Engine.js\",\"bytes\":22046,\"sha256\":\"42ea7f41b79061115a2ed3ac9312163201ca0a942627c8279b3484bf5a9b5239\"},\"current\":{\"path\":\"packages/engine/dist/Engine.js\",\"bytes\":22833,\"sha256\":\"115934363fe32ef2ed8f8279a4c04595155c2f664d8cc62dd54fff10ecebe822\"}},{\"base\":{\"path\":\"packages/engine/src/sequencePlayback.ts\",\"bytes\":13644,\"sha256\":\"dd72d68e12037cbfe4fb47d20e3133ed07ec1af14f88cb76bab1d3241a35c4f6\"},\"current\":{\"path\":\"packages/engine/src/sequencePlayback.ts\",\"bytes\":13879,\"sha256\":\"8673bd380e3c0b4e2b535dc11f4698867d42bb6331788d37b65bf81f8754c4d6\"}},{\"base\":{\"path\":\"packages/engine/dist/sequencePlayback.js\",\"bytes\":12959,\"sha256\":\"d608693c9d2a6219feba89fe5e357e2a4325331417a6e66fa41692896ad3980d\"},\"current\":{\"path\":\"packages/engine/dist/sequencePlayback.js\",\"bytes\":13139,\"sha256\":\"2ff3c2561326a8d101720becf3a9444448e22c698f8c342222dd96335fbabe6e\"}},{\"base\":{\"path\":\"packages/engine/dist/sequencePlayback.d.ts\",\"bytes\":819,\"sha256\":\"acca205bef6b10938ea7ab0e6e3c8e193a161bfe8cc42efc5ace0e4476b007d7\"},\"current\":{\"path\":\"packages/engine/dist/sequencePlayback.d.ts\",\"bytes\":933,\"sha256\":\"4297f7a6267b3ff97aa61e0001321f9f20352334ab2862ca4bfb5fe1c08f853d\"}}];\nfunction m22SequencePackageSuccessor(expected,raw){\n const pair=m22SequencePackagePairs.find(pair=>pair.base.path===expected?.path),digest=raw=>createHash('sha256').update(raw).digest('hex');\n if(!pair||raw.length!==pair.current.bytes||digest(raw)!==pair.current.sha256)return false;\n const value=JSON.parse(raw.toString('utf8'));\n if(JSON.stringify(value.exports['./animation'])!==JSON.stringify({types:'./dist/animation/index.d.ts',import:'./dist/animation/index.js'}))return false;\n delete value.exports['./animation'];const previous=Buffer.from(JSON.stringify(value,null,2)+'\\n');\n if(previous.length!==pair.base.bytes||digest(previous)!==pair.base.sha256)return false;\n return JSON.stringify(expected)===JSON.stringify(pair.base)||m31UiPackageSuccessor(expected,previous);\n}\n// M22-SEQUENCE-SUCCESSOR-END\n\n"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","predecessor":{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":50520,"sha256":"f35e0311de99c1fd8030a67631dcdadecd03423d9cb966d54099b6d7e5bf28f9"},"current":{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":53399,"sha256":"ed02a1ffc522b127ba6e070b11e8fc83e38c4c12f1c569cbf9a825bb0053e532"},"inverse":[{"from":"function m31UiPackageSuccessor(expected,raw){\n if(m22SequencePackageSuccessor(expected,raw))return true;","to":"function m31UiPackageSuccessor(expected,raw){"},{"from":"pin=m31UiSourcePairs.find(pair=>equal(pair.base,pin))?.current??pin;pin=m22SequenceSourcePairs.find(pair=>equal(pair.base,pin))?.current??pin;","to":"pin=m31UiSourcePairs.find(pair=>equal(pair.base,pin))?.current??pin;"}],"block":"// M22-SEQUENCE-SUCCESSOR-BEGIN\n// Exact optional sequence profile; preceding source/package groups remain immutable.\nconst m22SequencePackagePairs = [{\"base\":{\"path\":\"packages/engine/package.json\",\"bytes\":2591,\"sha256\":\"817ff4de665885cae85bb3563aeb80f2955eda5c9fda3d0954e1a0a7c513bcc5\"},\"current\":{\"path\":\"packages/engine/package.json\",\"bytes\":2709,\"sha256\":\"3fba4431f23b5ccb6da6f13a023ecd5229550f1ca8ead591521e69eeb3960fa9\"}}];\nconst m22SequenceSourcePairs = [{\"base\":{\"path\":\"packages/engine/src/Engine.ts\",\"bytes\":25315,\"sha256\":\"ad13f34fd2229c081dd185322918a0043624eed36a8a06f69d7915991aa2110d\"},\"current\":{\"path\":\"packages/engine/src/Engine.ts\",\"bytes\":26196,\"sha256\":\"8a97531660d2d7d748574492b14fdd53e3a1a49af65fa6003cf4d3bfdb8e9653\"}},{\"base\":{\"path\":\"packages/engine/dist/Engine.js\",\"bytes\":22046,\"sha256\":\"42ea7f41b79061115a2ed3ac9312163201ca0a942627c8279b3484bf5a9b5239\"},\"current\":{\"path\":\"packages/engine/dist/Engine.js\",\"bytes\":22833,\"sha256\":\"115934363fe32ef2ed8f8279a4c04595155c2f664d8cc62dd54fff10ecebe822\"}},{\"base\":{\"path\":\"packages/engine/src/sequencePlayback.ts\",\"bytes\":13644,\"sha256\":\"dd72d68e12037cbfe4fb47d20e3133ed07ec1af14f88cb76bab1d3241a35c4f6\"},\"current\":{\"path\":\"packages/engine/src/sequencePlayback.ts\",\"bytes\":13879,\"sha256\":\"8673bd380e3c0b4e2b535dc11f4698867d42bb6331788d37b65bf81f8754c4d6\"}},{\"base\":{\"path\":\"packages/engine/dist/sequencePlayback.js\",\"bytes\":12959,\"sha256\":\"d608693c9d2a6219feba89fe5e357e2a4325331417a6e66fa41692896ad3980d\"},\"current\":{\"path\":\"packages/engine/dist/sequencePlayback.js\",\"bytes\":13139,\"sha256\":\"2ff3c2561326a8d101720becf3a9444448e22c698f8c342222dd96335fbabe6e\"}},{\"base\":{\"path\":\"packages/engine/dist/sequencePlayback.d.ts\",\"bytes\":819,\"sha256\":\"acca205bef6b10938ea7ab0e6e3c8e193a161bfe8cc42efc5ace0e4476b007d7\"},\"current\":{\"path\":\"packages/engine/dist/sequencePlayback.d.ts\",\"bytes\":933,\"sha256\":\"4297f7a6267b3ff97aa61e0001321f9f20352334ab2862ca4bfb5fe1c08f853d\"}}];\nfunction m22SequencePackageSuccessor(expected,raw){\n const pair=m22SequencePackagePairs.find(pair=>pair.base.path===expected?.path),digest=raw=>createHash('sha256').update(raw).digest('hex');\n if(!pair||raw.length!==pair.current.bytes||digest(raw)!==pair.current.sha256)return false;\n const value=JSON.parse(raw.toString('utf8'));\n if(JSON.stringify(value.exports['./animation'])!==JSON.stringify({types:'./dist/animation/index.d.ts',import:'./dist/animation/index.js'}))return false;\n delete value.exports['./animation'];const previous=Buffer.from(JSON.stringify(value,null,2)+'\\n');\n if(previous.length!==pair.base.bytes||digest(previous)!==pair.base.sha256)return false;\n return JSON.stringify(expected)===JSON.stringify(pair.base)||m31UiPackageSuccessor(expected,previous);\n}\n// M22-SEQUENCE-SUCCESSOR-END\n\n"},{"path":"tools/atlas-import-boundary.mjs","predecessor":{"path":"tools/atlas-import-boundary.mjs","bytes":124821,"sha256":"d850cb52e476c323f63da1eca82a6e7e5bfda87a0ee80287dffab39a421595d4"},"current":{"path":"tools/atlas-import-boundary.mjs","bytes":132028,"sha256":"8db78b11545d57cb9d0d3a9980dd9ffe576f0f1361d8bca4f0560760f2750f37"},"inverse":[{"from":"function m31UiPackageSuccessor(expected,raw){\n if(m22SequencePackageSuccessor(expected,raw))return true;","to":"function m31UiPackageSuccessor(expected,raw){"},{"from":"  graph=m31UiGraph(graph,present);\n  graph=m22SequenceGraph(graph,present);","to":"  graph=m31UiGraph(graph,present);"}],"block":"// M22-SEQUENCE-SUCCESSOR-BEGIN\n// Exact optional sequence profile; preceding source/package groups remain immutable.\nconst m22SequencePackagePairs = [{\"base\":{\"path\":\"packages/engine/package.json\",\"bytes\":2591,\"sha256\":\"817ff4de665885cae85bb3563aeb80f2955eda5c9fda3d0954e1a0a7c513bcc5\"},\"current\":{\"path\":\"packages/engine/package.json\",\"bytes\":2709,\"sha256\":\"3fba4431f23b5ccb6da6f13a023ecd5229550f1ca8ead591521e69eeb3960fa9\"}}];\nconst m22SequenceSourcePairs = [{\"base\":{\"path\":\"packages/engine/src/Engine.ts\",\"bytes\":25315,\"sha256\":\"ad13f34fd2229c081dd185322918a0043624eed36a8a06f69d7915991aa2110d\"},\"current\":{\"path\":\"packages/engine/src/Engine.ts\",\"bytes\":26196,\"sha256\":\"8a97531660d2d7d748574492b14fdd53e3a1a49af65fa6003cf4d3bfdb8e9653\"}},{\"base\":{\"path\":\"packages/engine/dist/Engine.js\",\"bytes\":22046,\"sha256\":\"42ea7f41b79061115a2ed3ac9312163201ca0a942627c8279b3484bf5a9b5239\"},\"current\":{\"path\":\"packages/engine/dist/Engine.js\",\"bytes\":22833,\"sha256\":\"115934363fe32ef2ed8f8279a4c04595155c2f664d8cc62dd54fff10ecebe822\"}},{\"base\":{\"path\":\"packages/engine/src/sequencePlayback.ts\",\"bytes\":13644,\"sha256\":\"dd72d68e12037cbfe4fb47d20e3133ed07ec1af14f88cb76bab1d3241a35c4f6\"},\"current\":{\"path\":\"packages/engine/src/sequencePlayback.ts\",\"bytes\":13879,\"sha256\":\"8673bd380e3c0b4e2b535dc11f4698867d42bb6331788d37b65bf81f8754c4d6\"}},{\"base\":{\"path\":\"packages/engine/dist/sequencePlayback.js\",\"bytes\":12959,\"sha256\":\"d608693c9d2a6219feba89fe5e357e2a4325331417a6e66fa41692896ad3980d\"},\"current\":{\"path\":\"packages/engine/dist/sequencePlayback.js\",\"bytes\":13139,\"sha256\":\"2ff3c2561326a8d101720becf3a9444448e22c698f8c342222dd96335fbabe6e\"}},{\"base\":{\"path\":\"packages/engine/dist/sequencePlayback.d.ts\",\"bytes\":819,\"sha256\":\"acca205bef6b10938ea7ab0e6e3c8e193a161bfe8cc42efc5ace0e4476b007d7\"},\"current\":{\"path\":\"packages/engine/dist/sequencePlayback.d.ts\",\"bytes\":933,\"sha256\":\"4297f7a6267b3ff97aa61e0001321f9f20352334ab2862ca4bfb5fe1c08f853d\"}}];\nconst m22SequenceAdditionPins = [{\"path\":\"packages/engine/src/sequenceTargetClaims.ts\",\"bytes\":1247,\"sha256\":\"77b7c2e73e1a4d8177607b3f63cac2f9414973ef46b327b0fd441a3f0a2a77e8\"},{\"path\":\"packages/engine/dist/sequenceTargetClaims.js\",\"bytes\":993,\"sha256\":\"de59c8d9d4057d7755da0756f835d316c64149330a8c7359cb6f9ec01d18b6ab\"},{\"path\":\"packages/engine/dist/sequenceTargetClaims.d.ts\",\"bytes\":465,\"sha256\":\"e05aab88aee6e174ae1f1d6dce46c76beaa8ae91dd18460e88b190089687550f\"},{\"path\":\"packages/engine/src/internal/sequenceControllerFactoryState.ts\",\"bytes\":4605,\"sha256\":\"a35c4bad63e15b8cd598f36836232dab8eeec87f65da2ebf1c9cbd972d073003\"},{\"path\":\"packages/engine/dist/internal/sequenceControllerFactoryState.js\",\"bytes\":3344,\"sha256\":\"cdd2354efcfa58e4fcfe83705c123494b0a358a518a8c47f646f7becc8f63aa9\"},{\"path\":\"packages/engine/dist/internal/sequenceControllerFactoryState.d.ts\",\"bytes\":1744,\"sha256\":\"d39891b4bbe7a78b221e780d83235880d4ea9c294002d421dc3e56fe74e5117e\"},{\"path\":\"packages/engine/src/animation/index.ts\",\"bytes\":425,\"sha256\":\"351f9bbdaa0f8d88accc0425fa1d6a4e330cd403b196026661e712d089ce3121\"},{\"path\":\"packages/engine/dist/animation/index.js\",\"bytes\":243,\"sha256\":\"a719aaf4422166978d12d9502a0a785582b675bc5629aec1c0bcad00282158d0\"},{\"path\":\"packages/engine/dist/animation/index.d.ts\",\"bytes\":421,\"sha256\":\"0ced976c4ae8f130974c7444135a8047fa98e3d908746fcf9c5a7ccf4ca33c33\"},{\"path\":\"packages/engine/src/animation/sequenceController.ts\",\"bytes\":20858,\"sha256\":\"e32359222216a0ff7592bbc0077249eaa38ded2330c38b4aed781835fe81e7d2\"},{\"path\":\"packages/engine/dist/animation/sequenceController.js\",\"bytes\":19724,\"sha256\":\"8735c09f8cef7de32738eedbb80f1df4774b39811e73b265a96130e4bcd42d85\"},{\"path\":\"packages/engine/dist/animation/sequenceController.d.ts\",\"bytes\":500,\"sha256\":\"81238f93ac7ddc3b73a783a05fb3a3493d806f2087a7957c9f865fecf5fc0433\"},{\"path\":\"packages/engine/src/animation/sequenceCoordinator.ts\",\"bytes\":4855,\"sha256\":\"d9c9c921f2280b0185a2621937a6f1862e0aea2a57d2a86301fabd409663b030\"},{\"path\":\"packages/engine/dist/animation/sequenceCoordinator.js\",\"bytes\":4402,\"sha256\":\"1dd7ef1e24009ef3b824a8533d41c3b72a2e9f9da7e9b57e1849a840f6084242\"},{\"path\":\"packages/engine/dist/animation/sequenceCoordinator.d.ts\",\"bytes\":1430,\"sha256\":\"e11b32113719de6259017004b7d0397dc0b4fafcef6ed057e98b2a3c8ef54180\"},{\"path\":\"packages/engine/src/animation/sequenceInput.ts\",\"bytes\":5039,\"sha256\":\"21f95b6bf8c67f931a0d5c94203e3e1d1e20c3e10c7d4304e01dfb96a75f8759\"},{\"path\":\"packages/engine/dist/animation/sequenceInput.js\",\"bytes\":4489,\"sha256\":\"dab5a07146c918d3d5eae6af91987f769dd242426e1218718ac7db9de5814c71\"},{\"path\":\"packages/engine/dist/animation/sequenceInput.d.ts\",\"bytes\":941,\"sha256\":\"26a62e81531745b2f3cbcdd505e4b381730495320857587d3cdb5efba2ab0f13\"},{\"path\":\"packages/engine/src/animation/sequenceMath.ts\",\"bytes\":7794,\"sha256\":\"1d74ee94266db45f27ce1e8e9bd24126a52a66a463e2f7c6a0817474471cbdde\"},{\"path\":\"packages/engine/dist/animation/sequenceMath.js\",\"bytes\":6947,\"sha256\":\"25055c262dbc31ded844c872063ebb979f4847921363645a6bb1f388f90cc43d\"},{\"path\":\"packages/engine/dist/animation/sequenceMath.d.ts\",\"bytes\":1433,\"sha256\":\"a48443c71b853dc719ca1ef93c5b21d1f3fe3beb176009dac0ec7927585cce65\"},{\"path\":\"packages/engine/src/animation/types.ts\",\"bytes\":2169,\"sha256\":\"122b1131210ecba97ff41f1c9520afe0be9c26d4ae2b95207270c21dd4687a20\"},{\"path\":\"packages/engine/dist/animation/types.js\",\"bytes\":44,\"sha256\":\"01ae2a5b120382f9a648ced7ee8507493a134f216d100fc61600c6c9738235d2\"},{\"path\":\"packages/engine/dist/animation/types.d.ts\",\"bytes\":2318,\"sha256\":\"4c5c89a2959326bdf35fd897aae7dd91181a79fd2e8ca4d1e17c27285d25db6e\"}];\nfunction m22SequenceGraph(base,present){\n if(!m22SequenceAdditionPins.some(row=>present.has(row.path)))return base;\n const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),paths=new Set(base.map(row=>row.path));\n if(base.length!==731||m22SequenceSourcePairs.length!==5||m22SequenceAdditionPins.length!==24\n  ||m22SequenceSourcePairs.some(pair=>pair.base.path!==pair.current.path||!base.some(row=>same(row,pair.base)))\n  ||m22SequenceAdditionPins.some(row=>paths.has(row.path))||new Set([...paths,...m22SequenceAdditionPins.map(row=>row.path)]).size!==base.length+24)throw Error('Invalid finite M2.2 sequence source group');\n return [...base.map(row=>m22SequenceSourcePairs.find(pair=>same(pair.base,row))?.current??row),...m22SequenceAdditionPins];\n}\nfunction m22SequencePackageSuccessor(expected,raw){\n const pair=m22SequencePackagePairs.find(pair=>pair.base.path===expected?.path),digest=raw=>createHash('sha256').update(raw).digest('hex');\n if(!pair||raw.length!==pair.current.bytes||digest(raw)!==pair.current.sha256)return false;\n const value=JSON.parse(raw.toString('utf8'));\n if(JSON.stringify(value.exports['./animation'])!==JSON.stringify({types:'./dist/animation/index.d.ts',import:'./dist/animation/index.js'}))return false;\n delete value.exports['./animation'];const previous=Buffer.from(JSON.stringify(value,null,2)+'\\n');\n if(previous.length!==pair.base.bytes||digest(previous)!==pair.base.sha256)return false;\n return JSON.stringify(expected)===JSON.stringify(pair.base)||m31UiPackageSuccessor(expected,previous);\n}\n// M22-SEQUENCE-SUCCESSOR-END\n\n"},{"path":"tools/atlas-frame-types.mjs","predecessor":{"path":"tools/atlas-frame-types.mjs","bytes":3707,"sha256":"922c6bfddfd41b3207075745f8f386015370d891bff8197deb70c0950e0ca70a"},"current":{"path":"tools/atlas-frame-types.mjs","bytes":3707,"sha256":"c9c636536423fd102462760d3333ed52482af703c87d63d471598ac562be2d69"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== '0fd8fdc6fb015460aa1cb1cc8812d3008e6e466b72d9702ea133dc70cf446969'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/atlas-import-types.mjs","predecessor":{"path":"tools/atlas-import-types.mjs","bytes":6689,"sha256":"0a3e63c34afa6774814f2cf05c47c5e499366bdd23ef82c8fa26a296df235e23"},"current":{"path":"tools/atlas-import-types.mjs","bytes":6689,"sha256":"13af87937ff3ea182e3e6b762c0d6ae4ddfdfc39b90279d9fef9005f442de00a"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== '0fd8fdc6fb015460aa1cb1cc8812d3008e6e466b72d9702ea133dc70cf446969'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/bitmap-resource-slot-types.mjs","predecessor":{"path":"tools/bitmap-resource-slot-types.mjs","bytes":11184,"sha256":"49ee10d9589f836b488d6458d923f5fe40da64e4166efe7188db1765bf025e03"},"current":{"path":"tools/bitmap-resource-slot-types.mjs","bytes":11184,"sha256":"0e9fdf4a75ce6d5cf13ac2ff2624515eb3d068c756fc5923373ee4910bd9d424"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== '0fd8fdc6fb015460aa1cb1cc8812d3008e6e466b72d9702ea133dc70cf446969'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/bitmap-binding-ticket-types.mjs","predecessor":{"path":"tools/bitmap-binding-ticket-types.mjs","bytes":13887,"sha256":"e5cd2730ea1d71a3a86c0da63055684e3a559f373755cfad6592978e32eee3ab"},"current":{"path":"tools/bitmap-binding-ticket-types.mjs","bytes":13887,"sha256":"56621fd842b603755482856bc2ca29b16aaaa7b9764ff99fbefb8923592feb5a"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== '0fd8fdc6fb015460aa1cb1cc8812d3008e6e466b72d9702ea133dc70cf446969'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/linear-layout-types.mjs","predecessor":{"path":"tools/linear-layout-types.mjs","bytes":11073,"sha256":"eea842819e1bca56d9db9a1a266a383c4a05c86cd9b2c3f65325be9d90976afb"},"current":{"path":"tools/linear-layout-types.mjs","bytes":11073,"sha256":"12362eea389154acc7b8c2a23f75b07500ac529ed84c30c6e4b869d75303d62d"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== '0fd8fdc6fb015460aa1cb1cc8812d3008e6e466b72d9702ea133dc70cf446969'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/bitmap-button-types.mjs","predecessor":{"path":"tools/bitmap-button-types.mjs","bytes":17175,"sha256":"42559f04035034289e7a6c6e41a0539f9f3dfbde8321b1f251af2265e0a200f8"},"current":{"path":"tools/bitmap-button-types.mjs","bytes":17175,"sha256":"4a1aebfe9dbb9b22aaf1207d80244997f1adc5668c4db75ba44ccbc0c7b4c7a3"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== '0fd8fdc6fb015460aa1cb1cc8812d3008e6e466b72d9702ea133dc70cf446969'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/display-anchor-offsets-types.mjs","predecessor":{"path":"tools/display-anchor-offsets-types.mjs","bytes":16526,"sha256":"3403c30220a0bca502772669c8c67255dab6eb68254d1862f34bfdc53aea3510"},"current":{"path":"tools/display-anchor-offsets-types.mjs","bytes":16526,"sha256":"07f1c95f92fbca0749951884d0f93ce4fef752d265021f9663c2165a156a8c90"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== '0fd8fdc6fb015460aa1cb1cc8812d3008e6e466b72d9702ea133dc70cf446969'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/display-container-add-child-at-types.mjs","predecessor":{"path":"tools/display-container-add-child-at-types.mjs","bytes":18718,"sha256":"4bc3d2d9f3c86fd4d531781c4390f0d939f24aa691e2edc563920d0ca4b63b60"},"current":{"path":"tools/display-container-add-child-at-types.mjs","bytes":18718,"sha256":"a2897e8287bcba0a08e200ecd4d848fcf652b8406cab31a59b207eb3456f5693"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== '0fd8fdc6fb015460aa1cb1cc8812d3008e6e466b72d9702ea133dc70cf446969'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/display-container-child-index-types.mjs","predecessor":{"path":"tools/display-container-child-index-types.mjs","bytes":17112,"sha256":"5bc707351c3668800e8138f88d6fc5782e3b65d70c29d846e07ad34c3f1c1ff0"},"current":{"path":"tools/display-container-child-index-types.mjs","bytes":17112,"sha256":"3b7640cbbaf8166fe92ae9316bccca19c567af2c5fd1a74c482634cf4fb33731"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== '0fd8fdc6fb015460aa1cb1cc8812d3008e6e466b72d9702ea133dc70cf446969'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/display-container-remove-children-types.mjs","predecessor":{"path":"tools/display-container-remove-children-types.mjs","bytes":15268,"sha256":"35779d8fb02e90cf1de53a5b18b30d2ca1239a37840142e5d9ca775c4ba69f1a"},"current":{"path":"tools/display-container-remove-children-types.mjs","bytes":15268,"sha256":"7392b9057c5dabbd57f20f9ba4771605039c53c053a33e7b952bd5d0a2ed36ea"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== '0fd8fdc6fb015460aa1cb1cc8812d3008e6e466b72d9702ea133dc70cf446969'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/nine-slice-bitmap-types.mjs","predecessor":{"path":"tools/nine-slice-bitmap-types.mjs","bytes":6543,"sha256":"6675992221c9f97122a1edd5b6d1d8d8abc9fd3423fb8bcf8b90a239d99f048f"},"current":{"path":"tools/nine-slice-bitmap-types.mjs","bytes":6543,"sha256":"1ebfc2df625cfeb30c17a75c1e55f73d72b65d0dc6af7893e839d0b92e1d3737"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== '0fd8fdc6fb015460aa1cb1cc8812d3008e6e466b72d9702ea133dc70cf446969'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/sequence-playback-types.mjs","predecessor":{"path":"tools/sequence-playback-types.mjs","bytes":19297,"sha256":"6bbaed98027e0199cbbe947bea8a461141000c9e0840f1af7673bbe926c77b0b"},"current":{"path":"tools/sequence-playback-types.mjs","bytes":19297,"sha256":"c95343c45df3967054ada8cd1ce52ce9492f1f4585ccc6de44b3f4cfee1dad17"},"inverse":[{"from":"m13HelperPin.bytes !== 26465 || m13HelperPin.sha256 !== '0fd8fdc6fb015460aa1cb1cc8812d3008e6e466b72d9702ea133dc70cf446969'","to":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"}]},{"path":"tools/check-types.mjs","predecessor":{"path":"tools/check-types.mjs","bytes":142629,"sha256":"f7b2b034bd836799a3ce7e19860f6af22a3c4087a74ac24f8b79ad068006a1dd"},"current":{"path":"tools/check-types.mjs","bytes":144395,"sha256":"2ca30bd7ebf5a761042e9d661f0ae3bc608153fd4947680c5b2ed348ced1b596"},"inverse":[{"from":"// Match every optional sequence-control misuse to its actual compiler tuple.\n  const sequenceControlCases = [{\"name\":\"optional-entry-only\",\"line\":489,\"column\":21,\"code\":2339},{\"name\":\"controller-type-only\",\"line\":491,\"column\":23,\"code\":2551},{\"name\":\"unknown-profile\",\"line\":493,\"column\":59,\"code\":2322},{\"name\":\"invalid-repeat-kind\",\"line\":495,\"column\":95,\"code\":2322},{\"name\":\"numeric-marker-id\",\"line\":497,\"column\":106,\"code\":2322},{\"name\":\"invalid-callback-return\",\"line\":499,\"column\":97,\"code\":2322},{\"name\":\"invalid-seek-replay\",\"line\":501,\"column\":42,\"code\":2322},{\"name\":\"immutable-state\",\"line\":503,\"column\":24,\"code\":2540},{\"name\":\"nonforgeable-controller\",\"line\":505,\"column\":7,\"code\":2741},{\"name\":\"discriminated-completion\",\"line\":509,\"column\":11,\"code\":2339}];\n  const sequenceControlMarkers=raw.split(/\\r?\\n/).flatMap((line,index)=>{const match=line.match(/@ts-expect-error SEQUENCE_CONTROL_CASE ([\\w-]+)/);return match?[{name:match[1],line:index+2}]:[];});\n  if(JSON.stringify(sequenceControlMarkers)!==JSON.stringify(sequenceControlCases.map(({name,line})=>({name,line})))||(raw.match(/SEQUENCE_CONTROL_CASE/g)??[]).length!==10)throw Error('Sequence control exact negative membership changed');\n  const sequenceControlReceipts=sequenceControlCases.map(expected=>{\n    const found=observedGeometry.filter(actual=>actual.file==='tests/types/invalid.generated.ts'&&actual.line===expected.line);\n    if(found.length!==1||found[0].column!==expected.column||found[0].code!==expected.code)throw Error('Sequence control unsuppressed exact diagnostic changed: '+expected.name);\n    return {name:expected.name,actual:found[0]};\n  });\n  console.log('Sequence control individual unsuppressed diagnostic receipts: '+JSON.stringify(sequenceControlReceipts));\n\n  ","to":""}]}];
function m22SequencePrevious(raw,selected){
 if(!selected)return raw;
 const identity=body=>({path:selected.path,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});
 if(JSON.stringify(identity(raw))!==JSON.stringify(selected.current))return raw;
 let text=raw.toString('utf8');
 if(selected.block){if(text.split(selected.block).length!==2)throw Error('M2.2 exact source block differs');text=text.replace(selected.block,'');}
 for(const inverse of selected.inverse){if(text.split(inverse.from).length!==2)throw Error('M2.2 exact source inverse differs');text=text.replace(inverse.from,inverse.to);}
 const previous=Buffer.from(text);if(JSON.stringify(identity(previous))!==JSON.stringify(selected.predecessor))throw Error('M2.2 complete source predecessor differs');return previous;
}

const m31UiBoundaryHistory = [{"path":"tools/spritesheet-boundary.mjs","predecessor":{"bytes":207646,"sha256":"4d51b7456094eed65c2db387d4f1407e8366360d78739e996e2c309bca5cb965"},"current":{"bytes":220067,"sha256":"b534701cdbcd7d0ef14019005234d29e69d5686999450654929b4524d09068b1"},"inverse":[{"from":"  let graph=content?[...historical.map(row=>m21ContentSourcePairs.find(pair=>same(pair.base,row))?.current??row),...m21ContentAdditionPins]:historical;\n  graph=m31UiGraph(graph,present);","to":"  const graph=content?[...historical.map(row=>m21ContentSourcePairs.find(pair=>same(pair.base,row))?.current??row),...m21ContentAdditionPins]:historical;"},{"from":"return raw.length===pair.current.bytes&&digest(raw)===pair.current.sha256||m31UiPackageSuccessor(pair.base,raw);","to":"return raw.length===pair.current.bytes&&digest(raw)===pair.current.sha256;"},{"from":"m31UiPackageSuccessor(expected, bytes) || m3PointerPackageSuccessor(expected, bytes) || ","to":"m3PointerPackageSuccessor(expected, bytes) || "}]},{"path":"tools/sequence-playback-boundary.mjs","predecessor":{"bytes":46593,"sha256":"f4bc56c5a4acb32126d9cd58138be1a61d0d977eab46fa3aba55ca964c5eca8b"},"current":{"bytes":48793,"sha256":"fa09b4b2acaca3c70f0b4583b34dae3cf7a12b5de9fe754ee8bfe9815dca85dc"},"inverse":[{"from":"  pin = m13SequencePin(root, pin);\n  pin = m31UiSourcePairs.find(pair=>JSON.stringify(pair.base)===JSON.stringify(pin))?.current??pin;","to":"  pin = m13SequencePin(root, pin);"},{"from":"m31UiPackageSuccessor(pin, bytes) || m3PointerPackageSuccessor(pin, bytes) || ","to":"m3PointerPackageSuccessor(pin, bytes) || "}]},{"path":"tools/browser-png-boundary.mjs","predecessor":{"bytes":214947,"sha256":"cf8a143d063995ba1f015e4d90fb72715257d3c1098c776df03ab63cb9b34498"},"current":{"bytes":227685,"sha256":"dee49b3e1128b22bd999b367b178977825a0658744ed98f3893100ba8144093e"},"inverse":[{"from":"    // Preserve assigned export/DAG refusal precedence; complete raw package admission stays below.\n    if(m31UiPackagePairs.some(pair=>pair.current.path===file)\n      &&equal(value.exports?.['./ui'],{types:'./dist/ui/index.d.ts',import:'./dist/ui/index.js'})){\n      delete value.exports['./ui'];\n    }\n    let projectedExports = value.exports, projectedImports = value.imports;","to":"    let projectedExports = value.exports, projectedImports = value.imports;"},{"from":"  let graph=content?[...historical.map(row=>m21ContentSourcePairs.find(pair=>same(pair.base,row))?.current??row),...m21ContentAdditionPins]:historical;\n  graph=m31UiGraph(graph,present);","to":"  const graph=content?[...historical.map(row=>m21ContentSourcePairs.find(pair=>same(pair.base,row))?.current??row),...m21ContentAdditionPins]:historical;"},{"from":"return raw.length===pair.current.bytes&&digest(raw)===pair.current.sha256||m31UiPackageSuccessor(pair.base,raw);","to":"return raw.length===pair.current.bytes&&digest(raw)===pair.current.sha256;"},{"from":" && !m31UiPackageSuccessor(row, read(root,row.path,id)) && !m3PointerPackageSuccessor(row, read(root,row.path,id))","to":" && !m3PointerPackageSuccessor(row, read(root,row.path,id))"}]},{"path":"tools/bitmap-resource-slot-boundary.mjs","predecessor":{"bytes":41778,"sha256":"a03103fe528dda7292b80292e4a559f11ff54985de768ed49fdeb3d27aa3dc14"},"current":{"bytes":43941,"sha256":"d35fe029b5a4b94f7af3bbc151936a4c65d1bbb778dd412c48317156aaf57a67"},"inverse":[{"from":"function pinCheck(pin,code){const raw=read(pin.path);pin=m31UiSourcePairs.find(pair=>equal(pair.base,pin))?.current??pin;","to":"function pinCheck(pin,code){const raw=read(pin.path);"},{"from":"m31UiPackageSuccessor(pin,raw)||m3PointerPackageSuccessor(pin,raw)||","to":"m3PointerPackageSuccessor(pin,raw)||"}]},{"path":"tools/bitmap-binding-ticket-boundary.mjs","predecessor":{"bytes":48357,"sha256":"04e760910bee4ce84e4285a3ce9eae9eced72ecc1381c8c59fe0679762c2b0b1"},"current":{"bytes":50520,"sha256":"f35e0311de99c1fd8030a67631dcdadecd03423d9cb966d54099b6d7e5bf28f9"},"inverse":[{"from":"function pinCheck(pin,code){const raw=read(pin.path);pin=m31UiSourcePairs.find(pair=>equal(pair.base,pin))?.current??pin;","to":"function pinCheck(pin,code){const raw=read(pin.path);"},{"from":"m31UiPackageSuccessor(pin,raw)||m3PointerPackageSuccessor(pin,raw)||","to":"m3PointerPackageSuccessor(pin,raw)||"}]},{"path":"tools/atlas-import-boundary.mjs","predecessor":{"bytes":112375,"sha256":"88283e42d8081c407ff9cc0238a5eb8557c6f964a529549fac0df10f582a8e9b"},"current":{"bytes":124821,"sha256":"d850cb52e476c323f63da1eca82a6e7e5bfda87a0ee80287dffab39a421595d4"},"inverse":[{"from":"  let graph=content?[...historical.map(row=>m21ContentSourcePairs.find(pair=>same(pair.base,row))?.current??row),...m21ContentAdditionPins]:historical;\n  graph=m31UiGraph(graph,present);","to":"  const graph=content?[...historical.map(row=>m21ContentSourcePairs.find(pair=>same(pair.base,row))?.current??row),...m21ContentAdditionPins]:historical;"},{"from":"return raw.length===pair.current.bytes&&digest(raw)===pair.current.sha256||m31UiPackageSuccessor(pair.base,raw);","to":"return raw.length===pair.current.bytes&&digest(raw)===pair.current.sha256;"},{"from":"if (m31UiPackageSuccessor(pin,readFileSync(path.join(root,pin.path)))||m3PointerPackageSuccessor(pin,readFileSync(path.join(root,pin.path)))) return; ","to":"if (m3PointerPackageSuccessor(pin,readFileSync(path.join(root,pin.path)))) return; "}]}];
const m31UiStrictHistory = [{"path":"tools/atlas-frame-types.mjs","kind":"strict","predecessor":{"path":"tools/atlas-frame-types.mjs","bytes":3707,"sha256":"5758b6783ae84cce24cb21eb6676ab3358a748437d23303b4dea412be36deec5"},"current":{"path":"tools/atlas-frame-types.mjs","bytes":3707,"sha256":"922c6bfddfd41b3207075745f8f386015370d891bff8197deb70c0950e0ca70a"}},{"path":"tools/atlas-import-types.mjs","kind":"strict","predecessor":{"path":"tools/atlas-import-types.mjs","bytes":6689,"sha256":"94212adb90496a82aedbdac4cb7705aaec47e7ee124409bb21b9fb82d0bd7508"},"current":{"path":"tools/atlas-import-types.mjs","bytes":6689,"sha256":"0a3e63c34afa6774814f2cf05c47c5e499366bdd23ef82c8fa26a296df235e23"}},{"path":"tools/bitmap-resource-slot-types.mjs","kind":"strict","predecessor":{"path":"tools/bitmap-resource-slot-types.mjs","bytes":11184,"sha256":"4a86730c6708b1902dbc3cb44850cfdb3b815ba36574a4cb075f79a03c0c78b5"},"current":{"path":"tools/bitmap-resource-slot-types.mjs","bytes":11184,"sha256":"49ee10d9589f836b488d6458d923f5fe40da64e4166efe7188db1765bf025e03"}},{"path":"tools/bitmap-binding-ticket-types.mjs","kind":"strict","predecessor":{"path":"tools/bitmap-binding-ticket-types.mjs","bytes":13887,"sha256":"e1f5e567527b77668668d35b70b0dc0a8fa16e0d8284913f416f056385ebcb1a"},"current":{"path":"tools/bitmap-binding-ticket-types.mjs","bytes":13887,"sha256":"e5cd2730ea1d71a3a86c0da63055684e3a559f373755cfad6592978e32eee3ab"}},{"path":"tools/linear-layout-types.mjs","kind":"strict","predecessor":{"path":"tools/linear-layout-types.mjs","bytes":11073,"sha256":"190eba781a679110b93f79f90d062d79c28719769693424b0ab015502151964c"},"current":{"path":"tools/linear-layout-types.mjs","bytes":11073,"sha256":"eea842819e1bca56d9db9a1a266a383c4a05c86cd9b2c3f65325be9d90976afb"}},{"path":"tools/bitmap-button-types.mjs","kind":"strict","predecessor":{"path":"tools/bitmap-button-types.mjs","bytes":17175,"sha256":"7876598c62518c5f1728826591a4a58513d5830d101d7300422f08bb8ec84e55"},"current":{"path":"tools/bitmap-button-types.mjs","bytes":17175,"sha256":"42559f04035034289e7a6c6e41a0539f9f3dfbde8321b1f251af2265e0a200f8"}},{"path":"tools/display-anchor-offsets-types.mjs","kind":"strict","predecessor":{"path":"tools/display-anchor-offsets-types.mjs","bytes":16526,"sha256":"7c2d96d633e7d5a4e388ccc5b5542d995df2cd8a2e71637c0cbc913764384ff7"},"current":{"path":"tools/display-anchor-offsets-types.mjs","bytes":16526,"sha256":"3403c30220a0bca502772669c8c67255dab6eb68254d1862f34bfdc53aea3510"}},{"path":"tools/display-container-add-child-at-types.mjs","kind":"strict","predecessor":{"path":"tools/display-container-add-child-at-types.mjs","bytes":18718,"sha256":"4c5dc914f9086b38614472b5b7b904a13522126364e260e95fe617cc21a696ac"},"current":{"path":"tools/display-container-add-child-at-types.mjs","bytes":18718,"sha256":"4bc3d2d9f3c86fd4d531781c4390f0d939f24aa691e2edc563920d0ca4b63b60"}},{"path":"tools/display-container-child-index-types.mjs","kind":"strict","predecessor":{"path":"tools/display-container-child-index-types.mjs","bytes":17112,"sha256":"fb5258ab0ccbff63d10ed2772ab820962fe6c9a4bd178440e52f2f9628f9dfc2"},"current":{"path":"tools/display-container-child-index-types.mjs","bytes":17112,"sha256":"5bc707351c3668800e8138f88d6fc5782e3b65d70c29d846e07ad34c3f1c1ff0"}},{"path":"tools/display-container-remove-children-types.mjs","kind":"strict","predecessor":{"path":"tools/display-container-remove-children-types.mjs","bytes":15268,"sha256":"48a3f5e3ad4efdc50edc96062f00128a7a81165cf583b9a5e8dc70f36f0a0721"},"current":{"path":"tools/display-container-remove-children-types.mjs","bytes":15268,"sha256":"35779d8fb02e90cf1de53a5b18b30d2ca1239a37840142e5d9ca775c4ba69f1a"}},{"path":"tools/nine-slice-bitmap-types.mjs","kind":"strict","predecessor":{"path":"tools/nine-slice-bitmap-types.mjs","bytes":6543,"sha256":"d924ec9f3c17224339863f57f103a4514fdf1e7b593f8ad8edf2737cadb53a41"},"current":{"path":"tools/nine-slice-bitmap-types.mjs","bytes":6543,"sha256":"6675992221c9f97122a1edd5b6d1d8d8abc9fd3423fb8bcf8b90a239d99f048f"}},{"path":"tools/sequence-playback-types.mjs","kind":"strict","predecessor":{"path":"tools/sequence-playback-types.mjs","bytes":19297,"sha256":"cbb8774959757fb4db286946458f1ddf9ace9dc77d41be2c068ecd8a8036d57b"},"current":{"path":"tools/sequence-playback-types.mjs","bytes":19297,"sha256":"6bbaed98027e0199cbbe947bea8a461141000c9e0840f1af7673bbe926c77b0b"}},{"path":"tools/check-types.mjs","kind":"root","predecessor":{"path":"tools/check-types.mjs","bytes":141012,"sha256":"b584aa0dc9368285380a3f1569b49430e6fceee3f994a2be4d37acbbc1e9785e"},"current":{"path":"tools/check-types.mjs","bytes":142629,"sha256":"f7b2b034bd836799a3ce7e19860f6af22a3c4087a74ac24f8b79ad068006a1dd"}}];
const m31UiStrictBootstrap = {"before":"m13HelperPin.bytes !== 19535 || m13HelperPin.sha256 !== '7e458ff6c264079df2db6178014b4cea65b2067906484d2bf794c41e0e28c074'","after":"m13HelperPin.bytes !== 22381 || m13HelperPin.sha256 !== '9fa5b6d1b5fa4702090dbf50b932596c9fdd6a21aba3471be89dd0a91b5fcfeb'"};
const m31UiReceiptBlock = "  // M3.1 retains each observed unsuppressed misuse tuple in the existing lane.\n  const uiCases = [{\"name\":\"optional-entry-only\",\"line\":461,\"column\":19,\"code\":2339},{\"name\":\"preparation-type-only\",\"line\":463,\"column\":18,\"code\":2339},{\"name\":\"nonforgeable-preparation\",\"line\":465,\"column\":7,\"code\":2741},{\"name\":\"required-list-source\",\"line\":467,\"column\":7,\"code\":2322},{\"name\":\"unsupported-layout-kind\",\"line\":469,\"column\":51,\"code\":2322},{\"name\":\"asynchronous-measure\",\"line\":471,\"column\":66,\"code\":2322},{\"name\":\"immutable-snapshot\",\"line\":473,\"column\":20,\"code\":2540},{\"name\":\"immutable-rows\",\"line\":475,\"column\":25,\"code\":2339},{\"name\":\"invalid-retention-reason\",\"line\":477,\"column\":42,\"code\":2345},{\"name\":\"unavailable-resource-total\",\"line\":479,\"column\":7,\"code\":2322}];\n  const uiMarkers=raw.split(/\\r?\\n/).flatMap((line,index)=>{const match=line.match(/@ts-expect-error UI_CASE ([\\w-]+)/);return match?[{name:match[1],line:index+2}]:[];});\n  if(JSON.stringify(uiMarkers)!==JSON.stringify(uiCases.map(({name,line})=>({name,line})))||(raw.match(/UI_CASE/g)??[]).length!==10)throw Error('UI exact negative membership changed');\n  const uiReceipts=uiCases.map(expected=>{\n    const found=observedGeometry.filter(actual=>actual.file==='tests/types/invalid.generated.ts'&&actual.line===expected.line);\n    if(found.length!==1||found[0].column!==expected.column||found[0].code!==expected.code)throw Error('UI unsuppressed exact diagnostic changed: '+expected.name);\n    return {name:expected.name,actual:found[0]};\n  });\n  console.log('UI individual unsuppressed diagnostic receipts: '+JSON.stringify(uiReceipts));\n\n";
const m31UiFixtureEnginePackage = {"base":{"path":"packages/engine/package.json","bytes":2494,"sha256":"65d0583089d297c3e9d0cc39fb653a9d3642b04081f34d5341b6f5d74a9f1951"},"current":{"path":"packages/engine/package.json","bytes":2591,"sha256":"817ff4de665885cae85bb3563aeb80f2955eda5c9fda3d0954e1a0a7c513bcc5"}};
function m31UiStrictPredecessor(file,raw){
 raw=m22SequencePrevious(raw,m22SequenceSourceHistory.find(row=>row.path===file));
 const row=m31UiStrictHistory.find(row=>row.path===file),identity=raw=>({path:file,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')});
 if(!row||JSON.stringify(identity(raw))!==JSON.stringify(row.current))return raw;
 const from=row.kind==='root'?m31UiReceiptBlock:m31UiStrictBootstrap.after,to=row.kind==='root'?'':m31UiStrictBootstrap.before;
 const text=raw.toString();assert.equal(text.split(from).length,2);const previous=Buffer.from(text.replace(from,to));assert.deepEqual(identity(previous),row.predecessor);return previous;
}
function m31UiBoundaryPredecessor(raw,owner){
 raw=m22SequencePrevious(raw,m22SequenceSourceHistory.find(row=>row.path===owner));
 const selected=m31UiBoundaryHistory.find(row=>row.path===owner),identity=raw=>({bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')});
 if(!selected||JSON.stringify(identity(raw))!==JSON.stringify(selected.current))return raw;
 let text=raw.toString();
 const start='// M31-UI-SUCCESSOR-BEGIN\n',end='// M31-UI-SUCCESSOR-END\n\n';
 assert.equal(text.split(start).length,2);assert.equal(text.split(end).length,2);const a=text.indexOf(start),b=text.indexOf(end,a)+end.length;text=text.slice(0,a)+text.slice(b);
 for(const inverse of selected.inverse){assert.equal(text.split(inverse.from).length,2);text=text.replace(inverse.from,inverse.to);}
 const previous=Buffer.from(text);assert.deepEqual(identity(previous),selected.predecessor);return previous;
}

// Genuine source bytes authenticate extraction; synthetic dependencies are never executed.
const m15BootstrapBefore="m13HelperPin.bytes !== 11980 || m13HelperPin.sha256 !== '7f4a82751f0e9e5b3f1b9de5a17816b20cd169ed02f9130b1a7c3989c547b634'";
const m15BootstrapAfter="m13HelperPin.bytes !== 12701 || m13HelperPin.sha256 !== '0c8ae45e31b879ca8e84633091f3a5e938d7712c4f2dff7cf1af3013859b91ad'";
const m12BootstrapAfter="m13HelperPin.bytes !== 14254 || m13HelperPin.sha256 !== '01ac10f3471436f5b5a72ae01abe4813f7843a331a2b071e74c281ee3d3aaa0d'";
// Project only the nine exact M3.3 bootstrap successors back to the retained M1.2 fixtures.
const m33BootstrapAfter="m13HelperPin.bytes !== 16190 || m13HelperPin.sha256 !== '6410f814c90eaf001850a35ff74e826ca994e39cea7434b10a94dda165a01b88'";
const m33StrictGateHistory=[{"path":"tools/bitmap-resource-slot-types.mjs","predecessor":{"bytes":11184,"sha256":"e368d684d0fcaa7ad64539464110f8313cd8e17f2769421cd534953064317629"},"current":{"bytes":11184,"sha256":"6e6bf53aa8ef8f966c3ea19a51fa753d66a78755d6d4308b75df98d2f6f279ca"}},{"path":"tools/bitmap-binding-ticket-types.mjs","predecessor":{"bytes":13887,"sha256":"c59ec5a76da98fae8389671152ef38ae07653ce6b8680443b3a05c89061753f9"},"current":{"bytes":13887,"sha256":"e29cd5ec5e3e0ac49c1ed60f5625f9619ebfd2efb47eff54a73f5c89e55d4338"}},{"path":"tools/linear-layout-types.mjs","predecessor":{"bytes":11073,"sha256":"aecf36d5290b8691cb08b838a008767300f1d62793dfaf3a482ff349cf87f369"},"current":{"bytes":11073,"sha256":"2b1fcdaab0348fc048336809ceb54f90d32a01ba9808beaff4a813c82c90faee"}},{"path":"tools/bitmap-button-types.mjs","predecessor":{"bytes":17175,"sha256":"38049fb026e9602a5666709a6995a83d619e55f4ff69c777bd282fcc4f13a594"},"current":{"bytes":17175,"sha256":"20d345fe4a69ce04e7092191c9dfb51a2c12c487985507bcb6cec77ab833b19e"}},{"path":"tools/display-anchor-offsets-types.mjs","predecessor":{"bytes":16526,"sha256":"ec55c864f05220560e9bf1dec478bb4ec9654cdf643230d2fe029dcfc9e2633a"},"current":{"bytes":16526,"sha256":"41b9b17458129ad80e06e9585e6389456bde45a2c14f8fc1b34e7677c45ebdda"}},{"path":"tools/display-container-add-child-at-types.mjs","predecessor":{"bytes":18718,"sha256":"39dbbc65ab64ddc2f9f4cf92333f689d8a8998e20277d9a327bf7ecd179e9fbe"},"current":{"bytes":18718,"sha256":"43938661831d4cd464867fc3c32e925c021fafb45fc567f41a3fe5d1f5371227"}},{"path":"tools/display-container-child-index-types.mjs","predecessor":{"bytes":17112,"sha256":"74c3722cb43b203b46e7aed2f442f34e220849be55a92dc165e48af29c156a0f"},"current":{"bytes":17112,"sha256":"fafb90b31816b298863a2742afdeb380d622d47626daaa202a9895498b045e90"}},{"path":"tools/display-container-remove-children-types.mjs","predecessor":{"bytes":15268,"sha256":"08abd88096100f2dc45f0b197cdde72baf55bfff93e34c6f1e508c7ef0fa7514"},"current":{"bytes":15268,"sha256":"47cc4b3670285c429cfdbd63d1b5276ce69df829e8b084357644c6a305f1b18d"}},{"path":"tools/sequence-playback-types.mjs","predecessor":{"bytes":19255,"sha256":"4b0dccd9c27eeb4ae049a80048e978f821fde744c712530a6d342dcad8abaf35"},"current":{"bytes":19255,"sha256":"1478a503c52bad8cca832b86437b7a7546db0eadbc7fbdc9c7ec119ba950fe01"}}];
// M2.1 fixture projection keeps every earlier strict-history expectation literal.
const m21ContentStrictHistory = [{"path":"tools/bitmap-resource-slot-types.mjs","predecessor":{"bytes":11184,"sha256":"6e6bf53aa8ef8f966c3ea19a51fa753d66a78755d6d4308b75df98d2f6f279ca"},"current":{"bytes":11184,"sha256":"4a86730c6708b1902dbc3cb44850cfdb3b815ba36574a4cb075f79a03c0c78b5"}},{"path":"tools/bitmap-binding-ticket-types.mjs","predecessor":{"bytes":13887,"sha256":"e29cd5ec5e3e0ac49c1ed60f5625f9619ebfd2efb47eff54a73f5c89e55d4338"},"current":{"bytes":13887,"sha256":"e1f5e567527b77668668d35b70b0dc0a8fa16e0d8284913f416f056385ebcb1a"}},{"path":"tools/linear-layout-types.mjs","predecessor":{"bytes":11073,"sha256":"2b1fcdaab0348fc048336809ceb54f90d32a01ba9808beaff4a813c82c90faee"},"current":{"bytes":11073,"sha256":"190eba781a679110b93f79f90d062d79c28719769693424b0ab015502151964c"}},{"path":"tools/bitmap-button-types.mjs","predecessor":{"bytes":17175,"sha256":"20d345fe4a69ce04e7092191c9dfb51a2c12c487985507bcb6cec77ab833b19e"},"current":{"bytes":17175,"sha256":"7876598c62518c5f1728826591a4a58513d5830d101d7300422f08bb8ec84e55"}},{"path":"tools/display-anchor-offsets-types.mjs","predecessor":{"bytes":16526,"sha256":"41b9b17458129ad80e06e9585e6389456bde45a2c14f8fc1b34e7677c45ebdda"},"current":{"bytes":16526,"sha256":"7c2d96d633e7d5a4e388ccc5b5542d995df2cd8a2e71637c0cbc913764384ff7"}},{"path":"tools/display-container-add-child-at-types.mjs","predecessor":{"bytes":18718,"sha256":"43938661831d4cd464867fc3c32e925c021fafb45fc567f41a3fe5d1f5371227"},"current":{"bytes":18718,"sha256":"4c5dc914f9086b38614472b5b7b904a13522126364e260e95fe617cc21a696ac"}},{"path":"tools/display-container-child-index-types.mjs","predecessor":{"bytes":17112,"sha256":"fafb90b31816b298863a2742afdeb380d622d47626daaa202a9895498b045e90"},"current":{"bytes":17112,"sha256":"fb5258ab0ccbff63d10ed2772ab820962fe6c9a4bd178440e52f2f9628f9dfc2"}},{"path":"tools/display-container-remove-children-types.mjs","predecessor":{"bytes":15268,"sha256":"47cc4b3670285c429cfdbd63d1b5276ce69df829e8b084357644c6a305f1b18d"},"current":{"bytes":15268,"sha256":"48a3f5e3ad4efdc50edc96062f00128a7a81165cf583b9a5e8dc70f36f0a0721"}},{"path":"tools/sequence-playback-types.mjs","predecessor":{"bytes":19255,"sha256":"1478a503c52bad8cca832b86437b7a7546db0eadbc7fbdc9c7ec119ba950fe01"},"current":{"bytes":19297,"sha256":"cbb8774959757fb4db286946458f1ddf9ace9dc77d41be2c068ecd8a8036d57b"}}];
const m21ContentBootstrapAfter = "m13HelperPin.bytes !== 19535 || m13HelperPin.sha256 !== '7e458ff6c264079df2db6178014b4cea65b2067906484d2bf794c41e0e28c074'";
function m21ContentStrictPredecessor(file,raw){
 const selected=m21ContentStrictHistory.find(row=>row.path===file);if(!selected)return raw;
 const identity=body=>({bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});
 if(JSON.stringify(identity(raw))===JSON.stringify(selected.predecessor))return raw;
 assert.deepEqual(identity(raw),selected.current);let text=raw.toString();assert.equal(text.split(m21ContentBootstrapAfter).length,2);text=text.replace(m21ContentBootstrapAfter,m33BootstrapAfter);
 if(file==='tools/sequence-playback-types.mjs'){const after='for (const pin of m13?.compilerPins ?? seqpInventory.compiler.pins) seqpReadPin(pin);',before='for (const pin of seqpInventory.compiler.pins) seqpReadPin(pin);';assert.equal(text.split(after).length,3);text=text.replaceAll(after,before);}
 const previous=Buffer.from(text);assert.deepEqual(identity(previous),selected.predecessor);return previous;
}
function m33StrictPredecessor(file,raw){
 raw=m31UiStrictPredecessor(file,raw);
 raw=m21ContentStrictPredecessor(file,raw);
 const selected=m33StrictGateHistory.find(row=>row.path===file);if(!selected)return raw;
 const identity=bytes=>({bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 assert.deepEqual(identity(raw),selected.current);const text=raw.toString();assert.equal(text.split(m33BootstrapAfter).length,2);
 const previous=Buffer.from(text.replace(m33BootstrapAfter,m12BootstrapAfter));assert.deepEqual(identity(previous),selected.predecessor);return previous;
}
function inlineCompilerFixture({m15=false,m12=false}={}){
 const f=compilerFixture();
 for(const name of ['check-types','bitmap-resource-slot-types','bitmap-binding-ticket-types','linear-layout-types','bitmap-button-types','display-anchor-offsets-types','display-container-add-child-at-types','display-container-child-index-types','display-container-remove-children-types','sequence-playback-types']){const file='tools/'+name+'.mjs',current=m33StrictPredecessor(file,fs.readFileSync(new URL('../../'+file,import.meta.url))),raw=Buffer.from(current.toString().replace(m12BootstrapAfter,m15BootstrapAfter));f.put(file,m12?current:m15?raw:Buffer.from(raw.toString().replace(m15BootstrapAfter,m15BootstrapBefore)));}
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

// Authenticate the whole current source before undoing only its bounded M3 insertions.
const m33BoundarySources = [{"path":"tools/spritesheet-boundary.mjs","current":{"bytes":202670,"sha256":"0da3517e80ae80562655bfcd98e6468c9a9f9ed16fde4b590f357cc4195365c4"},"predecessor":{"bytes":192441,"sha256":"ecab5b53ef95905ccc0d497d22ae21f0fdcdb722af9a131fcdc8f33a28322345"}},{"path":"tools/sequence-playback-boundary.mjs","current":{"bytes":45750,"sha256":"220c68bd0afcf72fc41ba75bf67844c75293b51c885023e5ad41a1c312a0bea9"},"predecessor":{"bytes":43012,"sha256":"2d95757ddd9c3a6d1762fd44ba02461ef92504690f2e1e4c342a5f6d71f10a62"}},{"path":"tools/browser-png-boundary.mjs","current":{"bytes":209858,"sha256":"2fcd26757382cabb4c28ea8bb0652b6867c550add31f1c514661ce860a4f0ba0"},"predecessor":{"bytes":198282,"sha256":"76ff8a040936e5eace5eff3c94f3da733d512328f0fde507b958c8d32012413e"}},{"path":"tools/bitmap-resource-slot-boundary.mjs","current":{"bytes":40977,"sha256":"f6b5f7f4cae9c7eff328f5e7e6f53de7db23c977a587bfd0b76c9ee2e1112146"},"predecessor":{"bytes":38244,"sha256":"1a4046d1bd5003714ca030ade053f412c98ca1f787d35357b823a12005e791a3"}},{"path":"tools/bitmap-binding-ticket-boundary.mjs","current":{"bytes":47556,"sha256":"2b85a5206b2cfad092ecb42d1200b3e87d9a916a38529087862a94933bdbc4a6"},"predecessor":{"bytes":44823,"sha256":"690d56e1eb726d55990d6a8cd37b2215b1f3bb44430ca5c54abc67cdcffe8026"}},{"path":"tools/atlas-import-boundary.mjs","current":{"bytes":107421,"sha256":"6c670e346640165395fd0019b4fa7edd259fa844da70f8a04a9dabbdb597ae8f"},"predecessor":{"bytes":97146,"sha256":"67b80c84cbfd35c511e739c6afb2d64c80ebe9abf03ecf54cdc68b3f3dc3c5f5"}}];
// M2.1 fixture projection authenticates current bytes before undoing only content additions.
const m21ContentBoundaryHistory = [{"path":"tools/spritesheet-boundary.mjs","predecessor":{"bytes":202670,"sha256":"0da3517e80ae80562655bfcd98e6468c9a9f9ed16fde4b590f357cc4195365c4"},"current":{"bytes":207646,"sha256":"4d51b7456094eed65c2db387d4f1407e8366360d78739e996e2c309bca5cb965"}},{"path":"tools/sequence-playback-boundary.mjs","predecessor":{"bytes":45750,"sha256":"220c68bd0afcf72fc41ba75bf67844c75293b51c885023e5ad41a1c312a0bea9"},"current":{"bytes":46593,"sha256":"f4bc56c5a4acb32126d9cd58138be1a61d0d977eab46fa3aba55ca964c5eca8b"}},{"path":"tools/browser-png-boundary.mjs","predecessor":{"bytes":209858,"sha256":"2fcd26757382cabb4c28ea8bb0652b6867c550add31f1c514661ce860a4f0ba0"},"current":{"bytes":214947,"sha256":"cf8a143d063995ba1f015e4d90fb72715257d3c1098c776df03ab63cb9b34498"}},{"path":"tools/bitmap-resource-slot-boundary.mjs","predecessor":{"bytes":40977,"sha256":"f6b5f7f4cae9c7eff328f5e7e6f53de7db23c977a587bfd0b76c9ee2e1112146"},"current":{"bytes":41778,"sha256":"a03103fe528dda7292b80292e4a559f11ff54985de768ed49fdeb3d27aa3dc14"}},{"path":"tools/bitmap-binding-ticket-boundary.mjs","predecessor":{"bytes":47556,"sha256":"2b85a5206b2cfad092ecb42d1200b3e87d9a916a38529087862a94933bdbc4a6"},"current":{"bytes":48357,"sha256":"04e760910bee4ce84e4285a3ce9eae9eced72ecc1381c8c59fe0679762c2b0b1"}},{"path":"tools/atlas-import-boundary.mjs","predecessor":{"bytes":107421,"sha256":"6c670e346640165395fd0019b4fa7edd259fa844da70f8a04a9dabbdb597ae8f"},"current":{"bytes":112375,"sha256":"88283e42d8081c407ff9cc0238a5eb8557c6f964a529549fac0df10f582a8e9b"}}];
function m21ContentBoundaryPredecessor(raw,owner){
 raw=m31UiBoundaryPredecessor(raw,owner);
 const selected=m21ContentBoundaryHistory.find(row=>row.path===owner);if(!selected)return raw;
 const identity=body=>({bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});
 if([selected.predecessor,m33BoundarySources.find(row=>row.path===owner)?.predecessor].some(pin=>JSON.stringify(identity(raw))===JSON.stringify(pin)))return raw;
 assert.deepEqual(identity(raw),selected.current);let text=raw.toString();
 const replace=(from,to='')=>{assert.equal(text.split(from).length,2);text=text.replace(from,to);};
 if(['tools/bitmap-resource-slot-boundary.mjs','tools/bitmap-binding-ticket-boundary.mjs'].includes(owner)){
  const start='// M2.1 dev-only dependency identities; historical package and lock pins remain intact.\n',end='function pinCheck(pin,code){';
  assert.equal(text.split(start).length,2);const a=text.indexOf(start),b=text.indexOf(end,a);assert(b>a);text=text.slice(0,a)+text.slice(b);
  replace('const content=m21ContentConfigurationPairs.find(pair=>equal(pair.base,pin));if(content&&raw.length===content.current.bytes&&hash(raw)===content.current.sha256)pin=content.current;');
 }else if(owner==='tools/sequence-playback-boundary.mjs'){
  const start='// M2.1 dev-only dependency identities; historical package and lock pins remain intact.\n',end='function seqpbPin(root, pin, code) {';
  assert.equal(text.split(start).length,2);const a=text.indexOf(start),b=text.indexOf(end,a);assert(b>a);text=text.slice(0,a)+text.slice(b);
  replace('  const content=m21ContentConfigurationPairs.find(pair=>JSON.stringify(pair.base)===JSON.stringify(pin));\n  if(content&&bytes.length===content.current.bytes&&seqpbHash(bytes)===content.current.sha256)pin=content.current;\n');
 }else{
  const start='// M2.1: exact current optional content identities; all historical graph rows remain intact.\n',end='// M3-POINTER-GRAPH-BEGIN\n';
  assert.equal(text.split(start).length,2);const a=text.indexOf(start),b=text.indexOf(end,a);assert(b>a);text=text.slice(0,a)+text.slice(b);
  replace('  const historical=[...base.map(row=>chosen.get(row.path)??row),...additions.map(file=>chosen.get(file))];\n  const content=m21ContentAdditionPins.some(row=>present.has(row.path));\n  const graph=content?[...historical.map(row=>m21ContentSourcePairs.find(pair=>same(pair.base,row))?.current??row),...m21ContentAdditionPins]:historical;', '  const graph=[...base.map(row=>chosen.get(row.path)??row),...additions.map(file=>chosen.get(file))];');
  if(owner==='tools/spritesheet-boundary.mjs')replace('  const content=m21ContentConfigurationPairs.find(pair=>equal(pair.base,expected));\n  if(content&&bytes.length===content.current.bytes&&hash(bytes)===content.current.sha256)expected=content.current;\n');
  else if(owner==='tools/atlas-import-boundary.mjs')replace('const current=fingerprintFile(root,pin.path),content=m21ContentConfigurationPairs.find(pair=>same(pair.base,pin));if(content&&same(current,content.current))pin=content.current; ');
  else{
   replace("  const rootDevDependencies={...rootPackage.devDependencies};\n  if(equal(id.fingerprintFile(root,'package.json'),m21ContentConfigurationPairs[0].current)&&rootDevDependencies.pngjs==='7.0.0')delete rootDevDependencies.pngjs;\n");
   replace('!equal(rootDevDependencies, snapshot.rootDevDependencies)','!equal(rootPackage.devDependencies, snapshot.rootDevDependencies)');
   replace(' && !m21ContentConfigurationPairs.some(pair=>equal(pair.base,row)&&equal(pair.current,current))');
  }
 }
 const previous=Buffer.from(text);assert.deepEqual(identity(previous),selected.predecessor);return previous;
}
function m33BoundaryHistory(raw,owner){
 raw=m21ContentBoundaryPredecessor(raw,owner);
 const selected=m33BoundarySources.find(row=>row.path===owner);assert(selected);
 const identity=bytes=>({bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 if(JSON.stringify(identity(raw))===JSON.stringify(selected.predecessor))return raw;
 assert.deepEqual(identity(raw),selected.current);
 let text=raw.toString();
 const replace=(from,to='')=>{assert.equal(text.split(from).length,2);text=text.replace(from,to);};
 const strip=name=>{const start='// '+name+'-BEGIN\n',end='// '+name+'-END\n\n';assert.equal(text.split(start).length,2);assert.equal(text.split(end).length,2);const a=text.indexOf(start),b=text.indexOf(end,a)+end.length;assert(b>a);text=text.slice(0,a)+text.slice(b);};
 strip('M3-POINTER-PACKAGE');
 if(['tools/spritesheet-boundary.mjs','tools/browser-png-boundary.mjs','tools/atlas-import-boundary.mjs'].includes(owner)){
  strip('M3-POINTER-GRAPH');
  const actual=owner.includes('browser-png')?'actual':'actualNames';
  replace('  const pointer=m3PointerGraph(root,graph,'+actual+');\n  if(pointer!==undefined)return pointer;\n');
 }
 if(owner==='tools/browser-png-boundary.mjs'){
  replace('function m12PreparationHotPathGraph(root,base,actual) {','function m12PreparationHotPathGraph(base,actual) {');
  replace('const optimized=m12PreparationHotPathGraph(root,graph,actual);','const optimized=m12PreparationHotPathGraph(graph,actual);');
  replace(' && !m3PointerPackageSuccessor(row, read(root,row.path,id))');
  const start='    // M3 adds only the named optional input routes and private pointer binding.\n',end='    if (!equal(projectedExports, expectedPackage.exports))';
  assert.equal(text.split(start).length,2);assert.equal(text.split(end).length,2);const a=text.indexOf(start),b=text.indexOf(end,a);assert(b>a);text=text.slice(0,a)+text.slice(b);
 }else if(owner==='tools/atlas-import-boundary.mjs')replace('if (m3PointerPackageSuccessor(pin,readFileSync(path.join(root,pin.path)))) return; ');
 else if(owner==='tools/spritesheet-boundary.mjs')replace('m3PointerPackageSuccessor(expected, bytes) || ');
 else if(owner==='tools/sequence-playback-boundary.mjs')replace('m3PointerPackageSuccessor(pin, bytes) || ');
 else replace('m3PointerPackageSuccessor(pin,raw)||');
 const previous=Buffer.from(text);assert.deepEqual(identity(previous),selected.predecessor);return previous;
}

// Historical metadata fixtures use the exact engine package that accompanied their tools.
function m33BoundaryFixtureInput(file){
 let raw=fs.readFileSync(new URL('../../'+file,import.meta.url));if(file!=='packages/engine/package.json')return raw;
 let current={path:file,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};
 const sequencePackage={"base":{"path":"packages/engine/package.json","bytes":2591,"sha256":"817ff4de665885cae85bb3563aeb80f2955eda5c9fda3d0954e1a0a7c513bcc5"},"current":{"path":"packages/engine/package.json","bytes":2709,"sha256":"3fba4431f23b5ccb6da6f13a023ecd5229550f1ca8ead591521e69eeb3960fa9"}};
 if(JSON.stringify(current)===JSON.stringify(sequencePackage.current)){
  const value=JSON.parse(raw.toString());delete value.exports['./animation'];raw=Buffer.from(JSON.stringify(value,null,2)+'\n');
  assert.deepEqual({path:file,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')},sequencePackage.base);
  current=sequencePackage.base;
 }
 if(JSON.stringify(current)===JSON.stringify(m31UiFixtureEnginePackage.current)){
  const value=JSON.parse(raw.toString());delete value.exports['./ui'];raw=Buffer.from(JSON.stringify(value,null,2)+'\n');
  assert.deepEqual({path:file,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')},m31UiFixtureEnginePackage.base);
 }
 const identity=bytes=>({bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 assert.deepEqual(identity(raw),{bytes:2494,sha256:'65d0583089d297c3e9d0cc39fb653a9d3642b04081f34d5341b6f5d74a9f1951'});
 const value=JSON.parse(raw.toString());delete value.exports['./input'];delete value.exports['./web/pointer'];delete value.imports['#egret-pointer-input'];
 const previous=Buffer.from(JSON.stringify(value,null,2)+'\n');
 assert.deepEqual(identity(previous),{bytes:2167,sha256:'be2a5a1e13136e99111ebc0fdfa657e4067fbba79647eeb93431395210516143'});return previous;
}

// Undo only the bounded insertion; the retained complete source pin authenticates history.
function m12BoundaryHistory(raw,owner){
 raw=m33BoundaryHistory(raw,owner);
 const text=raw.toString(),start='// M12-PREPARATION-HOTPATH-BEGIN\n',end='// M12-PREPARATION-HOTPATH-END\n';
 if(!text.includes(start))return raw;
 assert.equal(text.split(start).length,2);assert.equal(text.split(end).length,2);
 const call=owner.includes('browser-png')?'  const optimized=m12PreparationHotPathGraph(graph,actual);\n  if(optimized!==undefined)return optimized;\n'
  :owner.includes('atlas-import')?'  const optimized=m12PreparationHotPathGraph(graph,actualNames);\n  if(optimized!==undefined)return optimized;\n'
  :'  const optimized=m12PreparationHotPathGraph(root,graph,actualNames);\n  if(optimized!==undefined)return optimized;\n';
 const a=text.indexOf(start),b=text.indexOf(end,a)+end.length,remainder=text.slice(0,a)+text.slice(b);
 assert.equal(remainder.split(call).length,2);return Buffer.from(remainder.replace(call,''));
}

// UNIT: genuine adapter bytes authenticate exceptional JSON extraction, not gate acceptance.
test('M1.5 maintenance reads six exact source owners and refuses unreviewed post-preamble extraction',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const expected=[{"path":"tools/spritesheet-boundary.mjs","bytes":185549,"sha256":"bfb4fb02f29cd66442a6f5124c1e209d87b305550ec5a48978c104f09163fb3f"},{"path":"tools/browser-png-boundary.mjs","bytes":191467,"sha256":"ce40f1363774bec52a053a5a0b2001aab2f3e4701b49e822e1a61097c7a4299d"},{"path":"tools/atlas-import-boundary.mjs","bytes":90249,"sha256":"4dee83aecfeb345647356ee3a8f5aef36e6b984333dcd8699ff40bfd7de6d581"},{"path":"tools/sequence-playback-boundary.mjs","bytes":43012,"sha256":"2d95757ddd9c3a6d1762fd44ba02461ef92504690f2e1e4c342a5f6d71f10a62"},{"path":"tools/bitmap-resource-slot-boundary.mjs","bytes":38244,"sha256":"1a4046d1bd5003714ca030ade053f412c98ca1f787d35357b823a12005e791a3"},{"path":"tools/bitmap-binding-ticket-boundary.mjs","bytes":44823,"sha256":"690d56e1eb726d55990d6a8cd37b2215b1f3bb44430ca5c54abc67cdcffe8026"}];
  for(const pin of expected){
   const raw=m12BoundaryHistory(fs.readFileSync(new URL('../../'+pin.path,import.meta.url)),pin.path);
   assert.deepEqual({path:pin.path,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')},pin);
   f.put(pin.path,raw);
  }
  for(const file of ['tools/bitmap-resource-slot-policy.json','tools/bitmap-binding-ticket-policy.json','tests/types/atlas-import-diagnostic-expectations.json','packages/engine/dist/Engine.d.ts','packages/contracts/package.json','packages/engine/package.json','packages/project/package.json'])f.put(file,m33BoundaryFixtureInput(file));
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

// UNIT: current metadata extraction and original history are distinct; no SDK or gate executes.
test('M1.2 hotpath metadata keeps three exact current graph owners beside immutable M1.5 sources',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  const owners=[{"path":"tools/spritesheet-boundary.mjs","bytes":192441,"sha256":"ecab5b53ef95905ccc0d497d22ae21f0fdcdb722af9a131fcdc8f33a28322345"},{"path":"tools/browser-png-boundary.mjs","bytes":198282,"sha256":"76ff8a040936e5eace5eff3c94f3da733d512328f0fde507b958c8d32012413e"},{"path":"tools/atlas-import-boundary.mjs","bytes":97146,"sha256":"67b80c84cbfd35c511e739c6afb2d64c80ebe9abf03ecf54cdc68b3f3dc3c5f5"}];
  for(const row of owners){const raw=m33BoundaryHistory(fs.readFileSync(new URL('../../'+row.path,import.meta.url)),row.path);assert.deepEqual({path:row.path,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')},row);f.put(row.path,raw);}
  for(const file of ['tests/types/atlas-import-diagnostic-expectations.json','packages/engine/dist/Engine.d.ts','packages/contracts/package.json','packages/engine/package.json','packages/project/package.json'])f.put(file,m33BoundaryFixtureInput(file));
  const collect=()=>m.prepareBaselineReview(f.root),current=collect(),groups=current.declarations.filter(row=>row.binding==='m12PreparationHotPathGraphSuccessor');
  assert.equal(current.status,'review-required');assert.equal(groups.length,3);assert(groups.every(row=>row.rows.length===22));
  for(const [index,coverage]of current.graphCoverage.entries())assert.deepEqual(coverage.preparationHotPathSuccessor,{owner:owners[index].path,binding:'m12PreparationHotPathGraphSuccessor'});
  assert.equal(m.verifyMaintenanceProposal(f.root,current),true);
  for(const row of owners){
   const raw=fs.readFileSync(path.join(f.root,row.path));f.put(row.path,Buffer.concat([raw,Buffer.from('// unreviewed hotpath source\n')]));
   assert.throws(collect,/Unsupported declaration preamble/);assert.throws(()=>m.verifyMaintenanceProposal(f.root,current));
   f.put(row.path,raw);assert.equal(m.verifyMaintenanceProposal(f.root,current),true);
  }
  for(const row of owners)f.put(row.path,m12BoundaryHistory(fs.readFileSync(path.join(f.root,row.path)),row.path));
  const historical=collect();assert.equal(historical.declarations.some(row=>row.binding==='m12PreparationHotPathGraphSuccessor'),false);
  assert.deepEqual(historical.declarations,current.declarations.filter(row=>row.binding!=='m12PreparationHotPathGraphSuccessor'));
  assert.deepEqual(historical.successorPairs,current.successorPairs);assert.equal(m.verifyMaintenanceProposal(f.root,historical),true);
 }finally{f.close();}
});

// Execute only the exact tool-local metadata selector, with real retained JSON declarations.
test('M1.2 hotpath PNG selector admits a complete group and preserves assigned missing or drift paths',()=>{
 const text=m33BoundaryHistory(fs.readFileSync(new URL('../../tools/browser-png-boundary.mjs',import.meta.url)),'tools/browser-png-boundary.mjs').toString();
 const literal=name=>{const anchor='const '+name+' = ',lines=text.split('\n').filter(line=>line.startsWith(anchor));assert.equal(lines.length,1);return JSON.parse(lines[0].slice(anchor.length,-1));};
 let base=[...literal('acceptedSnapshot').graph,...literal('atlasGraphSuccessor')];
 const pairs=literal('imageResidencySuccessors');base=base.map(row=>{const pair=pairs.find(pair=>pair.path===row.path);return pair&&row.bytes===pair.base.bytes&&row.sha256===pair.base.sha256?{path:row.path,...pair.current}:row;});
 for(const prefix of ['m11WarmSubmission','m12IncrementalRendering','m13SharedRendering','m14WebGL2','m15ResourceRecovery']){const rows=new Map(literal(prefix+'GraphSuccessor').map(row=>[row.path,row]));base=[...base.map(row=>rows.get(row.path)??row),...literal(prefix+'AdditionPaths').map(file=>rows.get(file))];}
 const digest=rows=>createHash('sha256').update(JSON.stringify([...rows].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0).map(row=>[row.path,row.bytes,row.sha256]))).digest('hex');
 assert.equal(base.length,669);assert.equal(digest(base),'06427ebc44a664071cde2396f7c474fe074107aaa07dbe7d69192634a37accc5');
 const start='// M12-PREPARATION-HOTPATH-BEGIN\n',end='// M12-PREPARATION-HOTPATH-END\n';assert.equal(text.split(start).length,2);assert.equal(text.split(end).length,2);
 const block=text.slice(text.indexOf(start)+start.length,text.indexOf(end)),context={createHash,issue:(code,path,message)=>({code,path,message})};
 vm.runInNewContext(block+'\nglobalThis.run=m12PreparationHotPathGraph;',context,{filename:'browser-png-hotpath-selector.mjs'});
 const rows=literal('m12PreparationHotPathGraphSuccessor'),selected=new Map(rows.map(row=>[row.path,row])),complete=base.map(row=>selected.get(row.path)??row),clone=value=>JSON.parse(JSON.stringify(value));
 assert.equal(context.run(base,base),undefined);assert.deepEqual(clone(context.run(base,complete).graph),complete);
 const target=rows[0].path,old=base.find(row=>row.path===target);
 assert.equal(context.run(base,complete.filter(row=>row.path!==target)).failure.code,'BIP_BOUNDARY_SOURCE_INVENTORY');
 assert.equal(context.run(base,complete.filter(row=>row.path!==target)).failure.path,target);
 for(const altered of [complete.map(row=>row.path===target?old:row),complete.map(row=>row.path===target?{...row,sha256:'0'.repeat(64)}:row)]){
  const result=context.run(base,altered);assert.equal(result.failure.code,'BIP_BOUNDARY_FINGERPRINT');assert.equal(result.failure.path,target);
 }
 const changedBase=base.map((row,index)=>index===0?{...row,sha256:'0'.repeat(64)}:row);
 assert.equal(context.run(changedBase,complete).failure.path,'tools/browser-png-boundary.mjs');
 assert.deepEqual(clone(context.run(base,complete).graph),complete);
});

test('M1.2 NineSlice source mapping is exact to owner history and current bytes',()=>{
 const f=fixture();try{
  const text=fs.readFileSync(new URL('../../tools/lib/m13-strict-successor.mjs',import.meta.url),'utf8'),start='// M12-NINE-SLICE-SOURCE-BEGIN\n',end='// M12-NINE-SLICE-SOURCE-END\n';
  assert.equal(text.split(start).length,2);assert.equal(text.split(end).length,2);
  const context={root:f.root,M15_DATA:{},DATA:{},equal:(a,b)=>JSON.stringify(a)===JSON.stringify(b),fingerprintFile:(root,file)=>{assert.equal(root,f.root);const raw=fs.readFileSync(path.join(root,file));return {path:file,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};}};
  vm.runInNewContext(text.slice(text.indexOf(start)+start.length,text.indexOf(end))+'\nglobalThis.pair=m12NineSliceHostSource;globalThis.run=(version,id,row)=>m12NineSliceHostPin(root,version===15?M15_DATA:DATA,id,row);',context,{filename:'strict-source-pair.mjs'});
  const pair=JSON.parse(JSON.stringify(context.pair)),file=pair.base.path,raw=fs.readFileSync(new URL('../../'+file,import.meta.url));f.put(file,raw);
  assert.deepEqual(context.fingerprintFile(f.root,file),pair.current);
  assert.deepEqual(JSON.parse(JSON.stringify(context.run(15,'nine-slice-bitmap',pair.base))),pair.current);
  assert.deepEqual(context.run(13,'nine-slice-bitmap',pair.base),pair.base);assert.deepEqual(context.run(15,'atlas-frame',pair.base),pair.base);
  const unknown={...pair.base,sha256:'0'.repeat(64)};assert.deepEqual(context.run(15,'nine-slice-bitmap',unknown),unknown);
  f.put(file,Buffer.concat([raw,Buffer.from('// source drift\n')]));assert.deepEqual(context.run(15,'nine-slice-bitmap',pair.base),pair.base);
  f.put(file,raw);assert.deepEqual(JSON.parse(JSON.stringify(context.run(15,'nine-slice-bitmap',pair.base))),pair.current);
 }finally{f.close();}
});

test('M1.2 capture source mapping keeps twelve original strict owners and exact raw identity',()=>{
 const f=fixture();try{
  const text=fs.readFileSync(new URL('../../tools/lib/m13-strict-successor.mjs',import.meta.url),'utf8'),start='// M12-CAPTURE-SOURCE-BEGIN\n',end='// M12-CAPTURE-SOURCE-END\n';
  assert.equal(text.split(start).length,2);assert.equal(text.split(end).length,2);
  const data=JSON.parse(fs.readFileSync(new URL('../../tools/m15-strict-successors.json',import.meta.url),'utf8'));
  const context={root:f.root,M15_DATA:{},DATA:{},equal:(a,b)=>JSON.stringify(a)===JSON.stringify(b),fingerprintFile:(root,file)=>{assert.equal(root,f.root);const raw=fs.readFileSync(path.join(root,file));return {path:file,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};}};
  vm.runInNewContext(text.slice(text.indexOf(start)+start.length,text.indexOf(end))+'\nglobalThis.pair=m12CaptureSource;globalThis.run=(version,row)=>m12CaptureSourcePin(root,version===15?M15_DATA:DATA,row);',context,{filename:'strict-capture-source-pair.mjs'});
  const pair=JSON.parse(JSON.stringify(context.pair)),file=pair.base.path,raw=fs.readFileSync(new URL('../../'+file,import.meta.url));f.put(file,raw);
  assert.equal(data.owners.length,12);assert(data.owners.every(owner=>owner.sourcePaths.includes(file)));
  assert.deepEqual(data.inputs.find(row=>row.path===file),pair.base);assert.deepEqual(context.fingerprintFile(f.root,file),pair.current);
  assert.deepEqual(JSON.parse(JSON.stringify(context.run(15,pair.base))),pair.current);assert.deepEqual(context.run(13,pair.base),pair.base);
  for(const unknown of [{...pair.base,path:'packages/runtime/src/unknown.ts'},{...pair.base,bytes:pair.base.bytes+1},{...pair.base,sha256:'0'.repeat(64)}])assert.deepEqual(context.run(15,unknown),unknown);
  const altered=Buffer.from(raw);altered[0]^=1;f.put(file,altered);assert.deepEqual(context.run(15,pair.base),pair.base);
  f.put(file,Buffer.concat([raw,Buffer.from('\n')]));assert.deepEqual(context.run(15,pair.base),pair.base);
  f.put(file,raw);assert.deepEqual(JSON.parse(JSON.stringify(context.run(15,pair.base))),pair.current);
 }finally{f.close();}
});

test('M1.2 strict bootstrap keeps nine exact current sources and reverses only its one helper literal',async()=>{
 const m=await compilerTool(),f=inlineCompilerFixture({m12:true});try{
  const expected=[{"path":"tools/bitmap-resource-slot-types.mjs","predecessor":{"bytes":11184,"sha256":"c97f8b75d9103477c7f5e5932f0fb75e588d42eec31a73e6f66327fae9275eaf"},"current":{"bytes":11184,"sha256":"e368d684d0fcaa7ad64539464110f8313cd8e17f2769421cd534953064317629"}},{"path":"tools/bitmap-binding-ticket-types.mjs","predecessor":{"bytes":13887,"sha256":"b36874eaab10b6c275424584d062b599f8e14a215336a7722e9a3783190a8782"},"current":{"bytes":13887,"sha256":"c59ec5a76da98fae8389671152ef38ae07653ce6b8680443b3a05c89061753f9"}},{"path":"tools/linear-layout-types.mjs","predecessor":{"bytes":11073,"sha256":"89cf1e6e5fd099871ff0d7388df1b0b6e6accd36c78aef9aa33e1e5426fa71c3"},"current":{"bytes":11073,"sha256":"aecf36d5290b8691cb08b838a008767300f1d62793dfaf3a482ff349cf87f369"}},{"path":"tools/bitmap-button-types.mjs","predecessor":{"bytes":17175,"sha256":"919546bc07a51a78d499ae070618d7000e2d87774ad4af3c8a540b395924bbb8"},"current":{"bytes":17175,"sha256":"38049fb026e9602a5666709a6995a83d619e55f4ff69c777bd282fcc4f13a594"}},{"path":"tools/display-anchor-offsets-types.mjs","predecessor":{"bytes":16526,"sha256":"9d37f5989501d97094b25a0d9130f98c906cdc60bea4b1f9a042279b7279f90c"},"current":{"bytes":16526,"sha256":"ec55c864f05220560e9bf1dec478bb4ec9654cdf643230d2fe029dcfc9e2633a"}},{"path":"tools/display-container-add-child-at-types.mjs","predecessor":{"bytes":18718,"sha256":"f25ded3a21e455bfc45d5181025d7fd6dcd43cd666a08bc246855fce4452ee91"},"current":{"bytes":18718,"sha256":"39dbbc65ab64ddc2f9f4cf92333f689d8a8998e20277d9a327bf7ecd179e9fbe"}},{"path":"tools/display-container-child-index-types.mjs","predecessor":{"bytes":17112,"sha256":"fb2d518381df6f41795f198c5b353b03fc194361151bbdd5963fde78e7f38929"},"current":{"bytes":17112,"sha256":"74c3722cb43b203b46e7aed2f442f34e220849be55a92dc165e48af29c156a0f"}},{"path":"tools/display-container-remove-children-types.mjs","predecessor":{"bytes":15268,"sha256":"f03e8cfc77240d8ea40021333bf13e56cc15e0e0f469442fd6a72dee7e5bd31b"},"current":{"bytes":15268,"sha256":"08abd88096100f2dc45f0b197cdde72baf55bfff93e34c6f1e508c7ef0fa7514"}},{"path":"tools/sequence-playback-types.mjs","predecessor":{"bytes":19255,"sha256":"6dffcc40c3654db9c9faa2f9983eafea7b6e91960aab20f279b0f5caba9a66be"},"current":{"bytes":19255,"sha256":"4b0dccd9c27eeb4ae049a80048e978f821fde744c712530a6d342dcad8abaf35"}}],collect=()=>m.prepareCompilerReview(f.root,{inlinePolicies:true}),current=collect();
  assert.equal(expected.length,9);
  for(const row of expected){
   const raw=fs.readFileSync(path.join(f.root,row.path)),text=raw.toString(),identity=body=>({bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});
   assert.deepEqual(identity(raw),row.current);assert.equal(text.split(m12BootstrapAfter).length,2);
   const revision=current.inlinePolicies.sourceRevisions.find(value=>value.current.path===row.path);assert.equal(revision.selection,'m12-hotpath-strict-current');assert.equal(revision.admission,'not-evaluated');
   assert.deepEqual(revision.m12HotPathStrictSuccessor,{path:row.path,...row.current});
   const predecessor=Buffer.from(text.replace(m12BootstrapAfter,m15BootstrapAfter));assert.deepEqual(identity(predecessor),row.predecessor);
   f.put(row.path,predecessor);const historical=collect();assert.equal(historical.inlinePolicies.sourceRevisions.find(value=>value.current.path===row.path).selection,'m15-strict-current');
   assert.deepEqual(historical.inlinePolicies.literals,current.inlinePolicies.literals);assert.deepEqual(historical.inlinePolicies.conditions,current.inlinePolicies.conditions);
   f.put(row.path,raw);assert.equal(m.verifyCompilerProposal(f.root,current,{inlinePolicies:true}).status,'current-inputs');
   const altered=Buffer.concat([raw,Buffer.from('// unreviewed current strict source\n')]);f.put(row.path,altered);assert.throws(collect,/Unreviewed inline policy source/);assert.throws(()=>m.verifyCompilerProposal(f.root,current,{inlinePolicies:true}));
   f.put(row.path,raw);assert.equal(m.verifyCompilerProposal(f.root,current,{inlinePolicies:true}).status,'current-inputs');
  }
 }finally{f.close();}
});

// UNIT: current exact UI metadata is data; these readers never execute product code.
test('M3.1 current boundary metadata preserves current source pins and refuses unknown owner bytes',async()=>{
 const m=await maintenance(),f=baselineFixture();try{
  for(const row of m31UiBoundaryHistory)f.put(row.path,fs.readFileSync(new URL('../../'+row.path,import.meta.url)));
  const collect=()=>m.prepareBaselineReview(f.root),current=collect();
  assert.equal(current.declarations.filter(row=>row.binding==='m31UiAdditionPins').length,3);
  assert(current.graphCoverage.every(row=>row.uiSuccessor?.binding==='m31UiAdditionPins'));
  assert.equal(current.successorPairs.filter(row=>row.binding==='m31UiPackagePairs').length,6);
  assert.equal(m.verifyMaintenanceProposal(f.root,current),true);
  const file=m31UiBoundaryHistory[0].path,raw=fs.readFileSync(path.join(f.root,file));
  try{f.put(file,Buffer.concat([raw,Buffer.from('// unregistered UI owner\n')]));assert.throws(collect,/Unsupported declaration preamble/);}finally{f.put(file,raw);}
  assert.equal(m.verifyMaintenanceProposal(f.root,current),true);
 }finally{f.close();}
});
test('M3.1 current compiler metadata proves exact UI source inverses and refuses unknown wrapper bytes',async()=>{
 const m=await compilerTool(),f=inlineCompilerFixture({m12:true});try{
  for(const row of m31UiStrictHistory)if(fs.existsSync(path.join(f.root,row.path)))f.put(row.path,fs.readFileSync(new URL('../../'+row.path,import.meta.url)));
  const collect=()=>m.prepareCompilerReview(f.root,{inlinePolicies:true}),current=collect();
  assert.equal(current.inlinePolicies.sourceRevisions.filter(row=>row.selection==='m31-ui-current').length,10);
  assert.equal(m.verifyCompilerProposal(f.root,current,{inlinePolicies:true}).status,'current-inputs');
  const file='tools/linear-layout-types.mjs',raw=fs.readFileSync(path.join(f.root,file));
  try{f.put(file,Buffer.concat([raw,Buffer.from('// unregistered UI wrapper\n')]));assert.throws(collect,/Unreviewed inline policy source/);}finally{f.put(file,raw);}
  assert.equal(m.verifyCompilerProposal(f.root,current,{inlinePolicies:true}).status,'current-inputs');
 }finally{f.close();}
});
