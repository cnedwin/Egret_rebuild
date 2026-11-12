// SPDX-License-Identifier: Apache-2.0
// Baking clips into an animation texture and driving instances from it, in
// the World3D core. No GPU is involved; the backends are compared by the
// rendered checks.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AnimationMixer3D, AnimationTexture3D, Attribute3D, Bone3D, Mesh3D, Object3D, RenderList3D, Scene3D, Skeleton3D, createDecal3D, createPerspectiveCamera3D, SkinnedInstancedMesh3D, World3DError, bakeAnimationTexture3D,
  createAnimationClip3D, createBoxGeometry3D, createCylinderGeometry3D, createOrthographicCamera3D, createSkinnedInstancedMesh3D, createStandardMaterial3D, mat4Invert, mat4Multiply, quatFromAxisAngle,
} from '@egret/engine/world3d';

const code = value => error => error instanceof World3DError && error.code === value;
const close = (actual, expected, epsilon = 1e-4) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const turn = (axis, angle) => [...quatFromAxisAngle([0, 0, 0, 1], axis, angle)];

/** A three-bone bending pole under a moved, rotated parent, with two clips. */
function rig() {
  const height = 2.4, count = 3;
  const geometry = createCylinderGeometry3D({radiusTop: 0.2, radiusBottom: 0.3, height, radialSegments: 8, heightSegments: 8});
  const positions = geometry.getAttribute('position').data, joints = new Uint16Array(positions.length / 3 * 4), weights = new Float32Array(positions.length / 3 * 4);
  for (let i = 0; i < positions.length / 3; i++) {
    const t = (positions[i * 3 + 1] / height + 0.5) * (count - 1), low = Math.min(Math.floor(t), count - 2);
    joints.set([low, low + 1, 0, 0], i * 4); weights.set([1 - (t - low), t - low, 0, 0], i * 4);
  }
  geometry.setAttribute('joints', new Attribute3D(joints, 4));
  geometry.setAttribute('weights', new Attribute3D(weights, 4));
  const bulge = new Float32Array(positions.length); for (let i = 0; i < positions.length; i += 3) bulge[i] = positions[i] * 0.5;
  geometry.setMorphTargets([{name: 'bulge', position: bulge}]);
  const root = new Object3D(), mesh = new Mesh3D(geometry, createStandardMaterial3D({}));
  mesh.name = 'body';
  root.setPosition(5, 1, -2).setRotation(0, 0.7, 0);
  mesh.setPosition(0, height / 2, 0);
  root.addChild(mesh);
  const bones = [];
  for (let i = 0; i < count; i++) {
    const bone = new Bone3D();
    bone.name = 'bone' + i; bone.setPosition(0, i ? height / (count - 1) : -height / 2, 0);
    (i ? bones[i - 1] : mesh).addChild(bone);
    bones.push(bone);
  }
  root.updateWorldMatrices();
  mesh.bind(new Skeleton3D(bones));
  const sway = createAnimationClip3D({name: 'sway', tracks: [1, 2].map(b => ({targetName: 'bone' + b, path: 'quaternion', times: [0, 0.5, 1], values: [...turn([0, 0, 1], -0.6), ...turn([0, 0, 1], 0.6), ...turn([0, 0, 1], -0.6)]}))});
  const grow = createAnimationClip3D({name: 'grow', tracks: [
    {targetName: 'bone1', path: 'position', times: [0, 2], values: [0, 1.2, 0, 0.5, 1.6, 0]},
    {targetName: 'bone2', path: 'scale', times: [0, 2], values: [1, 1, 1, 2, 1, 2]},
    {targetName: 'body', path: 'weights', times: [0, 2], values: [0, 1]},
  ]});
  return {root, mesh, bones, geometry, sway, grow};
}
/** What live skinning would use for one bone, expressed in the mesh's own space. */
function liveMatrix(mesh, bone) {
  const skeleton = mesh.skeleton, toMesh = new Float32Array(16), out = new Float32Array(16);
  mat4Invert(toMesh, mesh.matrixWorld);
  mat4Multiply(out, skeleton.bones[bone].matrixWorld, skeleton.inverseBindMatrices.subarray(bone * 16, bone * 16 + 16));
  mat4Multiply(out, out, mesh.bindMatrix);
  return mat4Multiply(out, toMesh, out);
}

test('baked frames equal the poses the mixer produces', () => {
  const {root, mesh, bones, sway, grow} = rig();
  const before = bones.map(bone => [...bone.position, ...bone.quaternion, ...bone.scale]);
  const baked = bakeAnimationTexture3D(root, mesh, [sway, grow], {fps: 20});
  assert.ok(baked instanceof AnimationTexture3D);
  assert.equal(baked.boneCount, 3); assert.equal(baked.stride, 4); assert.equal(baked.morphCount, 1); assert.equal(baked.fps, 20);
  // Frame 0 holds the bones' turning points, so the clips start at 1.
  assert.deepEqual(baked.clips.map(clip => [clip.name, clip.start, clip.frames, clip.duration]), [['sway', 1, 21, 1], ['grow', 22, 41, 2]]);
  assert.equal(baked.frameCount, 63); assert.equal(baked.data.length, 63 * 4 * 16);
  assert.equal(baked.clipIndex('grow'), 1); assert.equal(baked.clipIndex('none'), -1);
  assert.ok(baked.reach >= 1);
  assert.deepEqual(bones.map(bone => [...bone.position, ...bone.quaternion, ...bone.scale]), before);
  // Turning points: each bone's place in the bind pose, in the mesh's own space.
  close(baked.data[13], -1.2); close(baked.data[16 + 13], 0); close(baked.data[32 + 13], 1.2); close(baked.data[32 + 12], 0);
  // In the bind pose every bone matrix is the identity: frame 0 of "grow" is the rest pose, with no morph.
  const rest = baked.data.subarray(22 * 4 * 16, 23 * 4 * 16);
  for (let bone = 0; bone < 3; bone++) for (let i = 0; i < 16; i++) close(rest[bone * 16 + i], i % 5 === 0 ? 1 : 0);
  close(rest[48], 0);
  // The morph weight track is stored in the last entry of each frame.
  close(baked.data[((22 + 20) * 4 + 3) * 16], 0.5); close(baked.data[((22 + 40) * 4 + 3) * 16], 1);
  for (const [clip, frame] of [[sway, 0], [sway, 7], [sway, 20], [grow, 13], [grow, 40]]) {
    const mixer = new AnimationMixer3D(root), entry = baked.clips[baked.clipIndex(clip.name)];
    const action = mixer.clipAction(clip);
    action.loop = 'once'; action.clampWhenFinished = true; action.play();
    mixer.update(frame / (entry.frames - 1) * clip.duration);
    root.updateWorldMatrices();
    for (let bone = 0; bone < 3; bone++) {
      const expected = liveMatrix(mesh, bone), at = ((entry.start + frame) * 4 + bone) * 16;
      for (let i = 0; i < 16; i++) close(baked.data[at + i], expected[i], 2e-4);
    }
    mixer.stopAll(); mixer.restorePose();
  }
});

test('frames around a time wrap for loops and hold at the ends otherwise', () => {
  const {root, mesh, sway, grow} = rig();
  const baked = bakeAnimationTexture3D(root, mesh, [sway, grow], {fps: 10});
  const out = [0, 0, 0];
  baked.framesAt(0, 0.25, true, out);
  assert.equal(out[0], 3); assert.equal(out[1], 4); close(out[2], 0.5);
  baked.framesAt(0, 1.25, true, out);
  assert.equal(out[0], 3); close(out[2], 0.5);
  baked.framesAt(0, -0.25, true, out);
  assert.equal(out[0], 8); close(out[2], 0.5);
  baked.framesAt(0, 5, false, out);
  assert.deepEqual(out, [11, 11, 0]);
  baked.framesAt(1, 1, false, out);
  assert.deepEqual([out[0], out[1]], [12 + 10, 12 + 11]); close(out[2], 0);
  assert.throws(() => baked.framesAt(2, 0, true, out), code('WORLD3D_INPUT_INVALID'));
});

test('baking validates its input', () => {
  const {root, mesh, sway} = rig();
  assert.throws(() => bakeAnimationTexture3D(root, new Mesh3D(createBoxGeometry3D({}), createStandardMaterial3D({})), [sway]), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => bakeAnimationTexture3D(root, mesh, []), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => bakeAnimationTexture3D(root, mesh, [sway], {fps: 0}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => bakeAnimationTexture3D(root, mesh, [sway], {fps: 1000}), code('WORLD3D_BUDGET'));
  assert.throws(() => new AnimationTexture3D(3, 30, new Float32Array(40), []), code('WORLD3D_INPUT_INVALID'));
  // One bone has two matrices per frame; a clip may not start in frame 0.
  assert.throws(() => new AnimationTexture3D(1, 30, new Float32Array(96), [{name: 'a', start: 0, frames: 2, duration: 1}]), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => new AnimationTexture3D(1, 30, new Float32Array(96), [{name: 'a', start: 2, frames: 2, duration: 1}]), code('WORLD3D_INPUT_INVALID'));
  const still = createAnimationClip3D({name: 'pose', tracks: [{targetName: 'bone1', path: 'quaternion', times: [0], values: turn([0, 0, 1], 0.3)}]});
  const baked = bakeAnimationTexture3D(root, mesh, [still]);
  assert.equal(baked.clips[0].frames, 2);
  const out = [0, 0, 0]; baked.framesAt(0, 3, true, out);
  assert.deepEqual(out, [1, 2, 0]);
});

test('instances keep their own clip, time and speed', () => {
  const {root, mesh, geometry, sway, grow} = rig();
  const baked = bakeAnimationTexture3D(root, mesh, [sway, grow], {fps: 10});
  const crowd = createSkinnedInstancedMesh3D(geometry, mesh.material, baked, 4);
  assert.ok(crowd instanceof SkinnedInstancedMesh3D);
  assert.equal(crowd.isInstanced, true); assert.equal(crowd.skeleton, undefined);
  assert.equal(crowd.boundsScale, baked.reach); assert.equal(crowd.total, 4); assert.equal(crowd.count, 4);
  // Twelve floats per instance: a clip's two frames and blend, the shared numbers, a second clip, a rotation.
  assert.deepEqual([...crowd.instanceAnimation.subarray(0, 12)], [1, 2, 0, 4, 1, 2, 0, 0, 0, 0, 0, 1]);
  crowd.setClipAt(1, 'grow', {time: 0.45, speed: 2, loop: false});
  crowd.setClipAt(2, 0, {time: 0.95});
  assert.equal(crowd.clipAt(1), 1); close(crowd.timeAt(1), 0.45);
  const version = crowd.instanceVersion;
  crowd.update(0.1);
  assert.ok(crowd.instanceVersion > version);
  close(crowd.timeAt(0), 0.1); close(crowd.timeAt(1), 0.65); close(crowd.timeAt(2), 0.05, 1e-5);
  assert.deepEqual([...crowd.instanceAnimation.subarray(0, 2)], [2, 3]);
  assert.deepEqual([...crowd.instanceAnimation.subarray(12, 14)], [12 + 6, 12 + 7]); close(crowd.instanceAnimation[14], 0.5, 1e-4);
  assert.equal(crowd.isFinishedAt(1), false);
  crowd.update(1);
  close(crowd.timeAt(1), 2); assert.equal(crowd.isFinishedAt(1), true); assert.equal(crowd.isFinishedAt(0), false);
  assert.deepEqual([...crowd.instanceAnimation.subarray(12, 15)], [32, 32, 0]);
  crowd.setSpeedAt(0, -1); crowd.setTimeAt(0, 0.05); crowd.update(0.1);
  close(crowd.timeAt(0), 0.95, 1e-5);
  // Instances beyond `total` stand still and are not drawn.
  crowd.total = 2; const held = crowd.timeAt(3); crowd.update(0.3);
  assert.equal(crowd.timeAt(3), held); assert.equal(crowd.count, 2);
  const copy = crowd.clone();
  assert.equal(copy.clipAt(1), 1); close(copy.timeAt(1), crowd.timeAt(1)); assert.equal(copy.total, 2);
  assert.deepEqual([...copy.instanceAnimation.subarray(0, 24)], [...crowd.instanceAnimation.subarray(0, 24)]);
  assert.throws(() => crowd.setClipAt(0, 'none'), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => crowd.setClipAt(9, 0), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createSkinnedInstancedMesh3D(createBoxGeometry3D({}), mesh.material, baked, 2), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createSkinnedInstancedMesh3D(geometry, mesh.material, {}, 2), code('WORLD3D_INPUT_INVALID'));
});

test('a second clip blends in, by a set weight or as a cross-fade', () => {
  const {root, mesh, geometry, sway, grow} = rig();
  const baked = bakeAnimationTexture3D(root, mesh, [sway, grow], {fps: 10});
  const crowd = createSkinnedInstancedMesh3D(geometry, mesh.material, baked, 2);
  // A standing blend: the second clip follows the first one's phase.
  crowd.setClipAt(0, 'sway', {time: 0.25});
  crowd.setBlendAt(0, 'grow', 0.3);
  crowd.update(0);
  close(crowd.blendAt(0), 0.3);
  const a = crowd.instanceAnimation;
  assert.deepEqual([a[0], a[1]], [3, 4]); close(a[7], 0.3);
  // A quarter of the way through "sway" is a quarter of the way through "grow": frame 5 of 20.
  assert.deepEqual([a[4], a[5]], [12 + 5, 12 + 6]); close(a[6], 0, 1e-4);
  crowd.update(0.5);
  close(crowd.blendAt(0), 0.3);
  crowd.setBlendAt(0, 'grow', 0);
  crowd.update(0);
  assert.equal(crowd.blendAt(0), 0); assert.equal(crowd.instanceAnimation[7], 0);
  assert.throws(() => crowd.setBlendAt(0, 'grow', 1.5), code('WORLD3D_INPUT_INVALID'));
  // A cross-fade: the old clip keeps playing as the second one while its weight runs out.
  crowd.setClipAt(1, 'sway', {time: 0.4});
  crowd.setClipAt(1, 'grow', {fade: 0.5});
  assert.equal(crowd.clipAt(1), 1); close(crowd.blendAt(1), 1);
  crowd.update(0.25);
  close(crowd.blendAt(1), 0.5, 1e-5);
  const b = crowd.instanceAnimation.subarray(12, 24);
  assert.ok(b[0] >= 12 && b[4] >= 1 && b[4] < 12, 'new clip first, old clip second');
  close(b[7], 0.5, 1e-5);
  crowd.update(0.3);
  assert.equal(crowd.blendAt(1), 0); assert.equal(crowd.instanceAnimation[12 + 7], 0);
});

test('clones continue an active fade with independent playback state', () => {
  const {root, mesh, geometry, sway, grow} = rig();
  const baked = bakeAnimationTexture3D(root, mesh, [sway, grow], {fps: 10});
  const crowd = createSkinnedInstancedMesh3D(geometry, mesh.material, baked, 1);
  crowd.setClipAt(0, 'sway', {time: 0.42});
  crowd.setClipAt(0, 'grow', {fade: 0.5});
  crowd.update(0.12);

  const copy = crowd.clone();
  assert.deepEqual(copy.instanceAnimation, crowd.instanceAnimation);
  for (const step of [0, 0.06, 0.13, 0.25]) {
    const previous = crowd.instanceAnimation.slice();
    copy.update(step);
    assert.deepEqual(crowd.instanceAnimation, previous);
    crowd.update(step);
    assert.deepEqual(copy.instanceAnimation, crowd.instanceAnimation);
    assert.equal(copy.timeAt(0), crowd.timeAt(0));
  }
});

test('a fixed-origin scaled skin stays in the render list when its rest bound is outside', () => {
  const geometry = createBoxGeometry3D({width: 2, height: 2, depth: 2});
  const count = geometry.getAttribute('position').count;
  const joints = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('joints', new Attribute3D(joints, 4));
  geometry.setAttribute('weights', new Attribute3D(weights, 4));
  const material = createStandardMaterial3D({});
  const root = new Object3D(), mesh = new Mesh3D(geometry, material), bone = new Bone3D();
  bone.name = 'scaling-bone';
  root.addChild(mesh); mesh.addChild(bone);
  root.updateWorldMatrices();
  mesh.bind(new Skeleton3D([bone]));
  const stretch = createAnimationClip3D({name: 'stretch', tracks: [
    {targetName: bone.name, path: 'scale', times: [0], values: [8, 1, 1]},
  ]});
  const baked = bakeAnimationTexture3D(root, mesh, [stretch]);
  // Frame 0 holds the bone pivots; the first pose follows it, one bone row and one weight row per frame.
  const pose = baked.stride * 16;
  assert.equal(baked.data[pose], 8);
  assert.deepEqual([...baked.data.subarray(pose + 12, pose + 15)], [0, 0, 0]);
  const crowd = createSkinnedInstancedMesh3D(geometry, material, baked, 1);
  crowd.setPosition(6, 0, 0);
  // Requesting culling must still be safe when the available bound is unqualified.
  crowd.frustumCulled = true;
  const control = new Mesh3D(geometry, material);
  control.setPosition(6, 0, 0);
  const camera = createOrthographicCamera3D({height: 2});
  camera.setPosition(0, 0, 5);
  const scene = new Scene3D();
  scene.addChild(crowd); scene.addChild(control);

  const list = new RenderList3D();
  list.build(scene, camera);
  assert.deepEqual(list.opaque.map(item => item.mesh.id), [crowd.id]);
  assert.equal(list.stats.culled, 1);
});

test('one bone can be turned per instance', () => {
  const {root, mesh, geometry, sway} = rig();
  const baked = bakeAnimationTexture3D(root, mesh, [sway]);
  const crowd = createSkinnedInstancedMesh3D(geometry, mesh.material, baked, 2);
  assert.equal(crowd.lookBone, -1);
  crowd.lookBone = 2;
  // The shared float carries the matrices per frame and the bone.
  assert.equal(crowd.instanceAnimation[3], 4 + 2048 * 3);
  crowd.setBoneRotationAt(1, 0, 2, 0, 2);
  crowd.update(0);
  const turned = [...crowd.instanceAnimation.subarray(12 + 8, 24)];
  close(turned[1], Math.SQRT1_2); close(turned[3], Math.SQRT1_2);
  assert.deepEqual([...crowd.instanceAnimation.subarray(8, 12)], [0, 0, 0, 1]);
  assert.throws(() => { crowd.lookBone = 3; }, code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => crowd.setBoneRotationAt(0, 0, 0, 0, 0), code('WORLD3D_INPUT_INVALID'));
});

test('instances outside the view are left out of the draw', () => {
  const {root, mesh, geometry, sway} = rig();
  const baked = bakeAnimationTexture3D(root, mesh, [sway]);
  const crowd = createSkinnedInstancedMesh3D(geometry, mesh.material, baked, 5);
  // Three in front of the camera, one far to the side, one behind it.
  [[0, 0, 0], [2, 0, -3], [-2, 0, -6], [400, 0, 0], [0, 0, 60]].forEach((at, i) => { crowd.setTransformAt(i, at); crowd.setColorAt(i, i / 4, 0, 0); });
  crowd.update(0);
  assert.equal(crowd.count, 5);
  // Leaving instances out is asked for; by default every instance is drawn.
  assert.equal(crowd.cullInstances, false);
  crowd.cullInstances = true;
  const camera = createPerspectiveCamera3D({fov: 50, aspect: 1, near: 0.1, far: 200});
  camera.setPosition(0, 1, 12).lookAt(0, 1, 0); camera.updateViewMatrices();
  crowd.beforeRender(camera);
  assert.equal(crowd.count, 3);
  // The drawn arrays hold the visible instances, in order, with their own colors.
  assert.deepEqual([crowd.instanceMatrices[12], crowd.instanceMatrices[16 + 12], crowd.instanceMatrices[32 + 12]], [0, 2, -2]);
  assert.deepEqual([crowd.instanceColors[0], crowd.instanceColors[3], crowd.instanceColors[6]], [0, 0.25, 0.5]);
  // Turning around shows the one behind; switching culling off draws all.
  camera.setPosition(0, 1, 12).lookAt(0, 1, 100); camera.updateViewMatrices();
  crowd.beforeRender(camera);
  assert.equal(crowd.count, 1); assert.equal(crowd.instanceMatrices[14], 60);
  crowd.cullInstances = false; crowd.beforeRender(camera);
  assert.equal(crowd.count, 5);
  // Padding keeps instances just outside the view, whose shadows may still reach it.
  crowd.cullInstances = true; crowd.cullPadding = 400;
  camera.setPosition(0, 1, 12).lookAt(0, 1, 0); camera.updateViewMatrices();
  crowd.beforeRender(camera);
  assert.equal(crowd.count, 5);
  baked.dispose();
  assert.equal(baked.isDisposed, true);
});

test('a decal on a skinned mesh keeps the bones that move the surface', () => {
  const {root, mesh, geometry} = rig();
  const decal = createDecal3D(mesh, createStandardMaterial3D({}), {position: [...root.localToWorld([0, 0, 0], [0.25, 1.5, 0])], normal: [Math.cos(0.7), 0, -Math.sin(0.7)], width: 0.6, height: 0.6, depth: 0.5});
  assert.equal(decal.skeleton, mesh.skeleton); assert.equal(decal.parent, mesh);
  const joints = decal.geometry.getAttribute('joints').data, weights = decal.geometry.getAttribute('weights').data, positions = decal.geometry.getAttribute('position').data;
  assert.equal(joints.length, positions.length / 3 * 4);
  for (let i = 0; i < weights.length; i += 4) {
    close(weights[i] + weights[i + 1] + weights[i + 2] + weights[i + 3], 1, 1e-5);
    // Around the middle of the pole the surface hangs between the first two or the last two bones, as the pole itself does.
    const t = (positions[i / 4 * 3 + 1] / 2.4 + 0.5) * 2, low = Math.min(Math.floor(t), 1);
    const share = joints[i] === low + 1 ? weights[i] : joints[i + 1] === low + 1 ? weights[i + 1] : 0;
    close(share, t - low, 1e-3);
  }
  assert.ok(geometry.getAttribute('joints'));
});
