import { createEngine, Sprite, Bitmap, createImageData2D, createTexture, createAssetType, createAssetRef, isTexture } from '@egret/engine';
import { createMeshGeometry3D, createSceneFrame3D } from '@egret/engine/scene3d';
import { createSceneWebGPUHost } from '@egret/engine/webgpu/scene3d';

const canvas = document.querySelector('#scene'), status = document.querySelector('#status');
const redrawButton = document.querySelector('#redraw'), clipInput = document.querySelector('#clip'), closeButton = document.querySelector('#close');
const host = createSceneWebGPUHost({ canvas, pixelRatio: 1 });
const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
const red = createMeshGeometry3D({ positions: [-0.5,0.5,-3, 0.5,0.5,-3, 0.5,-0.5,-3, -0.5,-0.5,-3],
  colors: [1,0,0, 1,0,0, 1,0,0, 1,0,0], indices: [0,1,2, 0,2,3] });
const blue = createMeshGeometry3D({ positions: [-0.75,0.75,-7, 0.75,0.75,-7, 0.75,-0.75,-7, -0.75,-0.75,-7],
  colors: [0,0,1, 0,0,1, 0,0,1, 0,0,1], indices: [0,1,2, 0,2,3] });
const scene = createSceneFrame3D({ projection: { kind: 'orthographic', left: -1, right: 1, bottom: -1, top: 1, near: 1, far: 9 },
  draws: [{ geometry: red, modelView: identity }, { geometry: blue, modelView: identity }] });
let engine, parent, closePromise, closing = false, rendering = false;
const pairs = [];
function listen(target, name, callback) { target.addEventListener(name, callback); pairs.push([target, name, callback]); }
function removeListeners() { for (const [target, name, callback] of pairs.splice(0)) target.removeEventListener(name, callback); }
function node(value, x = 0, y = 0, scale = 1) {
  Object.assign(value, { x, y, scaleX: scale, scaleY: scale, rotation: 0, alpha: 1, visible: true, clipRect: undefined }); return value;
}
async function redraw() {
  if (closing || !engine || rendering) return;
  rendering = true; redrawButton.disabled = true; clipInput.disabled = true;
  try {
    parent.clipRect = clipInput.checked ? { x: 0, y: 0, width: 4, height: 8 } : undefined;
    const overlay = engine.captureFrame({ width: 64, height: 64, clearColor: 0, clearAlpha: 1 });
    host.renderSceneFrame(scene, overlay); await host.whenIdle();
    if (!closing) status.textContent = `Frame ${overlay.frameId} / 第 ${overlay.frameId} 帧`;
  } catch (error) { if (!closing) status.textContent = `Rendering failed / 绘制失败: ${error?.code ?? error?.message ?? 'unknown'}`; }
  finally { rendering = false; if (!closing) { redrawButton.disabled = false; clipInput.disabled = false; } }
}
const ready = (async () => {
  engine = await createEngine({ host });
  if (closing) return;
  const scope = engine.createScope(), stage = node(engine.stage);
  const white = scope.use(node(new Sprite())); white.graphics.beginFill(16777215, 1).drawRect(20, 20, 24, 24).endFill(); stage.addChild(white);
  const image = createImageData2D({ width: 2, height: 2, pixels: new Uint8Array([255,0,255,255, 255,0,255,255, 255,0,255,255, 255,0,255,255]) });
  const texture = createTexture(image, { x: 0, y: 0, width: 2, height: 2 }), type = createAssetType('scene3d inline magenta', isTexture);
  engine.assets.register(type, { async load() { return texture; }, dispose(value) { value.dispose(); } });
  const lease = scope.use(await engine.assets.acquire(createAssetRef(type, 'magenta'), { signal: scope.signal }));
  if (closing) return;
  parent = scope.use(node(new Sprite(), 28, 28)); parent.addChild(scope.use(node(new Bitmap(lease), 0, 0, 4))); stage.addChild(parent);
  const green = scope.use(node(new Sprite())); green.graphics.beginFill(65280, 1).drawRect(30, 30, 4, 4).endFill(); stage.addChild(green);
  listen(redrawButton, 'click', () => { void redraw(); }); listen(clipInput, 'change', () => { void redraw(); });
  await redraw();
})();
ready.catch(error => { if (!closing) status.textContent = `Unavailable / 无法启动: ${error?.code ?? error?.message ?? 'unknown'}`; });
export function close() {
  if (closePromise) return closePromise;
  closing = true; redrawButton.disabled = true; clipInput.disabled = true; closeButton.disabled = true; removeListeners();
  closePromise = (async () => {
    try { await ready; } catch { /* Startup already reported; retain ownership for cleanup. */ }
    try { if (engine) await engine.dispose(); else await host.close(); status.textContent = 'Closed / 已关闭'; }
    catch (error) { status.textContent = `Cleanup failed / 清理失败: ${error?.code ?? error?.message ?? 'unknown'}`; throw error; }
    finally { canvas.width = 0; canvas.height = 0; canvas.remove(); }
  })(); closePromise.catch(() => {}); return closePromise;
}
listen(closeButton, 'click', () => { void close(); });
listen(window, 'pagehide', () => { void close(); });
