// SPDX-License-Identifier: Apache-2.0
// Public behavior of the World3D curve, outline, geometry, helper, HDR and
// material additions that need no GPU.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Attribute3D, CatmullRomCurve3D, CubicBezierCurve3D, CurvePath3D, LineCurve3D, Mesh3D, Object3D, Path2D3D, Shape3D, World3DError,
  computeObjectBounds3D, createArrowHelper3D, createBoxGeometry3D, createBoxHelper3D, createCameraHelper3D, createCircleGeometry3D,
  createCubeTextureFromEquirect3D, createCustomShader3D, createDirectionalLight3D, createDodecahedronGeometry3D, createEdgesGeometry3D,
  createExtrudeGeometry3D, createIcosahedronGeometry3D, createLambertMaterial3D, createLatheGeometry3D, createLightHelper3D,
  createMatcapMaterial3D, createOctahedronGeometry3D, createPerspectiveCamera3D, createPointLight3D, createRingGeometry3D,
  createShapeGeometry3D, createSolidTexture3D, createStandardMaterial3D, createTetrahedronGeometry3D, createToonMaterial3D,
  createTorusKnotGeometry3D, createTubeGeometry3D, createWireframeGeometry3D, mergeGeometries3D, mergeVertices3D, parseRgbe3D,
  toNonIndexedGeometry3D, transformGeometry3D, triangulateShape3D, createBatchedMesh3D, createFatLine3D, createGlassMaterial3D,
  createConvexHullShape3D, createMeshShape3D, createPhysicsWorld3D, createSphereGeometry3D,
} from '@egret/engine/world3d';

const code = value => error => error instanceof World3DError && error.code === value;
const close = (actual, expected, epsilon = 1e-3) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
/** Signed volume and the share of triangles whose winding agrees with the stored normals. */
function measure(geometry) {
  const p = geometry.getAttribute('position').data, n = geometry.getAttribute('normal').data;
  const index = geometry.index ? geometry.index.data : Array.from({length: p.length / 3}, (_, i) => i);
  let agree = 0, total = 0, volume = 0, area = 0;
  for (let i = 0; i < index.length; i += 3) {
    const [a, b, c] = [index[i], index[i + 1], index[i + 2]].map(k => [p[k * 3], p[k * 3 + 1], p[k * 3 + 2]]);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], size = Math.hypot(...f);
    if (size < 1e-12) continue;
    total++; area += size / 2;
    const k = index[i];
    if (f[0] * n[k * 3] + f[1] * n[k * 3 + 1] + f[2] * n[k * 3 + 2] > 0) agree++;
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return {agree: agree / total, volume, area, triangles: total};
}

test('curves answer positions, lengths and twist-free frames', () => {
  const line = new LineCurve3D([0, 0, 0], [3, 4, 0]);
  close(line.getLength(), 5);
  assert.deepEqual(line.getPointAt(0.5).map(v => +v.toFixed(3)), [1.5, 2, 0]);
  const bezier = new CubicBezierCurve3D([0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]);
  assert.deepEqual(bezier.getPoint(0.5).map(v => +v.toFixed(3)), [0.5, 0.75, 0]);
  const spline = new CatmullRomCurve3D([[0, 0, 0], [1, 1, 0], [2, 0, 1], [3, 1, 0]]);
  assert.deepEqual(spline.getPoint(1 / 3).map(v => +v.toFixed(3)), [1, 1, 0], 'passes through control points');
  const spaced = spline.getSpacedPoints(8), gaps = spaced.slice(1).map((p, i) => Math.hypot(p[0] - spaced[i][0], p[1] - spaced[i][1], p[2] - spaced[i][2]));
  assert.ok(Math.max(...gaps) / Math.min(...gaps) < 1.15, 'near-equal spacing by distance');
  const frames = spline.computeFrames(16);
  frames.normals.forEach((normal, i) => close(normal[0] * frames.tangents[i][0] + normal[1] * frames.tangents[i][1] + normal[2] * frames.tangents[i][2], 0, 1e-6));
  const path = new CurvePath3D().add(line).add(new LineCurve3D([3, 4, 0], [3, 4, 5]));
  close(path.getLength(), 10, 0.01);
  assert.deepEqual(path.getPoint(0.75).map(v => +v.toFixed(2)), [3, 4, 2.5]);
  assert.throws(() => new CatmullRomCurve3D([[0, 0, 0]]), code('WORLD3D_INPUT_INVALID'));
});

test('outlines triangulate with holes and curved commands', () => {
  const square = new Shape3D([[0, 0], [2, 0], [2, 2], [0, 2]]);
  const hole = new Path2D3D().moveTo(0.5, 0.5).lineTo(1.5, 0.5).lineTo(1.5, 1.5).lineTo(0.5, 1.5);
  square.holes.push(hole);
  const flat = measure(createShapeGeometry3D(square));
  close(flat.area, 3);
  assert.equal(flat.agree, 1);
  const disc = new Shape3D(); disc.moveTo(1, 0).arc(0, 0, 1, 0, Math.PI * 2);
  close(measure(createShapeGeometry3D(disc)).area, Math.PI, 0.03);
  const {indices} = triangulateShape3D([[0, 0], [0, 1], [1, 1], [1, 0]]);
  assert.equal(indices.length, 6, 'clockwise input is accepted');
  assert.throws(() => new Path2D3D().quadraticCurveTo(0, 0, 1, 1), code('WORLD3D_INPUT_INVALID'));
});

test('procedural solids are closed, outward facing and correctly sized', () => {
  const solids = {
    tetrahedron: createTetrahedronGeometry3D({radius: 1}), octahedron: createOctahedronGeometry3D({radius: 1}), dodecahedron: createDodecahedronGeometry3D({radius: 1}),
    icosphere: createIcosahedronGeometry3D({radius: 1, detail: 3}), knot: createTorusKnotGeometry3D({}), lathe: createLatheGeometry3D([[0, 0], [0.5, 0], [0.5, 1], [0, 1]]),
    tube: createTubeGeometry3D(new LineCurve3D([0, 0, 0], [0, 0, 2]), {radius: 0.5, radialSegments: 32}),
    extrude: createExtrudeGeometry3D(new Shape3D([[0, 0], [2, 0], [2, 1], [0, 1]]), {depth: 3}),
  };
  for (const [name, geometry] of Object.entries(solids)) assert.equal(measure(geometry).agree, 1, name + ' winding');
  close(measure(solids.octahedron).volume, 4 / 3, 1e-3);
  close(measure(solids.icosphere).volume, 4 / 3 * Math.PI, 0.2);
  close(measure(solids.lathe).volume, Math.PI * 0.25, 0.02);
  close(measure(solids.extrude).volume, 6, 1e-3);
  assert.deepEqual(solids.extrude.groups.map(group => group.materialIndex), [0, 1], 'caps and walls are separate groups');
  close(measure(createCircleGeometry3D({radius: 1, segments: 64})).area, Math.PI, 0.01);
  close(measure(createRingGeometry3D({innerRadius: 1, outerRadius: 2, thetaSegments: 64})).area, 3 * Math.PI, 0.03);
  const swept = createExtrudeGeometry3D(new Shape3D([[-0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1]]), {path: new LineCurve3D([0, 0, 0], [5, 0, 0]), steps: 4});
  close(measure(swept).volume, 0.2, 1e-3);
});

test('geometry utilities derive edges and merge, weld and transform data', () => {
  const box = createBoxGeometry3D({});
  assert.equal(createEdgesGeometry3D(box).getAttribute('position').count, 24, 'twelve outline edges');
  assert.equal(createWireframeGeometry3D(box).topology, 'lines');
  const moved = transformGeometry3D(createBoxGeometry3D({}), [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 0, 0, 1]);
  assert.deepEqual([...moved.boundingBox].map(v => +v.toFixed(3)), [2, -0.5, -0.5, 4, 0.5, 0.5]);
  const merged = mergeGeometries3D([box, moved], true);
  assert.equal(merged.getAttribute('position').count, 48);
  assert.equal(merged.groups.length, 2);
  close(measure(merged).volume, 3);
  const soup = toNonIndexedGeometry3D(box);
  assert.equal(soup.index, undefined);
  assert.equal(soup.getAttribute('position').count, 36);
  assert.equal(mergeVertices3D(soup).getAttribute('position').count, 24);
  assert.throws(() => mergeGeometries3D([box, createWireframeGeometry3D(box)]), code('WORLD3D_INPUT_INVALID'));
});

test('helpers follow bounds, cameras, lights and directions', () => {
  const root = new Object3D(), mesh = new Mesh3D(createBoxGeometry3D({}), createLambertMaterial3D({}));
  mesh.setPosition(2, 0, 0); root.addChild(mesh);
  assert.deepEqual([...computeObjectBounds3D(root)], [1.5, -0.5, -0.5, 2.5, 0.5, 0.5]);
  const helper = createBoxHelper3D(root);
  root.addChild(helper);
  mesh.setPosition(0, 4, 0); helper.update();
  assert.deepEqual([...computeObjectBounds3D(root)], [-0.5, 3.5, -0.5, 0.5, 4.5, 0.5], 'helpers do not count toward bounds');
  assert.deepEqual([...helper.geometry.boundingBox], [-0.5, 3.5, -0.5, 0.5, 4.5, 0.5]);
  const camera = createPerspectiveCamera3D({fov: 60, aspect: 1, near: 1, far: 10});
  const frustum = createCameraHelper3D(camera).geometry.boundingBox;
  close(frustum[2], -10, 1e-3); close(frustum[5], -1, 1e-3);
  assert.equal(createLightHelper3D(createDirectionalLight3D({})).geometry.topology, 'lines');
  assert.equal(createLightHelper3D(createPointLight3D({range: 3})).geometry.boundingSphere[3] > 2.9, true);
  const arrow = createArrowHelper3D([0, 0, 2], [1, 1, 1], 3);
  close(arrow.geometry.boundingBox[5], 4);
  helper.dispose();
  assert.equal(helper.geometry.isDisposed, true);
});

test('Radiance HDR files decode and convert to cube textures', () => {
  const header = '#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 2 +X 8\n';
  // One run-length scanline (each channel as a single run) and one of literal values.
  const rle = [2, 2, 0, 8, 128 + 8, 128, 128 + 8, 64, 128 + 8, 32, 128 + 8, 129];
  const literal = [2, 2, 0, 8, ...[200, 100, 50, 128].flatMap(value => [8, ...new Array(8).fill(value)])];
  const bytes = new Uint8Array([...new TextEncoder().encode(header), ...rle, ...literal]);
  const image = parseRgbe3D(bytes);
  assert.deepEqual([image.width, image.height, image.data.length], [8, 2, 48]);
  close(image.data[0], 1); close(image.data[1], 0.5); close(image.data[2], 0.25);
  close(image.data[24], 200 / 256, 1e-3);
  const cube = createCubeTextureFromEquirect3D(image, {size: 8});
  assert.equal(cube.faces.length, 6);
  assert.equal(cube.faces[2].data[(4 * 8 + 4) * 4], 255, 'the top face comes from the bright first row');
  assert.throws(() => parseRgbe3D(new Uint8Array(10)), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => parseRgbe3D(bytes.subarray(0, bytes.length - 4)), code('WORLD3D_INPUT_INVALID'));
});

test('toon, matcap, clearcoat and custom shaders are ordinary materials', () => {
  const toon = createToonMaterial3D({color: 0xff0000, steps: 4});
  assert.deepEqual([toon.shading, toon.toonSteps], ['toon', 4]);
  const image = createSolidTexture3D([255, 255, 255, 255]);
  const matcap = createMatcapMaterial3D({matcap: image});
  assert.deepEqual([matcap.shading, matcap.emissiveMap === image], ['matcap', true]);
  const paint = createStandardMaterial3D({});
  paint.clearcoat = 1;
  assert.equal(paint.clone().clearcoat, 1);
  const shader = createCustomShader3D({key: 'fade', glsl: 'vec4 customFragment(vec4 c, vec3 p, vec3 n, vec2 uv) { return c * uCustom[0]; }', uniforms: [1, 1, 1, 0.5]});
  assert.equal(shader.uniforms.length, 16);
  assert.equal(shader.uniforms[3], 0.5);
  paint.shader = shader;
  assert.equal(paint.clone().shader, shader);
  assert.throws(() => createCustomShader3D({key: 'bad key', glsl: ''}), code('WORLD3D_INPUT_INVALID'));
  assert.throws(() => createCustomShader3D({key: 'empty'}), code('WORLD3D_INPUT_INVALID'));
});

test('light maps, sheen and glass are plain material settings', () => {
  const baked = createLambertMaterial3D({});
  const image = createSolidTexture3D([255, 255, 255, 255]);
  image.channel = 1;
  baked.lightMap = image; baked.lightMapIntensity = 2;
  const copy = baked.clone();
  assert.deepEqual([copy.lightMap === image, copy.lightMapIntensity], [true, 2]);
  const velvet = createStandardMaterial3D({});
  velvet.sheen = 1; velvet.sheenColor.set([1, 0.5, 0.25]);
  const twin = velvet.clone();
  assert.deepEqual([...twin.sheenColor], [1, 0.5, 0.25]);
  assert.notEqual(twin.sheenColor, velvet.sheenColor, 'colors are copied, not shared');
  const glass = createGlassMaterial3D({});
  assert.deepEqual([glass.shading, glass.alphaMode, glass.blending, glass.depthWrite, glass.transmission, glass.isTransparent], ['standard', 'blend', 'premultiplied', false, 0.9, true]);
});

test('a batch draws many geometries as one and tracks per-item changes', () => {
  const batch = createBatchedMesh3D(createLambertMaterial3D({}));
  const move = (x, scale = 1) => [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, x, 0, 0, 1];
  const box = batch.addGeometry(createBoxGeometry3D({}), move(-2)), ball = batch.addGeometry(createSphereGeometry3D({radius: 0.5}), move(2));
  batch.beforeRender();
  const boxVertices = 24, ballVertices = createSphereGeometry3D({radius: 0.5}).getAttribute('position').count;
  assert.equal(batch.geometry.getAttribute('position').count, boxVertices + ballVertices);
  assert.deepEqual([...batch.geometry.boundingBox].map(v => +v.toFixed(2)), [-2.5, -0.5, -0.5, 2.5, 0.5, 0.5]);
  batch.setMatrixAt(box, move(-6, 2)).flush();
  close(batch.geometry.boundingBox[0], -7);
  batch.setVisibleAt(ball, false).flush();
  assert.equal(batch.geometry.getAttribute('position').count, boxVertices);
  batch.setColorAt(box, 1, 0, 0).flush();
  assert.deepEqual([...batch.geometry.getAttribute('color').data.subarray(0, 3)], [1, 0, 0]);
  // A mirrored item keeps outward faces.
  const mirrored = createBatchedMesh3D(createLambertMaterial3D({}));
  mirrored.addGeometry(createBoxGeometry3D({}), [-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  mirrored.flush();
  assert.equal(measure(mirrored.geometry).agree, 1);
  batch.deleteGeometry(box).flush();
  assert.equal(batch.itemCount, 1);
  assert.throws(() => batch.setMatrixAt(box, move(0)), code('WORLD3D_INPUT_INVALID'));
});

test('a fat line builds a camera-facing ribbon of the requested width', () => {
  const line = createFatLine3D([[-1, 0, 0], [1, 0, 0]], {width: 0.2});
  const camera = createPerspectiveCamera3D({fov: 60, aspect: 1, near: 0.1, far: 100});
  camera.setPosition(0, 0, 5); camera.updateViewMatrices();
  line.updateWorldMatrices();
  line.beforeRender(camera);
  const p = line.geometry.getAttribute('position').data;
  // Seen from +Z, a line along X widens along Y: each point becomes a pair 0.2 apart.
  assert.deepEqual([p[0], p[3], p[6], p[9]].map(v => +v.toFixed(3)), [-1, -1, 1, 1]);
  close(Math.abs(p[1] - p[4]), 0.2, 1e-5); close(p[1] + p[4], 0, 1e-5);
  close(p[2], 0, 1e-5); close(p[5], 0, 1e-5);
  assert.equal(line.geometry.index.count, 6);
  // Screen-space width: 10 pixels of a 100 pixel tall view, 5 units away.
  line.screenSpace = true; line.width = 10; line.resolutionHeight = 100;
  line.beforeRender(camera);
  close(Math.abs(p[1] - p[4]), 10 * 2 * Math.tan(Math.PI / 6) * 5 / 100, 1e-3);
  const loop = createFatLine3D([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], {closed: true});
  assert.equal(loop.geometry.index.count, 24);
  assert.throws(() => createFatLine3D([[0, 0, 0]]), code('WORLD3D_INPUT_INVALID'));
});

test('joints hold bodies together as pivots, hinges, welds, rods and ropes', () => {
  const world = createPhysicsWorld3D({allowSleep: false});
  const bob = world.createBody({shape: {type: 'sphere', radius: 0.2}, position: [2, 5, 0], linearDamping: 0, angularDamping: 0});
  world.createJoint({type: 'distance', bodyA: bob, anchor: [2, 5, 0], anchorB: [0, 5, 0]});
  const door = world.createBody({shape: {type: 'box', halfExtents: [0.5, 1, 0.05]}, position: [10.5, 1, 0]});
  world.createJoint({type: 'hinge', bodyA: door, anchor: [10, 1, 0], axis: [0, 1, 0]});
  door.applyImpulse(0, 0, 3, [11, 1, 0]);
  const hanging = world.createBody({shape: {type: 'sphere', radius: 0.2}, position: [20, 4.5, 0]});
  world.createJoint({type: 'distance', bodyA: hanging, anchor: [20, 4.5, 0], anchorB: [20, 5, 0], length: 2, rope: true});
  const left = world.createBody({shape: {type: 'box', halfExtents: [0.5, 0.5, 0.5]}, position: [30, 3, 0]}), right = world.createBody({shape: {type: 'box', halfExtents: [0.5, 0.5, 0.5]}, position: [31.5, 3, 0]});
  const weld = world.createJoint({type: 'fixed', bodyA: left, bodyB: right});
  let lowest = 9, longest = 0;
  for (let i = 0; i < 300; i++) {
    world.step(1 / 60);
    lowest = Math.min(lowest, bob.position[1]); longest = Math.max(longest, Math.hypot(bob.position[0], bob.position[1] - 5));
  }
  close(lowest, 3, 0.05); close(longest, 2, 0.03);                        // a rod swings on a circle
  close(door.position[1], 1, 0.01); close(door.rotation[4], 1, 1e-3);     // a hinge keeps the door upright
  close(Math.hypot(door.position[0] - 10, door.position[2]), 0.5, 0.03);
  assert.ok(Math.abs(door.position[2]) > 0.05, 'and lets it swing');
  close(hanging.position[1], 3, 0.02);                                    // a rope stops the fall at its length
  close(right.position[0] - left.position[0], 1.5, 0.01);                 // a weld falls as one piece
  close(right.position[1], left.position[1], 0.01);
  assert.equal(world.joints.length, 4);
  world.removeJoint(weld);
  world.removeBody(bob);
  assert.equal(world.joints.length, 2, 'removing a body removes its joints');
  assert.throws(() => world.createJoint({type: 'point', bodyA: bob}), code('WORLD3D_INPUT_INVALID'));
});

test('convex hulls and moving mesh platforms collide', () => {
  const hull = createConvexHullShape3D(createIcosahedronGeometry3D({radius: 0.6}));
  assert.deepEqual([hull.points.length / 3, hull.planes.length / 4], [12, 20]);
  close(hull.radius, 0.6, 1e-3);
  assert.throws(() => createConvexHullShape3D([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), code('WORLD3D_INPUT_INVALID'));
  const world = createPhysicsWorld3D();
  world.createBody({shape: {type: 'plane'}});
  const rock = world.createBody({shape: {type: 'convex', hull}, position: [0, 3, 0], quaternion: [0.2, 0.1, 0.3, 0.927]});
  const wedge = world.createBody({type: 'static', shape: {type: 'convex', hull: createConvexHullShape3D([-1, -0.5, -1, 1, -0.5, -1, 1, -0.5, 1, -1, -0.5, 1, -1, 0.5, -1, -1, 0.5, 1])}, position: [5, 0.5, 0]});
  const ball = world.createBody({shape: {type: 'sphere', radius: 0.3}, position: [4.5, 3, 0]});
  const lift = world.createBody({type: 'kinematic', shape: {type: 'mesh', mesh: createMeshShape3D(createBoxGeometry3D({width: 4, height: 0.2, depth: 4}))}, position: [20, 0, 0]}).setLinearVelocity(0, 1, 0);
  const rider = world.createBody({shape: {type: 'sphere', radius: 0.3}, position: [20, 1, 0]});
  for (let i = 0; i < 180; i++) world.step(1 / 60);
  close(rider.position[1], lift.position[1] + 0.4, 0.03);                 // carried up by the platform
  assert.ok(ball.position[0] > 6, 'the ball rolled down and off the wedge');
  for (let i = 0; i < 300; i++) world.step(1 / 60);
  close(rock.position[1], 0.477, 0.02);                                   // resting on a face: the inscribed radius
  assert.equal(rock.isSleeping, true);
  const hit = world.raycast([5, 5, 0], [0, -1, 0]);
  assert.equal(hit.body, wedge); close(hit.distance, 4.5, 1e-3); close(hit.normal[1], 0.894, 1e-2);
  assert.throws(() => world.createBody({shape: {type: 'mesh', mesh: createMeshShape3D(createBoxGeometry3D({}))}, type: 'dynamic'}), code('WORLD3D_INPUT_INVALID'));
});
