// SPDX-License-Identifier: Apache-2.0
// A menu of actions for a row of a managed list. A roster of forty members is a list box with one
// selection. The menu of the selected member is a second managed root, shown as a popup layer
// anchored to its row. It opens from the right mouse button, from the Menu key or Shift+F10 on the
// focused row, from a button, and from a request of assistive technology, all through `openMenu`.
import { createEngineForProfile, DisplayObjectContainer, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createTextRasterCache, createTextField } from '@egret/engine/text';
import { createActionControl, createControlKeys, createHoverControl, createScrollControl, createUiLayerManager, createUiRoot } from '@egret/engine/ui';
import { createUiListSemantics, createUiSemantics } from '@egret/engine/ui/semantics';
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { createBrowserSemantics } from '@egret/engine/web/semantics';
import { createBrowserHoverInput } from '@egret/engine/web/hover';
import { createBrowserPointerInput } from '@egret/engine/web/pointer';
import { createBrowserKeyboardInput } from '@egret/engine/web/keyboard';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 320, FAMILY = 'Arial', ROW = 30, COUNT = 40, ITEM = 28, LIST = { x: 20, y: 44, width: 290, height: 240 }, TRACK = { x: 316, y: 44, width: 14, height: 240 }, MENU = 170;
const COLORS = { page: 0x161a22, panel: 0x1f2633, row: 0x2b2f3a, rowAlt: 0x343a48, rowHover: 0x454c5e, rowChosen: 0x2f8f6b, item: 0x3d4a63, itemHover: 0x56689a, itemPressed: 0x27314a, itemOff: 0x2a2d33,
  button: 0x3d4a63, buttonHover: 0x56689a, buttonPressed: 0x27314a, buttonOpen: 0x56689a, buttonOff: 0x2a2d33, ink: 0xf3e9d2, hint: 0x9aa7c4, ring: 0xf2c14e, track: 0x10141b, thumb: 0x56689a, thumbHeld: 0x9aa7c4 };
const HEROES = ['青锋', '白露', '玄霜', '赤霄', '紫电'];
const RANKS = ['outer', 'inner', 'core'], RANK_NAMES = { outer: '外门 Outer', inner: '内门 Inner', core: '真传 Core' };
const ACTIONS = ['promote', 'demote', 'rest'], ACTION_NAMES = { promote: '晋升 / Promote', demote: '降级 / Demote', rest: '休息 / Rest' };
const keyOf = index => 'm' + index, indexOf = key => Number(key.slice(1)), nameOf = index => '弟子 ' + (index + 1) + ' ' + HEROES[index % 5];
// The model: the rank of each member, who rests, who is selected, and how often each record changed.
const ranks = Array.from({ length: COUNT }, (_, index) => RANKS[index % 3]), resting = new Set(), versions = new Array(COUNT).fill(0);
const describe = index => RANK_NAMES[ranks[index]] + (resting.has(keyOf(index)) ? ' · 休息 Rest' : '');
/** Whether an action has anything to do for a member. One who is at the top cannot be promoted, and so on. */
const can = (action, key) => key !== undefined && (action === 'promote' ? ranks[indexOf(key)] !== 'core' : action === 'demote' ? ranks[indexOf(key)] !== 'outer' : true);

const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), stateView = document.querySelector('#state');
// The page's own menu would cover the one that is drawn.
canvas.addEventListener('contextmenu', event => event.preventDefault());
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
// The cache prepares four lines at a time at most, and a list binds its rows together, so text is prepared one line after another.
const cache = createTextRasterCache(engine.assets, { provider: createCanvasTextRasterProvider() });
let textQueue = Promise.resolve();
const inTurn = work => { const next = textQueue.then(work); textQueue = next.catch(() => {}); return next; };
let renders = 0, failure, selected, opened, registration, queued = false, busy = Promise.resolve(), layersReady = false, revision = 0, done = [];
const fail = cause => { failure = String(cause?.code ?? cause?.message ?? cause); };
/** Paints once after the callbacks that are running: a row reports its hover and its press from inside the input, and from inside a commit when it is recycled. */
const later = () => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; show(); }); };
const pointer = createBrowserPointerInput({ engine, scope, width: WIDTH, height: HEIGHT });
const hover = createBrowserHoverInput({ engine, scope, canvas, width: WIDTH, height: HEIGHT, onError: fail });
const keyboard = createBrowserKeyboardInput({ engine, scope, onFocusChange: () => queueMicrotask(show) });
const holds = id => keyboard.getSnapshot().focusedId === id;
const ringed = id => { const focus = keyboard.getSnapshot(); return focus.focusVisible && focus.focusedId === id; };

const page = engine.stage.addChild(scope.use(new Sprite())), bar = engine.stage.addChild(scope.use(new Sprite()));
bar.x = TRACK.x; bar.touchEnabled = true;
async function line(parent, x, y, fontSize, text, colour, owner = scope) {
  const field = createTextField(engine, owner, cache);
  field.x = x; field.y = y; parent.addChild(field);
  field.setRequest({ text, fontFamily: FAMILY, fontSize, fontWeight: 400, fontStyle: 'normal', lineHeight: Math.round(fontSize * 1.3), locale: 'zh-CN', direction: 'ltr', density: 2, fillColor: colour });
  await inTurn(() => field.prepare());
}
/** The bindings of a root by key and generation, from the bind until the commit that shows or drops them. */
function bindings() {
  const pending = new Map(), realized = new Map();
  return { pending, realized,
    unbind({ key, bindingGeneration }) {
      const id = key + ':' + bindingGeneration;
      pending.get(id)?.dispose(); pending.delete(id);
      if (realized.get(key)?.id === id) { realized.get(key).dispose(); realized.delete(key); }
    },
    adopt(owner) {
      const rows = new Map(owner.snapshot().rows.map(row => [row.key + ':' + row.bindingGeneration, row.key]));
      for (const [id, entry] of pending) if (rows.has(id)) {
        const key = rows.get(id), old = realized.get(key);
        if (old !== undefined && old.id !== id) old.dispose();
        realized.set(key, { id, ...entry }); pending.delete(id);
      }
    } };
}

// The roster. A press selects a member; the right button selects it and opens its menu.
const members = bindings();
function rosterSource() {
  return { revision,
    records: versions.map((version, index) => ({ key: keyOf(index), contentVersion: version, estimatedHeight: ROW, value: index })),
    async bind(context) {
      const { key, index, width } = context, content = context.scope.use(new DisplayObjectContainer()), back = content.addChild(context.scope.use(new Sprite()));
      await line(content, 10, 6, 14, nameOf(index), COLORS.ink, context.scope);
      await line(content, 130, 6, 14, describe(index), COLORS.hint, context.scope);
      const pointed = createHoverControl({ hover, target: context.target, onHoverChange: later });
      const paint = () => {
        const focus = list.getFocus(), focused = focus.focusVisible && focus.key === key && opened === undefined;
        back.graphics.clear();
        if (focused) back.graphics.beginFill(COLORS.ring).drawRect(0, 0, width, ROW - 2).endFill();
        back.graphics.beginFill(key === selected ? COLORS.rowChosen : pointed.hovered ? COLORS.rowHover : index % 2 ? COLORS.rowAlt : COLORS.row).drawRect(focused ? 2 : 0, focused ? 2 : 0, width - (focused ? 4 : 0), ROW - 2 - (focused ? 4 : 0)).endFill();
      };
      // Space or Enter selects the row. The Menu key, or Shift with F10, opens its menu, as they open the menu of a platform.
      const bound = createControlKeys({ keyboard, target: content, kind: 'action', control: { enabled: true, press() {}, release() { select(key); } } });
      const moves = { ArrowDown: index + 1, ArrowUp: index - 1, PageDown: index + 7, PageUp: index - 7, Home: 0, End: COUNT - 1 };
      const stop = content.on(keyboard.events.keyDown, event => {
        const { code, shiftKey, ctrlKey, metaKey, altKey } = event.payload;
        if (event.defaultPrevented || ctrlKey || metaKey || altKey) return;
        if (code === 'ContextMenu' || (shiftKey && code === 'F10')) { event.preventDefault(); void openMenu(key); return; }
        if (shiftKey || !Object.hasOwn(moves, code)) return;
        event.preventDefault(); void go(Math.min(COUNT - 1, Math.max(0, moves[code])));
      });
      paint();
      members.pending.set(key + ':' + context.bindingGeneration, { paint, hovered: () => pointed.hovered, dispose() { stop(); bound.dispose(); pointed.dispose(); } });
      return { content, measuredHeight: ROW };
    },
    unbind: members.unbind };
}
const root = createUiRoot({
  engine, scope, id: 'roster', viewport: { width: LIST.width, height: LIST.height }, origin: { x: LIST.x, y: LIST.y }, density: 1, input: pointer,
  tree: { id: 'members', kind: 'virtualList', source: rosterSource(), explicitWidth: LIST.width, explicitHeight: LIST.height },
  keyboard: { input: keyboard, idPrefix: 'roster', tabStop: 1 }, limits: { overscan: 1, residentCap: 24 },
  // The notification of a row carries the contact, and the contact says which buttons are down: two is the secondary one.
  onRowPointer(notification) {
    if (notification.kind !== 'begin') return;
    if ((notification.event.payload.buttons & 2) !== 0) void openMenu(notification.key); else select(notification.key);
  },
});
const list = root.list('members');
function select(key) { selected = key; show(); }

// The menu: a second root with three rows, shown by the layer manager and anchored to the row it was opened for.
const items = bindings();
const menu = createUiRoot({
  engine, scope, id: 'menu', viewport: { width: MENU, height: ACTIONS.length * ITEM }, density: 1, input: pointer, keyboard: { input: keyboard, idPrefix: 'menu' },
  tree: { id: 'actions', kind: 'virtualList', explicitWidth: MENU, explicitHeight: ACTIONS.length * ITEM, source: { revision: 0,
    records: ACTIONS.map(action => ({ key: action, contentVersion: 0, estimatedHeight: ITEM, value: action })),
    async bind(context) {
      const { key, index, width } = context, content = context.scope.use(new DisplayObjectContainer()), back = content.addChild(context.scope.use(new Sprite()));
      await line(content, 10, 5, 14, ACTION_NAMES[key], COLORS.ink, context.scope);
      const pointed = createHoverControl({ hover, target: context.target, onHoverChange: later });
      const held = createActionControl({ input: pointer, target: context.target, onActivate: () => { void act(key); }, onPressChange: later });
      const paint = () => {
        const focus = actions.getFocus(), focused = focus.focusVisible && focus.key === key, on = can(key, opened);
        back.graphics.clear();
        if (focused) back.graphics.beginFill(COLORS.ring).drawRect(0, 0, width, ITEM).endFill();
        back.graphics.beginFill(!on ? COLORS.itemOff : held.pressed ? COLORS.itemPressed : pointed.hovered ? COLORS.itemHover : COLORS.item).drawRect(focused ? 2 : 0, focused ? 2 : 0, width - (focused ? 4 : 0), ITEM - (focused ? 4 : 0)).endFill();
      };
      // An item that has nothing to do keeps its keys and does nothing with them, so that they do not reach the page.
      const bound = createControlKeys({ keyboard, target: content, kind: 'action', control: { enabled: true, press() {}, release() { void act(key); } } });
      const moves = { ArrowDown: (index + 1) % ACTIONS.length, ArrowUp: (index + ACTIONS.length - 1) % ACTIONS.length, Home: 0, End: ACTIONS.length - 1 };
      const stop = content.on(keyboard.events.keyDown, event => {
        if (event.defaultPrevented || !Object.hasOwn(moves, event.payload.code)) return;
        event.preventDefault(); actions.focus(ACTIONS[moves[event.payload.code]], { visible: true }); show();
      });
      paint();
      items.pending.set(key + ':' + context.bindingGeneration, { paint, hovered: () => pointed.hovered, dispose() { stop(); bound.dispose(); held.dispose(); pointed.dispose(); } });
      return { content, measuredHeight: ITEM };
    },
    unbind: items.unbind } },
});
const actions = menu.list('actions');
const layers = createUiLayerManager({ engine, scope, input: pointer, keyboard, viewport: { x: 0, y: 0, width: WIDTH, height: HEIGHT }, onInvalidate: () => { void publish(); } });
const menuOpen = () => layers.snapshot().openStack.includes('menu');

const barHover = createHoverControl({ hover, target: bar, onHoverChange: later });
const scroll = createScrollControl({ viewportLength: LIST.height, contentLength: COUNT * ROW, wheel: { hover, target: engine.stage, lineLength: ROW },
  thumb: { input: pointer, target: bar, trackLength: TRACK.height, minimumLength: 24 }, onDragChange: later,
  onScroll(offset) { if (offset !== list.snapshot().scrollOffset) { list.setScrollOffset(offset); void publish(); } } });

// The button that opens the menu of the selected member, for a finger and for anyone who does not use the right button.
const BUTTON = { x: 346, y: 84, width: 114, height: 30 };
const buttonRing = engine.stage.addChild(scope.use(new Sprite())), buttonFace = engine.stage.addChild(scope.use(new Sprite()));
buttonRing.x = BUTTON.x - 3; buttonRing.y = BUTTON.y - 3; buttonFace.x = BUTTON.x; buttonFace.y = BUTTON.y; buttonFace.touchEnabled = true; buttonFace.hitArea = { x: 0, y: 0, width: BUTTON.width, height: BUTTON.height };
const buttonHover = createHoverControl({ hover, target: buttonFace, onHoverChange: later });
const button = createActionControl({ input: pointer, target: buttonFace, onActivate: () => { void openMenu(selected); }, onPressChange: later });
// Until a member is selected the button has nothing to open, and is no stop of the keyboard.
const buttonStop = keyboard.registerTarget({ id: 'open', target: buttonFace, tabIndex: 2, disabled: true });
const buttonKeys = createControlKeys({ keyboard, target: buttonFace, kind: 'action', control: button, onPressChange: later });

// What the screen is to someone who does not see it.
const semantics = createUiSemantics();
const rosterNodes = createUiListSemantics({ semantics, root, list: 'members', id: 'roster', role: 'listbox', name: '名册 / Roster', focusable: true,
  describeRow: (key, index) => ({ name: nameOf(index) + '，' + describe(index), selected: key === selected }), onActivateRow: select });
semantics.add({ id: 'roster-scroll', role: 'scrollbar', describe: () => ({ name: '名册滚动 / Roster scroll', bounds: TRACK, controls: 'roster', range: { now: Math.round(scroll.offset), min: 0, max: scroll.maximum } }) });
// The button says whether what it opens is open.
semantics.add({ id: 'open', role: 'button', onActivate: () => { button.press(); button.release(); }, onFocus: () => keyboard.focus('open', { visible: true }),
  describe: () => ({ name: '操作 / Actions', bounds: BUTTON, expanded: menuOpen(), disabled: !button.enabled, focused: holds('open') }) });
const menuNodes = createUiListSemantics({ semantics, root: menu, list: 'actions', id: 'menu', role: 'menu', name: '操作 / Actions', focusable: true, hidden: () => !menuOpen(),
  describeRow: key => ({ name: ACTION_NAMES[key], disabled: !can(key, opened) }), onActivateRow: key => { void act(key); } });
const projection = createBrowserSemantics({ semantics, canvas, width: WIDTH, height: HEIGHT, label: 'Roster / 名册', onError: fail });

/** Commits what was asked of both roots, then the layers. One at a time. */
function publish() {
  const settle = async owner => {
    for (let round = 0; round < 8; round++) {
      const preparation = await owner.prepare();
      if (preparation.status === 'pending') continue;
      owner.commit(preparation); return;
    }
    throw new Error('The layout did not settle');
  };
  const run = async () => {
    await settle(root); await settle(menu);
    members.adopt(root); items.adopt(menu);
    if (layersReady) layers.sync();
    // A menu that was dismissed, or whose row is gone, is closed by the layers.
    if (opened !== undefined && !menuOpen()) opened = undefined;
    scroll.scrollTo(list.snapshot().scrollOffset);
    hover.sync();
  };
  busy = busy.then(run).then(show, cause => { fail(cause); show(); });
  return busy;
}
/** Opens the menu of a member: the member is selected, its row is brought into view, and the menu is anchored to it. */
function openMenu(key) {
  if (key === undefined) return busy;
  selected = key;
  // The layers are changed after the commits that are under way, and never inside a routed callback.
  return (busy = busy.then(async () => {
    if (menuOpen()) layers.close('menu');
    if (!root.snapshot().rows.some(row => row.key === key && row.visible)) list.reveal(key, { align: 'nearest' });
  }).catch(fail)).then(publish).then(() => (busy = busy.then(() => {
    registration?.dispose();
    registration = layers.register({ id: 'menu', root: menu, kind: 'popup', closeOnEscape: true,
      anchor: { root, target: { kind: 'row', listId: 'members', key }, gap: 0, align: 'end' }, initialFocus: { listId: 'actions', key: ACTIONS.find(action => can(action, key)) } });
    opened = key; layers.open('menu');
  }).catch(fail))).then(publish);
}
/** One action for the member whose menu is open. The row is bound again with what it changed, and the menu closes. */
function act(action) {
  return (busy = busy.then(() => {
    if (opened === undefined || !menuOpen() || !can(action, opened)) return;
    const index = indexOf(opened);
    if (action === 'rest') { if (!resting.delete(opened)) resting.add(opened); }
    else ranks[index] = RANKS[RANKS.indexOf(ranks[index]) + (action === 'promote' ? 1 : -1)];
    done.push(action + ' ' + opened); versions[index]++; revision++; list.setSource(rosterSource());
    layers.close('menu');
  }).catch(fail)).then(publish);
}
async function go(index) {
  list.reveal(keyOf(index), { align: 'nearest' });
  await publish();
  if (root.snapshot().rows.some(row => row.key === keyOf(index) && row.visible)) list.focus(keyOf(index), { visible: true });
  show();
}

/** What a check reads: plain values only. */
export function readSnapshot() {
  const ui = root.snapshot(), focus = keyboard.getSnapshot(), layer = layers.snapshot().layers.find(entry => entry.id === 'menu'), place = menu.snapshot();
  return {
    ranks: [...ranks], resting: [...resting], selected, opened, open: menuOpen(), done: [...done], offset: list.snapshot().scrollOffset,
    focus: focus.focusedId, focusVisible: focus.focusVisible, row: list.getFocus().key, item: actions.getFocus().key, buttonEnabled: button.enabled,
    rows: ui.rows.filter(row => row.visible).map(row => ({ key: row.key, index: row.index, x: LIST.x + row.box.x, y: LIST.y + row.box.y, width: row.box.width, height: row.box.height })),
    menu: layer === undefined || !layer.visible ? undefined : { x: place.origin.x, y: place.origin.y, width: MENU, height: ACTIONS.length * ITEM },
    renders, failure, semantics: { focused: semantics.snapshot.focused, nodes: semantics.snapshot.nodes.length, projection: projection.state },
  };
}
function show() {
  if (scope.state !== 'open') return;
  // A key may be what selected the member, and the stops of the keyboard are not changed from inside a key: that waits until it is over.
  if (button.enabled !== (selected !== undefined)) { button.setEnabled(selected !== undefined); queueMicrotask(() => { if (scope.state === 'open') buttonStop.update({ disabled: !button.enabled }); }); }
  page.graphics.clear(); page.graphics.beginFill(COLORS.page).drawRect(0, 0, WIDTH, HEIGHT).beginFill(COLORS.panel).drawRect(LIST.x - 4, LIST.y - 4, LIST.width + 28, LIST.height + 8)
    .beginFill(COLORS.track).drawRect(TRACK.x, TRACK.y, TRACK.width, TRACK.height).endFill();
  const { start, length } = scroll.thumb;
  bar.y = TRACK.y + start; bar.hitArea = { x: 0, y: 0, width: TRACK.width, height: length };
  bar.graphics.clear(); bar.graphics.beginFill(scroll.dragging ? COLORS.thumbHeld : barHover.hovered ? COLORS.buttonHover : COLORS.thumb).drawRect(0, 0, TRACK.width, length).endFill();
  buttonRing.visible = ringed('open'); buttonRing.graphics.clear(); buttonRing.graphics.beginFill(COLORS.ring).drawRect(0, 0, BUTTON.width + 6, BUTTON.height + 6).endFill();
  const face = !button.enabled ? COLORS.buttonOff : button.pressed || buttonKeys.pressed ? COLORS.buttonPressed : menuOpen() ? COLORS.buttonOpen : buttonHover.hovered ? COLORS.buttonHover : COLORS.button;
  buttonFace.graphics.clear(); buttonFace.graphics.beginFill(face).drawRect(0, 0, BUTTON.width, BUTTON.height).endFill();
  for (const row of members.realized.values()) row.paint();
  for (const row of items.realized.values()) row.paint();
  try { rosterNodes.sync(); menuNodes.sync(); semantics.publish(layersReady ? layers.snapshot().committedRevision : undefined); } catch (cause) { fail(cause); }
  status.textContent = failure ? 'Failed / 失败：' + failure : selected === undefined ? '未选中 / nobody selected' : nameOf(indexOf(selected)) + ' · ' + describe(indexOf(selected)) + (opened === undefined ? '' : ' …');
  stateView.textContent = JSON.stringify({ ...readSnapshot(), ranks: undefined }, null, 2);
  engine.renderSharedFrame(drawn); renders++;
}
const drawn = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x000000, clearAlpha: 1 });
globalThis.__egretUiContextMenuExample = { readSnapshot, settled: () => busy };
await line(engine.stage, 20, 10, 18, '名册 / Roster', COLORS.ink);
await line(engine.stage, BUTTON.x + 12, BUTTON.y + 6, 14, '操作 / Actions', COLORS.ink);
await publish();
layers.register({ id: 'roster', root, kind: 'base' });
// The menu is a layer from the start, closed. A root that is no layer is drawn where it stands and takes the keyboard like any other.
registration = layers.register({ id: 'menu', root: menu, kind: 'popup', closeOnEscape: true });
layersReady = true;
await publish();
