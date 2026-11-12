// SPDX-License-Identifier: Apache-2.0
// World3D feature gallery: see-through and cloth materials, light maps, text,
// batches and wide lines; rigid bodies with joints, hulls, a moving platform
// and fast projectiles; post-processing; and a transform gizmo for editing.
// A fourth area has a walking, jumping character with a follow camera.
// One scene holds the areas, and the header buttons move the camera between them.
import { createEngine } from '@egret/engine';
import {
  Attribute3D, Mesh3D, Raycaster3D, Scene3D, Texture3D,
  createAmbientLight3D, createBatchedMesh3D, createBoxGeometry3D, createCapsuleGeometry3D, createCharacterMotor3D, createConvexHullShape3D, createCylinderGeometry3D,
  createDirectionalLight3D, createFatLine3D, createGlassMaterial3D, createGradientCubeTexture3D, createIcosahedronGeometry3D,
  createLambertMaterial3D, createPerspectiveCamera3D, createPhysicsWorld3D, createPlaneGeometry3D, createSphereGeometry3D,
  createStandardMaterial3D, createTextGeometry3D, createToonMaterial3D, createTorusKnotGeometry3D, createUnlitMaterial3D,
  mat4Compose, parseTrueTypeFont3D, parseTypefaceFont3D, quatFromAxisAngle,
} from '@egret/engine/world3d';

const useWebGPU = new URLSearchParams(location.search).get('backend') === 'webgpu';
const backend = await (useWebGPU ? import('@egret/engine/webgpu/world3d') : import('@egret/engine/webgl2/world3d'));
const { createFollowControls3D, createOrbitControls3D, createTransformControls3D, createWorld3DHost, createWorld3DView, startWorld3DLoop } = backend;

const canvas = document.querySelector('#stage');
const status = document.querySelector('#status');
const report = (text) => { status.textContent = text; };
const SELECTED = 2;   // layer bit traced by the outline pass

function checker(size, cells, a, b) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const color = ((Math.floor(x * cells / size) + Math.floor(y * cells / size)) & 1) === 0 ? a : b;
    data.set([color[0], color[1], color[2], 255], (y * size + x) * 4);
  }
  return new Texture3D({ width: size, height: size, data }, { anisotropy: 4 });
}
/**
 * A tiny built-in font so the page needs no font file: block capitals for the
 * title only. "Load font" replaces it with any TrueType file.
 */
const blockFont = parseTypefaceFont3D({ resolution: 1000, boundingBox: { yMin: -200, yMax: 800 }, glyphs: {
  E: { ha: 620, o: 'm 60 0 l 560 0 l 560 130 l 210 130 l 210 290 l 500 290 l 500 420 l 210 420 l 210 570 l 560 570 l 560 700 l 60 700' },
  G: { ha: 680, o: 'm 60 0 l 620 0 l 620 390 l 350 390 l 350 270 l 480 270 l 480 130 l 210 130 l 210 570 l 620 570 l 620 700 l 60 700' },
  R: { ha: 660, o: 'm 60 0 l 210 0 l 210 250 l 300 250 l 450 0 l 620 0 l 450 270 l 600 270 l 600 700 l 60 700 m 210 390 l 210 570 l 450 570 l 450 390' },
  T: { ha: 600, o: 'm 225 0 l 375 0 l 375 570 l 580 570 l 580 700 l 20 700 l 20 570 l 225 570' },
} });

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
  const sky = createGradientCubeTexture3D([70, 120, 210], [200, 215, 235], [70, 66, 62], 64);
  scene.background = sky; scene.environment = sky; scene.environmentIntensity = 0.5;
  const camera = createPerspectiveCamera3D({ fov: 50, near: 0.1, far: 300 });
  camera.setPosition(0, 4, 10);
  scene.addChild(camera);
  scene.addChild(createAmbientLight3D({ intensity: 0.12 }));
  const sun = createDirectionalLight3D({ color: 0xfff1d6, intensity: 1.6, castShadow: true });
  sun.setPosition(8, 14, 6).lookAt(0, 0, 0);
  Object.assign(sun.shadow, { cascades: 3, cascadeDistance: 60 });
  scene.addChild(sun);
  const ground = new Mesh3D(createPlaneGeometry3D({ width: 120, height: 60 }), createStandardMaterial3D({ map: checker(256, 8, [150, 156, 166], [112, 118, 130]), roughness: 0.9 }));
  ground.material.map.repeat.set([12, 6]);
  ground.setRotation(-Math.PI / 2, 0, 0);
  scene.addChild(ground);

  // ---- area 1: surfaces (around x = 0) -------------------------------------------
  const pickable = [];
  const place = (mesh, x, y, z, name) => { mesh.setPosition(x, y, z); mesh.name = name; mesh.castShadow = true; scene.addChild(mesh); pickable.push(mesh); return mesh; };
  const backdrop = new Mesh3D(createPlaneGeometry3D({ width: 12, height: 4 }), createUnlitMaterial3D({ map: checker(64, 12, [240, 130, 40], [20, 24, 60]) }));
  backdrop.setPosition(0, 2, -3);
  scene.addChild(backdrop);
  const ball = createSphereGeometry3D({ radius: 0.8, widthSegments: 40, heightSegments: 24 });
  place(new Mesh3D(ball, createGlassMaterial3D({ color: 0xe6f2ff })), -4.5, 0.9, 0, 'thin glass');
  place(new Mesh3D(ball, createGlassMaterial3D({ thickness: 1.2, ior: 1.5 })), -2.7, 0.9, 0, 'solid glass');
  const frosted = createGlassMaterial3D({ color: 0x99ffb3, thickness: 0.5, roughness: 0.55 });
  frosted.attenuationColor.set([0.4, 0.9, 0.5]); frosted.attenuationDistance = 0.5;
  place(new Mesh3D(ball, frosted), -0.9, 0.9, 0, 'frosted glass');
  const velvet = createStandardMaterial3D({ color: 0x40050d, roughness: 1 });
  velvet.sheen = 1; velvet.sheenColor.set([1, 0.5, 0.6]); velvet.sheenRoughness = 0.3;
  place(new Mesh3D(ball, velvet), 0.9, 0.9, 0, 'velvet');
  const lacquer = createStandardMaterial3D({ color: 0xb01020, roughness: 0.6, metallic: 0.2 });
  lacquer.clearcoat = 1; lacquer.clearcoatRoughness = 0.05;
  place(new Mesh3D(ball, lacquer), 2.7, 0.9, 0, 'clearcoat');
  place(new Mesh3D(createTorusKnotGeometry3D({ radius: 0.5, tube: 0.18 }), createToonMaterial3D({ color: 0x4f9de8, steps: 3 })), 4.5, 1, 0, 'toon');
  // A light map lives on the second coordinate set and adds baked light to a material.
  const bakedGeometry = createPlaneGeometry3D({ width: 1.6, height: 1.6 });
  bakedGeometry.setAttribute('uv1', new Attribute3D(bakedGeometry.getAttribute('uv').data.slice(), 2));
  const baked = createLambertMaterial3D({ color: 0xffffff });
  baked.lightMap = new Texture3D({ width: 2, height: 2, data: new Uint8Array([255, 60, 40, 255, 40, 255, 80, 255, 40, 80, 255, 255, 255, 230, 60, 255]) }, { channel: 1, mipmaps: false });
  place(new Mesh3D(bakedGeometry, baked), 6.3, 0.9, 0, 'light map');
  // Many different shapes sharing one material become a single draw call.
  const pebbles = createBatchedMesh3D(createLambertMaterial3D({ color: 0xffffff, vertexColors: true }));
  const shapes = [createBoxGeometry3D({ width: 0.3, height: 0.3, depth: 0.3 }), createIcosahedronGeometry3D({ radius: 0.2 }), createCylinderGeometry3D({ radiusTop: 0.12, radiusBottom: 0.18, height: 0.3 })];
  const matrix = new Float32Array(16), turn = [0, 0, 0, 1];
  for (let i = 0; i < 240; i++) {
    const angle = i * 2.399963, reach = 2.2 + Math.sqrt(i) * 0.25;
    quatFromAxisAngle(turn, [0, 1, 0], angle);
    mat4Compose(matrix, [Math.cos(angle) * reach, 0.15, 3.2 + Math.sin(angle) * reach * 0.35], turn, [1, 1, 1]);
    pebbles.setColorAt(pebbles.addGeometry(shapes[i % 3], matrix), 0.5 + (i % 5) * 0.1, 0.55, 0.9 - (i % 7) * 0.08);
  }
  scene.addChild(pebbles);
  const loop = [];
  for (let i = 0; i < 80; i++) loop.push(Math.cos(i / 80 * Math.PI * 2) * 6.6, 0.05 + Math.abs(Math.sin(i / 80 * Math.PI * 6)) * 0.5, 0.2 + Math.sin(i / 80 * Math.PI * 2) * 3.4);
  scene.addChild(createFatLine3D(loop, { width: 0.06, closed: true, color: 0xffd24a }));
  const titleMaterials = [createStandardMaterial3D({ color: 0xf2c14e, roughness: 0.4 }), createStandardMaterial3D({ color: 0x8a4f1d, roughness: 0.7 })];
  const title = place(new Mesh3D(createTextGeometry3D('EGRET', blockFont, { size: 1.1, depth: 0.3, align: 'center' }), titleMaterials), 0, 2.4, -1.2, 'title');
  const setTitle = (text, font) => { const old = title.geometry; title.geometry = createTextGeometry3D(text, font, { size: 1.1, depth: 0.3, align: 'center' }); old.dispose(); };

  // ---- area 2: physics (around x = 26) -------------------------------------------
  const world = createPhysicsWorld3D();
  world.createBody({ shape: { type: 'plane' } });
  const PX = 26, bodies = [];
  const solid = (geometry, material, options) => { const node = new Mesh3D(geometry, material); node.castShadow = true; scene.addChild(node); const body = world.createBody({ ...options, node }); bodies.push(body); return body; };
  const crate = createBoxGeometry3D({ width: 0.8, height: 0.8, depth: 0.8 }), crateMaterial = createStandardMaterial3D({ color: 0xc98a4b, roughness: 0.8 });
  for (let row = 0; row < 5; row++) for (let i = 0; i < 5 - row; i++) {
    solid(crate, crateMaterial, { shape: { type: 'box', halfExtents: [0.4, 0.4, 0.4] }, position: [PX - 5 + (i + row * 0.5) * 0.85, 0.4 + row * 0.8, -2] });
  }
  // Rocks: convex hulls built from the mesh they are drawn with.
  const rock = createIcosahedronGeometry3D({ radius: 0.5 }), hull = createConvexHullShape3D(rock), rockMaterial = createStandardMaterial3D({ color: 0x8a8f99, roughness: 1, flatShading: true });
  for (let i = 0; i < 8; i++) solid(rock, rockMaterial, { shape: { type: 'convex', hull }, position: [PX + 1 + (i % 3) * 0.3, 2 + i * 1.1, 1 + (i % 2) * 0.4] });
  // A rope of weights hanging between two posts.
  const bead = createSphereGeometry3D({ radius: 0.18 }), beadMaterial = createStandardMaterial3D({ color: 0xe0c060, metallic: 0.8, roughness: 0.3 });
  let previous;
  for (let i = 0; i < 14; i++) {
    const x = PX + 3 + i * 0.4, link = solid(bead, beadMaterial, { shape: { type: 'sphere', radius: 0.18 }, position: [x, 4, -3], mass: 0.3 });
    if (i === 0 || i === 13) world.createJoint({ type: 'point', bodyA: link, anchor: [x, 4, -3] });
    if (previous) world.createJoint({ type: 'distance', bodyA: previous, bodyB: link, rope: true, length: 0.48 });
    previous = link;
  }
  // A door on a hinge with limits, pushed back and forth by a motor.
  const door = solid(createBoxGeometry3D({ width: 1.6, height: 2, depth: 0.12 }), createStandardMaterial3D({ color: 0x5a7fbf, roughness: 0.5 }), { shape: { type: 'box', halfExtents: [0.8, 1, 0.06] }, position: [PX - 2.2, 1.05, 2.5] });
  const hinge = world.createJoint({ type: 'hinge', bodyA: door, anchor: [PX - 3, 1.05, 2.5], axis: [0, 1, 0], limits: [-1.2, 1.2], motorSpeed: 1, maxMotorTorque: 30 });
  // A platform that moves on its own and carries what stands on it.
  const lift = solid(createBoxGeometry3D({ width: 2.4, height: 0.2, depth: 2.4 }), createStandardMaterial3D({ color: 0x3fa37a, roughness: 0.6 }), { type: 'kinematic', shape: { type: 'box', halfExtents: [1.2, 0.1, 1.2] }, position: [PX + 6, 0.5, 2] });
  solid(crate, crateMaterial, { shape: { type: 'box', halfExtents: [0.4, 0.4, 0.4] }, position: [PX + 6, 1.1, 2] });
  // A thin wall for fast projectiles: without continuous collision they would pass through it.
  solid(createBoxGeometry3D({ width: 6, height: 3, depth: 0.08 }), createGlassMaterial3D({ color: 0xcfe8ff, thickness: 0.08 }), { type: 'static', shape: { type: 'box', halfExtents: [3, 1.5, 0.04] }, position: [PX, 1.5, -5] });
  const shotGeometry = createSphereGeometry3D({ radius: 0.12 }), shotMaterial = createStandardMaterial3D({ color: 0xff5533, emissive: [1, 0.3, 0.1] });
  shotMaterial.emissiveIntensity = 3;
  const shots = [];
  const shoot = () => {
    const forward = [-camera.matrixWorld[8], -camera.matrixWorld[9], -camera.matrixWorld[10]], p = camera.getWorldPosition();
    const shot = solid(shotGeometry, shotMaterial, { shape: { type: 'sphere', radius: 0.12 }, position: [p[0] + forward[0], p[1] + forward[1], p[2] + forward[2]], mass: 0.5, continuous: true });
    shot.setLinearVelocity(forward[0] * 120, forward[1] * 120, forward[2] * 120);
    shots.push(shot);
    if (shots.length > 30) { const old = shots.shift(); old.node.removeFromParent(); world.removeBody(old); bodies.splice(bodies.indexOf(old), 1); }
  };

  // ---- area 4: character (around z = 26) -----------------------------------------
  const CZ = 26, stone = createStandardMaterial3D({ color: 0x9aa3b5, roughness: 0.9 });
  const block = (w, h, d, x, y, z, options = {}) => solid(createBoxGeometry3D({ width: w, height: h, depth: d }), options.material ?? stone, { type: 'static', shape: { type: 'box', halfExtents: [w / 2, h / 2, d / 2] }, position: [x, y, z], ...options.body });
  for (let i = 0; i < 6; i++) block(0.5, 0.2 * (i + 1), 3, 3 + i * 0.5, 0.1 * (i + 1), CZ);            // stairs
  block(4, 0.2, 3, 7.75, 1.1, CZ);                                                                     // landing at the top
  block(5, 0.2, 3, 12.1, 0.52, CZ, { body: { quaternion: [0, 0, Math.sin(-0.125), Math.cos(-0.125)] } }); // ramp back down
  block(0.3, 1.6, 4, -4, 0.8, CZ - 4);                                                                 // a wall for the camera to meet
  // A turntable and a ferry: standing on either carries the character along.
  const turntable = solid(createCylinderGeometry3D({ radiusTop: 2, radiusBottom: 2, height: 0.2, radialSegments: 32 }), createStandardMaterial3D({ color: 0xb565c9, roughness: 0.6 }), { type: 'kinematic', shape: { type: 'box', halfExtents: [1.5, 0.1, 1.5] }, position: [-4, 0.1, CZ + 3] });
  turntable.setAngularVelocity(0, 0.8, 0);
  const ferry = solid(createBoxGeometry3D({ width: 2.4, height: 0.2, depth: 2.4 }), createStandardMaterial3D({ color: 0x3fa37a, roughness: 0.6 }), { type: 'kinematic', shape: { type: 'box', halfExtents: [1.2, 0.1, 1.2] }, position: [0, 0.1, CZ + 6] });
  for (let i = 0; i < 4; i++) solid(crate, crateMaterial, { shape: { type: 'box', halfExtents: [0.4, 0.4, 0.4] }, position: [-1 + i * 1.1, 0.4, CZ - 3] });   // loose crates to push
  const hero = new Mesh3D(createCapsuleGeometry3D({ radius: 0.35, height: 1.1 }), createStandardMaterial3D({ color: 0xff8a3d, roughness: 0.5 }));
  hero.castShadow = true; hero.name = 'hero';
  const nose = new Mesh3D(createBoxGeometry3D({ width: 0.2, height: 0.2, depth: 0.3 }), createStandardMaterial3D({ color: 0x222222 }));
  nose.setPosition(0, 0.5, -0.4); hero.addChild(nose);
  scene.addChild(hero);
  const motor = createCharacterMotor3D(world, { radius: 0.35, height: 1.8, position: [0, 0.95, CZ], node: hero, jumpSpeed: 5.5 });
  let facing = 0, characterMode = false, jumpQueued = false;
  const keys = new Set();
  addEventListener('keydown', (event) => { if (!characterMode) return; keys.add(event.code); if (event.code === 'Space') { jumpQueued = true; event.preventDefault(); } });
  addEventListener('keyup', (event) => { keys.delete(event.code); });
  addEventListener('blur', () => keys.clear());

  // ---- area 3: editing (around x = -26) ------------------------------------------
  const EX = -26;
  place(new Mesh3D(createBoxGeometry3D({}), createStandardMaterial3D({ color: 0x5aa0e6, roughness: 0.5 })), EX - 2, 0.5, 0, 'box');
  place(new Mesh3D(createCylinderGeometry3D({ radiusTop: 0.4, radiusBottom: 0.6, height: 1.4 }), createStandardMaterial3D({ color: 0xe6a05a, roughness: 0.5 })), EX, 0.7, 0, 'column');
  place(new Mesh3D(createTorusKnotGeometry3D({ radius: 0.5, tube: 0.16 }), createStandardMaterial3D({ color: 0x9be65a, roughness: 0.3, metallic: 0.5 })), EX + 2.2, 1, 0, 'knot');

  // The transform controls come first so a press on a handle never reaches the orbit controls.
  const transform = createTransformControls3D(camera, canvas);
  scope.use(transform);
  scene.addChild(transform.gizmo);
  const controls = createOrbitControls3D(camera, canvas, { target: [0, 1, 0], minDistance: 2, maxDistance: 60, maxPolarAngle: Math.PI * 0.49 });
  scope.use(controls);
  // The follow camera stays behind the character and moves in when a wall would hide it.
  const follow = createFollowControls3D(camera, canvas, hero, { world, distance: 6, height: 0.6, pitch: 0.35 });
  scope.use(follow);
  follow.enabled = false;
  const post = renderer.postProcess;
  Object.assign(post, { enabled: true, bloom: true, bloomThreshold: 1.2, ssao: true, ssaoRadius: 0.6, fxaa: true, outlineLayers: SELECTED, outlineColor: [1, 0.85, 0.2], outlineThickness: 2, dofFocus: 10, dofRange: 4, dofRadius: 6 });

  let selected;
  const select = (mesh) => {
    if (selected) selected.layers &= ~SELECTED;
    selected = mesh;
    if (mesh) { mesh.layers |= SELECTED; transform.attach(mesh); } else transform.detach();
  };
  const raycaster = new Raycaster3D();
  let pressX = 0, pressY = 0;
  canvas.addEventListener('pointerdown', (event) => { pressX = event.clientX; pressY = event.clientY; });
  canvas.addEventListener('click', (event) => {
    // A press that travelled was an orbit or a handle drag, not a pick.
    if (Math.hypot(event.clientX - pressX, event.clientY - pressY) > 4 || transform.gizmo.activeHandle) return;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2, camera);
    select(raycaster.intersect(scene, { firstHitOnly: true }).find((entry) => pickable.includes(entry.object))?.object);
  });

  const view = createWorld3DView(engine, scope, {
    renderer, scene, camera, controls: { update(deltaSeconds) { if (!characterMode) controls.update(deltaSeconds); } },
    onUpdate(deltaSeconds, elapsedSeconds) {
      // The motor reverses when the door reaches a limit, and the lift follows a slow circle.
      if (hinge.angle > 1.15) hinge.motorSpeed = -1; else if (hinge.angle < -1.15) hinge.motorSpeed = 1;
      lift.setLinearVelocity(Math.cos(elapsedSeconds * 0.6) * 1.2, Math.sin(elapsedSeconds * 0.9) * 0.6, 0);
      turntable.setAngularVelocity(0, 0.8, 0);
      ferry.setLinearVelocity(Math.cos(elapsedSeconds * 0.5) * 2, 0, 0);
      world.step(deltaSeconds);
      // The character moves after the world, relative to the camera: W or Up walks away from the viewer.
      const forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0), right = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const wish = follow.follow.moveDirection(forward, right), size = Math.hypot(wish[0], wish[2]) || 1, speed = keys.has('ShiftLeft') ? 6 : 3.5;
      motor.update(deltaSeconds, wish[0] / size * speed * (forward || right ? 1 : 0), wish[2] / size * speed * (forward || right ? 1 : 0), jumpQueued);
      jumpQueued = false;
      facing += motor.carriedYaw;
      if (forward || right) facing = Math.atan2(-wish[0], -wish[2]);
      quatFromAxisAngle(hero.quaternion, [0, 1, 0], facing); hero.markTransformDirty();
      if (motor.position[1] < -20) motor.teleport(0, 0.95, CZ);
      if (characterMode) follow.update(deltaSeconds);
      transform.update();
    },
    onError(cause) { lastError = String(cause?.stack ?? cause); report('Error: ' + (cause?.message ?? cause)); },
  });

  const setCharacterMode = (on) => { characterMode = on; controls.enabled = !on; follow.enabled = on; transform.enabled = !on; if (on) select(undefined); else keys.clear(); document.querySelector('#character').setAttribute('aria-pressed', String(on)); };
  const go = (x, eye) => { setCharacterMode(false); controls.target.set([x, 1, 0]); camera.setPosition(x + eye[0], eye[1], eye[2]); controls.syncFromCamera(); controls.update(0); };
  const press = (id, action) => document.querySelector(id).addEventListener('click', action);
  press('#surfaces', () => go(0, [0, 3.5, 10]));
  press('#physics', () => go(PX, [0, 5, 13]));
  press('#editing', () => { go(EX, [0, 4, 8]); if (!selected) select(pickable.find((mesh) => mesh.name === 'column')); });
  press('#character', () => { setCharacterMode(true); canvas.focus(); });
  press('#shoot', shoot);
  for (const mode of ['translate', 'rotate', 'scale']) press('#' + mode, () => { transform.mode = mode; });
  press('#space', (event) => { transform.space = transform.space === 'world' ? 'local' : 'world'; event.currentTarget.textContent = transform.space === 'world' ? 'World / 世界' : 'Local / 本地'; });
  const toggle = (id, apply) => {
    const button = document.querySelector(id);
    button.addEventListener('click', () => { const pressed = button.getAttribute('aria-pressed') !== 'true'; button.setAttribute('aria-pressed', String(pressed)); apply(pressed); });
  };
  toggle('#post', (on) => { post.enabled = on; });
  toggle('#ssao', (on) => { post.ssao = on; });
  toggle('#dof', (on) => { post.dof = on; });
  toggle('#shadows', (on) => { renderer.shadowsEnabled = on; });
  document.querySelector('#font').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const font = parseTrueTypeFont3D(await file.arrayBuffer());
      setTitle(document.querySelector('#text').value || 'Egret 白鹭', font);
      loadedFont = font;
    } catch (cause) { report('Font / 字体: ' + (cause?.message ?? cause)); }
  });
  let loadedFont;
  document.querySelector('#text').addEventListener('change', (event) => {
    // The built-in font has only the four letters of the default title.
    if (!loadedFont) { report('Load a .ttf font first / 请先加载 .ttf 字体'); return; }
    try { setTitle(event.target.value, loadedFont); } catch (cause) { report('Text / 文字: ' + (cause?.message ?? cause)); }
  });

  const loopHandle = startWorld3DLoop(engine, (cause) => { lastError = String(cause?.stack ?? cause); report('Stopped: ' + (cause?.message ?? cause)); });
  engine.clock.onTick(scope, () => {
    frames++;
    if (frames % 30 === 0 && !lastError) {
      const info = renderer.info;
      report(`${info.drawCalls} draws · ${Math.round(info.triangles)} triangles · ${world.contactCount} contacts / 接触点${selected ? ' · ' + selected.name : ''}`);
    }
    return undefined;
  });
  // Read-only probe for automated checks of this example.
  globalThis.__world3dFeatures = {
    get frames() { return frames; },
    get error() { return lastError || deviceLost; },
    get info() { return { ...renderer.info, contacts: world.contactCount, bodies: world.bodies.length, selected: selected?.name, doorAngle: hinge.angle }; },
    get hero() { return { position: [...motor.position], grounded: motor.isGrounded, ground: motor.groundBody?.type, cameraDistance: follow.follow.currentDistance }; },
    backend: useWebGPU ? 'webgpu' : 'webgl2',
    get selectedPosition() { return selected ? [...selected.getWorldPosition()] : undefined; },
    get dragging() { return transform.dragging; },
    get handle() { return transform.gizmo.activeHandle; },
    get selectedScale() { return selected ? [...selected.scale] : undefined; },
    get cameraPosition() { return [...camera.position]; },
    /** Client coordinates of a world point, for pointer-driven checks. */
    toClient(point) { camera.updateViewMatrices(); const ndc = camera.worldToScreenPoint([0, 0, 0], point), rect = canvas.getBoundingClientRect(); return [rect.left + (ndc[0] + 1) / 2 * rect.width, rect.top + (1 - ndc[1]) / 2 * rect.height]; },
    get gizmoScale() { return transform.gizmo.scale[0]; },
    go, shoot, select: (name) => select(pickable.find((mesh) => mesh.name === name)),
    async dispose() { loopHandle.dispose(); view.dispose(); await engine.dispose(); },
  };
}

main().catch((cause) => { report('Failed: ' + (cause?.message ?? cause)); globalThis.__world3dFeatures = { frames: 0, error: String(cause?.stack ?? cause) }; });
