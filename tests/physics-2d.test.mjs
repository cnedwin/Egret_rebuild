// SPDX-License-Identifier: Apache-2.0
// The 2D physics world: shapes that meet, bodies that fall, bounce, slide and rest, sensors, queries and character movement.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DisplayObjectContainer} from '@egret/engine';
import {createPhysicsWorld} from '@egret/engine/physics2d';

const coded=code=>error=>error?.code===code;
const near=(actual,expected,label,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance,label+': '+actual+' is not '+expected+' within '+tolerance);
const box=(width,height)=>({kind:'box',width,height}),circle=radius=>({kind:'circle',radius});

test('PH01 options of the world and of a body are checked',()=>{
 for(const options of [null,7,{gravity:{x:1}},{fixedStep:0},{fixedStep:2},{maxSteps:0},{maxSteps:121},{iterations:0},{iterations:65},{cellSize:0},{maxBodies:0},{maxBodies:65537},{maxSteps:1.5}])
  assert.throws(()=>createPhysicsWorld(options),coded('PHYSICS_OPTIONS_INVALID'),JSON.stringify(options));
 const world=createPhysicsWorld({maxBodies:2});
 for(const options of [null,{},{shape:7},{shape:{kind:'star'}},{shape:circle(0)},{shape:box(1,0)},{shape:{kind:'polygon',points:[{x:0,y:0},{x:1,y:0}]}},
  {shape:{kind:'polygon',points:[{x:0,y:0},{x:2,y:0},{x:1,y:1},{x:2,y:2},{x:0,y:2}]}},{shape:{kind:'polygon',points:[{x:0,y:0},{x:1,y:0},{x:2,y:0}]}},{shape:circle(1),kind:'ghost'},{shape:circle(1),x:NaN},
  {shape:circle(1),density:0},{shape:circle(1),restitution:1.1},{shape:circle(1),restitution:-0.1},{shape:circle(1),friction:-1},{shape:circle(1),layer:-1},{shape:circle(1),mask:2**32},{shape:circle(1),sensor:1},{shape:circle(1),display:{}}])
  assert.throws(()=>world.addBody(options),coded('PHYSICS_OPTIONS_INVALID'),JSON.stringify(options));
 const a=world.addBody({shape:circle(1)});
 world.addBody({shape:{kind:'polygon',points:[{x:0,y:0},{x:0,y:2},{x:2,y:0}]}});
 assert.throws(()=>world.addBody({shape:circle(1)}),coded('PHYSICS_BODY_LIMIT'));
 for(const bad of [()=>{a.x=NaN;},()=>{a.vx=Infinity;},()=>{a.restitution=-1;},()=>{a.friction=NaN;},()=>{a.layer=1.5;},()=>{a.gravityScale=NaN;},()=>a.applyImpulse(NaN,0),()=>a.applyForce(0,'1'),()=>{world.gravity={x:0};},()=>world.step(-1),()=>world.step(NaN)])
  assert.throws(bad,coded('PHYSICS_OPTIONS_INVALID'));
 assert.ok(Object.isFrozen(a)&&Object.isFrozen(world)&&Object.isFrozen(a.shape));
 assert.deepEqual([a.id,a.kind,a.sensor,a.state,a.mass],[1,'dynamic',false,'active',Math.PI]);
 world.dispose();
});

test('PH02 a body falls under gravity in fixed steps, whatever the updates, and keeps what is left over',()=>{
 const run=updates=>{const w=createPhysicsWorld({gravity:{x:0,y:100}}),b=w.addBody({shape:circle(1)});let steps=0;for(const u of updates)steps+=w.step(u);return {y:b.y,vy:b.vy,steps,pending:w.snapshot().pending};};
 const once=run([0.5]),many=run(Array(30).fill(1/60)),uneven=run([0.1,0.05,0.1,0.1,0.05,0.1]);
 assert.deepEqual([once.steps,many.steps,uneven.steps],[8,30,30]);
 // A long update is cut to the most steps there may be, and what is left is let go.
 near(once.pending,1/60,'left over',1e-12);
 near(many.y,uneven.y,'the same fall',1e-9);near(many.vy,50,'its speed',1e-9);
 // Semi-implicit: the speed of the step moves the body in the same step.
 near(many.y,100*(1/60)*(1/60)*(30*31/2),'the place',1e-9);
 const w=createPhysicsWorld({gravity:{x:0,y:10}}),b=w.addBody({shape:circle(1)});
 assert.equal(w.step(1/120),0);
 assert.equal(w.step(1/120),1);
 b.gravityScale=0;b.vy=0;w.step(1);
 assert.equal(b.vy,0);
 w.gravity={x:5,y:0};
 assert.deepEqual(w.gravity,{x:5,y:0});
});

test('PH03 a ball dropped on the ground stops on it; a bouncing one comes back up as much as it is told',()=>{
 const drop=restitution=>{
  const w=createPhysicsWorld({gravity:{x:0,y:500}});
  w.addBody({kind:'static',shape:box(400,20),x:0,y:100});
  const ball=w.addBody({shape:circle(10),y:0,restitution});
  // The highest it comes back to once it has first turned upwards.
  let highest=Infinity,bounced=false;
  for(let i=0;i<180;i++){w.step(1/60);if(ball.vy<0)bounced=true;if(bounced)highest=Math.min(highest,ball.y);}
  return {ball,highest};
 };
 const dead=drop(0);
 // Resting on the ground: the bottom of the ball at its top (90), within the slop.
 near(dead.ball.y,80,'at rest',0.05);near(dead.ball.vy,0,'still',1);
 const bouncy=drop(0.8);
 assert.ok(bouncy.highest<60,'it came back up to '+bouncy.highest);
});

test('PH04 bodies push each other by their masses, and a heavy body barely moves for a light one',()=>{
 const w=createPhysicsWorld();
 const light=w.addBody({shape:box(10,10),x:0,vx:100,density:1}),heavy=w.addBody({shape:box(10,10),x:15,density:100});
 for(let i=0;i<30;i++)w.step(1/60);
 // Momentum is kept: what the light one lost the heavy one has.
 near(light.vx*light.mass+heavy.vx*heavy.mass,100*light.mass,'momentum',1e-6);
 assert.ok(heavy.vx>0&&heavy.vx<2,'the heavy one '+heavy.vx);
 assert.ok(heavy.x-light.x>=10-0.05,'apart');
});

test('PH05 friction holds a box on a slope that is gentle, and lets it slide on one that is steep',()=>{
 const slide=(degrees,friction)=>{
  const w=createPhysicsWorld({gravity:{x:0,y:400}});
  w.addBody({kind:'static',shape:box(1000,20),angle:degrees,x:0,y:0,friction});
  // Set on the slope: above its middle, along its normal.
  const a=degrees*Math.PI/180,n={x:Math.sin(a),y:-Math.cos(a)};
  const b=w.addBody({shape:circle(5),x:n.x*15.5,y:n.y*15.5,friction});
  for(let i=0;i<60;i++)w.step(1/60);
  return Math.hypot(b.x-n.x*15.5,b.y-n.y*15.5);
 };
 assert.ok(slide(10,1)<2,'held: '+slide(10,1));
 assert.ok(slide(40,0.1)>40,'slid: '+slide(40,0.1));
});

test('PH06 shapes meet as they are: circles, boxes turned, and polygons',()=>{
 const w=createPhysicsWorld();
 const a=w.addBody({kind:'static',shape:box(20,20),x:0,y:0,angle:45});
 const found=(shape,x,y,angle=0)=>{const p=w.addBody({kind:'static',shape,x,y,angle,sensor:true});const hit=w.queryRect({x:x-1e-6,y:y-1e-6,width:2e-6,height:2e-6}).includes(a);w.removeBody(p);return hit;};
 void found;
 // A box turned by 45 degrees reaches 14.14 along its axes, not 10.
 assert.deepEqual([w.queryPoint(13,0).length,w.queryPoint(15,0).length,w.queryPoint(9,9).length],[1,0,0]);
 const tri=w.addBody({kind:'static',shape:{kind:'polygon',points:[{x:0,y:0},{x:10,y:0},{x:0,y:10}]},x:100,y:0});
 assert.deepEqual([w.queryPoint(102,2).map(b=>b.id),w.queryPoint(108,8).length],[[tri.id],0]);
 const ball=w.addBody({kind:'static',shape:circle(5),x:200,y:0});
 assert.deepEqual([w.queryPoint(204,0).map(b=>b.id),w.queryPoint(204,4).length],[[ball.id],0]);
 assert.deepEqual(w.queryRect({x:96,y:-1,width:200,height:2}).map(b=>b.id),[tri.id,ball.id]);
 assert.deepEqual(w.queryRect({x:-100,y:-100,width:5,height:5}),[]);
 // Bounds of a turned box.
 const bounds=a.bounds();near(bounds.width,Math.SQRT2*20,'turned bounds',1e-9);
 for(const bad of [()=>w.queryPoint(NaN,0),()=>w.queryRect({x:0,y:0,width:-1,height:1}),()=>w.queryRect(null),()=>w.queryPoint(0,0,-1)])assert.throws(bad,coded('PHYSICS_OPTIONS_INVALID'));
});

test('PH07 a ray meets the first solid body on its way, sensors left out',()=>{
 const w=createPhysicsWorld();
 const wall=w.addBody({kind:'static',shape:box(10,100),x:50,y:0}),far=w.addBody({kind:'static',shape:circle(10),x:100,y:0});
 w.addBody({kind:'static',shape:box(10,10),x:20,y:0,sensor:true});
 const hit=w.raycast({x:0,y:0},{x:200,y:0});
 assert.deepEqual([hit.body,hit.point,hit.normal],[wall,{x:45,y:0},{x:-1,y:0}]);
 near(hit.fraction,45/200,'fraction');
 const round=w.raycast({x:100,y:-50},{x:100,y:50});
 assert.deepEqual([round.body,round.point.y,round.normal],[far,-10,{x:0,y:-1}]);
 assert.equal(w.raycast({x:0,y:-200},{x:200,y:-200}),undefined);
 // Too short to reach, or starting inside, it meets nothing; a mask leaves a body out.
 assert.equal(w.raycast({x:0,y:0},{x:40,y:0}),undefined);
 assert.equal(w.raycast({x:50,y:0},{x:60,y:0}),undefined);
 wall.layer=2;
 assert.equal(w.raycast({x:0,y:0},{x:200,y:0},1).body,far);
 for(const bad of [[{x:0},{x:1,y:1}],[{x:0,y:0},null]])assert.throws(()=>w.raycast(...bad),coded('PHYSICS_OPTIONS_INVALID'));
});

test('PH08 contacts are told when they begin and end, sensors too, and a body removed ends its contacts',()=>{
 const w=createPhysicsWorld({gravity:{x:0,y:200}}),told=[];
 w.onContact(c=>told.push([c.type,c.a.id,c.b.id,c.sensor,c.normal]));
 const ground=w.addBody({kind:'static',shape:box(200,10),y:50}),zone=w.addBody({kind:'static',shape:box(40,40),y:0,sensor:true});
 const ball=w.addBody({shape:circle(5),y:-40});
 for(let i=0;i<60;i++)w.step(1/60);
 assert.deepEqual(told.map(t=>t.slice(0,4)),[['begin',2,3,true],['end',2,3,true],['begin',1,3,false]]);
 assert.deepEqual(told[2][4],{x:0,y:-1});
 assert.equal(w.snapshot().contacts,1);
 w.removeBody(ball);
 assert.deepEqual(told.at(-1).slice(0,4),['end',1,3,false]);
 assert.deepEqual([ball.state,w.snapshot().contacts,w.bodies.length],['removed',0,2]);
 assert.throws(()=>w.removeBody(ball),coded('PHYSICS_BODY_INVALID'));
 void ground;void zone;
});

test('PH09 groups and masks decide what meets; a sensor pushes nothing',()=>{
 const w=createPhysicsWorld({gravity:{x:0,y:300}});
 w.addBody({kind:'static',shape:box(200,10),y:50,layer:2});
 const ghost=w.addBody({shape:circle(5),mask:1}),ball=w.addBody({shape:circle(5),x:30,mask:2}),sense=w.addBody({shape:circle(5),x:-30,sensor:true});
 for(let i=0;i<90;i++)w.step(1/60);
 assert.ok(ghost.y>100,'the ghost fell through');assert.ok(ball.y<45,'the ball stopped');assert.ok(sense.y>100,'the sensor fell through');
});

test('PH10 a kinematic body moves by its speed alone and pushes what is dynamic',()=>{
 const w=createPhysicsWorld({gravity:{x:0,y:300}});
 const lift=w.addBody({kind:'kinematic',shape:box(60,10),x:0,y:100,vy:-30});
 const crate=w.addBody({shape:box(10,10),x:0,y:85});
 for(let i=0;i<60;i++)w.step(1/60);
 near(lift.y,70,'the lift',1e-9);
 assert.ok(Math.abs(crate.y-(lift.y-10))<1,'the crate rides it: '+crate.y);
 const wall=w.addBody({kind:'static',shape:box(10,10),x:100});
 wall.vx=50;w.step(1);
 assert.deepEqual([wall.x,wall.vx],[100,0]);
});

test('PH11 a character slides along walls by moveAndSlide and is told what it slid along',()=>{
 const w=createPhysicsWorld();
 w.addBody({kind:'static',shape:box(20,200),x:50,y:0});
 const hero=w.addBody({kind:'kinematic',shape:box(10,10),x:0,y:0});
 let moved=w.moveAndSlide(hero,100,30);
 near(moved.x,35,'stopped at the wall',1e-9);near(moved.y,30,'slid down it',1e-9);
 assert.deepEqual([moved.collided,moved.normals],[true,[{x:-1,y:0}]]);
 moved=w.moveAndSlide(hero,0,10);
 assert.deepEqual([moved.collided,moved.y],[false,40]);
 // A sensor and a dynamic body are no wall; a mask leaves a wall out.
 w.addBody({kind:'static',shape:box(10,10),x:35,y:60,sensor:true});
 assert.equal(w.moveAndSlide(hero,0,20).collided,false);
 hero.mask=2;
 assert.equal(w.moveAndSlide(hero,20,0).collided,false);
 const display=new DisplayObjectContainer(),runner=w.addBody({kind:'kinematic',shape:circle(5),display});
 w.moveAndSlide(runner,3,4);
 assert.deepEqual([display.x,display.y],[3,4]);
 for(const bad of [()=>w.moveAndSlide(hero,NaN,0),()=>w.moveAndSlide({},1,1)])assert.throws(bad);
});

test('PH12 the solid cells of a grid become as few static boxes as can be',()=>{
 const w=createPhysicsWorld();
 // A frame of walls round a 6 by 5 room, and a block of 2 by 2 in it.
 const map=['######','#....#','#.##.#','#.##.#','######'];
 const boxes=w.addTileColliders({columns:6,rows:5,tileWidth:16,tileHeight:16,solid:(c,r)=>map[r][c]==='#',x:100,y:0,friction:0.5,layer:4});
 const rects=boxes.map(b=>{const r=b.bounds();return [r.x,r.y,r.width,r.height];}).sort((p,q)=>p[1]-q[1]||p[0]-q[0]);
 assert.deepEqual(rects,[[100,0,96,16],[100,16,16,48],[180,16,16,48],[132,32,32,32],[100,64,96,16]]);
 assert.ok(boxes.every(b=>b.kind==='static'&&b.friction===0.5&&b.layer===4));
 // Every solid cell is in a box and no empty one is.
 for(let r=0;r<5;r++)for(let c=0;c<6;c++)assert.equal(w.queryPoint(100+c*16+8,r*16+8).length>0,map[r][c]==='#',c+','+r);
 assert.deepEqual(w.addTileColliders({columns:0,rows:0,tileWidth:1,tileHeight:1,solid:()=>true}),[]);
 for(const bad of [null,{columns:1,rows:1,tileWidth:0,tileHeight:1,solid:()=>true},{columns:1,rows:1,tileWidth:1,tileHeight:1},{columns:-1,rows:1,tileWidth:1,tileHeight:1,solid:()=>true},{columns:1,rows:1,tileWidth:1,tileHeight:1,solid:()=>true,x:NaN}])
  assert.throws(()=>w.addTileColliders(bad),coded('PHYSICS_OPTIONS_INVALID'));
});

test('PH13 a display object follows its body after each step',()=>{
 const w=createPhysicsWorld({gravity:{x:0,y:60}}),display=new DisplayObjectContainer();
 const b=w.addBody({shape:circle(2),x:5,angle:30,display});
 w.step(1/60);
 assert.deepEqual([display.x,display.y,display.rotation],[b.x,b.y,30]);
 near(display.y,1/60,'moved down');
});

test('PH14 a stack of boxes comes to rest without sinking into the ground',()=>{
 const w=createPhysicsWorld({gravity:{x:0,y:500}});
 w.addBody({kind:'static',shape:box(400,20),y:100});
 const stack=[0,1,2,3,4].map(i=>w.addBody({shape:box(20,20),y:80-i*21}));
 for(let i=0;i<240;i++)w.step(1/60);
 // This solver has no memory between steps: a stack of five settles a little into itself, about a unit a box at most.
 stack.forEach((b,i)=>near(b.y,80-i*20,'box '+i,1.5*(i+1)));
 near(stack[0].y,80,'the lowest on the ground',1);
 for(let i=1;i<5;i++)assert.ok(stack[i].y<stack[i-1].y-18,'box '+i+' above the one below');
 const still=stack.map(b=>b.y);for(let i=0;i<60;i++)w.step(1/60);
 stack.forEach((b,i)=>near(b.y,still[i],'box '+i+' stays where it settled',0.2));
});

test('PH15 listeners that throw are told of after the others; a disposed world takes no more',()=>{
 const w=createPhysicsWorld(),seen=[];
 w.onContact(()=>{throw new Error('first');});
 const off=w.onContact(c=>seen.push(c.type));
 w.addBody({kind:'static',shape:box(10,10)});w.addBody({shape:box(10,10),x:5});
 assert.throws(()=>w.step(1/60),error=>error.code==='PHYSICS_LISTENER_FAILED'&&error.cause.message==='first');
 assert.deepEqual(seen,['begin']);
 off();off();
 assert.throws(()=>w.onContact(7),coded('PHYSICS_OPTIONS_INVALID'));
 const body=w.bodies[0];
 w.dispose();w.dispose();
 assert.deepEqual([w.state,w.bodies,body.state],['closed',[],'removed']);
 for(const call of [()=>w.step(1),()=>w.addBody({shape:circle(1)}),()=>w.onContact(()=>{}),()=>w.addTileColliders({columns:1,rows:1,tileWidth:1,tileHeight:1,solid:()=>true})])assert.throws(call,coded('PHYSICS_CLOSED'));
});

test('PH16 a strict consumer compiles against the entry, and five misuses are refused; the entry has its factory alone',async()=>{
 const {spawnSync}=await import('node:child_process');
 const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--project','tests/types/physics2d.json','--pretty','false'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.deepEqual(Object.keys(await import('@egret/engine/physics2d')),['createPhysicsWorld']);
 for(const entry of ['@egret/engine','@egret/engine/world3d','@egret/runtime'])assert.equal('createPhysicsWorld' in await import(entry),false,entry);
});

test('PH17 shapes are where they are put and turned as they are told: points, rectangles and bounds, edges included',()=>{
 const w=createPhysicsWorld(),ids=list=>list.map(b=>b.id);
 const ball=w.addBody({kind:'static',shape:circle(10),x:30,y:40});
 const bar=w.addBody({kind:'static',shape:box(20,10),x:100,y:0,angle:90,layer:2});
 const tri=w.addBody({kind:'static',shape:{kind:'polygon',points:[{x:0,y:0},{x:20,y:0},{x:0,y:20}]},x:200,y:0,layer:4});
 for(const [x,y,expected] of [[40,40,[ball.id]],[30,30,[ball.id]],[40.001,40,[]],[37,47,[ball.id]],[37.1,47.1,[]],
  [104,9,[bar.id]],[106,0,[]],[100,11,[]],[210,10,[tri.id]],[205,5,[tri.id]],[200,0,[tri.id]],[211,10,[]],[199,5,[]]])
  assert.deepEqual(ids(w.queryPoint(x,y)),expected,x+','+y);
 assert.deepEqual(ball.bounds(),{x:20,y:30,width:20,height:20});
 assert.deepEqual(tri.bounds(),{x:200,y:0,width:20,height:20});
 const turned=bar.bounds();
 near(turned.x,95,'turned x');near(turned.y,-10,'turned y');near(turned.width,10,'turned width');near(turned.height,20,'turned height');
 // A rectangle that only touches a shape still meets it; one a hair away does not.
 assert.deepEqual(ids(w.queryRect({x:40,y:39,width:5,height:2})),[ball.id]);
 assert.deepEqual(ids(w.queryRect({x:40.01,y:39,width:5,height:2})),[]);
 assert.deepEqual(ids(w.queryRect({x:220,y:0,width:5,height:5})),[tri.id]);
 assert.deepEqual(ids(w.queryRect({x:205,y:5,width:0,height:0})),[tri.id]);
 assert.deepEqual(ids(w.queryRect({x:0,y:-50,width:300,height:200},6)),[bar.id,tri.id]);
 assert.deepEqual(ids(w.queryPoint(40,40,2)),[]);
 const rect={x:0,y:0,width:1,height:1};
 for(const bad of [null,7,{...rect,x:NaN},{...rect,y:'0'},{...rect,width:Infinity},{...rect,height:undefined},{...rect,width:-1},{...rect,height:-0.5}])
  assert.throws(()=>w.queryRect(bad),coded('PHYSICS_OPTIONS_INVALID'),JSON.stringify(bad));
 assert.throws(()=>w.queryRect(rect,1.5),coded('PHYSICS_OPTIONS_INVALID'));
 assert.throws(()=>w.queryPoint(NaN,0),coded('PHYSICS_OPTIONS_INVALID'));
 assert.throws(()=>w.queryPoint(0,0,-1),coded('PHYSICS_OPTIONS_INVALID'));
});

test('PH18 a ray meets circles and polygons where they are, at their edges and ends exactly, and the nearest first',()=>{
 const w=createPhysicsWorld();
 const ball=w.addBody({kind:'static',shape:circle(10),x:30,y:40});
 const block=w.addBody({kind:'static',shape:box(20,20),x:100,y:0,layer:2});
 const tri=w.addBody({kind:'static',shape:{kind:'polygon',points:[{x:0,y:0},{x:20,y:0},{x:0,y:20}]},x:200,y:0,layer:4});
 const hit=(from,to,mask)=>{const h=w.raycast(from,to,mask);return h===undefined?undefined:[h.body.id,h.point.x,h.point.y,h.normal.x,h.normal.y,h.fraction];};
 const close=(actual,expected,label)=>{assert.ok(actual!==undefined,label+': no hit');actual.forEach((v,i)=>near(v,expected[i],label+' '+i,1e-9));};
 close(hit({x:-20,y:40},{x:80,y:40},1),[ball.id,20,40,-1,0,0.4],'circle from the left');
 close(hit({x:30,y:-10},{x:30,y:90},1),[ball.id,30,30,0,-1,0.4],'circle from above');
 close(hit({x:-20,y:50},{x:80,y:50},1),[ball.id,30,50,0,1,0.5],'circle grazed');
 assert.equal(hit({x:-20,y:50.5},{x:80,y:50.5},1),undefined,'circle missed');
 assert.equal(hit({x:30,y:40},{x:80,y:40},1),undefined,'from inside the circle');
 close(hit({x:20,y:40},{x:80,y:40},1),[ball.id,20,40,-1,0,0],'from its edge');
 assert.equal(hit({x:-20,y:40},{x:10,y:40},1),undefined,'short of the circle');
 close(hit({x:-20,y:40},{x:20,y:40},1),[ball.id,20,40,-1,0,1],'just to the circle');
 assert.equal(hit({x:-20,y:40},{x:-20,y:40},1),undefined,'no length');
 close(hit({x:50,y:0},{x:150,y:0},2),[block.id,90,0,-1,0,0.4],'box from the left');
 close(hit({x:100,y:-50},{x:100,y:50},2),[block.id,100,-10,0,-1,0.4],'box from above');
 assert.equal(hit({x:100,y:0},{x:150,y:0},2),undefined,'from inside the box');
 assert.equal(hit({x:50,y:20},{x:150,y:20},2),undefined,'alongside the box');
 close(hit({x:50,y:10},{x:150,y:10},2),[block.id,90,10,-1,0,0.4],'along its edge');
 assert.equal(hit({x:50,y:0},{x:85,y:0},2),undefined,'short of the box');
 close(hit({x:50,y:0},{x:90,y:0},2),[block.id,90,0,-1,0,1],'just to the box');
 close(hit({x:50,y:-50},{x:150,y:50},2),[block.id,90,-10,0,-1,0.4],'its corner, told by its first edge');
 const s=Math.SQRT1_2;
 close(hit({x:230,y:30},{x:200,y:0},4),[tri.id,210,10,s,s,2/3],'the slope of the triangle');
 close(hit({x:-20,y:40},{x:250,y:40}),[ball.id,20,40,-1,0,40/270],'the nearest of all');
 // Two bodies as near: the first added is told.
 const twin=w.addBody({kind:'static',shape:box(20,20),x:100,y:0,layer:8});
 close(hit({x:50,y:0},{x:150,y:0},10),[block.id,90,0,-1,0,0.4],'the first of two');
 w.removeBody(block);
 close(hit({x:50,y:0},{x:150,y:0},10),[twin.id,90,0,-1,0,0.4],'then the other');
 w.addBody({kind:'static',shape:box(20,20),x:60,y:0,layer:8,sensor:true});
 close(hit({x:0,y:0},{x:150,y:0},8),[twin.id,90,0,-1,0,0.6],'past a sensor');
});

test('PH19 polygons weigh by their area, are checked for convexity up to 64 corners, and meet circles at their corners',()=>{
 const w=createPhysicsWorld({maxBodies:1});
 const quad=w.addBody({shape:{kind:'polygon',points:[{x:5,y:5},{x:25,y:5},{x:35,y:15},{x:5,y:15}]},density:2});
 near(quad.mass,500,'the mass of a trapezoid');
 w.dispose();
 const ring=n=>Array.from({length:n},(_,i)=>({x:Math.cos(i*2*Math.PI/n)*50,y:Math.sin(i*2*Math.PI/n)*50}));
 const v=createPhysicsWorld();
 v.addBody({shape:{kind:'polygon',points:ring(64)}});
 v.addBody({shape:{kind:'polygon',points:ring(3)}});
 v.addBody({shape:{kind:'polygon',points:ring(3).reverse()}});
 assert.throws(()=>v.addBody({shape:{kind:'polygon',points:ring(65)}}),coded('PHYSICS_OPTIONS_INVALID'));
 assert.throws(()=>v.addBody({shape:box(0,1)}),coded('PHYSICS_OPTIONS_INVALID'));
 // Edges of the options that are allowed.
 for(const options of [{maxSteps:1},{maxSteps:120},{iterations:1},{iterations:64},{maxBodies:1},{maxBodies:65536},{fixedStep:1},{cellSize:0.5}])createPhysicsWorld(options).dispose();
 for(const options of [{restitution:0},{restitution:1},{friction:0},{layer:0},{mask:0xffffffff},{layer:0xffffffff}])v.addBody({shape:circle(1),...options});
 // A ball dropped on the corner of a ledge is pushed off it, away from the corner.
 const g=createPhysicsWorld({gravity:{x:0,y:500}});
 g.addBody({kind:'static',shape:box(400,20),x:0,y:100});
 const ball=g.addBody({shape:circle(10),x:205,y:0});
 for(let i=0;i<120;i++)g.step(1/60);
 assert.ok(ball.x>210&&ball.y>100,'off the ledge at '+ball.x+','+ball.y);
 // A triangle stands on its flat side.
 const t=createPhysicsWorld({gravity:{x:0,y:500}});
 t.addBody({kind:'static',shape:box(400,20),x:0,y:100});
 const tri=t.addBody({shape:{kind:'polygon',points:[{x:-10,y:0},{x:10,y:0},{x:0,y:-20}]},y:0});
 for(let i=0;i<180;i++)t.step(1/60);
 near(tri.y,90,'on its side',0.05);near(tri.x,0,'where it fell',1e-6);
});

test('PH20 who meets whom: circles that touch, a ball on a box, kinematic and static bodies, and contacts in the order of their ids',()=>{
 const w=createPhysicsWorld(),told=[];
 w.onContact(c=>told.push([c.type,c.a.id,c.b.id,c.normal.x,c.normal.y,c.sensor]));
 const a=w.addBody({shape:circle(5),x:20,y:0}),b=w.addBody({shape:circle(5),x:30,y:0});
 const c=w.addBody({shape:circle(5),x:100,y:20}),d=w.addBody({shape:circle(5),x:100,y:30});
 w.step(1/60);
 assert.deepEqual(told,[['begin',a.id,b.id,1,0,false],['begin',c.id,d.id,0,1,false]]);
 // Two circles at one place are parted up and down.
 const e=w.addBody({shape:circle(5),x:300,y:0}),f=w.addBody({shape:circle(5),x:300,y:0});
 told.length=0;w.step(1/60);
 assert.ok(f.y>e.y&&e.x===300&&f.x===300,'parted '+e.y+' '+f.y);
 assert.deepEqual(told.filter(t=>t[1]===e.id),[['begin',e.id,f.id,0,1,false]]);
 // Removing a body ends its own contacts and no others.
 told.length=0;w.removeBody(a);
 assert.deepEqual(told,[['end',a.id,b.id,1,0,false]]);
 assert.equal(w.snapshot().contacts,2);
 // A ball on a box: the normal points from the ball to the box.
 const g=createPhysicsWorld({gravity:{x:0,y:100}}),seen=[];
 const ball=g.addBody({shape:circle(5),x:0,y:0}),floor=g.addBody({kind:'static',shape:box(100,10),x:0,y:10});
 g.onContact(c=>seen.push([c.a.id,c.b.id,c.normal.x,c.normal.y]));
 g.step(1/60);
 assert.deepEqual(seen,[[ball.id,floor.id,0,1]]);
 for(let i=0;i<60;i++)g.step(1/60);
 near(ball.y,0,'resting on it',0.05);
 // A kinematic body passes through a static one untouched and untold, but a static sensor tells of it.
 const k=createPhysicsWorld(),heard=[];
 k.onContact(c=>heard.push([c.a.id,c.b.id,c.sensor]));
 const wall=k.addBody({kind:'static',shape:box(10,100),x:50}),mover=k.addBody({kind:'kinematic',shape:box(10,10),x:0,vx:600});
 for(let i=0;i<6;i++)k.step(1/60);
 near(mover.x,60,'through the wall');assert.deepEqual(heard,[]);
 const zone=k.addBody({kind:'static',shape:box(10,10),x:70,sensor:true});
 k.step(1/60);
 assert.deepEqual(heard,[[mover.id,zone.id,true]]);
 // Contacts are told in the order of their ids, whatever the order they were found in.
 const o=createPhysicsWorld(),order=[];
 o.onContact(c=>order.push([c.a.id,c.b.id]));
 const p1=o.addBody({shape:box(10,10),x:500}),p2=o.addBody({shape:box(10,10),x:0}),p3=o.addBody({shape:box(10,10),x:8}),p4=o.addBody({shape:box(10,10),x:508});
 o.step(1/60);
 assert.deepEqual(order,[[p1.id,p4.id],[p2.id,p3.id]]);
});

test('PH21 bodies are plain to look at; forces and impulses move only dynamic bodies; a static body keeps no speed',()=>{
 const w=createPhysicsWorld();
 const body=w.addBody({shape:box(1,1)}),still=w.addBody({kind:'static',shape:box(1,1),x:50}),moving=w.addBody({kind:'kinematic',shape:box(1,1),x:-50});
 assert.deepEqual(Object.keys(body).filter(key=>['x','y','angle','vx','vy','layer','mask','restitution','friction','gravityScale'].includes(key)).sort(),['angle','friction','gravityScale','layer','mask','restitution','vx','vy','x','y']);
 assert.equal({...body}.restitution,0);
 body.applyForce(60,0);w.step(1/60);
 near(body.vx,1,'a force for one step');
 w.step(1/60);near(body.vx,1,'and no longer');
 body.applyImpulse(2,0);near(body.vx,3,'an impulse');
 still.applyImpulse(5,5);still.applyForce(5,5);moving.applyImpulse(5,5);moving.applyForce(500,0);
 still.vx=10;moving.vx=10;
 w.step(1/60);
 assert.deepEqual([still.vx,still.vy,still.x,moving.vy],[0,0,50,0]);
 near(moving.vx,10,'kinematic keeps its speed');
 body.restitution=0;body.friction=0;
 assert.equal(w.step(0),0);
});

test('PH22 grid colliders: runs merged down while they match, offsets, groups and friction, and the grid asked only of its own cells',()=>{
 const grid=(rows,options={})=>{
  const asked=[],cells=rows.map(r=>[...r].map(c=>c==='#'));
  const g={columns:rows[0].length,rows:rows.length,tileWidth:10,tileHeight:10,solid:(c,r)=>{asked.push([c,r]);return cells[r]?.[c]??true;},...options};
  const w=createPhysicsWorld(),made=w.addTileColliders(g);
  assert.ok(asked.every(([c,r])=>c>=0&&c<g.columns&&r>=0&&r<g.rows),'asked out of the grid');
  return made.map(b=>{const box=b.bounds();return [box.x,box.y,box.width,box.height,b.layer,b.friction];});
 };
 assert.deepEqual(grid(['##..##','##..##','######']),[[0,0,20,20,1,0.3],[40,0,20,20,1,0.3],[0,20,60,10,1,0.3]]);
 assert.deepEqual(grid(['.##','###'],{x:100,y:200,layer:2,friction:0.5}),[[110,200,20,10,2,0.5],[100,210,30,10,2,0.5]]);
 assert.deepEqual(grid(['##','#.']),[[0,0,20,10,1,0.3],[0,10,10,10,1,0.3]]);
 assert.deepEqual(grid(['#','#','#']),[[0,0,10,30,1,0.3]]);
 assert.deepEqual(createPhysicsWorld().addTileColliders({columns:0,rows:0,tileWidth:1,tileHeight:1,solid:()=>true}),[]);
 const ok={columns:1,rows:1,tileWidth:1,tileHeight:1,solid:()=>true},w=createPhysicsWorld();
 for(const bad of [null,7,{...ok,columns:-1},{...ok,columns:1.5},{...ok,rows:-1},{...ok,rows:'1'},{...ok,tileWidth:0},{...ok,tileWidth:NaN},{...ok,tileHeight:0},{...ok,tileHeight:Infinity},
  {...ok,solid:true},{...ok,x:NaN},{...ok,y:'1'},{...ok,layer:-1},{...ok,friction:-1},{...ok,friction:NaN},{...ok,columns:4097,rows:4097}])
  assert.throws(()=>w.addTileColliders(bad),coded('PHYSICS_OPTIONS_INVALID'),JSON.stringify(bad));
 // A character moving along a floor it sinks into a little is lifted out and goes on, told of the floor.
 const m=createPhysicsWorld();
 m.addBody({kind:'static',shape:box(400,20),x:0,y:20});
 const hero=m.addBody({kind:'kinematic',shape:box(10,10),x:0,y:5.5});
 const moved=m.moveAndSlide(hero,30,0);
 near(moved.x,30,'along');near(moved.y,5,'lifted');
 assert.deepEqual(moved.normals[0],{x:0,y:-1});
});

test('PH23 what meets slower than the bounce threshold does not bounce, so a bouncing ball comes to rest; a display is placed when its body is added',()=>{
 const settle=options=>{
  const w=createPhysicsWorld({gravity:{x:0,y:600},...options});
  w.addBody({kind:'static',shape:box(400,20),x:0,y:100});
  const ball=w.addBody({shape:circle(10),y:0,restitution:0.8});
  const speeds=[];
  for(let i=0;i<600;i++){w.step(1/60);if(i>=540)speeds.push(Math.abs(ball.vy));}
  return {ball,fastest:Math.max(...speeds)};
 };
 // By default the threshold is twice what gravity gives in a step: 20 here. The ball bounces, lower each time, then rests.
 const rested=settle({});
 assert.equal(rested.fastest,0);near(rested.ball.y,80,'at rest',0.02);
 // With no threshold the weight of each step is thrown back up a little, and the ball never quite rests.
 assert.ok(settle({bounceThreshold:0}).fastest>1,'it keeps trembling');
 // A threshold above the speed it falls at: it does not bounce at all.
 const dead=settle({bounceThreshold:1e6});
 assert.equal(dead.fastest,0);
 for(const bounceThreshold of [-1,NaN,'1'])assert.throws(()=>createPhysicsWorld({bounceThreshold}),coded('PHYSICS_OPTIONS_INVALID'));
 const display=new DisplayObjectContainer(),w=createPhysicsWorld();
 w.addBody({shape:circle(1),x:12,y:34,angle:45,display});
 assert.deepEqual([display.x,display.y,display.rotation],[12,34,45]);
});
