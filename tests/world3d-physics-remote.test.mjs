// SPDX-License-Identifier: Apache-2.0
// The remote physics world of World3D, driven over a real message channel between two ports
// and over a worker thread, as a page would drive a worker.
import assert from 'node:assert/strict';
import test from 'node:test';
import { MessageChannel, Worker } from 'node:worker_threads';
import { Object3D, PhysicsClient3D, RemoteBody3D, World3DError, connectPhysics3D, servePhysics3D } from '@egret/engine/world3d';

const code = value => error => error instanceof World3DError && error.code === value;
const close = (actual, expected, epsilon = 1e-3) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
// A ray into empty space comes back only after everything sent before it has been dealt with.
const reached = client => client.raycast([0, 1e7, 0], [0, 1, 0], 1);
async function steps(client, count) {
  for (let i = 0; i < count; i++) {
    const answered = new Promise(resolve => { client.onStep = resolve; });
    assert.equal(client.step(1 / 60), true);
    await answered;
  }
  client.onStep = undefined;
}
function pair(options) {
  const channel = new MessageChannel();
  const world = servePhysics3D(channel.port1, options), client = connectPhysics3D(channel.port2);
  return {world, client, close: () => { client.dispose(); channel.port1.close(); channel.port2.close(); }};
}

test('bodies created on one end fall and rest on the other, and their nodes follow', async () => {
  const {world, client, close: end} = pair();
  try {
    assert.ok(client instanceof PhysicsClient3D);
    const node = new Object3D();
    const floor = client.createBody({shape: {type: 'plane'}});
    const ball = client.createBody({shape: {type: 'sphere', radius: 0.5}, mass: 2, position: [1, 4, -2], restitution: 0, node, userData: 'ball'});
    assert.ok(ball instanceof RemoteBody3D); assert.equal(floor.type, 'static'); assert.equal(ball.type, 'dynamic'); assert.equal(ball.userData, 'ball');
    // The node is placed at once; the body itself appears on the other end a moment later.
    assert.deepEqual([...node.position], [1, 4, -2]);
    await reached(client);
    assert.equal(world.bodies.length, 2);
    const touched = [];
    client.onContactBegin = (a, b) => touched.push([a, b]);
    await steps(client, 150);
    close(ball.position[1], 0.5, 0.02); close(ball.position[0], 1, 1e-4); close(ball.position[2], -2, 1e-4);
    assert.equal(client.frame, 150); assert.equal(client.pending, 0);
    assert.ok(touched.length >= 1); assert.deepEqual(new Set(touched[0]), new Set([floor, ball]));
    client.update();
    close(node.position[1], ball.position[1], 1e-6);
    // The stand-in matches the real body on the other end.
    const real = world.bodies.find(body => body.type === 'dynamic');
    close(real.position[1], ball.position[1], 1e-5);
    await steps(client, 60);
    assert.equal(ball.isSleeping, true);
  } finally { end(); }
});

test('commands reach the other end in order: moves, pushes, joints, gravity and removal', async () => {
  const {world, client, close: end} = pair({gravity: [0, 0, 0]});
  try {
    const a = client.createBody({shape: {type: 'box', halfExtents: [0.5, 0.5, 0.5]}, linearDamping: 0, angularDamping: 0});
    const b = client.createBody({shape: {type: 'convex', points: [-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5]}, position: [3, 0, 0], linearDamping: 0});
    const c = client.createBody({shape: {type: 'compound', children: [{shape: {type: 'sphere', radius: 0.3}, position: [0.5, 0, 0]}, {shape: {type: 'sphere', radius: 0.3}, position: [-0.5, 0, 0]}]}, position: [0, 5, 0]});
    a.setLinearVelocity(1.2, 0, 0); a.applyImpulse(0, 3, 0);
    await steps(client, 60);
    // One second at 1.2 along x; the impulse gave 3 along y to a body of mass one.
    close(a.position[0], 1.2, 0.01); close(a.position[1], 3, 0.02);
    a.setPosition(0, 0, 0); a.setLinearVelocity(0, 0, 0);
    assert.deepEqual([...a.position], [0, 0, 0]);
    // A rod between a and b: pulling a away drags b along.
    const rod = client.createJoint({type: 'distance', bodyA: a, bodyB: b});
    a.setLinearVelocity(-2, 0, 0);
    await steps(client, 60);
    close(Math.hypot(b.position[0] - a.position[0], b.position[1] - a.position[1], b.position[2] - a.position[2]), 3, 0.05);
    assert.ok(b.position[0] < 2.5);
    assert.equal(world.joints.length, 1);
    rod.remove(); rod.remove();
    client.setGravity(0, -10, 0);
    const before = c.position[1];
    await steps(client, 30);
    assert.equal(world.joints.length, 0);
    close(c.position[1], before - 0.5 * 10 * 0.25, 0.1);
    c.remove(); c.remove();
    assert.equal(c.removed, true);
    await steps(client, 1);
    assert.equal(world.bodies.length, 2);
    assert.equal([...client.bodies].length, 2);
  } finally { end(); }
});

test('rays are answered later, with the stand-in of the body they hit', async () => {
  const {client, close: end} = pair({gravity: [0, 0, 0]});
  try {
    const wall = client.createBody({type: 'static', shape: {type: 'box', halfExtents: [0.5, 2, 2]}, position: [5, 0, 0], layer: 2});
    const hit = await client.raycast([0, 0, 0], [1, 0, 0], 20);
    assert.equal(hit.body, wall); close(hit.distance, 4.5); close(hit.normal[0], -1); close(hit.point[0], 4.5);
    assert.equal(await client.raycast([0, 0, 0], [-1, 0, 0], 20), undefined);
    assert.equal(await client.raycast([0, 0, 0], [1, 0, 0], 20, 1), undefined);
  } finally { end(); }
});

test('a request the other end cannot carry out is reported, and the world carries on', async () => {
  const {world, client, close: end} = pair();
  try {
    const errors = [];
    client.onError = (message, about) => errors.push([about, message]);
    client.createBody({shape: {type: 'sphere', radius: -1}});
    client.createBody({shape: {type: 'sphere', radius: 1}});
    await reached(client);
    assert.equal(errors.length, 1); assert.equal(errors[0][0], 'body');
    assert.equal(world.bodies.length, 1);
    assert.throws(() => client.createBody({}), code('WORLD3D_INPUT_INVALID'));
    assert.throws(() => client.createJoint({type: 'point', bodyA: {}}), code('WORLD3D_INPUT_INVALID'));
    assert.throws(() => connectPhysics3D({}), code('WORLD3D_INPUT_INVALID'));
  } finally { end(); }
});

test('a failed ray rejects its own request and leaves a queued valid ray usable', async () => {
  const {client, close: end} = pair();
  try {
    const errors = [];
    client.onError = (message, about) => errors.push([about, message]);
    let disposition = 'pending', reason;
    const invalid = client.raycast([0, 0, 0], [0, 0, 0]);
    void invalid.then(() => { disposition = 'resolved'; }, error => { disposition = 'rejected'; reason = error; });
    assert.equal(await reached(client), undefined);
    assert.equal(disposition, 'rejected');
    assert.ok(code('WORLD3D_INPUT_INVALID')(reason));
    assert.match(reason.message, /ray direction/);
    assert.deepEqual(errors, [['raycast', 'WORLD3D_INPUT_INVALID: ray direction']]);
  } finally { end(); }
});

test('client startup options preserve the returned host world and its existing bodies', async () => {
  const channel = new MessageChannel();
  const world = servePhysics3D(channel.port1, {gravity: [0, 0, 0], iterations: 12, solverSteps: 2, allowSleep: false});
  const floor = world.createBody({shape: {type: 'plane'}});
  world.iterations = 12.5;
  const client = connectPhysics3D(channel.port2, {gravity: [0, -20, 0], maxSubSteps: 3});
  try {
    const ball = client.createBody({shape: {type: 'sphere', radius: 0.5}, position: [0, 0.55, 0]});
    await steps(client, 10);
    assert.equal(world.bodies[0], floor);
    assert.equal(world.bodies.length, 2);
    assert.deepEqual([...world.gravity], [0, -20, 0]);
    assert.deepEqual([world.maxSubSteps, world.iterations, world.solverSteps, world.allowSleep], [3, 12.5, 2, false]);
    close(ball.position[1], 0.5, 0.04);
    close(world.bodies[1].position[1], ball.position[1], 1e-6);
  } finally { client.dispose(); channel.port1.close(); channel.port2.close(); }
});

test('remote joints require registered live bodies of the same client', async () => {
  const local = pair(), other = pair();
  try {
    const shape = {type: 'sphere', radius: 1};
    const body = local.client.createBody({shape});
    const foreign = other.client.createBody({shape});
    assert.equal(body.id, foreign.id);
    assert.throws(() => local.client.createJoint({type: 'point', bodyA: foreign}), code('WORLD3D_INPUT_INVALID'));
    assert.throws(() => local.client.createJoint({type: 'point', bodyA: body, bodyB: foreign}), code('WORLD3D_INPUT_INVALID'));
    const fabricated = new RemoteBody3D(local.client, body.id, {shape});
    assert.throws(() => local.client.createJoint({type: 'point', bodyA: fabricated}), code('WORLD3D_INPUT_INVALID'));
    fabricated.remove();
    const removed = local.client.createBody({shape});
    removed.remove();
    assert.throws(() => local.client.createJoint({type: 'point', bodyA: removed}), code('WORLD3D_INPUT_INVALID'));
    await reached(local.client);
    assert.equal(local.world.joints.length, 0);
    let bodyReads = 0;
    local.client.createJoint({type: 'point', get bodyA() { return ++bodyReads === 1 ? body : foreign; }});
    assert.equal(bodyReads, 1);
    await reached(local.client);
    assert.equal(local.world.joints.length, 1);
    assert.equal(local.world.joints[0].bodyA, local.world.bodies[0]);
  } finally { local.close(); other.close(); }
});

test('a slow other end is not flooded, and shown positions blend between steps', async () => {
  const {client, close: end} = pair({gravity: [0, 0, 0]});
  try {
    const node = new Object3D();
    const body = client.createBody({shape: {type: 'sphere', radius: 0.5}, node, linearDamping: 0});
    body.setLinearVelocity(6, 0, 0);
    // Without waiting for answers only two requests are let through.
    assert.deepEqual([client.step(1 / 60), client.step(1 / 60), client.step(1 / 60), client.step(1 / 60)], [true, true, false, false]);
    assert.equal(client.pending, 2);
    while (client.pending > 0) await settle();
    close(body.position[0], 0.2, 1e-4);
    // Halfway between the last two steps.
    client.update(0.5);
    close(node.position[0], 0.15, 1e-4);
    client.update(0);
    close(node.position[0], 0.1, 1e-4);
    client.update();
    close(node.position[0], 0.2, 1e-4);
    client.dispose();
    assert.equal(client.step(1 / 60), false);
    assert.equal(await client.raycast([0, 0, 0], [1, 0, 0]), undefined);
  } finally { end(); }
});

test('the same world runs in a worker thread', async () => {
  // The worker's whole script: serve physics on the port it was started with.
  const source = `
    const { parentPort } = require('node:worker_threads');
    import('@egret/engine/world3d').then(({ servePhysics3D }) => servePhysics3D(parentPort));
  `;
  const worker = new Worker(source, {eval: true});
  // A Node worker speaks through on() and off(); a browser Worker already has the listener methods.
  const port = {
    postMessage: (message, transfer) => worker.postMessage(message, transfer),
    addEventListener: (type, listener) => { const wrapped = data => listener({data}); port.listeners.set(listener, wrapped); worker.on(type, wrapped); },
    removeEventListener: (type, listener) => worker.off(type, port.listeners.get(listener)),
    listeners: new Map(),
  };
  const client = connectPhysics3D(port, {gravity: [0, -20, 0]});
  try {
    client.createBody({shape: {type: 'plane'}});
    const ball = client.createBody({shape: {type: 'sphere', radius: 0.25}, position: [0, 2, 0], restitution: 0});
    await steps(client, 120);
    close(ball.position[1], 0.25, 0.02);
    const hit = await client.raycast([0, 5, 0], [0, -1, 0], 10);
    assert.equal(hit.body, ball); close(hit.distance, 4.5, 0.03);
  } finally { client.dispose(); await worker.terminate(); }
});
