// SPDX-License-Identifier: Apache-2.0
// Height fields, chunked terrain, the terrain collision shape, the water
// surface's wave formula and the mirror camera of the World3D core. No GPU is involved.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HeightField3D, Object3D, PlanarReflection3D, Scene3D, Terrain3D, World3DError, createHeightField3D, createHeightFieldFromPixels3D, createOrthographicCamera3D, createPerspectiveCamera3D,
  TERRAIN3D_LIMITS, TerrainStream3D, Texture3D, createPhysicsWorld3D, createStandardMaterial3D, createTerrain3D, createTerrainMaterial3D, createTerrainStream3D, createWater3D, createWaterMaterial3D,
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

test('terrain rejects excessive chunk counts before building meshes', () => {
  const field = createHeightField3D({columns: 66, rows: 65, width: 65, depth: 64});
  const colorAt = () => assert.fail('geometry creation started before the chunk budget was checked');
  assert.throws(() => createTerrain3D(field, createStandardMaterial3D(), {chunkCells: 1, colorAt}), code('WORLD3D_BUDGET'));
});

test('terrain budgets the full cached LOD set before building its first mesh', () => {
  const field = createHeightField3D({columns: 1409, rows: 1409, width: 1408, depth: 1408});
  const material = createStandardMaterial3D();
  const allocationStarted = new Error('geometry creation reached');
  const colorAt = () => { throw allocationStarted; };
  const options = {chunkCells: 128, skirtDepth: 0, colorAt};
  // The fine level fits on its own; the retained two-level cache exceeds the cap.
  assert.throws(() => createTerrain3D(field, material, {...options, levels: 1}), error => error === allocationStarted);
  assert.throws(() => createTerrain3D(field, material, {...options, levels: 2}), code('WORLD3D_BUDGET'));
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

test('a terrain material blends ground layers by a weight map', () => {
  const pixel = new Texture3D({width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255])});
  const material = createTerrainMaterial3D({layers: [pixel, pixel, pixel], weights: pixel, repeat: [8, 16]});
  assert.equal(material.shading, 'standard');
  assert.equal(material.splat.layers.length, 3); assert.equal(material.splat.weights, pixel);
  assert.deepEqual([...material.splat.repeat], [8, 16, 32, 32]);
  assert.deepEqual([...createTerrainMaterial3D({layers: [pixel], weights: pixel, repeat: 5}).splat.repeat], [5, 5, 5, 5]);
  assert.throws(() => createTerrainMaterial3D({layers: [], weights: pixel}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createTerrainMaterial3D({layers: [pixel, pixel, pixel, pixel, pixel], weights: pixel}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createTerrainMaterial3D({layers: [pixel], weights: pixel, repeat: 0}), code('WORLD3D_INPUT_INVALID'));
});

test('a terrain decal is cut from the full-detail heights whatever level is shown', () => {
  const field = createHeightField3D({columns: 65, rows: 65, width: 64, depth: 64, sample: (x, z) => Math.sin(x * 0.3) * 2});
  const terrain = createTerrain3D(field, createStandardMaterial3D({}), {chunkCells: 16, levels: 4});
  terrain.setPosition(100, 5, 0);
  const camera = createPerspectiveCamera3D({}); camera.setPosition(0, 9000, 0); camera.updateWorldMatrix();
  terrain.update(camera);
  assert.deepEqual(terrain.chunkLevels, new Array(16).fill(3));
  const material = createStandardMaterial3D({});
  // The box straddles four chunks; one decal covers it.
  const decal = terrain.createDecal(material, {position: [100, 5 + field.heightAt(0, 0), 0], normal: [0, 1, 0], width: 3, height: 3, depth: 6, offset: 0});
  assert.equal(decal.parent, terrain); assert.equal(material.depthWrite, false);
  const p = decal.geometry.getAttribute('position').data;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    minX = Math.min(minX, p[i]); maxX = Math.max(maxX, p[i]); minZ = Math.min(minZ, p[i + 2]); maxZ = Math.max(maxZ, p[i + 2]);
    close(p[i + 1], field.heightAt(p[i], p[i + 2]), 1e-3);
  }
  close(minX, -1.5, 1e-3); close(maxX, 1.5, 1e-3); close(minZ, -1.5, 1e-3); close(maxZ, 1.5, 1e-3);
  assert.equal(terrain.numChildren, 17);
  assert.equal(terrain.createDecal(material, {position: [900, 0, 0], normal: [0, 1, 0]}), undefined);
  assert.equal(terrain.numChildren, 17);
});

test('streamed terrain loads tiles around the viewer and lets go of the far ones', async () => {
  const requested = [], loaded = [], unloaded = [];
  const flat = (x, z) => createHeightField3D({columns: 5, rows: 5, width: 100, depth: 100, sample: () => x * 10 + z});
  const stream = createTerrainStream3D({
    tileSize: 100, viewDistance: 120, material: createStandardMaterial3D({}), loadsPerUpdate: 3, terrain: {chunkCells: 4, levels: 2},
    load(x, z) { requested.push(x + ',' + z); return x === 1 && z === 0 ? Promise.resolve(flat(x, z)) : x < -1 ? undefined : flat(x, z); },
    onLoad: tile => loaded.push(tile.x + ',' + tile.z), onUnload: tile => unloaded.push(tile.x + ',' + tile.z),
  });
  assert.ok(stream instanceof TerrainStream3D);
  stream.update(50, 50);
  // Nearest first, and no more than the budget per update.
  assert.deepEqual(requested, ['0,0', '0,-1', '-1,0']);
  assert.equal(stream.tiles.length, 3);
  close(stream.heightAt(50, 50), 0); close(stream.heightAt(-50, 20), -10); assert.equal(stream.heightAt(150, 50), undefined);
  assert.equal(stream.tileAt(10, -10).z, -1);
  close(stream.tileAt(50, 50).terrain.position[0], 50);
  for (let i = 0; i < 6; i++) stream.update(50, 50);
  // The asynchronous tile arrives a moment later; an empty one is not asked for twice.
  assert.equal(stream.pendingCount, 1);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(stream.pendingCount, 0);
  assert.ok(loaded.includes('1,0'));
  assert.equal(requested.filter(key => key === '-2,0').length <= 1, true);
  const before = requested.length;
  stream.update(50, 50);
  assert.equal(requested.length, before);
  // Walking away drops what is behind and asks for what is ahead.
  for (let i = 0; i < 8; i++) stream.update(650, 50);
  assert.ok(unloaded.includes('0,0') && unloaded.includes('-1,0'));
  assert.ok(stream.tileAt(650, 50));
  assert.equal(stream.tileAt(50, 50), undefined);
  assert.equal(stream.numChildren, stream.tiles.length);
  stream.dispose();
  assert.equal(stream.tiles.length, 0); assert.equal(stream.numChildren, 0);
  assert.throws(() => createTerrainStream3D({tileSize: 0, viewDistance: 1, load: () => undefined, material: createStandardMaterial3D({})}), code('WORLD3D_INPUT_INVALID'));
});

function terrainRequestFixture() {
  const requests = [];
  const field = height => createHeightField3D({columns: 3, rows: 3, width: 10, depth: 10, sample: () => height});
  const load = (x, z) => new Promise((resolve, reject) => { requests.push({x, z, resolve, reject}); });
  return {requests, field, load};
}

test('a terrain request that left the visible area cannot publish over its replacement', async () => {
  for (const reject of [false, true]) {
    const {requests, field, load} = terrainRequestFixture();
    const published = [];
    const stream = createTerrainStream3D({
      tileSize: 10, viewDistance: 1, load, material: createStandardMaterial3D(),
      onLoad: tile => published.push(tile),
    });
    stream.update(5, 5);
    stream.update(105, 5);
    stream.update(5, 5);
    assert.deepEqual(requests.map(r => [r.x, r.z]), [[0, 0], [10, 0], [0, 0]]);
    if (reject) requests[0].reject(new Error('stale transport'));
    else requests[0].resolve(field(1));
    await Promise.resolve();
    assert.equal(stream.heightAt(5, 5), undefined);
    assert.equal(stream.lastFailure, undefined);

    requests[2].resolve(field(2));
    await Promise.resolve();
    assert.equal(stream.heightAt(5, 5), 2);
    assert.equal(published.length, 1);
    stream.dispose();
    requests[1].resolve(field(3));
    await Promise.resolve();
    assert.equal(stream.pendingCount, 0);
    assert.deepEqual(stream.tiles, []);
    assert.equal(stream.numChildren, 0);
    assert.throws(() => stream.update(5, 5), code('WORLD3D_DISPOSED'));
  }
});

test('terrain streaming bounds its scan and outstanding loads before they can accumulate', async () => {
  const {requests, load} = terrainRequestFixture();
  const stream = createTerrainStream3D({tileSize: 10, viewDistance: 1, load, material: createStandardMaterial3D()});
  assert.throws(() => stream.update(Infinity, 0), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => stream.update(Number.MAX_VALUE, 0), code('WORLD3D_BUDGET'));
  stream.viewDistance = 1e6;
  assert.throws(() => stream.update(5, 5), code('WORLD3D_BUDGET'));
  stream.viewDistance = 1;
  for (let i = 0; i <= TERRAIN3D_LIMITS.maxStreamPending; i++) stream.update(5 + 100 * i, 5);
  assert.equal(requests.length, TERRAIN3D_LIMITS.maxStreamPending);
  assert.equal(stream.pendingCount, requests.length);
  requests[0].resolve();
  await Promise.resolve();
  stream.update(5 + 100 * TERRAIN3D_LIMITS.maxStreamPending, 5);
  assert.equal(requests.length, TERRAIN3D_LIMITS.maxStreamPending + 1);
  stream.dispose();
  for (const request of requests) request.resolve();
  await Promise.resolve();
  assert.equal(stream.pendingCount, 0);
});

test('terrain disposal retires every tile despite unload callback failures', () => {
  const {field} = terrainRequestFixture();
  const callbackFailure = new Error('onUnload');
  const unloaded = [];
  const stream = createTerrainStream3D({
    tileSize: 10, viewDistance: 2, load: () => field(1), material: createStandardMaterial3D(), terrain: {chunkCells: 1},
    onUnload(tile) { unloaded.push(tile.x); if (tile.x === 0) throw callbackFailure; },
  });
  stream.update(5, 5); stream.update(15, 5);
  const loaded = stream.tiles;
  assert.equal(loaded.length, 2);
  const chunks = loaded.flatMap(tile => [...tile.terrain.children]);
  chunks[0].geometry.onDispose(() => { throw new Error('geometry observer'); });
  stream.dispose();
  assert.deepEqual(unloaded, [0, 1]);
  assert.equal(stream.tiles.length, 0);
  assert.equal(stream.numChildren, 0);
  assert.ok(chunks.every(mesh => mesh.geometry.isDisposed));
  assert.equal(stream.lastFailure.cause, callbackFailure);
  assert.equal(stream.lastFailure.phase, 'onUnload');
});

test('async terrain creation records the failure and retires the request', async () => {
  const {requests, field, load} = terrainRequestFixture();
  const failure = new Error('material factory');
  const stream = createTerrainStream3D({tileSize: 10, viewDistance: 1, load, material() { throw failure; }});
  stream.update(5, 5);
  requests[0].resolve(field(1));
  await Promise.resolve();
  assert.equal(stream.pendingCount, 0);
  assert.equal(stream.numChildren, 0);
  assert.deepEqual(stream.lastFailure, {x: 0, z: 0, phase: 'prepare', cause: failure});
  stream.update(5, 5);
  assert.equal(requests.length, 1);
  stream.dispose();
});

test('a water mirror restores renderer state and retries after an unsuccessful draw', () => {
  const water = createWater3D({segments: 1, reflectionSize: 16}), scene = new Scene3D();
  const camera = createPerspectiveCamera3D({});
  camera.setPosition(0, 5, 5).lookAt(0, 0, 0);
  const reflection = water.reflection;
  reflection.interval = 2;
  reflection.shadows = false;
  const renderer = {shadowsEnabled: true, postProcess: {enabled: true}, calls: 0, render() {
    this.calls++;
    assert.equal(this.postProcess.enabled, false);
    assert.equal(water.visible, false);
    if (this.calls === 1) {
      assert.equal(this.shadowsEnabled, false);
      reflection.shadows = true;
      return false;
    }
    assert.equal(this.shadowsEnabled, true);
    return true;
  }};
  assert.equal(water.renderReflection(renderer, scene, camera), false);
  assert.equal(renderer.shadowsEnabled, true);
  assert.equal(renderer.postProcess.enabled, true);
  assert.equal(water.visible, true);
  assert.equal(water.renderReflection(renderer, scene, camera), true);
  assert.equal(renderer.calls, 2);
  water.dispose();
});

test('a failed water mirror setup restores shadows and hidden meshes', () => {
  const water = createWater3D({segments: 1, reflectionSize: 16}), scene = new Scene3D();
  const camera = createPerspectiveCamera3D({});
  camera.setPosition(0, 5, 5).lookAt(0, 0, 0);
  water.reflection.shadows = false;
  const failure = new Error('cannot disable post-processing');
  const postProcess = {get enabled() { return true; }, set enabled(value) { if (!value) throw failure; }};
  const renderer = {shadowsEnabled: true, postProcess, render() { assert.fail('render after setup failed'); }};
  assert.throws(() => water.renderReflection(renderer, scene, camera), error => error === failure);
  assert.equal(renderer.shadowsEnabled, true);
  assert.equal(water.visible, true);
  water.dispose();
});

test('underwater fog follows the owning scene and preserves later scene edits', () => {
  const water = createWater3D({segments: 1, reflectionSize: 0, amplitude: 0});
  water.setPosition(0, 2, 0);
  const first = new Scene3D(), second = new Scene3D(), camera = createPerspectiveCamera3D({});
  const firstFog = {kind: 'linear', color: [1, 1, 1], near: 1, far: 9};
  const updatedFog = {kind: 'linear', color: [0.5, 0.5, 0.5], near: 1, far: 8};
  const secondFog = {kind: 'linear', color: [0.3, 0.3, 0.3], near: 2, far: 8};
  first.fog = firstFog; second.fog = secondFog;
  camera.setPosition(0, 1, 0);
  assert.equal(water.updateUnderwater(first, camera), true);
  assert.notEqual(first.fog, firstFog);
  first.fog = updatedFog;
  assert.equal(water.updateUnderwater(second, camera), true);
  assert.equal(first.fog, updatedFog);
  assert.notEqual(second.fog, secondFog);
  water.dispose();
  assert.equal(second.fog, secondFog);
});

test('only one water node owns the fog of a scene at a time', () => {
  const first = createWater3D({segments: 1, reflectionSize: 0, amplitude: 0});
  const second = createWater3D({segments: 1, reflectionSize: 0, amplitude: 0});
  first.setPosition(0, 2, 0);
  second.setPosition(0, 3, 0);
  const scene = new Scene3D(), camera = createPerspectiveCamera3D({});
  const authored = {kind: 'linear', color: [1, 1, 1], near: 1, far: 9};
  scene.fog = authored;
  camera.setPosition(0, 1, 0);
  assert.equal(first.updateUnderwater(scene, camera, 0.08), true);
  const firstFog = scene.fog;
  assert.equal(firstFog.density, 0.08);
  assert.equal(second.updateUnderwater(scene, camera, 0.12), true);
  assert.equal(scene.fog, firstFog);

  first.dispose();
  assert.equal(scene.fog, authored);
  assert.equal(second.updateUnderwater(scene, camera, 0.12), true);
  assert.equal(scene.fog.density, 0.12);
  second.dispose();
  assert.equal(scene.fog, authored);
});

test('water knows its depth settings, the camera under it, and a cheaper mirror', () => {
  const water = createWater3D({segments: 2, reflectionSize: 16, amplitude: 0, color: 0x4080c0, depthFade: 4, foamWidth: 0.8, caustics: 0.2});
  water.setPosition(0, 2, 0); water.updateWorldMatrix();
  const material = water.material, u = material.shader.uniforms;
  // Asking for the scene's depth is what gives shore, foam and caustics.
  assert.ok(material.softness > 0); assert.equal(material.side, 'double'); assert.equal(material.attenuationDistance, 4);
  assert.ok(material.attenuationColor[2] < 0.6 && material.attenuationColor[2] > 0);
  assert.deepEqual([...u.subarray(12, 16)].map(v => +v.toFixed(3)), [0.8, 1, 0.2, 2]);
  assert.ok(material.shader.glsl.includes('sceneDistance') && material.shader.wgsl.includes('sceneDistance'));
  assert.equal(createWater3D({segments: 2, reflectionSize: 0, foamWidth: 0}).material.shader.uniforms[13], 0);
  assert.equal(water.isUnderwater([0, 1.5, 0]), true); assert.equal(water.isUnderwater([0, 2.5, 0]), false);
  // Under the surface the scene takes on thick fog; above it, its own fog returns.
  const scene = new Scene3D(), camera = createPerspectiveCamera3D({}), own = {kind: 'linear', color: [1, 1, 1], near: 10, far: 90};
  scene.fog = own;
  camera.setPosition(0, 5, 5);
  assert.equal(water.updateUnderwater(scene, camera), false); assert.equal(scene.fog, own);
  camera.setPosition(0, 0, 5);
  assert.equal(water.updateUnderwater(scene, camera, 0.1), true);
  assert.equal(scene.fog.kind, 'exponential'); assert.equal(scene.fog.density, 0.1);
  assert.equal(water.updateUnderwater(scene, camera), true); assert.equal(scene.fog.kind, 'exponential');
  camera.setPosition(0, 9, 5);
  assert.equal(water.updateUnderwater(scene, camera), false); assert.equal(scene.fog, own);
  // The mirror image can be drawn every other frame, without shadows, and from chosen layers only.
  const calls = [], renderer = {shadowsEnabled: true, render(drawn, by) { calls.push([this.shadowsEnabled, by.layerMask]); return true; }};
  water.reflection.interval = 2; water.reflection.shadows = false; water.reflection.layerMask = 1;
  camera.layerMask = 3;
  for (let i = 0; i < 4; i++) assert.equal(water.renderReflection(renderer, scene, camera), true);
  assert.deepEqual(calls, [[false, 1], [false, 1]]);
  assert.equal(renderer.shadowsEnabled, true);
});

test('the orthographic mirror rejects views with a singular or reversed depth axis', () => {
  const mirror = new PlanarReflection3D();
  const camera = createOrthographicCamera3D({height: 4});
  camera.setPosition(0, 1, 5).lookAt(0, 1, 0);
  assert.equal(mirror.update(camera, [0, 1, 0, 0]), false);
  camera.lookAt(0, 1.1, 0);
  assert.equal(mirror.update(camera, [0, 1, 0, 0]), false);
  mirror.dispose();
});

test('the orthographic mirror preserves screen coordinates and clips at a slanted plane', () => {
  const camera = createOrthographicCamera3D({height: 12, aspect: 1.5, near: 0.1, far: 100});
  camera.setPosition(3, 5, 8).lookAt(0, 1, 0);
  const reflection = new PlanarReflection3D({width: 60, height: 40});
  const plane = [0, 1, 0, -1];
  reflection.clipBias = 0;
  assert.equal(reflection.update(camera, plane), true);
  const mirror = reflection.camera;
  assert.equal(mirror.projectionKind, 'orthographic');
  for (const point of [[0, 1, 0], [2, 1, -3]]) {
    const seen = camera.worldToScreenPoint([0, 0, 0], point);
    const projected = mirror.worldToScreenPoint([0, 0, 0], point);
    close(projected[0], -seen[0], 1e-4);
    close(projected[1], seen[1], 1e-4);
    close(projected[2], -1, 1e-4);
  }
  const above = mirror.worldToScreenPoint([0, 0, 0], [0, 1.5, 0]);
  const below = mirror.worldToScreenPoint([0, 0, 0], [0, 0.5, 0]);
  assert.ok(above[2] > -1 && above[2] < 1);
  assert.ok(below[2] < -1);
  const perspective = createPerspectiveCamera3D({aspect: 1.5, near: 0.1, far: 100});
  perspective.setPosition(3, 5, 8).lookAt(0, 1, 0);
  assert.equal(reflection.update(perspective, plane), true);
  assert.equal(reflection.camera.projectionKind, 'perspective');
  assert.equal(reflection.update(camera, plane), true);
  assert.equal(reflection.camera, mirror);
  reflection.dispose();
});

test('a terrain decal keeps its requested world footprint under nonuniform scale', () => {
  const field = createHeightField3D({columns: 65, rows: 65, width: 64, depth: 64});
  const ground = createStandardMaterial3D();
  const terrain = createTerrain3D(field, ground, {chunkCells: 32, levels: 2});
  terrain.setScale(0.1, 1, 0.2);
  const material = createStandardMaterial3D();
  const decal = terrain.createDecal(material, {position: [0, 0, 0], normal: [0, 1, 0], width: 2, height: 3, offset: 0});
  assert.ok(decal);
  // The upward decal frame uses world X for width and world -Z for height.
  const box = decal.geometry.boundingBox;
  close((box[3] - box[0]) * 0.1, 2);
  close((box[5] - box[2]) * 0.2, 3);
  terrain.dispose();
  material.dispose();
  ground.dispose();
});

test('terrain rejects an oversized decal patch before sampling its geometry', () => {
  class ObservedHeightField extends HeightField3D {
    allowSampling = true;
    normalAt(...args) {
      assert.ok(this.allowSampling, 'decal patch sampled the terrain before its triangle budget was checked');
      return super.normalAt(...args);
    }
  }
  const field = new ObservedHeightField({columns: 513, rows: 513, width: 512, depth: 512});
  const material = createStandardMaterial3D();
  const terrain = createTerrain3D(field, material, {chunkCells: 128, levels: 4});
  field.allowSampling = false;
  assert.throws(() => terrain.createDecal(material, {
    position: [0, 0, 0], normal: [0, 1, 0], width: 2048, height: 2048,
  }), code('WORLD3D_BUDGET'));
  terrain.dispose();
  material.dispose();
});

test('terrain disposal retires attached factory decals and keeps borrowed resources', () => {
  const field = createHeightField3D({columns: 5, rows: 5, width: 4, depth: 4});
  const material = createStandardMaterial3D();
  const terrain = createTerrain3D(field, material);
  const decalOptions = {position: [0, 0, 0], normal: [0, 1, 0]};
  const retained = terrain.createDecal(material, decalOptions);
  const transferred = terrain.createDecal(material, decalOptions);
  assert.ok(retained && transferred);
  const otherScene = new Scene3D(), appChild = new Object3D();
  otherScene.addChild(transferred);
  terrain.addChild(appChild);
  terrain.dispose();
  assert.equal(retained.parent, undefined);
  assert.equal(retained.geometry.isDisposed, true);
  assert.equal(transferred.parent, otherScene);
  assert.equal(transferred.geometry.isDisposed, false);
  assert.equal(appChild.parent, terrain);
  assert.equal(material.isDisposed, false);
  transferred.geometry.dispose();
  material.dispose();
});
