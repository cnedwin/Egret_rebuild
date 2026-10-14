// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

const OPTIONS=Object.freeze({width:64,height:64});
const AXES=Object.freeze(['anchorOffsetX','anchorOffsetY']);
const MATRIX_KEYS=Object.freeze(['a','b','c','d','tx','ty']);
function accessors() {
  return Object.fromEntries(AXES.map(key=>{
    const descriptor=Object.getOwnPropertyDescriptor(egret.DisplayObject.prototype,key);
    assert.ok(descriptor && typeof descriptor.get==='function' && typeof descriptor.set==='function',
      'DISPLAY_ANCHOR_OFFSETS_REQUIRED');
    return [key,descriptor];
  }));
}
function get(descriptors,key,node) {return Reflect.apply(descriptors[key].get,node,[]);}
function set(descriptors,key,node,value) {Reflect.apply(descriptors[key].set,node,[value]);}
function code(operation,expected) {assert.throws(operation,{code:expected});}
function near(actual,expected) {
  for(const key of Object.keys(expected)) assert.ok(Math.abs(actual[key]-expected[key])<=1e-10,
    key+': '+actual[key]+' versus '+expected[key]);
}
// Encode public observations only; do not compose or invert transforms.
function matrixBytes(matrix) {
  return MATRIX_KEYS.map(key=>{
    const bytes=new Uint8Array(8);new DataView(bytes.buffer).setFloat64(0,matrix[key],true);
    return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
  });
}
function bothMatrices(engine,expected) {
  for(const frame of [engine.captureFrame(OPTIONS),engine.captureTexturedFrame(OPTIONS)]) {
    assert.equal(frame.commands.length,1);near(frame.commands[0].matrix,expected);
  }
}
async function fixture(body) {
  const descriptors=accessors(),submitted=[],textured=[],diagnostics=[];
  const port=host({texturedFrameProfile:egret.TEXTURED_FRAME_PROFILE_2D,
    renderFrame(frame){submitted.push(frame);},renderTexturedFrame(frame){textured.push(frame);}});
  const engine=await egret.createEngineForProfile({host:port.adapter,onDiagnostic:value=>diagnostics.push(value)},
    egret.TEXTURED_FRAME_PROFILE_2D);
  const scope=engine.createScope(),nodes=[],leases=[],textures=[];
  const f={engine,scope,port,descriptors,submitted,textured,diagnostics,nodes,leases,textures,
    own(node){nodes.push(node);scope.use(node);return node;},
    loose(node){nodes.push(node);return node;},
    sprite(parent=engine.stage){const node=this.own(new egret.Sprite());parent.addChild(node);return node;}};
  let primaryPresent=false,primary;const errors=[];
  try {await body(f);} catch(cause){primaryPresent=true;primary=cause;}
  finally {
    for(const action of [()=>scope.dispose(),...nodes.map(node=>()=>node.dispose()),
      ...leases.map(lease=>()=>lease.release())]) {
      try {action();} catch(cause){errors.push(cause);}
    }
    try {await engine.dispose();} catch(cause){errors.push(cause);}
    for(const texture of textures) {try {texture.dispose();} catch(cause){errors.push(cause);}}
    try {
      assert.equal(port.timers.size,0);
      assert.equal(port.trace.filter(value=>value==='stop').length,1);
      assert.equal(port.trace.filter(value=>value==='close').length,1);
    } catch(cause){errors.push(cause);}
  }
  if(errors.length) throw new AggregateError(primaryPresent?[primary,...errors]:errors,'anchor fixture cleanup failed');
  if(primaryPresent) throw primary;
}
function rect(node,width=8,height=6) {node.graphics.beginFill(0xff0000).drawRect(0,0,width,height).endFill();}
function handScene(f) {
  const parent=f.sprite();parent.x=5;parent.y=7;
  const child=f.sprite(parent);child.x=20;child.y=30;child.scaleX=2;
  child.anchorOffsetX=4;child.anchorOffsetY=3;rect(child);
  return {parent,child};
}

// Defaults belong to inherited existing-class scalar accessors.
test('AO01 default positive zero and independent genuine instances',async()=>fixture(f=>{
  for(const node of [f.own(new egret.DisplayObject()),f.own(new egret.DisplayObjectContainer()),f.sprite(),f.engine.stage])
    for(const key of AXES) assert.equal(Object.is(get(f.descriptors,key,node),0),true);
  const first=f.sprite(),second=f.sprite();first.anchorOffsetX=7;
  assert.equal(second.anchorOffsetX,0);assert.equal(first.anchorOffsetY,0);
}));
test('AO02 every finite primitive is stored exactly and axes remain independent',async()=>fixture(f=>{
  const node=f.sprite();
  for(const value of [0,-0,-7,3.5,Number.MIN_VALUE,Number.MAX_VALUE]) {
    node.anchorOffsetX=value;assert.equal(Object.is(node.anchorOffsetX,value),true);
    assert.equal(node.anchorOffsetY,0);
    node.anchorOffsetY=value;assert.equal(Object.is(node.anchorOffsetY,value),true);
    node.anchorOffsetX=0;node.anchorOffsetY=0;
  }
}));

// The original AO00 actor supplies old-version bytes. These are current-run
// comparisons, including signed zero, rather than predicted baseline receipts.
test('AO03 both zero offsets preserve exact current public matrix bytes',async()=>fixture(f=>{
  const node=f.sprite();node.x=-0;node.y=-0;node.scaleX=-1;rect(node,2,3);
  const saved=f.engine.captureFrame(OPTIONS), bytes=matrixBytes(saved.commands[0].matrix);
  assert.equal(Object.is(saved.commands[0].matrix.b,-0),true);
  for(const x of [0,-0]) for(const y of [0,-0]) {
    node.anchorOffsetX=x;node.anchorOffsetY=y;
    f.engine.stage.anchorOffsetX=y;f.engine.stage.anchorOffsetY=x;
    for(const frame of [f.engine.captureFrame(OPTIONS),f.engine.captureTexturedFrame(OPTIONS)])
      assert.deepEqual(matrixBytes(frame.commands[0].matrix),bytes);
  }
  assert.deepEqual(matrixBytes(saved.commands[0].matrix),bytes);
}));
test('AO04 invalid values never coerce or change either stored axis',async()=>fixture(f=>{
  const node=f.sprite();node.anchorOffsetX=4;node.anchorOffsetY=-3;
  let reads=0;
  const coercible={valueOf(){reads++;return 2;},toString(){reads++;return '2';}};
  const proxy=new Proxy({}, {get(){reads++;throw new Error('value must remain opaque');}});
  for(const value of [undefined,null,NaN,Infinity,-Infinity,'1',true,{},new Number(1),
    coercible,proxy,Symbol('pivot'),1n,()=>1]) for(const key of AXES) {
    code(()=>set(f.descriptors,key,node,value),'DISPLAY_VALUE_INVALID');
    assert.equal(node.anchorOffsetX,4);assert.equal(node.anchorOffsetY,-3);
  }
  assert.equal(reads,0);
}));
// Identity is checked without shape inspection, including genuine-object proxies.
test('AO05 fake and proxy receivers fail before any value or receiver read',async()=>fixture(f=>{
  const node=f.sprite();let reads=0;
  const proxy=new Proxy(node,{get(){reads++;throw new Error('receiver trap');}});
  const fake=new Proxy({}, {get(){reads++;throw new Error('fake trap');}});
  const revoked=Proxy.revocable(node,{});revoked.revoke();
  const value={valueOf(){reads++;return 1;}};
  for(const receiver of [undefined,null,0,'x',{},Object.create(egret.DisplayObject.prototype),proxy,fake,revoked.proxy])
    for(const key of AXES) {
      code(()=>get(f.descriptors,key,receiver),'INVALID_DISPLAY_OBJECT');
      code(()=>set(f.descriptors,key,receiver,value),'INVALID_DISPLAY_OBJECT');
    }
  assert.equal(reads,0);assert.equal(node.anchorOffsetX,0);assert.equal(node.anchorOffsetY,0);
}));
test('AO06 disposed setters precede Engine closed and invalid value while getters retain values',async()=>fixture(async f=>{
  const node=f.sprite();node.anchorOffsetX=-0;node.anchorOffsetY=9;node.dispose();
  for(const key of AXES) code(()=>set(f.descriptors,key,node,NaN),'OBJECT_DISPOSED');
  await f.engine.dispose();
  assert.equal(Object.is(node.anchorOffsetX,-0),true);assert.equal(node.anchorOffsetY,9);
  for(const key of AXES) code(()=>set(f.descriptors,key,node,NaN),'OBJECT_DISPOSED');
}));
test('AO07 a detached live Engine-bound node retains observations after close',async()=>fixture(async f=>{
  const node=f.loose(new egret.Sprite());f.engine.stage.addChild(node);f.engine.stage.removeChild(node);
  node.anchorOffsetX=4;node.anchorOffsetY=-0;await f.engine.dispose();
  assert.equal(node.isDisposed,false);assert.equal(node.anchorOffsetX,4);
  assert.equal(Object.is(node.anchorOffsetY,-0),true);
  for(const key of AXES) code(()=>set(f.descriptors,key,node,NaN),'ENGINE_CLOSED');
}));

// Independent literal points and rectangles are the oracle; no transform helper
// computes expected results from the implementation's state.
test('AO08 unbound negative and outside-content pivot leaves own bounds local',async()=>fixture(f=>{
  const node=f.loose(new egret.Sprite());node.x=20;node.y=30;node.scaleX=2;
  node.anchorOffsetX=-4;node.anchorOffsetY=2;rect(node);
  near(node.localToGlobal(-4,2),{x:20,y:30});near(node.localToGlobal(0,0),{x:28,y:28});
  near(node.globalToLocal(20,30),{x:-4,y:2});near(node.getBounds(),{x:0,y:0,width:8,height:6});
}));
test('AO09 accepted hand example agrees in bounds coordinates and both captures',async()=>fixture(f=>{
  const {parent,child}=handScene(f);
  near(child.localToGlobal(4,3),{x:25,y:37});near(child.localToGlobal(0,0),{x:17,y:34});
  near(child.globalToLocal(25,37),{x:4,y:3});
  near(child.getBounds(),{x:0,y:0,width:8,height:6});
  near(parent.getBounds(),{x:12,y:27,width:16,height:6});
  bothMatrices(f.engine,{a:2,b:0,c:0,d:1,tx:17,ty:34});
}));
test('AO10 nested pivots and negative scale include ancestor pivots once',async()=>fixture(f=>{
  const parent=f.sprite();parent.x=10;parent.y=20;parent.scaleX=2;parent.scaleY=3;
  parent.anchorOffsetX=1;parent.anchorOffsetY=2;
  const child=f.sprite(parent);child.x=3;child.y=4;child.scaleX=-1;child.scaleY=2;
  child.anchorOffsetX=2;child.anchorOffsetY=1;rect(child,4,2);
  near(child.localToGlobal(2,1),{x:14,y:26});near(child.localToGlobal(0,0),{x:18,y:20});
  near(child.globalToLocal(14,26),{x:2,y:1});
  near(child.getBounds(),{x:0,y:0,width:4,height:2});
  near(parent.getBounds(),{x:1,y:2,width:4,height:4});
  near(f.engine.stage.getBounds(),{x:10,y:20,width:8,height:12});
  bothMatrices(f.engine,{a:-2,b:0,c:0,d:6,tx:18,ty:20});
}));
test('AO11 rotation around the authored pivot uses bounded floating tolerance',async()=>fixture(f=>{
  const node=f.sprite();node.x=10;node.y=20;node.scaleX=2;node.rotation=90;
  node.anchorOffsetX=4;node.anchorOffsetY=3;rect(node);
  node.touchEnabled=true;node.hitArea={x:0,y:0,width:8,height:6};
  near(node.localToGlobal(4,3),{x:10,y:20});near(node.localToGlobal(0,0),{x:13,y:12});
  near(node.localToGlobal(8,6),{x:7,y:28});near(node.globalToLocal(7,28),{x:8,y:6});
  near(f.engine.stage.getBounds(),{x:7,y:12,width:6,height:16});
  assert.equal(f.engine.stage.hitTest(10,20),node);
  bothMatrices(f.engine,{a:0,b:2,c:-1,d:0,tx:13,ty:12});
}));
test('AO12 local clip and explicit hit region stay coherent with both capture matrices',async()=>fixture(f=>{
  const {child}=handScene(f);child.touchEnabled=true;child.hitArea={x:0,y:0,width:8,height:6};
  child.clipRect={x:0,y:0,width:4,height:6};
  assert.equal(f.engine.stage.hitTest(19,35),child);
  assert.equal(f.engine.stage.hitTest(25,35),undefined);
  assert.equal(f.engine.stage.hitTest(26,35),undefined);
  near(child.getBounds(),{x:0,y:0,width:8,height:6});
  for(const frame of [f.engine.captureFrame(OPTIONS),f.engine.captureTexturedFrame(OPTIONS)]) {
    const command=frame.commands[0];assert.equal(frame.commands.length,1);
    near(command.matrix,{a:2,b:0,c:0,d:1,tx:17,ty:34});
    assert.equal(command.clips.length,1);
    assert.deepEqual(command.clips[0].rect,{x:0,y:0,width:4,height:6});
    near(command.clips[0].matrix,{a:2,b:0,c:0,d:1,tx:17,ty:34});
    assert.ok(Object.isFrozen(command.clips[0]));
  }
}));
test('AO13 Stage pivot participates in world transforms while its bounds stay receiver-local',async()=>fixture(f=>{
  const stage=f.engine.stage;stage.x=10;stage.y=20;stage.scaleX=2;stage.scaleY=3;
  stage.anchorOffsetX=1;stage.anchorOffsetY=2;
  const node=f.sprite();node.x=3;node.y=4;node.anchorOffsetX=1;node.anchorOffsetY=1;rect(node,2,2);
  near(stage.localToGlobal(1,2),{x:10,y:20});near(node.localToGlobal(1,1),{x:14,y:26});
  near(node.getBounds(),{x:0,y:0,width:2,height:2});
  near(stage.getBounds(),{x:2,y:3,width:2,height:2});
  bothMatrices(f.engine,{a:2,b:0,c:0,d:3,tx:12,ty:23});
}));

// Finite storage can overflow later arithmetic. Refusal must publish no frame,
// invoke neither injected renderer, and spend no frame identifier.
test('AO14 extreme finite pivot preserves existing consumer errors and atomic frame publication',async()=>fixture(f=>{
  const parent=f.sprite(),node=f.sprite(parent);rect(node,1,1);node.scaleX=2;
  node.touchEnabled=true;node.hitArea={x:0,y:0,width:1,height:1};
  const before=f.engine.captureFrame(OPTIONS);node.anchorOffsetX=Number.MAX_VALUE;
  assert.equal(node.anchorOffsetX,Number.MAX_VALUE);
  near(node.getBounds(),{x:0,y:0,width:1,height:1});
  code(()=>parent.getBounds(),'BOUNDS_ARITHMETIC_RANGE');
  code(()=>node.localToGlobal(0,0),'COORDINATE_ARITHMETIC_RANGE');
  code(()=>node.globalToLocal(0,0),'COORDINATE_ARITHMETIC_RANGE');
  code(()=>f.engine.stage.hitTest(0,0),'HIT_TEST_ARITHMETIC_RANGE');
  for(const operation of [()=>f.engine.captureFrame(OPTIONS),()=>f.engine.renderFrame(OPTIONS),
    ()=>f.engine.captureTexturedFrame(OPTIONS),()=>f.engine.renderTexturedFrame(OPTIONS)])
    code(operation,'FRAME_TRANSFORM_INVALID');
  assert.equal(f.submitted.length,0);assert.equal(f.textured.length,0);assert.equal(f.diagnostics.length,0);
  node.anchorOffsetX=0;assert.equal(f.engine.captureFrame(OPTIONS).frameId,before.frameId+1);
}));
test('AO15 hidden and zero-alpha suppression retains each existing consumer boundary',async()=>fixture(f=>{
  const node=f.sprite();rect(node,1,1);node.scaleX=2;node.anchorOffsetX=Number.MAX_VALUE;
  node.touchEnabled=true;node.hitArea={x:0,y:0,width:1,height:1};
  node.visible=false;
  assert.equal(f.engine.captureFrame(OPTIONS).commands.length,0);
  assert.equal(f.engine.captureTexturedFrame(OPTIONS).commands.length,0);
  assert.equal(f.engine.stage.hitTest(0,0),undefined);
  code(()=>f.engine.stage.getBounds(),'BOUNDS_ARITHMETIC_RANGE');
  node.visible=true;node.alpha=0;
  assert.equal(f.engine.captureFrame(OPTIONS).commands.length,0);
  assert.equal(f.engine.captureTexturedFrame(OPTIONS).commands.length,0);
  code(()=>f.engine.stage.hitTest(0,0),'HIT_TEST_ARITHMETIC_RANGE');
  code(()=>f.engine.stage.getBounds(),'BOUNDS_ARITHMETIC_RANGE');
  near(node.getBounds(),{x:0,y:0,width:1,height:1});
}));
// Ordinary subclass preflight and public getter shadows are not authority for
// stored visual scalars or synchronous queries/capture. No private hook is called.
test('AO16 genuine scalar accessors and consumers ignore ordinary getter shadows',async()=>fixture(f=>{
  let hooks=0,reads=0,armed=false;
  class ShadowSprite extends egret.Sprite {
    assertUsable(){if(armed){hooks++;throw new Error('ordinary preflight');}super.assertUsable();}
  }
  const node=f.own(new ShadowSprite());f.engine.stage.addChild(node);
  node.x=10;node.y=20;node.scaleX=2;node.anchorOffsetX=4;node.anchorOffsetY=3;rect(node);
  node.touchEnabled=true;node.hitArea={x:0,y:0,width:8,height:6};
  for(const key of ['x','y','scaleX','scaleY','rotation','alpha','visible','anchorOffsetX','anchorOffsetY',
    'clipRect','hitArea','touchEnabled','parent','isDisposed','numChildren'])
    Object.defineProperty(node,key,{configurable:true,get(){reads++;throw new Error('public getter '+key);}});
  armed=true;hooks=0;
  set(f.descriptors,'anchorOffsetX',node,5);
  assert.equal(get(f.descriptors,'anchorOffsetX',node),5);
  assert.equal(get(f.descriptors,'anchorOffsetY',node),3);
  near(node.localToGlobal(5,3),{x:10,y:20});near(node.localToGlobal(0,0),{x:0,y:17});
  near(node.globalToLocal(10,20),{x:5,y:3});near(node.getBounds(),{x:0,y:0,width:8,height:6});
  assert.equal(f.engine.stage.hitTest(2,18),node);
  bothMatrices(f.engine,{a:2,b:0,c:0,d:1,tx:0,ty:17});
  assert.equal(reads,0);assert.equal(hooks,0);
  armed=false;
}));

// Real Scope ownership and a real managed Texture borrow survive offset edits.
// The injected headless port observes an immutable saved value; this is not a
// native replay/pixel result or a new public replay API.
test('AO17 real Scope Bitmap lease events and saved image retain their boundaries',async()=>fixture(async f=>{
  let loads=0,disposals=0,events=0;
  const pixels=[0,0,255,255,0,255,0,255];
  const texture=egret.createTexture(egret.createImageData2D({width:2,height:1,pixels:new Uint8Array(pixels)}));
  f.textures.push(texture);
  const type=egret.createAssetType('anchor-scope-atlas',egret.isTexture);
  f.engine.assets.register(type,{async load(){loads++;return texture;},dispose(value){disposals++;value.dispose();}});
  const lease=f.scope.use(await f.engine.assets.acquire(egret.createAssetRef(type,'atlas')));f.leases.push(lease);
  const bitmap=f.own(new egret.Bitmap(lease));f.engine.stage.addChild(bitmap);
  bitmap.sourceRect={x:0,y:0,width:1,height:1};bitmap.x=8;bitmap.y=8;
  assert.equal(Object.is(bitmap.anchorOffsetX,0),true);assert.equal(Object.is(bitmap.anchorOffsetY,0),true);
  const eventType=egret.createEventType('anchor-no-event');bitmap.on(eventType,()=>{events++;});
  const crop=bitmap.sourceRect,saved=f.engine.captureFrame(OPTIONS),savedCommand=saved.commands[0];
  const savedBytes=matrixBytes(savedCommand.matrix),savedImage=saved.images[0];
  bitmap.scaleX=2;bitmap.anchorOffsetX=1;bitmap.anchorOffsetY=1;
  bothMatrices(f.engine,{a:2,b:0,c:0,d:1,tx:6,ty:7});
  assert.equal(bitmap.textureLease,lease);assert.equal(bitmap.sourceRect,crop);
  assert.equal(lease.value,texture);assert.equal(loads,1);assert.equal(disposals,0);assert.equal(events,0);
  const other=f.engine.createScope();
  try {code(()=>other.use(bitmap),'OWNERSHIP_CONFLICT');} finally {other.dispose();}
  bitmap.dispatchEvent(new egret.Event(eventType,null));assert.equal(events,1);
  assert.ok(Object.isFrozen(saved));assert.ok(Object.isFrozen(savedCommand));
  assert.equal(saved.images[0],savedImage);assert.deepEqual(matrixBytes(savedCommand.matrix),savedBytes);
  f.port.adapter.renderFrame(saved);assert.equal(f.submitted.at(-1),saved);
  f.scope.dispose();
  assert.equal(bitmap.isDisposed,true);assert.equal(f.scope.state,'closed');
  assert.equal(loads,1);assert.equal(disposals,1);assert.equal(texture.isDisposed,true);
  code(()=>lease.value,'ASSET_LEASE_RELEASED');
  assert.equal(bitmap.anchorOffsetX,1);assert.equal(bitmap.anchorOffsetY,1);
  code(()=>{bitmap.anchorOffsetX=2;},'OBJECT_DISPOSED');
  assert.deepEqual([...egret.copyImageData2DPixels(savedImage)],pixels);
  assert.equal(saved.commands[0],savedCommand);assert.deepEqual(matrixBytes(savedCommand.matrix),savedBytes);
}));
