import type { ParagraphRequestInput, ParagraphRequest, ParagraphRaster } from './types.js';
/** Snapshot caller values before queueing: later request/style mutations have no authority. */
export declare function snapshotParagraphRequest(input: ParagraphRequestInput): ParagraphRequest;
/** Own public metrics; provider memory or mutable arrays never become committed UI state. */
export declare function snapshotParagraphRaster(value: ParagraphRaster, request: ParagraphRequest): ParagraphRaster;
//# sourceMappingURL=request.d.ts.map