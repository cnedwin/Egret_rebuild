// SPDX-License-Identifier: Apache-2.0
import { DisplayObject, EgretError } from '@egret/runtime';
import { areaOf, boxesMeet, boxOf, cast, convex, holds, meet, place } from './physics2dGeometry.js';
import type { Box, Placed } from './physics2dGeometry.js';
import type {
  PhysicsBody,
  PhysicsBodyKind,
  PhysicsBodyOptions,
  PhysicsContact,
  PhysicsJoint,
  PhysicsJointOptions,
  PhysicsMoveResult,
  PhysicsRayHit,
  PhysicsShape,
  PhysicsSnapshot,
  PhysicsTileColliders,
  PhysicsVector,
  PhysicsWorld,
  PhysicsWorldOptions
} from './physics2dTypes.js';

interface Body {
  readonly id: number;
  kind: PhysicsBodyKind;
  readonly shape: PhysicsShape;
  readonly density: number;
  mass: number;
  inverseMass: number;
  readonly sensor: boolean;
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  restitution: number;
  friction: number;
  gravityScale: number;
  layer: number;
  mask: number;
  data: unknown;
  readonly display: DisplayObject | undefined;
  removed: boolean;
  placed: Placed | undefined;
  box: Box | undefined;
  face: PhysicsBody;
}
interface Joint {
  readonly kind: 'distance' | 'rope';
  readonly a: Body;
  readonly b: Body | undefined;
  readonly px: number;
  readonly py: number;
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
  readonly stiffness: number;
  length: number;
  removed: boolean;
  face: PhysicsJoint;
}
interface Touch {
  readonly a: Body;
  readonly b: Body;
  nx: number;
  ny: number;
  readonly sensor: boolean;
}
const SLOP = 0.01,
  CORRECTION = 0.8;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const bits = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffffff;
const vector = (value: unknown): value is PhysicsVector => record(value) && finite(value['x']) && finite(value['y']);
function shapeOk(shape: unknown): shape is PhysicsShape {
  if (!record(shape)) return false;
  if (shape['kind'] === 'circle') return finite(shape['radius']) && (shape['radius'] as number) > 0;
  if (shape['kind'] === 'box')
    return (
      finite(shape['width']) &&
      finite(shape['height']) &&
      (shape['width'] as number) > 0 &&
      (shape['height'] as number) > 0
    );
  return (
    shape['kind'] === 'polygon' &&
    Array.isArray(shape['points']) &&
    (shape['points'] as unknown[]).every(vector) &&
    convex(shape['points'] as PhysicsVector[])
  );
}

/** A world of bodies that move, meet and push each other apart, in fixed steps, without turning. */
export function createPhysicsWorld(options: PhysicsWorldOptions = {}): PhysicsWorld {
  if (options === null || typeof options !== 'object' || Array.isArray(options))
    throw new EgretError('PHYSICS_OPTIONS_INVALID');
  const {
    gravity: g0 = { x: 0, y: 0 },
    fixedStep = 1 / 60,
    maxSteps = 8,
    iterations = 8,
    cellSize = 64,
    maxBodies = 4096,
    bounceThreshold
  } = options;
  if (
    !vector(g0) ||
    !finite(fixedStep) ||
    fixedStep <= 0 ||
    fixedStep > 1 ||
    !Number.isSafeInteger(maxSteps) ||
    maxSteps < 1 ||
    maxSteps > 120 ||
    !Number.isSafeInteger(iterations) ||
    iterations < 1 ||
    iterations > 64 ||
    !finite(cellSize) ||
    cellSize <= 0 ||
    !Number.isSafeInteger(maxBodies) ||
    maxBodies < 1 ||
    maxBodies > 65536 ||
    (bounceThreshold !== undefined && (!finite(bounceThreshold) || bounceThreshold < 0))
  )
    throw new EgretError('PHYSICS_OPTIONS_INVALID');
  let gravity: PhysicsVector = Object.freeze({ x: g0.x, y: g0.y });
  const bodies: Body[] = [];
  const joints: Joint[] = [];
  let stepping = false;
  const listeners = new Set<(contact: PhysicsContact) => void>();
  let touching = new Map<string, Touch>(),
    pending = 0,
    steps = 0,
    ids = 0,
    closed = false;

  const open = (): void => {
    if (closed) throw new EgretError('PHYSICS_CLOSED');
  };
  function shapeOf(body: Body): Placed {
    body.placed ??= place(body.shape, body.x, body.y, body.angle);
    return body.placed;
  }
  function boxFor(body: Body): Box {
    body.box ??= boxOf(shapeOf(body));
    return body.box;
  }
  function moved(body: Body): void {
    body.placed = undefined;
    body.box = undefined;
  }
  function own(value: unknown): Body {
    const body = bodies.find(candidate => candidate.face === (value as unknown));
    if (body === undefined) throw new EgretError('PHYSICS_BODY_INVALID');
    return body;
  }
  const meets = (a: Body, b: Body): boolean => (a.layer & b.mask) !== 0 && (b.layer & a.mask) !== 0;

  function faceOf(body: Body): PhysicsBody {
    const settable = (key: 'restitution' | 'friction' | 'gravityScale', least: number) => ({
      get: (): number => body[key],
      set: (value: number): void => {
        if (!finite(value) || value < least) throw new EgretError('PHYSICS_OPTIONS_INVALID');
        body[key] = value;
      }
    });
    const placeKey = (key: 'x' | 'y' | 'angle') => ({
      get: (): number => body[key],
      set: (value: number): void => {
        if (!finite(value)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
        body[key] = value;
        moved(body);
      }
    });
    const speedKey = (key: 'vx' | 'vy') => ({
      get: (): number => body[key],
      set: (value: number): void => {
        if (!finite(value)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
        if (body.kind !== 'static') body[key] = value;
      }
    });
    const bitKey = (key: 'layer' | 'mask') => ({
      get: (): number => body[key],
      set: (value: number): void => {
        if (!bits(value)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
        body[key] = value;
      }
    });
    const face = {
      id: body.id,
      get kind(): PhysicsBodyKind {
        return body.kind;
      },
      shape: body.shape,
      get mass(): number {
        return body.mass;
      },
      sensor: body.sensor,
      setKind(kind: PhysicsBodyKind): void {
        if (kind !== 'static' && kind !== 'kinematic' && kind !== 'dynamic')
          throw new EgretError('PHYSICS_OPTIONS_INVALID');
        if (body.removed) throw new EgretError('PHYSICS_BODY_INVALID');
        body.kind = kind;
        body.mass = kind === 'dynamic' ? body.density * areaOf(body.shape) : Infinity;
        body.inverseMass = kind === 'dynamic' ? 1 / body.mass : 0;
        body.fx = 0;
        body.fy = 0;
        if (kind === 'static') {
          body.vx = 0;
          body.vy = 0;
        }
      },
      get state(): 'active' | 'removed' {
        return body.removed ? 'removed' : 'active';
      },
      get data(): unknown {
        return body.data;
      },
      set data(value: unknown) {
        body.data = value;
      },
      applyImpulse(x: number, y: number): void {
        if (!finite(x) || !finite(y)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
        if (body.kind === 'dynamic') {
          body.vx += x * body.inverseMass;
          body.vy += y * body.inverseMass;
        }
      },
      applyForce(x: number, y: number): void {
        if (!finite(x) || !finite(y)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
        if (body.kind === 'dynamic') {
          body.fx += x;
          body.fy += y;
        }
      },
      bounds(): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
        const box = boxFor(body);
        return Object.freeze({ x: box.minX, y: box.minY, width: box.maxX - box.minX, height: box.maxY - box.minY });
      }
    };
    for (const key of ['x', 'y', 'angle'] as const)
      Object.defineProperty(face, key, { ...placeKey(key), enumerable: true });
    for (const key of ['vx', 'vy'] as const) Object.defineProperty(face, key, { ...speedKey(key), enumerable: true });
    for (const key of ['layer', 'mask'] as const)
      Object.defineProperty(face, key, { ...bitKey(key), enumerable: true });
    Object.defineProperty(face, 'restitution', { ...settable('restitution', 0), enumerable: true });
    Object.defineProperty(face, 'friction', { ...settable('friction', 0), enumerable: true });
    Object.defineProperty(face, 'gravityScale', {
      get: () => body.gravityScale,
      set: (value: number) => {
        if (!finite(value)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
        body.gravityScale = value;
      },
      enumerable: true
    });
    return Object.freeze(face) as unknown as PhysicsBody;
  }
  function add(o: PhysicsBodyOptions): PhysicsBody {
    if (o === null || typeof o !== 'object' || Array.isArray(o)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
    const {
      kind = 'dynamic',
      shape,
      x = 0,
      y = 0,
      angle = 0,
      vx = 0,
      vy = 0,
      density = 1,
      restitution = 0,
      friction = 0.3,
      gravityScale = 1,
      layer = 1,
      mask = 0xffffffff,
      sensor = false,
      display,
      data
    } = o;
    if (
      (kind !== 'static' && kind !== 'kinematic' && kind !== 'dynamic') ||
      !shapeOk(shape) ||
      ![x, y, angle, vx, vy, gravityScale].every(finite) ||
      !finite(density) ||
      density <= 0 ||
      !finite(restitution) ||
      restitution < 0 ||
      restitution > 1 ||
      !finite(friction) ||
      friction < 0 ||
      !bits(layer) ||
      !bits(mask) ||
      typeof sensor !== 'boolean' ||
      (display !== undefined && (!(display instanceof DisplayObject) || display.isDisposed))
    )
      throw new EgretError('PHYSICS_OPTIONS_INVALID');
    open();
    if (bodies.length >= maxBodies) throw new EgretError('PHYSICS_BODY_LIMIT');
    const frozen: PhysicsShape =
      shape.kind === 'polygon'
        ? Object.freeze({
            kind: 'polygon',
            points: Object.freeze(shape.points.map(p => Object.freeze({ x: p.x, y: p.y })))
          })
        : Object.freeze({ ...shape });
    const mass = kind === 'dynamic' ? density * areaOf(frozen) : Infinity;
    const body: Body = {
      id: ++ids,
      kind,
      shape: frozen,
      density,
      mass,
      inverseMass: kind === 'dynamic' ? 1 / mass : 0,
      sensor,
      x,
      y,
      angle,
      vx: kind === 'static' ? 0 : vx,
      vy: kind === 'static' ? 0 : vy,
      fx: 0,
      fy: 0,
      restitution,
      friction,
      gravityScale,
      layer,
      mask,
      data,
      display,
      removed: false,
      placed: undefined,
      box: undefined,
      face: undefined as unknown as PhysicsBody
    };
    body.face = faceOf(body);
    bodies.push(body);
    if (display !== undefined) {
      display.x = x;
      display.y = y;
      display.rotation = angle;
    }
    return body.face;
  }
  /** Where a joint holds a body, in the world: its anchor turned by the body's angle. */
  function anchorOf(body: Body, ax: number, ay: number): [number, number] {
    if (ax === 0 && ay === 0) return [body.x, body.y];
    const turn = (body.angle * Math.PI) / 180,
      c = Math.cos(turn),
      s = Math.sin(turn);
    return [body.x + ax * c - ay * s, body.y + ax * s + ay * c];
  }
  function ends(joint: Joint): [number, number, number, number] {
    const [x1, y1] = anchorOf(joint.a, joint.ax, joint.ay),
      [x2, y2] = joint.b === undefined ? [joint.px, joint.py] : anchorOf(joint.b, joint.bx, joint.by);
    return [x1, y1, x2, y2];
  }
  /** The line from a to b, its length, and how far that is from the joint's own length; undefined when slack. */
  function strain(joint: Joint): { nx: number; ny: number; error: number } | undefined {
    const [x1, y1, x2, y2] = ends(joint),
      dx = x2 - x1,
      dy = y2 - y1,
      distance = Math.hypot(dx, dy),
      error = distance - joint.length;
    if (joint.kind === 'rope' && error <= 0) return undefined;
    // Two anchors at one place have no line between them: a pin holds them together in place only.
    if (distance < 1e-9) return { nx: 0, ny: 0, error: 0 };
    return { nx: dx / distance, ny: dy / distance, error };
  }
  /** Takes out the speed along a joint that would stretch it, or, for a rod, change its length. */
  function holdSpeed(joint: Joint, dt: number): void {
    const a = joint.a,
      b = joint.b,
      ib = b === undefined ? 0 : b.inverseMass,
      total = a.inverseMass + ib;
    if (total === 0) return;
    const line = strain(joint);
    if (line === undefined) return;
    if (line.nx === 0 && line.ny === 0) {
      // A pin: the body moves as what it is pinned to does.
      const vx = b === undefined ? 0 : b.vx,
        vy = b === undefined ? 0 : b.vy,
        rx = vx - a.vx,
        ry = vy - a.vy;
      a.vx += (rx * a.inverseMass) / total;
      a.vy += (ry * a.inverseMass) / total;
      if (b !== undefined) {
        b.vx -= (rx * ib) / total;
        b.vy -= (ry * ib) / total;
      }
      return;
    }
    const along = ((b === undefined ? 0 : b.vx) - a.vx) * line.nx + ((b === undefined ? 0 : b.vy) - a.vy) * line.ny;
    // A rope pulls only against stretching; a rod against both.
    const bias = (line.error * joint.stiffness * 0.2) / dt;
    let j = -(along + bias) / total;
    if (joint.kind === 'rope' && j > 0) j = 0;
    j *= joint.stiffness;
    a.vx -= j * line.nx * a.inverseMass;
    a.vy -= j * line.ny * a.inverseMass;
    if (b !== undefined) {
      b.vx += j * line.nx * ib;
      b.vy += j * line.ny * ib;
    }
  }
  /** Moves the bodies of a joint back to its length, shared by their inverse masses. */
  function holdPlace(joint: Joint): void {
    const a = joint.a,
      b = joint.b,
      ib = b === undefined ? 0 : b.inverseMass,
      total = a.inverseMass + ib;
    if (total === 0) return;
    const [x1, y1, x2, y2] = ends(joint),
      dx = x2 - x1,
      dy = y2 - y1,
      distance = Math.hypot(dx, dy);
    let error = distance - joint.length;
    if (joint.kind === 'rope' && error <= 0) return;
    if (Math.abs(error) <= SLOP) return;
    error *= joint.stiffness * CORRECTION;
    const nx = distance < 1e-9 ? 0 : dx / distance,
      ny = distance < 1e-9 ? 0 : dy / distance,
      push = error / total;
    a.x += nx * push * a.inverseMass;
    a.y += ny * push * a.inverseMass;
    moved(a);
    if (b !== undefined && ib > 0) {
      b.x -= nx * push * ib;
      b.y -= ny * push * ib;
      moved(b);
    }
  }
  function jointFace(joint: Joint): PhysicsJoint {
    return Object.freeze(
      Object.defineProperties(
        {
          kind: joint.kind,
          a: joint.a.face,
          b: joint.b?.face,
          distance(): number {
            const [x1, y1, x2, y2] = ends(joint);
            return Math.hypot(x2 - x1, y2 - y1);
          }
        },
        {
          state: { get: () => (joint.removed ? 'removed' : 'active'), enumerable: true },
          length: {
            get: () => joint.length,
            set: (value: number) => {
              if (!finite(value) || value < 0) throw new EgretError('PHYSICS_OPTIONS_INVALID');
              joint.length = value;
            },
            enumerable: true
          }
        }
      )
    ) as unknown as PhysicsJoint;
  }
  function addJoint(o: PhysicsJointOptions): PhysicsJoint {
    if (!record(o)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
    const { kind, point, anchorA = { x: 0, y: 0 }, anchorB = { x: 0, y: 0 }, length, stiffness = 1 } = o;
    if (
      (kind !== 'distance' && kind !== 'rope') ||
      !vector(anchorA) ||
      !vector(anchorB) ||
      (length !== undefined && (!finite(length) || length < 0)) ||
      !finite(stiffness) ||
      stiffness <= 0 ||
      stiffness > 1 ||
      (o.b === undefined) === (point === undefined) ||
      (point !== undefined && !vector(point))
    )
      throw new EgretError('PHYSICS_OPTIONS_INVALID');
    open();
    const a = own(o.a),
      b = o.b === undefined ? undefined : own(o.b);
    if (a === b) throw new EgretError('PHYSICS_OPTIONS_INVALID');
    const joint: Joint = {
      kind,
      a,
      b,
      px: point?.x ?? 0,
      py: point?.y ?? 0,
      ax: anchorA.x,
      ay: anchorA.y,
      bx: anchorB.x,
      by: anchorB.y,
      stiffness,
      length: 0,
      removed: false,
      face: undefined as unknown as PhysicsJoint
    };
    if (length === undefined) {
      const [x1, y1, x2, y2] = ends(joint);
      joint.length = Math.hypot(x2 - x1, y2 - y1);
    } else joint.length = length;
    joint.face = jointFace(joint);
    joints.push(joint);
    return joint.face;
  }
  function dropJoint(joint: Joint): void {
    const index = joints.indexOf(joint);
    if (index >= 0) joints.splice(index, 1);
    joint.removed = true;
  }
  /** The pairs whose boxes share a cell of the grid, each once, in the order of their ids. */
  function pairs(): [Body, Body][] {
    const cells = new Map<string, Body[]>(),
      seen = new Set<string>(),
      out: [Body, Body][] = [];
    for (const body of bodies) {
      const box = boxFor(body);
      const x0 = Math.floor(box.minX / cellSize),
        x1 = Math.floor(box.maxX / cellSize),
        y0 = Math.floor(box.minY / cellSize),
        y1 = Math.floor(box.maxY / cellSize);
      // A body larger than very many cells is put in each of them all the same; tile colliders are cut to rows, so this stays small.
      for (let cx = x0; cx <= x1; cx++)
        for (let cy = y0; cy <= y1; cy++) {
          const key = cx + ',' + cy,
            list = cells.get(key);
          if (list === undefined) {
            cells.set(key, [body]);
            continue;
          }
          for (const other of list) {
            const [a, b] = other.id < body.id ? [other, body] : [body, other],
              id = a.id + ':' + b.id;
            if (seen.has(id)) continue;
            seen.add(id);
            if (
              (a.kind !== 'dynamic' && b.kind !== 'dynamic' && !a.sensor && !b.sensor) ||
              !meets(a, b) ||
              !boxesMeet(boxFor(a), boxFor(b))
            )
              continue;
            out.push([a, b]);
          }
          list.push(body);
        }
    }
    return out.sort((p, q) => p[0].id - q[0].id || p[1].id - q[1].id);
  }
  function once(dt: number): void {
    const threshold = bounceThreshold ?? Math.max(1, 2 * Math.hypot(gravity.x, gravity.y) * dt);
    for (const body of bodies) {
      if (body.kind === 'static') continue;
      if (body.kind === 'dynamic') {
        body.vx += (gravity.x * body.gravityScale + body.fx * body.inverseMass) * dt;
        body.vy += (gravity.y * body.gravityScale + body.fy * body.inverseMass) * dt;
      }
      body.fx = 0;
      body.fy = 0;
      if (body.vx !== 0 || body.vy !== 0) {
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        moved(body);
      }
    }
    const found = pairs(),
      now = new Map<string, Touch>();
    const solid: { a: Body; b: Body; nx: number; ny: number; depth: number }[] = [];
    for (const [a, b] of found) {
      const meeting = meet(shapeOf(a), shapeOf(b));
      if (meeting === undefined) continue;
      const sensor = a.sensor || b.sensor;
      now.set(a.id + ':' + b.id, { a, b, nx: meeting.nx, ny: meeting.ny, sensor });
      if (!sensor && (a.kind === 'dynamic' || b.kind === 'dynamic')) solid.push({ a, b, ...meeting });
    }
    // Speeds first, in rounds, so that a stack settles; then the places, so that nothing stays inside another.
    for (let round = 0; round < iterations; round++) {
      for (const c of solid) {
        const { a, b, nx, ny } = c,
          total = a.inverseMass + b.inverseMass;
        if (total === 0) continue;
        const rvx = b.vx - a.vx,
          rvy = b.vy - a.vy,
          along = rvx * nx + rvy * ny;
        if (along > 0) continue;
        // The bouncier of the two decides, so that a ball bounces on a floor that says nothing of bouncing.
        // What only rests on another, held down by gravity, meets it at a speed below the threshold and is not thrown back up.
        const bounce = -along > threshold ? Math.max(a.restitution, b.restitution) : 0,
          j = (-(1 + bounce) * along) / total;
        a.vx -= j * nx * a.inverseMass;
        a.vy -= j * ny * a.inverseMass;
        b.vx += j * nx * b.inverseMass;
        b.vy += j * ny * b.inverseMass;
        // Friction along the contact, no more than it can hold for the push across it.
        const tvx = rvx - along * nx,
          tvy = rvy - along * ny,
          tl = Math.hypot(tvx, tvy);
        if (tl > 1e-12) {
          const tx = tvx / tl,
            ty = tvy / tl,
            jt = -(rvx * tx + rvy * ty) / total,
            limit = j * Math.sqrt(a.friction * b.friction),
            applied = Math.max(-limit, Math.min(limit, jt));
          a.vx -= applied * tx * a.inverseMass;
          a.vy -= applied * ty * a.inverseMass;
          b.vx += applied * tx * b.inverseMass;
          b.vy += applied * ty * b.inverseMass;
        }
      }
      for (const joint of joints) holdSpeed(joint, dt);
    }
    // A few passes, each measuring again, so that a stack does not sink into what it stands on.
    for (let pass = 0; pass < 3; pass++)
      for (const c of solid) {
        const again = pass === 0 ? c : meet(shapeOf(c.a), shapeOf(c.b));
        if (again === undefined) continue;
        const { a, b } = c,
          { nx, ny, depth } = again,
          total = a.inverseMass + b.inverseMass;
        if (total === 0 || depth <= SLOP) continue;
        const push = ((depth - SLOP) * CORRECTION) / total;
        if (a.inverseMass > 0) {
          a.x -= nx * push * a.inverseMass;
          a.y -= ny * push * a.inverseMass;
          moved(a);
        }
        if (b.inverseMass > 0) {
          b.x += nx * push * b.inverseMass;
          b.y += ny * push * b.inverseMass;
          moved(b);
        }
      }
    for (let pass = 0; pass < 3; pass++) for (const joint of joints) holdPlace(joint);
    const told: PhysicsContact[] = [];
    for (const [key, touch] of now)
      if (!touching.has(key))
        told.push(
          Object.freeze({
            type: 'begin',
            a: touch.a.face,
            b: touch.b.face,
            normal: Object.freeze({ x: touch.nx, y: touch.ny }),
            sensor: touch.sensor
          })
        );
    for (const [key, touch] of touching)
      if (!now.has(key))
        told.push(
          Object.freeze({
            type: 'end',
            a: touch.a.face,
            b: touch.b.face,
            normal: Object.freeze({ x: touch.nx, y: touch.ny }),
            sensor: touch.sensor
          })
        );
    touching = now;
    tell(told);
  }
  function tell(told: readonly PhysicsContact[]): void {
    const failures: unknown[] = [];
    for (const contact of told)
      for (const listener of [...listeners])
        try {
          listener(contact);
        } catch (cause) {
          failures.push(cause);
        }
    if (failures.length > 0)
      throw new EgretError('PHYSICS_LISTENER_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
  }
  function sync(): void {
    for (const body of bodies)
      if (body.display !== undefined && !body.display.isDisposed) {
        body.display.x = body.x;
        body.display.y = body.y;
        body.display.rotation = body.angle;
      }
  }
  function remove(body: Body, failures: unknown[]): void {
    const index = bodies.indexOf(body);
    if (index < 0) return;
    bodies.splice(index, 1);
    body.removed = true;
    for (const joint of [...joints]) if (joint.a === body || joint.b === body) dropJoint(joint);
    const ended: PhysicsContact[] = [];
    for (const [key, touch] of [...touching])
      if (touch.a === body || touch.b === body) {
        touching.delete(key);
        ended.push(
          Object.freeze({
            type: 'end',
            a: touch.a.face,
            b: touch.b.face,
            normal: Object.freeze({ x: touch.nx, y: touch.ny }),
            sensor: touch.sensor
          })
        );
      }
    try {
      tell(ended);
    } catch (cause) {
      failures.push(cause);
    }
  }
  const maskOf = (value: unknown): number => {
    if (value === undefined) return 0xffffffff;
    if (!bits(value)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
    return value as number;
  };

  return Object.freeze({
    get state(): 'active' | 'closed' {
      return closed ? 'closed' : 'active';
    },
    get gravity(): PhysicsVector {
      return gravity;
    },
    set gravity(value: PhysicsVector) {
      if (!vector(value)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
      gravity = Object.freeze({ x: value.x, y: value.y });
    },
    get bodies(): readonly PhysicsBody[] {
      return Object.freeze(bodies.map(body => body.face));
    },
    addBody: add,
    addJoint,
    removeJoint(value: PhysicsJoint): void {
      const joint = joints.find(candidate => candidate.face === value);
      if (joint === undefined) throw new EgretError('PHYSICS_JOINT_INVALID');
      dropJoint(joint);
    },
    get joints(): readonly PhysicsJoint[] {
      return Object.freeze(joints.map(joint => joint.face));
    },
    removeBody(value: PhysicsBody): void {
      const body = own(value),
        failures: unknown[] = [];
      remove(body, failures);
      if (failures.length > 0) throw failures[0];
    },
    addTileColliders(grid: PhysicsTileColliders): readonly PhysicsBody[] {
      if (
        grid === null ||
        typeof grid !== 'object' ||
        !Number.isSafeInteger(grid.columns) ||
        grid.columns < 0 ||
        !Number.isSafeInteger(grid.rows) ||
        grid.rows < 0 ||
        !finite(grid.tileWidth) ||
        grid.tileWidth <= 0 ||
        !finite(grid.tileHeight) ||
        grid.tileHeight <= 0 ||
        typeof grid.solid !== 'function' ||
        (grid.x !== undefined && !finite(grid.x)) ||
        (grid.y !== undefined && !finite(grid.y)) ||
        (grid.layer !== undefined && !bits(grid.layer)) ||
        (grid.friction !== undefined && (!finite(grid.friction) || grid.friction < 0)) ||
        grid.columns * grid.rows > 1 << 24
      )
        throw new EgretError('PHYSICS_OPTIONS_INVALID');
      open();
      const ox = grid.x ?? 0,
        oy = grid.y ?? 0;
      // Runs of solid cells across each row; a run is grown down through the rows below while they have the same run.
      const used = new Uint8Array(grid.columns * grid.rows),
        made: PhysicsBody[] = [];
      const solid = (c: number, r: number): boolean => grid.solid(c, r) === true;
      for (let r = 0; r < grid.rows; r++)
        for (let c = 0; c < grid.columns; c++) {
          if (used[r * grid.columns + c] === 1 || !solid(c, r)) continue;
          let end = c;
          while (end + 1 < grid.columns && used[r * grid.columns + end + 1] === 0 && solid(end + 1, r)) end++;
          let bottom = r;
          grow: while (bottom + 1 < grid.rows) {
            for (let k = c; k <= end; k++)
              if (used[(bottom + 1) * grid.columns + k] === 1 || !solid(k, bottom + 1)) break grow;
            // The run below must end where this one does, or it would be cut.
            if (
              (c > 0 && solid(c - 1, bottom + 1) && used[(bottom + 1) * grid.columns + c - 1] === 0) ||
              (end + 1 < grid.columns && solid(end + 1, bottom + 1))
            )
              break;
            bottom++;
          }
          for (let rr = r; rr <= bottom; rr++) for (let k = c; k <= end; k++) used[rr * grid.columns + k] = 1;
          const width = (end - c + 1) * grid.tileWidth,
            height = (bottom - r + 1) * grid.tileHeight;
          made.push(
            add({
              kind: 'static',
              shape: { kind: 'box', width, height },
              x: ox + c * grid.tileWidth + width / 2,
              y: oy + r * grid.tileHeight + height / 2,
              ...(grid.layer === undefined ? {} : { layer: grid.layer }),
              ...(grid.friction === undefined ? {} : { friction: grid.friction })
            })
          );
        }
      return Object.freeze(made);
    },
    step(seconds: number): number {
      if (!finite(seconds) || seconds < 0) throw new EgretError('PHYSICS_OPTIONS_INVALID');
      open();
      // A contact listener that steps would start a step inside the one it is told of.
      if (stepping) throw new EgretError('PHYSICS_STEP_REENTRANT');
      pending += seconds;
      let taken = 0;
      stepping = true;
      try {
        // A tiny remainder of a float is one step, not a step short.
        while (pending + 1e-9 >= fixedStep && taken < maxSteps && !closed) {
          pending = Math.max(0, pending - fixedStep);
          once(fixedStep);
          taken++;
          steps++;
        }
      } finally {
        stepping = false;
      }
      // What could not be caught up is let go, so that the next update is not behind before it starts.
      if (taken === maxSteps) pending = Math.min(pending, fixedStep);
      sync();
      return taken;
    },
    onContact(listener: (contact: PhysicsContact) => void): () => void {
      if (typeof listener !== 'function') throw new EgretError('PHYSICS_OPTIONS_INVALID');
      open();
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
    queryPoint(x: number, y: number, mask?: number): readonly PhysicsBody[] {
      if (!finite(x) || !finite(y)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
      const m = maskOf(mask);
      return Object.freeze(
        bodies.filter(body => (body.layer & m) !== 0 && holds(shapeOf(body), x, y)).map(body => body.face)
      );
    },
    queryRect(
      rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
      mask?: number
    ): readonly PhysicsBody[] {
      if (
        rect === null ||
        typeof rect !== 'object' ||
        !finite(rect.x) ||
        !finite(rect.y) ||
        !finite(rect.width) ||
        !finite(rect.height) ||
        rect.width < 0 ||
        rect.height < 0
      )
        throw new EgretError('PHYSICS_OPTIONS_INVALID');
      const m = maskOf(mask),
        probe = place(
          { kind: 'box', width: Math.max(rect.width, 1e-9), height: Math.max(rect.height, 1e-9) },
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          0
        );
      return Object.freeze(
        bodies.filter(body => (body.layer & m) !== 0 && meet(probe, shapeOf(body)) !== undefined).map(body => body.face)
      );
    },
    raycast(from: PhysicsVector, to: PhysicsVector, mask?: number): PhysicsRayHit | undefined {
      if (!vector(from) || !vector(to)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
      const m = maskOf(mask),
        dx = to.x - from.x,
        dy = to.y - from.y;
      let best: { body: Body; t: number; nx: number; ny: number } | undefined;
      for (const body of bodies) {
        if (body.sensor || (body.layer & m) === 0) continue;
        const hit = cast(shapeOf(body), from.x, from.y, dx, dy);
        if (hit !== undefined && (best === undefined || hit.t < best.t)) best = { body, ...hit };
      }
      return best === undefined
        ? undefined
        : Object.freeze({
            body: best.body.face,
            point: Object.freeze({ x: from.x + dx * best.t, y: from.y + dy * best.t }),
            normal: Object.freeze({ x: best.nx, y: best.ny }),
            fraction: best.t
          });
    },
    moveAndSlide(value: PhysicsBody, dx: number, dy: number): PhysicsMoveResult {
      const body = own(value);
      if (!finite(dx) || !finite(dy)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
      open();
      const normals: PhysicsVector[] = [];
      // Across and down apart, each pushed back out of what it entered, so that the body slides along a wall. A long
      // movement is taken in parts no longer than half the body, so that it cannot pass through a thin wall.
      const box = boxFor(body),
        part = Math.max(1e-6, Math.min(box.maxX - box.minX, box.maxY - box.minY) / 2);
      for (const [mx, my] of [
        [dx, 0],
        [0, dy]
      ] as const) {
        const distance = Math.abs(mx + my);
        if (distance === 0) continue;
        const pieces = Math.min(10000, Math.ceil(distance / part));
        let blocked = false;
        for (let piece = 0; piece < pieces && !blocked; piece++) {
          body.x += mx / pieces;
          body.y += my / pieces;
          moved(body);
          for (let round = 0; round < 4; round++) {
            let deepest: { nx: number; ny: number; depth: number } | undefined;
            for (const other of bodies) {
              if (
                other === body ||
                other.sensor ||
                other.kind === 'dynamic' ||
                !meets(body, other) ||
                !boxesMeet(boxFor(body), boxFor(other))
              )
                continue;
              const meeting = meet(shapeOf(body), shapeOf(other));
              if (
                meeting !== undefined &&
                meeting.depth > 1e-9 &&
                (deepest === undefined || meeting.depth > deepest.depth)
              )
                deepest = meeting;
            }
            if (deepest === undefined) break;
            body.x -= deepest.nx * deepest.depth;
            body.y -= deepest.ny * deepest.depth;
            moved(body);
            normals.push(Object.freeze({ x: 0 - deepest.nx, y: 0 - deepest.ny }));
            // Pushed back against the way it was going: what is left of this way is blocked.
            if (deepest.nx * mx + deepest.ny * my > 0) blocked = true;
          }
        }
      }
      if (body.display !== undefined && !body.display.isDisposed) {
        body.display.x = body.x;
        body.display.y = body.y;
      }
      return Object.freeze({ x: body.x, y: body.y, collided: normals.length > 0, normals: Object.freeze(normals) });
    },
    snapshot(): PhysicsSnapshot {
      return Object.freeze({ bodies: bodies.length, contacts: touching.size, steps, pending });
    },
    dispose(): void {
      if (closed) return;
      closed = true;
      for (const body of bodies) body.removed = true;
      bodies.length = 0;
      for (const joint of joints) joint.removed = true;
      joints.length = 0;
      touching.clear();
      listeners.clear();
    }
  });
}
