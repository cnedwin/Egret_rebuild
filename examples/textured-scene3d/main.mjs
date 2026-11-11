// SPDX-License-Identifier: Apache-2.0
import { Bitmap, createAssetRef, createAssetType, createEngineForProfile, isTexture } from '@egret/engine';
import { createSceneCamera3D, createSceneWorldCard3D, prepareTexturedStaticGlbScene3D } from '@egret/engine/scene3d/authoring';
import { createBrowserTextureProvider } from '@egret/engine/web/image';
import { createTexturedRoomGlb } from './room-glb.mjs';

const canvas = document.querySelector('canvas');
const label = document.querySelector('[role=status]');
const buttons = [...document.querySelectorAll('button')];
const backend = new URLSearchParams(location.search).get('backend') ?? 'webgl2';
const viewport = { width: 144, height: 96, clearAlpha: 1, outputAlpha: 'opaque' };
const camera = createSceneCamera3D({ eye: [0, 0, 5], target: [0, 0, 0],
  projection: { kind: 'orthographic', height: 3, aspect: 1.5, near: 1, far: 12 } });
const observed = promise => { void promise.catch(() => {}); return promise; };
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const actorMatrix = z => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, z, 1];
let engine, host, scope, provider, world, device, closing;
let closingRequested = false;
let tail = Promise.resolve();
function checkOpen() { if (closingRequested) throw Error('Textured scene closing'); }

async function acquireDevice() {
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) throw Error('WebGPU adapter unavailable');
  return adapter.requestDevice();
}

async function createHost() {
  const options = { canvas, pixelRatio: 1, outputAlpha: 'opaque', enableReadback: true };
  if (backend === 'webgl2') {
    const { createSharedSceneWebGL2Host } = await import('@egret/engine/webgl2/scene3d');
    return createSharedSceneWebGL2Host(options);
  }
  if (backend === 'webgpu') {
    const { createSharedSceneWebGPUHost } = await import('@egret/engine/webgpu/scene3d');
    device = await acquireDevice();
    return createSharedSceneWebGPUHost({ ...options, device: { kind: 'borrow', device },
      recovery: { mode: 'manual', timeoutMs: 5000 } });
  }
  throw Error('Unknown backend');
}

async function draw(mode, staged) {
  checkOpen();
  const selected = mode === 'front' ? world.withNodeTransform('actor', actorMatrix(1)) : world;
  const scene = selected.capture(camera);
  const overlay = engine.captureSharedFrame(viewport);
  let stage;
  try {
    if (staged) {
      stage = host.stageSceneSharedFrame(scene, overlay);
      await stage.ready;
    }
    const readback = observed(host.requestReadback());
    if (stage) await stage.submit().completed;
    else host.renderSceneSharedFrame(scene, overlay);
    const result = { pixels: await readback, scene };
    await host.whenIdle();
    label.textContent = mode === 'front' ? 'Actor in front / 角色在前' : 'Actor behind / 角色在后';
    return result;
  } finally { stage?.dispose(); }
}

function state() {
  const { resources } = host.getSharedStatus();
  return { generation: host.getSessionStatus().generation, uploads: resources.totals.pageWriteCalls,
    pages: resources.current.images.readyEntries, bytes: resources.current.images.readyBytes };
}

async function recover() {
  if (backend === 'webgl2') {
    const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
    if (!extension) throw Error('WEBGL_lose_context unavailable');
    const event = name => new Promise(resolve => canvas.addEventListener(name, resolve, { once: true }));
    const lost = event('webglcontextlost');
    extension.loseContext();
    const lostTrusted = (await lost).isTrusted;
    await delay(100);
    const restored = event('webglcontextrestored');
    extension.restoreContext();
    await host.whenReady();
    return { lostTrusted, restoredTrusted: (await restored).isTrusted };
  }
  const lost = observed(device.lost);
  device.destroy();
  const { reason } = await lost;
  const deadline = performance.now() + 3000;
  while (host.getSessionStatus().state !== 'lost') {
    if (performance.now() >= deadline) throw Error('Host did not observe actual GPU loss');
    await delay(10);
  }
  device = await acquireDevice();
  await host.recover(device);
  await host.whenReady();
  return { reason };
}

const ready = (async () => {
  const plan = prepareTexturedStaticGlbScene3D(createTexturedRoomGlb());
  host = await createHost();
  checkOpen();
  engine = await createEngineForProfile({ host }, 'egret.shared-frame2d/1');
  checkOpen();
  scope = engine.createScope();
  const type = createAssetType('example-glb-png', isTexture);
  const encoded = new Map(plan.images.map(request => [String(request.imageIndex), request]));
  provider = createBrowserTextureProvider({ async readBytes(ref) {
    const request = encoded.get(ref.id);
    if (!request) throw Error('Missing embedded PNG');
    return request.copyBytes();
  } });
  engine.assets.register(type, provider);
  const images = await Promise.all(plan.images.map(async request => {
    const lease = await engine.assets.acquire(createAssetRef(type, String(request.imageIndex)), { signal: scope.signal });
    if (scope.state !== 'open') { lease.release(); checkOpen(); }
    scope.use(lease);
    return { imageIndex: request.imageIndex, source: lease.value.imageData, lease };
  }));
  checkOpen();
  const shared = images[0];
  const card = createSceneWorldCard3D({ source: shared.source, width: .8, height: .8, pivotY: 1 });
  world = plan.bindImages(images).withNodes([{ id: 'actor', localMatrix: actorMatrix(-1), cards: [card] }]);
  const hud = engine.stage.addChild(scope.use(new Bitmap(shared.lease)));
  hud.x = 2; hud.y = 2; hud.scaleX = 4; hud.scaleY = 4;
  if (!new URLSearchParams(location.search).has('probe')) await draw('behind', false);
  if (!closingRequested) for (const button of buttons) button.disabled = false;
})();
void ready.catch(error => { label.textContent = String(error); });
for (const button of buttons) button.addEventListener('click', () => {
  tail = tail.catch(() => {}).then(() => ready).then(() => draw(button.dataset.view, false));
  void tail.catch(error => { label.textContent = String(error); });
});
function close() {
  if (closing) return closing;
  closingRequested = true;
  for (const button of buttons) button.disabled = true;
  closing = (async () => {
    try {
      scope?.dispose();
      await ready.catch(() => {});
      await tail.catch(() => {});
    } finally {
      try {
        if (engine) await engine.dispose();
        else if (host) await host.close();
      } finally {
        // Shut down the host before releasing the device borrowed by it.
        try { await provider?.close(); } finally { device?.destroy(); }
      }
    }
  })();
  return closing;
}
window.egretTexturedScene3D = Object.freeze({ ready, draw, state, recover, close });
window.addEventListener('pagehide', () => { void close().catch(() => {}); }, { once: true });
