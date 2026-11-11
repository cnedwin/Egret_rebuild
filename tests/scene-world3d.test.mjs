// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import {createMeshGeometry3D,createSceneFrame3D,isSceneFrame3D} from '@egret/engine/scene3d';
import {createAssetRef,createAssetType,createEngine} from '@egret/engine';
import {createSceneCamera3D,createSceneWorld3D,loadStaticGlbScene3D} from '@egret/engine/scene3d/authoring';
import {createPanelGlb} from '../examples/authored-scene3d/room-glb.mjs';

const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const translate=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
const geometry=createMeshGeometry3D({
  positions:[-0.5,-0.5,0,0.5,-0.5,0,0,0.5,0],
  colors:[1,0,0,0,1,0,0,0,1],indices:[0,1,2],
});
const projection={kind:'perspective',verticalFov:Math.PI/3,aspect:4/3,near:0.1,far:1000};
const camera=()=>createSceneCamera3D({eye:[2,1,5],target:[0,0,0],projection});
const parent={id:'room',localMatrix:identity};
const child={id:'actor',parentId:'room',localMatrix:translate(0.3,0,0),meshes:[geometry]};

test('authored camera captures a genuine scene at ordinary perspective and non-axis view',()=>{
  const world=createSceneWorld3D([child,parent,{id:'other',localMatrix:translate(-1,0,-1),meshes:[geometry]}]);
  const frame=world.capture(camera());
  assert.equal(world.nodeCount,3);
  assert.equal(isSceneFrame3D(frame),true);
  assert.equal(frame.draws.length,2);
  assert.equal(frame.geometries.length,1);
  assert.ok(frame.draws.every(draw=>draw.mvp.every(value=>Math.fround(value)===value)));
  assert.notDeepEqual(frame.draws[0].mvp,frame.draws[1].mvp);
  // The frozen legacy experiment still refuses an inexact binary32 matrix.
  assert.throws(()=>createSceneFrame3D({
    projection:{kind:'perspective',left:-0.1,right:0.1,bottom:-0.1,top:0.1,near:0.1,far:1000},
    draws:[{geometry,modelView:translate(0,0,-5)}],
  }),{code:'SCENE3D_PRECISION_UNSUPPORTED'});
});

test('a finite subnormal look-at cross product still yields a unit camera basis',()=>{
  const world=createSceneWorld3D([{...parent,meshes:[geometry]}]);
  const base={eye:[1,1,0],target:[0,0,0],projection:{kind:'orthographic',height:2,aspect:1,near:0,far:4}};
  const capture=up=>world.capture(createSceneCamera3D({...base,up})).draws[0].mvp;
  const normal=capture([1,1,1]);
  const tiny=capture([1,1,1e-323]);
  assert.deepEqual(tiny,normal);
  const right=[tiny[0],tiny[4],tiny[8]];
  const vertical=[tiny[1],tiny[5],tiny[9]];
  assert.ok(Math.abs(Math.hypot(...right)-1)<1e-7);
  assert.ok(Math.abs(Math.hypot(...vertical)-1)<1e-7);
});

test('an edit to a parent changes child placement without mutating saved geometry or frames',()=>{
  const rootMatrix=identity.slice();
  const world=createSceneWorld3D([{...parent,localMatrix:rootMatrix},child]);
  rootMatrix[12]=6;
  const stableCamera=camera(),before=world.capture(stableCamera);
  const edited=world.withNodeTransform('room',translate(1,0,0));
  const changed=edited.capture(stableCamera);
  assert.notDeepEqual(changed.draws[0].mvp,before.draws[0].mvp);
  assert.deepEqual(world.capture(stableCamera).draws[0].mvp,before.draws[0].mvp);
  assert.equal(changed.draws[0].geometry,before.draws[0].geometry);
  assert.throws(()=>edited.withNodeTransform('absent',identity),{code:'SCENE3D_INPUT_INVALID'});
});

test('scene graph and cameras reject invalid hierarchy, geometry, perspective and caps',()=>{
  const invalid={code:'SCENE3D_INPUT_INVALID'};
  assert.throws(()=>createSceneWorld3D([child]),invalid);
  assert.throws(()=>createSceneWorld3D([parent,parent]),invalid);
  assert.throws(()=>createSceneWorld3D([{...parent,parentId:'actor'},child]),invalid);
  assert.throws(()=>createSceneWorld3D([{...parent,meshes:[{...geometry}]}]),invalid);
  assert.throws(()=>createSceneCamera3D({eye:[0,0,0],target:[0,0,0],projection}),invalid);
  assert.throws(()=>createSceneCamera3D({eye:[0,0,1],target:[0,0,0],up:[0,0,1],projection}),invalid);
  assert.throws(()=>createSceneCamera3D({eye:[0,0,1],target:[0,0,0],projection:{...projection,verticalFov:Math.PI}}),invalid);
  const world=createSceneWorld3D([parent]);
  assert.throws(()=>world.capture({...camera()}),invalid);
  const draws=Array.from({length:65},(_,index)=>({...parent,id:String(index),meshes:[geometry]}));
  assert.throws(()=>createSceneWorld3D(draws),{code:'SCENE3D_BUDGET'});
});

test('existing AssetManager and Scope keep a published GLB world through a failed replacement',async()=>{
  const engine=await createEngine({
    host:{surface:{},start(){},stop(){},async close(){},setTimeout(){return ()=>{};}},
  });
  const scope=engine.createScope();
  const produced=new WeakSet();
  let disposed=0;
  const type=createAssetType('world-glb-test',value=>produced.has(value));
  engine.assets.register(type,{
    async load(ref){
      const bytes=ref.id==='broken'?new Uint8Array([0,1,2]):createPanelGlb();
      const world=loadStaticGlbScene3D(bytes);
      produced.add(world);
      return world;
    },
    dispose(){disposed++;},
  });
  try{
    const loaded=scope.use(await engine.assets.acquire(createAssetRef(type,'room')));
    const before=loaded.value.capture(camera());
    await assert.rejects(engine.assets.acquire(createAssetRef(type,'broken')));
    assert.deepEqual(loaded.value.capture(camera()).draws,before.draws);
    scope.dispose();
    assert.throws(()=>loaded.value,{code:'ASSET_LEASE_RELEASED'});
    assert.equal(disposed,1);
  }finally{await engine.dispose();}
});
