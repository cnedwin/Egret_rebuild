// SPDX-License-Identifier: Apache-2.0
// Usage: node tools/verify-game.mjs <absolute Playwright index.mjs> <game.html> <new output directory>
// Runs one game page in a headless browser with software rendering and says whether it starts, draws, keeps drawing,
// answers input and makes sound. It is the check to run after writing or changing a game: it prints a report, writes
// it as report.json beside three pictures of the page, and exits with 1 when a check fails.
//
// It plays blind: it holds the arrows, W A S D and Space in turn, and clicks five places. A game that needs a
// particular move to change (a puzzle, a menu) can pass every other check and fail `reactsOrMoves`; look at the
// pictures. A page inside this checkout is served from its root, so that an import map to /packages works; any
// other page is served from its own folder, and asking for anything outside the server fails `noExternalRequests`.
// Frame rates under software rendering are far below a device's and are not a measure of the game.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg'
};
/** The colours of a picture in steps of sixteen, and the share of the commonest one. */
export function pictureStats(png) {
  const seen = new Map(),
    data = png.data;
  for (let i = 0; i < data.length; i += 4) {
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return { colors: seen.size, dominant: Math.max(...seen.values()) / (data.length / 4) };
}
/** The share of the pixels of two pictures of one size that differ by more than a rounding of colour. */
export function pictureChange(a, b) {
  if (a.width !== b.width || a.height !== b.height) return 1;
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if (
      Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2]) >
      36
    )
      changed++;
  return changed / (a.data.length / 4);
}
/** The checks of a run, from what was seen. Each has `pass` and what it was decided from. */
export function gameChecks(seen) {
  const errors = [
    ...(seen.loadError ? ['load: ' + seen.loadError] : []),
    ...seen.pageErrors.map(error => 'pageerror: ' + error),
    ...seen.rejections.map(error => 'unhandled rejection: ' + error),
    ...seen.consoleErrors.map(error => 'console.error: ' + error)
  ];
  const changed = Math.max(seen.changedAfterFirstInputs, seen.changedAtEnd, seen.changedMostDuringInput);
  return {
    noErrors: {
      pass: errors.length === 0 && seen.failedRequests.length === 0,
      errors,
      failedRequests: seen.failedRequests
    },
    noExternalRequests: { pass: seen.externalRequests.length === 0, externalRequests: seen.externalRequests },
    hasCanvas: { pass: seen.canvases.some(canvas => canvas.w > 0 && canvas.h > 0), canvases: seen.canvases },
    drawsSomething: {
      pass: seen.start.colors >= 3 && seen.start.dominant < 0.995,
      ...seen.start,
      note: 'colours are counted in steps of sixteen; dominant is the share of the commonest colour'
    },
    keepsRunning: {
      pass: seen.framesPerSecondIdle >= 2,
      framesPerSecondIdle: seen.framesPerSecondIdle,
      framesPerSecondPlaying: seen.framesPerSecondPlaying,
      note: 'software rendering: the check fails only when frames stop'
    },
    reactsOrMoves: {
      pass: changed > 0.004,
      changedAfterFirstInputs: seen.changedAfterFirstInputs,
      changedAtEnd: seen.changedAtEnd,
      changedMostDuringInput: seen.changedMostDuringInput
    },
    makesSound: { pass: seen.soundsStarted > 0, audioContexts: seen.audioContexts, soundsStarted: seen.soundsStarted }
  };
}

/** What a page is told to count before any of its scripts runs. */
function counters() {
  const verify = (window.__verify = { frames: 0, audioContexts: 0, soundsStarted: 0, rejections: [] });
  const frame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback =>
    frame(time => {
      verify.frames++;
      callback(time);
    });
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    verify.rejections.push(
      String((reason && (reason.code ? reason.code + ': ' : '') + (reason.stack || reason.message)) || reason).slice(
        0,
        900
      )
    );
  });
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const Real = window[name];
    if (!Real) continue;
    window[name] = class extends Real {
      constructor(...args) {
        super(...args);
        verify.audioContexts++;
      }
    };
  }
  // A buffer source has a start of its own; oscillators and constant sources share the one below them.
  for (const name of ['AudioScheduledSourceNode', 'AudioBufferSourceNode']) {
    const prototype = window[name]?.prototype;
    if (!prototype || !Object.prototype.hasOwnProperty.call(prototype, 'start')) continue;
    const start = prototype.start;
    prototype.start = function (...args) {
      verify.soundsStarted++;
      return start.apply(this, args);
    };
  }
}

/** Runs the page at `file` and gives the report. `chromium` is Playwright's; `PNG` is pngjs's. */
export async function verifyGame({ chromium, PNG, file, out }) {
  const inside = !path.relative(root, file).startsWith('..'),
    base = inside ? root : path.dirname(file);
  const server = http.createServer((request, response) => {
    const wanted = path.join(base, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (path.relative(base, wanted).startsWith('..') || !fs.existsSync(wanted) || fs.statSync(wanted).isDirectory()) {
      response.writeHead(404, { connection: 'close' });
      response.end();
      return;
    }
    response.writeHead(200, {
      'content-type': TYPES[path.extname(wanted)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      connection: 'close'
    });
    response.end(fs.readFileSync(wanted));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch({
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });
  try {
    const WIDTH = 960,
      HEIGHT = 640;
    const tab = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
    const seen = { consoleErrors: [], pageErrors: [], failedRequests: [], externalRequests: [] },
      consoleWarnings = [];
    tab.on('console', message => {
      const text = message.text();
      if (/GPU stall due to ReadPixels|GL Driver Message/.test(text)) return;
      if (message.type() === 'error') seen.consoleErrors.push(text.slice(0, 600));
      else if (message.type() === 'warning') consoleWarnings.push(text.slice(0, 300));
    });
    tab.on('pageerror', error => seen.pageErrors.push(String(error.stack || error.message).slice(0, 900)));
    tab.on('requestfailed', request =>
      seen.failedRequests.push(request.url() + ' ' + (request.failure()?.errorText ?? ''))
    );
    tab.on('response', response => {
      if (response.status() >= 400) seen.failedRequests.push(response.url() + ' ' + response.status());
    });
    // Nothing is reached but this server: a made-up file or a CDN shows as an external request.
    await tab.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      seen.externalRequests.push(url);
      return route.abort();
    });
    await tab.addInitScript(counters);
    const pictures = {};
    const picture = async name => {
      const target = path.join(out, name + '.png'),
        bytes = await tab.screenshot({ path: target });
      pictures[name] = { path: target, png: PNG.sync.read(bytes) };
    };
    const state = () =>
      tab.evaluate(() => ({
        ...window.__verify,
        canvases: [...document.querySelectorAll('canvas')].map(canvas => {
          const box = canvas.getBoundingClientRect();
          return {
            x: box.x,
            y: box.y,
            w: box.width,
            h: box.height,
            pixelWidth: canvas.width,
            pixelHeight: canvas.height
          };
        })
      }));
    try {
      await tab.goto(origin + path.relative(base, file).split(path.sep).join('/'), {
        waitUntil: 'load',
        timeout: 30000
      });
    } catch (error) {
      seen.loadError = String(error.message);
    }
    await tab.waitForTimeout(2500);
    await picture('1-start');
    const before = await state();
    await tab.waitForTimeout(1000);
    const idle = await state();
    seen.framesPerSecondIdle = idle.frames - before.frames;
    // Input is aimed at the largest canvas of the page.
    const canvas = idle.canvases.filter(one => one.w > 0 && one.h > 0).sort((p, q) => q.w * q.h - p.w * p.h)[0];
    const middleX = canvas ? canvas.x + canvas.w / 2 : WIDTH / 2,
      middleY = canvas ? canvas.y + canvas.h / 2 : HEIGHT / 2,
      spanX = canvas ? canvas.w : WIDTH,
      spanY = canvas ? canvas.h : HEIGHT;
    // Whatever waits for a first press is started; then a picture is kept after every input, because a hero that
    // walks right and back again has moved though it ends where it began.
    await tab.mouse.click(middleX, middleY);
    await tab.keyboard.press('Enter');
    await tab.keyboard.press('Space');
    await tab.waitForTimeout(400);
    const during = [];
    const sample = async () => during.push(PNG.sync.read(await tab.screenshot()));
    const play = async () => {
      for (const key of ['ArrowRight', 'ArrowUp', 'Space', 'ArrowLeft', 'KeyD', 'KeyW', 'Space', 'KeyA', 'ArrowDown']) {
        await tab.keyboard.down(key);
        await tab.waitForTimeout(220);
        await tab.keyboard.up(key);
        await sample();
      }
      for (const [x, y] of [
        [-0.3, -0.25],
        [0.3, -0.2],
        [0.25, 0.25],
        [-0.25, 0.3],
        [0, 0]
      ]) {
        await tab.mouse.move(middleX + x * spanX, middleY + y * spanY, { steps: 6 });
        await tab.mouse.down();
        await tab.waitForTimeout(60);
        await tab.mouse.up();
        await tab.waitForTimeout(120);
        await sample();
      }
    };
    await play();
    await picture('2-playing');
    const playing = await state(),
      from = Date.now();
    await play();
    const played = await state(),
      seconds = (Date.now() - from) / 1000;
    await tab.waitForTimeout(500);
    await picture('3-later');
    const end = await state();
    const first = pictures['1-start'].png;
    Object.assign(seen, {
      rejections: end.rejections,
      canvases: idle.canvases,
      start: pictureStats(first),
      framesPerSecondPlaying: Math.round(((played.frames - playing.frames) / seconds) * 10) / 10,
      changedAfterFirstInputs: pictureChange(first, pictures['2-playing'].png),
      changedAtEnd: pictureChange(first, pictures['3-later'].png),
      changedMostDuringInput: Math.max(0, ...during.map(one => pictureChange(first, one))),
      audioContexts: end.audioContexts,
      soundsStarted: end.soundsStarted
    });
    const checks = gameChecks(seen);
    return {
      file,
      pass: Object.values(checks).every(check => check.pass),
      checks,
      consoleWarnings: consoleWarnings.slice(0, 10),
      pictures: Object.fromEntries(Object.entries(pictures).map(([name, one]) => [name, one.path]))
    };
  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [playwright, page, output] = process.argv.slice(2);
  if (!playwright || !page || !output || !path.isAbsolute(playwright) || process.argv.length !== 5)
    throw new Error(
      'Usage: node tools/verify-game.mjs <absolute Playwright index.mjs> <game.html> <new output directory>'
    );
  const file = path.resolve(page),
    out = path.resolve(output);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('There is no page at ' + file);
  if (fs.existsSync(out)) throw new Error('The output directory must not exist yet: ' + out);
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = await import(pathToFileURL(playwright).href),
    { PNG } = createRequire(import.meta.url)('pngjs');
  const report = await verifyGame({ chromium, PNG, file, out });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}
