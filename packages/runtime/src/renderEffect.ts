// SPDX-License-Identifier: Apache-2.0
import type { Rectangle2D } from '@egret/contracts';
import type { Bitmap } from './Bitmap.js';
import type { DisplayObject } from './DisplayObject.js';
import { readBitmapState as bitmapCaptureState } from './bitmapDisplayState.js';
import { assertLive } from './displayTreeState.js';
import { engineOf } from './ownership.js';
import { assertVisualMutable, copyRect, visualOf, recordVisualChange, VISUAL_APPEARANCE } from './displayVisualState.js';
import { EgretError } from './EgretError.js';

/** Render-only subtree effect. The mask borrows its Bitmap's existing texture lease.
 * maskRect is in the affected node's local coordinates; mask display transforms
 * and opacity do not apply. The mask is not removed from its own display tree. */
export interface RenderEffect2D {
  readonly blurRadius?: number;
  readonly alphaMask?: Bitmap;
  readonly maskRect?: Rectangle2D;
  /**
   * Twenty numbers, as Egret's ColorMatrixFilter: four rows of red, green, blue and alpha, each four factors and an
   * offset from 0 to 255. Applied to colour as it is seen, without its alpha multiplied in, after the blur.
   */
  readonly colorMatrix?: readonly number[];
  /** A glow from the alpha of what is drawn, as Egret's GlowFilter; with an offset it is a drop shadow. */
  readonly glow?: RenderGlow2D;
  /** A hard line of a colour around what is drawn, a few pixels wide. One effect has a glow or an outline. */
  readonly outline?: RenderOutline2D;
}
export interface RenderGlow2D {
  /** 0xRRGGBB. */
  readonly color: number;
  /** 0 to 1; defaults to 1. */
  readonly alpha?: number;
  /** How far it spreads, 0 to 16 logical pixels; defaults to 6, as Egret's. */
  readonly blur?: number;
  /** What its spread alpha is multiplied by, 0 to 255; defaults to 2, as Egret's. */
  readonly strength?: number;
  /** Glow inside the edge instead of outside it. */
  readonly inner?: boolean;
  /** Show the glow alone, without what it glows around. */
  readonly knockout?: boolean;
  /** Where the glow is moved to, in logical pixels of the surface, -256 to 256: a drop shadow. */
  readonly offsetX?: number;
  readonly offsetY?: number;
}
export interface RenderOutline2D {
  /** 0xRRGGBB. */
  readonly color: number;
  /** 1 to 8 logical pixels. */
  readonly width: number;
  /** 0 to 1; defaults to 1. */
  readonly alpha?: number;
}
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const between=(value:unknown,low:number,high:number):value is number=>finite(value)&&value>=low&&value<=high;
const colour=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>=0&&(value as number)<=0xffffff;
const flag=(value:unknown):boolean=>{if(value!==undefined&&typeof value!=='boolean')throw new EgretError('DISPLAY_EFFECT_INVALID');return value===true;};
function readMatrix(input:unknown):readonly number[]{
  if(!Array.isArray(input)||input.length!==20)throw new EgretError('DISPLAY_EFFECT_INVALID');
  const copy=Array.from({length:20},(_,i)=>{const value:unknown=input[i];if(!finite(value)||Math.abs(value)>65536)throw new EgretError('DISPLAY_EFFECT_INVALID');return value;});
  return Object.freeze(copy);
}
function readGlow(input:RenderGlow2D):RenderGlow2D{
  if(input===null||typeof input!=='object')throw new EgretError('DISPLAY_EFFECT_INVALID');
  const {color,alpha=1,blur=6,strength=2,offsetX=0,offsetY=0}=input,inner=flag(input.inner),knockout=flag(input.knockout);
  if(!colour(color)||!between(alpha,0,1)||!between(blur,0,16)||!between(strength,0,255)||!between(offsetX,-256,256)||!between(offsetY,-256,256))throw new EgretError('DISPLAY_EFFECT_INVALID');
  return Object.freeze({color,alpha,blur,strength,inner,knockout,offsetX,offsetY});
}
function readOutline(input:RenderOutline2D):RenderOutline2D{
  if(input===null||typeof input!=='object')throw new EgretError('DISPLAY_EFFECT_INVALID');
  const {color,width,alpha=1}=input;
  if(!colour(color)||!between(width,1,8)||!between(alpha,0,1))throw new EgretError('DISPLAY_EFFECT_INVALID');
  return Object.freeze({color,width,alpha});
}
export function setRenderEffect(node:DisplayObject,input:RenderEffect2D|undefined):void {
  assertVisualMutable(node);
  let value:RenderEffect2D|undefined;
  if(input!==undefined){
    if(input===null||typeof input!=='object')throw new EgretError('DISPLAY_EFFECT_INVALID');
    const radius=input.blurRadius??0,mask=input.alphaMask,rect=input.maskRect;
    if(!Number.isInteger(radius)||radius<0||radius>8)throw new EgretError('DISPLAY_EFFECT_INVALID');
    let bounds:Rectangle2D|undefined;
    if(mask!==undefined){
      if(!bitmapCaptureState(mask))throw new EgretError('DISPLAY_EFFECT_MASK_INVALID');
      assertLive(mask);
      if(engineOf(mask)!==engineOf(node))throw new EgretError('ENGINE_MISMATCH');
      if(rect===undefined)throw new EgretError('DISPLAY_EFFECT_INVALID');
      bounds=copyRect(rect,'DISPLAY_EFFECT_INVALID');
      if(bounds.width<=0||bounds.height<=0)throw new EgretError('DISPLAY_EFFECT_INVALID');
    }else if(rect!==undefined)throw new EgretError('DISPLAY_EFFECT_INVALID');
    const matrix=input.colorMatrix===undefined?undefined:readMatrix(input.colorMatrix);
    const glow=input.glow===undefined?undefined:readGlow(input.glow),outline=input.outline===undefined?undefined:readOutline(input.outline);
    if(glow!==undefined&&outline!==undefined)throw new EgretError('DISPLAY_EFFECT_INVALID');
    value=Object.freeze({blurRadius:radius,...(mask===undefined?{}:{alphaMask:mask,maskRect:bounds!}),...(matrix===undefined?{}:{colorMatrix:matrix}),
      ...(glow===undefined?{}:{glow}),...(outline===undefined?{}:{outline})});
  }
  // Descriptor reads may execute application getters; publish only after life recheck.
  assertVisualMutable(node);
  visualOf(node).renderEffect=value;
  recordVisualChange(node,VISUAL_APPEARANCE);
}
