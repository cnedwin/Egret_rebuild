// Private proposed test source. Adopt as R/tests/bitmap-region.test.mjs before running.
// Literal expectations are independent of Bitmap/capture/sampler implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {collectFrameCommands} from '../packages/runtime/dist/index.js';
import {createSequenceClip, sampleSequenceClip} from '../packages/runtime/dist/sequenceClip.js';
import {host} from './helpers.mjs';

const ATLAS = Object.freeze([
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,255,255, 0,0,255,255, 0,0,255,255,
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,0,255, 0,0,0,255, 0,0,0,255,
]);
const FULL = Object.freeze({x:0,y:0,width:6,height:2});
const GREEN = Object.freeze({x:2,y:0,width:1,height:2});
const BLUE = Object.freeze({x:3,y:0,width:3,height:1});
const OPTIONS = Object.freeze({width:32,height:32,clearColor:0,clearAlpha:0});
const intrinsic = Object.getOwnPropertyDescriptor(egret.Bitmap.prototype, 'sourceRect');
let nextAsset = 0;

function setRegion(bitmap, region) {
  assert.equal(typeof intrinsic?.set, 'function', 'selected Bitmap sourceRect setter is required');
  Reflect.apply(intrinsic.set, bitmap, [region]);
}
function getRegion(bitmap) {
  assert.equal(typeof intrinsic?.get, 'function', 'selected Bitmap sourceRect getter is required');
  return Reflect.apply(intrinsic.get, bitmap, []);
}
function errorCode(operation, code) { assert.throws(operation, {code}); }
function caught(operation, code, cause) {
  let thrown = false, error;
  try { operation(); } catch (value) { thrown = true; error = value; }
  assert.equal(thrown, true, 'must detect throw undefined');
  assert.equal(error?.code, code);
  assert.equal(error.cause, cause);
}
function image(width=6, height=2) {
  const pixels = width===6 && height===2 ? new Uint8Array(ATLAS) : new Uint8Array(width*height*4);
  return egret.createImageData2D({width,height,pixels});
}
async function borrow(engine, value, dispose=texture=>texture.dispose()) {
  const type = egret.createAssetType('region-test-value', ()=>true);
  engine.assets.register(type, {load:async()=>value,dispose});
  const ref = egret.createAssetRef(type, `region-${++nextAsset}`);
  return {ref,lease:await engine.assets.acquire(ref)};
}
async function fixture({base, width=6, height=2, attach=true, Node=egret.Bitmap}={}) {
  const port = host(), engine = await egret.createEngine({host:port.adapter});
  const value = image(width,height), texture = egret.createTexture(value,base);
  let loads=0, disposals=0;
  const type = egret.createAssetType('region-atlas',egret.isTexture);
  engine.assets.register(type, {load:async()=>{loads++;return texture;},dispose:t=>{disposals++;t.dispose();}});
  const ref = egret.createAssetRef(type, `atlas-${++nextAsset}`);
  const lease = await engine.assets.acquire(ref), node = new Node(lease);
  if (attach) engine.stage.addChild(node);
  return {engine,node,lease,ref,texture,value,port,counts:()=>({loads,disposals})};
}
function command(engine) {
  const frame = engine.captureFrame(OPTIONS);
  assert.equal(frame.commands.length,1);
  assert.equal(frame.commands[0].kind,'image');
  return {frame,command:frame.commands[0]};
}
function state(node, expected, width, height) {
  assert.deepEqual(getRegion(node),expected);
  assert.deepEqual([node.naturalWidth,node.naturalHeight],[width,height]);
}

// Break: per-frame wrapper/adoption or capture ignoring the selected crop.
test('B01 selected crop changes captured geometry while one atlas borrow remains stable',async()=>{
  const f=await fixture();
  try {
    f.node.sourceRect={x:2,y:0,width:1,height:2};
    const {frame,command:c}=command(f.engine);
    assert.deepEqual(c.sourceRect,GREEN);
    assert.deepEqual(c.rect,{x:0,y:0,width:1,height:2});
    assert.deepEqual([f.node.naturalWidth,f.node.naturalHeight],[1,2]);
    assert.equal(f.node.textureLease,f.lease);
    assert.deepEqual(frame.images,[f.value]);
    assert.deepEqual(f.texture.sourceRect,FULL);
    assert.deepEqual(f.counts(),{loads:1,disposals:0});
    f.node.dispose();
    assert.equal(f.lease.value,f.texture);
    assert.deepEqual(f.counts(),{loads:1,disposals:0});
  } finally { await f.engine.dispose(); }
});

// Break: hidden scheduler/time accumulation, incorrect boundary or natural-size update.
test('B02 explicit sequence seconds drive literal atlas crops including backward seeks',async()=>{
  const f=await fixture();
  try {
    const clip=createSequenceClip({atlasWidth:6,atlasHeight:2,frames:[
      {x:0,y:0,width:2,height:2,durationSeconds:0.125},
      {x:2,y:0,width:1,height:2,durationSeconds:0.25},
      {x:3,y:0,width:3,height:1,durationSeconds:0.125},
    ]});
    const once=Object.freeze({mode:'once'}), loop=Object.freeze({mode:'loop'});
    const cases=[
      [0,once,{x:0,y:0,width:2,height:2},2,2],
      [0.125,once,GREEN,1,2], [0.375,once,BLUE,3,1], [0.5,once,BLUE,3,1],
      [0.5,loop,{x:0,y:0,width:2,height:2},2,2], [0.125,once,GREEN,1,2],
    ];
    for(const [seconds,options,want,w,h] of cases){
      setRegion(f.node,sampleSequenceClip(clip,seconds,options).region);
      assert.deepEqual(command(f.engine).command.sourceRect,want);
      state(f.node,want,w,h);
    }
    assert.equal(f.port.timers.size,0,'caller-supplied samples cannot create a frame timer');
    assert.deepEqual(f.counts(),{loads:1,disposals:0});
  } finally { await f.engine.dispose(); }
});

// Break: interpreting a crop relative to the Texture or allowing escape from its view.
test('B03 absolute regions stay within a nonzero Texture base view',async()=>{
  const f=await fixture({base:{x:10,y:20,width:8,height:6},width:32,height:32});
  try {
    setRegion(f.node,{x:12,y:21,width:2,height:3});
    assert.deepEqual(command(f.engine).command.sourceRect,{x:12,y:21,width:2,height:3});
    for(const invalid of [{x:2,y:1,width:2,height:3},{x:9,y:20,width:1,height:1},{x:17,y:25,width:2,height:1}]){
      errorCode(()=>setRegion(f.node,invalid),'BITMAP_REGION_INVALID');
      state(f.node,{x:12,y:21,width:2,height:3},2,3);
    }
  } finally { await f.engine.dispose(); }
});

// Break: retaining caller records, non-frozen metadata or unknown-field reads.
test('B04 region admission owns a frozen copy and normalizes coordinate zero',async()=>{
  const f=await fixture();
  try {
    const input={x:-0,y:-0,width:2,height:2};
    Object.defineProperty(input,'unknown',{get(){throw Error('must not read unknown');}});
    setRegion(f.node,input); input.width=6;
    const region=getRegion(f.node);
    assert.deepEqual(region,{x:0,y:0,width:2,height:2});
    assert.ok(Object.isFrozen(region));
    assert.equal(Object.is(region.x,-0),false);assert.equal(Object.is(region.y,-0),false);
    assert.deepEqual(command(f.engine).command.rect,{x:0,y:0,width:2,height:2});
  } finally { await f.engine.dispose(); }
});

// Break: coercion/invalid extents or an early partial state commit.
test('B05 invalid shapes and numeric ranges preserve selected region and sizes',async()=>{
  const f=await fixture();
  try {
    setRegion(f.node,GREEN);
    for(const invalid of [null,1,()=>{}, {x:0,y:0,width:'1',height:1},
      {x:0.5,y:0,width:1,height:1},{x:-1,y:0,width:1,height:1},
      {x:0,y:0,width:0,height:1},{x:0,y:0,width:1,height:-0},
      {x:0,y:0,width:new Number(1),height:1},{x:0,y:0,width:1,height:Infinity},
      {x:Number.MAX_SAFE_INTEGER,y:0,width:1,height:1},{x:5,y:0,width:2,height:1}]){
      errorCode(()=>setRegion(f.node,invalid),'BITMAP_REGION_INVALID');state(f.node,GREEN,1,2);
    }
  } finally { await f.engine.dispose(); }
});

// Break: early semantic rejection, repeated field reads or replacing caller faults.
test('B06 all four fields precede semantics and exact read causes survive',async()=>{
  const f=await fixture();
  try {
    setRegion(f.node,GREEN);
    for(const sentinel of [undefined,{read:true},{name:'EgretError',code:'OBJECT_DISPOSED'}]){
      const trace=[];
      const region={get x(){trace.push('x');return -1;},get y(){trace.push('y');return 0;},
        get width(){trace.push('width');return 1;},get height(){trace.push('height');throw sentinel;}};
      caught(()=>setRegion(f.node,region),'BITMAP_REGION_INVALID',sentinel);
      assert.deepEqual(trace,['x','y','width','height']);state(f.node,GREEN,1,2);
    }
    const trace=[];
    setRegion(f.node,{get x(){trace.push('x');return 2;},get y(){trace.push('y');return 0;},
      get width(){trace.push('width');return 1;},get height(){trace.push('height');return 2;}});
    assert.deepEqual(trace,['x','y','width','height']);
  } finally { await f.engine.dispose(); }
});

// Break: stale selection surviving reset/same lease replacement/clear.
test('B07 reset same-lease replacement and cleared slots have distinct exact behavior',async()=>{
  const f=await fixture();
  try {
    setRegion(f.node,GREEN);setRegion(f.node,undefined);state(f.node,FULL,6,2);
    setRegion(f.node,GREEN);f.node.textureLease=f.lease;state(f.node,FULL,6,2);
    setRegion(f.node,GREEN);f.node.textureLease=undefined;state(f.node,undefined,0,0);
    setRegion(f.node,undefined);state(f.node,undefined,0,0);
    let reads=0;
    errorCode(()=>setRegion(f.node,{get x(){reads++;return 0;}}),'BITMAP_TEXTURE_REQUIRED');
    assert.equal(reads,0);
    f.node.textureLease=f.lease;state(f.node,FULL,6,2);
    const cropped=egret.createTexture(f.value,{x:3,y:0,width:3,height:1});
    const replacement=await borrow(f.engine,cropped);
    f.node.textureLease=replacement.lease;state(f.node,BLUE,3,1);
  } finally { await f.engine.dispose(); }
});

// Break: replacement validation dropping the old crop or Engine affinity.
test('B08 every failed lease replacement retains the selected slot',async()=>{
  const f=await fixture(), other=await fixture();
  try {
    setRegion(f.node,GREEN);
    const wrong=await borrow(f.engine,{},()=>{}), dead=egret.createTexture(f.value);dead.dispose();
    const disposed=await borrow(f.engine,dead), released=await borrow(f.engine,egret.createTexture(f.value));released.lease.release();
    other.lease.release();
    for(const [value,want] of [[{},'BITMAP_LEASE_INVALID'],[other.lease,'ENGINE_MISMATCH'],
      [wrong.lease,'BITMAP_TEXTURE_INVALID'],[disposed.lease,'TEXTURE_DISPOSED'],[released.lease,'ASSET_LEASE_RELEASED']]){
      errorCode(()=>{f.node.textureLease=value;},want);state(f.node,GREEN,1,2);
      assert.equal(f.node.textureLease,f.lease);
      assert.deepEqual(command(f.engine).command.sourceRect,GREEN);
    }
    f.node.textureLease=undefined;
    errorCode(()=>{f.node.textureLease=other.lease;},'ENGINE_MISMATCH');state(f.node,undefined,0,0);
  } finally { await f.engine.dispose();await other.engine.dispose(); }
});

// Break: metadata reads acquiring/reviving entitlement or invalidation revoking old demand.
test('B09 cached metadata survives release while active old-generation demand remains independent',async()=>{
  const f=await fixture();
  try {
    const second=await f.engine.assets.acquire(f.ref), node=new egret.Bitmap(second);f.engine.stage.addChild(node);
    setRegion(f.node,GREEN);setRegion(node,BLUE);f.engine.assets.invalidate(f.ref);
    assert.deepEqual(f.engine.captureFrame(OPTIONS).commands.map(c=>c.sourceRect),[GREEN,BLUE]);
    f.lease.release();state(f.node,GREEN,1,2);
    errorCode(()=>setRegion(f.node,undefined),'ASSET_LEASE_RELEASED');
    errorCode(()=>setRegion(f.node,BLUE),'ASSET_LEASE_RELEASED');
    errorCode(()=>f.engine.captureFrame(OPTIONS),'ASSET_LEASE_RELEASED');
    f.node.visible=false;assert.deepEqual(command(f.engine).command.sourceRect,BLUE);
    assert.deepEqual(f.counts(),{loads:1,disposals:0});
    second.release();state(node,BLUE,3,1);
    errorCode(()=>setRegion(node,GREEN),'ASSET_LEASE_RELEASED');
    assert.deepEqual(f.counts(),{loads:1,disposals:1});
    f.node.textureLease=undefined;state(f.node,undefined,0,0);
  } finally { await f.engine.dispose(); }
});

// Break: committing sourceRect independently of destination/natural geometry.
test('B10 getter-triggered capture observes only the previous complete crop',async()=>{
  const f=await fixture();
  try {
    setRegion(f.node,GREEN);let seen;
    setRegion(f.node,{get x(){seen=command(f.engine).command;return 3;},y:0,width:3,height:1});
    assert.deepEqual(seen.sourceRect,GREEN);assert.deepEqual(seen.rect,{x:0,y:0,width:1,height:2});
    const after=command(f.engine).command;
    assert.deepEqual(after.sourceRect,BLUE);assert.deepEqual(after.rect,{x:0,y:0,width:3,height:1});
  } finally { await f.engine.dispose(); }
});

// Break: unguarded nested crop or lease setter overwriting the outer snapshot.
test('B11 uncaught nested slot mutation is the wrapped read cause with no commit',async()=>{
  const f=await fixture();
  try {
    setRegion(f.node,GREEN);
    for(const mutate of [()=>setRegion(f.node,BLUE),()=>{f.node.textureLease=undefined;}]){
      let nested;
      const input={get x(){try{mutate();}catch(error){nested=error;throw error;}throw Error('guard did not reject');},y:0,width:1,height:1};
      let outer;try{setRegion(f.node,input);}catch(error){outer=error;}
      assert.equal(nested?.code,'BITMAP_MUTATION_REENTRANT');
      assert.equal(outer?.code,'BITMAP_REGION_INVALID');assert.equal(outer.cause,nested);
      state(f.node,GREEN,1,2);assert.equal(f.node.textureLease,f.lease);
    }
    setRegion(f.node,BLUE);state(f.node,BLUE,3,1);
  } finally { await f.engine.dispose(); }
});

// Break: a caught nested fault permanently poisoning the guard or stopping valid commit.
test('B12 caught nested mutations leave the outer update valid and release the guard',async()=>{
  const f=await fixture();
  try {
    setRegion(f.node,{get x(){
      errorCode(()=>setRegion(f.node,GREEN),'BITMAP_MUTATION_REENTRANT');
      errorCode(()=>{f.node.textureLease=undefined;},'BITMAP_MUTATION_REENTRANT');return 3;
    },y:0,width:3,height:1});
    state(f.node,BLUE,3,1);f.node.textureLease=f.lease;state(f.node,FULL,6,2);
  } finally { await f.engine.dispose(); }
});

// Break: blocking terminal cleanup or resurrecting disposed state at outer commit.
test('B13 disposal during a successful field snapshot defeats the pending update',async()=>{
  const f=await fixture();
  try {
    setRegion(f.node,GREEN);const trace=[];
    errorCode(()=>setRegion(f.node,{get x(){trace.push('x');f.node.dispose();return -1;},
      get y(){trace.push('y');return 0;},get width(){trace.push('width');return 1;},get height(){trace.push('height');return 1;}}),'OBJECT_DISPOSED');
    assert.deepEqual(trace,['x','y','width','height']);state(f.node,undefined,0,0);
    assert.equal(f.lease.value,f.texture);assert.deepEqual(f.counts(),{loads:1,disposals:0});
  } finally { await f.engine.dispose(); }
});

// Break: Engine closure bypassed by slot commit; detached node isolates ENGINE_CLOSED priority.
test('B14 Engine close after reads precedes region numbers and revoked entitlement',async()=>{
  const f=await fixture({attach:false});let closing;
  try {
    setRegion(f.node,GREEN);
    errorCode(()=>setRegion(f.node,{get x(){closing=f.engine.dispose();return -1;},y:0,width:1,height:1}),'ENGINE_CLOSED');
    state(f.node,GREEN,1,2);
    errorCode(()=>setRegion(f.node,undefined),'ENGINE_CLOSED');
  } finally { await (closing??f.engine.dispose()); }
});

// Break: reusing pre-read entitlement after an external getter revokes it.
test('B15 post-read lease and Texture authority precedes captured invalid coordinates',async()=>{
  for(const target of ['lease','texture']){
    const f=await fixture();
    try {
      setRegion(f.node,GREEN);
      errorCode(()=>setRegion(f.node,{get x(){if(target==='lease')f.lease.release();else f.texture.dispose();return -1;},y:0,width:1,height:1}),
        target==='lease'?'ASSET_LEASE_RELEASED':'TEXTURE_DISPOSED');
      state(f.node,GREEN,1,2);
    } finally { await f.engine.dispose(); }
  }
});

// Break: catching a source throw and substituting a later lifecycle fault.
test('B16 a later throwing field retains exact read cause even after disposal',async()=>{
  const f=await fixture();
  try {
    const sentinel={original:true},trace=[];
    caught(()=>setRegion(f.node,{get x(){trace.push('x');f.node.dispose();return 0;},
      get y(){trace.push('y');return 0;},get width(){trace.push('width');return 1;},
      get height(){trace.push('height');throw sentinel;}}),'BITMAP_REGION_INVALID',sentinel);
    assert.deepEqual(trace,['x','y','width','height']);state(f.node,undefined,0,0);
  } finally { await f.engine.dispose(); }
});

// Break: saved command aliasing live crop or replay resolving a dead borrow.
test('B17 saved selected frames own stable crops and pixels across disposal and CPU replay',async()=>{
  const f=await fixture();let closed=false;
  try {
    const input={x:2,y:0,width:1,height:2};setRegion(f.node,input);
    const saved=command(f.engine).frame;input.x=3;setRegion(f.node,BLUE);
    assert.deepEqual(saved.commands[0].sourceRect,GREEN);
    assert.deepEqual(saved.commands[0].rect,{x:0,y:0,width:1,height:2});
    for(const part of [saved,saved.commands,saved.images,saved.images[0],saved.commands[0],saved.commands[0].sourceRect,saved.commands[0].rect])assert.ok(Object.isFrozen(part));
    f.lease.release();f.engine.assets.invalidate(f.ref);f.texture.dispose();await f.engine.dispose();closed=true;
    assert.deepEqual(Array.from(egret.copyImageData2DPixels(saved.images[0])),ATLAS);
    const observed=[], port=host({renderFrame(frame){observed.push({crop:frame.commands[0].sourceRect,rect:frame.commands[0].rect,pixels:Array.from(egret.copyImageData2DPixels(frame.images[0]))});}});
    const second=await egret.createEngine({host:port.adapter});
    try { port.adapter.renderFrame(saved);assert.deepEqual(observed,[{crop:GREEN,rect:{x:0,y:0,width:1,height:2},pixels:ATLAS}]); }
    finally { await second.dispose(); }
  } finally { if(!closed)await f.engine.dispose(); }
});

// Break: routing capture or private harness selection through overridable public accessors.
test('B18 intrinsic selection and capture ignore public overrides',async()=>{
  let reads=0;
  class Overridden extends egret.Bitmap {
    get sourceRect(){reads++;throw Error('public crop getter');}
    set sourceRect(value){reads++;throw Error('public crop setter');}
  }
  const f=await fixture({Node:Overridden});
  try {
    for(const key of ['imageData','sourceRect','width','height','isDisposed'])Object.defineProperty(f.texture,key,{get(){reads++;throw Error('public texture getter');}});
    for(const key of ['textureLease','naturalWidth','naturalHeight'])Object.defineProperty(f.node,key,{get(){reads++;throw Error('public bitmap getter');}});
    const descriptor=Object.getOwnPropertyDescriptor(egret.AssetLease.prototype,'value');
    try {
      Object.defineProperty(egret.AssetLease.prototype,'value',{get(){reads++;throw Error('public lease getter');},configurable:true});
      setRegion(f.node,GREEN);const c=command(f.engine).command;
      assert.deepEqual(c.sourceRect,GREEN);assert.deepEqual(c.rect,{x:0,y:0,width:1,height:2});assert.equal(reads,0);
    } finally { Object.defineProperty(egret.AssetLease.prototype,'value',descriptor); }
  } finally { await f.engine.dispose(); }
});

// Break: changing geometry-before-entitlement or suppression during selected-crop capture.
test('B19 selected geometry preserves inherited zero-alpha error precedence',async()=>{
  const f=await fixture();
  try {
    setRegion(f.node,BLUE);const parent=new egret.Sprite();f.engine.stage.addChild(parent);parent.addChild(f.node);
    parent.alpha=1e-200;f.node.alpha=1e-200;f.lease.release();
    assert.deepEqual(f.engine.captureFrame(OPTIONS).commands,[]);
    f.node.scaleY=Number.MAX_VALUE;
    assert.deepEqual(f.engine.captureFrame(OPTIONS).commands,[],'selected height1 stays finite; base height2 would overflow');
    f.node.scaleX=Number.MAX_VALUE;
    errorCode(()=>f.engine.captureFrame(OPTIONS),'FRAME_TRANSFORM_INVALID');
    f.node.textureLease=undefined;assert.deepEqual(f.engine.captureFrame(OPTIONS).commands,[]);
  } finally { await f.engine.dispose(); }
});

// Break: budgeting the base Texture instead of each simultaneous selected view.
test('B20 same-image region selections preserve 128-view limits and per-frame deduplication',async()=>{
  const f=await fixture({width:129,height:1,attach:false});
  try {
    for(let x=0;x<128;x++){const node=new egret.Bitmap(f.lease);setRegion(node,{x,y:0,width:1,height:1});f.engine.stage.addChild(node);}
    const repeated=new egret.Bitmap(f.lease);setRegion(repeated,{x:0,y:0,width:1,height:1});f.engine.stage.addChild(repeated);
    const first=f.engine.captureFrame(OPTIONS);assert.equal(first.commands.length,129);assert.deepEqual(first.images,[f.value]);
    const last=new egret.Bitmap(f.lease);setRegion(last,{x:128,y:0,width:1,height:1});f.engine.stage.addChild(last);
    errorCode(()=>f.engine.captureFrame(OPTIONS),'FRAME_IMAGE_BUDGET');
    last.visible=false;assert.equal(f.engine.captureFrame(OPTIONS).commands.length,129);
    setRegion(repeated,{x:1,y:0,width:1,height:1});assert.equal(f.engine.captureFrame(OPTIONS).images.length,1);
  } finally { await f.engine.dispose(); }
});

// Break: consulting lookalike receiver fields or rejecting inherited known region fields.
test('B21 receiver brand precedes fields while known inherited fields are captured once',async()=>{
  const f=await fixture();
  try {
    let reads=0;const region={get x(){reads++;return 0;},y:0,width:1,height:1};
    for(const wrong of [{},null,new Proxy(f.node,{get(){throw Error('unread proxy');}})]){
      errorCode(()=>setRegion(wrong,region),'BITMAP_INVALID');errorCode(()=>getRegion(wrong),'BITMAP_INVALID');
    }
    assert.equal(reads,0);
    const inherited=Object.create({get x(){reads++;return 2;},y:0,width:1,height:2});
    setRegion(f.node,inherited);assert.equal(reads,1);state(f.node,GREEN,1,2);
  } finally { await f.engine.dispose(); }
});

// Break: keeping the selected crop during terminal listener cleanup or releasing a caller lease.
test('B22 disposal clears crop and sizes before reentrant listener cleanup',async()=>{
  let cleanups=0;
  class Observed extends egret.Bitmap {
    clearListeners(){cleanups++;state(this,undefined,0,0);assert.equal(this.textureLease,undefined);this.dispose();}
  }
  const f=await fixture({Node:Observed});
  try {
    setRegion(f.node,GREEN);
    errorCode(()=>setRegion(f.node,{get x(){f.node.dispose();return 0;},y:0,width:1,height:1}),'OBJECT_DISPOSED');
    f.node.dispose();assert.equal(cleanups,1);
    assert.equal(f.lease.value,f.texture);assert.deepEqual(f.counts(),{loads:1,disposals:0});
    errorCode(()=>setRegion(f.node,undefined),'OBJECT_DISPOSED');
  } finally { await f.engine.dispose(); }
});

// Break: selected-crop geometry or lease errors losing legacy precedence.
test('B23 legacy capture keeps geometry then entitlement then unsupported order',async()=>{
  const f=await fixture();
  try {
    setRegion(f.node,GREEN);
    errorCode(()=>collectFrameCommands(f.engine.stage),'FRAME_IMAGE_UNSUPPORTED');
    f.lease.release();errorCode(()=>collectFrameCommands(f.engine.stage),'ASSET_LEASE_RELEASED');
    f.node.scaleY=Number.MAX_VALUE;errorCode(()=>collectFrameCommands(f.engine.stage),'FRAME_TRANSFORM_INVALID');
    f.node.textureLease=undefined;assert.deepEqual(collectFrameCommands(f.engine.stage),[]);
  } finally { await f.engine.dispose(); }
});
