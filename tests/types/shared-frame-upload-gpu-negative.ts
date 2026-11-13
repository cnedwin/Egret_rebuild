// SPDX-License-Identifier: Apache-2.0
// Unsuppressed compiler cases. Expected tuples are recorded only after a real compiler run.
import type { Engine, SharedRenderFrame2D } from '@egret/engine';
import type { HostAdapter as PlainHost } from '@egret/engine';
import type {
  SharedWebGPUHost, SharedWebGPUHostOptions, SharedWebGPUReadback, WebGPUReadback,
  SharedDeviceSessionStatus, WebGPUHostFailure, SharedFrameUpload, SharedFrameUploadReady, SharedFrameSubmission,
} from '@egret/engine/webgpu';
declare const engine: Engine;
declare const plainHost: PlainHost;
declare const host: SharedWebGPUHost;
declare const legacyRead: WebGPUReadback;
declare const sharedRead: SharedWebGPUReadback;
declare const frame: SharedRenderFrame2D;
declare const upload: SharedFrameUpload;
declare const ready: SharedFrameUploadReady;
declare const submission: SharedFrameSubmission;
declare const status: SharedDeviceSessionStatus<WebGPUHostFailure>;
declare const canvas: HTMLCanvasElement;
// GPU_UPLOAD_TYPE_CASE (GU-N01): opaque ticket cannot be structurally forged.
const forged: SharedFrameUpload = { ready: Promise.resolve(ready), submit: () => submission, dispose() {} };
// GPU_UPLOAD_TYPE_CASE (GU-N02): staging requires a genuine frame type.
host.stageSharedFrame({ profile: 'egret.shared-frame2d/1' });
// GPU_UPLOAD_TYPE_CASE (GU-N03): unknown allocator option is not public.
host.stageSharedFrame(frame, { allocator: {} });
// GPU_UPLOAD_TYPE_CASE (GU-N04): signals must match the cancellation contract.
host.stageSharedFrame(frame, { signal: {} });
// GPU_UPLOAD_TYPE_CASE (GU-N05): staged operation is a ticket, not a promise.
const promised: Promise<SharedFrameUpload> = host.stageSharedFrame(frame);
// GPU_UPLOAD_TYPE_CASE (GU-N06): no caller-provided ready result.
upload.ready = Promise.resolve(ready);
// GPU_UPLOAD_TYPE_CASE (GU-N07): readiness metadata is immutable.
ready.generation = 2;
// GPU_UPLOAD_TYPE_CASE (GU-N08): submission serial is immutable.
submission.serial = 4;
// GPU_UPLOAD_TYPE_CASE (GU-N09): session metadata is immutable.
status.attempt = 3;
// GPU_UPLOAD_TYPE_CASE (GU-N10): shared readback generation is immutable.
sharedRead.generation = 4;
// GPU_UPLOAD_TYPE_CASE (GU-N11): legacy readback shape is unchanged.
legacyRead.generation;
// GPU_UPLOAD_TYPE_CASE (GU-N12): core Engine has no native stage port.
engine.stageSharedFrame(frame);
// GPU_UPLOAD_TYPE_CASE (GU-N13): a Host adapter without the shared ports has no session method.
plainHost.getSessionStatus();
// GPU_UPLOAD_TYPE_CASE (GU-N14): only selected recovery modes are admitted.
const mode: SharedWebGPUHostOptions = { canvas, recovery: { mode: 'retry-forever' } };
// GPU_UPLOAD_TYPE_CASE (GU-N15): no configurable upload scheduler exists.
const scheduler: SharedWebGPUHostOptions = { canvas, uploadScheduler() {} };
// GPU_UPLOAD_TYPE_CASE (GU-N16): no raw device record or native ticket constructor.
host.recover({ lost: Promise.resolve({}) });
// GPU_UPLOAD_TYPE_CASE (GU-N17): no caller-specified submission frame replaces the captured frame.
upload.submit(frame);
