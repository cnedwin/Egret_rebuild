// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine} from '@egret/engine';
import {createSpineContentLoader,createSpineInstance,createSpineDisplay} from '@egret/spine';
import {host} from '../../../tests/helpers.mjs';
import {fixture,ports,codes} from './fixtures.mjs';
import {renderingSource} from './renderingFixture.mjs';
const tick=(tickId,deltaSeconds=0)=>({tickId,elapsedSeconds:tickId,deltaSeconds});
const names=s=>s.slots.map(slot=>slot.attachment);
async function setup(t,raw=renderingSource({outfit:true}),options){
 const engine=await createEngine({host:host().adapter}),data=fixture({skeleton:raw}),p=ports(data),loader=createSpineContentLoader(engine,engine.createScope(),data.manifest,p.factory),scope=engine.createScope(),group=loader.load(scope,['e_json']);await group.ready;
 const asset=group.getSpine('e_json'),player=createSpineInstance(asset,scope,options);
 t.after(async()=>{await loader.close();await engine.dispose();});
 return {engine,loader,group,scope,p,asset,player,frame:()=>engine.captureSharedFrame({width:64,height:64})};
}
test('ordered compositions override slot placeholders and single skin API remains compatible',async t=>{
 const s=await setup(t),a=s.player;assert.deepEqual(a.getSnapshot().skins,[]);a.setSkins(['blue-first','red-second']);assert.deepEqual(a.getSnapshot().skins,[]);
 const first=a.advance(tick(1));assert.deepEqual(names(first),['first-blue','second-red']);assert.equal(first.skin,null);assert.deepEqual(first.skins,['blue-first','red-second']);assert.ok(Object.isFrozen(first.skins));
 a.setSkins(['blue-first','red-first']);assert.deepEqual(names(a.advance(tick(2))),['first-red','blue']);a.setSkins(['red-first','blue-first']);assert.deepEqual(names(a.advance(tick(3))),['first-blue','blue']);
 a.setSkin('default');const restored=a.advance(tick(4));assert.equal(restored.skin,'default');assert.deepEqual(restored.skins,['default']);assert.deepEqual(names(restored),['red','blue']);assert.deepEqual(first.skins,['blue-first','red-second']);
});
test('skin selection copies caller data and never mutates shared setup or siblings',async t=>{
 const s=await setup(t),a=s.player,b=createSpineInstance(s.asset,s.engine.createScope()),selection=['blue-first','red-second'];a.setSkins(selection);selection.reverse();a.advance(tick(1));assert.deepEqual(a.getSnapshot().skins,['blue-first','red-second']);assert.deepEqual(names(b.getSnapshot()),['red','blue']);
 b.setSkin('blue-first');assert.deepEqual(names(b.advance(tick(1))),['first-blue','blue']);assert.equal(s.loader.getStatus().liveSetups,1);assert.equal(s.loader.getStatus().liveInstances,2);assert.equal(s.p.textures.length,2);assert.deepEqual(s.asset.info.skins,['default','alternate','blue-first','red-second','red-first']);
});
test('composition preserves active tracks, mixing, rate and consumed events',async t=>{
 const seen=[],s=await setup(t,undefined,{onEvent:e=>seen.push(e)}),a=s.player;a.setAnimation(0,'move');a.advance(tick(1,.05));a.setAnimation(0,'hold',{mixSeconds:.1});a.advance(tick(2,.01));const before=a.getSnapshot(),events=seen.length;
 a.setSkins(['blue-first','red-second']);const after=a.advance(tick(3));assert.deepEqual(after.tracks,before.tracks);assert.equal(after.elapsedSeconds,before.elapsedSeconds);assert.equal(after.rate,before.rate);assert.equal(seen.length,events);assert.deepEqual(after.bones,before.bones);a.advance(tick(4,.04));assert.ok(a.getSnapshot().tracks[0].trackTime>after.tracks[0].trackTime);
});
test('paused composition refreshes attachments while animation attachment timelines remain authoritative',async t=>{
 const s=await setup(t),a=s.player;a.setPaused(true);a.setSkins(['blue-first','red-second']);assert.deepEqual(names(a.advance(tick(1,100))),['first-blue','second-red']);assert.equal(a.getSnapshot().elapsedSeconds,0);
 a.setAnimation(0,'hide');a.setSkins(['red-first','red-second']);assert.deepEqual(names(a.advance(tick(2))),[null,null]);assert.equal(a.getSnapshot().state,'paused');
});
test('event listener composition queues for the following advance without replay',async t=>{
 let player,seen=0;const s=await setup(t,undefined,{onEvent:e=>{if(e.kind==='event'){seen++;player.setSkins(['blue-first','red-second']);}}});player=s.player;player.setAnimation(0,'move');const first=player.advance(tick(1,.03));assert.deepEqual(first.skins,[]);assert.equal(first.pendingCommands,1);assert.equal(seen,1);assert.deepEqual(player.advance(tick(2)).skins,['blue-first','red-second']);assert.equal(seen,1);
});
test('invalid combinations preserve both committed snapshot and queued commands',async t=>{
 const s=await setup(t),a=s.player;a.setSkin('alternate');const before=a.getSnapshot();let getterCalls=0;const accessor=['default'];Object.defineProperty(accessor,'0',{get(){getterCalls++;return 'default';}});
 for(const bad of [null,{},'default',[],['missing'],['default','default'],Array(2),accessor,Array(33).fill('default'),['default',4]])assert.throws(()=>a.setSkins(bad),e=>e.code==='SPINE_INSTANCE_SKINS_INVALID');
 assert.equal(getterCalls,0);assert.deepEqual(a.getSnapshot(),before);assert.equal(a.advance(tick(1)).skin,'alternate');
});
test('bounded admission accepts 32 distinct skins and refuses 33 without allocating a command',async t=>{
 const raw=renderingSource({outfit:true});for(let i=0;i<33;i++)raw.skins.push({name:'part'+i,attachments:{}});const s=await setup(t,raw),a=s.player,selection=Array.from({length:32},(_,i)=>'part'+i);a.setSkins(selection);assert.deepEqual(a.advance(tick(1)).skins,selection);assert.throws(()=>a.setSkins([...selection,'part32']));assert.equal(a.getSnapshot().pendingCommands,0);
});
test('array iteration is not called and recursive admission is rejected',async t=>{
 const s=await setup(t),a=s.player,selection=['blue-first','red-second'];selection[Symbol.iterator]=()=>{throw Error('must not iterate input');};let reentry=0;
 const proxy=new Proxy(selection,{getOwnPropertyDescriptor(target,key){assert.throws(()=>a.setSkin('default'),e=>e.code==='SPINE_INSTANCE_REENTRANT');reentry++;return Reflect.getOwnPropertyDescriptor(target,key);}});a.setSkins(proxy);assert.equal(reentry,3);assert.deepEqual(a.advance(tick(1)).skins,['blue-first','red-second']);
});
for(const mode of ['scope','group'])test('array descriptor '+mode+' disposal cannot publish a late command',async t=>{
 const s=await setup(t),a=s.player;const selection=new Proxy(['default'],{getOwnPropertyDescriptor(target,key){s[mode].dispose();return Reflect.getOwnPropertyDescriptor(target,key);}});assert.throws(()=>a.setSkins(selection));assert.equal(a.isDisposed,true);assert.equal(a.getSnapshot().pendingCommands,0);assert.equal(s.loader.getStatus().liveInstances,0);
});
test('composition uses existing queue capacity and lifecycle refusal',async t=>{
 const s=await setup(t),a=s.player;for(let i=0;i<256;i++)a.setSkins(['default']);assert.throws(()=>a.setSkins(['blue-first']),e=>e.code==='SPINE_INSTANCE_COMMAND_LIMIT');a.advance(tick(1));assert.equal(a.getSnapshot().skin,'default');a.dispose();assert.throws(()=>a.setSkins(['default']),e=>e.code==='SPINE_INSTANCE_DISPOSED');
});
test('graphics publication failure retains old visual but commits the outfit; a later valid outfit recovers',async t=>{
 const raw=renderingSource({outfit:true});raw.skins[0].attachments.second.blue.path='red';const s=await setup(t,raw),a=s.player,view=createSpineDisplay(a,s.scope,{colorProfile:'egret-shared-linear/1',maxCommands:1});s.engine.stage.addChild(view.node);const old=s.frame();
 a.setSkins(['blue-first','red-second']);assert.throws(()=>a.advance(tick(1)),e=>codes(e).includes('SPINE_DISPLAY_COMMAND_LIMIT'));assert.deepEqual(a.getSnapshot().skins,['blue-first','red-second']);assert.equal(a.getSnapshot().state,'running');assert.deepEqual(s.frame().geometries,old.geometries);
 a.setSkins(['red-first','red-second']);a.advance(tick(2));assert.equal(view.getStatus().commands,1);assert.deepEqual(names(a.getSnapshot()),['first-red','second-red']);s.group.dispose();assert.equal(view.getStatus().isDisposed,true);assert.equal(s.loader.getStatus().liveInstances,0);assert.equal(s.p.retired.length,2);
});
