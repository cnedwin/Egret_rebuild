// SPDX-License-Identifier: Apache-2.0
import {createSpriteSheet,createSequenceClip,SequencePlayer} from '@egret/engine';
import type {AtlasFrameLayout,AssetLease,Texture,SpriteSheet,SequenceRegion} from '@egret/engine';
declare const lease: AssetLease<Texture>;
declare const sheet: SpriteSheet;
declare const region: SequenceRegion;
declare const layout: AtlasFrameLayout;
// ATLAS_CASE profile-spelling
createSpriteSheet(lease,[],'trim-rotation-v2');
// ATLAS_CASE profile-type
createSequenceClip({},{});
// ATLAS_CASE rotation-enumeration
const bad: AtlasFrameLayout={sourceWidth:4,sourceHeight:5,trimX:1,trimY:1,packedRotation:180};
// ATLAS_CASE readonly-layout
layout.trimX=2;
// ATLAS_CASE readonly-region-layout
region.layout=layout;
// ATLAS_CASE readonly-lookup-layout
sheet.getRegion('A').layout=layout;
// ATLAS_CASE forged-receiver
const forged: SequencePlayer = {};
// ATLAS_CASE erased-layout
new AtlasFrameLayout();
void bad;
