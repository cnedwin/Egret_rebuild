// SPDX-License-Identifier: Apache-2.0
// Package the two browser distributions from a verified, published GitHub release without rebuilding them.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { archiveName, releaseBaseUrl, RELEASE_VERSION } from './pack-release.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const bundles = ['egret2d', 'egret3d'];
const scripts = bundles.flatMap(b => [b + '.js', b + '.mjs']);
const notices = ['LICENSE', 'NOTICE', 'robust-predicates.LICENSE', 'llms.txt'];
const zipName = 'egret-browser.zip';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = (dir, name) => fs.readFileSync(path.join(dir, name));

function checkFile(bytes, record, name) {
  assert.equal(bytes.length, record?.bytes, name + ' size');
  assert.equal(hash(bytes), record.sha256, name + ' SHA-256');
}

function run(command, args, cwd, shell = false) {
  const result = spawnSync(command, args, { cwd, shell, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + ' failed: ' + result.stderr.toString().slice(-1200));
  return result.stdout;
}

/** Read the named members from the verified snapshot, including the licences and guide from that same ZIP. */
function releaseMembers(dir) {
  const windows = process.platform === 'win32';
  const program = windows ? 'tar.exe' : 'unzip';
  const listing = run(program, windows ? ['-tf', zipName] : ['-Z1', zipName], dir)
    .toString()
    .trimEnd()
    .split(/\r?\n/);
  const members = new Map();
  for (const name of [...scripts, ...notices, 'report.json']) {
    assert.equal(listing.filter(entry => entry === name).length, 1, 'Expected one ZIP member ' + name);
    members.set(name, run(program, windows ? ['-xOf', zipName, name] : ['-p', zipName, name], dir));
  }
  return members;
}

function packBundle(bundle, members, record, work, product) {
  const name = '@egret/' + bundle.slice('egret'.length);
  const classic = bundle + '.js';
  const module = bundle + '.mjs';
  const stage = path.join(work, bundle);
  fs.mkdirSync(stage);
  for (const file of [classic, module, ...notices]) fs.writeFileSync(path.join(stage, file), members.get(file));
  for (const file of ['README.md', 'README.zh-CN.md']) {
    fs.copyFileSync(path.join(repo, 'tools', 'browser-distribution', file), path.join(stage, file));
  }
  const manifest = {
    name,
    version: record.version,
    description: 'Standalone Egret Engine ' + (bundle === 'egret2d' ? '2D' : '2D and World3D') + ' browser bundle',
    license: 'Apache-2.0',
    repository: { type: 'git', url: 'git+https://github.com/cnedwin/Egret_rebuild.git' },
    homepage: 'https://github.com/cnedwin/Egret_rebuild/releases/tag/v' + record.version,
    type: 'module',
    main: './' + module,
    exports: {
      '.': { import: './' + module },
      ['./' + module]: './' + module,
      ['./' + classic]: './' + classic,
      './package.json': './package.json'
    },
    unpkg: './' + classic,
    jsdelivr: './' + classic,
    files: [classic, module, ...notices, 'README.md', 'README.zh-CN.md']
  };
  fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  // Only constant arguments go through npm.cmd on Windows. Source and output paths stay in filesystem calls.
  run('npm', ['pack', '--ignore-scripts', '--json'], stage, process.platform === 'win32');
  const file = archiveName(name, record.version);
  fs.renameSync(path.join(stage, file), path.join(product, file));
  const bytes = read(product, file);
  return {
    name,
    file,
    bytes: bytes.length,
    sha256: hash(bytes),
    integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64')
  };
}

/** The trusted digest comes from GitHub's release.json asset metadata, independently of the downloaded files. */
export function packBrowserNpm({ release, manifestSha256, out }) {
  assert.match(manifestSha256, /^(sha256:)?[a-f0-9]{64}$/, 'GitHub release.json SHA-256');
  const manifest = read(release, 'release.json');
  const digest = hash(manifest);
  assert.equal(digest, manifestSha256.replace(/^sha256:/, ''), 'release.json SHA-256');
  const record = JSON.parse(manifest);
  assert.match(record.version, RELEASE_VERSION);
  assert.match(record.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(record.baseUrl, releaseBaseUrl(record.version));
  const assets = new Map(record.assets.map(row => [row.file, row]));
  assert.equal(assets.size, record.assets.length, 'Duplicate release asset');
  const zip = read(release, zipName);
  checkFile(zip, assets.get(zipName), zipName);
  assert(!fs.existsSync(out), 'Output directory already exists');
  const parent = path.dirname(path.resolve(out));
  fs.mkdirSync(parent, { recursive: true });
  const work = fs.mkdtempSync(path.join(parent, '.browser-npm-'));
  try {
    fs.writeFileSync(path.join(work, zipName), zip);
    const members = releaseMembers(work);
    const report = JSON.parse(members.get('report.json'));
    assert.equal(report.version, record.version, 'Browser report version');
    for (const script of scripts) {
      checkFile(members.get(script), assets.get(script), script);
      checkFile(members.get(script), report.files[script], script);
      assert(
        members
          .get(script)
          .subarray(0, 100)
          .toString()
          .startsWith('/*! Egret engine ' + record.version + ','),
        script + ' version banner'
      );
    }
    const product = path.join(work, 'packages');
    fs.mkdirSync(product);
    const packages = bundles.map(bundle => packBundle(bundle, members, record, work, product));
    const result = {
      version: record.version,
      sourceCommit: record.sourceCommit,
      manifestSha256: digest,
      browserZipSha256: assets.get(zipName).sha256,
      packages
    };
    fs.writeFileSync(path.join(product, 'browser-npm.json'), JSON.stringify(result, null, 2) + '\n');
    fs.renameSync(product, out);
    return result;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const key = { '--release': 'release', '--manifest-sha256': 'manifestSha256', '--out': 'out' }[args[i]];
    if (!key || key in options || !args[i + 1]) throw new Error('Unknown or incomplete option: ' + args[i]);
    options[key] = args[i + 1];
  }
  if (Object.keys(options).length !== 3)
    throw new Error(
      'Usage: node tools/pack-browser-npm.mjs --release <directory> --manifest-sha256 <digest> --out <new directory>'
    );
  console.log(JSON.stringify(packBrowserNpm(options), null, 2));
}
