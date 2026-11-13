// SPDX-License-Identifier: Apache-2.0
// CPU UNIT: synthetic already-prepared metadata verifies fees and ordering.
// Genuine public ImageData2D supplies the bounded cold-copy witnesses.
// Missing new helper availability is RED, not a native or SDK acceptance result.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageData2D } from '@egret/engine';
import {
  SharedStorageError2D, planSharedStorageFees2D, withSharedReadbackLayout2D,
  checkSharedCapacity2D, materializeSharedPages2D,
} from '../packages/engine/dist/web/sharedSubmissionStorage2D.js';
import { canonicalPage } from '../tools/shared-rendering/oracle.mjs';
import * as gpu from '../packages/engine/dist/web/prepareSharedSubmission2D.js';

const MiB=1024*1024;
// A Host that admits 16 MiB of pages in a frame: page textures and conversion memory are then
// each bounded by twice that, the 32 MiB the cases below fill to the byte.
const limits=Object.freeze({maxUploadBytes:32*MiB,maxPendingUploadBytes:64*MiB,
  maxPendingFrames:2,maxReadbackBytes:64*MiB,maxPendingGeometryBytes:32*MiB,maxFramePageBytes:16*MiB});
const owner=()=>({pendingFrames:0,pendingUploadBytes:0,pendingReadbackBytes:0,
  pendingTextureBytes:0,pendingGeometryBytes:0,pendingColorBytes:0,
  pendingCanonicalBytes:0,serial:0});
const prepared=(changes={})=>({width:65,height:2,upload:8,pageBytes:8,
  geometryBytes:44,entries:[],frame:{pages:[]},effects:{groups:[],depth:0,targetCount:0,uniformBytes:0},...changes});
const hardware=(changes={})=>({maxTextureDimension2D:16384,maxBufferSize:128*MiB,...changes});
const reason=expected=>error=>error instanceof SharedStorageError2D&&error.reason===expected;
const tight=(p=prepared(),options=limits)=>{
  const fees=planSharedStorageFees2D(p,options);
  return {...withSharedReadbackLayout2D(fees,{rowPitch:4*p.width,staging:4*p.width*p.height,output:4*p.width*p.height}),
    projectionPlan:{views:[],commandViews:[],projectionBytes:p.pageBytes,scratchBytes:0}};
};

test('UNIT SST01 shared fee identity survives the WebGPU compatibility facade',()=>{
  assert.equal(gpu.SharedStorageError2D,SharedStorageError2D);
  assert.equal(gpu.checkSharedCapacity2D,checkSharedCapacity2D);
  assert.equal(gpu.materializeSharedPages2D,materializeSharedPages2D);
  const p=prepared(),fees=planSharedStorageFees2D(p,limits);
  assert.equal(fees.prepared,p);assert.equal(fees.options,limits);
  assert.equal(fees.upload,8);assert.equal(fees.colorBytes,520);
});

test('UNIT SST02 concrete GL tight rows and original WebGPU 256-byte rows have distinct fees',()=>{
  const p=prepared(),gl=tight(p),w=gpu.planSharedSubmission2D(p,limits,hardware(),owner(),true);
  assert.deepEqual([gl.rowPitch,gl.staging,gl.output],[260,520,520]);
  assert.deepEqual([w.rowPitch,w.staging,w.output],[512,1024,520]);
  assert.equal(gl.upload,w.upload);assert.equal(gl.colorBytes,w.colorBytes);
  const none=gpu.planSharedSubmission2D(p,limits,hardware(),owner(),false);
  assert.deepEqual([none.rowPitch,none.staging,none.output],[0,0,0]);
  assert.equal(none.prepared,p);assert.equal(none.options,limits);
  const fees=planSharedStorageFees2D(p,{...limits,maxReadbackBytes:1040});
  assert.doesNotThrow(()=>withSharedReadbackLayout2D(fees,{rowPitch:260,staging:520,output:520}));
  assert.throws(()=>withSharedReadbackLayout2D(planSharedStorageFees2D(p,{...limits,maxReadbackBytes:1039}),
    {rowPitch:260,staging:520,output:520}),reason('budget'));
});

test('UNIT SST03 logical upload and color caps retain exact-fit and plus-one refusal',()=>{
  assert.equal(planSharedStorageFees2D(prepared({width:4096,height:4096}),limits).colorBytes,64*MiB);
  assert.throws(()=>planSharedStorageFees2D(prepared({width:4097,height:4096}),limits),reason('budget'));
  assert.equal(planSharedStorageFees2D(prepared({upload:32*MiB}),limits).upload,32*MiB);
  assert.throws(()=>planSharedStorageFees2D(prepared({upload:32*MiB+1}),limits),reason('budget'));
});

test('UNIT SST04 all pending dimensions retain exact remaining capacity and serial priority',()=>{
  const s=tight(prepared(),limits);
  const cases=[['pendingFrames',2,1],['pendingUploadBytes',64*MiB,8],
    ['pendingReadbackBytes',64*MiB,1040],['pendingTextureBytes',32*MiB,8],
    ['pendingGeometryBytes',32*MiB,44],['pendingColorBytes',128*MiB,520],
    ['pendingCanonicalBytes',32*MiB,16]];
  for(const [key,cap,amount]of cases){
    assert.doesNotThrow(()=>checkSharedCapacity2D(s,{...owner(),[key]:cap-amount},8,8),key+' exact fit');
    assert.throws(()=>checkSharedCapacity2D(s,{...owner(),[key]:cap-amount+1},8,8),reason('backpressure'),key+' plus one');
  }
  assert.doesNotThrow(()=>checkSharedCapacity2D(s,{...owner(),serial:Number.MAX_SAFE_INTEGER-1}));
  assert.throws(()=>checkSharedCapacity2D(s,{...owner(),serial:Number.MAX_SAFE_INTEGER}),reason('serial'));
  assert.throws(()=>checkSharedCapacity2D(s,{...owner(),pendingFrames:2,serial:Number.MAX_SAFE_INTEGER}),reason('backpressure'));
  for(const invalid of [-1,NaN,Number.MAX_SAFE_INTEGER+1])
    assert.throws(()=>checkSharedCapacity2D(s,{...owner(),pendingFrames:invalid}),reason('backpressure'));
});

test('UNIT SST05 canonical CPU peak includes held output and the maximum source copy',()=>{
  const s=tight();
  assert.doesNotThrow(()=>checkSharedCapacity2D(s,owner(),16*MiB,16*MiB));
  assert.throws(()=>checkSharedCapacity2D(s,owner(),16*MiB,16*MiB+1),reason('budget'));
  assert.doesNotThrow(()=>checkSharedCapacity2D(s,{...owner(),pendingCanonicalBytes:8},16*MiB-8,16*MiB));
  assert.throws(()=>checkSharedCapacity2D(s,{...owner(),pendingCanonicalBytes:9},16*MiB-8,16*MiB),reason('backpressure'));
});

test('UNIT SST06 WebGPU wrapper keeps fee then native limit then pending precedence',()=>{
  let deviceReads=0,pendingReads=0;
  const badDevice={get maxTextureDimension2D(){deviceReads++;return 64;},get maxBufferSize(){deviceReads++;return 1;}};
  const busy={...owner(),get pendingFrames(){pendingReads++;return 2;}};
  assert.throws(()=>gpu.planSharedSubmission2D(prepared({upload:32*MiB+1}),limits,badDevice,busy,true),reason('budget'));
  assert.equal(deviceReads,0);assert.equal(pendingReads,0);
  assert.throws(()=>gpu.planSharedSubmission2D(prepared(),limits,badDevice,busy,true),reason('device'));
  assert.ok(deviceReads>0);assert.equal(pendingReads,0);
  assert.throws(()=>gpu.planSharedSubmission2D(prepared(),limits,hardware(),busy,true),reason('backpressure'));
  assert.equal(pendingReads,1);
  assert.throws(()=>gpu.planSharedSubmission2D(prepared(),limits,hardware({maxBufferSize:1023}),owner(),true),reason('device'));
  assert.doesNotThrow(()=>gpu.planSharedSubmission2D(prepared(),limits,hardware({maxBufferSize:1024}),owner(),true));
  assert.throws(()=>gpu.planSharedSubmission2D(prepared({entries:[{kind:'draw',vertexReservation:3}]}),limits,
    hardware({maxBufferSize:131}),owner(),false),reason('device'));
});

test('UNIT SST07 cold materialization retains actual page identity and independently owned canonical bytes',()=>{
  const image=createImageData2D({width:2,height:1,pixels:new Uint8Array([255,0,0,128,0,255,0,255])});
  const p=prepared({frame:{pages:[{source:image}]}});
  const s=gpu.planSharedSubmission2D(p,limits,hardware(),owner(),false);
  assert.equal(s.projectionPlan.views[0].image,image);
  assert.deepEqual(s.projectionPlan.views[0].region,{x:0,y:0,width:2,height:1});
  const ready=materializeSharedPages2D(s,new Set(),owner());
  assert.deepEqual(ready,{projections:[undefined],canonicalBytes:0});
  const cold=materializeSharedPages2D(s,new Set([0]),owner());
  assert.equal(cold.canonicalBytes,8);assert.deepEqual([...cold.projections[0]],[187,0,0,128,0,255,0,255]);
  cold.projections[0].fill(0);
  const again=materializeSharedPages2D(s,new Set([0]),owner());
  assert.notEqual(again.projections[0],cold.projections[0]);
  assert.deepEqual([...again.projections[0]],[187,0,0,128,0,255,0,255]);
  assert.throws(()=>gpu.planSharedSubmission2D(prepared({width:1,height:1,frame:{pages:[{source:image}]}}),
    limits,hardware({maxTextureDimension2D:1}),owner(),false),reason('device'));
});

test('UNIT SST08 cold-page capacity refusal precedes every source-copy read',()=>{
  let imageReads=0;
  const s={...tight(),projectionPlan:{views:[{byteLength:8,get image(){imageReads++;throw new Error('unexpected source read');}}],
    commandViews:[],projectionBytes:8,scratchBytes:0}};
  assert.throws(()=>materializeSharedPages2D(s,new Set([0]),{...owner(),pendingCanonicalBytes:32*MiB-15}),reason('backpressure'));
  assert.equal(imageReads,0);
  assert.deepEqual(materializeSharedPages2D(s,new Set(),owner()),{projections:[undefined],canonicalBytes:0});
  assert.equal(imageReads,0);
});

test('UNIT SST09 pending pages and conversion memory are twice the frame page budget, at most twice the profile ceiling',()=>{
  const base={maxUploadBytes:32*MiB,maxPendingUploadBytes:64*MiB,maxPendingFrames:2,maxReadbackBytes:64*MiB,maxPendingGeometryBytes:32*MiB};
  // No option, the profile ceiling, and a request above it all leave 2 x 64 MiB; a lower option leaves twice itself.
  for(const [frame,cap] of [[undefined,128*MiB],[64*MiB,128*MiB],[1024*MiB,128*MiB],[16*MiB,32*MiB],[1*MiB,2*MiB]]){
    const s=tight(prepared(),frame===undefined?base:{...base,maxFramePageBytes:frame});
    for(const key of ['pendingTextureBytes','pendingCanonicalBytes']){
      assert.doesNotThrow(()=>checkSharedCapacity2D(s,{...owner(),[key]:cap-8},8,0),key+' exact fit at '+cap);
      assert.throws(()=>checkSharedCapacity2D(s,{...owner(),[key]:cap-7},8,0),reason('backpressure'),key+' plus one at '+cap);
    }
    assert.doesNotThrow(()=>checkSharedCapacity2D(s,owner(),cap-8,8));
    assert.throws(()=>checkSharedCapacity2D(s,owner(),cap-8,9),reason('budget'));
  }
});

test('UNIT cold page materialization matches the scalar reference for every alpha and channel byte',()=>{
  const width=256,height=256,pixels=new Uint8Array(width*height*4);
  for(let alpha=0;alpha<height;alpha++)for(let code=0;code<width;code++){
    const offset=4*(alpha*width+code);
    pixels.set([code,255-code,(code+97)&255,alpha],offset);
  }
  const image=createImageData2D({width,height,pixels}),bytes=image.byteLength;
  const storage={...tight(),projectionPlan:{views:[{image,region:{x:0,y:0,width,height},byteLength:bytes}],
    commandViews:[],projectionBytes:bytes,scratchBytes:bytes}};
  const result=materializeSharedPages2D(storage,new Set([0]),owner());
  assert.equal(result.canonicalBytes,bytes);
  assert.deepEqual(result.projections[0],canonicalPage(width,height,pixels).bytes);
});
