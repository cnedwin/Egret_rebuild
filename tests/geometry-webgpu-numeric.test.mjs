import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, Sprite } from '@egret/engine';
import { copyFrame2D } from '../packages/engine/dist/rendering/copyFrame2D.js';
import { prepareRectangles2D } from '../packages/engine/dist/rendering/prepareRectangles2D.js';
import { packWebGPUVertices } from '../packages/engine/dist/web/webgpuPass.js';

const copyOptions = {pixelRatio:1,maxBackingPixels:16777216,maxCommands:65536,maxClipRectangles:262144};
const prepareOptions = {pixelRatio:1,maxPreparedVertices:1048576,maxClipEdgeTests:4194304};
const packingLimits = {maxUploadBytes:33554432,maxBufferSize:268435456};
function prepare(frame) {
  const copied = copyFrame2D(frame,copyOptions);
  return {copied,prepared:prepareRectangles2D(copied.frame,copied.width,copied.height,prepareOptions)};
}
function bits(value) {
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0,value);
  return view.getBigUint64(0).toString(16);
}
function pointBits(prepared) {
  return prepared.points.map(({x,y})=>[bits(x),bits(y)]).sort();
}

test('canonical endpoint-rounded crossing survives production preparation in either traversal',()=>{
  // Exact captured witness; the small determinant is a quarter ULP at 480.
  const P=[4,16], Q=[15.999999999999998,28];
  const u=480, v=2**-46, sum=u+v, t=u/sum, s=v/sum;
  assert.equal(t,1); assert.ok(s>0 && s<=0.5);
  assert.deepEqual([Q[0]+s*(P[0]-Q[0]),Q[1]+s*(P[1]-Q[1])],Q);
  const clip={matrix:{a:2**-47,b:-40,c:20,d:0,tx:15.999999999999996,ty:36},rect:{x:0,y:0,width:1,height:1}};
  const matrices=[
    {a:11.999999999999998,b:12,c:12,d:-12,tx:4,ty:16},
    {a:12,b:-12,c:11.999999999999998,d:12,tx:4,ty:16},
  ];
  const results=matrices.map(matrix=>prepare({frameId:1,width:48,height:40,clearColor:0,clearAlpha:0,commands:[{kind:'rect',matrix,rect:{x:0,y:0,width:1,height:1},color:0x00ff00,alpha:1,clips:[clip]}]}).prepared);
  for (const result of results) {
    assert.equal(result.commands.length,1);
    assert.ok(result.points.some(({x,y})=>Object.is(x,Q[0]) && Object.is(y,Q[1])));
    assert.equal(new Set(result.points.map(({x,y})=>`${bits(x)}:${bits(y)}`)).size,result.points.length);
  }
  assert.deepEqual(pointBits(results[0]),pointBits(results[1]));
});

test('unchanged full F4 immutable public capture prepares and packs both commands',async t=>{
  const engine=await createEngine({host:{surface:{},setTimeout(callback,delay){const timer=setTimeout(callback,delay);return ()=>clearTimeout(timer);},close(){}}});
  try {
    // Literal independent F4 hierarchy, including its unclipped blue sibling.
    const outer=engine.stage.addChild(new Sprite()); outer.x=16;outer.y=16;outer.rotation=90;outer.clipRect={x:-12,y:-12,width:24,height:24};
    const diamond=outer.addChild(new Sprite());diamond.rotation=-45;diamond.scaleX=Math.SQRT2;diamond.scaleY=Math.SQRT2;diamond.clipRect={x:-6,y:-6,width:12,height:12};
    const half=diamond.addChild(new Sprite());half.rotation=-45;half.scaleX=1/Math.SQRT2;half.scaleY=1/Math.SQRT2;half.clipRect={x:0,y:-20,width:20,height:40};
    half.addChild(new Sprite()).graphics.beginFill(0x00ff00).drawRect(-20,-20,40,40);
    engine.stage.addChild(new Sprite()).graphics.beginFill(0x0000ff).drawRect(32,4,8,8);
    const frame=engine.captureFrame({width:48,height:40,clearColor:0,clearAlpha:0});
    assert.ok(Object.isFrozen(frame) && Object.isFrozen(frame.commands) && Object.isFrozen(frame.commands[0].clips));
    assert.deepEqual(frame.commands.map(c=>[c.color,c.alpha,c.clips.length]),[[0x00ff00,1,3],[0x0000ff,1,0]]);
    const {copied,prepared}=prepare(frame);
    assert.deepEqual(prepared.commands.map(c=>[c.color,c.alpha]),[[0x00ff00,1],[0x0000ff,1]]);
    assert.ok(prepared.commands.every(c=>c.pointIndices.length>=3));
    const packed=packWebGPUVertices(prepared,copied.width,copied.height,packingLimits);
    assert.equal(packed.ranges.length,2);assert.ok(packed.ranges.every(r=>r.vertexCount>0));
    assert.equal(packed.ranges[0].firstVertex,0);
    assert.equal(packed.ranges[1].firstVertex,packed.ranges[0].vertexCount);
    assert.equal(packed.data.byteLength,packed.ranges.reduce((n,r)=>n+r.vertexCount,0)*24);
    assert.ok(Number.isFinite(packed.maxBackingDisplacement));
    t.diagnostic(JSON.stringify({fixture:'unchanged-public-F4',frame,prepared,packing:{bytes:packed.data.byteLength,ranges:packed.ranges,collapsedTriangles:packed.collapsedTriangles,maxBackingDisplacement:packed.maxBackingDisplacement},scope:'CPU preparation/production packing only; no pixel oracle derived from these outputs'}));
  } finally { await engine.dispose(); }
});

test('strict-interior rational crossing bits survive reversed and repeated clipping',()=>{
  const forward={matrix:{a:12,b:-4,c:-3,d:-9,tx:-8,ty:4},rect:{x:0,y:0,width:1,height:1}};
  const reversed={matrix:{a:-3,b:-9,c:12,d:-4,tx:-8,ty:4},rect:{x:0,y:0,width:1,height:1}};
  // Binary64 representations of 0, 2, 2/3 and 4/3 are independent literals.
  const expected=[['0','0'],['4000000000000000','0'],['4000000000000000','3fe5555555555555'],['0','3ff5555555555555']].sort();
  for (const clips of [[forward],[reversed],[forward,reversed,forward]]) {
    const {prepared}=prepare({frameId:1,width:16,height:16,clearColor:0,clearAlpha:0,commands:[{kind:'rect',matrix:{a:1,b:0,c:0,d:1,tx:0,ty:0},rect:{x:0,y:0,width:2,height:2},color:1,alpha:1,clips}]});
    assert.deepEqual(pointBits(prepared),expected);
  }
});
