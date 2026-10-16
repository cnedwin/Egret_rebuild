// SPDX-License-Identifier: Apache-2.0
import { createImageData2D } from '@egret/engine';
const PNG_SHA='35a3ecea0d79c5684d17a5dbfa56bf0cc5ebf52a34f6e8ceafe740c742a1437f';
const COLORS={R:[255,0,0,255],G:[0,255,0,255],B:[0,0,255,255],Y:[255,255,0,255],M:[255,0,255,255],C:[0,255,255,255]};
export async function decodeAtlasPng() {
  const response=await fetch(new URL('./assets/atlas.png',import.meta.url));
  if(!response.ok)throw new Error('Original atlas HTTP failed');
  const bytes=new Uint8Array(await response.arrayBuffer());
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
  if(bytes.byteLength!==218||sha256!==PNG_SHA)throw new Error('Original atlas raw bytes differ');
  const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
  const canvas=document.createElement('canvas');canvas.width=6;canvas.height=6;
  try {
    if(bitmap.width!==6||bitmap.height!==6)throw new Error('Original PNG dimensions differ');
    const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('PNG decode Canvas unavailable');
    context.drawImage(bitmap,0,0);
    const pixels=new Uint8Array(context.getImageData(0,0,6,6).data);
    const expected=new Uint8Array(144);
    for(const [x,rows] of [[0,['RG','BY','MC']],[3,['YR','MG','CB']]])
      for(let y=0;y<3;y++)for(let dx=0;dx<2;dx++)expected.set(COLORS[rows[y][dx]],((y*6)+x+dx)*4);
    if(!pixels.every((value,index)=>value===expected[index]))throw new Error('Complete decoded original RGBA differs');
    return {image:createImageData2D({width:6,height:6,pixels}),evidence:{bytes:bytes.length,sha256,width:6,height:6,
      decoder:'createImageBitmap+Canvas2D',decodedRGBA:Array.from(pixels)}};
  } finally {bitmap.close();canvas.width=0;canvas.height=0;}
}
