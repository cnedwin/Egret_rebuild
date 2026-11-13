// SPDX-License-Identifier: Apache-2.0
// Hover, toggle and single-selection control state on a genuine Engine, driven by its logical inputs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {createPointerInput} from '@egret/engine/input';
import {createHoverInput} from '@egret/engine/input/hover';
import {createHoverControl,createToggleControl,createSelectionGroup} from '@egret/engine/ui';
import {spawnSync} from 'node:child_process';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
// A panel with two halves at x 0..40, and three separate options at x 60, 110 and 160, on a stage of 200 by 100.
async function fixture(run){
 const engine=await createEngine({host:host().adapter}),scope=engine.createScope();
 const make=(parent,x,width=40)=>{const node=scope.use(new DisplayObjectContainer());node.x=x;node.hitArea={x:0,y:0,width,height:40};node.touchEnabled=true;parent.addChild(node);return node;};
 const panel=make(engine.stage,0),left=make(panel,0,20),right=make(panel,20,20);
 const options=[make(engine.stage,60),make(engine.stage,110),make(engine.stage,160)];
 const input=createPointerInput({engine,scope,width:200,height:100}),hover=createHoverInput({engine,scope,width:200,height:100});
 let clock=0;
 const over=(x,id=1)=>hover.sample({pointerId:id,pointerType:id===1?'mouse':'pen',globalX:x,globalY:10,timestamp:++clock});
 const down=(x,id=1)=>input.begin({pointerId:id,pointerType:'touch',globalX:x,globalY:10,buttons:1,timestamp:++clock});
 const up=(session,x)=>input.end(session,{globalX:x,globalY:10,buttons:0,timestamp:++clock});
 const tap=x=>up(down(x),x);
 try{await run({engine,scope,panel,left,right,options,input,hover,over,down,up,tap});}finally{hover.dispose();input.dispose();await engine.dispose();}
}

test('SC01 a hover and the enter that follows it name each other',async()=>fixture(({left,right,options,hover,over})=>{
 const notices=[],payloads=[];
 hover.observe(n=>notices.push([n.kind,n.target,n.related]));
 for(const node of [left,right,options[0]])for(const kind of ['enter','leave'])node.on(hover.events[kind],event=>{if(event.target===node)payloads.push([kind,event.payload.related,Object.isFrozen(event.payload),'related' in event.payload]);});
 over(5);over(25);over(50);over(70);hover.leave(1,'outside');
 assert.deepEqual(notices,[['enter',left,undefined],['leave',left,right],['enter',right,left],['leave',right,undefined],['enter',options[0],undefined],['leave',options[0],undefined]]);
 assert.deepEqual(payloads,[['enter',undefined,true,false],['leave',right,true,true],['enter',left,true,true],['leave',undefined,true,false],['enter',undefined,true,false],['leave',undefined,true,false]]);
}));

test('SC02 late observers see every enter, move and leave after its target path, and cannot fail the input',async()=>fixture(({left,hover,over})=>{
 const order=[];
 left.on(hover.events.enter,()=>order.push('target'));
 const remove=hover.observe(n=>{order.push('first:'+n.kind);throw new Error('observer');});
 hover.observe(n=>order.push('second:'+n.kind));
 over(5);over(6);
 assert.deepEqual(order,['target','first:enter','second:enter','first:move','second:move']);
 assert.equal(hover.state,'active');
 remove();remove();over(50);
 assert.deepEqual(order.slice(5),['second:leave']);
 for(const value of [undefined,null,1])assert.throws(()=>hover.observe(value),coded('HOVER_INPUT_OPTIONS_INVALID'));
 // What the target path throws still reaches the observers before the input closes.
 left.on(hover.events.enter,()=>{throw new Error('listener');});
 order.length=0;
 assert.throws(()=>over(5),coded('HOVER_INPUT_CALLBACK_FAILED'));
 assert.deepEqual(order,['target','second:enter','second:leave']);
 hover.observe(()=>order.push('late'));hover.dispose();assert.equal(order.includes('late'),false);
}));

test('SC03 a control is hovered while a pointer is over it or a descendant, without a flicker between descendants',async()=>fixture(({panel,hover,over})=>{
 const changes=[];
 const control=createHoverControl({hover,target:panel,onHoverChange:value=>changes.push(value)});
 assert.equal(control.hovered,false);assert.equal(control.enabled,true);
 over(5);over(25);over(6);
 assert.deepEqual(changes,[true]);assert.equal(control.hovered,true);
 over(50);assert.deepEqual(changes,[true,false]);
 // Two pointers: the control stays hovered until the last one has left.
 over(5);over(25,2);over(50);assert.equal(control.hovered,true);
 hover.leave(2,'outside');assert.deepEqual(changes,[true,false,true,false]);
 assert.ok(Object.isFrozen(control));
}));

test('SC04 a hovered control whose target can no longer be reached still learns that the hover ended',async()=>fixture(({engine,panel,left,hover,over})=>{
 const changes=[];
 const control=createHoverControl({hover,target:panel,onHoverChange:value=>changes.push(value)});
 over(5);panel.removeChild(left);hover.sync();
 // The pointer is now over the panel itself: one leave and one enter, and the control never let go.
 assert.deepEqual(changes,[true]);
 engine.stage.removeChild(panel);hover.sync();
 assert.deepEqual(changes,[true,false]);assert.equal(control.hovered,false);
 engine.stage.addChild(panel);over(6);assert.deepEqual(changes,[true,false,true]);
 // Every way the input drops a hover ends it for the control.
 hover.setInteractive(false);assert.equal(control.hovered,false);
 hover.setInteractive(true);over(7);assert.equal(control.hovered,true);
 hover.setViewportRevision(1);assert.equal(control.hovered,false);
 over(8);hover.dispose();assert.equal(control.hovered,false);
 assert.deepEqual(changes,[true,false,true,false,true,false,true,false]);
}));

test('SC05 a disabled control is not hovered, and finds the pointer again when it is enabled',async()=>fixture(({panel,hover,over})=>{
 const changes=[];
 const control=createHoverControl({hover,target:panel,onHoverChange:value=>changes.push(value)});
 over(5);control.setEnabled(false);control.setEnabled(false);
 assert.equal(control.hovered,false);assert.equal(control.enabled,false);
 over(25);assert.deepEqual(changes,[true,false]);
 control.setEnabled(true);assert.deepEqual(changes,[true,false,true]);
 control.setEnabled(false);over(50);control.setEnabled(true);assert.deepEqual(changes,[true,false,true,false]);
 assert.throws(()=>control.setEnabled('yes'),coded('UI_CONTROL_OPTIONS'));
 over(5);control.dispose();control.dispose();
 assert.deepEqual(changes,[true,false,true,false,true,false]);assert.equal(control.hovered,false);
 over(50);over(5);assert.equal(changes.length,6);
 assert.throws(()=>control.setEnabled(true),coded('UI_CONTROL_CLOSED'));
}));

test('SC06 a toggle flips on a completed press, on its scripted equivalent, and never on a cancelled contact',async()=>fixture(({options,input,down,up,tap})=>{
 const changes=[],presses=[];
 const toggle=createToggleControl({input,target:options[0],onChange:value=>changes.push(value),onPressChange:value=>presses.push(value)});
 assert.equal(toggle.checked,false);assert.equal(toggle.pressed,false);assert.equal(toggle.enabled,true);
 const session=down(70);assert.equal(toggle.pressed,true);assert.equal(toggle.checked,false);
 up(session,70);assert.equal(toggle.checked,true);
 input.cancel(down(70),'pointercancel');assert.equal(toggle.checked,true);assert.equal(toggle.pressed,false);
 toggle.press();toggle.release();assert.equal(toggle.checked,false);
 toggle.toggle();toggle.setChecked(true);toggle.setChecked(false);
 assert.deepEqual(changes,[true,false,true,false]);
 assert.deepEqual(presses,[true,false,true,false,true,false]);
 // Elsewhere is not this control.
 tap(120);assert.equal(toggle.checked,false);
 assert.ok(Object.isFrozen(toggle));
}));

test('SC07 a disabled toggle refuses activation and still takes a value that is set',async()=>fixture(({options,input,tap})=>{
 const changes=[];
 const toggle=createToggleControl({input,target:options[0],checked:true,onChange:value=>changes.push(value)});
 assert.equal(toggle.checked,true);
 toggle.setEnabled(false);tap(70);toggle.toggle();toggle.press();toggle.release();
 assert.equal(toggle.checked,true);assert.deepEqual(changes,[]);
 toggle.setChecked(false);assert.deepEqual(changes,[false]);
 toggle.setEnabled(true);tap(70);assert.deepEqual(changes,[false,true]);
 for(const action of [()=>toggle.setChecked(1),()=>toggle.setEnabled(undefined)])assert.throws(action,coded('UI_CONTROL_OPTIONS'));
 toggle.dispose();toggle.dispose();tap(70);assert.equal(toggle.checked,true);assert.equal(changes.length,2);
 for(const action of [()=>toggle.toggle(),()=>toggle.setChecked(false),()=>toggle.press(),()=>toggle.release(),()=>toggle.setEnabled(true)])assert.throws(action,coded('UI_CONTROL_CLOSED'));
 for(const bad of [null,[],{input,target:options[1],checked:'yes'},{input,target:options[1],onChange:1},{input,target:options[1],onPressChange:1},{input,target:{}},{target:options[1]}])assert.throws(()=>createToggleControl(bad),coded('UI_CONTROL_OPTIONS'));
}));

test('SC08 a group selects one item by press or by name, and reports each change with what it replaced',async()=>fixture(({options,input,down,tap})=>{
 const changes=[];
 const group=createSelectionGroup({input,items:[{key:'easy',target:options[0]},{key:'normal',target:options[1]},{key:'hard',target:options[2]}],onChange:(selected,previous)=>changes.push([selected,previous])});
 assert.equal(group.selected,undefined);assert.deepEqual(group.keys,['easy','normal','hard']);assert.ok(Object.isFrozen(group.keys)&&Object.isFrozen(group));
 tap(120);assert.equal(group.selected,'normal');
 tap(120);assert.equal(group.select('normal'),false);
 assert.equal(group.select('hard'),true);
 input.cancel(down(70),'pointercancel');assert.equal(group.selected,'hard');
 tap(70);
 assert.deepEqual(changes,[['normal',undefined],['hard','normal'],['easy','hard']]);
 assert.throws(()=>group.select('extreme'),coded('UI_CONTROL_UNKNOWN_ITEM'));
 assert.throws(()=>group.isItemEnabled('extreme'),coded('UI_CONTROL_UNKNOWN_ITEM'));
}));

test('SC09 movement follows the order of the items, skips the disabled ones and wraps unless told not to',async()=>fixture(({options,input})=>{
 const items=[{key:'a',target:options[0]},{key:'b',target:options[1],enabled:false},{key:'c',target:options[2]}];
 const group=createSelectionGroup({input,items,selected:'a'});
 assert.equal(group.isItemEnabled('b'),false);
 assert.equal(group.next(),true);assert.equal(group.selected,'c');
 assert.equal(group.next(),true);assert.equal(group.selected,'a');
 assert.equal(group.previous(),true);assert.equal(group.selected,'c');
 assert.equal(group.first(),true);assert.equal(group.selected,'a');assert.equal(group.first(),false);
 assert.equal(group.last(),true);assert.equal(group.selected,'c');assert.equal(group.last(),false);
 group.setItemEnabled('b',true);assert.equal(group.previous(),true);assert.equal(group.selected,'b');
 // A selected item that is disabled stays selected, and movement leaves from where it is.
 group.setItemEnabled('b',false);assert.equal(group.selected,'b');
 assert.equal(group.next(),true);assert.equal(group.selected,'c');
 group.setItemEnabled('a',false);assert.equal(group.next(),false);assert.equal(group.previous(),false);assert.equal(group.selected,'c');
 group.dispose();
 const bounded=createSelectionGroup({input,items,wrap:false});
 // With nothing selected, movement starts at the end it is leaving from.
 assert.equal(bounded.previous(),true);assert.equal(bounded.selected,'c');
 assert.equal(bounded.next(),false);assert.equal(bounded.previous(),true);assert.equal(bounded.selected,'a');assert.equal(bounded.previous(),false);
 bounded.dispose();
 const fresh=createSelectionGroup({input,items});
 assert.equal(fresh.next(),true);assert.equal(fresh.selected,'a');
 fresh.dispose();
}));

test('SC10 a disabled item or a disabled group refuses every way of selecting',async()=>fixture(({options,input,tap})=>{
 const changes=[];
 const group=createSelectionGroup({input,items:[{key:'a',target:options[0]},{key:'b',target:options[1],enabled:false},{key:'c',target:options[2]}],selected:'b',onChange:selected=>changes.push(selected)});
 assert.equal(group.selected,'b');
 tap(120);assert.equal(group.select('b'),false);
 tap(70);assert.equal(group.selected,'a');
 assert.equal(group.select('b'),false);tap(120);assert.equal(group.selected,'a');
 group.setEnabled(false);assert.equal(group.enabled,false);
 tap(170);assert.equal(group.select('c'),false);assert.equal(group.next(),false);assert.equal(group.last(),false);
 // Enabling one item of a disabled group does not let a press through.
 group.setItemEnabled('b',true);tap(120);assert.equal(group.selected,'a');
 group.setEnabled(true);tap(120);assert.equal(group.selected,'b');
 assert.deepEqual(changes,['a','b']);
 for(const action of [()=>group.setEnabled(1),()=>group.setItemEnabled('a','no')])assert.throws(action,coded('UI_CONTROL_OPTIONS'));
 group.dispose();group.dispose();tap(170);assert.equal(group.selected,'b');
 for(const action of [()=>group.select('a'),()=>group.next(),()=>group.previous(),()=>group.first(),()=>group.last(),()=>group.setEnabled(true),()=>group.setItemEnabled('a',true)])assert.throws(action,coded('UI_CONTROL_CLOSED'));
}));

test('SC11 only sound options are admitted, and a refused group leaves no control behind',async()=>fixture(({options,input,hover,panel,tap})=>{
 const item=(key,index,extra={})=>({key,target:options[index],...extra});
 const bad=[null,[],{input},{input,items:[]},{input,items:'abc'},{input,items:[item('a',0),item('a',1)]},{input,items:[item('a',0),item('b',0)]},{input,items:[item('',0)]},{input,items:[item(7,0)]},
  {input,items:[item('a',0,{enabled:'yes'})]},{input,items:[item('a',0)],selected:'z'},{input,items:[item('a',0)],wrap:1},{input,items:[item('a',0)],onChange:1},{input,items:[null]},{input,items:[{key:'a',target:{}}]},
  {input,items:Array.from({length:257},(_,index)=>({key:'k'+index,target:options[0]}))}];
 for(const value of bad)assert.throws(()=>createSelectionGroup(value),coded('UI_CONTROL_OPTIONS'));
 assert.throws(()=>createSelectionGroup({input:{},items:[item('a',0)]}));
 // The targets are free for another control afterwards, and no stray control answers a press.
 const changes=[];
 const group=createSelectionGroup({input,items:[item('a',0),item('b',1)],onChange:selected=>changes.push(selected)});
 tap(70);assert.deepEqual(changes,['a']);group.dispose();
 for(const value of [null,[],{hover},{target:panel},{hover:{},target:panel},{hover,target:{}},{hover,target:panel,onHoverChange:1}])assert.throws(()=>createHoverControl(value),coded('UI_CONTROL_OPTIONS'));
}));

test('SC12 a strict consumer compiles against the controls, and six misuses are refused',()=>{
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/ui-state-controls.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});

test('SC13 the UI entry has the three factories, and the default entry has none of them',async()=>{
 const ui=await import('@egret/engine/ui'),root=await import('@egret/engine');
 for(const name of ['createHoverControl','createToggleControl','createSelectionGroup']){assert.equal(typeof ui[name],'function');assert.equal(name in root,false);}
});
