// SPDX-License-Identifier: Apache-2.0
// Rigs of models made from distance fields: bones at the joints, skin weights from the parts each bone moves, and clips
// written as poses of named bones.
import assert from 'node:assert/strict';
import test from 'node:test';
import { AnimationClip3D, createSdfRig3D, sdfCapsule, sdfMirror, sdfSphere, sdfUnion } from '@egret/engine/world3d';

const close = (a, b, eps = 1e-5) => Math.abs(a - b) <= eps;

/** A ball of a body with a pair of legs hanging from it. */
function walker(options = {}) {
  const body = sdfSphere(0.3, { at: [0, 0.7, 0], color: 0x3366cc });
  const leg = sdfCapsule([0.12, 0.5, 0], [0.12, 0.05, 0], 0.07, { color: 0xcc6633 });
  const shape = sdfUnion([body, sdfMirror(leg)], { smooth: 0.04 });
  return createSdfRig3D(
    shape,
    [
      { name: 'body', at: [0, 0.6, 0], parts: body },
      { name: 'leg', parent: 'body', at: [0.12, 0.5, 0], parts: leg, mirror: 'x' }
    ],
    { triangles: 3000, occlusion: 0, ...options }
  );
}

/** Where the skin puts each vertex now, as the renderer would: the weighted sum of the bone matrices. */
function skinned(rig) {
  rig.root.updateWorldMatrices(true);
  rig.skeleton.update(Math.random());
  const g = rig.mesh.geometry,
    p = g.getAttribute('position').data,
    j = g.getAttribute('joints').data,
    w = g.getAttribute('weights').data,
    m = rig.skeleton.boneMatrices;
  const out = new Float32Array(p.length);
  for (let v = 0; v < p.length / 3; v++)
    for (let k = 0; k < 4; k++) {
      const weight = w[v * 4 + k];
      if (weight === 0) continue;
      const o = j[v * 4 + k] * 16,
        [x, y, z] = [p[v * 3], p[v * 3 + 1], p[v * 3 + 2]];
      for (let a = 0; a < 3; a++)
        out[v * 3 + a] += weight * (m[o + a] * x + m[o + 4 + a] * y + m[o + 8 + a] * z + m[o + 12 + a]);
    }
  return out;
}

// Break caught: a pair made on one side only, a bone hung from the wrong parent, or a joint in the wrong place.
test('RG01 bones are made at their joints, pairs on both sides, each under its parent', () => {
  const rig = walker();
  assert.deepEqual(Object.keys(rig.bones).sort(), ['body', 'leg.L', 'leg.R']);
  assert.equal(rig.bones['leg.L'].parent, rig.bones.body);
  assert.equal(rig.bones.body.parent, rig.root);
  assert.equal(rig.mesh.parent, rig.root);
  rig.root.updateWorldMatrices(true);
  const world = bone => [12, 13, 14].map(i => rig.bones[bone].matrixWorld[i]);
  assert.deepEqual(
    world('leg.L').map(v => +v.toFixed(5)),
    [0.12, 0.5, 0]
  );
  assert.deepEqual(
    world('leg.R').map(v => +v.toFixed(5)),
    [-0.12, 0.5, 0]
  );
  assert.equal(rig.skeleton.bones.length, 3);
  assert.equal(rig.mesh.skeleton, rig.skeleton);
});

// Break caught: weights that do not add up, a foot that follows the body, or a joint where the skin tears.
test('RG02 each vertex follows the bones whose parts are nearest, sharing at the joints', () => {
  const rig = walker();
  const g = rig.mesh.geometry,
    p = g.getAttribute('position').data,
    j = g.getAttribute('joints').data,
    w = g.getAttribute('weights').data;
  const names = rig.skeleton.bones.map(bone => bone.name);
  let shared = 0;
  for (let v = 0; v < g.vertexCount; v++) {
    const sum = w[v * 4] + w[v * 4 + 1] + w[v * 4 + 2] + w[v * 4 + 3];
    assert.ok(close(sum, 1), 'weights add to one');
    const top = names[j[v * 4]],
      [x, y] = [p[v * 3], p[v * 3 + 1]];
    if (y < 0.3) assert.equal(top, x > 0 ? 'leg.L' : 'leg.R', 'a foot follows its leg');
    if (y > 0.8) assert.equal(top, 'body');
    if (w[v * 4 + 1] > 0.2) shared++;
  }
  assert.ok(shared > 0, 'some vertices are shared between two bones');
});

// Break caught: a skin that does not follow its bone, or that drags the rest of the model along.
test('RG03 turning a bone moves the skin it carries and nothing else', () => {
  const rig = walker();
  const rest = skinned(rig);
  const p = rig.mesh.geometry.getAttribute('position').data;
  for (let i = 0; i < p.length; i++) assert.ok(close(rest[i], p[i], 1e-4), 'the rest pose is the model');
  rig.bones['leg.L'].setRotation(-Math.PI / 2, 0, 0);
  const moved = skinned(rig);
  let foot = -1,
    crown = -1;
  for (let v = 0; v < p.length / 3; v++) {
    if (p[v * 3] > 0.05 && (foot < 0 || p[v * 3 + 1] < p[foot * 3 + 1])) foot = v;
    if (crown < 0 || p[v * 3 + 1] > p[crown * 3 + 1]) crown = v;
  }
  // A leg turned a quarter about x swings its foot forward, to about the height of the hip.
  assert.ok(moved[foot * 3 + 2] > 0.3, 'the foot swings forward: ' + moved[foot * 3 + 2]);
  assert.ok(Math.abs(moved[foot * 3 + 1] - 0.5) < 0.1, 'to the height of the hip: ' + moved[foot * 3 + 1]);
  for (let a = 0; a < 3; a++) assert.ok(close(moved[crown * 3 + a], p[crown * 3 + a], 1e-4), 'the head stays');
  // The other leg stays too.
  for (let v = 0; v < p.length / 3; v++)
    if (p[v * 3] < -0.1 && p[v * 3 + 1] < 0.3) assert.ok(close(moved[v * 3 + 2], p[v * 3 + 2], 1e-4));
});

// Break caught: a clip that names bones it does not move, turns them the wrong way, or does not loop.
test('RG04 a clip of poses turns and moves named bones, and play fades between clips', () => {
  const rig = walker();
  const walk = rig.clip('walk', 1, {
    'leg.L': [
      [0, [0.5, 0, 0]],
      [0.5, [-0.5, 0, 0]],
      [1, [0.5, 0, 0]]
    ],
    body: [
      [0, [0, 0, 0], [0, 0, 0]],
      [0.5, [0, 0, 0], [0, 0.1, 0]],
      [1, [0, 0, 0], [0, 0, 0]]
    ]
  });
  assert.ok(walk instanceof AnimationClip3D);
  assert.equal(walk.duration, 1);
  assert.deepEqual(walk.tracks.map(t => t.targetName + ':' + t.path).sort(), [
    'body:position',
    'body:quaternion',
    'leg.L:quaternion'
  ]);
  rig.play(walk, 0);
  rig.update(0.5);
  const q = rig.bones['leg.L'].quaternion;
  assert.ok(close(q[0], Math.sin(-0.25), 1e-4) && close(q[3], Math.cos(-0.25), 1e-4), 'turned back at the half');
  assert.ok(close(rig.bones.body.position[1], 0.7, 1e-4), 'the body rises by its offset from rest');
  rig.update(0.5);
  assert.ok(close(rig.bones['leg.L'].quaternion[0], Math.sin(0.25), 1e-4), 'back where it began');
  const stand = rig.clip('stand', 1, { body: [[0, [0, 0, 0]]] });
  const action = rig.play(stand, 0.3);
  assert.ok(action.isRunning);
  assert.equal(rig.play(stand), action, 'playing what plays changes nothing');
});

// Break caught: a rig that accepts bones it cannot make, or a clip of bones it does not have.
test('RG05 bad bones and clips are refused', () => {
  const ball = sdfSphere(0.5);
  const bad = { code: 'WORLD3D_INPUT_INVALID' };
  const make = bones => createSdfRig3D(ball, bones, { triangles: 500 });
  assert.throws(() => make([]), bad);
  assert.throws(() => make([{ name: 'a', at: [0, 0, 0] }]), bad, 'no parts');
  assert.throws(() => make([{ name: 'a', at: [0, 0], parts: ball }]), bad);
  assert.throws(
    () =>
      make([
        { name: 'a', at: [0, 0, 0], parts: ball },
        { name: 'a', at: [0, 0, 0] }
      ]),
    bad
  );
  assert.throws(() => make([{ name: 'a', parent: 'b', at: [0, 0, 0], parts: ball }]), bad);
  assert.throws(
    () =>
      make([
        { name: 'a', parent: 'b', at: [0, 0, 0], parts: ball },
        { name: 'b', parent: 'a', at: [0, 0, 0] }
      ]),
    bad,
    'a loop'
  );
  assert.throws(() => make([{ name: 'a', at: [0, 0, 0], parts: ball, mirror: 'y' }]), bad);
  assert.throws(() => createSdfRig3D({}, [{ name: 'a', at: [0, 0, 0], parts: ball }]), bad);
  const rig = make([{ name: 'a', at: [0, 0, 0], parts: ball }]);
  assert.throws(() => rig.clip('x', 1, { b: [[0, [0, 0, 0]]] }), bad);
  assert.throws(() => rig.clip('x', 0, { a: [[0, [0, 0, 0]]] }), bad);
  assert.throws(() => rig.clip('x', 1, { a: [[0, [0, 0]]] }), bad);
});
