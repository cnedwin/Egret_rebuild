// SPDX-License-Identifier: Apache-2.0
import { DisplayObjectContainer, EgretError, Mesh2D } from '@egret/runtime';
import { createTexturedGeometry2D } from '@egret/contracts';
import type { ParticleEmitter, ParticleEmitterOptions, ParticleRange, ParticleShape, ParticleSnapshot, ParticleView } from './particleTypes.js';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
type Pair = readonly [number, number];
function range(value: unknown, otherwise: Pair, least = -Infinity): Pair {
  if (value === undefined) return otherwise;
  const pair = typeof value === 'number' ? [value, value] as const : Array.isArray(value) && value.length === 2 ? [value[0], value[1]] as const : undefined;
  if (pair === undefined || !finite(pair[0]) || !finite(pair[1]) || pair[0] > pair[1] || pair[0] < least) throw new EgretError('PARTICLE_OPTIONS_INVALID');
  return pair as Pair;
}
const colour = (value: unknown, otherwise: number): number => {
  if (value === undefined) return otherwise;
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 0xffffff) throw new EgretError('PARTICLE_OPTIONS_INVALID');
  return value as number;
};
const unit = (value: unknown, otherwise: number): number => {
  if (value === undefined) return otherwise;
  if (!finite(value) || value < 0 || value > 1) throw new EgretError('PARTICLE_OPTIONS_INVALID');
  return value;
};
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const channel = (rgb: number, shift: number): number => ((rgb >> shift) & 255) / 255;

/** A stream of particles over one texture, drawn as one mesh that is built again each update. */
export function createParticleEmitter(options: ParticleEmitterOptions): ParticleEmitter {
  if (!record(options)) throw new EgretError('PARTICLE_OPTIONS_INVALID');
  const o = options;
  const maxParticles = o.maxParticles ?? 512, rate = o.rate ?? 50, drag = o.drag ?? 0, seed0 = o.seed ?? 1, running0 = o.running ?? true, duration = o.duration;
  if (!Number.isSafeInteger(maxParticles) || maxParticles < 1 || maxParticles > 16384 || !finite(rate) || rate < 0 || !finite(drag) || drag < 0 || !Number.isSafeInteger(seed0)
    || typeof running0 !== 'boolean' || (duration !== undefined && (!finite(duration) || duration <= 0))) throw new EgretError('PARTICLE_OPTIONS_INVALID');
  const lifetime = range(o.lifetime, [1, 1], Number.MIN_VALUE), speed = range(o.speed, [100, 100]), angle = range(o.angle, [0, 360]);
  const startScale = range(o.startScale, [1, 1], 0), endScale = range(o.endScale, [1, 1], 0), rotation0 = range(o.rotation, [0, 0]), spin = range(o.spin, [0, 0]);
  const startAlpha = unit(o.startAlpha, 1), endAlpha = unit(o.endAlpha, 0), startColor = colour(o.startColor, 0xffffff), endColor = colour(o.endColor, 0xffffff);
  const gravity = o.gravity ?? { x: 0, y: 0 };
  if (!record(gravity) || !finite(gravity.x) || !finite(gravity.y)) throw new EgretError('PARTICLE_OPTIONS_INVALID');
  const size = o.size ?? 8, width = typeof size === 'number' ? size : record(size) ? size.width : NaN, height = typeof size === 'number' ? size : record(size) ? size.height : NaN;
  if (!finite(width) || !finite(height) || width <= 0 || height <= 0) throw new EgretError('PARTICLE_OPTIONS_INVALID');
  const shape: ParticleShape = o.shape ?? { kind: 'point' };
  if (!record(shape) || !(shape.kind === 'point' || (shape.kind === 'rectangle' && finite(shape.width) && finite(shape.height) && shape.width >= 0 && shape.height >= 0)
    || (shape.kind === 'circle' && finite(shape.radius) && shape.radius >= 0 && (shape.edge === undefined || typeof shape.edge === 'boolean')))) throw new EgretError('PARTICLE_OPTIONS_INVALID');
  const lease = o.texture;

  // A particle is a row of these columns: place, speed, age, life, and what it was born with.
  const STRIDE = 12, X = 0, Y = 1, VX = 2, VY = 3, AGE = 4, LIFE = 5, S0 = 6, S1 = 7, R0 = 8, SPIN = 9;
  const data = new Float64Array(maxParticles * STRIDE);
  let alive = 0, born = 0, refused = 0, time = 0, debt = 0, running = running0, closed = false, x = 0, y = 0;
  let state = seed0 | 0 || 1;
  /** A seeded generator: the same seed, the same particles. */
  const random = (): number => { state = (state + 0x6d2b79f5) | 0; let t = Math.imul(state ^ (state >>> 15), 1 | state); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (pair: Pair): number => pair[0] === pair[1] ? pair[0] : mix(pair[0], pair[1], random());

  const display = new DisplayObjectContainer();
  let mesh: Mesh2D | undefined;
  function spawn(count: number): void {
    for (let n = 0; n < count; n++) {
      if (alive >= maxParticles) { refused++; continue; }
      let px = x, py = y;
      if (shape.kind === 'rectangle') { px += (random() - 0.5) * shape.width; py += (random() - 0.5) * shape.height; }
      else if (shape.kind === 'circle') {
        // Even over the area of the circle, or on its edge alone.
        const a = random() * Math.PI * 2, r = shape.edge === true ? shape.radius : shape.radius * Math.sqrt(random());
        px += Math.cos(a) * r; py += Math.sin(a) * r;
      }
      const direction = pick(angle) * Math.PI / 180, v = pick(speed), at = alive * STRIDE;
      data[at + X] = px; data[at + Y] = py; data[at + VX] = Math.cos(direction) * v; data[at + VY] = Math.sin(direction) * v;
      data[at + AGE] = 0; data[at + LIFE] = pick(lifetime); data[at + S0] = pick(startScale); data[at + S1] = pick(endScale); data[at + R0] = pick(rotation0); data[at + SPIN] = pick(spin);
      alive++; born++;
    }
  }
  function view(at: number): ParticleView {
    const t = Math.min(1, data[at + AGE]! / data[at + LIFE]!);
    const r = mix(channel(startColor, 16), channel(endColor, 16), t), g = mix(channel(startColor, 8), channel(endColor, 8), t), b = mix(channel(startColor, 0), channel(endColor, 0), t);
    return Object.freeze({ x: data[at + X]!, y: data[at + Y]!, vx: data[at + VX]!, vy: data[at + VY]!, age: t, scale: mix(data[at + S0]!, data[at + S1]!, t), alpha: mix(startAlpha, endAlpha, t),
      color: (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255), rotation: data[at + R0]! + data[at + SPIN]! * data[at + AGE]! });
  }
  /** The mesh is built again from the particles alive; with none it is hidden and keeps what it had. */
  function draw(): void {
    if (alive === 0) { if (mesh !== undefined) mesh.visible = false; return; }
    const positions = new Float64Array(alive * 8), uvs = new Float64Array(alive * 8), lightColors = new Float64Array(alive * 16), indices = new Uint32Array(alive * 6);
    for (let i = 0; i < alive; i++) {
      const p = view(i * STRIDE), hw = width * p.scale / 2, hh = height * p.scale / 2, a = p.rotation * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
      const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
      corners.forEach(([cx, cy], k) => { positions[i * 8 + k * 2] = p.x + cx! * cos - cy! * sin; positions[i * 8 + k * 2 + 1] = p.y + cx! * sin + cy! * cos; });
      uvs.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
      const r = ((p.color >> 16) & 255) / 255, g = ((p.color >> 8) & 255) / 255, b = (p.color & 255) / 255;
      for (let k = 0; k < 4; k++) lightColors.set([r, g, b, p.alpha], i * 16 + k * 4);
      indices.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    const geometry = createTexturedGeometry2D({ positions, uvs, lightColors, indices });
    if (mesh === undefined) { mesh = new Mesh2D(lease, geometry); display.addChild(mesh); }
    else { mesh.setContent(lease, geometry); mesh.visible = true; }
  }
  const open = (): void => { if (closed) throw new EgretError('PARTICLE_CLOSED'); };
  function place(value: unknown): number { if (!finite(value)) throw new EgretError('PARTICLE_OPTIONS_INVALID'); return value; }

  return Object.freeze({
    get state(): 'active' | 'closed' { return closed ? 'closed' : 'active'; },
    display,
    get x(): number { return x; }, set x(value: number) { x = place(value); },
    get y(): number { return y; }, set y(value: number) { y = place(value); },
    get running(): boolean { return running; },
    get alive(): number { return alive; },
    start(): void { open(); running = true; },
    stop(): void { running = false; },
    burst(count: number): void {
      if (!Number.isSafeInteger(count) || count < 0) throw new EgretError('PARTICLE_OPTIONS_INVALID');
      open(); spawn(count); draw();
    },
    clear(): void { open(); alive = 0; debt = 0; draw(); },
    update(seconds: number): void {
      if (!finite(seconds) || seconds < 0) throw new EgretError('PARTICLE_OPTIONS_INVALID');
      open();
      const damp = Math.exp(-drag * seconds);
      // Age and move what is alive; a particle that dies takes the place of the last one.
      for (let i = 0; i < alive;) {
        const at = i * STRIDE;
        data[at + AGE]! += seconds;
        if (data[at + AGE]! >= data[at + LIFE]!) { alive--; data.copyWithin(at, alive * STRIDE, alive * STRIDE + STRIDE); continue; }
        data[at + VX] = (data[at + VX]! + gravity.x * seconds) * damp; data[at + VY] = (data[at + VY]! + gravity.y * seconds) * damp;
        data[at + X]! += data[at + VX]! * seconds; data[at + Y]! += data[at + VY]! * seconds;
        i++;
      }
      if (running) {
        // The time left of a run that has a duration is all that is emitted for.
        const span = duration === undefined ? seconds : Math.max(0, Math.min(seconds, duration - time));
        debt += rate * span;
        // A sum of steps that should reach a whole particle may fall short of it by the last bit of a float.
        const count = Math.floor(debt + 1e-9);
        debt = Math.max(0, debt - count);
        spawn(count);
        if (duration !== undefined && time + seconds >= duration) running = false;
      }
      time += seconds;
      draw();
    },
    particles(): readonly ParticleView[] { return Object.freeze(Array.from({ length: alive }, (_, i) => view(i * STRIDE))); },
    snapshot(): ParticleSnapshot { return Object.freeze({ alive, born, refused, running, time }); },
    dispose(): void {
      if (closed) return;
      closed = true; running = false; alive = 0;
      const failures: unknown[] = [];
      try { mesh?.dispose(); } catch (cause) { failures.push(cause); }
      try { display.dispose(); } catch (cause) { failures.push(cause); }
      mesh = undefined;
      if (failures.length > 0) throw new EgretError('PARTICLE_CLEANUP_FAILED', { cause: failures[0], cleanupErrors: failures.slice(1) });
    },
  });
}
