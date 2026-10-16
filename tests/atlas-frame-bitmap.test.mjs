// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {egret,PROFILE,A,B,LA,LB,frames,input,clip,fixture} from './atlas-frame-fixture.mjs';
const size=b=>[b.naturalWidth,b.naturalHeight];
// Break: cropped target rejected, source canvas lost, complete frame goes through overrides.
test('TR04 sheet-created cropped target accepts player and commits logical geometry intrinsically',async()=>{
 const f=await fixture();const descriptor=Object.getOwnPropertyDescriptor(egret.Bitmap.prototype,'sourceRect');
 try{const sheet=egret.createSpriteSheet(f.lease,frames(),PROFILE),b=sheet.createBitmap('A');
 assert.deepEqual(b.sourceRect,A);assert.deepEqual(size(b),[4,5]);
 const p=new egret.SequencePlayer(b,clip());assert.deepEqual(b.sourceRect,A);
 Object.defineProperty(egret.Bitmap.prototype,'sourceRect',{...descriptor,set(){throw Error('public setter');}});
 for(const [time,crop,layout]of [[0,A,LA],[.125,B,LB]]){const sample=p.applyAt(time);
 assert.deepEqual(b.sourceRect,crop);assert.deepEqual(size(b),[4,5]);assert.deepEqual(sample.region.layout,layout);
 assert.deepEqual(b.getBounds(),{x:0,y:0,width:4,height:5});}
 sheet.dispose();p.dispose();assert.equal(f.lease.value.isDisposed,false);assert.equal(f.disposals(),0);
 }finally{Object.defineProperty(egret.Bitmap.prototype,'sourceRect',descriptor);await f.close();}
});
// Break: public sourceRect acquires metadata authority or same exact lease cannot restore layout.
test('TR05 scalar setters clear layout and next same-lease application restores it',async()=>{
 const f=await fixture();try{const b=egret.createSpriteSheet(f.lease,frames(),PROFILE).createBitmap('A'),p=new egret.SequencePlayer(b,clip());
 p.applyAt(.125);assert.deepEqual(size(b),[4,5]);
 b.sourceRect={...B,layout:LA};assert.deepEqual(size(b),[2,3]);
 p.applyAt(.125);assert.deepEqual(size(b),[4,5]);
 b.textureLease=f.lease;assert.deepEqual(size(b),[6,6]);
 p.applyAt(0);assert.deepEqual(size(b),[4,5]);
 const before=p.lastSample,replacement=f.scope.use(await f.engine.assets.acquire(f.ref));assert.equal(replacement.value,f.lease.value);
 b.textureLease=replacement;assert.throws(()=>p.applyAt(0),{code:'SEQ_BINDING_CHANGED'});assert.equal(p.lastSample,before);assert.deepEqual(size(b),[6,6]);
 b.textureLease=undefined;assert.deepEqual(size(b),[0,0]);
 }finally{await f.close();}
});
// Break: unchanged public lease/crop bypasses exact private state token conflict.
test('TR06 same crop with different layout invalidates a prepared binding ticket',async()=>{
 const f=await fixture();try{const b=new egret.Bitmap(f.lease);b.sourceRect=A;
 const fs=[{...A,layout:LA,durationSeconds:.125},{...A,layout:{...LA,trimX:0},durationSeconds:.25}];
 const p=new egret.SequencePlayer(b,egret.createSequenceClip({atlasWidth:6,atlasHeight:6,frames:fs},PROFILE));
 p.applyAt(0);const ticket=f.engine.captureBitmapBindings(f.scope,[b]);ticket.prepare([f.lease]);
 p.applyAt(.125);assert.deepEqual(b.sourceRect,A);assert.deepEqual(size(b),[4,5]);
 assert.throws(()=>ticket.commit(),{code:'BITMAP_RESOURCE_BINDING_CHANGED'});
 const next=f.engine.captureBitmapBindings(f.scope,[b]);next.prepare([f.lease]);next.commit();assert.deepEqual(size(b),[6,6]);next.dispose();
 assert.equal(f.lease.value.isDisposed,false);
 }finally{await f.close();}
});
// Break: slot replacement retains stale layout, or borrows are released by sheet/player.
test('TR06 slot clears layout while group remains sole member lease owner',async()=>{
 const f=await fixture();try{const group=f.engine.createAssetGroup(f.scope,[f.ref]),members=await group.ready;
 const b=egret.createSpriteSheet(members[0],frames(),PROFILE).createBitmap('A');
 assert.throws(()=>f.engine.createScope().use(members[0]),{code:'OWNERSHIP_CONFLICT'});
 const p=new egret.SequencePlayer(b,clip());p.applyAt(.125);
 const slot=f.engine.createBitmapResourceSlot(f.scope,b);await slot.replace(f.ref);assert.deepEqual(size(b),[6,6]);
 assert.throws(()=>p.applyAt(0),{code:'SEQ_BINDING_CHANGED'});p.dispose();assert.equal(members[0].value.isDisposed,false);
 slot.dispose();assert.deepEqual(size(b),[0,0]);assert.equal(members[0].value.isDisposed,false);
 }finally{await f.close();}
});
// Break: failed application publishes sample/crop/logical geometry, or mutation reentry succeeds.
test('TR07 reentrant intrinsic application fails atomically and preserves last sample',async()=>{
 const f=await fixture();try{const b=new egret.Bitmap(f.lease),p=new egret.SequencePlayer(b,clip());
 const before=p.applyAt(0);let calls=0;
 assert.throws(()=>{b.sourceRect={get x(){calls++;assert.throws(()=>p.applyAt(.125),{code:'BITMAP_MUTATION_REENTRANT'});assert.equal(p.lastSample,before);assert.deepEqual(b.sourceRect,A);assert.deepEqual(size(b),[4,5]);throw undefined;},y:0,width:2,height:3};},e=>e instanceof egret.EgretError&&e.code==='BITMAP_REGION_INVALID'&&Object.hasOwn(e,'cause')&&e.cause===undefined);
 assert.equal(calls,1);assert.equal(p.lastSample,before);assert.deepEqual(size(b),[4,5]);
 }finally{await f.close();}
});
// Break: new metadata resurrects entitlement or drops genuine full-view admission.
test('TR04/TR07 authentic Texture view rejection and revoked-lease sample preservation',async()=>{
 const f=await fixture();try{const b=new egret.Bitmap(f.lease),p=new egret.SequencePlayer(b,clip()),saved=p.applyAt(.125);
 f.lease.release();assert.throws(()=>p.applyAt(0),{code:'ASSET_LEASE_RELEASED'});assert.equal(p.lastSample,saved);assert.deepEqual(b.sourceRect,B);assert.deepEqual(size(b),[4,5]);
 }finally{await f.close();}
 const g=await fixture(A);try{assert.throws(()=>new egret.SequencePlayer(new egret.Bitmap(g.lease),clip()),{code:'SEQ_ATLAS_MISMATCH'});}finally{await g.close();}
});
