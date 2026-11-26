// SPDX-License-Identifier: Apache-2.0
// The parts of the single-file packer and of the game check that need neither a bundler nor a browser: which names
// the file gives, what it is made from, and how a run of a game is judged from what was seen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
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
function observedBrowser({ soundsStarted = 2, loadError } = {}) {
  const listeners = new Map();
  const calls = { navigation: 0, click: 0, closed: 0 };
  let route,
    openedUrl,
    frames = 0,
    pictures = 0;
  const canvas = { x: 0, y: 0, w: 960, h: 640, pixelWidth: 960, pixelHeight: 640 };
  const initial = picture(10, 10, (x, y) => [x < 3 ? 255 : 0, y < 3 ? 255 : 0, 40, 255]);
  const changed = picture(10, 10, (x, y) => [x < 5 ? 255 : 0, y < 3 ? 255 : 0, 40, 255]);
  const tab = {
    on(name, handler) {
      listeners.set(name, handler);
    },
    async route(pattern, handler) {
      route = handler;
    },
    async addInitScript() {},
    async goto(address) {
      calls.navigation++;
      if (loadError) throw loadError;
      openedUrl = address;
    },
    async waitForTimeout(milliseconds) {
      frames += milliseconds / 20;
      await new Promise(resolve => setTimeout(resolve, 1));
    },
    async screenshot() {
      return ++pictures === 1 ? initial : changed;
    },
    async evaluate(read) {
      return structuredClone(
        runInNewContext('(' + read + ')()', {
          window: { __verify: { frames, audioContexts: 1, soundsStarted, rejections: [] } },
          document: {
            querySelectorAll: () => [
              {
                width: canvas.pixelWidth,
                height: canvas.pixelHeight,
                getBoundingClientRect: () => ({ x: canvas.x, y: canvas.y, width: canvas.w, height: canvas.h })
              }
            ]
          }
        })
      );
    },
    mouse: {
      async click() {
        calls.click++;
      },
      async move() {},
      async down() {},
      async up() {}
    },
    keyboard: { async press() {}, async down() {}, async up() {} }
  };
  return {
    chromium: {
      async launch() {
        return {
          async newPage() {
            return tab;
          },
          async close() {
            calls.closed++;
          }
        };
      }
    },
    PNG: { sync: { read: bytes => bytes } },
    file: fileURLToPath(new URL('../examples/play/index.html', import.meta.url)),
    out: '.',
    calls,
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
