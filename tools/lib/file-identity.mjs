// SPDX-License-Identifier: Apache-2.0
// Repository keys, physical spellings and raw byte identities are separate domains.
import path from 'node:path';
import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';

/** Validate a complete, case-preserving owner-relative publication key. */
export function logicalPath(value) {
  if (typeof value !== 'string' || !value || /[\\:\x00-\x1f\x7f]/.test(value)
    || value.startsWith('/') || value.split('/').some(component => !component
      || component === '.' || component === '..' || /[.\s]$/.test(component)
      || /[<>"|?*]/.test(component)
      || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(component))) {
    throw new TypeError('A canonical portable owner-relative path is required');
  }
  return value;
}

function pathAPI(platform) {
  if (platform === 'win32') return path.win32;
  // All non-Windows hosts use POSIX lexical semantics; case is never folded.
  if (typeof platform !== 'string' || !platform) throw new TypeError('A platform is required');
  return path.posix;
}

function absolute(value, platform) {
  const api = pathAPI(platform);
  if (typeof value !== 'string' || !value || /[\x00-\x1f\x7f]/.test(value)) {
    throw new TypeError('An absolute physical path is required');
  }
  if (platform === 'win32') {
    // Drive-relative/root-relative and device namespace spellings need a separate
    // authority; never silently resolve them against a process working directory.
    if (/^(?:\\\\|\/\/)[?.](?:\\|\/)/.test(value)
      || !(/^[A-Za-z]:[\\/]/.test(value) || /^(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+/.test(value))) {
      throw new TypeError('A full Windows drive or UNC owner is required');
    }
  } else if (!api.isAbsolute(value)) throw new TypeError('An absolute physical path is required');
  return api.normalize(value);
}

/** A lexical comparison key only; it does not authenticate a filesystem object. */
export function physicalPathKey(value, platform = process.platform) {
  const api = pathAPI(platform);
  let normalized = absolute(value, platform);
  const root = api.parse(normalized).root;
  while (normalized.length > root.length && normalized.endsWith(api.sep)) normalized = normalized.slice(0, -1);
  return platform === 'win32' ? normalized.replaceAll('\\', '/').toLowerCase() : normalized;
}

export function samePhysicalPath(first, second, platform = process.platform) {
  return physicalPathKey(first, platform) === physicalPathKey(second, platform);
}

/** Convert only a contained full physical filename, never a basename or alias. */
export function ownerRelativePath(owner, file, platform = process.platform) {
  const api = pathAPI(platform);
  const root = absolute(owner, platform), target = absolute(file, platform);
  const relative = api.relative(root, target);
  if (!relative || api.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + api.sep)) {
    throw new RangeError('File leaves its explicit owner or identifies the owner itself');
  }
  return logicalPath(platform === 'win32' ? relative.replaceAll('\\', '/') : relative);
}

/** Read exact bytes after checking spelling and every owner-relative component. */
export function fingerprintFile(owner, relative) {
  logicalPath(relative);
  const root = absolute(owner, process.platform);
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()
    || !samePhysicalPath(root, realpathSync(root))) throw new TypeError('A canonical physical directory owner is required');
  let current = root;
  const components = relative.split('/');
  for (let index = 0; index < components.length; index++) {
    const component = components[index];
    if (!readdirSync(current).includes(component)) throw new TypeError('File spelling differs from its portable identity: ' + relative);
    current = path.join(current, component);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || index < components.length - 1 && !stat.isDirectory()
      || index === components.length - 1 && !stat.isFile()) throw new TypeError('Non-regular or symbolic fingerprint input: ' + relative);
  }
  if (!samePhysicalPath(current, realpathSync(current))) throw new TypeError('Fingerprint input has another physical owner');
  const bytes = readFileSync(current);
  return Object.freeze({ path: relative, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}

/** Encode newly authored text only; never pass raw evidence through this writer. */
export function canonicalTextBytes(text) {
  if (typeof text !== 'string' || text.includes('\uFEFF') || text.includes('\0') || /\p{Surrogate}/u.test(text)) {
    throw new TypeError('Well-formed authored text without BOM or NUL is required');
  }
  const normalized = text.replaceAll('\r\n', '\n');
  if (normalized.includes('\r')) throw new TypeError('Bare carriage returns are not authored line endings');
  return Buffer.from(normalized === '' ? '' : normalized.replace(/\n*$/, '\n'), 'utf8');
}
