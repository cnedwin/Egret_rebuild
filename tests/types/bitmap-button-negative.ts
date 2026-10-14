// SPDX-License-Identifier: Apache-2.0
// Unsuppressed compile-only misuse. Freeze complete tuples only from actual tsc.
import {createBitmapButton} from '@egret/engine/web/input';
import type {BitmapButtonOptions,BitmapButton,BitmapButtonState} from '@egret/engine/web/input';
import type {Bitmap} from '@egret/engine';
import {createBitmapButton as forbiddenRootFactory} from '@egret/engine';
declare const options:BitmapButtonOptions;
declare const button:BitmapButton;
declare const bitmap:Bitmap;
// BITMAP_BUTTON_CASE required-options
createBitmapButton();
// BITMAP_BUTTON_CASE genuine-input
createBitmapButton({...options,input:{}});
// BITMAP_BUTTON_CASE genuine-lease
createBitmapButton({...options,textureLease:{}});
// BITMAP_BUTTON_CASE strict-boolean
createBitmapButton({...options,enabled:'true'});
// BITMAP_BUTTON_CASE no-null-default
createBitmapButton({...options,enabled:null});
// BITMAP_BUTTON_CASE numeric-crop
createBitmapButton({...options,skins:{...options.skins,up:{x:0,y:0,width:'8',height:6}}});
// BITMAP_BUTTON_CASE all-three-skins
createBitmapButton({...options,skins:{up:options.skins.up,pressed:options.skins.pressed}});
// BITMAP_BUTTON_CASE function-callback
createBitmapButton({...options,onActivate:0});
// BITMAP_BUTTON_CASE readonly-display
button.display=bitmap;
// BITMAP_BUTTON_CASE readonly-state
button.state='up';
// BITMAP_BUTTON_CASE writable-enabled-still-boolean
button.enabled=1;
// BITMAP_BUTTON_CASE no-hover-state
const state:BitmapButtonState='hover';
// BITMAP_BUTTON_CASE private-handle-brand
const forged:BitmapButton={display:bitmap,state:'up',enabled:true,dispose(){}};
// BITMAP_BUTTON_CASE no-manual-activation
button.activate();
// BITMAP_BUTTON_CASE readonly-options
options.enabled=true;
// BITMAP_BUTTON_CASE erased-control-type
void BitmapButton;
// BITMAP_BUTTON_CASE erased-options-type
void BitmapButtonOptions;
// BITMAP_BUTTON_CASE erased-state-type
void BitmapButtonState;
void[forbiddenRootFactory,state,forged];
