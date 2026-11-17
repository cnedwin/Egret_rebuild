// SPDX-License-Identifier: Apache-2.0
// play3d: what it refuses before it touches a page, the things of its world as plain numbers, and the tests of
// overlap a game stands a ball on a floor with. What needs a page is played in a browser by examples/play/verify.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { play3d, PlayThing3D } from '@egret/engine/webgl2/world3d';
import { createBoxGeometry3D } from '@egret/engine/world3d';
import { overlap3D, pushOut3D } from '../packages/engine/dist/web/world3d/BrowserPlay3D.js';

const refusal = async run => {
  try {
    await run();
  } catch (cause) {
    return cause;
  }
  return undefined;
};
const box = (width, height, depth, at = {}) => {
  const thing = new PlayThing3D(createBoxGeometry3D({ width, height, depth }), 0xffffff, [
    width / 2,
    height / 2,
    depth / 2
  ]);
  Object.assign(thing, at);
  return thing;
};

test('P3D01 what is not a 3D game is refused, and the message says which part', async () => {
  for (const [bad, why] of [
    [null, /object of options/],
    ['game', /object of options/],
    [{ width: 960, height: 540, background: '#000' }, /background/],
    [{ width: 960, height: 540, setup: 1 }, /setup/],
    [{ width: 960, height: 540, update: 'step' }, /update/],
    [{ width: 960, height: 540, canvas: {} }, /its own canvases/],
    [{ width: 0, height: 540 }, /width and height/]
  ]) {
    const error = await refusal(() => play3d(bad));
    assert.equal(error?.code, 'PLAY_OPTIONS_INVALID', JSON.stringify(bad));
    assert.match(error.cause.message, why);
    assert.match(error.message, why);
  }
});

// Break caught: leave a thing where it was when a number of it is set, or take what is not a number.
test('P3D02 a thing is placed, turned, sized and coloured by plain numbers', () => {
  const thing = box(2, 1, 4);
  assert.deepEqual([thing.x, thing.y, thing.z, thing.scale, thing.visible, thing.removed], [0, 0, 0, 1, true, false]);
  thing.x = 3;
  thing.y = -1.5;
  thing.z += 2;
  assert.deepEqual([...thing.node.position], [3, -1.5, 2]);
  thing.rotationY = 90;
  thing.rotationX += 45;
  assert.deepEqual([thing.rotationX, thing.rotationY, thing.rotationZ], [45, 90, 0]);
  assert.ok(Math.abs(Math.hypot(...thing.node.quaternion) - 1) < 1e-6 && Math.abs(thing.node.quaternion[3]) < 0.99);
  thing.scale = 2;
  thing.scaleY = 0.5;
  assert.deepEqual([...thing.node.scale], [2, 0.5, 2]);
  assert.equal(thing.color, 0xffffff);
  thing.color = 0xff0000;
  assert.equal(thing.color, 0xff0000);
  for (const bad of [NaN, Infinity, '3', undefined]) {
    thing.x = bad;
    thing.rotationZ = bad;
    thing.scale = bad;
    thing.color = bad;
  }
  assert.deepEqual([thing.x, thing.rotationZ, thing.scaleX, thing.color], [3, 0, 2, 0xff0000]);
  // It takes properties of the game's own, and after it has left the world setting it is harmless.
  thing.hp = 3;
  thing.leave();
  thing.x = 9;
  assert.deepEqual([thing.hp, thing.removed, thing.x, thing.node.parent], [3, true, 9, undefined]);
});

// Break caught: push a ball out of a floor sideways, or call two things apart on one axis overlapping.
test('P3D03 two things overlap as upright boxes, and the way out is the shortest, up first', () => {
  const floor = box(24, 1, 24, { y: -0.5 }),
    ball = box(1, 1, 1, { y: 0.4 });
  // A place is kept as a 32-bit number, so what comes back is within a millionth.
  const up = pushOut3D(ball, floor);
  assert.ok(up.x === 0 && up.z === 0 && Math.abs(up.y - 0.1) < 1e-6, JSON.stringify(up));
  ball.y = 0.5;
  assert.equal(pushOut3D(ball, floor), undefined, 'touching is not overlapping');
  // Against the side of a block the way out is sideways, away from its middle.
  const block = box(4, 1, 4, { x: 6, y: 0.5, z: -4 });
  ball.x = 3.8;
  ball.z = -4;
  const side = pushOut3D(ball, block);
  assert.ok(Math.abs(side.x + 0.3) < 1e-6 && side.y === 0 && side.z === 0, JSON.stringify(side));
  ball.x = 6;
  ball.z = -1.7;
  const front = pushOut3D(ball, block);
  assert.ok(front.x === 0 && front.y === 0 && Math.abs(front.z - 0.2) < 1e-6, JSON.stringify(front));
  // From under it, the way out is down.
  ball.z = -4;
  ball.y = -0.3;
  assert.ok(pushOut3D(ball, block).y < 0);
  // Apart on any one axis is apart.
  for (const [x, y, z] of [
    [9, 0.5, -4],
    [6, 2, -4],
    [6, 0.5, 0]
  ]) {
    Object.assign(ball, { x, y, z });
    assert.equal(pushOut3D(ball, block), undefined);
    assert.ok(overlap3D(ball, block).some(depth => depth <= 0));
  }
  // The scale of a thing is the scale of its box, and a shrink takes off every side.
  Object.assign(ball, { x: 9, y: 0.5, z: -4, scale: 3 });
  assert.ok(overlap3D(ball, block).every(depth => depth > 0));
  assert.ok(overlap3D(ball, block, 0.3)[0] <= 0);
});
