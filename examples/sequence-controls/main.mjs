// SPDX-License-Identifier: Apache-2.0
// Public SDK consumer. Native manifest providers own PNG decode and settlement.
import {admitResourceManifest} from '@egret/contracts/resources';
import {createEngineForProfile,createAssetType,isTexture,createSpriteSheet,createSequenceClip,Sprite} from '@egret/engine';
import {createSequenceController} from '@egret/engine/animation';
import {createManifestAssetBinding} from '@egret/engine/resources';
import {createManifestByteSource,createManifestTextureProvider} from '@egret/engine/web/resources';
import {createSharedWebGPUHost} from '@egret/engine/webgpu';
import {createSharedWebGL2Host} from '@egret/engine/webgl2';
import {selectExampleGeneration,matchExampleManifest} from './selection.mjs';
import {markers} from './fixture.mjs';

const canvas=document.querySelector('#scene'),status=document.querySelector('#status');
const backend=new URL(location.href).searchParams.get('backend')??'webgpu';
if(!['webgpu','webgl2'].includes(backend))throw Error('EXAMPLE_BACKEND');
const frameOptions=Object.freeze({width:240,height:100,clearColor:0x172033,clearAlpha:1,outputAlpha:'opaque'});
const events=[],diagnostics=[],errors=[],readbacks=[],leases=[],textures=[],probeHandles=[];
let state='starting',engine,host,source,provider,dataScope,displayScope,group,sheet,clip,decimalClip,savedFrame,lastPixels,label,seconds=0,closePromise;
const instances=new Map();let cleanupProof;
const errorView=cause=>({code:cause?.code??null,message:String(cause?.message??cause)});
const check=(v,m)=>{if(!v)throw Error(m);};
const json=b=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));
const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
function relative(v){check(typeof v==='string'&&v.length&&!/[\\:\x00-\x1f]/.test(v)&&!v.startsWith('/')&&v.split('/').every(p=>p&&p!=='.'&&p!=='..'),'EXAMPLE_RELATIVE');return v;}
function sameOrigin(url){check(url.origin===location.origin,'EXAMPLE_ORIGIN');return url;}
async function bytes(url,limit){const r=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});check(r.ok&&r.body,'EXAMPLE_HTTP');const reader=r.body.getReader(),chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;check(size<=limit,'EXAMPLE_BYTES');chunks.push(value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}const result=new Uint8Array(size);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}return result;}
async function pinned(url,pin){check(Number.isSafeInteger(pin?.byteLength)&&pin.byteLength>0&&pin.byteLength<=4194304&&/^[a-f0-9]{64}$/.test(pin.sha256),'EXAMPLE_PIN');const b=await bytes(url,pin.byteLength);check(b.length===pin.byteLength&&await digest(b)===pin.sha256,'EXAMPLE_INTEGRITY');return b;}
function describe(){status.textContent=JSON.stringify(inspect(),null,2);}
function instance(owner,x,whichClip,options,listener){
 const scope=engine.createScope(),panel=scope.use(new Sprite());panel.x=x;panel.y=32;panel.clipRect={x:0,y:0,width:48,height:32};engine.stage.addChild(panel);
 const bitmap=scope.use(sheet.createBitmap(sheet.names[0]));bitmap.scaleX=64;bitmap.scaleY=32;panel.addChild(bitmap);
 const controller=createSequenceController(engine,scope,bitmap,whichClip,{profile:'egret.sequence-control/1',...options,onEvent:event=>{events.push({owner,...event});if(listener)listener(event);}});
 const record={owner,scope,panel,bitmap,controller};instances.set(owner,record);return record;
}
export function inspect(){return {state,backend,label,seconds,clock:engine?{state:engine.clock.state,elapsedSeconds:engine.clock.elapsedSeconds,tickId:engine.clock.tickId}:null,instances:Object.fromEntries([...instances].map(([id,r])=>[id,{status:r.controller.getStatus(),scope:r.scope.state,bitmapDisposed:r.bitmap.isDisposed}])),events:[...events],diagnostics:[...diagnostics],errors:[...errors],source:source?.getStatus(),provider:provider?.getStatus(),retirement:{dataScope:dataScope?.state,displayScope:displayScope?.state,sheet:sheet?.isDisposed,textures:textures.map(t=>t.isDisposed),sourceClosed:source?.isClosed,providerClosed:provider?.isClosed},cleanupProof,readbacks:[...readbacks],hostStatus:host?.getSharedStatus()};}
export function readback(){check(lastPixels,'EXAMPLE_NO_READBACK');let binary='';for(let i=0;i<lastPixels.length;i+=16384)binary+=String.fromCharCode(...lastPixels.subarray(i,i+16384));return {width:240,height:100,label,base64:btoa(binary)};}
async function draw(name,replay=false){const ticket=host.requestReadback();void ticket.catch(()=>{});host.renderSharedFrame(replay?savedFrame:engine.captureSharedFrame(frameOptions));const result=await ticket;await host.whenIdle();check(result.width===240&&result.height===100&&result.bytes.length===96000,'EXAMPLE_READBACK');lastPixels=new Uint8Array(result.bytes);label=name;readbacks.push({label,width:result.width,height:result.height,frameId:result.frameId,serial:result.serial,format:result.format,colorSpace:result.colorSpace});describe();return inspect();}
export async function advance(value,name='step'){check(state==='ready'&&Number.isFinite(value)&&value>=seconds&&value-seconds<=0.25&&value<=10,'EXAMPLE_TIME');engine.advanceTime(value);seconds=value;return draw(name);}
export async function action(kind){check(state==='ready','EXAMPLE_NOT_READY');const A=instances.get('A').controller,B=instances.get('B').controller;
 if(kind==='pause-rate'){B.pause();A.setRate(2);}
 else if(kind==='seek-resume'){B.seek({timeSeconds:0.25});B.resume();}
 else if(kind==='replay')return draw('replay',true);
 else if(kind==='pause')B.pause();else if(kind==='resume')B.resume();else if(kind==='rate')B.setRate(B.getStatus().rate===1?2:1);
 else if(kind==='seek')B.seek({timeSeconds:0.25});else if(kind==='seek-replay')B.seek({timeSeconds:B.getStatus().elapsedSeconds+0.5,replayEvents:true});
 else throw Error('EXAMPLE_ACTION');return draw(kind);
}
export async function isolation(){check(state==='ready'&&seconds===2,'EXAMPLE_ISOLATION_ORDER');
 // This separate finite scene starts after the literal A/B schedule and retained replay.
 for(const r of instances.values())r.scope.dispose();
 const C=instance('C',24,clip,{totalPlays:'infinite',markers},event=>{if(event.kind==='marker'&&event.id==='half')throw Error('original listener control');});
 const D=instance('D',120,clip,{totalPlays:'infinite',markers});C.controller.start();D.controller.start();
 await advance(2.25,'isolation-quarter');const first=await advance(2.5,'isolation-listener');
 C.bitmap.dispose();const second=await advance(2.75,'isolation-binding');const third=await advance(3,'isolation-continued');return {first,second,third};
}
export async function decimalControls(){check(state==='ready'&&seconds===3,'EXAMPLE_DECIMAL_ORDER');for(const r of instances.values())r.scope.dispose();const E=instance('E',24,decimalClip,{totalPlays:'infinite',markers:[{id:'zero',timeSeconds:0},{id:'end',timeSeconds:0.2}]});E.controller.start();const rows=[];
 for(const time of [0.9999999999999999,1,1.0000000000000002,0.6,0.6000000000000001]){E.controller.seek({timeSeconds:time});rows.push({time,snapshot:await draw('decimal-'+String(time)),raw:readback()});}
 E.controller.seek({timeSeconds:0.75});const clock=await advance(3.25,'decimal-clock-boundary'),clockRaw=readback();E.controller.seek({timeSeconds:0.75});E.controller.seek({timeSeconds:1,replayEvents:true});const replay=await draw('decimal-forward-replay');return {rows,clock,clockRaw,replay};}
function released(lease){try{void lease.value;return false;}catch(e){return e?.code==='ASSET_LEASE_RELEASED';}}
function proveSubscriptionRelease(){const scope=engine.createScope();let refusal;try{for(let i=0;i<256;i++)probeHandles.push(engine.clock.onTick(scope,()=>{}));try{engine.clock.onTick(scope,()=>{});}catch(e){refusal=e?.code;}return {acquired:probeHandles.length,refusal};}finally{scope.dispose();}}
export function close(){if(closePromise)return closePromise;closePromise=(async()=>{await ready.catch(()=>{});state='closing';const failures=[];const attempt=async fn=>{try{await fn();}catch(e){failures.push(errorView(e));}};
 for(const [button,fn]of handlers)button.removeEventListener('click',fn);window.removeEventListener('pagehide',onPageHide);
 for(const r of instances.values())await attempt(()=>r.scope.dispose());
 await attempt(()=>{cleanupProof=proveSubscriptionRelease();});await attempt(()=>displayScope?.dispose());await attempt(()=>dataScope?.dispose());
 if(cleanupProof)cleanupProof={...cleanupProof,probeSubscriptionsDisposed:probeHandles.every(s=>s.isDisposed),leasesReleased:leases.map(released)};
 await attempt(()=>host?.whenIdle());await attempt(()=>engine?.dispose());await attempt(()=>provider?.close());await attempt(()=>source?.close());await attempt(()=>host?.close());
 errors.push(...failures);state='closed';describe();return inspect();})();return closePromise;}
export const ready=(async()=>{
 const selected=new URL(location.href).searchParams.get('config');check(selected,'Generate content and provide its config URL.');const configURL=sameOrigin(new URL(selected,location.href)),config=json(await bytes(configURL,16384));
 check(config.format==='egret.sequence-controls-content/1','EXAMPLE_CONFIG');const base=sameOrigin(new URL(config.projectBaseUrl,configURL));check(base.pathname.endsWith('/'),'EXAMPLE_BASE');
 const candidate=json(await pinned(new URL(relative(config.snapshotPath),base),config.snapshot)),selection=selectExampleGeneration(candidate,config);
 const admitted=admitResourceManifest(json(await pinned(new URL(relative(selection.manifestFile.path),base),config.manifest)));check(admitted.ok,'EXAMPLE_MANIFEST');const manifest=matchExampleManifest(selection,admitted.value);
 const textureType=createAssetType('sequence-example-texture',isTexture),metadataType=createAssetType('sequence-example-metadata',v=>v!==null&&typeof v==='object');
 const bindings=Object.fromEntries(manifest.entries.map(e=>[e.id,createManifestAssetBinding(manifest,e.id,e.artifact.mediaType==='image/png'?textureType:metadataType)]));
 source=createManifestByteSource(manifest,Object.values(bindings),{baseUrl:base.href,deadlineMs:15000,networkRetries:0});provider=createManifestTextureProvider(source);
 host=(backend==='webgpu'?createSharedWebGPUHost:createSharedWebGL2Host)({canvas,pixelRatio:1,outputAlpha:'opaque',enableReadback:true,onDiagnostic:d=>diagnostics.push({code:d.code,phase:d.phase})});
 engine=await createEngineForProfile({host,onDiagnostic:d=>diagnostics.push({code:d.code,phase:d.phase})},'egret.shared-frame2d/1');dataScope=engine.createScope();displayScope=engine.createScope();
 engine.assets.register(textureType,provider);engine.assets.register(metadataType,{load:async(ref,context)=>json(await source.readBytes(ref,context)),dispose(){}});
 group=engine.createManifestGroup(dataScope,manifest,['e_sequence','e_decimal_sequence'],Object.values(bindings));await group.ready;
 const atlas=group.get(bindings.e_atlas).value,sequence=group.get(bindings.e_sequence).value,decimal=group.get(bindings.e_decimal_sequence).value,page=group.get(bindings.e_page);for(const b of Object.values(bindings))leases.push(group.get(b));textures.push(page.value);
 check(page.value.width===4&&page.value.height===1&&atlas.pageDependency===0&&sequence.atlasDependency===0&&decimal.atlasDependency===0,'EXAMPLE_ARTIFACT_SHAPE');check(JSON.stringify(atlas.sequenceInput)===JSON.stringify(sequence.sequenceInput),'EXAMPLE_SEQUENCE_IDENTITY');
 sheet=displayScope.use(createSpriteSheet(page,atlas.frames,'trim-rotation-v1'));clip=createSequenceClip(sequence.sequenceInput,'trim-rotation-v1');decimalClip=createSequenceClip(decimal.sequenceInput,'trim-rotation-v1');check(clip.durationSeconds===1&&decimalClip.durationSeconds===0.2,'EXAMPLE_DURATIONS');
 const background=displayScope.use(new Sprite());background.graphics.beginFill(0x446080).drawRect(8,8,224,12).endFill();engine.stage.addChild(background);
 const A=instance('A',24,clip,{totalPlays:2,rate:1,markers}),B=instance('B',120,clip,{totalPlays:'infinite',rate:2,markers});
 const overlay=displayScope.use(new Sprite());overlay.graphics.beginFill(0xffffff).drawRect(32,36,16,8).drawRect(128,36,16,8).endFill();engine.stage.addChild(overlay);
 engine.advanceTime(0);A.controller.start();B.controller.start();savedFrame=engine.captureSharedFrame(frameOptions);state='ready';return draw('initial');
})().catch(cause=>{errors.push(errorView(cause));state='failed';describe();throw cause;});void ready.catch(()=>{});
const handlers=[];for(const button of document.querySelectorAll('[data-action]')){const fn=()=>{const kind=button.dataset.action;void(kind==='close'?close():kind==='step'?advance(seconds+0.25):action(kind)).catch(e=>{errors.push(errorView(e));describe();});};button.addEventListener('click',fn);handlers.push([button,fn]);}
function onPageHide(){void close();}window.addEventListener('pagehide',onPageHide,{once:true});
