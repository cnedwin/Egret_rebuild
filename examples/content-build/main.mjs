// SPDX-License-Identifier: Apache-2.0
// Public SDK consumer: generated manifest pins bytes; SDK owns playback and native PNG lifetime.
import {admitResourceManifest} from '@egret/contracts/resources';
import {selectExampleGeneration,matchExampleManifest} from './selection.mjs';
import {createEngine,createAssetType,isTexture,createSpriteSheet,createSequenceClip,Bitmap} from '@egret/engine';
import {createCanvasHost} from '@egret/engine/web';
import {createManifestAssetBinding} from '@egret/engine/resources';
import {createManifestByteSource,createManifestTextureProvider} from '@egret/engine/web/resources';
const canvas=document.querySelector('#scene'),status=document.querySelector('#status'),step=document.querySelector('#step');
const FRAME={width:12,height:6,clearColor:0x111827,clearAlpha:1};
let state='starting',engine,source,provider,host,dataScope,displayScope,animationScope,group,sheet,bitmap,other,playback,manifest,generationId,seconds=0,closePromise;
const diagnostics=[],textures=[];
function check(value,message){if(!value)throw new Error(message);}
function relative(value){check(typeof value==='string'&&value.length>0&&!/[\\:\x00-\x1f]/.test(value)&&!value.startsWith('/')&&value.split('/').every(x=>x&&x!=='.'&&x!=='..'),'Expected generated owner-relative path.');return value;}
function sameOrigin(url){check(url.origin===location.origin,'Example resources must be served from this local origin.');return url;}
async function bounded(url,maximum){
 const response=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});check(response.ok&&response.body,'Generated file could not be read.');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;check(size<=maximum,'Generated file exceeds its byte limit.');chunks.push(value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
const json=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
function render(){engine.renderFrame(FRAME);}
export function readSnapshot(){
 const pixel=(x,y)=>Array.from(canvas.getContext('2d').getImageData(x,y,1,1).data);
 return {state,generationId,seconds,frameName:playback?.lastSample?.frameName??null,sample:playback?.lastSample??null,playbackState:playback?.state??null,
  pixels:state==='ready'?{animated:pixel(2,2),other:pixel(8,2)}:null,manifestEntries:manifest?.entries.map(entry=>({id:entry.id,dependencies:[...entry.dependencies],sha256:entry.artifact.sha256}))??[],
  source:source?.getStatus()??null,provider:provider?.getStatus()??null,diagnostics:[...diagnostics],
  retirement:{animationScope:animationScope?.state??null,displayScope:displayScope?.state??null,dataScope:dataScope?.state??null,controller:playback?.isDisposed??null,sheet:sheet?.isDisposed??null,bitmap:bitmap?.isDisposed??null,other:other?.isDisposed??null,textures:textures.map(value=>value.isDisposed),sourceClosed:source?.isClosed??null,providerClosed:provider?.isClosed??null,clock:engine?.clock.state??null}};
}
export function advance(value){check(state==='ready','Example is not ready.');check(Number.isFinite(value)&&value>=seconds&&value<=10,'Finite monotonic time from 0 to 10 seconds required.');engine.advanceTime(value);seconds=value;render();return readSnapshot();}
async function retire(){
 const errors=[];const keep=async run=>{try{await run();}catch(error){errors.push(error);}};
 await keep(()=>animationScope?.dispose());await keep(()=>displayScope?.dispose());await keep(()=>dataScope?.dispose());
 await keep(()=>engine?.dispose());await keep(()=>provider?.close());await keep(()=>source?.close());await keep(()=>host?.close());
 state='closed';step.disabled=true;status.textContent='Closed / 已关闭';if(errors.length||diagnostics.length)throw new AggregateError(errors,'Content example cleanup reported a failure.');return readSnapshot();
}
export function close(){if(closePromise)return closePromise;state='closing';closePromise=(async()=>{await ready.catch(()=>{});return retire();})();return closePromise;}
async function initialize(){
 const selected=new URLSearchParams(location.search).get('config');check(selected,'Build the example, then open its generated configuration link. / 请先构建示例，再打开生成的配置链接。');
 const configUrl=sameOrigin(new URL(selected,location.href)),config=json(await bounded(configUrl,16384));
 check(config.format==='egret.content-example/1'&&/^[a-f0-9]{64}$/.test(config.generationId),'Generated example configuration required.');
 check(config.manifest&&/^[a-f0-9]{64}$/.test(config.manifest.sha256)&&Number.isSafeInteger(config.manifest.byteLength)&&config.manifest.byteLength>0&&config.manifest.byteLength<=4194304,'Manifest pin is invalid.');
 const base=sameOrigin(new URL(config.projectBaseUrl,configUrl));check(base.pathname.endsWith('/'),'Project base must identify a directory.');
 check(config.snapshot&&/^[a-f0-9]{64}$/.test(config.snapshot.sha256)&&Number.isSafeInteger(config.snapshot.byteLength)&&config.snapshot.byteLength>0&&config.snapshot.byteLength<=4194304,'Candidate snapshot pin is invalid.');
 const candidateBytes=await bounded(new URL(relative(config.snapshotPath),base),config.snapshot.byteLength);check(candidateBytes.length===config.snapshot.byteLength&&await digest(candidateBytes)===config.snapshot.sha256,'Committed candidate integrity mismatch.');
 const selection=selectExampleGeneration(json(candidateBytes),config);
 const bytes=await bounded(new URL(relative(selection.manifestFile.path),base),selection.manifestFile.byteLength);check(bytes.length===config.manifest.byteLength&&await digest(bytes)===config.manifest.sha256,'Generated manifest integrity mismatch.');
 const admitted=admitResourceManifest(json(bytes));check(admitted.ok,'Generated manifest admission failed.');manifest=matchExampleManifest(selection,admitted.value);generationId=selection.generationId;
 const byId=new Map(manifest.entries.map(entry=>[entry.id,entry]));check(byId.size===4&&['e_page','e_atlas','e_sequence','e_other'].every(id=>byId.has(id)),'Expected the four authored example resources.');
 check(byId.get('e_atlas').dependencies.length===1&&byId.get('e_atlas').dependencies[0]==='e_page'&&byId.get('e_sequence').dependencies.length===1&&byId.get('e_sequence').dependencies[0]==='e_atlas','Dependency ordinal zero must identify the generated page and atlas.');
 const textureType=createAssetType('egret.content-example.texture',isTexture),metadataType=createAssetType('egret.content-example.metadata',value=>value!==null&&typeof value==='object');
 const bindings=Object.fromEntries(manifest.entries.map(entry=>[entry.id,createManifestAssetBinding(manifest,entry.id,entry.artifact.mediaType==='image/png'?textureType:metadataType)]));
 source=createManifestByteSource(manifest,Object.values(bindings),{baseUrl:base.href,deadlineMs:15000,networkRetries:0});provider=createManifestTextureProvider(source);
 host=createCanvasHost({canvas,pixelRatio:1});engine=await createEngine({host,onDiagnostic(row){if(diagnostics.length<32)diagnostics.push({code:row.code,message:String(row.cause?.message??row.cause)});}});
 dataScope=engine.createScope();displayScope=engine.createScope();animationScope=engine.createScope();
 engine.assets.register(textureType,provider);engine.assets.register(metadataType,{async load(ref,context){return json(await source.readBytes(ref,context));},dispose(){}});
 group=engine.createManifestGroup(dataScope,manifest,['e_sequence','e_other'],Object.values(bindings));await group.ready;
 check(state==='starting','Example closed during startup.');
 const atlas=group.get(bindings.e_atlas).value,sequence=group.get(bindings.e_sequence).value;
 check(atlas.format==='egret.atlas/1'&&atlas.pageDependency===0&&sequence.format==='egret.sequence/1'&&sequence.atlasDependency===0,'Generated artifact dependency ordinals are invalid.');
 check(JSON.stringify(atlas.sequenceInput)===JSON.stringify(sequence.sequenceInput),'Generated sequence differs from its atlas.');
 const pageLease=group.get(bindings.e_page),otherLease=group.get(bindings.e_other);textures.push(pageLease.value,otherLease.value);
 check(pageLease.value.width===atlas.width&&pageLease.value.height===atlas.height,'Generated page dimensions differ from the atlas.');
 sheet=displayScope.use(createSpriteSheet(pageLease,atlas.frames,'trim-rotation-v1'));
 bitmap=displayScope.use(sheet.createBitmap(sheet.names[0]));bitmap.x=2;bitmap.y=2;bitmap.scaleX=2;bitmap.scaleY=2;engine.stage.addChild(bitmap);
 other=displayScope.use(new Bitmap(otherLease));other.x=8;other.y=2;other.scaleX=2;other.scaleY=2;engine.stage.addChild(other);
 const clip=createSequenceClip(sequence.sequenceInput,'trim-rotation-v1');engine.advanceTime(0);playback=engine.createSequencePlayback(animationScope,bitmap,clip,{mode:'once'});playback.start();
 state='ready';render();step.disabled=false;status.textContent='Built and verified · Red → Green / 构建并校验成功 · 红 → 绿';return readSnapshot();
}
export const ready=initialize().catch(async error=>{await retire().catch(cleanup=>diagnostics.push({code:'EXAMPLE_CLEANUP',message:String(cleanup)}));state='failed';status.textContent=String(error.message);throw error;});
void ready.catch(()=>{});
step.addEventListener('click',()=>{try{advance(Math.min(10,seconds+0.125));}catch(error){status.textContent=String(error.message);}});
document.querySelector('#close').addEventListener('click',()=>{void close().catch(error=>{status.textContent=String(error.message);});});
window.contentBuildExample=Object.freeze({ready,advance,readSnapshot,close});
