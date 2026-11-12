// SPDX-License-Identifier: Apache-2.0
// CPU-side texture descriptions. The pixel source is either owned RGBA bytes
// or an opaque host image (ImageBitmap, canvas, video) that only a backend
// interprets, which keeps this module DOM-free.
import {Resource3D, World3DError, requireCount3D} from './core3D.js';

export type TextureWrap3D = 'repeat' | 'clamp' | 'mirror';
export type TextureFilter3D = 'nearest' | 'linear';
export type TextureColorSpace3D = 'srgb' | 'linear';
export const TEXTURE3D_LIMITS = Object.freeze({maxEdge: 8192, maxBytes: 268435456} as const);

/** Tightly packed straight-alpha RGBA8 rows, top row first. */
export interface TexturePixels3D {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8Array;
}
/** Owned pixels, or a host image object carrying its own dimensions. */
export type TextureSource3D = TexturePixels3D | object;

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
}

export function isTexturePixels3D(source: unknown): source is TexturePixels3D {
    return typeof source === 'object' && source !== null && (source as TexturePixels3D).data instanceof Uint8Array;
}
function checkSource(source: TextureSource3D): void {
    if (typeof source !== 'object' || source === null) throw new World3DError('WORLD3D_INPUT_INVALID', 'texture source');
    if (!isTexturePixels3D(source)) return;
    const width = requireCount3D(source.width, 'texture width', TEXTURE3D_LIMITS.maxEdge);
    const height = requireCount3D(source.height, 'texture height', TEXTURE3D_LIMITS.maxEdge);
    if (width === 0 || height === 0 || source.data.byteLength !== width * height * 4) throw new World3DError('WORLD3D_INPUT_INVALID', 'texture pixels');
}

abstract class TextureBase3D extends Resource3D {
    wrapS: TextureWrap3D;
    wrapT: TextureWrap3D;
    magFilter: TextureFilter3D;
    minFilter: TextureFilter3D;
    /** Generate a full mip chain and sample it trilinearly. */
    mipmaps: boolean;
    /** Color textures are 'srgb'; data textures (normal, roughness, occlusion) are 'linear'. */
    colorSpace: TextureColorSpace3D;
    /** Flip rows at upload so V = 0 addresses the bottom row. glTF textures keep this false. */
    flipY: boolean;
    anisotropy: number;
    protected constructor(options: TextureOptions3D) {
        super();
        this.name = options.name ?? '';
        this.wrapS = options.wrapS ?? 'repeat';
        this.wrapT = options.wrapT ?? 'repeat';
        this.magFilter = options.magFilter ?? 'linear';
        this.minFilter = options.minFilter ?? 'linear';
        this.mipmaps = options.mipmaps ?? true;
        this.colorSpace = options.colorSpace ?? 'srgb';
        this.flipY = options.flipY ?? false;
        this.anisotropy = options.anisotropy ?? 1;
    }
}

export class Texture3D extends TextureBase3D {
    #source: TextureSource3D;
    /** UV transform applied as: uv' = rotate(uv * repeat) + offset. */
    readonly offset = new Float32Array([0, 0]);
    readonly repeat = new Float32Array([1, 1]);
    rotation = 0;
    constructor(source: TextureSource3D, options: TextureOptions3D = {}) {
        super(options);
        checkSource(source);
        this.#source = source;
    }
    get source(): TextureSource3D { return this.#source; }
    /** Replace the pixel source and schedule a backend upload. */
    setSource(source: TextureSource3D): void {
        this.assertLive();
        checkSource(source);
        this.#source = source;
        this.touch();
    }
    /** True when offset, repeat or rotation differ from the identity transform. */
    get hasTransform(): boolean {
        return this.offset[0] !== 0 || this.offset[1] !== 0 || this.repeat[0] !== 1 || this.repeat[1] !== 1 || this.rotation !== 0;
    }
}

/** Six square faces in +X, -X, +Y, -Y, +Z, -Z order. */
export class CubeTexture3D extends TextureBase3D {
    readonly faces: readonly TextureSource3D[];
    constructor(faces: readonly TextureSource3D[], options: TextureOptions3D = {}) {
        super({wrapS: 'clamp', wrapT: 'clamp', ...options});
        if (!Array.isArray(faces) || faces.length !== 6) throw new World3DError('WORLD3D_INPUT_INVALID', 'cube faces');
        for (const face of faces) checkSource(face);
        this.faces = Object.freeze([...faces]);
    }
}

/** Single-color 1x1 texture, useful as a placeholder or constant map. */
export function createSolidTexture3D(r: number, g: number, b: number, a = 255, options: TextureOptions3D = {}): Texture3D {
    return new Texture3D({width: 1, height: 1, data: new Uint8Array([r, g, b, a])}, {mipmaps: false, ...options});
}
