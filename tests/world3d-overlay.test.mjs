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

test('OV02 a fit other than stretch, contain or cover is refused before anything is made', async () => {
  const placed = { getBoundingClientRect: () => ({}), parentElement: {} };
  await assert.rejects(webgl2.createWorld3DOverlay(placed, { width: 640, height: 360, fit: 'fill' }), {
    code: 'WORLD3D_OVERLAY_OPTIONS_INVALID'
  });
});
