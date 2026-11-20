// SPDX-License-Identifier: Apache-2.0
import type { SharedRenderFrame2D, SharedRenderHostAdapter } from '@egret/contracts';
import type { SharedDeviceSessionStatus, SharedHostResourceStatus } from './sharedDeviceSession.js';
import type { SharedFrameUpload, SharedFrameUploadOptions } from './sharedFrameUpload.js';

/** Where a WebGL2 host is: new, starting, active, lost, restoring, stopped, failed, closing or closed. */
export type WebGL2HostState =
  | 'new'
  | 'starting'
  | 'active'
  | 'lost'
  | 'restoring'
  | 'stopped'
  | 'failed'
  | 'closing'
  | 'closed';
/** What went wrong in a WebGL2 host. */
export type WebGL2HostErrorCode =
  | 'WEBGL2_OPTIONS_INVALID'
  | 'WEBGL2_CONTEXT_UNAVAILABLE'
  | 'WEBGL2_CONTEXT_ATTRIBUTES_UNSUPPORTED'
  | 'WEBGL2_FORMAT_UNSUPPORTED'
  | 'WEBGL2_START_FAILED'
  | 'WEBGL2_START_CANCELLED'
  | 'WEBGL2_NOT_STARTED'
  | 'WEBGL2_STOPPED'
  | 'WEBGL2_CLOSED'
  | 'WEBGL2_FAILED'
  | 'WEBGL2_REENTRANT'
  | 'WEBGL2_FRAME_PROFILE_UNSUPPORTED'
  | 'WEBGL2_FRAME_INVALID'
  | 'WEBGL2_BACKING_LIMIT'
  | 'WEBGL2_GEOMETRY_RANGE'
  | 'WEBGL2_PRECISION_UNSUPPORTED'
  | 'WEBGL2_FRAME_BUDGET'
  | 'WEBGL2_BACKPRESSURE'
  | 'WEBGL2_CONTEXT_LIMIT'
  | 'WEBGL2_SERIAL_EXHAUSTED'
  | 'WEBGL2_GENERATION_EXHAUSTED'
  | 'WEBGL2_RENDER_FAILED'
  | 'WEBGL2_VALIDATION'
  | 'WEBGL2_OUT_OF_MEMORY'
  | 'WEBGL2_CONTEXT_LOST'
  | 'WEBGL2_CONTEXT_RESTORING'
  | 'WEBGL2_RESTORE_FAILED'
  | 'WEBGL2_RESTORE_TIMEOUT'
  | 'WEBGL2_READBACK_DISABLED'
  | 'WEBGL2_READBACK_PENDING'
  | 'WEBGL2_READBACK_FAILED'
  | 'WEBGL2_SYNC_FAILED'
  | 'WEBGL2_SYNC_TIMEOUT'
  | 'WEBGL2_DIAGNOSTIC_CALLBACK_FAILED'
  | 'WEBGL2_CLOSE_UNSAFE'
  | 'WEBGL2_UPLOAD_INVALID'
  | 'WEBGL2_UPLOAD_OPTIONS_INVALID'
  | 'WEBGL2_UPLOAD_NOT_READY'
  | 'WEBGL2_UPLOAD_USED'
  | 'WEBGL2_UPLOAD_DISPOSED'
  | 'WEBGL2_UPLOAD_ABORTED'
  | 'WEBGL2_UPLOAD_EXPIRED'
  | 'WEBGL2_UPLOAD_STALE'
  | 'WEBGL2_LAYER_EFFECT_INVALID'
  | 'WEBGL2_LAYER_INVALID'
  | 'WEBGL2_LAYER_BUDGET'
  | 'WEBGL2_LAYER_NOT_READY'
  | 'WEBGL2_LAYER_PENDING'
  | 'WEBGL2_LAYER_DISPOSED';
/** A failure of a WebGL2 host: its code, the frame and context generation it happened at, the phase, and its cause. */
export interface WebGL2HostFailure {
  readonly code: WebGL2HostErrorCode;
  readonly serial: number | null;
  readonly generation: number;
  readonly phase: 'startup' | 'frame' | 'readback' | 'context' | 'restore' | 'cleanup' | 'callback';
  readonly cause: unknown;
}
/** Something a WebGL2 host reports: a failure, with how serious it is. */
export interface WebGL2HostDiagnostic extends WebGL2HostFailure {
  readonly severity: 'error';
}
/** A WebGL2 host as it is now: its state and generation, frames and bytes pending, and its failures. */
export interface WebGL2HostStatus {
  readonly state: WebGL2HostState;
  readonly generation: number;
  readonly lastSerial: number;
  readonly pendingFrames: number;
  readonly pendingUploadBytes: number;
  readonly pendingReadbackBytes: number;
  readonly firstFailure: WebGL2HostFailure | null;
  readonly generationFailure: WebGL2HostFailure | null;
  readonly callbackFailureCount: number;
  readonly lastCallbackFailure: WebGL2HostFailure | null;
  readonly cleanupOutcome: 'not-started' | 'pending' | 'safe' | 'unsafe';
}
/** The pixels of a shared frame read back: its generation and frame, size, format, color space, alpha and bytes. */
export interface SharedWebGL2Readback {
  readonly generation: number;
  readonly serial: number;
  readonly frameId: number;
  readonly width: number;
  readonly height: number;
  readonly format: 'rgba8unorm';
  readonly sourceFormat: 'rgba8unorm';
  readonly colorSpace: 'srgb';
  readonly alphaMode: 'premultiplied' | 'opaque';
  readonly bytes: Uint8Array;
}
/** A shared WebGL2 host as it is now: its resources, host status, bytes pending and retention. */
export interface SharedWebGL2HostStatus {
  readonly resources: SharedHostResourceStatus;
  readonly host: WebGL2HostStatus;
  readonly pendingGeometryBytes: number;
  readonly pendingColorBytes: number;
  readonly pendingCanonicalBytes: number;
  readonly retention: {
    readonly idleBytes: number;
    readonly idleEntries: number;
    readonly reservedBytes: number;
    readonly reservedEntries: number;
    readonly unknownBytes: number;
    readonly unknownEntries: number;
    readonly unknownNativeBytes: number;
    readonly unknownNativeObjects: number;
  };
}
/** A layer drawn once and kept on the GPU: update it, or dispose of it. */
export interface SharedWebGL2Layer2D {
  readonly state: 'empty' | 'ready' | 'stale' | 'disposed';
  /** Bake a transparent Engine capture. The current revision remains usable until the replacement completes. */
  update(frame: SharedRenderFrame2D): Promise<void>;
  dispose(): void;
}
type LayerRGB = readonly [number, number, number];
/** How a kept layer is tinted when it is placed: its bounds and its multiplied and added color. */
export interface SharedWebGL2LayerEffect2D {
  /** Half-open rectangle in logical frame coordinates. */
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly multiply?: LayerRGB;
  readonly add?: LayerRGB;
}
/** Where a kept layer is placed in a frame, how large, and with what effect. */
export interface SharedWebGL2LayerPlacement2D {
  readonly layer: SharedWebGL2Layer2D;
  /** Destination bounds in logical frame coordinates, before the host pixel ratio. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly effect?: SharedWebGL2LayerEffect2D;
}
/** The kept layers of a host: the bytes they hold, and how many are ready and pending. */
export interface SharedWebGL2LayerStatus {
  /** Logical RGBA8 bytes for live targets, including pending and pinned superseded revisions. */
  readonly residentBytes: number;
  readonly readyLayers: number;
  readonly pendingLayers: number;
}
/** A phase of drawing a shared frame that the host can time. */
export type SharedWebGL2TimingPhase =
  | 'texture-prepare'
  | 'texture-upload'
  | 'working-framebuffer-validation'
  | 'default-framebuffer-validation'
  | 'submit'
  | 'fence-poll'
  | 'completion-error-query'
  | 'retire'
  | 'sync-delete-error-query';
/** One timed phase of a frame: its generation and frame, the phase, when it began and how long it took. */
export interface SharedWebGL2TimingSample {
  readonly generation: number;
  /** Null before a frame is assigned a submission serial. */
  readonly serial: number | null;
  readonly phase: SharedWebGL2TimingPhase;
  readonly startMs: number;
  readonly durationMs: number;
}
/** The timings of a host's frames: totals by phase, the recent samples and how many were dropped. */
export interface SharedWebGL2FrameTiming {
  readonly totals: Readonly<
    Record<SharedWebGL2TimingPhase, { readonly count: number; readonly totalMs: number; readonly maxMs: number }>
  >;
  /** Latest 2,048 samples in completion order. Staged samples without a serial are generation-only. */
  readonly recent: readonly SharedWebGL2TimingSample[];
  readonly dropped: number;
}

/** A host that draws shared frames with WebGL2: start and stop it, stage frames, read them back, time them and recover a lost context. */
export interface SharedWebGL2Host extends SharedRenderHostAdapter {
  readonly surface: HTMLCanvasElement;
  start(): Promise<void>;
  stop(): void;
  close(): Promise<void>;
  whenIdle(): Promise<void>;
  whenReady(): Promise<void>;
  requestReadback(): Promise<SharedWebGL2Readback>;
  getStatus(): WebGL2HostStatus;
  getSharedStatus(): SharedWebGL2HostStatus;
  /** Bounded CPU elapsed timings, or null when measurement is disabled. */
  getSharedFrameTiming(): SharedWebGL2FrameTiming | null;
  getSessionStatus(): SharedDeviceSessionStatus<WebGL2HostFailure>;
  stageSharedFrame(frame: SharedRenderFrame2D, options?: SharedFrameUploadOptions): SharedFrameUpload;
  setTimeout(callback: () => void, delayMs: number): () => void;
}
/** A shared WebGL2 host that also draws kept layers. */
export interface SharedLayerWebGL2Host extends SharedWebGL2Host {
  createSharedLayer2D(): SharedWebGL2Layer2D;
  renderSharedFrameWithLayers(frame: SharedRenderFrame2D, layers: readonly SharedWebGL2LayerPlacement2D[]): undefined;
  getSharedLayerStatus(): SharedWebGL2LayerStatus;
}
