// SPDX-License-Identifier: Apache-2.0
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {copyFile, lstat, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

function exactKeys(obj, keys) {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj) &&
    Object.keys(obj).length === keys.length && keys.every(key => Object.hasOwn(obj, key));
}

// Pin the copy which will ship. Checking the source only can miss a concurrent replacement.
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function stageAndroidLibraries(project, manifest) {
  if (manifest === undefined) return;
  const input = path.resolve(manifest);
  const profile = JSON.parse(await readFile(input, 'utf8'));
  if (!exactKeys(profile, ['schemaVersion', 'libraries']) || profile.schemaVersion !== 1 ||
      !Array.isArray(profile.libraries) || profile.libraries.length > 128) {
    throw new Error('Expected a version 1 manifest with at most 128 local channel libraries');
  }
  const directory = path.dirname(input);
  const entries = new Set(await readdir(directory));
  const names = new Set();
  for (const library of profile.libraries) {
    if (!exactKeys(library, ['file', 'sha256']) || typeof library.file !== 'string' ||
        !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,110}\.(aar|jar)$/.test(library.file) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(library.file) ||
        typeof library.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(library.sha256)) {
      throw new Error('Expected a portable archive filename and lowercase SHA-256');
    }
    const folded = library.file.toLowerCase();
    if (names.has(folded)) throw new Error('Duplicate channel archive: ' + library.file);
    names.add(folded);
    if (!entries.has(library.file) || !(await lstat(path.join(directory, library.file))).isFile()) {
      throw new Error('Missing regular channel archive with exact name: ' + library.file);
    }
  }
  // The caller stages the entire Gradle project in a fresh directory before publishing it.
  const target = path.join(project, 'libs/channel');
  await mkdir(target, {recursive: true});
  for (const {file, sha256} of profile.libraries) {
    const copy = path.join(target, file);
    await copyFile(path.join(directory, file), copy);
    if (await digest(copy) !== sha256) throw new Error('Channel archive digest mismatch: ' + file);
  }
  await writeFile(path.join(project, 'egret-channel.json'), JSON.stringify(profile, null, 2) + '\n');
}
