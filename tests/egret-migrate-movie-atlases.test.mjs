// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { convertProject } from '../tools/egret-migrate/convert.mjs';
import { rebuildProject } from '../tools/egret-migrate/rebuild.mjs';

test('a large movie atlas preserves all RGBA bytes, cross-page regions, source keys and rebuild settings', async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-movie-atlas-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const owner = path.join(temp, 'source'),
    out = path.join(temp, 'converted');
  const put = (key, value) => {
    const file = path.join(owner, key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value));
  };
  put(
    'index.html',
    '<div class="egret-player" data-entry-class="Main" data-content-width="320" data-content-height="200"></div>'
  );
  put('egretProperties.json', { engineVersion: '5.2.29', compilerVersion: '5.2.29', modules: [{ name: 'egret' }] });
  put('manifest.json', { game: ['bin-debug/Main.js'] });
  put('src/Main.ts', 'class Main extends egret.Sprite {}');
  put('engine.mjs', 'export {};');
  const data = {
    mc: {
      walk: {
        frameRate: 12,
        labels: [{ name: 'step', frame: 1, end: 2 }],
        frames: [{ res: 'cross', x: -4, y: 7, duration: 2 }]
      }
    },
    res: { cross: { x: 2044, y: 2044, w: 4, h: 4 } }
  };
  const width = 2048,
    height = 2049,
    pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      pixels[i] = x % 255;
      pixels[i + 1] = y % 255;
      pixels[i + 2] = 93;
      pixels[i + 3] = (x ^ y) & 1 ? 128 : 0;
    }
  const original = PNG.sync.write({ width, height, data: pixels });
  put('resource/default.res.json', {
    resources: [
      { name: 'anim', type: 'json', url: 'move.json' },
      { name: 'atlas', type: 'image', url: 'move.png' }
    ],
    groups: [{ name: 'actor', keys: 'anim,atlas' }]
  });
  put('resource/move.json', data);
  put('resource/move.png', original);
  const mapping = [{ data: 'anim', texture: 'atlas' }],
    esbuild = { transform: async code => ({ code }) };
  const report = await convertProject({
    source: owner,
    out,
    engine: path.join(owner, 'engine.mjs'),
    engineVersion: '7.0.2',
    esbuild,
    movieAtlases: mapping
  });
  assert.deepEqual(fs.readFileSync(path.join(out, 'resource/move.png')), original);
  assert.equal(report.browserFiles.includes('resource/move.png'), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'web/resource/move.json'))), data);
  const snapshot = JSON.parse(fs.readFileSync(path.join(out, 'web/project.json')));
  const [plan] = snapshot.entities[0].data.moviePages;
  const reconstructed = Buffer.alloc(pixels.length);
  for (const tile of plan.tiles) {
    const page = PNG.sync.read(fs.readFileSync(path.join(out, 'web', tile.url)));
    assert.ok(page.width * page.height <= 4194304);
    for (let y = 0; y < tile.height; y++) {
      const start = ((y + tile.top) * page.width + tile.left) * 4;
      page.data.copy(reconstructed, ((y + tile.y) * width + tile.x) * 4, start, start + tile.width * 4);
    }
  }
  assert.equal(plan.tiles.length, 4);
  assert.deepEqual(reconstructed, pixels);
  const rebuilt = await rebuildProject({ source: out, out: path.join(temp, 'rebuilt'), esbuild });
  assert.deepEqual(rebuilt.resourceTransforms, report.resourceTransforms);
});
