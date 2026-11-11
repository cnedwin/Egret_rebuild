// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import {createImageData2D} from '@egret/engine';
import {isSceneFrame3D} from '@egret/engine/scene3d';
import {createSceneCamera3D,createSceneWorld3D,createSceneWorldCard3D,loadStaticGlbScene3D} from '@egret/engine/scene3d/authoring';

import {createPanelGlb} from '../examples/authored-scene3d/room-glb.mjs';

const source=createImageData2D({width:3,height:4,pixels:new Uint8Array(48)});
const transform=(x=0,y=0,z=0)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
const camera=createSceneCamera3D({
  eye:[0,0,4],target:[0,0,0],projection:{kind:'orthographic',height:10,aspect:1,near:0.1,far:100},
});

test('authored card retains atlas identity, a pivot outside its crop, and its exact uniform cost',()=>{
  const region={x:1,y:1,width:2,height:2};
  const card=createSceneWorldCard3D({source,region,width:2,height:4,pivotX:0.5,pivotY:3});
  region.x=0;
  const world=createSceneWorld3D([{id:'actor',localMatrix:transform(),cards:[card]}]);
  const frame=world.capture(camera),draw=frame.cards[0];
  assert.equal(isSceneFrame3D(frame),true);
  assert.equal(frame.draws.length,0);
  assert.equal(frame.uniformBytes,112);
  assert.equal(draw.source,source);
  assert.deepEqual(draw.region,[1,1,2,2]);
  assert.deepEqual(draw.bounds,[-0.5,2,1.5,6]);
  assert.equal(draw.alphaCutoff,128);
  assert.ok(Object.isFrozen(draw.region)&&Object.isFrozen(draw.bounds)&&Object.isFrozen(frame.cards));
  const next=world.withNodeTransform('actor',transform(1,0,1)).capture(camera);
  assert.notDeepEqual(next.cards[0].mvp,draw.mvp);
  assert.equal(next.cards[0].source,source);
  assert.deepEqual(world.capture(camera).cards[0].mvp,draw.mvp);
});

test('card admission rejects foreign identity, bad atlas bounds, cutoff and uniform overflow',()=>{
  const input={source,width:1,height:1};
  const invalid={code:'SCENE3D_INPUT_INVALID'};
  assert.throws(()=>createSceneWorldCard3D({...input,source:{...source}}),invalid);
  assert.throws(()=>createSceneWorldCard3D({...input,region:{x:2,y:0,width:2,height:1}}),invalid);
  assert.throws(()=>createSceneWorldCard3D({...input,alphaCutoff:0}),invalid);
  assert.throws(()=>createSceneWorldCard3D({...input,pivotY:Infinity}),invalid);
  const card=createSceneWorldCard3D(input);
  assert.throws(()=>createSceneWorld3D([{id:'foreign',localMatrix:transform(),cards:[{...card}]}]),invalid);
  const world=createSceneWorld3D([{id:'many',localMatrix:transform(),cards:Array(37).fill(card)}]);
  assert.throws(()=>world.capture(camera),{code:'SCENE3D_BUDGET'});
});

test('compose a card into an imported world without altering the saved imported revision',()=>{
  const imported=loadStaticGlbScene3D(createPanelGlb());
  const card=createSceneWorldCard3D({source,width:1,height:1});
  const actor={id:'actor',parentId:'gltf-node-0',localMatrix:transform(0,0,1),cards:[card]};
  const mixed=imported.withNodes([actor]);
  assert.equal(mixed.nodeCount,imported.nodeCount+1);
  const old=imported.capture(camera),next=mixed.capture(camera);
  assert.equal(old.cards,undefined);
  assert.equal(next.cards.length,1);
  assert.equal(next.uniformBytes,old.uniformBytes+112);
  assert.deepEqual(next.draws,old.draws);
  assert.throws(()=>mixed.withNodes([actor]),{code:'SCENE3D_INPUT_INVALID'});
});
