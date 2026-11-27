// SPDX-License-Identifier: Apache-2.0
// Stage only the named, user-supplied original release modules outside the repository.
import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {deflateSync} from 'node:zlib';

const {values} = parseArgs({options: {modules: {type: 'string'}, out: {type: 'string'}, 'nine-slice': {type: 'boolean'}, editor: {type: 'boolean'}}});
if (!values.modules || !values.out) throw new Error('Specify --modules <5.3.10 libs/modules> and --out <new directory>');
const out = path.resolve(values.out), modules = path.resolve(values.modules);
const source = fileURLToPath(new URL('.', import.meta.url));
const core = 'egret/egret.js';
if (!/Capabilities\.engineVersion\s*=\s*"5\.3\.10"/.test(await readFile(path.join(modules, core), 'utf8')))
  throw new Error('This fixture expects the original 5.3.10 debug release modules');
// The reference includes the matching web host. The shipped Android script groups never execute it.
const parts = [core, 'egret/egret.web.js', 'eui/eui.js', 'assetsmanager/assetsmanager.js', 'game/game.js'];
await mkdir(out);
for (const folder of ['assets', 'original']) await mkdir(path.join(out, folder));
for (const file of parts) await copyFile(path.join(modules, file), path.join(out, 'original', path.basename(file)));
await copyFile(path.join(source, values.editor ? 'editor.js' : values['nine-slice'] ? 'nine-slice.js' : 'board.js'), path.join(out, 'board.js'));
await copyFile(path.join(source, 'main.mjs'), path.join(out, 'main.mjs'));
const text = (name, value) => writeFile(path.join(out, name), value + '\n');
await text('index.html', '<!doctype html><meta charset="utf-8"><script src="game.js"></script>');
const html = '<!doctype html><meta charset="utf-8"><style>*{margin:0;padding:0}</style>'
  + '<div style="width:192px;height:128px" class="egret-player" data-entry-class="AtlasStation" data-orientation="auto" data-scale-mode="showAll" data-content-width="192" data-content-height="128"></div>'
  + parts.map(file => '<script src="original/' + path.basename(file) + '"></script>').join('')
  + '<script src="board.js"></script><script>egret.runEgret({renderMode:"webgl",audioType:0})</script>';
await text('reference.html', html);
if (values['nine-slice']) {
  await text('reference-fold7.html', html.replace('width:192px;height:128px', 'width:1236px;height:824px'));
}
await text('assets/station.res.json', JSON.stringify({groups: [], resources: [
  {name: 'station', type: 'image', url: 'station.png'}
]}));
await text('project.json', JSON.stringify({
  width: 192, height: 128, entry: 'index.html', pages: [],
  assets: ['assets/station.res.json', 'assets/station.png'],
  v8Scripts: {groups: {originalCore: ['original/egret.js'],
    originalModules: ['original/eui.js', 'original/assetsmanager.js', 'original/game.js'],
    originalGame: ['board.js']}}
}, null, 2));

// Generate a two-cell original PNG containing two flat colours and a one-pixel corner mark.
function chunk(name, data) {
  const bytes = Buffer.concat([Buffer.from(name), data]);
  let crc = 0xffffffff;
  for (const octet of bytes) {
    crc ^= octet;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  const size = Buffer.alloc(4), sum = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  sum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, bytes, sum]);
}
const width = 16, height = 8, header = Buffer.alloc(13), scan = Buffer.alloc(height * (1 + width * 4));
header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  let rgb = x % 8 === 0 && y === 0 ? [250,250,250] : x < 8 ? [244,162,43] : [26,194,177];
  if (values['nine-slice']) {
    const cell = v => v < 2 ? 0 : v < 6 ? 1 : 2;
    rgb = [35 + cell(x % 8) * 80, 30 + cell(y) * 70, x < 8 ? 50 : 210];
  }
  scan.set([...rgb, 255], y * (1 + width * 4) + 1 + x * 4);
}
await writeFile(path.join(out, 'assets', 'station.png'), Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scan)), chunk('IEND', Buffer.alloc(0))
]));
