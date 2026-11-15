import type { CompressedPixels3D, TextureColorSpace3D, TexturePixels3D } from './Texture3D.js';
export interface Ktx2Info3D {
    /** Vulkan format number; 0 marks a Basis Universal payload. */
    readonly vkFormat: number;
    readonly width: number;
    readonly height: number;
    readonly levelCount: number;
    /** 0 none, 1 BasisLZ, 2 Zstandard, 3 zlib. */
    readonly supercompression: number;
    /** Stored level byte ranges, largest level first. */
    readonly levels: readonly Uint8Array[];
    /** The complete file, for transcoders that parse the container themselves. */
    readonly file: Uint8Array;
}
export interface Ktx2Result3D {
    readonly source: TexturePixels3D | CompressedPixels3D;
    readonly colorSpace: TextureColorSpace3D;
}
export interface Ktx2Options3D {
    /** Convert supercompressed or unknown-format payloads, overriding built-in decompression when provided. */
    readonly transcode?: (info: Ktx2Info3D) => Promise<Ktx2Result3D> | Ktx2Result3D;
}
/** True when `bytes` starts with the KTX 2.0 file identifier. */
export declare function isKtx23D(bytes: Uint8Array): boolean;
/** Read a KTX 2.0 file holding one 2D texture and its mip chain. */
export declare function parseKtx23D(bytes: Uint8Array, options?: Ktx2Options3D): Promise<Ktx2Result3D>;
//# sourceMappingURL=Ktx23D.d.ts.map