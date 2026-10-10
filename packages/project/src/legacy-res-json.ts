import { createScanner, visit } from "./json-foundation.js";
import type { JSONPath, ScanError, SyntaxKind } from "./json-foundation.js";
import { utf8Length } from "./unicode.js";
import type { LegacyResourceDiagnostic, LegacyResourceDiagnosticCode, LegacyResourceJSONResult } from "./legacy-res-report.js";

// Fixed public declaration values from jsonc-parser 3.3.1 main.d.ts. Its ambient
// const enums remain type-only under the existing strict NodeNext configuration.
const OPEN_BRACE: SyntaxKind = 1;
const CLOSE_BRACE: SyntaxKind = 2;
const OPEN_BRACKET: SyntaxKind = 3;
const CLOSE_BRACKET: SyntaxKind = 4;
const EOF: SyntaxKind = 17;
const NO_SCAN_ERROR: ScanError = 0;

function diagnostic(code: LegacyResourceDiagnosticCode, jsonPointer = ""): LegacyResourceDiagnostic {
  return Object.freeze({ code, source: "text", severity: "error", jsonPointer,
    message: code === "LEGACY_RES_INTERNAL_FAILED" ? "Resource declaration analysis failed internally."
      : code === "LEGACY_RES_SYNTAX_INVALID" ? "Input is not strict JSON."
      : code === "LEGACY_RES_INPUT_INVALID" ? "Input contains invalid Unicode or is not a primitive string."
      : "Resource declaration limit exceeded." });
}

function pointer(path: JSONPath): string {
  return path.map(part => "/" + String(part).replaceAll("~", "~0").replaceAll("/", "~1")).join("");
}

export function readLegacyResourceJSON(text: string): LegacyResourceJSONResult {
  // Only this inaccessible per-call identity authenticates deliberate admission
  // failures; foreign thrown values are never inspected, serialized or coerced.
  const sentinel = {};
  let rejected: LegacyResourceDiagnostic | undefined;
  const reject = (code: LegacyResourceDiagnosticCode, at = ""): never => {
    rejected = diagnostic(code, at);
    throw sentinel;
  };
  try {
    if (typeof text !== "string") reject("LEGACY_RES_INPUT_INVALID");
    if (text.length > 1048576) reject("LEGACY_RES_LIMIT_EXCEEDED");
    const raw = utf8Length(text);
    if (!raw.ok) return reject("LEGACY_RES_INPUT_INVALID");
    if (raw.value > 1048576) reject("LEGACY_RES_LIMIT_EXCEEDED");
    if (text.startsWith("\ufeff")) reject("LEGACY_RES_SYNTAX_INVALID");

    // This iterative pass proves progress and bounds recursive visitor depth;
    // it deliberately delegates whole JSON grammar to the public visitor.
    const scanner = createScanner(text, false);
    const nesting: SyntaxKind[] = [];
    let priorPosition = 0;
    let tokens = 0;
    for (;;) {
      const kind = scanner.scan();
      const error = scanner.getTokenError();
      if (!Number.isSafeInteger(error) || error < 0 || error > 6) throw undefined;
      // The installed scanner can overrun on an unclosed comment: lexical
      // failure must win before zero-error metadata/progress proof.
      if (error !== NO_SCAN_ERROR) reject("LEGACY_RES_SYNTAX_INVALID");
      const position = scanner.getPosition();
      const offset = scanner.getTokenOffset();
      const length = scanner.getTokenLength();
      if (!Number.isSafeInteger(kind) || kind < 1 || kind > 17
        || !Number.isSafeInteger(position) || !Number.isSafeInteger(offset) || !Number.isSafeInteger(length)
        || offset !== priorPosition || length < 0 || position !== offset + length || position > text.length
        || ++tokens > text.length + 1) throw undefined;
      if (kind === EOF) {
        if (length !== 0 || position !== text.length) throw undefined;
        break;
      }
      if (length === 0 || position <= priorPosition) throw undefined;
      priorPosition = position;
      if (kind === OPEN_BRACE || kind === OPEN_BRACKET) {
        if (nesting.length === 16) reject("LEGACY_RES_LIMIT_EXCEEDED");
        nesting.push(kind);
      } else if ((kind === CLOSE_BRACE && nesting[nesting.length - 1] === OPEN_BRACE)
        || (kind === CLOSE_BRACKET && nesting[nesting.length - 1] === OPEN_BRACKET)) nesting.pop();
    }

    const frames: (Set<string> | null)[] = [];
    const checkString = (value: string, at: string): void => {
      // Decoded keys/strings can be smaller than their admitted raw escapes.
      const bytes = utf8Length(value);
      if (!bytes.ok) return reject("LEGACY_RES_INPUT_INVALID", at);
      if (bytes.value > 4096) reject("LEGACY_RES_LIMIT_EXCEEDED", at);
    };
    const begin = (keys: Set<string> | null): void => {
      if (frames.length === 16) reject("LEGACY_RES_LIMIT_EXCEEDED");
      frames.push(keys);
    };
    const admitted = visit(text, {
      onObjectBegin() { begin(new Set()); },
      onArrayBegin() { begin(null); },
      onObjectEnd() { frames.pop(); },
      onArrayEnd() { frames.pop(); },
      onObjectProperty(key, _offset, _length, _line, _column, path) {
        const at = pointer([...path(), key]);
        checkString(key, at);
        const keys = frames[frames.length - 1];
        if (!(keys instanceof Set)) throw undefined;
        if (keys.has(key)) reject("LEGACY_RES_SYNTAX_INVALID");
        keys.add(key);
      },
      onLiteralValue(value: unknown, _offset, _length, _line, _column, path) {
        if (typeof value === "string") checkString(value, pointer(path()));
      },
      onError() { reject("LEGACY_RES_SYNTAX_INVALID"); }
    }, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });
    if (!admitted || frames.length !== 0) throw undefined;
    // One private native graph, no reviver or second visitor-built graph. JSON
    // number syntax (including overflow) does not certify finite JsonValue.
    return Object.freeze({ status: "ok", value: JSON.parse(text) as unknown });
  } catch (cause) {
    if (cause === sentinel && rejected !== undefined) return Object.freeze({ status: "invalid", diagnostic: rejected });
    return Object.freeze({ status: "incomplete", diagnostic: diagnostic("LEGACY_RES_INTERNAL_FAILED") });
  }
}
