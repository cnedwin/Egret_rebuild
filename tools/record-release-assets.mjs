// SPDX-License-Identifier: Apache-2.0
// Completes the npm package manifest after the starter and single-file distributions have been built.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprintFile } from './lib/file-identity.mjs';
import { archiveName, RELEASE_PACKAGES, releaseBaseUrl, RELEASE_VERSION } from './pack-release.mjs';

const scripts = ['egret2d.js', 'egret2d.mjs', 'egret3d.js', 'egret3d.mjs'];
const downloads = [...scripts, 'egret-browser.zip', 'egret-first-game.zip'];

/** Bind the files available for download to the checkout and to the browser packer's verified output. */
export function recordReleaseAssets(directory, browserReport, version, sourceCommit) {
  assert.match(version, RELEASE_VERSION);
  assert.match(sourceCommit, /^[0-9a-f]{40}$/);
  const manifest = path.join(directory, 'release.json');
  const release = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const browser = JSON.parse(fs.readFileSync(browserReport, 'utf8'));
  assert.equal(release.version, version);
  assert.equal(release.baseUrl, releaseBaseUrl(version));
  assert.equal(browser.version, version);
  assert.deepEqual(Object.keys(browser.files).sort(), [...scripts].sort());

  const packages = RELEASE_PACKAGES.map(name => '@egret/' + name);
  assert.deepEqual(
    release.packages.map(row => row.name),
    packages
  );
  for (const row of release.packages) {
    assert.equal(row.file, archiveName(row.name, version));
    const file = fingerprintFile(directory, row.file);
    assert.equal(row.sha256, file.sha256);
    assert.equal(row.bytes, file.bytes);
    assert.equal(row.install, release.baseUrl + row.file);
  }

  const expected = ['release.json', ...release.packages.map(row => row.file), ...downloads];
  assert.deepEqual(fs.readdirSync(directory).sort(), expected.sort());
  const assets = downloads.map(file => {
    const { bytes, sha256 } = fingerprintFile(directory, file);
    assert.ok(bytes > 0, file);
    if (scripts.includes(file)) {
      assert.equal(browser.files[file].sha256, sha256, file);
      assert.equal(browser.files[file].bytes, bytes, file);
      const prefix = '/*! Egret engine ' + version + ',';
      assert.ok(fs.readFileSync(path.join(directory, file), 'utf8').startsWith(prefix), file);
    }
    return { file, bytes, sha256 };
  });
  fs.writeFileSync(manifest, JSON.stringify({ ...release, sourceCommit, assets }, null, 2) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [directory, report, version, sourceCommit] = process.argv.slice(2);
  recordReleaseAssets(path.resolve(directory), path.resolve(report), version, sourceCommit);
}
