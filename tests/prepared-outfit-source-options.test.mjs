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

async function sourceBaseline(){
  const create=await factory(),f=fixture(),source=create(f.options);let value;
  try{value=await source.provider.load(f.refs.A,f.context().context);assert.ok(isTexture(value));assert.equal(source.assetEvidence.get(value).sha256,'376a6eaaeb1ca8861b6a0ee62db3edbb0ec926648f8c20cfd5f6e57c1bf44960');assert.equal(source.snapshot().decodedLiveBytes,1024);}
  finally{if(value)source.provider.dispose(value);await source.close();}
  return create;
}
async function refused(create,input){let accidental;try{assert.throws(()=>{accidental=create(input);},cause=>{assert.equal(cause.code,'PREPARED_OUTFIT_SOURCE_OPTIONS_INVALID');return true;});}finally{if(accidental)await accidental.close();}}

// Nonrecord input must fail at the source boundary rather than become browser work.
for(const [name,input] of [['null',null],['array',[]],['number',0],['string','options'],['function',()=>{}]]){
  test('PGSX01 source refuses '+name+' options before browser work',{timeout:10000},async()=>{const create=await sourceBaseline();await refused(create,input);});
}
// Only undefined chooses the default; an explicitly invalid reader never does.
for(const [name,reader] of [['null',null],['number',1],['object',{}]]){
  test('PGSX02 source refuses explicit '+name+' reader',{timeout:10000},async()=>{const create=await sourceBaseline(),f=fixture();await refused(create,{readBytes:reader,ports:f.ports});});
}
test('PGSX03 omitted and explicit undefined reader can construct the default with supplied PNG ports',{timeout:10000},async()=>{
  const create=await sourceBaseline();for(const explicit of [false,true]){const f=fixture(),options={ports:f.ports};if(explicit)options.readBytes=undefined;const source=create(options);try{assert.deepEqual(source.snapshot(),idle);}finally{await source.close();}}
});
