// SPDX-License-Identifier: Apache-2.0
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Bitmap} from '@egret/engine';
import {createStudioScene} from '../examples/outfit-studio/scene.mjs';
import {scene as sequenceScene} from './sequence-controller-fixture.mjs';
import {buildStressSkeleton} from '../examples/outfit-studio/author-x.mjs';
import {fixedProfile, vaultRecords, workload} from '../examples/outfit-studio/workload.mjs';
import {expandStudioProject, openStudioProject} from '../examples/outfit-studio/project.mjs';

test('fixed studio uses weighted attachments and independent editable actors', () => {
  const value = buildStressSkeleton();
  assert.equal(value.bones.length, 120);
  assert.equal(value.slots.length, 96);
  const attachments = Object.values(value.skins[0].attachments).flatMap(Object.values);
  const meshes = attachments.filter(row => row.type === 'mesh');
  assert.equal(meshes.reduce((sum, row) => sum + row.uvs.length / 2, 0), 2000);
  assert.ok(meshes.every(row => row.vertices.length === row.uvs.length / 2 * 9 &&
    row.triangles.length === 102 && new Set(row.triangles).size === row.uvs.length / 2));
  const original = readFileSync(new URL('../examples/outfit-studio/project.json', import.meta.url), 'utf8');
  const expanded = openStudioProject(expandStudioProject(original));
  assert.equal(expanded.characters().length, 8);
  assert.deepEqual(expanded.characters().slice(0, 2), openStudioProject(original).characters());
  expanded.edit(expanded.characters()[7].id, {outfit:'cool-coat'});
  assert.equal(openStudioProject(expanded.serialize()).characters()[7].outfit, 'cool-coat');
  assert.equal(openStudioProject(expandStudioProject(expanded.serialize())).revision, 1);
  const collision = JSON.parse(original);
  collision.roots[0] = collision.entities[0].id = 'e_studio_2';
  collision.retiredEntityIds.push('e_studio_3');
  const fromCollision = openStudioProject(expandStudioProject(JSON.stringify(collision))).characters();
  assert.deepEqual(fromCollision.slice(0,3).map(row => row.id),['e_studio_2','e_lumen','e_studio_4']);
  assert.equal(new Set(fromCollision.map(row => row.id)).size,8);
});

test('fixed studio layouts keep their independent desktop and mobile load declarations', () => {
  const desktop = fixedProfile('x-d60');
  const portrait = fixedProfile('x-mtouch');
  const landscape = fixedProfile('x-mtouch', true);
  assert.deepEqual([desktop.width,desktop.height,desktop.ratio,desktop.rows,desktop.residentCap], [1024,768,1,32,48]);
  assert.deepEqual([portrait.width,portrait.height,portrait.ratio,portrait.rows,portrait.residentCap], [360,640,2,8,24]);
  assert.deepEqual([landscape.width,landscape.height,landscape.ratio,landscape.rows,landscape.residentCap], [640,360,2,8,24]);
  for (const profile of [desktop,portrait,landscape]) {
    const records = vaultRecords(profile);
    assert.equal(records.length, 50_000);
    assert.equal(records.slice(0, profile.rows).reduce((sum, row) => sum + row.estimatedHeight, 0), profile.vault.height);
    assert.notEqual(records[0].estimatedHeight, records[1].estimatedHeight);
  }
  assert.deepEqual(workload.mutations, {static:0,sparse:60,full:6000});
});

test('studio backdrop follows the frame on repeated mobile layout changes', async () => {
  const fixture = await sequenceScene();
  const {engine, scope, lease, clip} = fixture;
  const portrait = fixedProfile('x-mtouch');
  const landscape = fixedProfile('x-mtouch', true);
  try {
    const scene = createStudioScene(engine, scope, [], new Map(), {
      sheet: {createBitmap: () => new Bitmap(lease)},
      clip,
    }, portrait);
    const backdrop = engine.stage.getChildAt(0);
    const extents = profile => {
      const expected = [[.375, .15625, .96875, .875], [.4375, .25, .9375, .8125]];
      for (const [index, [left, top, right, bottom]] of expected.entries()) {
        const panel = backdrop.getChildAt(index);
        const bounds = panel.getBounds();
        const first = panel.localToGlobal(bounds.x, bounds.y);
        const last = panel.localToGlobal(bounds.x + bounds.width, bounds.y + bounds.height);
        assert.deepEqual([first.x, first.y, last.x, last.y],
          [left * profile.width, top * profile.height, right * profile.width, bottom * profile.height]);
      }
    };
    extents(portrait);
    scene.layout(landscape);
    extents(landscape);
    scene.layout(portrait);
    extents(portrait);
  } finally {
    await fixture.close();
  }
});
