import type { ProjectDiagnostic, ProjectDiagnosticCode } from "./public.js";
import type { ShapeNodeFailure } from "./internal.js";
import type { FormatNode } from "./format-shape.generated.js";
export declare function makeDiagnostic(input: ProjectDiagnostic): ProjectDiagnostic;
export declare function inputDiagnostic(code: ProjectDiagnosticCode, pointer?: string, message?: string): ProjectDiagnostic;
export declare function mapShapeFailure(failure: ShapeNodeFailure, node: FormatNode, jsonPointer: string): ProjectDiagnostic;
//# sourceMappingURL=diagnostics.d.ts.map