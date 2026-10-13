// SPDX-License-Identifier: Apache-2.0
// Compile-only consumers of the accepted public contract; no runtime authority is inferred.
import { createSequenceClip } from '@egret/engine';
import type {
  Bitmap, Disposable, Engine, Scope, SequenceClip, SequencePlayback,
  SequencePlaybackMode, SequencePlaybackOptions, SequencePlaybackState,
  SequenceRegion, SequenceSample,
} from '@egret/engine';

export const playbackStates: readonly SequencePlaybackState[] = [
  'idle', 'running', 'paused', 'completed', 'stopped', 'failed',
];
export const playbackModes: readonly SequencePlaybackMode[] = ['once', 'loop'];
export const defaultOptions: SequencePlaybackOptions = {};
export const onceOptions: SequencePlaybackOptions = { mode: 'once' };
export const loopOptions: SequencePlaybackOptions = { mode: 'loop' };
export const optionalMode: SequencePlaybackMode | undefined = defaultOptions.mode;

export function makeDefaultPlayback(
  engine: Engine, scope: Scope, bitmap: Bitmap, clip: SequenceClip,
): SequencePlayback {
  return engine.createSequencePlayback(scope, bitmap, clip);
}

export function makeExplicitDefaultPlayback(
  engine: Engine, scope: Scope, bitmap: Bitmap, clip: SequenceClip,
): SequencePlayback {
  return engine.createSequencePlayback(scope, bitmap, clip, undefined);
}

export function makeConfiguredPlayback(
  engine: Engine, scope: Scope, bitmap: Bitmap, clip: SequenceClip,
  options: SequencePlaybackOptions,
): SequencePlayback {
  return engine.createSequencePlayback(scope, bitmap, clip, options);
}

export function consumePlayback(engine: Engine, bitmap: Bitmap): SequencePlayback {
  const scope: Scope = engine.createScope();
  const clip: SequenceClip = createSequenceClip({
    atlasWidth: 6, atlasHeight: 2,
    frames: [
      { x: 0, y: 0, width: 2, height: 2, durationSeconds: 0.125 },
      { x: 2, y: 0, width: 1, height: 2, durationSeconds: 0.25 },
      { x: 3, y: 0, width: 3, height: 1, durationSeconds: 0.125 },
    ],
  });
  const handle: SequencePlayback = engine.createSequencePlayback(scope, bitmap, clip, loopOptions);
  const owned: SequencePlayback = scope.use(handle);
  const disposable: Disposable = owned;
  const state: SequencePlaybackState = owned.state;
  const disposed: boolean = owned.isDisposed;
  const elapsed: number = owned.elapsedSeconds;
  const optionalSample: SequenceSample | undefined = owned.lastSample;
  if (optionalSample !== undefined) {
    const sample: SequenceSample = optionalSample;
    const region: SequenceRegion = sample.region;
    const dimensions: readonly number[] = [region.x, region.y, region.width, region.height];
    const frameIndex: number = sample.frameIndex;
    const position: number = sample.positionSeconds;
    const atEnd: boolean = sample.atEnd;
    const stopped: boolean = sample.stopped;
    void dimensions; void frameIndex; void position; void atEnd; void stopped;
  }
  const startResult: void = owned.start();
  const pauseResult: void = owned.pause();
  const resumeResult: void = owned.resume();
  const stopResult: void = owned.stop();
  const disposeResult: void = owned.dispose();
  const disposableResult: void = disposable.dispose();
  void state; void disposed; void elapsed;
  void startResult; void pauseResult; void resumeResult;
  void stopResult; void disposeResult; void disposableResult;
  return owned;
}
