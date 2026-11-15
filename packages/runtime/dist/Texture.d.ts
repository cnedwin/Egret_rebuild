import type { ImageData2D, TextureRegion2D, TextureViewRegionInput2D, TextureViewRegion2D } from "@egret/contracts";
/** An immutable CPU image view with a separate, terminal wrapper lifetime. */
export declare class Texture {
    private readonly textureBrand;
    private constructor();
    get imageData(): ImageData2D;
    get sourceRect(): TextureRegion2D;
    get viewRegion(): TextureViewRegion2D | null;
    get width(): number;
    get height(): number;
    get isDisposed(): boolean;
    /** Drop only the wrapper reference; saved image values keep their own pixels. */
    dispose(): void;
}
export declare function createTexture(image: ImageData2D, sourceRect?: TextureRegion2D): Texture;
/** Create an explicit logical view over an authentic straight CPU image. */
export declare function createTextureView(image: ImageData2D, region: TextureViewRegionInput2D): Texture;
/** Brand-only: disposal does not change the identity of a Texture. */
export declare function isTexture(value: unknown): value is Texture;
export interface TextureSnapshot2D {
    readonly image: ImageData2D;
    readonly sourceRect: TextureRegion2D;
    readonly viewRegion: TextureViewRegion2D | null;
}
/** The image alone, under the checks of `readTextureSnapshot` and without a record of its own. */
export declare function readTextureImage(texture: Texture): ImageData2D;
/** Runtime-private authority; never consult subclass-overridable getters. */
export declare function readTextureSnapshot(texture: Texture): TextureSnapshot2D;
//# sourceMappingURL=Texture.d.ts.map