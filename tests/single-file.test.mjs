// SPDX-License-Identifier: Apache-2.0
// The parts of the single-file packer and of the game check that need neither a bundler nor a browser: which names
// the file gives, what it is made from, and how a run of a game is judged from what was seen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SINGLE_FILE_ENTRIES,
  fileSizes,
  groupOf,
  singleFileNames,
  singleFileSource,
  workspaceModules
} from '../tools/pack-single-file.mjs';
import { gameChecks, pictureChange, pictureStats } from '../tools/verify-game.mjs';

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
  assert.deepEqual(failing({ changedMostDuringInput: 0.001 }), ['reactsOrMoves']);
  assert.deepEqual(failing({ soundsStarted: 0 }), ['makesSound']);
  assert.equal(gameChecks(good).noErrors.errors.length, 0);
  assert.deepEqual(gameChecks({ ...good, consoleErrors: ['boom'] }).noErrors.errors, ['console.error: boom']);
});
