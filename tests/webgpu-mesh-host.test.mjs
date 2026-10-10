import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {isMainThread, threadId} from 'node:worker_threads';

// All expectations below are first-party contract literals, independently
// authored before the minimal Host port. Hashes identify input bytes only.
const CASE_ORDER = Object.freeze(['S01','N01','N02','N03','N04','N05','P01','P02','R01','C01','C02','C03','C04']);
const PROTOCOL_KEYS = Object.freeze(['version','createSceneFrame3D','isSceneFrame3D','getScene3DErrorOrigin','packMeshGeometry3D','getMeshPacking3DErrorOrigin','createWebGPUMeshPipeline','encodeWebGPUMesh']);
const QUOTAS = Object.freeze({modules:2048,fileBytes:1048576,sourceBytes:16777216,tokens:1048576,depth:256,stdoutBytes:1048576,stderrBytes:1048576,receiptBytes:262144,events:4096,stringUnits:2048,operationMs:10000,closeMs:5000,retirementMs:5000,workerMs:300000});

// Literal generated source will contain the closed parser, mock and scenarios.
// The Stage A author seals these unexecuted bytes for independent review.
const DRIVER_SOURCE = String.raw`
/* B1_DRIVER_BEGIN */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {registerHooks} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {isMainThread, threadId} from 'node:worker_threads';

const FIXED_CASES = ['S01','N01','N02','N03','N04','N05','P01','P02','R01','C01','C02','C03','C04'];
const FIXED_PROTOCOL_KEYS = ['version','createSceneFrame3D','isSceneFrame3D','getScene3DErrorOrigin','packMeshGeometry3D','getMeshPacking3DErrorOrigin','createWebGPUMeshPipeline','encodeWebGPUMesh'];
const MATRIX_IDENTITY = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const TRIANGLE = {positions:[0,0,-1,1,0,-1,0,1,-1],colors:[1,0,0,0,1,0,0,0,1],indices:[0,1,2]};
const PROJECTION = {kind:'orthographic',left:-1,right:1,bottom:-1,top:1,near:1,far:3};
const FORBIDDEN_SCENE_NAMES = ['renderSceneFrame','getSceneStatus'];

function sceneFree(value) {
  for (let object = value; object !== null; object = Object.getPrototypeOf(object)) {
    for (const name of FORBIDDEN_SCENE_NAMES) assert.equal(Object.hasOwn(object,name),false,'ordinary whole prototype chain: '+name);
  }
}
function protocolAssertions(namespace, references) {
  const protocol = namespace.getBuiltinB1Protocol();
  assert.equal(namespace.getBuiltinB1Protocol(),protocol,'stable owned protocol identity');
  assert.equal(Object.getPrototypeOf(protocol),Object.prototype);
  assert.deepEqual(Object.keys(protocol),FIXED_PROTOCOL_KEYS);
  assert.deepEqual(Object.getOwnPropertySymbols(protocol),[]);
  assert.equal(Object.isFrozen(protocol),true);
  assert.equal(protocol.version,'egret.internal.b1/1');
  for (const key of FIXED_PROTOCOL_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(protocol,key);
    assert.equal(Object.hasOwn(descriptor,'value'),true,key+' data descriptor');
    assert.equal(descriptor.enumerable,true); assert.equal(descriptor.writable,false); assert.equal(descriptor.configurable,false);
    if (key !== 'version') assert.equal(descriptor.value,references[key],key+' actual function reference');
  }
  assert.equal(namespace.isBuiltinB1Protocol(protocol),true);
  let reads = 0;
  const proxy = new Proxy(protocol,{get(){reads++;throw Error('predicate property read');},getPrototypeOf(){reads++;throw Error('predicate prototype read');}});
  assert.equal(namespace.isBuiltinB1Protocol(proxy),false);
  const revoked = Proxy.revocable(protocol,{}); revoked.revoke();
  assert.equal(namespace.isBuiltinB1Protocol(revoked.proxy),false);
  assert.equal(namespace.isBuiltinB1Protocol(Object.freeze({...protocol})),false);
  assert.equal(reads,0,'authentic predicate has no value/prototype reads');
  return protocol;
}

// Named fixed host assertions are deliberately present before the Host port.
// A later final implementation must satisfy all of them; no hash computes an answer.
async function hostBehaviorAssertions(factory, protocol, core, fixture) {
  const geometry = core.createMeshGeometry3D(TRIANGLE);
  const modelView = core.createMatrix4(MATRIX_IDENTITY);
  const genuine = protocol.createSceneFrame3D({projection:PROJECTION,draws:[{geometry,modelView},{geometry,modelView}]});
  assert.equal(genuine.sceneBytes,84); assert.equal(genuine.uniformBytes,128);
  const overlay = (commands = [], extra = {}) => ({frameId:7,width:1,height:1,clearColor:0x102030,clearAlpha:1,commands,...extra});
  const rect = {kind:'rect',matrix:{a:1,b:0,c:0,d:1,tx:0,ty:0},rect:{x:0,y:0,width:1,height:1},color:0xff0000,alpha:1,clips:[]};
  const create = async options => {const f=fixture();const h=factory({canvas:f.canvas,device:{kind:'borrow',device:f.device},...options});f.host=h;await h.start();return {f,h};};
  const close = async h => {const p=h.close();p.catch(()=>{});await p;};

  { // H01: authentic scene admission precedes foreign reads, GPU work and counters.
    const {f,h}=await create({}); const before=h.getSceneStatus(); const n=f.events.length;
    let reads=0;const foreign=new Proxy({}, {get(){reads++;throw Error('foreign scene read');},getPrototypeOf(){reads++;throw Error('foreign prototype read');}});
    assert.throws(()=>h.renderSceneFrame(foreign,overlay()),e=>e.code==='WEBGPU_FRAME_INVALID','H01 foreign scene rejection');
    assert.equal(reads,0);assert.equal(f.events.length,n);assert.deepEqual(h.getSceneStatus(),before);
    assert.throws(()=>h.renderSceneFrame(Object.freeze({...genuine}),overlay()),e=>e.code==='WEBGPU_FRAME_INVALID');
    const wrapped=Proxy.revocable(genuine,{});wrapped.revoke();assert.throws(()=>h.renderSceneFrame(wrapped.proxy,overlay()),e=>e.code==='WEBGPU_FRAME_INVALID');
    await close(h);
  }
  { // H02: actual repeat identity packs once, each draw retains its own 64-byte matrix.
    const {f,h}=await create({});f.holdFence=true;
    const f32=globalThis.Float32Array,u32=globalThis.Uint32Array;let vertexPacks=0,indexPacks=0;
    globalThis.Float32Array=new Proxy(f32,{construct(target,args){if(args[0]===18)vertexPacks++;return Reflect.construct(target,args,target);}});
    globalThis.Uint32Array=new Proxy(u32,{construct(target,args){if(args[0]===3)indexPacks++;return Reflect.construct(target,args,target);}});
    try{assert.equal(h.renderSceneFrame(genuine,overlay()),undefined,'H02 scene submission is synchronous');}finally{globalThis.Float32Array=f32;globalThis.Uint32Array=u32;}
    assert.equal(vertexPacks,1,'one real trusted packing allocation for repeated geometry');assert.equal(indexPacks,1);
    const status=h.getSceneStatus();assert.equal(status.host.pendingUploadBytes,212);assert.equal(status.pendingSceneBytes,84);assert.equal(status.pendingUniformBytes,128);assert.equal(status.pendingDepthBytes,4);
    const created=f.events.filter(e=>e.kind==='buffer');assert.deepEqual(created.map(e=>[e.size,e.usage]).sort((a,b)=>a[1]-b[1]),[[12,24],[72,40],[64,72],[64,72]]);
    const writes=f.events.filter(e=>e.kind==='writeBuffer');assert.equal(writes.length,4);assert.equal(writes.filter(e=>e.byteLength===64).length,2);
    assert.equal(f.events.filter(e=>e.kind==='drawIndexed').length,2);assert.equal(f.events.filter(e=>e.kind==='submit').length,1);
    f.releaseFences();await h.whenIdle();assert.equal(h.getSceneStatus().host.pendingUploadBytes,0);assert.equal(h.getSceneStatus().pendingSceneBytes,0);assert.equal(h.getSceneStatus().pendingUniformBytes,0);assert.equal(h.getSceneStatus().pendingDepthBytes,0);
    assert.equal(f.buffers.every(b=>b.destroyed===1),true);assert.equal(f.textures.every(t=>t.destroyed===1),true);await close(h);
  }
  { // H03: equal-content distinct geometry charges twice; empty draw still has a uniform.
    const equal=core.createMeshGeometry3D(TRIANGLE), empty=core.createMeshGeometry3D({positions:[],colors:[],indices:[]});
    const value=protocol.createSceneFrame3D({projection:PROJECTION,draws:[{geometry,modelView},{geometry:equal,modelView},{geometry:empty,modelView}]});
    const {f,h}=await create({});f.holdFence=true;h.renderSceneFrame(value,overlay());assert.equal(h.getSceneStatus().pendingSceneBytes,168);assert.equal(h.getSceneStatus().pendingUniformBytes,192);assert.equal(h.getSceneStatus().host.pendingUploadBytes,360);assert.equal(f.events.filter(e=>e.kind==='drawIndexed').length,2);
    assert.equal(f.events.filter(e=>e.kind==='buffer'&&e.usage===72&&e.size===64).length,3);f.releaseFences();await h.whenIdle();await close(h);
  }
  { // H04: full configured UI+scene upload admission precedes mutations and ticket binding.
    const {f,h}=await create({maxUploadBytes:355,enableReadback:true});const ticket=h.requestReadback();ticket.catch(()=>{});const n=f.events.length;
    assert.throws(()=>h.renderSceneFrame(genuine,overlay([rect])),e=>e.code==='WEBGPU_FRAME_BUDGET');assert.equal(h.getStatus().lastSerial,0);assert.equal(h.getStatus().pendingFrames,0);assert.equal(f.events.length,n);assert.equal(h.getStatus().pendingReadbackBytes,0);
    h.renderSceneFrame(protocol.createSceneFrame3D({projection:PROJECTION,draws:[]}),overlay());await ticket;await h.whenIdle();await close(h);
  }
  for(const cap of [259,260]) { // H05: combined staging256 + output4, not component-only admission.
    const {f,h}=await create({maxReadbackBytes:cap,enableReadback:true});const ticket=h.requestReadback();ticket.catch(()=>{});const n=f.events.length;
    if(cap===259){assert.throws(()=>h.renderSceneFrame(genuine,overlay()),e=>e.code==='WEBGPU_FRAME_BUDGET');assert.equal(f.events.length,n);assert.equal(h.getStatus().lastSerial,0);h.stop();await assert.rejects(ticket,e=>e.code==='WEBGPU_STOPPED');}
    else {f.holdFence=true;h.renderSceneFrame(genuine,overlay());assert.equal(h.getStatus().pendingReadbackBytes,260);f.releaseFences();const pixels=await ticket;assert.equal(pixels.bytes.byteLength,4);assert.equal(pixels.serial,1);await h.whenIdle();assert.equal(h.getStatus().pendingReadbackBytes,0);}
    await close(h);
  }
  { // H06: outstanding combined scene/UI charges and maxPendingFrames are transactional.
    const {f,h}=await create({maxPendingUploadBytes:423,maxPendingFrames:2});f.holdFence=true;h.renderSceneFrame(genuine,overlay());const n=f.events.length;
    assert.throws(()=>h.renderSceneFrame(genuine,overlay()),e=>e.code==='WEBGPU_BACKPRESSURE');assert.equal(h.getStatus().lastSerial,1);assert.equal(f.events.length,n);assert.equal(h.getStatus().pendingUploadBytes,212);
    f.releaseFences();await h.whenIdle();await close(h);
  }
  { // H07: scene depth ends before painter UI; one target/encoder/submit; copy after both ends.
    const {f,h}=await create({enableReadback:true});const ticket=h.requestReadback();ticket.catch(()=>{});
    const image=core.createImageData2D({width:1,height:1,pixels:new Uint8Array([255,0,0,255])});
    const imageCommand={kind:'image',matrix:rect.matrix,rect:rect.rect,alpha:1,clips:[],imageIndex:0,sourceRect:{x:0,y:0,width:1,height:1}};
    h.renderSceneFrame(genuine,overlay([rect,imageCommand,rect],{images:[image]}));await ticket;await h.whenIdle();
    const passes=f.events.filter(e=>e.kind==='pass');assert.equal(passes.length,2);assert.equal(passes[0].colorLoad,'clear');assert.equal(passes[0].depthFormat,'depth32float');assert.equal(passes[0].depthClear,0);assert.equal(passes[0].depthStore,'store');assert.equal(passes[1].colorLoad,'load');assert.equal(passes[1].hasDepth,false);
    const end=f.events.map((e,i)=>e.kind==='end'?i:-1).filter(i=>i>=0);assert.equal(end.length,2);const copy=f.events.findIndex(e=>e.kind==='copy');assert.ok(copy>end[1]);assert.equal(f.events.filter(e=>e.kind==='target').length,1);assert.equal(f.events.filter(e=>e.kind==='encoder').length,1);assert.equal(f.events.filter(e=>e.kind==='finish').length,1);assert.equal(f.events.filter(e=>e.kind==='submit').length,1);
    assert.deepEqual(f.events.filter(e=>e.kind==='draw'||e.kind==='drawIndexed').map(e=>e.kind),['drawIndexed','drawIndexed','draw','draw','draw']);
    assert.deepEqual(f.events.filter(e=>e.kind==='uiPipeline').map(e=>e.pipeline),['rect','image','rect']);await close(h);
  }
  { // H08: registration precedes a depth view getter reentering close; no leaked returned object.
    const {f,h}=await create({});let closing;f.onDepthView=()=>{closing=h.close();closing.catch(()=>{});};
    assert.throws(()=>h.renderSceneFrame(genuine,overlay()),e=>e.code==='WEBGPU_RENDER_FAILED'&&e.cause.code==='WEBGPU_CLOSED');await closing;assert.equal(h.getStatus().state,'closed');assert.equal(f.textures.filter(t=>t.format==='depth32float').length,1);assert.equal(f.textures.find(t=>t.format==='depth32float').destroyed,1);assert.equal(f.buffers.every(b=>b.destroyed===1),true);
  }
  { // H09: attempted queue write gets a submission fence even when encoding fails before submit.
    const {f,h}=await create({});const cause=Object.freeze({fault:'encode'});f.onDrawIndexed=()=>{throw cause;};
    assert.throws(()=>h.renderSceneFrame(genuine,overlay()),e=>e.code==='WEBGPU_RENDER_FAILED'&&e.cause===cause);assert.equal(f.events.filter(e=>e.kind==='submit').length,0);assert.equal(f.events.filter(e=>e.kind==='fence').length,1);await assert.rejects(h.whenIdle(),e=>e.cause===cause);await close(h);assert.equal(f.buffers.every(b=>b.destroyed===1),true);
  }
  { // H10: an unsafe fence preserves counters/resources until close attempts retirement.
    const {f,h}=await create({});const cause=Object.freeze({fault:'fence'});f.fenceFailure=cause;h.renderSceneFrame(genuine,overlay());await assert.rejects(h.whenIdle(),e=>e.code==='WEBGPU_QUEUE_FAILED'&&e.cause===cause);assert.equal(h.getStatus().pendingFrames,1);assert.equal(h.getSceneStatus().pendingSceneBytes,84);await assert.rejects(h.close(),e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cause);assert.equal(h.getStatus().cleanupOutcome,'unsafe');assert.equal(h.getStatus().pendingFrames,0);assert.equal(f.buffers.every(b=>b.destroyed===1),true);f.admittedUnsafe=true;
  }
  { // H11: transparent overlays are refused before mutation; ordinary 2D remains available.
    const {f,h}=await create({});const n=f.events.length;assert.throws(()=>h.renderSceneFrame(genuine,overlay([],{clearAlpha:0})),e=>e.code==='WEBGPU_FRAME_INVALID');assert.equal(f.events.length,n);assert.equal(h.getStatus().lastSerial,0);h.renderFrame(overlay([],{clearAlpha:0}));await h.whenIdle();assert.equal(h.getStatus().lastSerial,1);assert.equal(f.events.filter(e=>e.kind==='pass').length,1);await close(h);
  }
  { // H12: shared busy barrier sees reentrant overlay reads and preserves direct caller stop.
    const {f,h}=await create({});let reentry;const value=overlay();Object.defineProperty(value,'width',{get(){try{h.renderFrame(overlay());}catch(e){reentry=e;}h.stop();return 1;}});
    assert.throws(()=>h.renderSceneFrame(genuine,value),e=>e.code==='WEBGPU_STOPPED');assert.equal(reentry.code,'WEBGPU_REENTRANT');assert.equal(h.getStatus().state,'stopped');assert.equal(h.getStatus().lastSerial,0);await close(h);
  }
  { // H13: borrowed engine surface stays quarantined after cleanup failure.
    const f=fixture(),h=factory({canvas:f.canvas,device:{kind:'borrow',device:f.device}});f.host=h;const engine=await core.createEngine({host:h});const cause=Object.freeze({fault:'cleanup'});f.destroyFailure=cause;h.renderSceneFrame(genuine,overlay());await assert.rejects(h.whenIdle());await assert.rejects(engine.dispose());
    const denied=core.createWebGPUHost({canvas:f.canvas,device:{kind:'borrow',device:f.device}});await assert.rejects(core.createEngine({host:denied}),e=>e.code==='SURFACE_IN_USE');assert.equal(h.getStatus().cleanupOutcome,'unsafe');assert.equal(f.deviceDestroyed,0);f.admittedUnsafe=true;
  }
  { // H14: B1 requires 64, while ordinary startup only requires 16.
    const f=fixture();f.device.limits.maxUniformBufferBindingSize=63;const h=factory({canvas:f.canvas,device:{kind:'borrow',device:f.device}});f.host=h;const starting=h.start();starting.catch(()=>{});await assert.rejects(starting,e=>e.code==='WEBGPU_DEVICE_LIMIT');await close(h);
  }
  { // H15: logical depth per-frame bound is independent of image/readback charges.
    const {f,h}=await create({});const n=f.events.length;assert.throws(()=>h.renderSceneFrame(genuine,overlay([],{width:2049,height:2048})),e=>e.code==='WEBGPU_FRAME_BUDGET');assert.equal(f.events.length,n);assert.equal(h.getStatus().lastSerial,0);await close(h);
  }
  { // H16: all 64 empty draws retain uniforms and outstanding 8192 bound.
    const empty=core.createMeshGeometry3D({positions:[],colors:[],indices:[]});const value=protocol.createSceneFrame3D({projection:PROJECTION,draws:Array.from({length:64},()=>({geometry:empty,modelView}))});
    const {f,h}=await create({maxPendingFrames:3});f.holdFence=true;h.renderSceneFrame(value,overlay());h.renderSceneFrame(value,overlay());assert.equal(h.getSceneStatus().pendingUniformBytes,8192);assert.equal(h.getSceneStatus().pendingSceneBytes,0);assert.equal(f.events.filter(e=>e.kind==='drawIndexed').length,0);const n=f.events.length;assert.throws(()=>h.renderSceneFrame(value,overlay()),e=>e.code==='WEBGPU_BACKPRESSURE');assert.equal(f.events.length,n);assert.equal(h.getStatus().lastSerial,2);f.releaseFences();await h.whenIdle();await close(h);
  }
  { // H17: each actual vertex/index/uniform allocation respects maxBufferSize.
    const f=fixture();f.device.limits.maxBufferSize=71;const h=factory({canvas:f.canvas,device:{kind:'borrow',device:f.device}});f.host=h;await h.start();const n=f.events.length;assert.throws(()=>h.renderSceneFrame(genuine,overlay()),e=>e.code==='WEBGPU_DEVICE_LIMIT');assert.equal(f.events.length,n);assert.equal(h.getStatus().lastSerial,0);await close(h);
  }
  { // H18: scene resources keep their owner even when a cleanup getter throws.
    const {f,h}=await create({});const cause=Object.freeze({fault:'destroy getter'});f.depthDestroyGetterFailure=cause;assert.throws(()=>h.renderSceneFrame(genuine,overlay()),e=>e.code==='WEBGPU_RENDER_FAILED'&&e.cause===cause);await assert.rejects(h.close(),e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cause);assert.equal(h.getStatus().pendingFrames,0);assert.equal(f.depthDestroyGetterReads,1);assert.equal(f.deviceDestroyed,0);f.admittedUnsafe=true;
  }
}
function fixture() {
  const f={events:[],buffers:[],textures:[],fences:[],holdFence:false,deviceDestroyed:0,depthDestroyGetterReads:0};
  const event=(kind,fields={})=>{record('GPU',{fixture:FIXTURES.indexOf(f),operation:kind,...fields});f.events.push({kind,...fields});};
  const queue={
    writeBuffer(buffer,offset,data){assert.equal(this,queue);event('writeBuffer',{byteLength:data.byteLength,offset,usage:buffer.usage});},
    writeTexture(destination,data){assert.equal(this,queue);event('writeTexture',{byteLength:data.byteLength});},
    submit(commands){assert.equal(this,queue);assert.equal(commands.length,1);event('submit');},
    onSubmittedWorkDone(){assert.equal(this,queue);event('fence');if(f.fenceFailure)return Promise.reject(f.fenceFailure);if(!f.holdFence)return Promise.resolve();let resolve;const promise=new Promise(r=>{resolve=r;});f.fences.push(resolve);return promise;}
  };
  f.releaseFences=()=>{f.holdFence=false;for(const resolve of f.fences.splice(0))resolve();};
  const device={queue,lost:new Promise(()=>{}),limits:{maxTextureDimension2D:8192,maxBufferSize:268435456,maxVertexBuffers:1,maxVertexAttributes:2,maxVertexBufferArrayStride:24,maxColorAttachments:1,maxColorAttachmentBytesPerSample:4,maxBindGroups:1,maxBindingsPerBindGroup:3,maxSampledTexturesPerShaderStage:1,maxSamplersPerShaderStage:1,maxUniformBuffersPerShaderStage:1,maxUniformBufferBindingSize:64,maxBindGroupsPlusVertexBuffers:2,maxInterStageShaderVariables:1},
    addEventListener(){assert.equal(this,device);event('addListener');},removeEventListener(){assert.equal(this,device);event('removeListener');},
    destroy(){assert.equal(this,device);f.deviceDestroyed++;event('deviceDestroy');},
    pushErrorScope(filter){assert.equal(this,device);event('push',{filter});},popErrorScope(){assert.equal(this,device);event('pop');return Promise.resolve(null);},
    createShaderModule(descriptor){assert.equal(this,device);assert.equal(typeof descriptor.code,'string');event('shader');return {};},
    createRenderPipelineAsync(descriptor){assert.equal(this,device);const kind=descriptor.depthStencil?'mesh':descriptor.vertex.buffers[0].arrayStride===16?'image':'rect';event('pipeline',{pipeline:kind,uniform:kind==='mesh'?64:kind==='image'?16:0});const pipeline={kind,getBindGroupLayout(index){assert.equal(this,pipeline);assert.equal(index,0);event('layout',{pipeline:kind});return {pipeline:kind};}};return Promise.resolve(pipeline);},
    createSampler(){assert.equal(this,device);event('sampler');return {};},
    createBindGroup(descriptor){assert.equal(this,device);event('bindGroup',{bindings:descriptor.entries.map(e=>e.binding)});return {descriptor};},
    createBuffer(descriptor){assert.equal(this,device);const b={size:descriptor.size,usage:descriptor.usage,data:new ArrayBuffer(descriptor.size),destroyed:0,
      destroy(){assert.equal(this,b);b.destroyed++;event('destroyBuffer');if(f.destroyFailure)throw f.destroyFailure;},
      unmap(){assert.equal(this,b);event('unmap');},mapAsync(){assert.equal(this,b);event('map');return Promise.resolve();},getMappedRange(){assert.equal(this,b);return b.data;}};f.buffers.push(b);event('buffer',{size:b.size,usage:b.usage});return b;},
    createTexture(descriptor){assert.equal(this,device);const t={format:descriptor.format,destroyed:0};f.textures.push(t);event('texture',{format:t.format});
      Object.defineProperty(t,'destroy',{get(){if(t.format==='depth32float'&&f.depthDestroyGetterFailure){f.depthDestroyGetterReads++;throw f.depthDestroyGetterFailure;}return function(){assert.equal(this,t);t.destroyed++;event('destroyTexture',{format:t.format});if(f.destroyFailure)throw f.destroyFailure;};}});
      Object.defineProperty(t,'createView',{get(){if(t.format==='depth32float')f.onDepthView?.();return function(){assert.equal(this,t);event('textureView',{format:t.format});return {texture:t};};}});return t;},
    createCommandEncoder(){assert.equal(this,device);event('encoder');const encoder={
      beginRenderPass(descriptor){assert.equal(this,encoder);const depth=descriptor.depthStencilAttachment;event('pass',{colorLoad:descriptor.colorAttachments[0].loadOp,hasDepth:depth!==undefined,depthFormat:depth?.view.texture.format??null,depthClear:depth?.depthClearValue??null,depthStore:depth?.depthStoreOp??null});const pass={
        setPipeline(pipeline){assert.equal(this,pass);if(pipeline.kind!=='mesh')event('uiPipeline',{pipeline:pipeline.kind});},
        setViewport(){assert.equal(this,pass);},setScissorRect(){assert.equal(this,pass);},setVertexBuffer(){assert.equal(this,pass);},setIndexBuffer(){assert.equal(this,pass);},setBindGroup(){assert.equal(this,pass);},
        draw(){assert.equal(this,pass);event('draw');},drawIndexed(){assert.equal(this,pass);event('drawIndexed');f.onDrawIndexed?.();},end(){assert.equal(this,pass);event('end');}};return pass;},
      copyTextureToBuffer(){assert.equal(this,encoder);event('copy');},finish(){assert.equal(this,encoder);event('finish');return {};}};return encoder;}
  };
  const context={configure(){assert.equal(this,context);event('configure');},unconfigure(){assert.equal(this,context);event('unconfigure');},getCurrentTexture(){assert.equal(this,context);event('target');return {createView(){event('targetView');return {};}};}};
  const canvas={width:1,height:1,getContext(kind){assert.equal(this,canvas);assert.equal(kind,'webgpu');event('context');return context;}};
  const adapter={requestDevice(){assert.equal(this,adapter);event('acquireDevice');return Promise.resolve(device);}};
  const gpu={getPreferredCanvasFormat(){assert.equal(this,gpu);event('preferred');return 'rgba8unorm';},requestAdapter(){assert.equal(this,gpu);event('adapter');return Promise.resolve(adapter);}};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu}});
  Object.defineProperty(f,'host',{set(value){HOSTS.add(value);this.ownedHost=value;},get(){return this.ownedHost;}});
  FIXTURES.push(f);return Object.assign(f,{device,queue,context,canvas});
}

const LIMITS={modules:2048,fileBytes:1048576,sourceBytes:16777216,tokens:1048576,depth:256,events:4096,stringUnits:2048,receiptBytes:262144};
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const normal=file=>path.resolve(file).replaceAll('\\','/');
function exactFile(file,requireSingleLink=false){const canonical=normal(file);assert.equal(file,canonical,'canonical file');let current=path.parse(canonical).root;for(const part of canonical.slice(current.length).split('/').filter(Boolean)){current=path.join(current,part);assert.equal(fs.lstatSync(current).isSymbolicLink(),false,'symlink alias');}assert.equal(normal(fs.realpathSync(canonical)),canonical,'realpath alias');const stat=fs.lstatSync(canonical);assert.equal(stat.isFile(),true);if(requireSingleLink)assert.equal(stat.nlink,1,'hardlink alias');assert.ok(stat.size<=LIMITS.fileBytes);const bytes=fs.readFileSync(canonical);return {path:canonical,bytes:bytes.length,sha256:digest(bytes)};}
function boundedJSON(text){assert.ok(Buffer.byteLength(text)<=LIMITS.receiptBytes);let i=0,nodes=0;const space=()=>{while(i<text.length&&/[\t\n\r ]/.test(text[i]))i++;};const string=()=>{assert.equal(text[i++],'"');const begin=i-1;while(i<text.length){const c=text[i++];if(c==='"'){const value=JSON.parse(text.slice(begin,i));assert.ok(value.length<=LIMITS.stringUnits);return value;}assert.ok(c.charCodeAt(0)>=32);if(c==='\\'){assert.ok(i<text.length);const escape=text[i++];assert.ok('"\\/bfnrtu'.includes(escape));if(escape==='u'){assert.match(text.slice(i,i+4),/^[0-9a-fA-F]{4}$/);i+=4;}}}throw Error('unterminated JSON string');};
  function value(depth){assert.ok(depth<=LIMITS.depth&&++nodes<=65536);space();const c=text[i];if(c==='"')return string();if(c==='{'){i++;const result={},keys=new Set();space();if(text[i]==='}'){i++;return result;}for(;;){space();const key=string();assert.equal(keys.has(key),false,'duplicate JSON key');keys.add(key);space();assert.equal(text[i++],':');Object.defineProperty(result,key,{value:value(depth+1),enumerable:true});space();const end=text[i++];if(end==='}')return result;assert.equal(end,',');}}
    if(c==='['){i++;const result=[];space();if(text[i]===']'){i++;return result;}for(;;){result.push(value(depth+1));space();const end=text[i++];if(end===']')return result;assert.equal(end,',');}}
    for(const [literal,result]of [['true',true],['false',false],['null',null]])if(text.startsWith(literal,i)){i+=literal.length;return result;}
    const match=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));assert.ok(match,'JSON scalar');i+=match[0].length;const result=Number(match[0]);assert.equal(Number.isFinite(result),true);return result;}
  const result=value(0);space();assert.equal(i,text.length,'JSON trailing bytes');return result;
}
function ownKeys(value,keys){assert.ok(value!==null&&typeof value==='object'&&!Array.isArray(value));assert.deepEqual(Object.keys(value),keys);}

// This scanner admits a deliberately finite emitted syntax subset. It inspects
// executable template substitutions; it is not a universal JavaScript parser.
function scanSource(source,budget,admittedDivisions) {
  const tokens=[],usedDivisions=new Set();let i=0;
  const add=(kind,value)=>{assert.ok(++budget.tokens<=1048576,'token quota');tokens.push({kind,value});};
  function quoted(quote){i++;let value='';while(i<source.length){let c=source[i++];if(c===quote)return value;if(c==='\\'){assert.ok(i<source.length);const escape=source[i++];const simple={n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v',0:'\0'};if(Object.hasOwn(simple,escape)){if(escape==='0')assert.ok(!/[0-9]/.test(source[i]??''));c=simple[escape];}else if(escape==='x'||escape==='u'){const count=escape==='x'?2:4;const digits=source.slice(i,i+count);assert.equal(digits.length,count);assert.match(digits,/^[0-9a-fA-F]+$/);c=String.fromCharCode(parseInt(digits,16));i+=count;}else{assert.ok(escape===quote||escape==='\\'||escape==='/','unsupported string escape');c=escape;}}else assert.ok(c!=='\n'&&c!=='\r','string newline');value+=c;}throw Error('unterminated string');}
  function code(depth,templateExpression=false){assert.ok(depth<=LIMITS.depth);let balance=0;const delimiters=[];while(i<source.length){const start=i,c=source[i];
    if(/\s/.test(c)){i++;continue;}
    if(c==='/'&&source[i+1]==='/'){i+=2;while(i<source.length&&source[i]!=='\n')i++;continue;}
    if(c==='/'&&source[i+1]==='*'){const end=source.indexOf('*/',i+2);assert.ok(end>=0);i=end+2;continue;}
    if(c==='"'||c==="'"){add('string',quoted(c));continue;}
    if(c===String.fromCharCode(96)){i++;while(i<source.length){const t=source[i++];if(t==='\\'){assert.ok(i<source.length);i++;continue;}if(t===String.fromCharCode(96))break;if(t==='$'&&source[i]==='{'){i++;add('punct','{');code(depth+1,true);}}assert.equal(source[i-1],String.fromCharCode(96),'unterminated template');add('template','raw');continue;}
    if(c==='/'){const previous=tokens.at(-1)?.value;const begins=source[i+1]!=='='&&(previous===undefined||['=','(','[','{',',',':',';','!','?','&&','||','return','throw','case','=>'].includes(previous));if(begins){i++;let cls=false,ended=false;while(i<source.length){const r=source[i++];if(r==='\\'){assert.ok(i<source.length);i++;continue;}assert.ok(r!=='\n'&&r!=='\r');if(r==='[')cls=true;if(r===']')cls=false;if(r==='/'&&!cls){ended=true;break;}}assert.equal(ended,true,'regex end');while(/[a-z]/i.test(source[i]??'')&&i<source.length)i++;add('regex','literal');continue;}if([')', '}'].includes(previous)){assert.equal(source[i+1]==='=',false,'no slash-equals closing-delimiter exception');assert.equal(previous,')','no closing-brace division exception');assert.ok(admittedDivisions.has(i),'unselected ambiguous slash after delimiter');usedDivisions.add(i);}}
    if(/[A-Za-z_$]/.test(c)){i++;while(i<source.length&&/[A-Za-z0-9_$]/.test(source[i]))i++;const word=source.slice(start,i);assert.ok(!['eval','Function','require'].includes(word),'unsupported executable facility');add('id',word);continue;}
    assert.ok(c.charCodeAt(0)<128&&c!=='\\','unsupported identifier');
    if(/[0-9]/.test(c)){i++;while(i<source.length&&/[0-9A-Za-z_.]/.test(source[i]))i++;add('number',source.slice(start,i));continue;}
    if(c==='}'&&templateExpression&&balance===0){assert.equal(delimiters.length,0);i++;add('punct','}');return;}
    if(['(','[','{'].includes(c)){delimiters.push(c);if(c==='{')balance++;assert.ok(depth+delimiters.length<=LIMITS.depth,'delimiter depth');}
    if([')',']','}'].includes(c)){assert.equal(delimiters.pop(),{')':'(',']':'[','}':'{'}[c]);if(c==='}')balance--;assert.ok(balance>=0);}
    const pair=source.slice(i,i+2);if(['=>','&&','||','?.','??','==','!=','<=','>=','++','--','+=','-=','*=','/='].includes(pair)){i+=2;add('punct',pair);}else{i++;add('punct',c);}assert.ok(i>start,'scanner progress');assert.ok(balance<=LIMITS.depth);
  }assert.equal(templateExpression,false,'unterminated substitution');assert.equal(balance,0,'brace balance');assert.equal(delimiters.length,0);}
  code(0);const dynamic=[],statics=[];
  for(let p=0;p<tokens.length;p++){const t=tokens[p];if(t.kind==='id'&&t.value==='import'){
    if(tokens[p+1]?.value==='.') {assert.equal(tokens[p+2]?.value,'meta');continue;}
    if(tokens[p+1]?.value==='('){assert.equal(tokens[p+2]?.kind,'string','literal dynamic import');assert.equal(tokens[p+3]?.value,')','one import argument');dynamic.push(tokens[p+2].value);continue;}
    if(tokens[p+1]?.kind==='string'){statics.push(tokens[p+1].value);continue;}
    let q=p+1;while(q<tokens.length&&tokens[q].value!=='from'&&tokens[q].value!==';')q++;assert.equal(tokens[q]?.value,'from','static import from');assert.equal(tokens[q+1]?.kind,'string');statics.push(tokens[q+1].value);
  }else if(t.kind==='id'&&t.value==='export'){let q=p+1;while(q<tokens.length&&tokens[q].value!==';'&&tokens[q].value!=='export'&&tokens[q].value!=='import'){if(tokens[q].value==='from'){assert.equal(tokens[q+1]?.kind,'string');statics.push(tokens[q+1].value);break;}q++;}}}
  assert.deepEqual([...usedDivisions].sort((a,b)=>a-b),[...admittedDivisions].sort((a,b)=>a-b),'every selected unique division token consumed');return {statics,dynamic};
}
const HOSTS=new Set(),FIXTURES=[];
const observe=value=>{const promise=Promise.resolve(value);promise.catch(()=>{});return promise;};
const EVENTS=[];
function record(kind,fields={}){assert.ok(EVENTS.length<LIMITS.events,'event quota');const event={kind,...fields};validateData(event);EVENTS.push(event);}
function validateData(value,depth=0){assert.ok(depth<=LIMITS.depth);if(typeof value==='string')assert.ok(value.length<=LIMITS.stringUnits);else if(typeof value==='number')assert.equal(Number.isFinite(value),true);else if(value!==null&&typeof value==='object'){for(const [key,item]of Object.entries(value)){assert.ok(key.length<=LIMITS.stringUnits);validateData(item,depth+1);}}else assert.ok(value===null||typeof value==='boolean');}
assert.equal(process.version,'v24.19.0','fixed tested Node version');
assert.equal(process.argv.length,3,'exact Node/file/case argv');
const CASE=process.argv[2];assert.ok(FIXED_CASES.includes(CASE));
const PROGRAM=normal(fileURLToPath(import.meta.url));
const CONFIG_PATH=PROGRAM.slice(0,-4)+'.json';
const RECEIPT_PATH=PROGRAM.slice(0,-4)+'.receipt.json';
const PROGRAM_IDENTITY=exactFile(PROGRAM,true),CONFIG_IDENTITY=exactFile(CONFIG_PATH,true);
const config=boundedJSON(fs.readFileSync(CONFIG_PATH,'utf8'));
ownKeys(config,['schemaVersion','caseId','repository','entries','packages','files','metadata','sceneFiles','gpuFiles']);
assert.equal(config.schemaVersion,1);assert.equal(config.caseId,CASE);assert.equal(normal(process.cwd()),config.repository);
ownKeys(config.entries,['core','canvas','webgpu','host','b1']);
ownKeys(config.packages,['@egret/contracts','@egret/runtime','@egret/engine','robust-predicates']);
assert.ok(Array.isArray(config.files)&&config.files.length<=LIMITS.modules);
const FILES=new Map();let sourceBytes=0;
for(const descriptor of config.files){ownKeys(descriptor,['path','bytes','sha256']);assert.equal(FILES.has(descriptor.path),false);assert.deepEqual(exactFile(descriptor.path),descriptor);sourceBytes+=descriptor.bytes;assert.ok(sourceBytes<=LIMITS.sourceBytes);FILES.set(descriptor.path,descriptor);}
for(const descriptor of config.metadata){ownKeys(descriptor,['path','bytes','sha256']);assert.deepEqual(exactFile(descriptor.path),descriptor);}
for(const url of Object.values(config.entries)){assert.equal(pathToFileURL(fileURLToPath(url)).href,url);assert.ok(FILES.has(normal(fileURLToPath(url))));}
for(const target of Object.values(config.packages))assert.ok(FILES.has(target));
const DRIVER_ENVIRONMENT_KEYS=process.platform==='win32'?['SystemRoot','WINDIR','COMSPEC','PATH','TEMP','TMP','NODE_DISABLE_COMPILE_CACHE','HOMEDRIVE','HOMEPATH','LOGONSERVER','SYSTEMDRIVE','USERDOMAIN','USERNAME','USERPROFILE']:['PATH','TEMP','TMP','NODE_DISABLE_COMPILE_CACHE'];
const unexpectedDriverEnvironmentKeys=Object.keys(process.env).filter(key=>!DRIVER_ENVIRONMENT_KEYS.some(allowed=>allowed.toUpperCase()===key.toUpperCase()));
assert.deepEqual(unexpectedDriverEnvironmentKeys,[],'closed driver environment; unexpected key names '+JSON.stringify(unexpectedDriverEnvironmentKeys));
const driverEnvironmentReceipt=Object.fromEntries(DRIVER_ENVIRONMENT_KEYS.map(key=>{const actual=Object.keys(process.env).find(name=>name.toUpperCase()===key.toUpperCase());assert.ok(actual,'selected driver environment member absent');return [key,process.env[actual]];}));
assert.equal(process.env.NODE_DISABLE_COMPILE_CACHE,'1');
assert.deepEqual(process.execArgv,CASE==='S01'?['--experimental-vm-modules']:[]);
const SENTINEL=Object.freeze({owned:'B1 synthetic loader rejection'});
const sceneURLs=new Set(config.sceneFiles.map(file=>pathToFileURL(file).href));
const gpuURLs=new Set(config.gpuFiles.map(file=>pathToFileURL(file).href));
const forbidden=CASE==='N01'||CASE==='N02'?new Set([...sceneURLs,...gpuURLs]):CASE.startsWith('N')?sceneURLs:new Set();
let coldHost,closingFromHook,hooks,syntheticThrows=0,forbiddenAttempts=0,startupEvidence=null,staticEdges=[],dynamicEdges=[],staticClosures=[],divisionWitnesses=[];
const unhandled=[];
const unhandledListener=()=>{unhandled.push(true);};process.on('unhandledRejection',unhandledListener);
function resolveTarget(specifier,parent){
  assert.ok(typeof specifier==='string'&&!specifier.includes('?')&&!specifier.includes('#'));
  if(specifier.startsWith('node:'))return specifier;
  if(Object.hasOwn(config.packages,specifier))return pathToFileURL(config.packages[specifier]).href;
  const url=specifier.startsWith('file:')?new URL(specifier):specifier.startsWith('./')||specifier.startsWith('../')?new URL(specifier,parent):null;
  assert.ok(url&&url.protocol==='file:','closed module resolution');const file=normal(fileURLToPath(url));assert.equal(pathToFileURL(file).href,url.href,'URL alias');assert.ok(FILES.has(file),'target in actual finite manifest');return url.href;
}
function staticInspection(){
  assert.equal(typeof vm.SourceTextModule,'function');const budget={tokens:0};const inspected=new Map();
  const selectedAnchors=new Map([[config.entries.host,['((color >>> 16) & 255) / 255 * alpha','((color >>> 8) & 255) / 255 * alpha','(color & 255) / 255 * alpha']],[pathToFileURL(config.repository+'/packages/engine/dist/web/webgpuPass.js').href,['((group.color >>> 16) & 255) / 255 * alpha','((group.color >>> 8) & 255) / 255 * alpha','(group.color & 255) / 255 * alpha']],[pathToFileURL(config.repository+'/packages/engine/dist/web/imageProjections2D.js').href,['Math.floor((pixels[offset] * alpha + 127) / 255)','Math.floor((pixels[offset + 1] * alpha + 127) / 255)','Math.floor((pixels[offset + 2] * alpha + 127) / 255)']],[pathToFileURL(config.repository+'/packages/runtime/dist/sequenceClip.js').href,['Math.floor((high - low) / 2)']]]);
  // A selected division token never grants general closing-delimiter admission.
  const expression='Math.floor((high - low) / 2)',slash=expression.indexOf('/');
  assert.throws(()=>scanSource(expression,{tokens:0},new Set()),{message:'unselected ambiguous slash after delimiter'});
  assert.deepEqual(scanSource(expression,{tokens:0},new Set([slash])),{statics:[],dynamic:[]});
  assert.throws(()=>scanSource(expression+'; (other) / 3;',{tokens:0},new Set([slash])),{message:'unselected ambiguous slash after delimiter'});
  assert.throws(()=>scanSource('(other) /= 2;',{tokens:0},new Set([8])),{message:/^no slash-equals closing-delimiter exception/});
  assert.throws(()=>scanSource('{} / 2;',{tokens:0},new Set([3])),{message:/^no closing-brace division exception/});
  assert.throws(()=>scanSource('/* '+expression+' */',{tokens:0},new Set([3+slash])),{message:/^every selected unique division token consumed/});
  function visit(url){if(inspected.has(url))return;const file=normal(fileURLToPath(url));const descriptor=FILES.get(file);assert.ok(descriptor);const bytes=fs.readFileSync(file);assert.equal(digest(bytes),descriptor.sha256);const source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    // Native construction precedes the finite literal exception. No linking or
    // evaluation occurs; the ten locations in four files are source-bound data.
    const module=new vm.SourceTextModule(source,{identifier:url});assert.equal(module.status,'unlinked');const admitted=new Set(),anchors=[];for(const anchor of selectedAnchors.get(url)??[]){const offset=source.indexOf(anchor);assert.ok(offset>=0);assert.equal(source.lastIndexOf(anchor),offset,'unique complete expression');const slash=offset+anchor.indexOf('/');assert.equal(source[slash],'/');admitted.add(slash);anchors.push({expression:anchor,byteOffset:Buffer.byteLength(source.slice(0,offset)),slashByteOffset:Buffer.byteLength(source.slice(0,slash))});}if(anchors.length)divisionWitnesses.push({url,sha256:descriptor.sha256,constructed:true,linked:false,evaluated:false,anchors});const lexical=scanSource(source,budget,admitted);const requests=module.moduleRequests;assert.ok(Array.isArray(requests));const specs=[];
    for(const request of requests){assert.deepEqual(Object.keys(request).sort(),['attributes','phase','specifier']);assert.equal(typeof request.specifier,'string');assert.equal(request.phase,'evaluation');assert.equal(request.attributes!==null&&typeof request.attributes==='object',true);assert.deepEqual(Object.keys(request.attributes),[]);specs.push(request.specifier);}
    assert.deepEqual([...new Set(lexical.statics)],specs,'independent lexical/static-request crosscheck');inspected.set(url,requests);
    for(const specifier of lexical.dynamic){assert.equal(url,config.entries.host,'only Host dynamic edge');assert.equal(specifier,'./b1.js');dynamicEdges.push({parent:url,specifier,url:resolveTarget(specifier,url)});}
    for(const specifier of specs){const target=resolveTarget(specifier,url);staticEdges.push({parent:url,specifier,url:target});if(!target.startsWith('node:'))visit(target);}
    assert.deepEqual(exactFile(file),descriptor);
  }
  for(const [name,entry]of Object.entries(config.entries)){visit(entry);const reachable=new Set();function walk(url){if(reachable.has(url))return;reachable.add(url);for(const edge of staticEdges.filter(e=>e.parent===url))if(!edge.url.startsWith('node:'))walk(edge.url);}walk(entry);
    if(name==='core'||name==='canvas')assert.equal([...reachable].some(url=>sceneURLs.has(url)||gpuURLs.has(url)),false,'core/Canvas static prohibition');if(name==='webgpu'||name==='host')assert.equal([...reachable].some(url=>sceneURLs.has(url)),false,'ordinary static scene prohibition');staticClosures.push({name,modules:[...reachable].sort()});}
  assert.equal(dynamicEdges.length,1);assert.deepEqual(dynamicEdges[0],{parent:config.entries.host,specifier:'./b1.js',url:config.entries.b1});assert.equal(divisionWitnesses.length,4);assert.equal(divisionWitnesses.reduce((count,item)=>count+item.anchors.length,0),10);record('STATIC_ONLY',{modules:inspected.size,tokens:budget.tokens,constructed:true,linked:false,evaluated:false});
}
function installHooks(){hooks=registerHooks({
  resolve(specifier,context,nextResolve){assert.ok(context.parentURL===pathToFileURL(PROGRAM).href||context.parentURL?.startsWith('file:')&&FILES.has(normal(fileURLToPath(context.parentURL))),'source-bound import parent');const target=resolveTarget(specifier,context.parentURL);record('RESOLVE_ATTEMPT',{parent:context.parentURL??null,specifier,url:target});if(forbidden.has(target)){forbiddenAttempts++;record('FORBIDDEN_ATTEMPT',{phase:'resolve',url:target});throw SENTINEL;}const result=nextResolve(specifier,context);assert.equal(result.url,target,'actual canonical resolver join');record('RESOLVE_RETURN',{parent:context.parentURL??null,specifier,url:result.url});return result;},
  load(url,context,nextLoad){record('LOAD_ATTEMPT',{url});if(forbidden.has(url)){forbiddenAttempts++;record('FORBIDDEN_ATTEMPT',{phase:'load',url});throw SENTINEL;}
    if(url===config.entries.b1&&['R01','C01','C02','C03','C04'].includes(CASE)){assert.ok(coldHost);if(CASE==='C01'||CASE==='C03')coldHost.stop();if(CASE==='C02'||CASE==='C04'){closingFromHook=observe(coldHost.close());assert.equal(coldHost.close(),closingFromHook,'cached close Promise');}if(CASE==='R01'||CASE==='C03'||CASE==='C04'){syntheticThrows++;assert.equal(syntheticThrows,1);record('SYNTHETIC_REJECTION',{url});throw SENTINEL;}}
    const result=nextLoad(url,context);if(!url.startsWith('node:')){const file=normal(fileURLToPath(url));const expected=FILES.get(file);assert.ok(expected);assert.equal(result.format,'module');const bytes=typeof result.source==='string'?Buffer.from(result.source):Buffer.from(result.source);assert.equal(bytes.length,expected.bytes);assert.equal(digest(bytes),expected.sha256,'unchanged real positive loading');record('LOAD_RETURN',{url,bytes:bytes.length,sha256:expected.sha256});}else record('LOAD_RETURN',{url,bytes:null,sha256:null});return result;}
});}
const imported=url=>observe(import(url));
async function ordinaryLifecycle(namespace,acquire){const f=fixture();f.device.limits.maxUniformBufferBindingSize=16;const h=namespace.createWebGPUHost({canvas:f.canvas,device:acquire?{kind:'acquire'}:{kind:'borrow',device:f.device},enableReadback:true});f.host=h;sceneFree(h);const start=observe(h.start());assert.equal(h.start(),start);await start;assert.deepEqual(f.events.filter(e=>e.kind==='pipeline').map(e=>e.pipeline),['rect','image']);const ticket=observe(h.requestReadback());assert.equal(h.renderFrame({frameId:1,width:1,height:1,clearColor:0,clearAlpha:1,commands:[]}),undefined);const idle=observe(h.whenIdle());const readback=await ticket;await idle;assert.equal(readback.serial,1);assert.equal(readback.bytes.byteLength,4);assert.equal(f.events.filter(e=>e.kind==='pass').length,1);assert.equal(f.events.filter(e=>e.kind==='submit').length,1);await observe(h.close());assert.equal(h.getStatus().state,'closed');assert.equal(h.getStatus().cleanupOutcome,'safe');assert.equal(f.deviceDestroyed,acquire?1:0);sceneFree(h);record('ORDINARY_LIFECYCLE',{ownership:acquire?'acquire':'borrow',uniformLimit:16,closed:true});}
async function positiveBehavior(namespace,cold){const cpu=await imported(pathToFileURL(config.sceneFiles.find(file=>file.endsWith('/sceneFrame3D.js'))).href);const packing=await imported(pathToFileURL(config.sceneFiles.find(file=>file.endsWith('/packMeshGeometry3D.js'))).href);const mesh=await imported(pathToFileURL(config.sceneFiles.find(file=>file.endsWith('/webgpuMeshPass.js'))).href);const geometry=await imported(pathToFileURL(config.sceneFiles.find(file=>file.endsWith('/meshGeometry3D.js'))).href);const matrix=await imported(pathToFileURL(config.sceneFiles.find(file=>file.endsWith('/matrix4.js'))).href);const core=await imported(config.entries.core);const ordinary=await imported(config.entries.webgpu);const references={...cpu,...packing,...mesh};const protocol=protocolAssertions(namespace,references);record('AUTHENTIC_PROTOCOL',{sevenActualReferences:true,stableIdentity:true,predicateNoReads:true});if(cold){const scene=protocol.createSceneFrame3D({projection:PROJECTION,draws:[{geometry:geometry.createMeshGeometry3D(TRIANGLE),modelView:matrix.createMatrix4(MATRIX_IDENTITY)}]});const ticket=observe(cold.h.requestReadback());assert.equal(cold.h.renderSceneFrame(scene,{frameId:1,width:1,height:1,clearColor:0,clearAlpha:1,commands:[]}),undefined,'COLD01 actual cold host scene submission');const idle=observe(cold.h.whenIdle());assert.equal((await ticket).serial,1);await idle;assert.equal(cold.f.events.filter(e=>e.kind==='pass').length,2);assert.equal(cold.f.events.filter(e=>e.kind==='submit').length,1);await observe(cold.h.close());assert.equal(cold.f.deviceDestroyed,0);record('COLD_LIFECYCLE',{readback:true,twoPasses:true,closed:true});}await hostBehaviorAssertions(namespace.createB1WebGPUHost,protocol,{...core,...geometry,...matrix,...ordinary},fixture);record('HOST_BEHAVIORS',{namedAssertions:18});}
async function runtimeCase(){installHooks();if(CASE==='N01'||CASE==='N02'){const namespace=await imported(CASE==='N01'?config.entries.core:config.entries.canvas);for(const key of ['createB1WebGPUHost','createB1WebGPUHostInternal','getBuiltinB1Protocol','isBuiltinB1Protocol','createSceneFrame3D','createWebGPUHost'])assert.equal(Object.hasOwn(namespace,key),false);record('FACADE_NEGATIVE',{entry:CASE==='N01'?'core':'canvas'});}
  else if(CASE==='N03'||CASE==='N04'||CASE==='N05'){const namespace=await imported(config.entries.webgpu);assert.deepEqual(Object.keys(namespace),['createWebGPUHost']);if(CASE==='N03'){const f=fixture(),h=namespace.createWebGPUHost({canvas:f.canvas,device:{kind:'borrow',device:f.device}});f.host=h;sceneFree(h);assert.equal(f.events.length,0);await observe(h.close());record('FACTORY_NEGATIVE',{wholePrototypeChain:true});}else await ordinaryLifecycle(namespace,CASE==='N05');}
  else if(CASE==='P01'){const namespace=await imported(config.entries.b1);record('EXPLICIT_ENTRY_CACHED',{url:config.entries.b1});await positiveBehavior(namespace);}
  else {const hostNamespace=await imported(config.entries.host);assert.equal(EVENTS.some(e=>e.url===config.entries.b1),false,'genuine cold B1 module');const f=fixture();coldHost=hostNamespace.createB1WebGPUHostInternal({canvas:f.canvas,device:{kind:'borrow',device:f.device},enableReadback:true});f.host=coldHost;const start=observe(coldHost.start());assert.equal(coldHost.start(),start,'cached starting Promise');
    if(CASE==='P02'){await start;assert.equal(EVENTS.some(e=>e.kind==='LOAD_RETURN'&&e.url===config.entries.b1),true,'actual cold unchanged B1 load');assert.equal(coldHost.getStatus().state,'active');const namespace=await imported(config.entries.b1);await positiveBehavior(namespace,{f,h:coldHost});}
    else {let rejected;try{await start;}catch(cause){rejected=cause;}assert.ok(rejected);const cancelled=CASE!=='R01';assert.equal(rejected.code,cancelled?'WEBGPU_START_CANCELLED':'WEBGPU_START_FAILED');const status=coldHost.getStatus();if(!cancelled){assert.equal(rejected.cause,SENTINEL);assert.equal(status.firstFailure.code,'WEBGPU_START_FAILED');assert.equal(status.firstFailure.phase,'startup');assert.equal(status.firstFailure.serial,null);assert.equal(status.firstFailure.cause,SENTINEL);}else {if(CASE==='C02'||CASE==='C04')assert.ok(['closing','closed'].includes(status.state));else assert.equal(status.state,'stopped');if(CASE==='C03'||CASE==='C04')assert.equal(rejected.cause,SENTINEL,'cancelled synthetic rejection cause');}assert.equal(f.events.length,0,'terminal recheck before all GPU/navigator work');if(CASE==='C01'||CASE==='C02')assert.equal(EVENTS.some(e=>e.kind==='LOAD_RETURN'&&e.url===config.entries.b1),true,'untouched cancellation source loaded');else assert.equal(syntheticThrows,1);await observe(closingFromHook??coldHost.close());assert.equal(coldHost.getStatus().state,'closed');assert.equal(coldHost.getStatus().cleanupOutcome,'safe');startupEvidence={code:rejected.code,synthetic:syntheticThrows===1,causeSame:rejected.cause===SENTINEL,cancelled,gpuEvents:0,closed:true};record('STARTUP_SETTLED',startupEvidence);}}
  assert.equal(forbiddenAttempts,0,'caught forbidden attempt is still failure');
}

let operationTimedOut=false,assertionFailure=null,cleanupFailures=[],cleanupOutcomes=[],cleanupTimedOut=false,driverCallbackFailure=null,complete=false;
const callbackFailure=()=>{driverCallbackFailure??={kind:'DRIVER_CALLBACK_FAILURE'};};
const operationTimer=setTimeout(()=>{operationTimedOut=true;try{record('OPERATION_DEADLINE');}catch{callbackFailure();}for(const f of FIXTURES){try{f.releaseFences();}catch{callbackFailure();}}for(const h of HOSTS){try{observe(h.close());}catch{callbackFailure();}}},10000);
try{if(CASE==='S01')staticInspection();else await runtimeCase();complete=true;}catch(cause){assertionFailure={name:typeof cause?.name==='string'?cause.name:'ThrownValue',code:typeof cause?.code==='string'?cause.code:null,message:typeof cause?.message==='string'?cause.message.slice(0,2048):null};}
finally{
  clearTimeout(operationTimer);
  // One cooperative budget owns all close observations, not one reset per host.
  // A deadline stops waiting; it does not cancel a close or retire a process.
  let cleanupDeadline;const deadline=new Promise(resolve=>{cleanupDeadline=setTimeout(()=>{cleanupTimedOut=true;resolve();},5000);});
  for(const f of FIXTURES){try{f.releaseFences();}catch{callbackFailure();}}
  const pending=[];
  for(const [index,h]of [...HOSTS].entries()){
    const admittedUnsafe=FIXTURES.some(f=>f.host===h&&f.admittedUnsafe===true);
    const item={index,settlement:'pending',state:null,outcome:null,code:null,admittedUnsafe};cleanupOutcomes.push(item);
    const snapshot=()=>{try{const status=h.getStatus();item.state=status.state;item.outcome=status.cleanupOutcome;}catch{callbackFailure();}};
    const rejected=cause=>{item.settlement='rejected';try{item.code=typeof cause?.code==='string'?cause.code:null;}catch{callbackFailure();}snapshot();};
    try{const closing=observe(h.close());pending.push(closing.then(()=>{item.settlement='fulfilled';snapshot();},rejected));}
    catch(cause){rejected(cause);}
  }
  const settled=observe(Promise.all(pending));await Promise.race([settled,deadline]);clearTimeout(cleanupDeadline);
  // Freeze the observed snapshot; late settlements remain observed and cannot
  // rewrite a timeout into success or claim that an unfinished host retired.
  cleanupOutcomes=cleanupOutcomes.map(item=>({...item}));
  cleanupFailures=cleanupOutcomes.filter(item=>item.settlement==='pending'||item.settlement==='rejected'&&!item.admittedUnsafe);
  hooks?.deregister();await new Promise(resolve=>setImmediate(resolve));process.removeListener('unhandledRejection',unhandledListener);
}
for(const descriptor of config.files)assert.deepEqual(exactFile(descriptor.path),descriptor);
for(const descriptor of config.metadata)assert.deepEqual(exactFile(descriptor.path),descriptor);
assert.deepEqual(exactFile(PROGRAM,true),PROGRAM_IDENTITY);assert.deepEqual(exactFile(CONFIG_PATH,true),CONFIG_IDENTITY);
const receipt={schemaVersion:1,caseId:CASE,pid:process.pid,ppid:process.ppid,node:process.version,execArgv:process.execArgv,argv:process.argv,cwd:normal(process.cwd()),program:PROGRAM_IDENTITY,config:CONFIG_IDENTITY,context:{isMainThread,threadId,NODE_TEST_CONTEXT:{present:Object.hasOwn(process.env,'NODE_TEST_CONTEXT'),value:process.env.NODE_TEST_CONTEXT??null},NODE_TEST_WORKER_ID:{present:Object.hasOwn(process.env,'NODE_TEST_WORKER_ID'),value:process.env.NODE_TEST_WORKER_ID??null}},environment:driverEnvironmentReceipt,status:complete&&!operationTimedOut&&!assertionFailure&&!cleanupTimedOut&&!driverCallbackFailure&&cleanupFailures.length===0&&unhandled.length===0?'PASSED':'FAILED',operationTimedOut,cleanupTimedOut,driverCallbackFailure,assertionFailure,cleanupFailures,cleanupOutcomes,unhandledRejections:unhandled.length,forbiddenAttempts,syntheticThrows,startupEvidence,staticEdges,dynamicEdges,staticClosures,divisionWitnesses,events:EVENTS};
validateData(receipt);const receiptBytes=Buffer.from(JSON.stringify(receipt)+'\n');assert.ok(receiptBytes.length<=LIMITS.receiptBytes);fs.writeFileSync(RECEIPT_PATH,receiptBytes,{flag:'wx'});process.stdout.write(JSON.stringify({kind:'DRIVER_RECEIPT',caseId:CASE,path:RECEIPT_PATH,bytes:receiptBytes.length,sha256:digest(receiptBytes),status:receipt.status})+'\n');if(receipt.status!=='PASSED')process.exitCode=1;
/* B1_DRIVER_END */
`;

// Stage A: orchestration is authored below before any new driver executes.
const normalize=value=>path.resolve(value).replaceAll('\\','/');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const canonical=value=>normalize(fs.realpathSync(value));
function fileDescriptor(file){file=normalize(file);assert.equal(canonical(file),file);const stat=fs.lstatSync(file);assert.ok(stat.isFile()&&!stat.isSymbolicLink());const bytes=fs.readFileSync(file);return {path:file,bytes:bytes.length,sha256:hash(bytes)};}
function exclusiveDirectory(file){assert.equal(typeof file,'string');assert.equal(path.isAbsolute(file),true);assert.equal(normalize(file),file,'canonical output spelling');const parent=path.dirname(file);assert.equal(canonical(parent),normalize(parent));let current=path.parse(parent).root;for(const part of normalize(parent).slice(current.length).split('/').filter(Boolean)){current=path.join(current,part);assert.equal(fs.lstatSync(current).isSymbolicLink(),false,'output parent alias');}assert.equal(fs.existsSync(file),false,'destination already exists');fs.mkdirSync(file);assert.equal(canonical(file),file);return file;}
// Node v24.19.0 serializes default process-worker options into execArgv.
// Accept the complete observed profile only; these configuration values
// alone do not enable tracing, CPU profiling or the inspector. Driver flags
// remain separately constructed and never inherit this worker profile.
const PINNED_PROCESS_WORKER_OPTIONS = Object.freeze([
  "--use-largepages=off",
  "--trace-event-file-pattern=node_trace.${rotation}.log",
  "--v8-pool-size=4",
  "--node-snapshot",
  "--cpu-prof-interval=1000",
  "--report-signal=SIGUSR2",
  "--tls-cipher-list=TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:DHE-RSA-AES256-SHA384:ECDHE-RSA-AES256-SHA256:DHE-RSA-AES256-SHA256:HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA",
  "--secure-heap=0",
  "--secure-heap-min=2",
  "--stack-trace-limit=10",
  "--test-isolation=process",
  "--network-family-autoselection-attempt-timeout=250",
  "--experimental-addon-modules",
  "--heapsnapshot-near-heap-limit=0",
  "--heap-prof-interval=524288",
  "--max-http-header-size=16384",
  "--test-concurrency=0",
  "--test-timeout=0",
  "--test-coverage-branches=0",
  "--test-coverage-functions=0",
  "--test-coverage-lines=0",
  "--watch-kill-signal=SIGTERM",
  "--inspect-port=127.0.0.1:9229",
  "--inspect-publish-uid=stderr,http"
]);
function callerEnvironment(){
  const names=Object.keys(process.env),rejected=['NODE_OPTIONS','NODE_PATH','NODE_V8_COVERAGE','NODE_COMPILE_CACHE','NODE_REPL_EXTERNAL_MODULE'];
  const settingPresence=Object.fromEntries(rejected.map(key=>[key,names.some(name=>name.toUpperCase()===key)]));
  settingPresence.TS_NODE_PREFIX=names.some(name=>name.toUpperCase().startsWith('TS_NODE'));
  settingPresence.BABEL_PREFIX=names.some(name=>name.toUpperCase().startsWith('BABEL'));
  assert.equal(Object.values(settingPresence).some(Boolean),false,'unsupported inherited loader configuration');
  assert.equal(process.version,'v24.19.0');
  const context={NODE_TEST_CONTEXT:{present:Object.hasOwn(process.env,'NODE_TEST_CONTEXT'),value:null},NODE_TEST_WORKER_ID:{present:Object.hasOwn(process.env,'NODE_TEST_WORKER_ID')},NODE_DISABLE_COMPILE_CACHE:{present:Object.hasOwn(process.env,'NODE_DISABLE_COMPILE_CACHE')},EGRET_B1_TRACE_EVIDENCE_DIR:{present:Object.hasOwn(process.env,'EGRET_B1_TRACE_EVIDENCE_DIR')}};
  if(context.NODE_TEST_CONTEXT.present){assert.ok(process.env.NODE_TEST_CONTEXT==='child-v8','unsupported actual test context');context.NODE_TEST_CONTEXT.value='child-v8';}
  if(context.NODE_TEST_CONTEXT.present)assert.deepEqual([...process.execArgv].sort(),[...PINNED_PROCESS_WORKER_OPTIONS].sort(),'unsupported process-worker Node options');
  else assert.ok(process.execArgv.every(value=>value==='--test'||value.startsWith('--test-')),'unsupported worker Node option');
  // Only selected launch fields retain values. Unrelated caller variables and
  // their hashes are never copied to evidence; unused context is presence-only.
  const selectedEnvironment={};if(process.platform==='win32')for(const key of ['SystemRoot','WINDIR','COMSPEC']){const found=names.find(name=>name.toUpperCase()===key.toUpperCase());assert.ok(found,'missing selected Windows key');selectedEnvironment[key]=process.env[found];}
  return {pid:process.pid,ppid:process.ppid,isMainThread,threadId,node:process.version,nodeExecutable:fileDescriptor(canonical(process.execPath)),execArgv:process.execArgv,argv:process.argv,cwd:normalize(process.cwd()),context,settingPresence,selectedEnvironment};
}
function driverEnvironment(worker,directory){
  const environment={...worker.selectedEnvironment,PATH:path.dirname(worker.nodeExecutable.path),TEMP:directory,TMP:directory,NODE_DISABLE_COMPILE_CACHE:'1'};
  if(process.platform==='win32'){
    // Windows libuv injects absent required fields from its parent.
  // Explicit synthetic values prevent ambient user/domain/profile inheritance.
    const drive=path.parse(directory).root.slice(0,-1);
    Object.assign(environment,{HOMEDRIVE:drive,HOMEPATH:directory.slice(drive.length),LOGONSERVER:'\\egret-test',SYSTEMDRIVE:drive,USERDOMAIN:'egret-test',USERNAME:'egret-test',USERPROFILE:directory});
  }
  return environment;
}
function sourceInventory(repository){const files=[],metadata=[],packages={};let bytes=0;function collect(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const file=normalize(path.join(directory,entry.name));assert.equal(entry.isSymbolicLink(),false);if(entry.isDirectory())collect(file);else if(entry.isFile()&&entry.name.endsWith('.js')){const descriptor=fileDescriptor(file);assert.ok(descriptor.bytes<=QUOTAS.fileBytes);bytes+=descriptor.bytes;assert.ok(bytes<=QUOTAS.sourceBytes);files.push(descriptor);assert.ok(files.length<=QUOTAS.modules);}}}
  for(const name of ['contracts','runtime','engine']){const root=repository+'/packages/'+name;const meta=fileDescriptor(root+'/package.json');metadata.push(meta);const data=JSON.parse(fs.readFileSync(meta.path,'utf8'));assert.equal(data.name,'@egret/'+name);assert.equal(data.type,'module');assert.deepEqual(data.exports['.'],{types:'./dist/index.d.ts',import:'./dist/index.js'});packages[data.name]=canonical(root+'/dist/index.js');collect(root+'/dist');}
  const dependency=canonical(repository+'/packages/engine/node_modules/robust-predicates');const meta=fileDescriptor(dependency+'/package.json');metadata.push(meta);const data=JSON.parse(fs.readFileSync(meta.path,'utf8'));assert.equal(data.name,'robust-predicates');assert.equal(data.version,'3.0.3');assert.equal(data.type,'module');assert.equal(data.exports,'./index.js');packages['robust-predicates']=canonical(dependency+'/index.js');files.push(fileDescriptor(dependency+'/index.js'));collect(dependency+'/esm');
  const engine=JSON.parse(fs.readFileSync(repository+'/packages/engine/package.json','utf8'));assert.deepEqual(engine.exports['./web'],{types:'./dist/web/index.d.ts',import:'./dist/web/index.js'});assert.deepEqual(engine.exports['./webgpu'],{types:'./dist/web/webgpu.d.ts',import:'./dist/web/webgpu.js'});assert.equal(engine.dependencies['robust-predicates'],'3.0.3');
  const entry=relative=>pathToFileURL(canonical(repository+'/'+relative)).href;
  const entries={core:entry('packages/engine/dist/index.js'),canvas:entry('packages/engine/dist/web/index.js'),webgpu:entry('packages/engine/dist/web/webgpu.js'),host:entry('packages/engine/dist/web/WebGPUHost.js'),b1:entry('packages/engine/dist/web/b1.js')};
  // CPU image projections are shared by Canvas and WebGPU, outside the GPU-only category.
  const sceneNames=['b1.js','sceneFrame3D.js','packMeshGeometry3D.js','meshGeometry3D.js','matrix4.js','projection3D.js','webgpuMeshPass.js'];const gpuNames=['WebGPUHost.js','webgpu.js','webgpuPass.js','webgpuImagePass.js','webgpuLifetime.js','webgpuMeshPass.js','b1.js'];
  const sceneFiles=files.filter(d=>sceneNames.includes(path.basename(d.path))&&d.path.startsWith(repository+'/packages/engine/dist/')).map(d=>d.path).sort();const gpuFiles=files.filter(d=>gpuNames.includes(path.basename(d.path))&&d.path.startsWith(repository+'/packages/engine/dist/')).map(d=>d.path).sort();assert.equal(sceneFiles.length,7);assert.equal(gpuFiles.length,7);assert.equal(new Set(files.map(d=>d.path)).size,files.length);assert.ok(files.length<=QUOTAS.modules);assert.ok(files.every(d=>d.bytes<=QUOTAS.fileBytes));assert.ok(files.reduce((sum,d)=>sum+d.bytes,0)<=QUOTAS.sourceBytes);files.sort((a,b)=>a.path.localeCompare(b.path));return {repository,entries,packages,files,metadata,sceneFiles,gpuFiles};
}
function strictJSON(bytes){assert.ok(bytes.length<=QUOTAS.receiptBytes);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);let offset=0,nodes=0;const space=()=>{while(/[\t\n\r ]/.test(text[offset]??'')&&offset<text.length)offset++;};function string(){assert.equal(text[offset++],'"');const begin=offset-1;while(offset<text.length){const c=text[offset++];if(c==='"'){const value=JSON.parse(text.slice(begin,offset));assert.ok(value.length<=QUOTAS.stringUnits);return value;}assert.ok(c.charCodeAt(0)>=32);if(c==='\\'){const e=text[offset++];assert.ok('"\\/bfnrtu'.includes(e));if(e==='u'){assert.match(text.slice(offset,offset+4),/^[0-9a-fA-F]{4}$/);offset+=4;}}}throw Error('incomplete JSON string');}
  function value(depth){assert.ok(depth<=QUOTAS.depth&&++nodes<=65536);space();const c=text[offset];if(c==='"')return string();if(c==='{'){offset++;const result={},keys=new Set();space();if(text[offset]==='}'){offset++;return result;}for(;;){space();const key=string();assert.equal(keys.has(key),false,'duplicate receipt key');keys.add(key);space();assert.equal(text[offset++],':');Object.defineProperty(result,key,{value:value(depth+1),enumerable:true});space();const end=text[offset++];if(end==='}')return result;assert.equal(end,',');}}if(c==='['){offset++;const result=[];space();if(text[offset]===']'){offset++;return result;}for(;;){result.push(value(depth+1));space();const end=text[offset++];if(end===']')return result;assert.equal(end,',');}}for(const [literal,answer]of [['true',true],['false',false],['null',null]])if(text.startsWith(literal,offset)){offset+=literal.length;return answer;}const match=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(offset));assert.ok(match);offset+=match[0].length;const answer=Number(match[0]);assert.equal(Number.isFinite(answer),true);return answer;}const result=value(0);space();assert.equal(offset,text.length);return result;
}
function exactKeys(value,keys){assert.ok(value!==null&&typeof value==='object'&&!Array.isArray(value));assert.deepEqual(Object.keys(value).sort(),[...keys].sort(),'closed receipt fields');}
function checkEvents(events){assert.ok(Array.isArray(events)&&events.length<=QUOTAS.events);const shapes={RESOLVE_ATTEMPT:['parent','specifier','url'],RESOLVE_RETURN:['parent','specifier','url'],LOAD_ATTEMPT:['url'],LOAD_RETURN:['url','bytes','sha256'],FORBIDDEN_ATTEMPT:['phase','url'],SYNTHETIC_REJECTION:['url'],STATIC_ONLY:['modules','tokens','constructed','linked','evaluated'],ORDINARY_LIFECYCLE:['ownership','uniformLimit','closed'],FACADE_NEGATIVE:['entry'],FACTORY_NEGATIVE:['wholePrototypeChain'],EXPLICIT_ENTRY_CACHED:['url'],COLD_LIFECYCLE:['readback','twoPasses','closed'],AUTHENTIC_PROTOCOL:['sevenActualReferences','stableIdentity','predicateNoReads'],HOST_BEHAVIORS:['namedAssertions'],STARTUP_SETTLED:['code','synthetic','causeSame','cancelled','gpuEvents','closed'],OPERATION_DEADLINE:[]};const gpu={push:['filter'],pipeline:['pipeline','uniform'],layout:['pipeline'],buffer:['size','usage'],texture:['format'],destroyTexture:['format'],textureView:['format'],writeBuffer:['byteLength','offset','usage'],writeTexture:['byteLength'],bindGroup:['bindings'],pass:['colorLoad','hasDepth','depthFormat','depthClear','depthStore'],uiPipeline:['pipeline'],addListener:[],removeListener:[],deviceDestroy:[],pop:[],shader:[],sampler:[],destroyBuffer:[],unmap:[],map:[],encoder:[],draw:[],drawIndexed:[],end:[],copy:[],finish:[],configure:[],unconfigure:[],target:[],targetView:[],context:[],acquireDevice:[],preferred:[],adapter:[],submit:[],fence:[]};for(const event of events){assert.equal(typeof event.kind,'string');if(event.kind==='GPU'){assert.ok(Object.hasOwn(gpu,event.operation));exactKeys(event,['kind','fixture','operation',...gpu[event.operation]]);assert.ok(Number.isSafeInteger(event.fixture)&&event.fixture>=0);}else{assert.ok(Object.hasOwn(shapes,event.kind));exactKeys(event,['kind',...shapes[event.kind]]);}}}
function validateReceipt(receipt,program,worker,pid,environment){
  exactKeys(receipt,['schemaVersion','caseId','pid','ppid','node','execArgv','argv','cwd','program','config','context','environment','status','operationTimedOut','cleanupTimedOut','driverCallbackFailure','assertionFailure','cleanupFailures','cleanupOutcomes','unhandledRejections','forbiddenAttempts','syntheticThrows','startupEvidence','staticEdges','dynamicEdges','staticClosures','divisionWitnesses','events']);
  assert.equal(receipt.schemaVersion,1);assert.equal(receipt.caseId,program.caseId);assert.equal(receipt.pid,pid);assert.equal(receipt.ppid,worker.pid);assert.equal(receipt.node,'v24.19.0');
  assert.deepEqual(receipt.execArgv,program.execArgv);assert.ok(Array.isArray(receipt.argv));assert.equal(receipt.argv.length,3);
  // Preserve raw argv evidence; only executable/script paths admit OS separator spelling.
  for(let index=0;index<2;index++){assert.equal(typeof receipt.argv[index],'string');assert.equal(normalize(receipt.argv[index]),canonical(receipt.argv[index]));}
  assert.deepEqual(receipt.argv.slice(0,2).map(canonical),[worker.nodeExecutable.path,program.driver.path]);assert.equal(receipt.argv[2],program.caseId);assert.equal(receipt.cwd,program.cwd);assert.deepEqual(receipt.program,program.driver);assert.deepEqual(receipt.config,program.config);
  exactKeys(receipt.context,['isMainThread','threadId','NODE_TEST_CONTEXT','NODE_TEST_WORKER_ID']);assert.equal(receipt.context.isMainThread,true);assert.equal(receipt.context.threadId,0);
  for(const item of [receipt.context.NODE_TEST_CONTEXT,receipt.context.NODE_TEST_WORKER_ID]){exactKeys(item,['present','value']);assert.deepEqual(item,{present:false,value:null});}
  assert.deepEqual(receipt.environment,environment);assert.ok(['PASSED','FAILED'].includes(receipt.status));assert.equal(typeof receipt.operationTimedOut,'boolean');assert.equal(typeof receipt.cleanupTimedOut,'boolean');
  if(receipt.driverCallbackFailure!==null){exactKeys(receipt.driverCallbackFailure,['kind']);assert.equal(receipt.driverCallbackFailure.kind,'DRIVER_CALLBACK_FAILURE');}
  for(const key of ['unhandledRejections','forbiddenAttempts','syntheticThrows'])assert.ok(Number.isSafeInteger(receipt[key])&&receipt[key]>=0);
  if(receipt.assertionFailure!==null)exactKeys(receipt.assertionFailure,['name','code','message']);
  const cleanup=item=>{exactKeys(item,['index','settlement','state','outcome','code','admittedUnsafe']);assert.ok(Number.isSafeInteger(item.index)&&item.index>=0);assert.ok(['pending','fulfilled','rejected'].includes(item.settlement));assert.equal(typeof item.admittedUnsafe,'boolean');};
  for(const item of receipt.cleanupOutcomes)cleanup(item);for(const item of receipt.cleanupFailures)cleanup(item);
  if(receipt.status==='PASSED'){assert.equal(receipt.cleanupTimedOut,false);assert.equal(receipt.driverCallbackFailure,null);assert.equal(receipt.cleanupFailures.length,0);assert.equal(receipt.cleanupOutcomes.some(item=>item.settlement==='pending'),false);}
  for(const edge of [...receipt.staticEdges,...receipt.dynamicEdges])exactKeys(edge,['parent','specifier','url']);for(const closure of receipt.staticClosures)exactKeys(closure,['name','modules']);
  for(const item of receipt.divisionWitnesses){exactKeys(item,['url','sha256','constructed','linked','evaluated','anchors']);assert.equal(item.constructed,true);assert.equal(item.linked,false);assert.equal(item.evaluated,false);for(const anchor of item.anchors){exactKeys(anchor,['expression','byteOffset','slashByteOffset']);assert.ok(Number.isSafeInteger(anchor.byteOffset)&&anchor.byteOffset>=0);assert.ok(Number.isSafeInteger(anchor.slashByteOffset)&&anchor.slashByteOffset>=anchor.byteOffset);}}
  if(receipt.startupEvidence!==null)exactKeys(receipt.startupEvidence,['code','synthetic','causeSame','cancelled','gpuEvents','closed']);checkEvents(receipt.events);return receipt;
}

function assertSame(descriptor){assert.deepEqual(fileDescriptor(descriptor.path),descriptor);}
function preparedPrograms(output,inventory){const programs=[];for(const caseId of CASE_ORDER){const directory=output+'/'+caseId;fs.mkdirSync(directory);const driverPath=directory+'/driver.mjs';const configPath=directory+'/driver.json';const config={schemaVersion:1,caseId,...inventory};fs.writeFileSync(driverPath,DRIVER_SOURCE,{flag:'wx'});fs.writeFileSync(configPath,JSON.stringify(config)+'\n',{flag:'wx'});programs.push({caseId,driver:fileDescriptor(driverPath),config:fileDescriptor(configPath),receiptPath:directory+'/driver.receipt.json',directory,cwd:inventory.repository,execArgv:caseId==='S01'?['--experimental-vm-modules']:[]});}return programs;}
const writeData=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
// Error classification never serializes arbitrary thrown values or messages.
function observerFailure(operation,cause,atMs){
  let name='ThrownValue',code=null;
  try{if(['Error','TypeError','RangeError','SyntaxError','AssertionError'].includes(cause?.name))name=cause.name;
    if(['EIO','EPIPE','ENOSPC','ENOENT','EACCES','EPERM','EBADF','EMFILE','ENFILE','ERR_ASSERTION','ERR_STREAM_DESTROYED'].includes(cause?.code))code=cause.code;
  }catch{}
  return {operation,name,code,atMs};
}
function traceEmitter(worker){
  let firstFailure=null;
  return {failure:()=>firstFailure,emit(kind,fields={}){
    if(firstFailure)return false;
    try{
      const bytes=Buffer.from('EGRET_B1_TRACE '+JSON.stringify({schemaVersion:1,kind,workerPid:worker.pid,workerPpid:worker.ppid,...fields})+'\n');
      assert.ok(bytes.length<=QUOTAS.receiptBytes,'trace row quota');
      // A synchronous owned write has no asynchronous callback rejection route.
      // Containment still treats write failure as failure, never successful output.
      for(let offset=0;offset<bytes.length;){const written=fs.writeSync(1,bytes,offset,bytes.length-offset);assert.ok(written>0);offset+=written;}
      return true;
    }catch(cause){firstFailure=observerFailure('TRACE_OUTPUT',cause,performance.now());return false;}
  }};
}
async function observedCase(program,worker,inventory,trace,ledger){
  const environment=driverEnvironment(worker,program.directory);
  for(const descriptor of [...inventory.files,...inventory.metadata,program.driver,program.config,worker.nodeExecutable])assertSame(descriptor);
  const start=performance.now(),events=[],streams={stdout:{bytes:0,eof:false},stderr:{bytes:0,eof:false}};
  let child=null,pid=null,exitCode=null,signal=null,closed=false,overflow=false,spawnFailed=false,timeout=false,retirementDeadline=false;
  const journal=program.directory+'/observer.jsonl';
  fs.writeFileSync(journal,'',{flag:'wx'});
  for(const name of ['stdout','stderr'])fs.writeFileSync(program.directory+'/'+name+'.raw',Buffer.alloc(0),{flag:'wx'});
  const request={schemaVersion:1,caseId:program.caseId,worker:{pid:worker.pid,ppid:worker.ppid,context:worker.context},argv:[worker.nodeExecutable.path,...program.execArgv,program.driver.path,program.caseId],cwd:program.cwd,shell:false,stdio:['ignore','pipe','pipe'],environment,program:program.driver,config:program.config,sourceManifestSha256:hash(Buffer.from(JSON.stringify(inventory))),limits:{operationMs:QUOTAS.operationMs,cleanupMs:QUOTAS.closeMs,terminateAtMs:15000,receiptAtMs:20000,stdoutBytes:QUOTAS.stdoutBytes,stderrBytes:QUOTAS.stderrBytes}};
  // Fallible preparation is finished before consuming the in-memory attempt.
  writeData(program.directory+'/prepared-request.json',request);
  const attemptClock=performance.now();
  const entry={caseId:program.caseId,attempted:true,attemptAtMs:attemptClock-start,started:false,pid:null,spawnFailed:false,spawnFailure:null,exitObserved:false,exitCode:null,signal:null,closeReceived:false,closeCode:null,closeSignal:null,stdoutEOF:false,stderrEOF:false,terminationRequested:false,terminationError:false,completionReturned:false,status:'ATTEMPTED_UNFINISHED',observerFailure:null};
  const state={firstFailure:null};
  let resolveClose,resolveRetirement;
  const closePromise=new Promise(resolve=>{resolveClose=resolve;});
  const retiredPromise=new Promise(resolve=>{resolveRetirement=resolve;});
  const maybeRetired=()=>{if(closed&&streams.stdout.eof&&streams.stderr.eof)resolveRetirement();};
  const terminateOwned=()=>{
    if(!child||closed||entry.terminationRequested)return;
    entry.terminationRequested=true;
    try{child.kill();}catch{entry.terminationError=true;}
  };
  const fail=(operation,cause)=>{
    state.firstFailure??=observerFailure(operation,cause,performance.now()-start);
    entry.observerFailure=state.firstFailure;
    terminateOwned();
  };
  const guard=(operation,action)=>(...args)=>{try{action(...args);}catch(cause){fail(operation,cause);}};
  const persistEvent=event=>{
    if(state.firstFailure)return;
    try{fs.appendFileSync(journal,JSON.stringify(event)+'\n');if(!trace.emit(event.kind,{caseId:program.caseId,...event}))fail('TRACE_OUTPUT',trace.failure());}
    catch(cause){fail('EVENT_OUTPUT',cause);}
  };
  const record=(kind,fields={})=>{
    try{
      assert.ok(events.length<QUOTAS.events,'observer event quota');
      const event={kind,atMs:performance.now()-start,...fields};events.push(event);persistEvent(event);
    }catch(cause){fail('EVENT_RECORD',cause);}
  };
  // This ledger, not successful results or disk writes, owns the consumed attempt.
  // No fallible evidence operation occurs between this commit and spawn.
  ledger.push(entry);
  try{child=spawn(worker.nodeExecutable.path,[...program.execArgv,program.driver.path,program.caseId],{cwd:program.cwd,env:environment,shell:false,stdio:['ignore','pipe','pipe']});}
  catch(cause){spawnFailed=true;entry.spawnFailed=true;entry.spawnFailure=observerFailure('SPAWN_THROW',cause,performance.now()-start);resolveRetirement();}
  const attemptEvent={kind:'CASE_ATTEMPT',atMs:entry.attemptAtMs};events.push(attemptEvent);
  if(child){
    try{
      child.on('error',guard('PROCESS_ERROR_CALLBACK',cause=>{spawnFailed=true;entry.spawnFailed=true;entry.spawnFailure=observerFailure('PROCESS_ERROR',cause,performance.now()-start);record('PROCESS_ERROR',{failure:entry.spawnFailure});}));
      child.on('close',guard('PROCESS_CLOSE_CALLBACK',(code,actualSignal)=>{
        closed=true;exitCode=code;signal=actualSignal;entry.closeReceived=true;entry.closeCode=code;entry.closeSignal=actualSignal;
        // Close settlement and lifecycle flags do not depend on evidence I/O.
        resolveClose();maybeRetired();record('PROCESS_CLOSED',{pid,exitCode,signal,stdoutEOF:streams.stdout.eof,stderrEOF:streams.stderr.eof});
      }));
      child.on('spawn',guard('PROCESS_SPAWN_CALLBACK',()=>{pid=child.pid;entry.started=true;entry.pid=pid;record('PROCESS_STARTED',{pid});}));
      child.on('exit',guard('PROCESS_EXIT_CALLBACK',(code,actualSignal)=>{exitCode=code;signal=actualSignal;entry.exitObserved=true;entry.exitCode=code;entry.signal=actualSignal;record('PROCESS_EXIT',{exitCode,signal});}));
      for(const name of ['stdout','stderr']){
        const stream=child[name];
        stream.on('end',guard('STREAM_EOF_CALLBACK',()=>{streams[name].eof=true;entry[name+'EOF']=true;maybeRetired();record('STREAM_EOF',{stream:name,received:streams[name].bytes});}));
        stream.on('error',guard('STREAM_ERROR_CALLBACK',cause=>{fail('STREAM_ERROR',cause);record('STREAM_ERROR',{stream:name});}));
        stream.on('data',guard('STREAM_DATA_CALLBACK',bytes=>{
          const prior=streams[name].bytes;streams[name].bytes+=bytes.length;
          const allowed=Math.max(0,QUOTAS[name+'Bytes']-prior);
          if(allowed&&!state.firstFailure)fs.appendFileSync(program.directory+'/'+name+'.raw',bytes.subarray(0,allowed));
          if(streams[name].bytes>QUOTAS[name+'Bytes']&&!overflow){overflow=true;record('OUTPUT_OVERFLOW',{stream:name,received:streams[name].bytes});terminateOwned();}
        }));
      }
    }catch(cause){fail('HANDLER_INSTALL',cause);}
  }
  persistEvent(attemptEvent);
  try{writeData(program.directory+'/attempt.json',{...request,attemptConsumedBeforeSpawn:true,attemptAtMs:entry.attemptAtMs});}
  catch(cause){fail('ATTEMPT_OUTPUT',cause);}
  if(entry.spawnFailure)record('SPAWN_FAILED',{failure:entry.spawnFailure});
  const terminate=setTimeout(guard('TERMINATION_TIMER',()=>{timeout=true;record('TERMINATION_REQUEST',{pid});terminateOwned();}),Math.max(0,15000-(performance.now()-attemptClock)));
  let deadline;
  const bounded=new Promise(resolve=>{deadline=setTimeout(guard('RETIREMENT_TIMER',()=>{retirementDeadline=true;record('RETIREMENT_DEADLINE',{pid,closed,stdoutEOF:streams.stdout.eof,stderrEOF:streams.stderr.eof});resolve();}),Math.max(0,20000-(performance.now()-attemptClock)));});
  await Promise.race([retiredPromise,bounded]);clearTimeout(terminate);clearTimeout(deadline);
  // A completed close Promise is a separate fact from both EOF/retirement.
  if(closed)await closePromise;
  let receipt=null,receiptFailure=null;
  try{
    assert.equal(closed,true,'UNSAFE_UNFINISHED direct child');assert.equal(streams.stdout.eof,true,'stdout missing EOF');assert.equal(streams.stderr.eof,true,'stderr missing EOF');
    assert.equal(spawnFailed,false);assert.equal(timeout,false);assert.equal(overflow,false);assert.equal(signal,null);assert.equal(state.firstFailure,null);assert.equal(trace.failure(),null);
    const descriptor=fileDescriptor(program.receiptPath);assert.ok(descriptor.bytes<=QUOTAS.receiptBytes);
    receipt=validateReceipt(strictJSON(fs.readFileSync(program.receiptPath)),program,worker,pid,environment);
    const rows=fs.readFileSync(program.directory+'/stdout.raw','utf8').trimEnd().split('\n');assert.equal(rows.length,1);
    const summary=strictJSON(Buffer.from(rows[0]));exactKeys(summary,['kind','caseId','path','bytes','sha256','status']);
    assert.deepEqual(summary,{kind:'DRIVER_RECEIPT',caseId:program.caseId,path:program.receiptPath,bytes:descriptor.bytes,sha256:descriptor.sha256,status:receipt.status});
    for(const item of [...inventory.files,...inventory.metadata,program.driver,program.config,worker.nodeExecutable])assertSame(item);
  }catch(cause){receiptFailure=observerFailure('RECEIPT_VALIDATION',cause,performance.now()-start);}
  const raw={stdout:null,stderr:null};
  for(const name of ['stdout','stderr']){try{raw[name]=fileDescriptor(program.directory+'/'+name+'.raw');}catch(cause){fail('RAW_IDENTITY',cause);}}
  const outcome=()=>child&&(!closed||!streams.stdout.eof||!streams.stderr.eof)?'UNSAFE_UNFINISHED':state.firstFailure||trace.failure()||receiptFailure||spawnFailed||timeout||overflow||exitCode!==0||receipt?.status!=='PASSED'?'FAILED':'PASSED';
  const result={schemaVersion:1,caseId:program.caseId,pid,exitCode,signal,closed,streams,spawnFailed,timeout,retirementDeadline,overflow,elapsedMs:performance.now()-start,status:outcome(),receiptFailure,receipt,events,raw,observerFailure:state.firstFailure,traceFailure:trace.failure(),observationPhase:'BEFORE_COMPLETION_RETURN'};
  let observed=null;
  try{writeData(program.directory+'/observed.json',result);observed=fileDescriptor(program.directory+'/observed.json');}catch(cause){fail('OBSERVATION_OUTPUT',cause);}
  if(!trace.emit('CASE_FINISHED',{caseId:program.caseId,observationPhase:'BEFORE_COMPLETION_RETURN',pid,closed,stdoutEOF:streams.stdout.eof,stderrEOF:streams.stderr.eof,observed}))fail('CASE_FINISHED_OUTPUT',trace.failure());
  result.status=outcome();result.observerFailure=state.firstFailure;result.traceFailure=trace.failure();
  entry.status=result.status;entry.completionReturned=true;entry.observerFailure=state.firstFailure;
  return result;
}

test('B1 fixed thirteen-case emitted loading and owned host contract', {timeout:QUOTAS.workerMs}, async()=>{
  const worker=callerEnvironment(),repository=canonical(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
  const selected=process.env.EGRET_B1_TRACE_EVIDENCE_DIR;
  const output=selected===undefined?normalize(fs.mkdtempSync(path.join(os.tmpdir(),'egret-b1-trace-'))):exclusiveDirectory(selected);
  const trace=traceEmitter(worker),attemptLedger=[];
  let programs=[],results=[];
  const accounting=()=>({attempted:attemptLedger.map(entry=>entry.caseId),notAttempted:CASE_ORDER.filter(caseId=>!attemptLedger.some(entry=>entry.caseId===caseId)).map(caseId=>({caseId,status:'NOT_ATTEMPTED_DUE_TO_FAILURE'})),attemptLedger:attemptLedger.map(entry=>({...entry}))});
  try{
    writeData(output+'/worker.json',worker);
    assert.equal(trace.emit('WORKER_CAPTURED',{output,worker:fileDescriptor(output+'/worker.json')}),true,'worker output failed');
    const inventory=sourceInventory(repository);writeData(output+'/source-manifest.json',inventory);
    programs=preparedPrograms(output,inventory);writeData(output+'/programs.json',programs);
    for(const program of programs){assertSame(program.driver);assertSame(program.config);}
    assert.equal(trace.emit('PROGRAMS_PREPARED',{order:CASE_ORDER,programs,manifest:fileDescriptor(output+'/source-manifest.json'),inventory:fileDescriptor(output+'/programs.json'),worker:fileDescriptor(output+'/worker.json')}),true,'prepared output failed');
    for(const program of programs){
      const result=await observedCase(program,worker,inventory,trace,attemptLedger);results.push(result);
      if(result.status!=='PASSED')throw Error('INCOMPLETE '+program.caseId+' '+result.status);
    }
    const staticReceipt=results[0].receipt;
    assert.equal(staticReceipt.events.some(e=>e.kind==='STATIC_ONLY'&&e.linked===false&&e.evaluated===false),true);
    const resolved=results.slice(1).flatMap(result=>result.receipt.events.filter(e=>e.kind==='RESOLVE_RETURN'));
    for(const edge of staticReceipt.staticEdges)assert.equal(resolved.some(event=>event.parent===edge.parent&&event.specifier===edge.specifier&&event.url===edge.url),true,'unobserved static request '+edge.parent+' '+edge.specifier);
    assert.equal(results.length,13);assert.equal(attemptLedger.length,13);assert.equal(trace.failure(),null);
    const slot={schemaVersion:1,status:'PASSED',schedule:CASE_ORDER,...accounting(),staticRequestCorroboration:true,results:results.map(result=>({caseId:result.caseId,status:result.status,pid:result.pid})),traceFailure:null};
    writeData(output+'/slot.json',slot);
    assert.equal(trace.emit('SLOT_FINISHED',{status:'PASSED',attempts:attemptLedger.length,schedule:CASE_ORDER,slot:fileDescriptor(output+'/slot.json')}),true,'final output failed');
  }catch(cause){
    // The ledger still records a consumed/started child if observedCase or an
    // output failed before a result could be returned. Results never own counts.
    const slot={schemaVersion:1,status:attemptLedger.length===0?'SETUP_FAILED':'INCOMPLETE',schedule:CASE_ORDER,...accounting(),failure:observerFailure('SLOT_FAILURE',cause,performance.now()),results:results.map(result=>({caseId:result.caseId,status:result.status,pid:result.pid})),traceFailure:trace.failure()};
    let failurePath=output+'/slot.json',failureOutput=null;
    try{if(fs.existsSync(failurePath))failurePath=output+'/slot-failure.json';writeData(failurePath,slot);failureOutput=fileDescriptor(failurePath);}catch(writeCause){failureOutput={failed:true,failure:observerFailure('SLOT_OUTPUT',writeCause,performance.now())};}
    trace.emit('SLOT_FINISHED',{status:slot.status,attempts:attemptLedger.length,notAttempted:slot.notAttempted,slot:failureOutput});
    throw cause;
  }
});
