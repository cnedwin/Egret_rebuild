import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {host} from './helpers.mjs';
import {copyMixedFrame2D} from '../packages/engine/dist/rendering/copyMixedFrame2D.js';
import {FrameCopyError,FrameInputReadError} from '../packages/engine/dist/rendering/copyFrame2D.js';
import {prepareRectangles2D,GeometryPreparationError} from '../packages/engine/dist/rendering/prepareRectangles2D.js';
import {packWebGPUVertices} from '../packages/engine/dist/web/webgpuPass.js';
let prepareImage2D,packImageVertices2D,fault;
try{({prepareImage2D}=await import('../packages/engine/dist/rendering/prepareImages2D.js'));({packImageVertices2D}=await import('../packages/engine/dist/rendering/packImageVertices2D.js'));}catch(e){fault=e;}
const copyOpts={pixelRatio:1,maxBackingPixels:16777216,maxCommands:65536,maxClipRectangles:262144};
const literal=[255,0,0,255];
// Test-owned dispatcher; remaining budgets span painter-ordered one-command preparation.
function pipeline(frame,maxPreparedVertices=24,maxClipEdgeTests=1000){
 const c=copyMixedFrame2D(frame,copyOpts),records=[];let vertices=0,edges=0;
 for(const command of c.frame.commands){const options={pixelRatio:1,maxPreparedVertices:maxPreparedVertices-vertices,maxClipEdgeTests:maxClipEdgeTests-edges};
  if(command.kind==='rect'){const p=prepareRectangles2D({...c.frame,commands:[command]},c.width,c.height,options),packed=packWebGPUVertices(p,c.width,c.height,{maxUploadBytes:144,maxBufferSize:144});edges+=p.edgeTests;vertices+=p.commands.reduce((n,c)=>n+(c.pointIndices.length-2)*3,0);records.push({kind:'rect',color:command.color,data:Array.from(packed.data)});}
  else{const p=prepareImage2D(command,c.width,c.height,options),packed=packImageVertices2D(p,c.width,c.height,96);edges+=p.edgeTests;vertices+=p.pointIndices.length?(p.pointIndices.length-2)*3:0;records.push({kind:'image',index:command.imageIndex,alpha:p.alpha,points:p.points.map(p=>[p.x,p.y,p.u,p.v]),data:Array.from(packed.data),bytes:Array.from(egret.copyImageData2DPixels(c.frame.images[p.imageIndex]))});}
 }return {records,vertices,edges};
}
test('saved mixed capture survives lease invalidation shutdown with frozen nested clips and CPU replay',async()=>{
 assert.equal(typeof prepareImage2D,'function',`missing image port: ${fault}`);
 const e=await egret.createEngine({host:host().adapter}),value=egret.createImageData2D({width:1,height:1,pixels:new Uint8Array(literal)}),texture=egret.createTexture(value),type=egret.createAssetType('a1-integration',egret.isTexture);
 e.assets.register(type,{load:async()=>texture,dispose:t=>t.dispose()});const ref=egret.createAssetRef(type,'literal'),lease=await e.assets.acquire(ref);
 const rect=()=>{const s=new egret.Sprite();s.graphics.beginFill(0xff0000).drawRect(0,0,1,1);e.stage.addChild(s);};
 const image=()=>{const parent=e.stage.addChild(new egret.Sprite());parent.clipRect={x:0,y:0,width:1,height:1};const nested=parent.addChild(new egret.Sprite());nested.clipRect={x:0,y:0,width:1,height:1};nested.addChild(new egret.Bitmap(lease));};
 rect();image();rect();image();const saved=e.captureFrame({width:4,height:4});assert.deepEqual(saved.commands.map(c=>c.kind),['rect','image','rect','image']);assert.deepEqual(saved.commands.filter(c=>c.kind==='image').map(c=>c.imageIndex),[0,0]);
 for(const command of saved.commands.filter(c=>c.kind==='image')){assert.equal(command.clips.length,2);for(const clip of command.clips)for(const part of [clip,clip.matrix,clip.rect])assert.ok(Object.isFrozen(part));}
 lease.release();e.assets.invalidate(ref);await e.dispose();
 // Rectangle: 9+48=57 tests; nested image: 5+18+96=119; two of each total352.
 const result=pipeline(saved);assert.equal(result.vertices,24);assert.equal(result.edges,352);assert.deepEqual(result.records.map(r=>r.kind),['rect','image','rect','image']);
 for(const record of result.records.filter(r=>r.kind==='image')){assert.deepEqual(record.bytes,literal);assert.deepEqual(record.points,[[0,0,0,0],[1,0,1,0],[1,1,1,1],[0,1,0,1]]);assert.deepEqual(record.data,[-1,1,0,0,-.5,1,1,0,-.5,.5,1,1,-1,1,0,0,-.5,.5,1,1,-1,.5,0,1]);assert.equal(record.alpha,1);assert.equal(record.index,0);}
 assert.throws(()=>pipeline(saved,23),e=>e instanceof GeometryPreparationError&&e.reason==='budget');assert.throws(()=>pipeline(saved,24,351),e=>e instanceof GeometryPreparationError&&e.reason==='budget');
 const records=[],adapter=host({renderFrame(frame){records.push(pipeline(frame));}}).adapter,second=await egret.createEngine({host:adapter});adapter.renderFrame(saved);assert.deepEqual(records,[result]);await second.dispose();assert.deepEqual(Array.from(egret.copyImageData2DPixels(saved.images[0])),literal);
});
test('table index-only internal-looking fault retains exact sentinel cause',()=>{
 const sentinel=new FrameCopyError('budget'),value=egret.createImageData2D({width:1,height:1,pixels:new Uint8Array(literal)}),reads=[];
 const table=new Proxy([value],{get(t,k,r){reads.push(String(k));if(k==='0')throw sentinel;return Reflect.get(t,k,r);}});
 const command={kind:'image',matrix:{a:1,b:0,c:0,d:1,tx:0,ty:0},rect:{x:0,y:0,width:1,height:1},alpha:1,clips:[],imageIndex:0,sourceRect:{x:0,y:0,width:1,height:1}};
 assert.throws(()=>copyMixedFrame2D({frameId:1,width:4,height:4,clearColor:0,clearAlpha:0,commands:[command],images:table},copyOpts),e=>e instanceof FrameInputReadError&&e.cause===sentinel);assert.deepEqual(reads,['length','0']);
});
