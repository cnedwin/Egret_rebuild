// SPDX-License-Identifier: Apache-2.0
// Both arm64 archives are from the same Javet release, with matching V8 and Java APIs.
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import provenance from './v8-provenance.json' with {type: 'json'};
const {profiles, icu} = provenance;
const javet = provenance.javet.version;
const mavenCentral = [
  'https://repo.maven.apache.org/maven2/',
  'https://repo1.maven.org/maven2/',
  'https://maven-central.storage-download.googleapis.com/maven2/'
];

async function openDownload(input) {
  const failures = [];
  for (const url of input.urls ?? [input.url]) {
    let response;
    try {
      response = await fetch(url, {signal: AbortSignal.timeout(300_000)});
    } catch (error) {
      failures.push(url + ': ' + error.message);
      continue;
    }
    if (response.ok) return response;
    await response.body?.cancel();
    const failure = url + ': HTTP ' + response.status;
    if (![404, 408, 429, 500, 502, 503, 504].includes(response.status)) throw new Error(failure);
    failures.push(failure);
  }
  throw new Error('Cannot download ' + input.name + ' from its pinned sources: ' + failures.join(', '));
}

async function digest(file) {
  const hash = createHash('sha256');
  for await (const block of createReadStream(file)) hash.update(block);
  return hash.digest('hex');
}

async function pinnedFile(cache, input) {
  const target = path.join(cache, input.name);
  await mkdir(cache, {recursive: true});
  try {
    await stat(target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const temporary = target + '.' + randomUUID() + '.part';
    try {
      // A mirror may recover an unavailable endpoint. The first successful body must match the lock.
      const response = await openDownload(input);
      if (input.base64) {
        await writeFile(temporary, Buffer.from(await response.text(), 'base64'));
      } else {
        await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary, {flags: 'wx'}));
      }
      if (await digest(temporary) !== input.sha256) throw new Error('SHA-256 mismatch for ' + input.name);
      await rename(temporary, target);
      return target;
    } finally {
      await rm(temporary, {force: true});
    }
  }
  if (await digest(target) !== input.sha256) throw new Error('SHA-256 mismatch in cache: ' + target);
  return target;
}

export async function prepareV8({profile, cache, working, jar, strip, run}) {
  if (!Object.hasOwn(profiles, profile)) throw new Error('--v8-profile must be standard or trimmed');
  const {artifact, sha256} = profiles[profile];
  const name = artifact + '-' + javet + '.aar';
  const coordinate = 'com/caoccao/javet/' + artifact + '/' + javet + '/' + name;
  const aar = await pinnedFile(cache, {name, urls: mavenCentral.map(base => base + coordinate), sha256});
  const lib = 'lib' + artifact + '.v.' + javet + '.so';
  const upstreamLib = 'jni/arm64-v8a/' + lib;
  const licenses = ['LICENSE', 'LICENSE.node', 'LICENSE.v8'];
  const extracted = working('javet');
  await mkdir(extracted);
  run(jar, ['xf', aar, 'classes.jar', upstreamLib, ...licenses.map(f => 'META-INF/' + f)], {cwd: extracted});
  const entries = [];
  async function asset(from, relative) {
    await copyFile(from, working(relative));
    entries.push(relative);
  }
  for (const file of licenses) {
    await asset(path.join(extracted, 'META-INF', file), 'assets/licenses/javet-' + file);
  }
  const thirdParty = fileURLToPath(new URL('../../third-party/', import.meta.url));
  await asset(path.join(thirdParty, 'v8-15.7.112.19.NOTICES'), 'assets/licenses/v8-third-party.txt');
  if (profile === 'standard') {
    await asset(await pinnedFile(cache, icu), 'assets/icudtl.dat');
    await asset(path.join(thirdParty, 'icu-19dfb44.LICENSE'), 'assets/licenses/icu.txt');
    await writeFile(working('assets/icu-sha256.txt'), icu.sha256 + '\n');
    entries.push('assets/icu-sha256.txt');
  }
  const libraryEntry = 'lib/arm64-v8a/' + lib;
  // Maven archives retain debugging sections. Apply the same release stripping to both profiles.
  run(strip, ['--strip-unneeded', '-o', working(libraryEntry), path.join(extracted, upstreamLib)]);
  await writeFile(working('assets/v8-profile.txt'), profile + '\n');
  return {classes: path.join(extracted, 'classes.jar'), entries: [...entries, libraryEntry, 'assets/v8-profile.txt']};
}
