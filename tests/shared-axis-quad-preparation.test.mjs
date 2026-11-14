// SPDX-License-Identifier: Apache-2.0
// A quad of a matrix without rotation or shear is prepared without the general path's tests. Every number below was
// recorded from the general path before that shortcut existed: the corners, their order and every charge must stay.
// The private import is the built engine/dist/rendering helper, as AGENTS permits for geometry units.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { prepareSharedDraws2D } from '../packages/engine/dist/rendering/prepareSharedDraws2D.js';

const LIMITS = { maxCommands: 65536, maxClipRectangles: 262144, maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304, maxSourceTriangles: 65536, maxFrameGeometryBytes: 16777216, maxTupleComparisons: 1048576, pixelRatio: 1 };
const host = { surface: {}, start() {}, stop() {}, async close() {}, setTimeout() { return () => {}; } };
async function frameOf(placements, size) {
  const engine = await egret.createEngine({ host }), scope = engine.createScope();
  try {
    for (const [scaleX, scaleY, x, y] of placements) {
      const sprite = scope.use(new egret.Sprite());
      sprite.graphics.beginFill(0x336699, 1).drawRect(1, 2, 10, 6).endFill();
      sprite.x = x; sprite.y = y; sprite.scaleX = scaleX; sprite.scaleY = scaleY;
      engine.stage.addChild(sprite);
    }
    return engine.captureSharedFrame(size);
  } finally { scope.dispose(); await engine.dispose(); }
}
const corners = prepared => prepared.entries.map(entry => entry.polygons.map(polygon => polygon.map(point => [point.x, point.y])));
const reason = run => { try { run(); return 'ok'; } catch (cause) { return cause.reason; } };

test('SAQ01 mirrored and scaled quads keep the corners, the order and the charges of the general path', async () => {
  const frame = await frameOf([[1, 1, 40, 30], [-1, 1, 40, 30], [1, -2, 40, 30], [-0.5, -3, 40, 30]], { width: 100, height: 80 });
  const prepared = prepareSharedDraws2D(frame, 100, 80, LIMITS);
  assert.deepEqual(prepared.budget.snapshot(), { sourceTrianglesCharged: 0, preparedVerticesCharged: 24, predicatesCharged: 156, tupleComparisonsCharged: 200 });
  // Clockwise in backing space whichever way the quad was mirrored: a mirrored one starts from its other side.
  assert.deepEqual(corners(prepared), [
    [[[41, 32], [51, 32], [51, 38], [41, 38]]],
    [[[39, 38], [29, 38], [29, 32], [39, 32]]],
    [[[41, 14], [51, 14], [51, 26], [41, 26]]],
    [[[39.5, 24], [34.5, 24], [34.5, 6], [39.5, 6]]],
  ]);
  // The charges are made at the same totals: one predicate or one comparison fewer refuses the frame.
  assert.deepEqual([155, 156].map(n => reason(() => prepareSharedDraws2D(frame, 100, 80, { ...LIMITS, maxClipEdgeTests: n }))), ['budget', 'ok']);
  assert.deepEqual([199, 200].map(n => reason(() => prepareSharedDraws2D(frame, 100, 80, { ...LIMITS, maxTupleComparisons: n }))), ['budget', 'ok']);
});

test('SAQ02 a quad that collapses once placed is left to the general path, and clipping follows as before', async () => {
  const frame = await frameOf([[1e-29, 1, 40, 30], [1, 1, -5, 75], [2, 1, 95, -3]], { width: 100, height: 80 });
  const prepared = prepareSharedDraws2D(frame, 100, 80, LIMITS);
  assert.deepEqual(prepared.budget.snapshot(), { sourceTrianglesCharged: 0, preparedVerticesCharged: 12, predicatesCharged: 97, tupleComparisonsCharged: 120 });
  assert.deepEqual(corners(prepared), [[], [[[0, 77], [6, 77], [6, 80], [0, 80]]], [[[100, 5], [97, 5], [97, 0], [100, 0]]]]);
  const scaled = prepareSharedDraws2D(frame, 100, 80, { ...LIMITS, pixelRatio: 1.5 });
  assert.deepEqual(scaled.budget.snapshot(), { sourceTrianglesCharged: 0, preparedVerticesCharged: 0, predicatesCharged: 53, tupleComparisonsCharged: 55 });
  assert.deepEqual(corners(scaled), [[], [], []]);
});
