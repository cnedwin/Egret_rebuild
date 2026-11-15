// SPDX-License-Identifier: Apache-2.0
import { createImageData2D, IMAGE_LIMITS_2D } from '@egret/contracts';
import { createTexture, Texture, EgretError } from '@egret/runtime';
// Normal-realm intrinsics protect byte admission from instance getters/species.
const Bytes = Uint8Array;
const apply = Reflect.apply;
const freeze = Object.freeze;
const safeInteger = Number.isSafeInteger;
const resolvePromise = Promise.resolve.bind(Promise);
const originalTextureDispose = Texture.prototype.dispose;
const typedPrototype = Object.getPrototypeOf(Bytes.prototype);
const tagGetter = Object.getOwnPropertyDescriptor(typedPrototype, Symbol.toStringTag).get;
const backingGetter = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer').get;
const offsetGetter = Object.getOwnPropertyDescriptor(typedPrototype, 'byteOffset').get;
const lengthGetter = Object.getOwnPropertyDescriptor(typedPrototype, 'byteLength').get;
const backingLengthGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get;
const resizableGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const detachedGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'detached')?.get;
const setBytes = typedPrototype.set;
const MAX_JOBS = 4, MAX_BYTES = 8_388_608, MAX_TOTAL_BYTES = 33_554_432, MAX_CHUNKS = 1_024;
const statusFields = [
    'jobs',
    'encodedCreditBytes',
    'ownedEncodedBytes',
    'blobLogicalBytes',
    'activeDecodes',
    'bitmapLogicalBytes',
    'rasterLogicalBytes',
    'readbackCpuBytes',
    'materializedCpuBytes',
    'quarantinedJobs',
    'unknownNativeObjects'
];
function fault(code, cause) {
    return new EgretError('WEB_PNG_' + code, { cause });
}
function record(value) {
    return typeof value === 'object' && value !== null;
}
function descriptor(target, key) {
    try {
        return target[key];
    }
    catch (cause) {
        throw fault('DESCRIPTOR_READ_FAILED', cause);
    }
}
function functionValue(value) {
    return typeof value === 'function';
}
function fixedBacking(value, expectedTag) {
    if (apply(tagGetter, value, []) !== expectedTag)
        throw new TypeError('Intrinsic byte view required');
    const backing = apply(backingGetter, value, []);
    apply(backingLengthGetter, backing, []); // Refuses SharedArrayBuffer, also across realms.
    if (resizableGetter && apply(resizableGetter, backing, []))
        throw new TypeError('Resizable backing is outside this profile');
    if (detachedGetter) {
        if (apply(detachedGetter, backing, []))
            throw new TypeError('Detached backing');
    }
    else
        new Bytes(backing, 0, 0);
    return {
        backing,
        offset: apply(offsetGetter, value, []),
        length: apply(lengthGetter, value, [])
    };
}
function u32(bytes, at) {
    return bytes[at] * 16_777_216 + bytes[at + 1] * 65_536 + bytes[at + 2] * 256 + bytes[at + 3];
}
/** Bounded framing/profile admission only: CRC storage is read, never decoded. */
function preflight(bytes) {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 8 || signature.some((value, at) => bytes[at] !== value)) {
        throw fault('STRUCTURE_INVALID', new TypeError('PNG signature required'));
    }
    const chunks = [];
    let at = 8;
    while (at < bytes.length) {
        if (chunks.length === MAX_CHUNKS)
            throw fault('INPUT_LIMIT', new RangeError('PNG chunk count limit'));
        if (bytes.length - at < 12)
            throw fault('STRUCTURE_INVALID', new TypeError('Incomplete PNG chunk'));
        const length = u32(bytes, at);
        if (length > 0x7fffffff || length > bytes.length - at - 12) {
            throw fault('STRUCTURE_INVALID', new RangeError('PNG chunk length outside framing'));
        }
        let type = '';
        for (let index = 0; index < 4; index++) {
            const value = bytes[at + 4 + index];
            if (!((value >= 65 && value <= 90) || (value >= 97 && value <= 122)) || (index === 2 && value > 90)) {
                throw fault('STRUCTURE_INVALID', new TypeError('PNG chunk type spelling'));
            }
            type += String.fromCharCode(value);
        }
        chunks.push({ type, offset: at + 8, length });
        at += 12 + length;
    }
    // Finish structural length/order checks before considering unsupported values.
    if (chunks[0]?.type !== 'IHDR' || chunks[0].length !== 13 || chunks.at(-1)?.type !== 'IEND') {
        throw fault('STRUCTURE_INVALID', new TypeError('Complete IHDR/IDAT/IEND structure required'));
    }
    let idat = 0, idatState = 0;
    const metadata = new Map();
    for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index];
        if ((chunk.type === 'IHDR' && index !== 0) ||
            (chunk.type === 'IEND' && (index !== chunks.length - 1 || chunk.length !== 0))) {
            throw fault('STRUCTURE_INVALID', new TypeError('Duplicate or misplaced PNG boundary chunk'));
        }
        if (chunk.type === 'IDAT') {
            if (idatState === 2)
                throw fault('STRUCTURE_INVALID', new TypeError('PNG IDAT must be consecutive'));
            idatState = 1;
            idat += chunk.length;
        }
        else if (idatState === 1)
            idatState = 2;
        if (['sRGB', 'gAMA', 'cHRM'].includes(chunk.type)) {
            const expected = chunk.type === 'sRGB' ? 1 : chunk.type === 'gAMA' ? 4 : 32;
            if (metadata.has(chunk.type) || idatState !== 0 || chunk.length !== expected) {
                throw fault('STRUCTURE_INVALID', new TypeError('PNG color metadata length/order'));
            }
            metadata.set(chunk.type, chunk);
        }
    }
    if (idat === 0)
        throw fault('STRUCTURE_INVALID', new TypeError('Nonempty PNG image data required'));
    const header = chunks[0], width = u32(bytes, header.offset), height = u32(bytes, header.offset + 4);
    if (width === 0 || height === 0)
        throw fault('STRUCTURE_INVALID', new TypeError('Positive PNG dimensions required'));
    if (width > IMAGE_LIMITS_2D.maxSourceEdge ||
        height > IMAGE_LIMITS_2D.maxSourceEdge ||
        width * height > IMAGE_LIMITS_2D.maxSourcePixels) {
        throw fault('INPUT_LIMIT', new RangeError('PNG image source dimensions exceed capacity'));
    }
    if (bytes[header.offset + 8] !== 8 ||
        ![2, 6].includes(bytes[header.offset + 9]) ||
        bytes[header.offset + 10] !== 0 ||
        bytes[header.offset + 11] !== 0 ||
        bytes[header.offset + 12] !== 0 ||
        chunks.some(chunk => !['IHDR', 'IDAT', 'IEND', 'sRGB', 'gAMA', 'cHRM'].includes(chunk.type))) {
        throw fault('PROFILE_UNSUPPORTED', new TypeError('PNG is outside the RGB/RGBA8 noninterlaced subset'));
    }
    const srgb = metadata.get('sRGB'), gamma = metadata.get('gAMA'), chromaticity = metadata.get('cHRM');
    if ((srgb && bytes[srgb.offset] > 3) ||
        ((gamma || chromaticity) && !srgb) ||
        (gamma && u32(bytes, gamma.offset) !== 45455)) {
        throw fault('PROFILE_UNSUPPORTED', new TypeError('PNG color metadata is outside the sRGB compatibility profile'));
    }
    if (chromaticity) {
        const expected = [31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000];
        if (expected.some((value, index) => u32(bytes, chromaticity.offset + index * 4) !== value)) {
            throw fault('PROFILE_UNSUPPORTED', new TypeError('PNG chromaticity compatibility values differ'));
        }
    }
    return { width, height };
}
function capturePorts(supplied) {
    try {
        // Supplied ports require Blob but intentionally never inspect window/document.
        const blob = globalThis.Blob;
        if (typeof blob !== 'function')
            throw new TypeError('Native Blob unavailable');
        if (supplied !== undefined)
            return {
                blob,
                decode: supplied.decode,
                decodeReceiver: supplied.receiver,
                canvas: supplied.canvas,
                canvasReceiver: supplied.receiver,
                nativeClose: undefined
            };
        if (typeof window === 'undefined' || typeof document === 'undefined' || window.document !== document) {
            throw new TypeError('Same-window document unavailable');
        }
        const owner = document, create = owner.createElement, nativeDecode = window.createImageBitmap;
        const nativeClose = typeof ImageBitmap === 'function' ? ImageBitmap.prototype.close : undefined;
        if (typeof create !== 'function' || typeof nativeDecode !== 'function' || typeof nativeClose !== 'function') {
            throw new TypeError('Native PNG browser operations unavailable');
        }
        return {
            blob,
            decode: nativeDecode,
            decodeReceiver: window,
            canvas: (() => apply(create, owner, ['canvas'])),
            canvasReceiver: owner,
            nativeClose: nativeClose
        };
    }
    catch (cause) {
        throw fault('UNAVAILABLE', cause);
    }
}
/** Caller owns async close; managers own issued Textures and their final demand. */
export function createBrowserTextureProvider(options) {
    return assembleBrowserTextureProvider(options);
}
/** Called only by the authenticated optional resource entry. */
export function createManifestPngTextureProvider(owner, options) {
    return assembleBrowserTextureProvider(options, owner);
}
function assembleBrowserTextureProvider(options, owner) {
    if (!record(options))
        throw fault('OPTIONS_INVALID', new TypeError('PNG provider options must be a record'));
    const reader = owner === undefined ? descriptor(options, 'readBytes') : undefined, supplied = descriptor(options, 'ports');
    let suppliedMethods;
    if (supplied !== undefined) {
        if (!record(supplied))
            throw fault('OPTIONS_INVALID', new TypeError('PNG ports must be a record'));
        const decode = descriptor(supplied, 'decode'), canvas = descriptor(supplied, 'createCanvas');
        if (!functionValue(decode) || !functionValue(canvas))
            throw fault('OPTIONS_INVALID', new TypeError('PNG port methods required'));
        suppliedMethods = { receiver: supplied, decode, canvas };
    }
    if (owner === undefined && !functionValue(reader))
        throw fault('OPTIONS_INVALID', new TypeError('PNG reader must be a function'));
    const readBytesOperation = reader;
    const ports = capturePorts(suppliedMethods);
    let closed = false, occupied = 0, encoded = 0, manifestAdmissions = 0;
    let closePromise;
    let resolveClose, rejectClose;
    const jobs = [], handles = new WeakSet(), issued = new WeakMap();
    const manifestRuns = new Map();
    const highWater = {
        jobs: 0,
        encodedCreditBytes: 0,
        ownedEncodedBytes: 0,
        blobLogicalBytes: 0,
        activeDecodes: 0,
        bitmapLogicalBytes: 0,
        rasterLogicalBytes: 0,
        readbackCpuBytes: 0,
        materializedCpuBytes: 0,
        quarantinedJobs: 0,
        unknownNativeObjects: 0
    };
    let saturated = false;
    let provider;
    function currentStatus() {
        const current = {
            jobs: occupied,
            encodedCreditBytes: encoded,
            ownedEncodedBytes: 0,
            blobLogicalBytes: 0,
            activeDecodes: 0,
            bitmapLogicalBytes: 0,
            rasterLogicalBytes: 0,
            readbackCpuBytes: 0,
            materializedCpuBytes: 0,
            quarantinedJobs: 0,
            unknownNativeObjects: 0
        };
        for (const job of jobs) {
            const info = job.diagnostics;
            if (job.bytes !== undefined)
                current.ownedEncodedBytes += job.credit;
            current.blobLogicalBytes += info.blobBytes;
            if (info.decodeActive)
                current.activeDecodes++;
            if (job.bitmap !== undefined) {
                current.bitmapLogicalBytes += info.bitmapBytes;
                if (info.bitmapUnsafe)
                    current.unknownNativeObjects++;
            }
            if (job.canvas !== undefined) {
                if (info.surfaceWidth !== undefined && info.surfaceHeight !== undefined)
                    current.rasterLogicalBytes += 4 * info.surfaceWidth * info.surfaceHeight;
                if (info.surfaceUnsafe)
                    current.unknownNativeObjects++;
            }
            else if (job.uncertainSurface !== undefined)
                current.unknownNativeObjects++;
            current.readbackCpuBytes += info.readbackBytes;
            current.materializedCpuBytes += info.materializedBytes;
            if (job.settled)
                current.quarantinedJobs++;
        }
        return current;
    }
    function sampleStatus() {
        if (owner === undefined)
            return;
        const current = currentStatus();
        for (const key of statusFields) {
            const value = current[key];
            if (value > Number.MAX_SAFE_INTEGER) {
                highWater[key] = Number.MAX_SAFE_INTEGER;
                saturated = true;
            }
            else if (value > highWater[key])
                highWater[key] = value;
        }
    }
    function gate() {
        if (closed)
            throw fault('PROVIDER_CLOSED', new TypeError('PNG provider is closed'));
    }
    function checkpoint(signal) {
        gate();
        let aborted;
        try {
            aborted = signal.aborted;
        }
        catch (cause) {
            throw fault('SIGNAL_READ_FAILED', cause);
        }
        gate();
        if (typeof aborted !== 'boolean')
            throw fault('SIGNAL_READ_FAILED', new TypeError('Cancellation aborted must be boolean'));
        if (aborted) {
            let reason;
            try {
                reason = signal.reason;
            }
            catch (cause) {
                throw fault('SIGNAL_READ_FAILED', cause);
            }
            gate();
            throw fault('CANCELLED', reason);
        }
    }
    function read(target, key, signal) {
        const value = descriptor(target, key);
        checkpoint(signal);
        return value;
    }
    function call(operation, receiver, args, code) {
        try {
            return apply(operation, receiver, args);
        }
        catch (cause) {
            throw fault(code, cause);
        }
    }
    function closeWhenSettled() {
        if (!closed ||
            closePromise === undefined ||
            manifestAdmissions !== 0 ||
            manifestRuns.size !== 0 ||
            jobs.some(job => !job.settled))
            return;
        // jobs retain admission order; quarantine reasons retain observation order.
        const reasons = jobs.flatMap(job => job.reasons);
        if (reasons.length)
            rejectClose(new EgretError('WEB_PNG_CLOSE_INCOMPLETE', { cause: reasons[0], cleanupErrors: reasons }));
        else
            resolveClose();
    }
    function retain(job, cause) {
        job.reasons.push(cause);
    }
    function retire(job) {
        const cleanup = [];
        if (job.bitmap !== undefined && job.bitmapClose !== undefined) {
            try {
                apply(job.bitmapClose, job.bitmap, []);
                job.bitmap = undefined;
                job.bitmapClose = undefined;
                if (job.diagnostics) {
                    job.diagnostics.bitmapBytes = 0;
                    job.diagnostics.bitmapUnsafe = false;
                }
                sampleStatus();
            }
            catch (cause) {
                if (job.diagnostics)
                    job.diagnostics.bitmapUnsafe = true;
                cleanup.push(cause);
                retain(job, cause);
                sampleStatus();
            }
        }
        if (job.canvas !== undefined) {
            let clean = true;
            // Every actual reset is attempted once, even after undefined failures.
            for (const key of ['width', 'height']) {
                try {
                    job.canvas[key] = 0;
                    if (job.canvas[key] !== 0)
                        throw new TypeError('Canvas retirement reset was not accepted');
                    if (job.diagnostics) {
                        if (key === 'width')
                            job.diagnostics.surfaceWidth = 0;
                        else
                            job.diagnostics.surfaceHeight = 0;
                    }
                    sampleStatus();
                }
                catch (cause) {
                    if (job.diagnostics)
                        job.diagnostics.surfaceUnsafe = true;
                    clean = false;
                    cleanup.push(cause);
                    retain(job, cause);
                    sampleStatus();
                }
            }
            if (clean)
                job.canvas = undefined;
            sampleStatus();
        }
        return cleanup;
    }
    function bitmap(job, value) {
        if (!record(value))
            throw fault('BITMAP_INVALID', new TypeError('Decoded bitmap object required'));
        if (handles.has(value)) {
            const cause = new TypeError('Bitmap identity was already observed');
            retain(job, cause);
            throw fault('BITMAP_INVALID', cause);
        }
        handles.add(value);
        job.bitmap = value;
        sampleStatus();
        let close;
        try {
            close = ports.nativeClose ?? descriptor(value, 'close');
        }
        catch (error) {
            if (job.diagnostics)
                job.diagnostics.bitmapUnsafe = true;
            retain(job, error.cause);
            sampleStatus();
            throw error;
        }
        if (!functionValue(close)) {
            if (job.diagnostics)
                job.diagnostics.bitmapUnsafe = true;
            const cause = new TypeError('Decoded bitmap cannot be closed');
            retain(job, cause);
            sampleStatus();
            throw fault('BITMAP_INVALID', cause);
        }
        job.bitmapClose = close;
        return value;
    }
    function surface(job, value) {
        if (!record(value))
            throw fault('SURFACE_INVALID', new TypeError('Canvas object required'));
        if (handles.has(value)) {
            const cause = new TypeError('Canvas identity was already observed');
            retain(job, cause);
            throw fault('SURFACE_INVALID', cause);
        }
        handles.add(value);
        let connected;
        try {
            connected = descriptor(value, 'isConnected');
        }
        catch (error) {
            job.uncertainSurface = value;
            retain(job, error.cause);
            sampleStatus();
            throw error;
        }
        if (connected !== false) {
            job.uncertainSurface = value;
            const cause = new TypeError('Fresh unattached Canvas required');
            retain(job, cause);
            sampleStatus();
            throw fault('SURFACE_INVALID', cause);
        }
        job.canvas = value;
        sampleStatus();
        return value;
    }
    function state(target, key, value, signal) {
        try {
            target[key] = value;
        }
        catch (cause) {
            throw fault('RASTER_FAILED', cause);
        }
        checkpoint(signal);
        if (read(target, key, signal) !== value)
            throw fault('RASTER_FAILED', new TypeError('Canvas state assignment was not accepted'));
    }
    function settled(job) {
        job.settled = true;
        if (job.reasons.length === 0) {
            occupied--;
            encoded -= job.credit;
            job.bytes = undefined;
            jobs.splice(jobs.indexOf(job), 1);
        }
        sampleStatus();
        closeWhenSettled();
    }
    async function loadActual(ref, context, token) {
        if (this !== provider)
            throw fault('PROVIDER_INVALID', new TypeError('Exact PNG provider receiver required'));
        gate();
        if (occupied >= MAX_JOBS)
            throw fault('JOB_LIMIT', new RangeError('PNG occupied job limit'));
        const job = {
            settled: false,
            credit: 0,
            bytes: undefined,
            reasons: [],
            bitmap: undefined,
            bitmapClose: undefined,
            canvas: undefined,
            uncertainSurface: undefined,
            diagnostics: owner === undefined
                ? undefined
                : {
                    blobBytes: 0,
                    decodeActive: false,
                    bitmapBytes: 0,
                    bitmapUnsafe: false,
                    surfaceWidth: undefined,
                    surfaceHeight: undefined,
                    surfaceUnsafe: false,
                    readbackBytes: 0,
                    materializedBytes: 0
                }
        };
        occupied++;
        jobs.push(job);
        if (token !== undefined)
            manifestRuns.set(token, job);
        sampleStatus();
        let image, primaryOccurred = false, primary, capturedSignal;
        try {
            if (!record(context))
                throw fault('CONTEXT_INVALID', new TypeError('PNG context must be a record'));
            const signalValue = descriptor(context, 'signal');
            gate();
            const generation = descriptor(context, 'resourceGeneration');
            gate();
            const taskId = descriptor(context, 'taskId');
            gate();
            if (!record(signalValue) ||
                typeof generation !== 'number' ||
                !safeInteger(generation) ||
                generation <= 0 ||
                typeof taskId !== 'number' ||
                !safeInteger(taskId) ||
                taskId <= 0) {
                throw fault('CONTEXT_INVALID', new TypeError('PNG signal and positive manager-local identities required'));
            }
            const signal = signalValue;
            capturedSignal = signal;
            checkpoint(signal);
            const sourcePending = token === undefined
                ? resolvePromise(call(readBytesOperation, options, [ref, context], 'READ_FAILED'))
                : owner.readActual(token);
            let sourceTransition;
            try {
                checkpoint(signal);
            }
            catch (cause) {
                sourceTransition = cause;
            }
            let source;
            // Observe settlement even after a terminal callback; no job is refunded early.
            try {
                source = await sourcePending;
            }
            catch (cause) {
                throw fault('READ_FAILED', cause);
            }
            if (sourceTransition !== undefined)
                throw sourceTransition;
            checkpoint(signal);
            let binary;
            try {
                binary = fixedBacking(source, 'Uint8Array');
            }
            catch (cause) {
                throw fault('BYTES_INVALID', cause);
            }
            checkpoint(signal);
            if (binary.length > MAX_BYTES || encoded + binary.length > MAX_TOTAL_BYTES)
                throw fault('INPUT_LIMIT', new RangeError('PNG encoded payload limit'));
            job.credit = binary.length;
            encoded += binary.length;
            sampleStatus();
            try {
                job.bytes = new Bytes(binary.length);
                sampleStatus();
                apply(setBytes, job.bytes, [new Bytes(binary.backing, binary.offset, binary.length)]);
            }
            catch (cause) {
                throw fault('BYTES_INVALID', cause);
            }
            const size = preflight(job.bytes);
            checkpoint(signal);
            let blob;
            try {
                blob = new ports.blob([job.bytes], { type: 'image/png' });
            }
            catch (cause) {
                throw fault('BLOB_FAILED', cause);
            }
            // One successful native Blob construction from one exact byte array.
            // This known logical payload needs no additional Blob.size getter.
            if (job.diagnostics)
                job.diagnostics.blobBytes = binary.length;
            sampleStatus();
            checkpoint(signal);
            const decodeOptions = freeze({
                imageOrientation: 'from-image',
                premultiplyAlpha: 'none',
                colorSpaceConversion: 'none'
            });
            let decodeTransition;
            let decoded;
            if (token !== undefined)
                await owner.decode(token);
            try {
                if (token !== undefined)
                    checkpoint(signal);
                if (job.diagnostics)
                    job.diagnostics.decodeActive = true;
                sampleStatus();
                const decodePending = resolvePromise(call(ports.decode, ports.decodeReceiver, [blob, decodeOptions], 'DECODE_FAILED'));
                try {
                    checkpoint(signal);
                }
                catch (cause) {
                    decodeTransition = cause;
                }
                try {
                    decoded = await decodePending;
                }
                catch (cause) {
                    throw fault('DECODE_FAILED', cause);
                }
            }
            finally {
                if (job.diagnostics)
                    job.diagnostics.decodeActive = false;
                sampleStatus();
                if (token !== undefined)
                    owner.decoded(token);
            }
            // Always capture retirement; its refusal cannot replace an observed primary.
            let picture;
            try {
                picture = bitmap(job, decoded);
            }
            catch (cause) {
                if (decodeTransition !== undefined)
                    throw decodeTransition;
                throw cause;
            }
            if (decodeTransition !== undefined)
                throw decodeTransition;
            checkpoint(signal);
            let width, height;
            try {
                width = read(picture, 'width', signal);
                height = read(picture, 'height', signal);
            }
            catch (cause) {
                // Cancellation alone does not classify a healthy acquired object
                // as unknown; failed original dimension qualification does.
                if (job.diagnostics && cause instanceof EgretError && cause.code === 'WEB_PNG_DESCRIPTOR_READ_FAILED')
                    job.diagnostics.bitmapUnsafe = true;
                sampleStatus();
                throw cause;
            }
            if (width !== size.width || height !== size.height || !safeInteger(width) || !safeInteger(height)) {
                if (job.diagnostics)
                    job.diagnostics.bitmapUnsafe = true;
                sampleStatus();
                throw fault('BITMAP_INVALID', new TypeError('Bitmap dimensions must match admitted IHDR'));
            }
            if (job.diagnostics)
                job.diagnostics.bitmapBytes = 4 * size.width * size.height;
            sampleStatus();
            checkpoint(signal);
            const canvas = surface(job, call(ports.canvas, ports.canvasReceiver, [], 'RASTER_FAILED'));
            checkpoint(signal);
            try {
                state(canvas, 'width', size.width, signal);
                if (job.diagnostics)
                    job.diagnostics.surfaceWidth = size.width;
                sampleStatus();
                state(canvas, 'height', size.height, signal);
                if (job.diagnostics)
                    job.diagnostics.surfaceHeight = size.height;
                sampleStatus();
            }
            catch (cause) {
                if (job.diagnostics &&
                    cause instanceof EgretError &&
                    (cause.code === 'WEB_PNG_RASTER_FAILED' || cause.code === 'WEB_PNG_DESCRIPTOR_READ_FAILED'))
                    job.diagnostics.surfaceUnsafe = true;
                sampleStatus();
                throw cause;
            }
            const getContext = read(canvas, 'getContext', signal);
            if (!functionValue(getContext))
                throw fault('SURFACE_INVALID', new TypeError('Canvas 2d operation required'));
            const drawing = call(getContext, canvas, ['2d', { alpha: true, colorSpace: 'srgb', willReadFrequently: true }], 'RASTER_FAILED');
            checkpoint(signal);
            if (!record(drawing))
                throw fault('SURFACE_INVALID', new TypeError('Canvas 2d context required'));
            const attributesOperation = read(drawing, 'getContextAttributes', signal);
            if (!functionValue(attributesOperation))
                throw fault('SURFACE_INVALID', new TypeError('Context attributes operation required'));
            const attributes = call(attributesOperation, drawing, [], 'RASTER_FAILED');
            checkpoint(signal);
            if (!record(attributes))
                throw fault('SURFACE_INVALID', new TypeError('Context attributes record required'));
            const alpha = read(attributes, 'alpha', signal), colorSpace = read(attributes, 'colorSpace', signal);
            if (alpha !== true || colorSpace !== 'srgb')
                throw fault('SURFACE_INVALID', new TypeError('Straight sRGB alpha readback requires explicit Canvas support'));
            const transform = read(drawing, 'setTransform', signal), draw = read(drawing, 'drawImage', signal), pixels = read(drawing, 'getImageData', signal);
            if (!functionValue(transform) || !functionValue(draw) || !functionValue(pixels))
                throw fault('SURFACE_INVALID', new TypeError('Complete Canvas raster operations required'));
            call(transform, drawing, [1, 0, 0, 1, 0, 0], 'RASTER_FAILED');
            checkpoint(signal);
            for (const [key, value] of [
                ['globalAlpha', 1],
                ['globalCompositeOperation', 'copy'],
                ['imageSmoothingEnabled', false],
                ['filter', 'none'],
                ['shadowBlur', 0],
                ['shadowOffsetX', 0],
                ['shadowOffsetY', 0],
                ['shadowColor', 'rgba(0, 0, 0, 0)']
            ])
                state(drawing, key, value, signal);
            call(draw, drawing, [picture, 0, 0], 'RASTER_FAILED');
            checkpoint(signal);
            const result = call(pixels, drawing, [0, 0, size.width, size.height], 'RASTER_FAILED');
            checkpoint(signal);
            if (!record(result))
                throw fault('READBACK_INVALID', new TypeError('Complete image readback required'));
            const rw = read(result, 'width', signal), rh = read(result, 'height', signal), data = read(result, 'data', signal), cs = read(result, 'colorSpace', signal);
            if (rw !== size.width || rh !== size.height || cs !== 'srgb')
                throw fault('READBACK_INVALID', new TypeError('Image readback metadata differs'));
            let readback;
            try {
                readback = fixedBacking(data, 'Uint8ClampedArray');
            }
            catch (cause) {
                throw fault('READBACK_INVALID', cause);
            }
            if (readback.length !== 4 * size.width * size.height)
                throw fault('READBACK_INVALID', new RangeError('Tight RGBA readback byte length required'));
            if (job.diagnostics)
                job.diagnostics.readbackBytes = readback.length;
            sampleStatus();
            try {
                checkpoint(signal);
                try {
                    image = createImageData2D({
                        width: size.width,
                        height: size.height,
                        pixels: new Bytes(readback.backing, readback.offset, readback.length)
                    });
                }
                catch (cause) {
                    throw fault('VALUE_INVALID', cause);
                }
                if (job.diagnostics)
                    job.diagnostics.materializedBytes = image.byteLength;
                sampleStatus();
            }
            finally {
                if (job.diagnostics)
                    job.diagnostics.readbackBytes = 0;
                sampleStatus();
            }
            // Canvas output is browser-normalized straight sRGB; never rewrite channels.
            checkpoint(signal);
        }
        catch (cause) {
            primaryOccurred = true;
            primary = cause instanceof EgretError ? cause : fault('VALUE_INVALID', cause);
        }
        finally {
            if (job.diagnostics)
                job.diagnostics.blobBytes = 0;
            sampleStatus();
        }
        const cleanup = retire(job);
        let handedOff = false;
        try {
            if (primaryOccurred)
                throw new EgretError(primary.code, { cause: primary.cause, cleanupErrors: cleanup });
            if (cleanup.length)
                throw new EgretError('WEB_PNG_CLEANUP_FAILED', { cause: cleanup[0], cleanupErrors: cleanup });
            if (image === undefined)
                throw fault('VALUE_INVALID', new TypeError('Owned image was not materialized'));
            // Cleanup may itself trigger terminal state. Reuse the context snapshot.
            checkpoint(capturedSignal);
            let value;
            try {
                value = createTexture(image);
            }
            catch (cause) {
                throw fault('VALUE_INVALID', cause);
            }
            issued.set(value, false);
            handedOff = true;
            return value;
        }
        finally {
            // In fixed manifest mode the outer publication/late-value retirement
            // is part of this same original job, so its credit cannot leave yet.
            if (!handedOff && job.diagnostics)
                job.diagnostics.materializedBytes = 0;
            sampleStatus();
            if (token === undefined)
                settled(job);
        }
    }
    function load(ref, context) {
        if (owner === undefined)
            return apply(loadActual, this, [ref, context]);
        let token;
        try {
            if (this !== provider)
                throw fault('PROVIDER_INVALID', new TypeError('Exact PNG provider receiver required'));
            gate();
            if (occupied + manifestAdmissions >= MAX_JOBS)
                throw fault('JOB_LIMIT', new RangeError('PNG occupied job limit'));
            // begin captures caller-owned context/listener operations. Reserve
            // this provider admission before any of those can re-enter it.
            manifestAdmissions++;
            try {
                token = owner.begin(ref, context);
                manifestRuns.set(token, undefined);
            }
            finally {
                manifestAdmissions--;
                closeWhenSettled();
            }
        }
        catch (cause) {
            return Promise.reject(cause);
        }
        if (closed)
            owner.cancel(token, fault('PROVIDER_CLOSED', new TypeError('PNG provider is closed')));
        const run = loadActual.call(provider, ref, token.context, token);
        const disposal = provider.dispose;
        void run
            .then(value => {
            try {
                if (!owner.publish(token, value)) {
                    try {
                        apply(disposal, provider, [value]);
                    }
                    catch (cause) {
                        const job = manifestRuns.get(token);
                        if (job)
                            retain(job, cause);
                    }
                }
            }
            finally {
                // The original publication/late-disposal callback has finished
                // owning this genuine value. Retain no new reference for status.
                const job = manifestRuns.get(token);
                if (job?.diagnostics)
                    job.diagnostics.materializedBytes = 0;
                sampleStatus();
            }
        }, cause => owner.reject(token, cause))
            .then(() => {
            const job = manifestRuns.get(token);
            manifestRuns.delete(token);
            if (job)
                settled(job);
            owner.finish(token);
            closeWhenSettled();
        });
        return owner.publication(token);
    }
    provider = freeze({
        profile: 'png-rgb-rgba8-browser-normalized-v1',
        get isClosed() {
            if (this !== provider)
                throw fault('PROVIDER_INVALID', new TypeError('Exact PNG provider receiver required'));
            return closed;
        },
        ...(owner === undefined
            ? {}
            : {
                getStatus() {
                    if (this !== provider)
                        throw fault('PROVIDER_INVALID', new TypeError('Exact PNG provider receiver required'));
                    return freeze({ current: freeze(currentStatus()), highWater: freeze({ ...highWater }), saturated });
                }
            }),
        load,
        dispose(value) {
            if (this !== provider)
                throw fault('PROVIDER_INVALID', new TypeError('Exact PNG provider receiver required'));
            const retired = issued.get(value);
            if (retired === undefined)
                throw fault('VALUE_INVALID', new TypeError('Texture was not issued by this provider'));
            if (!retired) {
                issued.set(value, true);
                try {
                    apply(originalTextureDispose, value, []);
                }
                catch (cause) {
                    throw fault('VALUE_INVALID', cause);
                }
            }
        },
        close() {
            if (this !== provider)
                throw fault('PROVIDER_INVALID', new TypeError('Exact PNG provider receiver required'));
            if (closePromise === undefined) {
                closed = true;
                closePromise = new Promise((resolve, reject) => {
                    resolveClose = resolve;
                    rejectClose = reject;
                });
                if (owner !== undefined) {
                    for (const token of manifestRuns.keys())
                        owner.cancel(token, fault('PROVIDER_CLOSED', new TypeError('PNG provider is closed')));
                }
                closeWhenSettled();
            }
            return closePromise;
        }
    });
    return provider;
}
//# sourceMappingURL=BrowserTextureProvider.js.map