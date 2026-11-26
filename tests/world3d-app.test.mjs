// SPDX-License-Identifier: Apache-2.0
// The one-call World3D start: quality and backend choice, the quality presets
// and the drawing resolution that follows the frame rate. The renderer itself
// is exercised in a browser by examples/world3d-app.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine } from '@egret/engine';
import * as webgl2 from '@egret/engine/webgl2/world3d';
import * as webgpu from '@egret/engine/webgpu/world3d';
import { host } from './helpers.mjs';

const { WORLD3D_QUALITY_PRESETS, createDynamicResolution3D, createWorld3DApp, pickWorld3DBackend, pickWorld3DQuality } =
  webgl2;

test('WA01 both backend entries give the same app functions', () => {
  for (const name of ['createWorld3DApp', 'createDynamicResolution3D', 'pickWorld3DQuality', 'pickWorld3DBackend'])
    assert.equal(webgpu[name], webgl2[name], name);
  assert.equal(webgpu.WORLD3D_QUALITY_PRESETS, WORLD3D_QUALITY_PRESETS);
});

test('WA02 quality comes from the address, then a stored choice, then the device', () => {
  const desktop = { coarsePointer: false, shortSide: 900, deviceMemory: 16 };
  assert.equal(pickWorld3DQuality({ ...desktop, query: '?quality=low' }), 'low');
  assert.equal(
    pickWorld3DQuality({ ...desktop, query: new URLSearchParams('quality=medium'), stored: 'low' }),
    'medium'
  );
  assert.equal(pickWorld3DQuality({ ...desktop, query: '?quality=ultra', stored: 'low' }), 'low');
  assert.equal(pickWorld3DQuality({ ...desktop, query: '' }), 'high');
  assert.equal(pickWorld3DQuality({ ...desktop, query: '', coarsePointer: true }), 'low');
  assert.equal(pickWorld3DQuality({ ...desktop, query: '', shortSide: 420 }), 'low');
  assert.equal(pickWorld3DQuality({ ...desktop, query: '', deviceMemory: 4 }), 'medium');
  // Software rendering takes the lowest quality, unless the address or the player asked otherwise.
  assert.equal(pickWorld3DQuality({ ...desktop, query: '', softwareRenderer: true }), 'low');
  assert.equal(pickWorld3DQuality({ ...desktop, query: '?quality=high', softwareRenderer: true }), 'high');
  assert.equal(pickWorld3DQuality({ ...desktop, query: '', stored: 'medium', softwareRenderer: true }), 'medium');
  // The renderer's name is asked of a throwaway context; a page without WebGL is not software rendered.
  const { isSoftwareRendered3D } = webgl2;
  const page = name => ({
    createElement: () => ({
      getContext: () => ({
        RENDERER: 1,
        getExtension: ext => (ext === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 2 } : null),
        getParameter: key => (key === 2 ? name : 'WebKit WebGL')
      })
    })
  });
  assert.equal(
    isSoftwareRendered3D(page('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0)), SwiftShader driver)')),
    true
  );
  assert.equal(isSoftwareRendered3D(page('llvmpipe (LLVM 15.0.7, 256 bits)')), true);
  assert.equal(isSoftwareRendered3D(page('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)')), false);
  assert.equal(isSoftwareRendered3D({ createElement: () => ({ getContext: () => null }) }), false);
  assert.equal(
    isSoftwareRendered3D({
      createElement: () => {
        throw new Error('no DOM');
      }
    }),
    false
  );
});

test('WA03 the backend comes from the address, WebGL2 otherwise', () => {
  assert.equal(pickWorld3DBackend('?backend=webgpu'), 'webgpu');
  assert.equal(pickWorld3DBackend('?backend=webgl2', 'webgpu'), 'webgl2');
  assert.equal(pickWorld3DBackend('?backend=vulkan'), 'webgl2');
  assert.equal(pickWorld3DBackend('', 'webgpu'), 'webgpu');
});

test('WA04 presets rise from low to high and are frozen', () => {
  const { low, medium, high } = WORLD3D_QUALITY_PRESETS;
  assert.ok(Object.isFrozen(WORLD3D_QUALITY_PRESETS) && Object.isFrozen(low) && Object.isFrozen(high));
  assert.deepEqual([low.shadows, low.post, low.antialias], [false, false, false]);
  assert.ok(low.pixelRatio < medium.pixelRatio && medium.pixelRatio < high.pixelRatio);
  assert.deepEqual([medium.ssao, high.ssao], [false, true]);
});

test('WA05 the resolution goes down after slow frames and back up slowly after fast ones', () => {
  const resolution = createDynamicResolution3D({ min: 0.55, step: 0.15, downAfter: 1, upAfter: 3 });
  assert.equal(resolution.scale, 1);
  // Two seconds at 20 frames a second.
  for (let i = 0; i < 40; i++) resolution.update(0.05);
  assert.ok(resolution.scale < 1);
  for (let i = 0; i < 200; i++) resolution.update(0.05);
  assert.equal(resolution.scale, 0.55);
  // A hidden tab's gap and a zero frame change nothing.
  resolution.update(5);
  resolution.update(0);
  assert.equal(resolution.scale, 0.55);
  // At 60 frames a second the smoothed rate recovers in about two seconds, then the share climbs one step per three.
  for (let i = 0; i < 60 * 5; i++) resolution.update(1 / 60);
  const once = resolution.scale;
  assert.ok(once > 0.55 && once < 1);
  for (let i = 0; i < 60 * 20; i++) resolution.update(1 / 60);
  assert.equal(resolution.scale, 1);
  resolution.update(0.05);
  resolution.reset();
  assert.equal(resolution.scale, 1);
  for (const bad of [{ min: 0 }, { min: 2, max: 1 }, { lowFps: 60, highFps: 50 }, { step: NaN }])
    assert.throws(() => createDynamicResolution3D(bad), { code: 'WORLD3D_INPUT_INVALID' });
});

test('WA06 bad arguments are refused before anything is made', async () => {
  await assert.rejects(createWorld3DApp(null), { code: 'WORLD3D_INPUT_INVALID' });
  await assert.rejects(createWorld3DApp({}, { backend: 'vulkan' }), { code: 'WORLD3D_INPUT_INVALID' });
  await assert.rejects(createWorld3DApp({}, { quality: 'ultra' }), { code: 'WORLD3D_INPUT_INVALID' });
});

import {
  createBoxGeometry3D,
  createGeometryBuilder3D,
  createPerspectiveCamera3D,
  createPlaneGeometry3D,
  linearColor3D,
  projectToViewport3D,
  Object3D
} from '@egret/engine/world3d';

const close = (a, b, eps = 1e-5) => Math.abs(a - b) <= eps;

test('WA07 the builder merges placed, coloured copies and leaves the parts unchanged', () => {
  const box = createBoxGeometry3D(1, 1, 1);
  const before = Float32Array.from(box.getAttribute('position').data);
  const builder = createGeometryBuilder3D()
    .add(box, { position: [10, 0, 0], color: 0xff0000 })
    .add(box, { position: [0, 5, 0], scale: [2, 1, 1], color: [0, 0, 1] })
    .add(createPlaneGeometry3D(1, 1), { rotation: [-Math.PI / 2, 0, 0], color: 0x808080 });
  assert.equal(builder.parts, 3);
  const count = box.vertexCount * 2 + 4;
  assert.equal(builder.vertexCount, count);
  const merged = builder.build();
  assert.deepEqual(Array.from(box.getAttribute('position').data), Array.from(before));
  assert.equal(merged.vertexCount, count);
  assert.equal(builder.parts, 0);
  const positions = merged.getAttribute('position').data,
    colors = merged.getAttribute('color').data;
  // The first box sits around x = 10 and is red in linear terms.
  for (let i = 0; i < box.vertexCount; i++)
    assert.ok(positions[i * 3] >= 9.5 - 1e-6 && positions[i * 3] <= 10.5 + 1e-6);
  assert.deepEqual([colors[0], colors[1], colors[2]], [1, 0, 0]);
  // The second box is twice as wide.
  const xs = [];
  for (let i = box.vertexCount; i < box.vertexCount * 2; i++) xs.push(positions[i * 3]);
  assert.ok(close(Math.max(...xs) - Math.min(...xs), 2));
  // The plane lies flat, facing up, in sRGB grey turned linear.
  const last = count - 1;
  assert.ok(close(positions[last * 3 + 1], 0));
  const normals = merged.getAttribute('normal').data;
  assert.ok(close(normals[last * 3 + 1], 1));
  assert.ok(close(colors[last * 3], linearColor3D(0x808080)[0]));
  assert.ok(merged.getAttribute('uv'));
  assert.equal(merged.index.count, box.index.count * 2 + 6);
  assert.ok(Math.max(...merged.index.data) === count - 1);
  assert.throws(() => builder.build(), { code: 'WORLD3D_INPUT_INVALID' });
  assert.throws(() => builder.add(box, { color: 'red' }), { code: 'WORLD3D_INPUT_INVALID' });
  assert.throws(() => builder.add({}, {}), { code: 'WORLD3D_INPUT_INVALID' });
});

test('WA08 a mirrored part keeps its triangles facing out', () => {
  const box = createBoxGeometry3D(1, 1, 1);
  const plain = createGeometryBuilder3D().add(box).build(),
    mirrored = createGeometryBuilder3D()
      .add(box, { scale: [-1, 1, 1] })
      .build();
  const p = plain.index.data,
    m = mirrored.index.data;
  assert.deepEqual([m[0], m[1], m[2]], [p[0], p[2], p[1]]);
  assert.deepEqual(linearColor3D(0xffffff), [1, 1, 1]);
  assert.throws(() => linearColor3D(0x1000000), { code: 'WORLD3D_INPUT_INVALID' });
});

test('WA09 world points project into the viewport; points behind keep their side', () => {
  const camera = createPerspectiveCamera3D({ fov: 90, near: 0.1, far: 100 });
  camera.aspect = 2;
  camera.setPosition(0, 0, 0);
  camera.updateViewMatrices();
  const centre = projectToViewport3D(camera, [0, 0, -10], 800, 400);
  assert.ok(close(centre.x, 400) && close(centre.y, 200) && centre.onScreen && centre.inFront);
  const right = projectToViewport3D(camera, [5, 0, -10], 800, 400);
  assert.ok(right.x > 400 && right.onScreen);
  const behindLeft = projectToViewport3D(camera, [-5, 0, 10], 800, 400);
  assert.equal(behindLeft.inFront, false);
  assert.equal(behindLeft.onScreen, false);
  assert.ok(behindLeft.x < 400);
  const off = projectToViewport3D(camera, [100, 0, -10], 800, 400);
  assert.equal(off.onScreen, false);
  assert.equal(off.inFront, true);
  assert.throws(() => projectToViewport3D(camera, [0, 0, 0], 0, 400), { code: 'WORLD3D_INPUT_INVALID' });
});

// A container and elements with just what the marker layer touches.
function fakeElement() {
  return {
    parentNode: null,
    hidden: false,
    style: {},
    dataset: {},
    remove() {
      this.removed = true;
    }
  };
}

test('WA10 markers follow nodes, cling to the edge off screen and hide behind without clamping', () => {
  const { createScreenMarkers3D } = webgl2;
  const children = [];
  const container = {
    clientWidth: 800,
    clientHeight: 400,
    appendChild(element) {
      element.parentNode = this;
      children.push(element);
    }
  };
  const camera = createPerspectiveCamera3D({ fov: 90, near: 0.1, far: 100 });
  camera.aspect = 2;
  const hero = new Object3D();
  hero.setPosition(0, 0, -10);
  const layer = createScreenMarkers3D({ container, camera });
  const name = layer.add(fakeElement(), { target: hero, offset: [0, 1, 0] });
  const goal = layer.add(fakeElement(), { target: [50, 0, 10], clampToEdge: true, margin: 20 });
  const lost = layer.add(fakeElement(), { target: [0, 0, 10] });
  const far = layer.add(fakeElement(), { target: [0, 0, -90], maxDistance: 50 });
  layer.update();
  assert.equal(children.length, 4);
  assert.equal(name.element.hidden, false);
  assert.ok(name.point.y < 200, 'the label sits above the centre');
  assert.match(name.element.style.transform, /^translate\(400\.0px, \d+\.\dpx\)$/);
  assert.equal(goal.onEdge, true);
  assert.equal('onEdge' in goal.element.dataset, true);
  assert.ok(close(goal.point.x, 780), 'clamped to the right edge');
  assert.equal(lost.element.hidden, true);
  assert.equal(far.element.hidden, true);
  hero.setPosition(30, 0, -10);
  layer.update();
  assert.ok(name.point.x > 400);
  name.dispose();
  assert.equal(name.element.removed, true);
  assert.equal(layer.markers.length, 3);
  layer.dispose();
  assert.equal(layer.markers.length, 0);
});

test('WA11 the stats readout averages frame parts and reads the renderer', () => {
  const { createWorld3DStats } = webgl2;
  const info = { drawCalls: 12, triangles: 3400, lightsDropped: 2, programs: 5, geometries: 7, textures: 3 };
  const stats = createWorld3DStats({ info });
  stats.begin();
  stats.lap('rules');
  stats.lap('view');
  stats.end();
  stats.begin();
  stats.end();
  assert.equal(stats.drawCalls, 12);
  assert.equal(stats.triangles, 3400);
  assert.ok('rules' in stats.average && 'view' in stats.average);
  assert.throws(() => stats.lap('frame'), { code: 'WORLD3D_INPUT_INVALID' });
  assert.throws(() => createWorld3DStats({}), { code: 'WORLD3D_INPUT_INVALID' });
  stats.dispose();
});

test('WA12 restarting the display loop anchors the same Engine clock on its first frame', async t => {
  const engine = await createEngine({ host: host().adapter, clock: { maxDeltaSeconds: 0.125 } });
  let next;
  const frames = {
    requestAnimationFrame(callback) {
      next = callback;
      return 1;
    },
    cancelAnimationFrame() {
      next = undefined;
    }
  };
  for (const [name, value] of Object.entries(frames)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, configurable: true });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else delete globalThis[name];
    });
  }
  const present = milliseconds => {
    const callback = next;
    assert.ok(callback, 'a frame must be scheduled');
    callback(milliseconds);
  };
  const errors = [];
  const start = () => webgl2.startWorld3DLoop(engine, error => errors.push(error.code));
  let loop = start();
  try {
    present(0);
    present(16);
    const before = engine.clock.elapsedSeconds;
    loop.dispose();
    assert.equal(next, undefined);
    loop = start();
    present(5000);
    assert.deepEqual(errors, []);
    assert.equal(engine.clock.elapsedSeconds, before);
    present(5016);
    assert.ok(close(engine.clock.elapsedSeconds - before, 0.016));
    const pausedAt = engine.clock.elapsedSeconds;
    loop.dispose();
    engine.clock.pause();
    loop = start();
    present(10000);
    assert.equal(engine.clock.state, 'paused');
    assert.equal(engine.clock.elapsedSeconds, pausedAt);
    assert.deepEqual(errors, []);
  } finally {
    loop.dispose();
    await engine.dispose();
  }
});
