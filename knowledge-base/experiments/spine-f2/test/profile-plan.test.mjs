// SPDX-License-Identifier: Apache-2.0
// Source-profile admission only: these literal source witnesses do not execute Core, pose or rendering.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as namespace from '../dist/index.js';
import { originalText, atlasText, request, frozen, allFrozen, edit, spine,
  data, inputOf, deform, mesh, meshPointer, deformPointer, at, after, frameAt,
  sparseFrames, budgetData, factory, originalControl, assertSuccess, rejection,
  inheritedRefusal } from './profile-fixtures.mjs';

const framePointer = deformPointer + '/1';
const originalRows = [['unfold', 1, 1, 2, 24]];

test('F2B01 original public fixture has the exact owned, frozen source-profile schema', () => {
  originalControl(namespace);
  assert.deepEqual(Object.keys(namespace).sort(), ['createF2MeshProfilePlan', 'createF2MeshSourcePlan']);
});

test('F2B02 component-offset sparse deltas and omitted or empty payloads remain source data', async t => {
  for (const [name, frames] of [
    ['odd-offset-fractional-deltas', [{ vertices: [-1, 0.5], offset: 1 }, { time: 1, vertices: [65536, -65536] }]],
    ['omitted-payload', [{}, { time: 1 }]],
    ['empty-payload-and-end-offset', [{ vertices: [] }, { time: 1, offset: 12, vertices: [] }]],
  ]) await t.test(name, () => {
    originalControl(namespace);
    const value = data(); value.animations.unfold.attachments.default.back.lPanel.deform = frames;
    const result = assertSuccess(namespace, inputOf(value), originalRows);
    assert.deepEqual(result.value.animations[0].timelines.map(x =>
      [x.firstTime, x.lastTime, x.expandedDeformScalarCount]), [[0, 1, 24]]);
  });
});

test('F2B03 translation, parent indices and an empty setup slot retain finite source inventories', () => {
  originalControl(namespace);
  const value = data();
  value.bones = [{ name: 'root', x: 1, y: 2 }, { name: 'child', parent: 'root', x: 3, y: 4 }];
  value.slots.push({ name: 'empty', bone: 'child', attachment: null });
  value.animations.unfold.bones = { child: { translate: [{}, { time: 2, x: 0.5, y: -1 }] } };
  const input = inputOf(value);
  const result = assertSuccess(namespace, input, [['unfold', 2, 2, 4, 24]]);
  assert.deepEqual(result.value.bones.map(x => [x.name, x.parentIndex, x.depth, x.x, x.y]),
    [['root', -1, 1, 1, 2], ['child', 0, 2, 3, 4]]);
  assert.deepEqual(result.value.slots.map(x => [x.name, x.boneIndex, x.attachmentPointer]),
    [['back', 0, meshPointer], ['front', 0, '/skins/0/attachments/front/bluePanel'], ['empty', 1, null]]);
  assert.deepEqual(result.value.animations[0].timelines.map(x => [x.kind, x.boneIndex, x.slotIndex,
    x.attachmentPointer, x.firstTime, x.lastTime, x.expandedDeformScalarCount]),
    [['deform', null, 0, meshPointer, 0, 1, 24], ['translate', 1, null, null, 0, 2, 0]]);
});

test('F2B04 owned text and provenance survive caller mutation; frozen ordinary input is accepted', () => {
  originalControl(namespace);
  const input = request();
  const result = assertSuccess(namespace, input, originalRows);
  input.skeleton.text = '{}'; input.atlas.text = 'changed';
  input.skeleton.provenance.origin = 'changed'; input.pages[0].assetId = 'changed'; input.pages.length = 0;
  assert.equal(result.value.ownedInput.skeleton.text, originalText);
  assert.equal(result.value.ownedInput.atlas.text, atlasText);
  assert.equal(result.value.ownedInput.skeleton.provenance.origin, 'Egret original F2 fixture');
  assert.equal(result.value.ownedInput.pages[0].assetId, 'egret-f2-original-page');
  assertSuccess(namespace, frozen(request()), originalRows);
  assert.throws(() => { result.value.animations.push({}); }, TypeError);
  assert.throws(() => { result.value.ownedInput.pages[0].assetId = 'forged'; }, TypeError);
  allFrozen(result);
});

test('F2B05 CRLF, astral escaped names, negative zero and original numeric-looking property order', () => {
  originalControl(namespace);
  const value = data();
  value.bones[0].x = 0;
  const name = 'a~/😀';
  value.slots[0].attachment = name;
  value.skins[0].attachments.back = { [name]: mesh(value) };
  const timeline = value.animations.unfold.attachments.default.back.lPanel;
  value.animations.unfold.attachments.default.back = { [name]: timeline };
  let text = JSON.stringify(value, null, 2).replace(/\n/g, '\r\n');
  text = edit(text, '"x": 0', '"x": -0').text;
  text = text.split(JSON.stringify(name)).join('"a~\\/\\uD83D\\uDE00"');
  const result = assertSuccess(namespace, request(text), originalRows);
  assert.equal(result.value.ownedInput.skeleton.text, text);
  assert.equal(Object.is(result.value.bones[0].x, -0), true);
  const pointer = '/skins/0/attachments/back/a~0~1😀';
  assert.equal(result.value.attachments[0].pointer, pointer);
  assert.equal(result.value.slots[0].attachmentPointer, pointer);
  assert.deepEqual(result.value.attachments[0].span,
    at(text, '"a~\\/\\uD83D\\uDE00": {\r\n            "type"', '{', '"a~\\/\\uD83D\\uDE00": '.length));
  const orderData = data(); orderData.animations = {};
  const translate = '{"bones":{"root":{"translate":[{}, {"time":1}]}}}';
  const active = JSON.stringify(data().animations.unfold);
  const orderText = edit(JSON.stringify(orderData), '"animations":{}',
    '"animations":{"10":' + translate + ',"2":' + active + '}').text;
  const ordered = assertSuccess(namespace, request(orderText), [['10', 1, 1, 2, 0], ['2', 1, 1, 2, 24]]);
  assert.deepEqual(ordered.value.animations.map(a => a.name), ['10', '2']);
});

test('F2B06 original snapshot, SP1 and raw-mesh failures remain A-FIRST', async t => {
  await t.test('getter-is-not-called', () => {
    const input = request(); let calls = 0;
    Object.defineProperty(input.skeleton, 'text', { enumerable: true, get() { calls++; return originalText; } });
    inheritedRefusal(namespace, input, 'snapshot', 'F2_INPUT_SHAPE', '/skeleton');
    assert.equal(calls, 0);
  });
  await t.test('raw-index-before-late-unknown-profile-field', () => {
    const value = data(); mesh(value).triangles[0] = 6; value.animations.unfold.events = [];
    const input = inputOf(value);
    inheritedRefusal(namespace, input, 'raw', 'F2_MESH_INDEX', meshPointer + '/triangles/0',
      after(input.skeleton.text, '"triangles":[', '6'));
  });
  await t.test('raw-shape-before-profile-field', () => {
    const value = data(); mesh(value).vertices = [0, 0, 0]; value.physics = [];
    const input = inputOf(value);
    inheritedRefusal(namespace, input, 'raw', 'F2_MESH_SHAPE', meshPointer + '/vertices',
      at(input.skeleton.text, '"vertices":[0,0,0]', '[', '"vertices":'.length));
  });
  await t.test('strict-duplicate-json-retains-both-original-key-spans', () => {
    originalControl(namespace);
    const text = edit(originalText, '"name": "root"', '"name": "root", "name": "other"').text;
    const input = request(text);
    const before = spine.createSpineImportPlan(input);
    assert.equal(before.ok, false);
    assert.equal(before.diagnostics[0].code, 'SPINE_JSON_DUPLICATE_KEY');
    assert.equal(before.diagnostics[0].pointer, '/bones/0/name');
    assert.deepEqual(before.diagnostics[0].span,
      at(text, '"name": "root", "name": "other"', '"name"', '"name": "root", '.length));
    assert.deepEqual(before.diagnostics[0].relatedSpan,
      at(text, '"name": "root", "name": "other"', '"name"'));
    const source = namespace.createF2MeshSourcePlan(input);
    assert.deepEqual(source, { ok: false, stage: 'sp1', diagnostics: before.diagnostics });
    assert.deepEqual(factory(namespace)(input), source);
    allFrozen(source);
  });
  for (const [name, field] of [['overflow-delta', 'vertices'], ['overflow-offset', 'offset'], ['overflow-time', 'time']]) {
    await t.test(name, () => {
      const value = data(); deform(value)[1] = field === 'vertices' ? { time: 1, vertices: [777] }
        : field === 'offset' ? { time: 1, offset: 777, vertices: [] } : { time: 777 };
      const text = edit(JSON.stringify(value), '777', '1e400').text;
      const input = request(text);
      originalControl(namespace);
      const before = spine.createSpineImportPlan(input);
      assert.equal(before.ok, false); assert.equal(before.diagnostics[0].code, 'SPINE_JSON_SYNTAX');
      const source = namespace.createF2MeshSourcePlan(input);
      assert.deepEqual(source, { ok: false, stage: 'sp1', diagnostics: before.diagnostics });
      assert.deepEqual(factory(namespace)(input), source);
      assert.deepEqual(before.diagnostics[0].span, at(text, '1e400', '1e400'));
      allFrozen(source);
    });
  }
});

test('F2B07 global shape and unknown-field passes precede numerical profile checks', async t => {
  await t.test('late-null-member-before-early-large-delta', () => {
    const value = data(); deform(value)[0] = { vertices: [65537] }; deform(value)[1] = { time: 1, vertices: [null] };
    const input = inputOf(value);
    rejection(namespace, input, 'SHAPE', framePointer + '/vertices/0',
      after(input.skeleton.text, '"time":1,"vertices":[', 'null'));
  });
  await t.test('unknown-key-before-missing-required', () => {
    const value = data(); delete value.skins[0].attachments.front.bluePanel.width;
    value.skins[0].attachments.front.bluePanel.rogue = false;
    const input = inputOf(value);
    rejection(namespace, input, 'FIELD', '/skins/0/attachments/front/bluePanel/rogue',
      at(input.skeleton.text, '"rogue":false', '"rogue"'));
  });
  await t.test('root-unknown-even-empty', () => {
    const value = data(); value.events = {};
    const input = inputOf(value);
    rejection(namespace, input, 'FIELD', '/events', at(input.skeleton.text, '"events":{}', '"events"'));
  });
  await t.test('missing-animation-container', () => {
    const value = data(); delete value.animations;
    const input = inputOf(value);
    rejection(namespace, input, 'SHAPE', '/animations', at(input.skeleton.text, '{"skeleton"', '{'));
  });
  for (const curve of [null, false, 'linear']) await t.test('curve-' + String(curve), () => {
    const value = data(); deform(value)[1].curve = curve;
    const input = inputOf(value);
    rejection(namespace, input, 'FIELD', framePointer + '/curve',
      at(input.skeleton.text, '"curve":' + JSON.stringify(curve), '"curve"'));
  });
});

test('F2B08 SHAPE, NUMBER and DEFORM retain their exact field-specific partition', async t => {
  const cases = [
    ['vertices-null', { time: 1, vertices: null }, 'SHAPE', '/vertices', 'vertices'],
    ['vertices-string', { time: 1, vertices: 'x' }, 'SHAPE', '/vertices', 'vertices'],
    ['member-null', { time: 1, vertices: [null] }, 'SHAPE', '/vertices/0', 'member'],
    ['member-string', { time: 1, vertices: ['x'] }, 'SHAPE', '/vertices/0', 'member'],
    ['member-object', { time: 1, vertices: [{}] }, 'SHAPE', '/vertices/0', 'member'],
    ['offset-null', { time: 1, offset: null, vertices: [] }, 'SHAPE', '/offset', 'offset'],
    ['time-null', { time: null, vertices: [] }, 'SHAPE', '/time', 'time'],
    ['delta-over-abs', { time: 1, vertices: [65537] }, 'NUMBER', '/vertices/0', 'member'],
    ['negative-offset', { time: 1, offset: -1, vertices: [] }, 'DEFORM', '/offset', 'offset'],
    ['fractional-offset', { time: 1, offset: 0.5, vertices: [] }, 'DEFORM', '/offset', 'offset'],
    ['offset-over-component-count', { time: 1, offset: 13, vertices: [] }, 'DEFORM', '/offset', 'offset'],
    ['offset-large-domain', { time: 1, offset: 65537, vertices: [] }, 'DEFORM', '/offset', 'offset'],
    ['offset-without-vertices', { time: 1, offset: 0 }, 'DEFORM', '/offset', 'offset'],
    ['extent-with-offset', { time: 1, offset: 12, vertices: [0] }, 'DEFORM', '/offset', 'offset'],
    ['extent-without-offset', { time: 1, vertices: Array(13).fill(0) }, 'DEFORM', '/vertices', 'opening'],
  ];
  for (const [name, frame, code, suffix, tokenKind] of cases) await t.test(name, () => {
    const value = data(); deform(value)[1] = frame;
    const input = inputOf(value); const frames = deform(value);
    const expected = tokenKind === 'member'
      ? after(input.skeleton.text, '"time":1,"vertices":[',
        frame.vertices[0] !== null && typeof frame.vertices[0] === 'object' ? '{' : JSON.stringify(frame.vertices[0]))
      : tokenKind === 'opening' ? after(input.skeleton.text, '"time":1,"vertices":', '[')
      : frameAt(input, frames, 1, tokenKind);
    rejection(namespace, input, code, framePointer + suffix, expected);
  });
  await t.test('time-before-offset-before-delta-before-extent', () => {
    const value = data(); deform(value)[1] = { time: -1, offset: 0.5, vertices: [65537] };
    const input = inputOf(value);
    rejection(namespace, input, 'NUMBER', framePointer + '/time', frameAt(input, deform(value), 1, 'time'));
    deform(value)[1].time = 1;
    const next = inputOf(value);
    rejection(namespace, next, 'DEFORM', framePointer + '/offset', frameAt(next, deform(value), 1, 'offset'));
    deform(value)[1] = { time: 1, vertices: [65537, ...Array(12).fill(0)] };
    const last = inputOf(value);
    rejection(namespace, last, 'NUMBER', framePointer + '/vertices/0',
      after(last.skeleton.text, '"time":1,"vertices":[', '65537'));
  });
});

test('F2B09 time domain, original ordering and Float32 collapse have distinct witnesses', async t => {
  const cases = [
    ['negative-domain', [{}, { time: -1 }], 'NUMBER', 1],
    ['over-domain', [{}, { time: 65537 }], 'NUMBER', 1],
    ['first-nonzero', [{ time: 0.5 }, { time: 1 }], 'TIME', 0],
    ['duplicate', [{ time: 0 }, { time: 0 }], 'TIME', 1],
    ['decreasing', [{}, { time: 2 }, { time: 1 }], 'TIME', 2],
    ['tiny-positive-collapse', [{}, { time: 5e-324 }], 'TIME', 1],
    ['adjacent-double-collapse', [{}, { time: 1 }, { time: 1.0000000298023224 }], 'TIME', 2],
    ['missing-second-time', [{}, {}], 'TIME', 1],
  ];
  for (const [name, frames, code, index] of cases) await t.test(name, () => {
    const value = data(); value.animations.unfold.attachments.default.back.lPanel.deform = frames;
    const input = inputOf(value);
    rejection(namespace, input, code, deformPointer + '/' + index + (Object.hasOwn(frames[index], 'time') ? '/time' : ''),
      frameAt(input, frames, index, Object.hasOwn(frames[index], 'time') ? 'time' : undefined));
  });
  await t.test('duration-stays-binary64', () => {
    originalControl(namespace);
    const value = data(); deform(value)[1] = { time: 0.1 };
    const result = assertSuccess(namespace, inputOf(value), [['unfold', 0.1, 1, 2, 24]]);
    assert.equal(result.value.animations[0].duration, 0.1);
    assert.notEqual(result.value.animations[0].duration, Math.fround(0.1));
    deform(value)[1] = { time: 60 };
    assertSuccess(namespace, inputOf(value), [['unfold', 60, 1, 2, 24]]);
  });
});

test('F2B10 every known empty map is admitted without silently inventing a timeline', async t => {
  for (const name of ['bone', 'skin', 'slot', 'mesh']) await t.test(name, () => {
    originalControl(namespace);
    const value = data();
    if (name === 'bone') value.animations.unfold.bones = { root: {} };
    if (name === 'skin') value.animations.emptySkin = { bones: { root: { translate: [{}, { time: 1 }] } },
      attachments: { default: {} } };
    if (name === 'slot') value.animations.unfold.attachments.default.front = {};
    if (name === 'mesh') {
      value.skins[0].attachments.back.spare = { ...mesh(value) };
      value.animations.unfold.attachments.default.back.spare = {};
    }
    const rows = name === 'skin' ? [...originalRows, ['emptySkin', 1, 1, 2, 0]] : originalRows;
    const result = assertSuccess(namespace, inputOf(value), rows);
    if (name === 'mesh') assert.equal(result.value.attachments.length, 3);
  });
});

test('F2B11 unknown empty targets and region targets receive REFERENCE at their original key', async t => {
  for (const [name, set, pointer] of [
    ['bone', value => { value.animations.unfold.bones = { ghost: {} }; }, '/animations/unfold/bones/ghost'],
    ['skin', value => { value.animations.unfold.attachments.ghost = {}; }, '/animations/unfold/attachments/ghost'],
    ['slot', value => { value.animations.unfold.attachments.default.ghost = {}; }, '/animations/unfold/attachments/default/ghost'],
    ['attachment', value => { value.animations.unfold.attachments.default.back.ghost = {}; }, '/animations/unfold/attachments/default/back/ghost'],
  ]) await t.test(name, () => {
    const value = data(); set(value); const input = inputOf(value);
    rejection(namespace, input, 'REFERENCE', pointer, at(input.skeleton.text, '"ghost":{}', '"ghost"'));
  });
  await t.test('region-even-empty', () => {
    const value = data(); value.animations.unfold.attachments.default.front = { bluePanel: {} };
    const input = inputOf(value);
    rejection(namespace, input, 'REFERENCE', '/animations/unfold/attachments/default/front/bluePanel',
      at(input.skeleton.text, '"bluePanel":{}', '"bluePanel"'));
  });
  await t.test('empty-name', () => {
    const value = data(); value.animations.unfold.bones = { '': {} };
    const input = inputOf(value);
    rejection(namespace, input, 'REFERENCE', '/animations/unfold/bones/', at(input.skeleton.text, '"":{}', '""'));
  });
  await t.test('decoded-name-over-256-bytes', () => {
    const value = data(); const name = 'g'.repeat(257); value.animations.unfold.bones = { [name]: {} };
    const input = inputOf(value);
    rejection(namespace, input, 'REFERENCE', '/animations/unfold/bones/' + name,
      at(input.skeleton.text, JSON.stringify(name) + ':{}', JSON.stringify(name)));
  });
});

test('F2B12 complete reference traversal beats min2 and absent active deform', async t => {
  for (const where of ['before', 'after']) await t.test('unknown-' + where + '-one-frame', () => {
    const value = data(); deform(value).length = 1;
    const target = value.animations.unfold.attachments.default.back.lPanel;
    value.animations.unfold.attachments.default.back = where === 'before'
      ? { ghost: {}, lPanel: target } : { lPanel: target, ghost: {} };
    const input = inputOf(value);
    rejection(namespace, input, 'REFERENCE', '/animations/unfold/attachments/default/back/ghost',
      at(input.skeleton.text, '"ghost":{}', '"ghost"'));
    delete value.animations.unfold.attachments.default.back.ghost;
    const withoutUnknown = inputOf(value);
    rejection(namespace, withoutUnknown, 'LIMIT', deformPointer, after(withoutUnknown.skeleton.text, '"deform":', '['));
  });
  await t.test('unknown-before-final-active-requirement', () => {
    const value = data(); value.animations = { only: { bones: { root: { translate: [{}, { time: 1 }] }, ghost: {} } } };
    const input = inputOf(value);
    rejection(namespace, input, 'REFERENCE', '/animations/only/bones/ghost',
      at(input.skeleton.text, '"ghost":{}', '"ghost"'));
  });
  await t.test('known-empty-animation-reaches-timeline-minimum', () => {
    const value = data(); value.animations.unfold = { bones: { root: {} }, attachments: { default: { back: { lPanel: {} } } } };
    const input = inputOf(value);
    rejection(namespace, input, 'LIMIT', '/animations/unfold', after(input.skeleton.text, '"unfold":', '{'));
  });
  await t.test('global-child-shape-before-unknown-reference', () => {
    const value = data(); value.animations.unfold.bones = { ghost: null };
    const input = inputOf(value);
    rejection(namespace, input, 'SHAPE', '/animations/unfold/bones/ghost', after(input.skeleton.text, '"ghost":', 'null'));
  });
  await t.test('ancestor-reference-before-child', () => {
    const value = data(); value.animations.unfold.attachments.ghostSkin = { ghostSlot: { ghostMesh: {} } };
    const input = inputOf(value);
    rejection(namespace, input, 'REFERENCE', '/animations/unfold/attachments/ghostSkin',
      at(input.skeleton.text, '"ghostSkin":{"ghostSlot"', '"ghostSkin"'));
  });
  await t.test('numeric-looking-targets-follow-literal-source-order', () => {
    const value = data(); value.animations.unfold.bones = {};
    const text = edit(JSON.stringify(value), '"bones":{}', '"bones":{"10":{},"2":{}}').text;
    rejection(namespace, request(text), 'REFERENCE', '/animations/unfold/bones/10', at(text, '"10":{}', '"10"'));
  });
});

test('F2B13 bone reference, global primitive shape and fixed transform locations remain distinct', async t => {
  const cases = [
    ['first-parent', [{ name: 'root', parent: 'root' }], 'REFERENCE', '/bones/0/parent', '"parent":', '"root"'],
    ['empty-parent', [{ name: 'root' }, { name: 'child', parent: '' }], 'REFERENCE', '/bones/1/parent', '"parent":', '""'],
    ['unknown-parent', [{ name: 'root' }, { name: 'child', parent: 'ghost' }], 'REFERENCE', '/bones/1/parent', '"parent":', '"ghost"'],
    ['forward-parent', [{ name: 'root' }, { name: 'child', parent: 'later' }, { name: 'later', parent: 'root' }],
      'REFERENCE', '/bones/1/parent', '"parent":', '"later"'],
    ['self-parent', [{ name: 'root' }, { name: 'child', parent: 'child' }], 'REFERENCE', '/bones/1/parent', '"parent":', '"child"'],
    ['wrong-parent-kind', [{ name: 'root' }, { name: 'child', parent: null }], 'SHAPE', '/bones/1/parent', '"parent":', 'null'],
    ['rotation-before-scale', [{ name: 'root', rotation: 1, scaleX: 2 }], 'TRANSFORM', '/bones/0/rotation', '"rotation":', '1'],
    ['setup-position-domain', [{ name: 'root', x: 65537 }], 'NUMBER', '/bones/0/x', '"x":', '65537'],
  ];
  for (const [name, bones, code, pointer, prefix, token] of cases) await t.test(name, () => {
    const value = data(); value.bones = bones; const input = inputOf(value);
    rejection(namespace, input, code, pointer, after(input.skeleton.text, prefix, token));
  });
  await t.test('later-missing-parent-is-conditional-reference', () => {
    const value = data(); value.bones.push({ name: 'child' }); const input = inputOf(value);
    rejection(namespace, input, 'REFERENCE', '/bones/1/parent',
      at(input.skeleton.text, '{"name":"child"}', '{'));
  });
  await t.test('later-global-shape-before-early-parent-reference', () => {
    const value = data(); value.bones = [{ name: 'root', parent: 'ghost' }, { name: 'child', parent: null }];
    const input = inputOf(value);
    rejection(namespace, input, 'SHAPE', '/bones/1/parent', after(input.skeleton.text, '"parent":', 'null'));
  });
});

test('F2B14 inactive attachments and unselected animation fields are completely qualified', async t => {
  await t.test('inactive-path-still-resolves', () => {
    originalControl(namespace);
    const value = data(); value.skins[0].attachments.back.spare = { ...mesh(value) };
    const baseline = inputOf(value);
    assertSuccess(namespace, baseline, originalRows);
    value.skins[0].attachments.back.spare.path = 'missing-region'; const input = inputOf(value);
    rejection(namespace, input, 'REFERENCE', '/skins/0/attachments/back/spare/path',
      after(input.skeleton.text, '"path":', '"missing-region"'), 'skeleton', { input: baseline, rows: originalRows });
  });
  await t.test('inactive-deform-is-counted-but-does-not-satisfy-active-requirement', () => {
    originalControl(namespace);
    const value = data(); value.skins[0].attachments.back.spare = { ...mesh(value) };
    value.animations.unfold.attachments.default.back.spare = { deform: [{}, { time: 2 }] };
    const baseline = inputOf(value);
    const result = assertSuccess(namespace, baseline, [['unfold', 2, 2, 4, 48]]);
    assert.deepEqual(result.value.animations[0].timelines.map(x => [x.attachmentPointer, x.expandedDeformScalarCount]),
      [[meshPointer, 24], ['/skins/0/attachments/back/spare', 24]]);
    delete value.animations.unfold.attachments.default.back.lPanel;
    const input = inputOf(value);
    rejection(namespace, input, 'REQUIRED', '/animations', after(input.skeleton.text, '"animations":', '{'),
      'skeleton', { input: baseline, rows: [['unfold', 2, 2, 4, 48]] });
  });
  await t.test('late-animation-curve-is-not-ignored', () => {
    const value = data(); value.animations.late = { bones: { root: { translate: [{}, { time: 1, curve: null }] } } };
    const input = inputOf(value);
    rejection(namespace, input, 'FIELD', '/animations/late/bones/root/translate/1/curve',
      at(input.skeleton.text, '"curve":null', '"curve"'));
  });
  await t.test('setup-mesh-is-required-even-with-inactive-deform', () => {
    const value = data(); value.slots[0].attachment = null; const input = inputOf(value);
    rejection(namespace, input, 'REQUIRED', '/slots', after(input.skeleton.text, '"slots":', '['));
  });
});

test('F2B15 atlas config refusals use admitted owner spans and extras use their actual field span', async t => {
  const pageSpan = at(atlasText, 'egret-f2-page.rgba', 'egret-f2-page.rgba', 0, 'atlas');
  for (const [name, before, changed] of [
    ['filter', 'filter: Nearest, Nearest', 'filter: Linear, Nearest'],
    ['format', 'format: RGBA8888', 'format: RGB888'],
    ['repeat', 'repeat: none', 'repeat: x'],
    ['pma', 'pma: false', 'pma: true'],
  ]) await t.test(name, () => {
    const input = request(); input.atlas.text = edit(atlasText, before, changed).text;
    rejection(namespace, input, 'ATLAS', '/pages/0', pageSpan, 'atlas');
  });
  for (const [name, added] of [['rotation', 'rotate: 90'], ['trim', 'offsets: 1, 0, 9, 8'], ['index', 'index: 0']]) {
    await t.test(name, () => {
      const input = request();
      input.atlas.text = edit(atlasText, 'egret-f2-mesh\nbounds: 0, 0, 8, 8',
        'egret-f2-mesh\nbounds: 0, 0, 8, 8\n' + added).text;
      rejection(namespace, input, 'ATLAS', '/pages/0/regions/0',
        at(input.atlas.text, 'egret-f2-mesh\n', 'egret-f2-mesh', 0, 'atlas'), 'atlas');
    });
  }
  await t.test('page-extra-field', () => {
    const input = request(); input.atlas.text = edit(atlasText, 'pma: false', 'pma: false\ncustom: value').text;
    rejection(namespace, input, 'ATLAS', '/pages/0/custom', at(input.atlas.text, 'custom: value', 'custom: value', 0, 'atlas'), 'atlas');
  });
  await t.test('region-extra-field', () => {
    const input = request(); input.atlas.text = edit(atlasText, 'bounds: 0, 0, 8, 8', 'bounds: 0, 0, 8, 8\ncustom: value').text;
    rejection(namespace, input, 'ATLAS', '/pages/0/regions/0/custom',
      at(input.atlas.text, 'custom: value', 'custom: value', 0, 'atlas'), 'atlas');
  });
  await t.test('atlas-before-bone-number', () => {
    const value = data(); value.bones[0].x = 65537;
    const input = inputOf(value); input.atlas.text = edit(atlasText, 'repeat: none', 'repeat: x').text;
    rejection(namespace, input, 'ATLAS', '/pages/0', pageSpan, 'atlas');
  });
});

test('F2B16 atlas page, axis and region budgets use only real header-owner positions', async t => {
  await t.test('axis-2048-equality-and-2049-excess', () => {
    originalControl(namespace);
    const baseline = request(); baseline.atlas.text = edit(atlasText, 'size: 16, 8', 'size: 2048, 2048').text;
    const result = assertSuccess(namespace, baseline, originalRows);
    assert.deepEqual(result.value.page, { pageName: 'egret-f2-page.rgba', assetId: 'egret-f2-original-page',
      width: 2048, height: 2048, regionCount: 2 });
    const input = request(); input.atlas.text = edit(atlasText, 'size: 16, 8', 'size: 2049, 2048').text;
    rejection(namespace, input, 'LIMIT', '/pages/0',
      at(input.atlas.text, 'egret-f2-page.rgba', 'egret-f2-page.rgba', 0, 'atlas'), 'atlas',
      { input: baseline, rows: originalRows });
  });
  await t.test('two-pages', () => {
    const input = request();
    input.atlas.text += '\nsecond-page.rgba\nsize: 16, 8\nformat: RGBA8888\nfilter: Nearest, Nearest\nrepeat: none\npma: false\nsecond-region\nbounds: 0, 0, 1, 1\n';
    input.pages.push({ pageName: 'second-page.rgba', assetId: 'second-original-page', provenance: { ...input.pages[0].provenance } });
    rejection(namespace, input, 'ATLAS', '/pages',
      at(input.atlas.text, 'egret-f2-page.rgba', 'egret-f2-page.rgba', 0, 'atlas'), 'atlas');
  });
  await t.test('regions-64-and-65', () => {
    originalControl(namespace);
    const baseline = request();
    baseline.atlas.text += Array.from({ length: 62 }, (_, i) => 'r' + i + '\nbounds: 0, 0, 1, 1\n').join('');
    assert.equal(assertSuccess(namespace, baseline, originalRows).value.page.regionCount, 64);
    const input = request(); input.atlas.text = baseline.atlas.text + 'r62\nbounds: 0, 0, 1, 1\n';
    rejection(namespace, input, 'LIMIT', '/pages/0/regions',
      at(input.atlas.text, 'egret-f2-page.rgba', 'egret-f2-page.rgba', 0, 'atlas'), 'atlas',
      { input: baseline, rows: originalRows });
  });
});

test('F2B17 bone, depth, slot and attachment count boundaries remain reachable after A', async t => {
  await t.test('bones-32-and-33', () => {
    originalControl(namespace);
    const value = data(); value.bones = [{ name: 'root' }, ...Array.from({ length: 31 }, (_, i) => ({ name: 'b' + i, parent: 'root' }))];
    const baseline = inputOf(value); assert.equal(assertSuccess(namespace, baseline, originalRows).value.bones.length, 32);
    value.bones.push({ name: 'extra', parent: 'root' }); const input = inputOf(value);
    rejection(namespace, input, 'LIMIT', '/bones', after(input.skeleton.text, '"bones":', '['),
      'skeleton', { input: baseline, rows: originalRows });
  });
  await t.test('depth-8-and-9', () => {
    originalControl(namespace);
    const value = data(); value.bones = [{ name: 'root' }, ...Array.from({ length: 7 }, (_, i) =>
      ({ name: 'b' + (i + 1), parent: i === 0 ? 'root' : 'b' + i }))];
    const baseline = inputOf(value); assert.equal(assertSuccess(namespace, baseline, originalRows).value.bones[7].depth, 8);
    value.bones.push({ name: 'b8', parent: 'b7' }); const input = inputOf(value);
    rejection(namespace, input, 'LIMIT', '/bones/8/parent',
      at(input.skeleton.text, '{"name":"b8","parent":"b7"}', '"b7"', '{"name":"b8","parent":'.length),
      'skeleton', { input: baseline, rows: originalRows });
  });
  await t.test('slots-32-and-33', () => {
    originalControl(namespace);
    const value = data(); value.slots.push(...Array.from({ length: 30 }, (_, i) => ({ name: 's' + i, bone: 'root' })));
    const baseline = inputOf(value); assert.equal(assertSuccess(namespace, baseline, originalRows).value.slots.length, 32);
    value.slots.push({ name: 'extra', bone: 'root' }); const input = inputOf(value);
    rejection(namespace, input, 'LIMIT', '/slots', after(input.skeleton.text, '"slots":', '['),
      'skeleton', { input: baseline, rows: originalRows });
  });
  await t.test('attachments-64-and-65', () => {
    originalControl(namespace);
    const value = data(); for (let i = 0; i < 62; i++) value.skins[0].attachments.back['a' + i] =
      { type: 'region', path: 'egret-f2-blue', width: 1, height: 1 };
    const baseline = inputOf(value); assert.equal(assertSuccess(namespace, baseline, originalRows).value.attachments.length, 64);
    value.skins[0].attachments.back.extra = { type: 'region', path: 'egret-f2-blue', width: 1, height: 1 };
    const input = inputOf(value);
    rejection(namespace, input, 'LIMIT', '/skins/0/attachments', after(input.skeleton.text, '"name":"default","attachments":', '{'),
      'skeleton', { input: baseline, rows: originalRows });
  });
  await t.test('two-skins', () => {
    const value = data(); value.skins.push({ name: 'other', attachments: {} }); const input = inputOf(value);
    rejection(namespace, input, 'LIMIT', '/skins', after(input.skeleton.text, '"skins":', '['));
  });
});

test('F2B18 animations and frames enforce inclusive limits before source frame values', async t => {
  await t.test('animations-8-and-9', () => {
    originalControl(namespace);
    const value = budgetData(3, 2, 8); const baseline = inputOf(value);
    assertSuccess(namespace, baseline, Array.from({ length: 8 }, (_, i) => ['anim' + i, 1 / 128, 1, 2, 12]));
    value.animations.anim8 = { attachments: { default: { back: { lPanel: { deform: sparseFrames(2) } } } } };
    const input = inputOf(value);
    rejection(namespace, input, 'LIMIT', '/animations', after(input.skeleton.text, '"animations":', '{'),
      'skeleton', { input: baseline, rows: Array.from({ length: 8 }, (_, i) => ['anim' + i, 1 / 128, 1, 2, 12]) });
  });
  await t.test('frames-4096-and-4097', () => {
    originalControl(namespace);
    const value = budgetData(3, 4096); const baseline = inputOf(value);
    assertSuccess(namespace, baseline, [['anim0', 4095 / 128, 1, 4096, 24576]]);
    value.animations.anim0.attachments.default.back.lPanel.deform.push({ time: 4096 / 128 });
    const input = inputOf(value); const pointer = '/animations/anim0/attachments/default/back/lPanel/deform';
    rejection(namespace, input, 'LIMIT', pointer, after(input.skeleton.text, '"deform":', '['),
      'skeleton', { input: baseline, rows: [['anim0', 4095 / 128, 1, 4096, 24576]] });
  });
  await t.test('cumulative-frames-4096-and-4097', () => {
    originalControl(namespace);
    const value = budgetData(3, 2048);
    value.animations.anim0.bones = { root: { translate: sparseFrames(2048) } };
    const baseline = inputOf(value); assertSuccess(namespace, baseline, [['anim0', 2047 / 128, 2, 4096, 12288]]);
    value.animations.anim0.bones.root.translate.push({ time: 2048 / 128 }); const input = inputOf(value);
    rejection(namespace, input, 'LIMIT', '/animations/anim0/bones/root/translate', after(input.skeleton.text, '"translate":', '['),
      'skeleton', { input: baseline, rows: [['anim0', 2047 / 128, 2, 4096, 12288]] });
  });
  await t.test('frame-count-before-early-frame-domain', () => {
    const value = budgetData(3, 4097); value.animations.anim0.attachments.default.back.lPanel.deform[0].time = -1;
    const input = inputOf(value);
    rejection(namespace, input, 'LIMIT', '/animations/anim0/attachments/default/back/lPanel/deform',
      after(input.skeleton.text, '"deform":', '['));
  });
});

test('F2B19 full-component expanded budgets count omitted sparse payloads at exact equalities', async t => {
  await t.test('per-animation-262144-and-first-excess', () => {
    originalControl(namespace);
    const value = budgetData(64, 2048); const baseline = inputOf(value);
    assertSuccess(namespace, baseline, [['anim0', 2047 / 128, 1, 2048, 262144]]);
    value.animations.anim0.attachments.default.back.lPanel.deform.push({ time: 2048 / 128, vertices: [0] });
    const input = inputOf(value);
    rejection(namespace, input, 'LIMIT', '/animations/anim0/attachments/default/back/lPanel/deform',
      after(input.skeleton.text, '"deform":', '['), 'skeleton',
      { input: baseline, rows: [['anim0', 2047 / 128, 1, 2048, 262144]] });
  });
  await t.test('asset-1048576-and-first-excess-animation', () => {
    originalControl(namespace);
    const value = budgetData(64, 2048, 4); const baseline = inputOf(value);
    const rows = Array.from({ length: 4 }, (_, i) => ['anim' + i, 2047 / 128, 1, 2048, 262144]);
    assertSuccess(namespace, baseline, rows);
    value.animations.anim4 = { attachments: { default: { back: { lPanel: { deform: [{}, { time: 1, vertices: [0] }] } } } } };
    const input = inputOf(value);
    const prefix = '"anim4":{"attachments":{"default":{"back":{"lPanel":{"deform":';
    rejection(namespace, input, 'LIMIT', '/animations/anim4/attachments/default/back/lPanel/deform',
      after(input.skeleton.text, prefix, '['), 'skeleton', { input: baseline, rows });
  });
  await t.test('expanded-budget-before-frame-value', () => {
    const value = budgetData(64, 2049); value.animations.anim0.attachments.default.back.lPanel.deform[0].time = -1;
    const input = inputOf(value);
    rejection(namespace, input, 'LIMIT', '/animations/anim0/attachments/default/back/lPanel/deform',
      after(input.skeleton.text, '"deform":', '['));
  });
});

test('F2B20 translate primitive/domain rules and original mesh coordinate bounds are source checks', async t => {
  for (const [name, scalar, code] of [['null', null, 'SHAPE'], ['string', 'x', 'SHAPE'], ['over-abs', 65537, 'NUMBER']]) {
    await t.test('translate-x-' + name, () => {
      const value = data(); value.animations.unfold.bones = { root: { translate: [{}, { time: 1, x: scalar }] } };
      const input = inputOf(value);
      rejection(namespace, input, code, '/animations/unfold/bones/root/translate/1/x',
        after(input.skeleton.text, '"time":1,"x":', JSON.stringify(scalar)));
    });
  }
  await t.test('mesh-coordinate-absolute-limit', () => {
    const value = data(); mesh(value).vertices[0] = 65537; const input = inputOf(value);
    rejection(namespace, input, 'NUMBER', meshPointer + '/vertices/0', after(input.skeleton.text, '"vertices":[', '65537'));
  });
});

test('F2B21 path fallback and admitted setup metadata are declarations with no asset authority', () => {
  originalControl(namespace);
  const value = data();
  const target = mesh(value); delete target.path;
  value.skins[0].attachments.back = { 'egret-f2-mesh': target };
  value.slots[0].attachment = 'egret-f2-mesh';
  const timeline = value.animations.unfold.attachments.default.back.lPanel;
  value.animations.unfold.attachments.default.back = { 'egret-f2-mesh': timeline };
  const region = value.skins[0].attachments.front.bluePanel; delete region.path; region.name = 'egret-f2-blue';
  value.bones[0] = { name: 'root', x: -65536, y: 65536, length: 0, rotation: 0,
    scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, inherit: 'normal', skin: false,
    color: 'abcdef12', icon: 'declared', iconSize: 0, iconRotation: -65536 };
  value.skeleton = { spine: '4.3.13', hash: 'declaration', x: 0, y: 0, width: 0, height: 65536,
    fps: 240, images: 'no-io/', audio: 'no-io/', referenceScale: 100 };
  value.slots[0].visible = true;
  target.hull = 6; target.edges = [0, 5]; target.width = 0; target.height = 65536;
  const result = assertSuccess(namespace, inputOf(value), originalRows);
  assert.deepEqual(result.value.attachments.map(x => [x.attachmentName, x.path, x.kind]),
    [['egret-f2-mesh', 'egret-f2-mesh', 'mesh'], ['bluePanel', 'egret-f2-blue', 'region']]);
  assert.equal(result.value.slots[0].attachmentPointer, '/skins/0/attachments/back/egret-f2-mesh');
  assert.deepEqual(result.value.acceptance, { sourceProfile: 'passed', linearTimelineSourceAdmission: 'passed',
    coreCompatibility: 'not_run', poseNumerics: 'not_run', resourceIdentity: 'not_run', playback: 'not_run',
    rendering: 'not_run', licenseEntitlement: 'unverified' });
});

test('F2B22 fixed transforms and optional numerical metadata do not accept coercion or shape leakage', async t => {
  for (const [name, change, code, pointer, prefix, token] of [
    ['slot-color', value => { value.slots[0].color = 'fffffffe'; }, 'TRANSFORM', '/slots/0/color', '"color":', '"fffffffe"'],
    ['slot-blend', value => { value.slots[0].blend = 'additive'; }, 'TRANSFORM', '/slots/0/blend', '"blend":', '"additive"'],
    ['slot-visible', value => { value.slots[0].visible = false; }, 'TRANSFORM', '/slots/0/visible', '"visible":', 'false'],
    ['bone-scale', value => { value.bones[0].scaleX = 0; }, 'TRANSFORM', '/bones/0/scaleX', '"scaleX":', '0'],
    ['fps-domain', value => { value.skeleton.fps = 0; }, 'NUMBER', '/skeleton/fps', '"fps":', '0'],
    ['region-width', value => { value.skins[0].attachments.front.bluePanel.width = 0; }, 'NUMBER', '/skins/0/attachments/front/bluePanel/width', '"x":2,"y":2,"width":', '0'],
    ['region-rotation', value => { value.skins[0].attachments.front.bluePanel.rotation = 1; }, 'TRANSFORM', '/skins/0/attachments/front/bluePanel/rotation', '"rotation":', '1'],
    ['hull-domain', value => { mesh(value).hull = 7; }, 'NUMBER', meshPointer + '/hull', '"hull":', '7'],
    ['edges-odd', value => { mesh(value).edges = [0]; }, 'NUMBER', meshPointer + '/edges', '"edges":', '['],
    ['edges-member-kind', value => { mesh(value).edges = [null, 0]; }, 'NUMBER', meshPointer + '/edges/0', '"edges":[', 'null'],
  ]) await t.test(name, () => {
    const value = data(); change(value); const input = inputOf(value);
    rejection(namespace, input, code, pointer, after(input.skeleton.text, prefix, token));
  });
});
