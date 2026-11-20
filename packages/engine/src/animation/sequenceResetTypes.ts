// SPDX-License-Identifier: Apache-2.0
import type { Bitmap } from '@egret/runtime';
import type { SharedFrameOptions2D, SharedRenderFrame2D } from '@egret/contracts';
import type { ContentLoader } from '../contentTypes.js';
import type { SequenceController, SequenceControllerOptions } from './types.js';

/** The sequence a reset slot starts with: its version label, its bitmap and its controller. */
export interface SequenceResetInitial {
  /** Application label only, never resource or Host generation authority. */
  readonly version: string;
  readonly bitmap: Bitmap;
  readonly controller: SequenceController;
}
/** The sequence a reset slot shows now, and whether the slot owns it or borrows it. */
export interface SequenceResetActive extends SequenceResetInitial {
  readonly ownership: 'borrowed' | 'owned';
}
/** A request to replace a slot's sequence with another version, loaded from a content loader. */
export interface SequenceResetRequest {
  readonly policy: 'reset';
  readonly version: string;
  readonly loader: ContentLoader;
  readonly imageId: string;
  readonly sequenceId: string;
  readonly playback: SequenceControllerOptions;
}
/** Where a reset request is: loading, ready, prepared, committed, cancelled or failed. */
export type SequenceResetState = 'loading' | 'ready' | 'prepared' | 'committed' | 'cancelled' | 'failed';
/** One pending replacement: wait for it to be ready, then commit it or dispose of it. */
export interface SequenceResetTicket {
  /** CPU content readiness only, not Host upload or submission. */
  readonly ready: Promise<void>;
  readonly state: SequenceResetState;
  /** Pauses only the affected predecessor during the final bounded window. */
  capture(options: SharedFrameOptions2D): SharedRenderFrame2D;
  /** Publishes the prepared successor. RESET starts paused at zero. Preserve carries forward the captured controller state. */
  commit(): SequenceResetActive;
  dispose(): void;
}
/** Holds a bitmap's sequence and replaces it with a new version without a gap. */
export interface SequenceResetSlot {
  readonly isDisposed: boolean;
  getActive(): SequenceResetActive;
  request(request: SequenceResetRequest): SequenceResetTicket;
  /** Preserve a live controller across ContentLoader clips with identical frame boundaries. */
  requestPreserving(request: Omit<SequenceResetRequest, 'policy' | 'playback'>): SequenceResetTicket;
  /** Initial content is borrowed; only candidates and owned successors are disposed. */
  dispose(): void;
}
