// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, rm, readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {pruneRevisions, stageRevision, verifyRevision} from './stage-revision.mjs';

test('immutable revisions allow retry, preserve other store files and retain two selected builds', {
  skip: !process.env.EGRET_PLAYER_ESBUILD && 'Supply the pinned esbuild to exercise the real exporter.'
}, async t => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'egret-revisions-'));
  t.after(() => rm(project, {recursive: true, force: true}));
  const store = path.join(project, 'store');
  await writeFile(path.join(project, 'project.json'), JSON.stringify({width: 100, height: 100,
    entry: 'index.html', pages: [], assets: ['value.txt']}));
  await writeFile(path.join(project, 'index.html'), '<script src="game.js"></script>');
  await writeFile(path.join(project, 'main.mjs'), 'globalThis.start = 1;');
  async function stage(value) {
    await writeFile(path.join(project, 'value.txt'), value);
    return stageRevision(project, store, process.env.EGRET_PLAYER_ESBUILD);
  }
  const first = await stage('one');
  const repeat = await stage('one');
  assert.equal(repeat.reused, true);
  assert.equal(first.sha256, repeat.sha256);
  const second = await stage('two');
  const third = await stage('three');
  await writeFile(path.join(store, 'user-owned.txt'), 'keep');
  await writeFile(path.join(first.path, 'handover.txt'), 'customer notes');
  await assert.rejects(pruneRevisions(store, [second.sha256, third.sha256]), /unowned files/);
  assert.equal(await readFile(path.join(first.path, 'handover.txt'), 'utf8'), 'customer notes');
  await rm(path.join(first.path, 'handover.txt'));
  await writeFile(path.join(first.path, 'game/value.txt'), 'bad');
  await assert.rejects(verifyRevision(first.path), /identity mismatch/);
  await assert.rejects(pruneRevisions(store, [second.sha256, third.sha256]), /identity mismatch/);
  await writeFile(path.join(first.path, 'game/value.txt'), 'one');
  assert.deepEqual((await pruneRevisions(store, [second.sha256, third.sha256])).removed, [first.sha256]);
  assert.equal(await readFile(path.join(store, 'user-owned.txt'), 'utf8'), 'keep');
  assert.equal((await readdir(store)).length, 3);
});
