// SPDX-License-Identifier: Apache-2.0
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat, mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import {exportProject} from './export-project.mjs';

async function inventory(directory, prefix = '') {
  const files = [];
  const children = await readdir(directory, {withFileTypes: true});
  for (const child of children.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const name = prefix + child.name;
    const absolute = path.join(directory, child.name);
    if (child.isDirectory()) {
      files.push(...await inventory(absolute, name + '/'));
    } else if (child.isFile()) {
      const digest = createHash('sha256');
      let size = 0;
      for await (const chunk of createReadStream(absolute)) { digest.update(chunk); size += chunk.length; }
      files.push({name, size, sha256: digest.digest('hex')});
    } else {
      throw new Error('Revision contains an unexpected entry: ' + name);
    }
  }
  return files;
}

const identity = files => createHash('sha256').update(JSON.stringify(files)).digest('hex');

export async function verifyRevision(revision) {
  if (!(await lstat(revision)).isDirectory()) throw new Error('Expected a regular revision directory');
  const entries = await readdir(revision, {withFileTypes: true});
  if (entries.length !== 2 || !entries.some(entry => entry.name === 'game' && entry.isDirectory()) ||
      !entries.some(entry => entry.name === 'revision.json' && entry.isFile())) {
    throw new Error('Revision contains unowned files or unexpected directory entries');
  }
  const assets = path.join(revision, 'game');
  if (!(await lstat(assets)).isDirectory()) throw new Error('Expected a regular game directory');
  const files = await inventory(assets);
  const sha256 = identity(files);
  const receipt = JSON.parse(await readFile(path.join(revision, 'revision.json'), 'utf8'));
  if (receipt.schemaVersion !== 1 || sha256 !== path.basename(revision) || receipt.sha256 !== sha256 ||
      JSON.stringify(files) !== JSON.stringify(receipt.files)) throw new Error('Revision identity mismatch');
  return {sha256, files};
}

export async function stageRevision(project, store, esbuild) {
  store = path.resolve(store);
  await mkdir(store, {recursive: true});
  const candidate = await mkdtemp(path.join(store, '.egret-build-'));
  try {
    const game = path.join(candidate, 'game');
    await exportProject(project, game, esbuild);
    const files = await inventory(game);
    const sha256 = identity(files);
    const destination = path.join(store, sha256);
    await writeFile(path.join(candidate, 'revision.json'), JSON.stringify({schemaVersion: 1, sha256, files}, null, 2) + '\n');
    try {
      await rename(candidate, destination);
      return {path: destination, sha256, reused: false, files: files.length};
    } catch (error) {
      // Concurrent publishers may produce the same revision. Reuse only a complete,
      // byte-identical published directory. A stale receipt cannot authorize reuse.
      try { await verifyRevision(destination); }
      catch (verification) { if (verification.code === 'ENOENT') throw error; throw verification; }
      return {path: destination, sha256, reused: true, files: files.length};
    }
  } finally { await rm(candidate, {recursive: true, force: true}); }
}

/** Prune only complete revisions after every consumer of this store has stopped. */
export async function pruneRevisions(store, keep, retainCount = 2) {
  const owner = await realpath(path.resolve(store));
  if (!Number.isSafeInteger(retainCount) || retainCount < 1 || !Array.isArray(keep) || new Set(keep).size !== retainCount || keep.length !== retainCount ||
      !keep.every(id => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id))) {
    throw new Error('Supply the requested number of distinct accepted revision IDs');
  }
  for (const id of keep) await verifyRevision(path.join(owner, id));
  const candidates = [];
  for (const entry of await readdir(owner, {withFileTypes: true})) {
    if (!entry.isDirectory() || keep.includes(entry.name) || !/^[a-f0-9]{64}$/.test(entry.name)) continue;
    const candidate = path.join(owner, entry.name);
    const physical = await realpath(candidate);
    if (path.dirname(physical) !== owner || path.basename(physical) !== entry.name) {
      throw new Error('Revision is outside the store');
    }
    await verifyRevision(candidate);
    candidates.push(candidate);
  }
  for (const candidate of candidates) await rm(candidate, {recursive: true});
  return {retained: keep, removed: candidates.map(candidate => path.basename(candidate)).sort()};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const {values} = parseArgs({options: {
    prune: {type: 'boolean'}, keep: {type: 'string', multiple: true}, 'retain-count': {type:'string'},
    project: {type: 'string'}, store: {type: 'string'}, esbuild: {type: 'string'}, verify: {type: 'string'}
  }});
  if (values.prune) {
    if (!values.store || values.verify) throw new Error('Supply --prune --store and the selected --keep values');
    console.log(JSON.stringify(await pruneRevisions(values.store, values.keep, Number(values['retain-count'] ?? 2))));
  } else if (values.verify) {
    const result = await verifyRevision(path.resolve(values.verify));
    console.log(JSON.stringify({sha256: result.sha256, files: result.files.length}));
  } else {
    if (!values.project || !values.store || !values.esbuild) throw new Error('Supply --project, --store and --esbuild');
    console.log(JSON.stringify(await stageRevision(values.project, values.store, values.esbuild)));
  }
}
