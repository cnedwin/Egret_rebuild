// SPDX-License-Identifier: Apache-2.0
// Original public CPU fixture. No SDK internals, prototype/global hooks or rendering oracle.
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

export { egret };
export const FRAME = Object.freeze({ width: 160, height: 128 });
export const hasCode = code => error => error instanceof egret.EgretError && error.code === code;
export const expectCode = (run, code) => assert.throws(run, hasCode(code));
export function requireCandidate(engine) {
  assert.equal(typeof engine.capturePreparedSharedFrame, 'function', 'M15_CANDIDATE_CAPTURE_MISSING');
}
export function candidate(f, ticket, options = FRAME) {
  requireCandidate(f.engine);
  return f.engine.capturePreparedSharedFrame(ticket, options);
}
export const imageDraw = frame => frame.commands.find(command => command.kind === 'image');
export function frameShape(frame) {
  const { frameId, pages, ...rest } = frame;
  return { ...rest, pages: pages.map(page => ({ ...page, source: {
    width: page.source.width, height: page.source.height,
    pixels: Array.from(egret.copyImageData2DPixels(page.source)),
  } })) };
}
export function fieldSnapshot(f) {
  return { lease: f.target.textureLease, sourceRect: f.target.sourceRect,
    width: f.target.naturalWidth, height: f.target.naturalHeight,
    inner: f.inner.getBounds(), outer: f.outer.getBounds() };
}
export function assertFrozenFrame(frame) {
  for (const value of [frame, frame.commands, frame.pages, frame.regions, frame.materials, frame.geometries]) {
    assert.ok(Object.isFrozen(value));
  }
  for (const command of frame.commands) {
    assert.ok(Object.isFrozen(command));
    if (command.kind === 'barrier') continue;
    for (const value of [command.matrix, command.clips, ...(command.rect ? [command.rect] : [])]) assert.ok(Object.isFrozen(value));
    for (const clip of command.clips) {
      assert.ok(Object.isFrozen(clip)); assert.ok(Object.isFrozen(clip.matrix)); assert.ok(Object.isFrozen(clip.rect));
    }
  }
  for (const region of frame.regions) { assert.ok(Object.isFrozen(region)); assert.ok(Object.isFrozen(region.packed)); }
}

export async function fixture(body) {
  const port = host(), engine = await egret.createEngine({ host: port.adapter, clock: { maxDeltaSeconds: 1 } });
  const oldScope = engine.createScope(), nextScope = engine.createScope();
  const targetScope = engine.createScope(), bindingScope = engine.createScope();
  const records = new Map(), disposals = [], loads = [];
  const type = egret.createAssetType('candidate-frame-original-textures', egret.isTexture);
  engine.assets.register(type, {
    async load(ref) {
      const record = records.get(ref.id); assert.ok(record);
      const pixels = new Uint8Array(record.width * record.height * 4);
      for (let offset = 0; offset < pixels.length; offset += 4) pixels.set(record.rgba, offset);
      record.image = egret.createImageData2D({ width: record.width, height: record.height, pixels });
      record.texture = record.view === undefined ? egret.createTexture(record.image) : egret.createTextureView(record.image, record.view);
      loads.push(ref.id); return record.texture;
    },
    dispose(texture) { disposals.push(texture); texture.dispose(); },
  });
  const f = {
    engine, oldScope, nextScope, targetScope, bindingScope, port, records, disposals, loads,
    add(node, parent = engine.stage) { targetScope.use(node); parent.addChild(node); return node; },
    async resource(width, height, rgba = [77, 37, 19, 255], view, owner = nextScope) {
      const id = 'candidate-resource-' + records.size;
      const record = { width, height, rgba, view }; records.set(id, record);
      const group = engine.createAssetGroup(owner, [egret.createAssetRef(type, id)]);
      const members = await group.ready;
      return { group, members, lease: members[0], image: record.image, texture: record.texture };
    },
    capture(options = FRAME) { return engine.captureSharedFrame(options); },
    async prepare({ width = 64, height = 64, view } = {}) {
      const ticket = engine.captureBitmapBindings(bindingScope, [f.target]);
      const next = await f.resource(width, height, [77, 37, 19, 255], view);
      ticket.prepare(next.members); return { ticket, ...next };
    },
  };
  try {
    f.old = await f.resource(16, 16, [17, 37, 19, 255], undefined, oldScope);
    f.outer = f.add(new egret.Sprite()); f.outer.x = 5; f.outer.y = 7; f.outer.scaleX = 2; f.outer.scaleY = 1.5;
    f.outer.clipRect = { x: 0, y: 0, width: 50, height: 46 };
    f.inner = f.add(new egret.Sprite(), f.outer); f.inner.x = 3; f.inner.y = 4; f.inner.scaleY = 2;
    f.inner.clipRect = { x: 2, y: 1, width: 40, height: 32 };
    f.target = f.add(new egret.Bitmap(f.old.lease), f.inner);
    f.neighbor = f.add(new egret.Sprite()); f.neighbor.x = 140; f.neighbor.y = 1;
    f.neighbor.graphics.beginFill(0x00ff00).drawRect(0, 0, 2, 3).endFill();
    assert.ok(engine instanceof egret.Engine); assert.ok(bindingScope instanceof egret.Scope);
    assert.equal(f.old.group.state, 'ready'); assert.equal(f.target.naturalWidth, 16);
    const ordinary = f.capture(); assert.equal(imageDraw(ordinary).rect.width, 16);
    assert.equal(ordinary.pages[0].source, f.old.image); assert.deepEqual(disposals, []);
    return await body(f);
  } finally {
    bindingScope.dispose(); targetScope.dispose(); nextScope.dispose(); oldScope.dispose(); await engine.dispose();
    assert.deepEqual(port.trace, ['start', 'stop', 'close']); assert.equal(port.timers.size, 0);
    const issued = [...records.values()].filter(record => record.texture !== undefined).map(record => record.texture);
    assert.equal(disposals.length, issued.length); assert.equal(new Set(disposals).size, issued.length);
    for (const texture of issued) assert.equal(texture.isDisposed, true);
  }
}
