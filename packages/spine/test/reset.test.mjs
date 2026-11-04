// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {createSpineContentLoader,createSpineInstance,createSpineDisplay,createSpineResetSlot} from '@egret/spine';
import {host} from '../../../tests/helpers.mjs';
import {fixture,ports,codes} from './fixtures.mjs';import {renderingSource} from './renderingFixture.mjs';

const frameOptions={width:64,height:64},tick=(tickId,deltaSeconds=0)=>({tickId,deltaSeconds,elapsedSeconds:tickId});
const shape=frame=>{const {frameId,...rest}=frame;return rest;};
async function setup(t,{source=renderingSource(),control={},onDiagnostic}={}){
 const diagnostics=[],engine=await createEngine({host:host().adapter,onDiagnostic:d=>{diagnostics.push(d);onDiagnostic?.(d);}}),loaders=[];
 function version(source=renderingSource(),control={}){const data=fixture({skeleton:source}),p=ports(data,control),loader=createSpineContentLoader(engine,engine.createScope(),data.manifest,p.factory);loaders.push(loader);return {loader,p};}
 const first=version(source,control),scope=engine.createScope(),group=first.loader.load(engine.createScope(),['e_json']);await group.ready;
 const instance=createSpineInstance(group.getSpine('e_json'),engine.createScope()),display=createSpineDisplay(instance,engine.createScope(),{colorProfile:'egret-shared-linear/1'}),target=scope.use(new DisplayObjectContainer());target.addChild(display.node);engine.stage.addChild(target);
 const slot=createSpineResetSlot(engine,scope,target,{version:'v1',instance,display});
 t.after(async()=>{for(const loader of loaders)await loader.close();await engine.dispose();});
 const request=(loader=first.loader,changes={})=>slot.request({policy:'reset',version:'v2',loader,assetId:'e_json',animation:'move',...changes});
 return {engine,scope,group,instance,display,target,slot,first,version,request,diagnostics,capture:()=>engine.captureSharedFrame(frameOptions)};
}
test('RESET loading and ready preserve old pose/frame; commit borrows initial and consumes no clock',async t=>{
 const s=await setup(t),events=[];s.instance.setAnimation(0,'move',{loop:true});s.instance.advance(tick(10,.03));
 const before=s.instance.getSnapshot(),old=shape(s.capture()),r=s.request(s.first.loader,{onEvent:e=>events.push(e)});
 assert.equal(r.state,'loading');assert.equal(s.slot.getActive().instance,s.instance);await r.ready;
 assert.equal(r.state,'ready');assert.deepEqual(s.instance.getSnapshot(),before);assert.deepEqual(shape(s.capture()),old);assert.deepEqual(events,[]);
 const staged=r.capture(frameOptions);assert.notDeepEqual(shape(staged),old);assert.deepEqual(shape(s.capture()),old);
 const next=r.commit();assert.equal(r.state,'committed');assert.equal(next.ownership,'owned');assert.equal(next.instance.getSnapshot().tickId,0);assert.equal(next.instance.getSnapshot().elapsedSeconds,0);assert.deepEqual(next.instance.getSnapshot().events,[]);
 assert.deepEqual(shape(s.capture()),shape(staged));assert.equal(s.instance.isDisposed,false);assert.equal(s.display.getStatus().isDisposed,false);assert.equal(s.group.isDisposed,false);assert.deepEqual(s.instance.getSnapshot(),before);
 next.instance.advance(tick(100,.03));assert.equal(next.instance.getSnapshot().tickId,100);assert.equal(next.instance.getSnapshot().elapsedSeconds,.03);assert.deepEqual(events.map(e=>e.kind),['event']);assert.equal(events[0].event.name,'step');
 assert.throws(()=>r.commit(),e=>e.code==='SPINE_RESET_RETIRED');r.dispose();assert.equal(next.instance.isDisposed,false);
 s.slot.dispose();assert.equal(next.instance.isDisposed,true);assert.equal(s.instance.isDisposed,false);assert.equal(s.first.loader.isDisposed,false);
});
test('only newest intent publishes; held stale provider settles without replacing or leaking',async t=>{
 const s=await setup(t),v=s.version(renderingSource(),{hold:'e_a'}),old=shape(s.capture()),r1=s.request(v.loader);
 for(let i=0;i<20&&!v.p.gates.length;i++)await Promise.resolve();assert.equal(v.p.gates.length,1);
 const r2=s.request();await assert.rejects(r1.ready);await r2.ready;assert.equal(r1.state,'cancelled');assert.deepEqual(shape(s.capture()),old);v.p.resolve();await v.loader.close();
 r2.capture(frameOptions);r2.commit();assert.equal(s.slot.getActive().version,'v2');assert.equal(v.loader.getStatus().liveInstances,0);assert.equal(v.p.retired.length,2);
});
for(const mode of ['cancel','scope','slot'])test('pending '+mode+' releases late group resources and preserves borrowed initial',async t=>{
 const s=await setup(t),v=s.version(renderingSource(),{hold:'e_a'}),r=s.request(v.loader);
 for(let i=0;i<20&&!v.p.gates.length;i++)await Promise.resolve();
 if(mode==='cancel')r.dispose();else if(mode==='scope')s.scope.dispose();else s.slot.dispose();
 await assert.rejects(r.ready);assert.equal(r.state,'cancelled');v.p.resolve();await v.loader.close();assert.equal(v.loader.getStatus().liveInstances,0);assert.equal(s.instance.isDisposed,false);assert.equal(s.group.isDisposed,false);
});
for(const [name,changes] of [['animation',{animation:'MOVE'}],['skin',{skins:['Default']}],['zero-duration finite',{animation:'idle',plays:2}]])test('exact '+name+' refusal leaves old state and allows retry',async t=>{
 const s=await setup(t),before=s.instance.getSnapshot(),r=s.request(s.first.loader,changes);await assert.rejects(r.ready);assert.equal(r.state,'failed');assert.deepEqual(s.instance.getSnapshot(),before);assert.equal(s.target.getChildAt(0),s.display.node);assert.equal(s.first.loader.getStatus().groups,1);
 const retry=s.request();await retry.ready;retry.capture(frameOptions);retry.commit();assert.equal(s.slot.getActive().ownership,'owned');
});
test('provider failure retains previous active and its resource consumers',async t=>{
 const s=await setup(t),v=s.version(renderingSource(),{fail:'e_json'}),r=s.request(v.loader);await assert.rejects(r.ready);assert.equal(r.state,'failed');assert.equal(s.slot.getActive().instance,s.instance);assert.equal(s.first.loader.getStatus().liveInstances,1);assert.equal(v.loader.getStatus().liveInstances,0);
});
test('borrowed shared group and sibling survive automatic owned-predecessor retirement',async t=>{
 const s=await setup(t),sibling=createSpineInstance(s.group.getSpine('e_json'),s.engine.createScope());
 const r1=s.request();await r1.ready;r1.capture(frameOptions);const a=r1.commit(),snapshot=a.instance.getSnapshot(),saved=s.capture();
 const r2=s.request(s.first.loader,{version:'v2'});await r2.ready;r2.capture(frameOptions);const b=r2.commit();
 assert.equal(a.instance.isDisposed,true);assert.equal(a.display.getStatus().isDisposed,true);assert.equal(b.instance.isDisposed,false);assert.equal(sibling.isDisposed,false);assert.equal(s.instance.isDisposed,false);assert.equal(s.first.loader.getStatus().groups,2);assert.equal(s.first.loader.getStatus().liveInstances,3);assert.equal(s.first.p.retired.length,0);
 assert.equal(saved.commands.filter(c=>c.kind==='mesh').length,2);assert.equal(snapshot.tickId,0);sibling.advance(tick(1));s.slot.dispose();assert.equal(s.first.loader.getStatus().groups,1);assert.equal(s.first.loader.getStatus().liveInstances,2);
});
test('old advance in bounded final window invalidates genuine prepared CPU publication',async t=>{
 const s=await setup(t);s.instance.setAnimation(0,'move',{loop:true});s.instance.advance(tick(1));
 const r=s.request();await r.ready;r.capture(frameOptions);s.instance.advance(tick(2,.03));
 assert.throws(()=>r.commit(),e=>codes(e).includes('DISPLAY_SUBTREE_STALE'));assert.equal(r.state,'prepared');assert.equal(s.slot.getActive().instance,s.instance);assert.throws(()=>r.capture(frameOptions),e=>e.code==='SPINE_RESET_NOT_READY');r.dispose();
 const retry=s.request();await retry.ready;retry.capture(frameOptions);retry.commit();
});
test('unrelated sibling content may change during candidate window without advancing candidate',async t=>{
 const s=await setup(t),sibling=s.scope.use(new DisplayObjectContainer());s.engine.stage.addChild(sibling);
 const r=s.request();await r.ready;r.capture(frameOptions);sibling.x=22;r.commit();assert.equal(s.slot.getActive().instance.getSnapshot().elapsedSeconds,0);
});
test('invalid admission cannot supersede ready valid intent or call facade loader',async t=>{
 const s=await setup(t),r=s.request();await r.ready;let touched=0;
 assert.throws(()=>s.request({load(){touched++;}},{version:'bad'}),e=>e.code==='SPINE_RESET_LOADER_INVALID');assert.equal(touched,0);
 for(const changes of [{policy:'preserve'},{skins:[]},{skins:['default','default']},{loop:true,plays:2},{plays:0},{version:''}])assert.throws(()=>s.request(s.first.loader,changes));
 assert.equal(r.state,'ready');r.capture(frameOptions);r.commit();
});
test('foreign loader and initial display/player mismatch refuse genuine affinity',async t=>{
 const s=await setup(t),other=await setup(t);
 assert.throws(()=>s.request(other.first.loader));assert.equal(s.slot.getActive().instance,s.instance);
 assert.throws(()=>createSpineResetSlot(s.engine,s.scope,s.target,{version:'v1',instance:other.instance,display:s.display}),e=>e.code==='SPINE_RESET_INITIAL_INVALID');
 assert.throws(()=>createSpineResetSlot(s.engine,s.scope,s.target,{version:'v1',instance:s.instance,display:s.display}),e=>e.code==='SPINE_RESET_TARGET_CLAIMED');
});
test('own descriptor reentry cannot inject request or leave an accepted stale demand',async t=>{
 const s=await setup(t),r=s.request();await r.ready;
 const request=new Proxy({policy:'reset',version:'x',loader:s.first.loader,assetId:'e_json',animation:'move'},{ownKeys(target){assert.throws(()=>s.request(),e=>e.code==='SPINE_RESET_REENTRANT');return Reflect.ownKeys(target);}});
 const next=s.slot.request(request);await next.ready;assert.equal(r.state,'cancelled');next.dispose();
 const cancel=new Proxy({policy:'reset'},{ownKeys(){s.slot.dispose();return [];}});assert.throws(()=>s.slot.request(cancel));
});
test('candidate capture options reentry cancellation leaves old active and releases candidate',async t=>{
 const s=await setup(t),r=s.request();await r.ready;
 assert.throws(()=>r.capture({get width(){r.dispose();return 64;},height:64}));assert.equal(r.state,'cancelled');assert.equal(s.slot.getActive().instance,s.instance);assert.equal(s.first.loader.getStatus().liveInstances,1);
});
test('zero-duration reset consumes time-zero start and complete without replay',async t=>{
 const s=await setup(t),events=[],r=s.request(s.first.loader,{animation:'idle',plays:1,onEvent:e=>events.push(e)});await r.ready;r.capture(frameOptions);const a=r.commit();assert.deepEqual(a.instance.getSnapshot().events,[]);assert.deepEqual(events,[]);assert.equal(a.instance.getSnapshot().tracks[0].completedPlays,1);
 a.instance.advance(tick(55));assert.deepEqual(events,[]);assert.equal(a.instance.getSnapshot().elapsedSeconds,0);
});
test('finite RESET begins at first play and normal events advance after explicit higher Engine tick',async t=>{
 const s=await setup(t),events=[],r=s.request(s.first.loader,{plays:2,onEvent:e=>events.push(e)});await r.ready;r.capture(frameOptions);const a=r.commit();
 assert.equal(a.instance.getSnapshot().tracks[0].completedPlays,0);assert.equal(a.instance.getSnapshot().tracks[0].trackTime,0);
 a.instance.advance(tick(50,.12));assert.equal(a.instance.getSnapshot().tracks[0].completedPlays,1);assert.equal(events.filter(e=>e.kind==='complete').length,1);assert.equal(events.filter(e=>e.kind==='start').length,0);
 a.instance.advance(tick(51,.12));assert.equal(a.instance.getSnapshot().tracks[0].completedPlays,2);
});

test('owned predecessor provider cleanup observes committed state; failure uses Engine diagnostic domain',async t=>{
 const s=await setup(t),observed=[],control={},v=s.version(renderingSource(),control),a=s.request(v.loader);await a.ready;a.capture(frameOptions);const previous=a.commit();
 const b=s.request(s.first.loader,{version:'third'});await b.ready;b.capture(frameOptions);
 control.retireTexture=()=>{observed.push({state:b.state,version:s.slot.getActive().version,oldDisposed:previous.instance.isDisposed});assert.throws(()=>s.request(),e=>e.code==='SPINE_RESET_REENTRANT');throw Error('Assigned postcommit provider cleanup');};
 const active=b.commit();assert.equal(active.version,'third');assert.equal(b.state,'committed');assert.deepEqual(observed,[{state:'committed',version:'third',oldDisposed:true},{state:'committed',version:'third',oldDisposed:true}]);assert.ok(s.diagnostics.length>0);assert.equal(v.loader.getStatus().liveInstances,0);assert.equal(s.slot.getActive(),active);assert.throws(()=>b.commit(),e=>e.code==='SPINE_RESET_RETIRED');
});
test('cancelled candidate provider cleanup may dispose slot while newer request is being accepted',async t=>{
 const s=await setup(t),control={},v=s.version(renderingSource(),control),a=s.request(v.loader);await a.ready;
 control.retireTexture=()=>{s.slot.dispose();throw Error('Assigned cancelling cleanup');};
 assert.throws(()=>s.request(),e=>e.code==='SPINE_RESET_DISPOSED');assert.equal(a.state,'cancelled');assert.equal(s.slot.isDisposed,true);assert.equal(s.first.loader.getStatus().groups,1);assert.equal(s.first.loader.getStatus().liveInstances,1);assert.equal(v.loader.getStatus().liveInstances,0);assert.equal(s.instance.isDisposed,false);
});

test('diagnostic observer disposal during supersession cancels the inaccessible new demand',async t=>{
 let s,armed=false,observations=0;
 s=await setup(t,{onDiagnostic(){if(!armed)return;observations++;assert.throws(()=>s.request(),e=>e.code==='SPINE_RESET_REENTRANT');s.slot.dispose();}});
 const control={},v=s.version(renderingSource(),control),a=s.request(v.loader);await a.ready;armed=true;control.retireTexture=()=>{throw Error('Assigned provider retirement diagnostic');};
 assert.throws(()=>s.request(),e=>e.code==='SPINE_RESET_DISPOSED');assert.ok(observations>0);assert.equal(a.state,'cancelled');assert.equal(s.slot.isDisposed,true);assert.equal(v.loader.getStatus().groups,0);assert.equal(v.loader.getStatus().liveInstances,0);assert.equal(s.first.loader.getStatus().groups,1);assert.equal(s.instance.isDisposed,false);
});
test('authored zero-time events are consumed silently and never replay on first live tick',async t=>{
 const source=renderingSource();source.animations.move.events.unshift({time:0,name:'step2'});const s=await setup(t,{source}),events=[];
 const r=s.request(s.first.loader,{onEvent:event=>events.push(event)});await r.ready;r.capture(frameOptions);const a=r.commit();assert.deepEqual(events,[]);assert.deepEqual(a.instance.getSnapshot().events,[]);
 a.instance.advance(tick(100,.03));assert.deepEqual(events.map(event=>[event.kind,event.event?.name]),[['event','step']]);
});
