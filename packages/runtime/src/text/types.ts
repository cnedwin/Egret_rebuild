import type { CancellationSignal, ImageData2D } from '@egret/contracts';
import type { AssetManager } from '../AssetManager.js';
import type { AssetLease } from '../AssetLease.js';
import type { Texture } from '../Texture.js';

declare const requestBrand: unique symbol;
declare const planBrand: unique symbol;
declare const cacheBrand: unique symbol;

export interface TextRasterRequestInput {
  readonly text: string;
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly fontWeight: number;
  readonly fontStyle: 'normal' | 'italic';
  readonly lineHeight: number;
  readonly locale: string;
  readonly direction: 'ltr' | 'rtl';
  readonly density: number;
  readonly fillColor: number;
}
/** UTF-16 ranges [start, end) omit a delimiter; [end, breakEnd) preserves it. */
export interface TextSourceLine {
  readonly start: number;
  readonly end: number;
  readonly breakEnd: number;
}
/** Frozen cache-owned request; its private identity authenticates plan creation. */
export interface TextRasterRequest extends TextRasterRequestInput {
  readonly [requestBrand]: true;
  readonly profile: 'canvas-explicit-lines-v1';
  readonly providerIdentity: string;
  readonly fontGeneration: number;
  readonly sourceLines: readonly TextSourceLine[];
}
export interface TextBounds2D {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
/** Advance is nonnegative; signed baseline-relative ink may extend beyond the advance. */
export interface TextLineMetricsInput {
  readonly advance: number;
  readonly hasInk: boolean;
  readonly inkLeft: number;
  readonly inkTop: number;
  readonly inkRight: number;
  readonly inkBottom: number;
}
export interface TextPlanInput {
  readonly baselineOffset: number;
  readonly lines: readonly TextLineMetricsInput[];
}
export interface TextLineMetrics {
  readonly source: TextSourceLine;
  readonly advance: number;
  readonly baselineY: number;
  readonly inkBounds: TextBounds2D | undefined;
}
export interface TextRasterPlacement {
  readonly pixelLeft: number;
  readonly pixelTop: number;
  readonly width: number;
  readonly height: number;
  readonly byteLength: number;
  readonly density: number;
  readonly x: number;
  readonly y: number;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
}
export interface TextRasterMetrics {
  readonly logicalBounds: TextBounds2D;
  readonly inkBounds: TextBounds2D | undefined;
  readonly contentBounds: TextBounds2D;
  readonly lines: readonly TextLineMetrics[];
  readonly raster: TextRasterPlacement | undefined;
}
/** Frozen plan issued for this measure invocation; a matching shape supplies no authority. */
export interface TextRasterPlan {
  readonly [planBrand]: true;
  readonly request: TextRasterRequest;
  readonly metrics: TextRasterMetrics;
}
export interface TextRasterLimits {
  readonly maxSourceCodeUnits: 8192;
  readonly maxLines: 64;
  readonly maxFontFamilyCodeUnits: 256;
  readonly maxLocaleCodeUnits: 64;
  readonly maxProviderIdentityCodeUnits: 64;
  readonly maxSourceEdge: 4096;
  readonly maxSourcePixels: 1048576;
  readonly maxMetricMagnitude: 1048576;
  readonly antialiasGuardPixels: 2;
}
export interface TextMeasureContext {
  readonly signal: CancellationSignal;
  readonly fontGeneration: number;
  readonly limits: TextRasterLimits;
  readonly createPlan: (input: TextPlanInput) => TextRasterPlan;
}
export interface TextRasterContext {
  readonly signal: CancellationSignal;
  readonly fontGeneration: number;
  readonly limits: TextRasterLimits;
  readonly reservedImageBytes: number;
  readonly reservedScratchBytes: number;
}
export interface TextRasterProvider {
  readonly identity: string;
  readonly profile: 'canvas-explicit-lines-v1';
  /** Return this invocation's exact context.createPlan result. */
  measure(request: TextRasterRequest, context: TextMeasureContext): Promise<TextRasterPlan>;
  /** Runs after image/scratch reservation; return matching ImageData2D, or undefined for inkless work. */
  rasterize(plan: TextRasterPlan, context: TextRasterContext): Promise<ImageData2D | undefined>;
  /** Attempted once after measure and raster uses settle, including cancelled work. */
  release(plan: TextRasterPlan): void;
}
/** Logical limits bound retained work and byte charges; physical memory is not measured. */
export interface TextRasterCacheOptions {
  readonly provider: TextRasterProvider;
  readonly maxGenerations?: number;
  readonly maxPendingJobs?: number;
  readonly maxWaiters?: number;
  readonly maxCallerLeases?: number;
  readonly maxResidentEntries?: number;
  readonly maxMetadataBytes?: number;
  readonly maxLogicalImageBytes?: number;
  readonly maxPendingRasterBytes?: number;
}
export interface TextRasterAcquireOptions {
  readonly signal?: CancellationSignal;
}
export type PreparedTextRaster =
  | { readonly kind: 'empty'; readonly request: TextRasterRequest; readonly metrics: TextRasterMetrics }
  | { readonly kind: 'image'; readonly request: TextRasterRequest; readonly metrics: TextRasterMetrics; readonly lease: AssetLease<Texture> };
/** Logical charges include retained and quarantined work, which may survive cache close. */
export interface TextRasterCacheStatus {
  readonly closed: boolean;
  readonly fontGeneration: number;
  readonly occupiedSlots: number;
  readonly currentGenerations: number;
  readonly retiredGenerations: number;
  readonly quarantinedGenerations: number;
  readonly pendingJobs: number;
  readonly pendingWaiters: number;
  readonly callerLeaseSlots: number;
  readonly activeCallerLeases: number;
  readonly residentEntries: number;
  readonly residentBytes: number;
  readonly liveImageBytes: number;
  readonly reservedImageBytes: number;
  readonly pendingRasterBytes: number;
  readonly quarantinedImageBytes: number;
  readonly quarantinedRasterBytes: number;
  readonly metadataBytes: number;
  readonly idleWaiters: number;
  readonly cleanupFailureCount: number;
  readonly lateProviderFailureCount: number;
}
export interface TextRasterCache {
  readonly [cacheBrand]: true;
  readonly profile: 'canvas-explicit-lines-v1';
  acquire(request: TextRasterRequestInput, options?: TextRasterAcquireOptions): Promise<PreparedTextRaster>;
  invalidate(): void;
  getStatus(): TextRasterCacheStatus;
  /** Wait for outstanding work/delivery actors and report recorded cleanup failure.
   * Caller/resident leases and quarantined charges may remain after settlement.
   */
  whenIdle(): Promise<void>;
  dispose(): void;
}
