// SPDX-License-Identifier: Apache-2.0
// Original public-API CPU policy witnesses; no native PNG decode is claimed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { Bitmap, EgretError, createEngine, createAssetType, createAssetRef,
  createImageData2D, createTexture, copyImageData2DPixels, isTexture } from '@egret/engine';
import { host } from './helpers.mjs';

const MODULE = new URL('../examples/prepared-resource-groups/coordinator.mjs', import.meta.url);
const ASSETS = new URL('../examples/resource-scene/assets/', import.meta.url);
const PINS = Object.freeze({
  A: { bytes:83, sha256:'376a6eaaeb1ca8861b6a0ee62db3edbb0ec926648f8c20cfd5f6e57c1bf44960', rgba:[255,0,0,255] },
  B: { bytes:80, sha256:'c37296e1b63b40da2e17d8cc31d88819f35f52e1d219abc367288fda45ceaa78', rgba:[0,255,0,255] },
  C: { bytes:81, sha256:'e27c682265405cf30b6cbe9dc453ea2d7d01235e6c2512286f9fc7e1603dbd66', rgba:[0,0,255,255] },
  D: { bytes:83, sha256:'d2c3b3461b2b5d8e6a48608c83528efe78c6a0d3b219dc0038c23ccf016c3f98', rgba:[255,255,0,255] },
});
function fields(target) { return { lease:target.textureLease, crop:target.sourceRect, width:target.naturalWidth, height:target.naturalHeight }; }
function sameFields(targets, before) {
  targets.forEach((target,index) => {
    assert.equal(target.textureLease,before[index].lease); assert.equal(target.sourceRect,before[index].crop);
    assert.equal(target.naturalWidth,before[index].width); assert.equal(target.naturalHeight,before[index].height);
  });
}
function code(operation, expected) {
  assert.throws(operation, cause => cause instanceof EgretError && cause.code === expected);
}
function handled(promise) { assert.ok(promise instanceof Promise); void promise.catch(() => {}); return promise; }
function assertSnapshot(app, selection, encoded) {
  const snapshot=app.snapshot();
  assert.ok(Object.isFrozen(snapshot)); assert.ok(Object.isFrozen(snapshot.logical));
  assert.equal(snapshot.state,'open'); assert.equal(snapshot.selection,selection); assert.equal(app.selection,selection);
  assert.equal(snapshot.pendingKey,null); assert.deepEqual(snapshot.logical,{sets:1,encodedBytes:encoded,decodedBytes:2048});
}
function assertFrame(engine, expected) {
  const frame=engine.captureFrame({width:96,height:48});
  assert.equal(frame.commands.length,expected.length);
  assert.deepEqual(frame.images.map(image=>Array.from(copyImageData2DPixels(image).subarray(0,4))),expected);
}
async function requireFactory() {
  assert.ok(existsSync(MODULE),'P03_MISSING_OUTFIT_COORDINATOR');
  const module=await import(MODULE.href);
  assert.equal(typeof module.createPreparedOutfitCoordinator,'function','P03_MISSING_OUTFIT_COORDINATOR_FACTORY');
  return module.createPreparedOutfitCoordinator;
}
async function fixture(id, body) {
  const h=host(), diagnostics=[], engine=await createEngine({host:h.adapter,onDiagnostic:value=>diagnostics.push(value)});
  const sceneScope=engine.createScope(), otherScope=engine.createScope(), apps=[], initialRecords=[];
  const assetEvidence=new WeakMap(), sourceLedger=Object.freeze({active:new Set()}), jobs=[], disposals=[], issued=new Map();
  const failures=new Map(), evidenceOverrides=new Map(), dimensionOverrides=new Map();
  const type=createAssetType('P03 fixed outfit CPU policy witness',isTexture);
  const refs=Object.fromEntries(Object.keys(PINS).map(id=>[id,createAssetRef(type,new URL('outfit-'+id+'.png',ASSETS).href)]));
  const provider={
    load(ref,context) {
      const match=/outfit-([ABCD])\.png$/.exec(ref.id); if(!match)throw new Error('Unselected fixed test ref');
      const assetId=match[1], pin=PINS[assetId];
      const row={assetId,ref,context,receiver:this,original:undefined,outcome:'pending',texture:undefined};
      const original=Promise.resolve().then(()=>{
        if(failures.has(assetId))throw failures.get(assetId);
        const dimensions=dimensionOverrides.get(assetId)??{width:16,height:16};
        const pixels=new Uint8Array(dimensions.width*dimensions.height*4);
        for(let offset=0;offset<pixels.length;offset+=4)pixels.set(pin.rgba,offset);
        const texture=createTexture(createImageData2D({...dimensions,pixels}));
        row.texture=texture;issued.set(texture,assetId);
        assetEvidence.set(texture,Object.freeze({assetId,bytes:pin.bytes,sha256:pin.sha256,width:16,height:16,
          contentRevision:'p02-outfits-r1',layoutRevision:'two-layer-r1',...evidenceOverrides.get(assetId)}));
        return texture;
      });
      row.original=original;jobs.push(row);sourceLedger.active.add(original);
      void original.then(()=>{row.outcome='fulfilled';sourceLedger.active.delete(original);},()=>{row.outcome='rejected';sourceLedger.active.delete(original);});
      return original;
    },
    dispose(texture) { disposals.push({assetId:issued.get(texture),texture});texture.dispose(); },
  };
  engine.assets.register(type,provider);
  async function bootstrap(offset=0) {
    const groupScope=engine.createScope(),targetScope=engine.createScope();
    const group=engine.createAssetGroup(groupScope,[refs.A,refs.B]),members=await group.ready;
    const targets=members.map((member,index)=>targetScope.use(new Bitmap(member)));
    targets.forEach((target,index)=>{target.x=offset+index*20;target.y=4;engine.stage.addChild(target);});
    const initial={key:'classic',group,groupScope,members};
    const record={initial,targetScope,targets};initialRecords.push(record);return record;
  }
  try {
    const initial=await bootstrap();
    assert.equal(initial.initial.group.state,'ready');assert.ok(Object.isFrozen(initial.initial.members));
    assert.equal(initial.initial.members.length,2);assert.notEqual(initial.initial.members[0],initial.initial.members[1]);
    code(()=>otherScope.use(initial.initial.members[0]),'OWNERSHIP_CONFLICT');
    assert.equal(typeof engine.captureBitmapBindings,'function','P03_SDK_PREREQUISITE_REQUIRED');
    const baselineScope=engine.createScope(),baselineTicket=engine.captureBitmapBindings(baselineScope,initial.targets);
    baselineTicket.prepare(initial.initial.members);baselineTicket.dispose();baselineScope.dispose();
    assertFrame(engine,[PINS.A.rgba,PINS.B.rgba]);
    assert.deepEqual(jobs.map(row=>row.assetId),['A','B']);assert.ok(jobs.every(row=>row.receiver===provider));
    assert.equal(sourceLedger.active.size,0);assert.deepEqual(disposals,[]);
    console.log('P03_APP_GENUINE_BASELINE '+id);
    const f={engine,sceneScope,otherScope,...initial,refs,assetEvidence,sourceLedger,jobs,disposals,issued,diagnostics,
      failures,evidenceOverrides,dimensionOverrides,bootstrap,
      async create(record=initial,limits) {
        const factory=await requireFactory();
        const app=factory({engine,sceneScope,targets:record.targets,initial:record.initial,refs,assetEvidence,sourceLedger,limits});
        apps.push(app);return app;
      }};
    await body(f);
  } finally {
    for(const app of apps.reverse())app.dispose();
    sceneScope.dispose();
    for(const record of initialRecords.reverse()){record.targetScope.dispose();record.initial.groupScope.dispose();}
    otherScope.dispose();await Promise.allSettled(jobs.map(row=>row.original));await engine.dispose();
  }
  assert.deepEqual(h.trace,['start','stop','close']);
  assert.equal(sourceLedger.active.size,0);
  const delivered=jobs.filter(row=>row.texture!==undefined).map(row=>row.texture);
  assert.equal(disposals.length,delivered.length,'Exactly one actual disposer attempt per delivered value');
  assert.equal(new Set(disposals.map(row=>row.texture)).size,delivered.length);
}

test('PGA00 retained genuine SDK/group baseline succeeds independently of missing application module',async()=>{
  await fixture('PGA00',async f=>{sameFields(f.targets,f.targets.map(fields));assert.equal(f.initial.group.state,'ready');});
});

test('PGA01 fixed two-layer handoff publishes summer and conditionally clears before group release',async()=>{
  await fixture('PGA01',async f=>{
    const originals=f.targets.map(fields),app=await f.create();
    assert.ok(Object.isFrozen(app));assertSnapshot(app,'classic',163);
    assert.ok(f.targets.every((target,index)=>target.textureLease===originals[index].lease));
    const promise=handled(app.replace('summer'));
    assert.deepEqual(f.jobs.map(row=>row.assetId),['A','B','C','D'],'Group activation is same-stack');
    sameFields(f.targets,originals);assert.equal(app.selection,'classic');
    await promise;assertSnapshot(app,'summer',164);
    assert.deepEqual(f.targets.map(target=>f.issued.get(target.textureLease.value)),['C','D']);
    assertFrame(f.engine,[PINS.C.rgba,PINS.D.rgba]);
    f.targets.forEach(target=>code(()=>f.otherScope.use(target.textureLease),'OWNERSHIP_CONFLICT'));
    assert.deepEqual(f.disposals.map(row=>row.assetId).sort(),['A','B']);
    app.dispose();app.dispose();
    assert.ok(f.targets.every(target=>target.textureLease===undefined));
    const end=app.snapshot();assert.equal(end.state,'disposed');assert.deepEqual(end.logical,{sets:0,encodedBytes:0,decodedBytes:0});
    assert.deepEqual(f.disposals.map(row=>row.assetId).sort(),['A','B','C','D']);
  });
});

for(const kind of ['Error','undefined'])test('PGA03 partial original group failure preserves both old layers: '+kind,async()=>{
  await fixture('PGA03-'+kind,async f=>{
    const marker=kind==='Error'?new Error('original PNG-source witness'):undefined;
    f.failures.set('D',marker);const app=await f.create(),before=f.targets.map(fields);
    const original=handled(app.replace('summer'));let observed;
    await assert.rejects(original,cause=>{observed=cause;return cause instanceof EgretError&&cause.code==='ASSET_GROUP_ACQUIRE_FAILED';});
    assert.equal(observed.cause.code,'ASSET_LOAD_FAILED');assert.ok(Object.hasOwn(observed.cause,'cause'));
    assert.equal(observed.cause.cause,marker);sameFields(f.targets,before);assertSnapshot(app,'classic',163);
    assert.deepEqual(f.disposals.map(row=>row.assetId),['C']);
    assert.equal(f.jobs.find(row=>row.assetId==='D').texture,undefined);
    f.failures.delete('D');await handled(app.replace('summer'));assertSnapshot(app,'summer',164);
    assertFrame(f.engine,[PINS.C.rgba,PINS.D.rgba]);
  });
});

test('PGA16 independent initial groups share values but survive the first coordinator retirement',async()=>{
  await fixture('PGA16',async f=>{
    const first=await f.create(),secondRecord=await f.bootstrap(40),second=await f.create(secondRecord);
    assert.equal(f.jobs.length,2);assert.notEqual(f.initial.members[0],secondRecord.initial.members[0]);
    assert.equal(f.initial.members[0].value,secondRecord.initial.members[0].value);
    first.dispose();assert.ok(f.targets.every(target=>target.textureLease===undefined));assert.deepEqual(f.disposals,[]);
    assertSnapshot(second,'classic',163);assertFrame(f.engine,[PINS.A.rgba,PINS.B.rgba]);
    await handled(second.replace('summer'));assertSnapshot(second,'summer',164);
    assert.deepEqual(f.disposals.map(row=>row.assetId).sort(),['A','B']);
    assert.ok(f.targets.every(target=>target.textureLease===undefined));second.dispose();
    assert.deepEqual(f.disposals.map(row=>row.assetId).sort(),['A','B','C','D']);
  });
});

for(const variant of ['hash','dependency','decoded-dimension'])test('PGA17 fixed compatibility rejects before any publication: '+variant,async()=>{
  await fixture('PGA17-'+variant,async f=>{
    if(variant==='hash')f.evidenceOverrides.set('D',{sha256:'0'.repeat(64)});
    if(variant==='dependency')f.evidenceOverrides.set('D',{layoutRevision:'different-layout'});
    if(variant==='decoded-dimension')f.dimensionOverrides.set('D',{width:17,height:16});
    const app=await f.create(),before=f.targets.map(fields);
    await assert.rejects(handled(app.replace('summer')),cause=>cause instanceof EgretError&&cause.code==='PREPARED_OUTFIT_CONTENT_INVALID');
    sameFields(f.targets,before);assertSnapshot(app,'classic',163);assertFrame(f.engine,[PINS.A.rgba,PINS.B.rgba]);
    assert.deepEqual(f.disposals.map(row=>row.assetId).sort(),['C','D']);
    f.evidenceOverrides.delete('D');f.dimensionOverrides.delete('D');
    await handled(app.replace('summer'));assertSnapshot(app,'summer',164);
  });
});

for(const decodedBytes of [4096,4095])test('PGA18 exact logical decoded admission boundary '+decodedBytes,async()=>{
  await fixture('PGA18-'+decodedBytes,async f=>{
    const app=await f.create(undefined,{sets:3,encodedBytes:492,decodedBytes}),before=f.targets.map(fields);
    const promise=handled(app.replace('summer'));
    if(decodedBytes===4096){await promise;assertSnapshot(app,'summer',164);assertFrame(f.engine,[PINS.C.rgba,PINS.D.rgba]);}
    else {
      await assert.rejects(promise,cause=>cause instanceof EgretError&&cause.code==='PREPARED_OUTFIT_BUDGET_EXCEEDED');
      sameFields(f.targets,before);assertSnapshot(app,'classic',163);
      assert.deepEqual(f.jobs.map(row=>row.assetId),['A','B'],'Known fixed-byte pressure refuses before source activation');
      assert.deepEqual(f.disposals,[]);
    }
  });
});
