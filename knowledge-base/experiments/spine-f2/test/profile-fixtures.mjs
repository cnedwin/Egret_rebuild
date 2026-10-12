// SPDX-License-Identifier: Apache-2.0
// Test-owned source strings and literal expectations; no Core or profile implementation is an oracle.
import assert from 'node:assert/strict';
import { originalText, atlasText, request, f2Baseline, requireFactory,
  allFrozen, frozen, edit, spine } from './fixtures.mjs';

export { originalText, atlasText, request, allFrozen, frozen, edit, spine };
export const meshPointer = '/skins/0/attachments/back/lPanel';
export const deformPointer = '/animations/unfold/attachments/default/back/lPanel/deform';
export const profileMessages = Object.freeze({
  SHAPE: 'The source must use the supported static profile shape.',
  FIELD: 'The source contains a field outside the supported static profile.',
  ATLAS: 'The profile requires one untrimmed nearest straight-alpha atlas page.',
  REFERENCE: 'A profile reference must resolve to the required source target.',
  TRANSFORM: 'Setup transforms and colors must use the supported fixed profile.',
  NUMBER: 'Profile values must satisfy the finite numeric domain.',
  TIME: 'Linear timeline times must remain strictly ordered in binary64 and Float32.',
  DEFORM: 'Deform data must fit the original independent mesh coordinates.',
  LIMIT: 'The profile exceeds a fixed source or expanded-data budget.',
  REQUIRED: 'The profile requires an active mesh and an active linear deform timeline.',
  INTERNAL: 'Profile planning could not complete safely.',
});
export const profileAcceptance = Object.freeze({ sourceProfile: 'passed',
  linearTimelineSourceAdmission: 'passed', coreCompatibility: 'not_run', poseNumerics: 'not_run',
  resourceIdentity: 'not_run', playback: 'not_run', rendering: 'not_run', licenseEntitlement: 'unverified' });

export function keys(value, expected) {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
}
export function ordinary(value) {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.getPrototypeOf(value), Array.isArray(value) ? Array.prototype : Object.prototype);
  assert.equal(Reflect.ownKeys(value).every(key => typeof key === 'string'), true);
  for (const key of Object.keys(value)) ordinary(value[key]);
}
export function unique(text, needle) {
  const offset = text.indexOf(needle);
  assert.notEqual(offset, -1, 'TEST_SOURCE_SELECTOR_MUST_EXIST: ' + needle);
  assert.equal(text.indexOf(needle, offset + 1), -1, 'TEST_SOURCE_SELECTOR_MUST_BE_UNIQUE: ' + needle);
  return offset;
}
// The complete source-authoring segment is unique; repeated bare numbers are never searched.
export function at(text, needle, token, relative = 0, source = 'skeleton') {
  const offset = unique(text, needle) + relative;
  assert.equal(text.slice(offset, offset + token.length), token);
  const preceding = text.slice(0, offset).split(/\r\n|\r|\n/);
  return { source, sourceId: 'egret-f2-original-' + source, offset, length: token.length,
    line: preceding.length, column: preceding.at(-1).length + 1 };
}
export function after(text, prefix, token, source = 'skeleton') {
  return at(text, prefix + token, token, prefix.length, source);
}
export function data() { return JSON.parse(originalText); }
export function inputOf(value) { return request(JSON.stringify(value)); }
export function deform(value) { return value.animations.unfold.attachments.default.back.lPanel.deform; }
export function mesh(value) { return value.skins[0].attachments.back.lPanel; }
export function frameAt(input, frames, index, field) {
  const serialized = JSON.stringify(frames);
  const frame = JSON.stringify(frames[index]);
  const priorLength = frames.slice(0, index).reduce((length, item) => length + JSON.stringify(item).length + 1, 0);
  const prefix = '"deform":[';
  const opening = prefix.length + priorLength;
  if (field === undefined) return at(input.skeleton.text, '"deform":' + serialized, '{', opening);
  const fieldPrefix = '"' + field + '":';
  const fieldOffset = unique(frame, fieldPrefix) + fieldPrefix.length;
  return at(input.skeleton.text, '"deform":' + serialized, JSON.stringify(frames[index][field]), opening + fieldOffset);
}
export function sparseFrames(count, step = 1 / 128) {
  return Array.from({ length: count }, (_, index) => ({ time: index * step }));
}
export function budgetData(vertexCount, frameCount, animationCount = 1) {
  const value = data();
  value.skins[0].attachments.back.lPanel = { type: 'mesh', path: 'egret-f2-mesh',
    vertices: Array(vertexCount * 2).fill(0), uvs: Array(vertexCount * 2).fill(0), triangles: [0, 1, 2] };
  value.animations = Object.fromEntries(Array.from({ length: animationCount }, (_, index) =>
    ['anim' + index, { attachments: { default: { back: { lPanel: { deform: sparseFrames(frameCount) } } } } }]));
  return value;
}
export function factory(namespace) {
  assert.equal(typeof namespace.createF2MeshProfilePlan, 'function', 'F2_MESH_PROFILE_PLAN_REQUIRED');
  return namespace.createF2MeshProfilePlan;
}

export function assertSuccess(namespace, input, expectedRows) {
  const publicPlan = spine.createSpineImportPlan(input);
  assert.ok(publicPlan.ok, 'PROFILE_POSITIVE_MUST_HAVE_GENUINE_PUBLIC_SP1');
  const source = requireFactory(namespace)(input);
  assert.ok(source.ok, 'PROFILE_POSITIVE_MUST_HAVE_GENUINE_RETAINED_A');
  const result = factory(namespace)(input);
  assert.ok(result.ok, 'PROFILE_POSITIVE_REQUIRED');
  keys(result, ['ok', 'value', 'diagnostics']);
  const plan = result.value;
  keys(plan, ['planVersion', 'profile', 'sourcePlan', 'ownedInput', 'page', 'bones', 'slots',
    'attachments', 'animations', 'acceptance']);
  assert.equal(plan.planVersion, 1);
  assert.equal(plan.profile, 'static-unweighted-linear-4.3.13');
  assert.deepEqual(plan.sourcePlan, source.value);
  assert.deepEqual(plan.ownedInput, input);
  assert.notEqual(plan.ownedInput, input);
  assert.notEqual(plan.ownedInput.skeleton, input.skeleton);
  assert.notEqual(plan.ownedInput.skeleton.provenance, input.skeleton.provenance);
  assert.notEqual(plan.ownedInput.atlas, input.atlas);
  assert.notEqual(plan.ownedInput.pages, input.pages);
  for (let index = 0; index < input.pages.length; index++) {
    assert.notEqual(plan.ownedInput.pages[index], input.pages[index]);
    assert.notEqual(plan.ownedInput.pages[index].provenance, input.pages[index].provenance);
  }
  assert.deepEqual(plan.acceptance, profileAcceptance);
  assert.deepEqual(result.diagnostics, publicPlan.diagnostics);
  assert.deepEqual(result.diagnostics.map(d => d.code),
    ['SPINE_PROFILE_UNSUPPORTED', 'SPINE_INVENTORY_PARTIAL', 'SPINE_PROVENANCE_UNVERIFIED']);
  keys(plan.page, ['pageName', 'assetId', 'width', 'height', 'regionCount']);
  for (const bone of plan.bones) keys(bone, ['name', 'pointer', 'span', 'parentIndex', 'depth', 'x', 'y']);
  for (const slot of plan.slots) keys(slot, ['name', 'pointer', 'span', 'boneIndex', 'attachmentPointer']);
  for (const attachment of plan.attachments) keys(attachment,
    ['pointer', 'span', 'slotIndex', 'attachmentName', 'path', 'kind', 'vertexCount', 'indexCount']);
  for (const animation of plan.animations) {
    keys(animation, ['name', 'pointer', 'span', 'duration', 'timelineCount', 'keyframeCount',
      'expandedDeformScalarCount', 'timelines']);
    for (const timeline of animation.timelines) keys(timeline, ['kind', 'pointer', 'span', 'boneIndex',
      'slotIndex', 'attachmentPointer', 'keyframeCount', 'firstTime', 'lastTime', 'expandedDeformScalarCount']);
  }
  if (expectedRows !== undefined) assert.deepEqual(plan.animations.map(a =>
    [a.name, a.duration, a.timelineCount, a.keyframeCount, a.expandedDeformScalarCount]), expectedRows);
  ordinary(result);
  allFrozen(result);
  return result;
}

// Every assigned counterexample calls this full original-A and literal-B control first.
export function originalControl(namespace) {
  const source = f2Baseline(requireFactory(namespace));
  const result = assertSuccess(namespace, request(), [['unfold', 1, 1, 2, 24]]);
  const plan = result.value;
  assert.deepEqual(plan.sourcePlan, source.value);
  assert.deepEqual(plan.page, { pageName: 'egret-f2-page.rgba', assetId: 'egret-f2-original-page',
    width: 16, height: 8, regionCount: 2 });
  assert.deepEqual(plan.bones, [{ name: 'root', pointer: '/bones/0',
    span: at(originalText, '{ "name": "root" }', '{'), parentIndex: -1, depth: 1, x: 0, y: 0 }]);
  assert.deepEqual(plan.slots, [
    { name: 'back', pointer: '/slots/0', span: at(originalText, '{ "name": "back", "bone"', '{'),
      boneIndex: 0, attachmentPointer: meshPointer },
    { name: 'front', pointer: '/slots/1', span: at(originalText, '{ "name": "front", "bone"', '{'),
      boneIndex: 0, attachmentPointer: '/skins/0/attachments/front/bluePanel' },
  ]);
  assert.deepEqual(plan.attachments, [
    { pointer: meshPointer, span: at(originalText, '"lPanel": {\n            "type"', '{', '"lPanel": '.length),
      slotIndex: 0, attachmentName: 'lPanel', path: 'egret-f2-mesh', kind: 'mesh', vertexCount: 6, indexCount: 12 },
    { pointer: '/skins/0/attachments/front/bluePanel',
      span: at(originalText, '"bluePanel": { "type"', '{', '"bluePanel": '.length),
      slotIndex: 1, attachmentName: 'bluePanel', path: 'egret-f2-blue', kind: 'region', vertexCount: 4, indexCount: 6 },
  ]);
  const animation = plan.animations[0];
  assert.equal(animation.pointer, '/animations/unfold');
  assert.deepEqual(animation.span, at(originalText, '"unfold": {\n      "attachments"', '{', '"unfold": '.length));
  assert.deepEqual(animation.timelines, [{ kind: 'deform', pointer: deformPointer,
    span: after(originalText, '"deform": ', '['), boneIndex: null, slotIndex: 0,
    attachmentPointer: meshPointer, keyframeCount: 2, firstTime: 0, lastTime: 1, expandedDeformScalarCount: 24 }]);
  return result;
}

export function rejection(namespace, input, code, pointer, expectedSpan, source = 'skeleton', baseline) {
  originalControl(namespace);
  if (baseline !== undefined) assertSuccess(namespace, baseline.input, baseline.rows);
  assert.ok(spine.createSpineImportPlan(input).ok, 'B_COUNTEREXAMPLE_MUST_PASS_REAL_SP1');
  assert.ok(requireFactory(namespace)(input).ok, 'B_COUNTEREXAMPLE_MUST_PASS_REAL_A');
  const result = factory(namespace)(input);
  assert.deepEqual(result, { ok: false, stage: 'profile', diagnostics: [{ code: 'F2_PROFILE_' + code,
    severity: 'error', source, pointer, message: profileMessages[code],
    ...(expectedSpan === undefined ? {} : { span: expectedSpan }) }] });
  ordinary(result);
  allFrozen(result);
  return result;
}

export function inheritedRefusal(namespace, input, stage, code, pointer, expectedSpan) {
  originalControl(namespace);
  const source = requireFactory(namespace)(input);
  assert.equal(source.ok, false, 'ASSIGNED_A_FIRST_REFUSAL_REQUIRED');
  assert.equal(source.stage, stage);
  assert.equal(source.diagnostics[0].code, code);
  assert.equal(source.diagnostics[0].pointer, pointer);
  if (expectedSpan !== undefined) assert.deepEqual(source.diagnostics[0].span, expectedSpan);
  assert.deepEqual(factory(namespace)(input), source);
  allFrozen(source);
  return source;
}
