// SPDX-License-Identifier: Apache-2.0
// Each labelled statement expects an actual unsuppressed diagnostic from Root's compiler run.
import * as root from '@egret/engine';
import * as canvasEntry from '@egret/engine/web';
import type { RenderFrame2D, SharedRenderFrame2D, Engine } from '@egret/engine';
import { createSharedWebGL2Host, type SharedWebGL2Host, type WebGL2HostFailure,
  type SharedDeviceSessionState, type SharedDeviceSessionStatus, type SharedFrameUpload,
  type SharedFrameUploadOptions, type SharedFrameUploadReady, type SharedFrameSubmission } from '@egret/engine/webgl2';

// M15_GL_TYPE_CASE GLU-N01: root does not forward the optional upload type.
type RootUpload = root.SharedFrameUpload;
// M15_GL_TYPE_CASE GLU-N02: Canvas does not forward optional session types.
type CanvasStatus = canvasEntry.SharedDeviceSessionStatus<WebGL2HostFailure>;
export function refusePorts(host: SharedWebGL2Host,
  engine: Engine, frame: SharedRenderFrame2D, old: RenderFrame2D, canvas: HTMLCanvasElement): void {
  // M15_GL_TYPE_CASE GLU-N03: GL has no GPU recovery method.
  host.recover();
  // M15_GL_TYPE_CASE GLU-N04: staging is not an Engine upload API.
  engine.stageSharedFrame(frame);
  // M15_GL_TYPE_CASE GLU-N05: legacy frames cannot enter shared staging.
  host.stageSharedFrame(old);
  // M15_GL_TYPE_CASE GLU-N06: structural metadata cannot replace a shared frame.
  host.stageSharedFrame({});
  // M15_GL_TYPE_CASE GLU-N07: Canvas has no shared upload port.
  canvasEntry.createCanvasHost({canvas}).stageSharedFrame(frame);
  // M15_GL_TYPE_CASE GLU-N08: native contexts are not caller inputs.
  createSharedWebGL2Host({canvas,gl:{} as WebGL2RenderingContext});
  // M15_GL_TYPE_CASE GLU-N09: GL has no recovery configuration.
  createSharedWebGL2Host({canvas,recovery:{mode:'manual'}});
  // M15_GL_TYPE_CASE GLU-N10: upload has no allocator/scheduler control.
  host.stageSharedFrame(frame,{schedule:() => {}});
  // M15_GL_TYPE_CASE GLU-N11: fixed staging timeout is not configurable.
  host.stageSharedFrame(frame,{timeoutMs:1});
}
export function refuseAuthority(ready: Promise<SharedFrameUploadReady>, submit: () => SharedFrameSubmission): void {
  // M15_GL_TYPE_CASE GLU-N12: structural ticket lacks opaque authority brand.
  const forged: SharedFrameUpload = {ready,submit,dispose(){}};
  void forged;
}
export function refuseMutation(status: SharedDeviceSessionStatus<WebGL2HostFailure>, ticket: SharedFrameUpload,
  ready: SharedFrameUploadReady, submission: SharedFrameSubmission, options: SharedFrameUploadOptions, signal: AbortSignal): void {
  // M15_GL_TYPE_CASE GLU-N13: lifecycle snapshot is immutable.
  status.state = 'ready';
  // M15_GL_TYPE_CASE GLU-N14: generation is immutable.
  status.generation = 1;
  // M15_GL_TYPE_CASE GLU-N15: attempt is immutable.
  status.attempt = 0;
  // M15_GL_TYPE_CASE GLU-N16: historical failure is immutable.
  status.firstFailure = null;
  // M15_GL_TYPE_CASE GLU-N17: current failure is immutable.
  status.generationFailure = null;
  // M15_GL_TYPE_CASE GLU-N18: upload ready observation is immutable.
  ticket.ready = Promise.resolve(ready);
  // M15_GL_TYPE_CASE GLU-N19: ready metadata is immutable.
  ready.frameId = 1;
  // M15_GL_TYPE_CASE GLU-N20: submitted serial is immutable.
  submission.serial = 1;
  // M15_GL_TYPE_CASE GLU-N21: native completion promise is immutable.
  submission.completed = Promise.resolve();
  // M15_GL_TYPE_CASE GLU-N22: captured option declaration is readonly.
  options.signal = signal;
  // M15_GL_TYPE_CASE GLU-N23: common state is a finite union.
  const arbitrary: SharedDeviceSessionState = 'arbitrary';
  void arbitrary;
}
export function refuseAsyncStage(): void {
  // M15_GL_TYPE_CASE GLU-N24: stage admission returns its ticket synchronously.
  const stage: SharedWebGL2Host['stageSharedFrame'] = async () => ({} as SharedFrameUpload);
  void stage;
}
