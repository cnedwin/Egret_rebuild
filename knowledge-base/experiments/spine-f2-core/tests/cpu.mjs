// SPDX-License-Identifier: Apache-2.0
// Finite main IDs run only after authentic F2C00. Pending Task4 controls are separate.
import assert from 'node:assert/strict';
import { createF2CoreResources } from '../dist/index.js';
import {egret,oracle,originalInput,createF2MeshProfilePlan,withContext,context,deferred,frameOptions,leaf,pose,snapshot,retained,committed,copyGeometry,rejectsCode,throwsCode,findCode,boundedWait} from './fixture.mjs';
const ready=c=>createF2CoreResources(c.engine,c.scope,{input:originalInput,pageRef:c.pageRef});
const instance=(c,r,name=oracle.animationName)=>r.createInstance(c.engine.createScope(),name);
const cases=[];const add=(id,run)=>cases.push({id,run});
add('F2C01',()=>withContext(async c=>{
  const refused={...originalInput,skeleton:{...originalInput.skeleton,text:'{}'}},expected=createF2MeshProfilePlan(refused);assert.equal(expected.ok,false);
  const error=await rejectsCode(()=>createF2CoreResources(c.engine,c.scope,{input:refused,pageRef:c.pageRef}),'F2C_SOURCE_REFUSED');assert.deepEqual(findCode(error,'F2C_SOURCE_REFUSED').cause,expected,'entire source result');assert.equal(c.loads.length,0);
  let reads=0;const options={pageRef:c.pageRef,get input(){reads++;return originalInput;}};await rejectsCode(()=>createF2CoreResources(c.engine,c.scope,options),'F2C_INPUT_INVALID');assert.equal(reads,0);assert.equal(c.loads.length,0);
  const wrong=egret.createAssetRef(c.type,'different-page');await rejectsCode(()=>createF2CoreResources(c.engine,c.scope,{input:originalInput,pageRef:wrong}),'F2C_PAGE_BINDING');assert.equal(c.loads.length,0);
  // A ref lookalike is an explicit refusal control; it never supplies authority.
  await rejectsCode(()=>createF2CoreResources(c.engine,c.scope,{input:originalInput,pageRef:{type:c.type,id:c.pageRef.id}}),'F2C_RESOURCE_LOAD_FAILED');assert.equal(c.loads.length,0);
}));
add('F2C02',async()=>{for(const controls of [{width:8,height:16},{crop:{x:0,y:0,width:8,height:8}},{disposedPage:true}])await withContext(async c=>{await rejectsCode(()=>ready(c),'F2C_PAGE_PROFILE');assert.equal(c.loads.length,1);assert.equal(c.disposed.length,1);},controls);});
add('F2C03',()=>withContext(async c=>{const r=await ready(c),a=instance(c,r);pose(a,0,c.loads[0].texture);for(const row of oracle.idealSamples){a.sampleAt(row.timeSeconds);pose(a,row.timeSeconds,c.loads[0].texture);}assert.equal(c.frames.length,0);assert.equal(c.loads.length,1);}));
add('F2C04',()=>withContext(async c=>{
  const r=await ready(c),a=instance(c,r),seen=new Map();for(const row of oracle.idealSamples){a.sampleAt(row.timeSeconds);pose(a,row.timeSeconds,c.loads[0].texture);seen.set(row.timeSeconds,copyGeometry(leaf(a).geometry));}
  for(const time of [oracle.resetAndRetention.repeatTimeAfterLastSampleSeconds,oracle.resetAndRetention.backwardTimeAfterRepeatSeconds]){a.sampleAt(time);pose(a,time,c.loads[0].texture);assert.deepEqual(copyGeometry(leaf(a).geometry),seen.get(time),'exact repeat/backward');}
  const old=snapshot(a);for(const time of [-1,1.01,NaN,Infinity,'0.5',new Number(0.5)]){throwsCode(()=>a.sampleAt(time),'F2C_TIME_INVALID');assert.equal(a.state,'live');committed(old,a);}for(const name of ['missing',' bend ',1]){throwsCode(()=>instance(c,r,name),'F2C_ANIMATION_INVALID');committed(old,a);}
}));
add('F2C05',()=>withContext(async c=>{
  const r=await ready(c),a=instance(c,r),b=instance(c,r);c.engine.stage.addChild(a.display);c.engine.stage.addChild(b.display);a.sampleAt(0.5);b.sampleAt(0.25);
  const oldA=snapshot(a),oldB=snapshot(b),frame=c.engine.captureTexturedFrame(frameOptions),bytes=JSON.stringify(frame);assert.equal(frame.commands.length,2);a.sampleAt(1);b.sampleAt(0.75);retained(oldA);retained(oldB);assert.equal(JSON.stringify(frame),bytes);assert.equal(frame.geometries[0],oldA.geometry);assert.equal(frame.geometries[1],oldB.geometry);pose(a,1,c.loads[0].texture);pose(b,0.75,c.loads[0].texture);
}));
add('F2C06',()=>withContext(async c=>{
  const r=await ready(c),a=instance(c,r),b=instance(c,r);c.engine.stage.addChild(a.display);c.engine.stage.addChild(b.display);assert.equal(c.loads.length,1);assert.equal(leaf(a).textureLease.value,leaf(b).textureLease.value);throwsCode(()=>instance(c,r),'F2C_INSTANCE_CAPACITY');
  a.dispose();assert.equal(a.display,undefined);assert.equal(a.state,'disposed');assert.equal(c.disposed.length,0);b.sampleAt(1);pose(b,1,c.loads[0].texture);assert.equal(c.engine.captureTexturedFrame(frameOptions).commands.length,1);const replacement=instance(c,r);replacement.dispose();b.dispose();assert.equal(c.disposed.length,0);r.dispose();assert.equal(c.disposed.length,1);
}));
add('F2C07',()=>withContext(async c=>{
  const r=await ready(c),a=instance(c,r);
  await withContext(async foreign=>{
    const error=await rejectsCode(()=>createF2CoreResources(c.engine,foreign.scope,{input:originalInput,pageRef:c.pageRef}),'ASSET_GROUP_SCOPE_INVALID');
    assert.ok(error instanceof egret.EgretError);assert.equal(error.code,'F2C_RESOURCE_LOAD_FAILED');assert.equal(c.loads.length,1);
    throwsCode(()=>r.createInstance(foreign.scope,'bend'),'ENGINE_MISMATCH');assert.equal(r.isDisposed,false);assert.equal(foreign.scope.state,'open');
  });
  const closed=c.engine.createScope();closed.dispose();throwsCode(()=>r.createInstance(closed,'bend'),'F2C_SCOPE_CLOSED');
  const old=snapshot(a),observerErrors=[];let observed;
  // Cancellation swallows observer throws. Save the callback window before
  // checking it outside the genuine Scope.dispose call.
  c.scope.signal.addEventListener('abort',()=>{
    try{const resourcesDisposed=r.isDisposed;let refusal;try{a.sampleAt(0.5);}catch(error){refusal=error;}
      observed={resourcesDisposed,refusal,geometry:old.mesh.geometry,bytes:copyGeometry(old.geometry),time:a.sampleTimeSeconds};
    }catch(error){observerErrors.push(error);}
  },{once:true});
  c.scope.dispose();if(observerErrors.length){const error=new Error('F2C07_CALLBACK_OBSERVER_FAILED',{cause:observerErrors[0]});error.cleanupErrors=observerErrors.slice(1);throw error;}
  assert.ok(observed,'abort callback observed');assert.equal(observed.resourcesDisposed,true);assert.ok(observed.refusal instanceof egret.EgretError,'sampling refused during abort');assert.equal(observed.geometry,old.geometry);assert.deepEqual(observed.bytes,old.bytes);assert.equal(observed.time,old.time);
  assert.equal(r.isDisposed,true);assert.equal(a.state,'disposed');assert.equal(a.display,undefined);
}));
add('F2C08',async()=>{
  const gate=deferred(),c=await context({pageGate:gate});let promise,primary;const cleanupErrors=[];
  try{
    promise=ready(c).then(value=>({kind:'ready',value}),error=>({kind:'rejected',error}));
    const first=await boundedWait(Promise.race([c.started.promise.then(()=>({kind:'started'})),promise]),'F2C08 provider admission');
    if(first.kind!=='started')throw new Error('genuine pending provider required',{cause:first.error});
    const loaded=c.loads[0];c.scope.dispose();assert.equal(loaded.signal.aborted,true);gate.resolve();
    const outcome=await boundedWait(promise,'F2C08 canceled factory settlement');assert.equal(outcome.kind,'rejected');assert.ok(outcome.error instanceof egret.EgretError);
    await boundedWait(c.retired.promise,'F2C08 late page retirement');assert.equal(c.disposed.length,1);assert.equal(loaded.texture.isDisposed,true);assert.equal(c.engine.captureTexturedFrame(frameOptions).commands.length,0);
  }catch(error){primary=error;}
  // Releasing the application gate and retiring the genuine context must also
  // settle or report a finite observation failure. Keep original causes.
  gate.resolve();if(promise)try{await boundedWait(promise,'F2C08 factory cleanup');}catch(error){cleanupErrors.push(error);}
  try{await c.close();}catch(error){cleanupErrors.push(error);}
  if(primary){if(cleanupErrors.length){const error=new Error('F2C08_CLEANUP_FAILED',{cause:primary});error.cleanupErrors=cleanupErrors;throw error;}throw primary;}
  if(cleanupErrors.length){const error=new Error('F2C08_CLEANUP_FAILED',{cause:cleanupErrors[0]});error.cleanupErrors=cleanupErrors.slice(1);throw error;}
});
add('F2C09',()=>withContext(async c=>{
  const r=await ready(c),a=instance(c,r);a.sampleAt(0.5);const old=snapshot(a);a.display.removeChild(old.mesh);throwsCode(()=>a.sampleAt(0.75),'DISPLAY_MUTATED');retained(old);assert.equal(a.sampleTimeSeconds,old.time);assert.equal(a.state,'live');a.dispose();const b=instance(c,r);assert.equal(b.state,'live');b.dispose();
  // Post-Core/materialization faults and rollback/secondary-cleanup faults are
  // Task4 owned-source controls, never public production switches.
}));
add('F2C10',async()=>{
  let r,a,b;const order=[],observations=[],observerErrors=[];
  const observe=(label,read)=>{order.push(label);try{observations.push({label,...read()});}catch(error){observerErrors.push(error);}};
  await withContext(async c=>{
    r=await ready(c);c.scope.signal.addEventListener('abort',()=>observe('abort',()=>({resourcesDisposed:r.isDisposed})),{once:true});
    a=instance(c,r);b=instance(c,r);c.engine.stage.addChild(a.display);c.engine.stage.addChild(b.display);const page=c.loads[0].texture;
    c.scope.use({dispose(){observe('caller-last',()=>({resourcesDisposed:r.isDisposed}));}});
    c.scope.dispose();order.push('scope-returned');
    // Callback propagation is not the oracle: assert saved observations here.
    if(observerErrors.length){const error=new Error('F2C10_CALLBACK_OBSERVER_FAILED',{cause:observerErrors[0]});error.cleanupErrors=observerErrors.slice(1);throw error;}
    assert.deepEqual(order,['abort','caller-last','page','scope-returned']);assert.deepEqual(observations.map(row=>row.resourcesDisposed),[true,true,true]);
    const retiredAtPage=observations.find(row=>row.label==='page');assert.equal(retiredAtPage.aState,'disposed');assert.equal(retiredAtPage.bState,'disposed');assert.equal(retiredAtPage.aDisplay,undefined);assert.equal(retiredAtPage.bDisplay,undefined);
    assert.equal(a.state,'disposed');assert.equal(b.state,'disposed');assert.equal(a.display,undefined);assert.equal(b.display,undefined);assert.equal(page.isDisposed,true);assert.equal(c.disposed.length,1);
    a.dispose();b.dispose();r.dispose();r.dispose();c.scope.dispose();assert.equal(c.disposed.length,1);assert.equal(c.engine.captureTexturedFrame(frameOptions).commands.length,0);
  },{onPageDispose(){if(!r){order.push('page-before-ready');return;}observe('page',()=>({resourcesDisposed:r.isDisposed,aState:a.state,bState:b.state,aDisplay:a.display,bDisplay:b.display}));}});
});
export const cpuCases=Object.freeze(cases.map(Object.freeze));
