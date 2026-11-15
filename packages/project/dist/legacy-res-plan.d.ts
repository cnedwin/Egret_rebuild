import type { LegacyResourceReport } from "./legacy-res-report.js";
export interface LegacyResourceCopyIntent {
    readonly sourcePath: string;
    readonly destinationPath: string;
}
export interface LegacyResourceConversionDeclaration {
    readonly name: string;
    readonly type: "image" | "json";
    readonly fileIndex: number;
}
export interface LegacyResourceConversionGroup {
    readonly name: string;
    readonly resourceIndices: readonly number[];
}
export interface LegacyResourceConversionPlan {
    readonly resourceRoot: string;
    readonly files: readonly LegacyResourceCopyIntent[];
    readonly resources: readonly LegacyResourceConversionDeclaration[];
    readonly groups: readonly LegacyResourceConversionGroup[];
}
export interface LegacyResourceConversionResult {
    readonly planVersion: "0.1";
    readonly scope: "legacy-res-conversion-intents";
    readonly status: "planned" | "unsupported" | "invalid" | "incomplete";
    readonly report: LegacyResourceReport;
    readonly plan: LegacyResourceConversionPlan | null;
}
/** Plan relative copy/reference intents without file I/O or content certification. */
export declare function planLegacyResourceManifestConversion(text: unknown, resourceRoot: unknown): LegacyResourceConversionResult;
//# sourceMappingURL=legacy-res-plan.d.ts.map