import type { SharedDeviceSessionStatus, SharedHostResourceStatus } from './sharedDeviceSession.js';
import type { SharedFrameUploadOptions, SharedFrameUpload } from './sharedFrameUpload.js';
import type { SharedRenderFrame2D, SharedRenderHostAdapter } from '@egret/contracts';
import type { SharedWebGPUHostOptions } from './sharedWebGPUOptions.js';
export type { SharedWebGPUHostOptions } from './sharedWebGPUOptions.js';
export type WebGPUHostState = 'new' | 'starting' | 'active' | 'stopped' | 'failed' | 'closing' | 'closed';
export type WebGPUHostErrorCode = 'WEBGPU_OPTIONS_INVALID' | 'WEBGPU_UNAVAILABLE' | 'WEBGPU_ADAPTER_UNAVAILABLE' | 'WEBGPU_DEVICE_FAILED' | 'WEBGPU_CONTEXT_UNAVAILABLE' | 'WEBGPU_FORMAT_UNSUPPORTED' | 'WEBGPU_START_FAILED' | 'WEBGPU_START_CANCELLED' | 'WEBGPU_NOT_STARTED' | 'WEBGPU_STOPPED' | 'WEBGPU_CLOSED' | 'WEBGPU_FAILED' | 'WEBGPU_REENTRANT' | 'WEBGPU_FRAME_PROFILE_UNSUPPORTED' | 'WEBGPU_FRAME_INVALID' | 'WEBGPU_BACKING_LIMIT' | 'WEBGPU_GEOMETRY_RANGE' | 'WEBGPU_PRECISION_UNSUPPORTED' | 'WEBGPU_FRAME_BUDGET' | 'WEBGPU_BACKPRESSURE' | 'WEBGPU_DEVICE_LIMIT' | 'WEBGPU_SERIAL_EXHAUSTED' | 'WEBGPU_RENDER_FAILED' | 'WEBGPU_VALIDATION' | 'WEBGPU_OUT_OF_MEMORY' | 'WEBGPU_INTERNAL' | 'WEBGPU_SCOPE_FAILED' | 'WEBGPU_QUEUE_FAILED' | 'WEBGPU_DEVICE_LOST' | 'WEBGPU_UNCAPTURED_ERROR' | 'WEBGPU_READBACK_DISABLED' | 'WEBGPU_READBACK_PENDING' | 'WEBGPU_READBACK_FAILED' | 'WEBGPU_DIAGNOSTIC_CALLBACK_FAILED' | 'WEBGPU_CLOSE_UNSAFE' | 'WEBGPU_UPLOAD_INVALID' | 'WEBGPU_UPLOAD_OPTIONS_INVALID' | 'WEBGPU_UPLOAD_NOT_READY' | 'WEBGPU_UPLOAD_USED' | 'WEBGPU_UPLOAD_DISPOSED' | 'WEBGPU_UPLOAD_ABORTED' | 'WEBGPU_UPLOAD_EXPIRED' | 'WEBGPU_UPLOAD_STALE' | 'WEBGPU_RECOVERY_DISABLED' | 'WEBGPU_RECOVERY_STATE_INVALID' | 'WEBGPU_RECOVERY_DEVICE_INVALID' | 'WEBGPU_RECOVERY_TIMEOUT' | 'WEBGPU_RECOVERY_FAILED' | 'WEBGPU_RECOVERY_LIMIT' | 'WEBGPU_GENERATION_EXHAUSTED';
export interface WebGPUHostFailure {
    readonly code: WebGPUHostErrorCode;
    readonly serial: number | null;
    readonly phase: 'startup' | 'frame' | 'readback' | 'device' | 'cleanup' | 'callback';
    readonly cause: unknown;
}
export interface WebGPUHostDiagnostic extends WebGPUHostFailure {
    readonly severity: 'error';
}
export interface WebGPUHostOptions {
    readonly canvas: HTMLCanvasElement;
    readonly device?: {
        readonly kind: 'acquire';
    } | {
        readonly kind: 'borrow';
        readonly device: GPUDevice;
    };
    readonly pixelRatio?: number;
    readonly maxBackingPixels?: number;
    readonly maxCommands?: number;
    readonly maxClipRectangles?: number;
    readonly maxPreparedVertices?: number;
    readonly maxClipEdgeTests?: number;
    readonly maxUploadBytes?: number;
    readonly maxPendingUploadBytes?: number;
    readonly maxPendingFrames?: number;
    readonly maxReadbackBytes?: number;
    readonly enableReadback?: boolean;
    readonly onDiagnostic?: (diagnostic: WebGPUHostDiagnostic) => unknown;
}
export interface WebGPUReadback {
    readonly serial: number;
    readonly frameId: number;
    readonly width: number;
    readonly height: number;
    readonly format: 'rgba8unorm';
    readonly sourceFormat: 'rgba8unorm' | 'bgra8unorm';
    readonly colorSpace: 'srgb';
    readonly alphaMode: 'premultiplied';
    readonly bytes: Uint8Array;
}
export interface WebGPUHostStatus {
    readonly state: WebGPUHostState;
    readonly lastSerial: number;
    readonly pendingFrames: number;
    readonly pendingUploadBytes: number;
    readonly pendingReadbackBytes: number;
    readonly firstFailure: WebGPUHostFailure | null;
    readonly callbackFailureCount: number;
    readonly lastCallbackFailure: WebGPUHostFailure | null;
    readonly cleanupOutcome: 'not-started' | 'pending' | 'safe' | 'unsafe';
}
export interface SharedWebGPUReadback extends Omit<WebGPUReadback, 'alphaMode'> {
    readonly alphaMode: 'premultiplied' | 'opaque';
    readonly generation: number;
}
export interface SharedWebGPUHostStatus {
    readonly host: WebGPUHostStatus;
    readonly pendingGeometryBytes: number;
    readonly pendingColorBytes: number;
    readonly pendingCanonicalBytes: number;
    readonly resources: SharedHostResourceStatus;
}
export interface SharedWebGPUHost extends Pick<SharedRenderHostAdapter, 'sharedFrameProfile' | 'renderSharedFrame'> {
    readonly surface: HTMLCanvasElement;
    start(): Promise<void>;
    stop(): void;
    close(): Promise<void>;
    whenIdle(): Promise<void>;
    getStatus(): WebGPUHostStatus;
    setTimeout(callback: () => void, delayMs: number): () => void;
    getSessionStatus(): SharedDeviceSessionStatus<WebGPUHostFailure>;
    whenReady(): Promise<void>;
    recover(device?: GPUDevice): Promise<void>;
    stageSharedFrame(frame: SharedRenderFrame2D, options?: SharedFrameUploadOptions): SharedFrameUpload;
    requestReadback(): Promise<SharedWebGPUReadback>;
    getSharedStatus(): SharedWebGPUHostStatus;
}
export declare function createSharedWebGPUHost(options: SharedWebGPUHostOptions): SharedWebGPUHost;
//# sourceMappingURL=WebGPUHost.d.ts.map