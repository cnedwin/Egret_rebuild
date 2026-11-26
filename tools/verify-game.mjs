// SPDX-License-Identifier: Apache-2.0
// Usage: node tools/verify-game.mjs <absolute Playwright index.mjs> <game.html> <new output directory> [play.mjs]
// Runs one game page in a headless browser with software rendering and says whether it starts, draws, keeps drawing,
// answers input and makes sound. It is the check to run after writing or changing a game: it prints a report, writes
// it as report.json beside three pictures of the page, and exits with 1 when a check fails.
//
// It plays blind: it holds the arrows, W A S D and Space in turn, clicks five places and drags twice. A game that needs a
// particular move to change (a puzzle, a menu) can pass every other check and fail `reactsOrMoves`; look at the
// pictures. A page inside this checkout is served from its root, so that an import map to /packages works; any
// other page is served from its own folder, and asking for anything outside the server fails `noExternalRequests`.
// Frame rates under software rendering are far below a device's and are not a measure of the game.
//
// Blind play does not reach the end of a game. A fourth argument names a script that plays it as a person would:
//
//   export const stage = { width: 480, height: 270 };       // the width and height given to `play`
//   export default async function (player) {
//     await player.key('right', 2);                            // hold a key for two seconds; player.key('space') presses it
//     await player.tap(240, 150);                              // in the stage's own units, as are move, press, release and drag
//     await player.drag(100, 100, 300, 100);                   // press, move over 0.3 seconds, and let go
//     await player.until(look => player.alike(look(240, 150), 0x3b82f6), 'the button to show', 20);
//     player.expect((await player.sounds()) > 0, 'a sound was made');
//     await player.picture('won');
//   }
//
// `look` gives the colour the page shows at a place of the stage. `player.until(test, label, seconds)` looks again
// about every 0.12 seconds of real time until `test(look)` is true, and fails after `seconds` (20 unless given).
// `player.read(fn)` runs a function in the page, for what a game keeps on `window`: `player.read(() => window.state.level)`.
// `player.warnings()` gives the engine's warnings so far (`{ code, message }`), which the report lists as `engineWarnings`:
// the page is given a `globalThis.__egretAgent` before it starts, which the engine tells of every warning, whether or not
// the game asked for them (a frame near its limit of images, a text made in every frame of update).
// The script runs on the page loaded afresh, with what blind play saved forgotten, after the blind checks; what it
// throws fails the check `played`.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
/** pngjs: installed beside this checkout, or, in a game's engine copy, the one copied under third-party/. */
export function loadPng() {
  const require = createRequire(import.meta.url);
  try {
    return require('pngjs');
  } catch {
    return require('../third-party/pngjs/lib/png.js');
  }
}
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
export const browserBuildTypes = Object.freeze({
  ...TYPES,
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.bin': 'application/octet-stream'
});
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
function observedChecks(seen) {
  const errors = [
    ...(seen.loadError ? ['load: ' + seen.loadError] : []),
    ...seen.pageErrors.map(error => 'pageerror: ' + error),
    ...seen.rejections.map(error => 'unhandled rejection: ' + error),
    ...seen.consoleErrors.map(error => 'console.error: ' + error)
  ];
  return {
    noErrors: {
      pass: errors.length === 0 && seen.failedRequests.length === 0,
      errors,
      failedRequests: seen.failedRequests
    },
    noExternalRequests: { pass: seen.externalRequests.length === 0, externalRequests: seen.externalRequests },
    hasCanvas: { pass: seen.canvases.some(canvas => canvas.w > 0 && canvas.h > 0), canvases: seen.canvases }
  };
}

/** The checks of a run, from what was seen. Each has `pass` and what it was decided from. */
export function gameChecks(seen) {
  const changed = Math.max(seen.changedAfterFirstInputs, seen.changedAtEnd, seen.changedMostDuringInput);
  return {
    ...observedChecks(seen),
    drawsSomething: {
      pass: seen.start.colors >= 3 && seen.start.dominant < 0.995,
      ...seen.start,
      note: 'colours are counted in steps of sixteen; dominant is the share of the commonest colour'
    },
    keepsRunning: {
      pass: seen.framesPerSecondIdle >= 2 && seen.framesPerSecondPlaying >= 2,
      framesPerSecondIdle: seen.framesPerSecondIdle,
      framesPerSecondPlaying: seen.framesPerSecondPlaying,
      note: 'software rendering: frames must keep advancing while idle and during input'
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
  const verify = (window.__verify = {
    frames: 0,
    audioContexts: 0,
    soundsStarted: 0,
    rejections: [],
    engineWarnings: []
  });
  // The engine tells this of every warning of the game; the report lists the first fifty.
  window.__egretAgent = Object.freeze({
    warning(warning) {
      if (verify.engineWarnings.length < 50)
        verify.engineWarnings.push({
          code: String(warning?.code),
          message: String(warning?.message ?? '').slice(0, 300)
        });
    }
  });
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

/** Whether two colours, each `0xRRGGBB`, are the same but for `tolerance` in each part. */
export function coloursAlike(a, b, tolerance = 12) {
  return [16, 8, 0].every(shift => Math.abs(((a >> shift) & 255) - ((b >> shift) & 255)) <= tolerance);
}
const KEYS = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  space: 'Space',
  enter: 'Enter',
  escape: 'Escape',
  shift: 'ShiftLeft'
};
/** The key Playwright is asked for, from the name a game asks its keys by. */
export function keyOf(name) {
  const key = String(name);
  if (KEYS[key.toLowerCase()] !== undefined) return KEYS[key.toLowerCase()];
  if (/^[a-z]$/i.test(key)) return 'Key' + key.toUpperCase();
  if (/^[0-9]$/.test(key)) return 'Digit' + key;
  return key;
}
/** Where a place of a stage of `width` by `height` is on a page whose canvas has the box given. */
export function stagePlace(box, width, height, x, y) {
  return [box.x + (x * box.w) / width, box.y + (y * box.h) / height];
}
/** What a script is given to play a game with: input in the stage's own units, and the page read from its pictures. */
function driver(tab, PNG, out, size) {
  const box = async () => {
    const canvases = await tab.evaluate(() =>
      [...document.querySelectorAll('canvas')].map(canvas => {
        const bounds = canvas.getBoundingClientRect();
        return { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height };
      })
    );
    const largest = canvases.filter(one => one.w > 0 && one.h > 0).sort((p, q) => q.w * q.h - p.w * p.h)[0];
    if (largest === undefined) throw new Error('The page has no canvas to play on');
    return largest;
  };
  const at = async (x, y) => {
    const canvas = await box();
    return stagePlace(canvas, size?.width ?? canvas.w, size?.height ?? canvas.h, x, y);
  };
  const game = {
    page: tab,
    alike: coloursAlike,
    wait: seconds => tab.waitForTimeout(seconds * 1000),
    move: async (x, y) => tab.mouse.move(...(await at(x, y))),
    async press(x, y) {
      await tab.mouse.move(...(await at(x, y)));
      await tab.mouse.down();
    },
    release: () => tab.mouse.up(),
    async tap(x, y) {
      await game.press(x, y);
      await tab.waitForTimeout(60);
      await tab.mouse.up();
    },
    /** Presses at one place, moves to another over `seconds` and lets go there, as a finger or a mouse drags. */
    async drag(x0, y0, x1, y1, seconds = 0.3) {
      await game.press(x0, y0);
      const steps = Math.max(2, Math.round(seconds * 30));
      for (let i = 1; i <= steps; i++) {
        await tab.mouse.move(...(await at(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps)));
        await tab.waitForTimeout((seconds * 1000) / steps);
      }
      await tab.mouse.up();
    },
    async key(name, seconds = 0) {
      await tab.keyboard.down(keyOf(name));
      await tab.waitForTimeout(Math.max(40, seconds * 1000));
      await tab.keyboard.up(keyOf(name));
    },
    hold: name => tab.keyboard.down(keyOf(name)),
    letGo: name => tab.keyboard.up(keyOf(name)),
    async look() {
      const canvas = await box(),
        png = PNG.sync.read(await tab.screenshot());
      return (x, y) => {
        const [px, py] = stagePlace(canvas, size?.width ?? canvas.w, size?.height ?? canvas.h, x, y),
          o = 4 * (Math.round(py) * png.width + Math.round(px));
        return (png.data[o] << 16) | (png.data[o + 1] << 8) | png.data[o + 2];
      };
    },
    async until(test, label = 'what was waited for', seconds = 20) {
      for (const end = Date.now() + seconds * 1000; Date.now() < end; ) {
        const result = await test(await game.look());
        if (result) return result;
        await tab.waitForTimeout(120);
      }
      throw new Error(label + ' did not happen in ' + seconds + ' seconds');
    },
    sounds: () => tab.evaluate(() => window.__verify.soundsStarted),
    warnings: () => tab.evaluate(() => window.__verify.engineWarnings ?? []),
    /** Runs a function in the page and gives what it returns: `player.read(() => window.state.collected)`. */
    read: (fn, ...args) => tab.evaluate(fn, ...args),
    expect(condition, message) {
      if (!condition) throw new Error('Expected: ' + message);
    },
    async picture(name) {
      const target = path.join(out, 'played-' + String(name).replace(/[^A-Za-z0-9_-]+/g, '-') + '.png');
      await tab.screenshot({ path: target });
      return target;
    }
  };
  return game;
}

function recordScriptFailure(played, error, fallbackCode) {
  const message = String(error?.message ?? error).slice(0, 1200);
  const code = typeof error?.code === 'string' && error.code ? error.code : fallbackCode;
  played.error = String(error?.stack ?? error).slice(0, 1200);
  played.diagnostic = { code, message };
  if (error?.details !== undefined) {
    try {
      played.diagnostic.details = JSON.parse(JSON.stringify(error.details));
    } catch {
      // A script diagnostic must survive writing the report even when details are not JSON data.
    }
  }
}

function playReport(file, checks, warnings = [], pictures = {}, engineWarnings = []) {
  return {
    file,
    pass: Object.values(checks).every(check => check.pass),
    checks,
    consoleWarnings: warnings.slice(0, 10),
    // Told by the engine (see the head of this file); they do not decide the pass, and each names an engine code.
    engineWarnings,
    pictures: Object.fromEntries(Object.entries(pictures).map(([name, one]) => [name, one.path]))
  };
}

/**
 * Runs the page at `file` and gives the report. `chromium` is Playwright's; `PNG` is pngjs's. `script`, where given,
 * is the module of a script that plays the game: its default export, and the `stage` it names. `scriptOnly` serves the
 * staged build from the page's own directory and plays only the supplied script. Pass `filePaths` in this mode to
 * serve only those logical paths, relative to that directory and separated by forward slashes. A script may record
 * completed steps with `player.checkpoint(name)` and attach a string `code` and JSON `details` to errors.
 * A script-only module can export `viewport` to reproduce a particular browser layout independently of stage units.
 */
export async function verifyGame({ chromium, PNG, file, out, script, scriptOnly = false, filePaths }) {
  if (scriptOnly && typeof script?.default !== 'function') throw new Error('scriptOnly requires a play script');
  const inside = !path.relative(root, file).startsWith('..'),
    base = inside && !scriptOnly ? root : path.dirname(file);
  const physicalBase = scriptOnly ? fs.realpathSync(base) : base;
  const allowedFiles = scriptOnly && filePaths !== undefined ? new Set(filePaths) : null;
  const server = http.createServer((request, response) => {
    let wanted, content;
    try {
      wanted = path.join(base, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
      const relative = path.relative(base, wanted);
      if (
        relative.startsWith('..') ||
        path.isAbsolute(relative) ||
        (allowedFiles && !allowedFiles.has(relative.split(path.sep).join('/'))) ||
        !fs.statSync(wanted).isFile()
      )
        throw new Error('Not a file within the serving directory');
      if (scriptOnly) {
        const physical = path.relative(physicalBase, fs.realpathSync(wanted));
        if (physical.startsWith('..') || path.isAbsolute(physical)) throw new Error('File leaves the staged build');
      }
      content = fs.readFileSync(wanted);
    } catch {
      response.writeHead(404, { connection: 'close' });
      response.end();
      return;
    }
    response.writeHead(200, {
      'content-type': (scriptOnly ? browserBuildTypes : TYPES)[path.extname(wanted)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      connection: 'close'
    });
    response.end(content);
  });
  let browser;
  try {
    // Bind before launching, but release the socket even if Chromium is missing or cannot start.
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
    const origin = 'http://127.0.0.1:' + server.address().port + '/';
    browser = await chromium.launch({
      args: [
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--autoplay-policy=no-user-gesture-required'
      ]
    });
    const viewport = scriptOnly && script.viewport ? script.viewport : { width: 960, height: 640 };
    const { width: WIDTH, height: HEIGHT } = viewport;
    if (![WIDTH, HEIGHT].every(size => Number.isInteger(size) && size > 0 && size <= 8192)) {
      throw new TypeError('Script viewport dimensions must be positive integers up to 8192.');
    }
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
    const address = origin + path.relative(base, file).split(path.sep).join('/');
    const runScript = async (prepare, fallbackCode) => {
      const before = [seen.pageErrors.length, seen.consoleErrors.length];
      const played = { pass: false, pictures: [] };
      if (scriptOnly) played.checkpoints = [];
      try {
        await prepare();
        const game = driver(tab, PNG, out, script.stage),
          keep = game.picture;
        game.picture = async name => {
          const target = await keep(name);
          played.pictures.push(target);
          return target;
        };
        game.checkpoint = name => {
          if (typeof name !== 'string' || !name.trim()) throw new TypeError('A checkpoint needs a non-empty name');
          (played.checkpoints ??= []).push(name);
        };
        let rejections;
        try {
          await script.default(game);
          rejections = await tab.evaluate(() => window.__verify?.rejections ?? []);
        } catch (error) {
          seen.rejections.push(...(await tab.evaluate(() => window.__verify?.rejections ?? []).catch(() => [])));
          throw error;
        }
        seen.rejections.push(...rejections);
        const errors = [...seen.pageErrors.slice(before[0]), ...seen.consoleErrors.slice(before[1]), ...rejections];
        if (errors.length > 0) throw new Error('The page failed while it was played: ' + errors[0]);
        played.pass = true;
      } catch (error) {
        recordScriptFailure(played, error, fallbackCode());
        await tab.screenshot({ path: path.join(out, 'played-failed.png') }).catch(() => {});
      }
      return played;
    };
    if (scriptOnly) {
      seen.rejections = [];
      let navigated = false;
      const played = await runScript(
        async () => {
          await tab.goto(address, { waitUntil: 'load', timeout: 30000 });
          navigated = true;
        },
        () => (navigated ? 'VERIFY_GAME_SCRIPT' : 'VERIFY_GAME_STARTUP')
      );
      if (!navigated) seen.loadError = played.diagnostic.message;
      seen.canvases = (await state().catch(() => null))?.canvases ?? [];
      return playReport(file, { ...observedChecks(seen), played }, consoleWarnings);
    }
    try {
      await tab.goto(address, { waitUntil: 'load', timeout: 30000 });
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
      // Two drags across the middle, for a game that is played by dragging.
      for (const [x0, y0, x1, y1] of [
        [-0.3, 0, 0.3, 0],
        [0, -0.3, 0, 0.3]
      ]) {
        await tab.mouse.move(middleX + x0 * spanX, middleY + y0 * spanY);
        await tab.mouse.down();
        await tab.mouse.move(middleX + x1 * spanX, middleY + y1 * spanY, { steps: 12 });
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
      soundsStarted: end.soundsStarted,
      engineWarnings: end.engineWarnings ?? []
    });
    let scripted;
    if (script !== undefined) {
      // The game is played from its start: the page is loaded again, and what goes wrong from here is the script's.
      scripted = await runScript(
        async () => {
          // What blind play saved (a level reached, a high score) is forgotten, so the script starts a new game.
          await tab
            .evaluate(async () => {
              try {
                localStorage.clear();
                sessionStorage.clear();
                for (const { name } of (await indexedDB.databases?.()) ?? []) if (name) indexedDB.deleteDatabase(name);
              } catch {
                /* A page without storage has nothing to forget. */
              }
            })
            .catch(() => {});
          await tab.goto(address, { waitUntil: 'load', timeout: 30000 });
          await tab.waitForTimeout(1500);
        },
        () => 'VERIFY_GAME_SCRIPT'
      );
    }
    // Network and error observers stay active through scripted play; decide every flag from their final values.
    const checks = gameChecks(seen);
    if (scripted !== undefined) checks.played = scripted;
    const engineWarnings = (await state().catch(() => end))?.engineWarnings ?? seen.engineWarnings;
    return playReport(file, checks, consoleWarnings, pictures, engineWarnings);
  } catch (error) {
    if (!scriptOnly) throw error;
    const played = { pass: false, pictures: [], checkpoints: [] };
    recordScriptFailure(played, error, 'VERIFY_GAME_STARTUP');
    return playReport(file, { played });
  } finally {
    try {
      await browser?.close();
    } finally {
      if (server.listening) await new Promise(resolve => server.close(resolve));
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [playwright, page, output, play] = process.argv.slice(2);
  if (!playwright || !page || !output || !path.isAbsolute(playwright) || process.argv.length > 6)
    throw new Error(
      'Usage: node tools/verify-game.mjs <absolute Playwright index.mjs> <game.html> <new output directory> [play.mjs]'
    );
  if (play !== undefined && !fs.existsSync(path.resolve(play)))
    throw new Error('There is no script at ' + path.resolve(play));
  const file = path.resolve(page),
    out = path.resolve(output);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('There is no page at ' + file);
  if (fs.existsSync(out)) throw new Error('The output directory must not exist yet: ' + out);
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = await import(pathToFileURL(playwright).href),
    { PNG } = loadPng();
  const script = play === undefined ? undefined : await import(pathToFileURL(path.resolve(play)).href);
  if (script !== undefined && typeof script.default !== 'function')
    throw new Error('The script has no default export to play the game with: ' + path.resolve(play));
  const report = await verifyGame({ chromium, PNG, file, out, script });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}
