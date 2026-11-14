// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the two gamepad entries: what it may write, and nine things it may not.
import {bindGamepadKeys,createGamepadInput} from '@egret/engine/input/gamepad';
import type {GamepadButtonChange,GamepadButtonName,GamepadButtonSample,GamepadConnectionChange,GamepadInput,GamepadInputOptions,GamepadKeyAction,GamepadKeys,GamepadKeysOptions,GamepadKeyTarget,GamepadPad,GamepadSample,GamepadStick,GamepadStickName} from '@egret/engine/input/gamepad';
import {createBrowserGamepadInput} from '@egret/engine/web/gamepad';
import type {BrowserGamepadInput,BrowserGamepadInputOptions,GamepadRumble} from '@egret/engine/web/gamepad';
import type {Scope} from '@egret/engine';
import type {KeyboardInput} from '@egret/engine/input';
declare const scope:Scope,keyboard:KeyboardInput;
const options:GamepadInputOptions={deadZone:0.2,maxPads:2,
 onButton:(change:GamepadButtonChange)=>{const name:GamepadButtonName|undefined=change.name,held:boolean=change.pressed,far:number=change.value,which:number=change.index;void name;void held;void far;void which;},
 onConnection:(change:GamepadConnectionChange)=>{const there:boolean=change.connected,usual:boolean=change.standard;void there;void usual;}};
const input:GamepadInput=scope.use(createGamepadInput(options));
const button:GamepadButtonSample={pressed:true,value:1};
const sample:GamepadSample={index:0,id:'Pad',mapping:'standard',buttons:[button],axes:[0,0,0,0]};
input.sample([sample,null,undefined],16.7);input.release();
const state:'active'|'closed'=input.state,pads:readonly GamepadPad[]=input.pads,pad:GamepadPad|undefined=input.pad(0);void state;void pads;
if(pad!==undefined){
 const jump:boolean=pad.pressed('a'),second:boolean=pad.pressed(1),pulled:number=pad.value('r2'),raw:number=pad.axis(0),side:GamepadStickName='right',aim:GamepadStick=pad.stick(side),x:number=aim.x;
 void jump;void second;void pulled;void raw;void x;
}
const off:()=>void=input.subscribe((change:GamepadButtonChange)=>{void change;}),stop:()=>void=input.onSample((time:number)=>{void time;});off();stop();
// The keyboard input of the Engine is what a pad drives; anything with the same three methods will do.
const jumpKey:GamepadKeyAction={key:' ',code:'Space'},back:GamepadKeyAction={focus:'previous'},arrow:GamepadKeyAction={key:'ArrowUp',otherwise:'previous'};
const bound:GamepadKeysOptions={gamepad:input,keyboard,pad:0,map:{a:jumpKey,l1:back,up:arrow,b:null},stick:'left',wrap:true,threshold:0.6,repeatDelay:300,repeatInterval:80};
const keys:GamepadKeys=bindGamepadKeys(bound),held:readonly string[]=keys.held;void held;keys.dispose();
const own:GamepadKeyTarget={keyDown:()=>false,keyUp:()=>false,moveFocus:()=>undefined};
bindGamepadKeys({gamepad:input,keyboard:own,stick:false}).dispose();
const page:BrowserGamepadInputOptions={...options,onError:(cause:unknown)=>{void cause;}};
const browser:BrowserGamepadInput=scope.use(createBrowserGamepadInput(page)),same:GamepadInput=browser.input;void same;
browser.poll();browser.poll(33.4);
const shake:GamepadRumble={duration:150,weak:0.2,strong:0.8},shaken:boolean=browser.rumble(0,shake);void shaken;browser.rumble(0);
createBrowserGamepadInput().dispose();
// @ts-expect-error a button has one of the names of the standard layout
pad?.pressed('c');
// @ts-expect-error a stick is the left one or the right one
pad?.stick('middle');
// @ts-expect-error a look has a time
input.sample([sample]);
// @ts-expect-error a button of a sample says whether it is held and how far
input.sample([{...sample,buttons:[true]}],1);
// @ts-expect-error the keys need a keyboard
bindGamepadKeys({gamepad:input});
// @ts-expect-error an action is a key or a move of the focus
bindGamepadKeys({gamepad:input,keyboard,map:{a:'Enter'}});
// @ts-expect-error the state is read, not written
input.state='closed';
// @ts-expect-error the page has no pad to give: it is asked
createBrowserGamepadInput({pads:[]});
// @ts-expect-error a pad is shaken by its number
browser.rumble('first');
