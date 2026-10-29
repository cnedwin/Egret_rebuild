// SPDX-License-Identifier: Apache-2.0
import type { CancellationSignal, ImageData2D } from '@egret/contracts';
import type { AssetLease } from '../AssetLease.js';
import type { Texture } from '../Texture.js';
import type { DisplayObjectContainer } from '../DisplayObjectContainer.js';

export interface ParagraphRequestInput {
  readonly text: string;
  readonly width: number;
  readonly fontFamilies: readonly string[];
  readonly fontSize: number;
  /** Optional minimum logical line height; larger natural font metrics still win. */
  readonly lineHeight?: number;
  readonly locale: string;
  readonly direction: 'ltr' | 'rtl';
  readonly fillColor: number;
  readonly density: number;
}
export interface ParagraphRequest extends ParagraphRequestInput {}
/** Source ranges are UTF16 [start, end), never glyph or UTF8 byte indices. */
export interface ParagraphLine {
  readonly start: number;
  readonly end: number;
  readonly baseline: number;
  readonly ascent: number;
  readonly descent: number;
  readonly height: number;
  readonly width: number;
}
export interface ParagraphMetrics {
  /** Logical wrapping width and layout height, independent of raster guards/density. */
  readonly width: number;
  readonly height: number;
  readonly lines: readonly ParagraphLine[];
}
export interface ParagraphRaster {
  readonly metrics: ParagraphMetrics;
  readonly image: ImageData2D | undefined;
  /** Logical placement of the density-scaled image, including signed ink bearings. */
  readonly offsetX: number;
  readonly offsetY: number;
}
export interface ParagraphProvider {
  /** Immutable backend/build/font identity. Changing fonts requires a new provider. */
  readonly identity: string;
  prepare(request: ParagraphRequest, context: Readonly<{ signal: CancellationSignal }>): Promise<ParagraphRaster>;
}
export interface ParagraphCacheOptions {
  readonly provider: ParagraphProvider;
  readonly maxEntries?: number;
  readonly maxImageBytes?: number;
  readonly maxPendingJobs?: number;
}
/** The genuine lease may be used by Bitmap; release it once the display retires. */
export interface PreparedParagraph {
  readonly lease: AssetLease<Texture>;
  readonly metrics: ParagraphMetrics;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly density: number;
}
declare const cacheBrand: unique symbol;
export interface ParagraphCache {
  readonly [cacheBrand]: true;
  readonly profile: 'readonly-paragraph-v1';
  acquire(request: ParagraphRequestInput, options?: Readonly<{ signal?: CancellationSignal }>): Promise<PreparedParagraph>;
  /** Retire cached generations without invalidating already borrowed images. */
  invalidate(): void;
  getStatus(): Readonly<{ closed: boolean; generation: number; entries: number; imageBytes: number; pendingJobs: number; callerLeases: number }>;
  dispose(): void;
}
declare const paragraphBrand: unique symbol;
export interface ParagraphStatus {
  readonly state: 'unprepared' | 'ready' | 'disposed';
  readonly desiredRevision: number;
  readonly committedRevision: number | undefined;
  readonly pending: boolean;
  readonly metrics: ParagraphMetrics | undefined;
}
/** Scope-owned, readonly display container. UI bindings prepare it while detached. */
export interface Paragraph extends DisplayObjectContainer {
  readonly [paragraphBrand]: true;
  setRequest(request: ParagraphRequestInput): void;
  prepare(): Promise<ParagraphMetrics>;
  getStatus(): ParagraphStatus;
}
