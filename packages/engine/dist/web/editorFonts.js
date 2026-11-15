// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import { requireEditorEngine } from '#egret-text-editor';
const identities = new WeakMap();
let sequence = 0;
const fail = (code, cause) => new EgretError('UI_EDITOR_FONTS_' + code, { cause });
/** Private host admission: CSS aliases are never caller-provided or inferred from a family name. */
export function borrowEditorFonts(set, engine, retired) {
    const identity = identities.get(set);
    if (!identity || identity.engine !== engine || identity.entry.retired || !identity.entry.ready)
        throw fail('INVALID');
    return identity.borrow(retired);
}
export function assertEditorFonts(set, engine) {
    const identity = identities.get(set);
    if (!identity || identity.engine !== engine || identity.entry.retired || !identity.entry.ready)
        throw fail('INVALID');
}
/** CSS registration is a consumer of existing immutable font resources, not another asset cache. */
export function createBrowserEditorFontProvider(options) {
    if (!options || typeof options !== 'object')
        throw fail('OPTIONS');
    const engine = options.engine, port = requireEditorEngine(engine), owner = port.scope(options.scope);
    const paragraphProvider = options.paragraphProvider, deadline = options.deadlineMs ?? 30000;
    if (!paragraphProvider ||
        typeof paragraphProvider.load !== 'function' ||
        !Number.isFinite(deadline) ||
        deadline < 1 ||
        deadline > 120000)
        throw fail('OPTIONS');
    const document = globalThis.document, Font = globalThis.FontFace;
    if (!document || typeof Font !== 'function' || !document.fonts)
        throw fail('UNSUPPORTED');
    const add = globalThis.FontFaceSet?.prototype.add, remove = globalThis.FontFaceSet?.prototype.delete, loadFace = Font.prototype.load;
    if (typeof add !== 'function' || typeof remove !== 'function' || typeof loadFace !== 'function')
        throw fail('UNSUPPORTED');
    const providerId = ++sequence, entries = new Set(), cleanupFailures = [];
    let nextSet = 0, bytes = 0, closed = false, closing;
    function retire(entry, cause = fail('CANCELLED')) {
        if (entry.retired)
            return;
        entry.retired = true;
        entry.cancel(cause);
        // End native use before removing aliases. Retained users still keep a real lease until release.
        for (const lease of [...entry.leases])
            try {
                lease.retired();
            }
            catch (failure) {
                entry.failure ??= failure;
            }
        try {
            entry.child.dispose();
        }
        catch (failure) {
            entry.failure ??= failure;
        }
        try {
            entry.paragraph?.dispose();
        }
        catch (failure) {
            entry.failure ??= failure;
        }
        finish(entry);
    }
    function finish(entry) {
        if (!entry.retired || entry.jobs !== 0 || entry.leases.size !== 0 || entry.finishing)
            return;
        entry.finishing = true;
        for (const face of entry.faces)
            try {
                Reflect.apply(remove, document.fonts, [face]);
            }
            catch (failure) {
                entry.failure ??= failure;
            }
        entry.faces.length = 0;
        entry.aliases.clear();
        void Promise.allSettled([entry.group.closed, ...(entry.paragraph ? [entry.paragraph.closed] : [])]).then(results => {
            for (const result of results)
                if (result.status === 'rejected')
                    entry.failure ??= result.reason;
            entry.removeAbort();
            entries.delete(entry);
            bytes -= entry.bytes;
            if (entry.failure !== undefined) {
                cleanupFailures.push(entry.failure);
                entry.reject(entry.failure);
            }
            else
                entry.resolve();
        });
    }
    const provider = Object.freeze({
        async load(scope, loader, roots) {
            owner.assertOpen();
            if (closed)
                throw fail('CLOSED');
            const parent = port.scope(scope);
            if (entries.size >= 8 || !Array.isArray(roots) || roots.length < 1 || roots.length > 16)
                throw fail('LIMIT');
            const ids = Object.freeze(roots.map(id => {
                if (typeof id !== 'string' || !id.length || id.length > 512)
                    throw fail('OPTIONS');
                return id;
            }));
            const child = port.scope(port.createScope());
            let group;
            try {
                group = loader.load(child.scope, ids);
            }
            catch (cause) {
                child.dispose();
                throw cause;
            }
            let resolve, reject, cancel;
            const done = new Promise((yes, no) => {
                resolve = yes;
                reject = no;
            });
            void done.catch(() => { });
            const cancelled = new Promise((_, no) => {
                cancel = no;
            });
            void cancelled.catch(() => { });
            let entry;
            const aborted = () => {
                retire(entry);
            }, removeAbort = () => {
                parent.remove(aborted);
                owner.remove(aborted);
            };
            entry = {
                group,
                parent,
                child,
                paragraph: undefined,
                faces: [],
                aliases: new Map(),
                leases: new Set(),
                bytes: 0,
                jobs: 1,
                ready: false,
                retired: false,
                finishing: false,
                failure: undefined,
                closed: done,
                resolve,
                reject,
                cancel,
                removeAbort
            };
            entries.add(entry);
            parent.add(aborted);
            owner.add(aborted);
            const ordinal = ++nextSet;
            const work = (async () => {
                let paragraph;
                const results = await Promise.allSettled([
                    group.ready,
                    Promise.resolve().then(() => paragraphProvider.load(child.scope, loader, ids))
                ]);
                if (results[1].status === 'fulfilled') {
                    paragraph = results[1].value;
                    entry.paragraph = paragraph;
                    if (entry.retired)
                        paragraph.dispose();
                }
                for (const result of results)
                    if (result.status === 'rejected')
                        throw result.reason;
                if (!paragraph || closed || entry.retired || group.isDisposed || paragraph.isDisposed)
                    throw fail('CANCELLED');
                const fonts = group.getFonts(), total = fonts.reduce((sum, font) => sum + font.byteLength, 0);
                if (fonts.length > 16 ||
                    bytes + total > 67108864 ||
                    JSON.stringify(fonts.map(f => f.family)) !== JSON.stringify(paragraph.fontFamilies))
                    throw fail('PROFILE');
                bytes += total;
                entry.bytes = total;
                const native = [];
                let constructionFailure;
                for (let index = 0; index < fonts.length; index++)
                    try {
                        const font = fonts[index], family = 'egret_editor_' + providerId + '_' + ordinal + '_' + index;
                        const data = font.copyBytes(), face = new Font(family, data);
                        entry.faces.push(face);
                        entry.aliases.set(font.family, family);
                        native.push(Reflect.apply(loadFace, face, []));
                    }
                    catch (cause) {
                        constructionFailure = cause;
                        break;
                    }
                const loaded = await Promise.allSettled(native);
                if (constructionFailure !== undefined)
                    throw constructionFailure;
                for (const result of loaded)
                    if (result.status === 'rejected')
                        throw fail('DECODE', result.reason);
                if (closed || entry.retired || group.isDisposed || paragraph.isDisposed)
                    throw fail('CANCELLED');
                for (const face of entry.faces) {
                    Reflect.apply(add, document.fonts, [face]);
                    if (entry.retired || closed)
                        throw fail('CANCELLED');
                }
                const handle = Object.freeze({
                    key: paragraph.key,
                    fontFamilies: Object.freeze([...paragraph.fontFamilies]),
                    identities: Object.freeze(fonts.map(f => f.identity)),
                    get isDisposed() {
                        return entry.retired || group.isDisposed || paragraph.isDisposed;
                    },
                    closed: done,
                    dispose() {
                        retire(entry);
                    }
                });
                const key = paragraph.key;
                identities.set(handle, {
                    engine,
                    document,
                    entry,
                    borrow(onRetire) {
                        if (entry.retired || !entry.ready || entry.leases.size >= 64)
                            throw fail('LIMIT');
                        const user = { retired: onRetire };
                        entry.leases.add(user);
                        let released = false;
                        return Object.freeze({
                            key,
                            document,
                            get isDisposed() {
                                return entry.retired;
                            },
                            families(names) {
                                if (released || !names.length || names.some(name => !entry.aliases.has(name)))
                                    throw fail('FAMILY');
                                return names.map(name => '"' + entry.aliases.get(name) + '"').join(',');
                            },
                            release() {
                                if (released)
                                    return;
                                released = true;
                                entry.leases.delete(user);
                                finish(entry);
                            }
                        });
                    }
                });
                entry.ready = true;
                return handle;
            })();
            const timer = setTimeout(() => retire(entry, fail('TIMEOUT')), deadline);
            void work
                .catch(cause => retire(entry, cause))
                .finally(() => {
                clearTimeout(timer);
                entry.jobs--;
                finish(entry);
            });
            return Promise.race([work, cancelled]);
        },
        getStatus() {
            return Object.freeze({
                closed,
                sets: entries.size,
                fontBytes: bytes,
                pendingJobs: [...entries].reduce((n, e) => n + e.jobs, 0),
                editorLeases: [...entries].reduce((n, e) => n + e.leases.size, 0)
            });
        },
        close() {
            if (!closing) {
                closed = true;
                const current = [...entries];
                for (const entry of current)
                    retire(entry);
                owner.remove(onOwnerAbort);
                closing = Promise.allSettled(current.map(e => e.closed)).then(() => {
                    if (cleanupFailures.length)
                        throw new AggregateError(cleanupFailures, 'Editor font cleanup failed');
                });
                void closing.catch(() => { });
            }
            return closing;
        }
    });
    function onOwnerAbort() {
        void provider.close();
    }
    owner.use({ dispose: onOwnerAbort });
    owner.add(onOwnerAbort);
    return provider;
}
//# sourceMappingURL=editorFonts.js.map