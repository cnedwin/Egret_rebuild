// SPDX-License-Identifier: Apache-2.0
// tools/vendor-game.mjs: the import closure of named entries copied into a
// game folder, with an import map, a Node loader and a record of its source.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planVendor, vendorGame } from '../tools/vendor-game.mjs';

const temporary = () => fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'egret-vendor-'));

test('VG01 the plan follows imports from the named entries and maps every bare name it meets', () => {
  const plan = planVendor(['@egret/engine/kit']);
  assert.equal(plan.map['@egret/engine/kit'], 'engine/dist/kit.js');
  assert.equal(plan.map['@egret/runtime'], 'runtime/dist/index.js');
  assert.ok([...plan.files.values()].every(file => /^(contracts|runtime|engine)\/dist\//.test(file)));
  assert.ok(![...plan.files.values()].some(file => file.includes('/web/')), 'nothing of the browser half');
  assert.throws(() => planVendor(['@egret/engine/nothing']), /not a public entry/);
  assert.throws(() => planVendor([]), /at least one entry/);
});

test('VG02 a game folder gets the files, an import map, a Node loader and SOURCE.md; a rerun takes away what is not needed', () => {
  const game = temporary();
  try {
    const first = vendorGame(game, ['@egret/engine', '@egret/engine/kit', '@egret/engine/web/kit']);
    const vendor = path.join(game, 'vendor');
    const map = JSON.parse(fs.readFileSync(path.join(vendor, 'importmap.json'), 'utf8'));
    assert.equal(map.imports['@egret/engine/web/kit'], './vendor/engine/dist/web/kit.js');
    for (const file of Object.values(map.imports)) assert.ok(fs.existsSync(path.join(game, file)), file);
    assert.ok(fs.existsSync(path.join(vendor, 'LICENSE')));
    assert.match(
      fs.readFileSync(path.join(vendor, 'SOURCE.md'), 'utf8'),
      /Entries: `@egret\/engine`, `@egret\/engine\/kit`/
    );
    assert.ok(!fs.readFileSync(path.join(vendor, 'engine/dist/kit.js'), 'utf8').includes('sourceMappingURL'));
    fs.writeFileSync(
      path.join(game, 'rules.mjs'),
      "import { createRandom } from '@egret/engine/kit';\nconsole.log(createRandom('seed').int(1, 1000));\n"
    );
    const run = spawnSync(process.execPath, ['--import', './vendor/node-register.mjs', 'rules.mjs'], {
      cwd: game,
      encoding: 'utf8'
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout.trim(), /^\d+$/);
    const second = vendorGame(game, ['@egret/engine/kit']);
    assert.ok(second.files < first.files);
    assert.equal(fs.existsSync(path.join(vendor, 'engine/dist/web/kit.js')), false, 'the browser half is taken away');
  } finally {
    fs.rmSync(game, { recursive: true, force: true });
  }
});
