// SPDX-License-Identifier: Apache-2.0
// Real Git fixtures verify contributor isolation and deterministic integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {planMetadata,writeMetadata,checkIntegrated,isolatedGitEnvironment} from '../../tools/contribution-metadata.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'egret 贡献 ledger ')));
 const git=(...args)=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8',env:{...isolatedGitEnvironment(),GIT_CONFIG_GLOBAL:path.join(root,'.git','isolated-global.conf'),GIT_CONFIG_NOSYSTEM:'1'}});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
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

test('hook-local Git ownership cannot redirect a fixture or metadata read to another repository',()=>{
 const owner=fixture(),previous=new Map(['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR'].map(k=>[k,process.env[k]]));let other;
 const index=fs.readFileSync(path.join(owner.root,'.git/index'));
 try{
  process.env.GIT_DIR=path.join(owner.root,'.git');process.env.GIT_COMMON_DIR=process.env.GIT_DIR;
  process.env.GIT_WORK_TREE=owner.root;process.env.GIT_INDEX_FILE=path.join(owner.root,'.git/index');
  other=fixture();other.put('tool.mjs','export const value=9;\n');
  assert.ok(planMetadata(other.root,{base:other.base}).changed.includes('tool.mjs'));
  assert.equal(owner.git('rev-parse','HEAD'),owner.base);
  assert.deepEqual(fs.readFileSync(path.join(owner.root,'.git/index')),index);
 }finally{
  for(const [k,v]of previous)if(v===undefined)delete process.env[k];else process.env[k]=v;
  other?.close();owner.close();
 }
});


test('new frozen compiler observations require exact reviewed bytes and remain immutable across bases',()=>{
 const f=fixture();try{
  const file='tests/types/new-diagnostic-expectations.json',body='{"observed":true}\n';
  f.put(file,body);
  const row={path:file,bytes:Buffer.byteLength(body),sha256:hash(Buffer.from(body)),originRole:'Reviewed first-party actual compiler observation; Apache-2.0.'};
  f.put('contributions/frozen.json',JSON.stringify({schemaVersion:1,files:[],documents:[],frozenInputs:[row]}));
  const plan=planMetadata(f.root,{base:f.base});
  assert.deepEqual(JSON.parse(plan.outputs['source-origin.json']).files.find(x=>x.path===file),row);
  writeMetadata(f.root,plan);checkIntegrated(f.root,planMetadata(f.root,{base:f.base}));
  f.git('add','.');f.git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','frozen observation');
  const accepted=f.git('rev-parse','HEAD');
  checkIntegrated(f.root,planMetadata(f.root,{base:accepted}));
  f.put(file,'{"observed":false}\n');
  assert.throws(()=>planMetadata(f.root,{base:accepted}),/frozen.*identity/i);
  const changed={...row,bytes:fs.statSync(path.join(f.root,file)).size,sha256:hash(fs.readFileSync(path.join(f.root,file)))};
  f.put('contributions/frozen.json',JSON.stringify({schemaVersion:1,files:[],documents:[],frozenInputs:[changed]}));
  assert.throws(()=>planMetadata(f.root,{base:accepted}),/frozen.*baseline/i);
 }finally{f.close();}
});

test('frozen compiler registration rejects wrong digests, duplicate paths and other preserved domains',()=>{
 const f=fixture();try{
  const file='tests/types/new-diagnostic-expectations.json',body='{}\n';f.put(file,body);
  const row={path:file,bytes:Buffer.byteLength(body),sha256:hash(Buffer.from(body)),originRole:'Reviewed first-party compiler fixture; Apache-2.0.'};
  const put=rows=>f.put('contributions/frozen.json',JSON.stringify({schemaVersion:1,files:[],documents:[],frozenInputs:rows}));
  put([{...row,sha256:'0'.repeat(64)}]);assert.throws(()=>planMetadata(f.root,{base:f.base}),/frozen.*identity/i);
  put([row,row]);assert.throws(()=>planMetadata(f.root,{base:f.base}),/duplicate.*frozen/i);
  for(const other of ['knowledge-base/evidence/raw.json','third-party/NOTICE','work/new-diagnostic-expectations.json','tests/types/ordinary.json']){
   f.put(other,body);put([{...row,path:other}]);assert.throws(()=>planMetadata(f.root,{base:f.base}),/frozen.*path/i);fs.unlinkSync(path.join(f.root,other));
  }
 }finally{f.close();}
});

test('new frozen registration cannot relabel an unregistered original already present at the base',()=>{
 const f=fixture();try{
  const file='tests/types/old-diagnostic-expectations.json',body='{}\n';f.put(file,body);
  f.git('add',file);f.git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','old unregistered original');
  const base=f.git('rev-parse','HEAD');
  f.put('contributions/frozen.json',JSON.stringify({schemaVersion:1,files:[],documents:[],frozenInputs:[{path:file,bytes:Buffer.byteLength(body),sha256:hash(Buffer.from(body)),originRole:'Reviewed first-party compiler fixture; Apache-2.0.'}]}));
  assert.throws(()=>planMetadata(f.root,{base}),/frozen.*already.*base/i);
 }finally{f.close();}
});


test('first pngjs license registration preserves its exact reviewed upstream bytes',()=>{
 const f=fixture();try{
  const file='third-party/pngjs-7.0.0.LICENSE',body=fs.readFileSync(new URL('../../third-party/pngjs-7.0.0.LICENSE',import.meta.url));
  f.put(file,body);const row={path:file,bytes:body.length,sha256:hash(body),originRole:'Unmodified upstream pngjs 7.0.0 MIT license; reviewed build-only dependency.'};
  f.put('contributions/pngjs-content.json',JSON.stringify({schemaVersion:1,files:[],documents:[],frozenInputs:[row]}));
  const plan=planMetadata(f.root,{base:f.base});writeMetadata(f.root,plan);checkIntegrated(f.root,planMetadata(f.root,{base:f.base}));
  assert.deepEqual(JSON.parse(plan.outputs['source-origin.json']).files.find(x=>x.path===file),row);
  f.put(file,Buffer.concat([body,Buffer.from('changed')]));assert.throws(()=>planMetadata(f.root,{base:f.base}),/frozen|reviewed|license/i);
  f.put(file,body);const wrong={...row,path:'third-party/unreviewed.LICENSE'};f.put(wrong.path,body);
  f.put('contributions/pngjs-content.json',JSON.stringify({schemaVersion:1,files:[],documents:[],frozenInputs:[wrong]}));
  assert.throws(()=>planMetadata(f.root,{base:f.base}),/frozen|reviewed|license/i);
 }finally{f.close();}
});
