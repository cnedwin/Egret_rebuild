// SPDX-License-Identifier: Apache-2.0
// Ordinary public APIs; no global interception or native replacement.
import {admitResourceManifest} from '@egret/contracts/resources';
import {createEngineForProfile,Bitmap,DisplayObjectContainer} from '@egret/engine';
import {createSequenceController,createSequenceResetSlot} from '@egret/engine/animation';
import {createContentLoader} from '@egret/engine/resources';
import {createManifestByteSource,createManifestTextureProvider} from '@egret/engine/web/resources';
import {createSharedWebGPUHost} from '@egret/engine/webgpu';import {createSharedWebGL2Host} from '@egret/engine/webgl2';
const canvas=document.querySelector('canvas'),status=document.querySelector('pre'),params=new URL(location.href).searchParams,backend=params.get('backend')??'webgpu';
if(!['webgpu','webgl2'].includes(backend))throw Error('BACKEND');
const options={width:64,height:32,clearColor:0,clearAlpha:1,outputAlpha:'opaque'},playback={profile:'egret.sequence-control/1',totalPlays:'infinite'},loaders={},transports={},textures=[],events=[],diagnostics=[];
let engine,host,owner,group,initial,sibling,slot,ticket,upload,candidate,oldFrame,retiredFrame,previousOwned,seconds=0,phase='opening',hold,releaseHold,held=false;
function describe(){status.textContent=JSON.stringify(inspect(),null,2);}
export function inspect(){const active=slot&&!slot.isDisposed?slot.getActive():undefined;return {phase,seconds,ticket:ticket?.state,active:active&&{version:active.version,ownership:active.ownership,status:active.controller.getStatus()},initial:initial?.getStatus(),sibling:sibling?.getStatus(),groupDisposed:group?.isDisposed,previousOwnedDisposed:previousOwned?.bitmap.isDisposed,events,diagnostics,host:host?.getSharedStatus(),transports:Object.fromEntries(Object.entries(transports).map(([k,t])=>[k,{source:t.source.getStatus(),provider:t.provider.getStatus(),sourceClosed:t.source.isClosed,providerClosed:t.provider.isClosed}])),textures:textures.map(t=>t.isDisposed)};}
async function present(frame){await host.whenIdle();const reading=host.requestReadback();host.renderSharedFrame(frame);const pixels=await reading;await host.whenIdle();describe();return {bytes:Array.from(pixels.bytes),width:pixels.width,height:pixels.height};}
export async function pixels(){return present(engine.captureSharedFrame(options));}
export async function step(){seconds+=0.25;engine.advanceTime(seconds);return pixels();}
export function begin(version='v2',delayed=false){
 upload?.dispose();ticket?.dispose();held=delayed;hold=delayed?new Promise(resolve=>{releaseHold=resolve;}):undefined;
 ticket=slot.request({policy:'reset',version,loader:loaders[version],imageId:'e_page',sequenceId:'e_sequence',playback:{...playback,markers:[{id:'zero',timeSeconds:0},{id:'half',timeSeconds:0.5}],onEvent:e=>{events.push(e);}}});phase='loading';describe();return inspect();
}
export function release(){held=false;releaseHold?.();releaseHold=undefined;return inspect();}
export async function stage(){await ticket.ready;candidate=ticket.capture(options);upload=host.stageSharedFrame(candidate);await upload.ready;phase='staged';describe();return inspect();}
export async function prepare(version='v2'){begin(version);return stage();}
export function commit(){previousOwned=slot.getActive().ownership==='owned'?slot.getActive():undefined;if(previousOwned)retiredFrame=engine.captureSharedFrame(options);ticket.commit();phase='committed';describe();return inspect();}
export async function submit(){const submitted=upload.submit();await submitted.completed;await host.whenIdle();phase='live';describe();return inspect();}
export function resume(){slot.getActive().controller.resume();describe();return inspect();}
export async function cancel(){upload?.dispose();ticket?.dispose();release();await host.whenIdle();phase='live';describe();return inspect();}
export function replayOld(){return present(oldFrame);}export function replayCandidate(){return present(candidate);}export function replayRetired(){return present(retiredFrame);}
export async function close(){if(phase==='closed')return inspect();await cancel();slot?.dispose();owner?.dispose();for(const loader of Object.values(loaders))loader.dispose();await engine?.dispose();for(const t of Object.values(transports)){await t.provider.close();await t.source.close();}await host?.close();phase='closed';describe();return inspect();}
async function generation(configURL,row){
 const base=new URL(row.base,configURL),url=new URL(row.manifestPath,base);if(base.origin!==location.origin||url.origin!==location.origin)throw Error('ORIGIN');
 const response=await fetch(url,{redirect:'error'});if(!response.ok)throw Error('MANIFEST_HTTP');const bytes=new Uint8Array(await response.arrayBuffer());
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(bytes.length!==row.manifest.byteLength||digest!==row.manifest.sha256)throw Error('MANIFEST_PIN');
 const admitted=admitResourceManifest(JSON.parse(new TextDecoder().decode(bytes)));if(!admitted.ok)throw Error('MANIFEST');return {base,manifest:admitted.value};
}
export const ready=(async()=>{
 const onDiagnostic=d=>diagnostics.push({code:d.code,phase:d.phase});host=(backend==='webgpu'?createSharedWebGPUHost:createSharedWebGL2Host)({canvas,pixelRatio:1,outputAlpha:'opaque',enableReadback:true,onDiagnostic});
 engine=await createEngineForProfile({host,onDiagnostic,clock:{maxDeltaSeconds:1}},'egret.shared-frame2d/1');owner=engine.createScope();
 const configURL=new URL(params.get('config')??'',location.href);if(configURL.origin!==location.origin)throw Error('CONFIG_ORIGIN');const config=await fetch(configURL).then(r=>r.json());
 for(const version of ['v1','v2']){const {base,manifest}=await generation(configURL,config[version]);loaders[version]=createContentLoader(engine,manifest,bindings=>{
  const source=createManifestByteSource(manifest,bindings.map(b=>b.binding),{baseUrl:base.href,deadlineMs:15000,networkRetries:0}),provider=createManifestTextureProvider(source);transports[version]={source,provider};
  return {textures:{async load(ref,context){if(version==='v2'&&held)await hold;const texture=await provider.load(ref,context);textures.push(texture);return texture;},dispose:texture=>provider.dispose(texture)},metadata:{load:async(ref,context)=>new TextDecoder('utf-8',{fatal:true}).decode(await source.readBytes(ref,context)),dispose(){}}};
 });}
 group=loaders.v1.load(owner,['e_sequence']);await group.ready;
 function make(x){const container=owner.use(new DisplayObjectContainer());container.x=x;container.y=8;container.scaleX=16;container.scaleY=16;engine.stage.addChild(container);const bitmap=owner.use(new Bitmap(group.getImage('e_page')));container.addChild(bitmap);const controller=createSequenceController(engine,owner,bitmap,group.getSequence('e_sequence'),playback);controller.start();return {container,bitmap,controller};}
 const a=make(8),b=make(40);initial=a.controller;sibling=b.controller;slot=createSequenceResetSlot(engine,owner,a.container,{version:'v1',bitmap:a.bitmap,controller:initial});engine.advanceTime(0);oldFrame=engine.captureSharedFrame(options);phase='live';return present(oldFrame);
})();void ready.catch(error=>{phase='failed';status.textContent=String(error.stack??error);});
const actions={step,prepare,commit,submit,resume,cancel,close};for(const button of document.querySelectorAll('[data-action]'))button.addEventListener('click',()=>{Promise.resolve().then(()=>actions[button.dataset.action]()).catch(error=>{status.textContent=String(error.stack??error);});});
window.addEventListener('pagehide',()=>{void close();},{once:true});
