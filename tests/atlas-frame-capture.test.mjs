// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {egret,PROFILE,A,B,LA,LB,frames,fixture,options} from './atlas-frame-fixture.mjs';
function near(actual,want){for(const k of Object.keys(want))assert.ok(Math.abs(actual[k]-want[k])<1e-12,k+': '+actual[k]+' != '+want[k]);}
function exact(actual,want){for(const k of Object.keys(want))assert.equal(actual[k]===0?0:actual[k],want[k],k);}
const captures=f=>[f.engine.captureFrame(options),f.engine.captureTexturedFrame(options)];
// Break: packed crop draws on logical dimensions or clockwise packing is not inverted.
test('TR08 both capture paths unpack literal identity matrices and packed rectangles',async()=>{
 const f=await fixture();try{const sheet=egret.createSpriteSheet(f.lease,frames(),PROFILE);
 for(const [name,want,crop]of [['A',{a:1,b:0,c:0,d:1,tx:1,ty:1},A],['B',{a:0,b:-1,c:1,d:0,tx:1,ty:4},B]]){
 const b=sheet.createBitmap(name);f.engine.stage.addChild(b);
 for(const frame of captures(f)){const c=frame.commands[0];exact(c.matrix,want);assert.deepEqual(c.rect,{x:0,y:0,width:2,height:3});assert.deepEqual(c.sourceRect,crop);assert.ok(Object.isFrozen(c.matrix));assert.ok(Object.isFrozen(c.rect));}
 f.engine.stage.removeChild(b);b.dispose();}
 }finally{await f.close();}
});
// Break: S*M order, opposite rotation, clip/child/coordinate contamination.
test('TR09 outer quarter-turn composes M*S while clip and sibling stay on M',async()=>{
 const f=await fixture();try{const parent=new egret.Sprite();parent.x=10;parent.y=20;parent.rotation=90;parent.clipRect={x:0,y:0,width:8,height:8};f.engine.stage.addChild(parent);
 const sheet=egret.createSpriteSheet(f.lease,frames(),PROFILE);
 for(const [name,want]of [['A',{a:0,b:1,c:-1,d:0,tx:9,ty:21}],['B',{a:1,b:0,c:0,d:1,tx:6,ty:21}]]){
 const b=sheet.createBitmap(name);parent.addChild(b);
 const sibling=new egret.Sprite();sibling.graphics.beginFill(0xffffff);sibling.graphics.drawRect(0,0,1,1);parent.addChild(sibling);
 near(b.localToGlobal(0,0),{x:10,y:20});
 for(const frame of captures(f)){const image=frame.commands[0],rect=frame.commands[1];near(image.matrix,want);
 near(image.clips[0].matrix,{a:0,b:1,c:-1,d:0,tx:10,ty:20});near(rect.matrix,{a:0,b:1,c:-1,d:0,tx:10,ty:20});}
 parent.removeChild(b);parent.removeChild(sibling);b.dispose();sibling.dispose();}
 }finally{await f.close();}
});
// Break: anchor/negative/fractional transforms applied to packed coordinates twice.
test('TR10 fractional negative scale anchor and saved frames retain independent matrices',async()=>{
 const f=await fixture();try{const b=egret.createSpriteSheet(f.lease,frames(),PROFILE).createBitmap('B');f.engine.stage.addChild(b);
 b.x=.25;b.y=.5;b.scaleX=-2;b.scaleY=.5;b.anchorOffsetX=1;b.anchorOffsetY=2;
 const saved=captures(f);for(const frame of saved)exact(frame.commands[0].matrix,{a:0,b:-.5,c:-2,d:0,tx:.25,ty:1.5});
 near(b.localToGlobal(0,0),{x:2.25,y:-.5});
 b.sourceRect=A;b.x=9;b.dispose();f.lease.release();
 for(const frame of saved){near(frame.commands[0].matrix,{a:0,b:-.5,c:-2,d:0,tx:.25,ty:1.5});assert.deepEqual(frame.commands[0].rect,{x:0,y:0,width:2,height:3});assert.equal(egret.copyImageData2DPixels(frame.images[0]).length,144);}
 }finally{await f.close();}
});
// Break: logical transparent canvas is checked/drawn/charged as packed geometry.
test('TR10 packed finite corners and payload budget do not allocate the logical canvas',async()=>{
 const f=await fixture();try{const huge={...LA,sourceWidth:Number.MAX_SAFE_INTEGER,sourceHeight:Number.MAX_SAFE_INTEGER};
 const sheet=egret.createSpriteSheet(f.lease,[{name:'A',...A,layout:huge},{name:'B',...A,layout:{...huge,trimX:0}}],PROFILE);
 const b=sheet.createBitmap('A');f.engine.stage.addChild(b);b.scaleX=5e307;
 for(const frame of captures(f)){assert.equal(frame.images[0].byteLength,144);assert.deepEqual(frame.commands[0].rect,{x:0,y:0,width:2,height:3});assert.equal(frame.commands[0].matrix.tx,5e307);}
 b.x=5e307;for(const method of ['captureFrame','captureTexturedFrame'])assert.throws(()=>f.engine[method](options),{code:'FRAME_TRANSFORM_INVALID'});
 b.x=0;b.scaleX=1;const other=sheet.createBitmap('B');f.engine.stage.addChild(other);
 for(const frame of captures(f)){assert.equal(frame.images.length,1);assert.equal(frame.commands.length,2);assert.equal(frame.commands[0].imageIndex,frame.commands[1].imageIndex);assert.equal(frame.commands[1].matrix.tx,0);}
 }finally{await f.close();}
});
// Break: finite inputs may produce an infinite placement translation.
test('TR10 M*S coefficient overflow refuses before emission',async()=>{
 const f=await fixture();try{const layout={...LA,sourceWidth:Number.MAX_SAFE_INTEGER,trimX:Number.MAX_SAFE_INTEGER-2};
 const b=egret.createSpriteSheet(f.lease,[{name:'A',...A,layout}],PROFILE).createBitmap('A');b.scaleX=1e294;f.engine.stage.addChild(b);
 for(const method of ['captureFrame','captureTexturedFrame'])assert.throws(()=>f.engine[method](options),{code:'FRAME_TRANSFORM_INVALID'});
 }finally{await f.close();}
});
