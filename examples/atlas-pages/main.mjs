// SPDX-License-Identifier: Apache-2.0
import {admitResourceManifest} from '@egret/contracts/resources';
import {createEngineForProfile} from '@egret/engine';import {createManifestContentLoader} from '@egret/engine/web/resources';
import {createSharedWebGL2Host} from '@egret/engine/webgl2';import {createSharedWebGPUHost} from '@egret/engine/webgpu';
import {selectExampleGeneration,matchExampleManifest} from './selection.mjs';
const canvas=document.querySelector('#scene'),status=document.querySelector('#status'),url=new URL(location.href),backend=url.searchParams.get('backend')??'webgl2';
if(!['webgl2','webgpu'].includes(backend))throw Error('ATLAS_EXAMPLE_BACKEND');
for(const [id,value]of [['gl','webgl2'],['gpu','webgpu']]){const link=new URL(location.href);link.searchParams.set('backend',value);document.querySelector('#'+id).href=link.href;}
let engine,host,loader,resourceScope,displayScope,group,state='loading',closing=false,closePromise,lastPixels;const errors=[],frames=[];
const errorInfo=error=>({code:error?.code??null,message:String(error?.message??error)});
const frame={width:480,height:140,clearColor:0x142033,clearAlpha:1,outputAlpha:'opaque'};
function inspect(){return {state,backend,pages:group&&!group.isDisposed?group.getAtlasPages('e_pages'):[],frames:[...frames],loader:loader?.getStatus(),loaderDisposed:loader?.isDisposed,errors:[...errors],scopeState:resourceScope?.state};}
function describe(){status.textContent=JSON.stringify(inspect(),null,2);}
function checkOpen(){if(closing)throw Error('ATLAS_EXAMPLE_CLOSED');}
async function bounded(url,maximum){const response=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok||!response.body)throw Error('ATLAS_EXAMPLE_HTTP');const reader=response.body.getReader(),chunks=[];let length=0;try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>maximum)throw Error('ATLAS_EXAMPLE_LIMIT');chunks.push(part.value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}const bytes=new Uint8Array(length);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength;}return bytes;}
async function verified(url,pin,maximum){const bytes=await bounded(url,maximum),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');if(bytes.byteLength!==pin.byteLength||digest!==pin.sha256)throw Error('ATLAS_EXAMPLE_IDENTITY');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
async function draw(){const read=host.requestReadback();void read.catch(()=>{});host.renderSharedFrame(engine.captureSharedFrame(frame));const result=await read;await host.whenIdle();lastPixels=new Uint8Array(result.bytes);describe();return inspect();}
export const ready=(async()=>{
 const supplied=url.searchParams.get('config');if(!supplied)throw Error('Generate the example first; see README / 请先按说明生成示例');
 const configUrl=new URL(supplied,location.href);if(configUrl.origin!==location.origin||configUrl.username||configUrl.password||configUrl.search||configUrl.hash||!/^\/work\/atlas-pages\/run-[A-Za-z0-9]{6}\/browser-config\.json$/.test(configUrl.pathname))throw Error('ATLAS_EXAMPLE_CONFIG');
 const config=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bounded(configUrl,16384)));if(config.format!=='egret.content-example/1'||config.projectBaseUrl!=='./')throw Error('ATLAS_EXAMPLE_CONFIG');checkOpen();
 const base=new URL('./',configUrl),snapshot=await verified(new URL(config.snapshotPath,base),config.snapshot,4194304),selection=selectExampleGeneration(snapshot,config);
 const manifestInput=await verified(new URL(selection.manifestFile.path,base),config.manifest,4194304),admission=admitResourceManifest(manifestInput);if(!admission.ok)throw Error('ATLAS_EXAMPLE_MANIFEST');const manifest=matchExampleManifest(selection,admission.value);checkOpen();
 host=(backend==='webgpu'?createSharedWebGPUHost:createSharedWebGL2Host)({canvas,pixelRatio:1,outputAlpha:'opaque',enableReadback:true});engine=await createEngineForProfile({host},'egret.shared-frame2d/1');checkOpen();
 loader=createManifestContentLoader(engine,manifest,{baseUrl:base.href});resourceScope=engine.createScope();group=loader.load(resourceScope,['e_pages']);await group.ready;checkOpen();displayScope=engine.createScope();
 for(const [page,name,x,y]of [['characters','idle',20,20],['characters','green',100,20],['effects','idle',180,20],['effects','cyan',300,20]]){
  const bitmap=displayScope.use(group.getAtlasPage('e_pages',page).createBitmap(name));bitmap.x=x;bitmap.y=y;bitmap.scaleX=20;bitmap.scaleY=20;engine.stage.addChild(bitmap);frames.push({page,name,x,y});
 }
 state='ready';await draw();return inspect();
})();void ready.catch(error=>{if(!closing){errors.push(errorInfo(error));state='failed';describe();}});
export function close(){if(closePromise)return closePromise;closing=true;state='closing';closePromise=(async()=>{const attempt=async work=>{try{await work();}catch(error){errors.push(errorInfo(error));}};if(!displayScope)await attempt(()=>resourceScope?.dispose());await ready.catch(()=>{});await attempt(()=>host?.whenIdle());await attempt(()=>displayScope?.dispose());await attempt(()=>resourceScope?.dispose());await attempt(()=>loader?.close());await attempt(()=>engine?.dispose());document.querySelector('#close').removeEventListener('click',onClose);window.removeEventListener('pagehide',onHide);state='closed';describe();return inspect();})();return closePromise;}
function onClose(){void close();}function onHide(){void close();}document.querySelector('#close').addEventListener('click',onClose);window.addEventListener('pagehide',onHide,{once:true});
globalThis.__egretAtlasPages=Object.freeze({ready,inspect,close,readback:()=>lastPixels});
