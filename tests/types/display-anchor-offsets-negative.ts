// SPDX-License-Identifier: Apache-2.0
// Deliberately unsuppressed compile-only misuse. Actual compiler receipts, not
// this source, establish diagnostic tuples after the selected declaration exists.
import { DisplayObject, Sprite } from '@egret/engine';
import type { Bitmap, Stage } from '@egret/engine';

declare const node:DisplayObject;
declare const sprite:Sprite;
declare const bitmap:Bitmap;
declare const stage:Stage;
node.anchorOffsetX='4';
node.anchorOffsetY=null;
sprite.anchorOffsetX=undefined;
sprite.anchorOffsetY={valueOf:()=>2};
bitmap.anchorOffsetX=true;
bitmap.anchorOffsetY=[];
stage.anchorOffsetX=1n;
stage.anchorOffsetY=()=>1;
const wrongX:string=node.anchorOffsetX;
const wrongY:boolean=node.anchorOffsetY;
void [wrongX,wrongY];
