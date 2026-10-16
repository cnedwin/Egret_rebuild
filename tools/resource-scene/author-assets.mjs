// SPDX-License-Identifier: Apache-2.0
// Reproducible literal art for the resource scene; never downloads or rewrites upstream originals.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { logicalPath, ownerRelativePath, samePhysicalPath, fingerprintFile, canonicalTextBytes } from '../lib/file-identity.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const argv = process.argv.slice(2);
if (argv.length > 1 || argv.length === 1 && argv[0] !== '--check') throw new TypeError('Use no arguments or --check');
const checkOnly = argv.length === 1;
const fail = message => { throw new Error('RESOURCE_SCENE_ASSET: ' + message); };
const sha = value => createHash('sha256').update(value).digest('hex');
const assetPrefix = 'examples/resource-scene/assets/';
const sourcePath = 'tools/resource-scene/author-assets.mjs';
const sourcePin = fingerprintFile(root, sourcePath);
if (!samePhysicalPath(fileURLToPath(import.meta.url), path.join(root, sourcePath))) fail('Generator owner differs');
if (!checkOnly) {
  const writerPin=fingerprintFile(root,'tools/write-repository-text.mjs');
  if(writerPin.bytes!==1939 || writerPin.sha256!=='2bad1f563a59b4c0ab51cd85683198b2ca16af136d86cf99e1ddd52422e818ef') fail('Canonical writer identity differs');
}
for (const [index, component] of ['examples', 'resource-scene', 'assets'].entries()) {
  const relative = ['examples', 'resource-scene', 'assets'].slice(0, index + 1).join('/');
  const absolute = path.join(root, relative);
  logicalPath(relative);
  if (!fs.existsSync(absolute)) {
    if (checkOnly) fail('Missing authored directory: ' + relative);
    fs.mkdirSync(absolute);
  }
  const stat = fs.lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink() || !samePhysicalPath(absolute, fs.realpathSync(absolute))
    || ownerRelativePath(root, absolute) !== relative) fail('Directory leaves its exact repository owner');
}

// PNG uses standard CRC-32 and zlib framing; decoded art is verified independently.
function crc32(raw) {
  let crc = 0xffffffff;
  for (const byte of raw) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, raw) {
  const tag = Buffer.from(type, 'ascii'), size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(raw.length); checksum.writeUInt32BE(crc32(Buffer.concat([tag, raw])));
  return Buffer.concat([size, tag, raw, checksum]);
}
function encode(width, height, rgba) {
  if (rgba.length !== width * height * 4) fail('Literal RGBA length');
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function paint(rgba, width, x, y, w, h, color) {
  for (let row = y; row < y + h; row++) for (let column = x; column < x + w; column++) {
    rgba.set(color, (row * width + column) * 4);
  }
}
function atlas(cyan) {
  const rgba = Buffer.alloc(32 * 16 * 4), head = cyan ? [0,255,255,255] : [255,192,128,255];
  for (let pose = 0; pose < 2; pose++) {
    const offset = pose * 16;
    paint(rgba, 32, offset + 5, 1, 6, 4, head);
    paint(rgba, 32, offset + 4, 5, 8, 6, [192,192,192,255]);
    for (const x of [6,9]) paint(rgba, 32, offset + x, 2, 1, 1, [32,32,32,255]);
    for (const x of pose === 0 ? [4,9] : [5,8]) paint(rgba, 32, offset + x, 11, 3, 4, [32,32,32,255]);
  }
  return encode(32, 16, rgba);
}
function outfit(color) {
  const rgba = Buffer.alloc(16 * 16 * 4);
  paint(rgba, 16, 5, 6, 6, 4, color);
  return encode(16, 16, rgba);
}
const encoded = new Map([
  ['atlas-v1.png', atlas(false)], ['atlas-v2.png', atlas(true)],
  ['outfit-A.png', outfit([255,0,0,255])], ['outfit-B.png', outfit([0,255,0,255])],
  ['outfit-C.png', outfit([0,0,255,255])], ['outfit-D.png', outfit([255,255,0,255])],
]);
const originalInputs = [
  {path:'tools/browser-png/assets/rgb-red-green.png',bytes:72,sha256:'917780f34b6e830eceb3a99e7c5794af705f16193ba8b2d415c86b24aa0cc78d',
    origin:'retained-first-party',rights:'Apache-2.0; original encoded badge fixture, reused without regeneration.'},
  {path:'examples/canvas-text/assets/ahem.ttf',bytes:22572,sha256:'f0a92cd0cc45735591c9b5b1fa8aecd5194e8dc518895ca22af94a46c23550dc',
    origin:'retained-upstream',rights:'Public domain; original Creative Commons Zero fallback in Ahem-COPYING.txt, without assigning a different SPDX version.',
    originalURL:'https://www.w3.org/Style/CSS/Test/Fonts/Ahem/ahem.ttf'},
  {path:'examples/canvas-text/assets/Ahem-README.txt',bytes:2456,sha256:'e5314468f94f7d9caf62bd8f6871ebf81c96827254043dac95814c943852d40e',
    origin:'retained-upstream',rights:'Original Ahem documentation retained unchanged with its copyright and rights record.',
    originalURL:'https://www.w3.org/Style/CSS/Test/Fonts/Ahem/README'},
  {path:'examples/canvas-text/assets/Ahem-COPYING.txt',bytes:1928,sha256:'3100f58a80de8fcd9dee4280dc4e52a45cc25a2084006e6b8fb5750708a388f8',
    origin:'retained-upstream',rights:'Original public-domain and Creative Commons Zero fallback declaration; unchanged legal original.',
    originalURL:'https://www.w3.org/Style/CSS/Test/Fonts/Ahem/COPYING'},
  {path:assetPrefix+'NotoSansSC-fixed.woff2',bytes:1796,sha256:'9e435555e47102d40ace35211158051b45c131bce1fc7c1daca871b2386ec895',
    origin:'retained-upstream',rights:"OFL-1.1; Copyright 2014-2021 Adobe, reserved name Source. Original publisher-provided Noto Sans SC normal-400 subset; no local conversion.",
    originalURL:'https://fonts.gstatic.com/l/font?kit=k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYlVe9Q3Qtesf4SJmOwP43a3q8b8OtU&skey=cf0bb10b5602fdc3&v=v41'},
  {path:assetPrefix+'NotoSansSC.source.css',bytes:348,sha256:'afa8bcf0f8a6d2e5b13ed4912a26083371abaad6163bbc564e6e3d88a83a24ed',
    origin:'retained-upstream',rights:'Unmodified publisher response retained as retrieval provenance. It is not an Egret-authored stylesheet and is not applied by the example.',
    originalURL:'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400&text=%E5%B7%A6%E5%8F%B3%E4%BE%A7%E5%B7%B2%E9%80%89%E6%8B%A9%20&display=block'},
  {path:assetPrefix+'NotoSansSC-OFL.txt',bytes:4388,sha256:'1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9',
    origin:'retained-upstream',rights:'OFL-1.1; original upstream copyright and license, retained without text normalization.',
    originalURL:'https://raw.githubusercontent.com/google/fonts/2894aab31764f10f29c421bdfd2340d3b382d384/ofl/notosanssc/OFL.txt'},
];
for (const row of originalInputs) {
  const actual = fingerprintFile(root, row.path);
  if (actual.bytes !== row.bytes || actual.sha256 !== row.sha256) fail('Retained original differs: ' + row.path);
}
const records = [...encoded].map(([name, raw]) => ({path:assetPrefix+name,bytes:raw.length,sha256:sha(raw),
  origin:'first-party',license:'Apache-2.0',generator:sourcePin,width:name.startsWith('atlas-')?32:16,
  height:16,bitDepth:8,colorType:6,interlace:0}));
const provenance = canonicalTextBytes(JSON.stringify({schemaVersion:1,artifact:'egret-resource-scene-assets',
  records,reused:originalInputs,encoding:'RGBA8 noninterlaced PNG, transparent black, filter 0, Node standard-library zlib level 9.',
  acceptance:'Encoded identity and independent literal art checks are separate from actual browser decoding, font glyphs, rendering and performance.'},null,2));
const provenanceKey = assetPrefix+'provenance.json';
const all = [...encoded].map(([name,raw])=>[assetPrefix+name,raw]).concat([[provenanceKey,provenance]]);
// Refuse a changed existing output before writing any missing one.
for (const [key,raw] of all) {
  logicalPath(key); const absolute = path.join(root,key);
  if (fs.existsSync(absolute)) {
    fingerprintFile(root,key);
    if (!fs.readFileSync(absolute).equals(raw)) fail('Existing authored output differs: ' + key);
  } else if (checkOnly) fail('Missing authored output: ' + key);
}
if (!checkOnly) {
  for (const [key,raw] of all) if (key !== provenanceKey && !fs.existsSync(path.join(root,key))) {
    fs.writeFileSync(path.join(root,key),raw,{flag:'wx'});
  }
  if (!fs.existsSync(path.join(root,provenanceKey))) {
    const result=spawnSync(process.execPath,['tools/write-repository-text.mjs','--path',provenanceKey],{
      cwd:root,input:provenance,windowsHide:true,timeout:30000,maxBuffer:1048576});
    if(result.error||result.signal!==null||result.status!==0)fail('Canonical provenance authoring failed');
  }
}
for(const [key,raw]of all) {
  const actual=fingerprintFile(root,key);
  if(actual.bytes!==raw.length||actual.sha256!==sha(raw))fail('Final authored readback differs: '+key);
}
console.log(JSON.stringify({status:checkOnly?'RESOURCE_SCENE_ASSETS_CHECKED':'RESOURCE_SCENE_ASSETS_AUTHORED',
  pngFiles:records.length,originalFiles:originalInputs.length,files:all.map(([key])=>fingerprintFile(root,key)),
  nativeDecode:'NOT_RUN',fontGlyphs:'NOT_RUN',rendering:'NOT_RUN',performance:'NOT_MEASURED'}));
