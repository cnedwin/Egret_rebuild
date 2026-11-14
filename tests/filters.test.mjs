// SPDX-License-Identifier: Apache-2.0
// Filters on render effects: Egret's colour matrix, glow and drop shadow, and an outline — what is accepted, what a frame
// carries, and what each group's uniform holds for both hosts.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {prepareEffects2D} from '../packages/engine/dist/rendering/sharedEffects2D.js';
import {EFFECT_PASSES,EFFECT_UNIFORM_BYTES,sharedEffectGLSL} from '../packages/engine/dist/web/sharedEffectShaders.js';
import {host} from './helpers.mjs';

const coded=code=>error=>error?.code===code;
const GREY=[0.3086,0.6094,0.082,0,0,0.3086,0.6094,0.082,0,0,0.3086,0.6094,0.082,0,0,0,0,0,1,0];
const decode=c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;
async function withEngine(run){const engine=await egret.createEngine({host:host().adapter});try{await run(engine);}finally{await engine.dispose();}}

test('FI01 a colour matrix, a glow or an outline is checked, copied and frozen, with Egret\'s defaults',async()=>withEngine(async()=>{
 const node=new egret.DisplayObjectContainer(),source=[...GREY];
 node.renderEffect={colorMatrix:source,glow:{color:0xffc040}};
 source[0]=9;
 const e=node.renderEffect;
 assert.deepEqual([e.blurRadius,e.colorMatrix,e.glow],[0,GREY,{color:0xffc040,alpha:1,blur:6,strength:2,inner:false,knockout:false,offsetX:0,offsetY:0}]);
 assert.ok(Object.isFrozen(e)&&Object.isFrozen(e.colorMatrix)&&Object.isFrozen(e.glow));
 node.renderEffect={outline:{color:0xe04040,width:3}};
 assert.deepEqual(node.renderEffect.outline,{color:0xe04040,width:3,alpha:1});
 node.renderEffect={glow:{color:0,alpha:0,blur:0,strength:0,inner:true,knockout:true,offsetX:-256,offsetY:256}};
 node.renderEffect={glow:{color:0xffffff,alpha:1,blur:16,strength:255}};
 node.renderEffect={outline:{color:0,width:1,alpha:0}};node.renderEffect={outline:{color:0,width:8}};
 const bad=[{colorMatrix:GREY.slice(1)},{colorMatrix:[...GREY,0]},{colorMatrix:'grey'},{colorMatrix:[...GREY.slice(1),NaN]},{colorMatrix:[...GREY.slice(1),70000]},
  {glow:null},{glow:7},{glow:{}},{glow:{color:-1}},{glow:{color:0x1000000}},{glow:{color:1.5}},{glow:{color:0,alpha:1.1}},{glow:{color:0,blur:17}},{glow:{color:0,blur:-1}},
  {glow:{color:0,strength:256}},{glow:{color:0,inner:1}},{glow:{color:0,knockout:'yes'}},{glow:{color:0,offsetX:257}},{glow:{color:0,offsetY:NaN}},
  {outline:{color:0}},{outline:{color:0,width:0.5}},{outline:{color:0,width:9}},{outline:{color:0,width:2,alpha:-0.1}},{outline:null},
  {glow:{color:0},outline:{color:0,width:1}}];
 for(const effect of bad)assert.throws(()=>{node.renderEffect=effect;},coded('DISPLAY_EFFECT_INVALID'),JSON.stringify(effect));
 assert.deepEqual(node.renderEffect.outline,{color:0,width:8,alpha:1});
}));

test('FI02 a frame carries the matrix and one kind of spread for each effect group',async()=>withEngine(async engine=>{
 const make=effect=>{const holder=engine.stage.addChild(new egret.DisplayObjectContainer()),tile=holder.addChild(new egret.Sprite());tile.graphics.beginFill(0x3fa7d6).drawRect(0,0,8,8).endFill();holder.renderEffect=effect;return holder;};
 make({colorMatrix:GREY,blurRadius:2});
 make({glow:{color:0x102030,alpha:0.5,blur:3,strength:4,inner:true,offsetX:2,offsetY:-1}});
 make({outline:{color:0xe04040,width:3,alpha:0.25}});
 make({blurRadius:1});
 const frame=engine.captureSharedFrame({width:32,height:32});
 const effects=frame.commands.filter(c=>c.kind==='barrier'&&c.reason==='effect-enter').map(c=>c.effect);
 assert.equal(effects.length,4);
 assert.deepEqual([effects[0].blurRadius,effects[0].colorMatrix,effects[0].glow],[2,GREY,undefined]);
 assert.deepEqual(effects[1].glow,{kind:'glow',color:0x102030,alpha:0.5,spread:3,strength:4,inner:true,knockout:false,offsetX:2,offsetY:-1});
 assert.deepEqual(effects[2].glow,{kind:'outline',color:0xe04040,alpha:0.25,spread:3,strength:1,inner:false,knockout:false,offsetX:0,offsetY:0});
 assert.deepEqual([effects[3].colorMatrix,effects[3].glow],[undefined,undefined]);
 assert.ok(Object.isFrozen(effects[1].glow));
 // The same settings give the same glow each frame.
 const again=engine.captureSharedFrame({width:32,height:32}).commands.filter(c=>c.kind==='barrier'&&c.reason==='effect-enter').map(c=>c.effect);
 assert.equal(again[1].glow,effects[1].glow);
}));

test('FI03 each group\'s uniform holds the matrix, the spread in backing pixels, the colour in linear light and the offset',async()=>withEngine(async engine=>{
 const make=effect=>{const holder=engine.stage.addChild(new egret.DisplayObjectContainer()),tile=holder.addChild(new egret.Sprite());tile.graphics.beginFill(0x3fa7d6).drawRect(0,0,8,8).endFill();holder.renderEffect=effect;};
 make({colorMatrix:GREY});
 make({glow:{color:0x804020,alpha:0.5,blur:3,strength:4,inner:true,knockout:true,offsetX:2.4,offsetY:-1.5}});
 make({outline:{color:0xe04040,width:3}});
 make({glow:{color:0,blur:12}});
 make({blurRadius:1});
 const prepared=prepareEffects2D(engine.captureSharedFrame({width:32,height:32}),2,true);
 assert.equal(EFFECT_UNIFORM_BYTES,576);
 assert.deepEqual([prepared.groups.length,prepared.uniformBytes],[5,5*576]);
 const [matrix,glow,outline,wide,plain]=prepared.groups;
 for(const g of prepared.groups)assert.equal(g.uniform.length,144);
 assert.deepEqual([matrix.uniform[112],matrix.uniform[113],matrix.spread],[1,0,-1]);
 const f=Math.fround;
 assert.deepEqual(Array.from(matrix.uniform.slice(124,140)),[0,1,2,3].flatMap(row=>GREY.slice(row*5,row*5+4).map(f)));
 assert.deepEqual(Array.from(matrix.uniform.slice(140,144)),[0,0,0,0]);
 // A glow of 3 logical pixels at a ratio of 2 spreads 6 backing pixels; its offset is rounded to backing pixels.
 assert.deepEqual([glow.spread,glow.uniform[112],glow.uniform[113],glow.uniform[114],glow.uniform[115]],[6,0,1,6,4]);
 assert.deepEqual(Array.from(glow.uniform.slice(116,124)),[0x80,0x40,0x20].map(v=>f(decode(v/255))).concat([0.5,5,-3,1,1]));
 assert.deepEqual([outline.spread,outline.uniform[113],outline.uniform[115],outline.uniform[119]],[6,2,1,1]);
 // The spread is at most sixteen backing pixels, as the blur is.
 assert.deepEqual([wide.spread,wide.uniform[114]],[16,16]);
 assert.deepEqual([plain.spread,plain.radius,plain.uniform[112],plain.uniform[113]],[-1,2,0,0]);
 // With a matrix that has offsets they are carried in 0 to 1.
 const node=engine.stage.addChild(new egret.DisplayObjectContainer());node.addChild(new egret.Sprite()).graphics.beginFill(0).drawRect(0,0,1,1).endFill();
 node.renderEffect={colorMatrix:[1,0,0,0,255,0,1,0,0,-51,0,0,1,0,0,0,0,0,1,0]};
 const last=prepareEffects2D(engine.captureSharedFrame({width:32,height:32}),1,true).groups.at(-1);
 assert.deepEqual(Array.from(last.uniform.slice(140,144)),[1,f(-0.2),0,0]);
}));

test('FI04 both hosts have the spread pass, and the composite reads the spread, the mask and the group',()=>{
 assert.deepEqual(EFFECT_PASSES,['horizontal','vertical','spread','composite']);
 const composite=sharedEffectGLSL('composite'),spread=sharedEffectGLSL('spread');
 assert.match(composite,/vec4 params\[36\]/);assert.match(composite,/glowTexture/);assert.match(composite,/params\[31\]/);
 assert.match(spread,/fragmentColor=vec4\(0\.0,0\.0,0\.0,g\)/);
 // The stage's y runs down and a GL target's up: the spread of the offset turns its y round.
 assert.match(spread,/-int\(params\[30\]\.y\)/);
});
