// SPDX-License-Identifier: Apache-2.0
// A tree that opens and closes. A sect has four halls, a hall two squads and a squad five members.
// What shows is a managed list of the items whose every ancestor is open, so there are rows only
// for what shows. A press opens or closes a hall or a squad and selects what is pressed; the arrow
// keys move through the items and in and out of them. The semantic tree says the same as a tree:
// the list helper publishes each row that shows as an item at its depth, and the title is a heading.
import { createEngineForProfile, DisplayObjectContainer, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createTextRasterCache, createTextField } from '@egret/engine/text';
import { createActionControl, createControlKeys, createHoverControl, createScrollControl, createUiRoot } from '@egret/engine/ui';
import { createUiListSemantics, createUiSemantics } from '@egret/engine/ui/semantics';
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { createBrowserSemantics } from '@egret/engine/web/semantics';
import { createBrowserHoverInput } from '@egret/engine/web/hover';
import { createBrowserPointerInput } from '@egret/engine/web/pointer';
import { createBrowserKeyboardInput } from '@egret/engine/web/keyboard';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 320, FAMILY = 'Arial', ROW = 30, INDENT = 22, LIST = { x: 20, y: 44, width: 420, height: 240 }, TRACK = { x: 446, y: 44, width: 14, height: 240 };
const COLORS = { page: 0x161a22, panel: 0x1f2633, row: 0x2b2f3a, rowHover: 0x454c5e, rowChosen: 0x2f8f6b, mark: 0xf3e9d2, ink: 0xf3e9d2, hint: 0x9aa7c4, ring: 0xf2c14e, track: 0x10141b, thumb: 0x56689a, thumbHover: 0x7a8cc0, thumbHeld: 0x9aa7c4 };
const HALLS = [['丹房', 'Alchemy'], ['器坊', 'Forge'], ['藏经阁', 'Library'], ['演武场', 'Yard']], SQUADS = [['甲队', 'First squad'], ['乙队', 'Second squad']], HEROES = ['青锋', '白露', '玄霜', '赤霄', '紫电'];
// The sect, as it is whether or not it shows: every item with its name, its depth, the item it is under, and the items under it.
const items = new Map();
function item(key, name, parent) { items.set(key, { key, name, parent, level: parent === undefined ? 1 : items.get(parent).level + 1, children: [] }); if (parent !== undefined) items.get(parent).children.push(key); }
for (const [hall, [zh, en]] of HALLS.entries()) {
  item('h' + hall, zh + ' / ' + en, undefined);
  for (const [squad, [squadZh, squadEn]] of SQUADS.entries()) {
    item('h' + hall + 's' + squad, squadZh + ' / ' + squadEn, 'h' + hall);
    for (let at = 0; at < 5; at++) { const number = hall * 10 + squad * 5 + at; item('m' + number, '弟子 ' + (number + 1) + ' ' + HEROES[number % 5], 'h' + hall + 's' + squad); }
  }
}
const TOP = HALLS.map((_, hall) => 'h' + hall), siblings = key => items.get(key).parent === undefined ? TOP : items.get(items.get(key).parent).children;
// The model: which items are open, and which one is selected.
const open = new Set(['h0', 'h0s0']);
let selected, revision = 0;
/** The items that show, from the top: an item, and what is under it when it is open. */
function showing(keys = TOP, into = []) { for (const key of keys) { into.push(key); if (open.has(key)) showing(items.get(key).children, into); } return into; }
let order = showing();

const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), stateView = document.querySelector('#state');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
// The cache prepares four lines at a time at most, and a list binds its rows together, so text is prepared one line after another.
const cache = createTextRasterCache(engine.assets, { provider: createCanvasTextRasterProvider() });
let textQueue = Promise.resolve();
const inTurn = work => { const next = textQueue.then(work); textQueue = next.catch(() => {}); return next; };
let renders = 0, failure, queued = false, busy = Promise.resolve();
const fail = cause => { failure = String(cause?.code ?? cause?.message ?? cause); };
/** Paints once after the callbacks that are running: a row reports its hover from inside the input, and from inside a commit when it is recycled. */
const later = () => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; show(); }); };
const pointer = createBrowserPointerInput({ engine, scope, width: WIDTH, height: HEIGHT });
const hover = createBrowserHoverInput({ engine, scope, canvas, width: WIDTH, height: HEIGHT, onError: fail });
const keyboard = createBrowserKeyboardInput({ engine, scope, onFocusChange: () => queueMicrotask(show) });

const page = engine.stage.addChild(scope.use(new Sprite())), bar = engine.stage.addChild(scope.use(new Sprite()));
bar.x = TRACK.x; bar.touchEnabled = true;
async function line(parent, x, y, fontSize, text, colour, owner = scope) {
  const field = createTextField(engine, owner, cache);
  field.x = x; field.y = y; parent.addChild(field);
  field.setRequest({ text, fontFamily: FAMILY, fontSize, fontWeight: 400, fontStyle: 'normal', lineHeight: Math.round(fontSize * 1.3), locale: 'zh-CN', direction: 'ltr', density: 2, fillColor: colour });
  await inTurn(() => field.prepare());
}

// The rows. A row is bound once for its item: whether the item is open is painted, not bound.
const pending = new Map(), realized = new Map();
function source() {
  return { revision,
    records: order.map(key => ({ key, contentVersion: 0, estimatedHeight: ROW, value: key })),
    async bind(context) {
      const { key, width } = context, { name, level, children } = items.get(key), left = (level - 1) * INDENT, content = context.scope.use(new DisplayObjectContainer()), back = content.addChild(context.scope.use(new Sprite()));
      await line(content, left + 30, 6, 14, name, children.length > 0 ? COLORS.ink : COLORS.hint, context.scope);
      const pointed = createHoverControl({ hover, target: context.target, onHoverChange: later });
      const held = createActionControl({ input: pointer, target: context.target, onActivate: () => { void press(key); } });
      const paint = () => {
        const focus = list.getFocus(), focused = focus.focusVisible && focus.key === key;
        back.graphics.clear();
        if (focused) back.graphics.beginFill(COLORS.ring).drawRect(0, 0, width, ROW - 2).endFill();
        back.graphics.beginFill(key === selected ? COLORS.rowChosen : pointed.hovered ? COLORS.rowHover : COLORS.row).drawRect(focused ? 2 : 0, focused ? 2 : 0, width - (focused ? 4 : 0), ROW - 2 - (focused ? 4 : 0)).endFill();
        // An item with items under it carries a mark: a bar while it is open, a cross while it is closed.
        if (children.length > 0) { back.graphics.beginFill(COLORS.mark).drawRect(left + 10, 13, 12, 2); if (!open.has(key)) back.graphics.drawRect(left + 15, 8, 2, 12); back.graphics.endFill(); }
      };
      // Space or Enter selects the item that holds the focus.
      const bound = createControlKeys({ keyboard, target: content, kind: 'action', control: { enabled: true, press() {}, release() { select(key); } } });
      const stop = content.on(keyboard.events.keyDown, event => {
        const { code, shiftKey, ctrlKey, metaKey, altKey } = event.payload;
        if (event.defaultPrevented || shiftKey || ctrlKey || metaKey || altKey) return;
        const at = order.indexOf(key), moves = { ArrowDown: at + 1, ArrowUp: at - 1, PageDown: at + 7, PageUp: at - 7, Home: 0, End: order.length - 1 };
        if (Object.hasOwn(moves, code)) { event.preventDefault(); void go(order[Math.min(order.length - 1, Math.max(0, moves[code]))]); return; }
        if (code !== 'ArrowRight' && code !== 'ArrowLeft') return;
        // Right opens an item that is closed and goes into one that is open. Left closes an item that is open and goes out of any other.
        event.preventDefault();
        const { parent } = items.get(key), branch = children.length > 0;
        if (code === 'ArrowRight') { if (branch && !open.has(key)) void toggle(key); else if (branch) void go(children[0]); }
        else if (branch && open.has(key)) void toggle(key); else if (parent !== undefined) void go(parent);
      });
      paint();
      pending.set(key + ':' + context.bindingGeneration, { paint, dispose() { stop(); bound.dispose(); held.dispose(); pointed.dispose(); } });
      return { content, measuredHeight: ROW };
    },
    unbind({ key, bindingGeneration }) {
      const id = key + ':' + bindingGeneration;
      pending.get(id)?.dispose(); pending.delete(id);
      if (realized.get(key)?.id === id) { realized.get(key).dispose(); realized.delete(key); }
    } };
}
const root = createUiRoot({
  engine, scope, id: 'sect', viewport: { width: LIST.width, height: LIST.height }, origin: { x: LIST.x, y: LIST.y }, density: 1, input: pointer,
  tree: { id: 'items', kind: 'virtualList', source: source(), explicitWidth: LIST.width, explicitHeight: LIST.height },
  keyboard: { input: keyboard, idPrefix: 'sect', tabStop: 1 }, limits: { overscan: 1, residentCap: 24 },
});
const list = root.list('items');
function select(key) { selected = key; show(); }
/** A press selects what is pressed, and opens or closes it when it has items under it. */
function press(key) { selected = key; return items.get(key).children.length > 0 ? toggle(key) : (show(), busy); }
/**
 * Opens or closes an item. The list is given the items that show now; it keeps the row at its top in view. An item
 * that closes over the focus takes the focus itself, as the row that held it is gone.
 */
function toggle(key) {
  const focused = list.getFocus(), inside = focused.key !== undefined && focused.key !== key && order.includes(focused.key) && under(focused.key, key);
  if (!open.delete(key)) open.add(key);
  order = showing(); revision++; list.setSource(source());
  return inside ? go(key, focused.focusVisible) : publish();
}
const under = (key, ancestor) => { for (let at = items.get(key).parent; at !== undefined; at = items.get(at).parent) if (at === ancestor) return true; return false; };

const barHover = createHoverControl({ hover, target: bar, onHoverChange: later });
const scroll = createScrollControl({ viewportLength: LIST.height, contentLength: order.length * ROW, wheel: { hover, target: engine.stage, lineLength: ROW },
  thumb: { input: pointer, target: bar, trackLength: TRACK.height, minimumLength: 24 }, onDragChange: later,
  onScroll(offset) { if (offset !== list.snapshot().scrollOffset) { list.setScrollOffset(offset); void publish(); } } });

// What the screen is to someone who does not see it: a heading, and a tree whose items say how deep they are and whether they are open.
const semantics = createUiSemantics();
semantics.add({ id: 'title', role: 'heading', describe: () => ({ name: '门派 / Sect', level: 1, bounds: { x: 20, y: 10, width: 200, height: 24 } }) });
const rows = createUiListSemantics({ semantics, root, list: 'items', id: 'org', role: 'tree', name: '门派 / Sect', focusable: true,
  describeRow(key) {
    const { name, level, children } = items.get(key), among = siblings(key);
    // Where an item stands is among the items under the same item, not among the rows of the list.
    return { name, level, selected: key === selected, position: { index: among.indexOf(key) + 1, size: among.length }, ...(children.length > 0 ? { expanded: open.has(key) } : {}) };
  },
  onActivateRow: key => { void press(key); } });
semantics.add({ id: 'org-scroll', role: 'scrollbar', describe: () => ({ name: '门派滚动 / Sect scroll', bounds: TRACK, controls: 'org', range: { now: Math.round(scroll.offset), min: 0, max: scroll.maximum } }) });
const projection = createBrowserSemantics({ semantics, canvas, width: WIDTH, height: HEIGHT, label: 'Sect / 门派', onError: fail });

/** Commits what was asked of the root. One at a time. */
function publish() {
  const run = async () => {
    for (let round = 0; ; round++) {
      if (round === 8) throw new Error('The layout did not settle');
      const preparation = await root.prepare();
      if (preparation.status === 'pending') continue;
      root.commit(preparation); break;
    }
    const shown = new Map(root.snapshot().rows.map(row => [row.key + ':' + row.bindingGeneration, row.key]));
    for (const [id, entry] of pending) if (shown.has(id)) {
      const key = shown.get(id), old = realized.get(key);
      if (old !== undefined && old.id !== id) old.dispose();
      realized.set(key, { id, ...entry }); pending.delete(id);
    }
    // The tree is as long as what shows, and the list may have moved to keep its place.
    scroll.setLengths(LIST.height, order.length * ROW); scroll.scrollTo(list.snapshot().scrollOffset);
    // A pointer that rests while the rows move under it sends nothing: the input picks again where it is.
    hover.sync();
  };
  busy = busy.then(run).then(show, cause => { fail(cause); show(); });
  return busy;
}
async function go(key, visible = true) {
  list.reveal(key, { align: 'nearest' });
  await publish();
  if (root.snapshot().rows.some(row => row.key === key && row.visible)) list.focus(key, { visible });
  show();
}

/** What a check reads: plain values only. */
export function readSnapshot() {
  const ui = root.snapshot(), focus = keyboard.getSnapshot();
  return { open: [...open].sort(), order: [...order], selected, offset: list.snapshot().scrollOffset, focus: focus.focusedId, focusVisible: focus.focusVisible, row: list.getFocus().key,
    rows: ui.rows.filter(row => row.visible).map(row => ({ key: row.key, index: row.index, y: LIST.y + row.box.y, height: row.box.height })),
    renders, failure, semantics: { focused: semantics.snapshot.focused, nodes: semantics.snapshot.nodes.length, projection: projection.state } };
}
function show() {
  if (scope.state !== 'open') return;
  page.graphics.clear(); page.graphics.beginFill(COLORS.page).drawRect(0, 0, WIDTH, HEIGHT).beginFill(COLORS.panel).drawRect(LIST.x - 4, LIST.y - 4, LIST.width + 28, LIST.height + 8)
    .beginFill(COLORS.track).drawRect(TRACK.x, TRACK.y, TRACK.width, TRACK.height).endFill();
  const { start, length } = scroll.thumb;
  bar.y = TRACK.y + start; bar.hitArea = { x: 0, y: 0, width: TRACK.width, height: length };
  bar.graphics.clear(); bar.graphics.beginFill(scroll.dragging ? COLORS.thumbHeld : barHover.hovered ? COLORS.thumbHover : COLORS.thumb).drawRect(0, 0, TRACK.width, length).endFill();
  for (const row of realized.values()) row.paint();
  try { semantics.publish(rows.sync()); } catch (cause) { fail(cause); }
  status.textContent = failure ? 'Failed / 失败：' + failure : order.length + ' 项可见 / ' + order.length + ' items show' + (selected === undefined ? '' : ' · ' + items.get(selected).name);
  stateView.textContent = JSON.stringify({ ...readSnapshot(), order: undefined }, null, 2);
  engine.renderSharedFrame(drawn); renders++;
}
const drawn = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x000000, clearAlpha: 1 });
globalThis.__egretUiTreeExample = { readSnapshot, settled: () => busy };
await line(engine.stage, 20, 10, 18, '门派 / Sect', COLORS.ink);
await publish();
