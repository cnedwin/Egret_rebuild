// SPDX-License-Identifier: Apache-2.0
// The one-call game entry refuses what is not a game before it touches a page, and its stats panel shows what it is
// told. The game itself needs a canvas and a Host: examples/starter/verify.mjs runs it in a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { createBrowserGame, createBrowserStatsPanel } from '@egret/engine/web/game';
import { host } from './helpers.mjs';

const coded = code => error => error?.code === code;
/** As much of a page as the panel uses: a body that takes children, and elements with a style, attributes and text. */
function page() {
  const body = {
    children: [],
    appendChild(child) {
      this.children.push(child);
      child.parent = this;
    }
  };
  const document = {
    body,
    createElement: name => ({
      name,
      style: {},
      attributes: {},
      textContent: '',
      setAttribute(key, value) {
        this.attributes[key] = value;
      },
      remove() {
        this.parent.children.splice(this.parent.children.indexOf(this), 1);
      }
    })
  };
  const canvas = {
    ownerDocument: document,
    getBoundingClientRect: () => ({ left: 30, top: 40, width: 480, height: 270 })
  };
  return { document, body, canvas };
}

test('BG01 what is not a game is refused before a Host is made', async () => {
  const { canvas } = page(),
    good = { canvas, width: 480, height: 270 };
  for (const bad of [
    undefined,
    null,
    'game',
    {},
    { ...good, canvas: undefined },
    { ...good, canvas: {} },
    { ...good, width: 0 },
    { ...good, width: 1.5 },
    { ...good, height: -1 },
    { ...good, height: '270' },
    { ...good, backend: 'canvas' },
    { ...good, pixelRatio: 0 },
    { ...good, pixelRatio: Infinity },
    { ...good, clearColor: 0x1000000 },
    { ...good, clearColor: 1.5 },
    { ...good, clearAlpha: 2 },
    { ...good, update: 1 },
    { ...good, onError: 'no' },
    { ...good, pointer: 1 },
    { ...good, keyboard: 'yes' },
    { ...good, stats: 1 },
    { ...good, autoStart: 0 },
    { ...good, fit: 'fill' },
    { ...good, fitTo: 'body' }
  ])
    await assert.rejects(createBrowserGame(bad), coded('BROWSER_GAME_OPTIONS_INVALID'));
  // The message says what the code means.
  await assert.rejects(
    createBrowserGame({}),
    /^EgretError: BROWSER_GAME_OPTIONS_INVALID: The options given to the browser game are not valid/
  );
});

test('BG02 the panel lies over its canvas and shows what a frame holds and how busy the Host is', async () => {
  const { body, canvas } = page(),
    panel = createBrowserStatsPanel({ canvas, label: 'webgl2', intervalMs: 500 });
  assert.equal(body.children.length, 1);
  assert.equal(body.children[0], panel.element);
  assert.match(panel.element.attributes.style, /position:fixed/);
  assert.match(panel.element.attributes.style, /pointer-events:none/);
  // A real frame: two rectangles of one sprite and a circle, which is a mesh of ten triangles on one page.
  const engine = await egret.createEngine({ host: host().adapter }),
    scope = engine.createScope();
  try {
    engine.stage
      .addChild(scope.use(new egret.Sprite()))
      .graphics.beginFill(1)
      .drawRect(0, 0, 4, 4)
      .drawRect(8, 0, 4, 4)
      .endFill();
    engine.stage.addChild(scope.use(new egret.Sprite())).graphics.beginFill(2).drawCircle(20, 20, 6).endFill();
    const frame = engine.captureSharedFrame({ width: 64, height: 64 });
    // The first sample shows at once; with one sample there is no time between frames yet.
    panel.sample({ now: 1000, frame, pendingFrames: 1, frames: 7, skipped: 2 });
    assert.equal(
      panel.element.textContent,
      'webgl2\nfps 0.0  longest 0.0 ms\ncommands 3  triangles 14\ngeometries 1  pages 1\npending 1  drawn 7  skipped 2'
    );
    assert.deepEqual([panel.element.style.left, panel.element.style.top], ['30px', '40px']);
    // Sixty frames a second for half a second, one of them late: the text changes when the interval has passed.
    for (let i = 1; i <= 29; i++)
      panel.sample({ now: 1000 + (i * 1000) / 60, pendingFrames: 0, frames: 7 + i, skipped: 2 });
    assert.match(panel.element.textContent, /^webgl2\nfps 0\.0/);
    panel.sample({ now: 1000 + (29 * 1000) / 60 + 40, frames: 37, skipped: 3 });
    assert.deepEqual(panel.snapshot(), {
      fps: Math.round((10000 * 30) / ((29 * 1000) / 60 + 40)) / 10,
      longestFrameMs: 40,
      commands: 3,
      triangles: 14,
      geometries: 1,
      pages: 1,
      pendingFrames: 0,
      frames: 37,
      skipped: 3
    });
    assert.match(
      panel.element.textContent,
      /^webgl2\nfps 57\.\d  longest 40\.0 ms\ncommands 3  triangles 14\ngeometries 1  pages 1\npending 0  drawn 37  skipped 3$/
    );
    assert.ok(Object.isFrozen(panel.snapshot()));
  } finally {
    scope.dispose();
    await engine.dispose();
  }
  // What was not told shows a dash, and a panel without a label has no first line.
  const bare = createBrowserStatsPanel({ canvas });
  bare.sample({ now: 5 });
  assert.equal(
    bare.element.textContent,
    'fps 0.0  longest 0.0 ms\ncommands -  triangles -\ngeometries -  pages -\npending -  drawn -  skipped -'
  );
  // Disposed, it leaves the page and takes no more samples.
  bare.dispose();
  bare.dispose();
  bare.sample({ now: 9000 });
  assert.equal(body.children.length, 1);
  panel.dispose();
  assert.equal(body.children.length, 0);
});

test('BG03 what is not a panel or a sample is refused', () => {
  const { canvas } = page();
  for (const bad of [
    undefined,
    null,
    {},
    { canvas: {} },
    { canvas: { ...canvas, ownerDocument: {} } },
    { canvas, label: 5 },
    { canvas, intervalMs: 50 },
    { canvas, intervalMs: NaN }
  ])
    assert.throws(() => createBrowserStatsPanel(bad), coded('BROWSER_STATS_OPTIONS_INVALID'));
  const panel = createBrowserStatsPanel({ canvas });
  assert.throws(() => panel.sample(null), coded('BROWSER_STATS_OPTIONS_INVALID'));
  assert.throws(() => panel.sample({ now: NaN }), coded('BROWSER_STATS_OPTIONS_INVALID'));
  panel.dispose();
});

test('BG04 a strict consumer compiles against the entry with the calls a game makes, and seven misuses are refused', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '--project', 'tests/types/game.json', '--pretty', 'false'],
    { cwd: new URL('..', import.meta.url), encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

// Break caught: tell no one of an error the Engine can only report, such as the listener that ended pointer input.
test('BG05 an error the Engine reports is told as a failure of the loop is, and a warning is not', async () => {
  const { gameDiagnostics } = await import('../packages/engine/dist/web/BrowserGame.js');
  const told = [],
    cause = new egret.EgretError('POINTER_INPUT_CALLBACK_FAILED');
  const handler = gameDiagnostics(error => told.push(error));
  handler({ code: 'POINTER_INPUT_HOST_FAILED', phase: 'engine', severity: 'error', cause });
  handler({ code: 'SOMETHING_SLOW', phase: 'engine', severity: 'warning', cause: new Error('slow') });
  handler({ code: 'ENGINE_CLOSE_FAILED', phase: 'engine', severity: 'error' });
  assert.equal(told.length, 2);
  assert.equal(told[0], cause);
  assert.ok(told[1] instanceof egret.EgretError && told[1].code === 'ENGINE_CLOSE_FAILED');
  // Without onError it goes to the page: reportError where there is one, else a promise that nothing handles.
  const page = [],
    before = globalThis.reportError;
  globalThis.reportError = error => page.push(error);
  try {
    gameDiagnostics(undefined)({ code: 'POINTER_INPUT_HOST_FAILED', phase: 'engine', severity: 'error', cause });
    gameDiagnostics(undefined)({ code: 'SOMETHING_SLOW', phase: 'engine', severity: 'warning' });
  } finally {
    globalThis.reportError = before;
  }
  assert.deepEqual(page, [cause]);
});
