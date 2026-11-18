// SPDX-License-Identifier: Apache-2.0
// The release archives: what each one's manifest says, what it holds, and what is refused. Nothing is installed here;
// tools/verify-release.mjs does that, with the network, in the release workflow.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { recordReleaseAssets } from '../tools/record-release-assets.mjs';
import {
  archiveName,
  packRelease,
  releaseBaseUrl,
  releaseManifest,
  RELEASE_PACKAGES,
  RELEASE_VERSION
} from '../tools/pack-release.mjs';
import { archiveFiles } from '../tools/verify-release.mjs';

const coded = code => error => error?.code === code;
const built = fs.existsSync(new URL('../packages/engine/dist/index.js', import.meta.url));
function manifestOf(file) {
  const tar = zlib.gunzipSync(fs.readFileSync(file));
  for (let at = 0; at + 512 <= tar.length; ) {
    const name = tar
        .subarray(at, at + 100)
        .toString('utf8')
        .replace(/\0.*$/s, ''),
      size = parseInt(
        tar
          .subarray(at + 124, at + 136)
          .toString('utf8')
          .trim() || '0',
        8
      );
    if (name === 'package/package.json') return JSON.parse(tar.subarray(at + 512, at + 512 + size).toString('utf8'));
    at += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error('no manifest in ' + file);
}

test('RA01 a version, an archive name and a release address', () => {
  for (const good of ['0.1.0', '1.2.3', '0.1.0-preview.1', '10.20.30-rc.2']) assert.match(good, RELEASE_VERSION);
  for (const bad of ['', '1.2', 'v1.2.3', '01.2.3', '1.2.3-', '1.2.3+build', '1.2.3 ', 'latest', '1.2.3-a b'])
    assert.doesNotMatch(bad, RELEASE_VERSION);
  assert.equal(archiveName('@egret/engine', '0.1.0-preview.1'), 'egret-engine-0.1.0-preview.1.tgz');
  assert.equal(releaseBaseUrl('0.1.0'), 'https://github.com/cnedwin/Egret_rebuild/releases/download/v0.1.0/');
});

test('RA02 the manifest of an archive has the version, is not private, and names workspace packages by address', () => {
  const names = new Set(['@egret/contracts', '@egret/runtime', '@egret/engine']);
  const source = {
    name: '@egret/engine',
    version: '0.0.0',
    private: true,
    type: 'module',
    license: 'Apache-2.0',
    exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
    imports: { '#x': './dist/x.js' },
    scripts: { prepare: 'x' },
    devDependencies: { y: '1' },
    dependencies: { '@egret/contracts': 'workspace:*', '@egret/runtime': 'workspace:*', 'robust-predicates': '3.0.3' }
  };
  const out = releaseManifest(source, '0.2.0', 'https://example.test/r/', names);
  assert.equal(out.version, '0.2.0');
  assert.equal('private' in out, false);
  assert.equal('scripts' in out, false);
  assert.equal('devDependencies' in out, false);
  assert.deepEqual(out.exports, source.exports);
  assert.deepEqual(out.imports, source.imports);
  assert.equal(out.license, 'Apache-2.0');
  assert.deepEqual(out.dependencies, {
    '@egret/contracts': 'https://example.test/r/egret-contracts-0.2.0.tgz',
    '@egret/runtime': 'https://example.test/r/egret-runtime-0.2.0.tgz',
    'robust-predicates': '3.0.3'
  });
  assert.deepEqual(out.files, ['dist', 'README.md', 'README.zh-CN.md', 'LICENSE', 'NOTICE']);
  assert.equal(source.private, true);
  assert.equal(source.version, '0.0.0');
  // A workspace package that the release does not hold cannot be named by an address.
  assert.throws(
    () =>
      releaseManifest(
        { name: 'a', version: '0.0.0', dependencies: { '@egret/other': 'workspace:*' } },
        '0.2.0',
        'https://example.test/r/',
        names
      ),
    coded('RELEASE_DEPENDENCY')
  );
});

test('RA03 what is not a release is refused before anything is written', () => {
  const out = path.join(os.tmpdir(), 'egret-release-test-' + process.pid + '-refused');
  for (const version of ['v0.1.0', '0.1', '', undefined, 1])
    assert.throws(() => packRelease({ version, out }), coded('RELEASE_VERSION'));
  for (const baseUrl of ['http://example.test/r/', 'https://example.test/r', 'ftp://x/', 'relative/', ''])
    assert.throws(() => packRelease({ version: '0.1.0', out, baseUrl }), coded('RELEASE_BASE_URL'));
  assert.equal(fs.existsSync(out), false);
  assert.throws(() => packRelease({ version: '0.1.0', out: os.tmpdir() }), coded('RELEASE_OUT'));
});

test('RA04 each archive holds the built files, the licence and the notice, and release.json records it', {
  skip: !built && 'the packages are not built'
}, () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'egret-release-test-')), 'release');
  try {
    const record = packRelease({ version: '0.3.0-test.1', out });
    assert.deepEqual(
      record.packages.map(item => item.name),
      RELEASE_PACKAGES.map(name => '@egret/' + name)
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'release.json'), 'utf8')), record);
    assert.equal(record.baseUrl, releaseBaseUrl('0.3.0-test.1'));
    for (const item of record.packages) {
      const files = archiveFiles(path.join(out, item.file)),
        names = [...files.keys()],
        manifest = manifestOf(path.join(out, item.file));
      assert.equal(fs.statSync(path.join(out, item.file)).size, item.bytes);
      assert.equal(item.install, record.baseUrl + item.file);
      for (const required of [
        'package/package.json',
        'package/LICENSE',
        'package/NOTICE',
        'package/dist/index.js',
        'package/dist/index.d.ts'
      ])
        assert.ok(files.has(required), item.file + ' lacks ' + required);
      assert.deepEqual(
        names.filter(name => !/^package\/(dist\/|package\.json$|LICENSE$|NOTICE$|README(\.zh-CN)?\.md$)/.test(name)),
        [],
        item.file
      );
      assert.deepEqual(
        names.filter(name => /\.(map|tsbuildinfo|ts)$/.test(name) && !name.endsWith('.d.ts')),
        [],
        item.file
      );
      assert.equal(manifest.version, '0.3.0-test.1');
      assert.equal('private' in manifest, false);
      for (const [name, range] of Object.entries(manifest.dependencies ?? {}))
        if (name.startsWith('@egret/')) assert.equal(range, record.baseUrl + archiveName(name, '0.3.0-test.1'));
      // Every entry the manifest names is a file of the archive.
      const targets = [];
      const walk = value => {
        if (typeof value === 'string') targets.push(value);
        else if (value && typeof value === 'object') Object.values(value).forEach(walk);
      };
      walk(manifest.exports);
      walk(manifest.imports);
      for (const target of targets)
        assert.ok(files.has('package/' + target.replace(/^\.\//, '')), item.name + ' names ' + target);
    }
    // The release index binds the tagged package set and browser packer's verified bytes to the same commit.
    const version = record.version;
    const sourceCommit = 'ab'.repeat(20);
    const report = { version, files: {} };
    const reportFile = path.join(path.dirname(out), 'report.json');
    for (const name of ['egret2d.js', 'egret2d.mjs', 'egret3d.js', 'egret3d.mjs']) {
      const bytes = Buffer.from('/*! Egret engine ' + version + ', fixture */\n');
      fs.writeFileSync(path.join(out, name), bytes);
      report.files[name] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    }
    fs.writeFileSync(reportFile, JSON.stringify(report));
    for (const name of ['egret-browser.zip', 'egret-first-game.zip']) fs.writeFileSync(path.join(out, name), name);
    recordReleaseAssets(out, reportFile, version, sourceCommit);
    const complete = JSON.parse(fs.readFileSync(path.join(out, 'release.json'), 'utf8'));
    assert.equal(complete.sourceCommit, sourceCommit);
    assert.deepEqual(complete.packages, record.packages);
    assert.deepEqual(
      complete.assets.map(row => row.file),
      [...Object.keys(report.files), 'egret-browser.zip', 'egret-first-game.zip']
    );
    for (const row of complete.assets) {
      const bytes = fs.readFileSync(path.join(out, row.file));
      assert.equal(row.bytes, bytes.length);
      assert.equal(row.sha256, createHash('sha256').update(bytes).digest('hex'));
    }
    assert.throws(() => recordReleaseAssets(out, reportFile, '1.0.0', sourceCommit));
    fs.appendFileSync(path.join(out, 'egret2d.js'), 'stale');
    assert.throws(() => recordReleaseAssets(out, reportFile, version, sourceCommit), /egret2d.js/);

    // The repository's own manifests are as they were.
    for (const name of RELEASE_PACKAGES) {
      const own = JSON.parse(
        fs.readFileSync(new URL('../packages/' + name + '/package.json', import.meta.url), 'utf8')
      );
      assert.equal(own.private, true);
      assert.equal(own.version, '0.0.0');
    }
  } finally {
    fs.rmSync(path.dirname(out), { recursive: true, force: true });
  }
});
