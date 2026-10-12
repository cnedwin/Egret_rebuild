// SPDX-License-Identifier: Apache-2.0
import { visit } from "jsonc-parser";
import type { JSONPath, JSONVisitor } from "jsonc-parser";
import type { SPINE_IMPORT_LIMITS, SpineSourceSpan } from "@egret/project/spine";

type SourceViewLimits = Pick<typeof SPINE_IMPORT_LIMITS,
  "maxJsonDepth" | "maxJsonNodes" | "maxJsonProperties" | "maxJsonKeyUtf8Bytes"
  | "maxJsonStringUtf8Bytes" | "maxDiagnosticPointerUtf8Bytes">;

// Keep all six ceilings synchronized with public admission limits.
// Public literal types require their exact values at compilation without a runtime edge.
const limits: SourceViewLimits = Object.freeze({
  maxJsonDepth: 32,
  maxJsonNodes: 262144,
  maxJsonProperties: 131072,
  maxJsonKeyUtf8Bytes: 1024,
  maxJsonStringUtf8Bytes: 65536,
  maxDiagnosticPointerUtf8Bytes: 2048,
});

type SourceProperty = {
  readonly key: string;
  readonly keySpan: SpineSourceSpan;
  readonly value: SourceNode;
};

// This private view retains source order and original UTF-16 token locations.
export type SourceNode =
  | { readonly kind: "object"; readonly pointer: string;
      readonly span: SpineSourceSpan; readonly properties: readonly SourceProperty[] }
  | { readonly kind: "array"; readonly pointer: string;
      readonly span: SpineSourceSpan; readonly elements: readonly SourceNode[] }
  | { readonly kind: "string"; readonly pointer: string;
      readonly span: SpineSourceSpan; readonly value: string }
  | { readonly kind: "number"; readonly pointer: string;
      readonly span: SpineSourceSpan; readonly value: number }
  | { readonly kind: "boolean"; readonly pointer: string;
      readonly span: SpineSourceSpan; readonly value: boolean }
  | { readonly kind: "null"; readonly pointer: string;
      readonly span: SpineSourceSpan; readonly value: null };

type SourceViewFailure = {
  readonly ok: false;
  readonly pointer: string;
  readonly span?: SpineSourceSpan;
};
export type SourceViewResult =
  | { readonly ok: true; readonly root: SourceNode }
  | SourceViewFailure;

type PendingProperty = {
  readonly key: string;
  readonly keySpan: SpineSourceSpan;
  readonly pointer: string;
};
type ObjectFrame = {
  readonly kind: "object";
  readonly pointer: string;
  readonly span: SpineSourceSpan;
  readonly path: JSONPath;
  readonly properties: SourceProperty[];
  readonly keys: Set<string>;
  expect: "key-or-end" | "key" | "colon" | "value" | "comma-or-end";
  pending: PendingProperty | undefined;
};
type ArrayFrame = {
  readonly kind: "array";
  readonly pointer: string;
  readonly span: SpineSourceSpan;
  readonly path: JSONPath;
  readonly elements: SourceNode[];
  expect: "value-or-end" | "value" | "comma-or-end";
};
type Frame = ObjectFrame | ArrayFrame;
type Destination = { readonly pointer: string; readonly path: JSONPath };

// Count decoded Unicode without depending on Node, DOM, or a host encoder.
function utf8Bytes(value: string): number | undefined {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return undefined;
      index += 1;
      bytes += 4;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return undefined;
    } else {
      bytes += unit < 0x80 ? 1 : unit < 0x800 ? 2 : 3;
    }
  }
  return bytes;
}

export function createSourceView(text: string, sourceId: string): SourceViewResult {
  const stack: Frame[] = [];
  const refusal = {};
  let failure: SourceViewFailure | undefined;
  let root: SourceNode | undefined;
  let nodes = 0;
  let properties = 0;
  let previousEnd = 0;

  const refuse: (pointer: string, span?: SpineSourceSpan) => never = (pointer, span) => {
    failure = span === undefined
      ? { ok: false, pointer }
      : { ok: false, pointer, span };
    throw refusal;
  };
  const currentPointer = (): string => {
    const frame = stack[stack.length - 1];
    return frame?.kind === "object"
      ? frame.pending?.pointer ?? frame.pointer
      : frame?.pointer ?? "";
  };

  // CRLF is one line break; offsets and columns remain UTF-16 code units.
  const lineStarts = [0];
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit === 13) {
      if (text.charCodeAt(index + 1) === 10) index += 1;
      lineStarts.push(index + 1);
    } else if (unit === 10) {
      lineStarts.push(index + 1);
    }
  }
  const spanAt = (offset: number, length: number): SpineSourceSpan => {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length)
      || offset < 0 || length < 0 || offset + length > text.length) {
      refuse(currentPointer());
    }
    let low = 0;
    let high = lineStarts.length;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if ((lineStarts[middle] ?? 0) <= offset) low = middle;
      else high = middle;
    }
    return Object.freeze({ source: "skeleton", sourceId, offset, length,
      line: low + 1, column: offset - (lineStarts[low] ?? 0) + 1 });
  };
  const checkGap = (start: number, end: number, pointer: string): void => {
    for (let index = start; index < end; index += 1) {
      const unit = text.charCodeAt(index);
      if (unit !== 32 && unit !== 9 && unit !== 10 && unit !== 13) {
        refuse(pointer, spanAt(index, 1));
      }
    }
  };
  const token = (offset: number, length: number, startLine: number,
    startCharacter: number): SpineSourceSpan => {
    const span = spanAt(offset, length);
    if (length === 0 || offset < previousEnd) refuse(currentPointer(), span);
    checkGap(previousEnd, offset, currentPointer());
    if (startLine !== span.line - 1 || startCharacter !== span.column - 1) {
      refuse(currentPointer(), span);
    }
    previousEnd = offset + length;
    return span;
  };
  const childPointer = (parent: string, key: string,
    originalToken: SpineSourceSpan): string => {
    const escaped = key.replace(/~/g, "~0").replace(/\//g, "~1");
    const pointer = `${parent}/${escaped}`;
    const bytes = utf8Bytes(pointer);
    if (bytes === undefined || bytes > limits.maxDiagnosticPointerUtf8Bytes) {
      // The overflowing segment is not admitted or truncated.
      refuse(parent, originalToken);
    }
    return pointer;
  };
  const destination = (span: SpineSourceSpan): Destination => {
    const parent = stack[stack.length - 1];
    if (parent === undefined) {
      if (root !== undefined) refuse("", span);
      return { pointer: "", path: [] };
    }
    if (parent.kind === "object") {
      const pending = parent.pending;
      if (parent.expect !== "value" || pending === undefined) {
        refuse(parent.pointer, span);
      }
      return { pointer: pending.pointer, path: [...parent.path, pending.key] };
    }
    if (parent.expect !== "value-or-end" && parent.expect !== "value") {
      refuse(parent.pointer, span);
    }
    const index = parent.elements.length;
    return { pointer: childPointer(parent.pointer, String(index), span),
      path: [...parent.path, index] };
  };
  const checkPath = (actual: JSONPath, expected: JSONPath,
    pointer: string, span: SpineSourceSpan): void => {
    if (actual.length !== expected.length) refuse(pointer, span);
    for (let index = 0; index < expected.length; index += 1) {
      if (actual[index] !== expected[index]) refuse(pointer, span);
    }
  };
  const admitNode = (pointer: string, span: SpineSourceSpan): void => {
    if (nodes >= limits.maxJsonNodes) refuse(pointer, span);
    nodes += 1;
  };
  const attach = (node: SourceNode): void => {
    const selected = destination(node.span);
    if (selected.pointer !== node.pointer) refuse(selected.pointer, node.span);
    const parent = stack[stack.length - 1];
    if (parent === undefined) {
      root = node;
    } else if (parent.kind === "object") {
      const pending = parent.pending;
      if (pending === undefined) refuse(parent.pointer, node.span);
      parent.properties.push(Object.freeze({ key: pending.key,
        keySpan: pending.keySpan, value: node }));
      parent.pending = undefined;
      parent.expect = "comma-or-end";
    } else {
      parent.elements.push(node);
      parent.expect = "comma-or-end";
    }
  };
  const begin = (kind: "object" | "array", span: SpineSourceSpan,
    path: JSONPath): void => {
    const selected = destination(span);
    checkPath(path, selected.path, selected.pointer, span);
    const opening = kind === "object" ? "{" : "[";
    if (span.length !== 1 || text[span.offset] !== opening
      || stack.length >= limits.maxJsonDepth) refuse(selected.pointer, span);
    admitNode(selected.pointer, span);
    if (kind === "object") {
      stack.push({ kind, pointer: selected.pointer, span, path: selected.path,
        properties: [], keys: new Set<string>(), expect: "key-or-end",
        pending: undefined });
    } else {
      stack.push({ kind, pointer: selected.pointer, span, path: selected.path,
        elements: [], expect: "value-or-end" });
    }
  };
  const end = (kind: "object" | "array", span: SpineSourceSpan): void => {
    const frame = stack[stack.length - 1];
    const closing = kind === "object" ? "}" : "]";
    if (frame === undefined || frame.kind !== kind || span.length !== 1
      || text[span.offset] !== closing) refuse(currentPointer(), span);
    if (frame.kind === "object") {
      if ((frame.expect !== "key-or-end" && frame.expect !== "comma-or-end")
        || frame.pending !== undefined) refuse(frame.pointer, span);
      stack.pop();
      attach(Object.freeze({ kind: "object", pointer: frame.pointer,
        span: frame.span, properties: Object.freeze(frame.properties) }));
    } else {
      if (frame.expect !== "value-or-end" && frame.expect !== "comma-or-end") {
        refuse(frame.pointer, span);
      }
      stack.pop();
      attach(Object.freeze({ kind: "array", pointer: frame.pointer,
        span: frame.span, elements: Object.freeze(frame.elements) }));
    }
  };

  const visitor: JSONVisitor = {
    onObjectBegin(offset, length, line, column, pathSupplier) {
      begin("object", token(offset, length, line, column), pathSupplier());
    },
    onArrayBegin(offset, length, line, column, pathSupplier) {
      begin("array", token(offset, length, line, column), pathSupplier());
    },
    onObjectProperty(key, offset, length, line, column, pathSupplier) {
      const span = token(offset, length, line, column);
      const frame = stack[stack.length - 1];
      if (frame === undefined || frame.kind !== "object"
        || (frame.expect !== "key-or-end" && frame.expect !== "key")
        || frame.pending !== undefined) refuse(currentPointer(), span);
      checkPath(pathSupplier(), frame.path, frame.pointer, span);
      if (length < 2 || text[offset] !== '"'
        || text[offset + length - 1] !== '"') refuse(frame.pointer, span);
      const pointer = childPointer(frame.pointer, key, span);
      const bytes = utf8Bytes(key);
      if (bytes === undefined || bytes > limits.maxJsonKeyUtf8Bytes
        || frame.keys.has(key) || properties >= limits.maxJsonProperties) {
        refuse(pointer, span);
      }
      properties += 1;
      frame.keys.add(key);
      frame.pending = { key, keySpan: span, pointer };
      frame.expect = "colon";
    },
    onLiteralValue(value: unknown, offset, length, line, column, pathSupplier) {
      const span = token(offset, length, line, column);
      const selected = destination(span);
      checkPath(pathSupplier(), selected.path, selected.pointer, span);
      let node: SourceNode;
      if (typeof value === "string") {
        const bytes = utf8Bytes(value);
        if (bytes === undefined || bytes > limits.maxJsonStringUtf8Bytes
          || length < 2 || text[offset] !== '"'
          || text[offset + length - 1] !== '"') refuse(selected.pointer, span);
        node = { kind: "string", pointer: selected.pointer, span, value };
      } else if (typeof value === "number") {
        const first = text.charCodeAt(offset);
        if (!Number.isFinite(value) || (first !== 45 && !(first >= 48 && first <= 57))) {
          refuse(selected.pointer, span);
        }
        node = { kind: "number", pointer: selected.pointer, span, value };
      } else if (typeof value === "boolean") {
        if (text.slice(offset, offset + length) !== (value ? "true" : "false")) {
          refuse(selected.pointer, span);
        }
        node = { kind: "boolean", pointer: selected.pointer, span, value };
      } else if (value === null) {
        if (text.slice(offset, offset + length) !== "null") refuse(selected.pointer, span);
        node = { kind: "null", pointer: selected.pointer, span, value };
      } else {
        refuse(selected.pointer, span);
      }
      admitNode(selected.pointer, span);
      attach(Object.freeze(node));
    },
    onSeparator(character, offset, length, line, column) {
      const span = token(offset, length, line, column);
      const frame = stack[stack.length - 1];
      if (frame === undefined || length !== 1 || text[offset] !== character) {
        refuse(currentPointer(), span);
      }
      if (character === ":" && frame.kind === "object" && frame.expect === "colon"
        && frame.pending !== undefined) {
        frame.expect = "value";
      } else if (character === "," && frame.expect === "comma-or-end") {
        if (frame.kind === "object") frame.expect = "key";
        else frame.expect = "value";
      } else {
        refuse(currentPointer(), span);
      }
    },
    onObjectEnd(offset, length, line, column) {
      end("object", token(offset, length, line, column));
    },
    onArrayEnd(offset, length, line, column) {
      end("array", token(offset, length, line, column));
    },
    onComment(offset, length) {
      refuse(currentPointer(), spanAt(offset, length));
    },
    onError(_error, offset, length) {
      refuse(currentPointer(), spanAt(offset, length));
    },
  };

  try {
    visit(text, visitor, { disallowComments: true, allowTrailingComma: false,
      allowEmptyContent: false });
    if (stack.length !== 0 || root === undefined) refuse(currentPointer());
    checkGap(previousEnd, text.length, "");
    return { ok: true, root };
  } catch (error) {
    if (error !== refusal) throw error;
    return failure ?? { ok: false, pointer: "" };
  }
}

export function sourceProperty(node: SourceNode, key: string): SourceNode | undefined {
  if (node.kind !== "object") return undefined;
  for (const property of node.properties) {
    if (property.key === key) return property.value;
  }
  return undefined;
}
