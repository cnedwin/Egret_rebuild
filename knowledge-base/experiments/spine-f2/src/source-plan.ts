// SPDX-License-Identifier: Apache-2.0
// The owned snapshot and public SP1 seam precede every experiment-specific numeric check.
import { createSpineImportPlan, SPINE_IMPORT_LIMITS } from '@egret/project/spine';
import type {
  SpineImportInput, SpineImportPlan, SpineImportDiagnostic, SpineSourceSpan,
  SpineProvenance, SpineTextSource, SpinePageBinding,
} from '@egret/project/spine';
import { createSourceView, sourceProperty } from './source-view.js';
import type { SourceNode } from './source-view.js';

export type F2MeshSourceDiagnosticCode =
  | 'F2_INPUT_SHAPE' | 'F2_INPUT_LIMIT' | 'F2_SOURCE_VERSION' | 'F2_SOURCE_VIEW'
  | 'F2_MESH_CONTAINER' | 'F2_MESH_ENCODING' | 'F2_MESH_SHAPE' | 'F2_MESH_NUMBER'
  | 'F2_MESH_UV' | 'F2_MESH_INDEX' | 'F2_MESH_LIMIT' | 'F2_SETUP_REFERENCE'
  | 'F2_INTERNAL_ERROR';

export interface F2MeshSourceDiagnostic {
  readonly code: F2MeshSourceDiagnosticCode;
  readonly severity: 'error';
  readonly source: 'input' | 'skeleton';
  readonly pointer: string;
  readonly message: string;
  readonly span?: SpineSourceSpan;
}

export interface F2MeshSourceSummary {
  readonly pointer: string;
  readonly span: SpineSourceSpan;
  readonly skinName: string;
  readonly slotName: string;
  readonly attachmentName: string;
  readonly vertexCount: number;
  readonly indexCount: number;
  readonly triangleCount: number;
}

export interface F2SetupReference {
  // This identifies the original slot attachment field, not its enclosing slot object.
  readonly slotPointer: string;
  readonly attachmentPointer: string;
  readonly span: SpineSourceSpan;
  readonly vertexCount: number;
  readonly indexCount: number;
}

export interface F2MeshSourcePlan {
  readonly planVersion: 1;
  readonly sp1: SpineImportPlan;
  readonly meshes: readonly F2MeshSourceSummary[];
  readonly setup: {
    readonly references: readonly F2SetupReference[];
    readonly attachmentCount: number;
    readonly vertexCount: number;
    readonly indexCount: number;
  };
  readonly acceptance: {
    readonly rawMeshNumericAdmission: 'passed';
    readonly profileSemantics: 'not_run';
    readonly animationSemantics: 'not_run';
    readonly resourceIdentity: 'not_run';
    readonly coreCompatibility: 'not_run';
    readonly rendering: 'not_run';
    readonly licenseEntitlement: 'unverified';
  };
}

export type F2MeshSourceResult =
  | { readonly ok: true; readonly value: F2MeshSourcePlan;
      readonly diagnostics: readonly SpineImportDiagnostic[] }
  | { readonly ok: false; readonly stage: 'sp1';
      readonly diagnostics: readonly SpineImportDiagnostic[] }
  | { readonly ok: false; readonly stage: 'snapshot' | 'raw' | 'internal';
      readonly diagnostics: readonly [F2MeshSourceDiagnostic] };

type OwnStage = 'snapshot' | 'raw' | 'internal';
type ObjectNode = Extract<SourceNode, { kind: 'object' }>;
type ArrayNode = Extract<SourceNode, { kind: 'array' }>;
type MeshEntry = {
  readonly node: ObjectNode;
  readonly skinName: string;
  readonly slotName: string;
  readonly attachmentName: string;
};
type MeshCount = { readonly vertexCount: number; readonly indexCount: number };

const messages: Readonly<Record<F2MeshSourceDiagnosticCode, string>> = Object.freeze({
  F2_INPUT_SHAPE: 'Input must use the supported ordinary own data shape.',
  F2_INPUT_LIMIT: 'Input exceeds the fixed owned snapshot limit.',
  F2_SOURCE_VERSION: 'The source version must be exactly 4.3.13.',
  F2_SOURCE_VIEW: 'The admitted source could not form a consistent bounded source view.',
  F2_MESH_CONTAINER: 'Raw mesh containers must have the supported data shape.',
  F2_MESH_ENCODING: 'Raw meshes must use independent unweighted coordinates.',
  F2_MESH_SHAPE: 'Raw mesh arrays must have the required coordinate and triangle shape.',
  F2_MESH_NUMBER: 'Raw mesh coordinates and UVs must be finite primitive numbers.',
  F2_MESH_UV: 'Raw mesh UV values must be within zero and one.',
  F2_MESH_INDEX: 'Raw triangle indices must be safe integers within the original vertex range.',
  F2_MESH_LIMIT: 'Raw mesh or setup references exceed a fixed admission limit.',
  F2_SETUP_REFERENCE: 'Static setup references must resolve to an independent mesh or region.',
  F2_INTERNAL_ERROR: 'Source planning could not complete safely.',
});

// A private sentinel preserves the first owned refusal without exposing exception strings.
const planningFaults = new WeakSet<object>();
class PlanningFault {
  constructor(
    readonly code: F2MeshSourceDiagnosticCode,
    readonly stage: OwnStage,
    readonly pointer: string,
    readonly span: SpineSourceSpan | undefined,
  ) { planningFaults.add(this); }
}

function isPlanningFault(value: unknown): value is PlanningFault {
  // Identity membership never reflects on an arbitrary thrown Proxy object.
  return value !== null && typeof value === 'object' && planningFaults.has(value);
}

function stop(code: F2MeshSourceDiagnosticCode, stage: OwnStage,
  pointer: string, span?: SpineSourceSpan): never {
  throw new PlanningFault(code, stage, pointer, span);
}

function copiedSpan(span: SpineSourceSpan): SpineSourceSpan {
  return Object.freeze({ source: span.source, sourceId: span.sourceId,
    offset: span.offset, length: span.length, line: span.line, column: span.column });
}

function refusal(code: F2MeshSourceDiagnosticCode, stage: OwnStage,
  pointer: string, span?: SpineSourceSpan): F2MeshSourceResult {
  const diagnostic: F2MeshSourceDiagnostic = Object.freeze({
    code, severity: 'error', source: stage === 'raw' ? 'skeleton' : 'input',
    pointer, message: messages[code], ...(span === undefined ? {} : { span: copiedSpan(span) }),
  });
  return Object.freeze({ ok: false, stage, diagnostics: Object.freeze([diagnostic] as const) });
}

function ownRecord(value: unknown, pointer: string,
  required: readonly string[], optional: readonly string[] = []): Map<string, unknown> {
  try {
    if (value === null || typeof value !== 'object') stop('F2_INPUT_SHAPE', 'snapshot', pointer);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) stop('F2_INPUT_SHAPE', 'snapshot', pointer);
    const keys = Reflect.ownKeys(value);
    const allowed = new Set([...required, ...optional]);
    if (keys.some(key => typeof key !== 'string' || !allowed.has(key))) {
      stop('F2_INPUT_SHAPE', 'snapshot', pointer);
    }
    const fields = new Map<string, unknown>();
    for (const key of keys) {
      if (typeof key !== 'string') stop('F2_INPUT_SHAPE', 'snapshot', pointer);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
        stop('F2_INPUT_SHAPE', 'snapshot', pointer);
      }
      fields.set(key, descriptor.value as unknown);
    }
    if (required.some(key => !fields.has(key))) stop('F2_INPUT_SHAPE', 'snapshot', pointer);
    return fields;
  } catch (error: unknown) {
    if (isPlanningFault(error)) throw error;
    stop('F2_INPUT_SHAPE', 'snapshot', pointer);
  }
}

function ownString(fields: ReadonlyMap<string, unknown>, key: string, pointer: string): string {
  const value = fields.get(key);
  if (typeof value !== 'string') stop('F2_INPUT_SHAPE', 'snapshot', pointer + '/' + key);
  return value;
}

function ownProvenance(value: unknown, pointer: string): SpineProvenance {
  const fields = ownRecord(value, pointer, ['origin', 'license', 'notice'], ['sha256']);
  const origin = ownString(fields, 'origin', pointer);
  const license = ownString(fields, 'license', pointer);
  const notice = ownString(fields, 'notice', pointer);
  if (fields.has('sha256')) {
    const sha256 = ownString(fields, 'sha256', pointer);
    return Object.freeze({ origin, license, notice, sha256 });
  }
  return Object.freeze({ origin, license, notice });
}

function ownTextSource(value: unknown, pointer: string): SpineTextSource {
  const fields = ownRecord(value, pointer, ['id', 'text', 'provenance']);
  const id = ownString(fields, 'id', pointer);
  const text = ownString(fields, 'text', pointer);
  const provenance = ownProvenance(fields.get('provenance'), pointer + '/provenance');
  return Object.freeze({ id, text, provenance });
}

function ownPage(value: unknown, index: number): SpinePageBinding {
  const pointer = '/pages/' + index;
  const fields = ownRecord(value, pointer, ['pageName', 'assetId', 'provenance']);
  const pageName = ownString(fields, 'pageName', pointer);
  const assetId = ownString(fields, 'assetId', pointer);
  const provenance = ownProvenance(fields.get('provenance'), pointer + '/provenance');
  return Object.freeze({ pageName, assetId, provenance });
}

function ownPages(value: unknown): readonly SpinePageBinding[] {
  let items: unknown[];
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      stop('F2_INPUT_SHAPE', 'snapshot', '/pages');
    }
    const length = Object.getOwnPropertyDescriptor(value, 'length');
    if (length === undefined || !Object.hasOwn(length, 'value') || length.enumerable !== false
      || length.configurable !== false || typeof length.writable !== 'boolean'
      || typeof length.value !== 'number' || !Number.isSafeInteger(length.value) || length.value < 0) {
      stop('F2_INPUT_SHAPE', 'snapshot', '/pages');
    }
    // The fixed copy cap precedes own-key enumeration and every index descriptor.
    if (length.value > SPINE_IMPORT_LIMITS.maxAtlasPages) stop('F2_INPUT_LIMIT', 'snapshot', '/pages');
    const count = length.value as number;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== count + 1) stop('F2_INPUT_SHAPE', 'snapshot', '/pages');
    const allowed = new Set<string>(['length']);
    for (let index = 0; index < count; index++) allowed.add(String(index));
    if (keys.some(key => typeof key !== 'string' || !allowed.has(key))) stop('F2_INPUT_SHAPE', 'snapshot', '/pages');
    items = [];
    for (let index = 0; index < count; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
        stop('F2_INPUT_SHAPE', 'snapshot', '/pages');
      }
      items.push(descriptor.value as unknown);
    }
  } catch (error: unknown) {
    if (isPlanningFault(error)) throw error;
    stop('F2_INPUT_SHAPE', 'snapshot', '/pages');
  }
  return Object.freeze(items.map((item, index) => ownPage(item, index)));
}

function ownInput(input: SpineImportInput): SpineImportInput {
  const fields = ownRecord(input, '', ['skeleton', 'atlas', 'pages']);
  // Copy the complete skeleton before reflecting on atlas or pages. Later traps
  // cannot make either parser reread a caller-mutated skeleton source.
  const skeleton = ownTextSource(fields.get('skeleton'), '/skeleton');
  const atlas = ownTextSource(fields.get('atlas'), '/atlas');
  const pages = ownPages(fields.get('pages'));
  return Object.freeze({ skeleton, atlas, pages });
}

function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code <= 0x7f) bytes++;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff
      && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) {
      bytes += 4;
      index++;
    } else bytes += 3;
  }
  return bytes;
}

function missingPointer(parent: SourceNode, key: string): string {
  const pointer = parent.pointer + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1');
  if (utf8Bytes(pointer) > SPINE_IMPORT_LIMITS.maxDiagnosticPointerUtf8Bytes) {
    // A missing field has no key token: its last admitted parent is the location.
    stop('F2_SOURCE_VIEW', 'raw', parent.pointer, parent.span);
  }
  return pointer;
}

function objectContainer(node: SourceNode): ObjectNode {
  if (node.kind !== 'object') stop('F2_MESH_CONTAINER', 'raw', node.pointer, node.span);
  return node;
}

function meshArray(mesh: ObjectNode, key: string): ArrayNode {
  const selected = sourceProperty(mesh, key);
  if (selected === undefined) stop('F2_MESH_SHAPE', 'raw', missingPointer(mesh, key), mesh.span);
  if (selected.kind !== 'array') stop('F2_MESH_SHAPE', 'raw', selected.pointer, selected.span);
  return selected;
}

function inventory(root: ObjectNode): { readonly meshes: readonly MeshEntry[]; readonly defaultSkin?: ObjectNode } {
  const skins = sourceProperty(root, 'skins');
  const meshes: MeshEntry[] = [];
  let defaultSkin: ObjectNode | undefined;
  if (skins === undefined) return { meshes };
  if (skins.kind !== 'array') stop('F2_MESH_CONTAINER', 'raw', skins.pointer, skins.span);
  for (const item of skins.elements) {
    const skin = objectContainer(item);
    const name = sourceProperty(skin, 'name');
    // SP1 owns skin-name admission; inconsistent successful views fail closed.
    if (name === undefined || name.kind !== 'string') {
      stop('F2_SOURCE_VIEW', 'raw', name?.pointer ?? missingPointer(skin, 'name'), name?.span ?? skin.span);
    }
    if (name.value === 'default') defaultSkin = skin;
    const attachments = sourceProperty(skin, 'attachments');
    if (attachments === undefined) continue;
    const map = objectContainer(attachments);
    // Ordered visitor pairs deliberately avoid integer-key Object.keys sorting.
    for (const slot of map.properties) {
      const slotMap = objectContainer(slot.value);
      for (const attachment of slotMap.properties) {
        const node = objectContainer(attachment.value);
        const type = sourceProperty(node, 'type');
        if (type !== undefined && type.kind !== 'string') stop('F2_MESH_CONTAINER', 'raw', type.pointer, type.span);
        if (type?.value === 'linkedmesh') stop('F2_MESH_ENCODING', 'raw', type.pointer, type.span);
        if (type?.value !== 'mesh') continue;
        for (const field of ['source', 'parent']) {
          const reference = sourceProperty(node, field);
          if (reference !== undefined) stop('F2_MESH_ENCODING', 'raw', reference.pointer, reference.span);
        }
        meshes.push({ node, skinName: name.value, slotName: slot.key, attachmentName: attachment.key });
      }
    }
  }
  return defaultSkin === undefined ? { meshes } : { meshes, defaultSkin };
}

function meshSummary(entry: MeshEntry): F2MeshSourceSummary {
  const mesh = entry.node;
  // Finish each field's shape in contract order before budgets or elements.
  const vertices = meshArray(mesh, 'vertices');
  if (vertices.elements.length < 6 || vertices.elements.length % 2 !== 0) {
    stop('F2_MESH_SHAPE', 'raw', vertices.pointer, vertices.span);
  }
  const uvs = meshArray(mesh, 'uvs');
  if (uvs.elements.length !== vertices.elements.length) stop('F2_MESH_SHAPE', 'raw', uvs.pointer, uvs.span);
  const triangles = meshArray(mesh, 'triangles');
  if (triangles.elements.length < 3 || triangles.elements.length % 3 !== 0) {
    stop('F2_MESH_SHAPE', 'raw', triangles.pointer, triangles.span);
  }
  const vertexCount = vertices.elements.length / 2;
  const indexCount = triangles.elements.length;
  if (vertexCount > 4096) stop('F2_MESH_LIMIT', 'raw', vertices.pointer, vertices.span);
  if (indexCount > 12288) stop('F2_MESH_LIMIT', 'raw', triangles.pointer, triangles.span);
  for (const value of vertices.elements) {
    if (value.kind !== 'number' || !Number.isFinite(value.value)) stop('F2_MESH_NUMBER', 'raw', value.pointer, value.span);
  }
  for (const value of uvs.elements) {
    if (value.kind !== 'number' || !Number.isFinite(value.value)) stop('F2_MESH_NUMBER', 'raw', value.pointer, value.span);
    if (value.value < 0 || value.value > 1) stop('F2_MESH_UV', 'raw', value.pointer, value.span);
  }
  for (const value of triangles.elements) {
    if (value.kind !== 'number' || !Number.isSafeInteger(value.value) || value.value < 0 || value.value >= vertexCount) {
      stop('F2_MESH_INDEX', 'raw', value.pointer, value.span);
    }
  }
  // Counts derive from admitted original arrays, without Float32/Uint16 conversion.
  return Object.freeze({ pointer: mesh.pointer, span: copiedSpan(mesh.span),
    skinName: entry.skinName, slotName: entry.slotName, attachmentName: entry.attachmentName,
    vertexCount, indexCount, triangleCount: indexCount / 3 });
}

function setupReferences(root: ObjectNode, defaultSkin: ObjectNode | undefined,
  counts: ReadonlyMap<SourceNode, MeshCount>): F2MeshSourcePlan['setup'] {
  const references: F2SetupReference[] = [];
  let attachmentCount = 0, vertexCount = 0, indexCount = 0;
  const slots = sourceProperty(root, 'slots');
  if (slots !== undefined) {
    if (slots.kind !== 'array') stop('F2_SETUP_REFERENCE', 'raw', slots.pointer, slots.span);
    for (const slot of slots.elements) {
      if (slot.kind !== 'object') stop('F2_SETUP_REFERENCE', 'raw', slot.pointer, slot.span);
      const reference = sourceProperty(slot, 'attachment');
      if (reference === undefined || reference.kind === 'null') continue;
      if (reference.kind !== 'string' || reference.value.length === 0) {
        stop('F2_SETUP_REFERENCE', 'raw', reference.pointer, reference.span);
      }
      const slotName = sourceProperty(slot, 'name');
      if (slotName === undefined || slotName.kind !== 'string' || defaultSkin === undefined) {
        stop('F2_SETUP_REFERENCE', 'raw', reference.pointer, reference.span);
      }
      const map = sourceProperty(defaultSkin, 'attachments');
      const slotMap = map === undefined ? undefined : sourceProperty(map, slotName.value);
      const attachment = slotMap === undefined ? undefined : sourceProperty(slotMap, reference.value);
      if (attachment === undefined || attachment.kind !== 'object') {
        stop('F2_SETUP_REFERENCE', 'raw', reference.pointer, reference.span);
      }
      const type = sourceProperty(attachment, 'type');
      let count: MeshCount;
      if (type === undefined || type.kind === 'string' && type.value === 'region') {
        count = { vertexCount: 4, indexCount: 6 };
      } else if (type.kind === 'string' && type.value === 'mesh') {
        const admitted = counts.get(attachment);
        if (admitted === undefined) stop('F2_SETUP_REFERENCE', 'raw', reference.pointer, reference.span);
        count = admitted;
      } else stop('F2_SETUP_REFERENCE', 'raw', reference.pointer, reference.span);
      // Every valid slot reference is charged independently; these are logical
      // source counts, never Core commands, batches or GPU draw observations.
      attachmentCount++;
      if (attachmentCount > 32) stop('F2_MESH_LIMIT', 'raw', reference.pointer, reference.span);
      vertexCount += count.vertexCount;
      if (vertexCount > 4096) stop('F2_MESH_LIMIT', 'raw', reference.pointer, reference.span);
      indexCount += count.indexCount;
      if (indexCount > 12288) stop('F2_MESH_LIMIT', 'raw', reference.pointer, reference.span);
      references.push(Object.freeze({ slotPointer: reference.pointer, attachmentPointer: attachment.pointer,
        span: copiedSpan(reference.span), vertexCount: count.vertexCount, indexCount: count.indexCount }));
    }
  }
  return Object.freeze({ references: Object.freeze(references), attachmentCount, vertexCount, indexCount });
}

// Only sibling planners receive this transient context; the index never exports it.
type F2SourcePreparation =
  | { readonly ok: false; readonly result: Extract<F2MeshSourceResult, { readonly ok: false }> }
  | { readonly ok: true; readonly result: Extract<F2MeshSourceResult, { readonly ok: true }>;
      readonly owned: SpineImportInput; readonly root: SourceNode };

export function prepareF2MeshSource(input: SpineImportInput): F2SourcePreparation {
  try {
    const owned = ownInput(input);
    const sp1 = createSpineImportPlan(owned);
    // SP1 fatal diagnostics are forwarded intact; no second visitor runs here.
    if (!sp1.ok) {
      const result: Extract<F2MeshSourceResult, { readonly ok: false }> =
        Object.freeze({ ok: false, stage: 'sp1', diagnostics: sp1.diagnostics });
      return { ok: false, result };
    }
    const view = createSourceView(owned.skeleton.text, owned.skeleton.id);
    if (!view.ok) stop('F2_SOURCE_VIEW', 'raw', view.pointer, view.span);
    const root = view.root;
    if (root.kind !== 'object') stop('F2_SOURCE_VIEW', 'raw', root.pointer, root.span);
    const skeleton = sourceProperty(root, 'skeleton');
    const version = skeleton === undefined ? undefined : sourceProperty(skeleton, 'spine');
    if (version === undefined || version.kind !== 'string') {
      stop('F2_SOURCE_VIEW', 'raw', '/skeleton/spine', version?.span ?? skeleton?.span ?? root.span);
    }
    if (sp1.value.exportVersion !== '4.3.13') stop('F2_SOURCE_VERSION', 'raw', version.pointer, version.span);
    // All source containers/encodings are admitted before any mesh's numerics.
    const selected = inventory(root);
    const counts = new Map<SourceNode, MeshCount>();
    const meshes: F2MeshSourceSummary[] = [];
    for (const entry of selected.meshes) {
      const summary = meshSummary(entry);
      meshes.push(summary);
      counts.set(entry.node, { vertexCount: summary.vertexCount, indexCount: summary.indexCount });
    }
    const setup = setupReferences(root, selected.defaultSkin, counts);
    const value: F2MeshSourcePlan = Object.freeze({
      planVersion: 1, sp1: sp1.value, meshes: Object.freeze(meshes), setup,
      acceptance: Object.freeze({ rawMeshNumericAdmission: 'passed', profileSemantics: 'not_run',
        animationSemantics: 'not_run', resourceIdentity: 'not_run', coreCompatibility: 'not_run',
        rendering: 'not_run', licenseEntitlement: 'unverified' }),
    });
    // Only copied summaries/spans and SP1's owned frozen result escape this call.
    const result: Extract<F2MeshSourceResult, { readonly ok: true }> =
      Object.freeze({ ok: true, value, diagnostics: sp1.diagnostics });
    return { ok: true, result, owned, root };
  } catch (error: unknown) {
    const result = isPlanningFault(error)
      ? refusal(error.code, error.stage, error.pointer, error.span)
      : refusal('F2_INTERNAL_ERROR', 'internal', '');
    return { ok: false, result: result as Extract<F2MeshSourceResult, { readonly ok: false }> };
  }
}

// The public A facade still drops owned text and the private positional source view.
export function createF2MeshSourcePlan(input: SpineImportInput): F2MeshSourceResult {
  return prepareF2MeshSource(input).result;
}
