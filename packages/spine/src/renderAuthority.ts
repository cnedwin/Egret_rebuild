// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/engine';
import type { Scope } from '@egret/engine';
import type { Skeleton } from '@esotericsoftware/spine-core';
import type { SpineInstance } from './instanceTypes.js';
import type { SpineAssetPort } from './assetAuthority.js';
export interface SpineDrawCandidate { commit(): void; abort(): void; retire?(): void; }
export interface SpineDrawSink { prepare(skeleton: Skeleton): SpineDrawCandidate; dispose(): void; }
/**
 * One entry of a track, current, queued or being mixed out of: its animation, by what a later version
 * must match, every scalar of its position, and what it remembers of the rotations it mixes.
 */
export interface SpinePreservedEntry {
  readonly name: string;
  readonly duration: number;
  /** Authored events in order, as time and name alternating: where the event cursor stands is a time. */
  readonly events: readonly (number | string)[];
  readonly values: Readonly<Record<string, number | boolean>>;
  /** The turn Core keeps for each rotation an entry mixes, so that a mix goes on round the same way. */
  readonly rotations: readonly (number | undefined)[];
  /** How Core applies each timeline of the entry. An entry that keeps its holds reads them from here. */
  readonly modes: readonly number[];
  readonly policy: Readonly<{ plays: number | null; completed: number; finite: boolean; duration: number; nextBoundary: number; nextPlay: number; restart: boolean }> | undefined;
}
/** Playback of one instance between two advances. Private to this package; no upstream object is in it. */
export interface SpinePreservedPlayback {
  readonly tracks: readonly (readonly SpinePreservedEntry[] | undefined)[];
  /** For each track, the entries its current one is still mixing out of, the oldest first. */
  readonly mixing: readonly (readonly SpinePreservedEntry[])[];
  readonly skins: readonly string[];
  readonly transform: readonly [number, number, number, number];
  readonly rate: number;
  readonly paused: boolean;
  readonly revision: number;
  readonly tickId: number;
  readonly clockElapsed: number;
  readonly elapsedSeconds: number;
}
export interface SpineRenderPort {
  readonly asset: SpineAssetPort;
  initializeReset(): void;
  /** Playback as it stands, or SPINE_RESET_PRESERVE_STATE when it cannot be carried now. */
  exportPlayback(): SpinePreservedPlayback;
  /** Refuses playback this instance's asset cannot continue. Changes nothing. */
  checkPreserve(playback: SpinePreservedPlayback): void;
  /** A pristine instance takes up the playback where it stands. Nothing already delivered is delivered again. */
  initializePreserve(playback: SpinePreservedPlayback): void;
  attach(scope: Scope, sink: SpineDrawSink): () => void;
}
const ports = new WeakMap<object, SpineRenderPort>();
/** Private genuine-instance capability; copied snapshots never authorize rendering. */
export function registerSpineRender(instance: SpineInstance, port: SpineRenderPort): void { ports.set(instance, port); }
export function requireSpineRender(instance: SpineInstance): SpineRenderPort {
  const port = ports.get(instance); if (!port) throw new EgretError('SPINE_DISPLAY_INSTANCE_INVALID'); return port;
}
