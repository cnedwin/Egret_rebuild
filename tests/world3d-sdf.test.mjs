// SPDX-License-Identifier: Apache-2.0
// Models made in code as distance fields, and the simplifier that brings any mesh down to a triangle budget.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBoxGeometry3D,
  createSdfGeometry3D,
  createSphereGeometry3D,
  linearColor3D,
  sdfBox,
  sdfCapsule,
  sdfCone,
  sdfCylinder,
  sdfDisplace,
  sdfEllipsoid,
  sdfIntersect,
  sdfMirror,
  sdfRound,
  sdfShell,
  sdfSphere,
  sdfSubtract,
  sdfTorus,
  sdfUnion,
  simplifyGeometry3D
} from '@egret/engine/world3d';

const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

/** The share of triangles whose winding agrees with the normals of their vertices, and that face away from `inside`. */
function facing(geometry) {
  const p = geometry.getAttribute('position').data,
    n = geometry.getAttribute('normal').data,
    ix = geometry.index.data;
  let agree = 0;
  for (let f = 0; f < ix.length; f += 3) {
    const [a, b, c] = [ix[f], ix[f + 1], ix[f + 2]];
    const u = [p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]];
    const v = [p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1], p[c * 3 + 2] - p[a * 3 + 2]];
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (cross[0] * n[a * 3] + cross[1] * n[a * 3 + 1] + cross[2] * n[a * 3 + 2] > 0) agree++;
  }
  return agree / (ix.length / 3);
}

/** Whether every edge of the mesh is shared by exactly two triangles: a closed surface with no holes. */
function closed(geometry) {
  const ix = geometry.index.data,
    use = new Map();
  for (let f = 0; f < ix.length; f += 3)
    for (let c = 0; c < 3; c++) {
      const a = ix[f + c],
        b = ix[f + ((c + 1) % 3)];
      const k = a < b ? a + ',' + b : b + ',' + a;
      use.set(k, (use.get(k) ?? 0) + 1);
    }
  return [...use.values()].every(count => count === 2);
}

// Break caught: a primitive whose distance is wrong, so the mesh is the wrong size or shape.
test('SD01 each primitive gives the distance to its surface', () => {
  assert.equal(sdfSphere(1).distance(2, 0, 0), 1);
  assert.equal(sdfSphere(1).distance(0, 0, 0), -1);
  assert.equal(sdfBox([2, 2, 2]).distance(3, 0, 0), 2);
  assert.ok(close(sdfBox([2, 2, 2], { round: 0.2 }).distance(1, 1, 1), Math.sqrt(3) * 0.2 - 0.2, 1e-9));
  assert.equal(sdfBox([2, 2, 2]).distance(0, 0, 0), -1);
  assert.ok(close(sdfEllipsoid([2, 1, 1]).distance(2, 0, 0), 0));
  assert.ok(close(sdfEllipsoid([2, 1, 1]).distance(0, 1, 0), 0));
  assert.ok(close(sdfCapsule([0, 0, 0], [0, 2, 0], 0.5).distance(1, 1, 0), 0.5));
  assert.ok(close(sdfCapsule([0, 0, 0], [0, 2, 0], 0.5, { radiusEnd: 0.2 }).distance(0, 3, 0), 0.8));
  assert.ok(close(sdfCylinder(1, 2).distance(3, 0, 0), 2));
  assert.ok(close(sdfCylinder(1, 2).distance(0, 2, 0), 1));
  assert.ok(close(sdfCone(1, 0, 2).distance(0, 2, 0), 1));
  assert.ok(close(sdfCone(1, 0, 2).distance(0, -2, 0), 1));
  assert.ok(close(sdfTorus(1, 0.25).distance(1, 0, 0), -0.25));
  // A rounding larger than the box allows is taken as the most it allows.
  assert.ok(close(sdfBox([1, 1, 1], { round: 5 }).distance(1, 0, 0), sdfSphere(0.5).distance(1, 0, 0)));
});

// Break caught: placing, turning or scaling that moves the shape the wrong way, or bounds that miss it.
test('SD02 at, rotation and scale place a shape, and its bounds follow', () => {
  const moved = sdfSphere(1, { at: [5, 0, 0] });
  assert.equal(moved.distance(5, 0, 0), -1);
  assert.deepEqual([...moved.bounds], [4, -1, -1, 6, 1, 1]);
  // A box long in x, turned a quarter about z, is long in y.
  const turned = sdfBox([4, 1, 1], { rotation: [0, 0, Math.PI / 2] });
  assert.ok(turned.distance(0, 1.9, 0) < 0);
  assert.ok(turned.distance(1.9, 0, 0) > 0);
  assert.ok(close(turned.bounds[4], 2, 1e-9) && close(turned.bounds[3], 0.5, 1e-9));
  const big = sdfSphere(1, { scale: 3 });
  assert.ok(close(big.distance(5, 0, 0), 2));
  assert.deepEqual([...big.bounds], [-3, -3, -3, 3, 3, 3]);
});

// Break caught: a soft join that leaves a crease, a cut that does not cut, or a mirror on one side only.
test('SD03 union, subtract, intersect and mirror combine fields', () => {
  const a = sdfSphere(1, { at: [-0.9, 0, 0] }),
    b = sdfSphere(1, { at: [0.9, 0, 0] });
  // Between two touching balls, a smooth union fills the waist: the point above the join is inside.
  assert.ok(sdfUnion([a, b]).distance(0, 0.5, 0) > 0);
  assert.ok(sdfUnion([a, b], { smooth: 0.6 }).distance(0, 0.5, 0) < 0);
  assert.ok(sdfUnion([a, b], { smooth: 0.6 }).bounds[4] > 1);
  const bowl = sdfSubtract(sdfSphere(1), sdfSphere(0.8, { at: [0, 0.4, 0] }));
  assert.ok(bowl.distance(0, 0.4, 0) > 0, 'the hollow is empty');
  assert.ok(bowl.distance(0, -0.9, 0) < 0, 'the bottom is solid');
  const lens = sdfIntersect([a, b]);
  assert.ok(lens.distance(0, 0, 0) < 0 && lens.distance(-1.5, 0, 0) > 0);
  const pair = sdfMirror(sdfSphere(0.3, { at: [1, 0, 0] }));
  assert.ok(pair.distance(-1, 0, 0) < 0 && pair.distance(1, 0, 0) < 0);
  assert.deepEqual([...pair.bounds], [-1.3, -0.3, -0.3, 1.3, 0.3, 0.3]);
  const tall = sdfMirror(sdfSphere(0.3, { at: [0, 1, 0] }), { axis: 'y' });
  assert.ok(tall.distance(0, -1, 0) < 0);
  assert.ok(close(sdfRound(sdfBox([1, 1, 1]), 0.1).distance(0.6, 0, 0), 0));
  assert.ok(sdfShell(sdfSphere(1), 0.1).distance(0, 0, 0) > 0, 'a shell is hollow');
  const rough = sdfDisplace(sdfSphere(1), { amount: 0.1, seed: 3 });
  assert.equal(
    rough.distance(0.3, 0.7, 0.2),
    sdfDisplace(sdfSphere(1), { amount: 0.1, seed: 3 }).distance(0.3, 0.7, 0.2)
  );
  assert.ok(Math.abs(rough.distance(1, 0, 0)) <= 0.1 + 1e-9);
});

// Break caught: a mesh with holes, triangles turned inward, normals off the surface or a ball of the wrong size.
test('SD04 the mesh of a ball is closed, faces out and lies on the surface', () => {
  const geometry = createSdfGeometry3D(sdfSphere(1), { resolution: 32, triangles: 0, occlusion: 0 });
  assert.ok(geometry.index.count / 3 > 1000);
  assert.ok(closed(geometry), 'no holes');
  assert.equal(facing(geometry), 1);
  const p = geometry.getAttribute('position').data,
    n = geometry.getAttribute('normal').data;
  for (let i = 0; i < geometry.vertexCount; i++) {
    const r = Math.hypot(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    assert.ok(Math.abs(r - 1) < 1e-3, 'on the surface: ' + r);
    assert.ok((p[i * 3] * n[i * 3] + p[i * 3 + 1] * n[i * 3 + 1] + p[i * 3 + 2] * n[i * 3 + 2]) / r > 0.99);
  }
  // A plain white ball with no shading baked is white.
  const c = geometry.getAttribute('color').data;
  assert.ok(c.every(value => close(value, 1)));
});

// Break caught: parts that lose their colours, colours that do not blend at a soft join, or no shade in a crease.
test('SD05 colours follow the parts, blend where they meet, and creases are darker', () => {
  const red = linearColor3D(0xff0000),
    blue = linearColor3D(0x0000ff);
  const shape = sdfUnion(
    [sdfSphere(1, { at: [-0.9, 0, 0], color: 0xff0000 }), sdfSphere(1, { at: [0.9, 0, 0], color: 0x0000ff })],
    { smooth: 0.4 }
  );
  const g = createSdfGeometry3D(shape, { resolution: 40, triangles: 0, occlusion: 0 });
  const p = g.getAttribute('position').data,
    c = g.getAttribute('color').data;
  let left = null,
    right = null,
    middle = null;
  for (let i = 0; i < g.vertexCount; i++) {
    const x = p[i * 3];
    if (x < -1.7) left = i;
    if (x > 1.7) right = i;
    if (Math.abs(x) < 0.02) middle = i;
  }
  assert.deepEqual([c[left * 3], c[left * 3 + 2]], [red[0], red[2]]);
  assert.deepEqual([c[right * 3], c[right * 3 + 2]], [blue[0], blue[2]]);
  assert.ok(c[middle * 3] > 0.2 && c[middle * 3 + 2] > 0.2, 'the join is a mix of both');
  // A cut with its own colour paints its hollow.
  const mouth = sdfSubtract(sdfSphere(1, { color: 0xffffff }), sdfSphere(0.4, { at: [0, 0, 1], color: 0x000000 }));
  const m = createSdfGeometry3D(mouth, { resolution: 40, triangles: 0, occlusion: 0 });
  const mp = m.getAttribute('position').data,
    mc = m.getAttribute('color').data;
  for (let i = 0; i < m.vertexCount; i++) {
    const inHollow = Math.hypot(mp[i * 3], mp[i * 3 + 1], mp[i * 3 + 2] - 1) < 0.38;
    if (inHollow) assert.ok(mc[i * 3] < 0.05, 'the hollow is black');
    if (mp[i * 3 + 2] < -0.5) assert.ok(mc[i * 3] > 0.95, 'the back is white');
  }
  // An intersection takes its colour from the parts that have one; a part without one only cuts, cut faces included.
  const half = sdfIntersect([sdfSphere(1, { color: 0x00ff00 }), sdfBox([4, 1, 4], { at: [0, -0.5, 0] })]);
  const hp = new Float32Array(3);
  for (const point of [
    [0, 0, 0],
    [0, -1, 0],
    [0.5, -0.3, 0.4]
  ]) {
    half.colorAt(...point, hp, new Float32Array([1, 1, 1]));
    assert.deepEqual([...hp], [0, 1, 0], point.join());
  }
  // Baked shade: the vertices in the waist between two balls are darker than those on the far sides.
  const shaded = createSdfGeometry3D(
    sdfUnion([sdfSphere(1, { at: [-0.9, 0, 0] }), sdfSphere(1, { at: [0.9, 0, 0] })], { smooth: 0.2 }),
    { resolution: 40, triangles: 0 }
  );
  const sp = shaded.getAttribute('position').data,
    sc = shaded.getAttribute('color').data;
  let waist = 1,
    outer = 0;
  for (let i = 0; i < shaded.vertexCount; i++) {
    const x = sp[i * 3];
    if (Math.abs(x) < 0.05) waist = Math.min(waist, sc[i * 3]);
    if (x > 1.8) outer = Math.max(outer, sc[i * 3]);
  }
  assert.ok(waist < outer - 0.2, waist + ' against ' + outer);
});

// Break caught: a model larger than its budget, or one simplified until it no longer has its shape.
test('SD06 a model is brought down to its triangle budget and keeps its shape', () => {
  const full = createSdfGeometry3D(sdfSphere(1), { triangles: 0, occlusion: 0 });
  const budget = createSdfGeometry3D(sdfSphere(1), { occlusion: 0 });
  assert.ok(full.index.count / 3 > 8000);
  assert.ok(budget.index.count / 3 <= 8000);
  const small = createSdfGeometry3D(sdfSphere(1), { triangles: 500, occlusion: 0 });
  assert.ok(small.index.count / 3 <= 500);
  assert.ok(closed(small) && facing(small) === 1);
  const p = small.getAttribute('position').data;
  for (let i = 0; i < p.length; i += 3) assert.ok(Math.abs(Math.hypot(p[i], p[i + 1], p[i + 2]) - 1) < 1e-3);
});

// Break caught: a simplifier that opens seams, moves open edges, loses attributes or changes its input.
test('SD07 simplifyGeometry3D keeps attributes, open edges and the input', () => {
  const ball = createSphereGeometry3D({ radius: 1, widthSegments: 64, heightSegments: 32 });
  const before = Float32Array.from(ball.getAttribute('position').data);
  const result = simplifyGeometry3D(ball, { ratio: 0.25 });
  assert.deepEqual(ball.getAttribute('position').data, before);
  assert.equal(result.before, ball.index.count / 3);
  assert.ok(result.after <= Math.floor(result.before * 0.25) && result.after > 0);
  assert.equal(result.geometry.index.count / 3, result.after);
  for (const name of ['position', 'normal', 'uv']) assert.ok(result.geometry.getAttribute(name), name);
  // A sphere's texture seam splits vertices: an open edge. Every vertex on it is still where it was.
  const keep = new Set();
  for (let i = 0; i < before.length; i += 3) keep.add(before[i] + ',' + before[i + 1] + ',' + before[i + 2]);
  const p = result.geometry.getAttribute('position').data;
  for (let i = 0; i < p.length; i += 3) assert.ok(keep.has(p[i] + ',' + p[i + 1] + ',' + p[i + 2]), 'kept vertices');
  assert.ok(result.error >= 0 && result.error < 0.2);
  // maxError stops short of the target rather than spoil the shape.
  const careful = simplifyGeometry3D(ball, { triangles: 10, maxError: 0.001 });
  assert.ok(careful.after > 10 && careful.error <= 0.001);
  // A box has nothing to give up without changing shape: its flat faces go, its corners stay.
  const cube = simplifyGeometry3D(createBoxGeometry3D({ widthSegments: 4, heightSegments: 4, depthSegments: 4 }), {
    triangles: 0,
    maxError: 1e-6
  });
  assert.ok(cube.after < cube.before);
  // Each face of the box keeps its own material range.
  assert.equal(cube.geometry.groups.length, 6);
  assert.equal(
    cube.geometry.groups.reduce((sum, group) => sum + group.count, 0),
    cube.geometry.index.count
  );
});

// Break caught: bad input taken as a shape, or a grid so fine it stalls the page.
test('SD08 bad arguments are refused', () => {
  const bad = { code: 'WORLD3D_INPUT_INVALID' };
  assert.throws(() => sdfSphere(0), bad);
  assert.throws(() => sdfSphere(1, { at: [0, 0] }), bad);
  assert.throws(() => sdfSphere(1, { color: 'red' }), bad);
  assert.throws(() => sdfSphere(1, { scale: -1 }), bad);
  assert.throws(() => sdfBox([1, 0, 1]), bad);
  assert.throws(() => sdfCone(0, 0, 1), bad);
  assert.throws(() => sdfUnion([]), bad);
  assert.throws(() => sdfUnion([{}]), bad);
  assert.throws(() => sdfUnion([sdfSphere(1)], { smooth: -1 }), bad);
  assert.throws(() => sdfMirror(sdfSphere(1), { axis: 'w' }), bad);
  assert.throws(() => sdfDisplace(sdfSphere(1), {}), bad);
  assert.throws(() => createSdfGeometry3D({}), bad);
  assert.throws(() => createSdfGeometry3D(sdfSphere(1), { resolution: 4 }), bad);
  assert.throws(() => createSdfGeometry3D(sdfSphere(1), { resolution: 1000 }), { code: 'WORLD3D_BUDGET' });
  assert.throws(() => createSdfGeometry3D(sdfSphere(1), { occlusion: 2 }), bad);
  assert.throws(() => createSdfGeometry3D(sdfSphere(1), { triangles: -1 }), bad);
  assert.throws(() => simplifyGeometry3D({}), bad);
  assert.throws(() => simplifyGeometry3D(createBoxGeometry3D({}), { ratio: 2 }), bad);
});
