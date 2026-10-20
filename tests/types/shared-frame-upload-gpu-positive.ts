// SPDX-License-Identifier: Apache-2.0
import type { CancellationSignal } from '@egret/contracts';
import type { SharedRenderFrame2D } from '@egret/engine';
import type { SceneFrame3D } from '@egret/engine/scene3d';
import {
  createSharedWebGPUHost,
  type SharedWebGPUHost, type SharedWebGPUHostOptions, type SharedWebGPUReadback,
  type SharedWebGPUHostStatus, type WebGPUHost, type WebGPUReadback, type WebGPUHostFailure,
  type WebGPUHostState, type SharedDeviceSessionState, type SharedDeviceSessionStatus,
  type SharedFrameUploadOptions, type SharedFrameUploadReady, type SharedFrameSubmission, type SharedFrameUpload,
} from '@egret/engine/webgpu';
import {
  createSharedSceneWebGPUHost, type SharedSceneWebGPUHost, type SharedSceneWebGPUHostOptions,
  type SharedDeviceSessionState as SceneSessionState, type SharedDeviceSessionStatus as SceneSessionStatus,
  type SharedFrameUploadOptions as SceneUploadOptions, type SharedFrameUploadReady as SceneUploadReady,
  type SharedFrameSubmission as SceneSubmission, type SharedFrameUpload as SceneUpload,
} from '@egret/engine/webgpu/scene3d';
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2) ? true : false : false;
type Assert<T extends true> = T;
type ExactState = Assert<Equal<SharedDeviceSessionState,
  'new' | 'starting' | 'ready' | 'stopped' | 'lost' | 'restoring' | 'failed' | 'closing' | 'closed'>>;
type LegacyState = Assert<Equal<WebGPUHostState,
  'new' | 'starting' | 'active' | 'stopped' | 'failed' | 'closing' | 'closed'>>;
type StatusShape = Assert<Equal<SharedDeviceSessionStatus<WebGPUHostFailure>, {
  readonly state: SharedDeviceSessionState; readonly generation: number; readonly attempt: number;
  readonly firstFailure: WebGPUHostFailure | null; readonly generationFailure: WebGPUHostFailure | null;
}>>;
type ExactStage = Assert<Equal<SharedWebGPUHost['stageSharedFrame'],
  (frame: SharedRenderFrame2D, options?: SharedFrameUploadOptions) => SharedFrameUpload>>;
type ExactSceneStage = Assert<Equal<SharedSceneWebGPUHost['stageSceneSharedFrame'],
  (scene: SceneFrame3D, overlay: SharedRenderFrame2D, options?: SharedFrameUploadOptions) => SharedFrameUpload>>;
type ExactReady = Assert<Equal<SharedFrameUpload['ready'], Promise<SharedFrameUploadReady>>>;
type ExactSubmission = Assert<Equal<SharedFrameSubmission, {
  readonly generation: number; readonly frameId: number; readonly serial: number; readonly completed: Promise<void>;
}>>;
type ExactRecover = Assert<Equal<SharedWebGPUHost['recover'], (device?: GPUDevice) => Promise<void>>>;
type ExactWhenReady = Assert<Equal<SharedWebGPUHost['whenReady'], () => Promise<void>>>;
type ExactStatus = Assert<Equal<SharedWebGPUHost['getSessionStatus'], () => SharedDeviceSessionStatus<WebGPUHostFailure>>>;
type OptionsShape = Assert<Equal<SharedFrameUploadOptions, { readonly signal?: CancellationSignal }>>;
type LegacyReadback = Assert<Equal<keyof WebGPUReadback,
  'serial' | 'frameId' | 'width' | 'height' | 'format' | 'sourceFormat' | 'colorSpace' | 'alphaMode' | 'bytes'>>;
type SharedReadback = Assert<Equal<keyof SharedWebGPUReadback, keyof WebGPUReadback | 'generation'>>;
type ExistingSharedStatus = Assert<Equal<keyof SharedWebGPUHostStatus,
  'host' | 'pendingGeometryBytes' | 'pendingColorBytes' | 'pendingCanonicalBytes' | 'resources'>>;
type NoLegacyPorts = Assert<Equal<Extract<keyof WebGPUHost,
  'getSessionStatus' | 'whenReady' | 'recover' | 'stageSharedFrame' | 'stageSceneSharedFrame'>, never>>;
type SceneAliases = Assert<Equal<
  [SceneSessionState, SceneSessionStatus<WebGPUHostFailure>, SceneUploadOptions, SceneUploadReady, SceneSubmission, SceneUpload],
  [SharedDeviceSessionState, SharedDeviceSessionStatus<WebGPUHostFailure>, SharedFrameUploadOptions,
    SharedFrameUploadReady, SharedFrameSubmission, SharedFrameUpload]>>;

declare const canvas: HTMLCanvasElement;
declare const device: GPUDevice;
declare const signal: CancellationSignal;
declare const frame: SharedRenderFrame2D;
declare const scene: SceneFrame3D;
const options: SharedWebGPUHostOptions = { canvas, device: { kind: 'borrow', device }, recovery: { mode: 'manual', timeoutMs: 10000 } };
const host: SharedWebGPUHost = createSharedWebGPUHost(options);
const sceneOptions: SharedSceneWebGPUHostOptions = { canvas, device: { kind: 'acquire' },
  outputAlpha: 'opaque', recovery: { mode: 'automatic', timeoutMs: 30000 } };
const sceneHost: SharedSceneWebGPUHost = createSharedSceneWebGPUHost(sceneOptions);
const stage: SharedFrameUpload = host.stageSharedFrame(frame, { signal });
const sceneStage: SharedFrameUpload = sceneHost.stageSceneSharedFrame(scene, frame, { signal });
const ready: Promise<SharedFrameUploadReady> = stage.ready;
const submission: SharedFrameSubmission = stage.submit();
const completed: Promise<void> = submission.completed;
const status: SharedDeviceSessionStatus<WebGPUHostFailure> = host.getSessionStatus();
const readiness: Promise<void> = host.whenReady();
const recovery: Promise<void> = host.recover(device);
const sceneRecovery: Promise<void> = sceneHost.recover();
const readback: Promise<SharedWebGPUReadback> = host.requestReadback();
stage.dispose();
void [sceneStage, ready, completed, status, readiness, recovery, sceneRecovery, readback];
export type { ExactState, LegacyState, StatusShape, ExactStage, ExactSceneStage, ExactReady, ExactSubmission,
  ExactRecover, ExactWhenReady, ExactStatus, OptionsShape, LegacyReadback, SharedReadback,
  ExistingSharedStatus, NoLegacyPorts, SceneAliases };
