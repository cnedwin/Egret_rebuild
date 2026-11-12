// SPDX-License-Identifier: Apache-2.0
// Everything drawn: the island and sea, the pandas, the candy horde as
// instanced meshes, the toys' shots, sprinkles, props and effects. The view
// reads the simulation each frame and turns its events into particles.
import {
  InstancedMesh3D, Mesh3D, Texture3D,
  createAmbientLight3D, createBoxGeometry3D, createCapsuleGeometry3D, createConeGeometry3D, createCylinderGeometry3D, createDirectionalLight3D,
  createGeometry3D, createGradientCubeTexture3D, createHemisphereLight3D, createOctahedronGeometry3D, createParticleEmitter3D,
  createWater3D,
  createPlaneGeometry3D, createRingGeometry3D, createSphereGeometry3D, createStandardMaterial3D, createTorusGeometry3D, createUnlitMaterial3D,
} from '@egret/engine/world3d';
import { ENEMIES, SKINS } from './data.mjs';
import { ISLAND, groundHeight } from './island.mjs';
import { buildShape, createPanda, linear } from './panda.mjs';

const rgb = (hex) => [linear((hex >> 16 & 255) / 255), linear((hex >> 8 & 255) / 255), linear((hex & 255) / 255)];
const lin = (color) => color.map(linear);
const quat = [0, 0, 0, 1], position = [0, 0, 0], scale = [1, 1, 1];
const yawQuat = (angle) => { quat[0] = 0; quat[1] = Math.sin(angle / 2); quat[2] = 0; quat[3] = Math.cos(angle / 2); return quat; };
const IDENTITY = [0, 0, 0, 1];

// Shared low-detail primitives the shapes below are assembled from.
const sphere = createSphereGeometry3D({ radius: 1, widthSegments: 12, heightSegments: 8 });
const fineSphere = createSphereGeometry3D({ radius: 1, widthSegments: 20, heightSegments: 12 });
const cylinder = createCylinderGeometry3D({ radiusTop: 1, radiusBottom: 1, height: 1, radialSegments: 14 });
const cone = createConeGeometry3D({ radius: 1, height: 1, radialSegments: 12 });
const box = createBoxGeometry3D({ width: 1, height: 1, depth: 1 });
const torus = createTorusGeometry3D({ radius: 1, tube: 0.42, radialSegments: 10, tubularSegments: 20 });
const WHITE = [1, 1, 1], DARK = [0.06, 0.06, 0.09], PINK = [1, 0.55, 0.65];
/** Two eyes on a face that looks along +Z. */
const eyes = (y, z, gap, size) => [
  [sphere, [-gap, y, z], [size, size * 1.2, size * 0.6], WHITE], [sphere, [gap, y, z], [size, size * 1.2, size * 0.6], WHITE],
  [sphere, [-gap, y, z + size * 0.45], size * 0.55, DARK], [sphere, [gap, y, z + size * 0.45], size * 0.55, DARK],
];

/** One shape per candy kind, sized for a radius of 0.5 and standing on y = 0. */
function enemyShapes() {
  return {
    gumdrop: buildShape([[sphere, [0, 0.3, 0], [0.5, 0.62, 0.5], WHITE], [cylinder, [0, 0.06, 0], [0.52, 0.12, 0.52], [0.85, 0.85, 0.85]], ...eyes(0.5, 0.4, 0.17, 0.1)]),
    bean: buildShape([[createCapsuleGeometry3D({ radius: 0.5, height: 1.5, radialSegments: 10, capSegments: 4 }), [0, 0.5, 0], [0.75, 0.68, 0.62], WHITE, [0, 0, 0.35]], ...eyes(0.62, 0.3, 0.13, 0.08)]),
    corn: buildShape([[cylinder, [0, 0.16, 0], [0.5, 0.32, 0.5], [1, 0.82, 0.1]], [createCylinderGeometry3D({ radiusTop: 0.62, radiusBottom: 1, height: 1, radialSegments: 12 }), [0, 0.52, 0], [0.5, 0.4, 0.5], [1, 0.5, 0.08]], [cone, [0, 0.95, 0], [0.31, 0.46, 0.31], [1, 0.98, 0.9]], ...eyes(0.5, 0.42, 0.15, 0.09)]),
    pop: buildShape([[cylinder, [0, 0.35, 0], [0.06, 0.7, 0.06], [0.95, 0.95, 0.95]], [cylinder, [0, 1.05, 0], [0.55, 0.2, 0.55], WHITE, [Math.PI / 2, 0, 0]], [torus, [0, 1.05, 0.1], [0.3, 0.3, 0.12], [1, 1, 0.7]], ...eyes(1.1, 0.14, 0.2, 0.1)]),
    floss: buildShape([[cone, [0, 0.22, 0], [0.12, 0.5, 0.12], [0.9, 0.85, 0.7], [Math.PI, 0, 0]], [sphere, [0, 0.72, 0], 0.42, WHITE], [sphere, [0.3, 0.6, 0.05], 0.3, WHITE], [sphere, [-0.3, 0.62, 0], 0.3, WHITE], [sphere, [0.05, 1, -0.05], 0.3, WHITE], ...eyes(0.72, 0.36, 0.15, 0.09)]),
    mint: buildShape([[cylinder, [0, 0.5, 0], [0.5, 0.22, 0.5], WHITE, [Math.PI / 2, 0, 0]], ...[0, 1, 2, 3].map((i) => [box, [Math.cos(i * Math.PI / 2 + 0.4) * 0.3, 0.5 + Math.sin(i * Math.PI / 2 + 0.4) * 0.3, 0], [0.24, 0.1, 0.24], [0.9, 0.12, 0.2], [0, 0, i * Math.PI / 2 + 0.4]]), ...eyes(0.52, 0.12, 0.14, 0.09)]),
    mallow: buildShape([[cylinder, [0, 0.5, 0], [0.5, 0.78, 0.5], WHITE], [sphere, [0, 0.9, 0], [0.5, 0.16, 0.5], WHITE], [sphere, [0, 0.12, 0], [0.5, 0.16, 0.5], WHITE], ...eyes(0.6, 0.47, 0.17, 0.08), [sphere, [-0.3, 0.45, 0.42], [0.08, 0.05, 0.03], PINK], [sphere, [0.3, 0.45, 0.42], [0.08, 0.05, 0.03], PINK]]),
  };
}
/** Boss shapes, sized for a radius of 1. */
function bossShapes() {
  const candles = [0, 1, 2, 3, 4].flatMap((i) => { const a = i / 5 * 6.28; return [[cylinder, [Math.cos(a) * 0.25, 1.78, Math.sin(a) * 0.25], [0.035, 0.24, 0.035], [0.5, 0.8, 1]], [sphere, [Math.cos(a) * 0.25, 1.94, Math.sin(a) * 0.25], [0.05, 0.08, 0.05], [3, 1.6, 0.3]]]; });
  return {
    pudding: buildShape([[createCylinderGeometry3D({ radiusTop: 0.62, radiusBottom: 1, height: 1, radialSegments: 20 }), [0, 0.5, 0], [1, 1, 1], [1, 0.8, 0.35]], [cylinder, [0, 1.04, 0], [0.64, 0.1, 0.64], [0.45, 0.2, 0.05]], [sphere, [0, 1.22, 0], 0.16, [0.9, 0.05, 0.1]], ...eyes(0.62, 0.88, 0.26, 0.13)]),
    donut: buildShape([[createTorusGeometry3D({ radius: 0.68, tube: 0.34, radialSegments: 12, tubularSegments: 28 }), [0, 1, 0], [1, 1, 1], [0.86, 0.6, 0.32]], [createTorusGeometry3D({ radius: 0.68, tube: 0.3, radialSegments: 10, tubularSegments: 28 }), [0, 1, 0.1], [1, 1, 0.9], [1, 0.5, 0.72]], ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => [box, [Math.cos(i * 0.785) * 0.68, 1 + Math.sin(i * 0.785) * 0.68, 0.4], [0.16, 0.05, 0.05], [[1, 1, 0.3], [0.3, 0.9, 1], [1, 1, 1], [0.5, 1, 0.4]][i % 4], [0, 0, i * 1.3]]), ...eyes(1.72, 0.3, 0.2, 0.11)]),
    cake: buildShape([[cylinder, [0, 0.32, 0], [1, 0.64, 1], [1, 0.93, 0.8]], [cylinder, [0, 0.67, 0], [1.03, 0.1, 1.03], [1, 0.55, 0.7]], [cylinder, [0, 0.98, 0], [0.74, 0.56, 0.74], [1, 0.93, 0.8]], [cylinder, [0, 1.28, 0], [0.77, 0.09, 0.77], [0.55, 0.3, 0.15]], [cylinder, [0, 1.5, 0], [0.46, 0.4, 0.46], [1, 0.93, 0.8]], [cylinder, [0, 1.7, 0], [0.48, 0.06, 0.48], [1, 1, 1]], ...candles, ...eyes(1.0, 0.72, 0.24, 0.12)]),
  };
}

function dotTexture() {
  const size = 32, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - 15.5, y - 15.5) / 15.5, a = Math.max(0, 1 - d * d);
    data.set([255, 255, 255, 255 * a], (y * size + x) * 4);
  }
  return new Texture3D({ width: size, height: size, data });
}

export function createView(scene, options = {}) {
  const jelly = options.jelly ?? true;
  const view = { pandas: [], bossNodes: new Map(), rings: [], time: 0, shake: 0, jelly };

  // ---- sky, light, island, sea -------------------------------------------------------
  const sky = createGradientCubeTexture3D([60, 140, 250], [185, 225, 255], [70, 170, 150], 64);
  scene.background = sky; scene.environment = sky; scene.environmentIntensity = 0.45;
  scene.fog = { kind: 'linear', color: [0.5, 0.75, 1], near: 90, far: 260 };
  scene.addChild(createHemisphereLight3D({ color: 0xcfe8ff, groundColor: 0x6fae6a, intensity: 0.5 }));
  scene.addChild(createAmbientLight3D({ intensity: 0.06 }));
  const sun = createDirectionalLight3D({ color: 0xfff3d8, intensity: 1.5, castShadow: true });
  sun.setPosition(22, 34, 14).lookAt(0, 0, 0);
  Object.assign(sun.shadow, { cascades: 3, cascadeDistance: 55, mapSize: options.shadowSize ?? 2048 });
  scene.addChild(sun);

  view.attachIsland = (geometry) => {
    const island = new Mesh3D(geometry, createStandardMaterial3D({ color: 0xffffff, vertexColors: true, roughness: 0.95 }));
    island.receiveShadow = true;
    scene.addChild(island);
  };
  // The sea: the engine's water surface, with waves, a see-through shallows and an optional mirror image.
  const sea = createWater3D({ width: 520, depth: 520, segments: 104, color: 0x2f9fe6, amplitude: 0.1, wavelength: 9, clarity: 0.75, reflectionSize: options.reflectionSize ?? 512 });
  const mirror = sea.reflection?.texture;
  sea.setPosition(0, ISLAND.sea, 0);
  scene.addChild(sea);
  view.reflect = options.reflect ?? true;
  if (!view.reflect) { sea.material.reflectionMap = undefined; sea.material.touch(); }
  /** Draw the mirror image the water shows; call before the main view is drawn. */
  view.renderReflection = (renderer, camera) => { if (view.reflect && mirror) sea.renderReflection(renderer, scene, camera); };
  const seaBed = new Mesh3D(createPlaneGeometry3D({ width: 600, height: 600 }), createUnlitMaterial3D({ color: 0x1b6fb8 }));
  seaBed.setRotation(-Math.PI / 2, 0, 0); seaBed.setPosition(0, -4.6, 0);
  scene.addChild(seaBed);

  // Palms, bamboo and toy blocks along the shore, each kind drawn in one call.
  const palmShape = buildShape([[cylinder, [0, 1.6, 0], [0.16, 3.2, 0.16], [0.62, 0.45, 0.28]], ...[0, 1, 2, 3, 4, 5].map((i) => [cone, [Math.cos(i * 1.05) * 0.9, 3.25, Math.sin(i * 1.05) * 0.9], [0.32, 2, 0.12], [0.2, 0.72, 0.3], [Math.sin(i * 1.05) * 1.25, 0, -Math.cos(i * 1.05) * 1.25]]), [sphere, [0.2, 3.05, 0.1], 0.2, [0.5, 0.32, 0.16]]]);
  const bambooShape = buildShape([0, 1, 2, 3, 4].flatMap((i) => { const x = Math.cos(i * 2.4) * 0.35, z = Math.sin(i * 2.4) * 0.35, h = 2.4 + (i % 3) * 0.7; return [[cylinder, [x, h / 2, z], [0.07, h, 0.07], [0.45, 0.78, 0.3]], [cone, [x + 0.2, h * 0.8, z], [0.08, 0.7, 0.2], [0.3, 0.68, 0.25], [0, i, 1.2]], [cone, [x - 0.2, h * 0.62, z], [0.08, 0.6, 0.2], [0.3, 0.68, 0.25], [0, i, -1.2]]]; }));
  const blockShape = buildShape([[box, [0, 0.5, 0], [1, 1, 1], WHITE], [box, [0, 1.3, 0], [0.6, 0.6, 0.6], [1, 0.9, 0.6]]]);
  const decor = (shape, count, place, tint) => {
    const mesh = new InstancedMesh3D(shape, createStandardMaterial3D({ color: 0xffffff, vertexColors: true, roughness: 0.8 }), count);
    mesh.castShadow = true; mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) { const [x, z, size, turn] = place(i); mesh.setTransformAt(i, [x, groundHeight(x, z) - 0.05, z], yawQuat(turn), size); if (tint) mesh.setColorAt(i, ...tint(i)); }
    mesh.count = count;
    scene.addChild(mesh);
  };
  const shore = (i, count, reach, phase) => { const a = i / count * 6.283 + phase, r = reach + Math.sin(i * 7.3) * 1.2; return [Math.cos(a) * r, Math.sin(a) * r]; };
  decor(palmShape, 11, (i) => [...shore(i, 11, 37.2, 0.3), 0.9 + (i % 3) * 0.18, i * 1.7]);
  decor(bambooShape, 9, (i) => [...shore(i, 9, 36.6, 1.1), 1 + (i % 2) * 0.3, i * 2.1]);
  const blockColors = [[1, 0.4, 0.4], [0.4, 0.7, 1], [1, 0.85, 0.3], [0.5, 0.9, 0.5], [0.85, 0.55, 1]].map(lin);
  decor(blockShape, 10, (i) => [...shore(i, 10, 38, 2.0), 0.9 + (i % 3) * 0.35, i * 0.9], (i) => blockColors[i % 5]);

  // ---- candy horde: one instanced mesh per kind -------------------------------------------
  const shapes = enemyShapes(), bosses = bossShapes();
  const hordeMaterial = createStandardMaterial3D({ color: 0xffffff, vertexColors: true, roughness: 0.35 });
  const horde = ENEMIES.map((def) => {
    const mesh = new InstancedMesh3D(shapes[def.key], hordeMaterial, 320);
    mesh.castShadow = true; mesh.frustumCulled = false; mesh.count = 0; mesh.setColorAt(0, 1, 1, 1);
    scene.addChild(mesh);
    return { mesh, tint: rgb(def.color), def };
  });
  const crownShape = buildShape([[cylinder, [0, 0.08, 0], [0.3, 0.16, 0.3], [1, 0.82, 0.15]], ...[0, 1, 2, 3, 4].map((i) => [cone, [Math.cos(i * 1.257) * 0.26, 0.28, Math.sin(i * 1.257) * 0.26], [0.08, 0.26, 0.08], [1, 0.9, 0.3]])]);
  const instanced = (geometry, material, capacity, shadow = false) => {
    const mesh = new InstancedMesh3D(geometry, material, capacity);
    mesh.castShadow = shadow; mesh.frustumCulled = false; mesh.count = 0; mesh.setColorAt(0, 1, 1, 1);
    scene.addChild(mesh);
    return mesh;
  };
  const glossy = createStandardMaterial3D({ color: 0xffffff, vertexColors: true, roughness: 0.3 });
  const plain = createStandardMaterial3D({ color: 0xffffff, roughness: 0.3 });
  const crowns = instanced(crownShape, createStandardMaterial3D({ color: 0xffffff, vertexColors: true, roughness: 0.25, metallic: 0.6 }), 24);

  // ---- shots, sprinkles and pickups -------------------------------------------------------
  const balls = instanced(sphere, plain, 900, true);
  const bubbleMaterial = createStandardMaterial3D({ color: 0xcdefff, roughness: 0.05, opacity: 0.38, alphaMode: 'blend', depthWrite: false });
  bubbleMaterial.setEmissive([0.5, 0.8, 1]); bubbleMaterial.emissiveIntensity = 0.25;
  const bubbles = instanced(fineSphere, bubbleMaterial, 64);
  const puddleGeometry = createRingGeometry3D({ innerRadius: 0, outerRadius: 1, thetaSegments: 24 });
  const puddles = instanced(puddleGeometry, createUnlitMaterial3D({ color: 0xffffff, opacity: 0.55, alphaMode: 'blend', depthWrite: false, side: 'double' }), 64);
  const teethShape = buildShape([[box, [0, 0.36, 0], [0.9, 0.22, 0.7], [1, 0.35, 0.4]], [box, [0, 0.1, 0], [0.9, 0.2, 0.7], [1, 0.35, 0.4]], ...[-0.3, 0, 0.3].flatMap((x) => [[box, [x, 0.25, 0.3], [0.2, 0.12, 0.12], WHITE], [box, [x, 0.21, 0.3], [0.2, 0.1, 0.12], WHITE]]), [cylinder, [0.5, 0.24, -0.1], [0.06, 0.2, 0.06], [0.8, 0.8, 0.85], [0, 0, Math.PI / 2]]]);
  const chompers = instanced(teethShape, glossy, 64, true);
  const boxShape = buildShape([[box, [0, 0.35, 0], [0.8, 0.7, 0.8], [0.95, 0.3, 0.4]], [box, [0, 0.35, 0], [0.84, 0.72, 0.2], [1, 0.9, 0.3]], [box, [0, 0.35, 0], [0.2, 0.72, 0.84], [1, 0.9, 0.3]], [sphere, [0, 0.78, 0], 0.14, [1, 0.9, 0.3]]]);
  const boxes = instanced(boxShape, glossy, 48, true);
  const topShape = buildShape([[cone, [0, 0.45, 0], [0.9, 0.9, 0.9], [0.3, 0.75, 1], [Math.PI, 0, 0]], [cylinder, [0, 0.98, 0], [0.92, 0.16, 0.92], [1, 0.8, 0.2]], [cylinder, [0, 1.25, 0], [0.12, 0.4, 0.12], [0.9, 0.3, 0.3]]]);
  const tops = instanced(topShape, glossy, 48, true);
  const gems = instanced(createOctahedronGeometry3D({ radius: 0.2 }), createStandardMaterial3D({ color: 0xffffff, roughness: 0.2, flatShading: true }), 560);
  gems.material.setEmissive([1, 1, 1]); gems.material.emissiveIntensity = 0.15;
  const heartShape = buildShape([[cone, [0, 0.5, 0], [0.3, 1, 0.3], [0.95, 0.9, 0.6]], [cone, [0, 0.42, 0], [0.34, 0.5, 0.34], [0.5, 0.8, 0.35]], [cone, [0.08, 0.28, 0], [0.36, 0.34, 0.36], [0.4, 0.7, 0.3]]]);
  const hearts = instanced(heartShape, glossy, 24, true);
  const chestShape = buildShape([[box, [0, 0.3, 0], [0.9, 0.6, 0.6], [0.7, 0.42, 0.18]], [cylinder, [0, 0.6, 0], [0.3, 0.9, 0.3], [0.8, 0.5, 0.2], [0, 0, Math.PI / 2]], [box, [0, 0.45, 0.31], [0.16, 0.2, 0.06], [1, 0.85, 0.2]]]);
  const chests = instanced(chestShape, glossy, 12, true);

  // Expanding rings for shock waves, slams and blasts.
  const ringGeometry = createRingGeometry3D({ innerRadius: 0.82, outerRadius: 1, thetaSegments: 40 });
  for (let i = 0; i < 12; i++) {
    const mesh = new Mesh3D(ringGeometry, createUnlitMaterial3D({ color: 0xffffff, opacity: 0, alphaMode: 'blend', blending: 'additive', depthWrite: false, side: 'double' }));
    mesh.setRotation(-Math.PI / 2, 0, 0); mesh.visible = false; mesh.castShadow = false;
    scene.addChild(mesh);
    view.rings.push({ mesh, t: 1, life: 1, from: 0, to: 1 });
  }
  const ring = (x, y, z, to, life, color, from = 0.3) => {
    const slot = view.rings.reduce((a, b) => (a.t / a.life >= b.t / b.life ? a : b));
    slot.t = 0; slot.life = life; slot.from = from; slot.to = to;
    slot.mesh.material.setColor(color); slot.mesh.setPosition(x, y + 0.12, z); slot.mesh.visible = true;
  };

  // ---- particles ---------------------------------------------------------------------------
  const dot = dotTexture();
  const emitter = (more) => {
    const node = createParticleEmitter3D({ capacity: 600, rate: 0, map: dot, space: 'world', shape: 'sphere', radius: 0.3, spread: Math.PI, gravity: [0, -9, 0], drag: 1.2, lifetime: [0.4, 0.9], speed: [2, 7], startSize: 0.3, endSize: 0.05, startOpacity: 1, endOpacity: 0, blending: 'normal', ...more });
    node.frustumCulled = false;
    scene.addChild(node);
    return node;
  };
  const confetti = [0xff5f7a, 0xffd23f, 0x4fd1ff, 0x7be36b, 0xc58bff].map((color) => emitter({ startColor: color, endColor: color, startSize: 0.2, endSize: 0.12, lifetime: [0.6, 1.3], speed: [3, 9] }));
  const dust = emitter({ startColor: 0xf6efe0, endColor: 0xe0d8c8, startSize: 0.5, endSize: 1.1, startOpacity: 0.55, gravity: [0, 1, 0], speed: [1, 3.5], lifetime: [0.5, 1] });
  const spray = emitter({ startColor: 0xd8f4ff, endColor: 0x7fc8ff, startSize: 0.28, endSize: 0.08, gravity: [0, -16, 0], speed: [4, 10], direction: [0, 1, 0], spread: 0.8 });
  const sparks = emitter({ startColor: 0xfff3b0, endColor: 0xff8a3d, blending: 'additive', startSize: 0.35, endSize: 0.02, lifetime: [0.25, 0.6], speed: [5, 13], gravity: [0, -4, 0] });
  const burst = (node, x, y, z, count, radius) => { node.setPosition(x, y, z); if (radius) node.radius = radius; node.updateWorldMatrix(); node.burst(Math.max(1, Math.round(count))); };
  let pick = 0;
  const party = (x, y, z, count) => { for (let i = 0; i < 3; i++) burst(confetti[(pick++) % confetti.length], x, y, z, Math.ceil(count / 3), 0.4); };

  // ---- props follow their rigid bodies ---------------------------------------------------------
  const stripes = ['#ff5f6d', '#ffffff', '#3fa7ff', '#ffffff', '#ffd23f', '#ffffff'].map((css) => rgb(parseInt(css.slice(1), 16)));
  // A beach ball: six coloured wedges, painted by the angle of each vertex around the axis.
  const ballPositions = createSphereGeometry3D({ radius: 1, widthSegments: 24, heightSegments: 12 });
  const ballShape = (() => {
    const p = ballPositions.getAttribute('position').data, colors = new Float32Array(p.length);
    for (let i = 0; i < p.length; i += 3) {
      const cap = Math.abs(p[i + 1]) > 0.93, wedge = Math.min(5, Math.floor((Math.atan2(p[i + 2], p[i]) + Math.PI) / (Math.PI * 2) * 6 - 1e-4));
      colors.set(cap ? [1, 1, 1] : stripes[Math.max(0, wedge)], i);   // already linear
    }
    return createGeometry3D({ positions: p, normals: ballPositions.getAttribute('normal').data, colors, indices: ballPositions.index.data });
  })();
  const barrelShape = buildShape([[createCylinderGeometry3D({ radiusTop: 0.62, radiusBottom: 0.62, height: 1.25, radialSegments: 14 }), [0, 0, 0], [1, 1, 1], [0.72, 0.45, 0.22]], [cylinder, [0, 0.38, 0], [0.65, 0.1, 0.65], [0.35, 0.36, 0.4]], [cylinder, [0, -0.38, 0], [0.65, 0.1, 0.65], [0.35, 0.36, 0.4]]]);

  // ---- per-game objects --------------------------------------------------------------------------
  const gameNodes = [];
  /** Build the pandas and props of a new game, dropping those of the previous one. */
  view.attach = (game) => {
    for (const node of gameNodes) node.removeFromParent();
    gameNodes.length = 0; view.pandas.length = 0;
    for (const node of view.bossNodes.values()) node.removeFromParent();
    view.bossNodes.clear();
    for (const panda of game.pandas) {
      const model = createPanda(SKINS[panda.skin], view.jelly);
      scene.addChild(model.node); gameNodes.push(model.node); view.pandas.push(model);
      model.lastY = panda.y; model.yaw = panda.facing;
    }
    for (const prop of game.props) {
      const mesh = new Mesh3D(prop.kind === 'ball' ? ballShape : barrelShape, glossy);
      if (prop.kind === 'ball') mesh.setScale(prop.r);
      mesh.castShadow = true;
      scene.addChild(mesh); gameNodes.push(mesh);
      prop.body.node = mesh;
    }
  };

  const GEM_COLORS = [[0.4, 0.85, 1], [0.5, 1, 0.5], [1, 0.85, 0.3], [1, 0.5, 0.9]].map(lin);
  const SHOT_COLORS = Object.fromEntries(Object.entries({ glob: [1, 0.35, 0.3], bomblet: [0.4, 0.25, 0.15], bowl: [0.15, 0.2, 0.35], yoyo: [0.2, 0.95, 0.9], rocket: [1, 0.25, 0.2] }).map(([key, color]) => [key, lin(color)]));
  const PELLETS = [[1, 0.37, 0.48], [1, 0.82, 0.25], [0.31, 0.82, 1], [0.48, 0.89, 0.42], [0.77, 0.55, 1], [0.6, 0.95, 1]].map(lin);
  const FLAIL = lin([1, 0.45, 0.7]), CHAIN = lin([0.75, 0.75, 0.8]), BULLET = lin([1, 0.2, 0.55]);

  /** Draw the current state of `game`. */
  view.update = (dt, game, camera) => {
    view.time += dt;
    const time = view.time;
    sea.update(dt);
    game.pandas.forEach((panda, index) => view.pandas[index]?.update(dt, panda, time));

    // The horde: hop along, tumble in the air, flash white when hit.
    for (const kind of horde) kind.mesh.count = 0;
    let crownCount = 0;
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (e.boss) { drawBoss(e, time); continue; }
      const kind = horde[e.kind], mesh = kind.mesh, index = mesh.count;
      if (index >= mesh.capacity) continue;
      const size = e.r * 2, hop = e.air || e.trapped ? 0 : Math.abs(Math.sin(time * (4 + e.speed) + e.phase)), squash = e.air ? 1.15 : 0.86 + hop * 0.26;
      position[0] = e.x; position[1] = e.y + hop * 0.22 * size; position[2] = e.z;
      scale[0] = scale[2] = size / Math.sqrt(squash) * (e.mode === 1 ? 1 + Math.sin(time * 40) * 0.08 : 1); scale[1] = size * squash;
      if (e.air && !e.trapped) { const spin = time * 9 + e.phase; quat[0] = Math.sin(spin / 2); quat[1] = 0; quat[2] = 0; quat[3] = Math.cos(spin / 2); position[1] += e.r; } else yawQuat(e.yaw);
      mesh.setTransformAt(index, position, quat, scale);
      const tint = kind.tint, flash = e.flash > 0 ? 2.4 : 1;
      mesh.setColorAt(index, tint[0] * flash + (flash > 1 ? 0.5 : 0), tint[1] * flash + (flash > 1 ? 0.5 : 0), tint[2] * flash + (flash > 1 ? 0.5 : 0));
      mesh.count = index + 1;
      if (e.elite && crownCount < crowns.capacity) {
        position[1] = e.y + size * (kind.def.key === 'pop' ? 1.45 : 1.2) * squash + hop * 0.22 * size;
        crowns.setTransformAt(crownCount++, position, yawQuat(time * 2), e.r * 1.6);
      }
    }
    crowns.count = crownCount;
    for (const [enemy, node] of view.bossNodes) if (enemy.dead) { node.removeFromParent(); view.bossNodes.delete(enemy); }

    // Shots. Everything round shares one instanced sphere.
    let ballCount = 0, bubbleCount = 0, puddleCount = 0, chomperCount = 0, boxCount = 0, topCount = 0;
    const putBall = (x, y, z, size, color, stretch) => {
      if (ballCount >= balls.capacity) return;
      position[0] = x; position[1] = y; position[2] = z;
      if (stretch) { scale[0] = scale[2] = size; scale[1] = size * stretch; balls.setTransformAt(ballCount, position, IDENTITY, scale); } else balls.setTransformAt(ballCount, position, IDENTITY, size);
      balls.setColorAt(ballCount++, color[0], color[1], color[2]);
    };
    const chain = (ax, ay, az, bx, by, bz, step, size, color) => {
      const dx = bx - ax, dy = by - ay, dz = bz - az, length = Math.hypot(dx, dy, dz), count = Math.min(24, Math.floor(length / step));
      for (let k = 1; k < count; k++) putBall(ax + dx * k / count, ay + dy * k / count, az + dz * k / count, size, color);
    };
    for (const shot of game.shots) {
      if (shot.delay > 0) continue;
      switch (shot.kind) {
        case 'glob': case 'bomblet': case 'bowl': putBall(shot.x, shot.y, shot.z, shot.r, SHOT_COLORS[shot.kind]); break;
        case 'rocket': putBall(shot.x, shot.y, shot.z, 0.22, SHOT_COLORS.rocket, 2.6); if (Math.random() < 0.6) burst(sparks, shot.x, shot.y - 0.3, shot.z, 1, 0.1); break;
        case 'yoyo': putBall(shot.x, shot.y, shot.z, shot.phase === 1 ? 0.7 : shot.r, SHOT_COLORS.yoyo); chain(shot.panda.x, shot.panda.y + 0.9, shot.panda.z, shot.x, shot.y, shot.z, 0.55, 0.06, WHITE); break;
        case 'pellet': putBall(shot.x, shot.y, shot.z, shot.r, PELLETS[shot.look]); break;
        case 'bubble':
          if (bubbleCount < bubbles.capacity) { position[0] = shot.x; position[1] = shot.y; position[2] = shot.z; bubbles.setTransformAt(bubbleCount++, position, IDENTITY, shot.r * (1 + Math.sin(time * 5 + shot.id) * 0.05)); }
          break;
        case 'puddle':
          if (puddleCount < puddles.capacity) {
            const fade = Math.min(1, (shot.life - shot.t) * 1.5, shot.t * 6);
            position[0] = shot.x; position[1] = shot.y + 0.04; position[2] = shot.z; quat[0] = -Math.SQRT1_2; quat[1] = 0; quat[2] = 0; quat[3] = Math.SQRT1_2;
            puddles.setTransformAt(puddleCount, position, quat, shot.r * (0.6 + 0.4 * Math.min(1, shot.t * 5)));
            puddles.setColorAt(puddleCount++, shot.evo ? 1 : 0.95 * fade, (shot.evo ? 0.75 : 0.3) * fade, 0.25 * fade);
          }
          break;
        case 'chomper':
          if (chomperCount < chompers.capacity) { position[0] = shot.x; position[1] = shot.y; position[2] = shot.z; scale[0] = scale[2] = shot.r * 1.6; scale[1] = shot.r * 1.6 * (0.8 + Math.abs(Math.sin(shot.hop * 2)) * 0.5); chompers.setTransformAt(chomperCount++, position, yawQuat(shot.yaw ?? 0), scale); }
          break;
        case 'box':
          if (boxCount < boxes.capacity) { position[0] = shot.x; position[1] = shot.y; position[2] = shot.z; scale[0] = scale[2] = shot.width > 1.5 ? 1.5 : 1; scale[1] = scale[0] * (shot.arm > 0.6 ? 1.6 : 1); boxes.setTransformAt(boxCount++, position, IDENTITY, scale); }
          break;
        case 'top':
          if (topCount < tops.capacity) { position[0] = shot.x; position[1] = shot.y; position[2] = shot.z; tops.setTransformAt(topCount++, position, yawQuat(time * 25 + shot.id), shot.r); }
          break;
        default: break;
      }
    }
    for (const panda of game.pandas) for (const toy of panda.toys) {
      if (toy.key !== 'flail' || !toy.balls || panda.down) continue;
      for (const ball of toy.balls) { putBall(ball.x, ball.y, ball.z, ball.r, FLAIL); chain(panda.x, panda.y + 0.9, panda.z, ball.x, ball.y, ball.z, 0.4, 0.09, CHAIN); }
    }
    for (const bullet of game.bullets) putBall(bullet.x, bullet.y, bullet.z, 0.34, BULLET);
    balls.count = ballCount; bubbles.count = bubbleCount; puddles.count = puddleCount; chompers.count = chomperCount; boxes.count = boxCount; tops.count = topCount;

    let gemCount = 0;
    for (const gem of game.gems) {
      if (gemCount >= gems.capacity) break;
      position[0] = gem.x; position[1] = gem.y + Math.sin(gem.t * 3) * 0.08; position[2] = gem.z;
      const tier = gem.value >= 12 ? 3 : gem.value >= 5 ? 2 : gem.value >= 2 ? 1 : 0, color = GEM_COLORS[tier];
      gems.setTransformAt(gemCount, position, yawQuat(gem.t * 2), 1 + tier * 0.35);
      gems.setColorAt(gemCount++, color[0], color[1], color[2]);
    }
    gems.count = gemCount;
    let heartCount = 0, chestCount = 0;
    for (const pickup of game.pickups) {
      position[0] = pickup.x; position[1] = pickup.y + 0.1 + Math.abs(Math.sin(pickup.t * 3)) * 0.25; position[2] = pickup.z;
      if (pickup.kind === 'heart' && heartCount < hearts.capacity) hearts.setTransformAt(heartCount++, position, yawQuat(pickup.t * 1.5), 1);
      else if (pickup.kind === 'chest' && chestCount < chests.capacity) chests.setTransformAt(chestCount++, position, yawQuat(pickup.t), 1.2);
    }
    hearts.count = heartCount; chests.count = chestCount;

    for (const slot of view.rings) {
      if (slot.t >= slot.life) { slot.mesh.visible = false; continue; }
      slot.t += dt;
      const k = Math.min(1, slot.t / slot.life), ease = 1 - (1 - k) * (1 - k);
      slot.mesh.setScale(slot.from + (slot.to - slot.from) * ease);
      slot.mesh.material.opacity = (1 - k) * 0.85;
    }
    view.shake = Math.max(0, view.shake - dt * 2.4);
  };

  function drawBoss(enemy, time) {
    let node = view.bossNodes.get(enemy);
    if (!node) {
      node = new Mesh3D(bosses[enemy.def.key], createStandardMaterial3D({ color: 0xffffff, vertexColors: true, roughness: 0.3 }));
      node.castShadow = true;
      scene.addChild(node); view.bossNodes.set(enemy, node);
    }
    const size = enemy.r, breathe = 1 + Math.sin(time * 3) * 0.04, wind = enemy.mode === 1 ? 1 + Math.sin(time * 45) * 0.05 : 1;
    node.setPosition(enemy.x, enemy.y, enemy.z);
    node.setScale(size * wind / Math.sqrt(breathe), size * breathe * (enemy.air ? 1.15 : 1), size * wind / Math.sqrt(breathe));
    // The donut rolls on its rim; the others just face their target.
    if (enemy.def.key === 'donut') node.setRotation(0, enemy.mode === 2 ? Math.atan2(enemy.dirX, enemy.dirZ) + Math.PI / 2 : enemy.yaw, enemy.mode === 2 ? -time * 9 : 0);
    else node.setRotation(0, enemy.yaw, 0);
    const flash = enemy.flash > 0 ? 0.6 : 0;
    node.material.setEmissive([flash, flash, flash]); node.material.emissiveIntensity = 1;
  }

  /** Turn the simulation's events into effects. Returns nothing; sound and text are handled elsewhere. */
  view.consume = (events) => {
    let hits = 0;
    for (const event of events) {
      const { x, y, z } = event;
      switch (event.type) {
        case 'hit': if (hits++ < 10) burst(sparks, x, y - 0.3, z, event.crit ? 5 : 2, 0.2); break;
        case 'death': party(x, y, z, event.boss ? 240 : 9); if (event.boss) { ring(x, y, z, 14, 0.9, [1, 0.9, 0.5]); view.shake = 1; } break;
        case 'slam': ring(x, y, z, event.radius, 0.45, [1, 1, 1]); burst(dust, x, y + 0.2, z, 26, event.radius * 0.5); view.shake = Math.max(view.shake, 0.55); view.pandas[event.panda]?.kick(-3); break;
        case 'land': burst(dust, x, y + 0.1, z, 6, 0.5); break;
        case 'jump': burst(dust, x, y + 0.1, z, 4 + event.power * 10, 0.4); view.pandas[event.panda]?.kick(2 + event.power * 3); break;
        case 'bump': burst(dust, x, y + 0.4, z, 8, 0.4); view.pandas[event.panda]?.kick(2.5); break;
        case 'hurt': view.pandas[event.panda]?.kick(-4); view.shake = Math.max(view.shake, 0.3); break;
        case 'splash': burst(spray, x, y, z, 26, event.radius * 0.4); ring(x, y - 0.1, z, event.radius * 1.6, 0.6, [0.8, 0.95, 1]); break;
        case 'splat': burst(confetti[0], x, y + 0.2, z, 12, event.radius * 0.4); ring(x, y, z, event.radius, 0.3, [1, 0.4, 0.3]); break;
        case 'boom': burst(sparks, x, y, z, 30, event.radius * 0.3); burst(dust, x, y, z, 10, event.radius * 0.4); ring(x, y, z, event.radius, 0.35, event.hostile ? [1, 0.3, 0.3] : [1, 0.8, 0.4]); view.shake = Math.max(view.shake, 0.25); break;
        case 'ring': ring(x, y, z, event.radius, event.radius / event.speed, event.lift ? [1, 0.8, 0.3] : [0.6, 0.9, 1], 0.5); view.pandas[event.panda ?? 0]?.kick(3); break;
        case 'inhale': ring(x, y, z, 0.6, 0.4, [0.7, 1, 0.9], event.radius); break;
        case 'shock': ring(x, y, z, event.radius, 0.5, [1, 0.5, 0.3]); burst(dust, x, y + 0.2, z, 40, 2.5); view.shake = 1; break;
        case 'spring': ring(x, y, z, event.radius, 0.3, [1, 0.9, 0.3]); party(x, y + 0.6, z, 12); break;
        case 'pop': burst(spray, x, y, z, 12, 0.5); break;
        case 'popper': party(x, y, z, 9); break;
        case 'thud': burst(dust, x, y - 0.4, z, 6, 0.5); break;
        case 'levelup': party(x, y + 1.2, z, 36); ring(x, y, z, 4, 0.6, [1, 1, 0.5]); break;
        case 'evolve': party(x, y + 1.2, z, 90); ring(x, y, z, 7, 0.8, [1, 0.6, 1]); break;
        case 'chest': case 'heal': party(x, y + 0.5, z, 45); ring(x, y, z, 3.5, 0.5, event.type === 'heal' ? [0.5, 1, 0.5] : [1, 0.85, 0.3]); break;
        case 'revived': party(x, y + 1, z, 50); ring(x, y, z, 4, 0.6, [0.6, 1, 0.7]); break;
        case 'bossSpawn': view.shake = 1; break;
        case 'volley': burst(sparks, x, y, z, 30, 1); break;
        case 'telegraph': ring(x, y, z, 1, 0.8, [1, 0.2, 0.2], 6); break;
        case 'won': party(x, y + 2, z, 400); break;
        default: break;
      }
    }
  };
  return view;
}
