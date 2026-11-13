// SPDX-License-Identifier: Apache-2.0
// Use actual Git trees and real generated ledgers to test the Windows route.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {isolatedGitEnvironment,planMetadata,writeMetadata} from '../../tools/contribution-metadata.mjs';
import {selectWindowsMergeChecks} from '../../tools/check-ci-documentation.mjs';

const ledgers = ['localization.json','knowledge-base/documentation-layout.json','source-origin.json'];
const policy = 'knowledge-base/en/docs/windows-ci-governance.md';
const reader = 'knowledge-base/en/docs/glossary.md';
const translation = 'knowledge-base/Cns/docs/术语表.md';
const architecture = 'knowledge-base/en/docs/architecture-and-engineering-plan.md';
const architectureZh = 'knowledge-base/Cns/docs/architecture-and-engineering-plan.md';
const architectureBody = '# Egret Engine architecture and engineering plan\n\n'
 + '2026-11-07 · Current status\n\nAudited main [previous] has evidence.\n\n'
 + 'The required checks remain unchanged.\n\nM0 verified outcomes.\n\n'
 + 'See the [M2–M4 roadmap](m2-m4-delivery-plan.md).\n\n'
 + '## 1. Objectives\n\n### 9.5 CI rules\n\nKeep all required jobs.\n\n'
 + '## 13. Baseline sources\n\nThe links below preserve the original architecture-design baseline. Old status.\n';
function fixture(t,{staleDeclaration=false}={}){
 const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'egret Windows route ')));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const put=(f,s)=>{fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),s);};
 const encode=(f,value)=>put(f,JSON.stringify(value,null,2)+'\n');
 const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
 const git=(...args)=>{
  const r=spawnSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid',...args],{cwd:root,encoding:'utf8',env:isolatedGitEnvironment()});
  assert.equal(r.status,0,r.stderr);return r.stdout.trim();
 };
 const pin=f=>{const bytes=fs.readFileSync(path.join(root,f));return {path:f,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};};
 const initial=['README.md','README.zh-CN.md',reader,translation,policy,'tools/check-ci-documentation.mjs','tools/contribution-metadata.mjs','.github/workflows/ci.yml','unlisted.md','packages/engine/engine.ts',architecture,architectureZh];
 for(const f of initial)put(f,'Original fixture.\n');
 put(architecture,architectureBody);
 if(staleDeclaration){
  const owner='contributions/fixture.json';
  encode(owner,{schemaVersion:1,files:[{path:'unlisted.md',originRole:'Original fixture'}],documents:[]});
  initial.push(owner);
 }
 encode(ledgers[0],{documents:[{en:'README.md',zh:'README.zh-CN.md'},{en:reader,zh:translation},{en:architecture,zh:architectureZh}].map(row=>({...row,kind:'public_reading',enSha256:pin(row.en).sha256,zhSha256:pin(row.zh).sha256})),criticalComments:[],registries:[]});
 encode(ledgers[1],{documents:[{newEn:reader,newZh:translation,currentEnSha256:pin(reader).sha256,currentZhSha256:pin(translation).sha256}]});
 const origins=[...initial,...ledgers.slice(0,2)].map(f=>({...pin(f),originRole:'Original fixture'}));
 if(staleDeclaration)origins.find(row=>row.path==='unlisted.md').sha256='f'.repeat(64);
 encode(ledgers[2],{files:origins});
 git('init','-q','--initial-branch=main');git('add','.');git('commit','-qm','base');
 const base=git('rev-parse','HEAD');
 git('switch','-qc','candidate');
 function refresh(){writeMetadata(root,planMetadata(root,{base}));}
 function changes(){put('README.md','Edited fixture.\n');put('README.zh-CN.md','配对编辑。\n');put(reader,'Glossary update.\n');put(translation,'术语更新。\n');}
 function finish({mergeTree}={}){
  git('add','.');git('commit','-qm','candidate');
  const head=git('rev-parse','HEAD');
  const tree=mergeTree??git('rev-parse','HEAD^{tree}');
  const merge=git('commit-tree',tree,'-p',base,'-p',head,'-m','synthetic merge');
  git('switch','-q','--detach',merge);
  return {eventName:'pull_request',baseRef:'main',base,head,merge};
 }
 return {root,git,put,encode,read,refresh,changes,finish,base};
}

test('current reading edits that leave every ledger as the base has it select the bound documentation tree',async t=>{
 const f=fixture(t);f.changes();
 const before=ledgers.map(file=>fs.readFileSync(path.join(f.root,file)));
 const inputs=f.finish();
 assert.deepEqual(ledgers.map(file=>fs.readFileSync(path.join(f.root,file))),before);
 const result=await selectWindowsMergeChecks(f.root,inputs);
 assert.equal(result.profile,'documentation',result.reason);
 assert.equal(result.base,inputs.base);assert.equal(result.head,inputs.head);assert.equal(result.merge,inputs.merge);
 assert.equal(result.tree,f.git('rev-parse','HEAD^{tree}'));
 assert.deepEqual(new Set(result.documents),new Set(['README.md','README.zh-CN.md',reader,translation]));
});

test('different events, parent IDs, refs, and merge trees require the full gate',async t=>{
 const f=fixture(t);f.changes();const inputs=f.finish();
 assert.equal((await selectWindowsMergeChecks(f.root,inputs)).profile,'documentation');
 for(const change of [{eventName:'push'},{baseRef:'other'},{base:inputs.head},{head:inputs.base},{merge:inputs.head},{merge:'not-a-sha'}]){
  assert.equal((await selectWindowsMergeChecks(f.root,{...inputs,...change})).profile,'full');
 }
 const different=f.git('commit-tree',f.git('rev-parse',f.base+'^{tree}'),'-p',f.base,'-p',inputs.head,'-m','different synthetic tree');
 f.git('switch','-q','--detach',different);
 assert.equal((await selectWindowsMergeChecks(f.root,{...inputs,merge:different})).profile,'full');
});

test('a diverged base takes the full gate even if Git produced a clean merge',async t=>{
 const f=fixture(t);f.changes();const inputs=f.finish();
 f.git('switch','-q','main');f.put('unlisted.md','Current base edit.\n');f.git('add','.');f.git('commit','-qm','new base');
 const base=f.git('rev-parse','HEAD');
 f.git('merge','-q','--no-edit','candidate');
 const merge=f.git('rev-parse','HEAD');
 assert.equal((await selectWindowsMergeChecks(f.root,{...inputs,base,merge})).profile,'full');
});

for(const changed of [policy,'unlisted.md','packages/engine/engine.ts','tools/check-ci-documentation.mjs','tools/contribution-metadata.mjs','.github/workflows/ci.yml']){
 test('reading edits do not admit '+changed,async t=>{
  const f=fixture(t);f.changes();f.put(changed,'Different candidate contents.\n');
  const route=await selectWindowsMergeChecks(f.root,f.finish());
  assert.equal(route.profile,'full');assert.match(route.reason,/outside the current reading allowlist/);
 });
}

for(const action of ['rename','delete','add','mode']){
 test(action+' on a reading path takes the full gate',async t=>{
  const f=fixture(t);f.changes();
  if(action==='rename')f.git('mv','README.md','new-guide.md');
  if(action==='delete')f.git('rm','-f','README.md');
  if(action==='add')f.put('knowledge-base/en/docs/new-guide.md','New reading.\n');
  // Where the file system records the mode, change it there too: adding the file reads it back.
  if(action==='mode'){f.git('update-index','--chmod=+x','README.md');fs.chmodSync(path.join(f.root,'README.md'),0o755);}
  assert.equal((await selectWindowsMergeChecks(f.root,f.finish())).profile,'full');
 });
}

test('a change that carries any ledger takes the full gate, however exact the ledger is',async t=>{
 for(const action of ['exact refresh','partial','historical shape','ledger only']){
  const f=fixture(t);
  if(action!=='ledger only')f.changes();
  if(action==='exact refresh')f.refresh();
  else if(action==='partial'){
   // One refreshed ledger beside two that still hold the base's rows.
   const kept=ledgers.slice(1).map(file=>fs.readFileSync(path.join(f.root,file)));
   f.refresh();
   for(const [index,file] of ledgers.slice(1).entries())fs.writeFileSync(path.join(f.root,file),kept[index]);
  }else{
   const source=f.read(ledgers[2]);
   if(action==='historical shape')source.history={altered:true};
   else source.files.find(row=>row.path==='unlisted.md').sha256='f'.repeat(64);
   f.encode(ledgers[2],source);
  }
  const route=await selectWindowsMergeChecks(f.root,f.finish());
  assert.equal(route.profile,'full',action);
  assert.match(route.reason,/carries a ledger takes the full gate/,action);
 }
});

test('the selector refuses changes in the checked-out snapshot',async t=>{
 const f=fixture(t);f.changes();const inputs=f.finish();
 f.put('README.md','Post-checkout edit.\n');
 assert.equal((await selectWindowsMergeChecks(f.root,inputs)).profile,'full');
});

test('architecture status slots can change but the same file still protects the governance text',async t=>{
 const status=fixture(t);
 status.put(architecture,architectureBody.replace('2026-11-07','2026-11-12').replace('Old status.','New status.'));
 assert.equal((await selectWindowsMergeChecks(status.root,status.finish())).profile,'documentation');
 const changedPolicy=fixture(t);
 changedPolicy.put(architecture,architectureBody.replace('Keep all required jobs.','Relax a required job.'));
 const refused=await selectWindowsMergeChecks(changedPolicy.root,changedPolicy.finish());
 assert.equal(refused.profile,'full');
 assert.match(refused.reason,/Architecture policy/);
 const hidden=fixture(t);
 hidden.put(architecture,architectureBody.replace('M0 verified outcomes.','M0 verified outcomes. <!--'));
 const hiddenRoute=await selectWindowsMergeChecks(hidden.root,hidden.finish());
 assert.equal(hiddenRoute.profile,'full');
 assert.match(hiddenRoute.reason,/inline prose/);
});

test('a row that is behind on the base does not keep a reading change off the documentation route',async t=>{
 // Between refreshes the base's ledgers describe an earlier state. Nothing is written for a
 // reading change, so a stale unrelated row is neither refreshed nor a reason to refuse.
 const f=fixture(t,{staleDeclaration:true});f.changes();
 const before=fs.readFileSync(path.join(f.root,ledgers[2]));
 const result=await selectWindowsMergeChecks(f.root,f.finish());
 assert.equal(result.profile,'documentation',result.reason);
 assert.deepEqual(fs.readFileSync(path.join(f.root,ledgers[2])),before);
});
