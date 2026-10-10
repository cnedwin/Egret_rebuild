import test from 'node:test';
import assert from 'node:assert/strict';
import * as contracts from '../packages/contracts/dist/index.js';
import * as engine from '@egret/engine';
import {createCanvasHost} from '@egret/engine/web';
import {createWebGPUHost} from '@egret/engine/webgpu';
import {copyFrame2D} from '../packages/engine/dist/rendering/copyFrame2D.js';
import {copyCanvasFrame} from '../packages/engine/dist/web/copyCanvasFrame.js';
const frame=()=>({frameId:1,width:4,height:4,clearColor:0,clearAlpha:0,commands:[{kind:'rect',matrix:{a:1,b:0,c:0,d:1,tx:0,ty:0},rect:{x:0,y:0,width:2,height:2},color:0xff0000,alpha:1,clips:[]}]});

test('engine re-exports authenticated contracts values with the same module identity',()=>{
  for(const key of ['IMAGE_LIMITS_2D','createImageData2D','isImageData2D','copyImageData2DPixels']){assert.notEqual(contracts[key],undefined,`Missing image export: ${key}`);assert.equal(engine[key],contracts[key]);}
  const image=engine.createImageData2D({width:1,height:1,pixels:new Uint8Array([7,128,254,255])});assert.equal(contracts.isImageData2D(image),true);assert.deepEqual([...engine.copyImageData2DPixels(image)],[7,128,254,255]);
});

test('both original rectangle copiers ignore throwing images getters',()=>{
  let reads=0;const value=frame();Object.defineProperty(value,'images',{get(){reads++;throw Error('images');}});
  const gpu=copyFrame2D(value,{pixelRatio:1,maxBackingPixels:16,maxCommands:1,maxClipRectangles:1});const canvas=copyCanvasFrame(value,1,16);
  assert.equal(reads,0);assert.deepEqual(gpu.frame.commands,frame().commands);assert.deepEqual(canvas.frame.commands,frame().commands);assert.equal(Object.hasOwn(gpu.frame,'images'),false);assert.equal(Object.hasOwn(canvas.frame,'images'),false);
});

test('production Canvas reads an invalid image table once before resize or drawing',async()=>{
  const calls=[];const context=new Proxy({isContextLost:()=>false},{get(target,key){return key in target?target[key]:(...args)=>calls.push([key,...args]);},set(target,key,value){calls.push([key,value]);target[key]=value;return true;}});
  const canvas={getContext:()=>context,set width(value){calls.push(['width',value]);},set height(value){calls.push(['height',value]);}};
  const host=createCanvasHost({canvas});host.start();const value=frame();value.commands=[{kind:'image'}];let reads=0;Object.defineProperty(value,'images',{get(){reads++;throw Error('images');}});
  assert.throws(()=>host.renderFrame(value),e=>e.code==='CANVAS_FRAME_INVALID');assert.equal(reads,1);assert.deepEqual(calls,[]);await host.close();
});

test('production WebGPU reads an invalid image table once before resize, draw or queue work',async()=>{
  const calls=[],scopes=[];const lost=new Promise(()=>{});
  const queue={writeTexture(){calls.push('writeTexture');},writeBuffer(){calls.push('write');},submit(){calls.push('submit');},onSubmittedWorkDone(){calls.push('fence');return Promise.resolve();}};
  const device={queue,lost,limits:{maxTextureDimension2D:8192,maxBufferSize:268435456,maxVertexBuffers:1,maxVertexAttributes:2,maxVertexBufferArrayStride:24,maxColorAttachments:1,maxColorAttachmentBytesPerSample:4,maxBindGroups:1,maxBindingsPerBindGroup:3,maxSampledTexturesPerShaderStage:1,maxSamplersPerShaderStage:1,maxUniformBuffersPerShaderStage:1,maxUniformBufferBindingSize:16,maxBindGroupsPlusVertexBuffers:2,maxInterStageShaderVariables:1},addEventListener(){},removeEventListener(){},pushErrorScope(){},popErrorScope(){return Promise.resolve(null);},createShaderModule(){return {};},createRenderPipelineAsync(){return Promise.resolve({getBindGroupLayout(){return {};}});},createSampler(){return {};},createTexture(){calls.push('imageTexture');throw Error('unexpected image texture');},createBindGroup(){calls.push('bindGroup');throw Error('unexpected binding');},createBuffer(){calls.push('buffer');throw Error('unexpected buffer');},createCommandEncoder(){calls.push('encoder');throw Error('unexpected draw');}};
  const context={configure(){},unconfigure(){},getCurrentTexture(){calls.push('texture');throw Error('unexpected target');}};
  let width=4,height=4;const canvas={getContext:()=>context,get width(){return width;},get height(){return height;},set width(value){width=value;calls.push('width');},set height(value){height=value;calls.push('height');}};
  const prior=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{getPreferredCanvasFormat:()=> 'rgba8unorm'}}});
  try{const host=createWebGPUHost({canvas,device:{kind:'borrow',device}});await host.start();const value=frame();value.width=8;value.commands=[{kind:'image'}];let reads=0;Object.defineProperty(value,'images',{get(){reads++;throw Error('images');}});
    assert.throws(()=>host.renderFrame(value),e=>e.code==='WEBGPU_FRAME_INVALID');assert.equal(reads,1);assert.deepEqual(calls,[]);assert.equal(host.getStatus().lastSerial,0);await host.close();
  }finally{if(prior)Object.defineProperty(globalThis,'navigator',prior);else delete globalThis.navigator;}
});
