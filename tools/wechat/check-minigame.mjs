#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Usage: node tools/wechat/check-minigame.mjs <absolute Playwright index.mjs> <mini game folder> <picture.png>
//          [--size 390x844] [--ratio 2] [--wait 8] [--tap x,y ...] [--then-wait 3]
//
// Runs a mini game folder (as tools/wechat/export-wechat.mjs writes it) in a headless browser with a stand-in for wx,
// takes a picture of its screen and reports what it said. The stand-in gives the game what a WeChat mini game gives
// and nothing more: GameGlobal holds wx, the console, timers and requestAnimationFrame; wx.createCanvas gives the
// screen canvas first and canvases off the screen after; files are read from the folder; storage is kept in memory;
// touches come from the mouse. game.js runs as a plain script, as WeChat runs it. A game that reaches for anything a
// page has and a mini game lacks fails here as it would on a phone.
//
// It is not WeChat: WeChat's own JavaScript engine, its WebGL and its limits on a phone are only met on a phone or in
// WeChat DevTools. What passes here has met the shape of the mini game API, not every device.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg'
};

/**
 * Names a page has and a phone's mini game lacks, taken off the page before game.js runs: a game that reaches for one
 * past the export (which binds them to nothing inside the game) fails here as on a phone.
 */
export const HIDDEN_NAMES = Object.freeze([
  'WebAssembly',
  'CanvasRenderingContext2D',
  'OffscreenCanvasRenderingContext2D',
  'TextMetrics',
  'FontFace',
  'FontFaceSet',
  'CSS'
]);

/** The subpackages of a mini game folder, as its game.json names them: `{ name, root }` with `root` ending in `/`. */
export function folderSubpackages(folder) {
  const file = path.join(folder, 'game.json');
  if (!fs.existsSync(file)) return [];
  const list = JSON.parse(fs.readFileSync(file, 'utf8')).subpackages;
  return Array.isArray(list) ? list.map(part => ({ name: String(part.name), root: String(part.root) })) : [];
}

/** The stand-in for WeChat's mini game host, as a script for the page. */
export function standInScript({ width, height, ratio, subpackages = [] }) {
  return `
(function () {
  'use strict';
  var real = { fetch: window.fetch.bind(window), Image: window.Image, AudioContext: window.AudioContext || window.webkitAudioContext, now: performance.now.bind(performance) };
  var screen = document.getElementById('screen');
  var made = 0, storage = new Map(), handlers = {}, written = new Map(), USER = 'wxfile://usr';
  var on = function (name) { return function (fn) { (handlers[name] = handlers[name] || []).push(fn); }; };
  var off = function (name) { return function (fn) { handlers[name] = (handlers[name] || []).filter(function (f) { return f !== fn; }); }; };
  // The keyboard WeChat shows with its own field, while it is up.
  var keyboard;
  var emit = function (name, value) { (handlers[name] || []).forEach(function (fn) { fn(value); }); };
  // Subpackages: their files are not in the package until wx.loadSubpackage has downloaded them.
  var parts = ${JSON.stringify(subpackages)}, loaded = new Set();
  var waiting = function (p) {
    var rel = String(p).replace(/^\\/+/, '');
    for (var i = 0; i < parts.length; i++) if (rel.indexOf(parts[i].root) === 0 && !loaded.has(parts[i].name)) return parts[i].name;
    return undefined;
  };
  var pkg = function (p) { var part = waiting(p); return part === undefined ? '/pkg/' + String(p).replace(/^\\/+/, '') : '/not-downloaded/' + part + '/' + String(p).replace(/^\\/+/, ''); };
  var calls = {};
  var count = function (name) { calls[name] = (calls[name] || 0) + 1; };
  var wx = {
    getSystemInfoSync: function () { count('getSystemInfoSync'); return { windowWidth: ${width}, windowHeight: ${height}, screenWidth: ${width}, screenHeight: ${height}, pixelRatio: ${ratio}, language: 'zh_CN', platform: 'devtools', SDKVersion: '3.6.0', theme: 'light' }; },
    env: { USER_DATA_PATH: USER },
    getLaunchOptionsSync: function () { return { query: {}, scene: 1001 }; },
    createCanvas: function () { count('createCanvas'); return made++ === 0 ? screen : document.createElement('canvas'); },
    createImage: function () {
      count('createImage');
      var image = new real.Image(), set = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      Object.defineProperty(image, 'src', { get: function () { return set.get.call(image); }, set: function (v) { set.set.call(image, written.has(v) ? written.get(v) : /^(data:|https?:)/.test(v) ? v : pkg(v)); } });
      return image;
    },
    getFileSystemManager: function () {
      return {
        readFile: function (o) {
          count('readFile');
          var part = waiting(o.filePath);
          if (part !== undefined) { setTimeout(function () { o.fail && o.fail({ errMsg: 'readFile:fail ' + o.filePath + ' is in subpackage ' + part + ', not yet loaded' }); }, 0); return; }
          real.fetch(pkg(o.filePath)).then(function (r) {
            if (!r.ok) throw new Error('readFile:fail no such file ' + o.filePath);
            return o.encoding ? r.text() : r.arrayBuffer();
          }).then(function (data) { o.success && o.success({ data: data }); }, function (e) { o.fail && o.fail({ errMsg: String(e.message || e) }); });
        },
        readFileSync: function () { throw new Error('readFileSync is not used by the adapter'); },
        // Files of the game's own, under wx.env.USER_DATA_PATH, kept as addresses of the page's blobs.
        writeFile: function (o) {
          count('writeFile');
          if (String(o.filePath).indexOf(USER + '/') !== 0) { o.fail && o.fail({ errMsg: 'writeFile:fail permission denied' }); return; }
          if (written.has(o.filePath)) URL.revokeObjectURL(written.get(o.filePath));
          written.set(o.filePath, URL.createObjectURL(new Blob([o.data])));
          setTimeout(function () { o.success && o.success({}); }, 0);
        }
      };
    },
    getStorageSync: function (k) { return storage.has(k) ? storage.get(k) : ''; },
    setStorageSync: function (k, v) { count('setStorageSync'); storage.set(k, v); },
    removeStorageSync: function (k) { storage.delete(k); },
    getStorageInfoSync: function () { return { keys: Array.from(storage.keys()), currentSize: 0, limitSize: 10240 }; },
    request: function (o) { real.fetch(o.url).then(function (r) { return r.arrayBuffer().then(function (d) { o.success && o.success({ statusCode: r.status, data: d }); }); }, function (e) { o.fail && o.fail({ errMsg: String(e) }); }); },
    getPerformance: function () { return { now: function () { return real.now() * 1000; } }; },
    createWebAudioContext: function () { count('createWebAudioContext'); return new real.AudioContext(); },
    onTouchStart: on('touchstart'), onTouchMove: on('touchmove'), onTouchEnd: on('touchend'), onTouchCancel: on('touchcancel'),
    onKeyDown: on('keydown'), onKeyUp: on('keyup'), onWindowResize: on('resize'), onShow: on('show'), onHide: on('hide'), onError: on('error'),
    // The keyboard: shown with a value, a limit and a kind of confirm key; it tells of input, of its confirm key and of
    // being closed. window.__keyboard types, confirms and closes it, as a player would.
    showKeyboard: function (o) {
      count('showKeyboard');
      keyboard = { value: String(o.defaultValue || ''), maxLength: o.maxLength === undefined ? 100 : o.maxLength, multiple: !!o.multiple, confirmHold: !!o.confirmHold, confirmType: o.confirmType || 'done' };
      setTimeout(function () { o.success && o.success({}); }, 0);
    },
    hideKeyboard: function (o) {
      count('hideKeyboard');
      var was = keyboard;
      keyboard = undefined;
      // A keyboard closed by the game is told as closed after the call returns.
      if (was) setTimeout(function () { emit('keyboardcomplete', { value: was.value }); }, 0);
      setTimeout(function () { o && o.success && o.success({}); }, 0);
    },
    updateKeyboard: function (o) { count('updateKeyboard'); if (keyboard) keyboard.value = String(o.value); },
    onKeyboardInput: on('keyboardinput'), offKeyboardInput: off('keyboardinput'),
    onKeyboardConfirm: on('keyboardconfirm'), offKeyboardConfirm: off('keyboardconfirm'),
    onKeyboardComplete: on('keyboardcomplete'), offKeyboardComplete: off('keyboardcomplete'),
    // A subpackage named in game.json: told of its progress, then its entry script runs and its files are there.
    loadSubpackage: function (o) {
      count('loadSubpackage');
      var progress = [], part = parts.filter(function (p) { return p.name === o.name; })[0];
      var task = { onProgressUpdate: function (fn) { progress.push(fn); } };
      setTimeout(function () {
        if (!part) { o.fail && o.fail({ errMsg: 'loadSubpackage:fail no subpackage named ' + o.name }); o.complete && o.complete(); return; }
        [50, 100].forEach(function (p, i) { setTimeout(function () { progress.forEach(function (fn) { fn({ progress: p, totalBytesWritten: p, totalBytesExpectedToWrite: 100 }); }); }, i * 10); });
        setTimeout(function () {
          loaded.add(part.name);
          real.fetch('/pkg/' + part.root + 'game.js').then(function (r) { return r.ok ? r.text() : ''; }).then(function (code) {
            (0, eval)(code);
            o.success && o.success({});
            o.complete && o.complete();
          }, function (e) { o.fail && o.fail({ errMsg: 'loadSubpackage:fail ' + e }); o.complete && o.complete(); });
        }, 30);
      }, 0);
      return task;
    },
    vibrateShort: function () {}, showModal: function (o) { console.log('[wx.showModal] ' + o.content); },
    restartMiniProgram: function () {}
  };
  // The mouse as one finger.
  var touching = false;
  var touch = function (e) { var r = screen.getBoundingClientRect(); return { identifier: 0, clientX: e.clientX - r.left, clientY: e.clientY - r.top }; };
  screen.addEventListener('mousedown', function (e) { touching = true; var t = touch(e); emit('touchstart', { touches: [t], changedTouches: [t] }); });
  window.addEventListener('mousemove', function (e) { if (!touching) return; var t = touch(e); emit('touchmove', { touches: [t], changedTouches: [t] }); });
  window.addEventListener('mouseup', function (e) { if (!touching) return; touching = false; var t = touch(e); emit('touchend', { touches: [], changedTouches: [t] }); });
  window.addEventListener('keydown', function (e) { emit('keydown', { key: e.key, code: e.code }); });
  window.addEventListener('keyup', function (e) { emit('keyup', { key: e.key, code: e.code }); });
  // What a phone's mini game lacks, off the page.
  ${JSON.stringify(HIDDEN_NAMES)}.forEach(function (name) {
    try { delete window[name]; } catch (e) {}
    if (name in window) try { Object.defineProperty(window, name, { value: undefined, configurable: true }); } catch (e) {}
  });
  // GameGlobal: what a mini game's global holds, and no more.
  var G = Object.create(null);
  Object.assign(G, {
    wx: wx, console: console,
    setTimeout: setTimeout.bind(window), clearTimeout: clearTimeout.bind(window),
    setInterval: setInterval.bind(window), clearInterval: clearInterval.bind(window),
    requestAnimationFrame: requestAnimationFrame.bind(window), cancelAnimationFrame: cancelAnimationFrame.bind(window)
  });
  G.GameGlobal = G;
  G.__egretFailed = function (e) { window.__failed = String(e && e.stack || e); };
  window.GameGlobal = G;
  // A mini game's script names wx as a global as well as GameGlobal.wx.
  window.wx = wx;
  window.__wxCalls = calls;
  window.__keyboard = {
    state: function () { return keyboard ? JSON.parse(JSON.stringify(keyboard)) : null; },
    type: function (text) {
      if (!keyboard) throw new Error('no keyboard is shown');
      var points = Array.from(keyboard.value + text);
      keyboard.value = points.slice(0, keyboard.maxLength).join('');
      emit('keyboardinput', { value: keyboard.value });
    },
    confirm: function () {
      if (!keyboard) throw new Error('no keyboard is shown');
      var was = keyboard;
      emit('keyboardconfirm', { value: was.value });
      if (!was.confirmHold && keyboard === was) { keyboard = undefined; emit('keyboardcomplete', { value: was.value }); }
    },
    close: function () {
      if (!keyboard) throw new Error('no keyboard is shown');
      var was = keyboard;
      keyboard = undefined;
      emit('keyboardcomplete', { value: was.value });
    }
  };
  window.__storage = storage;
})();
`;
}

export function standInPage({ width, height, ratio, subpackages = [] }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}
#screen{display:block;width:${width}px;height:${height}px}</style></head><body>
<canvas id="screen" width="${width * ratio}" height="${height * ratio}"></canvas>
<script>${standInScript({ width, height, ratio, subpackages })}</script>
<script>
// game.js reads GameGlobal; a free name in it such as document would still find the page's, so it is checked too.
window.addEventListener('error', function (e) { (window.__errors = window.__errors || []).push(String(e.message)); });
window.__baseline = document.querySelectorAll('*').length;
</script>
<script src="/pkg/game.js"></script>
</body></html>`;
}

export async function checkMinigame({
  chromium,
  PNG,
  folder,
  out,
  width = 390,
  height = 844,
  ratio = 2,
  wait = 8,
  taps = [],
  thenWait = 3
}) {
  const server = http.createServer((request, response) => {
    const url = decodeURIComponent(new URL(request.url, 'http://x').pathname);
    if (url === '/') {
      response.writeHead(200, { 'content-type': TYPES['.html'] });
      response.end(standInPage({ width, height, ratio, subpackages: folderSubpackages(folder) }));
      return;
    }
    const file = path.resolve(folder, url.replace(/^\/pkg\//, ''));
    if (
      !url.startsWith('/pkg/') ||
      !file.startsWith(path.resolve(folder)) ||
      !fs.existsSync(file) ||
      fs.statSync(file).isDirectory()
    ) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    const logs = [];
    page.on('console', message => logs.push(message.type() + ': ' + message.text().slice(0, 500)));
    page.on('pageerror', error => logs.push('pageerror: ' + error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForTimeout(wait * 1000);
    for (const [x, y] of taps) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(800);
    }
    if (taps.length) await page.waitForTimeout(thenWait * 1000);
    const shot = await page.locator('#screen').screenshot();
    fs.writeFileSync(out, shot);
    const picture = PNG.sync.read(shot);
    const colours = new Set();
    for (let i = 0; i < picture.data.length; i += 64)
      colours.add((picture.data[i] >> 4) * 256 + (picture.data[i + 1] >> 4) * 16 + (picture.data[i + 2] >> 4));
    const state = await page.evaluate(() => ({
      failed: window.__failed ?? null,
      errors: window.__errors ?? [],
      calls: window.__wxCalls,
      storageKeys: Array.from(window.__storage.keys()),
      // Elements a game made on the real page would be a leak past the adapter: the page holds only the screen.
      pageElements: document.querySelectorAll('*').length - window.__baseline - 1,
      game:
        typeof GameGlobal.egretGame === 'object'
          ? { screen: GameGlobal.egretGame.screen, ready: GameGlobal.egretGame.ready }
          : null
    }));
    const errors = logs.filter(line => /^(error|pageerror)/.test(line));
    return {
      ...state,
      colours: colours.size,
      picture: out,
      errors: [...state.errors, ...errors],
      logs,
      ok:
        !state.failed &&
        errors.length === 0 &&
        state.errors.length === 0 &&
        colours.size > 8 &&
        state.pageElements === 0
    };
  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const [playwright, folder, out] = args.filter(
    (a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))
  );
  if (!playwright || !folder || !out)
    throw new Error(
      'Usage: node tools/wechat/check-minigame.mjs <absolute Playwright index.mjs> <mini game folder> <picture.png> [--size 390x844] [--ratio 2] [--wait 8] [--tap x,y ...]'
    );
  const option = name => {
    const i = args.indexOf('--' + name);
    return i < 0 ? undefined : args[i + 1];
  };
  const [width, height] = (option('size') ?? '390x844').split('x').map(Number);
  const taps = [];
  args.forEach((a, i) => {
    if (a === '--tap') taps.push(args[i + 1].split(',').map(Number));
  });
  const { chromium } = await import(pathToFileURL(playwright).href),
    { PNG } = createRequire(import.meta.url)('pngjs');
  const report = await checkMinigame({
    chromium,
    PNG,
    folder: path.resolve(folder),
    out: path.resolve(out),
    width,
    height,
    ratio: Number(option('ratio') ?? 2),
    wait: Number(option('wait') ?? 8),
    taps,
    thenWait: Number(option('then-wait') ?? 3)
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
