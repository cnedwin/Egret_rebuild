// SPDX-License-Identifier: Apache-2.0
// Strict built-public-entry consumer; this file does not claim execution.
import type { SharedRenderFrame2D } from '@egret/engine';
import type { SceneFrame3D } from '@egret/engine/scene3d';
import * as ordinary from '@egret/engine/webgl2';
import * as sceneEntry from '@egret/engine/webgl2/scene3d';
import {
  createSharedWebGL2Host, type SharedWebGL2Host, type WebGL2HostFailure,
  type SharedDeviceSessionState, type SharedDeviceSessionStatus,
  type SharedFrameUploadOptions, type SharedFrameUploadReady,
  type SharedFrameSubmission, type SharedFrameUpload,
} from '@egret/engine/webgl2';
import { createSharedSceneWebGL2Host, type SharedSceneWebGL2Host } from '@egret/engine/webgl2/scene3d';

type Equal<A,B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
const onlyOrdinaryFactory: Assert<Equal<keyof typeof ordinary,'createSharedWebGL2Host'>> = true;
const onlySceneFactory: Assert<Equal<keyof typeof sceneEntry,'createSharedSceneWebGL2Host'>> = true;
void [onlyOrdinaryFactory,onlySceneFactory];

export async function consume(canvas: HTMLCanvasElement, frame: SharedRenderFrame2D, signal: AbortSignal): Promise<void> {
  const host: SharedWebGL2Host = createSharedWebGL2Host({canvas,enableReadback:true});
  await host.start(); const readiness: Promise<void> = host.whenReady(); await readiness;
  const status: SharedDeviceSessionStatus<WebGL2HostFailure> = host.getSessionStatus();
  const state: SharedDeviceSessionState = status.state;
  const generation: number = status.generation, attempt: number = status.attempt;
  const history: WebGL2HostFailure | null = status.firstFailure, current: WebGL2HostFailure | null = status.generationFailure;
  const options: SharedFrameUploadOptions = {signal};
  const upload: SharedFrameUpload = host.stageSharedFrame(frame,options);
  const readyPromise: Promise<SharedFrameUploadReady> = upload.ready, ready = await readyPromise;
  const submission: SharedFrameSubmission = upload.submit();
  const serial: number = submission.serial, frameId: number = submission.frameId;
  const completion: Promise<void> = submission.completed; await completion;
  const disposed: void = upload.dispose();
  void [state,generation,attempt,history,current,ready.generation,ready.frameId,serial,frameId,disposed];
  await host.whenIdle(); await host.close();
}

export async function consumeScene(canvas: HTMLCanvasElement, scene: SceneFrame3D, overlay: SharedRenderFrame2D): Promise<void> {
  const host: SharedSceneWebGL2Host = createSharedSceneWebGL2Host({canvas,outputAlpha:'opaque'});
  await host.start();
  const upload: SharedFrameUpload = host.stageSceneSharedFrame(scene,overlay);
  await upload.ready; const done: SharedFrameSubmission = upload.submit(); await done.completed;
  const status: SharedDeviceSessionStatus<WebGL2HostFailure> = host.getSessionStatus();
  void [status,host.getSceneStatus().pendingDepthBytes]; await host.close();
}
