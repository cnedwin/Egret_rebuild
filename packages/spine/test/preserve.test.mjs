// SPDX-License-Identifier: Apache-2.0
// State-preserving replacement, checked against the player it replaces. The original stays live after the
// commit, so both are advanced by the same ticks: the copy on the new asset must hold the same tracks and
// deliver the same events as the original on the old one, tick after tick.
import test from 'node:test';import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {createSpineContentLoader,createSpineInstance,createSpineDisplay,createSpineResetSlot} from '@egret/spine';
import {host} from '../../../tests/helpers.mjs';
import {fixture,ports,codes} from './fixtures.mjs';import {renderingSource} from './renderingFixture.mjs';

const frameOptions={width:64,height:64};
/** The fixture with a longer animation of several events, so that queues, loops and cursors have room. */
function original(){
 const s=renderingSource();
 s.events.land={};
 s.animations.walk={bones:{root:{translate:[{time:0,x:0},{time:.3,x:30}]},child:{rotate:[{time:0,value:0},{time:.3,value:90}]}},events:[{time:0,name:'step'},{time:.1,name:'step2'},{time:.3,name:'land'}]};
 return s;
}
/** Another version of the same content: other motion, other setup and other pictures, on the same schedule. */
function revised(){
 const s=original();
 s.bones[1].x=9;s.bones.push({name:'tail',parent:'child',y:3});
 s.animations.walk.bones.root.translate=[{time:0,x:5},{time:.3,x:-20}];
 s.animations.move.bones.root.translate=[{time:0,x:3},{time:.12,x:40}];
 s.events.step={int:99,float:.5,string:'revised'};
 for(const skin of s.skins){const {first,second}=skin.attachments;if(first?.red&&second?.blue){first.red.path='blue';second.blue.path='red';}}
 return s;
}
async function setup(t,source=original()){
 const engine=await createEngine({host:host().adapter}),loaders=[];
 function version(skeleton,control={}){const data=fixture({skeleton}),p=ports(data,control),loader=createSpineContentLoader(engine,engine.createScope(),data.manifest,p.factory);loaders.push(loader);return {loader,p};}
 const first=version(source),scope=engine.createScope(),group=first.loader.load(engine.createScope(),['e_json']);await group.ready;
 const heard=[],instance=createSpineInstance(group.getSpine('e_json'),engine.createScope(),{onEvent:event=>heard.push(event)}),display=createSpineDisplay(instance,engine.createScope(),{colorProfile:'egret-shared-linear/1'}),target=scope.use(new DisplayObjectContainer());
 target.addChild(display.node);engine.stage.addChild(target);
 const slot=createSpineResetSlot(engine,scope,target,{version:'v1',instance,display});
 t.after(async()=>{for(const loader of loaders)await loader.close();await engine.dispose();});
 let tickId=0;
 const tick=(deltaSeconds=0)=>({tickId:++tickId,deltaSeconds,elapsedSeconds:tickId});
 return {engine,scope,instance,display,target,slot,first,version,heard,tick,capture:()=>engine.captureSharedFrame(frameOptions)};
}
/** An event as both versions must agree on it: when and what, not the payload each version authored for it. */
const heardAs=({kind,track,animation,trackTime,event})=>({kind,track,animation,trackTime,...(event?{name:event.name,time:event.time}:{})});
const playback=({state,tickId,elapsedSeconds,rate,skin,skins,tracks,events})=>({state,tickId,elapsedSeconds,rate,skin,skins,tracks,events:events.map(heardAs)});
/** Replaces through the slot and returns the new player with what it hears. */
async function preserve(s,loader,changes={}){
 const heard=[],ticket=s.slot.requestPreserving({version:'v2',loader,assetId:'e_json',onEvent:event=>heard.push(event),...changes});
 await ticket.ready;ticket.capture(frameOptions);
 return {ticket,heard,next:ticket.commit().instance};
}

test('P01 the replaced player continues where the original stands: tracks, queue, loop, skins, rate and events',async t=>{
 const s=await setup(t),v2=s.version(revised());
 s.instance.setSkins(['default','alternate']);s.instance.setRate(1.5);s.instance.setTransform(3,4,2,2);
 s.instance.setAnimation(0,'walk',{loop:true});s.instance.addAnimation(0,'move',{plays:2,delaySeconds:.5});s.instance.addAnimation(0,'hold',{loop:true});
 s.instance.setAnimation(1,'rise',{plays:3});
 for(const delta of [.02,.03,.05,.04])s.instance.advance(s.tick(delta));
 const before=s.instance.getSnapshot(),delivered=s.heard.length;
 const {next,heard}=await preserve(s,v2.loader);
 // Nothing is delivered for the replacement itself, and the original has not moved.
 assert.deepEqual(heard,[]);assert.deepEqual(s.instance.getSnapshot(),before);assert.equal(s.heard.length,delivered);
 const taken=next.getSnapshot();
 assert.deepEqual(playback(taken),{...playback(before),events:[]});
 assert.equal(taken.revision,before.revision+1);
 // The pose is the new asset's at the same position: it has the new bone, and the root is where the new motion puts it.
 assert.equal(taken.bones.length,before.bones.length+1);assert.notEqual(taken.bones[0].x,before.bones[0].x);
 for(let index=0;index<64;index++){
  const delta=[.01,.05,.016,0,.08,.033,.016,.03,.07,.05][index%10];
  const tick=s.tick(delta),a=s.instance.advance(tick),b=next.advance(tick);
  assert.deepEqual(playback(b),playback(a));
 }
 assert.deepEqual(heard.map(heardAs),s.heard.slice(delivered).map(heardAs));
 assert.ok(heard.some(row=>row.kind==='event')&&heard.some(row=>row.kind==='complete')&&heard.some(row=>row.kind==='start'&&row.animation==='move')&&heard.some(row=>row.animation==='hold'));
 // The payload of an event is the new asset's own.
 assert.equal(heard.find(row=>row.kind==='event'&&row.event.name==='step').event.intValue,99);
});

test('P02 playback that cannot be carried now, and options of the other policy, are refused before the request is accepted',async t=>{
 const s=await setup(t),v2=s.version(revised());
 s.instance.setAnimation(0,'walk',{loop:true});s.instance.advance(s.tick(.02));
 const pending=s.slot.requestPreserving({version:'v2',loader:v2.loader,assetId:'e_json'});await pending.ready;
 const refused=(action,code)=>assert.throws(action,error=>error.code===code);
 // A command that has not been applied yet.
 s.instance.setRate(2);
 refused(()=>s.slot.requestPreserving({version:'v3',loader:v2.loader,assetId:'e_json'}),'SPINE_RESET_PRESERVE_STATE');
 s.instance.advance(s.tick(.01));
 for(const changes of [{policy:'preserve'},{policy:'reset'},{animation:'walk'},{skins:['default']},{loop:true},{plays:2},{version:''},{assetId:''},{onEvent:1}])
  refused(()=>s.slot.requestPreserving({version:'v3',loader:v2.loader,assetId:'e_json',...changes}),'SPINE_RESET_OPTIONS_INVALID');
 refused(()=>s.slot.requestPreserving({version:'v3',loader:{load(){throw Error('touched');}},assetId:'e_json'}),'SPINE_RESET_LOADER_INVALID');
 // None of these superseded the request that was accepted.
 assert.equal(pending.state,'ready');
 // The accepted request is judged in its final window, and a command is waiting there.
 s.instance.setRate(.5);
 assert.throws(()=>pending.capture(frameOptions),error=>codes(error).includes('SPINE_RESET_PRESERVE_STATE'));
 assert.equal(pending.state,'failed');assert.equal(s.slot.getActive().instance,s.instance);
 // Once the command has been applied a new request is accepted and published, with a mix under way.
 s.instance.setAnimation(0,'move',{loop:true,mixSeconds:.1});s.instance.advance(s.tick(.02));
 const {next}=await preserve(s,v2.loader);
 assert.deepEqual(playback(next.getSnapshot()).tracks,playback(s.instance.getSnapshot()).tracks);
});

const incompatible=[
 ['an animation that is gone','ANIMATION',s=>{delete s.animations.walk;}],
 ['an animation of another length','ANIMATION',s=>{s.animations.walk.bones.root.translate[1].time=.31;}],
 ['an event at another time','ANIMATION',s=>{s.animations.walk.events[1].time=.11;}],
 ['an event of another name','ANIMATION',s=>{s.animations.walk.events[1].name='land';}],
 ['an event more','ANIMATION',s=>{s.animations.walk.events.push({time:.3,name:'step'});}],
 ['an event fewer','ANIMATION',s=>{s.animations.walk.events.pop();}],
 ['a queued animation of another length','ANIMATION',s=>{s.animations.move.bones.root.translate[1].time=.2;}],
 ['a selected skin that is gone','SKIN',s=>{s.skins=s.skins.filter(skin=>skin.name!=='alternate');}],
];
for(const [name,code,change] of incompatible)test('P03 an asset with '+name+' cannot continue the playback: the request fails and the player stays',async t=>{
 const s=await setup(t),changed=revised();change(changed);
 const bad=s.version(changed),good=s.version(revised());
 s.instance.setSkins(['default','alternate']);s.instance.setAnimation(0,'walk',{loop:true});s.instance.addAnimation(0,'move',{loop:true,delaySeconds:1});
 s.instance.advance(s.tick(.05));
 const before=s.instance.getSnapshot(),frame=s.capture(),ticket=s.slot.requestPreserving({version:'v2',loader:bad.loader,assetId:'e_json'});
 await assert.rejects(ticket.ready,error=>error.code==='SPINE_RESET_PRESERVE_'+code);
 assert.equal(ticket.state,'failed');assert.equal(s.slot.getActive().instance,s.instance);assert.deepEqual(s.instance.getSnapshot(),before);
 assert.deepEqual({...s.capture(),frameId:0},{...frame,frameId:0});
 assert.equal(bad.loader.getStatus().liveInstances,0);
 const {next}=await preserve(s,good.loader);
 assert.deepEqual(playback(next.getSnapshot()),{...playback(before),events:[]});
});

test('P04 only what is carried must match: an animation that is not playing may differ or be gone',async t=>{
 const s=await setup(t),changed=revised();
 delete changed.animations.rise;delete changed.animations.move.events;changed.animations.hold.bones.root.translate[1].time=5;
 changed.skins=changed.skins.filter(skin=>skin.name!=='alternate');
 const v2=s.version(changed);
 s.instance.setAnimation(0,'walk',{plays:4});s.instance.advance(s.tick(.07));
 const {next}=await preserve(s,v2.loader);
 for(let index=0;index<40;index++){const tick=s.tick(.05);assert.deepEqual(playback(next.advance(tick)),playback(s.instance.advance(tick)));}
 assert.equal(next.getSnapshot().tracks[0].completedPlays,4);
});

test('P05 the playback is taken in the final window: what the player did while the asset loaded is carried, and judged',async t=>{
 const s=await setup(t),held=s.version(revised(),{hold:'e_a'});
 s.instance.setAnimation(0,'walk',{loop:true});s.instance.advance(s.tick(.02));
 const ticket=s.slot.requestPreserving({version:'v2',loader:held.loader,assetId:'e_json'});
 for(let index=0;index<20&&!held.p.gates.length;index++)await Promise.resolve();
 assert.equal(held.p.gates.length,1);assert.equal(ticket.state,'loading');
 // The player goes on, and changes what it plays, while the candidate loads.
 for(let index=0;index<10;index++)s.instance.advance(s.tick(.03));
 s.instance.setAnimation(0,'move',{plays:3});s.instance.setAnimation(1,'rise',{loop:true});s.instance.advance(s.tick(.03));s.instance.advance(s.tick(.03));
 held.p.resolve();await ticket.ready;
 const before=s.instance.getSnapshot();ticket.capture(frameOptions);
 const next=ticket.commit().instance;
 assert.deepEqual(playback(next.getSnapshot()),{...playback(before),events:[]});
 assert.deepEqual(next.getSnapshot().tracks.map(row=>row.animation),['move','rise']);
 for(let index=0;index<30;index++){const tick=s.tick(.02);assert.deepEqual(playback(next.advance(tick)),playback(s.instance.advance(tick)));}

 // The other way: the asset could continue the playback when it was requested, and cannot when it is captured.
 const o=await setup(t),changed=revised();delete changed.animations.move;
 const partial=o.version(changed,{hold:'e_a'});
 o.instance.setAnimation(0,'walk',{loop:true});o.instance.advance(o.tick(.02));
 const late=o.slot.requestPreserving({version:'v2',loader:partial.loader,assetId:'e_json'});
 for(let index=0;index<20&&!partial.p.gates.length;index++)await Promise.resolve();
 partial.p.resolve();await late.ready;
 o.instance.setAnimation(0,'move',{loop:true});o.instance.advance(o.tick(.02));
 const kept=o.instance.getSnapshot();
 assert.throws(()=>late.capture(frameOptions),error=>codes(error).includes('SPINE_RESET_PRESERVE_ANIMATION'));
 assert.equal(late.state,'failed');assert.equal(o.slot.getActive().instance,o.instance);assert.deepEqual(o.instance.getSnapshot(),kept);
 assert.equal(partial.loader.getStatus().liveInstances,0);
});

test('P06 replaced after any tick, nothing the original delivered is delivered again and nothing is lost',async t=>{
 // Twenty-eight positions across the first loop and into the second: just before, at and after each event,
 // the end of the one-play track and the end of the loop.
 let events=0,completions=0;
 for(let ticks=1;ticks<=28;ticks++){
  const s=await setup(t),v2=s.version(revised());
  s.instance.setAnimation(0,'walk',{loop:true});s.instance.setAnimation(1,'move',{plays:1});s.instance.setAnimation(2,'idle',{loop:true});
  let last;
  for(let index=0;index<ticks;index++)last=s.instance.advance(s.tick(.0125));
  events+=last.events.filter(row=>row.kind==='event').length;completions+=last.events.filter(row=>row.kind==='complete'&&row.animation!=='idle').length;
  const delivered=s.heard.length,{next,heard}=await preserve(s,v2.loader);
  const still=s.tick(0);assert.deepEqual(playback(next.advance(still)),playback(s.instance.advance(still)),'after '+ticks+' ticks');
  for(let index=0;index<30;index++){const step=s.tick(.0125);assert.deepEqual(playback(next.advance(step)),playback(s.instance.advance(step)),'after '+ticks+' ticks');}
  assert.deepEqual(heard.map(heardAs),s.heard.slice(delivered).map(heardAs),'after '+ticks+' ticks');
 }
 // Some of those positions were the tick that delivered an event, and some the tick that completed a play.
 assert.ok(events>=5&&completions>=2,events+' events, '+completions+' completions');
});

test('P07 an equal asset gives the pose of the original at every later tick; pause, rate zero and an empty player are carried',async t=>{
 const s=await setup(t),same=s.version(original());
 s.instance.setSkin('alternate');s.instance.setTransform(-7,2,1.5,.5);s.instance.setAnimation(0,'walk',{loop:true});s.instance.setAnimation(2,'rise',{plays:2});
 for(const delta of [.03,.04,.05])s.instance.advance(s.tick(delta));
 const {next}=await preserve(s,same.loader);
 const pose=({bones,slots})=>({bones,slots});
 assert.deepEqual(pose(next.getSnapshot()),pose(s.instance.getSnapshot()));
 for(const command of [i=>i.setPaused(true),i=>{},i=>i.setPaused(false),i=>i.setRate(0),i=>{},i=>i.setRate(.5),i=>i.clearTrack(2),i=>i.setSkins(['default']),i=>{},i=>i.clearTrack(0),i=>{}]){
  command(s.instance);command(next);
  for(let index=0;index<4;index++){const tick=s.tick(.04),a=s.instance.advance(tick),b=next.advance(tick);assert.deepEqual(playback(b),playback(a));assert.deepEqual(pose(b),pose(a));}
 }
 // Paused, at rate zero or with no track at all, a player is still carried.
 let active=next;
 for(const prepare of [i=>i.setPaused(true),i=>{i.setPaused(false);i.setRate(0);},i=>i.setRate(1)]){
  prepare(s.instance);prepare(active);const tick=s.tick(.04);s.instance.advance(tick);active.advance(tick);
  active=(await preserve(s,same.loader)).next;
  assert.deepEqual(playback(active.getSnapshot()),{...playback(s.instance.getSnapshot()),events:[]});assert.deepEqual(active.getSnapshot().tracks,[]);
 }
 assert.deepEqual(active.getSnapshot().state,'running');assert.equal(active.getSnapshot().rate,1);
});

test('P08 a staged frame is the frame after publication; cancellation, a newer request and disposal release the candidate',async t=>{
 const s=await setup(t),v2=s.version(revised()),held=s.version(revised(),{hold:'e_a'});
 s.instance.setAnimation(0,'walk',{loop:true});s.instance.advance(s.tick(.05));
 const old={...s.capture(),frameId:0};
 const first=s.slot.requestPreserving({version:'held',loader:held.loader,assetId:'e_json'});
 for(let index=0;index<20&&!held.p.gates.length;index++)await Promise.resolve();
 // A newer request of either policy cancels a pending one.
 const second=s.slot.requestPreserving({version:'v2',loader:v2.loader,assetId:'e_json'});
 await assert.rejects(first.ready,error=>error.code==='SPINE_RESET_CANCELLED');assert.equal(first.state,'cancelled');
 held.p.resolve();await held.loader.close();
 await second.ready;assert.deepEqual({...s.capture(),frameId:0},old);
 const staged={...second.capture(frameOptions),frameId:0};
 assert.notDeepEqual(staged,old);assert.deepEqual({...s.capture(),frameId:0},old);
 assert.throws(()=>second.capture(frameOptions),error=>error.code==='SPINE_RESET_NOT_READY');
 const active=second.commit();
 assert.equal(active.ownership,'owned');assert.equal(active.version,'v2');assert.deepEqual({...s.capture(),frameId:0},staged);
 assert.equal(s.instance.isDisposed,false);assert.equal(v2.loader.getStatus().liveInstances,1);
 // An advance of the player after the capture makes the publication stale, as for reset.
 const third=s.slot.requestPreserving({version:'v3',loader:v2.loader,assetId:'e_json'});await third.ready;third.capture(frameOptions);
 active.instance.advance(s.tick(.02));
 assert.throws(()=>third.commit(),error=>codes(error).includes('DISPLAY_SUBTREE_STALE'));third.dispose();
 assert.equal(v2.loader.getStatus().liveInstances,1);
 // A reset request after a preserving one, and a preserving one after that, on a player the slot owns.
 const reset=s.slot.request({policy:'reset',version:'v4',loader:v2.loader,assetId:'e_json',animation:'move',loop:true});await reset.ready;reset.capture(frameOptions);
 const restarted=reset.commit().instance;assert.equal(active.instance.isDisposed,true);
 restarted.advance(s.tick(.05));
 const carried=(await preserve(s,s.first.loader,{version:'v5'})).next;
 assert.equal(restarted.isDisposed,true);assert.deepEqual(carried.getSnapshot().tracks,[{index:0,animation:'move',trackTime:.05,animationTime:.05,loop:true,plays:null,completedPlays:0,queued:0}]);
 s.slot.dispose();assert.equal(carried.isDisposed,true);assert.equal(v2.loader.getStatus().liveInstances,0);assert.equal(s.instance.isDisposed,false);
});

/** A small deterministic generator, so that a failing run can be repeated from its seed. */
function random(seed){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
for(const seed of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16])test('P09 players driven at random stay equal across repeated replacement, seed '+seed,async t=>{
 const s=await setup(t),versions=[s.version(revised()),s.version(original())],next=random(seed),names=['walk','move','hold','rise','idle'];
 const pick=list=>list[Math.floor(next()*list.length)];
 let copy,replaced=0;
 for(let step=0;step<260;step++){
  // Every value is drawn before the command is made, so that the original and its copy receive the same one.
  const commands=[];
  for(let count=Math.floor(next()*3);count>0;count--){
   const kind=next(),track=Math.floor(next()*3),name=pick(names),length=name==='idle'?0:name==='walk'?.3:.12;
   const shape=next(),plays=1+Math.floor(next()*4),mixed=next()<.2,delayed=next()<.5,delay=Math.floor(next()*5)/10;
   const options={...(shape<.4?{loop:true}:shape<.7&&length>0?{plays}:shape<.85?{plays:1}:{}),...(mixed?{mixSeconds:.04}:{})};
   const skins=pick([['default'],['alternate'],['default','alternate']]),rate=pick([0,.5,1,1.5]),paused=next()<.3;
   if(kind<.3)commands.push(player=>player.setAnimation(track,name,options));
   else if(kind<.6)commands.push(player=>player.addAnimation(track,name,{...options,...(delayed?{delaySeconds:delay}:{})}));
   else if(kind<.68)commands.push(player=>player.clearTrack(track));
   else if(kind<.78)commands.push(player=>player.setSkins(skins));
   else if(kind<.88)commands.push(player=>player.setRate(rate));
   else commands.push(player=>player.setPaused(paused));
  }
  for(const player of copy?[s.instance,copy]:[s.instance])for(const command of commands)command(player);
  const tick=s.tick(pick([0,.01,.016,.033,.05,.07])),a=s.instance.advance(tick);
  if(copy)assert.deepEqual(playback(copy.advance(tick)),playback(a),'seed '+seed+' step '+step);
  if(next()<.12){
   // The slot carries its active player: the original the first time, then each copy in turn. Every copy is
   // held to the original, which the slot only borrowed and which plays on.
   // A mix under way at that moment is carried like everything else: no replacement is refused.
   const ticket=s.slot.requestPreserving({version:'r'+step,loader:versions[replaced%2].loader,assetId:'e_json'});
   await ticket.ready;ticket.capture(frameOptions);copy=ticket.commit().instance;replaced++;
   assert.deepEqual(playback(copy.getSnapshot()),{...playback(a),events:[]},'seed '+seed+' step '+step);
  }
 }
 assert.ok(replaced>8,'replaced '+replaced);
 t.diagnostic('replaced '+replaced);
});

/** The fixture with two animations that turn the same bone the long way round, so that a mix has a direction to keep. */
function turning(){
 const s=original();
 s.animations.turn={bones:{child:{rotate:[{time:0,value:10},{time:.3,value:170}]},root:{translate:[{time:0,y:0},{time:.3,y:20}]}}};
 s.animations.back={bones:{child:{rotate:[{time:0,value:-170},{time:.3,value:-20}]},root:{scale:[{time:0,x:1,y:1},{time:.3,x:2,y:.5}]}}};
 s.animations.lift={bones:{child:{translate:[{time:0,y:10},{time:.3,y:30}]}}};
 return s;
}
const mixes=[
 ['one mix',i=>{i.setAnimation(0,'walk',{loop:true});},i=>{i.setAnimation(0,'move',{loop:true,mixSeconds:.2});}],
 ['a mix that interrupted another',i=>{i.setAnimation(0,'walk',{loop:true});},i=>{i.setAnimation(0,'turn',{loop:true,mixSeconds:.3});},i=>{i.setAnimation(0,'back',{loop:true,mixSeconds:.3});}],
 ['three under way at once',i=>{i.setAnimation(0,'turn',{loop:true});},i=>{i.setAnimation(0,'walk',{loop:true,mixSeconds:.5});},i=>{i.setAnimation(0,'back',{loop:true,mixSeconds:.5});},i=>{i.setAnimation(0,'move',{loop:true,mixSeconds:.5});}],
 ['a turn the long way round',i=>{i.setAnimation(0,'turn',{loop:true});},i=>{i.setAnimation(0,'back',{loop:true,mixSeconds:.4});}],
 ['two tracks and a queue',i=>{i.setAnimation(0,'walk',{loop:true});i.setAnimation(1,'rise',{loop:true});},i=>{i.setAnimation(0,'turn',{mixSeconds:.2,plays:2});i.addAnimation(0,'move',{loop:true,mixSeconds:.1});i.setAnimation(1,'hold',{loop:true,mixSeconds:.15});}],
 // The oldest shares nothing with the one that follows it and is gone once its mix has ended. What follows it
 // then keeps holding, against the newest, what it held while the oldest was there.
 ['a hold kept after the oldest has gone',i=>{i.setAnimation(0,'move',{loop:true});},i=>{i.setAnimation(0,'rise',{loop:true,mixSeconds:.1});},i=>{i.setAnimation(0,'lift',{loop:true,mixSeconds:.6});}],
 ['a mix to nothing',i=>{i.setAnimation(0,'turn',{loop:true});i.setAnimation(1,'rise',{loop:true});},i=>{i.setAnimation(1,'idle',{mixSeconds:.2});}],
];
for(const [name,...stages] of mixes)test('P11 a mix under way is carried, and goes on as the original goes on: '+name,async t=>{
 const pose=({bones,slots})=>({bones,slots});
 let compared=0;
 // Replaced after each number of ticks into the last mix, from its first tick to after its end.
 for(const ticksIn of [0,1,2,3,5,8,13,21,34]){
  const s=await setup(t,turning()),same=s.version(turning());
  // Each stage is begun and runs for a while, so that an earlier mix is still under way when the next begins.
  for(const stage of stages.slice(0,-1)){stage(s.instance);for(let index=0;index<3;index++)s.instance.advance(s.tick(.03));}
  stages.at(-1)(s.instance);s.instance.advance(s.tick(0));
  for(let index=0;index<ticksIn;index++)s.instance.advance(s.tick(.016));
  const {next,heard}=await preserve(s,same.loader);
  assert.deepEqual(pose(next.getSnapshot()),pose(s.instance.getSnapshot()),name+', replaced '+ticksIn+' ticks in');
  assert.deepEqual(playback(next.getSnapshot()),{...playback(s.instance.getSnapshot()),events:[]});assert.deepEqual(heard,[]);
  s.heard.length=0;
  for(let index=0;index<50;index++){
   // Part of the way on, the players are given another mix to begin from the one they are in.
   if(index===20)for(const player of [s.instance,next])player.setAnimation(0,'walk',{loop:true,mixSeconds:.12});
   const tick=s.tick(index%7===3?.033:.016),a=s.instance.advance(tick),b=next.advance(tick);
   assert.deepEqual(pose(b),pose(a),name+', replaced '+ticksIn+' ticks in, '+index+' ticks later');assert.deepEqual(playback(b),playback(a));compared++;
  }
  assert.deepEqual(heard.map(heardAs),s.heard.map(heardAs));
 }
 assert.equal(compared,450);
});

test('P12 the copy of a mix is mixed again: replaced at every tick of a mix, each copy stands where the original stands',async t=>{
 const s=await setup(t,turning()),versions=[s.version(turning()),s.version(turning())],pose=({bones,slots})=>({bones,slots});
 s.instance.setAnimation(0,'turn',{loop:true});for(let index=0;index<3;index++)s.instance.advance(s.tick(.03));
 s.instance.setAnimation(0,'back',{loop:true,mixSeconds:.3});s.instance.advance(s.tick(.02));
 s.instance.setAnimation(0,'walk',{loop:true,mixSeconds:.4});
 let copy;
 for(let index=0;index<40;index++){
  const tick=s.tick(.016),a=s.instance.advance(tick);
  if(copy)assert.deepEqual(pose(copy.advance(tick)),pose(a),'tick '+index);
  // The slot carries its active player, so each copy is made from the copy before it.
  copy=(await preserve(s,versions[index%2].loader,{version:'m'+index})).next;
  assert.deepEqual(pose(copy.getSnapshot()),pose(a),'copy '+index);
 }
});

test('P13 what is being mixed out of must be continued too: a later version without it is refused',async t=>{
 const s=await setup(t,turning()),without=turning();delete without.animations.turn;
 const v2=s.version(without);
 s.instance.setAnimation(0,'turn',{loop:true});s.instance.advance(s.tick(.03));
 s.instance.setAnimation(0,'walk',{loop:true,mixSeconds:.1});s.instance.advance(s.tick(.02));
 // The current animation is there; the one it is still mixing out of is not.
 const before=s.instance.getSnapshot(),pending=s.slot.requestPreserving({version:'v2',loader:v2.loader,assetId:'e_json'});
 await assert.rejects(pending.ready,error=>error.code==='SPINE_RESET_PRESERVE_ANIMATION');
 assert.equal(pending.state,'failed');assert.equal(s.slot.getActive().instance,s.instance);assert.deepEqual(s.instance.getSnapshot(),before);
 // When the mix has ended nothing of that animation is carried, and the version is accepted.
 for(let index=0;index<8;index++)s.instance.advance(s.tick(.02));
 const {next}=await preserve(s,v2.loader,{version:'v3'});
 assert.deepEqual(playback(next.getSnapshot()).tracks,playback(s.instance.getSnapshot()).tracks);
});

test('P14 what an ended animation left behind is not carried: the copy is posed by what is playing',async t=>{
 const s=await setup(t,turning()),same=s.version(turning());
 s.instance.setAnimation(0,'move');for(let index=0;index<5;index++)s.instance.advance(s.tick(.03));
 s.instance.clearTrack(0);const left=s.instance.advance(s.tick(.03));
 // The original keeps the root where the animation left it. Nothing plays, so nothing poses the copy.
 assert.equal(left.tracks.length,0);assert.notEqual(left.bones[0].x,0);
 const {next}=await preserve(s,same.loader);
 assert.equal(next.getSnapshot().bones[0].x,0);assert.deepEqual(next.getSnapshot().tracks,[]);
});
