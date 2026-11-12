// SPDX-License-Identifier: Apache-2.0
// Baking clips into an animation texture and driving instances from it, in
// the World3D core. No GPU is involved; the backends are compared by the
// rendered checks.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AnimationMixer3D, AnimationTexture3D, Attribute3D, Bone3D, Mesh3D, Object3D, RenderList3D, Scene3D, Skeleton3D, SkinnedInstancedMesh3D, World3DError, bakeAnimationTexture3D,
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
  const root = new Object3D(), mesh = new Mesh3D(geometry, createStandardMaterial3D({}));
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
  assert.equal(baked.boneCount, 3); assert.equal(baked.fps, 20);
  assert.deepEqual(baked.clips.map(clip => [clip.name, clip.start, clip.frames, clip.duration]), [['sway', 0, 21, 1], ['grow', 21, 41, 2]]);
  assert.equal(baked.frameCount, 62); assert.equal(baked.data.length, 62 * 3 * 16);
  assert.equal(baked.clipIndex('grow'), 1); assert.equal(baked.clipIndex('none'), -1);
  assert.ok(baked.reach >= 1);
  // Baking leaves the rig as it found it.
  assert.deepEqual(bones.map(bone => [...bone.position, ...bone.quaternion, ...bone.scale]), before);
  // In the bind pose every matrix is the identity: frame 0 of "grow" is the rest pose.
  const rest = baked.data.subarray(21 * 3 * 16, 21 * 3 * 16 + 48);
  for (let bone = 0; bone < 3; bone++) for (let i = 0; i < 16; i++) close(rest[bone * 16 + i], i % 5 === 0 ? 1 : 0);
  // Any stored frame matches a mixer playing the same clip at the same time.
  for (const [clip, frame] of [[sway, 0], [sway, 7], [sway, 20], [grow, 13], [grow, 40]]) {
    const mixer = new AnimationMixer3D(root), entry = baked.clips[baked.clipIndex(clip.name)];
    const action = mixer.clipAction(clip);
    action.loop = 'once'; action.clampWhenFinished = true; action.play();
    mixer.update(frame / (entry.frames - 1) * clip.duration);
    root.updateWorldMatrices();
    for (let bone = 0; bone < 3; bone++) {
      const expected = liveMatrix(mesh, bone), at = ((entry.start + frame) * 3 + bone) * 16;
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
  assert.equal(out[0], 2); assert.equal(out[1], 3); close(out[2], 0.5);
  baked.framesAt(0, 1.25, true, out);
  assert.equal(out[0], 2); close(out[2], 0.5);
  baked.framesAt(0, -0.25, true, out);
  assert.equal(out[0], 7); close(out[2], 0.5);
  baked.framesAt(0, 5, false, out);
  assert.deepEqual(out, [10, 10, 0]);
  baked.framesAt(1, 1, false, out);
  assert.deepEqual([out[0], out[1]], [11 + 10, 11 + 11]); close(out[2], 0);
  assert.throws(() => baked.framesAt(2, 0, true, out), code('WORLD3D_INPUT_INVALID'));
});

test('baking validates its input', () => {
  const {root, mesh, sway} = rig();
  assert.throws(() => bakeAnimationTexture3D(root, new Mesh3D(createBoxGeometry3D({}), createStandardMaterial3D({})), [sway]), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => bakeAnimationTexture3D(root, mesh, []), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => bakeAnimationTexture3D(root, mesh, [sway], {fps: 0}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => bakeAnimationTexture3D(root, mesh, [sway], {fps: 1000}), code('WORLD3D_BUDGET'));
  assert.throws(() => new AnimationTexture3D(3, 30, new Float32Array(40), []), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => new AnimationTexture3D(1, 30, new Float32Array(32), [{name: 'a', start: 1, frames: 2, duration: 1}]), code('WORLD3D_INPUT_INVALID'));
  // A clip with no length is stored as a single still pose.
  const still = createAnimationClip3D({name: 'pose', tracks: [{targetName: 'bone1', path: 'quaternion', times: [0], values: turn([0, 0, 1], 0.3)}]});
  const baked = bakeAnimationTexture3D(root, mesh, [still]);
  assert.equal(baked.clips[0].frames, 2);
  const out = [0, 0, 0]; baked.framesAt(0, 3, true, out);
  assert.deepEqual(out, [0, 1, 0]);
});

test('instances keep their own clip, time and speed', () => {
  const {root, mesh, geometry, sway, grow} = rig();
  const baked = bakeAnimationTexture3D(root, mesh, [sway, grow], {fps: 10});
  const crowd = createSkinnedInstancedMesh3D(geometry, mesh.material, baked, 4);
  assert.ok(crowd instanceof SkinnedInstancedMesh3D);
  assert.equal(crowd.isInstanced, true); assert.equal(crowd.skeleton, undefined);
  assert.equal(crowd.boundsScale, baked.reach);
  assert.deepEqual([...crowd.instanceAnimation.subarray(0, 4)], [0, 1, 0, 3]);
  crowd.setClipAt(1, 'grow', {time: 0.45, speed: 2, loop: false});
  crowd.setClipAt(2, 0, {time: 0.95});
  assert.equal(crowd.clipAt(1), 1); close(crowd.timeAt(1), 0.45);
  const version = crowd.instanceVersion;
  crowd.update(0.1);
  assert.ok(crowd.instanceVersion > version);
  close(crowd.timeAt(0), 0.1); close(crowd.timeAt(1), 0.65); close(crowd.timeAt(2), 0.05, 1e-5);
  assert.deepEqual([...crowd.instanceAnimation.subarray(0, 2)], [1, 2]);
  assert.deepEqual([...crowd.instanceAnimation.subarray(4, 6)], [11 + 6, 11 + 7]); close(crowd.instanceAnimation[6], 0.5, 1e-4);
  assert.equal(crowd.isFinishedAt(1), false);
  crowd.update(1);
  close(crowd.timeAt(1), 2); assert.equal(crowd.isFinishedAt(1), true); assert.equal(crowd.isFinishedAt(0), false);
  assert.deepEqual([...crowd.instanceAnimation.subarray(4, 7)], [31, 31, 0]);
  crowd.setSpeedAt(0, -1); crowd.setTimeAt(0, 0.05); crowd.update(0.1);
  close(crowd.timeAt(0), 0.95, 1e-5);
  // Instances beyond `count` stand still.
  crowd.count = 2; const held = crowd.timeAt(3); crowd.update(0.3); assert.equal(crowd.timeAt(3), held);
  // A copy keeps each instance's place in its clip.
  const copy = crowd.clone();
  assert.equal(copy.clipAt(1), 1); close(copy.timeAt(1), crowd.timeAt(1));
  assert.deepEqual([...copy.instanceAnimation], [...crowd.instanceAnimation]);
  assert.throws(() => crowd.setClipAt(0, 'none'), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => crowd.setClipAt(9, 0), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createSkinnedInstancedMesh3D(createBoxGeometry3D({}), mesh.material, baked, 2), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createSkinnedInstancedMesh3D(geometry, mesh.material, {}, 2), code('WORLD3D_INPUT_INVALID'));
});

test('a fade blends from the held pose into the new clip', () => {
  const {root, mesh, geometry, sway, grow} = rig();
  const baked = bakeAnimationTexture3D(root, mesh, [sway, grow], {fps: 10});
  const crowd = createSkinnedInstancedMesh3D(geometry, mesh.material, baked, 1);
  crowd.setClipAt(0, 0, {time: 0.42});
  crowd.setClipAt(0, 'grow', {fade: 0.5});
  // The old pose's nearest frame is held as the first frame; the blend starts at 0.
  assert.deepEqual([...crowd.instanceAnimation.subarray(0, 3)], [4, 11, 0]);
  crowd.update(0.25);
  assert.equal(crowd.instanceAnimation[0], 4); close(crowd.instanceAnimation[2], 0.5, 1e-5);
  assert.ok(crowd.instanceAnimation[1] >= 11);
  crowd.update(0.3);
  // After the fade the instance is between two frames of the new clip again.
  assert.ok(crowd.instanceAnimation[0] >= 11 && crowd.instanceAnimation[1] === crowd.instanceAnimation[0] + 1);
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
  assert.equal(baked.data[0], 8);
  assert.deepEqual([...baked.data.subarray(12, 15)], [0, 0, 0]);
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

test('instance bounds grow by the reach of the animation', () => {
  const {root, mesh, geometry, sway} = rig();
  const baked = bakeAnimationTexture3D(root, mesh, [sway]);
  const crowd = createSkinnedInstancedMesh3D(geometry, mesh.material, baked, 2);
  crowd.setTransformAt(0, [0, 0, 0]); crowd.setTransformAt(1, [10, 0, 0]);
  crowd.updateWorldMatrix();
  const radius = crowd.worldBoundingSphere[3];
  crowd.boundsScale = 1; crowd.instanceVersion++;
  assert.ok(radius > crowd.worldBoundingSphere[3]);
  baked.dispose();
  assert.equal(baked.isDisposed, true);
});
