// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createEngine, createImageData2D} from '@egret/engine';
import {createOriginal5Display} from './original5-display.mjs';

async function fixture(run, nativeAbi = 5) {
  const engine = await createEngine({host: {
    surface: {}, close: async () => {},
    setTimeout(callback, delay) {
      const timer = setTimeout(callback, delay);
      return () => clearTimeout(timer);
    }
  }});
  const calls = [];
  const display = createOriginal5Display({
    engine, signal: new AbortController().signal,
    publishPage(id) {
      calls.push('+' + id);
      return {release() { calls.push('-' + id); }};
    }
  }, nativeAbi);
  try { await run(display, calls); }
  finally { display.close(); await engine.dispose(); }
}

test('ABI 5 display IDs preserve parent transforms, scroll coordinates and child ordering', () => fixture(({api}) => {
  const Native = api.NativeDisplayObject;
  const stage = new Native(13), group = new Native(9), a = new Native(8), b = new Native(8);
  stage.addChildAt(group.id, 0);
  group.addChildAt(a.id, 0);
  group.addChildAt(b.id, 1);
  group.swapChild(0, 1);
  assert.equal(group.content.getChildAt(0), b.frame);
  group.setX(10);
  group.setY(15);
  group.setScaleX(2);
  group.setScrollRect(3, 4, 40, 20);
  group.setMaskRect(1, 2, 20, 18);
  group.setMask(-1);
  assert.deepEqual(group.content.mask, {x:1, y:2, width:20, height:18});
  group.setMaskRect(0, 0, 0, 0);
  assert.equal(group.content.mask, undefined);
  a.setX(5);
  a.setY(8);
  assert.equal(api.nrLocalToGlobal(a.id, 0, 0), '14,19');
  assert.equal(api.nrGlobalToLocal(a.id, 14, 19), '0,0');
  assert.throws(() => new Native(12), {code: 'ORIGINAL5_NATIVE_UNSUPPORTED'});
  group.removeChild(a.id);
  group.removeChild(b.id);
}));

test('one decoded page is shared, and final disposal and canceled reads return their leases', () => fixture(async (d, calls) => {
  const image = createImageData2D({width: 2, height: 1, pixels: new Uint8Array(8)});
  const source = await d.imageSource(image);
  const a = new d.api.NativeBitmapData(), b = new d.api.NativeBitmapData();
  const Native = d.api.NativeDisplayObject;
  Native.setSourceToNativeBitmapData(a, source);
  Native.setSourceToNativeBitmapData(b, source);
  const bitmap = new Native(1);
  bitmap.setTexture({$bitmapData: {$nativeBitmapData:a}, $bitmapX:1, $bitmapY:0, $bitmapWidth:1,
    $bitmapHeight:1, $offsetX:2, $offsetY:3, $textureWidth:4, $textureHeight:6,
    $getScaleBitmapWidth:() => 2, $getScaleBitmapHeight:() => 2});
  bitmap.setWidth(8);
  assert.deepEqual(bitmap.bitmap.sourceRect, {x:1, y:0, width:1, height:1});
  assert.equal(bitmap.bitmap.x, 8);
  assert.equal(bitmap.bitmap.y, 6);
  assert.equal(bitmap.bitmap.scaleX, 4);
  assert.equal(bitmap.bitmap.scaleY, 2);
  Native.disposeNativeBitmapData(a);
  assert.equal(bitmap.bitmap, undefined);
  assert.deepEqual(calls, ['+1']);
  assert.throws(() => d.releaseImageSource(source));
  Native.disposeNativeBitmapData(b);
  assert.deepEqual(calls, ['+1','-1']);
  assert.equal(d.releaseImageSource(source), false);
  const canceled = await d.imageSource(image);
  assert.equal(d.releaseImageSource(canceled), true);
  assert.deepEqual(calls, ['+1','-1']);
}));

test('original Graphics hit testing uses painted triangle coverage inside the old bounding rectangle', () => fixture(d => {
  class OriginalGraphics {}
  const oldHit = () => { throw new Error('No Canvas on the native host'); };
  OriginalGraphics.prototype.$hitTest = oldHit;
  d.installGraphics({Graphics: OriginalGraphics});
  const stage = new d.api.NativeDisplayObject(13), shape = new d.api.NativeDisplayObject(8);
  stage.addChildAt(shape.id, 0);
  shape.setX(40);
  shape.setY(32);
  shape.setScaleX(2);
  shape.setBeginFill(0xcc8811, 1);
  shape.setDrawCircle(0, 0, 10);
  shape.setEndFill();
  const target = {$nativeDisplayObject: shape}, graphics = new OriginalGraphics();
  graphics.$targetDisplay = target;
  assert.equal(graphics.$hitTest(40, 32), target);
  assert.equal(graphics.$hitTest(58, 41), null);
  stage.removeChild(shape.id);
  d.api.NativeDisplayObject.disposeGraphicData(graphics);
  stage.addChildAt(shape.id, 0);
  assert.equal(graphics.$hitTest(40, 32), target);
  shape.setGraphicsClear();
  assert.equal(graphics.$hitTest(40, 32), null);
  d.close();
  assert.equal(OriginalGraphics.prototype.$hitTest, oldHit);
}));

test('nine-slice reuses the original layout and tracks BitmapData replacement and disposal', () => fixture(async (d, calls) => {
  const Native = d.api.NativeDisplayObject;
  const layout = (node, data, grid, sx, sy, sw, sh, ox, oy, tw, th, width, height) => {
    assert.deepEqual(grid, {x: 1, y: 1, width: 2, height: 2});
    node.drawImage(sx, sy, sw, sh, 0, 0, width, height);
  };
  d.installGraphics({Graphics: class {}, sys: {BitmapNode: {$updateTextureDataWithScale9Grid: layout}}});
  async function allocate() {
    const source = await d.imageSource(createImageData2D({width: 8, height: 4, pixels: new Uint8Array(128)}));
    const result = new d.api.NativeBitmapData();
    Native.setSourceToNativeBitmapData(result, source);
    return result;
  }
  const first = await allocate(), second = await allocate();
  const texture = {
    $bitmapData: {$nativeBitmapData: first}, $bitmapX: 4, $bitmapY: 0, $bitmapWidth: 4, $bitmapHeight: 4,
    $offsetX: 0, $offsetY: 0, $textureWidth: 4, $textureHeight: 4, $sourceWidth: 8, $sourceHeight: 4,
    $getScaleBitmapWidth: () => 4, $getScaleBitmapHeight: () => 4
  };
  const panel = new Native(1);
  panel.setTexture(texture);
  panel.setScale9Grid(1, 1, 2, 2);
  panel.setWidth(20);
  panel.setHeight(7);
  const mesh = panel.bitmap, oldLease = mesh.textureLease;
  assert.deepEqual(mesh.geometry.positions, [0,0,20,0,0,7,20,7]);
  assert.deepEqual(mesh.geometry.uvs, [.5,0,1,0,.5,1,1,1]);
  assert.equal(mesh.geometry.triangleCount, 2);
  // Some 5.x Texture instances mutate their BitmapData before notifying the native display.
  texture.$bitmapData.$nativeBitmapData = second;
  panel.setTexture(texture);
  assert.equal(mesh, panel.bitmap);
  assert.notEqual(mesh.textureLease, oldLease);
  Native.disposeNativeBitmapData(first);
  assert.equal(mesh, panel.bitmap);
  panel.setScale9Grid(0, 0, -1, -1);
  assert.deepEqual(panel.bitmap.sourceRect, {x:4, y:0, width:4, height:4});
  assert.deepEqual(calls, ['+1', '+2', '-1']);
  Native.disposeNativeBitmapData(second);
  assert.equal(panel.bitmap, undefined);
  assert.deepEqual(calls, ['+1', '+2', '-1', '-2']);
}));
test('ABI 4 retains shared sources through original Texture and BitmapData disposal', () => fixture(async (d, calls) => {
  const Native = d.api.NativeDisplayObject;
  class OriginalBitmapData {
    constructor(source) { this.source = source; this.width = source.width; this.height = source.height; }
  }
  d.installGraphics({Graphics: class {}, BitmapData: OriginalBitmapData});
  assert.equal(d.api.nrABIVersion, 4);
  const pixels = createImageData2D({width: 2, height: 1, pixels: new Uint8Array(8)});
  const source = await d.imageSource(pixels);
  const a = new OriginalBitmapData(source);
  const b = new OriginalBitmapData(source);
  function texture(data) {
    return {$bitmapData:data, $bitmapX:0, $bitmapY:0, $bitmapWidth:2, $bitmapHeight:1, $offsetX:0, $offsetY:0,
      $textureWidth:2, $textureHeight:1, $getScaleBitmapWidth:() => 2, $getScaleBitmapHeight:() => 1};
  }
  assert.equal(a.source, source);
  assert(Object.keys(a).includes('source'));
  const first = new Native(1), second = new Native(1);
  first.setBitmapData(texture(a));
  second.setBitmapData(texture(b));
  const page = second.bitmap.textureLease;
  assert.equal(first.bitmap.textureLease, page);
  // The original Texture.dispose clears its descriptor first. The Bitmap retains the old crop.
  first.texture.$bitmapData = null;
  Native.disposeTexture(first.texture);
  assert.equal(first.bitmap.textureLease, page);
  assert.equal(second.bitmap.textureLease, page);

  // Original BitmapData clears its source before the optional static display-list callback.
  a.source = null;
  Native.disposeBitmapData(a);
  assert.equal(first.bitmap, undefined);
  assert.equal(second.bitmap.textureLease, page);
  assert.deepEqual(calls, ['+1']);
  b.source = null;
  assert.deepEqual(calls, ['+1','-1']);
  const unused = new OriginalBitmapData(await d.imageSource(pixels));
  unused.source = null;
  assert.deepEqual(calls, ['+1','-1','+1','-1']);
  d.close();
  assert.equal(Object.hasOwn(OriginalBitmapData.prototype,'source'), false);
}, 4));
