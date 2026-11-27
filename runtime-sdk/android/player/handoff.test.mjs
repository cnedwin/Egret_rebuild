// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { copySelected } from './handoff.mjs';

test('a handoff includes named editables only and refuses collisions or private build material', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'egret-handoff-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  await mkdir(source);
  await writeFile(path.join(source, '主城.ts'), 'export const scene = 1;');
  await writeFile(path.join(source, '.env'), 'sensitive fixture');
  const files = await copySelected(source, ['主城.ts'], path.join(root, 'out'));
  assert.equal(files[0].name, '主城.ts');
  assert.equal(files[0].sha256.length, 64);
  for (const names of [['.env'], ['test.jks'], ['../external'], ['node_modules/module.js'],
      ['A.ts', 'a.ts'], ['maps/COn.txt'], ['extra.'], ['C:/absolute']]) {
    await assert.rejects(copySelected(source, names, path.join(root, 'rejected')), /handoff/i);
  }
});
