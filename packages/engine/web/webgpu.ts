// Opt-in WebGPU exports keep the default engine and Canvas entries GPU-free.
export type { WebGPUHostState, WebGPUHostErrorCode, WebGPUHostFailure, WebGPUHostDiagnostic, WebGPUHostOptions, WebGPUReadback, WebGPUHostStatus } from './WebGPUHost.js';
export { createSharedWebGPUHost } from './WebGPUHost.js';
export type { SharedWebGPUHost, SharedWebGPUHostOptions, SharedWebGPUHostStatus, SharedWebGPUReadback } from './WebGPUHost.js';

export type { SharedDeviceSessionState, SharedDeviceSessionStatus, SharedHostResourceStatus } from './sharedDeviceSession.js';
export type { SharedFrameUploadOptions, SharedFrameUploadReady, SharedFrameSubmission, SharedFrameUpload } from './sharedFrameUpload.js';
