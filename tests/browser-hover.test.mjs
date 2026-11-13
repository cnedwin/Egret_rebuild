// SPDX-License-Identifier: Apache-2.0
// The browser adapter of hover and wheel against a test-owned stand-in for the page. It shows what
// the adapter does with the events it is given. What a real browser gives it is checked separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,DisplayObjectContainer} from '@egret/engine';
import {host} from './helpers.mjs';
import {spawnSync} from 'node:child_process';
import {createBrowserHoverInput} from '@egret/engine/web/hover';

const plain={transform:'none',perspective:'none',translate:'none',rotate:'none',scale:'none',zoom:'normal','object-fit':'fill',
 'padding-top':'0px','padding-right':'0px','padding-bottom':'0px','padding-left':'0px','border-top-width':'0px','border-right-width':'0px','border-bottom-width':'0px','border-left-width':'0px'};
const coded=code=>error=>error?.code===code;
/** A page with one canvas of 200 by 160 CSS pixels at (10, 20), inside a body. */
function page(){
 const listeners=[];
 class Target extends EventTarget {
  addEventListener(type,listener,options){listeners.push({target:this,type,listener,options,removed:false});super.addEventListener(type,listener,options);}
  removeEventListener(type,listener,options){for(const pair of listeners)if(pair.target===this&&pair.type===type&&pair.listener===listener)pair.removed=true;super.removeEventListener(type,listener,options);}
 }
 const document=Object.assign(new Target(),{nodeType:9,visibilityState:'visible'});
 const body=Object.assign(new Target(),{nodeType:1,parentNode:document,css:{}});
 const state={rect:{left:10,top:20,width:200,height:160},measured:0};
 const canvas=Object.assign(new Target(),{nodeType:1,parentNode:body,ownerDocument:document,isConnected:true,css:{},getBoundingClientRect(){state.measured++;return {...state.rect};}});
 const window=Object.assign(new Target(),{visualViewport:new Target(),getComputedStyle:node=>({getPropertyValue:name=>node.css[name]??plain[name]??''})});
 let time=0;
 /** Dispatches one event and returns it. Positions are CSS pixels of the page. */
 function emit(target,type,values={}){
  const event=new Event(type,{cancelable:true});
  const {timeStamp=++time,...rest}=values;
  Object.defineProperty(event,'timeStamp',{value:timeStamp});
  Object.assign(event,{pointerId:1,pointerType:'mouse',buttons:0,clientX:0,clientY:0,deltaX:0,deltaY:0,deltaZ:0,deltaMode:0,ctrlKey:false,...rest});
  target.dispatchEvent(event);
  return event;
 }
 return {document,body,canvas,window,state,listeners,emit,live:()=>listeners.filter(pair=>!pair.removed)};
}
// Logical 100 by 100 on a canvas of 200 by 160: region a covers CSS x 10..90, region b covers 130..210, both y 20..84.
const over={a:{clientX:30,clientY:36},b:{clientX:150,clientY:36},none:{clientX:110,clientY:36},below:{clientX:30,clientY:150}};
async function fixture(run,options={}){
 const dom=page();
 options.prepare?.(dom);
 const saved=[globalThis.window,globalThis.document];
 globalThis.window=options.window===null?undefined:dom.window;globalThis.document=dom.document;
 const diagnostics=[];
 const engine=await createEngine({host:host({surface:dom.canvas}).adapter,onDiagnostic:d=>diagnostics.push(d)});
 const scope=engine.createScope(),a=new DisplayObjectContainer(),b=new DisplayObjectContainer();
 for(const [node,x] of [[a,0],[b,60]]){scope.use(node);node.x=x;node.hitArea={x:0,y:0,width:40,height:40};node.touchEnabled=true;engine.stage.addChild(node);}
 const notices=[],wheels=[];
 const failures=[];
 const create=(extra={})=>createBrowserHoverInput({engine,scope,canvas:dom.canvas,width:100,height:100,onError:cause=>failures.push(cause),onHover:n=>{notices.push(n);options.onHover?.(n);},onWheel:n=>{wheels.push(n);return options.onWheel?.(n);},...options.input,...extra});
 const kinds=()=>notices.map(n=>n.kind+(n.reason?'/'+n.reason:'')+':'+(n.target===a?'a':'b'));
 try{await run({...dom,engine,scope,a,b,create,notices,wheels,kinds,diagnostics,failures});}
 finally{await engine.dispose();[globalThis.window,globalThis.document]=saved;}
}

test('HB01 a movement over the canvas is mapped once from CSS pixels to the stage',async()=>fixture(({canvas,create,emit,notices,kinds})=>{
 const input=create();
 emit(canvas,'pointermove',{...over.a,timeStamp:5});
 assert.deepEqual(kinds(),['enter:a']);
 assert.deepEqual(notices[0].point,{pointerId:1,pointerType:'mouse',globalX:10,globalY:10,timestamp:5,sequence:1,viewportRevision:0});
 // The far corner of the canvas is still the stage, below both regions.
 emit(canvas,'pointermove',{clientX:209.9,clientY:99.9,timeStamp:6});
 assert.equal(notices.at(-1).point.globalX,(209.9-10)*100/200);assert.equal(notices.at(-1).point.globalY,(99.9-20)*100/160);
 emit(canvas,'pointermove',over.none);emit(canvas,'pointermove',{...over.b,pointerId:4,pointerType:'pen'});
 assert.deepEqual(kinds(),['enter:a','leave/target:a','enter:b']);
 assert.deepEqual(input.hovers.map(h=>[h.point.pointerId,h.point.pointerType]),[[1,'mouse'],[4,'pen']]);
 // A finger does not hover, and an event without a usable identity is not one of this adapter's.
 for(const values of [{pointerType:'touch'},{pointerType:''},{pointerId:-1},{pointerId:1.5},{pointerId:undefined}])emit(canvas,'pointermove',{...over.a,pointerId:9,...values});
 assert.equal(input.hovers.length,2);assert.equal(input.state,'active');
}));

test('HB02 a pressed pointer stops hovering until it is released over the canvas',async()=>fixture(({canvas,create,emit,kinds})=>{
 create();
 emit(canvas,'pointermove',over.a);emit(canvas,'pointerdown',{...over.a,buttons:1});
 emit(canvas,'pointermove',{...over.b,buttons:1});emit(canvas,'pointermove',{...over.b,buttons:4});
 assert.deepEqual(kinds(),['enter:a','leave/contact:a']);
 emit(canvas,'pointerup',over.b);
 assert.deepEqual(kinds().slice(2),['enter:b']);
 // A press that began elsewhere and is dragged over the canvas does not hover either.
 emit(canvas,'pointermove',{...over.a,buttons:1});
 assert.deepEqual(kinds().slice(3),['leave/contact:b']);
 // Released outside while captured: the canvas still receives the event, and nothing is hovered.
 emit(canvas,'pointerup',{clientX:500,clientY:36});emit(canvas,'pointermove',{clientX:9.9,clientY:36});emit(canvas,'pointermove',{clientX:210,clientY:36});emit(canvas,'pointermove',{clientX:30,clientY:180});
 assert.equal(kinds().length,4);
}));

test('HB03 leaving the canvas, a cancelled pointer and a page that goes away end the hover with their reason',async()=>fixture(({canvas,window,document,create,emit,kinds})=>{
 const input=create();
 const enter=()=>emit(canvas,'pointermove',over.a);
 enter();emit(canvas,'pointerleave',over.a);
 enter();emit(canvas,'pointercancel',over.a);
 enter();emit(canvas,'pointermove',{clientX:500,clientY:36});
 enter();emit(window,'blur');
 enter();emit(window,'pagehide');
 enter();document.visibilityState='hidden';emit(document,'visibilitychange');
 assert.deepEqual(kinds().filter(kind=>kind.startsWith('leave')),['leave/outside:a','leave/pointercancel:a','leave/outside:a','leave/blur:a','leave/pagehide:a','leave/hidden:a']);
 // Nothing is entered while the page is hidden.
 enter();assert.deepEqual(input.hovers,[]);
 document.visibilityState='visible';emit(document,'visibilitychange');enter();assert.equal(input.hovers.length,1);
 emit(canvas,'pointerleave',{...over.a,pointerId:77});assert.equal(input.hovers.length,1);
}));

test('HB04 by default the page keeps a wheel that nothing consumed',async()=>fixture(({canvas,b,create,emit,wheels,listeners})=>{
 const input=create();
 b.on(input.events.wheel,event=>event.preventDefault());
 assert.equal(emit(canvas,'wheel',{...over.a,deltaY:120,timeStamp:3}).defaultPrevented,false);
 assert.equal(emit(canvas,'wheel',{...over.b,deltaX:-2,deltaY:3,deltaZ:1,deltaMode:1,ctrlKey:true,timeStamp:4}).defaultPrevented,true);
 assert.equal(emit(canvas,'wheel',{...over.none,deltaMode:2}).defaultPrevented,false);
 assert.deepEqual(wheels.map(n=>n.point.unit),['pixel','line','page']);
 assert.deepEqual(wheels[1].point,{globalX:70,globalY:10,deltaX:-2,deltaY:3,deltaZ:1,unit:'line',timestamp:4,zoom:true,sequence:2,viewportRevision:0});
 assert.equal(wheels[0].point.zoom,false);
 assert.equal(listeners.find(pair=>pair.type==='wheel').options.passive,false);
 // A wheel outside the mapped rectangle is not routed.
 emit(canvas,'wheel',{clientX:500,clientY:36});assert.equal(wheels.length,3);
}));

test('HB05 the page policy of the wheel: the canvas owns it, or the page always scrolls',async()=>{
 await fixture(({canvas,create,emit,wheels})=>{
  const input=create({wheelPage:'never'});
  assert.equal(emit(canvas,'wheel',over.none).defaultPrevented,true);
  assert.equal(emit(canvas,'wheel',{clientX:500,clientY:36}).defaultPrevented,true);
  input.setInteractive(false);
  assert.equal(emit(canvas,'wheel',over.a).defaultPrevented,true);
  assert.equal(wheels.length,1);
 });
 await fixture(({canvas,b,create,emit,wheels,listeners})=>{
  const input=create({wheelPage:'always'});
  b.on(input.events.wheel,event=>event.preventDefault());
  assert.equal(emit(canvas,'wheel',over.b).defaultPrevented,false);
  assert.equal(wheels[0].consumed,true);
  assert.equal(listeners.find(pair=>pair.type==='wheel').options.passive,true);
 });
 await fixture(({canvas,create,emit})=>{
  create();
  assert.equal(emit(canvas,'wheel',over.none).defaultPrevented,true);
 },{onWheel:()=>true});
 await fixture(({create,live,scope})=>{
  for(const extra of [{wheelPage:'sometimes'},{wheelPage:null},{wheelPage:1},{onError:1},{canvas:null},{canvas:undefined},{canvas:'#game'}])assert.throws(()=>create(extra),coded('HOVER_INPUT_OPTIONS_INVALID'),JSON.stringify(extra));
  // An option of the logical input is refused by it, with nothing installed.
  assert.throws(()=>create({width:0}),coded('HOVER_INPUT_OPTIONS_INVALID'));
  assert.deepEqual(live(),[]);scope.dispose();
 });
});

test('HB06 a canvas that moved or changed size is mapped anew, and what was hovered is left first',async()=>fixture(({canvas,window,state,create,emit,notices,kinds})=>{
 const input=create();
 emit(canvas,'pointermove',over.a);emit(window,'resize');
 assert.deepEqual(kinds(),['enter:a','leave/viewport:a']);assert.equal(notices[1].point.viewportRevision,0);assert.equal(input.viewportRevision,1);
 emit(canvas,'pointermove',over.a);assert.equal(notices.at(-1).point.viewportRevision,1);
 for(const [target,type] of [[window,'scroll'],[window,'orientationchange'],[window.visualViewport,'resize'],[window.visualViewport,'scroll']]){emit(target,type);emit(canvas,'pointermove',over.a);}
 assert.equal(input.viewportRevision,5);
 // A layout change that raised no event shows on the next event as a rectangle that moved.
 state.rect={left:110,top:20,width:400,height:160};
 emit(canvas,'pointermove',{clientX:150,clientY:36});
 assert.equal(input.viewportRevision,6);
 assert.deepEqual(kinds().slice(-2),['leave/viewport:a','enter:a']);
 assert.equal(notices.at(-1).point.globalX,10);
 emit(canvas,'wheel',{clientX:150,clientY:36});assert.equal(input.viewportRevision,6);
}));

test('HB07 a canvas whose mapping is not one scale and one offset is refused, and nothing stays installed',async()=>{
 const cases=[
  ['a transformed ancestor',dom=>{dom.body.css.transform='matrix(1, 0, 0, 1, 0, 0)';}],
  ['a scaled canvas',dom=>{dom.canvas.css.scale='2';}],
  ['a zoomed ancestor',dom=>{dom.body.css.zoom='1.5';}],
  ['a padded canvas',dom=>{dom.canvas.css['padding-left']='4px';}],
  ['a bordered canvas',dom=>{dom.canvas.css['border-top-width']='1px';}],
  ['a letterboxed canvas',dom=>{dom.canvas.css['object-fit']='contain';}],
  ['an empty rectangle',dom=>{dom.state.rect={left:0,top:0,width:0,height:160};}],
  ['a rectangle that is not a number',dom=>{dom.state.rect={left:Number.NaN,top:0,width:10,height:10};}],
  ['a detached canvas',dom=>{dom.canvas.isConnected=false;}],
  ['a canvas of another document',dom=>{dom.canvas.ownerDocument={};}],
  ['a canvas outside the document',dom=>{dom.body.parentNode=null;}],
  ['a surface that is not an element',dom=>{dom.canvas.getBoundingClientRect=undefined;}],
 ];
 for(const [name,prepare] of cases)await fixture(({create,live,scope})=>{
  assert.throws(()=>create(),coded('HOVER_INPUT_SURFACE_INVALID'),name);
  assert.deepEqual(live(),[],name);
  // The refused attempt left nothing owned by the Scope that would fail its disposal.
  scope.dispose();
 },{prepare});
 await fixture(({create})=>{assert.throws(()=>create(),coded('HOVER_INPUT_SURFACE_INVALID'));},{window:null});
 await fixture(({body,create})=>{body.css.zoom='1';create();});
});

test('HB08 one adapter owns a canvas at a time, and gives it back when it ends',async()=>fixture(({canvas,create,emit,live,kinds})=>{
 const first=create();
 const installed=live().length;
 assert.equal(installed,15);
 assert.throws(()=>create(),coded('HOVER_INPUT_SURFACE_BUSY'));
 assert.equal(live().length,installed);assert.equal(first.state,'active');
 emit(canvas,'pointermove',over.a);
 first.dispose();
 assert.deepEqual(kinds(),['enter:a','leave/dispose:a']);assert.deepEqual(live(),[]);
 emit(canvas,'pointermove',over.a);emit(canvas,'wheel',over.a);assert.equal(kinds().length,2);
 const second=create();
 emit(canvas,'pointermove',over.b);assert.equal(kinds().at(-1),'enter:b');assert.equal(second.hovers.length,1);
}));

test('HB09 the Scope and the Engine remove every listener',async()=>{
 await fixture(({scope,create,live})=>{const input=create();scope.dispose();assert.equal(input.state,'closed');assert.deepEqual(live(),[]);});
 await fixture(async({engine,create,live})=>{const input=create();await engine.dispose();assert.equal(input.state,'closed');assert.deepEqual(live(),[]);});
});

test('HB10 one pointer too many is reported and the others go on hovering',async()=>fixture(({canvas,create,emit,failures,kinds})=>{
 const input=create({capacity:1});
 emit(canvas,'pointermove',over.a);emit(canvas,'pointermove',{...over.b,pointerId:2,pointerType:'pen'});
 assert.equal(input.state,'active');assert.equal(input.hovers.length,1);
 assert.deepEqual(failures.map(cause=>cause.code),['HOVER_INPUT_CAPACITY']);
 emit(canvas,'pointermove',over.b);assert.deepEqual(kinds(),['enter:a','leave/target:a','enter:b']);
}));

test('HB11 a failing listener closes the input, removes the listeners and is reported once',async()=>{
 const failure=new Error('listener');
 await fixture(({canvas,create,emit,live,failures})=>{
  const input=create();
  emit(canvas,'pointermove',over.a);
  assert.equal(input.state,'closed');assert.deepEqual(live(),[]);
  assert.deepEqual(failures.map(cause=>[cause.code,cause.cause]),[['HOVER_INPUT_CALLBACK_FAILED',failure]]);
  emit(canvas,'pointermove',over.b);assert.equal(failures.length,1);
 },{onHover:()=>{throw failure;}});
 // Without a callback the page is told, as it is of any uncaught error.
 await fixture(({canvas,create,emit})=>{
  const told=[],saved=globalThis.reportError;
  globalThis.reportError=cause=>told.push(cause);
  try{
   const input=create({onError:undefined});
   emit(canvas,'pointermove',over.a);
   assert.equal(input.state,'closed');assert.deepEqual(told.map(cause=>cause.code),['HOVER_INPUT_CALLBACK_FAILED']);
  }finally{globalThis.reportError=saved;}
 },{onHover:()=>{throw failure;}});
 // An event the platform should not produce is treated the same way.
 await fixture(({canvas,create,emit,live,failures})=>{
  const input=create();
  emit(canvas,'wheel',{...over.a,deltaMode:7});
  assert.equal(input.state,'closed');assert.deepEqual(live(),[]);assert.deepEqual(failures.map(cause=>cause.code),['HOVER_INPUT_EVENT_INVALID']);
 });
 await fixture(({canvas,create,emit,failures})=>{
  const input=create();
  emit(canvas,'pointermove',{clientX:Number.NaN,clientY:36});
  assert.equal(input.state,'closed');assert.deepEqual(failures.map(cause=>cause.code),['HOVER_INPUT_EVENT_INVALID']);
 });
});

test('HB12 a lost context suspends the input; resuming is left to the application',async()=>fixture(({canvas,create,emit,kinds})=>{
 const input=create();
 emit(canvas,'pointermove',over.a);emit(canvas,'webglcontextlost');
 assert.equal(input.state,'suspended');assert.deepEqual(kinds(),['enter:a','leave/suspended:a']);
 emit(canvas,'pointermove',over.a);assert.equal(kinds().length,2);
 input.setInteractive(true);emit(canvas,'pointermove',over.a);assert.equal(kinds().at(-1),'enter:a');
}));

test('HB13 a clock of the platform that steps back is not passed on as a refused sample',async()=>fixture(({canvas,create,emit,notices})=>{
 const input=create();
 emit(canvas,'pointermove',{...over.a,timeStamp:50});emit(canvas,'pointermove',{...over.b,timeStamp:40});emit(canvas,'wheel',{...over.b,timeStamp:-3});
 emit(canvas,'pointermove',{...over.a,timeStamp:Number.NaN});
 assert.equal(input.state,'active');
 assert.deepEqual(notices.map(n=>n.point.timestamp),[50,50,50,50,50]);
}));

test('HB14 a strict consumer compiles against both entries, and seven misuses are refused',()=>{
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/hover.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
});

test('HB15 each entry exports its factory and nothing else, and no other entry has either',async()=>{
 assert.deepEqual(Object.keys(await import('@egret/engine/input/hover')),['createHoverInput']);
 assert.deepEqual(Object.keys(await import('@egret/engine/web/hover')),['createBrowserHoverInput']);
 for(const entry of ['@egret/engine','@egret/engine/input','@egret/engine/web/pointer','@egret/engine/web/input','@egret/engine/web/keyboard','@egret/engine/webgl2','@egret/engine/webgpu','@egret/engine/ui','@egret/runtime','@egret/runtime/input']){
  const values=await import(entry);
  assert.equal('createHoverInput' in values,false,entry);assert.equal('createBrowserHoverInput' in values,false,entry);
 }
});
