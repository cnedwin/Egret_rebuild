// SPDX-License-Identifier: Apache-2.0
import {createEngineForProfile, Sprite, Bitmap, createTexture, createImageData2D, createAssetType, createAssetRef, isTexture} from '@egret/engine';
import {createUiRoot} from '@egret/engine/ui';
import {createTextField, createTextRasterCache} from '@egret/engine/text';
import {createCanvasTextRasterProvider} from '@egret/engine/web/text';
import {createBrowserPointerInput} from '@egret/engine/web/pointer';
import {createSharedWebGPUHost} from '@egret/engine/webgpu';
import {createSharedWebGL2Host} from '@egret/engine/webgl2';

const canvas=document.querySelector('#scene'), status=document.querySelector('#status');
const backend=new URL(location.href).searchParams.get('backend')??'webgpu';
if(!['webgpu','webgl2'].includes(backend))throw Error('EXAMPLE_BACKEND');
const frameOptions=Object.freeze({width:960,height:640,clearColor:0x172033,clearAlpha:1,outputAlpha:'opaque'});
const heights=[24,40,64],colors=[0x286450,0x345c9c,0xa05030];
const events=[],binds=[],unbinds=[],errors=[],diagnostics=[],readbacks=[];
let engine,host,owner,input,cache,rootA,rootB,face,family,texture,lease,savedFrame,lastPixels;
let sourceA;
const panelATree=(width,height)=>({kind:'virtualList',id:'rows',explicitWidth:width,explicitHeight:height,source:sourceA});
let state='starting',label=null,pendingReplacement,gate,gateEntered=false,closePromise;
const checks={fontSelected:false,fontRemoved:false,bitmapClosed:false,textureDisposals:0,pendingReadbacks:0};
const records=Array.from({length:30},(_,i)=>({key:'row-'+String(i).padStart(2,'0'),contentVersion:1,estimatedHeight:heights[i%3],value:{height:heights[i%3],color:colors[i%3]}}));
const sideRecords=Array.from({length:3},(_,i)=>({key:'side-0'+i,contentVersion:1,estimatedHeight:40,value:{height:40,color:0x7050a0}}));
const viewError=cause=>({code:cause?.code??null,message:String(cause?.message??cause)});
function describe(){status.textContent=state+' / '+backend+' / '+(label??'')+'\n'+(events.at(-1)?JSON.stringify(events.at(-1)):'Click an Engine row / 点击 Engine 列表行');}
async function checkedBytes(relative,size,sha256){const response=await fetch(new URL(relative,import.meta.url));if(!response.ok)throw Error('EXAMPLE_ASSET_HTTP');const bytes=new Uint8Array(await response.arrayBuffer());const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(bytes.length!==size||digest!==sha256)throw Error('EXAMPLE_ASSET_IDENTITY');return bytes;}
async function proveFont(){const font='normal 400 8px "'+family+'"',selected=await document.fonts.load(font,'X X');if(selected.length!==1||selected[0]!==face||!document.fonts.has(face)||!document.fonts.check(font,'X X')||[...document.fonts].filter(x=>x.family===family).length!==1)throw Error('EXAMPLE_FONT_SELECTION');checks.fontSelected=true;}
function source(revision,data,delayed=false,ownerId='panel-a'){return {revision,records:data,async bind(context){
  // Observe entry separately from cleanup so missing unbind callbacks cannot pass.
  binds.push({ownerId,key:context.key,bindingGeneration:context.bindingGeneration,contentVersion:context.contentVersion});
  if(delayed&&context.key==='row-02'){gateEntered=true;await gate.promise;}
  if(context.signal.aborted)throw Error('EXAMPLE_BIND_ABORTED');
  const content=context.scope.use(new Sprite());
  content.graphics.beginFill(context.value.color).drawRect(0,0,context.width,context.value.height).endFill();
  const badge=context.scope.use(new Bitmap(lease));badge.x=8;badge.y=4;badge.scaleX=8;badge.scaleY=8;content.addChild(badge);
  const text=createTextField(engine,context.scope,cache);text.x=40;text.y=4;
  text.setRequest({text:context.index%2?'X X':'XX',fontFamily:family,fontSize:8,lineHeight:12,fontWeight:400,fontStyle:'normal',locale:'en',direction:'ltr',density:context.density,fillColor:0xffffff});
  await text.prepare();if(context.signal.aborted)throw Error('EXAMPLE_BIND_ABORTED');content.addChild(text);
  return {content,measuredHeight:context.value.height};
 },unbind(info){unbinds.push({ownerId,...info});}};}
function onRowPointer(n){const p=n.event.payload;events.push({kind:n.kind,key:n.key,index:n.index,bindingGeneration:n.bindingGeneration,contentVersion:n.contentVersion,layoutRevision:n.layoutRevision,globalX:p.globalX,globalY:p.globalY,pointerType:p.session.pointerType,...(p.reason===undefined?{}:{reason:p.reason})});describe();}
async function publish(root){for(let i=0;i<8;i++){const p=await root.prepare();if(p.status==='pending')continue;const result=root.commit(p);if(!['committed','unchanged'].includes(result.kind)||result.postCommitErrors.length)throw Error('EXAMPLE_COMMIT');return;}throw Error('EXAMPLE_PREPARATION_LIMIT');}
async function draw(name,replay=false){const ticket=host.requestReadback();checks.pendingReadbacks++;void ticket.catch(()=>{});let frame;
  try{frame=replay?savedFrame:engine.captureSharedFrame(frameOptions);host.renderSharedFrame(frame);const result=await ticket;await host.whenIdle();if(result.width!==960||result.height!==640||result.bytes.length!==2457600)throw Error('EXAMPLE_READBACK');lastPixels=new Uint8Array(result.bytes);label=name;readbacks.push({label:name,width:result.width,height:result.height,frameId:result.frameId,serial:result.serial,format:result.format,colorSpace:result.colorSpace});describe();return inspect();}finally{checks.pendingReadbacks--;}}
export function inspect(){return {state,backend,label,rootA:rootA?.snapshot(),rootB:rootB?.snapshot(),events:[...events],binds:[...binds],unbinds:[...unbinds],errors:[...errors],diagnostics:[...diagnostics],checks:{...checks},gateEntered,inputState:input?.state,scopeState:owner?.state,textCacheStatus:cache?.getStatus(),readbacks:[...readbacks],hostStatus:host?.getSharedStatus()};}
export function readback(){if(!lastPixels)throw Error('EXAMPLE_NO_READBACK');let binary='';for(let i=0;i<lastPixels.length;i+=16384)binary+=String.fromCharCode(...lastPixels.subarray(i,i+16384));return {width:960,height:640,label,base64:btoa(binary)};}
export async function action(kind){if(state!=='ready')throw Error('EXAMPLE_NOT_READY');
  if(kind==='scroll')rootA.list('rows').setScrollOffset(92);
  else if(kind==='resize'){rootA.setViewport({width:600,height:480},2);rootA.setTree(panelATree(600,480));}
  else if(kind==='move')rootA.setOrigin({x:48,y:64});
  else if(kind==='recycle')rootA.list('rows').setScrollOffset(640);
  else if(kind==='return')rootA.list('rows').setScrollOffset(92);
  else if(kind==='dispose-a'){rootA.dispose();return draw(kind);}
  else if(kind==='replay')return draw(kind,true);
  else throw Error('EXAMPLE_ACTION');
  await publish(rootA);return draw(kind);
}
export function beginReplacement(){if(state!=='ready'||pendingReplacement)throw Error('EXAMPLE_REPLACEMENT');let resolve;gate={promise:new Promise(yes=>{resolve=yes;}),resolve};gateEntered=false;
  const next=records.map(r=>r.key==='row-02'?{...r,contentVersion:2,estimatedHeight:80,value:{height:80,color:0xa03090}}:r);
  sourceA=source(2,next,true);rootA.list('rows').setSource(sourceA);pendingReplacement=publish(rootA);void pendingReplacement.catch(()=>{});return inspect();}
export async function pendingFrame(){if(!gateEntered)throw Error('EXAMPLE_GATE_NOT_ENTERED');return draw('pending');}
export async function finishReplacement(){gate.resolve();await pendingReplacement;pendingReplacement=undefined;return draw('complete');}
export function close(){if(closePromise)return closePromise;state='closing';closePromise=(async()=>{const failures=[];const attempt=async fn=>{try{await fn();}catch(e){failures.push(viewError(e));}};
  for(const [button,fn]of handlers)button.removeEventListener('click',fn);document.querySelector('#finish').removeEventListener('click',onFinish);window.removeEventListener('pagehide',onPageHide);
  await attempt(()=>ready);await attempt(()=>rootA?.dispose());await attempt(()=>rootB?.dispose());gate?.resolve();await attempt(()=>pendingReplacement?.catch(e=>{if(!['UI_CLOSED','UI_STALE'].includes(e?.code))throw e;}));
  await attempt(()=>owner?.dispose());await attempt(()=>cache?.dispose());await attempt(()=>cache?.whenIdle());await attempt(()=>host?.whenIdle());await attempt(()=>engine?.dispose());
  await attempt(()=>{if(face)document.fonts.delete(face);checks.fontRemoved=!face||!document.fonts.has(face);});errors.push(...failures);state='closed';describe();return inspect();})();return closePromise;}
export const ready=(async()=>{
  const bytes=await checkedBytes('../canvas-text/assets/ahem.ttf',22572,'f0a92cd0cc45735591c9b5b1fa8aecd5194e8dc518895ca22af94a46c23550dc');family='EgretUiPanel_'+crypto.randomUUID();face=new FontFace(family,bytes,{style:'normal',weight:'400'});await face.load();document.fonts.add(face);await proveFont();
  const png=await checkedBytes('../../tools/browser-png/assets/rgb-red-green.png',72,'917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d');const image=await createImageBitmap(new Blob([png],{type:'image/png'}));
  try{if(image.width!==2||image.height!==1)throw Error('EXAMPLE_IMAGE_SIZE');const decoder=document.createElement('canvas');decoder.width=2;decoder.height=1;const ctx=decoder.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,2,1).data;texture=createTexture(createImageData2D({width:2,height:1,pixels:new Uint8Array(pixels)}));}finally{image.close();checks.bitmapClosed=true;}
  host=(backend==='webgpu'?createSharedWebGPUHost:createSharedWebGL2Host)({canvas,pixelRatio:1,outputAlpha:'opaque',enableReadback:true,onDiagnostic:n=>diagnostics.push({code:n.code,phase:n.phase})});
  engine=await createEngineForProfile({host,onDiagnostic:n=>diagnostics.push({code:n.code,phase:n.phase})},'egret.shared-frame2d/1');owner=engine.createScope();
  const type=createAssetType('ui-panel-badge',isTexture),ref=createAssetRef(type,'checked-badge');engine.assets.register(type,{load:async()=>texture,dispose:value=>{checks.textureDisposals++;value.dispose();}});lease=owner.use(await engine.assets.acquire(ref));
  cache=createTextRasterCache(engine.assets,{provider:createCanvasTextRasterProvider()});input=createBrowserPointerInput({engine,scope:owner,width:960,height:640,capacity:10});
  sourceA=source(1,records);
  rootA=createUiRoot({engine,scope:owner,id:'panel-a',viewport:{width:420,height:360},origin:{x:24,y:32},density:1,tree:panelATree(420,360),input,onRowPointer,limits:{overscan:0,residentCap:32,retainedCap:0}});
  rootB=createUiRoot({engine,scope:owner,id:'panel-b',viewport:{width:200,height:148},origin:{x:700,y:12},density:1,tree:{kind:'column',id:'side-panel',explicitWidth:200,explicitHeight:148,children:[{kind:'row',id:'toolbar',explicitWidth:200,explicitHeight:20,children:[{kind:'leaf',id:'toolbar-left',explicitWidth:96,explicitHeight:20,fill:{color:0x446080}},{kind:'leaf',id:'toolbar-right',explicitWidth:104,explicitHeight:20,fill:{color:0x805030}}]},{kind:'virtualList',id:'side',explicitWidth:200,explicitHeight:128,source:source(1,sideRecords,false,'panel-b')}]},input,onRowPointer,limits:{overscan:0,residentCap:8,retainedCap:0}});
  await publish(rootA);await publish(rootB);savedFrame=engine.captureSharedFrame(frameOptions);state='ready';return draw('initial');
})().catch(cause=>{errors.push(viewError(cause));state='failed';describe();throw cause;});void ready.catch(()=>{});
const handlers=[];for(const button of document.querySelectorAll('[data-action]')){const fn=()=>{const name=button.dataset.action;void (name==='close'?close():name==='delay'?Promise.resolve(beginReplacement()).then(()=>pendingReplacement):action(name)).catch(e=>{errors.push(viewError(e));describe();});};button.addEventListener('click',fn);handlers.push([button,fn]);}
function onFinish(){void finishReplacement().catch(e=>{errors.push(viewError(e));describe();});}
function onPageHide(){void close();}
document.querySelector('#finish').addEventListener('click',onFinish);
window.addEventListener('pagehide',onPageHide,{once:true});
