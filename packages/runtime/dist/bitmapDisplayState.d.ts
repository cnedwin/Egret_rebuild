import type { AtlasFrameLayout } from './atlasFrameLayout.js';
import type { DisplayObject } from './DisplayObject.js';
import type { AssetLease } from './AssetLease.js';
import type { Texture } from './Texture.js';
import type { TextureRegion2D, TextureViewRegion2D } from '@egret/contracts';
export interface BitmapCaptureState {
    readonly layout?: AtlasFrameLayout;
    readonly lease: AssetLease<Texture>;
    readonly sourceRect: TextureRegion2D;
    readonly viewRegion: TextureViewRegion2D | null;
    readonly width: number;
    readonly height: number;
}
/** Call-local internal read view; it grants no lease or published-state authority. */
export interface BitmapCaptureView {
    read(node: DisplayObject): BitmapCaptureState | undefined;
}
/** A registered cleared slot remains different from an unregistered receiver. */
export declare function hasBitmapState(value: unknown): boolean;
/** Read cached metadata only; this port grants no live image entitlement. */
export declare function readBitmapState(node: DisplayObject): BitmapCaptureState | undefined;
/** Bitmap alone writes its slot, preserving existing mutation/lifetime guards. */
export declare function writeBitmapState(node: DisplayObject, value: BitmapCaptureState | undefined): void;
//# sourceMappingURL=bitmapDisplayState.d.ts.map