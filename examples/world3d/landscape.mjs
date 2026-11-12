// SPDX-License-Identifier: Apache-2.0
// World3D landscape: a height-map terrain whose chunks drop detail with
// distance, the same heights as a collision shape, and a lake with waves,
// refraction and a mirror image of the scene. A crowd of walking figures is
// drawn in one call from clips baked into an animation texture. Height fog with
// light shafts, smoke and mist from GPU particles that fade into the ground,
// a trail behind a circling light, and decals stamped onto the terrain.
import { createEngine } from '@egret/engine';
import {
  Attribute3D, Bone3D, Mesh3D, Object3D, Scene3D, Skeleton3D, Texture3D, bakeAnimationTexture3D, createAmbientLight3D, createAnimationClip3D, createBoxGeometry3D,
  createDirectionalLight3D, createGeometry3D, createGpuParticles3D, createTrail3D, createGradientCubeTexture3D, createHeightField3D, createPerspectiveCamera3D, createPhysicsWorld3D,
  createSkinnedInstancedMesh3D, createSphereGeometry3D, createStandardMaterial3D, createTerrain3D, createTerrainMaterial3D, createVolumetricFog3D, createWater3D, quatFromAxisAngle,
} from '@egret/engine/world3d';

const useWebGPU = new URLSearchParams(location.search).get('backend') === 'webgpu';
const backend = await (useWebGPU ? import('@egret/engine/webgpu/world3d') : import('@egret/engine/webgl2/world3d'));
const { createAtmosphere3D, createOrbitControls3D, createWorld3DHost, createWorld3DView, startWorld3DLoop } = backend;
const canvas = document.querySelector('#stage');
const status = document.querySelector('#status');
const report = (text) => { status.textContent = text; };

// Smooth value noise, summed over a few octaves: enough for rolling hills without an image file.
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function hills(x, z) {
  let height = 0, scale = 1 / 70, weight = 1;
  for (let octave = 0; octave < 5; octave++) { height += noise(x * scale + 17, z * scale + 5) * weight; scale *= 2.1; weight *= 0.45; }
  // A basin in the middle holds the lake.
  return height * 22 - 17 - 10 * Math.exp(-(x * x + z * z) / 5200);
}

// A figure made of boxes, each bound to one bone, with three clips made from sine curves.
// Returns the rig the clips animate, its skinned mesh and the clips.
function createFigure() {
  // name, parent, joint position relative to the parent, then the box hanging from the joint: size and center.
  const parts = [
    ['hips', -1, [0, 0.95, 0], [0.34, 0.2, 0.2], [0, 0, 0]],
    ['spine', 0, [0, 0.1, 0], [0.4, 0.5, 0.22], [0, 0.25, 0]],
    ['head', 1, [0, 0.52, 0], [0.22, 0.24, 0.22], [0, 0.14, 0]],
    ['armL', 1, [-0.27, 0.45, 0], [0.11, 0.6, 0.11], [0, -0.28, 0]],
    ['armR', 1, [0.27, 0.45, 0], [0.11, 0.6, 0.11], [0, -0.28, 0]],
    ['legL', 0, [-0.11, -0.1, 0], [0.15, 0.85, 0.15], [0, -0.42, 0]],
    ['legR', 0, [0.11, -0.1, 0], [0.15, 0.85, 0.15], [0, -0.42, 0]],
  ];
  const rig = new Object3D(), bones = [], world = [];
  const positions = [], normals = [], uvs = [], indices = [], joints = [], weights = [];
  parts.forEach(([name, parent, at, size, center], index) => {
    const bone = new Bone3D();
    bone.name = name; bone.setPosition(at[0], at[1], at[2]);
    (parent < 0 ? rig : bones[parent]).addChild(bone);
    bones.push(bone);
    world.push(parent < 0 ? at : [world[parent][0] + at[0], world[parent][1] + at[1], world[parent][2] + at[2]]);
    const box = createBoxGeometry3D({ width: size[0], height: size[1], depth: size[2] }), first = positions.length / 3;
    const p = box.getAttribute('position').data, n = box.getAttribute('normal').data, uv = box.getAttribute('uv').data;
    for (let i = 0; i < p.length; i += 3) { positions.push(p[i] + world[index][0] + center[0], p[i + 1] + world[index][1] + center[1], p[i + 2] + world[index][2] + center[2]); joints.push(index, 0, 0, 0); weights.push(1, 0, 0, 0); }
    normals.push(...n); uvs.push(...uv);
    for (const i of box.index.data) indices.push(first + i);
    box.dispose();
  });
  const geometry = createGeometry3D({ positions, normals, uvs, indices });
  geometry.setAttribute('joints', new Attribute3D(new Uint16Array(joints), 4));
  geometry.setAttribute('weights', new Attribute3D(new Float32Array(weights), 4));
  const mesh = new Mesh3D(geometry, createStandardMaterial3D({ roughness: 0.7 }));
  rig.addChild(mesh);
  rig.updateWorldMatrices();
  mesh.bind(new Skeleton3D(bones));
  // One full turn of a sine per clip, so the last key equals the first and the clip loops.
  const swing = (targetName, axis, reach, phase = 0, base = 0, steps = 16, duration = 1) => ({
    targetName, path: 'quaternion', times: Array.from({ length: steps + 1 }, (_, i) => i / steps * duration),
    values: Array.from({ length: steps + 1 }, (_, i) => [...quatFromAxisAngle([0, 0, 0, 1], axis, base + Math.sin(i / steps * Math.PI * 2 + phase) * reach)]).flat(),
  });
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const clips = [
    createAnimationClip3D({ name: 'walk', tracks: [swing('legL', X, 0.6), swing('legR', X, 0.6, Math.PI), swing('armL', X, 0.5, Math.PI), swing('armR', X, 0.5), swing('spine', Y, 0.12)] }),
    createAnimationClip3D({ name: 'idle', tracks: [swing('spine', Z, 0.05, 0, 0, 16, 2.4), swing('head', Y, 0.35, 0, 0, 16, 2.4)] }),
    createAnimationClip3D({ name: 'wave', tracks: [swing('armR', Z, 0.35, 0, 2.5, 16, 0.8), swing('head', Z, 0.1, 0, 0, 16, 0.8)] }),
  ];
  return { rig, mesh, clips };
}

async function main() {
  let deviceLost = '', lastError = '', frames = 0;
  const engine = await createEngine({ host: createWorld3DHost(canvas) });
  const scope = engine.createScope();
  const renderer = useWebGPU
    ? await backend.createWebGPURenderer3D({ canvas, antialias: true, toneMapping: 'aces', onDeviceLost: (message) => { deviceLost = message || 'device lost'; report('Device lost / 设备丢失: ' + deviceLost); } })
    : backend.createWebGL2Renderer3D({ canvas, antialias: true, toneMapping: 'aces' });
  scope.use(renderer);
  const link = document.querySelector('#backend');
  link.textContent = useWebGPU ? 'WebGL2' : 'WebGPU';
  link.href = useWebGPU ? '?' : '?backend=webgpu';

  const scene = new Scene3D();
  const sky = createGradientCubeTexture3D([60, 115, 205], [205, 220, 238], [90, 100, 96], 64);
  scene.background = sky; scene.environment = sky; scene.environmentIntensity = 0.45;
  const camera = createPerspectiveCamera3D({ fov: 50, near: 0.2, far: 900 });
  camera.setPosition(-55, 22, 70);
  scene.addChild(camera);
  scene.addChild(createAmbientLight3D({ intensity: 0.08 }));
  const sun = createDirectionalLight3D({ color: 0xfff1d6, intensity: 1.7, castShadow: true });
  sun.setPosition(70, 36, 20).lookAt(0, 0, 0);
  Object.assign(sun.shadow, { cascades: 3, cascadeDistance: 160 });
  scene.addChild(sun);

  // ---- terrain: 257 x 257 samples over 400 x 400 units, 64 chunks -----------------
  const field = createHeightField3D({ columns: 257, rows: 257, width: 400, depth: 400, sample: hills });
  // Four ground textures, each a small tile of noise around one color, and a weight map that says where each shows:
  // sand by the water, grass above it, rock on slopes, snow on the heights.
  const tile = (r, g, b) => {
    const size = 32, data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) { const k = 0.8 + 0.4 * hash(i % size, Math.floor(i / size)); data.set([Math.min(255, r * k), Math.min(255, g * k), Math.min(255, b * k), 255], i * 4); }
    return new Texture3D({ width: size, height: size, data });
  };
  const share = (t) => Math.min(1, Math.max(0, t));
  const weights = (() => {
    const size = 256, data = new Uint8Array(size * size * 4), normal = [0, 0, 0];
    for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
      const x = (column / (size - 1) - 0.5) * field.width, z = (row / (size - 1) - 0.5) * field.depth, height = field.heightAt(x, z);
      const rock = share((1 - field.normalAt(x, z, normal)[1] - 0.07) / 0.1), snow = share((height - 6) / 3) * (1 - rock), grass = share((height + 9) / 3) * (1 - rock) * (1 - snow);
      data.set([255 * (1 - grass - rock - snow), 255 * grass, 255 * rock, 255 * snow], (row * size + column) * 4);
    }
    return new Texture3D({ width: size, height: size, data }, { colorSpace: 'linear', wrapS: 'clamp', wrapT: 'clamp' });
  })();
  const ground = createTerrainMaterial3D({ layers: [tile(190, 165, 110), tile(70, 120, 45), tile(110, 105, 100), tile(225, 228, 235)], weights, repeat: [90, 120, 60, 40] });
  const terrain = createTerrain3D(field, ground, { chunkCells: 32, levels: 4, lodDistance: 90 });
  terrain.setShadows(true, true);
  scene.addChild(terrain);

  // ---- water: the lake surface at y = -10 -----------------------------------------
  const water = createWater3D({ width: 400, depth: 400, segments: 160, color: 0x2a6f8f, amplitude: 0.18, wavelength: 11 });
  water.setPosition(0, -10, 0);
  scene.addChild(water);
  const waterMaterial = water.material, mirror = water.reflection.texture;
  // The mirror image is the costly part of the water: draw it every other frame and without shadows.
  water.reflection.interval = 2; water.reflection.shadows = false;
  let reflect = true;

  // ---- physics: the same heights as a collision shape -----------------------------
  const world = createPhysicsWorld3D({});
  world.createBody({ type: 'static', shape: field.createShape() });
  const ball = createSphereGeometry3D({ radius: 0.9 }), box = createBoxGeometry3D({ width: 1.6, height: 1.6, depth: 1.6 });
  const paint = [0xd9534f, 0xf0ad4e, 0x5bc0de, 0xb565d9].map((color) => createStandardMaterial3D({ color, roughness: 0.5 }));
  const bodies = [];
  const drop = (count = 12) => {
    for (let i = 0; i < count; i++) {
      const round = i % 2 === 0, node = new Mesh3D(round ? ball : box, paint[bodies.length % paint.length]);
      node.castShadow = true; scene.addChild(node);
      const x = 60 + Math.random() * 30, z = -40 + Math.random() * 30;
      bodies.push(world.createBody({ node, position: [x, field.heightAt(x, z) + 6 + i * 2.2, z], shape: round ? { type: 'sphere', radius: 0.9 } : { type: 'box', halfExtents: [0.8, 0.8, 0.8] } }));
    }
  };
  drop();
  // A buoy rides the waves through the same formula the shader runs.
  const buoy = new Mesh3D(createSphereGeometry3D({ radius: 0.8 }), createStandardMaterial3D({ color: 0xff6a3d, roughness: 0.4 }));
  buoy.castShadow = true; scene.addChild(buoy);

  // ---- crowd: 600 figures, one draw call ------------------------------------------
  const figure = createFigure();
  const baked = bakeAnimationTexture3D(figure.rig, figure.mesh, figure.clips, { fps: 30 });
  const HEAD = figure.clips.length && 2, CROWD = 600, WALK = baked.clipIndex('walk'), IDLE = baked.clipIndex('idle'), WAVE = baked.clipIndex('wave');
  const crowd = createSkinnedInstancedMesh3D(figure.mesh.geometry, figure.mesh.material, baked, CROWD);
  crowd.castShadow = true; crowd.receiveShadow = true;
  // Heads turn on their own, each to its own rhythm.
  crowd.lookBone = HEAD;
  scene.addChild(crowd);
  const dry = (x, z) => field.contains(x, z) && Math.abs(x) < 190 && Math.abs(z) < 190 && field.heightAt(x, z) > -9.3;
  const walkers = [], turn = [0, 0, 0, 1], UP = [0, 1, 0], shirts = [[0.8, 0.25, 0.2], [0.2, 0.45, 0.8], [0.9, 0.75, 0.2], [0.3, 0.65, 0.35], [0.7, 0.4, 0.75], [0.85, 0.85, 0.85]];
  for (let i = 0; i < CROWD; i++) {
    let x = 0, z = 0;
    do { x = -40 + Math.random() * 170; z = -110 + Math.random() * 170; } while (!dry(x, z));
    const walker = { x, z, heading: Math.random() * Math.PI * 2, speed: 1.2 + Math.random() * 0.6, rest: 0 };
    walkers.push(walker);
    const shirt = shirts[i % shirts.length];
    crowd.setColorAt(i, shirt[0], shirt[1], shirt[2]);
    crowd.setClipAt(i, WALK, { time: Math.random(), speed: walker.speed / 1.4 });
  }
  let headClock = 0;
  const moveCrowd = (deltaSeconds) => {
    headClock += deltaSeconds;
    for (let i = 0; i < CROWD; i++) {
      const walker = walkers[i];
      if (walker.rest > 0) {
        // Standing: when the pause ends, set off again in a new direction.
        walker.rest -= deltaSeconds;
        if (walker.rest <= 0) { walker.heading += (Math.random() - 0.5) * 2.5; crowd.setClipAt(i, WALK, { speed: walker.speed / 1.4, fade: 0.25 }); }
      } else {
        const x = walker.x + Math.sin(walker.heading) * walker.speed * deltaSeconds, z = walker.z + Math.cos(walker.heading) * walker.speed * deltaSeconds;
        if (dry(x, z)) { walker.x = x; walker.z = z; } else walker.heading += 2 + Math.random();
        if (Math.random() < deltaSeconds * 0.08) { walker.rest = 2 + Math.random() * 3; crowd.setClipAt(i, Math.random() < 0.3 ? WAVE : IDLE, { fade: 0.25 }); }
      }
      crowd.setTransformAt(i, [walker.x, field.heightAt(walker.x, walker.z), walker.z], quatFromAxisAngle(turn, UP, walker.heading));
      const glance = quatFromAxisAngle(turn, UP, Math.sin(headClock * 0.8 + i * 1.7) * 0.7);
      crowd.setBoneRotationAt(i, glance[0], glance[1], glance[2], glance[3]);
    }
    crowd.update(deltaSeconds);
  };
  moveCrowd(0);

  // ---- effects --------------------------------------------------------------------
  // Fog that pools in the basin, and shafts where the hills stand in front of the sun.
  const air = createAtmosphere3D({ fogColor: 0xb9c8d6, fogDensity: 0.004, fogHeight: -10, fogFalloff: 0.06, shaftIntensity: 0.5 });
  Object.assign(renderer.postProcess, { enabled: true, ssao: false, custom: air.post });
  const sunTravel = [-70, -36, -20];
  // A soft round dot for the particles, drawn into a small texture.
  const dot = (() => {
    const size = 32, data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const d = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) * 2, a = Math.max(0, 1 - d);
      data.set([255, 255, 255, Math.round(a * a * 255)], (y * size + x) * 4);
    }
    return new Texture3D({ width: size, height: size, data });
  })();
  // Mist drifting over the lake: large, slow particles that fade where they meet the water's edge and the shore.
  const mist = createGpuParticles3D({ count: 900, lifetime: [8, 14], speed: [0.2, 0.7], direction: [1, 0.05, 0.3], spread: 0.9, startSize: [5, 9], endScale: 1.6, startColor: 0xdfe8f0, startOpacity: 0.16, endOpacity: 0.16, fadeIn: 0.3, fadeOut: 0.4, shape: 'box', extents: [55, 0.6, 45], map: dot, blending: 'normal', softness: 2.5, sorted: true });
  mist.setPosition(0, -8.6, 0);
  scene.addChild(mist);
  // A campfire on the shore: smoke that rises and spreads, and sparks that fall back.
  let fireX = 0, fireZ = 0;
  for (let reach = 20; reach < 150; reach += 2) { fireX = -reach * 0.6; fireZ = reach * 0.8; if (field.heightAt(fireX, fireZ) > -9.2) break; }
  const fireY = field.heightAt(fireX, fireZ);
  const smoke = createGpuParticles3D({ count: 500, lifetime: [4, 7], speed: [1.2, 2], spread: 0.25, gravity: [0.25, 0.1, 0.1], drag: 0.15, startSize: [0.7, 1.2], endScale: 5, spin: [-0.6, 0.6], rotation: [0, 6.28], startColor: 0x6a6660, endColor: 0xb8b8b8, startOpacity: 0.55, endOpacity: 0, fadeIn: 0.08, fadeOut: 0.6, map: dot, blending: 'normal', softness: 1, sorted: true });
  const sparks = createGpuParticles3D({ count: 300, lifetime: [0.8, 1.8], speed: [2.5, 5], spread: 0.5, gravity: [0, -3.5, 0], startSize: [0.06, 0.12], endScale: 0.3, startColor: 0xffc060, endColor: 0xff3010, map: dot, floor: -0.15, bounce: 0.45 });
  for (const emitter of [smoke, sparks]) { emitter.setPosition(fireX, fireY + 0.2, fireZ); scene.addChild(emitter); }
  // A light circling the lake with a ribbon behind it.
  const wisp = new Mesh3D(createSphereGeometry3D({ radius: 0.35 }), createStandardMaterial3D({ color: 0x000000, roughness: 1 }));
  wisp.material.emissive.set([0.4, 1.6, 2.4]); wisp.castShadow = false;
  scene.addChild(wisp);
  const trail = createTrail3D({ target: wisp, points: 96, lifetime: 2.2, width: 0.7, endWidth: 0, color: 0x66ddff, endColor: 0x7744ff, opacity: 0.9, minDistance: 0.2 });
  scene.addChild(trail);
  // Decals: a painted ring stamped onto whichever terrain chunk lies under a point.
  const ring = (() => {
    const size = 64, data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const d = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) * 2, on = (d > 0.62 && d < 0.9) || d < 0.22;
      data.set(on ? [235, 60, 40, 235] : [0, 0, 0, 0], (y * size + x) * 4);
    }
    return new Texture3D({ width: size, height: size, data });
  })();
  const stamps = [];
  const stamp = (x, z) => {
    const y = field.heightAt(x, z);
    // Cut from the full-detail heights, so the mark stays put when chunks change their level.
    const decal = terrain.createDecal(createStandardMaterial3D({ map: ring, alphaMode: 'blend', roughness: 0.8 }), { position: [x, y, z], normal: field.normalAt(x, z), width: 6, height: 6, depth: 8, rotation: Math.random() * 6.28 });
    if (decal) stamps.push(decal);
  };
  stamp(fireX + 5, fireZ + 2); stamp(52, -30); stamp(70, -18);
  // Fog lit by the sun through its shadow map; off until asked for, since each pixel walks 24 steps through it.
  const volume = createVolumetricFog3D({ color: 0xc4d2e0, density: 0.006, height: -10, falloff: 0.07, distance: 260, anisotropy: 0.7 });
  volume.visible = false;
  scene.addChild(volume);
  let clock = 0;
  const moveEffects = (deltaSeconds) => {
    clock += deltaSeconds;
    wisp.setPosition(Math.cos(clock * 0.7) * 38, -6.5 + Math.sin(clock * 1.9) * 1.5, Math.sin(clock * 0.7) * 30);
    trail.update(deltaSeconds);
    mist.update(deltaSeconds); smoke.update(deltaSeconds); sparks.update(deltaSeconds);
    air.update(camera, sunTravel);
  };

  const controls = createOrbitControls3D(camera, canvas, { target: [0, -6, 0], minDistance: 6, maxDistance: 320, maxPolarAngle: Math.PI * 0.495 });
  const view = createWorld3DView(engine, scope, {
    renderer, scene, camera, controls,
    onUpdate(deltaSeconds) {
      world.step(deltaSeconds);
      moveCrowd(Math.min(deltaSeconds, 0.1));
      water.update(deltaSeconds);
      moveEffects(Math.min(deltaSeconds, 0.1));
      buoy.setPosition(-12, water.heightAt(-12, 8) + 0.3, 8);
      // The mirror image is drawn first; the main view then reads it.
      // Below the surface the scene turns to thick blue fog and there is nothing to mirror.
      const under = water.updateUnderwater(scene, camera);
      if (reflect && !under) water.renderReflection(renderer, scene, camera);
    },
  });

  const toggle = (selector, apply) => {
    const button = document.querySelector(selector);
    button.addEventListener('click', () => { const on = button.getAttribute('aria-pressed') !== 'true'; button.setAttribute('aria-pressed', String(on)); apply(on); });
  };
  toggle('#wire', (on) => { ground.wireframe = on; ground.touch(); });
  toggle('#reflect', (on) => { reflect = on; waterMaterial.reflectionMap = on ? mirror : undefined; waterMaterial.touch(); });
  toggle('#calm', (on) => { water.amplitude = on ? 0.02 : 0.18; });
  let fogOn = true;
  const applyFog = () => { const post = fogOn && !volume.visible; air.fogDensity = post ? 0.004 : 0; air.shaftIntensity = post ? 0.5 : 0; };
  toggle('#fog', (on) => { fogOn = on; applyFog(); });
  toggle('#volume', (on) => { volume.visible = on; applyFog(); });
  // A level changes the chunk's triangles, so a stamp belongs to the level it was made on: stamp at the detail in view.
  document.querySelector('#stamp').addEventListener('click', () => stamp(controls.target[0] + (Math.random() - 0.5) * 20, controls.target[2] + (Math.random() - 0.5) * 20));
  document.querySelector('#drop').addEventListener('click', () => drop(6));

  const loopHandle = startWorld3DLoop(engine, (cause) => { lastError = String(cause?.stack ?? cause); report('Stopped: ' + (cause?.message ?? cause)); });
  engine.clock.onTick(scope, () => {
    frames++;
    if (frames % 30 === 0 && !lastError) {
      const info = renderer.info;
      report(`${info.drawCalls} draws · ${Math.round(info.triangles)} triangles · terrain ${terrain.triangleCount} of ${(field.columns - 1) * (field.rows - 1) * 2} / 地形三角形 · ${crowd.count} of ${crowd.total} figures drawn / 人物`);
    }
    return undefined;
  });
  // Read-only probe for automated checks of this example.
  globalThis.__world3dLandscape = {
    get frames() { return frames; },
    get error() { return lastError || deviceLost; },
    get info() { return { ...renderer.info, terrainTriangles: terrain.triangleCount, levels: terrain.chunkLevels.join(''), bodies: bodies.length }; },
    get resting() { return bodies.map((body) => { const p = body.position; return +(p[1] - field.heightAt(p[0], p[2])).toFixed(2); }); },
    get buoy() { return buoy.position[1]; },
    get effects() { return { stamps: stamps.length, volume: volume.visible, under: water.isUnderwater(camera.position), trail: trail.pointCount, mist: mist.count, smoke: +smoke.time.toFixed(2), fog: air.fogDensity, sun: [...air.post.uniforms.subarray(8, 11)].map((v) => +v.toFixed(2)), fire: [fireX, fireY, fireZ].map((v) => +v.toFixed(1)) }; },
    get crowd() { return { count: crowd.count, total: crowd.total, walking: walkers.filter((walker) => walker.rest <= 0).length, frames: baked.frameCount, bones: baked.boneCount, first: [walkers[0].x, walkers[0].z].map((v) => +v.toFixed(2)) }; },
    backend: useWebGPU ? 'webgpu' : 'webgl2',
    look(x, y, z, tx = 0, ty = -6, tz = 0) { camera.setPosition(x, y, z); controls.target.set([tx, ty, tz]); camera.lookAt(tx, ty, tz); controls.syncFromCamera(); },
    async dispose() { loopHandle.dispose(); view.dispose(); await engine.dispose(); },
  };
}

main().catch((cause) => { report('Failed: ' + (cause?.message ?? cause)); globalThis.__world3dLandscape = { frames: 0, error: String(cause?.stack ?? cause) }; });
