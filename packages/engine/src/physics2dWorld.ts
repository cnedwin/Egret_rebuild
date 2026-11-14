// SPDX-License-Identifier: Apache-2.0
import { DisplayObject, EgretError } from '@egret/runtime';
import { areaOf, boxesMeet, boxOf, cast, convex, holds, meet, place } from './physics2dGeometry.js';
import type { Box, Placed } from './physics2dGeometry.js';
import type {
  PhysicsBody, PhysicsBodyKind, PhysicsBodyOptions, PhysicsContact, PhysicsMoveResult, PhysicsRayHit, PhysicsShape, PhysicsSnapshot, PhysicsTileColliders, PhysicsVector,
  PhysicsWorld, PhysicsWorldOptions,
} from './physics2dTypes.js';

interface Body {
  readonly id: number; readonly kind: PhysicsBodyKind; readonly shape: PhysicsShape; readonly mass: number; readonly inverseMass: number; readonly sensor: boolean;
  x: number; y: number; angle: number; vx: number; vy: number; fx: number; fy: number;
  restitution: number; friction: number; gravityScale: number; layer: number; mask: number; data: unknown;
  readonly display: DisplayObject | undefined; removed: boolean; placed: Placed | undefined; box: Box | undefined; face: PhysicsBody;
}
interface Touch { readonly a: Body; readonly b: Body; nx: number; ny: number; readonly sensor: boolean; }
const SLOP = 0.01, CORRECTION = 0.8;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const bits = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffffff;
const vector = (value: unknown): value is PhysicsVector => record(value) && finite(value['x']) && finite(value['y']);
function shapeOk(shape: unknown): shape is PhysicsShape {
  if (!record(shape)) return false;
  if (shape['kind'] === 'circle') return finite(shape['radius']) && (shape['radius'] as number) > 0;
  if (shape['kind'] === 'box') return finite(shape['width']) && finite(shape['height']) && (shape['width'] as number) > 0 && (shape['height'] as number) > 0;
  return shape['kind'] === 'polygon' && Array.isArray(shape['points']) && (shape['points'] as unknown[]).every(vector) && convex(shape['points'] as PhysicsVector[]);
}

/** A world of bodies that move, meet and push each other apart, in fixed steps, without turning. */
export function createPhysicsWorld(options: PhysicsWorldOptions = {}): PhysicsWorld {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
  const { gravity: g0 = { x: 0, y: 0 }, fixedStep = 1 / 60, maxSteps = 8, iterations = 8, cellSize = 64, maxBodies = 4096, bounceThreshold } = options;
  if (!vector(g0) || !finite(fixedStep) || fixedStep <= 0 || fixedStep > 1 || !Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > 120 || !Number.isSafeInteger(iterations) || iterations < 1 || iterations > 64
    || !finite(cellSize) || cellSize <= 0 || !Number.isSafeInteger(maxBodies) || maxBodies < 1 || maxBodies > 65536
    || (bounceThreshold !== undefined && (!finite(bounceThreshold) || bounceThreshold < 0))) throw new EgretError('PHYSICS_OPTIONS_INVALID');
  let gravity: PhysicsVector = Object.freeze({ x: g0.x, y: g0.y });
  const bodies: Body[] = [];
  const listeners = new Set<(contact: PhysicsContact) => void>();
  let touching = new Map<string, Touch>(), pending = 0, steps = 0, ids = 0, closed = false;

  const open = (): void => { if (closed) throw new EgretError('PHYSICS_CLOSED'); };
  function shapeOf(body: Body): Placed {
    body.placed ??= place(body.shape, body.x, body.y, body.angle);
    return body.placed;
  }
  function boxFor(body: Body): Box { body.box ??= boxOf(shapeOf(body)); return body.box; }
  function moved(body: Body): void { body.placed = undefined; body.box = undefined; }
  function own(value: unknown): Body {
    const body = bodies.find(candidate => candidate.face === (value as unknown));
    if (body === undefined) throw new EgretError('PHYSICS_BODY_INVALID');
    return body;
  }
  const meets = (a: Body, b: Body): boolean => (a.layer & b.mask) !== 0 && (b.layer & a.mask) !== 0;

  function faceOf(body: Body): PhysicsBody {
    const settable = (key: 'restitution' | 'friction' | 'gravityScale', least: number) => ({
      get: (): number => body[key], set: (value: number): void => { if (!finite(value) || value < least) throw new EgretError('PHYSICS_OPTIONS_INVALID'); body[key] = value; },
    });
    const placeKey = (key: 'x' | 'y' | 'angle') => ({ get: (): number => body[key], set: (value: number): void => { if (!finite(value)) throw new EgretError('PHYSICS_OPTIONS_INVALID'); body[key] = value; moved(body); } });
    const speedKey = (key: 'vx' | 'vy') => ({ get: (): number => body[key], set: (value: number): void => { if (!finite(value)) throw new EgretError('PHYSICS_OPTIONS_INVALID'); if (body.kind !== 'static') body[key] = value; } });
    const bitKey = (key: 'layer' | 'mask') => ({ get: (): number => body[key], set: (value: number): void => { if (!bits(value)) throw new EgretError('PHYSICS_OPTIONS_INVALID'); body[key] = value; } });
    const face = {
      id: body.id, kind: body.kind, shape: body.shape, mass: body.mass, sensor: body.sensor,
      get state(): 'active' | 'removed' { return body.removed ? 'removed' : 'active'; },
      get data(): unknown { return body.data; }, set data(value: unknown) { body.data = value; },
      applyImpulse(x: number, y: number): void {
        if (!finite(x) || !finite(y)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
        if (body.kind === 'dynamic') { body.vx += x * body.inverseMass; body.vy += y * body.inverseMass; }
      },
      applyForce(x: number, y: number): void {
        if (!finite(x) || !finite(y)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
        if (body.kind === 'dynamic') { body.fx += x; body.fy += y; }
      },
      bounds(): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
        const box = boxFor(body);
        return Object.freeze({ x: box.minX, y: box.minY, width: box.maxX - box.minX, height: box.maxY - box.minY });
      },
    };
    for (const key of ['x', 'y', 'angle'] as const) Object.defineProperty(face, key, { ...placeKey(key), enumerable: true });
    for (const key of ['vx', 'vy'] as const) Object.defineProperty(face, key, { ...speedKey(key), enumerable: true });
    for (const key of ['layer', 'mask'] as const) Object.defineProperty(face, key, { ...bitKey(key), enumerable: true });
    Object.defineProperty(face, 'restitution', { ...settable('restitution', 0), enumerable: true });
    Object.defineProperty(face, 'friction', { ...settable('friction', 0), enumerable: true });
    Object.defineProperty(face, 'gravityScale', { get: () => body.gravityScale, set: (value: number) => { if (!finite(value)) throw new EgretError('PHYSICS_OPTIONS_INVALID'); body.gravityScale = value; }, enumerable: true });
    return Object.freeze(face) as unknown as PhysicsBody;
  }
  function add(o: PhysicsBodyOptions): PhysicsBody {
    if (o === null || typeof o !== 'object' || Array.isArray(o)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
    const { kind = 'dynamic', shape, x = 0, y = 0, angle = 0, vx = 0, vy = 0, density = 1, restitution = 0, friction = 0.3, gravityScale = 1, layer = 1, mask = 0xffffffff, sensor = false, display, data } = o;
    if ((kind !== 'static' && kind !== 'kinematic' && kind !== 'dynamic') || !shapeOk(shape) || ![x, y, angle, vx, vy, gravityScale].every(finite) || !finite(density) || density <= 0
      || !finite(restitution) || restitution < 0 || restitution > 1 || !finite(friction) || friction < 0 || !bits(layer) || !bits(mask) || typeof sensor !== 'boolean'
      || (display !== undefined && (!(display instanceof DisplayObject) || display.isDisposed))) throw new EgretError('PHYSICS_OPTIONS_INVALID');
    open();
    if (bodies.length >= maxBodies) throw new EgretError('PHYSICS_BODY_LIMIT');
    const frozen: PhysicsShape = shape.kind === 'polygon' ? Object.freeze({ kind: 'polygon', points: Object.freeze(shape.points.map(p => Object.freeze({ x: p.x, y: p.y }))) }) : Object.freeze({ ...shape });
    const mass = kind === 'dynamic' ? density * areaOf(frozen) : Infinity;
    const body: Body = { id: ++ids, kind, shape: frozen, mass, inverseMass: kind === 'dynamic' ? 1 / mass : 0, sensor, x, y, angle, vx: kind === 'static' ? 0 : vx, vy: kind === 'static' ? 0 : vy, fx: 0, fy: 0,
      restitution, friction, gravityScale, layer, mask, data, display, removed: false, placed: undefined, box: undefined, face: undefined as unknown as PhysicsBody };
    body.face = faceOf(body);
    bodies.push(body);
    if (display !== undefined) { display.x = x; display.y = y; display.rotation = angle; }
    return body.face;
  }
  /** The pairs whose boxes share a cell of the grid, each once, in the order of their ids. */
  function pairs(): [Body, Body][] {
    const cells = new Map<string, Body[]>(), seen = new Set<string>(), out: [Body, Body][] = [];
    for (const body of bodies) {
      const box = boxFor(body);
      const x0 = Math.floor(box.minX / cellSize), x1 = Math.floor(box.maxX / cellSize), y0 = Math.floor(box.minY / cellSize), y1 = Math.floor(box.maxY / cellSize);
      // A body larger than very many cells is put in each of them all the same; tile colliders are cut to rows, so this stays small.
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
        const key = cx + ',' + cy, list = cells.get(key);
        if (list === undefined) { cells.set(key, [body]); continue; }
        for (const other of list) {
          const [a, b] = other.id < body.id ? [other, body] : [body, other], id = a.id + ':' + b.id;
          if (seen.has(id)) continue;
          seen.add(id);
          if ((a.kind !== 'dynamic' && b.kind !== 'dynamic' && !a.sensor && !b.sensor) || !meets(a, b) || !boxesMeet(boxFor(a), boxFor(b))) continue;
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
      body.fx = 0; body.fy = 0;
      if (body.vx !== 0 || body.vy !== 0) { body.x += body.vx * dt; body.y += body.vy * dt; moved(body); }
    }
    const found = pairs(), now = new Map<string, Touch>();
    const solid: { a: Body; b: Body; nx: number; ny: number; depth: number }[] = [];
    for (const [a, b] of found) {
      const meeting = meet(shapeOf(a), shapeOf(b));
      if (meeting === undefined) continue;
      const sensor = a.sensor || b.sensor;
      now.set(a.id + ':' + b.id, { a, b, nx: meeting.nx, ny: meeting.ny, sensor });
      if (!sensor && (a.kind === 'dynamic' || b.kind === 'dynamic')) solid.push({ a, b, ...meeting });
    }
    // Speeds first, in rounds, so that a stack settles; then the places, so that nothing stays inside another.
    for (let round = 0; round < iterations; round++) for (const c of solid) {
      const { a, b, nx, ny } = c, total = a.inverseMass + b.inverseMass;
      if (total === 0) continue;
      const rvx = b.vx - a.vx, rvy = b.vy - a.vy, along = rvx * nx + rvy * ny;
      if (along > 0) continue;
      // The bouncier of the two decides, so that a ball bounces on a floor that says nothing of bouncing.
      // What only rests on another, held down by gravity, meets it at a speed below the threshold and is not thrown back up.
      const bounce = -along > threshold ? Math.max(a.restitution, b.restitution) : 0, j = -(1 + bounce) * along / total;
      a.vx -= j * nx * a.inverseMass; a.vy -= j * ny * a.inverseMass; b.vx += j * nx * b.inverseMass; b.vy += j * ny * b.inverseMass;
      // Friction along the contact, no more than it can hold for the push across it.
      const tvx = rvx - along * nx, tvy = rvy - along * ny, tl = Math.hypot(tvx, tvy);
      if (tl > 1e-12) {
        const tx = tvx / tl, ty = tvy / tl, jt = -(rvx * tx + rvy * ty) / total, limit = j * Math.sqrt(a.friction * b.friction), applied = Math.max(-limit, Math.min(limit, jt));
        a.vx -= applied * tx * a.inverseMass; a.vy -= applied * ty * a.inverseMass; b.vx += applied * tx * b.inverseMass; b.vy += applied * ty * b.inverseMass;
      }
    }
    // A few passes, each measuring again, so that a stack does not sink into what it stands on.
    for (let pass = 0; pass < 3; pass++) for (const c of solid) {
      const again = pass === 0 ? c : meet(shapeOf(c.a), shapeOf(c.b));
      if (again === undefined) continue;
      const { a, b } = c, { nx, ny, depth } = again, total = a.inverseMass + b.inverseMass;
      if (total === 0 || depth <= SLOP) continue;
      const push = (depth - SLOP) * CORRECTION / total;
      if (a.inverseMass > 0) { a.x -= nx * push * a.inverseMass; a.y -= ny * push * a.inverseMass; moved(a); }
      if (b.inverseMass > 0) { b.x += nx * push * b.inverseMass; b.y += ny * push * b.inverseMass; moved(b); }
    }
    const told: PhysicsContact[] = [];
    for (const [key, touch] of now) if (!touching.has(key)) told.push(Object.freeze({ type: 'begin', a: touch.a.face, b: touch.b.face, normal: Object.freeze({ x: touch.nx, y: touch.ny }), sensor: touch.sensor }));
    for (const [key, touch] of touching) if (!now.has(key)) told.push(Object.freeze({ type: 'end', a: touch.a.face, b: touch.b.face, normal: Object.freeze({ x: touch.nx, y: touch.ny }), sensor: touch.sensor }));
    touching = now;
    tell(told);
  }
  function tell(told: readonly PhysicsContact[]): void {
    const failures: unknown[] = [];
    for (const contact of told) for (const listener of [...listeners]) try { listener(contact); } catch (cause) { failures.push(cause); }
    if (failures.length > 0) throw new EgretError('PHYSICS_LISTENER_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
  }
  function sync(): void {
    for (const body of bodies) if (body.display !== undefined && !body.display.isDisposed) { body.display.x = body.x; body.display.y = body.y; body.display.rotation = body.angle; }
  }
  function remove(body: Body, failures: unknown[]): void {
    const index = bodies.indexOf(body);
    if (index < 0) return;
    bodies.splice(index, 1);
    body.removed = true;
    const ended: PhysicsContact[] = [];
    for (const [key, touch] of [...touching]) if (touch.a === body || touch.b === body) {
      touching.delete(key);
      ended.push(Object.freeze({ type: 'end', a: touch.a.face, b: touch.b.face, normal: Object.freeze({ x: touch.nx, y: touch.ny }), sensor: touch.sensor }));
    }
    try { tell(ended); } catch (cause) { failures.push(cause); }
  }
  const maskOf = (value: unknown): number => { if (value === undefined) return 0xffffffff; if (!bits(value)) throw new EgretError('PHYSICS_OPTIONS_INVALID'); return value as number; };

  return Object.freeze({
    get state(): 'active' | 'closed' { return closed ? 'closed' : 'active'; },
    get gravity(): PhysicsVector { return gravity; },
    set gravity(value: PhysicsVector) { if (!vector(value)) throw new EgretError('PHYSICS_OPTIONS_INVALID'); gravity = Object.freeze({ x: value.x, y: value.y }); },
    get bodies(): readonly PhysicsBody[] { return Object.freeze(bodies.map(body => body.face)); },
    addBody: add,
    removeBody(value: PhysicsBody): void {
      const body = own(value), failures: unknown[] = [];
      remove(body, failures);
      if (failures.length > 0) throw failures[0];
    },
    addTileColliders(grid: PhysicsTileColliders): readonly PhysicsBody[] {
      if (grid === null || typeof grid !== 'object' || !Number.isSafeInteger(grid.columns) || grid.columns < 0 || !Number.isSafeInteger(grid.rows) || grid.rows < 0 || !finite(grid.tileWidth) || grid.tileWidth <= 0
        || !finite(grid.tileHeight) || grid.tileHeight <= 0 || typeof grid.solid !== 'function' || (grid.x !== undefined && !finite(grid.x)) || (grid.y !== undefined && !finite(grid.y))
        || (grid.layer !== undefined && !bits(grid.layer)) || (grid.friction !== undefined && (!finite(grid.friction) || grid.friction < 0)) || grid.columns * grid.rows > 1 << 24) throw new EgretError('PHYSICS_OPTIONS_INVALID');
      open();
      const ox = grid.x ?? 0, oy = grid.y ?? 0;
      // Runs of solid cells across each row; a run is grown down through the rows below while they have the same run.
      const used = new Uint8Array(grid.columns * grid.rows), made: PhysicsBody[] = [];
      const solid = (c: number, r: number): boolean => grid.solid(c, r) === true;
      for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.columns; c++) {
        if (used[r * grid.columns + c] === 1 || !solid(c, r)) continue;
        let end = c;
        while (end + 1 < grid.columns && used[r * grid.columns + end + 1] === 0 && solid(end + 1, r)) end++;
        let bottom = r;
        grow: while (bottom + 1 < grid.rows) {
          for (let k = c; k <= end; k++) if (used[(bottom + 1) * grid.columns + k] === 1 || !solid(k, bottom + 1)) break grow;
          // The run below must end where this one does, or it would be cut.
          if ((c > 0 && solid(c - 1, bottom + 1) && used[(bottom + 1) * grid.columns + c - 1] === 0) || (end + 1 < grid.columns && solid(end + 1, bottom + 1))) break;
          bottom++;
        }
        for (let rr = r; rr <= bottom; rr++) for (let k = c; k <= end; k++) used[rr * grid.columns + k] = 1;
        const width = (end - c + 1) * grid.tileWidth, height = (bottom - r + 1) * grid.tileHeight;
        made.push(add({ kind: 'static', shape: { kind: 'box', width, height }, x: ox + c * grid.tileWidth + width / 2, y: oy + r * grid.tileHeight + height / 2,
          ...(grid.layer === undefined ? {} : { layer: grid.layer }), ...(grid.friction === undefined ? {} : { friction: grid.friction }) }));
      }
      return Object.freeze(made);
    },
    step(seconds: number): number {
      if (!finite(seconds) || seconds < 0) throw new EgretError('PHYSICS_OPTIONS_INVALID');
      open();
      pending += seconds;
      let taken = 0;
      // A tiny remainder of a float is one step, not a step short.
      while (pending + 1e-9 >= fixedStep && taken < maxSteps) { pending = Math.max(0, pending - fixedStep); once(fixedStep); taken++; steps++; }
      // What could not be caught up is let go, so that the next update is not behind before it starts.
      if (taken === maxSteps) pending = Math.min(pending, fixedStep);
      sync();
      return taken;
    },
    onContact(listener: (contact: PhysicsContact) => void): () => void {
      if (typeof listener !== 'function') throw new EgretError('PHYSICS_OPTIONS_INVALID');
      open();
      listeners.add(listener);
      return (): void => { listeners.delete(listener); };
    },
    queryPoint(x: number, y: number, mask?: number): readonly PhysicsBody[] {
      if (!finite(x) || !finite(y)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
      const m = maskOf(mask);
      return Object.freeze(bodies.filter(body => (body.layer & m) !== 0 && holds(shapeOf(body), x, y)).map(body => body.face));
    },
    queryRect(rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, mask?: number): readonly PhysicsBody[] {
      if (rect === null || typeof rect !== 'object' || !finite(rect.x) || !finite(rect.y) || !finite(rect.width) || !finite(rect.height) || rect.width < 0 || rect.height < 0) throw new EgretError('PHYSICS_OPTIONS_INVALID');
      const m = maskOf(mask), probe = place({ kind: 'box', width: Math.max(rect.width, 1e-9), height: Math.max(rect.height, 1e-9) }, rect.x + rect.width / 2, rect.y + rect.height / 2, 0);
      return Object.freeze(bodies.filter(body => (body.layer & m) !== 0 && meet(probe, shapeOf(body)) !== undefined).map(body => body.face));
    },
    raycast(from: PhysicsVector, to: PhysicsVector, mask?: number): PhysicsRayHit | undefined {
      if (!vector(from) || !vector(to)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
      const m = maskOf(mask), dx = to.x - from.x, dy = to.y - from.y;
      let best: { body: Body; t: number; nx: number; ny: number } | undefined;
      for (const body of bodies) {
        if (body.sensor || (body.layer & m) === 0) continue;
        const hit = cast(shapeOf(body), from.x, from.y, dx, dy);
        if (hit !== undefined && (best === undefined || hit.t < best.t)) best = { body, ...hit };
      }
      return best === undefined ? undefined : Object.freeze({ body: best.body.face, point: Object.freeze({ x: from.x + dx * best.t, y: from.y + dy * best.t }), normal: Object.freeze({ x: best.nx, y: best.ny }), fraction: best.t });
    },
    moveAndSlide(value: PhysicsBody, dx: number, dy: number): PhysicsMoveResult {
      const body = own(value);
      if (!finite(dx) || !finite(dy)) throw new EgretError('PHYSICS_OPTIONS_INVALID');
      open();
      const normals: PhysicsVector[] = [];
      // Across and down apart, each pushed back out of what it entered, so that the body slides along a wall. A long
      // movement is taken in parts no longer than half the body, so that it cannot pass through a thin wall.
      const box = boxFor(body), part = Math.max(1e-6, Math.min(box.maxX - box.minX, box.maxY - box.minY) / 2);
      for (const [mx, my] of [[dx, 0], [0, dy]] as const) {
        const distance = Math.abs(mx + my);
        if (distance === 0) continue;
        const pieces = Math.min(10000, Math.ceil(distance / part));
        let blocked = false;
        for (let piece = 0; piece < pieces && !blocked; piece++) {
          body.x += mx / pieces; body.y += my / pieces; moved(body);
          for (let round = 0; round < 4; round++) {
            let deepest: { nx: number; ny: number; depth: number } | undefined;
            for (const other of bodies) {
              if (other === body || other.sensor || other.kind === 'dynamic' || !meets(body, other) || !boxesMeet(boxFor(body), boxFor(other))) continue;
              const meeting = meet(shapeOf(body), shapeOf(other));
              if (meeting !== undefined && meeting.depth > 1e-9 && (deepest === undefined || meeting.depth > deepest.depth)) deepest = meeting;
            }
            if (deepest === undefined) break;
            body.x -= deepest.nx * deepest.depth; body.y -= deepest.ny * deepest.depth; moved(body);
            normals.push(Object.freeze({ x: 0 - deepest.nx, y: 0 - deepest.ny }));
            // Pushed back against the way it was going: what is left of this way is blocked.
            if (deepest.nx * mx + deepest.ny * my > 0) blocked = true;
          }
        }
      }
      if (body.display !== undefined && !body.display.isDisposed) { body.display.x = body.x; body.display.y = body.y; }
      return Object.freeze({ x: body.x, y: body.y, collided: normals.length > 0, normals: Object.freeze(normals) });
    },
    snapshot(): PhysicsSnapshot { return Object.freeze({ bodies: bodies.length, contacts: touching.size, steps, pending }); },
    dispose(): void {
      if (closed) return;
      closed = true;
      for (const body of bodies) body.removed = true;
      bodies.length = 0; touching.clear(); listeners.clear();
    },
  });
}
