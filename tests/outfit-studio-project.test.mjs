// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const example = new URL('../examples/outfit-studio/', import.meta.url);

test('an explicit outfit and rename survive export with the same character IDs', async () => {
  const load = await import(new URL('project.mjs', example)).catch(error => {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' || error.url !== new URL('project.mjs', example).href) throw error;
    return {};
  });
  assert.equal(typeof load.openStudioProject, 'function', 'the editable studio project must use a real project store');
  const source = await readFile(new URL('project.json', example), 'utf8');
  const project = load.openStudioProject(source);
  project.edit('e_nova', {name:'Nova 雨',outfit:'cool-coat',palette:'alternate'});
  const reopened = load.openStudioProject(project.serialize());
  assert.equal(reopened.revision, 1);
  assert.deepEqual(reopened.characters(), [
    {id:'e_nova',name:'Nova 雨',outfit:'cool-coat',palette:'alternate'},
    {id:'e_lumen',name:'Lumen 晨光',outfit:'warm-hat',palette:'studio'}
  ]);
  const committed = reopened.serialize();
  assert.throws(() => reopened.edit('e_nova', {name:'  '}), /name/i);
  assert.throws(() => reopened.edit('e_lumen', {palette:'external-url'}), /palette/i);
  assert.equal(reopened.serialize(), committed);
});
