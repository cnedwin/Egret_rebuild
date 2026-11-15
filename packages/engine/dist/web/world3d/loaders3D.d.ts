import type { GltfAsset3D, GltfLoadOptions3D } from '../../rendering/world3d/Gltf3D.js';
import type { Ktx2Options3D } from '../../rendering/world3d/Ktx23D.js';
import { CubeTexture3D, Texture3D } from '../../rendering/world3d/Texture3D.js';
import type { TextureOptions3D } from '../../rendering/world3d/Texture3D.js';
export interface LoadOptions3D {
    readonly signal?: AbortSignal;
    /** Upper bound for one downloaded file, in bytes. Defaults to 256 MiB. */
    readonly maxBytes?: number;
}
/** Texture loading options; `transcodeKtx2` handles KTX2 payloads the built-in reader cannot use directly. */
export interface TextureLoadOptions3D extends TextureOptions3D, LoadOptions3D {
    readonly transcodeKtx2?: Ktx2Options3D['transcode'];
}
/** glTF loading options: download limits plus the optional KTX2, meshopt and Draco decoders. */
export interface GltfUrlLoadOptions3D extends LoadOptions3D, Pick<GltfLoadOptions3D, 'transcodeKtx2' | 'decodeMeshopt' | 'decodeDraco'> {
}
/**
 * Load an image or KTX2 file as a texture. `flipY` defaults to true so V = 0 is the bottom
 * row, matching the built-in primitives.
 */
export declare function loadTexture3D(url: string, options?: TextureLoadOptions3D): Promise<Texture3D>;
/** Load six square images in +X, -X, +Y, -Y, +Z, -Z order as a cube texture. */
export declare function loadCubeTexture3D(urls: readonly string[], options?: TextureOptions3D & LoadOptions3D): Promise<CubeTexture3D>;
/** Load a .glb or .gltf file; relative buffer and image URIs resolve against `url`. */
export declare function loadGltfFromUrl3D(url: string, options?: GltfUrlLoadOptions3D): Promise<GltfAsset3D>;
//# sourceMappingURL=loaders3D.d.ts.map