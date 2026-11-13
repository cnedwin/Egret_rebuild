// SPDX-License-Identifier: Apache-2.0
// Strict consumers use the optional built public entry and genuine SDK values.
import { createEngineForProfile, SHARED_FRAME_PROFILE_2D, type SharedRenderHostAdapter } from '@egret/engine';
import * as ordinary from '@egret/engine/webgl2';
import {
  createSharedWebGL2Host, type SharedWebGL2Host, type SharedWebGL2HostOptions,
  type SharedWebGL2HostStatus, type SharedWebGL2Readback, type WebGL2HostState,
  type WebGL2HostErrorCode, type WebGL2HostFailure, type WebGL2HostDiagnostic,
  type WebGL2HostStatus,
} from '@egret/engine/webgl2';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
const ordinaryExports: Assert<Equal<keyof typeof ordinary, 'createSharedWebGL2Host'>> = true;
void [ordinaryExports];

export function options(canvas: HTMLCanvasElement): SharedWebGL2HostOptions {
  return {
    canvas, pixelRatio: 1, maxBackingPixels: 1024, maxCommands: 32, maxClipRectangles: 128,
    maxPreparedVertices: 512, maxClipEdgeTests: 2048, maxSourceTriangles: 32,
    maxTupleComparisons: 512, maxUploadBytes: 4096, maxPendingUploadBytes: 8192,
    maxFrameGeometryBytes: 4096, maxPendingGeometryBytes: 8192, maxPendingFrames: 2,
    maxReadbackBytes: 8192, enableReadback: true, outputAlpha: 'premultiplied', restoreTimeoutMs: 10000,
    onDiagnostic(diagnostic: WebGL2HostDiagnostic) {
      const failure: WebGL2HostFailure = diagnostic;
      const code: WebGL2HostErrorCode = failure.code;
      const generation: number = failure.generation;
      const serial: number | null = failure.serial;
      const cause: unknown = failure.cause;
      const severity: 'error' = diagnostic.severity;
      void [code, generation, serial, cause, severity, failure.phase];
      return undefined;
    },
  };
}

export async function ordinaryConsumer(canvas: HTMLCanvasElement): Promise<SharedWebGL2Readback> {
  const host: SharedWebGL2Host = createSharedWebGL2Host(options(canvas));
  const protocol: SharedRenderHostAdapter = host;
  const surface: HTMLCanvasElement = host.surface;
  const engine = await createEngineForProfile({ host: protocol }, SHARED_FRAME_PROFILE_2D);
  const ready: Promise<void> = host.whenReady();
  await ready;
  const ticket: Promise<SharedWebGL2Readback> = host.requestReadback();
  const frame = engine.captureSharedFrame({ width: 16, height: 16 });
  const done: undefined = host.renderSharedFrame(frame);
  const readback = await ticket;
  const format: 'rgba8unorm' = readback.format;
  const sourceFormat: 'rgba8unorm' = readback.sourceFormat;
  const colorSpace: 'srgb' = readback.colorSpace;
  const alpha: 'opaque' | 'premultiplied' = readback.alphaMode;
  const bytes: Uint8Array = readback.bytes;
  const shared: SharedWebGL2HostStatus = host.getSharedStatus();
  const status: WebGL2HostStatus = host.getStatus();
  const state: WebGL2HostState = status.state;
  const first: WebGL2HostFailure | null = status.firstFailure;
  const generationFailure: WebGL2HostFailure | null = status.generationFailure;
  const lastCallback: WebGL2HostFailure | null = status.lastCallbackFailure;
  const cleanup: 'not-started' | 'pending' | 'safe' | 'unsafe' = status.cleanupOutcome;
  const cancel: () => void = host.setTimeout(() => {}, 1);
  cancel();
  void [surface, done, format, sourceFormat, colorSpace, alpha, bytes, state, first, generationFailure,
    lastCallback, cleanup, readback.serial, readback.frameId, readback.generation, readback.width, readback.height,
    status.pendingFrames, status.pendingUploadBytes, status.pendingReadbackBytes, status.callbackFailureCount,
    shared.host, shared.pendingGeometryBytes, shared.pendingColorBytes, shared.pendingCanonicalBytes,
    shared.retention.idleBytes, shared.retention.idleEntries, shared.retention.reservedBytes,
    shared.retention.reservedEntries, shared.retention.unknownBytes, shared.retention.unknownEntries,
    shared.retention.unknownNativeBytes, shared.retention.unknownNativeObjects];
  await host.whenIdle();
  await engine.dispose();
  return readback;
}
