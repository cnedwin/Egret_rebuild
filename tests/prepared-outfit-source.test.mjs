// SPDX-License-Identifier: Apache-2.0
// Supplied public PNG ports prove controlled orchestration, never native decoding.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createAssetType, createAssetRef, CancellationController, isTexture } from '@egret/engine';
import { createBrowserTextureProvider } from '@egret/engine/web/image';

const MODULE=new URL('../examples/prepared-resource-groups/source.mjs',import.meta.url);
const ASSETS=new URL('../examples/resource-scene/assets/',import.meta.url);
const PINS=Object.freeze({
  A:{bytes:83,sha256:'376a6eaaeb1ca8861b6a0ee62db3edbb0ec926648f8c20cfd5f6e57c1bf44960'},
  B:{bytes:80,sha256:'c37296e1b63b40da2e17d8cc31d88819f35f52e1d219abc367288fda45ceaa78'},
  C:{bytes:81,sha256:'e27c682265405cf30b6cbe9dc453ea2d7d01235e6c2512286f9fc7e1603dbd66'},
  D:{bytes:83,sha256:'d2c3b3461b2b5d8e6a48608c83528efe78c6a0d3b219dc0038c23ccf016c3f98'},
});
const bytes=id=>new Uint8Array(readFileSync(new URL('outfit-'+id+'.png',ASSETS)));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function observe(promise){return promise.then(value=>({ok:true,value}),cause=>({ok:false,cause}));}
function hasCode(value,code){assert.equal(value?.code,code);return value;}
function fixture(){
  const f={reads:[],decodes:[],canvasCalls:[],canvases:[],bitmaps:[],controls:{},values:[]};
  const type=createAssetType('P03 fixed source public PNG witness',isTexture);
  f.refs=Object.fromEntries(Object.keys(PINS).map(id=>[id,createAssetRef(type,new URL('outfit-'+id+'.png',ASSETS).href)]));
  f.context=()=>{const controller=new CancellationController();return{controller,context:Object.freeze({signal:controller.signal,resourceGeneration:1,taskId:1})};};
  f.makeBitmap=()=>{const bitmap={width:16,height:16,closed:0,close(){bitmap.closed++;if(f.controls.closeThrow)throw f.controls.closeCause;}};f.bitmaps.push(bitmap);return bitmap;};
  f.ports={
    decode(blob,options){f.decodes.push({receiver:this,blob,options});return f.controls.decode?.(blob,options)??Promise.resolve(f.makeBitmap());},
    createCanvas(){f.canvasCalls.push({receiver:this});
      const c={width:300,height:150,isConnected:false,resets:[]};
      const ctx={globalAlpha:1,globalCompositeOperation:'source-over',imageSmoothingEnabled:true,filter:'none',shadowBlur:0,shadowOffsetX:0,shadowOffsetY:0,shadowColor:'rgba(0, 0, 0, 0)',
        getContextAttributes(){return{alpha:true,colorSpace:'srgb'};},setTransform(){},drawImage(){},
        getImageData(){return{width:16,height:16,data:new Uint8ClampedArray(1024).fill(255),colorSpace:'srgb'};}};
      for(const key of ['width','height']){let value=c[key];Object.defineProperty(c,key,{get(){return value;},set(v){value=v;if(v===0)c.resets.push(key);}});}
      c.getContext=function(kind,options){f.canvases.push({canvas:c,receiver:this,kind,options});return ctx;};return c;
    },
  };
  f.options={ports:f.ports,readBytes(ref,context){const row={receiver:this,ref,context,task:undefined};f.reads.push(row);const id=/outfit-([ABCD])\.png$/.exec(ref.id)?.[1];const task=f.controls.read?f.controls.read(ref,context):Promise.resolve(bytes(id));row.task=task;return task;}};
  return f;
}
async function baseline(){
  const f=fixture(),provider=createBrowserTextureProvider(f.options),c=f.context();let value;
  try{value=await provider.load(f.refs.A,c.context);assert.ok(isTexture(value));assert.deepEqual(value.sourceRect,{x:0,y:0,width:16,height:16});
    assert.equal(f.reads[0].ref,f.refs.A);assert.equal(f.reads[0].context,c.context);assert.equal(f.reads[0].receiver,f.options);
    assert.equal(f.decodes[0].receiver,f.ports);assert.equal(f.decodes[0].blob.size,83);assert.deepEqual(f.decodes[0].options,{imageOrientation:'from-image',premultiplyAlpha:'none',colorSpaceConversion:'none'});
    assert.equal(f.bitmaps[0].closed,1);assert.deepEqual(f.canvases[0].canvas.resets,['width','height']);
  }finally{if(value)provider.dispose(value);await provider.close();}
}
async function factory(){await baseline();assert.ok(existsSync(MODULE),'P03_MISSING_OUTFIT_SOURCE');const module=await import(MODULE.href);assert.equal(typeof module.createPreparedOutfitSource,'function','P03_MISSING_OUTFIT_SOURCE_FACTORY');return module.createPreparedOutfitSource;}
async function withSource(body){const create=await factory(),f=fixture(),source=create(f.options);try{await body(source,f);}finally{for(const value of f.values)source.provider.dispose(value);await source.close();}}
async function load(source,f,id='A',c=f.context()){const value=await source.provider.load(f.refs[id],c.context);f.values.push(value);return value;}
const idle={state:'open',activeJobs:0,pendingReads:0,encodedReservedBytes:0,rawOwnedBytes:0,decodedLiveBytes:0,liveValues:0};

// A bypassed genuine provider, changed receiver or missing retirement breaks this control.
test('PGS00 genuine public fixed PNG provider baseline', {timeout:10000},baseline);

// Missing authentication/evidence or replacement-reader capture breaks real consumer output.
test('PGS01 fixed A-D authenticated evidence and original reader capture', {timeout:10000},async()=>withSource(async(source,f)=>{
  const captured=f.options.readBytes,decode=Object.getOwnPropertyDescriptor(f.ports,'decode'),canvas=Object.getOwnPropertyDescriptor(f.ports,'createCanvas');
  captured.call=captured.apply=()=>{throw new Error('mutable invocation');};f.options.readBytes=()=>{throw new Error('replacement reader');};
  f.ports.decode=f.ports.createCanvas=()=>{throw new Error('replacement PNG operation');};
  try{
  assert.ok(Object.isFrozen(source));assert.ok(Object.isFrozen(source.provider));assert.ok(Object.isFrozen(source.sourceLedger));
  for(const id of ['A','B','C','D']){const c=f.context(),value=await load(source,f,id,c);assert.ok(isTexture(value));assert.equal(f.reads.at(-1).ref,f.refs[id]);assert.equal(f.reads.at(-1).context,c.context);assert.equal(f.reads.at(-1).receiver,f.options);
    const evidence=source.assetEvidence.get(value);assert.ok(Object.isFrozen(evidence));assert.deepEqual(evidence,{assetId:id,...PINS[id],width:16,height:16,contentRevision:'p02-outfits-r1',layoutRevision:'two-layer-r1'});}
  assert.equal(f.decodes.length,4);assert.equal(f.canvasCalls.length,4);assert.ok(f.decodes.every(row=>row.receiver===f.ports));assert.ok(f.canvasCalls.every(row=>row.receiver===f.ports));
  assert.deepEqual(source.snapshot(),{...idle,decodedLiveBytes:4096,liveValues:4});assert.ok(Object.isFrozen(source.snapshot()));
  const closing=source.close();assert.equal(source.close(),closing);await closing;assert.equal(source.snapshot().decodedLiveBytes,4096);
  for(const value of f.values){source.provider.dispose(value);source.provider.dispose(value);}assert.deepEqual(source.snapshot(),{...idle,state:'closed'});
  }finally{Object.defineProperty(f.ports,'decode',decode);Object.defineProperty(f.ports,'createCanvas',canvas);}
}));

// Admitting changed same-size or wrong-length bytes would allow a wrong fixed outfit.
test('PGS02 changed hash and length refuse before decode', {timeout:10000},async()=>withSource(async(source,f)=>{
  for(const value of [(()=>{const b=bytes('A');b[b.length-1]^=1;return b;})(),bytes('A').subarray(1)]){f.controls.read=()=>Promise.resolve(value);const result=await observe(source.provider.load(f.refs.A,f.context().context));assert.equal(result.ok,false);hasCode(hasCode(result.cause,'WEB_PNG_READ_FAILED').cause,'PREPARED_OUTFIT_SOURCE_IDENTITY');}
  assert.equal(f.decodes.length,0);assert.deepEqual(source.snapshot(),idle);
  const foreign=createAssetRef(f.refs.A.type,'https://unselected.invalid/outfit-A.png');const result=await observe(source.provider.load(foreign,f.context().context));hasCode(result.cause,'PREPARED_OUTFIT_SOURCE_NOT_SELECTED');assert.equal(f.reads.length,2);
}));

// Refunding occupied work or adding active after the reader permits a fifth reentrant job.
test('PGS03 four original jobs are occupied before reader reentry', {timeout:10000},async()=>withSource(async(source,f)=>{
  const gates=Array.from({length:4},deferred),seen=[],nested=[],contexts=Array.from({length:5},()=>f.context()),jobs=[];let calls=0;
  f.controls.read=()=>{const n=calls++;seen.push([...source.sourceLedger.active]);if(n<3)nested.push(source.provider.load(f.refs.A,contexts[n+1].context));else nested.push(source.provider.load(f.refs.A,contexts[4].context));return gates[n].promise;};
  const first=source.provider.load(f.refs.A,contexts[0].context);jobs.push(first,...nested.slice().reverse());
  try{assert.equal(calls,4);assert.deepEqual(seen.map(set=>set.length),[1,2,3,4]);assert.ok(seen[0].includes(first));assert.ok(source.sourceLedger.active.has(first));
    const fifth=await observe(nested[0]);assert.equal(fifth.ok,false);hasCode(fifth.cause,'PREPARED_OUTFIT_SOURCE_LIMIT');
    const busy=await observe(source.provider.load(f.refs.B,contexts[0].context));hasCode(busy.cause,'PREPARED_OUTFIT_SOURCE_CONTEXT_BUSY');
    assert.deepEqual(source.snapshot(),{...idle,activeJobs:4,pendingReads:4,encodedReservedBytes:332});
  }finally{for(const gate of gates)gate.resolve(bytes('A'));}
  const results=await Promise.allSettled(jobs);for(const result of results)if(result.status==='fulfilled')f.values.push(result.value);
  assert.equal(source.sourceLedger.active.size,0);assert.equal(source.snapshot().decodedLiveBytes,4096);
}));

// Caller cancellation cannot make an unfulfilled reader physically disappear.
test('PGS04 cancelled original reader keeps reservation through actual settlement', {timeout:10000},async()=>withSource(async(source,f)=>{
  const gate=deferred(),c=f.context();f.controls.read=()=>gate.promise;const original=source.provider.load(f.refs.A,c.context),result=observe(original);
  try{c.controller.abort('reader cancellation');await nextTurn();assert.equal(source.sourceLedger.active.has(original),true);assert.deepEqual(source.snapshot(),{...idle,activeJobs:1,pendingReads:1,encodedReservedBytes:83});}
  finally{gate.resolve(bytes('A'));}const rejected=await result;assert.equal(rejected.ok,false);hasCode(rejected.cause,'WEB_PNG_CANCELLED');assert.equal(f.decodes.length,0);assert.deepEqual(source.snapshot(),idle);
}));

// Dropping raw ownership or treating PNG cancellation as decode completion undercounts work.
test('PGS05 pending original decode keeps raw bytes until late bitmap retires', {timeout:10000},async()=>withSource(async(source,f)=>{
  const gate=deferred(),entered=deferred(),c=f.context();f.controls.decode=()=>{entered.resolve();return gate.promise;};const original=source.provider.load(f.refs.A,c.context),result=observe(original);let late;
  try{await entered.promise;c.controller.abort('decode cancellation');await nextTurn();assert.equal(source.sourceLedger.active.has(original),true);assert.deepEqual(source.snapshot(),{...idle,activeJobs:1,encodedReservedBytes:83,rawOwnedBytes:83});}
  finally{late=f.makeBitmap();gate.resolve(late);}const rejected=await result;assert.equal(rejected.ok,false);hasCode(rejected.cause,'WEB_PNG_CANCELLED');assert.equal(late.closed,1);assert.equal(f.canvases.length,0);assert.deepEqual(source.snapshot(),idle);
}));

// Replacing undefined failure or freeing work before rejected reader settlement loses evidence.
test('PGS06 original undefined reader rejection survives close', {timeout:10000},async()=>withSource(async(source,f)=>{
  const gate=deferred();f.controls.read=()=>gate.promise;const original=source.provider.load(f.refs.A,f.context().context),result=observe(original);let closing,settled=false;
  try{closing=source.close();void closing.then(()=>{settled=true;},()=>{settled=true;});assert.equal(source.close(),closing);await nextTurn();assert.equal(settled,false);assert.equal(source.sourceLedger.active.has(original),true);
    const refused=await observe(source.provider.load(f.refs.A,f.context().context));hasCode(refused.cause,'PREPARED_OUTFIT_SOURCE_CLOSED');}
  finally{gate.reject(undefined);}const rejected=await result;hasCode(rejected.cause,'WEB_PNG_READ_FAILED');assert.equal(rejected.cause.cause,undefined);await closing;assert.deepEqual(source.snapshot(),{...idle,state:'closed'});
}));

// Hiding native quarantine would incorrectly claim successful source close.
test('PGS07 genuine PNG retirement failure remains observable at close', {timeout:10000},async()=>{
  const create=await factory(),f=fixture(),failure=new Error('controlled bitmap retirement');f.controls.closeThrow=true;f.controls.closeCause=failure;const source=create(f.options);
  try{
  const result=await observe(source.provider.load(f.refs.A,f.context().context));assert.equal(result.ok,false);assert.ok(result.cause.cleanupErrors.includes(failure));assert.equal(f.bitmaps[0].closed,1);assert.equal(source.snapshot().activeJobs,0);
  const closing=source.close();assert.equal(source.close(),closing);const closed=await observe(closing);assert.equal(closed.ok,false);hasCode(closed.cause,'WEB_PNG_CLOSE_INCOMPLETE');assert.ok(closed.cause.cleanupErrors.includes(failure));
  }finally{await observe(source.close());}
});

// Early close completion or stealing already-issued values breaks manager ownership.
test('PGS08 close waits late decode and preserves already issued manager values', {timeout:10000},async()=>withSource(async(source,f)=>{
  const issued=await load(source,f,'B'),gate=deferred(),entered=deferred();f.controls.decode=()=>{entered.resolve();return gate.promise;};const pending=observe(source.provider.load(f.refs.A,f.context().context));let closing,settled=false,late;
  try{await entered.promise;closing=source.close();void closing.then(()=>{settled=true;},()=>{settled=true;});await nextTurn();assert.equal(settled,false);assert.equal(source.snapshot().liveValues,1);assert.ok(isTexture(issued));}
  finally{late=f.makeBitmap();gate.resolve(late);}const result=await pending;assert.equal(result.ok,false);hasCode(result.cause,'WEB_PNG_PROVIDER_CLOSED');await closing;assert.equal(late.closed,1);assert.equal(source.snapshot().decodedLiveBytes,1024);
  source.provider.dispose(issued);assert.equal(source.snapshot().decodedLiveBytes,0);assert.throws(()=>source.provider.dispose({}),cause=>cause.code==='PREPARED_OUTFIT_SOURCE_VALUE_INVALID');
}));
