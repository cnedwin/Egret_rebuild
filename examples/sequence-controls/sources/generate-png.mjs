// SPDX-License-Identifier: Apache-2.0
// Reproduce only this original four-cell atlas. Existing different bytes are refused.
import fs from 'node:fs';
import zlib from 'node:zlib';
const colors=[[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,0,255]];
function crc(b){let n=0xffffffff;for(const v of b){n^=v;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
function chunk(kind,data){const tag=Buffer.from(kind),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);tag.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([tag,data])),data.length+8);return out;}
const header=Buffer.alloc(13);header.writeUInt32BE(4);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(Buffer.from([0,...colors.flat()]))),chunk('IEND',Buffer.alloc(0))]);

const dest=new URL('./page.png',import.meta.url);if(fs.existsSync(dest)){if(!fs.readFileSync(dest).equals(png))throw Error('Existing PNG bytes differ.');}else fs.writeFileSync(dest,png,{flag:'wx'});
