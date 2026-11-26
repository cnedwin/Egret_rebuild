// SPDX-License-Identifier: Apache-2.0
// Acquire the pinned Windows PowerShell archive once, and verify every consumer.
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { appendFile, lstat, mkdir, mkdtemp, readFile, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export const lock = JSON.parse(await readFile(new URL('./windows-pwsh-lock.json', import.meta.url), 'utf8'));
const archiveName = 'PowerShell-' + lock.version + '-win-' + lock.arch + '.zip';
if (
  lock.arch !== 'x64' ||
  lock.archive !== archiveName ||
  !/^\d+\.\d+\.\d+$/.test(lock.version) ||
  !/^[a-f0-9]{64}$/.test(lock.sha256) ||
  !Number.isSafeInteger(lock.bytes) ||
  lock.bytes <= 0 ||
  !Array.isArray(lock.urls) ||
  !lock.urls.length
)
  throw new TypeError('Invalid PowerShell lock');

function httpsSource(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new TypeError('PowerShell source must be an HTTPS URL without credentials, fragments or query');
  }
  return url.href;
}

export function sourcesFor(pin = lock, mirror) {
  const sources = [];
  // Prefer the official release. An optional managed mirror provides an independent fallback.
  sources.push({ name: 'official release', url: httpsSource(pin.urls[0]) });
  if (mirror) sources.push({ name: 'configured mirror', url: httpsSource(mirror) });
  for (const url of pin.urls.slice(1)) sources.push({ name: 'official asset API', url: httpsSource(url) });
  return sources;
}

async function fileInfo(file) {
  try {
    return await lstat(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export async function verifyArchive(file, pin = lock) {
  const info = await fileInfo(file);
  if (!info?.isFile() || info.size !== pin.bytes) return false;
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex') === pin.sha256;
}

// Do not follow a reparse point/symlink supplied as the cache directory.
async function prepareDirectory(directory) {
  await mkdir(directory, { recursive: true });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe toolchain directory');
  const actual = await realpath(directory);
  const equal =
    process.platform === 'win32'
      ? path.resolve(actual).toLowerCase() === path.resolve(directory).toLowerCase()
      : path.resolve(actual) === path.resolve(directory);
  if (!equal) throw new Error('Unsafe toolchain directory alias');
}

async function checkedFetch(url, fetcher, signal) {
  for (let redirects = 0; redirects <= 5; redirects++) {
    const target = new URL(url);
    if (target.protocol !== 'https:' || target.username || target.password) throw new Error('inadmissible redirect');
    // No bearer token, cookies or GitHub API credentials; redirects may have provider-signed query strings.
    const response = await fetcher(target, {
      signal,
      redirect: 'manual',
      credentials: 'omit',
      headers: {
        Accept: 'application/octet-stream',
        ...(target.hostname === 'api.github.com' && { 'X-GitHub-Api-Version': '2022-11-28' })
      }
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) throw new Error('redirect without location');
    url = new URL(location, target).href;
  }
  throw new Error('redirect limit exceeded');
}

async function downloadArchive(source, temporary, pin, fetcher, timeoutMs) {
  const signal = AbortSignal.timeout(timeoutMs);
  const response = await checkedFetch(source.url, fetcher, signal);
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    return {
      reason: 'HTTP ' + response.status,
      retry: response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500
    };
  }
  let bytes = 0;
  const hash = createHash('sha256');
  const limit = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      if (bytes > pin.bytes) callback(new Error('archive larger than pin'));
      else {
        hash.update(chunk);
        callback(null, chunk);
      }
    }
  });
  await pipeline(Readable.fromWeb(response.body), limit, createWriteStream(temporary, { flags: 'wx' }), { signal });
  if (bytes !== pin.bytes || hash.digest('hex') !== pin.sha256)
    return { reason: 'archive size/SHA-256 mismatch', retry: false };
  return { ok: true };
}

export async function obtainArchive(
  file,
  {
    pin = lock,
    sources = sourcesFor(pin, process.env.EGRET_PWSH_MIRROR_URL),
    fetcher = fetch,
    timeoutMs = 120_000,
    attempts = 3,
    pause = sleep,
    random = Math.random,
    log = console.log
  } = {}
) {
  await prepareDirectory(path.dirname(file));
  if (await verifyArchive(file, pin)) {
    log('PowerShell verified archive cache hit');
    return file;
  }
  const previous = await fileInfo(file);
  if (previous) {
    if (!previous.isFile()) throw new Error('Unsafe PowerShell archive cache entry');
    await unlink(file);
    log('Removed invalid PowerShell archive cache entry');
  }
  // Try every transport before retrying a transient failure on the original host.
  let remaining = sources;
  for (let attempt = 0; attempt < attempts && remaining.length; attempt++) {
    const retry = [];
    for (const source of remaining) {
      const temporary = file + '.' + randomUUID() + '.partial';
      let result;
      try {
        result = await downloadArchive(source, temporary, pin, fetcher, timeoutMs);
        if (result.ok) {
          await rename(temporary, file);
          log('PowerShell verified archive obtained from ' + source.name);
          return file;
        }
      } catch {
        result = { reason: 'network/transfer failure or timeout', retry: true };
      } finally {
        // Remove only this attempt's random, exclusive temporary file.
        await unlink(temporary).catch(error => {
          if (error.code !== 'ENOENT') throw error;
        });
      }
      log('PowerShell ' + source.name + ' attempt ' + (attempt + 1) + '/' + attempts + ': ' + result.reason);
      if (result.retry) retry.push(source);
    }
    remaining = retry;
    if (remaining.length && attempt + 1 < attempts) await pause(Math.round(1000 * 2 ** attempt + random() * 1000));
  }
  throw new Error('INFRA_TOOLCHAIN_UNAVAILABLE: all pinned PowerShell archive sources exhausted');
}

const versionCommand =
  '$PSVersionTable.PSVersion.ToString(); [System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString()';

export function exactExecutable(executable, pin = lock, spawn = spawnSync) {
  const result = spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', versionCommand], {
    encoding: 'utf8',
    timeout: 15_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return result.status === 0 && result.stdout?.trim().split(/\r?\n/).join('|') === pin.version + '|X64';
}

export async function findExactPwsh(env = process.env, spawn = spawnSync) {
  const dirs = (env.PATH ?? env.Path ?? '').split(path.delimiter);
  if (env.ProgramFiles) dirs.push(path.join(env.ProgramFiles, 'PowerShell', '7'));
  if (env.ProgramFiles) dirs.push(path.join(env.ProgramFiles, 'PowerShell', lock.version));
  // Only probe absolute locations, never implicit cwd search. Do not search the workspace tree.
  const workspace = env.GITHUB_WORKSPACE && path.resolve(env.GITHUB_WORKSPACE).toLowerCase();
  const seen = new Set();
  for (const candidate of dirs) {
    const dir = candidate.replace(/^"|"$/g, '');
    if (!path.isAbsolute(dir)) continue;
    const absolute = path.resolve(dir);
    const folded = absolute.toLowerCase();
    if (seen.has(folded) || (workspace && (folded === workspace || folded.startsWith(workspace + path.sep)))) continue;
    seen.add(folded);
    const executable = path.join(absolute, 'pwsh.exe');
    if (!(await fileInfo(executable))?.isFile()) continue;
    const actual = await realpath(executable);
    if (workspace && actual.toLowerCase().startsWith(workspace + path.sep)) continue;
    if (exactExecutable(actual, lock, spawn)) return actual;
  }
  return null;
}

async function expose(executable, env) {
  if (env.GITHUB_PATH) await appendFile(env.GITHUB_PATH, path.dirname(executable) + '\n', 'utf8');
  console.log('PowerShell ' + lock.version + ' (x64) verified');
}

export async function installArchive(file, directory, env = process.env) {
  if (!(await verifyArchive(file))) throw new Error('PowerShell archive failed pinned size/SHA-256 verification');
  await prepareDirectory(directory);
  const target = await mkdtemp(path.join(directory, 'pwsh-' + lock.version + '-'));
  const tar = path.join(env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  // Extract only the known release bytes into a newly created directory; never reuse stale binaries.
  const extracted = spawnSync(tar, ['-xf', file, '-C', target], {
    timeout: 120_000,
    windowsHide: true,
    stdio: 'ignore'
  });
  if (extracted.status !== 0) throw new Error('PowerShell archive extraction failed');
  const executable = path.join(target, 'pwsh.exe');
  if (!(await fileInfo(executable))?.isFile() || !exactExecutable(executable))
    throw new Error('Extracted PowerShell version/architecture mismatch');
  await expose(executable, env);
  return executable;
}

async function main(mode, env = process.env) {
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw new Error('This toolchain preparer requires Windows x64');
  if (!env.RUNNER_TEMP || !path.isAbsolute(env.RUNNER_TEMP)) throw new Error('RUNNER_TEMP must be absolute');
  const cache = path.join(env.RUNNER_TEMP, 'egret-pwsh-archive', lock.archive);
  if (mode === 'prepare') await obtainArchive(cache);
  else if (mode === 'probe' || mode === 'install') {
    const existing = await findExactPwsh(env);
    if (existing) await expose(existing, env);
    if (mode === 'probe') {
      if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, 'ready=' + Boolean(existing) + '\n', 'utf8');
      if (!existing) console.log('Exact preinstalled PowerShell not found');
    } else if (!existing) await installArchive(cache, env.RUNNER_TEMP, env);
  } else throw new TypeError('Usage: node tools/windows-pwsh.mjs prepare|probe|install');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  // Only log errors we own; do not echo remote responses, signed URLs or credentials.
  main(process.argv[2]).catch(error => {
    console.error(
      'PowerShell toolchain preparation failed: ' +
        (error.message.startsWith('INFRA_TOOLCHAIN_UNAVAILABLE')
          ? error.message
          : error.code ||
            (error instanceof TypeError ? 'invalid toolchain configuration' : 'verification or installation failure'))
    );
    process.exitCode = 1;
  });
}
