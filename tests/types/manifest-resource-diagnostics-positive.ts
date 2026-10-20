// SPDX-License-Identifier: Apache-2.0
// Compile-only public optional entry; no runtime acceptance.
import { createManifestByteSource, createManifestTextureProvider } from '@egret/engine/web/resources';
import type { ManifestByteSource, ManifestByteSourceStatus, ManifestTextureProvider, ManifestTextureProviderStatus } from '@egret/engine/web/resources';
import type { BrowserTextureProvider, BrowserPngPorts } from '@egret/engine/web/image';
import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import type { ManifestBinding } from '@egret/engine/resources';
import type { AssetProvider, Texture } from '@egret/engine';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Require<T extends true>=T;
type SourceFields='jobs'|'queuedNetwork'|'queuedDecode'|'retryWaiting'|'activeNetwork'|'activeDecode'|'encodedCreditBytes'|'ownedEncodedBytes'|'borrowedChunkBytes'|'quarantinedJobs';
type ProviderFields='jobs'|'encodedCreditBytes'|'ownedEncodedBytes'|'blobLogicalBytes'|'activeDecodes'|'bitmapLogicalBytes'|'rasterLogicalBytes'|'readbackCpuBytes'|'materializedCpuBytes'|'quarantinedJobs'|'unknownNativeObjects';
export type SourceKeys=Require<Equal<keyof ManifestByteSourceStatus,'current'|'highWater'|'saturated'>>;
export type ProviderKeys=Require<Equal<keyof ManifestTextureProviderStatus,'current'|'highWater'|'saturated'>>;
export type SourceCurrent=Require<Equal<keyof ManifestByteSourceStatus['current'],SourceFields>>;
export type SourceHighWater=Require<Equal<keyof ManifestByteSourceStatus['highWater'],SourceFields>>;
export type ProviderCurrent=Require<Equal<keyof ManifestTextureProviderStatus['current'],ProviderFields>>;
export type ProviderHighWater=Require<Equal<keyof ManifestTextureProviderStatus['highWater'],ProviderFields>>;
export type SourceNumbers=Require<Equal<ManifestByteSourceStatus['current'][SourceFields],number>>;
export type ProviderNumbers=Require<Equal<ManifestTextureProviderStatus['highWater'][ProviderFields],number>>;
export type SourceFlag=Require<Equal<ManifestByteSourceStatus['saturated'],boolean>>;
export type ProviderFlag=Require<Equal<ManifestTextureProviderStatus['saturated'],boolean>>;
declare const manifest:AdmittedResourceManifest;
declare const bindings:readonly ManifestBinding[];
declare const ports:BrowserPngPorts;
// MDR-P01: the source adds its exact status to the existing optional type.
export const source:ManifestByteSource=createManifestByteSource(manifest,bindings,{baseUrl:'https://resources.example.test/project/'});
export const sourceStatus:ManifestByteSourceStatus=source.getStatus();
// MDR-P02: fixed assembly returns the manifest subtype, also assignable to old APIs.
export const provider:ManifestTextureProvider=createManifestTextureProvider(source,{ports});
export const providerStatus:ManifestTextureProviderStatus=provider.getStatus();
export const legacyShape:BrowserTextureProvider=provider;
export const assetProvider:AssetProvider<Texture>=provider;
// MDR-P03: every bucket is a readonly numeric mapping; the flag is separate.
export const sourceNumbers:Readonly<Record<SourceFields,number>>=sourceStatus.current;
export const providerNumbers:Readonly<Record<ProviderFields,number>>=providerStatus.highWater;
export const saturation:boolean=sourceStatus.saturated||providerStatus.saturated;
export const sourceClose:Promise<void>=source.close();
export const providerClose:Promise<void>=provider.close();
