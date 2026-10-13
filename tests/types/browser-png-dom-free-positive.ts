// SPDX-License-Identifier: Apache-2.0
// Default-root consumer: ES2022 only, no optional image entry or ambient DOM/Node types.
import { createAssetRef, createAssetType, createSpriteSheet, createTexture, isTexture } from '@egret/engine';
import type {
  AssetLease, AssetLoadContext, AssetProvider, AssetRef, Bitmap,
  Engine, GameClockTick, ImageData2D, Scope, SpriteSheet, Texture,
} from '@egret/engine';

// BIP_TYPE_CASE BIP1-DP01: context-free image/Texture identities require no browser globals.
export function textureFromOwnedImage(image: ImageData2D): Texture {
  const texture: Texture = createTexture(image);
  const identityGuard: (value: unknown) => value is Texture = isTexture;
  void identityGuard;
  return texture;
}

// BIP_TYPE_CASE BIP1-DP02: manager/ref/context declarations remain DOM-free.
export function coreResourcePort(texture: Texture): AssetProvider<Texture> {
  return {
    load(ref: AssetRef<Texture>, context: AssetLoadContext): Promise<Texture> {
      const cancelled: boolean = context.signal.aborted;
      const generation: number = context.resourceGeneration;
      const task: number = context.taskId;
      void ref; void cancelled; void generation; void task;
      return Promise.resolve(texture);
    },
    dispose(value: Texture): void { value.dispose(); },
  };
}

// BIP_TYPE_CASE BIP1-DP03: a manager acquisition has the same core Texture lease type.
export function acquireCore(engine: Engine, texture: Texture): Promise<AssetLease<Texture>> {
  const type = createAssetType<Texture>('dom-free-type-consumer', isTexture);
  const ref: AssetRef<Texture> = createAssetRef(type, 'owned-image');
  engine.assets.register(type, coreResourcePort(texture));
  return engine.assets.acquire(ref);
}

// BIP_TYPE_CASE BIP1-DP04: the retained lease/sheet/Bitmap/clock chain adds no ambient types.
export function composeCore(
  engine: Engine, scope: Scope, originalLease: AssetLease<Texture>,
): { readonly sheet: SpriteSheet; readonly bitmap: Bitmap } {
  const lease: AssetLease<Texture> = scope.use(originalLease);
  const sheet: SpriteSheet = scope.use(createSpriteSheet(lease, [
    { name: 'pixel', x: 0, y: 0, width: 1, height: 1 },
  ]));
  const bitmap: Bitmap = scope.use(sheet.createBitmap('pixel'));
  engine.stage.addChild(bitmap);
  const tick: GameClockTick | undefined = engine.advanceTime(0);
  void tick;
  return { sheet, bitmap };
}
