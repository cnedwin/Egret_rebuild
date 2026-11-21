// SPDX-License-Identifier: Apache-2.0
// Export the existing browser game into an Android project directory. Its level
// and rules stay in one source file, including collisions, scoring and restart.
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeWav } from '../../../packages/engine/dist/kit.js';
import { SFX_PRESETS, synthesizeSfx } from '../../../packages/engine/dist/web/playSfx.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../..');
const source = await readFile(path.join(root, 'examples/play/roll3d.mjs'));
const expected = 'cdc16b58ce7a17eca4cfad2d55cb664c786598508ff5b4d4da40cd4054d718b5';
if (createHash('sha256').update(source).digest('hex') !== expected)
  throw new Error('The Roll3D level changed. Compare its controls, assets and game rules before exporting.');
const original = source.toString('utf8');
const entry = "import { play3d } from '@egret/engine/webgl2/world3d';";
if (original.indexOf(entry) < 0 || original.indexOf(entry) !== original.lastIndexOf(entry))
  throw new Error('Expected the original Play3D import');
if (!process.argv[2] || process.argv.length !== 3) throw new Error('Usage: node prepare.mjs <new-output-directory>');
const destination = path.resolve(process.argv[2]);
try {
  await lstat(destination);
  throw new Error('Use a new output directory');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
await mkdir(path.dirname(destination), { recursive: true });
const temp = await mkdtemp(path.join(path.dirname(destination), 'roll3d-'));
try {
  // Function scope gives each opened Android view its own round variables.
  await writeFile(path.join(temp, 'level.mjs'), original.replace(entry, 'export async function runLevel(play3d) {') + '\n}\n');
  for (const file of ['main.mjs', 'hud.mjs']) await copyFile(path.join(here, file), path.join(temp, file));
  await writeFile(path.join(temp, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Roll3D</title><script src="./game.js"></script>\n');
  const assets = [];
  for (const name of ['jump', 'coin', 'win', 'lose']) {
    const file = name + '.wav';
    const wav = encodeWav([synthesizeSfx(SFX_PRESETS[name], 22050)], 22050);
    await writeFile(path.join(temp, file), new Uint8Array(wav));
    assets.push(file);
  }
  await writeFile(path.join(temp, 'project.json'), JSON.stringify({
    name: 'Roll3D', width: 960, height: 540, script: 'main.mjs', entry: 'index.html', pages: [], assets
  }, null, 2) + '\n');
  await rename(temp, destination);
} finally {
  await rm(temp, {recursive: true, force: true});
}
