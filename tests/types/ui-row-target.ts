// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the target of a row binding: controls listen on it, and two things it may not write.
import {createActionControl,createHoverControl} from '@egret/engine/ui';
import type {RowBindContext,RowBinding,VirtualDataSource} from '@egret/engine/ui';
import type {PointerInput} from '@egret/engine/input';
import type {HoverInput} from '@egret/engine/input/hover';
import {DisplayObjectContainer} from '@egret/engine';
import type {DisplayObject} from '@egret/engine';
declare const input:PointerInput,hover:HoverInput;
const source:VirtualDataSource<number>={revision:0,records:[{key:'a',contentVersion:0,estimatedHeight:20,value:1}],
 bind(context:RowBindContext<number>):RowBinding{
  const target:DisplayObject=context.target;
  createHoverControl({hover,target,onHoverChange:(hovered:boolean)=>{void hovered;}});
  createActionControl({input,target:context.target,onActivate:()=>{void context.key;}});
  return {content:context.scope.use(new DisplayObjectContainer()),measuredHeight:20};
 },
 unbind(){}};
void source;
declare const context:RowBindContext<number>;
// @ts-expect-error the target is the root's to give
context.target=new DisplayObjectContainer();
// @ts-expect-error a row has one target, not a list of them
const many:DisplayObject[]=context.target;void many;
