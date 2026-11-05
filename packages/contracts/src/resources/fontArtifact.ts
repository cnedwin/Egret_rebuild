// SPDX-License-Identifier: Apache-2.0
/** Bounded SFNT container admission; native decoding still owns glyph/font semantics. */
export function inspectFontArtifact(bytes: Uint8Array): Readonly<{format:'truetype'|'opentype';byteLength:number;tables:number}> {
  const typed=Object.getPrototypeOf(Uint8Array.prototype) as object;
  if(Reflect.apply(Object.getOwnPropertyDescriptor(typed,Symbol.toStringTag)!.get!,bytes,[])!=='Uint8Array')throw new TypeError('FONT_ARTIFACT_STORAGE');
  const get=(name:string):unknown=>Reflect.apply(Object.getOwnPropertyDescriptor(typed,name)!.get!,bytes,[]);
  const buffer=get('buffer') as ArrayBuffer,offset=get('byteOffset') as number,length=get('byteLength') as number;
  // Reject shared/resizable/detached storage before constructing a parser view.
  Reflect.apply(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'byteLength')!.get!,buffer,[]);
  const resizable=Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable')?.get;
  if(resizable&&Reflect.apply(resizable,buffer,[]))throw new TypeError('FONT_ARTIFACT_STORAGE');
  if(length<28||length>33554432)throw new RangeError('FONT_ARTIFACT_LIMIT');
  const data=new DataView(buffer,offset,length),signature=data.getUint32(0),tables=data.getUint16(4);
  const format=signature===0x00010000?'truetype':signature===0x4f54544f?'opentype':undefined;
  if(!format||tables<1||tables>256||12+16*tables>length)throw new TypeError('FONT_ARTIFACT_HEADER');
  const tags=new Set<number>();
  for(let i=0;i<tables;i++){
    const row=12+16*i,tag=data.getUint32(row),start=data.getUint32(row+8),size=data.getUint32(row+12);
    if(tags.has(tag)||start<12+16*tables||start%4!==0||start>length||size>length-start)throw new TypeError('FONT_ARTIFACT_TABLE');
    tags.add(tag);
  }
  // These common tables are mandatory for this finite standalone-face profile.
  for(const tag of [0x68656164,0x6d617870,0x636d6170,0x68686561,0x686d7478])if(!tags.has(tag))throw new TypeError('FONT_ARTIFACT_REQUIRED_TABLE');
  if(format==='truetype'&&(!tags.has(0x676c7966)||!tags.has(0x6c6f6361)))throw new TypeError('FONT_ARTIFACT_REQUIRED_TABLE');
  if(format==='opentype'&&!tags.has(0x43464620)&&!tags.has(0x43464632))throw new TypeError('FONT_ARTIFACT_REQUIRED_TABLE');
  return Object.freeze({format,byteLength:length,tables});
}
