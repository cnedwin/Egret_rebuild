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
    /**
     * Flip rows at upload so V = 0 addresses the bottom row. glTF textures keep this false.
     * WebGL ignores the flag for ImageBitmap sources: decode those with `imageOrientation: 'flipY'`
     * instead, as loadTexture3D does.
     */
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

export interface RenderTargetOptions3D {
    readonly name?: string;
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
export class RenderTarget3D extends Resource3D {
    #width: number;
    #height: number;
    readonly depth: boolean;
    /** Sampled view of the color attachment; its source is this target. */
    readonly texture: Texture3D;
    constructor(width: number, height: number, options: RenderTargetOptions3D = {}) {
        super();
        this.name = options.name ?? '';
        this.#width = requireCount3D(width, 'target width', TEXTURE3D_LIMITS.maxEdge);
        this.#height = requireCount3D(height, 'target height', TEXTURE3D_LIMITS.maxEdge);
        if (this.#width === 0 || this.#height === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'target size');
        this.depth = options.depth ?? true;
        this.texture = new Texture3D(this, {
            mipmaps: false, wrapS: options.wrapS ?? 'clamp', wrapT: options.wrapT ?? 'clamp',
            magFilter: options.magFilter ?? 'linear', minFilter: options.minFilter ?? 'linear', colorSpace: 'srgb',
        });
    }
    get width(): number { return this.#width; }
    get height(): number { return this.#height; }
    /** Reallocate the attachments at a new size; previous contents are discarded. */
    setSize(width: number, height: number): void {
        this.assertLive();
        const w = requireCount3D(width, 'target width', TEXTURE3D_LIMITS.maxEdge), h = requireCount3D(height, 'target height', TEXTURE3D_LIMITS.maxEdge);
        if (w === 0 || h === 0) throw new World3DError('WORLD3D_INPUT_INVALID', 'target size');
        if (w === this.#width && h === this.#height) return;
        this.#width = w; this.#height = h;
        this.touch();
    }
    override dispose(): void {
        try { this.texture.dispose(); } finally { super.dispose(); }
    }
}

/**
 * Procedural sky cube: a vertical gradient from `ground` through `horizon` to
 * `zenith`, in sRGB bytes. Useful as a background and a soft light probe.
 */
export function createGradientCubeTexture3D(zenith: readonly [number, number, number], horizon: readonly [number, number, number],
    ground: readonly [number, number, number], size = 32): CubeTexture3D {
    const edge = requireCount3D(size, 'cube size', 1024);
    if (edge < 2) throw new World3DError('WORLD3D_INPUT_INVALID', 'cube size');
    const faces: TexturePixels3D[] = [];
    for (let face = 0; face < 6; face++) {
        const data = new Uint8Array(edge * edge * 4);
        for (let y = 0; y < edge; y++) {
            for (let x = 0; x < edge; x++) {
                // Texel center on the cube surface, following the OpenGL cube-map face layout.
                const s = (x + 0.5) / edge * 2 - 1, t = (y + 0.5) / edge * 2 - 1;
                let dx = 0, dy = 0, dz = 0;
                if (face === 0) { dx = 1; dy = -t; dz = -s; } else if (face === 1) { dx = -1; dy = -t; dz = s; }
                else if (face === 2) { dx = s; dy = 1; dz = t; } else if (face === 3) { dx = s; dy = -1; dz = -t; }
                else if (face === 4) { dx = s; dy = -t; dz = 1; } else { dx = -s; dy = -t; dz = -1; }
                const up = dy / Math.hypot(dx, dy, dz), from = up >= 0 ? horizon : ground, to = up >= 0 ? zenith : ground;
                const k = up >= 0 ? Math.pow(up, 0.6) : Math.min(1, -up * 4), o = (y * edge + x) * 4;
                const base = up >= 0 ? from : horizon;
                for (let c = 0; c < 3; c++) data[o + c] = Math.round(base[c]! + (to[c]! - base[c]!) * k);
                data[o + 3] = 255;
            }
        }
        faces.push({width: edge, height: edge, data});
    }
    return new CubeTexture3D(faces, {mipmaps: true});
}
