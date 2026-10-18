// SPDX-License-Identifier: Apache-2.0
// Every labelled statement must produce a real, unsuppressed compiler diagnostic.
import * as root from '@egret/engine';
import * as canvasEntry from '@egret/engine/web';
import * as ordinary from '@egret/engine/webgl2';
import { type SharedRenderFrame2D, type RenderFrame2D } from '@egret/engine';
import { type SceneFrame3D } from '@egret/engine/scene3d';
import {
  createSharedWebGL2Host, type SharedWebGL2Host, type SharedWebGL2HostOptions,
  type SharedWebGL2HostStatus, type SharedWebGL2Readback, type WebGL2HostStatus,
  type WebGL2HostState, type WebGL2HostErrorCode, type WebGL2HostDiagnostic, type WebGL2HostFailure,
} from '@egret/engine/webgl2';
import { createSharedSceneWebGL2Host, type SharedSceneWebGL2Host } from '@egret/engine/webgl2/scene3d';

export function rejectEntryLeaks(canvas: HTMLCanvasElement): void {
  // WEBGL2_TYPE_CASE GL-N01: the default root exposes no optional WebGL2 factory.
  root.createSharedWebGL2Host({ canvas });
  // WEBGL2_TYPE_CASE GL-N02: Canvas exposes no optional WebGL2 factory.
  canvasEntry.createSharedWebGL2Host({ canvas });
  // WEBGL2_TYPE_CASE GL-N03: ordinary WebGL2 exposes no scene factory.
  ordinary.createSharedSceneWebGL2Host({ canvas, outputAlpha: 'opaque' });
}
export function rejectOptions(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext): void {
  // WEBGL2_TYPE_CASE GL-N04: a real HTML canvas is required.
  createSharedWebGL2Host({});
  // WEBGL2_TYPE_CASE GL-N05: callers cannot supply a native context.
  createSharedWebGL2Host({ canvas, gl });
  // WEBGL2_TYPE_CASE GL-N06: callers cannot supply shaders.
  createSharedWebGL2Host({ canvas, shader: 'void main(){}' });
  // WEBGL2_TYPE_CASE GL-N07: output alpha is a finite policy.
  createSharedWebGL2Host({ canvas, outputAlpha: 'straight' });
  // WEBGL2_TYPE_CASE GL-N08: absent options differ from explicit undefined.
  createSharedWebGL2Host({ canvas, enableReadback: undefined });
  // WEBGL2_TYPE_CASE GL-N09: scene callers explicitly select opaque output.
  createSharedSceneWebGL2Host({ canvas });
  // WEBGL2_TYPE_CASE GL-N10: scene output cannot be premultiplied.
  createSharedSceneWebGL2Host({ canvas, outputAlpha: 'premultiplied' });
}
export function rejectMutableSnapshots(status: WebGL2HostStatus, shared: SharedWebGL2HostStatus, host: SharedSceneWebGL2Host): void {
  // WEBGL2_TYPE_CASE GL-N11: state is readonly.
  status.state = 'active';
  // WEBGL2_TYPE_CASE GL-N12: generation is readonly.
  status.generation = 2;
  // WEBGL2_TYPE_CASE GL-N13: retention charges are readonly.
  shared.retention.idleBytes = 0;
  // WEBGL2_TYPE_CASE GL-N14: scene charges are readonly.
  host.getSceneStatus().pendingDepthBytes = 0;
}
export function rejectReadback(readback: SharedWebGL2Readback): void {
  // WEBGL2_TYPE_CASE GL-N15: readback representation cannot be reassigned.
  readback.format = 'rgba8unorm';
  // WEBGL2_TYPE_CASE GL-N16: GL does not advertise a BGRA source representation.
  const format: 'bgra8unorm' = readback.sourceFormat;
  void format;
}
export function rejectFiniteDiscriminants(diagnostic: WebGL2HostDiagnostic, failure: WebGL2HostFailure): void {
  // WEBGL2_TYPE_CASE GL-N17: state does not admit arbitrary strings.
  const state: WebGL2HostState = 'recovering';
  // WEBGL2_TYPE_CASE GL-N18: error codes are finite.
  const code: WebGL2HostErrorCode = 'WEBGL2_ANY';
  // WEBGL2_TYPE_CASE GL-N19: diagnostic severity is readonly.
  diagnostic.severity = 'error';
  // WEBGL2_TYPE_CASE GL-N20: failure phase cannot be rewritten.
  failure.phase = 'cleanup';
  void [state, code];
}
export function rejectFrames(host: SharedWebGL2Host, sceneHost: SharedSceneWebGL2Host, shared: SharedRenderFrame2D, legacy: RenderFrame2D, scene: SceneFrame3D): void {
  // WEBGL2_TYPE_CASE GL-N21: a structural object is not a completed shared frame.
  host.renderSharedFrame({});
  // WEBGL2_TYPE_CASE GL-N22: legacy frames cannot enter the shared GL port.
  host.renderSharedFrame(legacy);
  // WEBGL2_TYPE_CASE GL-N23: ordinary hosts do not expose scene composition.
  host.renderSceneSharedFrame(scene, shared);
  // WEBGL2_TYPE_CASE GL-N24: scene composition requires its overlay.
  sceneHost.renderSceneSharedFrame(scene);
}
export function rejectAsyncPort(): void {
  // WEBGL2_TYPE_CASE GL-N25: rendering returns exact undefined synchronously.
  const port: SharedWebGL2Host['renderSharedFrame'] = async (_frame: SharedRenderFrame2D) => undefined;
  void port;
}
export function rejectMutableOptions(options: SharedWebGL2HostOptions, canvas: HTMLCanvasElement): void {
  // WEBGL2_TYPE_CASE GL-N26: captured option inputs retain readonly declarations.
  options.canvas = canvas;
}
