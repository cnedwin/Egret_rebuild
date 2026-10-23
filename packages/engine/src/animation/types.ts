// SPDX-License-Identifier: Apache-2.0
import type {SequenceSample} from '@egret/runtime';

/** Immutable authored marker; its input index breaks equal-time ties. */
export interface SequenceMarker { readonly id: string; readonly timeSeconds: number; }
export interface SequenceControllerOptions {
  readonly profile: 'egret.sequence-control/1';
  readonly totalPlays?: number | 'infinite';
  readonly rate?: number;
  readonly markers?: readonly SequenceMarker[];
  readonly onEvent?: (event: SequenceControllerEvent) => undefined;
}
export type SequenceControllerState = 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'faulted';
export type SequenceEventSource = 'start' | 'clock' | 'seek' | 'control';
export type SequenceControllerEvent = Readonly<{
  kind: 'marker'; id: string; markerIndex: number; playIndex: number;
  timelineSeconds: number; positionSeconds: number; clockTickId: number;
  sequence: number; source: SequenceEventSource;
}> | Readonly<{
  kind: 'complete'; totalPlays: number; timelineSeconds: number;
  clockTickId: number; sequence: number; source: SequenceEventSource;
}>;
export interface SequenceSeekRequest { readonly timeSeconds: number; readonly replayEvents?: boolean; }
export interface SequenceControllerStatus {
  readonly state: SequenceControllerState;
  readonly isDisposed: boolean;
  readonly elapsedSeconds: number;
  readonly positionSeconds: number;
  readonly playIndex: number;
  readonly rate: number;
  readonly totalPlays: number | 'infinite';
  readonly lastSample: SequenceSample | undefined;
  readonly pendingCommands: number;
  readonly committedEventCount: number;
  readonly lastIssue: Readonly<{code: string; clockTickId: number}> | undefined;
}
declare const controllerBrand: unique symbol;
/** Receiver-checked owned handle; time is driven only by its genuine Engine. */
export interface SequenceController {
  readonly [controllerBrand]: true;
  readonly profile: 'egret.sequence-control/1';
  start(): void;
  pause(): void;
  resume(): void;
  setRate(rate: number): void;
  seek(request: SequenceSeekRequest): void;
  stop(): void;
  dispose(): void;
  getStatus(): SequenceControllerStatus;
}
