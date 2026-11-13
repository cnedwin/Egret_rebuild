// SPDX-License-Identifier: Apache-2.0
// Public behavior and controlled admission; native pixels have separate receipts.
import test from 'node:test';import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {hosted} from './shared-frame-upload-gl-fixture.mjs';
async function scene(body){const engine=await egret.createEngine({host:{surface:{},start(){},stop(){},async close(){},setTimeout(){return()=>{};}}}),scope=engine.createScope();
 const group=scope.use(new egret.Sprite());engine.stage.addChild(group);group.graphics.beginFill(0xff0000).drawRect(0,0,10,10).endFill();
 try{await body({engine,scope,group,capture:()=>engine.captureSharedFrame({width:64,height:64})});}finally{scope.dispose();await engine.dispose();}}
test('effect descriptor copies bounds and old capture remains independent',()=>scene(async f=>{
 const type=egret.createAssetType('effects-mask',egret.isTexture);f.engine.assets.register(type,{async load(){return egret.createTexture(egret.createImageData2D({width:1,height:1,pixels:new Uint8Array([255,255,255,128])}));},dispose(t){t.dispose();}});
 const lease=f.scope.use(await f.engine.assets.acquire(egret.createAssetRef(type,'mask'))),mask=f.scope.use(new egret.Bitmap(lease)),rect={x:0,y:0,width:10,height:10};
 f.group.renderEffect={blurRadius:2,alphaMask:mask,maskRect:rect};rect.width=1;
 const old=f.capture(),entry=old.commands.find(c=>c.reason==='effect-enter');assert.equal(entry.effect.maskRect.width,10);assert.equal(old.pages.length,1);assert.equal(entry.effect.maskPageIndex,0);
 f.group.renderEffect=undefined;assert.equal(f.capture().commands.some(c=>c.reason==='effect-enter'),false);assert.equal(entry.effect.blurRadius,2);assert.ok(Object.isFrozen(f.group.renderEffect??entry.effect));
 f.group.renderEffect={alphaMask:mask,maskRect:{x:0,y:0,width:10,height:10}};mask.dispose();assert.throws(()=>f.capture());
}));
for(const invalid of [-1,1.5,9,NaN,Infinity,'2'])test('invalid blur radius '+String(invalid)+' preserves prior state',()=>scene(f=>{f.group.renderEffect={blurRadius:1};assert.throws(()=>{f.group.renderEffect={blurRadius:invalid};});assert.equal(f.group.renderEffect.blurRadius,1);}));
test('nested effects preserve painter boundaries and final clips',()=>scene(f=>{
 const child=f.scope.use(new egret.Sprite());child.graphics.beginFill(0x00ff00).drawRect(1,1,2,2).endFill();f.group.addChild(child);f.group.clipRect={x:2,y:2,width:4,height:4};f.group.renderEffect={blurRadius:2};child.renderEffect={blurRadius:1};
 const frame=f.capture(),entries=frame.commands.filter(c=>c.reason?.startsWith('effect-'));assert.deepEqual(entries.map(c=>c.reason),['effect-enter','effect-enter','effect-exit','effect-exit']);assert.equal(entries[0].effect.clips.length,1);assert.equal(entries[1].effect.clips.length,0);assert.equal(entries[0].boundaryId,entries[3].boundaryId);
 assert.equal(frame.commands.find(c=>c.kind==='rect').clips.length,0);
}));
test('disposed effect owner refuses writes',()=>scene(f=>{f.group.dispose();assert.throws(()=>{f.group.renderEffect={blurRadius:1};});}));
test('effects require explicit Host capability before native allocation',()=>hosted(async f=>{f.sprite.renderEffect={blurRadius:1};const frame=f.frame(),before=f.ports.events.length;assert.throws(()=>f.stage(frame));assert.equal(f.ports.events.length,before);assert.equal(f.host.getStatus().pendingFrames,0);}));
test('effect clip references honor the configured common clip budget',()=>hosted(async f=>{
 const parent=f.scope.use(new egret.Sprite());parent.clipRect={x:0,y:0,width:8,height:8};f.engine.stage.addChild(parent);parent.addChild(f.sprite);f.sprite.clipRect={x:0,y:0,width:6,height:6};f.sprite.renderEffect={blurRadius:1};const before=f.ports.events.length;
 assert.throws(()=>f.stage(f.frame()),e=>e.code==='WEBGL2_FRAME_BUDGET');assert.equal(f.ports.events.length,before);
},{options:{enableEffects:true,maxClipRectangles:1}}));
test('aggregate color targets refuse over-budget frame before allocation',()=>hosted(async f=>{
 f.sprite.renderEffect={blurRadius:1};const before=f.ports.events.length;assert.throws(()=>f.stage(f.frame(3000,3000)),e=>e.code==='WEBGL2_FRAME_BUDGET');assert.equal(f.ports.events.length,before);
},{options:{enableEffects:true,enableReadback:false}}));
test('fifth nested group refuses before allocation',()=>hosted(async f=>{
 let parent=f.sprite;for(let i=0;i<5;i++){parent.renderEffect={blurRadius:1};const child=f.scope.use(new egret.Sprite());child.graphics.beginFill(0xff0000).drawRect(0,0,1,1).endFill();parent.addChild(child);parent=child;}
 const before=f.ports.events.length;assert.throws(()=>f.stage(f.frame()));assert.equal(f.ports.events.length,before);
},{options:{enableEffects:true}}));
