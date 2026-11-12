// SPDX-License-Identifier: Apache-2.0
// Navigation meshes, paths, movement along the mesh, crowds and grid paths
// of the World3D core. No GPU or physics world is involved.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NavMesh3D, Object3D, World3DError, createBoxGeometry3D, createNavCrowd3D, createNavMesh3D, createPlaneGeometry3D, findGridPath3D, Mesh3D,
} from '@egret/engine/world3d';

const code = value => error => error instanceof World3DError && error.code === value;
const close = (actual, expected, epsilon = 1e-3) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
/** A floor of unit squares; `blocked` leaves holes and `height` lifts corners. */
function floor(size, blocked = () => false, height = () => 0) {
  const positions = [], indices = [];
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    if (blocked(x, z)) continue;
    const base = positions.length / 3;
    positions.push(x, height(x, z), z, x + 1, height(x + 1, z), z, x + 1, height(x + 1, z + 1), z + 1, x, height(x, z + 1), z + 1);
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  return {positions, indices};
}
// A 20 by 20 floor split by a wall along x = 10 that leaves a gap for z from 15 to 20.
const walled = () => createNavMesh3D(floor(20, (x, z) => x === 10 && z < 15));

test('paths cross a navigation mesh by the shortest walkable way', () => {
  const mesh = walled();
  assert.deepEqual([mesh.triangleCount, new Set(mesh.regions).size], [770, 1]);
  const straight = mesh.findPath([2.5, 0, 2.5], [8.5, 0, 7.5]);
  assert.deepEqual(straight.points, [[2.5, 0, 2.5], [8.5, 0, 7.5]]);
  close(straight.length, Math.hypot(6, 5));
  // Around the wall: through the two corners of the gap and nothing else.
  const around = mesh.findPath([2.5, 0, 2.5], [17.5, 0, 2.5]);
  assert.equal(around.complete, true);
  assert.deepEqual(around.points, [[2.5, 0, 2.5], [10, 0, 15], [11, 0, 15], [17.5, 0, 2.5]]);
  close(around.length, Math.hypot(7.5, 12.5) + 1 + Math.hypot(6.5, 12.5));
  // An agent with a radius keeps that far from the wall's corners.
  const wide = mesh.findPath([2.5, 0, 2.5], [17.5, 0, 2.5], {agentRadius: 0.4});
  for (const point of wide.points) assert.ok(!(point[0] > 9.99 && point[0] < 11.01 && point[2] < 15.39), `corner ${point} keeps its distance`);
  assert.ok(wide.length > around.length && wide.length < around.length + 2);
  // A gap narrower than the agent is no way through.
  assert.equal(createNavMesh3D(floor(20, (x, z) => x === 10 && z !== 15)).findPath([2.5, 0, 2.5], [17.5, 0, 2.5], {agentRadius: 0.6}).complete, false);
  // Closing the gap leaves the far side out of reach; the path then ends at the nearest reachable place.
  const here = mesh.findNearest([2.5, 0, 2.5]), there = mesh.findNearest([17.5, 0, 2.5]);
  assert.equal(mesh.isReachable(here, there), true);
  for (let t = 0; t < mesh.triangleCount; t++) { const c = mesh.center(t); if (c[0] > 10 && c[0] < 11) mesh.setEnabled(t, false); }
  const stopped = mesh.findPath([2.5, 0, 2.5], [17.5, 0, 2.5]);
  assert.equal(stopped.complete, false);
  assert.deepEqual(stopped.points[stopped.points.length - 1], [10, 0, 2.5]);
  assert.equal(mesh.isReachable(here, there), false);
  // Costly ground is walked around when the detour is cheaper.
  const muddy = createNavMesh3D(floor(9));
  const direct = muddy.findPath([0.5, 0, 4.5], [8.5, 0, 4.5]).length;
  for (let t = 0; t < muddy.triangleCount; t++) { const c = muddy.center(t); if (c[0] > 3 && c[0] < 6 && c[2] > 1 && c[2] < 8) muddy.setCost(t, 20); }
  assert.ok(muddy.findPath([0.5, 0, 4.5], [8.5, 0, 4.5]).length > direct + 1);
  assert.equal(mesh.findPath([200, 0, 200], [1, 0, 1]), undefined);                 // too far from the mesh to snap
});

test('navigation mesh search does not overestimate a cheap corridor', () => {
  const mesh = createNavMesh3D(floor(9));
  for (let triangle = 0; triangle < mesh.triangleCount; triangle++) {
    if (mesh.center(triangle)[2] >= 1) mesh.setCost(triangle, 0.05);
  }
  const route = mesh.findPath([0.4, 0, 0.3], [8.6, 0, 0.3]);
  assert.equal(route.complete, true);
  assert.ok(route.points.some(point => point[2] >= 1), 'the route uses the cheap corridor');
});

test('navigation meshes follow slopes, keep levels apart and come from scene objects', () => {
  // Flat for x below 5, then rising half a unit per unit.
  const hill = createNavMesh3D(floor(10, () => false, x => x < 5 ? 0 : (x - 5) * 0.5));
  const plain = hill.findPath([1, 0, 5.3], [9, 2, 5.7]), detailed = hill.findPath([1, 0, 5.3], [9, 2, 5.7], {followSurface: true});
  assert.equal(plain.points.length, 2);
  assert.ok(detailed.points.length > 10);
  for (const point of detailed.points) close(point[1], Math.max(point[0] - 5, 0) * 0.5, 1e-4);   // every point lies on the ground
  assert.throws(() => createNavMesh3D(floor(4, () => false, x => x * 3)), code('WORLD3D_INPUT_INVALID'));   // too steep to walk anywhere
  assert.equal(createNavMesh3D(floor(4, () => false, x => x * 3), {slopeLimit: 1.4}).triangleCount, 32);
  // A bridge three units above a floor: two separate regions, and the nearest place respects height.
  const low = floor(6), high = floor(6, (x, z) => z !== 2, () => 3);
  const levels = createNavMesh3D({positions: [...low.positions, ...high.positions], indices: [...low.indices, ...high.indices.map(i => i + low.positions.length / 3)]});
  assert.equal(new Set(levels.regions).size, 2);
  assert.deepEqual([levels.findNearest([3, 0.2, 2.5]).point[1], levels.findNearest([3, 2.9, 2.5]).point[1]], [0, 3]);
  assert.equal(levels.findNearest([3, 1.5, 2.5], 0.5), undefined);
  // Built from scene objects: the floor counts, walls and undersides do not; transforms are applied.
  const root = new Object3D(), ground = new Mesh3D(createPlaneGeometry3D({width: 10, height: 10, widthSegments: 4, heightSegments: 4}));
  ground.setRotation(-Math.PI / 2, 0, 0).setPosition(5, 1, 5);
  const crate = new Mesh3D(createBoxGeometry3D({width: 2, height: 2, depth: 2})); crate.setPosition(5, 2, 5);
  root.addChild(ground); root.addChild(crate);
  const built = createNavMesh3D(root);
  assert.equal(built.triangleCount, 32 + 2);                                          // the floor and the crate's top
  close(built.findNearest([1, 1.2, 1]).point[1], 1);
  assert.equal(built.createDebugGeometry().topology, 'lines');
  assert.throws(() => createNavMesh3D(undefined), code('WORLD3D_INPUT_INVALID'));
  assert.ok(built instanceof NavMesh3D);
});

test('movement and sight lines stop at the edge of the mesh', () => {
  const mesh = walled(), start = mesh.findNearest([2.5, 0, 2.5]);
  assert.equal(mesh.raycast(start, 8.5, 7.5), 1);
  close(mesh.raycast(start, 17.5, 2.5), 0.5);                                          // the wall is halfway
  const crossings = [];
  mesh.raycast(start, 8.5, 2.5, crossings);
  assert.ok(crossings.length >= 6 && crossings.every(point => point[2] === 2.5));
  const free = mesh.moveAlong(start, 4, 3);
  assert.deepEqual([free.point, free.blocked], [[4, 0, 3], false]);
  const into = mesh.moveAlong(start, 17.5, 2.5);
  assert.equal(into.blocked, true); close(into.point[0], 10, 1e-3); close(into.point[2], 2.5, 1e-3);
  // Pushing at an angle slides along the wall for the whole sideways part of the move.
  const slide = mesh.moveAlong(start, 17.5, 6.5);
  close(slide.point[0], 10, 1e-3); close(slide.point[2], 6.5, 1e-3);
  const out = mesh.moveAlong(start, -5, 2.5);
  close(out.point[0], 0, 1e-3);
  // Random places fall on the mesh, and are repeatable with a seeded source.
  let seed = 3;
  const random = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
  for (let i = 0; i < 50; i++) { const place = mesh.randomPoint(random); assert.ok(!(place.point[0] > 10 && place.point[0] < 11 && place.point[2] < 15)); assert.ok(place.point[0] >= 0 && place.point[0] <= 20); }
});

test('a crowd walks around obstacles and keeps its members apart', () => {
  const crowd = createNavCrowd3D(walled()), agents = [];
  for (let i = 0; i < 30; i++) {
    const node = new Object3D(), agent = crowd.addAgent({position: [1 + (i % 5), 0, 1 + Math.floor(i / 5)], node});
    agent.setTarget([18, 0, 3]);
    agents.push(agent);
  }
  assert.equal(agents[0].arrived, false);
  let closest = Infinity;
  for (let step = 0; step < 1800; step++) {
    crowd.update(1 / 60);
    for (const agent of agents) assert.ok(!(agent.position[0] > 10.001 && agent.position[0] < 10.999 && agent.position[2] < 14.999), 'nobody walks through the wall');
    if (step % 10 === 0) for (let i = 0; i < 30; i++) for (let j = i + 1; j < 30; j++) closest = Math.min(closest, Math.hypot(agents[i].position[0] - agents[j].position[0], agents[i].position[2] - agents[j].position[2]));
  }
  assert.ok(agents.every(agent => Math.hypot(agent.position[0] - 18, agent.position[2] - 3) < 5), 'everyone gathered near the target');
  assert.ok(agents.every(agent => agent.arrived), 'and stopped trying once the spot was crowded');
  assert.ok(closest > 0.35, `members keep apart (closest ${closest})`);
  assert.deepEqual([...agents[3].node.position].map(value => +value.toFixed(3)), agents[3].position.map(value => +value.toFixed(3)));
  // An unreachable target is reported, and stopping clears the path.
  const lone = createNavCrowd3D(createNavMesh3D(floor(20, (x) => x === 10))), walker = lone.addAgent({position: [2, 0, 2]});
  walker.setTarget([15, 0, 2]);
  lone.update(1 / 60);
  assert.equal(walker.reachable, false);
  walker.stop();
  assert.deepEqual([walker.arrived, walker.path.length], [true, 0]);
  lone.removeAgent(walker);
  assert.equal(lone.agents.length, 0);
  assert.throws(() => lone.addAgent({position: [500, 0, 500]}), code('WORLD3D_INPUT_INVALID'));
});

test('navigation mesh construction bounds aggregate cell references', () => {
  const positions = [0, 0, 0, 0, 0, 100, 100, 0, 0];
  const triangles = 4800;
  const indices = Uint32Array.from({length: triangles * 3}, (_, index) => index % 3);
  assert.throws(() => createNavMesh3D({positions, indices}), code('WORLD3D_BUDGET'));
});

test('grid paths prefer a fractional-cost detour to a shorter route', () => {
  const path = findGridPath3D(5, 2, (_x, y) => y === 0 ? 1 : 0.1, [0, 0], [4, 0], {diagonal: false});
  assert.deepEqual(path, [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [4, 0]]);
});

test('grid paths avoid blocked cells and prefer cheap ground', () => {
  const rows = ['..........', '.########.', '.#......#.', '.#.####.#.', '...#..#...', '.###..###.', '..........'];
  const open = (x, y) => rows[y][x] === '#' ? 0 : 1;
  const path = findGridPath3D(10, 7, open, [0, 0], [4, 4]);
  assert.deepEqual([path[0], path[path.length - 1]], [[0, 0], [4, 4]]);
  for (let i = 1; i < path.length; i++) { assert.ok(open(...path[i]) > 0); assert.ok(Math.max(Math.abs(path[i][0] - path[i - 1][0]), Math.abs(path[i][1] - path[i - 1][1])) === 1); }
  assert.equal(findGridPath3D(3, 3, x => x === 1 ? 0 : 1, [0, 0], [2, 2]), undefined);
  // Diagonals shorten an open crossing, and never cut between two blocked cells.
  assert.equal(findGridPath3D(5, 5, () => 1, [0, 0], [4, 4]).length, 5);
  assert.equal(findGridPath3D(5, 5, () => 1, [0, 0], [4, 4], {diagonal: false}).length, 9);
  assert.equal(findGridPath3D(2, 2, (x, y) => x === y ? 1 : 0, [0, 0], [1, 1]), undefined);
  // A costly strip is walked around.
  const muddy = (x, y) => x === 2 && y > 0 ? 9 : 1;
  assert.ok(findGridPath3D(5, 5, muddy, [0, 2], [4, 2]).some(cell => cell[0] === 2 && cell[1] === 0));
  assert.throws(() => findGridPath3D(0, 5, () => 1, [0, 0], [0, 0]), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => findGridPath3D(5, 5, () => 1, [0, 0], [9, 9]), code('WORLD3D_INPUT_INVALID'));
});
