// SPDX-License-Identifier: Apache-2.0
// First-party source-only F2-A test inputs; no Core or product helper creates an oracle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as spine from '@egret/project/spine';

export const assetNames = Object.freeze([
  'egret-original-unfold.spine.json', 'egret-original-unfold.atlas',
  'egret-f2-page-rgba.json', 'egret-f2-page.rgba',
  'f2-geometry-oracle-candidate.json', 'f2-pixel-oracle-candidate.json',
  'f2-raw-triangle-control-proposals.json',
]);
export const assets = Object.freeze(Object.fromEntries(assetNames.map(name =>
  [name, fs.readFileSync(new URL('../assets/' + name, import.meta.url))])));
export const originalText = assets[assetNames[0]].toString('utf8');
export const atlasText = assets[assetNames[1]].toString('utf8');
export const meshPointer = '/skins/0/attachments/back/lPanel';
export const messages = Object.freeze({
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
export function request(text = originalText) {
  const provenance = () => ({ origin: 'Egret original F2 fixture', license: 'Apache-2.0',
    notice: 'First-party authored test data; not an Editor export or runtime entitlement.' });
  return { skeleton: { id: 'egret-f2-original-skeleton', text, provenance: provenance() },
    atlas: { id: 'egret-f2-original-atlas', text: atlasText, provenance: provenance() },
    pages: [{ pageName: 'egret-f2-page.rgba', assetId: 'egret-f2-original-page', provenance: provenance() }] };
}
export function frozen(value) {
  if (value !== null && typeof value === 'object') {
    for (const key of Reflect.ownKeys(value)) frozen(value[key]);
    Object.freeze(value);
  }
  return value;
}
export function allFrozen(value) {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const key of Reflect.ownKeys(value)) allFrozen(value[key]);
}
export function publicBaseline() {
  assert.equal(typeof spine.createSpineImportPlan, 'function', 'SP1_PUBLIC_NAMESPACE_REQUIRED');
  assert.equal(spine.SPINE_IMPORT_LIMITS.maxAtlasPages, 64);
  const rgba = JSON.parse(assets['egret-f2-page-rgba.json'].toString('utf8'));
  assert.equal(assets['egret-f2-page.rgba'].length, 512);
  assert.deepEqual(Array.from(assets['egret-f2-page.rgba']), rgba.bytes);
  const parsed = JSON.parse(originalText);
  const mesh = parsed.skins[0].attachments.back.lPanel;
  assert.deepEqual(mesh.vertices, [0,0,12,0,12,4,4,4,4,12,0,12]);
  assert.deepEqual(mesh.uvs, [0,1,1,1,1,0.5,0.5,0.5,0.5,0,0,0]);
  assert.deepEqual(mesh.triangles, [0,1,3,1,2,3,0,3,5,3,4,5]);
  const planned = spine.createSpineImportPlan(request());
  assert.equal(planned.ok, true, 'SP1_ORIGINAL_FIXTURE_BASELINE_REQUIRED');
  assert.equal(planned.value.exportVersion, '4.3.13');
  assert.deepEqual(planned.value.names.slots, ['back', 'front']);
  assert.deepEqual(planned.value.names.skins, ['default']);
  assert.equal(planned.value.pages.length, 1);
  assert.deepEqual(planned.value.pages[0].regions.map(x => x.name), ['egret-f2-mesh', 'egret-f2-blue']);
  assert.equal(planned.value.pages[0].assetId, 'egret-f2-original-page');
  assert.deepEqual(planned.diagnostics.map(x => x.code),
    ['SPINE_PROFILE_UNSUPPORTED', 'SPINE_INVENTORY_PARTIAL', 'SPINE_PROVENANCE_UNVERIFIED']);
  assert.equal(planned.value.acceptance.rendering, 'not_run');
  allFrozen(planned);
  return planned;
}
export function requireFactory(namespace) {
  assert.equal(typeof namespace.createF2MeshSourcePlan, 'function', 'F2_MESH_SOURCE_PLAN_REQUIRED');
  return namespace.createF2MeshSourcePlan;
}
export function legal(create, input = request()) {
  publicBaseline();
  const sp1 = spine.createSpineImportPlan(input);
  assert.equal(sp1.ok, true, 'MUTANT_INPUT_MUST_HAVE_A_GENUINE_SP1_SUCCESS');
  return create(input);
}
export function f2Baseline(create) {
  const result = legal(create);
  assert.equal(result.ok, true);
  assert.equal(result.value.planVersion, 1);
  assert.equal(result.value.meshes.length, 1);
  assert.deepEqual(result.value.meshes.map(m => [m.pointer, m.skinName, m.slotName,
    m.attachmentName, m.vertexCount, m.indexCount, m.triangleCount]),
    [[meshPointer, 'default', 'back', 'lPanel', 6, 12, 4]]);
  assert.deepEqual(result.value.meshes[0].span, span(originalText,
    originalText.indexOf('"lPanel": {\n            "type"') + '"lPanel": '.length, '{'));
  assert.deepEqual(result.value.setup.references.map(r => [r.slotPointer, r.attachmentPointer,
    r.vertexCount, r.indexCount]), [
    ['/slots/0/attachment', meshPointer, 6, 12],
    ['/slots/1/attachment', '/skins/0/attachments/front/bluePanel', 4, 6],
  ]);
  assert.deepEqual([result.value.setup.attachmentCount, result.value.setup.vertexCount,
    result.value.setup.indexCount], [2, 10, 18]);
  for (const [index, token] of [[0, '"lPanel"'], [1, '"bluePanel"']]) {
    const anchor = '"attachment": ' + token;
    assert.deepEqual(result.value.setup.references[index].span,
      span(originalText, originalText.indexOf(anchor) + '"attachment": '.length, token));
  }
  assert.deepEqual(result.value.acceptance, { rawMeshNumericAdmission: 'passed',
    profileSemantics: 'not_run', animationSemantics: 'not_run', resourceIdentity: 'not_run',
    coreCompatibility: 'not_run', rendering: 'not_run', licenseEntitlement: 'unverified' });
  const sp1 = spine.createSpineImportPlan(request());
  assert.deepEqual(result.value.sp1, sp1.value);
  assert.deepEqual(result.diagnostics, sp1.diagnostics);
  allFrozen(result);
  return result;
}
export function reject(result, code, pointer, span) {
  assert.deepEqual(Object.keys(result).sort(), ['diagnostics', 'ok', 'stage']);
  assert.equal(result.ok, false);
  assert.equal(result.stage, code.startsWith('F2_INPUT_') ? 'snapshot'
    : code === 'F2_INTERNAL_ERROR' ? 'internal' : 'raw');
  assert.equal(result.diagnostics.length, 1);
  const d = result.diagnostics[0];
  assert.deepEqual(Object.keys(d).sort(),
    (span === undefined ? ['code', 'message', 'pointer', 'severity', 'source']
      : ['code', 'message', 'pointer', 'severity', 'source', 'span']).sort());
  assert.equal(d.code, code);
  assert.equal(d.message, messages[code]);
  assert.equal(d.severity, 'error');
  assert.equal(d.source, result.stage === 'raw' ? 'skeleton' : 'input');
  assert.equal(d.pointer, pointer);
  if (span === undefined) assert.equal(Object.hasOwn(d, 'span'), false);
  else assert.deepEqual(d.span, span);
  assert.equal(Object.hasOwn(result, 'value'), false);
  assert.equal(Object.hasOwn(result, 'meshes'), false);
  allFrozen(result);
  return d;
}
export function sp1Failure(create, input) {
  f2Baseline(create);
  const before = spine.createSpineImportPlan(input);
  assert.equal(before.ok, false, 'SP1_FIRST_REFUSAL_REQUIRED');
  const result = create(input);
  assert.deepEqual(result, { ok: false, stage: 'sp1', diagnostics: before.diagnostics });
  allFrozen(result);
  return before;
}
export function span(text, offset, token, sourceId = 'egret-f2-original-skeleton') {
  assert.equal(text.slice(offset, offset + token.length), token);
  const lines = text.slice(0, offset).split(/\r\n|\r|\n/);
  return { source: 'skeleton', sourceId, offset, length: token.length,
    line: lines.length, column: lines.at(-1).length + 1 };
}
// Locate a unique source-authoring segment, never a bare repeated numeric token.
export function edit(text, before, after) {
  const offset = text.indexOf(before);
  assert.notEqual(offset, -1);
  assert.equal(text.indexOf(before, offset + before.length), -1);
  const changed = text.slice(0, offset) + after + text.slice(offset + before.length);
  assert.equal(changed.slice(0, offset) + before + changed.slice(offset + after.length), text);
  return { text: changed, offset };
}
export function replaceMesh(before, after) { return edit(originalText, before, after); }
export function numericMesh(vertexCount = 3, indexCount = 3) {
  return { type: 'mesh', vertices: Array(vertexCount * 2).fill(0),
    uvs: Array(vertexCount * 2).fill(0), triangles: Array(indexCount).fill(0) };
}
export function source({ slots = [], skins = [{ name: 'default', attachments: {} }], version = '4.3.13' } = {}) {
  return JSON.stringify({ skeleton: { spine: version }, bones: [{ name: 'root' }], slots, skins });
}
export function meshSource(mesh, more = {}) {
  return source({ slots: [], skins: [{ name: 'default', attachments: { back: { lPanel: mesh }, ...more } }] });
}
export function opening(text, uniquePrefix) {
  const offset = text.indexOf(uniquePrefix);
  assert.notEqual(offset, -1);
  assert.equal(text.indexOf(uniquePrefix, offset + 1), -1);
  const start = offset + uniquePrefix.length;
  return span(text, start, text[start]);
}
export function setupSource(meshes) {
  return source({ slots: meshes.map((_, i) => ({ name: 's' + i, bone: 'root', attachment: 'a' })),
    skins: [{ name: 'default', attachments: Object.fromEntries(meshes.map((m, i) => ['s' + i, { a: m }])) }] });
}
export { spine };
