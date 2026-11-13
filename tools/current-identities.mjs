// SPDX-License-Identifier: Apache-2.0
// The identity of every product source and emitted file as it stands, and which saved evidence
// was recorded under a different identity. This reports; it never refuses a change.
// Usage: node tools/current-identities.mjs [--write] [--json]
//   (no option)  print which evidence files record identities that are no longer current
//   --json       print the same report as JSON
//   --write      write current-identities.json (ignored by Git) and print its digest; needs a build
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const IDENTITY_TABLE = 'current-identities.json';
/** A source or emitted file of a package: the files whose bytes no longer gate a change. */
export const PRODUCT_PATH = /^packages\/[^/]+\/(?:src|dist|web|rendering)\//;
const EVIDENCE_ROOTS = ['examples', 'verification', 'knowledge-base/evidence'];

function identity(root, relative) {
  const raw = fs.readFileSync(path.join(root, relative));
  return { path: relative, bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') };
}
function files(root, relative, accept, found = []) {
  const directory = path.join(root, relative);
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const child = relative + '/' + entry.name;
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') files(root, child, accept, found); }
    else if (entry.isFile() && accept(child)) found.push(child);
  }
  return found;
}

/** Every product source and emitted file, by path. Emitted files exist only after a build. */
export function currentIdentities(root) {
  const packages = path.join(root, 'packages'), rows = [];
  for (const name of fs.readdirSync(packages).sort()) {
    for (const part of ['src', 'dist', 'web', 'rendering']) for (const file of files(root, 'packages/' + name + '/' + part, () => true)) rows.push(identity(root, file));
  }
  return { schemaVersion: 1, kind: 'egret.current-identities/1', files: rows.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) };
}

function recorded(value, rows) {
  if (Array.isArray(value)) for (const item of value) recorded(item, rows);
  else if (value !== null && typeof value === 'object') {
    if (typeof value.path === 'string' && PRODUCT_PATH.test(value.path) && Number.isSafeInteger(value.bytes) && typeof value.sha256 === 'string') rows.push(value);
    for (const key of Object.keys(value)) recorded(value[key], rows);
  }
  return rows;
}

/**
 * For each evidence file that records product identities: how many it records and which of them
 * differ from the file as it stands or name a file that is gone. Evidence that records an old
 * identity was true of that identity; it says nothing about the current bytes until it is renewed.
 */
export function evidenceFreshness(root) {
  const current = new Map(), report = [];
  const now = relative => {
    if (!current.has(relative)) current.set(relative, fs.existsSync(path.join(root, relative)) ? identity(root, relative) : null);
    return current.get(relative);
  };
  for (const base of EVIDENCE_ROOTS) for (const file of files(root, base, name => name.endsWith('.json') && !name.includes('/vendor/'))) {
    let value;
    try { value = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); } catch { continue; }
    const rows = recorded(value, []);
    if (rows.length === 0) continue;
    const changed = new Set(), missing = new Set();
    for (const row of rows) {
      const actual = now(row.path);
      if (actual === null) missing.add(row.path);
      else if (actual.bytes !== row.bytes || actual.sha256 !== row.sha256) changed.add(row.path);
    }
    report.push({ evidence: file, recorded: new Set(rows.map(row => row.path)).size, changed: [...changed].sort(), missing: [...missing].sort() });
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = process.argv.slice(2), root = fileURLToPath(new URL('..', import.meta.url));
  if (options.length > 1 || options.some(option => !['--write', '--json'].includes(option))) throw new TypeError('Usage: node tools/current-identities.mjs [--write] [--json]');
  if (options[0] === '--write') {
    const table = currentIdentities(root);
    const text = JSON.stringify(table, null, 1) + '\n';
    fs.writeFileSync(path.join(root, IDENTITY_TABLE), text);
    // One value names the whole product as built here; evidence can record it beside the commit.
    console.log('Wrote ' + IDENTITY_TABLE + ': ' + table.files.length + ' files, sha256 ' + createHash('sha256').update(text).digest('hex') + '.');
  } else {
    const report = evidenceFreshness(root), stale = report.filter(row => row.changed.length + row.missing.length > 0);
    if (options[0] === '--json') console.log(JSON.stringify(report, null, 1));
    else {
      for (const row of stale) console.log(row.evidence + ': ' + row.changed.length + ' of ' + row.recorded + ' recorded files changed' + (row.missing.length ? ', ' + row.missing.length + ' gone' : ''));
      console.log(stale.length + ' of ' + report.length + ' evidence files record identities that are no longer current. This is a report, not a refusal.');
    }
  }
}
