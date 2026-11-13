// SPDX-License-Identifier: Apache-2.0
// Hover and wheel routing over the display tree of a genuine Engine, driven as a logical stream.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {host,deferred} from './helpers.mjs';
import {createHoverInput} from '@egret/engine/input/hover';

let clock=0;
const at=(x,extra={})=>({pointerId:1,pointerType:'mouse',globalX:x,globalY:10,timestamp:++clock,...extra});
const turn=(x,extra={})=>({globalX:x,globalY:10,deltaX:0,deltaY:120,unit:'pixel',timestamp:++clock,...extra});
const coded=code=>error=>error?.code===code;
// Two regions of 40 by 40 at x 0 and x 60 inside a panel, on a stage of 100 by 100.
async function fixture(run,options={}){
 clock=0;
 const h=host(options.host),engine=await createEngine({host:h.adapter});
 const scope=engine.createScope(),panel=new DisplayObjectContainer(),a=new DisplayObjectContainer(),b=new DisplayObjectContainer();
 scope.use(panel);engine.stage.addChild(panel);
 for(const [node,x] of [[a,0],[b,60]]){scope.use(node);node.x=x;node.hitArea={x:0,y:0,width:40,height:40};node.touchEnabled=true;panel.addChild(node);}
 const notices=[],wheels=[],route=[];
 const input=createHoverInput({engine,scope,width:100,height:100,onHover:n=>{notices.push(n);route.push('observer:'+n.kind);options.onHover?.(n,input);},
  onWheel:n=>{wheels.push(n);return options.onWheel?.(n);},...options.input});
 for(const [name,node] of [['a',a],['b',b],['panel',panel]])for(const kind of ['enter','move','leave'])node.on(input.events[kind],event=>{if(event.eventPhase!=='capturing')route.push(name+':'+kind+(event.target===node?'':'^'));});
 const kinds=()=>notices.map(n=>n.kind+(n.reason?'/'+n.reason:'')+':'+(n.target===a?'a':n.target===b?'b':'?'));
 try{await run({engine,scope,panel,a,b,input,notices,wheels,route,kinds,h});}finally{input.dispose();await engine.dispose();}
}

test('H01 a pointer enters, moves within and leaves targets along the genuine route',async()=>fixture(({a,b,input,notices,route,kinds})=>{
 assert.equal(input.sample(at(10)),a);
 assert.deepEqual(route,['observer:enter','a:enter','panel:enter^']);
 assert.equal(input.sample(at(20)),a);
 assert.equal(input.sample(at(70)),b);
 assert.equal(input.sample(at(50)),undefined);
 assert.equal(input.sample(at(51)),undefined);
 assert.deepEqual(kinds(),['enter:a','move:a','leave/target:a','enter:b','leave/target:b']);
 assert.deepEqual(route.slice(3),['observer:move','a:move','panel:move^','observer:leave','a:leave','panel:leave^','observer:enter','b:enter','panel:enter^','observer:leave','b:leave','panel:leave^']);
 // A leave and the enter that follows it are one observation of the pointer.
 assert.equal(notices[2].point,notices[3].point);
 assert.deepEqual(notices.map(n=>n.point.sequence),[1,2,3,3,4]);
 for(const n of notices){assert.ok(Object.isFrozen(n)&&Object.isFrozen(n.point));assert.equal(n.point.viewportRevision,0);assert.equal(n.point.pointerType,'mouse');}
 assert.equal(input.hovers.length,1);assert.equal(input.hovers[0].target,undefined);assert.equal(input.hovers[0].point.globalX,51);
 assert.ok(Object.isFrozen(input.hovers)&&Object.isFrozen(input.hovers[0])&&Object.isFrozen(input));
}));

test('H02 the payload of each event is the point, with the reason on a leave',async()=>fixture(({a,input})=>{
 const seen=[];
 for(const kind of ['enter','move','leave'])a.on(input.events[kind],event=>seen.push([kind,event.payload,event.type.cancelable,event.type.bubbles]));
 input.sample(at(10));input.sample(at(11));input.leave(1,'outside');
 assert.deepEqual(seen.map(([kind,,cancelable,bubbles])=>[kind,cancelable,bubbles]),[['enter',false,true],['move',false,true],['leave',false,true]]);
 assert.deepEqual(seen[0][1],{pointerId:1,pointerType:'mouse',globalX:10,globalY:10,timestamp:1,sequence:1,viewportRevision:0});
 assert.deepEqual(seen[2][1],{pointerId:1,pointerType:'mouse',globalX:11,globalY:10,timestamp:2,sequence:3,viewportRevision:0,reason:'outside'});
 assert.ok(Object.isFrozen(seen[2][1]));
 assert.deepEqual(input.hovers,[]);
}));

test('H03 leaving by name: one pointer, all of them, and what is refused',async()=>fixture(({a,input,kinds})=>{
 input.sample(at(10));input.sample(at(70,{pointerId:2,pointerType:'pen'}));
 assert.equal(input.leave(1,'contact'),true);assert.equal(input.leave(1,'contact'),false);assert.equal(input.leave(9,'outside'),false);
 assert.throws(()=>input.leave(2,'because'),coded('HOVER_INPUT_REASON'));
 assert.throws(()=>input.leaveAll(undefined),coded('HOVER_INPUT_REASON'));
 assert.equal(input.hovers.length,1);
 input.sample(at(10));input.leaveAll('blur');
 assert.deepEqual(kinds(),['enter:a','enter:b','leave/contact:a','enter:a','leave/blur:b','leave/blur:a']);
 assert.deepEqual(input.hovers,[]);
 // A pointer over nothing leaves without an observation.
 input.sample(at(50));assert.equal(input.leave(1,'outside'),true);assert.equal(kinds().length,6);
}));

test('H04 a target that can no longer be reached is left for the owner reason, and told to the observer alone',async()=>fixture(({engine,panel,a,b,input,route,kinds})=>{
 input.sample(at(10));a.visible=false;route.length=0;input.sync();
 assert.deepEqual(kinds().slice(1),['leave/owner:a']);assert.deepEqual(route,['observer:leave']);
 assert.equal(input.hovers[0].target,undefined);
 a.visible=true;input.sync();assert.equal(input.hovers[0].target,a);
 a.touchEnabled=false;assert.equal(input.sample(at(11)),undefined);assert.equal(kinds().at(-1),'leave/owner:a');
 a.touchEnabled=true;input.sample(at(70));route.length=0;panel.removeChild(b);input.sync();
 assert.deepEqual(route,['observer:leave']);assert.equal(kinds().at(-1),'leave/owner:b');
 panel.addChild(b);panel.touchChildren=false;assert.equal(input.sample(at(71)),undefined);
 panel.touchChildren=true;assert.equal(input.sample(at(72)),b);
 engine.stage.removeChild(panel);route.length=0;input.leave(1,'outside');
 assert.deepEqual(route,['observer:leave']);assert.equal(kinds().at(-1),'leave/outside:b');
}));

test('H05 a scene that moves under a resting pointer is picked again by sync',async()=>fixture(({a,b,input,kinds,notices})=>{
 input.sample(at(10));input.sync();assert.deepEqual(kinds(),['enter:a']);
 a.x=200;b.x=0;input.sync();
 assert.deepEqual(kinds(),['enter:a','leave/target:a','enter:b']);
 assert.equal(notices[1].point.globalX,10);assert.equal(notices[1].point.timestamp,1);assert.equal(notices[1].point.sequence,2);
 b.x=200;input.sync();assert.deepEqual(kinds().slice(3),['leave/target:b']);
 input.sync();assert.equal(kinds().length,4);
}));

test('H06 two pointers hover independently, within the capacity',async()=>fixture(({a,b,input,kinds})=>{
 assert.equal(input.sample(at(10)),a);
 assert.equal(input.sample(at(70,{pointerId:5,pointerType:'pen'})),b);
 assert.equal(input.sample(at(12,{pointerId:5,pointerType:'pen'})),a);
 assert.deepEqual(kinds(),['enter:a','enter:b','leave/target:b','enter:a']);
 assert.deepEqual(input.hovers.map(h=>h.point.pointerId),[1,5]);
 assert.throws(()=>input.sample(at(10,{pointerId:6})),coded('HOVER_INPUT_CAPACITY'));
 // The same host identity does not change its kind while it hovers.
 assert.throws(()=>input.sample(at(10,{pointerId:5})),coded('HOVER_INPUT_SAMPLE'));
 assert.equal(input.hovers.length,2);assert.equal(input.state,'active');
 input.leave(1,'outside');assert.equal(input.sample(at(10,{pointerId:6})),a);
},{input:{capacity:2}}));

test('H07 a malformed sample changes nothing',async()=>fixture(({input,notices})=>{
 input.sample(at(10));
 const bad=[null,7,{},at(Number.NaN),at(10,{globalY:Infinity}),at(10,{pointerId:-1}),at(10,{pointerId:1.5}),at(10,{pointerType:'touch'}),at(10,{timestamp:-1}),at(10,{timestamp:0.5}),at(10,{timestamp:'9'})];
 for(const value of bad)assert.throws(()=>input.sample(value),coded('HOVER_INPUT_SAMPLE'),JSON.stringify(value));
 assert.throws(()=>input.sample(new Proxy({},{get(){throw new Error('trap');}})),coded('HOVER_INPUT_SAMPLE'));
 const wrong=[null,{},turn(Number.NaN),turn(10,{deltaY:Infinity}),turn(10,{deltaX:'1'}),turn(10,{deltaZ:Number.NaN}),turn(10,{unit:'notch'}),turn(10,{zoom:1}),turn(10,{timestamp:0})];
 for(const value of wrong)assert.throws(()=>input.wheel(value),coded('HOVER_INPUT_SAMPLE'),JSON.stringify(value));
 assert.equal(notices.length,1);assert.equal(input.state,'active');assert.equal(input.hovers[0].point.sequence,1);
 // One clock orders hovers and wheels alike: a hover may not be older than the wheel before it.
 const turned=turn(10);input.wheel(turned);
 assert.throws(()=>input.sample(at(10,{timestamp:turned.timestamp-0.5})),coded('HOVER_INPUT_SAMPLE'));
 assert.equal(input.sample(at(10,{timestamp:turned.timestamp})),input.hovers[0].target);
}));

test('H08 a wheel goes to what is under it and reports whether it was consumed',async()=>fixture(({panel,a,b,input,wheels})=>{
 const seen=[];
 a.on(input.events.wheel,event=>{seen.push(['a',event.payload,event.type.cancelable]);});
 panel.on(input.events.wheel,event=>{seen.push(['panel',event.target===a?'a':'b']);});
 b.on(input.events.wheel,event=>event.preventDefault());
 assert.equal(input.wheel(turn(10,{deltaX:3,deltaZ:1,unit:'line',zoom:true})),false);
 assert.deepEqual(seen,[['a',{globalX:10,globalY:10,deltaX:3,deltaY:120,deltaZ:1,unit:'line',timestamp:1,zoom:true,sequence:1,viewportRevision:0},true],['panel','a']]);
 assert.equal(input.wheel(turn(70)),true);
 assert.equal(input.wheel(turn(50)),false);
 assert.deepEqual(wheels.map(n=>[n.target===a?'a':n.target===b?'b':n.target,n.consumed,n.point.sequence]),[['a',false,1],['b',true,2],[undefined,false,3]]);
 assert.ok(Object.isFrozen(wheels[0])&&Object.isFrozen(wheels[0].point));
 assert.equal('deltaZ' in wheels[1].point,false);assert.equal('zoom' in wheels[1].point,false);
 // A wheel is not a hover: nothing is entered by it.
 assert.deepEqual(input.hovers,[]);
}));

test('H09 the wheel observer runs after the target path and may consume what nothing consumed',async()=>{
 const order=[];
 await fixture(({a,input})=>{
  a.on(input.events.wheel,()=>order.push('target'));
  assert.equal(input.wheel(turn(10)),false);
  assert.equal(input.wheel(turn(50)),true);
  assert.deepEqual(order,['target','observer:false','observer:false']);
 },{onWheel:n=>{order.push('observer:'+n.consumed);return n.target===undefined?true:'yes';}});
});

test('H10 a new mapping leaves under the old revision and admits under the new one',async()=>fixture(({a,input,notices,kinds})=>{
 input.sample(at(10));input.setViewportRevision(3);
 assert.deepEqual(kinds(),['enter:a','leave/viewport:a']);assert.equal(notices[1].point.viewportRevision,0);
 assert.equal(input.viewportRevision,3);assert.deepEqual(input.hovers,[]);
 assert.equal(input.sample(at(10)),a);assert.equal(notices.at(-1).point.viewportRevision,3);
 for(const value of [3,2,-1,1.5,Number.NaN,'4'])assert.throws(()=>input.setViewportRevision(value),coded('HOVER_INPUT_VIEWPORT'));
 assert.equal(input.viewportRevision,3);
}));

test('H11 a suspended input leaves everything and admits nothing until it is resumed',async()=>fixture(({a,b,input,kinds,wheels})=>{
 b.on(input.events.wheel,event=>event.preventDefault());
 input.sample(at(10));input.setInteractive(false);
 assert.equal(input.state,'suspended');assert.deepEqual(kinds(),['enter:a','leave/suspended:a']);
 assert.equal(input.sample(at(10)),undefined);assert.equal(input.wheel(turn(70)),false);input.sync();
 assert.equal(kinds().length,2);assert.equal(wheels.length,0);
 // A malformed sample is still refused while suspended.
 assert.throws(()=>input.sample(null),coded('HOVER_INPUT_SAMPLE'));
 assert.throws(()=>input.setInteractive('yes'),coded('HOVER_INPUT_OPTIONS_INVALID'));
 input.setInteractive(true);assert.equal(input.state,'active');assert.equal(kinds().length,2);
 assert.equal(input.sample(at(10)),a);assert.equal(input.wheel(turn(70)),true);
}));

test('H12 a listener may end the hover it is told about; a sample from inside a callback is refused and closes the input',async()=>{
 await fixture(({a,b,input,kinds})=>{
  // The leave of a removes the pointer: b is never entered.
  a.on(input.events.leave,()=>input.leave(1,'outside'));
  input.sample(at(10));assert.equal(input.sample(at(70)),undefined);
  assert.deepEqual(kinds(),['enter:a','leave/target:a']);assert.deepEqual(input.hovers,[]);
  assert.equal(input.sample(at(70)),b);
 });
 await fixture(({a,b,input,kinds})=>{
  input.sample(at(70,{pointerId:2,pointerType:'pen'}));
  a.on(input.events.enter,()=>input.sample(at(20)));
  assert.throws(()=>input.sample(at(10)),error=>error.code==='HOVER_INPUT_CALLBACK_FAILED'&&error.cause.code==='HOVER_INPUT_REENTRANT'&&error.cleanupErrors.length===0);
  assert.equal(input.state,'closed');assert.deepEqual(input.hovers,[]);
  // Everything that was hovered is told once that the input failed.
  assert.deepEqual(kinds(),['enter:b','enter:a','leave/error:b','leave/error:a']);
  assert.equal(input.sample(at(10)),undefined);assert.equal(input.wheel(turn(10)),false);assert.equal(input.leave(1,'outside'),false);
  input.leaveAll('blur');input.sync();input.setInteractive(true);input.setViewportRevision(9);input.dispose();
  assert.equal(input.state,'closed');assert.equal(kinds().length,4);assert.equal(b.isDisposed,false);
 });
});

test('H13 the first failure of a callback is kept apart from the failures of the cleanup',async()=>{
 const first=new Error('first'),second=new Error('second');
 await fixture(({input})=>{
  input.sample(at(70,{pointerId:2,pointerType:'pen'}));
  assert.throws(()=>input.sample(at(10)),error=>error.code==='HOVER_INPUT_CALLBACK_FAILED'&&error.cause===first&&error.cleanupErrors.length===2&&error.cleanupErrors[0]===second);
  assert.equal(input.state,'closed');
 },{onHover:n=>{if(n.kind==='enter'&&n.point.pointerId===1)throw first;if(n.reason==='error')throw second;}});
 await fixture(({b,input})=>{
  b.on(input.events.wheel,()=>{throw first;});
  assert.throws(()=>input.wheel(turn(70)),error=>error.code==='HOVER_INPUT_CALLBACK_FAILED'&&error.cause===first);
  assert.equal(input.state,'closed');
 });
 await fixture(({input})=>{
  assert.throws(()=>input.wheel(turn(50)),error=>error.code==='HOVER_INPUT_CALLBACK_FAILED'&&error.cause===first);
  assert.equal(input.state,'closed');
 },{onWheel:()=>{throw first;}});
});

test('H14 the Scope and the Engine end the input; what was hovered is left first',async()=>{
 await fixture(({scope,a,input,route,kinds})=>{
  input.sample(at(10));route.length=0;scope.dispose();
  assert.equal(input.state,'closed');assert.deepEqual(kinds(),['enter:a','leave/dispose:a']);assert.deepEqual(route,['observer:leave']);
  assert.equal(input.sample(at(10)),undefined);
 });
 await fixture(({input,route,kinds})=>{
  input.sample(at(10));route.length=0;input.dispose();input.dispose();
  assert.deepEqual(kinds(),['enter:a','leave/dispose:a']);assert.deepEqual(route,['observer:leave','a:leave','panel:leave^']);
 });
 const pending=deferred();
 await fixture(async({engine,input,kinds})=>{
  input.sample(at(10));const closing=engine.dispose();
  assert.equal(input.state,'closed');assert.deepEqual(kinds(),['enter:a','leave/dispose:a']);
  pending.resolve();await closing;
 },{host:{close(){return pending.promise;}}});
});

test('H15 only a started Engine, one of its Scopes and sound options are admitted',async()=>{
 const x=await createEngine({host:host().adapter}),y=await createEngine({host:host().adapter});
 try{
  const scope=x.createScope(),good={engine:x,scope,width:100,height:100};
  assert.throws(()=>createHoverInput({...good,scope:y.createScope()}),coded('MOUSE_INPUT_SCOPE_INVALID'));
  assert.throws(()=>createHoverInput({...good,engine:{}}),coded('MOUSE_INPUT_INVALID'));
  for(const value of [null,[],7])assert.throws(()=>createHoverInput(value),coded('HOVER_INPUT_OPTIONS_INVALID'));
  for(const extra of [{width:0},{height:Number.NaN},{maxNodes:0},{maxNodes:1.5},{capacity:0},{capacity:17},{capacity:2.5},{onHover:1},{onWheel:'x'}])
   assert.throws(()=>createHoverInput({...good,...extra}),coded('HOVER_INPUT_OPTIONS_INVALID'),JSON.stringify(extra));
  const input=createHoverInput(good);
  assert.equal(input.width,100);assert.equal(input.height,100);assert.equal(input.state,'active');assert.equal(input.viewportRevision,0);
  assert.deepEqual(Object.keys(input.events),['enter','move','leave','wheel']);
  const closed=x.createScope();closed.dispose();
  assert.throws(()=>createHoverInput({...good,scope:closed}));
  input.dispose();assert.equal(input.state,'closed');
 }finally{await x.dispose();await y.dispose();}
});

test('H16 a close listener runs once, after what was hovered has been left',async()=>{
 await fixture(({input,kinds})=>{
  const order=[];
  const remove=input.onClose(()=>order.push('removed'));
  input.onClose(()=>order.push('closed:'+input.state+':'+kinds().at(-1)));
  remove();remove();
  input.sample(at(10));assert.deepEqual(order,[]);
  input.dispose();input.dispose();
  assert.deepEqual(order,['closed:closed:leave/dispose:a']);
  // A listener that arrives late is run at once.
  input.onClose(()=>order.push('late'));assert.deepEqual(order.at(-1),'late');
  for(const value of [undefined,null,'x'])assert.throws(()=>input.onClose(value),coded('HOVER_INPUT_OPTIONS_INVALID'));
 });
 // A failed callback closes the input as well, and the close listeners still run.
 await fixture(({a,input})=>{
  let closed=0;input.onClose(()=>closed++);
  a.on(input.events.enter,()=>{throw new Error('listener');});
  assert.throws(()=>input.sample(at(10)),coded('HOVER_INPUT_CALLBACK_FAILED'));
  assert.equal(closed,1);
 });
 // The first failing close listener is kept; the others still run.
 await fixture(({input})=>{
  const first=new Error('first');let ran=0;
  input.onClose(()=>{throw first;});input.onClose(()=>{ran++;throw new Error('second');});input.onClose(()=>ran++);
  assert.throws(()=>input.dispose(),error=>error.code==='HOVER_INPUT_CLEANUP_FAILED'&&error.cause===first&&error.cleanupErrors.length===1);
  assert.equal(ran,2);assert.equal(input.state,'closed');
 });
});
