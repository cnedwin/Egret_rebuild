// SPDX-License-Identifier: Apache-2.0
// The frame-preparation shortcuts of World3D: repeated meshes folded into
// instanced draws, sorted order kept between like frames, the picking
// hierarchy and the in-place skeleton update. Each is checked against the
// plain way of doing the same thing.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Bone3D, InstancedMesh3D, Mesh3D, Object3D, Raycaster3D, RenderList3D, Scene3D, Skeleton3D, Sprite3D, TriangleMeshShape3D, createBoxGeometry3D, createGlassMaterial3D,
  createPerspectiveCamera3D, createSphereGeometry3D, createStandardMaterial3D, mat4Multiply,
} from '@egret/engine/world3d';

const close = (actual, expected, epsilon = 1e-4) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
function crowd(count, make) {
  const scene = new Scene3D(), camera = createPerspectiveCamera3D({fov: 60, aspect: 1, near: 0.1, far: 500});
  camera.setPosition(0, 30, 60).lookAt(0, 0, 0); scene.addChild(camera);
  const meshes = [];
  for (let i = 0; i < count; i++) { const mesh = make(i); mesh.setPosition((i % 10) * 2 - 9, 0, Math.floor(i / 10) * 2 - 9); scene.addChild(mesh); meshes.push(mesh); }
  return {scene, camera, meshes};
}

test('runs of like meshes become one instanced item each', () => {
  const box = createBoxGeometry3D({}), ball = createSphereGeometry3D({}), red = createStandardMaterial3D({}), blue = createStandardMaterial3D({});
  const {scene, camera, meshes} = crowd(100, i => new Mesh3D(i < 60 ? box : ball, i % 2 ? red : blue));
  const list = new RenderList3D();
  list.build(scene, camera);
  // Four combinations of geometry and material, each long enough to fold.
  assert.equal(list.opaque.length, 4);
  assert.deepEqual(list.instancing, {batches: 4, meshes: 100});
  const counts = list.opaque.map(item => item.mesh.count).sort((a, b) => a - b);
  assert.deepEqual(counts, [20, 20, 30, 30]);
  for (const item of list.opaque) { assert.ok(item.mesh instanceof InstancedMesh3D); assert.equal(item.mesh.pickable, false); assert.equal(item.mesh.parent, undefined); }
  // Every member's world matrix is among the instances of its stand-in.
  const stand = list.opaque.find(item => item.geometry === box && item.material === blue).mesh, placed = new Set();
  for (let k = 0; k < stand.count; k++) placed.add(stand.instanceMatrices[k * 16 + 12] + ',' + stand.instanceMatrices[k * 16 + 14]);
  for (const mesh of meshes.filter((m, i) => i < 60 && i % 2 === 0)) assert.ok(placed.has(mesh.matrixWorld[12] + ',' + mesh.matrixWorld[14]));
  // The scene itself is untouched.
  assert.equal(scene.numChildren, 101);
  // Shadow casters are grouped the same way.
  assert.equal(list.shadowCasters.length, 4);
  assert.ok(list.shadowCasters.every(mesh => mesh instanceof InstancedMesh3D && mesh.castShadow));
  // Switching it off hands out the meshes themselves.
  list.autoInstanceThreshold = 0;
  list.build(scene, camera);
  assert.equal(list.opaque.length, 100); assert.equal(list.shadowCasters.length, 100);
  assert.ok(list.opaque.every(item => meshes.includes(item.mesh)));
  assert.deepEqual(list.instancing, {batches: 0, meshes: 0});
});

test('meshes an instanced draw could not reproduce stay on their own', () => {
  const box = createBoxGeometry3D({}), paint = createStandardMaterial3D({}), glass = createGlassMaterial3D({});
  const {scene, camera, meshes} = crowd(60, i => i === 5 ? new Sprite3D() : new Mesh3D(box, i >= 50 ? glass : paint));
  meshes[1].setScale(-1, 1, 1);                 // mirrored: the winding flips
  meshes[2].receiveShadow = !meshes[0].receiveShadow;   // lit differently
  meshes[3].layers = 4; camera.layerMask = 5;   // selected differently by masks and outlines
  meshes[4].renderOrder = 2;                    // drawn at another time
  assert.equal(meshes[0].canInstance, true); assert.equal(meshes[5].canInstance, false);
  scene.updateWorldMatrices();
  assert.equal(meshes[1].canInstance, false);
  const list = new RenderList3D();
  list.build(scene, camera);
  const folded = list.opaque.filter(item => item.mesh instanceof InstancedMesh3D), alone = list.opaque.filter(item => !(item.mesh instanceof InstancedMesh3D)).map(item => item.mesh);
  assert.equal(folded.length, 1); assert.equal(folded[0].mesh.count, 45);
  assert.deepEqual(new Set(alone), new Set([meshes[1], meshes[2], meshes[3], meshes[4]]));
  // See-through and blended meshes are never folded: they are sorted by depth one by one.
  assert.equal(list.transparent.length, 11);
  assert.ok(list.transparent.every(item => !(item.mesh instanceof InstancedMesh3D)));
  // Fewer than the threshold stay as they are.
  list.autoInstanceThreshold = 46;
  list.build(scene, camera);
  assert.equal(list.opaque.filter(item => item.mesh instanceof InstancedMesh3D).length, 0);
});

test('a still scene is not rewritten, and a moved or hidden mesh shows up at once', () => {
  const box = createBoxGeometry3D({}), paint = createStandardMaterial3D({});
  const {scene, camera, meshes} = crowd(40, () => new Mesh3D(box, paint));
  const list = new RenderList3D();
  list.build(scene, camera);
  const stand = list.opaque[0].mesh, version = stand.instanceVersion, order = [...stand.instanceMatrices.subarray(0, 40 * 16)];
  list.build(scene, camera); list.build(scene, camera);
  assert.equal(list.opaque[0].mesh, stand);
  // Nothing moved: the instance data is not written again, so the backend uploads nothing.
  assert.equal(stand.instanceVersion, version);
  assert.deepEqual([...stand.instanceMatrices.subarray(0, 40 * 16)], order);
  meshes[7].setPosition(1, 5, 1);
  list.build(scene, camera);
  assert.ok(stand.instanceVersion > version);
  let found = false;
  for (let k = 0; k < stand.count; k++) if (stand.instanceMatrices[k * 16 + 13] === 5) found = true;
  assert.ok(found);
  meshes[8].visible = false;
  list.build(scene, camera);
  assert.equal(list.opaque[0].mesh.count, 39);
  // A material swap regroups: the kept order is given up when the items differ.
  const other = createStandardMaterial3D({});
  for (let i = 20; i < 40; i++) meshes[i].material = other;
  list.build(scene, camera);
  assert.deepEqual(list.opaque.map(item => item.mesh.count).sort((a, b) => a - b), [19, 20]);
  // Turning the camera away empties the list; turning back restores it.
  camera.lookAt(0, 30, 200); list.build(scene, camera);
  assert.equal(list.opaque.length, 0);
  camera.lookAt(0, 0, 0); list.build(scene, camera);
  assert.equal(list.opaque.length, 2);
  list.clear();
  assert.equal(list.opaque.length, 0);
});

test('the picking hierarchy finds what a search of every triangle finds', () => {
  const geometry = createSphereGeometry3D({radius: 2, widthSegments: 64, heightSegments: 48}), scene = new Scene3D();
  const mesh = new Mesh3D(geometry, createStandardMaterial3D({side: 'double'}));
  mesh.setPosition(1, 2, 3).setRotation(0.3, 0.8, 0.1).setScale(1.5);
  scene.addChild(mesh); scene.updateWorldMatrices();
  // The reference: the same triangles in the physics mesh shape, which keeps its own, separate hierarchy.
  const positions = geometry.getAttribute('position').data, index = geometry.index.data, world = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) { const p = mesh.localToWorld([0, 0, 0], [positions[i], positions[i + 1], positions[i + 2]]); world.set(p, i); }
  const shape = new TriangleMeshShape3D(world, index), ray = new Raycaster3D(), normal = [0, 0, 0];
  let seed = 7, hitsSeen = 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 300; i++) {
    const origin = [1 + (random() - 0.5) * 16, 2 + (random() - 0.5) * 16, 3 + (random() - 0.5) * 16], aim = [1 + (random() - 0.5) * 5, 2 + (random() - 0.5) * 5, 3 + (random() - 0.5) * 5];
    const length = Math.hypot(aim[0] - origin[0], aim[1] - origin[1], aim[2] - origin[2]), direction = aim.map((v, k) => (v - origin[k]) / length);
    ray.set(origin, direction);
    const hits = ray.intersect(scene), expected = shape.raycast(origin[0], origin[1], origin[2], direction[0], direction[1], direction[2], 1000, normal);
    // The shape reports front faces only, which from outside the sphere is the nearest hit.
    if (Math.hypot(origin[0] - 1, origin[1] - 2, origin[2] - 3) > 3.1) {
      if (expected < 0) assert.equal(hits.length, 0);
      else { assert.ok(hits.length >= 1); close(hits[0].distance, expected, 1e-3); hitsSeen++; assert.ok(hits.length <= 2); }
    }
    for (let k = 1; k < hits.length; k++) assert.ok(hits[k].distance >= hits[k - 1].distance);
    // The nearest-only search agrees with the full one.
    const nearest = ray.intersect(scene, {firstHitOnly: true});
    assert.equal(nearest.length, hits.length ? 1 : 0);
    if (hits.length) { close(nearest[0].distance, hits[0].distance, 1e-6); assert.ok(nearest[0].uv); }
  }
  assert.ok(hitsSeen > 50);
  // Rays along an axis, and after the geometry is edited in place.
  ray.set([1, 50, 3], [0, -1, 0]);
  close(ray.intersect(scene)[0].distance, 50 - 2 - 3, 0.02);
  for (let i = 0; i < positions.length; i++) positions[i] *= 0.5;
  geometry.getAttribute('position').touch(); geometry.invalidateBounds();
  close(ray.intersect(scene)[0].distance, 50 - 2 - 1.5, 0.02);
});

test('the skeleton update matches a plain matrix product', () => {
  const root = new Object3D(), bones = [];
  root.setPosition(3, 1, -2).setRotation(0.4, 0.2, 0.9).setScale(1.3);
  let parent = root;
  for (let i = 0; i < 12; i++) { const bone = new Bone3D(); bone.setPosition(0.2 * i, 0.5, -0.1 * i).setRotation(i * 0.2, 0.1, -i * 0.3); parent.addChild(bone); bones.push(bone); if (i % 3) parent = bone; }
  root.updateWorldMatrices();
  const skeleton = new Skeleton3D(bones);
  for (const [i, bone] of bones.entries()) bone.setRotation(i * 0.5, 0.7, 0.2).setScale(1 + i * 0.05, 1, 1);
  root.updateWorldMatrices();
  skeleton.update(1);
  const expected = new Float32Array(16);
  for (let i = 0; i < bones.length; i++) {
    mat4Multiply(expected, bones[i].matrixWorld, skeleton.inverseBindMatrices.subarray(i * 16, i * 16 + 16));
    for (let k = 0; k < 16; k++) close(skeleton.boneMatrices[i * 16 + k], expected[k], 1e-5);
  }
  const version = skeleton.version;
  skeleton.update(1); assert.equal(skeleton.version, version);
  skeleton.update(2); assert.equal(skeleton.version, version + 1);
});
