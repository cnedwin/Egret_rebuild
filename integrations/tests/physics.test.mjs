// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createPhysicsWorld } from '@egret/integrations/physics';

const metreBox = { kind: 'box', width: 1, height: 1 };
const body = { type: 'dynamic', position: { x: 0, y: 0 }, shape: metreBox };
const fixedStep = 1 / 60;

function closeTo(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be close to ${expected}`);
}

test('Planck advances real gravity and reports the collision in Egret coordinates', () => {
  const world = createPhysicsWorld({ gravity: { x: 0, y: 10 } });
  try {
    const floor = world.createBody({ type: 'static', position: { x: 0, y: 4 }, shape: { kind: 'box', width: 10, height: .5 } });
    const ball = world.createBody({ ...body, shape: { kind: 'circle', radius: .25 } });
    const events = [];
    for (let index = 0; index < 90; index++) events.push(...world.advance(fixedStep).contacts);
    assert.deepEqual(events, [{ phase: 'begin', bodyA: floor.id, bodyB: ball.id }]);
    closeTo(ball.snapshot().position.y, 3.5, .03);
    closeTo(ball.snapshot().linearVelocity.y, 0, .03);
    ball.dispose();
    assert.deepEqual(world.advance(0).contacts, [{ phase: 'end', bodyA: floor.id, bodyB: ball.id }]);
  } finally { world.dispose(); }
});

test('fixed stepping accumulates fractional frames and reports bounded catch-up', () => {
  const world = createPhysicsWorld({ gravity: { x: 0, y: 0 }, stepSeconds: fixedStep, maxSubSteps: 3 });
  try {
    const box = world.createBody(body);
    box.applyLinearImpulse({ x: 1, y: 0 });
    assert.equal(world.advance(fixedStep / 2).steps, 0);
    assert.equal(world.advance(fixedStep / 2).steps, 1);
    closeTo(box.snapshot().position.x, fixedStep);
    const stalled = world.advance(1);
    assert.equal(stalled.steps, 3);
    closeTo(stalled.simulatedSeconds, .05);
    closeTo(stalled.droppedSeconds, .95);
    closeTo(stalled.remainingSeconds, 0);
  } finally { world.dispose(); }
});

test('body snapshots are detached and removal and Scope-compatible disposal are idempotent', () => {
  const world = createPhysicsWorld({ gravity: { x: 0, y: 0 } });
  const box = world.createBody(body);
  const before = box.snapshot();
  box.applyLinearImpulse({ x: 3, y: 0 });
  world.advance(fixedStep);
  assert.ok(Object.isFrozen(before) && Object.isFrozen(before.position));
  assert.deepEqual(before.position, { x: 0, y: 0 });
  assert.ok(box.snapshot().position.x > 0);
  box.dispose();
  box.dispose();
  assert.throws(() => box.snapshot(), { integration: 'physics', code: 'disposed' });
  world.dispose();
  world.dispose();
  assert.throws(() => world.advance(1), { integration: 'physics', code: 'disposed' });
});

test('invalid inputs fail before advancing the solver or allocating a body', () => {
  assert.throws(() => createPhysicsWorld({ maxSubSteps: 0 }), { integration: 'physics', code: 'invalid-input' });
  const world = createPhysicsWorld();
  try {
    assert.throws(() => world.advance(NaN), { integration: 'physics', code: 'invalid-input' });
    assert.throws(() => world.createBody({ ...body, shape: { kind: 'circle', radius: 0 } }), { integration: 'physics', code: 'invalid-input' });
    const box = world.createBody(body);
    assert.equal(box.id, 1);
    assert.equal(world.advance(fixedStep).steps, 1);
  } finally { world.dispose(); }
});

test('finite inputs outside the numerical profile refuse before corrupting the native world', () => {
  const limit = { integration: 'physics', code: 'limit-exceeded' };
  assert.throws(() => createPhysicsWorld({ gravity: { x: Number.MAX_VALUE, y: 0 } }), limit);
  const world = createPhysicsWorld({ gravity: { x: 0, y: 0 } });
  try {
    assert.throws(() => world.createBody({ ...body, position: { x: Number.MAX_VALUE, y: 0 } }), limit);
    assert.throws(() => world.createBody({ ...body, shape: { kind: 'circle', radius: Number.MAX_VALUE } }), limit);
    assert.throws(() => world.createBody({ ...body, density: Number.MAX_VALUE }), limit);
    assert.throws(() => world.createBody({ ...body, density: Number.MIN_VALUE }), limit);
    assert.throws(() => world.createBody({ ...body, friction: Number.MAX_VALUE }), limit);
    assert.throws(() => world.createBody({ ...body, angleRadians: Number.MAX_VALUE }), limit);
    const box = world.createBody(body);
    const before = box.snapshot();
    assert.equal(box.id, 1);
    assert.throws(() => box.applyLinearImpulse({ x: Number.MAX_VALUE, y: 0 }), limit);
    assert.deepEqual(box.snapshot(), before);
    box.applyLinearImpulse({ x: 1_000_000, y: 0 });
    assert.throws(() => box.applyLinearImpulse({ x: 1, y: 0 }), limit);
    assert.equal(box.snapshot().linearVelocity.x, 1_000_000);
    world.advance(fixedStep);
    assert.ok(Number.isFinite(box.snapshot().position.x));
  } finally { world.dispose(); }
});
