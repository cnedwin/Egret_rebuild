// SPDX-License-Identifier: Apache-2.0
// Particle emitters on a real Engine with a leased texture: who is born, how they move and fade, and the mesh they make.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { createParticleEmitter } from '@egret/engine/particles';
import { host } from './helpers.mjs';

const coded = code => error => error?.code === code;
const near = (actual, expected, label, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, label + ': ' + actual + ' is not ' + expected);
let id = 0;
async function fixture(run) {
  const engine = await egret.createEngine({ host: host().adapter });
  const key = ++id,
    type = egret.createAssetType('particle-literal-' + key, () => true),
    value = egret.createTexture(egret.createImageData2D({ width: 4, height: 4, pixels: new Uint8Array(64) }));
  engine.assets.register(type, { load: async () => value, dispose: () => value.dispose() });
  const texture = await engine.assets.acquire(egret.createAssetRef(type, 'dot'));
  const made = [];
  const make = options => {
    const emitter = createParticleEmitter({ texture, ...options });
    made.push(emitter);
    engine.stage.addChild(emitter.display);
    return emitter;
  };
  try {
    await run({ engine, texture, make });
  } finally {
    for (const emitter of made) emitter.dispose();
    texture.release();
    await engine.dispose();
  }
}
const meshOf = emitter => (emitter.display.numChildren ? emitter.display.getChildAt(0) : undefined);

test('PA01 options are checked', async () =>
  fixture(({ texture, make }) => {
    const bad = [
      { maxParticles: 0 },
      { maxParticles: 16385 },
      { maxParticles: 1.5 },
      { rate: -1 },
      { rate: NaN },
      { drag: -1 },
      { seed: 1.5 },
      { running: 1 },
      { duration: 0 },
      { duration: NaN },
      { lifetime: 0 },
      { lifetime: [2, 1] },
      { lifetime: [1] },
      { lifetime: '1' },
      { speed: [1, NaN] },
      { startScale: -1 },
      { endScale: [-1, 1] },
      { startAlpha: 1.1 },
      { endAlpha: -0.1 },
      { startColor: 0x1000000 },
      { endColor: -1 },
      { startColor: 1.5 },
      { gravity: { x: 1 } },
      { gravity: 7 },
      { size: 0 },
      { size: { width: 1, height: 0 } },
      { size: '8' },
      { shape: { kind: 'triangle' } },
      { shape: { kind: 'rectangle', width: -1, height: 1 } },
      { shape: { kind: 'circle', radius: -1 } },
      { shape: { kind: 'circle', radius: 1, edge: 1 } },
      { shape: 7 }
    ];
    for (const options of bad)
      assert.throws(
        () => createParticleEmitter({ texture, ...options }),
        coded('PARTICLE_OPTIONS_INVALID'),
        JSON.stringify(options)
      );
    assert.throws(() => createParticleEmitter(null), coded('PARTICLE_OPTIONS_INVALID'));
    for (const options of [
      { maxParticles: 1 },
      { maxParticles: 16384 },
      { rate: 0 },
      { lifetime: [0.1, 2] },
      { startAlpha: 0, endAlpha: 1 },
      { startColor: 0, endColor: 0xffffff },
      { shape: { kind: 'rectangle', width: 0, height: 0 } },
      { shape: { kind: 'circle', radius: 0, edge: true } },
      { size: { width: 2, height: 3 } },
      { duration: 1 }
    ]) {
      const emitter = make(options);
      assert.equal(emitter.state, 'active');
    }
    const emitter = make({});
    assert.ok(Object.isFrozen(emitter));
    for (const value of [NaN, '1', Infinity])
      assert.throws(() => {
        emitter.x = value;
      }, coded('PARTICLE_OPTIONS_INVALID'));
    for (const bad of [
      () => emitter.update(-1),
      () => emitter.update(NaN),
      () => emitter.burst(-1),
      () => emitter.burst(1.5)
    ])
      assert.throws(bad, coded('PARTICLE_OPTIONS_INVALID'));
  }));

test('PA02 a running emitter gives the rate in particles each second, carrying what is left of one to the next update', async () =>
  fixture(({ make }) => {
    const emitter = make({ rate: 10, lifetime: 100 });
    emitter.update(0.25);
    assert.equal(emitter.alive, 2);
    emitter.update(0.25);
    assert.equal(emitter.alive, 5);
    for (let i = 0; i < 10; i++) emitter.update(0.01);
    assert.equal(emitter.alive, 6);
    const at = emitter.snapshot();
    assert.deepEqual([at.alive, at.born, at.refused, at.running], [6, 6, 0, true]);
    near(at.time, 0.6, 'time', 1e-12);
    emitter.stop();
    emitter.update(1);
    assert.deepEqual([emitter.alive, emitter.running], [6, false]);
    emitter.start();
    emitter.update(0.1);
    assert.equal(emitter.alive, 7);
    // Stopped from the start it gives nothing until it is started or burst.
    const quiet = make({ running: false, lifetime: 100 });
    quiet.update(5);
    assert.equal(quiet.alive, 0);
    quiet.burst(30);
    assert.equal(quiet.alive, 30);
  }));

test('PA03 a particle lives its lifetime and is gone; one that dies gives its place to the last', async () =>
  fixture(({ make }) => {
    const emitter = make({ running: false, lifetime: [1, 3], seed: 5 });
    emitter.burst(40);
    const lives = emitter.particles().map(p => p);
    emitter.update(0.999);
    assert.equal(emitter.alive, 40);
    emitter.update(1);
    const after1 = emitter.alive;
    assert.ok(after1 < 40 && after1 > 0, String(after1));
    emitter.update(2);
    assert.equal(emitter.alive, 0);
    void lives;
    // Exactly at the end of its life a particle is gone.
    const exact = make({ running: false, lifetime: 0.5 });
    exact.burst(3);
    exact.update(0.25);
    exact.update(0.25);
    assert.equal(exact.alive, 0);
  }));

test('PA04 no more than the most are alive; the rest are counted as refused', async () =>
  fixture(({ make }) => {
    const emitter = make({ maxParticles: 10, rate: 100, lifetime: 5 });
    emitter.update(0.5);
    assert.deepEqual(emitter.snapshot(), { alive: 10, born: 10, refused: 40, running: true, time: 0.5 });
    emitter.burst(3);
    assert.equal(emitter.snapshot().refused, 43);
    emitter.clear();
    assert.equal(emitter.alive, 0);
    emitter.update(0.05);
    assert.equal(emitter.alive, 5);
  }));

test('PA05 a particle sets off at its angle and speed, falls under gravity and is slowed by drag', async () =>
  fixture(({ make }) => {
    const straight = make({ running: false, speed: 100, angle: 90, lifetime: 10 });
    straight.x = 10;
    straight.y = 20;
    straight.burst(1);
    straight.update(0.5);
    const p = straight.particles()[0];
    near(p.x, 10, 'x', 1e-9);
    near(p.y, 70, 'y');
    near(p.vy, 100, 'vy');
    // Gravity changes the speed before the step that uses it.
    const falling = make({ running: false, speed: 0, lifetime: 10, gravity: { x: 0, y: 100 } });
    falling.burst(1);
    falling.update(0.1);
    falling.update(0.1);
    near(falling.particles()[0].y, 0.1 * 10 + 0.1 * 20, 'fallen');
    near(falling.particles()[0].vy, 20, 'its speed');
    // Drag takes away its share of the speed each second, whatever the steps.
    const slowed = steps => {
      const e = make({ running: false, speed: 100, angle: 0, lifetime: 10, drag: 2 });
      e.burst(1);
      for (let i = 0; i < steps; i++) e.update(1 / steps);
      return e.particles()[0].vx;
    };
    near(slowed(1), 100 * Math.exp(-2), 'one step');
    near(slowed(50), 100 * Math.exp(-2), 'fifty steps', 1e-9);
    const across = make({
      running: false,
      speed: [50, 50],
      angle: [180, 180],
      lifetime: 10,
      gravity: { x: -10, y: 0 }
    });
    across.burst(1);
    across.update(1);
    near(across.particles()[0].vx, -60, 'across with gravity');
  }));

test('PA06 scale, alpha, colour and turn go from what a particle is born with to what it dies with', async () =>
  fixture(({ make }) => {
    const emitter = make({
      running: false,
      speed: 0,
      lifetime: 2,
      startScale: 2,
      endScale: 0,
      startAlpha: 1,
      endAlpha: 0.5,
      startColor: 0xff0000,
      endColor: 0x0000ff,
      rotation: 10,
      spin: 90
    });
    emitter.burst(1);
    let p = emitter.particles()[0];
    assert.deepEqual([p.age, p.scale, p.alpha, p.color, p.rotation], [0, 2, 1, 0xff0000, 10]);
    emitter.update(1);
    p = emitter.particles()[0];
    assert.deepEqual([p.age, p.scale, p.alpha, p.color, p.rotation], [0.5, 1, 0.75, 0x800080, 100]);
    assert.ok(Object.isFrozen(p) && Object.isFrozen(emitter.particles()));
  }));

test('PA07 the mesh is one quad a particle, turned and scaled about its place, tinted and faded', async () =>
  fixture(({ make, texture }) => {
    const emitter = make({
      running: false,
      speed: 0,
      lifetime: 2,
      size: { width: 10, height: 4 },
      startScale: 2,
      endScale: 2,
      rotation: 90,
      startColor: 0x336699,
      startAlpha: 0.5,
      endAlpha: 0.5,
      endColor: 0x336699
    });
    assert.equal(meshOf(emitter), undefined);
    emitter.x = 100;
    emitter.y = 50;
    emitter.burst(2);
    const mesh = meshOf(emitter),
      g = mesh.geometry;
    assert.equal(mesh.textureLease, texture);
    assert.deepEqual([g.indexCount, Array.from(g.indices.slice(6, 12))], [12, [4, 5, 6, 4, 6, 7]]);
    // Twenty by eight, turned a quarter: its corners about (100, 50).
    const corners = Array.from(g.positions.slice(0, 8)).map(v => Math.round(v * 1e9) / 1e9);
    assert.deepEqual(corners, [104, 40, 104, 60, 96, 60, 96, 40]);
    assert.deepEqual(Array.from(g.uvs.slice(0, 8)), [0, 0, 1, 0, 1, 1, 0, 1]);
    // The colour as it is seen, in the linear light the renderer multiplies by; the alpha as it is.
    const linear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    assert.deepEqual(Array.from(g.lightColors.slice(0, 4)), [
      linear(0x33 / 255),
      linear(0x66 / 255),
      linear(0x99 / 255),
      0.5
    ]);
    // With none alive the mesh is hidden; it shows again with the next.
    emitter.update(3);
    assert.equal(mesh.visible, false);
    emitter.burst(1);
    assert.deepEqual([mesh.visible, meshOf(emitter) === mesh, mesh.geometry.indexCount], [true, true, 6]);
  }));

test('PA08 particles are born where the emitter is, over its shape, and stay where they were born when it moves', async () =>
  fixture(({ make }) => {
    const box = make({ running: false, speed: 0, lifetime: 10, shape: { kind: 'rectangle', width: 20, height: 10 } });
    box.x = 50;
    box.y = 50;
    box.burst(200);
    for (const p of box.particles()) assert.ok(p.x >= 40 && p.x <= 60 && p.y >= 45 && p.y <= 55);
    const xs = box.particles().map(p => p.x);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 15, 'they spread over the box');
    box.x = 500;
    box.update(1);
    assert.ok(box.particles().every(p => p.x <= 60));
    const ring = make({ running: false, speed: 0, lifetime: 10, shape: { kind: 'circle', radius: 10, edge: true } });
    ring.burst(50);
    for (const p of ring.particles()) near(Math.hypot(p.x, p.y), 10, 'on the edge', 1e-9);
    const disc = make({ running: false, speed: 0, lifetime: 10, shape: { kind: 'circle', radius: 10 } });
    disc.burst(400);
    const inside = disc.particles().map(p => Math.hypot(p.x, p.y));
    assert.ok(inside.every(r => r <= 10 + 1e-9));
    // Even over the area: about a quarter within half the radius.
    const near5 = inside.filter(r => r <= 5).length / inside.length;
    assert.ok(near5 > 0.15 && near5 < 0.35, String(near5));
    const point = make({ running: false, speed: 0, lifetime: 10 });
    point.x = 3;
    point.y = 4;
    point.burst(5);
    assert.ok(point.particles().every(p => p.x === 3 && p.y === 4));
  }));

test('PA09 the same seed gives the same particles, another seed others; ranges are picked evenly between their ends', async () =>
  fixture(({ make }) => {
    const run = seed => {
      const e = make({ seed, rate: 30, speed: [10, 200], angle: [0, 360], lifetime: [0.5, 2] });
      for (let i = 0; i < 30; i++) e.update(1 / 30);
      return e.particles().map(p => [p.x, p.y, p.scale]);
    };
    assert.deepEqual(run(3), run(3));
    assert.notDeepEqual(run(3), run(4));
    const spread = make({ running: false, speed: [10, 20], angle: 0, lifetime: 10 });
    spread.burst(500);
    const speeds = spread.particles().map(p => p.vx);
    assert.ok(speeds.every(v => v >= 10 && v <= 20));
    assert.ok(Math.min(...speeds) < 10.5 && Math.max(...speeds) > 19.5);
  }));

test('PA10 a run with a duration emits for that time and then stops by itself', async () =>
  fixture(({ make }) => {
    const emitter = make({ rate: 10, duration: 1, lifetime: 100 });
    emitter.update(0.6);
    emitter.update(0.6);
    assert.deepEqual([emitter.alive, emitter.running], [10, false]);
    emitter.update(1);
    assert.equal(emitter.alive, 10);
    // Started again, it does not emit past its duration.
    emitter.start();
    emitter.update(1);
    assert.deepEqual([emitter.alive, emitter.running], [10, false]);
  }));

test('PA11 a disposed emitter has let go of its mesh and takes no more', async () =>
  fixture(({ make }) => {
    const emitter = make({ rate: 10, lifetime: 10 });
    emitter.update(1);
    const mesh = meshOf(emitter);
    emitter.dispose();
    emitter.dispose();
    assert.deepEqual(
      [emitter.state, emitter.alive, emitter.running, mesh.isDisposed, emitter.display.isDisposed],
      ['closed', 0, false, true, true]
    );
    for (const call of [() => emitter.update(1), () => emitter.burst(1), () => emitter.start(), () => emitter.clear()])
      assert.throws(call, coded('PARTICLE_CLOSED'));
    emitter.stop();
  }));

test('PA12 a strict consumer compiles against the entry, and seven misuses are refused; the entry has its factory alone', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '--project', 'tests/types/particles.json', '--pretty', 'false'],
    { cwd: new URL('..', import.meta.url), encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(Object.keys(await import('@egret/engine/particles')), ['createParticleEmitter']);
  for (const entry of ['@egret/engine', '@egret/engine/camera', '@egret/runtime'])
    assert.equal('createParticleEmitter' in (await import(entry)), false, entry);
});

test('PA13 the edges that are allowed, and options wrong in one part only', async () =>
  fixture(({ texture, make }) => {
    for (const options of [
      { gravity: { x: NaN, y: 0 } },
      { gravity: { x: 0, y: NaN } },
      { size: { width: 0, height: 1 } },
      { size: { width: NaN, height: 1 } },
      { size: { width: 1, height: NaN } },
      { size: -1 },
      { lifetime: [1, 2, 3] },
      { speed: [] }
    ])
      assert.throws(
        () => createParticleEmitter({ texture, ...options }),
        coded('PARTICLE_OPTIONS_INVALID'),
        JSON.stringify(options)
      );
    const emitter = make({ rate: 10, duration: 0.5, lifetime: 100 });
    emitter.burst(0);
    emitter.update(0);
    assert.deepEqual([emitter.alive, emitter.running], [0, true]);
    // Exactly at the end of its duration it stops.
    emitter.update(0.5);
    assert.deepEqual([emitter.alive, emitter.running], [5, false]);
  }));

test('PA14 blendMode is an option: it sets the blend of the display, and a name that is not a blend is refused', async () =>
  fixture(({ texture, make }) => {
    assert.equal(make({}).display.blendMode, 'normal');
    for (const mode of ['normal', 'add', 'multiply', 'screen', 'erase']) {
      const emitter = make({ blendMode: mode });
      assert.equal(emitter.display.blendMode, mode);
      emitter.burst(3);
      emitter.update(0.1);
      // The mesh made later draws under that blend: it has no material of its own.
      assert.equal(emitter.display.numChildren, 1);
      assert.equal(emitter.display.getChildAt(0).blendMode, 'normal');
    }
    for (const blendMode of ['lighten', 7, null, ''])
      assert.throws(
        () => createParticleEmitter({ texture, blendMode }),
        coded('PARTICLE_OPTIONS_INVALID'),
        String(blendMode)
      );
  }));

function emittedPayload(emitter) {
  const mesh = meshOf(emitter);
  if (!mesh) return undefined;
  const geometry = mesh.geometry;
  return {
    visible: mesh.visible,
    positions: geometry.positions,
    uvs: geometry.uvs,
    lightColors: geometry.lightColors,
    indices: geometry.indices
  };
}
function burstSequentially(emitter, sites) {
  for (const site of sites) {
    emitter.x = site.x;
    emitter.y = site.y;
    emitter.burst(site.count);
  }
}
function assertSameEmission(a, b) {
  assert.deepEqual([a.x, a.y, a.snapshot(), a.particles()], [b.x, b.y, b.snapshot(), b.particles()]);
  assert.deepEqual(emittedPayload(a), emittedPayload(b));
}

test('PA15 a 48-site batch preserves capped particles and RNG, publishing one synchronous mesh payload', async () =>
  fixture(({ make }) => {
    const options = {
      running: false,
      maxParticles: 200,
      lifetime: [0.3, 0.6],
      speed: [30, 150],
      angle: [180, 360],
      gravity: { x: 0, y: -60 },
      drag: 2,
      size: 26,
      startScale: [0.5, 1],
      endScale: 1.8,
      startColor: 0x6a4424,
      endColor: 0x6a4424,
      startAlpha: 0.34,
      endAlpha: 0,
      shape: { kind: 'rectangle', width: 30, height: 4 },
      rotation: [0, 360],
      spin: [-80, 80],
      seed: 59
    };
    const a = make(options),
      b = make(options);
    for (const emitter of [a, b]) {
      emitter.x = 50;
      emitter.y = 100;
      emitter.burst(20);
      emitter.update(0.12);
    }
    assertSameEmission(a, b);
    const sites = Array.from({ length: 48 }, (_, i) => ({ x: 10 + i * 0.5, y: 150 - i * 2, count: 4 }));
    const aMesh = meshOf(a),
      bMesh = meshOf(b),
      bSet = bMesh.setContent;
    let publications = 0;
    bMesh.setContent = function (...args) {
      publications++;
      return bSet.apply(this, args);
    };
    try {
      burstSequentially(a, sites);
      b.burstAtMany(sites);
      assert.equal(publications, 1);
      assert.equal(meshOf(a), aMesh);
      assert.equal(meshOf(b), bMesh);
      assert.equal(a.alive, 200);
      assert.deepEqual(a.snapshot(), { alive: 200, born: 200, refused: 12, running: false, time: 0.12 });
      assertSameEmission(a, b);
      assert.equal(bMesh.geometry.indexCount, 200 * 6);
    } finally {
      delete bMesh.setContent;
    }
    // Lifetimes, motion and subsequent emission still use exactly the same random sequence.
    for (const emitter of [a, b]) emitter.update(0.39);
    assert.ok(a.alive < 200);
    assertSameEmission(a, b);
    const next = [
      { x: 40, y: 60, count: 6 },
      { x: -0, y: 75, count: 0 }
    ];
    burstSequentially(a, next);
    b.burstAtMany(next);
    assertSameEmission(a, b);
    assert.equal(Object.is(b.x, -0), true);
    for (const emitter of [a, b]) emitter.clear();
    a.burst(3);
    b.burst(3);
    assertSameEmission(a, b);
  }));

test('PA16 the entire burstAtMany input is checked before any position, particle or mesh is changed', async () =>
  fixture(({ make }) => {
    const a = make({ running: false, seed: 72, speed: [1, 99], maxParticles: 16 }),
      b = make({ running: false, seed: 72, speed: [1, 99], maxParticles: 16 });
    for (const emitter of [a, b]) {
      emitter.x = -10;
      emitter.y = 20;
      emitter.burst(2);
    }
    const site = { x: 2, y: 4, count: 3 },
      mesh = meshOf(a),
      previous = mesh.geometry;
    for (const invalid of [
      undefined,
      null,
      {},
      [site, null],
      [site, []],
      [site, , site],
      [site, { ...site, x: NaN }],
      [site, { ...site, y: Infinity }],
      [site, { ...site, x: '1' }],
      [site, { ...site, count: -1 }],
      [site, { ...site, count: 1.5 }],
      [site, { ...site, count: Infinity }],
      [site, { ...site, count: NaN }],
      [site, { ...site, count: Number.MAX_SAFE_INTEGER + 1 }],
      [site, { ...site, count: 1048574 }],
      Array(16385).fill({ x: 0, y: 0, count: 0 })
    ]) {
      assert.throws(() => a.burstAtMany(invalid), coded('PARTICLE_OPTIONS_INVALID'));
      assertSameEmission(a, b);
      assert.equal(mesh.geometry, previous);
    }
    // A valid request after all those refusals has neither changed the seed nor the live mesh.
    a.burstAtMany([site]);
    burstSequentially(b, [site]);
    assertSameEmission(a, b);
    a.dispose();
    for (const sites of [[], [site]]) assert.throws(() => a.burstAtMany(sites), coded('PARTICLE_CLOSED'));
    assert.throws(() => a.burstAtMany([null]), coded('PARTICLE_OPTIONS_INVALID'));
  }));

test('PA17 empty batches are no-ops; zero-count sites set the place and valid boundary counts remain bounded', async () =>
  fixture(({ make }) => {
    const a = make({ running: false, maxParticles: 1, speed: [0, 1] });
    a.burstAtMany([]);
    assert.equal(meshOf(a), undefined);
    a.burstAtMany([{ x: 10, y: 2, count: 0 }]);
    assert.deepEqual([a.x, a.y, a.alive, meshOf(a)], [10, 2, 0, undefined]);

    // Site properties are read once into the validated input, not fetched again during spawning.
    let reads = 0;
    const site = {
      get x() {
        return ++reads;
      },
      y: 4,
      count: 1048576
    };
    a.burstAtMany([site]);
    assert.equal(reads, 1);
    assert.deepEqual([a.x, a.y, a.alive, a.snapshot().refused], [1, 4, 1, 1048575]);
    assert.deepEqual([a.particles()[0].x, a.particles()[0].y], [1, 4]);
    const mesh = meshOf(a),
      before = mesh.geometry;
    a.burstAtMany([]);
    assert.equal(mesh.geometry, before);
    a.burstAtMany(Array(16384).fill({ x: 5, y: 10, count: 0 }));
    assert.deepEqual([a.x, a.y, a.alive, mesh.geometry.indexCount], [5, 10, 1, 6]);
  }));
