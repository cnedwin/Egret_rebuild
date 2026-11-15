// SPDX-License-Identifier: Apache-2.0
// Graphics smoothing: the band that fades from a shape's edge to nothing, as the triangles a frame carries for it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
async function withStage(run){
 const engine=await egret.createEngine({host:host().adapter}),scope=engine.createScope();
 const sprite=()=>engine.stage.addChild(scope.use(new egret.Sprite()));
 try{await run({sprite,frame:()=>engine.captureSharedFrame({width:400,height:300})});}finally{scope.dispose();await engine.dispose();}
}
const only=frame=>frame.geometries.at(-1);
const near=(actual,expected,tolerance,label)=>assert.ok(Math.abs(actual-expected)<=tolerance,label+': '+actual+' is not within '+tolerance+' of '+expected);
/** The vertices of a geometry: where each is and its alpha. */
const vertices=g=>Array.from({length:g.vertexCount},(_,n)=>({x:g.positions[2*n],y:g.positions[2*n+1],rgb:[...g.lightColors.slice(4*n,4*n+3)],alpha:g.lightColors[4*n+3]}));
const area=g=>{let sum=0;for(let i=0;i<g.indexCount;i+=3){const [a,b,c]=[0,1,2].map(k=>g.indices[i+k]);sum+=Math.abs((g.positions[2*b]-g.positions[2*a])*(g.positions[2*c+1]-g.positions[2*a+1])-(g.positions[2*b+1]-g.positions[2*a+1])*(g.positions[2*c]-g.positions[2*a]))/2;}return sum;};

test('GS01 a smoothed circle has a band one unit wide that fades from its colour to nothing',()=>withStage(({sprite,frame})=>{
 const plain=sprite();plain.graphics.beginFill(0x336699).drawCircle(100,100,20);
 const before=only(frame());
 const node=sprite();assert.equal(node.graphics.smoothing,0);node.graphics.smoothing=1;assert.equal(node.graphics.smoothing,1);
 node.graphics.beginFill(0x336699).drawCircle(100,100,20);
 const g=only(frame()),all=vertices(g),inner=all.filter(v=>v.alpha===1),outer=all.filter(v=>v.alpha===0),n=before.vertexCount;
 assert.equal(inner.length,n);assert.equal(outer.length,n);assert.equal(inner.length+outer.length,all.length);
 // Two triangles of band for each side of the circle, after the fan that fills it.
 assert.equal(g.triangleCount,before.triangleCount+2*n);
 for(const v of inner)near(Math.hypot(v.x-100,v.y-100),20,1e-4,'edge');
 // Where two sides meet the band is a little farther out than its width, so that it is its width along each side.
 const turn=1/Math.cos(Math.PI/n);
 for(const v of outer){near(Math.hypot(v.x-100,v.y-100),20+turn,1e-3,'band');assert.deepEqual(v.rgb,inner[0].rgb);}
 near(area(g)-area(before),n*Math.sin(2*Math.PI/n)/2*((20+turn)**2-400),1e-2,'area of the band');
 const bounds=node.getBounds();near(bounds.x,80-turn,1e-3,'bounds');near(bounds.width,40+2*turn,2e-3,'bounds');
}));

test('GS02 the band turns a square corner, and goes round the inside of a hole',()=>withStage(({sprite,frame})=>{
 const node=sprite();node.graphics.smoothing=2;
 node.graphics.beginFill(0xff0000).moveTo(10,10).lineTo(50,10).lineTo(50,50).lineTo(10,50).lineTo(10,10).moveTo(20,20).lineTo(20,40).lineTo(40,40).lineTo(40,20).lineTo(20,20).endFill();
 const outer=vertices(only(frame())).filter(v=>v.alpha===0),has=(x,y)=>outer.some(v=>Math.abs(v.x-x)<1e-4&&Math.abs(v.y-y)<1e-4);
 for(const [x,y] of [[8,8],[52,8],[52,52],[8,52],[22,22],[22,38],[38,38],[38,22]])assert.ok(has(x,y),'a band corner at '+x+','+y);
 // A side cut where the fill is cut has a band vertex there too: all of them are on the two squares the band ends at.
 const on=(v,low,high)=>(Math.abs(v.x-low)<1e-4||Math.abs(v.x-high)<1e-4)&&v.y>=low-1e-4&&v.y<=high+1e-4||(Math.abs(v.y-low)<1e-4||Math.abs(v.y-high)<1e-4)&&v.x>=low-1e-4&&v.x<=high+1e-4;
 for(const v of outer)assert.ok(on(v,8,52)||on(v,22,38),'a band vertex at '+v.x+','+v.y);
}));

test('GS03 a fill under a line has no band; the line has one on each side',()=>withStage(({sprite,frame})=>{
 const node=sprite();node.graphics.smoothing=1;
 node.graphics.beginFill(0x00ff00).lineStyle(4,0x0000ff).drawCircle(100,100,20);
 const outer=vertices(only(frame())).filter(v=>v.alpha===0),radii=outer.map(v=>Math.hypot(v.x-100,v.y-100));
 assert.ok(outer.length>0);
 for(const r of radii)assert.ok(Math.abs(r-23)<0.05||Math.abs(r-17)<0.05,'a band vertex at radius '+r);
 assert.ok(radii.some(r=>r>22)&&radii.some(r=>r<18));
 // An open line: its band is around all of it, ends as well.
 const line=sprite();line.graphics.smoothing=1;line.graphics.lineStyle(6,0).moveTo(10,200).lineTo(60,200);
 const ends=vertices(only(frame())).filter(v=>v.alpha===0).map(v=>[Math.round(v.x*1e4)/1e4,Math.round(v.y*1e4)/1e4]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 assert.deepEqual(ends,[[9,196],[9,204],[61,196],[61,204]]);
}));

test('GS04 smoothing is off until it is set, takes 0 to 8, and leaves rectangles and image fills as they are',()=>withStage(({sprite,frame})=>{
 const g=sprite().graphics;
 for(const bad of [-1,9,NaN,'1',undefined])assert.throws(()=>{g.smoothing=bad;},coded('GRAPHICS_VALUE_INVALID'));
 assert.equal(g.smoothing,0);
 g.smoothing=1;g.beginFill(0xff0000).drawRect(0,0,10,10);
 const now=frame();
 assert.equal(now.geometries.length,0);assert.equal(now.commands.at(-1).kind,'rect');
 const off=sprite();off.graphics.beginFill(0xff0000).drawCircle(0,0,10);
 assert.ok(vertices(only(frame())).every(v=>v.alpha===1));
 // Shapes drawn before it is set keep their edge; those after have the band.
 const mixed=sprite();mixed.graphics.beginFill(0xff0000).drawCircle(50,50,10);mixed.graphics.smoothing=1;mixed.graphics.drawCircle(150,50,10);
 const faded=vertices(only(frame())).filter(v=>v.alpha===0);
 assert.ok(faded.length>0&&faded.every(v=>v.x>100));
}));

test('GS05 a refined radial gradient feathers only the original fill boundary', () => withStage(({sprite, frame}) => {
  const center = 100, radius = 40;
  const stops = [
    {offset: 0, color: 0xff0000, alpha: 0.5},
    {offset: 128 / 255, color: 0xffffff, alpha: 0.5},
    {offset: 1, color: 0x0000ff, alpha: 0.5},
  ];
  const draw = smoothing => {
    const node = sprite();
    node.graphics.smoothing = smoothing;
    node.graphics.beginRadialGradientFill(center, center, radius, stops).drawCircle(center, center, radius).endFill();
    return only(frame());
  };
  const plain = draw(0), smoothed = draw(2);
  assert.ok(smoothed.triangleCount > plain.triangleCount, 'smoothing still adds an exterior band');
  const faded = vertices(smoothed).filter(vertex => vertex.alpha === 0);
  assert.ok(faded.length > 0);
  for (const vertex of faded) {
    const distance = Math.hypot(vertex.x - center, vertex.y - center);
    assert.ok(distance > radius && distance <= radius + 4, 'feather vertex belongs at the perimeter: ' + distance);
  }
}));
