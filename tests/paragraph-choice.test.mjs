// SPDX-License-Identifier: Apache-2.0
// chooseParagraphProvider of @egret/engine/web/paragraph: which provider a device is given, that CanvasKit is loaded
// only when it is chosen, and that a CanvasKit that fails to load leaves the canvas provider in its place. The device
// is stated through the device option, so no global is replaced.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chooseParagraphProvider } from '@egret/engine/web/paragraph';

// A canvas whose context measures every character ten wide.
const createCanvas = () => {
  const context = {
    font: '10px sans-serif',
    fillStyle: '#000',
    textBaseline: 'alphabetic',
    textAlign: 'left',
    measureText: text => ({ width: [...text].length * 10 }),
    fillText() {},
    setTransform() {},
    clearRect() {},
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
  };
  return { width: 0, height: 0, getContext: () => context };
};
const canvas = { createCanvas };
const never = () => {
  throw new Error('CanvasKit was loaded');
};

// Break caught: CanvasKit loaded on a device that cannot run it, or downloaded when the canvas provider was chosen.
test('PCH01 a device without WebAssembly, a mini game and a small memory are given the canvas provider', async () => {
  for (const [device, reason] of [
    [{ webAssembly: false }, 'no-webassembly'],
    [{ webAssembly: true, miniGame: true }, 'mini-game'],
    [{ webAssembly: true, miniGame: false, deviceMemory: 2 }, 'low-memory']
  ]) {
    const choice = await chooseParagraphProvider({ loadCanvasKit: never, canvas, device });
    assert.equal(choice.backend, 'canvas');
    assert.equal(choice.reason, reason);
    assert.match(choice.provider.identity, /^egret\.canvas-paragraph\.v1:/);
    choice.provider.dispose();
  }
  let choice = await chooseParagraphProvider({ canvas });
  assert.deepEqual([choice.backend, choice.reason], ['canvas', 'no-loader']);
  choice = await chooseParagraphProvider({ prefer: 'canvas', loadCanvasKit: never, canvas });
  assert.deepEqual([choice.backend, choice.reason], ['canvas', 'asked']);
  await assert.rejects(chooseParagraphProvider({ prefer: 'canvaskit', canvas }), { code: 'PARAGRAPH_REQUEST_INVALID' });
  await assert.rejects(chooseParagraphProvider({ prefer: 'webgl', canvas }), { code: 'PARAGRAPH_REQUEST_INVALID' });
});

// Break caught: a CanvasKit that fails to load stopping the game instead of leaving the canvas provider.
test('PCH02 a CanvasKit that fails to load leaves the canvas provider, with the cause', async () => {
  const failure = new Error('no wasm here');
  const choice = await chooseParagraphProvider({
    loadCanvasKit: async () => {
      throw failure;
    },
    canvas,
    device: { webAssembly: true, miniGame: false, deviceMemory: 8 }
  });
  assert.deepEqual([choice.backend, choice.reason], ['canvas', 'load-failed']);
  assert.equal(choice.cause, failure);
  // Asked for by name, the failure is the caller's to see.
  await assert.rejects(
    chooseParagraphProvider({ prefer: 'canvaskit', loadCanvasKit: async () => Promise.reject(failure), canvas }),
    error => error === failure
  );
});

// Break caught: a device that can afford CanvasKit not given it.
test('PCH03 a device with WebAssembly and memory is given CanvasKit', async t => {
  const vendor = new URL('../examples/paragraph-panel/vendor/', import.meta.url);
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', vendor), 'utf8'));
  const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'egret-paragraph-choice-'));
  t.after(() => fs.rmSync(temporary, { recursive: true }));
  const glue = path.join(temporary, 'canvaskit.cjs');
  fs.copyFileSync(new URL(manifest.runtime.glue, vendor), glue);
  let loads = 0;
  const choice = await chooseParagraphProvider({
    loadCanvasKit: async () => {
      loads++;
      const canvasKit = await createRequire(import.meta.url)(glue)({
        locateFile: () => fileURLToPath(new URL(manifest.runtime.wasm, vendor))
      });
      const row = manifest.fonts[0];
      return {
        canvasKit,
        buildIdentity: manifest.runtime.buildIdentity,
        fonts: [{ family: row.family, identity: row.sha256, data: fs.readFileSync(new URL(row.path, vendor)) }]
      };
    },
    canvas: { createCanvas: never },
    device: { webAssembly: true, miniGame: false, deviceMemory: 8 }
  });
  t.after(() => choice.provider.dispose());
  assert.deepEqual([choice.backend, choice.reason, loads], ['canvaskit', 'loaded', 1]);
  assert.equal(choice.provider.capabilities.textGeometry, true);
});
