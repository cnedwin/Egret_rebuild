// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as engine from '@egret/engine';
import { compileExml } from '../tools/egret-migrate/exml.mjs';
import { launchLegacyWeb } from '../tools/egret-migrate/legacy-web.mjs';

const ns = 'http://ns.egret.com/eui';
const skin = (name, inner, properties = '') =>
  compileExml('<e:Skin xmlns:e="' + ns + '" class="' + name + '" ' + properties + '>' + inner + '</e:Skin>', {
    path: 'resource/' + name + '.exml'
  });
const buttonSkin = skin(
  'ButtonSkin',
  '<e:Rect width="100%" height="100%" fillColor="0x223344"/>' +
    '<e:Label id="labelDisplay" width="100%" height="100%" size="16" textAlign="center" verticalAlign="middle"/>',
  'minWidth="100"'
);

function host() {
  const trace = [];
  const tap = engine.createEventType('tap', { bubbles: true });
  const canvas = { ownerDocument: { defaultView: { AbortController, fetch } } };
  const sdk = {
    ...engine,
    async createBrowserGame() {
      const actual = await engine.createEngine({
        host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout: () => () => {} }
      });
      const scope = actual.createScope();
      const image = engine.createAssetType('fixture-eui-texture', engine.isTexture);
      actual.assets.register(image, {
        async load(ref) {
          const width = ref.key === 'resource/icon.png' ? 4 : 2;
          return engine.createTexture(
            engine.createImageData2D({
              width,
              height: 2,
              pixels: new Uint8Array(width * 8).fill(255)
            })
          );
        },
        dispose(texture) {
          texture.dispose();
        }
      });
      return {
        engine: actual,
        scope,
        stage: actual.stage,
        pointer: { events: { tap } },
        async loadTexture(url) {
          return scope.use(await actual.assets.acquire(engine.createAssetRef(image, url)));
        },
        async createLabel({ scope: owner, ...initial }) {
          const display = owner.use(new engine.Sprite());
          let held = initial;
          return {
            display,
            ready: Promise.resolve(),
            set(changes) {
              held = { ...held, ...changes };
              display.graphics
                .clear()
                .beginFill(held.color ?? 0xffffff)
                .drawRect(0, 0, String(held.text).length * 10, 10)
                .endFill();
              trace.push(held.text);
            },
            dispose: () => display.dispose()
          };
        },
        loop: { start() {} },
        dispose: () => actual.dispose()
      };
    }
  };
  return { canvas, sdk, tap, trace };
}

const resources = {
  configUrl: 'resource/default.res.json',
  root: 'resource/',
  resources: [
    { name: 'icon', type: 'image', url: 'resource/icon.png' },
    { name: 'alternate', type: 'image', url: 'resource/alternate.png' }
  ],
  groups: [{ name: 'all', keys: ['icon', 'alternate'] }]
};

function setup(...exmls) {
  const { canvas, sdk, trace, tap } = host();
  return {
    sdk,
    trace,
    tap,
    options: {
      canvas,
      width: 480,
      height: 320,
      projectId: 'p_eui_test',
      resources,
      theme: {
        themePath: 'resource/default.thm.json',
        skins: { 'eui.Button': 'ButtonSkin', Menu: 'MenuSkin' },
        exmls: [buttonSkin, ...exmls]
      }
    }
  };
}

test('a nested static theme creates named parts before childrenCreated and supports vertical layout, default button skins, min size and label alignment', async () => {
  const menuSkin = skin(
    'MenuSkin',
    '<e:Group id="stack" width="200" height="200" left="12" top="10">' +
      '<e:layout><e:VerticalLayout gap="8" paddingLeft="10" paddingRight="10" paddingTop="10" paddingBottom="10" horizontalAlign="center" verticalAlign="middle"/></e:layout>' +
      '<e:Rect id="banner" width="100" minWidth="120" height="20" fillColor="0xaa6644"/>' +
      '<e:Button id="action" width="80" height="30" label="Run"/>' +
      '</e:Group>',
    'width="480" height="320"'
  );
  const { sdk, options, tap } = setup(menuSkin);
  let root,
    menu,
    events = 0,
    themeCompleted = 0;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui, egret }) {
      class Menu extends eui.Component {
        stack;
        banner;
        action;
        childrenCreated() {
          assert.ok(this.action);
          assert.ok(this.action.labelDisplay);
          events++;
        }
      }
      root = new eui.UILayer();
      const theme = new eui.Theme('resource/default.thm.json');
      theme.addEventListener(eui.UIEvent.COMPLETE, () => themeCompleted++, root);
      menu = new Menu();
      root.addChild(menu);
      return root;
    }
  });
  try {
    assert.equal(themeCompleted, 1);
    assert.equal(events, 1);
    assert.deepEqual([root.width, root.height, menu.width, menu.height], [480, 320, 480, 320]);
    assert.deepEqual([menu.stack.x, menu.stack.y], [12, 10]);
    assert.deepEqual([menu.banner.width, menu.banner.x, menu.banner.y], [120, 40, 71]);
    assert.deepEqual([menu.action.width, menu.action.x, menu.action.y], [100, 50, 99]);
    assert.equal(menu.action.labelDisplay.text, 'Run');
    assert.deepEqual(menu.action.hitArea, { x: 0, y: 0, width: 100, height: 30 });
    const visual = menu.action.labelDisplay.getChildAt(0);
    assert.deepEqual([visual.x, visual.y], [35, 10]);
    menu.action.enabled = false;
    assert.equal(menu.action.touchEnabled, false);
    assert.equal(menu.action.touchChildren, false);
    menu.action.enabled = true;
    assert.equal(menu.action.touchEnabled, true);
    assert.equal(menu.action.touchChildren, false);
    menu.action.addEventListener('touchTap', () => events++, menu);
    menu.action.dispatchEvent(new engine.Event(tap, { globalX: 70, globalY: 100, session: { pointerId: 1 } }));
    assert.equal(events, 2);
    root.removeChild(menu);
    root.addChild(menu);
    assert.equal(events, 2);
    assert.equal(menu.numChildren, 1);
  } finally {
    await game.dispose();
  }
});

test('horizontal and basic layout position children against box edges, center and programmatic size changes', async () => {
  const menuSkin = skin(
    'MenuSkin',
    '<e:Group id="row" width="200" height="100">' +
      '<e:layout><e:HorizontalLayout paddingLeft="5" paddingRight="5" gap="10" horizontalAlign="right" verticalAlign="bottom"/></e:layout>' +
      '<e:Rect id="first" width="30" height="20"/><e:Rect id="second" width="50" height="40"/>' +
      '</e:Group>' +
      '<e:Group id="anchored" y="105" width="100%" height="100">' +
      '<e:Rect id="stretch" left="10" right="20" top="5" bottom="15"/>' +
      '<e:Rect id="centered" width="20" height="30" horizontalCenter="0" verticalCenter="0" anchorOffsetX="3" anchorOffsetY="4"/>' +
      '</e:Group>',
    'width="480" height="320"'
  );
  const { sdk, options } = setup(menuSkin);
  let menu;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      new eui.Theme('resource/default.thm.json');
      class Menu extends eui.Component {}
      menu = new Menu();
      return menu;
    }
  });
  try {
    assert.deepEqual([menu.first.x, menu.first.y, menu.second.x, menu.second.y], [105, 80, 145, 60]);
    assert.deepEqual([menu.stretch.x, menu.stretch.y, menu.stretch.width, menu.stretch.height], [10, 5, 450, 80]);
    menu.stretch.width = 110;
    assert.equal(menu.stretch.width, 450);
    assert.deepEqual([menu.centered.x, menu.centered.y], [233, 39]);
    menu.width = 300;
    assert.deepEqual([menu.anchored.width, menu.stretch.width, menu.centered.x], [300, 270, 143]);
  } finally {
    await game.dispose();
  }
});

test('image source replacement has real sized pixels and skin part IDs cannot overwrite an inherited property', async () => {
  const imageSkin = skin(
    'MenuSkin',
    '<e:Image id="icon" source="icon" width="80" height="40"/>',
    'width="100" height="80"'
  );
  const { sdk, options } = setup(imageSkin);
  let menu;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    async createMain({ eui, RES }) {
      await RES.loadConfig('resource/default.res.json', 'resource/');
      await RES.loadGroup('all');
      new eui.Theme('resource/default.thm.json');
      class Menu extends eui.Component {}
      menu = new Menu();
      return menu;
    }
  });
  try {
    assert.deepEqual([menu.icon.getChildAt(0).width, menu.icon.getChildAt(0).height], [80, 40]);
    menu.icon.source = 'alternate';
    assert.deepEqual([menu.icon.getChildAt(0).width, menu.icon.getChildAt(0).height], [80, 40]);
  } finally {
    await game.dispose();
  }

  const collision = setup(skin('MenuSkin', '<e:Group id="getChildAt"/>'));
  await assert.rejects(
    launchLegacyWeb(collision.sdk, {
      ...collision.options,
      createMain({ eui }) {
        new eui.Theme('resource/default.thm.json');
        class Menu extends eui.Component {}
        return new Menu();
      }
    }),
    { code: 'LEGACY_EUI_UNSUPPORTED' }
  );
});

test('promise-returning creation hooks complete in order and startup errors are observed', async () => {
  const { sdk, options } = setup(skin('MenuSkin', '<e:Group id="part" width="10" height="10"/>'));
  const order = [];
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      class Main extends eui.UILayer {
        async createChildren() {
          super.createChildren();
          await Promise.resolve();
          this.skinName = 'MenuSkin';
          order.push('create');
        }
        async childrenCreated() {
          super.childrenCreated();
          assert.ok(this.part);
          await Promise.resolve();
          order.push('children');
        }
      }
      const main = new Main();
      main.addEventListener(eui.UIEvent.CREATION_COMPLETE, () => order.push('complete'), main);
      return main;
    }
  });
  try {
    assert.deepEqual(order, ['create', 'children', 'complete']);
  } finally {
    await game.dispose();
  }
  await assert.rejects(
    launchLegacyWeb(sdk, {
      ...options,
      createMain({ eui }) {
        class Broken extends eui.Component {
          async createChildren() {
            throw new Error('creation failed');
          }
        }
        return new Broken();
      }
    }),
    /creation failed/
  );
});

test('recursive skin references refuse before constructing an unbounded display tree', async () => {
  const { sdk, options } = setup(skin('MenuSkin', '<e:Component skinName="MenuSkin"/>'));
  await assert.rejects(
    launchLegacyWeb(sdk, {
      ...options,
      createMain({ eui }) {
        const menu = new eui.Component();
        menu.skinName = 'MenuSkin';
        return menu;
      }
    }),
    { code: 'LEGACY_EUI_UNSUPPORTED' }
  );
});
