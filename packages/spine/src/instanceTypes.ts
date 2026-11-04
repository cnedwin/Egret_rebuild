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
  readonly skin: string | null;
  readonly pendingCommands: number;
  readonly bones: readonly SpineBonePose[];
  readonly slots: readonly Readonly<{ name: string; attachment: string | null }>[];
  readonly tracks: readonly Readonly<{ index: number; animation: string; trackTime: number; animationTime: number; loop: boolean; queued: number }>[];
  readonly events: readonly SpinePlaybackEvent[];
}
export interface SpineInstanceOptions {
  readonly maxSegments?: number;
  readonly maxEvents?: number;
  readonly onEvent?: (event: SpinePlaybackEvent) => void;
}
export interface SpineAnimationOptions { readonly loop?: boolean; readonly mixSeconds?: number; }
export interface SpineQueuedAnimationOptions extends SpineAnimationOptions { readonly delaySeconds?: number; }
export interface SpineInstance {
  readonly isDisposed: boolean;
  /** Commands commit at the next explicit advance, including commands from listeners. */
  setAnimation(track: number, name: string, options?: SpineAnimationOptions): void;
  addAnimation(track: number, name: string, options?: SpineQueuedAnimationOptions): void;
  clearTrack(track: number): void;
  setSkin(name: string): void;
  setTransform(x: number, y: number, scaleX?: number, scaleY?: number): void;
  setRate(rate: number): void;
  setPaused(paused: boolean): void;
  advance(tick: GameClockTick): SpineInstanceSnapshot;
  getSnapshot(): SpineInstanceSnapshot;
  dispose(): void;
}
