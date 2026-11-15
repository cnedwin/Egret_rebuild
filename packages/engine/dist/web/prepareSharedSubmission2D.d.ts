import type { SharedPageCopyDiagnostics2D } from '../rendering/sharedColor2D.js';
import type { PreparedSharedFrame2D } from '../rendering/prepareSharedDraws2D.js';
import { packSharedDraws2D, SHARED_REGION_WINDOW_BYTES_2D } from '../rendering/packSharedDraws2D.js';
import type { SharedWebGPUConfiguration } from './sharedWebGPUOptions.js';
import type { SharedOwnerSnapshot2D, SharedSubmissionStorage2D as NeutralSharedSubmissionStorage2D } from './sharedSubmissionStorage2D.js';
export { SharedStorageError2D } from './sharedSubmissionStorage2D.js';
export type { SharedOwnerSnapshot2D } from './sharedSubmissionStorage2D.js';
export interface SharedSubmissionStorage2D extends NeutralSharedSubmissionStorage2D {
    readonly options: SharedWebGPUConfiguration;
}
export declare const checkSharedCapacity2D: (storage: SharedSubmissionStorage2D, owner: SharedOwnerSnapshot2D, canonicalBytes?: number, sourceCopy?: number) => void;
export declare const materializeSharedPages2D: (storage: SharedSubmissionStorage2D, cold: ReadonlySet<number>, owner: SharedOwnerSnapshot2D, diagnostics?: SharedPageCopyDiagnostics2D) => {
    projections: (Uint8Array<ArrayBuffer> | undefined)[];
    canonicalBytes: number;
};
/** Every window of the region table starts at a multiple of this many bytes of its buffer. */
export declare const SHARED_REGION_WINDOW_STRIDE_2D = 16384;
/** Preserve WebGPU fees, 256-byte rows, native checks and pending order before payloads. */
export declare function planSharedSubmission2D(prepared: PreparedSharedFrame2D, options: SharedWebGPUConfiguration, hardware: {
    maxTextureDimension2D: number;
    maxBufferSize: number;
}, owner: SharedOwnerSnapshot2D, readback: boolean): SharedSubmissionStorage2D;
export declare const packSharedSubmission2D: typeof packSharedDraws2D;
export { SHARED_REGION_WINDOW_BYTES_2D };
/** The region table as its uniform buffer holds it: whole windows, the last one allocated in full. */
export declare function packSharedRegionWindows2D(frame: PreparedSharedFrame2D['frame']): Uint32Array<ArrayBuffer>;
//# sourceMappingURL=prepareSharedSubmission2D.d.ts.map