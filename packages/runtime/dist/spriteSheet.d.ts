import type { Disposable, TextureRegion2D } from "@egret/contracts";
import type { AssetLease } from "./AssetLease.js";
import type { Bitmap } from "./Bitmap.js";
import type { Texture } from "./Texture.js";
import type { AtlasFrameLayout } from "./atlasFrameLayout.js";
type AtlasRegion = TextureRegion2D & {
    readonly layout?: AtlasFrameLayout;
};
declare const SPRITE_SHEET_BRAND: unique symbol;
/** One packed absolute rectangle, indexed by its exact UTF-16 name. */
export interface SpriteSheetFrameInput {
    readonly layout?: AtlasFrameLayout;
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
/** Immutable metadata plus a separately revocable borrow of one original lease. */
export interface SpriteSheet extends Disposable {
    readonly [SPRITE_SHEET_BRAND]: void;
    readonly frameCount: number;
    readonly names: readonly string[];
    readonly atlasWidth: number;
    readonly atlasHeight: number;
    readonly isDisposed: boolean;
    getRegion(name: string): AtlasRegion;
    createBitmap(name: string): Bitmap;
    dispose(): void;
}
/** Build one exact-name table from a genuine full-image lease without acquiring another resource. */
export declare function createSpriteSheet(atlasLease: AssetLease<Texture>, frames: readonly SpriteSheetFrameInput[], profile?: "trim-rotation-v1"): SpriteSheet;
export {};
//# sourceMappingURL=spriteSheet.d.ts.map