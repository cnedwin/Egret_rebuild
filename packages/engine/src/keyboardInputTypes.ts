// SPDX-License-Identifier: Apache-2.0
import type {DisplayObject,EventType,Scope} from '@egret/runtime';
import type {Engine} from './Engine.js';
export interface KeyboardSample {readonly code:string;readonly key:string;readonly repeat?:boolean;readonly altKey?:boolean;readonly ctrlKey?:boolean;readonly metaKey?:boolean;readonly shiftKey?:boolean;}
export type KeyboardCancelReason='focus'|'rebind'|'removed'|'owner'|'suspended'|'dispose'|'blur'|'hidden'|'pagehide'|'error';
export interface KeyboardKeyPayload extends Required<KeyboardSample> {readonly targetId:string;}
export interface KeyboardCancelPayload extends KeyboardKeyPayload {readonly reason:KeyboardCancelReason;}
export interface KeyboardFocusPayload {readonly targetId:string;readonly relatedId:string|undefined;readonly reason:string;readonly focusVisible:boolean;}
export interface KeyboardFocusChange {readonly previousId:string|undefined;readonly focusedId:string|undefined;readonly reason:string;readonly focusVisible:boolean;}
export interface KeyboardInputOptions {readonly engine:Engine;readonly scope:Scope;readonly maxTargets?:number;readonly maxKeys?:number;readonly maxNodes?:number;readonly onFocusChange?:(change:KeyboardFocusChange)=>void;}
export interface KeyboardTargetOptions {readonly id:string;readonly target:DisplayObject;readonly tabIndex?:number;readonly disabled?:boolean;}
export interface KeyboardTargetRegistration {update(options:Partial<Omit<KeyboardTargetOptions,'id'>>):void;dispose():void;}
export interface KeyboardInputSnapshot {readonly state:'active'|'suspended'|'closed';readonly focusedId:string|undefined;readonly focusVisible:boolean;readonly pressedKeys:readonly string[];readonly targetCount:number;}
export interface KeyboardInputEvents {readonly keyDown:EventType<KeyboardKeyPayload>;readonly keyUp:EventType<KeyboardKeyPayload>;readonly cancel:EventType<KeyboardCancelPayload>;readonly focusIn:EventType<KeyboardFocusPayload>;readonly focusOut:EventType<KeyboardFocusPayload>;}
export interface KeyboardFocusOptions {readonly visible?:boolean;readonly reason?:'programmatic'|'keyboard'|'pointer';}
/** Synchronous logical focus; text editing and IME are outside this channel. */
export interface KeyboardInput {
 readonly events:KeyboardInputEvents;
 registerTarget(options:KeyboardTargetOptions):KeyboardTargetRegistration;
 focus(id:string|undefined,options?:KeyboardFocusOptions):void;
 moveFocus(direction:'next'|'previous',wrap?:boolean):string|undefined;
 keyDown(sample:KeyboardSample):boolean;keyUp(sample:KeyboardSample):boolean;
 cancel(reason?:KeyboardCancelReason):void;sync():void;setInteractive(value:boolean):void;
 getSnapshot():KeyboardInputSnapshot;dispose():void;
}
