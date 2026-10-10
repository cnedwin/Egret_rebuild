import type { JsonValue } from "@egret/contracts";
import type { ProjectLimits, ProjectValueResult, ProjectDiagnosticCode } from "./public.js";
import type { CanonicalInput, InputKind } from "./internal.js";
import { inputDiagnostic } from "./diagnostics.js";
import { utf8Length } from "./unicode.js";

export const escapePointer = (key: string): string => key.replace(/~/gu, "~0").replace(/\//gu, "~1");
export function inputByteCeiling(kind: InputKind, limits: ProjectLimits): number {
  return kind === "history" ? limits.maxHistoryUtf8Bytes : kind === "snapshot" ? limits.maxSnapshotUtf8Bytes : limits.maxTransactionUtf8Bytes;
}

function fixedHistory(input: unknown): boolean {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const keys = Reflect.ownKeys(input);
  if (keys.length !== 3 || !["historySchemaVersion", "baseline", "transactions"].every(key => keys.includes(key))) return false;
  const version = Object.getOwnPropertyDescriptor(input, "historySchemaVersion");
  const baseline = Object.getOwnPropertyDescriptor(input, "baseline");
  const transactions = Object.getOwnPropertyDescriptor(input, "transactions");
  return !!version && "value" in version && typeof version.value === "string" && !!baseline && "value" in baseline && !!transactions && "value" in transactions && Array.isArray(transactions.value);
}

// Descriptor-only traversal. Budgets charge each expanded occurrence before
// allocating its clone, while ancestors (not a global visited set) detect cycles.
export function cloneLive(input: unknown, kind: InputKind, limits: ProjectLimits): ProjectValueResult<JsonValue> {
  const sentinel = {};
  let failure = inputDiagnostic("PROJECT_INPUT_INVALID");
  const fail: (code: ProjectDiagnosticCode, pointer: string, message: string) => never = (code, pointer, message) => {
    failure = inputDiagnostic(code, pointer, message); throw sentinel;
  };
  const ancestors = new Set<object>();
  let wholeBytes = 0;
  type Budget = { bytes: number; ceiling: number };
  const charge = (bytes: number, pointer: string, local?: Budget): void => {
    wholeBytes += bytes;
    if (local) local.bytes += bytes;
    if (wholeBytes > inputByteCeiling(kind, limits) || local && local.bytes > local.ceiling) fail("PROJECT_LIMIT_EXCEEDED", pointer, "Expanded input exceeds its byte limit.");
  };
  const stringBytes = (value: string, pointer: string): number => {
    const raw = utf8Length(value);
    if (!raw.ok) fail("PROJECT_INPUT_INVALID", pointer, "Input contains invalid Unicode.");
    if (raw.value > limits.maxStringUtf8Bytes) fail("PROJECT_LIMIT_EXCEEDED", pointer, "Input string or key exceeds its byte limit.");
    const spelling = utf8Length(JSON.stringify(value));
    if (!spelling.ok) fail("PROJECT_INPUT_INVALID", pointer, "Input contains invalid Unicode.");
    return spelling.value;
  };
  try {
    const history = kind === "history" && fixedHistory(input);
    const copy = (value: unknown, depth: number, pointer: string, local?: Budget): JsonValue => {
      if (history && (pointer === "/baseline" || /^\/transactions\/\d+$/u.test(pointer))) {
        depth = 1; local = { bytes: 0, ceiling: pointer === "/baseline" ? limits.maxSnapshotUtf8Bytes : limits.maxTransactionUtf8Bytes };
      }
      if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
        // Nonfinite values are PRIVATE pending candidates (controller ruling),
        // charged as four bytes and rejected at Task 3's selected number node.
        const bytes = typeof value === "string" ? stringBytes(value, pointer) : typeof value === "number" && !Number.isFinite(value) ? 4 : JSON.stringify(value).length;
        charge(bytes, pointer, local); return value;
      }
      if (typeof value !== "object") fail("PROJECT_INPUT_INVALID", pointer, "Input is not supported JSON.");
      if (depth > limits.maxJsonDepth && !(history && pointer === "/transactions")) fail("PROJECT_LIMIT_EXCEEDED", pointer, "Input exceeds its logical depth limit.");
      if (ancestors.has(value)) fail("PROJECT_INPUT_INVALID", pointer, "Input contains a cycle.");
      const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
      if (array ? prototype !== Array.prototype : prototype !== null && prototype !== Object.prototype) fail("PROJECT_INPUT_INVALID", pointer, "Input has an unsupported prototype.");
      const keys = Reflect.ownKeys(value);
      let length = 0;
      if (array) {
        const descriptor = Object.getOwnPropertyDescriptor(value, "length");
        if (!descriptor || !("value" in descriptor) || !Number.isSafeInteger(descriptor.value) || descriptor.value < 0 || descriptor.enumerable) fail("PROJECT_INPUT_INVALID", pointer, "Input array length is invalid.");
        length = descriptor.value;
        if (keys.length !== length + 1) fail("PROJECT_INPUT_INVALID", pointer, "Input array must have only contiguous data indices.");
      }
      charge(2, pointer, local);
      ancestors.add(value);
      const out: JsonValue[] | Record<string, JsonValue> = array ? [] : Object.create(null);
      const entries = array ? keys.filter(key => key !== "length") : keys;
      let index = 0;
      for (const key of entries) {
        if (typeof key !== "string" || array && key !== String(index)) fail("PROJECT_INPUT_INVALID", pointer, "Input contains unsupported own keys.");
        const childPointer = pointer + "/" + escapePointer(key);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) fail("PROJECT_INPUT_INVALID", childPointer, "Input properties must be enumerable data descriptors.");
        if (index++) charge(1, pointer, local);
        if (!array) charge(stringBytes(key, childPointer) + 1, childPointer, local);
        const child = copy(descriptor.value, depth + 1, childPointer, local);
        if (array) (out as JsonValue[]).push(child); else (out as Record<string, JsonValue>)[key] = child;
      }
      ancestors.delete(value);
      return Object.freeze(out);
    };
    return Object.freeze({ ok: true, value: copy(input, 1, ""), diagnostics: Object.freeze([]) });
  } catch (error) {
    // Reflection exceptions are never exposed as strings or source data.
    return Object.freeze({ ok: false, diagnostics: Object.freeze([error === sentinel ? failure : inputDiagnostic("PROJECT_INPUT_INVALID")]) });
  }
}

// Package-private shared accounting, consumed only after validation.
export function countNodes(value: CanonicalInput): number {
  let count = 0;
  const ancestors = new Set<object>();
  const stack: { value: unknown; exit?: boolean }[] = [{ value }];
  while (stack.length) {
    const entry = stack.pop()!;
    const item = entry.value;
    if (entry.exit) { ancestors.delete(item as object); continue; }
    count++;
    if (item !== null && typeof item === "object") {
      if (ancestors.has(item)) throw new TypeError("Canonical input contains a cycle.");
      ancestors.add(item); stack.push({ value: item, exit: true });
      const array = Array.isArray(item);
      const prototype = Object.getPrototypeOf(item);
      if (array ? prototype !== Array.prototype : prototype !== null && prototype !== Object.prototype) throw new TypeError("Canonical input is not checked data.");
      const keys = Reflect.ownKeys(item);
      if (array && Object.getOwnPropertyDescriptor(item, "length")?.value !== keys.length - 1) throw new TypeError("Canonical arrays must be contiguous.");
      let index = 0;
      for (const key of keys) {
        if (array && key === "length") continue;
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (typeof key !== "string" || !descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new TypeError("Canonical input is not checked data.");
        if (array && key !== String(index++)) throw new TypeError("Canonical arrays must be contiguous.");
        if (!array) count++;
        stack.push({ value: descriptor.value });
      }
    } else if (item !== null && !["string", "boolean", "number"].includes(typeof item)) throw new TypeError("Canonical input is not JSON.");
    if (!Number.isSafeInteger(count)) throw new RangeError("Node count exceeds the safe range.");
  }
  return count;
}
