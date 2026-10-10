import type { JsonValue, ProjectSnapshot, ProjectTransaction, ProjectHistory } from "@egret/contracts";
import type { ProjectLimits } from "./public.js";

// These package-private ports carry pending input and provenance; their types
// do not establish finite, schema-valid or canonical public JSON. Metadata
// maps remain privately owned and are never exposed through the public facade.
export type InputKind = "snapshot" | "transaction" | "history";
export type RawSpan = { start: number; end: number; utf8Bytes: number };
export type NumericToken = { offset: number; length: number; integerSafe: boolean; negativeZero: boolean };
export type TextDocument = { value: JsonValue; numericTokens: ReadonlyMap<string, NumericToken>; payloadSpans: ReadonlyMap<string, RawSpan> };
export type Prepared<T> = { value: T; canonical: string; utf8Bytes: number; nodeCount: number };
export type ValidationContext = { limits: ProjectLimits; numericTokens?: ReadonlyMap<string, NumericToken>; pointerPrefix: string };
export type CanonicalInput = JsonValue | ProjectSnapshot | ProjectTransaction | ProjectHistory;
export type FormatRoot = "ProjectSnapshot" | "ProjectTransaction" | "ProjectHistory";
export type ShapeNodeFailure = { readonly ok: false; readonly reason: "missing" | "type" | "enum" | "const" | "unknown-field" | "union" };
export type ShapeNodeCheck = { readonly ok: true } | ShapeNodeFailure;
