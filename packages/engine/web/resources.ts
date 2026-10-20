// SPDX-License-Identifier: Apache-2.0
import { requireManifestByteSource } from './ManifestByteSource.js';
import type { ManifestByteSource } from './ManifestByteSource.js';
import { createManifestPngTextureProvider } from './BrowserTextureProvider.js';
import type { BrowserPngPorts, ManifestTextureProvider } from './BrowserTextureProvider.js';
import { EgretError } from '@egret/runtime';

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
