// SPDX-License-Identifier: Apache-2.0
// A turned shape whose corner all but touches the edge of the view. Its two crossings of that edge land a rounding
// error apart, which used to make a turn against the polygon thinner than any pixel: preparation or packing refused
// it, and one such frame stopped a game. The frame is now drawn, and the shape keeps its area.
// The private import is the built engine/dist/rendering helper, as AGENTS permits for geometry units.
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
const SIZE = { width: 400, height: 300 };
const SHAPES = {
  rect: {
    draw: g => g.beginFill(0x336699, 1).drawRect(-8, -3, 16, 6).endFill(),
    corners: [
      [-8, -3],
      [8, -3],
      [8, 3],
      [-8, 3]
    ],
    area: 96
  },
  triangle: {
    draw: g => g.beginFill(0xff0000, 1).moveTo(0, -10).lineTo(8, 8).lineTo(-8, 8).endFill(),
    corners: [
      [0, -10],
      [8, 8],
      [-8, 8]
    ],
    area: 144
  }
};
// Distances from the edge that a corner is left at: on it, and a rounding error to either side.
const NUDGES = [0, 1e-29, -1e-29, 1e-22, -1e-22, 1e-16, -1e-16, 1e-13, -1e-13];

async function withShape(shape, run) {
  const engine = await egret.createEngine({ host }),
    scope = engine.createScope();
  try {
    const sprite = scope.use(new egret.Sprite());
    shape.draw(sprite.graphics);
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
/** Where the shape's topmost corner is, for a rotation in degrees, measured from the sprite's own place. */
function top(shape, rotation) {
  const turn = (rotation * Math.PI) / 180,
    c = Math.cos(turn),
    s = Math.sin(turn);
  return Math.min(...shape.corners.map(([x, y]) => x * s + y * c));
}
/** The area of everything prepared, each polygon as a fan from its first corner. */
function areaOf(prepared) {
  let area = 0;
  for (const entry of prepared.entries)
    for (const polygon of entry.polygons)
      for (let i = 1; i + 1 < polygon.length; i++)
        area +=
          Math.abs(
            (polygon[i].x - polygon[0].x) * (polygon[i + 1].y - polygon[0].y) -
              (polygon[i].y - polygon[0].y) * (polygon[i + 1].x - polygon[0].x)
          ) / 2;
  return area;
}

for (const [name, shape] of Object.entries(SHAPES))
  test(`SCS01 a turned ${name} with a corner on the edge of the view is drawn, whole, at every turn tried`, () =>
    withShape(shape, (sprite, frame) => {
      // A fixed sequence of turns and places. Before the change about 3 in 100 of these frames were refused.
      let seed = 12345;
      const next = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
      let drawn = 0;
      for (let i = 0; i < 1200; i++) {
        const rotation = next() * 360;
        sprite.rotation = rotation;
        sprite.x = 50 + next() * 300;
        for (const nudge of NUDGES) {
          sprite.y = -top(shape, rotation) + nudge;
          const { prepared, packed } = frame();
          // The shape lies inside the view but for less than a rounding error, so all of it is there.
          const area = areaOf(prepared);
          assert.ok(Math.abs(area - shape.area) < 1e-6, `${name} at ${rotation}°, nudged ${nudge}: area ${area}`);
          for (const entry of prepared.entries)
            for (const polygon of entry.polygons) {
              assert.ok(polygon.length >= 3);
              // A crossing may sit a rounding error outside the edge it was cut at; no more than that.
              for (const point of polygon) assert.ok(point.y > -1e-9 && point.x > -1e-9, 'a corner outside the view');
            }
          assert.ok(packed.length > 0);
          drawn++;
        }
      }
      assert.equal(drawn, 1200 * NUDGES.length);
    }));

test('SCS02 placements that were refused are drawn, on the top edge and on the left one', () =>
  withShape(SHAPES.rect, (sprite, frame) => {
    // Recorded from the search that found the fault: each of these refused the frame with `precision`.
    for (const [rotation, x, y] of [
      [7.344966866075993, 54.96435447130352, 3.9981274657208314],
      [14.34755427762866, 273.1403667246923, 4.888856701162034],
      [347.6913723349571, 72.10026227403432, 4.6364605231208715],
      [142.7340655401349, 337.8563860664144, 7.231623620806906],
      [146.20510837063193, 335.82924695219845, 6.942874388099141]
    ]) {
      sprite.rotation = rotation;
      sprite.x = x;
      sprite.y = y;
      assert.ok(Math.abs(areaOf(frame().prepared) - 96) < 1e-6, `top edge at ${rotation}°`);
      // The same shape against the left edge: a quarter turn more, with the two coordinates changed over.
      sprite.rotation = rotation + 90;
      sprite.x = y;
      sprite.y = x * 0.5 + 20;
      assert.ok(Math.abs(areaOf(frame().prepared) - 96) < 1e-6, `left edge at ${rotation + 90}°`);
    }
  }));

test('SCS03 a shape that really crosses the edge is still cut by it', () =>
  withShape(SHAPES.rect, (sprite, frame) => {
    sprite.rotation = 0;
    sprite.x = 100;
    // Half of the rectangle's height is above the view.
    sprite.y = 0;
    assert.ok(Math.abs(areaOf(frame().prepared) - 48) < 1e-9);
    sprite.rotation = 30;
    sprite.y = 1;
    const area = areaOf(frame().prepared);
    assert.ok(area > 0 && area < 96, 'cut: ' + area);
  }));
