import type { TexturedGeometry2D } from "@egret/contracts";
/** Border widths in the same units as the unrotated source crop. */
export interface NineSliceInsets2D {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
}
export interface NineSliceGeometry2DOptions {
    readonly sourceWidth: number;
    readonly sourceHeight: number;
    readonly targetWidth: number;
    readonly targetHeight: number;
    readonly insets: NineSliceInsets2D;
}
/** Create an owned immutable stretch grid for an existing Mesh2D texture lease. */
export declare function createNineSliceGeometry2D(options: NineSliceGeometry2DOptions): TexturedGeometry2D;
//# sourceMappingURL=NineSliceGeometry2D.d.ts.map