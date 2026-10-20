// SPDX-License-Identifier: Apache-2.0
import type { CancellationSignal } from '@egret/contracts';

/** Cancellation revokes an unsubmitted upload without releasing unsettled work. */
export interface SharedFrameUploadOptions {
    readonly signal?: CancellationSignal;
}

/** Upload completion does not imply that this frame has been presented. */
export interface SharedFrameUploadReady {
    readonly generation: number;
    readonly frameId: number;
}

/** Native draw completion is separate from pixel readback and final retirement. */
export interface SharedFrameSubmission extends SharedFrameUploadReady {
    readonly serial: number;
    readonly completed: Promise<void>;
}

declare const sharedFrameUploadBrand: unique symbol;

/** A single-use authority over the existing Host-owned pending frame record. */
export interface SharedFrameUpload {
    readonly [sharedFrameUploadBrand]: true;
    readonly ready: Promise<SharedFrameUploadReady>;
    submit(): SharedFrameSubmission;
    dispose(): void;
}
