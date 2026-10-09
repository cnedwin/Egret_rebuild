import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createEngine, Sprite, EgretError } from '@egret/engine';
import { spawnSync } from 'node:child_process';
import { createWebGPUHost } from '@egret/engine/webgpu';
export function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});promise.catch(()=>{});return {promise,resolve,reject};}
export const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
export function fixture(options={}){
 const calls=[],buffers=[],fences=[],maps=[],pops=[],lost=deferred(),pipeline=deferred(); let open=0;
 const queue={writeBuffer(...a){assert.equal(this,queue);calls.push(['write',...a]);},submit(...a){assert.equal(this,queue);calls.push(['submit',...a]);},onSubmittedWorkDone(){assert.equal(this,queue);const d=deferred();fences.push(d);calls.push(['fence']);return d.promise;}};
 const device={queue,limits:{maxTextureDimension2D:8192,maxBufferSize:268435456,maxVertexBuffers:1,maxVertexAttributes:2,maxVertexBufferArrayStride:24,maxColorAttachments:1,maxColorAttachmentBytesPerSample:4},lost:lost.promise,
 addEventListener(...a){calls.push(['add',...a]);},removeEventListener(...a){calls.push(['remove',...a]);},destroy(){calls.push(['deviceDestroy']);},
 pushErrorScope(k){calls.push(['push',k]);open++;},popErrorScope(){open--;const d=deferred();pops.push(d);calls.push(['pop']);return d.promise;},createShaderModule(d){calls.push(['shader',d]);return {};},createRenderPipelineAsync(d){calls.push(['pipeline',d]);return pipeline.promise;},
 createBuffer(d){calls.push(['buffer',d]);const data=new ArrayBuffer(d.size);const b={data,destroyed:0,unmapped:0,destroy(){assert.equal(this,b);b.destroyed++;calls.push(['destroyBuffer']);},unmap(){b.unmapped++;calls.push(['unmap']);},mapAsync(){const p=deferred();maps.push(p);calls.push(['map']);return p.promise;},getMappedRange(){calls.push(['mapped']);return data;}};buffers.push(b);return b;},
 createCommandEncoder(){calls.push(['encoder']);const encoder={beginRenderPass(d){calls.push(['pass',d]);const pass=Object.fromEntries(['setPipeline','setViewport','setScissorRect','setVertexBuffer','draw','end'].map(k=>[k,(...a)=>calls.push([k,...a])]));return pass;},copyTextureToBuffer(...a){calls.push(['copy',...a]);},finish(){calls.push(['finish']);return {};}};return encoder;}};
 const texture={createView(){calls.push(['view']);return {};}};
 const context={configure(d){assert.equal(this,context);calls.push(['configure',d]);},unconfigure(){calls.push(['unconfigure']);},getCurrentTexture(){calls.push(['texture']);return texture;}};
 const canvas={width:16,height:16,getContext(kind){calls.push(['context',kind]);return context;}};
 const gpu={requestAdapter:async()=>({requestDevice:async()=>device}),getPreferredCanvasFormat:()=>options.format??'rgba8unorm'};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu}});
 const settleScopes=()=>{for(const p of pops)p.resolve(null);};
 const ready=async(host)=>{const p=host.start();pipeline.resolve({});for(let i=0;i<4;i++){settleScopes();await tick();}await p;};
 const finish=async()=>{for(let i=0;i<3;i++){for(const f of fences)f.resolve();for(const m of maps)m.resolve();settleScopes();await tick();}};
 return {calls,buffers,fences,maps,pops,lost,pipeline,device,queue,canvas,context,gpu,settleScopes,ready,finish,get open(){return open;}};
}
export function frame(height=8){return {frameId:1,width:16,height:16,clearColor:0,clearAlpha:0,commands:[{kind:'rect',matrix:{a:1,b:0,c:0,d:1,tx:0,ty:0},rect:{x:1,y:1,width:8,height},color:0xff8000,alpha:0.5,clips:[]}]};}
const code=c=>e=>e.code===`WEBGPU_${c}`;
async function close(f,h){const p=h.close();await tick();await f.finish();await p;}
async function assertReserved(canvas){const denied=createWebGPUHost({canvas});denied.start=()=>{throw Error('reservation improperly opened');};await assert.rejects(createEngine({host:denied}),e=>e.code==='SURFACE_IN_USE');}
test('pure factory captures once, immutable surface and only undefined defaults',()=>{
 let reads=0;const canvas=new Proxy({}, {get(){throw Error('eager canvas');}});const h=createWebGPUHost({get canvas(){reads++;return canvas;}});
 assert.equal(reads,1);assert.equal(h.surface,canvas);assert.equal(Object.getOwnPropertyDescriptor(h,'surface').writable,false);
 for(const key of ['pixelRatio','maxBackingPixels','maxCommands','maxClipRectangles','maxPreparedVertices','maxClipEdgeTests','maxUploadBytes','maxPendingUploadBytes','maxPendingFrames','maxReadbackBytes','enableReadback','device','onDiagnostic'])assert.throws(()=>createWebGPUHost({canvas,[key]:null}),code('OPTIONS_INVALID'));
 for(const key of ['pixelRatio','maxBackingPixels','maxCommands','maxClipRectangles','maxPreparedVertices','maxClipEdgeTests','maxUploadBytes','maxPendingUploadBytes','maxPendingFrames','maxReadbackBytes'])for(const value of [0,-1,NaN,Infinity,-Infinity,'1',true,...(key==='pixelRatio'?[]:[1.5,Number.MAX_SAFE_INTEGER+1])])assert.throws(()=>createWebGPUHost({canvas,[key]:value}),code('OPTIONS_INVALID'));
 for(const policy of [1,'acquire',{}, {kind:'other'},{kind:'borrow',device:null},{kind:'borrow',device:1}])assert.throws(()=>createWebGPUHost({canvas,device:policy}),code('OPTIONS_INVALID'));
 for(const value of [0,1,'true',{}])assert.throws(()=>createWebGPUHost({canvas,enableReadback:value}),code('OPTIONS_INVALID'));
 const cause={};assert.throws(()=>createWebGPUHost({get canvas(){throw cause;}}),e=>e.code==='WEBGPU_OPTIONS_INVALID'&&e.cause===cause);
});
test('cached startup pops before pipeline await; repeated safe close identities',async()=>{
 const f=fixture(),h=createWebGPUHost({canvas:f.canvas});const p=h.start();assert.equal(h.start(),p);await tick();assert.equal(f.open,0);assert.deepEqual(f.calls.filter(c=>c[0]==='push').map(c=>c[1]),['out-of-memory','internal','validation']);
 f.pipeline.resolve({});for(let i=0;i<4;i++){f.settleScopes();await tick();}await p;assert.equal(h.start(),p);const q=h.close();assert.equal(h.close(),q);await tick();await f.finish();await q;assert.equal(h.close(),q);assert.equal(h.getStatus().cleanupOutcome,'safe');assert.equal(f.calls.filter(c=>c[0]==='deviceDestroy').length,1);
});
test('packing rejections are mutation free and armed tickets survive',async()=>{
 for(const [upload,device,expected] of [[143,144,'FRAME_BUDGET'],[144,143,'DEVICE_LIMIT'],[143,143,'FRAME_BUDGET']]){
 const f=fixture();f.device.limits.maxBufferSize=device;const h=createWebGPUHost({canvas:f.canvas,maxUploadBytes:upload,enableReadback:true});await f.ready(h);const ticket=h.requestReadback();const before=f.calls.length;assert.throws(()=>h.renderFrame(frame()),code(expected));assert.equal(f.calls.length,before);assert.equal(h.getStatus().lastSerial,0);assert.equal(h.getStatus().pendingFrames,0);assert.equal(h.getStatus().state,'active');await close(f,h);await assert.rejects(ticket,code('CLOSED'));}
});
test('exact buffers, global pending bounds, out of order retirement and snapshot idle',async()=>{
 const f=fixture();f.device.limits.maxBufferSize=144;const h=createWebGPUHost({canvas:f.canvas,maxUploadBytes:144,maxPendingUploadBytes:144});await f.ready(h);assert.equal(h.renderFrame(frame()),undefined);const idle=h.whenIdle();const empty=frame();empty.commands=[];h.renderFrame(empty);assert.throws(()=>h.renderFrame(empty),code('BACKPRESSURE'));assert.equal(h.getStatus().lastSerial,2);assert.equal(h.getStatus().pendingFrames,2);assert.equal(f.buffers[0].data.byteLength,144);
 f.settleScopes();f.fences[1].resolve();await tick();assert.equal(h.getStatus().pendingFrames,1);assert.equal(f.buffers[0].destroyed,0);f.fences[0].resolve();await idle;assert.equal(f.buffers[0].destroyed,1);await close(f,h);
});
test('collapsed thin and empty frames still clear with one byte upload budget',async()=>{
 const f=fixture(),h=createWebGPUHost({canvas:f.canvas,maxUploadBytes:1});await f.ready(h);h.renderFrame(frame(2**-40));assert.equal(f.buffers.length,0);assert.equal(h.getStatus().pendingFrames,1);assert.equal(h.getStatus().pendingUploadBytes,0);assert.equal(f.calls.filter(c=>c[0]==='pass').length,1);await f.finish();await close(f,h);
});
test('rejected fence drains peer and closes unsafe exactly once, borrowed survives',async()=>{
 const f=fixture(),h=createWebGPUHost({canvas:f.canvas,device:{kind:'borrow',device:f.device}});await f.ready(h);h.renderFrame(frame());h.renderFrame(frame());f.settleScopes();const cause={queue:'failed'};f.fences[0].reject(cause);await tick();assert.equal(h.getStatus().firstFailure.cause,cause);const p=h.close();assert.equal(h.close(),p);await tick();assert.equal(h.getStatus().state,'closing');assert.equal(f.buffers[1].destroyed,0);f.fences[1].resolve();await tick();await f.finish();await assert.rejects(p,e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cause);assert.deepEqual(f.buffers.map(b=>b.destroyed),[1,1]);assert.equal(h.getStatus().pendingFrames,0);assert.equal(f.calls.filter(c=>c[0]==='deviceDestroy').length,0);
});
test('readback copies padded BGRA rows before unmap, map precedes fence and retires before resolution',async()=>{
 const f=fixture({format:'bgra8unorm'}),h=createWebGPUHost({canvas:f.canvas,enableReadback:true,maxReadbackBytes:544});await f.ready(h);const ticket=h.requestReadback();const fr=frame();fr.width=4;fr.height=2;h.renderFrame(fr);assert.equal(h.getStatus().pendingReadbackBytes,544);assert.ok(f.calls.findIndex(c=>c[0]==='map')<f.calls.findIndex(c=>c[0]==='fence'));const bytes=new Uint8Array(f.buffers[1].data);bytes.set([1,2,3,4]);bytes.set([5,6,7,8],256);await f.finish();const result=await ticket;assert.deepEqual(Array.from(result.bytes.slice(0,4)),[3,2,1,4]);assert.deepEqual(Array.from(result.bytes.slice(16,20)),[7,6,5,8]);assert.equal(result.bytes.byteLength,32);assert.equal(f.buffers[1].unmapped,1);assert.deepEqual(f.buffers.map(b=>b.destroyed),[1,1]);assert.equal(h.getStatus().pendingReadbackBytes,0);assert.ok(Object.isFrozen(result));bytes[2]=99;assert.equal(result.bytes[0],3);result.bytes[0]=10;assert.equal(result.bytes[0],10);await close(f,h);
});
test('map rejection with settled fence never waits for successful retirement',async()=>{
 for(const mapFirst of [true,false]){const f=fixture(),h=createWebGPUHost({canvas:f.canvas,enableReadback:true});await f.ready(h);const p=h.requestReadback();h.renderFrame(frame());const cause={map:mapFirst};f.settleScopes();if(!mapFirst){f.fences[0].resolve();await tick();}f.maps[0].reject(cause);if(mapFirst)f.fences[0].resolve();await assert.rejects(p,e=>e.code==='WEBGPU_READBACK_FAILED'&&e.cause===cause);const q=h.close();await tick();await f.finish();await assert.rejects(q,e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cause);assert.deepEqual(f.buffers.map(b=>b.destroyed),[1,1]);assert.equal(h.getStatus().pendingFrames,0);}
});
test('busy precedes frame getters; getter stop prevents all mutations',async()=>{
 const f=fixture(),h=createWebGPUHost({canvas:f.canvas});await f.ready(h);let nestedReads=0;const fr=frame();Object.defineProperty(fr,'frameId',{get(){assert.throws(()=>h.renderFrame({get frameId(){nestedReads++;}}),code('REENTRANT'));h.stop();return 1;}});const before=f.calls.length;assert.throws(()=>h.renderFrame(fr),code('STOPPED'));assert.equal(nestedReads,0);assert.equal(f.calls.length,before);await close(f,h);
});
test('diagnostic returning close is observed without cycle; callback failures isolated',async()=>{
 const f=fixture();let h,called=0;h=createWebGPUHost({canvas:f.canvas,onDiagnostic(d){called++;assert.equal(f.open,0);assert.ok(Object.isFrozen(d));return h.close();}});await f.ready(h);h.renderFrame(frame());const cause={};f.fences[0].reject(cause);f.settleScopes();await tick();await f.finish();await assert.rejects(h.close(),code('CLOSE_UNSAFE'));await tick();assert.equal(called,1);assert.equal(h.getStatus().firstFailure.cause,cause);assert.equal(h.getStatus().callbackFailureCount,1);
});
test('stop/close at adapter/device/pipeline await drains late ownership',async()=>{
 for(const stage of ['adapter','device','pipeline'])for(const action of ['stop','close']){
 const f=fixture(),adapter=deferred(),device=deferred();f.gpu.requestAdapter=()=>adapter.promise;const h=createWebGPUHost({canvas:f.canvas}),p=h.start();await tick();
 if(stage!=='adapter'){adapter.resolve({requestDevice:()=>device.promise});await tick();}if(stage==='pipeline'){device.resolve(f.device);await tick();}
 const q=action==='close'?h.close():undefined;if(action==='stop')h.stop();adapter.resolve({requestDevice:()=>device.promise});device.resolve(f.device);f.pipeline.resolve({});f.settleScopes();await assert.rejects(p,code('START_CANCELLED'));await tick();f.settleScopes();
 const closing=q??h.close();await tick();await f.finish();await closing;assert.equal(f.calls.filter(c=>c[0]==='configure').length,0);assert.equal(f.calls.filter(c=>c[0]==='submit').length,0);assert.equal(f.calls.filter(c=>c[0]==='deviceDestroy').length,stage==='adapter'?0:1);
 }
});
test('start and close cache before reentrant getters, resource getter close gates submit',async()=>{
 const f=fixture();let h,nested;Object.defineProperty(f.canvas,'getContext',{get(){nested=h.start();return ()=>f.context;}});h=createWebGPUHost({canvas:f.canvas});const p=h.start();assert.equal(nested,p);f.pipeline.resolve({});for(let i=0;i<4;i++){f.settleScopes();await tick();}await p;
 const original=f.device.createBuffer;f.device.createBuffer=()=>{throw Error('replacement');}; // Captured original remains used.
 let q;const b=f.device.createBuffer; // Replacement is intentionally unused.
 f.device.createBuffer=original;
 const old=f.queue.writeBuffer;f.queue.writeBuffer=()=>{throw Error('replacement queue');};f.device.queue={};
 h.renderFrame(frame());assert.equal(f.buffers.length,1);assert.ok(f.calls.some(c=>c[0]==='write'));await f.finish();
 f.context.unconfigure=function(){q=h.close();};const closePromise=h.close();await tick();await f.finish();await closePromise;assert.equal(q,undefined); // Captured unconfigure cannot be redirected.
 assert.equal(f.buffers[0].destroyed,1);void old;void b;
});
test('mid-resource cleanup getter close aborts before write/encoding',async()=>{
 const f=fixture(),original=f.device.createBuffer;let h,closing;f.device.createBuffer=function(d){const b=original.call(this,d),destroy=b.destroy;Object.defineProperty(b,'destroy',{get(){closing=h.close();return destroy;}});return b;};h=createWebGPUHost({canvas:f.canvas});await f.ready(h);
 assert.throws(()=>h.renderFrame(frame()),code('RENDER_FAILED'));assert.equal(f.calls.filter(c=>c[0]==='write').length,0);assert.equal(f.calls.filter(c=>c[0]==='encoder').length,0);await tick();await f.finish();await closing;assert.equal(f.buffers[0].destroyed,1);
});
test('write before encoding throw still fences and can close safely',async()=>{
 const f=fixture(),cause={encode:true};f.device.createCommandEncoder=()=>{throw cause;};const h=createWebGPUHost({canvas:f.canvas});await f.ready(h);assert.throws(()=>h.renderFrame(frame()),e=>e.code==='WEBGPU_RENDER_FAILED'&&e.cause===cause);assert.equal(f.fences.length,1);assert.equal(f.buffers[0].destroyed,0);f.settleScopes();await tick();assert.equal(f.buffers[0].destroyed,0);f.fences[0].resolve();await tick();assert.equal(f.buffers[0].destroyed,1);await close(f,h);await assert.rejects(h.whenIdle(),code('RENDER_FAILED'));
});
test('partial push failure balances only pushed scopes, pop failure drains every peer',async()=>{
 for(const mode of ['push','pop']){const f=fixture(),cause={mode},push=f.device.pushErrorScope,pop=f.device.popErrorScope;let n=0;if(mode==='push')f.device.pushErrorScope=function(k){if(++n===2)throw cause;return push.call(this,k);};else f.device.popErrorScope=function(){if(++n===2)throw cause;return pop.call(this);};const h=createWebGPUHost({canvas:f.canvas});const p=h.start();await tick();f.pipeline.resolve({});f.settleScopes();await assert.rejects(p,e=>e.cause===cause);assert.equal(f.pops.length,mode==='push'?1:2);const q=h.close();await tick();await f.finish();if(mode==='pop')await assert.rejects(q,e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cause);else await q;}
});
test('validation-only failure retires safely, queue proof and final cleanup failure stay unsafe',async()=>{
 const f=fixture(),h=createWebGPUHost({canvas:f.canvas});await f.ready(h);h.renderFrame(frame());const fault={message:'validation'};f.pops.at(-3).resolve(fault);f.settleScopes();f.fences[0].resolve();await tick();assert.equal(h.getStatus().firstFailure.code,'WEBGPU_VALIDATION');assert.equal(f.buffers[0].destroyed,1);await close(f,h);assert.equal(h.getStatus().cleanupOutcome,'safe');
 const g=fixture(),j=createWebGPUHost({canvas:g.canvas});await g.ready(j);const q=j.close();await tick();const cause={final:true};g.fences.at(-1).reject(cause);await assert.rejects(q,e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cause);assert.equal(j.getStatus().state,'closed');
});
test('borrowed lost observer detaches after safe close; pre-proof loss is unsafe',async()=>{
 for(const before of [true,false]){const f=fixture(),h=createWebGPUHost({canvas:f.canvas,device:{kind:'borrow',device:f.device}});await f.ready(h);const q=h.close();await tick();const cause={reason:'destroyed'};if(before){f.lost.resolve(cause);await tick();}await f.finish();if(before)await assert.rejects(q,e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cause);else{await q;f.lost.resolve(cause);await tick();assert.equal(h.getStatus().firstFailure,null);assert.equal(h.getStatus().cleanupOutcome,'safe');}assert.equal(f.calls.filter(c=>c[0]==='deviceDestroy').length,0);}
});
test('diagnostic exceptions, native/cross-realm rejection and throwing then getter never recurse',async()=>{
 for(const mode of ['throw','native','realm','then','idle']){const f=fixture(),cause={callback:mode};let h,count=0;const unhandled=[];const handler=e=>unhandled.push(e);process.on('unhandledRejection',handler);try{h=createWebGPUHost({canvas:f.canvas,onDiagnostic(){count++;if(mode==='throw')throw cause;if(mode==='native')return Promise.reject(cause);if(mode==='realm')return vm.runInNewContext('(cause)=>Promise.reject(cause)')(cause);if(mode==='then')return {get then(){throw cause;}};return h.whenIdle();}});await f.ready(h);h.renderFrame(frame());const queueCause={};f.fences[0].reject(queueCause);f.settleScopes();await tick();await f.finish();await assert.rejects(h.close(),code('CLOSE_UNSAFE'));await new Promise(r=>setImmediate(r));assert.equal(count,1);assert.equal(h.getStatus().callbackFailureCount,1);assert.equal(h.getStatus().firstFailure.cause,queueCause);if(mode!=='idle')assert.equal(h.getStatus().lastCallbackFailure.cause,cause);assert.deepEqual(unhandled,[]);}finally{process.off('unhandledRejection',handler);}}
});
test('snapshot excludes a later pending frame and accepted serials do not reuse frame IDs',async()=>{
 const f=fixture(),h=createWebGPUHost({canvas:f.canvas});await f.ready(h);h.renderFrame(frame());const p=h.whenIdle();h.renderFrame(frame());f.settleScopes();f.fences[0].resolve();await p;assert.equal(h.getStatus().pendingFrames,1);assert.equal(h.getStatus().lastSerial,2);assert.equal(f.buffers[1].destroyed,0);await f.finish();h.renderFrame(frame());assert.equal(h.getStatus().lastSerial,3);await f.finish();await close(f,h);
});
test('rowPitch combined capacity and texture limit fail before mutation; tickets remain armed',async()=>{
 for(const [options,mutate,expected] of [[{maxReadbackBytes:543},f=>{f.width=4;f.height=2;},'FRAME_BUDGET'],[{},f=>{f.width=8193;f.height=1;},'DEVICE_LIMIT'],[{maxBackingPixels:10},()=>{},'BACKING_LIMIT'],[{maxCommands:1},f=>f.commands.push(f.commands[0]),'FRAME_BUDGET'],[{maxClipRectangles:1},f=>f.commands[0].clips=[{matrix:f.commands[0].matrix,rect:f.commands[0].rect},{matrix:f.commands[0].matrix,rect:f.commands[0].rect}],'FRAME_BUDGET'],[{maxPreparedVertices:5},()=>{},'FRAME_BUDGET'],[{maxClipEdgeTests:1},()=>{},'FRAME_BUDGET'],[{maxPendingUploadBytes:143},()=>{},'BACKPRESSURE']]){const f=fixture(),h=createWebGPUHost({canvas:f.canvas,enableReadback:true,...options});await f.ready(h);const ticket=h.requestReadback(),fr=frame();mutate(fr);const count=f.calls.length;assert.throws(()=>h.renderFrame(fr),code(expected));assert.equal(f.calls.length,count);assert.equal(h.getStatus().lastSerial,0);await close(f,h);await assert.rejects(ticket,code('CLOSED'));}
});
test('mapAsync synchronous throw maps READBACK_FAILED and unsafe proof',async()=>{
 const f=fixture(),cause={syncMap:true},original=f.device.createBuffer;f.device.createBuffer=function(d){const b=original.call(this,d);b.mapAsync=()=>{throw cause;};return b;};const h=createWebGPUHost({canvas:f.canvas,enableReadback:true});await f.ready(h);const p=h.requestReadback();assert.throws(()=>h.renderFrame(frame()),e=>e.code==='WEBGPU_READBACK_FAILED'&&e.cause===cause);await f.finish();await assert.rejects(p,e=>e.code==='WEBGPU_READBACK_FAILED'&&e.cause===cause);const q=h.close();await tick();await f.finish();await assert.rejects(q,e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cause);
});
test('startup stage error codes retain original causes and error scopes attach startup serial',async()=>{
 for(const [mode,expected] of [['gpu','UNAVAILABLE'],['adapter','ADAPTER_UNAVAILABLE'],['device','DEVICE_FAILED'],['context','CONTEXT_UNAVAILABLE'],['format','FORMAT_UNSUPPORTED'],['pipeline','START_FAILED'],['validation','VALIDATION']]){const f=fixture(),cause={mode};if(mode==='gpu')Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});if(mode==='adapter')f.gpu.requestAdapter=async()=>null;if(mode==='device')f.gpu.requestAdapter=async()=>({requestDevice:async()=>{throw cause;}});if(mode==='context')f.canvas.getContext=()=>null;if(mode==='format')f.gpu.getPreferredCanvasFormat=()=> 'rgba16float';const h=createWebGPUHost({canvas:f.canvas}),p=h.start();await tick();if(mode==='pipeline')f.pipeline.reject(cause);else f.pipeline.resolve({});if(mode==='validation')f.pops[0].resolve(cause);for(let i=0;i<3;i++){f.settleScopes();await tick();}await assert.rejects(p,e=>e.code===`WEBGPU_${expected}`&&(['device','pipeline','validation'].includes(mode)?e.cause===cause:true));assert.equal(h.getStatus().firstFailure.serial,null);await close(f,h);}
});
test('option getters captured exactly once without enumerating unknown keys',()=>{
 const counts={},canvas={},device={},policy=new Proxy({kind:'borrow',device},{get(o,k){counts[k]=(counts[k]??0)+1;return o[k];}});const input=new Proxy({canvas,device:policy,pixelRatio:2,onDiagnostic:()=>{}},{ownKeys(){throw Error('enumeration');},get(o,k){counts[`option:${String(k)}`]=(counts[`option:${String(k)}`]??0)+1;return o[k];}});const h=createWebGPUHost(input);assert.equal(h.surface,canvas);for(const count of Object.values(counts))assert.equal(count,1);assert.equal(counts.kind,1);assert.equal(counts.device,1);
});
test('fresh import/factory touches no navigator, canvas, GPU or scheduler; Canvas import loads no GPU/math',()=>{
 const program=`import {registerHooks} from 'node:module'; import assert from 'node:assert/strict'; const imports=[]; registerHooks({resolve(specifier,context,next){imports.push(specifier);return next(specifier,context);}}); for(const name of ['navigator','setTimeout','clearTimeout'])Object.defineProperty(globalThis,name,{configurable:true,get(){throw Error('eager '+name);}}); await import('@egret/engine/web'); assert.ok(!imports.some(s=>/robust-predicates|WebGPU|webgpuPass/.test(s))); const {createWebGPUHost}=await import('@egret/engine/webgpu'); createWebGPUHost({canvas:new Proxy({}, {get(){throw Error('canvas read');}}),device:{kind:'borrow',device:new Proxy({}, {get(){throw Error('device read');}})}});`;
 const result=spawnSync(process.execPath,['--input-type=module','--eval',program],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
});
test('pipeline rejection is observed even when call reentry closes startup',async()=>{
 const f=fixture();let h,q;f.device.createRenderPipelineAsync=()=>{q=h.close();return f.pipeline.promise;};h=createWebGPUHost({canvas:f.canvas});const p=h.start();await tick();const cause={pipeline:true};f.pipeline.reject(cause);f.settleScopes();await assert.rejects(p,code('START_CANCELLED'));await f.finish();await q;assert.equal(f.calls.filter(c=>c[0]==='configure').length,0);
});
test('close cleanup reentry returns cached promise and observes loss triggered at unconfigure',async()=>{
 const f=fixture();let h,nested;const cause={cleanupLost:true};f.context.unconfigure=()=>{nested=h.close();f.lost.resolve(cause);};h=createWebGPUHost({canvas:f.canvas});await f.ready(h);const p=h.close();await tick();await f.finish();await assert.rejects(p,e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cause);assert.equal(nested,p);
});
test('buffer destroy throws still drains other resource cleanup and counters',async()=>{
 const f=fixture(),original=f.device.createBuffer,cause={destroy:true};let n=0;f.device.createBuffer=function(d){const b=original.call(this,d);if(++n===1)b.destroy=()=>{b.destroyed++;throw cause;};return b;};const h=createWebGPUHost({canvas:f.canvas,enableReadback:true});await f.ready(h);const p=h.requestReadback();h.renderFrame(frame());await f.finish();await assert.rejects(p);const q=h.close();await tick();await f.finish();await assert.rejects(q,e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cause);assert.deepEqual(f.buffers.map(b=>b.destroyed),[1,1]);assert.equal(h.getStatus().pendingFrames,0);assert.equal(h.getStatus().pendingReadbackBytes,0);
});
test('Engine timeout keeps lease, late safe close releases and late rejected close quarantines',async()=>{
 for(const unsafe of [false,true]){const f=fixture(),h=createWebGPUHost({canvas:f.canvas});await f.ready(h);const timers=[],savedSet=globalThis.setTimeout,savedClear=globalThis.clearTimeout;globalThis.setTimeout=function(fn,delay){assert.equal(this,globalThis);const t={fn,delay};timers.push(t);return t;};globalThis.clearTimeout=function(){assert.equal(this,globalThis);};try{const diagnostics=[],engine=await createEngine({host:h,shutdownTimeoutMs:17,onDiagnostic:d=>diagnostics.push(d)});const shape=new Sprite();shape.graphics.beginFill(0xff0000).drawRect(1,1,8,8);engine.stage.addChild(shape);engine.renderFrame({width:16,height:16});const disposal=engine.dispose();await tick();assert.equal(engine.stage.isDisposed,true);assert.equal(f.buffers[0].destroyed,0);assert.equal(timers[0].delay,17);timers[0].fn();await assert.rejects(disposal,e=>e.code==='ENGINE_CLOSE_TIMEOUT');await assertReserved(f.canvas);if(unsafe)f.fences[0].reject({queue:true});await f.finish();await tick();assert.equal(engine.dispose(),disposal);if(unsafe){assert.ok(diagnostics.some(d=>d.code==='HOST_CLOSE_LATE_FAILURE'));await assertReserved(f.canvas);}else{const nextHost=createWebGPUHost({canvas:f.canvas});await f.ready(nextHost);const next=await createEngine({host:nextHost});const d=next.dispose();await f.finish();await d;}}finally{globalThis.setTimeout=savedSet;globalThis.clearTimeout=savedClear;}}
});
test('Engine wrappers retain host input errors and CPU finally keeps stage live during getter disposal',async()=>{
 const f=fixture(),h=createWebGPUHost({canvas:f.canvas,maxBackingPixels:1});await f.ready(h);const engine=await createEngine({host:h});assert.throws(()=>engine.renderFrame({width:2,height:2}),e=>e.code==='FRAME_RENDER_FAILED'&&e.cause.code==='WEBGPU_BACKING_LIMIT');let closing;assert.throws(()=>engine.renderFrame({get width(){closing=engine.dispose();assert.equal(engine.stage.isDisposed,false);return 1;},height:1}),e=>e.code==='ENGINE_CLOSED');await tick();await f.finish();await closing;
});
test('readback misuse is promise-only; stop cancels armed but preserves submitted ticket',async()=>{
 const f=fixture(),h=createWebGPUHost({canvas:f.canvas,enableReadback:true});await assert.rejects(h.requestReadback(),code('NOT_STARTED'));await f.ready(h);const p=h.requestReadback();await assert.rejects(h.requestReadback(),code('READBACK_PENDING'));h.stop();await assert.rejects(p,code('STOPPED'));await close(f,h);
 const g=fixture(),j=createWebGPUHost({canvas:g.canvas,enableReadback:true});await g.ready(j);const q=j.requestReadback();j.renderFrame(frame());j.stop();await g.finish();assert.equal((await q).serial,1);await close(g,j);
 const b=fixture(),k=createWebGPUHost({canvas:b.canvas});await b.ready(k);await assert.rejects(k.requestReadback(),code('READBACK_DISABLED'));await close(b,k);
});
test('raw input faults retain identity, no mutation; safe cancellation close idle resolves',async()=>{
 const f=fixture(),h=createWebGPUHost({canvas:f.canvas});await f.ready(h);const cause=new RangeError('CPU/input fault'),input=frame();Object.defineProperty(input,'commands',{get(){throw cause;}});const n=f.calls.length;assert.throws(()=>h.renderFrame(input),e=>e.code==='WEBGPU_FRAME_INVALID'&&e.cause===cause);assert.equal(f.calls.length,n);assert.equal(h.getStatus().state,'active');await close(f,h);
 const g=fixture(),j=createWebGPUHost({canvas:g.canvas});const p=j.start();await tick();j.stop();g.pipeline.resolve({});g.settleScopes();await assert.rejects(p,code('START_CANCELLED'));await close(g,j);await j.whenIdle();
});
test('uncapturable acquired-device cleanup cannot claim safe ownership return',async()=>{
 const f=fixture(),cause={destroyGetter:true};Object.defineProperty(f.device,'destroy',{get(){throw cause;}});const h=createWebGPUHost({canvas:f.canvas});await assert.rejects(h.start(),e=>e.code==='WEBGPU_START_FAILED'&&e.cause===cause);await assert.rejects(h.close(),e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cause);assert.equal(h.getStatus().state,'closed');assert.equal(h.getStatus().cleanupOutcome,'unsafe');
});
test('asynchronously rejected pop drains peers, latches unsafe and retains original scope cause',async()=>{
 const f=fixture(),h=createWebGPUHost({canvas:f.canvas});await f.ready(h);h.renderFrame(frame());const cause={popRejected:true};f.pops.at(-2).reject(cause);f.settleScopes();f.fences[0].resolve();await tick();assert.equal(h.getStatus().firstFailure.code,'WEBGPU_SCOPE_FAILED');assert.equal(h.getStatus().firstFailure.cause,cause);assert.equal(f.buffers[0].destroyed,0);const q=h.close();await f.finish();await assert.rejects(q,e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cause);assert.equal(f.buffers[0].destroyed,1);
});
test('captured callback/options cannot redirect failures or limits',async()=>{
 const f=fixture();let original=0,replaced=0;const options={canvas:f.canvas,maxUploadBytes:143,onDiagnostic:()=>{original++;}};const h=createWebGPUHost(options);options.canvas={};options.maxUploadBytes=144;options.onDiagnostic=()=>{replaced++;};await f.ready(h);assert.throws(()=>h.renderFrame(frame()),code('FRAME_BUDGET'));const empty=frame();empty.commands=[];h.renderFrame(empty);f.fences[0].reject({queue:true});f.settleScopes();await tick();await f.finish();await assert.rejects(h.close(),code('CLOSE_UNSAFE'));assert.equal(original,1);assert.equal(replaced,0);
});
test('scheduler lazily captures receivers once, survives close and cancel is idempotent',async()=>{
 const f=fixture(),h=createWebGPUHost({canvas:f.canvas});await f.ready(h);await close(f,h);const savedSet=globalThis.setTimeout,savedClear=globalThis.clearTimeout;let sets=0,clears=0;try{globalThis.setTimeout=function(fn,delay){assert.equal(this,globalThis);assert.equal(delay,17);sets++;return {fn};};globalThis.clearTimeout=function(){assert.equal(this,globalThis);clears++;};const cancel=h.setTimeout(()=>{},17);globalThis.setTimeout=()=>{throw Error('reread scheduler');};globalThis.clearTimeout=()=>{throw Error('reread clear');};cancel();cancel();h.setTimeout(()=>{},17)();assert.equal(sets,2);assert.equal(clears,2);}finally{globalThis.setTimeout=savedSet;globalThis.clearTimeout=savedClear;}
});
test('cross-realm device-shaped borrow and adapter/device thenables are defensive boundaries',async()=>{
 const f=fixture(),borrowed=vm.runInNewContext('({})');Object.assign(borrowed,f.device);const h=createWebGPUHost({canvas:f.canvas,device:{kind:'borrow',device:borrowed}});await f.ready(h);h.renderFrame(frame());await f.finish();await close(f,h);assert.equal(f.calls.filter(c=>c[0]==='deviceDestroy').length,0);
 const g=fixture();g.gpu.requestAdapter=()=>({then(resolve){resolve({requestDevice:()=>({then(done){done(g.device);}})});}});const j=createWebGPUHost({canvas:g.canvas});await g.ready(j);await close(g,j);assert.equal(j.getStatus().cleanupOutcome,'safe');
});

test('fix1 R1 binds one ticket to frame A while frame B settles in either order', async () => {
 for (const secondFirst of [false,true]) {
  const f=fixture(),h=createWebGPUHost({canvas:f.canvas,enableReadback:true});
  await f.ready(h);
  const ticket=h.requestReadback(),a=frame(),b=frame(); a.frameId=11;b.frameId=22;
  let settled=false;ticket.then(()=>{settled=true;},()=>{settled=true;});
  h.renderFrame(a);h.renderFrame(b);
  assert.equal(f.calls.filter(c=>c[0]==='copy').length,1,'only the bound frame copies');
  assert.equal(f.maps.length,1,'only the bound frame maps');
  assert.equal(h.getStatus().pendingReadbackBytes,5120);
  assert.equal(f.buffers.length,3,'A vertex/staging plus B vertex');
  await assert.rejects(h.requestReadback(),code('READBACK_PENDING'));
  f.settleScopes();
  if(secondFirst){
   f.fences[1].resolve();await tick();
   assert.equal(settled,false);assert.equal(f.buffers[1].destroyed,0);
   assert.equal(h.getStatus().pendingReadbackBytes,5120);
   await assert.rejects(h.requestReadback(),code('READBACK_PENDING'));
   f.maps[0].resolve();await tick();assert.equal(settled,false);
   f.fences[0].resolve();
  }else{
   f.fences[0].resolve();await tick();assert.equal(settled,false);
   await assert.rejects(h.requestReadback(),code('READBACK_PENDING'));
   f.maps[0].resolve();
  }
  const result=await ticket;
  assert.equal(result.serial,1);assert.equal(result.frameId,11);
  assert.equal(f.buffers[1].destroyed,1);assert.equal(h.getStatus().pendingReadbackBytes,0);
  if(!secondFirst)assert.equal(f.buffers[2].destroyed,0,'B is still pending independently');
  const next=h.requestReadback();h.stop();await assert.rejects(next,code('STOPPED'));
  await f.finish();await close(f,h);
 }
});
test('fix1 R1 exact single-readback budget admits the later ordinary frame', async () => {
 const f=fixture(),h=createWebGPUHost({canvas:f.canvas,enableReadback:true,maxReadbackBytes:5120});
 await f.ready(h);const ticket=h.requestReadback();h.renderFrame(frame());
 assert.equal(h.renderFrame(frame()),undefined,'B needs no second readback reservation');
 assert.equal(h.getStatus().pendingFrames,2);assert.equal(h.getStatus().pendingReadbackBytes,5120);
 await f.finish();assert.equal((await ticket).serial,1);await close(f,h);
});
test('fix1 R2 undefined synchronous startup exceptions fail all three boundaries', async () => {
 for(const boundary of ['shader','pipeline','configure']) {
  const f=fixture();
  if(boundary==='shader')f.device.createShaderModule=()=>{throw undefined;};
  if(boundary==='pipeline')f.device.createRenderPipelineAsync=()=>{throw undefined;};
  if(boundary==='configure')f.context.configure=()=>{throw undefined;};
  const h=createWebGPUHost({canvas:f.canvas}),p=h.start();
  f.pipeline.resolve({});for(let i=0;i<4;i++){f.settleScopes();await tick();}
  await assert.rejects(p,e=>e.code==='WEBGPU_START_FAILED'&&e.cause===undefined);
  assert.equal(h.getStatus().state,'failed');assert.equal(h.getStatus().firstFailure.code,'WEBGPU_START_FAILED');
  assert.equal(h.getStatus().firstFailure.cause,undefined);assert.equal(f.open,0);
  const closePromise=h.close();await f.finish();await closePromise;
  assert.equal(f.calls.filter(c=>c[0]==='deviceDestroy').length,1);
  assert.equal(f.calls.filter(c=>c[0]==='unconfigure').length,boundary==='configure'?1:0);
 }
});
test('fix1 R2 stop or close during an undefined throw preserves startup cancellation', async () => {
 for(const boundary of ['shader','pipeline','configure'])for(const action of ['stop','close']) {
  const f=fixture();let h,closing;
  const fault=()=>{if(action==='stop')h.stop();else closing=h.close();throw undefined;};
  if(boundary==='shader')f.device.createShaderModule=fault;
  if(boundary==='pipeline')f.device.createRenderPipelineAsync=fault;
  if(boundary==='configure')f.context.configure=fault;
  h=createWebGPUHost({canvas:f.canvas});const p=h.start();f.pipeline.resolve({});
  for(let i=0;i<4;i++){f.settleScopes();await tick();}
  await assert.rejects(p,e=>e.code==='WEBGPU_START_CANCELLED'&&e.cause===undefined);
  assert.equal(f.open,0);assert.equal(f.calls.filter(c=>c[0]==='submit').length,0);
  closing??=h.close();await f.finish();await closing;
  assert.equal(h.getStatus().cleanupOutcome,'safe');assert.equal(f.calls.filter(c=>c[0]==='deviceDestroy').length,1);
 }
});
test('fix1 R3 external EgretError stays the original stage cause even with a legitimate code', async () => {
 for(const boundary of ['provider','adapter','device','context','queueGetter','shader','pipeline','asyncPipeline','configure'])for(const externalCode of ['SENTINEL_EXTERNAL','WEBGPU_VALIDATION']){
  const f=fixture(),inner={},cause=new EgretError(externalCode,{cause:inner});const diagnostics=[];
  let expected='WEBGPU_START_FAILED';
  if(boundary==='provider'){f.gpu.getPreferredCanvasFormat=()=>{throw cause;};expected='WEBGPU_UNAVAILABLE';}
  if(boundary==='adapter'){f.gpu.requestAdapter=async()=>{throw cause;};expected='WEBGPU_ADAPTER_UNAVAILABLE';}
  if(boundary==='device'){f.gpu.requestAdapter=async()=>({requestDevice:async()=>{throw cause;}});expected='WEBGPU_DEVICE_FAILED';}
  if(boundary==='context'){f.canvas.getContext=()=>{throw cause;};expected='WEBGPU_CONTEXT_UNAVAILABLE';}
  if(boundary==='queueGetter')Object.defineProperty(f.device,'queue',{get(){throw cause;}});
  if(boundary==='shader')f.device.createShaderModule=()=>{throw cause;};
  if(boundary==='pipeline')f.device.createRenderPipelineAsync=()=>{throw cause;};
  if(boundary==='asyncPipeline')f.device.createRenderPipelineAsync=async()=>{throw cause;};
  if(boundary==='configure')f.context.configure=()=>{throw cause;};
  const h=createWebGPUHost({canvas:f.canvas,onDiagnostic:d=>diagnostics.push(d)}),p=h.start();
  f.pipeline.resolve({});for(let i=0;i<4;i++){f.settleScopes();await tick();}
  await assert.rejects(p,e=>e.code===expected&&e.cause===cause);
  assert.equal(h.getStatus().firstFailure.code,expected);assert.equal(h.getStatus().firstFailure.cause,cause);
  assert.equal(diagnostics.length,1);assert.equal(diagnostics[0].code,expected);assert.equal(diagnostics[0].cause,cause);
  assert.equal(f.open,0);await close(f,h);
 }
});
test('fix1 R3 matching existing backend code cannot make a later external frame fault host-origin', async () => {
 const f=fixture(),deviceFault={},inner={},external=new EgretError('WEBGPU_UNCAPTURED_ERROR',{cause:inner});
 f.device.createCommandEncoder=()=>{
  const listener=f.calls.find(c=>c[0]==='add')[2];
  listener({error:deviceFault});
  throw external;
 };
 const h=createWebGPUHost({canvas:f.canvas});await f.ready(h);
 assert.throws(()=>h.renderFrame(frame()),e=>e.code==='WEBGPU_RENDER_FAILED'&&e.cause===external);
 assert.equal(h.getStatus().firstFailure.code,'WEBGPU_UNCAPTURED_ERROR');
 assert.equal(h.getStatus().firstFailure.cause,deviceFault);
 await f.finish();await close(f,h);
});
test('fix1 R3 a previously exposed public host error is still an external startup cause', async () => {
 const f=fixture(),h=createWebGPUHost({canvas:f.canvas});
 const external=await h.requestReadback().catch(e=>e);
 assert.equal(external.code,'WEBGPU_NOT_STARTED');
 f.canvas.getContext=()=>{throw external;};
 await assert.rejects(h.start(),e=>e.code==='WEBGPU_CONTEXT_UNAVAILABLE'&&e.cause===external);
 assert.equal(h.getStatus().firstFailure.cause,external);await close(f,h);
});
test('fix1 R3 private startup scope and limit signals still expose frozen public classifications', async () => {
 for(const mode of ['limit','validation','rejectedPop']) {
  const f=fixture(),fault=new EgretError('SENTINEL_EXTERNAL');
  if(mode==='limit')f.device.limits.maxVertexAttributes=1;
  const h=createWebGPUHost({canvas:f.canvas}),p=h.start();await tick();f.pipeline.resolve({});
  if(mode==='validation')f.pops[0].resolve(fault);
  if(mode==='rejectedPop')f.pops[0].reject(fault);
  for(let i=0;i<4;i++){f.settleScopes();await tick();}
  const expected=mode==='limit'?'DEVICE_LIMIT':mode==='validation'?'VALIDATION':'SCOPE_FAILED';
  await assert.rejects(p,e=>e instanceof EgretError&&e.code===`WEBGPU_${expected}`&&e.cause===(mode==='limit'?undefined:fault));
  assert.equal(h.getStatus().firstFailure.code,`WEBGPU_${expected}`);
  const q=h.close();await f.finish();if(mode==='rejectedPop')await assert.rejects(q,code('CLOSE_UNSAFE'));else await q;
 }
});
test('fix1 R4 prior synchronous render failure plus destroy fault stays unsafe and quarantined', async () => {
 const f=fixture(),renderCause={encoding:true},cleanupCause={destroy:true},original=f.device.createBuffer;
 f.device.createBuffer=function(descriptor){
  const buffer=original.call(this,descriptor);
  buffer.destroy=()=>{buffer.destroyed++;throw cleanupCause;};
  return buffer;
 };
 f.device.createCommandEncoder=()=>{throw renderCause;};
 const h=createWebGPUHost({canvas:f.canvas});await f.ready(h);
 const engine=await createEngine({host:h}),shape=new Sprite();
 shape.graphics.beginFill(0xff0000).drawRect(1,1,8,8);engine.stage.addChild(shape);
 assert.throws(()=>engine.renderFrame({width:16,height:16}),e=>e.code==='FRAME_RENDER_FAILED'&&e.cause.code==='WEBGPU_RENDER_FAILED'&&e.cause.cause===renderCause);
 const first=h.getStatus().firstFailure;
 assert.equal(first.code,'WEBGPU_RENDER_FAILED');assert.equal(first.cause,renderCause);
 assert.equal(f.buffers[0].destroyed,0);assert.equal(f.fences.length,1);
 const disposal=engine.dispose();await tick();assert.equal(f.buffers[0].destroyed,0);
 await f.finish();
 await assert.rejects(disposal,e=>e.code==='ENGINE_CLOSE_FAILED'&&e.cause.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause.cause===cleanupCause);
 const closePromise=h.close();assert.equal(h.close(),closePromise);
 await assert.rejects(closePromise,e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cleanupCause);
 assert.equal(h.getStatus().firstFailure,first);assert.equal(h.getStatus().cleanupOutcome,'unsafe');
 assert.equal(h.getStatus().pendingFrames,0);assert.equal(h.getStatus().pendingUploadBytes,0);
 assert.equal(f.buffers[0].destroyed,1);assert.equal(f.calls.filter(c=>c[0]==='deviceDestroy').length,1);
 await assertReserved(f.canvas);
});
test('fix1 R4 prior validation render failure plus unmap fault drains every owned resource', async () => {
 const f=fixture(),renderCause={validation:true},cleanupCause={unmap:true},original=f.device.createBuffer;
 f.device.createBuffer=function(descriptor){
  const buffer=original.call(this,descriptor);
  if(descriptor.usage===9)buffer.unmap=()=>{buffer.unmapped++;throw cleanupCause;};
  return buffer;
 };
 const h=createWebGPUHost({canvas:f.canvas,enableReadback:true});await f.ready(h);
 const engine=await createEngine({host:h}),shape=new Sprite();
 shape.graphics.beginFill(0xff0000).drawRect(1,1,8,8);engine.stage.addChild(shape);
 const ticket=h.requestReadback();engine.renderFrame({width:16,height:16});
 f.pops.at(-3).resolve(renderCause);f.settleScopes();f.maps[0].resolve();f.fences[0].resolve();await tick();
 await assert.rejects(ticket,e=>e.code==='WEBGPU_VALIDATION'&&e.cause===renderCause);
 const first=h.getStatus().firstFailure;
 assert.equal(first.code,'WEBGPU_VALIDATION');assert.equal(first.cause,renderCause);
 const disposal=engine.dispose();await f.finish();
 await assert.rejects(disposal,e=>e.code==='ENGINE_CLOSE_FAILED'&&e.cause.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause.cause===cleanupCause);
 assert.equal(h.getStatus().firstFailure,first);assert.equal(h.getStatus().cleanupOutcome,'unsafe');
 assert.equal(h.getStatus().pendingFrames,0);assert.equal(h.getStatus().pendingUploadBytes,0);assert.equal(h.getStatus().pendingReadbackBytes,0);
 assert.equal(f.buffers[1].unmapped,1);assert.deepEqual(f.buffers.map(b=>b.destroyed),[1,1]);
 const closePromise=h.close();assert.equal(h.close(),closePromise);
 await assert.rejects(closePromise,e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cleanupCause);
 assert.equal(f.calls.filter(c=>c[0]==='deviceDestroy').length,1);await assertReserved(f.canvas);
});
