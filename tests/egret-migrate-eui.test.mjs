// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as engine from '@egret/engine';
import { createPointerInput } from '@egret/engine/input';
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

test('a skinned Rect receives taps on its face and a hidden Rect receives none', async () => {
  const tileSkin = skin('TileSkin', '<e:Rect id="face" width="40" height="40"/>', 'width="40" height="40"');
  const { sdk, options } = setup(tileSkin);
  const make = sdk.createBrowserGame;
  sdk.createBrowserGame = async () => {
    const game = await make();
    game.pointer = createPointerInput({ engine: game.engine, scope: game.scope, width: 480, height: 320 });
    return game;
  };
  let tile,
    hits = 0;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      new eui.Theme('resource/default.thm.json');
      tile = new eui.Rect();
      tile.skinName = 'TileSkin';
      tile.addEventListener(
        'touchTap',
        event => {
          assert.equal(event.target, tile);
          hits++;
        },
        tile
      );
      const root = new eui.UILayer();
      root.addChild(tile);
      return root;
    }
  });
  try {
    const point = { globalX: 15, globalY: 13, buttons: 1, timestamp: 0 };
    const press = game.pointer.begin({ ...point, pointerType: 'touch', pointerId: 1 });
    game.pointer.end(press, { ...point, buttons: 0, timestamp: 1 });
    assert.equal(hits, 1);
    assert.equal(tile.face.fillColor, 0x000000);
    assert.equal(tile.face.strokeColor, 0x444444);
    tile.visible = false;
    const hidden = game.pointer.begin({ ...point, pointerType: 'touch', pointerId: 2, timestamp: 2 });
    game.pointer.end(hidden, { ...point, buttons: 0, timestamp: 3 });
    assert.equal(hits, 1);
  } finally {
    await game.dispose();
  }
});

test('a button uses the down skin until the same pointer ends or the screen leaves', async () => {
  const menuSkin = skin(
    'MenuSkin',
    '<e:Button id="openButton" width="50" height="30"><e:skinName>' +
      '<e:Skin states="up,down,disabled"><e:Rect width="50" height="30" fillColor="0x444444" fillColor.down="0xff7700"/></e:Skin>' +
      '</e:skinName></e:Button>'
  );
  const { sdk, options } = setup(menuSkin);
  const make = sdk.createBrowserGame;
  sdk.createBrowserGame = async () => {
    const game = await make();
    game.pointer = createPointerInput({ engine: game.engine, scope: game.scope, width: 480, height: 320 });
    return game;
  };
  let menu, root;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      new eui.Theme('resource/default.thm.json');
      class Menu extends eui.Component {}
      root = new eui.UILayer();
      root.addChild((menu = new Menu()));
      return root;
    }
  });
  try {
    const point = { globalX: 12, globalY: 15, buttons: 1, timestamp: 0 };
    const button = menu.openButton;
    const a = game.pointer.begin({ ...point, pointerType: 'touch', pointerId: 1 });
    assert.equal(button.currentState, 'down');
    const b = game.pointer.begin({ ...point, pointerType: 'touch', pointerId: 2 });
    game.pointer.end(b, { ...point, buttons: 0, timestamp: 1 });
    assert.equal(button.currentState, 'down');
    game.pointer.end(a, { ...point, globalX: 90, buttons: 0, timestamp: 2 });
    assert.equal(button.currentState, 'up');
    game.pointer.begin({ ...point, pointerType: 'touch', pointerId: 3, timestamp: 3 });
    root.removeChild(menu);
    root.addChild(menu);
    assert.equal(button.currentState, 'up');
    button.enabled = false;
    assert.equal(button.currentState, 'disabled');
  } finally {
    await game.dispose();
  }
});

test('attaching a prebuilt level map measures the tree together and exposes layout to game callbacks', async () => {
  const { sdk, options } = setup();
  let root,
    source,
    panel,
    first,
    calls = 0;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      source = eui;
      return (root = new eui.UILayer());
    }
  });
  try {
    class Marker extends source.Rect {
      get width() {
        calls++;
        return super.width;
      }
      set width(value) {
        super.width = value;
      }
    }
    panel = new source.Group();
    panel.width = 200;
    panel.height = 200;
    for (let i = 0; i < 80; i++) {
      const marker = new Marker(16, 16);
      marker.x = i;
      panel.addChild(marker);
      first ??= marker;
    }
    let observed;
    first.addEventListener(
      'addedToStage',
      () => {
        observed = first.hitArea?.width;
        first.width = 22;
        assert.equal(first.hitArea.width, 22);
      },
      first
    );
    calls = 0;
    root.addChild(panel);
    assert.equal(observed, 16);
    assert.equal(first.hitArea.width, 22);
    assert.ok(calls < 80 * 50, 'Unexpected repeated full-tree measurements: ' + calls);
  } finally {
    await game.dispose();
  }
});

test('intrinsic tile groups choose a compact grid and honor height-only constraints', async () => {
  const cells = '<e:Rect width="20" height="20"/>'.repeat(4);
  const tile = '<e:layout><e:TileLayout horizontalGap="0" verticalGap="0"/></e:layout>' + cells;
  const { sdk, options } = setup(
    skin('MenuSkin', '<e:Group id="square">' + tile + '</e:Group><e:Group id="tall" height="80">' + tile + '</e:Group>')
  );
  let menu;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      new eui.Theme('resource/default.thm.json');
      class Menu extends eui.Component {}
      return (menu = new Menu());
    }
  });
  try {
    assert.deepEqual(
      [menu.square.width, menu.square.height, menu.square.getChildAt(2).x, menu.square.getChildAt(2).y],
      [40, 40, 0, 20]
    );
    assert.deepEqual(
      [menu.tall.width, menu.tall.height, menu.tall.getChildAt(3).x, menu.tall.getChildAt(3).y],
      [20, 80, 0, 60]
    );
  } finally {
    await game.dispose();
  }
});

test('row-major tiles reflow on resize and each inline button owns its own label', async () => {
  const button = (id, label) =>
    '<e:Button id="' +
    id +
    '" label="' +
    label +
    '" width="22" height="12">' +
    '<e:skinName><e:Skin><e:Label id="labelDisplay"/></e:Skin></e:skinName></e:Button>';
  const panel = skin(
    'MenuSkin',
    '<e:Group id="tiles" width="51" height="48" horizontalCenter="0">' +
      '<e:layout><e:TileLayout horizontalGap="5" verticalGap="3"/></e:layout>' +
      button('one', 'A') +
      button('two', 'B') +
      button('three', 'C') +
      '</e:Group>',
    'width="480" height="320"'
  );
  const { sdk, options } = setup(panel);
  let menu;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      new eui.Theme('resource/default.thm.json');
      class Menu extends eui.Component {}
      return (menu = new Menu());
    }
  });
  try {
    const positions = () => [menu.one, menu.two, menu.three].map(button => [button.x, button.y]);
    assert.equal(menu.tiles.x, 215);
    assert.deepEqual(positions(), [
      [0, 0],
      [27, 0],
      [0, 15]
    ]);
    assert.deepEqual(
      [menu.one.labelDisplay.text, menu.two.labelDisplay.text, menu.three.labelDisplay.text],
      ['A', 'B', 'C']
    );
    assert.equal(menu.labelDisplay, undefined);
    menu.tiles.width = 24;
    assert.deepEqual(positions(), [
      [0, 0],
      [0, 15],
      [0, 30]
    ]);
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

test('live bindings, state parts, a custom renderer and an ArrayCollection stay synchronized across detach and re-entry', async () => {
  const mainSkin = compileExml(
    '<e:Skin xmlns:e="' +
      ns +
      '" xmlns:g="game.*" class="MenuSkin" states="ready,detail" width="200" height="120">' +
      '<e:Label id="status" text="{model.title}" text.detail="{\'Detail: \' + hostComponent.model.title}"/>' +
      '<g:Badge id="badge" includeIn="detail" caption="{model.title}"/>' +
      '<e:List id="inventory" width="180" height="80" itemRenderer="game.Row" dataProvider="{items}">' +
      '<e:itemRendererSkinName><e:Skin height="24"><e:Label id="title" text="{data.name}"/></e:Skin></e:itemRendererSkinName>' +
      '</e:List></e:Skin>'
  );
  const { sdk, options, tap } = setup(mainSkin);
  const first = { name: 'Lantern' },
    second = { name: 'Tea' };
  let root,
    menu,
    api,
    hits = 0,
    changes = 0;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      api = eui;
      class Badge extends eui.Component {
        caption = '';
      }
      class Row extends eui.ItemRenderer {
        refreshes = 0;
        dataChanged() {
          this.refreshes++;
        }
      }
      class Menu extends eui.Component {
        model = { title: 'Stall' };
        items = new eui.ArrayCollection([first, second]);
      }
      eui.registerCustomComponent('game.Badge', Badge);
      eui.registerCustomComponent('game.Row', Row);
      new eui.Theme('resource/default.thm.json');
      root = new eui.UILayer();
      menu = new Menu();
      root.addChild(menu);
      return root;
    }
  });
  try {
    assert.deepEqual([menu.currentState, menu.status.text, menu.badge.parent == null], ['ready', 'Stall', true]);
    const original = menu.model;
    menu.currentState = 'detail';
    assert.deepEqual(
      [menu.status.text, menu.badge.caption, menu.getChildAt(1)],
      ['Detail: Stall', 'Stall', menu.badge]
    );
    menu.model = { title: 'River' };
    original.title = 'old';
    assert.deepEqual([menu.status.text, menu.badge.caption], ['Detail: River', 'River']);
    menu.currentState = 'ready';
    menu.model.title = 'Court';
    assert.deepEqual([menu.status.text, menu.badge.parent == null], ['Court', true]);
    const row = menu.inventory.getElementAt(1);
    assert.equal(row.title.text, 'Tea');
    assert.equal(row.y, 24);
    assert.ok(row.refreshes > 0);
    const itemTap = e => {
      hits++;
      assert.equal(e.item, second);
      assert.equal(e.itemRenderer, row);
    };
    menu.inventory.addEventListener(api.ItemTapEvent.ITEM_TAP, itemTap, menu);
    menu.inventory.addEventListener('change', () => changes++, menu);
    const block = event => event.preventDefault();
    menu.inventory.addEventListener('changing', block, menu);
    const click = () =>
      row.title.dispatchEvent(new engine.Event(tap, { globalX: 1, globalY: 30, session: { pointerId: 1 } }));
    click();
    assert.equal(menu.inventory.selectedIndex, -1);
    menu.inventory.removeEventListener('changing', block, menu);
    click();
    assert.deepEqual([menu.inventory.selectedIndex, hits, changes], [1, 2, 1]);
    menu.items.addItemAt({ name: 'Water' }, 0);
    assert.equal(menu.inventory.getElementAt(2), row);
    assert.deepEqual([row.itemIndex, menu.inventory.selectedIndex, row.y], [2, 2, 48]);
    second.name = 'Teapot';
    assert.equal(row.title.text, 'Teapot');
    const refreshes = row.refreshes;
    menu.items.itemUpdated(second);
    assert.equal(row.refreshes, refreshes + 1);
    root.removeChild(menu);
    assert.equal(Object.getOwnPropertyDescriptor(menu.model, 'title').get, undefined);
    const count = menu.inventory.numElements;
    menu.items.removeItemAt(0);
    assert.equal(menu.inventory.numElements, count);
    root.addChild(menu);
    assert.equal(menu.inventory.getElementAt(1), row);
    assert.equal(menu.inventory.selectedIndex, 1);
    menu.items.replaceItemAt({ name: 'Rice' }, 1);
    assert.equal(menu.inventory.getElementAt(1), row);
    assert.equal(row.title.text, 'Rice');
    assert.equal(menu.inventory.selectedIndex, 1);
    menu.inventory.requireSelection = true;
    assert.equal(menu.inventory.selectedIndex, 1);
    menu.items.removeAll();
    assert.equal(menu.inventory.numElements, 0);
    assert.equal(menu.inventory.selectedIndex, -1);
  } finally {
    await game.dispose();
  }
});

test('closing the host restores model descriptors, including a conditional part detached before shutdown', async () => {
  const panel = skin(
    'MenuSkin',
    '<e:Label id="mainLabel" text="{model.title}"/><e:Label id="more" includeIn="detail" text="{model.title}"/>',
    'states="ready,detail"'
  );
  const { sdk, options } = setup(panel);
  const model = { title: 'Open' };
  let menu;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      new eui.Theme('resource/default.thm.json');
      class Menu extends eui.Component {}
      menu = new Menu();
      menu.model = model;
      return menu;
    }
  });
  menu.currentState = 'detail';
  menu.currentState = 'ready';
  assert.equal(menu.more.parent == null, true);
  assert.equal(typeof Object.getOwnPropertyDescriptor(model, 'title').get, 'function');
  await game.dispose();
  assert.equal(Object.getOwnPropertyDescriptor(model, 'title').get, undefined);
  assert.equal(menu.more.isDisposed, true);
  model.title = 'Closed';
  assert.equal(model.title, 'Closed');
});

test('list selection follows the same duplicate occurrence across inserts and removals, preserving collection event contracts', async () => {
  const panel = skin(
    'MenuSkin',
    '<e:List id="list" width="80" height="60" dataProvider="{items}"><e:itemRendererSkinName><e:Skin height="20"/></e:itemRendererSkinName></e:List>'
  );
  const { sdk, options } = setup(panel);
  let menu, api;
  const source = ['duplicate', 'duplicate', 'tail'];
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      api = eui;
      new eui.Theme('resource/default.thm.json');
      class Menu extends eui.Component {}
      menu = new Menu();
      menu.items = new eui.ArrayCollection(source);
      return menu;
    }
  });
  try {
    menu.list.selectedIndex = 1;
    const selected = menu.list.getElementAt(1);
    menu.items.addItem('more');
    assert.equal(menu.list.selectedIndex, 1);
    menu.items.addItemAt('duplicate', 0);
    assert.equal(menu.list.selectedIndex, 2);
    assert.equal(menu.list.getElementAt(2), selected);
    menu.items.removeItemAt(0);
    assert.equal(menu.list.selectedIndex, 1);
    assert.equal(menu.list.getElementAt(1), selected);
    const seen = [];
    menu.items.addEventListener('collectionChange', e => seen.push([e.kind, e.items]), menu);
    menu.items.removeAll();
    assert.deepEqual(seen[0], [api.CollectionEventKind.REMOVE, source]);
    assert.equal(source.length, 4);
    menu.items.source = ['reset'];
    assert.equal(seen[1][0], api.CollectionEventKind.RESET);
  } finally {
    await game.dispose();
  }
});

test('removing a state constraint restores the basic layout position and root dimension overrides fail during conversion', async () => {
  assert.throws(() => skin('MenuSkin', '', 'width="100" width.b="200" states="a,b"'), {
    code: 'MIGRATE_EXML_UNSUPPORTED'
  });
  const { sdk, options } = setup(
    skin('MenuSkin', '<e:Rect id="marker" width="12" height="8" x="8" y="4" left.b="56" top.b="24"/>', 'states="a,b"')
  );
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
    const point = () => [menu.marker.x, menu.marker.y];
    assert.deepEqual(point(), [8, 4]);
    menu.currentState = 'b';
    assert.deepEqual(point(), [56, 24]);
    menu.currentState = 'a';
    assert.deepEqual(point(), [8, 4]);
  } finally {
    await game.dispose();
  }
});

test('a Scroller owns its vertical list viewport, follows the initiating contact and cancels the interaction on detach', async () => {
  const source = skin(
    'MenuSkin',
    '<e:Scroller id="scroller" x="10" y="20" width="120" height="50"><e:viewport><e:List id="list" width="77" height="90" x="5" y="8" dataProvider="{items}"><e:layout><e:VerticalLayout/></e:layout><e:itemRendererSkinName><e:Skin width="120" height="20"><e:Rect width="120" height="20"/></e:Skin></e:itemRendererSkinName></e:List></e:viewport></e:Scroller>',
    'width="240" height="140"'
  );
  const { sdk, options } = setup(source);
  const create = sdk.createBrowserGame;
  sdk.createBrowserGame = async opts => {
    const game = await create(opts);
    game.pointer = createPointerInput({ engine: game.engine, scope: game.scope, width: 480, height: 320 });
    return game;
  };
  let layer, menu;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      new eui.Theme('resource/default.thm.json');
      class Menu extends eui.Component {}
      menu = new Menu();
      menu.items = new eui.ArrayCollection([1, 2, 3, 4, 5]);
      layer = new eui.UILayer();
      layer.addChild(menu);
      return layer;
    }
  });
  try {
    const list = menu.list;
    assert.equal(menu.scroller.viewport, list);
    assert.deepEqual([list.x, list.y, list.width, list.height, list.contentHeight], [0, 0, 120, 50, 124]);
    assert.deepEqual(list.clipRect, { x: 0, y: 0, width: 120, height: 50 });
    const update = (y, t) => ({ globalX: 20, globalY: y, buttons: 1, timestamp: t });
    const contact = game.pointer.begin({ ...update(50, 0), pointerType: 'touch', pointerId: 1 });
    const second = game.pointer.begin({ ...update(46, 1), pointerType: 'touch', pointerId: 2 });
    game.pointer.move(second, update(30, 2));
    assert.equal(list.scrollV, 0);
    game.pointer.move(contact, update(30, 3));
    assert.equal(list.scrollV, 20);
    game.pointer.end(contact, { ...update(45, 4), buttons: 0 });
    assert.equal(list.selectedIndex, -1);
    game.pointer.cancel(second, 'pointercancel');
    const abandoned = game.pointer.begin({ ...update(50, 5), pointerType: 'touch', pointerId: 3 });
    layer.removeChild(menu);
    layer.addChild(menu);
    game.pointer.move(abandoned, update(24, 6));
    assert.equal(list.scrollV, 20);
    menu.scroller.viewport = null;
    assert.equal(list.scrollEnabled, false);
    assert.equal(list.clipRect, undefined);
    layer.addChild(list);
    assert.equal(list.scrollEnabled, false);
  } finally {
    await game.dispose();
  }
});

test('an admitted skin path completes on its component with parts ready before stage creation completes', async () => {
  const name = 'PathSkin';
  const { sdk, options } = setup(skin(name, '<e:List id="rows"/>'));
  const log = [];
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      class PathMenu extends eui.Component {
        constructor() {
          super();
          this.addEventListener(
            eui.UIEvent.COMPLETE,
            event => {
              assert.equal(event.target, this);
              assert.ok(this.rows instanceof eui.List);
              log.push('skin');
            },
            this
          );
          this.addEventListener(eui.UIEvent.CREATION_COMPLETE, () => log.push('stage'), this);
          this.skinName = 'resource/' + name + '.exml';
          assert.deepEqual(log, ['skin']);
        }
      }
      return new PathMenu();
    }
  });
  try {
    assert.deepEqual(log, ['skin', 'stage']);
  } finally {
    await game.dispose();
  }
});

for (const size of ['height="100%"', 'top="0" bottom="0"']) {
  test('initial virtual renderer allocation stays bounded with a responsive scroller ' + size, async () => {
    const row = skin('Rows', '<e:Rect width="32" height="20"/>', 'width="32" height="20"');
    const panel = skin(
      'MenuSkin',
      '<e:Scroller width="80" ' +
        size +
        '><e:List id="list" dataProvider="{items}" itemRenderer="StockRow"><e:layout><e:VerticalLayout gap="0"/></e:layout></e:List></e:Scroller>',
      'width="80" height="40"'
    );
    const { sdk, options } = setup(row, panel);
    let made = 0,
      menu;
    const game = await launchLegacyWeb(sdk, {
      ...options,
      createMain({ eui }) {
        class StockRow extends eui.ItemRenderer {
          constructor() {
            super();
            made++;
            this.skinName = 'Rows';
          }
        }
        eui.registerCustomComponent('StockRow', StockRow);
        new eui.Theme('resource/default.thm.json');
        class Menu extends eui.Component {}
        menu = new Menu();
        menu.items = new eui.ArrayCollection(Array.from({ length: 1000 }, (_, i) => i));
        return menu;
      }
    });
    try {
      assert.equal(menu.list.numElements, 1000);
      assert.equal(menu.list.numChildren, 2);
      assert.ok(made <= 3, 'Created ' + made + ' rows');
    } finally {
      await game.dispose();
    }
  });
}

test('fixed-height list renders the scrolling window and preserves offscreen selections and binding lifecycles', async () => {
  const panel = skin(
    'MenuSkin',
    '<e:Scroller id="scroll" width="100" height="54"><e:List id="list" dataProvider="{items}" itemRenderer="StockRow">' +
      '<e:layout><e:VerticalLayout gap="2" paddingTop="4" paddingBottom="3"/></e:layout>' +
      '</e:List></e:Scroller>'
  );
  const rowSkin = skin(
    'StockSkin',
    '<e:Label id="title" text="{data.name}" width="70" height="18"/>',
    'height="18" width="100"'
  );
  const { sdk, options } = setup(panel, rowSkin);
  const source = Array.from({ length: 1000 }, (_, i) => ({ name: 'item ' + i }));
  let menu,
    made = 0;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      class StockRow extends eui.ItemRenderer {
        constructor() {
          super();
          made++;
          this.skinName = 'StockSkin';
        }
      }
      eui.registerCustomComponent('StockRow', StockRow);
      new eui.Theme('resource/default.thm.json');
      class Menu extends eui.Component {}
      menu = new Menu();
      menu.items = new eui.ArrayCollection(source);
      return menu;
    }
  });
  const list = menu.list;
  try {
    assert.equal(list.numElements, 1000);
    assert.equal(list.contentHeight, 20005);
    assert.ok(made <= 4, 'first layout must not allocate the rest of the collection: ' + made);
    assert.equal(list.getElementAt(0).title.text, 'item 0');
    assert.equal(list.getElementAt(6), null);
    list.scrollV = 22; // The leading gap exposes no part of the first row.
    assert.equal(list.getElementAt(0), null);
    assert.equal(list.getElementAt(1).y, 2);
    list.selectedIndex = 701;
    assert.equal(list.selectedItem, source[701]);
    list.scrollV = 14018;
    const row = list.getElementAt(701);
    assert.equal(row.y, 6);
    assert.equal(row.selected, true);
    assert.equal(list.getElementIndex(row), 701);
    assert.equal(list.getElementAt(0), null);
    assert.equal(row.title.text, 'item 701');
    const item = row.data;
    list.scrollV = 0;
    assert.equal(list.getElementAt(701), null);
    assert.equal(list.selectedItem, item);
    menu.items.addItemAt({ name: 'inserted' }, 0);
    assert.equal(list.selectedIndex, 702);
    menu.items.removeItemAt(0);
    menu.items.replaceItemAt({ name: 'updated offscreen' }, 701);
    assert.equal(list.selectedItem.name, 'updated offscreen');
    list.scrollV = 14018;
    assert.equal(list.getElementAt(701).title.text, 'updated offscreen');
    list.getElementAt(701).data.name = 'bound on screen';
    assert.equal(list.getElementAt(701).title.text, 'bound on screen');
    list.scrollV = 999999;
    assert.equal(list.scrollV, 20005 - 54);
    assert.ok(list.getElementAt(999));
    assert.ok(made < 12, 'scrolling must reuse visible row instances');
    menu.items.source = [source[0]];
    assert.equal(list.scrollV, 0);
    assert.equal(list.getElementAt(0).itemIndex, 0);
    assert.equal(list.selectedIndex, -1);
  } finally {
    await game.dispose();
  }
  assert.equal(Object.getOwnPropertyDescriptor(source[0], 'name').get, undefined);
});

test('virtual and eager lists agree on overrides, resized viewports and unknown row heights', async () => {
  const menuSkin = skin(
    'MenuSkin',
    '<e:Scroller id="scroll" width="120" height="42"><e:List id="list" useVirtualLayout="true" dataProvider="{items}">' +
      '<e:layout><e:VerticalLayout gap="0"/></e:layout><e:itemRendererSkinName><e:Skin width="120" height="20"/></e:itemRendererSkinName>' +
      '</e:List></e:Scroller>'
  );
  const { sdk, options } = setup(menuSkin);
  let menu;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      new eui.Theme('resource/default.thm.json');
      class Menu extends eui.Component {}
      menu = new Menu();
      menu.items = new eui.ArrayCollection(Array.from({ length: 50 }, (_, i) => i));
      return menu;
    }
  });
  try {
    const list = menu.list;
    assert.equal(list.useVirtualLayout, true);
    assert.equal(list.numChildren, 3);
    const onDemand = list.getVirtualElementAt(17);
    assert.equal(onDemand.data, 17);
    assert.equal(onDemand.y, 340);
    assert.equal(list.getVirtualElementAt(17), onDemand);
    assert.equal(list.numChildren, 4);
    list.scrollV = 100;
    assert.equal(list.getElementAt(17), null);
    assert.equal(list.getElementAt(5).y, 0);
    menu.scroll.height = 80;
    assert.equal(list.numChildren, 4);
    list.useVirtualLayout = false;
    assert.equal(list.numChildren, 50);
    list.useVirtualLayout = true;
    assert.equal(list.numChildren, 4);
    // A live component can override the height declared in its skin after it has been mounted.
    list.getElementAt(5).height = 36;
    assert.equal(list.contentHeight, 1016);
    assert.equal(list.numChildren, 50);
    assert.equal(list.getElementAt(6).y, 36);
  } finally {
    await game.dispose();
  }
});

test('a scrolled renderer replacement releases old rows and measures a skin with no fixed height eagerly', async () => {
  const panel = skin(
    'MenuSkin',
    '<e:Scroller width="80" height="40"><e:List id="list" itemRenderer="SmallRow" dataProvider="{items}"/></e:Scroller>'
  );
  const fixed = skin('FixedSkin', '', 'height="20" width="80"');
  const varying = skin('MeasuredSkin', '<e:Rect id="box" width="50" height="10"/>', 'width="80"');
  const { sdk, options } = setup(panel, fixed, varying);
  let menu, MeasuredRow;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      class SmallRow extends eui.ItemRenderer {
        constructor() {
          super();
          this.skinName = 'FixedSkin';
        }
      }
      MeasuredRow = class extends eui.ItemRenderer {
        constructor() {
          super();
          this.skinName = 'MeasuredSkin';
        }
        dataChanged() {
          this.box.height = this.data.height;
        }
      };
      eui.registerCustomComponent('SmallRow', SmallRow);
      new eui.Theme('resource/default.thm.json');
      class Menu extends eui.Component {}
      menu = new Menu();
      menu.items = new eui.ArrayCollection(Array.from({ length: 12 }, (_, i) => ({ height: 10 + i })));
      return menu;
    }
  });
  try {
    const list = menu.list;
    list.scrollV = 80;
    const old = list.getElementAt(4);
    list.selectedIndex = 9;
    list.itemRenderer = MeasuredRow;
    assert.ok(old.isDisposed);
    assert.equal(list.numChildren, 12);
    assert.equal(list.numElements, 12);
    assert.equal(list.getElementAt(9).height, 19);
    assert.equal(list.contentHeight, 186);
    assert.equal(list.selectedIndex, 9);
  } finally {
    await game.dispose();
  }
});

test('reparenting an active viewport releases its scroll projection and wheel after a successful insertion', async () => {
  const { sdk, options } = setup();
  const wheel = engine.createEventType('wheel', { bubbles: true, cancelable: true });
  const create = sdk.createBrowserGame;
  sdk.createBrowserGame = async opts => {
    const game = await create(opts);
    game.hover = { events: { wheel } };
    return game;
  };
  let scroller, map, other, pin;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui, egret }) {
      const root = new eui.UILayer();
      scroller = new eui.Scroller();
      scroller.width = 100;
      scroller.height = 40;
      map = new eui.Group();
      map.width = 100;
      map.height = 40;
      pin = new eui.Rect(10, 10);
      pin.y = 100;
      map.addChild(pin);
      scroller.viewport = map;
      other = new egret.Sprite();
      root.addChild(scroller);
      root.addChild(other);
      return root;
    }
  });
  try {
    const spin = () => map.dispatchEvent(new engine.Event(wheel, { deltaY: 5, unit: 'pixel' }));
    for (const insert of [() => other.addChild(map), () => other.addChildAt(map, 0)]) {
      scroller.viewport = map;
      map.scrollV = 30;
      assert.equal(pin.localToGlobal(0, 0).y, 70);
      assert.throws(() => other.addChildAt(map, 99));
      assert.equal(scroller.viewport, map);
      spin();
      assert.equal(map.scrollV, 35);
      insert();
      assert.equal(scroller.viewport, undefined);
      assert.equal(map.scrollEnabled, false);
      assert.equal(map.clipRect, undefined);
      assert.equal(pin.localToGlobal(0, 0).y, 100);
      spin();
      assert.equal(map.scrollV, 35);
    }
  } finally {
    await game.dispose();
  }
});

test('a Scroller projects a positioned Group without changing child coordinates or content dimensions', async () => {
  const source = skin(
    'MapSkin',
    '<e:Scroller id="scroller" x="10" y="20" width="100" height="48"><e:viewport>' +
      '<e:Group id="map"><e:Rect id="origin" width="4" height="4"/><e:Rect id="pin" touchEnabled="true" x="8" y="110" width="18" height="14"/></e:Group>' +
      '</e:viewport></e:Scroller>'
  );
  const { sdk, options } = setup(source);
  let menu;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      menu = new eui.Component();
      menu.skinName = 'MapSkin';
      // Map selection screens set this offset after constructing the content and before attaching to the stage.
      menu.map.scrollV = 90;
      return menu;
    }
  });
  try {
    const map = menu.map;
    assert.equal(menu.scroller.viewport, map);
    assert.deepEqual([map.width, map.height, map.contentWidth, map.contentHeight], [100, 48, 26, 124]);
    assert.deepEqual([map.scrollV, menu.pin.y, menu.pin.localToGlobal(0, 0).y], [90, 110, 40]);
    assert.equal(map.anchorOffsetY, 0);
    map.invalidateDisplayList();
    assert.equal(map.contentHeight, 124);
    assert.equal(menu.origin.localToGlobal(0, 0).y, -70);
    assert.equal(game.stage.hitTest(20, 42), menu.pin);
    map.anchorOffsetY = 2;
    map.scrollV = 30;
    map.invalidateDisplayList();
    assert.equal(map.anchorOffsetY, 2);
    assert.equal(menu.pin.localToGlobal(0, 0).y, 100);
    assert.notEqual(game.stage.hitTest(20, 102), menu.pin);
    menu.scroller.viewport = null;
    assert.equal(map.scrollEnabled, false);
    assert.equal(map.clipRect, undefined);
    assert.equal(map.anchorOffsetY, 2);
    assert.equal(menu.pin.y, 110);
  } finally {
    await game.dispose();
  }
});

test('legacy EUI images prioritize nine-slice and keep clip mode at natural size; hidden text returns without a stale raster', async () => {
  const { sdk, options, trace } = setup();
  let image, words;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    async createMain({ eui, RES, egret }) {
      await RES.loadConfig('resource/default.res.json', 'resource/');
      await RES.loadGroup('all');
      const root = new egret.Sprite();
      image = new eui.Image(RES.getRes('icon'));
      image.width = 10;
      image.height = 6;
      image.fillMode = 'clip';
      image.scale9Grid = { x: 1, y: 0, width: 1, height: 1 };
      words = new egret.TextField();
      words.text = 'sleeping label';
      words.setLegacyRasterActive(false);
      root.addChild(image);
      root.addChild(words);
      return root;
    }
  });
  try {
    let panel = image.getChildAt(image.numChildren - 1);
    assert.ok(panel instanceof engine.NineSliceBitmap);
    const naturalWidth = image.texture.textureWidth;
    assert.deepEqual(panel.insets, { left: 1, right: naturalWidth - 2, top: 0, bottom: 1 });
    assert.deepEqual([panel.targetWidth, panel.targetHeight], [10, 6]);
    image.width = 12;
    assert.equal(image.getChildAt(image.numChildren - 1), panel);
    assert.equal(panel.targetWidth, 12);
    image.width = 0.5;
    assert.ok(panel.isDisposed);
    const bitmap = image.getChildAt(0);
    assert.deepEqual([bitmap.scaleX, bitmap.scaleY], [0.5 / naturalWidth, 3]);
    image.scale9Grid = null;
    assert.deepEqual([bitmap.scaleX, bitmap.scaleY], [1, 1]);
    assert.deepEqual(bitmap.clipRect, { x: 0, y: 0, width: 0.5, height: 2 });
    assert.ok(!trace.includes('sleeping label'));
    words.text = 'restored text';
    words.setLegacyRasterActive(true);
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(trace.includes('restored text'));
    words.setLegacyRasterActive(false);
    assert.equal(words.numChildren, 0);
  } finally {
    await game.dispose();
  }
});

test('a map viewport acquires only nearby single-line label rasters and releases them when scrolling or leaving', async () => {
  const labels = Array.from(
    { length: 48 },
    (_, i) => '<e:Label id="pin' + i + '" text="place ' + i + '" y="' + i * 40 + '" width="60" height="15" size="12"/>'
  ).join('');
  const source = skin(
    'MapSkin',
    '<e:Scroller width="80" height="60"><e:Group id="map">' + labels + '</e:Group></e:Scroller>'
  );
  const { sdk, options } = setup(source);
  const active = new Set(),
    created = [];
  const create = sdk.createBrowserGame;
  sdk.createBrowserGame = async opts => {
    const game = await create(opts);
    const make = game.createLabel;
    game.createLabel = opts => {
      created.push(opts.text);
      active.add(opts.text);
      opts.scope.use({
        dispose() {
          active.delete(opts.text);
        }
      });
      return make(opts);
    };
    return game;
  };
  let menu, layer;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      layer = new eui.UILayer();
      menu = new eui.Component();
      menu.skinName = 'MapSkin';
      layer.addChild(menu);
      return layer;
    }
  });
  try {
    assert.deepEqual([...active], ['place 0', 'place 1']);
    assert.equal(created.length, 2);
    menu.map.scrollV = 1800;
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual([...active], ['place 45', 'place 46']);
    assert.equal(menu.pin0.text, 'place 0');
    assert.equal(menu.map.numChildren, 48);
    // Legacy code moves controls directly; the next clock tick must see a label that entered the viewport.
    menu.pin0.y = 1820;
    game.engine.advanceTime(0);
    game.engine.advanceTime(0.016);
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(active.has('place 0'));
    menu.pin0.y = 0;
    menu.map.scrollV = 0;
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual([...active].sort(), ['place 0', 'place 1']);
    layer.removeChild(menu);
    assert.equal(active.size, 0);
    layer.addChild(menu);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual([...active], ['place 0', 'place 1']);
  } finally {
    await game.dispose();
  }
  assert.equal(active.size, 0);
});

test('read-only EUI labels wrap to a measured width and retain explicit newlines regardless of input multiline', async () => {
  const { sdk, options, trace } = setup();
  options.canvas.ownerDocument.createElement = () => ({
    getContext: () => ({
      measureText: value => ({ width: [...value].reduce((w, c) => w + (c === 'i' ? 4 : 10), 0) })
    })
  });
  let label;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      const root = new eui.UILayer();
      label = new eui.Label();
      label.width = 24;
      label.height = 100;
      label.size = 10;
      label.multiline = false;
      label.text = 'ii字字\n行';
      root.addChild(label);
      return root;
    }
  });
  try {
    assert.ok(['ii字', '字', '行'].every(row => trace.includes(row)));
    assert.equal(label.text, 'ii字字\n行');
    label.width = 100;
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(trace.includes('ii字字'));
    label.multiline = true;
    label.text = '新字';
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(label.numChildren, 1);
  } finally {
    await game.dispose();
  }
});

test('an explicit-height label always draws its first line and admits later line centers inside the box', async () => {
  const { sdk, options, trace } = setup();
  let label;
  const game = await launchLegacyWeb(sdk, {
    ...options,
    createMain({ eui }) {
      const root = new eui.UILayer();
      label = new eui.Label();
      label.size = 10;
      label.width = 40;
      label.height = 12;
      label.verticalAlign = 'bottom';
      label.text = 'A\nB\nC';
      root.addChild(label);
      return root;
    }
  });
  const positions = () => Array.from({ length: label.numChildren }, (_, i) => label.getChildAt(i).y);
  try {
    assert.deepEqual(positions(), [0]);
    assert.ok(!trace.includes('B') && !trace.includes('C'));
    label.height = 15;
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(positions(), [0, 10]);
    label.height = 40;
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(positions(), [10, 20, 30]);
    label.verticalAlign = 'top';
    label.height = 4;
    assert.deepEqual(positions(), [0]);
    assert.equal(label.text, 'A\nB\nC');
  } finally {
    await game.dispose();
  }
});

// Break caught: a project of fixedWidth or another fixed scale mode keeping the stage size it started with when the
// window changes, its EUI constraints laid out against the old size, or Event.RESIZE not told, as Egret 5 told it.
test('with a fixed scale mode the stage follows the screen, EUI lays its roots out again and RESIZE is told', async () => {
  const menuSkin = skin(
    'MenuSkin',
    '<e:Rect id="bar" left="0" right="0" bottom="0" height="40"/>' +
      '<e:Rect id="corner" right="10" top="10" width="20" height="20"/>' +
      '<e:Rect id="middle" width="40" height="40" horizontalCenter="0" verticalCenter="0"/>',
    'width="100%" height="100%"'
  );
  const { sdk, options } = setup(menuSkin);
  const make = sdk.createBrowserGame;
  const listeners = new Set();
  let plan = { width: 480, height: 320 },
    fit;
  sdk.createBrowserGame = async asked => {
    fit = asked.fit;
    const game = await make(asked);
    Object.defineProperty(game, 'screen', { get: () => plan });
    game.onScreenChange = listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    return game;
  };
  let root, menu, stage;
  const sizes = [];
  const game = await launchLegacyWeb(sdk, {
    ...options,
    fit: 'fixedWidth',
    createMain({ eui, egret }) {
      new eui.Theme('resource/default.thm.json');
      class Menu extends eui.Component {}
      root = new eui.UILayer();
      menu = new Menu();
      root.addChild(menu);
      root.addEventListener(
        egret.Event.ADDED_TO_STAGE,
        function () {
          stage = this.stage;
          stage.addEventListener(egret.Event.RESIZE, () => sizes.push([stage.stageWidth, stage.stageHeight]), null);
        },
        root
      );
      return root;
    }
  });
  try {
    assert.equal(fit, 'fixedWidth');
    assert.deepEqual([stage.stageWidth, stage.stageHeight, root.width, root.height], [480, 320, 480, 320]);
    assert.deepEqual(
      [menu.bar.y, menu.bar.width, menu.corner.x, menu.middle.x, menu.middle.y],
      [280, 480, 450, 220, 140]
    );
    // The window grows taller: with fixedWidth the stage keeps its width and takes the new height.
    plan = { width: 480, height: 400 };
    for (const listener of [...listeners]) listener(plan);
    assert.deepEqual([stage.stageWidth, stage.stageHeight, root.width, root.height], [480, 400, 480, 400]);
    assert.deepEqual([menu.bar.y, menu.bar.width, menu.corner.x, menu.middle.y], [360, 480, 450, 180]);
    assert.deepEqual(stage.hitArea, { x: 0, y: 0, width: 480, height: 400 });
    // A notice of the same size tells nothing again.
    for (const listener of [...listeners]) listener(plan);
    assert.deepEqual(sizes, [[480, 400]]);
  } finally {
    await game.dispose();
  }
  assert.equal(listeners.size, 0, 'the listener ends with the game');
});
