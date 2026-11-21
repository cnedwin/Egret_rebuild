// SPDX-License-Identifier: Apache-2.0
import { Bitmap, Sprite, createAssetRef, createAssetType, createTexture, isTexture } from '@egret/engine';

// A single retained bitmap per distinct line. Moving the ball, rotating the
// stars and redrawing an unchanged score do not rasterize or upload text.
export function createRollHud({ engine, scope, signal, raster, publishPage }) {
  const pages = new Map();
  const handles = new WeakMap();
  const type = createAssetType('roll3d-label', isTexture);
  engine.assets.register(type, {
    load(ref) {
      const line = pages.get(ref.id);
      const texture = createTexture(raster.drawText(line.width, line.height, [line.run]));
      try {
        handles.set(texture, publishPage(line.page, texture.imageData));
      } catch (error) {
        texture.dispose();
        throw error;
      }
      return texture;
    },
    dispose(texture) {
      try { handles.get(texture)?.release(); } finally { texture.dispose(); }
    }
  });
  let layer, failure;
  const labels = new Set(), buttons = [];
  const requests = new Set();

  function page(words, size, color, weight) {
    const key = JSON.stringify([words, size, color, weight]);
    let row = pages.get(key);
    if (!row) {
      // The first act has a bounded vocabulary of scores and end messages.
      if (pages.size === 255) throw new Error('HUD texture budget reached');
      const run = { text: words, size, weight, x: 0, y: 0, color: '#' + color.toString(16).padStart(6, '0') };
      const width = Math.max(1, Math.ceil(raster.measureText([run])[0]));
      row = { page: pages.size + 1, width, height: Math.ceil(size * 1.25), run: { ...run, maxWidth: width } };
      pages.set(key, row);
      row.lease = engine.assets.acquire(createAssetRef(type, key), { signal }).then(value => scope.use(value));
    }
    return row;
  }

  function text(words, options = {}, parent = layer) {
    const container = parent.addChild(new Sprite());
    container.x = options.x ?? 0;
    container.y = options.y ?? 0;
    let bitmap, value;
    function change(next) {
      const saved = String(next);
      if (value === saved) return;
      value = saved;
      const row = page(value, options.size ?? 24, options.color ?? 0xffffff, options.bold ? 700 : 400);
      const ticket = row.lease.then(lease => {
        if (container.isDisposed || value !== saved) return;
        if (bitmap) bitmap.textureLease = lease;
        else bitmap = container.addChild(new Bitmap(lease));
        bitmap.x = options.align === 'center' ? -row.width / 2 : options.align === 'right' ? -row.width : 0;
        bitmap.y = options.baseline === 'middle' ? -row.height / 2 : 0;
      }).catch(error => { if (!signal.aborted) failure ??= error; });
      requests.add(ticket);
      void ticket.finally(() => requests.delete(ticket));
    }
    const label = { get text() { return value; }, set text(next) { change(next); } };
    labels.add(label);
    change(words);
    return label;
  }

  function button(words, options, pressed) {
    const { x, y, width = 160, height = 44, color = 0x3b82f6, textColor = 0xffffff } = options;
    const shape = layer.addChild(new Sprite());
    shape.x = x;
    shape.y = y;
    shape.graphics.beginFill(color).drawRoundRect(-width/2, -height/2, width, height, Math.min(width, height) * .25).endFill();
    const label = text(words, { size: options.size ?? height * .45, color: textColor, align: 'center', baseline: 'middle' }, shape);
    buttons.push({ x, y, width, height, pressed });
    return { label };
  }

  function clear() {
    layer?.dispose();
    layer = undefined;
    labels.clear();
    buttons.length = 0;
  }
  return {
    text, button, clear,
    reset() { clear(); layer = engine.stage.addChild(new Sprite()); },
    hit(x, y) { return buttons.find(b => Math.abs(b.x - x) <= b.width/2 && Math.abs(b.y - y) <= b.height/2); },
    labels() { return Array.from(labels, label => label.text); },
    check() { if (failure) throw failure; },
    async ready() { await Promise.all([...requests]); this.check(); }
  };
}
