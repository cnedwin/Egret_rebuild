// SPDX-License-Identifier: Apache-2.0
import type { AssetProvider, Scope, Texture } from '@egret/engine';
import type { ManifestBinding, ManifestGroupOptions } from '@egret/engine/resources';

export interface SpineContentOptions {
  readonly allowPrerelease?: boolean;
  /** Logical source/setup retention fee, separate from images and physical memory. */
  readonly maxSetupBytes?: number;
}
export interface SpineContentBinding {
  readonly id: string;
  readonly kind: 'image' | 'metadata';
  readonly binding: ManifestBinding;
}
export interface SpineContentProviders {
  readonly textures: AssetProvider<Texture>;
  readonly metadata: AssetProvider<string>;
}
export type SpineContentProviderFactory = (bindings: readonly SpineContentBinding[]) => SpineContentProviders;
export interface SpinePageInfo {
  readonly name: string;
  readonly imageId: string;
  readonly width: number;
  readonly height: number;
  readonly sourcePremultiplied: false;
}
export interface SpineAssetInfo {
  readonly coreVersion: '4.3.13';
  readonly exportVersion: string;
  readonly format: 'json';
  readonly prerelease: boolean;
  readonly boneCount: number;
  readonly slotCount: number;
  readonly skins: readonly string[];
  readonly animations: readonly Readonly<{ name: string; duration: number }>[];
  readonly pages: readonly SpinePageInfo[];
}
declare const spineAssetBrand: unique symbol;
/** Group-lifetime view. Information is copied; no upstream object escapes. */
export interface SpineAsset {
  readonly [spineAssetBrand]: true;
  readonly info: SpineAssetInfo;
  readonly isDisposed: boolean;
}
export interface SpineContentGroup {
  readonly ready: Promise<void>;
  readonly isDisposed: boolean;
  getSpine(id: string): SpineAsset;
  dispose(): void;
}
export interface SpineContentStatus {
  readonly isDisposed: boolean;
  readonly groups: number;
  readonly activeSourceLoads: number;
  readonly liveSourceValues: number;
  readonly pendingSetups: number;
  readonly liveSetups: number;
  readonly setupBytes: number;
}
export interface SpineContentLoader {
  readonly isDisposed: boolean;
  load(scope: Scope, roots: readonly string[], options?: ManifestGroupOptions): SpineContentGroup;
  getStatus(): SpineContentStatus;
  dispose(): void;
  /** Revoke demand and await owned provider work; custom hosts still own their ports. */
  close(): Promise<void>;
}
