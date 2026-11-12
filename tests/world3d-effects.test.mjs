// SPDX-License-Identifier: Apache-2.0
// Trails, decals, GPU particles and the atmosphere hook of World3D, checked
// through their CPU side. What they look like is compared by the rendered checks.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GpuParticles3D, Mesh3D, Object3D, Trail3D, World3DError, createBoxGeometry3D, createDecal3D, createDecalGeometry3D, createGpuParticles3D,
  createPerspectiveCamera3D, createPlaneGeometry3D, createSphereGeometry3D, createStandardMaterial3D, createTrail3D,
} from '@egret/engine/world3d';
import { createAtmosphere3D } from '@egret/engine/webgl2/world3d';
import { Atmosphere3D } from '@egret/engine/webgpu/world3d';

const code = value => error => error instanceof World3DError && error.code === value;
const close = (actual, expected, epsilon = 1e-4) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

test('a trail records where its target has been and lets old points go', () => {
  const target = new Object3D(), trail = createTrail3D({target, points: 8, lifetime: 1, minDistance: 0.5, width: 0.4, endWidth: 0});
  assert.ok(trail instanceof Trail3D);
  assert.equal(trail.pointCount, 0);
  assert.equal(trail.castShadow, false); assert.equal(trail.frustumCulled, false);
  assert.equal(trail.material.vertexColors, true); assert.equal(trail.material.depthWrite, false);
  for (let i = 0; i <= 4; i++) { target.setPosition(i, 0, 0); trail.update(0.1); }
  // Five recorded points and the head that rides on the target.
  assert.equal(trail.pointCount, 6);
  // A move shorter than minDistance drags the head without recording.
  target.setPosition(4.2, 0, 0); trail.update(0.1);
  assert.equal(trail.pointCount, 6);
  // Points older than the lifetime drop off the tail.
  trail.update(0.55);
  assert.ok(trail.pointCount < 6 && trail.pointCount >= 2);
  // The buffer holds at most `points` points however far the target runs.
  for (let i = 0; i < 40; i++) { target.setPosition(5 + i, 0, 0); trail.update(0.001); }
  assert.equal(trail.pointCount, 8);
  trail.clear();
  assert.equal(trail.pointCount, 0);
  assert.throws(() => createTrail3D({points: 1}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createTrail3D({lifetime: 0}), code('WORLD3D_INPUT_INVALID'));
});

test('the ribbon faces the camera and tapers and fades toward its tail', () => {
  const trail = createTrail3D({points: 4, lifetime: 10, minDistance: 0, width: 0.4, endWidth: 0, opacity: 1, endOpacity: 0, color: [1, 0, 0], endColor: [0, 0, 1]});
  // Recorded along X on the ground; the camera looks straight down.
  for (let i = 0; i < 3; i++) { trail.push(i, 0, 0); trail.update(i < 2 ? 4 : 0); }
  const camera = createPerspectiveCamera3D({});
  camera.setPosition(1, 10, 0).lookAt(1, 0, 0); camera.updateWorldMatrix();
  const version = trail.geometry.getAttribute('position').version;
  trail.beforeRender(camera);
  assert.ok(trail.geometry.getAttribute('position').version > version);
  const p = trail.geometry.getAttribute('position').data, c = trail.geometry.getAttribute('color').data, uv = trail.geometry.getAttribute('uv').data;
  // Head: full width across Z, since the ribbon runs along X and is seen from above.
  close(p[0], 2); close(Math.abs(p[2] - p[5]), 0.4); close(p[1], 0);
  assert.deepEqual([c[0], c[2], c[3]], [1, 0, 1]);
  // The oldest point is 8 of 10 seconds old: narrower, bluer, fainter.
  const last = 3 * 2;
  close(p[last * 3], 0); close(Math.abs(p[last * 3 + 2] - p[last * 3 + 5]), 0.4 * 0.2, 1e-3);
  close(c[last * 4], 0.2, 1e-3); close(c[last * 4 + 2], 0.8, 1e-3); close(c[last * 4 + 3], 0.2, 1e-3);
  close(uv[last * 2], 0.8, 1e-3); assert.equal(uv[1], 0); assert.equal(uv[3], 1);
  // With fewer than two points nothing is drawn.
  trail.clear(); trail.push(0, 0, 0); trail.beforeRender(camera);
  assert.ok(trail.geometry.getAttribute('position').data.every(v => v === 0));
  trail.dispose();
  assert.equal(trail.geometry.isDisposed, true);
});

test('a decal is the part of the surface inside its box', () => {
  const wall = new Mesh3D(createPlaneGeometry3D({width: 10, height: 10, widthSegments: 4, heightSegments: 4}), createStandardMaterial3D({}));
  wall.setPosition(0, 5, -3); wall.updateWorldMatrix();
  const geometry = createDecalGeometry3D(wall, {position: [1, 5, -3], normal: [0, 0, 1], width: 2, height: 1, offset: 0});
  const p = geometry.getAttribute('position').data, uv = geometry.getAttribute('uv').data, n = geometry.getAttribute('normal').data;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, area = 0;
  for (let i = 0; i < p.length; i += 3) { minX = Math.min(minX, p[i]); maxX = Math.max(maxX, p[i]); minY = Math.min(minY, p[i + 1]); maxY = Math.max(maxY, p[i + 1]); close(p[i + 2], 0); close(n[i + 2], 1); }
  // In the wall's own space: a 2 x 1 patch around x = 1, cut exactly at the box.
  close(minX, 0); close(maxX, 2); close(minY, -0.5); close(maxY, 0.5);
  for (let i = 0; i < p.length; i += 9) area += Math.abs((p[i + 3] - p[i]) * (p[i + 7] - p[i + 1]) - (p[i + 6] - p[i]) * (p[i + 4] - p[i + 1])) / 2;
  close(area, 2, 1e-4);
  for (let i = 0; i < uv.length; i += 2) { close(uv[i], (p[i / 2 * 3] - 0) / 2, 1e-4); close(uv[i + 1], p[i / 2 * 3 + 1] + 0.5, 1e-4); }
  // Turning the decal a quarter swaps its extent on the wall.
  const turned = createDecalGeometry3D(wall, {position: [1, 5, -3], normal: [0, 0, 1], width: 2, height: 1, rotation: Math.PI / 2}).boundingBox;
  close(turned[3] - turned[0], 1, 1e-3); close(turned[4] - turned[1], 2, 1e-3);
  // Nothing behind the wall, off its edge, or on a face turned away.
  assert.equal(createDecalGeometry3D(wall, {position: [1, 5, 3], normal: [0, 0, 1]}), undefined);
  assert.equal(createDecalGeometry3D(wall, {position: [30, 5, -3], normal: [0, 0, 1]}), undefined);
  assert.equal(createDecalGeometry3D(wall, {position: [1, 5, -3], normal: [0, 0, -1]}), undefined);
  assert.throws(() => createDecalGeometry3D(wall, {position: [0, 0, 0], normal: [0, 0, 0]}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createDecalGeometry3D(wall, {position: [0, 0, 0], normal: [0, 1, 0], up: [0, 2, 0]}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createDecalGeometry3D({}, {position: [0, 0, 0], normal: [0, 1, 0]}), code('WORLD3D_INPUT_INVALID'));
});

test('a decal wraps a curved surface and rides on its mesh', () => {
  const ball = new Mesh3D(createSphereGeometry3D({radius: 1, widthSegments: 32, heightSegments: 24}), createStandardMaterial3D({}));
  ball.setPosition(4, 0, 0).setScale(2); ball.receiveShadow = true; ball.updateWorldMatrix();
  const material = createStandardMaterial3D({});
  const decal = createDecal3D(ball, material, {position: [4, 0, 2], normal: [0, 0, 1], width: 1.5, height: 1.5, depth: 1});
  assert.equal(decal.parent, ball); assert.equal(decal.castShadow, false); assert.equal(decal.receiveShadow, true);
  assert.equal(material.depthWrite, false); assert.deepEqual([...material.polygonOffset], [-2, -4]);
  // Every vertex lies on the sphere (in its local space, lifted a hair) inside the box footprint.
  const p = decal.geometry.getAttribute('position').data;
  assert.ok(p.length >= 9 * 4);
  for (let i = 0; i < p.length; i += 3) {
    const radius = Math.hypot(p[i], p[i + 1], p[i + 2]);
    assert.ok(radius > 0.99 && radius < 1.01, 'on the sphere: ' + radius);
    assert.ok(Math.abs(p[i]) <= 0.376 && Math.abs(p[i + 1]) <= 0.376 && p[i + 2] > 0.5);
  }
  assert.equal(createDecal3D(ball, material, {position: [40, 0, 0], normal: [0, 0, 1]}), undefined);
  // A box on its corner: the decal covers parts of three faces.
  const crate = new Mesh3D(createBoxGeometry3D({width: 2, height: 2, depth: 2}), createStandardMaterial3D({}));
  crate.updateWorldMatrix();
  const corner = createDecalGeometry3D(crate, {position: [1, 1, 1], normal: [1, 1, 1], width: 1, height: 1, depth: 1}), normals = corner.getAttribute('normal').data, faces = new Set();
  for (let i = 0; i < normals.length; i += 3) faces.add([normals[i], normals[i + 1], normals[i + 2]].map(Math.round).join());
  assert.equal(faces.size, 3);
});

test('GPU particles carry their whole motion in the instance data', () => {
  const particles = createGpuParticles3D({count: 500, lifetime: [1, 2], speed: [2, 3], direction: [0, 1, 0], spread: 0.3, gravity: [0, -5, 0], drag: 0.2, startSize: [0.1, 0.2], endScale: 3, startColor: [1, 0.5, 0], endColor: [0, 0, 1], startOpacity: 0.8, endOpacity: 0.1, softness: 0.4, seed: 5});
  assert.ok(particles instanceof GpuParticles3D);
  assert.equal(particles.count, 500); assert.equal(particles.castShadow, false); assert.equal(particles.loop, true); assert.equal(particles.duration, Infinity);
  assert.equal(particles.material.billboard, true); assert.equal(particles.material.depthWrite, false); assert.equal(particles.material.softness, 0.4);
  const data = particles.instanceMatrices, births = [];
  for (let i = 0; i < 500; i++) {
    const o = i * 16, speed = Math.hypot(data[o + 4], data[o + 5], data[o + 6]);
    assert.ok(speed >= 2 - 1e-4 && speed <= 3 + 1e-4);
    assert.ok(data[o + 5] / speed >= Math.cos(0.3) - 1e-4, 'inside the cone');
    assert.ok(data[o + 7] >= 1 && data[o + 7] <= 2);
    assert.ok(data[o + 8] >= 0.1 - 1e-6 && data[o + 8] <= 0.2 + 1e-6); close(data[o + 9], data[o + 8] * 3, 1e-5);
    assert.deepEqual([data[o], data[o + 1], data[o + 2]], [0, 0, 0]);
    births.push(data[o + 3]);
  }
  // A stream is spread evenly over the longest lifetime, so it is already running at time 0.
  assert.ok(Math.min(...births) >= 0 && Math.max(...births) <= 2 && Math.max(...births) > 1.9);
  assert.deepEqual([...particles.instanceColors.subarray(0, 4)].map(v => +v.toFixed(3)), [1, 0.5, 0, 0.8]);
  // The shared parameters ride in the material's shader block: time, loop, fades, gravity, drag, end color.
  const u = particles.material.shader.uniforms;
  assert.deepEqual([...u.subarray(0, 12)].map(v => +v.toFixed(3)), [0, 1, 0.1, 0.3, 0, -5, 0, 0.2, 0, 0, 1, 0.1]);
  particles.update(0.25); particles.update(0.5);
  close(particles.time, 0.75); assert.equal(u[0], particles.time); assert.equal(particles.isFinished, false);
  // The bounds hold the fountain's rise and fall and move with the node.
  particles.setPosition(10, 0, 0); particles.updateWorldMatrix();
  const sphere = particles.worldBoundingSphere;
  close(sphere[0], 10, 0.6); assert.ok(sphere[3] > 1 && sphere[3] < 12);
  // The same seed gives the same particles.
  const again = createGpuParticles3D({count: 500, lifetime: [1, 2], speed: [2, 3], spread: 0.3, seed: 5});
  assert.deepEqual([...again.instanceMatrices.subarray(0, 8)], [...data.subarray(0, 8)]);
});

test('a burst is emitted once and reports its end', () => {
  const burst = createGpuParticles3D({count: 50, lifetime: 1, speed: 2, spread: Math.PI, loop: false, duration: 0.5, shape: 'sphere', radius: 0.3});
  assert.equal(burst.loop, false); close(burst.duration, 1.5);
  const data = burst.instanceMatrices;
  for (let i = 0; i < 50; i++) { assert.ok(data[i * 16 + 3] >= 0 && data[i * 16 + 3] <= 0.5); assert.ok(Math.hypot(data[i * 16], data[i * 16 + 1], data[i * 16 + 2]) <= 0.3 + 1e-6); }
  burst.update(1.4); assert.equal(burst.isFinished, false);
  burst.update(0.2); assert.equal(burst.isFinished, true);
  burst.restart(); assert.equal(burst.time, 0); assert.equal(burst.isFinished, false);
  const box = createGpuParticles3D({count: 20, shape: 'box', extents: [1, 2, 3]});
  for (let i = 0; i < 20; i++) assert.ok(Math.abs(box.instanceMatrices[i * 16 + 1]) <= 2);
  assert.throws(() => createGpuParticles3D({lifetime: 0}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createGpuParticles3D({lifetime: [2, 1]}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createGpuParticles3D({direction: [0, 0, 0]}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createGpuParticles3D({shape: 'ring'}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createGpuParticles3D({count: 2e6}), code('WORLD3D_BUDGET'));
  burst.dispose();
  assert.equal(burst.geometry.isDisposed, true);
});

test('the atmosphere hook follows the camera and the sun', () => {
  const air = createAtmosphere3D({fogColor: 0xffffff, fogDensity: 0.02, fogHeight: 3, fogFalloff: 0.1, shaftIntensity: 0.5, shaftLength: 0.7});
  assert.ok(air instanceof Atmosphere3D);
  assert.ok(air.post.glsl.includes('customPost') && air.post.wgsl.includes('customPost'));
  const u = air.post.uniforms;
  assert.deepEqual([...u.subarray(0, 6)].map(v => +v.toFixed(3)), [1, 1, 1, 0.02, 0.1, 3]);
  close(u[7], 0.5); close(u[11], 0.7);
  const camera = createPerspectiveCamera3D({fov: 60, aspect: 1, near: 0.1, far: 200});
  camera.setPosition(0, 7, 10).lookAt(0, 7, 0);
  // Sunlight travelling toward the viewer and downward: the sun is ahead and above.
  air.update(camera, [0, -1, 2]);
  close(u[15], 7); close(u[12], 0); close(u[13], 1); close(u[14], 0);   // level camera: up is the view's Y
  close(u[6], 196);
  close(u[8], 0.5, 1e-3); assert.ok(u[9] > 0.5 && u[9] < 1.5); assert.ok(u[10] > 0);
  // Looking down, world up leans into the view's Z axis.
  camera.setPosition(0, 20, 0.001).lookAt(0, 0, 0);
  air.update(camera, [0, -1, 2]);
  assert.ok(Math.abs(u[14]) > 0.99); close(u[15], 20);
  // The sun behind the viewer, or no sun at all, leaves only the fog.
  camera.setPosition(0, 7, 10).lookAt(0, 7, 0);
  air.update(camera, [0, -1, -2]); assert.equal(u[10], 0);
  air.update(camera); assert.equal(u[10], 0);
  air.fogDensity = 0; air.setFogColor(0.1, 0.2, 0.3);
  assert.equal(u[3], 0); close(u[1], 0.2);
  assert.throws(() => { air.fogDensity = -1; }, code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => { air.shaftLength = 2; }, code('WORLD3D_INPUT_INVALID'));
});
