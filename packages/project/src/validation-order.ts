import type { JsonValue } from "@egret/contracts";
import type { FormatRoot, ValidationContext } from "./internal.js";
import type { ProjectDiagnostic, ProjectDiagnosticCode, ProjectValueResult } from "./public.js";
import { FORMAT_DEFINITIONS } from "./format-shape.generated.js";
import type { FormatNode } from "./format-shape.generated.js";
import { inspectShapeNode, matchesNodeType, resolveFormatNode } from "./shape.js";
import { makeDiagnostic, mapShapeFailure } from "./diagnostics.js";
import { escapePointer } from "./live-input.js";
import { utf8Length } from "./unicode.js";
import { isPortablePath } from "./paths.js";

export function validationDiagnostic(code: ProjectDiagnosticCode, pointer: string, phase: ProjectDiagnostic["phase"] = "schema", details: { readonly [key: string]: JsonValue } = {}): ProjectDiagnostic {
  return makeDiagnostic({ code, phase, severity: "error", jsonPointer: pointer, message: "Project validation failed.", details });
}

type Scheduled = { readonly value: JsonValue; readonly index: number; readonly key: string | undefined };
export function identitySchedule(values: readonly JsonValue[], records: boolean): readonly Scheduled[] {
  const schedule = values.map((value, index) => {
    const descriptor = records && value !== null && typeof value === "object" && !Array.isArray(value) ? Object.getOwnPropertyDescriptor(value, "id") : undefined;
    const key = records ? descriptor && "value" in descriptor && typeof descriptor.value === "string" ? descriptor.value : undefined : typeof value === "string" ? value : undefined;
    return { value, index, key };
  });
  schedule.sort((a, b) => a.key === undefined ? b.key === undefined ? a.index - b.index : 1 : b.key === undefined ? -1 : a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index);
  return schedule;
}

function checkProjectNode(value: JsonValue, node: FormatNode, context: ValidationContext, jsonPointer: string): ProjectDiagnostic | undefined {
  const check = node.projectCheck;
  if (check === "safe-integer") {
    const token = context.numericTokens?.get(jsonPointer);
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)
      || token && (!token.integerSafe || token.negativeZero)) return validationDiagnostic("PROJECT_LIMIT_EXCEEDED", jsonPointer);
  } else if (typeof value === "number" && !Number.isFinite(value)) return validationDiagnostic("PROJECT_INPUT_INVALID", jsonPointer);
  if (typeof value !== "string") return undefined;
  if (check === "project-id" || check === "entity-id" || check === "file-id" || check === "transaction-id") {
    const prefix = check === "project-id" ? "p" : check === "entity-id" ? "e" : check === "file-id" ? "f" : "t";
    if (value.length > 128 || !new RegExp("^" + prefix + "_[A-Za-z0-9][A-Za-z0-9_-]*$", "u").test(value)) return validationDiagnostic("PROJECT_ID_INVALID", jsonPointer);
    return undefined;
  }
  if (check === "path") return isPortablePath(value) ? undefined : validationDiagnostic("PROJECT_PATH_INVALID", jsonPointer);
  if (node.schemaPointer === "#/$defs/Sha256") return /^[a-f0-9]{64}$/u.test(value) ? undefined : validationDiagnostic("PROJECT_INPUT_INVALID", jsonPointer);
  // These are domain string constraints only. Shape, enum, requiredness and
  // declaration order remain entirely in generated descriptors.
  const field = node.schemaPointer.split("/properties/")[1];
  const constrained = field === "name" || field === "kind" || field === "expectedKind" || field === "dataSchemaVersion"
    || field === "engineVersion" || field === "resourceFormatVersion" || field === "slot" || field === "actorId"
    || field === "toolId" || field === "toolVersion" || field === "intent" || field === "mediaType";
  if (!constrained) return undefined;
  const bytes = utf8Length(value);
  const maximum = field === "name" ? 256 : field === "intent" ? 1024 : 128;
  const minimum = field === "name" || field === "intent" ? 0 : 1;
  if (!bytes.ok || bytes.value < minimum || bytes.value > maximum || /[\u0000-\u001f\u007f]/u.test(value)
    || field === "mediaType" && /[^\u0021-\u007e]/u.test(value)) return validationDiagnostic("PROJECT_INPUT_INVALID", jsonPointer);
  return undefined;
}

function samePrefixNode(a: FormatNode, b: FormatNode): boolean {
  return a.type === b.type && a.ref === b.ref && a.const === b.const && a.projectCheck === b.projectCheck
    && JSON.stringify(a.enum) === JSON.stringify(b.enum);
}

function collectionKind(node: FormatNode): "record" | "set" | undefined {
  const pointer = node.schemaPointer;
  if (pointer === "#/$defs/ProjectSnapshot/properties/entities" || pointer === "#/$defs/ProjectSnapshot/properties/files") return "record";
  if (pointer === "#/$defs/ProjectSnapshot/properties/retiredEntityIds" || pointer === "#/$defs/ProjectSnapshot/properties/retiredFileIds"
    || pointer === "#/$defs/ProjectTransactionScope/properties/entityIds" || pointer === "#/$defs/ProjectTransactionScope/properties/fileIds") return "set";
  return undefined;
}

export function validateOrdered(value: JsonValue, root: FormatRoot, context: ValidationContext): ProjectValueResult<JsonValue> {
  const sentinel = {};
  let failure: ProjectDiagnostic | undefined;
  const reject = (diagnostic: ProjectDiagnostic): never => { failure = diagnostic; throw sentinel; };
  const probe = (candidate: JsonValue | undefined, node: FormatNode, pointer: string): void => {
    const shape = inspectShapeNode(candidate, node, pointer);
    if (!shape.ok) reject(mapShapeFailure(shape, node, pointer));
    const semantic = checkProjectNode(candidate!, resolveFormatNode(node), context, pointer);
    if (semantic) reject(semantic);
  };
  const visit = (candidate: JsonValue | undefined, descriptor: FormatNode, pointer: string): JsonValue => {
    let node = resolveFormatNode(descriptor);
    probe(candidate, node, pointer);
    if (node.oneOf) {
      const branches = node.oneOf.map(resolveFormatNode).filter(branch => matchesNodeType(candidate!, branch));
      const objectBranches = branches.filter(branch => branch.type === "object" && branch.properties);
      if (objectBranches.length > 1) {
        const first = objectBranches[0]!;
        const fields = first.properties!;
        let discriminator = -1;
        for (let index = 0; index < fields.length; index++) {
          const field = fields[index]!;
          if (objectBranches.every(branch => branch.properties?.[index]?.name === field.name && branch.properties[index]!.node.const !== undefined)
            && objectBranches.some(branch => branch.properties![index]!.node.const !== field.node.const)) { discriminator = index; break; }
          if (!objectBranches.every(branch => branch.properties?.[index]?.name === field.name && samePrefixNode(branch.properties[index]!.node, field.node))) break;
        }
        if (discriminator >= 0) {
          const object = candidate as { readonly [key: string]: JsonValue };
          node = objectBranches.find(branch => object[fields[discriminator]!.name] === branch.properties![discriminator]!.node.const) ?? first;
          const out: Record<string, JsonValue> = Object.create(null);
          // Preserve earlier common-prefix semantics before discriminator/closure.
          for (let index = 0; index <= discriminator; index++) {
            const field = node.properties![index]!;
            out[field.name] = visit(object[field.name], field.node, pointer + "/" + escapePointer(field.name));
          }
          probe(candidate, node, pointer);
          for (const field of node.properties!.slice(discriminator + 1)) out[field.name] = visit(object[field.name], field.node, pointer + "/" + escapePointer(field.name));
          return Object.freeze(out);
        }
      }
      node = branches[0]!;
      return visit(candidate, node, pointer);
    }
    if (node.type === "array") {
      const array = candidate as readonly JsonValue[];
      const kind = collectionKind(node);
      const schedule = kind ? identitySchedule(array, kind === "record") : array.map((child, index) => ({ value: child, index }));
      return Object.freeze(schedule.map(item => visit(item.value, node.items!, pointer + "/" + item.index)));
    }
    if (node.type === "object") {
      const object = candidate as { readonly [key: string]: JsonValue };
      const out: Record<string, JsonValue> = Object.create(null);
      for (const field of node.properties ?? []) {
        if (!field.required && !Object.hasOwn(object, field.name)) continue;
        out[field.name] = visit(object[field.name], field.node, pointer + "/" + escapePointer(field.name));
      }
      if (node.additionalProperties && typeof node.additionalProperties === "object") {
        for (const key of Object.keys(object).sort()) out[key] = visit(object[key], node.additionalProperties, pointer + "/" + escapePointer(key));
      }
      return Object.freeze(out);
    }
    return typeof candidate === "number" && Object.is(candidate, -0) ? 0 : candidate!;
  };
  try { return Object.freeze({ ok: true, value: visit(value, FORMAT_DEFINITIONS[root], context.pointerPrefix), diagnostics: Object.freeze([]) }); }
  catch (error) {
    if (error !== sentinel) throw error;
    return Object.freeze({ ok: false, diagnostics: Object.freeze([failure!]) });
  }
}
