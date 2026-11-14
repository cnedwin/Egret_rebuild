// SPDX-License-Identifier: Apache-2.0
// Address qualification of texture coordinates: a corner whose coordinate, scaled by the width or height of its sampling
// domain, passes 8,192 for a repeating page or 1,048,576 otherwise refuses the frame. The outcomes were recorded before
// the domain of a draw was found once for all its corners.
// The private imports are built engine/dist/rendering helpers, as AGENTS permits for geometry units.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { prepareSharedDraws2D } from '../packages/engine/dist/rendering/prepareSharedDraws2D.js';
import { packSharedDraws2D } from '../packages/engine/dist/rendering/packSharedDraws2D.js';

const LIMITS = { maxCommands: 65536, maxClipRectangles: 262144, maxPreparedVertices: 1048576, maxClipEdgeTests: 4194304, maxSourceTriangles: 65536, maxFrameGeometryBytes: 16777216, maxTupleComparisons: 1048576, pixelRatio: 1 };
const host = { surface: {}, start() {}, stop() {}, async close() {}, setTimeout() { return () => {}; } };

test('SUQ01 a texture coordinate beyond its domain\'s limit refuses the frame, one within it is drawn', async () => {
  const engine = await egret.createEngine({ host }), scope = engine.createScope();
  const type = egret.createAssetType('shared-uv-qualification', egret.isTexture);
  const texture = egret.createTexture(egret.createImageData2D({ width: 8, height: 8, pixels: new Uint8Array(256).fill(255) }));
  engine.assets.register(type, { async load() { return texture; }, dispose(value) { value.dispose(); } });
  try {
    const lease = scope.use(await engine.assets.acquire(egret.createAssetRef(type, 'page'), { signal: scope.signal }));
    const outcome = (u, material) => {
      const mesh = scope.use(new egret.Mesh2D(lease, egret.createSharedGeometry2D({ positions: new Float64Array([0, 0, 8, 0, 0, 8]), uvs: new Float64Array([0, 0, u, 0, 0, 1]),
        lightColors: new Float64Array(12).fill(1), darkColors: new Float64Array(9), indices: new Uint16Array([0, 1, 2]) })));
      mesh.sharedMaterial = egret.createSharedMaterial2D(material);
      engine.stage.addChild(mesh);
      try {
        const prepared = prepareSharedDraws2D(engine.captureSharedFrame({ width: 16, height: 16 }), 16, 16, LIMITS);
        const packed = packSharedDraws2D(prepared);
        return 'drawn ' + packed[0].vertexCount;
      } catch (cause) { return cause.reason; } finally { engine.stage.removeChild(mesh); }
    };
    const repeating = { samplingDomain: 'page', addressU: 'repeat' }, page = { samplingDomain: 'page' }, region = {};
    // An 8-pixel page: 1,023 × 8 is within 8,192 and 1,025 × 8 is not; 131,072 × 8 is 1,048,576 exactly.
    assert.deepEqual([[1023, repeating], [1025, repeating], [1025, page], [131073, page], [1025, region], [131072, region], [131073, region]].map(([u, material]) => outcome(u, material)),
      ['drawn 3', 'precision', 'drawn 3', 'precision', 'drawn 3', 'drawn 3', 'precision']);
  } finally { scope.dispose(); await engine.dispose(); if (!texture.isDisposed) texture.dispose(); }
});
