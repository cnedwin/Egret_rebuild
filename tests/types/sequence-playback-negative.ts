// SPDX-License-Identifier: Apache-2.0
// Each independent function has one marked bad statement and no diagnostic prediction.
import type {
  Bitmap, Engine, Scope, SequenceClip, SequencePlayback, SequencePlaybackOptions,
  SequencePlaybackState, SequenceSample,
} from '@egret/engine';

export function rejectOptionsWrite(options: SequencePlaybackOptions): void {
  // SEQP_TYPE_CASE SEQP-N01
  options.mode = 'once';
}

export function rejectStateWrite(handle: SequencePlayback): void {
  // SEQP_TYPE_CASE SEQP-N02
  handle.state = 'paused';
}

export function rejectDisposedWrite(handle: SequencePlayback): void {
  // SEQP_TYPE_CASE SEQP-N03
  handle.isDisposed = true;
}

export function rejectElapsedWrite(handle: SequencePlayback): void {
  // SEQP_TYPE_CASE SEQP-N04
  handle.elapsedSeconds = 0;
}

export function rejectSampleWrite(handle: SequencePlayback): void {
  // SEQP_TYPE_CASE SEQP-N05
  handle.lastSample = undefined;
}

export function rejectFrameIndexWrite(sample: SequenceSample): void {
  // SEQP_TYPE_CASE SEQP-N06
  sample.frameIndex = 0;
}

export function rejectRegionReplacement(sample: SequenceSample): void {
  // SEQP_TYPE_CASE SEQP-N07
  sample.region = { x: 0, y: 0, width: 2, height: 2 };
}

export function rejectNestedRegionWrite(sample: SequenceSample): void {
  // SEQP_TYPE_CASE SEQP-N08
  sample.region.x = 0;
}

export function rejectRequiredSample(handle: SequencePlayback): void {
  // SEQP_TYPE_CASE SEQP-N09
  const sample: SequenceSample = handle.lastSample;
  void sample;
}

export function rejectUnknownState(): void {
  // SEQP_TYPE_CASE SEQP-N10
  const state: SequencePlaybackState = 'disposed';
  void state;
}

export function rejectUnknownMode(): void {
  // SEQP_TYPE_CASE SEQP-N11
  const options: SequencePlaybackOptions = { mode: 'ping-pong' };
  void options;
}

export function rejectPresentUndefinedMode(): void {
  // SEQP_TYPE_CASE SEQP-N12
  const options: SequencePlaybackOptions = { mode: undefined };
  void options;
}

export function rejectNullOptions(engine: Engine, scope: Scope, bitmap: Bitmap, clip: SequenceClip): void {
  // SEQP_TYPE_CASE SEQP-N13
  engine.createSequencePlayback(scope, bitmap, clip, null);
}

export function rejectPrimitiveOptions(engine: Engine, scope: Scope, bitmap: Bitmap, clip: SequenceClip): void {
  // SEQP_TYPE_CASE SEQP-N14
  engine.createSequencePlayback(scope, bitmap, clip, 'loop');
}

export function rejectWrongScope(engine: Engine, bitmap: Bitmap, clip: SequenceClip): void {
  // SEQP_TYPE_CASE SEQP-N15
  engine.createSequencePlayback(bitmap, bitmap, clip);
}

export function rejectWrongBitmap(engine: Engine, scope: Scope, clip: SequenceClip): void {
  // SEQP_TYPE_CASE SEQP-N16
  engine.createSequencePlayback(scope, clip, clip);
}

export function rejectWrongClip(engine: Engine, scope: Scope, bitmap: Bitmap): void {
  // SEQP_TYPE_CASE SEQP-N17
  engine.createSequencePlayback(scope, bitmap, bitmap);
}

export function rejectUndefinedScope(engine: Engine, bitmap: Bitmap, clip: SequenceClip): void {
  // SEQP_TYPE_CASE SEQP-N18
  engine.createSequencePlayback(undefined, bitmap, clip);
}

export function rejectUndefinedBitmap(engine: Engine, scope: Scope, clip: SequenceClip): void {
  // SEQP_TYPE_CASE SEQP-N19
  engine.createSequencePlayback(scope, undefined, clip);
}

export function rejectUndefinedClip(engine: Engine, scope: Scope, bitmap: Bitmap): void {
  // SEQP_TYPE_CASE SEQP-N20
  engine.createSequencePlayback(scope, bitmap, undefined);
}

export function rejectMissingClip(engine: Engine, scope: Scope, bitmap: Bitmap): void {
  // SEQP_TYPE_CASE SEQP-N21
  engine.createSequencePlayback(scope, bitmap);
}

export function rejectStartArgument(handle: SequencePlayback): void {
  // SEQP_TYPE_CASE SEQP-N22
  handle.start(0);
}

export function rejectPauseCallback(handle: SequencePlayback): void {
  // SEQP_TYPE_CASE SEQP-N23
  handle.pause(() => undefined);
}

export function rejectStartValue(handle: SequencePlayback): void {
  // SEQP_TYPE_CASE SEQP-N24
  const result: number = handle.start();
  void result;
}

export function rejectAsyncDispose(handle: SequencePlayback): void {
  // SEQP_TYPE_CASE SEQP-N25
  const result: Promise<void> = handle.dispose();
  void result;
}

export function rejectStructuralHandle(): void {
  const state: SequencePlaybackState = 'idle';
  const lookalike = {
    state, isDisposed: false, elapsedSeconds: 0, lastSample: undefined,
    start(): void {}, pause(): void {}, resume(): void {}, stop(): void {}, dispose(): void {},
  };
  // SEQP_TYPE_CASE SEQP-N26
  const forged: SequencePlayback = lookalike;
  void forged;
}

export function rejectPrivatePlayer(handle: SequencePlayback): void {
  // SEQP_TYPE_CASE SEQP-N27
  void handle.player;
}
