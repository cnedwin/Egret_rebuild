import { EgretError } from '../EgretError.js';
import type { TextRasterRequest, TextRasterRequestInput } from './types.js';
declare const invocationBrand: unique symbol;
declare const snapshotBrand: unique symbol;
declare const summaryBrand: unique symbol;
/** Private operation identity; a public error code never supplies this authority. */
export interface TextValueInvocation {
    readonly [invocationBrand]: true;
}
export type TextValueFailureCode = 'TEXT_REQUEST_INVALID' | 'TEXT_REQUEST_LIMIT' | 'TEXT_PLAN_INVALID' | 'TEXT_PLAN_ALREADY_CREATED' | 'TEXT_PLAN_SCOPE_CLOSED' | 'TEXT_CACHE_BUDGET' | 'TEXT_COUNTER_EXHAUSTED';
export interface TextValueFailure {
    readonly code: TextValueFailureCode;
    readonly error: EgretError;
}
export interface TextRasterRequestSnapshot {
    readonly [snapshotBrand]: true;
}
/** A transient scalar proposal. The cache must admit its charge before owned creation. */
export interface TextRasterRequestSummary {
    readonly [summaryBrand]: true;
    readonly sourceCodeUnits: number;
    readonly lineCount: number;
    readonly metadataBytes: number;
}
export declare function createTextValueInvocation(): TextValueInvocation;
export declare function closeTextValueInvocation(value: TextValueInvocation): void;
/** Only fresh first-party creation attaches a note; closed notes cannot be consumed. */
export declare function createTextValueFailure(invocation: TextValueInvocation, code: TextValueFailureCode, cause?: unknown): EgretError;
/** Exact active operation and one consumption; no instanceof/code/cause inspection. */
export declare function takeTextValueFailure(invocation: TextValueInvocation, cause: unknown): TextValueFailure | undefined;
/** Snapshot all ten fields first. The cache performs its post-read lifecycle check next. */
export declare function snapshotTextRasterRequest(input: TextRasterRequestInput, invocation: TextValueInvocation): TextRasterRequestSnapshot;
/** No source-line array, serialized key or resource identity is created here. */
export declare function summarizeTextRasterRequest(snapshot: TextRasterRequestSnapshot, providerIdentity: string, fontGeneration: number, invocation: TextValueInvocation): TextRasterRequestSummary;
/** Project validated field scalars without granting cache request/plan authority. */
export declare function createTextFieldRequestInput(summary: TextRasterRequestSummary, invocation: TextValueInvocation): TextRasterRequestInput;
/** Call only after the cache commits the summary's exact generation metadata charge. */
export declare function createOwnedTextRasterRequest(summary: TextRasterRequestSummary, invocation: TextValueInvocation): TextRasterRequest;
export declare function isOwnedTextRasterRequest(value: unknown): value is TextRasterRequest;
export declare function requireOwnedTextRasterRequest(value: unknown, invocation: TextValueInvocation): TextRasterRequest;
/** Bounded route lookup compares authenticated normalized scalars without allocating a key. */
export declare function matchesTextRasterRequestSummary(request: TextRasterRequest, summary: TextRasterRequestSummary, providerIdentity: string, fontGeneration: number): boolean;
export {};
//# sourceMappingURL=request.d.ts.map