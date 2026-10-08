import type { Rectangle2D } from '@egret/contracts';
import type { DisplayObject } from './DisplayObject.js';
import { assertLive } from './displayTreeState.js';
import { engineOf } from './ownership.js';
import { EgretError } from './EgretError.js';
export interface Primitive { readonly rect:Rectangle2D; readonly color:number; readonly alpha:number; }
export interface VisualState { x:number;y:number;scaleX:number;scaleY:number;rotation:number;alpha:number;visible:boolean;clipRect:Rectangle2D|undefined; primitives:Primitive[]; }
// Authoritative per-node visual state excludes overridable public accessors.
const states=new WeakMap<DisplayObject,VisualState>();
export function registerVisual(node:DisplayObject):void { states.set(node,{x:0,y:0,scaleX:1,scaleY:1,rotation:0,alpha:1,visible:true,clipRect:undefined,primitives:[]}); }
export function visualOf(node:DisplayObject):VisualState { return states.get(node)!; }
export function assertVisualMutable(node:DisplayObject):void { assertLive(node); engineOf(node)?.assertOpen(); }
export function finite(value:unknown):value is number { return typeof value==='number' && Number.isFinite(value); }
export function color(value:unknown):value is number { return finite(value)&&Number.isInteger(value)&&value>=0&&value<=0xffffff; }
export function unit(value:unknown):value is number { return finite(value)&&value>=0&&value<=1; }
export function copyRect(value:Rectangle2D,code:string):Rectangle2D {
  const {x,y,width,height}=value;
  if (![x,y,width,height].every(finite)||width<0||height<0) throw new EgretError(code);
  return Object.freeze({x,y,width,height});
}

