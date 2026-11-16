// SPDX-License-Identifier: Apache-2.0
// Usage: node tools/pack-release.mjs --version <version> --out <new directory> [--base-url <address>]
// Writes one installable archive for each package of the workspace, and release.json naming them.
// The packages in the repository stay private and at 0.0.0; an archive has the version given, is not private, has the
// licence and notice, and names the other packages of the workspace by the address of their archives in the same
// release, so that installing one from that address installs what it needs:
//   npm install <base-url>egret-engine-<version>.tgz
// Without --base-url the address is that of the GitHub release with the tag v<version>. Build first.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
/** The packages of a release, each after those it depends on. */
export const RELEASE_PACKAGES = Object.freeze(['contracts', 'runtime', 'engine', 'project', 'spine']);
/** A version a release may have: three numbers, and after a hyphen a name of letters, digits, dots and hyphens. */
export const RELEASE_VERSION =
  /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})(-[0-9A-Za-z][0-9A-Za-z.-]{0,63})?$/;
const refuse = (code, message) => Object.assign(new Error(code + ': ' + message), { code });

/** The file name of a package's archive: the scope and name joined by a hyphen, then the version. */
export function archiveName(name, version) {
  return name.replace(/^@/, '').replace('/', '-') + '-' + version + '.tgz';
}
/** The address of the GitHub release that a version's archives are attached to. */
export function releaseBaseUrl(version) {
  return 'https://github.com/cnedwin/Egret_rebuild/releases/download/v' + version + '/';
}
/**
 * The manifest an archive carries, from the one in the repository: the version, no `private`, the files it holds, and
 * each workspace dependency as the address of that package's archive. Everything else is as it was.
 */
export function releaseManifest(manifest, version, baseUrl, names) {
  const out = {};
  for (const [key, value] of Object.entries(manifest)) {
    if (key === 'private' || key === 'scripts' || key === 'devDependencies') continue;
    out[key] = key === 'version' ? version : value;
  }
  out.files = ['dist', 'README.md', 'README.zh-CN.md', 'LICENSE', 'NOTICE'];
  out.repository = { type: 'git', url: 'git+https://github.com/cnedwin/Egret_rebuild.git' };
  if (manifest.dependencies !== undefined) {
    out.dependencies = {};
    for (const [name, range] of Object.entries(manifest.dependencies)) {
      if (!String(range).startsWith('workspace:')) out.dependencies[name] = range;
      else if (!names.has(name))
        throw refuse('RELEASE_DEPENDENCY', manifest.name + ' depends on ' + name + ', which is not in the release');
      else out.dependencies[name] = baseUrl + archiveName(name, version);
    }
  }
  return out;
}
function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const item of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, item.name),
      target = path.join(to, item.name);
    if (item.isDirectory()) copyTree(source, target);
    // Maps and build records describe sources the archive does not hold.
    else if (item.isFile() && !item.name.endsWith('.map') && !item.name.endsWith('.tsbuildinfo'))
      fs.copyFileSync(source, target);
  }
}
/** Packs every package into `out`, which must not exist yet. Returns what release.json holds. */
export function packRelease({ version, out, baseUrl = releaseBaseUrl(version), npm = 'npm' }) {
  if (typeof version !== 'string' || !RELEASE_VERSION.test(version))
    throw refuse('RELEASE_VERSION', 'not a version: ' + JSON.stringify(version));
  if (typeof baseUrl !== 'string' || !/^(https:\/\/|file:\/\/\/)[^\s]*\/$/.test(baseUrl))
    throw refuse('RELEASE_BASE_URL', 'an https or file address ending in a slash is required');
  if (fs.existsSync(out)) throw refuse('RELEASE_OUT', out + ' exists already');
  const manifests = RELEASE_PACKAGES.map(directory =>
    JSON.parse(fs.readFileSync(path.join(root, 'packages', directory, 'package.json'), 'utf8'))
  );
  const names = new Set(manifests.map(manifest => manifest.name));
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-release-'));
  fs.mkdirSync(out, { recursive: true });
  const packages = [];
  try {
    RELEASE_PACKAGES.forEach((directory, index) => {
      const source = path.join(root, 'packages', directory),
        staged = path.join(stage, directory),
        manifest = manifests[index];
      if (!fs.existsSync(path.join(source, 'dist')))
        throw refuse('RELEASE_NOT_BUILT', 'packages/' + directory + '/dist is missing: run node tools/build.mjs');
      copyTree(path.join(source, 'dist'), path.join(staged, 'dist'));
      for (const file of ['README.md', 'README.zh-CN.md'])
        if (fs.existsSync(path.join(source, file))) fs.copyFileSync(path.join(source, file), path.join(staged, file));
      for (const file of ['LICENSE', 'NOTICE']) fs.copyFileSync(path.join(root, file), path.join(staged, file));
      const written = releaseManifest(manifest, version, baseUrl, names);
      // Every entry the manifest names is in the archive.
      const targets = [];
      const walk = value => {
        if (typeof value === 'string') targets.push(value);
        else if (value && typeof value === 'object') Object.values(value).forEach(walk);
      };
      walk(written.exports);
      walk(written.imports);
      for (const target of targets)
        if (!fs.existsSync(path.join(staged, target)))
          throw refuse('RELEASE_ENTRY', manifest.name + ' names ' + target + ', which was not built');
      fs.writeFileSync(path.join(staged, 'package.json'), JSON.stringify(written, null, 2) + '\n');
      const packed = spawnSync(npm, ['pack', '--ignore-scripts', '--pack-destination', out], {
        cwd: staged,
        encoding: 'utf8',
        shell: process.platform === 'win32'
      });
      const file = archiveName(manifest.name, version);
      if (packed.status !== 0 || !fs.existsSync(path.join(out, file)))
        throw refuse(
          'RELEASE_PACK',
          'packing ' + manifest.name + ' failed: ' + String(packed.stderr || packed.error).slice(0, 400)
        );
      const bytes = fs.readFileSync(path.join(out, file));
      packages.push({
        name: manifest.name,
        file,
        bytes: bytes.byteLength,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        install: baseUrl + file
      });
    });
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
  const record = { schemaVersion: 1, version, baseUrl, packages };
  fs.writeFileSync(path.join(out, 'release.json'), JSON.stringify(record, null, 2) + '\n');
  return record;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {},
    args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const key = { '--version': 'version', '--out': 'out', '--base-url': 'baseUrl' }[args[i]];
    if (key === undefined || args[i + 1] === undefined || key in options)
      throw new TypeError(
        'Usage: node tools/pack-release.mjs --version <version> --out <new directory> [--base-url <address>]'
      );
    options[key] = args[i + 1];
  }
  if (options.version === undefined || options.out === undefined)
    throw new TypeError(
      'Usage: node tools/pack-release.mjs --version <version> --out <new directory> [--base-url <address>]'
    );
  options.out = path.resolve(options.out);
  const record = packRelease(options);
  for (const item of record.packages) console.log(item.file + '  ' + item.bytes + ' bytes  sha256 ' + item.sha256);
  console.log(
    'Install the engine with: npm install ' + record.packages.find(item => item.name === '@egret/engine').install
  );
}
