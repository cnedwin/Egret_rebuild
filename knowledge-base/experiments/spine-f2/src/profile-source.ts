// SPDX-License-Identifier: Apache-2.0
// Qualify original source nodes in staged order; never reconstruct JSON or narrow mesh numbers.
import type { SpineSourceSpan } from '@egret/project/spine';
import type { F2MeshSourcePlan } from './source-plan.js';
import type { F2MeshProfileDiagnostic, F2MeshProfileDiagnosticCode, F2MeshProfilePlan } from './profile-plan.js';
import { sourceProperty } from './source-view.js';
import type { SourceNode } from './source-view.js';

type ObjectNode = Extract<SourceNode, { readonly kind: 'object' }>;
type ArrayNode = Extract<SourceNode, { readonly kind: 'array' }>;
type SourceProperty = ObjectNode['properties'][number];
type Bone = F2MeshProfilePlan['bones'][number];
type Slot = F2MeshProfilePlan['slots'][number];
type Attachment = F2MeshProfilePlan['attachments'][number];
type Animation = F2MeshProfilePlan['animations'][number];
type Timeline = Animation['timelines'][number];
type ProfileData = Pick<F2MeshProfilePlan, 'page' | 'bones' | 'slots' | 'attachments' | 'animations'>;
type Qualification = { readonly ok: true; readonly data: ProfileData }
  | { readonly ok: false; readonly diagnostic: F2MeshProfileDiagnostic };
type FieldKind = SourceNode['kind'] | 'string-null';
type Field = readonly [key: string, kind: FieldKind, required?: true];
type TimelineEntry = {
  readonly kind: 'translate' | 'deform'; readonly array: ArrayNode;
  readonly boneIndex: number | null; readonly slotIndex: number | null;
  readonly attachment: Attachment | null;
};

const messages: Readonly<Record<F2MeshProfileDiagnosticCode, string>> = Object.freeze({
  F2_PROFILE_SHAPE: 'The source must use the supported static profile shape.',
  F2_PROFILE_FIELD: 'The source contains a field outside the supported static profile.',
  F2_PROFILE_ATLAS: 'The profile requires one untrimmed nearest straight-alpha atlas page.',
  F2_PROFILE_REFERENCE: 'A profile reference must resolve to the required source target.',
  F2_PROFILE_TRANSFORM: 'Setup transforms and colors must use the supported fixed profile.',
  F2_PROFILE_NUMBER: 'Profile values must satisfy the finite numeric domain.',
  F2_PROFILE_TIME: 'Linear timeline times must remain strictly ordered in binary64 and Float32.',
  F2_PROFILE_DEFORM: 'Deform data must fit the original independent mesh coordinates.',
  F2_PROFILE_LIMIT: 'The profile exceeds a fixed source or expanded-data budget.',
  F2_PROFILE_REQUIRED: 'The profile requires an active mesh and an active linear deform timeline.',
  F2_PROFILE_INTERNAL: 'Profile planning could not complete safely.',
});

const faults = new WeakSet<object>();
class ProfileFault {
  constructor(readonly diagnostic: F2MeshProfileDiagnostic) { faults.add(this); }
}
function copySpan(span: SpineSourceSpan): SpineSourceSpan {
  return Object.freeze({ source: span.source, sourceId: span.sourceId, offset: span.offset,
    length: span.length, line: span.line, column: span.column });
}
function diagnostic(code: F2MeshProfileDiagnosticCode, pointer: string,
  span?: SpineSourceSpan): F2MeshProfileDiagnostic {
  return Object.freeze({ code, severity: 'error', source: span?.source ?? 'input', pointer,
    message: messages[code], ...(span === undefined ? {} : { span: copySpan(span) }) });
}
export function createProfileInternalDiagnostic(): F2MeshProfileDiagnostic {
  return diagnostic('F2_PROFILE_INTERNAL', '');
}
function stop(code: F2MeshProfileDiagnosticCode, node: SourceNode): never {
  throw new ProfileFault(diagnostic(code, node.pointer, node.span));
}
function atKey(code: F2MeshProfileDiagnosticCode, property: SourceProperty): never {
  throw new ProfileFault(diagnostic(code, property.value.pointer, property.keySpan));
}
function utf8Bytes(value: string): number {
  let count = 0;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) count++;
    else if (code <= 0x7ff) count += 2;
    else if (code >= 0xd800 && code <= 0xdbff && value.charCodeAt(index + 1) >= 0xdc00
      && value.charCodeAt(index + 1) <= 0xdfff) { count += 4; index++; }
    else count += 3;
  }
  return count;
}
function pointerFor(parent: SourceNode, key: string): string {
  const pointer = parent.pointer + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1');
  return utf8Bytes(pointer) <= 2048 ? pointer : parent.pointer;
}
function missing(code: F2MeshProfileDiagnosticCode, parent: SourceNode, key: string): never {
  throw new ProfileFault(diagnostic(code, pointerFor(parent, key), parent.span));
}
function object(node: SourceNode): ObjectNode {
  if (node.kind !== 'object') stop('F2_PROFILE_SHAPE', node);
  return node;
}
function array(node: SourceNode): ArrayNode {
  if (node.kind !== 'array') stop('F2_PROFILE_SHAPE', node);
  return node;
}
function required(parent: SourceNode, key: string): SourceNode {
  const node = sourceProperty(parent, key);
  if (node === undefined) missing('F2_PROFILE_SHAPE', parent, key);
  return node;
}
function text(node: SourceNode): string {
  if (node.kind !== 'string') stop('F2_PROFILE_SHAPE', node);
  return node.value;
}
function scalar(node: SourceNode): number {
  if (node.kind !== 'number') stop('F2_PROFILE_SHAPE', node);
  return node.value;
}
function name(node: SourceNode): string {
  const value = text(node);
  if (value.length === 0 || utf8Bytes(value) > 256) stop('F2_PROFILE_REFERENCE', node);
  return value;
}
function namedKey(property: SourceProperty): string {
  if (property.key.length === 0 || utf8Bytes(property.key) > 256) atKey('F2_PROFILE_REFERENCE', property);
  return property.key;
}

// Unknown keys, missing required fields, and listed kinds are separate ordered passes.
function shape(node: SourceNode, fields: readonly Field[]): ObjectNode {
  const value = object(node);
  for (const property of value.properties) {
    if (!fields.some(field => field[0] === property.key)) atKey('F2_PROFILE_FIELD', property);
  }
  for (const [key, , needed] of fields) {
    if (needed === true && sourceProperty(value, key) === undefined) missing('F2_PROFILE_SHAPE', value, key);
  }
  for (const [key, kind] of fields) {
    const member = sourceProperty(value, key);
    if (member !== undefined && (kind === 'string-null'
      ? member.kind !== 'string' && member.kind !== 'null' : member.kind !== kind)) {
      stop('F2_PROFILE_SHAPE', member);
    }
  }
  return value;
}
const rootFields: readonly Field[] = [
  ['skeleton', 'object', true], ['bones', 'array', true], ['slots', 'array', true],
  ['skins', 'array', true], ['animations', 'object', true],
];
const skeletonFields: readonly Field[] = [
  ['spine', 'string', true], ['hash', 'string'], ['x', 'number'], ['y', 'number'],
  ['width', 'number'], ['height', 'number'], ['fps', 'number'], ['images', 'string'],
  ['audio', 'string'], ['referenceScale', 'number'],
];
const boneFields: readonly Field[] = [
  ['name', 'string', true], ['parent', 'string'], ['x', 'number'], ['y', 'number'],
  ['length', 'number'], ['rotation', 'number'], ['shearX', 'number'], ['shearY', 'number'],
  ['scaleX', 'number'], ['scaleY', 'number'], ['inherit', 'string'], ['skin', 'boolean'],
  ['color', 'string'], ['icon', 'string'], ['iconSize', 'number'], ['iconRotation', 'number'],
];
const slotFields: readonly Field[] = [
  ['name', 'string', true], ['bone', 'string', true], ['attachment', 'string-null'],
  ['color', 'string'], ['blend', 'string'], ['visible', 'boolean'],
];
const skinFields: readonly Field[] = [
  ['name', 'string', true], ['attachments', 'object', true], ['color', 'string'],
];
const regionFields: readonly Field[] = [
  ['width', 'number', true], ['height', 'number', true], ['type', 'string'],
  ['name', 'string'], ['path', 'string'], ['x', 'number'], ['y', 'number'],
  ['rotation', 'number'], ['scaleX', 'number'], ['scaleY', 'number'], ['color', 'string'],
];
const meshFields: readonly Field[] = [
  ['type', 'string', true], ['vertices', 'array', true], ['uvs', 'array', true],
  ['triangles', 'array', true], ['name', 'string'], ['path', 'string'], ['color', 'string'],
  ['width', 'number'], ['height', 'number'], ['hull', 'number'], ['edges', 'array'],
];
const animationFields: readonly Field[] = [['bones', 'object'], ['attachments', 'object']];
const translateFields: readonly Field[] = [['time', 'number'], ['x', 'number'], ['y', 'number']];
const deformFields: readonly Field[] = [['time', 'number'], ['offset', 'number'], ['vertices', 'array']];

function shapeTimeline(node: SourceNode, kind: 'translate' | 'deform'): void {
  for (const frame of array(node).elements) {
    const checked = shape(frame, kind === 'translate' ? translateFields : deformFields);
    if (kind === 'deform') {
      const vertices = sourceProperty(checked, 'vertices');
      if (vertices !== undefined) {
        // Member kinds belong to global structure, before any frame numeric domain.
        for (const item of array(vertices).elements) if (item.kind !== 'number') stop('F2_PROFILE_SHAPE', item);
      }
    }
  }
}
function globalShape(root: SourceNode): ObjectNode {
  const checked = shape(root, rootFields);
  shape(required(checked, 'skeleton'), skeletonFields);
  for (const bone of array(required(checked, 'bones')).elements) shape(bone, boneFields);
  for (const slot of array(required(checked, 'slots')).elements) shape(slot, slotFields);
  for (const skin of array(required(checked, 'skins')).elements) {
    const selected = shape(skin, skinFields);
    for (const slot of object(required(selected, 'attachments')).properties) {
      for (const attachment of object(slot.value).properties) {
        const type = sourceProperty(object(attachment.value), 'type');
        shape(attachment.value, type?.kind === 'string' && type.value === 'mesh' ? meshFields : regionFields);
      }
    }
  }
  for (const animation of object(required(checked, 'animations')).properties) {
    const selected = shape(animation.value, animationFields);
    for (const branch of selected.properties) {
      if (branch.key === 'bones') {
        for (const bone of object(branch.value).properties) {
          const entry = shape(bone.value, [['translate', 'array']]);
          for (const timeline of entry.properties) shapeTimeline(timeline.value, 'translate');
        }
      } else {
        for (const skin of object(branch.value).properties) {
          for (const slot of object(skin.value).properties) {
            for (const attachment of object(slot.value).properties) {
              const entry = shape(attachment.value, [['deform', 'array']]);
              for (const timeline of entry.properties) shapeTimeline(timeline.value, 'deform');
            }
          }
        }
      }
    }
  }
  return checked;
}

function number(node: SourceNode, minimum: number, maximum: number, minimumExclusive = false): number {
  if (node.kind !== 'number') stop('F2_PROFILE_NUMBER', node);
  const value = node.value;
  if (!Number.isFinite(value) || (minimumExclusive ? value <= minimum : value < minimum) || value > maximum) {
    stop('F2_PROFILE_NUMBER', node);
  }
  return value;
}
function optionalNumber(parent: SourceNode, key: string, fallback: number,
  minimum = -65536, maximum = 65536): number {
  const member = sourceProperty(parent, key);
  return member === undefined ? fallback : number(member, minimum, maximum);
}
function fixedNumber(parent: SourceNode, key: string, expected: number): void {
  const member = sourceProperty(parent, key);
  if (member === undefined) return;
  const value = scalar(member);
  if (!Number.isFinite(value)) stop('F2_PROFILE_NUMBER', member);
  if (value !== expected) stop('F2_PROFILE_TRANSFORM', member);
}
function fixedString(parent: SourceNode, key: string, expected: string): void {
  const member = sourceProperty(parent, key);
  if (member !== undefined && text(member) !== expected) stop('F2_PROFILE_TRANSFORM', member);
}
function fixedBoolean(parent: SourceNode, key: string, expected: boolean): void {
  const member = sourceProperty(parent, key);
  if (member === undefined) return;
  if (member.kind !== 'boolean') stop('F2_PROFILE_SHAPE', member);
  if (member.value !== expected) stop('F2_PROFILE_TRANSFORM', member);
}
function editorColor(parent: SourceNode): void {
  const member = sourceProperty(parent, 'color');
  if (member !== undefined && !/^[0-9a-fA-F]{8}$/.test(text(member))) stop('F2_PROFILE_TRANSFORM', member);
}
function count(node: SourceNode, size: number, minimum: number, maximum: number): void {
  if (size < minimum || size > maximum) stop('F2_PROFILE_LIMIT', node);
}

function atlas(sourcePlan: F2MeshSourcePlan): F2MeshProfilePlan['page'] {
  const pages = sourcePlan.sp1.pages;
  const page = pages[0];
  if (pages.length !== 1 || page === undefined) {
    throw new ProfileFault(diagnostic('F2_PROFILE_ATLAS', '/pages', page?.span));
  }
  const pagePointer = '/pages/0';
  const fail = (code: F2MeshProfileDiagnosticCode, pointer = pagePointer, span = page.span): never => {
    throw new ProfileFault(diagnostic(code, pointer, span));
  };
  if (page.width > 2048 || page.height > 2048 || page.width * page.height * 4 > 16777216) fail('F2_PROFILE_LIMIT');
  if (page.format !== 'RGBA8888' || page.minFilter !== 'Nearest' || page.magFilter !== 'Nearest'
    || page.repeat !== 'none' || page.pma !== false) fail('F2_PROFILE_ATLAS');
  const pageExtra = page.extraFields[0];
  if (pageExtra !== undefined) fail('F2_PROFILE_ATLAS', pointerForAtlas(pagePointer, pageExtra.key), pageExtra.span);
  if (page.regions.length < 1 || page.regions.length > 64) fail('F2_PROFILE_LIMIT', pagePointer + '/regions');
  for (let index = 0; index < page.regions.length; index++) {
    const region = page.regions[index];
    if (region === undefined) throw new Error('Inconsistent owned atlas inventory.');
    const pointer = pagePointer + '/regions/' + index;
    if (region.rotation !== 0 || region.offsetLeft !== 0 || region.offsetBottom !== 0
      || region.originalWidth !== region.width || region.originalHeight !== region.height || region.index !== -1) {
      fail('F2_PROFILE_ATLAS', pointer, region.span);
    }
    const extra = region.extraFields[0];
    if (extra !== undefined) fail('F2_PROFILE_ATLAS', pointerForAtlas(pointer, extra.key), extra.span);
  }
  return Object.freeze({ pageName: page.name, assetId: page.assetId,
    width: page.width, height: page.height, regionCount: page.regions.length });
}
function pointerForAtlas(parent: string, key: string): string {
  const pointer = parent + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1');
  return utf8Bytes(pointer) <= 2048 ? pointer : parent;
}

function skeletonMetadata(node: SourceNode): void {
  optionalNumber(node, 'x', 0); optionalNumber(node, 'y', 0);
  optionalNumber(node, 'width', 0, 0); optionalNumber(node, 'height', 0, 0);
  const fps = sourceProperty(node, 'fps');
  if (fps !== undefined) number(fps, 0, 240, true);
  const referenceScale = sourceProperty(node, 'referenceScale');
  if (referenceScale !== undefined) number(referenceScale, 100, 100);
}

function bones(root: ObjectNode): readonly Bone[] {
  const nodes = array(required(root, 'bones'));
  count(nodes, nodes.elements.length, 1, 32);
  const result: Bone[] = [];
  const byName = new Map<string, number>();
  for (const node of nodes.elements) {
    const nameNode = required(node, 'name');
    const boneName = name(nameNode);
    if (byName.has(boneName)) stop('F2_PROFILE_REFERENCE', nameNode);
    const parent = sourceProperty(node, 'parent');
    let parentIndex = -1, depth = 1;
    if (result.length === 0) {
      if (parent !== undefined) stop('F2_PROFILE_REFERENCE', parent);
    } else {
      if (parent === undefined) missing('F2_PROFILE_REFERENCE', node, 'parent');
      const selected = byName.get(name(parent));
      if (selected === undefined) stop('F2_PROFILE_REFERENCE', parent);
      parentIndex = selected;
      const prior = result[selected];
      if (prior === undefined) throw new Error('Inconsistent bone reference.');
      depth = prior.depth + 1;
      if (depth > 8) stop('F2_PROFILE_LIMIT', parent);
    }
    const x = optionalNumber(node, 'x', 0), y = optionalNumber(node, 'y', 0);
    optionalNumber(node, 'length', 0, 0);
    fixedNumber(node, 'rotation', 0); fixedNumber(node, 'shearX', 0); fixedNumber(node, 'shearY', 0);
    fixedNumber(node, 'scaleX', 1); fixedNumber(node, 'scaleY', 1);
    fixedString(node, 'inherit', 'normal'); fixedBoolean(node, 'skin', false); editorColor(node);
    optionalNumber(node, 'iconSize', 0, 0); optionalNumber(node, 'iconRotation', 0);
    byName.set(boneName, result.length);
    result.push(Object.freeze({ name: boneName, pointer: node.pointer, span: copySpan(node.span),
      parentIndex, depth, x, y }));
  }
  return Object.freeze(result);
}

function animationReferences(node: ObjectNode, boneList: readonly Bone[], slotList: readonly Slot[],
  attachmentList: readonly Attachment[]): readonly TimelineEntry[] {
  const boneByName = new Map(boneList.map((bone, index) => [bone.name, index] as const));
  const slotByName = new Map(slotList.map((slot, index) => [slot.name, index] as const));
  const bySlot = new Map<number, Map<string, Attachment>>();
  for (const attachment of attachmentList) {
    let map = bySlot.get(attachment.slotIndex);
    if (map === undefined) { map = new Map(); bySlot.set(attachment.slotIndex, map); }
    map.set(attachment.attachmentName, attachment);
  }
  const entries: TimelineEntry[] = [];
  // Every dynamic target is checked, including empty children, before any timeline count.
  for (const branch of node.properties) {
    if (branch.key === 'bones') {
      for (const bone of object(branch.value).properties) {
        const boneIndex = boneByName.get(namedKey(bone));
        if (boneIndex === undefined) atKey('F2_PROFILE_REFERENCE', bone);
        for (const timeline of object(bone.value).properties) {
          entries.push({ kind: 'translate', array: array(timeline.value), boneIndex,
            slotIndex: null, attachment: null });
        }
      }
    } else {
      for (const skin of object(branch.value).properties) {
        if (namedKey(skin) !== 'default') atKey('F2_PROFILE_REFERENCE', skin);
        for (const slot of object(skin.value).properties) {
          const slotIndex = slotByName.get(namedKey(slot));
          if (slotIndex === undefined) atKey('F2_PROFILE_REFERENCE', slot);
          for (const target of object(slot.value).properties) {
            const attachment = bySlot.get(slotIndex)?.get(namedKey(target));
            if (attachment === undefined || attachment.kind !== 'mesh') atKey('F2_PROFILE_REFERENCE', target);
            for (const timeline of object(target.value).properties) {
              entries.push({ kind: 'deform', array: array(timeline.value), boneIndex: null,
                slotIndex, attachment });
            }
          }
        }
      }
    }
  }
  return entries;
}

function timelineValues(entry: TimelineEntry, expandedDeformScalarCount: number): Timeline {
  let firstTime = 0, lastTime = 0, previousFloat = 0;
  const frames = entry.array.elements;
  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index];
    if (frame === undefined) throw new Error('Inconsistent timeline inventory.');
    const timeNode = sourceProperty(frame, 'time');
    const time = timeNode === undefined ? 0 : number(timeNode, 0, 60);
    const location = timeNode ?? frame;
    // Semantic range and binary64 ordering precede the separate Float32 qualification.
    if (index === 0 ? time !== 0 : time <= lastTime) stop('F2_PROFILE_TIME', location);
    const float = Math.fround(time);
    if (!Number.isFinite(float) || index !== 0 && float <= previousFloat) stop('F2_PROFILE_TIME', location);
    if (index === frames.length - 1 && time <= 0) stop('F2_PROFILE_TIME', location);
    if (index === 0) firstTime = time;
    lastTime = time; previousFloat = float;
    if (entry.kind === 'translate') {
      optionalNumber(frame, 'x', 0); optionalNumber(frame, 'y', 0);
    } else {
      const attachment = entry.attachment;
      if (attachment === null) throw new Error('Missing admitted deform target.');
      const coordinateCount = attachment.vertexCount * 2;
      const offsetNode = sourceProperty(frame, 'offset');
      const offset = offsetNode === undefined ? 0 : scalar(offsetNode);
      if (!Number.isFinite(offset)) stop('F2_PROFILE_NUMBER', offsetNode ?? frame);
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > coordinateCount) {
        stop('F2_PROFILE_DEFORM', offsetNode ?? frame);
      }
      const vertices = sourceProperty(frame, 'vertices');
      if (offsetNode !== undefined && vertices === undefined) stop('F2_PROFILE_DEFORM', offsetNode);
      if (vertices !== undefined) {
        const values = array(vertices);
        for (const value of values.elements) number(value, -65536, 65536);
        if (offset + values.elements.length > coordinateCount) stop('F2_PROFILE_DEFORM', offsetNode ?? values);
      }
    }
  }
  return Object.freeze({ kind: entry.kind, pointer: entry.array.pointer, span: copySpan(entry.array.span),
    boneIndex: entry.boneIndex, slotIndex: entry.slotIndex,
    attachmentPointer: entry.attachment?.pointer ?? null, keyframeCount: frames.length,
    firstTime, lastTime, expandedDeformScalarCount });
}

function animations(root: ObjectNode, boneList: readonly Bone[], slotList: readonly Slot[],
  attachmentList: readonly Attachment[]): readonly Animation[] {
  const map = object(required(root, 'animations'));
  count(map, map.properties.length, 1, 8);
  const result: Animation[] = [];
  let assetExpanded = 0, hasActiveDeform = false;
  for (const property of map.properties) {
    const animationName = namedKey(property);
    const node = object(property.value);
    const entries = animationReferences(node, boneList, slotList, attachmentList);
    count(node, entries.length, 1, 128);
    let keyframeCount = 0;
    // Finish all frame counts before charging any expanded payload or reading frame values.
    for (const entry of entries) {
      count(entry.array, entry.array.elements.length, 2, 4096);
      keyframeCount += entry.array.elements.length;
      if (keyframeCount > 4096) stop('F2_PROFILE_LIMIT', entry.array);
    }
    let expandedDeformScalarCount = 0;
    const charges: number[] = [];
    for (const entry of entries) {
      const charge = entry.kind === 'deform'
        ? (entry.attachment?.vertexCount ?? 0) * 2 * entry.array.elements.length : 0;
      expandedDeformScalarCount += charge;
      if (expandedDeformScalarCount > 262144) stop('F2_PROFILE_LIMIT', entry.array);
      assetExpanded += charge;
      if (assetExpanded > 1048576) stop('F2_PROFILE_LIMIT', entry.array);
      charges.push(charge);
    }
    const timelines: Timeline[] = [];
    let duration = 0;
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index], charge = charges[index];
      if (entry === undefined || charge === undefined) throw new Error('Inconsistent expanded inventory.');
      const timeline = timelineValues(entry, charge);
      timelines.push(timeline);
      duration = Math.max(duration, timeline.lastTime);
      if (entry.kind === 'deform' && entry.slotIndex !== null && entry.attachment !== null
        && slotList[entry.slotIndex]?.attachmentPointer === entry.attachment.pointer) hasActiveDeform = true;
    }
    result.push(Object.freeze({ name: animationName, pointer: node.pointer, span: copySpan(node.span),
      duration, timelineCount: entries.length, keyframeCount, expandedDeformScalarCount,
      timelines: Object.freeze(timelines) }));
  }
  if (!hasActiveDeform) stop('F2_PROFILE_REQUIRED', map);
  return Object.freeze(result);
}

export function qualifyF2Profile(root: SourceNode, sourcePlan: F2MeshSourcePlan): Qualification {
  try {
    const selected = globalShape(root);
    const page = atlas(sourcePlan);
    skeletonMetadata(required(selected, 'skeleton'));
    const boneList = bones(selected);
    const slotList = slots(selected, boneList, sourcePlan);
    const attachmentList = attachments(selected, slotList, sourcePlan);
    const setupPointers = new Set(slotList.map(slot => slot.attachmentPointer));
    if (!attachmentList.some(attachment => attachment.kind === 'mesh' && setupPointers.has(attachment.pointer))) {
      stop('F2_PROFILE_REQUIRED', required(selected, 'slots'));
    }
    const animationList = animations(selected, boneList, slotList, attachmentList);
    return { ok: true, data: Object.freeze({ page, bones: boneList, slots: slotList,
      attachments: attachmentList, animations: animationList }) };
  } catch (error: unknown) {
    // WeakSet identity avoids inspecting arbitrary thrown objects or exposing their messages.
    const value = error !== null && typeof error === 'object' && faults.has(error)
      ? (error as ProfileFault).diagnostic : createProfileInternalDiagnostic();
    return { ok: false, diagnostic: value };
  }
}

function slots(root: ObjectNode, boneList: readonly Bone[], sourcePlan: F2MeshSourcePlan): readonly Slot[] {
  const nodes = array(required(root, 'slots'));
  count(nodes, nodes.elements.length, 1, 32);
  const byBone = new Map(boneList.map((bone, index) => [bone.name, index] as const));
  const result: Slot[] = [];
  const names = new Set<string>();
  const setup = new Map(sourcePlan.setup.references.map(item => [item.slotPointer, item.attachmentPointer] as const));
  for (const node of nodes.elements) {
    const nameNode = required(node, 'name');
    const slotName = name(nameNode);
    if (names.has(slotName)) stop('F2_PROFILE_REFERENCE', nameNode);
    const boneNode = required(node, 'bone');
    const boneIndex = byBone.get(name(boneNode));
    if (boneIndex === undefined) stop('F2_PROFILE_REFERENCE', boneNode);
    const attachment = sourceProperty(node, 'attachment');
    let attachmentPointer: string | null = null;
    if (attachment !== undefined && attachment.kind !== 'null') {
      name(attachment);
      const selected = setup.get(attachment.pointer);
      if (selected === undefined) stop('F2_PROFILE_REFERENCE', attachment);
      attachmentPointer = selected;
    }
    fixedString(node, 'color', 'ffffffff'); fixedString(node, 'blend', 'normal');
    fixedBoolean(node, 'visible', true);
    names.add(slotName);
    result.push(Object.freeze({ name: slotName, pointer: node.pointer, span: copySpan(node.span),
      boneIndex, attachmentPointer }));
  }
  return Object.freeze(result);
}

function attachments(root: ObjectNode, slotList: readonly Slot[], sourcePlan: F2MeshSourcePlan): readonly Attachment[] {
  const skins = array(required(root, 'skins'));
  count(skins, skins.elements.length, 1, 1);
  const skin = skins.elements[0];
  if (skin === undefined) throw new Error('Inconsistent skin inventory.');
  const skinName = required(skin, 'name');
  name(skinName);
  if (text(skinName) !== 'default') stop('F2_PROFILE_TRANSFORM', skinName);
  editorColor(skin);
  const map = object(required(skin, 'attachments'));
  let total = 0;
  for (const slot of map.properties) total += object(slot.value).properties.length;
  count(map, total, 1, 64);
  const slotByName = new Map(slotList.map((slot, index) => [slot.name, index] as const));
  const meshCounts = new Map(sourcePlan.meshes.map(mesh => [mesh.pointer, mesh] as const));
  const atlasNames = new Set(sourcePlan.sp1.pages[0]?.regions.map(region => region.name));
  const result: Attachment[] = [];
  for (const slot of map.properties) {
    const slotIndex = slotByName.get(namedKey(slot));
    if (slotIndex === undefined) atKey('F2_PROFILE_REFERENCE', slot);
    for (const entry of object(slot.value).properties) {
      const attachmentName = namedKey(entry);
      const node = entry.value;
      const explicitName = sourceProperty(node, 'name');
      const named = explicitName === undefined ? attachmentName : name(explicitName);
      const pathNode = sourceProperty(node, 'path');
      const path = pathNode === undefined ? named : name(pathNode);
      if (!atlasNames.has(path)) {
        if (pathNode !== undefined) stop('F2_PROFILE_REFERENCE', pathNode);
        if (explicitName !== undefined) stop('F2_PROFILE_REFERENCE', explicitName);
        atKey('F2_PROFILE_REFERENCE', entry);
      }
      const type = sourceProperty(node, 'type');
      const kind = type?.kind === 'string' && type.value === 'mesh' ? 'mesh' : 'region';
      let vertexCount: number, indexCount: number;
      if (kind === 'mesh') {
        const summary = meshCounts.get(node.pointer);
        if (summary === undefined) throw new Error('Inconsistent admitted mesh.');
        vertexCount = summary.vertexCount; indexCount = summary.indexCount;
        // A checked original finite arrays; B only adds its coordinate magnitude domain.
        for (const vertex of array(required(node, 'vertices')).elements) number(vertex, -65536, 65536);
        fixedString(node, 'color', 'ffffffff');
        optionalNumber(node, 'width', 0, 0); optionalNumber(node, 'height', 0, 0);
        const hull = sourceProperty(node, 'hull');
        if (hull !== undefined) {
          const value = number(hull, 0, vertexCount);
          if (!Number.isSafeInteger(value)) stop('F2_PROFILE_NUMBER', hull);
        }
        const edges = sourceProperty(node, 'edges');
        if (edges !== undefined) {
          const items = array(edges);
          if (items.elements.length > 24576) stop('F2_PROFILE_LIMIT', items);
          if (items.elements.length % 2 !== 0) stop('F2_PROFILE_NUMBER', items);
          for (const item of items.elements) {
            const value = number(item, 0, vertexCount - 1);
            if (!Number.isSafeInteger(value)) stop('F2_PROFILE_NUMBER', item);
          }
        }
      } else {
        vertexCount = 4; indexCount = 6;
        number(required(node, 'width'), 0, 65536, true);
        number(required(node, 'height'), 0, 65536, true);
        fixedString(node, 'type', 'region');
        optionalNumber(node, 'x', 0); optionalNumber(node, 'y', 0);
        fixedNumber(node, 'rotation', 0); fixedNumber(node, 'scaleX', 1); fixedNumber(node, 'scaleY', 1);
        fixedString(node, 'color', 'ffffffff');
      }
      result.push(Object.freeze({ pointer: node.pointer, span: copySpan(node.span), slotIndex,
        attachmentName, path, kind, vertexCount, indexCount }));
    }
  }
  return Object.freeze(result);
}
