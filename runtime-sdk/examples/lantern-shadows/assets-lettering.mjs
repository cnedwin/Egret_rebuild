// SPDX-License-Identifier: Apache-2.0
import {
  Bitmap,
  Sprite,
  createAssetRef,
  createAssetType,
  createImageData2D,
  createTexture,
  isTexture
} from '@egret/engine';

export async function makeLanternLettering({ engine, scope, signal, assets, raster, publishPage }) {
  const published = new WeakMap(),
    sources = new Map(),
    glyphs = new Map();
  const type = createAssetType('lantern-interface-art', isTexture);
  engine.assets.register(type, {
    async load(ref) {
      const source = sources.get(ref.id);
      if (!source) throw new Error('Unknown theatre interface resource');
      const texture = createTexture(source.make());
      try {
        published.set(texture, publishPage(source.page, texture.imageData));
      } catch (error) {
        texture.dispose();
        throw error;
      }
      return texture;
    },
    dispose(texture) {
      try {
        published.get(texture)?.release();
      } finally {
        texture.dispose();
      }
    }
  });
  async function acquire(id, page, make) {
    sources.set(id, { page, make });
    return scope.use(await engine.assets.acquire(createAssetRef(type, id), { signal }));
  }
  const known = await assets.readText('assets/lantern-lettering.txt', signal);
  const chars = Array.from(
    new Set([
      ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)),
      ...known,
      ...'灯影闹天宫南天门蟠桃园兜率宫开锣戏单已存记录暂停继续回戏单再演下一幕左右跳棍云变背景计时桃毫毛一二三风雪分无最佳分秒地图首领：·／×↔◀▶✓○'
    ])
  );
  const cell = 32,
    size = 22,
    perPage = 180,
    cols = 16;
  for (let start = 0; start < chars.length; start += perPage) {
    const rows = chars.slice(start, start + perPage).map((text, i) => ({
      text,
      size,
      weight: 600,
      color: '#f8dfaa',
      x: (i % cols) * cell + 1,
      y: Math.floor(i / cols) * cell + 1,
      maxWidth: cell - 2
    }));
    const widths = raster.measureText(rows);
    const lease = await acquire('font-' + start, 129 + start / perPage, () =>
      raster.drawText(cell * cols, cell * Math.ceil(rows.length / cols), rows)
    );
    rows.forEach((row, i) =>
      glyphs.set(row.text, {
        lease,
        width: Math.min(cell - 2, widths[i]),
        rect: { x: row.x - 1, y: row.y - 1, width: cell, height: cell }
      })
    );
  }
  const flag = await acquire('red-cloth', 128, () =>
    createImageData2D({
      width: 1,
      height: 2,
      pixels: new Uint8Array([92, 16, 13, 255, 143, 29, 22, 255])
    })
  );
  function label(parent, x, y, fontSize, width) {
    const line = parent.addChild(scope.use(new Sprite()));
    line.x = x;
    line.y = y;
    const letters = [],
      scale = fontSize / size;
    let previous;
    return (value = '') => {
      if (value === previous) return;
      previous = value;
      let pen = 0,
        used = 0;
      for (const c of String(value)) {
        const glyph = glyphs.get(c) ?? glyphs.get('?');
        if (pen + glyph.width * scale > width) break;
        if (c !== ' ' && c !== '　') {
          let bitmap = letters[used];
          if (!bitmap) {
            bitmap = line.addChild(scope.use(new Bitmap(glyph.lease)));
            letters.push(bitmap);
          } else if (bitmap.textureLease !== glyph.lease) bitmap.textureLease = glyph.lease;
          bitmap.sourceRect = glyph.rect;
          bitmap.scaleX = bitmap.scaleY = scale;
          bitmap.x = Math.round(pen - scale);
          bitmap.visible = true;
          used++;
        }
        pen += glyph.width * scale;
      }
      for (; used < letters.length; used++) letters[used].visible = false;
    };
  }
  return { label, flag };
}
