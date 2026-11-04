// SPDX-License-Identifier: Apache-2.0
import {createEngineForProfile,DisplayObjectContainer} from '@egret/engine';
import {createSharedWebGPUHost} from '@egret/engine/webgpu';import {createSharedWebGL2Host} from '@egret/engine/webgl2';
import {createScene,frameOptions} from './scene.mjs';
const backend=new URL(location.href).searchParams.get('backend')??'webgpu',canvas=document.querySelector('canvas'),status=document.querySelector('pre');
if(!['webgpu','webgl2'].includes(backend))throw Error('BACKEND');
let engine,host,scene,ticket,upload,oldFrame,candidateFrame,phase='opening';const diagnostics=[];
const view=()=>({backend,phase,scene:scene?.inspect(),session:host?.getSessionStatus(),host:host?.getSharedStatus(),diagnostics});
function describe(){status.textContent=JSON.stringify(view(),null,2);}
async function present(frame){await host.whenIdle();const reading=host.requestReadback();host.renderSharedFrame(frame);const pixels=await reading;await host.whenIdle();return {bytes:Array.from(pixels.bytes),generation:pixels.generation,frameId:pixels.frameId};}
export function inspect(){return view();}
export async function prepare(){if(phase!=='live')throw Error('PREPARE_REQUIRES_LIVE');ticket=scene.prepare();candidateFrame=engine.capturePreparedDisplaySharedFrame(ticket,frameOptions);upload=host.stageSharedFrame(candidateFrame);const ready=await upload.ready;phase='staged';describe();return {ready,...view()};}
export function commit(){if(phase!=='staged')throw Error('COMMIT_REQUIRES_STAGED');ticket.commit();phase='committed';describe();return view();}
export async function submit(){if(phase!=='committed')throw Error('SUBMIT_REQUIRES_COMMITTED');const reading=host.requestReadback(),submission=upload.submit();await submission.completed;const pixels=await reading;await host.whenIdle();phase='submitted';describe();return {bytes:Array.from(pixels.bytes),generation:submission.generation,frameId:submission.frameId,...view()};}
export async function abort(){if(phase!=='staged'&&phase!=='live')throw Error('ABORT_REQUIRES_UNCOMMITTED');upload?.dispose();ticket?.dispose();await host.whenIdle();phase='live';describe();return view();}
export async function replayOld(){return present(oldFrame);}
export async function replayCandidate(){if(!candidateFrame)throw Error('NO_CANDIDATE');return present(candidateFrame);}
export async function conflict(){if(phase!=='staged')throw Error('CONFLICT_REQUIRES_STAGED');scene.candidate.x++;let code;try{ticket.commit();}catch(error){code=error.code;}scene.candidate.x--;await abort();return {code,...view()};}
export async function stageBeforeClose(){const empty=scene.newScope.use(new DisplayObjectContainer());ticket=engine.prepareDisplaySubtree(scene.ticketScope,scene.target,empty);upload=host.stageSharedFrame(engine.capturePreparedDisplaySharedFrame(ticket,frameOptions));await upload.ready;return view();}
export async function close(){if(phase==='closed')return view();upload?.dispose();ticket?.dispose();scene?.close();await engine?.dispose();await host?.close();phase='closed';describe();return view();}
export const ready=(async()=>{const onDiagnostic=d=>diagnostics.push({code:d.code,phase:d.phase});host=(backend==='webgpu'?createSharedWebGPUHost:createSharedWebGL2Host)({canvas,pixelRatio:1,outputAlpha:'opaque',enableReadback:true,onDiagnostic});engine=await createEngineForProfile({host,onDiagnostic},'egret.shared-frame2d/1');scene=await createScene(engine);oldFrame=scene.capture();const pixels=await present(oldFrame);phase='live';describe();return pixels;})();void ready.catch(error=>{phase='failed';status.textContent=String(error);});
for(const button of document.querySelectorAll('[data-action]'))button.addEventListener('click',()=>{const actions={prepare,commit,submit,abort,replayOld,replayCandidate,close};Promise.resolve().then(()=>actions[button.dataset.action]()).catch(error=>{status.textContent=String(error);});});
window.addEventListener('pagehide',()=>{void close();},{once:true});
