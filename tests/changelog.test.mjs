// SPDX-License-Identifier: Apache-2.0
// Changelog entries as files: the ones waiting in the repository are well formed, a malformed one is refused with
// its reason, and folding puts them first in both changelogs, newest first, and removes their files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHANGELOGS, foldChanges, foldInto, readChanges, section } from '../tools/changelog.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const entry = (date, title, zh = '中文' + title) => ({
  date,
  en: { title, body: `What ${title} does.` },
  zh: { title: zh, body: `${zh}做了什么。` }
});
function sandbox(changes, english = '# Changelog\n\nIntro.\n\n## Old — 2026-01-01\n\nOld body.\n') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-changelog-'));
  fs.mkdirSync(path.join(dir, 'changes'));
  for (const [name, value] of Object.entries(changes))
    fs.writeFileSync(path.join(dir, 'changes', name), typeof value === 'string' ? value : JSON.stringify(value));
  for (const file of Object.values(CHANGELOGS)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), english);
  }
  return dir;
}

// Break caught: let a malformed entry wait in the repository until a fold fails on it.
test('CL01 every entry waiting in the repository is well formed', () => {
  for (const waiting of readChanges(root)) assert.match(waiting.date, /^\d{4}-\d{2}-\d{2}$/);
});

// Break caught: take an entry missing a language, with a heading of its own, a bad date or a bad file name.
test('CL02 a malformed entry is refused with its file and reason', () => {
  const cases = {
    'no-zh.json': [{ date: '2026-11-20', en: { title: 'T', body: 'B' } }, /exactly date, en and zh/],
    'bad-date.json': [{ ...entry('2026-13-40', 'T') }, /YYYY-MM-DD/],
    'heading.json': [{ ...entry('2026-11-20', 'T'), en: { title: 'T', body: '## Inside\n\nB' } }, /no heading/],
    'two-lines.json': [{ ...entry('2026-11-20', 'T'), en: { title: 'T\nU', body: 'B' } }, /one line/],
    'extra.json': [{ ...entry('2026-11-20', 'T'), pr: 1 }, /exactly date, en and zh/],
    'broken.json': ['{', /not JSON/]
  };
  for (const [name, [value, reason]] of Object.entries(cases)) {
    const dir = sandbox({ [name]: value });
    assert.throws(
      () => readChanges(dir),
      error => error.message.startsWith('changes/' + name) && reason.test(error.message)
    );
  }
  assert.throws(() => readChanges(sandbox({ 'Upper_Case.json': entry('2026-11-20', 'T') })), /lower case words/);
});

// Break caught: fold oldest first, lose the opening lines, glue two entries together, or leave the files behind.
test('CL03 folding puts entries first, newest first, in both languages, and removes their files', () => {
  const dir = sandbox({
    'b-second.json': entry('2026-11-20', 'Second'),
    'a-first.json': entry('2026-11-20', 'First'),
    'older.json': entry('2026-11-19', 'Older')
  });
  assert.deepEqual(foldChanges(dir), ['changes/a-first.json', 'changes/b-second.json', 'changes/older.json']);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'changes')), []);
  const english = fs.readFileSync(path.join(dir, CHANGELOGS.en), 'utf8');
  assert.equal(
    english,
    '# Changelog\n\nIntro.\n\n' +
      '## First — 2026-11-20\n\nWhat First does.\n\n' +
      '## Second — 2026-11-20\n\nWhat Second does.\n\n' +
      '## Older — 2026-11-19\n\nWhat Older does.\n\n' +
      '## Old — 2026-01-01\n\nOld body.\n'
  );
  const chinese = fs.readFileSync(path.join(dir, CHANGELOGS.zh), 'utf8');
  assert.match(chinese, /## 中文First — 2026-11-20\n\n中文First做了什么。\n\n## 中文Second/);
  assert.deepEqual(foldChanges(dir), []);
  assert.equal(fs.readFileSync(path.join(dir, CHANGELOGS.en), 'utf8'), english);
});

// Break caught: drop a changelog that has no entry yet, or fold into the middle of an entry.
test('CL04 a changelog with no entry yet takes the first after its opening lines', () => {
  assert.equal(
    foldInto('# Changelog\n\nIntro.\n', [section(entry('2026-11-20', 'New'), 'en')]),
    '# Changelog\n\nIntro.\n\n## New — 2026-11-20\n\nWhat New does.\n'
  );
});

// Break caught: let the two changelogs grow an entry glued to the one before it, as a union merge once did.
test('CL05 in both changelogs each entry is set off from the one before it by a blank line', () => {
  for (const file of Object.values(CHANGELOGS)) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.equal(/[^\n]\n## /.test(text), false, file + ' has an entry glued to the one before it');
  }
});
