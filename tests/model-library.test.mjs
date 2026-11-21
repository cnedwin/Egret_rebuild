// SPDX-License-Identifier: Apache-2.0
// The model library in examples/models: every model is listed, says what it is, is made within its triangle budget,
// stands on the ground, is the size its kind should be, and the gallery page reaches the same modules as the 3D engine.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createExampleServer } from '../tools/serve-example.mjs';
import * as W from '@egret/engine/world3d';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = path.join(ROOT, 'examples', 'models');
const { models } = await import(pathToFileURL(path.join(DIR, 'index.mjs')).href);
let bakedAsset;
const bakedGeometry = new Map();
before(async () => {
  bakedAsset = await W.loadGltf3D(fs.readFileSync(path.join(DIR, 'static-models.glb')));
  bakedAsset.scene.traverse(node => {
    if (!(node instanceof W.Mesh3D)) return;
    assert.ok(models.includes(node.name), 'unknown baked mesh: ' + node.name);
    assert.ok(!bakedGeometry.has(node.name), 'duplicate baked mesh: ' + node.name);
    bakedGeometry.set(node.name, node.geometry);
  });
});
after(() => bakedAsset?.dispose());

/** How many groups of triangles share no vertex position with the rest. */
function pieces(geometry) {
  const p = geometry.getAttribute('position').data,
    key = new Map(),
    up = [];
  const id = v => {
    const k = p[v * 3].toFixed(5) + ',' + p[v * 3 + 1].toFixed(5) + ',' + p[v * 3 + 2].toFixed(5);
    if (!key.has(k)) {
      key.set(k, up.length);
      up.push(up.length);
    }
    return key.get(k);
  };
  const find = a => {
    while (up[a] !== a) a = up[a] = up[up[a]];
    return a;
  };
  const ids = Array.from(geometry.index.data, id);
  for (let f = 0; f < ids.length; f += 3) {
    const a = find(ids[f]);
    up[find(ids[f + 1])] = a;
    up[find(ids[f + 2])] = a;
  }
  return new Set(ids.map(find)).size;
}
const KINDS = { animal: [0.05, 1.5], person: [0.8, 2.2], building: [1.5, 8], plant: [0.2, 5], prop: [0.2, 2.5] };

// Break caught: a model file the index forgets, or an index entry with no file.
test('ML01 the index lists every model file, once', () => {
  const files = fs
    .readdirSync(DIR)
    .filter(name => name.endsWith('.mjs') && name !== 'index.mjs' && name !== 'gallery.mjs')
    .map(name => name.slice(0, -4))
    .sort();
  assert.deepEqual([...models].sort(), files);
  assert.equal(new Set(models).size, models.length);
  assert.ok(models.length >= 20, models.length + ' models');
});

// Break caught: a model that no longer builds, outgrows its budget, floats, sinks, or comes out the wrong size; or a
// file without the comment that tells a reader how it is made.
for (const name of models)
  test('ML02 ' + name + ' is made within its budget, on the ground, at the size of its kind', async () => {
    const file = path.join(DIR, name + '.mjs');
    const text = fs.readFileSync(file, 'utf8');
    assert.match(text, /^\/\/ SPDX-License-Identifier: Apache-2.0\n\/\/ .*Parts: /s, 'a comment that names the parts');
    const module = await import(pathToFileURL(file).href);
    assert.ok(module.about && typeof module.about.name === 'string' && typeof module.about.zh === 'string');
    assert.ok(module.about.kind in KINDS, module.about.kind);
    const shape = module.default(W);
    assert.ok(shape instanceof W.SdfShape3D);
    const geometry = W.createSdfGeometry3D(shape, module.meshOptions ?? {});
    const budget = module.meshOptions?.triangles ?? 8000;
    const triangles = geometry.index.count / 3;
    assert.ok(triangles > budget * 0.5 && triangles <= budget, triangles + ' of ' + budget);
    const box = geometry.boundingBox;
    assert.ok(Math.abs(box[1]) <= 0.02, 'stands on y = 0: ' + box[1]);
    const height = box[4] - box[1],
      size = Math.max(height, box[3] - box[0], box[5] - box[2]);
    const [low, high] = KINDS[module.about.kind];
    assert.ok(size >= low && size <= high, module.about.kind + ' ' + size);
    // A model faces +z: it is centred on x, as every model of the library is drawn about its middle.
    assert.ok(Math.abs((box[0] + box[3]) / 2) < size * 0.25, 'centred on x');
    // A surface it names is one the shader draws.
    if (module.surface !== undefined) assert.ok(W.createSurfaceMaterial3D(module.surface).shader, 'surface');
    // One piece: a part that floats loose, or is too thin to join, comes out as a second piece of the mesh.
    assert.equal(pieces(geometry), 1, 'one piece');
    if (typeof module.rig === 'function') {
      assert.ok(!bakedGeometry.has(name), 'an animated model must use its live rig');
    } else {
      // Compare the shipped mesh to the geometry already built for the budget and topology checks.
      const baked = bakedGeometry.get(name);
      assert.ok(baked, 'missing baked mesh: ' + name);
      assert.deepEqual([...baked.attributes.keys()].sort(), [...geometry.attributes.keys()].sort());
      for (const [attrName, expected] of geometry.attributes) {
        const actual = baked.getAttribute(attrName);
        assert.equal(actual.itemSize, expected.itemSize, attrName);
        assert.deepEqual(actual.data, expected.data, attrName);
      }
      assert.deepEqual(Array.from(baked.index.data), Array.from(geometry.index.data));
      assert.deepEqual(baked.boundingBox, geometry.boundingBox);
    }
    geometry.dispose();
    // A model with a rig makes it, with at least one clip that names only its bones.
    if (typeof module.rig === 'function') {
      const rig = module.rig(W);
      assert.ok(rig.mesh.skeleton && Object.keys(rig.bones).length >= 2);
      const clips = Object.values(rig.clips);
      assert.ok(clips.length >= 1 && clips.every(clip => clip instanceof W.AnimationClip3D));
      for (const clip of clips)
        for (const track of clip.tracks) assert.ok(track.targetName in rig.bones, track.targetName);
      rig.play(clips[0], 0);
      rig.update(0.3);
    }
  });

// Break caught: the gallery's import map falling behind the one the 3D engine needs, so the page fails to load.
test('ML03 the gallery page uses the World3D import map and every model kind is shown', () => {
  const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
  const map = file => JSON.parse(/<script type="importmap">\s*(\{[\s\S]*?\})\s*<\/script>/.exec(read(file))[1]);
  assert.deepEqual(map('examples/models/index.html'), map('examples/world3d/index.html'));
  const gallery = read('examples/models/gallery.mjs');
  for (const kind of Object.keys(KINDS)) assert.ok(gallery.includes("'" + kind + "'"), kind);
});

test('the documented server serves the gallery and all registered models', async () => {
  const server = createExampleServer(ROOT);
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + server.address().port + '/examples/models/';
    for (const file of ['index.html', 'gallery.mjs', 'index.mjs', ...models.map(name => name + '.mjs')]) {
      assert.equal((await fetch(url + file, { method: 'HEAD' })).status, 200, file);
    }
    const packed = await fetch(url + 'static-models.glb');
    assert.equal(packed.status, 200);
    assert.deepEqual(Buffer.from(await packed.arrayBuffer()), fs.readFileSync(path.join(DIR, 'static-models.glb')));
    assert.equal((await fetch(url + 'README.md')).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
