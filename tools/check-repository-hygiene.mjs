// SPDX-License-Identifier: Apache-2.0
// Read-only publication gate: paths may be portable, but content hashes stay raw.
import { readdir, lstat, readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logicalPath, samePhysicalPath, fingerprintFile } from './lib/file-identity.mjs';

const excluded = new Set(['.superpowers','.agents','.codex','.git','work','node_modules','dist','build',
  'pnpm-store','.pnpm-store','private','raw-logs','traces','screenshots','counterexample-trees']);
const sealedVendor = new Set([
  'knowledge-base/experiments/asset-reference-probe/vendor/three/r186/build/three.core.js',
  'knowledge-base/experiments/asset-reference-probe/vendor/three/r186/build/three.module.js',
]);
const binary = new Set(['.png','.rgba','.ttf','.woff','.woff2','.bin','.zip','.jpg','.jpeg','.webp','.gif','.ico','.wasm']);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const decode = bytes => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
const visible = relative => sealedVendor.has(relative) || !relative.split('/').some(part =>
  excluded.has(part.toLowerCase()) || /^\.env(?:\.|$)/i.test(part)) && !relative.toLowerCase().endsWith('.tsbuildinfo');
const vendorAncestor = relative => [...sealedVendor].some(file => file.startsWith(relative + '/'));

/** All bytes are inspected directly; malformed required text cannot become binary. */
function textIssues(bytes) {
  const issues = [];
  if (bytes.length >= 3 && bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191) issues.push('BOM');
  if (bytes.includes(13)) issues.push('CR');
  if (bytes.includes(0)) issues.push('NUL');
  let text;
  try { text = decode(bytes); } catch { issues.push('UTF8'); }
  // Empty files are valid. Every nonempty authored text ends with exactly one LF.
  if (bytes.length && bytes.at(-1) !== 10) issues.push('FINAL_LF');
  if (text !== undefined && /\n[ \t]*\n$/.test(text)) issues.push('EXTRA_EOF_BLANK');
  return issues;
}

function rows(value, label) {
  if (!Array.isArray(value)) throw new TypeError('Missing ' + label + ' policy array');
  const result = new Map();
  for (const pin of value) {
    logicalPath(pin?.path);
    if (!Number.isSafeInteger(pin.bytes) || pin.bytes < 0 || !/^[0-9a-f]{64}$/.test(pin.sha256)
      || result.has(pin.path)) throw new TypeError('Invalid or duplicate ' + label + ' pin');
    result.set(pin.path, pin);
  }
  return result;
}

/** Validate complete cat-file framing instead of decoding arbitrary blob payloads. */
function readBlobs(git, root, entries) {
  if (!entries.length) return [];
  const result = spawnSync(git, ['cat-file','--batch'], {
    cwd: root, windowsHide: true, timeout: 60000, maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    input: Buffer.from(entries.map(entry => entry.oid).join('\n') + '\n'),
  });
  if (result.error || result.signal || result.status !== 0) throw new Error('Git blob reader failed');
  const output = result.stdout, blobs = [];
  let offset = 0;
  for (const entry of entries) {
    const end = output.indexOf(10, offset);
    if (end < 0) throw new Error('Incomplete Git blob header');
    const header = output.subarray(offset, end).toString('ascii');
    const match = /^([0-9a-f]{40,64}) blob (\d+)$/.exec(header);
    if (!match || match[1] !== entry.oid) throw new Error('Unexpected Git blob identity');
    const size = Number(match[2]);
    if (!Number.isSafeInteger(size) || size < 0 || end + size + 1 >= output.length
      || output[end + size + 1] !== 10) throw new Error('Incomplete Git blob bytes');
    blobs.push(output.subarray(end + 1, end + 1 + size));
    offset = end + size + 2;
  }
  if (offset !== output.length) throw new Error('Unconsumed Git blob output');
  return blobs;
}

export async function checkRepositoryHygiene(inputRoot, { git = 'git', committed = false } = {}) {
  const root = path.resolve(inputRoot), issues = [], files = [], known = new Map();
  let legacyPreserved = 0, stagedCompared = 0;
  const result = () => ({ files: files.length, legacyPreserved, stagedCompared, issues });
  if ((await lstat(root)).isSymbolicLink() || !samePhysicalPath(root, await realpath(root))) {
    issues.push('noncanonical repository owner'); return result();
  }
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name), relative = path.relative(root, full).replaceAll('\\','/');
      if (!visible(relative) && !vendorAncestor(relative)) continue;
      try { logicalPath(relative); } catch { issues.push('nonportable path: ' + relative); continue; }
      const key = relative.toLowerCase();
      if (known.has(key) && known.get(key) !== relative) issues.push('Windows case collision: ' + relative);
      known.set(key, relative);
      if (entry.isSymbolicLink()) { issues.push('symbolic repository path: ' + relative); continue; }
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) files.push(relative);
      else issues.push('nonregular repository path: ' + relative);
    }
  }
  await walk(root);
  let legacy, originals;
  try {
    const policy = JSON.parse(decode(await readFile(path.join(root, 'verification/repository-hygiene-baseline.json'))));
    if (policy.schemaVersion !== 1 || !/^[0-9a-f]{40}$/.test(policy.baseMain)) throw new TypeError('Invalid byte policy');
    legacy = rows(policy.legacyText, 'legacyText'); originals = rows(policy.preservedOriginals, 'preservedOriginals');
  } catch (error) { issues.push('invalid repository byte policy: ' + error.message); return result(); }
  const snapshots = new Map();
  for (const relative of files) {
    try {
      const bytes = await readFile(path.join(root, relative));
      const pin = { bytes: bytes.length, sha256: sha(bytes) };
      snapshots.set(relative, pin);
      const same = expected => expected && expected.bytes === pin.bytes && expected.sha256 === pin.sha256;
      if (originals.has(relative)) {
        if (!same(originals.get(relative))) issues.push('preserved original changed: ' + relative);
        else if (same(legacy.get(relative))) legacyPreserved++;
        continue;
      }
      if (binary.has(path.extname(relative).toLowerCase())) continue;
      if (same(legacy.get(relative))) { legacyPreserved++; continue; }
      for (const fault of textIssues(bytes)) issues.push('text ' + fault + ': ' + relative);
    } catch (error) { issues.push('unreadable repository file: ' + relative + ': ' + error.message); }
  }
  for (const relative of originals.keys()) if (!snapshots.has(relative)) issues.push('missing preserved original: ' + relative);
  try {
    const attributes = decode(await readFile(path.join(root, '.gitattributes'))).split('\n')
      .map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    if (JSON.stringify(attributes) !== JSON.stringify(['* -text'])) issues.push('raw byte .gitattributes policy differs');
    const editor = decode(await readFile(path.join(root, '.editorconfig')));
    for (const setting of ['root = true','charset = utf-8','end_of_line = lf','insert_final_newline = true']) {
      if (!editor.includes(setting)) issues.push('missing editor setting: ' + setting);
    }
  } catch { issues.push('missing repository editor/attribute policy'); }
  const run = (args, input) => {
    const outcome = spawnSync(git, args, { cwd: root, windowsHide: true, timeout: 60000,
      maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }, input });
    if (outcome.error || outcome.signal || outcome.status !== 0) throw new Error('Git inspection failed: ' + args[0]);
    return outcome.stdout;
  };
  try {
    const gitOwner=decode(run(['rev-parse','--show-toplevel'])).trim();
    if(!samePhysicalPath(root,path.resolve(gitOwner)))throw new Error('Git repository has a different explicit owner');
    if (committed && run(['status','--porcelain=v1','-z','-uall']).length) issues.push('committed snapshot requires a clean whole Git status');
    const stagedNames = new Set(decode(run(['diff','--cached','--name-only','--diff-filter=ACMR','-z'])).split('\0').filter(Boolean));
    const entries = [];
    for (const line of decode(run(['ls-files','--stage','-z'])).split('\0').filter(Boolean)) {
      const match = /^(\d+) ([0-9a-f]{40,64}) (\d+)\t(.+)$/.exec(line);
      if (!match) throw new Error('Invalid NUL Git index record');
      const relative = logicalPath(match[4]);
      if (!visible(relative)) continue;
      if (match[3] !== '0' || !['100644','100755'].includes(match[1])) { issues.push('nonregular/conflicted Git index: ' + relative); continue; }
      if (committed || stagedNames.has(relative)) entries.push({ path: relative, oid: match[2] });
    }
    const blobs = readBlobs(git, root, entries);
    for (let index = 0; index < entries.length; index++) {
      const relative = entries[index].path, blob = blobs[index];
      const current = fingerprintFile(root, relative);
      if (current.bytes !== blob.length || current.sha256 !== sha(blob)) issues.push('Git blob/working bytes differ: ' + relative);
      if (snapshots.get(relative)?.sha256 !== current.sha256) issues.push('file changed during hygiene inspection: ' + relative);
      stagedCompared++;
    }
    // Local info/attributes or nested attributes must not override byte preservation.
    const names = files.filter(relative => visible(relative));
    if (names.length) {
      const attributes = decode(run(['check-attr','-z','--stdin','text'], Buffer.from(names.join('\0') + '\0'))).split('\0');
      attributes.pop();
      if (attributes.length !== names.length * 3) throw new Error('Incomplete Git attribute observations');
      for (let index = 0; index < names.length; index++) {
        if (attributes[index * 3] !== names[index] || attributes[index * 3 + 1] !== 'text'
          || attributes[index * 3 + 2] !== 'unset') issues.push('Git text conversion enabled: ' + names[index]);
      }
    }
  } catch (error) { issues.push('Git identity check failed: ' + error.message); }
  return result();
}

if (process.argv[1] && samePhysicalPath(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.length === 1 && args[0] !== '--committed') throw new TypeError('Only --committed is supported');
  const result = await checkRepositoryHygiene(fileURLToPath(new URL('..', import.meta.url)), { committed: args.length === 1 });
  console.log(JSON.stringify(result));
  if (result.issues.length) process.exitCode = 1;
  else console.log('Repository path and raw-byte hygiene PASS.');
}
