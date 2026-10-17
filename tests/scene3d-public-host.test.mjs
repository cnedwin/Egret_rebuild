import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine,createEngineForProfile,Sprite,createImageData2D,TEXTURED_FRAME_PROFILE_2D} from '@egret/engine';
import {createWebGPUHost} from '@egret/engine/webgpu';
import {createMeshGeometry3D,createSceneFrame3D,isSceneFrame3D} from '@egret/engine/scene3d';
import {createSceneWebGPUHost} from '@egret/engine/webgpu/scene3d';

// The genuine built public Host runs over a recording GPU boundary. This proves
// CPU admission, encoding order and ownership only; it is not native GPU proof.
const ID=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const PROJECTION={kind:'orthographic',left:-1,right:1,bottom:-1,top:1,near:1,far:3};
const geometry=()=>createMeshGeometry3D({positions:[0,0,-1,1,0,-1,0,1,-1],colors:[1,0,0,0,1,0,0,0,1],indices:[0,1,2]});
const scene=(g=geometry(),draws=2)=>createSceneFrame3D({projection:PROJECTION,draws:Array.from({length:draws},()=>({geometry:g,modelView:ID}))});
const overlay=(commands=[],extra={})=>({frameId:7,width:1,height:1,clearColor:0x102030,clearAlpha:1,commands,...extra});
const rect=()=>({kind:'rect',matrix:{a:1,b:0,c:0,d:1,tx:0,ty:0},rect:{x:0,y:0,width:1,height:1},color:0xff0000,alpha:1,clips:[]});
function fixture() {
  const f={events:[],buffers:[],textures:[],fences:[],writes:[],pipelines:[],holdFence:false,deviceDestroyed:0,depthDestroyGetterReads:0};
  const event=(kind,fields={})=>{f.events.push({kind,...fields});};
  const queue={
    writeBuffer(buffer,offset,data){assert.equal(this,queue);event('writeBuffer',{byteLength:data.byteLength,offset,usage:buffer.usage});f.writes.push({buffer,usage:buffer.usage,bytes:new Uint8Array(data.buffer??data,data.byteOffset??0,data.byteLength).slice()});},
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
    createRenderPipelineAsync(descriptor){assert.equal(this,device);f.pipelines.push(descriptor);const kind=descriptor.depthStencil?'mesh':descriptor.vertex.buffers[0].arrayStride===16?'image':'rect';event('pipeline',{pipeline:kind,uniform:kind==='mesh'?64:kind==='image'?16:0});const pipeline={kind,getBindGroupLayout(index){assert.equal(this,pipeline);assert.equal(index,0);event('layout',{pipeline:kind});return {pipeline:kind};}};return Promise.resolve(pipeline);},
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
        setViewport(){assert.equal(this,pass);},setScissorRect(){assert.equal(this,pass);},setVertexBuffer(slot,buffer){assert.equal(this,pass);event('selectedVertex',{slot,buffer});},setIndexBuffer(buffer){assert.equal(this,pass);event('selectedIndex',{buffer});},setBindGroup(slot,binding){assert.equal(this,pass);event('selectedBinding',{slot,binding});},
        draw(){assert.equal(this,pass);event('draw');},drawIndexed(){assert.equal(this,pass);event('drawIndexed');f.onDrawIndexed?.();},end(){assert.equal(this,pass);event('end');}};return pass;},
      copyTextureToBuffer(){assert.equal(this,encoder);event('copy');},finish(){assert.equal(this,encoder);event('finish');return {};}};return encoder;}
  };
  const context={configure(){assert.equal(this,context);event('configure');},unconfigure(){assert.equal(this,context);event('unconfigure');},getCurrentTexture(){assert.equal(this,context);event('target');return {createView(){event('targetView');return {};}};}};
  const canvas={width:1,height:1,getContext(kind){assert.equal(this,canvas);assert.equal(kind,'webgpu');event('context');return context;}};
  const adapter={requestDevice(){assert.equal(this,adapter);event('acquireDevice');return Promise.resolve(device);}};
  const gpu={getPreferredCanvasFormat(){assert.equal(this,gpu);event('preferred');return 'rgba8unorm';},requestAdapter(){assert.equal(this,gpu);event('adapter');return Promise.resolve(adapter);}};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu}});
  return Object.assign(f,{device,queue,context,canvas});
}

async function withHost(options,run,beforeStart=()=>{}) {
  const navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const f=fixture();let h;
  try {
    beforeStart(f);h=createSceneWebGPUHost({canvas:f.canvas,device:{kind:'borrow',device:f.device},...options});
    await h.start();await run({f,h});
  } finally {
    f.releaseFences();
    try{if(h&&h.getStatus().state!=='closed')await h.close();}
    finally{if(navigatorDescriptor)Object.defineProperty(globalThis,'navigator',navigatorDescriptor);else delete globalThis.navigator;}
    if(h){assert.equal(h.getStatus().state,'closed');assert.equal(f.deviceDestroyed,0,'borrowed device remains caller owned');}
  }
}
function sceneFree(host){for(let object=host;object!==null;object=Object.getPrototypeOf(object))for(const name of ['renderSceneFrame','getSceneStatus'])assert.equal(Object.hasOwn(object,name),false,'ordinary public Host remains scene free across prototypes');}

// Callable ordinary-Host substitution must fail this named assertion before
// startup; cleanup still uses the actual returned standalone Host.
test('scene-method-contract',async()=>{
  const saved=Object.getOwnPropertyDescriptor(globalThis,'navigator'),f=fixture();let h;
  try{h=createSceneWebGPUHost({canvas:f.canvas,device:{kind:'borrow',device:f.device}});assert.equal(typeof h.renderSceneFrame,'function','scene-method-contract');assert.equal(typeof h.getSceneStatus,'function','scene-status-contract');assert.equal(f.events.length,0);}
  finally{try{if(h)await h.close();}finally{if(saved)Object.defineProperty(globalThis,'navigator',saved);else delete globalThis.navigator;}}
});
test('ordinary-public-host-scene-free-counterexample',async()=>{
  const saved=Object.getOwnPropertyDescriptor(globalThis,'navigator'),f=fixture();let h;
  try{h=createWebGPUHost({canvas:f.canvas,device:{kind:'borrow',device:f.device}});sceneFree(h);assert.equal(f.events.length,0);await h.start();sceneFree(h);h.renderFrame(overlay());await h.whenIdle();assert.equal(f.events.filter(e=>e.kind==='pass').length,1);}
  finally{try{if(h)await h.close();}finally{if(saved)Object.defineProperty(globalThis,'navigator',saved);else delete globalThis.navigator;}}
});
test('public-host-options-single-read-and-original-throw-preservation',async()=>{
  const saved=Object.getOwnPropertyDescriptor(globalThis,'navigator'),f=fixture();let h;let reads=0;
  try {
    const options={device:{kind:'borrow',device:f.device},get canvas(){reads++;return f.canvas;}};
    h=createSceneWebGPUHost(options);assert.equal(reads,1);assert.equal(h.surface,f.canvas);assert.equal(f.events.length,0);
    for(const cause of [undefined,null,17,Symbol('option'),new Error('caller')]) {
      let threw=false,error;try{createSceneWebGPUHost({get canvas(){throw cause;}});}catch(e){threw=true;error=e;}
      assert.equal(threw,true);assert.equal(error.code,'WEBGPU_OPTIONS_INVALID');assert.equal(error.cause,cause);
    }
  } finally{try{if(h)await h.close();}finally{if(saved)Object.defineProperty(globalThis,'navigator',saved);else delete globalThis.navigator;}}
});
test('public-host-foreign-scene-admission',async()=>{
  const value=scene();
  // With a frozen scene clone returned by the public factory this named
  // assertion refuses at the Host boundary, rather than at an import failure.
  await withHost({},async({f,h})=>{
    assert.doesNotThrow(()=>{assert.equal(h.renderSceneFrame(value,overlay()),undefined);},'public-host-authentic-scene-admission');await h.whenIdle();
    const before=h.getSceneStatus(),events=f.events.length;let reads=0;
    const foreign=new Proxy({}, {get(){reads++;throw 'scene';},getPrototypeOf(){reads++;throw 'prototype';}});
    const revoked=Proxy.revocable(value,{});revoked.revoke();
    for(const bad of [foreign,Object.freeze({...value}),new Proxy(value,{}),revoked.proxy])assert.throws(()=>h.renderSceneFrame(bad,overlay()),e=>e.code==='WEBGPU_FRAME_INVALID');
    assert.equal(reads,0);assert.equal(f.events.length,events);assert.deepEqual(h.getSceneStatus(),before);
  });
});
test('public-host-repeated-identity-packs-once-with-independent-uniforms-and-settlement',async()=>{
  const value=scene();assert.equal(isSceneFrame3D(value),true);
  await withHost({},async({f,h})=>{
    f.holdFence=true;assert.equal(h.renderSceneFrame(value,overlay()),undefined);
    assert.deepEqual([h.getSceneStatus().pendingSceneBytes,h.getSceneStatus().pendingUniformBytes,h.getSceneStatus().pendingDepthBytes,h.getStatus().pendingUploadBytes],[84,128,4,212]);
    assert.deepEqual(f.events.filter(e=>e.kind==='buffer').map(e=>[e.size,e.usage]).sort((a,b)=>a[1]-b[1]),[[12,24],[72,40],[64,72],[64,72]]);
    const uniforms=f.writes.filter(write=>write.usage===72);assert.equal(uniforms.length,2);
    for(const write of uniforms)assert.deepEqual([...new Float32Array(write.bytes.buffer)],[1,0,0,0,0,1,0,0,0,0,.5,0,0,0,1.5,1]);
    assert.equal(f.events.filter(e=>e.kind==='drawIndexed').length,2);assert.equal(f.events.filter(e=>e.kind==='submit').length,1);
    const firstVertices=f.events.filter(e=>e.kind==='selectedVertex').map(e=>e.buffer),firstIndices=f.events.filter(e=>e.kind==='selectedIndex').map(e=>e.buffer),firstBindings=f.events.filter(e=>e.kind==='selectedBinding').map(e=>e.binding);
    assert.equal(firstVertices.length,2);assert.equal(firstIndices.length,2);assert.equal(firstBindings.length,2);
    assert.equal(firstVertices[0],firstVertices[1]);assert.equal(firstIndices[0],firstIndices[1]);
    assert.notEqual(firstBindings[0].descriptor.entries[0].resource.buffer,firstBindings[1].descriptor.entries[0].resource.buffer);
    assert.equal(f.buffers.every(b=>b.destroyed===0),true);
    f.releaseFences();await h.whenIdle();assert.deepEqual([h.getSceneStatus().pendingSceneBytes,h.getSceneStatus().pendingUniformBytes,h.getSceneStatus().pendingDepthBytes,h.getStatus().pendingUploadBytes],[0,0,0,0]);
    assert.equal(f.buffers.every(b=>b.destroyed===0),true);assert.equal(f.textures.every(t=>t.destroyed===1),true);
    // Settled buffers are rewritten and selected again; depth remains transient.
    f.holdFence=true;h.renderSceneFrame(value,overlay());
    assert.deepEqual([h.getSceneStatus().pendingSceneBytes,h.getSceneStatus().pendingUniformBytes,h.getSceneStatus().pendingDepthBytes,h.getStatus().pendingUploadBytes],[84,128,4,212]);
    assert.equal(f.buffers.length,4);assert.equal(f.events.filter(e=>e.kind==='bindGroup').length,2);assert.equal(f.writes.length,8);
    const warmVertices=f.events.filter(e=>e.kind==='selectedVertex').slice(2),warmIndices=f.events.filter(e=>e.kind==='selectedIndex').slice(2),warmBindings=f.events.filter(e=>e.kind==='selectedBinding').slice(2);
    assert.equal(warmVertices.length,2);assert.equal(warmIndices.length,2);assert.equal(warmBindings.length,2);
    assert.equal(warmVertices.every(e=>e.buffer===firstVertices[0]),true);assert.equal(warmIndices.every(e=>e.buffer===firstIndices[0]),true);
    assert.equal(warmBindings.every(e=>firstBindings.includes(e.binding)),true);assert.notEqual(warmBindings[0].binding,warmBindings[1].binding);
    const warmUniforms=f.writes.filter(write=>write.usage===72).slice(2);assert.equal(warmUniforms.length,2);
    assert.notEqual(warmUniforms[0].buffer,warmUniforms[1].buffer);
    assert.equal(warmUniforms.every(write=>warmBindings.some(e=>e.binding.descriptor.entries[0].resource.buffer===write.buffer)),true);
    for(const write of warmUniforms)assert.deepEqual([...new Float32Array(write.bytes.buffer)],[1,0,0,0,0,1,0,0,0,0,.5,0,0,0,1.5,1]);
    assert.equal(f.events.filter(e=>e.kind==='drawIndexed').length,4);assert.equal(f.events.filter(e=>e.kind==='submit').length,2);
    assert.equal(f.buffers.every(b=>b.destroyed===0),true);
    f.releaseFences();await h.whenIdle();assert.deepEqual([h.getSceneStatus().pendingSceneBytes,h.getSceneStatus().pendingUniformBytes,h.getSceneStatus().pendingDepthBytes,h.getStatus().pendingUploadBytes],[0,0,0,0]);
    assert.equal(f.buffers.every(b=>b.destroyed===0),true);assert.equal(f.textures.length,2);assert.equal(f.textures.every(t=>t.destroyed===1),true);
    await h.close();assert.equal(f.buffers.every(b=>b.destroyed===1),true);
    await h.close();assert.equal(f.buffers.every(b=>b.destroyed===1),true);assert.equal(f.textures.every(t=>t.destroyed===1),true);
  });
});
test('public-host-same-value-distinct-identity-and-empty-draw-charges',async()=>{
  const a=geometry(),b=geometry(),empty=createMeshGeometry3D({positions:[],colors:[],indices:[]});
  const value=createSceneFrame3D({projection:PROJECTION,draws:[{geometry:a,modelView:ID},{geometry:b,modelView:ID},{geometry:empty,modelView:ID}]});
  await withHost({},async({f,h})=>{f.holdFence=true;h.renderSceneFrame(value,overlay());assert.deepEqual([h.getSceneStatus().pendingSceneBytes,h.getSceneStatus().pendingUniformBytes,h.getStatus().pendingUploadBytes],[168,192,360]);assert.equal(f.events.filter(e=>e.kind==='drawIndexed').length,2);assert.equal(f.events.filter(e=>e.kind==='buffer'&&e.size===64&&e.usage===72).length,3);f.releaseFences();await h.whenIdle();});
});
test('scene-composition-contract',async()=>{
  await withHost({enableReadback:true},async({f,h})=>{
    const value=scene(),ticket=h.requestReadback();ticket.catch(()=>{});
    const image=createImageData2D({width:1,height:1,pixels:new Uint8Array([255,0,255,255])});
    const command={kind:'image',matrix:rect().matrix,rect:rect().rect,alpha:1,clips:[],imageIndex:0,sourceRect:{x:0,y:0,width:1,height:1}};
    assert.equal(typeof h.renderSceneFrame,'function','scene-composition-method-contract');
    h.renderSceneFrame(value,overlay([rect(),command,rect()],{images:[image]}));await ticket;await h.whenIdle();
    const passes=f.events.filter(e=>e.kind==='pass');assert.equal(passes.length,2,'scene-composition-two-pass-contract');
    assert.deepEqual(passes.map(e=>[e.colorLoad,e.hasDepth,e.depthFormat,e.depthClear,e.depthStore]),[['clear',true,'depth32float',0,'store'],['load',false,null,null,null]]);
    const mesh=f.pipelines.find(p=>p.depthStencil);assert.equal(mesh.depthStencil.format,'depth32float');assert.equal(mesh.depthStencil.depthCompare,'greater');assert.equal(mesh.depthStencil.depthWriteEnabled,true);
    assert.equal(mesh.primitive.topology,'triangle-list');assert.equal(mesh.primitive.cullMode,'none');assert.equal(mesh.primitive.frontFace,'ccw');
    assert.equal(mesh.vertex.buffers[0].arrayStride,24);assert.deepEqual(mesh.vertex.buffers[0].attributes.map(a=>[a.offset,a.format]),[[0,'float32x3'],[12,'float32x3']]);
    const ends=f.events.flatMap((e,i)=>e.kind==='end'?[i]:[]);assert.equal(ends.length,2);assert.ok(f.events.findIndex(e=>e.kind==='copy')>ends[1]);
    for(const name of ['target','targetView','encoder','finish','submit'])assert.equal(f.events.filter(e=>e.kind===name).length,1,name);
    assert.deepEqual(f.events.filter(e=>e.kind==='draw'||e.kind==='drawIndexed').map(e=>e.kind),['drawIndexed','drawIndexed','draw','draw','draw']);
    assert.deepEqual(f.events.filter(e=>e.kind==='uiPipeline').map(e=>e.pipeline),['rect','image','rect']);
  });
});
test('public-host-complete-scene-overlay-admission-is-transactional',async()=>{
  await withHost({maxUploadBytes:355,enableReadback:true},async({f,h})=>{
    const ticket=h.requestReadback();ticket.catch(()=>{});const before=f.events.length;
    assert.throws(()=>h.renderSceneFrame(scene(),overlay([rect()])),e=>e.code==='WEBGPU_FRAME_BUDGET');
    assert.equal(f.events.length,before);assert.deepEqual([h.getStatus().lastSerial,h.getStatus().pendingFrames,h.getStatus().pendingReadbackBytes],[0,0,0]);
    h.renderSceneFrame(createSceneFrame3D({projection:PROJECTION,draws:[]}),overlay());assert.equal((await ticket).serial,1);await h.whenIdle();
  });
  const profileHost={surface:{},texturedFrameProfile:TEXTURED_FRAME_PROFILE_2D,start(){},stop(){},async close(){},renderFrame(){},renderTexturedFrame(){},setTimeout(callback,delay){const timer=setTimeout(callback,delay);return()=>clearTimeout(timer);}};
  const profileEngine=await createEngineForProfile({host:profileHost},TEXTURED_FRAME_PROFILE_2D);
  try{
    const textured=profileEngine.captureTexturedFrame({width:1,height:1,clearAlpha:1});
    await withHost({},async({f,h})=>{const n=f.events.length;assert.throws(()=>h.renderSceneFrame(scene(),overlay([],{clearAlpha:0})),e=>e.code==='WEBGPU_FRAME_INVALID');assert.throws(()=>h.renderSceneFrame(scene(),textured),e=>e.code==='WEBGPU_FRAME_PROFILE_UNSUPPORTED');assert.equal(f.events.length,n);assert.equal(h.getStatus().lastSerial,0);});
  }finally{await profileEngine.dispose();}
});
test('public-host-readback-combined-260-byte-boundary',async()=>{
  for(const cap of [259,260])await withHost({enableReadback:true,maxReadbackBytes:cap},async({f,h})=>{
    const ticket=h.requestReadback();ticket.catch(()=>{});const n=f.events.length;
    if(cap===259){assert.throws(()=>h.renderSceneFrame(scene(),overlay()),e=>e.code==='WEBGPU_FRAME_BUDGET');assert.equal(f.events.length,n);h.stop();await assert.rejects(ticket,e=>e.code==='WEBGPU_STOPPED');}
    else{f.holdFence=true;h.renderSceneFrame(scene(),overlay());assert.equal(h.getStatus().pendingReadbackBytes,260);f.releaseFences();const pixels=await ticket;assert.equal(pixels.bytes.byteLength,4);assert.equal(pixels.serial,1);await h.whenIdle();assert.equal(h.getStatus().pendingReadbackBytes,0);}
  });
});
test('public-host-outstanding-upload-uniform-depth-and-device-bounds',async()=>{
  await withHost({maxPendingUploadBytes:423},async({f,h})=>{f.holdFence=true;h.renderSceneFrame(scene(),overlay());const n=f.events.length;assert.throws(()=>h.renderSceneFrame(scene(),overlay()),e=>e.code==='WEBGPU_BACKPRESSURE');assert.equal(f.events.length,n);assert.equal(h.getStatus().lastSerial,1);assert.equal(h.getStatus().pendingUploadBytes,212);f.releaseFences();await h.whenIdle();});
  const empty=createMeshGeometry3D({positions:[],colors:[],indices:[]}),value=scene(empty,64);
  await withHost({maxPendingFrames:3},async({f,h})=>{f.holdFence=true;h.renderSceneFrame(value,overlay());h.renderSceneFrame(value,overlay());assert.equal(h.getSceneStatus().pendingUniformBytes,8192);const n=f.events.length;assert.throws(()=>h.renderSceneFrame(value,overlay()),e=>e.code==='WEBGPU_BACKPRESSURE');assert.equal(f.events.length,n);assert.equal(h.getStatus().lastSerial,2);assert.equal(f.events.filter(e=>e.kind==='drawIndexed').length,0);f.releaseFences();await h.whenIdle();});
  await withHost({},async({f,h})=>{const n=f.events.length;assert.throws(()=>h.renderSceneFrame(scene(),overlay([],{width:2049,height:2048})),e=>e.code==='WEBGPU_FRAME_BUDGET');assert.equal(f.events.length,n);assert.equal(h.getStatus().lastSerial,0);});
  await withHost({},async({f,h})=>{const n=f.events.length;assert.throws(()=>h.renderSceneFrame(scene(),overlay()),e=>e.code==='WEBGPU_DEVICE_LIMIT');assert.equal(f.events.length,n);assert.equal(h.getStatus().lastSerial,0);},f=>{f.device.limits.maxBufferSize=71;});
});
test('public-host-attempted-upload-gets-fence-and-preserves-encoding-cause',async()=>{
  await withHost({},async({f,h})=>{const cause=Object.freeze({fault:'encode'});f.onDrawIndexed=()=>{throw cause;};assert.throws(()=>h.renderSceneFrame(scene(),overlay()),e=>e.code==='WEBGPU_RENDER_FAILED'&&e.cause===cause);assert.equal(f.events.filter(e=>e.kind==='submit').length,0);assert.equal(f.events.filter(e=>e.kind==='fence').length,1);await assert.rejects(h.whenIdle(),e=>e.cause===cause);await h.close();assert.equal(f.buffers.every(b=>b.destroyed===1),true);});
});
test('public-host-unsafe-fence-retains-ledger-and-reports-close',async()=>{
  await withHost({},async({f,h})=>{const cause=Object.freeze({fault:'fence'});f.fenceFailure=cause;h.renderSceneFrame(scene(),overlay());await assert.rejects(h.whenIdle(),e=>e.code==='WEBGPU_QUEUE_FAILED'&&e.cause===cause);assert.equal(h.getStatus().pendingFrames,1);assert.equal(h.getSceneStatus().pendingSceneBytes,84);await assert.rejects(h.close(),e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cause);assert.equal(h.getStatus().cleanupOutcome,'unsafe');assert.equal(h.getStatus().pendingFrames,0);assert.equal(f.buffers.every(b=>b.destroyed===1),true);});
});
test('public-host-scene-payload-and-logical-depth-outstanding-caps',async()=>{
  const max=()=>createMeshGeometry3D({positions:new Array(196608).fill(0),colors:new Array(196608).fill(0),indices:new Array(131070).fill(0)});
  const value=createSceneFrame3D({projection:PROJECTION,draws:[{geometry:max(),modelView:ID},{geometry:max(),modelView:ID}]});
  await withHost({maxPendingFrames:3},async({f,h})=>{
    f.holdFence=true;h.renderSceneFrame(value,overlay());h.renderSceneFrame(value,overlay());assert.equal(h.getSceneStatus().pendingSceneBytes,8388576);
    const n=f.events.length;assert.throws(()=>h.renderSceneFrame(value,overlay()),e=>e.code==='WEBGPU_BACKPRESSURE');assert.equal(f.events.length,n);assert.equal(h.getStatus().lastSerial,2);f.releaseFences();await h.whenIdle();
  });
  await withHost({maxPendingFrames:3},async({f,h})=>{
    f.holdFence=true;const frame=overlay([],{width:2048,height:2048});h.renderSceneFrame(scene(),frame);h.renderSceneFrame(scene(),frame);assert.equal(h.getSceneStatus().pendingDepthBytes,33554432);
    const n=f.events.length;assert.throws(()=>h.renderSceneFrame(scene(),frame),e=>e.code==='WEBGPU_BACKPRESSURE');assert.equal(f.events.length,n);assert.equal(h.getStatus().lastSerial,2);f.releaseFences();await h.whenIdle();
  });
});
test('public-host-startup-requires-64-byte-uniform-bindings',async()=>{
  const saved=Object.getOwnPropertyDescriptor(globalThis,'navigator'),f=fixture();let h;
  try{f.device.limits.maxUniformBufferBindingSize=63;h=createSceneWebGPUHost({canvas:f.canvas,device:{kind:'borrow',device:f.device}});await assert.rejects(h.start(),e=>e.code==='WEBGPU_DEVICE_LIMIT');assert.equal(f.events.filter(e=>e.kind==='submit').length,0);await h.close();assert.equal(f.deviceDestroyed,0);}
  finally{try{if(h&&h.getStatus().state!=='closed')await h.close();}finally{if(saved)Object.defineProperty(globalThis,'navigator',saved);else delete globalThis.navigator;}}
});
test('public-host-shared-reentrancy-barrier-and-caller-stop',async()=>{
  await withHost({},async({f,h})=>{let reentry;const frame=overlay();Object.defineProperty(frame,'width',{get(){try{h.renderFrame(overlay());}catch(e){reentry=e;}h.stop();return 1;}});const n=f.events.length;assert.throws(()=>h.renderSceneFrame(scene(),frame),e=>e.code==='WEBGPU_STOPPED');assert.equal(reentry.code,'WEBGPU_REENTRANT');assert.equal(h.getStatus().lastSerial,0);assert.equal(f.events.length,n);});
});
test('public-host-depth-view-close-reentry-retires-returned-resources',async()=>{
  await withHost({},async({f,h})=>{let closing;f.onDepthView=()=>{closing=h.close();closing.catch(()=>{});};assert.throws(()=>h.renderSceneFrame(scene(),overlay()),e=>e.code==='WEBGPU_RENDER_FAILED'&&e.cause.code==='WEBGPU_CLOSED');await closing;assert.equal(h.getStatus().state,'closed');assert.equal(f.textures.find(t=>t.format==='depth32float').destroyed,1);assert.equal(f.buffers.every(b=>b.destroyed===1),true);});
});
test('public-host-depth-destroy-getter-failure-is-unsafe-and-cause-preserving',async()=>{
  await withHost({},async({f,h})=>{const cause=Object.freeze({fault:'destroy getter'});f.depthDestroyGetterFailure=cause;assert.throws(()=>h.renderSceneFrame(scene(),overlay()),e=>e.code==='WEBGPU_RENDER_FAILED'&&e.cause===cause);await assert.rejects(h.close(),e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cause);assert.equal(h.getStatus().pendingFrames,0);assert.equal(f.depthDestroyGetterReads,1);assert.equal(h.getStatus().cleanupOutcome,'unsafe');});
});
test('public-host-engine-owns-captured-overlay-local-clip-and-lifecycle',async()=>{
  const saved=Object.getOwnPropertyDescriptor(globalThis,'navigator'),f=fixture();let engine;let h;
  try{
    h=createSceneWebGPUHost({canvas:f.canvas,device:{kind:'borrow',device:f.device}});engine=await createEngine({host:h});
    const scope=engine.createScope(),parent=scope.use(new Sprite()),child=scope.use(new Sprite());parent.x=28;parent.y=28;parent.clipRect={x:0,y:0,width:4,height:8};child.graphics.beginFill(0xff00ff).drawRect(0,0,8,8).endFill();parent.addChild(child);engine.stage.addChild(parent);
    const frame=engine.captureFrame({width:64,height:64,clearColor:0,clearAlpha:1});
    assert.equal(frame.commands.length,1);assert.deepEqual(frame.commands[0].clips,[{matrix:{a:1,b:0,c:0,d:1,tx:28,ty:28},rect:{x:0,y:0,width:4,height:8}}]);
    h.renderSceneFrame(scene(),frame);await h.whenIdle();assert.equal(f.events.filter(e=>e.kind==='pass').length,2);
    await engine.dispose();assert.equal(scope.state,'closed');assert.equal(engine.stage.isDisposed,true);assert.equal(child.isDisposed,true);assert.equal(h.getStatus().state,'closed');assert.equal(h.getStatus().cleanupOutcome,'safe');assert.equal(f.deviceDestroyed,0);
  }finally{try{if(engine)await engine.dispose();else if(h)await h.close();}finally{if(saved)Object.defineProperty(globalThis,'navigator',saved);else delete globalThis.navigator;}}
});
