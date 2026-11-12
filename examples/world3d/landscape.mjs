// SPDX-License-Identifier: Apache-2.0
// World3D landscape: a height-map terrain whose chunks drop detail with
// distance, the same heights as a collision shape, and a lake with waves,
// refraction and a mirror image of the scene. A crowd of walking figures is
// drawn in one call from clips baked into an animation texture.
import { createEngine } from '@egret/engine';
import {
  Attribute3D, Bone3D, Mesh3D, Object3D, Scene3D, Skeleton3D, bakeAnimationTexture3D, createAmbientLight3D, createAnimationClip3D, createBoxGeometry3D,
  createDirectionalLight3D, createGeometry3D, createGradientCubeTexture3D, createHeightField3D, createPerspectiveCamera3D, createPhysicsWorld3D,
  createSkinnedInstancedMesh3D, createSphereGeometry3D, createStandardMaterial3D, createTerrain3D, createWater3D, quatFromAxisAngle,
} from '@egret/engine/world3d';

const useWebGPU = new URLSearchParams(location.search).get('backend') === 'webgpu';
const backend = await (useWebGPU ? import('@egret/engine/webgpu/world3d') : import('@egret/engine/webgl2/world3d'));
const { createOrbitControls3D, createWorld3DHost, createWorld3DView, startWorld3DLoop } = backend;
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
  sun.setPosition(60, 80, 30).lookAt(0, 0, 0);
  Object.assign(sun.shadow, { cascades: 3, cascadeDistance: 160 });
  scene.addChild(sun);

  // ---- terrain: 257 x 257 samples over 400 x 400 units, 64 chunks -----------------
  const field = createHeightField3D({ columns: 257, rows: 257, width: 400, depth: 400, sample: hills });
  const ground = createStandardMaterial3D({ roughness: 0.95 });
  ground.vertexColors = true;
  const blend = (out, a, b, t) => { const k = Math.min(1, Math.max(0, t)); out[0] = a[0] + (b[0] - a[0]) * k; out[1] = a[1] + (b[1] - a[1]) * k; out[2] = a[2] + (b[2] - a[2]) * k; };
  const SAND = [0.42, 0.35, 0.2], GRASS = [0.1, 0.22, 0.06], ROCK = [0.2, 0.19, 0.18], SNOW = [0.7, 0.72, 0.76];
  const terrain = createTerrain3D(field, ground, {
    chunkCells: 32, levels: 4, lodDistance: 90,
    colorAt(height, slope, x, z, out) {
      blend(out, SAND, GRASS, (height + 9) / 3);
      blend(out, out, ROCK, (slope - 0.07) / 0.1);
      blend(out, out, SNOW, (height - 6) / 3);
    },
  });
  terrain.setShadows(true, true);
  scene.addChild(terrain);

  // ---- water: the lake surface at y = -10 -----------------------------------------
  const water = createWater3D({ width: 400, depth: 400, segments: 160, color: 0x2a6f8f, amplitude: 0.18, wavelength: 11 });
  water.setPosition(0, -10, 0);
  scene.addChild(water);
  const waterMaterial = water.material, mirror = water.reflection.texture;
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
  const CROWD = 600, WALK = baked.clipIndex('walk'), IDLE = baked.clipIndex('idle'), WAVE = baked.clipIndex('wave');
  const crowd = createSkinnedInstancedMesh3D(figure.mesh.geometry, figure.mesh.material, baked, CROWD);
  crowd.castShadow = true; crowd.receiveShadow = true;
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
  const moveCrowd = (deltaSeconds) => {
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
    }
    crowd.update(deltaSeconds);
  };
  moveCrowd(0);

  const controls = createOrbitControls3D(camera, canvas, { target: [0, -6, 0], minDistance: 6, maxDistance: 320, maxPolarAngle: Math.PI * 0.495 });
  const view = createWorld3DView(engine, scope, {
    renderer, scene, camera, controls,
    onUpdate(deltaSeconds) {
      world.step(deltaSeconds);
      moveCrowd(Math.min(deltaSeconds, 0.1));
      water.update(deltaSeconds);
      buoy.setPosition(-12, water.heightAt(-12, 8) + 0.3, 8);
      // The mirror image is drawn first; the main view then reads it.
      if (reflect) water.renderReflection(renderer, scene, camera);
    },
  });

  const toggle = (selector, apply) => {
    const button = document.querySelector(selector);
    button.addEventListener('click', () => { const on = button.getAttribute('aria-pressed') !== 'true'; button.setAttribute('aria-pressed', String(on)); apply(on); });
  };
  toggle('#wire', (on) => { ground.wireframe = on; ground.touch(); });
  toggle('#reflect', (on) => { reflect = on; waterMaterial.reflectionMap = on ? mirror : undefined; waterMaterial.touch(); });
  toggle('#calm', (on) => { water.amplitude = on ? 0.02 : 0.18; });
  document.querySelector('#drop').addEventListener('click', () => drop(6));

  const loopHandle = startWorld3DLoop(engine, (cause) => { lastError = String(cause?.stack ?? cause); report('Stopped: ' + (cause?.message ?? cause)); });
  engine.clock.onTick(scope, () => {
    frames++;
    if (frames % 30 === 0 && !lastError) {
      const info = renderer.info;
      report(`${info.drawCalls} draws · ${Math.round(info.triangles)} triangles · terrain ${terrain.triangleCount} of ${(field.columns - 1) * (field.rows - 1) * 2} / 地形三角形 · ${crowd.count} figures / 人物`);
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
    get crowd() { return { count: crowd.count, walking: walkers.filter((walker) => walker.rest <= 0).length, frames: baked.frameCount, bones: baked.boneCount, first: [walkers[0].x, walkers[0].z].map((v) => +v.toFixed(2)) }; },
    backend: useWebGPU ? 'webgpu' : 'webgl2',
    look(x, y, z, tx = 0, ty = -6, tz = 0) { camera.setPosition(x, y, z); controls.target.set([tx, ty, tz]); camera.lookAt(tx, ty, tz); controls.syncFromCamera(); },
    async dispose() { loopHandle.dispose(); view.dispose(); await engine.dispose(); },
  };
}

main().catch((cause) => { report('Failed: ' + (cause?.message ?? cause)); globalThis.__world3dLandscape = { frames: 0, error: String(cause?.stack ?? cause) }; });
