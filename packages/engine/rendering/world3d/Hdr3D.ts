// SPDX-License-Identifier: Apache-2.0
// High-dynamic-range environment images: a reader for Radiance .hdr (RGBE)
// files and a converter from an equirectangular panorama to a cube texture
// usable as a background and as image-based lighting.
import {World3DError, requireCount3D} from './core3D.js';
import {linearToSrgb, srgbToLinear} from './math3D.js';
import {CubeTexture3D} from './Texture3D.js';
import type {TexturePixels3D} from './Texture3D.js';

export const HDR3D_LIMITS = Object.freeze({maxEdge: 16384, maxPixels: 67108864} as const);
/** Linear RGB floats, three per pixel, top row first. */
export interface HdrImage3D { readonly width: number; readonly height: number; readonly data: Float32Array }

function fail(detail: string): never { throw new World3DError('WORLD3D_INPUT_INVALID', 'hdr: ' + detail); }

/** Decode a Radiance .hdr file (flat or run-length encoded, -Y +X orientation). */
export function parseRgbe3D(bytes: Uint8Array): HdrImage3D {
    if (!(bytes instanceof Uint8Array)) fail('bytes');
    let offset = 0;
    const line = (): string => {
        let text = '';
        while (offset < bytes.length && bytes[offset] !== 10) { text += String.fromCharCode(bytes[offset]!); offset++; if (text.length > 1024) fail('header line'); }
        offset++;
        return text;
    };
    if (!/^#\?(RADIANCE|RGBE)/.test(line())) fail('signature');
    let format = '';
    for (;;) {
        if (offset >= bytes.length) fail('header');
        const text = line();
        if (text.length === 0) break;
        if (text.startsWith('FORMAT=')) format = text.slice(7).trim();
    }
    if (format !== '' && format !== '32-bit_rle_rgbe') fail('format ' + format);
    const size = /^-Y (\d+) \+X (\d+)$/.exec(line().trim());
    if (!size) fail('orientation');
    const height = Number(size[1]), width = Number(size[2]);
    if (width < 1 || height < 1 || width > HDR3D_LIMITS.maxEdge || height > HDR3D_LIMITS.maxEdge || width * height > HDR3D_LIMITS.maxPixels) throw new World3DError('WORLD3D_BUDGET', 'hdr size');
    const data = new Float32Array(width * height * 3), scanline = new Uint8Array(width * 4);
    for (let y = 0; y < height; y++) {
        if (offset + 4 > bytes.length) fail('truncated');
        if (width >= 8 && width < 32768 && bytes[offset] === 2 && bytes[offset + 1] === 2 && ((bytes[offset + 2]! << 8) | bytes[offset + 3]!) === width) {
            // New-style run-length encoding: the four channels are stored one after another.
            offset += 4;
            for (let channel = 0; channel < 4; channel++) {
                let x = 0;
                while (x < width) {
                    if (offset >= bytes.length) fail('truncated');
                    let count = bytes[offset++]!;
                    if (count > 128) {
                        count -= 128;
                        if (count === 0 || x + count > width || offset >= bytes.length) fail('run');
                        const value = bytes[offset++]!;
                        while (count-- > 0) scanline[x++ * 4 + channel] = value;
                    } else {
                        if (count === 0 || x + count > width || offset + count > bytes.length) fail('run');
                        while (count-- > 0) scanline[x++ * 4 + channel] = bytes[offset++]!;
                    }
                }
            }
        } else {
            if (offset + width * 4 > bytes.length) fail('truncated');
            scanline.set(bytes.subarray(offset, offset + width * 4));
            offset += width * 4;
        }
        for (let x = 0; x < width; x++) {
            const e = scanline[x * 4 + 3]!, o = (y * width + x) * 3;
            if (e === 0) continue;
            const scale = Math.pow(2, e - 136);
            data[o] = scanline[x * 4]! * scale; data[o + 1] = scanline[x * 4 + 1]! * scale; data[o + 2] = scanline[x * 4 + 2]! * scale;
        }
    }
    return {width, height, data};
}

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
export function createCubeTextureFromEquirect3D(image: HdrImage3D | TexturePixels3D, options: EquirectOptions3D = {}): CubeTexture3D {
    const width = image?.width, height = image?.height, source = image?.data;
    const float = source instanceof Float32Array, channels = float ? 3 : 4;
    if (!source || !(width > 0) || !(height > 0) || source.length !== width * height * channels) throw new World3DError('WORLD3D_INPUT_INVALID', 'equirect image');
    const edge = requireCount3D(options.size ?? 256, 'cube size', 2048);
    if (edge < 2) throw new World3DError('WORLD3D_INPUT_INVALID', 'cube size');
    const exposure = options.exposure ?? 1, limit = Math.max(options.maxValue ?? 1, 1e-3), faces: TexturePixels3D[] = [], sample = [0, 0, 0];
    const texel = (x: number, y: number, weight: number): void => {
        const column = ((x % width) + width) % width, row = Math.min(Math.max(y, 0), height - 1), o = (row * width + column) * channels;
        if (float) { sample[0]! += source[o]! * weight; sample[1]! += source[o + 1]! * weight; sample[2]! += source[o + 2]! * weight; }
        else { sample[0]! += srgbToLinear(source[o]! / 255) * weight; sample[1]! += srgbToLinear(source[o + 1]! / 255) * weight; sample[2]! += srgbToLinear(source[o + 2]! / 255) * weight; }
    };
    for (let face = 0; face < 6; face++) {
        const data = new Uint8Array(edge * edge * 4);
        for (let y = 0; y < edge; y++) for (let x = 0; x < edge; x++) {
            // Texel center on the cube surface, following the OpenGL cube-map face layout.
            const s = (x + 0.5) / edge * 2 - 1, t = (y + 0.5) / edge * 2 - 1;
            let dx = 0, dy = 0, dz = 0;
            if (face === 0) { dx = 1; dy = -t; dz = -s; } else if (face === 1) { dx = -1; dy = -t; dz = s; }
            else if (face === 2) { dx = s; dy = 1; dz = t; } else if (face === 3) { dx = s; dy = -1; dz = -t; }
            else if (face === 4) { dx = s; dy = -t; dz = 1; } else { dx = -s; dy = -t; dz = -1; }
            const length = Math.hypot(dx, dy, dz);
            // Longitude wraps around +Y with -Z at the image center; latitude runs top to bottom.
            const u = (Math.atan2(dx, -dz) / (Math.PI * 2) + 0.5) * width - 0.5, v = Math.acos(Math.min(Math.max(dy / length, -1), 1)) / Math.PI * height - 0.5;
            const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
            sample[0] = sample[1] = sample[2] = 0;
            texel(x0, y0, (1 - fx) * (1 - fy)); texel(x0 + 1, y0, fx * (1 - fy)); texel(x0, y0 + 1, (1 - fx) * fy); texel(x0 + 1, y0 + 1, fx * fy);
            const o = (y * edge + x) * 4;
            for (let c = 0; c < 3; c++) {
                const value = sample[c]! * exposure;
                // Reinhard-style shoulder scaled so `limit` maps to 1.
                data[o + c] = Math.round(linearToSrgb(Math.min(value * (1 + value / (limit * limit)) / (1 + value), 1)) * 255);
            }
            data[o + 3] = 255;
        }
        faces.push({width: edge, height: edge, data});
    }
    return new CubeTexture3D(faces, {colorSpace: 'srgb', mipmaps: true, name: 'equirect'});
}
