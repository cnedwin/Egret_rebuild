// SPDX-License-Identifier: Apache-2.0
// Built public entry: the attached companion rejects ambiguous ownership before opening a page.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as webgl2 from '@egret/engine/webgl2/world3d';
import * as webgpu from '@egret/engine/webgpu/world3d';

test('Attached Play3D is shared by both explicit World3D browser backends', () => {
  assert.equal(typeof webgl2.play3dAttached, 'function');
  assert.equal(webgl2.play3dAttached, webgpu.play3dAttached);
});

test('Attached Play3D refuses invalid factories and setup before touching a page', async () => {
  const { play3dAttached } = webgl2;
  for (const options of [
    null,
    {},
    { width: 128, height: 96, world: 2 },
    { width: 128, height: 96, world() {}, setup: 2 }
  ])
    await assert.rejects(play3dAttached(options), { code: 'PLAY_OPTIONS_INVALID' });
});

test('Attached Play3D validates the Play timing callback before touching a page', async () => {
  await assert.rejects(
    webgl2.play3dAttached({ width: 128, height: 96, world() {}, onFrameTiming: 7 }),
    error => error.code === 'PLAY_OPTIONS_INVALID' && /onFrameTiming/.test(error.message)
  );
});
