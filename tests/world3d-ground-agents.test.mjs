// Navigation laid over a height field, agents that face the way they walk, and where a streamed tile is: from the
// notes of Tea Horse Road, whose bandits and wolves chase across ground it had to triangulate by hand.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Object3D,
  createHeightField3D,
  createNavCrowd3D,
  createNavMesh3D,
  createStandardMaterial3D,
  createTerrainStream3D
} from '@egret/engine/world3d';

const code = value => error => error?.code === value;
const close = (actual, expected, epsilon = 1e-3) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

test('GA01 a navigation mesh laid over a height field follows the ground, and leaves out holes and low ground', () => {
  // A slope rising to the east, with a pond (below 0.5) in the north-west corner.
  const field = createHeightField3D({
    columns: 21,
    rows: 21,
    width: 40,
    depth: 40,
    sample: (x, z) => (x < -10 && z < -10 ? 0 : 1 + (x + 20) * 0.05)
  });
  const whole = createNavMesh3D(field, { center: [100, 50] });
  // Two triangles a cell; a face too steep to walk, at the pond's rim, may be left out.
  assert.ok(whole.triangleCount >= 790 && whole.triangleCount <= 800, String(whole.triangleCount));
  const at = whole.findNearest([110, 0, 60], 50);
  close(at.point[1], 1 + 30 * 0.05, 0.01);
  // A region, a coarser cell, a rock and the pond left out.
  const ambush = createNavMesh3D(field, {
    center: [100, 50],
    region: { x: 80, z: 30, width: 40, depth: 40 },
    cellSize: 4,
    holes: [{ x: 110, z: 60, radius: 3 }],
    minHeight: 0.5
  });
  assert.ok(ambush.triangleCount < 10 * 10 * 2 && ambush.triangleCount > 120, String(ambush.triangleCount));
  const rock = ambush.findNearest([110, 2, 60], 0.5);
  assert.equal(rock, undefined, 'nothing within half a unit of the rock centre');
  const path = ambush.findPath([118, 2, 32], [118, 2, 68]);
  assert.ok(path && path.points.length >= 2);
  for (const bad of [
    { cellSize: 0 },
    { center: [Number.NaN, 0] },
    { region: { x: 0, z: 0, width: -1, depth: 1 } },
    { holes: [{ x: 0, z: 0, radius: 0 }] }
  ])
    assert.throws(() => createNavMesh3D(field, bad), code('WORLD3D_INPUT_INVALID'), JSON.stringify(bad));
  assert.throws(() => createNavMesh3D(field, { minHeight: 100 }), code('WORLD3D_INPUT_INVALID'));
});

test('GA02 an agent with turnSpeed turns its node toward the way it walks, no faster than it may; without it the node is not turned', () => {
  const field = createHeightField3D({ columns: 11, rows: 11, width: 40, depth: 40, sample: () => 0 });
  const crowd = createNavCrowd3D(createNavMesh3D(field));
  const wolf = new Object3D(),
    post = new Object3D();
  const runner = crowd.addAgent({ position: [0, 0, 0], node: wolf, turnSpeed: Math.PI, speed: 4 });
  const plain = crowd.addAgent({ position: [5, 0, 5], node: post });
  runner.setTarget([15, 0, 0]);
  plain.setTarget([15, 0, 5]);
  crowd.update(0.1);
  // Facing -Z at first, it wants +X, a quarter turn the negative way; it turns at most a tenth of pi in 0.1 s.
  assert.ok(runner.heading < 0 && runner.heading >= -Math.PI * 0.1 - 1e-6, String(runner.heading));
  for (let i = 0; i < 20; i++) crowd.update(0.1);
  close(runner.heading, -Math.PI / 2, 0.05);
  close(wolf.quaternion[1], Math.sin(-Math.PI / 4), 0.03);
  assert.deepEqual([...post.quaternion], [0, 0, 0, 1]);
  assert.throws(() => crowd.addAgent({ position: [0, 0, 0], turnSpeed: 0 }), code('WORLD3D_INPUT_INVALID'));
  const instant = crowd.addAgent({ position: [-5, 0, -5], node: new Object3D(), turnSpeed: Infinity });
  instant.setTarget([-5, 0, 10]);
  crowd.update(0.1);
  close(Math.abs(instant.heading), Math.PI, 0.05);
});

test('GA03 a streamed tile says where its centre is, and the stream how far the viewer is from it', () => {
  const tiles = [];
  const stream = createTerrainStream3D({
    tileSize: 100,
    viewDistance: 120,
    material: createStandardMaterial3D({}),
    loadsPerUpdate: 9,
    terrain: { chunkCells: 4, levels: 2 },
    load: () => createHeightField3D({ columns: 5, rows: 5, width: 100, depth: 100, sample: x => x * 0.01 }),
    onLoad: tile => tiles.push(tile)
  });
  const first = tiles[0];
  assert.equal(first, undefined);
  stream.update(150, 50);
  const own = stream.tiles.find(tile => tile.x === 1 && tile.z === 0);
  assert.deepEqual(own.center, [150, 50]);
  assert.equal(stream.distanceOf(own), 0);
  // The field is centred on the tile: a world point is read less the centre.
  close(own.field.heightAt(170 - own.center[0], 50 - own.center[1]), 0.2);
  const west = stream.tiles.find(tile => tile.x === 0 && tile.z === 0);
  close(stream.distanceOf(west), 50);
  stream.update(150, 50);
  stream.dispose();
});
