// SPDX-License-Identifier: Apache-2.0
import type { GameClockTick } from '@egret/engine';

export type SpineInstanceState = 'running' | 'paused' | 'faulted' | 'disposed';
export type SpinePlaybackEventKind = 'start' | 'interrupt' | 'end' | 'dispose' | 'complete' | 'event';
export interface SpinePlaybackEvent {
  readonly kind: SpinePlaybackEventKind;
  readonly track: number;
  readonly animation: string;
  readonly trackTime: number;
  readonly event?: Readonly<{ name: string; time: number; intValue: number; floatValue: number; stringValue: string | null }>;
}
export interface SpineBonePose {
  readonly name: string;
  readonly x: number; readonly y: number; readonly rotation: number;
  readonly a: number; readonly b: number; readonly c: number; readonly d: number;
  readonly worldX: number; readonly worldY: number;
}
export interface SpineInstanceSnapshot {
  readonly state: SpineInstanceState;
  readonly revision: number;
  readonly tickId: number;
  readonly elapsedSeconds: number;
  readonly rate: number;
  /** Single selected skin; null for a composite or the initial implicit default. */
  readonly skin: string | null;
  /** Ordered selection; later skins override matching slot/placeholder entries. */
  readonly skins: readonly string[];
  readonly pendingCommands: number;
  readonly bones: readonly SpineBonePose[];
  readonly slots: readonly Readonly<{ name: string; attachment: string | null }>[];
  readonly tracks: readonly Readonly<{ index: number; animation: string; trackTime: number; animationTime: number; loop: boolean; plays: number | null; completedPlays: number; queued: number }>[];
  readonly events: readonly SpinePlaybackEvent[];
}
/** The work a seek may do and the history kept for it. Every limit is positive and bounded. */
export interface SpineSeekLimits {
  /** Segments of at most 1/60 second one seek may replay in all. Defaults to 3600. */
  readonly maxSegments?: number;
  /** Segments one call of `step` replays. Defaults to 120. */
  readonly sliceSegments?: number;
  /** Events one forward seek may replay. Defaults to 1024. */
  readonly maxEvents?: number;
  /** Advances kept as history. One more and the history is dropped: later seeks are refused. Defaults to 3600. */
  readonly historyAdvances?: number;
  /** Commands kept as history, with the same consequence. Defaults to 1024. */
  readonly historyCommands?: number;
}
export interface SpineInstanceOptions {
  readonly maxSegments?: number;
  readonly maxEvents?: number;
  readonly onEvent?: (event: SpinePlaybackEvent) => void;
  readonly seek?: SpineSeekLimits;
}
export interface SpineSeekRequest {
  /** The elapsed animation time to stand at, as `SpineInstanceSnapshot.elapsedSeconds` counts it. */
  readonly elapsedSeconds: number;
  /**
   * 'suppress', the default, delivers no event. 'replay' delivers the events of a forward seek,
   * those after the current time up to the target, once the seek has succeeded.
   */
  readonly events?: 'suppress' | 'replay';
}
export type SpineSeekState = 'staged' | 'ready' | 'committed' | 'cancelled' | 'failed';
/**
 * A seek in progress. It is prepared on a private copy, slice by slice, and the instance is
 * untouched until `commit`.
 */
export interface SpineSeekTicket {
  readonly state: SpineSeekState;
  readonly targetSeconds: number;
  readonly totalSegments: number;
  readonly completedSegments: number;
  /** Replays one slice. Returns true when the seek is ready to commit. */
  step(): boolean;
  /** Replaces the playback of the instance with the prepared one. */
  commit(): SpineInstanceSnapshot;
  /** Discards the prepared playback. The instance is as it was. */
  cancel(): void;
}
export interface SpineAnimationOptions {
  readonly loop?: boolean;
  /** Total plays, 1..1024; cannot be combined with loop. Zero duration admits only 1. */
  readonly plays?: number;
  readonly mixSeconds?: number;
}
export interface SpineQueuedAnimationOptions extends SpineAnimationOptions { readonly delaySeconds?: number; }
export interface SpineInstance {
  readonly isDisposed: boolean;
  /** Commands commit at the next explicit advance, including commands from listeners. */
  setAnimation(track: number, name: string, options?: SpineAnimationOptions): void;
  addAnimation(track: number, name: string, options?: SpineQueuedAnimationOptions): void;
  clearTrack(track: number): void;
  setSkin(name: string): void;
  /** Queue 1..32 distinct known skins; commit on the next explicit advance. */
  setSkins(names: readonly string[]): void;
  setTransform(x: number, y: number, scaleX?: number, scaleY?: number): void;
  setRate(rate: number): void;
  setPaused(paused: boolean): void;
  advance(tick: GameClockTick): SpineInstanceSnapshot;
  /**
   * Stages a move to another elapsed time, backward or forward. The playback is rebuilt from the
   * setup pose by replaying what was applied to this instance, under the same segment rule.
   */
  seek(request: SpineSeekRequest): SpineSeekTicket;
  getSnapshot(): SpineInstanceSnapshot;
  dispose(): void;
}
