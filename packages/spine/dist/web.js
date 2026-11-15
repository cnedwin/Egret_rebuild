// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/engine';
import { createManifestByteSource, createManifestTextureProvider } from '@egret/engine/web/resources';
import { createSpineContentLoader } from './loader.js';
import { registerResetLoader, authenticateResetLoader } from './resetAuthority.js';
/** The existing transport owns integrity, strict UTF-8, native PNG decode and cancellation. */
export function createManifestSpineContentLoader(engine, ownerScope, manifest, sourceOptions, options) {
    let source, textures;
    let core;
    try {
        core = createSpineContentLoader(engine, ownerScope, manifest, bindings => {
            source = createManifestByteSource(manifest, bindings.map(b => b.binding), sourceOptions);
            textures = createManifestTextureProvider(source);
            const bytes = source;
            // A binary skeleton stays bytes; an atlas or a JSON skeleton is strict UTF-8 text.
            const binaries = new Set(bindings.filter(b => b.kind === 'binary').map(b => b.binding.ref.id));
            return {
                textures,
                metadata: {
                    async load(ref, context) {
                        const value = await bytes.readBytes(ref, context);
                        if (value.byteLength > 4194304)
                            throw new EgretError('SPINE_METADATA_LIMIT');
                        return binaries.has(ref.id)
                            ? new Uint8Array(value)
                            : new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(value);
                    },
                    dispose() { }
                }
            };
        }, options);
    }
    catch (cause) {
        void textures?.close().catch(() => { });
        void source?.close().catch(() => { });
        throw cause;
    }
    const byteSource = source, png = textures;
    let closing;
    const facade = Object.freeze({
        get isDisposed() {
            if (this !== facade)
                throw new EgretError('SPINE_LOADER_RECEIVER');
            return core.isDisposed;
        },
        load(scope, roots, groupOptions) {
            if (this !== facade)
                throw new EgretError('SPINE_LOADER_RECEIVER');
            return core.load(scope, roots, groupOptions);
        },
        getStatus() {
            if (this !== facade)
                throw new EgretError('SPINE_LOADER_RECEIVER');
            return core.getStatus();
        },
        getTransportStatus() {
            if (this !== facade)
                throw new EgretError('SPINE_LOADER_RECEIVER');
            return Object.freeze({ source: byteSource.getStatus(), provider: png.getStatus() });
        },
        dispose() {
            if (this !== facade)
                throw new EgretError('SPINE_LOADER_RECEIVER');
            core.dispose();
        },
        close() {
            if (this !== facade)
                throw new EgretError('SPINE_LOADER_RECEIVER');
            if (!closing) {
                core.dispose();
                closing = Promise.all([png.close(), byteSource.close(), core.close()]).then(() => { });
            }
            return closing;
        }
    });
    registerResetLoader(facade, scope => authenticateResetLoader(core, scope));
    return facade;
}
//# sourceMappingURL=web.js.map