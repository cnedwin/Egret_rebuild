import type { JsonValue } from "@egret/contracts";
import type { FormatRoot, ValidationContext } from "./internal.js";
import type { ProjectDiagnostic, ProjectDiagnosticCode, ProjectValueResult } from "./public.js";
export declare function validationDiagnostic(code: ProjectDiagnosticCode, pointer: string, phase?: ProjectDiagnostic["phase"], details?: {
    readonly [key: string]: JsonValue;
}): ProjectDiagnostic;
type Scheduled = {
    readonly value: JsonValue;
    readonly index: number;
    readonly key: string | undefined;
};
export declare function identitySchedule(values: readonly JsonValue[], records: boolean): readonly Scheduled[];
export declare function validateOrdered(value: JsonValue, root: FormatRoot, context: ValidationContext): ProjectValueResult<JsonValue>;
export {};
//# sourceMappingURL=validation-order.d.ts.map