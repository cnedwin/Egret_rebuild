// SPDX-License-Identifier: Apache-2.0
// The agent benchmark: twelve fixed briefs, a game started the same way for each, and a score taken the same way of
// whatever an agent leaves. Runs are compared only if these hold: the briefs well formed in both languages, the start
// the same as `egret new`, and the score low for the mistakes agents make and high for a game that runs. The browser
// part of the score (verify-game) is recorded in the pull request that added it, not run here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { POINTS, PROMPT, briefAsks, loadBriefs, main, recipeAsks, scoreGame, table } from '../tools/agent-bench.mjs';
import { loadCards } from '../tools/egret-guide.mjs';
import { TARGETS } from '../tools/egret-new.mjs';

const cards = loadCards();
const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bench-'));
const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const healthOf = parts => Object.entries(parts).reduce((sum, [name, on]) => sum + (on ? POINTS[name] : 0), 0);

// Break caught: a brief that names a kind of game without a recipe or a target `egret new` cannot make, two briefs of
// one kind, a Chinese brief that asks more or less than the English one, or a recipe whose done-means cannot be marked.
test('AB01 twelve briefs of twelve kinds, each with a recipe, a target and the same asks in English and Chinese', () => {
  const briefs = loadBriefs();
  assert.equal(briefs.length, 12);
  assert.equal(new Set(briefs.map(brief => brief.id)).size, 12);
  assert.equal(new Set(briefs.map(brief => brief.genre)).size, 12, 'one brief of each kind');
  const closing = new Set();
  for (const brief of briefs) {
    assert.match(brief.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(brief.target in TARGETS, brief.id + ' target');
    const card = cards.find(one => one.id === 'genre-' + brief.genre);
    assert.ok(card, brief.id + ' has the recipe genre-' + brief.genre);
    const en = briefAsks(brief),
      zh = briefAsks(brief, 'zh');
    assert.ok(en.length >= 3, brief.id + ' asks ' + en.length);
    assert.equal(zh.length, en.length, brief.id + ': the Chinese brief asks as many things');
    assert.ok(recipeAsks(card).length >= 3, card.id);
    for (const item of recipeAsks(card)) assert.doesNotMatch(item, /npm test|vendor\/egret/, 'commands are measured');
    closing.add(brief.text.en.split('\n\n').at(-1) + '|' + brief.text.zh.split('\n\n').at(-1));
  }
  assert.equal(closing.size, 1, 'every brief ends with the same way of working');
  assert.deepEqual(Object.keys(PROMPT), ['en', 'zh']);
});

// Break caught: a start that differs from `egret new`, a record the agent can read inside the folder, an untouched
// starter that counts as work done, or a person's marks lost when the score is taken again.
test('AB02 a start is egret new with the brief, and the untouched starter is healthy and has done nothing', async () => {
  const root = temporary();
  try {
    const started = await main(['start', 'rh-drum', 'drum', '--agent', 'codex', '--model', 'm1'], root);
    assert.equal(started.code, 0, started.text);
    assert.ok(started.text.includes(PROMPT.en));
    const game = path.join(root, 'drum');
    assert.match(fs.readFileSync(path.join(game, 'BRIEF.md'), 'utf8'), /^# Festival Drum\n\nMake a rhythm game/);
    assert.match(fs.readFileSync(path.join(game, 'AGENTS.md'), 'utf8'), /card genre-rhythm/);
    assert.equal(fs.existsSync(path.join(game, 'drum.bench.json')), false);
    const record = JSON.parse(fs.readFileSync(game + '.bench.json', 'utf8'));
    assert.equal(record.brief, 'rh-drum');
    assert.equal(record.language, 'en');
    assert.match(record.engine, /^[0-9a-f]{7,40}$/);
    assert.deepEqual(Object.keys(record.starter.files).sort(), [
      'src/main.mjs',
      'src/rules.mjs',
      'test/rules.test.mjs'
    ]);
    assert.equal(record.starter.tests, 3);

    assert.equal((await main(['start', 'rh-drum', 'drum'], root)).code, 2, 'not started twice');
    assert.match((await main(['start', 'nope', 'x'], root)).text, /No brief nope: a3-duel/);
    assert.equal((await main(['start', 'rh-drum', 'y', '--language', 'fr'], root)).code, 2);

    const score = scoreGame(game, { browser: false });
    assert.deepEqual(score.health, {
      points: 65,
      of: 65,
      parts: { tests: 30, checkErrors: 25, checkWarnings: 5, verify: 0, engineWarnings: 0, notes: 5 },
      notRun: ['verify', 'engineWarnings']
    });
    assert.equal(score.tests.total, 3);
    assert.deepEqual(score.change, {
      starterSourceReplaced: 0,
      filesAdded: 0,
      testsAdded: 0,
      readmeRewritten: false
    });
    assert.equal(score.review.of, briefAsks(loadBriefs().find(one => one.id === 'rh-drum')).length + 5);
    assert.deepEqual([score.review.met, score.review.marked], [0, 0]);

    // A person marks what they saw; the marks stay when the score is taken again.
    score.review.items[0].met = true;
    score.review.items[1].met = false;
    fs.writeFileSync(game + '.score.json', JSON.stringify(score));
    const again = await main(['score', 'drum', '--no-browser', '--minutes', '40', '--interventions', '1'], root);
    assert.equal(again.code, 0, again.text);
    assert.match(again.text, /health 65\/65/);
    const kept = JSON.parse(fs.readFileSync(game + '.score.json', 'utf8'));
    assert.deepEqual([kept.review.met, kept.review.marked, kept.minutes, kept.interventions], [1, 2, 40, 1]);
    const row = table([kept]).split('\n')[2];
    assert.equal(
      row,
      `| rh-drum | codex | m1 | 65/65 | 1/${kept.review.of} (${kept.review.of - 2} unmarked) | 0% | 0 | 40 | 1 | verify, engineWarnings |`
    );
    assert.equal((await main(['score', 'drum', '--minutes', 'soon'], root)).code, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Break caught: the mistakes agents make most scored as health (a name the entry does not export, a failing test, text
// made every frame), work not counted, or a game of the games repository, which has no package.json, left untested.
test('AB03 an agent mistake costs health, replaced files count as change, and a game without package.json is tested', async () => {
  const root = temporary();
  try {
    assert.equal((await main(['start', 'tt-dominoes', 'dominoes', '--language', 'zh'], root)).code, 0);
    const game = path.join(root, 'dominoes');
    assert.match(
      fs.readFileSync(path.join(game, 'BRIEF.md'), 'utf8'),
      /^# Four Winds Dominoes\n\n做一个网页多米诺骨牌游戏/
    );
    const main_ = path.join(game, 'src', 'main.mjs');
    write(
      main_,
      fs
        .readFileSync(main_, 'utf8')
        .replace(
          "import { play } from '@egret/engine/play';",
          "import { play, createLabel } from '@egret/engine/play';"
        )
        .replace('  update(seconds, game) {\n', "  update(seconds, game) {\n    game.text('x', { x: 0, y: 0 });\n")
    );
    write(
      path.join(game, 'test', 'more.test.mjs'),
      "import test from 'node:test';\ntest('fails', () => { throw new Error('no'); });\n"
    );
    const score = scoreGame(game, { browser: false });
    assert.equal(score.tests.pass, false);
    assert.match(score.tests.failing, /✖ fails/);
    assert.equal(score.check.errors, 1);
    assert.deepEqual(score.check.rules.sort(), ['text-in-update', 'unknown-name']);
    assert.equal(score.health.points, healthOf({ notes: true }));
    assert.deepEqual(score.change, {
      starterSourceReplaced: 0.5,
      filesAdded: 1,
      testsAdded: 1,
      readmeRewritten: false
    });
    assert.equal(score.review.items.filter(item => item.from === 'brief').length, 4);
    assert.match(score.review.items[0].item, /^做一个网页多米诺骨牌游戏，玩家对三个电脑对手。$/);

    // A game as the games repository keeps them: tests under test/ run with node --test, no notes file, no record.
    const plain = path.join(root, 'Plain');
    write(path.join(plain, 'index.html'), '<!doctype html><title>Plain</title>\n');
    write(
      path.join(plain, 'test', 'a.test.mjs'),
      "import test from 'node:test';\ntest('a', () => {});\ntest('b', () => {});\n"
    );
    const other = scoreGame(plain, { browser: false });
    assert.deepEqual([other.tests.pass, other.tests.total], [true, 2]);
    assert.deepEqual(other.health.parts, {
      tests: 30,
      checkErrors: 25,
      checkWarnings: 5,
      verify: 0,
      engineWarnings: 0,
      notes: 0
    });
    assert.equal(other.change, null);
    assert.equal(other.review, null);
    assert.equal(
      table([other]).split('\n')[2],
      '| Plain | – | – | 60/65 | – | – | – | – | – | verify, engineWarnings |'
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
