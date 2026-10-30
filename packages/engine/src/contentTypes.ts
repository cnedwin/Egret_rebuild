// SPDX-License-Identifier: Apache-2.0
import type { AssetLease, AssetProvider, Scope, SequenceClip, SpriteSheet, Texture } from '@egret/runtime';
import type { ManifestBinding, ManifestGroupOptions } from './manifestResourceTypes.js';

export interface ContentBinding {
  readonly id: string;
  readonly kind: 'image' | 'atlas' | 'sequence';
  readonly binding: ManifestBinding;
}
/** Host providers own byte integrity/UTF-8 decoding; the core validates artifact semantics. */
export interface ContentProviders {
  readonly textures: AssetProvider<Texture>;
  readonly metadata: AssetProvider<string>;
}
export type ContentProviderFactory = (bindings: readonly ContentBinding[]) => ContentProviders;
/** All returned values are borrowed until this group or its owning Scope retires. */
export interface ContentGroup {
  readonly ready: Promise<void>;
  readonly isDisposed: boolean;
  getImage(id: string): AssetLease<Texture>;
  getAtlas(id: string): SpriteSheet;
  /** Exact logical page names of an admitted multipage atlas; borrowed metadata. */
  getAtlasPages(id: string): readonly string[];
  /** The page borrows the same resource-group lifetime as legacy single sheets. */
  getAtlasPage(id: string, page: string): SpriteSheet;
  getSequence(id: string): SequenceClip;
  dispose(): void;
}
/** One manifest/source identity; multiple groups share the existing asset manager. */
export interface ContentLoader {
  readonly isDisposed: boolean;
  load(scope: Scope, roots: readonly string[], options?: ManifestGroupOptions): ContentGroup;
  dispose(): void;
}
