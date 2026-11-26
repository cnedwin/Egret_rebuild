// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '@egret/engine';
import { launchLegacyWeb } from '../tools/egret-migrate/legacy-web.mjs';

function host(storage = new Map()) {
  const trace = [];
  const tap = engine.createEventType('tap', { bubbles: true });
  const canvas = {
    ownerDocument: {
      defaultView: {
        AbortController,
        localStorage: {
          getItem: key => storage.get(key) ?? null,
          setItem: (key, value) => storage.set(key, value),
          removeItem: key => storage.delete(key)
        },
        async fetch(url, { signal }) {
          assert.ok(signal instanceof AbortSignal);
          trace.push(['fetch', url]);
          return new Response('{"points":3}');
        }
      }
    }
  };
  return {
    canvas,
    trace,
    tap,
    sdk: {
      ...engine,
      async createBrowserGame(options) {
        assert.equal(options.autoStart, false);
        assert.equal(options.blendSpace, 'srgb');
        const game = await engine.createEngine({
          host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout: () => () => {} }
        });
        const scope = game.createScope();
        const image = engine.createAssetType('fixture-image', engine.isTexture);
        game.assets.register(image, {
          async load() {
            trace.push('image allocated');
            return engine.createTexture(
              engine.createImageData2D({
                width: 2,
                height: 1,
                pixels: Uint8Array.of(120, 150, 200, 255, 240, 210, 90, 255)
              })
            );
          },
          dispose(texture) {
            trace.push('image disposed');
            texture.dispose();
          }
        });
        return {
          engine: game,
          stage: game.stage,
          scope,
          async loadTexture(url) {
            return scope.use(await game.assets.acquire(engine.createAssetRef(image, url)));
          },
          async createLabel({ scope: labelScope = scope, ...initial }) {
            const display = labelScope.use(new engine.Sprite());
            let style = { ...initial };
            return {
              display,
              ready: Promise.resolve(),
              set(changes) {
                style = { ...style, ...changes };
                display.name = style.text;
                trace.push(['label', style.text, style.fontSize, style.color]);
              },
              dispose: () => display.dispose()
            };
          },
          pointer: { events: { tap } },
          loop: { start: () => trace.push('started') },
          async dispose() {
            trace.push('disposed');
            await game.dispose();
          }
        };
      }
    }
  };
}

const resources = {
  configUrl: 'resource/default.res.json',
  root: 'resource/',
  resources: [{ name: 'level', type: 'json', url: 'resource/level.json' }],
  groups: [{ name: 'preload', keys: ['level'] }]
};

test('legacy Main starts under a real display tree and input calls an old-style listener on its this object', async () => {
  const { sdk, canvas, trace, tap } = host();
  let root, button;
  const events = [];
  const receiver = {
    press(event) {
      events.push([this, event.currentTarget, event.stageX, event.stageY, event.touchPointID]);
    }
  };
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 200,
    height: 100,
    projectId: 'p_legacy_sample',
    resources,
    createMain({ egret, RES }) {
      root = new egret.DisplayObjectContainer();
      root.addEventListener(
        egret.Event.ADDED_TO_STAGE,
        async function () {
          assert.equal(this, root);
          assert.equal(this.stage.stageWidth, 200);
          assert.equal(this.stage.stageHeight, 100);
          await RES.loadConfig('resource/default.res.json', 'resource/');
          await RES.loadGroup('preload');
          assert.deepEqual(RES.getRes('level'), { points: 3 });
          button = new egret.Sprite();
          button.graphics.beginFill(0xaa4422).drawRect(0, 0, 20, 20).endFill();
          button.touchEnabled = true;
          button.addEventListener(egret.TouchEvent.TOUCH_TAP, receiver.press, receiver);
          button.addEventListener(egret.TouchEvent.TOUCH_TAP, receiver.press, receiver);
          this.addChild(button);
          trace.push('legacy scene ready');
        },
        root
      );
      return root;
    }
  });
  try {
    assert.deepEqual(trace, [['fetch', 'resource/level.json'], 'legacy scene ready', 'started']);
    button.dispatchEvent(new engine.Event(tap, { globalX: 5, globalY: 6, session: { pointerId: 19 } }));
    assert.deepEqual(events, [[receiver, button, 5, 6, 19]]);
    button.removeEventListener('touchTap', receiver.press, receiver);
    button.dispatchEvent(new engine.Event(tap, { globalX: 5, globalY: 6, session: { pointerId: 19 } }));
    assert.equal(events.length, 1);
  } finally {
    await game.dispose();
  }
  assert.equal(root.isDisposed, true);
});

test('localStorage is isolated by project ID and startup failures dispose the new host', async () => {
  const { sdk, canvas, trace } = host();
  const start = (projectId, action) =>
    launchLegacyWeb(sdk, {
      canvas,
      width: 200,
      height: 100,
      projectId,
      createMain({ egret }) {
        action(egret.localStorage);
        return new egret.Sprite();
      }
    });
  const first = await start('p_legacy_first', storage => {
    assert.equal(storage.setItem('score', '10'), true);
  });
  await first.dispose();
  const second = await start('p_legacy_second', storage => assert.equal(storage.getItem('score'), null));
  await second.dispose();
  await assert.rejects(
    start('p_legacy_first', storage => {
      assert.equal(storage.getItem('score'), '10');
      throw new Error('Opening failed');
    }),
    /Opening failed/
  );
  assert.equal(trace.filter(step => step === 'started').length, 2);
  assert.equal(trace.filter(step => step === 'disposed').length, 3);
});

test('a legacy text field delegates updates to a label on the live display tree', async () => {
  const { sdk, canvas, trace } = host();
  let label;
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 200,
    height: 100,
    projectId: 'p_legacy_text',
    createMain({ egret }) {
      const root = new egret.Sprite();
      label = new egret.TextField();
      label.text = 'Score 0';
      label.size = 20;
      label.textColor = 0x88ccee;
      root.addChild(label);
      return root;
    }
  });
  try {
    assert.equal(label.getChildAt(0).name, 'Score 0');
    assert.deepEqual(trace, [['label', 'Score 0', 20, 0x88ccee], 'started']);
    label.text = 'Score 1';
    assert.equal(label.getChildAt(0).name, 'Score 1');
  } finally {
    await game.dispose();
  }
});

test('declared image lookup keeps a real texture lease through bitmap replacement and releases it on close', async () => {
  const { sdk, canvas, trace } = host();
  let bitmap, resource, lease;
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 200,
    height: 100,
    projectId: 'p_legacy_image',
    resources: {
      ...resources,
      resources: [{ name: 'tile', type: 'image', url: 'resource/tile.png' }],
      groups: [{ name: 'preload', keys: ['tile', 'tile'] }]
    },
    async createMain({ egret, RES }) {
      await RES.loadConfig('resource/default.res.json', 'resource/');
      await RES.loadGroup('preload');
      resource = RES.getRes('tile');
      assert.deepEqual(resource, { textureWidth: 2, textureHeight: 1 });
      const root = new egret.Sprite();
      bitmap = new egret.Bitmap();
      bitmap.texture = resource;
      bitmap.touchEnabled = true;
      root.addChild(bitmap);
      return root;
    }
  });
  try {
    assert.equal(bitmap.width, 2);
    assert.equal(game.stage.hitTest(1, 0.5), bitmap);
    lease = bitmap.getChildAt(0).textureLease;
    bitmap.texture = null;
    assert.equal(bitmap.width, 0);
    assert.equal(lease.value.width, 2);
    bitmap.texture = resource;
    assert.equal(bitmap.getChildAt(0).textureLease, lease);
    bitmap.hitArea = { x: 10, y: 10, width: 3, height: 3 };
    bitmap.texture = resource;
    assert.deepEqual(bitmap.hitArea, { x: 10, y: 10, width: 3, height: 3 });
    assert.deepEqual(trace, ['image allocated', 'started']);
  } finally {
    await game.dispose();
  }
  assert.deepEqual(trace, ['image allocated', 'started', 'disposed', 'image disposed']);
  assert.throws(() => lease.value, { code: 'ASSET_LEASE_RELEASED' });
});

test('retired screens release text resources while a detached scene can reenter with its listeners', async () => {
  const { sdk, canvas, tap } = host();
  let root,
    scene,
    label,
    action,
    taps = 0;
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 320,
    height: 180,
    projectId: 'p_reopen',
    createMain({ egret }) {
      root = new egret.Sprite();
      scene = new egret.Sprite();
      label = new egret.TextField();
      label.text = 'Round';
      scene.addChild(label);
      action = new egret.Sprite();
      action.addEventListener(
        egret.TouchEvent.TOUCH_TAP,
        () => {
          taps++;
        },
        scene
      );
      scene.addChild(action);
      root.addChild(scene);
      return root;
    }
  });
  try {
    const first = label.getChildAt(0);
    root.removeChildren();
    assert.equal(first.isDisposed, true);
    assert.equal(label.isDisposed, false);
    assert.equal(label.numChildren, 0);
    assert.equal(scene.stage, null);
    root.addChild(scene);
    for (let i = 0; i < 5 && label.numChildren === 0; ++i) await Promise.resolve();
    const reentered = label.getChildAt(0);
    assert.notEqual(reentered, first);
    action.dispatchEvent(new engine.Event(tap, { globalX: 1, globalY: 1, session: { pointerId: 1 } }));
    assert.equal(taps, 1);
    root.removeChild(scene);
    assert.equal(reentered.isDisposed, true);
  } finally {
    await game.dispose();
  }
});

test('legacy sheet aliases and qualified names share one page and preserve trimmed bounds across Bitmap replacement', async () => {
  const { sdk, canvas, trace } = host();
  let bitmap, RES, first;
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 200,
    height: 100,
    projectId: 'p_sheet',
    resources: {
      ...resources,
      resources: [
        { name: 'icons', type: 'json', url: 'resource/icons.json' },
        { name: 'page', type: 'image', url: 'resource/icons.png' }
      ],
      groups: [{ name: 'preload', keys: ['icons'] }]
    },
    sheets: [
      {
        name: 'icons',
        page: 'page',
        subkeys: ['star'],
        frames: [
          { name: 'star', x: 0, y: 0, width: 1, height: 1, sourceWidth: 3, sourceHeight: 2, offsetX: 1, offsetY: 1 },
          { name: 'moon', x: 1, y: 0, width: 1, height: 1, sourceWidth: 1, sourceHeight: 1, offsetX: 0, offsetY: 0 }
        ]
      }
    ],
    async createMain(api) {
      const { egret } = api;
      RES = api.RES;
      await RES.loadConfig('resource/default.res.json', 'resource/');
      await RES.loadGroup('preload');
      assert.equal(RES.getRes('star'), RES.getRes('icons.star'));
      assert.equal(RES.getRes('icons').getTexture('moon'), RES.getRes('icons.moon'));
      bitmap = new egret.Bitmap(RES.getRes('star'));
      first = bitmap.getChildAt(0);
      const root = new egret.Sprite();
      root.addChild(bitmap);
      return root;
    }
  });
  try {
    assert.equal(bitmap.width, 3);
    assert.deepEqual(bitmap.hitArea, { x: 0, y: 0, width: 3, height: 2 });
    assert.equal(await RES.getResAsync('icons.moon'), RES.getRes('icons.moon'));
    bitmap.texture = RES.getRes('icons.moon');
    assert.equal(first.isDisposed, true);
    assert.equal(bitmap.width, 1);
    assert.equal(trace.filter(item => item === 'image allocated').length, 1);
    await assert.rejects(RES.getResAsync('icons.absent'), { code: 'LEGACY_WEB_RESOURCE_UNKNOWN' });
  } finally {
    await game.dispose();
  }
  assert.equal(trace.filter(item => item === 'image disposed').length, 1);
});

test('admitted custom events retain data and refuse unsupported propagation', async () => {
  const { sdk, canvas } = host();
  const calls = [];
  let child;
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 200,
    height: 100,
    projectId: 'p_events',
    resources,
    createMain({ egret }) {
      const root = new egret.Sprite();
      child = new egret.Sprite();
      child.addEventListener(egret.Event.CHANGE, event => calls.push(event.data), child);
      root.addEventListener(egret.Event.CHANGE, () => calls.push('parent'), root);
      root.addChild(child);
      return root;
    }
  });
  try {
    child.dispatchEventWith('change', false, 17);
    assert.deepEqual(calls, [17]);
    assert.throws(() => child.dispatchEventWith('change', true, 18), { code: 'LEGACY_WEB_EVENT_UNSUPPORTED' });
  } finally {
    await game.dispose();
  }
});
