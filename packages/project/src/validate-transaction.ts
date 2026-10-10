import type { JsonValue, ProjectTransaction } from "@egret/contracts";
import type { Prepared, ValidationContext } from "./internal.js";
import type { ProjectDiagnostic, ProjectValueResult } from "./public.js";
import { identitySchedule, validateOrdered, validationDiagnostic } from "./validation-order.js";
import { prepareCanonical } from "./canonical.js";
import { makeDiagnostic } from "./diagnostics.js";

// Generated ordered validation owns selected shape and scalar errors first.
// This port then checks collection integrity and local command bounds; retry,
// CAS, direct scope meaning, lifecycle and final targets belong to commit.
export function validateTransaction(value: JsonValue, context: ValidationContext): ProjectValueResult<Prepared<ProjectTransaction>> {
  const ordered = validateOrdered(value, "ProjectTransaction", context);
  if (!ordered.ok) return ordered;
  const transaction = ordered.value as unknown as ProjectTransaction;
  const prefix = context.pointerPrefix;
  const failed = (diagnostic: ProjectDiagnostic): ProjectValueResult<Prepared<ProjectTransaction>> => Object.freeze({ ok: false, diagnostics: Object.freeze([diagnostic]) });
  let entityCount = 0, fileCount = 0;
  if (transaction.command === "edit") {
    const original = value as { readonly [key: string]: JsonValue };
    const scope = original.scope as { readonly [key: string]: JsonValue };
    for (const name of ["entityIds", "fileIds"] as const) {
      const seen = new Set<string>();
      for (const entry of identitySchedule(scope[name] as readonly JsonValue[], false)) {
        const id = entry.value as string;
        if (seen.has(id)) return failed(validationDiagnostic("PROJECT_ID_DUPLICATE", prefix + `/scope/${name}/${entry.index}`, "schema", { reason: `scope.${name}` }));
        seen.add(id);
      }
    }
    if (transaction.operations.length === 0) return failed(validationDiagnostic("PROJECT_INPUT_INVALID", prefix + "/operations"));
    for (let index = 0; index < transaction.operations.length; index++) {
      const operation = transaction.operations[index]!;
      if (operation.op === "putEntity") {
        entityCount++;
        const slots = new Set<string>();
        for (let refIndex = 0; refIndex < operation.entity.references.length; refIndex++) {
          const slot = operation.entity.references[refIndex]!.slot;
          if (slots.has(slot)) return failed(validationDiagnostic("PROJECT_ID_DUPLICATE", prefix + `/operations/${index}/entity/references/${refIndex}/slot`, "schema", { reason: "slots" }));
          slots.add(slot);
        }
      } else if (operation.op === "putFile") fileCount++;
      else if (operation.op === "setRoots") {
        const roots = new Set<string>();
        for (let rootIndex = 0; rootIndex < operation.roots.length; rootIndex++) {
          const id = operation.roots[rootIndex]!;
          if (roots.has(id)) return failed(validationDiagnostic("PROJECT_ID_DUPLICATE", prefix + `/operations/${index}/roots/${rootIndex}`, "schema", { reason: "roots" }));
          roots.add(id);
        }
      }
    }
    if (transaction.operations.length > context.limits.maxOperationsPerTransaction) return failed(validationDiagnostic("PROJECT_LIMIT_EXCEEDED", prefix + "/operations"));
    for (let index = 0; index < transaction.operations.length; index++) {
      const operation = transaction.operations[index]!;
      if (operation.op === "putEntity" && operation.entity.references.length > context.limits.maxReferencesPerEntity) return failed(validationDiagnostic("PROJECT_LIMIT_EXCEEDED", prefix + `/operations/${index}/entity/references`));
    }
  }
  const prepared = prepareCanonical(transaction);
  if (prepared.utf8Bytes > context.limits.maxTransactionUtf8Bytes) return failed(validationDiagnostic("PROJECT_LIMIT_EXCEEDED", prefix));
  const diagnostics: ProjectDiagnostic[] = [];
  if (entityCount) diagnostics.push(makeDiagnostic({ code: "PROJECT_KIND_UNCHECKED", phase: "schema", severity: "warning", jsonPointer: prefix + "/operations", message: "Entity domain data was not checked.", details: { count: entityCount } }));
  if (fileCount) diagnostics.push(makeDiagnostic({ code: "PROJECT_CONTENT_UNVERIFIED", phase: "schema", severity: "warning", jsonPointer: prefix + "/operations", message: "File content was not verified.", details: { count: fileCount } }));
  return Object.freeze({ ok: true, value: prepared, diagnostics: Object.freeze(diagnostics) });
}
