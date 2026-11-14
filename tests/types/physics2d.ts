// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the 2D physics entry: what it may write, and five things it may not.
import {createPhysicsWorld} from '@egret/engine/physics2d';
import type {PhysicsBody,PhysicsBodyKind,PhysicsBodyOptions,PhysicsContact,PhysicsMoveResult,PhysicsRayHit,PhysicsShape,PhysicsSnapshot,PhysicsTileColliders,PhysicsVector,PhysicsWorld,PhysicsWorldOptions} from '@egret/engine/physics2d';
import type {DisplayObject,Scope} from '@egret/engine';
declare const scope:Scope,sprite:DisplayObject;
const options:PhysicsWorldOptions={gravity:{x:0,y:600},fixedStep:1/60,maxSteps:5,iterations:8,cellSize:64,maxBodies:1000};
const world:PhysicsWorld=scope.use(createPhysicsWorld(options));
const shape:PhysicsShape={kind:'polygon',points:[{x:0,y:0},{x:10,y:0},{x:0,y:10}]},kind:PhysicsBodyKind='dynamic';
const body:PhysicsBody=world.addBody({kind,shape,x:1,y:2,angle:0,vx:0,vy:0,density:2,restitution:0.2,friction:0.4,gravityScale:1,layer:1,mask:3,sensor:false,display:sprite,data:{name:'crate'}} satisfies PhysicsBodyOptions);
body.x=5;body.vx=10;body.applyImpulse(1,0);body.applyForce(0,-5);const mass:number=body.mass;void mass;
const grid:PhysicsTileColliders={columns:10,rows:10,tileWidth:16,tileHeight:16,solid:(column,row)=>column===row};
const walls:readonly PhysicsBody[]=world.addTileColliders(grid);void walls;
const off:()=>void=world.onContact((contact:PhysicsContact)=>{const n:PhysicsVector=contact.normal;void n;});off();
const steps:number=world.step(1/60),hit:PhysicsRayHit|undefined=world.raycast({x:0,y:0},{x:100,y:0}),moved:PhysicsMoveResult=world.moveAndSlide(body,1,1);void steps;void hit;void moved;
const picture:PhysicsSnapshot=world.snapshot(),inside:readonly PhysicsBody[]=world.queryPoint(1,1),near:readonly PhysicsBody[]=world.queryRect({x:0,y:0,width:10,height:10},1);void picture;void inside;void near;
world.removeBody(body);
// @ts-expect-error a body needs a shape
world.addBody({x:1});
// @ts-expect-error a shape is a circle, a box or a polygon
world.addBody({shape:{kind:'capsule',radius:1}});
// @ts-expect-error the mass follows from the shape and its density
body.mass=3;
// @ts-expect-error a ray goes from a point to a point
world.raycast(0,100);
// @ts-expect-error a snapshot is read, not written
picture.steps=0;
