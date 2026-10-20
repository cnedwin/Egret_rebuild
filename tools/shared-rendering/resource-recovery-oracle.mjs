// SPDX-License-Identifier: Apache-2.0
// Independent literal interior references and a bounded screenshot PNG reader.
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
function crc32(bytes){let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^(0xedb88320&-(value&1));}return(value^0xffffffff)>>>0;}
export function screenshotRGBA(input){
  assert.ok(Buffer.isBuffer(input)&&input.length<=4*1024*1024);assert.ok(input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  let offset=8,header,ended=false,idatStarted=false,idatEnded=false;const parts=[];
  while(offset<input.length){assert.ok(!ended&&offset+12<=input.length);const length=input.readUInt32BE(offset),type=input.toString('ascii',offset+4,offset+8);assert.ok(length<=4*1024*1024&&offset+12+length<=input.length);const data=input.subarray(offset+8,offset+8+length);assert.equal(crc32(input.subarray(offset+4,offset+8+length)),input.readUInt32BE(offset+8+length));
    if(type==='IHDR'){assert.equal(offset,8);assert.equal(length,13);assert.equal(header,undefined);header={width:data.readUInt32BE(0),height:data.readUInt32BE(4),depth:data[8],color:data[9],compression:data[10],filter:data[11],interlace:data[12]};assert.deepEqual([header.width,header.height,header.depth,header.compression,header.filter,header.interlace],[256,256,8,0,0,0]);assert.ok(header.color===2||header.color===6);}
    else if(type==='IDAT'){assert.ok(header&&!idatEnded);idatStarted=true;parts.push(data);}
    else if(type==='IEND'){assert.equal(length,0);assert.ok(idatStarted);ended=true;}
    else{assert.ok(header&&(type.charCodeAt(0)&32)!==0,'unhandled critical PNG chunk');if(idatStarted)idatEnded=true;}
    offset+=length+12;
  }
  assert.ok(ended&&offset===input.length);const bpp=header.color===6?4:3,stride=256*bpp,size=256*(stride+1),scan=inflateSync(Buffer.concat(parts),{maxOutputLength:size});assert.equal(scan.length,size);
  const decoded=Buffer.alloc(256*stride),rgba=Buffer.alloc(262144);
  function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
  for(let y=0;y<256;y++){const filter=scan[y*(stride+1)];assert.ok(filter<=4);for(let x=0;x<stride;x++){const at=y*stride+x,left=x>=bpp?decoded[at-bpp]:0,up=y?decoded[at-stride]:0,diagonal=y&&x>=bpp?decoded[at-stride-bpp]:0;let predict=0;if(filter===1)predict=left;else if(filter===2)predict=up;else if(filter===3)predict=Math.floor((left+up)/2);else if(filter===4)predict=paeth(left,up,diagonal);decoded[at]=(scan[y*(stride+1)+1+x]+predict)&255;}
    for(let x=0;x<256;x++){const source=y*stride+x*bpp,target=4*(y*256+x);for(let c=0;c<3;c++)rgba[target+c]=decoded[source+c];rgba[target+3]=bpp===4?decoded[source+3]:255;}}
  return rgba;
}
function references(catalog,row){
  assert.ok(row.kind==='scene'||row.kind==='pressure');
  if(row.kind==='pressure'){assert.ok(Array.isArray(row.pageIds)&&row.pageIds.length<=16);const allowed=new Map(catalog.pressure.map(value=>[value.id,value.rgba]));const points=row.pageIds.map((id,index)=>{assert.ok(allowed.has(id));return {id,x:(index%8)*32+16,y:Math.floor(index/8)*32+16,rgba:allowed.get(id),tolerance:1};});points.push({id:'b1',x:136,y:152,rgba:[255,0,255,255]},{id:'clear',x:248,y:248,rgba:[0,0,0,255]});return points;}
  assert.ok(row.state.variant==='a'||row.state.variant==='b');assert.ok(row.state.atlas===0||row.state.atlas===1);assert.equal(typeof row.state.interaction,'boolean');
  const variables={resource0:row.state.variant==='a'?[255,0,0,255]:[0,0,255,255],resource1:row.state.variant==='a'?[0,255,0,255]:[255,255,0,255],atlas:row.state.atlas===0?[255,0,0,255]:[0,255,0,255],interaction:row.state.interaction?[0,255,0,255]:[255,0,0,255]};
  return catalog.references.base.map(point=>({...point,rgba:point.rgba??variables[point.key]}));
}
export function compareRecoveryPixels(catalog,row,bytes){
  assert.ok(Buffer.isBuffer(bytes)&&bytes.length===262144);const samples=references(catalog,row).map(point=>{const at=4*(point.y*256+point.x),actual=[...bytes.subarray(at,at+4)],tolerance=point.tolerance??0,differences=actual.map((value,index)=>Math.abs(value-point.rgba[index]));return {id:point.id,x:point.x,y:point.y,expected:point.rgba,actual,tolerance,differences,pass:differences.every(value=>value<=tolerance)};});
  const invalidAlpha=[];for(let at=3;at<bytes.length;at+=4)if(bytes[at]!==255&&invalidAlpha.length<16)invalidAlpha.push({pixel:(at-3)/4,alpha:bytes[at]});return {samples,invalidAlpha,pass:samples.every(value=>value.pass)&&invalidAlpha.length===0};
}
