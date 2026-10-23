// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {createPointerInput} from '@egret/engine/input';
import {host} from './helpers.mjs';
const ui=await import('@egret/engine/ui').catch(error=>({missing:error.message}));
const sample=(id=1)=>({pointerId:id,pointerType:'touch',globalX:10,globalY:10,buttons:1,timestamp:0});
const code=name=>error=>error?.code===name;
function rootFor(engine,scope,extra={}) {
  assert.equal(typeof ui.createUiRoot,'function','M31_UI_FACTORY_MISSING: '+(ui.missing??''));
  return ui.createUiRoot({engine,scope,id:'panel',viewport:{width:120,height:80},density:1,
    tree:{id:'leaf',kind:'leaf',explicitWidth:120,explicitHeight:80,measure:()=>({width:120,height:80,dependencyRevision:0})},...extra});
}
async function owned(run) {
 const engine=await createEngine({host:host().adapter});
 try {await run(engine,engine.createScope());} finally {await engine.dispose();}
}
function rawTarget(engine,scope) {
 const target=scope.use(new DisplayObjectContainer());target.hitArea={x:0,y:0,width:40,height:40};
 target.touchEnabled=true;engine.stage.addChild(target);return target;
}
test('M3 UI observer on another same-Engine input blocks publication and drains depth',async()=>owned(async(engine,scope)=>{
 const target=rawTarget(engine,scope);const root=rootFor(engine,scope);const token=await root.prepare();
 const states=[];const input=createPointerInput({engine,scope,width:200,height:200,onContact:notice=>{
   if(notice.kind==='begin'){assert.throws(()=>root.commit(token),code('UI_BUSY'));states.push(root.snapshot().committedRevision);}
 }});
 input.begin(sample());assert.deepEqual(states,[0]);assert.equal(root.commit(token).kind,'committed');
 target.dispose();input.sync();root.dispose();
}));
test('M3 UI target-route nested delivery refuses even without a borrowed input',async()=>owned(async(engine,scope)=>{
 const target=rawTarget(engine,scope);const root=rootFor(engine,scope),token=await root.prepare();
 const input=createPointerInput({engine,scope,width:200,height:200});let hits=0;
 target.on(input.events.begin,()=>{assert.throws(()=>root.commit(token),code('UI_BUSY'));hits++;});
 input.begin(sample());assert.equal(hits,1);assert.equal(root.commit(token).kind,'committed');root.dispose();
}));
test('M3 UI separate Engine is independent of another Engine input delivery',async()=>owned(async(first,scope)=>{
 const second=await createEngine({host:host().adapter});
 try {const root=rootFor(second,second.createScope()),token=await root.prepare();rawTarget(first,scope);
  const input=createPointerInput({engine:first,scope,width:200,height:200,onContact:notice=>{
    if(notice.kind==='begin')assert.equal(root.commit(token).kind,'committed');
  }});input.begin(sample());assert.equal(root.snapshot().committedRevision,1);root.dispose();
 }finally{await second.dispose();}
}));
test('M3 UI input observer throw releases Engine exclusion for a later commit',async()=>owned(async(engine,scope)=>{
 rawTarget(engine,scope);const root=rootFor(engine,scope),token=await root.prepare(),failure=Error('authored observer failure');
 const input=createPointerInput({engine,scope,width:200,height:200,onContact:notice=>{
   if(notice.kind==='begin'){assert.throws(()=>root.commit(token),code('UI_BUSY'));throw failure;}
 }});
 assert.throws(()=>input.begin(sample()),error=>error.cause===failure);assert.equal(input.state,'closed');
 assert.equal(root.commit(token).kind,'committed');root.dispose();
}));
test('M3 UI factory rejects lookalike Engine, Scope and foreign genuine Scope',async()=>owned(async(engine,scope)=>{
 const other=await createEngine({host:host().adapter});
 try {assert.throws(()=>rootFor({},scope),code('UI_ENGINE_INVALID'));
 assert.throws(()=>rootFor(new Proxy(engine,{}),scope),code('UI_ENGINE_INVALID'));
 assert.throws(()=>rootFor(engine,{}),code('UI_SCOPE_INVALID'));
 assert.throws(()=>rootFor(engine,other.createScope()),code('UI_SCOPE_INVALID'));
 }finally{await other.dispose();}
}));
test('M3 UI genuine authority ignores harmless public Engine and Scope operation shadows',async()=>owned(async(engine,scope)=>{
 const originalStage=engine.stage;const replacement=new DisplayObjectContainer();const fail=()=>{throw Error('mutable public shadow invoked');};
 Object.defineProperties(engine,{stage:{value:replacement,configurable:true},createScope:{value:fail,configurable:true}});
 Object.defineProperties(scope,{use:{value:fail,configurable:true},dispose:{value:fail,configurable:true},signal:{value:{},configurable:true}});
 const root=rootFor(engine,scope);assert.equal(root.commit(await root.prepare()).kind,'committed');
 assert.equal(replacement.numChildren,0);root.dispose();
 // Restore ordinary Engine close paths; UI's captured authority is the tested boundary.
 delete scope.dispose;Object.defineProperty(engine,'stage',{value:originalStage,configurable:true});
}));
test('M3 UI authentic input admission refuses lookalike, proxy and foreign facades',async()=>owned(async(engine,scope)=>{
 const input=createPointerInput({engine,scope,width:200,height:200});const other=await createEngine({host:host().adapter});
 try {const foreign=createPointerInput({engine:other,scope:other.createScope(),width:200,height:200});
 for(const value of [{},new Proxy(input,{}),foreign])assert.throws(()=>rootFor(engine,scope,{input:value}),code('UI_INPUT_INVALID'));
 }finally{await other.dispose();}
}));

test('M3 UI independent roots on one Engine preserve mount order and close independently',async()=>owned(async(engine,scope)=>{
 const before=rawTarget(engine,scope);const first=rootFor(engine,scope,{id:'first'}),second=rootFor(engine,scope,{id:'second',origin:{x:140,y:0}});
 const children=Array.from({length:engine.stage.numChildren},(_,i)=>engine.stage.getChildAt(i));
 assert.equal(children[0],before);assert.equal(children.length,3);
 first.commit(await first.prepare());second.commit(await second.prepare());
 first.setOrigin({x:5,y:2});first.commit(await first.prepare());
 assert.deepEqual(Array.from({length:engine.stage.numChildren},(_,i)=>engine.stage.getChildAt(i)),children);
 first.dispose();assert.equal(second.state,'open');assert.equal(engine.stage.getChildAt(0),before);
 assert.equal(engine.stage.getChildAt(1),children[2]);second.dispose();assert.equal(engine.stage.numChildren,1);
}));
test('M3 UI Stage transforms refuse publication without changing ordinary Stage APIs',async()=>owned(async(engine,scope)=>{
 engine.stage.x=1;assert.throws(()=>rootFor(engine,scope),code('UI_STAGE_TRANSFORM_UNSUPPORTED'));
 engine.stage.x=0;const root=rootFor(engine,scope),token=await root.prepare();engine.stage.scaleX=2;
 assert.throws(()=>root.commit(token),code('UI_STAGE_TRANSFORM_UNSUPPORTED'));assert.equal(root.snapshot().committedRevision,0);
 assert.equal(engine.stage.scaleX,2);engine.stage.scaleX=1;root.commit(await root.prepare());root.dispose();
}));
test('M3 UI factory/commit use original Scope lifetime and close before ordinary cleanup',async()=>{
 const diagnostics=[];const engine=await createEngine({host:host().adapter,onDiagnostic:d=>diagnostics.push(d)});
 const scope=engine.createScope(),root=rootFor(engine,scope);root.commit(await root.prepare());const wrapper=engine.stage.getChildAt(0);
 scope.signal.addEventListener('abort',()=>{assert.equal(root.state,'closed');assert.equal(wrapper.parent,undefined);});
 scope.dispose();assert.equal(root.state,'closed');assert.equal(wrapper.isDisposed,true);assert.equal(diagnostics.length,0);
 await engine.dispose();
});
test('M3 UI Engine frame observation excludes commit and releases on completion',async()=>{
 let root,token,calls=0;const engine=await createEngine({host:host({renderFrame(){calls++;assert.throws(()=>root.commit(token),code('UI_BUSY'));}}).adapter});
 try{root=rootFor(engine,engine.createScope());token=await root.prepare();engine.renderFrame({width:120,height:80});
 assert.equal(calls,1);assert.equal(root.snapshot().committedRevision,0);assert.equal(root.commit(token).kind,'committed');root.dispose();
 }finally{await engine.dispose();}
});
test('M3 UI preparation excludes commit from caller-controlled frame option reads',async()=>owned(async(engine,scope)=>{
 const root=rootFor(engine,scope),token=await root.prepare();let reads=0;
 engine.captureFrame({get width(){reads++;assert.throws(()=>root.commit(token),code('UI_BUSY'));return 120;},height:80});
 assert.equal(reads,1);assert.equal(root.commit(token).kind,'committed');root.dispose();
}));
