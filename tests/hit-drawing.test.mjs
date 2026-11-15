// SPDX-License-Identifier: Apache-2.0
// A touch enabled node without a hit area is hit on what it draws, and a tap is an end on the target a contact began on.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { createPointerInput } from '@egret/engine/input';
import { host } from './helpers.mjs';

async function withStage(run) {
  const engine = await egret.createEngine({ host: host().adapter }),
    scope = engine.createScope();
  const sprite = () => engine.stage.addChild(scope.use(new egret.Sprite()));
  try {
    await run({ engine, scope, sprite });
  } finally {
    scope.dispose();
    await engine.dispose();
  }
}
// Time only goes forward for a pointer input.
let clock = 0;
const sample = (id, x, y) => ({
  pointerId: id,
  pointerType: 'touch',
  globalX: x,
  globalY: y,
  buttons: 1,
  timestamp: ++clock
});
const at = (x, y) => ({ globalX: x, globalY: y, buttons: 0, timestamp: ++clock });

test('HD01 a touch enabled node without a hit area is hit on its drawing, and only there', () =>
  withStage(({ engine, sprite }) => {
    const stage = engine.stage;
    // A circle: hit inside it, not in the corner of its bounds that it does not cover.
    const disc = sprite();
    disc.graphics.beginFill(0xff0000).drawCircle(50, 50, 20).endFill();
    assert.equal(stage.hitTest(50, 50), undefined, 'not touch enabled');
    disc.touchEnabled = true;
    assert.equal(stage.hitTest(50, 50), disc);
    assert.equal(stage.hitTest(50, 31), disc);
    assert.equal(stage.hitTest(32, 32), undefined, 'inside the bounds, outside the circle');
    assert.equal(stage.hitTest(80, 50), undefined);
    // Rectangles kept as rectangles, each of them.
    const bars = sprite();
    bars.graphics.beginFill(1).drawRect(100, 0, 10, 10).drawRect(120, 0, 10, 10).endFill();
    bars.touchEnabled = true;
    assert.equal(stage.hitTest(105, 5), bars);
    assert.equal(stage.hitTest(125, 5), bars);
    assert.equal(stage.hitTest(115, 5), undefined, 'between the two');
    // A hole is not hit, and a line is hit across its width.
    const ring = sprite();
    ring.touchEnabled = true;
    ring.graphics
      .beginFill(1)
      .moveTo(0, 100)
      .lineTo(30, 100)
      .lineTo(30, 130)
      .lineTo(0, 130)
      .lineTo(0, 100)
      .moveTo(10, 110)
      .lineTo(10, 120)
      .lineTo(20, 120)
      .lineTo(20, 110)
      .lineTo(10, 110)
      .endFill();
    assert.equal(stage.hitTest(5, 105), ring);
    assert.equal(stage.hitTest(15, 115), undefined, 'the hole');
    const line = sprite();
    line.touchEnabled = true;
    line.graphics.lineStyle(6, 0).moveTo(100, 100).lineTo(160, 100);
    assert.equal(stage.hitTest(130, 102), line);
    assert.equal(stage.hitTest(130, 104), undefined);
    // The node's place, scale and turn are followed.
    disc.x = 200;
    disc.scaleX = 2;
    assert.equal(stage.hitTest(300, 50), disc);
    assert.equal(stage.hitTest(335, 50), disc);
    assert.equal(stage.hitTest(50, 50), undefined);
    // A hit area, when there is one, is the whole answer; one of no size hits nothing, as before.
    disc.hitArea = { x: 0, y: 0, width: 5, height: 5 };
    assert.equal(stage.hitTest(300, 50), undefined);
    assert.equal(stage.hitTest(204, 2), disc);
    disc.hitArea = { x: 0, y: 0, width: 0, height: 5 };
    assert.equal(stage.hitTest(300, 50), undefined);
    disc.hitArea = undefined;
    assert.equal(stage.hitTest(300, 50), disc);
    // A node that draws nothing is not hit, and the later of two that overlap is.
    const empty = sprite();
    empty.touchEnabled = true;
    const over = sprite();
    over.touchEnabled = true;
    over.graphics.beginFill(2).drawRect(290, 40, 20, 20).endFill();
    assert.equal(stage.hitTest(300, 50), over);
  }));

test('HD02 a bitmap without a hit area is hit on its rectangle', () =>
  withStage(async ({ engine, scope }) => {
    const type = egret.createAssetType('hit-drawing-image', egret.isTexture);
    const texture = egret.createTexture(
      egret.createImageData2D({ width: 16, height: 8, pixels: new Uint8Array(512).fill(255) })
    );
    engine.assets.register(type, {
      async load() {
        return texture;
      },
      dispose(value) {
        value.dispose();
      }
    });
    try {
      const lease = scope.use(
        await engine.assets.acquire(egret.createAssetRef(type, 'image'), { signal: scope.signal })
      );
      const bitmap = engine.stage.addChild(scope.use(new egret.Bitmap(lease)));
      bitmap.x = 10;
      bitmap.y = 20;
      bitmap.touchEnabled = true;
      assert.equal(engine.stage.hitTest(10, 20), bitmap);
      assert.equal(engine.stage.hitTest(25, 27), bitmap);
      assert.equal(engine.stage.hitTest(26, 27), undefined);
      assert.equal(engine.stage.hitTest(9, 20), undefined);
    } finally {
      if (!texture.isDisposed) texture.dispose();
    }
  }));

test('HD03 a tap follows an end on the target its contact began on, close to where it began', () =>
  withStage(({ engine, scope, sprite }) => {
    const a = sprite(),
      b = sprite();
    a.graphics.beginFill(1).drawCircle(20, 20, 15).endFill();
    a.touchEnabled = true;
    b.graphics.beginFill(2).drawRect(60, 5, 30, 30).endFill();
    b.touchEnabled = true;
    const input = createPointerInput({ engine, scope, width: 100, height: 100 }),
      log = [];
    for (const [name, node] of [
      ['a', a],
      ['b', b]
    ])
      for (const kind of ['begin', 'end', 'tap', 'cancel'])
        node.on(input.events[kind], event => log.push(name + ':' + kind + '@' + event.payload.globalX));
    engine.stage.on(input.events.tap, event => log.push('stage:tap:' + (event.target === a ? 'a' : 'b')));
    // Down and up in place: begin, end, then the tap, which bubbles.
    let id = input.begin(sample(1, 20, 20));
    input.end(id, at(22, 21));
    assert.deepEqual(log.splice(0), ['a:begin@20', 'a:end@22', 'a:tap@22', 'stage:tap:a']);
    // Up more than twelve units away, still on the node it holds: an end and no tap.
    id = input.begin(sample(2, 62, 20));
    input.move(id, { ...at(80, 20), buttons: 1 });
    input.end(id, at(80, 20));
    assert.deepEqual(log.splice(0), ['b:begin@62', 'b:end@80']);
    // A contact that is cancelled is no tap, and the next one starts afresh.
    id = input.begin(sample(3, 20, 20));
    input.cancel(id, 'pointercancel');
    id = input.begin(sample(4, 20, 20));
    input.end(id, at(20, 20));
    assert.deepEqual(log.splice(0), ['a:begin@20', 'a:cancel@20', 'a:begin@20', 'a:end@20', 'a:tap@20', 'stage:tap:a']);
    // Nothing under the contact: no begin on a node, and no tap.
    id = input.begin(sample(5, 45, 90));
    input.end(id, at(45, 90));
    assert.deepEqual(log.splice(0), []);
    // A node disposed by its own end listener is not tapped.
    b.on(input.events.end, () => b.dispose());
    id = input.begin(sample(6, 70, 20));
    input.end(id, at(70, 20));
    assert.deepEqual(log.splice(0), ['b:begin@70', 'b:end@70']);
    input.dispose();
  }));
