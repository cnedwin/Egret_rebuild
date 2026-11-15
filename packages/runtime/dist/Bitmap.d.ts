import type { SequenceRegion } from "./sequenceClip.js";
import type { ImageData2D, TextureRegion2D } from "@egret/contracts";
import { AssetLease } from "./AssetLease.js";
import { DisplayObject } from "./DisplayObject.js";
import type { BitmapCaptureState } from "./bitmapDisplayState.js";
export type { BitmapCaptureState } from "./bitmapDisplayState.js";
import type { Texture, TextureSnapshot2D } from "./Texture.js";
/** Internal-only original Bitmap operations; neither public root forwards this port. */
export declare let spriteSheetBitmapOperations: Readonly<{
    construct(lease: AssetLease<Texture>): Bitmap;
    setCrop(bitmap: Bitmap, region: TextureRegion2D): void;
    dispose(bitmap: Bitmap): void;
}>;
/** A leaf borrowing one exact lease; engine affinity outlives clearing its slot. */
export declare class Bitmap extends DisplayObject {
    constructor(textureLease: AssetLease<Texture>);
    get textureLease(): AssetLease<Texture> | undefined;
    set textureLease(value: AssetLease<Texture> | undefined);
    /** Cached metadata remains readable without granting live image entitlement. */
    get sourceRect(): TextureRegion2D | undefined;
    set sourceRect(value: TextureRegion2D | undefined);
    get naturalWidth(): number;
    get naturalHeight(): number;
    /** Drop the borrow before base cleanup/reentry; the caller still owns the lease. */
    dispose(): void;
}
/** Brand and slot only: geometry may be validated before any lease read. */
export declare function bitmapCaptureState(node: DisplayObject): BitmapCaptureState | undefined;
/** Internal binding authority; a cleared slot remains distinguishable from retirement. */
export declare function readBitmapBinding(node: Bitmap): BitmapCaptureState | undefined;
/** Exact entitlement precedes value/live checks; public value getters are not authority. */
export declare function readBitmapImage(lease: AssetLease<Texture>): TextureSnapshot2D;
/**
 * The image of a lease that `readBitmapImage` has admitted before: the same entitlement, value and live
 * checks with the same refusals, and no record made. A lease stays a lease, so that one check is not repeated.
 */
export declare function readBitmapSource(lease: AssetLease<Texture>): ImageData2D;
/** Private complete-frame bridge; public crop setters deliberately ignore layout. */
export declare function applyBitmapAtlasFrame(bitmap: Bitmap, region: SequenceRegion): void;
//# sourceMappingURL=Bitmap.d.ts.map