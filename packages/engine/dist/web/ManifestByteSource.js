// SPDX-License-Identifier: Apache-2.0
import { isAdmittedResourceManifest } from '@egret/contracts/resources';
import { CancellationController, EgretError } from '@egret/runtime';
import { requireManifestBinding, requireManifestAssetRef } from '#egret-manifest-resources';
const apply = Reflect.apply;
const freeze = Object.freeze;
const own = Object.getOwnPropertyDescriptor;
const proto = Object.getPrototypeOf;
const keys = Reflect.ownKeys;
const Bytes = Uint8Array;
const promise = Promise.resolve.bind(Promise);
const byteProto = proto(Bytes.prototype);
const byteTag = own(byteProto, Symbol.toStringTag).get;
const byteBuffer = own(byteProto, 'buffer').get;
const byteOffset = own(byteProto, 'byteOffset').get;
const byteLength = own(byteProto, 'byteLength').get;
const bufferLength = own(ArrayBuffer.prototype, 'byteLength').get;
const resizable = own(ArrayBuffer.prototype, 'resizable')?.get;
const detached = own(ArrayBuffer.prototype, 'detached')?.get;
const set = byteProto.set;
const owners = new WeakMap();
const MAX_INPUT = 8_388_608, MAX_BYTES = 33_554_432, MAX_NETWORK = 4, MAX_DECODE = 2, MAX_QUEUE = 128, MAX_RECORDS = 132;
const retryStatus = new Set([408, 429, 500, 502, 503, 504]);
const statusFields = [
    'jobs',
    'queuedNetwork',
    'queuedDecode',
    'retryWaiting',
    'activeNetwork',
    'activeDecode',
    'encodedCreditBytes',
    'ownedEncodedBytes',
    'borrowedChunkBytes',
    'quarantinedJobs'
];
function deferred() {
    let resolve, reject;
    const result = new Promise((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise: result, resolve, reject };
}
function fault(code, cause) {
    return new EgretError('WEB_RESOURCE_' + code, { cause });
}
function record(value) {
    return typeof value === 'object' && value !== null;
}
function method(value) {
    if (typeof value !== 'function')
        throw new TypeError('Required operation unavailable');
    return value;
}
function strict(value, allowed) {
    if (!record(value) || (proto(value) !== Object.prototype && proto(value) !== null))
        throw fault('OPTIONS_INVALID');
    const result = Object.create(null);
    for (const key of keys(value)) {
        if (typeof key !== 'string' || !allowed.includes(key))
            throw fault('OPTIONS_INVALID');
        const property = own(value, key);
        if (!property || !Object.hasOwn(property, 'value') || property.value === undefined)
            throw fault('OPTIONS_INVALID');
        result[key] = property.value;
    }
    return result;
}
function chunk(value) {
    if (apply(byteTag, value, []) !== 'Uint8Array')
        throw new TypeError('Intrinsic Uint8Array required');
    const backing = apply(byteBuffer, value, []);
    apply(bufferLength, backing, []);
    if (resizable && apply(resizable, backing, []))
        throw new TypeError('Resizable byte backing refused');
    if (detached ? apply(detached, backing, []) : false)
        throw new TypeError('Detached byte backing refused');
    if (!detached)
        new Bytes(backing, 0, 0);
    return { backing, offset: apply(byteOffset, value, []), length: apply(byteLength, value, []) };
}
function spelling(value) {
    return !/[\\\u0000-\u001f\u007f?#]/.test(value) && !/%(?:2e|2f|5c|25)/i.test(value);
}
function capture() {
    try {
        const global = globalThis;
        const fetch = method(global.fetch), crypto = global.crypto, subtle = crypto.subtle;
        const digest = method(subtle.digest), Abort = global.AbortController, URL = global.URL;
        if (typeof Abort !== 'function' || typeof URL !== 'function')
            throw new TypeError('Native browser capabilities unavailable');
        const clock = global.performance;
        return {
            global,
            fetch,
            digest,
            subtle,
            Abort,
            abort: method(Abort.prototype.abort),
            signal: method(own(Abort.prototype, 'signal')?.get),
            URL,
            clock,
            now: method(clock.now),
            timer: method(global.setTimeout),
            clear: method(global.clearTimeout)
        };
    }
    catch (cause) {
        throw fault('UNAVAILABLE', cause);
    }
}
/** Private concrete token. Only its owning source can create/admit it. */
export class ManifestPngJob {
    owner;
    entry;
    url;
    end;
    context;
    publication = deferred();
    cleanup = [];
    aborter;
    nativeSignal;
    combined = new CancellationController();
    abortCombined;
    terminal;
    actual;
    timer;
    signal;
    remove;
    listener;
    installing = true;
    listening = false;
    finished = false;
    reserved = 0;
    network = false;
    networkUnsafe = false;
    decode = false;
    queuedNetwork;
    queuedDecode;
    waitingRetry = false;
    transport;
    bytes;
    borrowedChunkBytes = 0;
    delay;
    constructor(owner, entry, url, signal, remove, end, generation, taskId) {
        this.owner = owner;
        this.entry = entry;
        this.url = url;
        this.end = end;
        this.signal = signal;
        this.remove = remove;
        this.listener = () => undefined;
        const native = owner.controller();
        this.aborter = native.controller;
        this.nativeSignal = native.signal;
        this.abortCombined = method(this.combined.abort);
        this.context = freeze({ signal: this.combined.signal, resourceGeneration: generation, taskId });
        // Rejections are publication state, never an unobserved background task.
        void this.publication.promise.catch(() => undefined);
    }
}
/** Concrete fixed owner; not exported from any public SDK entry. */
export class ManifestPngOwner {
    native;
    base;
    selected = new Map();
    jobs = new Set();
    networkQueue = [];
    decodeQueue = [];
    networkCount = 0;
    decodeCount = 0;
    retryCount = 0;
    byteCount = 0;
    admissions = 0;
    closed = false;
    pumping = false;
    closeResult;
    inputLimit;
    byteLimit;
    deadlineMs;
    retries;
    highWater = {
        jobs: 0,
        queuedNetwork: 0,
        queuedDecode: 0,
        retryWaiting: 0,
        activeNetwork: 0,
        activeDecode: 0,
        encodedCreditBytes: 0,
        ownedEncodedBytes: 0,
        borrowedChunkBytes: 0,
        quarantinedJobs: 0
    };
    saturated = false;
    constructor(manifest, bindings, options) {
        if (!isAdmittedResourceManifest(manifest))
            throw fault('MANIFEST_INVALID');
        const admitted = [];
        try {
            if (!Array.isArray(bindings))
                throw new TypeError('Bounded binding array required');
            const length = bindings.length;
            if (!Number.isSafeInteger(length) || length < 0 || length > 4096)
                throw new TypeError('Bounded binding array required');
            const ids = new Set();
            for (let index = 0; index < length; index++) {
                const property = own(bindings, String(index));
                if (!property || !Object.hasOwn(property, 'value'))
                    throw new TypeError('Dense binding values required');
                const item = requireManifestBinding(property.value);
                if (item.manifest !== manifest || ids.has(item.entry.id))
                    throw new TypeError('Exact manifest and unique logical bindings required');
                ids.add(item.entry.id);
                admitted.push(item);
            }
        }
        catch (cause) {
            throw fault('BINDINGS_INVALID', cause);
        }
        const input = strict(options, ['baseUrl', 'deadlineMs', 'networkRetries', 'profile']);
        if (input.profile !== undefined && input.profile !== 'font-sfnt/1')
            throw fault('OPTIONS_INVALID');
        if (input.profile === 'font-sfnt/1' &&
            admitted.some(item => item.entry.resourceKind !== 'font' || item.entry.artifactFormatVersion !== 'egret.font/1'))
            throw fault('BINDINGS_INVALID');
        this.inputLimit = input.profile === 'font-sfnt/1' ? 33_554_432 : MAX_INPUT;
        this.byteLimit = input.profile === 'font-sfnt/1' ? 67_108_864 : MAX_BYTES;
        const deadline = input.deadlineMs ?? 10_000, retries = input.networkRetries ?? 0;
        if (typeof input.baseUrl !== 'string' ||
            typeof deadline !== 'number' ||
            !Number.isSafeInteger(deadline) ||
            deadline < 1 ||
            deadline > 30_000 ||
            (retries !== 0 && retries !== 1))
            throw fault('OPTIONS_INVALID');
        this.deadlineMs = deadline;
        this.retries = retries;
        this.native = capture();
        try {
            const text = input.baseUrl;
            if (!spelling(text) || !text.endsWith('/'))
                throw new TypeError('Explicit plain directory URL required');
            const base = new this.native.URL(text);
            if (!['http:', 'https:'].includes(base.protocol) ||
                base.username ||
                base.password ||
                base.search ||
                base.hash ||
                base.href !== text)
                throw new TypeError('Canonical http/https directory base required');
            this.base = base;
            for (const item of admitted) {
                const path = item.entry.artifact.path;
                if (!spelling(path) ||
                    path.trim() !== path ||
                    path.startsWith('/') ||
                    path.includes(':') ||
                    path.split('/').some(part => part === '.' || part === '..'))
                    throw new TypeError('Relative canonical artifact path required');
                const resolved = new this.native.URL(path, base);
                if (!this.contained(resolved))
                    throw new TypeError('Artifact URL outside allowed base');
                this.selected.set(item.entry.runtimeIdentity, { entry: item.entry, type: item.ref.type, url: resolved.href });
            }
        }
        catch (cause) {
            throw fault('URL_INVALID', cause);
        }
    }
    contained(value) {
        return (value.origin === this.base.origin &&
            value.pathname.startsWith(this.base.pathname) &&
            !value.username &&
            !value.password &&
            !value.search &&
            !value.hash);
    }
    now() {
        return apply(this.native.now, this.native.clock, []);
    }
    controller() {
        const controller = new this.native.Abort();
        return { controller, signal: apply(this.native.signal, controller, []) };
    }
    get isClosed() {
        return this.closed;
    }
    currentStatus() {
        let ownedEncodedBytes = 0, borrowedChunkBytes = 0, quarantinedJobs = 0;
        for (const job of this.jobs) {
            // The original output allocation has exactly this admitted length.
            // Reading status never inspects a caller/native byte view.
            if (job.bytes !== undefined)
                ownedEncodedBytes += job.entry.artifact.byteLength;
            borrowedChunkBytes += job.borrowedChunkBytes;
            if (job.finished)
                quarantinedJobs++;
        }
        return {
            jobs: this.jobs.size,
            queuedNetwork: this.networkQueue.length,
            queuedDecode: this.decodeQueue.length,
            retryWaiting: this.retryCount,
            activeNetwork: this.networkCount,
            activeDecode: this.decodeCount,
            encodedCreditBytes: this.byteCount,
            ownedEncodedBytes,
            borrowedChunkBytes,
            quarantinedJobs
        };
    }
    sampleStatus() {
        const current = this.currentStatus();
        for (const key of statusFields) {
            const value = current[key];
            if (value > Number.MAX_SAFE_INTEGER) {
                this.highWater[key] = Number.MAX_SAFE_INTEGER;
                this.saturated = true;
            }
            else if (value > this.highWater[key])
                this.highWater[key] = value;
        }
    }
    getStatus() {
        return freeze({
            current: freeze(this.currentStatus()),
            highWater: freeze({ ...this.highWater }),
            saturated: this.saturated
        });
    }
    begin(ref, context) {
        if (this.closed)
            throw fault('SOURCE_CLOSED');
        const started = this.now();
        let selected;
        try {
            const state = requireManifestAssetRef(ref);
            selected = this.selected.get(state.entry.runtimeIdentity);
            if (!selected || selected.type !== state.ref.type)
                throw new TypeError('Selected genuine ref required');
        }
        catch (cause) {
            throw fault('REF_INVALID', cause);
        }
        if (selected.entry.artifact.byteLength > this.inputLimit)
            throw fault('INPUT_LIMIT');
        if (this.jobs.size + this.admissions >= MAX_RECORDS || this.waitingCount() >= MAX_QUEUE)
            throw fault('QUEUE_LIMIT');
        let signal, add, remove, generation, taskId;
        try {
            if (!record(context))
                throw new TypeError('Load context required');
            signal = context.signal;
            generation = context.resourceGeneration;
            taskId = context.taskId;
            if (!record(signal) ||
                !Number.isSafeInteger(generation) ||
                generation < 1 ||
                !Number.isSafeInteger(taskId) ||
                taskId < 1)
                throw new TypeError('Signal and positive local IDs required');
            add = method(signal.addEventListener);
            remove = method(signal.removeEventListener);
        }
        catch (cause) {
            throw fault('CONTEXT_INVALID', cause);
        }
        if (this.closed)
            throw fault('SOURCE_CLOSED');
        // Caller context/signal getters may synchronously admit other work.
        // Reserve only after that external phase, with a fresh finite-cap check.
        if (this.jobs.size + this.admissions >= MAX_RECORDS || this.waitingCount() >= MAX_QUEUE)
            throw fault('QUEUE_LIMIT');
        const end = started + this.deadlineMs;
        let job;
        this.admissions++;
        try {
            job = new ManifestPngJob(this, selected.entry, selected.url, signal, remove, end, generation, taskId);
        }
        catch (cause) {
            this.admissions--;
            this.settleClose();
            throw fault('UNAVAILABLE', cause);
        }
        this.admissions--;
        this.jobs.add(job);
        this.sampleStatus();
        job.listener = () => {
            if (job.terminal)
                return;
            try {
                this.cancel(job, fault('CANCELLED', signal.reason));
            }
            catch (cause) {
                this.cancel(job, fault('CONTEXT_INVALID', cause));
            }
        };
        try {
            if (this.closed)
                this.cancel(job, fault('SOURCE_CLOSED'));
            job.timer = apply(this.native.timer, this.native.global, [
                () => this.cancel(job, fault('DEADLINE_EXCEEDED')),
                Math.max(0, end - this.now())
            ]);
            if (!job.terminal) {
                const aborted = signal.aborted;
                if (typeof aborted !== 'boolean')
                    throw new TypeError('Boolean cancellation state required');
                if (aborted)
                    job.listener();
                else {
                    job.listening = true;
                    apply(add, signal, ['abort', job.listener, { once: true }]);
                }
            }
            job.installing = false;
            if (!job.terminal) {
                const after = signal.aborted;
                if (typeof after !== 'boolean')
                    throw new TypeError('Boolean cancellation state required');
                if (after)
                    job.listener();
            }
            if (job.terminal)
                this.detach(job);
        }
        catch (cause) {
            job.installing = false;
            this.cancel(job, fault('CONTEXT_INVALID', cause));
            this.detach(job);
        }
        return job;
    }
    authentic(job) {
        if (job.owner !== this || !this.jobs.has(job) || job.finished)
            throw fault('CONTEXT_INVALID');
    }
    checkpoint(job) {
        if (!job.terminal && this.now() >= job.end)
            this.cancel(job, fault('DEADLINE_EXCEEDED'));
        if (job.terminal)
            throw job.terminal;
    }
    detach(job) {
        if (!job.listening || job.installing)
            return;
        job.listening = false;
        try {
            apply(job.remove, job.signal, ['abort', job.listener]);
        }
        catch (cause) {
            job.cleanup.push(cause);
        }
    }
    cancel(job, error) {
        if (job.owner !== this || job.finished || job.terminal)
            return;
        job.terminal = error;
        job.publication.reject(error);
        this.detach(job);
        try {
            apply(job.abortCombined, job.combined, [error]);
        }
        catch (cause) {
            job.cleanup.push(cause);
        }
        // Cancel a readable native stream before fetch abort can error it.
        // Its original cancellation still owns settlement and any cleanup failure.
        this.cancelBody(job);
        try {
            apply(this.native.abort, job.aborter, [error]);
        }
        catch (cause) {
            job.cleanup.push(cause);
            job.networkUnsafe = true;
        }
        for (const [queue, property] of [
            [this.networkQueue, 'queuedNetwork'],
            [this.decodeQueue, 'queuedDecode']
        ]) {
            const at = queue.indexOf(job);
            if (at >= 0) {
                queue.splice(at, 1);
                const waiting = job[property];
                job[property] = undefined;
                waiting?.reject(error);
            }
        }
        if (job.waitingRetry) {
            job.waitingRetry = false;
            this.retryCount--;
        }
        this.sampleStatus();
        if (job.delay) {
            const delay = job.delay;
            job.delay = undefined;
            try {
                apply(this.native.clear, this.native.global, [delay.handle]);
            }
            catch (cause) {
                job.cleanup.push(cause);
            }
            delay.finish();
        }
        this.pump();
    }
    cancelBody(job) {
        const transport = job.transport;
        if (!transport || transport.cancellation || !transport.cancel || !transport.receiver)
            return;
        // Claim cancellation before caller-owned code can re-enter close/abort.
        const cancellation = deferred();
        transport.cancellation = cancellation.promise;
        void transport.cancellation.catch(() => undefined);
        try {
            cancellation.resolve(promise(apply(transport.cancel, transport.receiver, [job.terminal])));
        }
        catch (cause) {
            cancellation.reject(cause);
        }
    }
    pump() {
        if (this.pumping)
            return;
        this.pumping = true;
        try {
            while (this.networkQueue.length && this.networkCount < MAX_NETWORK) {
                const job = this.networkQueue[0];
                if (job.terminal) {
                    this.networkQueue.shift();
                    job.queuedNetwork?.reject(job.terminal);
                    job.queuedNetwork = undefined;
                    continue;
                }
                const credit = job.reserved === 0 ? job.entry.artifact.byteLength * 2 : 0;
                if (this.byteCount + credit > this.byteLimit)
                    break;
                this.networkQueue.shift();
                this.networkCount++;
                job.network = true;
                if (credit) {
                    job.reserved = credit;
                    this.byteCount += credit;
                }
                const waiting = job.queuedNetwork;
                job.queuedNetwork = undefined;
                this.sampleStatus();
                waiting.resolve();
            }
            while (this.decodeQueue.length && this.decodeCount < MAX_DECODE) {
                const job = this.decodeQueue.shift();
                const waiting = job.queuedDecode;
                job.queuedDecode = undefined;
                if (job.terminal) {
                    waiting.reject(job.terminal);
                    continue;
                }
                this.decodeCount++;
                job.decode = true;
                this.sampleStatus();
                waiting.resolve();
            }
        }
        finally {
            this.pumping = false;
            this.sampleStatus();
        }
    }
    waitingCount() {
        return this.networkQueue.length + this.decodeQueue.length + this.retryCount;
    }
    networkPermit(job) {
        this.checkpoint(job);
        if (job.waitingRetry) {
            job.waitingRetry = false;
            this.retryCount--;
        }
        else if (this.waitingCount() >= MAX_QUEUE)
            return Promise.reject(fault('QUEUE_LIMIT'));
        const waiting = deferred();
        job.queuedNetwork = waiting;
        this.networkQueue.push(job);
        this.sampleStatus();
        this.pump();
        return waiting.promise;
    }
    async decode(job) {
        this.authentic(job);
        this.checkpoint(job);
        if (this.waitingCount() >= MAX_QUEUE)
            throw fault('QUEUE_LIMIT');
        const waiting = deferred();
        job.queuedDecode = waiting;
        this.decodeQueue.push(job);
        this.sampleStatus();
        this.pump();
        await waiting.promise;
        try {
            this.checkpoint(job);
        }
        catch (cause) {
            this.decoded(job);
            throw cause;
        }
    }
    decoded(job) {
        if (job.decode) {
            job.decode = false;
            this.decodeCount--;
            this.sampleStatus();
            this.pump();
        }
    }
    async transport(job) {
        await this.networkPermit(job);
        let result;
        let transport;
        try {
            this.checkpoint(job);
            let response;
            try {
                response = await promise(apply(this.native.fetch, this.native.global, [
                    job.url,
                    { method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: job.nativeSignal }
                ]));
            }
            catch (cause) {
                return {
                    retry: cause instanceof TypeError && !job.terminal,
                    error: job.terminal ?? fault('FETCH_FAILED', cause)
                };
            }
            if (!record(response))
                throw fault('RESPONSE_INVALID');
            const value = response;
            let body;
            try {
                body = value.body;
            }
            catch (cause) {
                job.cleanup.push(cause);
                job.networkUnsafe = true;
                throw fault('RESPONSE_INVALID', cause);
            }
            if (!record(body))
                throw fault('RESPONSE_INVALID', new TypeError('Streamed body required'));
            let bodyCancel;
            try {
                bodyCancel = method(body.cancel);
            }
            catch (cause) {
                job.cleanup.push(cause);
                job.networkUnsafe = true;
                throw fault('RESPONSE_INVALID', cause);
            }
            transport = { cancel: bodyCancel, receiver: body, cancellation: undefined, release: undefined, released: false };
            job.transport = transport;
            if (job.terminal) {
                this.cancelBody(job);
                throw job.terminal;
            }
            const status = value.status, url = value.url, redirected = value.redirected;
            if (typeof status !== 'number' || !Number.isInteger(status) || typeof url !== 'string' || redirected !== false)
                throw fault('RESPONSE_INVALID');
            const finalUrl = new this.native.URL(url);
            if (!spelling(url) || finalUrl.href !== url || !this.contained(finalUrl))
                throw fault('URL_INVALID');
            if (status !== 200) {
                this.cancelBody(job);
                return { retry: retryStatus.has(status), error: fault('HTTP_STATUS', status) };
            }
            const getReader = method(body.getReader);
            const reader = apply(getReader, body, []);
            if (!record(reader))
                throw fault('RESPONSE_INVALID');
            // The reader now owns an acquired lock. Capture retirement before
            // other reader methods, but still attempt cancellation capture if
            // retirement is unavailable. Neither absence proves clean release.
            transport.receiver = reader;
            transport.cancel = undefined;
            let captureFailed = false, captureCause;
            try {
                transport.release = method(reader.releaseLock);
            }
            catch (cause) {
                captureFailed = true;
                captureCause = cause;
                job.cleanup.push(cause);
                job.networkUnsafe = true;
            }
            try {
                transport.cancel = method(reader.cancel);
            }
            catch (cause) {
                if (!captureFailed)
                    captureCause = cause;
                captureFailed = true;
                job.cleanup.push(cause);
                job.networkUnsafe = true;
            }
            if (captureFailed)
                throw fault('RESPONSE_INVALID', captureCause);
            const read = method(reader.read);
            this.checkpoint(job);
            const expected = job.entry.artifact.byteLength;
            const output = new Bytes(expected);
            job.bytes = output;
            this.sampleStatus();
            let count = 0;
            for (;;) {
                this.checkpoint(job);
                let part;
                try {
                    part = await promise(apply(read, reader, []));
                }
                catch (cause) {
                    throw fault('BODY_FAILED', cause);
                }
                this.checkpoint(job);
                if (!record(part))
                    throw fault('BODY_FAILED', new TypeError('Reader result required'));
                const done = part.done;
                if (typeof done !== 'boolean')
                    throw fault('BODY_FAILED');
                if (done)
                    break;
                let item;
                try {
                    item = chunk(part.value);
                }
                catch (cause) {
                    throw fault('BODY_FAILED', cause);
                }
                if (item.length > expected - count || item.length > this.inputLimit - count)
                    throw fault('INPUT_LIMIT');
                job.borrowedChunkBytes = item.length;
                this.sampleStatus();
                try {
                    apply(set, output, [new Bytes(item.backing, item.offset, item.length), count]);
                    count += item.length;
                }
                finally {
                    job.borrowedChunkBytes = 0;
                    this.sampleStatus();
                }
            }
            if (count !== expected)
                throw fault('LENGTH_MISMATCH');
            result = { bytes: output };
        }
        catch (cause) {
            if (transport)
                this.cancelBody(job);
            result = { error: job.terminal ?? (cause instanceof EgretError ? cause : fault('RESPONSE_INVALID', cause)) };
        }
        finally {
            let awaitedCancellation;
            if (transport?.cancellation) {
                awaitedCancellation = transport.cancellation;
                try {
                    await awaitedCancellation;
                }
                catch (cause) {
                    job.cleanup.push(cause);
                    job.networkUnsafe = true;
                }
            }
            if (transport?.release && !transport.released) {
                transport.released = true;
                try {
                    apply(transport.release, transport.receiver, []);
                }
                catch (cause) {
                    job.cleanup.push(cause);
                    job.networkUnsafe = true;
                }
            }
            // releaseLock is caller-owned and can synchronously initiate abort.
            // Its newly started cancellation remains part of this original run.
            if (transport?.cancellation && transport.cancellation !== awaitedCancellation) {
                try {
                    await transport.cancellation;
                }
                catch (cause) {
                    job.cleanup.push(cause);
                    job.networkUnsafe = true;
                }
            }
            job.transport = undefined;
            if (job.network && !job.networkUnsafe) {
                job.network = false;
                this.networkCount--;
                this.sampleStatus();
                this.pump();
            }
        }
        return result;
    }
    async waitRetry(job) {
        this.checkpoint(job);
        if (job.end - this.now() < 100) {
            this.cancel(job, fault('DEADLINE_EXCEEDED'));
            throw job.terminal;
        }
        if (this.waitingCount() >= MAX_QUEUE)
            throw fault('QUEUE_LIMIT');
        job.waitingRetry = true;
        this.retryCount++;
        this.sampleStatus();
        await new Promise(resolve => {
            const handle = apply(this.native.timer, this.native.global, [
                () => {
                    job.delay = undefined;
                    resolve();
                },
                100
            ]);
            job.delay = { handle, finish: resolve };
        });
        // Keep this single waiting reservation until networkPermit transfers it
        // synchronously to the network queue, or cancellation releases it.
        this.checkpoint(job);
    }
    readActual(job) {
        this.authentic(job);
        if (job.actual)
            return job.actual;
        job.actual = (async () => {
            for (let attempt = 0;; attempt++) {
                const result = await this.transport(job);
                if (job.networkUnsafe)
                    throw fault('CLOSE_INCOMPLETE', job.cleanup[0]);
                this.checkpoint(job);
                if (result.error) {
                    if (result.retry && attempt < this.retries) {
                        job.bytes = undefined;
                        this.sampleStatus();
                        await this.waitRetry(job);
                        continue;
                    }
                    throw result.error;
                }
                const data = result.bytes;
                let hash;
                try {
                    hash = await promise(apply(this.native.digest, this.native.subtle, ['SHA-256', data]));
                }
                catch (cause) {
                    throw fault('INTEGRITY_MISMATCH', cause);
                }
                this.checkpoint(job);
                const digest = new Bytes(hash);
                if (digest.byteLength !== 32 ||
                    Array.from(digest, value => value.toString(16).padStart(2, '0')).join('') !== job.entry.artifact.sha256)
                    throw fault('INTEGRITY_MISMATCH');
                return data;
            }
        })().catch(cause => {
            const error = cause instanceof EgretError ? cause : fault('BODY_FAILED', cause);
            this.cancel(job, error);
            throw error;
        });
        void job.actual.catch(() => undefined);
        return job.actual;
    }
    publish(job, value) {
        try {
            this.checkpoint(job);
        }
        catch {
            return false;
        }
        job.publication.resolve(value);
        return true;
    }
    reject(job, cause) {
        this.cancel(job, cause instanceof EgretError ? cause : fault('BODY_FAILED', cause));
    }
    publication(job) {
        return job.publication.promise;
    }
    finish(job) {
        if (job.finished)
            return;
        this.detach(job);
        if (job.timer !== undefined) {
            try {
                apply(this.native.clear, this.native.global, [job.timer]);
            }
            catch (cause) {
                job.cleanup.push(cause);
            }
            job.timer = undefined;
        }
        job.finished = true;
        if (job.cleanup.length === 0) {
            this.byteCount -= job.reserved;
            job.reserved = 0;
            job.bytes = undefined;
            this.jobs.delete(job);
        }
        this.sampleStatus();
        this.pump();
        this.settleClose();
    }
    settleClose() {
        if (!this.closeResult || this.admissions !== 0 || [...this.jobs].some(job => !job.finished))
            return;
        const cleanup = [...this.jobs].flatMap(job => job.cleanup);
        if (cleanup.length)
            this.closeResult.reject(new EgretError('WEB_RESOURCE_CLOSE_INCOMPLETE', { cause: cleanup[0], cleanupErrors: cleanup }));
        else
            this.closeResult.resolve();
    }
    close() {
        if (!this.closeResult) {
            this.closed = true;
            this.closeResult = deferred();
            for (const job of this.jobs)
                this.cancel(job, fault('SOURCE_CLOSED'));
            this.settleClose();
        }
        return this.closeResult.promise;
    }
}
export function requireManifestByteSource(source) {
    const owner = owners.get(source);
    if (!owner)
        throw fault('SOURCE_INVALID');
    return owner;
}
export function createManifestByteSource(manifest, bindings, options) {
    const owner = new ManifestPngOwner(manifest, bindings, options);
    const source = freeze({
        profile: 'manifest-sha256-browser-v1',
        get isClosed() {
            if (this !== source)
                throw fault('SOURCE_INVALID');
            return owner.isClosed;
        },
        readBytes(ref, context) {
            if (this !== source)
                return Promise.reject(fault('SOURCE_INVALID'));
            let job;
            try {
                job = owner.begin(ref, context);
            }
            catch (cause) {
                return Promise.reject(cause);
            }
            void owner.readActual(job).then(value => {
                owner.publish(job, value);
                owner.finish(job);
            }, cause => {
                owner.reject(job, cause);
                owner.finish(job);
            });
            return owner.publication(job);
        },
        close() {
            if (this !== source)
                throw fault('SOURCE_INVALID');
            return owner.close();
        },
        getStatus() {
            if (this !== source)
                throw fault('SOURCE_INVALID');
            return owner.getStatus();
        }
    });
    owners.set(source, owner);
    return source;
}
//# sourceMappingURL=ManifestByteSource.js.map