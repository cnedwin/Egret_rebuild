import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import * as runtime from '../packages/runtime/dist/index.js';

const image = () => egret.createImageData2D({width:2,height:1,pixels:new Uint8Array([255,0,0,255,0,255,0,128])});
const texture = () => { assert.equal(typeof egret.createTexture,'function'); return egret.createTexture(image()); };
const code = (run,want) => assert.throws(run,{code:want});
async function ports() {
  assert.equal(typeof egret.Bitmap,'function');
  return {...await import('../packages/runtime/dist/Bitmap.js'),...await import('../packages/runtime/dist/Texture.js'),...await import('../packages/runtime/dist/AssetLease.js'),...await import('../packages/runtime/dist/ownership.js')};
}
async function engine() {
  return egret.createEngine({host:{surface:{},close:async()=>{},stop(){},setTimeout(fn,ms){const id=setTimeout(fn,ms);return()=>clearTimeout(id);}}});
}
let assetId=0;
async function acquire(engine,value,dispose=()=>{}) {
  const type=egret.createAssetType('texture',()=>true);
  engine.assets.register(type,{load:async()=>value,dispose});
  const ref=egret.createAssetRef(type,`texture-${++assetId}`);
  return {ref,lease:await engine.assets.acquire(ref)};
}

// These fixtures catch public-getter authority, early slot commits and lease adoption.
test('Texture copies and freezes the full or explicit region, normalizing coordinate zero',()=>{
  const full=texture();
  assert.deepEqual(full.sourceRect,{x:0,y:0,width:2,height:1});
  const input={x:-0,y:-0,width:1,height:1};
  const crop=egret.createTexture(image(),input); input.width=2;
  assert.deepEqual(crop.sourceRect,{x:0,y:0,width:1,height:1});
  assert.ok(Object.isFrozen(crop.sourceRect));
  assert.equal(Object.is(crop.sourceRect.x,-0),false);
  assert.equal(Object.is(crop.sourceRect.y,-0),false);
  assert.equal(crop.width,1);assert.equal(crop.height,1);
});
test('Texture image brand precedes region reads and getter causes retain identity',()=>{
  texture();let reads=0;
  assert.throws(()=>egret.createTexture({}, {get x(){reads++;throw Error('unread');}}),error=>error.code==='TEXTURE_IMAGE_INVALID'&&error.cause instanceof TypeError);
  assert.equal(reads,0);
  const sentinel={sentinel:true},trace=[];
  const bad={get x(){trace.push('x');return -1;},get y(){trace.push('y');return 0;},get width(){trace.push('width');return 1;},get height(){trace.push('height');throw sentinel;}};
  assert.throws(()=>egret.createTexture(image(),bad),error=>error.code==='TEXTURE_REGION_INVALID'&&error.cause===sentinel);
  assert.deepEqual(trace,['x','y','width','height']);
});
test('Texture snapshots each known field once and rejects invalid region shapes/ranges',()=>{
  texture();const reads=[];
  const region=Object.fromEntries(['x','y','width','height'].map((key)=>[key,{get(){reads.push(key);return {x:0,y:0,width:2,height:1}[key];}}]));
  const input=Object.defineProperties({},region);
  assert.deepEqual(egret.createTexture(image(),input).sourceRect,{x:0,y:0,width:2,height:1});
  assert.deepEqual(reads,['x','y','width','height']);
  for(const invalid of [null,1,()=>{}, {x:0.5,y:0,width:1,height:1},{x:0,y:0,width:-0,height:1},{x:Number.MAX_SAFE_INTEGER,y:0,width:1,height:1},{x:1,y:0,width:2,height:1},{x:0,y:1,width:1,height:1},{x:0,y:0,width:1,height:Infinity}])code(()=>egret.createTexture(image(),invalid),'TEXTURE_REGION_INVALID');
});
test('Texture factory and receiver brands survive terminal disposal without retaining image access',async()=>{
  const value=texture(),p=await ports();
  code(()=>new egret.Texture(),'TEXTURE_FACTORY_REQUIRED');
  assert.equal(egret.isTexture(value),true);
  let reads=0;const forged=new Proxy(value,{get(){reads++;throw Error('unread');}});
  assert.equal(egret.isTexture(forged),false);assert.equal(egret.isTexture({}),false);assert.equal(reads,0);
  for(const name of ['imageData','sourceRect','width','height','isDisposed']){
    const get=Object.getOwnPropertyDescriptor(egret.Texture.prototype,name).get;
    for(const receiver of [{},null,forged])code(()=>get.call(receiver),'TEXTURE_INVALID');
  }
  code(()=>egret.Texture.prototype.dispose.call({}),'TEXTURE_INVALID');
  const source=value.sourceRect;assert.ok(Object.isFrozen(p.readTextureSnapshot(value)));
  value.dispose();value.dispose();assert.equal(egret.isTexture(value),true);assert.equal(value.isDisposed,true);
  assert.equal(value.width,2);assert.equal(value.height,1);assert.equal(value.sourceRect,source);
  code(()=>value.imageData,'TEXTURE_DISPOSED');code(()=>p.readTextureSnapshot(value),'TEXTURE_DISPOSED');
});
test('two leases of one Texture remain independently entitled and provider cleanup occurs only at last release',async()=>{
  const value=texture(),p=await ports(),e=await engine();let disposals=0;
  const {ref,lease:a}=await acquire(e,value,t=>{disposals++;t.dispose();});const b=await e.assets.acquire(ref);
  const first=new egret.Bitmap(a),second=new egret.Bitmap(b);
  assert.equal(first.textureLease,a);assert.equal(second.textureLease,b);
  assert.deepEqual([first.naturalWidth,first.naturalHeight],[2,1]);
  const state=p.bitmapCaptureState(first);assert.ok(Object.isFrozen(state));assert.equal(state.lease,a);
  assert.deepEqual([state.width,state.height],[2,1]);
  a.release();code(()=>p.readBitmapImage(a),'ASSET_LEASE_RELEASED');
  assert.equal(p.readBitmapImage(b).image,value.imageData);assert.equal(disposals,0);
  assert.equal(first.textureLease,a);assert.deepEqual([first.naturalWidth,first.naturalHeight],[2,1]);
  e.stage.addChild(first);assert.equal(first.parent,e.stage);
  first.dispose();assert.equal(disposals,0);assert.equal(p.readBitmapImage(b).image,value.imageData);
  b.release();assert.equal(disposals,1);code(()=>p.readBitmapImage(b),'ASSET_LEASE_RELEASED');
  assert.deepEqual([second.naturalWidth,second.naturalHeight],[2,1]);await e.dispose();
});
test('Bitmap constructors authenticate exact leases and values before checking Engine closure',async()=>{
  texture();const p=await ports(),e=await engine();const value=texture();const {lease}=await acquire(e,value);
  let reads=0;const proxy=new Proxy(lease,{get(){reads++;throw Error('unread');}});
  for(const invalid of [undefined,{},value,proxy]){code(()=>new egret.Bitmap(invalid),'BITMAP_LEASE_INVALID');code(()=>p.readBitmapImage(invalid),'BITMAP_LEASE_INVALID');}
  assert.equal(reads,0);
  const {lease:wrong}=await acquire(e,{});code(()=>new egret.Bitmap(wrong),'BITMAP_TEXTURE_INVALID');
  value.dispose();code(()=>new egret.Bitmap(lease),'TEXTURE_DISPOSED');
  await e.dispose();code(()=>new egret.Bitmap(lease),'ASSET_LEASE_RELEASED');
  // A real manager with a closed originating context isolates constructor priority.
  let closed=false;const context={assertOpen(){if(closed)throw new egret.EgretError('ENGINE_CLOSED');},report(){},captureCleanup(){}};
  const manager=runtime.createAssetManager(context);const valid=texture();const type=egret.createAssetType('permissive',()=>true);
  manager.register(type,{load:async(ref)=>ref.id==='good'?valid:{},dispose(){}});
  const good=await manager.acquire(egret.createAssetRef(type,'good'));const bad=await manager.acquire(egret.createAssetRef(type,'bad'));
  closed=true;code(()=>new egret.Bitmap(bad),'BITMAP_TEXTURE_INVALID');code(()=>new egret.Bitmap(good),'ENGINE_CLOSED');
  valid.dispose();code(()=>new egret.Bitmap(good),'TEXTURE_DISPOSED');manager.dispose();
});
test('Bitmap setter preserves slot and sizes on every failed validation, and clear preserves affinity',async()=>{
  const value=texture(),p=await ports(),a=await engine(),b=await engine();
  const {lease}=await acquire(a,value);const node=new egret.Bitmap(lease);
  const {lease:foreign}=await acquire(b,texture());foreign.release();
  const {lease:wrong}=await acquire(a,{});const dead=texture();dead.dispose();const {lease:disposed}=await acquire(a,dead);
  const {lease:released}=await acquire(a,texture());released.release();
  for(const [invalid,want] of [[{},'BITMAP_LEASE_INVALID'],[foreign,'ENGINE_MISMATCH'],[wrong,'BITMAP_TEXTURE_INVALID'],[disposed,'TEXTURE_DISPOSED'],[released,'ASSET_LEASE_RELEASED']]){
    code(()=>{node.textureLease=invalid;},want);assert.equal(node.textureLease,lease);assert.deepEqual([node.naturalWidth,node.naturalHeight],[2,1]);
  }
  const small=egret.createTexture(image(),{x:1,y:0,width:1,height:1});const {lease:replacement}=await acquire(a,small);
  node.textureLease=replacement;assert.equal(node.textureLease,replacement);assert.deepEqual([node.naturalWidth,node.naturalHeight],[1,1]);
  small.dispose();assert.deepEqual([node.naturalWidth,node.naturalHeight],[1,1]);code(()=>p.readBitmapImage(replacement),'TEXTURE_DISPOSED');
  node.textureLease=undefined;assert.equal(node.textureLease,undefined);assert.deepEqual([node.naturalWidth,node.naturalHeight],[0,0]);
  assert.equal(p.engineOf(node),p.engineOf(lease));assert.equal(p.bitmapCaptureState(node),undefined);
  code(()=>{node.textureLease=foreign;},'ENGINE_MISMATCH');code(()=>b.stage.addChild(node),'ENGINE_MISMATCH');
  node.textureLease=lease;await a.dispose();code(()=>{node.textureLease={};},'ENGINE_CLOSED');code(()=>{node.textureLease=undefined;},'ENGINE_CLOSED');
  node.dispose();code(()=>{node.textureLease=undefined;},'OBJECT_DISPOSED');await b.dispose();
});
test('Bitmap declared members reject wrong receivers before any lifecycle checks',async()=>{
  texture();await ports();
  for(const name of ['textureLease','naturalWidth','naturalHeight']){
    const descriptor=Object.getOwnPropertyDescriptor(egret.Bitmap.prototype,name);
    for(const receiver of [{},null,new egret.DisplayObject()])code(()=>descriptor.get.call(receiver),'BITMAP_INVALID');
  }
  const set=Object.getOwnPropertyDescriptor(egret.Bitmap.prototype,'textureLease').set;
  code(()=>set.call({},undefined),'BITMAP_INVALID');code(()=>egret.Bitmap.prototype.dispose.call({}),'BITMAP_INVALID');
});
test('Bitmap disposal clears borrow before base listener cleanup, propagates failure and is idempotent',async()=>{
  const value=texture(),p=await ports(),e=await engine();let disposals=0,calls=0;const sentinel={cleanup:true};
  const {lease}=await acquire(e,value,()=>{disposals++;});
  class Observed extends egret.Bitmap {clearListeners(){calls++;assert.equal(this.textureLease,undefined);assert.deepEqual([this.naturalWidth,this.naturalHeight],[0,0]);assert.equal(p.bitmapCaptureState(this),undefined);this.dispose();throw sentinel;}}
  const node=new Observed(lease);assert.throws(()=>node.dispose(),cause=>cause===sentinel);node.dispose();
  assert.equal(calls,1);assert.equal(disposals,0);assert.equal(lease.value,value);assert.equal(node.isDisposed,true);
  assert.equal(p.bitmapCaptureState(new egret.DisplayObject()),undefined);await e.dispose();assert.equal(disposals,1);
});
test('private readers ignore overridable Texture and Bitmap getters and are absent from public roots',async()=>{
  const value=texture(),p=await ports(),e=await engine(),{lease}=await acquire(e,value);let reads=0;
  for(const name of ['imageData','sourceRect','width','height','isDisposed'])Object.defineProperty(value,name,{get(){reads++;throw Error('unread');}});
  class Overridden extends egret.Bitmap {get textureLease(){reads++;throw Error('unread');}get naturalWidth(){reads++;throw Error('unread');}get naturalHeight(){reads++;throw Error('unread');}}
  const descriptor=Object.getOwnPropertyDescriptor(egret.AssetLease.prototype,'value');let node,state,snapshot;
  try {
    Object.defineProperty(egret.AssetLease.prototype,'value',{get(){reads++;throw Error('unread');},configurable:true});
    node=new Overridden(lease);
    Object.getOwnPropertyDescriptor(egret.Bitmap.prototype,'textureLease').set.call(node,lease);
    state=p.bitmapCaptureState(node);snapshot=p.readBitmapImage(state.lease);
  } finally {Object.defineProperty(egret.AssetLease.prototype,'value',descriptor);}
  assert.deepEqual([state.width,state.height],[2,1]);assert.deepEqual(snapshot.sourceRect,{x:0,y:0,width:2,height:1});assert.equal(snapshot.image.width,2);
  assert.ok(Object.isFrozen(snapshot));assert.ok(Object.isFrozen(snapshot.sourceRect));assert.equal(reads,0);
  for(const name of ['isAssetLease','readAssetLeaseValue','readTextureSnapshot','bitmapCaptureState','readBitmapImage']){
    assert.equal(typeof p[name],'function');assert.equal(Object.hasOwn(runtime,name),false);assert.equal(Object.hasOwn(egret,name),false);
  }
  node.dispose();await e.dispose();
});
