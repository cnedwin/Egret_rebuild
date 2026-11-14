// SPDX-License-Identifier: Apache-2.0
// Graphics beyond filled rectangles: circles, ellipses, rounded rectangles, paths, curves and lines, as the coloured
// triangles a frame carries for them.
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
/** The triangles of a geometry as [[x,y],[x,y],[x,y]] and the summed area of them, each taken as positive. */
function triangles(geometry){
 const out=[];let area=0;
 for(let i=0;i<geometry.indexCount;i+=3){
  const t=[0,1,2].map(k=>{const n=geometry.indices[i+k];return [geometry.positions[2*n],geometry.positions[2*n+1]];});
  out.push(t);area+=Math.abs((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]))/2;
 }
 return {list:out,area};
}
const near=(actual,expected,tolerance,label)=>assert.ok(Math.abs(actual-expected)<=tolerance,label+': '+actual+' is not within '+tolerance+' of '+expected);
const linear=byte=>{const c=byte/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;};

test('GS01 filled rectangles alone stay rectangles: no geometry and no page',()=>withStage(({sprite,frame})=>{
 sprite().graphics.beginFill(0x336699).drawRect(0,0,10,10).drawRect(20,0,10,10).endFill();
 const now=frame();
 assert.deepEqual([now.commands.map(c=>c.kind),now.geometries.length,now.pages.length],[['rect','rect'],0,0]);
}));

test('GS02 a circle is one mesh of triangles within a quarter unit of it, in its colour, over one white pixel',()=>withStage(({sprite,frame})=>{
 const node=sprite();node.graphics.beginFill(0xff8040,0.5).drawCircle(100,80,40).endFill();
 const now=frame(),command=now.commands[0],geometry=now.geometries[0];
 assert.deepEqual([now.commands.length,command.kind,now.geometries.length,now.pages.length,now.regions.length],[1,'mesh',1,1,1]);
 assert.deepEqual([now.pages[0].source.width,now.pages[0].source.height,[...egret.copyImageData2DPixels(now.pages[0].source)]],[1,1,[255,255,255,255]]);
 for(let n=0;n<geometry.vertexCount;n++){
  near(Math.hypot(geometry.positions[2*n]-100,geometry.positions[2*n+1]-80),40,1e-5,'on the circle');
  assert.deepEqual([geometry.uvs[2*n],geometry.uvs[2*n+1]],[0.5,0.5]);
  near(geometry.lightColors[4*n],linear(0xff),1e-7,'red');near(geometry.lightColors[4*n+1],linear(0x80),1e-7,'green');near(geometry.lightColors[4*n+2],linear(0x40),1e-7,'blue');
  assert.equal(geometry.lightColors[4*n+3],0.5);
 }
 // The straight pieces are inside the circle by at most a quarter unit: the area is short of the disc's by under 1.3%.
 const {area}=triangles(geometry),disc=Math.PI*1600;
 assert.ok(area<disc&&area>disc*0.987,'area '+area);
 assert.equal(geometry.triangleCount,geometry.vertexCount-2);
 assert.deepEqual(node.getBounds(),{x:60,y:40,width:80,height:80});
 // A larger circle has more pieces; a tiny one has eight.
 const big=sprite();big.graphics.beginFill(1).drawCircle(0,0,300);const small=sprite();small.graphics.beginFill(1).drawCircle(0,0,0.2);
 const again=frame();
 assert.ok(again.geometries[1].vertexCount>geometry.vertexCount&&again.geometries[1].vertexCount<=128);
 assert.equal(again.geometries[2].vertexCount,8);
}));

test('GS03 a line has a width, flat ends and mitred corners, and is drawn without an endFill',()=>withStage(({sprite,frame})=>{
 const node=sprite();node.graphics.lineStyle(4,0x00ff00,0.5).moveTo(10,20).lineTo(60,20);
 let geometry=frame().geometries[0];
 const corners=g=>{const out=[];for(let i=0;i<g.vertexCount;i++)out.push(g.positions[2*i]+','+g.positions[2*i+1]);return out.sort();};
 assert.deepEqual(corners(geometry),['10,18','10,22','60,18','60,22']);
 assert.equal(geometry.triangleCount,2);near(triangles(geometry).area,200,1e-4,'line area');
 assert.deepEqual(node.getBounds(),{x:10,y:18,width:50,height:4});
 // The path goes on from where it is. The two pieces meet in one point inside the corner and a mitre outside it, and
 // no triangle lies over another: their areas add up to the area of the line.
 node.graphics.lineTo(60,70);
 geometry=frame().geometries[0];
 assert.deepEqual(corners(geometry),['10,18','10,22','58,22','58,70','60,18','62,18','62,20','62,70']);
 assert.equal(geometry.triangleCount,6);near(triangles(geometry).area,400,1e-4,'cornered line area');
 // A path whose ends meet is closed: every corner is mitred and no end is flat.
 const box=sprite();box.graphics.lineStyle(2,0xffffff).moveTo(0,0).lineTo(10,0).lineTo(10,10).lineTo(0,10).lineTo(0,0);
 geometry=frame().geometries[1];
 assert.deepEqual([geometry.vertexCount,geometry.triangleCount],[16,16]);near(triangles(geometry).area,80,1e-4,'box line area');
 assert.deepEqual(box.getBounds(),{x:-1,y:-1,width:12,height:12});
 // A corner whose mitre would be longer than four half-widths is cut flat: nothing is farther from it than a half-width.
 const sharp=sprite();sharp.graphics.lineStyle(2,0).moveTo(0,0).lineTo(100,0).lineTo(0,1);
 near(sharp.getBounds().x+sharp.getBounds().width,100.01,1e-3,'bevelled corner');
 // With a limit that admits it, the mitre is drawn out to its point.
 const pointed=sprite();pointed.graphics.lineStyle(2,0,1,{miterLimit:1000}).moveTo(0,0).lineTo(100,0).lineTo(0,1);
 assert.ok(pointed.getBounds().x+pointed.getBounds().width>250);
 sharp.graphics.clear();pointed.graphics.clear();
 // No width ends the line.
 const none=sprite();none.graphics.lineStyle(3,0).lineStyle().beginFill(1).drawRect(0,0,4,4);
 assert.equal(frame().commands.at(-1).kind,'rect');
}));

test('GS04 shapes are drawn in order in one mesh, and rectangles drawn before them join it',()=>withStage(({sprite,frame})=>{
 const node=sprite();
 node.graphics.beginFill(0xff0000).drawRect(0,0,10,10);
 assert.equal(frame().commands[0].kind,'rect');
 node.graphics.beginFill(0x0000ff).drawCircle(5,5,3).beginFill(0x00ff00).drawRect(2,2,2,2).endFill();
 const now=frame(),geometry=now.geometries[0];
 assert.deepEqual([now.commands.map(c=>c.kind),now.geometries.length],[['mesh'],1]);
 // First the red rectangle's two triangles, last the green one's.
 assert.deepEqual([...geometry.positions.slice(0,8)],[0,0,10,0,10,10,0,10]);
 assert.deepEqual([...geometry.indices.slice(0,6)],[0,1,2,0,2,3]);
 const last=geometry.vertexCount-4;
 assert.deepEqual([...geometry.positions.slice(2*last)],[2,2,4,2,4,4,2,4]);
 assert.deepEqual([...geometry.indices.slice(-6)],[last,last+1,last+2,last,last+2,last+3]);
 near(geometry.lightColors[0],1,0,'red first');near(geometry.lightColors[4*last+1],1,0,'green last');
 // A fill and a line on one shape: the fill's triangles, then the line's.
 const both=sprite();both.graphics.beginFill(0x202020).lineStyle(2,0xffffff).drawRect(0,0,10,10);
 const g=frame().geometries[1];
 assert.deepEqual([g.vertexCount,g.triangleCount],[20,18]);
 // clear returns the node to nothing, and to rectangles.
 node.graphics.clear();both.graphics.clear();
 assert.deepEqual([frame().commands.length,node.getBounds()],[0,{x:0,y:0,width:0,height:0}]);
 node.graphics.beginFill(1).drawRect(0,0,1,1);assert.equal(frame().commands[0].kind,'rect');
}));

test('GS05 the same drawing on many nodes is one geometry; a frame takes thousands of different ones, up to its triangles',()=>withStage(({engine,scope,sprite,frame})=>{
 const nodes=[];
 for(let i=0;i<300;i++){const node=sprite();node.x=i;node.graphics.beginFill(0xffcc00).drawCircle(0,0,6).endFill();nodes.push(node);}
 let now=frame();
 assert.deepEqual([now.commands.length,now.geometries.length,new Set(now.commands.map(c=>c.geometryIndex)).size],[300,1,1]);
 // 127 more drawings, each its own.
 for(let i=1;i<=127;i++){nodes[i].graphics.clear();nodes[i].graphics.beginFill(0xffcc00).drawCircle(0,0,6+i).endFill();}
 now=frame();assert.equal(now.geometries.length,128);
 // A 129th different drawing is drawn like the others: what a frame holds is counted in triangles.
 nodes[128].graphics.clear();nodes[128].graphics.beginFill(0xffcc00).drawCircle(0,0,500).endFill();
 now=frame();assert.equal(now.geometries.length,129);
 // 65,536 triangles in all: 600 more circles of 126 triangles each do not fit.
 for(let i=0;i<600;i++){const node=sprite();node.graphics.beginFill(1).drawCircle(0,0,600+i).endFill();}
 assert.throws(frame,coded('FRAME_BUDGET_EXCEEDED'));
 void engine;void scope;
}));

test('GS06 a path is filled as a closed outline, concave or not, and so is each of its parts',()=>withStage(({sprite,frame})=>{
 // An arrow head: concave at (20,20). Its area is 1200 by the shoelace sum.
 const node=sprite();node.graphics.beginFill(0x8040c0).moveTo(0,0).lineTo(40,0).lineTo(40,40).lineTo(20,20).lineTo(0,40).endFill();
 let {list,area}=triangles(frame().geometries[0]);
 assert.equal(area,1200);
 // Every triangle lies inside the outline: none covers the notch at (20,35).
 const covers=([a,b,c],x,y)=>{const s=(p,q)=>(q[0]-p[0])*(y-p[1])-(q[1]-p[1])*(x-p[0]);const d=[s(a,b),s(b,c),s(c,a)];return d.every(v=>v>=0)||d.every(v=>v<=0);};
 assert.equal(list.some(t=>covers(t,20,35)),false);assert.equal(list.some(t=>covers(t,5,30)),true);
 // The same outline the other way round fills the same.
 const back=sprite();back.graphics.beginFill(1).moveTo(0,40).lineTo(20,20).lineTo(40,40).lineTo(40,0).lineTo(0,0).endFill();
 assert.equal(triangles(frame().geometries[1]).area,1200);
 // Two parts of one path are two outlines.
 const two=sprite();two.graphics.beginFill(1).moveTo(0,0).lineTo(10,0).lineTo(0,10).moveTo(100,0).lineTo(110,0).lineTo(100,10).endFill();
 ({list,area}=triangles(frame().geometries[2]));assert.deepEqual([list.length,area],[2,100]);
 // A path begun without moveTo begins at the origin; fewer than three points fill nothing.
 const origin=sprite();origin.graphics.beginFill(1).lineTo(10,0).lineTo(0,10).endFill();
 assert.equal(triangles(frame().geometries[3]).area,50);
 const thin=sprite();thin.graphics.beginFill(1).moveTo(0,0).lineTo(10,0).endFill();
 assert.equal(frame().geometries.length,4);
}));

test('GS07 ellipses, rounded rectangles, arcs and curves end where they are told and stay inside their bounds',()=>withStage(({sprite,frame})=>{
 const ellipse=sprite();ellipse.graphics.beginFill(1).drawEllipse(10,20,80,40);
 assert.deepEqual(ellipse.getBounds(),{x:10,y:20,width:80,height:40});
 near(triangles(frame().geometries[0]).area,Math.PI*40*20,Math.PI*40*20*0.013,'ellipse area');
 const round=sprite();round.graphics.beginFill(1).drawRoundRect(0,0,100,60,20,10);
 assert.deepEqual(round.getBounds(),{x:0,y:0,width:100,height:60});
 const exact=100*60-(4-Math.PI)*10*5;near(triangles(frame().geometries[1]).area,exact,exact*0.002,'rounded area');
 // Corners larger than the rectangle are the rectangle's half sizes; corners of nothing are square.
 const pill=sprite();pill.graphics.beginFill(1).drawRoundRect(0,0,40,20,100);
 assert.deepEqual(pill.getBounds(),{x:0,y:0,width:40,height:20});
 const square=sprite();square.graphics.beginFill(1).lineStyle(1,0).drawRoundRect(0,0,8,8,0);
 assert.equal(frame().geometries[3].vertexCount,4+16);
 // A quarter arc from the right to the bottom, clockwise on the screen, lined.
 const arc=sprite();arc.graphics.lineStyle(2,0).drawArc(50,50,30,0,Math.PI/2);
 // Its ends are flat, across the arc: the line reaches a unit past the arc at its right and bottom, and stops at its two ends.
 const b=arc.getBounds();near(b.x,50,0.2,'arc left');near(b.y,50,0.2,'arc top');near(b.x+b.width,81,0.05,'arc right');near(b.y+b.height,81,0.05,'arc bottom');
 // The other way round it is the three quarters that go over the top.
 const long=sprite();long.graphics.lineStyle(2,0).drawArc(50,50,30,0,Math.PI/2,true);
 near(long.getBounds().y,19,0.3,'over the top');
 // A full turn is a whole circle, filled.
 const disc=sprite();disc.graphics.beginFill(1).drawArc(0,0,10,0,2*Math.PI).endFill();
 near(triangles(frame().geometries.at(-1)).area,Math.PI*100,Math.PI*100*0.03,'disc');
 // Curves end exactly on their anchors.
 const curve=sprite();curve.graphics.lineStyle(2,0).moveTo(0,0).curveTo(50,100,100,0).cubicCurveTo(120,-40,180,40,200,0);
 const c=curve.getBounds();near(c.x+c.width,201,0.2,'curve right');assert.ok(c.y+c.height>49&&c.y+c.height<52,'curve bottom '+(c.y+c.height));
}));

test('GS08 what is not a drawing is refused, and a drawing too large leaves the node as it was',()=>withStage(({sprite,frame})=>{
 const g=sprite().graphics;
 assert.throws(()=>g.drawCircle(0,0,5),coded('GRAPHICS_FILL_REQUIRED'));
 assert.throws(()=>g.drawRect(0,0,5,5),coded('GRAPHICS_FILL_REQUIRED'));
 g.beginFill(1);
 for(const bad of [()=>g.drawCircle(NaN,0,1),()=>g.drawCircle(0,0,-1),()=>g.drawEllipse(0,0,-1,1),()=>g.drawRoundRect(0,0,1,1,-1),()=>g.drawRoundRect(0,0,1,1,1,Infinity),()=>g.moveTo('0',0),()=>g.lineTo(0,undefined),
  ()=>g.curveTo(0,0,0,NaN),()=>g.cubicCurveTo(0,0,0,0,0,'x'),()=>g.drawArc(0,0,1,0,NaN),()=>g.drawArc(0,0,1,0,1,'no'),()=>g.lineStyle(-1),()=>g.lineStyle(2000),()=>g.lineStyle(1,-1),()=>g.lineStyle(1,0,2),()=>g.beginFill(0x1000000)])
  assert.throws(bad,coded('GRAPHICS_VALUE_INVALID'));
 assert.equal(frame().commands.length,0);
 // A path of more points than one geometry could hold is refused at the point that passes it; the path before it stays.
 const node=sprite(),path=node.graphics.lineStyle(1,0).moveTo(0,0);
 let refusedAt=-1;
 for(let i=1;i<=9000&&refusedAt<0;i++)try{path.lineTo(i,i%2);}catch(error){assert.equal(error.code,'GRAPHICS_BUDGET');refusedAt=i;}
 assert.equal(refusedAt,8192);
 const kept=frame().geometries[0];
 // Two vertices at each end, and four at each of the corners between: the inside, both outsides and the mitre.
 assert.equal(kept.vertexCount,4+4*8190);
 assert.throws(()=>path.lineTo(1,1),coded('GRAPHICS_BUDGET'));
 assert.equal(frame().geometries[0],kept);
 // A disposed node takes no drawing.
 node.dispose();assert.throws(()=>path.drawCircle(0,0,1),coded('OBJECT_DISPOSED'));
}));

test('GS09 a mesh of shapes follows the node: its matrix, alpha, clip and blend mode',()=>withStage(({sprite,frame})=>{
 const node=sprite();node.graphics.beginFill(0xffffff).drawCircle(0,0,10);
 node.x=30;node.y=40;node.scaleX=2;node.alpha=0.25;node.blendMode='add';
 const now=frame(),command=now.commands[0];
 assert.deepEqual([command.matrix.a,command.matrix.d,command.matrix.tx,command.matrix.ty,command.opacity,now.materials[command.materialIndex].blend],[2,1,30,40,0.25,'add-accumulate']);
 node.visible=false;assert.equal(frame().commands.length,0);
}));
