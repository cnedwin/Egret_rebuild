// SPDX-License-Identifier: Apache-2.0
// CPU and GPU boundaries are deliberately separate ordinary application operations.
import {admitResourceManifest} from '@egret/contracts/resources';
import {createEngineForProfile,DisplayObjectContainer} from '@egret/engine';
import {createSharedWebGPUHost} from '@egret/engine/webgpu';import {createSharedWebGL2Host} from '@egret/engine/webgl2';
import {createManifestSpineContentLoader} from '@egret/spine/web';
import {createSpineInstance,createSpineDisplay,createSpineResetSlot} from '@egret/spine';
import {createRecoveryFlow} from './recovery-flow.mjs';
const canvas=document.querySelector('canvas'),status=document.querySelector('pre'),backend=new URL(location.href).searchParams.get('backend')??'webgpu';
if(!['webgpu','webgl2'].includes(backend))throw Error('BACKEND');
const options={width:64,height:48,clearColor:0,clearAlpha:1,outputAlpha:'opaque'},loaders={},diagnostics=[],events=[];
let flow,engine,host,owner,slot,group,initial,sibling,ticket,upload,uploadReady,oldFrame,nextFrame,ownedFrame,previousOwned,phase='opening',seconds=0,lastError;
function abandonLegacy(){const priorUpload=upload,priorTicket=ticket;upload=undefined;ticket=undefined;uploadReady=undefined;priorUpload?.dispose();priorTicket?.dispose();}
function currentIntent(id){const state=flow.inspect();if(state.closed||state.id!==id||state.cancelled)throw Object.assign(Error('FLOW_CANCELLED'),{code:'FLOW_CANCELLED'});}
function describe(){status.textContent=JSON.stringify(inspect(),null,2);}
export function inspect(){const active=slot&&!slot.isDisposed?slot.getActive():undefined;return {backend,phase,lastError,flow:flow?.inspect(),sibling:sibling?.getSnapshot(),clock:engine?{state:engine.clock.state,tickId:engine.clock.tickId,elapsedSeconds:engine.clock.elapsedSeconds}:undefined,active:active?{version:active.version,ownership:active.ownership,snapshot:active.instance.getSnapshot()}:undefined,initialDisposed:initial?.isDisposed,siblingDisposed:sibling?.isDisposed,groupDisposed:group?.isDisposed,previousOwnedDisposed:previousOwned?.isDisposed,ticket:ticket?.state,loaders:Object.fromEntries(Object.entries(loaders).map(([k,v])=>[k,v.getStatus()])),transport:Object.fromEntries(Object.entries(loaders).map(([k,v])=>[k,v.getTransportStatus()])),events:[...events],session:host?.getSessionStatus(),host:host?.getSharedStatus(),diagnostics};}
async function present(frame){await host.whenIdle();const reading=host.requestReadback();host.renderSharedFrame(frame);const pixels=await reading;await host.whenIdle();return {bytes:Array.from(pixels.bytes),width:pixels.width,height:pixels.height};}
export function advance(delta=.02){seconds+=delta;engine.advanceTime(seconds);describe();return inspect();}
export function skin(){slot.getActive().instance.setSkin('hat');describe();return inspect();}
export async function step(delta=.02){if(phase==='staged'||phase==='committed'||['uploading','staged','cpu-published'].includes(flow?.inspect().phase))throw Error('FINISH_FINAL_WINDOW_FIRST');seconds+=delta;engine.advanceTime(seconds);const pixels=await present(engine.captureSharedFrame(options));describe();return pixels;}
export async function prepare(version='v2',animation='move'){
 flow?.cancel();upload?.dispose();ticket?.dispose();lastError=undefined;
 const local=slot.request({policy:'reset',version,loader:loaders[version],assetId:'e_character',animation,loop:true,onEvent:e=>events.push({owner:'replacement',...e})});ticket=local;phase='loading';describe();
 try{await local.ready;if(ticket!==local)throw Error('SUPERSEDED');nextFrame=local.capture(options);upload=host.stageSharedFrame(nextFrame);const ready=await upload.ready;if(ticket!==local)throw Error('SUPERSEDED');uploadReady=ready;phase='staged';describe();return {ready,...inspect()};}
 catch(error){if(ticket===local){upload?.dispose();local.dispose();phase='live';lastError=error.code??String(error);describe();}throw error;}
}
// As prepare, keeping the playback: the candidate takes up the active player's tracks where they stand
// when it is captured, and CPU commit and Submit then proceed as for reset.
export async function preserve(version='v2'){
 flow?.cancel();upload?.dispose();ticket?.dispose();lastError=undefined;
 let local;
 try{local=slot.requestPreserving({version,loader:loaders[version],assetId:'e_character',onEvent:e=>events.push({owner:'replacement',...e})});}
 catch(error){phase='live';lastError=error.code??String(error);describe();throw error;}
 ticket=local;phase='loading';describe();
 try{await local.ready;if(ticket!==local)throw Error('SUPERSEDED');nextFrame=local.capture(options);upload=host.stageSharedFrame(nextFrame);const ready=await upload.ready;if(ticket!==local)throw Error('SUPERSEDED');uploadReady=ready;phase='staged';describe();return {ready,...inspect()};}
 catch(error){if(ticket===local){upload?.dispose();local.dispose();phase='live';lastError=error.code??String(error);describe();}throw error;}
}
export async function fail(){try{await prepare('v2','missing-exact-name');}catch{}return inspect();}
export async function cancel(){flow?.cancel();upload?.dispose();ticket?.dispose();await host.whenIdle();phase='live';describe();return inspect();}
function checkUploadGeneration(){const session=host.getSessionStatus();if(session.state!=='ready'||uploadReady?.generation!==session.generation)throw Object.assign(Error('FLOW_STALE_GENERATION'),{code:'FLOW_STALE_GENERATION'});}
export function commit(){if(phase!=='staged')throw Error('STAGE_FIRST');checkUploadGeneration();const current=slot.getActive();if(current.ownership==='owned'){previousOwned=current.instance;ownedFrame=engine.captureSharedFrame(options);}try{ticket.commit();}finally{if(ticket.state==='committed')phase='committed';}checkUploadGeneration();describe();return inspect();}
export async function submit(){
 if(phase!=='committed')throw Error('COMMIT_FIRST');
 // Genuine ticket validates its own actual Host generation. No app label substitutes for it.
 checkUploadGeneration();const submission=upload.submit();await submission.completed;await host.whenIdle();phase='live';describe();return {generation:submission.generation,frameId:submission.frameId,...inspect()};
}
export async function replace(version='v2'){
 abandonLegacy();
 const pending=flow.replace(resetRequest(version)),intent=flow.inspect().id;await pending;currentIntent(intent);phase='live';describe();return inspect();
}
function resetRequest(version){return {policy:'reset',version,loader:loaders[version],assetId:'e_character',animation:'move',skins:['default','hat'],loop:true,onEvent:e=>events.push({owner:'replacement',...e})};}
export async function prepareRecovery(version='v2'){abandonLegacy();const pending=flow.prepare(resetRequest(version)),intent=flow.inspect().id;await pending;currentIntent(intent);phase='staged';describe();return inspect();}
export function commitRecovery(){flow.commit();phase='committed';describe();return inspect();}
export async function submitRecovery(){const intent=flow.inspect().id;await flow.submit();currentIntent(intent);phase='live';describe();return inspect();}
export function cancelRecovery(){flow.cancel();phase='live';describe();return inspect();}
export async function recover(){
 // A stale CPU candidate and its separate upload must both be revoked.
 abandonLegacy();phase='recovering';describe();
 const pending=flow.replay(),intent=flow.inspect().id;
 try{await pending;if(flow.inspect().id===intent&&!flow.inspect().closed){phase='live';describe();}return inspect();}catch(error){if(flow.inspect().id===intent&&!flow.inspect().closed){phase='recovery-failed';lastError=error.code??String(error);describe();}throw error;}
}
export function session(){return host.getSessionStatus();}

export async function stale(){if(phase!=='staged')throw Error('STAGE_FIRST');seconds+=.02;engine.advanceTime(seconds);let code;try{commit();}catch(error){code=error.code;}await cancel();await present(engine.captureSharedFrame(options));return {code,...inspect()};}
export async function replayOld(){return present(oldFrame);}
export async function replayCandidate(){return present(nextFrame);}
export async function replayRetired(){return present(ownedFrame);}
export async function pixels(){return present(engine.captureSharedFrame(options));}
export async function close(){if(phase==='closed')return inspect();flow?.close();abandonLegacy();slot?.dispose();owner?.dispose();for(const loader of Object.values(loaders))await loader.close();await engine?.dispose();await host?.close();phase='closed';describe();return inspect();}
export const ready=(async()=>{
 const onDiagnostic=d=>diagnostics.push({code:d.code,phase:d.phase,cause:d.cause?{name:d.cause.name,message:d.cause.message,stack:d.cause.stack}:undefined});
 host=(backend==='webgpu'?createSharedWebGPUHost:createSharedWebGL2Host)({canvas,pixelRatio:1,outputAlpha:'opaque',enableReadback:true,onDiagnostic,...(backend==='webgpu'?{recovery:{mode:'automatic'}}:{})});
 engine=await createEngineForProfile({host,onDiagnostic},'egret.shared-frame2d/1');owner=engine.createScope();
 for(const version of ['v1','v2']){const base=new URL('/work/spine-reset/'+version+'/',location.href),response=await fetch(new URL('manifest.json',base));if(!response.ok)throw Error('AUTHOR_ASSETS_FIRST');const admitted=admitResourceManifest(await response.json());if(!admitted.ok)throw Error('MANIFEST');loaders[version]=createManifestSpineContentLoader(engine,owner,admitted.value,{baseUrl:base.href,deadlineMs:15000,networkRetries:0});}
 group=loaders.v1.load(owner,['e_character']);await group.ready;const asset=group.getSpine('e_character');
 initial=createSpineInstance(asset,owner,{onEvent:e=>events.push({owner:'initial',...e})});initial.setAnimation(0,'move',{loop:true});
 const display=createSpineDisplay(initial,owner,{colorProfile:'egret-shared-linear/1'}),target=owner.use(new DisplayObjectContainer());target.x=16;target.y=24;target.addChild(display.node);engine.stage.addChild(target);
 sibling=createSpineInstance(asset,owner);const siblingDisplay=createSpineDisplay(sibling,owner,{colorProfile:'egret-shared-linear/1'});siblingDisplay.node.x=48;siblingDisplay.node.y=24;engine.stage.addChild(siblingDisplay.node);
 slot=createSpineResetSlot(engine,owner,target,{version:'v1',instance:initial,display});
 // Caller owns the existing Engine tick: loading never pauses other scene consumers.
 engine.clock.onTick(owner,tick=>{slot.getActive().instance.advance(tick);sibling.advance(tick);});engine.advanceTime(0);
 flow=createRecoveryFlow({engine,host,slot,frameOptions:options});
 oldFrame=engine.captureSharedFrame(options);const pixels=await present(oldFrame);phase='live';describe();return pixels;
})();void ready.catch(error=>{lastError=String(error);phase='failed';describe();});
const actions={step,recover,prepare,preserve,commit,submit,cancel,fail,stale,replace,replayOld,replayCandidate,replayRetired,close};
for(const button of document.querySelectorAll('[data-action]'))button.addEventListener('click',()=>{Promise.resolve().then(()=>actions[button.dataset.action]()).catch(error=>{lastError=error.code??String(error);describe();});});
window.addEventListener('pagehide',()=>{void close();},{once:true});
