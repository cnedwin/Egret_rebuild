// SPDX-License-Identifier: Apache-2.0
import { isAdmittedResourceManifest } from '@egret/contracts/resources';
import { createAssetType, createSequenceClip, createSpriteSheet, isTexture, Scope, EgretError } from '@egret/runtime';
import { createManifestAssetBinding } from './manifestResourceState.js';
import { registerContentLoader, registerSequenceTimeline, requireContentEngine } from './internal/contentFactoryState.js';
import { contentFault, parseAtlasArtifact, parseSequenceArtifact } from './contentArtifacts.js';
import { parseAtlasPagesArtifact } from './contentAtlasPages.js';
const SCOPE_STATE = Object.getOwnPropertyDescriptor(Scope.prototype, 'state').get;
const SCOPE_USE = Scope.prototype.use;
const APPLY = Reflect.apply;
const FREEZE = Object.freeze;
function provider(value) {
    if (typeof value !== 'object' || value === null)
        throw new EgretError('CONTENT_PROVIDERS_INVALID');
    const load = Object.getOwnPropertyDescriptor(value, 'load'), dispose = Object.getOwnPropertyDescriptor(value, 'dispose');
    if (!load ||
        !dispose ||
        !Object.hasOwn(load, 'value') ||
        !Object.hasOwn(dispose, 'value') ||
        typeof load.value !== 'function' ||
        typeof dispose.value !== 'function')
        throw new EgretError('CONTENT_PROVIDERS_INVALID');
    return FREEZE({
        load: (...args) => APPLY(load.value, value, args),
        dispose: (asset) => {
            APPLY(dispose.value, value, [asset]);
        }
    });
}
/** One manifest/source catalog, independent of global IDs and of other loaders. */
export function createContentLoader(engine, manifest, factory) {
    const owner = requireContentEngine(engine);
    if (!isAdmittedResourceManifest(manifest))
        throw new EgretError('CONTENT_MANIFEST_INVALID');
    if (typeof factory !== 'function')
        throw new EgretError('CONTENT_PROVIDERS_INVALID');
    const entries = new Map(manifest.entries.map(e => [e.id, e]));
    const imageType = createAssetType('egret.content.image', isTexture);
    const metadataType = createAssetType('egret.content.metadata', v => typeof v === 'string');
    const bindings = new Map();
    const descriptions = [];
    for (const e of entries.values()) {
        const multi = e.resourceKind === 'atlas' && e.importer.id === 'egret.atlas-pages';
        const profile = multi
            ? ['egret.atlas-pages', 'egret.atlas-pages/1', 'application/json', e.dependencies.length]
            : e.resourceKind === 'image'
                ? ['egret.png', 'png/1', 'image/png', 0]
                : e.resourceKind === 'atlas'
                    ? ['egret.aseprite-atlas', 'egret.atlas/1', 'application/json', 1]
                    : e.resourceKind === 'sequence'
                        ? ['egret.sequence', 'egret.sequence/1', 'application/json', 1]
                        : undefined;
        if ((multi && (e.dependencies.length < 1 || e.dependencies.length > 16)) ||
            !profile ||
            e.importer.id !== profile[0] ||
            e.importer.version !== '1.0.0' ||
            e.artifactFormatVersion !== profile[1] ||
            e.artifact.mediaType !== profile[2] ||
            e.dependencies.length !== profile[3] ||
            e.artifact.byteLength > (e.resourceKind === 'image' ? 8388608 : 4194304))
            throw contentFault('PROFILE', e.id);
        const dependency = entries.get(e.dependencies[0] ?? '');
        if (multi && e.dependencies.some(id => entries.get(id)?.resourceKind !== 'image'))
            throw contentFault('DEPENDENCY', e.id);
        if ((e.resourceKind === 'atlas' && dependency?.resourceKind !== 'image') ||
            (e.resourceKind === 'sequence' && dependency?.resourceKind !== 'atlas'))
            throw contentFault('DEPENDENCY', e.id);
        if (e.resourceKind === 'sequence' &&
            (e.source.id !== dependency.source.id ||
                e.source.sha256 !== dependency.source.sha256 ||
                e.source.byteLength !== dependency.source.byteLength))
            throw contentFault('SOURCE', e.id);
        const binding = e.resourceKind === 'image'
            ? createManifestAssetBinding(manifest, e.id, imageType)
            : createManifestAssetBinding(manifest, e.id, metadataType);
        bindings.set(e.id, binding);
        descriptions.push(FREEZE({ id: e.id, kind: e.resourceKind, binding }));
    }
    const ports = APPLY(factory, undefined, [FREEZE(descriptions)]);
    owner.assertOpen();
    if (ports === null || typeof ports !== 'object' || Reflect.ownKeys(ports).length !== 2)
        throw new EgretError('CONTENT_PROVIDERS_INVALID');
    const texturePort = Object.getOwnPropertyDescriptor(ports, 'textures'), metadataPort = Object.getOwnPropertyDescriptor(ports, 'metadata');
    if (!texturePort || !metadataPort || !Object.hasOwn(texturePort, 'value') || !Object.hasOwn(metadataPort, 'value'))
        throw new EgretError('CONTENT_PROVIDERS_INVALID');
    const providers = {
        textures: provider(texturePort.value),
        metadata: provider(metadataPort.value)
    };
    owner.assertOpen();
    owner.register(imageType, providers.textures);
    owner.register(metadataType, providers.metadata);
    owner.assertOpen();
    let disposed = false;
    const groups = new Set();
    let disown = () => { };
    function assertOpen() {
        owner.assertOpen();
        if (disposed)
            throw new EgretError('CONTENT_LOADER_DISPOSED');
    }
    function assertScope(scope) {
        assertOpen();
        if (!owner.isScope(scope))
            throw new EgretError('CONTENT_SCOPE_INVALID');
        if (APPLY(SCOPE_STATE, scope, []) !== 'open')
            throw new EgretError('SCOPE_CLOSED');
    }
    function dispose() {
        if (disposed)
            return;
        disposed = true;
        disown();
        for (const group of [...groups])
            group.dispose();
        groups.clear();
    }
    const loader = FREEZE({
        get isDisposed() {
            if (this !== loader)
                throw new EgretError('CONTENT_LOADER_INVALID');
            return disposed;
        },
        dispose() {
            if (this !== loader)
                throw new EgretError('CONTENT_LOADER_INVALID');
            dispose();
        },
        load(scope, roots, options) {
            if (this !== loader)
                throw new EgretError('CONTENT_LOADER_INVALID');
            assertScope(scope);
            // Capture roots once; recheck lifetime after every caller-controlled read.
            if (!Array.isArray(roots))
                throw new EgretError('CONTENT_ROOTS_INVALID');
            const count = roots.length;
            assertScope(scope);
            if (!Number.isInteger(count) || count < 0 || count > 128)
                throw new EgretError('CONTENT_ROOTS_INVALID');
            const selected = new Set(), ordered = [], captured = [];
            function visit(id) {
                if (selected.has(id))
                    return;
                const entry = entries.get(id);
                if (!entry)
                    throw contentFault('ROOT', id);
                if (selected.size === 128)
                    throw new EgretError('CONTENT_GROUP_LIMIT');
                selected.add(id);
                for (const dependency of entry.dependencies)
                    visit(dependency);
                ordered.push(entry);
            }
            for (let i = 0; i < count; i++) {
                const descriptor = Object.getOwnPropertyDescriptor(roots, String(i));
                assertScope(scope);
                if (!descriptor ||
                    !Object.hasOwn(descriptor, 'value') ||
                    typeof descriptor.value !== 'string' ||
                    captured.includes(descriptor.value))
                    throw new EgretError('CONTENT_ROOTS_INVALID');
                captured.push(descriptor.value);
                visit(descriptor.value);
            }
            const raw = owner.group(scope, manifest, FREEZE(captured), ordered.map(e => bindings.get(e.id)), options);
            const images = new Map(), sheets = new Map(), clips = new Map();
            const atlasPages = new Map(), atlasPageNames = new Map();
            let state = 'pending';
            let resolve, reject;
            const ready = new Promise((yes, no) => {
                resolve = yes;
                reject = no;
            });
            void ready.catch(() => { });
            function retire(next, cause) {
                if (state === 'disposed' || state === 'failed')
                    return;
                const pending = state === 'pending';
                state = next;
                groups.delete(group);
                if (pending)
                    reject(cause ?? new EgretError('CONTENT_GROUP_DISPOSED'));
                // Sheets borrow raw group leases; revoke the wrappers before releasing leases.
                for (const sheet of sheets.values())
                    sheet.dispose();
                for (const pages of atlasPages.values())
                    for (const page of pages.values())
                        page.dispose();
                sheets.clear();
                atlasPages.clear();
                atlasPageNames.clear();
                images.clear();
                clips.clear();
                raw.dispose();
            }
            function read(map, id) {
                assertScope(scope);
                if (state !== 'ready')
                    throw new EgretError('CONTENT_GROUP_NOT_READY');
                if (typeof id !== 'string' || !map.has(id))
                    throw new EgretError('CONTENT_RESOURCE_INVALID');
                return map.get(id);
            }
            const group = FREEZE({
                get ready() {
                    if (this !== group)
                        throw new EgretError('CONTENT_GROUP_INVALID');
                    return ready;
                },
                get isDisposed() {
                    if (this !== group)
                        throw new EgretError('CONTENT_GROUP_INVALID');
                    return state === 'disposed' || state === 'failed';
                },
                getImage(id) {
                    if (this !== group)
                        throw new EgretError('CONTENT_GROUP_INVALID');
                    return read(images, id);
                },
                getAtlas(id) {
                    if (this !== group)
                        throw new EgretError('CONTENT_GROUP_INVALID');
                    return read(sheets, id);
                },
                getAtlasPages(id) {
                    if (this !== group)
                        throw new EgretError('CONTENT_GROUP_INVALID');
                    return read(atlasPageNames, id);
                },
                getAtlasPage(id, page) {
                    if (this !== group)
                        throw new EgretError('CONTENT_GROUP_INVALID');
                    const pages = read(atlasPages, id);
                    if (typeof page !== 'string' || !pages.has(page))
                        throw new EgretError('CONTENT_RESOURCE_INVALID');
                    return pages.get(page);
                },
                getSequence(id) {
                    if (this !== group)
                        throw new EgretError('CONTENT_GROUP_INVALID');
                    return read(clips, id);
                },
                dispose() {
                    if (this !== group)
                        throw new EgretError('CONTENT_GROUP_INVALID');
                    retire('disposed');
                }
            });
            groups.add(group);
            try {
                APPLY(SCOPE_USE, scope, [group]);
                assertScope(scope);
            }
            catch (cause) {
                retire('disposed', cause);
                throw cause;
            }
            void raw.ready.then(() => {
                if (state !== 'pending')
                    return;
                try {
                    assertScope(scope);
                    const atlases = new Map();
                    for (const e of ordered) {
                        if (e.resourceKind === 'image') {
                            const lease = raw.get(bindings.get(e.id)), value = lease.value;
                            if (value.width > 4096 || value.height > 4096 || value.width * value.height > 4194304)
                                throw contentFault('IMAGE', e.id);
                            images.set(e.id, lease);
                        }
                        else {
                            const text = raw.get(bindings.get(e.id)).value;
                            if (e.resourceKind === 'atlas' && e.importer.id === 'egret.atlas-pages') {
                                const artifact = parseAtlasPagesArtifact(text, e.id, e.dependencies.length), pages = new Map();
                                // Register page wrappers before construction so partial failure
                                // revokes every successful borrow before raw leases are released.
                                atlasPages.set(e.id, pages);
                                for (let index = 0; index < artifact.pages.length; index++) {
                                    const page = artifact.pages[index], lease = images.get(e.dependencies[index]);
                                    if (lease.value.width !== page.width || lease.value.height !== page.height)
                                        throw contentFault('DIMENSIONS', e.id);
                                    pages.set(page.name, createSpriteSheet(lease, page.frames, 'trim-rotation-v1'));
                                }
                                atlasPageNames.set(e.id, FREEZE(artifact.pages.map(p => p.name)));
                            }
                            else if (e.resourceKind === 'atlas') {
                                const atlas = parseAtlasArtifact(text, e.id), page = images.get(e.dependencies[0]);
                                if (page.value.width !== atlas.width || page.value.height !== atlas.height)
                                    throw contentFault('DIMENSIONS', e.id);
                                atlases.set(e.id, atlas);
                                sheets.set(e.id, createSpriteSheet(page, atlas.frames, 'trim-rotation-v1'));
                            }
                            else {
                                const atlas = atlases.get(e.dependencies[0]);
                                if (!atlas)
                                    throw contentFault('DEPENDENCY', e.id);
                                const input = parseSequenceArtifact(text, e.id, atlas), clip = createSequenceClip(input, 'trim-rotation-v1');
                                registerSequenceTimeline(clip, input.frames);
                                clips.set(e.id, clip);
                            }
                        }
                    }
                    assertScope(scope);
                    state = 'ready';
                    resolve();
                }
                catch (cause) {
                    retire('failed', cause);
                }
            }, cause => retire('failed', contentFault('LOAD', captured.join(','), cause)));
            return group;
        }
    });
    registerContentLoader(loader, (scope, imageId, sequenceId) => {
        assertScope(scope);
        const sequence = entries.get(sequenceId), atlas = entries.get(sequence?.dependencies[0] ?? '');
        if (sequence?.resourceKind !== 'sequence' ||
            atlas?.resourceKind !== 'atlas' ||
            atlas.dependencies.length !== 1 ||
            atlas.dependencies[0] !== imageId ||
            entries.get(imageId)?.resourceKind !== 'image')
            throw new EgretError('SEQUENCE_RESET_RESOURCE_MISMATCH');
    });
    disown = owner.own(dispose);
    return loader;
}
//# sourceMappingURL=contentLoader.js.map