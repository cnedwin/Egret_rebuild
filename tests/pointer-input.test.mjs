// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {host,deferred} from './helpers.mjs';
const api=await import('@egret/engine/input').catch(error=>({missing:error.message}));
function sample(id,x=10){return {pointerId:id,pointerType:'touch',globalX:x,globalY:10,buttons:1,timestamp:0};}
function update(x=10){return {globalX:x,globalY:10,buttons:1,timestamp:1};}
async function fixture(run,options={}){
 const h=host(options.host),engine=await createEngine({host:h.adapter});
 const scope=engine.createScope(),a=new DisplayObjectContainer(),b=new DisplayObjectContainer();
 for(const [n,x] of [[a,0],[b,60]]){scope.use(n);n.x=x;n.hitArea={x:0,y:0,width:40,height:40};n.touchEnabled=true;engine.stage.addChild(n);}
 assert.equal(typeof api.createPointerInput,'function','M3_POINTER_FACTORY_MISSING: '+(api.missing??''));
 const notices=[];const input=api.createPointerInput({engine,scope,width:100,height:100,capacity:5,onContact:n=>{notices.push(n);options.onContact?.(n);}});
 try{await run({engine,scope,a,b,input,notices,h});}finally{input.dispose();await engine.dispose();}
}
test('M3 pointer independent contacts preserve genuine capture/target/bubble route',async()=>fixture(({engine,a,b,input,notices})=>{
 const route=[];engine.stage.on(input.events.begin,e=>route.push(['stage',e.eventPhase]),{capture:true});
 a.on(input.events.begin,e=>route.push(['a',e.payload.session.pointerId]));
 b.on(input.events.begin,e=>route.push(['b',e.payload.session.pointerId]));
 const first=input.begin(sample(1)),second=input.begin(sample(2,70));
 assert.deepEqual(route,[['stage','capturing'],['a',1],['stage','capturing'],['b',2]]);
 input.move(first,update(75));input.end(second,update(10));
 assert.equal(notices[2].target,a);assert.equal(notices[3].target,b);assert.equal(input.contacts.length,1);
 assert.equal(input.cancel(second,'lostcapture'),false);
 assert.equal(input.contacts[0].session,first);
}));
test('M3 pointer disabled owner cancels while a sibling contact remains active',async()=>fixture(({a,input,notices})=>{
 const first=input.begin(sample(1));input.begin(sample(2,70));a.touchEnabled=false;input.sync();
 assert.equal(input.contacts.length,1);assert.equal(notices.at(-1).kind,'cancel');assert.equal(notices.at(-1).reason,'owner');
 assert.equal(input.end(first,update()),false);
}));
test('M3 pointer listener removal/disposal ends session without dispatching to a stale route',async()=>fixture(({a,input,notices})=>{
 a.on(input.events.begin,()=>a.dispose());const id=input.begin(sample(1));
 assert.equal(input.contacts.length,0);assert.deepEqual(notices.map(n=>n.kind),['begin','cancel']);
 assert.equal(input.move(id,update()),false);
}));
test('M3 pointer detached owner produces a terminal observer without a fake Stage route',async()=>fixture(({engine,a,input,notices})=>{
 input.begin(sample(1));engine.stage.removeChild(a);input.sync();
 assert.equal(notices.at(-1).kind,'cancel');assert.equal(input.contacts.length,0);
}));
test('M3 pointer Scope disposal clears sessions and closes before further host updates',async()=>fixture(({scope,input,notices})=>{
 const id=input.begin(sample(1));scope.dispose();assert.equal(input.state,'closed');
 assert.equal(input.contacts.length,0);assert.equal(input.move(id,update()),false);
 assert.deepEqual(notices.map(n=>n.kind),['begin','cancel']);
}));
test('M3 pointer Engine close clears sessions immediately, before a pending Host completion',async()=>{
 const pending=deferred();await fixture(async({engine,input,notices})=>{
 input.begin(sample(1));const closing=engine.dispose();assert.equal(input.state,'closed');
 assert.equal(notices.at(-1).kind,'cancel');pending.resolve();await closing;
 },{host:{close(){return pending.promise;}}});
});
test('M3 pointer viewport change cancels before publishing the new revision',async()=>fixture(({input,notices})=>{
 const id=input.begin(sample(1));input.setViewportRevision(1);
 assert.equal(notices.at(-1).contact.viewportRevision,0);assert.equal(input.viewportRevision,1);
 assert.equal(input.move(id,update()),false);const next=input.begin(sample(1));assert.notEqual(next,id);
}));
test('M3 pointer rejects foreign Scope before attaching an input lifecycle owner',async()=>{
 const x=await createEngine({host:host().adapter}),y=await createEngine({host:host().adapter});
 try{assert.throws(()=>api.createPointerInput({engine:x,scope:y.createScope(),width:100,height:100}),e=>e.code==='MOUSE_INPUT_SCOPE_INVALID');}
 finally{await x.dispose();await y.dispose();}
});
test('M3 pointer first observer failure cancels every contact and closes the input',async()=>{
 const failure=Error('authored listener failure');let armed=false;
 await fixture(({input,notices})=>{input.begin(sample(1));input.begin(sample(2,70));armed=true;
 assert.throws(()=>input.move(input.contacts[0].session,update()),e=>e.cause===failure);
 assert.equal(input.state,'closed');assert.equal(input.contacts.length,0);assert.equal(notices.filter(n=>n.kind==='cancel').length,2);
 },{onContact:n=>{if(armed&&n.kind==='move')throw failure;}});
});

test('M3 pointer synchronous close in a cancel observer still clears every held contact',async()=>{
 let current; await fixture(({input,notices})=>{current=input;input.begin(sample(1));input.begin(sample(2,70));input.cancelAll('blur');
 assert.equal(input.state,'closed');assert.equal(notices.filter(n=>n.kind==='cancel').length,2);
 },{onContact:n=>{if(n.kind==='cancel')current.dispose();}});
});
test('M3 pointer captured parent exclusion cancels without giving input to a sibling',async()=>fixture(({engine,input,notices})=>{
 input.begin(sample(1));engine.stage.touchChildren=false;input.sync();
 assert.deepEqual(notices.map(n=>n.kind),['begin','cancel']);assert.equal(input.contacts.length,0);
}));

test('M3 pointer cancellation during target begin cannot bubble a begin after terminal',async()=>fixture(({engine,a,input})=>{
 const trace=[];a.on(input.events.begin,e=>{trace.push('target:begin');input.cancel(e.payload.session,'pointercancel');});
 engine.stage.on(input.events.begin,()=>trace.push('stage:begin'));
 engine.stage.on(input.events.cancel,()=>trace.push('stage:cancel'));input.begin(sample(1));
 assert.deepEqual(trace,['target:begin','stage:cancel']);assert.equal(input.contacts.length,0);
}));
test('M3 pointer closure during capture phase suppresses target and bubble begin',async()=>fixture(({engine,a,input})=>{
 const trace=[];engine.stage.on(input.events.begin,()=>{trace.push('capture');input.dispose();},{capture:true});
 a.on(input.events.begin,()=>trace.push('target'));engine.stage.on(input.events.begin,()=>trace.push('bubble'));
 input.begin(sample(1));assert.deepEqual(trace,['capture']);assert.equal(input.state,'closed');
}));
