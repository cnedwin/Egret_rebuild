import type { JsonValue } from "@egret/contracts";
import type { ProjectLimits, ProjectValueResult, ProjectDiagnostic, ProjectDiagnosticCode } from "./public.js";
import type { InputKind, NumericToken, RawSpan, TextDocument } from "./internal.js";
import { createScanner, visit } from "./json-foundation.js";
import type { SyntaxKind } from "./json-foundation.js";
import { classifyIntegerToken } from "./integer-token.js";
import { escapePointer, inputByteCeiling } from "./live-input.js";
import { makeDiagnostic } from "./diagnostics.js";
import { utf8Length } from "./unicode.js";

// Actual upstream public const-enum declarations are type-only under strict
// verbatimModuleSyntax. These typed literal tokens are independently fixture-pinned.
const OPEN_OBJECT: SyntaxKind = 1, CLOSE_OBJECT: SyntaxKind = 2;
const OPEN_ARRAY: SyntaxKind = 3, CLOSE_ARRAY: SyntaxKind = 4;
const NUMBER: SyntaxKind = 11, EOF: SyntaxKind = 17;
const pointerFor = (path: readonly (string | number)[]): string => path.map(segment => "/" + escapePointer(String(segment))).join("");

export function readText(text: string, kind: InputKind, limits: ProjectLimits): ProjectValueResult<TextDocument> {
  const sentinel = {};
  let failure: ProjectDiagnostic;
  const fail: (code: ProjectDiagnosticCode, pointer: string, message: string, offset?: number, length?: number) => never = (code, pointer, message, offset, length) => {
    const details: Record<string, JsonValue> = Object.create(null);
    if (offset !== undefined) details.offset = offset;
    if (length !== undefined) details.length = length;
    failure = makeDiagnostic({ code, phase: "parse", severity: "error", jsonPointer: pointer, message, details });
    throw sentinel;
  };
  try {
    if (typeof text !== "string") fail("PROJECT_INPUT_INVALID", "", "Input text must be a string.");
    const rawLength = utf8Length(text);
    if (!rawLength.ok) fail("PROJECT_INPUT_INVALID", "", "Input contains invalid Unicode.");
    if (rawLength.value > inputByteCeiling(kind, limits)) fail("PROJECT_LIMIT_EXCEEDED", "", "Raw input exceeds its byte limit.");

    // Scanner preflight is iterative. It bounds recursive visitor safety and
    // collects provenance only; admitted visit remains the grammar authority.
    const scanner = createScanner(text, false);
    const byOffset = new Map<number, NumericToken>();
    let nesting = 0, maxNesting = 0, tokenCount = 0;
    for (let token = scanner.scan(); token !== EOF; token = scanner.scan()) {
      if (++tokenCount > text.length) fail("PROJECT_LIMIT_EXCEEDED", "", "Token metadata exceeds the raw input bound.");
      if (scanner.getTokenError() !== 0) fail("PROJECT_INPUT_INVALID", "", "Input has invalid JSON syntax.", scanner.getTokenOffset(), scanner.getTokenLength());
      if (token === OPEN_OBJECT || token === OPEN_ARRAY) {
        maxNesting = Math.max(maxNesting, ++nesting);
        if (nesting > limits.maxJsonDepth + (kind === "history" ? 2 : 0)) fail("PROJECT_LIMIT_EXCEEDED", "", "Input exceeds its nesting safety limit.", scanner.getTokenOffset(), scanner.getTokenLength());
      } else if (token === CLOSE_OBJECT || token === CLOSE_ARRAY) nesting--;
      if (token === NUMBER) {
        const offset = scanner.getTokenOffset();
        byOffset.set(offset, classifyIntegerToken(text.slice(offset, offset + scanner.getTokenLength()), offset));
      }
    }
    if (scanner.getTokenError() !== 0) fail("PROJECT_INPUT_INVALID", "", "Input has invalid JSON syntax.", scanner.getTokenOffset(), scanner.getTokenLength());

    // Qualify only the fixed wrapper, before any local payload admission can
    // select an error. This non-building strict visitor handles arbitrary root
    // key order; the scanner's bounded nesting has already made visit safe.
    const strictOptions = { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false };
    let fixedHistory = false;
    if (kind === "history") {
      let rootObject = false, rootKeyCount = 0, versionString = false, transactionsArray = false;
      const rootKeys = new Set<string>();
      visit(text, {
        onObjectBegin: (_offset, _length, _line, _column, path) => {
          if (path().length === 0) rootObject = true;
        },
        onObjectProperty: (key, _offset, _length, _line, _column, path) => {
          if (path().length === 0) {
            rootKeyCount++;
            if (rootKeys.size < 4) rootKeys.add(key);
          }
        },
        onArrayBegin: (_offset, _length, _line, _column, path) => {
          const segments = path();
          if (segments.length === 1 && segments[0] === "transactions") transactionsArray = true;
        },
        onLiteralValue: (value: unknown, _offset, _length, _line, _column, path) => {
          const segments = path();
          if (segments.length === 1 && segments[0] === "historySchemaVersion") versionString = typeof value === "string";
        },
        onObjectEnd: () => {}, onArrayEnd: () => {},
        onError: (_error, offset, length) => fail("PROJECT_INPUT_INVALID", "", "Input has invalid JSON syntax.", offset, length)
      }, strictOptions);
      fixedHistory = rootObject && rootKeyCount === 3 && rootKeys.size === 3
        && rootKeys.has("historySchemaVersion") && rootKeys.has("baseline") && rootKeys.has("transactions")
        && versionString && transactionsArray;
      if (!fixedHistory && maxNesting > limits.maxJsonDepth) fail("PROJECT_LIMIT_EXCEEDED", "", "Input exceeds its logical depth limit.");
    }

    type Budget = { bytes: number; ceiling: number };
    type Frame = { value: JsonValue[] | Record<string, JsonValue>; pointer: string; depth: number; start: number; keys: Set<string>; key?: string; local?: Budget };
    const frames: Frame[] = [], numericTokens = new Map<string, NumericToken>(), payloadSpans = new Map<string, RawSpan>();
    let root: JsonValue | undefined, wholeBytes = 0;
    const charge = (bytes: number, pointer: string, local?: Budget): void => {
      wholeBytes += bytes;
      if (local) local.bytes += bytes;
      if (wholeBytes > inputByteCeiling(kind, limits) || local && local.bytes > local.ceiling) fail("PROJECT_LIMIT_EXCEEDED", pointer, "Canonical input estimate exceeds its byte limit.");
    };
    const checkedString = (value: string, pointer: string): number => {
      const raw = utf8Length(value);
      if (!raw.ok) fail("PROJECT_INPUT_INVALID", pointer, "Input contains invalid Unicode.");
      if (raw.value > limits.maxStringUtf8Bytes) fail("PROJECT_LIMIT_EXCEEDED", pointer, "Input string or key exceeds its byte limit.");
      const encoded = utf8Length(JSON.stringify(value));
      if (!encoded.ok) fail("PROJECT_INPUT_INVALID", pointer, "Input contains invalid Unicode.");
      return encoded.value;
    };
    const attach = (value: JsonValue): void => {
      const parent = frames.at(-1);
      if (!parent) { root = value; return; }
      if (Array.isArray(parent.value)) {
        if (parent.value.length) charge(1, parent.pointer, parent.local);
        parent.value.push(value);
      } else {
        if (parent.key === undefined) fail("PROJECT_INPUT_INVALID", parent.pointer, "Input has invalid JSON syntax.");
        parent.value[parent.key] = value; delete parent.key;
      }
    };
    const boundary = (pointer: string): boolean => fixedHistory && (pointer === "/baseline" || /^\/transactions\/\d+$/u.test(pointer));
    const begin = (array: boolean, offset: number, path: readonly (string | number)[]): void => {
      const pointer = pointerFor(path), parent = frames.at(-1);
      const payload = boundary(pointer);
      const depth = payload ? 1 : (parent?.depth ?? 0) + 1;
      const local = payload ? { bytes: 0, ceiling: pointer === "/baseline" ? limits.maxSnapshotUtf8Bytes : limits.maxTransactionUtf8Bytes } : parent?.local;
      if (depth > limits.maxJsonDepth && !(fixedHistory && pointer === "/transactions" && array)) fail("PROJECT_LIMIT_EXCEEDED", pointer, "Input exceeds its logical depth limit.", offset, 1);
      charge(2, pointer, local);
      const value: JsonValue[] | Record<string, JsonValue> = array ? [] : Object.create(null);
      attach(value);
      const frame: Frame = { value, pointer, depth, start: offset, keys: new Set() };
      if (local) frame.local = local;
      frames.push(frame);
    };
    const end = (offset: number, length: number): void => {
      const frame = frames.pop();
      if (!frame) fail("PROJECT_INPUT_INVALID", "", "Input has invalid JSON syntax.", offset, length);
      Object.freeze(frame.value);
      if (boundary(frame.pointer) && !Array.isArray(frame.value)) {
        const raw = utf8Length(text.slice(frame.start, offset + length));
        if (!raw.ok) fail("PROJECT_INPUT_INVALID", frame.pointer, "Input contains invalid Unicode.");
        const ceiling = frame.pointer === "/baseline" ? limits.maxSnapshotUtf8Bytes : limits.maxTransactionUtf8Bytes;
        if (raw.value > ceiling) fail("PROJECT_LIMIT_EXCEEDED", frame.pointer, "History payload raw span exceeds its byte limit.");
        payloadSpans.set(frame.pointer, Object.freeze({ start: frame.start, end: offset + length, utf8Bytes: raw.value }));
      }
    };
    visit(text, {
      onObjectBegin: (offset, _length, _line, _column, path) => begin(false, offset, path()),
      onArrayBegin: (offset, _length, _line, _column, path) => begin(true, offset, path()),
      onObjectProperty: (key, offset, length) => {
        const frame = frames.at(-1)!;
        const pointer = frame.pointer + "/" + escapePointer(key);
        if (frame.keys.has(key)) fail("PROJECT_INPUT_INVALID", pointer, "Input has duplicate decoded object keys.", offset, length);
        if (frame.keys.size) charge(1, frame.pointer, frame.local);
        charge(checkedString(key, pointer) + 1, pointer, frame.local);
        frame.keys.add(key); frame.key = key;
      },
      onObjectEnd: end, onArrayEnd: end,
      onLiteralValue: (candidate: unknown, offset, length, _line, _column, path) => {
        const pointer = pointerFor(path());
        // Qualified scalar payloads own a local canonical budget, but no raw span.
        const local = boundary(pointer)
          ? { bytes: 0, ceiling: pointer === "/baseline" ? limits.maxSnapshotUtf8Bytes : limits.maxTransactionUtf8Bytes }
          : frames.at(-1)?.local;
        if (candidate !== null && !["string", "boolean", "number"].includes(typeof candidate)) fail("PROJECT_INPUT_INVALID", pointer, "Input has invalid JSON syntax.", offset, length);
        const value = candidate as null | string | boolean | number;
        const bytes = typeof value === "string" ? checkedString(value, pointer) : typeof value === "number" && !Number.isFinite(value) ? 4 : JSON.stringify(value).length;
        charge(bytes, pointer, local);
        if (typeof value === "number") {
          const token = byOffset.get(offset);
          if (!token) fail("PROJECT_INPUT_INVALID", pointer, "Input numeric token provenance is missing.", offset, length);
          numericTokens.set(pointer, token);
        }
        attach(value);
      },
      onError: (_error, offset, length) => fail("PROJECT_INPUT_INVALID", "", "Input has invalid JSON syntax.", offset, length)
    }, strictOptions);
    if (root === undefined) fail("PROJECT_INPUT_INVALID", "", "Input has invalid JSON syntax.");
    // Maps remain package-private metadata. Freezing the wrapper is not claimed
    // to turn Map.set into an immutable API; no map escapes through public JSON.
    return Object.freeze({ ok: true, value: Object.freeze({ value: root, numericTokens, payloadSpans }), diagnostics: Object.freeze([]) });
  } catch (error) {
    if (error === sentinel) return Object.freeze({ ok: false, diagnostics: Object.freeze([failure!]) });
    return Object.freeze({ ok: false, diagnostics: Object.freeze([makeDiagnostic({ code: "PROJECT_INPUT_INVALID", phase: "parse", severity: "error", jsonPointer: "", message: "Input could not be read as JSON.", details: Object.create(null) })]) });
  }
}
