// SPDX-License-Identifier: Apache-2.0
// The scroll position of a viewport on a genuine Engine: wheel, scrollbar thumb, and the methods keys call.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {createPointerInput} from '@egret/engine/input';
import {createHoverInput} from '@egret/engine/input/hover';
import {createScrollControl} from '@egret/engine/ui';
import {spawnSync} from 'node:child_process';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
// An outer viewport of 100 by 100 at the origin with an inner viewport of 60 by 40 at (10, 10), and a thumb of
// 10 by 100 at x 110 whose track runs the height of the stage.
async function fixture(run){
 const engine=await createEngine({host:host().adapter}),scope=engine.createScope();
 const make=(parent,x,y,width,height)=>{const node=scope.use(new DisplayObjectContainer());node.x=x;node.y=y;node.hitArea={x:0,y:0,width,height};node.touchEnabled=true;parent.addChild(node);return node;};
 const outer=make(engine.stage,0,0,100,100),inner=make(outer,10,10,60,40),thumb=make(engine.stage,110,0,10,100);
 const input=createPointerInput({engine,scope,width:200,height:100}),hover=createHoverInput({engine,scope,width:200,height:100});
 let clock=0;
 const wheel=(x,y,extra={})=>hover.wheel({globalX:x,globalY:y,deltaX:0,deltaY:0,unit:'pixel',timestamp:++clock,...extra});
 const down=(x,y,id=1)=>input.begin({pointerId:id,pointerType:'mouse',globalX:x,globalY:y,buttons:1,timestamp:++clock});
 const drag=(session,x,y)=>input.move(session,{globalX:x,globalY:y,buttons:1,timestamp:++clock});
 const up=(session,x,y)=>input.end(session,{globalX:x,globalY:y,buttons:0,timestamp:++clock});
 try{await run({engine,scope,outer,inner,thumb,input,hover,wheel,down,drag,up});}finally{hover.dispose();input.dispose();await engine.dispose();}
}

test('SR01 the offset stays within the content that does not fit, and each change is reported once',async()=>fixture(()=>{
 const seen=[];
 const scroll=createScrollControl({viewportLength:100,contentLength:250,offset:20,onScroll:value=>seen.push(value)});
 assert.equal(scroll.axis,'y');assert.equal(scroll.offset,20);assert.equal(scroll.maximum,150);assert.equal(scroll.viewportLength,100);assert.equal(scroll.contentLength,250);
 assert.equal(scroll.thumb,undefined);assert.equal(scroll.dragging,false);assert.equal(scroll.enabled,true);assert.ok(Object.isFrozen(scroll));
 assert.equal(scroll.scrollTo(60),true);assert.equal(scroll.scrollTo(60),false);
 assert.equal(scroll.scrollBy(1000),true);assert.equal(scroll.offset,150);assert.equal(scroll.scrollBy(5),false);
 assert.equal(scroll.scrollTo(-5),true);assert.equal(scroll.offset,0);assert.equal(scroll.toStart(),false);
 assert.equal(scroll.toEnd(),true);assert.equal(scroll.toStart(),true);
 assert.deepEqual(seen,[60,150,0,150,0]);
 for(const value of [Number.NaN,Infinity,'5',undefined])assert.throws(()=>scroll.scrollTo(value),coded('UI_CONTROL_OPTIONS'));
 assert.throws(()=>scroll.scrollBy(Number.NaN),coded('UI_CONTROL_OPTIONS'));
 assert.equal(seen.length,5);
 // An initial offset beyond the range is clamped without a report.
 assert.equal(createScrollControl({viewportLength:100,contentLength:120,offset:500}).offset,20);
 assert.equal(createScrollControl({viewportLength:100,contentLength:80,offset:5}).offset,0);
}));

test('SR02 a line is one wheel line and a page is the viewport less one line',async()=>fixture(({outer,hover})=>{
 const scroll=createScrollControl({viewportLength:100,contentLength:1000,wheel:{hover,target:outer,lineLength:16}});
 assert.equal(scroll.line(1),true);assert.equal(scroll.offset,16);
 assert.equal(scroll.page(1),true);assert.equal(scroll.offset,100);
 assert.equal(scroll.page(-1),true);assert.equal(scroll.line(-1),true);assert.equal(scroll.offset,0);
 assert.equal(scroll.line(-1),false);assert.equal(scroll.page(-1),false);
 // Without a wheel a line is 40, and a page of a short viewport is never less than a line.
 const plain=createScrollControl({viewportLength:30,contentLength:1000});
 plain.line(1);assert.equal(plain.offset,40);plain.page(1);assert.equal(plain.offset,80);
}));

test('SR03 new lengths clamp the offset and report only a change',async()=>fixture(()=>{
 const seen=[];
 const scroll=createScrollControl({viewportLength:100,contentLength:300,offset:200,onScroll:value=>seen.push(value)});
 scroll.setLengths(100,400);assert.equal(scroll.offset,200);assert.equal(scroll.maximum,300);
 scroll.setLengths(150,300);assert.equal(scroll.offset,150);
 scroll.setLengths(150,100);assert.equal(scroll.offset,0);assert.equal(scroll.maximum,0);
 assert.equal(scroll.scrollBy(10),false);
 assert.deepEqual(seen,[150,0]);
 for(const [viewport,content] of [[0,10],[-1,10],[Number.NaN,10],[10,-1],[10,Infinity],['10',10]])assert.throws(()=>scroll.setLengths(viewport,content),coded('UI_CONTROL_OPTIONS'));
 assert.equal(scroll.viewportLength,150);assert.equal(scroll.contentLength,100);
}));

test('SR04 a wheel over the viewport scrolls it by the unit the platform reported, and is consumed only when it moved',async()=>fixture(({outer,hover,wheel})=>{
 const scroll=createScrollControl({viewportLength:100,contentLength:400,wheel:{hover,target:outer,lineLength:20}});
 assert.equal(wheel(50,80,{deltaY:30}),true);assert.equal(scroll.offset,30);
 assert.equal(wheel(50,80,{deltaY:2,unit:'line'}),true);assert.equal(scroll.offset,70);
 assert.equal(wheel(50,80,{deltaY:1,unit:'page'}),true);assert.equal(scroll.offset,170);
 assert.equal(wheel(50,80,{deltaY:-1000}),true);assert.equal(scroll.offset,0);
 // At either end, and for the other axis, the wheel is left to whatever is outside.
 assert.equal(wheel(50,80,{deltaY:-10}),false);
 assert.equal(wheel(50,80,{deltaX:50}),false);assert.equal(scroll.offset,0);
 // The zoom gesture of the platform is not a scroll, and a wheel elsewhere is not this viewport's.
 assert.equal(wheel(50,80,{deltaY:30,zoom:true}),false);assert.equal(wheel(150,50,{deltaY:30}),false);assert.equal(scroll.offset,0);
 const across=createScrollControl({axis:'x',viewportLength:100,contentLength:400,wheel:{hover,target:outer}});
 assert.equal(wheel(50,80,{deltaX:25}),true);assert.equal(across.offset,25);assert.equal(scroll.offset,0);
}));

test('SR05 an inner viewport takes the wheel while it can move, then hands it to the outer one',async()=>fixture(({outer,inner,hover,wheel})=>{
 const outside=createScrollControl({viewportLength:100,contentLength:300,wheel:{hover,target:outer}});
 const inside=createScrollControl({viewportLength:40,contentLength:100,wheel:{hover,target:inner}});
 assert.equal(wheel(20,20,{deltaY:50}),true);assert.deepEqual([inside.offset,outside.offset],[50,0]);
 assert.equal(wheel(20,20,{deltaY:50}),true);assert.deepEqual([inside.offset,outside.offset],[60,0]);
 assert.equal(wheel(20,20,{deltaY:50}),true);assert.deepEqual([inside.offset,outside.offset],[60,50]);
 assert.equal(wheel(20,20,{deltaY:-20}),true);assert.deepEqual([inside.offset,outside.offset],[40,50]);
 // A disabled inner viewport lets the wheel through at once.
 inside.setEnabled(false);
 assert.equal(wheel(20,20,{deltaY:10}),true);assert.deepEqual([inside.offset,outside.offset],[40,60]);
}));

test('SR06 the thumb is as long as the share of the content that is visible, and stands where the offset is',async()=>fixture(({thumb,input})=>{
 const scroll=createScrollControl({viewportLength:100,contentLength:400,thumb:{input,target:thumb,trackLength:100}});
 assert.deepEqual(scroll.thumb,{start:0,length:25});assert.ok(Object.isFrozen(scroll.thumb));
 scroll.scrollTo(150);assert.deepEqual(scroll.thumb,{start:37.5,length:25});
 scroll.toEnd();assert.deepEqual(scroll.thumb,{start:75,length:25});
 // A long content keeps a thumb that can still be caught; a content that fits fills the track.
 scroll.setLengths(100,100000);assert.equal(scroll.thumb.length,16);
 scroll.setLengths(100,50);assert.deepEqual(scroll.thumb,{start:0,length:100});
 const small=createScrollControl({viewportLength:100,contentLength:400,thumb:{input,target:thumb,trackLength:10,minimumLength:30}});
 assert.equal(small.thumb.length,10);
}));

test('SR07 one contact drags the thumb along its track, and the offset follows in proportion',async()=>fixture(({thumb,input,down,drag,up})=>{
 const seen=[],drags=[];
 const scroll=createScrollControl({viewportLength:100,contentLength:400,thumb:{input,target:thumb,trackLength:100},onScroll:value=>seen.push(value),onDragChange:value=>drags.push(value)});
 const session=down(115,10);assert.equal(scroll.dragging,true);
 // The thumb travels 75 units for 300 of offset: four of offset for each unit of the pointer.
 drag(session,115,20);assert.equal(scroll.offset,40);
 drag(session,180,35);assert.equal(scroll.offset,100);
 drag(session,115,500);assert.equal(scroll.offset,300);
 drag(session,115,-500);assert.equal(scroll.offset,0);
 // A second contact on the thumb neither takes over nor ends the drag.
 const second=down(115,50,2);drag(second,115,90);assert.equal(scroll.offset,0);up(second,115,90);assert.equal(scroll.dragging,true);
 drag(session,115,15);up(session,115,15);
 assert.equal(scroll.dragging,false);assert.equal(scroll.offset,20);
 drag(session,115,60);assert.equal(scroll.offset,20);
 assert.deepEqual(drags,[true,false]);assert.deepEqual(seen,[40,100,300,0,20]);
 // A later drag continues from where the offset stands, not from the start.
 scroll.scrollTo(100);
 const later=down(115,40,4);drag(later,115,45);assert.equal(scroll.offset,120);drag(later,115,20);assert.equal(scroll.offset,20);up(later,115,20);
 // A drag along the other axis reads the other coordinate.
 scroll.dispose();
 const across=createScrollControl({axis:'x',viewportLength:50,contentLength:100,thumb:{input,target:thumb,trackLength:10,minimumLength:5}});
 const third=down(112,10,3);drag(third,114,90);assert.equal(across.offset,20);up(third,114,90);
 across.dispose();
 // A thumb that fills its track has nowhere to travel: a drag of it moves nothing, whether or not the content fits.
 for(const [contentLength,minimumLength] of [[40,16],[400,200]]){
  const full=createScrollControl({viewportLength:50,contentLength,offset:contentLength>50?30:0,thumb:{input,target:thumb,trackLength:100,minimumLength}});
  assert.equal(full.thumb.length,100);
  const held=down(115,10,5);drag(held,115,60);assert.equal(full.offset,contentLength>50?30:0);up(held,115,60);
  full.dispose();
 }
}));

test('SR08 a drag ends when its contact is cancelled, when the thumb leaves the stage, and when the control is disabled',async()=>fixture(({engine,thumb,input,down,drag})=>{
 const drags=[];
 const scroll=createScrollControl({viewportLength:100,contentLength:400,thumb:{input,target:thumb,trackLength:100},onDragChange:value=>drags.push(value)});
 let session=down(115,10);input.cancel(session,'pointercancel');assert.equal(scroll.dragging,false);
 session=down(115,10);engine.stage.removeChild(thumb);input.sync();assert.equal(scroll.dragging,false);
 engine.stage.addChild(thumb);
 session=down(115,10);scroll.setEnabled(false);assert.equal(scroll.dragging,false);assert.equal(scroll.enabled,false);
 drag(session,115,60);assert.equal(scroll.offset,0);
 // Disabled: no drag begins and nothing scrolls.
 input.cancel(session,'pointercancel');down(115,10,2);assert.equal(scroll.dragging,false);
 assert.equal(scroll.scrollTo(50),false);assert.equal(scroll.line(1),false);assert.equal(scroll.toEnd(),false);
 scroll.setLengths(100,500);assert.equal(scroll.maximum,400);
 scroll.setEnabled(true);assert.equal(scroll.scrollTo(50),true);
 assert.deepEqual(drags,[true,false,true,false,true,false]);
 // Nothing is reported for a drag that was not there.
 scroll.setEnabled(false);scroll.setEnabled(true);scroll.dispose();
 assert.equal(drags.length,6);
 assert.throws(()=>scroll.setEnabled('no'),coded('UI_CONTROL_CLOSED'));
}));

test('SR09 a disposed control lets go of its targets and refuses every method',async()=>fixture(({outer,thumb,input,hover,wheel,down})=>{
 const drags=[];
 const scroll=createScrollControl({viewportLength:100,contentLength:400,wheel:{hover,target:outer},thumb:{input,target:thumb,trackLength:100},onDragChange:value=>drags.push(value)});
 down(115,10);scroll.dispose();scroll.dispose();
 assert.deepEqual(drags,[true,false]);assert.equal(scroll.dragging,false);
 assert.equal(wheel(50,80,{deltaY:30}),false);down(115,10,2);assert.equal(scroll.offset,0);assert.equal(scroll.dragging,false);
 for(const action of [()=>scroll.scrollTo(1),()=>scroll.scrollBy(1),()=>scroll.line(1),()=>scroll.page(1),()=>scroll.toStart(),()=>scroll.toEnd(),()=>scroll.setLengths(1,1),()=>scroll.setEnabled(true)])assert.throws(action,coded('UI_CONTROL_CLOSED'));
 // What it reads stays readable.
 assert.equal(scroll.maximum,300);assert.deepEqual(scroll.thumb,{start:0,length:25});
}));

test('SR10 only sound options are admitted',async()=>fixture(({outer,thumb,input,hover})=>{
 const good={viewportLength:100,contentLength:400};
 const bad=[null,[],{},{...good,viewportLength:0},{...good,viewportLength:-1},{...good,contentLength:-1},{...good,contentLength:Number.NaN},{...good,offset:-1},{...good,offset:'0'},{...good,axis:'z'},{...good,onScroll:1},{...good,onDragChange:1},
  {...good,wheel:null},{...good,wheel:{target:outer}},{...good,wheel:{hover,target:{}}},{...good,wheel:{hover:{},target:outer}},{...good,wheel:{hover,target:outer,lineLength:0}},
  {...good,thumb:null},{...good,thumb:{target:thumb,trackLength:10}},{...good,thumb:{input,target:{},trackLength:10}},{...good,thumb:{input:{},target:thumb,trackLength:10}},{...good,thumb:{input,target:thumb}},{...good,thumb:{input,target:thumb,trackLength:0}},{...good,thumb:{input,target:thumb,trackLength:10,minimumLength:-1}}];
 for(const value of bad)assert.throws(()=>createScrollControl(value),coded('UI_CONTROL_OPTIONS'),JSON.stringify(value));
}));

test('SR11 a strict consumer compiles against the control, and six misuses are refused',()=>{
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/ui-scroll-control.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});

test('SR12 a failing callback is the caller\'s to hear, and the control stays usable',async()=>fixture(({thumb,input,down,drag})=>{
 const failure=new Error('scroll');let fail=true;
 const scroll=createScrollControl({viewportLength:100,contentLength:400,thumb:{input,target:thumb,trackLength:100},onScroll:()=>{if(fail)throw failure;}});
 assert.throws(()=>scroll.scrollTo(10),error=>error===failure);
 // The offset it reported is the offset it holds.
 assert.equal(scroll.offset,10);
 fail=false;assert.equal(scroll.scrollTo(20),true);
 // Thrown inside a routed event, it closes the contact input as any listener failure does.
 fail=true;const session=down(115,10);
 assert.throws(()=>drag(session,115,20),error=>error.code==='POINTER_INPUT_CALLBACK_FAILED');
 assert.equal(input.state,'closed');assert.equal(scroll.dragging,false);
}));

test('SR13 a failure while a drag ends is heard through the release that ended it',async()=>fixture(({thumb,input,down,up})=>{
 const failure=new Error('drag');
 const scroll=createScrollControl({viewportLength:100,contentLength:400,thumb:{input,target:thumb,trackLength:100},onDragChange:dragging=>{if(!dragging)throw failure;}});
 const session=down(115,10);
 assert.throws(()=>up(session,115,10),error=>error.code==='POINTER_INPUT_CALLBACK_FAILED'&&error.cause===failure);
 assert.equal(scroll.dragging,false);
 assert.throws(()=>scroll.setEnabled('no'),coded('UI_CONTROL_OPTIONS'));
}));
