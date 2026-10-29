// SPDX-License-Identifier: Apache-2.0
// Public SDK consumer: verified build outputs are materialized by the shared resource loader.
import {admitResourceManifest} from '@egret/contracts/resources';
import {selectExampleGeneration,matchExampleManifest} from './selection.mjs';
import {createEngine,Bitmap} from '@egret/engine';
import {createCanvasHost} from '@egret/engine/web';
import {createManifestContentLoader} from '@egret/engine/web/resources';
const canvas=document.querySelector('#scene'),status=document.querySelector('#status'),step=document.querySelector('#step');
const FRAME={width:12,height:6,clearColor:0x111827,clearAlpha:1};
let state='starting',engine,host,active,pending,seconds=0,closePromise,closing=false;
const diagnostics=[],attempts=[],retired=[],records=[];
const errorView=cause=>({code:cause?.code??null,message:String(cause?.message??cause)});
function check(value,message){if(!value)throw new Error(message);}
function relative(value){check(typeof value==='string'&&value.length>0&&!/[\\:\x00-\x1f]/.test(value)&&!value.startsWith('/')&&value.split('/').every(x=>x&&x!=='.'&&x!=='..'),'Expected generated owner-relative path.');return value;}
function sameOrigin(url){check(url.origin===location.origin,'Example resources must be served from this local origin.');return url;}
async function bounded(url,maximum,signal){
 const response=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});check(response.ok&&response.body,'Generated file could not be read.');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;check(size<=maximum,'Generated file exceeds its byte limit.');chunks.push(value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
const json=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
function render(){engine.renderFrame(FRAME);}
function retirement(record){return {generationId:record?.generationId??null,animationScope:record?.animationScope?.state??null,displayScope:record?.displayScope?.state??null,dataScope:record?.dataScope?.state??null,controller:record?.playback?.isDisposed??null,sheet:record?.sheet?.isDisposed??null,bitmap:record?.bitmap?.isDisposed??null,other:record?.other?.isDisposed??null,textures:record?.textures.map(value=>value.isDisposed)??[],loaderDisposed:record?.loader?.isDisposed??null,status:record?.loader?.getStatus()??null};}
export function readSnapshot(){
 const pixel=(x,y)=>Array.from(canvas.getContext('2d').getImageData(x,y,1,1).data),row=active;
 return {state,generationId:row?.generationId??null,seconds,frameName:row?.playback?.lastSample?.frameName??null,sample:row?.playback?.lastSample??null,playbackState:row?.playback?.state??null,
  pixels:state==='ready'?{animated:pixel(2,2),other:pixel(8,2)}:null,manifestEntries:row?.manifest?.entries.map(entry=>({id:entry.id,dependencies:[...entry.dependencies],sha256:entry.artifact.sha256}))??[],
  source:row?.loader?.getStatus().source??null,provider:row?.loader?.getStatus().provider??null,diagnostics:[...diagnostics],attempts:[...attempts],pending:pending?{cancelled:pending.cancelled,loaderCreated:!!pending.loader,generationId:pending.generationId??null}:null,
  retirement:retirement(row),retired:retired.map(retirement),clock:engine?.clock.state??null};
}
export function advance(value){check(state==='ready','Example is not ready.');check(Number.isFinite(value)&&value>=seconds&&value<=10,'Finite monotonic time from 0 to 10 seconds required.');engine.advanceTime(value);seconds=value;render();return readSnapshot();}
function cancel(record){if(!record||record.cancelled)return;record.cancelled=true;record.abort.abort();record.group?.dispose();record.loader?.dispose();}
async function retire(record){
 if(!record)return;if(record.closePromise)return record.closePromise;
 record.closePromise=(async()=>{const errors=[];const keep=async run=>{try{await run();}catch(error){errors.push(error);}};
  await keep(()=>record.animationScope?.dispose());await keep(()=>record.displayScope?.dispose());cancel(record);await keep(()=>record.dataScope?.dispose());await keep(()=>record.loader?.close());
  if(!retired.includes(record))retired.push(record);if(errors.length)throw new AggregateError(errors,'Content generation cleanup reported a failure.');})();return record.closePromise;
}
function fresh(){const record={abort:new AbortController(),textures:[],cancelled:false};records.push(record);return record;}
function current(record){check(!closing&&!record.cancelled,'Content generation was cancelled.');}
async function prepare(record,selected){
 const configUrl=sameOrigin(new URL(selected,location.href)),config=json(await bounded(configUrl,16384,record.abort.signal));current(record);
 check(config.format==='egret.content-example/1'&&/^[a-f0-9]{64}$/.test(config.generationId),'Generated example configuration required.');
 check(config.manifest&&/^[a-f0-9]{64}$/.test(config.manifest.sha256)&&Number.isSafeInteger(config.manifest.byteLength)&&config.manifest.byteLength>0&&config.manifest.byteLength<=4194304,'Manifest pin is invalid.');
 const base=sameOrigin(new URL(config.projectBaseUrl,configUrl));check(base.pathname.endsWith('/'),'Project base must identify a directory.');
 check(config.snapshot&&/^[a-f0-9]{64}$/.test(config.snapshot.sha256)&&Number.isSafeInteger(config.snapshot.byteLength)&&config.snapshot.byteLength>0&&config.snapshot.byteLength<=4194304,'Candidate snapshot pin is invalid.');
 const candidateBytes=await bounded(new URL(relative(config.snapshotPath),base),config.snapshot.byteLength,record.abort.signal);check(candidateBytes.length===config.snapshot.byteLength&&await digest(candidateBytes)===config.snapshot.sha256,'Committed candidate integrity mismatch.');
 const selection=selectExampleGeneration(json(candidateBytes),config);
 const bytes=await bounded(new URL(relative(selection.manifestFile.path),base),selection.manifestFile.byteLength,record.abort.signal);check(bytes.length===config.manifest.byteLength&&await digest(bytes)===config.manifest.sha256,'Generated manifest integrity mismatch.');current(record);
 const admitted=admitResourceManifest(json(bytes));check(admitted.ok,'Generated manifest admission failed.');record.manifest=matchExampleManifest(selection,admitted.value);record.generationId=selection.generationId;
 const byId=new Map(record.manifest.entries.map(entry=>[entry.id,entry]));check(byId.size===4&&['e_page','e_atlas','e_sequence','e_other'].every(id=>byId.has(id)),'Expected the four authored example resources.');
 record.dataScope=engine.createScope();record.loader=createManifestContentLoader(engine,record.manifest,{baseUrl:base.href,deadlineMs:15000,networkRetries:0});
 record.group=record.loader.load(record.dataScope,['e_sequence','e_other']);await record.group.ready;current(record);
 record.displayScope=engine.createScope();record.animationScope=engine.createScope();record.sheet=record.group.getAtlas('e_atlas');
 const page=record.group.getImage('e_page'),other=record.group.getImage('e_other');record.textures.push(page.value,other.value);
 record.bitmap=record.displayScope.use(record.sheet.createBitmap(record.sheet.names[0]));record.bitmap.x=2;record.bitmap.y=2;record.bitmap.scaleX=2;record.bitmap.scaleY=2;
 record.other=record.displayScope.use(new Bitmap(other));record.other.x=8;record.other.y=2;record.other.scaleX=2;record.other.scaleY=2;
 record.playback=engine.createSequencePlayback(record.animationScope,record.bitmap,record.group.getSequence('e_sequence'),{mode:'once'});record.playback.start();return record;
}
async function mount(record){current(record);if(pending===record)pending=undefined;const old=active;engine.stage.addChild(record.bitmap);engine.stage.addChild(record.other);active=record;await retire(old);current(record);state='ready';render();step.disabled=false;status.textContent='Built and verified / 构建并校验成功';return readSnapshot();}
export function cancelReplacement(){cancel(pending);return readSnapshot();}
export async function replace(configUrl){
 check(state==='ready'&&!closing,'Example is not ready.');check(typeof configUrl==='string'&&configUrl.length<=2048,'Replacement configuration URL required.');cancel(pending);
 const record=fresh();pending=record;const attempt={status:'pending',configuration:configUrl};attempts.push(attempt);
 record.task=(async()=>{try{await prepare(record,configUrl);if(pending!==record)throw Error('Superseded content generation.');await mount(record);attempt.status='ready';attempt.generationId=record.generationId;}
  catch(error){attempt.status=record.cancelled?'cancelled':'failed';attempt.error=errorView(error);await retire(record);if(!closing){state='ready';render();}}
  finally{if(pending===record)pending=undefined;}return readSnapshot();})();return record.task;
}
export function close(){
 if(closePromise)return closePromise;closing=true;state='closing';step.disabled=true;for(const record of records)if(record!==active)cancel(record);
 closePromise=(async()=>{const errors=[];const keep=async run=>{try{await run();}catch(error){errors.push(error);}};
  await keep(()=>ready.catch(()=>{}));await keep(()=>Promise.all(records.map(record=>record.task)));for(const record of records)await keep(()=>retire(record));await keep(()=>engine?.dispose());await keep(()=>host?.close());
  state='closed';status.textContent='Closed / 已关闭';if(errors.length||diagnostics.length)throw new AggregateError(errors,'Content example cleanup reported a failure.');return readSnapshot();})();return closePromise;
}
export const ready=(async()=>{
 const selected=new URLSearchParams(location.search).get('config');check(selected,'Build the example, then open its generated configuration link. / 请先构建示例，再打开生成的配置链接。');
 host=createCanvasHost({canvas,pixelRatio:1});engine=await createEngine({host,onDiagnostic(row){if(diagnostics.length<32)diagnostics.push({code:row.code,message:String(row.cause?.message??row.cause)});}});current({cancelled:false});engine.advanceTime(0);
 const record=fresh();pending=record;try{await prepare(record,selected);await mount(record);return readSnapshot();}catch(error){await retire(record);throw error;}finally{if(pending===record)pending=undefined;}
})().catch(async error=>{await retire(pending).catch(cleanup=>diagnostics.push({code:'EXAMPLE_CLEANUP',message:String(cleanup)}));if(!closing){state='failed';status.textContent=String(error.message);}throw error;});
void ready.catch(()=>{});
step.addEventListener('click',()=>{try{advance(Math.min(10,seconds+0.125));}catch(error){status.textContent=String(error.message);}});
document.querySelector('#close').addEventListener('click',()=>{void close().catch(error=>{status.textContent=String(error.message);});});
window.contentBuildExample=Object.freeze({ready,advance,readSnapshot,replace,cancelReplacement,close});
