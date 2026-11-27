// SPDX-License-Identifier: Apache-2.0
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { verifyRevision } from './stage-revision.mjs';

const store = 'files/egret-dev/game';
const validDigest = /^[0-9a-f]{64}$/;
function adbFor(executable, device) {
  if (!device || !/^[\w.:-]+$/.test(device)) throw new Error('Select a connected Android device by serial.');
  return async function run(args, input) {
    const child = spawn(executable, ['-s', device, ...args], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '',
      stderr = '';
    child.stdout.setEncoding('utf8').on('data', data => {
      stdout += data;
    });
    child.stderr.setEncoding('utf8').on('data', data => {
      stderr += data;
    });
    const finished = new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', code =>
        code === 0
          ? resolve(stdout.trim())
          : reject(new Error('Android command failed: ' + (stderr.trim() || stdout.trim() || code)))
      );
    });
    // Send raw asset bytes over the selected USB transport without a shared-storage copy.
    const written = input?.pipe
      ? pipeline(input, child.stdin)
      : new Promise((resolve, reject) => {
          child.stdin.on('error', reject);
          child.stdin.end(input, resolve);
        });
    const [reply] = await Promise.all([finished, written]);
    return reply;
  };
}
/** Windows platform-tools can treat shell stdin as text (CRLF and Ctrl-Z).
 * Keep only a partial three-byte group between chunks when using Android's decoder.
 */
export async function* base64Chunks(chunks) {
  let tail = Buffer.alloc(0);
  for await (const chunk of chunks) {
    const bytes = tail.length ? Buffer.concat([tail, chunk]) : Buffer.from(chunk);
    const end = bytes.length - (bytes.length % 3);
    if (end) yield bytes.subarray(0, end).toString('base64');
    tail = Buffer.from(bytes.subarray(end));
  }
  if (tail.length) yield tail.toString('base64');
}
function appIdentity(appDirectory) {
  const config = JSON.parse(fs.readFileSync(path.join(appDirectory, 'egret-app.json'), 'utf8'));
  if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(config.applicationId))
    throw new Error('Invalid exported application ID.');
  return config.applicationId;
}
export async function syncDebug(options, run = adbFor(options.adb ?? 'adb', options.device)) {
  const packageId = appIdentity(path.resolve(options.app));
  if (Boolean(options.revision) === Boolean(options.embedded)) throw new Error('Select a revision or --embedded.');
  const pathToRevision = options.revision && path.resolve(options.revision);
  const version = pathToRevision && (await verifyRevision(pathToRevision));
  const manifest = version && Buffer.from(JSON.stringify(version.files));
  if (manifest?.length > 4 << 20) throw new Error('Development revision manifest exceeds 4 MiB.');
  if (
    version &&
    version.files.some(
      row =>
        row.name.length > 1024 ||
        !row.name.split('/').every(part => /^[A-Za-z0-9_~.-]+$/.test(part) && part !== '.' && part !== '..')
    )
  )
    throw new Error('This project contains names outside the Android asset profile.');
  const owned = (command, input) => run(['shell', '-T', 'run-as ' + packageId + " sh -c '" + command + "'"], input);
  await owned('test -f ' + store + '/format-1').catch(error => {
    throw new Error('Start the matching debuggable game once on this device. ' + error.message);
  });
  const launcher = await run(['shell', 'cmd', 'package', 'resolve-activity', '--brief', packageId]);
  const component = launcher.split(/\s+/).at(-1) ?? '';
  if (!component.startsWith(packageId + '/') || !/^[A-Za-z0-9_.$/]+$/.test(component))
    throw new Error('No game launcher Activity found.');
  const nonce = randomUUID().replaceAll('-', '');
  const temp = store + '/upload-' + nonce;
  const textTransport = process.platform === 'win32';
  let bytesSent = 0,
    transportBytes = 0,
    uploaded = 0,
    reused = 0;
  if (options.embedded) {
    await owned('rm -f ' + store + '/active');
  } else {
    await owned('mkdir -p ' + store + '/blobs ' + store + '/manifests');
    const names = await owned('ls ' + store + '/blobs');
    const existing = new Set(names.split(/\s+/).filter(name => validDigest.test(name)));
    const required = [...new Set(version.files.map(row => row.sha256))].filter(digest => existing.has(digest));
    const present = new Set();
    // Check cached bytes on the device. A damaged blob can have the expected name and size.
    // Bound each Android shell command, including when thousands of game files are present.
    for (let at = 0; at < required.length; at += 24) {
      const batch=required.slice(at,at+24);
      const paths=batch.map(digest => store + '/blobs/' + digest);
      const checks=await owned('sha256sum ' + paths.join(' '));
      for (const line of checks.split(/\r?\n/)) {
        const [digest,file]=line.trim().split(/\s+/);
        if (validDigest.test(digest) && batch.includes(digest) && file===store+'/blobs/'+digest)
          present.add(digest);
      }
    }
    async function publish(bytes, destination, digest) {
      // Publish complete, digest-verified objects. Active views keep their original file table.
      const command = textTransport ? 'base64 -d > ' : 'cat > ';
      const input = textTransport ? Readable.from(base64Chunks(bytes?.pipe ? bytes : [bytes])) : bytes;
      await owned(command + temp, input);
      const checksum = await owned('sha256sum ' + temp);
      if (checksum.split(/\s+/)[0] !== digest) throw new Error('Device payload digest differs.');
      await owned('mv -f ' + temp + ' ' + destination);
    }
    try {
      for (const row of version.files) {
        if (present.has(row.sha256)) {
          reused++;
          continue;
        }
        await publish(
          fs.createReadStream(path.join(pathToRevision, 'game', row.name)),
          store + '/blobs/' + row.sha256,
          row.sha256
        );
        present.add(row.sha256);
        bytesSent += row.size;
        transportBytes += textTransport ? 4 * Math.ceil(row.size / 3) : row.size;
        uploaded++;
      }
      await publish(manifest, store + '/manifests/' + version.sha256, version.sha256);
      await owned('cat > ' + temp, Buffer.from(version.sha256 + '\n'));
      await owned('mv -f ' + temp + ' ' + store + '/active');
    } finally {
      await owned('rm -f ' + temp).catch(() => {});
    }
  }
  const started = await run(['shell', 'am', 'start', '-S', '-W', '-n', "'" + component + "'"]);
  if (!/^Status:\s*ok\s*$/m.test(started)) throw new Error('Android launcher did not report success: ' + started);
  return {
    applicationId: packageId,
    revision: version?.sha256 ?? 'embedded',
    uploaded,
    reused,
    assetBytesSent: bytesSent,
    assetTransportBytes: transportBytes
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { values } = parseArgs({
    options: {
      app: { type: 'string' },
      device: { type: 'string' },
      adb: { type: 'string' },
      revision: { type: 'string' },
      embedded: { type: 'boolean' }
    }
  });
  if (!values.app) throw new Error('Supply --app <exported Android project> and --device <serial>.');
  console.log(JSON.stringify(await syncDebug(values)));
}
