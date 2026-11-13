// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the two hover entries: what it may write, and seven things it may not.
import {createHoverInput} from '@egret/engine/input/hover';
import type {HoverInput,HoverInputOptions,HoverLeaveReason,HoverNotification,HoverPoint,HoverState,WheelNotification,WheelPoint,WheelSample} from '@egret/engine/input/hover';
import {createBrowserHoverInput} from '@egret/engine/web/hover';
import type {BrowserHoverInputOptions,WheelPagePolicy} from '@egret/engine/web/hover';
import type {DisplayObject,Engine,Scope} from '@egret/engine';
declare const engine:Engine,scope:Scope,canvas:HTMLCanvasElement,button:DisplayObject;
const options:HoverInputOptions={engine,scope,width:480,height:300,maxNodes:256,capacity:2,
 onHover:(notification:HoverNotification)=>{const kind:'enter'|'move'|'leave'=notification.kind,target:DisplayObject=notification.target,reason:HoverLeaveReason|undefined=notification.reason;void kind;void target;void reason;},
 onWheel:(notification:WheelNotification)=>{const target:DisplayObject|undefined=notification.target;void target;return notification.consumed?undefined:true;}};
const input:HoverInput=createHoverInput(options);
const over:DisplayObject|undefined=input.sample({pointerId:1,pointerType:'pen',globalX:1,globalY:2,timestamp:3});void over;
const wheel:WheelSample={globalX:1,globalY:2,deltaX:0,deltaY:1,unit:'line',timestamp:4,zoom:false};
const consumed:boolean=input.wheel(wheel),left:boolean=input.leave(1,'outside');void consumed;void left;
input.leaveAll('blur');input.sync();input.setViewportRevision(1);input.setInteractive(false);
const states:readonly HoverState[]=input.hovers,revision:number=input.viewportRevision,state:'active'|'suspended'|'closed'=input.state;void states;void revision;void state;
button.on(input.events.enter,event=>{const point:HoverPoint=event.payload;void point;});
button.on(input.events.leave,event=>{const reason:HoverLeaveReason=event.payload.reason;void reason;});
button.on(input.events.wheel,event=>{const point:WheelPoint=event.payload;if(point.unit==='pixel')event.preventDefault();});
const remove:()=>void=input.onClose(()=>{});remove();input.dispose();
const policy:WheelPagePolicy='never';
const browser:BrowserHoverInputOptions={...options,canvas,wheelPage:policy,onError:(cause:unknown)=>{void cause;}};
const page:HoverInput=createBrowserHoverInput(browser);page.dispose();
// @ts-expect-error a finger does not hover
input.sample({pointerId:1,pointerType:'touch',globalX:1,globalY:2,timestamp:3});
// @ts-expect-error a wheel says what its deltas count
input.wheel({globalX:1,globalY:2,deltaX:0,deltaY:1,timestamp:4});
// @ts-expect-error a reason is one of the named ones
input.leave(1,'because');
// @ts-expect-error a point is read-only
states[0]!.point.globalX=0;
// @ts-expect-error the browser adapter needs its canvas
createBrowserHoverInput(options);
// @ts-expect-error the page policy is one of three
createBrowserHoverInput({...browser,wheelPage:'sometimes'});
// @ts-expect-error the root entry does not have the factory
import {createHoverInput as leaked} from '@egret/engine';
void leaked;
