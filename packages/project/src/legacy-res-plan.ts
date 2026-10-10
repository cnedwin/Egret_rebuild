import { analyzeLegacyResourceManifest } from "./legacy-res-report.js";
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
export function planLegacyResourceManifestConversion(text: unknown, resourceRoot: unknown): LegacyResourceConversionResult {
  // Provenance comes from this one internal producer call. Caller-shaped reports
  // are never accepted; existing analyzer admission and diagnostics keep precedence.
  const report = analyzeLegacyResourceManifest(text, resourceRoot);
  if (report.status !== "recognized") {
    return Object.freeze({ planVersion: "0.1", scope: "legacy-res-conversion-intents",
      status: report.status, report, plan: null });
  }
  if (typeof report.resourceRoot !== "string") throw new Error("LEGACY_RES_PLAN_INVARIANT");

  const files: LegacyResourceCopyIntent[] = [];
  const resources: LegacyResourceConversionDeclaration[] = [];
  const groups: LegacyResourceConversionGroup[] = [];
  const fileIndices = new Map<string, number>();
  const resourceIndices = new Map<string, number>();
  for (const resource of report.resources) {
    const path = resource.projectPath;
    const type = resource.type;
    if (path === null || (type !== "image" && type !== "json")) throw new Error("LEGACY_RES_PLAN_INVARIANT");
    let fileIndex = fileIndices.get(path);
    if (fileIndex === undefined) {
      fileIndex = files.length;
      fileIndices.set(path, fileIndex);
      // These equal relative names belong to separate original/output project
      // roots. They grant no overwrite, symlink-containment or decoding authority.
      files.push(Object.freeze({ sourcePath: path, destinationPath: path }));
    }
    resourceIndices.set(resource.name, resources.length);
    resources.push(Object.freeze({ name: resource.name, type, fileIndex }));
  }
  for (const group of report.groups) {
    const indices: number[] = [];
    for (const declaration of group.declaredKeys) {
      const index = resourceIndices.get(declaration.key);
      if (index === undefined) throw new Error("LEGACY_RES_PLAN_INVARIANT");
      // Preserve authored duplicates and order; admitted keys need no second split.
      indices.push(index);
    }
    groups.push(Object.freeze({ name: group.name, resourceIndices: Object.freeze(indices) }));
  }
  // Publish only after every record/reference is prepared. Allocation failures
  // may escape; no partial plan or manufactured analyzer report is returned.
  const plan = Object.freeze({ resourceRoot: report.resourceRoot, files: Object.freeze(files),
    resources: Object.freeze(resources), groups: Object.freeze(groups) });
  return Object.freeze({ planVersion: "0.1", scope: "legacy-res-conversion-intents",
    status: "planned", report, plan });
}
