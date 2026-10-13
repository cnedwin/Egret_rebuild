// SPDX-License-Identifier: Apache-2.0
// Compile-only consumers of the optional built entry. No source here is executed.
// Declared browser handles describe signatures, not native or ownership evidence.
import { createBrowserTextureProvider } from '@egret/engine/web/image';
import type {
  BrowserPngDecodeOptions, BrowserPngPorts,
  BrowserTextureProviderOptions, BrowserTextureProvider,
} from '@egret/engine/web/image';
import { createAssetRef, createAssetType, createSpriteSheet, isTexture } from '@egret/engine';
import type {
  AssetLease, AssetLoadContext, AssetProvider, AssetRef,
  Bitmap, Engine, Scope, SpriteSheet, Texture,
} from '@egret/engine';

declare const declaredBitmap: ImageBitmap;
declare const declaredCanvas: HTMLCanvasElement;

// BIP_TYPE_CASE BIP1-P01: exactly the admitted readonly decode literals.
export const decodeOptions: BrowserPngDecodeOptions = Object.freeze({
  imageOrientation: 'from-image',
  premultiplyAlpha: 'none',
  colorSpaceConversion: 'none',
});

// BIP_TYPE_CASE BIP1-P02: callbacks receive the exact Blob/options and return types.
export const ports: BrowserPngPorts = Object.freeze({
  decode(blob: Blob, options: BrowserPngDecodeOptions): Promise<ImageBitmap> {
    const input: Blob = blob;
    const orientation: 'from-image' = options.imageOrientation;
    const premultiplication: 'none' = options.premultiplyAlpha;
    const conversion: 'none' = options.colorSpaceConversion;
    void input; void orientation; void premultiplication; void conversion;
    return Promise.resolve(declaredBitmap);
  },
  createCanvas(): HTMLCanvasElement { return declaredCanvas; },
});

// BIP_TYPE_CASE BIP1-P03: the source has fixed ArrayBuffer-backed Uint8Array type.
export const readBytes: BrowserTextureProviderOptions['readBytes'] = (ref, context) => {
  const originalRef: AssetRef<Texture> = ref;
  const originalContext: AssetLoadContext = context;
  const cancelled: boolean = context.signal.aborted;
  const generation: number = context.resourceGeneration;
  const task: number = context.taskId;
  const selected: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(8));
  void originalRef; void originalContext; void cancelled; void generation; void task;
  return Promise.resolve(selected);
};

// BIP_TYPE_CASE BIP1-P04: a frozen options/ports record is assignable.
export const options: BrowserTextureProviderOptions = Object.freeze({ readBytes, ports });

// BIP_TYPE_CASE BIP1-P05: omitting ports is a legal default-port type consumer.
export function withDefaultPorts(): BrowserTextureProvider {
  return createBrowserTextureProvider({ readBytes });
}

// BIP_TYPE_CASE BIP1-P06: the sole factory has its exact options/result signature.
export const factory: (options: BrowserTextureProviderOptions) => BrowserTextureProvider = createBrowserTextureProvider;

// BIP_TYPE_CASE BIP1-P07: the provider implements the existing Texture resource port.
export function asAssetProvider(provider: BrowserTextureProvider): AssetProvider<Texture> {
  const generic: AssetProvider<Texture> = provider;
  const profile: 'png-rgb-rgba8-browser-normalized-v1' = provider.profile;
  const closed: boolean = provider.isClosed;
  void profile; void closed;
  return generic;
}

// BIP_TYPE_CASE BIP1-P08: direct ownership ends in synchronous value disposal and async close.
export async function directLifecycle(
  provider: BrowserTextureProvider, ref: AssetRef<Texture>, context: AssetLoadContext,
): Promise<void> {
  const pending: Promise<Texture> = provider.load(ref, context);
  const value: Texture = await pending;
  const disposed: void = provider.dispose(value);
  const closed: Promise<void> = provider.close();
  await closed;
  void disposed;
}

// BIP_TYPE_CASE BIP1-P09: genuine manager generics preserve one Texture lease in sheet/Bitmap consumers.
export async function compose(
  engine: Engine, scope: Scope,
): Promise<{ readonly provider: BrowserTextureProvider; readonly lease: AssetLease<Texture>; readonly sheet: SpriteSheet; readonly bitmap: Bitmap }> {
  const provider: BrowserTextureProvider = createBrowserTextureProvider(options);
  const type = createAssetType<Texture>('browser-png-type-consumer', isTexture);
  const ref: AssetRef<Texture> = createAssetRef(type, 'original.png');
  engine.assets.register(type, provider);
  const pendingLease: Promise<AssetLease<Texture>> = engine.assets.acquire(ref);
  const lease: AssetLease<Texture> = scope.use(await pendingLease);
  const sheet: SpriteSheet = scope.use(createSpriteSheet(lease, [
    { name: 'pixel', x: 0, y: 0, width: 1, height: 1 },
  ]));
  const bitmap: Bitmap = scope.use(sheet.createBitmap('pixel'));
  const borrowed: AssetLease<Texture> | undefined = bitmap.textureLease;
  engine.stage.addChild(bitmap);
  void borrowed;
  // The caller separately owns provider.close; Scope owns only the lease/sheet/Bitmap.
  return { provider, lease, sheet, bitmap };
}
