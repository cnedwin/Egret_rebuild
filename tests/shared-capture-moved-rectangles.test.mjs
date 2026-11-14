// SPDX-License-Identifier: Apache-2.0
// A moved node keeps the rectangles of its primitives and of its bitmap: their values do not depend on the matrix, only
// their checks do, and every check is made again under the new matrix before the rectangle is given.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';

const host = { surface: {}, start() {}, stop() {}, async close() {}, setTimeout() { return () => {}; } };
const SIZE = { width: 64, height: 64 };
const capture = engine => { try { return engine.captureSharedFrame(SIZE); } catch (cause) { return cause.code; } };
const draws = frame => frame.commands.filter(command => command.kind !== 'barrier');

test('SCR01 a moved sprite and bitmap give the same rectangles, checked again under each matrix', async () => {
  const engine = await egret.createEngine({ host }), scope = engine.createScope();
  const type = egret.createAssetType('shared-capture-rectangles', egret.isTexture);
  const texture = egret.createTexture(egret.createImageData2D({ width: 16, height: 16, pixels: new Uint8Array(1024).fill(200) }));
  engine.assets.register(type, { async load() { return texture; }, dispose(value) { value.dispose(); } });
  try {
    const lease = scope.use(await engine.assets.acquire(egret.createAssetRef(type, 'page'), { signal: scope.signal }));
    const sprite = scope.use(new egret.Sprite()), bitmap = scope.use(new egret.Bitmap(lease));
    sprite.graphics.beginFill(0x336699, 1).drawRect(1, 2, 5, 6).endFill().beginFill(0x996633, 0.5).drawRect(0, 0, 3, 3).endFill();
    bitmap.sourceRect = { x: 2, y: 2, width: 8, height: 4 };
    engine.stage.addChild(sprite); engine.stage.addChild(bitmap);
    const first = capture(engine);
    const values = frame => draws(frame).map(command => ({ ...command.rect }));
    assert.deepEqual(values(first), [{ x: 1, y: 2, width: 5, height: 6 }, { x: 0, y: 0, width: 3, height: 3 }, { x: 0, y: 0, width: 8, height: 4 }]);
    // Moved, every draw has a new matrix and the same rectangle, still frozen.
    sprite.x = 7; bitmap.y = 9;
    const moved = capture(engine);
    assert.deepEqual(values(moved), values(first));
    for (const command of draws(moved)) assert.ok(Object.isFrozen(command.rect));
    assert.deepEqual(draws(moved).map(command => [command.matrix.tx, command.matrix.ty]), [[7, 0], [7, 0], [0, 9]]);
    // A finite matrix that places a corner of a rectangle at an infinity is refused, for either node, and the same
    // node captured again under that matrix is refused again: its rectangles were not taken as checked.
    sprite.scaleX = 3e307;
    assert.equal(capture(engine), 'FRAME_TRANSFORM_INVALID');
    assert.equal(capture(engine), 'FRAME_TRANSFORM_INVALID');
    sprite.scaleX = 1;
    assert.deepEqual(values(capture(engine)), values(first));
    bitmap.scaleY = 1e308;
    assert.equal(capture(engine), 'FRAME_TRANSFORM_INVALID');
    assert.equal(capture(engine), 'FRAME_TRANSFORM_INVALID');
    bitmap.scaleY = 1;
    assert.deepEqual(values(capture(engine)), values(first));
  } finally { scope.dispose(); await engine.dispose(); if (!texture.isDisposed) texture.dispose(); }
});
