// SPDX-License-Identifier: Apache-2.0
// Hard surfaces kept sharp, models in levels of detail, models baked ahead of time, and the notes of the model preview.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as W from '@egret/engine/world3d';
import { bakeModels, modelFiles } from '../tools/bake-models.mjs';
import { previewPage } from '../tools/model-preview.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Break caught: corners rounded to the grid, or edges shaded soft, on a model asked to be sharp.
test('SH01 sharp keeps the corners and the flat faces of a box', () => {
  const box = W.sdfBox([1, 1, 1], { color: 0x808080 });
  const measure = sharp => {
    const g = W.createSdfGeometry3D(box, { resolution: 24, occlusion: 0, triangles: 0, sharp });
    const p = g.getAttribute('position').data,
      n = g.getAttribute('normal').data;
    let corner = Infinity,
      flat = 0;
    for (let v = 0; v < g.vertexCount; v++) {
      corner = Math.min(corner, Math.hypot(p[v * 3] - 0.5, p[v * 3 + 1] - 0.5, p[v * 3 + 2] - 0.5));
      if (Math.max(Math.abs(n[v * 3]), Math.abs(n[v * 3 + 1]), Math.abs(n[v * 3 + 2])) > 0.999) flat++;
    }
    return { corner, flat: flat / g.vertexCount };
  };
  const soft = measure(false),
    hard = measure(true);
  assert.ok(hard.corner < 0.003, 'a vertex on the corner, within a tenth of a cell: ' + hard.corner);
  assert.ok(hard.corner < soft.corner, 'nearer the corner than without');
  assert.ok(hard.flat > 0.95, 'normals square to the faces: ' + hard.flat);
  assert.ok(hard.flat > soft.flat);
  assert.throws(() => W.createSdfGeometry3D(box, { sharp: 200 }), { code: 'WORLD3D_INPUT_INVALID' });
  // Sharp with a budget still holds the budget.
  assert.ok(W.createSdfGeometry3D(W.sdfSphere(0.5), { sharp: true, triangles: 1500 }).index.count / 3 <= 1500);
});

// Break caught: levels that do not get simpler, switch at the wrong distance, or accept levels that cannot work.
test('SH02 createSdfLod3D makes levels of detail that switch with distance', () => {
  const lod = W.createSdfLod3D(W.sdfSphere(1, { color: 0x33aa33 }), { triangles: 2000, occlusion: 0 });
  const counts = lod.levels.map(level => level.object.geometry.index.count / 3);
  assert.equal(counts.length, 3);
  assert.ok(counts[0] <= 2000 && counts[1] <= 500 && counts[2] <= 125, counts.join());
  assert.deepEqual(
    lod.levels.map(level => level.distance),
    [0, 24, 60]
  );
  assert.equal(lod.levels[0].object.material, lod.levels[2].object.material);
  lod.updateWorldMatrices(true);
  lod.select(0, 0, 30);
  assert.equal(lod.currentLevel, 1);
  lod.select(0, 0, 5);
  assert.equal(lod.currentLevel, 0);
  const own = W.createSdfLod3D(W.sdfSphere(1), {
    levels: [
      [1000, 0],
      [100, 10]
    ]
  });
  assert.equal(own.levels.length, 2);
  const bad = { code: 'WORLD3D_INPUT_INVALID' };
  assert.throws(() => W.createSdfLod3D(W.sdfSphere(1), { levels: [[100, 5]] }), bad);
  assert.throws(
    () =>
      W.createSdfLod3D(W.sdfSphere(1), {
        levels: [
          [100, 0],
          [200, 10]
        ]
      }),
    bad
  );
  assert.throws(() => W.createSdfLod3D({}), bad);
});

// Break caught: a baked model that loads as something other than what was made, or a folder baked partly.
test('SH03 bake-models writes each model as a .glb that loads as it was made', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-bake-'));
  try {
    const files = modelFiles([
      path.join(ROOT, 'examples', 'models', 'crate.mjs'),
      path.join(ROOT, 'examples', 'models', 'fox.mjs')
    ]);
    const report = await bakeModels(files, out);
    assert.deepEqual(
      report.map(entry => path.basename(entry.glb)),
      ['crate.glb', 'fox.glb']
    );
    const fox = await import('../examples/models/fox.mjs');
    const made = W.createSdfGeometry3D(fox.default(W), fox.meshOptions);
    const asset = await W.loadGltf3D(new Uint8Array(fs.readFileSync(path.join(out, 'fox.glb'))));
    assert.equal(asset.geometries[0].index.count, made.index.count);
    assert.ok(asset.materials[0].vertexColors);
    asset.dispose();
    const folder = modelFiles([path.join(ROOT, 'examples', 'models')]);
    assert.ok(folder.length >= 20 && !folder.some(file => /index|gallery/.test(path.basename(file))));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

// Break caught: the preview no longer telling of a loose part, a model in the ground or a slow one.
test('SH04 the model preview notes loose pieces, sinking, floating and slow models', () => {
  const page = previewPage('/__model/m.mjs');
  for (const note of ['pieces', 'below y = 0', 'floats', 'bake it with tools/bake-models.mjs'])
    assert.ok(page.includes(note), note);
});
