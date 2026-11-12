// SPDX-License-Identifier: Apache-2.0
// Ragdolls, ray-wheel vehicles, ropes and cloth of World3D, checked through the public
// entry without a renderer.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Bone3D, Cloth3D, Object3D, Ragdoll3D, Rope3D, Vehicle3D, World3DError, createCloth3D, createPhysicsWorld3D, createRagdoll3D, createRope3D,
  createStandardMaterial3D, createVehicle3D,
} from '@egret/engine/world3d';

const code = value => error => error instanceof World3DError && error.code === value;
const close = (actual, expected, epsilon = 1e-3) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const run = (world, seconds, each) => { for (let i = 0; i < Math.round(seconds * 60); i++) { each?.(); world.step(1 / 60); } };

// A small figure: hips, spine, head, and one arm of two bones, standing upright.
function figure() {
  const root = new Object3D(), bone = (name, parent, x, y, z) => { const b = new Bone3D(); b.name = name; b.setPosition(x, y, z); parent.addChild(b); return b; };
  root.setPosition(0, 0, 0);
  const hips = bone('hips', root, 0, 1, 0), spine = bone('spine', hips, 0, 0.3, 0), head = bone('head', spine, 0, 0.5, 0);
  const upperArm = bone('upperArm', spine, 0.25, 0.4, 0), twist = bone('twist', upperArm, 0.15, 0, 0), foreArm = bone('foreArm', twist, 0.15, 0, 0);
  root.updateWorldMatrix();
  const parts = [
    {bone: 'hips', shape: {type: 'box', halfExtents: [0.18, 0.12, 0.1]}, mass: 4},
    {bone: 'spine', shape: {type: 'box', halfExtents: [0.18, 0.22, 0.1]}, offset: [0, 0.22, 0], mass: 5, parent: 0, joint: {coneLimit: 0.5}},
    {bone: head, shape: {type: 'sphere', radius: 0.12}, offset: [0, 0.12, 0], mass: 1.5, parent: 1, joint: {coneLimit: 0.6}},
    {bone: 'upperArm', shape: {type: 'box', halfExtents: [0.14, 0.05, 0.05]}, offset: [0.14, 0, 0], mass: 1, parent: 1},
    {bone: 'foreArm', shape: {type: 'box', halfExtents: [0.13, 0.04, 0.04]}, offset: [0.13, 0, 0], mass: 0.8, parent: 3, joint: {type: 'hinge', axis: [0, 0, 1], limits: [0, 2.2]}},
  ];
  return {root, hips, spine, head, upperArm, twist, foreArm, parts};
}
const worldPosition = node => { node.updateWorldMatrix(); return [node.matrixWorld[12], node.matrixWorld[13], node.matrixWorld[14]]; };

test('a ragdoll starts in the pose of its skeleton and leaves the bones where its bodies are', () => {
  const world = createPhysicsWorld3D({gravity: [0, 0, 0]}), {root, hips, head, foreArm, twist, parts} = figure();
  const ragdoll = createRagdoll3D(world, root, parts);
  assert.ok(ragdoll instanceof Ragdoll3D); assert.equal(ragdoll.active, false);
  ragdoll.update();
  ragdoll.activate();
  assert.equal(ragdoll.bodies.length, 5); assert.equal(ragdoll.joints.length, 4); assert.equal(world.bodies.length, 5);
  // Each body sits at its bone plus the offset: the forearm's center is 0.13 along it.
  assert.deepEqual([...ragdoll.bodies[0].position].map(v => +v.toFixed(4)), [0, 1, 0]);
  assert.deepEqual([...ragdoll.bodies[4].position].map(v => +v.toFixed(4)), [0.68, 1.7, 0]);
  assert.deepEqual(ragdoll.joints.map(joint => joint.type), ['point', 'point', 'point', 'hinge']);
  // With nothing pulling on it, writing the bodies back changes no bone.
  const before = [hips, head, foreArm, twist].map(worldPosition);
  run(world, 0.5); ragdoll.update();
  for (const [i, node] of [hips, head, foreArm, twist].entries()) for (let k = 0; k < 3; k++) close(worldPosition(node)[k], before[i][k], 2e-3);
  ragdoll.deactivate();
  assert.equal(world.bodies.length, 0); assert.equal(world.joints.length, 0); assert.equal(ragdoll.active, false);
});

test('a ragdoll falls, stays in one piece and carries its bones with it', () => {
  const world = createPhysicsWorld3D({solverSteps: 4, iterations: 4});
  world.createBody({type: 'static', shape: {type: 'plane'}});
  const {root, hips, spine, head, upperArm, twist, foreArm, parts} = figure();
  const ragdoll = createRagdoll3D(world, root, parts);
  ragdoll.activate([1.5, 0, 0], [0, 0, -2]);
  run(world, 3, () => ragdoll.update());
  ragdoll.update();
  // Everything came down and travelled the way it was pushed.
  for (const node of [hips, spine, head, upperArm, foreArm]) { const at = worldPosition(node); assert.ok(at[1] < 0.6 && at[1] > -0.05, `${node.name} at ${at[1]}`); }
  assert.ok(worldPosition(hips)[0] > 0.3);
  // Bones keep their lengths: the joints held, and the bone between two parts was carried along rigidly.
  const distance = (a, b) => Math.hypot(...worldPosition(a).map((v, i) => v - worldPosition(b)[i]));
  close(distance(hips, spine), 0.3, 0.03); close(distance(spine, head), 0.5, 0.03);
  close(distance(spine, upperArm), Math.hypot(0.25, 0.4), 0.03); close(distance(upperArm, twist), 0.15, 1e-4); close(distance(upperArm, foreArm), 0.3, 0.03);
  // The elbow bends one way only, within its limits.
  const elbow = ragdoll.joints[3].angle;
  assert.ok(elbow > -0.15 && elbow < 2.35, String(elbow));
  ragdoll.dispose();
  assert.equal(world.bodies.length, 1);
});

test('ragdoll parts are validated', () => {
  const world = createPhysicsWorld3D(), {root, parts} = figure();
  assert.throws(() => createRagdoll3D(world, root, []), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createRagdoll3D(world, root, [{bone: 'nobody', shape: {type: 'sphere', radius: 1}}]), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createRagdoll3D(world, root, [parts[0], {...parts[1], parent: 1}]), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createRagdoll3D(world, root, [parts[0], {...parts[1], parent: undefined}]), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createRagdoll3D(world, root, [parts[0], {...parts[0]}]), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createRagdoll3D(world, root, [{bone: 'hips', shape: {type: 'plane'}}]), code('WORLD3D_INPUT_INVALID'));
});

function car(world, options = {}) {
  const chassis = world.createBody({mass: 800, shape: {type: 'box', halfExtents: [0.9, 0.3, 2]}, position: [0, 1.2, 0], linearDamping: 0.05, angularDamping: 0.3});
  const wheel = (x, z, front) => ({position: [x, -0.2, z], radius: 0.35, restLength: 0.35, travel: 0.2, steered: front, driven: !front, node: new Object3D()});
  // Local -Z is forward, so the front wheels are at negative z.
  const vehicle = createVehicle3D(world, chassis, {wheels: [wheel(-0.8, -1.4, true), wheel(0.8, -1.4, true), wheel(-0.8, 1.4, false), wheel(0.8, 1.4, false)], engineForce: 6000, brakeForce: 12000, ...options});
  return {chassis, vehicle};
}

test('a vehicle settles on its suspension with its weight shared by the wheels', () => {
  const world = createPhysicsWorld3D();
  world.createBody({type: 'static', shape: {type: 'plane'}});
  const {chassis, vehicle} = car(world);
  assert.ok(vehicle instanceof Vehicle3D);
  run(world, 4, () => vehicle.update(1 / 60));
  assert.equal(vehicle.groundedWheels, 4);
  // The four springs together carry the car.
  close(vehicle.wheels.reduce((sum, wheel) => sum + wheel.load, 0), 800 * 9.81, 800 * 9.81 * 0.03);
  for (const wheel of vehicle.wheels) { assert.ok(wheel.length < 0.35 && wheel.length > 0.2, String(wheel.length)); close(wheel.contact[1], 0, 1e-3); }
  // Body height: wheel radius, the squeezed suspension, and the attachment 0.2 below the center.
  close(chassis.position[1], 0.35 + vehicle.wheels[0].length + 0.2, 0.01);
  assert.ok(Math.hypot(...chassis.linearVelocity) < 0.05);
  // Each wheel's node sits at the wheel's center.
  close(vehicle.wheels[0].node.position[1], 0.35, 0.01); close(vehicle.wheels[0].node.position[0], -0.8, 0.02);
});

test('a vehicle drives, steers, brakes and reverses', () => {
  const world = createPhysicsWorld3D();
  world.createBody({type: 'static', shape: {type: 'plane'}});
  const {chassis, vehicle} = car(world);
  run(world, 2, () => vehicle.update(1 / 60));
  vehicle.throttle = 1;
  run(world, 3, () => vehicle.update(1 / 60));
  // Forward is -Z; the engine can give at most 6000 / 800 = 7.5 units of speed per second.
  assert.ok(vehicle.speed > 10 && vehicle.speed < 22.5, String(vehicle.speed));
  assert.ok(chassis.position[2] < -15 && Math.abs(chassis.position[0]) < 0.3);
  assert.ok(vehicle.wheels[2].spin > 10);
  // Steering left turns the heading toward -X without the car sliding straight on.
  vehicle.steering = 0.5;
  run(world, 1.5, () => vehicle.update(1 / 60));
  const forward = [-chassis.rotation[2], -chassis.rotation[8]];
  assert.ok(forward[0] < -0.3, String(forward[0]));
  assert.ok(chassis.linearVelocity[0] < -2);
  const slide = Math.abs(chassis.linearVelocity[0] * chassis.rotation[0] + chassis.linearVelocity[2] * chassis.rotation[6]);
  assert.ok(slide < 0.25 * Math.hypot(chassis.linearVelocity[0], chassis.linearVelocity[2]), String(slide));
  // Brakes stop it and hold it; they do not push it backwards.
  vehicle.throttle = 0; vehicle.steering = 0; vehicle.brake = 1;
  run(world, 4, () => vehicle.update(1 / 60));
  assert.ok(Math.abs(vehicle.speed) < 0.1, String(vehicle.speed));
  vehicle.brake = 0; vehicle.throttle = -1;
  run(world, 2, () => vehicle.update(1 / 60));
  assert.ok(vehicle.speed < -3, String(vehicle.speed));
});

test('a vehicle holds on a slope with the brakes and rolls without them, and loses grip in the air', () => {
  const world = createPhysicsWorld3D(), tilt = 0.2;
  // A ramp rising toward -Z.
  world.createBody({type: 'static', shape: {type: 'plane'}, quaternion: [Math.sin(tilt / 2), 0, 0, Math.cos(tilt / 2)]});
  const {chassis, vehicle} = car(world);
  vehicle.brake = 1;
  run(world, 4, () => vehicle.update(1 / 60));
  const held = chassis.position[2];
  run(world, 2, () => vehicle.update(1 / 60));
  close(chassis.position[2], held, 0.3);
  vehicle.brake = 0;
  run(world, 2, () => vehicle.update(1 / 60));
  assert.ok(chassis.position[2] > held + 1, 'rolls back down the ramp');
  // Lifted off the ground, the wheels touch nothing and the engine does nothing.
  chassis.setPosition(0, 30, 0); chassis.setLinearVelocity(0, 0, 0); chassis.setAngularVelocity(0, 0, 0);
  vehicle.throttle = 1;
  vehicle.update(1 / 60); world.step(1 / 60);
  assert.equal(vehicle.groundedWheels, 0);
  close(chassis.linearVelocity[2], 0, 1e-6);
  assert.throws(() => createVehicle3D(world, chassis, {wheels: []}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createVehicle3D(world, world.createBody({type: 'static', shape: {type: 'sphere', radius: 1}}), {wheels: [{position: [0, 0, 0]}]}), code('WORLD3D_INPUT_INVALID'));
});

test('a rope hangs between its pins at its own length', () => {
  const rope = createRope3D({start: [0, 4, 0], end: [4, 4, 0], segments: 20, slack: 0.25, pinStart: true, pinEnd: true, iterations: 30});
  assert.ok(rope instanceof Rope3D); assert.equal(rope.pointCount, 21); assert.equal(rope.linkCount, 20); close(rope.length, 5, 1e-6);
  for (let i = 0; i < 600; i++) rope.update(1 / 60);
  const p = rope.points;
  // The ends are where they were pinned; the middle sags; the two halves mirror each other.
  assert.deepEqual([p[0], p[1], p[2]], [0, 4, 0]); assert.deepEqual([p[60], p[61], p[62]], [4, 4, 0]);
  const sag = 4 - p[31];
  assert.ok(sag > 1.2 && sag < 1.6, String(sag));
  close(p[30], 2, 0.02); close(p[5 * 3 + 1], p[15 * 3 + 1], 0.02);
  // The links add up to the rope's length: it has not stretched.
  let length = 0;
  for (let i = 0; i < 20; i++) length += Math.hypot(p[i * 3 + 3] - p[i * 3], p[i * 3 + 4] - p[i * 3 + 1], p[i * 3 + 5] - p[i * 3 + 2]);
  close(length, 5, 0.05);
  // Letting one end go, the rope swings down to hang from the other.
  rope.unpinPoint(20);
  assert.equal(rope.isPinned(20), false); assert.equal(rope.isPinned(0), true);
  for (let i = 0; i < 900; i++) rope.update(1 / 60);
  close(p[60], 0, 0.15); close(p[61], -1, 0.1);
});

test('a rope follows the body it is tied to and lies on what is under it', () => {
  const world = createPhysicsWorld3D({gravity: [0, 0, 0]});
  const floor = world.createBody({type: 'static', shape: {type: 'plane'}});
  const ball = world.createBody({type: 'static', shape: {type: 'sphere', radius: 1}, position: [1.5, 1, 0]});
  const hook = world.createBody({type: 'kinematic', shape: {type: 'sphere', radius: 0.1}, position: [0, 3, 0]});
  const rope = createRope3D({start: [0, 3, 0], end: [3, 3, 0], segments: 30, pinStart: hook, colliders: [floor, ball], thickness: 0.05, iterations: 20});
  for (let i = 0; i < 400; i++) rope.update(1 / 60);
  const p = rope.points;
  for (let i = 0; i <= 30; i++) {
    // No point is inside the ball or under the floor.
    assert.ok(p[i * 3 + 1] > 0.04, `point ${i} is below the floor`);
    assert.ok(Math.hypot(p[i * 3] - 1.5, p[i * 3 + 1] - 1, p[i * 3 + 2]) > 1.04, `point ${i} is inside the ball`);
  }
  // Moving and turning the hook carries the tied end with it.
  hook.setPosition(-2, 5, 1); hook.setQuaternion(0, 0, Math.SQRT1_2, Math.SQRT1_2);
  rope.update(1 / 60);
  close(p[0], -2, 1e-5); close(p[1], 5, 1e-5); close(p[2], 1, 1e-5);
  // A tube mesh follows the points.
  const mesh = rope.createMesh(createStandardMaterial3D({}), 0.05, 5);
  assert.equal(mesh.geometry.getAttribute('position').count, 31 * 5); assert.equal(mesh.geometry.index.count, 30 * 5 * 6);
  const ring = mesh.geometry.getAttribute('position').data;
  close(Math.hypot(ring[0] - p[0], ring[1] - p[1], ring[2] - p[2]), 0.05, 1e-5);
  const version = mesh.geometry.getAttribute('position').version;
  rope.update(1 / 60);
  assert.ok(mesh.geometry.getAttribute('position').version > version);
  assert.throws(() => createRope3D({start: [0, 0, 0], end: [1, 0, 0], segments: 0}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => rope.createMesh(createStandardMaterial3D({}), 0.05, 2), code('WORLD3D_INPUT_INVALID'));
});

test('a cloth hangs from its pins, drapes over a ball and leans with the wind', () => {
  const world = createPhysicsWorld3D();
  const ball = world.createBody({type: 'static', shape: {type: 'sphere', radius: 0.6}, position: [1, 1.2, 0.05]});
  const cloth = createCloth3D({columns: 11, rows: 11, origin: [0, 3, 0], right: [2, 0, 0], down: [0, -2, 0], iterations: 12});
  assert.ok(cloth instanceof Cloth3D); assert.equal(cloth.pointCount, 121);
  // Structural, diagonal and skip links for an 11 by 11 sheet.
  assert.equal(cloth.linkCount, 110 + 110 + 200 + 99 + 99);
  cloth.pin(0, 0); cloth.pin(10, 0);
  for (let i = 0; i < 300; i++) cloth.update(1 / 60);
  const p = cloth.points, at = (column, row) => cloth.indexOf(column, row) * 3;
  // Hanging straight: the pinned corners stay, the bottom edge is about two units lower and has not stretched much.
  assert.deepEqual([p[at(0, 0)], p[at(0, 0) + 1]], [0, 3]); assert.deepEqual([p[at(10, 0)], p[at(10, 0) + 1]], [2, 3]);
  const bottom = p[at(5, 10) + 1];
  assert.ok(bottom < 1.15 && bottom > 0.7, String(bottom));
  assert.ok(Math.abs(p[at(5, 5) + 2]) < 0.02);
  // Wind along +Z pushes the free bottom edge out while the pinned top stays.
  cloth.wind[2] = 8;
  for (let i = 0; i < 300; i++) cloth.update(1 / 60);
  assert.ok(p[at(5, 10) + 2] > 0.5, String(p[at(5, 10) + 2]));
  assert.equal(p[at(0, 0) + 2], 0);
  // With a ball in the way no point ends up inside it.
  cloth.wind[2] = 0; cloth.colliders.push(ball); cloth.thickness = 0.03;
  for (let i = 0; i < 400; i++) cloth.update(1 / 60);
  for (let i = 0; i < 121; i++) assert.ok(Math.hypot(p[i * 3] - 1, p[i * 3 + 1] - 1.2, p[i * 3 + 2] - 0.05) > 0.62, `point ${i} is inside the ball`);
  // The mesh carries the points and unit normals.
  const mesh = cloth.createMesh(createStandardMaterial3D({}));
  assert.equal(mesh.geometry.index.count, 10 * 10 * 6);
  const normals = mesh.geometry.getAttribute('normal').data;
  for (let i = 0; i < 121; i++) close(Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]), 1, 1e-4);
  assert.deepEqual([...mesh.geometry.getAttribute('position').data.subarray(0, 3)], [0, 3, 0]);
  assert.throws(() => createCloth3D({columns: 1, rows: 4, origin: [0, 0, 0], right: [1, 0, 0], down: [0, -1, 0]}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => cloth.pin(11, 0), code('WORLD3D_INPUT_INVALID'));
});
