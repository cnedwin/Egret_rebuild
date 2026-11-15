/** Internal CPU conversion intent; never loads, decodes or certifies an atlas. */
export type LegacyMovieClipConversionStatus = 'planned' | 'invalid' | 'unsupported' | 'incomplete';
export type LegacyMovieClipDiagnosticCode = 'LEGACY_MOVIECLIP_INPUT_INVALID' | 'LEGACY_MOVIECLIP_SYNTAX_INVALID' | 'LEGACY_MOVIECLIP_LIMIT_EXCEEDED' | 'LEGACY_MOVIECLIP_PATH_INVALID' | 'LEGACY_MOVIECLIP_CLIP_NOT_FOUND' | 'LEGACY_MOVIECLIP_REFERENCE_UNRESOLVED' | 'LEGACY_MOVIECLIP_RATE_INVALID' | 'LEGACY_MOVIECLIP_DURATION_INVALID' | 'LEGACY_MOVIECLIP_REGION_INVALID' | 'LEGACY_MOVIECLIP_TIME_INVALID' | 'LEGACY_MOVIECLIP_SCHEMA_UNSUPPORTED' | 'LEGACY_MOVIECLIP_FEATURE_UNSUPPORTED' | 'LEGACY_MOVIECLIP_INTERNAL_FAILED';
export interface LegacyMovieClipDiagnostic {
    readonly code: LegacyMovieClipDiagnosticCode;
    readonly source: 'text' | 'clipName' | 'atlasPath' | 'atlasWidth' | 'atlasHeight';
    readonly severity: 'error' | 'warning';
    readonly jsonPointer: string;
    readonly message: string;
}
export interface LegacyMovieClipSequenceFrame {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly durationSeconds: number;
}
export interface LegacyMovieClipSequenceInput {
    readonly atlasWidth: number;
    readonly atlasHeight: number;
    readonly frames: readonly LegacyMovieClipSequenceFrame[];
}
export interface LegacyMovieClipHold {
    readonly resourceName: string;
    readonly offsetX: number;
    readonly offsetY: number;
    readonly firstLegacyFrame: number;
    readonly durationFrames: number;
}
export interface LegacyMovieClipConversionPlan {
    readonly clipName: string;
    readonly atlasPath: string;
    readonly totalLegacyFrames: number;
    readonly sequenceInput: LegacyMovieClipSequenceInput;
    readonly holds: readonly LegacyMovieClipHold[];
}
export interface LegacyMovieClipConversionResult {
    readonly planVersion: '0.1';
    readonly profile: 'legacy-movieclip-single-atlas-0.1';
    readonly status: LegacyMovieClipConversionStatus;
    readonly diagnostics: readonly LegacyMovieClipDiagnostic[];
    readonly acceptance: {
        readonly fileExistence: 'unverified';
        readonly decoding: 'unverified';
        readonly execution: 'unverified';
        readonly migration: 'unverified';
    };
    readonly plan: LegacyMovieClipConversionPlan | null;
}
/** Plan one named clip using declared atlas dimensions, without input execution. */
export declare function planLegacyMovieClipConversion(text: unknown, clipName: unknown, atlasPath: unknown, atlasWidth: unknown, atlasHeight: unknown): LegacyMovieClipConversionResult;
//# sourceMappingURL=legacy-movieclip-plan.d.ts.map