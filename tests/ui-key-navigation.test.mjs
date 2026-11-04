// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {createUiRoot} from '@egret/engine/ui';
import {createKeyboardInput} from '@egret/engine/input';
import {host,deferred} from './helpers.mjs';
const code=name=>error=>error.code===name;
async function setup({count=20,height=60,measure=()=>20,estimate=20,keyboard=true}={}) {
 const engine=await createEngine({host:host().adapter}),scope=engine.createScope(),input=keyboard?createKeyboardInput({engine,scope}):undefined,contents=new Map();
 const source={revision:0,records:Array.from({length:count},(_,i)=>({key:'k'+i,contentVersion:0,estimatedHeight:estimate,value:i})),bind(c){const content=c.scope.use(new DisplayObjectContainer());contents.set(c.key,content);return {content,measuredHeight:measure(c.index)};},unbind(){}};
 const root=createUiRoot({engine,scope,id:'panel',viewport:{width:100,height},density:1,tree:{id:'list',kind:'virtualList',source,explicitWidth:100,explicitHeight:height},...(input?{keyboard:{input,idPrefix:'panel'}}:{}),limits:{overscan:0,residentCap:20}}),list=root.list('list');
 const ready=async()=>{for(let i=0;i<8;i++){const token=await root.prepare();if(token.status!=='pending')return token;}throw Error('Unstable fixture');};
 const publish=async()=>root.commit(await ready());
 return {engine,scope,input,source,root,list,contents,ready,publish};
}
async function owned(options,run){const f=await setup(options);try{await run(f);}finally{await f.engine.dispose();}}
test('key reveal is staged, measures the target, then permits explicit visible-only focus',async()=>owned({count:50000,measure:i=>i===40000?45:20},async f=>{
 await f.publish();f.list.focus('k0',{visible:false});const previous=f.root.snapshot();
 assert.throws(()=>f.list.focus('k40000'),code('UI_ROW_NOT_REALIZED'));f.list.reveal('k40000',{align:'center'});
 const token=await f.ready();assert.equal(f.root.snapshot().committedRevision,previous.committedRevision);assert.equal(f.list.getFocus().key,'k0');
 assert.equal(f.root.commit(token).kind,'committed');const row=f.list.snapshot().rows.find(r=>r.key==='k40000');assert.equal(row.box.height,45);assert.equal(row.box.y,7.5);assert.equal(row.visible,true);
 f.list.focus('k40000',{visible:true});assert.deepEqual(f.list.getFocus(),{key:'k40000',focusVisible:true});assert.ok(f.list.snapshot().counters.activeBindings<=20);assert.equal(f.list.snapshot().counters.retainedOnlyRows,0);
}));
test('alignment positions include short viewports, tall rows and end clamping',async()=>owned({height:10,measure:()=>40,estimate:40},async f=>{
 await f.publish();for(const [align,y] of [['start',0],['center',-15],['end',-30]]){f.list.reveal('k10',{align});await f.publish();assert.equal(f.list.snapshot().rows.find(r=>r.key==='k10').box.y,y);}
 f.list.reveal('k10');await f.publish();assert.equal(f.list.snapshot().rows.find(r=>r.key==='k10').box.y,-30);
 f.list.reveal('k19',{align:'start'});await f.publish();assert.equal(f.list.snapshot().scrollOffset,760);
}));
test('nearest preserves an already visible target and chooses the closer required edge',async()=>owned({},async f=>{
 await f.publish();f.list.reveal('k1');await f.publish();assert.equal(f.list.snapshot().scrollOffset,0);
 f.list.reveal('k10');await f.publish();assert.equal(f.list.snapshot().scrollOffset,160);
 f.list.reveal('k3');await f.publish();assert.equal(f.list.snapshot().scrollOffset,60);
 f.list.reveal('k19',{align:'start'});await f.publish();assert.equal(f.list.snapshot().scrollOffset,340);
}));
test('unknown keys and malformed options cannot replace a pending intent',async()=>owned({},async f=>{
 await f.publish();f.list.reveal('k10');const revision=f.root.snapshot().desiredRevision;
 for(const [key,options] of [['missing',undefined],['k1',null],['k1',{align:'smooth'}],['k1',{extra:true}],[undefined,{align:'start'}],['k1',[]]])assert.throws(()=>f.list.reveal(key,options));
 assert.equal(f.root.snapshot().desiredRevision,revision);await f.publish();assert.ok(f.list.snapshot().rows.some(r=>r.key==='k10'&&r.visible));
}));
test('new navigation, explicit cancellation and equal-offset scrolling retire stale tokens',async()=>owned({},async f=>{
 await f.publish();f.list.reveal('k10');const a=await f.ready();f.list.reveal('k15');assert.equal(f.root.commit(a).kind,'stale');await f.publish();assert.ok(f.list.snapshot().rows.some(r=>r.key==='k15'&&r.visible));
 const offset=f.list.snapshot().scrollOffset;f.list.reveal('k2');const b=await f.ready();f.list.setScrollOffset(offset);assert.equal(f.root.commit(b).kind,'stale');await f.publish();assert.equal(f.list.snapshot().scrollOffset,offset);
 f.list.reveal('k0');const c=await f.ready();f.list.reveal(undefined);assert.equal(f.root.commit(c).kind,'stale');await f.publish();assert.equal(f.list.snapshot().scrollOffset,offset);
}));
test('viewport and height changes recompute current key intent and invalidate prepared geometry',async()=>owned({measure:i=>i===10?25:20},async f=>{
 await f.publish();f.list.reveal('k10',{align:'end'});const old=await f.ready();f.root.setViewport({width:100,height:30},1);f.root.setTree({id:'list',kind:'virtualList',source:f.source,explicitWidth:100,explicitHeight:30});f.list.updateHeights([{key:'k10',height:25,contentVersion:0}]);assert.equal(f.root.commit(old).kind,'stale');await f.publish();assert.equal(f.list.snapshot().rows.find(r=>r.key==='k10').box.y,5);
}));
test('source replacement cancels key intent including changed, removed and reordered records',async()=>owned({},async f=>{
 await f.publish();for(const records of [f.source.records.map(r=>({...r,contentVersion:1})),f.source.records.filter(r=>r.key!=='k10'),[...f.source.records].reverse()]){f.list.reveal('k1');const token=await f.ready();f.list.setSource({...f.source,revision:f.root.snapshot().desiredRevision,records});assert.equal(f.root.commit(token).kind,'stale');await f.publish();assert.equal(f.list.getFocus().key,undefined);}
}));
test('failed and cancelled binding leaves committed focus and held keys untouched',async()=>owned({},async f=>{
 await f.publish();f.list.focus('k0');f.input.keyDown({code:'Space',key:' '});const old=f.root.snapshot().committedRevision;
 f.list.setSource({...f.source,revision:1,bind(c){if(c.key==='k10')throw Error('binding unavailable');return f.source.bind(c);}});f.list.reveal('k10',{align:'start'});await assert.rejects(f.root.prepare());assert.equal(f.root.snapshot().committedRevision,old);assert.equal(f.list.getFocus().key,'k0');assert.deepEqual(f.input.getSnapshot().pressedKeys,['Space']);
 const wait=deferred();f.list.setSource({...f.source,revision:2,async bind(c){await wait.promise;return f.source.bind(c);}});f.list.reveal('k15');const pending=f.root.prepare();await Promise.resolve();f.list.reveal(undefined);await assert.rejects(pending,code('UI_STALE'));wait.resolve();
}));
test('reveal needs no keyboard association and does not grant target eligibility',async()=>{
 await owned({keyboard:false},async f=>{f.list.reveal('k10');await f.publish();assert.throws(()=>f.list.focus('k10'),code('UI_KEYBOARD_UNAVAILABLE'));});
 await owned({},async f=>{f.list.reveal('k10');await f.publish();f.contents.get('k10').visible=false;assert.throws(()=>f.list.focus('k10'),code('KEYBOARD_TARGET_INELIGIBLE'));f.input.dispose();f.list.reveal('k15');assert.equal((await f.publish()).kind,'committed');});
});
test('closing cancels preparation and saved handles reject later reveal before reading options',async()=>owned({},async f=>{
 await f.publish();f.list.reveal('k10');const token=await f.ready();f.root.dispose();assert.equal(f.root.commit(token).kind,'closed');assert.throws(()=>f.list.reveal('k0',{get align(){throw Error('must not read');}}),code('UI_CLOSED'));
}));

test('option getter reentry cannot overwrite newer navigation or read a closed owner',async()=>owned({},async f=>{
 await f.publish();assert.throws(()=>f.list.reveal('k10',{get align(){f.list.setScrollOffset(120);return 'start';}}),code('UI_STALE'));await f.publish();assert.equal(f.list.snapshot().scrollOffset,120);
 assert.throws(()=>f.list.reveal('k10',{get align(){f.root.dispose();return 'start';}}),code('UI_CLOSED'));
}));
test('held-key cancellation callback can supersede, cancel or replace a key reveal before publication',async()=>{
 for(const operation of ['reveal','cancel','source'])await owned({},async f=>{
  await f.publish();f.list.focus('k0');f.input.keyDown({code:'Space',key:' '});const old=f.root.snapshot().committedRevision;
  f.contents.get('k0').on(f.input.events.cancel,()=>{
   assert.equal(f.root.snapshot().committedRevision,old);assert.equal(f.contents.get('k0').parent!==null,true);
   if(operation==='reveal')f.list.reveal('k15');else if(operation==='cancel')f.list.reveal(undefined);else f.list.setSource({...f.source,revision:1,records:f.source.records.filter(r=>r.key!=='k10')});
  });
  f.list.reveal('k10');assert.equal((await f.publish()).kind,'stale');assert.equal(f.root.snapshot().committedRevision,old);assert.deepEqual(f.input.getSnapshot().pressedKeys,[]);
  await f.publish();assert.equal(f.list.getFocus().key,undefined);if(operation==='reveal')assert.ok(f.list.snapshot().rows.some(r=>r.key==='k15'&&r.visible));else assert.equal(f.list.snapshot().scrollOffset,0);
 });
});
test('fractional small viewport and tall nearest row use intersecting committed geometry',async()=>owned({height:0.25},async f=>{
 f.list.reveal('k10');await f.publish();let row=f.list.snapshot().rows.find(r=>r.key==='k10');assert.equal(row.box.y,0);assert.equal(row.visible,true);
 f.list.setScrollOffset(205);await f.publish();f.list.reveal('k10');await f.publish();row=f.list.snapshot().rows.find(r=>r.key==='k10');assert.equal(row.box.y,-5);
}));
test('async old target settlement cannot publish after a newer reveal',async()=>owned({},async f=>{
 await f.publish();const wait=deferred();f.list.setSource({...f.source,revision:1,async bind(c){if(c.key==='k10')await wait.promise;return f.source.bind(c);}});f.list.reveal('k10',{align:'start'});const old=f.root.prepare();await Promise.resolve();f.list.reveal('k15');await assert.rejects(old,code('UI_STALE'));wait.resolve();await f.publish();assert.ok(f.list.snapshot().rows.some(r=>r.key==='k15'&&r.visible));assert.equal(f.list.getFocus().key,undefined);
}));
