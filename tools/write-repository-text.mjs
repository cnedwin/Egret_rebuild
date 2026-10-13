// SPDX-License-Identifier: Apache-2.0
// Explicit authoring tool: never use it to copy or rehash original evidence.
import { readFileSync, writeFileSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalTextBytes, logicalPath, samePhysicalPath } from './lib/file-identity.mjs';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--path') throw new TypeError('Usage: node tools/write-repository-text.mjs --path <owner-relative-file> < authored-text');
const relative = logicalPath(args[1]);
const root = fileURLToPath(new URL('..', import.meta.url));
if (!samePhysicalPath(root, realpathSync(root))) throw new TypeError('Canonical repository owner required');
// Original evidence and third-party/legal files retain their original bytes.
if (/^(?:knowledge-base\/(?:evidence|experiments)\/|third-party\/)/.test(relative)
  || /(?:^|\/)(?:LICENSE|NOTICE|COPYING)(?:[.-]|$)/i.test(relative)) throw new TypeError('Preserved original paths are not text-authoring targets');
let file = root;
for (const [index, component] of relative.split('/').entries()) {
  const entries = readdirSync(file);
  const last = index === relative.split('/').length - 1;
  if (!entries.includes(component) && (!last || entries.some(name => name.toLowerCase() === component.toLowerCase()))) {
    throw new TypeError('Parent or target spelling differs from its portable identity');
  }
  file = path.join(file, component);
  try {
    const state = lstatSync(file);
    if (state.isSymbolicLink() || (last ? !state.isFile() : !state.isDirectory())) throw new TypeError('Non-regular authoring target');
  } catch (error) { if (!(last && error.code === 'ENOENT')) throw error; }
}
const input = readFileSync(0);
const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input);
writeFileSync(file, canonicalTextBytes(text));
