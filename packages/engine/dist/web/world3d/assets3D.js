import { createAssetType } from '@egret/runtime';
import { World3DError } from '../../rendering/world3d/core3D.js';
import { Object3D } from '../../rendering/world3d/Object3D.js';
import { deserializeScene3D } from '../../rendering/world3d/Serialize3D.js';
import { CubeTexture3D, Texture3D } from '../../rendering/world3d/Texture3D.js';
import { loadCubeTexture3D, loadGltfFromUrl3D, loadTexture3D } from './loaders3D.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
/** A loaded glTF file. The reference id is the file URL. */
export const GLTF_ASSET_3D = createAssetType('world3d.gltf', (value) => isRecord(value) &&
    value['scene'] instanceof Object3D &&
    Array.isArray(value['animations']) &&
    typeof value['dispose'] === 'function');
/** A 2D texture loaded from an image or KTX2 file. The reference id is the file URL. */
export const TEXTURE_ASSET_3D = createAssetType('world3d.texture', (value) => value instanceof Texture3D);
/**
 * A cube texture. The reference id is a URL containing `{face}`, replaced by
 * px, nx, py, ny, pz and nz in turn.
 */
export const CUBE_TEXTURE_ASSET_3D = createAssetType('world3d.cubeTexture', (value) => value instanceof CubeTexture3D);
/** A scene document written by serializeScene3D. The reference id is the JSON file URL. */
export const SCENE_ASSET_3D = createAssetType('world3d.scene', (value) => isRecord(value) &&
    value['root'] instanceof Object3D &&
    Array.isArray(value['geometries']) &&
    typeof value['dispose'] === 'function');
const CUBE_FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
/** Mirror an Engine cancellation signal onto a browser AbortSignal for fetch. */
function abortSignal(signal) {
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    if (signal.aborted)
        abort();
    else
        signal.addEventListener('abort', abort, { once: true });
    return { signal: controller.signal, detach: () => signal.removeEventListener('abort', abort) };
}
async function guarded(context, load) {
    const bridge = abortSignal(context.signal);
    try {
        const value = await load(bridge.signal);
        // A load that finished after cancellation must not leak its resources.
        if (context.signal.aborted) {
            value.dispose();
            throw new World3DError('WORLD3D_RESOURCE_FAILED', 'load cancelled', context.signal.reason);
        }
        return value;
    }
    finally {
        bridge.detach();
    }
}
/**
 * Register the World3D asset providers on an AssetManager. Call once per
 * Engine, then acquire with `assets.acquire(createAssetRef(GLTF_ASSET_3D, url))`.
 */
export function registerWorld3DAssets(assets, options = {}) {
    const url = (ref) => (options.resolveUrl ? options.resolveUrl(ref.id) : ref.id);
    const limits = options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes };
    const ktx2 = options.transcodeKtx2 ? { transcodeKtx2: options.transcodeKtx2 } : {};
    const dispose = (value) => value.dispose();
    assets.register(GLTF_ASSET_3D, {
        load: (ref, context) => guarded(context, signal => loadGltfFromUrl3D(url(ref), {
            signal,
            ...limits,
            ...ktx2,
            ...(options.decodeMeshopt ? { decodeMeshopt: options.decodeMeshopt } : {}),
            ...(options.decodeDraco ? { decodeDraco: options.decodeDraco } : {})
        })),
        dispose
    });
    assets.register(TEXTURE_ASSET_3D, {
        load: (ref, context) => guarded(context, signal => loadTexture3D(url(ref), { ...options.texture, signal, ...limits, ...ktx2 })),
        dispose
    });
    assets.register(CUBE_TEXTURE_ASSET_3D, {
        load: (ref, context) => {
            const template = url(ref);
            if (!template.includes('{face}'))
                return Promise.reject(new World3DError('WORLD3D_INPUT_INVALID', 'cube texture id needs {face}: ' + ref.id));
            return guarded(context, signal => loadCubeTexture3D(CUBE_FACES.map(face => template.replace('{face}', face)), { ...options.cubeTexture, signal, ...limits }));
        },
        dispose
    });
    assets.register(SCENE_ASSET_3D, {
        load: (ref, context) => guarded(context, async (signal) => {
            const target = url(ref);
            let response;
            try {
                response = await fetch(target, { signal });
            }
            catch (cause) {
                throw new World3DError('WORLD3D_RESOURCE_FAILED', target, cause);
            }
            if (!response.ok)
                throw new World3DError('WORLD3D_RESOURCE_FAILED', target + ' (HTTP ' + response.status + ')');
            const text = await response.text();
            if (options.maxBytes !== undefined && text.length > options.maxBytes)
                throw new World3DError('WORLD3D_BUDGET', target);
            let saved;
            try {
                saved = JSON.parse(text);
            }
            catch (cause) {
                throw new World3DError('WORLD3D_INPUT_INVALID', 'scene document: ' + target, cause);
            }
            return deserializeScene3D(saved, options.resolveTexture ? { resolveTexture: options.resolveTexture } : {});
        }),
        dispose
    });
}
//# sourceMappingURL=assets3D.js.map