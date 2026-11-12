// SPDX-License-Identifier: Apache-2.0
import { Box, Circle, World } from 'planck';
import type { Body, Contact, Shape } from 'planck';
import { IntegrationError } from './errors.js';

export interface PhysicsVector2D {
  readonly x: number;
  readonly y: number;
}

export interface PhysicsWorldOptions {
  /** Gravity in metres per second squared, in the caller's coordinate system. */
  readonly gravity?: PhysicsVector2D;
  readonly stepSeconds?: number;
  readonly maxSubSteps?: number;
}

export type PhysicsShape2D =
  | { readonly kind: 'box'; readonly width: number; readonly height: number }
  | { readonly kind: 'circle'; readonly radius: number };

export interface PhysicsBodyOptions {
  readonly type: 'static' | 'dynamic' | 'kinematic';
  /** Position and dimensions use metres; angle uses radians. */
  readonly position: PhysicsVector2D;
  readonly shape: PhysicsShape2D;
  readonly angleRadians?: number;
  readonly density?: number;
  readonly friction?: number;
  readonly restitution?: number;
  readonly sensor?: boolean;
}

export interface PhysicsBodySnapshot {
  readonly position: PhysicsVector2D;
  readonly linearVelocity: PhysicsVector2D;
  readonly angleRadians: number;
  readonly angularVelocity: number;
  readonly awake: boolean;
}

export interface PhysicsBody2D {
  readonly id: number;
  snapshot(): PhysicsBodySnapshot;
  /** Apply an impulse in kilogram metres per second at the body's centre of mass. */
  applyLinearImpulse(impulse: PhysicsVector2D): void;
  dispose(): void;
}

export interface PhysicsContact {
  readonly phase: 'begin' | 'end';
  readonly bodyA: number;
  readonly bodyB: number;
}

export interface PhysicsStepReport {
  readonly steps: number;
  readonly simulatedSeconds: number;
  readonly remainingSeconds: number;
  readonly droppedSeconds: number;
  readonly contacts: readonly PhysicsContact[];
  readonly droppedContacts: number;
}

export interface PhysicsWorld2D {
  createBody(options: PhysicsBodyOptions): PhysicsBody2D;
  advance(deltaSeconds: number): PhysicsStepReport;
  dispose(): void;
}

const MAX_BODIES = 1024;
const MAX_PENDING_CONTACTS = 4096;
const DEFAULT_STEP_SECONDS = 1 / 60;
const limits = {
  minimumDimension: 0.01, maximumDimension: 10_000,
  position: 1_000_000, gravity: 10_000, angle: 1_000_000,
  minimumDensity: 1e-6, maximumDensity: 1_000_000, friction: 100,
  impulse: 1_000_000, linearVelocity: 1_000_000,
} as const;

interface BodyRecord { readonly id: number; body: Body | undefined }

function invalid(message: string): never {
  throw new IntegrationError('physics', 'invalid-input', message);
}

function finite(value: number, field: string): number {
  if (!Number.isFinite(value)) invalid(`${field} must be a finite number.`);
  return value;
}

function exceedsLimit(message: string): never {
  throw new IntegrationError('physics', 'limit-exceeded', message);
}

function magnitude(value: number, field: string, maximum: number): number {
  if (Math.abs(finite(value, field)) > maximum) exceedsLimit(field + ' exceeds the numerical profile.');
  return value;
}

function vector(value: PhysicsVector2D, field: string, maximum: number): PhysicsVector2D {
  if (!value || typeof value !== 'object') invalid(field + ' must contain x and y.');
  return { x: magnitude(value.x, field + '.x', maximum), y: magnitude(value.y, field + '.y', maximum) };
}

function dimension(value: number, field: string): number {
  if (finite(value, field) <= 0) invalid(field + ' must be positive.');
  if (value < limits.minimumDimension || value > limits.maximumDimension) {
    exceedsLimit(field + ' exceeds the numerical profile.');
  }
  return value;
}

function createShape(specification: PhysicsShape2D): Shape {
  if (specification?.kind === 'box') {
    const width = dimension(specification.width, 'shape.width');
    const height = dimension(specification.height, 'shape.height');
    return new Box(width / 2, height / 2);
  }
  if (specification?.kind === 'circle') {
    const radius = dimension(specification.radius, 'shape.radius');
    return new Circle(radius);
  }
  return invalid('Choose a box or circle shape.');
}

/** Owns a Planck world without a timer or a dependency on an Egret host. */
export function createPhysicsWorld(options: PhysicsWorldOptions = {}): PhysicsWorld2D {
  if (!options || typeof options !== 'object') invalid('World options must be an object.');
  const gravity = vector(options.gravity ?? { x: 0, y: 9.8 }, 'gravity', limits.gravity);
  const stepSeconds = finite(options.stepSeconds ?? DEFAULT_STEP_SECONDS, 'stepSeconds');
  const maxSubSteps = options.maxSubSteps ?? 8;
  if (stepSeconds < 1 / 1000 || stepSeconds > 1) invalid('stepSeconds must be between 0.001 and 1.');
  if (!Number.isInteger(maxSubSteps) || maxSubSteps < 1 || maxSubSteps > 64) invalid('maxSubSteps must be between 1 and 64.');

  const world = new World({ gravity });
  const bodies = new Map<Body, BodyRecord>();
  let contacts: PhysicsContact[] = [];
  let droppedContacts = 0;
  let nextId = 1;
  let accumulatedSeconds = 0;
  let disposed = false;

  function assertOpen(): void {
    if (disposed) throw new IntegrationError('physics', 'disposed', 'The physics world has been disposed.');
  }

  function recordContact(phase: PhysicsContact['phase'], contact: Contact): void {
    const first = bodies.get(contact.getFixtureA().getBody());
    const second = bodies.get(contact.getFixtureB().getBody());
    if (!first || !second) return;
    if (contacts.length >= MAX_PENDING_CONTACTS) {
      droppedContacts++;
      return;
    }
    // Only copy the IDs in the solver callback. Gameplay consumes contacts after the world unlocks.
    contacts.push(Object.freeze({ phase, bodyA: Math.min(first.id, second.id), bodyB: Math.max(first.id, second.id) }));
  }

  const beginContact = (contact: Contact): void => recordContact('begin', contact);
  const endContact = (contact: Contact): void => recordContact('end', contact);
  world.on('begin-contact', beginContact);
  world.on('end-contact', endContact);

  return Object.freeze({
    createBody(specification: PhysicsBodyOptions): PhysicsBody2D {
      assertOpen();
      if (!specification || typeof specification !== 'object') invalid('Body options must be an object.');
      const { type, position, shape, angleRadians = 0, density = 1, friction = .2, restitution = 0, sensor = false } = specification;
      if (type !== 'dynamic' && type !== 'static' && type !== 'kinematic') invalid('Choose a supported body type.');
      const centre = vector(position, 'position', limits.position);
      magnitude(angleRadians, 'angleRadians', limits.angle);
      if (finite(density, 'density') < 0 || finite(friction, 'friction') < 0 || finite(restitution, 'restitution') < 0 || restitution > 1) {
        invalid('Density and friction must be non-negative and restitution must be between 0 and 1.');
      }
      if (density > limits.maximumDensity || (density > 0 && density < limits.minimumDensity) || friction > limits.friction) {
        exceedsLimit('Density or friction exceeds the numerical profile.');
      }
      if (typeof sensor !== 'boolean') invalid('sensor must be a boolean.');
      const fixtureShape = createShape(shape);
      assertOpen();
      if (bodies.size >= MAX_BODIES || !Number.isSafeInteger(nextId)) {
        throw new IntegrationError('physics', 'limit-exceeded', 'The physics body limit was reached.');
      }
      const nativeBody = world.createBody({ type, position: centre, angle: angleRadians });
      try {
        nativeBody.createFixture(fixtureShape, { density, friction, restitution, isSensor: sensor });
      } catch (cause) {
        world.destroyBody(nativeBody);
        throw new IntegrationError('physics', 'operation-failed', 'Planck could not attach the body fixture.', { cause });
      }
      const record: BodyRecord = { id: nextId++, body: nativeBody };
      bodies.set(nativeBody, record);

      function requireBody(): Body {
        assertOpen();
        if (!record.body) throw new IntegrationError('physics', 'disposed', 'The physics body has been disposed.');
        return record.body;
      }

      return Object.freeze({
        id: record.id,
        snapshot(): PhysicsBodySnapshot {
          const body = requireBody();
          const { x, y } = body.getPosition();
          const velocity = body.getLinearVelocity();
          const angleRadians = body.getAngle();
          const angularVelocity = body.getAngularVelocity();
          if (![x, y, velocity.x, velocity.y, angleRadians, angularVelocity].every(Number.isFinite)) {
            throw new IntegrationError('physics', 'operation-failed', 'Planck returned a non-finite body state.');
          }
          return Object.freeze({
            position: Object.freeze({ x, y }),
            linearVelocity: Object.freeze({ x: velocity.x, y: velocity.y }),
            angleRadians, angularVelocity, awake: body.isAwake(),
          });
        },
        applyLinearImpulse(impulse: PhysicsVector2D): void {
          const value = vector(impulse, 'impulse', limits.impulse);
          const body = requireBody();
          const mass = body.getMass();
          if (mass > 0) {
            const current = body.getLinearVelocity();
            const inverseMass = 1 / mass;
            const nextX = current.x + inverseMass * value.x;
            const nextY = current.y + inverseMass * value.y;
            if (!(Math.abs(nextX) <= limits.linearVelocity && Math.abs(nextY) <= limits.linearVelocity)) {
              exceedsLimit('Impulse would move linear velocity outside the numerical profile.');
            }
          }
          body.applyLinearImpulse(value, body.getWorldCenter(), true);
        },
        dispose(): void {
          const body = record.body;
          if (!body) return;
          // Keep the native-to-public mapping until Planck reports the departing contacts.
          world.destroyBody(body);
          bodies.delete(body);
          record.body = undefined;
        },
      });
    },
    advance(deltaSeconds: number): PhysicsStepReport {
      assertOpen();
      if (finite(deltaSeconds, 'deltaSeconds') < 0) invalid('deltaSeconds must be non-negative.');
      const admitted = Math.min(deltaSeconds, Math.max(0, maxSubSteps * stepSeconds - accumulatedSeconds));
      accumulatedSeconds += admitted;
      const ratio = accumulatedSeconds / stepSeconds;
      const steps = Math.min(maxSubSteps, Math.floor(ratio + 8 * Number.EPSILON * Math.max(1, ratio)));
      try {
        for (let index = 0; index < steps; index++) {
          world.step(stepSeconds);
          accumulatedSeconds = Math.max(0, accumulatedSeconds - stepSeconds);
        }
      } catch (cause) {
        throw new IntegrationError('physics', 'operation-failed', 'Planck could not advance the physics world.', { cause });
      }
      const report = Object.freeze({
        steps, simulatedSeconds: steps * stepSeconds, remainingSeconds: accumulatedSeconds,
        droppedSeconds: deltaSeconds - admitted, contacts: Object.freeze(contacts), droppedContacts,
      });
      contacts = [];
      droppedContacts = 0;
      return report;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      world.off('begin-contact', beginContact);
      world.off('end-contact', endContact);
      for (const [body, record] of bodies) {
        world.destroyBody(body);
        record.body = undefined;
      }
      bodies.clear();
      contacts = [];
    },
  });
}
