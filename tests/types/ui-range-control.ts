// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the range control, its keys and its semantic node, and six things it may not write.
import {createControlKeys,createRangeControl} from '@egret/engine/ui';
import type {RangeAxis,RangeControl,RangeControlOptions,RangeKeysOptions} from '@egret/engine/ui';
import {createUiSemantics} from '@egret/engine/ui/semantics';
import type {KeyboardInput,PointerInput} from '@egret/engine/input';
import type {DisplayObject} from '@egret/engine';
declare const input:PointerInput,keyboard:KeyboardInput,target:DisplayObject;
const axis:RangeAxis='y';
const options:RangeControlOptions={input,target,axis,start:8,length:160,min:0,max:1,step:0.05,value:0.8,
 onChange:(value:number,previous:number)=>{void value;void previous;},onDragChange:(dragging:boolean)=>{void dragging;}};
const range:RangeControl=createRangeControl(options);
const state:readonly [number,number,number,number,number,boolean,boolean]=[range.value,range.min,range.max,range.step,range.fraction,range.dragging,range.enabled];void state;
const changed:boolean=range.setValue(0.5)||range.stepBy(-2)||range.toMin()||range.toMax();void changed;
const keys:RangeKeysOptions={keyboard,target,kind:'range',control:range,orientation:'vertical',page:5};
createControlKeys(keys).dispose();
createUiSemantics().add({id:'volume',role:'slider',describe:()=>({name:'Volume',bounds:{x:0,y:0,width:20,height:160},range:{now:range.value,min:range.min,max:range.max},orientation:'vertical' as const})});
range.setEnabled(false);range.dispose();
createRangeControl({input,target,length:200}).dispose();
// @ts-expect-error a track has a length
createRangeControl({input,target});
// @ts-expect-error a track lies along x or y
createRangeControl({input,target,length:200,axis:'z'});
// @ts-expect-error the value is read-only
range.value=1;
// @ts-expect-error a change is told as the new value and the old
createRangeControl({input,target,length:200,onChange:(value:string)=>{void value;}});
// @ts-expect-error nothing is held for a range
createControlKeys({keyboard,target,kind:'range',control:range,onPressChange:()=>{}});
// @ts-expect-error the default entry does not have the factory
import {createRangeControl as leaked} from '@egret/engine';
void leaked;
