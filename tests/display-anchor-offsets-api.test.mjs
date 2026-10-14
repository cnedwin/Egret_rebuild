// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

const KEYS = Object.freeze(['a','b','c','d','tx','ty']);
// Encode only observed public matrix numbers, preserving their IEEE-754 sign bits.
function observation(matrix) {
  return KEYS.map(key => {
    const bytes = new Uint8Array(8), view = new DataView(bytes.buffer);
    view.setFloat64(0, matrix[key], true);
    return { key, value: Object.is(matrix[key], -0) ? '-0' : String(matrix[key]),
      float64LE: [...bytes].map(value => value.toString(16).padStart(2,'0')).join('') };
  });
}
function near(actual, expected) {
  for (const key of Object.keys(expected)) assert.ok(Math.abs(actual[key]-expected[key]) <= 1e-10, key);
}

// Genuine transforms, capture/submission, bounds, picking, resources and cleanup
// precede the missing-accessor assertion. No anchor assignment occurs here.
test('AO00 genuine old display/resource baseline finishes before named anchor RED', async () => {
  const submitted = [], port = host({ renderFrame(frame) { submitted.push(frame); } });
  const engine = await egret.createEngine({ host: port.adapter });
  let scope, parent, child, signed, bitmap, texture, lease, saved;
  let loads = 0, disposals = 0, observed;
  let primaryPresent = false, primary;
  const cleanupErrors = [];
  try {
    scope = engine.createScope();
    parent = scope.use(new egret.Sprite()); parent.x=10; parent.y=20; parent.scaleX=2;
    child = scope.use(new egret.Sprite()); child.x=3; child.y=4; child.rotation=90;
    child.graphics.beginFill(0xff0000).drawRect(1,2,3,4).endFill();
    child.touchEnabled=true; child.hitArea={x:1,y:2,width:3,height:4};
    parent.addChild(child); engine.stage.addChild(parent);
    near(child.localToGlobal(2,3), {x:10,y:26});
    near(child.globalToLocal(10,26), {x:2,y:3});
    near(child.getBounds(), {x:1,y:2,width:3,height:4});
    near(parent.getBounds(), {x:-3,y:5,width:4,height:3});
    assert.equal(engine.stage.hitTest(10,26), child);
    signed = scope.use(new egret.Sprite()); signed.x=-0; signed.y=-0; signed.scaleX=-1;
    signed.graphics.beginFill(0x00ff00).drawRect(0,0,2,3).endFill();
    engine.stage.addChild(signed);
    texture = egret.createTexture(egret.createImageData2D({width:1,height:1,pixels:new Uint8Array([0,0,255,255])}));
    const type=egret.createAssetType('anchor-old-baseline-blue',egret.isTexture);
    engine.assets.register(type,{async load(){loads++;return texture;},dispose(value){disposals++;value.dispose();}});
    lease=scope.use(await engine.assets.acquire(egret.createAssetRef(type,'blue')));
    bitmap=scope.use(new egret.Bitmap(lease)); bitmap.x=30; engine.stage.addChild(bitmap);
    saved=engine.captureFrame({width:64,height:64});
    assert.deepEqual(saved.commands.map(value=>value.kind),['rect','rect','image']);
    assert.ok(Object.isFrozen(saved)); assert.ok(Object.isFrozen(saved.commands[0].matrix));
    assert.deepEqual([...egret.copyImageData2DPixels(saved.images[0])],[0,0,255,255]);
    const rendered=engine.renderFrame({width:64,height:64});
    assert.equal(submitted.length,1); assert.equal(submitted[0],rendered);
    assert.equal(bitmap.textureLease,lease); assert.equal(lease.value,texture);
    assert.equal(loads,1); assert.equal(disposals,0);
    observed={schemaVersion:1,kind:'AUTHENTIC_OLD_PUBLIC_MATRIX_OBSERVATION',
      commandKinds:saved.commands.map(value=>value.kind),
      rotated:observation(saved.commands[0].matrix),signed:observation(saved.commands[1].matrix),
      image:observation(saved.commands[2].matrix)};
  } catch(cause) {primaryPresent=true;primary=cause;}
  finally {
    for(const action of [()=>scope?.dispose(),()=>bitmap?.dispose(),()=>child?.dispose(),
      ()=>signed?.dispose(),()=>parent?.dispose(),()=>lease?.release()]) {
      try {action();} catch(cause) {cleanupErrors.push(cause);}
    }
    try {await engine.dispose();} catch(cause) {cleanupErrors.push(cause);}
    const managedDisposed=texture?.isDisposed;
    try {texture?.dispose();} catch(cause) {cleanupErrors.push(cause);}
    if(!primaryPresent) {
      try {
        assert.equal(scope.state,'closed'); assert.equal(child.isDisposed,true);
        assert.equal(bitmap.isDisposed,true); assert.equal(engine.stage.isDisposed,true);
        assert.equal(loads,1); assert.equal(disposals,1); assert.equal(managedDisposed,true);
        assert.equal(port.timers.size,0);
        assert.equal(port.trace.filter(value=>value==='stop').length,1);
        assert.equal(port.trace.filter(value=>value==='close').length,1);
        assert.deepEqual([...egret.copyImageData2DPixels(saved.images[0])],[0,0,255,255]);
      } catch(cause) {cleanupErrors.push(cause);}
    }
  }
  if(cleanupErrors.length) throw new AggregateError(primaryPresent?[primary,...cleanupErrors]:cleanupErrors,'AO00 genuine baseline cleanup failed');
  if(primaryPresent) throw primary;
  // This line becomes original baseline evidence only when the actual actor runs.
  process.stdout.write('DISPLAY_ANCHOR_BASELINE_OBSERVED '+JSON.stringify(observed)+'\n');
  for(const key of ['anchorOffsetX','anchorOffsetY']) {
    const descriptor=Object.getOwnPropertyDescriptor(egret.DisplayObject.prototype,key);
    assert.ok(descriptor && typeof descriptor.get==='function' && typeof descriptor.set==='function',
      'DISPLAY_ANCHOR_OFFSETS_REQUIRED');
    for(const Constructor of [egret.DisplayObjectContainer,egret.Sprite,egret.Bitmap,egret.Stage]) {
      assert.equal(Object.hasOwn(Constructor.prototype,key),false,'existing subclasses inherit the accessor');
    }
    assert.equal(Object.hasOwn(egret,key),false,'no new root value');
  }
});
