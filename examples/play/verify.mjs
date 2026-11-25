// SPDX-License-Identifier: Apache-2.0
// Plays the three games of the play example to their ends in a real browser, as a person would: by the keyboard and
// the mouse, reading the page from its pictures. Nothing in a game is there for this check.
//
//   node examples/play/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]
//
// Without the third argument the installed Edge is launched headed. With `software` the browser that Playwright
// bundles runs headless with software rendering. Input is injected through the browser's automation protocol; no
// person pressed a key, and no sound was heard: the check counts the sounds the page starts.
import http from 'node:http';
import { verifyPrimaryPointer } from './verify-primary-pointer.mjs';
import { verifyScreenFit } from './verify-screen-fit.mjs';
import { verifyGestures } from './verify-gestures.mjs';
import { verifyViews } from './verify-views.mjs';
import { verifyViewParts } from './verify-view-parts.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url)),
  [playwrightPath, out, renderer] = process.argv.slice(2);
if (
  !playwrightPath ||
  !out ||
  !path.isAbsolute(playwrightPath) ||
  !path.isAbsolute(out) ||
  fs.existsSync(out) ||
  ![undefined, 'software'].includes(renderer)
)
  throw new Error(
    'Usage: node examples/play/verify.mjs <absolute Playwright index.mjs> <new absolute output directory> [software]'
  );
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(pathToFileURL(playwrightPath).href),
  { PNG } = createRequire(import.meta.url)('pngjs');
const types = {
  '.html': 'text/html',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.json': 'application/json'
};
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404, { connection: 'close' });
    response.end();
    return;
  }
  response.writeHead(200, {
    'content-type': types[path.extname(file)] ?? 'application/octet-stream',
    connection: 'close'
  });
  response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = {
  profile: 'play-example/1',
  node: process.version,
  input: 'injected through the automation protocol',
  renderer:
    renderer === 'software'
      ? 'bundled Chromium, headless, software rendering'
      : 'installed Edge, headed, default launch',
  cases: []
};
const browser = await chromium.launch(
  renderer === 'software'
    ? {
        args: [
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
          '--ignore-gpu-blocklist',
          '--autoplay-policy=no-user-gesture-required'
        ]
      }
    : { channel: 'msedge', headless: false }
);
report.browser = browser.version();

const BUTTON = 0x3b82f6;
/** What a game of `width` by `height` shows, and how to press it. */
async function stageOf(page, width, height) {
  const box = await page.evaluate(() => {
    const bounds = document.querySelector('canvas').getBoundingClientRect();
    return [bounds.left, bounds.top, bounds.width, bounds.height];
  });
  const at = (x, y) => [box[0] + (x * box[2]) / width, box[1] + (y * box[3]) / height];
  return {
    at,
    /** A picture of the page, with the colour at a place of the stage as 0xRRGGBB. */
    async look() {
      const png = PNG.sync.read(await page.screenshot());
      return (x, y) => {
        const [px, py] = at(x, y),
          o = 4 * (Math.round(py) * png.width + Math.round(px));
        return (png.data[o] << 16) | (png.data[o + 1] << 8) | png.data[o + 2];
      };
    },
    /** The same of a small part of the page around a place, which is quick enough to watch something that moves. */
    async lookNear(x, y, reach) {
      const [left, top] = at(x - reach, y - reach),
        [right, bottom] = at(x + reach, y + reach);
      const clip = {
        x: Math.floor(left),
        y: Math.floor(top),
        width: Math.ceil(right - left),
        height: Math.ceil(bottom - top)
      };
      const png = PNG.sync.read(await page.screenshot({ clip }));
      return (px, py) => {
        const [ax, ay] = at(px, py),
          cx = Math.min(png.width - 1, Math.max(0, Math.round(ax - clip.x))),
          cy = Math.min(png.height - 1, Math.max(0, Math.round(ay - clip.y))),
          o = 4 * (cy * png.width + cx);
        return (png.data[o] << 16) | (png.data[o + 1] << 8) | png.data[o + 2];
      };
    },
    move: (x, y) => page.mouse.move(...at(x, y)),
    async tap(x, y) {
      await page.mouse.move(...at(x, y));
      await page.mouse.down();
      await page.waitForTimeout(60);
      await page.mouse.up();
    }
  };
}
/** Whether two colours are the same but for a rounding of each part. */
const alike = (a, b, tolerance = 12) =>
  [16, 8, 0].every(shift => Math.abs(((a >> shift) & 255) - ((b >> shift) & 255)) <= tolerance);
const hex = colour => '0x' + colour.toString(16).padStart(6, '0');
const is = (actual, expected, label) =>
  assert.ok(alike(actual, expected), label + ': ' + hex(actual) + ' is not ' + hex(expected));
/** Looks again and again until the picture answers, or fails with the label. */
async function until(page, stage, test, label, seconds = 20) {
  for (const end = Date.now() + seconds * 1000; Date.now() < end; ) {
    const result = await test(await stage.look());
    if (result) return result;
    await page.waitForTimeout(120);
  }
  assert.fail(label + ' did not happen in ' + seconds + ' seconds');
}
const sounds = page => page.evaluate(() => globalThis.__soundsStarted);

/** Run host controls in their own document so the fullscreen example cannot handle their keys. */
async function verifyEmbeddedPage(page) {
  const iframe = await page.evaluateHandle(async () => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;inset:0;width:320px;height:220px;z-index:1';
    const imports = document.querySelector('script[type="importmap"]').outerHTML;
    frame.srcdoc =
      imports +
      '<body style="background:#f43"><button>A</button><button>B</button>' +
      '<main style="width:160px;height:100px"></main><button>After the game</button></body>';
    const ready = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
    document.body.append(frame);
    await ready;
    return frame;
  });
  const frame = await iframe.asElement().contentFrame();
  const [first, second, after] = await frame.getByRole('button').all();
  const game = await frame.evaluateHandle(async () => {
    for (const button of document.querySelectorAll('button')) {
      button.addEventListener('click', () => (button.dataset.clicks = String(Number(button.dataset.clicks ?? 0) + 1)));
    }
    const { play } = await import('@egret/engine/play');
    return play({
      width: 160,
      height: 100,
      parent: document.querySelector('main'),
      transparent: true,
      audio: false,
      backend: 'webgl2'
    });
  });
  const canvas = frame.locator('canvas');
  const isFocused = locator => locator.evaluate(node => node === document.activeElement);
  const rightHeld = () => game.evaluate(g => g.keys.down('right'));
  try {
    await first.focus();
    await page.keyboard.press('Tab');
    assert.ok(await isFocused(second), 'Tab reaches the second page button');
    await page.keyboard.press('Shift+Tab');
    assert.ok(await isFocused(first), 'Shift+Tab returns to the first page button');
    await page.keyboard.press('Space');
    await second.focus();
    await page.keyboard.press('Enter');
    assert.deepEqual(
      await frame.locator('button').evaluateAll(buttons => buttons.slice(0, 2).map(b => b.dataset.clicks)),
      ['1', '1']
    );
    await canvas.click();
    assert.ok(await isFocused(canvas), 'pointer focus reaches the game');
    await page.keyboard.down('ArrowRight');
    assert.ok(await rightHeld(), 'the focused game holds the key');
    await page.keyboard.press('Tab');
    assert.ok(await isFocused(after), 'Tab leaves the game for the following control');
    assert.equal(await rightHeld(), false, 'focus loss releases the key before keyup');
    await page.keyboard.up('ArrowRight');
    await canvas.click();
    assert.equal(await rightHeld(), false, 'returning to the game does not revive a held key');
    const png = PNG.sync.read(await canvas.screenshot());
    const offset = 4 * (Math.floor(png.height / 2) * png.width + Math.floor(png.width / 2));
    const center = [...png.data.subarray(offset, offset + 4)];
    assert.deepEqual(center, [255, 68, 51, 255], 'the host background shows through the canvas');
    // The browser owns the contact ids, even when a window loses focus before delivering pointerup.
    await game.evaluate(g => {
      g.touchButton('Jump', { x: 24, y: 24, radius: 16, key: 'space', always: true });
    });
    const cdp = await page.context().newCDPSession(page);
    const box = await canvas.boundingBox();
    const point = { x: box.x + (24 * box.width) / 160, y: box.y + (24 * box.height) / 100, id: 1 };
    const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    const spaceHeld = () => game.evaluate(g => g.keys.down('space'));
    try {
      await touch('touchStart', [point]);
      assert.ok(await spaceHeld(), 'the on-screen button holds Space');
      await frame.evaluate(() => window.dispatchEvent(new FocusEvent('blur')));
      assert.equal(await spaceHeld(), false, 'window blur releases a lost contact');
      await canvas.focus();
      await page.keyboard.down('Space');
      assert.ok(await spaceHeld(), 'the physical key works without the original pointerup');
      await page.keyboard.up('Space');
      assert.equal(await spaceHeld(), false, 'physical release cannot reactivate the lost contact');
      await touch('touchStart', [point, { ...point, x: point.x + 1, id: 2 }]);
      assert.ok(await spaceHeld(), 'a fresh contact can use the same button');
      await touch('touchEnd', []);
      assert.equal(await spaceHeld(), false);
    } finally {
      await cdp.detach();
    }
    return { buttonActivations: [1, 1], center };
  } finally {
    await game.evaluate(g => g.dispose());
    await iframe.evaluate(node => node.remove());
  }
}

async function scenario(name, game, width, height, body, context = {}) {
  const owned = await browser.newContext({ viewport: { width: 960, height: 640 }, ...context }),
    page = await owned.newPage(),
    row = { name, status: 'INCOMPLETE', errors: [] };
  report.cases.push(row);
  page.on('pageerror', error => row.errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') row.errors.push(message.text());
  });
  page.on('requestfailed', request => row.errors.push('request failed: ' + request.url()));
  // The sounds the page starts are counted; nothing else of the page is changed.
  await page.addInitScript(() => {
    globalThis.__soundsStarted = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      globalThis.__soundsStarted++;
      return start.apply(this, args);
    };
  });
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/examples/play/index.html?game=' + game);
    await page.waitForSelector('canvas');
    await page.waitForTimeout(1200);
    await body(page, await stageOf(page, width, height), row);
    assert.deepEqual(row.errors, []);
    await page.screenshot({ path: path.join(out, game + '.png') });
    row.status = 'PASS';
  } catch (error) {
    row.status = 'FAIL';
    row.failure = String(error.stack ?? error);
    await page.screenshot({ path: path.join(out, game + '-failed.png') }).catch(() => {});
    process.exitCode = 1;
  }
  await owned.close();
}

await scenario(
  'breakout: the paddle follows, a brick breaks, three lost balls end it, and it starts again',
  'breakout',
  480,
  320,
  async (page, stage, row) => {
    row.asyncLifecycle = await page.evaluate(async () => {
      const { runPlayLifecycle } = await import('./verify-async-lifecycle.mjs');
      return runPlayLifecycle('webgl2');
    });
    const tapTargets = await page.evaluate(async () => {
      const { beginInput } = await import('./verify-async-lifecycle.mjs');
      return beginInput('webgl2');
    });
    try {
      for (const target of [tapTargets.scene, tapTargets.overlay]) await page.mouse.click(target.x, target.y);
    } finally {
      row.asyncLifecycle.taps = await page.evaluate(async () => {
        const { readInput } = await import('./verify-async-lifecycle.mjs');
        return readInput();
      });
    }
    row.embeddedPage = await verifyEmbeddedPage(page);
    row.primaryPointer = await verifyPrimaryPointer(page);
    row.clock = await page.evaluate(async () => {
      const { play } = await import('@egret/engine/play');
      const game = await play({ width: 96, height: 64, backend: 'webgl2' });
      const frames = async count => {
        for (let i = 0; i < count; i++) await new Promise(resolve => requestAnimationFrame(resolve));
      };
      const target = { x: 0 };
      try {
        game.tween(target).to({ x: 100 }, 1);
        await game.wait(0.08);
        const before = { x: target.x, time: game.time };
        game.pause();
        await frames(5);
        const paused = { x: target.x, time: game.time };
        if (!(before.x > 0 && before.x === paused.x && before.time === paused.time))
          throw Error('A paused game advanced its tween');
        game.resume();
        await game.wait(0.05);
        const resumed = { x: target.x, time: game.time };
        if (!(resumed.x > paused.x)) throw Error('The paused tween did not resume');
        game.timeScale = 0;
        await frames(5);
        const zero = { x: target.x, time: game.time };
        if (zero.x !== resumed.x || zero.time !== resumed.time) throw Error('Zero game time advanced its tween');
        game.timeScale = 0.5;
        await game.wait(0.05);
        const half = { x: target.x, time: game.time };
        if (Math.abs(half.x - zero.x - 100 * (half.time - zero.time)) > 1)
          throw Error('The tween and game time used different scales');
        game.hitStop(1);
        await frames(5);
        const hit = { x: target.x, time: game.time };
        if (hit.x !== half.x || hit.time !== half.time) throw Error('A hit stop advanced its tween');
        await game.restart();
        if (game.time !== 0) throw Error('Restart did not reset game time');
        const next = { x: 0 };
        game.tween(next).to({ x: 1 }, 0.05);
        await game.wait(0.1);
        if (next.x !== 1) throw Error('The new game generation did not advance');
        game.timeScale = 8;
        const fast = { x: 0 };
        game.tween(fast).to({ x: 1 }, 0.5);
        await game.wait(0.8);
        if (fast.x !== 1) throw Error('A high time scale failed the Engine clock limit');
        let callbacks = 0;
        game
          .tween({ x: 0 })
          .wait(0.03)
          .call(() => {
            callbacks++;
            void game.dispose();
          })
          .call(() => {
            callbacks++;
          });
        await frames(8);
        if (callbacks !== 1 || game.browser.loop.state !== 'closed')
          throw Error('A tween continued after it closed the game');
        return { before, paused, resumed, zero, half, hit, restarted: next.x, fast: fast.x, callbacks };
      } finally {
        await game.dispose();
      }
    });
    const BRICKS = [0xff4d6d, 0xffa64d, 0xffe14d, 0x7be069],
      PADDLE = 0x8fa8ff,
      brick = (look, r, c) => look(40 + c * 57, 40 + r * 20);
    // The ball has been in play through the checks above, so a few bricks may be gone: each row is its colour, and
    // most of the bricks are there.
    const standing = look =>
      BRICKS.reduce(
        (sum, colour, r) => sum + [...Array(8).keys()].filter(c => alike(brick(look, r, c), colour)).length,
        0
      );
    assert.ok(standing(await stage.look()) >= 24, 'the bricks are drawn');
    // Held down, the pointer carries the paddle; let go, the arrows move it.
    await stage.move(110, 200);
    await page.mouse.down();
    // A lost ball flashes the stage for a moment, so each is looked for until it is seen.
    await until(page, stage, look => alike(look(110, 300), PADDLE), 'the paddle coming under the pointer', 3);
    await page.mouse.up();
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowRight');
    await until(page, stage, look => alike(look(90, 300), 0x101828), 'the arrows moving the paddle away', 3);
    // The ball breaks a brick of the lowest row, and the game makes a sound of it.
    await until(
      page,
      stage,
      look => [0, 1, 2, 3, 4, 5, 6, 7].some(c => !alike(brick(look, 3, c), BRICKS[3])),
      'a brick breaking'
    );
    assert.ok((await sounds(page)) > 0, 'a sound was started');
    // The paddle is kept at the end the ball is not at, so each ball is lost. The ball is the only white under the bricks.
    await page.mouse.down();
    const ended = look => alike(look(170, 200), BUTTON);
    for (const end = Date.now() + 90000; ; ) {
      const look = await stage.look();
      if (ended(look)) break;
      assert.ok(Date.now() < end, 'three balls were not lost in 90 seconds');
      let ball;
      for (let y = 120; y < 285 && ball === undefined; y += 4)
        for (let x = 4; x < 480; x += 4) if (alike(look(x, y), 0xffffff, 6)) ball = x;
      await stage.move((ball ?? 240) < 240 ? 440 : 40, 200);
      await page.waitForTimeout(60);
    }
    await page.mouse.up();
    row.note = 'the game ended with its button shown';
    await page.waitForTimeout(200);
    await stage.tap(240, 200);
    await page.waitForTimeout(500);
    const again = await stage.look();
    assert.ok(standing(again) === 32 && !ended(again), 'the button started the game again with every brick');
  }
);

await scenario(
  'platformer: it lands, runs by key and by pointer, jumps, reaches the goal, and starts again',
  'platformer',
  480,
  270,
  async (page, stage) => {
    const HERO = 0xff6b6b,
      GROUND = 0x4a6fa5;
    // The hero falls from where it is made and stands on the ground.
    const start = await stage.look();
    is(start(60, 228), HERO, 'the hero standing on the ground');
    is(start(60, 250), GROUND, 'the ground under it');
    const before = await sounds(page);
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    assert.ok(!alike((await stage.look())(60, 236), HERO), 'a jump lifted the hero');
    assert.ok((await sounds(page)) > before, 'the jump was heard');
    await page.waitForTimeout(900);
    // A finger held on the right half runs right.
    await stage.move(400, 200);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();
    assert.ok(!alike((await stage.look())(60, 228), HERO), 'the pointer moved the hero');
    // Running right along the ground reaches the goal; the level is wider than the stage, so the view scrolls.
    await page.keyboard.down('ArrowRight');
    await until(page, stage, look => alike(look(170, 150), BUTTON), 'reaching the goal', 30);
    await page.keyboard.up('ArrowRight');
    await stage.tap(240, 150);
    await page.waitForTimeout(1200);
    const again = await stage.look();
    is(again(60, 228), HERO, 'the hero back at the start');
    assert.ok(!alike(again(170, 150), BUTTON), 'the button is gone');
  }
);

await scenario(
  'memory: cards turn, a pair stays, all eight pairs end it, and it starts again',
  'memory',
  360,
  520,
  async (page, stage) => {
    const BACK = 0x3a506b,
      TABLE = 0x14213d,
      place = i => [57 + (i % 4) * 82, 115 + Math.floor(i / 4) * 82];
    const backs = look => [...Array(16).keys()].filter(i => alike(look(...place(i)), BACK)).length;
    assert.equal(backs(await stage.look()), 16, 'sixteen cards face down');
    // Turn a card and read its face: the colour it shows once it is as wide as it was, at its middle and near its edges.
    const shows = (look, i) => {
      const [x, y] = place(i),
        seen = [look(x, y), look(x - 28, y), look(x + 28, y), look(x, y - 28), look(x, y + 28)];
      // The pieces thrown out by a pair may cross a card: the card shows what four of five places agree on.
      return seen.find(colour => seen.filter(other => alike(other, colour, 4)).length >= 4);
    };
    // A tap while the card before is still turning is not taken, as for a person; the card is tapped again.
    const turn = async i => {
      for (let tries = 0; tries < 8; tries++) {
        await stage.tap(...place(i));
        // Two cards that differ show their faces for half a second: the card alone is looked at, again and again,
        // which is quick enough not to miss it.
        for (const end = Date.now() + 900; Date.now() < end; ) {
          const colour = shows(await stage.lookNear(...place(i), 32), i);
          // Half way through its turn a card is too narrow to see, and what shows is the table under it.
          if (colour !== undefined && !alike(colour, BACK) && !alike(colour, TABLE)) return colour;
        }
      }
      assert.fail('card ' + i + ' did not turn');
    };
    const down = (...cards) =>
      until(page, stage, look => cards.every(i => alike(shows(look, i) ?? 0, BACK)), 'cards turning back', 6);
    // Played as a person would: two cards at a time, remembering what each was, then every pair that is known.
    const faces = [],
      matched = new Set();
    for (let i = 0; i < 16; i += 2) {
      faces[i] = await turn(i);
      faces[i + 1] = await turn(i + 1);
      if (alike(faces[i], faces[i + 1], 4)) matched.add(i).add(i + 1);
      // A pair that does not match turns back after half a second.
      else await down(i, i + 1);
    }
    const kinds = faces.filter((face, i) => faces.findIndex(other => alike(other, face, 4)) === i);
    assert.equal(kinds.length, 8, 'eight faces, two cards of each: ' + faces.map(hex).join(' '));
    for (let i = 0; i < 16; i++) {
      if (matched.has(i)) continue;
      const other = faces.findIndex((face, j) => j > i && !matched.has(j) && alike(face, faces[i], 4));
      assert.ok(
        other > i,
        'card ' + i + ' has a twin: ' + faces.map(hex).join(' ') + ' matched ' + [...matched].join(',')
      );
      await turn(i);
      await turn(other);
      matched.add(i).add(other);
    }
    await until(page, stage, look => alike(look(110, 492), BUTTON), 'the end of the game', 5);
    assert.equal(backs(await stage.look()), 0, 'every card is face up');
    assert.ok((await sounds(page)) >= 16, 'the turns and the pairs were heard');
    await stage.tap(180, 492);
    await page.waitForTimeout(600);
    const again = await stage.look();
    assert.equal(backs(again), 16, 'sixteen cards face down again');
    assert.ok(!alike(again(110, 492), BUTTON), 'the button is gone');
    // The button's function returned a promise, as the cards' do; taps are still taken after it.
    await turn(5);
  }
);

await scenario(
  'story: a title menu, words that appear and are answered by key and by tap, a bar, notices and an ending',
  'story',
  480,
  300,
  async (page, stage) => {
    const CHOSEN = 0xfacc15,
      PANEL = 0x0b1020,
      LIT = 0xfacc15,
      HEALTH = 0xef4444;
    // The box of words is the panel's colour exactly; the night behind it is close to it.
    const boxOpen = look => alike(look(240, 260), PANEL, 3);
    // The title menu, with its first item chosen; the bar of health is full.
    await until(page, stage, look => alike(look(240, 139), CHOSEN), 'the title menu', 10);
    is((await stage.look())(130, 18), HEALTH, 'the bar full');
    await page.keyboard.press('Enter');
    // The keeper's words appear letter by letter: the end of the line is still covered, then shown by a press.
    await until(page, stage, look => boxOpen(look), 'the box of words', 10);
    await page.keyboard.press('Space');
    // The answers appear above the box; the second is chosen by a tap on it.
    await until(page, stage, look => alike(look(400, 136), CHOSEN), 'the answers', 10);
    await stage.tap(400, 168);
    // The reply; a key closes it and the yard is played.
    await page.waitForTimeout(800);
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
    await page.keyboard.press('Space');
    await until(page, stage, look => !boxOpen(look), 'the box closing', 10);
    const heard = await sounds(page);
    await page.keyboard.down('ArrowRight');
    await until(page, stage, look => alike(look(180, 230), LIT), 'the first lantern lit', 10);
    // The third lantern ends the yard: the ending's box of words opens over the ground.
    await until(page, stage, look => boxOpen(look), 'every lantern lit and the ending', 15);
    await page.keyboard.up('ArrowRight');
    assert.ok((await sounds(page)) > heard, 'the lanterns were heard');
    // Three falls of health: the bar is a quarter full.
    await page.waitForTimeout(600);
    const bar = await stage.look();
    is(bar(30, 18), HEALTH, 'the bar a quarter full');
    assert.ok(!alike(bar(130, 18), HEALTH), 'the rest of the bar is empty');
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
    await until(page, stage, look => alike(look(190, 156), CHOSEN), 'the last menu', 10);
    await stage.tap(190, 156);
    await until(
      page,
      stage,
      look => alike(look(240, 139), CHOSEN) && !alike(look(180, 230), LIT),
      'the yard again',
      10
    );
  }
);

await scenario(
  'story on a phone: the stick and the button on the glass walk the yard and answer, and the music plays',
  'story',
  480,
  300,
  async (page, stage) => {
    const CHOSEN = 0xfacc15,
      PANEL = 0x0b1020,
      LIT = 0xfacc15;
    const boxOpen = look => alike(look(240, 260), PANEL, 3);
    // Fingers through the browser's protocol: each touch has its own identifier, as on a phone.
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, points) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map(([x, y, id]) => {
          const [px, py] = stage.at(x, y);
          return { x: px, y: py, id };
        })
      });
    const tap = async (x, y) => {
      await touch('touchStart', [[x, y, 1]]);
      await page.waitForTimeout(60);
      await touch('touchEnd', []);
      await page.waitForTimeout(200);
    };
    await until(page, stage, look => alike(look(240, 139), CHOSEN), 'the title menu', 10);
    // The first touch shows the controls; the menu is taken by a tap on its first item.
    await tap(240, 139);
    await until(page, stage, boxOpen, 'the box of words', 10);
    // The button on the glass is Space: it shows the words, then the first answer is tapped.
    await tap(430, 230);
    await until(page, stage, look => alike(look(400, 136), CHOSEN), 'the answers', 10);
    await tap(400, 136);
    await page.waitForTimeout(800);
    await tap(430, 230);
    await page.waitForTimeout(300);
    await tap(430, 230);
    await until(page, stage, look => !boxOpen(look), 'the box closing', 10);
    // A finger holds the stick to the right, and a second finger presses the button meanwhile.
    await touch('touchStart', [[76, 224, 2]]);
    await touch('touchMove', [[120, 224, 2]]);
    await until(page, stage, look => alike(look(180, 230), LIT), 'the first lantern lit by the stick', 15);
    await touch('touchStart', [
      [120, 224, 2],
      [430, 230, 3]
    ]);
    await touch('touchEnd', [[120, 224, 2]]);
    await touch('touchMove', [[120, 224, 2]]);
    await until(page, stage, boxOpen, 'every lantern lit and the ending', 20);
    await touch('touchEnd', []);
    // Four parts of the music and the effects were started.
    assert.ok((await sounds(page)) >= 8, 'the music and the effects were heard: ' + (await sounds(page)));
  },
  { hasTouch: true, isMobile: true }
);

await scenario(
  'roll3d: the ball lands, rolls by key to a star, jumps, falls off the edge, and starts again',
  'roll3d',
  960,
  540,
  async (page, stage) => {
    // A picture of three dimensions is lit, so colours are read by which part of them is the largest.
    const parts = colour => [16, 8, 0].map(shift => (colour >> shift) & 255);
    const red = colour => {
      const [r, g, b] = parts(colour);
      return r > 120 && r > 1.6 * g && r > 1.6 * b;
    };
    const green = colour => {
      const [r, g, b] = parts(colour);
      return g > 60 && g > 1.2 * r && g > 1.1 * b;
    };
    // The camera follows the ball, which stays at the middle of the stage, with the ground about it.
    const ball = look => red(look(480, 270)) || red(look(480, 285)) || red(look(480, 255));
    await until(page, stage, look => ball(look) && green(look(480, 420)), 'the ball landing on the ground', 15);
    // A star is three units to the right: rolling there takes it, with a sound.
    const before = await sounds(page);
    await page.keyboard.down('ArrowRight');
    await until(page, stage, async () => (await sounds(page)) > before, 'the star being taken', 10);
    await page.keyboard.up('ArrowRight');
    const taken = await sounds(page);
    await page.keyboard.press('Space');
    await page.waitForTimeout(400);
    assert.ok((await sounds(page)) > taken, 'the jump was heard');
    // Rolling on to the right leaves the ground, twelve units from its middle, and the game ends with its button.
    await page.keyboard.down('ArrowRight');
    await until(page, stage, look => alike(look(410, 300), BUTTON), 'falling off the edge', 30);
    await page.keyboard.up('ArrowRight');
    await stage.tap(480, 300);
    await until(
      page,
      stage,
      look => !alike(look(410, 300), BUTTON) && ball(look) && green(look(480, 420)),
      'the game starting again',
      15
    );
  }
);

await scenario(
  'lanterns3d: a grouped lantern glows and lights the snow, falling snow moves, a shrine reached glows, and all three end it',
  'lanterns3d',
  960,
  540,
  async (page, stage) => {
    const parts = colour => [16, 8, 0].map(shift => (colour >> shift) & 255);
    // Warm light: red well over blue and bright. Snow: nearly white.
    const warm = colour => {
      const [r, g, b] = parts(colour);
      return r > 200 && g > 150 && r - b > 40;
    };
    const white = colour => parts(colour).every(part => part > 200);
    const count = (look, test, left, top, right, bottom, step = 4) => {
      let found = 0;
      for (let y = top; y < bottom; y += step) for (let x = left; x < right; x += step) if (test(look(x, y))) found++;
      return found;
    };
    // The lantern stands at the middle with its light above the post; the ground about it is lit warmer than far off.
    const lantern = look => count(look, warm, 440, 150, 520, 250, 2) > 6;
    const pool = look => {
      const [r, , b] = parts(look(480, 320)),
        [fr, , fb] = parts(look(480, 520));
      return r - b > fr - fb + 40;
    };
    await until(page, stage, look => lantern(look) && pool(look), 'the lantern glowing and lighting the ground', 15);
    // Flakes against the night sky, and not the same flakes a moment later.
    const sky = async () => {
      const look = await stage.look(),
        flakes = [];
      for (let y = 0; y < 80; y += 2) for (let x = 0; x < 960; x += 2) if (white(look(x, y))) flakes.push(x + ',' + y);
      return flakes;
    };
    const first = await sky();
    await page.waitForTimeout(700);
    const second = await sky();
    assert.ok(first.length > 20, 'snow in the sky: ' + first.length);
    assert.ok(second.filter(at => !first.includes(at)).length > 10, 'the snow falls');
    // Carried right and away, the lantern reaches the first shrine: it is heard, and its top glows gold, adding to the warm light already cast by the carried lantern.
    const gold = colour => {
      const [r, , b] = parts(colour);
      return r > 200 && r - b > 60;
    };
    const before = await sounds(page),
      goldBefore = count(await stage.look(), gold, 300, 100, 660, 450);
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('ArrowUp');
    await until(page, stage, async () => (await sounds(page)) > before, 'the first shrine being reached', 10);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(600);
    const goldAfter = count(await stage.look(), gold, 300, 100, 660, 450);
    // The carried lamp can already cast gold on the ground. Reaching the shrine adds its own lit area.
    assert.ok(goldAfter > goldBefore + 20, 'the shrine adds a lit area: ' + goldBefore + ' to ' + goldAfter);
    // The lantern is one thing: its glowing light is still over its post at the middle as the camera follows it.
    await until(page, stage, look => lantern(look), 'the lantern carried whole', 5);
    // The other two: one to the left and away, one between them further off.
    const hold = async (keys, label) => {
      const heard = await sounds(page);
      for (const key of keys) await page.keyboard.down(key);
      await until(page, stage, async () => (await sounds(page)) > heard, label, 12);
      for (const key of keys) await page.keyboard.up(key);
    };
    await hold(['ArrowLeft'], 'the second shrine being reached');
    await hold(['ArrowRight', 'ArrowUp'], 'the third shrine being reached');
    await until(page, stage, look => alike(look(410, 300), BUTTON), 'the night ending with its button', 10);
    await stage.tap(480, 300);
    await until(page, stage, look => !alike(look(410, 300), BUTTON) && lantern(look), 'the night starting again', 15);
  }
);

await scenario(
  "screen fit: 'expand' shows more of the stage on a wider window, the portrait size when it turns, and a tap reaches a button arranged in the safe part",
  'breakout',
  480,
  320,
  async (page, stage, row) => {
    row.screenFit = await verifyScreenFit(page);
  }
);

await scenario(
  'gestures: a double click, a long press, a drag that moves a card, a swipe, and a gem dragged onto a slot',
  'breakout',
  480,
  320,
  async (page, stage, row) => {
    row.gestures = await verifyGestures(page);
  }
);

await scenario(
  'views: a shop described as data, bound to the state, pressed by mouse and by name, a modal over it, and its portrait parts after a turn',
  'breakout',
  480,
  320,
  async (page, stage, row) => {
    // The colour of the page at a point, as 0xRRGGBB.
    const colourAt = async (x, y) => {
      const png = PNG.sync.read(
        await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } })
      );
      return (png.data[0] << 16) | (png.data[1] << 8) | png.data[2];
    };
    row.views = await verifyViews(page, colourAt);
  }
);

await scenario(
  'view parts: a red dot that adds up, a purchase sent once, questions one at a time, hints in the words of keys and of a finger, and loading that counts',
  'breakout',
  480,
  320,
  async (page, stage, row) => {
    const colourAt = async (x, y) => {
      const png = PNG.sync.read(
        await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y), width: 1, height: 1 } })
      );
      return (png.data[0] << 16) | (png.data[1] << 8) | png.data[2];
    };
    row.viewParts = await verifyViewParts(page, colourAt);
  },
  { hasTouch: true }
);

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  report.cases
    .map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : ''))
    .join('\n')
);
await browser.close();
server.close();
process.exit(process.exitCode ?? 0);
