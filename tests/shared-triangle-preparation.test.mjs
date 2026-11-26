// SPDX-License-Identifier: Apache-2.0
// Private geometry UNIT: admitted non-degenerate mesh triangles retain exact
// attributed corners, packing, budgets and failure ordering on the fast path.
// The synchronous controls change only built private geometry helpers, restore
// their exact descriptors, and establish operation counts (not GPU timing).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { prepareSharedDraws2D } from '../packages/engine/dist/rendering/prepareSharedDraws2D.js';
import { packSharedDraws2D } from '../packages/engine/dist/rendering/packSharedDraws2D.js';
import { Preparation } from '../packages/engine/dist/rendering/prepareRectangles2D.js';
import { TexturedPreparationBudget2D } from '../packages/engine/dist/rendering/texturedPreparationBudget2D.js';

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
const SIZE = { width: 100, height: 80 };
const host = {
  surface: {},
  start() {},
  stop() {},
  async close() {},
  setTimeout() {
    return () => {};
  }
};
const POSITIONS = [0, 0, 10, 0, 0, 8, 10, 8];
const UVS = [0, 0, 1, 0, 0, 1, 1, 1];
const LIGHT = [1, 0.25, 0.5, 0.75, 0.5, 1, 0.25, 0.5, 0.25, 0.5, 1, 0.25, 0.75, 0.25, 0.5, 1];
const DARK = [0.25, 0, 0.5, 0, 0.25, 0.5, 0.5, 0.25, 0, 0, 0.5, 0.25];
const INDICES = [0, 1, 2, 1, 3, 2];

async function withFrame(specs, body) {
  const engine = await egret.createEngine({ host }),
    scope = engine.createScope(),
    type = egret.createAssetType('shared-triangle-preparation', egret.isTexture),
    texture = egret.createTexture(
      egret.createImageData2D({ width: 8, height: 8, pixels: new Uint8Array(256).fill(255) })
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
    const lease = scope.use(await engine.assets.acquire(egret.createAssetRef(type, 'page'), { signal: scope.signal }));
    for (const spec of specs) {
      const positions = spec.positions ?? POSITIONS,
        count = positions.length / 2,
        mesh = scope.use(
          new egret.Mesh2D(
            lease,
            egret.createSharedGeometry2D({
              positions: new Float32Array(positions),
              uvs: new Float32Array(spec.uvs ?? UVS.slice(0, count * 2)),
              lightColors: new Float32Array(LIGHT.slice(0, count * 4)),
              darkColors: new Float32Array(DARK.slice(0, count * 3)),
              indices: new Uint16Array(spec.indices ?? INDICES)
            })
          )
        );
      mesh.sharedMaterial = egret.createSharedMaterial2D({ samplingDomain: 'page' });
      Object.assign(mesh, spec.transform);
      engine.stage.addChild(mesh);
    }
    return body(engine.captureSharedFrame(SIZE));
  } finally {
    scope.dispose();
    await engine.dispose();
    if (!texture.isDisposed) texture.dispose();
  }
}
const prep = (frame, limits = LIMITS) => prepareSharedDraws2D(frame, SIZE.width, SIZE.height, limits);
const reason = run => {
  try {
    run();
    return 'ok';
  } catch (cause) {
    return cause.reason;
  }
};
const point = (index, x, y, mirror = false) => ({
  x: x + (mirror ? -1 : 1) * POSITIONS[index * 2],
  y: y + POSITIONS[index * 2 + 1],
  u: UVS[index * 2],
  v: UVS[index * 2 + 1],
  r: LIGHT[index * 4],
  g: LIGHT[index * 4 + 1],
  b: LIGHT[index * 4 + 2],
  a: LIGHT[index * 4 + 3],
  dr: DARK[index * 3],
  dg: DARK[index * 3 + 1],
  db: DARK[index * 3 + 2]
});

function counted(run) {
  const descriptor = Object.getOwnPropertyDescriptor(Preparation.prototype, 'sign');
  let calls = 0;
  Object.defineProperty(Preparation.prototype, 'sign', {
    ...descriptor,
    value(...args) {
      calls++;
      return Reflect.apply(descriptor.value, this, args);
    }
  });
  try {
    return { result: run(), calls };
  } finally {
    Object.defineProperty(Preparation.prototype, 'sign', descriptor);
  }
}

test('SAT01 four admitted contained triangles preserve every attributed corner and charge, using only three actual signs each', async () => {
  await withFrame([{ transform: { x: 24, y: 18 } }, { transform: { x: 60, y: 18, scaleX: -1 } }], frame => {
    const { result: prepared, calls } = counted(() => prep(frame));
    assert.deepEqual(
      prepared.entries.map(entry => entry.polygons),
      [
        [
          [0, 1, 2],
          [1, 3, 2]
        ].map(triangle => triangle.map(index => point(index, 24, 18))),
        [
          [2, 1, 0],
          [2, 3, 1]
        ].map(triangle => triangle.map(index => point(index, 60, 18, true)))
      ]
    );
    assert.deepEqual(prepared.budget.snapshot(), {
      sourceTrianglesCharged: 4,
      preparedVerticesCharged: 12,
      predicatesCharged: 120,
      tupleComparisonsCharged: 120
    });
    // Both the global and the per-command cap must still charge the
    // logically equivalent operations, including the contained viewport.
    for (const key of ['maxClipEdgeTests', 'maxTupleComparisons']) {
      assert.deepEqual(
        [119, 120].map(n => reason(() => prep(frame, { ...LIMITS, [key]: n }))),
        ['budget', 'ok']
      );
      assert.equal(
        reason(() => prep(frame, { ...LIMITS, [key]: 5 })),
        'budget'
      );
    }
    assert.equal(calls, 12);
  });
});

function fallback(run) {
  const descriptor = Object.getOwnPropertyDescriptor(TexturedPreparationBudget2D.prototype, 'tryReplayStageCost');
  let refused = 0;
  Object.defineProperty(TexturedPreparationBudget2D.prototype, 'tryReplayStageCost', {
    ...descriptor,
    value(cost) {
      if (cost.preparedVertices === 0 && cost.predicates === 3 && cost.tupleComparisons === 6) {
        refused++;
        return false;
      }
      return Reflect.apply(descriptor.value, this, [cost]);
    }
  });
  try {
    return { result: run(), refused };
  } finally {
    Object.defineProperty(TexturedPreparationBudget2D.prototype, 'tryReplayStageCost', descriptor);
  }
}
const outcome = (frame, limits) => {
  try {
    const prepared = prep(frame, limits),
      packed = packSharedDraws2D(prepared);
    return {
      entries: prepared.entries.map(entry => [entry.kind, entry.polygons, entry.vertexReservation]),
      budget: prepared.budget.snapshot(),
      geometryBytes: prepared.geometryBytes,
      upload: prepared.upload,
      packed: packed.map(entry =>
        'barrier' in entry ? entry : [entry.vertexCount, [...entry.data], [...entry.uniform]]
      )
    };
  } catch (cause) {
    return { refusal: [cause.name, cause.reason, cause.message] };
  }
};

test('SAT02 clipped, mirrored, rotated and collapsed geometry has the same full output and first refusals on the general path', async () => {
  await withFrame(
    [
      { transform: { x: -3, y: 10 } },
      { transform: { x: 98, y: 78, scaleX: -1, rotation: 12 } },
      { transform: { x: 30, y: 20, scaleX: 1e-29 } },
      { positions: [0, 0, 10, 0, 20, 0], indices: [0, 1, 2], transform: { x: 30, y: 20 } }
    ],
    frame => {
      const normal = outcome(frame, LIMITS);
      assert.ok(!normal.refusal && normal.budget.preparedVerticesCharged > 0);
      let refused = 0;
      for (const limits of [
        LIMITS,
        { ...LIMITS, pixelRatio: 1.5 },
        { ...LIMITS, maxClipEdgeTests: 5 },
        { ...LIMITS, maxTupleComparisons: 5 },
        { ...LIMITS, maxClipEdgeTests: normal.budget.predicatesCharged - 1 },
        { ...LIMITS, maxTupleComparisons: normal.budget.tupleComparisonsCharged - 1 },
        { ...LIMITS, maxPreparedVertices: normal.budget.preparedVerticesCharged - 1 }
      ]) {
        const exact = fallback(() => outcome(frame, limits));
        assert.deepEqual(outcome(frame, limits), exact.result);
        refused += exact.refused;
      }
      assert.ok(refused > 0, 'the explicit test control exercised the actual general triangle normalization fallback');
    }
  );
  // A degenerate authored triangle still qualifies UVs before considering its
  // positions, not after the fast path or the winding check.
  await withFrame(
    [
      {
        positions: [0, 0, 10, 0, 20, 0],
        uvs: [0, 0, 131073, 0, 0, 1],
        indices: [0, 1, 2]
      }
    ],
    frame =>
      assert.equal(
        reason(() => prep(frame)),
        'precision'
      )
  );
});
