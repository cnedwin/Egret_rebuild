// SPDX-License-Identifier: Apache-2.0
// Keep the bytes and notices tied to the authenticated browser archive, even when two releases use identical names.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { packBrowserNpm } from '../tools/pack-browser-npm.mjs';
import { releaseBaseUrl } from '../tools/pack-release.mjs';
import { archiveManifest } from '../tools/publish-registry.mjs';
import { archiveFiles } from '../tools/verify-release.mjs';

const sha = content => createHash('sha256').update(content).digest('hex');
const row = (file, content) => ({ file, bytes: Buffer.byteLength(content), sha256: sha(content) });

test('browser npm packages contain their own scripts and the notices from the verified release ZIP', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'egret browser pack '));
  try {
    const release = path.join(root, 'release');
    const input = path.join(root, 'input');
    const out = path.join(root, 'out');
    fs.mkdirSync(input);
    fs.mkdirSync(release);
    const version = '7.0.2';
    const sourceCommit = 'ba'.repeat(20);
    const scripts = ['egret2d.js', 'egret2d.mjs', 'egret3d.js', 'egret3d.mjs'];
    const extras = ['llms.txt', 'LICENSE', 'NOTICE', 'robust-predicates.LICENSE'];
    const members = Object.fromEntries(scripts.map(s => [s, '/*! Egret engine ' + version + ', ' + s + ' */\n']));
    for (const file of extras) members[file] = 'Original release ' + file + '\n';
    const report = { version, files: Object.fromEntries(scripts.map(s => [s, row(s, members[s])])) };
    const zip = path.join(release, 'egret-browser.zip');
    const index = path.join(release, 'release.json');
    function writeInputs() {
      members['report.json'] = JSON.stringify(report);
      for (const [name, bytes] of Object.entries(members)) fs.writeFileSync(path.join(input, name), bytes);
      const names = Object.keys(members);
      fs.rmSync(zip, { force: true });
      const zipped =
        process.platform === 'win32'
          ? spawnSync('tar.exe', ['-acf', zip, ...names], { cwd: input })
          : spawnSync('zip', ['-q', zip, ...names], { cwd: input });
      assert.equal(zipped.status, 0, zipped.stderr?.toString() ?? String(zipped.error));
      const manifest = {
        version,
        baseUrl: releaseBaseUrl(version),
        sourceCommit,
        assets: [...scripts.map(s => row(s, members[s])), row('egret-browser.zip', fs.readFileSync(zip))]
      };
      fs.writeFileSync(index, JSON.stringify(manifest));
      return sha(fs.readFileSync(index));
    }
    const digest = writeInputs();
    // A loose file and an alternate directory must never replace the authenticated copy of a licence.
    fs.writeFileSync(path.join(release, 'NOTICE'), 'other release');
    assert.throws(() => packBrowserNpm({ release, out, manifestSha256: '0'.repeat(64) }), /release.json SHA-256/);
    const original = fs.readFileSync(zip);
    fs.appendFileSync(zip, 'stale');
    assert.throws(() => packBrowserNpm({ release, out, manifestSha256: digest }), /egret-browser.zip size/);
    assert(!fs.existsSync(out));
    fs.writeFileSync(zip, original);

    const result = packBrowserNpm({ release, out, manifestSha256: 'sha256:' + digest });
    assert.equal(result.sourceCommit, sourceCommit);
    assert.equal(result.manifestSha256, digest);
    assert.equal(result.browserZipSha256, sha(original));
    assert.deepEqual(
      result.packages.map(p => p.name),
      ['@egret/2d', '@egret/3d']
    );
    for (const product of result.packages) {
      const bundle = product.name.replace('@egret/', 'egret');
      const classic = bundle + '.js';
      const module = bundle + '.mjs';
      const file = path.join(out, product.file);
      assert.equal(product.sha256, sha(fs.readFileSync(file)));
      assert.equal(product.integrity, 'sha512-' + createHash('sha512').update(fs.readFileSync(file)).digest('base64'));
      const manifest = archiveManifest(file);
      assert.equal(manifest.name, product.name);
      assert.equal(manifest.version, version);
      assert.equal(manifest.exports['.'].import, './' + module);
      assert.equal(manifest.exports['./' + module], './' + module);
      assert.equal(manifest.exports['./' + classic], './' + classic);
      assert.equal(manifest.unpkg, './' + classic);
      assert.equal(manifest.jsdelivr, './' + classic);
      assert.equal(manifest.dependencies, undefined);
      const files = archiveFiles(file);
      const expected = [classic, module, ...extras, 'README.md', 'README.zh-CN.md', 'package.json']
        .map(s => 'package/' + s)
        .sort();
      assert.deepEqual([...files.keys()].sort(), expected);
      for (const member of [classic, module, ...extras])
        assert.equal(files.get('package/' + member), sha(members[member]));
    }
    assert.throws(() => packBrowserNpm({ release, out, manifestSha256: digest }), /already exists/);
    const collectionDir = path.join(root, 'github');
    const collection = packBrowserNpm({ release, out: collectionDir, manifestSha256: digest, target: 'github' });
    assert.deepEqual(
      collection.packages.map(p => p.name),
      ['@cnedwin/egret-browser']
    );
    assert.equal(collection.sourceCommit, result.sourceCommit);
    assert.equal(collection.browserZipSha256, result.browserZipSha256);
    const item = collection.packages[0];
    assert.equal(item.file, 'cnedwin-egret-browser-' + version + '.tgz');
    const tgz = path.join(collectionDir, item.file);
    const all = archiveManifest(tgz);
    assert.equal(all.version, version);
    assert.equal(all.name, '@cnedwin/egret-browser');
    assert.equal(all.publishConfig.registry, 'https://npm.pkg.github.com');
    assert.equal(all.repository.url, 'git+https://github.com/cnedwin/Egret_rebuild.git');
    assert.equal(all.dependencies, undefined);
    assert.deepEqual(all.exports['.'], { import: './egret2d.mjs' });
    assert.deepEqual(all.exports['./2d'], all.exports['.']);
    assert.deepEqual(all.exports['./3d'], { import: './egret3d.mjs' });
    for (const f of scripts) assert.equal(all.exports['./' + f], './' + f);
    assert.equal(all.unpkg, undefined);
    assert.equal(all.jsdelivr, undefined);
    const collectionFiles = archiveFiles(tgz);
    const expectedCollection = [...scripts, ...extras, 'README.md', 'README.zh-CN.md', 'package.json'];
    assert.deepEqual([...collectionFiles.keys()].sort(), expectedCollection.map(n => 'package/' + n).sort());
    for (const f of [...scripts, ...extras]) assert.equal(collectionFiles.get('package/' + f), sha(members[f]));
    for (const doc of ['README.md', 'README.zh-CN.md']) {
      assert.equal(
        collectionFiles.get('package/' + doc),
        sha(fs.readFileSync(new URL('../tools/github-browser-distribution/' + doc, import.meta.url)))
      );
    }
    assert.throws(
      () => packBrowserNpm({ release, out: collectionDir, manifestSha256: digest, target: 'wrong' }),
      /Unknown package target/
    );
    // A malformed release whose manifest and ZIP match must still agree with the browser packer's report.
    report.files['egret3d.js'].sha256 = '0'.repeat(64);
    const badOut = path.join(root, 'failed');
    assert.throws(() => packBrowserNpm({ release, out: badOut, manifestSha256: writeInputs() }), /egret3d.js SHA-256/);
    assert(!fs.existsSync(badOut));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
