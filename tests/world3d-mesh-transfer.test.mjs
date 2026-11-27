// SPDX-License-Identifier: Apache-2.0
// A triangle mesh shape built in one place and adopted in another: `exportBuffers` gives the shape's arrays, its
// hierarchy included, and `TriangleMeshShape3D.fromBuffers` takes them as they are, after checking them. Here the
// arrays are moved as a worker moves them (structuredClone with transfer), and the adopted shape must answer every
// query and every ray exactly as the shape that built them.
import assert from 'node:assert/strict';
import test from 'node:test';
import { TriangleMeshShape3D, createHeightField3D, createPhysicsWorld3D } from '@egret/engine/world3d';

/** A rolling 192 m terrain tile of 96 × 96 cells: 18 432 triangles. */
function terrain() {
  const grid = 97;
  const heights = Float32Array.from({ length: grid * grid }, (_, i) => {
    const x = i % grid,
      z = Math.floor(i / grid);
    return Math.sin(x / 14) * 4 + Math.cos(z / 12) * 3 + (x + z) / 8;
  });
  return createHeightField3D({ columns: grid, rows: grid, width: 192, depth: 192, heights }).createShape();
}

const queried = (mesh, box) => {
  const found = [];
  mesh.query(...box, index => found.push(index));
  return found;
};

function rays(shape) {
  const physics = createPhysicsWorld3D();
  physics.createBody({ type: 'static', shape, position: [96, 2, -96] });
  const ray = (x, z, direction) => {
    const hit = physics.raycast([x, 100, z], direction, 150);
    return hit && [hit.distance, hit.point, hit.normal];
  };
  return [
    ray(0, -192, [0, -1, 0]),
    ray(96, -96, [0, -1, 0]),
    ray(192, 0, [0, -1, 0]),
    ray(89, -101, [0.15, -1, -0.07]),
    ray(192.1, 0, [0, -1, 0])
  ];
}

// Break caught: a shape that copies or rebuilds what it is given, or one whose queries differ from the original's.
test('WM01 an adopted shape owns the transferred arrays and answers exactly as the shape that built them', () => {
  const original = terrain();
  const exported = terrain().mesh.exportBuffers();
  const moved = structuredClone(exported, { transfer: Object.values(exported).map(view => view.buffer) });
  assert.ok(
    Object.values(exported).every(view => view.byteLength === 0),
    'the arrays left the shape that made them'
  );

  const mesh = TriangleMeshShape3D.fromBuffers(moved);
  assert.ok(mesh instanceof TriangleMeshShape3D);
  assert.equal(mesh.positions, moved.positions, 'no copy of the positions');
  assert.equal(mesh.indices, moved.indices, 'no copy of the indices');
  assert.equal(mesh.triangleCount, 18432);
  assert.deepEqual(mesh.bounds, original.mesh.bounds);
  assert.deepEqual(mesh.positions, original.mesh.positions);
  assert.deepEqual(mesh.indices, original.mesh.indices);
  assert.deepEqual(mesh.exportBuffers().nodeLeft, original.mesh.exportBuffers().nodeLeft, 'the same hierarchy');
  for (const box of [
    [-96, -10, -96, 96, 40, 96],
    [-97, -10, -97, -95, 40, -95],
    [11, -10, -7, 13, 40, 0],
    [-3, -20, -2, 3, -15, 2]
  ])
    assert.deepEqual(queried(mesh, box), queried(original.mesh, box), `box ${box}`);
  const expected = rays(original);
  assert.ok(expected.slice(0, 4).every(Boolean), 'four rays hit the terrain');
  assert.equal(expected.at(-1), undefined, 'and one passes beside it');
  assert.deepEqual(rays({ type: 'mesh', mesh }), expected);
  // A shape made the ordinary way still builds its own hierarchy after one has been adopted.
  assert.equal(new TriangleMeshShape3D([0, 0, 0, 1, 0, 0, 0, 0, 1]).triangleCount, 1);
});

// Break caught: arrays that would let a query read past its stack or its arrays, adopted without a word.
test('WM02 arrays that are not a shape as the constructor lays it out are refused', () => {
  const fresh = () => terrain().mesh.exportBuffers();
  const refused = (buffers, why) =>
    assert.throws(
      () => TriangleMeshShape3D.fromBuffers(buffers),
      error => error.code === 'WORLD3D_INPUT_INVALID' && /prepared mesh buffers/.test(error.message),
      why
    );
  refused(null, 'nothing');
  refused({ ...fresh(), positions: Array.from(fresh().positions) }, 'an array that is not a Float32Array');
  refused({ ...fresh(), nodeCount: fresh().nodeCount.subarray(1) }, 'node arrays of different lengths');
  const loop = fresh();
  loop.nodeLeft[0] = 0;
  refused(loop, 'a node that is its own child');
  const far = fresh();
  far.indices[0] = far.positions.length;
  refused(far, 'an index past the positions');
  const nan = fresh();
  nan.positions[4] = Number.NaN;
  refused(nan, 'a position that is not finite');
  const split = fresh();
  split.nodeCount[1] += 1;
  refused(split, "children that do not share their parent's triangles");
  const gone = fresh();
  structuredClone(gone.positions, { transfer: [gone.positions.buffer] });
  refused(gone, 'arrays transferred away already');
  const shared = fresh();
  refused(
    { ...shared, positions: new Float32Array(new SharedArrayBuffer(shared.positions.byteLength)) },
    'a shared buffer'
  );
});
