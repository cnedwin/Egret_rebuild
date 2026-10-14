// SPDX-License-Identifier: Apache-2.0
// App host/provider adapters create genuine public Egret authority objects.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as egret from '@egret/engine';
import { createF2MeshProfilePlan } from '../../spine-f2/dist/index.js';
const root=new URL('../',import.meta.url);
export const oracle=JSON.parse(readFileSync(new URL('assets/literal-oracle.json',root),'utf8'));
const origin=JSON.parse(readFileSync(new URL('assets/origin.json',root),'utf8'));
const decode=name=>new TextDecoder('utf-8',{fatal:true}).decode(readFileSync(new URL('assets/'+name,root)));
export const originalInput=Object.freeze({
  skeleton:Object.freeze({id:origin.skeletonId,text:decode('original-f2c.spine.json'),provenance:origin.provenance}),
  atlas:Object.freeze({id:origin.atlasId,text:decode('original-f2c.atlas'),provenance:origin.provenance}),
  pages:Object.freeze([Object.freeze({pageName:origin.pageName,assetId:origin.assetId,provenance:origin.provenance})]),
});
export { egret,createF2MeshProfilePlan };
export function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
// Test observation watchdogs do not alter production lifetime or performance rules.
export function boundedWait(promise,label,milliseconds=5000){
  let timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{const error=new Error('TEST_OBSERVATION_TIMEOUT: '+label);error.code='F2C_TEST_TIMEOUT';error.observationBoundMs=milliseconds;reject(error);},milliseconds);});
  return Promise.race([Promise.resolve(promise),timeout]).finally(()=>clearTimeout(timer));
}
export function isObservationTimeout(error,seen=new Set()){
  if(!error||typeof error!=='object'||seen.has(error))return false;seen.add(error);
  return error.code==='F2C_TEST_TIMEOUT'||isObservationTimeout(error.cause,seen)||(Array.isArray(error.cleanupErrors)&&error.cleanupErrors.some(value=>isObservationTimeout(value,seen)));
}
export const frameOptions=Object.freeze({width:64,height:48,clearColor:0,clearAlpha:0});
export async function context(controls={}){
  const hostTrace=[],frames=[],timers=new Set(),loads=[],disposed=[];
  const host={surface:{},texturedFrameProfile:egret.TEXTURED_FRAME_PROFILE_2D,
    start(){hostTrace.push('start');},stop(){hostTrace.push('stop');},async close(){hostTrace.push('close');},
    setTimeout(callback,delayMs){const token={callback,delayMs};timers.add(token);return ()=>timers.delete(token);},
    renderFrame(){},renderTexturedFrame(frame){frames.push(frame);},
  };
  const engine=await egret.createEngineForProfile({host},egret.TEXTURED_FRAME_PROFILE_2D);
  const scope=engine.createScope(),started=deferred(),retired=deferred();
  const type=egret.createAssetType('F2-C original page',egret.isTexture),pageRef=egret.createAssetRef(type,origin.assetId);
  engine.assets.register(type,{
    async load(ref,loadContext){
      const width=controls.width??oracle.page.width,height=controls.height??oracle.page.height;
      const bytes=readFileSync(new URL('assets/original-f2c-page.rgba',root)),pixels=new Uint8Array(width*height*4);pixels.set(bytes.subarray(0,pixels.length));
      const texture=egret.createTexture(egret.createImageData2D({width,height,pixels}),controls.crop);
      loads.push({ref,texture,signal:loadContext.signal});started.resolve(loads.at(-1));
      if(controls.disposedPage)texture.dispose();if(controls.pageGate)await controls.pageGate.promise;return texture;
    },
    dispose(texture){disposed.push(texture);controls.onPageDispose?.(texture);texture.dispose();retired.resolve(texture);},
  });
  return {engine,scope,type,pageRef,loads,disposed,started,retired,frames,hostTrace,timers,
    async close(){
      let primary;try{scope.dispose();}catch(error){primary=error;}
      try{await boundedWait(engine.dispose(),'public Engine cleanup');}catch(cleanup){if(primary){const error=new Error('TEST_ENGINE_CLEANUP',{cause:primary});error.cleanupErrors=[cleanup];throw error;}throw cleanup;}
      if(primary)throw primary;assert.equal(timers.size,0);assert.deepEqual(hostTrace,['start','stop','close']);
    },
  };
}
export async function withContext(run,controls={}){
  const c=await context(controls);let value,primary;try{value=await boundedWait(Promise.resolve().then(()=>run(c)),'public context body',15000);}catch(error){primary=error;}
  try{await c.close();}catch(cleanup){if(primary){const error=new Error('TEST_CONTEXT_CLEANUP',{cause:primary});error.cleanupErrors=[cleanup];throw error;}throw cleanup;}
  if(primary)throw primary;return value;
}
export function copyGeometry(g){return {positions:[...g.positions],uvs:[...g.uvs],lightColors:[...g.lightColors],indices:[...g.indices]};}
export function leaf(i){assert.ok(i.display instanceof egret.DisplayObjectContainer);assert.equal(i.display.numChildren,1);const mesh=i.display.getChildAt(0);assert.ok(mesh instanceof egret.Mesh2D);return mesh;}
export function snapshot(i){const mesh=leaf(i);return {mesh,geometry:mesh.geometry,bytes:copyGeometry(mesh.geometry),time:i.sampleTimeSeconds};}
export function retained(s){assert.deepEqual(copyGeometry(s.geometry),s.bytes,'retained geometry bytes');}
export function committed(s,i){retained(s);assert.equal(leaf(i).geometry,s.geometry);assert.equal(i.sampleTimeSeconds,s.time);}
export function pose(i,time,page){
  const expected=oracle.idealSamples.find(row=>row.timeSeconds===time);assert.ok(expected,'literal table time only');assert.equal(i.state,'live');assert.equal(i.sampleTimeSeconds,time);
  const mesh=leaf(i),g=mesh.geometry;assert.ok(egret.isTexturedGeometry2D(g));assert.ok(Object.isFrozen(g));assert.equal(g.vertexCount,oracle.fixture.vertexCount);assert.equal(g.indexCount,oracle.fixture.indexCount);assert.equal(g.positions.length,expected.positions.length);
  g.positions.forEach((value,index)=>assert.ok(Number.isFinite(value)&&Math.abs(value-expected.positions[index])<=oracle.analyticalPositionBound.absolutePerComponent,'fixed ideal component '+index));
  for(const key of ['uvs','indices','lightColors'])assert.deepEqual([...g[key]],oracle.invariantGeometry[key]);
  assert.ok(mesh.textureLease instanceof egret.AssetLease);assert.equal(mesh.textureLease.value,page);assert.deepEqual(page.sourceRect,{x:0,y:0,width:oracle.page.width,height:oracle.page.height});return mesh;
}
export function findCode(error,code){const seen=new Set();while(error&&typeof error==='object'&&!seen.has(error)){if(error instanceof egret.EgretError&&error.code===code)return error;seen.add(error);error=error.cause;}}
export async function rejectsCode(action,code){let error;try{await action();}catch(caught){error=caught;}if(!findCode(error,code))throw new Error('required '+code+'; actual '+(error?.code??error),{cause:error});return error;}
export function throwsCode(action,code){assert.throws(action,error=>Boolean(findCode(error,code)));}
/** F2C00 is separate genuine setup: no Core pose, no bridge factory, no behavior count. */
export async function prerequisites(){
  const tau=2**-40,delta=oracle.analyticalPositionBound.delta,q=90*(3.1415927/180),basis={q,cos0:Math.cos(0),sin0:Math.sin(0),cosq:Math.cos(q),sinq:Math.sin(q)};
  assert.ok(Math.abs(basis.cos0-1)<=tau&&Math.abs(basis.sin0)<=tau&&Math.abs(basis.cosq)<=delta+tau&&Math.abs(basis.sinq-1)<=delta**2/2+tau,'fixed host premises');
  const profile=createF2MeshProfilePlan(originalInput);assert.equal(profile.ok,true,'genuine original F2-B source qualification');let observation;
  await withContext(async c=>{
    const group=c.engine.createAssetGroup(c.scope,[c.pageRef],{concurrency:1}),leases=await group.ready;assert.equal(group.state,'ready');assert.equal(leases.length,1);
    const page=leases[0].value;assert.ok(page instanceof egret.Texture);assert.equal(page.isDisposed,false);assert.equal(page.width,oracle.page.width);assert.equal(page.height,oracle.page.height);
    const geometry=egret.createTexturedGeometry2D({positions:new Float64Array(oracle.fixture.setupPositions),uvs:new Float64Array(oracle.invariantGeometry.uvs),lightColors:new Float64Array(oracle.invariantGeometry.lightColors),indices:new Uint16Array(oracle.invariantGeometry.indices)}),mesh=new egret.Mesh2D(leases[0],geometry);
    c.engine.stage.addChild(mesh);c.scope.use(mesh);const frame=c.engine.captureTexturedFrame(frameOptions);assert.equal(frame.commands.length,1);assert.equal(frame.geometries[0],geometry);assert.equal(frame.images[0],page.imageData);assert.equal(c.loads.length,1);
    observation={basis,sourceProfile:profile,pageDimensions:[page.width,page.height],genuineMesh:true,corePoseUsed:false};c.scope.dispose();assert.equal(c.disposed.length,1);assert.equal(page.isDisposed,true);assert.equal(group.state,'disposed');assert.equal(c.scope.state,'closed');
    observation.cleanup={pageDisposals:c.disposed.length,scopeAfter:c.scope.state,groupAfter:group.state,textureRetired:page.isDisposed};
  });
  return {id:'F2C00',status:'ACTUAL_GENUINE_PREREQUISITES_ONLY',host:{node:process.version,platform:process.platform,arch:process.arch},...observation,mainBehaviorCasesExecuted:0,nativePixels:'not_run'};
}
