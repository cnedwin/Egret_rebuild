// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import * as sdk from '@egret/engine';
import { createLegacyBindings } from '../tools/egret-migrate/legacy-web.mjs';

// Four columns, two rows: opaque red on the left and green on the right.
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAAFklEQVR4nGP4K237H4S5b9eDMQO6AAA6wRLhHQ4pDwAAAABJRU5ErkJggg==';
async function fixture(ports = {}, readImage) {
  const engine = await sdk.createEngine({
    host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout: () => () => {} }
  });
  const scope = engine.createScope(),
    released = [],
    errors = [];
  const type = sdk.createAssetType('fixture.texture', sdk.isTexture);
  let next = 0,
    decodes = 0,
    first;
  engine.assets.register(type, {
    load() {
      const pixels = new Uint8Array(32);
      for (let i = 0; i < 8; i++) pixels.set(i % 4 < 2 ? [253, 27, 61, 255] : [11, 219, 127, 255], i * 4);
      return sdk.createTexture(sdk.createImageData2D({ width: 4, height: 2, pixels }));
    },
    dispose(t) {
      released.push(t);
      t.dispose();
    }
  });
  const acquire = async () =>
    scope.use(await engine.assets.acquire(sdk.createAssetRef(type, 'page' + ++next), { signal: scope.signal }));
  const game = {
    engine,
    scope,
    stage: engine.stage,
    pointer: { events: { tap: sdk.createEventType('tap', { bubbles: true }) } },
    loadTexture: async url => (first = await (readImage ? readImage(url, acquire) : acquire()))
  };
  const { api, mount } = createLegacyBindings(
    sdk,
    game,
    {
      width: 320,
      height: 180,
      projectId: 'texture_fixture',
      resources: { root: 'r/', configUrl: 'r/c.json', resources: [{ name: 'p', type: 'image', url: 'page.png' }] },
      onError: e => errors.push(e)
    },
    {
      storage: () => ({}),
      ...ports,
      async pngBytes(desc) {
        assert.equal(desc.data, png);
        assert.deepEqual([desc.width, desc.height], [4, 2]);
        decodes++;
        return acquire();
      }
    }
  );
  await mount(new api.egret.Sprite());
  await api.RES.loadConfig('r/c.json', 'r/');
  return { engine, scope, ...api, released, errors, acquire, page: () => first, decodes: () => decodes };
}
test('named and nested crops share the real RES page; replacing a name preserves previous borrowers until released', async () => {
  const h = await fixture();
  try {
    const { egret, RES } = h;
    const base = await RES.getResAsync('p'),
      lease = h.page();
    assert(base instanceof egret.Texture);
    assert(base.bitmapData instanceof egret.BitmapData);
    const sheet = new egret.SpriteSheet(base);
    const first = sheet.createTexture('tile', 1, 0, 2, 2, 1, 0, 3, 2),
      second = sheet.createTexture('tile', 2, 0, 2, 2);
    assert.strictEqual(sheet.getTexture('tile'), second);
    assert.strictEqual(second.bitmapData, base.bitmapData);
    const one = new egret.Bitmap(first),
      two = new egret.Bitmap(second);
    assert.strictEqual(one.getChildAt(0).textureLease, lease);
    assert.strictEqual(two.getChildAt(0).textureLease, lease);
    assert.deepEqual([one.width, one.height, two.width, two.height], [3, 2, 2, 2]);
    const nested = new egret.SpriteSheet(first),
      embedded = nested.createTexture('inner', 1, 0, 1, 2);
    const child = new egret.Bitmap(embedded).getChildAt(0);
    assert.strictEqual(child.textureLease, lease);
    assert.equal(child.sourceRect.x, 1);
    assert.throws(() => sheet.createTexture('leak', 3, 0, 2, 2));
    assert.equal(sheet.getTexture('leak'), undefined);
    nested.dispose();
    sheet.dispose();
    assert.equal(one.numChildren, 0);
    assert.equal(two.numChildren, 0);
    assert.equal(new egret.Bitmap(base).numChildren, 1);
    assert.equal(h.released.length, 0);
    assert.equal(RES.destroyRes('p'), true);
    assert.equal(h.released.length, 1);
    assert.equal(base.bitmapData, undefined);
  } finally {
    await h.engine.dispose();
  }
});
test('bounded PNG callbacks attach to pending bitmaps, release leases, and skip work after owner close', async () => {
  const h = await fixture();
  try {
    const { egret } = h;
    const ready = Promise.withResolvers();
    const data = egret.BitmapData.create(
      'arraybuffer',
      Uint8Array.from(Buffer.from(png, 'base64')).buffer,
      ready.resolve
    );
    const t = new egret.Texture();
    t.bitmapData = data;
    const show = new egret.Bitmap(t);
    assert.equal(show.numChildren, 0);
    assert.strictEqual(await ready.promise, data);
    assert.equal(h.decodes(), 1);
    assert.equal(show.numChildren, 1);
    assert.deepEqual([show.width, show.height], [4, 2]);
    t.dispose();
    assert.equal(show.numChildren, 0);
    assert.equal(h.released.length, 1);
    assert.throws(() => egret.BitmapData.create('base64', 'A'.repeat(100000)), {
      code: 'LEGACY_TEXTURE_SOURCE_UNSUPPORTED'
    });
    let called = false;
    egret.BitmapData.create('base64', png, () => (called = true));
    h.scope.dispose();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(called, false);
    assert.equal(h.decodes(), 1);
    assert.deepEqual(h.errors, []);
  } finally {
    await h.engine.dispose();
  }
});

test('logical text atlases freeze detached fields and ignore older raster completion after a redraw', async () => {
  const pending = [];
  const h = await fixture({
    measureLine: text => text.length * 8,
    graphemes: text => Array.from(text),
    atlasRaster(w, h, runs) {
      const gate = Promise.withResolvers();
      pending.push({ w, h, runs, gate });
      return gate.promise;
    }
  });
  const wait = () => new Promise(r => setImmediate(r));
  try {
    const e = h.egret,
      root = new e.DisplayObjectContainer(),
      field = new e.TextField(),
      clip = new e.Rectangle(0, 0, 2048, 2048);
    field.size = 20;
    field.textColor = 0xff2020;
    field.text = 'FF';
    field.x = 34;
    field.y = 25;
    root.addChild(field);
    const atlas = new e.RenderTexture();
    assert.equal(atlas.drawToTexture(root, clip), true);
    assert.deepEqual([atlas.textureWidth, atlas.textureHeight], [2048, 2048]);
    const sheet = new e.SpriteSheet(atlas),
      tile = sheet.createTexture('tile', 32, 1992, 40, 34);
    const first = new e.Bitmap(tile);
    root.removeChildren();
    await wait();
    assert.equal(pending.length, 1);
    assert.deepEqual(
      [pending[0].w, pending[0].h, pending[0].runs[0].x, pending[0].runs[0].y, pending[0].runs[0].color],
      [40, 34, 2, 3, '#ff2020']
    );
    root.addChild(field);
    field.textColor = 0x20ff20;
    atlas.drawToTexture(root, clip);
    root.removeChildren();
    await wait();
    assert.equal(pending.length, 2);
    assert.equal(pending[1].runs[0].color, '#20ff20');
    assert.strictEqual(sheet.getTexture('tile'), tile);
    const current = await h.acquire(),
      old = await h.acquire();
    pending[1].gate.resolve(current);
    await wait();
    pending[0].gate.resolve(old);
    await wait();
    assert.strictEqual(first.getChildAt(0).textureLease, current);
    assert.equal(h.released.length, 1);
    assert.throws(() => atlas.drawToTexture(new e.Bitmap(), clip), { code: 'LEGACY_TEXT_ATLAS_UNSUPPORTED' });
    assert.throws(() => sheet.createTexture('huge', 0, 0, 2048, 2048), { code: 'LEGACY_TEXT_ATLAS_UNSUPPORTED' });
    first.texture = null;
    assert.equal(h.released.length, 2);
    const unused = sheet.createTexture('unused', 32, 1992, 40, 34);
    atlas.dispose();
    const late = new e.Bitmap(unused);
    await wait();
    assert.equal(late.numChildren, 0);
    assert.equal(pending.length, 2);
    sheet.dispose();
    assert.deepEqual(h.errors, []);
  } finally {
    await h.engine.dispose();
  }
});

test('ImageLoader applies its per-game CORS default and discards replaced or canceled reads', async () => {
  const held = new Map(),
    origins = [];
  const h = await fixture({ checkImageOrigin: (url, mode) => origins.push([url, mode]) }, (url, acquire) => {
    if (url === 'missing') throw new Error('not found');
    const ack = Promise.withResolvers();
    held.set(url, { ack, acquire });
    return ack.promise;
  });
  const later = () => new Promise(r => setImmediate(r));
  try {
    const { ImageLoader, Bitmap, Texture, BitmapData } = h.egret;
    assert.equal(ImageLoader.crossOrigin, null);
    ImageLoader.crossOrigin = 'anonymous';
    assert.throws(() => (ImageLoader.crossOrigin = 'use-credentials'));
    const loader = new ImageLoader(),
      events = [];
    loader.addEventListener('complete', () => events.push('ready'), null);
    loader.addEventListener('ioError', () => events.push('failed'), null);
    loader.load('old');
    await later();
    loader.load('new');
    await later();
    const old = await h.acquire(),
      current = await h.acquire();
    held.get('new').ack.resolve(current);
    await later();
    assert(loader.data instanceof BitmapData);
    const t = new Texture();
    t.bitmapData = loader.data;
    assert.strictEqual(new Bitmap(t).getChildAt(0).textureLease, current);
    held.get('old').ack.resolve(old);
    await later();
    assert.deepEqual(events, ['ready']);
    assert.equal(h.released.length, 1);
    loader.crossOrigin = null;
    loader.load('missing');
    await later();
    assert.equal(loader.data, null);
    assert.deepEqual(events, ['ready', 'failed']);
    loader.load('cancel');
    await later();
    loader.close();
    held.get('cancel').ack.resolve(await h.acquire());
    await later();
    assert.deepEqual(events, ['ready', 'failed']);
    assert.deepEqual(origins, [
      ['old', 'anonymous'],
      ['new', 'anonymous'],
      ['missing', null],
      ['cancel', null]
    ]);
    t.dispose();
    assert.equal(h.released.length, 3);
  } finally {
    await h.engine.dispose();
  }
});
