// SPDX-License-Identifier: Apache-2.0
// World3D landscape: a height-map terrain whose chunks drop detail with
// distance, the same heights as a collision shape, and a lake with waves,
// refraction and a mirror image of the scene.
import { createEngine } from '@egret/engine';
import {
  Mesh3D, Scene3D, createAmbientLight3D, createBoxGeometry3D, createDirectionalLight3D, createGradientCubeTexture3D, createHeightField3D,
  createPerspectiveCamera3D, createPhysicsWorld3D, createSphereGeometry3D, createStandardMaterial3D, createTerrain3D, createWater3D,
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

  const controls = createOrbitControls3D(camera, canvas, { target: [0, -6, 0], minDistance: 6, maxDistance: 320, maxPolarAngle: Math.PI * 0.495 });
  const view = createWorld3DView(engine, scope, {
    renderer, scene, camera, controls,
    onUpdate(deltaSeconds) {
      world.step(deltaSeconds);
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
      report(`${info.drawCalls} draws · ${Math.round(info.triangles)} triangles · terrain ${terrain.triangleCount} of ${(field.columns - 1) * (field.rows - 1) * 2} / 地形三角形`);
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
    backend: useWebGPU ? 'webgpu' : 'webgl2',
    look(x, y, z, tx = 0, ty = -6, tz = 0) { camera.setPosition(x, y, z); controls.target.set([tx, ty, tz]); camera.lookAt(tx, ty, tz); controls.syncFromCamera(); },
    async dispose() { loopHandle.dispose(); view.dispose(); await engine.dispose(); },
  };
}

main().catch((cause) => { report('Failed: ' + (cause?.message ?? cause)); globalThis.__world3dLandscape = { frames: 0, error: String(cause?.stack ?? cause) }; });
