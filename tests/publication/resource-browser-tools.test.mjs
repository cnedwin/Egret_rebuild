// SPDX-License-Identifier: Apache-2.0
// Controls for the current resource-family adapter; native evidence is separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const target=new URL('../../tools/browser-resources.mjs',import.meta.url);
async function api(){assert.ok(fs.existsSync(target),'Current resource-family entry must exist');return import(target.href);}
test('resource families have complete fixed schedules, including importer cases',async()=>{
 const {resourceCases}=await api();
 assert.deepEqual(resourceCases('prepared-groups').map(x=>[x.profile,x.kind]),['canvas-2d','webgpu-scene-textured'].flatMap(p=>['ordinary','manual-old-A-outer','manual-old-B-trim'].map(k=>[p,k])));
 assert.equal(resourceCases('atlas').length,8);
 assert.equal(resourceCases('atlas').filter(x=>x.kind==='atlas-import-v1').length,2);
 assert.throws(()=>resourceCases('unknown'));
});
test('resource command requires exact options and explicit reviewed digest',async()=>{
 const {parseResourceOptions}=await api();
 assert.equal(parseResourceOptions(['run','--manifest',path.resolve('manifest.json'),'--sha256','a'.repeat(64)]).sha256,'a'.repeat(64));
 assert.throws(()=>parseResourceOptions(['run','--manifest','relative.json','--sha256','a'.repeat(64)]));
 assert.throws(()=>parseResourceOptions(['run','--manifest',path.resolve('manifest.json')]));
 assert.throws(()=>parseResourceOptions(['prepare','--suite','atlas','--playwright',path.resolve('pw'),'--output',path.resolve('out'),'--kind','ordinary']));
 assert.throws(()=>parseResourceOptions(['prepare','--suite','png','--playwright',path.resolve('pw'),'--output',path.resolve('out')]));
});
test('resource manifest refuses missing cases or changes before any child runs',async()=>{
 const {validateResourceManifest}=await api();
 const base={schemaVersion:1,status:'PREPARED_REVIEW_REQUIRED',reviewed:false,browserRun:false,repository:fileURLToPath(new URL('../..',import.meta.url))};
 assert.throws(()=>validateResourceManifest({...base,suite:'atlas',cases:[]}),/schedule/i);
 assert.throws(()=>validateResourceManifest({...base,suite:'prepared-groups',cases:[{profile:'canvas-2d',kind:'ordinary'}]}),/schedule/i);
});
test('resource completion refuses a success label without controls and retirement',async()=>{
 const {validateResourceCompletion}=await api();
 for(const suite of ['prepared-groups','atlas','png'])assert.throws(()=>validateResourceCompletion(suite,{profile:'canvas-2d',kind:'ordinary'},{status:'PASS'}),/receipt|completion/i);
 const good={status:'PASS',environment:{node:'v26.7.0',browserVersion:'test',playwrightVersion:'1.62.1'},nativeScenario:{profile:'canvas-2d',kind:'ordinary'},nativeAcceptance:'FINITE_NATIVE_SEQUENCE_PASS',ordinaryAccepted:true,failures:[],retirementFailures:[],pendingOriginalTasks:0,rawFrames:Array.from({length:17},()=>({status:'COMPARISON_SAVED'})),fixtureResult:{cases:[{ok:true},{ok:true}]},acquiredOwners:['server','browser'],retired:{server:true,browser:true}};
 validateResourceCompletion('prepared-groups',{profile:'canvas-2d',kind:'ordinary'},good);
 for(const patch of [{pendingOriginalTasks:1},{fixtureResult:{cases:[{ok:true}]}},{rawFrames:[]},{rawFrames:good.rawFrames.slice(1)},{retired:{server:true,browser:false}}])assert.throws(()=>validateResourceCompletion('prepared-groups',{profile:'canvas-2d',kind:'ordinary'},{...good,...patch}));
});

test('atlas copied collector dependencies cannot drift behind a pinned entry',async()=>{
 const {verifyAtlasCollectorCopy}=await api();
 assert.equal(typeof verifyAtlasCollectorCopy,'function');
 const root=fileURLToPath(new URL('../..',import.meta.url));
 const owner=fs.mkdtempSync(path.join(os.tmpdir(),'egret-atlas-copy-'));
 try{
  for(const key of ['tools/verify-atlas-frame.mjs','tools/atlas-frame/boundary.mjs','tools/atlas-frame/scenario.mjs','tools/lib/file-identity.mjs']){fs.mkdirSync(path.dirname(path.join(owner,key)),{recursive:true});fs.copyFileSync(path.join(root,key),path.join(owner,key));}
  verifyAtlasCollectorCopy(owner,'ordinary');
  fs.appendFileSync(path.join(owner,'tools/atlas-frame/boundary.mjs'),'\n// altered\n');
  assert.throws(()=>verifyAtlasCollectorCopy(owner,'ordinary'),/Copied collector/);
 }finally{fs.rmSync(owner,{recursive:true,force:true});}
});


test('reviewed case bytes are rechecked even when rewritten JSON has equal meaning',async()=>{
 const {verifyResourceCasePins}=await api();
 assert.equal(typeof verifyResourceCasePins,'function');
 const {createHash}=await import('node:crypto');
 const owner=fs.mkdtempSync(path.join(os.tmpdir(),'egret-case-pin-'));
 const file=path.join(owner,'input.json'),original=Buffer.from('{"value":1}');
 fs.writeFileSync(file,original);
 const pin={path:file,bytes:original.length,sha256:createHash('sha256').update(original).digest('hex')};
 try{
  for(const suite of ['prepared-groups','atlas','png']){
   const row={config:pin,snapshot:pin,preparation:pin,admission:pin};
   verifyResourceCasePins(suite,row);
   fs.writeFileSync(file,'{ "value": 1 }');
   assert.throws(()=>verifyResourceCasePins(suite,row),/Raw input drift/);
   fs.writeFileSync(file,original);
  }
  // The fingerprint helper uses its imported reader; this intercepts the later adapter read only.
  const read=fs.readFileSync;
  try{fs.readFileSync=function(target,...args){if(target===file)return Buffer.from('{"value":2}');return read.call(this,target,...args);};
   assert.throws(()=>verifyResourceCasePins('png',{admission:pin}),/Raw input drift/);
  }finally{fs.readFileSync=read;}
 }finally{fs.rmSync(owner,{recursive:true,force:true});}
});


test('PNG graph admits the current hoisted owner and rejects old or foreign owners',async()=>{
 const {verifyBrowserPngDependencyOwner}=await import('../../tools/browser-png/file-graph.mjs');
 assert.equal(typeof verifyBrowserPngDependencyOwner,'function');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'egret-png-owner-'));
 try{
  for(const relative of ['node_modules/robust-predicates','node_modules/.pnpm/robust-predicates@3.0.3/node_modules/robust-predicates','foreign/node_modules/robust-predicates'])fs.mkdirSync(path.join(root,relative),{recursive:true});
  assert.equal(verifyBrowserPngDependencyOwner(root,path.join(root,'node_modules/robust-predicates')),'node_modules/robust-predicates');
  for(const relative of ['node_modules/.pnpm/robust-predicates@3.0.3/node_modules/robust-predicates','foreign/node_modules/robust-predicates'])assert.throws(()=>verifyBrowserPngDependencyOwner(root,path.join(root,relative)),/DEPENDENCY_OWNER/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
