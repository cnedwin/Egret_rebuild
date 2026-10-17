// SPDX-License-Identifier: Apache-2.0
// Real Git changes prove conservative selection across all contributor states.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
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
