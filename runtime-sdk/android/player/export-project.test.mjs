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
