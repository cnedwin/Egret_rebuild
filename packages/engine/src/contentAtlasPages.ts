// SPDX-License-Identifier: Apache-2.0
import type { SpriteSheetFrameInput } from '@egret/runtime';
import { contentFault } from './contentArtifacts.js';

export interface ContentAtlasPageArtifact {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly frames: readonly SpriteSheetFrameInput[];
}
export interface ContentAtlasPagesArtifact { readonly pages: readonly ContentAtlasPageArtifact[]; }
type RecordValue = Record<string, unknown>;
function fail(id: string): never { throw contentFault('ARTIFACT', id); }
function object(value: unknown, keys: readonly string[], id: string): RecordValue {
  if (!value || typeof value!=='object' || Array.isArray(value)) return fail(id);
  const names=Object.keys(value);
  if(names.length!==keys.length || names.some(name=>!keys.includes(name)))return fail(id);
  return value as RecordValue;
}
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value==='number' && Number.isSafeInteger(value) && !Object.is(value,-0) && value>=min && value<=max;
}
function name(value: unknown, id: string): string {
  if(typeof value!=='string'||!value.length||value.length>128||/[\p{Surrogate}\u0000-\u001f\u007f]/u.test(value))return fail(id);
  return value;
}
function canonical(value: unknown): string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  const record=value as RecordValue;
  return '{'+Object.keys(record).sort().map(key=>JSON.stringify(key)+':'+canonical(record[key])).join(',')+'}';
}
/** Artifact pages bind by dependency ordinal, never by a path or ambient name. */
export function parseAtlasPagesArtifact(text: string, id: string, dependencyCount: number): ContentAtlasPagesArtifact {
  if(typeof text!=='string'||text.length>4194304||!integer(dependencyCount,1,16))return fail(id);
  let decoded: unknown;
  try{decoded=JSON.parse(text);}catch{return fail(id);}
  const value=object(decoded,['format','pages'],id);
  if(value.format!=='egret.atlas-pages/1'||!Array.isArray(value.pages)||value.pages.length!==dependencyCount)return fail(id);
  const pages: ContentAtlasPageArtifact[]=[],pageNames=new Set<string>();let frameCount=0,nameUnits=0;
  for(let index=0;index<dependencyCount;index++){
    const page=object(value.pages[index],['name','pageDependency','width','height','frames'],id),pageName=name(page.name,id);
    if(pageNames.has(pageName)||page.pageDependency!==index||!integer(page.width,1,4096)||!integer(page.height,1,4096)||page.width*page.height>1048576
      ||!Array.isArray(page.frames)||!integer(page.frames.length,1,1024))return fail(id);
    pageNames.add(pageName);nameUnits+=pageName.length;frameCount+=page.frames.length;
    if(frameCount>8192)return fail(id);
    const names=new Set<string>(),frames: SpriteSheetFrameInput[]=[];let pageNameUnits=0;
    for(const raw of page.frames){
      const frame=object(raw,['name','x','y','width','height','layout'],id),frameName=name(frame.name,id);
      if(names.has(frameName)||!integer(frame.x,0,page.width)||!integer(frame.y,0,page.height)||!integer(frame.width,1,page.width)||!integer(frame.height,1,page.height)
        ||frame.x+frame.width>page.width||frame.y+frame.height>page.height)return fail(id);
      names.add(frameName);nameUnits+=frameName.length;pageNameUnits+=frameName.length;if(nameUnits>262144||pageNameUnits>32768)return fail(id);
      const layout=object(frame.layout,['sourceWidth','sourceHeight','trimX','trimY','packedRotation'],id);
      if(!integer(layout.sourceWidth,1,65535)||!integer(layout.sourceHeight,1,65535)||!integer(layout.trimX,0,65535)||!integer(layout.trimY,0,65535)
        ||(layout.packedRotation!==0&&layout.packedRotation!==90))return fail(id);
      const logicalWidth=layout.packedRotation===90?frame.height:frame.width,logicalHeight=layout.packedRotation===90?frame.width:frame.height;
      if(layout.trimX+logicalWidth>layout.sourceWidth||layout.trimY+logicalHeight>layout.sourceHeight)return fail(id);
      frames.push(Object.freeze({name:frameName,x:frame.x,y:frame.y,width:frame.width,height:frame.height,
        layout:Object.freeze({sourceWidth:layout.sourceWidth,sourceHeight:layout.sourceHeight,trimX:layout.trimX,trimY:layout.trimY,packedRotation:layout.packedRotation})}));
    }
    pages.push(Object.freeze({name:pageName,width:page.width,height:page.height,frames:Object.freeze(frames)}));
  }
  // Canonical producer output rejects duplicate JSON keys and numeric aliases.
  if(canonical(value)!==text)return fail(id);
  return Object.freeze({pages:Object.freeze(pages)});
}
