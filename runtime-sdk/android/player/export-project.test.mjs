// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
