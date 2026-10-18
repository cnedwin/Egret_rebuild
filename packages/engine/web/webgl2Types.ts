// SPDX-License-Identifier: Apache-2.0
import type { SharedRenderFrame2D, SharedRenderHostAdapter } from '@egret/contracts';
import type { SceneFrame3D } from '../rendering/sceneFrame3D.js';

export type WebGL2HostState = 'new' | 'starting' | 'active' | 'lost' | 'restoring' | 'stopped' | 'failed' | 'closing' | 'closed';
export type WebGL2HostErrorCode =
    'WEBGL2_OPTIONS_INVALID' | 'WEBGL2_CONTEXT_UNAVAILABLE' | 'WEBGL2_CONTEXT_ATTRIBUTES_UNSUPPORTED' | 'WEBGL2_FORMAT_UNSUPPORTED' |
    'WEBGL2_START_FAILED' | 'WEBGL2_START_CANCELLED' | 'WEBGL2_NOT_STARTED' | 'WEBGL2_STOPPED' | 'WEBGL2_CLOSED' | 'WEBGL2_FAILED' | 'WEBGL2_REENTRANT' |
    'WEBGL2_FRAME_PROFILE_UNSUPPORTED' | 'WEBGL2_FRAME_INVALID' | 'WEBGL2_BACKING_LIMIT' | 'WEBGL2_GEOMETRY_RANGE' | 'WEBGL2_PRECISION_UNSUPPORTED' |
    'WEBGL2_FRAME_BUDGET' | 'WEBGL2_BACKPRESSURE' | 'WEBGL2_CONTEXT_LIMIT' | 'WEBGL2_SERIAL_EXHAUSTED' | 'WEBGL2_GENERATION_EXHAUSTED' |
    'WEBGL2_RENDER_FAILED' | 'WEBGL2_VALIDATION' | 'WEBGL2_OUT_OF_MEMORY' | 'WEBGL2_CONTEXT_LOST' | 'WEBGL2_CONTEXT_RESTORING' |
    'WEBGL2_RESTORE_FAILED' | 'WEBGL2_RESTORE_TIMEOUT' | 'WEBGL2_READBACK_DISABLED' | 'WEBGL2_READBACK_PENDING' | 'WEBGL2_READBACK_FAILED' |
    'WEBGL2_SYNC_FAILED' | 'WEBGL2_SYNC_TIMEOUT' | 'WEBGL2_DIAGNOSTIC_CALLBACK_FAILED' | 'WEBGL2_CLOSE_UNSAFE';
export interface WebGL2HostFailure {
    readonly code: WebGL2HostErrorCode;
    readonly serial: number | null;
    readonly generation: number;
    readonly phase: 'startup' | 'frame' | 'readback' | 'context' | 'restore' | 'cleanup' | 'callback';
    readonly cause: unknown;
}
export interface WebGL2HostDiagnostic extends WebGL2HostFailure { readonly severity: 'error'; }
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
export interface SharedWebGL2HostStatus {
    readonly host: WebGL2HostStatus;
    readonly pendingGeometryBytes: number;
    readonly pendingColorBytes: number;
    readonly pendingCanonicalBytes: number;
    readonly retention: {
        readonly idleBytes: number; readonly idleEntries: number;
        readonly reservedBytes: number; readonly reservedEntries: number;
        readonly unknownBytes: number; readonly unknownEntries: number;
        readonly unknownNativeBytes: number; readonly unknownNativeObjects: number;
    };
}
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
    setTimeout(callback: () => void, delayMs: number): () => void;
}
export interface SharedSceneWebGL2Host extends SharedWebGL2Host {
    renderSceneSharedFrame(scene: SceneFrame3D, overlay: SharedRenderFrame2D): undefined;
    getSceneStatus(): {
        readonly host: WebGL2HostStatus;
        readonly pendingSceneBytes: number;
        readonly pendingUniformBytes: number;
        readonly pendingDepthBytes: number;
    };
}
