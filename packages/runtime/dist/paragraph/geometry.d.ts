import type { ParagraphMetrics, ParagraphRequest, ParagraphTextGeometry, ParagraphTextGeometryData } from './types.js';
/** Copy native/source geometry once; subsequent queries retain no provider/native object. */
export declare function snapshotParagraphTextGeometry(data: ParagraphTextGeometryData, request: ParagraphRequest, metrics: ParagraphMetrics): ParagraphTextGeometry;
//# sourceMappingURL=geometry.d.ts.map