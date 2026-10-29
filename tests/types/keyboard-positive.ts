// SPDX-License-Identifier: Apache-2.0
import {createKeyboardInput} from '@egret/engine/input';
import {createBrowserKeyboardInput} from '@egret/engine/web/keyboard';
import type {KeyboardInput,KeyboardInputSnapshot,KeyboardKeyPayload,KeyboardFocusChange} from '@egret/engine/input';
import type {Engine,Scope,DisplayObject} from '@egret/engine';
declare const engine:Engine,scope:Scope,target:DisplayObject;
const input:KeyboardInput=createKeyboardInput({engine,scope,onFocusChange:(change:KeyboardFocusChange)=>{const id:string|undefined=change.focusedId;void id;}});
const registration=input.registerTarget({id:'control',target,tabIndex:-1});registration.update({target,disabled:false});
target.on(input.events.keyDown,event=>{const payload:KeyboardKeyPayload=event.payload;const repeat:boolean=payload.repeat;const code:string=payload.code;event.preventDefault();void repeat;void code;});
target.on(input.events.focusIn,event=>{const related:string|undefined=event.payload.relatedId;void related;});
target.on(input.events.cancel,event=>{const reason:string=event.payload.reason;void reason;});
input.focus('control',{reason:'pointer',visible:false});const id:string|undefined=input.moveFocus('next',true);const prevented:boolean=input.keyDown({code:'Space',key:' '});
const snapshot:KeyboardInputSnapshot=input.getSnapshot();const keys:readonly string[]=snapshot.pressedKeys;
const browser:KeyboardInput=createBrowserKeyboardInput({engine,scope});void browser;void id;void prevented;void keys;
