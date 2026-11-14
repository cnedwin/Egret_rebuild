// SPDX-License-Identifier: Apache-2.0
// The display object of a row of a managed list, given to its binding: controls of the application listen on it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer,Sprite} from '@egret/engine';
import {createPointerInput} from '@egret/engine/input';
import {createHoverInput} from '@egret/engine/input/hover';
import {createActionControl,createHoverControl,createUiRoot} from '@egret/engine/ui';
import {spawnSync} from 'node:child_process';
import {host} from './helpers.mjs';

/** A list of three rows of 20 at (10, 10) on a stage of 200 by 200, out of ten records. Each binding keeps what it was given. */
async function fixture(run){
 const engine=await createEngine({host:host().adapter}),scope=engine.createScope();
 const input=createPointerInput({engine,scope,width:200,height:200}),hover=createHoverInput({engine,scope,width:200,height:200}),bound=[],pointed=[],log=[];
 let version=0,wire;
 const make=()=>({revision:version,records:Array.from({length:10},(_,index)=>({key:'k'+index,contentVersion:index===1?version:0,estimatedHeight:20,value:index})),
  bind(context){
   const content=context.scope.use(new DisplayObjectContainer()),back=content.addChild(context.scope.use(new Sprite()));back.graphics.beginFill(1).drawRect(0,0,context.width,20).endFill();
   const entry={key:context.key,generation:context.bindingGeneration,target:context.target,content,controls:wire?.(context)??[]};bound.push(entry);
   return {content,measuredHeight:20};
  },
  unbind({key,bindingGeneration}){const entry=bound.find(found=>found.key===key&&found.generation===bindingGeneration);for(const control of entry?.controls??[])control.dispose();log.push('unbind '+key);}});
 const root=createUiRoot({engine,scope,id:'panel',viewport:{width:100,height:60},density:1,origin:{x:10,y:10},input,onRowPointer:notification=>pointed.push(notification),
  tree:{id:'list',kind:'virtualList',source:make(),explicitWidth:100,explicitHeight:60},limits:{overscan:0,residentCap:8}});
 const list=root.list('list');
 const commit=async()=>{for(let round=0;round<8;round++){const token=await root.prepare();if(token.status!=='pending')return root.commit(token);}throw Error('Unstable fixture');};
 let clock=0;
 const over=(x,y)=>hover.sample({pointerId:1,pointerType:'mouse',globalX:x,globalY:y,timestamp:++clock});
 const press=(x,y)=>{const contact=input.begin({pointerId:1,pointerType:'mouse',globalX:x,globalY:y,buttons:1,timestamp:++clock});input.end(contact,{globalX:x,globalY:y,buttons:0,timestamp:++clock});};
 const latest=key=>bound.filter(entry=>entry.key===key).at(-1);
 try{await run({engine,scope,input,hover,root,list,commit,bound,pointed,log,over,press,latest,setWire:value=>{wire=value;},rebind:()=>{version++;list.setSource(make());return commit();}});}
 finally{await engine.dispose();}
}

test('RT01 a binding is given the display object of its row, which is where a press on the row arrives',async()=>fixture(async({commit,bound,pointed,over,press,latest})=>{
 await commit();
 assert.deepEqual(bound.map(entry=>entry.key),['k0','k1','k2']);
 for(const entry of bound){assert.equal(typeof entry.target.on,'function');assert.equal(entry.content.parent,entry.target,'the content is inside it once the row is committed');}
 assert.equal(new Set(bound.map(entry=>entry.target)).size,3,'each row has its own');
 // The second row lies from 30 to 50: a pointer there is over its target, and a press there names it.
 assert.equal(over(50,35),latest('k1').target);assert.equal(over(50,15),latest('k0').target);
 press(50,35);
 assert.deepEqual(pointed.map(notification=>[notification.kind,notification.key,notification.target===latest('k1').target]),[['begin','k1',true],['end','k1',true]]);
}));

test('RT02 a hover control on the row says when a pointer is over it, and lets go when the row scrolls away',async()=>fixture(async({hover,list,commit,log,over,setWire})=>{
 setWire(context=>[createHoverControl({hover,target:context.target,onHoverChange:hovered=>log.push(context.key+' '+hovered)})]);
 await commit();
 over(50,35);over(50,55);over(150,150);
 assert.deepEqual(log,['k1 true','k1 false','k2 true','k2 false']);
 // The pointer rests on the second row while the list scrolls two rows on. The row that left is no longer pointed at,
 // and when the input picks again the row that is there now is.
 log.length=0;over(50,35);list.setScrollOffset(40);await commit();
 assert.deepEqual(log,['k1 true','unbind k0','k1 false','unbind k1']);
 log.length=0;hover.sync();assert.deepEqual(log,['k3 true']);
}));

test('RT03 an action control on the row is pressed and activated as a button is, and a row bound again has another target',async()=>fixture(async({input,commit,log,press,latest,rebind,bound,setWire})=>{
 setWire(context=>[createActionControl({input,target:context.target,onActivate:()=>log.push('activate '+context.key+' '+context.bindingGeneration),onPressChange:pressed=>log.push(context.key+' '+pressed)})]);
 await commit();
 const first=latest('k1');
 press(50,35);assert.deepEqual(log,['k1 true','k1 false','activate k1 '+first.generation]);
 // The record of the second row changes: it is bound again, with another display object. The old one hears nothing more.
 log.length=0;await rebind();
 const second=latest('k1');
 assert.notEqual(second.target,first.target);assert.ok(second.generation>first.generation);assert.deepEqual(log,['unbind k1']);
 log.length=0;press(50,35);assert.deepEqual(log,['k1 true','k1 false','activate k1 '+second.generation]);
 // The rows that did not change kept theirs.
 assert.deepEqual(['k0','k2'].map(key=>bound.filter(entry=>entry.key===key).length),[1,1]);
}));

test('RT04 a strict consumer reads the target of a binding, and may not replace it',()=>{
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/ui-row-target.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
