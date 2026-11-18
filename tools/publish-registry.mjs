// SPDX-License-Identifier: Apache-2.0
// Usage: node tools/publish-registry.mjs --release <directory> [--dry-run]
// Publishes the five registry archives of a release to the public npm registry, each after those it depends on. The
// directory holds release.json and the npm-*.tgz archives as downloaded from the GitHub release. Before anything is
// published every archive is held to the size and SHA-256 that release.json records, and its manifest to the release's
// version. A package already on the registry at that version is not published again: its integrity must equal the
// archive's. After publishing, the registry's integrity of each package is read back and compared. Publishing uses the
// npm login of the person running it; with --dry-run npm only shows what it would send.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { registryArchiveName, registryTag, RELEASE_PACKAGES, RELEASE_VERSION } from './pack-release.mjs';

const refuse = (code, message) => Object.assign(new Error(code + ': ' + message), { code });

/** The package.json an archive holds. */
export function archiveManifest(file) {
  const tar = zlib.gunzipSync(fs.readFileSync(file));
  for (let at = 0; at + 512 <= tar.length; ) {
    const header = tar.subarray(at, at + 512);
    if (header.every(byte => byte === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/s, ''),
      size = parseInt(header.subarray(124, 136).toString('utf8').replace(/\0.*$/s, '').trim() || '0', 8);
    if (name === 'package/package.json') return JSON.parse(tar.subarray(at + 512, at + 512 + size).toString('utf8'));
    at += 512 + Math.ceil(size / 512) * 512;
  }
  throw refuse('REGISTRY_ARCHIVE', path.basename(file) + ' holds no package/package.json');
}

/**
 * The registry archives of the release in `directory`, each held to what release.json records. Returns, in the order
 * they are published, each package's name, version, file, tag and the integrity npm will report for it.
 */
export function checkRegistryRelease(directory) {
  const release = JSON.parse(fs.readFileSync(path.join(directory, 'release.json'), 'utf8'));
  const { version } = release;
  if (typeof version !== 'string' || !RELEASE_VERSION.test(version))
    throw refuse('REGISTRY_VERSION', 'release.json names no release version');
  const expected = RELEASE_PACKAGES.map(name => '@egret/' + name);
  const rows = release.registry ?? [];
  if (JSON.stringify(rows.map(row => row.name)) !== JSON.stringify(expected))
    throw refuse('REGISTRY_PACKAGES', 'release.json does not list the registry archives of ' + expected.join(', '));
  return rows.map(row => {
    if (row.file !== registryArchiveName(row.name, version) || row.tag !== registryTag(version))
      throw refuse('REGISTRY_RECORD', row.name + ' is recorded as ' + row.file + ' for ' + row.tag);
    const file = path.join(directory, row.file);
    if (!fs.existsSync(file)) throw refuse('REGISTRY_MISSING', row.file + ' is not in ' + directory);
    const bytes = fs.readFileSync(file);
    if (bytes.byteLength !== row.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== row.sha256)
      throw refuse('REGISTRY_DIGEST', row.file + ' is not the archive release.json records');
    const manifest = archiveManifest(file);
    if (manifest.name !== row.name || manifest.version !== version || 'private' in manifest)
      throw refuse('REGISTRY_MANIFEST', row.file + ' holds ' + manifest.name + '@' + manifest.version);
    // On the registry a package of the release names the others by its own version, never by an address.
    for (const [name, range] of Object.entries(manifest.dependencies ?? {}))
      if (expected.includes(name) && range !== version)
        throw refuse('REGISTRY_DEPENDENCY', row.file + ' names ' + name + ' as ' + range);
    const integrity = 'sha512-' + crypto.createHash('sha512').update(bytes).digest('base64');
    return { name: row.name, version, file, tag: row.tag, integrity };
  });
}

/** Runs npm and returns what it printed; with `show`, npm talks to the person directly, as for a sign-in. */
function runNpm(npm, args, show = false) {
  const result = spawnSync(npm, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: show ? 'inherit' : 'pipe'
  });
  return { ok: result.status === 0, out: String(result.stdout ?? '').trim(), err: String(result.stderr ?? '') };
}

/** The integrity the registry holds for name@version, or undefined when it has no such version. */
function publishedIntegrity(npm, name, version) {
  const seen = runNpm(npm, ['view', name + '@' + version, 'dist.integrity']);
  if (seen.ok) return seen.out || undefined;
  if (/E404|404 Not Found|is not in this registry/.test(seen.err)) return undefined;
  throw refuse('REGISTRY_VIEW', 'cannot read ' + name + '@' + version + ' from the registry: ' + seen.err.slice(-300));
}

export function publishRegistry({ release, dryRun = false, npm = 'npm' }) {
  const packages = checkRegistryRelease(release);
  if (!dryRun && !runNpm(npm, ['whoami']).ok) throw refuse('REGISTRY_LOGIN', 'run npm login first');
  const done = [];
  for (const item of packages) {
    const before = publishedIntegrity(npm, item.name, item.version);
    if (before !== undefined) {
      if (before !== item.integrity)
        throw refuse('REGISTRY_TAKEN', item.name + '@' + item.version + ' is on the registry with other bytes');
      done.push({ ...item, state: 'already published' });
      continue;
    }
    const args = ['publish', item.file, '--tag', item.tag, '--access', 'public', '--ignore-scripts'];
    if (dryRun) args.push('--dry-run');
    if (!runNpm(npm, args, true).ok) throw refuse('REGISTRY_PUBLISH', 'npm publish of ' + item.name + ' failed');
    if (!dryRun && publishedIntegrity(npm, item.name, item.version) !== item.integrity)
      throw refuse('REGISTRY_READBACK', item.name + '@' + item.version + ' does not read back as the archive');
    done.push({ ...item, state: dryRun ? 'dry run' : 'published' });
  }
  return done;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const usage = 'Usage: node tools/publish-registry.mjs --release <directory> [--dry-run]';
  const args = process.argv.slice(2),
    options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run' && !('dryRun' in options)) options.dryRun = true;
    else if (args[i] === '--release' && args[i + 1] !== undefined && !('release' in options))
      options.release = path.resolve(args[++i]);
    else throw new TypeError(usage);
  }
  if (options.release === undefined) throw new TypeError(usage);
  for (const item of publishRegistry(options))
    console.log(item.name + '@' + item.version + '  ' + item.tag + '  ' + item.state + '  ' + item.integrity);
}
