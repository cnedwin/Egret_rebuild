import type { AdmittedResourceManifest, ResourceManifestEntry } from '@egret/contracts/resources';
import type { CancellationSignal } from '@egret/contracts';
import { CancellationController, EgretError } from '@egret/runtime';
import type { AssetLoadContext, AssetRef } from '@egret/runtime';
import type { ManifestBinding } from '#egret-manifest-resources';
declare const MANIFEST_BYTE_SOURCE: unique symbol;
export interface ManifestByteSourceOptions {
    /** Explicit SFNT-only admission; the original image/metadata limits stay unchanged. */
    readonly profile?: 'font-sfnt/1';
    readonly baseUrl: string;
    readonly deadlineMs?: number;
    readonly networkRetries?: 0 | 1;
}
interface ManifestByteSourceCounters {
    readonly jobs: number;
    readonly queuedNetwork: number;
    readonly queuedDecode: number;
    readonly retryWaiting: number;
    readonly activeNetwork: number;
    readonly activeDecode: number;
    readonly encodedCreditBytes: number;
    readonly ownedEncodedBytes: number;
    readonly borrowedChunkBytes: number;
    readonly quarantinedJobs: number;
}
export interface ManifestByteSourceStatus {
    readonly current: ManifestByteSourceCounters;
    readonly highWater: ManifestByteSourceCounters;
    readonly saturated: boolean;
}
export interface ManifestByteSource {
    readonly profile: 'manifest-sha256-browser-v1';
    readonly isClosed: boolean;
    readonly [MANIFEST_BYTE_SOURCE]: true;
    readBytes<T>(ref: AssetRef<T>, context: AssetLoadContext): Promise<Uint8Array<ArrayBuffer>>;
    getStatus(): ManifestByteSourceStatus;
    close(): Promise<void>;
}
type Operation = (...args: never[]) => unknown;
interface Deferred<T> {
    readonly promise: Promise<T>;
    readonly resolve: (value: T) => void;
    readonly reject: (cause: unknown) => void;
}
interface Transport {
    cancel: Operation | undefined;
    receiver: object | undefined;
    cancellation: Promise<unknown> | undefined;
    release: Operation | undefined;
    released: boolean;
}
/** Private concrete token. Only its owning source can create/admit it. */
export declare class ManifestPngJob {
    readonly owner: ManifestPngOwner;
    readonly entry: ResourceManifestEntry;
    readonly url: string;
    readonly end: number;
    readonly context: AssetLoadContext;
    readonly publication: Deferred<unknown>;
    readonly cleanup: unknown[];
    readonly aborter: AbortController;
    readonly nativeSignal: AbortSignal;
    readonly combined: CancellationController;
    readonly abortCombined: Operation;
    terminal: EgretError | undefined;
    actual: Promise<Uint8Array<ArrayBuffer>> | undefined;
    timer: unknown;
    signal: CancellationSignal;
    remove: Operation;
    listener: () => void;
    installing: boolean;
    listening: boolean;
    finished: boolean;
    reserved: number;
    network: boolean;
    networkUnsafe: boolean;
    decode: boolean;
    queuedNetwork: Deferred<void> | undefined;
    queuedDecode: Deferred<void> | undefined;
    waitingRetry: boolean;
    transport: Transport | undefined;
    bytes: Uint8Array<ArrayBuffer> | undefined;
    borrowedChunkBytes: number;
    delay: {
        handle: unknown;
        finish: () => void;
    } | undefined;
    constructor(owner: ManifestPngOwner, entry: ResourceManifestEntry, url: string, signal: CancellationSignal, remove: Operation, end: number, generation: number, taskId: number);
}
/** Concrete fixed owner; not exported from any public SDK entry. */
export declare class ManifestPngOwner {
    private readonly native;
    private readonly base;
    private readonly selected;
    private readonly jobs;
    private readonly networkQueue;
    private readonly decodeQueue;
    private networkCount;
    private decodeCount;
    private retryCount;
    private byteCount;
    private admissions;
    private closed;
    private pumping;
    private closeResult;
    private readonly inputLimit;
    private readonly byteLimit;
    private readonly deadlineMs;
    private readonly retries;
    private readonly highWater;
    private saturated;
    constructor(manifest: AdmittedResourceManifest, bindings: readonly ManifestBinding[], options: ManifestByteSourceOptions);
    private contained;
    private now;
    controller(): {
        controller: AbortController;
        signal: AbortSignal;
    };
    get isClosed(): boolean;
    private currentStatus;
    private sampleStatus;
    getStatus(): ManifestByteSourceStatus;
    begin(ref: unknown, context: AssetLoadContext): ManifestPngJob;
    private authentic;
    private checkpoint;
    private detach;
    cancel(job: ManifestPngJob, error: EgretError): void;
    private cancelBody;
    private pump;
    private waitingCount;
    private networkPermit;
    decode(job: ManifestPngJob): Promise<void>;
    decoded(job: ManifestPngJob): void;
    private transport;
    private waitRetry;
    readActual(job: ManifestPngJob): Promise<Uint8Array<ArrayBuffer>>;
    publish(job: ManifestPngJob, value: unknown): boolean;
    reject(job: ManifestPngJob, cause: unknown): void;
    publication<T>(job: ManifestPngJob): Promise<T>;
    finish(job: ManifestPngJob): void;
    private settleClose;
    close(): Promise<void>;
}
export declare function requireManifestByteSource(source: unknown): ManifestPngOwner;
export declare function createManifestByteSource(manifest: AdmittedResourceManifest, bindings: readonly ManifestBinding[], options: ManifestByteSourceOptions): ManifestByteSource;
export {};
//# sourceMappingURL=ManifestByteSource.d.ts.map