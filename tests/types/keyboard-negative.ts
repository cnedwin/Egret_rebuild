// SPDX-License-Identifier: Apache-2.0
import {createKeyboardInput as rootFactory} from '@egret/engine';
// Default Canvas entry is independently checked in the DOM consumer.
import {bindKeyboardSurface} from '@egret/engine/input';
import {createKeyboardInput} from '@egret/engine/input';
import type {Engine,Scope,DisplayObject} from '@egret/engine';
declare const engine:Engine,scope:Scope,target:DisplayObject;
const input=createKeyboardInput({engine,scope});
input.getSnapshot().pressedKeys.push('Space');
input.getSnapshot().focusedId='other';
input.registerTarget({id:'a',target}).update({id:'b'});
target.on(input.events.keyDown,event=>{event.payload.code='other';});
target.on(input.events.keyDown,async()=>{});
input.moveFocus('sideways');
input.cancel('pointercancel');
createKeyboardInput({engine:{},scope});
const canvas:HTMLCanvasElement=undefined;
const native:KeyboardEvent=undefined;
void rootFactory;void bindKeyboardSurface;void canvas;void native;
