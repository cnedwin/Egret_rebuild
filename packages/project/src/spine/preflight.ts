// SPDX-License-Identifier: Apache-2.0
import { createScanner, visit } from "../json-foundation.js";
import type { SyntaxKind } from "../json-foundation.js";
import { utf8Length } from "../unicode.js";
import { escapePointer } from "../live-input.js";
import { isPortablePath, pathCollisionKey } from "../paths.js";
import type {
  SpineImportInput, SpineImportResult, SpineImportPlan, SpineImportDiagnostic,
  SpineImportDiagnosticCode, SpineSourceSpan, SpineProvenance,
  SpineTextSource, SpinePageBinding, SpinePagePlan, SpineRegionPlan,
} from "./types.js";

// Fixed engineering admission ceilings, not renderer/device capabilities.
export const SPINE_IMPORT_LIMITS = Object.freeze({
  maxSkeletonUtf8Bytes: 8388608,
  maxAtlasUtf8Bytes: 1048576,
  maxJsonDepth: 32,
  maxJsonNodes: 262144,
  maxJsonProperties: 131072,
  maxJsonStringUtf8Bytes: 65536,
  maxJsonKeyUtf8Bytes: 1024,
  maxSourceIdUtf8Bytes: 256,
  maxAssetIdUtf8Bytes: 256,
  maxNameUtf8Bytes: 1024,
  maxPagePathUtf8Bytes: 1024,
  maxProvenanceFieldUtf8Bytes: 4096,
  maxProvenanceTotalUtf8Bytes: 262144,
  maxAtlasPages: 64,
  maxAtlasRegions: 8192,
  maxAtlasFieldsPerSection: 32,
  maxAtlasLineUtf8Bytes: 4096,
  maxAtlasPageDimension: 16384,
  maxAtlasRegionCoordinate: 16384,
  maxAtlasPackedDimension: 16384,
  maxAtlasOffset: 16384,
  maxAtlasOriginalDimension: 16384,
  maxAtlasIndex: 2147483647,
  maxNamesPerCollection: 4096,
  maxObservations: 4096,
  maxSuccessDiagnostics: 16,
  maxDiagnosticPointerUtf8Bytes: 2048,
  maxObservationValueUtf8Bytes: 4096,
});

type Source = SpineImportDiagnostic["source"];
type Observation = SpineImportPlan["observations"][number];
type ExtraField = SpineRegionPlan["extraFields"][number];
type Failure = (
  code: SpineImportDiagnosticCode, source: Source, pointer: string,
  span?: SpineSourceSpan, relatedSpan?: SpineSourceSpan,
) => never;
type Context = {
  fail: Failure;
  provenanceBytes: number;
  observations: Observation[];
  concernCount: number;
  firstConcern?: Observation;
};
type Location = { span(offset: number, length: number): SpineSourceSpan };
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Property = { key: string; pointer: string; span: SpineSourceSpan; node?: JsonNode };
type JsonNode = {
  value: Json; pointer: string; span: SpineSourceSpan;
  properties?: Property[]; elements?: JsonNode[];
};
type Frame = { node: JsonNode; keys: Map<string, SpineSourceSpan>; current?: Property };
const limits = SPINE_IMPORT_LIMITS;
const messages: Record<SpineImportDiagnosticCode, string> = {
  SPINE_INPUT_INVALID: "Input metadata must use the supported plain data shape.",
  SPINE_LIMIT_EXCEEDED: "Input exceeds a fixed planning admission limit.",
  SPINE_JSON_SYNTAX: "Skeleton text must contain strict finite Unicode JSON.",
  SPINE_JSON_DUPLICATE_KEY: "Skeleton JSON contains a duplicate decoded property key.",
  SPINE_JSON_SCHEMA: "Skeleton JSON does not have the supported planning shape.",
  SPINE_VERSION_INVALID: "The declared export version must be a stable version triplet.",
  SPINE_VERSION_PRERELEASE: "Prerelease export versions are outside the planning profile.",
  SPINE_VERSION_MISMATCH: "The declared export version is outside the stable 4.3 series.",
  SPINE_ATLAS_SYNTAX: "Atlas text does not have the supported syntax or geometry.",
  SPINE_ATLAS_PROFILE_UNSUPPORTED: "The declared atlas form is outside the planning profile.",
  SPINE_ATLAS_DUPLICATE: "Atlas text contains a duplicate declared identity or field.",
  SPINE_PAGE_BINDING_INVALID: "Atlas pages need unique exact explicit asset bindings.",
  SPINE_PROFILE_UNSUPPORTED: "Declared renderer profile concerns remain unverified.",
  SPINE_INVENTORY_PARTIAL: "The inspected feature inventory is partial; animation and rendering are unverified.",
  SPINE_PROVENANCE_UNVERIFIED: "Source declarations do not establish hashes, rights or Editor entitlement.",
};

function diagnostic(
  code: SpineImportDiagnosticCode, severity: SpineImportDiagnostic["severity"],
  source: Source, pointer: string, span?: SpineSourceSpan,
  relatedSpan?: SpineSourceSpan, message = messages[code],
): SpineImportDiagnostic {
  return Object.freeze({ code, severity, source, pointer, message,
    ...(span === undefined ? {} : { span }),
    ...(relatedSpan === undefined ? {} : { relatedSpan }) });
}

function freezeOwned<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) {
      freezeOwned((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function location(source: "skeleton" | "atlas", input: SpineTextSource): Location {
  const text = input.text, starts = [0];
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code === 13) {
      if (text.charCodeAt(index + 1) === 10) index++;
      starts.push(index + 1);
    } else if (code === 10) starts.push(index + 1);
  }
  return {
    span(offset, length) {
      let low = 0, high = starts.length;
      while (low + 1 < high) {
        const middle = Math.floor((low + high) / 2);
        if (starts[middle]! <= offset) low = middle; else high = middle;
      }
      return Object.freeze({ source, sourceId: input.id, offset, length,
        line: low + 1, column: offset - starts[low]! + 1 });
    },
  };
}

function childPointer(
  context: Context, parent: string, key: string, source: Source, span?: SpineSourceSpan,
): string {
  const pointer = parent + "/" + escapePointer(key);
  const bytes = utf8Length(pointer);
  if (!bytes.ok || bytes.value > limits.maxDiagnosticPointerUtf8Bytes) {
    context.fail("SPINE_LIMIT_EXCEEDED", source, parent, span);
  }
  return pointer;
}

function record(
  context: Context, value: unknown, required: readonly string[],
  optional: readonly string[], pointer: string,
): Record<string, unknown> {
  let result: Record<string, unknown> | undefined;
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      context.fail("SPINE_INPUT_INVALID", "input", pointer);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== Object.prototype) {
      context.fail("SPINE_INPUT_INVALID", "input", pointer);
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length < required.length || keys.length > required.length + optional.length
      || keys.some(key => typeof key !== "string" || !required.includes(key) && !optional.includes(key))
      || required.some(key => !keys.includes(key))) {
      context.fail("SPINE_INPUT_INVALID", "input", pointer);
    }
    result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
        context.fail("SPINE_INPUT_INVALID", "input", pointer);
      }
      result[key as string] = descriptor.value;
    }
  } catch {
    // Reflection failures stay at the containing record and never invoke a getter.
    context.fail("SPINE_INPUT_INVALID", "input", pointer);
  }
  return result!;
}

function metadataString(
  context: Context, value: unknown, pointer: string, ceiling: number,
  nonempty = true, asset = false,
): string {
  if (typeof value !== "string" || nonempty && value.length === 0
    || asset && value.trim().length === 0) {
    context.fail("SPINE_INPUT_INVALID", "input", pointer);
  }
  const bytes = utf8Length(value);
  if (!bytes.ok) context.fail("SPINE_INPUT_INVALID", "input", pointer);
  if (bytes.value > ceiling) context.fail("SPINE_LIMIT_EXCEEDED", "input", pointer);
  return value;
}

function provenance(context: Context, value: unknown, pointer: string): SpineProvenance {
  const own = record(context, value, ["origin", "license", "notice"], ["sha256"], pointer);
  const fields: Record<string, string> = Object.create(null);
  for (const key of ["origin", "license", "notice", "sha256"]) {
    if (key === "sha256" && !Object.hasOwn(own, key)) continue;
    const fieldPointer = pointer + "/" + key;
    const text = metadataString(context, own[key], fieldPointer, limits.maxProvenanceFieldUtf8Bytes);
    if (key === "sha256" && !/^[0-9a-f]{64}$/u.test(text)) {
      context.fail("SPINE_INPUT_INVALID", "input", fieldPointer);
    }
    const bytes = utf8Length(text);
    if (!bytes.ok) context.fail("SPINE_INPUT_INVALID", "input", fieldPointer);
    if (context.provenanceBytes + bytes.value > limits.maxProvenanceTotalUtf8Bytes) {
      context.fail("SPINE_LIMIT_EXCEEDED", "input", fieldPointer);
    }
    context.provenanceBytes += bytes.value;
    fields[key] = text;
  }
  return Object.freeze({ origin: fields.origin!, license: fields.license!, notice: fields.notice!,
    ...(fields.sha256 === undefined ? {} : { sha256: fields.sha256 }) });
}

function textSource(context: Context, value: unknown, pointer: string): SpineTextSource {
  const own = record(context, value, ["id", "text", "provenance"], [], pointer);
  const id = metadataString(context, own.id, pointer + "/id", limits.maxSourceIdUtf8Bytes);
  if (typeof own.text !== "string") context.fail("SPINE_INPUT_INVALID", "input", pointer + "/text");
  const declaration = provenance(context, own.provenance, pointer + "/provenance");
  return Object.freeze({ id, text: own.text, provenance: declaration });
}

function bindings(context: Context, value: unknown): SpinePageBinding[] {
  let length = 0;
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      context.fail("SPINE_INPUT_INVALID", "input", "/pages");
    }
    const size = Object.getOwnPropertyDescriptor(value, "length");
    if (!size || !Object.hasOwn(size, "value") || size.enumerable
      || typeof size.value !== "number" || !Number.isSafeInteger(size.value) || size.value < 0) {
      context.fail("SPINE_INPUT_INVALID", "input", "/pages");
    }
    length = size.value;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1 || keys.some(key => typeof key !== "string"
      || key !== "length" && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= length))) {
      context.fail("SPINE_INPUT_INVALID", "input", "/pages");
    }
  } catch {
    context.fail("SPINE_INPUT_INVALID", "input", "/pages");
  }
  const owned: SpinePageBinding[] = [];
  for (let index = 0; index < length; index++) {
    let item: unknown;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
        context.fail("SPINE_INPUT_INVALID", "input", "/pages");
      }
      item = descriptor.value;
    } catch {
      context.fail("SPINE_INPUT_INVALID", "input", "/pages");
    }
    const pointer = "/pages/" + index;
    const own = record(context, item, ["pageName", "assetId", "provenance"], [], pointer);
    const pageName = metadataString(context, own.pageName, pointer + "/pageName", limits.maxPagePathUtf8Bytes, false);
    const assetId = metadataString(context, own.assetId, pointer + "/assetId", limits.maxAssetIdUtf8Bytes, true, true);
    const declaration = provenance(context, own.provenance, pointer + "/provenance");
    owned.push(Object.freeze({ pageName, assetId, provenance: declaration }));
  }
  return owned;
}

function rawText(context: Context, source: "skeleton" | "atlas", text: string): number {
  const bytes = utf8Length(text);
  if (!bytes.ok) context.fail(source === "skeleton" ? "SPINE_JSON_SYNTAX" : "SPINE_ATLAS_SYNTAX", source, "");
  const ceiling = source === "skeleton" ? limits.maxSkeletonUtf8Bytes : limits.maxAtlasUtf8Bytes;
  if (bytes.value > ceiling) context.fail("SPINE_LIMIT_EXCEEDED", source, "");
  return bytes.value;
}

// Tokens come from the retained public jsonc-parser declaration. They are typed
// literals so no const-enum runtime import widens the existing strict build.
const OPEN_OBJECT: SyntaxKind = 1, CLOSE_OBJECT: SyntaxKind = 2;
const OPEN_ARRAY: SyntaxKind = 3, CLOSE_ARRAY: SyntaxKind = 4;
const LINE_COMMENT: SyntaxKind = 12, BLOCK_COMMENT: SyntaxKind = 13;
const UNKNOWN: SyntaxKind = 16, EOF: SyntaxKind = 17;

function readSkeleton(context: Context, input: SpineTextSource, positions: Location): JsonNode {
  // Complete lexical/depth safety precedes every grammar/duplicate callback.
  const scanner = createScanner(input.text, false);
  let depth = 0;
  for (let token = scanner.scan(); ; token = scanner.scan()) {
    if (scanner.getTokenError() !== 0 || token === UNKNOWN
      || token === LINE_COMMENT || token === BLOCK_COMMENT) {
      context.fail("SPINE_JSON_SYNTAX", "skeleton", "",
        positions.span(scanner.getTokenOffset(), scanner.getTokenLength()));
    }
    if (token === EOF) break;
    if (token === OPEN_OBJECT || token === OPEN_ARRAY) {
      if (++depth > limits.maxJsonDepth) context.fail("SPINE_LIMIT_EXCEEDED", "skeleton", "",
        positions.span(scanner.getTokenOffset(), scanner.getTokenLength()));
    } else if (token === CLOSE_OBJECT || token === CLOSE_ARRAY) depth = Math.max(0, depth - 1);
  }

  let root: JsonNode | undefined, nodes = 0, properties = 0;
  const frames: Frame[] = [];
  const nextPointer = (span: SpineSourceSpan): string => {
    const parent = frames.at(-1);
    if (!parent) return "";
    if (parent.node.elements) {
      return childPointer(context, parent.node.pointer, String(parent.node.elements.length), "skeleton", span);
    }
    if (!parent.current) context.fail("SPINE_JSON_SYNTAX", "skeleton", parent.node.pointer, span);
    return parent.current.pointer;
  };
  const attach = (node: JsonNode): void => {
    const parent = frames.at(-1);
    if (!parent) { root = node; return; }
    if (parent.node.elements) {
      parent.node.elements.push(node);
      (parent.node.value as Json[]).push(node.value);
    } else {
      if (!parent.current) context.fail("SPINE_JSON_SYNTAX", "skeleton", parent.node.pointer, node.span);
      parent.current.node = node;
      (parent.node.value as Record<string, Json>)[parent.current.key] = node.value;
      delete parent.current;
    }
  };
  const begin = (array: boolean, offset: number): void => {
    const span = positions.span(offset, 1), pointer = nextPointer(span);
    if (++nodes > limits.maxJsonNodes) context.fail("SPINE_LIMIT_EXCEEDED", "skeleton", pointer, span);
    const node: JsonNode = array
      ? { value: [], pointer, span, elements: [] }
      : { value: Object.create(null) as Record<string, Json>, pointer, span, properties: [] };
    attach(node);
    frames.push({ node, keys: new Map() });
  };
  // The visitor remains the sole JSON grammar authority. Our frames own values
  // and provenance in callback order, including numeric-looking property keys.
  visit(input.text, {
    onObjectBegin: offset => begin(false, offset),
    onArrayBegin: offset => begin(true, offset),
    onObjectProperty: (key, offset, length) => {
      const frame = frames.at(-1)!;
      const span = positions.span(offset, length), bytes = utf8Length(key);
      if (!bytes.ok) context.fail("SPINE_JSON_SYNTAX", "skeleton", frame.node.pointer, span);
      const pointer = childPointer(context, frame.node.pointer, key, "skeleton", span);
      if (bytes.value > limits.maxJsonKeyUtf8Bytes) context.fail("SPINE_LIMIT_EXCEEDED", "skeleton", pointer, span);
      const earlier = frame.keys.get(key);
      if (earlier) context.fail("SPINE_JSON_DUPLICATE_KEY", "skeleton", pointer, span, earlier);
      if (++properties > limits.maxJsonProperties) context.fail("SPINE_LIMIT_EXCEEDED", "skeleton", pointer, span);
      const property: Property = { key, pointer, span };
      frame.keys.set(key, span);
      frame.node.properties!.push(property);
      frame.current = property;
    },
    onObjectEnd: () => { frames.pop(); },
    onArrayEnd: () => { frames.pop(); },
    onLiteralValue: (candidate: unknown, offset, length) => {
      const span = positions.span(offset, length), pointer = nextPointer(span);
      if (typeof candidate === "string") {
        const bytes = utf8Length(candidate);
        if (!bytes.ok) context.fail("SPINE_JSON_SYNTAX", "skeleton", pointer, span);
        if (bytes.value > limits.maxJsonStringUtf8Bytes) context.fail("SPINE_LIMIT_EXCEEDED", "skeleton", pointer, span);
      } else if (typeof candidate === "number" && !Number.isFinite(candidate)) {
        context.fail("SPINE_JSON_SYNTAX", "skeleton", pointer, span);
      } else if (candidate !== null && typeof candidate !== "number" && typeof candidate !== "boolean") {
        context.fail("SPINE_JSON_SYNTAX", "skeleton", pointer, span);
      }
      if (++nodes > limits.maxJsonNodes) context.fail("SPINE_LIMIT_EXCEEDED", "skeleton", pointer, span);
      attach({ value: candidate as Json, pointer, span });
    },
    onError: (_error, offset, length) => context.fail("SPINE_JSON_SYNTAX", "skeleton", "", positions.span(offset, length)),
  }, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });
  if (!root) context.fail("SPINE_JSON_SYNTAX", "skeleton", "");
  return root;
}

function objectProperties(context: Context, node: JsonNode): Property[] {
  if (!node.properties) context.fail("SPINE_JSON_SCHEMA", "skeleton", node.pointer, node.span);
  return node.properties;
}

function arrayElements(context: Context, node: JsonNode): JsonNode[] {
  if (!node.elements) context.fail("SPINE_JSON_SCHEMA", "skeleton", node.pointer, node.span);
  return node.elements;
}

function property(node: JsonNode, key: string): Property | undefined {
  return node.properties?.find(item => item.key === key);
}

function requiredNode(context: Context, node: JsonNode, key: string): JsonNode {
  const selected = property(node, key)?.node;
  if (!selected) {
    context.fail("SPINE_JSON_SCHEMA", "skeleton",
      childPointer(context, node.pointer, key, "skeleton", node.span), node.span);
  }
  return selected;
}

function observe(
  context: Context, kind: Observation["kind"], pointer: string,
  span: SpineSourceSpan, value: Json | undefined, concern = false,
): void {
  if (context.observations.length >= limits.maxObservations) {
    context.fail("SPINE_LIMIT_EXCEEDED", span.source, pointer, span);
  }
  const bytes = typeof value === "string" ? utf8Length(value) : undefined;
  const observation: Observation = Object.freeze({ kind, pointer, span,
    ...(typeof value === "string" && bytes?.ok && bytes.value <= limits.maxObservationValueUtf8Bytes
      ? { value } : {}) });
  context.observations.push(observation);
  if (concern) {
    context.concernCount++;
    context.firstConcern ??= observation;
  }
}

function schemaName(
  context: Context, node: JsonNode, span: SpineSourceSpan,
  earlier: Map<string, SpineSourceSpan>, count: number,
): string {
  if (typeof node.value !== "string" || node.value.length === 0) {
    context.fail("SPINE_JSON_SCHEMA", "skeleton", node.pointer, span);
  }
  const bytes = utf8Length(node.value);
  if (!bytes.ok) context.fail("SPINE_JSON_SYNTAX", "skeleton", node.pointer, span);
  if (bytes.value > limits.maxNameUtf8Bytes) context.fail("SPINE_LIMIT_EXCEEDED", "skeleton", node.pointer, span);
  const previous = earlier.get(node.value);
  if (previous) context.fail("SPINE_JSON_SCHEMA", "skeleton", node.pointer, span, previous);
  if (count >= limits.maxNamesPerCollection) context.fail("SPINE_LIMIT_EXCEEDED", "skeleton", node.pointer, span);
  earlier.set(node.value, span);
  return node.value;
}

function attachmentMarkers(context: Context, attachments: JsonNode): void {
  for (const slot of objectProperties(context, attachments)) {
    if (slot.key.length === 0) context.fail("SPINE_JSON_SCHEMA", "skeleton", slot.pointer, slot.span);
    const slotNode = slot.node!;
    for (const attachment of objectProperties(context, slotNode)) {
      if (attachment.key.length === 0) {
        context.fail("SPINE_JSON_SCHEMA", "skeleton", attachment.pointer, attachment.span);
      }
      const node = attachment.node!, fields = objectProperties(context, node);
      if (!property(node, "type")) {
        observe(context, "attachment-type",
          childPointer(context, node.pointer, "type", "skeleton", node.span), node.span, "region");
      }
      for (const field of fields) {
        const selected = field.node!;
        if (field.key === "type") {
          observe(context, "attachment-type", field.pointer, selected.span,
            selected.value, selected.value !== "region");
        } else if (field.key === "sequence" && selected.value !== null) {
          // Sequence is a declaration marker; this planner validates no sequence semantics.
          observe(context, "attachment-sequence", field.pointer, selected.span, selected.value, true);
        }
      }
    }
  }
}

function animationMarkers(context: Context, animation: JsonNode): void {
  objectProperties(context, animation);
  const slots = property(animation, "slots")?.node;
  if (!slots) return;
  for (const slot of objectProperties(context, slots)) {
    for (const timeline of objectProperties(context, slot.node!)) {
      if (timeline.key === "rgba2" || timeline.key === "rgb2") {
        // A present timeline key is observed, without evaluating its marker value.
        observe(context, "dark-timeline", timeline.pointer, timeline.span, timeline.node!.value, true);
      }
    }
  }
}

function schema(context: Context, root: JsonNode): SpineImportPlan["names"] {
  const fields = objectProperties(context, root);
  const skeleton = requiredNode(context, root, "skeleton");
  objectProperties(context, skeleton);
  const names = { bones: [] as string[], slots: [] as string[],
    skins: [] as string[], animations: [] as string[] };
  for (const field of fields) {
    const node = field.node!;
    if (field.key === "skeleton") continue;
    if (field.key === "bones" || field.key === "slots" || field.key === "skins") {
      const collection = names[field.key], earlier = new Map<string, SpineSourceSpan>();
      for (const entry of arrayElements(context, node)) {
        const entryFields = objectProperties(context, entry);
        const name = requiredNode(context, entry, "name");
        const identity = schemaName(context, name, name.span, earlier, collection.length);
        if (field.key === "slots") {
          const bone = requiredNode(context, entry, "bone");
          if (typeof bone.value !== "string") context.fail("SPINE_JSON_SCHEMA", "skeleton", bone.pointer, bone.span);
          for (const member of entryFields) {
            const selected = member.node!;
            if (member.key === "blend" && typeof selected.value === "string" && selected.value !== "normal") {
              observe(context, "slot-blend", member.pointer, selected.span, selected.value, true);
            } else if (member.key === "dark" && selected.value !== null) {
              observe(context, "slot-dark", member.pointer, selected.span, selected.value, true);
            }
          }
        } else if (field.key === "skins") {
          const attachments = property(entry, "attachments")?.node;
          if (attachments) attachmentMarkers(context, attachments);
        }
        collection.push(identity);
      }
    } else if (field.key === "constraints") {
      for (const constraint of arrayElements(context, node)) {
        objectProperties(context, constraint);
        observe(context, "constraint", constraint.pointer, constraint.span, constraint.value, true);
      }
    } else if (field.key === "events") {
      objectProperties(context, node);
    } else if (field.key === "animations") {
      const earlier = new Map<string, SpineSourceSpan>();
      for (const animation of objectProperties(context, node)) {
        const selected = animation.node!;
        // Animation identities are property keys, not their object values.
        const keyNode: JsonNode = { value: animation.key, pointer: animation.pointer, span: animation.span };
        const identity = schemaName(context, keyNode, animation.span, earlier, names.animations.length);
        animationMarkers(context, selected);
        names.animations.push(identity);
      }
    } else {
      observe(context, "unknown-root-field", field.pointer, field.span, node.value);
    }
  }
  return names;
}

function exportVersion(context: Context, root: JsonNode): string {
  const skeleton = property(root, "skeleton")!.node!;
  const selected = property(skeleton, "spine")?.node;
  const pointer = childPointer(context, skeleton.pointer, "spine", "skeleton", skeleton.span);
  const span = selected?.span ?? skeleton.span;
  if (!selected || typeof selected.value !== "string") {
    context.fail("SPINE_VERSION_INVALID", "skeleton", pointer, span);
  }
  const version = selected.value;
  if (/(?:beta|alpha|rc)[0-9.-]*$/iu.test(version)) {
    context.fail("SPINE_VERSION_PRERELEASE", "skeleton", pointer, span);
  }
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u.exec(version);
  if (!match) context.fail("SPINE_VERSION_INVALID", "skeleton", pointer, span);
  const major = Number(match[1]), minor = Number(match[2]), patch = Number(match[3]);
  if (![major, minor, patch].every(Number.isSafeInteger)) {
    context.fail("SPINE_VERSION_INVALID", "skeleton", pointer, span);
  }
  if (major !== 4 || minor !== 3) context.fail("SPINE_VERSION_MISMATCH", "skeleton", pointer, span);
  return version;
}

type Field = { value: string; span: SpineSourceSpan };
type PageDraft = {
  name: string; pointer: string; span: SpineSourceSpan;
  width: number; height: number; format: SpinePagePlan["format"];
  minFilter: SpinePagePlan["minFilter"]; magFilter: SpinePagePlan["magFilter"];
  repeat: SpinePagePlan["repeat"]; pma: boolean;
  fields: Map<string, Field>; regions: SpineRegionPlan[]; extraFields: ExtraField[];
};
type RegionDraft = {
  name: string; pointer: string; span: SpineSourceSpan;
  index: number; x: number; y: number; width: number; height: number;
  rotation: 0 | 90; offsetLeft: number; offsetBottom: number;
  originalWidth: number; originalHeight: number;
  fields: Map<string, Field>; extraFields: ExtraField[];
};
const formats: readonly SpinePagePlan["format"][] = [
  "Alpha", "Intensity", "LuminanceAlpha", "RGB565", "RGBA4444", "RGB888", "RGBA8888",
];
const filters: readonly SpinePagePlan["minFilter"][] = [
  "Nearest", "Linear", "MipMap", "MipMapNearestNearest", "MipMapLinearNearest",
  "MipMapNearestLinear", "MipMapLinearLinear",
];
const pageHeaders = ["size", "format", "filter", "repeat", "pma"];
const legacyRegionFields = ["xy", "size", "offset", "orig"];
const asciiTrim = (value: string): string => value.replace(/^[ \t]+|[ \t]+$/gu, "");

function integer(
  context: Context, token: string, pointer: string, span: SpineSourceSpan,
  minimum?: number, maximum?: number,
): number {
  if (!/^-?(0|[1-9][0-9]*)$/u.test(token)) context.fail("SPINE_ATLAS_SYNTAX", "atlas", pointer, span);
  const value = Number(token);
  if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
    context.fail("SPINE_LIMIT_EXCEEDED", "atlas", pointer, span);
  }
  if (minimum !== undefined && value < minimum) context.fail("SPINE_ATLAS_SYNTAX", "atlas", pointer, span);
  if (maximum !== undefined && value > maximum) context.fail("SPINE_LIMIT_EXCEEDED", "atlas", pointer, span);
  return value === 0 ? 0 : value;
}

function members(context: Context, raw: string, arity: number, pointer: string, span: SpineSourceSpan): string[] {
  const tokens = raw.split(",").map(asciiTrim);
  if (tokens.length !== arity) context.fail("SPINE_ATLAS_SYNTAX", "atlas", pointer, span);
  return tokens;
}

function numericTuple(
  context: Context, raw: string, ranges: readonly (readonly [number, number])[],
  pointer: string, span: SpineSourceSpan,
): number[] {
  const tokens = members(context, raw, ranges.length, pointer, span), values: number[] = [];
  for (let index = 0; index < ranges.length; index++) {
    const range = ranges[index]!;
    values.push(integer(context, tokens[index]!, pointer, span, range[0], range[1]));
  }
  return values;
}

function token<T extends string>(
  context: Context, raw: string, allowed: readonly T[], pointer: string, span: SpineSourceSpan,
): T {
  const selected = members(context, raw, 1, pointer, span)[0]!;
  if (!allowed.includes(selected as T)) context.fail("SPINE_ATLAS_SYNTAX", "atlas", pointer, span);
  return selected as T;
}

function atlasName(
  context: Context, name: string, pointer: string, span: SpineSourceSpan, page: boolean,
): void {
  const bytes = utf8Length(name);
  if (!bytes.ok) context.fail("SPINE_ATLAS_SYNTAX", "atlas", pointer, span);
  if (bytes.value > (page ? limits.maxPagePathUtf8Bytes : limits.maxNameUtf8Bytes)) {
    context.fail("SPINE_LIMIT_EXCEEDED", "atlas", pointer, span);
  }
  if (name.length === 0 || /[:\u0000-\u001f\u007f]/u.test(name) || page && !isPortablePath(name)) {
    context.fail("SPINE_ATLAS_SYNTAX", "atlas", pointer, span);
  }
}

function fieldParts(context: Context, line: string, pointer: string, span: SpineSourceSpan): [string, string] {
  const colon = line.indexOf(":"), key = asciiTrim(line.slice(0, colon));
  const value = asciiTrim(line.slice(colon + 1));
  if (colon < 0 || !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/u.test(key)) {
    context.fail("SPINE_ATLAS_SYNTAX", "atlas", pointer, span);
  }
  if (value.length === 0) {
    context.fail("SPINE_ATLAS_SYNTAX", "atlas", pointer === "" ? "" : pointer + "/" + escapePointer(key), span);
  }
  return [key, value];
}

function pageField(context: Context, page: PageDraft, key: string, field: Field): void {
  const pointer = page.pointer + "/" + escapePointer(key), span = field.span, raw = field.value;
  if (key === "size") {
    const values = numericTuple(context, raw, [[1, limits.maxAtlasPageDimension], [1, limits.maxAtlasPageDimension]], pointer, span);
    page.width = values[0]!; page.height = values[1]!;
  } else if (key === "format") {
    page.format = token(context, raw, formats, pointer, span);
    if (page.format !== "RGBA8888") observe(context, "atlas-format", pointer, span, raw, true);
  } else if (key === "filter") {
    const values = members(context, raw, 2, pointer, span);
    page.minFilter = token(context, values[0]!, filters, pointer, span);
    page.magFilter = token(context, values[1]!, filters, pointer, span);
    if (page.minFilter !== "Nearest" || page.magFilter !== "Nearest") {
      observe(context, "atlas-sampler", pointer, span, raw, true);
    }
  } else if (key === "repeat") {
    page.repeat = token(context, raw, ["x", "y", "xy", "none"] as const, pointer, span);
    if (page.repeat !== "none") observe(context, "atlas-repeat", pointer, span, raw, true);
  } else if (key === "pma") {
    const selected = token(context, raw, ["true", "false"] as const, pointer, span);
    page.pma = selected === "true";
    if (page.pma) observe(context, "atlas-pma", pointer, span, raw, true);
  } else {
    observe(context, "extra-atlas-field", pointer, span, raw);
    page.extraFields.push(Object.freeze({ key, value: raw, span }));
  }
}

function regionField(context: Context, region: RegionDraft, key: string, field: Field): void {
  const pointer = region.pointer + "/" + escapePointer(key), span = field.span, raw = field.value;
  if (legacyRegionFields.includes(key)) context.fail("SPINE_ATLAS_PROFILE_UNSUPPORTED", "atlas", pointer, span);
  if (key === "bounds") {
    const values = numericTuple(context, raw, [
      [0, limits.maxAtlasRegionCoordinate], [0, limits.maxAtlasRegionCoordinate],
      [1, limits.maxAtlasPackedDimension], [1, limits.maxAtlasPackedDimension],
    ], pointer, span);
    region.x = values[0]!; region.y = values[1]!;
    region.width = values[2]!; region.height = values[3]!;
  } else if (key === "offsets") {
    const values = numericTuple(context, raw, [
      [0, limits.maxAtlasOffset], [0, limits.maxAtlasOffset],
      [1, limits.maxAtlasOriginalDimension], [1, limits.maxAtlasOriginalDimension],
    ], pointer, span);
    region.offsetLeft = values[0]!; region.offsetBottom = values[1]!;
    region.originalWidth = values[2]!; region.originalHeight = values[3]!;
  } else if (key === "index") {
    const selected = members(context, raw, 1, pointer, span)[0]!;
    region.index = integer(context, selected, pointer, span, -1, limits.maxAtlasIndex);
  } else if (key === "rotate") {
    const selected = members(context, raw, 1, pointer, span)[0]!;
    const rotation = selected === "false" ? 0 : selected === "true" ? 90
      : integer(context, selected, pointer, span);
    if (rotation !== 0 && rotation !== 90) context.fail("SPINE_ATLAS_PROFILE_UNSUPPORTED", "atlas", pointer, span);
    region.rotation = rotation;
  } else {
    observe(context, "extra-atlas-field", pointer, span, raw);
    region.extraFields.push(Object.freeze({ key, value: raw, span }));
  }
}

function readAtlas(context: Context, input: SpineTextSource, positions: Location): PageDraft[] {
  const pages: PageDraft[] = [], pageKeys = new Map<string, SpineSourceSpan>();
  const regionKeys = new Map<string, Map<number, SpineSourceSpan>>();
  let page: PageDraft | undefined, region: RegionDraft | undefined, regionCount = 0;
  const pageSize = (selected: PageDraft): void => {
    if (!selected.fields.has("size")) {
      context.fail("SPINE_ATLAS_SYNTAX", "atlas", selected.pointer + "/size", selected.span);
    }
  };
  const finishRegion = (): void => {
    if (!region) return;
    const selected = region, selectedPage = page!, bounds = selected.fields.get("bounds");
    if (!bounds) context.fail("SPINE_ATLAS_SYNTAX", "atlas", selected.pointer + "/bounds", selected.span);
    if (!selected.fields.has("offsets")) {
      selected.originalWidth = selected.width; selected.originalHeight = selected.height;
    }
    // Every involved member has passed complete-token and safe range admission.
    // Rotation changes packed extents, never the logical trimmed/original check.
    const packedWidth = selected.rotation === 90 ? selected.height : selected.width;
    const packedHeight = selected.rotation === 90 ? selected.width : selected.height;
    if (selected.x + packedWidth > selectedPage.width || selected.y + packedHeight > selectedPage.height) {
      context.fail("SPINE_ATLAS_SYNTAX", "atlas", selected.pointer + "/bounds", bounds.span);
    }
    if (selected.offsetLeft + selected.width > selected.originalWidth
      || selected.offsetBottom + selected.height > selected.originalHeight) {
      context.fail("SPINE_ATLAS_SYNTAX", "atlas", selected.pointer + "/offsets",
        selected.fields.get("offsets")!.span);
    }
    const indices = regionKeys.get(selected.name) ?? new Map<number, SpineSourceSpan>();
    const earlier = indices.get(selected.index);
    if (earlier) context.fail("SPINE_ATLAS_DUPLICATE", "atlas", selected.pointer + "/name", selected.span, earlier);
    indices.set(selected.index, selected.span); regionKeys.set(selected.name, indices);
    selectedPage.regions.push({ name: selected.name, index: selected.index,
      x: selected.x, y: selected.y, width: selected.width, height: selected.height,
      rotation: selected.rotation, offsetLeft: selected.offsetLeft, offsetBottom: selected.offsetBottom,
      originalWidth: selected.originalWidth, originalHeight: selected.originalHeight,
      span: selected.span, extraFields: selected.extraFields });
    region = undefined;
  };
  const finishPage = (): void => {
    if (!page) return;
    finishRegion(); pageSize(page);
    pages.push(page); page = undefined;
  };
  const text = input.text;
  for (let start = 0; start < text.length; ) {
    let end = start;
    while (end < text.length && text.charCodeAt(end) !== 13 && text.charCodeAt(end) !== 10) end++;
    const raw = text.slice(start, end), line = asciiTrim(raw);
    let left = 0;
    while (left < raw.length && (raw.charCodeAt(left) === 32 || raw.charCodeAt(left) === 9)) left++;
    const span = positions.span(start + left, line.length);
    const sectionPointer = region?.pointer ?? page?.pointer ?? "";
    const bytes = utf8Length(raw);
    if (!bytes.ok) context.fail("SPINE_ATLAS_SYNTAX", "atlas", sectionPointer, span);
    if (bytes.value > limits.maxAtlasLineUtf8Bytes) {
      context.fail("SPINE_LIMIT_EXCEEDED", "atlas", sectionPointer, span);
    }
    if (line.length === 0) {
      finishPage();
    } else if (line.includes(":")) {
      const section = region ?? page;
      if (section && section.fields.size >= limits.maxAtlasFieldsPerSection) {
        context.fail("SPINE_LIMIT_EXCEEDED", "atlas", section.pointer, span);
      }
      const [key, value] = fieldParts(context, line, sectionPointer, span);
      if (!section) {
        // Recognized initial page headers are an unsupported global header;
        // unknown initial fields are orphan syntax. Neither creates a page.
        context.fail(pageHeaders.includes(key) ? "SPINE_ATLAS_PROFILE_UNSUPPORTED" : "SPINE_ATLAS_SYNTAX",
          "atlas", "", span);
      }
      const pointer = section.pointer + "/" + escapePointer(key);
      const earlier = section.fields.get(key);
      if (earlier) context.fail("SPINE_ATLAS_DUPLICATE", "atlas", pointer, span, earlier.span);
      const field = { value, span };
      if (region) regionField(context, region, key, field); else pageField(context, page!, key, field);
      section.fields.set(key, field);
    } else if (!page) {
      const pointer = "/pages/" + pages.length;
      if (pages.length >= limits.maxAtlasPages) context.fail("SPINE_LIMIT_EXCEEDED", "atlas", pointer, span);
      atlasName(context, line, pointer + "/name", span, true);
      const key = pathCollisionKey(line), earlier = pageKeys.get(key);
      if (earlier) context.fail("SPINE_ATLAS_DUPLICATE", "atlas", pointer + "/name", span, earlier);
      pageKeys.set(key, span);
      page = { name: line, pointer, span, width: 0, height: 0,
        format: "RGBA8888", minFilter: "Nearest", magFilter: "Nearest", repeat: "none", pma: false,
        fields: new Map(), regions: [], extraFields: [] };
    } else {
      finishRegion(); pageSize(page);
      const pointer = page.pointer + "/regions/" + page.regions.length;
      if (regionCount >= limits.maxAtlasRegions) context.fail("SPINE_LIMIT_EXCEEDED", "atlas", pointer, span);
      atlasName(context, line, pointer + "/name", span, false);
      regionCount++;
      region = { name: line, pointer, span, index: -1, x: 0, y: 0, width: 0, height: 0,
        rotation: 0, offsetLeft: 0, offsetBottom: 0, originalWidth: 0, originalHeight: 0,
        fields: new Map(), extraFields: [] };
    }
    start = end;
    if (text.charCodeAt(start) === 13 && text.charCodeAt(start + 1) === 10) start += 2;
    else if (start < text.length) start++;
  }
  finishPage();
  if (pages.length === 0) context.fail("SPINE_ATLAS_SYNTAX", "atlas", "");
  return pages;
}

function bindPages(context: Context, pages: PageDraft[], input: readonly SpinePageBinding[]): SpinePagePlan[] {
  const atlasKeys = new Map(pages.map(page => [pathCollisionKey(page.name), page] as const));
  const keys = new Set<string>(), exact = new Map<string, { binding: SpinePageBinding; index: number }>();
  // Portable admission and uniqueness follow input order before exact atlas
  // matching. A case-only binding cannot manufacture an exact dependency match.
  for (let index = 0; index < input.length; index++) {
    const binding = input[index]!, pointer = "/pages/" + index + "/pageName";
    if (!isPortablePath(binding.pageName)) context.fail("SPINE_PAGE_BINDING_INVALID", "input", pointer);
    const key = pathCollisionKey(binding.pageName);
    if (keys.has(key)) {
      context.fail("SPINE_PAGE_BINDING_INVALID", "input", pointer, undefined, atlasKeys.get(key)?.span);
    }
    keys.add(key); exact.set(binding.pageName, { binding, index });
  }
  const used = new Set<number>(), result: SpinePagePlan[] = [];
  for (const page of pages) {
    const selected = exact.get(page.name);
    if (!selected) context.fail("SPINE_PAGE_BINDING_INVALID", "atlas", page.pointer, page.span);
    used.add(selected.index);
    const binding = selected.binding;
    result.push({ name: page.name, assetId: binding.assetId, provenance: binding.provenance,
      width: page.width, height: page.height, format: page.format,
      minFilter: page.minFilter, magFilter: page.magFilter, repeat: page.repeat, pma: page.pma,
      span: page.span, regions: page.regions, extraFields: page.extraFields });
  }
  for (let index = 0; index < input.length; index++) {
    if (!used.has(index)) context.fail("SPINE_PAGE_BINDING_INVALID", "input", "/pages/" + index + "/pageName");
  }
  return result;
}

export function createSpineImportPlan(input: SpineImportInput): SpineImportResult {
  const sentinel = {}, observations: Observation[] = [];
  let failure: SpineImportDiagnostic | undefined;
  const fail: Failure = (code, source, pointer, span, relatedSpan) => {
    // First cause is immutable, even if a reflection catch re-enters this path.
    failure ??= diagnostic(code, "error", source, pointer, span, relatedSpan);
    throw sentinel;
  };
  const context: Context = { fail, provenanceBytes: 0, observations, concernCount: 0 };
  try {
    const request = record(context, input, ["skeleton", "atlas", "pages"], [], "");
    const skeleton = textSource(context, request.skeleton, "/skeleton");
    const atlas = textSource(context, request.atlas, "/atlas");
    const pageBindings = bindings(context, request.pages);
    const skeletonBytes = rawText(context, "skeleton", skeleton.text);
    const atlasBytes = rawText(context, "atlas", atlas.text);
    const skeletonPositions = location("skeleton", skeleton);
    let root: JsonNode;
    try { root = readSkeleton(context, skeleton, skeletonPositions); }
    catch (cause) {
      if (cause === sentinel) throw cause;
      fail("SPINE_JSON_SYNTAX", "skeleton", "");
    }
    const names = schema(context, root);
    const version = exportVersion(context, root);
    const atlasPages = readAtlas(context, atlas, location("atlas", atlas));
    const pages = bindPages(context, atlasPages, pageBindings);
    // Output owns copied immutable metadata; request objects, parsed JSON and
    // whole source text are not retained. Opaque IDs/provenance stay data:
    // no URLs are resolved and no store, runtime or native authority is obtained.
    const value: SpineImportPlan = {
      planVersion: 1,
      sourceDeclarations: {
        skeleton: { id: skeleton.id, provenance: skeleton.provenance,
          utf8Bytes: skeletonBytes, hashVerification: "declared_unverified" },
        atlas: { id: atlas.id, provenance: atlas.provenance,
          utf8Bytes: atlasBytes, hashVerification: "declared_unverified" },
      },
      exportVersion: version,
      runtimeCandidate: { series: "4.3", package: "@esotericsoftware/spine-core",
        sourceTag: "spine-ts-4.3.13", sourceCommit: "b7beb2ccbbce667a12c02f44d070644f59b04968",
        artifactVerification: "not_run" },
      names, pages, observations,
      acceptance: { animationSemantics: "not_run", rendering: "not_run",
        licenseEntitlement: "unverified", featureInventory: "partial" },
    };
    // Stable export-series admission does not make this runtime/artifact ready,
    // evaluate animation semantics, verify declared hashes or grant a license.
    const diagnostics: SpineImportDiagnostic[] = [];
    const first = context.firstConcern;
    if (first) diagnostics.push(diagnostic("SPINE_PROFILE_UNSUPPORTED", "warning",
      first.span.source, first.pointer, first.span, undefined,
      "Declared renderer profile concerns: " + context.concernCount + "."));
    diagnostics.push(diagnostic("SPINE_INVENTORY_PARTIAL", "warning", "skeleton", "", root.span));
    diagnostics.push(diagnostic("SPINE_PROVENANCE_UNVERIFIED", "warning", "input", ""));
    return freezeOwned({ ok: true as const, value, diagnostics });
  } catch (cause) {
    const fatal = cause === sentinel && failure ? failure
      : diagnostic("SPINE_INPUT_INVALID", "error", "input", "");
    // Every refusal is one fatal, without earlier concerns, partial plans or exceptions.
    return Object.freeze({ ok: false as const, diagnostics: Object.freeze([fatal]) });
  }
}
