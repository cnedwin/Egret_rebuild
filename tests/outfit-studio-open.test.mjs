// SPDX-License-Identifier: Apache-2.0
// Opening an exported Outfit Studio project over a live one, as the project module does it: one edit
// transaction, the same character IDs, and nothing written when the file is refused. The page's own part,
// candidates, cancellation and the frame on screen, is checked in a browser by
// examples/outfit-studio/verify-open.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {expandStudioProject, maxProjectBytes, openStudioProject} from '../examples/outfit-studio/project.mjs';

const source = readFileSync(new URL('../examples/outfit-studio/project.json', import.meta.url), 'utf8');
/** An export of the authored project after the given edits. */
function exported(edits, text = source) {
  const project = openStudioProject(text);
  for (const [id, changes] of edits) project.edit(id, changes);
  return project.serialize();
}
function refused(action, code) {
  try { action(); } catch (error) { assert.equal(error.code, code, error.message); return error; }
  assert.fail('the file was admitted');
}

test('an exported project opens over the live one as a single transaction under the same IDs', () => {
  const live = openStudioProject(source);
  live.edit('e_lumen', {outfit:'both'});
  const file = exported([['e_nova', {name:'Nova 雨',outfit:'cool-coat'}], ['e_nova', {palette:'alternate'}], ['e_lumen', {palette:'alternate'}]]);
  assert.equal(JSON.parse(file).revision, 3);
  const changes = live.adopt(file);
  // Three edits of the file and one of the live project meet in one revision of the live project.
  assert.equal(live.revision, 2);
  assert.deepEqual(changes, [
    {id:'e_nova',before:{id:'e_nova',name:'Nova 星羽',outfit:'default',palette:'studio'},after:{id:'e_nova',name:'Nova 雨',outfit:'cool-coat',palette:'alternate'}},
    {id:'e_lumen',before:{id:'e_lumen',name:'Lumen 晨光',outfit:'both',palette:'studio'},after:{id:'e_lumen',name:'Lumen 晨光',outfit:'warm-hat',palette:'alternate'}}
  ]);
  assert.ok(Object.isFrozen(changes) && changes.every(Object.isFrozen));
  assert.deepEqual(live.characters(), openStudioProject(file).characters());
  assert.deepEqual(live.characters().map(row => row.id), ['e_nova','e_lumen']);
  // What the live project then exports is admitted as a project of its own, and opens over the file's.
  const again = openStudioProject(file);
  assert.deepEqual(again.adopt(live.serialize()), []);
});

test('a file that changes nothing writes nothing, and only the characters that differ are written', () => {
  const live = openStudioProject(source), before = live.serialize();
  assert.deepEqual(live.adopt(source), []);
  assert.deepEqual(live.adopt(exported([['e_nova', {outfit:'both'}], ['e_nova', {outfit:'default'}]])), []);
  assert.equal(live.serialize(), before);
  const changes = live.adopt(exported([['e_lumen', {name:'Lumen 光'}]]));
  assert.deepEqual(changes.map(row => row.id), ['e_lumen']);
  assert.equal(live.revision, 1);
  assert.equal(live.character('e_nova').name, 'Nova 星羽');
});

test('the name of the project is adopted, and data the Studio does not author stays with its owner', () => {
  const renamed = JSON.parse(source);
  renamed.name = 'Autumn collection';
  renamed.entities[0].data.note = 'from the file';
  const withNote = JSON.parse(source);
  withNote.entities[1].data.note = 'kept';
  const live = openStudioProject(JSON.stringify(withNote));
  assert.deepEqual(live.adopt(JSON.stringify(renamed)), []);
  assert.equal(live.revision, 1);
  const written = JSON.parse(live.serialize());
  assert.equal(written.name, 'Autumn collection');
  assert.deepEqual(written.versions, JSON.parse(source).versions);
  assert.deepEqual(Object.fromEntries(written.entities.map(entity => [entity.id, entity.data.note])), {e_nova:undefined,e_lumen:'kept'});
});

test('the fixed route opens a compact export after expanding it as at start-up', () => {
  const live = openStudioProject(expandStudioProject(source));
  const eight = live.characters();
  const changes = live.adopt(expandStudioProject(exported([['e_lumen', {palette:'alternate'}]])));
  assert.deepEqual(changes.map(row => row.id), ['e_lumen']);
  assert.deepEqual(live.characters().map(row => row.id), eight.map(row => row.id));
  assert.deepEqual(live.characters().filter(row => row.id !== 'e_lumen'), eight.filter(row => row.id !== 'e_lumen'));
});

test('a refused file leaves the live project as it was', () => {
  const live = openStudioProject(source);
  live.edit('e_nova', {outfit:'both'});
  const before = live.serialize(), file = exported([['e_lumen', {palette:'alternate'}]]);
  const edit = change => { const value = JSON.parse(file); change(value); return JSON.stringify(value); };
  // Other characters: more of them, another identity, another order.
  refused(() => live.adopt(expandStudioProject(file)), 'STUDIO_OPEN_CHARACTERS');
  refused(() => live.adopt(file.replaceAll('e_lumen', 'e_lumina')), 'STUDIO_OPEN_CHARACTERS');
  refused(() => live.adopt(edit(value => value.roots.reverse())), 'STUDIO_OPEN_CHARACTERS');
  for (const key of ['engineVersion','resourceFormatVersion']) {
    refused(() => live.adopt(edit(value => { value.versions[key] = '9.9.9'; })), 'STUDIO_OPEN_VERSIONS');
  }
  // Not a Studio project, or not one the Studio can show.
  for (const text of ['', '{', '[]', file.replace('p_outfit_studio', 'p_other'), ' '.repeat(maxProjectBytes) + file,
    edit(value => { value.entities[0].kind = 'prop'; }), edit(value => { value.entities[0].data.outfit = 'cape'; }),
    edit(value => { value.entities[1].data.palette = 'https://example.invalid/'; }), edit(value => { value.entities[0].name = ' '; }),
    edit(value => { value.entities[0].name = 'x'.repeat(41); }), edit(value => { value.entities.pop(); })]) {
    assert.throws(() => live.adopt(text));
    assert.equal(live.serialize(), before);
  }
  assert.equal(live.serialize(), before);
  assert.equal(live.adopt(file).length, 2);
});
