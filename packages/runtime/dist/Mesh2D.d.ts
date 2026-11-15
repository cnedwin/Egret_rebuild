import type { TexturedGeometry2D, SharedGeometry2D } from "@egret/contracts";
import type { AssetLease } from "./AssetLease.js";
import { DisplayObject } from "./DisplayObject.js";
import type { Texture } from "./Texture.js";
/** A display leaf borrowing an exact lease and an immutable owned geometry. */
export declare class Mesh2D<G extends TexturedGeometry2D | SharedGeometry2D = TexturedGeometry2D> extends DisplayObject {
    /** Opaque producer binding: scene traversal exposes neither its borrowed lease nor a content writer. */
    static createBinding<G extends TexturedGeometry2D | SharedGeometry2D>(textureLease: AssetLease<Texture>, geometry: G): {
        readonly node: DisplayObject;
        prepare(lease: AssetLease<Texture>, geometry: G): {
            commit(): void;
            abort(): void;
        };
        beginDispose(): () => void;
        dispose(): void;
    };
    constructor(textureLease: AssetLease<Texture>, geometry: G);
    /** Cached identity-only reads remain valid after clear or terminal disposal. */
    get textureLease(): AssetLease<Texture> | undefined;
    get geometry(): G | undefined;
    setContent(textureLease: AssetLease<Texture>, geometry: G): void;
    /** Clearing drops only cached content; Engine affinity and caller borrows stay. */
    clear(): void;
    /** Drop the slot before base cleanup; terminal callback reentry sees no content. */
    dispose(): void;
}
//# sourceMappingURL=Mesh2D.d.ts.map