// SPDX-License-Identifier: Apache-2.0
// guide/resolved.json tells a game which of its engine notes the engine has fixed, and `egret notes` reads a game's
// ENGINE-NOTES.md against it. A wrong entry sends an agent to take out a workaround the engine copy still needs; a
// missed one leaves a workaround in a game for good. So the list is held to its form and to the cards it names, and the
// command to the notes it reports, from this repository and from a game's engine copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { GUIDE, loadCards } from '../tools/egret-guide.mjs';
import {
  ENGINE_STATUSES,
  NOTE_ID,
  TOPIC,
  headingStatus,
  notesReport,
  parseNotes,
  readResolved
} from '../tools/egret-notes.mjs';
import { vendorGame } from '../tools/vendor-game.mjs';

const resolved = readResolved(GUIDE);
const cardIds = new Set(loadCards().map(card => card.id));
const CJK = /[　-鿿＀-￯]/;

/** A game folder with the notes given, under a new temporary directory. */
function game(name, notes) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-notes-'));
  const folder = path.join(root, name);
  fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, 'ENGINE-NOTES.md'), notes);
  return { root, folder };
}
const header = fields => `<!-- engine-note: ${JSON.stringify(fields)} -->`;

// Break caught: an entry an agent cannot act on: no topic, an unknown status, words in Chinese only, a card or a
// commit that is not there, or one note claimed by two entries.
test('EN01 every resolved entry has a topic, a status, what changed in English, its commit and real cards', () => {
  assert.ok(resolved.length >= 10);
  const topics = new Set(),
    notes = new Set();
  for (const entry of resolved) {
    assert.match(entry.topic, TOPIC, entry.topic);
    assert.ok(!topics.has(entry.topic), entry.topic + ' twice');
    topics.add(entry.topic);
    assert.ok(ENGINE_STATUSES.includes(entry.status), entry.topic + ': ' + entry.status);
    assert.ok(typeof entry.what === 'string' && entry.what.length >= 40 && !CJK.test(entry.what), entry.topic);
    // A change that resolves a note in the same pull request has no commit yet: the engine copy's pin is it.
    if (entry.commit !== undefined) assert.match(entry.commit, /^[0-9a-f]{40}$/, entry.topic);
    if (entry.pr !== undefined) assert.ok(Number.isInteger(entry.pr) && entry.pr > 0, entry.topic);
    if (entry.card !== undefined) assert.ok(cardIds.has(entry.card), entry.topic + ' names card ' + entry.card);
    assert.ok(Array.isArray(entry.notes) && entry.notes.length > 0, entry.topic + ' names the notes it was for');
    for (const id of entry.notes) {
      assert.match(id, NOTE_ID, id);
      assert.ok(!notes.has(id), id + ' in two entries');
      notes.add(id);
    }
    assert.deepEqual(
      Object.keys(entry).filter(key => !['topic', 'status', 'what', 'commit', 'pr', 'card', 'notes'].includes(key)),
      [],
      entry.topic
    );
  }
});

// Break caught: a header read from the wrong note, a status the games write that is not understood, or a bad header
// passing as good.
test('EN02 notes are read with their headers, or with the status their heading ends with', () => {
  assert.equal(headingStatus('Paragraphs cannot set text vertically — 未解决 / open'), 'open');
  assert.equal(headingStatus('`game.image` takes PNG only — 已在 95897d7 解决 / resolved in 95897d7'), 'resolved');
  assert.equal(headingStatus('Removing a sprite — 部分解决 / partly resolved'), 'partly');
  assert.equal(headingStatus('Node 26.7.0 — 已写入文档 / documented'), 'documented');
  assert.equal(headingStatus('Too large — 已在游戏侧绕过 / worked around'), 'worked-around');
  assert.equal(headingStatus('No status here'), undefined);
  const notes = parseNotes(
    [
      '# Engine notes',
      '### 1. Keys — open',
      header({ id: 'Game#1', status: 'open', topic: 'play-page-keys', workaround: ['src/main.mjs'] }),
      '- What happens: …',
      '### 2. Black holder — 部分解决 / partly resolved',
      '- no header',
      '### 3. Bad — open',
      header({ id: 'Other#3', status: 'later', topic: 'Not A Topic', workaround: ['../outside.mjs'] }),
      '### 4. Broken — open',
      '<!-- engine-note: {not json} -->'
    ].join('\n'),
    'Game'
  );
  assert.deepEqual(
    notes.map(note => [note.id, note.status, note.header?.topic]),
    [
      ['Game#1', 'open', 'play-page-keys'],
      ['Game#2', 'partly', undefined],
      ['Game#3', 'later', 'Not A Topic'],
      ['Game#4', 'open', undefined]
    ]
  );
  assert.deepEqual(notes[0].problems, []);
  assert.equal(notes[2].problems.length, 4, notes[2].problems.join('; '));
  assert.match(notes[3].problems[0], /not JSON/);
});

// Break caught: a note the engine fixed left unreported, one already resolved reported again, the files of the
// workaround or the card left out, or --check passing while a fixed note is still open.
test('EN03 notes reports what the engine fixed of a game, by topic and by id, and --check holds it', () => {
  const play = resolved.find(entry => entry.topic === 'play-page-keys');
  const named = resolved.find(entry => entry.notes.length > 0 && entry.topic !== 'play-page-keys');
  const [folderName, number] = named.notes[0].split('#');
  const { root, folder } = game(
    folderName,
    [
      '# Engine notes',
      `### 1. Page buttons lose Tab — open`,
      header({ id: `${folderName}#1`, status: 'open', topic: 'play-page-keys', workaround: ['src/keys.mjs'] }),
      `### ${number}. Named by the engine — 未解决 / open`,
      '- no header: matched by its id',
      '### 98. Already done — resolved in 1234567',
      header({ id: `${folderName}#98`, status: 'resolved', topic: 'label-pages' }),
      '### 99. Nothing the engine did — open',
      header({ id: `${folderName}#99`, status: 'open', topic: 'not-fixed-anywhere' })
    ].join('\n')
  );
  try {
    const report = notesReport(folder, GUIDE, { command: 'node vendor/egret.mjs', check: true, copy: true });
    assert.equal(report.code, 1);
    assert.match(report.text, new RegExp(`^${folderName}#1 Page buttons lose Tab`, 'm'));
    assert.ok(report.text.includes(play.what));
    assert.match(report.text, /Take out the workaround in src\/keys\.mjs/);
    assert.match(report.text, /node vendor\/egret\.mjs card play-page-controls/);
    assert.match(report.text, new RegExp(`^${folderName}#${number} Named by the engine`, 'm'));
    assert.ok(!report.text.includes('#98 Already done') && !report.text.includes('#99 Nothing'));
    assert.match(report.text, /4 notes in .*, 3 with a header; 2 the engine copy has resolved or documented since\./);
    assert.match(report.text, /<!-- engine-note: \{"id": ".*#<n>"/);
    const here = notesReport(folder, GUIDE, { command: 'node tools/egret.mjs', copy: false });
    assert.equal(here.code, 0, 'without --check the report does not fail');
    assert.match(here.text, /This engine has it resolved .*\n {2}Refresh the game's engine copy/);
    // Marked resolved, the notes pass the check.
    const text = fs
      .readFileSync(path.join(folder, 'ENGINE-NOTES.md'), 'utf8')
      .replace('"status":"open","topic":"play-page-keys"', '"status":"resolved","topic":"play-page-keys"')
      .replace(`### ${number}. Named by the engine — 未解决 / open`, `### ${number}. Named by the engine — resolved`);
    fs.writeFileSync(path.join(folder, 'ENGINE-NOTES.md'), text);
    const after = notesReport(folder, GUIDE, { command: 'node vendor/egret.mjs', check: true });
    assert.equal(after.code, named.status === 'resolved' || named.status === 'documented' ? 0 : 1, after.text);
    assert.equal(notesReport(root, GUIDE, { command: 'x' }).code, 1, 'a folder with no notes is told');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Break caught: the engine copy without the list or the reader, or a copy that reports as the repository does
// instead of from the game's own pin.
test('EN04 the engine copy reads the game it sits in against the list at its pin', () => {
  const { root, folder } = game(
    'CopyGame',
    ['### 1. Keys — open', header({ id: 'CopyGame#1', status: 'open', topic: 'play-page-keys' })].join('\n')
  );
  try {
    vendorGame(folder, ['@egret/engine']);
    for (const file of ['egret/guide/resolved.json', 'egret/tools/egret-notes.mjs'])
      assert.ok(fs.existsSync(path.join(folder, 'vendor', file)), file);
    const run = spawnSync(process.execPath, ['vendor/egret.mjs', 'notes', '--check'], {
      cwd: folder,
      encoding: 'utf8'
    });
    assert.equal(run.status, 1, run.stderr);
    assert.match(run.stdout, /^CopyGame#1 Keys — open\n {2}The engine copy has it resolved/m);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
