// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,unlinkSync,readdirSync,existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {setImmediate as yieldTask} from 'node:timers/promises';
import {createProjectStore,parseProjectTransaction} from '@egret/project';
import {parseResourceManifest,describeResourceBuild} from '@egret/project/resources';
import {buildResourceManifest} from '@egret/contracts/resources';
import {buildContentProject} from '../tools/content/build.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const get=r=>{assert.equal(r.ok,true,JSON.stringify(r.diagnostics));return r.value;};
const clone=v=>JSON.parse(JSON.stringify(v));
const provenance={origin:'first-party synthetic fixture',license:'Apache-2.0',notice:'Original authored pixels and synthetic metadata; not an Aseprite exporter qualification.'};
function fixture(t,projectId='p_content'){
  const root=mkdtempSync(path.join(os.tmpdir(),'egret-content-build-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  for(const dir of ['sources','build','cache'])mkdirSync(path.join(root,dir));
  const page=PNG.sync.write({width:2,height:1,data:Buffer.from([255,0,0,255,0,255,0,255])},{colorType:6,inputColorType:6,bitDepth:8});
  const other=PNG.sync.write({width:1,height:1,data:Buffer.from([0,0,255,255])},{colorType:6,inputColorType:6,bitDepth:8});
  const frame=(filename,x,duration)=>({filename,frame:{x,y:0,w:1,h:1},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:1,h:1},sourceSize:{w:1,h:1},duration});
  const metadata=Buffer.from(JSON.stringify({frames:[frame('red',0,125),frame('green',1,250)],meta:{app:'https://www.aseprite.org/',version:'1.3.18.6',image:'page.png',format:'RGBA8888',size:{w:2,h:1},scale:'1'}}));
  const files=[['page.png',page,'image/png'],['other.png',other,'image/png'],['atlas.json',metadata,'application/json']].map(([name,bytes,mediaType],index)=>{
    writeFileSync(path.join(root,'sources',name),bytes);return {id:['f_page','f_other','f_atlas'][index],path:'sources/'+name,role:'source',mediaType,sha256:sha(bytes),byteLength:bytes.length};
  });
  const snapshot={projectSchemaVersion:'1.0',projectId,revision:0,name:'Synthetic content build',versions:{engineVersion:'0.0.0',resourceFormatVersion:'1.0',toolProtocolVersion:'1.0'},roots:[],entities:[],files,retiredEntityIds:[],retiredFileIds:[]};
  const recipe=(resourceId,sourceFileId,id,artifactFormatVersion,dependencies=[],settings={})=>({resourceId,sourceFileId,importer:{id,version:'1.0.0'},settings,artifactFormatVersion,dependencies,provenance:clone(provenance)});
  const recipes={format:'egret.content-build-recipe/1',targetProfile:'web-shared/1',recipes:[recipe('e_sequence','f_atlas','egret.sequence','egret.sequence/1',['e_atlas']),recipe('e_atlas','f_atlas','egret.aseprite-atlas','egret.atlas/1',['e_page'],{pageName:'page.png'}),recipe('e_other','f_other','egret.png','png/1'),recipe('e_page','f_page','egret.png','png/1')]};
  const store=get(createProjectStore(snapshot));
  return {root,snapshot,recipes,store,page,options:{projectStore:store,projectRoot:root,recipe:recipes,cacheRoot:path.join(root,'cache'),outputRoot:path.join(root,'build'),selectorId:'e_generation',transactionId:'t_build1'}};
}
function entry(result,id){return result.manifest.entries.find(item=>item.id===id);}
function artifact(result,root,id){return readFileSync(path.join(root,entry(result,id).artifact.path));}

test('cold source import publishes immutable generation then adopts one genuine project transaction',async t=>{
  const f=fixture(t),r=await buildContentProject(f.options);
  assert.equal(r.status,'adopted');assert.equal(r.adoption.status,'committed');assert.equal(f.store.getSnapshot().revision,1);
  assert.deepEqual(r.receipt.resources.map(x=>[x.resourceId,x.cache]),[['e_atlas','miss'],['e_other','miss'],['e_page','miss'],['e_sequence','miss']]);
  assert.equal(r.receipt.work.scanlineBytes,2*(1+2*4)+2*(1+1*4));
  assert.deepEqual(artifact(r,f.root,'e_page'),f.page);
  const atlas=JSON.parse(artifact(r,f.root,'e_atlas')),sequence=JSON.parse(artifact(r,f.root,'e_sequence'));
  assert.equal(atlas.pageDependency,0);assert.deepEqual(atlas.frames.map(x=>x.name),['red','green']);
  assert.deepEqual(sequence.sequenceInput.frames.map(x=>x.durationSeconds),[0.125,0.25]);
  const persisted=get(parseResourceManifest(readFileSync(path.join(f.root,r.manifestPath),'utf8')));
  assert.deepEqual(persisted.entries.map(x=>x.buildKey),r.manifest.entries.map(x=>x.buildKey));
  const rebuilt=get(buildResourceManifest(get(describeResourceBuild(f.store.getSnapshot(),'web-shared/1'))));
  assert.deepEqual(rebuilt.entries,r.manifest.entries);
  const selection=f.store.getSnapshot().entities.find(x=>x.id==='e_generation');assert.equal(selection.data.generationId,r.generationId);
  assert.equal(selection.data.manifestFileId,f.store.getSnapshot().files.find(x=>x.path===r.manifestPath).id);
});

test('warm cache rebinds fresh project identity and output ownership without rerunning importers',async t=>{
  const a=fixture(t),first=await buildContentProject(a.options),b=fixture(t,'p_second');
  const second=await buildContentProject({...b.options,cacheRoot:a.options.cacheRoot});
  assert.equal(second.status,'adopted');assert.equal(second.receipt.work.scanlineBytes,0);assert.ok(second.receipt.resources.every(x=>x.cache==='hit'));
  assert.equal(entry(first,'e_page').buildKey,entry(second,'e_page').buildKey);
  assert.notEqual(entry(first,'e_page').runtimeIdentity,entry(second,'e_page').runtimeIdentity);
  assert.notEqual(first.generationId,second.generationId);assert.deepEqual(artifact(first,a.root,'e_atlas'),artifact(second,b.root,'e_atlas'));
  unlinkSync(path.join(a.root,entry(first,'e_page').artifact.path));assert.deepEqual(artifact(second,b.root,'e_page'),b.page);
});

test('one changed source rebuilds its reverse dependency closure and keeps unrelated image cached',async t=>{
  const f=fixture(t),first=await buildContentProject(f.options),changed=PNG.sync.write({width:2,height:1,data:Buffer.from([255,255,0,255,0,255,0,255])},{colorType:6,inputColorType:6,bitDepth:8});
  writeFileSync(path.join(f.root,'sources/page.png'),changed);
  const next=clone(f.store.getSnapshot());next.files.find(x=>x.id==='f_page').sha256=sha(changed);next.files.find(x=>x.id==='f_page').byteLength=changed.length;
  const second=await buildContentProject({...f.options,projectStore:get(createProjectStore(next)),transactionId:'t_build2'});
  assert.deepEqual(second.receipt.resources.map(x=>[x.resourceId,x.cache]),[['e_atlas','miss'],['e_other','hit'],['e_page','miss'],['e_sequence','miss']]);
  for(const id of ['e_page','e_atlas','e_sequence'])assert.notEqual(entry(first,id).buildKey,entry(second,id).buildKey);
  assert.deepEqual(artifact(first,f.root,'e_page'),f.page);assert.deepEqual(artifact(second,f.root,'e_page'),changed);
});

test('missing secondary cache blob rebuilds but existing corrupt reference bytes fail without adoption',async t=>{
  const f=fixture(t),first=await buildContentProject(f.options),key=entry(first,'e_page').buildKey;
  const record=JSON.parse(readFileSync(path.join(f.root,'cache/records/'+key+'.json'),'utf8')),rgba=record.outputs.find(x=>x.name==='rgba');
  const file=path.join(f.root,'cache/blobs/sha256/'+rgba.sha256);unlinkSync(file);
  const second=await buildContentProject({...f.options,transactionId:'t_build2'});assert.equal(second.receipt.resources.find(x=>x.resourceId==='e_page').cache,'missing-blob');
  writeFileSync(file,Buffer.alloc(rgba.byteLength,9));const before=f.store.getSnapshot();
  await assert.rejects(buildContentProject({...f.options,transactionId:'t_build3'}),e=>e.code==='CONTENT_STORE_INTEGRITY');
  assert.equal(f.store.getSnapshot(),before);assert.deepEqual(readFileSync(file),Buffer.alloc(rgba.byteLength,9));
});

test('cancelled before publication leaves previous project revision and no ready generation',async t=>{
  const f=fixture(t),abort=new AbortController();abort.abort();
  await assert.rejects(buildContentProject({...f.options,signal:abort.signal}),e=>e.code==='CONTENT_BUILD_CANCELLED');
  assert.equal(f.store.getSnapshot().revision,0);assert.deepEqual(readdirSync(path.join(f.root,'build')),[]);
});

test('ready-only generation is complete but does not claim adoption',async t=>{
  const f=fixture(t),r=await buildContentProject({...f.options,adopt:false});
  assert.equal(r.status,'ready');assert.equal(r.adoption.status,'not_requested');assert.equal(f.store.getSnapshot().revision,0);
  assert.equal(sha(readFileSync(path.join(f.root,r.manifestPath))),r.receipt.manifest.sha256);
});

test('actual source mismatch refuses before any cache lookup or project adoption',async t=>{
  const f=fixture(t);writeFileSync(path.join(f.root,'sources/page.png'),Buffer.alloc(f.page.length,7));
  await assert.rejects(buildContentProject(f.options),e=>e.code==='CONTENT_INPUT_INTEGRITY');assert.equal(f.store.getSnapshot().revision,0);
});


test('a concurrent genuine project edit preserves a ready but unadopted generation',async t=>{
  const f=fixture(t),pending=buildContentProject(f.options);
  const transaction=get(parseProjectTransaction(JSON.stringify({command:'edit',toolProtocolVersion:'1.0',projectId:f.snapshot.projectId,transactionId:'t_creator',baseRevision:0,source:{actorId:'creator',actorKind:'creator',toolId:'test',toolVersion:'1',intent:'Rename project during build'},scope:{entityIds:[],fileIds:[],metadata:true,roots:false},operations:[{op:'setMetadata',name:'Creator edit',versions:f.snapshot.versions}]})));
  const edit=f.store.commit(transaction);assert.equal(edit.status,'committed');
  const result=await pending;assert.equal(result.status,'ready');assert.equal(result.adoption.status,'rejected');
  assert.equal(result.adoption.diagnostics[0].code,'PROJECT_REVISION_CONFLICT');assert.equal(f.store.getSnapshot().name,'Creator edit');
  assert.equal(f.store.getSnapshot().entities.length,0);assert.ok(existsSync(path.join(f.root,result.manifestPath)));
});

test('cancellation after observed readiness leaves a reusable complete generation unadopted',async t=>{
  const f=fixture(t),abort=new AbortController(),pending=buildContentProject({...f.options,signal:abort.signal});
  const dir=path.join(f.root,'build/generations');
  let observed=false;
  for(let count=0;count<100&&!observed;count++){
    if(existsSync(dir)&&readdirSync(dir).length){observed=true;abort.abort();break;}
    await yieldTask();
  }
  assert.equal(observed,true);const result=await pending;assert.equal(result.status,'ready');assert.equal(result.adoption.status,'cancelled');
  assert.equal(f.store.getSnapshot().revision,0);assert.ok(existsSync(path.join(f.root,result.manifestPath)));
  const retry=await buildContentProject({...f.options,transactionId:'t_retry'});assert.equal(retry.status,'adopted');
  assert.equal(retry.generationId,result.generationId);assert.ok(retry.receipt.resources.every(x=>x.cache==='hit'));
});

test('source drift after initial read refuses readiness and preserves all previous selection',async t=>{
  const f=fixture(t),before=f.store.getSnapshot(),pending=buildContentProject(f.options);
  const dir=path.join(f.root,'cache/blobs/sha256');let observed=false;
  for(let count=0;count<100&&!observed;count++){
    if(existsSync(dir)&&readdirSync(dir).length){observed=true;writeFileSync(path.join(f.root,'sources/page.png'),Buffer.alloc(f.page.length,3));break;}
    await yieldTask();
  }
  assert.equal(observed,true);await assert.rejects(pending,e=>e.code==='CONTENT_INPUT_INTEGRITY');
  assert.equal(f.store.getSnapshot(),before);assert.deepEqual(readdirSync(path.join(f.root,'build/generations')),[]);
  assert.deepEqual(readdirSync(path.join(f.root,'cache/records')),[]);
});

test('target and version pins participate in rebuild identities without target-specific conversion claims',async t=>{
  const f=fixture(t),first=await buildContentProject(f.options),recipes=clone(f.recipes);recipes.targetProfile='another-shared-target';
  // Use an unadopted snapshot because changing the target of an adopted logical resource is refused.
  const second=await buildContentProject({...f.options,recipe:recipes,projectStore:get(createProjectStore(f.snapshot)),transactionId:'t_target',selectorId:'e_generation2'});
  assert.equal(second.status,'adopted');assert.ok(second.receipt.resources.every(x=>x.cache==='miss'));
  for(const id of ['e_page','e_atlas','e_sequence','e_other'])assert.notEqual(entry(first,id).buildKey,entry(second,id).buildKey);
  assert.deepEqual(artifact(first,f.root,'e_atlas'),artifact(second,f.root,'e_atlas'));
  const snapshot=clone(f.snapshot);snapshot.versions.engineVersion='0.0.1';
  const third=await buildContentProject({...f.options,projectStore:get(createProjectStore(snapshot)),transactionId:'t_version'});
  assert.ok(third.receipt.resources.every(x=>x.cache==='miss'));
});
