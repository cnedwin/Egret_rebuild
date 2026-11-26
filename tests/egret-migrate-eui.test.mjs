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
