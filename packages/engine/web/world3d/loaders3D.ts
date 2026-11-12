// SPDX-License-Identifier: Apache-2.0
// Browser loaders: fetch and decode images into textures, and load glTF
// assets with their external buffers and images resolved against the file URL.
import {World3DError} from '../../rendering/world3d/core3D.js';
import {loadGltf3D} from '../../rendering/world3d/Gltf3D.js';
import type {GltfAsset3D, GltfImageRequest3D, GltfLoadOptions3D} from '../../rendering/world3d/Gltf3D.js';
import {isKtx23D, parseKtx23D} from '../../rendering/world3d/Ktx23D.js';
import type {Ktx2Options3D} from '../../rendering/world3d/Ktx23D.js';
import {CubeTexture3D, Texture3D} from '../../rendering/world3d/Texture3D.js';
import type {TextureOptions3D, TextureSource3D} from '../../rendering/world3d/Texture3D.js';

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
export interface GltfUrlLoadOptions3D extends LoadOptions3D, Pick<GltfLoadOptions3D, 'transcodeKtx2' | 'decodeMeshopt' | 'decodeDraco'> {}

const DEFAULT_MAX_BYTES = 268435456;

async function fetchBytes(url: string, options: LoadOptions3D): Promise<Uint8Array> {
    let response: Response;
    try { response = await fetch(url, options.signal ? {signal: options.signal} : {}); }
    catch (cause) { throw new World3DError('WORLD3D_RESOURCE_FAILED', url, cause); }
    if (!response.ok) throw new World3DError('WORLD3D_RESOURCE_FAILED', url + ' (HTTP ' + response.status + ')');
    const limit = options.maxBytes ?? DEFAULT_MAX_BYTES, declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > limit) throw new World3DError('WORLD3D_BUDGET', url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > limit) throw new World3DError('WORLD3D_BUDGET', url);
    return bytes;
}
async function decode(blob: Blob, url: string, flipY = false): Promise<ImageBitmap> {
    // Decode without color-space conversion or premultiplication: the renderer handles both.
    // Rows are flipped here because WebGL ignores its unpack flip flag for ImageBitmap sources.
    try { return await createImageBitmap(blob, {colorSpaceConversion: 'none', premultiplyAlpha: 'none', imageOrientation: flipY ? 'flipY' : 'from-image'}); }
    catch (cause) { throw new World3DError('WORLD3D_RESOURCE_FAILED', 'image decode: ' + url, cause); }
}

function textureOptions(options: TextureLoadOptions3D): TextureOptions3D {
    const {signal: _signal, maxBytes: _maxBytes, transcodeKtx2: _transcode, ...rest} = options;
    return rest;
}
/**
 * Load an image or KTX2 file as a texture. `flipY` defaults to true so V = 0 is the bottom
 * row, matching the built-in primitives.
 */
export async function loadTexture3D(url: string, options: TextureLoadOptions3D = {}): Promise<Texture3D> {
    const bytes = await fetchBytes(url, options);
    if (isKtx23D(bytes)) {
        // KTX2 rows are stored top-down and cannot be flipped once block-compressed.
        const parsed = await parseKtx23D(bytes, options.transcodeKtx2 ? {transcode: options.transcodeKtx2} : {});
        const levels = 'levels' in parsed.source ? parsed.source.levels.length : 1;
        return new Texture3D(parsed.source, {...textureOptions(options), colorSpace: options.colorSpace ?? parsed.colorSpace, flipY: false, mipmaps: levels > 1, name: options.name ?? url});
    }
    const bitmap = await decode(new Blob([bytes as BlobPart]), url, options.flipY ?? true);
    // The bitmap is already oriented, so the texture itself must not flip again.
    const texture = new Texture3D(bitmap, {...textureOptions(options), flipY: false, name: options.name ?? url});
    // The decoded bitmap is owned by the texture from here on.
    texture.onDispose(() => bitmap.close());
    return texture;
}
/** Load six square images in +X, -X, +Y, -Y, +Z, -Z order as a cube texture. */
export async function loadCubeTexture3D(urls: readonly string[], options: TextureOptions3D & LoadOptions3D = {}): Promise<CubeTexture3D> {
    if (!Array.isArray(urls) || urls.length !== 6) throw new World3DError('WORLD3D_INPUT_INVALID', 'cube urls');
    const settled = await Promise.allSettled(urls.map(async url => decode(new Blob([await fetchBytes(url, options) as BlobPart]), url)));
    const bitmaps = settled.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    const failure = settled.find(result => result.status === 'rejected');
    if (failure) {
        for (const bitmap of bitmaps) bitmap.close();
        throw (failure as PromiseRejectedResult).reason;
    }
    const texture = new CubeTexture3D(bitmaps, {...options, name: options.name ?? urls[0]!});
    texture.onDispose(() => { for (const bitmap of bitmaps) bitmap.close(); });
    return texture;
}

/** Load a .glb or .gltf file; relative buffer and image URIs resolve against `url`. */
export async function loadGltfFromUrl3D(url: string, options: GltfUrlLoadOptions3D = {}): Promise<GltfAsset3D> {
    const base = new URL(url, typeof location === 'undefined' ? 'http://localhost/' : location.href);
    const resolve = (uri: string): string => new URL(uri, base).href;
    const bitmaps: ImageBitmap[] = [];
    let abandoned = false;
    const closeBitmaps = (): void => { for (const bitmap of bitmaps.splice(0)) bitmap.close(); };
    const decodeImage = async (request: GltfImageRequest3D): Promise<TextureSource3D> => {
        const bytes = request.bytes ?? await fetchBytes(resolve(request.uri ?? ''), options);
        const bitmap = await decode(new Blob([bytes as BlobPart], request.mimeType ? {type: request.mimeType} : {}), request.uri ?? 'embedded image ' + request.index);
        // A sibling decode can reject before this ImageBitmap becomes available.
        if (abandoned) {
            bitmap.close();
            throw new World3DError('WORLD3D_RESOURCE_FAILED', 'asset already failed: ' + base.href);
        }
        bitmaps.push(bitmap);
        return bitmap;
    };
    try {
        const asset = await loadGltf3D(await fetchBytes(base.href, options), {
            decodeImage, loadBuffer: uri => fetchBytes(resolve(uri), options),
            ...(options.transcodeKtx2 ? {transcodeKtx2: options.transcodeKtx2} : {}), ...(options.decodeMeshopt ? {decodeMeshopt: options.decodeMeshopt} : {}),
            ...(options.decodeDraco ? {decodeDraco: options.decodeDraco} : {}),
        });
        const dispose = asset.dispose.bind(asset);
        // Close decoded bitmaps together with the rest of the asset.
        return {...asset, dispose: () => { try { dispose(); } finally { closeBitmaps(); } }};
    } catch (cause) {
        abandoned = true;
        closeBitmaps();
        throw cause;
    }
}
