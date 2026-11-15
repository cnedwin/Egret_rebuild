import { createFontContentLoader } from '@egret/engine/resources';
import { createManifestByteSource } from './ManifestByteSource.js';
/** Fonts share the authenticated byte transport and the Engine's existing resource manager. */
export function createManifestFontContentLoader(engine, manifest, options) {
    let source;
    const loader = createFontContentLoader(engine, manifest, bindings => {
        source = createManifestByteSource(manifest, bindings.map(row => row.binding), { ...options, profile: 'font-sfnt/1' });
        return { load: (ref, context) => source.readBytes(ref, context), dispose: () => { } };
    });
    let closing;
    return Object.freeze({
        loader,
        source,
        close() {
            if (!closing) {
                closing = (async () => {
                    try {
                        loader.dispose();
                    }
                    finally {
                        await source.close();
                    }
                })();
                void closing.catch(() => { });
            }
            return closing;
        }
    });
}
//# sourceMappingURL=ManifestFontContentLoader.js.map