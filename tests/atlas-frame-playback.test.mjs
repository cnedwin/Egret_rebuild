// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {egret,clip,fixture,LA,LB} from './atlas-frame-fixture.mjs';
// Break: shared immutable metadata becomes per-player state or boundary selection drifts.
test('TR11 SDK once/loop exact boundaries share metadata without sharing selection',async()=>{
 const f=await fixture();try{const data=clip(),a=new egret.Bitmap(f.lease),b=new egret.Bitmap(f.lease);
 const once=new egret.SequencePlayer(a,data),loop=new egret.SequencePlayer(b,data,'loop');
 for(const [time,index,atEnd]of [[0,0,false],[.125,1,false],[.375,1,true]]){const s=once.applyAt(time);assert.equal(s.frameIndex,index);assert.equal(s.atEnd,atEnd);assert.deepEqual(s.region.layout,index?LB:LA);}
 assert.equal(loop.applyAt(.375).frameIndex,0);assert.deepEqual(b.sourceRect,{x:0,y:0,width:2,height:3});assert.deepEqual(a.sourceRect,{x:3,y:0,width:2,height:3});
 assert.equal(loop.applyAt(.5).frameIndex,1);assert.deepEqual([a.naturalWidth,a.naturalHeight,b.naturalWidth,b.naturalHeight],[4,5,4,5]);
 assert.throws(()=>egret.SequencePlayer.prototype.applyAt.call({},0),{code:'SEQ_PLAYER_INVALID'});
 }finally{await f.close();}
});
// Break: paused resume does not restore held full frame after an ordinary crop reset.
test('TR12 SDK playback pause retains sample and resume reapplies held layout without a tick',async()=>{
 const f=await fixture();try{const b=new egret.Bitmap(f.lease),p=f.engine.createSequencePlayback(f.scope,b,clip(),{mode:'loop'});
 p.start();f.engine.advanceTime(10);f.engine.advanceTime(10.125);const held=p.lastSample;assert.deepEqual(held.region.layout,LB);
 p.pause();b.sourceRect={x:0,y:0,width:2,height:3};assert.equal(b.naturalWidth,2);f.engine.advanceTime(10.25);assert.equal(p.lastSample,held);
 p.resume();assert.equal(p.lastSample.frameIndex,1);assert.deepEqual(p.lastSample.region.layout,LB);assert.deepEqual([b.naturalWidth,b.naturalHeight],[4,5]);
 p.dispose();assert.equal(f.lease.value.isDisposed,false);
 }finally{await f.close();}
});
