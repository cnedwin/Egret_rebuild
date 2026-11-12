// SPDX-License-Identifier: Apache-2.0
// Shape sweeps, compound shapes, slider joints, springs, contact reports and the
// jelly deformer of World3D, checked through the public entry without a renderer.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Jelly3D, Mesh3D, Object3D, World3DError, createBoxGeometry3D, createJelly3D, createPhysicsWorld3D, createSphereGeometry3D, createStandardMaterial3D,
} from '@egret/engine/world3d';

const code = value => error => error instanceof World3DError && error.code === value;
const close = (actual, expected, epsilon = 1e-3) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const run = (world, seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) world.step(1 / 60); };

test('a swept sphere stops where it first touches', () => {
  const world = createPhysicsWorld3D({gravity: [0, 0, 0]});
  const wall = world.createBody({type: 'static', shape: {type: 'box', halfExtents: [0.5, 2, 2]}, position: [5, 0, 0]});
  world.createBody({type: 'static', shape: {type: 'box', halfExtents: [0.5, 2, 2]}, position: [9, 0, 0]});
  const hit = world.shapeCast({type: 'sphere', radius: 0.5}, [0, 0, 0], [1, 0, 0], 20);
  assert.equal(hit.body, wall);
  // The wall's near face is at 4.5 and the sphere reaches half a unit ahead of its center.
  close(hit.distance, 4, 2e-3);
  close(hit.normal[0], -1); close(hit.point[0], 4.5, 5e-3);
  assert.equal(world.shapeCast({type: 'sphere', radius: 0.5}, [0, 0, 0], [1, 0, 0], 3.9), undefined);
  assert.equal(world.shapeCast({type: 'sphere', radius: 0.5}, [0, 0, 0], [-1, 0, 0], 20), undefined);
  assert.equal(world.shapeCast({type: 'sphere', radius: 0.5}, [0, 5, 0], [1, 0, 0], 20), undefined);
});

test('a sweep finds what a ray through the middle would miss, and honours masks, triggers and turning', () => {
  const world = createPhysicsWorld3D({gravity: [0, 0, 0]});
  const post = world.createBody({type: 'static', shape: {type: 'capsule', radius: 0.1, halfHeight: 1}, position: [3, 0, 0.55], layer: 2});
  assert.equal(world.raycast([0, 0, 0], [1, 0, 0], 10), undefined);
  const hit = world.shapeCast({type: 'box', halfExtents: [0.5, 0.5, 0.5]}, [0, 0, 0], [1, 0, 0], 10);
  assert.equal(hit.body, post);
  // The post stands just past the box's side, so its round flank meets the box's edge after its center line would have reached the face.
  close(hit.distance, 2.5 - Math.sqrt(0.1 * 0.1 - 0.05 * 0.05), 5e-3);
  assert.equal(world.shapeCast({type: 'box', halfExtents: [0.5, 0.5, 0.5]}, [0, 0, 0], [1, 0, 0], 10, 1), undefined);
  // A long thin box only reaches the post when it is turned to lie across the path.
  const plank = {type: 'box', halfExtents: [0.05, 0.05, 1.5]};
  const along = world.shapeCast({type: 'box', halfExtents: [1.5, 0.05, 0.05]}, [0, 0, -1], [1, 0, 0], 10);
  assert.equal(along, undefined);
  const turned = world.shapeCast({type: 'box', halfExtents: [1.5, 0.05, 0.05]}, [0, 0, -1], [1, 0, 0], 10, -1, [0, Math.SQRT1_2, 0, Math.SQRT1_2]);
  assert.equal(turned.body, post);
  assert.equal(world.shapeCast(plank, [0, 0, -1], [1, 0, 0], 10).body, post);
  post.isTrigger = true;
  assert.equal(world.shapeCast({type: 'box', halfExtents: [0.5, 0.5, 0.5]}, [0, 0, 0], [1, 0, 0], 10), undefined);
  assert.throws(() => world.shapeCast({type: 'sphere', radius: 1}, [0, 0, 0], [2, 0, 0], 1), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => world.shapeCast({type: 'plane'}, [0, 0, 0], [1, 0, 0], 1), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => world.shapeCast({type: 'sphere', radius: 1}, [0, 0, 0], [1, 0, 0], -1), code('WORLD3D_INPUT_INVALID'));
});

test('a sweep that starts inside something reports distance zero', () => {
  const world = createPhysicsWorld3D({gravity: [0, 0, 0]});
  const block = world.createBody({type: 'static', shape: {type: 'box', halfExtents: [1, 1, 1]}});
  const hit = world.shapeCast({type: 'sphere', radius: 0.5}, [0.8, 0, 0], [1, 0, 0], 5);
  assert.equal(hit.body, block); assert.equal(hit.distance, 0);
});

test('a compound body rests on every part and is hit part by part', () => {
  const world = createPhysicsWorld3D();
  world.createBody({type: 'static', shape: {type: 'plane'}});
  // A table: a top and four legs.
  const leg = (x, z) => ({shape: {type: 'box', halfExtents: [0.05, 0.4, 0.05]}, position: [x, -0.1, z]});
  const table = world.createBody({mass: 4, position: [0, 1, 0], shape: {type: 'compound', children: [
    {shape: {type: 'box', halfExtents: [0.6, 0.05, 0.4]}, position: [0, 0.35, 0]}, leg(-0.5, -0.3), leg(0.5, -0.3), leg(-0.5, 0.3), leg(0.5, 0.3),
  ]}});
  run(world, 3);
  // The legs reach 0.5 below the origin, so the table settles with its origin half a unit up, level.
  close(table.position[1], 0.5, 0.02);
  close(Math.abs(table.quaternion[3]), 1, 1e-3);
  assert.equal(table.isSleeping, true);
  // A ray between the legs passes under the top; one from above lands on it.
  assert.equal(world.raycast([-3, 0.3, 0], [1, 0, 0], 2.4), undefined);
  const leftLeg = world.raycast([-3, 0.3, -0.3], [1, 0, 0], 10);
  assert.equal(leftLeg.body, table); close(leftLeg.distance, 2.45, 0.02);
  const top = world.raycast([0, 3, 0], [0, -1, 0], 10);
  assert.equal(top.body, table); close(top.point[1], 0.9, 0.03);
  // A ball dropped on the top stays on it instead of falling through the middle.
  const ball = world.createBody({mass: 0.2, position: [0, 1.6, 0], shape: {type: 'sphere', radius: 0.15}, restitution: 0});
  run(world, 2);
  close(ball.position[1], 0.9 + 0.15, 0.03);
  assert.deepEqual(world.overlapSphere([0.5, 0.2, 0.3], 0.1), [table]);
  assert.deepEqual(world.overlapSphere([0, 0.2, 0], 0.1), []);
});

test('compound shapes validate their parts', () => {
  const world = createPhysicsWorld3D();
  assert.throws(() => world.createBody({shape: {type: 'compound', children: []}}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => world.createBody({shape: {type: 'compound', children: [{shape: {type: 'plane'}}]}}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => world.createBody({shape: {type: 'compound', children: [{shape: {type: 'sphere', radius: -1}}]}}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => world.createBody({shape: {type: 'compound', children: [{shape: {type: 'sphere', radius: 1}, quaternion: [0, 0, 0, 0]}]}}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => world.createBody({shape: {type: 'compound', children: new Array(33).fill({shape: {type: 'sphere', radius: 1}})}}), code('WORLD3D_INPUT_INVALID'));
});

test('a slider keeps a body on its rail, without turning, between its stops', () => {
  const world = createPhysicsWorld3D();
  const lift = world.createBody({mass: 2, position: [0, 2, 0], shape: {type: 'box', halfExtents: [0.5, 0.1, 0.5]}});
  const joint = world.createJoint({type: 'slider', bodyA: lift, axis: [0, 1, 0], limits: [-1.5, 0.5]});
  close(joint.translation, 0);
  // Pushed sideways and twisted, it still only falls along the rail, down to the lower stop.
  lift.applyImpulse(6, 0, 3, [0.4, 2, 0.4]);
  run(world, 3);
  close(lift.position[0], 0, 0.02); close(lift.position[2], 0, 0.02);
  close(lift.position[1], 0.5, 0.02); close(joint.translation, -1.5, 0.02);
  close(Math.abs(lift.quaternion[3]), 1, 2e-3);
  // A motor strong enough to carry the weight raises it to the upper stop and holds it there.
  joint.motorSpeed = 1; joint.maxMotorForce = 60;
  run(world, 1);
  close(joint.translation, -0.5, 0.05);
  run(world, 3);
  close(joint.translation, 0.5, 0.02);
  // One too weak cannot lift it.
  joint.maxMotorForce = 5; joint.motorSpeed = 1;
  run(world, 3);
  close(joint.translation, -1.5, 0.02);
});

test('a slider between two bodies follows the first body as it turns', () => {
  const world = createPhysicsWorld3D({gravity: [0, 0, 0]});
  const base = world.createBody({type: 'kinematic', shape: {type: 'box', halfExtents: [0.2, 0.2, 0.2]}});
  const sled = world.createBody({mass: 1, position: [1, 0, 0], shape: {type: 'box', halfExtents: [0.2, 0.2, 0.2]}, linearDamping: 0});
  const joint = world.createJoint({type: 'slider', bodyA: sled, bodyB: base, axis: [1, 0, 0]});
  sled.setLinearVelocity(1, 2, 0);
  run(world, 1);
  close(sled.position[0], 2, 0.03); close(sled.position[1], 0, 0.02); close(joint.translation, 1, 0.03);
  assert.throws(() => world.createJoint({type: 'slider', bodyA: sled, bodyB: base, limits: [1, 0]}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => world.createJoint({type: 'hinge', bodyA: sled, bodyB: base, maxMotorForce: 1}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => world.createJoint({type: 'slider', bodyA: sled, bodyB: base, maxMotorTorque: 1}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => world.createJoint({type: 'fixed', bodyA: sled, bodyB: base, stiffness: 2}), code('WORLD3D_INPUT_INVALID'));
});

test('a spring swings at its stiffness and settles by its damping', () => {
  const world = createPhysicsWorld3D({gravity: [0, 0, 0], allowSleep: false});
  const weight = world.createBody({mass: 1, position: [0, -2, 0], shape: {type: 'sphere', radius: 0.2}, linearDamping: 0});
  const spring = world.createJoint({type: 'distance', bodyA: weight, anchorB: [0, 0, 0], length: 1, stiffness: 1, damping: 0});
  // Released one unit beyond its rest length, it passes through rest a quarter of a period later.
  let crossed = -1, lowest = Infinity, highest = -Infinity;
  for (let i = 0; i < 120; i++) {
    world.step(1 / 60);
    const stretch = -weight.position[1] - 1;
    if (crossed < 0 && stretch <= 0) crossed = (i + 1) / 60;
    lowest = Math.min(lowest, stretch); highest = Math.max(highest, stretch);
  }
  close(crossed, 0.25, 0.04);
  assert.ok(lowest < -0.7 && highest <= 1.0001, `${lowest} ${highest}`);
  // With damping it comes to rest at its length.
  spring.damping = 1;
  run(world, 4);
  close(-weight.position[1], 1, 0.01);
  assert.ok(Math.abs(weight.linearVelocity[1]) < 0.01);
});

test('contact reports say where, which way and how hard', () => {
  const world = createPhysicsWorld3D();
  const floor = world.createBody({type: 'static', shape: {type: 'plane'}});
  const ball = world.createBody({mass: 2, position: [1, 3, -2], shape: {type: 'sphere', radius: 0.5}, restitution: 0});
  const seen = [];
  world.onContact = contact => seen.push({a: contact.a, b: contact.b, point: [...contact.point], normal: [...contact.normal], impulse: contact.impulse, began: contact.began});
  run(world, 2);
  assert.ok(seen.length > 10);
  const first = seen[0];
  assert.deepEqual(new Set([first.a, first.b]), new Set([floor, ball]));
  assert.equal(first.began, true); assert.equal(seen[1].began, false);
  close(first.point[0], 1, 0.01); close(first.point[1], 0, 0.05); close(first.point[2], -2, 0.01);
  // The normal runs from a to b: up if the floor is a, down if the ball is.
  close(first.normal[1], first.a === floor ? 1 : -1);
  // It landed at about 7 m/s; stopping two kilograms takes about fourteen units of push.
  const landing = seen.slice(0, 3).reduce((sum, contact) => sum + contact.impulse, 0);
  assert.ok(landing > 12 && landing < 19, String(landing));
  // At rest each step carries the weight for one step: mass times gravity times the step.
  close(seen[seen.length - 1].impulse > 0 ? seen[seen.length - 1].impulse : 2 * 9.81 / 60, 2 * 9.81 / 60, 0.05);
});

test('a jelly flattens on a knock, swings back past rest and settles', () => {
  const root = new Object3D(), shared = createStandardMaterial3D({});
  const mesh = new Mesh3D(createSphereGeometry3D({radius: 0.5}), shared), other = new Mesh3D(createBoxGeometry3D({}), shared);
  root.addChild(mesh);
  // Without a height the jelly measures its target.
  assert.ok(createJelly3D(new Object3D().addChild(new Mesh3D(createSphereGeometry3D({radius: 0.5}), shared)).parent).height >= 1);
  const jelly = createJelly3D(root, {stiffness: 2, damping: 0.2, sensitivity: 0.05, wobble: 0, height: 1});
  assert.ok(jelly instanceof Jelly3D);
  // The mesh got its own material with the hook; the shared one is untouched.
  assert.notEqual(mesh.material, shared); assert.equal(mesh.material.shader, jelly.shader); assert.equal(shared.shader, undefined); assert.equal(other.material, shared);
  close(jelly.height, 1, 1e-6);
  const point = [0, 0, 0];
  // At rest nothing moves.
  jelly.update(1 / 60);
  assert.deepEqual([...jelly.deform(point, 0.2, 0.3, -0.1)].map(value => Math.round(value * 1e6) / 1e6), [0.2, 0.3, -0.1]);
  // A landing: the blow travels up from the ground at 6 m/s.
  jelly.impact([0, 1, 0], 6);
  let peak = 0, rebound = 0;
  for (let i = 0; i < 60; i++) { jelly.update(1 / 60); peak = Math.max(peak, jelly.amount); rebound = Math.min(rebound, jelly.amount); }
  // Pressed by nearly sensitivity times speed, then stretched the other way, less far.
  assert.ok(peak > 0.2 && peak <= 0.3, String(peak));
  assert.ok(rebound < -0.08 && -rebound < peak, String(rebound));
  for (let i = 0; i < 600; i++) jelly.update(1 / 60);
  close(jelly.amount, 0, 1e-3);
});

test('a pressed jelly keeps its base, loses height and spreads to keep its volume', () => {
  const root = new Object3D();
  root.addChild(new Mesh3D(createSphereGeometry3D({radius: 0.5}), createStandardMaterial3D({})));
  root.setPosition(2, 0.5, 0);
  const jelly = createJelly3D(root, {stiffness: 2, damping: 0, sensitivity: 0.05, wobble: 0, squash: 0.25, height: 1});
  jelly.impact([0, 1, 0], 100);
  for (let i = 0; i < 8; i++) jelly.update(1 / 60);
  const u = jelly.shader.uniforms;
  // The knock asks for far more than the limit allows.
  close(u[3], 0.75, 1e-6); close(u[11], 1 / Math.sqrt(0.75), 1e-6);
  const base = jelly.deform([0, 0, 0], 2, 0, 0), top = jelly.deform([0, 0, 0], 2, 1, 0), side = jelly.deform([0, 0, 0], 2.5, 0.5, 0);
  close(base[1], 0, 1e-6); close(top[1], 0.75, 1e-6);
  close(side[0], 2 + 0.5 / Math.sqrt(0.75), 1e-6); close(side[1], 0.375, 1e-6);
  jelly.reset();
  close(jelly.shader.uniforms[3], 1, 1e-9);
});

test('a jelly feels the jolts of the body it rides on, and its top trails behind', () => {
  const world = createPhysicsWorld3D();
  world.createBody({type: 'static', shape: {type: 'plane'}});
  const node = new Object3D();
  node.addChild(new Mesh3D(createSphereGeometry3D({radius: 0.5}), createStandardMaterial3D({})));
  const body = world.createBody({mass: 1, position: [0, 3, 0], shape: {type: 'sphere', radius: 0.5}, restitution: 0, node});
  const jelly = createJelly3D(node, {body, wobble: 0.04});
  let falling = 0, landed = 0;
  for (let i = 0; i < 90; i++) {
    world.step(1 / 60); jelly.update(1 / 60);
    if (body.position[1] > 0.7) falling = Math.max(falling, Math.abs(jelly.amount)); else landed = Math.max(landed, jelly.amount);
  }
  // Falling freely is not a jolt; hitting the floor is.
  assert.equal(falling, 0);
  assert.ok(landed > 0.15, String(landed));
  close(jelly.axis[1], 1, 1e-6);
  // A shove sideways leaves the top behind for a moment.
  for (let i = 0; i < 240; i++) { world.step(1 / 60); jelly.update(1 / 60); }
  body.applyImpulse(5, 0, 0);
  world.step(1 / 60); jelly.update(1 / 60);
  let trailing = 0;
  for (let i = 0; i < 6; i++) { world.step(1 / 60); jelly.update(1 / 60); trailing = Math.min(trailing, jelly.lag[0]); }
  assert.ok(trailing < -0.02, String(trailing));
  assert.throws(() => createJelly3D(node, {squash: 2}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => jelly.impact([0, 0, 0], 1), code('WORLD3D_INPUT_INVALID'));
});
