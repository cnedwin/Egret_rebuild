// SPDX-License-Identifier: Apache-2.0
import { requireManifestByteSource } from './ManifestByteSource.js';
import type { ManifestByteSource } from './ManifestByteSource.js';
import { createManifestPngTextureProvider } from './BrowserTextureProvider.js';
import type { BrowserPngPorts, ManifestTextureProvider } from './BrowserTextureProvider.js';
import { EgretError } from '@egret/runtime';
import type { Engine } from '@egret/engine';
import { createContentLoader } from '@egret/engine/resources';
import type { ContentGroup, ContentLoader, ManifestGroupOptions } from '@egret/engine/resources';
import type { Scope } from '@egret/runtime';
import type { AdmittedResourceManifest } from '@egret/contracts/resources';
import { createManifestByteSource } from './ManifestByteSource.js';
import type { ManifestByteSourceOptions, ManifestByteSourceStatus } from './ManifestByteSource.js';
import type { ManifestTextureProviderStatus } from './BrowserTextureProvider.js';

export { createManifestByteSource } from './ManifestByteSource.js';
export type { ManifestByteSource, ManifestByteSourceOptions, ManifestByteSourceStatus } from './ManifestByteSource.js';
export type { ManifestTextureProvider, ManifestTextureProviderStatus } from './BrowserTextureProvider.js';
export interface ManifestTextureProviderOptions { readonly ports?: BrowserPngPorts; }

/** Source authentication precedes every caller-controlled options read. */
export function createManifestTextureProvider(source: ManifestByteSource, options?: ManifestTextureProviderOptions): ManifestTextureProvider {
    const owner = requireManifestByteSource(source);
    let captured: ManifestTextureProviderOptions = Object.freeze({});
    if (options !== undefined) {
        if (typeof options !== 'object' || options === null
            || (Object.getPrototypeOf(options) !== Object.prototype && Object.getPrototypeOf(options) !== null)) throw new EgretError('WEB_RESOURCE_OPTIONS_INVALID');
        for (const key of Reflect.ownKeys(options)) {
            if (key !== 'ports') throw new EgretError('WEB_RESOURCE_OPTIONS_INVALID');
            const property = Object.getOwnPropertyDescriptor(options, key);
            if (!property || !Object.hasOwn(property, 'value') || property.value === undefined) throw new EgretError('WEB_RESOURCE_OPTIONS_INVALID');
            captured = Object.freeze({ ports: property.value as BrowserPngPorts });
        }
    }
    return createManifestPngTextureProvider(owner, captured);
}

export interface ManifestContentLoader extends ContentLoader {
    close(): Promise<void>;
    getStatus(): Readonly<{source: ManifestByteSourceStatus; provider: ManifestTextureProviderStatus}>;
}
/** Integrity-checked PNG/UTF-8 transport plus the DOM-free content assembly. */
export function createManifestContentLoader(engine: Engine, manifest: AdmittedResourceManifest, options: ManifestByteSourceOptions): ManifestContentLoader {
    let source: ManifestByteSource | undefined;
    let provider: ManifestTextureProvider | undefined;
    let loader: ContentLoader;
    try {
        loader = createContentLoader(engine,manifest,bindings => {
            source = createManifestByteSource(manifest,bindings.map(row => row.binding),options);
            provider = createManifestTextureProvider(source);
            const capturedSource = source;
            return {textures:provider,metadata:{
                async load(ref,context): Promise<string> {
                    const bytes = await capturedSource.readBytes(ref,context);
                    if (bytes.byteLength > 4194304) throw new EgretError('CONTENT_METADATA_LIMIT');
                    // Decode verified bytes strictly; schema/relationships remain core authority.
                    return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
                },
                dispose(): void {},
            }};
        });
    } catch (cause) {
        // Construction has no public owner; close any host work already created.
        void provider?.close().catch(() => {});
        void source?.close().catch(() => {});
        throw cause;
    }
    const byteSource = source!, textures = provider!;
    let closePromise: Promise<void> | undefined;
    const facade: ManifestContentLoader = Object.freeze({
        get isDisposed(): boolean { if (this !== facade) throw new EgretError('CONTENT_LOADER_INVALID'); return loader.isDisposed; },
        load(scope: Scope, roots: readonly string[], groupOptions?: ManifestGroupOptions): ContentGroup {
            if (this !== facade) throw new EgretError('CONTENT_LOADER_INVALID');
            return loader.load(scope,roots,groupOptions);
        },
        dispose(): void { if (this !== facade) throw new EgretError('CONTENT_LOADER_INVALID'); loader.dispose(); },
        close(): Promise<void> {
            if (this !== facade) throw new EgretError('CONTENT_LOADER_INVALID');
            if (closePromise === undefined) {
                // Synchronous revocation precedes native cancellation and settlement.
                loader.dispose();
                closePromise = Promise.all([textures.close(),byteSource.close()]).then(() => {});
            }
            return closePromise;
        },
        getStatus(): Readonly<{source: ManifestByteSourceStatus; provider: ManifestTextureProviderStatus}> {
            if (this !== facade) throw new EgretError('CONTENT_LOADER_INVALID');
            return Object.freeze({source:byteSource.getStatus(),provider:textures.getStatus()});
        },
    });
    return facade;
}
