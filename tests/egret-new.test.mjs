// SPDX-License-Identifier: Apache-2.0
// `egret new` makes the folder a coding agent starts a game in. It must run as made: its rules tested in Node, its files
// clean under `egret check`, its AGENTS.md short enough to read every time and pointing at cards that exist, and the
// same from a game's engine copy as from this repository. The browser run of a new game is recorded in the pull
// request that added it, through `egret verify`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { estimateTokens, loadCards } from '../tools/egret-guide.mjs';
import { newGame } from '../tools/egret.mjs';
import { STARTER_ENTRIES, TARGETS, starterFiles } from '../tools/egret-new.mjs';

const cardIds = new Set(loadCards().map(card => card.id));
const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'egret-new-'));
// The game's own test run reports to its own output, not to this test runner's.
const { NODE_TEST_CONTEXT: _, ...env } = process.env;
const node = (cwd, ...args) => spawnSync(process.execPath, args, { cwd, env, encoding: 'utf8' });
const rules = cwd => node(cwd, '--import', './vendor/node-register.mjs', '--test', 'test/**/*.test.mjs');

// Break caught: an AGENTS.md too long to read each time, one that sends an agent to a card that is gone, a Claude Code
// file that does not bring it in, or a skill Claude Code cannot load.
test('EW01 every target has a short AGENTS.md naming real cards, CLAUDE.md that brings it in, and a skill', () => {
  for (const target of Object.keys(TARGETS)) {
    const files = starterFiles({ title: 'Star Catch', target, folder: 'StarCatch' });
    const agents = files['AGENTS.md'];
    assert.ok(estimateTokens(agents) <= 1000, target + ': ' + estimateTokens(agents) + ' tokens');
    for (const [, id] of agents.matchAll(/`card ([a-z0-9-]+)`/g))
      assert.ok(cardIds.has(id), target + ' names card ' + id);
    assert.ok(agents.includes('card ' + TARGETS[target].card), target);
    for (const command of ['guide', 'explain', 'check', 'verify', 'notes'])
      assert.ok(agents.includes('node vendor/egret.mjs ' + command), target + ' names ' + command);
    assert.equal(files['CLAUDE.md'], '@AGENTS.md\n');
    const skill = files['.claude/skills/egret-game/SKILL.md'];
    assert.match(skill, /^---\nname: egret-game\ndescription: [^\n]{40,1024}\n---\n/);
    const manifest = JSON.parse(files['package.json']);
    assert.equal(manifest.type, 'module');
    assert.match(manifest.scripts.test, /node-register\.mjs --test/);
    assert.match(
      files['src/rules.mjs'],
      new RegExp(`WIDTH = ${TARGETS[target].width};\\nexport const HEIGHT = ${TARGETS[target].height};`)
    );
    assert.equal(files['src/main.mjs'].includes("fit: 'expand'"), TARGETS[target].fit === 'expand', target);
  }
});

// Break caught: a new game whose tests fail, whose files `egret check` faults, a folder overwritten, or a target or
// title taken that is not one.
test('EW02 a new game from this repository passes its own tests and the check, and refuses what it cannot make', async () => {
  const root = temporary();
  try {
    const made = await newGame(['Stars', '--title', 'Star Catch', '--target', 'wechat'], root);
    assert.equal(made.code, 0, made.text);
    const game = path.join(root, 'Stars');
    const map = JSON.parse(fs.readFileSync(path.join(game, 'vendor', 'importmap.json'), 'utf8')).imports;
    for (const entry of STARTER_ENTRIES) assert.ok(entry in map, entry);
    const tested = rules(game);
    assert.equal(tested.status, 0, tested.stdout + tested.stderr);
    assert.match(tested.stdout, /ℹ pass 3\n/);
    const checked = node(game, 'vendor/egret.mjs', 'check', '--strict');
    assert.equal(checked.status, 0, checked.stdout);
    assert.match(checked.stdout, /^0 errors and 0 warnings in/);
    assert.match(fs.readFileSync(path.join(game, 'AGENTS.md'), 'utf8'), /^# Star Catch: how to work on this game/);
    assert.equal((await newGame(['Stars'], root)).code, 2, 'a folder with files is not written over');
    assert.match(
      (await newGame(['Other', '--target', 'console'], root)).text,
      /The target is one of web, mobile, wechat, steam/
    );
    assert.match((await newGame(['Other', '--title', 'a "b"'], root)).text, /A title is one line of words/);
    assert.equal((await newGame([], root)).code, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// Break caught: `new` from a game's engine copy failing, or making a game without the engine it runs on.
test('EW03 a game makes another beside it from its own engine copy', async () => {
  const root = temporary();
  try {
    assert.equal((await newGame(['First'], root)).code, 0);
    const made = node(path.join(root, 'First'), 'vendor/egret.mjs', 'new', '../Second', '--target', 'mobile');
    assert.equal(made.status, 0, made.stdout + made.stderr);
    const second = path.join(root, 'Second');
    assert.equal(
      fs.readFileSync(path.join(second, 'vendor', 'SOURCE.md'), 'utf8'),
      fs.readFileSync(path.join(root, 'First', 'vendor', 'SOURCE.md'), 'utf8'),
      'the same engine copy, at the same pin'
    );
    assert.equal(rules(second).status, 0);
    assert.equal(node(second, 'vendor/egret.mjs', 'check').status, 0);
    assert.match(fs.readFileSync(path.join(second, 'src', 'main.mjs'), 'utf8'), /fit: 'expand'/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
