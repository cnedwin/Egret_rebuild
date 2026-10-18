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
import * as gpu from '../packages/engine/dist/web/prepareSharedSubmission2D.js';

const MiB=1024*1024;
const limits=Object.freeze({maxUploadBytes:32*MiB,maxPendingUploadBytes:64*MiB,
  maxPendingFrames:2,maxReadbackBytes:64*MiB,maxPendingGeometryBytes:32*MiB});
const owner=()=>({pendingFrames:0,pendingUploadBytes:0,pendingReadbackBytes:0,
  pendingTextureBytes:0,pendingGeometryBytes:0,pendingColorBytes:0,
  pendingCanonicalBytes:0,pendingSceneBytes:0,pendingUniformBytes:0,
  pendingDepthBytes:0,serial:0});
const prepared=(changes={})=>({width:65,height:2,upload:8,pageBytes:8,
  geometryBytes:44,entries:[],frame:{pages:[]},...changes});
const hardware=(changes={})=>({maxTextureDimension2D:16384,maxBufferSize:128*MiB,...changes});
const reason=expected=>error=>error instanceof SharedStorageError2D&&error.reason===expected;
const tight=(p=prepared(),options=limits,scene)=>{
  const fees=planSharedStorageFees2D(p,options,scene);
  return {...withSharedReadbackLayout2D(fees,{rowPitch:4*p.width,staging:4*p.width*p.height,output:4*p.width*p.height}),
    projectionPlan:{views:[],commandViews:[],projectionBytes:p.pageBytes,scratchBytes:0}};
};

test('UNIT SST01 shared fee identity survives the WebGPU compatibility facade',()=>{
  assert.equal(gpu.SharedStorageError2D,SharedStorageError2D);
  assert.equal(gpu.checkSharedCapacity2D,checkSharedCapacity2D);
  assert.equal(gpu.materializeSharedPages2D,materializeSharedPages2D);
  const p=prepared(),scene={sceneBytes:32,uniformBytes:64,depthBytes:520};
  const fees=planSharedStorageFees2D(p,limits,scene);
  assert.equal(fees.prepared,p);assert.equal(fees.options,limits);assert.equal(fees.scene,scene);
  assert.equal(fees.upload,104);assert.equal(fees.colorBytes,520);
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

test('UNIT SST03 joint logical upload, color and scene caps retain exact-fit and plus-one refusal',()=>{
  assert.equal(planSharedStorageFees2D(prepared({width:4096,height:4096}),limits).colorBytes,64*MiB);
  assert.throws(()=>planSharedStorageFees2D(prepared({width:4097,height:4096}),limits),reason('budget'));
  const scene={sceneBytes:32,uniformBytes:64,depthBytes:520};
  assert.equal(planSharedStorageFees2D(prepared({upload:32*MiB-96}),limits,scene).upload,32*MiB);
  assert.throws(()=>planSharedStorageFees2D(prepared({upload:32*MiB-95}),limits,scene),reason('budget'));
  for(const [key,cap]of [['sceneBytes',4*MiB],['uniformBytes',4096],['depthBytes',16*MiB]]){
    assert.doesNotThrow(()=>planSharedStorageFees2D(prepared(),limits,{sceneBytes:0,uniformBytes:0,depthBytes:0,[key]:cap}));
    assert.throws(()=>planSharedStorageFees2D(prepared(),limits,{sceneBytes:0,uniformBytes:0,depthBytes:0,[key]:cap+1}),reason('budget'));
  }
});

test('UNIT SST04 all pending dimensions retain exact remaining capacity and serial priority',()=>{
  const s=tight(prepared(),limits,{sceneBytes:32,uniformBytes:64,depthBytes:520});
  const cases=[['pendingFrames',2,1],['pendingUploadBytes',64*MiB,104],
    ['pendingReadbackBytes',64*MiB,1040],['pendingTextureBytes',32*MiB,8],
    ['pendingGeometryBytes',32*MiB,44],['pendingColorBytes',128*MiB,520],
    ['pendingCanonicalBytes',32*MiB,16],['pendingSceneBytes',8*MiB,32],
    ['pendingUniformBytes',8192,64],['pendingDepthBytes',32*MiB,520]];
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
  assert.throws(()=>gpu.planSharedSubmission2D(prepared(),limits,
    hardware({sceneBufferBytes:[129],maxBufferSize:128}),owner(),false),reason('device'));
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
