// SPDX-License-Identifier: Apache-2.0
// tools/egret.mjs is what an agent runs while it makes a game: in this repository, and from the engine copy that
// tools/vendor-game.mjs writes into a game. Both places must give the same cards for the same question, explain an error
// code in both languages from the runtime's own sentences, and keep the copy free of cards the guide has dropped.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describeErrorCode } from '../packages/runtime/dist/errorHelp.js';
import { collectErrorCodes } from '../tools/error-codes.mjs';
import { explain, main } from '../tools/egret.mjs';
import { loadCards, readArea, readIndex, run } from '../tools/egret-guide.mjs';
import { agentKitFiles, vendorGame } from '../tools/vendor-game.mjs';

const cards = loadCards();
const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'egret-command-'));
const options = { command: 'node tools/egret.mjs guide' };

// Break caught: a command that stops reaching the guide, or answers differently from the guide's own tool.
test('EG01 guide, card and list are the guide; no command or an unknown one prints the usage', async () => {
  const question = ['touch', 'buttons', 'on', 'a', 'phone'];
  assert.deepEqual(await main(['guide', ...question], cards), run(question, cards, options));
  assert.deepEqual(await main(['card', 'save-data'], cards), run(['--card', 'save-data'], cards, options));
  assert.equal((await main(['list'], cards)).text, readIndex());
  assert.equal((await main(['list', 'ship'], cards)).text, readArea('ship'));
  for (const args of [[], ['draw'], ['card'], ['card', 'a', 'b'], ['explain']]) {
    const result = await main(args, cards);
    assert.equal(result.code, 2, args.join(' '));
    assert.match(result.text, /Usage:\n {2}node tools\/egret\.mjs guide /);
  }
  assert.equal((await main(['help'], cards)).code, 0);
});

// Break caught: an explanation in one language only, a sentence other than the runtime's, a code's card left out, or
// an unknown code passing as known.
test('EG02 explain gives the runtime sentence in English and Chinese, then the cards that name the code', async () => {
  const named = cards.find(card => card.triggers.some(trigger => /^[A-Z]+(?:_[A-Z0-9]+)+$/.test(String(trigger))));
  const code = named.triggers.find(trigger => /^[A-Z]+(?:_[A-Z0-9]+)+$/.test(String(trigger)));
  const result = await explain(code, cards);
  assert.equal(result.code, 0);
  assert.ok(result.text.includes(describeErrorCode(code, 'en')));
  assert.ok(result.text.includes(describeErrorCode(code, 'zh')));
  assert.match(result.text, new RegExp('^=== ' + named.id + ' · ', 'm'));
  const unknown = await explain('NO_SUCH_ENGINE_CODE', cards);
  assert.equal(unknown.code, 1);
  assert.match(unknown.text, /is not one of this engine's error codes/);
  assert.equal((await explain('lower_case', cards)).code, 2);
});

// Break caught: the engine copy without the command or the guide, a copy that answers differently from this repository,
// a card the guide dropped staying in the copy, or the kit left behind when a game asks for none.
test('EG03 the engine copy carries the command and the guide, answers as here, and is replaced whole', () => {
  const game = temporary();
  try {
    vendorGame(game, ['@egret/engine']);
    const vendor = path.join(game, 'vendor');
    for (const [, to] of agentKitFiles()) assert.ok(fs.existsSync(path.join(vendor, ...to.split('/'))), to);
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(vendor, 'egret', 'error-codes.json'), 'utf8')).codes,
      collectErrorCodes()
    );
    assert.match(fs.readFileSync(path.join(vendor, 'SOURCE.md'), 'utf8'), /node vendor\/egret\.mjs guide <question>/);
    const egret = (...args) =>
      spawnSync(process.execPath, ['vendor/egret.mjs', ...args], { cwd: game, encoding: 'utf8' });
    const asked = egret('guide', 'save', 'data', 'private', 'window');
    assert.equal(asked.status, 0, asked.stderr);
    const here = run(['save', 'data', 'private', 'window'], cards, { command: 'node vendor/egret.mjs guide' });
    assert.equal(asked.stdout, here.text);
    const explained = egret('explain', 'ASSET_LEASE_RELEASED');
    assert.equal(explained.status, 0, explained.stderr);
    assert.ok(explained.stdout.includes(describeErrorCode('ASSET_LEASE_RELEASED', 'zh')));
    assert.match(egret().stdout, /node vendor\/egret\.mjs guide /);
    // A card the guide no longer has goes with the next copy.
    const stray = path.join(vendor, 'egret', 'guide', 'cards', 'perf', 'dropped-card.txt');
    fs.writeFileSync(stray, '---\nid: dropped-card\n---\n');
    vendorGame(game, ['@egret/engine']);
    assert.equal(fs.existsSync(stray), false);
    vendorGame(game, ['@egret/engine'], { agentKit: false });
    assert.equal(fs.existsSync(path.join(vendor, 'egret')), false);
    assert.equal(fs.existsSync(path.join(vendor, 'egret.mjs')), false);
    assert.ok(fs.existsSync(path.join(vendor, 'importmap.json')), 'the engine itself stays');
  } finally {
    fs.rmSync(game, { recursive: true, force: true });
  }
});
