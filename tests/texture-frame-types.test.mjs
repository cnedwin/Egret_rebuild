import test from 'node:test';
import assert from 'node:assert/strict';
import * as contracts from '../packages/contracts/dist/index.js';
import * as engine from '@egret/engine';
import {createCanvasHost} from '@egret/engine/web';
import {copyCanvasFrame} from '../packages/engine/dist/web/copyCanvasFrame.js';
const frame=()=>({frameId:1,width:4,height:4,clearColor:0,clearAlpha:0,commands:[{kind:'rect',matrix:{a:1,b:0,c:0,d:1,tx:0,ty:0},rect:{x:0,y:0,width:2,height:2},color:0xff0000,alpha:1,clips:[]}]});

test('engine re-exports authenticated contracts values with the same module identity',()=>{
  for(const key of ['IMAGE_LIMITS_2D','createImageData2D','isImageData2D','copyImageData2DPixels']){assert.notEqual(contracts[key],undefined,`Missing image export: ${key}`);assert.equal(engine[key],contracts[key]);}
  const image=engine.createImageData2D({width:1,height:1,pixels:new Uint8Array([7,128,254,255])});assert.equal(contracts.isImageData2D(image),true);assert.deepEqual([...engine.copyImageData2DPixels(image)],[7,128,254,255]);
});

test('the Canvas rectangle copier ignores a throwing images getter',()=>{
  let reads=0;const value=frame();Object.defineProperty(value,'images',{get(){reads++;throw Error('images');}});
  const canvas=copyCanvasFrame(value,1,16);
  assert.equal(reads,0);assert.deepEqual(canvas.frame.commands,frame().commands);assert.equal(Object.hasOwn(canvas.frame,'images'),false);
});

test('production Canvas reads an invalid image table once before resize or drawing',async()=>{
  const calls=[];const context=new Proxy({isContextLost:()=>false},{get(target,key){return key in target?target[key]:(...args)=>calls.push([key,...args]);},set(target,key,value){calls.push([key,value]);target[key]=value;return true;}});
  const canvas={getContext:()=>context,set width(value){calls.push(['width',value]);},set height(value){calls.push(['height',value]);}};
  const host=createCanvasHost({canvas});host.start();const value=frame();value.commands=[{kind:'image'}];let reads=0;Object.defineProperty(value,'images',{get(){reads++;throw Error('images');}});
  assert.throws(()=>host.renderFrame(value),e=>e.code==='CANVAS_FRAME_INVALID');assert.equal(reads,1);assert.deepEqual(calls,[]);await host.close();
});
