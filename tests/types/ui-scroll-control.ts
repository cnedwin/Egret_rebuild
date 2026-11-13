// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the scroll control: what it may write, and six things it may not.
import {createScrollControl} from '@egret/engine/ui';
import type {ScrollAxis,ScrollControl,ScrollControlOptions,ScrollThumb,ScrollThumbOptions,ScrollWheelOptions} from '@egret/engine/ui';
import type {HoverInput} from '@egret/engine/input/hover';
import type {PointerInput} from '@egret/engine/input';
import type {DisplayObject} from '@egret/engine';
declare const hover:HoverInput,input:PointerInput,viewport:DisplayObject,bar:DisplayObject;
const wheel:ScrollWheelOptions={hover,target:viewport,lineLength:24},thumb:ScrollThumbOptions={input,target:bar,trackLength:140,minimumLength:12};
const axis:ScrollAxis='x';
const options:ScrollControlOptions={axis,viewportLength:140,contentLength:336,offset:0,wheel,thumb,onScroll:(offset:number)=>{void offset;},onDragChange:(dragging:boolean)=>{void dragging;}};
const scroll:ScrollControl=createScrollControl(options);
const moved:boolean=scroll.scrollTo(10)||scroll.scrollBy(-5)||scroll.line(1)||scroll.page(-1)||scroll.toStart()||scroll.toEnd();void moved;
const where:number=scroll.offset+scroll.maximum+scroll.viewportLength+scroll.contentLength,held:boolean=scroll.dragging&&scroll.enabled,along:ScrollAxis=scroll.axis;void where;void held;void along;
const drawn:ScrollThumb|undefined=scroll.thumb;if(drawn!==undefined){const end:number=drawn.start+drawn.length;void end;}
scroll.setLengths(140,400);scroll.setEnabled(false);scroll.dispose();
createScrollControl({viewportLength:1,contentLength:2});
// @ts-expect-error the lengths are required
createScrollControl({wheel});
// @ts-expect-error an axis is 'x' or 'y'
createScrollControl({...options,axis:'z'});
// @ts-expect-error the offset is read through the control, not written
scroll.offset=5;
// @ts-expect-error a thumb needs its track
createScrollControl({...options,thumb:{input,target:bar}});
// @ts-expect-error a line goes one way or the other
scroll.line(2);
// @ts-expect-error the drawn thumb is read-only
if(drawn!==undefined)drawn.start=0;
