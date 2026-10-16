// SPDX-License-Identifier: Apache-2.0
import { createSpriteSheet, createSequenceClip, SequencePlayer } from '@egret/engine';
import type { AtlasFrameLayout, SpriteSheetFrameInput, SequenceFrameInput, AssetLease, Texture, Bitmap } from '@egret/engine';
import type { AtlasFrameLayout as RuntimeLayout } from '@egret/runtime';
declare const lease: AssetLease<Texture>;
declare const bitmap: Bitmap;
const layout: AtlasFrameLayout = {sourceWidth:4,sourceHeight:5,trimX:1,trimY:2,packedRotation:90};
const runtime: RuntimeLayout = layout;
const frame: SpriteSheetFrameInput = {name:'A',x:0,y:0,width:2,height:3,layout:runtime};
const sheet = createSpriteSheet(lease,[frame],'trim-rotation-v1');
const sample: SequenceFrameInput = {...sheet.getRegion('A'),durationSeconds:.125};
const clip = createSequenceClip({atlasWidth:6,atlasHeight:6,frames:[sample]},'trim-rotation-v1');
const selected: AtlasFrameLayout | undefined = new SequencePlayer(bitmap,clip).applyAt(0).region.layout;
createSpriteSheet(lease,[frame],undefined);
createSequenceClip({},undefined);
void selected;
