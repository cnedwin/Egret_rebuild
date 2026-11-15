type LegacyResourceReportStatus = "recognized" | "unsupported" | "invalid" | "incomplete";
type LegacyResourceDiagnosticCode = "LEGACY_RES_INPUT_INVALID" | "LEGACY_RES_SYNTAX_INVALID" | "LEGACY_RES_LIMIT_EXCEEDED" | "LEGACY_RES_NAME_DUPLICATE" | "LEGACY_RES_PATH_INVALID" | "LEGACY_RES_PATH_COLLISION" | "LEGACY_RES_SCHEMA_UNSUPPORTED" | "LEGACY_RES_TYPE_UNSUPPORTED" | "LEGACY_RES_URL_UNSUPPORTED" | "LEGACY_RES_SUBKEYS_UNSUPPORTED" | "LEGACY_RES_SCALE9GRID_UNSUPPORTED" | "LEGACY_RES_REFERENCE_UNRESOLVED" | "LEGACY_RES_INTERNAL_FAILED";
interface LegacyResourceDiagnostic {
    readonly code: LegacyResourceDiagnosticCode;
    readonly source: "text" | "resourceRoot";
    readonly severity: "error" | "warning";
    readonly jsonPointer: string;
    readonly message: string;
}
interface LegacyResourceDeclaration {
    readonly name: string;
    readonly type: string;
    readonly url: string;
    readonly projectPath: string | null;
    readonly structuralStatus: "recognized" | "unsupported";
    readonly subkeys?: string;
    readonly scale9grid?: string;
}
interface LegacyResourceKeyDeclaration {
    readonly key: string;
    readonly relation: "resource" | "unresolved";
}
interface LegacyResourceGroupDeclaration {
    readonly name: string;
    readonly keys: string;
    readonly declaredKeys: readonly LegacyResourceKeyDeclaration[];
}
interface LegacyResourceReport {
    readonly reportVersion: "0.1";
    readonly scope: "legacy-res-declarations";
    readonly profile: "legacy-res-comma-declarations-0.1";
    readonly status: LegacyResourceReportStatus;
    readonly resourceRoot: string | null;
    readonly originalText: string | null;
    readonly resources: readonly LegacyResourceDeclaration[];
    readonly groups: readonly LegacyResourceGroupDeclaration[];
    readonly diagnostics: readonly LegacyResourceDiagnostic[];
    readonly acceptance: {
        readonly fileExistence: "unverified";
        readonly decoding: "unverified";
        readonly execution: "unverified";
        readonly migration: "unverified";
    };
}
type LegacyResourceJSONResult = {
    readonly status: "ok";
    readonly value: unknown;
} | {
    readonly status: "invalid" | "incomplete";
    readonly diagnostic: LegacyResourceDiagnostic;
};
export type { LegacyResourceReportStatus, LegacyResourceDiagnosticCode, LegacyResourceDiagnostic, LegacyResourceDeclaration, LegacyResourceKeyDeclaration, LegacyResourceGroupDeclaration, LegacyResourceReport, LegacyResourceJSONResult };
export declare function analyzeLegacyResourceManifest(text: unknown, resourceRoot: unknown): LegacyResourceReport;
//# sourceMappingURL=legacy-res-report.d.ts.map