// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import {
  exactExecutable,
  findExactPwsh,
  installArchive,
  lock,
  obtainArchive,
  sourcesFor,
  verifyArchive
} from '../tools/windows-pwsh.mjs';

const archive = Buffer.from('known archive bytes');
const pin = {
  ...lock,
  bytes: archive.length,
  sha256: createHash('sha256').update(archive).digest('hex'),
  urls: ['https://primary.invalid/archive.zip', 'https://backup.invalid/archive.zip']
};
const silent = { log: () => {}, pause: async () => {}, random: () => 0, pin, sources: sourcesFor(pin) };

async function fixture(t) {
  const root = await mkdtemp(path.join(await realpath(os.tmpdir()), 'egret-pwsh-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cached = path.join(root, 'archive.zip');
  return { root, cached };
}

test('production lock records the official release and its exact SHA-256 and bytes', () => {
  assert.equal(lock.version, '7.6.5');
  assert.equal(lock.arch, 'x64');
  assert.equal(lock.archive, 'PowerShell-7.6.5-win-x64.zip');
  assert.equal(lock.bytes, 106319290);
  assert.equal(lock.sha256, '32eb8f6cdce08f86e987d625a2733e54ac3e289ae7e1621b14c0b5bcec2434ea');
  assert.deepEqual(lock.urls, [
    'https://github.com/PowerShell/PowerShell/releases/download/v7.6.5/PowerShell-7.6.5-win-x64.zip',
    'https://api.github.com/repos/PowerShell/PowerShell/releases/assets/514628305'
  ]);
});

test('source URLs require HTTPS and reject credentials or queries', () => {
  for (const url of [
    'http://mirror.invalid/archive.zip',
    'https://user:secret@mirror.invalid/archive.zip',
    'https://mirror.invalid/archive.zip?token=secret'
  ]) {
    assert.throws(() => sourcesFor(pin, url), /HTTPS URL/);
  }
  assert.equal(sourcesFor(pin, 'https://mirror.invalid/archive.zip')[1].name, 'configured mirror');
});

test('verified cache hit makes no network calls', async t => {
  const { cached } = await fixture(t);
  await writeFile(cached, archive);
  assert.equal(await obtainArchive(cached, { ...silent, fetcher: () => assert.fail('network on cache hit') }), cached);
});

test('bad cache and wrong digest are rejected; backup supplies exact bytes', async t => {
  const { root, cached } = await fixture(t);
  await writeFile(cached, Buffer.from('corrupt!'));
  const seen = [];
  const fetcher = async (url, opts) => {
    seen.push(url.hostname);
    assert.equal(opts.headers.Accept, 'application/octet-stream');
    assert.equal(opts.credentials, 'omit');
    assert.equal(opts.headers.Authorization, undefined);
    return new Response(url.hostname.startsWith('primary') ? Buffer.alloc(archive.length) : archive);
  };
  await obtainArchive(cached, { ...silent, fetcher });
  assert.deepEqual(seen, ['primary.invalid', 'backup.invalid']);
  assert.deepEqual(await readFile(cached), archive);
  assert.equal(await verifyArchive(cached, pin), true);
  assert.deepEqual(await readdir(root), ['archive.zip']);
});

test('transient failures retry with bounded backoff after trying backup', async t => {
  const { cached } = await fixture(t);
  const sequence = [],
    pauses = [];
  await obtainArchive(cached, {
    ...silent,
    pause: async ms => pauses.push(ms),
    random: () => 0.5,
    fetcher: async url => {
      sequence.push(url.hostname);
      if (sequence.length <= 2) return new Response('unavailable', { status: sequence.length === 1 ? 503 : 429 });
      return new Response(archive);
    }
  });
  assert.deepEqual(sequence, ['primary.invalid', 'backup.invalid', 'primary.invalid']);
  assert.deepEqual(pauses, [1500]);
});

test('timeout falls back; secure redirects preserve anonymous transport and signed query is not logged', async t => {
  const { cached } = await fixture(t);
  const logs = [];
  const visited = [];
  await obtainArchive(cached, {
    ...silent,
    timeoutMs: 40,
    log: line => logs.push(line),
    fetcher: async (url, { signal, headers }) => {
      visited.push(url.hostname);
      assert.equal(headers.Authorization, undefined);
      if (url.hostname === 'primary.invalid') {
        await delay(1000, null, { signal });
      }
      if (url.hostname === 'backup.invalid') {
        return new Response(null, { status: 302, headers: { location: 'https://cdn.invalid/archive.zip?sig=secret' } });
      }
      return new Response(archive);
    }
  });
  assert.deepEqual(visited, ['primary.invalid', 'backup.invalid', 'cdn.invalid']);
  assert(!logs.join(' ').includes('secret'));
});

test('timeout during body streaming discards partial bytes before fallback', async t => {
  const { root, cached } = await fixture(t);
  let canceled = false;
  // Keep a timer alive while the timeout aborts the intentionally unfinished stream.
  const keepAlive = setTimeout(() => {}, 1000);
  t.after(() => clearTimeout(keepAlive));
  await obtainArchive(cached, {
    ...silent,
    timeoutMs: 40,
    fetcher: async url =>
      url.hostname === 'primary.invalid'
        ? new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(archive.subarray(0, 4));
              },
              cancel() {
                canceled = true;
              }
            })
          )
        : new Response(archive)
  });
  assert(canceled);
  assert.deepEqual(await readdir(root), ['archive.zip']);
  assert.deepEqual(await readFile(cached), archive);
});

test('all sources fail closed, never retain partial or unverified files', async t => {
  const { root, cached } = await fixture(t);
  let calls = 0;
  const logs = [];
  await assert.rejects(
    obtainArchive(cached, {
      ...silent,
      attempts: 2,
      log: line => logs.push(line),
      fetcher: async () => {
        calls++;
        throw new Error('sensitive URL: https://cdn.invalid/private?token=secret');
      }
    }),
    /INFRA_TOOLCHAIN_UNAVAILABLE/
  );
  assert.equal(calls, 4);
  assert.deepEqual(await readdir(root), []);
  assert(!logs.join(' ').includes('secret'));
});

test('untrusted length, HTTP 404 and insecure redirect do not produce usable bytes', async t => {
  const { root, cached } = await fixture(t);
  let insecure = false;
  await assert.rejects(
    obtainArchive(cached, {
      ...silent,
      attempts: 1,
      fetcher: async url => {
        if (url.protocol !== 'https:') insecure = true;
        if (url.hostname === 'primary.invalid')
          return new Response(null, { status: 302, headers: { location: 'http://cdn.invalid/archive.zip' } });
        return new Response(Buffer.concat([archive, archive]));
      }
    }),
    /INFRA_TOOLCHAIN_UNAVAILABLE/
  );
  assert.equal(insecure, false);
  assert.deepEqual(await readdir(root), []);
  let count = 0;
  await assert.rejects(
    obtainArchive(cached, {
      ...silent,
      fetcher: async () => {
        count++;
        return new Response('not found', { status: 404 });
      }
    }),
    /INFRA_TOOLCHAIN_UNAVAILABLE/
  );
  assert.equal(count, 2);
});

test('only exact x64 executable is accepted; workspace binaries are ignored', async t => {
  const { root } = await fixture(t);
  const workspace = path.join(root, 'repo');
  const installed = path.join(root, 'installed');
  await mkdir(workspace);
  await mkdir(installed);
  await writeFile(path.join(workspace, 'pwsh.exe'), 'workspace');
  await writeFile(path.join(installed, 'pwsh.exe'), 'installed');
  let attempts = [];
  const spawn = exe => {
    attempts.push(exe);
    return { status: 0, stdout: '7.6.5\r\nX64\r\n' };
  };
  const env = { PATH: ['.', workspace, installed].join(path.delimiter), GITHUB_WORKSPACE: workspace };
  assert.equal(await findExactPwsh(env, spawn), path.join(installed, 'pwsh.exe'));
  assert.deepEqual(attempts, [path.join(installed, 'pwsh.exe')]);
  assert.equal(
    exactExecutable('unused', pin, () => ({ status: 0, stdout: '7.6.4\nX64' })),
    false
  );
  assert.equal(
    exactExecutable('unused', pin, () => ({ status: 0, stdout: '7.6.5\nArm64' })),
    false
  );
  assert.equal(
    exactExecutable('unused', pin, () => ({ status: 1, stdout: '7.6.5\nX64' })),
    false
  );
});

test('installer refuses corrupt archive before extraction', async t => {
  const { root, cached } = await fixture(t);
  await writeFile(cached, 'not an archive');
  await assert.rejects(installArchive(cached, root), /SHA-256 verification/);
  assert.deepEqual(await readdir(root), ['archive.zip']);
});
