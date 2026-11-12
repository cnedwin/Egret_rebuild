// SPDX-License-Identifier: Apache-2.0
// How the World3D physics world holds together and scales: the hierarchy of static bodies,
// face contacts between boxes, piles that sleep as one, solver slices and swept fast bodies.
import assert from 'node:assert/strict';
import test from 'node:test';
import { World3DError, createPhysicsWorld3D } from '@egret/engine/world3d';

const code = value => error => error instanceof World3DError && error.code === value;
const close = (actual, expected, epsilon = 1e-3) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const run = (world, seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) world.step(1 / 60); };
const cube = half => ({type: 'box', halfExtents: [half, half, half]});

test('queries over many static bodies find exactly what a search of every body would', () => {
  const world = createPhysicsWorld3D({gravity: [0, 0, 0]}), blocks = [];
  // A field of 1,600 blocks of varying height, one unit apart.
  for (let x = 0; x < 40; x++) for (let z = 0; z < 40; z++) blocks.push(world.createBody({type: 'static', shape: {type: 'box', halfExtents: [0.4, 0.5 + ((x * 7 + z * 13) % 5) * 0.2, 0.4]}, position: [x, 0, z], userData: [x, z]}));
  const top = (x, z) => 0.5 + ((x * 7 + z * 13) % 5) * 0.2;
  for (const [x, z] of [[0, 0], [17, 23], [39, 39], [5, 31]]) {
    const hit = world.raycast([x, 10, z], [0, -1, 0], 20);
    assert.deepEqual(hit.body.userData, [x, z]); close(hit.distance, 10 - top(x, z));
  }
  // Along a row at a height only the tallest blocks reach: the first one taller than the ray.
  const row = world.raycast([-5, 1.2, 12], [1, 0, 0], 100);
  let first = 0; while (top(first, 12) <= 1.2) first++;
  assert.deepEqual(row.body.userData, [first, 12]); close(row.distance, 5 + first - 0.4);
  assert.equal(world.raycast([-5, 1.4, 12], [1, 0, 0], 100), undefined);
  assert.equal(world.raycast([-5, 1.2, 12.5], [1, 0, 0], 100), undefined);
  // A sphere over a corner where four blocks meet touches those four.
  const near = world.overlapSphere([10.5, 0.3, 20.5], 0.3).map(body => body.userData.join()).sort();
  assert.deepEqual(near, ['10,20', '10,21', '11,20', '11,21']);
  // A sweep straight down lands on the block beneath it.
  const landed = world.shapeCast({type: 'sphere', radius: 0.3}, [22, 8, 9], [0, -1, 0], 20);
  assert.deepEqual(landed.body.userData, [22, 9]); close(landed.distance, 8 - top(22, 9) - 0.3, 2e-3);
  // Moving or removing a static body is seen by the next query.
  const moved = blocks[17 * 40 + 23];
  moved.setPosition(17, 30, 23);
  assert.deepEqual(world.raycast([17, 10, 23], [0, 1, 0], 100).body, moved);
  assert.equal(world.raycast([17, 10, 23], [0, -1, 0], 100), undefined);
  world.removeBody(blocks[0]);
  assert.equal(world.raycast([0, 10, 0], [0, -1, 0], 20), undefined);
  const added = world.createBody({type: 'static', shape: cube(0.4), position: [0, 0, 0]});
  assert.equal(world.raycast([0, 10, 0], [0, -1, 0], 20).body, added);
});

test('moving bodies collide with the static bodies near them and with no others', () => {
  const world = createPhysicsWorld3D();
  for (let x = 0; x < 30; x++) for (let z = 0; z < 30; z++) world.createBody({type: 'static', shape: {type: 'box', halfExtents: [0.5, 0.5, 0.5]}, position: [x, 0, z]});
  const balls = [];
  for (let i = 0; i < 20; i++) balls.push(world.createBody({mass: 1, shape: {type: 'sphere', radius: 0.3}, position: [1.5 + i, 2, 3.5 + i], restitution: 0}));
  run(world, 3);
  for (const ball of balls) close(ball.position[1], 0.8, 0.02);
  // Each resting ball touches the four blocks whose corner it sits over, or fewer; never the whole floor.
  assert.ok(world.contactCount <= 80, String(world.contactCount));
  assert.ok(balls.every(ball => ball.isSleeping));
});

test('a box resting askew on another is held by the whole shared patch and does not rock', () => {
  const world = createPhysicsWorld3D({allowSleep: false});
  world.createBody({type: 'static', shape: cube(0.5), position: [0, 0.5, 0]});
  // Shifted along both axes: only one corner of each box lies inside the other.
  const upper = world.createBody({mass: 1, shape: cube(0.5), position: [0.3, 1.5, 0.3], restitution: 0});
  run(world, 3);
  // The overlap is a square with four corners, two of them where edges cross.
  assert.equal(world.contactCount, 4);
  close(upper.position[0], 0.3, 0.01); close(upper.position[2], 0.3, 0.01); close(upper.position[1], 1.5, 0.02);
  close(Math.abs(upper.quaternion[3]), 1, 1e-4);
  assert.ok(Math.hypot(...upper.angularVelocity) < 0.01 && Math.hypot(...upper.linearVelocity) < 0.01);
  // Past its balance point it tips off.
  const far = world.createBody({mass: 1, shape: cube(0.5), position: [-0.7, 1.5, 0], restitution: 0});
  run(world, 2);
  assert.ok(far.position[1] < 1.2);
});

test('a turned box on a box still gets a contact at every corner of the overlap', () => {
  const world = createPhysicsWorld3D({allowSleep: false});
  world.createBody({type: 'static', shape: {type: 'box', halfExtents: [1, 0.5, 1]}, position: [0, 0.5, 0]});
  const angle = Math.PI / 4, upper = world.createBody({mass: 1, shape: cube(0.5), position: [0.8, 1.5, 0], quaternion: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)], restitution: 0});
  run(world, 2);
  // The diamond overhangs the edge: its overlap with the top face is a pentagon.
  assert.equal(world.contactCount, 5);
  close(upper.position[1], 1.5, 0.02); close(upper.position[0], 0.8, 0.01);
  assert.ok(Math.hypot(...upper.angularVelocity) < 0.01);
});

test('a pile rests and wakes as one', () => {
  const world = createPhysicsWorld3D();
  world.createBody({type: 'static', shape: {type: 'plane'}});
  const pile = [0, 1, 2].map(i => world.createBody({mass: 1, shape: cube(0.5), position: [0, 0.5 + i, 0], restitution: 0}));
  const apart = world.createBody({mass: 1, shape: cube(0.5), position: [5, 0.5, 0], restitution: 0});
  // While the top box is kept turning, nothing in its pile may fall asleep under it; the box standing apart does.
  for (let i = 0; i < 90; i++) { pile[2].setAngularVelocity(0, 1, 0); world.step(1 / 60); }
  assert.deepEqual(pile.map(body => body.isSleeping), [false, false, false]);
  assert.equal(apart.isSleeping, true);
  run(world, 2);
  assert.deepEqual(pile.map(body => body.isSleeping), [true, true, true]);
  // Taking out the bottom box wakes what stood on it.
  world.removeBody(pile[0]);
  run(world, 0.2);
  assert.equal(pile[1].isSleeping, false); assert.equal(pile[2].isSleeping, false);
  run(world, 3);
  close(pile[1].position[1], 0.5, 0.02); close(pile[2].position[1], 1.5, 0.03);
  assert.deepEqual(pile.slice(1).map(body => body.isSleeping), [true, true]);
});

test('bodies joined by a joint sleep together', () => {
  const world = createPhysicsWorld3D();
  world.createBody({type: 'static', shape: {type: 'plane'}});
  const a = world.createBody({mass: 1, shape: cube(0.25), position: [0, 0.25, 0], restitution: 0});
  const b = world.createBody({mass: 1, shape: cube(0.25), position: [2, 0.25, 0], restitution: 0});
  world.createJoint({type: 'distance', bodyA: a, bodyB: b});
  for (let i = 0; i < 90; i++) { b.setAngularVelocity(0, 2, 0); world.step(1 / 60); }
  assert.equal(a.isSleeping, false);
  run(world, 2);
  assert.equal(a.isSleeping, true); assert.equal(b.isSleeping, true);
});

test('solver slices hold a heavy load on a light chain much better for the same work', () => {
  const stretch = (options) => {
    const world = createPhysicsWorld3D({...options, allowSleep: false});
    let previous, last;
    for (let i = 0; i < 12; i++) {
      const heavy = i === 11;
      last = world.createBody({mass: heavy ? 50 : 1, shape: {type: 'sphere', radius: heavy ? 0.4 : 0.1}, position: [0, -0.5 - i * 0.5, 0], linearDamping: 0.05});
      world.createJoint({type: 'point', bodyA: last, ...(previous ? {bodyB: previous} : {}), anchor: [0, -i * 0.5, 0]});
      previous = last;
    }
    run(world, 5);
    return -last.position[1] - 6;
  };
  const whole = stretch({iterations: 8}), sliced = stretch({iterations: 2, solverSteps: 4});
  assert.ok(whole > 0.2, String(whole));
  assert.ok(sliced < whole * 0.5, `${sliced} against ${whole}`);
  assert.equal(createPhysicsWorld3D({solverSteps: 100}).solverSteps, 8);
  assert.equal(createPhysicsWorld3D({solverSteps: 0}).solverSteps, 1);
  assert.equal(createPhysicsWorld3D().solverSteps, 1);
});

test('a tower of ten boxes stands and goes to sleep, with or without slices', () => {
  for (const options of [{}, {iterations: 2, solverSteps: 4}]) {
    const world = createPhysicsWorld3D(options);
    world.createBody({type: 'static', shape: {type: 'plane'}});
    const boxes = [];
    for (let i = 0; i < 10; i++) boxes.push(world.createBody({mass: 1, shape: cube(0.5), position: [0, 0.5 + i, 0]}));
    run(world, 10);
    for (const [i, box] of boxes.entries()) {
      assert.ok(Math.hypot(box.position[0], box.position[2]) < 0.08, `box ${i} slid ${Math.hypot(box.position[0], box.position[2])}`);
      close(box.position[1], 0.5 + i, 0.15);
    }
    assert.ok(boxes.every(box => box.isSleeping), JSON.stringify(options));
  }
});

test('contact reports add up the push over all slices of a step', () => {
  for (const solverSteps of [1, 4]) {
    const world = createPhysicsWorld3D({solverSteps, allowSleep: false});
    world.createBody({type: 'static', shape: {type: 'plane'}});
    world.createBody({mass: 3, shape: cube(0.5), position: [0, 0.5, 0], restitution: 0});
    let last = 0;
    world.onContact = contact => { last = contact.impulse; };
    run(world, 2);
    // Holding three kilograms up for one step takes its weight times the step.
    close(last, 3 * 9.81 / 60, 0.02);
  }
});

test('overlapping bodies are moved apart without being flung', () => {
  const world = createPhysicsWorld3D({gravity: [0, 0, 0], allowSleep: false});
  world.createBody({type: 'static', shape: cube(0.5)});
  const ball = world.createBody({mass: 1, shape: {type: 'sphere', radius: 0.5}, position: [0.8, 0, 0], linearDamping: 0});
  let fastest = 0;
  for (let i = 0; i < 120; i++) { world.step(1 / 60); fastest = Math.max(fastest, Math.hypot(...ball.linearVelocity)); }
  // It ends just touching, and never picked up more than a crawl on the way out.
  close(ball.position[0], 1, 0.02);
  assert.ok(fastest < 0.05, String(fastest));
});

test('a fast body is stopped by what its side would hit, not only by what lies dead ahead', () => {
  const world = createPhysicsWorld3D({gravity: [0, 0, 0]});
  const post = world.createBody({type: 'static', shape: {type: 'box', halfExtents: [0.02, 2, 0.02]}, position: [5, 0, 0.9]});
  const hits = [];
  world.onContactBegin = (a, b) => hits.push(a === post || b === post);
  // A plank lying across its path: its center passes the post nearly a metre to the side.
  const plank = world.createBody({mass: 1, shape: {type: 'box', halfExtents: [0.05, 0.05, 1]}, position: [0, 0, 0], continuous: true, linearDamping: 0, restitution: 0});
  plank.setLinearVelocity(120, 0, 0);
  run(world, 0.25);
  assert.deepEqual(hits, [true]);
  // Caught near one end, the plank is swung round the post.
  assert.ok(Math.abs(plank.angularVelocity[1]) > 5, String(plank.angularVelocity[1]));
  assert.ok(plank.linearVelocity[0] < 110, String(plank.linearVelocity[0]));
  // Without the sweep the same plank is past the post before any step sees them overlap.
  const free = world.createBody({mass: 1, shape: {type: 'box', halfExtents: [0.05, 0.05, 1]}, position: [0, 3, 0], linearDamping: 0});
  world.createBody({type: 'static', shape: {type: 'box', halfExtents: [0.02, 0.5, 0.02]}, position: [5, 3, 0.9]});
  free.setLinearVelocity(120, 0, 0);
  run(world, 0.25);
  assert.ok(free.position[0] > 29 && Math.abs(free.angularVelocity[1]) < 1e-6);
});

test('a fast body sliding along the floor is not held back by the floor it rests on', () => {
  const world = createPhysicsWorld3D();
  world.createBody({type: 'static', shape: {type: 'plane'}});
  const wall = world.createBody({type: 'static', shape: {type: 'box', halfExtents: [0.05, 1, 3]}, position: [20, 1, 0], restitution: 0});
  const puck = world.createBody({mass: 1, shape: cube(0.2), position: [0, 0.2, 0], continuous: true, friction: 0, linearDamping: 0, restitution: 0});
  run(world, 0.5);
  puck.setLinearVelocity(60, 0, 0);
  world.step(1 / 60); world.step(1 / 60); world.step(1 / 60);
  // Three steps at sixty metres a second: three metres, none of them lost to the floor.
  close(puck.position[0], 3, 0.05);
  run(world, 1);
  // It reached the wall and stopped there instead of passing through.
  assert.ok(puck.position[0] > 19 && puck.position[0] < 19.8, String(puck.position[0]));
  assert.equal(wall.type, 'static');
  assert.throws(() => createPhysicsWorld3D({fixedStep: 0}), code('WORLD3D_INPUT_INVALID'));
});
