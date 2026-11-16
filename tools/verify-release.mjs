// SPDX-License-Identifier: Apache-2.0
// Usage: node tools/verify-release.mjs --version <version> [--archives <directory>]
// Packs the release with the archives naming each other by file address, installs the engine, the project tools and
// the Spine package into a new project outside this checkout with npm, and imports them there. With --archives it also
// checks that the archives in that directory, packed for publishing, hold the same files with the same contents: all
// that may differ is the address by which one names another. It needs the network for the third-party dependencies.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { packRelease, releaseBaseUrl, RELEASE_PACKAGES } from './pack-release.mjs';

/** The files of an archive: path to the SHA-256 of its bytes. Names longer than a header holds come as extended records. */
export function archiveFiles(file) {
  const tar = zlib.gunzipSync(fs.readFileSync(file)),
    out = new Map();
  let long;
  for (let at = 0; at + 512 <= tar.length; ) {
    const header = tar.subarray(at, at + 512);
    if (header.every(byte => byte === 0)) break;
    const text = (from, length) => {
      const part = header.subarray(from, from + length),
        end = part.indexOf(0);
      return part.subarray(0, end < 0 ? length : end).toString('utf8');
    };
    const size = parseInt(text(124, 12).trim() || '0', 8),
      type = String.fromCharCode(header[156] || 48),
      body = tar.subarray(at + 512, at + 512 + size);
    if (type === 'x') {
      const match = /\d+ path=([^\n]*)\n/.exec(body.toString('utf8'));
      if (match) long = match[1];
    } else if (type === 'L') long = body.toString('utf8').replace(/\0+$/, '');
    else {
      const prefix = text(345, 155),
        name = long ?? (prefix ? prefix + '/' : '') + text(0, 100);
      long = undefined;
      if (type === '0') out.set(name, crypto.createHash('sha256').update(body).digest('hex'));
    }
    at += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}
const fail = message => {
  throw new Error('RELEASE_VERIFY: ' + message);
};

export function verifyRelease({ version, archives, npm = 'npm' }) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-release-check-')),
    local = path.join(work, 'archives'),
    consumer = path.join(work, 'consumer');
  try {
    const record = packRelease({ version, out: local, baseUrl: pathToFileURL(local).href + '/', npm });
    if (record.packages.length !== RELEASE_PACKAGES.length) fail('expected ' + RELEASE_PACKAGES.length + ' archives');
    if (archives !== undefined) {
      const published = JSON.parse(fs.readFileSync(path.join(archives, 'release.json'), 'utf8'));
      if (published.version !== version || published.baseUrl !== releaseBaseUrl(version))
        fail('release.json is for ' + published.version + ' at ' + published.baseUrl);
      for (const item of record.packages) {
        const mine = archiveFiles(path.join(local, item.file)),
          theirs = archiveFiles(path.join(archives, item.file));
        mine.delete('package/package.json');
        theirs.delete('package/package.json');
        if (JSON.stringify([...mine]) !== JSON.stringify([...theirs]))
          fail(item.file + ' differs from the archive that was installed, beyond its manifest');
        const row = published.packages.find(entry => entry.name === item.name);
        if (
          !row ||
          row.sha256 !==
            crypto
              .createHash('sha256')
              .update(fs.readFileSync(path.join(archives, item.file)))
              .digest('hex')
        )
          fail('release.json does not record ' + item.file + ' as it is');
      }
    }
    fs.mkdirSync(consumer);
    fs.writeFileSync(
      path.join(consumer, 'package.json'),
      JSON.stringify({ name: 'egret-release-consumer', version: '0.0.0', private: true, type: 'module' }) + '\n'
    );
    const wanted = ['@egret/engine', '@egret/project', '@egret/spine'].map(
      name => record.packages.find(item => item.name === name).install
    );
    const install = spawnSync(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...wanted], {
      cwd: consumer,
      encoding: 'utf8',
      shell: process.platform === 'win32'
    });
    if (install.status !== 0) fail('npm install failed: ' + String(install.stderr || install.error).slice(-600));
    for (const item of record.packages) {
      const installed = JSON.parse(
        fs.readFileSync(path.join(consumer, 'node_modules', item.name, 'package.json'), 'utf8')
      );
      if (installed.version !== version || 'private' in installed)
        fail(item.name + ' was installed as ' + installed.version);
    }
    fs.writeFileSync(
      path.join(consumer, 'check.mjs'),
      [
        "import * as egret from '@egret/engine';",
        "import { createBrowserGame } from '@egret/engine/web/game';",
        "import * as project from '@egret/project';",
        "import * as spine from '@egret/spine';",
        'const sprite = new egret.Sprite(); sprite.graphics.beginFill(0xff0000).drawCircle(0, 0, 10);',
        'const bounds = sprite.getBounds();',
        "if (typeof egret.createEngine !== 'function' || typeof createBrowserGame !== 'function' || bounds.width !== 20) throw new Error('the engine did not load as expected');",
        "if (Object.keys(project).length === 0 || Object.keys(spine).length === 0) throw new Error('a package exports nothing');",
        "console.log('loaded ' + Object.keys(egret).length + ' engine exports');"
      ].join('\n') + '\n'
    );
    const check = spawnSync(process.execPath, ['check.mjs'], { cwd: consumer, encoding: 'utf8' });
    if (check.status !== 0) fail('the installed packages did not load: ' + String(check.stderr).slice(-600));
    return { version, packages: record.packages.map(item => item.name), loaded: check.stdout.trim() };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {},
    args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const key = { '--version': 'version', '--archives': 'archives' }[args[i]];
    if (key === undefined || args[i + 1] === undefined || key in options)
      throw new TypeError('Usage: node tools/verify-release.mjs --version <version> [--archives <directory>]');
    options[key] = args[i + 1];
  }
  if (options.version === undefined)
    throw new TypeError('Usage: node tools/verify-release.mjs --version <version> [--archives <directory>]');
  if (options.archives !== undefined) options.archives = path.resolve(options.archives);
  const result = verifyRelease(options);
  console.log(
    'Release ' + result.version + ' installs and loads: ' + result.packages.join(', ') + '; ' + result.loaded + '.'
  );
}
