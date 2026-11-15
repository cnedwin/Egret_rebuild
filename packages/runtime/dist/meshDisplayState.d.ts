import type { TexturedGeometry2D, SharedGeometry2D, TextureRegion2D, TextureViewRegion2D } from "@egret/contracts";
import type { AssetLease } from "./AssetLease.js";
import type { DisplayObject } from "./DisplayObject.js";
import type { Texture } from "./Texture.js";
export interface MeshCaptureState {
    readonly lease: AssetLease<Texture>;
    readonly geometry: TexturedGeometry2D | SharedGeometry2D;
    readonly sourceRect: TextureRegion2D;
    readonly viewRegion: TextureViewRegion2D | null;
    readonly regionOnly: boolean;
}
/** Slot registration survives cleanup; it is not display-class identity. */
export declare function hasMeshState(value: unknown): boolean;
/** Cached content conveys no active lease entitlement or live Texture authority. */
export declare function readMeshState(node: DisplayObject): MeshCaptureState | undefined;
/** Authentic Mesh2D/NineSliceBitmap operations publish only privately admitted content. */
export declare function writeMeshState(node: DisplayObject, value: MeshCaptureState | undefined): void;
//# sourceMappingURL=meshDisplayState.d.ts.map