// SPDX-License-Identifier: Apache-2.0
// CPU-side texture descriptions. The pixel source is either owned RGBA bytes
// or an opaque host image (ImageBitmap, canvas, video) that only a backend
// interprets, which keeps this module DOM-free.
import { Resource3D, World3DError, requireCount3D } from './core3D.js';
export const TEXTURE3D_LIMITS = Object.freeze({ maxEdge: 8192, maxBytes: 268435456 });
/** Bytes per 4x4 block of each compressed format. */
export const COMPRESSED_BLOCK_BYTES_3D = Object.freeze({
    'bc1': 8,
    'bc3': 16,
    'bc7': 16,
    'etc2-rgb8': 8,
    'etc2-rgba8': 16,
    'astc-4x4': 16
});
export function isCompressedPixels3D(source) {
    return (typeof source === 'object' &&
        source !== null &&
        Array.isArray(source.levels) &&
        typeof source.format === 'string');
}
export function isTexturePixels3D(source) {
    return typeof source === 'object' && source !== null && source.data instanceof Uint8Array;
}
function checkSource(source) {
    if (typeof source !== 'object' || source === null)
        throw new World3DError('WORLD3D_INPUT_INVALID', 'texture source');
    if (isCompressedPixels3D(source)) {
        const block = COMPRESSED_BLOCK_BYTES_3D[source.format];
        if (block === undefined)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'compressed format');
        let width = requireCount3D(source.width, 'texture width', TEXTURE3D_LIMITS.maxEdge), height = requireCount3D(source.height, 'texture height', TEXTURE3D_LIMITS.maxEdge);
        if (width === 0 || height === 0 || source.levels.length === 0 || source.levels.length > 14)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'compressed levels');
        for (const level of source.levels) {
            if (!(level instanceof Uint8Array) || level.byteLength !== Math.ceil(width / 4) * Math.ceil(height / 4) * block)
                throw new World3DError('WORLD3D_INPUT_INVALID', 'compressed level size');
            width = Math.max(1, width >> 1);
            height = Math.max(1, height >> 1);
        }
        return;
    }
    if (!isTexturePixels3D(source))
        return;
    const width = requireCount3D(source.width, 'texture width', TEXTURE3D_LIMITS.maxEdge);
    const height = requireCount3D(source.height, 'texture height', TEXTURE3D_LIMITS.maxEdge);
    if (width === 0 || height === 0 || source.data.byteLength !== width * height * 4)
        throw new World3DError('WORLD3D_INPUT_INVALID', 'texture pixels');
}
class TextureBase3D extends Resource3D {
    wrapS;
    wrapT;
    magFilter;
    minFilter;
    /** Generate a full mip chain and sample it trilinearly. */
    mipmaps;
    /** Color textures are 'srgb'; data textures (normal, roughness, occlusion) are 'linear'. */
    colorSpace;
    /**
     * Flip rows at upload so V = 0 addresses the bottom row. glTF textures keep this false.
     * WebGL ignores the flag for ImageBitmap sources: decode those with `imageOrientation: 'flipY'`
     * instead, as loadTexture3D does.
     */
    flipY;
    anisotropy;
    /**
     * Texture coordinate set used when this texture is a material's occlusion
     * or emissive map: 0 reads `uv`, 1 reads `uv1`, the usual home of baked
     * lighting. Other map slots always use `uv`.
     */
    channel;
    constructor(options) {
        super();
        if (options.channel !== undefined && options.channel !== 0 && options.channel !== 1)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'texture channel');
        this.channel = options.channel ?? 0;
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
    #source;
    /** UV transform applied as: uv' = rotate(uv * repeat) + offset. */
    offset = new Float32Array([0, 0]);
    repeat = new Float32Array([1, 1]);
    rotation = 0;
    constructor(source, options = {}) {
        super(options);
        checkSource(source);
        this.#source = source;
    }
    get source() {
        return this.#source;
    }
    /** Replace the pixel source and schedule a backend upload. */
    setSource(source) {
        this.assertLive();
        checkSource(source);
        this.#source = source;
        this.touch();
    }
    /** True when offset, repeat or rotation differ from the identity transform. */
    get hasTransform() {
        return (this.offset[0] !== 0 ||
            this.offset[1] !== 0 ||
            this.repeat[0] !== 1 ||
            this.repeat[1] !== 1 ||
            this.rotation !== 0);
    }
}
/** Six square faces in +X, -X, +Y, -Y, +Z, -Z order. */
export class CubeTexture3D extends TextureBase3D {
    faces;
    constructor(faces, options = {}) {
        super({ wrapS: 'clamp', wrapT: 'clamp', ...options });
        if (!Array.isArray(faces) || faces.length !== 6)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'cube faces');
        for (const face of faces)
            checkSource(face);
        this.faces = Object.freeze([...faces]);
    }
}
/** Single-color 1x1 texture, useful as a placeholder or constant map. */
export function createSolidTexture3D(r, g, b, a = 255, options = {}) {
    return new Texture3D({ width: 1, height: 1, data: new Uint8Array([r, g, b, a]) }, { mipmaps: false, ...options });
}
/**
 * Off-screen color target. Render a scene into it, then use `texture` as any
 * material map. A backend owns the pixels; the CPU side only carries the size.
 */
export class RenderTarget3D extends Resource3D {
    #width;
    #height;
    depth;
    format;
    depthTexture;
    /** Sampled view of the color attachment; its source is this target. */
    texture;
    constructor(width, height, options = {}) {
        super();
        this.name = options.name ?? '';
        this.#width = requireCount3D(width, 'target width', TEXTURE3D_LIMITS.maxEdge);
        this.#height = requireCount3D(height, 'target height', TEXTURE3D_LIMITS.maxEdge);
        if (this.#width === 0 || this.#height === 0)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'target size');
        this.depth = options.depth ?? true;
        if (options.format !== undefined && options.format !== 'rgba8' && options.format !== 'rgba16f')
            throw new World3DError('WORLD3D_INPUT_INVALID', 'target format');
        this.format = options.format ?? 'rgba8';
        this.depthTexture = this.depth && (options.depthTexture ?? false);
        this.texture = new Texture3D(this, {
            mipmaps: false,
            wrapS: options.wrapS ?? 'clamp',
            wrapT: options.wrapT ?? 'clamp',
            magFilter: options.magFilter ?? 'linear',
            minFilter: options.minFilter ?? 'linear',
            colorSpace: this.format === 'rgba16f' ? 'linear' : 'srgb'
        });
    }
    get width() {
        return this.#width;
    }
    get height() {
        return this.#height;
    }
    /** Reallocate the attachments at a new size; previous contents are discarded. */
    setSize(width, height) {
        this.assertLive();
        const w = requireCount3D(width, 'target width', TEXTURE3D_LIMITS.maxEdge), h = requireCount3D(height, 'target height', TEXTURE3D_LIMITS.maxEdge);
        if (w === 0 || h === 0)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'target size');
        if (w === this.#width && h === this.#height)
            return;
        this.#width = w;
        this.#height = h;
        this.touch();
    }
    dispose() {
        try {
            this.texture.dispose();
        }
        finally {
            super.dispose();
        }
    }
}
/**
 * Procedural sky cube: a vertical gradient from `ground` through `horizon` to
 * `zenith`, in sRGB bytes. Useful as a background and a soft light probe.
 */
export function createGradientCubeTexture3D(zenith, horizon, ground, size = 32) {
    const edge = requireCount3D(size, 'cube size', 1024);
    if (edge < 2)
        throw new World3DError('WORLD3D_INPUT_INVALID', 'cube size');
    const faces = [];
    for (let face = 0; face < 6; face++) {
        const data = new Uint8Array(edge * edge * 4);
        for (let y = 0; y < edge; y++) {
            for (let x = 0; x < edge; x++) {
                // Texel center on the cube surface, following the OpenGL cube-map face layout.
                const s = ((x + 0.5) / edge) * 2 - 1, t = ((y + 0.5) / edge) * 2 - 1;
                let dx = 0, dy = 0, dz = 0;
                if (face === 0) {
                    dx = 1;
                    dy = -t;
                    dz = -s;
                }
                else if (face === 1) {
                    dx = -1;
                    dy = -t;
                    dz = s;
                }
                else if (face === 2) {
                    dx = s;
                    dy = 1;
                    dz = t;
                }
                else if (face === 3) {
                    dx = s;
                    dy = -1;
                    dz = -t;
                }
                else if (face === 4) {
                    dx = s;
                    dy = -t;
                    dz = 1;
                }
                else {
                    dx = -s;
                    dy = -t;
                    dz = -1;
                }
                const up = dy / Math.hypot(dx, dy, dz), from = up >= 0 ? horizon : ground, to = up >= 0 ? zenith : ground;
                const k = up >= 0 ? Math.pow(up, 0.6) : Math.min(1, -up * 4), o = (y * edge + x) * 4;
                const base = up >= 0 ? from : horizon;
                for (let c = 0; c < 3; c++)
                    data[o + c] = Math.round(base[c] + (to[c] - base[c]) * k);
                data[o + 3] = 255;
            }
        }
        faces.push({ width: edge, height: edge, data });
    }
    return new CubeTexture3D(faces, { mipmaps: true });
}
//# sourceMappingURL=Texture3D.js.map