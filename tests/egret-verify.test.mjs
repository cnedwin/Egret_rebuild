// SPDX-License-Identifier: Apache-2.0
// `egret verify` runs a game in a headless browser through tools/verify-game.mjs, which the engine copy carries with the
// pngjs it reads pictures with, and whose report lists what the engine warned of. The browser run itself is checked by
// examples/made-every-frame/verify.mjs; here, what is run, from where, and the new warning's sentences.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { describeErrorCode } from '../packages/runtime/dist/errorHelp.js';
import { collectErrorCodes } from '../tools/error-codes.mjs';
import { verifyArgs } from '../tools/egret.mjs';
import { vendorGame } from '../tools/vendor-game.mjs';

const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'egret-verify-'));

// Break caught: the wrong page, Playwright or output folder handed to the browser run, or a missing one not told.
test('EV01 verify names the page, Playwright, a new output folder and the play script, or says what is missing', () => {
  const game = temporary();
  try {
    // Where Node finds Playwright depends on the machine; the game's own node_modules stands for it here.
    const own = folder => {
      const file = path.join(folder, 'node_modules', 'playwright', 'index.mjs');
      return fs.existsSync(file) ? file : undefined;
    };
    assert.match(verifyArgs([], game, own).error, /There is no page at .*index\.html/);
    fs.writeFileSync(path.join(game, 'index.html'), '<canvas></canvas>');
    assert.match(verifyArgs([], game, own).error, /Playwright is not installed where the game is/);
    fs.mkdirSync(path.join(game, 'node_modules', 'playwright'), { recursive: true });
    fs.writeFileSync(path.join(game, 'node_modules', 'playwright', 'index.mjs'), '');
    const plan = verifyArgs(['--out', 'run'], game, own);
    assert.deepEqual(plan.args.slice(1), [
      path.join(game, 'node_modules', 'playwright', 'index.mjs'),
      path.join(game, 'index.html'),
      path.join(game, 'run')
    ]);
    assert.match(plan.tool, /tools[\\/]verify-game\.mjs$/);
    assert.ok(path.dirname(verifyArgs([], game, own).out) === os.tmpdir(), 'a new folder of the system by default');
    fs.mkdirSync(path.join(game, 'run'));
    assert.match(verifyArgs(['--out', 'run'], game, own).error, /must not exist yet/);
    assert.match(verifyArgs(['--play', 'nope.mjs'], game, own).error, /There is no script/);
    assert.match(verifyArgs(['--playwright', 'x/index.mjs'], game, own).error, /There is no Playwright/);
    assert.match(verifyArgs(['--fast'], game, own).error, /Unknown option --fast/);
    assert.match(verifyArgs(['a.html', 'b.html'], game, own).error, /Name one page/);
  } finally {
    fs.rmSync(game, { recursive: true, force: true });
  }
});

// Break caught: a copy whose verify cannot run for want of the tool or of pngjs, or that runs without Playwright.
test('EV02 the engine copy carries verify-game and pngjs, and verify there names the Playwright it lacks', () => {
  const game = temporary();
  try {
    fs.writeFileSync(path.join(game, 'index.html'), '<canvas></canvas>');
    vendorGame(game, ['@egret/engine']);
    const tool = path.join(game, 'vendor', 'egret', 'tools', 'verify-game.mjs');
    assert.ok(fs.existsSync(tool));
    assert.ok(fs.existsSync(path.join(game, 'vendor', 'egret', 'third-party', 'pngjs', 'LICENSE')));
    const { PNG } = createRequire(tool)('../third-party/pngjs/lib/png.js');
    assert.equal(typeof PNG.sync.read, 'function');
    assert.match(fs.readFileSync(path.join(game, 'vendor', 'SOURCE.md'), 'utf8'), /`pngjs` \(MIT/);
    const run = spawnSync(process.execPath, ['vendor/egret.mjs', 'verify', '--playwright', 'none/index.mjs'], {
      cwd: game,
      encoding: 'utf8'
    });
    assert.equal(run.status, 2, run.stderr);
    assert.match(run.stdout, /There is no Playwright at .*none[\\/]index\.mjs/);
  } finally {
    fs.rmSync(game, { recursive: true, force: true });
  }
});

// Break caught: a warning code an agent cannot look up, or that is told in one language only.
test('EV03 PLAY_MADE_EVERY_FRAME is an engine code with a sentence in English and Chinese', () => {
  assert.ok(collectErrorCodes().includes('PLAY_MADE_EVERY_FRAME'));
  assert.match(
    describeErrorCode('PLAY_MADE_EVERY_FRAME', 'en'),
    /^A warning of play, not an error: update made a text/
  );
  assert.match(describeErrorCode('PLAY_MADE_EVERY_FRAME', 'zh'), /^这是 play 的告警/);
});
