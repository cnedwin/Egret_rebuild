// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '@egret/engine';
import { createSpineContentLoader, createSpineInstance, createSpineDisplay } from '@egret/spine';
import { host } from '../../../tests/helpers.mjs';
import { fixture, ports, codes } from './fixtures.mjs';
import { renderingSource } from './renderingFixture.mjs';
import { playbackSource } from './playbackFixture.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,a+' != '+b);
const tick=(tickId,deltaSeconds)=>({tickId,deltaSeconds,elapsedSeconds:tickId});
async function setup(t,data=playbackSource()){
 const engine=await createEngine({host:host().adapter}),f=fixture({skeleton:data}),p=ports(f),loader=createSpineContentLoader(engine,engine.createScope(),f.manifest,p.factory),group=loader.load(engine.createScope(),['e_json']);await group.ready;
 t.after(async()=>{await loader.close();await engine.dispose();});const asset=group.getSpine('e_json');
 return {engine,loader,group,asset,make:options=>createSpineInstance(asset,engine.createScope(),options),duration:asset.info.animations.find(a=>a.name==='move').duration};
}
const completes=s=>s.events.filter(e=>e.kind==='complete');
test('finite plays retain one entry and final pose with exact completion positions',async t=>{
 const s=await setup(t),a=s.make(),d=s.duration;a.setAnimation(0,'move',{plays:2});const first=a.advance(tick(1,d)),last=a.advance(tick(2,d));
 assert.equal(first.tracks[0].plays,2);assert.equal(first.tracks[0].completedPlays,1);assert.equal(last.tracks[0].completedPlays,2);near(completes(first)[0].trackTime,d);near(completes(last)[0].trackTime,2*d);near(last.bones[0].worldX,12);assert.equal(first.events.filter(e=>e.kind==='start').length,1);assert.ok(!last.events.some(e=>['start','interrupt','end','dispose'].includes(e.kind)));
 const held=a.advance(tick(3,.1));near(held.bones[0].worldX,12);assert.deepEqual(held.events,[]);assert.equal(held.tracks[0].completedPlays,2);assert.ok(Object.isFrozen(last.tracks[0]));assert.equal(first.tracks[0].completedPlays,1);
});
test('one advance crosses finite completion and queues next with residual time',async t=>{
 const s=await setup(t),a=s.make({maxSegments:120}),d=s.duration;a.setAnimation(0,'move',{plays:2});a.addAnimation(0,'rise',{plays:1});const result=a.advance(tick(1,2*d+.06));
 assert.equal(result.tracks[0].animation,'rise');near(result.tracks[0].trackTime,.06);near(result.bones[1].worldY,2);assert.equal(completes(result).filter(e=>e.animation==='move').length,2);assert.equal(result.events.filter(e=>e.kind==='start').length,2);
 assert.deepEqual(result.events.filter(e=>e.kind==='event').map(e=>e.event.name),['step','step2','step','step2']);
});
test('short finite loops deliver every authored event and completion in one tick',async t=>{
 const data=playbackSource();data.animations.move={bones:{root:{translate:[{time:0,x:0},{time:.001,x:12}]}},events:[{time:.0002,name:'step'}]};const s=await setup(t,data),a=s.make(),d=s.duration;a.setAnimation(0,'move',{plays:5});const result=a.advance(tick(1,.02));
 assert.equal(completes(result).length,5);assert.equal(result.events.filter(e=>e.kind==='event').length,5);completes(result).forEach((e,i)=>near(e.trackTime,(i+1)*d));near(result.bones[0].worldX,12);assert.deepEqual(a.advance(tick(2,0)).events,[]);
});
test('finite controls honor pause rate independent tracks and legacy loop',async t=>{
 const s=await setup(t),a=s.make(),b=s.make(),d=s.duration;a.setAnimation(0,'move',{plays:2});a.setAnimation(1,'rise',{plays:1});b.setAnimation(0,'move',{loop:true});a.advance(tick(1,d));a.setPaused(true);const held=a.advance(tick(2,100));assert.equal(held.tracks[0].completedPlays,1);a.setPaused(false);a.setRate(0);assert.equal(a.advance(tick(3,100)).tracks[0].completedPlays,1);a.setRate(2);const end=a.advance(tick(4,d/2));assert.equal(end.tracks[0].completedPlays,2);near(end.bones[0].worldX,12);assert.equal(end.tracks[1].completedPlays,1);near(end.bones[1].worldY,4);assert.equal(b.advance(tick(1,d)).tracks[0].loop,true);
});
test('finite validation is atomic including accessors conflicting loop and zero duration',async t=>{
 const s=await setup(t),a=s.make(),before=a.getSnapshot();let reads=0;
 for(const options of [{plays:0},{plays:-1},{plays:1.5},{plays:1025},{plays:Infinity},{plays:NaN},{plays:'2'},{plays:null},{plays:2,loop:false},{plays:2,loop:true},{get plays(){reads++;return 2;}}])assert.throws(()=>a.setAnimation(0,'move',options),e=>e.code==='SPINE_INSTANCE_OPTIONS_INVALID');
 assert.throws(()=>a.addAnimation(0,'idle',{plays:2}),e=>e.code==='SPINE_INSTANCE_OPTIONS_INVALID');assert.equal(reads,0);assert.deepEqual(a.getSnapshot(),before);
 a.setAnimation(0,'idle',{plays:1});assert.equal(completes(a.advance(tick(1,0))).length,1);assert.deepEqual(a.advance(tick(2,.1)).events,[]);a.addAnimation(0,'move',{plays:1});const next=a.advance(tick(3,.06));assert.equal(next.tracks[0].animation,'move');near(next.bones[0].worldX,6);
});
test('finite automatic mixing uses total duration and explicit positive delay can interrupt',async t=>{
 const s=await setup(t),a=s.make({maxSegments:120}),d=s.duration;a.setAnimation(0,'move',{plays:3});a.addAnimation(0,'hold',{plays:1,mixSeconds:.02});const before=a.advance(tick(1,2*d));assert.equal(before.tracks[0].animation,'move');assert.equal(before.tracks[0].completedPlays,2);const mixed=a.advance(tick(2,d-.01));assert.equal(mixed.tracks[0].animation,'hold');assert.ok(mixed.bones[0].worldX>12&&mixed.bones[0].worldX<30);near(a.advance(tick(3,.03)).bones[0].worldX,30);
 const b=s.make();b.setAnimation(0,'move',{plays:3});b.addAnimation(0,'hold',{delaySeconds:.04});const interrupted=b.advance(tick(1,.06));assert.equal(interrupted.tracks[0].animation,'hold');assert.equal(completes(interrupted).length,0);
});
test('completion listeners observe committed finite state and mutations wait until next tick',async t=>{
 const s=await setup(t);let a;const seen=[];a=s.make({onEvent:e=>{if(e.kind==='complete'){seen.push(a.getSnapshot().tracks[0].completedPlays);a.setAnimation(0,'hold',{plays:1});}}});a.setAnimation(0,'move',{plays:1});const end=a.advance(tick(1,s.duration));assert.deepEqual(seen,[1]);near(end.bones[0].worldX,12);assert.equal(end.pendingCommands,1);near(a.advance(tick(2,0)).bones[0].worldX,30);
});
test('finite event overflow faults only the changed player without publishing partial repeats',async t=>{
 const s=await setup(t),seen=[],a=s.make({maxSegments:120,maxEvents:3,onEvent:e=>seen.push(e)}),b=s.make();a.setAnimation(0,'move',{plays:2});const old=a.getSnapshot();assert.throws(()=>a.advance(tick(1,2*s.duration)),e=>codes(e).includes('SPINE_INSTANCE_EVENT_LIMIT'));assert.equal(a.getSnapshot().state,'faulted');assert.equal(a.getSnapshot().revision,old.revision);assert.deepEqual(seen,[]);b.setAnimation(0,'move',{plays:1});near(b.advance(tick(1,.06)).bones[0].worldX,6);
});

test('zero ticks do not begin another finite loop or replay boundary markers',async t=>{
 const data=playbackSource();data.animations.move.events=[{time:0,name:'step'},{time:.12,name:'step2'}];const s=await setup(t,data),a=s.make();a.setAnimation(0,'move',{plays:2});const first=a.advance(tick(1,s.duration));near(first.tracks[0].animationTime,s.duration);near(first.bones[0].worldX,12);assert.deepEqual(first.events.filter(e=>e.kind==='event').map(e=>e.event.name),['step','step2']);assert.deepEqual(a.advance(tick(2,0)).events,[]);assert.deepEqual(a.advance(tick(3,s.duration)).events.filter(e=>e.kind==='event').map(e=>e.event.name),['step','step2']);
});
test('a single finite play completes at its exact duration before excess tick time',async t=>{
 const data=playbackSource();data.animations.move={bones:{root:{translate:[{time:0,x:0},{time:.001,x:12}]}}};const s=await setup(t,data),a=s.make();a.setAnimation(0,'move',{plays:1});const last=a.advance(tick(1,.02));assert.equal(completes(last).length,1);assert.equal(completes(last)[0].trackTime,s.duration);near(last.bones[0].worldX,12);
});

test('maximum finite play count and different short tracks remain bounded and exact',async t=>{
 const data=playbackSource();data.animations.move={bones:{root:{translate:[{time:0,x:0},{time:.00001,x:12}]}}};data.animations.rise={bones:{child:{translate:[{time:0,y:0},{time:.00003,y:4}]}}};const s=await setup(t,data),a=s.make({maxEvents:8192});a.setAnimation(0,'move',{plays:1024});a.setAnimation(1,'rise',{plays:256});const result=a.advance(tick(1,.02));assert.deepEqual(result.tracks.map(t=>t.completedPlays),[1024,256]);assert.equal(completes(result).length,1280);near(result.bones[0].worldX,12);near(result.bones[1].worldY,4);
});
test('unrepresentable tiny boundary advance faults within the existing publication boundary',async t=>{
 const data=playbackSource();data.animations.move={bones:{root:{translate:[{time:0,x:0},{time:1e-30,x:12}]}}};const s=await setup(t,data),a=s.make();a.setAnimation(0,'move',{plays:2});assert.throws(()=>a.advance(tick(1,.1)),e=>codes(e).includes('SPINE_INSTANCE_PLAYBACK_STEP_LIMIT'));assert.equal(a.getSnapshot().revision,0);assert.equal(a.getSnapshot().state,'faulted');
});
test('pooled entry reuse and clear discard finite bookkeeping',async t=>{
 const s=await setup(t),a=s.make();a.setAnimation(0,'move',{plays:1});a.advance(tick(1,s.duration));a.clearTrack(0);assert.equal(a.advance(tick(2,0)).tracks.length,0);a.setAnimation(0,'move',{loop:true});const result=a.advance(tick(3,s.duration+.001));assert.equal(result.tracks[0].plays,null);assert.equal(result.tracks[0].completedPlays,1);assert.equal(result.tracks[0].loop,true);a.setAnimation(0,'move',{plays:2});assert.equal(a.advance(tick(4,0)).tracks[0].completedPlays,0);
});
test('finite listener failure and disposal preserve commit without replay',async t=>{
 const s=await setup(t);let a,seen=0;a=s.make({onEvent:e=>{if(e.kind==='complete'){seen++;throw Error('assigned');}}});a.setAnimation(0,'move',{plays:1});assert.throws(()=>a.advance(tick(1,s.duration)),e=>e.code==='SPINE_INSTANCE_LISTENER_FAILED');assert.equal(a.getSnapshot().tracks[0].completedPlays,1);a.advance(tick(2,.01));assert.equal(seen,1);
 let b;const delivered=[];b=s.make({onEvent:e=>{delivered.push(e);if(e.kind==='complete')b.dispose();}});b.setAnimation(0,'move',{plays:2});assert.equal(b.advance(tick(1,s.duration)).state,'disposed');assert.equal(delivered.filter(e=>e.kind==='complete').length,1);
});
test('a final finite completion survives graphics refusal and recovers without event replay',async t=>{
 const data=renderingSource({outfit:true});data.skins[0].attachments.second.blue.path='red';const s=await setup(t,data),seen=[],a=s.make({onEvent:e=>seen.push(e)}),view=createSpineDisplay(a,s.engine.createScope(),{colorProfile:'egret-shared-linear/1',maxCommands:1});s.engine.stage.addChild(view.node);const old=s.engine.captureSharedFrame({width:32,height:32});
 a.setAnimation(0,'move',{plays:1});a.setSkins(['blue-first','red-second']);assert.throws(()=>a.advance(tick(1,s.duration)),e=>e.code==='SPINE_INSTANCE_RENDER_FAILED');assert.equal(a.getSnapshot().state,'running');assert.equal(a.getSnapshot().tracks[0].completedPlays,1);assert.equal(seen.filter(e=>e.kind==='complete').length,1);assert.deepEqual(s.engine.captureSharedFrame({width:32,height:32}).geometries,old.geometries);a.setSkins(['red-first','red-second']);a.advance(tick(2,0));assert.equal(view.getStatus().commands,1);assert.equal(seen.filter(e=>e.kind==='complete').length,1);
});
