// SPDX-License-Identifier: Apache-2.0
import type { AssetProvider, Scope } from '@egret/runtime';
import type { ManifestAssetBinding, ManifestGroupOptions } from './manifestResourceTypes.js';
/** One font a font content loader binds: its id, family and manifest binding. */
export interface FontContentBinding {
  readonly id: string;
  readonly family: string;
  readonly binding: ManifestAssetBinding<Uint8Array>;
}
/** Makes the provider that loads the bytes of a font content loader's fonts. */
export type FontContentProviderFactory = (bindings: readonly FontContentBinding[]) => AssetProvider<Uint8Array>;
/** A loaded font: its id, family and identity, its size and format, and a copy of its bytes. */
export interface FontContentAsset {
  readonly id: string;
  readonly family: string;
  readonly identity: string;
  readonly byteLength: number;
  readonly format: 'truetype' | 'opentype';
  /** Returns a fresh owned copy only while the genuine source group is ready. */
  copyBytes(): Uint8Array;
}
/** Fonts loaded together: wait for them, read them, and dispose of them together. */
export interface FontContentGroup {
  readonly ready: Promise<void>;
  readonly closed: Promise<void>;
  readonly isDisposed: boolean;
  getFonts(): readonly FontContentAsset[];
  dispose(): void;
}
/** Loads groups of fonts from a manifest. */
export interface FontContentLoader {
  readonly isDisposed: boolean;
  load(scope: Scope, roots: readonly string[], options?: ManifestGroupOptions): FontContentGroup;
  getStatus(): Readonly<{ groups: number; sourceBytes: number }>;
  dispose(): void;
}
