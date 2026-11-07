// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';import assert from 'node:assert/strict';
import {createEngine,Sprite} from '@egret/engine';import * as ui from '@egret/engine/ui';
import {createPointerInput,createKeyboardInput} from '@egret/engine/input';import {host} from './helpers.mjs';
const code=name=>error=>error.code===name;
const sample=(x,y,type='mouse')=>({globalX:x,globalY:y,buttons:1,timestamp:1,pointerType:type,pointerId:1});
async function fixture(extra={}){
 const engine=await createEngine({host:host().adapter}),scope=engine.createScope(),seen=[],focusChanges=[],input=createPointerInput({engine,scope,width:400,height:300}),keyboard=createKeyboardInput({engine,scope,onFocusChange:change=>focusChanges.push(change)}),roots=[];
 async function panel(id,x=10,y=10,width=120,height=80){
  const source={revision:1,records:['k0','k1'].map(key=>({key,contentVersion:1,estimatedHeight:40,value:key})),bind(context){const content=context.scope.use(new Sprite());content.graphics.beginFill(0x224466).drawRect(0,0,context.width,40).endFill();return {content,measuredHeight:40};},unbind(){}};
  const root=ui.createUiRoot({engine,scope,id,origin:{x,y},viewport:{width,height},density:1,input,keyboard:{input:keyboard,idPrefix:id},tree:{id:id+'-rows',kind:'virtualList',source,explicitWidth:width,explicitHeight:height},onRowPointer(e){seen.push([id,e.key,e.kind]);}});roots.push(root);
  const publish=async()=>{for(let n=0;n<12;n++){const p=await root.prepare();if(p.status!=='pending')return root.commit(p);}throw Error('unstable fixture');};await publish();return {root,source,publish,list:root.list(id+'-rows')};
 }
 const base=await panel('base'),popup=await panel('popup',0,0,100,80),modal=await panel('modal',0,0,160,120),nested=await panel('nested',0,0,100,80);
 const layers=ui.createUiLayerManager({engine,scope,input,keyboard,viewport:{x:0,y:0,width:400,height:300},...extra});
 layers.register({id:'base',root:base.root,kind:'base'});layers.register({id:'popup',root:popup.root,kind:'popup',anchor:{root:base.root,target:{kind:'row',listId:'base-rows',key:'k0'}}});layers.register({id:'modal',root:modal.root,kind:'modal',initialFocus:{listId:'modal-rows',key:'k0'}});layers.register({id:'nested',root:nested.root,kind:'modal',initialFocus:{listId:'nested-rows',key:'k0'}});
 layers.sync();return {engine,scope,input,keyboard,seen,focusChanges,base,popup,modal,nested,layers,panel};
}
async function owned(run,options){const f=await fixture(options);try{await run(f);}finally{await f.engine.dispose();}}
test('UI layer public API baseline',()=>assert.equal(typeof ui.createUiLayerManager,'function'));
test('layer intents preserve old state until explicit publication and do not rerun layout',async()=>owned(async f=>{
 const passes=f.base.root.snapshot().counters.layoutPasses;f.base.list.focus('k0');f.layers.open('modal');assert.deepEqual(f.layers.snapshot().openStack,[]);assert.equal(f.keyboard.getSnapshot().focusedId,'base:k0');
 const r=f.layers.sync();assert.equal(r.kind,'committed');assert.deepEqual(r.postCommitErrors,[]);assert.deepEqual(f.layers.snapshot().openStack,['modal']);assert.equal(f.keyboard.getSnapshot().focusedId,'modal:k0');assert.equal(f.base.root.snapshot().counters.layoutPasses,passes);assert.equal(f.layers.sync().kind,'unchanged');
}));
test('modal picking barrier blocks background and nested close restores valid logical focus',async()=>owned(async f=>{
 f.base.list.focus('k1');f.layers.open('modal');f.layers.sync();const begin=f.input.begin(sample(20,20,'touch'));assert.ok(begin);f.input.end(begin,{...sample(20,20),buttons:0,timestamp:2});assert.deepEqual(f.seen,[]);
 f.layers.open('nested');f.layers.sync();assert.equal(f.keyboard.getSnapshot().focusedId,'nested:k0');f.layers.close('nested');f.layers.sync();assert.equal(f.keyboard.getSnapshot().focusedId,'modal:k0');f.layers.close('modal');f.layers.sync();assert.equal(f.keyboard.getSnapshot().focusedId,'base:k1');
}));
test('modal contains Tab and direct focus even for unrelated channel targets',async()=>owned(async f=>{
 const outside=f.scope.use(new Sprite());outside.graphics.beginFill(1).drawRect(300,0,10,10).endFill();f.engine.stage.addChild(outside);f.keyboard.registerTarget({id:'outside',target:outside});
 f.layers.open('modal');f.layers.sync();assert.throws(()=>f.keyboard.focus('outside'),code('KEYBOARD_TARGET_INELIGIBLE'));assert.equal(f.keyboard.moveFocus('next'),'modal:k1');assert.equal(f.keyboard.moveFocus('next'),'modal:k0');assert.equal(f.keyboard.moveFocus('previous'),'modal:k1');
 f.layers.close('modal');f.layers.sync();f.keyboard.focus('outside');assert.equal(f.keyboard.getSnapshot().focusedId,'outside');
}));
test('popup uses committed clipped anchor, outside dismissal and parent stack retirement',async()=>owned(async f=>{
 f.layers.open('popup');f.layers.sync();assert.deepEqual(f.popup.root.snapshot().origin,{x:10,y:54});const contact=f.input.begin(sample(350,250));assert.ok(contact);f.input.end(contact,{...sample(350,250),buttons:0,timestamp:2});f.layers.sync();assert.deepEqual(f.layers.snapshot().openStack,[]);
 f.layers.open('popup');f.layers.sync();f.layers.open('modal');f.layers.sync();f.base.list.setSource({...f.base.source,revision:2,records:[f.base.source.records[1]]});await f.base.publish();f.layers.sync();assert.deepEqual(f.layers.snapshot().openStack,[]);
}));
test('pending content never prevents closing a committed layer',async()=>owned(async f=>{
 f.layers.open('modal');f.layers.sync();f.modal.root.setViewport({width:180,height:120},1);f.layers.close('modal');assert.equal(f.layers.sync().kind,'committed');assert.deepEqual(f.layers.snapshot().openStack,[]);await f.modal.publish();assert.equal(f.layers.sync().kind,'unchanged');assert.deepEqual(f.layers.snapshot().openStack,[]);
}));
test('Escape stages top layer only and manager shutdown preserves borrowed roots/input',async()=>owned(async f=>{
 f.layers.open('modal');f.layers.sync();f.layers.open('nested');f.layers.sync();f.keyboard.keyDown({code:'Escape',key:'Escape'});f.keyboard.keyUp({code:'Escape',key:'Escape'});assert.deepEqual(f.layers.snapshot().openStack,['modal','nested']);f.layers.sync();assert.deepEqual(f.layers.snapshot().openStack,['modal']);
 f.layers.dispose();assert.equal(f.base.root.state,'open');assert.equal(f.input.state,'active');assert.equal(f.keyboard.getSnapshot().state,'active');f.base.list.focus('k0');assert.equal(f.keyboard.getSnapshot().focusedId,'base:k0');
}));
test('root disposal retires owned backdrops and descendant intents',async()=>owned(async f=>{
 f.layers.open('popup');f.layers.sync();f.layers.open('modal');f.layers.sync();f.popup.root.dispose();f.layers.sync();assert.deepEqual(f.layers.snapshot().openStack,[]);assert.equal(f.layers.snapshot().counters.registered,3);
}));
test('layer admission rejects structural and foreign roots and duplicate ownership',async()=>owned(async f=>{
 assert.throws(()=>f.layers.register({id:'fake',root:{...f.base.root},kind:'base'}),code('UI_TEXT_EDITOR_ROOT_INVALID'));
 assert.throws(()=>f.layers.register({id:'duplicate',root:f.base.root,kind:'base'}),code('UI_LAYER_ROOT_OWNED'));
 const other=await createEngine({host:host().adapter});try{const s=other.createScope(),r=ui.createUiRoot({engine:other,scope:s,id:'other',viewport:{width:10,height:10},density:1,tree:{id:'x',kind:'leaf'}});assert.throws(()=>f.layers.register({id:'foreign',root:r,kind:'base'}),code('UI_TEXT_EDITOR_ROOT_INVALID'));}finally{await other.dispose();}
}));
test('notification failures retain thrown undefined and a consistent committed stack',async()=>{let fail=false;await owned(async f=>{fail=true;f.layers.open('modal');const result=f.layers.sync();assert.deepEqual(f.layers.snapshot().openStack,['modal']);assert.ok(result.postCommitErrors.some(e=>e===undefined));fail=false;},{onInvalidate(){if(fail)throw undefined;}});});

test('a modal invalidates an older prepared UI token without recreating rows',async()=>owned(async f=>{
 f.modal.root.setViewport({width:180,height:120},1);const token=await f.modal.root.prepare();assert.equal(token.status,'ready');f.layers.open('modal');assert.equal(f.layers.sync().kind,'pending');f.modal.root.commit(token);f.layers.sync();const passes=f.modal.root.snapshot().counters.layoutPasses;f.modal.root.setViewport({width:170,height:120},1);const old=await f.modal.root.prepare();f.layers.close('modal');f.layers.sync();assert.equal(f.modal.root.commit(old).kind,'stale');await f.modal.publish();assert.equal(f.modal.root.snapshot().counters.layoutPasses,passes+1);assert.deepEqual(f.layers.snapshot().openStack,[]);
}));

test('contact cancellation can stage another intent without stale layer publication',async()=>owned(async f=>{
 const contact=f.input.begin(sample(20,20));assert.ok(contact);const remove=f.input.observe(event=>{if(event.kind==='cancel')f.layers.close('modal');});f.layers.open('modal');assert.equal(f.layers.sync().kind,'pending');assert.deepEqual(f.layers.snapshot().openStack,[]);remove();assert.equal(f.layers.sync().kind,'committed');assert.deepEqual(f.layers.snapshot().openStack,[]);
}));

test('an oversized newly opened dialog leaves the previous committed stack intact',async()=>owned(async f=>{
 f.layers.open('popup');f.layers.sync();f.layers.setViewport({x:0,y:0,width:110,height:100});f.layers.open('modal');assert.throws(()=>f.layers.sync(),code('UI_LAYER_VIEWPORT_TOO_SMALL'));assert.deepEqual(f.layers.snapshot().openStack,['popup']);f.layers.close('modal');f.layers.setViewport({x:0,y:0,width:400,height:300});f.layers.sync();
}));

test('repeated overlay cycles retain a bounded number of backdrops and preserve base bindings',async()=>owned(async f=>{
 const before=f.base.root.snapshot().counters;for(let i=0;i<30;i++){f.layers.open('popup');f.layers.sync();f.layers.open('modal');f.layers.sync();f.layers.close('popup');f.layers.sync();}assert.deepEqual(f.base.root.snapshot().counters,before);assert.deepEqual(f.layers.snapshot().counters,{registered:4,open:0,backdrops:3});
}));

// Independently reported lifetime/order counterexamples use only genuine public SDK values.
test('Engine shutdown also works when layer roots were created after the manager',async()=>owned(async f=>{
 const late=await f.panel('late');f.layers.register({id:'late',root:late.root,kind:'base'});f.layers.sync();await f.engine.dispose();assert.equal(f.layers.snapshot().state,'closed');
}));

test('layer disposal during routed input releases borrowed focus, pose and native eligibility',async()=>owned(async f=>{
 f.layers.open('modal');f.layers.sync();const observer=f.input.observe(event=>{if(event.kind==='end')f.layers.dispose();});const p=f.input.begin(sample(130,100));assert.ok(p);f.input.end(p,{...sample(130,100),buttons:0,timestamp:2});observer();assert.equal(f.layers.snapshot().state,'closed');f.base.list.focus('k0');assert.equal(f.keyboard.getSnapshot().focusedId,'base:k0');f.base.root.setOrigin({x:40,y:30});await f.base.publish();assert.deepEqual(f.base.root.snapshot().origin,{x:40,y:30});assert.equal(f.base.root.snapshot().layerRevision,undefined);
}));

test('manager disposal terminates active modal contacts and releases its view Scope',async()=>owned(async f=>{
 f.layers.open('modal');f.layers.sync();const p=f.input.begin(sample(130,100));assert.ok(p);let cancels=0;const remove=f.input.observe(event=>{if(event.kind==='cancel')cancels++;});f.layers.dispose();remove();assert.equal(f.input.contacts.length,0);assert.equal(cancels,1);assert.equal(f.modal.root.state,'open');f.base.list.focus('k0');
}));

test('owning Scope close is independent of manager/root creation order',async()=>owned(async f=>{
 const late=await f.panel('late-scope');f.layers.register({id:'late-scope',root:late.root,kind:'base'});f.layers.sync();f.scope.dispose();assert.equal(f.layers.snapshot().state,'closed');assert.equal(late.root.state,'closed');
}));

test('registered roots keep the exact shared input for the complete ownership lifetime',async()=>owned(async f=>{
 const other=createPointerInput({engine:f.engine,scope:f.scope,width:400,height:300});assert.throws(()=>f.base.root.setInput(other),code('UI_LAYER_INPUT_MISMATCH'));f.base.root.setInput(f.input);f.layers.dispose();f.base.root.setInput(other);await f.base.publish();
}));

test('Stage ordering is recalculated after cancellation callbacks add a scene object',async()=>owned(async f=>{
 f.layers.open('modal');f.layers.sync();const p=f.input.begin(sample(130,100));assert.ok(p);let escaped=0;const sprite=f.scope.use(new Sprite());sprite.graphics.beginFill(0xff0000).drawRect(0,0,400,300).endFill();sprite.touchEnabled=true;sprite.on(f.input.events.begin,()=>{escaped++;});const remove=f.input.observe(event=>{if(event.kind==='cancel')f.engine.stage.addChild(sprite);});f.layers.setViewport({x:0,y:0,width:400,height:280});const result=f.layers.sync();remove();assert.equal(result.kind,'committed');assert.deepEqual(result.postCommitErrors,[]);const after=f.input.begin(sample(20,20));assert.ok(after);assert.equal(escaped,0);f.input.cancel(after,'owner');
}));

test('registration disposal synchronizes held contacts before the next layer publication',async()=>owned(async f=>{
 const extra=await f.panel('retired-dialog');const registration=f.layers.register({id:'retired-dialog',root:extra.root,kind:'modal'});f.layers.open('retired-dialog');f.layers.sync();const p=f.input.begin(sample(150,120));assert.ok(p);let cancels=0;const remove=f.input.observe(event=>{if(event.kind==='cancel')cancels++;});registration.dispose();remove();assert.equal(f.input.contacts.length,0);assert.equal(cancels,1);assert.equal(extra.root.state,'open');f.layers.sync();assert.deepEqual(f.layers.snapshot().openStack,[]);
}));

// A real phone rotation exposed native-editor activation from a synthetic keyboard navigation reason.
test('layer fallback focus is programmatic after its saved row disappears',async()=>owned(async f=>{
 f.base.list.focus('k0');f.layers.open('modal');f.layers.sync();f.base.list.setSource({...f.base.source,revision:2,records:[f.base.source.records[1]]});await f.base.publish();f.focusChanges.length=0;f.layers.close('modal');f.layers.sync();assert.equal(f.keyboard.getSnapshot().focusedId,'base:k1');assert.equal(f.focusChanges.at(-1).reason,'programmatic');
}));
