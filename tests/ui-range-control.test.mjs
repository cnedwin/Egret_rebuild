// SPDX-License-Identifier: Apache-2.0
// One value out of a range on a genuine Engine: the track under a contact, the keys, and what assistive technology is told.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {createKeyboardInput,createPointerInput} from '@egret/engine/input';
import {createControlKeys,createRangeControl} from '@egret/engine/ui';
import {createUiSemantics} from '@egret/engine/ui/semantics';
import {spawnSync} from 'node:child_process';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
/** A track of 200 by 20 at (50, 40) on a stage of 400 by 200. */
async function fixture(run){
 const engine=await createEngine({host:host().adapter}),scope=engine.createScope();
 const make=(x,y,width,height)=>{const node=scope.use(new DisplayObjectContainer());node.x=x;node.y=y;node.hitArea={x:0,y:0,width,height};node.touchEnabled=true;engine.stage.addChild(node);return node;};
 const input=createPointerInput({engine,scope,width:400,height:200}),track=make(50,40,200,20),log=[];
 let clock=0,pointer=0;
 const down=(x,y,id=++pointer)=>input.begin({pointerId:id,pointerType:'touch',globalX:x,globalY:y,buttons:1,timestamp:++clock});
 const move=(contact,x,y)=>input.move(contact,{globalX:x,globalY:y,buttons:1,timestamp:++clock});
 const up=(contact,x,y)=>input.end(contact,{globalX:x,globalY:y,buttons:0,timestamp:++clock});
 const create=(extra={})=>createRangeControl({input,target:track,length:200,onChange:(value,previous)=>log.push([value,previous]),onDragChange:dragging=>log.push(dragging),...extra});
 try{await run({engine,scope,input,track,make,log,down,move,up,create});}finally{input.dispose();await engine.dispose();}
}

test('RC01 a range starts at its low end, or at the value of the range nearest to the one it is given',async()=>fixture(({create})=>{
 const range=create();
 assert.ok(Object.isFrozen(range));
 assert.deepEqual([range.value,range.min,range.max,range.step,range.fraction,range.dragging,range.enabled],[0,0,100,1,0,false,true]);
 for(const [options,value,fraction] of [[{value:40},40,0.4],[{value:40.4},40,0.4],[{value:40.5},41,0.41],[{value:-5},0,0],[{value:500},100,1],
  [{min:-1,max:1,step:0.1,value:0.26},0.3,0.65],[{min:10,max:20,step:5,value:14},15,0.5],[{min:0,max:1,step:1,value:0.5},1,1],
  // The far end is a value though no whole step reaches it: 0, 3, 6, 9 and 10.
  [{min:0,max:10,step:3,value:9.4},9,0.9],[{min:0,max:10,step:3,value:9.6},10,1],[{min:0,max:10,step:3,value:7.4},6,0.6],[{min:0,max:10,step:3,value:7.6},9,0.9],
  // Halfway between the last whole step and the far end goes up, as halfway between two steps does; and a number that rounds past the far end is the far end.
  [{min:0,max:10,step:4,value:9},10,1],[{min:0,max:10,step:4,value:8.9},8,0.8],[{min:0,max:10,step:4,value:6},8,0.8],[{min:0,max:11,step:4,value:10.4},11,1],[{min:0,max:11,step:4,value:9.4},8,8/11]])
  {const made=create(options);assert.deepEqual([made.value,made.fraction],[value,fraction],JSON.stringify(options));made.dispose();}
 // Steps of a tenth stay tenths.
 const tenths=create({min:0,max:1,step:0.1});for(let step=1;step<=10;step++){tenths.stepBy(1);assert.equal(tenths.value,step/10);}
}));

test('RC02 a press on the track moves the value there, and the same contact drags it',async()=>fixture(({create,log,down,move,up})=>{
 const range=create();
 const contact=down(100,50);
 assert.deepEqual([range.value,range.dragging],[25,true],'fifty along a track of two hundred');
 assert.deepEqual(log,[true,[25,0]],'the drag is told before the value it brings');
 move(contact,150,50);assert.equal(range.value,50);
 move(contact,151,50);assert.equal(range.value,51,'half a unit of the range for each unit of the track rounds to the nearer value');
 move(contact,150.9,50);assert.equal(range.value,50);
 // The drag goes on outside the track, and stops at the ends.
 move(contact,400,150);assert.equal(range.value,100);move(contact,0,0);assert.equal(range.value,0);
 move(contact,90,500);assert.equal(range.value,20,'only the place along the track counts');
 up(contact,90,500);
 assert.deepEqual([range.value,range.dragging],[20,false]);
 assert.deepEqual(log,[true,[25,0],[50,25],[51,50],[50,51],[100,50],[0,100],[20,0],false]);
 // A press that changes nothing is still a drag.
 log.length=0;const again=down(90,45);assert.deepEqual([log,range.dragging],[[true],true]);up(again,90,45);assert.deepEqual(log,[true,false]);
}));

test('RC03 one contact drags; a second is refused and does not end the first',async()=>fixture(({create,input,down,move,up})=>{
 const range=create();
 const first=down(100,50),second=down(200,50);
 assert.equal(range.value,25,'the second press moved nothing');
 move(second,240,50);assert.equal(range.value,25);up(second,240,50);assert.equal(range.dragging,true);
 move(first,110,50);assert.equal(range.value,30);up(first,110,50);assert.equal(range.dragging,false);
 // A contact that ends moves nothing more.
 move(first,200,50);assert.equal(range.value,30);
 // A contact the platform takes away ends its drag, and only its own.
 const third=down(150,50),fourth=down(60,50);input.cancel(fourth,'pointercancel');assert.deepEqual([range.value,range.dragging],[50,true]);
 move(third,170,50);assert.equal(range.value,60);input.cancel(third,'pointercancel');assert.equal(range.dragging,false);
 move(third,190,50);assert.equal(range.value,60);
}));

test('RC04 a track is read in its own coordinates: where it begins, a vertical one, and one that is scaled',async()=>fixture(({create,make,input,log,down,move,up})=>{
 // The track begins twenty in from the edge of its target and is a hundred long.
 const inset=create({start:20,length:100});
 let contact=down(50+20+50,50);assert.equal(inset.value,50);move(contact,55,50);assert.equal(inset.value,0);move(contact,260,50);assert.equal(inset.value,100);up(contact,260,50);inset.dispose();
 // Upward is more.
 const column=make(300,20,20,160),vertical=createRangeControl({input,target:column,axis:'y',length:160,min:0,max:8});
 contact=down(310,20+159);assert.equal(vertical.value,0);move(contact,310,20+80);assert.equal(vertical.value,4);move(contact,310,20);assert.equal(vertical.value,8);move(contact,10,20+120);assert.equal(vertical.value,2);up(contact,10,140);
 // A target drawn at twice its size: the track is still two hundred of its own units.
 const wide=make(0,100,200,20);wide.scaleX=2;
 const scaled=createRangeControl({input,target:wide,length:200});
 contact=down(100,110);assert.equal(scaled.value,25);move(contact,300,110);assert.equal(scaled.value,75);up(contact,300,110);
 // A range that does not begin at nothing.
 const offset=createRangeControl({input,target:make(0,150,100,10),length:100,min:10,max:20,step:5});
 contact=down(50,155);assert.equal(offset.value,15);move(contact,80,155);assert.equal(offset.value,20);move(contact,20,155);assert.equal(offset.value,10);up(contact,20,155);
 assert.deepEqual([offset.stepBy(1),offset.value,offset.stepBy(1),offset.value,offset.stepBy(-1),offset.value],[true,15,true,20,true,15]);
 void log;
}));

test('RC05 keys and scripts move it by steps, to its ends, and to a value',async()=>fixture(({create,log})=>{
 const range=create({min:0,max:10,step:3,value:3});
 assert.equal(range.stepBy(1),true);assert.equal(range.value,6);
 assert.equal(range.stepBy(2),true);assert.equal(range.value,10,'past the last whole step is the far end');
 assert.equal(range.stepBy(1),false);assert.equal(range.stepBy(0),false);
 assert.equal(range.stepBy(-1),true);assert.equal(range.value,9,'a step down from the far end is the last whole step');
 assert.equal(range.stepBy(1),true);assert.equal(range.value,10);
 assert.equal(range.stepBy(-2),true);assert.equal(range.value,6);
 assert.equal(range.stepBy(-5),true);assert.equal(range.value,0);assert.equal(range.stepBy(-1),false);
 assert.equal(range.toMax(),true);assert.equal(range.toMax(),false);assert.equal(range.toMin(),true);assert.equal(range.toMin(),false);
 assert.equal(range.setValue(4.4),true);assert.equal(range.value,3);assert.equal(range.setValue(3.2),false);
 assert.equal(range.setValue(1e9),true);assert.equal(range.value,10);assert.equal(range.setValue(-1e9),true);assert.equal(range.value,0);
 assert.deepEqual(log,[[6,3],[10,6],[9,10],[10,9],[6,10],[0,6],[10,0],[0,10],[3,0],[10,3],[0,10]]);
 for(const bad of [NaN,Infinity,'5',null,undefined])assert.throws(()=>range.setValue(bad),coded('UI_CONTROL_OPTIONS'));
 for(const bad of [0.5,NaN,'1',null,undefined,2**53])assert.throws(()=>range.stepBy(bad),coded('UI_CONTROL_OPTIONS'));
 assert.equal(range.value,0);
}));

test('RC06 a disabled range takes no press and no step, ends a drag, and is still set by the application',async()=>fixture(({create,log,down,move,up})=>{
 const range=create({value:50});
 const contact=down(100,50);assert.equal(range.value,25);
 range.setEnabled(false);
 assert.deepEqual([range.enabled,range.dragging],[false,false]);assert.deepEqual(log,[true,[25,50],false]);
 move(contact,150,50);up(contact,150,50);assert.equal(range.value,25);
 const other=down(180,50);assert.deepEqual([range.value,range.dragging],[25,false]);up(other,180,50);
 assert.deepEqual([range.stepBy(1),range.toMin(),range.toMax(),range.value],[false,false,false,25]);
 assert.equal(range.setValue(70),true);assert.equal(range.value,70);
 range.setEnabled(false);range.setEnabled(true);range.setEnabled(true);
 const third=down(60,50);assert.deepEqual([range.value,range.dragging],[5,true]);up(third,60,50);
 assert.throws(()=>range.setEnabled('yes'),coded('UI_CONTROL_OPTIONS'));
}));

test('RC07 a track that leaves the stage, and a control that is disposed, end the drag',async()=>fixture(({engine,create,track,log,down,move,up})=>{
 const range=create();
 let contact=down(100,50);engine.stage.removeChild(track);up(contact,100,50);
 assert.equal(range.dragging,false,'the stream of the input ends a drag the track no longer hears');
 engine.stage.addChild(track);contact=down(150,50);assert.deepEqual([range.value,range.dragging],[50,true]);
 log.length=0;range.dispose();range.dispose();
 assert.deepEqual(log,[false]);assert.equal(range.dragging,false);
 move(contact,190,50);up(contact,190,50);assert.equal(range.value,50,'nothing is heard after disposal');
 for(const call of [()=>range.setValue(1),()=>range.stepBy(1),()=>range.toMin(),()=>range.toMax(),()=>range.setEnabled(true)])assert.throws(call,coded('UI_CONTROL_CLOSED'));
 // A listener that fails when the drag ends does not keep the control from letting go.
 const failure=new Error('paint failed');let fail=false;
 const other=create({onDragChange(dragging){if(fail&&!dragging)throw failure;}});
 contact=down(60,50);fail=true;assert.throws(()=>other.dispose(),error=>error===failure);
 move(contact,190,50);assert.equal(other.value,5);up(contact,190,50);
}));

test('RC08 what is not an input, a track or a range is refused',async()=>fixture(({input,track,create})=>{
 const good={input,target:track,length:200};
 for(const bad of [undefined,null,7,{...good,input:undefined},{...good,input:null},{...good,input:{}},{...good,input:{observe(){}}},{...good,input:{events:{}}},{...good,target:undefined},{...good,target:null},{...good,target:{}},{...good,target:{on(){}}},
  {...good,axis:'z'},{...good,axis:1},{...good,start:'0'},{...good,start:NaN},{...good,length:undefined},{...good,length:0},{...good,length:-1},{...good,length:Infinity},{...good,length:'200'},
  {...good,min:'0'},{...good,max:NaN},{...good,min:5,max:5},{...good,min:6,max:5},{...good,step:0},{...good,step:-1},{...good,step:NaN},{...good,step:'1'},{...good,step:101},{...good,min:0,max:1,step:1.5},
  {...good,value:'5'},{...good,value:NaN},{...good,onChange:'log'},{...good,onDragChange:7}])
  assert.throws(()=>createRangeControl(bad),coded('UI_CONTROL_OPTIONS'),JSON.stringify(bad,(name,value)=>name==='input'||name==='target'?typeof value:value));
 // A step as wide as the whole range has two values.
 const two=create({min:0,max:5,step:5});assert.equal(two.stepBy(1),true);assert.equal(two.value,5);assert.equal(two.stepBy(-1),true);assert.equal(two.value,0);
}));

test('RC09 the usual keys of a slider: the arrows by a step, the page keys by a page, Home and End',async()=>fixture(({engine,scope,create,track})=>{
 const keyboard=createKeyboardInput({engine,scope});
 keyboard.registerTarget({id:'volume',target:track});keyboard.focus('volume');
 const press=(code,extra={})=>{const taken=keyboard.keyDown({code,key:code,...extra});keyboard.keyUp({code,key:code,...extra});return taken;};
 const range=create({value:50});
 const keys=createControlKeys({keyboard,target:track,kind:'range',control:range});
 assert.equal(keys.pressed,false);
 assert.deepEqual([press('ArrowRight'),range.value],[true,51]);assert.deepEqual([press('ArrowUp'),range.value],[true,52]);
 assert.deepEqual([press('ArrowLeft'),range.value],[true,51]);assert.deepEqual([press('ArrowDown'),range.value],[true,50]);
 assert.deepEqual([press('PageUp'),range.value],[true,60]);assert.deepEqual([press('PageDown'),press('PageDown'),range.value],[true,true,40]);
 assert.deepEqual([press('End'),range.value],[true,100]);
 // At an end the key is still the slider's, as in a native one: the page does not scroll under it.
 assert.deepEqual([press('ArrowRight'),press('PageUp'),press('End'),range.value],[true,true,true,100]);
 assert.deepEqual([press('Home'),range.value,press('ArrowLeft'),range.value],[true,0,true,0]);
 // A held key repeats.
 assert.equal(keyboard.keyDown({code:'ArrowRight',key:'ArrowRight'}),true);
 for(let repeat=0;repeat<4;repeat++)assert.equal(keyboard.keyDown({code:'ArrowRight',key:'ArrowRight',repeat:true}),true);
 keyboard.keyUp({code:'ArrowRight',key:'ArrowRight'});assert.equal(range.value,5);
 assert.deepEqual([press('Space'),press('Enter'),press('KeyD'),press('ArrowRight',{ctrlKey:true}),press('ArrowRight',{altKey:true}),press('End',{metaKey:true}),range.value],[false,false,false,false,false,false,5]);
 assert.deepEqual([press('ArrowRight',{shiftKey:true}),range.value],[true,6]);
 range.setEnabled(false);assert.deepEqual([press('ArrowRight'),press('Home'),range.value],[false,false,6]);range.setEnabled(true);
 keys.dispose();assert.deepEqual([press('ArrowRight'),range.value],[false,6]);
 // The arrows across a slider are left alone when it says which way it lies, and a page is as many steps as it says.
 const row=createControlKeys({keyboard,target:track,kind:'range',control:range,orientation:'horizontal',page:25});
 assert.deepEqual([press('ArrowUp'),press('ArrowDown'),range.value],[false,false,6]);
 assert.deepEqual([press('ArrowRight'),press('PageUp'),range.value],[true,true,32]);assert.deepEqual([press('PageDown'),range.value],[true,7]);row.dispose();
 const column=createControlKeys({keyboard,target:track,kind:'range',control:range,orientation:'vertical',page:1});
 assert.deepEqual([press('ArrowLeft'),press('ArrowRight'),range.value],[false,false,7]);
 assert.deepEqual([press('ArrowUp'),press('PageUp'),range.value],[true,true,9]);assert.deepEqual([press('ArrowDown'),range.value],[true,8]);column.dispose();
 for(const bad of [{orientation:'diagonal'},{page:0},{page:1.5},{page:'10'},{page:-1},{control:{enabled:true,stepBy(){},toMin(){}}},{control:{enabled:true,toMin(){},toMax(){}}},{onPressChange:7}])
  if(!('onPressChange' in bad))assert.throws(()=>createControlKeys({keyboard,target:track,kind:'range',control:range,...bad}),coded('UI_CONTROL_OPTIONS'),JSON.stringify(bad));
  else createControlKeys({keyboard,target:track,kind:'range',control:range,...bad}).dispose();
 keyboard.dispose();
}));

test('RC10 a slider is published with its range, lies along the line unless it says otherwise, and holds no nodes',async()=>fixture(({create})=>{
 const range=create({min:0,max:10,value:4}),semantics=createUiSemantics();
 const bounds={x:50,y:40,width:200,height:20};let extra={};
 semantics.add({id:'volume',role:'slider',onFocus(){},describe:()=>({name:'Volume',bounds,range:{now:range.value,min:range.min,max:range.max},disabled:!range.enabled,...extra})});
 let node=semantics.publish().nodes[0];
 assert.deepEqual([node.role,node.name,node.range,node.orientation,node.disabled,node.actions,node.controls],['slider','Volume',{now:4,min:0,max:10},'horizontal',false,['focus'],undefined]);
 range.stepBy(3);range.setEnabled(false);extra={orientation:'vertical'};node=semantics.publish().nodes[0];
 assert.deepEqual([node.range,node.orientation,node.disabled],[{now:7,min:0,max:10},'vertical',true]);
 // A slider needs its range, and is not a scroll bar: it scrolls nothing.
 for(const [description,field] of [[{range:undefined},'range'],[{range:{now:11,min:0,max:10}},'range'],[{controls:'other'},'controls'],[{checked:true},'checked'],[{name:''},'name']])
  {extra=description;assert.throws(()=>semantics.publish(),error=>error?.code==='UI_SEMANTICS_DESCRIPTION'&&error.cause.message==='volume: '+field,field);}
 extra={};
 assert.throws(()=>semantics.add({id:'inside',role:'text',parent:'volume',describe:()=>({name:'x',bounds})}),coded('UI_SEMANTICS_PARENT'));
}));

test('RC11 the entry has the factory, the default entry does not, and a strict consumer compiles',async()=>{
 assert.equal(Object.keys(await import('@egret/engine/ui')).includes('createRangeControl'),true);
 assert.equal('createRangeControl' in await import('@egret/engine'),false);
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/ui-range-control.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});
