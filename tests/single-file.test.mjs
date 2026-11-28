// SPDX-License-Identifier: Apache-2.0
// The parts of the single-file packer and of the game check that need neither a bundler nor a browser: which names
// the file gives, what it is made from, and how a run of a game is judged from what was seen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext, runInNewContext } from 'node:vm';
import {
  SINGLE_FILE_ENTRIES,
  SINGLE_FILE_ENTRIES_3D,
  fileSizes,
  groupOf,
  singleFileNames,
  singleFileSource,
  workspaceModules
} from '../tools/pack-single-file.mjs';
import {
  coloursAlike,
  gameChecks,
  keyOf,
  pictureChange,
  pictureStats,
  stagePlace,
  verifyGame
} from '../tools/verify-game.mjs';

const refused = run => {
  try {
    run();
  } catch (cause) {
    return cause.code;
  }
  return undefined;
};

// Break caught: leave an entry of the file unbuilt or unnamed by a manifest, or lose a private import.
test('SF01 every entry of the file and every private import is found from the manifests', () => {
  const modules = workspaceModules();
  for (const entry of SINGLE_FILE_ENTRIES) assert.ok(fs.existsSync(modules.get(entry)), entry);
  assert.equal(SINGLE_FILE_ENTRIES[0], '@egret/engine/play');
  assert.ok(modules.get('@egret/runtime').endsWith('index.js'));
  assert.ok([...modules.keys()].some(name => name.startsWith('#')));
});

// Break caught: let the second of two different things of one name win silently, or lose a name two entries share.
test('SF02 the names of the file are those of its entries; one name for two things is refused', async () => {
  const namespaces = [];
  for (const entry of SINGLE_FILE_ENTRIES) namespaces.push([entry, await import(entry)]);
  const names = singleFileNames(namespaces);
  assert.equal(names.get('play'), '@egret/engine/play');
  assert.equal(names.get('Sprite'), '@egret/engine');
  assert.equal(names.get('createRandom'), '@egret/engine/kit');
  assert.equal(names.get('createBrowserGame'), '@egret/engine/web/game');
  assert.equal(names.size, new Set(namespaces.flatMap(([, namespace]) => Object.keys(namespace))).size);
  assert.deepEqual([...names.keys()], [...names.keys()].sort());
  // The file for a 3D game holds the same names, and World3D with play3d, without two things under one name.
  const deeper = [];
  for (const entry of SINGLE_FILE_ENTRIES_3D) deeper.push([entry, await import(entry)]);
  const names3d = singleFileNames(deeper);
  for (const name of names.keys()) assert.ok(names3d.has(name), name);
  assert.equal(names3d.get('play3d'), '@egret/engine/webgl2/world3d');
  assert.equal(names3d.get('Scene3D'), '@egret/engine/world3d');
  assert.ok(names3d.size > names.size + 200);
  const one = () => 1,
    two = () => 2;
  assert.deepEqual(
    [
      ...singleFileNames([
        ['a', { f: one, g: two }],
        ['b', { f: one }]
      ])
    ],
    [
      ['f', 'a'],
      ['g', 'a']
    ]
  );
  assert.equal(
    refused(() =>
      singleFileNames([
        ['a', { f: one }],
        ['b', { f: two }]
      ])
    ),
    'SINGLE_FILE_NAME'
  );
  assert.equal(
    refused(() => singleFileNames([['a', { default: one }]])),
    'SINGLE_FILE_NAME'
  );
  assert.equal(
    singleFileSource(
      new Map([
        ['f', 'a'],
        ['g', 'b'],
        ['h', 'a']
      ])
    ),
    "export { f, h } from 'a';\nexport { g } from 'b';\n"
  );
});

test('SF03 sizes are of the bytes as written and as sent, and a module is counted to one part of the engine', () => {
  const bytes = Buffer.from('a'.repeat(4096)),
    sizes = fileSizes(bytes);
  assert.equal(sizes.bytes, 4096);
  assert.ok(sizes.gzip < 100 && sizes.brotli < 100);
  assert.match(sizes.sha256, /^[0-9a-f]{64}$/);
  assert.equal(groupOf('/x/packages/engine/dist/web/WebGPUHost.js'), 'WebGPU host');
  assert.equal(groupOf('/x/packages/engine/dist/web/webgl2Native.js'), 'WebGL2 host');
  assert.equal(groupOf('/x/packages/runtime/dist/errorHelpZh.js'), 'Sentences of errors');
  assert.equal(groupOf('/x/packages/engine/dist/web/BrowserPlay.js'), 'Play');
  assert.equal(groupOf('/x/packages/runtime/dist/DisplayObject.js'), 'Runtime');
  assert.equal(groupOf('/x/packages/engine/dist/tween.js'), 'Engine');
});

const picture = (width, height, paint) => {
  const data = new Uint8Array(4 * width * height);
  for (let i = 0; i < width * height; i++) data.set(paint(i % width, Math.floor(i / width)), 4 * i);
  return { width, height, data };
};
// Break caught: count a blank page as drawn, or a still page as one that answered.
test('SF04 a picture is measured by its colours and by how much of it changed', () => {
  const blank = picture(10, 10, () => [0, 0, 0, 255]),
    game = picture(10, 10, (x, y) => (y < 2 ? [255, 0, 0, 255] : x < 3 ? [0, 0, 255, 255] : [16, 24, 40, 255]));
  assert.deepEqual(pictureStats(blank), { colors: 1, dominant: 1 });
  assert.equal(pictureStats(game).colors, 3);
  assert.equal(pictureChange(game, game), 0);
  assert.equal(
    pictureChange(
      blank,
      picture(10, 10, () => [8, 8, 8, 255])
    ),
    0
  );
  assert.equal(
    pictureChange(
      blank,
      picture(10, 10, x => (x === 0 ? [255, 255, 255, 255] : [0, 0, 0, 255]))
    ),
    0.1
  );
  assert.equal(
    pictureChange(
      blank,
      picture(5, 5, () => [0, 0, 0, 255])
    ),
    1
  );
});

// Break caught: pass a game that threw, asked the network for a file, stopped drawing, or never changed.
test('SF05 a run passes only when nothing failed, something was drawn, frames went on, input changed it and it sounded', () => {
  const good = {
    pageErrors: [],
    rejections: [],
    consoleErrors: [],
    failedRequests: [],
    externalRequests: [],
    canvases: [{ x: 0, y: 0, w: 960, h: 640 }],
    start: { colors: 12, dominant: 0.7 },
    framesPerSecondIdle: 30,
    framesPerSecondPlaying: 28,
    changedAfterFirstInputs: 0.001,
    changedAtEnd: 0.002,
    changedMostDuringInput: 0.03,
    audioContexts: 1,
    soundsStarted: 4
  };
  const failing = seen =>
    Object.entries(gameChecks({ ...good, ...seen }))
      .filter(([, check]) => !check.pass)
      .map(([name]) => name);
  assert.deepEqual(failing({}), []);
  assert.deepEqual(failing({ pageErrors: ['TypeError: x'] }), ['noErrors']);
  assert.deepEqual(failing({ rejections: ['PLAY_SFX_UNKNOWN: …'] }), ['noErrors']);
  assert.deepEqual(failing({ loadError: 'timeout' }), ['noErrors']);
  assert.deepEqual(failing({ failedRequests: ['http://127.0.0.1/hero.png 404'] }), ['noErrors']);
  assert.deepEqual(failing({ externalRequests: ['https://cdn.example/x.js'] }), ['noExternalRequests']);
  assert.deepEqual(failing({ canvases: [] }), ['hasCanvas']);
  assert.deepEqual(failing({ start: { colors: 1, dominant: 1 } }), ['drawsSomething']);
  assert.deepEqual(failing({ framesPerSecondIdle: 0 }), ['keepsRunning']);
  assert.deepEqual(failing({ framesPerSecondPlaying: 0 }), ['keepsRunning']);
  assert.deepEqual(failing({ framesPerSecondPlaying: 1.9 }), ['keepsRunning']);
  assert.deepEqual(failing({ changedMostDuringInput: 0.001 }), ['reactsOrMoves']);
  assert.deepEqual(failing({ soundsStarted: 0 }), ['makesSound']);
  assert.equal(gameChecks(good).noErrors.errors.length, 0);
  assert.deepEqual(gameChecks({ ...good, consoleErrors: ['boom'] }).noErrors.errors, ['console.error: boom']);
});

// Break caught: aim a script's tap at the wrong place of a letterboxed canvas, or press another key than the game asks.
test("SF06 a script plays in the stage's own units, with the names a game asks its keys by", () => {
  const box = { x: 120, y: 0, w: 720, h: 480 };
  assert.deepEqual(stagePlace(box, 480, 320, 0, 0), [120, 0]);
  assert.deepEqual(stagePlace(box, 480, 320, 240, 160), [480, 240]);
  assert.deepEqual(stagePlace(box, 480, 320, 480, 320), [840, 480]);
  assert.deepEqual(
    ['left', 'Right', 'up', 'down', 'space', 'enter', 'escape', 'shift', 'a', 'W', '7', 'KeyQ'].map(keyOf),
    [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Space',
      'Enter',
      'Escape',
      'ShiftLeft',
      'KeyA',
      'KeyW',
      'Digit7',
      'KeyQ'
    ]
  );
  assert.ok(coloursAlike(0x3b82f6, 0x3a80f8));
  assert.ok(!coloursAlike(0x3b82f6, 0x3b82d0));
  assert.ok(!coloursAlike(0xffffff, 0xf0f0f0, 6));
});

// Frozen browser observations exercise the real runner without starting a browser or measuring a device.
function observedBrowser({
  soundsStarted = 2,
  loadError,
  drawAt = 0,
  frameStartAt = 0,
  declaredReadyAt,
  reloadDeclaredReadyAt,
  canvas = 'visible',
  hangEvaluate = false,
  reloadHangEvaluate = false,
  localRequestAt,
  localRequestUntil
} = {}) {
  const listeners = new Map();
  const calls = { navigation: 0, click: 0, closed: 0 };
  const telemetry = {
    elapsed: 0,
    screenshots: [],
    inputs: [],
    evaluations: [],
    localRequests: [],
    hungSettled: false,
    savedStart: undefined
  };
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'egret-observed-'));
  let route,
    openedUrl,
    frames = 0,
    initScript,
    context,
    hungTimer,
    hasHung = false,
    pendingLocal,
    navClicks = 0;
  const blank = picture(10, 10, () => [0, 0, 0, 255]);
  const initial = picture(10, 10, (x, y) => [x < 3 ? 255 : 0, y < 3 ? 255 : 0, 40, 255]);
  const loading = picture(10, 10, (x, y) => [x < 3 ? 0 : 255, y < 3 ? 255 : 0, 90, 255]);
  const changed = picture(10, 10, (x, y) => [x < 5 ? 255 : 0, y < 3 ? 255 : 0, 40, 255]);
  const images = { blank, initial, loading, changed };
  const bounds = () => ({ x: 0, y: 0, width: canvas === 'hidden' ? 0 : 960, height: canvas === 'hidden' ? 0 : 640 });
  const readyAt = () =>
    calls.navigation > 1 && reloadDeclaredReadyAt !== undefined ? reloadDeclaredReadyAt : declaredReadyAt;
  const newPageContext = () => {
    const style = { display: canvas === 'hidden' ? 'none' : 'block', visibility: 'visible', opacity: '1' };
    const element = {
      width: 960,
      height: 640,
      isConnected: true,
      getBoundingClientRect: bounds,
      getClientRects: () => [bounds()]
    };
    const page = {
      __verify: { frames, audioContexts: 1, soundsStarted, rejections: [], engineWarnings: [] },
      document: { querySelectorAll: () => (canvas === 'absent' ? [] : [element]) },
      innerWidth: 960,
      innerHeight: 640,
      getComputedStyle: () => style,
      performance: { now: () => telemetry.elapsed },
      requestAnimationFrame() {
        return 1;
      },
      addEventListener() {}
    };
    page.window = page;
    page.globalThis = page;
    if (readyAt() !== undefined)
      page.egretGame = {
        get ready() {
          return telemetry.elapsed >= readyAt();
        }
      };
    context = createContext(page);
    if (initScript) runInContext('(' + initScript + ')()', context);
    // The actual init script installs the observer. Advance only simulated
    // browser callbacks; waiting and screenshots do not manufacture extra ones.
    Object.assign(page.__verify, { frames, audioContexts: 1, soundsStarted, rejections: [], engineWarnings: [] });
  };
  const input = kind => telemetry.inputs.push({ at: telemetry.elapsed, kind, navigation: calls.navigation });
  const updateLocal = () => {
    if (calls.navigation !== 1 || localRequestAt === undefined) return;
    if (!pendingLocal && telemetry.localRequests.length === 0 && telemetry.elapsed >= localRequestAt) {
      pendingLocal = { url: () => new URL('art.glb', openedUrl).href };
      telemetry.localRequests.push({ kind: 'start', at: telemetry.elapsed });
      listeners.get('request')?.(pendingLocal);
    }
    if (pendingLocal && telemetry.elapsed >= localRequestUntil) {
      telemetry.localRequests.push({ kind: 'finish', at: telemetry.elapsed });
      listeners.get('requestfinished')?.(pendingLocal);
      pendingLocal = undefined;
    }
  };
  const tab = {
    on(name, handler) {
      listeners.set(name, handler);
    },
    async route(pattern, handler) {
      route = handler;
    },
    async addInitScript(fn) {
      initScript = fn;
    },
    async goto(address) {
      calls.navigation++;
      telemetry.elapsed = frames = navClicks = 0;
      newPageContext();
      if (loadError) throw loadError;
      openedUrl = address;
      updateLocal();
    },
    async waitForTimeout(milliseconds) {
      const before = telemetry.elapsed;
      telemetry.elapsed += milliseconds;
      frames += Math.max(0, telemetry.elapsed - Math.max(before, frameStartAt)) / 20;
      context.__verify.frames = frames;
      updateLocal();
      await new Promise(resolve => setTimeout(resolve, 1));
    },
    async screenshot(options = {}) {
      const name =
        telemetry.elapsed < drawAt
          ? 'blank'
          : readyAt() !== undefined && telemetry.elapsed < readyAt()
            ? 'loading'
            : navClicks === 0
              ? 'initial'
              : 'changed';
      const bytes = Buffer.from(name);
      telemetry.screenshots.push({ name, at: telemetry.elapsed, path: options.path, navigation: calls.navigation });
      if (options.path) fs.writeFileSync(options.path, bytes);
      return bytes;
    },
    async evaluate(read, arg) {
      telemetry.evaluations.push({ navigation: calls.navigation, at: telemetry.elapsed });
      if ((hangEvaluate || (reloadHangEvaluate && calls.navigation > 1)) && !hasHung) {
        hasHung = true;
        // Let a broken implementation finish instead of leaking a serving
        // socket forever. The correct runner returns before this resolves.
        await new Promise(resolve => {
          hungTimer = setTimeout(resolve, 1500);
        });
        telemetry.hungSettled = true;
      }
      context.__arg = arg;
      return structuredClone(await runInContext('(' + read + ')(__arg)', context));
    },
    mouse: {
      async click() {
        calls.click++;
        navClicks++;
        input('click');
      },
      async move() {
        input('move');
      },
      async down() {
        input('down');
      },
      async up() {
        input('up');
      }
    },
    keyboard: {
      async press() {
        input('press');
      },
      async down() {
        input('key-down');
      },
      async up() {
        input('key-up');
      }
    }
  };
  return {
    chromium: {
      async launch() {
        return {
          async newPage() {
            return tab;
          },
          async close() {
            clearTimeout(hungTimer);
            calls.closed++;
            const start = path.join(out, '1-start.png');
            if (fs.existsSync(start)) telemetry.savedStart = fs.readFileSync(start, 'utf8');
            fs.rmSync(out, { recursive: true, force: true });
          }
        };
      }
    },
    PNG: { sync: { read: bytes => images[bytes.toString()] } },
    file: fileURLToPath(new URL('../examples/play/index.html', import.meta.url)),
    out,
    calls,
    telemetry,
    get openedUrl() {
      return openedUrl;
    },
    failRequest(url) {
      listeners.get('requestfailed')({ url: () => url, failure: () => ({ errorText: 'net::ERR_ABORTED' }) });
    },
    async externalRequest(url) {
      await route({ request: () => ({ url: () => url }), async abort() {}, async continue() {} });
    }
  };
}

// Break caught: freeze network pass flags before the optional script adds a caught failure without a console error.
test('SF07 network failures from the scripted run fail the final report without a console error', async () => {
  const clean = observedBrowser();
  assert.equal((await verifyGame({ ...clean, script: { default: async () => {} } })).pass, true);

  const aborted = observedBrowser();
  const failed = await verifyGame({
    ...aborted,
    script: { default: async () => aborted.failRequest('http://127.0.0.1/late') }
  });
  assert.equal(failed.checks.played.pass, true, 'the scripted semantic witness itself completed');
  assert.deepEqual(failed.checks.noErrors.failedRequests, ['http://127.0.0.1/late net::ERR_ABORTED']);
  assert.equal(failed.checks.noErrors.pass, false);
  assert.equal(failed.pass, false);
});

// Break caught: leave the final network boundary flag unchanged when a scripted play asks another origin.
test('SF08 external requests from the scripted run fail the final report', async () => {
  const external = observedBrowser();
  const refused = await verifyGame({
    ...external,
    script: { default: async () => external.externalRequest('https://example.invalid/late') }
  });
  assert.equal(refused.checks.played.pass, true, 'the scripted semantic witness itself completed');
  assert.deepEqual(refused.checks.noExternalRequests.externalRequests, ['https://example.invalid/late']);
  assert.equal(refused.checks.noExternalRequests.pass, false);
  assert.equal(refused.pass, false);
});

// Break caught: a blind fixed-delay picture can record a blank loading surface
// and reject a fully functioning game. Reuse the successful observation.
test('SF startup readiness waits beyond 2.5 seconds for drawn and advancing browser content', async () => {
  const browser = observedBrowser({ drawAt: 3200, frameStartAt: 3200 });
  const report = await verifyGame(browser);
  assert.equal(report.pass, true);
  assert.equal(report.checks.startupReady.pass, true);
  assert.equal(report.checks.startupReady.source, 'observed');
  assert.equal(report.checks.startupReady.timeoutMs, 60000);
  assert.ok(report.checks.startupReady.elapsedMs >= 0);
  assert.equal(report.checks.drawsSomething.pass, true);
  assert.equal(report.checks.keepsRunning.pass, true);
  const firstInput = browser.telemetry.inputs[0]?.at;
  assert.ok(firstInput >= 3200, 'blind inputs wait for actual startup');
  assert.equal(browser.telemetry.savedStart, 'initial', '1-start is the accepted picture, not a later probe');
  assert.equal(
    browser.telemetry.screenshots.filter(picture => picture.at <= firstInput && picture.name === 'initial').length,
    1
  );
});

// Break caught: a colorful animated loading screen must not overrule the game's
// explicit startup intent; the same gate must unblock when the game says ready.
test('SF declared startup readiness is respected even when loading art already draws and ticks', async () => {
  const browser = observedBrowser({ declaredReadyAt: 3200 });
  const report = await verifyGame(browser);
  assert.equal(report.pass, true);
  assert.equal(report.checks.startupReady.pass, true);
  assert.equal(report.checks.startupReady.source, 'declared');
  assert.ok(browser.telemetry.inputs[0]?.at >= 3200);
  assert.equal(browser.telemetry.savedStart, 'initial');
});

// Break caught: removing the blind delay must not turn permanent loading, a
// drawing-free callback loop, a stalled loop or a hidden canvas into a pass.
test('SF startup timeout fails closed without blind input or ineligible canvas probes', async t => {
  const cases = [
    ['declared pending', { declaredReadyAt: Infinity }, 'declared', /declar|ready|waiting/i],
    ['black with callbacks', { drawAt: Infinity }, 'observed', /blank|draw|paint|color/i],
    ['painted but stopped', { frameStartAt: Infinity }, 'observed', /frame|running|heartbeat/i],
    ['hidden canvas', { canvas: 'hidden' }, 'observed', /canvas|visible/i],
    ['absent canvas', { canvas: 'absent' }, 'observed', /canvas|visible/i],
    ['declared ready but black', { declaredReadyAt: 0, drawAt: Infinity }, 'declared', /blank|draw|paint|color/i]
  ];
  for (const [name, options, source, reason] of cases)
    await t.test(name, async () => {
      const browser = observedBrowser(options);
      const report = await verifyGame({ ...browser, startupTimeoutMs: 250 });
      assert.equal(report.pass, false);
      assert.equal(report.checks.startupReady.pass, false);
      assert.equal(report.checks.startupReady.source, source);
      assert.equal(report.checks.startupReady.timeoutMs, 250);
      assert.match(report.checks.startupReady.reason, reason);
      assert.equal(browser.telemetry.inputs.length, 0, 'do not interact with an unready page');
      if (options.canvas)
        assert.equal(browser.telemetry.screenshots.length, 0, 'never screenshot an ineligible canvas');
      assert.equal(browser.calls.closed, 1);
    });
});

// Break caught: a hung renderer/evaluation may not be allowed to consume an
// unbounded wait. Verify the real runner returns while that command is unresolved.
test('SF startup deadline also bounds an unfinished browser evaluation', async () => {
  const browser = observedBrowser({ hangEvaluate: true });
  const report = await verifyGame({ ...browser, startupTimeoutMs: 250 });
  assert.equal(report.pass, false);
  assert.equal(report.checks.startupReady.pass, false);
  assert.equal(report.checks.startupReady.timeoutMs, 250);
  assert.match(report.checks.startupReady.reason, /timeout|deadline|evaluat|observ/i);
  assert.equal(browser.telemetry.hungSettled, false);
  assert.equal(browser.telemetry.inputs.length, 0);
  assert.equal(browser.calls.closed, 1);
});

// Break caught: a tinted loading screen can draw while a same-origin art fetch
// is in flight. Even a request wholly within one observation interval invalidates
// that interval; first input has to follow a fresh, stable sample.
test('SF observed startup waits for same-origin requests to settle before sampling and input', async t => {
  for (const [name, localRequestAt, localRequestUntil] of [
    ['delayed art', 0, 3200],
    ['request within one sample', 100, 600]
  ])
    await t.test(name, async () => {
      const browser = observedBrowser({ localRequestAt, localRequestUntil });
      const report = await verifyGame(browser);
      assert.equal(report.pass, true);
      assert.equal(report.checks.startupReady.source, 'observed');
      assert.equal(report.checks.startupReady.pendingRequests, 0);
      assert.deepEqual(
        browser.telemetry.localRequests.map(event => event.kind),
        ['start', 'finish']
      );
      const finished = browser.telemetry.localRequests[1].at;
      assert.ok(
        browser.telemetry.screenshots[0]?.at > finished,
        'capture fresh quiet interval, not loading/changed network'
      );
      assert.ok(browser.telemetry.inputs[0]?.at > finished);
    });
});

// Break caught: a second ordinary navigation may fail its own startup. It must
// not touch the unready scene again for a diagnostic screenshot or stale state.
test('SF bounded scripted reload failure never starts the script or reprobes the unready page', async t => {
  for (const [name, options] of [
    ['declared pending', { reloadDeclaredReadyAt: Infinity }],
    ['hung evaluation', { reloadHangEvaluate: true }]
  ])
    await t.test(name, async () => {
      const browser = observedBrowser(options);
      let scriptRan = false;
      const report = await verifyGame({
        ...browser,
        startupTimeoutMs: 250,
        script: {
          async default() {
            scriptRan = true;
          }
        }
      });
      assert.equal(report.checks.startupReady.pass, true, 'first startup did succeed');
      assert.equal(report.pass, false);
      assert.equal(report.checks.played.pass, false);
      assert.equal(report.checks.played.startupReady.pass, false, 'second startup has its own failure receipt');
      assert.equal(report.checks.played.startupReady.timeoutMs, 250);
      assert.equal(report.checks.played.diagnostic.code, 'VERIFY_GAME_STARTUP');
      assert.equal(browser.calls.navigation, 2);
      assert.equal(browser.calls.closed, 1);
      assert.equal(scriptRan, false);
      assert.equal(browser.telemetry.inputs.filter(input => input.navigation === 2).length, 0);
      assert.equal(browser.telemetry.screenshots.filter(picture => picture.navigation === 2).length, 0);
      if (options.reloadHangEvaluate) {
        assert.equal(browser.telemetry.hungSettled, false, 'deadline returns before the hung command resolves');
        assert.equal(
          browser.telemetry.evaluations.filter(evaluation => evaluation.navigation === 2).length,
          1,
          'never read stale page after startup failure'
        );
      }
    });
});

test('script-only verification starts once and evaluates ordered gameplay checkpoints without blind input', async () => {
  const browser = observedBrowser({ soundsStarted: 0 });
  const launch = browser.chromium.launch;
  browser.chromium.launch = async options => {
    const host = await launch(options);
    const newPage = host.newPage;
    host.newPage = async ({ viewport }) => {
      assert.deepEqual(viewport, { width: 640, height: 1136 });
      return newPage();
    };
    return host;
  };
  const report = await verifyGame({
    ...browser,
    scriptOnly: true,
    script: {
      viewport: { width: 640, height: 1136 },
      async default(player) {
        await player.tap(480, 320);
        player.checkpoint('first-action');
        await player.tap(480, 480);
        player.checkpoint('restart');
      }
    }
  });
  assert.equal(report.pass, true);
  assert.deepEqual(browser.calls, { navigation: 1, click: 0, closed: 1 });
  assert.deepEqual(report.checks.played.checkpoints, ['first-action', 'restart']);
  assert.equal('makesSound' in report.checks, false);
  assert.equal('keepsRunning' in report.checks, false);
  assert.equal('startupReady' in report.checks, false);
});

test('script-only failures retain the checkpoints reached and an actionable diagnostic', async () => {
  const failed = await verifyGame({
    ...observedBrowser(),
    scriptOnly: true,
    script: {
      async default(player) {
        player.checkpoint('ready');
        throw Object.assign(new Error('Missing item'), { code: 'PLAY_ITEM_MISSING', details: { item: 'lamp' } });
      }
    }
  });
  assert.equal(failed.pass, false);
  assert.deepEqual(failed.checks.played.checkpoints, ['ready']);
  assert.deepEqual(failed.checks.played.diagnostic, {
    code: 'PLAY_ITEM_MISSING',
    message: 'Missing item',
    details: { item: 'lamp' }
  });
});

test('script-only launch and navigation failures report startup and never play', async () => {
  const browser = observedBrowser({ loadError: new Error('navigation timed out') });
  const script = { default: () => assert.fail('gameplay must start on a loaded page') };
  const navigation = await verifyGame({ ...browser, scriptOnly: true, script });
  assert.equal(navigation.pass, false);
  assert.deepEqual(navigation.checks.played.diagnostic, {
    code: 'VERIFY_GAME_STARTUP',
    message: 'navigation timed out'
  });
  assert.equal(browser.calls.closed, 1);

  const launch = await verifyGame({
    ...browser,
    scriptOnly: true,
    script,
    chromium: {
      async launch() {
        throw new Error('missing browser executable');
      }
    }
  });
  assert.equal(launch.pass, false);
  assert.deepEqual(launch.checks.played.diagnostic, {
    code: 'VERIFY_GAME_STARTUP',
    message: 'missing browser executable'
  });
});

test('script-only serving is confined to the staged entry directory', async () => {
  const browser = observedBrowser();
  const report = await verifyGame({
    ...browser,
    scriptOnly: true,
    script: {
      async default(player) {
        assert.equal((await fetch(browser.openedUrl)).status, 200);
        assert.equal((await fetch(new URL('/package.json', browser.openedUrl))).status, 404);
        assert.equal((await fetch(new URL('/..%5c..%5cpackage.json', browser.openedUrl))).status, 404);
        assert.equal((await fetch(new URL('/%', browser.openedUrl))).status, 404);
        await browser.externalRequest('https://example.invalid/unexpected');
        player.checkpoint('observed');
      }
    }
  });
  assert.equal(report.checks.played.pass, true);
  assert.deepEqual(report.checks.played.checkpoints, ['observed']);
  assert.equal(report.checks.noExternalRequests.pass, false);
  assert.equal(report.pass, false);
  await assert.rejects(fetch(browser.openedUrl));
});

test('script-only serving can restrict staged siblings to the build manifest', async () => {
  const browser = observedBrowser();
  const report = await verifyGame({
    ...browser,
    scriptOnly: true,
    filePaths: ['index.html', 'memory.mjs'],
    script: {
      async default() {
        assert.equal((await fetch(browser.openedUrl)).status, 200);
        assert.equal((await fetch(new URL('memory.mjs', browser.openedUrl))).status, 200);
        assert.equal((await fetch(new URL('breakout.mjs', browser.openedUrl))).status, 404);
      }
    }
  });
  assert.equal(report.pass, true, report.checks.played.diagnostic?.message);
});
