// SPDX-License-Identifier: Apache-2.0
import type { CancellationSignal, ImageData2D } from '@egret/contracts';
import type { AssetLease } from '../AssetLease.js';
import type { Texture } from '../Texture.js';
import type { DisplayObjectContainer } from '../DisplayObjectContainer.js';

export type ParagraphTextAffinity = 'upstream' | 'downstream';
export interface ParagraphTextBox {
  readonly left: number; readonly top: number; readonly right: number; readonly bottom: number;
}
export interface ParagraphTextCluster extends ParagraphTextBox {
  readonly start: number; readonly end: number; readonly lineIndex: number;
  readonly direction: 'ltr' | 'rtl';
}
export interface ParagraphTextLine extends ParagraphTextBox {
  readonly start: number; readonly end: number;
}
/** Provider data is copied before it acquires cache or committed-display authority. */
export interface ParagraphTextGeometryData {
  readonly lines: readonly ParagraphTextLine[];
  readonly clusters: readonly ParagraphTextCluster[];
}
export interface ParagraphTextCaret {
  readonly offset: number; readonly affinity: ParagraphTextAffinity; readonly lineIndex: number;
  readonly x: number; readonly top: number; readonly bottom: number;
}
export interface ParagraphTextHit extends ParagraphTextCaret { readonly inside: boolean; }
export interface ParagraphTextSelection extends ParagraphTextBox {
  readonly start: number; readonly end: number; readonly lineIndex: number;
  readonly direction: 'ltr' | 'rtl';
}
/** Detached logical coordinates, independent of raster guards and density. */
export interface ParagraphTextGeometry extends ParagraphTextGeometryData {
  readonly text: string;
  readonly storageBytes: number;
  hitTest(x: number, y: number): ParagraphTextHit | undefined;
  getCaret(offset: number, affinity?: ParagraphTextAffinity): ParagraphTextCaret | undefined;
  getSelectionRects(start: number, end: number): readonly ParagraphTextSelection[];
}

export type ParagraphTextAlign = 'left' | 'right' | 'center' | 'start' | 'end' | 'justify';
/** Explicit opt-in: older providers continue to accept the original requests. */
export interface ParagraphProviderCapabilities {
  readonly textAlign?: boolean;
  readonly textGeometry?: boolean;
  readonly maxLines?: boolean;
}
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
  /** Omission preserves physical left alignment; start/end follow base direction. */
  readonly textAlign?: ParagraphTextAlign;
  /** At most this many lines; overflowing text uses the fixed U+2026 marker. */
  readonly maxLines?: number;
  /** Opt in to source hit/selection/caret geometry; omission keeps the old cache key. */
  readonly textGeometry?: boolean;
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
  /** Present for a maxLines request; observed from the prepared native layout. */
  readonly truncated?: boolean;
}
export interface ParagraphRaster {
  readonly metrics: ParagraphMetrics;
  readonly geometry?: ParagraphTextGeometryData;
  readonly image: ImageData2D | undefined;
  /** Logical placement of the density-scaled image, including signed ink bearings. */
  readonly offsetX: number;
  readonly offsetY: number;
}
export interface ParagraphProvider {
  /** Immutable backend/build/font identity. Changing fonts requires a new provider. */
  readonly identity: string;
  readonly capabilities?: ParagraphProviderCapabilities;
  prepare(request: ParagraphRequest, context: Readonly<{ signal: CancellationSignal }>): Promise<ParagraphRaster>;
}
export interface ParagraphCacheOptions {
  readonly provider: ParagraphProvider;
  readonly maxEntries?: number;
  readonly maxImageBytes?: number;
  /** Logical metadata accounting; independent from raster image bytes. */
  readonly maxGeometryBytes?: number;
  readonly maxPendingJobs?: number;
}
/** The genuine lease may be used by Bitmap; release it once the display retires. */
export interface PreparedParagraph {
  readonly lease: AssetLease<Texture>;
  readonly geometry?: ParagraphTextGeometry;
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
  getStatus(): Readonly<{ closed: boolean; generation: number; entries: number; imageBytes: number; geometryBytes: number; pendingJobs: number; callerLeases: number }>;
  dispose(): void;
}
declare const paragraphBrand: unique symbol;
export interface ParagraphStatus {
  readonly state: 'unprepared' | 'ready' | 'disposed';
  readonly desiredRevision: number;
  readonly committedRevision: number | undefined;
  readonly pending: boolean;
  readonly metrics: ParagraphMetrics | undefined;
  readonly geometry?: ParagraphTextGeometry;
}
/** Scope-owned, readonly display container. UI bindings prepare it while detached. */
export interface Paragraph extends DisplayObjectContainer {
  readonly [paragraphBrand]: true;
  setRequest(request: ParagraphRequestInput): void;
  prepare(): Promise<ParagraphMetrics>;
  getStatus(): ParagraphStatus;
}
