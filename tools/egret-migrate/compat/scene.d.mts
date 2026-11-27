// SPDX-License-Identifier: Apache-2.0
import type { AssetLease, CancellationSignal, DisplayObjectContainer, Engine, Scope, SequenceClip, Texture } from '@egret/engine';

interface Viewport { x: number; y: number; width: number; height: number }
export interface LegacyCell { column: number; row: number; id: string; asset: string }
export interface VisiblePart { id: string; asset: string; x?: number; y?: number; clip?: SequenceClip }

export function createLegacyTileIndex(cells: readonly LegacyCell[], tileWidth: number, tileHeight?: number): {
  visible(view: Viewport): readonly (VisiblePart & { x: number; y: number })[];
};
export function createLegacySceneLayer(options: {
  sdk: Pick<typeof import('@egret/engine'), 'DisplayObjectContainer' | 'SequencePlayer' | 'Bitmap'>;
  game: { engine: Engine; scope: Scope };
  acquire(asset: string, signal: CancellationSignal): Promise<AssetLease<Texture>>;
  concurrency?: number;
}): {
  readonly display: DisplayObjectContainer;
  update(items: readonly VisiblePart[]): void;
  seek(seconds: number): void;
  settled(): Promise<readonly { id: string; status: string; error?: unknown }[]>;
  close(): Promise<void>;
};
