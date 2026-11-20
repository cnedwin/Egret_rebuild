// Bounds that follow geometry edited in place, distance culling, and a fog that can leave the sky clear: from the
// notes of Tea Horse Road, whose tarps and ropes vanished once their trucks had driven off.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InstancedMesh3D,
  Mesh3D,
  RenderList3D,
  Scene3D,
  createBoxGeometry3D,
  createCloth3D,
  createGradientCubeTexture3D,
  createPerspectiveCamera3D,
  createRope3D,
  createUnlitMaterial3D
} from '@egret/engine/world3d';
import { createAtmosphere3D } from '@egret/engine/webgl2/world3d';

const centre = mesh => [...mesh.worldBoundingSphere.subarray(0, 3)].map(v => Math.round(v));

test('MB01 a mesh whose points move in place has bounds where its points are, and is drawn there', () => {
  // A tarp made at the origin and carried 60 units away, as on a truck.
  const cloth = createCloth3D({ columns: 4, rows: 3, origin: [0, 2, 0], right: [3, 0, 0], down: [0, -2, 0] });
  const mesh = cloth.createMesh(createUnlitMaterial3D());
  assert.deepEqual(centre(mesh), [2, 1, 0]);
  for (let i = 0; i < 12; i++)
    cloth.setPoint(i, cloth.points[i * 3] + 60, cloth.points[i * 3 + 1], cloth.points[i * 3 + 2]);
  cloth.update(1 / 60);
  assert.ok(
    Math.abs(mesh.worldBoundingSphere[0] - 61.5) < 2,
    'the sphere moved with the cloth: ' + mesh.worldBoundingSphere[0]
  );
  // Seen by a camera looking at the new place, it is drawn, not culled where it used to be.
  const scene = new Scene3D();
  scene.addChild(mesh);
  const camera = createPerspectiveCamera3D({ fov: 60, aspect: 1, near: 0.1, far: 500 });
  camera.setPosition(61, 1, 10).lookAt(61, 1, 0);
  const list = new RenderList3D();
  list.build(scene, camera);
  assert.equal(list.stats.culled, 0);
  assert.ok([...list.opaque, ...list.transparent].some(item => item.mesh === mesh));
  // A rope too.
  const rope = createRope3D({ start: [0, 5, 0], end: [4, 5, 0], segments: 8 });
  const line = rope.createMesh(createUnlitMaterial3D());
  const before = line.worldBoundingSphere[0];
  for (let i = 0; i <= 8; i++) rope.setPoint(i, rope.points[i * 3] + 100, rope.points[i * 3 + 1], 0);
  rope.update(1 / 60);
  assert.ok(line.worldBoundingSphere[0] > before + 90, 'the rope bounds followed');
  // The structure version is unchanged: only the bounds are found again.
  const geometry = mesh.geometry,
    version = geometry.version,
    bounds = geometry.boundsVersion;
  geometry.invalidateBounds();
  assert.equal(geometry.version, version);
  assert.equal(geometry.boundsVersion, bounds + 1);
});

test('MB02 a mesh further than its cullDistance is neither drawn nor casts a shadow; instances count by their bounds', () => {
  const scene = new Scene3D(),
    material = createUnlitMaterial3D();
  const place = (name, z, distance) => {
    const mesh = new Mesh3D(createBoxGeometry3D(), material);
    mesh.name = name;
    mesh.position[2] = -z;
    mesh.castShadow = true;
    if (distance !== undefined) mesh.cullDistance = distance;
    scene.addChild(mesh);
    return mesh;
  };
  place('near grass', 20, 50);
  place('far grass', 80, 50);
  place('far tower', 80);
  const tufts = new InstancedMesh3D(createBoxGeometry3D(), material, 4);
  tufts.name = 'far tufts';
  tufts.count = 2;
  tufts.cullDistance = 50;
  scene.addChild(tufts);
  const camera = createPerspectiveCamera3D({ fov: 60, aspect: 1, near: 0.1, far: 500 });
  camera.setPosition(0, 0, 0).lookAt(0, 0, -1);
  const drawn = () => {
    const list = new RenderList3D();
    list.build(scene, camera);
    return { names: [...new Set(list.opaque.map(item => item.mesh.name))].sort(), list };
  };
  // The instances sit at the origin until moved: near, drawn.
  let { names, list } = drawn();
  assert.deepEqual(names, ['far tower', 'far tufts', 'near grass']);
  assert.equal(list.stats.culled, 1);
  assert.equal(
    list.shadowCasters.some(mesh => mesh.name === 'far grass'),
    false,
    'a mesh too far casts no shadow'
  );
  // Moved 90 away, the instances' bounds are beyond 50.
  const at = new Float32Array(16);
  at[0] = at[5] = at[10] = at[15] = 1;
  at[14] = -90;
  tufts.setMatrixAt(0, at);
  tufts.setMatrixAt(1, at);
  ({ names } = drawn());
  assert.deepEqual(names, ['far tower', 'near grass']);
  // Infinity, the default, keeps a mesh at any distance; a copy keeps the distance.
  assert.equal(new Mesh3D(createBoxGeometry3D(), material).cullDistance, Infinity);
  assert.equal(scene.children.find(m => m.name === 'far grass').clone().cullDistance, 50);
});

test('MB03 an atmosphere can leave the sky clear, as a constant of its program; 1 is the fog as before', () => {
  const plain = createAtmosphere3D();
  assert.equal(plain.skyFog, 1);
  assert.equal(plain.post.key, 'world3d-atmosphere');
  assert.ok(plain.post.glsl.includes('mix(1.0, 1.0000, step(shape.z, reach))'));
  const clear = createAtmosphere3D({ skyFog: 0.25 });
  assert.equal(clear.skyFog, 0.25);
  assert.notEqual(clear.post.key, plain.post.key);
  assert.ok(clear.post.glsl.includes('mix(1.0, 0.2500, step(shape.z, reach))'));
  assert.ok(clear.post.wgsl.includes('mix(1.0, 0.2500, step(shape.z, reach))'));
  for (const bad of [-0.1, 1.5, Number.NaN, '0.5'])
    assert.throws(
      () => createAtmosphere3D({ skyFog: bad }),
      error => error.code === 'WORLD3D_INPUT_INVALID',
      String(bad)
    );
});

test('MB04 a sky given in fractions is the same sky as one given in bytes; a colour outside both is refused', () => {
  const bytes = createGradientCubeTexture3D([102, 153, 255], [255, 204, 128], [51, 153, 51], 4);
  const fractions = createGradientCubeTexture3D([0.4, 0.6, 1], [1, 0.8, 0.502], [0.2, 0.6, 0.2], 4);
  for (let face = 0; face < 6; face++) assert.deepEqual([...fractions.faces[face].data], [...bytes.faces[face].data]);
  // Tea Horse Road gave fractions: the sky was nearly black. Now its zenith is blue.
  assert.ok(fractions.faces[2].data[2] > 200);
  for (const bad of [
    [
      [0, 0, 300],
      [0, 0, 0],
      [0, 0, 0]
    ],
    [
      [0, 0, -1],
      [0, 0, 0],
      [0, 0, 0]
    ],
    [
      [0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ],
    [
      ['1', 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ]
  ])
    assert.throws(
      () => createGradientCubeTexture3D(...bad),
      error => error.code === 'WORLD3D_INPUT_INVALID'
    );
});
