// SPDX-License-Identifier: Apache-2.0
// Masks of vector shapes and lines of gradients. A mask is admitted as one of the effect's masks, captured as an image
// of its alpha placed where its drawing is, kept while it is the same and drawn anew when it changes. A line takes a
// gradient as a fill does and refuses what a fill refuses. examples/vector-mask/verify.mjs draws the pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';

const hasCode = code => error => error?.code === code;
const host = () => ({ surface: {}, start() {}, stop() {}, async close() {}, setTimeout: () => () => {} });
async function scene(body) {
  const engine = await egret.createEngine({ host: host() }),
    scope = engine.createScope();
  const group = engine.stage.addChild(scope.use(new egret.DisplayObjectContainer()));
  const content = group.addChild(scope.use(new egret.Sprite()));
  content.graphics.beginFill(0xff0000).drawRect(0, 0, 100, 100).endFill();
  try {
    await body({
      engine,
      scope,
      group,
      capture: () => engine.captureSharedFrame({ width: 128, height: 128 })
    });
  } finally {
    scope.dispose();
    await engine.dispose();
  }
}
const effectOf = frame => frame.commands.find(c => c.kind === 'barrier' && c.reason === 'effect-enter').effect;
const alphaAt = (image, x, y) => egret.copyImageData2DPixels(image)[4 * (y * image.width + x) + 3];
/** The linear-light colour of each vertex of a node's drawing, as r, g, b, a. */
const vertexColours = (engine, node) => {
  const frame = engine.captureSharedFrame({ width: 128, height: 128 });
  const mesh = frame.commands.find(c => c.kind === 'mesh');
  const geometry = frame.geometries[mesh.geometryIndex];
  const out = [];
  for (let i = 0; i < geometry.vertexCount; i++)
    out.push({ x: geometry.positions[2 * i], colour: geometry.lightColors.slice(4 * i, 4 * i + 4) });
  return out;
};

// Break caught: take a mask that is not a node, two masks at once, the node itself, or a node of another engine.
test('VM01 a shape mask is a display node of the same engine, and the one mask of its effect', () =>
  scene(async f => {
    const mask = f.scope.use(new egret.Sprite());
    for (const bad of [{}, 1, 'circle', null])
      assert.throws(() => (f.group.renderEffect = { shapeMask: bad }), hasCode('DISPLAY_EFFECT_MASK_INVALID'));
    assert.throws(() => (f.group.renderEffect = { shapeMask: f.group }), hasCode('DISPLAY_EFFECT_MASK_INVALID'));
    const other = await egret.createEngine({ host: host() });
    try {
      const foreign = other.createScope().use(new egret.Sprite());
      assert.throws(() => (f.group.renderEffect = { shapeMask: foreign }), hasCode('ENGINE_MISMATCH'));
    } finally {
      await other.dispose();
    }
    f.group.renderEffect = { shapeMask: mask, blurRadius: 1 };
    assert.equal(f.group.renderEffect.shapeMask, mask);
    assert.equal(f.group.renderEffect.blurRadius, 1);
  }));

// Break caught: mask with a blank image, place the mask where it is not drawn, or let it fall outside its own image.
test('VM02 a frame masks by an image of the shape, white where it covers and clear where it does not', () =>
  scene(async f => {
    const mask = f.scope.use(new egret.Sprite());
    mask.graphics.beginFill(0xffffff).drawCircle(50, 50, 40).endFill();
    f.group.renderEffect = { shapeMask: mask };
    const frame = f.capture(),
      effect = effectOf(frame);
    assert.notEqual(effect.maskPageIndex, undefined);
    const rect = effect.maskRect;
    assert.ok(Math.abs(rect.x - 10) < 0.01 && Math.abs(rect.y - 10) < 0.01, JSON.stringify(rect));
    assert.ok(Math.abs(rect.width - 80) < 0.01 && Math.abs(rect.height - 80) < 0.01, JSON.stringify(rect));
    const image = frame.pages[effect.maskPageIndex].source;
    // At twice the node's size: 160 pixels across the circle.
    assert.equal(image.width, 160);
    assert.equal(alphaAt(image, 80, 80), 255);
    assert.equal(alphaAt(image, 1, 1), 0);
    assert.equal(alphaAt(image, 158, 158), 0);
    // An edge is part covered: around the circle, pixels the edge crosses are neither clear nor whole.
    const pixels = egret.copyImageData2DPixels(image);
    let partial = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0 && pixels[i] < 255) partial++;
    assert.ok(partial > 100, 'partly covered pixels at the edge: ' + partial);
    assert.deepEqual(
      [...egret.copyImageData2DPixels(image).slice(4 * 80 * 160 + 4 * 80, 4 * 80 * 160 + 4 * 80 + 3)],
      [255, 255, 255]
    );
  }));

// Break caught: keep an image after the mask was redrawn or moved, or make a new one every frame it stays the same.
test('VM03 the image is kept while the mask is the same and drawn anew when it changes or moves', () =>
  scene(async f => {
    const mask = f.scope.use(new egret.Sprite());
    mask.graphics.beginFill(0xffffff).drawRect(0, 0, 20, 20).endFill();
    f.group.renderEffect = { shapeMask: mask };
    const imageOf = frame => frame.pages[effectOf(frame).maskPageIndex].source;
    const first = f.capture(),
      again = f.capture();
    assert.equal(imageOf(again), imageOf(first));
    mask.x = 30;
    const moved = f.capture();
    assert.notEqual(imageOf(moved), imageOf(first));
    assert.equal(effectOf(moved).maskRect.x, 30);
    mask.graphics.clear().beginFill(0xffffff).drawRect(0, 0, 40, 10).endFill();
    const redrawn = f.capture();
    assert.deepEqual([effectOf(redrawn).maskRect.width, effectOf(redrawn).maskRect.height], [40, 10]);
    // Scaling the masked node a little keeps the image; doubling it draws one twice as fine.
    f.group.scaleX = f.group.scaleY = 1.05;
    assert.equal(imageOf(f.capture()), imageOf(redrawn));
    f.group.scaleX = f.group.scaleY = 2;
    assert.equal(imageOf(f.capture()).width, 2 * imageOf(redrawn).width);
  }));

// Break caught: let a mask with nothing drawn show everything, or a translucent mask show its content whole.
test('VM04 a mask that draws nothing hides everything, and a translucent one lets part through', () =>
  scene(async f => {
    const mask = f.scope.use(new egret.Sprite());
    f.group.renderEffect = { shapeMask: mask };
    const empty = f.capture(),
      effect = effectOf(empty);
    const image = empty.pages[effect.maskPageIndex].source;
    assert.deepEqual([image.width, image.height, alphaAt(image, 0, 0)], [1, 1, 0]);
    mask.graphics.beginFill(0xffffff, 0.5).drawRect(0, 0, 10, 10).endFill();
    const half = f.capture(),
      halfImage = half.pages[effectOf(half).maskPageIndex].source;
    assert.ok(Math.abs(alphaAt(halfImage, 10, 10) - 128) <= 1);
  }));

// Break caught: keep the line's own colour, colour the line by a gradient of no stops, or refuse nothing.
test('VM05 a line of a linear gradient runs from its first colour to its last along the gradient', () =>
  scene(async f => {
    const line = f.engine.stage.addChild(f.scope.use(new egret.Sprite()));
    f.group.visible = false;
    line.graphics
      .lineStyle(10, 0x00ff00)
      .lineLinearGradientStyle(0, 0, 100, 0, [
        { offset: 0, color: 0xff0000 },
        { offset: 1, color: 0x0000ff }
      ])
      .moveTo(0, 50)
      .lineTo(100, 50);
    const vertices = vertexColours(f.engine, line);
    const start = vertices.filter(v => v.x <= 0.01),
      end = vertices.filter(v => v.x >= 99.99);
    assert.ok(start.length > 0 && end.length > 0);
    for (const v of start)
      assert.deepEqual(
        [...v.colour].map(c => Math.round(c * 1000) / 1000),
        [1, 0, 0, 1]
      );
    for (const v of end)
      assert.deepEqual(
        [...v.colour].map(c => Math.round(c * 1000) / 1000),
        [0, 0, 1, 1]
      );
    // No vertex is the line's own green.
    assert.ok(vertices.every(v => v.colour[1] < 0.01));
    // Cut along its length, as a fill of the same gradient is, so the colour between is the gradient's.
    assert.ok(vertices.some(v => v.x > 30 && v.x < 70));
    for (const bad of [
      [],
      [{ offset: 0, color: 1 }],
      [
        { offset: 2, color: 1 },
        { offset: 1, color: 2 }
      ]
    ])
      assert.throws(() => line.graphics.lineLinearGradientStyle(0, 0, 1, 0, bad), hasCode('GRAPHICS_VALUE_INVALID'));
    assert.throws(
      () =>
        line.graphics.lineLinearGradientStyle(5, 5, 5, 5, [
          { offset: 0, color: 1 },
          { offset: 1, color: 2 }
        ]),
      hasCode('GRAPHICS_VALUE_INVALID')
    );
  }));

// Break caught: give a gradient to no line, let it outlast the next lineStyle, or take old arguments differently from a fill.
test('VM06 an old lineGradientStyle needs a line, ends with the next lineStyle, and reads as beginGradientFill does', () =>
  scene(async f => {
    f.group.visible = false;
    const line = f.engine.stage.addChild(f.scope.use(new egret.Sprite()));
    // Without a line it does nothing, and nothing is drawn.
    line.graphics.lineGradientStyle('linear', [0xff0000, 0x0000ff], [1, 1], [0, 255]);
    assert.throws(() => line.graphics.drawRect(0, 0, 10, 10), hasCode('GRAPHICS_FILL_REQUIRED'));
    line.graphics.clear();
    // A box of 200 units centred on (100, 50): red at x = 0, blue at x = 200.
    const box = { a: 200 / 1638.4, b: 0, c: 0, d: 100 / 1638.4, tx: 100, ty: 50 };
    line.graphics
      .lineStyle(4, 0x00ff00)
      .lineGradientStyle('linear', [0xff0000, 0x0000ff], [1, 1], [0, 255], box)
      .moveTo(0, 50)
      .lineTo(200, 50);
    const vertices = vertexColours(f.engine, line);
    const at = x => vertices.find(v => Math.abs(v.x - x) < 0.01).colour;
    assert.ok(at(0)[0] > 0.99 && at(0)[2] < 0.01);
    assert.ok(at(200)[2] > 0.99 && at(200)[0] < 0.01);
    line.graphics.lineStyle(4, 0x00ff00).moveTo(0, 90).lineTo(200, 90);
    const plain = vertexColours(f.engine, line).filter(v => v.colour[1] > 0.99);
    assert.ok(plain.length >= 4, 'the next line is its own green');
    assert.throws(
      () => line.graphics.lineGradientStyle('conic', [1, 2], [1, 1], [0, 255]),
      hasCode('GRAPHICS_VALUE_INVALID')
    );
  }));
