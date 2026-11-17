// SPDX-License-Identifier: Apache-2.0
// Textures from pictures the way every browser can make them: PNG, JPEG, WebP,
// GIF or AVIF bytes are decoded by the browser itself, drawn onto a canvas and
// read back as straight RGBA bytes. A canvas the game painted becomes a texture
// the same way. This is the forgiving route: it accepts what the browser can
// show, and it scales a picture down to the 2D image limits instead of refusing
// it. `createBrowserTextureProvider` remains the strict PNG route for manifests
// that pin exact bytes.
import { createImageData2D, IMAGE_LIMITS_2D } from '@egret/contracts';
import { createTexture, EgretError } from '@egret/runtime';
import type { AssetLoadContext, AssetProvider, AssetRef, Texture } from '@egret/runtime';

/** What `textureFromCanvas` and `decodeBrowserImage` can read pixels from. */
export type BrowserImageSource =
  | HTMLCanvasElement
  | OffscreenCanvas
  | HTMLImageElement
  | ImageBitmap
  | { readonly width: number; readonly height: number };

/** The picture formats the browser route recognises by their first bytes. */
export type BrowserImageFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'avif';

export interface BrowserImagePorts {
  /** A fresh canvas of the given size with a 2D context that can be read back. */
  readonly createCanvas: (width: number, height: number) => BrowserImageCanvas;
  /** Decodes encoded bytes into something a 2D context can draw. */
  readonly decode: (bytes: Uint8Array<ArrayBuffer>, type: string) => Promise<BrowserDecodedImage>;
}
export interface BrowserImageCanvas {
  width: number;
  height: number;
  getContext(kind: '2d', options?: { willReadFrequently?: boolean }): BrowserImageContext | null;
}
export interface BrowserImageContext {
  drawImage(source: unknown, x: number, y: number, width: number, height: number): void;
  getImageData(x: number, y: number, width: number, height: number): { readonly data: Uint8ClampedArray };
}
export interface BrowserDecodedImage {
  readonly source: unknown;
  readonly width: number;
  readonly height: number;
  /** Frees what decoding held; called once the pixels are read. */
  readonly release?: () => void;
}

export interface BrowserImageOptions {
  /** Largest area kept, in pixels; larger pictures are scaled down. At most the 2D image limit. */
  readonly maxPixels?: number;
  /** Longest edge kept, in pixels. At most the 2D image limit. */
  readonly maxEdge?: number;
  /** Replaces the browser operations, for tests or other hosts. */
  readonly ports?: BrowserImagePorts;
}
export interface BrowserImageTextureProviderOptions extends BrowserImageOptions {
  /** Reads the encoded bytes a reference names. */
  readonly readBytes: (ref: AssetRef<Texture>, context: AssetLoadContext) => Promise<Uint8Array<ArrayBuffer>>;
}

const MIME: Record<BrowserImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif'
};

/** The picture format the bytes start with, or undefined when they start like none of them. */
export function sniffBrowserImageFormat(bytes: Uint8Array): BrowserImageFormat | undefined {
  const at = (i: number) => bytes[i] ?? -1;
  const ascii = (i: number, text: string) => [...text].every((c, k) => at(i + k) === c.charCodeAt(0));
  if (at(0) === 0x89 && ascii(1, 'PNG')) return 'png';
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'jpeg';
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'webp';
  if (ascii(0, 'GIF8')) return 'gif';
  if (ascii(4, 'ftyp') && (ascii(8, 'avif') || ascii(8, 'avis'))) return 'avif';
  return undefined;
}

function fail(code: string, cause: unknown): never {
  throw new EgretError(code, { cause });
}

/** The size a picture is read at: its own, or scaled down evenly to fit both limits. */
export function fitBrowserImageSize(
  width: number,
  height: number,
  options: Pick<BrowserImageOptions, 'maxPixels' | 'maxEdge'> = {}
): { width: number; height: number } {
  if (!(width >= 1 && height >= 1) || !Number.isFinite(width) || !Number.isFinite(height))
    fail('BROWSER_IMAGE_SIZE_INVALID', new RangeError(`${width} x ${height}`));
  const maxPixels = Math.min(options.maxPixels ?? Infinity, IMAGE_LIMITS_2D.maxSourcePixels);
  const maxEdge = Math.min(options.maxEdge ?? Infinity, IMAGE_LIMITS_2D.maxSourceEdge);
  if (!(maxPixels >= 1) || !(maxEdge >= 1)) fail('BROWSER_IMAGE_SIZE_INVALID', new RangeError('limits'));
  const scale = Math.min(1, Math.sqrt(maxPixels / (width * height)), maxEdge / Math.max(width, height));
  let w = Math.max(1, Math.floor(width * scale)),
    h = Math.max(1, Math.floor(height * scale));
  // Rounding can leave the area a pixel row over; take it off the longer side.
  while (w * h > maxPixels) w >= h ? w-- : h--;
  return { width: Math.min(w, maxEdge), height: Math.min(h, maxEdge) };
}

function browserPorts(): BrowserImagePorts {
  const doc = (globalThis as { document?: Document }).document;
  const createCanvas = (width: number, height: number): BrowserImageCanvas => {
    let canvas: BrowserImageCanvas;
    if (typeof OffscreenCanvas === 'function')
      canvas = new OffscreenCanvas(width, height) as unknown as BrowserImageCanvas;
    else if (doc) canvas = doc.createElement('canvas') as unknown as BrowserImageCanvas;
    else fail('BROWSER_IMAGE_UNAVAILABLE', new TypeError('No canvas'));
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };
  const decode = async (bytes: Uint8Array<ArrayBuffer>, type: string): Promise<BrowserDecodedImage> => {
    const blob = new Blob([bytes], { type });
    // createImageBitmap with no options is the call every current browser gives; where it is missing or
    // refuses the picture, an image element decodes it.
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(blob);
        return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
      } catch {
        /* fall through to the image element */
      }
    }
    if (!doc || typeof URL?.createObjectURL !== 'function')
      fail('BROWSER_IMAGE_UNAVAILABLE', new TypeError('No image decoder'));
    const address = URL.createObjectURL(blob);
    try {
      const image = doc.createElement('img');
      image.src = address;
      await image.decode();
      return { source: image, width: image.naturalWidth, height: image.naturalHeight };
    } finally {
      URL.revokeObjectURL(address);
    }
  };
  return { createCanvas, decode };
}

function sizeOf(source: BrowserImageSource): { width: number; height: number } {
  const s = source as { naturalWidth?: number; naturalHeight?: number; width: number; height: number };
  return { width: s.naturalWidth || s.width, height: s.naturalHeight || s.height };
}

// Draws `drawable` at the fitted size and reads the pixels back.
function readPixels(
  drawable: unknown,
  sourceWidth: number,
  sourceHeight: number,
  options: BrowserImageOptions,
  ports: BrowserImagePorts
): Texture {
  const { width, height } = fitBrowserImageSize(sourceWidth, sourceHeight, options);
  const canvas = ports.createCanvas(width, height);
  try {
    const pen = canvas.getContext('2d', { willReadFrequently: true });
    if (!pen) fail('BROWSER_IMAGE_UNAVAILABLE', new TypeError('No 2D context'));
    pen.drawImage(drawable, 0, 0, width, height);
    const data = pen.getImageData(0, 0, width, height).data;
    const pixels = new Uint8Array(data.byteLength);
    pixels.set(data);
    return createTexture(createImageData2D({ width, height, pixels }));
  } finally {
    // An empty canvas gives its memory back at once.
    canvas.width = canvas.height = 0;
  }
}

/**
 * Reads a canvas, image or bitmap as a texture of straight RGBA bytes, scaled down when it is larger than
 * the limits. The source is not changed.
 */
export function textureFromCanvas(source: BrowserImageSource, options: BrowserImageOptions = {}): Texture {
  const size = sizeOf(source);
  return readPixels(source, size.width, size.height, options, options.ports ?? browserPorts());
}

/** Decodes PNG, JPEG, WebP, GIF or AVIF bytes with the browser and returns a texture of them. */
export async function decodeBrowserImage(
  bytes: Uint8Array<ArrayBuffer>,
  options: BrowserImageOptions = {}
): Promise<Texture> {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0)
    fail('BROWSER_IMAGE_BYTES_INVALID', new TypeError('bytes'));
  const format = sniffBrowserImageFormat(bytes);
  if (!format) fail('BROWSER_IMAGE_FORMAT_UNKNOWN', new TypeError('Not PNG, JPEG, WebP, GIF or AVIF'));
  const ports = options.ports ?? browserPorts();
  let decoded: BrowserDecodedImage;
  try {
    decoded = await ports.decode(bytes, MIME[format]);
  } catch (cause) {
    if (cause instanceof EgretError) throw cause;
    fail('BROWSER_IMAGE_DECODE_FAILED', cause);
  }
  try {
    return readPixels(decoded.source, decoded.width, decoded.height, options, ports);
  } finally {
    decoded.release?.();
  }
}

/**
 * An asset provider that reads bytes with `readBytes` and decodes them with the browser. Register it for a
 * texture asset type; disposing a texture releases it.
 */
export function createBrowserImageTextureProvider(options: BrowserImageTextureProviderOptions): AssetProvider<Texture> {
  if (typeof options?.readBytes !== 'function') fail('BROWSER_IMAGE_PROVIDER_INVALID', new TypeError('readBytes'));
  const { readBytes, ...rest } = options;
  return {
    async load(ref, context) {
      const bytes = await readBytes(ref, context);
      if (context.signal?.aborted) throw context.signal.reason;
      return decodeBrowserImage(bytes, rest);
    },
    dispose(texture) {
      texture.dispose();
    }
  };
}
