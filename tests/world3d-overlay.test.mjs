// SPDX-License-Identifier: Apache-2.0
// The 2D interface over a World3D canvas refuses a canvas it cannot lay itself
// over. Drawing and the routing of presses are checked in a browser.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as webgl2 from '@egret/engine/webgl2/world3d';
import * as webgpu from '@egret/engine/webgpu/world3d';

test('OV01 both backends export the overlay, and bad arguments are refused', async () => {
  assert.equal(webgl2.createWorld3DOverlay, webgpu.createWorld3DOverlay);
  const canvas = { getBoundingClientRect: () => ({}), parentElement: null };
  await assert.rejects(webgl2.createWorld3DOverlay(canvas, { width: 640, height: 360 }), {
    code: 'WORLD3D_OVERLAY_OPTIONS_INVALID'
  });
  await assert.rejects(webgl2.createWorld3DOverlay(null, { width: 640, height: 360 }), {
    code: 'WORLD3D_OVERLAY_OPTIONS_INVALID'
  });
  const placed = { getBoundingClientRect: () => ({}), parentElement: {} };
  await assert.rejects(webgl2.createWorld3DOverlay(placed, { width: 0, height: 360 }), {
    code: 'WORLD3D_OVERLAY_OPTIONS_INVALID'
  });
});

test('OV02 a fit the overlay does not have is refused before anything is made', async () => {
  const placed = { getBoundingClientRect: () => ({}), parentElement: {} };
  await assert.rejects(webgl2.createWorld3DOverlay(placed, { width: 640, height: 360, fit: 'fill' }), {
    code: 'WORLD3D_OVERLAY_OPTIONS_INVALID'
  });
});

// Break caught: a portrait size or insets given with a fit whose stage never changes, which would do nothing.
test('OV03 portrait and insets go with a fit that fills the 3D canvas, and the fixed modes are fits', async () => {
  const placed = { getBoundingClientRect: () => ({}), parentElement: {} };
  for (const fit of [undefined, 'stretch', 'contain', 'cover'])
    await assert.rejects(
      webgl2.createWorld3DOverlay(placed, { width: 640, height: 360, fit, portrait: { width: 360, height: 640 } }),
      error => error.code === 'WORLD3D_OVERLAY_OPTIONS_INVALID' && /fills the 3D canvas/.test(String(error.cause))
    );
  await assert.rejects(
    webgl2.createWorld3DOverlay(placed, {
      width: 640,
      height: 360,
      fit: 'contain',
      insets: { top: 10, right: 0, bottom: 0, left: 0 }
    }),
    { code: 'WORLD3D_OVERLAY_OPTIONS_INVALID' }
  );
  // A fit that fills the canvas is taken: what fails is the stand-in canvas, which has no page to lay an element in.
  for (const fit of ['expand', 'fixedWidth', 'fixedHeight', 'fixedNarrow', 'fixedWide'])
    await assert.rejects(
      webgl2.createWorld3DOverlay(placed, { width: 640, height: 360, fit }),
      error => error.code !== 'WORLD3D_OVERLAY_OPTIONS_INVALID'
    );
});
