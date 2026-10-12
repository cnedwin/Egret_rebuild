// SPDX-License-Identifier: Apache-2.0
// Standalone opt-in source-plan tests. No Core, Engine, renderer or private SDK imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as namespace from '../dist/index.js';
import { request, originalText, meshPointer, messages, frozen, allFrozen,
  requireFactory, legal, f2Baseline, reject, sp1Failure, span, edit, replaceMesh,
  numericMesh, source, meshSource, opening, setupSource } from './fixtures.mjs';

const create = input => requireFactory(namespace)(input);

test('F2A01 original literal plan owns frozen summaries and retains SP1 warnings', () => {
  const result = f2Baseline(create);
  const input = frozen(request());
  assert.equal(legal(create, input).ok, true, 'FROZEN_READONLY_INPUT_REQUIRED');
  const mutable = request();
  const old = legal(create, mutable);
  const saved = JSON.stringify(old);
  mutable.skeleton.text = '{}';
  mutable.skeleton.provenance.notice = 'changed';
  mutable.pages[0].assetId = 'changed';
  mutable.pages.length = 0;
  assert.equal(JSON.stringify(old), saved);
  assert.notEqual(old.value.sp1.sourceDeclarations.skeleton.provenance, mutable.skeleton.provenance);
  assert.equal(Object.hasOwn(result.value, 'text'), false);
  assert.equal(Object.hasOwn(result.value, 'input'), false);
  assert.equal(Object.keys(messages).length, 13);
  allFrozen(old);
});

test('F2A02 snapshot descriptors reject without getters and use fixed record order', () => {
  const cases = [
    [input => { delete input.skeleton; }, ''],
    [input => { input.extra = 1; }, ''],
    [input => { input[Symbol('extra')] = 1; }, ''],
    [input => { Object.setPrototypeOf(input.skeleton, { inherited: 1 }); }, '/skeleton'],
    [input => { input.skeleton.id = 1; }, '/skeleton/id'],
    [input => { input.atlas.text = null; }, '/atlas/text'],
    [input => { input.pages[0].provenance.notice = false; }, '/pages/0/provenance/notice'],
    [input => { delete input.pages[0]; }, '/pages'],
    [input => { input.pages.extra = 1; }, '/pages'],
    [input => { input.pages = Object.assign(Object.create(Array.prototype), { length: 1, 0: input.pages[0] }); }, '/pages'],
  ];
  for (const [mutate, pointer] of cases) {
    f2Baseline(create);
    const input = request(); mutate(input);
    reject(create(input), 'F2_INPUT_SHAPE', pointer);
  }
  for (const location of ['root', 'source', 'index']) {
    f2Baseline(create);
    const input = request(); let reads = 0;
    const getter = () => { reads++; throw new Error('GETTER_MUST_NOT_RUN'); };
    if (location === 'root') Object.defineProperty(input, 'skeleton', { enumerable: true, get: getter });
    if (location === 'source') Object.defineProperty(input.skeleton, 'text', { enumerable: true, get: getter });
    if (location === 'index') Object.defineProperty(input.pages, '0', { enumerable: true, get: getter });
    reject(create(input), 'F2_INPUT_SHAPE', location === 'root' ? '' : location === 'source' ? '/skeleton' : '/pages');
    assert.equal(reads, 0);
  }
  f2Baseline(create);
  const reflectFailure = request();
  reflectFailure.atlas = new Proxy(reflectFailure.atlas, { ownKeys() { throw new Error('PRIVATE_TRAP_DETAIL'); } });
  const d = reject(create(reflectFailure), 'F2_INPUT_SHAPE', '/atlas');
  assert.equal(d.message.includes('PRIVATE_TRAP_DETAIL'), false);
});

test('F2A03 pages basic length precedes cap, which precedes full density inspection', () => {
  for (const style of ['hole', 'accessor']) {
    f2Baseline(create);
    const input = request(); const pages = Array(65); let getterReads = 0, keys = 0, indices = 0;
    if (style === 'accessor') Object.defineProperty(pages, '0', { enumerable: true, get() { getterReads++; return input.pages[0]; } });
    input.pages = new Proxy(pages, { ownKeys(target) { keys++; return Reflect.ownKeys(target); },
      getOwnPropertyDescriptor(target, key) { if (/^\d+$/.test(String(key))) indices++; return Reflect.getOwnPropertyDescriptor(target, key); } });
    reject(create(input), 'F2_INPUT_LIMIT', '/pages');
    assert.deepEqual([getterReads, keys, indices], [0, 0, 0]);
  }
  for (const style of ['hole', 'accessor']) {
    f2Baseline(create);
    const input = request(); input.pages = Array(64); let reads = 0;
    if (style === 'accessor') Object.defineProperty(input.pages, '0', { enumerable: true, get() { reads++; return {}; } });
    reject(create(input), 'F2_INPUT_SHAPE', '/pages'); assert.equal(reads, 0);
  }
  const input = request();
  input.pages = frozen(Array.from({ length: 64 }, (_, i) => ({ ...input.pages[0],
    pageName: 'p' + i + '.rgba', assetId: 'a' + i, provenance: { ...input.pages[0].provenance } })));
  sp1Failure(create, input); // Ordinary frozen dense array passes snapshot; atlas mismatch remains SP1.
  f2Baseline(create);
  const basic = request(); basic.pages = new Proxy(Array(65), { getPrototypeOf() { return null; } });
  reject(create(basic), 'F2_INPUT_SHAPE', '/pages');
});

test('F2A04 SP1 fatal fields and first refusal remain unchanged before raw checks', () => {
  const badTriangle = replaceMesh('"triangles": [0,', '"triangles": [65536,').text;
  for (const text of [badTriangle.replace('"spine": "4.3.13"', '"spine": "4.2.13"'),
    badTriangle.replace('"skeleton": {', '"skeleton": { "spine": "4.3.13",'),
    badTriangle.replace('"vertices": [0,', '"vertices": [NaN,'),
    badTriangle.replace('"vertices": [0,', '"vertices": [Infinity,'),
    badTriangle.replace('"vertices": [0,', '"vertices": [1e400,')]) {
    sp1Failure(create, request(text));
  }
  const atlas = request(badTriangle); atlas.atlas.text = 'broken'; sp1Failure(create, atlas);
  const binding = request(badTriangle); binding.pages[0].assetId = ''; sp1Failure(create, binding);
  const schema = request(source({ skins: [{ name: 'default', attachments: null }] })); sp1Failure(create, schema);
  const metadata = request(badTriangle); metadata.skeleton.id = ''; sp1Failure(create, metadata);
});

test('F2A05 exact stable patch version uses the original version token', () => {
  f2Baseline(create);
  const changed = edit(originalText, '"4.3.13"', '"4.3.12"');
  reject(legal(create, request(changed.text)), 'F2_SOURCE_VERSION', '/skeleton/spine',
    span(changed.text, changed.offset, '"4.3.12"'));
});

test('F2A06 each raw triangle token rejects before any narrowing with exact location', () => {
  for (const token of ['65536', '0.5', '-1', '6', '"0"', 'null']) {
    f2Baseline(create);
    const changed = replaceMesh('"triangles": [0,', '"triangles": [' + token + ',');
    reject(legal(create, request(changed.text)), 'F2_MESH_INDEX', meshPointer + '/triangles/0',
      span(changed.text, changed.offset + '"triangles": ['.length, token));
  }
  f2Baseline(create);
  const changed = replaceMesh('"triangles": [0, 1, 3, 1, 2, 3, 0, 3, 5, 3, 4, 5]',
    '"triangles": [0, 1, 3, 1, 2, 3, 6, 3, 5, 3, 4, 5]');
  const offset = changed.offset + '"triangles": [0, 1, 3, 1, 2, 3, '.length;
  reject(legal(create, request(changed.text)), 'F2_MESH_INDEX', meshPointer + '/triangles/6', span(changed.text, offset, '6'));
});

test('F2A07 shape then coordinate then UV then index precedence uses original tokens', () => {
  const cases = [
    ['"vertices": [0, 0, 12, 0, 12, 4, 4, 4, 4, 12, 0, 12]', '"vertices": null', 'F2_MESH_SHAPE', '/vertices', 'null', '"vertices": '],
    ['"vertices": [0, 0, 12, 0, 12, 4, 4, 4, 4, 12, 0, 12]', '"vertices": [0, 0, 12, 0, 12]', 'F2_MESH_SHAPE', '/vertices', '[', '"vertices": '],
    ['"uvs": [0, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0, 0, 0]', '"uvs": [0, 1]', 'F2_MESH_SHAPE', '/uvs', '[', '"uvs": '],
    ['"triangles": [0, 1, 3, 1, 2, 3, 0, 3, 5, 3, 4, 5]', '"triangles": [0, 1, 3, 1]', 'F2_MESH_SHAPE', '/triangles', '[', '"triangles": '],
    ['"vertices": [0, 0, 12, 0, 12, 4, 4, 4, 4, 12, 0, 12]', '"vertices": ["x", 0, 12, 0, 12, 4, 4, 4, 4, 12, 0, 12]', 'F2_MESH_NUMBER', '/vertices/0', '"x"', '"vertices": ['],
    ['"uvs": [0, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0, 0, 0]', '"uvs": [null, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0, 0, 0]', 'F2_MESH_NUMBER', '/uvs/0', 'null', '"uvs": ['],
    ['"uvs": [0, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0, 0, 0]', '"uvs": [-0.01, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0, 0, 0]', 'F2_MESH_UV', '/uvs/0', '-0.01', '"uvs": ['],
    ['"uvs": [0, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0, 0, 0]', '"uvs": [1.01, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0, 0, 0]', 'F2_MESH_UV', '/uvs/0', '1.01', '"uvs": ['],
  ];
  for (const [before, after, code, pointer, token, prefix] of cases) {
    f2Baseline(create); const changed = replaceMesh(before, after);
    reject(legal(create, request(changed.text)), code, meshPointer + pointer,
      span(changed.text, changed.offset + prefix.length, token));
  }
  f2Baseline(create);
  const missing = originalText.replace('"vertices": [0, 0, 12, 0, 12, 4, 4, 4, 4, 12, 0, 12]', '"ignored": 0');
  const meshOpening = missing.indexOf('"lPanel": {\n            "type"') + '"lPanel": '.length;
  reject(legal(create, request(missing)), 'F2_MESH_SHAPE', meshPointer + '/vertices', span(missing, meshOpening, '{'));
  for (const field of ['vertices', 'uvs', 'triangles']) {
    for (const style of ['missing', 'null', 'object']) {
      f2Baseline(create); const mesh = numericMesh();
      if (style === 'missing') delete mesh[field];
      else mesh[field] = style === 'null' ? null : {};
      const text = meshSource(mesh);
      const expected = style === 'missing' ? opening(text, '"lPanel":')
        : span(text, text.indexOf('"' + field + '":') + field.length + 3, style === 'null' ? 'null' : '{');
      reject(legal(create, request(text)), 'F2_MESH_SHAPE', meshPointer + '/' + field, expected);
    }
  }
  const priority = replaceMesh('"vertices": [0, 0, 12, 0, 12, 4, 4, 4, 4, 12, 0, 12]', '"vertices": ["x", 0, 12, 0, 12, 4, 4, 4, 4, 12, 0, 12]').text
    .replace('"uvs": [0,', '"uvs": [2,').replace('"triangles": [0,', '"triangles": [6,');
  f2Baseline(create); reject(legal(create, request(priority)), 'F2_MESH_NUMBER', meshPointer + '/vertices/0',
    span(priority, priority.indexOf('"vertices": ["x"') + '"vertices": ['.length, '"x"'));
  const minusZero = replaceMesh('"uvs": [0,', '"uvs": [-0,').text;
  f2Baseline(create); assert.equal(legal(create, request(minusZero)).ok, true);
});

test('F2A08 all meshes, source property order and global encoding preflight remain distinct', () => {
  const bad = numericMesh(); bad.triangles[0] = 3;
  for (const skinName of ['default', 'inactive']) {
    f2Baseline(create);
    const text = source({ skins: [{ name: skinName, attachments: { idle: { bad } } }] });
    reject(legal(create, request(text)), 'F2_MESH_INDEX', '/skins/0/attachments/idle/bad/triangles/0',
      opening(text, '"triangles":['));
  }
  for (const [field, value] of [['type', 'linkedmesh'], ['source', 'other'], ['parent', 'other']]) {
    f2Baseline(create); const mesh = numericMesh(); mesh[field] = value; const text = meshSource(mesh);
    const prefix = '"' + field + '":';
    reject(legal(create, request(text)), 'F2_MESH_ENCODING', meshPointer + '/' + field,
      span(text, text.indexOf(prefix) + prefix.length, JSON.stringify(value)));
  }
  f2Baseline(create);
  const text = meshSource({ ...numericMesh(), type: null });
  reject(legal(create, request(text)), 'F2_MESH_CONTAINER', meshPointer + '/type',
    span(text, text.indexOf('"type":null') + '"type":'.length, 'null'));
  // Literal JSON preserves numeric-looking key source order, unlike integer-sorted Object.keys.
  const ordered = '{"skeleton":{"spine":"4.3.13"},"skins":[{"name":"default","attachments":{"9":{"m":{"type":"mesh","vertices":[0,0,0,0,0,0],"uvs":[0,0,0,0,0,0],"triangles":[3,0,0]}},"1":{"m":{"type":"mesh","vertices":[0],"uvs":[],"triangles":[]}}}}]}';
  f2Baseline(create); reject(legal(create, request(ordered)), 'F2_MESH_INDEX', '/skins/0/attachments/9/m/triangles/0',
    span(ordered, ordered.indexOf('"triangles":[3,0,0]') + '"triangles":['.length, '3'));
  const encoded = ordered.replace('"1":{"m":{"type":"mesh"', '"1":{"m":{"type":"linkedmesh"');
  f2Baseline(create); reject(legal(create, request(encoded)), 'F2_MESH_ENCODING', '/skins/0/attachments/1/m/type',
    span(encoded, encoded.indexOf('"linkedmesh"'), '"linkedmesh"'));
  const container = ordered.replace('"1":{"m":{"type":"mesh"', '"1":{"m":{"type":null');
  f2Baseline(create); reject(legal(create, request(container)), 'F2_MESH_CONTAINER', '/skins/0/attachments/1/m/type',
    span(container, container.indexOf('"type":null') + '"type":'.length, 'null'));
  f2Baseline(create);
  const unreferenced = source({ skins: [{ name: 'default', attachments: { idle: { unknown: { type: 'future-feature' } } } }] });
  const accepted = legal(create, request(unreferenced)); assert.equal(accepted.ok, true);
  assert.deepEqual(accepted.value.meshes, []); assert.equal(accepted.value.acceptance.profileSemantics, 'not_run');
  const meshLiteral = '{"type":"mesh","vertices":[0,0,0,0,0,0],"uvs":[0,0,0,0,0,0],"triangles":[0,0,0]}';
  const orderedSuccess = '{"skeleton":{"spine":"4.3.13"},"skins":[{"name":"default","attachments":{"s":{"9":' + meshLiteral + ',"1":' + meshLiteral + '}}}]}';
  f2Baseline(create); const summaries = legal(create, request(orderedSuccess)); assert.equal(summaries.ok, true);
  assert.deepEqual(summaries.value.meshes.map(m => m.pointer), ['/skins/0/attachments/s/9', '/skins/0/attachments/s/1']);
});

test('F2A09 raw per-mesh budgets are reached only after genuine SP1 and before elements', () => {
  for (const [vertices, indices, expected] of [[4096, 3, [4096,3,1]], [3,12288,[3,12288,4096]]]) {
    f2Baseline(create); const text = meshSource(numericMesh(vertices, indices)); const result = legal(create, request(text));
    assert.equal(result.ok, true);
    assert.deepEqual([result.value.meshes[0].vertexCount, result.value.meshes[0].indexCount, result.value.meshes[0].triangleCount], expected);
  }
  for (const [vertices, indices, pointer] of [[4097,3,'vertices'], [3,12291,'triangles']]) {
    f2Baseline(create); const mesh = numericMesh(vertices, indices); mesh.vertices[0] = 'invalid-too';
    const text = meshSource(mesh);
    reject(legal(create, request(text)), 'F2_MESH_LIMIT', meshPointer + '/' + pointer, opening(text, '"' + pointer + '":'));
  }
  f2Baseline(create); const shapeBeforeLimit = meshSource(numericMesh(3,12289));
  reject(legal(create, request(shapeBeforeLimit)), 'F2_MESH_SHAPE', meshPointer + '/triangles', opening(shapeBeforeLimit, '"triangles":'));
});

test('F2A10 setup counts separate valid slot maps and independently reaches all aggregate caps', () => {
  f2Baseline(create);
  let text = setupSource([numericMesh(6,12), numericMesh(6,12)]); let result = legal(create, request(text));
  assert.equal(result.ok, true);
  assert.deepEqual([result.value.setup.attachmentCount, result.value.setup.vertexCount, result.value.setup.indexCount], [2,12,24]);
  for (const [meshes, counts] of [
    [Array.from({ length:32 }, () => ({ type:'region' })), [32,128,192]],
    [[numericMesh(2048,3),numericMesh(2048,3)], [2,4096,6]],
    [[numericMesh(3,6144),numericMesh(3,6144)], [2,6,12288]],
  ]) {
    f2Baseline(create); text = setupSource(meshes); result = legal(create, request(text)); assert.equal(result.ok, true);
    assert.deepEqual([result.value.setup.attachmentCount, result.value.setup.vertexCount, result.value.setup.indexCount], counts);
  }
  for (const [meshes, slotIndex] of [
    [Array.from({ length:33 }, () => ({ type:'region' })),32],
    [[...Array.from({ length:32 }, () => ({ type:'region' })), numericMesh(4096,12288)],32],
    [[numericMesh(2048,3),numericMesh(2049,3)],1],
    [[numericMesh(3,6144),numericMesh(3,6147)],1],
  ]) {
    f2Baseline(create); text = setupSource(meshes);
    const anchor = '"name":"s' + slotIndex + '","bone":"root","attachment":';
    reject(legal(create, request(text)), 'F2_MESH_LIMIT', '/slots/' + slotIndex + '/attachment',
      span(text, text.indexOf(anchor) + anchor.length, '"a"'));
  }
  f2Baseline(create);
  const duplicate = setupSource([numericMesh(),numericMesh()]).replace('"name":"s1"', '"name":"s0"');
  sp1Failure(create, request(duplicate));
});

test('F2A11 static references have field-local errors and absent/null references produce zeros', () => {
  for (const value of ['', 0, false, 'missing']) {
    f2Baseline(create); const text = source({ slots:[{ name:'s',bone:'root',attachment:value }] });
    reject(legal(create, request(text)), 'F2_SETUP_REFERENCE', '/slots/0/attachment',
      span(text, text.indexOf('"attachment":') + '"attachment":'.length, JSON.stringify(value)));
  }
  for (const skins of [[], [{ name:'other', attachments:{ s:{ a:{ type:'region' } } } }],
    [{ name:'default', attachments:{ s:{ a:{ type:'unsupported' } } } }]]) {
    f2Baseline(create); const text = source({ slots:[{ name:'s',bone:'root',attachment:'a' }], skins });
    reject(legal(create, request(text)), 'F2_SETUP_REFERENCE', '/slots/0/attachment',
      span(text, text.indexOf('"attachment":') + '"attachment":'.length, '"a"'));
  }
  for (const slots of [[], [{ name:'s',bone:'root' }], [{ name:'s',bone:'root',attachment:null }]]) {
    f2Baseline(create); const result = legal(create, request(source({ slots, skins:[] })));
    assert.equal(result.ok, true); assert.deepEqual(result.value.meshes, []);
    assert.deepEqual(result.value.setup, { references:[],attachmentCount:0,vertexCount:0,indexCount:0 });
  }
});

test('F2A12 CRLF, astral code units, escaped names and repeated literals use original positions', () => {
  f2Baseline(create);
  const prefix = '{\r\n"skeleton":{"spine":"4.3.13"},\r\n"note":"😀",\r\n"skins":[{"name":"default","attachments":{"a\\/b":{"m~n":{"type":"mesh","vertices":[0,0,0,0,0,0],"uvs":[0,0,0,0,0,0],"triangles":[';
  const text = prefix + '0,0,3]}}}}]}';
  const input = request(text); input.skeleton.id = 'literal-location-source';
  const expected = { source:'skeleton',sourceId:'literal-location-source',offset:prefix.length + 4,length:1,line:4,
    column:'"skins":[{"name":"default","attachments":{"a\\/b":{"m~n":{"type":"mesh","vertices":[0,0,0,0,0,0],"uvs":[0,0,0,0,0,0],"triangles":['.length + 5 };
  assert.equal(text.slice(expected.offset, expected.offset + 1), '3');
  reject(legal(create, input), 'F2_MESH_INDEX', '/skins/0/attachments/a~1b/m~0n/triangles/2', expected);
  f2Baseline(create);
  const missing = text.replace('"vertices":[0,0,0,0,0,0],', '');
  reject(legal(create, request(missing)), 'F2_MESH_SHAPE', '/skins/0/attachments/a~1b/m~0n/vertices', opening(missing, '"m~n":'));
});

test('F2A13 owned text is not reread after later descriptor reflection', () => {
  f2Baseline(create); const input = request(); let changed = false;
  input.atlas = new Proxy(input.atlas, { ownKeys(target) { input.skeleton.text = '{}'; changed = true; return Reflect.ownKeys(target); } });
  const result = create(input); assert.equal(changed, true); assert.equal(result.ok, true);
  assert.equal(result.value.meshes[0].vertexCount, 6);
  assert.equal(result.value.sp1.sourceDeclarations.skeleton.id, 'egret-f2-original-skeleton');
  allFrozen(result);
});
