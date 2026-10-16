// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { WIDTH, HEIGHT, CASE_IDS, expectedRGBA, compare } from '../tools/atlas-frame/oracle.mjs';
import { buildAtlasAssets } from '../tools/atlas-frame/author-assets.mjs';

// Literal scene coordinates, hand-transcribed from the approved contract.
// A wrong placement, missing color, rotated order, or leaking background fails.
const AA = [[3,3,'R'],[4,3,'G'],[3,4,'B'],[4,4,'Y'],[3,5,'M'],[4,5,'C'],[13,3,'R'],[14,3,'G'],[13,4,'B'],[14,4,'Y'],[13,5,'M'],[14,5,'C']];
const BA = [[3,4,'R'],[4,4,'G'],[5,4,'B'],[3,5,'Y'],[4,5,'M'],[5,5,'C'],[13,3,'R'],[14,3,'G'],[13,4,'B'],[14,4,'Y'],[13,5,'M'],[14,5,'C']];
const BB = [[3,4,'R'],[4,4,'G'],[5,4,'B'],[3,5,'Y'],[4,5,'M'],[5,5,'C'],[13,4,'R'],[14,4,'G'],[15,4,'B'],[13,5,'Y'],[14,5,'M'],[15,5,'C']];
const TURN = [[0,2,'R'],[0,3,'G'],[0,4,'B'],[13,3,'R'],[14,3,'G'],[13,4,'B'],[14,4,'Y'],[13,5,'M'],[14,5,'C']];
const CLIP = [[0,2,'R'],[0,3,'G'],[13,3,'R'],[14,3,'G'],[13,4,'B'],[14,4,'Y'],[13,5,'M'],[14,5,'C']];
const SIGN = [[3,6,'Y'],[4,6,'M'],[5,6,'C'],[3,7,'R'],[4,7,'G'],[5,7,'B'],[13,3,'R'],[14,3,'G'],[13,4,'B'],[14,4,'Y'],[13,5,'M'],[14,5,'C']];
const TRIM = [[3,3,'R'],[4,3,'G'],[5,3,'B'],[3,4,'Y'],[4,4,'M'],[5,4,'C'],[13,3,'R'],[14,3,'G'],[13,4,'B'],[14,4,'Y'],[13,5,'M'],[14,5,'C']];
const cases = {N01:AA,N02:BA,N03:BA,N04:BA,N05:BA,N06:BB,N07:BA,N08:TURN,N09:CLIP,N10:BA,N11:AA,'rotation-sign:healthy':BA,'rotation-sign:assigned':SIGN,'trim-y-constant:healthy':BA,'trim-y-constant:assigned':TRIM};
const color = { R:[255,0,0,255],G:[0,255,0,255],B:[0,0,255,255],Y:[255,255,0,255],M:[255,0,255,255],C:[0,255,255,255] };
function literalRGBA(points, width=24, height=16) {
  const rgba = new Uint8Array(width*height*4);
  for (const [x,y,c] of points) rgba.set(color[c], (y*width+x)*4);
  return rgba;
}
for (const [id, points] of Object.entries(cases)) {
  test(`${id}: every literal color and all transparent channels`, () => {
    assert.equal(WIDTH,24); assert.equal(HEIGHT,16);
    const expected = expectedRGBA(id);
    assert.deepEqual(expected,literalRGBA(points));
    assert.equal(expected.filter((v,i)=>i%4===3 && v===255).length, points.length);
    assert.equal(compare(expected,id).match,true);
  });
}
test('case IDs form the closed admission set without coercion', () => {
  assert.deepEqual([...CASE_IDS],Object.keys(cases));
  for (const invalid of ['N00','savedN01','N01 ',undefined,null,{},new String('N01')]) {
    assert.throws(()=>expectedRGBA(invalid),TypeError);
    assert.throws(()=>compare(new Uint8Array(1536),invalid),TypeError);
  }
});
test('N08/N09 parent clip excludes exactly blue at (0,4)', () => {
  assert.deepEqual(Array.from(expectedRGBA('N08').slice(384,388)),[0,0,255,255]);
  assert.deepEqual(Array.from(expectedRGBA('N09').slice(384,388)),[0,0,0,0]);
  const result = compare(expectedRGBA('N08'),'N09');
  assert.equal(result.differingPixels,1); assert.equal(result.differingChannels,2);
});
test('savedN01 bytes replay as N11 after local N01 mutation', () => {
  const live = expectedRGBA('N01'); const savedN01=live.slice(); live.fill(127);
  assert.equal(compare(savedN01,'N11').match,true);
  assert.equal(compare(live,'N11').match,false);
  assert.deepEqual(expectedRGBA('N11'),literalRGBA(AA));
});
test('assigned masks cannot be accepted as any ordinary case', () => {
  for (const control of ['rotation-sign','trim-y-constant']) {
    const wrong=expectedRGBA(`${control}:assigned`);
    assert.equal(compare(wrong,`${control}:assigned`).match,true);
    for (const id of Object.keys(cases).filter(id=>id.startsWith('N'))) assert.equal(compare(wrong,id).match,false,`${control} / ${id}`);
    const rejected=compare(wrong,`${control}:healthy`);
    assert.equal(rejected.match,false);
    assert.equal(rejected.differingPixels,control==='rotation-sign'?12:9);
    assert.equal(rejected.differingChannels,control==='rotation-sign'?30:20);
  }
});
test('one background channel change is rejected and located exactly', () => {
  const actual=expectedRGBA('N01'); actual[1533]=1;
  assert.deepEqual(compare(actual,'N01'),{match:false,width:24,height:16,pixels:384,channels:1536,differingPixels:1,differingChannels:1,firstDifference:{x:23,y:15,channel:1,expected:0,actual:1}});
});
test('exact view size admits Buffer and offset view but rejects padded stride or wrong element types', () => {
  const data=literalRGBA(BA); const backing=new Uint8Array(1600); backing.fill(91); backing.set(data,32);
  assert.equal(compare(backing.subarray(32,1568),'N02').match,true);
  assert.equal(compare(Buffer.from(data),'N02').match,true);
  for (const invalid of [new Uint8Array(1535),new Uint8Array(1537),new Uint8Array(1600),new Uint16Array(768),new DataView(new ArrayBuffer(1536)),new Array(1536),{data,stride:96}]) assert.throws(()=>compare(invalid,'N02'),TypeError);
});
test('fresh expected arrays do not share mutable storage across calls or cases', () => {
  const a=expectedRGBA('N02'), b=expectedRGBA('N03');
  assert.notEqual(a.buffer,b.buffer); a.fill(78); b.fill(79);
  assert.deepEqual(expectedRGBA('N02'),literalRGBA(BA));
  assert.deepEqual(expectedRGBA('N03'),literalRGBA(BA));
});
test('authored 6x6 PNG decodes to the independent fixed RGBA and correct recorded hashes', () => {
  const {rgba,png,provenance}=buildAtlasAssets();
  const literal=literalRGBA([[0,0,'R'],[1,0,'G'],[0,1,'B'],[1,1,'Y'],[0,2,'M'],[1,2,'C'],[3,0,'Y'],[4,0,'R'],[3,1,'M'],[4,1,'G'],[3,2,'C'],[4,2,'B']],6,6);
  assert.deepEqual(rgba,literal);
  assert.deepEqual(Array.from(png.subarray(0,8)),[137,80,78,71,13,10,26,10]);
  const chunks=[]; let offset=8;
  while(offset<png.length) {
    const length=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8),payload=png.subarray(offset+8,offset+8+length);
    // Independently compute the PNG CRC using polynomial long division.
    let crc=0xffffffff;
    for(const byte of png.subarray(offset+4,offset+8+length)) { crc^=byte; for(let j=0;j<8;j++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
    assert.equal(png.readUInt32BE(offset+8+length),(crc^0xffffffff)>>>0);
    chunks.push({type,payload}); offset+=12+length;
  }
  assert.equal(offset,png.length); assert.deepEqual(chunks.map(c=>c.type),['IHDR','IDAT','IEND']);
  assert.deepEqual(Array.from(chunks[0].payload),[0,0,0,6,0,0,0,6,8,6,0,0,0]);
  const scanlines=inflateSync(chunks[1].payload),decoded=new Uint8Array(144);
  assert.equal(scanlines.length,150);
  for(let y=0;y<6;y++) { assert.equal(scanlines[y*25],0); decoded.set(scanlines.subarray(y*25+1,y*25+25),y*24); }
  assert.deepEqual(decoded,literal);
  assert.equal(provenance.rgba.bytes,144); assert.equal(provenance.png.bytes,png.length);
  assert.equal(provenance.rgba.sha256,createHash('sha256').update(literal).digest('hex'));
  assert.equal(provenance.png.sha256,createHash('sha256').update(png).digest('hex'));
  assert.equal(provenance.license,'Apache-2.0'); assert.deepEqual(provenance.thirdPartySources,[]);
  assert.deepEqual(provenance.frames,[
    {name:'A',crop:{x:0,y:0,width:2,height:3},layout:{sourceWidth:4,sourceHeight:5,trimX:1,trimY:1,packedRotation:0},duration:.125,packedRows:[['red','green'],['blue','yellow'],['magenta','cyan']]},
    {name:'B',crop:{x:3,y:0,width:2,height:3},layout:{sourceWidth:4,sourceHeight:5,trimX:1,trimY:2,packedRotation:90},duration:.25,packedRows:[['yellow','red'],['magenta','green'],['cyan','blue']]},
  ]);
  const second=buildAtlasAssets(); assert.deepEqual(second.png,png); assert.deepEqual(second.provenance,provenance);
});
