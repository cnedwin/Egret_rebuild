// SPDX-License-Identifier: Apache-2.0
// Native World3D marker layout over genuine engine display trees. The canvas
// rectangles are a controlled browser port; the paired browser fixture checks the actual DOM/SDK.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngine, DisplayObjectContainer, Sprite } from '@egret/engine';
import { createPerspectiveCamera3D, Object3D, projectToViewport3D } from '@egret/engine/world3d';
import * as webgl2 from '@egret/engine/webgl2/world3d';
import * as webgpu from '@egret/engine/webgpu/world3d';
import { host } from './helpers.mjs';

const close = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
async function fixture(t) {
  const engine = await createEngine({ host: host().adapter }),
    scope = engine.createScope();
  t.after(() => engine.dispose());
  const camera = createPerspectiveCamera3D({ fov: 90, near: 0.1, far: 100 });
  camera.aspect = 2;
  let sceneRect = rect(36, 24, 800, 400),
    overlayRect = sceneRect;
  let screen = { width: 800, height: 400, safe: { x: 40, y: 20, width: 720, height: 360 } };
  const sceneCanvas = { getBoundingClientRect: () => sceneRect };
  const overlay = {
    canvas: { getBoundingClientRect: () => overlayRect },
    game: {
      stage: engine.stage,
      scope,
      get screen() {
        return screen;
      }
    }
  };
  const resize = (scene, next, s) => {
    sceneRect = scene;
    overlayRect = next;
    screen = s;
    camera.aspect = scene.width / scene.height;
  };
  const make = (x = -10, y = -5, w = 20, h = 10) => {
    const s = scope.use(new Sprite());
    s.graphics.beginFill(0x55ffaa).drawRect(x, y, w, h).endFill();
    return s;
  };
  const layer = webgl2.createOverlayScreenMarkers3D({ overlay, sceneCanvas, camera });
  return { engine, scope, sceneCanvas, overlay, camera, resize, make, layer };
}

test('NM01 native marker factory and type-compatible entry are shared by the two browser backends', () => {
  assert.equal(typeof webgl2.createOverlayScreenMarkers3D, 'function');
  assert.equal(webgpu.createOverlayScreenMarkers3D, webgl2.createOverlayScreenMarkers3D);
});

test('NM02 a borrowed native display follows the same projection and never steals input, even with interactive children', async t => {
  const { engine, scope, camera, make, layer } = await fixture(t);
  const under = make(0, 0, 30, 30);
  under.x = 385;
  under.y = 185;
  under.touchEnabled = true;
  under.hitArea = { x: 0, y: 0, width: 30, height: 30 };
  engine.stage.addChild(under);
  const display = scope.use(new DisplayObjectContainer()),
    child = make(-10, -5, 20, 10);
  child.touchEnabled = true;
  child.hitArea = { x: -10, y: -5, width: 20, height: 10 };
  display.addChild(child);
  display.touchEnabled = true;
  display.x = 7;
  display.y = 9;
  const hero = new Object3D();
  hero.setPosition(0, 0, -10);
  const marker = layer.add(display, { target: hero, offset: [0, 0, 0] });
  layer.update();
  const expected = projectToViewport3D(camera, [0, 0, -10], 800, 400);
  assert.ok(marker.visible && close(marker.point.x, expected.x) && close(marker.point.y, expected.y));
  const a = child.localToGlobal(-10, -5),
    b = child.localToGlobal(10, 5);
  assert.ok(
    close((a.x + b.x) / 2, expected.x) && close((a.y + b.y) / 2, expected.y),
    'the measured extent is centered, not the display origin'
  );
  assert.equal(
    engine.stage.hitTest(400, 200),
    under,
    'native marker root admits no pointer, even when descendants were interactive'
  );
  assert.equal(display.x, 7);
  assert.equal(display.y, 9);
  assert.equal(child.touchEnabled, true);
  marker.dispose();
  assert.equal(display.parent, undefined);
  assert.equal(display.isDisposed, false);
  assert.equal(layer.markers.length, 0);
  assert.equal(display.x, 7);
  assert.equal(display.y, 9);
  layer.dispose();
});

test('NM03 asymmetric safe margins, extent and anchor keep every marker footprint in the live safe rectangle', async t => {
  const { make, layer } = await fixture(t);
  const m = layer.add(make(), {
    target: [50, 0, -10],
    clampToEdge: true,
    area: 'safe',
    margin: { left: 4, top: 12, right: 30, bottom: 8 },
    extent: { width: 60, height: 20 }
  });
  layer.update();
  assert.equal(m.onEdge, true);
  assert.ok(m.visible);
  assert.ok(close(m.point.x, 700), 'safe right 760 - right margin30 - half extent30');
  assert.ok(close(m.point.y, 200));
  m.retarget([0, 0, 10]);
  layer.update();
  assert.ok(close(m.point.y, 362), 'straight behind clamps down, respecting bottom margin and footprint');
  const screenMarker = layer.add(make(), {
    target: [50, 0, -10],
    clampToEdge: true,
    area: 'screen',
    anchor: { x: 1, y: 0.5 }
  });
  layer.update();
  assert.ok(close(screenMarker.point.x, 800), 'right edge anchored to the full screen');
  const clipped = layer.add(make(), { target: [17.95, 0, -10], area: 'safe' });
  layer.update();
  assert.equal(clipped.visible, false, 'an otherwise on-screen point may not put its label under the safe edge');
  const huge = layer.add(make(), { target: [0, 0, -10], extent: { width: 2000, height: 20 }, clampToEdge: true });
  layer.update();
  assert.equal(huge.visible, false, 'no feasible anchor, not an inverted clamp');
});

test('NM04 live containment/cropping and different axis ratios map scene CSS projection into stage units', async t => {
  const { resize, make, layer } = await fixture(t);
  resize(rect(36, 24, 800, 400), rect(236, 24, 400, 400), {
    width: 200,
    height: 400,
    safe: { x: 0, y: 0, width: 200, height: 400 }
  });
  const marker = layer.add(make(), { target: [5, 0, -10], area: 'screen' });
  layer.update();
  // Scene x = 500, overlay left is 200 CSS px within that scene, and X scale is 2px/unit.
  assert.ok(close(marker.point.x, 150) && close(marker.point.y, 200));
  resize(rect(36, 24, 400, 800), rect(36, -176, 400, 1200), {
    width: 400,
    height: 600,
    safe: { x: 0, y: 0, width: 400, height: 600 }
  });
  marker.retarget([0, 0, -10]);
  layer.update();
  assert.ok(close(marker.point.x, 200) && close(marker.point.y, 300));
  const edge = layer.add(make(), { target: [0, 100, -10], area: 'screen', margin: { top: 20 }, clampToEdge: true });
  layer.update();
  // The overlay extends beyond the scene. Its visible top is logical Y=100,
  // 20 CSS px converts to 10 units, then the height of the marker adds 5.
  assert.ok(close(edge.point.y, 115));
});

test('NM05 pooled marker retargeting, enable/hide and overlay scope cancellation leave borrowed display ownership intact', async t => {
  const { engine, scope, make, layer } = await fixture(t);
  const pool = Array.from({ length: 44 }, (_, i) => layer.add(make(), { target: [i % 5, 0, -10] }));
  layer.update();
  assert.equal(layer.markers.length, 44);
  const first = pool[0],
    display = first.display,
    holder = display.parent;
  first.setVisible(false);
  layer.update();
  assert.equal(first.visible, false);
  first.retarget([0, 2, -10]);
  first.setVisible(true);
  layer.update();
  assert.ok(first.visible && first.point.y < 200);
  assert.equal(first.display.parent, holder);
  first.retarget([0, 0, -90]);
  const far = layer.add(make(), { target: [0, 0, -90], maxDistance: 50 });
  const behind = layer.add(make(), { target: [0, 0, 10] });
  layer.update();
  assert.equal(far.visible, false);
  assert.equal(behind.visible, false);
  // A marker layer borrows its displays: manual removal retires the holder, not the display.
  first.dispose();
  assert.equal(display.isDisposed, false);
  assert.equal(display.parent, undefined);
  const scope2 = engine.createScope(),
    borrowed = scope2.use(new Sprite());
  borrowed.graphics.beginFill(0xffffff).drawRect(0, 0, 12, 12).endFill();
  const keep = layer.add(borrowed, { target: [0, 0, -10] });
  scope.dispose();
  assert.equal(layer.markers.length, 0);
  assert.equal(borrowed.isDisposed, false);
  assert.equal(borrowed.parent, undefined);
  keep.dispose();
  layer.dispose();
  layer.update();
  assert.throws(() => layer.add(borrowed, { target: [0, 0, -10] }), { code: 'WORLD3D_INPUT_INVALID' });
  scope2.dispose();
});

test('NM06 invalid options, duplicate/attached displays, foreign engine ownership and explicit retirement are safe', async t => {
  const { engine, make, layer } = await fixture(t),
    node = make();
  assert.throws(() => layer.add(node, { target: [0, 0, -10], margin: { right: -1 } }), {
    code: 'WORLD3D_INPUT_INVALID'
  });
  assert.throws(() => layer.add(node, { target: [0, 0, -10], anchor: { x: 2, y: 0 } }), {
    code: 'WORLD3D_INPUT_INVALID'
  });
  assert.throws(() => layer.add(node, { target: [NaN, 0, -1] }), { code: 'WORLD3D_INPUT_INVALID' });
  assert.equal(node.parent, undefined);
  const m = layer.add(node, { target: [0, 0, -10] });
  assert.throws(() => layer.add(node, { target: [0, 0, -10] }), { code: 'WORLD3D_INPUT_INVALID' });
  const other = make();
  engine.stage.addChild(other);
  assert.throws(() => layer.add(other, { target: [0, 0, -10] }), { code: 'WORLD3D_INPUT_INVALID' });
  const foreign = await createEngine({ host: host().adapter });
  t.after(() => foreign.dispose());
  const bad = foreign.createScope().use(new Sprite());
  assert.throws(() => layer.add(bad, { target: [0, 0, -10] }));
  assert.equal(bad.parent, undefined);
  assert.equal(bad.isDisposed, false);
  const external = make();
  engine.stage.addChild(external);
  const parent = new DisplayObjectContainer();
  engine.stage.addChild(parent);
  parent.addChild(node); // The caller owns this now; the marker retires on the next update.
  layer.update();
  assert.equal(layer.markers.length, 0);
  assert.equal(node.parent, parent);
  m.dispose();
  assert.equal(node.isDisposed, false);
});

test('NM07 direct Engine close leaves Stage/Scope cleanup authoritative without a closed-engine detach failure', async t => {
  const { engine, make, layer } = await fixture(t);
  const borrowed = make();
  const marker = layer.add(borrowed, { target: [0, 0, -10] });
  layer.update();
  assert.equal(marker.visible, true);
  await engine.dispose();
  assert.equal(layer.markers.length, 0);
  assert.equal(borrowed.isDisposed, true);
  assert.equal(borrowed.parent, undefined);
  marker.dispose();
  layer.dispose();
  layer.update();
});
