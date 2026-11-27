// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { exportProject } from './export-project.mjs';

test('project export refuses unsupported page IDs, filename collisions and asset paths before bundling', async t => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'egret-export-test-'));
  t.after(() => rm(project, {recursive:true, force:true}));
  const run = async (id, assets, error) => {
    const manifest = {width:360, height:640, entry:'index.html', pages:[{id,src:'page.png',width:1,height:1}], assets};
    await writeFile(path.join(project, 'project.json'), JSON.stringify(manifest));
    await assert.rejects(exportProject(project, path.join(project,'out'), 'unused'), error);
  };
  await run(256, [], /Invalid or duplicate texture page/);
  await run(255, ['..\/unlisted.dat'], /portable project-relative filename/);
  await run(255, ['PAGE.png'], /Conflicting project asset/);
  await run(255, ['Game.js'], /Conflicting project asset/);
});

test('external Android games resolve the same optional Spine runtime and package its original notice', {
  skip: !process.env.EGRET_PLAYER_ESBUILD && 'Supply the external esbuild 0.28.2 module to run the bundler integration.'
}, async t => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'egret-external-spine-'));
  t.after(() => rm(project, {recursive: true, force: true}));
  const output = path.join(project, 'out');
  const notice = 'spine-core-4.3.13.LICENSE';
  await writeFile(path.join(project, 'index.html'), '<script src="game.js"></script>');
  const manifest = {width: 960, height: 540, entry: 'index.html', pages: [], assets: []};
  const saveManifest = () => writeFile(path.join(project, 'project.json'), JSON.stringify(manifest));
  await saveManifest();
  await writeFile(path.join(project, 'main.mjs'), 'globalThis.three = 3;');
  await exportProject(project, output, process.env.EGRET_PLAYER_ESBUILD);
  await assert.rejects(access(path.join(output, notice)), {code: 'ENOENT'});
  await rm(output, {recursive: true});

  await writeFile(path.join(project, 'main.mjs'), [
    "import { createSpineDisplay } from '@egret/spine';",
    "import { Skeleton } from '@esotericsoftware/spine-core';",
    'globalThis.optIn = [createSpineDisplay, Skeleton];'
  ].join('\n'));
  await exportProject(project, output, process.env.EGRET_PLAYER_ESBUILD);
  assert.deepEqual(await readFile(path.join(output, notice)),
    await readFile(new URL('../../../third-party/' + notice, import.meta.url)));
  await rm(output, {recursive: true});
  await writeFile(path.join(project, notice), 'project asset');
  manifest.assets.push(notice);
  await saveManifest();
  await assert.rejects(exportProject(project, output, process.env.EGRET_PLAYER_ESBUILD), /Conflicting.*notice/);
  await assert.rejects(access(output), {code: 'ENOENT'});
});

test('the Android exporter rejects unbounded, ambiguous or non-classic V8 script declarations', async t => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'egret-v8-script-input-'));
  t.after(() => rm(project, {recursive: true, force: true}));
  const manifest = {width: 64, height: 64, entry: 'index.html', pages: []};
  async function refuses(v8Scripts, message) {
    await writeFile(path.join(project, 'project.json'), JSON.stringify({...manifest, v8Scripts}));
    await assert.rejects(exportProject(project, path.join(project, 'out'), 'unused'), message);
  }
  await refuses(null, /Invalid v8Scripts/);
  await refuses({unknown: []}, /Invalid v8Scripts/);
  await refuses({groups: {battle: []}}, /Invalid V8 script group/);
  await refuses({startup: ['../outside.js']}, /portable project-relative filename/);
  await refuses({startup: ['main.mjs']}, /classic .js/);
  await refuses({startup: ['global.js'], groups: {battle: ['Global.js']}}, /Conflicting project asset/);
  await refuses({startup: ['game.js']}, /Conflicting project asset/);
  manifest.script = 'entry.js';
  await writeFile(path.join(project, 'entry.js'), 'globalThis.entry = true;');
  await refuses({startup: ['entry.js']}, /Bundled entry cannot also be a classic V8 script/);
  await refuses({startup: Array.from({length: 4096}, (_, i) => i + '.js')}, /exceeds 4096 scripts/);
  await assert.rejects(access(path.join(project, 'out')), {code: 'ENOENT'});
});

test('the exporter preserves classic bytes and startup order across the old 16 MiB aggregate boundary', {
  skip: !process.env.EGRET_PLAYER_ESBUILD && 'Supply esbuild 0.28.2 to export a game.'
}, async t => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'egret-v8-script-export-'));
  t.after(() => rm(project, {recursive: true, force: true}));
  const v8Scripts = {startup: ['globals.js', 'skin.js'], groups: {battle: ['battle.js']}};
  const manifest = {width: 64, height: 64, entry: 'index.html', pages: [], v8Scripts};
  await writeFile(path.join(project, 'project.json'), JSON.stringify(manifest));
  await writeFile(path.join(project, 'index.html'), '<script src="globals.js"></script><script src="skin.js"></script><script src="game.js"></script>');
  await writeFile(path.join(project, 'main.mjs'), 'globalThis.ready = true;');
  const source = '/*' + 'x'.repeat(8 << 20) + '*/\n';
  await writeFile(path.join(project, 'globals.js'), source + 'var order = [1];');
  await writeFile(path.join(project, 'skin.js'), source + 'order.push(2);');
  await writeFile(path.join(project, 'battle.js'), 'order.push(3);');
  const out = path.join(project, 'out');
  await exportProject(project, out, process.env.EGRET_PLAYER_ESBUILD);
  assert.deepEqual(JSON.parse(await readFile(path.join(out, 'project.json'), 'utf8')).v8Scripts, v8Scripts);
  for (const name of [...v8Scripts.startup, ...v8Scripts.groups.battle]) {
    assert.deepEqual(await readFile(path.join(out, name)), await readFile(path.join(project, name)));
  }
  const invalid = path.join(project, 'bad');
  await writeFile(path.join(project, 'battle.js'), Buffer.from([0xff]));
  await assert.rejects(exportProject(project, invalid, process.env.EGRET_PLAYER_ESBUILD), /UTF-8|utf-8/i);
  await assert.rejects(access(invalid), {code: 'ENOENT'});
  await writeFile(path.join(project, 'battle.js'), Buffer.alloc((16 << 20) + 1, 32));
  await assert.rejects(exportProject(project, invalid, process.env.EGRET_PLAYER_ESBUILD), /exceeds 16 MiB: battle.js/);
  await assert.rejects(access(invalid), {code: 'ENOENT'});
});

test('a handoff refuses modules resolved outside the delivery and leaves no partial export', {
  skip: !process.env.EGRET_PLAYER_ESBUILD && 'Requires the pinned exporter'
}, async t => {
  const {mkdir} = await import('node:fs/promises');
  const root = await mkdtemp(path.join(os.tmpdir(), 'egret-rebuild-inputs-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const game = path.join(root, 'game');
  const dependency = path.join(root, 'node_modules', 'outside-game');
  await mkdir(game);
  await mkdir(dependency, {recursive: true});
  await writeFile(path.join(dependency, 'package.json'), '{"name":"outside-game","main":"index.js"}');
  await writeFile(path.join(dependency, 'index.js'), 'module.exports = 42;');
  await writeFile(path.join(game, 'project.json'), JSON.stringify({width: 32, height: 32, entry: 'index.html', pages: []}));
  await writeFile(path.join(game, 'index.html'), '<script src="game.js"></script>');
  await writeFile(path.join(game, 'main.mjs'), 'import id from "outside-game"; globalThis.testId = id;');
  const output = path.join(root, 'out');
  await assert.rejects(exportProject(game, output, process.env.EGRET_PLAYER_ESBUILD, {verifyDeliveryInputs: true}),
    /outside the handoff/);
  await assert.rejects(access(output), {code: 'ENOENT'});
  await exportProject(game, output, process.env.EGRET_PLAYER_ESBUILD);
});
