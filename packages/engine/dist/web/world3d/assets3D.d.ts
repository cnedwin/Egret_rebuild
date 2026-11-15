import type { AssetManager, AssetType } from '@egret/runtime';
import type { GltfAsset3D } from '../../rendering/world3d/Gltf3D.js';
import type { DeserializedScene3D, DeserializeOptions3D } from '../../rendering/world3d/Serialize3D.js';
import { CubeTexture3D, Texture3D } from '../../rendering/world3d/Texture3D.js';
import type { TextureOptions3D } from '../../rendering/world3d/Texture3D.js';
import type { GltfUrlLoadOptions3D, TextureLoadOptions3D } from './loaders3D.js';
/** A loaded glTF file. The reference id is the file URL. */
export declare const GLTF_ASSET_3D: AssetType<GltfAsset3D>;
/** A 2D texture loaded from an image or KTX2 file. The reference id is the file URL. */
export declare const TEXTURE_ASSET_3D: AssetType<Texture3D>;
/**
 * A cube texture. The reference id is a URL containing `{face}`, replaced by
 * px, nx, py, ny, pz and nz in turn.
 */
export declare const CUBE_TEXTURE_ASSET_3D: AssetType<CubeTexture3D>;
/** A scene document written by serializeScene3D. The reference id is the JSON file URL. */
export declare const SCENE_ASSET_3D: AssetType<DeserializedScene3D>;
export interface World3DAssetOptions {
    /** Map a reference id to the URL to download. Defaults to using the id as the URL. */
    readonly resolveUrl?: (id: string) => string;
    /** Upper bound for one downloaded file, in bytes. */
    readonly maxBytes?: number;
    /** Sampling options applied to every texture loaded through TEXTURE_ASSET_3D. */
    readonly texture?: TextureOptions3D;
    /** Sampling options applied to every cube texture. */
    readonly cubeTexture?: TextureOptions3D;
    readonly transcodeKtx2?: TextureLoadOptions3D['transcodeKtx2'];
    readonly decodeMeshopt?: GltfUrlLoadOptions3D['decodeMeshopt'];
    readonly decodeDraco?: GltfUrlLoadOptions3D['decodeDraco'];
    /** Resolve keyed textures referenced by scene documents. */
    readonly resolveTexture?: DeserializeOptions3D['resolveTexture'];
}
/**
 * Register the World3D asset providers on an AssetManager. Call once per
 * Engine, then acquire with `assets.acquire(createAssetRef(GLTF_ASSET_3D, url))`.
 */
export declare function registerWorld3DAssets(assets: AssetManager, options?: World3DAssetOptions): void;
//# sourceMappingURL=assets3D.d.ts.map