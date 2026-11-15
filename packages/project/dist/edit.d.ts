import type { ProjectSnapshot, ProjectEditTransaction } from "@egret/contracts";
import type { Prepared } from "./internal.js";
import type { ProjectLimits, ProjectValueResult } from "./public.js";
export declare function applyEdit(head: ProjectSnapshot, command: ProjectEditTransaction, limits: ProjectLimits): ProjectValueResult<Prepared<ProjectSnapshot>>;
//# sourceMappingURL=edit.d.ts.map