// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import * as sdk from '@egret/engine';
import { createLegacySceneLayer, createLegacyTileIndex } from '../tools/egret-migrate/compat/scene.mjs';

test('sparse viewport handles negative bounds, holes, exact right edges and an empty world', () => {
  const index = createLegacyTileIndex(
    [
      { column: 3, row: 2, id: 'far', asset: 'b' },
      { column: -1, row: 0, id: 'west', asset: 'a' },
      { column: 1, row: 0, id: 'east', asset: 'a' }
    ],
    32
  );
  const ids = rect => index.visible(rect).map(tile => tile.id);
  assert.deepEqual(ids({ x: -32, y: 0, width: 64, height: 32 }), ['west']);
  assert.deepEqual(ids({ x: 32, y: 0, width: 32, height: 32 }), ['east']);
  assert.deepEqual(ids({ x: 0, y: 0, width: 0, height: 32 }), []);
  assert.deepEqual(ids({ x: -32, y: 0, width: 1e9, height: 1e9 }), ['west', 'east', 'far']);
});

test('streamed parts keep order and pose, cancel stale pages, retry errors and drain on close', async () => {
  const engine = await sdk.createEngine({
    host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout: () => () => {} }
  });
  const game = { engine, scope: engine.createScope() };
  const type = sdk.createAssetType('scene-test', sdk.isTexture);
  let allocations = 0,
    releases = 0;
  engine.assets.register(type, {
    async load() {
      allocations++;
      return sdk.createTexture(
        sdk.createImageData2D({
          width: 2,
          height: 1,
          pixels: Uint8Array.of(255, 0, 0, 255, 0, 255, 0, 255)
        })
      );
    },
    dispose(texture) {
      releases++;
      texture.dispose();
    }
  });
  const clip = sdk.createSequenceClip({
    atlasWidth: 2,
    atlasHeight: 1,
    frames: [
      { x: 0, y: 0, width: 1, height: 1, durationSeconds: 0.1 },
      { x: 1, y: 0, width: 1, height: 1, durationSeconds: 0.1 }
    ]
  });
  const pending = [];
  const layer = createLegacySceneLayer({
    sdk,
    game,
    concurrency: 2,
    async acquire(key, signal) {
      const gate = Promise.withResolvers();
      pending.push({ key, signal, ...gate });
      await gate.promise; // This provider deliberately delivers even after cancellation.
      return engine.assets.acquire(sdk.createAssetRef(type, key));
    }
  });
  try {
    game.engine.stage.addChild(layer.display);
    const actor = { id: 'body', asset: 'body-atlas', clip, x: 15 };
    const hand = { id: 'hand', asset: 'hand-atlas', clip };
    layer.update([{ id: 'gone', asset: 'old' }, actor, hand]);
    assert.deepEqual(
      pending.map(x => x.key),
      ['old', 'body-atlas']
    );
    layer.update([hand, actor]);
    assert.equal(pending[0].signal.aborted, true);
    const tick = () => new Promise(resolve => setImmediate(resolve));
    pending[0].resolve();
    while (pending.length < 3) await tick();
    layer.seek(0.12);
    pending[2].resolve();
    pending[1].resolve();
    await layer.settled();
    const [h, b] = [layer.display.getChildAt(0), layer.display.getChildAt(1)];
    assert.equal(b.x, 15);
    assert.deepEqual([h.getChildAt(0).sourceRect.x, b.getChildAt(0).sourceRect.x], [1, 1]);
    layer.update([actor, hand]);
    assert.equal(layer.display.getChildAt(0), b);
    assert.equal(pending.length, 3);

    const badge = { id: 'badge', asset: 'badge' };
    layer.update([badge]);
    assert.equal(b.isDisposed, true);
    pending[3].reject(new Error('Read failed'));
    assert.equal((await layer.settled())[0].status, 'failed');
    layer.update([badge]);
    pending[4].resolve();
    assert.equal((await layer.settled())[0].status, 'ready');
    layer.update([{ id: 'late', asset: 'late' }]);
    const done = layer.close();
    assert.equal(pending[5].signal.aborted, true);
    pending[5].resolve();
    await done;
    assert.equal(layer.display.isDisposed, true);
    assert.equal(allocations, releases);
    assert.equal(allocations, 5);
  } finally {
    await engine.dispose();
  }
});
