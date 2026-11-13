// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {createUiRoot} from '@egret/engine/ui';
import {createKeyboardInput} from '@egret/engine/input';
import {host,deferred} from './helpers.mjs';
const code=name=>error=>error.code===name;
async function setup(extra={},tabStop) {
 const engine=await createEngine({host:host().adapter}),scope=engine.createScope(),keyboard=createKeyboardInput({engine,scope}),seen=[],contents=new Map();
 const source={revision:0,records:Array.from({length:10},(_,i)=>({key:'k'+i,contentVersion:0,estimatedHeight:20,value:i})),bind(context){
  const content=context.scope.use(new DisplayObjectContainer());contents.set(context.key,content);
  for(const kind of ['keyDown','keyUp','cancel','focusIn','focusOut'])content.on(keyboard.events[kind],event=>seen.push([context.key,context.contentVersion,kind,event.payload.reason,root.snapshot().committedRevision]));
  return {content,measuredHeight:20};
 },unbind(){}};
 const root=createUiRoot({engine,scope,id:'panel',viewport:{width:100,height:60},density:1,tree:{id:'list',kind:'virtualList',source,explicitWidth:100,explicitHeight:60},keyboard:{input:keyboard,idPrefix:'panel',...(tabStop===undefined?{}:{tabStop})},limits:{overscan:1,residentCap:8},...extra});
 const list=root.list('list');
 const publish=async()=>{for(let i=0;i<9;i++){const token=await root.prepare();if(token.status!=='pending')return root.commit(token);}throw Error('Unstable test fixture');};
 return {engine,scope,keyboard,root,list,source,seen,contents,publish};
}
async function owned(run){const f=await setup();try{await run(f);}finally{await f.engine.dispose();}}
const down=input=>input.keyDown({code:'Space',key:' '});
test('managed rows register only committed visible targets and traverse visual order',async()=>owned(async f=>{
 assert.equal(f.keyboard.getSnapshot().targetCount,0);const token=await f.root.prepare();assert.equal(f.keyboard.getSnapshot().targetCount,0);f.root.commit(token);
 assert.equal(f.keyboard.getSnapshot().targetCount,3);assert.equal(f.keyboard.moveFocus('next'),'panel:k0');assert.deepEqual(f.list.getFocus(),{key:'k0',focusVisible:true});
 assert.equal(f.keyboard.moveFocus('next'),'panel:k1');assert.equal(f.keyboard.moveFocus('next'),'panel:k2');assert.equal(f.keyboard.moveFocus('next'),undefined);
 assert.throws(()=>f.list.focus('k3'),code('UI_ROW_NOT_REALIZED'));
}));
test('same-key rebind cancels held keys against attached old revision then restores stable focus',async()=>owned(async f=>{
 await f.publish();f.list.focus('k1',{visible:true});down(f.keyboard);const old=f.root.snapshot().committedRevision;
 f.list.setSource({...f.source,revision:1,records:f.source.records.map(r=>({...r,contentVersion:1}))});assert.equal(f.list.getFocus().key,'k1');
 const result=await f.publish();assert.equal(result.postCommitErrors.length,0);assert.equal(f.keyboard.getSnapshot().focusedId,'panel:k1');assert.equal(f.list.getFocus().focusVisible,true);assert.deepEqual(f.keyboard.getSnapshot().pressedKeys,[]);
 assert.ok(f.seen.some(r=>r[0]==='k1'&&r[1]===0&&r[2]==='cancel'&&r[3]==='rebind'&&r[4]===old));assert.ok(f.seen.some(r=>r[1]===1&&r[2]==='focusIn'&&r[4]===result.revision));
 const count=f.seen.filter(r=>r[2]==='keyUp').length;f.keyboard.keyUp({code:'Space',key:' '});assert.equal(f.seen.filter(r=>r[2]==='keyUp').length,count);
}));
test('scrolling out explicitly clears focus before hiding and uses no implicit retention',async()=>owned(async f=>{
 await f.publish();f.list.focus('k0');down(f.keyboard);const old=f.root.snapshot().committedRevision;f.list.setScrollOffset(80);await f.publish();
 assert.equal(f.list.getFocus().key,undefined);assert.deepEqual(f.keyboard.getSnapshot().pressedKeys,[]);assert.ok(f.seen.some(r=>r[2]==='cancel'&&r[3]==='removed'&&r[4]===old));assert.equal(f.root.snapshot().counters.retainedOnlyRows,0);assert.equal(f.keyboard.moveFocus('next'),'panel:k4');
}));
test('source reorder preserves focus identity and updates traversal order',async()=>owned(async f=>{
 await f.publish();f.list.focus('k1');f.list.setSource({...f.source,revision:1,records:[f.source.records[0],f.source.records[2],f.source.records[1],...f.source.records.slice(3)]});f.list.setScrollOffset(0);const published=await f.publish();assert.deepEqual(published.postCommitErrors,[]);assert.equal(f.list.getFocus().key,'k1',JSON.stringify({seen:f.seen,rows:f.root.snapshot().rows,input:f.keyboard.getSnapshot()}));assert.equal(f.keyboard.moveFocus('previous'),'panel:k2');
}));
test('failed asynchronous replacement retains committed registrations and key state',async()=>owned(async f=>{
 await f.publish();f.list.focus('k0');down(f.keyboard);f.list.setSource({...f.source,revision:1,records:f.source.records.map(r=>({...r,contentVersion:1})),bind(){throw Error('font failure');}});await assert.rejects(f.root.prepare());
 assert.equal(f.list.getFocus().key,'k0');assert.deepEqual(f.keyboard.getSnapshot().pressedKeys,['Space']);assert.equal(f.keyboard.getSnapshot().targetCount,3);
}));
test('pending and superseded preparation cannot publish targets',async()=>owned(async f=>{
 await f.publish();f.list.focus('k0');const wait=deferred();f.list.setSource({...f.source,revision:1,records:f.source.records.map(r=>({...r,contentVersion:1})),async bind(c){await wait.promise;return f.source.bind(c);}});const preparing=f.root.prepare();await Promise.resolve();assert.equal(f.list.getFocus().key,'k0');
 f.list.setSource({...f.source,revision:2});wait.resolve();await assert.rejects(preparing);await f.publish();assert.equal(f.keyboard.getSnapshot().targetCount,3);
}));
test('removal and disposal cancel before detach and leave unrelated targets/channel alive',async()=>owned(async f=>{
 const external=f.scope.use(new DisplayObjectContainer());f.engine.stage.addChild(external);f.keyboard.registerTarget({id:'external',target:external});await f.publish();f.list.focus('k1');down(f.keyboard);
 f.list.setSource({...f.source,revision:1,records:f.source.records.filter(r=>r.key!=='k1')});await f.publish();assert.equal(f.list.getFocus().key,undefined);f.list.focus('k0');down(f.keyboard);f.root.dispose();assert.ok(f.seen.some(r=>r[0]==='k0'&&r[2]==='cancel'));assert.equal(f.keyboard.getSnapshot().targetCount,1);f.keyboard.focus('external');assert.equal(f.keyboard.getSnapshot().state,'active');
}));
test('cancellation callback mutating layout invalidates the proposal before publication',async()=>owned(async f=>{
 await f.publish();f.list.focus('k0');down(f.keyboard);const old=f.root.snapshot().committedRevision;f.contents.get('k0').on(f.keyboard.events.cancel,()=>f.list.setScrollOffset(0));f.list.setScrollOffset(80);const result=await f.publish();assert.equal(result.kind,'stale');assert.equal(f.root.snapshot().committedRevision,old);assert.deepEqual(f.root.snapshot().rows.filter(r=>r.visible).map(r=>r.key),['k0','k1','k2']);
}));
test('cancellation callback may dispose the root without publishing or leaking registrations',async()=>owned(async f=>{
 await f.publish();f.list.focus('k0');down(f.keyboard);f.contents.get('k0').on(f.keyboard.events.cancel,()=>f.root.dispose());f.list.setScrollOffset(80);const result=await f.publish();assert.equal(result.kind,'closed');assert.equal(f.keyboard.getSnapshot().targetCount,0);
}));
test('invalid namespaces and keys are refused without replacing current source',async()=>owned(async f=>{
 await f.publish();const bad={...f.source,revision:1,records:[{...f.source.records[0],key:'x'.repeat(128)}]};assert.throws(()=>f.list.setSource(bad),code('UI_KEYBOARD_ID_INVALID'));assert.equal(f.root.snapshot().desiredRevision,f.root.snapshot().committedRevision);
}));
test('closed borrowed keyboard does not break later UI publication',async()=>owned(async f=>{
 await f.publish();f.keyboard.dispose();f.list.setScrollOffset(40);const result=await f.publish();assert.equal(result.kind,'committed');assert.equal(result.postCommitErrors.length,0);
}));
test('registration conflict fails closed only for the affected panel',async()=>owned(async f=>{
 const external=f.scope.use(new DisplayObjectContainer());f.engine.stage.addChild(external);f.keyboard.registerTarget({id:'panel:k1',target:external});const result=await f.publish();assert.equal(result.postCommitErrors[0].code,'UI_KEYBOARD_SYNC_FAILED');assert.equal(f.keyboard.getSnapshot().targetCount,1);f.keyboard.focus('panel:k1');assert.equal(f.keyboard.getSnapshot().focusedId,'panel:k1');
}));
test('foreign and lookalike keyboard associations are refused',async()=>{
 const f=await setup(),other=await setup();try{for(const input of [other.keyboard,{...f.keyboard}])assert.throws(()=>createUiRoot({engine:f.engine,scope:f.scope,id:'x',viewport:{width:20,height:20},density:1,tree:{id:'x',kind:'leaf'},keyboard:{input,idPrefix:'x'}}),code('UI_KEYBOARD_INVALID'));}finally{await f.engine.dispose();await other.engine.dispose();}
});

test('hidden same-key replacement clears focus without disabling other visible rows',async()=>owned(async f=>{
 await f.publish();f.list.focus('k0');down(f.keyboard);
 f.list.setSource({...f.source,revision:1,records:f.source.records.map(r=>({...r,contentVersion:1})),bind(c){const value=f.source.bind(c);if(c.key==='k0')value.content.visible=false;return value;}});
 const result=await f.publish();assert.deepEqual(result.postCommitErrors,[]);assert.equal(f.list.getFocus().key,undefined);assert.deepEqual(f.keyboard.getSnapshot().pressedKeys,[]);
 f.list.focus('k1');assert.equal(f.list.getFocus().key,'k1');
}));
test('restored focus callback may dispose the root without leaking targets',async()=>owned(async f=>{
 await f.publish();f.list.focus('k0');f.list.setSource({...f.source,revision:1,records:f.source.records.map(r=>({...r,contentVersion:1})),bind(c){const value=f.source.bind(c);if(c.key==='k0')value.content.on(f.keyboard.events.focusIn,()=>f.root.dispose());return value;}});
 const result=await f.publish();assert.equal(f.root.state,'closed');assert.equal(f.keyboard.getSnapshot().targetCount,0);assert.equal(f.keyboard.getSnapshot().focusedId,undefined);assert.deepEqual(result.postCommitErrors,[]);
}));
// One stop for the whole list.
async function single(run,tabStop=5){const f=await setup({},tabStop);try{
 // Two stops of the application's own, before and after the list in the order of the keyboard.
 f.before=f.scope.use(new DisplayObjectContainer());f.after=f.scope.use(new DisplayObjectContainer());f.engine.stage.addChild(f.before);f.engine.stage.addChild(f.after);
 f.keyboard.registerTarget({id:'before',target:f.before,tabIndex:4});f.keyboard.registerTarget({id:'after',target:f.after,tabIndex:6});
 await f.publish();await run(f);}finally{await f.engine.dispose();}}
const walk=(keyboard,direction,steps)=>Array.from({length:steps},()=>keyboard.moveFocus(direction));
test('a list that is one stop is entered at its first row and left from it, in the place its index gives it',async()=>single(async f=>{
 assert.deepEqual(walk(f.keyboard,'next',4),['before','panel:k0','after',undefined]);
 assert.deepEqual(walk(f.keyboard,'previous',4),['after','panel:k0','before',undefined]);
 assert.equal(f.keyboard.getSnapshot().targetCount,5,'the three rows that show are registered, and one of them is the stop');
}));
test('the stop is the row that last held the focus, which the application moves',async()=>single(async f=>{
 f.list.focus('k2',{visible:true});assert.equal(f.list.getFocus().key,'k2');
 assert.deepEqual(walk(f.keyboard,'next',1),['after']);
 assert.deepEqual(walk(f.keyboard,'previous',2),['panel:k2','before'],'Tab comes back to the row it left');
 f.list.focus('k1');f.list.focus('k1');assert.deepEqual(walk(f.keyboard,'previous',1),['before']);assert.deepEqual(walk(f.keyboard,'next',2),['panel:k1','after']);
 // The focus is elsewhere when the list commits: the row that held it is still the stop.
 f.root.invalidate('list','paint');await f.publish();f.list.setScrollOffset(10);await f.publish();
 assert.equal(f.keyboard.getSnapshot().focusedId,'after');assert.deepEqual(walk(f.keyboard,'previous',2),['panel:k1','before']);
 f.list.setScrollOffset(0);await f.publish();
 // A listener of the focus that closes the root leaves nothing to move the stop to.
 const other=await setup({},7);try{await other.publish();other.contents.get('k1').on(other.keyboard.events.focusIn,()=>other.root.dispose());
  other.list.focus('k1');assert.equal(other.root.state,'closed');assert.equal(other.keyboard.getSnapshot().targetCount,0);}finally{await other.engine.dispose();}
 // A row that is not the stop is still reached by the application.
 f.keyboard.focus('panel:k0');assert.equal(f.list.getFocus().key,'k0');
 // A commit finds the focus on another row than the stop, and the stop follows it.
 f.root.invalidate('list','paint');await f.publish();
 assert.deepEqual(walk(f.keyboard,'next',1),['after']);assert.deepEqual(walk(f.keyboard,'previous',1),['panel:k0']);
}));
test('a stop that scrolls away goes to the first row that shows, and a row that keeps the focus keeps the stop',async()=>single(async f=>{
 f.list.focus('k1');f.keyboard.focus('after');
 f.list.setScrollOffset(100);await f.publish();
 assert.equal(f.root.snapshot().rows.some(row=>row.key==='k1'&&row.visible),false);
 assert.deepEqual(walk(f.keyboard,'previous',2),['panel:k5','before'],'the first row that shows is the stop now');
 // The focused row stays the stop through a scroll that keeps it in view.
 f.list.focus('k6',{visible:true});f.list.setScrollOffset(120);await f.publish();
 assert.equal(f.list.getFocus().key,'k6');assert.deepEqual(walk(f.keyboard,'next',1),['after']);assert.deepEqual(walk(f.keyboard,'previous',1),['panel:k6']);
 // The focused row scrolls away: the focus is cancelled as ever, and the list is still one stop.
 f.list.setScrollOffset(0);await f.publish();
 assert.equal(f.list.getFocus().key,undefined);
 assert.deepEqual(walk(f.keyboard,'next',4),['before','panel:k0','after',undefined]);
}));
test('a row replaced under the focus keeps the focus and the stop',async()=>single(async f=>{
 f.list.focus('k1',{visible:true});
 f.list.setSource({...f.source,revision:1,records:f.source.records.map(record=>({...record,contentVersion:1}))});await f.publish();
 assert.deepEqual(f.list.getFocus(),{key:'k1',focusVisible:true});
 assert.deepEqual(walk(f.keyboard,'next',1),['after']);assert.deepEqual(walk(f.keyboard,'previous',2),['panel:k1','before']);
}));
test('a list with no row that shows is no stop, and an index that is not one is refused',async()=>{
 await single(async f=>{
  f.list.setSource({...f.source,revision:1,records:[]});await f.publish();
  assert.deepEqual(walk(f.keyboard,'next',3),['before','after',undefined]);
  f.list.setSource({...f.source,revision:2});await f.publish();
  assert.deepEqual(walk(f.keyboard,'previous',3),['after','panel:k0','before']);
 });
 // The ends of the range are indexes like any other.
 await single(async f=>{assert.deepEqual(walk(f.keyboard,'next',3),['before','after','panel:k0'],'index 0 comes after every positive index');},0);
 await single(async f=>{assert.deepEqual(walk(f.keyboard,'next',3),['before','after','panel:k0']);},32767);
 for(const bad of [-1,1.5,32768,'5',null,NaN,Infinity])await assert.rejects(setup({},bad),code('UI_KEYBOARD_STOP_INVALID'),String(bad));
});
test('without a stop every row that shows is a stop of its own, as before',async()=>owned(async f=>{
 await f.publish();assert.deepEqual(walk(f.keyboard,'next',4),['panel:k0','panel:k1','panel:k2',undefined]);
}));
