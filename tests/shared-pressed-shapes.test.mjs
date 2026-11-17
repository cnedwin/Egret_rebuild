// SPDX-License-Identifier: Apache-2.0
// A shape whose scale passes through nothing, as a card does when it turns over. Just before the scale is 0 it is a
// rounding error, the shape is thinner than any pixel, and the rounding of its corners turns some of its triangles
// over: preparation refused them, and one such frame stopped a game. Such a triangle is now left out, and the frame
// is drawn. The private import is the built engine/dist/rendering helper, as AGENTS permits for geometry units.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { prepareSharedDraws2D } from '../packages/engine/dist/rendering/prepareSharedDraws2D.js';
import { packSharedDraws2D } from '../packages/engine/dist/rendering/packSharedDraws2D.js';

const LIMITS = {
  maxCommands: 65536,
  maxClipRectangles: 262144,
  maxPreparedVertices: 1048576,
  maxClipEdgeTests: 4194304,
  maxSourceTriangles: 65536,
  maxFrameGeometryBytes: 16777216,
  maxTupleComparisons: 1048576,
  pixelRatio: 1
};
const host = {
  surface: {},
  start() {},
  stop() {},
  async close() {},
  setTimeout() {
    return () => {};
  }
};
const SIZE = { width: 360, height: 520 };
const SHAPES = {
  'rounded rectangle': g => g.beginFill(0x3a506b).drawRoundRect(-35, -35, 70, 70, 16).endFill(),
  circle: g => g.beginFill(0xff6b6b).drawCircle(0, 0, 20).endFill(),
  ellipse: g => g.beginFill(0x7be069).drawEllipse(-30, -18, 60, 36).endFill(),
  triangle: g => g.beginFill(0xb197fc).moveTo(0, -10).lineTo(8, 8).lineTo(-8, 8).endFill(),
  line: g => g.lineStyle(3, 0xffd23f).moveTo(-10, 0).lineTo(10, 5).lineTo(0, 20)
};

async function withShape(draw, run) {
  const engine = await egret.createEngine({ host }),
    scope = engine.createScope();
  try {
    const sprite = scope.use(new egret.Sprite());
    draw(sprite.graphics);
    sprite.x = 57;
    sprite.y = 115;
    engine.stage.addChild(sprite);
    const frame = () => {
      const prepared = prepareSharedDraws2D(engine.captureSharedFrame(SIZE), SIZE.width, SIZE.height, LIMITS);
      return { prepared, packed: packSharedDraws2D(prepared) };
    };
    await run(sprite, frame);
  } finally {
    scope.dispose();
    await engine.dispose();
  }
}
/** The area of everything prepared, each polygon as a fan from its first corner. */
function areaOf(prepared) {
  let area = 0;
  for (const entry of prepared.entries)
    for (const polygon of entry.polygons ?? [])
      for (let i = 1; i + 1 < polygon.length; i++)
        area +=
          Math.abs(
            (polygon[i].x - polygon[0].x) * (polygon[i + 1].y - polygon[0].y) -
              (polygon[i].y - polygon[0].y) * (polygon[i + 1].x - polygon[0].x)
          ) / 2;
  return area;
}
/** Scales from 1 down through every size of rounding error to nothing: a thousand even steps, then 22 decades. */
const SCALES = [...Array(4001).keys()].map(k => (k < 1000 ? 1 - k / 1000 : 10 ** (-((k - 1000) / 3000) * 22)));

// Break caught: refuse a triangle its matrix has pressed flat and rounding has turned over.
for (const [name, draw] of Object.entries(SHAPES))
  for (const rotation of [0, 30])
    for (const axis of ['scaleX', 'scaleY'])
      test(`SPS01 ${name}, turned ${rotation}°: drawn at every ${axis} on its way to nothing`, () =>
        withShape(draw, (sprite, frame) => {
          sprite.rotation = rotation;
          const whole = areaOf(frame().prepared);
          assert.ok(whole > 10);
          for (const scale of SCALES) {
            sprite[axis] = scale;
            // Before the change, up to a quarter of these frames were refused with `precision`.
            const area = areaOf(frame().prepared);
            // What is drawn is the shape at that scale; pressed thinner than a pixel it may be nothing at all.
            assert.ok(area <= whole * scale * 1.001 + 1e-9, `${axis} ${scale}: area ${area}`);
            if (scale >= 0.01) assert.ok(area >= whole * scale * 0.999, `${axis} ${scale}: area ${area}`);
          }
          sprite[axis] = 0;
          assert.equal(areaOf(frame().prepared), 0);
        }));

// Break caught: let a card that has turned over and back come back changed, or stop the frames between.
test('SPS02 the scales a tween gives on the way to 0 and back are all drawn, and the shape comes back whole', () =>
  withShape(SHAPES['rounded rectangle'], (sprite, frame) => {
    const whole = areaOf(frame().prepared);
    // Recorded from a tween of scaleX to 0 over a tenth of a second in a browser: its last step is a rounding error.
    for (const scale of [0.833, 0.666, 0.499, 0.333, 0.166, 1.3322676295501878e-15, 0, 0.167, 0.5, 0.834, 1]) {
      sprite.scaleX = scale;
      const { prepared, packed } = frame();
      assert.ok(areaOf(prepared) <= whole * scale * 1.001 + 1e-9);
      assert.ok(Array.isArray(packed));
    }
    assert.ok(Math.abs(areaOf(frame().prepared) - whole) < 1e-9);
    // The same step for a circle, and for both at once.
    sprite.scaleX = 2.220446049250313e-16;
    sprite.scaleY = 2.220446049250313e-16;
    assert.ok(areaOf(frame().prepared) < 1e-9);
  }));
