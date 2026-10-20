// SPDX-License-Identifier: Apache-2.0
// Compile-only built public consumers. No runtime/native proof is claimed.
import { createManifestByteSource, createManifestTextureProvider } from '@egret/engine/web/resources';
import type { ManifestByteSource, ManifestByteSourceOptions, ManifestTextureProviderOptions } from '@egret/engine/web/resources';
import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import type { ManifestBinding, ManifestAssetBinding } from '@egret/engine/resources';
import type { AssetLoadContext, AssetProvider, AssetRef, Texture } from '@egret/engine';
import type { BrowserPngPorts, BrowserTextureProvider } from '@egret/engine/web/image';

declare const manifest: AdmittedResourceManifest;
declare const bindings: readonly ManifestBinding[];
declare const textureBinding: ManifestAssetBinding<Texture>;
declare const numberRef: AssetRef<number>;
declare const context: AssetLoadContext;
declare const ports: BrowserPngPorts;

// MBR_TYPE_CASE MBR-P01: finite defaults can be omitted; readonly options admit literals.
export const options: ManifestByteSourceOptions = Object.freeze({ baseUrl: 'https://resources.example.test/project/', deadlineMs: 10000, networkRetries: 1 });
export const minimal: ManifestByteSourceOptions = { baseUrl: 'https://resources.example.test/project/' };
// MBR_TYPE_CASE MBR-P02: factory requires admitted manifest and genuine-binding type.
export const source: ManifestByteSource = createManifestByteSource(manifest, bindings, options);
// MBR_TYPE_CASE MBR-P03: source can read heterogeneous invariant refs without retyping them.
export const textureBytes: Promise<Uint8Array<ArrayBuffer>> = source.readBytes(textureBinding.ref, context);
export const metadataBytes: Promise<Uint8Array<ArrayBuffer>> = source.readBytes(numberRef, context);
// MBR_TYPE_CASE MBR-P04: fixed profile and independent async source close.
export const profile: 'manifest-sha256-browser-v1' = source.profile;
export const closed: boolean = source.isClosed;
export const closing: Promise<void> = source.close();
// MBR_TYPE_CASE MBR-P05: existing PNG ports are optional; result retains existing provider API.
export const providerOptions: ManifestTextureProviderOptions = Object.freeze({ ports });
export const provider: BrowserTextureProvider = createManifestTextureProvider(source, providerOptions);
export const defaultProvider: AssetProvider<Texture> = createManifestTextureProvider(source);
export const texture: Promise<Texture> = provider.load(textureBinding.ref, context);
