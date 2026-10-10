import type { JsonValue, JsonObject } from "@egret/contracts";
import type { ProjectDiagnostic, ProjectDiagnosticCode } from "./public.js";
import { utf8Length } from "./unicode.js";
import type { ShapeNodeFailure } from "./internal.js";
import type { FormatNode } from "./format-shape.generated.js";
import { resolveFormatNode } from "./shape.js";

function boundedString(text: string, ceiling: number): string {
  let bytes = 0, end = 0;
  for (const c of text) {
    const length = utf8Length(c);
    if (!length.ok || bytes + length.value > ceiling) break;
    bytes += length.value; end += c.length;
  }
  return text.slice(0, end);
}

// Only checked data descriptors are copied. Oversized/hostile detail trees become a
// small summary rather than a partially copied source value.
function safeDetails(input: JsonObject): JsonObject {
  let bytes = 0;
  const ancestors = new Set<object>();
  function copy(value: unknown, depth: number): JsonValue {
    if (depth > 16) throw 0;
    if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
      if (typeof value === "number" && !Number.isFinite(value)) throw 0;
      if (typeof value === "string" && !utf8Length(value).ok) throw 0;
      const spelling = JSON.stringify(value);
      const n = utf8Length(spelling);
      if (!n.ok || (bytes += n.value) > 4000) throw 0;
      return value;
    }
    if (typeof value !== "object" || ancestors.has(value)) throw 0;
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== null && prototype !== Object.prototype) throw 0;
    ancestors.add(value);
    const out: JsonValue[] | Record<string, JsonValue> = array ? [] : Object.create(null);
    const keys = Reflect.ownKeys(value);
    bytes += 2;
    let index = 0;
    for (const key of keys) {
      if (array && key === "length") continue;
      if (typeof key !== "string") throw 0;
      if (!utf8Length(key).ok) throw 0;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw 0;
      if (array && key !== String(index)) throw 0;
      if (index++) bytes++;
      if (!array) {
        const n = utf8Length(JSON.stringify(key));
        if (!n.ok) throw 0;
        bytes += n.value + 1;
      }
      if (bytes > 4000) throw 0;
      const child = copy(descriptor.value, depth + 1);
      if (array) (out as JsonValue[]).push(child); else (out as Record<string, JsonValue>)[key] = child;
    }
    if (array && Object.getOwnPropertyDescriptor(value, "length")?.value !== index) throw 0;
    ancestors.delete(value);
    return Object.freeze(out);
  }
  try { return copy(input, 1) as JsonObject; }
  catch { return Object.freeze(Object.assign(Object.create(null), { detailsTruncated: true })); }
}

export function makeDiagnostic(input: ProjectDiagnostic): ProjectDiagnostic {
  let pointer = "";
  if (input.jsonPointer.startsWith("/")) {
    for (const segment of input.jsonPointer.slice(1).split("/")) {
      if (/~(?![01])/u.test(segment)) break;
      const next = pointer + "/" + segment;
      const n = utf8Length(next);
      if (!n.ok || n.value > 1024) break;
      pointer = next;
    }
  }
  const details: Record<string, JsonValue> = Object.assign(Object.create(null), safeDetails(input.details));
  if (pointer !== input.jsonPointer) details.pointerTruncated = true;
  const diagnostic: ProjectDiagnostic = {
    code: input.code, phase: input.phase, severity: input.severity, jsonPointer: pointer,
    message: boundedString(input.message, 1024), details: Object.freeze(details)
  };
  // Optional identifiers are metadata, never arbitrary source strings.
  const optional: Record<string, unknown> = {};
  for (const key of ["projectId", "entityId", "fileId", "transactionId"] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (descriptor && "value" in descriptor && typeof descriptor.value === "string" && /^[A-Za-z0-9_-]{3,128}$/u.test(descriptor.value)) optional[key] = descriptor.value;
  }
  for (const key of ["revision", "operationIndex"] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (descriptor && "value" in descriptor && Number.isSafeInteger(descriptor.value) && descriptor.value >= 0 && !Object.is(descriptor.value, -0)) optional[key] = descriptor.value;
  }
  return Object.freeze(Object.assign(diagnostic, optional));
}

export function inputDiagnostic(code: ProjectDiagnosticCode, pointer = "", message = "Input is not supported JSON."): ProjectDiagnostic {
  return makeDiagnostic({ code, phase: "parse", severity: "error", jsonPointer: pointer, message, details: Object.create(null) });
}

export function mapShapeFailure(failure: ShapeNodeFailure, node: FormatNode, jsonPointer: string): ProjectDiagnostic {
  const resolved = resolveFormatNode(node);
  return makeDiagnostic({
    code: failure.reason === "const" && resolved.projectCheck === "fixed-version" ? "PROJECT_FORMAT_UNSUPPORTED" : "PROJECT_INPUT_INVALID",
    phase: "schema", severity: "error", jsonPointer,
    message: "Project field does not match its declared format.", details: { reason: failure.reason }
  });
}
