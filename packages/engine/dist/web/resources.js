// SPDX-License-Identifier: Apache-2.0
import { requireManifestByteSource } from './ManifestByteSource.js';
import { createManifestPngTextureProvider } from './BrowserTextureProvider.js';
import { EgretError } from '@egret/runtime';
import { createContentLoader } from '@egret/engine/resources';
import { createManifestByteSource } from './ManifestByteSource.js';
export { createManifestByteSource } from './ManifestByteSource.js';
/** Source authentication precedes every caller-controlled options read. */
export function createManifestTextureProvider(source, options) {
    const owner = requireManifestByteSource(source);
    let captured = Object.freeze({});
    if (options !== undefined) {
        if (typeof options !== 'object' ||
            options === null ||
            (Object.getPrototypeOf(options) !== Object.prototype && Object.getPrototypeOf(options) !== null))
            throw new EgretError('WEB_RESOURCE_OPTIONS_INVALID');
        for (const key of Reflect.ownKeys(options)) {
            if (key !== 'ports')
                throw new EgretError('WEB_RESOURCE_OPTIONS_INVALID');
            const property = Object.getOwnPropertyDescriptor(options, key);
            if (!property || !Object.hasOwn(property, 'value') || property.value === undefined)
                throw new EgretError('WEB_RESOURCE_OPTIONS_INVALID');
            captured = Object.freeze({ ports: property.value });
        }
    }
    return createManifestPngTextureProvider(owner, captured);
}
/** Integrity-checked PNG/UTF-8 transport plus the DOM-free content assembly. */
export function createManifestContentLoader(engine, manifest, options) {
    let source;
    let provider;
    let loader;
    try {
        loader = createContentLoader(engine, manifest, bindings => {
            source = createManifestByteSource(manifest, bindings.map(row => row.binding), options);
            provider = createManifestTextureProvider(source);
            const capturedSource = source;
            return {
                textures: provider,
                metadata: {
                    async load(ref, context) {
                        const bytes = await capturedSource.readBytes(ref, context);
                        if (bytes.byteLength > 4194304)
                            throw new EgretError('CONTENT_METADATA_LIMIT');
                        // Decode verified bytes strictly; schema/relationships remain core authority.
                        return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
                    },
                    dispose() { }
                }
            };
        });
    }
    catch (cause) {
        // Construction has no public owner; close any host work already created.
        void provider?.close().catch(() => { });
        void source?.close().catch(() => { });
        throw cause;
    }
    const byteSource = source, textures = provider;
    let closePromise;
    const facade = Object.freeze({
        get isDisposed() {
            if (this !== facade)
                throw new EgretError('CONTENT_LOADER_INVALID');
            return loader.isDisposed;
        },
        load(scope, roots, groupOptions) {
            if (this !== facade)
                throw new EgretError('CONTENT_LOADER_INVALID');
            return loader.load(scope, roots, groupOptions);
        },
        dispose() {
            if (this !== facade)
                throw new EgretError('CONTENT_LOADER_INVALID');
            loader.dispose();
        },
        close() {
            if (this !== facade)
                throw new EgretError('CONTENT_LOADER_INVALID');
            if (closePromise === undefined) {
                // Synchronous revocation precedes native cancellation and settlement.
                loader.dispose();
                closePromise = Promise.all([textures.close(), byteSource.close()]).then(() => { });
            }
            return closePromise;
        },
        getStatus() {
            if (this !== facade)
                throw new EgretError('CONTENT_LOADER_INVALID');
            return Object.freeze({ source: byteSource.getStatus(), provider: textures.getStatus() });
        }
    });
    return facade;
}
export { createManifestFontContentLoader } from './ManifestFontContentLoader.js';
//# sourceMappingURL=resources.js.map