// SPDX-License-Identifier: Apache-2.0
// The textures of a browser game: images it loads from the page, and pixels painted in code or read from a canvas.
// An image is fetched only when `loadTexture` asks for it, at most four at a time, and decoded by its bytes.
import { EgretError } from '@egret/runtime';
import { createAssetRef, createAssetType, createImageData2D, createTexture, isTexture } from '@egret/engine';
import type { AssetLease, Engine, Scope, Texture } from '@egret/engine';
import { createBrowserTextureProvider } from './image.js';
import { decodeBrowserImage, sniffBrowserImageFormat } from './BrowserImageTextures.js';
import { createGameImageAdmission } from './GameImageAdmission.js';

const invalid = (): EgretError => new EgretError('BROWSER_GAME_OPTIONS_INVALID');
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const MAX_GAME_IMAGE_JOBS = 4;
const MAX_GAME_IMAGE_BYTES = 8 * 1024 * 1024;

function gameImageLimit(): EgretError {
  return new EgretError('WEB_PNG_INPUT_LIMIT', { cause: new RangeError('Game image encoded payload limit') });
}

async function boundedGameImageBytes(response: Response): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(response.headers.get('content-length')) > MAX_GAME_IMAGE_BYTES) throw gameImageLimit();
  if (response.body === null) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBufferLike>[] = [];
  let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_GAME_IMAGE_BYTES) throw gameImageLimit();
      chunks.push(chunk.value);
    }
  } catch (cause) {
    void reader.cancel().catch(() => {});
    throw cause;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** The textures of a game, and the end of its image provider. */
export interface GameTextures {
  /** A texture of the image at a URL, leased for the game's scope. */
  loadTexture(url: string): Promise<AssetLease<Texture>>;
  /** A texture of `width` × `height` RGBA pixels painted in code, leased for `owner` (the game's scope unless given). */
  leasePixels(
    width: number,
    height: number,
    pixels: Uint8Array | Uint8ClampedArray,
    owner?: Scope
  ): Promise<AssetLease<Texture>>;
  /** A texture of what a canvas holds now, leased for the game's scope. */
  textureFromCanvas(source: HTMLCanvasElement | OffscreenCanvas): Promise<AssetLease<Texture>>;
  /** After the Engine has ended: the image provider ends. */
  close(): Promise<void>;
}

/** Registers the game's two texture types with its Engine. */
export function createGameTextures(engine: Engine, scope: Scope): GameTextures {
  // Keep the strict PNG decoder and its ownership contract. Route other known encodings by
  // bytes so file names, query strings and response content types cannot select a wrong decoder.
  const imageType = createAssetType<Texture>('egret.browser-game.image', isTexture);
  const pendingPngBytes = new WeakMap<object, Uint8Array<ArrayBuffer>>();
  const pngTextures = new WeakSet<Texture>();
  const imageJobs = createGameImageAdmission(MAX_GAME_IMAGE_JOBS);
  const images = createBrowserTextureProvider({
    async readBytes(_ref, context) {
      const bytes = pendingPngBytes.get(context);
      if (bytes === undefined) throw new Error('Missing PNG bytes for the current image load');
      return bytes;
    }
  });
  engine.assets.register(imageType, {
    async load(ref, context) {
      // Hold the original admission budget through fetch and decode for every format.
      // Even a cancelled native decode retains its slot until the browser settles it.
      const release = await imageJobs.admit(context.signal);
      const stop = new AbortController(),
        abort = (): void => stop.abort();
      try {
        context.signal.addEventListener('abort', abort, { once: true });
        if (context.signal.aborted) throw context.signal.reason;
        let bytes: Uint8Array<ArrayBuffer>;
        try {
          const response = await globalThis.fetch(ref.id, { signal: stop.signal });
          if (!response.ok)
            throw new EgretError('WEB_PNG_READ_FAILED', {
              cause: new EgretError('BROWSER_GAME_IMAGE_FAILED', { cause: new Error(response.status + ' ' + ref.id) })
            });
          bytes = await boundedGameImageBytes(response);
        } catch (cause) {
          stop.abort();
          if (context.signal.aborted) throw context.signal.reason;
          if (cause instanceof EgretError) throw cause;
          throw new EgretError('WEB_PNG_READ_FAILED', { cause });
        }
        if (context.signal.aborted) throw context.signal.reason;
        const format = sniffBrowserImageFormat(bytes);
        if (format !== undefined && format !== 'png') {
          const texture = await decodeBrowserImage(bytes);
          if (!context.signal.aborted) return texture;
          texture.dispose();
          throw context.signal.reason;
        }
        pendingPngBytes.set(context, bytes);
        const texture = await images.load(ref, context);
        pngTextures.add(texture);
        return texture;
      } finally {
        context.signal.removeEventListener('abort', abort);
        pendingPngBytes.delete(context);
        release();
      }
    },
    dispose(texture) {
      if (pngTextures.has(texture)) images.dispose(texture);
      else texture.dispose();
    }
  });
  // Textures painted in code: each call puts its texture under a key of its own, and its lease ends it.
  const paintedType = createAssetType<Texture>('egret.browser-game.painted', isTexture),
    painted = new Map<string, Texture>();
  let paintedCount = 0;
  engine.assets.register(paintedType, {
    async load(ref) {
      const texture = painted.get(ref.id);
      painted.delete(ref.id);
      if (texture === undefined) throw invalid();
      return texture;
    },
    dispose(texture) {
      texture.dispose();
    }
  });
  const leasePixels = async (
    width: number,
    height: number,
    pixels: Uint8Array | Uint8ClampedArray,
    owner = scope
  ): Promise<AssetLease<Texture>> => {
    if (
      !whole(width) ||
      !whole(height) ||
      !(pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray) ||
      pixels.length !== width * height * 4
    )
      throw invalid();
    let texture: Texture;
    try {
      texture = createTexture(
        createImageData2D({ width, height, pixels: new Uint8Array(pixels) as Uint8Array<ArrayBuffer> })
      );
    } catch (cause) {
      // Larger than the 2D image limits: 4,096 pixels on an edge, 4,194,304 in all.
      throw new EgretError('BROWSER_GAME_OPTIONS_INVALID', { cause });
    }
    const key = 'painted-' + ++paintedCount;
    painted.set(key, texture);
    try {
      const lease = await engine.assets.acquire(createAssetRef(paintedType, key), { signal: owner.signal });
      try {
        return owner.use(lease);
      } catch (cause) {
        lease.release();
        throw cause;
      }
    } finally {
      // Not loaded (the scope ended first): the texture is ended here.
      if (painted.delete(key)) texture.dispose();
    }
  };
  return {
    async loadTexture(url: string) {
      if (typeof url !== 'string' || url === '') throw invalid();
      return scope.use(await engine.assets.acquire(createAssetRef(imageType, url), { signal: scope.signal }));
    },
    leasePixels,
    async textureFromCanvas(source: HTMLCanvasElement | OffscreenCanvas) {
      if (source === null || typeof source !== 'object' || typeof source.getContext !== 'function') throw invalid();
      const { width, height } = source;
      if (!whole(width) || !whole(height)) throw invalid();
      let context = source.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      if (context === null) {
        // A canvas of another kind of context: drawn onto a 2D canvas of its size, and read there.
        const copy =
          typeof OffscreenCanvas === 'function'
            ? new OffscreenCanvas(width, height)
            : Object.assign(document.createElement('canvas'), { width, height });
        context = copy.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
        if (context === null) throw invalid();
        context.drawImage(source, 0, 0);
      }
      return leasePixels(width, height, context.getImageData(0, 0, width, height).data);
    },
    close: () => images.close()
  };
}
