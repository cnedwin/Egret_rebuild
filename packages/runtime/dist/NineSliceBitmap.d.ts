import type { AssetLease } from "./AssetLease.js";
import { DisplayObject } from "./DisplayObject.js";
import type { NineSliceInsets2D } from "./NineSliceGeometry2D.js";
import type { Texture } from "./Texture.js";
/** Required local panel dimensions and fixed source-crop borders. */
export interface NineSliceBitmapOptions {
    readonly width: number;
    readonly height: number;
    readonly insets: NineSliceInsets2D;
}
/** A resizable stretch-only leaf borrowing one exact, caller-owned Texture lease. */
export declare class NineSliceBitmap extends DisplayObject {
    private readonly nineSliceBitmapBrand;
    constructor(textureLease: AssetLease<Texture>, options: NineSliceBitmapOptions);
    /** Identity-only borrow metadata conveys no live resource entitlement. */
    get textureLease(): AssetLease<Texture> | undefined;
    get targetWidth(): number;
    get targetHeight(): number;
    get insets(): NineSliceInsets2D;
    resize(width: number, height: number): void;
    /** Drop the borrow before base terminal cleanup; the caller still owns it. */
    dispose(): void;
}
//# sourceMappingURL=NineSliceBitmap.d.ts.map