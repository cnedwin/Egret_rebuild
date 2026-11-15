import { EgretError } from '@egret/runtime';
import { createCanvasKitParagraphProviderOwned, decodeCanvasKitFont, canvasKitParagraphCapabilities } from './CanvasKitParagraphProvider.js';
let nextRouter = 0;
const fault = (code, cause) => new EgretError('PARAGRAPH_FONT_SET_' + code, { cause });
/** A stable cache provider routes immutable generations; it never mutates a live native font table. */
export function createCanvasKitFontSetProvider(options) {
    const canvasKit = options.canvasKit, buildIdentity = options.buildIdentity;
    if (buildIdentity !== undefined &&
        (typeof buildIdentity !== 'string' || !buildIdentity.length || buildIdentity.length > 512))
        throw fault('OPTIONS');
    const capabilities = Object.freeze({ ...canvasKitParagraphCapabilities(canvasKit), fontSets: true });
    const identity = 'egret.canvaskit-font-sets.v1:' + ++nextRouter;
    // Native face wrappers are shared only inside this router and retained by live providers.
    // The manager still owns source bytes; this table never loads or caches another resource.
    const faces = new Map();
    const borrowFont = (font) => {
        let record = faces.get(font.identity);
        if (record &&
            (record.bytes.length !== font.data.length || record.bytes.some((value, index) => value !== font.data[index])))
            throw fault('IDENTITY_COLLISION');
        if (!record) {
            const face = decodeCanvasKitFont(canvasKit, font.data);
            if (face === null)
                throw fault('DECODE_REFUSED');
            record = { face, references: 0, bytes: font.data };
            faces.set(font.identity, record);
        }
        record.references++;
        const owned = record;
        let released = false;
        return {
            face: owned.face,
            release() {
                if (released)
                    return;
                released = true;
                if (--owned.references === 0) {
                    faces.delete(font.identity);
                    owned.face.delete();
                }
            }
        };
    };
    const entries = new Map();
    let sequence = 0, closed = false, fontBytes = 0, closing;
    const failures = [];
    const finish = (entry) => {
        if (!entry.retired || entry.jobs || entry.finished)
            return;
        entry.finished = true;
        entries.delete(entry.key);
        fontBytes -= entry.bytes;
        try {
            entry.native?.dispose();
        }
        catch (cause) {
            entry.failure ??= cause;
        }
        finally {
            entry.native = undefined;
        }
        if (entry.failure !== undefined) {
            failures.push(entry.failure);
            entry.reject(entry.failure);
        }
        else
            entry.resolve();
    };
    const retire = (entry) => {
        if (!entry.retired) {
            entry.retired = true;
            try {
                entry.group.dispose();
            }
            catch (cause) {
                entry.failure = cause;
            }
        }
        finish(entry);
    };
    const active = (key) => {
        const entry = entries.get(key);
        if (entry?.group.isDisposed)
            retire(entry);
        return closed || !entry || entry.retired || !entry.native ? undefined : entry;
    };
    const provider = Object.freeze({
        identity,
        capabilities,
        hasFontSet(key) {
            if (this !== provider)
                throw fault('PROVIDER');
            return active(key) !== undefined;
        },
        getStatus() {
            if (this !== provider)
                throw fault('PROVIDER');
            return Object.freeze({
                closed,
                sets: entries.size,
                fontBytes,
                pendingJobs: [...entries.values()].reduce((sum, e) => sum + e.jobs, 0)
            });
        },
        async load(scope, loader, roots) {
            if (this !== provider || closed)
                throw fault('CLOSED');
            if (entries.size >= 8)
                throw fault('LIMIT');
            const group = loader.load(scope, roots);
            if (closed || entries.size >= 8) {
                group.dispose();
                throw fault(closed ? 'CLOSED' : 'LIMIT');
            }
            let resolve, reject;
            const done = new Promise((yes, no) => {
                resolve = yes;
                reject = no;
            });
            void done.catch(() => { });
            const entry = {
                key: identity + ':' + ++sequence,
                group,
                native: undefined,
                bytes: 0,
                jobs: 1,
                retired: false,
                finished: false,
                closed: done,
                resolve,
                reject,
                failure: undefined
            };
            entries.set(entry.key, entry);
            void group.closed.then(() => retire(entry), cause => {
                entry.failure = cause;
                retire(entry);
            });
            try {
                await group.ready;
                if (closed || entry.retired || group.isDisposed)
                    throw fault('CANCELLED');
                const fonts = group.getFonts(), size = fonts.reduce((sum, font) => sum + font.byteLength, 0);
                if (fontBytes + size > 67108864)
                    throw fault('LIMIT');
                // Reserve retained bytes before host native callbacks can reenter.
                fontBytes += size;
                entry.bytes = size;
                entry.native = createCanvasKitParagraphProviderOwned({
                    canvasKit,
                    ...(buildIdentity === undefined ? {} : { buildIdentity }),
                    fonts: fonts.map(font => ({ family: font.family, identity: font.identity, data: font.copyBytes() }))
                }, borrowFont);
                if (closed || entry.retired || group.isDisposed)
                    throw fault('CANCELLED');
                const handle = Object.freeze({
                    key: entry.key,
                    fontFamilies: Object.freeze(fonts.map(font => font.family)),
                    closed: done,
                    get isDisposed() {
                        return entry.retired || group.isDisposed;
                    },
                    dispose() {
                        retire(entry);
                    }
                });
                return handle;
            }
            catch (cause) {
                retire(entry);
                throw cause;
            }
            finally {
                entry.jobs--;
                finish(entry);
            }
        },
        async prepare(request, context) {
            if (this !== provider)
                throw fault('PROVIDER');
            const key = request.fontSet, entry = key === undefined ? undefined : active(key);
            if (!entry)
                throw fault('RETIRED');
            entry.jobs++;
            try {
                const result = await entry.native.prepare(request, context);
                if (context.signal.aborted || active(entry.key) !== entry)
                    throw fault('CANCELLED');
                return result;
            }
            finally {
                entry.jobs--;
                finish(entry);
            }
        },
        close() {
            if (this !== provider)
                throw fault('PROVIDER');
            if (!closing) {
                closed = true;
                const current = [...entries.values()];
                for (const entry of current)
                    retire(entry);
                closing = Promise.allSettled(current.map(entry => entry.closed)).then(() => {
                    if (failures.length)
                        throw new AggregateError(failures, 'Font-set cleanup failed');
                });
                void closing.catch(() => { });
            }
            return closing;
        }
    });
    return provider;
}
//# sourceMappingURL=CanvasKitFontSetProvider.js.map