// SPDX-License-Identifier: Apache-2.0
// Authoring-only first-party C assets. Root runs this before the source freeze.
// It imports no SDK and does not build/admit a manifest itself.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1)); }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const name = Buffer.from(type), result = Buffer.alloc(bytes.length + 12);
  result.writeUInt32BE(bytes.length); name.copy(result, 4); bytes.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, bytes])), bytes.length + 8); return result;
}
function png(width, height, pixel) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const scan = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const color = pixel(x, y), offset = y * (width * 4 + 1) + 1 + x * 4;
    for (let channel = 0; channel < 4; channel++) scan[offset + channel] = color[channel];
  }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scan, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
export function authorRecoveryAssets(output) {
  assert.ok(path.isAbsolute(output)); assert.ok(!fs.existsSync(output), 'fresh asset owner required');
  fs.mkdirSync(output); fs.mkdirSync(path.join(output, 'sources')); fs.mkdirSync(path.join(output, 'assets'));
  const definitions = [
    ['a0',32,32,()=>[255,0,0,255]], ['a1',32,32,()=>[0,255,0,255]],
    ['b0',32,32,()=>[0,0,255,255]], ['b1',32,32,()=>[255,255,0,255]],
    ['atlas',64,32,x=>x<32?[255,0,0,255]:[0,255,0,255]], ['white',1,1,()=>[255,255,255,255]],
    ...Array.from({ length: 40 }, (_, index) => ['p'+String(index).padStart(2,'0'),512,512,()=>[index*5+20,240-index*4,80,255]]),
  ];
  const entries = [], files = [], pins = [];
  for (const [name,width,height,pixel] of definitions) {
    const body = png(width,height,pixel);
    for (const [role,directory] of [['source','sources'],['asset','assets']]) {
      const file = { id: 'f_'+role+'_'+name, path: directory+'/'+name+'.png', role, mediaType: 'image/png', sha256: hash(body), byteLength: body.length };
      fs.writeFileSync(path.join(output,file.path),body,{flag:'wx'}); files.push(file); pins.push({path:file.path,bytes:body.length,sha256:file.sha256});
    }
    entries.push({ id:'e_'+name, resourceKind:'image', source:files.at(-2), artifact:files.at(-1), importer:{id:'egret.copy',version:'1.0.0'},
      settings:{canonicalWidth:width,canonicalHeight:height}, artifactFormatVersion:'png/1', targetProfile:'web-shared/1', dependencies:[], provenance:{license:'Apache-2.0',origin:'first-party'} });
  }
  const versions={engineVersion:'0.0.0',resourceFormatVersion:'1.0',toolProtocolVersion:'1.0'};
  const project={projectSchemaVersion:'1.0',projectId:'p_m15_native',revision:0,name:'M1.5 native first-party fixtures',versions,roots:entries.map(row=>row.id),
    entities:entries.map(row=>({id:row.id,kind:'egret.resource',dataSchemaVersion:'1',name:row.id,data:{resourceKind:row.resourceKind,sourceFileId:row.source.id,artifactFileId:row.artifact.id,
      importer:row.importer,settings:row.settings,artifactFormatVersion:row.artifactFormatVersion,targetProfile:row.targetProfile,dependencies:[],provenance:row.provenance},
      references:[{slot:'source',target:'file',id:row.source.id,expectedRole:'source'},{slot:'artifact',target:'file',id:row.artifact.id,expectedRole:'asset'}]})),files,retiredEntityIds:[],retiredFileIds:[]};
  const catalog={schemaVersion:1,width:256,height:256,profile:'egret.shared-frame2d/1',
    policy:{cycles:100,losses:10,foregroundMs:1800000,slotMs:15000,slots:120,networkMbps:10,latencyMs:80,coldTargetMs:5000,retainedTargetMs:2000,reloadTargetMs:5000,
      maxJsGzipBytes:1048576,maxInitialAssetBytes:4194304,maxDecodedCpuBytes:134217728,maxReadyBytes:33554432,maxReadyEntries:256,maxReusableBytes:33554432,maxInFlightUploadBytes:67108864,maxTemporaryBytes:33554432},
    cycleOrder:['replace','cancel-before-fetch','cancel-native-decode','cancel-native-upload','binding-conflict'],
    slots:Array.from({length:120},(_,index)=>{if(index>=110)return {index,atMs:index*15000,kind:'interaction'};const within=index%11,round=Math.floor(index/11);
      return within===10?{index,atMs:index*15000,kind:'loss',lossIndex:round,reload:round%2===1}:{index,atMs:index*15000,kind:'cycle',cycleIndex:round*10+within,mode:['replace','cancel-before-fetch','cancel-native-decode','cancel-native-upload','binding-conflict'][(round*10+within)%5]};}),
    variants:{a:['e_a0','e_a1'],b:['e_b0','e_b1']},pressure:Array.from({length:40},(_,index)=>({id:'e_p'+String(index).padStart(2,'0'),rgba:[index*5+20,240-index*4,80,255]})),
    references:{base:[{id:'resource-0',x:24,y:24,key:'resource0'},{id:'resource-1',x:72,y:24,key:'resource1'},
      {id:'mesh',x:136,y:24,rgba:[0,255,255,255]},{id:'atlas',x:200,y:24,key:'atlas'},
      {id:'clip-inside',x:24,y:88,rgba:[0,0,255,255]},{id:'clip-outside',x:64,y:88,rgba:[0,0,0,255]},
      {id:'transparent-order',x:120,y:88,rgba:[188,0,188,255],tolerance:1},{id:'b1',x:136,y:152,rgba:[255,0,255,255]},
      {id:'text-block',x:18,y:212,rgba:[255,255,255,255]},{id:'text-space',x:38,y:212,rgba:[0,0,0,255]},
      {id:'interaction',x:208,y:216,key:'interaction'},{id:'clear',x:248,y:248,rgba:[0,0,0,255]}]},
    independentOracle:'Literal interior colors from authored PNGs and geometry. Linear source-over red 0.5 over opaque blue is (0.5,0,0.5); fixed shared sRGB encoding quantizes to (188,0,188), tolerance 1. Ahem X is the retained geometric block font; text metrics and interior block/space are separate from untested anti-aliasing boundaries.',
    inputs:pins};
  for(const [name,value]of[['project.json',project],['catalog.json',catalog],['asset-pins.json',{schemaVersion:1,inputs:pins}]])fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  return {output,entries:entries.length,artifactCount:definitions.length,decodedPressureBytes:40*512*512*4};
}
// Root invokes this exact module with one fresh absolute output directory.
if(process.argv.length===3)authorRecoveryAssets(path.resolve(process.argv[2]));
