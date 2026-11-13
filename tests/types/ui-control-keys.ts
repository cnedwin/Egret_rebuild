// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the key bindings: each kind with the control made for it, and seven things it may not write.
import {createActionControl,createControlKeys,createMovementControl,createScrollControl,createSelectionGroup,createTextFieldControl,createToggleControl} from '@egret/engine/ui';
import type {ActionKeysOptions,ControlKeys,ControlKeysOptions,ControlKeysSource,MovementKeysOptions,ScrollKeysOptions,SelectionKeysOptions,TextFieldKeysOptions,ToggleKeysOptions,TextFieldEditor,TextFieldRectangle,TextFieldSession} from '@egret/engine/ui';
import type {KeyboardInput,PointerInput} from '@egret/engine/input';
import type {DisplayObject} from '@egret/engine';
declare const keyboard:KeyboardInput,input:PointerInput,target:DisplayObject,editor:TextFieldEditor<TextFieldRectangle&TextFieldSession>;
// The keyboard input is a source as it is.
const source:ControlKeysSource=keyboard;void source;
const action=createActionControl({input,target}),toggle=createToggleControl({input,target}),movement=createMovementControl({input,target,radius:40});
const group=createSelectionGroup({input,items:[{key:'easy',target}]}),scroll=createScrollControl({viewportLength:100,contentLength:400});
const field=createTextFieldControl({input,target,editor,field:()=>({x:0,y:0,width:10,height:10})});
const first:ActionKeysOptions={keyboard,target,kind:'action',control:action,onPressChange:(pressed:boolean)=>{void pressed;}};
const second:ToggleKeysOptions={keyboard,target,kind:'toggle',control:toggle};
const third:TextFieldKeysOptions={keyboard,target,kind:'textField',control:field};
const fourth:SelectionKeysOptions={keyboard,target,kind:'selection',control:group,orientation:'vertical'};
const fifth:ScrollKeysOptions={keyboard,target,kind:'scroll',control:scroll};
const sixth:MovementKeysOptions={keyboard,target,kind:'movement',control:movement,keys:'wasd',onPressChange:(pressed:boolean)=>{void pressed;}};
const all:readonly ControlKeysOptions[]=[first,second,third,fourth,fifth,sixth];
for(const options of all){const keys:ControlKeys=createControlKeys(options);const held:boolean=keys.pressed;void held;keys.dispose();}
// Anything with the same methods is bound the same way.
createControlKeys({keyboard,target,kind:'toggle',control:{enabled:true,toggle(){}}}).dispose();
// @ts-expect-error a binding says which control it is for
createControlKeys({keyboard,target,control:action});
// @ts-expect-error an action has nothing to flip
createControlKeys({keyboard,target,kind:'toggle',control:action});
// @ts-expect-error a scroll has no orientation of its own: its axis says it
createControlKeys({keyboard,target,kind:'scroll',control:scroll,orientation:'vertical'});
// @ts-expect-error nothing is held for a selection
createControlKeys({keyboard,target,kind:'selection',control:group,onPressChange:()=>{}});
// @ts-expect-error the keys of a movement are the arrows, the letters, or both
createControlKeys({keyboard,target,kind:'movement',control:movement,keys:'numpad'});
// @ts-expect-error the state of the binding is read-only
createControlKeys(first).pressed=true;
// @ts-expect-error the default entry does not have the factory
import {createControlKeys as leaked} from '@egret/engine';
void leaked;
