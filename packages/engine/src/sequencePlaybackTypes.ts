// SPDX-License-Identifier: Apache-2.0
import type { Disposable } from '@egret/contracts';
import type { SequencePlaybackMode, SequenceSample } from '@egret/runtime';

export type SequencePlaybackState = 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed';
export interface SequencePlaybackOptions {
  readonly mode?: SequencePlaybackMode;
}

// Declaration-only identity keeps the public handle opaque without a brand value.
declare const sequencePlaybackBrand: unique symbol;
export interface SequencePlayback extends Disposable {
  readonly [sequencePlaybackBrand]: true;
  readonly state: SequencePlaybackState;
  readonly isDisposed: boolean;
  readonly elapsedSeconds: number;
  readonly lastSample: SequenceSample | undefined;
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  dispose(): void;
}
