// SPDX-License-Identifier: Apache-2.0
// Runtime is the authoring source. Copy its literal into the engine tables without changing their module boundaries.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const authority = 'packages/runtime/src/srgbBytes.ts';
const targets = ['packages/engine/src/srgbBytes.ts', 'packages/engine/rendering/srgbBytes.ts'];
const read = file => readFileSync(path.join(root, file), 'utf8');

function literal(file, source) {
  const matches = [
    ...source.matchAll(/^const TABLE: readonly number\[\] = Object\.freeze\(\[([\dEe.,+ \t\n-]+)\]\);$/gm)
  ];
  if (matches.length !== 1) throw new Error('Expected one numeric sRGB table in ' + file);
  return matches[0];
}

function write(file, source) {
  const result = spawnSync(process.execPath, ['tools/write-repository-text.mjs', '--path', file], {
    cwd: root,
    input: source,
    stdio: ['pipe', 'inherit', 'inherit']
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Could not write sRGB copy ' + file);
}

const [mode, ...extra] = process.argv.slice(2);
if (extra.length || (mode !== '--check' && mode !== '--write')) {
  throw new TypeError('Usage: node tools/sync-srgb-byte-tables.mjs --check | --write');
}
const source = literal(authority, read(authority));
const values = JSON.parse('[' + source[1] + ']');
if (
  values.length !== 256 ||
  values[0] !== 0 ||
  values[255] !== 1 ||
  values.some((value, index) => !Number.isFinite(value) || (index > 0 && value <= values[index - 1]))
) {
  throw new Error('Expected 256 strictly increasing sRGB entries from 0 to 1 in ' + authority);
}

const changes = targets
  .map(file => {
    const current = read(file);
    const table = literal(file, current);
    const expected = current.slice(0, table.index) + source[0] + current.slice(table.index + table[0].length);
    return { file, current, expected };
  })
  .filter(({ current, expected }) => current !== expected);

if (mode === '--check' && changes.length) {
  for (const { file } of changes) console.error('Out of sync: ' + file);
  process.exitCode = 1;
} else {
  const attempted = [];
  try {
    for (const change of changes) {
      if (read(change.file) !== change.current) throw new Error('File changed while reading ' + change.file);
      attempted.push(change);
      write(change.file, change.expected);
    }
  } catch (error) {
    const rollback = [];
    for (const { file, current } of attempted.reverse()) {
      try {
        write(file, current);
      } catch (failure) {
        rollback.push(failure);
      }
    }
    if (rollback.length) throw new AggregateError([error, ...rollback], 'sRGB update and recovery failed.');
    throw error;
  }
  console.log(`sRGB copies synchronized (${changes.length} updated).`);
}
