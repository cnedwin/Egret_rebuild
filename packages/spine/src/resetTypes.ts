// SPDX-License-Identifier: Apache-2.0
import type { SharedFrameOptions2D, SharedRenderFrame2D } from '@egret/engine';
import type { SpineContentLoader } from './types.js';
import type { SpineInstance, SpinePlaybackEvent } from './instanceTypes.js';
import type { SpineDisplay } from './displayTypes.js';

export interface SpineResetInitial {
  /** Application label only; never resource/cache or Host generation authority. */
  readonly version: string;
  readonly instance: SpineInstance;
  readonly display: SpineDisplay;
}
export interface SpineResetRequest {
  readonly policy: 'reset';
  readonly version: string;
  /** Borrowed genuine loader; the slot owns only its newly loaded group. */
  readonly loader: SpineContentLoader;
  readonly assetId: string;
  /** Exact authored track-zero animation name; initial time is zero. */
  readonly animation: string;
  readonly skins?: readonly string[];
  readonly loop?: boolean;
  readonly plays?: number;
  readonly onEvent?: (event: SpinePlaybackEvent) => void;
}
/**
 * Replaces the asset and keeps the playback: tracks and their queues, skins, rate, pause and placement
 * continue from where they stand when the candidate is captured. Refused when the new asset cannot
 * continue them.
 */
export interface SpinePreserveRequest {
  readonly version: string;
  /** Borrowed genuine loader; the slot owns only its newly loaded group. */
  readonly loader: SpineContentLoader;
  readonly assetId: string;
  /** Listener of the new player. Nothing the previous player delivered is delivered again. */
  readonly onEvent?: (event: SpinePlaybackEvent) => void;
}
export type SpineResetState = 'loading' | 'ready' | 'prepared' | 'committed' | 'cancelled' | 'failed';
export interface SpineResetActive extends SpineResetInitial { readonly ownership: 'borrowed' | 'owned'; }
export interface SpineResetTicket {
  /** CPU assets/pose only. This is not Host upload readiness. */
  readonly ready: Promise<void>;
  readonly state: SpineResetState;
  /** Opens the bounded final window; genuine Engine snapshot validation applies. */
  capture(options: SharedFrameOptions2D): SharedRenderFrame2D;
  /** CPU publication only. Automatically retires only an owned predecessor. */
  commit(): SpineResetActive;
  dispose(): void;
}
export interface SpineResetSlot {
  readonly isDisposed: boolean;
  getActive(): SpineResetActive;
  request(request: SpineResetRequest): SpineResetTicket;
  /** As `request`, carrying the active playback into the new asset in place of starting an animation. */
  requestPreserving(request: SpinePreserveRequest): SpineResetTicket;
  /** Revokes pending demand and owned active content; initial content stays borrowed. */
  dispose(): void;
}
