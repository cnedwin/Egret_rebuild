// SPDX-License-Identifier: Apache-2.0
// Public behavior of world3d animation, ray picking, frame preparation and particles.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AnimationMixer3D, InstancedMesh3D, Mesh3D, Object3D, Raycaster3D, RenderList3D, Scene3D, World3DError,
  createAmbientLight3D, createAnimationClip3D, createBoxGeometry3D, createDirectionalLight3D, createHemisphereLight3D,
  createLambertMaterial3D, createParticleEmitter3D, createPerspectiveCamera3D, createPlaneGeometry3D, createPointLight3D,
  createSphereGeometry3D, createStandardMaterial3D, createUnlitMaterial3D, sampleAnimationTrack3D, LIGHT3D_LIMITS,
} from '@egret/engine/world3d';

const near = (actual, expected, epsilon = 1e-5) => {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < expected.length; i++) assert.ok(Math.abs(actual[i] - expected[i]) <= epsilon, `[${i}] ${actual[i]} != ${expected[i]}`);
};
const code = value => error => error instanceof World3DError && error.code === value;
const named = name => { const node = new Object3D(); node.name = name; return node; };

test('W3A01 tracks sample step, linear, cubic and shortest-path quaternion keys', () => {
  const clip = createAnimationClip3D({name: 'c', tracks: [
    {targetName: 'a', path: 'position', times: [0, 1, 3], values: [0, 0, 0, 2, 0, 0, 2, 4, 0]},
    {targetName: 'a', path: 'scale', times: [0, 1], values: [1, 1, 1, 3, 3, 3], interpolation: 'step'},
    {targetName: 'a', path: 'quaternion', times: [0, 1], values: [0, 0, 0, 1, 0, -1, 0, 0]},
    // Cubic keys store in-tangent, value, out-tangent; zero tangents give a smoothstep.
    {targetName: 'b', path: 'position', times: [0, 2], values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0], interpolation: 'cubic'},
  ]});
  assert.equal(clip.duration, 3);
  const out = new Float32Array(4), hint = {index: 0};
  sampleAnimationTrack3D(clip.tracks[0], 0.5, out, hint); near(out.subarray(0, 3), [1, 0, 0]);
  sampleAnimationTrack3D(clip.tracks[0], 2, out, hint); near(out.subarray(0, 3), [2, 2, 0]);
  sampleAnimationTrack3D(clip.tracks[0], 99, out, hint); near(out.subarray(0, 3), [2, 4, 0]);
  sampleAnimationTrack3D(clip.tracks[0], -1, out, hint); near(out.subarray(0, 3), [0, 0, 0]);
  sampleAnimationTrack3D(clip.tracks[1], 0.99, out, {index: 0}); near(out.subarray(0, 3), [1, 1, 1]);
  sampleAnimationTrack3D(clip.tracks[2], 0.5, out, {index: 0});
  assert.ok(Math.abs(Math.hypot(...out) - 1) < 1e-5, 'interpolated rotation stays unit length');
  near([Math.abs(out[1]), Math.abs(out[3])], [Math.SQRT1_2, Math.SQRT1_2], 1e-5);
  sampleAnimationTrack3D(clip.tracks[3], 1, out, {index: 0}); near(out.subarray(0, 3), [4, 0, 0]);
  sampleAnimationTrack3D(clip.tracks[3], 0.5, out, {index: 0}); near(out.subarray(0, 3), [8 * (3 * 0.0625 - 2 * 0.015625), 0, 0]);
  assert.throws(() => createAnimationClip3D({tracks: [{targetName: 'a', path: 'position', times: [1, 0], values: [0, 0, 0, 1, 1, 1]}]}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createAnimationClip3D({tracks: [{targetName: 'a', path: 'position', times: [0, 1], values: [0, 0, 0]}]}), code('WORLD3D_INPUT_INVALID'));
});

test('W3A02 the mixer loops, finishes, blends by weight and restores the bound pose', () => {
  const root = new Object3D(), a = root.addChild(named('a'));
  a.setPosition(5, 5, 5);
  const move = createAnimationClip3D({tracks: [{targetName: 'a', path: 'position', times: [0, 2], values: [0, 0, 0, 2, 0, 0]}]});
  const lift = createAnimationClip3D({tracks: [{targetName: 'a', path: 'position', times: [0, 2], values: [0, 10, 0, 0, 10, 0]}]});
  const mixer = new AnimationMixer3D(root);
  const action = mixer.clipAction(move).play();
  assert.equal(mixer.clipAction(move), action, 'one action per clip');
  mixer.update(0.5); near(a.position, [0.5, 0, 0]);
  mixer.update(2); near(a.position, [0.5, 0, 0], 1e-5);
  action.loop = 'pingpong'; action.time = 1.5;
  mixer.update(1); near(a.position, [1.5, 0, 0]);
  let finished = 0;
  action.reset(); action.loop = 'once'; action.clampWhenFinished = true; action.onFinished = () => finished++;
  mixer.update(5); mixer.update(1);
  assert.equal(finished, 1); near(a.position, [2, 0, 0]); assert.equal(action.isRunning, true);
  // Two running actions on one property are averaged by weight.
  action.reset().play(); action.loop = 'repeat'; action.time = 1;
  const second = mixer.clipAction(lift).play();
  second.weight = 3;
  mixer.update(0); near(a.position, [0.25, 7.5, 0]);
  second.stop(); action.crossFadeTo(second, 1);
  mixer.update(0.5);
  assert.ok(Math.abs(action.effectiveWeight - 0.5) < 1e-6 && Math.abs(second.effectiveWeight - 1.5) < 1e-6);
  mixer.update(0.6);
  assert.equal(action.isRunning, false, 'a completed fade-out retires the action');
  mixer.restorePose(); near(a.position, [5, 5, 5]);
  assert.throws(() => mixer.update(Number.NaN), code('WORLD3D_INPUT_INVALID'));
});

test('W3A03 tracks without a matching node are skipped and morph weights are animated', () => {
  const geometry = createSphereGeometry3D({radius: 1, widthSegments: 8, heightSegments: 6});
  geometry.setMorphTargets([{name: 'm0', position: new Float32Array(geometry.vertexCount * 3)}, {name: 'm1', position: new Float32Array(geometry.vertexCount * 3)}]);
  const mesh = new Mesh3D(geometry, createUnlitMaterial3D());
  mesh.name = 'face';
  const clip = createAnimationClip3D({tracks: [
    {targetName: 'face', path: 'weights', times: [0, 1], values: [0, 1, 1, 0]},
    {targetName: 'missing', path: 'position', times: [0, 1], values: [0, 0, 0, 1, 1, 1]},
  ]});
  const mixer = new AnimationMixer3D(mesh);
  mixer.clipAction(clip).play();
  mixer.update(0.25);
  near(mesh.morphWeights, [0.25, 0.75]);
});

test('W3P01 raycasting returns sorted hits with face, uv and instance data and honors culling', () => {
  const scene = new Scene3D();
  const front = new Mesh3D(createPlaneGeometry3D({width: 2, height: 2}), createUnlitMaterial3D());
  front.name = 'front'; front.setPosition(0, 0, 1);
  const back = new Mesh3D(createBoxGeometry3D({width: 1, height: 1, depth: 1}), createUnlitMaterial3D());
  back.name = 'back'; back.setPosition(0, 0, -3); back.setScale(2);
  scene.addChild(front); scene.addChild(back);
  // The ray avoids the quad diagonal, where both triangles of the plane would report a hit.
  const raycaster = new Raycaster3D().set([0.5, 0.25, 10], [0, 0, -2]);
  const hits = raycaster.intersect(scene);
  // The far side of the box is a back face of a front-sided material, so it is not reported.
  assert.deepEqual(hits.map(hit => hit.object.name), ['front', 'back']);
  near([hits[0].distance, hits[1].distance], [9, 12]);
  near(hits[0].point, [0.5, 0.25, 1]); near(hits[0].uv, [0.75, 0.625]);
  assert.equal(raycaster.intersect(scene, {firstHitOnly: true}).length, 2);
  assert.equal(raycaster.intersect(scene, {far: 10}).length, 1);
  assert.equal(raycaster.intersect(scene, {near: 11}).length, 1);
  back.material.side = 'double';
  near(raycaster.intersect(scene).map(hit => hit.distance), [9, 12, 14]);
  // The plane faces +Z: a ray from behind misses a front-sided material and hits a double-sided one.
  raycaster.set([0.5, 0.25, 0], [0, 0, 1]);
  assert.equal(raycaster.intersect(front).length, 0);
  front.material.side = 'double';
  assert.equal(raycaster.intersect(front).length, 1);
  front.visible = false; front.layers = 2;
  assert.equal(raycaster.intersect(front, {layerMask: 1}).length, 0);
  const instanced = new InstancedMesh3D(createBoxGeometry3D(), createUnlitMaterial3D(), 3);
  for (let i = 0; i < 3; i++) instanced.setTransformAt(i, [i * 3, 0, 0]);
  const single = new Raycaster3D().set([6, 0, 5], [0, 0, -1]).intersect(instanced, {firstHitOnly: true});
  assert.equal(single.length, 1); assert.equal(single[0].instanceId, 2); near([single[0].distance], [4.5]);
  assert.throws(() => new Raycaster3D().set([0, 0, 0], [0, 0, 0]), code('WORLD3D_INPUT_INVALID'));
  const camera = createPerspectiveCamera3D({aspect: 1});
  camera.setPosition(0, 0, 5);
  const picked = new Raycaster3D().setFromCamera(0, 0, camera).intersect(back, {firstHitOnly: true});
  // Camera rays start on the near plane (0.1 in front of the eye).
  near([picked[0].distance], [6.9], 1e-3);
});

test('W3R01 the render list culls, sorts and gathers lights within fixed limits', () => {
  const scene = new Scene3D(), camera = createPerspectiveCamera3D({aspect: 1, near: 0.1, far: 50});
  camera.setPosition(0, 0, 10);
  scene.addChild(camera);
  const shared = createLambertMaterial3D(), glass = createStandardMaterial3D({opacity: 0.5});
  const geometry = createSphereGeometry3D({radius: 0.5, widthSegments: 8, heightSegments: 6});
  const place = (name, material, x, z) => { const mesh = new Mesh3D(geometry, material); mesh.name = name; mesh.setPosition(x, 0, z); scene.addChild(mesh); return mesh; };
  place('far', shared, 0, -5); place('near', shared, 0, 5); place('glass-near', glass, 1, 4); place('glass-far', glass, -1, -4);
  place('behind', shared, 0, 30); const hidden = place('hidden', shared, 0, 0); hidden.visible = false;
  const layered = place('layered', shared, 2, 0); layered.layers = 4;
  const unculled = place('unculled', createUnlitMaterial3D(), 500, 0); unculled.frustumCulled = false;
  const multi = new Mesh3D(createBoxGeometry3D(), [createUnlitMaterial3D(), createUnlitMaterial3D({opacity: 0.2})]);
  multi.name = 'multi'; scene.addChild(multi);
  scene.addChild(createAmbientLight3D({color: [1, 0, 0], intensity: 0.5}));
  scene.addChild(createAmbientLight3D({color: [0, 1, 0], intensity: 0.25}));
  scene.addChild(createHemisphereLight3D({color: [0, 0, 1], groundColor: [1, 1, 0], intensity: 2}));
  scene.addChild(createDirectionalLight3D({intensity: 0}));
  for (let i = 0; i < LIGHT3D_LIMITS.maxPoint + 3; i++) scene.addChild(createPointLight3D());
  const list = new RenderList3D();
  list.build(scene, camera);
  assert.deepEqual(list.opaque.filter(item => item.material === shared).map(item => item.mesh.name), ['near', 'layered', 'far'], 'opaque draws go front to back within a material');
  assert.deepEqual(list.transparent.filter(item => item.material === glass).map(item => item.mesh.name), ['glass-far', 'glass-near'], 'blended draws go back to front');
  assert.equal(list.opaque.some(item => ['behind', 'hidden'].includes(item.mesh.name)), false);
  assert.equal(list.opaque.some(item => item.mesh.name === 'unculled'), true);
  // The box has six face groups; slots beyond the material array fall back to the first.
  assert.equal(list.opaque.filter(item => item.mesh === multi).length, 5);
  assert.equal(list.transparent.filter(item => item.mesh === multi).length, 1);
  assert.equal(list.stats.culled, 1);
  near(list.ambient, [0.5, 0.25, 0]); near(list.hemisphereSky, [0, 0, 2]); near(list.hemisphereGround, [2, 2, 0]);
  assert.equal(list.directionalLights.length, 0, 'a zero-intensity light is skipped');
  assert.equal(list.pointLights.length, LIGHT3D_LIMITS.maxPoint);
  camera.layerMask = 4;
  list.build(scene, camera);
  assert.deepEqual(list.opaque.map(item => item.mesh.name), ['layered']);
  assert.equal(list.frame, 2);
});

test('W3E01 particle emitters are deterministic, bounded and recycle dead particles', () => {
  const options = {capacity: 50, rate: 100, lifetime: [0.2, 0.4], speed: [1, 2], spread: 0.3, gravity: [0, -1, 0], startSize: 1, endSize: 0, startOpacity: 1, endOpacity: 0, seed: 11};
  const a = createParticleEmitter3D(options), b = createParticleEmitter3D(options);
  for (let i = 0; i < 30; i++) { a.update(1 / 60); b.update(1 / 60); }
  assert.ok(a.aliveCount > 10 && a.aliveCount <= 50);
  assert.equal(a.count, a.aliveCount);
  assert.deepEqual(Array.from(a.instanceMatrices.subarray(0, a.count * 16)), Array.from(b.instanceMatrices.subarray(0, b.count * 16)));
  for (let i = 0; i < a.count; i++) {
    const alpha = a.instanceColors[i * 4 + 3], size = a.instanceMatrices[i * 16];
    assert.ok(alpha >= 0 && alpha <= 1 && size >= 0 && size <= 1);
    assert.ok(Math.abs(alpha - size) < 1e-6, 'size and opacity fade together for this configuration');
  }
  // Steady state: emission is capped by capacity and by particle death.
  for (let i = 0; i < 300; i++) a.update(1 / 60);
  assert.ok(a.aliveCount <= 50 && a.aliveCount >= 25);
  a.emitting = false;
  for (let i = 0; i < 60; i++) a.update(1 / 60);
  assert.equal(a.aliveCount, 0);
  assert.equal(a.burst(80), 50, 'a burst is limited by capacity');
  a.reset(); assert.equal(a.count, 0);
  const version = a.instanceVersion;
  a.update(10);
  assert.ok(a.elapsedSeconds <= 0.25 + 1e-9, 'one step is clamped');
  assert.ok(a.instanceVersion > version);
  // World-space particles stay behind when the emitter moves; local ones follow it.
  const world = createParticleEmitter3D({capacity: 4, rate: 0, speed: 0, lifetime: 10, space: 'world'});
  world.burst(1); world.setPosition(5, 0, 0); world.update(0.01);
  near(world.instanceMatrices.subarray(12, 15), [-5, 0, 0]);
  const local = createParticleEmitter3D({capacity: 4, rate: 0, speed: 0, lifetime: 10, space: 'local'});
  local.burst(1); local.setPosition(5, 0, 0); local.update(0.01);
  near(local.instanceMatrices.subarray(12, 15), [0, 0, 0]);
  assert.throws(() => createParticleEmitter3D({lifetime: 0}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => a.clone(), code('WORLD3D_INPUT_INVALID'));
});
