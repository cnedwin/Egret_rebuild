// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the hover, toggle and selection controls: what it may write, and six things it may not.
import {createHoverControl,createSelectionGroup,createToggleControl} from '@egret/engine/ui';
import type {HoverControl,HoverControlOptions,SelectionGroup,SelectionGroupOptions,SelectionItem,ToggleControl,ToggleControlOptions} from '@egret/engine/ui';
import type {HoverInput,HoverNotification,HoverTransition} from '@egret/engine/input/hover';
import type {PointerInput} from '@egret/engine/input';
import type {DisplayObject} from '@egret/engine';
declare const hover:HoverInput,input:PointerInput,target:DisplayObject,other:DisplayObject;
const hoverOptions:HoverControlOptions={hover,target,onHoverChange:(hovered:boolean)=>{void hovered;}};
const over:HoverControl=createHoverControl(hoverOptions);
const isOver:boolean=over.hovered;void isOver;over.setEnabled(false);over.dispose();
const toggleOptions:ToggleControlOptions={input,target,checked:true,onChange:(checked:boolean)=>{void checked;},onPressChange:(pressed:boolean)=>{void pressed;}};
const toggle:ToggleControl=createToggleControl(toggleOptions);
toggle.toggle();toggle.setChecked(false);toggle.press();toggle.release();toggle.setEnabled(true);
const value:boolean=toggle.checked&&toggle.pressed&&toggle.enabled;void value;toggle.dispose();
const items:readonly SelectionItem[]=[{key:'a',target},{key:'b',target:other,enabled:false}];
const groupOptions:SelectionGroupOptions={input,items,selected:'a',wrap:false,onChange:(selected:string,previous:string|undefined)=>{void selected;void previous;}};
const group:SelectionGroup=createSelectionGroup(groupOptions);
const changed:boolean=group.select('b')||group.next()||group.previous()||group.first()||group.last();void changed;
const selected:string|undefined=group.selected,keys:readonly string[]=group.keys,usable:boolean=group.isItemEnabled('a');void selected;void keys;void usable;
group.setItemEnabled('b',true);group.setEnabled(false);group.dispose();
const remove:()=>void=hover.observe((notification:HoverNotification)=>{const related:DisplayObject|undefined=notification.related;void related;});remove();
target.on(hover.events.enter,event=>{const transition:HoverTransition=event.payload,from:DisplayObject|undefined=transition.related;void from;});
target.on(hover.events.leave,event=>{const to:DisplayObject|undefined=event.payload.related;void to;});
// @ts-expect-error a hover control needs the hover input
createHoverControl({target});
// @ts-expect-error the value of a toggle is read-only
toggle.checked=true;
// @ts-expect-error an item needs its key
createSelectionGroup({input,items:[{target}]});
// @ts-expect-error a selection is a key
group.select(1);
// @ts-expect-error the keys cannot be changed
group.keys.push('c');
// @ts-expect-error a move has no related target
target.on(hover.events.move,event=>{void event.payload.related;});
