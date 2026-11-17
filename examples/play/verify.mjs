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

async function scenario(name, game, width, height, body) {
  const owned = await browser.newContext({ viewport: { width: 960, height: 640 } }),
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
    const BRICKS = [0xff4d6d, 0xffa64d, 0xffe14d, 0x7be069],
      PADDLE = 0x8fa8ff,
      brick = (look, r, c) => look(40 + c * 57, 40 + r * 20);
    const whole = look => BRICKS.every((colour, r) => [0, 3, 7].every(c => alike(brick(look, r, c), colour)));
    assert.ok(whole(await stage.look()), 'the bricks are drawn');
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
    assert.ok(whole(again) && !ended(again), 'the button started the game again with every brick');
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

fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(
  report.cases
    .map(row => (row.status === 'PASS' ? 'ok    ' : 'FAIL  ') + row.name + (row.failure ? '\n' + row.failure : ''))
    .join('\n')
);
await browser.close();
server.close();
process.exit(process.exitCode ?? 0);
