// SPDX-License-Identifier: Apache-2.0
// The WeChat mini game export: the adapter run in a context that holds only what a mini game's global holds (wx, the
// console, timers and frames), and the export of a small game folder. A real phone's WeChat is not run here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  PAGE_NAMES,
  assetFiles,
  exportWechat,
  gameScript,
  readImportMap,
  readPageSkeleton
} from '../tools/wechat/export-wechat.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ADAPTER = fs.readFileSync(path.join(ROOT, 'tools', 'wechat', 'adapter.js'), 'utf8');

/** A WebGL2 context that answers every call and keeps the ones the backdrop's checks read. */
function fakeGl(canvas) {
  const calls = [],
    constants = new Map();
  const state = { blend: false, drawFramebuffer: null, program: 'game-program' };
  const constant = name => {
    if (!constants.has(name)) constants.set(name, 0x1000 + constants.size);
    return constants.get(name);
  };
  const methods = {
    canvas,
    drawingBufferWidth: 4,
    drawingBufferHeight: 8,
    isContextLost: () => false,
    getParameter(p) {
      if (p === constant('VIEWPORT')) return [0, 0, 4, 8];
      if (p === constant('COLOR_WRITEMASK')) return [true, true, true, true];
      if (p === constant('DRAW_FRAMEBUFFER_BINDING')) return state.drawFramebuffer;
      if (p === constant('CURRENT_PROGRAM')) return state.program;
      return null;
    },
    isEnabled: p => (p === constant('BLEND') ? state.blend : false),
    useProgram(program) {
      state.program = program;
      calls.push(['useProgram', program]);
    },
    enable(p) {
      if (p === constant('BLEND')) state.blend = true;
      calls.push(['enable', p]);
    },
    disable(p) {
      if (p === constant('BLEND')) state.blend = false;
      calls.push(['disable', p]);
    },
    bindFramebuffer(target, framebuffer) {
      state.drawFramebuffer = framebuffer;
      calls.push(['bindFramebuffer', framebuffer]);
    }
  };
  const gl = new Proxy(methods, {
    get(target, name) {
      if (name in target) return target[name];
      if (typeof name === 'string' && /^[A-Z][A-Z0-9_]+$/.test(name)) return constant(name);
      if (typeof name !== 'string' || name.startsWith('_')) return undefined;
      return (target[name] = (...args) => {
        calls.push([name, ...args]);
        return /^create/.test(name) ? { made: name } : null;
      });
    },
    set(target, name, value) {
      target[name] = value;
      return true;
    }
  });
  return { gl, calls, constant, state };
}

/** A 2D context that records what is painted on it. */
function fake2d() {
  const calls = [];
  return {
    calls,
    context: new Proxy(
      {},
      {
        get(target, name) {
          if (name in target) return target[name];
          if (typeof name !== 'string' || name.startsWith('_')) return undefined;
          if (name === 'createLinearGradient')
            return (...args) => {
              calls.push(['createLinearGradient', ...args]);
              return { addColorStop: (at, colour) => calls.push(['stop', at, colour]) };
            };
          return (...args) => {
            calls.push([name, ...args]);
            return name === 'getImageData' ? { width: 1, height: 1, data: new Uint8ClampedArray(4) } : undefined;
          };
        },
        set(target, name, value) {
          target[name] = value;
          calls.push(['set', name, value]);
          return true;
        }
      }
    )
  };
}

/**
 * GameGlobal as WeChat makes it, with a wx that keeps what the adapter asked of it. Frames run when the test says.
 * `files` are the package's files by path.
 */
function miniGame({ files = {}, width = 390, height = 844, safeArea } = {}) {
  const handlers = {},
    storage = new Map(),
    written = new Map(),
    canvases = [],
    images = [],
    frames = [];
  const on = name => fn => (handlers[name] ??= []).push(fn);
  const wx = {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    getSystemInfoSync: () => ({
      windowWidth: width,
      windowHeight: height,
      screenWidth: width,
      screenHeight: height,
      pixelRatio: 2,
      language: 'zh_CN',
      platform: 'ios',
      SDKVersion: '3.6.0',
      ...(safeArea === undefined ? {} : { safeArea })
    }),
    getLaunchOptionsSync: () => ({ query: { level: '2' } }),
    createCanvas() {
      const canvas = { width: 300, height: 150, contexts: {} };
      canvas.getContext = type => {
        if (canvas.contexts[type]) return canvas.contexts[type].gl ?? canvas.contexts[type].context;
        canvas.contexts[type] = type === '2d' ? fake2d() : fakeGl(canvas);
        return canvas.contexts[type].gl ?? canvas.contexts[type].context;
      };
      canvases.push(canvas);
      return canvas;
    },
    createImage() {
      const image = { width: 0, height: 0, src: '' };
      images.push(image);
      return image;
    },
    getFileSystemManager: () => ({
      readFile({ filePath, encoding, success, fail }) {
        setTimeout(() => {
          if (!(filePath in files)) return fail({ errMsg: 'readFile:fail no such file ' + filePath });
          const bytes = Buffer.from(files[filePath]);
          success({
            data: encoding
              ? bytes.toString(encoding)
              : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
          });
        }, 0);
      },
      writeFile({ filePath, data, success }) {
        written.set(filePath, new Uint8Array(data));
        setTimeout(() => success({}), 0);
      }
    }),
    getStorageSync: key => (storage.has(key) ? storage.get(key) : ''),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: key => storage.delete(key),
    getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
    getPerformance: () => ({ now: () => performance.now() * 1000 }),
    onTouchStart: on('touchstart'),
    onTouchMove: on('touchmove'),
    onTouchEnd: on('touchend'),
    onTouchCancel: on('touchcancel'),
    onKeyDown: on('keydown'),
    onKeyUp: on('keyup'),
    onShow: on('show'),
    onHide: on('hide'),
    onWindowResize: on('resize')
  };
  const G = vm.createContext({
    wx,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: callback => frames.push(callback),
    cancelAnimationFrame() {}
  });
  vm.runInContext('var GameGlobal = this;', G);
  return {
    G,
    wx,
    canvases,
    images,
    storage,
    written,
    emit: (name, value) => (handlers[name] ?? []).forEach(fn => fn(value)),
    frame() {
      const due = frames.splice(0);
      due.forEach(callback => callback(1000));
    }
  };
}

/** Runs a game's code, as game.js runs it, in a mini game; the game leaves what it found in GameGlobal.result. */
async function run(world, code, page = { body: [{ tag: 'div', id: 'frame' }] }) {
  vm.runInContext(gameScript({ adapter: ADAPTER, page, bundle: code }), world.G);
  for (let i = 0; i < 50 && world.G.result === undefined && world.G.failed === undefined; i++)
    await new Promise(r => setTimeout(r, 5));
  if (world.G.failed) throw world.G.failed;
  return world.G.result;
}
const finish = body =>
  `try { GameGlobal.result = await (async () => { ${body} })(); } catch (e) { GameGlobal.failed = e; }`;

// Break caught: an engine that reads a page's accessors from the prototypes (as its input does) finds none.
test('WX01 the page has its classes, with their properties on the prototypes', async () => {
  const world = miniGame();
  const result = await run(
    world,
    finish(`
      const get = (C, name) => typeof Object.getOwnPropertyDescriptor(C.prototype, name)?.get;
      const canvas = document.createElement('canvas');
      document.querySelector('#frame').appendChild(canvas);
      const style = getComputedStyle(canvas);
      const rect = canvas.getBoundingClientRect();
      return {
        accessors: [get(PointerEvent, 'pointerId'), get(MouseEvent, 'clientX'), get(KeyboardEvent, 'key'), get(Event, 'target'),
          get(Node, 'isConnected'), get(Node, 'ownerDocument'), get(HTMLElement, 'style'), get(HTMLCanvasElement, 'width'),
          get(Document, 'defaultView'), get(DOMRectReadOnly, 'left')],
        methods: typeof CSSStyleDeclaration.prototype.getPropertyValue + typeof Element.prototype.setPointerCapture,
        connected: canvas.isConnected && canvas.ownerDocument === document && document.defaultView === window,
        computed: [style.getPropertyValue('transform'), style.getPropertyValue('padding-left'), style.getPropertyValue('border-top-width'), style.getPropertyValue('zoom')],
        rect: [rect instanceof DOMRectReadOnly, rect.left, rect.width, rect.height],
        location: location.href,
        query: new URLSearchParams(location.search).get('level'),
        windowIsGlobal: window === globalThis && self === window
      };
    `)
  );
  assert.deepEqual([...result.accessors], Array(10).fill('function'));
  assert.equal(result.methods, 'functionfunction');
  assert.ok(result.connected);
  assert.deepEqual([...result.computed], ['none', '0px', '0px', '1']);
  assert.deepEqual([...result.rect], [true, 0, 390, 844]);
  assert.match(result.location, /^https:\/\/game\.local\//);
  assert.equal(result.query, '2');
  assert.ok(result.windowIsGlobal);
});

// Break caught: the engine's WebGL2 host refuses a context whose canvas is not the element it was given, or a second
// canvas takes the screen.
test('WX02 the first WebGL canvas is the screen; others draw in 2D off it', async () => {
  const world = miniGame();
  const result = await run(
    world,
    finish(`
      const stage = document.createElement('canvas');
      stage.width = 780; stage.height = 1688;
      const gl = stage.getContext('webgl2', { alpha: true });
      const other = document.createElement('canvas');
      const second = other.getContext('webgl2');
      const flat = other.getContext('2d');
      return { same: gl.canvas === stage, second, flatCanvas: flat.canvas === other, size: [stage.width, stage.height] };
    `)
  );
  assert.ok(result.same);
  assert.equal(result.second, null);
  assert.ok(result.flatCanvas);
  assert.deepEqual([...result.size], [780, 1688]);
  assert.equal(world.canvases[0].width, 780, 'the screen canvas takes the stage size');
  assert.ok(world.canvases[0].contexts.webgl2 && !world.canvases[0].contexts['2d']);
  assert.ok(world.canvases[1].contexts['2d'], 'the 2D canvas is one of its own, off the screen');
});

// Break caught: touches that never reach the game as pointer events, or reach it without a pointer id.
test('WX03 touches arrive as pointer events and a tap as a click; keys as keyboard events', async () => {
  const world = miniGame();
  await run(
    world,
    finish(`
      const stage = document.createElement('canvas');
      document.querySelector('#frame').appendChild(stage);
      stage.getContext('webgl2');
      GameGlobal.seen = [];
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'click'])
        stage.addEventListener(type, e => GameGlobal.seen.push([e.type, e.pointerId, e.pointerType, e.clientX, e.clientY, e.target === stage, e instanceof PointerEvent]));
      document.addEventListener('pointerdown', e => GameGlobal.seen.push(['bubbled', e.currentTarget === document]));
      window.addEventListener('keydown', e => GameGlobal.seen.push(['key', e.key, e.code, e instanceof KeyboardEvent]));
      return true;
    `)
  );
  const touch = { identifier: 0, clientX: 100, clientY: 200 };
  world.emit('touchstart', { touches: [touch], changedTouches: [touch] });
  world.emit('touchend', { touches: [], changedTouches: [touch] });
  world.emit('keydown', { key: 'a', code: 'KeyA' });
  assert.deepEqual(JSON.parse(JSON.stringify(world.G.seen)), [
    ['pointerdown', 1, 'touch', 100, 200, true, true],
    ['bubbled', true],
    ['pointerup', 1, 'touch', 100, 200, true, true],
    ['click', null, null, 100, 200, true, false],
    ['key', 'a', 'KeyA', true]
  ]);
});

// Break caught: the game's saves mixed with WeChat's own keys, files renamed by the export not found, or pictures
// decoded from bytes never loaded.
test('WX04 storage, package files, renamed pictures and decoded bytes', async () => {
  const world = miniGame({ files: { 'levels/one.json': '{"stars":3}', 'art/road.jpg': 'jpg' } });
  const result = await run(
    world,
    finish(`
      localStorage.setItem('best', 12);
      const level = await (await fetch(new URL('levels/one.json', location.href))).json();
      const missing = (await fetch('levels/none.json')).status;
      const picture = new Image();
      picture.src = 'https://game.local/art/road.webp';
      const made = createImageBitmap(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }));
      return { best: localStorage.getItem('best'), level, missing, picture: picture, made };
    `),
    { body: [], renamed: { 'art/road.webp': 'art/road.jpg' } }
  );
  assert.deepEqual([...world.storage.keys()], ['ls:best']);
  assert.equal(result.best, '12');
  assert.equal(result.level.stars, 3);
  assert.equal(result.missing, 404);
  assert.equal(world.images[0].src, 'art/road.jpg');
  // The decoded bytes go to a file of the game's own and are loaded from there.
  await new Promise(r => setTimeout(r, 10));
  const [file] = world.written.keys();
  assert.match(file, /^wxfile:\/\/usr\/egret-picture-0\.png$/);
  assert.equal(world.images[1].src, file);
  world.images[1].width = 2;
  world.images[1].height = 3;
  world.images[1].onload();
  const bitmap = await result.made;
  assert.deepEqual([bitmap.width, bitmap.height, typeof bitmap.close], [2, 3, 'function']);
});

// Break caught: scenery a game paints as the CSS background under its canvas missing from the mini game's screen,
// or the game's WebGL state left changed by painting it.
test('WX05 the backgrounds under the stage are drawn under each frame that reached the screen', async () => {
  const world = miniGame({ width: 2, height: 4 });
  await run(
    world,
    finish(`
      const frame = document.querySelector('#frame');
      const road = frame.appendChild(document.createElement('div'));
      road.style.background = 'linear-gradient(to bottom, #000, #222 60%, #444), url(art/road.jpg) center bottom / cover no-repeat, #05060c';
      const stage = frame.appendChild(document.createElement('canvas'));
      frame.appendChild(document.createElement('div')).style.background = 'red';
      GameGlobal.gl = stage.getContext('webgl2');
      return true;
    `)
  );
  const screen = world.canvases[0].contexts.webgl2;
  // A frame drawn into the game's own framebuffer alone is not finished with the backdrop.
  vm.runInContext(
    "requestAnimationFrame(() => { gl.bindFramebuffer(gl.FRAMEBUFFER, 'target'); gl.drawArrays(gl.TRIANGLES, 0, 3); })",
    world.G
  );
  world.frame();
  assert.ok(!screen.calls.some(c => c[0] === 'blendFunc'));
  vm.runInContext(
    'requestAnimationFrame(() => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.drawArrays(gl.TRIANGLES, 0, 3); })',
    world.G
  );
  world.frame();
  const backdrop = world.canvases.find(c => c.contexts['2d']).contexts['2d'].calls;
  assert.ok(backdrop.some(c => c[0] === 'createLinearGradient'));
  assert.deepEqual(
    backdrop.filter(c => c[0] === 'stop').map(c => [c[1], c[2]]),
    [
      [0, '#000'],
      [0.6, '#222'],
      [1, '#444']
    ]
  );
  assert.ok(backdrop.some(c => c[0] === 'set' && c[1] === 'fillStyle' && c[2] === '#05060c'));
  assert.ok(
    !backdrop.some(c => c[2] === 'red'),
    'an element after the stage would cover it on a page, not lie under it'
  );
  assert.equal(world.images[0].src, 'art/road.jpg');
  const blend = screen.calls.find(c => c[0] === 'blendFunc');
  assert.deepEqual(blend.slice(1), [screen.constant('ONE_MINUS_DST_ALPHA'), screen.constant('ONE')]);
  assert.ok(screen.calls.some(c => c[0] === 'drawArrays' && c[1] === screen.constant('TRIANGLE_STRIP')));
  assert.equal(screen.state.program, 'game-program', 'the game finds its own program bound again');
  assert.equal(screen.state.blend, false);
  // Once the picture loads, the next frame paints it, covering the window from its bottom edge.
  const image = world.images[0];
  image.width = 4;
  image.height = 4;
  image.onload();
  vm.runInContext('requestAnimationFrame(() => { gl.clear(gl.COLOR_BUFFER_BIT); })', world.G);
  world.frame();
  const drawn = backdrop.find(c => c[0] === 'drawImage');
  assert.deepEqual(drawn.slice(2), [-1, 0, 4, 4]);
});

function gameFolder() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-wechat-game-'));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.mkdirSync(path.join(dir, 'vendor'));
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    '<!doctype html><html><head><script type="importmap">{ "imports": { "@egret/engine": "./vendor/engine.js" } }</script></head>' +
      '<body><main id="frame" class="tall"><p>Loading <b>now</b></p><img id="logo" src="assets/logo.png"></main><script type="module" src="src/main.mjs"></script></body></html>'
  );
  fs.writeFileSync(path.join(dir, 'src', 'main.mjs'), 'export {};');
  fs.writeFileSync(path.join(dir, 'assets', 'road.webp'), 'webp');
  fs.writeFileSync(path.join(dir, 'assets', 'level.json'), '{}');
  fs.writeFileSync(path.join(dir, 'assets', 'cover.psd'), 'psd');
  fs.writeFileSync(path.join(dir, 'vendor', 'engine.js'), '');
  fs.writeFileSync(path.join(dir, 'README.md'), '');
  return dir;
}

// Break caught: elements the game looks up by id missing from the mini game, or code and pages packaged as files.
test('WX06 the page gives the import map and the elements the game looks up', () => {
  const dir = gameFolder();
  try {
    assert.deepEqual(readImportMap(dir), { '@egret/engine': path.join(dir, 'vendor', 'engine.js') });
    assert.deepEqual(readPageSkeleton(dir), {
      body: [
        {
          tag: 'main',
          id: 'frame',
          className: 'tall',
          children: [
            { tag: 'p', text: 'Loading', children: [{ tag: 'b', text: 'now' }] },
            { tag: 'img', id: 'logo' }
          ]
        }
      ]
    });
    assert.deepEqual(
      assetFiles(dir)
        .map(a => [a.rel.split(path.sep).join('/'), a.uploadable])
        .sort(),
      [
        ['assets/cover.psd', false],
        ['assets/level.json', true],
        ['assets/road.webp', true]
      ]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Break caught: a project WeChat DevTools does not open as a game, files WeChat refuses packed without a word, or a
// picture written in another format that the game then cannot find.
test('WX07 the export writes a mini game project and says what it could not carry', async () => {
  const dir = gameFolder(),
    out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'egret-wechat-out-')), 'project');
  // esbuild itself is a tool the caller installs; here a stand-in gives a bundle and passes the script through.
  const esbuild = {
    build: async options => {
      assert.equal(options.format, 'esm');
      return { outputFiles: [{ text: 'GameGlobal.started = true;\nexport {};\n' }], warnings: [] };
    },
    transform: async (code, options) => {
      assert.equal(options.target, 'es2017');
      return { code };
    }
  };
  try {
    const plain = await exportWechat({ esbuild, gameDir: dir, out, appid: 'wx0123456789abcdef', name: 'Test' });
    assert.deepEqual(
      plain.refused.map(p => p.split(path.sep).join('/')),
      ['assets/cover.psd']
    );
    assert.deepEqual(
      plain.webp.map(p => p.split(path.sep).join('/')),
      ['assets/road.webp']
    );
    assert.ok(plain.withinMainPackage && plain.withinTotal);
    const json = JSON.parse(fs.readFileSync(path.join(out, 'game.json'), 'utf8'));
    assert.equal(json.deviceOrientation, 'portrait');
    assert.equal(json.iOSHighPerformance, true);
    const project = JSON.parse(fs.readFileSync(path.join(out, 'project.config.json'), 'utf8'));
    assert.equal(project.compileType, 'game');
    assert.equal(project.appid, 'wx0123456789abcdef');
    assert.ok(!fs.existsSync(path.join(out, 'assets', 'cover.psd')));
    const script = fs.readFileSync(path.join(out, 'game.js'), 'utf8');
    for (const name of ['document', 'PointerEvent', 'requestAnimationFrame'])
      assert.ok(PAGE_NAMES.includes(name) && script.includes(name));
    // The script runs in a mini game's global.
    const world = miniGame();
    vm.runInContext(script, world.G);
    await new Promise(r => setTimeout(r, 5));
    assert.equal(world.G.started, true);
    await assert.rejects(exportWechat({ esbuild, gameDir: dir, out }), /must be new or empty/);
    // With a transcoder the WebP is written again and the game finds it under its new name.
    const again = out + '-webp';
    const converted = await exportWechat({
      esbuild,
      gameDir: dir,
      out: again,
      transcode: async (bytes, ext) => ({ bytes: Buffer.from('jpg:' + ext), ext: 'jpg' })
    });
    assert.deepEqual(converted.webp, []);
    assert.equal(fs.readFileSync(path.join(again, 'assets', 'road.jpg'), 'utf8'), 'jpg:webp');
    assert.ok(!fs.existsSync(path.join(again, 'assets', 'road.webp')));
    assert.ok(
      fs.readFileSync(path.join(again, 'game.js'), 'utf8').includes('"renamed":{"assets/road.webp":"assets/road.jpg"}')
    );
    fs.rmSync(again, { recursive: true, force: true });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(path.dirname(out), { recursive: true, force: true });
  }
});

// Break caught: a game fitted with the page's safe-area insets reading none in a mini game, and so placing buttons
// under the notch and the home bar.
test("WX08 the page's safe-area insets are WeChat's safe area", async () => {
  const world = miniGame({
    width: 390,
    height: 844,
    safeArea: { top: 47, left: 0, right: 390, bottom: 810, width: 390, height: 763 }
  });
  const result = await run(
    world,
    finish(`
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
      document.body.appendChild(probe);
      const style = getComputedStyle(probe);
      const plain = getComputedStyle(document.createElement('div'));
      return [style.position, style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft, plain.paddingTop];
    `)
  );
  assert.deepEqual([...result], ['fixed', '47px', '0px', '34px', '0px', '0px']);
});
