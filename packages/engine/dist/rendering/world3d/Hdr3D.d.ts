import { CubeTexture3D } from './Texture3D.js';
import type { TexturePixels3D } from './Texture3D.js';
export declare const HDR3D_LIMITS: Readonly<{
    readonly maxEdge: 16384;
    readonly maxPixels: 67108864;
}>;
/** Linear RGB floats, three per pixel, top row first. */
export interface HdrImage3D {
    readonly width: number;
    readonly height: number;
    readonly data: Float32Array;
}
/** Decode a Radiance .hdr file (flat or run-length encoded, -Y +X orientation). */
export declare function parseRgbe3D(bytes: Uint8Array): HdrImage3D;
export interface EquirectOptions3D {
    /** Edge of each cube face in texels. */
    readonly size?: number;
    /** Multiplier applied to linear values before they are stored. */
    readonly exposure?: number;
    /**
     * Largest linear value kept. Brighter texels are compressed toward it, so
     * a very bright sun does not clip to a hard white disc.
     */
    readonly maxValue?: number;
}
/**
 * Build a cube texture from an equirectangular panorama. The source is either
 * linear floats (three per pixel, as parseRgbe3D returns) or sRGB bytes (four
 * per pixel). Faces are stored as 8-bit sRGB after exposure and soft
 * compression of highlights.
 */
export declare function createCubeTextureFromEquirect3D(image: HdrImage3D | TexturePixels3D, options?: EquirectOptions3D): CubeTexture3D;
//# sourceMappingURL=Hdr3D.d.ts.map