import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import * as egret from '@egret/engine';
import {createCanvasHost} from '@egret/engine/web';
import {host as headlessHost} from './helpers.mjs';
import * as copier from '../packages/engine/dist/web/copyCanvasFrame.js';
import {ImageProjectionError} from '../packages/engine/dist/web/imageProjections2D.js';
let createCanvasImageProjection,projectionFault;
try { ({createCanvasImageProjection}=await import('../packages/engine/dist/web/canvasImageProjection.js')); }
catch(cause) { projectionFault=cause; }

const identity=()=>({a:1,b:0,c:0,d:1,tx:0,ty:0});
const region=(x=0,y=0,width=1,height=1)=>({x,y,width,height});
const rectangle=()=>({kind:'rect',matrix:identity(),rect:{x:0,y:0,width:2,height:2},color:0x123456,alpha:0.75,clips:[]});
const imageCommand=(imageIndex=0,sourceRect=region(),extra={})=>({kind:'image',matrix:identity(),rect:{x:0,y:0,width:2,height:2},alpha:0.5,clips:[],imageIndex,sourceRect,...extra});
const pixels=[9,8,7,255,6,5,4,254,3,2,1,1,255,127,1,128,1,128,255,127,255,99,33,0];
const image=(w=1,h=1,bytes=new Uint8Array(4*w*h))=>egret.createImageData2D({width:w,height:h,pixels:bytes});
const frame=(commands=[imageCommand()],images=[image()])=>({frameId:1,width:8,height:8,clearColor:0xabcdef,clearAlpha:0.25,commands,images});
const code=expected=>e=>e.code===expected;
const getter=(object,key,body)=>Object.defineProperty(object,key,{configurable:true,get:body});
function globalValue(name,value,body){const old=Object.getOwnPropertyDescriptor(globalThis,name);Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});try{return body();}finally{if(old)Object.defineProperty(globalThis,name,old);else delete globalThis[name];}}
function fixture(){
  const calls=[],privateCalls=[],canvases=[];
  const faults=new Map(),overrides=new Map();
  const op=(name,...args)=>{const hook=faults.get(name);if(hook)hook(...args);return overrides.has(name)?overrides.get(name):undefined;};
  const context={isContextLost(){return op('target.loss')??false;},getContextAttributes(){op('target.attributes');return overrides.has('target.color')?overrides.get('target.color'):{colorSpace:'srgb'};}};
  for(const name of ['setTransform','save','restore','beginPath','rect','clip','clearRect','fillRect','drawImage'])context[name]=(...args)=>{op('target.'+name,...args);calls.push([name,...args]);};
  for(const name of ['globalAlpha','globalCompositeOperation','fillStyle','shadowColor','shadowBlur','shadowOffsetX','shadowOffsetY','filter','imageSmoothingEnabled']){
    let current;Object.defineProperty(context,name,{configurable:true,get:()=>current,set:value=>{op('target.'+name,value);current=value;calls.push([name,value]);}});
  }
  const ownerDocument={createElement(tag){op('private.createElement',tag);privateCalls.push(['createElement',tag]);const index=canvases.length;let width=0,height=0;
    const privateContext={getContextAttributes(){op('private.attributes');privateCalls.push(['attributes',index]);return overrides.has('private.color')?overrides.get('private.color'):{colorSpace:'srgb'};},putImageData(data,x,y){op('private.putImageData',data);privateCalls.push(['putImageData',index,data,x,y]);}};
    const canvas={getContext(kind,settings){op('private.getContext');privateCalls.push(['getContext',index,kind,settings]);return overrides.has('private.context')?overrides.get('private.context'):privateContext;},get width(){op('private.width.get');return overrides.has('private.width.read')?overrides.get('private.width.read'):width;},set width(value){op('private.width.set');width=value;privateCalls.push(['width',index,value]);},get height(){op('private.height.get');return height;},set height(value){op('private.height.set');height=value;privateCalls.push(['height',index,value]);}};
    canvases.push(canvas);return canvas;
  }};
  let width=0,height=0;
  const canvas={getContext:()=>context,get ownerDocument(){op('target.ownerDocument');return ownerDocument;},get width(){op('target.width.get');return overrides.has('target.width.read')?overrides.get('target.width.read'):width;},set width(value){op('target.width.set');width=value;calls.push(['width',value]);},get height(){op('target.height.get');return height;},set height(value){op('target.height.set');height=value;calls.push(['height',value]);}};
  class FakeImageData{constructor(data,w,h,settings){op('ImageData.constructor',data);privateCalls.push(['ImageData',data,w,h,settings]);this.data=data;this.width=w;this.height=h;this._color='srgb';}get colorSpace(){op('ImageData.colorSpace');return overrides.has('ImageData.color')?overrides.get('ImageData.color'):this._color;}}
  const host=createCanvasHost({canvas});host.start();
  return {calls,privateCalls,canvases,faults,overrides,canvas,context,ownerDocument,host,FakeImageData,run(body){return globalValue('ImageData',FakeImageData,body);}};
}
function noMutation(f){assert.deepEqual(f.calls,[]);}
function assertReusable(f){f.faults.clear();f.overrides.clear();f.run(()=>f.host.renderFrame(frame()));assert.equal(f.calls[0][0],'width');}
const internalCauses=()=>[new egret.EgretError('CANVAS_FRAME_BUDGET'),new ImageProjectionError('budget'),...(copier.CanvasImageCopyError?[new copier.CanvasImageCopyError('budget')]:[]),{reason:'budget'}];

// Missing private ports, a second caller traversal, and changed late-backing order fail these witnesses.
test('rect_only_read_trace_and_errors_are_identical',()=>{
  const reads=[];
  const watched=(value,label)=>new Proxy(value,{get(t,k,r){reads.push(label+'.'+String(k));return Reflect.get(t,k,r);}});
  const clip=watched({matrix:watched(identity(),'clip.matrix'),rect:watched({x:3,y:4,width:5,height:6},'clip.rect')},'clip');
  const clips=[];clips[Symbol.iterator]=function*(){reads.push('clip.iterator');yield clip;};
  const cmd=watched({...rectangle(),matrix:watched(identity(),'matrix'),rect:watched({x:1,y:2,width:3,height:4},'rect'),clips},'command');
  const commands=[];commands[Symbol.iterator]=function*(){reads.push('commands.iterator');yield cmd;};
  const raw=watched(frame(commands,undefined),'frame');getter(raw,'images',()=>{throw Error('unread');});
  const copied=copier.copyCanvasFrame(raw,1.5,1000);
  assert.deepEqual(reads,['frame.frameId','frame.width','frame.height','frame.clearColor','frame.clearAlpha','frame.commands','commands.iterator','command.kind','command.matrix','matrix.a','matrix.b','matrix.c','matrix.d','matrix.tx','matrix.ty','command.rect','rect.x','rect.y','rect.width','rect.height','command.color','command.alpha','command.clips','clip.iterator','clip.matrix','clip.matrix.a','clip.matrix.b','clip.matrix.c','clip.matrix.d','clip.matrix.tx','clip.matrix.ty','clip.rect','clip.rect.x','clip.rect.y','clip.rect.width','clip.rect.height']);
  assert.equal(copied.width,12);assert.equal(Object.hasOwn(copied.frame,'images'),false);assert.equal(copied.frame.commands[0].clips[0].rect.x,3);
  const early=frame([{kind:'other'}]);early.width=1e20;assert.throws(()=>copier.copyCanvasFrame(early,1,1),code('CANVAS_FRAME_INVALID'));
  let imageReads=0;const rejected=frame();getter(rejected,'images',()=>{imageReads++;throw Error('table');});assert.throws(()=>copier.copyCanvasFrame(rejected,1,100),code('CANVAS_FRAME_INVALID'));assert.equal(imageReads,0);
});
test('private_projection_ports_are_present',()=>{assert.equal(typeof createCanvasImageProjection,'function',String(projectionFault));assert.equal(typeof copier.copyCanvasMixedFrame,'function');assert.equal(typeof copier.CanvasImageCopyError,'function');});
test('pure rectangles never read introduced native colour or document APIs',()=>{
  const f=fixture();for(const key of ['ownerDocument'])getter(f.canvas,key,()=>{throw Error(key);});getter(f.context,'getContextAttributes',()=>{throw Error('attributes');});
  globalValue('ImageData',undefined,()=>f.host.renderFrame(frame([rectangle()],undefined)));assert.ok(f.calls.some(c=>c[0]==='fillRect'));
});
test('a kind getter failing before actual image observation retains every legacy error origin',()=>{
  for(const cause of internalCauses()){
    const f=fixture(),raw=frame([rectangle(),imageCommand()]);getter(raw.commands[0],'kind',()=>{throw cause;});
    assert.throws(()=>f.host.renderFrame(raw),e=>cause instanceof egret.EgretError?e===cause:e.code==='CANVAS_RENDER_FAILED'&&e.cause===cause);noMutation(f);
    f.host.renderFrame(frame([rectangle()],undefined));
  }
});
test('post-image property reads preserve internal-looking causes without native or budget promotion',()=>{
  for(const site of ['images','matrix','rect','alpha','clips','imageIndex','sourceRect'])for(const cause of internalCauses()){
    const f=fixture(),raw=frame();getter(site==='images'?raw:raw.commands[0],site,()=>{throw cause;});
    assert.throws(()=>f.host.renderFrame(raw),e=>e.code==='CANVAS_FRAME_INVALID'&&e.cause===cause);noMutation(f);assertReusable(f);
  }
});
test('first_image_table_read_is_once_and_authentic',()=>{
  const f=fixture(),a=image(),b=image(),reads=[];
  const table=new Proxy([a,a,b],{get(t,k,r){reads.push(String(k));if(k===Symbol.iterator)throw Error('table iterator');return Reflect.get(t,k,r);}});
  const raw=frame([imageCommand()],table);let count=0;getter(raw,'images',()=>{count++;return table;});
  f.run(()=>f.host.renderFrame(raw));assert.equal(count,1);assert.deepEqual(reads,['length','0','1','2']);assert.equal(f.canvases.length,1);
});
test('table length 65 rejects before any index read and 64 duplicates share one view',()=>{
  const f=fixture(),a=image(),reads=[];
  const table=new Proxy(Array(65).fill(a),{get(t,k,r){reads.push(String(k));if(k==='0')throw Error('too late');return Reflect.get(t,k,r);}});
  assert.throws(()=>f.host.renderFrame(frame([imageCommand()],table)),code('CANVAS_FRAME_BUDGET'));assert.deepEqual(reads,['length']);noMutation(f);assert.equal(f.canvases.length,0);
  f.run(()=>f.host.renderFrame(frame([imageCommand(63)],Array(64).fill(a))));assert.equal(f.canvases.length,1);
});
test('all unused identities authenticate before byte accounting or forged metadata reads',()=>{
  const f=fixture(),sources=Array.from({length:5},()=>image(1024,1024));let reads=0;
  const forged=new Proxy({}, {get(){reads++;throw Error('forged metadata');}});
  assert.throws(()=>f.host.renderFrame(frame([imageCommand()],[...sources,forged])),code('CANVAS_FRAME_INVALID'));assert.equal(reads,0);noMutation(f);
  const a=image(),revoked=Proxy.revocable({},{});revoked.revoke();
  for(const bad of [forged,new Proxy(a,{}),revoked.proxy,undefined])assert.throws(()=>f.host.renderFrame(frame([imageCommand()],[a,bad])),code('CANVAS_FRAME_INVALID'));
  assert.throws(()=>f.host.renderFrame(frame([imageCommand()],sources)),code('CANVAS_FRAME_BUDGET'));noMutation(f);assertReusable(f);
});
test('image fields and indexed clips snapshot once in geometry alpha clips index region order',()=>{
  const f=fixture(),reads=[],a=image(3,2),command=imageCommand(0,region(1,1,2,1)),prefix=rectangle();
  const clip={matrix:identity(),rect:{x:0,y:0,width:1,height:1}};
  command.clips=new Proxy([clip],{get(t,k,r){reads.push('clips.'+String(k));if(k===Symbol.iterator)throw Error('image iterator');return Reflect.get(t,k,r);}});
  for(const key of ['matrix','rect','alpha','clips','imageIndex','sourceRect']){const old=command[key];getter(command,key,()=>{reads.push(key);if(key==='clips'){prefix.matrix.tx=999;prefix.rect.width=999;}return old;});}
  getter(command,'color',()=>{throw Error('unread color');});
  f.run(()=>f.host.renderFrame(frame([prefix,command],[a])));
  assert.deepEqual(reads,['matrix','rect','alpha','clips','clips.length','clips.0','imageIndex','sourceRect']);
  assert.ok(f.calls.some(c=>c[0]==='fillRect'&&c[3]===2));
  const bad=imageCommand();bad.alpha=2;getter(bad,'imageIndex',()=>{throw Error('late');});assert.throws(()=>f.host.renderFrame(frame([bad],[a])),code('CANVAS_FRAME_INVALID'));
});
test('new region snapshot completes before integer validation and new minus zero normalizes',()=>{
  const raw=imageCommand(0,region(-0,-0)),a=image();let count=0;const input=frame([raw],[a]);
  const copied=copier.copyCanvasMixedFrame?.(input,1,100,()=>count++);assert.ok(copied,'mixed copier');assert.equal(count,1);assert.equal(Object.is(copied.frame.commands[0].sourceRect.x,-0),false);
  const cause=Error('late region'),bad=imageCommand(0,{x:-1,y:0,width:1,get height(){throw cause;}}),f=fixture();
  assert.throws(()=>f.host.renderFrame(frame([bad],[a])),e=>e.code==='CANVAS_FRAME_INVALID'&&e.cause===cause);noMutation(f);
});
function iteratorArray(first,mode,cause,onReturn=()=>{}){
  const array=[];array[Symbol.iterator]=()=>{let n=0;return {next(){if(n++===0)return {value:first,done:false};if(mode==='next')throw cause;return {get done(){if(mode==='done')throw cause;return false;},get value(){if(mode==='value')throw cause;return {kind:'other'};}};},get return(){onReturn();if(mode==='return-get')throw cause;return ()=>{onReturn();throw cause;};}};};return array;
}
for(const mode of ['next','done','value'])test('post-image command iterator '+mode+' preserves untrusted cause',()=>{
  for(const cause of internalCauses()){const f=fixture(),raw=frame(iteratorArray(imageCommand(),mode,cause));assert.throws(()=>f.host.renderFrame(raw),e=>e.code==='CANVAS_FRAME_INVALID'&&e.cause===cause);noMutation(f);assertReusable(f);}
});
for(const mode of ['next','done','value','getIterator'])test('legacy prefix iterator '+mode+' retains exact EgretError',()=>{
  const f=fixture(),cause=new egret.EgretError('PREFIX');let commands;
  if(mode==='getIterator'){commands=[];getter(commands,Symbol.iterator,()=>{throw cause;});}else commands=iteratorArray(rectangle(),mode,cause);
  assert.throws(()=>f.host.renderFrame(frame(commands)),e=>e===cause);noMutation(f);f.host.renderFrame(frame([rectangle()],undefined));
});
for(const mode of ['next','done','value','getIterator'])test('nested rectangle clip iterator after image '+mode+' uses source origin',()=>{
  const f=fixture(),cause=new ImageProjectionError('budget'),rect=rectangle();
  if(mode==='getIterator'){rect.clips=[];getter(rect.clips,Symbol.iterator,()=>{throw cause;});}else rect.clips=iteratorArray({matrix:identity(),rect:{x:0,y:0,width:1,height:1}},mode,cause);
  assert.throws(()=>f.host.renderFrame(frame([imageCommand(),rect])),e=>e.code==='CANVAS_FRAME_INVALID'&&e.cause===cause);noMutation(f);
});
for(const mode of ['return-get','return-call'])test('IteratorClose '+mode+' cannot override body validation',()=>{
  const f=fixture(),cause=new ImageProjectionError('budget'),commands=iteratorArray(imageCommand(),mode,cause);
  assert.throws(()=>f.host.renderFrame(frame(commands)),code('CANVAS_FRAME_INVALID'));noMutation(f);
  const g=fixture(),raw=frame(iteratorArray(imageCommand(),mode,cause,()=>g.host.close()));assert.throws(()=>g.host.renderFrame(raw),code('CANVAS_HOST_CLOSED'));noMutation(g);
});
test('image_getter_termination_beats_internal_looking_fault',async()=>{
  for(const site of ['images','length','index','alpha','iterator'])for(const cause of internalCauses()){
    const f=fixture(),a=image(),raw=frame();let closed;
    const end=()=>{closed=f.host.close();throw cause;};
    if(site==='images')getter(raw,'images',end);
    if(site==='length'||site==='index')raw.images=new Proxy([a],{get(t,k,r){if(k===(site==='length'?'length':'0'))return end();return Reflect.get(t,k,r);}});
    if(site==='alpha')getter(raw.commands[0],'alpha',end);
    if(site==='iterator')raw.commands=iteratorArray(imageCommand(),'next',cause,()=>{}),raw.commands[Symbol.iterator]=function(){let n=0;return {next(){if(n++===0)return {value:imageCommand(),done:false};return end();}};};
    assert.throws(()=>f.host.renderFrame(raw),code('CANVAS_HOST_CLOSED'));noMutation(f);await closed;
  }
  const f=fixture(),raw=frame();getter(raw.commands[0],'alpha',()=>{f.host.close();return 2;});assert.throws(()=>f.host.renderFrame(raw),code('CANVAS_HOST_CLOSED'));noMutation(f);
});
test('canvas_crop_is_private_srgb_and_single_opacity',()=>{
  const f=fixture(),source=image(3,2,new Uint8Array(pixels)),cmd=imageCommand(0,region(1,1,2,1),{rect:{x:2,y:3,width:4,height:5},matrix:{a:-1,b:0,c:0,d:1,tx:7,ty:8},clips:[{matrix:identity(),rect:{x:1,y:2,width:3,height:4}}]});
  const host=createCanvasHost({canvas:f.canvas,pixelRatio:1.5});host.start();
  f.run(()=>host.renderFrame(frame([rectangle(),cmd,rectangle(),{...cmd,alpha:0.25}],[source])));
  assert.equal(f.canvases.length,1);const data=f.privateCalls.find(c=>c[0]==='ImageData');assert.deepEqual([...data[1]],[1,128,255,127,255,99,33,0]);assert.ok(data[1] instanceof Uint8ClampedArray);assert.equal(data[1].buffer.byteLength,8);assert.deepEqual(data.slice(2),[2,1,{colorSpace:'srgb'}]);
  assert.deepEqual(f.privateCalls.slice(0,5).map(c=>[c[0],...c.slice(1)]),[['createElement','canvas'],['width',0,2],['height',0,1],['getContext',0,'2d',{colorSpace:'srgb'}],['attributes',0]]);
  assert.equal(f.privateCalls.find(c=>c[0]==='putImageData')[2].data,data[1]);
  assert.deepEqual(f.calls.filter(c=>c[0]==='fillRect'||c[0]==='drawImage').map(c=>c[0]),['fillRect','fillRect','drawImage','fillRect','drawImage']);
  const draws=f.calls.filter(c=>c[0]==='drawImage');assert.deepEqual(draws[0].slice(2),[2,3,4,5]);assert.equal(draws[0][1],draws[1][1]);assert.ok(f.calls.some(c=>c[0]==='imageSmoothingEnabled'&&c[1]===false));
  assert.ok(f.calls.some(c=>c[0]==='setTransform'&&c[1]===-1.5&&c[5]===10.5&&c[6]===12));assert.deepEqual(f.calls.filter(c=>c[0]==='globalAlpha').map(c=>c[1]),[1,0.25,0.75,0.5,0.75,0.25]);
  f.run(()=>host.renderFrame(frame([cmd],[source])));assert.equal(f.canvases.length,2);assert.notEqual(f.canvases[0],f.canvases[1]);assert.deepEqual([...egret.copyImageData2DPixels(source)],pixels);
});
test('private ImageData clamped input is a buffer view rather than another crop clone',()=>{
  const f=fixture(),Native=Uint8ClampedArray,argumentsSeen=[];
  function Clamped(...args){argumentsSeen.push(args);return new Native(...args);}
  globalValue('Uint8ClampedArray',Clamped,()=>f.run(()=>f.host.renderFrame(frame())));
  assert.equal(argumentsSeen.length,1);assert.ok(argumentsSeen[0][0] instanceof ArrayBuffer);assert.deepEqual(argumentsSeen[0].slice(1),[0,4]);const uploaded=f.privateCalls.find(c=>c[0]==='ImageData')[1];assert.equal(uploaded.buffer,argumentsSeen[0][0]);
});
test('equal-content identities do not share canvases and zero coverage views still materialize',()=>{
  const f=fixture(),a=image(2,1),b=image(2,1),zero=imageCommand(0,region(1,0),{alpha:0,rect:{x:0,y:0,width:0,height:0},matrix:{a:0,b:0,c:0,d:0,tx:0,ty:0}});
  f.run(()=>f.host.renderFrame(frame([imageCommand(),imageCommand(1),zero],[a,b,image(1024,1024)])));assert.equal(f.canvases.length,3);assert.equal(f.calls.filter(c=>c[0]==='drawImage').length,3);
});
test('borrowed ownerDocument is read once across all planned private views',()=>{
  const f=fixture();let reads=0;f.faults.set('target.ownerDocument',()=>reads++);
  f.run(()=>f.host.renderFrame(frame([imageCommand(),imageCommand(1)],[image(),image()])));assert.equal(reads,1);assert.equal(f.canvases.length,2);
});
test('128 views pass and 129 rejects before crop creation',()=>{
  const a=image(129,1),commands=Array.from({length:129},(_,x)=>imageCommand(0,region(x,0),{alpha:0})),f=fixture();
  assert.throws(()=>f.host.renderFrame(frame(commands,[a])),code('CANVAS_FRAME_BUDGET'));noMutation(f);assert.equal(f.canvases.length,0);
  f.run(()=>f.host.renderFrame(frame([...commands.slice(0,128),commands[0]],[a])));assert.equal(f.canvases.length,128);
});
test('projection and Canvas scratch ceilings admit exact boundary and reject before native setup',()=>{
  const a=Array.from({length:4},()=>image(1024,1024)),f=fixture();
  const maximum=a.map((_,i)=>imageCommand(i,region(0,0,1024,1024)));
  assert.throws(()=>f.host.renderFrame(frame(maximum,a)),code('CANVAS_FRAME_BUDGET'));noMutation(f);assert.equal(f.canvases.length,0);
  assert.throws(()=>f.host.renderFrame(frame([...maximum,imageCommand(0,region())],a)),code('CANVAS_FRAME_BUDGET'));noMutation(f);
  const exact=[...maximum.slice(0,3),imageCommand(3,region(0,0,1024,512))];f.run(()=>f.host.renderFrame(frame(exact,a)));assert.equal(f.canvases.length,4);
  const b=Array.from({length:4},()=>image(1023,1025)),g=fixture();
  const excess=[imageCommand(0,region(0,0,1023,1025)),imageCommand(1,region(0,0,1023,1025)),imageCommand(2,region(0,0,1023,1025)),imageCommand(3,region(0,0,1023,512)),imageCommand(3,region(0,0,516,1))];
  assert.throws(()=>g.host.renderFrame(frame(excess,b)),code('CANVAS_FRAME_BUDGET'));noMutation(g);assert.equal(g.canvases.length,0);assertReusable(g);
});
test('unused table values charge payload but do not become crop views',()=>{
  const a=Array.from({length:4},()=>image(1024,1024)),f=fixture();f.run(()=>f.host.renderFrame(frame([imageCommand()],a)));assert.equal(f.canvases.length,1);
  a.push(image(1024,1024));const g=fixture();assert.throws(()=>g.host.renderFrame(frame([imageCommand()],a)),code('CANVAS_FRAME_BUDGET'));noMutation(g);
});
test('invalid image indices regions clips and later source getters cannot hide behind no coverage',()=>{
  const a=image(),f=fixture();
  for(const change of [c=>c.imageIndex=-1,c=>c.imageIndex=0.5,c=>c.imageIndex=1,c=>c.sourceRect=region(0,0,0),c=>c.sourceRect=region(1,0),c=>c.sourceRect=region(0.5,0),c=>c.clips=[{matrix:identity(),rect:{x:NaN,y:0,width:0,height:0}}]]){const c=imageCommand(0,region(),{alpha:0,rect:{x:0,y:0,width:0,height:0}});change(c);assert.throws(()=>f.host.renderFrame(frame([c],[a])),code('CANVAS_FRAME_INVALID'));noMutation(f);}
  for(const table of [undefined,null,{},[a,,]])assert.throws(()=>f.host.renderFrame({...frame(),images:table}),code('CANVAS_FRAME_INVALID'));
  const revoked=Proxy.revocable([],{});revoked.revoke();assert.throws(()=>f.host.renderFrame(frame([imageCommand()],revoked.proxy)),e=>e.code==='CANVAS_FRAME_INVALID'&&e.cause instanceof TypeError);noMutation(f);
});
for(const key of ['target.color','private.color','ImageData.color'])for(const value of [undefined,{}, {colorSpace:'display-p3'}])test('unavailable sRGB '+key+' '+String(value?.colorSpace)+' is pre-target reusable',()=>{
  const f=fixture();f.overrides.set(key,key==='ImageData.color'?value?.colorSpace:value);assert.throws(()=>f.run(()=>f.host.renderFrame(frame())),code('CANVAS_RENDER_FAILED'));noMutation(f);assertReusable(f);
});
test('missing actual target/private attribute methods and private context are unsupported',()=>{
  const f=fixture();f.context.getContextAttributes=undefined;assert.throws(()=>f.run(()=>f.host.renderFrame(frame())),code('CANVAS_RENDER_FAILED'));noMutation(f);f.context.getContextAttributes=()=>({colorSpace:'srgb'});assertReusable(f);
  const g=fixture();g.overrides.set('private.context',null);assert.throws(()=>g.run(()=>g.host.renderFrame(frame())),code('CANVAS_RENDER_FAILED'));noMutation(g);assertReusable(g);
  const h=fixture();globalValue('ImageData',undefined,()=>assert.throws(()=>h.host.renderFrame(frame()),code('CANVAS_RENDER_FAILED')));noMutation(h);assertReusable(h);
});
for(const site of ['target.attributes','target.ownerDocument','private.createElement','private.width.set','private.height.set','private.width.get','private.height.get','private.getContext','private.attributes','ImageData.constructor','ImageData.colorSpace','private.putImageData'])test('native preflight origin '+site+' keeps internal-looking cause reusable',()=>{
  for(const cause of internalCauses()){const f=fixture();f.faults.set(site,()=>{throw cause;});assert.throws(()=>f.run(()=>f.host.renderFrame(frame())),e=>e.code==='CANVAS_RENDER_FAILED'&&e.cause===cause);noMutation(f);assertReusable(f);}
});
test('target method and returned attributes getters are native preflight with exact cause',()=>{
  for(const cause of internalCauses())for(const site of ['method','colorSpace']){
    const f=fixture(),original=f.context.getContextAttributes;
    if(site==='method')getter(f.context,'getContextAttributes',()=>{throw cause;});
    else f.overrides.set('target.color',{get colorSpace(){throw cause;}});
    assert.throws(()=>f.run(()=>f.host.renderFrame(frame())),e=>e.code==='CANVAS_RENDER_FAILED'&&e.cause===cause);noMutation(f);
    Object.defineProperty(f.context,'getContextAttributes',{configurable:true,writable:true,value:original});assertReusable(f);
  }
});
test('successful reentrant native preflight close is gated before target width',()=>{
  const f=fixture();f.faults.set('target.ownerDocument',()=>f.host.close());assert.throws(()=>f.run(()=>f.host.renderFrame(frame())),code('CANVAS_HOST_CLOSED'));noMutation(f);
});
test('native crop allocation throwing a public helper error is not trusted admission',()=>{
  const f=fixture(),raw=frame(),Native=Uint8Array;
  for(const cause of internalCauses())globalValue('Uint8Array',function(){throw cause;},()=>assert.throws(()=>f.run(()=>f.host.renderFrame(raw)),e=>e.code==='CANVAS_RENDER_FAILED'&&e.cause===cause));
  assert.equal(Uint8Array,Native);noMutation(f);assertReusable(f);
});
for(const mixed of [false,true])for(const site of ['target.width.set','target.height.set','target.width.get','target.globalAlpha','target.fillRect','target.restore',...(mixed?['target.drawImage']:[])])test('native_mutation_failure_is_terminal_but_input_failure_is_not '+mixed+' '+site,async()=>{
  const f=fixture(),cause=Error(site);f.faults.set(site,()=>{throw cause;});const raw=mixed?frame():frame([rectangle()],undefined);
  assert.throws(()=>f.run(()=>f.host.renderFrame(raw)),e=>e.code==='CANVAS_RENDER_FAILED'&&e.cause===cause);assert.throws(()=>f.host.renderFrame(raw),code('CANVAS_HOST_CLOSED'));assert.throws(()=>f.host.start(),code('CANVAS_HOST_CLOSED'));await f.host.close();
});
test('post-mutation backing and context-loss failures preserve first code then close',()=>{
  const f=fixture();f.overrides.set('target.width.read',0);assert.throws(()=>f.run(()=>f.host.renderFrame(frame())),code('CANVAS_BACKING_LIMIT'));assert.throws(()=>f.host.start(),code('CANVAS_HOST_CLOSED'));
  const g=fixture();let checks=0;g.faults.set('target.loss',()=>{if(++checks===2)g.overrides.set('target.loss',true);});assert.throws(()=>g.run(()=>g.host.renderFrame(frame())),code('CANVAS_CONTEXT_LOST'));assert.throws(()=>g.host.start(),code('CANVAS_HOST_CLOSED'));
});
test('mixed native target operations cannot forge a frame budget or invalid code',()=>{
  for(const site of ['target.width.set','target.height.set','target.width.get','target.imageSmoothingEnabled','target.globalAlpha','target.drawImage','target.restore'])for(const cause of internalCauses()){
    const f=fixture();f.faults.set(site,()=>{throw cause;});
    assert.throws(()=>f.run(()=>f.host.renderFrame(frame())),e=>e.code==='CANVAS_RENDER_FAILED'&&e.cause===cause);
    assert.throws(()=>f.host.renderFrame(frame()),code('CANVAS_HOST_CLOSED'));assert.throws(()=>f.host.start(),code('CANVAS_HOST_CLOSED'));
  }
});
test('saved_frame_replay_uses_owned_pixels',async()=>{
  const engine=await egret.createEngine({host:headlessHost().adapter}),source=image(3,2,new Uint8Array(pixels)),texture=egret.createTexture(source,region(1,1,2,1));
  const type=egret.createAssetType('canvas-replay',egret.isTexture);engine.assets.register(type,{load:async()=>texture,dispose:v=>v.dispose()});const ref=egret.createAssetRef(type,'crop'),lease=await engine.assets.acquire(ref);
  const rect=()=>{const s=engine.stage.addChild(new egret.Sprite());s.graphics.beginFill(0x123456).drawRect(0,0,2,2);};rect();
  const parent=engine.stage.addChild(new egret.Sprite());parent.alpha=0.5;parent.clipRect={x:0,y:0,width:2,height:1};const nested=parent.addChild(new egret.Sprite());nested.clipRect={x:0,y:0,width:2,height:1};nested.addChild(new egret.Bitmap(lease));rect();
  const saved=engine.captureFrame({width:8,height:8}),before=[...egret.copyImageData2DPixels(saved.images[0])];lease.release();engine.assets.invalidate(ref);await engine.dispose();
  const f=fixture();f.run(()=>f.host.renderFrame(saved));assert.deepEqual(f.calls.filter(c=>c[0]==='fillRect'||c[0]==='drawImage').map(c=>c[0]),['fillRect','fillRect','drawImage','fillRect']);assert.deepEqual([...f.privateCalls.find(c=>c[0]==='ImageData')[1]],[1,128,255,127,255,99,33,0]);assert.ok(f.calls.some(c=>c[0]==='globalAlpha'&&c[1]===0.5));assert.equal(f.calls.filter(c=>c[0]==='clip').length,2);assert.deepEqual([...egret.copyImageData2DPixels(saved.images[0])],before);
  const second=fixture();second.run(()=>second.host.renderFrame(saved));assert.notEqual(f.canvases[0],second.canvases[0]);await f.host.close();await second.host.close();
});
test('import_isolation_remains_unchanged including private image helper',()=>{
  const script=`for(const name of ['window','document','HTMLCanvasElement','ImageData','setTimeout','requestAnimationFrame'])Object.defineProperty(globalThis,name,{get(){throw Error('import touched '+name)}});await import('@egret/engine');await import('@egret/engine/web');await import('./packages/engine/dist/web/canvasImageProjection.js');`;
  const r=spawnSync(process.execPath,['--input-type=module','--eval',script],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});


// I1: an exported class or an old genuine object cannot authenticate this invocation.
function canvasOwnedFault(site,source,fault,body,onFault=()=>{}){
  const freeze=Object.freeze,set=Map.prototype.set,NativeMap=Map,NativeSet=Set;let attempts=0;
  const injected=()=>{attempts++;onFault();throw fault;};
  try{
    if(site==='copier-freeze')Object.freeze=value=>Array.isArray(value)&&value.length===1&&value[0]===source?injected():freeze(value);
    if(site==='planner-freeze')Object.freeze=value=>value?.image===source&&Object.hasOwn(value,'byteLength')?injected():freeze(value);
    if(site.endsWith('-map'))Map.prototype.set=function(key,value){if(key===source&&(site==='copier-map'?value instanceof NativeSet:value instanceof NativeMap))return injected();return set.call(this,key,value);};
    body();assert.equal(attempts,1,'fault selected a real owned operation exactly once');
  }finally{Object.freeze=freeze;Map.prototype.set=set;}
}
const canvasOwnedCauses=()=>[...internalCauses(),Error('owned metadata'),null,undefined];
for(const site of ['copier-freeze','copier-map','planner-freeze','planner-map'])test('I1 Canvas '+site+' arbitrary native causes are pre-target reusable',()=>{
  for(const cause of canvasOwnedCauses()){
    const f=fixture(),source=image(),input=frame([imageCommand()],[source]);
    canvasOwnedFault(site,source,cause,()=>assert.throws(()=>f.run(()=>f.host.renderFrame(input)),e=>e.code==='CANVAS_RENDER_FAILED'&&e.cause===cause));
    noMutation(f);assert.equal(f.canvases.length,0);assertReusable(f);
  }
});
test('I1 Canvas old genuine copier and planner tokens are native in a later call',async()=>{
  const f=fixture(),source=image();let copierToken;
  try{f.host.renderFrame(frame([imageCommand()],Array(65).fill(source)));}catch(error){assert.equal(error.code,'CANVAS_FRAME_BUDGET');copierToken=error.cause;}
  assert.ok(copierToken instanceof copier.CanvasImageCopyError);
  const {planImageProjections}=await import('../packages/engine/dist/web/imageProjections2D.js');const wide=image(129,1);let plannerToken;
  try{planImageProjections(frame(Array.from({length:129},(_,x)=>imageCommand(0,region(x,0))),[wide]),'straight');}catch(error){plannerToken=error;}
  assert.ok(plannerToken instanceof ImageProjectionError);assert.equal(plannerToken.reason,'budget');
  for(const [site,cause] of [['copier-freeze',copierToken],['copier-map',copierToken],['planner-freeze',plannerToken],['planner-map',plannerToken]]){
    const g=fixture(),input=frame([imageCommand()],[source]);canvasOwnedFault(site,source,cause,()=>assert.throws(()=>g.run(()=>g.host.renderFrame(input)),e=>e.code==='CANVAS_RENDER_FAILED'&&e.cause===cause));noMutation(g);assertReusable(g);
  }
});
test('I1 Canvas copier observer reports only this exact deliberate invalid read budget or backing object',()=>{
  const source=image(),cause={source:true};
  const cases=[['invalid',frame([imageCommand(1)],[source])],['read',frame([imageCommand()],[source])],['budget',frame([imageCommand()],Array(65).fill(source))],['backing',frame([imageCommand()],[source])]];
  getter(cases[1][1],'images',()=>{throw cause;});cases[3][1].width=1e20;
  for(const [reason,input] of cases){const events=[];let caught;try{copier.copyCanvasMixedFrame(input,1,16777216,()=>{},error=>events.push(error));}catch(error){caught=error;}
    assert.equal(events.length,1);assert.equal(events[0],caught);if(reason==='backing')assert.equal(caught.code,'CANVAS_BACKING_LIMIT');else assert.equal(caught.reason,reason);if(reason==='read')assert.equal(caught.cause,cause);
  }
  const good=frame([imageCommand()],[source]);getter(good,'onFailure',()=>{throw Error('frame cannot supply observer');});const events=[];copier.copyCanvasMixedFrame(good,1,100,()=>{},error=>events.push(error));assert.deepEqual(events,[]);
});
test('I1 Canvas copier notification is outside property and iterator source catches',()=>{
  const source=image(),original={read:true},callback={observer:true},input=frame([imageCommand()],[source]);getter(input,'images',()=>{throw original;});let recorded;
  assert.throws(()=>copier.copyCanvasMixedFrame(input,1,100,()=>{},error=>{recorded=error;throw callback;}),e=>e===callback);assert.equal(recorded.reason,'read');assert.equal(recorded.cause,original);
  const iterable=frame(iteratorArray(imageCommand(),'next',original),[source]);recorded=undefined;
  assert.throws(()=>copier.copyCanvasMixedFrame(iterable,1,100,()=>{},error=>{recorded=error;throw callback;}),e=>e===callback);assert.equal(recorded.reason,'read');assert.equal(recorded.cause,original);
});
for(const site of ['copier-freeze','copier-map','planner-freeze','planner-map'])test('I1 Canvas '+site+' termination keeps its phase priority',async()=>{
  const f=fixture(),source=image(),cause=new copier.CanvasImageCopyError('budget'),input=frame([imageCommand()],[source]);let closing;
  canvasOwnedFault(site,source,cause,()=>assert.throws(()=>f.run(()=>f.host.renderFrame(input)),e=>site.startsWith('copier-')?e.code==='CANVAS_HOST_CLOSED':e.code==='CANVAS_RENDER_FAILED'&&e.cause===cause),()=>{closing=f.host.close();});
  noMutation(f);assert.throws(()=>f.host.start(),code('CANVAS_HOST_CLOSED'));await closing;
});
