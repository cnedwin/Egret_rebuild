// SPDX-License-Identifier: Apache-2.0
// Height fields, chunked terrain, the terrain collision shape, the water
// surface's wave formula and the mirror camera of the World3D core. No GPU is involved.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HeightField3D, PlanarReflection3D, Scene3D, Terrain3D, World3DError, createHeightField3D, createHeightFieldFromPixels3D, createPerspectiveCamera3D,
  createPhysicsWorld3D, createStandardMaterial3D, createTerrain3D, createWater3D, createWaterMaterial3D,
} from '@egret/engine/world3d';

const code = value => error => error instanceof World3DError && error.code === value;
const close = (actual, expected, epsilon = 1e-3) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const hill = (x, z) => 6 * Math.exp(-(x * x + z * z) / 400) + Math.sin(x * 0.2) * 0.8;

test('a height field stores samples and follows its triangles', () => {
  const field = createHeightField3D({columns: 3, rows: 3, width: 2, depth: 2, heights: [0, 0, 0, 0, 4, 0, 0, 0, 0]});
  assert.ok(field instanceof HeightField3D);
  assert.equal(field.minHeight, 0); assert.equal(field.maxHeight, 4);
  close(field.cellWidth, 1); close(field.columnX(2), 1); close(field.rowZ(0), -1);
  close(field.heightAt(0, 0), 4);
  close(field.heightAt(-0.5, 0), 2);
  // Along the cell diagonal from the +X corner to the +Z corner the height is their blend, not the bilinear one.
  close(field.heightAt(-0.5, -0.5), 0);
  close(field.heightAt(0.5, 0.5), 0);
  close(field.heightAt(-0.25, -0.25), 2);
  // Outside the grid the nearest edge answers.
  close(field.heightAt(50, 0), 0);
  assert.equal(field.contains(0.9, -0.9), true); assert.equal(field.contains(1.1, 0), false);
  field.heights[4] = 10; field.refresh();
  assert.equal(field.maxHeight, 10); assert.equal(field.version, 3);
  const up = field.normalAt(0.999, 0.999);
  close(Math.hypot(up[0], up[1], up[2]), 1);
});

test('height fields validate their input and read image pixels', () => {
  assert.throws(() => createHeightField3D({columns: 1, rows: 4, width: 1, depth: 1}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createHeightField3D({columns: 2, rows: 2, width: 1, depth: 1, heights: [0, 0, 0]}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createHeightField3D({columns: 2, rows: 2, width: 1, depth: 1, heights: [0, 0, 0, NaN]}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createHeightField3D({columns: 5000, rows: 2, width: 1, depth: 1}), code('WORLD3D_BUDGET'));
  const data = new Uint8Array([0, 0, 0, 255, 255, 0, 0, 255, 128, 128, 0, 255, 255, 255, 0, 255]);
  const red = createHeightFieldFromPixels3D({width: 2, height: 2, data}, {width: 10, depth: 10, minHeight: -5, maxHeight: 5});
  close(red.sampleAt(0, 0), -5); close(red.sampleAt(1, 0), 5); close(red.sampleAt(0, 1), -5 + 10 * 128 / 255);
  const wide = createHeightFieldFromPixels3D({width: 2, height: 2, data}, {width: 10, depth: 10, encoding: 'rg16'});
  close(wide.sampleAt(1, 1), 1); close(wide.sampleAt(0, 1), (128 * 256 + 128) / 65535);
  assert.throws(() => createHeightFieldFromPixels3D({width: 2, height: 2, data: data.subarray(4)}, {width: 1, depth: 1}), code('WORLD3D_INPUT_INVALID'));
});

test('a ray finds the terrain surface', () => {
  const field = createHeightField3D({columns: 129, rows: 129, width: 128, depth: 128, sample: hill});
  close(field.raycast([5, 50, 5], [0, -1, 0]), 50 - field.heightAt(5, 5), 1e-3);
  const distance = field.raycast([-60, 20, 0], [0.9701425, -0.2425356, 0]);
  assert.ok(distance > 0);
  const x = -60 + 0.9701425 * distance, y = 20 - 0.2425356 * distance;
  close(y, field.heightAt(x, 0), 0.01);
  assert.equal(field.raycast([0, 20, 0], [0, 1, 0]), -1);
  assert.equal(field.raycast([5, 50, 5], [0, -1, 0], 10), -1);
  assert.equal(field.raycast([500, 50, 0], [0, -1, 0]), -1);
});

test('terrain chunks drop detail with distance and seal their borders', () => {
  const field = createHeightField3D({columns: 129, rows: 129, width: 128, depth: 128, sample: hill});
  const material = createStandardMaterial3D({});
  const terrain = createTerrain3D(field, material, {chunkCells: 32, levels: 4, lodDistance: 60, colorAt: (height, slope, x, z, out) => { out[0] = slope; out[1] = 0.5; out[2] = 0; }});
  assert.ok(terrain instanceof Terrain3D);
  assert.equal(terrain.chunkCount, 16); assert.equal(terrain.numChildren, 16);
  const camera = createPerspectiveCamera3D({});
  camera.setPosition(-60, 10, -60); camera.updateWorldMatrix();
  terrain.update(camera);
  const near = terrain.chunkLevels;
  assert.equal(near[0], 0);
  assert.ok(near[15] > near[0]);
  assert.ok(terrain.triangleCount < 128 * 128 * 2);
  camera.setPosition(0, 5000, 0); camera.updateWorldMatrix();
  terrain.update(camera);
  assert.deepEqual(terrain.chunkLevels, new Array(16).fill(3));
  terrain.lodBias = -20; terrain.update(camera);
  assert.deepEqual(terrain.chunkLevels, new Array(16).fill(0));
  // Full detail: 33 x 33 surface vertices plus four skirt strips of 33, with colors.
  const geometry = terrain.getChildAt(0).geometry;
  assert.equal(geometry.vertexCount, 33 * 33 + 4 * 33);
  assert.equal(geometry.drawCount, 32 * 32 * 6 + 4 * 32 * 6);
  assert.ok(geometry.getAttribute('color'));
  // Every surface vertex sits on the field, and skirt vertices hang below it.
  const positions = geometry.getAttribute('position').data;
  for (let i = 0; i < 33 * 33; i += 97) close(positions[i * 3 + 1], field.heightAt(positions[i * 3], positions[i * 3 + 2]), 1e-4);
  assert.ok(positions[33 * 33 * 3 + 1] < field.heightAt(positions[33 * 33 * 3], positions[33 * 33 * 3 + 2]) - 1);
  // Skirt triangles face outward: the strip on the -Z border has a normal with negative z.
  const index = geometry.index.data, start = 32 * 32 * 6;
  const corner = k => [positions[index[start + k] * 3], positions[index[start + k] * 3 + 1], positions[index[start + k] * 3 + 2]];
  const [a, b, c] = [corner(0), corner(1), corner(2)];
  assert.ok((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0);
  // Editing the field rebuilds the chunks.
  const before = field.heightAt(-64, -64);
  for (let i = 0; i < field.heights.length; i++) field.heights[i] += 2;
  field.refresh(); terrain.update(camera);
  close(terrain.getChildAt(0).geometry.getAttribute('position').data[1], before + 2, 1e-4);
  assert.equal(geometry.isDisposed, true);
  terrain.setShadows(false, true);
  assert.equal(terrain.getChildAt(3).castShadow, false);
  const other = createStandardMaterial3D({}); terrain.material = other;
  assert.equal(terrain.getChildAt(5).material, other);
  terrain.dispose();
  assert.equal(terrain.numChildren, 0);
  assert.throws(() => createTerrain3D(field, material, {chunkCells: 0}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createTerrain3D({}, material), code('WORLD3D_INPUT_INVALID'));
});

test('a chunk grid that does not divide the field still covers it', () => {
  const field = createHeightField3D({columns: 41, rows: 23, width: 40, depth: 22, sample: (x, z) => x * 0.1});
  const terrain = createTerrain3D(field, createStandardMaterial3D({}), {chunkCells: 16, levels: 3, skirtDepth: 0});
  assert.equal(terrain.chunkCount, 3 * 2);
  const camera = createPerspectiveCamera3D({}); camera.setPosition(0, 1, 0); camera.updateWorldMatrix();
  terrain.lodBias = -8; terrain.update(camera);
  assert.equal(terrain.triangleCount, 40 * 22 * 2);
  // A coarse level keeps the chunk's far edge even when the stride does not reach it.
  terrain.lodBias = 8; terrain.update(camera);
  const last = terrain.getChildAt(5).geometry.getAttribute('position').data;
  let maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < last.length; i += 3) { maxX = Math.max(maxX, last[i]); maxZ = Math.max(maxZ, last[i + 2]); }
  close(maxX, 20); close(maxZ, 11);
});

test('bodies land on the terrain collision shape and stay there', () => {
  const field = createHeightField3D({columns: 65, rows: 65, width: 128, depth: 128, sample: hill});
  const world = createPhysicsWorld3D({});
  world.createBody({type: 'static', shape: field.createShape()});
  const shapes = [{type: 'sphere', radius: 0.9}, {type: 'box', halfExtents: [0.8, 0.8, 0.8]}, {type: 'capsule', radius: 0.5, halfHeight: 0.6}];
  const bodies = [];
  for (let i = 0; i < 18; i++) {
    const x = -40 + (i * 37) % 80, z = -40 + (i * 53) % 80;
    bodies.push(world.createBody({position: [x, field.heightAt(x, z) + 5 + i * 2, z], shape: shapes[i % 3]}));
  }
  for (let step = 0; step < 900; step++) world.step(1 / 60);
  for (const body of bodies) {
    const above = body.position[1] - field.heightAt(body.position[0], body.position[2]);
    assert.ok(above > 0.3 && above < 1.6, 'body rests on the ground, got ' + above);
  }
  // A fast, large step must not push a box through the surface either.
  const fast = world.createBody({position: [0, field.heightAt(0, 0) + 30, 0], shape: shapes[1]});
  fast.setLinearVelocity(0, -40, 0);
  for (let step = 0; step < 200; step++) world.step(1 / 30);
  assert.ok(fast.position[1] > field.heightAt(fast.position[0], fast.position[2]) + 0.3);
  const hit = world.raycast([10, 100, 10], [0, -1, 0], 200);
  close(hit.distance, 100 - field.heightAt(10, 10), 0.01);
});

test('water waves follow one formula on the CPU and carry their settings', () => {
  const water = createWater3D({width: 40, depth: 40, segments: 8, amplitude: 0.5, wavelength: 10, steepness: 0, reflectionSize: 0});
  water.setPosition(0, 3, 0); water.updateWorldMatrix();
  assert.equal(water.reflection, undefined);
  assert.equal(water.geometry.vertexCount, 81);
  assert.equal(water.material.transmission, 0.85);
  assert.ok(water.material.shader.glslNormal && water.material.shader.wgslNormal && water.material.shader.glslVertex && water.material.shader.wgslVertex);
  let low = Infinity, high = -Infinity;
  for (let i = 0; i < 400; i++) { const h = water.heightAt(i * 0.37, i * 0.11); low = Math.min(low, h); high = Math.max(high, h); }
  assert.ok(high > 3.3 && high <= 3 + 0.5 * 2.01 && low < 2.7 && low >= 3 - 0.5 * 2.01);
  const before = water.heightAt(1, 2);
  water.update(0.25);
  close(water.time, 0.25);
  assert.notEqual(water.heightAt(1, 2), before);
  water.amplitude = 0;
  close(water.heightAt(1, 2), 3);
  assert.equal(water.renderReflection({render: () => true}, new Scene3D(), createPerspectiveCamera3D({})), false);
  assert.throws(() => createWaterMaterial3D({direction: [0, 0]}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createWaterMaterial3D({clarity: 2}), code('WORLD3D_INPUT_INVALID'));
  water.dispose();
  assert.equal(water.geometry.isDisposed, true);
});

test('the mirror camera reflects the viewer and cuts at the plane', () => {
  const reflection = new PlanarReflection3D({width: 64, height: 32});
  const camera = createPerspectiveCamera3D({fov: 60, aspect: 2, near: 0.1, far: 100});
  camera.setPosition(3, 5, 8).lookAt(0, 1, 0);
  const plane = [0, 1, 0, -1];   // the plane y = 1
  assert.equal(reflection.update(camera, plane), true);
  const mirror = reflection.camera;
  close(mirror.matrixWorld[12], 3); close(mirror.matrixWorld[13], -3); close(mirror.matrixWorld[14], 8);
  // A point on the plane lands at the same height on screen and at the mirrored place sideways.
  for (const point of [[0, 1, 0], [2, 1, -3], [-4, 1, 1]]) {
    const seen = camera.worldToScreenPoint([0, 0, 0], point), mirrored = mirror.worldToScreenPoint([0, 0, 0], point);
    close(mirrored[0], -seen[0], 1e-4); close(mirrored[1], seen[1], 1e-4);
  }
  // An object above the plane appears where its image under the plane is seen by the viewer.
  const image = camera.worldToScreenPoint([0, 0, 0], [1, 1 - 2.5, -2]), object = mirror.worldToScreenPoint([0, 0, 0], [1, 1 + 2.5, -2]);
  close(object[0], -image[0], 1e-4); close(object[1], image[1], 1e-4);
  // The slanted near plane: points just above the cut are inside the clip volume, points below are not.
  reflection.clipBias = 0;
  reflection.update(camera, plane);
  const depth = point => { const m = mirror.viewProjectionMatrix, w = m[3] * point[0] + m[7] * point[1] + m[11] * point[2] + m[15]; return (m[2] * point[0] + m[6] * point[1] + m[10] * point[2] + m[14]) / w; };
  close(depth([0, 1, 0]), -1, 1e-3); close(depth([2, 1, -6]), -1, 1e-3);
  assert.ok(depth([0, 1.5, 0]) > -1 && depth([0, 0.5, 0]) < -1);
  // Under the plane there is nothing to reflect.
  camera.setPosition(0, 0, 5).lookAt(0, 0, 0);
  assert.equal(reflection.update(camera, plane), false);
  assert.throws(() => reflection.update(camera, [0, 2, 0, 0]), code('WORLD3D_INPUT_INVALID'));
  // render hides what it is told to and restores it.
  camera.setPosition(0, 4, 5).lookAt(0, 1, 0);
  const scene = new Scene3D(), water = createWater3D({segments: 2, reflectionSize: 16});
  scene.addChild(water);
  let visibleDuring;
  assert.equal(water.renderReflection({render(drawn, by, target) { visibleDuring = water.visible; assert.equal(target, water.reflection.target); assert.equal(by, water.reflection.camera); return true; }}, scene, camera), true);
  assert.equal(visibleDuring, false); assert.equal(water.visible, true);
  // Post-processing is switched off for the mirror image and put back afterwards.
  const fake = {postProcess: {enabled: true}, during: undefined, render() { this.during = this.postProcess.enabled; return true; }};
  water.renderReflection(fake, scene, camera);
  assert.equal(fake.during, false); assert.equal(fake.postProcess.enabled, true);
  assert.equal(water.material.reflectionMap, water.reflection.texture);
  reflection.dispose();
  assert.equal(reflection.target.isDisposed, true);
});
