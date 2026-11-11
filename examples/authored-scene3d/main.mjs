// SPDX-License-Identifier: Apache-2.0
import { Sprite, createEngineForProfile } from '@egret/engine';
import { createSceneCamera3D, loadStaticGlbScene3D } from '@egret/engine/scene3d/authoring';
import { createPanelGlb } from './room-glb.mjs';

const canvas = document.querySelector('#scene');
const status = document.querySelector('#status');
const controls = [...document.querySelectorAll('[data-view]')];
const backend = new URLSearchParams(location.search).get('backend') ?? 'webgl2';
const width = 120, height = 96;
const frameOptions = { width, height, clearColor: 0, clearAlpha: 1, outputAlpha: 'opaque' };
const aspect = width / height;
const perspective = { kind: 'perspective', verticalFov: Math.PI / 3, aspect, near: 1, far: 12 };
const cameraOptions = { eye: [0, 0, 5], target: [0, 0, 0], projection: perspective };
const views = new Set(['initial', 'reversed', 'moved', 'orbit', 'orthographic']);
let engine, host, world, reverseWorld, tail = Promise.resolve(), closing;
let result;

function label(en, zh) { status.textContent = en + ' / ' + zh; }
async function createHost() {
  const options = { canvas, pixelRatio: 1, outputAlpha: 'opaque', enableReadback: true };
  if (backend === 'webgl2') {
    const { createSharedSceneWebGL2Host } = await import('@egret/engine/webgl2/scene3d');
    return createSharedSceneWebGL2Host(options);
  }
  if (backend === 'webgpu') {
    const { createSharedSceneWebGPUHost } = await import('@egret/engine/webgpu/scene3d');
    return createSharedSceneWebGPUHost(options);
  }
  throw new TypeError('Unknown backend: ' + backend);
}

async function render(view) {
  const camera = view === 'orbit'
    ? createSceneCamera3D({ ...cameraOptions, eye: [1.55, .3, 5], target: [.35, -.1, 0] })
    : view === 'orthographic'
      ? createSceneCamera3D({ ...cameraOptions, projection: { kind: 'orthographic', height: 5.7, aspect, near: 1, far: 12 } })
      : createSceneCamera3D(cameraOptions);
  let selected = view === 'reversed' ? reverseWorld : world;
  if (view === 'moved') {
    // The imported ID stays stable across revisions. This replaces the node-local matrix.
    selected = world.withNodeTransform('gltf-node-1', [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1.65, 0, 1, 1]);
  }
  const scene = selected.capture(camera);
  const overlay = engine.captureSharedFrame(frameOptions);
  const reading = host.requestReadback();
  void reading.catch(() => {});
  host.renderSceneSharedFrame(scene, overlay);
  const pixels = await reading;
  await host.whenIdle();
  result = { backend, view, nodeCount: selected.nodeCount, scene, pixels };
  label(backend + ' · ' + view, '已绘制');
}

const ready = (async () => {
  world = loadStaticGlbScene3D(createPanelGlb());
  reverseWorld = loadStaticGlbScene3D(createPanelGlb({ reverse: true }));
  host = await createHost();
  engine = await createEngineForProfile({ host }, 'egret.shared-frame2d/1');
  const scope = engine.createScope();
  const marker = engine.stage.addChild(scope.use(new Sprite()));
  marker.graphics.beginFill(0x00ff00).drawRect(58, 46, 4, 4).endFill();
  await render('initial');
  if (!closing) for (const button of controls) button.disabled = false;
})();
void ready.catch(error => label('Scene unavailable: ' + (error?.code ?? error?.message), '场景无法启动'));

function show(view) {
  if (!views.has(view)) return Promise.reject(new TypeError('Unknown view'));
  if (closing) return Promise.reject(new Error('Scene is closed.'));
  const task = tail.then(async () => { await ready; await render(view); });
  tail = task.catch(() => {});
  return task;
}

function inspect() {
  if (!result) return undefined;
  const { backend, view, nodeCount, scene, pixels } = result;
  const gl = backend === 'webgl2' ? canvas.getContext('webgl2') : null;
  const debug = gl?.getExtension('WEBGL_debug_renderer_info');
  return {
    backend, view, nodeCount, width: pixels.width, height: pixels.height,
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : undefined,
    firstDrawColor: scene.draws[0].geometry.colors.slice(0, 3),
    bytes: Array.from(pixels.bytes),
  };
}

function close() {
  if (closing) return closing;
  for (const button of controls) button.disabled = true;
  closing = (async () => {
    try { await ready; } catch { /* Startup already reported; retain ownership for cleanup. */ }
    await tail;
    if (engine) await engine.dispose();
    else if (host) await host.close();
  })();
  return closing;
}

for (const button of controls) button.addEventListener('click', () => {
  void show(button.dataset.view).catch(error => label(error?.code ?? error?.message, '绘制失败'));
});
window.addEventListener('pagehide', () => { void close().catch(() => {}); }, { once: true });
globalThis.egretAuthoredScene = Object.freeze({ ready, show, inspect, close });
