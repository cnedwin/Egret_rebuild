// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {host} from './helpers.mjs';
const api=await import('@egret/engine/input');
const key=(code='Space',extra={})=>({code,key:code,...extra});
async function fixture(run,options={}){
 const engine=await createEngine({host:host().adapter}),scope=engine.createScope();
 const a=new DisplayObjectContainer(),b=new DisplayObjectContainer(),c=new DisplayObjectContainer();
 for(const node of [a,b,c]){scope.use(node);engine.stage.addChild(node);}
 assert.equal(typeof api.createKeyboardInput,'function','M3.3 keyboard factory missing');
 const changes=[];const input=api.createKeyboardInput({engine,scope,...options,onFocusChange:n=>{changes.push(n);options.onFocusChange?.(n);}});
 try{await run({engine,scope,a,b,c,input,changes});}finally{input.dispose();await engine.dispose();}
}
test('keyboard genuine factory and foreign Scope refusal',async()=>{
 const engine=await createEngine({host:host().adapter}),other=await createEngine({host:host().adapter});
 try{assert.throws(()=>api.createKeyboardInput({engine:{},scope:engine.createScope()}));assert.throws(()=>api.createKeyboardInput({engine,scope:other.createScope()}));}finally{await engine.dispose();await other.dispose();}
});
test('keyboard traversal uses positive index then zero insertion, boundaries and explicit wrap',async()=>fixture(({input,a,b,c})=>{
 input.registerTarget({id:'a',target:a});input.registerTarget({id:'b',target:b,tabIndex:2});input.registerTarget({id:'c',target:c,tabIndex:1});
 assert.equal(input.moveFocus('next'),'c');assert.equal(input.moveFocus('next'),'b');assert.equal(input.moveFocus('next'),'a');assert.equal(input.moveFocus('next'),undefined);
 assert.equal(input.moveFocus('previous'),'a');assert.equal(input.moveFocus('next',true),'c');assert.equal(input.getSnapshot().focusVisible,true);
}));
test('keyboard negative index is programmatic only; disabled hidden and detached are skipped',async()=>fixture(({input,engine,a,b,c})=>{
 input.registerTarget({id:'a',target:a,tabIndex:-1});input.registerTarget({id:'b',target:b,disabled:true});input.registerTarget({id:'c',target:c});
 input.focus('a');assert.equal(input.getSnapshot().focusVisible,false);assert.equal(input.moveFocus('next'),'c');
 assert.throws(()=>input.focus('b'));c.visible=false;input.sync();assert.equal(input.getSnapshot().focusedId,undefined);
 c.visible=true;engine.stage.removeChild(c);assert.equal(input.moveFocus('next'),undefined);
}));
test('keyboard held repeat up prevention and immutable copied payloads',async()=>fixture(({input,a})=>{
 input.registerTarget({id:'a',target:a});input.focus('a');const seen=[];a.on(input.events.keyDown,e=>{seen.push(e.payload);e.preventDefault();});
 const sample=key();assert.equal(input.keyDown(sample),true);sample.key='mutated';input.keyDown(key('Space',{repeat:true}));
 assert.deepEqual(input.getSnapshot().pressedKeys,['Space']);assert.equal(seen[0].key,'Space');assert.equal(Object.isFrozen(seen[0]),true);
 let ups=0;a.on(input.events.keyUp,()=>ups++);input.keyUp(key());input.keyUp(key());assert.equal(ups,1);assert.deepEqual(input.getSnapshot().pressedKeys,[]);
}));
test('keyboard focus transfer during a key handler cancels once and stops stale bubbling',async()=>fixture(({engine,input,a,b})=>{
 input.registerTarget({id:'a',target:a});input.registerTarget({id:'b',target:b});input.focus('a');const trace=[];
 a.on(input.events.keyDown,()=>{trace.push('down');input.focus('b');});a.on(input.events.cancel,e=>trace.push(e.payload.reason));engine.stage.on(input.events.keyDown,()=>trace.push('stale'));
 input.keyDown(key());assert.deepEqual(trace,['down','focus']);assert.equal(input.getSnapshot().focusedId,'b');let ups=0;b.on(input.events.keyUp,()=>ups++);input.keyUp(key());assert.equal(ups,0);
}));
test('keyboard focused rebind preserves ID with source out and replacement in',async()=>fixture(({input,a,b,changes})=>{
 const reg=input.registerTarget({id:'a',target:a});input.focus('a');const trace=[];
 a.on(input.events.cancel,e=>trace.push(e.payload.reason));a.on(input.events.focusOut,()=>trace.push('out'));b.on(input.events.focusIn,()=>trace.push('in'));
 input.keyDown(key());reg.update({target:b});assert.deepEqual(trace,['rebind','out','in']);assert.equal(input.getSnapshot().focusedId,'a');assert.equal(changes.at(-1).focusedId,'a');
 assert.throws(()=>reg.update({target:a,tabIndex:1.5}));input.keyDown(key());assert.deepEqual(input.getSnapshot().pressedKeys,['Space']);
}));
test('keyboard stale registration handles cannot mutate a reused logical ID',async()=>fixture(({input,a,b})=>{
 const first=input.registerTarget({id:'a',target:a});first.dispose();input.registerTarget({id:'a',target:b});first.dispose();assert.throws(()=>first.update({disabled:true}));input.focus('a');assert.equal(input.getSnapshot().targetCount,1);
}));
test('keyboard disposed targets allow explicit rebind while sync clears focus',async()=>fixture(({input,a,b})=>{
 const reg=input.registerTarget({id:'a',target:a});input.focus('a');input.keyDown(key());a.dispose();input.sync();assert.equal(input.getSnapshot().focusedId,undefined);assert.deepEqual(input.getSnapshot().pressedKeys,[]);reg.update({target:b});input.focus('a');
}));
test('keyboard suspend and Scope close commit terminal snapshots and cancel all keys',async()=>fixture(({input,scope,a})=>{
 input.registerTarget({id:'a',target:a});input.focus('a');input.keyDown(key());input.keyDown(key('ArrowLeft'));let count=0;a.on(input.events.cancel,()=>count++);
 input.setInteractive(false);assert.equal(count,2);assert.deepEqual(input.getSnapshot(),{state:'suspended',focusedId:undefined,focusVisible:false,pressedKeys:[],targetCount:1});input.setInteractive(true);input.focus('a');scope.dispose();assert.equal(input.getSnapshot().state,'closed');assert.equal(input.getSnapshot().targetCount,0);
}));
test('keyboard callback failure closes safely and propagates its original cause',async()=>fixture(({input,a})=>{
 input.registerTarget({id:'a',target:a});input.focus('a');a.on(input.events.keyDown,()=>{throw Error('key failed');});assert.throws(()=>input.keyDown(key()),/key failed/);assert.equal(input.getSnapshot().state,'closed');assert.deepEqual(input.getSnapshot().pressedKeys,[]);
}));
test('keyboard recursive focus notifications reject before mutation and safely clean up',async()=>{
 let current;await fixture(({input,a,b})=>{current=input;input.registerTarget({id:'a',target:a});input.registerTarget({id:'b',target:b});assert.throws(()=>input.focus('a'));assert.equal(input.getSnapshot().state,'closed');},{onFocusChange:()=>current.focus('b')});
});
test('keyboard dispose during key capture prevents stale target delivery',async()=>fixture(({engine,input,a})=>{
 input.registerTarget({id:'a',target:a});input.focus('a');let hits=0;engine.stage.on(input.events.keyDown,()=>input.dispose(),{capture:true});a.on(input.events.keyDown,()=>hits++);input.keyDown(key());assert.equal(hits,0);assert.equal(input.getSnapshot().state,'closed');
}));

test('keyboard repeat after focus cancellation cannot create a key on the new owner',async()=>fixture(({input,a,b})=>{
 input.registerTarget({id:'a',target:a});input.registerTarget({id:'b',target:b});input.focus('a');input.keyDown(key());input.focus('b');let hits=0;b.on(input.events.keyDown,()=>hits++);b.on(input.events.keyUp,()=>hits++);
 input.keyDown(key('Space',{repeat:true}));input.keyUp(key());assert.equal(hits,0);assert.deepEqual(input.getSnapshot().pressedKeys,[]);
}));
test('keyboard bounded capacities and invalid sample/update failures preserve accepted state',async()=>fixture(({input,a,b})=>{
 const registration=input.registerTarget({id:'a',target:a});assert.throws(()=>input.registerTarget({id:'b',target:b}));input.focus('a');input.keyDown(key());assert.throws(()=>input.keyDown(key('ArrowLeft')));assert.throws(()=>input.keyDown({code:'',key:'x'}));assert.throws(()=>registration.update({tabIndex:32768}));
 assert.deepEqual(input.getSnapshot().pressedKeys,['Space']);assert.equal(input.getSnapshot().focusedId,'a');assert.equal(input.getSnapshot().targetCount,1);
},{maxTargets:1,maxKeys:1}));
test('keyboard Engine disposal closes before pending Host cleanup',async()=>fixture(async({input,engine,a})=>{
 input.registerTarget({id:'a',target:a});input.focus('a');input.keyDown(key());const closing=engine.dispose();assert.equal(input.getSnapshot().state,'closed');assert.deepEqual(input.getSnapshot().pressedKeys,[]);await closing;
}));
test('keyboard cancellation listener disposal still drains each held code exactly once',async()=>fixture(({input,a})=>{
 input.registerTarget({id:'a',target:a});input.focus('a');input.keyDown(key());input.keyDown(key('ArrowLeft'));const codes=[];a.on(input.events.cancel,e=>{codes.push(e.payload.code);input.dispose();});input.cancel('blur');assert.deepEqual(codes,['Space','ArrowLeft']);assert.equal(input.getSnapshot().state,'closed');
}));
test('keyboard observer failure after detached focus still receives terminal bookkeeping',async()=>{
 let armed=false;const observed=[];await fixture(({input,engine,a})=>{input.registerTarget({id:'a',target:a});input.focus('a');input.keyDown(key());engine.stage.removeChild(a);armed=true;assert.throws(()=>input.sync(),/terminal observer/);assert.equal(input.getSnapshot().state,'closed');assert.deepEqual(input.getSnapshot().pressedKeys,[]);assert.equal(observed.at(-1).focusedId,undefined);},{onFocusChange:n=>{observed.push(n);if(armed)throw Error('terminal observer');}});
});
test('keyboard focus observer sees the committed empty key snapshot before notifications',async()=>{
 let current;await fixture(({input,a,b})=>{current=input;input.registerTarget({id:'a',target:a});input.registerTarget({id:'b',target:b});input.focus('a');input.keyDown(key());input.focus('b');},{onFocusChange:n=>{assert.equal(current.getSnapshot().focusedId,n.focusedId);assert.deepEqual(current.getSnapshot().pressedKeys,[]);}});
});
test('keyboard recursive logical key delivery is rejected safely without a stuck key',async()=>fixture(({input,a})=>{
 input.registerTarget({id:'a',target:a});input.focus('a');a.on(input.events.keyDown,()=>input.keyDown(key()));assert.throws(()=>input.keyDown(key()),e=>e.code==='KEYBOARD_INPUT_REENTRANT');assert.equal(input.getSnapshot().state,'closed');assert.deepEqual(input.getSnapshot().pressedKeys,[]);
}));
test('keyboard sample getter disposal cannot resurrect closed records or held keys',async()=>fixture(({input,a})=>{
 input.registerTarget({id:'a',target:a});input.focus('a');assert.throws(()=>input.keyDown({get code(){input.dispose();return 'Space';},key:' '}));assert.equal(input.getSnapshot().state,'closed');assert.deepEqual(input.getSnapshot().pressedKeys,[]);
}));
test('keyboard registration getter closure cannot publish a new record after disposal',async()=>fixture(({input,a})=>{
 assert.throws(()=>input.registerTarget({id:'a',get target(){input.dispose();return a;}}));assert.equal(input.getSnapshot().state,'closed');assert.equal(input.getSnapshot().targetCount,0);
}));

test('keyboard focusOut listener disposing the proposed replacement cannot publish stale focus',async()=>fixture(({input,a,b,changes})=>{
 input.registerTarget({id:'a',target:a});input.registerTarget({id:'b',target:b});input.focus('a');a.on(input.events.focusOut,()=>b.dispose());input.focus('b');assert.equal(input.getSnapshot().focusedId,undefined);assert.equal(changes.at(-1).focusedId,undefined);
}));
test('keyboard focusIn listener hiding its target clears before publishing observer state',async()=>fixture(({input,a,changes})=>{
 input.registerTarget({id:'a',target:a});a.on(input.events.focusIn,()=>{a.visible=false;});input.focus('a');assert.equal(input.getSnapshot().focusedId,undefined);assert.equal(changes.at(-1).focusedId,undefined);
}));
