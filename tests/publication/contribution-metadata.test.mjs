// SPDX-License-Identifier: Apache-2.0
// Real Git fixtures verify contributor isolation and deterministic integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {planMetadata,writeMetadata,checkIntegrated} from '../../tools/contribution-metadata.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'egret 贡献 ledger ')));
 const git=(...args)=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 const put=(f,s)=>{fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),s);};
 put('guide.md','# Guide\n');put('guide.zh-CN.md','# 指南\n');put('tool.mjs','export const value=1;\n');
 const pin=f=>({path:f,bytes:fs.statSync(path.join(root,f)).size,sha256:hash(fs.readFileSync(path.join(root,f)))});
 put('localization.json',JSON.stringify({schemaVersion:1,semanticReview:{status:'reviewed_with_scope'},documents:[{en:'guide.md',zh:'guide.zh-CN.md',kind:'public_reading',enSha256:pin('guide.md').sha256,zhSha256:pin('guide.zh-CN.md').sha256}],criticalComments:[],registries:[]} ,null,2)+'\n');
 put('knowledge-base/documentation-layout.json',JSON.stringify({documents:[],history:{sha256:'unchanged'}},null,2)+'\n');
 put('source-origin.json',JSON.stringify({history:{sha256:'original'},files:['guide.md','guide.zh-CN.md','tool.mjs','localization.json','knowledge-base/documentation-layout.json'].map(f=>({...pin(f),originRole:'Original fixture'}))},null,2)+'\n');
 git('init','-q');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','baseline');
 return {root,git,put,base:git('rev-parse','HEAD'),close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('two content-only branches integrate deterministically without editing shared ledgers',()=>{
 const f=fixture();try{
  f.git('switch','-qc','docs');f.put('guide.md','# Guide updated\n');f.put('guide.zh-CN.md','# 指南更新\n');f.git('add','.');f.git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','docs');
  const docs=f.git('rev-parse','HEAD');assert.equal(f.git('diff','--name-only',f.base,docs).includes('json'),false);
  f.git('switch','-qc','tool',f.base);f.put('tool.mjs','export const value=2;\n');f.git('add','.');f.git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','tool');
  f.git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','merge','--no-edit',docs);
  const before=fs.readFileSync(path.join(f.root,'source-origin.json'));
  const plan=planMetadata(f.root,{base:f.base});assert.deepEqual(planMetadata(f.root,{base:f.base}).outputs,plan.outputs);
  assert.deepEqual(fs.readFileSync(path.join(f.root,'source-origin.json')),before);
  assert.throws(()=>checkIntegrated(f.root,plan),/not integrated/);
  writeMetadata(f.root,plan);checkIntegrated(f.root,planMetadata(f.root,{base:f.base}));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.root,'source-origin.json'))).history,{sha256:'original'});
  f.put('guide.md','# Changed after generation\n');assert.throws(()=>checkIntegrated(f.root,planMetadata(f.root,{base:f.base})),/not integrated/);
 }finally{f.close();}
});
test('changed originals and unauthorized metadata history cannot be rehashed',()=>{
 const f=fixture();try{
  f.put('knowledge-base/evidence/raw.json','{}\n');assert.throws(()=>planMetadata(f.root,{base:f.base}),/preserved|declaration/);
  fs.unlinkSync(path.join(f.root,'knowledge-base/evidence/raw.json'));
  const o=JSON.parse(fs.readFileSync(path.join(f.root,'source-origin.json')));o.history.sha256='tampered';f.put('source-origin.json',JSON.stringify(o));
  assert.throws(()=>planMetadata(f.root,{base:f.base}),/metadata structure/);
 }finally{f.close();}
});
test('new first-party files require isolated declarations and retain raw identity',()=>{
 const f=fixture();try{
  f.put('extra.mjs','// An original fixture module.\nexport {};\n');assert.throws(()=>planMetadata(f.root,{base:f.base}),/declaration/);
  f.put('contributions/extra.json',JSON.stringify({schemaVersion:1,files:[{path:'extra.mjs',originRole:'Independently authored fixture; Apache-2.0.',criticalComment:true}],documents:[]}));
  const p=planMetadata(f.root,{base:f.base});assert.ok(JSON.parse(p.outputs['source-origin.json']).files.some(x=>x.path==='extra.mjs'));
  f.put('extra.mjs','// An original fixture module.\r\nexport {};\r\n');assert.notEqual(planMetadata(f.root,{base:f.base}).outputs['source-origin.json'],p.outputs['source-origin.json']);
 }finally{f.close();}
});

test('private and generated files cannot enter public contribution declarations',()=>{
 const f=fixture();try{
  f.put('work/private.mjs','export {};\n');
  f.put('contributions/private.json',JSON.stringify({schemaVersion:1,files:[{path:'work/private.mjs',originRole:'Private fixture; never publish.'}],documents:[]}));
  assert.throws(()=>planMetadata(f.root,{base:f.base}),/excluded/);
 }finally{f.close();}
});
