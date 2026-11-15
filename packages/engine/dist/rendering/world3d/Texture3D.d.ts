import { Resource3D } from './core3D.js';
export type TextureWrap3D = 'repeat' | 'clamp' | 'mirror';
export type TextureFilter3D = 'nearest' | 'linear';
export type TextureColorSpace3D = 'srgb' | 'linear';
export declare const TEXTURE3D_LIMITS: Readonly<{
    readonly maxEdge: 8192;
    readonly maxBytes: 268435456;
}>;
/** Tightly packed straight-alpha RGBA8 rows, top row first. */
export interface TexturePixels3D {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8Array;
}
/** Owned pixels, or a host image object carrying its own dimensions. */
/** Block-compressed GPU formats that can be uploaded without transcoding. */
export type CompressedFormat3D = 'bc1' | 'bc3' | 'bc7' | 'etc2-rgb8' | 'etc2-rgba8' | 'astc-4x4';
/** Bytes per 4x4 block of each compressed format. */
export declare const COMPRESSED_BLOCK_BYTES_3D: Readonly<Record<CompressedFormat3D, number>>;
/**
 * A pre-compressed mip chain, largest level first. Each level halves the
 * previous one and stores whole 4x4 blocks. Support depends on the device:
 * ask the renderer with supportsCompressedFormat() before choosing a format.
 */
export interface CompressedPixels3D {
    readonly width: number;
    readonly height: number;
    readonly format: CompressedFormat3D;
    readonly levels: readonly Uint8Array[];
}
export type TextureSource3D = TexturePixels3D | CompressedPixels3D | object;
export declare function isCompressedPixels3D(source: unknown): source is CompressedPixels3D;
export interface TextureOptions3D {
    readonly name?: string;
    readonly wrapS?: TextureWrap3D;
    readonly wrapT?: TextureWrap3D;
    readonly magFilter?: TextureFilter3D;
    readonly minFilter?: TextureFilter3D;
    readonly mipmaps?: boolean;
    readonly colorSpace?: TextureColorSpace3D;
    readonly flipY?: boolean;
    readonly anisotropy?: number;
    /** Texture coordinate set to sample with: 0 for `uv`, 1 for `uv1`. */
    readonly channel?: 0 | 1;
}
export declare function isTexturePixels3D(source: unknown): source is TexturePixels3D;
declare abstract class TextureBase3D extends Resource3D {
    wrapS: TextureWrap3D;
    wrapT: TextureWrap3D;
    magFilter: TextureFilter3D;
    minFilter: TextureFilter3D;
    /** Generate a full mip chain and sample it trilinearly. */
    mipmaps: boolean;
    /** Color textures are 'srgb'; data textures (normal, roughness, occlusion) are 'linear'. */
    colorSpace: TextureColorSpace3D;
    /**
     * Flip rows at upload so V = 0 addresses the bottom row. glTF textures keep this false.
     * WebGL ignores the flag for ImageBitmap sources: decode those with `imageOrientation: 'flipY'`
     * instead, as loadTexture3D does.
     */
    flipY: boolean;
    anisotropy: number;
    /**
     * Texture coordinate set used when this texture is a material's occlusion
     * or emissive map: 0 reads `uv`, 1 reads `uv1`, the usual home of baked
     * lighting. Other map slots always use `uv`.
     */
    channel: 0 | 1;
    protected constructor(options: TextureOptions3D);
}
export declare class Texture3D extends TextureBase3D {
    #private;
    /** UV transform applied as: uv' = rotate(uv * repeat) + offset. */
    readonly offset: Float32Array<ArrayBuffer>;
    readonly repeat: Float32Array<ArrayBuffer>;
    rotation: number;
    constructor(source: TextureSource3D, options?: TextureOptions3D);
    get source(): TextureSource3D;
    /** Replace the pixel source and schedule a backend upload. */
    setSource(source: TextureSource3D): void;
    /** True when offset, repeat or rotation differ from the identity transform. */
    get hasTransform(): boolean;
}
/** Six square faces in +X, -X, +Y, -Y, +Z, -Z order. */
export declare class CubeTexture3D extends TextureBase3D {
    readonly faces: readonly TextureSource3D[];
    constructor(faces: readonly TextureSource3D[], options?: TextureOptions3D);
}
/** Single-color 1x1 texture, useful as a placeholder or constant map. */
export declare function createSolidTexture3D(r: number, g: number, b: number, a?: number, options?: TextureOptions3D): Texture3D;
/** Color storage of a render target: 8-bit sRGB, or half-float linear for values above 1. */
export type RenderTargetFormat3D = 'rgba8' | 'rgba16f';
export interface RenderTargetOptions3D {
    readonly name?: string;
    /**
     * 'rgba16f' keeps unclamped linear light and skips tone mapping, for
     * post-processing. Backends without float targets fall back to 'rgba8'.
     */
    readonly format?: RenderTargetFormat3D;
    /** Keep depth in a texture the post-processing chain can read, instead of a write-only buffer. */
    readonly depthTexture?: boolean;
    /** Attach a depth buffer so the target can be rendered with depth testing. */
    readonly depth?: boolean;
    readonly magFilter?: TextureFilter3D;
    readonly minFilter?: TextureFilter3D;
    readonly wrapS?: TextureWrap3D;
    readonly wrapT?: TextureWrap3D;
}
/**
 * Off-screen color target. Render a scene into it, then use `texture` as any
 * material map. A backend owns the pixels; the CPU side only carries the size.
 */
export declare class RenderTarget3D extends Resource3D {
    #private;
    readonly depth: boolean;
    readonly format: RenderTargetFormat3D;
    readonly depthTexture: boolean;
    /** Sampled view of the color attachment; its source is this target. */
    readonly texture: Texture3D;
    constructor(width: number, height: number, options?: RenderTargetOptions3D);
    get width(): number;
    get height(): number;
    /** Reallocate the attachments at a new size; previous contents are discarded. */
    setSize(width: number, height: number): void;
    dispose(): void;
}
/**
 * Procedural sky cube: a vertical gradient from `ground` through `horizon` to
 * `zenith`, in sRGB bytes. Useful as a background and a soft light probe.
 */
export declare function createGradientCubeTexture3D(zenith: readonly [number, number, number], horizon: readonly [number, number, number], ground: readonly [number, number, number], size?: number): CubeTexture3D;
export {};
//# sourceMappingURL=Texture3D.d.ts.map