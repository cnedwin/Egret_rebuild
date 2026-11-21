// SPDX-License-Identifier: Apache-2.0
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

// A digest of the sorted relative names and file hashes under the three source
// directories and the Spine manifest in PortedGamesEgret@7b774670.
const sourceDigest = 'e4a91586b2ce95203b2ed3181d54923abc020f5bdf312f2f910d1ad52c0f9ad5';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const maxRasterPixels = 1024 * 1024;

export async function prepareLanternAssets(gameDir, outDir, labelSources) {
  const sourceRoot = path.join(gameDir, 'assets');
  const output = path.join(outDir, 'assets');
  const files = ['manifest.json'];
  for (const dir of ['scene', 'files', 'levels']) {
    for (const name of await readdir(path.join(sourceRoot, dir))) files.push(dir + '/' + name);
  }
  const sources = new Map();
  const identity = createHash('sha256');
  for (const file of files.sort()) {
    const bytes = await readFile(path.join(sourceRoot, file));
    identity.update(file + '\0' + hash(bytes) + '\n');
    sources.set(file, bytes);
  }
  if (identity.digest('hex') !== sourceDigest)
    throw new Error('Expected the original Lantern Shadows assets at 7b774670.');
  const manifest = JSON.parse(sources.get('manifest.json'));
  const puppets = manifest.entries
    .filter((entry) => entry.resourceKind === 'spine-skeleton' || entry.importer.id === 'egret.spine-json')
    .map((entry) => entry.id.slice(2));
  if (puppets.length !== 13) throw new Error('Expected thirteen puppet rigs.');
  const maps = [],
    images = [],
    pages = [],
    assets = [];
  for (const dir of ['scene', 'files', 'levels']) await mkdir(path.join(output, dir), { recursive: true });
  for (const [file, bytes] of sources) {
    if (!/\.(png|jpg)$/.test(file)) {
      await writeFile(path.join(output, file), bytes);
      assets.push('assets/' + file);
      if (file.endsWith('.tmj')) maps.push(path.basename(file, '.tmj'));
      continue;
    }
    const id = images.length + 1;
    let destination = file;
    let png = bytes;
    if (file.endsWith('.jpg')) {
      destination = file.slice(0, -4) + '.png';
      const java = process.env.JAVA_HOME
        ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
        : 'java';
      execFileSync(
        java,
        [
          fileURLToPath(new URL('assets-jpeg.java', import.meta.url)),
          path.join(sourceRoot, file),
          path.join(output, destination)
        ],
        { stdio: 'inherit' }
      );
      png = await readFile(path.join(output, destination));
    }
    const width = png.readUInt32BE(16),
      height = png.readUInt32BE(20);
    const strips = [];
    if (width * height <= maxRasterPixels) {
      if (destination === file) await writeFile(path.join(output, destination), png);
      strips.push({ file: 'assets/' + destination, height });
    } else {
      const decoded = PNG.sync.read(png);
      const rows = Math.floor(maxRasterPixels / width);
      for (let y = 0; y < height; y += rows) {
        const count = Math.min(rows, height - y);
        const slice = decoded.data.subarray(y * width * 4, (y + count) * width * 4);
        const name = destination.slice(0, -4) + '-' + y + '.png';
        await writeFile(path.join(output, name), PNG.sync.write({ width, height: count, data: slice }));
        strips.push({ file: 'assets/' + name, height: count });
      }
    }
    // Only the combined runtime image is published. The PNG strips are inputs,
    // not independent GPU pages or subregions with different UV coordinates.
    for (const strip of strips) assets.push(strip.file);
    const picture = file.startsWith('scene/') ? path.basename(file, path.extname(file)) : undefined;
    images.push({ id, source: file, picture, width, height, strips });
  }
  await writeFile(path.join(output, 'lantern-index.json'), JSON.stringify({ puppets, maps, images }));
  assets.push('assets/lantern-index.json');
  // Pre-rasterize the game's actual Chinese labels into small reusable font pages.
  const han = new Set();
  // Use the already verified HTML and campaign source. Adding an unrelated
  // script to the checkout must not change the glyph atlas or its UVs.
  for (const source of labelSources) {
    for (const ch of source.match(/[\u3000-\u9fff\uff00-\uffef]/gu) ?? []) han.add(ch);
  }
  await writeFile(path.join(output, 'lantern-lettering.txt'), [...han].sort().join(''));
  assets.push('assets/lantern-lettering.txt');
  for (const module of ['assets.mjs', 'assets-lettering.mjs', 'overlay.mjs']) {
    await copyFile(new URL(module, import.meta.url), path.join(outDir, module));
  }
  return { pages, assets };
}
