// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {createSequenceController,createSequenceResetSlot} from '@egret/engine/animation';
import {contentFixture,contentSetup} from './sequence-reset-fixture.mjs';
import {flush} from './helpers.mjs';
const frame={width:8,height:4,clearColor:0,clearAlpha:1,outputAlpha:'opaque'};
const playback={profile:'egret.sequence-control/1',totalPlays:'infinite'};
const request=loader=>({policy:'reset',version:'next',loader,imageId:'e_page',sequenceId:'e_sequence',playback});
const code=(fn,c)=>assert.throws(fn,{code:c});
async function scene(initialPlayback=playback,{beforeController,clip}={}){
 const s=await contentSetup(),scope=s.engine.createScope(),resources=s.engine.createScope(),group=s.loader.load(resources,['e_sequence']);await group.ready;
 const container=scope.use(new egret.DisplayObjectContainer());s.engine.stage.addChild(container);
 const bitmap=resources.use(new egret.Bitmap(group.getImage('e_page')));container.addChild(bitmap);
 beforeController?.(s.engine,scope);
 const controller=createSequenceController(s.engine,resources,bitmap,clip??group.getSequence('e_sequence'),initialPlayback);controller.start();
 const b=resources.use(new egret.Bitmap(group.getImage('e_page')));b.x=3;s.engine.stage.addChild(b);
 const other=createSequenceController(s.engine,resources,b,group.getSequence('e_sequence'),playback);other.start();s.engine.advanceTime(0);
 const slot=createSequenceResetSlot(s.engine,scope,container,{version:'old',bitmap,controller});
 return {...s,scope,resources,group,container,bitmap,controller,other,slot};
}
// Same IDs, different immutable generation and literal durations/pixels; no rebinding.
test('RESET keeps two old clocks live during loading and publishes paused at zero',async()=>{
 const s=await scene(),events=[];
 const next=await contentSetup(contentFixture(f=>{for(const x of [f.atlas.sequenceInput,f.sequence.sequenceInput]){x.frames[0].durationSeconds=0.25;x.frames[1].durationSeconds=0.5;}}),{hold:true,pixels:[0,0,255,255,255,255,0,255]},s.engine);
 try{
  const t=s.slot.request({...request(next.loader),playback:{...playback,rate:2,markers:[{id:'zero',timeSeconds:0},{id:'quarter',timeSeconds:0.25}],onEvent:e=>{events.push(e);}}});
  s.engine.advanceTime(0.125);assert.equal(s.controller.getStatus().positionSeconds,0.125);assert.equal(s.other.getStatus().positionSeconds,0.125);assert.equal(t.state,'loading');assert.deepEqual(events,[]);
  next.pending[0].d.resolve(next.pending[0].texture);await t.ready;assert.equal(t.state,'ready');assert.deepEqual(events,[]);
  const retained=s.engine.captureSharedFrame(frame),candidate=t.capture(frame);assert.equal(s.controller.getStatus().state,'paused');
  s.engine.advanceTime(0.25);assert.equal(s.other.getStatus().positionSeconds,0.25);
  const active=t.commit();assert.equal(t.state,'committed');assert.equal(active.ownership,'owned');assert.equal(s.container.getChildAt(0),active.bitmap);
  assert.equal(active.controller.getStatus().state,'paused');assert.equal(active.controller.getStatus().positionSeconds,0);assert.equal(active.controller.getStatus().rate,2);assert.deepEqual(events,[]);
  assert.notEqual(candidate,retained);assert.equal(s.bitmap.isDisposed,false);assert.equal(s.group.isDisposed,false);assert.equal(s.controller.getStatus().state,'paused');
  active.controller.resume();s.engine.advanceTime(0.375);assert.equal(active.controller.getStatus().positionSeconds,0.25);assert.deepEqual(events.map(e=>e.id),['quarter']);
  const previous=active,again=s.slot.request(request(next.loader));await again.ready;again.capture(frame);again.commit();assert.equal(previous.bitmap.isDisposed,true);assert.equal(previous.controller.getStatus().isDisposed,true);assert.equal(next.textures[0].isDisposed,false);
  s.slot.dispose();assert.equal(next.textures[0].isDisposed,true);assert.equal(s.bitmap.isDisposed,false);assert.equal(s.group.isDisposed,false);
 }finally{await s.close();await next.close();}
});
test('malformed, foreign and mismatched requests preserve accepted pending intent',async()=>{
 const s=await scene(),n=await contentSetup(contentFixture(),{hold:true},s.engine),foreign=await contentSetup();
 try{const t=s.slot.request(request(n.loader));let reads=0;
  for(const bad of [{...request(n.loader),policy:'preserve'},{...request(n.loader),loader:{}},{...request(foreign.loader)},{...request(n.loader),imageId:'missing'},{...request(n.loader),playback:{...playback,rate:17}},{...request(n.loader),playback:{...playback,markers:[{id:'bad id',timeSeconds:0}]}}])assert.throws(()=>s.slot.request(bad));
  const accessor={...request(n.loader)};Object.defineProperty(accessor,'version',{get(){reads++;return 'bad';}});assert.throws(()=>s.slot.request(accessor));assert.equal(reads,0);assert.equal(t.state,'loading');n.pending[0].d.resolve(n.pending[0].texture);await t.ready;t.capture(frame);t.commit();
 }finally{await s.close();await n.close();await foreign.close();}
});
for(const action of ['cancel','supersede','scope','slot','engine'])test('late acquisition after '+action+' cannot publish and releases exactly once',async()=>{
 const s=await scene(),n=await contentSetup(contentFixture(),{hold:true},s.engine);
 try{const t=s.slot.request(request(n.loader)),rejected=assert.rejects(t.ready);let closing;
  if(action==='cancel')t.dispose();if(action==='scope')s.scope.dispose();if(action==='slot')s.slot.dispose();if(action==='engine')closing=s.engine.dispose();
  if(action==='supersede'){const second=s.slot.request(request(s.loader));await second.ready;assert.equal(second.state,'ready');second.dispose();}
  await rejected;n.pending[0].d.resolve(n.pending[0].texture);await flush();await closing;
  assert.equal(t.state,'cancelled');assert.equal(n.textures[0].isDisposed,true);assert.equal(n.disposed.filter(x=>egret.isTexture(x)).length,1);
  if(action==='cancel'||action==='supersede'){assert.equal(s.slot.getActive().bitmap,s.bitmap);assert.equal(s.controller.getStatus().state,'running');}
 }finally{await s.close();await n.close();}
});
test('bad content and late clip-dependent marker refusal preserve active old generation',async()=>{
 const s=await scene(),bad=await contentSetup(contentFixture(f=>{f.sequence.sequenceInput.frames[0].durationSeconds=0.5;}),{},s.engine);
 try{const t=s.slot.request(request(bad.loader));await assert.rejects(t.ready);assert.equal(t.state,'failed');assert.equal(s.slot.getActive().bitmap,s.bitmap);assert.ok(bad.textures.every(x=>x.isDisposed));
  const marker=s.slot.request({...request(s.loader),playback:{...playback,markers:[{id:'late',timeSeconds:1}]}});await assert.rejects(marker.ready,{code:'ANIMATION_OPTIONS_INVALID'});assert.equal(s.controller.getStatus().state,'running');
 }finally{await s.close();await bad.close();}
});
for(const change of ['topology','content','caller-pause','caller-resume','caller-stop','capture-options'])test('stale '+change+' refuses publication and preserves caller control',async()=>{
 const s=await scene();try{const t=s.slot.request(request(s.loader));await t.ready;
  if(change==='capture-options'){code(()=>t.capture({width:-1,height:1}),'INVALID_FRAME_OPTIONS');assert.equal(s.controller.getStatus().state,'running');return;}
  t.capture(frame);
  if(change==='topology')s.container.x=1;
  if(change==='content')s.bitmap.alpha=0.5;
  if(change==='caller-pause')s.controller.pause();
  if(change==='caller-resume')s.controller.resume();
  if(change==='caller-stop')s.controller.stop();
  assert.throws(()=>t.commit());assert.equal(t.state,'failed');assert.equal(s.slot.getActive().bitmap,s.bitmap);
  assert.equal(s.controller.getStatus().state,change==='caller-pause'?'paused':change==='caller-stop'?'stopped':'running');
 }finally{await s.close();}
});
test('capture cancellation resumes only unchanged slot-owned pause; borrowed paused state stays paused',async()=>{
 const s=await scene();try{for(const mode of ['running','already-paused','caller-paused']){
  if(mode==='already-paused')s.controller.pause();else if(s.controller.getStatus().state==='paused')s.controller.resume();
  const t=s.slot.request(request(s.loader));await t.ready;t.capture(frame);if(mode==='caller-paused')s.controller.pause();t.dispose();assert.equal(s.controller.getStatus().state,mode==='running'?'running':'paused');
 }}finally{await s.close();}
});
test('genuine initial controller and exclusive target are required; legacy claims remain exclusive',async()=>{
 const s=await scene();try{code(()=>createSequenceResetSlot(s.engine,s.scope,s.container,{version:'x',bitmap:s.bitmap,controller:s.other}),'SEQUENCE_RESET_INITIAL_INVALID');code(()=>createSequenceResetSlot(s.engine,s.scope,s.container,{version:'x',bitmap:s.bitmap,controller:s.controller}),'SEQUENCE_RESET_TARGET_CLAIMED');
  code(()=>s.engine.createSequencePlayback(s.scope,s.bitmap,s.group.getSequence('e_sequence'),{mode:'loop'}),'SEQ_PLAYBACK_TARGET_BUSY');
  s.slot.dispose();const again=createSequenceResetSlot(s.engine,s.scope,s.container,{version:'x',bitmap:s.bitmap,controller:s.controller});again.dispose();
 }finally{await s.close();}
});
test('existing 256-controller capacity refuses new admission without cancelling valid pending intent',async()=>{
 const s=await scene(),n=await contentSetup(contentFixture(),{hold:true},s.engine),extra=[];
 try{const t=s.slot.request(request(n.loader));for(let i=0;i<254;i++){const b=s.resources.use(new egret.Bitmap(s.group.getImage('e_page')));extra.push(createSequenceController(s.engine,s.resources,b,s.group.getSequence('e_sequence'),playback));}
  code(()=>s.slot.request(request(s.loader)),'ANIMATION_CONTROLLER_LIMIT');assert.equal(t.state,'loading');extra.pop().dispose();n.pending[0].d.resolve(n.pending[0].texture);await t.ready;t.capture(frame);t.commit();
 }finally{await s.close();await n.close();}
});
test('acquisition and retirement callback reentry cannot publish after slot close',async()=>{
 const s=await scene(),n=await contentSetup(contentFixture(),{onLoad(){s.slot.dispose();}},s.engine);
 try{const t=s.slot.request(request(n.loader));await assert.rejects(t.ready);assert.equal(s.slot.isDisposed,true);await flush();assert.ok(n.textures.every(x=>x.isDisposed));assert.equal(s.bitmap.isDisposed,false);}
 finally{await s.close();await n.close();}
});

test('RESET preserves authored marker indices and finite completion after silent zero consumption',async()=>{
 const s=await scene(),events=[];try{const t=s.slot.request({...request(s.loader),playback:{profile:'egret.sequence-control/1',totalPlays:2,markers:[{id:'end',timeSeconds:0.375},{id:'zero',timeSeconds:0},{id:'middle',timeSeconds:0.125}],onEvent:e=>{events.push(e);}}});await t.ready;t.capture(frame);const active=t.commit();
  assert.equal(active.controller.getStatus().committedEventCount,1);assert.deepEqual(events,[]);active.controller.resume();
  for(const time of [0.125,0.25,0.375,0.5,0.625,0.75])s.engine.advanceTime(time);
  assert.equal(active.controller.getStatus().state,'completed');assert.deepEqual(events.map(e=>e.kind==='marker'?[e.id,e.markerIndex]:[e.kind]),[['middle',2],['end',0],['zero',1],['middle',2],['end',0],['complete']]);
 }finally{await s.close();}
});
test('retirement callback sees published successor and can close it without skipping cleanup',async()=>{
 const s=await scene();let armed=false,calls=0,seen;
 const n=await contentSetup(contentFixture(),{onDispose(value){calls++;if(armed){seen=s.slot.getActive().version;s.slot.dispose();armed=false;}}},s.engine);
 const third=await contentSetup(contentFixture(),{},s.engine);
 try{const first=s.slot.request(request(n.loader));await first.ready;first.capture(frame);const previous=first.commit();const second=s.slot.request({...request(third.loader),version:'third'});await second.ready;second.capture(frame);armed=true;const current=second.commit();
  assert.equal(seen,'third');assert.equal(second.state,'committed');assert.equal(s.slot.isDisposed,true);assert.equal(previous.bitmap.isDisposed,true);assert.equal(current.bitmap.isDisposed,true);assert.equal(calls,3);assert.ok(n.textures.every(t=>t.isDisposed));assert.ok(third.textures.every(t=>t.isDisposed));assert.equal(s.group.isDisposed,false);
 }finally{await s.close();await n.close();await third.close();}
});
test('throwing metadata disposal still attempts every other candidate resource',async()=>{
 const s=await scene(),n=await contentSetup(contentFixture(),{onDispose(value){if(typeof value==='string')throw Error('owned metadata cleanup control');}},s.engine);
 try{const t=s.slot.request(request(n.loader));await t.ready;t.dispose();assert.equal(t.state,'cancelled');assert.equal(n.disposed.length,3);assert.ok(n.textures.every(x=>x.isDisposed));assert.equal(s.group.isDisposed,false);assert.equal(s.controller.getStatus().state,'running');}
 finally{await s.close();await n.close();}
});
test('capture option reentry cancellation revokes the candidate and restores the old controller',async()=>{
 const s=await scene();try{const t=s.slot.request(request(s.loader));await t.ready;assert.throws(()=>t.capture({get width(){t.dispose();return 8;},height:4}));assert.equal(t.state,'cancelled');assert.equal(s.controller.getStatus().state,'running');assert.equal(s.slot.getActive().bitmap,s.bitmap);}
 finally{await s.close();}
});
test('capacity consumed after admission fails only that candidate and retains active resources',async()=>{
 const s=await scene(),n=await contentSetup(contentFixture(),{hold:true},s.engine);try{const t=s.slot.request(request(n.loader));for(let i=0;i<254;i++){const bitmap=s.resources.use(new egret.Bitmap(s.group.getImage('e_page')));createSequenceController(s.engine,s.resources,bitmap,s.group.getSequence('e_sequence'),playback);}n.pending[0].d.resolve(n.pending[0].texture);await assert.rejects(t.ready,{code:'ANIMATION_CONTROLLER_LIMIT'});assert.equal(t.state,'failed');assert.equal(s.slot.getActive().bitmap,s.bitmap);assert.equal(n.textures[0].isDisposed,true);}
 finally{await s.close();await n.close();}
});

for(const state of ['paused','idle','completed','stopped','faulted'])test('RESET authenticates original target after '+state+' and detects intervening commands',async()=>{
 const s=await scene();try{
  if(state==='paused'){s.controller.pause();const t=s.slot.request(request(s.loader));await t.ready;t.capture(frame);s.controller.resume();code(()=>t.commit(),'SEQUENCE_RESET_CONTROLLER_CHANGED');assert.equal(s.controller.getStatus().state,'running');return;}
  if(state==='idle'||state==='completed'){s.slot.dispose();s.controller.dispose();s.controller=createSequenceController(s.engine,s.resources,s.bitmap,s.group.getSequence('e_sequence'),state==='completed'?{profile:'egret.sequence-control/1'}:playback);s.slot=createSequenceResetSlot(s.engine,s.scope,s.container,{version:'idle',bitmap:s.bitmap,controller:s.controller});}
  if(state==='stopped')s.controller.stop();
  if(state==='completed'){s.controller.start();s.controller.seek({timeSeconds:0.375});assert.equal(s.controller.getStatus().state,'completed');}
  if(state==='faulted'){s.bitmap.textureLease=undefined;s.engine.advanceTime(0.125);assert.equal(s.controller.getStatus().state,'faulted');s.bitmap.textureLease=s.group.getImage('e_page');}
  const t=s.slot.request(request(s.loader));await t.ready;t.capture(frame);const active=t.commit();assert.equal(active.controller.getStatus().state,'paused');assert.equal(active.controller.getStatus().positionSeconds,0);
 }finally{await s.close();}
});
test('finite owned sequence can be RESET again after completion',async()=>{
 const s=await scene();try{const first=s.slot.request({...request(s.loader),playback:{profile:'egret.sequence-control/1'}});await first.ready;first.capture(frame);const old=first.commit();old.controller.resume();s.engine.advanceTime(0.25);s.engine.advanceTime(0.375);assert.equal(old.controller.getStatus().state,'completed');const next=s.slot.request(request(s.loader));await next.ready;next.capture(frame);next.commit();assert.equal(old.bitmap.isDisposed,true);}
 finally{await s.close();}
});

for(const callerPause of [false,true])test('closing only orchestration Scope restores only its own prepared pause: '+callerPause,async()=>{
 const s=await scene(),n=await contentSetup(contentFixture(),{},s.engine);s.slot.dispose();const orchestration=s.engine.createScope();
 const slot=createSequenceResetSlot(s.engine,orchestration,s.container,{version:'old',bitmap:s.bitmap,controller:s.controller});
 try{const t=slot.request(request(n.loader));await t.ready;s.engine.advanceTime(0.125);t.capture(frame);assert.equal(s.controller.getStatus().state,'paused');if(callerPause)s.controller.pause();orchestration.dispose();
  assert.equal(t.state,'cancelled');assert.equal(slot.isDisposed,true);assert.equal(s.scope.state,'open');assert.equal(s.resources.state,'open');assert.equal(s.bitmap.isDisposed,false);assert.equal(s.group.isDisposed,false);assert.equal(s.container.getChildAt(0),s.bitmap);assert.ok(n.textures.every(x=>x.isDisposed));
  assert.equal(s.controller.getStatus().state,callerPause?'paused':'running');s.engine.advanceTime(0.25);assert.equal(s.controller.getStatus().positionSeconds,callerPause?0.125:0.25);assert.equal(s.other.getStatus().positionSeconds,0.25);
 }finally{orchestration.dispose();await s.close();await n.close();}
});
for(const operation of ['stop','dispose'])test('refused reentrant '+operation+' and malformed request preserve a prepared candidate',async()=>{
 const s=await scene();try{const t=s.slot.request(request(s.loader));await t.ready;t.capture(frame);let rejected;
  const bad={...request(s.loader),playback:{...playback,get rate(){try{s.controller[operation]();}catch(error){rejected=error.code;}return 17;}}};
  code(()=>s.slot.request(bad),'ANIMATION_OPTIONS_INVALID');assert.equal(rejected,'ANIMATION_REENTRANT');assert.equal(t.state,'prepared');assert.equal(s.controller.getStatus().state,'paused');assert.equal(t.commit().controller.getStatus().positionSeconds,0);assert.equal(t.state,'committed');
 }finally{await s.close();}
});


const preserveRequest=loader=>({version:'preserved',loader,imageId:'e_page',sequenceId:'e_sequence'});

test('compatible sequence replacement preserves the second play and resumes from commit time',async()=>{
 const events=[],s=await scene({...playback,rate:2,totalPlays:2,markers:[
  {id:'zero',timeSeconds:0},{id:'first',timeSeconds:0.125},{id:'second',timeSeconds:0.25},
 ],onEvent:event=>{events.push(event);}});
 const next=await contentSetup(contentFixture(),{hold:true,pixels:[0,0,255,255,255,255,0,255]},s.engine);
 try{
  const ticket=s.slot.requestPreserving(preserveRequest(next.loader));
  s.engine.advanceTime(0.1875);assert.equal(ticket.state,'loading');
  next.pending[0].d.resolve(next.pending[0].texture);await ticket.ready;
  s.engine.advanceTime(0.28125);
  const before=s.controller.getStatus();assert.equal(before.playIndex,1);assert.equal(before.positionSeconds,0.1875);
  assert.deepEqual(events.map(event=>event.id),['zero','first','second','zero','first']);
  ticket.capture(frame);
  s.engine.advanceTime(0.34375);
  assert.equal(s.controller.getStatus().state,'paused');assert.equal(s.other.getStatus().positionSeconds,0.34375);
  const active=ticket.commit(),after=active.controller.getStatus();
  assert.equal(s.container.getChildAt(0),active.bitmap);assert.notEqual(active.bitmap,s.bitmap);
  assert.equal(after.state,'running');assert.equal(after.elapsedSeconds,before.elapsedSeconds);
  assert.equal(after.positionSeconds,before.positionSeconds);assert.equal(after.playIndex,before.playIndex);
  assert.equal(after.rate,2);assert.equal(after.totalPlays,2);assert.equal(after.lastSample.frameIndex,1);
  assert.equal(after.committedEventCount,5);assert.equal(events.length,5);assert.equal(s.bitmap.isDisposed,false);
  s.engine.advanceTime(0.375);
  assert.equal(active.controller.getStatus().elapsedSeconds,0.625);
  assert.deepEqual([events[5].id,events[5].sequence,events[5].playIndex],['second',6,1]);
  s.engine.advanceTime(0.4375);
  assert.deepEqual([events.length,events[6].kind,events[6].sequence],[7,'complete',7]);
  assert.equal(active.controller.getStatus().state,'completed');
 }finally{await s.close();await next.close();}
});

test('compatible replacement preserves pause, while mismatch and cancellation keep the old owner',async()=>{
 const s=await scene(),different=await contentSetup(contentFixture(f=>{
  for(const input of [f.atlas.sequenceInput,f.sequence.sequenceInput]){
   input.frames[0].durationSeconds=0.25;input.frames[1].durationSeconds=0.125;
  }
 }),{},s.engine);
 const next=await contentSetup(contentFixture(),{},s.engine);
 try{
  s.engine.advanceTime(0.125);
  const rejected=s.slot.requestPreserving(preserveRequest(different.loader));
  await assert.rejects(rejected.ready,{code:'SEQUENCE_RESET_PRESERVE_TIMELINE'});
  assert.equal(rejected.state,'failed');assert.equal(s.slot.getActive().bitmap,s.bitmap);
  assert.equal(s.controller.getStatus().state,'running');
  assert.equal(different.textures[0].isDisposed,true);
  const cancelled=s.slot.requestPreserving(preserveRequest(next.loader));await cancelled.ready;
  cancelled.capture(frame);assert.equal(s.controller.getStatus().state,'paused');
  cancelled.dispose();assert.equal(s.slot.getActive().bitmap,s.bitmap);
  assert.equal(s.controller.getStatus().state,'running');
  s.controller.pause();s.controller.setRate(0);
  const retained=s.slot.requestPreserving(preserveRequest(next.loader));await retained.ready;retained.capture(frame);
  const active=retained.commit();
  s.engine.advanceTime(0.25);
  const after=active.controller.getStatus();
  assert.equal(after.state,'paused');assert.equal(after.rate,0);assert.equal(after.elapsedSeconds,0.125);
  assert.equal(after.lastSample.frameIndex,1);
 }finally{await s.close();await different.close();await next.close();}
});


test('a caller command after preserve capture and an ended source keep their authority',async()=>{
 const s=await scene();
 try{
  const ticket=s.slot.requestPreserving(preserveRequest(s.loader));await ticket.ready;ticket.capture(frame);
  s.controller.seek({timeSeconds:0.25});
  code(()=>ticket.commit(),'SEQUENCE_RESET_CONTROLLER_CHANGED');
  assert.equal(ticket.state,'failed');assert.equal(s.slot.getActive().bitmap,s.bitmap);
  assert.equal(s.controller.getStatus().state,'paused');assert.equal(s.controller.getStatus().elapsedSeconds,0.25);
  s.controller.stop();
  code(()=>s.slot.requestPreserving(preserveRequest(s.loader)),'SEQUENCE_RESET_PRESERVE_STATE');
  const reset=s.slot.request(request(s.loader));await reset.ready;reset.capture(frame);
  assert.equal(reset.commit().controller.getStatus().elapsedSeconds,0);
 }finally{await s.close();}
});


test('a source without ContentLoader provenance cannot cancel an accepted RESET',async()=>{
 const raw=egret.createSequenceClip({atlasWidth:2,atlasHeight:1,frames:[
  {x:0,y:0,width:1,height:1,durationSeconds:0.125},
  {x:1,y:0,width:1,height:1,durationSeconds:0.25},
 ]});
 const s=await scene(playback,{clip:raw}),next=await contentSetup(contentFixture(),{hold:true},s.engine);
 try{
  const pending=s.slot.request(request(next.loader));
  code(()=>s.slot.requestPreserving(preserveRequest(s.loader)),'SEQUENCE_RESET_PRESERVE_TIMELINE');
  assert.equal(pending.state,'loading');assert.equal(s.controller.getStatus().state,'running');
  next.pending[0].d.resolve(next.pending[0].texture);
  await pending.ready;pending.capture(frame);assert.equal(pending.commit().ownership,'owned');
 }finally{await s.close();await next.close();}
});

test('queued source commands and finite completion refuse a preserve request',async()=>{
 let s;
 s=await scene({...playback,totalPlays:1,markers:[{id:'first',timeSeconds:0.125}],
  onEvent(){s.controller.setRate(1);}});
 try{
  s.engine.advanceTime(0.125);assert.equal(s.controller.getStatus().pendingCommands,1);
  code(()=>s.slot.requestPreserving(preserveRequest(s.loader)),'SEQUENCE_RESET_PRESERVE_STATE');
  s.engine.advanceTime(0.25);assert.equal(s.controller.getStatus().pendingCommands,0);
  s.engine.advanceTime(0.375);assert.equal(s.controller.getStatus().state,'completed');
  code(()=>s.slot.requestPreserving(preserveRequest(s.loader)),'SEQUENCE_RESET_PRESERVE_STATE');
 }finally{await s.close();}
});

for(const callerPause of [false,true])test('capture cancellation during a caught-up marker respects the caller pause '+callerPause,async()=>{
 let s,ticket,first=true;
 s=await scene({...playback,markers:[{id:'owed',timeSeconds:0.125}],onEvent(){
  if(callerPause)s.controller.pause();
  ticket.dispose();
 }},{beforeController(engine,scope){
  engine.clock.onTick(scope,()=>{if(first){first=false;throw Error('prior clock callback');}});
 }});
 try{
  ticket=s.slot.requestPreserving(preserveRequest(s.loader));await ticket.ready;
  code(()=>s.engine.advanceTime(0.125),'CLOCK_CALLBACK_FAILED');
  assert.equal(s.controller.getStatus().elapsedSeconds,0);
  code(()=>ticket.capture(frame),'SEQUENCE_RESET_RETIRED');
  const state=s.controller.getStatus();
  assert.equal(ticket.state,'cancelled');assert.equal(s.slot.getActive().bitmap,s.bitmap);
  assert.equal(state.elapsedSeconds,0.125);assert.equal(state.committedEventCount,1);
  assert.equal(state.state,callerPause?'paused':'running');
  assert.equal(state.pendingCommands,callerPause?1:0);
  s.engine.advanceTime(0.25);
  assert.equal(s.controller.getStatus().elapsedSeconds,callerPause?0.125:0.25);
 }finally{await s.close();}
});
