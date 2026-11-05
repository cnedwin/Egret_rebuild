// SPDX-License-Identifier: Apache-2.0
import type { AssetProvider, Scope } from '@egret/runtime';
import type { ManifestAssetBinding, ManifestGroupOptions } from './manifestResourceTypes.js';
export interface FontContentBinding {readonly id:string;readonly family:string;readonly binding:ManifestAssetBinding<Uint8Array>;}
export type FontContentProviderFactory = (bindings:readonly FontContentBinding[])=>AssetProvider<Uint8Array>;
export interface FontContentAsset {
  readonly id:string;readonly family:string;readonly identity:string;readonly byteLength:number;readonly format:'truetype'|'opentype';
  /** Returns a fresh owned copy only while the genuine source group is ready. */
  copyBytes():Uint8Array;
}
export interface FontContentGroup {
  readonly ready:Promise<void>;readonly closed:Promise<void>;readonly isDisposed:boolean;
  getFonts():readonly FontContentAsset[];
  dispose():void;
}
export interface FontContentLoader {
  readonly isDisposed:boolean;
  load(scope:Scope,roots:readonly string[],options?:ManifestGroupOptions):FontContentGroup;
  getStatus():Readonly<{groups:number;sourceBytes:number}>;
  dispose():void;
}
