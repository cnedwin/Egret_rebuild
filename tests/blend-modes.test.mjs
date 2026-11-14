// SPDX-License-Identifier: Apache-2.0
// Blend modes by Egret's names: a view over the blend of the shared material, captured for each draw, and the erase blend in both hosts.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {sharedWebGL2BlendFactors} from '../packages/engine/dist/web/sharedWebGL2Shaders.js';
import {createSharedWebGPUPipeline,SHARED_BLENDS} from '../packages/engine/dist/web/webgpuSharedPass.js';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
const NAMES=[['normal','normal'],['add','add-accumulate'],['multiply','multiply-factor'],['screen','screen'],['erase','erase']];

test('BM01 blendMode reads and sets the blend of the material, keeping its tints, and refuses what it does not name',async()=>{
 const engine=await egret.createEngine({host:host().adapter});
 try{
  const node=new egret.DisplayObjectContainer();
  assert.deepEqual([node.blendMode,node.sharedMaterial],['normal',null]);
  // Normal on a node without a material leaves it without one.
  node.blendMode='normal';assert.equal(node.sharedMaterial,null);
  // Once it has a material, normal is a material with the normal blend.
  for(const [name,blend] of [NAMES[1],NAMES[2],NAMES[0],NAMES[3],NAMES[4]]){node.blendMode=name;assert.deepEqual([node.blendMode,node.sharedMaterial?.blend],[name,blend],name);}
  const tinted=new egret.DisplayObjectContainer();
  tinted.sharedMaterial=egret.createSharedMaterial2D({light:[1,.5,.25,.5],dark:[.25,.125,.5],filter:'linear',samplingDomain:'page',addressU:'repeat'});
  tinted.blendMode='screen';
  const m=tinted.sharedMaterial;
  assert.deepEqual([m.blend,m.light,m.dark,m.filter,m.samplingDomain,m.addressU],['screen',[1,.5,.25,.5],[.25,.125,.5],'linear','page','repeat']);
  // The same blend again changes nothing; a material set later is what the mode reads.
  tinted.blendMode='screen';assert.equal(tinted.sharedMaterial,m);
  tinted.sharedMaterial=egret.createSharedMaterial2D({blend:'add-preserve'});assert.equal(tinted.blendMode,'add');
  tinted.sharedMaterial=null;assert.equal(tinted.blendMode,'normal');
  for(const value of ['ADD','overlay','toString','__proto__','constructor',7,null,undefined,{}])assert.throws(()=>{node.blendMode=value;},coded('DISPLAY_VALUE_INVALID'),String(value));
  assert.equal(node.blendMode,'erase');
  node.dispose();
  assert.throws(()=>{node.blendMode='add';});
 }finally{await engine.dispose();}
});

test('BM02 a blend mode reaches every draw beneath it, and a child with its own material keeps its own',async()=>{
 const engine=await egret.createEngine({host:host().adapter});
 try{
  const glow=engine.stage.addChild(new egret.DisplayObjectContainer()),plain=engine.stage.addChild(new egret.Sprite());
  const inner=glow.addChild(new egret.Sprite()),own=glow.addChild(new egret.Sprite());
  for(const sprite of [inner,own,plain])sprite.graphics.beginFill(0xff0000).drawRect(0,0,4,4).endFill();
  glow.blendMode='add';own.blendMode='erase';
  const frame=engine.captureSharedFrame({width:8,height:8});
  const blends=frame.commands.filter(c=>c.kind==='rect').map(c=>frame.materials[c.materialIndex].blend);
  assert.deepEqual(blends,['add-accumulate','erase','normal']);
  glow.blendMode='normal';
  const again=engine.captureSharedFrame({width:8,height:8});
  assert.deepEqual(again.commands.filter(c=>c.kind==='rect').map(c=>again.materials[c.materialIndex].blend),['normal','erase','normal']);
 }finally{await engine.dispose();}
});

test('BM03 erase is a material blend, and both hosts take away from the target by the alpha of what is drawn',async()=>{
 assert.equal(egret.createSharedMaterial2D({blend:'erase'}).blend,'erase');
 assert.throws(()=>egret.createSharedMaterial2D({blend:'subtract'}),TypeError);
 // WebGL2: ZERO and ONE_MINUS_SRC_ALPHA for colour and alpha alike.
 assert.deepEqual(sharedWebGL2BlendFactors('erase'),[0,771,0,771]);
 assert.deepEqual(NAMES.map(([,blend])=>sharedWebGL2BlendFactors(blend)),[[1,771,1,771],[1,1,1,1],[774,771,1,771],[1,769,1,771],[0,771,0,771]]);
 assert.ok(SHARED_BLENDS.includes('erase'));
 const states={};
 for(const blend of SHARED_BLENDS)await createSharedWebGPUPipeline(()=>({}),async descriptor=>{states[blend]=descriptor.fragment.targets[0].blend;return {};},'solid',blend);
 assert.deepEqual(states.erase,{color:{operation:'add',srcFactor:'zero',dstFactor:'one-minus-src-alpha'},alpha:{operation:'add',srcFactor:'zero',dstFactor:'one-minus-src-alpha'}});
 assert.deepEqual(states.normal.color,{operation:'add',srcFactor:'one',dstFactor:'one-minus-src-alpha'});
 // What erasing gives, worked out: a destination of (0.5, 0.25, 0, 0.75) under a source of alpha 0.6 keeps 0.4 of itself.
 const erase=(source,target)=>target.map(v=>v*(1-source[3]));
 assert.deepEqual(erase([0.2,0.9,0.1,0.6],[0.5,0.25,0,0.75]).map(v=>Math.round(v*1e6)/1e6),[0.2,0.1,0,0.3]);
});
