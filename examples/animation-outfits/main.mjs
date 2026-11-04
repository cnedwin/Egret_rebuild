// SPDX-License-Identifier: Apache-2.0
import {admitResourceManifest} from '@egret/contracts/resources';
import {createEngineForProfile,createAssetType,isTexture,createSpriteSheet,createSequenceClip} from '@egret/engine';
import {createManifestAssetBinding} from '@egret/engine/resources';
import {createManifestByteSource,createManifestTextureProvider} from '@egret/engine/web/resources';
import {createSharedWebGPUHost} from '@egret/engine/webgpu';import {createSharedWebGL2Host} from '@egret/engine/webgl2';
import {createManifestSpineContentLoader} from '@egret/spine/web';
import {createOutfitScene} from './scene.mjs';
const canvas=document.querySelector('canvas'),status=document.querySelector('#status');
const backend=new URL(location.href).searchParams.get('backend')??'webgpu';if(!['webgpu','webgl2'].includes(backend))throw Error('BACKEND');
const frameOptions=Object.freeze({width:640,height:400,clearColor:0x18243a,clearAlpha:1,outputAlpha:'opaque'});
let current,serial=0,playing=false,raf=0,closedReport,openingRequest,intent=0,preview=0;const errors=[];
const errorView=e=>({code:e?.code??null,message:String(e?.message??e)});
function describe(){const s=inspect();status.textContent=JSON.stringify({state:s.state,backend,seconds:s.seconds,counts:s.scene?.counts,sharedSetup:s.loader,selected:s.scene?.players[Number(document.querySelector('#player').value)],transport:s.transport,cleanup:s.cleanup,errors},null,2);}
export function inspect(){const r=current;return r?{state:r.state,backend,seconds:r.seconds,scene:r.scene?.inspect(),loader:r.loader?.getStatus(),transport:r.loader?.getTransportStatus(),sequenceTransport:{source:r.source?.getStatus(),provider:r.provider?.getStatus()},diagnostics:[...r.diagnostics],cleanup:r.cleanup,errors:[...errors]}:closedReport??{state:'idle',backend};}
function assertReady(){if(current?.state!=='ready')throw Error('SCENE_NOT_READY');return current;}
export function render(){const r=assertReady();return r.engine.renderSharedFrame(frameOptions);}
function update(delta,change){const r=assertReady();if(!Number.isFinite(delta)||delta<0||delta>.1)throw Error('STEP_RANGE');r.work=(r.work??Promise.resolve()).catch(()=>{}).then(async()=>{if(r!==current||r.state!=='ready')throw Error('SCENE_NOT_READY');await r.host.whenIdle();if(r!==current||r.state!=='ready')throw Error('SCENE_NOT_READY');change?.();r.seconds+=delta;r.engine.advanceTime(r.seconds);render();await r.host.whenIdle();describe();return inspect();});return r.work;}
export function step(delta=1/60){return update(delta);}
export function edit(index,values){const r=assertReady();return update(1/60,()=>r.scene.edit(index,values));}
export async function pixels(){const r=assertReady();await r.work;await r.host.whenIdle();const ticket=r.host.requestReadback();render();const result=await ticket;await r.host.whenIdle();return {width:result.width,height:result.height,bytes:Array.from(result.bytes)};}
export function close(){intent++;return closeCurrent();}
function closeCurrent(){preview++;playing=false;cancelAnimationFrame(raf);const r=current;if(!r)return Promise.resolve(inspect());if(r.closing)return r.closing;r.cancelled=true;r.state='closing';r.abort.abort();
 // Revoke scopes before awaiting pending source work, including close during load.
 r.scene?.dispose();r.data?.dispose();r.owner?.dispose();r.loader?.dispose();
 r.closing=(async()=>{await r.opening.catch(()=>{});await r.work?.catch(()=>{});const failures=[];const attempt=async fn=>{try{await fn();}catch(e){failures.push(errorView(e));}};
  await attempt(()=>r.scene?.dispose());await attempt(()=>r.data?.dispose());await attempt(()=>r.owner?.dispose());await attempt(()=>r.loader?.close());await attempt(()=>r.provider?.close());await attempt(()=>r.source?.close());
  r.cleanup={data:r.data?.state,owner:r.owner?.state,sheetDisposed:r.sheet?.isDisposed,sequenceTextureDisposed:r.texture?.isDisposed,groupDisposed:r.group?.isDisposed,loader:r.loader?.getStatus(),scene:r.scene?.inspect().ownership,counts:r.scene?.inspect().counts,failures};
  await attempt(()=>r.engine?.dispose());await attempt(()=>r.host?.close());r.cleanup.host=r.host?.getSharedStatus();r.state='closed';closedReport=inspect();describe();return closedReport;
 })();return r.closing;
}
export function open(){if(openingRequest)return openingRequest;const ticket=++intent;openingRequest=openOnce(ticket).finally(()=>{openingRequest=undefined;});return openingRequest;}
async function openOnce(ticket){await closeCurrent();if(ticket!==intent)throw Error('SCENE_CANCELLED');const r={id:++serial,state:'loading',seconds:0,cancelled:false,abort:new AbortController(),diagnostics:[]};current=r;
 const live=()=>{if(r.cancelled)throw Error('SCENE_CANCELLED');};
 r.opening=(async()=>{
  const base=new URL('/work/animation-outfits/',location.href),response=await fetch(new URL('manifest.json',base),{signal:r.abort.signal,cache:'no-store',redirect:'error'});if(!response.ok)throw Error('CONTENT_HTTP');
  const admitted=admitResourceManifest(await response.json());if(!admitted.ok)throw Error('CONTENT_MANIFEST');live();const manifest=admitted.value;
  const onDiagnostic=d=>r.diagnostics.push({code:d.code,phase:d.phase});r.host=(backend==='webgpu'?createSharedWebGPUHost:createSharedWebGL2Host)({canvas,pixelRatio:1,outputAlpha:'opaque',enableReadback:true,onDiagnostic});
  r.engine=await createEngineForProfile({host:r.host,onDiagnostic},'egret.shared-frame2d/1');live();r.owner=r.engine.createScope();r.data=r.engine.createScope();
  r.loader=createManifestSpineContentLoader(r.engine,r.owner,manifest,{baseUrl:base.href,deadlineMs:15000,networkRetries:0});r.group=r.loader.load(r.data,['e_character']);
  const imageType=createAssetType('outfit-sequence-image',isTexture),metadataType=createAssetType('outfit-sequence-metadata',v=>v!==null&&typeof v==='object');
  const page=createManifestAssetBinding(manifest,'e_sparks',imageType),sequence=createManifestAssetBinding(manifest,'e_sequence',metadataType),bindings=[page,sequence];
  r.source=createManifestByteSource(manifest,bindings,{baseUrl:base.href,deadlineMs:15000,networkRetries:0});r.provider=createManifestTextureProvider(r.source);
  r.engine.assets.register(imageType,r.provider);r.engine.assets.register(metadataType,{async load(ref,context){return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await r.source.readBytes(ref,context)));},dispose(){}});
  r.sequenceGroup=r.engine.createManifestGroup(r.data,manifest,['e_sequence'],bindings);
  await Promise.all([r.group.ready,r.sequenceGroup.ready]);live();const lease=r.sequenceGroup.get(page);r.texture=lease.value;
  r.sheet=r.data.use(createSpriteSheet(lease,[{name:'spark',x:0,y:0,width:1,height:1}]));const clip=createSequenceClip(r.sequenceGroup.get(sequence).value);
  r.scene=createOutfitScene(r.engine,r.group.getSpine('e_character'),r.sheet,clip);r.engine.advanceTime(0);r.state='ready';render();describe();return inspect();
 })().catch(e=>{if(!r.cancelled){r.state='failed';errors.push(errorView(e));describe();}throw e;});
 try{return await r.opening;}catch(e){await close();throw e;}
}
async function animate(token){if(token!==preview||!playing||current?.state!=='ready')return;try{await step(1/60);if(playing&&token===preview)raf=requestAnimationFrame(()=>animate(token));}catch(e){playing=false;errors.push(errorView(e));describe();}}
const playerSelect=document.querySelector('#player');for(let i=0;i<20;i++){const option=document.createElement('option');option.value=String(i);option.textContent=String(i+1);playerSelect.append(option);}
function values(){return {outfit:document.querySelector('#outfit').value,animation:document.querySelector('#animation').value,plays:document.querySelector('#plays').value==='infinite'?'infinite':2,rate:Number(document.querySelector('#rate').value),paused:document.querySelector('#pause').checked};}
for(const button of document.querySelectorAll('[data-action]'))button.addEventListener('click',()=>{const kind=button.dataset.action;Promise.resolve().then(()=>{if(kind==='open')return open();if(kind==='close')return close();if(kind==='step')return step(.1);if(kind==='apply')return edit(Number(playerSelect.value),values());if(kind==='run'){playing=!playing;const token=++preview;if(playing)animate(token);else cancelAnimationFrame(raf);}}).catch(e=>{errors.push(errorView(e));describe();});});
window.addEventListener('pagehide',()=>{void close();},{once:true});
export const ready=open();void ready.catch(()=>{});
