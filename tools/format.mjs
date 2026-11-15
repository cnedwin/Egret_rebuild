// SPDX-License-Identifier: Apache-2.0
// Usage: node tools/format.mjs [--check]
// Lays out the sources that biome.json names; with --check nothing is written and the exit is 1 when a file is not
// laid out. The formatter is installed apart from the workspace: npm ci --ignore-scripts --prefix tools/format
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
/** The formatter's launcher, or undefined when it has not been installed. */
export function formatterPath() {
  const file = path.join(root, 'tools/format/node_modules/@biomejs/biome/bin/biome');
  return fs.existsSync(file) ? file : undefined;
}
/** Runs the formatter over the sources: `{ status, output }`. It writes unless `check`. */
export function formatSources(check) {
  const biome = formatterPath();
  if (biome === undefined)
    return {
      status: 2,
      output: 'The formatter is not installed. Run: npm ci --ignore-scripts --prefix tools/format\n'
    };
  const run = () =>
    spawnSync(
      process.execPath,
      [biome, 'format', '.', ...(check ? [] : ['--write']), '--max-diagnostics=20', '--colors=off'],
      { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
    );
  let result = run();
  // A file that one pass leaves a line short of its final layout is finished by a second.
  if (!check && result.status === 0) result = run();
  return { status: result.status ?? 1, output: (result.stdout ?? '') + (result.stderr ?? '') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = process.argv.slice(2);
  if (options.some(option => option !== '--check') || options.length > 1)
    throw new TypeError('Usage: node tools/format.mjs [--check]');
  const result = formatSources(options.includes('--check'));
  process.stdout.write(result.output);
  process.exitCode = result.status;
}
