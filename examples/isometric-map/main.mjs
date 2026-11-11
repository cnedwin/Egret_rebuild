// SPDX-License-Identifier: Apache-2.0
import { Bitmap, Sprite, createAssetRef, createAssetType, createEngineForProfile, createImageData2D, createTexture, isTexture } from '@egret/engine';
import { createBrowserKeyboardInput } from '@egret/engine/web/keyboard';
import { createSharedWebGL2Host } from '@egret/engine/webgl2';

const canvas = document.querySelector('#map');
const status = document.querySelector('#status');
const stop = document.querySelector('#stop');
const size = 7;
const block = { x: 3, y: 3 };
const actor = { x: 3, y: 5 };
const steps = new Map([['ArrowUp', [0, -1]], ['ArrowDown', [0, 1]], ['ArrowLeft', [-1, 0]], ['ArrowRight', [1, 0]]]);
const frameOptions = { width: 384, height: 232, clearColor: 0x203736, clearAlpha: 1, outputAlpha: 'opaque' };

function polygon(context, color, points) {
  context.fillStyle = color;
  context.beginPath();
  for (const [x, y] of points) context.lineTo(x, y);
  context.closePath();
  context.fill();
}

const tile = (context, color) => polygon(context, color, [[24, 0], [48, 12], [24, 24], [0, 12]]);
const art = {
  grass: { width: 48, height: 24, anchor: [24, 12], draw: context => tile(context, '#668163') },
  path: { width: 48, height: 24, anchor: [24, 12], draw: context => tile(context, '#b8a476') },
  block: {
    width: 80, height: 66, anchor: [40, 64],
    draw(context) {
      polygon(context, '#d79768', [[4, 16], [34, 2], [77, 17], [47, 32]]);
      polygon(context, '#754b4d', [[4, 16], [47, 32], [47, 65], [4, 49]]);
      polygon(context, '#9b5945', [[47, 32], [77, 17], [77, 49], [47, 65]]);
    },
  },
  actor: {
    width: 14, height: 30, anchor: [7, 28],
    draw(context) {
      context.fillStyle = '#315b70';
      context.fillRect(1, 1, 12, 27);
      context.fillStyle = '#42c6e4';
      context.fillRect(2, 4, 10, 20);
    },
  },
};

// Project each grid point to a ground contact. Apply the texture anchor after projection.
function place(bitmap, key, x, y) {
  const [anchorX, anchorY] = art[key].anchor;
  bitmap.x = 192 + (x - y) * 24 - anchorX;
  bitmap.y = 45 + (x + y) * 12 - anchorY;
}

function loadArt(key) {
  const { width, height, draw } = art[key];
  const surface = document.createElement('canvas');
  surface.width = width;
  surface.height = height;
  const context = surface.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D context unavailable');
  draw(context);
  const pixels = new Uint8Array(context.getImageData(0, 0, width, height).data);
  return createTexture(createImageData2D({ width, height, pixels }));
}

async function start() {
  const host = createSharedWebGL2Host({ canvas, pixelRatio: 1, outputAlpha: 'opaque' });
  let engine;
  let request = 0;
  let dirty = false;
  let closing;
  const listeners = new AbortController();

  function close(failure) {
    if (closing) return closing;
    cancelAnimationFrame(request);
    listeners.abort();
    stop.disabled = true;
    closing = (async () => {
      try {
        await engine?.dispose();
      } finally {
        await host.close();
      }
      canvas.dataset.pending = String(host.getStatus().pendingFrames);
      canvas.dataset.phase = failure ? 'failed' : 'closed';
      status.textContent = failure ? `Rendering failed / 渲染失败 · ${failure.message}` : 'Closed / 已关闭';
    })().catch(error => {
      canvas.dataset.phase = 'failed';
      status.textContent = `Cleanup failed / 清理失败 · ${error.message}`;
    });
    return closing;
  }

  function schedule() {
    if (!request && !closing) request = requestAnimationFrame(render);
  }

  function render() {
    request = 0;
    if (!dirty || closing) return;
    // Keep the latest scene dirty while the previous submission is still owned by the host.
    if (host.getStatus().pendingFrames !== 0) {
      schedule();
      return;
    }
    try {
      const frame = engine.renderSharedFrame(frameOptions);
      dirty = false;
      canvas.dataset.frame = String(frame.frameId);
      canvas.dataset.pending = String(host.getStatus().pendingFrames);
      canvas.dataset.phase = 'ready';
    } catch (error) {
      void close(error);
    }
  }

  try {
    engine = await createEngineForProfile({ host }, 'egret.shared-frame2d/1');
    const scope = engine.createScope();
    const type = createAssetType('isometric-map-art', isTexture);
    engine.assets.register(type, { async load(ref) { return loadArt(ref.id); }, dispose(texture) { texture.dispose(); } });
    const keys = Object.keys(art);
    const group = engine.createAssetGroup(scope, keys.map(key => createAssetRef(type, key)));
    const leases = await group.ready;
    const textures = new Map(keys.map((key, index) => [key, leases[index]]));
    const ground = engine.stage.addChild(scope.use(new Sprite()));
    const objects = engine.stage.addChild(scope.use(new Sprite()));

    function addBitmap(parent, key, x, y) {
      const bitmap = parent.addChild(scope.use(new Bitmap(textures.get(key))));
      place(bitmap, key, x, y);
      return bitmap;
    }

    for (let depth = 0; depth < size * 2 - 1; depth++) {
      for (let x = Math.max(0, depth - size + 1); x <= Math.min(size - 1, depth); x++) {
        addBitmap(ground, x === 3 || x === 4 ? 'path' : 'grass', x, depth - x);
      }
    }
    const blocker = addBitmap(objects, 'block', block.x, block.y);
    const player = addBitmap(objects, 'actor', actor.x, actor.y);

    function update() {
      place(player, 'actor', actor.x, actor.y);
      // Greater ground depth is nearer. Use grid X to break ties consistently.
      const order = actor.x + actor.y - block.x - block.y || actor.x - block.x;
      objects.setChildIndex(blocker, order < 0 ? 1 : 0);
      canvas.dataset.x = String(actor.x);
      canvas.dataset.y = String(actor.y);
      canvas.dataset.order = order < 0 ? 'behind' : 'in-front';
      status.textContent = `Tile / 格点 (${actor.x}, ${actor.y})`;
      dirty = true;
      schedule();
    }

    const keyboard = createBrowserKeyboardInput({ engine, scope });
    keyboard.registerTarget({ id: 'map', target: objects });
    engine.stage.on(keyboard.events.keyDown, event => {
      const step = steps.get(event.payload.code);
      if (!step) return;
      event.preventDefault();
      if (event.payload.repeat) return;
      const x = actor.x + step[0];
      const y = actor.y + step[1];
      if (x < 0 || y < 0 || x >= size || y >= size || (x === block.x && y === block.y)) {
        status.textContent = `Blocked / 无法通行 · (${actor.x}, ${actor.y})`;
        return;
      }
      Object.assign(actor, { x, y });
      update();
    }, { signal: scope.signal });
    keyboard.focus('map');
    canvas.focus({ preventScroll: true });
    stop.disabled = false;
    stop.addEventListener('click', () => { void close(); }, { signal: listeners.signal });
    addEventListener('pagehide', event => { if (!event.persisted) void close(); }, { signal: listeners.signal });
    update();
  } catch (error) {
    await close(error);
  }
}

await start();
