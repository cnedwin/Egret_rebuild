// SPDX-License-Identifier: Apache-2.0
// The logical resource observations that both shared Hosts keep: fixed-size counters, their
// lifetime high-water marks and the frozen status read from them. Nothing here makes a native call,
// runs a callback or changes Host state; each Host supplies its own current values.
import type { SharedPageCopyDiagnostics2D } from '../rendering/sharedColor2D.js';
import type { SharedHostResourceStatus } from './sharedDeviceSession.js';
import type { NativeUnknownDiagnostics, RetentionLedgerDiagnostics } from './sharedRetentionLedger.js';

/** What a Host has promised but not yet settled: frames and the credits they hold. */
export interface SharedResourcePending2D {
  frames: number;
  uploadCreditBytes: number;
  pageCreditBytes: number;
  readbackCreditBytes: number;
  geometryCreditBytes: number;
  colorCreditBytes: number;
}
/** The page images a Host keeps ready, those pinned by a frame, and their native accounting. */
export interface SharedResourceImages2D {
  readyBytes: number;
  readyEntries: number;
  pinnedReadyBytes: number;
  pinnedReadyEntries: number;
  allocatedLogicalBytes: number;
  reservedCreditBytes: number;
}
/** Lifetime totals; one that would pass the largest safe integer stays there and marks the status saturated. */
export interface SharedResourceTotals2D {
  pageWriteCalls: number;
  pageWriteBytes: number;
  readyCapacityEvictions: number;
}

export function createPageCopyDiagnostics(): SharedPageCopyDiagnostics2D {
  return {
    canonicalBytes: 0,
    scratchBytes: 0,
    highCanonicalBytes: 0,
    highScratchBytes: 0,
    highTemporaryBytes: 0,
    saturated: false
  };
}
export function createUnknownNativeDiagnostics(): NativeUnknownDiagnostics {
  return {
    knownLogicalBytes: 0,
    objects: 0,
    highKnownLogicalBytes: 0,
    highObjects: 0,
    saturated: false
  };
}
/** Reuse gauges of the retention ledgers; a Host that projects unknown native objects through them names that record. */
export function createReuseDiagnostics(unknownNative?: NativeUnknownDiagnostics): RetentionLedgerDiagnostics {
  const gauges = () => ({
    idleBytes: 0,
    idleEntries: 0,
    leasedBytes: 0,
    leasedEntries: 0,
    reservedBytes: 0,
    reservedEntries: 0,
    detachedBytes: 0,
    detachedEntries: 0,
    unknownBytes: 0,
    unknownEntries: 0
  });
  return unknownNative === undefined
    ? { current: gauges(), highWater: gauges(), saturated: false }
    : { current: gauges(), highWater: gauges(), saturated: false, unknownNative };
}
export function createPendingHighWater(): SharedResourcePending2D {
  return {
    frames: 0,
    uploadCreditBytes: 0,
    pageCreditBytes: 0,
    readbackCreditBytes: 0,
    geometryCreditBytes: 0,
    colorCreditBytes: 0
  };
}
export function createImagesHighWater(): SharedResourceImages2D {
  return {
    readyBytes: 0,
    readyEntries: 0,
    pinnedReadyBytes: 0,
    pinnedReadyEntries: 0,
    allocatedLogicalBytes: 0,
    reservedCreditBytes: 0
  };
}
export function createResourceTotals(): SharedResourceTotals2D {
  return { pageWriteCalls: 0, pageWriteBytes: 0, readyCapacityEvictions: 0 };
}

export function raisePendingHighWater(high: SharedResourcePending2D, sample: Readonly<SharedResourcePending2D>): void {
  high.frames = Math.max(high.frames, sample.frames);
  high.uploadCreditBytes = Math.max(high.uploadCreditBytes, sample.uploadCreditBytes);
  high.pageCreditBytes = Math.max(high.pageCreditBytes, sample.pageCreditBytes);
  high.readbackCreditBytes = Math.max(high.readbackCreditBytes, sample.readbackCreditBytes);
  high.geometryCreditBytes = Math.max(high.geometryCreditBytes, sample.geometryCreditBytes);
  high.colorCreditBytes = Math.max(high.colorCreditBytes, sample.colorCreditBytes);
}
export function raiseImagesHighWater(high: SharedResourceImages2D, sample: Readonly<SharedResourceImages2D>): void {
  high.readyBytes = Math.max(high.readyBytes, sample.readyBytes);
  high.readyEntries = Math.max(high.readyEntries, sample.readyEntries);
  high.pinnedReadyBytes = Math.max(high.pinnedReadyBytes, sample.pinnedReadyBytes);
  high.pinnedReadyEntries = Math.max(high.pinnedReadyEntries, sample.pinnedReadyEntries);
  high.allocatedLogicalBytes = Math.max(high.allocatedLogicalBytes, sample.allocatedLogicalBytes);
  high.reservedCreditBytes = Math.max(high.reservedCreditBytes, sample.reservedCreditBytes);
}
/** Adds to one total; returns true when the total saturated instead. */
export function addResourceTotal(
  totals: SharedResourceTotals2D,
  key: keyof SharedResourceTotals2D,
  amount: number
): boolean {
  const old = totals[key];
  if (amount > Number.MAX_SAFE_INTEGER - old) {
    totals[key] = Number.MAX_SAFE_INTEGER;
    return true;
  }
  totals[key] = old + amount;
  return false;
}

/** The records a Host reads its status from, with its own current values and its own saturation. */
export interface SharedResourceStatusInput2D {
  readonly pending: Readonly<SharedResourcePending2D>;
  readonly images: Readonly<SharedResourceImages2D>;
  readonly cpu: SharedPageCopyDiagnostics2D;
  readonly reuse: RetentionLedgerDiagnostics;
  readonly unknown: NativeUnknownDiagnostics;
  readonly highPending: Readonly<SharedResourcePending2D>;
  readonly highImages: Readonly<SharedResourceImages2D>;
  readonly totals: Readonly<SharedResourceTotals2D>;
  readonly saturated: boolean;
}
/** Read-only logical observations; no native call, callback or state transition. */
export function sharedResourceStatus(input: SharedResourceStatusInput2D): SharedHostResourceStatus {
  const { cpu, reuse, unknown } = input;
  return Object.freeze({
    current: Object.freeze({
      pending: Object.freeze({ ...input.pending }),
      cpu: Object.freeze({
        canonicalBytes: cpu.canonicalBytes,
        scratchBytes: cpu.scratchBytes,
        temporaryBytes: cpu.canonicalBytes + cpu.scratchBytes
      }),
      images: Object.freeze({ ...input.images }),
      reusable: Object.freeze({ ...reuse.current }),
      unknownNative: Object.freeze({
        knownLogicalBytes: unknown.knownLogicalBytes,
        objects: unknown.objects
      })
    }),
    highWater: Object.freeze({
      pending: Object.freeze({ ...input.highPending }),
      cpu: Object.freeze({
        canonicalBytes: cpu.highCanonicalBytes,
        scratchBytes: cpu.highScratchBytes,
        temporaryBytes: cpu.highTemporaryBytes
      }),
      images: Object.freeze({ ...input.highImages }),
      reusable: Object.freeze({ ...reuse.highWater }),
      unknownNative: Object.freeze({
        knownLogicalBytes: unknown.highKnownLogicalBytes,
        objects: unknown.highObjects
      })
    }),
    totals: Object.freeze({ ...input.totals }),
    saturated: input.saturated || cpu.saturated || reuse.saturated || unknown.saturated
  });
}
