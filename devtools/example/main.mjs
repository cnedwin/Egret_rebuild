// SPDX-License-Identifier: Apache-2.0
// Moving sprites on a shared 2D host, with the performance monitor attached.
import { Bitmap, createAssetRef, createAssetType, createEngineForProfile, createImageData2D, createTexture, isTexture } from '@egret/engine';
import { createEngineProbe, createHandleTracker } from '@egret/devtools';
import { attachPerformanceMonitor, describeWebGLAdapter, sharedHostSource, sharedWebGL2TimingSource } from '@egret/devtools/web';

const canvas = document.querySelector('#stage');
const status = document.querySelector('#status');
const params = new URLSearchParams(location.search);
const useWebGPU = params.get('backend') === 'webgpu';
const frameOptions = { width: 640, height: 360, clearColor: 0x1d2433, clearAlpha: 1, outputAlpha: 'opaque' };
const colors = ['#f2a65a', '#58b09c', '#7f77dd', '#e4572e', '#42c6e4', '#f4d35e'];

// Keep the debug flag when switching backend.
const link = document.querySelector('#backend');
const next = new URLSearchParams(params);
if (useWebGPU) { next.delete('backend'); link.textContent = 'WebGL2'; } else next.set('backend', 'webgpu');
link.href = '?' + next;

function loadDisc(color) {
  const surface = document.createElement('canvas');
  surface.width = surface.height = 16;
  const context = surface.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D context unavailable');
  context.fillStyle = color;
  context.beginPath(); context.arc(8, 8, 7, 0, Math.PI * 2); context.fill();
  return createTexture(createImageData2D({ width: 16, height: 16, pixels: new Uint8Array(context.getImageData(0, 0, 16, 16).data) }));
}

// A second context on the same canvas is refused, so ask a scratch canvas for the adapter name.
const scratch = document.createElement('canvas').getContext('webgl2');
const adapter = scratch ? describeWebGLAdapter(scratch) ?? undefined : undefined;
scratch?.getExtension('WEBGL_lose_context')?.loseContext();

const handle = attachPerformanceMonitor({ canvas, backend: useWebGPU ? 'webgpu' : 'webgl2', ...(adapter ? { adapter } : {}) });
const monitor = handle.monitor;
const probe = createEngineProbe(monitor);
const tracker = createHandleTracker();

const backendModule = await (useWebGPU ? import('@egret/engine/webgpu') : import('@egret/engine/webgl2'));
// measureSharedFrames costs a little, so ask for it only while the monitor is shown.
const host = useWebGPU
  ? backendModule.createSharedWebGPUHost({ canvas, pixelRatio: 1, outputAlpha: 'opaque' })
  : backendModule.createSharedWebGL2Host({ canvas, pixelRatio: 1, outputAlpha: 'opaque', measureSharedFrames: handle.enabled });
// The engine gets the timed host; the original keeps answering status calls.
const engine = await createEngineForProfile({ host: probe.wrapHost(host) }, 'egret.shared-frame2d/1');
const tracked = tracker.engine(engine);
monitor.addSource('host', sharedHostSource(host));
monitor.addSource('handles', tracker.source());
if (!useWebGPU) monitor.addSource('webgl2 ms (mean / max)', sharedWebGL2TimingSource(host));

const scope = tracked.createScope();
const type = createAssetType('devtools-example-disc', isTexture);
engine.assets.register(type, { async load(ref) { return loadDisc(ref.id); }, dispose(texture) { texture.dispose(); } });
const textures = await tracked.createAssetGroup(scope, colors.map(color => createAssetRef(type, color))).ready;

const sprites = [];
function add(count) {
  for (let i = 0; i < count; i++) {
    const bitmap = engine.stage.addChild(scope.use(new Bitmap(textures[sprites.length % textures.length])));
    const sprite = { bitmap, x: Math.random() * 624, y: Math.random() * 344, dx: Math.random() * 120 - 60, dy: Math.random() * 120 - 60 };
    sprites.push(sprite);
  }
  monitor.setGauge('sprites', sprites.length);
}
add(200);

// Movement runs on the game clock, so its time shows as the clock section.
engine.clock.onTick(scope, tick => {
  const seconds = tick.deltaSeconds;
  for (const sprite of sprites) {
    sprite.x += sprite.dx * seconds; sprite.y += sprite.dy * seconds;
    if (sprite.x < 0 || sprite.x > 624) sprite.dx = -sprite.dx;
    if (sprite.y < 0 || sprite.y > 344) sprite.dy = -sprite.dy;
    sprite.bitmap.x = sprite.x; sprite.bitmap.y = sprite.y;
  }
});

let stall = 0, elapsed = 0, last = performance.now(), request = 0, closed = false;
document.querySelector('#more').addEventListener('click', () => add(200));
document.querySelector('#hitch').addEventListener('click', () => { stall = 80; });

function frame(now) {
  if (closed) return;
  request = requestAnimationFrame(frame);
  // The first timestamp can predate the page clock read above; never step backwards.
  const seconds = Math.max(0, Math.min(0.1, (now - last) / 1000));
  last = now;
  monitor.beginFrame();
  monitor.measure('logic', () => {
    if (stall > 0) { const until = performance.now() + stall; stall = 0; while (performance.now() < until); }
  });
  elapsed += seconds;
  probe.advanceTime(engine, elapsed);
  // The host still owns the previous submission: draw the newest state next time.
  if (host.getStatus().pendingFrames === 0) {
    try {
      const rendered = probe.renderSharedFrame(engine, frameOptions);
      canvas.dataset.frame = String(rendered.frameId);
      canvas.dataset.phase = 'ready';
    } catch (error) {
      canvas.dataset.phase = 'failed';
      status.textContent = `Rendering failed / 渲染失败 · ${error.message}`;
      void close();
    }
  } else monitor.addCount('skipped');
  monitor.endFrame();
}

async function close() {
  if (closed) return;
  closed = true;
  cancelAnimationFrame(request);
  handle.dispose();
  try { await engine.dispose(); } finally { await host.close(); }
}

status.textContent = (useWebGPU ? 'WebGPU' : 'WebGL2') + (handle.enabled ? ' · debug mode / 调试模式' : ' · add ?egretDebug=1 / 加上 ?egretDebug=1');
addEventListener('pagehide', event => { if (!event.persisted) void close(); });
globalThis.__devtoolsExample = { handle, tracker, get sprites() { return sprites.length; }, close };
request = requestAnimationFrame(frame);
