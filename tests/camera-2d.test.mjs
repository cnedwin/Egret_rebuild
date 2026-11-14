// SPDX-License-Identifier: Apache-2.0
// The 2D camera over a real display tree: where it puts the world and its layers, and where a point of the world is then.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DisplayObjectContainer} from '@egret/engine';
import {createCamera2D} from '@egret/engine/camera';

const coded=code=>error=>error?.code===code;
const near=(actual,expected,label,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,label+': '+actual+' is not '+expected);
const nearPoint=(actual,expected,label)=>{near(actual.x,expected.x,label+' x',1e-6);near(actual.y,expected.y,label+' y',1e-6);};
function scene(){
 const stage=new DisplayObjectContainer(),world=new DisplayObjectContainer(),hero=new DisplayObjectContainer(),back=new DisplayObjectContainer();
 stage.addChild(back);stage.addChild(world);world.addChild(hero);
 return {stage,world,hero,back};
}
/** Where a point of the world lands on the stage, through the transform the camera gave the world. */
const shown=(world,x,y)=>{const box=new DisplayObjectContainer();world.addChild(box);box.x=x;box.y=y;const at=box.localToGlobal(0,0);world.removeChild(box);return at;};

test('CA01 options are checked, and the world is placed at once',()=>{
 const {world}=scene(),good={world,width:400,height:300};
 for(const options of [null,7,{},{...good,world:{}},{...good,width:0},{...good,height:-1},{...good,width:NaN},{...good,center:{x:1}},{...good,zoom:0},{...good,zoom:5},{...good,zoom:0.2},{...good,minZoom:2,maxZoom:1},{...good,minZoom:0},
  {...good,rotation:Infinity},{...good,bounds:{x:0,y:0,width:-1,height:1}},{...good,bounds:7},{...good,shakeOffset:-1},{...good,shakeRotation:-1},{...good,shakeDecay:-1},{...good,shakeFrequency:0},{...good,seed:1.5},{...good,roundToPixel:1}])
  assert.throws(()=>createCamera2D(options),coded('CAMERA_OPTIONS_INVALID'),JSON.stringify(options)?.slice(0,80));
 const camera=createCamera2D(good);
 // Without a center it looks at the middle of the view: the world stands where it was.
 assert.deepEqual([camera.center,camera.zoom,camera.rotation,camera.width,camera.height,camera.state],[{x:200,y:150},1,0,400,300,'active']);
 nearPoint(shown(world,10,20),{x:10,y:20},'unmoved');
 assert.ok(Object.isFrozen(camera)&&Object.isFrozen(camera.center));
 camera.dispose();
});

test('CA02 what the camera looks at is in the middle of the view, at its zoom and rotation',()=>{
 const {world}=scene(),camera=createCamera2D({world,width:400,height:300,center:{x:1000,y:500},zoom:2});
 nearPoint(shown(world,1000,500),{x:200,y:150},'the center');
 nearPoint(shown(world,1010,505),{x:220,y:160},'a point beside it, twice as far');
 nearPoint(camera.worldToScreen(1010,505),{x:220,y:160},'worldToScreen');
 nearPoint(camera.screenToWorld(220,160),{x:1010,y:505},'screenToWorld');
 camera.setRotation(90);
 nearPoint(shown(world,1010,500),{x:200,y:170},'turned a quarter');
 nearPoint(camera.worldToScreen(1010,500),{x:200,y:170},'worldToScreen turned');
 nearPoint(camera.screenToWorld(200,170),{x:1010,y:500},'screenToWorld turned');
 assert.deepEqual(camera.snapshot().view,{x:900,y:425,width:200,height:150});
 camera.lookAt(0,0);camera.setRotation(0);camera.setZoom(0.5);
 nearPoint(shown(world,-400,-300),{x:0,y:0},'the corner at half');
 for(const bad of [()=>camera.lookAt(NaN,0),()=>camera.setZoom(0.1),()=>camera.setZoom(4.1),()=>camera.setRotation(NaN),()=>camera.worldToScreen('1',0),()=>camera.screenToWorld(0,undefined)])assert.throws(bad,coded('CAMERA_OPTIONS_INVALID'));
 camera.dispose();
});

test('CA03 bounds keep the view inside the world, and a world smaller than the view stands in its middle',()=>{
 const {world}=scene(),camera=createCamera2D({world,width:400,height:300,bounds:{x:0,y:0,width:1000,height:800}});
 camera.lookAt(-500,-500);
 assert.deepEqual(camera.center,{x:200,y:150});
 camera.lookAt(5000,5000);
 assert.deepEqual(camera.center,{x:800,y:650});
 // Zoomed out, the view is wider: still inside.
 camera.setZoom(0.5);
 assert.deepEqual(camera.center,{x:600,y:500});
 camera.setZoom(0.25);
 assert.deepEqual(camera.center,{x:500,y:400});
 camera.setBounds(undefined);camera.lookAt(5000,5000);
 assert.deepEqual(camera.center,{x:5000,y:5000});
 camera.setBounds({x:0,y:0,width:100,height:100});camera.setZoom(1);
 assert.deepEqual(camera.center,{x:50,y:50});
 assert.throws(()=>camera.setBounds({x:0}),coded('CAMERA_OPTIONS_INVALID'));
 // Given a smaller view, the same world is reached at its edges again.
 camera.setBounds({x:0,y:0,width:1000,height:800});camera.resize(200,100);camera.lookAt(0,0);
 assert.deepEqual([camera.center,camera.width,camera.height],[{x:100,y:50},200,100]);
 assert.throws(()=>camera.resize(0,1),coded('CAMERA_OPTIONS_INVALID'));
 camera.dispose();
});

test('CA04 a follow closes the same distance in the same time, whatever the frames',()=>{
 const run=steps=>{
  const {world,hero}=scene(),camera=createCamera2D({world,width:400,height:300,center:{x:0,y:0}});
  hero.x=100;hero.y=-50;camera.follow(hero,{smoothing:0.5});
  for(let i=0;i<steps;i++)camera.update(1/steps);
  const at=camera.center;camera.dispose();return at;
 };
 const one=run(1),sixty=run(60),thousand=run(1000);
 near(one.x,100*(1-Math.exp(-2)),'one step');
 nearPoint(sixty,one,'sixty steps');nearPoint(thousand,one,'a thousand steps');
 near(one.y,-50*(1-Math.exp(-2)),'y');
});

test('CA05 a follow reads the target where it is in the world, nested or not, and follows at once without smoothing',()=>{
 const {world,hero}=scene(),inner=new DisplayObjectContainer();hero.addChild(inner);
 hero.x=300;hero.y=200;hero.scaleX=2;hero.scaleY=2;inner.x=10;inner.y=5;
 const camera=createCamera2D({world,width:400,height:300,center:{x:0,y:0},zoom:3,rotation:30});
 camera.follow(inner,{smoothing:0,offset:{x:-20,y:0}});
 camera.update(0.016);
 nearPoint(camera.center,{x:300,y:210},'the inner target, offset');
 assert.equal(camera.snapshot().following,true);
 // A function says where to look.
 let spot={x:7,y:8};camera.follow(()=>spot,{smoothing:0});camera.update(0);
 nearPoint(camera.center,{x:7,y:8},'a function');
 spot={x:'7'};
 assert.throws(()=>camera.update(0),coded('CAMERA_TARGET_INVALID'));
 camera.stopFollowing();camera.update(1);
 assert.equal(camera.snapshot().following,false);
 for(const bad of [7,null,{},'hero'])assert.throws(()=>camera.follow(bad),coded('CAMERA_TARGET_INVALID'));
 for(const bad of [7,{smoothing:-1},{smoothing:'x'},{deadZone:{width:-1,height:0}},{deadZone:7},{offset:{x:1}}])assert.throws(()=>camera.follow(hero,bad),coded('CAMERA_OPTIONS_INVALID'),JSON.stringify(bad));
 camera.dispose();
});

test('CA06 inside the dead zone the target moves alone; outside it the camera is pulled to its edge',()=>{
 const {world,hero}=scene(),camera=createCamera2D({world,width:400,height:300,center:{x:0,y:0}});
 camera.follow(hero,{smoothing:0,deadZone:{width:100,height:60}});
 for(const [x,y] of [[40,20],[-50,30],[50,-30]]){hero.x=x;hero.y=y;camera.update(0.1);assert.deepEqual(camera.center,{x:0,y:0},x+','+y);}
 hero.x=80;hero.y=-45;camera.update(0.1);
 assert.deepEqual(camera.center,{x:30,y:-15});
 hero.x=-100;camera.update(0.1);
 assert.deepEqual(camera.center,{x:-50,y:-15});
 camera.dispose();
});

test('CA07 a follow inside bounds stops at the edge of the world',()=>{
 const {world,hero}=scene(),camera=createCamera2D({world,width:400,height:300,bounds:{x:0,y:0,width:2000,height:300}});
 camera.follow(hero,{smoothing:0});
 hero.x=1950;camera.update(0.1);
 assert.deepEqual(camera.center,{x:1800,y:150});
 hero.x=1000;hero.y=-500;camera.update(0.1);
 assert.deepEqual(camera.center,{x:1000,y:150});
 camera.dispose();
});

test('CA08 a pan and a zoom ease over their time, and a pan stops a follow',()=>{
 const {world,hero}=scene(),camera=createCamera2D({world,width:400,height:300,center:{x:0,y:0}});
 camera.follow(hero);camera.panTo(100,200,1);
 assert.equal(camera.snapshot().following,false);
 camera.update(0.5);
 assert.deepEqual(camera.center,{x:50,y:100});
 camera.update(0.25);
 near(camera.center.x,100*0.84375,'three quarters, eased');
 camera.update(5);
 assert.deepEqual(camera.center,{x:100,y:200});
 camera.zoomTo(3,2);camera.update(1);
 assert.equal(camera.zoom,2);
 camera.update(1);camera.update(1);
 assert.equal(camera.zoom,3);
 // At once with no time; a look stops a pan.
 camera.panTo(0,0,0);camera.zoomTo(1,0);
 assert.deepEqual([camera.center,camera.zoom],[{x:0,y:0},1]);
 camera.panTo(500,0,1);camera.update(0.5);camera.lookAt(-1,-1);camera.update(1);
 assert.deepEqual(camera.center,{x:-1,y:-1});
 for(const bad of [()=>camera.panTo(0,0,-1),()=>camera.panTo(NaN,0,1),()=>camera.zoomTo(9,1),()=>camera.zoomTo(1,-1),()=>camera.update(-1),()=>camera.update(NaN)])assert.throws(bad,coded('CAMERA_OPTIONS_INVALID'));
 camera.dispose();
});

test('CA09 a shake moves the view by the square of the trauma, the same way for the same seed, and dies away',()=>{
 const run=(seed,trauma)=>{
  const {world}=scene(),camera=createCamera2D({world,width:400,height:300,shakeOffset:20,shakeRotation:5,shakeDecay:1,seed});
  camera.shake({trauma});const path=[];
  for(let i=0;i<30;i++){camera.update(1/60);path.push([world.x,world.y,world.rotation]);}
  const left=camera.snapshot().trauma;camera.dispose();return {path,left,world};
 };
 const a=run(7,0.8),b=run(7,0.8),c=run(8,0.8);
 assert.deepEqual(a.path,b.path);
 assert.notDeepEqual(a.path,c.path);
 near(a.left,0.3,'trauma after half a second',1e-9);
 for(const [x,y,r] of a.path){assert.ok(Math.abs(x-200)<=20*0.64+1e-9&&Math.abs(y-150)<=20*0.64+1e-9&&Math.abs(r)<=5*0.64+1e-9);}
 assert.ok(a.path.some(([x])=>Math.abs(x-200)>1));
 // It ends where it began.
 const {world}=scene(),camera=createCamera2D({world,width:400,height:300});
 camera.shake({trauma:1});camera.shake();
 assert.equal(camera.snapshot().trauma,1);
 camera.update(2);
 assert.deepEqual([world.x,world.y,world.rotation,camera.snapshot().trauma],[200,150,0,0]);
 for(const bad of [7,{trauma:-0.1},{trauma:1.1}])assert.throws(()=>camera.shake(bad),coded('CAMERA_OPTIONS_INVALID'));
 camera.dispose();
});

test('CA10 a layer moves at its own speed and takes as much of the zoom as it is given',()=>{
 const {world,back}=scene(),front=new DisplayObjectContainer();
 const camera=createCamera2D({world,width:400,height:300,center:{x:200,y:150}});
 const off=camera.addLayer(back,{factor:0.5}),offFront=camera.addLayer(front,{factor:{x:1.5,y:0},zoomFactor:0});
 const at=(layer,x,y)=>{const box=new DisplayObjectContainer();layer.addChild(box);box.x=x;box.y=y;const p=box.localToGlobal(0,0);layer.removeChild(box);return p;};
 nearPoint(at(back,100,100),{x:100,y:100},'back at rest');
 camera.lookAt(400,350);
 nearPoint(shown(world,400,350),{x:200,y:150},'the world moved 200');
 nearPoint(at(back,100,100),{x:100-100,y:100-100},'the back moved half');
 nearPoint(at(front,100,100),{x:100-300+0,y:100-0},'the front moved one and a half across, not up');
 camera.setZoom(2);
 assert.deepEqual([back.scaleX,front.scaleX,world.scaleX],[2,1,2]);
 camera.addLayer(new DisplayObjectContainer(),{zoomFactor:0.5});
 for(const bad of [[world],[back],[7],[{}]])assert.throws(()=>camera.addLayer(...bad),coded('CAMERA_LAYER_INVALID'));
 for(const bad of [{factor:'1'},{factor:{x:1}},{zoomFactor:2},{zoomFactor:-1},7])assert.throws(()=>camera.addLayer(new DisplayObjectContainer(),bad),coded('CAMERA_OPTIONS_INVALID'));
 off();off();
 assert.deepEqual([back.x,back.y,back.scaleX,back.anchorOffsetX],[0,0,1,0]);
 offFront();
 camera.dispose();
});

test('CA11 what can be seen is known before it is drawn',()=>{
 const {world}=scene(),camera=createCamera2D({world,width:400,height:300,center:{x:0,y:0}});
 assert.equal(camera.isVisible({x:150,y:100,width:10,height:10}),true);
 assert.equal(camera.isVisible({x:201,y:0,width:10,height:10}),false);
 assert.equal(camera.isVisible({x:200,y:150,width:0,height:0}),true);
 assert.equal(camera.isVisible({x:-212,y:-162,width:11,height:11}),false);
 camera.setZoom(2);
 assert.equal(camera.isVisible({x:150,y:0,width:10,height:10}),false);
 assert.throws(()=>camera.isVisible({x:0}),coded('CAMERA_OPTIONS_INVALID'));
 camera.dispose();
});

test('CA12 pixel art stays on whole pixels',()=>{
 const {world}=scene(),camera=createCamera2D({world,width:400,height:300,center:{x:10.3,y:20.6},zoom:2,roundToPixel:true});
 const corner=shown(world,0,0);
 // Whole up to the rounding of the transform itself.
 near(corner.x,Math.round(corner.x),'x on a pixel',1e-9);near(corner.y,Math.round(corner.y),'y on a pixel',1e-9);
 nearPoint(camera.worldToScreen(0,0),corner,'the same point by the camera');
 camera.lookAt(12.2,20.2);
 const moved=shown(world,0,0);near(moved.x,Math.round(moved.x),'x after a move',1e-9);near(moved.y,Math.round(moved.y),'y after a move',1e-9);
 assert.notEqual(Math.round(moved.x),Math.round(corner.x));
 camera.dispose();
});

test('CA13 disposal gives the world and the layers back what they had, once, and takes nothing more',()=>{
 const {world,back,hero}=scene();
 world.x=5;world.y=6;world.scaleX=0.5;world.rotation=10;world.anchorOffsetX=3;
 const camera=createCamera2D({world,width:400,height:300,center:{x:99,y:99},zoom:2});
 camera.addLayer(back);camera.follow(hero);camera.update(1);
 camera.dispose();camera.dispose();
 assert.deepEqual([world.x,world.y,world.scaleX,world.scaleY,world.rotation,world.anchorOffsetX,world.anchorOffsetY,back.x,back.scaleX],[5,6,0.5,1,10,3,0,0,1]);
 assert.equal(camera.state,'closed');
 for(const call of [()=>camera.update(1),()=>camera.lookAt(0,0),()=>camera.setZoom(1),()=>camera.shake(),()=>camera.follow(hero),()=>camera.addLayer(new DisplayObjectContainer())])assert.throws(call,coded('CAMERA_CLOSED'));
 camera.stopFollowing();
 assert.deepEqual(camera.snapshot().following,false);
});

test('CA14 the edges that are allowed, and the ways round that a straight case does not show',()=>{
 const {world,hero}=scene();
 const disposed=new DisplayObjectContainer();disposed.dispose();
 assert.throws(()=>createCamera2D({world:disposed,width:1,height:1}),coded('CAMERA_OPTIONS_INVALID'));
 for(const bad of [{zoom:NaN},{rotation:NaN},{shakeDecay:NaN},{center:{x:0,y:NaN}}])assert.throws(()=>createCamera2D({world,width:400,height:300,...bad}),coded('CAMERA_OPTIONS_INVALID'),JSON.stringify(bad));
 // A zoom at either end is allowed, and so are nothing to shake, no decay and a layer that takes all or none of the zoom.
 createCamera2D({world,width:400,height:300,minZoom:2,maxZoom:2,zoom:2}).dispose();
 for(const zoom of [0.25,4])createCamera2D({world,width:400,height:300,zoom,shakeOffset:0,shakeRotation:0,shakeDecay:0}).dispose();
 const camera=createCamera2D({world,width:400,height:300,center:{x:0.25,y:0.75},minZoom:0.5,maxZoom:2});
 // Without pixels asked for, a place between pixels is kept.
 { const origin=shown(world,0,0); assert.notEqual(origin.x,Math.round(origin.x)); }
 camera.setZoom(0.5);camera.setZoom(2);camera.zoomTo(0.5,1);camera.zoomTo(2,1);
 for(const bad of [()=>camera.zoomTo(1,NaN),()=>camera.zoomTo(NaN,1),()=>camera.panTo(0,NaN,1),()=>camera.panTo(0,0,NaN)])assert.throws(bad,coded('CAMERA_OPTIONS_INVALID'));
 camera.follow(hero,{smoothing:0,deadZone:{width:0,height:0},offset:{x:0,y:0}});
 for(const bad of [{smoothing:NaN},{deadZone:{width:1,height:-1}},{deadZone:{width:NaN,height:1}},{deadZone:{width:1}}])assert.throws(()=>camera.follow(hero,bad),coded('CAMERA_OPTIONS_INVALID'),JSON.stringify(bad));
 camera.shake({trauma:0});camera.shake({trauma:1});
 for(const zoomFactor of [0,1])camera.addLayer(new DisplayObjectContainer(),{zoomFactor,factor:0});
 for(const bad of [{factor:NaN},{factor:{x:NaN,y:1}},{factor:{x:1,y:NaN}},{zoomFactor:NaN},{factor:{x:1,y:1},zoomFactor:NaN}])assert.throws(()=>camera.addLayer(new DisplayObjectContainer(),bad),coded('CAMERA_OPTIONS_INVALID'));
 camera.dispose();
});

test('CA15 a pan from anywhere, a dead zone on every side, and a turned view with height',()=>{
 const {world,hero}=scene(),camera=createCamera2D({world,width:400,height:300,center:{x:100,y:-40}});
 camera.panTo(300,60,1);camera.update(0.5);
 assert.deepEqual(camera.center,{x:200,y:10});
 camera.update(0.5);
 camera.follow(hero,{smoothing:0,deadZone:{width:20,height:20}});
 hero.x=300;hero.y=100;camera.update(0);
 assert.deepEqual(camera.center,{x:300,y:90});
 hero.y=50;camera.update(0);
 assert.deepEqual(camera.center,{x:300,y:60});
 camera.stopFollowing();camera.lookAt(0,0);camera.setRotation(30);camera.setZoom(2);
 for(const [x,y] of [[10,20],[-15,7],[3,-40]]){
  nearPoint(camera.worldToScreen(x,y),shown(world,x,y),'turned '+x+','+y);
  nearPoint(camera.screenToWorld(...Object.values(camera.worldToScreen(x,y))),{x,y},'and back '+x+','+y);
 }
 // A rectangle that only touches the edge of the view can be seen.
 camera.setRotation(0);camera.setZoom(1);
 assert.equal(camera.isVisible({x:-210,y:-160,width:10,height:10}),true);
 assert.equal(camera.isVisible({x:200,y:150,width:10,height:10}),true);
 camera.dispose();
 // Pixels: the middle of the world stays within half a pixel of the middle of the view.
 const pixel=createCamera2D({world,width:400,height:300,center:{x:33.3,y:-12.7},zoom:3,roundToPixel:true});
 const middle=pixel.worldToScreen(33.3,-12.7);
 assert.ok(Math.abs(middle.x-200)<=0.5&&Math.abs(middle.y-150)<=0.5,JSON.stringify(middle));
 pixel.dispose();
});

test('CA16 a shake is a smooth path, not a jump at each step of its noise',()=>{
 const {world}=scene(),camera=createCamera2D({world,width:400,height:300,shakeOffset:100,shakeDecay:0,shakeFrequency:1});
 camera.shake({trauma:1});
 camera.update(0.999);const a=world.x;
 camera.update(0.002);const b=world.x;
 assert.ok(Math.abs(a-b)<1,'a step across a knot of the noise moved '+Math.abs(a-b));
 camera.dispose();
});

test('CA17 a strict consumer compiles against the entry, and six misuses are refused; the entry has its factory alone',async()=>{
 const {spawnSync}=await import('node:child_process');
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/camera.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.deepEqual(Object.keys(await import('@egret/engine/camera')),['createCamera2D']);
 for(const entry of ['@egret/engine','@egret/engine/ui','@egret/engine/input','@egret/runtime'])assert.equal('createCamera2D' in await import(entry),false,entry);
});
