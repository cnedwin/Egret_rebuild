// SPDX-License-Identifier: Apache-2.0
// Unsuppressed type refusals. Root freezes actual diagnostics after SDK emission.
import { createManifestByteSource, createManifestTextureProvider } from '@egret/engine/web/resources';
import type { ManifestByteSource, ManifestByteSourceOptions } from '@egret/engine/web/resources';
import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import type { ManifestBinding } from '@egret/engine/resources';
import type { AssetLoadContext, AssetProvider, AssetRef, Texture } from '@egret/engine';

declare const manifest: AdmittedResourceManifest;
declare const bindings: readonly ManifestBinding[];
declare const source: ManifestByteSource;
declare const options: ManifestByteSourceOptions;
declare const ref: AssetRef<Texture>;
declare const context: AssetLoadContext;

// MBR_TYPE_CASE MBR-N01: a plain manifest does not acquire admission authority.
createManifestByteSource({}, bindings, { baseUrl: 'https://resources.example.test/project/' });
// MBR_TYPE_CASE MBR-N02: base URL is required.
createManifestByteSource(manifest, bindings, {});
// MBR_TYPE_CASE MBR-N03: retry is a finite literal domain.
createManifestByteSource(manifest, bindings, { baseUrl: 'https://resources.example.test/project/', networkRetries: 2 });
// MBR_TYPE_CASE MBR-N04: no caller digest replacement exists.
createManifestByteSource(manifest, bindings, { baseUrl: 'https://resources.example.test/project/', digest() {} });
// MBR_TYPE_CASE MBR-N05: no injected transport API exists.
createManifestByteSource(manifest, bindings, { baseUrl: 'https://resources.example.test/project/', fetch });
// MBR_TYPE_CASE MBR-N06: exact optional properties reject explicit undefined.
createManifestByteSource(manifest, bindings, { baseUrl: 'https://resources.example.test/project/', deadlineMs: undefined });
// MBR_TYPE_CASE MBR-N07: opaque source cannot be structurally forged.
const fake: ManifestByteSource = { profile: 'manifest-sha256-browser-v1', isClosed: false, readBytes: () => Promise.resolve(new Uint8Array(new ArrayBuffer(0))), close: () => Promise.resolve() };
// MBR_TYPE_CASE MBR-N08: provider accepts only the genuine source type.
createManifestTextureProvider({});
// MBR_TYPE_CASE MBR-N09: source is not a Texture resource provider.
const wrongProvider: AssetProvider<Texture> = source;
// MBR_TYPE_CASE MBR-N10: options remain readonly.
options.networkRetries = 1;
// MBR_TYPE_CASE MBR-N11: source profile remains readonly.
source.profile = 'manifest-sha256-browser-v1';
// MBR_TYPE_CASE MBR-N12: close state remains readonly.
source.isClosed = true;
// MBR_TYPE_CASE MBR-N13: source close is asynchronous.
const synchronous: void = source.close();
// MBR_TYPE_CASE MBR-N14: no generic lifecycle or decoder-permit hook exists.
createManifestTextureProvider(source, { onDecodeSettled() {} });
// MBR_TYPE_CASE MBR-N15: source read result is fixed ArrayBuffer-backed bytes, not Texture.
const wrongResult: Promise<Texture> = source.readBytes(ref, context);
// MBR_TYPE_CASE MBR-N16: load context remains required.
source.readBytes(ref);
// MBR_TYPE_CASE MBR-N17: source close takes no ownership-transfer argument.
source.close(true);
