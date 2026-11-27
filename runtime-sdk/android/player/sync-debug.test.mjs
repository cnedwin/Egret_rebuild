// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { base64Chunks, syncDebug } from './sync-debug.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('a changed game sends only new bytes and interrupted transfers keep the active revision', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'egret-device-revision-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.writeFile(path.join(dir, 'egret-app.json'), JSON.stringify({ applicationId: 'org.example.game' }));
  async function fixture(title) {
    const files = [
      ['level.txt', title],
      ['project.json', '{}']
    ].map(([name, data]) => ({ name, size: Buffer.byteLength(data), sha256: hash(data) }));
    const sha256 = hash(JSON.stringify(files)),
      root = path.join(dir, sha256);
    await fs.mkdir(path.join(root, 'game'), { recursive: true });
    await fs.writeFile(path.join(root, 'game/level.txt'), title);
    await fs.writeFile(path.join(root, 'game/project.json'), '{}');
    await fs.writeFile(path.join(root, 'revision.json'), JSON.stringify({ schemaVersion: 1, sha256, files }));
    return root;
  }
  const remote = new Map();
  let corrupt = false,
    starts = 0;
  const base = 'files/egret-dev/game/';
  async function device(args, input) {
    if (args[1] === 'cmd') return 'org.example.game/.Main';
    if (args[1] === 'am') {
      starts++;
      return 'Status: ok';
    }
    const cmd = args.at(-1).split("'")[1],
      [verb, a, b, c] = cmd.split(' ');
    if (verb === 'cat' || verb === 'base64') {
      const chunks = [];
      if (input?.pipe) {
        for await (const buf of input) chunks.push(buf);
      } else chunks.push(input);
      const content = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
      remote.set(verb === 'base64' ? c : b, verb === 'base64' ? Buffer.from(content.toString(), 'base64') : content);
      return '';
    }
    if (verb === 'ls')
      return [...remote.keys()]
        .filter(name => name.startsWith(base + 'blobs/'))
        .map(name => name.slice((base + 'blobs/').length))
        .join('\n');
    if (verb === 'sha256sum') return cmd.split(' ').slice(1).map(file=>
      (corrupt && file.includes('/upload-') ? 'bad' : hash(remote.get(file))) + '  ' + file
    ).join('\n');
    if (verb === 'mv') {
      remote.set(c, remote.get(b));
      remote.delete(b);
      return '';
    }
    if (verb === 'rm') {
      remote.delete(b);
      return '';
    }
    if (verb === 'test' || verb === 'mkdir') return '';
    throw Error('Unexpected device call');
  }
  const opts = { app: dir, device: 'selected' };
  const first = await fixture('one'),
    second = await fixture('two');
  const initial = await syncDebug({ ...opts, revision: first }, device);
  assert.deepEqual([initial.uploaded, initial.assetBytesSent], [2, 5]);
  corrupt = true;
  await assert.rejects(syncDebug({ ...opts, revision: second }, device), /digest differs/);
  assert.equal(
    remote
      .get(base + 'active')
      .toString()
      .trim(),
    path.basename(first)
  );
  assert.equal(starts, 1);
  corrupt = false;
  const changed = await syncDebug({ ...opts, revision: second }, device);
  assert.deepEqual([changed.uploaded, changed.reused, changed.assetBytesSent], [1, 1, 3]);
  assert.equal((await syncDebug({ ...opts, revision: second }, device)).assetBytesSent, 0);
  const damagedPath=base+'blobs/'+hash('two');
  remote.set(damagedPath,Buffer.from('bad'));
  const repaired=await syncDebug({...opts,revision:second},device);
  assert.deepEqual([repaired.uploaded,repaired.reused,repaired.assetBytesSent],[1,1,3]);
  assert.equal(remote.get(damagedPath).toString(),'two');
  await syncDebug({ ...opts, embedded: true }, device);
  assert.ok(!remote.has(base + 'active'));
  assert.equal(starts, 5);
});

test('the Windows bridge preserves CRLF, Ctrl-Z, zero and high bytes at chunk boundaries', async () => {
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 19]);
  for (const chunks of [
    [bytes],
    [bytes.subarray(0, 1), bytes.subarray(1, 5), bytes.subarray(5, 6), bytes.subarray(6)]
  ]) {
    let encoded = '';
    for await (const part of base64Chunks(chunks)) encoded += part;
    assert.equal(encoded, bytes.toString('base64'));
    assert.deepEqual(Buffer.from(encoded, 'base64'), bytes);
  }
});
