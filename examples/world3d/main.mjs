// SPDX-License-Identifier: Apache-2.0
// World3D example: lit and shadowed primitives, instancing, skinning, morph
// targets, particles, sprites, a render target, picking and orbit controls,
// all driven by the explicit Engine clock.
import { createEngine } from '@egret/engine';
import {
  AnimationMixer3D, Attribute3D, Bone3D, InstancedMesh3D, Mesh3D, Raycaster3D, RenderTarget3D, Scene3D, Skeleton3D, Texture3D,
  createAmbientLight3D, createAnimationClip3D, createAxesHelper3D, createBoxGeometry3D, createCylinderGeometry3D,
  createDirectionalLight3D, createGradientCubeTexture3D, createGridHelper3D, createLambertMaterial3D, createParticleEmitter3D,
  createPerspectiveCamera3D, createPhongMaterial3D, createPlaneGeometry3D, createPointLight3D, createSphereGeometry3D,
  createSpotLight3D, createSprite3D, createStandardMaterial3D, createTorusGeometry3D, createUnlitMaterial3D,
} from '@egret/engine/world3d';
import {
  createOrbitControls3D, createWebGL2Renderer3D, createWorld3DHost, createWorld3DView, startWorld3DLoop,
} from '@egret/engine/webgl2/world3d';

const canvas = document.querySelector('#stage');
const status = document.querySelector('#status');
const report = (text) => { status.textContent = text; };

/** Procedural two-tone checker, authored as straight-alpha sRGB bytes. */
function createCheckerTexture(size, cells, a, b) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = ((Math.floor(x * cells / size) + Math.floor(y * cells / size)) & 1) === 0 ? a : b;
      data.set([color[0], color[1], color[2], 255], (y * size + x) * 4);
    }
  }
  return new Texture3D({ width: size, height: size, data }, { anisotropy: 4 });
}
/** Soft round dot with falling alpha, used by sprites and particles. */
function createDotTexture(size) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) * 2;
      data.set([255, 255, 255, Math.round(255 * Math.max(0, 1 - d) ** 2)], (y * size + x) * 4);
    }
  }
  return new Texture3D({ width: size, height: size, data }, { wrapS: 'clamp', wrapT: 'clamp' });
}

/** A bending column: one cylinder skinned to a chain of four bones. */
function createSkinnedColumn() {
  const height = 3, segments = 24, boneCount = 4;
  const geometry = createCylinderGeometry3D({ radiusTop: 0.22, radiusBottom: 0.3, height, radialSegments: 20, heightSegments: segments });
  const positions = geometry.getAttribute('position').data;
  const joints = new Uint16Array(positions.length / 3 * 4), weights = new Float32Array(positions.length / 3 * 4);
  for (let i = 0; i < positions.length / 3; i++) {
    // Blend each vertex between the two bones nearest to its height.
    const t = (positions[i * 3 + 1] / height + 0.5) * (boneCount - 1);
    const lower = Math.min(Math.floor(t), boneCount - 2), k = t - lower;
    joints.set([lower, lower + 1, 0, 0], i * 4);
    weights.set([1 - k, k, 0, 0], i * 4);
  }
  geometry.setAttribute('joints', new Attribute3D(joints, 4));
  geometry.setAttribute('weights', new Attribute3D(weights, 4));
  const mesh = new Mesh3D(geometry, createStandardMaterial3D({ color: 0x4fb3a5, roughness: 0.45, metallic: 0.1 }));
  mesh.name = 'column';
  const bones = [];
  for (let i = 0; i < boneCount; i++) {
    const bone = new Bone3D();
    bone.name = 'column-bone-' + i;
    bone.setPosition(0, i === 0 ? -height / 2 : height / (boneCount - 1), 0);
    if (i === 0) mesh.addChild(bone); else bones[i - 1].addChild(bone);
    bones.push(bone);
  }
  mesh.updateWorldMatrices();
  mesh.bind(new Skeleton3D(bones));
  // Sway: every bone above the root rotates about Z, a quarter turn out of phase.
  const times = [0, 1, 2, 3, 4], tracks = [];
  for (let i = 1; i < boneCount; i++) {
    const values = [];
    for (const time of times) {
      const angle = Math.sin(time / 4 * Math.PI * 2 + i * 0.6) * 0.28;
      values.push(0, 0, Math.sin(angle / 2), Math.cos(angle / 2));
    }
    tracks.push({ targetName: 'column-bone-' + i, path: 'quaternion', times, values });
  }
  return { mesh, clip: createAnimationClip3D({ name: 'sway', tracks }) };
}

/** Sphere with one morph target that squashes it into a disc. */
function createMorphSphere() {
  const geometry = createSphereGeometry3D({ radius: 0.6, widthSegments: 32, heightSegments: 20 });
  const base = geometry.getAttribute('position').data, delta = new Float32Array(base.length);
  for (let i = 0; i < base.length; i += 3) {
    delta[i] = base[i] * 0.5; delta[i + 1] = -base[i + 1] * 0.6; delta[i + 2] = base[i + 2] * 0.5;
  }
  geometry.setMorphTargets([{ name: 'squash', position: delta }]);
  const mesh = new Mesh3D(geometry, createPhongMaterial3D({ color: 0xe8a23a, shininess: 60 }));
  mesh.name = 'morph-sphere';
  return mesh;
}

async function main() {
  const engine = await createEngine({ host: createWorld3DHost(canvas) });
  const scope = engine.createScope();
  const renderer = createWebGL2Renderer3D({ canvas, antialias: true, toneMapping: 'aces' });
  scope.use(renderer);

  const scene = new Scene3D();
  const sky = createGradientCubeTexture3D([70, 120, 210], [200, 215, 235], [70, 66, 62], 64);
  scene.background = sky;
  scene.environment = sky;
  scene.environmentIntensity = 0.35;
  scene.fog = { kind: 'exponential', color: [0.58, 0.66, 0.78], density: 0.018 };

  const camera = createPerspectiveCamera3D({ fov: 50, near: 0.1, far: 200 });
  camera.setPosition(7, 5, 9);
  scene.addChild(camera);

  scene.addChild(createAmbientLight3D({ color: 0xffffff, intensity: 0.08 }));
  const sun = createDirectionalLight3D({ color: 0xfff1d6, intensity: 1.5, castShadow: true });
  sun.setPosition(6, 10, 4).lookAt(0, 0, 0);
  Object.assign(sun.shadow, { extent: 12, near: 1, far: 30 });
  scene.addChild(sun);
  const spot = createSpotLight3D({ color: 0x9fc4ff, intensity: 60, range: 18, angle: Math.PI / 7, penumbra: 0.35, castShadow: true });
  spot.setPosition(-5, 6, 3).lookAt(-2, 0, 0);
  scene.addChild(spot);
  const lamp = createPointLight3D({ color: 0xff7a3d, intensity: 12, range: 7 });
  lamp.setPosition(2.5, 1.2, 2.5);
  scene.addChild(lamp);

  const checker = createCheckerTexture(256, 8, [214, 214, 208], [118, 124, 132]);
  checker.repeat.set([6, 6]);
  const ground = new Mesh3D(createPlaneGeometry3D({ width: 30, height: 30 }), createStandardMaterial3D({ map: checker, roughness: 0.9 }));
  ground.name = 'ground';
  ground.setRotation(-Math.PI / 2, 0, 0);
  ground.castShadow = false;
  scene.addChild(ground);
  scene.addChild(createGridHelper3D(30, 30, 0x5a6478)).setPosition(0, 0.002, 0);
  scene.addChild(createAxesHelper3D(1.5)).setPosition(0, 0.01, 0);

  const pickable = [];
  const add = (mesh, x, y, z) => { mesh.setPosition(x, y, z); scene.addChild(mesh); pickable.push(mesh); return mesh; };
  const metal = add(new Mesh3D(createSphereGeometry3D({ radius: 0.8, widthSegments: 48, heightSegments: 32 }),
    createStandardMaterial3D({ color: 0xd9dde4, metallic: 1, roughness: 0.22 })), -2.4, 0.8, 0);
  metal.name = 'metal-sphere';
  const box = add(new Mesh3D(createBoxGeometry3D({ width: 1.2, height: 1.2, depth: 1.2 }),
    createStandardMaterial3D({ color: 0xc94f4f, roughness: 0.55 })), 0, 0.6, 0);
  box.name = 'box';
  const torus = add(new Mesh3D(createTorusGeometry3D({ radius: 0.7, tube: 0.25 }), createLambertMaterial3D({ color: 0x6f8fe8 })), 2.4, 1.1, 0);
  torus.name = 'torus';
  const morph = add(createMorphSphere(), 0, 0.7, 2.6);
  const { mesh: column, clip } = createSkinnedColumn();
  add(column, -2.4, 1.5, -3);

  // A field of instanced pillars, tinted per instance.
  const pillars = new InstancedMesh3D(createBoxGeometry3D({ width: 0.25, height: 1, depth: 0.25 }), createLambertMaterial3D({ color: 0xffffff }), 400);
  pillars.name = 'pillars';
  for (let i = 0; i < 400; i++) {
    const x = (i % 20) - 9.5, z = Math.floor(i / 20) - 9.5, height = 0.3 + ((i * 2654435761) >>> 24) / 255 * 1.2;
    pillars.setTransformAt(i, [x * 0.6 + 7, height / 2, z * 0.6 - 7], [0, 0, 0, 1], [1, height, 1]);
    pillars.setColorAt(i, 0.3 + (i % 20) / 28, 0.5, 0.9 - Math.floor(i / 20) / 28);
  }
  scene.addChild(pillars);

  const dot = createDotTexture(64);
  const fire = createParticleEmitter3D({
    capacity: 600, rate: 120, lifetime: [0.7, 1.4], speed: [0.8, 1.8], spread: 0.35, gravity: [0, 0.6, 0],
    startSize: 0.32, endSize: 0.04, startColor: [1, 0.55, 0.12], endColor: [0.9, 0.08, 0.02], startOpacity: 0.45, endOpacity: 0,
    shape: 'sphere', radius: 0.15, map: dot, seed: 7,
  });
  fire.setPosition(2.5, 0.2, 2.5);
  scene.addChild(fire);
  const marker = createSprite3D({ map: dot, color: 0x9bffb0 });
  marker.setPosition(-2.4, 3.4, -3).setScale(0.6);
  scene.addChild(marker);

  // A second camera renders the scene into a texture shown on a screen.
  const target = new RenderTarget3D(384, 216);
  scope.use(target);
  const monitorCamera = createPerspectiveCamera3D({ fov: 60, aspect: 384 / 216, near: 0.1, far: 100 });
  monitorCamera.setPosition(0, 9, 0.01).lookAt(0, 0, 0);
  scene.addChild(monitorCamera);
  const monitor = new Mesh3D(createPlaneGeometry3D({ width: 3.2, height: 1.8 }), createUnlitMaterial3D({ map: target.texture }));
  monitor.name = 'monitor';
  monitor.setPosition(0, 2.2, -5);
  monitor.castShadow = false;
  scene.addChild(monitor);

  const mixer = new AnimationMixer3D(column);
  mixer.clipAction(clip).play();
  const controls = createOrbitControls3D(camera, canvas, { target: [0, 0.8, 0], minDistance: 2, maxDistance: 40, maxPolarAngle: Math.PI * 0.49 });
  scope.use(controls);

  let frames = 0, lastError = '';
  const view = createWorld3DView(engine, scope, {
    renderer, scene, camera, mixers: [mixer], controls,
    onUpdate(deltaSeconds, elapsedSeconds) {
      box.rotateOnAxis([0, 1, 0], deltaSeconds * 0.6);
      torus.rotateOnAxis([1, 0, 0], deltaSeconds * 0.9);
      morph.morphWeights[0] = Math.sin(elapsedSeconds * 2) * 0.5 + 0.5;
      // The screen is hidden while its own texture is being drawn.
      monitor.visible = false;
      renderer.render(scene, monitorCamera, target);
      monitor.visible = true;
    },
    onError(cause) { lastError = String(cause?.stack ?? cause); report('Error: ' + (cause?.message ?? cause)); },
  });

  const raycaster = new Raycaster3D();
  let selected;
  // A press that travelled is an orbit drag, not a pick.
  let pressX = 0, pressY = 0;
  canvas.addEventListener('pointerdown', (event) => { pressX = event.clientX; pressY = event.clientY; });
  canvas.addEventListener('click', (event) => {
    if (Math.hypot(event.clientX - pressX, event.clientY - pressY) > 4) return;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2, camera);
    const hit = raycaster.intersect(scene, { firstHitOnly: true }).find((entry) => pickable.includes(entry.object));
    if (selected) selected.material.setEmissive(0x000000);
    selected = hit?.object;
    if (selected) selected.material.setEmissive(0x334422);
  });
  const toggle = (id, apply) => {
    const button = document.querySelector(id);
    button.addEventListener('click', () => {
      const pressed = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(pressed));
      apply(pressed);
    });
  };
  toggle('#shadows', (on) => { renderer.shadowsEnabled = on; });
  toggle('#particles', (on) => { fire.visible = on; });
  toggle('#wireframe', (on) => { for (const mesh of pickable) { mesh.material.wireframe = on; } });

  const loop = startWorld3DLoop(engine, (cause) => { lastError = String(cause?.stack ?? cause); report('Stopped: ' + (cause?.message ?? cause)); });
  engine.clock.onTick(scope, () => {
    frames++;
    if (frames % 30 === 0 && !lastError) {
      const info = renderer.info;
      report(`${info.drawCalls} draws · ${Math.round(info.triangles)} triangles · ${fire.aliveCount} particles / 粒子`);
    }
    return undefined;
  });
  // Read-only probe for automated checks of this example.
  globalThis.__world3dExample = {
    get frames() { return frames; },
    get error() { return lastError; },
    get info() { return { ...renderer.info, particles: fire.aliveCount, selected: selected?.name }; },
    readPixels: () => renderer.readPixels(),
    async dispose() { loop.dispose(); view.dispose(); await engine.dispose(); },
  };
}

main().catch((cause) => { report('Failed: ' + (cause?.message ?? cause)); globalThis.__world3dExample = { frames: 0, error: String(cause?.stack ?? cause) }; });
