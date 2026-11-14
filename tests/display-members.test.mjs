// SPDX-License-Identifier: Apache-2.0
// Members of a display object that older code expects: skew, a name, and a width and height that scale.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
async function withStage(run){
 const engine=await egret.createEngine({host:host().adapter}),scope=engine.createScope();
 const sprite=()=>engine.stage.addChild(scope.use(new egret.Sprite()));
 try{await run({engine,scope,sprite,frame:()=>engine.captureSharedFrame({width:200,height:200})});}finally{scope.dispose();await engine.dispose();}
}
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-9,label+': '+actual+' is not '+expected);

test('DM01 skew turns one axis and leaves the other, on top of the rotation',()=>withStage(({sprite,frame,engine})=>{
 const node=sprite();node.graphics.beginFill(1).drawRect(0,0,10,10).endFill();node.x=50;node.y=50;
 const before=frame().commands[0].matrix;
 assert.deepEqual([node.skewX,node.skewY],[0,0]);
 assert.deepEqual([before.a,before.b,before.c,before.d],[1,0,-0,1].map(v=>v+0));
 // skewX leans the y axis: level lines stay level, upright ones lean by 45 degrees.
 node.skewX=45;
 let m=frame().commands[0].matrix;
 near(m.a,1,'a');near(m.b,0,'b');near(m.c,-Math.SQRT1_2,'c');near(m.d,Math.SQRT1_2,'d');assert.deepEqual([m.tx,m.ty],[50,50]);
 // skewY slopes the x axis.
 node.skewX=0;node.skewY=30;
 m=frame().commands[0].matrix;
 near(m.a,Math.cos(Math.PI/6),'a');near(m.b,0.5,'b');near(m.c,0,'c');near(m.d,1,'d');
 // Both equal is a rotation by that much, and they add to the rotation and take the scale.
 node.skewX=30;node.rotation=60;node.scaleX=2;
 m=frame().commands[0].matrix;
 near(m.a,0,'a');near(m.b,2,'b');near(m.c,-1,'c');near(m.d,0,'d');
 // A capture after a skew alone is a new matrix; the same skew again is the same one.
 const kept=frame().commands[0].matrix;assert.equal(frame().commands[0].matrix,kept);
 node.skewY=31;assert.notEqual(frame().commands[0].matrix,kept);
 // Hit tests and bounds follow the skew.
 node.rotation=0;node.scaleX=1;node.skewY=0;node.skewX=45;node.touchEnabled=true;
 const corner=node.localToGlobal(10,10);
 near(corner.x,50+10-10*Math.SQRT1_2,'leaning corner x');near(corner.y,50+10*Math.SQRT1_2,'leaning corner y');
 assert.equal(engine.stage.hitTest(50+5-4*Math.SQRT1_2,50+5*Math.SQRT1_2-1),node);
 assert.equal(engine.stage.hitTest(50+9,50+6),undefined,'where the square was before it leaned');
 for(const bad of [NaN,Infinity,'1'])assert.throws(()=>{node.skewX=bad;},coded('DISPLAY_VALUE_INVALID'));
 assert.throws(()=>{node.skewY=undefined;},coded('DISPLAY_VALUE_INVALID'));
}));

test('DM02 a name finds a child',()=>withStage(({engine,scope,sprite})=>{
 const a=sprite(),b=sprite(),c=sprite();
 assert.equal(a.name,'');
 a.name='hero';b.name='coin';c.name='coin';
 assert.equal(engine.stage.getChildByName('hero'),a);
 assert.equal(engine.stage.getChildByName('coin'),b,'the first of two');
 assert.equal(engine.stage.getChildByName('none'),undefined);
 // A child's child is not looked at.
 const group=engine.stage.addChild(scope.use(new egret.DisplayObjectContainer())),inner=group.addChild(scope.use(new egret.Sprite()));inner.name='inner';
 assert.equal(engine.stage.getChildByName('inner'),undefined);assert.equal(group.getChildByName('inner'),inner);
 assert.throws(()=>{a.name=5;},coded('DISPLAY_VALUE_INVALID'));
 assert.throws(()=>engine.stage.getChildByName(5),coded('DISPLAY_VALUE_INVALID'));
 // A name changes nothing that is drawn.
 const before=engine.captureSharedFrame({width:10,height:10});a.name='other';assert.equal(engine.captureSharedFrame({width:10,height:10}).commands.length,before.commands.length);
}));

test('DM03 width and height are the size on the parent, and setting them sets the scale',()=>withStage(({sprite,scope})=>{
 const node=sprite();node.graphics.beginFill(1).drawRect(5,5,40,20).endFill();
 assert.deepEqual([node.width,node.height],[40,20]);
 node.scaleX=2;node.scaleY=-0.5;
 assert.deepEqual([node.width,node.height],[80,10]);
 node.width=120;node.height=30;
 // The sign of a scale is kept.
 assert.deepEqual([node.scaleX,node.scaleY,node.width,node.height],[3,-1.5,120,30]);
 node.width=0;assert.equal(node.scaleX,0);
 // Children count: a container is as wide as what it holds.
 const group=sprite(),child=group.addChild(scope.use(new egret.Sprite()));child.graphics.beginFill(2).drawCircle(0,0,10).endFill();child.x=30;
 assert.deepEqual([group.width,group.height],[20,20]);
 group.width=10;assert.equal(group.scaleX,0.5);
 // An object that draws nothing has no size to scale.
 const empty=sprite();
 assert.deepEqual([empty.width,empty.height],[0,0]);
 empty.width=0;assert.equal(empty.scaleX,1);
 assert.throws(()=>{empty.width=10;},coded('DISPLAY_SIZE_UNAVAILABLE'));
 for(const bad of [-1,NaN,'10'])assert.throws(()=>{node.height=bad;},coded('DISPLAY_VALUE_INVALID'));
}));
