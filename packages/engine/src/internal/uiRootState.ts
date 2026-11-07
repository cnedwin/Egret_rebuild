// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { DisplayObjectContainer } from '@egret/runtime';
import type { UiRoot, UiSnapshot, RowRetention } from '../ui/types.js';
import type { PointerInput } from '../pointerInputTypes.js';
import type { KeyboardInput } from '../keyboardInputTypes.js';
export type UiRootTarget = Readonly<{ kind:'leaf';id:string }> | Readonly<{ kind:'row';listId:string;key:string }>;
export interface UiRootContent {readonly content:DisplayObjectContainer;readonly visible:boolean;readonly bindingGeneration?:number;readonly contentVersion?:number;}
export interface UiRootLayerPresentation {readonly x:number;readonly y:number;readonly visible:boolean;readonly pointerEnabled:boolean;readonly keyboardEnabled:boolean;readonly index?:number;}
export interface UiRootLayerState {readonly snapshot:UiSnapshot;readonly ready:boolean;readonly mutable:boolean;readonly lifetimeOpen:boolean;readonly visible:boolean;readonly pointerEnabled:boolean;readonly keyboardEnabled:boolean;readonly input:PointerInput|undefined;readonly keyboard:KeyboardInput|undefined;}
interface RootPort {
 readonly wrapper:DisplayObjectContainer;state():'open'|'closed';snapshot():UiSnapshot;
 lookup(target:UiRootTarget):UiRootContent|undefined;retain(listId:string,key:string):RowRetention;
 layerState():UiRootLayerState;presentLayer(value:UiRootLayerPresentation):void;releaseLayer(visible:boolean):void;layerOwnership(active:boolean):void;
 anchor(target:UiRootTarget):Readonly<{x:number;y:number;width:number;height:number}>|undefined;
}
export interface UiRootAccess extends RootPort {
 onClose(callback:()=>void):()=>void;
 onInteractionChange(callback:(active:boolean,policy:'commit'|'cancel')=>void):()=>void;
 notifyInteraction(policy:'commit'|'cancel'):readonly unknown[];
 claimLayer(owner:object,dismiss:()=>boolean):()=>void;
 editorInteractive():boolean;requestDismiss():boolean;
}
const roots=new WeakMap<object,{engine:object;access:UiRootAccess}>();
/** The genuine root installs all ports once; structural copies grant no authority. */
export function registerUiRoot(root:UiRoot,engine:object,port:RootPort):()=>readonly unknown[]{
 const listeners=new Set<()=>void>(),interactions=new Set<(active:boolean,policy:'commit'|'cancel')=>void>();let closed=false,layerOwner:object|undefined,dismiss:(()=>boolean)|undefined;
 function open():void{if(closed||port.state()!=='open')throw new EgretError('UI_TEXT_EDITOR_ROOT_CLOSED');}
 const access:UiRootAccess=Object.freeze({...port,
  onClose(callback:()=>void){open();if(listeners.size>=128)throw new EgretError('UI_LIMIT');listeners.add(callback);return()=>{listeners.delete(callback);};},
  onInteractionChange(callback:(active:boolean,policy:'commit'|'cancel')=>void){open();if(interactions.size>=128)throw new EgretError('UI_LIMIT');interactions.add(callback);return()=>{interactions.delete(callback);};},
  editorInteractive(){const value=port.layerState();return !closed&&port.state()==='open'&&value.visible&&value.keyboardEnabled;},
  notifyInteraction(policy:'commit'|'cancel'){
   if(!port.layerState().lifetimeOpen)return Object.freeze([]);
   const errors:unknown[]=[],active=access.editorInteractive();
   for(const callback of [...interactions]){if(closed)break;if(!interactions.has(callback))continue;try{callback(active,policy);}catch(cause){errors.push(cause);}}
   return Object.freeze(errors);
  },
  claimLayer(owner:object,callback:()=>boolean){open();if(layerOwner!==undefined)throw new EgretError('UI_LAYER_ROOT_OWNED');layerOwner=owner;dismiss=callback;port.layerOwnership(true);return()=>{if(layerOwner===owner){port.layerOwnership(false);layerOwner=undefined;dismiss=undefined;}};},
  requestDismiss(){return !closed&&dismiss!==undefined?dismiss():false;},
 });roots.set(root,{engine,access});
 return()=>{if(closed)return Object.freeze([]);closed=true;port.layerOwnership(false);layerOwner=undefined;dismiss=undefined;interactions.clear();const current=[...listeners];listeners.clear();const errors:unknown[]=[];for(const callback of current)try{callback();}catch(cause){errors.push(cause);}return Object.freeze(errors);};
}
export function requireUiRoot(root:unknown,engine:object):UiRootAccess{
 const record=roots.get(root as object);if(record===undefined||record.engine!==engine)throw new EgretError('UI_TEXT_EDITOR_ROOT_INVALID');if(record.access.state()!=='open')throw new EgretError('UI_TEXT_EDITOR_ROOT_CLOSED');return record.access;
}
