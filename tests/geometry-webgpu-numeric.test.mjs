import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, Sprite } from '@egret/engine';
import { copyFrame2D } from '../packages/engine/dist/rendering/copyFrame2D.js';
import { prepareRectangles2D, Preparation, GeometryPreparationError } from '../packages/engine/dist/rendering/prepareRectangles2D.js';
import { TexturedPreparationBudget2D } from '../packages/engine/dist/rendering/texturedPreparationBudget2D.js';
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

// Private geometry UNIT: preserve observable corner validation, arithmetic and ledger order.
const cornerInitialReads = ['input.matrix', 'input.rect', 'options.pixelRatio',
  'm.a', 'm.b', 'm.c', 'm.d', 'm.tx', 'm.ty', 'r.x', 'r.y', 'r.width', 'r.height'];
const cornerExtentReads = ['r.x', 'r.width', 'r.y', 'r.height'];
const cornerPairReads = ['r.x', 'r.y', 'r.y', 'r.x'];
const cornerPointReads = ['m.a', 'm.c', 'm.tx', 'm.b', 'm.d', 'm.ty'];
function observedCornerInput(valueForRead = (_name, _count, value) => value, values = {}) {
  const trace = [], counts = new Map();
  const observe = (name, value) => {
    trace.push(name);
    const count = (counts.get(name) ?? 0) + 1; counts.set(name, count);
    return valueForRead(name, count, value);
  };
  const fields = (prefix, defaults) => Object.fromEntries(Object.entries(defaults).map(([name, value]) =>
    [name, { enumerable: true, get: () => observe(prefix + name, values[prefix + name] ?? value) }]));
  const matrix = Object.defineProperties({}, fields('m.', { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }));
  const rectangle = Object.defineProperties({}, fields('r.', { x: 0, y: 0, width: 2, height: 2 }));
  const input = { get matrix() { return observe('input.matrix', matrix); }, get rect() { return observe('input.rect', rectangle); } };
  const options = { ...prepareOptions, get pixelRatio() { return observe('options.pixelRatio', 1); } };
  return { input, options, trace };
}
function cornerBudget(overrides = {}) {
  return new TexturedPreparationBudget2D({ maxSourceTriangles: 65536, maxPreparedVertices: 1048576,
    maxClipEdgeTests: 4194304, maxTupleComparisons: 1048576, ...overrides });
}
const emptyCornerBudget = { sourceTrianglesCharged: 0, preparedVerticesCharged: 0, predicatesCharged: 0, tupleComparisonsCharged: 0 };

test('corner preparation preserves the complete getter sequence and one actual predicate charge', () => {
  const fixture = observedCornerInput(), budget = cornerBudget();
  const preparation = new Preparation(fixture.options, budget);
  assert.deepEqual(preparation.corners(fixture.input), [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }]);
  assert.deepEqual(fixture.trace, [...cornerInitialReads, ...cornerExtentReads, ...cornerPairReads,
    ...cornerPointReads, ...cornerPointReads, ...cornerPointReads, ...cornerPointReads,
    'm.a', 'm.b', 'm.c', 'm.d', 'r.width', 'r.height']);
  assert.equal(preparation.edgeTests, 1);
  assert.deepEqual(budget.snapshot(), { ...emptyCornerBudget, predicatesCharged: 1 });
});

test('corner validation captures every initial field before rejecting an earlier nonfinite value', () => {
  const marker = new Error('last initial field getter');
  const fixture = observedCornerInput((name, _count, value) => {
    if (name === 'm.a') return NaN;
    if (name === 'r.height') throw marker;
    return value;
  });
  const budget = cornerBudget(), preparation = new Preparation(fixture.options, budget);
  assert.throws(() => preparation.corners(fixture.input), error => error === marker);
  assert.deepEqual(fixture.trace, cornerInitialReads);
  assert.equal(preparation.edgeTests, 0); assert.deepEqual(budget.snapshot(), emptyCornerBudget);
});

test('corner pair getters are all captured before the first transformed coordinate is evaluated', () => {
  const pairError = new Error('last pair getter'), arithmeticError = new Error('first point matrix getter');
  const fixture = observedCornerInput((name, count, value) => {
    if (name === 'r.x' && count === 4) throw pairError;
    if (name === 'm.a' && count === 2) throw arithmeticError;
    return value;
  });
  const budget = cornerBudget(), preparation = new Preparation(fixture.options, budget);
  assert.throws(() => preparation.corners(fixture.input), error => error === pairError);
  assert.deepEqual(fixture.trace, [...cornerInitialReads, ...cornerExtentReads, ...cornerPairReads]);
  assert.equal(preparation.edgeTests, 0); assert.deepEqual(budget.snapshot(), emptyCornerBudget);
});

test('corner arithmetic rereads matrix fields and uses the original captured pair values', () => {
  const fixture = observedCornerInput((name, count, value) => {
    if (name === 'm.a') return count;
    if (name === 'r.x') return [0, 0, 1, 4][count - 1];
    if (name === 'r.y') return [0, 0, 2, 3][count - 1];
    return value;
  });
  const budget = cornerBudget();
  assert.deepEqual(new Preparation(fixture.options, budget).corners(fixture.input),
    [{ x: 2, y: 2 }, { x: 6, y: 3 }, { x: 8, y: 2 }, { x: 20, y: 2 }]);
  assert.deepEqual(budget.snapshot(), { ...emptyCornerBudget, predicatesCharged: 1 });
});

test('corner intermediate multiplication range failures precede later matrix getters and budget charges', () => {
  for (const values of [{ 'm.a': 2 ** 20, 'r.x': 2, 'm.tx': -(2 ** 20) },
    { 'm.a': 2 ** -100, 'r.x': 0.5, 'm.tx': 1 }]) {
    const fixture = observedCornerInput(undefined, values), budget = cornerBudget();
    const preparation = new Preparation(fixture.options, budget);
    assert.throws(() => preparation.corners(fixture.input), error => error instanceof GeometryPreparationError && error.reason === 'range');
    assert.deepEqual(fixture.trace, [...cornerInitialReads, ...cornerExtentReads, ...cornerPairReads, 'm.a']);
    assert.equal(preparation.edgeTests, 0); assert.deepEqual(budget.snapshot(), emptyCornerBudget);
  }
});

test('zero-size corners still perform determinant budget admission before returning empty', () => {
  const fixture = observedCornerInput(undefined, { 'r.width': 0 });
  const budget = cornerBudget({ maxClipEdgeTests: 1 }); budget.admitPredicate();
  const preparation = new Preparation(fixture.options, budget);
  assert.throws(() => preparation.corners(fixture.input), error => error instanceof GeometryPreparationError && error.reason === 'budget');
  assert.deepEqual(fixture.trace, [...cornerInitialReads, ...cornerExtentReads, ...cornerPairReads,
    ...cornerPointReads, ...cornerPointReads, ...cornerPointReads, ...cornerPointReads, 'm.a', 'm.b', 'm.c', 'm.d']);
  assert.equal(preparation.edgeTests, 0);
  assert.deepEqual(budget.snapshot(), { ...emptyCornerBudget, predicatesCharged: 1 });
  const singularBudget = cornerBudget(), singular = observedCornerInput(undefined, { 'm.a': 0 });
  assert.deepEqual(new Preparation(singular.options, singularBudget).corners(singular.input), []);
  assert.deepEqual(singularBudget.snapshot(), { ...emptyCornerBudget, predicatesCharged: 1 });
});

test('corner reflection and shear retain independent binary64 coordinates and canonical positive zero', () => {
  const budget = cornerBudget(), preparation = new Preparation(prepareOptions, budget);
  const points = preparation.corners({ matrix: { a: -1, b: 0, c: 0.5, d: 1, tx: 0, ty: -0 },
    rect: { x: -0, y: -0, width: 2, height: 3 } });
  assert.deepEqual(points.map(({ x, y }) => [bits(x), bits(y)]), [
    ['0', '0'], ['c000000000000000', '0'], ['bfe0000000000000', '4008000000000000'],
    ['3ff8000000000000', '4008000000000000'],
  ]);
  assert.equal(preparation.edgeTests, 1);
  assert.deepEqual(budget.snapshot(), { ...emptyCornerBudget, predicatesCharged: 1 });
});
