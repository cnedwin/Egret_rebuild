// SPDX-License-Identifier: Apache-2.0
// Public behavior of the DOM-free world3d core: math, scene graph, cameras,
// geometry, materials and resource lifetime.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Attribute3D, Geometry3D, Lod3D, Mesh3D, Object3D, RenderTarget3D, Scene3D, Texture3D, World3DError,
  createBoxGeometry3D, createCapsuleGeometry3D, createConeGeometry3D, createCylinderGeometry3D, createGeometry3D,
  createGradientCubeTexture3D, createGridGeometry3D, createOrthographicCamera3D, createPerspectiveCamera3D,
  createPlaneGeometry3D, createSphereGeometry3D, createStandardMaterial3D, createTorusGeometry3D, createUnlitMaterial3D,
  frustumIntersectsSphere, mat4Compose, mat4Decompose, mat4Invert, mat4Multiply, quatFromAxisAngle, quatFromEuler, quatSlerp,
  rayIntersectTriangle, srgbToLinear, linearToSrgb, vec3TransformMat4,
} from '@egret/engine/world3d';

const near = (actual, expected, epsilon = 1e-5) => {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < expected.length; i++) assert.ok(Math.abs(actual[i] - expected[i]) <= epsilon, `[${i}] ${actual[i]} != ${expected[i]}`);
};
const code = value => error => error instanceof World3DError && error.code === value;

test('W3C01 compose, invert and decompose round-trip an affine transform', () => {
  const q = quatFromAxisAngle([0, 0, 0, 1], [0, 1, 0], Math.PI / 3);
  const m = mat4Compose(new Float32Array(16), [1, 2, 3], q, [2, 3, 4]);
  const inverse = new Float32Array(16);
  assert.equal(mat4Invert(inverse, m), true);
  near(mat4Multiply(new Float32Array(16), m, inverse), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 1e-5);
  const t = [0, 0, 0], r = [0, 0, 0, 1], s = [0, 0, 0];
  mat4Decompose(m, t, r, s);
  near(t, [1, 2, 3]); near(s, [2, 3, 4]); near(r, Array.from(q));
  assert.equal(mat4Invert(new Float32Array(16), new Float32Array(16)), false);
});

test('W3C02 quaternion helpers follow right-handed rotation and shortest-path slerp', () => {
  const q = quatFromEuler([0, 0, 0, 1], 0, Math.PI / 2, 0);
  const m = mat4Compose(new Float32Array(16), [0, 0, 0], q, [1, 1, 1]);
  // A quarter turn about +Y carries +Z to +X.
  near(vec3TransformMat4([0, 0, 0], [0, 0, 1], m), [1, 0, 0]);
  const half = quatSlerp([0, 0, 0, 1], [0, 0, 0, 1], [0, Math.SQRT1_2, 0, Math.SQRT1_2], 0.5);
  near(half, [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)]);
  // Antipodal inputs describe the same rotation and must not take the long way round.
  const same = quatSlerp([0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, -1], 0.5);
  assert.ok(Math.abs(Math.abs(same[3]) - 1) < 1e-6);
});

test('W3C03 color conversion round-trips and ray-triangle reports distance, barycentrics and facing', () => {
  for (const value of [0, 0.002, 0.2, 0.5, 1]) assert.ok(Math.abs(linearToSrgb(srgbToLinear(value)) - value) < 1e-6);
  const out = [0, 0, 0], triangle = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  assert.equal(rayIntersectTriangle(out, [0.25, 0.5, 5], [0, 0, -1], triangle, 0, 3, 6, true), true);
  near(out, [5, 0.25, 0.5]);
  assert.equal(rayIntersectTriangle(out, [2, 2, 5], [0, 0, -1], triangle, 0, 3, 6, false), false);
  // Seen from behind, the triangle is a back face: culled on request, hit otherwise.
  assert.equal(rayIntersectTriangle(out, [0.25, 0.25, -5], [0, 0, 1], triangle, 0, 3, 6, true), false);
  assert.equal(rayIntersectTriangle(out, [0.25, 0.25, -5], [0, 0, 1], triangle, 0, 3, 6, false), true);
});

test('W3C04 hierarchy edits keep one parent, refuse cycles and propagate world matrices lazily', () => {
  const root = new Object3D(), arm = new Object3D(), hand = new Object3D();
  root.addChild(arm); arm.addChild(hand);
  root.setPosition(1, 0, 0); arm.setPosition(0, 2, 0); hand.setPosition(0, 0, 3);
  near(hand.getWorldPosition([0, 0, 0]), [1, 2, 3]);
  const version = hand.worldVersion;
  root.updateWorldMatrices();
  assert.equal(hand.worldVersion, version, 'a clean subtree is not recomputed');
  root.setRotation(0, Math.PI / 2, 0);
  root.updateWorldMatrices();
  near(hand.getWorldPosition([0, 0, 0]), [4, 2, 0]);
  assert.throws(() => hand.addChild(root), code('WORLD3D_HIERARCHY_INVALID'));
  assert.throws(() => root.addChild(root), code('WORLD3D_HIERARCHY_INVALID'));
  assert.throws(() => root.addChild(new Scene3D()), code('WORLD3D_HIERARCHY_INVALID'));
  const other = new Object3D();
  other.addChild(hand);
  assert.equal(arm.numChildren, 0);
  assert.equal(hand.parent, other);
  assert.throws(() => arm.removeChild(hand), code('WORLD3D_HIERARCHY_INVALID'));
  near(other.worldToLocal([0, 0, 0], hand.localToWorld([0, 0, 0], [0, 0, 0])), [0, 0, 3]);
});

test('W3C05 lookAt orients negative Z toward the target, also under a rotated parent', () => {
  const parent = new Object3D(), node = new Object3D();
  parent.setRotation(0, 1.1, 0).setPosition(2, 0, -1);
  parent.addChild(node);
  node.setPosition(0, 1, 0);
  node.lookAt(5, 3, 4);
  node.updateWorldMatrix();
  const origin = node.getWorldPosition([0, 0, 0]), m = node.matrixWorld;
  const forward = [-m[8], -m[9], -m[10]], want = [5 - origin[0], 3 - origin[1], 4 - origin[2]];
  const length = Math.hypot(...want);
  near(forward, want.map(value => value / length), 1e-4);
});

test('W3C06 clone copies the subtree and shares geometry and material by reference', () => {
  const geometry = createBoxGeometry3D(), material = createUnlitMaterial3D({color: 0xff0000});
  const mesh = new Mesh3D(geometry, material);
  mesh.name = 'box'; mesh.setPosition(1, 2, 3); mesh.addChild(new Object3D()).name = 'child';
  const copy = mesh.clone();
  assert.notEqual(copy, mesh); assert.notEqual(copy.id, mesh.id);
  assert.equal(copy.geometry, geometry); assert.equal(copy.material, material);
  assert.equal(copy.getObjectByName('child') !== mesh.getObjectByName('child'), true);
  near(copy.position, [1, 2, 3]);
  const independent = material.clone();
  independent.setColor(0x00ff00);
  near(material.color, [1, 0, 0]);
  assert.notEqual(independent.id, material.id);
});

test('W3C07 cameras build projections, rays and frusta with OpenGL clip conventions', () => {
  const camera = createPerspectiveCamera3D({fov: 90, aspect: 2, near: 1, far: 100});
  camera.setPosition(0, 0, 5);
  camera.updateViewMatrices();
  near(camera.worldToScreenPoint([0, 0, 0], [0, 0, 4]), [0, 0, -1], 1e-5);
  near(camera.worldToScreenPoint([0, 0, 0], [0, 0, -95]), [0, 0, 1], 1e-4);
  // With a 90 degree vertical field of view and aspect 2, x = 2 * depth is the right edge.
  near(Array.from(camera.worldToScreenPoint([0, 0, 0], [8, 4, 1])).slice(0, 2), [1, 1], 1e-5);
  const origin = [0, 0, 0], direction = [0, 0, 0];
  camera.screenPointToRay(0, 0, origin, direction);
  near(direction, [0, 0, -1]); near(origin, [0, 0, 4], 1e-4);
  assert.equal(frustumIntersectsSphere(camera.frustum, [0, 0, 0, 1]), true);
  assert.equal(frustumIntersectsSphere(camera.frustum, [0, 0, 10, 1]), false);
  assert.equal(frustumIntersectsSphere(camera.frustum, [50, 0, 0, 1]), false);
  const ortho = createOrthographicCamera3D({height: 4, aspect: 1, near: 0, far: 10});
  ortho.updateViewMatrices();
  near(ortho.worldToScreenPoint([0, 0, 0], [2, -2, -5]), [1, -1, 0], 1e-5);
  camera.far = 0.5;
  assert.throws(() => camera.updateProjectionMatrix(), code('WORLD3D_INPUT_INVALID'));
});

test('W3C08 primitives are closed, outward-facing and correctly bounded', () => {
  const builders = [
    ['box', createBoxGeometry3D({width: 2, height: 4, depth: 6}), [-1, -2, -3, 1, 2, 3]],
    ['sphere', createSphereGeometry3D({radius: 2}), [-2, -2, -2, 2, 2, 2]],
    ['cylinder', createCylinderGeometry3D({radiusTop: 1, radiusBottom: 1, height: 2}), [-1, -1, -1, 1, 1, 1]],
    ['cone', createConeGeometry3D({radius: 1, height: 2}), [-1, -1, -1, 1, 1, 1]],
    ['torus', createTorusGeometry3D({radius: 2, tube: 0.5}), undefined],
    ['capsule', createCapsuleGeometry3D({radius: 0.5, height: 1}), undefined],
  ];
  for (const [name, geometry, box] of builders) {
    const positions = geometry.getAttribute('position').data, normals = geometry.getAttribute('normal').data, index = geometry.index.data;
    assert.equal(index.length % 3, 0, name);
    assert.equal(geometry.getAttribute('uv').count, geometry.vertexCount, name);
    if (box) near(geometry.boundingBox, box, 1e-5);
    // Signed volume is positive when triangles wind counter-clockwise seen from outside.
    let volume = 0, agree = 0;
    for (let i = 0; i < index.length; i += 3) {
      const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
      const ax = positions[a], ay = positions[a + 1], az = positions[a + 2], bx = positions[b], by = positions[b + 1], bz = positions[b + 2], cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];
      volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay), ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (nx * normals[a] + ny * normals[a + 1] + nz * normals[a + 2] >= -1e-6) agree++;
    }
    assert.ok(volume > 0, name + ' volume ' + volume);
    assert.equal(agree, index.length / 3, name + ' vertex normals agree with face winding');
  }
  assert.equal(createPlaneGeometry3D({width: 2, height: 2}).boundingSphere[3] > 1.41, true);
  assert.equal(createGridGeometry3D(4, 4).topology, 'lines');
});

test('W3C09 geometry validates input, computes normals and tangents, and versions its layout', () => {
  assert.throws(() => new Attribute3D(new Float32Array(5), 3), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createGeometry3D({positions: [0, 0]}), code('WORLD3D_INPUT_INVALID'));
  const geometry = createGeometry3D({positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], uvs: [0, 0, 1, 0, 0, 1], indices: [0, 1, 2]});
  near(geometry.getAttribute('normal').data, [0, 0, 1, 0, 0, 1, 0, 0, 1]);
  geometry.computeTangents();
  near(Array.from(geometry.getAttribute('tangent').data).slice(0, 4), [1, 0, 0, 1]);
  const layout = geometry.layoutVersion, version = geometry.getAttribute('position').version;
  geometry.getAttribute('position').touch();
  assert.equal(geometry.getAttribute('position').version, version + 1);
  geometry.setAttribute('color', new Attribute3D(new Float32Array(9), 3));
  assert.ok(geometry.layoutVersion > layout);
  assert.throws(() => geometry.setIndex([0, 1, 5]), code('WORLD3D_INPUT_INVALID'));
  geometry.addGroup(0, 3, 1);
  assert.deepEqual(geometry.groups, [{start: 0, count: 3, materialIndex: 1}]);
  assert.throws(() => geometry.setMorphTargets([{name: 'bad', position: new Float32Array(3)}]), code('WORLD3D_INPUT_INVALID'));
});

test('W3C10 resources notify backends exactly once on disposal and refuse later use', () => {
  const texture = new Texture3D({width: 2, height: 1, data: new Uint8Array(8)});
  const calls = [];
  const unsubscribe = texture.onDispose(() => calls.push('a'));
  texture.onDispose(() => calls.push('b'));
  unsubscribe();
  const version = texture.version;
  texture.setSource({width: 1, height: 1, data: new Uint8Array(4)});
  assert.equal(texture.version, version + 1);
  texture.dispose(); texture.dispose();
  assert.deepEqual(calls, ['b']);
  assert.equal(texture.isDisposed, true);
  assert.throws(() => texture.setSource({width: 1, height: 1, data: new Uint8Array(4)}), code('WORLD3D_DISPOSED'));
  texture.onDispose(() => calls.push('late'));
  assert.deepEqual(calls, ['b', 'late'], 'a listener added after disposal runs immediately');
  assert.throws(() => new Texture3D({width: 2, height: 2, data: new Uint8Array(4)}), code('WORLD3D_INPUT_INVALID'));
  const target = new RenderTarget3D(64, 32);
  assert.equal(target.texture.source, target);
  target.setSize(32, 32);
  assert.equal(target.width, 32);
  target.dispose();
  assert.equal(target.texture.isDisposed, true);
  assert.throws(() => new RenderTarget3D(0, 4), code('WORLD3D_INPUT_INVALID'));
  const cube = createGradientCubeTexture3D([0, 0, 255], [255, 255, 255], [80, 60, 40], 8);
  assert.equal(cube.faces.length, 6);
  // +Y is the zenith color at its center, -Y the ground color.
  near(Array.from(cube.faces[2].data.subarray(4 * (4 * 8 + 4), 4 * (4 * 8 + 4) + 3)), [8, 8, 255], 12);
  near(Array.from(cube.faces[3].data.subarray(4 * (4 * 8 + 4), 4 * (4 * 8 + 4) + 3)), [80, 60, 40], 1);
});

test('W3C11 materials default alpha handling from opacity and LOD shows one level by distance', () => {
  const glass = createStandardMaterial3D({opacity: 0.5});
  assert.equal(glass.alphaMode, 'blend'); assert.equal(glass.depthWrite, false); assert.equal(glass.isTransparent, true);
  const solid = createStandardMaterial3D({color: [0.2, 0.4, 0.6], metallic: 1});
  assert.equal(solid.alphaMode, 'opaque'); assert.equal(solid.depthWrite, true); near(solid.color, [0.2, 0.4, 0.6]);
  assert.throws(() => createStandardMaterial3D({color: 'red'}), code('WORLD3D_INPUT_INVALID'));
  const lod = new Lod3D(), nearLevel = new Object3D(), midLevel = new Object3D(), farLevel = new Object3D();
  lod.addLevel(farLevel, 50).addLevel(nearLevel, 0).addLevel(midLevel, 10);
  lod.setPosition(0, 0, -5); lod.updateWorldMatrix();
  lod.select(0, 0, 0);
  assert.deepEqual([nearLevel.visible, midLevel.visible, farLevel.visible], [true, false, false]);
  lod.select(0, 0, 20);
  assert.deepEqual([nearLevel.visible, midLevel.visible, farLevel.visible], [false, true, false]);
  lod.select(0, 0, 100);
  assert.equal(lod.currentLevel, 2);
});
