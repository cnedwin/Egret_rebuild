// SPDX-License-Identifier: Apache-2.0
// Compile-only canonical consumers. These declarations create no runtime authority.
import { createSequenceClip, createSpriteSheet } from '@egret/engine';
import { createSpriteSheet as runtimeCreateSpriteSheet } from '@egret/runtime';
import type {
  AssetLease, Bitmap, Disposable, Engine, Scope, SequenceClip, SequencePlayback,
  SpriteSheet, SpriteSheetFrameInput, Texture, TextureRegion2D,
} from '@egret/engine';
import type {
  SpriteSheet as RuntimeSpriteSheet,
  SpriteSheetFrameInput as RuntimeSpriteSheetFrameInput,
} from '@egret/runtime';

export const runtimeIdentity: typeof runtimeCreateSpriteSheet = createSpriteSheet;
export const engineIdentity: typeof createSpriteSheet = runtimeCreateSpriteSheet;
export const frame: SpriteSheetFrameInput = { name: 'red', x: 0, y: 0, width: 2, height: 2 };
export const readonlyFrames: readonly SpriteSheetFrameInput[] = Object.freeze([
  Object.freeze({ name: 'red', x: 0, y: 0, width: 2, height: 2 }),
  Object.freeze({ name: 'green', x: 2, y: 0, width: 1, height: 2 }),
  Object.freeze({ name: 'blue', x: 3, y: 0, width: 3, height: 1 }),
]);
export const runtimeFrame: RuntimeSpriteSheetFrameInput = frame;
export const engineFrame: SpriteSheetFrameInput = runtimeFrame;

export function canonicalSheet(value: RuntimeSpriteSheet): SpriteSheet { return value; }
export function canonicalRuntimeSheet(value: SpriteSheet): RuntimeSpriteSheet { return value; }

export function consume(
  engine: Engine, scope: Scope, lease: AssetLease<Texture>,
): { readonly sheet: SpriteSheet; readonly bitmap: Bitmap; readonly clip: SequenceClip; readonly playback: SequencePlayback } {
  const sheet: SpriteSheet = scope.use(createSpriteSheet(lease, readonlyFrames));
  const disposable: Disposable = sheet;
  const names: readonly string[] = sheet.names;
  const count: number = sheet.frameCount;
  const width: number = sheet.atlasWidth;
  const height: number = sheet.atlasHeight;
  const disposed: boolean = sheet.isDisposed;
  const region: TextureRegion2D = sheet.getRegion('red');
  const dimensions: readonly number[] = [region.x, region.y, region.width, region.height];
  const bitmap: Bitmap = scope.use(sheet.createBitmap('red'));
  const exactBorrow: AssetLease<Texture> | undefined = bitmap.textureLease;
  engine.stage.addChild(bitmap);
  const clip: SequenceClip = createSequenceClip({ atlasWidth: width, atlasHeight: height,
    frames: [
      { ...sheet.getRegion('red'), durationSeconds: 0.125 },
      { ...sheet.getRegion('green'), durationSeconds: 0.25 },
      { ...sheet.getRegion('blue'), durationSeconds: 0.125 },
    ] });
  const playback: SequencePlayback = engine.createSequencePlayback(scope, bitmap, clip, { mode: 'loop' });
  const start: void = playback.start();
  const dispose: void = disposable.dispose();
  void names; void count; void disposed; void dimensions; void exactBorrow; void start; void dispose;
  return { sheet, bitmap, clip, playback };
}
