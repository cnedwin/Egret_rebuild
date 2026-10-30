// SPDX-License-Identifier: Apache-2.0
import {createEngineForProfile,Sprite} from '@egret/engine';
import {createParagraph,createParagraphCache} from '@egret/engine/paragraph';
import {createUiRoot} from '@egret/engine/ui';
import {createCanvasKitParagraphProvider} from '@egret/engine/web/paragraph';
import {createSharedWebGL2Host} from '@egret/engine/webgl2';
import {createSharedWebGPUHost} from '@egret/engine/webgpu';
const canvas=document.querySelector('#scene'),status=document.querySelector('#status');
const backend=new URL(location.href).searchParams.get('backend')??'webgl2';
if(!['webgl2','webgpu'].includes(backend))throw Error('GEOMETRY_BACKEND');
let engine,scope,host,provider,cache,ui,paint,paragraph,revision=0,closed=false,lastQuery,lastPixels;
let request={text:document.querySelector('#text').value,width:600,fontFamilies:[],fontSize:24,locale:'und',direction:'ltr',fillColor:0xf3f6ff,density:1,textGeometry:true};
let queue=Promise.resolve();const errors=[],handlers=[];
const frame={width:960,height:480,clearColor:0x142033,clearAlpha:1,outputAlpha:'opaque'};
const info=error=>({code:error?.code??null,message:String(error?.message??error)});
function inspect(){return {backend,revision,closed,request,paragraph:paragraph?.getStatus(),ui:ui?.snapshot(),cache:cache?.getStatus(),query:lastQuery,errors:[...errors]};}
function describe(){status.textContent=JSON.stringify(inspect(),(key,value)=>typeof value==='function'?undefined:value,2);}
async function draw(){const read=host.requestReadback();void read.catch(()=>{});host.renderSharedFrame(engine.captureSharedFrame(frame));const pixels=await read;await host.whenIdle();lastPixels=new Uint8Array(pixels.bytes);describe();}
function tree(desired,generation,accept){return {kind:'column',id:'geometry-column',explicitWidth:desired.width,children:[{kind:'leaf',id:'geometry-text',content:{revision:generation,async prepare(context){
 const node=createParagraph(engine,context.scope,cache);node.setRequest({...desired,width:context.width,density:context.density});const metrics=await node.prepare();if(context.signal.aborted)throw Error('GEOMETRY_STALE');accept(node);return {content:node,measuredHeight:metrics.height};
}}}]};}
async function update(changes={}){
 if(closed)throw Error('GEOMETRY_CLOSED');
 const desired={...request,...changes,textGeometry:true},generation=++revision;let candidate;
 ui.setTree(tree(desired,generation,node=>{candidate=node;}));
 ui.setViewport({width:desired.width,height:420},desired.density);
 for(let attempts=0;attempts<32;attempts++){
  const preparation=await ui.prepare();if(preparation.status==='pending'){await new Promise(resolve=>setTimeout(resolve,0));continue;}
  const committed=ui.commit(preparation);if(committed.kind==='stale')continue;
  if(!['committed','unchanged'].includes(committed.kind)||committed.postCommitErrors.length)throw Error('GEOMETRY_UI_COMMIT');
  // The exposed node changes only after the owning UI transaction commits.
  if(candidate)paragraph=candidate;request=desired;paint.graphics.clear();lastQuery=undefined;await draw();return inspect();
 }
 throw Error('GEOMETRY_PREPARE_LIMIT');
}
async function query({start=0,end=start,affinity='downstream',x=0,y=0}={}){
 if(closed)throw Error('GEOMETRY_CLOSED');const geometry=paragraph?.getStatus().geometry;if(!geometry)throw Error('GEOMETRY_NOT_COMMITTED');
 const caret=geometry.getCaret(start,affinity),selection=geometry.getSelectionRects(start,end),hit=geometry.hitTest(x,y);
 paint.graphics.clear();for(const box of selection)paint.graphics.beginFill(0x266aba,.55).drawRect(box.left,box.top,box.right-box.left,box.bottom-box.top).endFill();
 if(caret&&caret.bottom>caret.top)paint.graphics.beginFill(0xffb155).drawRect(caret.x,caret.top,1.5,caret.bottom-caret.top).endFill();
 lastQuery={start,end,caret,hit,selection};await draw();return lastQuery;
}
async function close(){if(closed)return inspect();closed=true;for(const [target,event,listener]of handlers)target.removeEventListener(event,listener);window.removeEventListener('pagehide',onHide);ui?.dispose();scope?.dispose();cache?.dispose();await host?.whenIdle();await engine?.dispose();provider?.dispose();describe();return inspect();}
const ready=(async()=>{
 const base=new URL('../paragraph-panel/vendor/',import.meta.url),manifest=await(await fetch(new URL('manifest.json',base))).json(),fonts=[];
 for(const row of manifest.fonts){const response=await fetch(new URL(row.path,base));if(!response.ok)throw Error('GEOMETRY_FONT_HTTP');const data=new Uint8Array(await response.arrayBuffer());const identity=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),n=>n.toString(16).padStart(2,'0')).join('');if(identity!==row.sha256)throw Error('GEOMETRY_FONT_HASH');fonts.push({family:row.family,data,identity});}
 const ck=await globalThis.CanvasKitInit({locateFile:()=>new URL(manifest.runtime.wasm,base).href});provider=createCanvasKitParagraphProvider({canvasKit:ck,fonts,buildIdentity:manifest.runtime.buildIdentity});
 host=(backend==='webgpu'?createSharedWebGPUHost:createSharedWebGL2Host)({canvas,pixelRatio:1,outputAlpha:'opaque',enableReadback:true});engine=await createEngineForProfile({host},'egret.shared-frame2d/1');scope=engine.createScope();cache=createParagraphCache(engine.assets,{provider});request={...request,fontFamilies:fonts.map(f=>f.family)};
 paint=scope.use(new Sprite());paint.x=30;paint.y=30;engine.stage.addChild(paint);
 ui=createUiRoot({engine,scope,id:'geometry-ui',origin:{x:30,y:30},viewport:{width:600,height:420},density:1,tree:tree(request,0,()=>{})});
 await update();await query({start:2,end:20,x:60,y:12});return inspect();
})();void ready.catch(error=>{errors.push(info(error));describe();});
function form(id,work){const target=document.querySelector(id),listener=event=>{event.preventDefault();queue=queue.then(()=>ready).then(()=>work(new FormData(target))).catch(error=>{errors.push(info(error));describe();});};target.addEventListener('submit',listener);handlers.push([target,'submit',listener]);}
form('#layout',data=>update({text:document.querySelector('#text').value,width:Number(data.get('width')),textAlign:data.get('align'),direction:data.get('direction')}));
form('#query',data=>query({start:Number(data.get('start')),end:Number(data.get('end')),affinity:data.get('affinity'),x:Number(data.get('x')),y:Number(data.get('y'))}));
function onHide(){void ready.catch(()=>{}).then(close);}window.addEventListener('pagehide',onHide,{once:true});
globalThis.__egretParagraphGeometry=Object.freeze({ready,inspect,update,query,close,readback:()=>lastPixels});
