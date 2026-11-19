// SPDX-License-Identifier: Apache-2.0
// play3d: what it refuses before it touches a page, the things of its world as plain numbers, and the tests of
// overlap a game stands a ball on a floor with. What needs a page is played in a browser by examples/play/verify.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAY_LOOKS_3D, play3d, PlayLamp3D, PlayThing3D } from '@egret/engine/webgl2/world3d';
import { Mesh3D, Object3D, createBoxGeometry3D, createStandardMaterial3D } from '@egret/engine/world3d';
import { modelBox3D, overlap3D, pushOut3D } from '../packages/engine/dist/web/world3d/BrowserPlay3D.js';

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

// Break caught: take a model's box about its place when its geometry stands above it, or leave out what is under it.
test('P3D04 a model of your own is a thing whose box is worked out from all its meshes, placed as they are', () => {
  const material = createStandardMaterial3D({ color: 0x3355ff });
  // A figure whose feet are at its place: 2 tall, from 0 up.
  const legs = createBoxGeometry3D({ width: 1, height: 2, depth: 0.5 });
  const standing = new Object3D();
  const body = new Mesh3D(legs, material);
  body.setPosition(0, 1, 0);
  standing.addChild(body);
  // A crown above it, turned a quarter and moved to one side, under a group that is itself moved.
  const hat = new Object3D();
  hat.setPosition(0.5, 2, 0);
  const crown = new Mesh3D(createBoxGeometry3D({ width: 2, height: 0.5, depth: 1 }), material);
  crown.setRotation(0, Math.PI / 2, 0);
  hat.addChild(crown);
  standing.addChild(hat);
  // Where the model itself is put does not move its box.
  standing.setPosition(40, 40, 40);
  standing.setScale(3);
  const { half, middle } = modelBox3D(standing);
  const close = (a, b) => a.every((value, i) => Math.abs(value - b[i]) < 1e-6);
  // x from -0.5 to 1 (the crown turned is 1 wide about 0.5), y from 0 to 2.25, z from -1 to 1 (the crown turned is 2 deep).
  assert.ok(close(half, [0.75, 1.125, 1]), JSON.stringify(half));
  assert.ok(close(middle, [0.25, 1.125, 0]), JSON.stringify(middle));
  // A model of nothing is a box of 1 about its place.
  assert.deepEqual(modelBox3D(new Object3D()), { half: [0.5, 0.5, 0.5], middle: [0, 0, 0] });
  // As a thing, its box stands on its place, so a floor under its place pushes it up by how far it is sunk.
  const thing = new PlayThing3D(standing, 0xffffff, half, middle);
  Object.assign(thing, { x: 0, y: -0.25, z: 0, scale: 1 });
  const floor = box(24, 1, 24, { y: -0.5 });
  const push = pushOut3D(thing, floor);
  assert.ok(push.x === 0 && push.z === 0 && Math.abs(push.y - 0.25) < 1e-6, JSON.stringify(push));
  // It keeps its own colours: a colour set on it is not taken.
  thing.color = 0xff0000;
  assert.equal(thing.color, 0xffffff);
  assert.deepEqual(
    [...material.color].map(value => Math.round(value * 1000)),
    [...createStandardMaterial3D({ color: 0x3355ff }).color].map(value => Math.round(value * 1000))
  );
});

// Break caught: choose an escape by model origins instead of their offset, scaled box centres.
test('P3D05 an offset model leaves a block on the side nearest its box centre', () => {
  for (const axis of ['x', 'y', 'z']) {
    for (const scale of [1, -1]) {
      const half = [0.5, 0.5, 0.5],
        middle = [0, 0, 0],
        at = ['x', 'y', 'z'].indexOf(axis);
      half[at] = 1;
      middle[at] = scale;
      const thing = new PlayThing3D(new Object3D(), 0xffffff, half, middle);
      thing.scale = scale;
      thing[axis] = 0.25;
      const dimensions = [10, 10, 10];
      dimensions[at] = 1;
      const block = box(...dimensions, { [axis]: 1 });
      const push = pushOut3D(thing, block);
      assert.equal(push[axis], 1.25, axis + ' is pushed towards its nearer positive face');
      for (const other of ['x', 'y', 'z']) if (other !== axis) assert.equal(push[other], 0);
      for (const direction of ['x', 'y', 'z']) thing[direction] += push[direction];
      assert.ok(
        overlap3D(thing, block).some(depth => depth <= 0),
        'applying the move separates the boxes'
      );
    }
  }
});

// Break caught: setting one rotation axis discards the other axes of an imported root.
test('P3D06 a model starts with its imported rotation and keeps the other axes when turned', () => {
  const root = new Object3D();
  root.setRotation(Math.PI / 2, 0, -Math.PI / 6);
  root.setScale(3);
  const thing = new PlayThing3D(root, 0xffffff, [1, 2, 3]);
  assert.equal(thing.node, root, 'the model keeps its identity');
  assert.ok(Math.abs(thing.rotationX - 90) < 1e-4);
  assert.ok(Math.abs(thing.rotationZ + 30) < 1e-4);
  thing.rotationY = 10;
  const expected = new Object3D().setRotation(Math.PI / 2, Math.PI / 18, -Math.PI / 6);
  const alignment = Math.abs([...root.quaternion].reduce((sum, value, i) => sum + value * expected.quaternion[i], 0));
  assert.ok(alignment > 0.999999, 'changing Y preserves the imported X and Z');
  assert.equal(thing.scale, 3);
  // Euler angles are not unique at a pole; writing the reported axes must preserve its orientation.
  for (const y of [Math.PI / 2, -Math.PI / 2, Math.PI / 2 - 0.00001]) {
    const model = new Object3D().setRotation(0.4, y, -0.2),
      before = [...model.quaternion];
    const imported = new PlayThing3D(model, 0xffffff, [1, 1, 1]);
    imported.rotationX = imported.rotationX;
    const same = Math.abs([...model.quaternion].reduce((sum, value, i) => sum + value * before[i], 0));
    assert.ok(same > 0.999999, 'the gimbal-pole representation keeps the quaternion orientation');
  }
});

// Break caught: a removed primitive keeps its owned GPU-backed resources alive, or disposes a borrowed model.
test('P3D07 leaving disposes owned primitive resources once and keeps borrowed model resources live', () => {
  const primitive = box(1, 2, 3),
    mesh = primitive.node;
  let geometryEnds = 0,
    materialEnds = 0;
  mesh.geometry.onDispose(() => geometryEnds++);
  mesh.material.onDispose(() => materialEnds++);
  primitive.leave();
  primitive.leave();
  assert.deepEqual(
    [mesh.geometry.isDisposed, mesh.material.isDisposed, geometryEnds, materialEnds],
    [true, true, 1, 1]
  );
  // The caller still owns a model and any resources shared by its meshes.
  const sharedGeometry = createBoxGeometry3D({ width: 1, height: 1, depth: 1 });
  const sharedMaterial = createStandardMaterial3D({ color: 0xffffff });
  const group = new Object3D();
  group.addChild(new Mesh3D(sharedGeometry, sharedMaterial));
  const borrowed = new PlayThing3D(group, 0xffffff, [0.5, 0.5, 0.5]);
  borrowed.leave();
  assert.deepEqual([sharedGeometry.isDisposed, sharedMaterial.isDisposed], [false, false]);
  sharedGeometry.dispose();
  sharedMaterial.dispose();
});

// Break caught: a failed geometry release prevents its separately owned material from being released.
test('P3D08 a resource listener failure still retires the other resources of a thing', () => {
  const primitive = box(1, 1, 1),
    failure = new Error('geometry release failed');
  primitive.node.geometry.onDispose(() => {
    throw failure;
  });
  assert.throws(
    () => primitive.leave(),
    cause => cause === failure
  );
  assert.ok(primitive.node.geometry.isDisposed);
  assert.ok(primitive.node.material.isDisposed);
  assert.ok(primitive.removed);
  assert.doesNotThrow(() => primitive.leave(), 'a failed cleanup is not repeated');
});

// Break caught: a caller-owned detach method throws before the primitive can release its resources.
test('P3D09 a failed detach still releases the owned geometry and material', () => {
  const primitive = box(1, 1, 1),
    failure = new Error('detach failed');
  const parent = new Object3D();
  parent.addChild(primitive.node);
  const detach = primitive.node.removeFromParent;
  // This is the test's genuine mesh instance; no shared or native prototype is changed.
  primitive.node.removeFromParent = () => {
    throw failure;
  };
  try {
    assert.throws(
      () => primitive.leave(),
      cause => cause === failure
    );
    assert.ok(primitive.node.geometry.isDisposed);
    assert.ok(primitive.node.material.isDisposed);
    assert.ok(primitive.removed);
    assert.doesNotThrow(() => primitive.leave(), 'a failed cleanup is not repeated');
  } finally {
    primitive.node.removeFromParent = detach;
    primitive.node.removeFromParent();
  }
});

// Break caught: leave out a part of a look, give a colour that is not one, or a sun from under the ground.
test('P3D05 every look gives each part, colours as 0xRRGGBB, a sun above and fog of 0 or more', () => {
  assert.deepEqual(Object.keys(PLAY_LOOKS_3D), ['day', 'dusk', 'night', 'fog', 'snow']);
  for (const [name, look] of Object.entries(PLAY_LOOKS_3D)) {
    assert.deepEqual(
      Object.keys(look).sort(),
      ['background', 'fog', 'ground', 'light', 'sky', 'sun', 'sunFrom', 'sunIntensity'],
      name
    );
    for (const key of ['background', 'sky', 'ground', 'sun'])
      assert.ok(Number.isInteger(look[key]) && look[key] >= 0 && look[key] <= 0xffffff, name + ' ' + key);
    assert.ok(look.sunFrom.length === 3 && look.sunFrom[1] > 0, name);
    assert.ok(look.fog >= 0 && look.light >= 0 && look.sunIntensity >= 0, name);
  }
  assert.ok(Object.isFrozen(PLAY_LOOKS_3D));
});

// Break caught: let a thing glow in a colour it no longer has, take a glow below 0, or make a model's materials glow.
test('P3D10 a thing glows with its own colour, as strongly as asked, and follows a new colour', () => {
  const thing = box(1, 1, 1),
    material = thing.node.material,
    linear = code => (code / 255 <= 0.04045 ? code / 255 / 12.92 : ((code / 255 + 0.055) / 1.055) ** 2.4);
  assert.equal(thing.glow, 0);
  assert.deepEqual([...material.emissive], [0, 0, 0]);
  thing.color = 0xff8000;
  thing.glow = 2;
  assert.equal(material.emissiveIntensity, 2);
  assert.deepEqual([...material.emissive], [1, linear(0x80), 0].map(Math.fround));
  thing.color = 0x0000ff;
  assert.deepEqual([...material.emissive], [0, 0, 1]);
  for (const bad of [-1, NaN, '2']) thing.glow = bad;
  assert.equal(thing.glow, 2);
  thing.glow = 0;
  assert.deepEqual([...material.emissive, material.emissiveIntensity], [0, 0, 0, 0]);
  const model = new PlayThing3D(new Object3D(), 0xffffff, [1, 1, 1]);
  model.glow = 3;
  assert.equal(model.glow, 0);
  thing.leave();
});

// Break caught: give a lamp no range, take a colour that is not one, or leave it lit after it has been put out.
test('P3D11 a lamp is placed and changed by plain numbers, and put out once', () => {
  const lamp = new PlayLamp3D(0xffb347, 6, 7),
    scene = new Object3D();
  scene.addChild(lamp.node);
  assert.equal(lamp.node.lightType, 'point');
  assert.deepEqual([lamp.color, lamp.intensity, lamp.range, lamp.visible], [0xffb347, 6, 7, true]);
  lamp.x = 2;
  lamp.y = 3;
  lamp.z = -1;
  assert.deepEqual([...lamp.node.position], [2, 3, -1]);
  lamp.color = 0x00ff00;
  lamp.intensity = 0;
  lamp.range = 12;
  for (const bad of [NaN, -1, '4', 0x1000000, 0.5]) lamp.color = bad;
  for (const bad of [NaN, -1, '4']) {
    lamp.intensity = bad;
    lamp.range = bad;
  }
  for (const bad of [NaN, Infinity, '4']) lamp.x = bad;
  lamp.range = 0;
  assert.deepEqual([lamp.color, lamp.intensity, lamp.range, lamp.x], [0x00ff00, 0, 12, 2]);
  assert.deepEqual([...lamp.node.color], [0, 1, 0]);
  lamp.leave();
  lamp.leave();
  assert.deepEqual([lamp.removed, lamp.node.parent], [true, undefined]);
});
