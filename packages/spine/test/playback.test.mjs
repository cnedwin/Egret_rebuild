// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '@egret/engine';
import { createSpineContentLoader, createSpineInstance } from '@egret/spine';
import { host } from '../../../tests/helpers.mjs';
import { fixture, ports, source, codes } from './fixtures.mjs';
import { playbackSource } from './playbackFixture.mjs';
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-5,`${actual} != ${expected}`);
const tick=(tickId,deltaSeconds,elapsedSeconds=tickId*0.1)=>({tickId,deltaSeconds,elapsedSeconds});
async function setup(t,skeleton=playbackSource()){
 const h=host(),engine=await createEngine({host:h.adapter}),p=ports(fixture({skeleton})),data=fixture({skeleton}),owner=engine.createScope();
 const loader=createSpineContentLoader(engine,owner,data.manifest,p.factory),group=loader.load(engine.createScope(),['e_json']);await group.ready;
 t.after(async()=>{await loader.close();await engine.dispose();});
 const asset=group.getSpine('e_json');return {h,engine,p,loader,group,owner,asset,make:(options,scope=engine.createScope())=>createSpineInstance(asset,scope,options)};
}
test('two real instances share setup but retain independent analytic poses and immutable snapshots',async t=>{
 const s=await setup(t),a=s.make(),b=s.make();a.setAnimation(0,'move');b.setAnimation(0,'move');b.setRate(0.5);
 const aa=a.advance(tick(1,.06)),bb=b.advance(tick(1,.06));near(aa.bones[0].worldX,6);near(bb.bones[0].worldX,3);near(aa.bones[1].worldX,7);assert.equal(s.loader.getStatus().liveSetups,1);assert.equal(s.loader.getStatus().liveInstances,2);assert.equal(s.p.textures.length,2);
 a.advance(tick(2,.06));near(aa.bones[0].worldX,6);assert.ok(Object.isFrozen(aa)&&Object.isFrozen(aa.bones)&&Object.isFrozen(aa.bones[0])&&Object.isFrozen(aa.events));assert.throws(()=>{aa.bones[0].worldX=99;},TypeError);near(b.getSnapshot().bones[0].worldX,3);
});
test('independent tracks compose without modifying shared skins or sibling instances',async t=>{
 const s=await setup(t),a=s.make(),b=s.make();a.setAnimation(0,'move');a.setAnimation(1,'rise');a.setSkin('alternate');a.setTransform(10,20,2,2);const result=a.advance(tick(1,.06));near(result.bones[0].worldX,22);near(result.bones[1].worldY,24);assert.equal(result.tracks.length,2);assert.equal(result.skin,'alternate');assert.notEqual(b.getSnapshot().skin,'alternate');near(b.getSnapshot().bones[0].worldX,0);
});
test('queued animation transitions and configured mixing use the official state semantics',async t=>{
 const s=await setup(t),a=s.make();a.setAnimation(0,'move');a.advance(tick(1,.06));a.setAnimation(0,'hold',{mixSeconds:.1});const mixed=a.advance(tick(2,.05));assert.ok(mixed.bones[0].worldX>6&&mixed.bones[0].worldX<30);a.advance(tick(3,.05));near(a.getSnapshot().bones[0].worldX,30);
 const b=s.make();b.setAnimation(0,'move');b.addAnimation(0,'hold',{mixSeconds:.02});b.advance(tick(1,.12));b.advance(tick(2,.03));assert.equal(b.getSnapshot().tracks[0].animation,'hold');near(b.getSnapshot().bones[0].worldX,30);b.clearTrack(0);b.advance(tick(3,0));assert.equal(b.getSnapshot().tracks.length,0);
});
test('pause and zero rate consume ticks without wall-time catch-up',async t=>{
 const s=await setup(t),a=s.make();a.setAnimation(0,'move');a.advance(tick(1,.03));a.setPaused(true);let snap=a.advance(tick(2,1000));near(snap.bones[0].worldX,3);assert.equal(snap.state,'paused');a.setPaused(false);a.setRate(0);snap=a.advance(tick(3,1000));near(snap.bones[0].worldX,3);a.setRate(2);snap=a.advance(tick(4,.015));near(snap.bones[0].worldX,6);near(snap.elapsedSeconds,.06);
});
test('invalid, duplicate and oversized ticks preserve commands and the last committed pose',async t=>{
 const s=await setup(t),a=s.make();a.setAnimation(0,'move');const before=a.getSnapshot();for(const value of [tick(0,.01),tick(1,-1),tick(1,NaN),tick(1,1),{tickId:1,elapsedSeconds:0}])assert.throws(()=>a.advance(value));assert.deepEqual(a.getSnapshot(),before);a.advance(tick(1,.02));const last=a.getSnapshot();assert.throws(()=>a.advance(tick(1,.02)));assert.throws(()=>a.advance(tick(2,0,-1)));assert.deepEqual(a.getSnapshot(),last);a.advance(tick(2,.02));near(a.getSnapshot().bones[0].worldX,4);
});
test('events copy values in source order and callback commands wait for the next tick',async t=>{
 const received=[],s=await setup(t);let a;a=s.make({onEvent:e=>{received.push(e);if(e.kind==='event'&&e.event.name==='step')a.setAnimation(0,'hold');}});a.setAnimation(0,'move');const first=a.advance(tick(1,.05));assert.deepEqual(received.map(e=>e.kind==='event'?e.event.name:e.kind),['start','step','step2']);near(first.bones[0].worldX,5);assert.equal(first.pendingCommands,1);near(first.events[1].event.time,.02);assert.deepEqual({...first.events[1].event,time:0},{name:'step',time:0,intValue:7,floatValue:1.5,stringValue:'original'});a.advance(tick(2,0));near(a.getSnapshot().bones[0].worldX,30);assert.equal(first.events[0].animation,'move');
});
test('listener failure is observable after commit without replay and later events still dispatch',async t=>{
 const s=await setup(t),seen=[];const a=s.make({onEvent:e=>{seen.push(e.kind);if(e.kind==='start')throw Error('assigned listener');}});a.setAnimation(0,'move');assert.throws(()=>a.advance(tick(1,.05)),e=>e.code==='SPINE_INSTANCE_LISTENER_FAILED');assert.deepEqual(seen,['start','event','event']);assert.equal(a.getSnapshot().state,'running');near(a.getSnapshot().bones[0].worldX,5);a.advance(tick(2,.01));assert.deepEqual(seen,['start','event','event']);
});
for(const mode of ['instance','scope','group','loader','owner'])test('listener '+mode+' disposal suppresses remaining callbacks and retires ownership',async t=>{
 const s=await setup(t),scope=s.engine.createScope(),seen=[];let a;a=s.make({onEvent:e=>{seen.push(e.kind);if(mode==='instance')a.dispose();if(mode==='scope')scope.dispose();if(mode==='group')s.group.dispose();if(mode==='loader')s.loader.dispose();if(mode==='owner')s.owner.dispose();}},scope);a.setAnimation(0,'move');const result=a.advance(tick(1,.05));assert.equal(result.state,'disposed');assert.deepEqual(seen,['start']);assert.equal(s.loader.getStatus().liveInstances,0);assert.throws(()=>a.advance(tick(2,0)));a.dispose();
});
test('event overflow faults only the instance, suppresses unpublished events and retains last snapshot',async t=>{
 const s=await setup(t),seen=[],a=s.make({maxEvents:1,onEvent:e=>seen.push(e)}),b=s.make();const old=a.getSnapshot();a.setAnimation(0,'move');assert.throws(()=>a.advance(tick(1,.05)),e=>codes(e).includes('SPINE_INSTANCE_EVENT_LIMIT'));assert.equal(a.getSnapshot().state,'faulted');assert.equal(a.getSnapshot().revision,old.revision);assert.deepEqual(a.getSnapshot().bones,old.bones);assert.deepEqual(seen,[]);assert.throws(()=>a.setAnimation(0,'hold'));b.setAnimation(0,'move');near(b.advance(tick(1,.06)).bones[0].worldX,6);a.dispose();assert.equal(s.loader.getStatus().liveInstances,1);
});
test('nonfinite world output fails after semantic mutation without publishing a partial snapshot',async t=>{
 const data=playbackSource();data.bones[0].x=1e308;const s=await setup(t,data),a=s.make(),old=a.getSnapshot();a.setTransform(0,0,1e6,1);assert.throws(()=>a.advance(tick(1,0)),e=>codes(e).includes('SPINE_INSTANCE_NONFINITE_POSE'));assert.equal(a.getSnapshot().state,'faulted');assert.equal(a.getSnapshot().revision,0);assert.deepEqual(a.getSnapshot().bones,old.bones);
});
test('command, track-entry and instance limits remain finite and old groups remain usable',async t=>{
 const s=await setup(t),a=s.make();for(let i=0;i<256;i++)a.setRate(1);assert.throws(()=>a.setRate(1),e=>e.code==='SPINE_INSTANCE_COMMAND_LIMIT');a.advance(tick(1,0));for(let i=0;i<129;i++)a.addAnimation(0,'hold',{delaySeconds:100});assert.throws(()=>a.advance(tick(2,0)),e=>codes(e).includes('SPINE_INSTANCE_ENTRY_LIMIT'));a.dispose();const all=Array.from({length:128},()=>s.make());assert.throws(()=>s.make());assert.equal(s.loader.getStatus().liveInstances,128);for(const instance of all)instance.dispose();assert.equal(s.loader.getStatus().liveInstances,0);assert.equal(s.asset.isDisposed,false);
});
test('genuine asset and same-engine open Scope are required before constructing a player',async t=>{
 const s=await setup(t),foreign=await createEngine({host:host().adapter});t.after(()=>foreign.dispose());assert.throws(()=>createSpineInstance({...s.asset},s.engine.createScope()));assert.throws(()=>createSpineInstance(s.asset,foreign.createScope()));assert.throws(()=>createSpineInstance(s.asset,{}));const closed=s.engine.createScope();closed.dispose();assert.throws(()=>createSpineInstance(s.asset,closed));assert.equal(s.loader.getStatus().liveInstances,0);s.group.dispose();assert.throws(()=>createSpineInstance(s.asset,s.engine.createScope()));
});
test('descriptor admission rejects accessors and observes ownership changes from proxies',async t=>{
 const s=await setup(t),a=s.make();let called=0;assert.throws(()=>a.setAnimation(0,'move',{get loop(){called++;return true;}}));assert.equal(called,0);const scope=s.engine.createScope();assert.throws(()=>createSpineInstance(s.asset,scope,new Proxy({},{ownKeys(){scope.dispose();return [];}})));assert.equal(s.loader.getStatus().liveInstances,1);assert.throws(()=>a.advance(new Proxy(tick(1,0),{getOwnPropertyDescriptor(target,key){s.group.dispose();return Reflect.getOwnPropertyDescriptor(target,key);}})));assert.equal(a.isDisposed,true);
});
test('callback recursive advance is refused and later listeners see the committed snapshot',async t=>{
 const s=await setup(t);let a;a=s.make({onEvent:()=>assert.throws(()=>a.advance(tick(2,0)),e=>e.code==='SPINE_INSTANCE_REENTRANT')});a.setAnimation(0,'move');assert.equal(a.advance(tick(1,.05)).revision,1);assert.equal(a.getSnapshot().pendingCommands,0);
});
test('existing GameClock drives instances once per public tick and scope retirement stops work',async t=>{
 const s=await setup(t),scope=s.engine.createScope(),a=s.make(undefined,scope),clock=s.engine.clock;a.setAnimation(0,'move');clock.onTick(scope,value=>{a.advance(value);});s.engine.advanceTime(0);s.engine.advanceTime(.05);near(a.getSnapshot().bones[0].worldX,5);scope.dispose();s.engine.advanceTime(.1);assert.equal(a.isDisposed,true);assert.equal(s.loader.getStatus().liveInstances,0);
});
test('group retirement preserves a sibling group instance and releases final shared pages only once',async t=>{
 const s=await setup(t),other=s.loader.load(s.engine.createScope(),['e_json']);await other.ready;const a=s.make(),b=createSpineInstance(other.getSpine('e_json'),s.engine.createScope());s.group.dispose();assert.equal(a.isDisposed,true);assert.equal(b.isDisposed,false);assert.ok(s.p.textures.every(p=>!p.isDisposed));b.setAnimation(0,'move');near(b.advance(tick(1,.06)).bones[0].worldX,6);other.dispose();assert.equal(b.isDisposed,true);assert.ok(s.p.textures.every(p=>p.isDisposed));assert.equal(s.loader.getStatus().liveSetups,0);assert.equal(s.loader.getStatus().liveInstances,0);
});
test('invalid controls leave pending and committed state unchanged',async t=>{
 const s=await setup(t),a=s.make(),old=a.getSnapshot();for(const invoke of [()=>a.setAnimation(16,'move'),()=>a.setAnimation(0,'missing'),()=>a.addAnimation(0,'move',{delaySeconds:-1}),()=>a.setAnimation(0,'move',{mixSeconds:Infinity}),()=>a.setSkin('missing'),()=>a.setRate(17),()=>a.setPaused(1),()=>a.setTransform(NaN,0),()=>a.clearTrack(-1)])assert.throws(invoke);assert.deepEqual(a.getSnapshot(),old);
});

test('looping events repeat in order across explicit advances without replay on a zero delta',async t=>{
 const s=await setup(t),a=s.make();a.setAnimation(0,'move',{loop:true});const first=a.advance(tick(1,.12)),second=a.advance(tick(2,.12));for(const result of [first,second]){assert.deepEqual(result.events.filter(e=>e.kind==='event').map(e=>e.event.name),['step','step2']);assert.equal(result.events.filter(e=>e.kind==='complete').length,1);}assert.deepEqual(a.advance(tick(3,0)).events,[]);
});
test('zero-duration playback stays bounded and custom segment limits are explicit',async t=>{
 const s=await setup(t),a=s.make({maxSegments:1});a.setAnimation(0,'idle',{loop:true});const before=a.getSnapshot();assert.throws(()=>a.advance(tick(1,.02)),e=>e.code==='SPINE_INSTANCE_STEP_LIMIT');assert.deepEqual(a.getSnapshot(),before);const result=a.advance(tick(1,1/60));assert.ok(result.events.length<=3);assert.equal(result.state,'running');for(const options of [{maxSegments:0},{maxSegments:121},{maxEvents:0},{maxEvents:8193},{onEvent:1}])assert.throws(()=>s.make(options));
});
test('tick descriptor reentry cannot advance an instance during admission',async t=>{
 const s=await setup(t),a=s.make();a.setAnimation(0,'move');let rejected=false;const value=new Proxy(tick(1,.01),{ownKeys(target){try{a.advance(tick(2,.02));}catch(e){rejected=e.code==='SPINE_INSTANCE_REENTRANT';}return Reflect.ownKeys(target);}});const result=a.advance(value);assert.equal(rejected,true);assert.equal(result.tickId,1);near(result.bones[0].worldX,1);
});

for (const [field,value] of [['string',{shared:'original'}],['int',{value:7}],['float',{value:1.5}]]) test('malformed event '+field+' cannot expose shared upstream objects',async t=>{
 const raw=playbackSource();raw.events.step[field]=value;const s=await setup(t,raw),seen=[],a=s.make({onEvent:e=>seen.push(e)}),b=s.make();a.setAnimation(0,'move');b.setAnimation(0,'hold');const before=a.getSnapshot();assert.throws(()=>a.advance(tick(1,.05)),e=>e.code==='SPINE_INSTANCE_ADVANCE_FAILED');assert.equal(a.getSnapshot().state,'faulted');assert.equal(a.getSnapshot().revision,before.revision);assert.deepEqual(a.getSnapshot().events,[]);assert.deepEqual(seen,[]);near(b.advance(tick(1,.05)).bones[0].worldX,30);a.dispose();assert.equal(s.loader.getStatus().liveInstances,1);
});
