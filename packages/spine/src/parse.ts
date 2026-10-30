// SPDX-License-Identifier: Apache-2.0
// Official Core owns format semantics; this adapter owns admission and copied metadata.
import * as Core from '@esotericsoftware/spine-core';
import { AssetLease, Texture } from '@egret/engine';
import type { SpineAssetInfo, SpinePageInfo } from './types.js';
import { spineFault } from './catalog.js';
import { readSpineJson } from './jsonAdmission.js';

const APPLY=Reflect.apply;
const LEASE_VALUE=Object.getOwnPropertyDescriptor(AssetLease.prototype,'value')!.get!;
const WIDTH=Object.getOwnPropertyDescriptor(Texture.prototype,'width')!.get!;
const HEIGHT=Object.getOwnPropertyDescriptor(Texture.prototype,'height')!.get!;
const IMAGE=Object.getOwnPropertyDescriptor(Texture.prototype,'imageData')!.get!;
const RECT=Object.getOwnPropertyDescriptor(Texture.prototype,'sourceRect')!.get!;
const VIEW=Object.getOwnPropertyDescriptor(Texture.prototype,'viewRegion')!.get!;
export interface ParsedSpineSetup { readonly data: Core.SkeletonData; readonly atlas: Core.TextureAtlas; readonly info: SpineAssetInfo; }
function integer(v: number,min: number,max: number): boolean{return Number.isSafeInteger(v)&&v>=min&&v<=max;}
function label(v: string): boolean{return typeof v==='string'&&v.length>0&&v.length<=255&&!/[\p{Surrogate}\u0000-\u001f\u007f]/u.test(v);}
/** Dimension-only Core texture: no native renderer or ownership of the borrowed lease. */
class PageTexture extends Core.Texture {
  constructor(width:number,height:number){super(Object.freeze({width,height}));}
  override setFilters(_min:Core.TextureFilter,_mag:Core.TextureFilter): void {}
  override setWraps(_u:Core.TextureWrap,_v:Core.TextureWrap): void {}
  override dispose(): void {}
}
export function parseSpineSetup(id:string,source:string,atlasText:string,pageNames:readonly string[],imageIds:readonly string[],leases:readonly AssetLease<Texture>[],allowPrerelease:boolean):ParsedSpineSetup {
  if(typeof atlasText!=='string'||atlasText.length>262144||typeof source!=='string'||source.length>2097152)throw spineFault('SOURCE_LIMIT',id);
  const decoded=readSpineJson(source,id,allowPrerelease);
  const atlas=new Core.TextureAtlas(atlasText);
  try {
    if(atlas.pages.length!==pageNames.length||atlas.regions.length>8192)throw spineFault('PAGE_BINDING',id);
    const pages:SpinePageInfo[]=[];
    for(let i=0;i<atlas.pages.length;i++){
      const page=atlas.pages[i]!,lease=leases[i]!,texture=APPLY(LEASE_VALUE,lease,[]) as Texture,width=APPLY(WIDTH,texture,[]) as number,height=APPLY(HEIGHT,texture,[]) as number;
      const image=APPLY(IMAGE,texture,[]) as Texture['imageData'],rect=APPLY(RECT,texture,[]) as Texture['sourceRect'];
      if(APPLY(VIEW,texture,[])!==null||rect.x!==0||rect.y!==0||image.width!==width||image.height!==height)throw spineFault('PAGE_TEXTURE',id);
      if(page.name!==pageNames[i]||!integer(width,1,4096)||!integer(height,1,4096)||width*height>1048576||page.width!==width||page.height!==height)throw spineFault('PAGE_DIMENSIONS',id);
      // PMA transport needs its own qualified normalization/color profile.
      if(page.pma)throw spineFault('PAGE_ALPHA_PROFILE',id);
      page.setTexture(new PageTexture(width,height));pages.push(Object.freeze({name:page.name,imageId:imageIds[i]!,width,height,sourcePremultiplied:false}));
    }
    const loader=new Core.AtlasAttachmentLoader(atlas),data=new Core.SkeletonJson(loader).readSkeletonData(decoded);
    const exportVersion=data.version;
    if(typeof exportVersion!=='string'||!/^4\.3\.\d+(?:-beta)?$/.test(exportVersion)||!allowPrerelease&&exportVersion.endsWith('-beta'))throw spineFault('EXPORT_VERSION',id);
    if(data.bones.length>1024||data.slots.length>2048||data.skins.length>128||data.animations.length>1024)throw spineFault('SETUP_LIMIT',id);
    const skins=data.skins.map(s=>s.name),animations=data.animations.map(a=>({name:a.name,duration:a.duration}));
    if(skins.some(n=>!label(n))||animations.some(a=>!label(a.name)||!Number.isFinite(a.duration)||a.duration<0||a.duration>86400))throw spineFault('SETUP',id);
    const info:SpineAssetInfo=Object.freeze({coreVersion:'4.3.13',exportVersion,format:'json',prerelease:exportVersion.endsWith('-beta'),boneCount:data.bones.length,slotCount:data.slots.length,skins:Object.freeze(skins),animations:Object.freeze(animations.map(a=>Object.freeze(a))),pages:Object.freeze(pages)});
    return {data,atlas,info};
  } catch(cause){atlas.dispose();throw spineFault('PARSE',id,cause);}
}
