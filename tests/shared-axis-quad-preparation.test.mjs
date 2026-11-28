// SPDX-License-Identifier: Apache-2.0
// A quad of a matrix without rotation or shear is prepared without the general path's tests. Every number below was
// recorded from the general path before that shortcut existed: the corners, their order and every charge must stay.
// The private import is the built engine/dist/rendering helper, as AGENTS permits for geometry units.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import {
  isPreparedContainedQuad,
  prepareSharedDraws2D,
  prepareSharedDrawsForSubmission2D
} from '../packages/engine/dist/rendering/prepareSharedDraws2D.js';
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
async function frameOf(placements, size) {
  const engine = await egret.createEngine({ host }),
    scope = engine.createScope();
  try {
    for (const [scaleX, scaleY, x, y] of placements) {
      const sprite = scope.use(new egret.Sprite());
      sprite.graphics.beginFill(0x336699, 1).drawRect(1, 2, 10, 6).endFill();
      sprite.x = x;
      sprite.y = y;
      sprite.scaleX = scaleX;
      sprite.scaleY = scaleY;
      engine.stage.addChild(sprite);
    }
    return engine.captureSharedFrame(size);
  } finally {
    scope.dispose();
    await engine.dispose();
  }
}
const corners = prepared =>
  prepared.entries.map(entry => entry.polygons.map(polygon => polygon.map(point => [point.x, point.y])));
const reason = run => {
  try {
    run();
    return 'ok';
  } catch (cause) {
    return cause.reason;
  }
};

test('SAQ01 mirrored and scaled quads keep the corners, the order and the charges of the general path', async () => {
  const frame = await frameOf(
    [
      [1, 1, 40, 30],
      [-1, 1, 40, 30],
      [1, -2, 40, 30],
      [-0.5, -3, 40, 30]
    ],
    { width: 100, height: 80 }
  );
  const prepared = prepareSharedDraws2D(frame, 100, 80, LIMITS);
  assert.deepEqual(prepared.budget.snapshot(), {
    sourceTrianglesCharged: 0,
    preparedVerticesCharged: 24,
    predicatesCharged: 156,
    tupleComparisonsCharged: 200
  });
  // Clockwise in backing space whichever way the quad was mirrored: a mirrored one starts from its other side.
  assert.deepEqual(corners(prepared), [
    [
      [
        [41, 32],
        [51, 32],
        [51, 38],
        [41, 38]
      ]
    ],
    [
      [
        [39, 38],
        [29, 38],
        [29, 32],
        [39, 32]
      ]
    ],
    [
      [
        [41, 14],
        [51, 14],
        [51, 26],
        [41, 26]
      ]
    ],
    [
      [
        [39.5, 24],
        [34.5, 24],
        [34.5, 6],
        [39.5, 6]
      ]
    ]
  ]);
  // The charges are made at the same totals: one predicate or one comparison fewer refuses the frame.
  assert.deepEqual(
    [155, 156].map(n => reason(() => prepareSharedDraws2D(frame, 100, 80, { ...LIMITS, maxClipEdgeTests: n }))),
    ['budget', 'ok']
  );
  assert.deepEqual(
    [199, 200].map(n => reason(() => prepareSharedDraws2D(frame, 100, 80, { ...LIMITS, maxTupleComparisons: n }))),
    ['budget', 'ok']
  );
});

test('SAQ02 a quad that collapses once placed is left to the general path, and clipping follows as before', async () => {
  const frame = await frameOf(
    [
      [1e-29, 1, 40, 30],
      [1, 1, -5, 75],
      [2, 1, 95, -3]
    ],
    { width: 100, height: 80 }
  );
  const prepared = prepareSharedDraws2D(frame, 100, 80, LIMITS);
  assert.deepEqual(prepared.budget.snapshot(), {
    sourceTrianglesCharged: 0,
    preparedVerticesCharged: 12,
    predicatesCharged: 97,
    tupleComparisonsCharged: 120
  });
  assert.deepEqual(corners(prepared), [
    [],
    [
      [
        [0, 77],
        [6, 77],
        [6, 80],
        [0, 80]
      ]
    ],
    [
      [
        [100, 5],
        [97, 5],
        [97, 0],
        [100, 0]
      ]
    ]
  ]);
  const scaled = prepareSharedDraws2D(frame, 100, 80, { ...LIMITS, pixelRatio: 1.5 });
  assert.deepEqual(scaled.budget.snapshot(), {
    sourceTrianglesCharged: 0,
    preparedVerticesCharged: 0,
    predicatesCharged: 53,
    tupleComparisonsCharged: 55
  });
  assert.deepEqual(corners(scaled), [[], [], []]);
});

function comparePlacedQuads(frame, limits, expected) {
  const observed = [false, true].map(owned => {
    const prepared = owned
      ? prepareSharedDrawsForSubmission2D(frame, 100, 80, limits)
      : prepareSharedDraws2D(frame, 100, 80, limits);
    if (owned)
      assert.deepEqual(prepared.entries.filter(draw => draw.kind === 'draw').map(isPreparedContainedQuad), expected);
    return {
      packed: packSharedDraws2D(prepared).map(draw =>
        'barrier' in draw ? ['barrier', draw.ordinal] : [draw.data, draw.uniform, draw.pages, draw.vertexCount]
      ),

      geometry: prepared.entries.map(draw => {
        if (draw.kind === 'barrier') return ['barrier', draw.ordinal];
        const polygons = draw.polygons;
        assert.strictEqual(draw.polygons, polygons);

        return polygons;
      }),
      budget: prepared.budget.snapshot()
    };
  });
  assert.deepEqual(observed[1], observed[0]);
  const regular = prepareSharedDraws2D(frame, 100, 80, limits, undefined, true);
  for (const draw of regular.entries)
    if (draw.kind === 'draw') {
      assert.equal(isPreparedContainedQuad(draw), false);
      assert.equal(Object.getPrototypeOf(draw), Object.prototype);
      assert.equal(Object.hasOwn(draw, 'polygons'), true);
      assert.strictEqual(draw.polygons, draw.polygons);
      assert.ok(JSON.stringify(draw).includes('"polygons":'));
    }
}

test('SAQ03 contained mirrored fans preserve every attribute, represented bytes, drawing order and budget', async () => {
  const frame = await frameOf(
    [
      [1, 1, 30, 20],
      [-2, 1, 40, 20],
      [1, -1.5, 50, 20],
      [-0.5, -1.5, 60, 20],
      [1, 1, -6, 78],
      [1e-7, 1, 60, 20]
    ],
    { width: 100, height: 80 }
  );
  comparePlacedQuads(frame, LIMITS, [true, true, true, true, false, false]);
  comparePlacedQuads(frame, { ...LIMITS, pixelRatio: 1.25 }, [true, true, true, true, false, false]);
});

test('SAQ04 limited geometry or packing budgets keep the first refusal and partial debit', async () => {
  const frame = await frameOf([[1, 1, 30, 20]], { width: 100, height: 80 });
  const outcome = (limits, owned) => {
    let prepared;
    const result = reason(() => {
      prepared = owned
        ? prepareSharedDrawsForSubmission2D(frame, 100, 80, limits)
        : prepareSharedDraws2D(frame, 100, 80, limits);
      packSharedDraws2D(prepared);
    });
    return [result, prepared?.budget.snapshot()];
  };
  for (const [field, values] of Object.entries({
    maxClipEdgeTests: [1, 6, 7, 37, 38, 39, 40, 41],
    maxTupleComparisons: [9, 10, 49, 50],
    maxPreparedVertices: [5, 6]
  }))
    for (const value of values) {
      const limits = { ...LIMITS, [field]: value };
      assert.deepEqual(outcome(limits, true), outcome(limits, false), field + ' ' + value);
    }
});

test('SAQ05 full page domains, region UVs and inherited alpha agree while page crops keep their mapping', async () => {
  const engine = await egret.createEngine({ host }),
    scope = engine.createScope();
  const texture = egret.createTexture(
    egret.createImageData2D({ width: 8, height: 8, pixels: new Uint8Array(256).fill(135) })
  );
  const type = egret.createAssetType('contained-atlas', egret.isTexture);
  engine.assets.register(type, {
    async load() {
      return texture;
    },
    dispose(value) {
      value.dispose();
    }
  });
  try {
    const lease = scope.use(await engine.assets.acquire(egret.createAssetRef(type, 'page'), { signal: scope.signal }));
    const root = scope.use(new egret.DisplayObjectContainer()),
      panel = scope.use(new egret.DisplayObjectContainer());
    root.clipRect = { x: 0, y: 0, width: 95, height: 76 };
    panel.clipRect = { x: 3, y: 3, width: 85, height: 64 };
    root.alpha = 0.61;
    root.addChild(panel);
    engine.stage.addChild(root);
    for (const [x, page, crop] of [
      [10, true, false],
      [22, true, true],
      [34, false, true],
      [85, false, false]
    ]) {
      const bitmap = scope.use(new egret.Bitmap(lease));
      bitmap.x = x;
      bitmap.y = 13.25;
      bitmap.alpha = 0.7;
      bitmap.sharedMaterial = egret.createSharedMaterial2D({ samplingDomain: page ? 'page' : 'region' });
      if (crop) bitmap.sourceRect = { x: 1, y: 1, width: 4, height: 3 };
      panel.addChild(bitmap);
    }
    comparePlacedQuads(engine.captureSharedFrame({ width: 100, height: 80 }), LIMITS, [true, false, true, false]);
  } finally {
    scope.dispose();
    await engine.dispose();
  }
  assert.equal(texture.isDisposed, true);
});

test('SAQ06 compact credentials stay private and inspecting vertices restores ordinary packing', async () => {
  const frame = await frameOf([[1, 1, 30, 20]], { width: 100, height: 80 });
  const prepared = prepareSharedDrawsForSubmission2D(frame, 100, 80, LIMITS);
  const draw = prepared.entries[0];
  assert.equal(isPreparedContainedQuad(draw), true);
  for (const lookalike of [{ ...draw }, Object.create(Object.getPrototypeOf(draw)), new Proxy(draw, {})])
    assert.equal(isPreparedContainedQuad(lookalike), false);
  assert.equal(
    reason(() => new draw.constructor(Symbol(), draw.command, draw.material, draw.region, draw.pageIndex, {})),
    'frame'
  );
  const vertices = draw.polygons;
  assert.strictEqual(draw.polygons, vertices);
  assert.equal(isPreparedContainedQuad(draw), false);
  vertices[0][0].r = 0.125;
  assert.equal(packSharedDraws2D(prepared)[0].data[4], 0.125);
  const ordinary = prepareSharedDraws2D(frame, 100, 80, LIMITS, undefined, true);
  Object.defineProperty(ordinary.entries[0], 'polygons', { value: [] });
  assert.equal(packSharedDraws2D(ordinary)[0].vertexCount, 0);
});
