// SPDX-License-Identifier: Apache-2.0
// Retargeting a clip from one rig to another of other proportions and other
// bone axes: the same turns in rig space, travel scaled by height.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AnimationMixer3D,
  Object3D,
  createAnimationClip3D,
  quatFromAxisAngle,
  quatMultiply,
  retargetAnimationClip3D
} from '@egret/engine/world3d';

const node = (name, parent, position = [0, 0, 0], rest = [0, 0, 0, 1]) => {
  const n = new Object3D();
  n.name = name;
  n.position.set(position);
  n.quaternion.set(rest);
  parent?.addChild(n);
  return n;
};
const turn = (axis, angle) => Array.from(quatFromAxisAngle([0, 0, 0, 1], axis, angle));
const mul = (a, b) => Array.from(quatMultiply([0, 0, 0, 1], a, b));
const inv = q => [-q[0], -q[1], -q[2], q[3]];
const world = n => {
  const chain = [];
  for (let b = n; b && b.name; b = b.parent) chain.unshift(b);
  return chain.reduce((q, b) => mul(q, b.quaternion), [0, 0, 0, 1]);
};
const sameTurn = (a, b, eps = 1e-4) => Math.abs(Math.abs(a.reduce((s, v, i) => s + v * b[i], 0)) - 1) < eps;

function rigs() {
  const sourceRoot = new Object3D();
  const sHips = node('hips', sourceRoot, [0, 1, 0]);
  const sSpine = node('spine', sHips, [0, 0.3, 0]);
  node('head', sSpine, [0, 0.3, 0]);
  // The target's bones point along x at rest, and it is twice as tall.
  const targetRoot = new Object3D();
  const along = turn([0, 0, 1], -Math.PI / 2);
  const tHips = node('Hips', targetRoot, [0, 2, 0], along);
  const tChest = node('Chest', tHips, [0.6, 0, 0]);
  node('Tail', tHips, [-0.5, 0, 0], turn([0, 1, 0], 0.4));
  return { sourceRoot, targetRoot, sHips, sSpine, tHips, tChest };
}

test('RT01 turns away from rest carry over in rig space across different bone axes', () => {
  const { sourceRoot, targetRoot, tHips, tChest } = rigs();
  const bend = turn([1, 0, 0], 0.5),
    twist = turn([0, 1, 0], 0.8);
  const clip = createAnimationClip3D({
    name: 'bow',
    tracks: [
      { targetName: 'spine', path: 'quaternion', times: [0, 1], values: [0, 0, 0, 1, ...bend] },
      { targetName: 'hips', path: 'quaternion', times: [0, 1], values: [0, 0, 0, 1, ...twist] },
      { targetName: 'hips', path: 'position', times: [0, 1], values: [0, 1, 0, 0, 1.2, 0.5] }
    ]
  });
  const out = retargetAnimationClip3D(clip, {
    source: sourceRoot,
    target: targetRoot,
    bones: { Hips: 'hips', Chest: 'spine' },
    root: 'Hips',
    fps: 10
  });
  assert.equal(out.name, 'bow');
  assert.equal(out.duration, 1);
  assert.deepEqual(
    out.tracks.map(t => `${t.targetName}.${t.path}`),
    ['Hips.quaternion', 'Chest.quaternion', 'Hips.position']
  );
  assert.equal(out.tracks[0].times.length, 11);
  // Play it on the target and compare world turns with the source at the end.
  const restHips = world(tHips),
    restChest = world(tChest);
  const mixer = new AnimationMixer3D(targetRoot);
  mixer.clipAction(out).play();
  mixer.update(0.999999);
  const sourceEnd = { hips: twist, spine: mul(twist, bend) };
  assert.ok(sameTurn(mul(world(tHips), inv(restHips)), sourceEnd.hips), 'hips offset');
  assert.ok(sameTurn(mul(world(tChest), inv(restChest)), sourceEnd.spine), 'chest offset');
  // Travel doubles with the height: 0.2 up and 0.5 forward become 0.4 and 1.0.
  assert.ok(Math.abs(tHips.position[1] - 2.4) < 1e-3, String(tHips.position[1]));
  assert.ok(Math.abs(tHips.position[2] - 1.0) < 1e-3, String(tHips.position[2]));
});

test('RT02 by default bones of the same name are paired, and bad options are refused', () => {
  const a = new Object3D();
  node('spine', node('hips', a, [0, 1, 0]), [0, 0.5, 0]);
  const b = new Object3D();
  node('spine', node('hips', b, [0, 1, 0]), [0, 0.5, 0]);
  const clip = createAnimationClip3D({
    tracks: [{ targetName: 'spine', path: 'quaternion', times: [0, 0.5], values: [0, 0, 0, 1, ...turn([0, 0, 1], 1)] }]
  });
  const out = retargetAnimationClip3D(clip, { source: a, target: b });
  assert.deepEqual(out.tracks.map(t => t.targetName).sort(), ['hips', 'spine']);
  const end = out.tracks.find(t => t.targetName === 'spine').values.slice(-4);
  assert.ok(sameTurn(Array.from(end), turn([0, 0, 1], 1)), 'same rigs give the same clip');
  assert.throws(() => retargetAnimationClip3D(clip, { source: a, target: b, bones: { nothing: 'spine' } }), {
    code: 'WORLD3D_INPUT_INVALID'
  });
  assert.throws(() => retargetAnimationClip3D(clip, { source: a, target: b, root: 'tail' }), {
    code: 'WORLD3D_INPUT_INVALID'
  });
  assert.throws(() => retargetAnimationClip3D({}, { source: a, target: b }), { code: 'WORLD3D_INPUT_INVALID' });
});
