// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '@egret/engine';
import { createPointerInput } from '@egret/engine/input';
import { launchLegacyWeb } from '../tools/egret-migrate/legacy-web.mjs';

test('classic RES loads local URLs once, reports failures, and shares dynamic groups until released', async () => {
  const { sdk, canvas } = host();
  let res;
  const counts = new Map();
  canvas.ownerDocument.defaultView.fetch = async url => {
    counts.set(url, 1 + (counts.get(url) ?? 0));
    if (url === 'missing.txt' && counts.get(url) === 1) return new Response('', { status: 404 });
    if (url === 'chapter.bin') return new Response(Uint8Array.of(0, 255, 42));
    return new Response(url.endsWith('.json') ? '{"points":3}' : '渡口');
  };
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 200,
    height: 100,
    projectId: 'p_catalog',
    resources,
    createMain({ egret, RES }) {
      res = RES;
      return new egret.DisplayObjectContainer();
    }
  });
  try {
    assert.equal(await res.getResByUrl('before-config.txt'), '渡口');
    assert.equal(res.destroyRes('before-config.txt'), true);
    assert.equal(res.hasRes('before-config.txt'), false);
    await res.loadConfig(resources.configUrl, resources.root);
    assert.equal(res.hasRes('level'), true);
    assert.equal(res.hasRes('unknown'), false);
    assert.equal(res.createGroup('neighbors', ['preload', 'level']), true);
    assert.equal(res.createGroup('neighbors', ['level']), false);
    assert.deepEqual(
      res.getGroupByName('neighbors').map(item => item.name),
      ['level']
    );
    const receiver = {};
    const callback = [];
    const [a, b] = await Promise.all([
      res.getResByUrl(
        'resource/level.json',
        function (value, url) {
          assert.equal(this, receiver);
          callback.push([value, url]);
        },
        receiver,
        res.ResourceItem.TYPE_JSON
      ),
      res.getResAsync('level')
    ]);
    assert.equal(a, b);
    assert.equal(counts.get('resource/level.json'), 1);
    assert.deepEqual(callback, [[a, 'resource/level.json']]);
    assert.equal(res.createGroup('url-group', ['resource/level.json']), true);
    await res.loadGroup('url-group');
    assert.equal(res.isGroupLoaded('url-group'), true);
    await res.loadGroup('preload');
    await res.loadGroup('neighbors');
    res.destroyRes('url-group', false);
    assert.equal(res.destroyRes('preload', false), true);
    assert.equal(res.getRes('level'), a);
    assert.equal(res.destroyRes('neighbors', false), true);
    assert.equal(res.getRes('level'), null);
    assert.deepEqual(Array.from(new Uint8Array(await res.getResByUrl('chapter.bin'))), [0, 255, 42]);
    let failure;
    await assert.rejects(
      res.getResByUrl('missing.txt', (...args) => {
        failure = args;
      }),
      error => error === null
    );
    assert.deepEqual(failure, [null, 'missing.txt']);
    assert.equal(res.destroyRes('missing.txt'), true);
    assert.equal(res.hasRes('missing.txt'), false);
    assert.equal(await res.getResByUrl('missing.txt'), '渡口');
    assert.equal(counts.get('missing.txt'), 2);
    await assert.rejects(res.getResByUrl('../external.txt'));
    assert.equal(counts.has('../external.txt'), false);
  } finally {
    await game.dispose();
  }
});

test('closing the resource owner cancels a pending URL without calling old business code', async () => {
  const { sdk, canvas } = host();
  let res,
    finish,
    reads = 0,
    callbacks = 0;
  canvas.ownerDocument.defaultView.fetch = async () => {
    reads++;
    return reads === 1
      ? new Response('kept')
      : new Promise(ok => {
          finish = ok;
        });
  };
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 200,
    height: 100,
    projectId: 'p_res_closed',
    resources,
    createMain({ egret, RES }) {
      res = RES;
      return new egret.DisplayObjectContainer();
    }
  });
  await res.getResByUrl('ready.txt');
  const waiting = res.getResByUrl('pending.txt', () => callbacks++);
  const stopped = assert.rejects(waiting);
  await game.dispose();
  finish(new Response('late'));
  await stopped;
  assert.equal(res.getRes('ready.txt'), null);
  await assert.rejects(res.getResByUrl('new.txt', () => callbacks++));
  assert.deepEqual([reads, callbacks], [2, 0]);
});

test('a released URL cannot report an old failure against a new load with the same key', async () => {
  const { sdk, canvas } = host();
  let res,
    fail,
    reads = 0,
    errors = 0,
    callbacks = 0;
  canvas.ownerDocument.defaultView.fetch = async () =>
    ++reads === 1
      ? new Promise((_ok, no) => {
          fail = no;
        })
      : new Response('current');
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 200,
    height: 100,
    projectId: 'p_res_stale',
    resources,
    createMain({ egret, RES }) {
      res = RES;
      return new egret.DisplayObjectContainer();
    }
  });
  try {
    res.addEventListener(res.ResourceEvent.ITEM_LOAD_ERROR, () => errors++);
    const old = assert.rejects(
      res.getResByUrl('chapter.txt', () => callbacks++),
      { code: 'LEGACY_RESOURCE_RETIRED' }
    );
    assert.equal(res.destroyRes('chapter.txt'), true);
    assert.equal(await res.getResByUrl('chapter.txt'), 'current');
    fail(new Error('old request failed'));
    await old;
    assert.deepEqual([res.getRes('chapter.txt'), errors, callbacks], ['current', 0, 0]);
  } finally {
    await game.dispose();
  }
});

test('project additions use the game scope and keep engine operations and class identity intact', async () => {
  const { sdk, canvas } = host();
  let closed = 0,
    baseClass;
  const options = {
    canvas,
    width: 200,
    height: 100,
    projectId: 'p_extensions',
    resources,
    provideBindings(api, scope) {
      baseClass = api.egret.Sprite;
      scope.use({
        dispose() {
          closed++;
        }
      });
      return {
        egret: { SomeCodec: class SomeCodec {} },
        RES: {
          getProjectPortrait(id) {
            return 'sprite:' + id;
          }
        }
      };
    },
    createMain({ egret, RES }) {
      assert.equal(egret.Sprite, baseClass);
      assert.equal(egret.getDefinitionByName('egret.SomeCodec'), egret.SomeCodec);
      assert.equal(RES.getProjectPortrait(4), 'sprite:4');
      assert.equal(typeof RES.getResByUrl, 'function');
      return new egret.Sprite();
    }
  };
  const game = await launchLegacyWeb(sdk, options);
  await game.dispose();
  assert.equal(closed, 1);
  await assert.rejects(
    launchLegacyWeb(sdk, { ...options, provideBindings: () => ({ RES: { getRes() {} } }) }),
    /Conflicting/
  );
});

function host(storage = new Map(), realPointer = false) {
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
          pointer: realPointer
            ? createPointerInput({ engine: game, scope, width: options.width, height: options.height })
            : { events: { tap } },
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

test('a drag between old display objects ends on the release target while a click still taps once', async () => {
  const { sdk, canvas } = host(new Map(), true);
  const trace = [];
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 200,
    height: 100,
    projectId: 'p_cross_target',
    createMain({ egret }) {
      const root = new egret.Sprite();
      for (const x of [0, 50]) {
        const button = new egret.Sprite();
        button.x = x;
        button.touchEnabled = true;
        button.hitArea = { x: 0, y: 0, width: 30, height: 30 };
        for (const type of ['touchBegin', 'touchMove', 'touchEnd', 'touchTap'])
          button.addEventListener(type, e => trace.push([e.type, x, e.localX]), root);
        root.addChild(button);
      }
      return root;
    }
  });
  try {
    const step = (globalX, timestamp, buttons) => ({ globalX, globalY: 10, timestamp, buttons });
    const begin = time => game.pointer.begin({ ...step(10, time, 1), pointerId: 1, pointerType: 'touch' });
    const drag = begin(0);
    game.pointer.move(drag, step(62, 1, 1));
    game.pointer.end(drag, step(62, 2, 0));
    game.pointer.end(begin(3), step(10, 4, 0));
    assert.deepEqual(trace, [
      ['touchBegin', 0, 10],
      ['touchMove', 50, 12],
      ['touchEnd', 50, 12],
      ['touchBegin', 0, 10],
      ['touchEnd', 0, 10],
      ['touchTap', 0, 10]
    ]);
  } finally {
    await game.dispose();
  }
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

test('a pending legacy text field can set its box before a single-line progress label is ready', async () => {
  const { sdk, canvas } = host();
  let label;
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 600,
    height: 600,
    projectId: 'p_text_box',
    createMain({ egret }) {
      label = new egret.TextField();
      label.width = 480;
      label.height = 100;
      label.textAlign = 'center';
      label.text = 'Loading...3/16';
      return label;
    }
  });
  try {
    assert.deepEqual([label.width, label.height, label.scaleX], [480, 100, 1]);
    assert.equal(label.getChildAt(0).x, 240);
  } finally {
    await game.dispose();
  }
});

test('event-style RES startup waits for group completion and exposes counts', async () => {
  const { sdk, canvas } = host();
  const observed = [];
  let api,
    listenerCalls = 0;
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 200,
    height: 100,
    projectId: 'p_event_res',
    resources,
    createMain({ egret, RES }) {
      api = egret;
      const root = new egret.Sprite();
      const names = RES.ResourceEvent;
      RES.addEventListener(
        names.CONFIG_COMPLETE,
        () => {
          RES.addEventListener(
            names.GROUP_PROGRESS,
            e => observed.push([e.groupName, e.itemsLoaded, e.itemsTotal]),
            root
          );
          RES.addEventListener(
            names.GROUP_COMPLETE,
            e => observed.push([e.groupName, RES.getRes('level').points]),
            root
          );
          RES.loadGroup('preload');
        },
        root
      );
      RES.loadConfig(resources.configUrl, resources.root);
      return root;
    }
  });
  try {
    assert.deepEqual(observed, [
      ['preload', 1, 1],
      ['preload', 3]
    ]);
    const callback = () => {
      listenerCalls++;
    };
    api.startTick(callback, observed);
    api.startTick(callback, observed);
    game.engine.advanceTime(0);
    game.engine.advanceTime(0.01);
    assert.ok(listenerCalls >= 1);
    api.stopTick(callback, observed);
    const before = listenerCalls;
    game.engine.advanceTime(0.02);
    assert.equal(listenerCalls, before);
  } finally {
    await game.dispose();
  }
});

test('a failed RES group identifies its item and retries with the same declaration', async () => {
  const { sdk, canvas } = host();
  let available = false;
  const events = [];
  canvas.ownerDocument.defaultView.fetch = async () =>
    available ? new Response('{"points":4}') : new Response('', { status: 503 });
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 200,
    height: 100,
    projectId: 'p_event_retry',
    resources,
    async createMain({ egret, RES }) {
      const root = new egret.Sprite();
      RES.addEventListener(
        RES.ResourceEvent.ITEM_LOAD_ERROR,
        event => events.push([event.groupName, event.resItem.name]),
        root
      );
      RES.addEventListener(
        RES.ResourceEvent.GROUP_LOAD_ERROR,
        event => events.push([event.groupName, event.itemsLoaded]),
        root
      );
      await RES.loadConfig(resources.configUrl, resources.root);
      await assert.rejects(RES.loadGroup('preload'), { code: 'LEGACY_WEB_RESOURCE_READ_FAILED' });
      assert.equal(RES.isGroupLoaded('preload'), false);
      available = true;
      await RES.loadGroup('preload');
      assert.deepEqual(RES.getRes('level'), { points: 4 });
      return root;
    }
  });
  try {
    assert.deepEqual(events, [
      ['preload', 'level'],
      ['preload', 0]
    ]);
  } finally {
    await game.dispose();
  }
});

test('a misspelled RES group delivers an error to an event-only application', async () => {
  const { sdk, canvas } = host();
  const reports = [];
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 200,
    height: 100,
    projectId: 'p_unknown_group',
    resources,
    createMain({ egret, RES }) {
      const root = new egret.Sprite();
      RES.addEventListener(RES.ResourceEvent.GROUP_LOAD_ERROR, event => reports.push(event.groupName), root);
      RES.loadGroup('absent');
      return root;
    }
  });
  try {
    assert.deepEqual(reports, ['absent']);
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
    bitmap.width = 120;
    bitmap.height = 80;
    assert.deepEqual(
      [bitmap.scaleX, bitmap.scaleY, bitmap.getChildAt(0).scaleX, bitmap.getChildAt(0).scaleY],
      [1, 1, 60, 80]
    );
    assert.equal(game.stage.hitTest(95, 35), bitmap);
    assert.equal(bitmap.globalToLocal(95, 35).x, 95);
    bitmap.width = NaN;
    bitmap.height = NaN;
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

test('custom events retain payload, cancellation and target across a bubbling dispatch', async () => {
  const { sdk, canvas } = host();
  const calls = [];
  let child, CustomEvent;
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 200,
    height: 100,
    projectId: 'p_events',
    resources,
    createMain({ egret }) {
      const root = new egret.Sprite();
      child = new egret.Sprite();
      CustomEvent = egret.Event;
      child.addEventListener(egret.Event.CHANGE, event => calls.push(event.data), child);
      root.addEventListener(egret.Event.CHANGE, () => calls.push('parent'), root);
      root.addChild(child);
      return root;
    }
  });
  try {
    child.dispatchEventWith('change', false, 17);
    assert.deepEqual(calls, [17]);
    child.dispatchEventWith('change', true, 18);
    assert.deepEqual(calls, [17, 18, 'parent']);
    const custom = new CustomEvent('sceneDecision', true, true, { cost: 6 });
    child.parent.addEventListener(
      'sceneDecision',
      e => {
        assert.equal(e, custom);
        assert.equal(e.target, child);
        assert.equal(e.currentTarget, child.parent);
        e.preventDefault();
      },
      null
    );
    assert.equal(child.dispatchEvent(custom), false);
    assert.equal(custom.isDefaultPrevented(), true);
    assert.equal(custom.currentTarget, null);
    assert.equal(custom.target, child);
  } finally {
    await game.dispose();
  }
});

test('a migrated game gets the packet types from its own egret namespace', async () => {
  const { sdk, canvas } = host();
  let wire;
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 200,
    height: 100,
    projectId: 'p_packet_bridge',
    createMain({ egret }) {
      class Packet extends egret.ByteArray {}
      const message = new Packet();
      message.endian = egret.Endian.LITTLE_ENDIAN;
      message.writeUnsignedShort(0xf012);
      wire = new Uint8Array(message.buffer);
      return new egret.Sprite();
    }
  });
  try {
    assert.deepEqual([...wire], [0x12, 0xf0]);
  } finally {
    await game.dispose();
  }
});

test('MovieClip samples RES atlas holds, offsets and labels on the shared clock and releases its binding', async () => {
  const { sdk, canvas, trace } = host();
  const events = [];
  let movie, root, factory, data;
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 120,
    height: 80,
    projectId: 'p_legacy_movie',
    resources: {
      ...resources,
      resources: [{ name: 'page', type: 'image', url: 'page.png' }],
      groups: [{ name: 'preload', keys: ['page'] }]
    },
    async createMain({ egret, RES }) {
      await RES.loadConfig(resources.configUrl, resources.root);
      const texture = await RES.getResAsync('page');
      const authored = {
        mc: {
          step: {
            frameRate: 10,
            labels: [{ name: 'action', frame: 2, end: 3 }],
            events: [{ name: 'land', frame: 3 }],
            frames: [
              { res: 'left', x: -3, duration: 2 },
              { res: 'right', x: 5, y: 1 }
            ]
          }
        },
        res: { left: { x: 0, y: 0, w: 1, h: 1 }, right: { x: 1, y: 0, w: 1, h: 1 } }
      };
      factory = new egret.MovieClipDataFactory(authored, texture);
      data = factory.generateMovieClipData('step');
      assert.equal(factory.generateMovieClipData('step'), data);
      assert.equal(factory.generateMovieClipData('unknown'), null);
      movie = new egret.MovieClip(data);
      movie.addEventListener(egret.MovieClipEvent.FRAME_LABEL, event => events.push(event.frameLabel), movie);
      movie.addEventListener(egret.Event.COMPLETE, () => events.push('complete'), movie);
      root = new egret.Sprite();
      root.addChild(movie);
      movie.gotoAndPlay('action', 1);
      return root;
    }
  });
  try {
    const bitmap = movie.getChildAt(0);
    assert.deepEqual([movie.totalFrames, movie.currentFrame, bitmap.x, bitmap.sourceRect.x], [3, 2, -3, 0]);
    game.engine.advanceTime(1);
    game.engine.advanceTime(1.11);
    assert.deepEqual([movie.currentFrame, bitmap.x, bitmap.y, bitmap.sourceRect.x], [3, 5, 1, 1]);
    game.engine.advanceTime(1.22);
    assert.deepEqual(events, ['land', 'complete']);
    assert.equal(movie.isPlaying, false);

    movie.gotoAndPlay(1, -1);
    root.removeChild(movie);
    game.engine.advanceTime(1.33);
    assert.equal(movie.currentFrame, 1);
    root.addChild(movie);
    game.engine.advanceTime(1.44);
    assert.equal(movie.currentFrame, 2);
    movie.gotoAndStop(3);
    factory.clearCache();
    movie.movieClipData = factory.generateMovieClipData('step');
    assert.equal(bitmap.isDisposed, true);
    assert.equal(movie.numChildren, 1);
    assert.equal(movie.currentFrame, 1);
  } finally {
    await game.dispose();
  }
  assert.equal(trace.filter(entry => entry === 'image allocated').length, 1);
  assert.equal(trace.filter(entry => entry === 'image disposed').length, 1);
});

test('MovieClip reports a label once on entry and one loop notification for a multi-loop tick', async () => {
  const { sdk, canvas } = host();
  const seen = [];
  let movie;
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 120,
    height: 80,
    projectId: 'p_clip_events',
    resources: { ...resources, resources: [{ name: 'p', type: 'image', url: 'p.png' }], groups: [] },
    async createMain({ egret, RES }) {
      await RES.loadConfig(resources.configUrl, resources.root);
      const page = await RES.getResAsync('p');
      const authored = {
        mc: {
          loop: {
            frameRate: 50,
            frames: [{ res: 'one' }, { res: 'two' }],
            events: [
              { frame: 1, name: 'first' },
              { frame: 2, name: 'second' }
            ]
          }
        },
        res: { one: { x: 0, y: 0, w: 1, h: 1 }, two: { x: 1, y: 0, w: 1, h: 1 } }
      };
      movie = new egret.MovieClip();
      movie.addEventListener(egret.MovieClipEvent.FRAME_LABEL, e => seen.push(e.frameLabel), movie);
      movie.addEventListener(egret.Event.LOOP_COMPLETE, () => seen.push('loop'), movie);
      movie.movieClipData = new egret.MovieClipDataFactory(authored, page).generateMovieClipData();
      movie.gotoAndStop(1);
      movie.gotoAndPlay(1, -1);
      movie.gotoAndStop(2);
      movie.gotoAndStop(2);
      movie.gotoAndPlay(1, -1);
      return movie;
    }
  });
  try {
    assert.deepEqual(seen, ['first', 'second', 'first']);
    seen.length = 0;
    game.engine.advanceTime(0);
    const step = game.engine.advanceTime(0.1);
    assert.equal(step.deltaSeconds, 0.1);
    assert.deepEqual(seen, ['second', 'first', 'second', 'first', 'second', 'loop']);
  } finally {
    await game.dispose();
  }
});

test('a repaged texture serves an ordinary Bitmap and a MovieClip crossing the page boundary', async () => {
  const { sdk, canvas, trace } = host();
  let actor, picture;
  const tiles = [
    { x: 0, y: 0, width: 1, height: 1, left: 0, top: 0, url: 'page-left.png' },
    { x: 1, y: 0, width: 1, height: 1, left: 1, top: 0, url: 'page-right.png' }
  ];
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 120,
    height: 80,
    projectId: 'p_repage',
    moviePages: [{ texture: 'page', width: 2, height: 1, tiles }],
    resources: { ...resources, resources: [{ name: 'page', type: 'image', url: 'huge.png' }], groups: [] },
    async createMain({ egret, RES }) {
      await RES.loadConfig(resources.configUrl, resources.root);
      const texture = await RES.getResAsync('page');
      const data = {
        mc: {
          move: {
            frameRate: 12,
            frames: [
              { res: 'wide', x: -2, y: 1 },
              { res: 'part', x: 3, y: -2 }
            ]
          }
        },
        res: { wide: { x: 0, y: 0, w: 2, h: 1 }, part: { x: 1, y: 0, w: 1, h: 1 } }
      };
      picture = new egret.Bitmap(texture);
      actor = new egret.MovieClip(new egret.MovieClipDataFactory(data, texture).generateMovieClipData());
      const root = new egret.Sprite();
      root.addChild(picture);
      root.addChild(actor);
      return root;
    }
  });
  try {
    const composite = actor.getChildAt(0),
      full = picture.getChildAt(0);
    assert.deepEqual([picture.width, picture.height, full.numChildren], [2, 1, 2]);
    assert.deepEqual([composite.x, composite.y, composite.numChildren], [-2, 1, 2]);
    assert.deepEqual(
      [0, 1].map(i => {
        const b = composite.getChildAt(i);
        return [b.x, b.sourceRect.x, b.sourceRect.width];
      }),
      [
        [0, 0, 1],
        [1, 1, 1]
      ]
    );
    actor.gotoAndStop(2);
    assert.equal(composite.getChildAt(0).visible, false);
    assert.deepEqual([composite.x, composite.y, composite.getChildAt(1).x], [3, -2, 0]);
    assert.equal(trace.filter(item => item === 'image allocated').length, 2);
  } finally {
    await game.dispose();
  }
  assert.equal(trace.filter(item => item === 'image disposed').length, 2);
});

test('shared legacy HTML keeps Chinese styled runs, resolves only committed link hits, and retires stale views', async () => {
  const { sdk, canvas, trace } = host();
  canvas.ownerDocument.createElement = () => ({
    getContext: () => ({ measureText: text => ({ width: Array.from(text).length * 10 }) })
  });
  let api, caption, root;
  const links = [];
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 160,
    height: 80,
    projectId: 'p_legacy_styled_caption',
    createMain(value) {
      api = value.egret;
      root = new api.Sprite();
      const parser = new api.HtmlTextParser();
      caption = new api.TextField();
      caption.touchEnabled = true;
      caption.x = 7;
      caption.y = 2;
      caption.width = 20;
      caption.height = 60;
      caption.size = 16;
      caption.textFlow = parser.parser('<font color="#ff9000">市</font><a href="event:gate&amp;menu"><b>北门</b></a>');
      assert.equal(caption.text, '市北门');
      assert.deepEqual(caption.textFlow, [
        { text: '市', style: { textColor: 0xff9000 } },
        { text: '北门', style: { href: 'event:gate&menu', bold: true } }
      ]);
      assert.throws(() => parser.parser('<a href="https://example.invalid">x</a>'), {
        code: 'LEGACY_RICH_TEXT_UNSUPPORTED'
      });
      assert.throws(() => parser.parser('<font color="bad">x</font>'), { code: 'LEGACY_RICH_TEXT_UNSUPPORTED' });
      assert.throws(
        () => {
          caption.textFlow = [{ text: 'X', style: { background: true } }];
        },
        { code: 'LEGACY_RICH_TEXT_UNSUPPORTED' }
      );
      caption.addEventListener(api.TextEvent.LINK, e => links.push([e.text, e.target === caption, e.bubbles]), root);
      root.addChild(caption);
      return root;
    }
  });
  const tapAt = (x, y) =>
    api.TouchEvent.dispatchTouchEvent(caption, api.TouchEvent.TOUCH_TAP, true, false, 7 + x, 2 + y, 1, true);
  try {
    assert(trace.some(s => Array.isArray(s) && s[1] === '市' && s[3] === 0xff9000));
    tapAt(3, 8);
    tapAt(14, 8);
    tapAt(4, 22);
    tapAt(21, 8);
    assert.deepEqual(links, [
      ['gate&menu', true, false],
      ['gate&menu', true, false]
    ]);
    const old = caption.getChildAt(0);
    const duplicate = caption.textFlow;
    duplicate[1].style.href = 'event:outdated';
    assert.equal(caption.textFlow[1].style.href, 'event:gate&menu');
    caption.textFlow = [{ text: '新', style: { href: 'event:new' } }];
    tapAt(4, 8);
    assert.equal(links.length, 2);
    assert.equal(old.isDisposed, true);
    root.removeChild(caption);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(caption.numChildren, 0);
    root.addChild(caption);
    await new Promise(resolve => setImmediate(resolve));
    tapAt(4, 8);
    assert.deepEqual(links.at(-1), ['new', true, false]);
    caption.text = '结';
    await new Promise(resolve => setImmediate(resolve));
    tapAt(4, 8);
    assert.equal(links.length, 3);
    assert.equal(caption.getChildAt(0).name, '结');
  } finally {
    await game.dispose();
  }
});

test('an EUI label preserves a linked styled row when relaid out, then returns to ordinary text', async () => {
  const { sdk, canvas } = host();
  canvas.ownerDocument.createElement = () => ({
    getContext: () => ({ measureText: text => ({ width: Array.from(text).length * 10 }) })
  });
  let label,
    api,
    opened = 0;
  const game = await launchLegacyWeb(sdk, {
    canvas,
    width: 120,
    height: 80,
    projectId: 'p_legacy_eui_link',
    theme: { skins: {}, exmls: [] },
    createMain({ egret, eui }) {
      api = egret;
      const root = new eui.Group();
      label = new eui.Label();
      label.width = 72;
      label.height = 60;
      label.size = 12;
      label.textAlign = 'right';
      label.verticalAlign = 'bottom';
      label.touchEnabled = true;
      label.textFlow = [{ text: '入口', style: { italic: true, underline: true, href: 'event:open' } }];
      label.addEventListener(egret.TextEvent.LINK, () => opened++, label);
      root.addChild(label);
      return root;
    }
  });
  try {
    const tap = (x, y) =>
      api.TouchEvent.dispatchTouchEvent(label, api.TouchEvent.TOUCH_TAP, true, false, x, y, 1, true);
    tap(64, 55);
    tap(5, 55);
    assert.equal(opened, 1);
    label.width = 60;
    await new Promise(resolve => setImmediate(resolve));
    tap(64, 55);
    tap(47, 55);
    assert.equal(opened, 2);
    assert.equal(label.text, '入口');
    label.text = '普通';
    await new Promise(resolve => setImmediate(resolve));
    tap(47, 55);
    assert.equal(opened, 2);
    assert.equal(label.getChildAt(0).name, '普通');
  } finally {
    await game.dispose();
  }
});
