import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {host} from './helpers.mjs';

// Break: the built public root has no explicit-time playback capability.
test('S01 public root offers the explicit-time player and clip factory',()=>{
  assert.equal(typeof egret.SequencePlayer,'function','public SequencePlayer capability');
  assert.equal(typeof egret.createSequenceClip,'function','public createSequenceClip capability');
});

const RED={x:0,y:0,width:2,height:2}, GREEN={x:2,y:0,width:1,height:2}, BLUE={x:3,y:0,width:3,height:1};
const FULL={x:0,y:0,width:6,height:2};
const ATLAS=[
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,255,255, 0,0,255,255, 0,0,255,255,
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,0,255, 0,0,0,255, 0,0,0,255,
];
const OPTIONS={width:32,height:32,clearColor:0,clearAlpha:0};
let next=0;
function clip(width=6,height=2){return egret.createSequenceClip({atlasWidth:width,atlasHeight:height,frames:[
  {...RED,durationSeconds:0.125},{...GREEN,durationSeconds:0.25},{...BLUE,durationSeconds:0.125},
]});}
async function fixture({base,attach=true,Node=egret.Bitmap}={}){
  const port=host(),engine=await egret.createEngine({host:port.adapter});
  const image=egret.createImageData2D({width:6,height:2,pixels:new Uint8Array(ATLAS)});
  const texture=egret.createTexture(image,base);let loads=0,disposals=0;
  const type=egret.createAssetType('sequence-atlas',egret.isTexture);
  engine.assets.register(type,{load:async()=>{loads++;return texture;},dispose:t=>{disposals++;t.dispose();}});
  const ref=egret.createAssetRef(type,`sequence-${++next}`),lease=await engine.assets.acquire(ref);
  const bitmap=new Node(lease);if(attach)engine.stage.addChild(bitmap);
  return {port,engine,image,texture,ref,lease,bitmap,counts:()=>({loads,disposals})};
}
function code(fn,want){assert.throws(fn,{code:want});}
function command(f){const frame=f.engine.captureFrame(OPTIONS);assert.equal(frame.commands.length,1);return {frame,c:frame.commands[0]};}
function selection(f,player,time,index,region,position,atEnd=false){
  const sample=player.applyAt(time);
  assert.deepEqual(sample,{frameIndex:index,region,positionSeconds:position,atEnd,stopped:false});
  assert.equal(player.lastSample,sample);assert.ok(Object.isFrozen(sample));assert.ok(Object.isFrozen(sample.region));
  const {c}=command(f);assert.deepEqual(c.sourceRect,region);
  assert.deepEqual(c.rect,{x:0,y:0,width:region.width,height:region.height});
  assert.deepEqual([f.bitmap.naturalWidth,f.bitmap.naturalHeight],[region.width,region.height]);
  return sample;
}

// Break: construction changes crop, time accumulates, boundaries or natural sizes drift.
test('S02 construction borrows unchanged crop and once selects absolute boundaries backward',async()=>{
  const f=await fixture();try{
    f.bitmap.sourceRect=GREEN;const p=new egret.SequencePlayer(f.bitmap,clip());
    assert.equal(p.lastSample,undefined);assert.equal(p.isDisposed,false);assert.deepEqual(f.bitmap.sourceRect,GREEN);
    selection(f,p,0,0,RED,0);selection(f,p,0.125,1,GREEN,0.125);
    selection(f,p,0.375,2,BLUE,0.375);selection(f,p,0.5,2,BLUE,0.5,true);
    selection(f,p,3,2,BLUE,0.5,true);selection(f,p,0.125,1,GREEN,0.125);selection(f,p,0,0,RED,0);
    assert.equal(f.bitmap.textureLease,f.lease);assert.deepEqual(f.texture.sourceRect,FULL);
    assert.deepEqual(f.counts(),{loads:1,disposals:0});assert.equal(f.port.timers.size,0);
  }finally{await f.engine.dispose();}
});

// Break: loop fails exact wrapping, binary64 time is rounded or zero remains negative.
test('S03 loop wraps exact duration and accepts large and binary64 times',async()=>{
  const f=await fixture();try{
    const p=new egret.SequencePlayer(f.bitmap,clip(),'loop');
    selection(f,p,0.5,0,RED,0);selection(f,p,0.625,1,GREEN,0.125);
    selection(f,p,0.875,2,BLUE,0.375);selection(f,p,Number.MAX_VALUE,0,RED,0);
    selection(f,p,-0,0,RED,0);assert.equal(Object.is(p.lastSample.positionSeconds,-0),false);
    selection(f,p,Number.MIN_VALUE,0,RED,Number.MIN_VALUE);
  }finally{await f.engine.dispose();}
});

// Break: saved frames retain mutable crop/geometry or borrowed image entitlement.
test('S04 saved frame and sample survive later selection and full resource retirement',async()=>{
  const f=await fixture();const p=new egret.SequencePlayer(f.bitmap,clip());
  const saved=selection(f,p,0.125,1,GREEN,0.125),{frame}=command(f);
  selection(f,p,0.375,2,BLUE,0.375);p.dispose();f.bitmap.dispose();f.lease.release();await f.engine.dispose();
  assert.deepEqual(saved,{frameIndex:1,region:GREEN,positionSeconds:0.125,atEnd:false,stopped:false});
  assert.deepEqual(frame.commands[0].sourceRect,GREEN);
  assert.deepEqual(frame.commands[0].rect,{x:0,y:0,width:1,height:2});
  assert.deepEqual([...egret.copyImageData2DPixels(frame.images[0])],ATLAS);
  assert.equal(p.lastSample.frameIndex,2);assert.deepEqual(f.counts(),{loads:1,disposals:1});
});

// Break: invalid time coercion mutates crop or commits lastSample early.
test('S05 invalid absolute time preserves both committed observations without coercion',async()=>{
  const f=await fixture();try{
    const p=new egret.SequencePlayer(f.bitmap,clip());const previous=selection(f,p,0.125,1,GREEN,0.125);
    let reads=0;const time={valueOf(){reads++;return 0;}};
    for(const bad of [-1,NaN,Infinity,-Infinity,'0',null,undefined,time]){
      code(()=>p.applyAt(bad),'SEQ_TIME_INVALID');assert.equal(p.lastSample,previous);assert.deepEqual(f.bitmap.sourceRect,GREEN);
    }assert.equal(reads,0);
  }finally{await f.engine.dispose();}
});

// Break: checking resource entitlement before exact lease or comparing Texture values.
test('S06 replaced same-Texture lease and cleared slot fail before time or resource reads',async()=>{
  const f=await fixture();try{
    const p=new egret.SequencePlayer(f.bitmap,clip());const previous=p.applyAt(0.125);
    const replacement=await f.engine.assets.acquire(f.ref);assert.equal(replacement.value,f.texture);
    f.bitmap.textureLease=replacement;replacement.release();
    code(()=>p.applyAt(NaN),'SEQ_BINDING_CHANGED');assert.equal(p.lastSample,previous);assert.deepEqual(f.bitmap.sourceRect,FULL);
    f.bitmap.textureLease=undefined;code(()=>p.applyAt(NaN),'SEQ_BINDING_CHANGED');assert.equal(p.lastSample,previous);
    assert.equal(f.bitmap.sourceRect,undefined);
  }finally{await f.engine.dispose();}
});

// Break: same exact lease is treated as replacement or external crop cannot be reinstated.
test('S07 exact same lease reassignment and external crop remain valid',async()=>{
  const f=await fixture();try{
    const p=new egret.SequencePlayer(f.bitmap,clip());p.applyAt(0.125);
    f.bitmap.textureLease=f.lease;assert.deepEqual(f.bitmap.sourceRect,FULL);selection(f,p,0.125,1,GREEN,0.125);
    f.bitmap.sourceRect=BLUE;selection(f,p,0,0,RED,0);
  }finally{await f.engine.dispose();}
});

// Break: disposal releases/restores the borrow, loses cache or permits resurrection.
test('S08 terminal idempotent disposal retains cache and leaves target and lease owned by caller',async()=>{
  const f=await fixture();try{
    const p=new egret.SequencePlayer(f.bitmap,clip()),saved=p.applyAt(0.125);
    p.dispose();p.dispose();assert.equal(p.isDisposed,true);assert.equal(p.lastSample,saved);
    code(()=>p.applyAt(NaN),'SEQ_PLAYER_DISPOSED');assert.deepEqual(f.bitmap.sourceRect,GREEN);
    assert.equal(f.lease.value,f.texture);assert.deepEqual(f.counts(),{loads:1,disposals:0});
    assert.deepEqual(command(f).c.sourceRect,GREEN);
  }finally{await f.engine.dispose();}
});

// Break: class prototype/Proxy/dynamic properties authenticate a forged receiver.
test('S09 private player identity protects apply query and dispose',async()=>{
  const f=await fixture();try{
    const p=new egret.SequencePlayer(f.bitmap,clip());
    const last=Object.getOwnPropertyDescriptor(egret.SequencePlayer.prototype,'lastSample').get;
    const disposed=Object.getOwnPropertyDescriptor(egret.SequencePlayer.prototype,'isDisposed').get;
    for(const fake of [undefined,null,1,{},Object.create(egret.SequencePlayer.prototype),new Proxy(p,{})]){
      code(()=>egret.SequencePlayer.prototype.applyAt.call(fake,NaN),'SEQ_PLAYER_INVALID');
      code(()=>egret.SequencePlayer.prototype.dispose.call(fake),'SEQ_PLAYER_INVALID');
      code(()=>last.call(fake),'SEQ_PLAYER_INVALID');code(()=>disposed.call(fake),'SEQ_PLAYER_INVALID');
    }
  }finally{await f.engine.dispose();}
});

// Break: lifecycle/resource errors are masked by invalid mode/clip/time.
test('S10 constructor and application retain lifecycle and entitlement priority',async()=>{
  code(()=>new egret.SequencePlayer({},null,'bad'),'BITMAP_INVALID');
  for(const failure of ['clear','release','texture','bitmap','engine']){
    const f=await fixture({attach:false});try{
      const p=new egret.SequencePlayer(f.bitmap,clip());const previous=p.applyAt(0.125);
      if(failure==='clear')f.bitmap.textureLease=undefined;
      if(failure==='release')f.lease.release();if(failure==='texture')f.texture.dispose();
      if(failure==='bitmap')f.bitmap.dispose();if(failure==='engine')await f.engine.dispose();
      const expected={clear:'BITMAP_TEXTURE_REQUIRED',release:'ASSET_LEASE_RELEASED',texture:'TEXTURE_DISPOSED',bitmap:'OBJECT_DISPOSED',engine:'ENGINE_CLOSED'}[failure];
      code(()=>new egret.SequencePlayer(f.bitmap,null,'bad'),expected);
      code(()=>p.applyAt(NaN),failure==='clear'?'SEQ_BINDING_CHANGED':expected);
      assert.equal(p.lastSample,previous);
      if(['release','texture','engine'].includes(failure))assert.deepEqual(f.bitmap.sourceRect,GREEN);
    }finally{await f.engine.dispose();}
  }
});

// Break: forged clip getters are read, invalid mode loses priority, atlas view admitted.
test('S11 mode clip identity and full-image atlas are admitted in contract order',async()=>{
  const f=await fixture();try{
    let reads=0;const fake={get atlasWidth(){reads++;throw Error('untrusted');}};
    for(const mode of [null,'bad',{},0])code(()=>new egret.SequencePlayer(f.bitmap,fake,mode),'SEQ_INPUT_INVALID');
    for(const invalid of [fake,{...clip()},new Proxy(clip(),{}),null])code(()=>new egret.SequencePlayer(f.bitmap,invalid),'SEQ_CLIP_INVALID');
    assert.equal(reads,0);code(()=>new egret.SequencePlayer(f.bitmap,clip(7,2)),'SEQ_ATLAS_MISMATCH');
    assert.deepEqual(f.bitmap.sourceRect,FULL);
  }finally{await f.engine.dispose();}
  for(const base of [GREEN,{x:0,y:0,width:5,height:2}]){
    const g=await fixture({base});try{code(()=>new egret.SequencePlayer(g.bitmap,clip()),'SEQ_ATLAS_MISMATCH');}
    finally{await g.engine.dispose();}
  }
});

// Break: target/lease/Texture public overrides replace private authority or crop commit.
test('S12 authoritative binding ignores overrides and captured setter survives later prototype replacement',async()=>{
  class HostileBitmap extends egret.Bitmap{
    get textureLease(){throw Error('overridden lease');}get sourceRect(){throw Error('overridden crop');}
    set sourceRect(value){throw Error('overridden setter');}
  }
  const f=await fixture({Node:HostileBitmap});const descriptor=Object.getOwnPropertyDescriptor(egret.Bitmap.prototype,'sourceRect');
  const leaseValue=Object.getOwnPropertyDescriptor(egret.AssetLease.prototype,'value');
  try{
    Object.defineProperty(egret.AssetLease.prototype,'value',{...leaseValue,get(){throw Error('lease getter');}});
    Object.defineProperty(f.texture,'imageData',{get(){throw Error('texture getter');}});
    Object.defineProperty(f.texture,'sourceRect',{get(){throw Error('texture crop getter');}});
    const p=new egret.SequencePlayer(f.bitmap,clip());
    Object.defineProperty(egret.Bitmap.prototype,'sourceRect',{...descriptor,set(){throw Error('late setter');}});
    const s=p.applyAt(0.125);assert.deepEqual(s.region,GREEN);assert.deepEqual(command(f).c.sourceRect,GREEN);
    assert.deepEqual([f.bitmap.naturalWidth,f.bitmap.naturalHeight],[1,2]);
  }finally{
    Object.defineProperty(egret.Bitmap.prototype,'sourceRect',descriptor);
    Object.defineProperty(egret.AssetLease.prototype,'value',leaseValue);await f.engine.dispose();
  }
});

// Break: Scope can adopt across Engines or the player independently subscribes to cleanup.
test('S13 Engine affinity survives disposal while same-Engine Scope owns only the player',async()=>{
  const f=await fixture(),other=await egret.createEngine({host:host().adapter});try{
    const p=new egret.SequencePlayer(f.bitmap,clip());code(()=>other.createScope().use(p),'ENGINE_MISMATCH');
    const scope=f.engine.createScope();assert.equal(scope.use(p),p);p.applyAt(0.125);scope.dispose();
    assert.equal(p.isDisposed,true);assert.equal(f.lease.value,f.texture);assert.deepEqual(command(f).c.sourceRect,GREEN);
    const unowned=new egret.SequencePlayer(f.bitmap,clip());unowned.dispose();
    code(()=>other.createScope().use(unowned),'ENGINE_MISMATCH');
    const stillUnowned=new egret.SequencePlayer(f.bitmap,clip());await f.engine.dispose();
    assert.equal(stillUnowned.isDisposed,false);code(()=>stillUnowned.applyAt(0),'OBJECT_DISPOSED');stillUnowned.dispose();
  }finally{await f.engine.dispose();await other.dispose();}
});

// Break: retiring the borrowed target Scope is missed or makes player ownership implicit.
test('S14 target Scope retirement blocks application without disposing the player',async()=>{
  const f=await fixture();try{
    const scope=f.engine.createScope();scope.use(f.lease);scope.use(f.bitmap);
    const p=new egret.SequencePlayer(f.bitmap,clip()),sample=p.applyAt(0.125);scope.dispose();
    code(()=>p.applyAt(0),'OBJECT_DISPOSED');assert.equal(p.isDisposed,false);assert.equal(p.lastSample,sample);
  }finally{await f.engine.dispose();}
});
