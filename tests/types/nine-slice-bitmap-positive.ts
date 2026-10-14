// SPDX-License-Identifier: Apache-2.0
// Built-root public declaration consumers; this file requires no DOM/Node globals.
import { NineSliceBitmap } from '@egret/engine';
import type { AssetLease, DisplayObject, Engine, NineSliceBitmapOptions, NineSliceInsets2D, Scope, Texture } from '@egret/engine';
import type { NineSliceBitmap as RuntimeLeaf, NineSliceBitmapOptions as RuntimeOptions } from '@egret/runtime';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false;
type Assert<T extends true> = T;
type ForwardClass = Assert<Equal<NineSliceBitmap, RuntimeLeaf>>;
type ForwardOptions = Assert<Equal<NineSliceBitmapOptions, RuntimeOptions>>;
type ConstructorShape = Assert<Equal<ConstructorParameters<typeof NineSliceBitmap>,
  [textureLease: AssetLease<Texture>, options: NineSliceBitmapOptions]>>;
type OptionsShape = Assert<Equal<NineSliceBitmapOptions, {
  readonly width: number; readonly height: number; readonly insets: NineSliceInsets2D;
}>>;
type LeaseRead = Assert<Equal<NineSliceBitmap['textureLease'], AssetLease<Texture> | undefined>>;
type InsetsRead = Assert<Equal<NineSliceBitmap['insets'], NineSliceInsets2D>>;
type WidthRead = Assert<Equal<NineSliceBitmap['targetWidth'], number>>;
type HeightRead = Assert<Equal<NineSliceBitmap['targetHeight'], number>>;
type ResizeShape = Assert<Equal<NineSliceBitmap['resize'], (width: number, height: number) => void>>;
type DisposeShape = Assert<Equal<NineSliceBitmap['dispose'], () => void>>;

declare const lease: AssetLease<Texture>;
declare const scope: Scope;
declare const engine: Engine;
const insets: NineSliceInsets2D = { left: 2, top: 2, right: 2, bottom: 2 };
const options: NineSliceBitmapOptions = { width: 16, height: 12, insets };
const panel: NineSliceBitmap = new NineSliceBitmap(lease, options);
const display: DisplayObject = scope.use(panel);
engine.stage.addChild(panel);
panel.x = 1; panel.y = 2; panel.scaleX = 2; panel.alpha = .5;
panel.hitArea = { x: 0, y: 0, width: 3, height: 3 };
panel.resize(12, 16);
const width: number = panel.targetWidth;
const height: number = panel.targetHeight;
const borrowed: AssetLease<Texture> | undefined = panel.textureLease;
const fixedInsets: NineSliceInsets2D = panel.insets;
const bounds = panel.getBounds({ maxPrimitives: 18 });
const saved = engine.captureTexturedFrame({ width: 20, height: 20 });
panel.dispose(); panel.dispose();
void display; void width; void height; void borrowed; void fixedInsets; void bounds; void saved;
export type { ForwardClass, ForwardOptions, ConstructorShape, OptionsShape, LeaseRead,
  InsetsRead, WidthRead, HeightRead, ResizeShape, DisposeShape };
