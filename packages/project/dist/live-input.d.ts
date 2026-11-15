import type { JsonValue } from "@egret/contracts";
import type { ProjectLimits, ProjectValueResult } from "./public.js";
import type { CanonicalInput, InputKind } from "./internal.js";
export declare const escapePointer: (key: string) => string;
export declare function inputByteCeiling(kind: InputKind, limits: ProjectLimits): number;
export declare function cloneLive(input: unknown, kind: InputKind, limits: ProjectLimits): ProjectValueResult<JsonValue>;
export declare function countNodes(value: CanonicalInput): number;
//# sourceMappingURL=live-input.d.ts.map