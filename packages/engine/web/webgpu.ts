// Opt-in WebGPU exports keep the default engine and Canvas entries GPU-free.
export { createWebGPUHost, createTexturedWebGPUHost } from './WebGPUHost.js';
export type { WebGPUHost, WebGPUHostState, WebGPUHostErrorCode, WebGPUHostFailure, WebGPUHostDiagnostic, WebGPUHostOptions, WebGPUReadback, WebGPUHostStatus } from './WebGPUHost.js';
export type { TexturedWebGPUHost, TexturedWebGPUHostOptions, TexturedWebGPUHostStatus } from './WebGPUHost.js';

export { createSharedWebGPUHost } from './WebGPUHost.js';
export type { SharedWebGPUHost, SharedWebGPUHostOptions, SharedWebGPUHostStatus, SharedWebGPUReadback } from './WebGPUHost.js';

export type { SharedDeviceSessionState, SharedDeviceSessionStatus, SharedHostResourceStatus } from './sharedDeviceSession.js';
export type { SharedFrameUploadOptions, SharedFrameUploadReady, SharedFrameSubmission, SharedFrameUpload } from './sharedFrameUpload.js';
