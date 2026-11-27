// SPDX-License-Identifier: Apache-2.0
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'kit.json'), 'utf8'));
if (manifest.schemaVersion !== 1 || manifest.platform !== process.platform || manifest.arch !== process.arch) {
  throw new Error('Build kit platform mismatch');
}
if (process.versions.node !== manifest.node) throw new Error('Use Node ' + manifest.node);
const expected = new Map(manifest.files.map(file => [file.path, file.sha256]));
if (expected.size !== manifest.files.length) throw new Error('Duplicate build kit file');
async function visit(directory, prefix) {
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const name = prefix + entry.name;
    if (name === 'kit.json' && entry.isFile()) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(absolute, name + '/');
    else {
      if (!entry.isFile() || !expected.has(name)) throw new Error('Unexpected build kit entry: ' + name);
      const hash = createHash('sha256');
      for await (const block of createReadStream(absolute)) hash.update(block);
      if (expected.get(name) !== hash.digest('hex')) throw new Error('Build kit digest mismatch: ' + name);
      expected.delete(name);
    }
  }
}
await visit(root, '');
if (expected.size) throw new Error('Missing build kit entry: ' + expected.keys().next().value);
console.log(JSON.stringify({verifiedFiles: manifest.files.length, platform: manifest.platform}));
