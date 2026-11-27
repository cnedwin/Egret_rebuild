// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { stageAndroidLibraries } from '../runtime-sdk/android/player/channel-libraries.mjs';

async function control(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'egret-channel-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = path.join(root, 'gradle');
  await mkdir(project);
  const bytes = Buffer.from('independent archive transport fixture');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const item = { file: 'Channel.jar', sha256 };
  const profile = path.join(root, 'channel.json');
  await writeFile(path.join(root, item.file), bytes);
  async function run(libraries) {
    await writeFile(profile, JSON.stringify({ schemaVersion: 1, libraries }));
    return stageAndroidLibraries(project, profile);
  }
  return { root, project, bytes, item, run };
}

test('a channel is opt-in and the exported lock refers to exact copied bytes', async t => {
  const { project, bytes, item, run } = await control(t);
  await stageAndroidLibraries(project, undefined);
  await assert.rejects(readFile(path.join(project, 'egret-channel.json')), { code: 'ENOENT' });
  await run([item]);
  const lock = JSON.parse(await readFile(path.join(project, 'egret-channel.json'), 'utf8'));
  assert.deepEqual(lock, { schemaVersion: 1, libraries: [item] });
  assert.deepEqual(await readFile(path.join(project, 'libs/channel', item.file)), bytes);
});

test('unknown fields, duplicate identities, bad paths and changed archives refuse the export', async t => {
  const { project, item, run } = await control(t);
  for (const file of ['../x.jar', 'nested/x.aar', 'NUL.jar', 'x.zip', 'channel.jar']) {
    await assert.rejects(run([{ ...item, file }]));
  }
  await assert.rejects(run([item, { ...item, file: 'channel.jar' }]));
  await assert.rejects(run([{ ...item, sha256: 'f'.repeat(64) }]), /digest/i);
  await assert.rejects(run([{ ...item, url: 'unused' }]));
  await assert.rejects(readFile(path.join(project, 'egret-channel.json')), { code: 'ENOENT' });
});
