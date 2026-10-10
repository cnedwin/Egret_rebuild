import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {createWebGPUHost} from '@egret/engine/webgpu';
import {GeometryPreparationError} from '../packages/engine/dist/rendering/prepareRectangles2D.js';
import {FrameCopyError} from '../packages/engine/dist/rendering/copyFrame2D.js';
import {ImageProjectionError} from '../packages/engine/dist/web/imageProjections2D.js';
import {WebGPUPackingError} from '../packages/engine/dist/web/webgpuPass.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});promise.catch(()=>{});return {promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
const matrix={a:1,b:0,c:0,d:1,tx:0,ty:0};
const image=(width=1,height=1,pixels=new Uint8Array(width*height*4))=>egret.createImageData2D({width,height,pixels});
const command=(imageIndex=0,sourceRect={x:0,y:0,width:1,height:1},extra={})=>({kind:'image',matrix,rect:{x:0,y:0,width:4,height:4},alpha:1,clips:[],imageIndex,sourceRect,...extra});
const rect=()=>({kind:'rect',matrix,rect:{x:0,y:0,width:4,height:4},alpha:.5,color:0xff0000,clips:[]});
const frame=(commands=[command()],images=[image()],extra={})=>({frameId:1,width:8,height:8,clearColor:0,clearAlpha:0,commands,images,...extra});
const code=value=>fault=>fault.code===`WEBGPU_${value}`;

// Only WebGPU is controlled here; real frame copying, geometry, engine leases and host run.
function fixture(){
 const calls=[],textures=[],buffers=[],fences=[],maps=[],pops=[],rectPipeline=deferred(),imagePipeline=deferred(),lost=deferred(),hooks={};let open=0;
 const invoke=(name,...args)=>hooks[name]?.(...args);
 const queue={writeTexture(...args){assert.equal(this,queue);calls.push(['writeTexture',args[0],new Uint8Array(args[1]),args[2],args[3]]);invoke('writeTexture',...args);},writeBuffer(...args){assert.equal(this,queue);calls.push(['writeBuffer',args[0],args[1],new Uint8Array(args[2].buffer,args[2].byteOffset,args[2].byteLength).slice()]);invoke('writeBuffer',...args);},submit(...args){calls.push(['submit',...args]);invoke('submit',...args);},onSubmittedWorkDone(){const d=deferred();fences.push(d);calls.push(['fence']);invoke('fence',d);return d.promise;}};
 const layout={},sampler={};
 const resolvedRect={kind:'rect'},resolvedImage={kind:'image',getBindGroupLayout(index){assert.equal(this,resolvedImage);calls.push(['layout',index]);invoke('layout',index);return layout;}};
 const device={queue,lost:lost.promise,limits:{maxTextureDimension2D:8192,maxBufferSize:268435456,maxVertexBuffers:1,maxVertexAttributes:2,maxVertexBufferArrayStride:24,maxColorAttachments:1,maxColorAttachmentBytesPerSample:4,maxBindGroups:1,maxBindingsPerBindGroup:3,maxSampledTexturesPerShaderStage:1,maxSamplersPerShaderStage:1,maxUniformBuffersPerShaderStage:1,maxUniformBufferBindingSize:16,maxBindGroupsPlusVertexBuffers:2,maxInterStageShaderVariables:1},
 addEventListener(...args){calls.push(['add',...args]);},removeEventListener(...args){calls.push(['remove',...args]);},destroy(){calls.push(['deviceDestroy']);},
 pushErrorScope(filter){calls.push(['push',filter]);open++;},popErrorScope(){const d=deferred();open--;pops.push(d);calls.push(['pop']);return d.promise;},
 createShaderModule(descriptor){calls.push(['shader',descriptor]);invoke('shader',descriptor);return {};},
 createRenderPipelineAsync(descriptor){const kind=descriptor.vertex.buffers[0].arrayStride===16?'image':'rect';calls.push(['pipeline',kind,descriptor]);invoke('pipeline',kind);return (kind==='image'?imagePipeline:rectPipeline).promise;},
 createSampler(descriptor){calls.push(['sampler',descriptor]);invoke('sampler',descriptor);return sampler;},
 createTexture(descriptor){const texture={descriptor,destroyed:0,destroy(){assert.equal(this,texture);texture.destroyed++;calls.push(['destroyTexture',texture]);invoke('destroyTexture',texture);},createView(){assert.equal(this,texture);calls.push(['imageView',texture]);invoke('imageView',texture);return {texture};}};textures.push(texture);calls.push(['createTexture',descriptor]);invoke('createTexture',texture);return texture;},
 createBindGroup(descriptor){const binding={descriptor};calls.push(['bindGroup',binding]);invoke('bindGroup',binding);return binding;},
 createBuffer(descriptor){const buffer={descriptor,data:new ArrayBuffer(descriptor.size),destroyed:0,unmapped:0,destroy(){buffer.destroyed++;calls.push(['destroyBuffer',buffer]);invoke('destroyBuffer',buffer);},unmap(){buffer.unmapped++;},mapAsync(){const d=deferred();maps.push(d);calls.push(['map',buffer]);invoke('map',d,buffer);return d.promise;},getMappedRange(){invoke('mappedRange',buffer);return buffer.data;}};buffers.push(buffer);calls.push(['buffer',buffer]);invoke('createBuffer',buffer);return buffer;},
 createCommandEncoder(){calls.push(['encoder']);invoke('encoder');const encoder={beginRenderPass(descriptor){calls.push(['pass',descriptor]);invoke('pass',descriptor);const pass=Object.fromEntries(['setPipeline','setViewport','setScissorRect','setVertexBuffer','setBindGroup','draw','end'].map(key=>[key,(...args)=>{calls.push([key,...args]);invoke(key,...args);} ]));invoke('passObject',pass);return pass;},copyTextureToBuffer(...args){calls.push(['copy',...args]);invoke('copy',...args);},finish(){calls.push(['finish']);invoke('finish');return {};}};return encoder;}};
 const context={configure(descriptor){calls.push(['configure',descriptor]);},unconfigure(){calls.push(['unconfigure']);},getCurrentTexture(){calls.push(['target']);invoke('target');return {createView(){calls.push(['targetView']);return {};}};}};
 let width=8,height=8;
 const canvas={getContext:()=>context,get width(){return width;},set width(value){width=value;calls.push(['width',value]);},get height(){return height;},set height(value){height=value;calls.push(['height',value]);}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{getPreferredCanvasFormat:()=> 'rgba8unorm'}}});
 const settleScopes=()=>pops.forEach(p=>p.resolve(null));
 const resolvePipelines=()=>{rectPipeline.resolve(resolvedRect);imagePipeline.resolve(resolvedImage);};
 const pump=async()=>{for(let i=0;i<6;i++){resolvePipelines();settleScopes();fences.forEach(p=>p.resolve());maps.forEach(p=>p.resolve());await tick();}};
 const ready=async host=>{const p=host.start();resolvePipelines();for(let i=0;i<5;i++){settleScopes();await tick();}await p;};
 const close=async(host,unsafe=false)=>{const p=host.close();await pump();if(unsafe)await assert.rejects(p,code('CLOSE_UNSAFE'));else await p;};
 const host=(options={})=>createWebGPUHost({canvas,device:{kind:'borrow',device},...options});
 return {calls,textures,buffers,fences,maps,pops,rectPipeline,imagePipeline,resolvedRect,resolvedImage,layout,sampler,lost,hooks,device,queue,context,canvas,settleScopes,resolvePipelines,pump,ready,close,host,get open(){return open;}};
}
const mutations=f=>f.calls.filter(c=>['width','height','configure','createTexture','buffer','writeTexture','writeBuffer','target','encoder','submit'].includes(c[0]));
async function reserved(canvas){const denied=createWebGPUHost({canvas});denied.start=()=>{throw Error('reservation opened');};await assert.rejects(egret.createEngine({host:denied}),e=>e.code==='SURFACE_IN_USE');}

test('image submission uses tight premultiplied crops, per-draw opacity and painter order',async()=>{
 const f=fixture(),h=f.host();await f.ready(h);
 const source=image(3,2,new Uint8Array([255,127,1,128,1,128,255,127,255,99,33,0,9,8,7,255,6,5,4,254,3,2,1,1]));
 const other=image(3,2,new Uint8Array(24));
 const full={x:0,y:0,width:3,height:2};
 h.renderFrame(frame([rect(),command(0,full,{alpha:.25}),rect(),command(0,full,{alpha:.75}),command(1,full)],[source,other]));
 assert.equal(f.textures.length,2);assert.deepEqual(f.textures[0].descriptor,{size:{width:3,height:2,depthOrArrayLayers:1},dimension:'2d',format:'rgba8unorm',mipLevelCount:1,sampleCount:1,usage:6});
 const uploads=f.calls.filter(c=>c[0]==='writeTexture');assert.equal(uploads.length,2);
 assert.deepEqual(uploads[0][1],{texture:f.textures[0],mipLevel:0,origin:{x:0,y:0,z:0},aspect:'all'});
 assert.deepEqual([...uploads[0][2]],[128,64,1,128,0,64,127,127,0,0,0,0,9,8,7,255,6,5,4,254,0,0,0,1]);
 assert.deepEqual(uploads[0][3],{offset:0,bytesPerRow:12,rowsPerImage:2});assert.deepEqual(uploads[0][4],{width:3,height:2,depthOrArrayLayers:1});
 assert.deepEqual(f.calls.filter(c=>c[0]==='setPipeline').map(c=>c[1].kind),['rect','image','rect','image','image']);
 assert.equal(f.calls.filter(c=>c[0]==='pass').length,1);
 const uniforms=f.buffers.filter(b=>b.descriptor.usage===72);assert.equal(uniforms.length,3);assert.ok(uniforms.every(b=>b.descriptor.size===16));
 const values=uniforms.map(b=>f.calls.find(c=>c[0]==='writeBuffer'&&c[1]===b)[3]);assert.deepEqual(values.map(b=>[...new Float32Array(b.buffer)]),[[.25,0,0,0],[.75,0,0,0],[1,0,0,0]]);
 const bindings=f.calls.filter(c=>c[0]==='bindGroup').map(c=>c[1].descriptor);assert.ok(bindings.every(b=>b.layout===f.layout));assert.equal(bindings[0].entries[0].resource,bindings[1].entries[0].resource);assert.notEqual(bindings[0].entries[2].resource.buffer,bindings[1].entries[2].resource.buffer);
 assert.deepEqual(bindings[0].entries.map(e=>e.binding),[0,1,2]);assert.equal(bindings[0].entries[1].resource,f.sampler);assert.deepEqual(bindings[0].entries[2].resource,{buffer:uniforms[0],offset:0,size:16});
 assert.equal(h.getStatus().pendingUploadBytes,624); // 2*144 + 3*(96+16)
 h.renderFrame(frame([command(0,full)],[source]));assert.equal(f.textures.length,3);assert.notEqual(f.textures[0],f.textures[2]);assert.ok(f.textures.every(t=>t.destroyed===0));
 await f.pump();await h.whenIdle();assert.ok(f.textures.every(t=>t.destroyed===1));await f.close(h);assert.ok(f.textures.every(t=>t.destroyed===1));
});

test('startup captures nearest sampler, both pipelines and the exact auto layout in the original scope batch',async()=>{
 const f=fixture(),h=f.host(),p=h.start();await tick();assert.equal(f.open,0);assert.deepEqual(f.calls.filter(c=>c[0]==='pipeline').map(c=>c[1]),['rect','image']);assert.equal(f.pops.length,3);assert.equal(f.calls.filter(c=>c[0]==='layout').length,0);
 f.rectPipeline.resolve(f.resolvedRect);f.settleScopes();await tick();assert.equal(h.getStatus().state,'starting');assert.equal(f.calls.filter(c=>c[0]==='configure').length,0);
 f.imagePipeline.resolve(f.resolvedImage);for(let i=0;i<5;i++){f.settleScopes();await tick();}await p;
 assert.equal(f.pops.length,6);assert.deepEqual(f.calls.filter(c=>c[0]==='layout'),[['layout',0]]);
 assert.deepEqual(f.calls.find(c=>c[0]==='sampler')[1],{addressModeU:'clamp-to-edge',addressModeV:'clamp-to-edge',addressModeW:'clamp-to-edge',magFilter:'nearest',minFilter:'nearest',mipmapFilter:'nearest',lodMinClamp:0,lodMaxClamp:0,maxAnisotropy:1});
 await f.close(h);
});

test('captured image methods ignore later caller replacements and rectangle passes never read bind methods',async()=>{
 const f=fixture(),h=f.host({maxPendingFrames:3});await f.ready(h);for(const key of ['createTexture','createSampler','createBindGroup'])f.device[key]=()=>{throw Error('replacement');};f.queue.writeTexture=()=>{throw Error('replacement');};f.resolvedImage.getBindGroupLayout=()=>{throw Error('replacement');};
 let reads=0;f.hooks.passObject=pass=>Object.defineProperty(pass,'setBindGroup',{get(){reads++;throw Error('rectangle bind getter');}});
 const pure=frame([rect()]);Object.defineProperty(pure,'images',{get(){throw Error('rectangle images');}});h.renderFrame(pure);h.renderFrame(frame([],[],{commands:[]}));assert.equal(reads,0);
 delete f.hooks.passObject;h.renderFrame(frame());assert.equal(f.textures.length,1);await f.close(h);
});

for(const [key,value] of [['maxBindGroups',0],['maxBindingsPerBindGroup',2],['maxSampledTexturesPerShaderStage',0],['maxSamplersPerShaderStage',0],['maxUniformBuffersPerShaderStage',0],['maxUniformBufferBindingSize',15],['maxBindGroupsPlusVertexBuffers',1],['maxInterStageShaderVariables',0]])test(`actual ${key} below image requirements rejects startup before creation`,async()=>{
 const f=fixture();f.device.limits[key]=value;const h=f.host(),p=h.start();await f.pump();await assert.rejects(p,code('DEVICE_LIMIT'));assert.equal(f.textures.length,0);assert.equal(f.calls.filter(c=>c[0]==='pipeline').length,0);await f.close(h);
});

test('aggregate uploads include each 16-byte uniform and device caps are per allocation with budget ties',async()=>{
 for(const [upload,buffer,commands,want] of [[256,144,[rect(),command()],null],[255,144,[rect(),command()],'FRAME_BUDGET'],[224,96,[command(),command()],null],[223,96,[command(),command()],'FRAME_BUDGET'],[112,95,[command()],'DEVICE_LIMIT'],[95,95,[command()],'FRAME_BUDGET'],[143,100,[rect()],'FRAME_BUDGET']]){
  const f=fixture();f.device.limits.maxBufferSize=buffer;const h=f.host({maxUploadBytes:upload});await f.ready(h);f.calls.length=0;
  if(want){assert.throws(()=>h.renderFrame(frame(commands)),code(want));assert.equal(h.getStatus().lastSerial,0);assert.deepEqual(mutations(f),[]);}else{h.renderFrame(frame(commands));assert.equal(h.getStatus().pendingUploadBytes,upload);assert.ok(f.buffers.every(b=>b.descriptor.size<=buffer));}
  await f.close(h);
 }
});

test('pending upload uniform charges reject before consuming a readback ticket and become reusable',async()=>{
 const f=fixture(),h=f.host({maxPendingUploadBytes:112,maxPendingFrames:3,enableReadback:true});await f.ready(h);h.renderFrame(frame());const ticket=h.requestReadback();f.calls.length=0;
 assert.throws(()=>h.renderFrame(frame()),code('BACKPRESSURE'));assert.equal(h.getStatus().lastSerial,1);assert.deepEqual(mutations(f),[]);await f.pump();h.renderFrame(frame());await f.pump();assert.equal((await ticket).serial,2);await f.close(h);
});

test('all-view projection capacity holds 32 MiB including undrawn crops and retires independently',async()=>{
 const f=fixture(),h=f.host({maxPendingFrames:3,enableReadback:true});await f.ready(h);
 const images=Array.from({length:4},()=>image(1024,1024));const large=frame(images.map((_,i)=>command(i,{x:0,y:0,width:1024,height:1024},{alpha:0})),images);
 h.renderFrame(large);h.renderFrame(large);assert.equal(f.textures.length,0);assert.equal(h.getStatus().pendingUploadBytes,0);assert.equal(h.getStatus().pendingFrames,2);
 const ticket=h.requestReadback();f.calls.length=0;assert.throws(()=>h.renderFrame(frame()),code('BACKPRESSURE'));assert.deepEqual(mutations(f),[]);assert.equal(h.getStatus().lastSerial,2);
 f.fences[0].resolve();f.pops.slice(6,9).forEach(p=>p.resolve(null));await tick();assert.equal(h.getStatus().pendingFrames,1);h.renderFrame(frame());await f.pump();assert.equal((await ticket).serial,3);assert.equal(f.textures.length,1);await f.close(h);
});

test('invisible views still receive dimension admission and invalid clips precede coverage',async()=>{
 const f=fixture();f.device.limits.maxTextureDimension2D=8;const h=f.host();await f.ready(h);f.calls.length=0;
 assert.throws(()=>h.renderFrame(frame([command(0,{x:0,y:0,width:9,height:1},{alpha:0})],[image(9,1)])),code('DEVICE_LIMIT'));assert.deepEqual(mutations(f),[]);assert.equal(h.getStatus().lastSerial,0);
 assert.throws(()=>h.renderFrame(frame([command(0,undefined,{alpha:0,clips:[{matrix,rect:{x:0,y:0,width:-1,height:1}}]})])),code('FRAME_INVALID'));assert.deepEqual(mutations(f),[]);await f.close(h);
});

test('zero alpha, singular, offscreen and float32-collapsed images make no texture, uniform or image pass calls',async()=>{
 const f=fixture(),h=f.host();await f.ready(h);f.calls.length=0;
 h.renderFrame(frame([command(0,undefined,{alpha:0}),command(0,undefined,{matrix:{...matrix,a:0,d:0}}),command(0,undefined,{rect:{x:20,y:20,width:1,height:1}}),command(0,undefined,{rect:{x:1,y:1,width:2**-30,height:2**-30}})]));
 assert.equal(f.textures.length,0);assert.equal(f.buffers.length,0);assert.equal(h.getStatus().pendingUploadBytes,0);assert.deepEqual(f.calls.filter(c=>['setPipeline','setViewport','setScissorRect','setVertexBuffer','setBindGroup','draw','bindGroup','writeTexture'].includes(c[0])),[]);assert.equal(f.calls.filter(c=>c[0]==='pass').length,1);await f.close(h);
});

test('an empty image keeps the original command-to-view association across rectangle runs',async()=>{
 const f=fixture(),h=f.host();await f.ready(h);h.renderFrame(frame([command(0,undefined,{alpha:0}),rect(),command(1)],[image(1,1,new Uint8Array([255,0,0,255])),image(1,1,new Uint8Array([0,255,0,255]))]));
 assert.equal(f.textures.length,1);assert.deepEqual([...f.calls.find(c=>c[0]==='writeTexture')[2]],[0,255,0,255]);assert.deepEqual(f.calls.filter(c=>c[0]==='setPipeline').map(c=>c[1].kind),['rect','image']);await f.close(h);
});

for(const boundary of ['pipeline','sampler','layout'])test(`startup ${boundary} failure drains every started pipeline without a new scope batch`,async()=>{
 const f=fixture(),fault={},h=f.host();f.hooks[boundary]=kind=>{if(boundary!=='pipeline'||kind==='image')throw fault;};const p=h.start();let settled=false;p.finally(()=>{settled=true;}).catch(()=>{});await tick();f.settleScopes();await tick();
 if(boundary!=='layout'){assert.equal(settled,false);assert.equal(f.open,0);assert.equal(f.pops.length,3);}f.resolvePipelines();await f.pump();await assert.rejects(p,e=>e.code==='WEBGPU_START_FAILED'&&e.cause===fault);assert.equal(f.calls.filter(c=>c[0]==='configure').length,0);await f.close(h);
});

test('sampler reentrant close observes both pipeline promises and layout is never read after cancellation',async()=>{
 const f=fixture(),h=f.host();let closing;f.hooks.sampler=()=>{closing=h.close();};const p=h.start();await tick();let settled=false;closing?.then(()=>{settled=true;});f.settleScopes();f.rectPipeline.resolve(f.resolvedRect);await tick();assert.equal(settled,false);f.imagePipeline.resolve(f.resolvedImage);await f.pump();await assert.rejects(p,code('START_CANCELLED'));assert.ok(closing);await closing;assert.equal(f.calls.filter(c=>c[0]==='layout').length,0);assert.equal(f.calls.filter(c=>c[0]==='deviceDestroy').length,0);
});

for(const boundary of ['writeTexture','finish','imageView','bindGroup'])test(`${boundary} failure retains owned textures until queue and scope settlement`,async()=>{
 const f=fixture(),h=f.host(),fault={};await f.ready(h);f.hooks[boundary]=()=>{throw fault;};assert.throws(()=>h.renderFrame(frame()),e=>e.code==='WEBGPU_RENDER_FAILED'&&e.cause===fault);assert.equal(f.textures.length,1);assert.equal(f.textures[0].destroyed,0);assert.equal(h.getStatus().pendingFrames,1);
 const wrote=boundary!=='imageView';assert.equal(f.fences.length,wrote?1:0);f.settleScopes();await tick();if(wrote)assert.equal(f.textures[0].destroyed,0);await f.pump();assert.equal(f.textures[0].destroyed,1);assert.equal(h.getStatus().pendingFrames,0);assert.equal(h.getStatus().firstFailure.cause,fault);await f.close(h);assert.equal(f.textures[0].destroyed,1);
});

test('GPU-thrown geometry budget objects keep their original terminal rendering cause',async()=>{
 const f=fixture(),h=f.host();await f.ready(h);const fault=new GeometryPreparationError('budget');f.hooks.writeTexture=()=>{throw fault;};assert.throws(()=>h.renderFrame(frame()),e=>e.code==='WEBGPU_RENDER_FAILED'&&e.cause===fault);assert.equal(h.getStatus().firstFailure.cause,fault);await f.close(h);
});

test('texture ownership precedes destroy getter reentrant close and cleanup runs exactly once',async()=>{
 const f=fixture(),h=f.host();await f.ready(h);let closing;f.hooks.createTexture=texture=>{const destroy=texture.destroy;Object.defineProperty(texture,'destroy',{get(){closing=h.close();return destroy;}});};
 assert.throws(()=>h.renderFrame(frame()),code('RENDER_FAILED'));assert.equal(f.textures[0].destroyed,0);assert.equal(h.getStatus().pendingFrames,1);await f.pump();await closing;assert.equal(f.textures[0].destroyed,1);assert.equal(h.close(),closing);assert.equal(f.calls.filter(c=>c[0]==='deviceDestroy').length,0);
});

test('uncapturable texture cleanup stays owned and makes close unsafe after scopes settle',async()=>{
 const f=fixture(),h=f.host(),fault={};await f.ready(h);let attempts=0;f.hooks.createTexture=texture=>Object.defineProperty(texture,'destroy',{get(){attempts++;throw fault;}});
 assert.throws(()=>h.renderFrame(frame()),e=>e.code==='WEBGPU_RENDER_FAILED'&&e.cause===fault);f.settleScopes();await tick();assert.equal(h.getStatus().pendingFrames,1);assert.equal(attempts,1);await f.close(h,true);assert.equal(h.getStatus().pendingFrames,0);assert.equal(attempts,1);assert.equal(f.calls.filter(c=>c[0]==='deviceDestroy').length,0);
});

for(const proof of ['fence','scope','map','range','loss'])test(`${proof} rejection quarantines image resources until close and never destroys borrowed device`,async()=>{
 const f=fixture(),h=f.host({enableReadback:true}),fault={};await f.ready(h);const ticket=h.requestReadback();h.renderFrame(frame());
 if(proof==='fence')f.fences[0].reject(fault);if(proof==='scope')f.pops[6].reject(fault);if(proof==='map')f.maps[0].reject(fault);if(proof==='range')f.hooks.mappedRange=()=>{throw fault;};if(proof==='loss')f.lost.resolve(fault);
 await f.pump();await assert.rejects(ticket);assert.equal(f.textures[0].destroyed,0);assert.equal(h.getStatus().pendingFrames,1);await f.close(h,true);assert.equal(f.textures[0].destroyed,1);assert.ok(f.buffers.every(b=>b.destroyed===1));assert.equal(h.getStatus().pendingFrames,0);assert.equal(f.calls.filter(c=>c[0]==='deviceDestroy').length,0);
});

test('fulfilled validation scopes allow safe retirement while independent cleanup failure keeps first rendering cause',async()=>{
 const f=fixture(),h=f.host(),first={},cleanup={};await f.ready(h);h.renderFrame(frame());f.pops[6].resolve(first);await f.pump();assert.equal(f.textures[0].destroyed,1);assert.equal(h.getStatus().firstFailure.code,'WEBGPU_VALIDATION');await f.close(h);
 const g=fixture(),k=g.host();await g.ready(k);g.hooks.finish=()=>{throw first;};g.hooks.destroyTexture=()=>{throw cleanup;};assert.throws(()=>k.renderFrame(frame([command(),command(1)],[image(),image()])),e=>e.cause===first);await g.pump();assert.ok(g.textures.every(t=>t.destroyed===1));assert.equal(k.getStatus().firstFailure.cause,first);const q=k.close();await g.pump();await assert.rejects(q,e=>e.code==='WEBGPU_CLOSE_UNSAFE'&&e.cause===cleanup);assert.ok(g.textures.every(t=>t.destroyed===1));
});

test('an unresolved queue proof keeps image cleanup and close pending without forced authority return',async()=>{
 const f=fixture(),h=f.host();await f.ready(h);h.renderFrame(frame());f.settleScopes();const p=h.close();let settled=false;p.finally(()=>{settled=true;}).catch(()=>{});await tick();assert.equal(settled,false);assert.equal(f.textures[0].destroyed,0);assert.equal(h.getStatus().pendingFrames,1);assert.equal(h.getStatus().cleanupOutcome,'pending');assert.equal(f.calls.filter(c=>c[0]==='deviceDestroy').length,0);
 f.fences[0].resolve();await f.pump();await p;assert.equal(f.textures[0].destroyed,1);
});

for(const unsafe of [false,true])test(`Engine timeout retains image surface authority until late ${unsafe?'rejected':'safe'} settlement`,async()=>{
 const f=fixture(),h=f.host();const starting=egret.createEngine({host:h,shutdownTimeoutMs:17});await f.pump();const engine=await starting;h.renderFrame(frame());f.settleScopes();
 const priorSet=globalThis.setTimeout,priorClear=globalThis.clearTimeout;let timeout;
 globalThis.setTimeout=(fn,ms)=>{assert.equal(ms,17);timeout=fn;return 1;};globalThis.clearTimeout=()=>{};
 try{const disposed=engine.dispose();await tick();assert.equal(typeof timeout,'function');timeout();await assert.rejects(disposed,e=>e.code==='ENGINE_CLOSE_TIMEOUT');await reserved(f.canvas);assert.equal(f.textures[0].destroyed,0);assert.equal(h.getStatus().pendingFrames,1);
  if(unsafe)f.fences[0].reject({});else f.fences[0].resolve();await f.pump();if(unsafe){await assert.rejects(h.close(),code('CLOSE_UNSAFE'));await reserved(f.canvas);}else{await h.close();const next=f.host();const creation=egret.createEngine({host:next,shutdownTimeoutMs:17});await f.pump();const second=await creation;const q=second.dispose();await f.pump();await q;}assert.equal(f.textures[0].destroyed,1);assert.equal(f.calls.filter(c=>c[0]==='deviceDestroy').length,0);
 }finally{globalThis.setTimeout=priorSet;globalThis.clearTimeout=priorClear;}
});

test('captured image frames survive lease release, Texture disposal and Engine shutdown before GPU retirement',async()=>{
 const f=fixture(),h=f.host();const creation=egret.createEngine({host:h});await f.pump();const engine=await creation;const texture=egret.createTexture(image(1,1,new Uint8Array([255,0,0,255])));
 const type=egret.createAssetType('webgpu-image-lifetime',egret.isTexture);engine.assets.register(type,{load:async()=>texture,dispose:value=>value.dispose()});const ref=egret.createAssetRef(type,'red');const lease=await engine.assets.acquire(ref);const bitmap=new egret.Bitmap(lease);engine.stage.addChild(bitmap);const saved=engine.captureFrame({width:8,height:8});h.renderFrame(saved);lease.release();engine.assets.invalidate(ref);
 assert.throws(()=>lease.value,e=>e.code==='ASSET_LEASE_RELEASED');let lateReads=0;for(const key of ['imageData','sourceRect'])Object.defineProperty(texture,key,{get(){lateReads++;throw Error('late runtime authority read');}});
 const disposed=engine.dispose();await tick();assert.equal(texture.isDisposed,true);assert.equal(f.textures[0].destroyed,0);const g=fixture(),other=g.host();await g.ready(other);other.renderFrame(saved);assert.deepEqual([...g.calls.find(c=>c[0]==='writeTexture')[2]],[255,0,0,255]);await g.close(other);await f.pump();await disposed;assert.equal(f.textures[0].destroyed,1);assert.equal(lateReads,0);
});

test('all image startup methods and limits are read once even for a rectangle-only host',async()=>{
 const f=fixture(),counts=new Map();
 for(const [object,key] of [[f.device,'createTexture'],[f.device,'createSampler'],[f.device,'createBindGroup'],[f.queue,'writeTexture'],[f.resolvedImage,'getBindGroupLayout'],...Object.keys(f.device.limits).map(key=>[f.device.limits,key])]){const value=object[key];Object.defineProperty(object,key,{get(){counts.set(key,(counts.get(key)??0)+1);return value;}});}
 Object.defineProperty(f.device,'destroy',{get(){throw Error('borrowed destroy read');}});
 const h=f.host();await f.ready(h);h.renderFrame(frame([rect()]));await f.close(h);assert.ok([...counts.values()].every(value=>value===1));assert.equal(counts.size,20);
});

for(const boundary of ['pipeline','sampler','layout'])test(`undefined image ${boundary} exception still records startup failure and drains peers`,async()=>{
 const f=fixture(),h=f.host();f.hooks[boundary]=kind=>{if(boundary!=='pipeline'||kind==='image')throw undefined;};const p=h.start();await f.pump();await assert.rejects(p,e=>e.code==='WEBGPU_START_FAILED'&&e.cause===undefined);assert.equal(h.getStatus().firstFailure.code,'WEBGPU_START_FAILED');assert.equal(f.open,0);await f.close(h);
});

test('image pipeline returned during reentrant close is observed before the cancellation gate',async()=>{
 const f=fixture(),original=f.device.createRenderPipelineAsync,h=f.host(),unhandled=[];let closing;
 const listener=fault=>unhandled.push(fault);process.on('unhandledRejection',listener);
 f.device.createRenderPipelineAsync=function(descriptor){const p=original.call(this,descriptor);if(descriptor.vertex.buffers[0].arrayStride===16)closing=h.close();return p;};
 try{const p=h.start();await tick();f.settleScopes();f.rectPipeline.resolve(f.resolvedRect);let settled=false;closing.then(()=>{settled=true;});await tick();assert.equal(settled,false);f.imagePipeline.reject({pipeline:true});await f.pump();await assert.rejects(p,code('START_CANCELLED'));await closing;assert.equal(f.calls.filter(c=>c[0]==='configure').length,0);assert.deepEqual(unhandled,[]);}finally{process.off('unhandledRejection',listener);}
});

test('layout getter reentrant close cancels before calling group0 or configuring the surface',async()=>{
 const f=fixture(),h=f.host();let closing,reads=0;Object.defineProperty(f.resolvedImage,'getBindGroupLayout',{get(){reads++;closing=h.close();return ()=>{throw Error('layout call after close');};}});const p=h.start();await f.pump();await assert.rejects(p,code('START_CANCELLED'));await closing;assert.equal(reads,1);assert.equal(f.calls.filter(c=>c[0]==='configure').length,0);assert.equal(h.getStatus().cleanupOutcome,'safe');
});

for(const allocation of ['crop','uniform'])test(`native ${allocation} allocation failure is reversible before serial, ticket and GPU mutation`,async()=>{
 const f=fixture(),h=f.host({enableReadback:true}),input=frame(),fault=new RangeError('native allocation');await f.ready(h);const ticket=h.requestReadback(),Bytes=globalThis.Uint8Array,Floats=globalThis.Float32Array;f.calls.length=0;
 try{if(allocation==='crop')globalThis.Uint8Array=class extends Bytes{constructor(...args){if(args[0]===4)throw fault;super(...args);}};else globalThis.Float32Array=class extends Floats{constructor(...args){if(Array.isArray(args[0]))throw fault;super(...args);}};
  assert.throws(()=>h.renderFrame(input),e=>e.code==='WEBGPU_FRAME_INVALID'&&e.cause===fault);assert.equal(h.getStatus().state,'active');assert.equal(h.getStatus().lastSerial,0);assert.deepEqual(mutations(f),[]);
 }finally{globalThis.Uint8Array=Bytes;globalThis.Float32Array=Floats;}
 h.renderFrame(input);await f.pump();assert.equal((await ticket).serial,1);await f.close(h);
});

test('out-of-order image settlements retire only their own textures and release exact pending uploads',async()=>{
 const f=fixture(),h=f.host({maxPendingFrames:3,maxPendingUploadBytes:224});await f.ready(h);h.renderFrame(frame([command(0,undefined,{alpha:.25})]));h.renderFrame(frame([command(0,undefined,{alpha:.75})]));
 assert.equal(h.getStatus().pendingUploadBytes,224);f.fences[1].resolve();f.pops.slice(9,12).forEach(p=>p.resolve(null));await tick();assert.deepEqual(f.textures.map(t=>t.destroyed),[0,1]);assert.equal(h.getStatus().pendingUploadBytes,112);h.renderFrame(frame());assert.deepEqual(f.textures.map(t=>t.destroyed),[0,1,0]);await f.pump();assert.deepEqual(f.textures.map(t=>t.destroyed),[1,1,1]);assert.equal(h.getStatus().pendingUploadBytes,0);await f.close(h);
});

for(const boundary of ['viewGetter','binding'])test(`${boundary} reentrant close retains already returned image ownership through settlement`,async()=>{
 const f=fixture(),h=f.host();await f.ready(h);let closing;
 if(boundary==='viewGetter')f.hooks.createTexture=texture=>Object.defineProperty(texture,'createView',{get(){closing=h.close();return ()=>{throw Error('view after close');};}});else f.hooks.bindGroup=()=>{closing=h.close();};
 assert.throws(()=>h.renderFrame(frame()),code('RENDER_FAILED'));assert.ok(closing);assert.equal(f.textures[0].destroyed,0);assert.equal(h.getStatus().pendingFrames,1);if(boundary==='binding')assert.equal(f.fences.length,1);else assert.equal(f.calls.filter(c=>c[0]==='imageView').length,0);await f.pump();await closing;assert.equal(f.textures[0].destroyed,1);assert.ok(f.buffers.every(b=>b.destroyed===1));
});

test('distinct crops from one source have separate tight textures and exclude adjacent texels',async()=>{
 const f=fixture(),h=f.host();await f.ready(h);const source=image(3,1,new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255]));h.renderFrame(frame([command(0,{x:0,y:0,width:2,height:1}),command(0,{x:1,y:0,width:2,height:1})],[source]));
 assert.equal(f.textures.length,2);const writes=f.calls.filter(c=>c[0]==='writeTexture');assert.deepEqual(writes.map(c=>[...c[2]]),[[255,0,0,255,0,255,0,255],[0,255,0,255,0,0,255,255]]);assert.ok(writes.every(c=>c[3].bytesPerRow===8&&c[4].width===2));await f.close(h);
});

// These constructors are the external fault boundary; the real host/helper still executes.
async function allocationWitness(route,fault,{buffer=268435456,upload=112,terminal,fill=false,ticket=true}={}){
 const f=fixture();f.device.limits.maxBufferSize=buffer;const h=f.host({maxUploadBytes:upload,enableReadback:ticket}),input=frame();await f.ready(h);const armed=ticket?h.requestReadback():undefined;f.calls.length=0;
 const Bytes=globalThis.Uint8Array,Floats=globalThis.Float32Array;let closing,attempts=0;
 const injected=()=>{attempts++;if(terminal==='stop')h.stop();if(terminal==='close')closing=h.close();throw fault;};
 try{try{
  if(route==='crop')globalThis.Uint8Array=class extends Bytes{constructor(...args){super(...args);if(args[0]===4){if(fill)return new Proxy(this,{set:injected});injected();}}};
  else globalThis.Float32Array=class extends Floats{constructor(...args){super(...args);if(route==='uniform'?Array.isArray(args[0]):args[0]===24){if(fill)return new Proxy(this,{set:injected});injected();}}};
  let observed;try{h.renderFrame(input);}catch(error){observed=error;}
  assert.ok(observed,'allocation fault must reject the frame');
  assert.equal(attempts,1);const status=h.getStatus();assert.equal(status.lastSerial,0);assert.equal(status.pendingFrames,0);assert.equal(status.pendingUploadBytes,0);assert.equal(status.pendingReadbackBytes,0);assert.equal(status.firstFailure,null);assert.deepEqual(f.calls,[]);assert.equal(f.textures.length,0);assert.equal(f.buffers.length,0);
  assert.equal(observed.code,terminal==='stop'?'WEBGPU_STOPPED':terminal==='close'?'WEBGPU_CLOSED':'WEBGPU_FRAME_INVALID');if(!terminal)assert.equal(observed.cause,fault,'preserve the exact thrown value, not its nested cause');
 }finally{globalThis.Uint8Array=Bytes;globalThis.Float32Array=Floats;}
  if(terminal){if(armed)await assert.rejects(armed,code(terminal==='stop'?'STOPPED':'CLOSED'));await f.pump();if(closing)await closing;else await f.close(h);}
  else{assert.equal(h.getStatus().state,'active');h.renderFrame(input);await f.pump();assert.equal(h.getStatus().lastSerial,1);if(armed)assert.equal((await armed).serial,1);await h.whenIdle();await f.close(h);}
 }finally{if(h.getStatus().state!=='closed')await f.close(h);}
}

for(const route of ['crop','uniform','pack'])for(const [name,makeFault] of [['geometry',()=>new GeometryPreparationError('budget')],['projection',()=>new ImageProjectionError('budget')],['frame-copy',()=>new FrameCopyError('budget')],['webgpu-packing',()=>new WebGPUPackingError('budget')]])test(`C1 ${route} constructor ${name} budget class retains FRAME_INVALID origin and armed ticket`,async()=>{
 const fault=makeFault();Object.defineProperty(fault,'cause',{value:{nested:true}});await allocationWitness(route,fault);
});

for(const [name,buffer] of [['strict-device',96],['cap-tie',112],['upload-controlled',268435456]])test(`C1 numeric packing ${name} allocation faults cannot claim trusted device or upload limits`,async()=>{
 // 96 vertex bytes plus a separate16-byte uniform fit these admitted devices/budgets.
 // A96/112-byte device cannot admit a256-byte readback row; ticket reuse is witnessed separately.
 await allocationWitness('pack',new GeometryPreparationError('budget'),{buffer,ticket:buffer>=256});
});

for(const route of ['crop','uniform','pack'])test(`C1 ${route} preserves arbitrary public, object, null and undefined allocation causes`,async()=>{
 for(const fault of [new egret.EgretError('WEBGPU_FRAME_BUDGET',{cause:{nested:true}}),{cause:new GeometryPreparationError('budget')},null,undefined])await allocationWitness(route,fault);
});

for(const route of ['crop','pack'])test(`C1 ${route} fill failure retains original helper-shaped cause after genuine admission`,async()=>{
 await allocationWitness(route,new GeometryPreparationError('budget'),{fill:true});
});

for(const route of ['crop','uniform','pack'])test(`C1 ${route} allocation termination retains outer stop and close precedence`,async()=>{
 for(const terminal of ['stop','close'])await allocationWitness(route,new GeometryPreparationError('budget'),{terminal});
});

test('C1 real numeric device and upload budget failures occur before replaceable allocation',async()=>{
 for(const [upload,buffer,want] of [[112,95,'DEVICE_LIMIT'],[95,95,'FRAME_BUDGET'],[95,96,'FRAME_BUDGET']]){
  const f=fixture();f.device.limits.maxBufferSize=buffer;const h=f.host({maxUploadBytes:upload}),input=frame();await f.ready(h);f.calls.length=0;const Floats=globalThis.Float32Array;let attempts=0;
  try{globalThis.Float32Array=class extends Floats{constructor(...args){attempts++;throw Error('allocation before budget admission');}};assert.throws(()=>h.renderFrame(input),code(want));assert.equal(attempts,0);assert.deepEqual(f.calls,[]);assert.equal(h.getStatus().lastSerial,0);assert.equal(h.getStatus().state,'active');}finally{globalThis.Float32Array=Floats;await f.close(h);}
 }
});


// I1 covers planner metadata, before serial/ticket/ledger/device mutation; C1 stays intact above.
function gpuPlannerOwnedFault(site,source,fault,body,onFault=()=>{}){
 const freeze=Object.freeze,set=Map.prototype.set,NativeMap=Map;let attempts=0;
 const injected=()=>{attempts++;onFault();throw fault;};
 try{if(site==='freeze')Object.freeze=value=>value?.image===source&&Object.hasOwn(value,'byteLength')?injected():freeze(value);
  else Map.prototype.set=function(key,value){if(key===source&&value instanceof NativeMap)return injected();return set.call(this,key,value);};
  body();assert.equal(attempts,1);
 }finally{Object.freeze=freeze;Map.prototype.set=set;}
}
const gpuPlannerCauses=()=>[new ImageProjectionError('budget'),new ImageProjectionError('invalid'),new GeometryPreparationError('budget'),new FrameCopyError('backing'),new WebGPUPackingError('device'),new egret.EgretError('WEBGPU_FRAME_BUDGET',{cause:{nested:true}}),{reason:'budget',cause:{nested:true}},null,undefined];
async function gpuPlannerWitness(site,cause,terminal){
 const f=fixture(),h=f.host({enableReadback:true}),source=image(),input=frame([command()],[source]);await f.ready(h);const ticket=h.requestReadback();f.calls.length=0;let closing;
 try{gpuPlannerOwnedFault(site,source,cause,()=>assert.throws(()=>h.renderFrame(input),e=>terminal?e.code===(terminal==='stop'?'WEBGPU_STOPPED':'WEBGPU_CLOSED'):e.code==='WEBGPU_FRAME_INVALID'&&e.cause===cause),()=>{if(terminal==='stop')h.stop();if(terminal==='close')closing=h.close();});
  const status=h.getStatus();assert.equal(status.lastSerial,0);assert.equal(status.pendingFrames,0);assert.equal(status.pendingUploadBytes,0);assert.equal(status.pendingReadbackBytes,0);assert.equal(status.firstFailure,null);assert.deepEqual(f.calls,[]);assert.equal(f.textures.length,0);assert.equal(f.buffers.length,0);
  if(terminal){await assert.rejects(ticket,code(terminal==='stop'?'STOPPED':'CLOSED'));await f.pump();if(closing)await closing;else await f.close(h);}
  else{assert.equal(status.state,'active');h.renderFrame(input);await f.pump();assert.equal((await ticket).serial,1);await h.whenIdle();await f.close(h);}
 }finally{if(h.getStatus().state!=='closed')await f.close(h);}
}
for(const site of ['freeze','map'])test('I1 WebGPU planner '+site+' cannot promote arbitrary helper/public/plain/null/undefined causes',async()=>{
 for(const cause of gpuPlannerCauses())await gpuPlannerWitness(site,cause);
});
test('I1 WebGPU planner an old genuine admission token has no later authority',async()=>{
 const {planImageProjections}=await import('../packages/engine/dist/web/imageProjections2D.js');const source=image(129,1);let token;
 try{planImageProjections(frame(Array.from({length:129},(_,x)=>command(0,{x,y:0,width:1,height:1})),[source]),'premultiplied');}catch(error){token=error;}
 assert.ok(token instanceof ImageProjectionError);assert.equal(token.reason,'budget');for(const site of ['freeze','map'])await gpuPlannerWitness(site,token);
});
for(const site of ['freeze','map'])test('I1 WebGPU planner '+site+' owned faults retain stop and close priority',async()=>{
 for(const terminal of ['stop','close'])await gpuPlannerWitness(site,new ImageProjectionError('budget'),terminal);
});
