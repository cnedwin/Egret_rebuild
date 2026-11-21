// SPDX-License-Identifier: Apache-2.0
import { mkdir, open, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';

function label(value, option) {
  if (!value.trim() || !value.isWellFormed() || /[\u0000-\u001f\ufffe\uffff]/u.test(value)) {
    throw new Error(option + ' requires nonempty single-line text');
  }
  return value;
}

function resourceString(value) {
  // Quoted Android resources retain spaces and literal @/? prefixes. Escape the
  // Android string syntax first, followed by the surrounding XML text syntax.
  const escaped = value.replace(/[\\"']/g, ch => '\\' + ch)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return '"' + escaped + '"';
}

async function writeIcon(source, destination) {
  const file = await open(source, 'r');
  let bytes;
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > 8 * 1024 * 1024) throw new Error('Expected a launcher PNG of at most 8 MiB');
    bytes = await file.readFile();
  } finally { await file.close(); }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature) || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('Expected a square PNG launcher icon');
  }
  const width = bytes.readUInt32BE(16);
  if (!width || width > 2048 || width !== bytes.readUInt32BE(20)) {
    throw new Error('Expected a square PNG launcher icon with edges of 1 to 2048 pixels');
  }
  // Check the pixels before committing the exported project. Distribute the
  // original PNG (including its color metadata), not a re-encoded image.
  PNG.sync.read(bytes, {checkCRC: true});
  await mkdir(path.dirname(destination), {recursive: true});
  await writeFile(destination, bytes);
}

export async function writeAppResources(work, options) {
  const defaultName = options.layout === 'embedded' ? 'Egret Game Library' : 'Egret Game';
  const name = label(options.name ?? defaultName, '--name');
  const versionName = label(options['version-name'] ?? '1.0', '--version-name');
  const code = options['version-code'] ?? '1';
  const versionCode = Number(code);
  if (!/^[1-9]\d*$/.test(code) || !Number.isInteger(versionCode) || versionCode > 2147483647) {
    throw new Error('--version-code must be an integer from 1 to 2147483647');
  }
  const res = path.join(work, 'src/main/res');
  if (options.icon !== undefined) await writeIcon(options.icon, path.join(res, 'mipmap-nodpi/egret_launcher.png'));
  const values = path.join(res, 'values');
  await mkdir(values, {recursive: true});
  await writeFile(path.join(values, 'strings.xml'), [
    '<?xml version="1.0" encoding="utf-8"?>', '<resources>',
    '    <string name="egret_app_name" formatted="false">' + resourceString(name) + '</string>',
    '</resources>', ''
  ].join('\n'));
  // Keep consumer-provided version text as data; never interpolate it into Groovy.
  await writeFile(path.join(work, 'egret-app.json'), JSON.stringify({applicationId: options.id, versionCode, versionName}, null, 2) + '\n');
}
