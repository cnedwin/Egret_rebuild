// SPDX-License-Identifier: Apache-2.0
// `egret verify` runs a game in a headless browser through tools/verify-game.mjs, which the engine copy carries with the
// pngjs it reads pictures with, and whose report lists what the engine warned of; `--screens` runs it on many screens
// through tools/verify-screens.mjs. The browser runs themselves are checked by examples/made-every-frame/verify.mjs and
// examples/screen-check/verify.mjs; here, what is run, from where, what the screens check finds in the controls it is
// told of, and the new warning's sentences.
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
import { SCREENS, TOUCH_TARGET, controlFindings } from '../tools/verify-screens.mjs';

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
    assert.ok(fs.existsSync(path.join(game, 'vendor', 'egret', 'tools', 'verify-screens.mjs')));
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

// Break caught: --screens running the one-window check, a screen name taken for the page, or a misspelt screen run as
// nothing.
test('EV04 verify --screens runs verify-screens on every screen, or on those named, with an optional play script', () => {
  const game = temporary();
  try {
    fs.writeFileSync(path.join(game, 'index.html'), '<canvas></canvas>');
    const playwright = path.join(game, 'pw.mjs');
    fs.writeFileSync(playwright, '');
    const plan = verifyArgs(['--screens', '--playwright', 'pw.mjs', '--out', 'run'], game);
    assert.match(plan.tool, /tools[\\/]verify-screens\.mjs$/);
    assert.deepEqual(plan.args.slice(1), [
      playwright,
      path.join(game, 'index.html'),
      path.join(game, 'run'),
      Object.keys(SCREENS).join(',')
    ]);
    assert.deepEqual(plan.screens, Object.keys(SCREENS));
    const two = verifyArgs(['--screens=phone-notch,desktop', '--playwright', 'pw.mjs'], game);
    assert.equal(two.args.at(-1), 'phone-notch,desktop');
    assert.match(path.basename(two.out), /^egret-screens-/);
    assert.match(verifyArgs(['--screens=phone', '--playwright', 'pw.mjs'], game).error, /not phone\./);
    assert.match(verifyArgs(['--screens=', '--playwright', 'pw.mjs'], game).error, /The screens are phone-small/);
    assert.match(verifyArgs(['--screens=desktop,desktop', '--playwright', 'pw.mjs'], game).error, /only once/);
    fs.writeFileSync(path.join(game, 'play.mjs'), '');
    const route = verifyArgs(
      ['--screens=phone-notch,desktop', '--play', 'play.mjs', '--playwright', 'pw.mjs', '--out', 'played'],
      game
    );
    assert.match(route.tool, /tools[\\/]verify-screens\.mjs$/);
    assert.deepEqual(route.args.slice(1), [
      playwright,
      path.join(game, 'index.html'),
      path.join(game, 'played'),
      'phone-notch,desktop',
      path.join(game, 'play.mjs')
    ]);
    assert.match(
      verifyArgs(['--screens', '--play', 'missing.mjs', '--playwright', 'pw.mjs'], game).error,
      /There is no script/
    );
  } finally {
    fs.rmSync(game, { recursive: true, force: true });
  }
});

// Break caught: a screen whose stand-in insets leave no safe part, or one too small to be a phone.
test('EV05 every screen is whole CSS pixels with a safe part, and phones and tablets take touch', () => {
  for (const [name, screen] of Object.entries(SCREENS)) {
    assert.ok(Number.isInteger(screen.width) && Number.isInteger(screen.height), name);
    const { top, right, bottom, left } = screen.insets;
    assert.ok(left + right < screen.width / 2 && top + bottom < screen.height / 2, name);
    assert.equal(screen.touch, name !== 'desktop', name);
  }
  assert.ok(SCREENS['phone-notch'].insets.top > 0 && SCREENS['phone-notch-wide'].insets.left > 0);
});

// Break caught: a control under the notch passed, a nested control told as overlapping its holder, a mouse held to a
// finger's size, or a control told without the name an agent finds it by.
test('EV06 the screens check finds controls outside the safe part, smaller than a finger, or covering each other', () => {
  const safe = { x: 0, y: 59, width: 393, height: 759 };
  const controls = [
    { name: 'Pause', x: 300, y: 10, width: 80, height: 44 },
    { name: 'Jump', x: 20, y: 600, width: 120, height: 60 },
    { name: 'Fire', x: 120, y: 600, width: 120, height: 60 },
    { name: 'Panel', x: 100, y: 200, width: 200, height: 200 },
    { name: 'Inside', x: 120, y: 220, width: 60, height: 60 },
    { name: '', x: 330.4, y: 700, width: TOUCH_TARGET - 1, height: 50 }
  ];
  assert.deepEqual(controlFindings(controls, safe, true), [
    { check: 'inSafeArea', severity: 'error', control: 'Pause', rect: { x: 300, y: 10, width: 80, height: 44 } },
    { check: 'touchTarget', severity: 'warning', control: 'the control at 330, 700', size: [43, 50] },
    { check: 'apart', severity: 'warning', controls: ['Jump', 'Fire'] }
  ]);
  assert.deepEqual(
    controlFindings(controls, safe, false).map(finding => finding.check),
    ['inSafeArea', 'apart'],
    'a mouse needs no finger-sized target'
  );
  // Edges that touch, and a pixel of rounding at the edge of the safe part, are not findings.
  assert.deepEqual(
    controlFindings(
      [
        { name: 'A', x: 0, y: 58.5, width: 60, height: 60 },
        { name: 'B', x: 60, y: 58.5, width: 60, height: 60 }
      ],
      safe,
      true
    ),
    []
  );
});
