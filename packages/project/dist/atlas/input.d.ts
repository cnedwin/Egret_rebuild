import type { AtlasImportDiagnosticCode, AtlasSourceSpan, AtlasTextSource, AtlasPageBinding, AtlasImportLimits } from './types.js';
export declare const ATLAS_IMPORT_LIMITS: Readonly<AtlasImportLimits>;
export interface PlanningContext {
    readonly fail: (code: AtlasImportDiagnosticCode, source: 'input' | 'metadata', pointer: string, span?: AtlasSourceSpan, relatedSpan?: AtlasSourceSpan) => never;
    readonly readFailure: (pointer: string, cause: unknown) => never;
}
export interface CapturedInput {
    readonly profile: string;
    readonly source: AtlasTextSource;
    readonly page: AtlasPageBinding;
}
export declare function portablePng(value: string): boolean;
export declare function captureInput(context: PlanningContext, value: unknown): CapturedInput;
//# sourceMappingURL=input.d.ts.map