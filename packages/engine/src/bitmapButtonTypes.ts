// SPDX-License-Identifier: Apache-2.0
import type { TextureRegion2D } from '@egret/contracts';
import type { AssetLease, Bitmap, Scope, Texture } from '@egret/runtime';
import type { Engine } from './Engine.js';
import type { MouseInput, MouseInputPayload } from './mouseInputTypes.js';

declare const BITMAP_BUTTON_BRAND: unique symbol;
export type BitmapButtonState = 'up' | 'pressed' | 'disabled' | 'disposed';
export interface BitmapButtonOptions {
  readonly engine: Engine;
  readonly scope: Scope;
  readonly input: MouseInput;
  readonly textureLease: AssetLease<Texture>;
  readonly skins: {
    readonly up: TextureRegion2D;
    readonly pressed: TextureRegion2D;
    readonly disabled: TextureRegion2D;
  };
  readonly enabled?: boolean;
  readonly onActivate: (payload: MouseInputPayload) => void;
}
/** A frozen exact-receiver facade; its accessor setter remains usable. */
export interface BitmapButton {
  readonly [BITMAP_BUTTON_BRAND]: void;
  readonly display: Bitmap;
  readonly state: BitmapButtonState;
  enabled: boolean;
  dispose(): void;
}
