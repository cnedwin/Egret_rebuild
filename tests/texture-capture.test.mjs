import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import * as runtime from '../packages/runtime/dist/index.js';
import {visualOf} from '../packages/runtime/dist/displayVisualState.js';
import {host} from './helpers.mjs';
import {captureDrawn,drawnFrame} from './helpers/drawn-frame.mjs';

const options={width:10,height:10};
const literal=[255,0,1,0,7,128,254,255];
const image=(width=2,height=1)=>egret.createImageData2D({width,height,pixels:width===2&&height===1?new Uint8Array(literal):new Uint8Array(width*height*4)});
const pixels=value=>Array.from(egret.copyImageData2DPixels(value));
const code=(run,want)=>assert.throws(run,{code:want});
let id=0;
async function borrow(engine,texture,dispose=value=>value.dispose()) {
  const type=egret.createAssetType('capture-texture',egret.isTexture);
  engine.assets.register(type,{load:async()=>texture,dispose});
  const ref=egret.createAssetRef(type,`capture-${++id}`);
  return {ref,lease:await engine.assets.acquire(ref)};
}
async function add(engine,value=image(),region) {
  const texture=egret.createTexture(value,region);
  const {ref,lease}=await borrow(engine,texture);
  const bitmap=new egret.Bitmap(lease);engine.stage.addChild(bitmap);
  return {texture,ref,lease,bitmap};
}
const makeEngine=()=>egret.createEngine({host:host().adapter});

// Catch omitted images, reordered painters and identity deduplication by payload.
test('mixed painter capture uses literal order and first-emission identity indices',async()=>{
  const e=await makeEngine();const rect=new egret.Sprite();rect.graphics.beginFill(9).drawRect(0,0,1,1);e.stage.addChild(rect);
  const a=image(),b=image();await add(e,a);await add(e,b);await add(e,a,{x:1,y:0,width:1,height:1});
  const frame=captureDrawn(e, options);
  assert.deepEqual(frame.commands.map(c=>c.kind),['rect','image','image','image']);
  assert.deepEqual(frame.commands.slice(1).map(c=>c.imageIndex),[0,1,0]);
  assert.deepEqual(frame.images,[a,b]);
  assert.deepEqual(frame.commands[3].rect,{x:0,y:0,width:1,height:1});
  assert.deepEqual(frame.commands[3].sourceRect,{x:1,y:0,width:1,height:1});
  for(const value of [frame,frame.commands,frame.images,...frame.images,...frame.commands,...frame.commands.flatMap(c=>[c.matrix,c.rect,c.clips,...c.clips,c.sourceRect].filter(Boolean))])assert.ok(Object.isFrozen(value));
  await e.dispose();
});

test('saved pixels and metadata survive mutation release invalidation disposal and cross-host replay',async()=>{
  const input=new Uint8Array(literal),region={x:0,y:0,width:2,height:1};
  const owned=egret.createImageData2D({width:2,height:1,pixels:input});const e=await makeEngine();
  const rectangle=new egret.Sprite();rectangle.graphics.beginFill(3).drawRect(0,0,1,1);e.stage.addChild(rectangle);
  const item=await add(e,owned,region);region.width=1;input.fill(99);
  e.stage.addChild(new egret.Bitmap(item.lease));
  const saved=captureDrawn(e, options);assert.ok(Array.isArray(saved.images),'captured image table required');assert.deepEqual(pixels(saved.images[0]),literal);
  item.lease.release();code(()=>captureDrawn(e, options),'ASSET_LEASE_RELEASED');
  e.assets.invalidate(item.ref);item.texture.dispose();await e.dispose();
  const records=[];
  // Replay is submission of the immutable saved value, with no live resolution.
  const adapter=host({sharedFrameProfile:egret.SHARED_FRAME_PROFILE_2D,renderSharedFrame(frame){const drawn=drawnFrame(frame);records.push({kinds:drawn.commands.map(c=>c.kind),bytes:drawn.images.map(pixels),regions:drawn.commands.map(c=>c.sourceRect)});}}).adapter;
  const second=await egret.createEngineForProfile({host:adapter},egret.SHARED_FRAME_PROFILE_2D);
  adapter.renderSharedFrame(saved.frame);
  assert.deepEqual(records,[{kinds:['rect','image','image'],bytes:[literal],regions:[undefined,{x:0,y:0,width:2,height:1},{x:0,y:0,width:2,height:1}]}]);
  await second.dispose();assert.deepEqual(pixels(saved.images[0]),literal);
});

test('release revokes only the exact borrow while a shared active lease still captures',async()=>{
  const e=await makeEngine(),texture=egret.createTexture(image());const {ref,lease:a}=await borrow(e,texture);const b=await e.assets.acquire(ref);
  const first=new egret.Bitmap(a),second=new egret.Bitmap(b);e.stage.addChild(first);e.stage.addChild(second);
  const saved=captureDrawn(e, options);a.release();code(()=>captureDrawn(e, options),'ASSET_LEASE_RELEASED');
  first.visible=false;assert.equal(captureDrawn(e, options).commands.length,1);assert.deepEqual(pixels(saved.images[0]),literal);
  b.release();code(()=>captureDrawn(e, options),'ASSET_LEASE_RELEASED');await e.dispose();
});

test('suppressed branches and cleared slots never consult released entitlement',async()=>{
  for(const suppress of [b=>{b.visible=false;},b=>{b.alpha=0;},b=>{b.clipRect={x:0,y:0,width:0,height:1};},b=>{b.textureLease=undefined;}]){
    const e=await makeEngine();const {bitmap,lease}=await add(e);lease.release();suppress(bitmap);
    const f=captureDrawn(e, options);assert.deepEqual(f.commands,[]);assert.deepEqual(f.images,[]);await e.dispose();
  }
  const e=await makeEngine(),parent=new egret.Sprite();parent.clipRect={x:0,y:0,width:1,height:0};e.stage.addChild(parent);
  const {bitmap,lease}=await add(e);parent.addChild(bitmap);lease.release();assert.equal(captureDrawn(e, options).commands.length,0);await e.dispose();
});

test('singular image transforms remain captured for subsequent preparation',async()=>{
  const e=await makeEngine();const {bitmap}=await add(e);bitmap.scaleX=0;
  const f=captureDrawn(e, options);assert.equal(f.commands.length,1);assert.equal(f.commands[0].kind,'image');assert.equal(f.commands[0].matrix.a,0);assert.equal(f.images.length,1);await e.dispose();
});

test('new Stage authentication rejects proxies and lookalikes without public reads',async()=>{
  assert.equal(typeof runtime.collectSharedFrameContent,'function');const e=await makeEngine();let reads=0;
  for(const value of [null,undefined,1,{},new egret.Sprite(),new Proxy(e.stage,{get(){reads++;throw Error('unread');}})])code(()=>runtime.collectSharedFrameContent(value),'FRAME_STAGE_INVALID');
  assert.equal(reads,0);assert.equal(Object.isFrozen(runtime.collectSharedFrameContent(e.stage)),true);
  assert.equal('collectSharedFrameContent' in egret,false);await e.dispose();code(()=>runtime.collectSharedFrameContent(e.stage),'ENGINE_CLOSED');
});

test('new collector checks Engine open again after private traversal',async()=>{
  assert.equal(typeof runtime.collectSharedFrameContent,'function');const e=await makeEngine();let closing;
  Object.defineProperty(visualOf(e.stage),'visible',{get(){closing=e.dispose();return true;}});
  code(()=>runtime.collectSharedFrameContent(e.stage),'ENGINE_CLOSED');await closing;
});

test('closed Stage rejects before visiting any actual private visual record',async()=>{
  const e=await makeEngine();await e.dispose();let reads=0;
  Object.defineProperty(visualOf(e.stage),'visible',{get(){reads++;throw Error('unread');}});
  code(()=>runtime.collectSharedFrameContent(e.stage),'ENGINE_CLOSED');assert.equal(reads,0);
});

test('capture ignores public Bitmap Texture and lease getters in favor of private authority',async()=>{
  const e=await makeEngine();const {bitmap,texture}=await add(e);
  for(const key of ['textureLease','naturalWidth','naturalHeight','visible','x'])Object.defineProperty(bitmap,key,{get(){throw Error('public Bitmap getter');}});
  for(const key of ['imageData','sourceRect','width','height','isDisposed'])Object.defineProperty(texture,key,{get(){throw Error('public Texture getter');}});
  const prior=Object.getOwnPropertyDescriptor(egret.AssetLease.prototype,'value');
  Object.defineProperty(egret.AssetLease.prototype,'value',{get(){throw Error('public lease getter');},configurable:true});
  try{const f=captureDrawn(e, options);assert.deepEqual(pixels(f.images[0]),literal);assert.deepEqual(f.commands[0].rect,{x:0,y:0,width:2,height:1});}
  finally{Object.defineProperty(egret.AssetLease.prototype,'value',prior);await e.dispose();}
});

test('earlier painter geometry errors win over later lease errors and budgets',async()=>{
  const e=await makeEngine(),rect=new egret.Sprite();rect.scaleX=Number.MAX_VALUE;rect.graphics.beginFill(1).drawRect(0,0,2,1);e.stage.addChild(rect);
  const {lease,bitmap}=await add(e);lease.release();code(()=>captureDrawn(e, options),'FRAME_TRANSFORM_INVALID');
  rect.visible=false;code(()=>captureDrawn(e, options),'ASSET_LEASE_RELEASED');bitmap.visible=false;
  for(let i=0;i<65;i++)await add(e,image(1,1));code(()=>captureDrawn(e, options),'FRAME_IMAGE_BUDGET');await e.dispose();
});

test('single shared traversal reads each actual private visible record once',async()=>{
  const e=await makeEngine(),p=new egret.Sprite(),rect=new egret.Sprite();rect.graphics.beginFill(1).drawRect(0,0,1,1);e.stage.addChild(p);p.addChild(rect);
  const {bitmap}=await add(e);p.addChild(bitmap);const counts=[0,0,0,0];
  [e.stage,p,rect,bitmap].forEach((node,i)=>Object.defineProperty(visualOf(node),'visible',{get(){counts[i]++;return true;}}));
  assert.deepEqual(captureDrawn(e, options).commands.map(c=>c.kind),['rect','image']);assert.deepEqual(counts,[1,1,1,1]);await e.dispose();
});
