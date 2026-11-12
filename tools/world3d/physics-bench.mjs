// SPDX-License-Identifier: Apache-2.0
// Fixed physics workloads for World3D, run in Node against the built public entry.
// Usage: node tools/world3d/physics-bench.mjs [--json]
// Each scene reports the mean time of one step and a measure of how well it held together.
// The figures describe this machine and this run; they are not acceptance thresholds.
import { performance } from 'node:perf_hooks';
import { createPhysicsWorld3D } from '@egret/engine/world3d';

const box = half => ({type: 'box', halfExtents: [half, half, half]});
const scenes = {
  // A brick wall ten rows high: rows of 25 and 24 boxes alternate, each brick resting on two.
  wall(options) {
    const world = createPhysicsWorld3D(options); world.createBody({type: 'static', shape: {type: 'plane'}});
    const bodies = [];
    for (let row = 0; row < 10; row++) for (let i = 0; i < 25 - (row % 2); i++) bodies.push(world.createBody({mass: 1, shape: box(0.5), position: [i + (row % 2) * 0.5 - 12, 0.5 + row, 0]}));
    const start = bodies.map(body => [...body.position]);
    return {world, steps: 600, measure: () => Math.max(...bodies.map((body, i) => Math.hypot(body.position[0] - start[i][0], body.position[1] - start[i][1], body.position[2] - start[i][2]))), unit: 'largest drift (m)'};
  },
  // A pyramid fifteen boxes wide at its base: 120 boxes.
  pyramid(options) {
    const world = createPhysicsWorld3D(options); world.createBody({type: 'static', shape: {type: 'plane'}});
    const bodies = [];
    for (let row = 0; row < 15; row++) for (let i = 0; i < 15 - row; i++) bodies.push(world.createBody({mass: 1, shape: box(0.5), position: [i + row * 0.5 - 7, 0.5 + row, 0]}));
    const start = bodies.map(body => [...body.position]);
    return {world, steps: 600, measure: () => Math.max(...bodies.map((body, i) => Math.hypot(body.position[0] - start[i][0], body.position[1] - start[i][1], body.position[2] - start[i][2]))), unit: 'largest drift (m)'};
  },
  // A single tower ten boxes high.
  tower(options) {
    const world = createPhysicsWorld3D(options); world.createBody({type: 'static', shape: {type: 'plane'}});
    const bodies = [];
    for (let i = 0; i < 10; i++) bodies.push(world.createBody({mass: 1, shape: box(0.5), position: [0, 0.5 + i, 0]}));
    return {world, steps: 600, measure: () => Math.max(...bodies.map((body, i) => Math.hypot(body.position[0], body.position[2]) + Math.abs(body.position[1] - 0.5 - i))), unit: 'largest drift (m)'};
  },
  // Thirty links hanging from the world with a load a hundred times a link's weight.
  chain(options) {
    const world = createPhysicsWorld3D({...options, allowSleep: false});
    let previous, last;
    for (let i = 0; i < 30; i++) {
      const heavy = i === 29;
      last = world.createBody({mass: heavy ? 100 : 1, shape: {type: 'sphere', radius: heavy ? 0.5 : 0.1}, position: [0, -0.5 - i * 0.5, 0], linearDamping: 0.05});
      world.createJoint({type: 'point', bodyA: last, ...(previous ? {bodyB: previous} : {}), anchor: [0, -i * 0.5, 0]});
      previous = last;
    }
    return {world, steps: 600, measure: () => Math.abs(-last.position[1] - 15), unit: 'stretch (m)'};
  },
  // Two thousand static blocks as a level, and two hundred balls dropped over it.
  level(options) {
    const world = createPhysicsWorld3D(options);
    for (let x = 0; x < 50; x++) for (let z = 0; z < 40; z++) world.createBody({type: 'static', shape: {type: 'box', halfExtents: [0.5, 0.5 + ((x * 7 + z * 13) % 5) * 0.1, 0.5]}, position: [x - 25, 0, z - 20]});
    const balls = [];
    for (let i = 0; i < 200; i++) balls.push(world.createBody({mass: 1, shape: {type: 'sphere', radius: 0.3}, position: [(i % 20) * 2 - 19, 3 + (i % 7) * 0.5, Math.floor(i / 20) * 3.5 - 16]}));
    return {world, steps: 300, measure: () => balls.filter(ball => ball.position[1] < 0).length, unit: 'balls fallen through'};
  },
};
const variants = [['one solve per step', {}], ['four sub-steps', {solverSteps: 4, iterations: 2}]];
const results = [];
for (const [name, build] of Object.entries(scenes)) {
  for (const [label, options] of variants) {
    const scene = build(options), from = performance.now();
    for (let i = 0; i < scene.steps; i++) scene.world.step(1 / 60);
    const elapsed = performance.now() - from;
    results.push({scene: name, solver: label, bodies: scene.world.bodies.length, msPerStep: Math.round(elapsed / scene.steps * 1000) / 1000, held: Math.round(scene.measure() * 1000) / 1000, unit: scene.unit, asleep: scene.world.bodies.filter(body => body.isSleeping).length});
  }
  // Queries against the same scene: rays and sweeps across the whole level.
  if (name === 'level') {
    const scene = build({}); scene.world.step(1 / 60);
    let from = performance.now(), hits = 0;
    for (let i = 0; i < 2000; i++) if (scene.world.raycast([-30, 1.2, (i % 40) - 20 + 0.3], [1, 0, 0.1], 80)) hits++;
    const rays = (performance.now() - from) / 2000;
    from = performance.now();
    for (let i = 0; i < 400; i++) if (scene.world.shapeCast({type: 'sphere', radius: 0.4}, [(i % 50) - 25, 6, Math.floor(i / 10) - 20], [0, -1, 0], 8)) hits++;
    results.push({scene: 'level queries', solver: '-', bodies: scene.world.bodies.length, msPerRay: Math.round(rays * 10000) / 10000, msPerSweep: Math.round((performance.now() - from) / 400 * 10000) / 10000, hits});
  }
}
if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
else for (const row of results) console.log(Object.entries(row).map(([key, value]) => key + '=' + value).join('  '));
