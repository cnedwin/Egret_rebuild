// SPDX-License-Identifier: Apache-2.0
// Original first-party fixture, AI-assisted. No third-party images or source data.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
function crc32(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes) {
    crc^=byte;
    for(let bit=0;bit<8;bit++) crc=(crc&1)?(crc>>>1)^0xedb88320:crc>>>1;
  }
  return (crc^0xffffffff)>>>0;
}
function chunk(type,data) {
  const bytes=Buffer.alloc(data.length+12);
  bytes.writeUInt32BE(data.length,0); bytes.write(type,4,4,'ascii'); data.copy(bytes,8);
  bytes.writeUInt32BE(crc32(bytes.subarray(4,8+data.length)),8+data.length);
  return bytes;
}
function storedZlib(bytes) {
  // One uncompressed DEFLATE block gives byte-stable output across zlib versions.
  const stream=Buffer.alloc(bytes.length+11);
  stream.set([0x78,0x01,0x01],0);
  stream.writeUInt16LE(bytes.length,3); stream.writeUInt16LE((~bytes.length)&0xffff,5);
  bytes.copy(stream,7);
  let a=1,b=0;
  for(const byte of bytes) {a=(a+byte)%65521; b=(b+a)%65521;}
  stream.writeUInt32BE(((b<<16)|a)>>>0,7+bytes.length);
  return stream;
}
/** Pure, deterministic asset construction; each call owns fresh returned bytes. */
export function buildAtlasAssets() {
  const rgba=new Uint8Array([
    255,0,0,255, 0,255,0,255, 0,0,0,0, 255,255,0,255, 255,0,0,255, 0,0,0,0,
    0,0,255,255, 255,255,0,255, 0,0,0,0, 255,0,255,255, 0,255,0,255, 0,0,0,0,
    255,0,255,255, 0,255,255,255, 0,0,0,0, 0,255,255,255, 0,0,255,255, 0,0,0,0,
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
    0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
  ]);
  const header=Buffer.from([0,0,0,6,0,0,0,6,8,6,0,0,0]);
  const scanlines=Buffer.alloc(150);
  for(let row=0;row<6;row++) scanlines.set(rgba.subarray(row*24,row*24+24),row*25+1);
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',storedZlib(scanlines)),chunk('IEND',Buffer.alloc(0))]);
  const provenance={
    schemaVersion:1,asset:'atlas.png',origin:'Original first-party fixture authored for P04-TR1 with AI assistance',
    license:'Apache-2.0',thirdPartySources:[],width:6,height:6,format:'RGBA8',
    transparentBackground:[0,0,0,0],
    colors:{red:[255,0,0,255],green:[0,255,0,255],blue:[0,0,255,255],yellow:[255,255,0,255],magenta:[255,0,255,255],cyan:[0,255,255,255]},
    frames:[
      {name:'A',crop:{x:0,y:0,width:2,height:3},layout:{sourceWidth:4,sourceHeight:5,trimX:1,trimY:1,packedRotation:0},duration:.125,packedRows:[['red','green'],['blue','yellow'],['magenta','cyan']]},
      {name:'B',crop:{x:3,y:0,width:2,height:3},layout:{sourceWidth:4,sourceHeight:5,trimX:1,trimY:2,packedRotation:90},duration:.25,packedRows:[['yellow','red'],['magenta','green'],['cyan','blue']]},
    ],
    rgba:{order:'top-left row-major RGBA8, tightly packed',bytes:rgba.byteLength,sha256:sha256(rgba)},
    png:{encoding:'PNG RGBA8; filter 0; one zlib stored DEFLATE block; no ancillary chunks',bytes:png.byteLength,sha256:sha256(png)},
  };
  return {rgba,png,provenance};
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  if(process.argv.length!==2) throw new TypeError('author-assets accepts no arguments');
  const output=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../examples/trimmed-atlas-playback/assets');
  const {png,provenance}=buildAtlasAssets();
  mkdirSync(output,{recursive:true});
  writeFileSync(path.join(output,'atlas.png'),png);
  // Newly authored repository JSON must cross the shared canonical writer entry.
  const authored=spawnSync(process.execPath,[fileURLToPath(new URL('../write-repository-text.mjs',import.meta.url)),'--path','examples/trimmed-atlas-playback/assets/provenance.json'],{input:JSON.stringify(provenance,null,2)+'\n',encoding:'utf8'});
  if(authored.error) throw authored.error;
  if(authored.status!==0) throw new Error('Canonical provenance authoring failed: '+authored.stderr);
  console.log(JSON.stringify({scope:'FIRST_PARTY_ASSET_GENERATION_ONLY',output,...provenance.rgba,png:provenance.png}));
}
