// SPDX-License-Identifier: Apache-2.0
// Graphics: how a line ends and turns, dashes, fills with holes and crossings by the non-zero rule, and gradients, as
// the coloured triangles a frame carries for them.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
const SIZE={width:400,height:300};
async function withStage(run){
 const engine=await egret.createEngine({host:host().adapter}),scope=engine.createScope();
 const sprite=()=>engine.stage.addChild(scope.use(new egret.Sprite()));
 try{await run({engine,scope,sprite,frame:()=>engine.captureSharedFrame(SIZE)});}finally{scope.dispose();await engine.dispose();}
}
/** The triangles of a geometry with their corners' colours, and the summed area of them, each taken as positive. */
function triangles(geometry){
 const out=[];let area=0;
 for(let i=0;i<geometry.indexCount;i+=3){
  const t=[0,1,2].map(k=>{const n=geometry.indices[i+k];return {x:geometry.positions[2*n],y:geometry.positions[2*n+1],color:[...geometry.lightColors.slice(4*n,4*n+4)]};});
  out.push(t);area+=Math.abs((t[1].x-t[0].x)*(t[2].y-t[0].y)-(t[1].y-t[0].y)*(t[2].x-t[0].x))/2;
 }
 return {list:out,area};
}
/** Whether a point is inside some triangle of a geometry. */
function covers(geometry,x,y){
 return triangles(geometry).list.some(([a,b,c])=>{
  // A sliver of no area, which stored coordinates can make of a very thin triangle, covers nothing.
  if(Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))<1e-4)return false;
  const d1=(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x),d2=(c.x-b.x)*(y-b.y)-(c.y-b.y)*(x-b.x),d3=(a.x-c.x)*(y-c.y)-(a.y-c.y)*(x-c.x);
  return (d1>=0&&d2>=0&&d3>=0)||(d1<=0&&d2<=0&&d3<=0);
 });
}
const near=(actual,expected,tolerance,label)=>assert.ok(Math.abs(actual-expected)<=tolerance,label+': '+actual+' is not within '+tolerance+' of '+expected);
const linear=byte=>{const c=byte/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;};
// A gradient's colour between two bytes is read between the two entries of the written table, within 1e-5 of the curve.
/** The colour between two sRGB colours, mixed as sRGB values, in linear light. */
const mixed=(from,to,f)=>[16,8,0].map(shift=>linear((from>>shift&255)+((to>>shift&255)-(from>>shift&255))*f));
const only=frame=>frame.geometries.at(-1);

test('GF01 an open line ends flat, in a half square or in a half circle',()=>withStage(({sprite,frame})=>{
 const draw=options=>{const node=sprite();node.graphics.lineStyle(4,0,1,options).moveTo(10,20).lineTo(60,20);return node;};
 assert.deepEqual(draw({}).getBounds(),{x:10,y:18,width:50,height:4});
 const square=draw({caps:'square'});
 assert.deepEqual(square.getBounds(),{x:8,y:18,width:54,height:4});
 near(triangles(only(frame())).area,216,1e-4,'square ends');
 const round=draw({caps:'round'}),bounds=round.getBounds();
 near(bounds.x,8,1e-6,'round left');near(bounds.width,54,1e-6,'round width');assert.deepEqual([bounds.y,bounds.height],[18,4]);
 // The line and two half circles of radius 2, drawn as straight pieces just inside them.
 const area=triangles(only(frame())).area;
 assert.ok(area<200+4*Math.PI&&area>200+4*Math.PI-1.5,'round ends '+area);
 // The ends of a closed line are corners, whatever its ends are told to be.
 const closed=sprite();closed.graphics.lineStyle(2,0,1,{caps:'square'}).moveTo(0,0).lineTo(10,0).lineTo(10,10).lineTo(0,10).lineTo(0,0);
 assert.deepEqual(closed.getBounds(),{x:-1,y:-1,width:12,height:12});
}));

test('GF02 a corner is a mitre, an arc or a flat cut, and no piece lies over another',()=>withStage(({sprite,frame})=>{
 const draw=joints=>{const node=sprite();node.graphics.lineStyle(4,0x00ff00,0.5,{joints}).moveTo(10,20).lineTo(60,20).lineTo(60,70);return triangles(only(frame())).area;};
 // The areas of the triangles add up to the area of the line: a translucent line is not darker at its corner.
 near(draw('miter'),400,1e-4,'mitre');
 near(draw('bevel'),398,1e-4,'bevel');
 const round=draw('round');
 assert.ok(round<396+Math.PI&&round>396+2.8,'round corner '+round);
 // A line that turns straight back ends square at the turn, or in a half circle about it.
 const back=sprite();back.graphics.lineStyle(4,0,1,{joints:'round'}).moveTo(0,0).lineTo(20,0).lineTo(5,0);
 near(back.getBounds().x+back.getBounds().width,22,1e-6,'turned back');
 // A closed outline drawn at once takes the corners too.
 const box=sprite();box.graphics.lineStyle(2,0,1,{joints:'bevel'}).beginFill(1).drawRect(0,0,10,10);
 near(triangles(only(frame())).area,100+80-4*0.5,1e-4,'bevelled box');
}));

test('GF03 a dashed line is its dashes, each with its own ends',()=>withStage(({sprite,frame})=>{
 const node=sprite();node.graphics.lineStyle(2,0,1,{dash:[10,5]}).moveTo(0,0).lineTo(100,0);
 let geometry=only(frame());
 // 0–10, 15–25, ... 90–100: seven dashes of two triangles.
 assert.equal(geometry.triangleCount,14);near(triangles(geometry).area,140,1e-4,'dashes');
 assert.ok(covers(geometry,5,0)&&!covers(geometry,12,0)&&covers(geometry,95,0));
 // The pattern runs on round a corner, and an odd count of lengths is taken twice over: 6 on, 6 off.
 const bent=sprite();bent.graphics.lineStyle(2,0,1,{dash:[6]}).moveTo(0,0).lineTo(9,0).lineTo(9,9);
 geometry=only(frame());
 assert.ok(covers(geometry,3,0)&&!covers(geometry,7.5,0)&&!covers(geometry,9,2)&&covers(geometry,9,5));
 // Round ends make dots of dashes of no length.
 const dots=sprite();dots.graphics.lineStyle(4,0,1,{dash:[0,10],caps:'round'}).moveTo(0,0).lineTo(35,0);
 assert.equal(frame().geometries.length,2,'a dash of no length has no direction and is not drawn');
 // Lengths that add up to nothing are no dashes.
 const solid=sprite();solid.graphics.lineStyle(2,0,1,{dash:[0,0]}).moveTo(0,0).lineTo(10,0);
 assert.equal(only(frame()).triangleCount,2);
 // More dashes than a line may have are refused at the point that asks for them, and the path before it stays.
 const many=sprite(),path=many.graphics.lineStyle(1,0,1,{dash:[0.01,0.01]}).moveTo(0,0).lineTo(50,0);
 assert.throws(()=>path.lineTo(5000,0),coded('GRAPHICS_BUDGET'));
 near(many.getBounds().width,50,1e-6,'kept path');
}));

test('GF04 the parts of a path are filled together by the non-zero rule: holes, overlaps and crossings',()=>withStage(({sprite,frame})=>{
 // A square with a square drawn the other way round inside it: a hole.
 const ring=sprite();ring.graphics.beginFill(0xff0000).moveTo(0,0).lineTo(30,0).lineTo(30,30).lineTo(0,30).lineTo(0,0).moveTo(10,10).lineTo(10,20).lineTo(20,20).lineTo(20,10).lineTo(10,10).endFill();
 let geometry=only(frame());
 near(triangles(geometry).area,800,1e-4,'ring');
 assert.ok(covers(geometry,5,5)&&!covers(geometry,15,15)&&covers(geometry,25,15));
 // The inner square drawn the same way round is not a hole, and is not painted twice.
 const full=sprite();full.graphics.beginFill(0xff0000,0.5).moveTo(0,0).lineTo(30,0).lineTo(30,30).lineTo(0,30).moveTo(10,10).lineTo(20,10).lineTo(20,20).lineTo(10,20).endFill();
 near(triangles(only(frame())).area,900,1e-4,'no hole');
 // Two parts that overlap are painted once where they do.
 const two=sprite();two.graphics.beginFill(0,0.5).moveTo(0,0).lineTo(10,0).lineTo(10,10).lineTo(0,10).moveTo(5,5).lineTo(15,5).lineTo(15,15).lineTo(5,15).endFill();
 near(triangles(only(frame())).area,175,1e-4,'union');
 // An outline that crosses itself: a bow tie is its two triangles, and a five-pointed star is filled to its middle.
 const bow=sprite();bow.graphics.beginFill(0).moveTo(0,0).lineTo(10,10).lineTo(10,0).lineTo(0,10).endFill();
 geometry=only(frame());
 near(triangles(geometry).area,50,1e-4,'bow tie');assert.ok(covers(geometry,2,5)&&covers(geometry,8,5)&&!covers(geometry,5,2));
 const star=sprite(),points=[0,2,4,1,3].map(i=>[50*Math.sin(2*Math.PI*i/5),-50*Math.cos(2*Math.PI*i/5)]);
 star.graphics.beginFill(0xffff00).moveTo(...points[0]);for(const point of [...points.slice(1),points[0]])star.graphics.lineTo(...point);star.graphics.endFill();
 geometry=only(frame());
 assert.ok(covers(geometry,0.5,0.5)&&covers(geometry,1,-40)&&!covers(geometry,0.5,45));
 // The area of the star's whole outline: five points on a pentagon of the inner radius.
 const inner=50*Math.sin(Math.PI/10)/Math.sin(3*Math.PI/10)/(2*Math.cos(Math.PI/5))*2*Math.cos(Math.PI/5);
 const expected=5*(0.5*50*inner*Math.sin(Math.PI/5))*2;
 near(triangles(geometry).area,expected,1e-3,'star');
 // Triangles that meet along a band share their corners: every corner on a triangle's side is a corner of it.
 for(const [a,b,c] of triangles(geometry).list)for(const [p,q] of [[a,b],[b,c],[c,a]])for(let n=0;n<geometry.vertexCount;n++){
  const x=geometry.positions[2*n],y=geometry.positions[2*n+1];
  if((x===p.x&&y===p.y)||(x===q.x&&y===q.y)||p.y!==q.y||y!==p.y)continue;
  assert.ok(x<=Math.min(p.x,q.x)||x>=Math.max(p.x,q.x),'a corner lies inside a side');
 }
}));

test('GF05 a gradient is the colours of the corners, mixed as sRGB values and close to it between them',()=>withStage(({sprite,frame})=>{
 const stops=[{offset:0,color:0xff0000},{offset:1,color:0x0000ff,alpha:0.5}];
 const node=sprite();node.graphics.beginLinearGradientFill(20,0,120,0,stops).drawRect(0,0,140,40).endFill();
 const now=frame(),geometry=only(now);
 assert.equal(now.commands[0].kind,'mesh');
 near(triangles(geometry).area,5600,1e-3,'area');
 const want=(x)=>{const f=Math.min(1,Math.max(0,(x-20)/100));return [...mixed(0xff0000,0x0000ff,f),1-0.5*f];};
 for(let n=0;n<geometry.vertexCount;n++){const w=want(geometry.positions[2*n]);for(let k=0;k<4;k++)near(geometry.lightColors[4*n+k],w[k],1e-5,'corner colour');}
 // Between corners the colour a frame mixes stays close to the gradient: within four parts in 255 as an eye sees it.
 assert.ok(geometry.triangleCount>20&&geometry.triangleCount<2000,'triangles '+geometry.triangleCount);
 for(const [a,b,c] of triangles(geometry).list){
  const x=(a.x+b.x+c.x)/3,w=want(x);
  for(let k=0;k<3;k++)near(Math.sqrt((a.color[k]+b.color[k]+c.color[k])/3),Math.sqrt(w[k]),4/255,'colour inside a triangle');
 }
 // Radial: the first colour at the centre, the last on the circle and beyond it.
 const round=sprite();round.graphics.beginRadialGradientFill(50,50,40,[{offset:0,color:0xffffff},{offset:0.5,color:0x00ff00},{offset:1,color:0x000000}]).drawRect(0,0,100,100);
 const radial=only(frame());
 for(let n=0;n<radial.vertexCount;n++){
  const t=Math.min(1,Math.hypot(radial.positions[2*n]-50,radial.positions[2*n+1]-50)/40),w=t<0.5?mixed(0xffffff,0x00ff00,t/0.5):mixed(0x00ff00,0x000000,(t-0.5)/0.5);
  for(let k=0;k<3;k++)near(radial.lightColors[4*n+k],w[k],1e-5,'radial corner');
 }
 assert.ok(radial.triangleCount>100&&radial.triangleCount<=16384,'triangles '+radial.triangleCount);
 // The older call with a matrix that places the gradient's square: the same colours as the two points give.
 const box={a:100/1638.4,b:0,c:0,d:40/1638.4,tx:70,ty:20};
 const old=sprite();old.graphics.beginGradientFill('linear',[0xff0000,0x0000ff],[1,0.5],[0,255],box).drawRect(0,0,140,40);
 const older=only(frame());
 for(let n=0;n<older.vertexCount;n++){const w=want(older.positions[2*n]);for(let k=0;k<4;k++)near(older.lightColors[4*n+k],w[k],1e-5,'older call');}
 const disc=sprite();disc.graphics.beginGradientFill('radial',[0xffffff,0x000000],[1,1],[0,255],{a:80/1638.4,b:0,c:0,d:80/1638.4,tx:50,ty:50}).drawCircle(50,50,40);
 const circle=only(frame());
 for(let n=0;n<circle.vertexCount;n++){const t=Math.min(1,Math.hypot(circle.positions[2*n]-50,circle.positions[2*n+1]-50)/40),w=mixed(0xffffff,0,t);near(circle.lightColors[4*n],w[0],1e-5,'older radial');}
 // A gradient fills a path with a hole like any fill, and a line keeps its own colour.
 const ring=sprite();ring.graphics.beginLinearGradientFill(0,0,30,0,stops).lineStyle(2,0x00ff00).moveTo(0,0).lineTo(30,0).lineTo(30,30).lineTo(0,30).lineTo(0,0).moveTo(10,10).lineTo(10,20).lineTo(20,20).lineTo(20,10).lineTo(10,10).endFill();
 assert.ok(!covers(only(frame()),15,15));
}));

test('GF06 what is not a line style or a gradient is refused',()=>withStage(({sprite})=>{
 const g=sprite().graphics,stops=[{offset:0,color:0},{offset:1,color:1}];
 for(const bad of [()=>g.lineStyle(1,0,1,{caps:'butt'}),()=>g.lineStyle(1,0,1,{joints:'sharp'}),()=>g.lineStyle(1,0,1,{miterLimit:0.5}),()=>g.lineStyle(1,0,1,{miterLimit:NaN}),()=>g.lineStyle(1,0,1,{dash:[1,-1]}),
  ()=>g.lineStyle(1,0,1,{dash:'5'}),()=>g.lineStyle(1,0,1,{dash:new Array(17).fill(1)}),()=>g.lineStyle(1,0,1,null),
  ()=>g.beginLinearGradientFill(0,0,0,0,stops),()=>g.beginLinearGradientFill(0,0,NaN,0,stops),()=>g.beginLinearGradientFill(0,0,1,0,[stops[0]]),()=>g.beginLinearGradientFill(0,0,1,0,[stops[1],stops[0]]),
  ()=>g.beginLinearGradientFill(0,0,1,0,[{offset:0,color:-1},stops[1]]),()=>g.beginLinearGradientFill(0,0,1,0,[{offset:0,color:0,alpha:2},stops[1]]),()=>g.beginLinearGradientFill(0,0,1,0,new Array(17).fill(stops[0])),
  ()=>g.beginRadialGradientFill(0,0,0,stops),()=>g.beginRadialGradientFill(0,0,1,stops,-1),()=>g.beginRadialGradientFill(0,0,1,'stops'),
  ()=>g.beginGradientFill('conic',[0,1],[1,1],[0,255]),()=>g.beginGradientFill('linear',[0,1],[1],[0,255]),()=>g.beginGradientFill('linear',[0,1],[1,1],[0,256]),
  ()=>g.beginGradientFill('linear',[0,1],[1,1],[0,255],{a:1,b:1,c:1,d:1,tx:0,ty:0}),()=>g.beginGradientFill('linear',[0,1],[1,1],[255,0])])
  assert.throws(bad,coded('GRAPHICS_VALUE_INVALID'));
 // A refused call leaves the fill and the line as they were.
 assert.throws(()=>g.drawRect(0,0,1,1),coded('GRAPHICS_FILL_REQUIRED'));
}));

test('GF07 an image is a fill: its own mesh in drawing order, over the image as a page that repeats',()=>withStage(async({engine,scope,sprite,frame})=>{
 const type=egret.createAssetType('graphics-fill-image',egret.isTexture);
 const texture=egret.createTexture(egret.createImageData2D({width:8,height:4,pixels:new Uint8Array(128).fill(200)}));
 engine.assets.register(type,{async load(){return texture;},dispose(value){value.dispose();}});
 try{
  const lease=scope.use(await engine.assets.acquire(egret.createAssetRef(type,'tile'),{signal:scope.signal}));
  // A red square, then a rectangle of the image with a line, then a blue square: three meshes, in that order.
  const node=sprite();
  node.graphics.beginFill(0xff0000).drawRect(0,0,10,10).beginBitmapFill(lease).lineStyle(2,0x00ff00).drawRect(20,0,16,8).lineStyle().beginFill(0x0000ff).drawRect(40,0,10,10).endFill();
  const now=frame(),meshes=now.commands.filter(command=>command.kind==='mesh');
  // The red square; the image; then its line and the blue square together, since both are over the white pixel.
  assert.equal(meshes.length,3);
  const [red,image,rest]=meshes.map(command=>({geometry:now.geometries[command.geometryIndex],region:now.regions[command.regionIndex],material:now.materials[command.materialIndex]}));
  assert.deepEqual([red.geometry.triangleCount,image.geometry.triangleCount,rest.geometry.triangleCount],[2,2,16+2]);
  // The image's mesh samples the image itself, as a whole page that repeats; the others the one white pixel.
  assert.equal(now.pages[image.region.pageIndex].source.width,8);
  assert.equal(now.pages[red.region.pageIndex].source.width,1);assert.equal(red.region.pageIndex,rest.region.pageIndex);
  assert.deepEqual([image.material.samplingDomain,image.material.addressU,image.material.addressV],['page','repeat','repeat']);
  assert.equal(red.material.samplingDomain,'region');
  // Where each corner is in the image: one unit is one pixel, so 16 by 8 units from (20, 0) is 2.5 to 4.5 and 0 to 2 times across it.
  const corners=[];for(let n=0;n<4;n++)corners.push([image.geometry.positions[2*n],image.geometry.positions[2*n+1],image.geometry.uvs[2*n],image.geometry.uvs[2*n+1]]);
  assert.deepEqual(corners,[[20,0,2.5,0],[36,0,4.5,0],[36,8,4.5,2],[20,8,2.5,2]]);
  for(let n=0;n<4;n++)assert.deepEqual([...image.geometry.lightColors.slice(4*n,4*n+4)],[1,1,1,1]);
  assert.deepEqual(node.getBounds(),{x:0,y:-1,width:50,height:11});
  // A matrix places the image: twice the size, starting at (20, 0), so the same rectangle is once across it and held at its edge.
  const placed=sprite();placed.graphics.beginBitmapFill(lease,{a:2,b:0,c:0,d:2,tx:20,ty:0},false).drawRect(20,0,16,8).endFill();
  const second=frame(),command=second.commands.filter(c=>c.kind==='mesh').at(-1),geometry=second.geometries[command.geometryIndex];
  assert.deepEqual([...geometry.uvs],[0,0,1,0,1,1,0,1]);
  assert.deepEqual([second.materials[command.materialIndex].addressU,second.materials[command.materialIndex].samplingDomain],['clamp-to-edge','page']);
  // The node's blend mode is the image's too.
  placed.blendMode='add';
  const third=frame();
  assert.notEqual(third.materials[third.commands.filter(c=>c.kind==='mesh').at(-1).materialIndex].blend,second.materials[command.materialIndex].blend);
  // A path with a hole is filled with an image like with a colour.
  const ring=sprite();ring.graphics.beginBitmapFill(lease).moveTo(0,20).lineTo(30,20).lineTo(30,50).lineTo(0,50).lineTo(0,20).moveTo(10,30).lineTo(10,40).lineTo(20,40).lineTo(20,30).lineTo(10,30).endFill();
  const holed=only(frame());near(triangles(holed).area,800,1e-4,'image ring');assert.ok(!covers(holed,15,35));
  // What is not an image, a part of an atlas, or a matrix that cannot be turned back is refused; so is an image repeated too far.
  const g=sprite().graphics;
  for(const bad of [()=>g.beginBitmapFill(texture),()=>g.beginBitmapFill({}),()=>g.beginBitmapFill(lease,{a:0,b:0,c:0,d:0,tx:0,ty:0}),()=>g.beginBitmapFill(lease,{a:1,b:0,c:0,d:NaN,tx:0,ty:0}),()=>g.beginBitmapFill(lease,undefined,'yes')])
   assert.throws(bad,coded('GRAPHICS_VALUE_INVALID'));
  g.beginBitmapFill(lease);
  assert.throws(()=>g.drawRect(0,0,9000,4),coded('GRAPHICS_BUDGET'));
  g.drawRect(0,0,8000,4);
  // More different fills in turn than a node has batches for are refused, and the node keeps what it had.
  const many=sprite().graphics;
  let refusedAt=-1;
  for(let i=0;i<40&&refusedAt<0;i++)try{if(i%2===0)many.beginFill(1);else many.beginBitmapFill(lease);many.drawRect(i,0,1,1);}catch(error){assert.equal(error.code,'GRAPHICS_BUDGET');refusedAt=i;}
  assert.equal(refusedAt,16);
  assert.equal(frame().commands.filter(c=>c.kind==='mesh').length>=16,true);
  // A drawing whose lease was released is not drawn: the frame is refused.
  lease.release();
  assert.throws(frame,error=>typeof error?.code==='string');
  try{frame();}catch(error){assert.match(error.code,/LEASE|TEXTURE/);}
 }finally{if(!texture.isDisposed)texture.dispose();}
}));
