// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import {containsOwnPaint} from '../../packages/runtime/dist/displayHitTest.js';
import { createEngine, createImageData2D, createTexture, createAssetType, createAssetRef, isTexture } from '@egret/engine';
import { createOriginal5Display } from './original5-display.mjs';
import { installOriginal5Text, original5TextLayout } from './original5-text.mjs';

test('the original field keeps line breaks, style widths, alignment and mixed sizes in a fixed box', () => {
  const field = {size:12,fontFamily:'sans-serif',textColor:0xffffff,stroke:0,strokeColor:0,
    textAlign:'right',verticalAlign:'middle',lineSpacing:2,scrollV:1,
    $getLinesArr2: () => [
      {width:20,height:12,elements:[{text:'开',width:10},{text:'始',width:10,style:{bold:true,textColor:0xff0000}}]},
      {width:12,height:10,elements:[{text:'GO',width:12,style:{size:10}}]}
    ]};
  const result = original5TextLayout(field,50,40);
  assert.equal(result.textWidth,20);
  assert.equal(result.textHeight,24);
  assert.deepEqual(result.runs.map(r => [r.text,r.x,r.y,r.weight,r.color]),[
    ['开',30,8,400,'#ffffff'],['始',40,8,700,'#ff0000'],['GO',38,22,400,'#ffffff']
  ]);
});

test('a text page remains valid between command capture and the native page snapshot', async () => {
  const engine = await createEngine({host: {
    surface: {}, close: async () => {},
    setTimeout(callback, delay) {
      const timer = setTimeout(callback, delay);
      return () => clearTimeout(timer);
    }
  }});
  const type = createAssetType('original5.test.text', isTexture);
  engine.assets.register(type, {
    async load() { return createTexture(createImageData2D({width: 4, height: 4, pixels: new Uint8Array(64)})); },
    dispose(texture) { texture.dispose(); }
  });
  const display = createOriginal5Display({engine, signal: new AbortController().signal});
  const raster = {acquireText() { return new Promise(resolve => { raster.deliver = resolve; }); }};
  class Field {
    createNativeDisplayObject() { this.$nativeDisplayObject = new display.api.NativeDisplayObject(7); }
    $onAddToStage() { this.stage = true; }
    $onRemoveFromStage() { this.stage = false; }
    $getLinesArr2() { return [{width: 4, height: 4, elements: [{text: 'A', width: 4}]}]; }
  }
  const egret = {sys: {}, TextField: Field};
  const text = installOriginal5Text(egret, {raster}, display);
  try {
    const field = Object.assign(new Field(), {size: 4, lineSpacing: 0, textColor: 0xffffff});
    field.createNativeDisplayObject();
    field.$onAddToStage();
    text.flush();
    const first = await engine.assets.acquire(createAssetRef(type, 'first'));
    raster.deliver(first);
    await Promise.resolve();
    assert.equal(field.$nativeDisplayObject.picture, undefined);
    text.flush();
    assert.equal(field.$nativeDisplayObject.picture.textureLease, first);
    field.$nativeDisplayObject.setText('B');
    text.flush();
    const second = await engine.assets.acquire(createAssetRef(type, 'second'));
    raster.deliver(second);
    await Promise.resolve();
    assert.equal(field.$nativeDisplayObject.picture.textureLease, first);
    assert.ok(isTexture(first.value));
    text.flush();
    assert.equal(field.$nativeDisplayObject.picture.textureLease, second);
    assert.throws(() => first.value, {code: 'ASSET_LEASE_RELEASED'});
    field.$onRemoveFromStage();
    assert.ok(isTexture(second.value));
    text.flush();
    assert.throws(() => second.value, {code: 'ASSET_LEASE_RELEASED'});
  } finally {
    text.close();
    display.close();
    await engine.dispose();
  }
});

test('an empty original input retains its fill and one-unit border independently of text pages', () => {
  class Field {
    createNativeDisplayObject() { this.$nativeDisplayObject = new display.api.NativeDisplayObject(7); }
    $onAddToStage() { this.stage = true; }
    $onRemoveFromStage() { this.stage = false; }
    $getLinesArr2() { return []; }
  }
  const display = createOriginal5Display({engine:{assets:{register() {}}}});
  const text = installOriginal5Text({sys:{}, TextField:Field}, {raster:{}}, display);
  try {
    const field = Object.assign(new Field(), {lineSpacing:0});
    field.createNativeDisplayObject();
    field.$onAddToStage();
    const node = field.$nativeDisplayObject;
    node.setTextFieldWidth(10);
    node.setTextFieldHeight(8);
    field.background = true;
    field.backgroundColor = 0xaaff00;
    node.setBackground(true);
    text.flush();
    assert.equal(containsOwnPaint(node.content,{x:5,y:4}), true);
    field.background = false;
    field.border = true;
    field.borderColor = 0x000000;
    node.setBackground(false);
    node.setBorder(true);
    text.flush();
    assert.equal(containsOwnPaint(node.content,{x:5,y:4}), false);
    assert.equal(containsOwnPaint(node.content,{x:0.5,y:4}), true);
    assert.equal(containsOwnPaint(node.content,{x:9.5,y:4}), true);
    field.border = false;
    node.setBorder(false);
    text.flush();
    assert.equal(containsOwnPaint(node.content,{x:0.5,y:4}), false);
    assert.equal(node.picture, undefined);
  } finally { text.close(); display.close(); }
});
