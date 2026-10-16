// SPDX-License-Identifier: Apache-2.0
// Public API regressions for complete borrowed Bitmap publication.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Bitmap, EgretError, createEngine, createAssetType, createAssetRef,
  createImageData2D, createTexture, copyImageData2DPixels, isTexture} from '@egret/engine';
import {host} from './helpers.mjs';

const SPECS={
  oldLeft:{width:2,height:2,rgba:[255,0,0,255]},
  oldRight:{width:3,height:1,rgba:[0,255,0,255]},
  nextLeft:{width:1,height:3,rgba:[0,0,255,255]},
  nextRight:{width:4,height:2,rgba:[255,255,0,255]},
};
// This is the ordinary caller's two assignments, not an SDK transaction implementation.
const originalLeaseSetter=Object.getOwnPropertyDescriptor(Bitmap.prototype,'textureLease').set;
function setterLoop(targets,members){
  for(let index=0;index<targets.length;index++)Reflect.apply(originalLeaseSetter,targets[index],[members[index]]);
}
function expectCode(operation,code){
  let caught;
  assert.throws(operation,cause=>{caught=cause;return cause instanceof EgretError&&cause.code===code;});
  return caught;
}
function fields(bitmap){return {lease:bitmap.textureLease,crop:bitmap.sourceRect,width:bitmap.naturalWidth,height:bitmap.naturalHeight};}
function assertSameFields(bitmap,before){
  assert.equal(bitmap.textureLease,before.lease);assert.equal(bitmap.sourceRect,before.crop);
  assert.equal(bitmap.naturalWidth,before.width);assert.equal(bitmap.naturalHeight,before.height);
}
function geometry(bitmap){return {parent:bitmap.parent,x:bitmap.x,y:bitmap.y,scaleX:bitmap.scaleX,scaleY:bitmap.scaleY,
  anchorOffsetX:bitmap.anchorOffsetX,anchorOffsetY:bitmap.anchorOffsetY,visible:bitmap.visible,touchEnabled:bitmap.touchEnabled,hitArea:bitmap.hitArea};}
function assertFrame(engine,colors,dimensions){
  const frame=engine.captureFrame({width:32,height:16});
  assert.equal(frame.commands.length,2);assert.ok(frame.commands.every(command=>command.kind==='image'));
  assert.deepEqual(frame.images.map(image=>[image.width,image.height]),dimensions);
  assert.deepEqual(frame.images.map(image=>Array.from(copyImageData2DPixels(image).subarray(0,4))),colors);
}
async function fixture(id,body){
  const h=host(),engine=await createEngine({host:h.adapter});
  const oldScope=engine.createScope(),targetScope=engine.createScope(),bindingScope=engine.createScope(),otherScope=engine.createScope();
  let nextScope;
  const loads=[],disposals=[],issued=new Map();
  const type=createAssetType('P03 original Texture-layer witness',isTexture);
  const provider={
    load(ref,context){
      const spec=SPECS[ref.id];if(!spec)throw new Error('Unselected test asset');
      const pixels=new Uint8Array(spec.width*spec.height*4);
      for(let offset=0;offset<pixels.length;offset+=4)pixels.set(spec.rgba,offset);
      const texture=createTexture(createImageData2D({width:spec.width,height:spec.height,pixels}));
      issued.set(texture,ref.id);const original=Promise.resolve(texture);loads.push({ref,context,receiver:this,original});return original;
    },
    dispose(texture){disposals.push(issued.get(texture));texture.dispose();},
  };
  engine.assets.register(type,provider);
  const refs=Object.fromEntries(Object.keys(SPECS).map(key=>[key,createAssetRef(type,key)]));
  try{
    const oldGroup=engine.createAssetGroup(oldScope,[refs.oldLeft,refs.oldRight]),old=await oldGroup.ready;
    const targets=old.map(member=>targetScope.use(new Bitmap(member)));
    targets[0].sourceRect={x:1,y:0,width:1,height:2};targets[1].sourceRect={x:0,y:0,width:2,height:1};
    for(const [index,target]of targets.entries()){
      target.x=index?11:3;target.y=4;target.scaleX=1;target.scaleY=2;target.anchorOffsetX=index;target.anchorOffsetY=index?0:1;
      target.touchEnabled=true;target.hitArea={x:0,y:0,width:5,height:5};engine.stage.addChild(target);
    }
    // Every feature test reaches this genuine public baseline before checking the new factory.
    assert.equal(oldGroup.state,'ready');assert.ok(Object.isFrozen(old));assert.equal(old.length,2);
    assert.notEqual(old[0],old[1]);assert.ok(old.every(member=>!member.value.isDisposed));
    assert.deepEqual(loads.map(row=>row.ref.id),['oldLeft','oldRight']);assert.ok(loads.every(row=>row.receiver===provider));
    expectCode(()=>otherScope.use(old[0]),'OWNERSHIP_CONFLICT');
    assert.deepEqual(targets.map(target=>[target.naturalWidth,target.naturalHeight]),[[1,2],[2,1]]);
    assertFrame(engine,[[255,0,0,255],[0,255,0,255]],[[2,2],[3,1]]);assert.deepEqual(disposals,[]);
    console.log('P03_GENUINE_BASELINE '+id);
    const f={engine,bindingScope,targetScope,otherScope,targets,old,oldGroup,loads,disposals,
      async next(){
        assert.equal(nextScope,undefined,'One selected next group per fresh fixture');nextScope=engine.createScope();
        const group=engine.createAssetGroup(nextScope,[refs.nextLeft,refs.nextRight]),members=await group.ready;
        return {group,members,scope:nextScope};
      }};
    await body(f);
  }finally{
    // Ticket clear precedes resource-owner release; genuine node cleanup also drops caller borrows.
    bindingScope.dispose();targetScope.dispose();nextScope?.dispose();oldScope.dispose();otherScope.dispose();await engine.dispose();
  }
  assert.deepEqual(h.trace,['start','stop','close']);
  assert.equal(disposals.length,4);assert.deepEqual([...disposals].sort(),['nextLeft','nextRight','oldLeft','oldRight']);
}
function requireTicket(f){
  assert.equal(typeof f.engine.captureBitmapBindings,'function','P03_MISSING_BITMAP_BINDING_FACTORY');
  return f.engine.captureBitmapBindings(f.bindingScope,f.targets);
}
// The input getter is a supported caller read in Bitmap.sourceRect. It never swallows a test assertion.
function insideSecondMutation(targets,operation){
  const observation={reads:0,occurred:false,cause:undefined,inside:undefined};
  targets[1].sourceRect={get x(){
    observation.reads++;
    try{operation();}catch(cause){observation.occurred=true;observation.cause=cause;}
    observation.inside=targets.map(fields);return 0;
  },y:0,width:2,height:1};
  return observation;
}

test('PGC01 genuine public setter-loop healthy control publishes both prepared members outside mutation',async()=>{
  await fixture('PGC01',async f=>{
    const next=await f.next();setterLoop(f.targets,next.members);
    assert.equal(f.targets[0].textureLease,next.members[0]);assert.equal(f.targets[1].textureLease,next.members[1]);
    assert.deepEqual(f.targets.map(target=>[target.naturalWidth,target.naturalHeight]),[[1,3],[4,2]]);
    assertFrame(f.engine,[[0,0,255,255],[255,255,0,255]],[[1,3],[4,2]]);assert.deepEqual(f.disposals,[]);
  });
});

test('PGC02 assigned ordinary setter-loop counterexample exposes a prefix when second Bitmap is mutating',async()=>{
  await fixture('PGC02',async f=>{
    const next=await f.next(),observed=insideSecondMutation(f.targets,()=>setterLoop(f.targets,next.members));
    // These mandatory assertions run after the caller getter and outer setter have returned.
    assert.equal(observed.reads,1);assert.equal(observed.occurred,true);assert.ok(observed.cause instanceof EgretError);
    assert.equal(observed.cause.code,'BITMAP_MUTATION_REENTRANT');
    assert.equal(observed.inside[0].lease,next.members[0]);assert.equal(observed.inside[1].lease,f.old[1]);
    assert.deepEqual(observed.inside.map(row=>[row.width,row.height]),[[1,3],[2,1]]);
    assert.equal(f.targets[0].textureLease,next.members[0]);assert.equal(f.targets[1].textureLease,f.old[1]);
    assertFrame(f.engine,[[0,0,255,255],[0,255,0,255]],[[1,3],[3,1]]);assert.deepEqual(f.disposals,[]);
  });
});

test('PGT01 ticket stages exact group-owned members and publishes both full views without taking lease cleanup',async()=>{
  await fixture('PGT01',async f=>{
    const before=f.targets.map(fields),identities=f.targets.map(geometry),ticket=requireTicket(f);
    assert.equal(Object.isFrozen(ticket),true);
    const next=await f.next();ticket.prepare(next.members);
    f.targets.forEach((target,index)=>assertSameFields(target,before[index]));assert.deepEqual(f.disposals,[]);
    ticket.commit();
    assert.equal(f.targets[0].textureLease,next.members[0]);assert.equal(f.targets[1].textureLease,next.members[1]);
    assert.deepEqual(f.targets.map(target=>target.sourceRect),[{x:0,y:0,width:1,height:3},{x:0,y:0,width:4,height:2}]);
    assert.deepEqual(f.targets.map(target=>[target.naturalWidth,target.naturalHeight]),[[1,3],[4,2]]);
    f.targets.forEach((target,index)=>assert.deepEqual(geometry(target),identities[index]));
    assertFrame(f.engine,[[0,0,255,255],[255,255,0,255]],[[1,3],[4,2]]);
    expectCode(()=>f.otherScope.use(next.members[0]),'OWNERSHIP_CONFLICT');assert.deepEqual(f.disposals,[]);
    ticket.dispose();ticket.dispose();
    assert.ok(f.targets.every(target=>target.textureLease===undefined&&target.sourceRect===undefined&&target.naturalWidth===0&&target.naturalHeight===0));
    assert.ok(next.members.every(member=>!member.value.isDisposed));assert.ok(f.old.every(member=>!member.value.isDisposed));assert.deepEqual(f.disposals,[]);
    next.scope.dispose();assert.deepEqual([...f.disposals].sort(),['nextLeft','nextRight']);
    assert.ok(f.old.every(member=>!member.value.isDisposed));
  });
});

test('PGT02 second-target mutation refuses batch before first write and leaves both original borrows visible',async()=>{
  await fixture('PGT02',async f=>{
    const before=f.targets.map(fields),ticket=requireTicket(f),next=await f.next();ticket.prepare(next.members);
    const observed=insideSecondMutation(f.targets,()=>ticket.commit());
    assert.equal(observed.reads,1);assert.equal(observed.occurred,true);assert.ok(observed.cause instanceof EgretError);
    assert.equal(observed.cause.code,'BITMAP_MUTATION_REENTRANT');
    assert.equal(observed.inside[0].lease,f.old[0]);assert.equal(observed.inside[1].lease,f.old[1]);
    assert.equal(observed.inside[0].crop,before[0].crop);assert.equal(observed.inside[1].crop,before[1].crop);
    assert.deepEqual(observed.inside.map(row=>[row.width,row.height]),[[1,2],[2,1]]);
    assertSameFields(f.targets[0],before[0]);
    // The independent outer crop setter may finish its own write; its exact lease remains the original.
    assert.equal(f.targets[1].textureLease,f.old[1]);assert.deepEqual(f.targets[1].sourceRect,{x:0,y:0,width:2,height:1});
    assertFrame(f.engine,[[255,0,0,255],[0,255,0,255]],[[2,2],[3,1]]);assert.deepEqual(f.disposals,[]);
    ticket.dispose();assert.equal(f.targets[0].textureLease,f.old[0]);assert.equal(f.targets[1].textureLease,f.old[1]);
    assert.ok(next.members.every(member=>!member.value.isDisposed));assert.deepEqual(f.disposals,[]);
  });
});
