// SPDX-License-Identifier: Apache-2.0
// Several rows of a managed list chosen at once: a roster of forty members, of whom any number are
// chosen and then sent out. The choice is a set of keys the application keeps, because a virtual list
// has rows only for what shows. Each row takes the pointer through the display object its binding is
// given, and the semantic tree says the list is a list box with several selections.
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

const WIDTH = 480, HEIGHT = 320, FAMILY = 'Arial', ROW = 30, COUNT = 40, LIST = { x: 20, y: 44, width: 290, height: 240 }, TRACK = { x: 316, y: 44, width: 14, height: 240 };
const COLORS = { page: 0x161a22, panel: 0x1f2633, row: 0x2b2f3a, rowAlt: 0x343a48, rowHover: 0x454c5e, rowPressed: 0x232730, rowChosen: 0x2f8f6b, rowChosenHover: 0x3fae84, rowAway: 0x22252d,
  box: 0x10141b, mark: 0xf3e9d2, button: 0x3d4a63, buttonHover: 0x56689a, buttonPressed: 0x27314a, buttonOff: 0x2a2d33, ink: 0xf3e9d2, hint: 0x9aa7c4, ring: 0xf2c14e, track: 0x10141b, thumb: 0x56689a, thumbHeld: 0x9aa7c4 };
const HEROES = ['青锋', '白露', '玄霜', '赤霄', '紫电'];
const keyOf = index => 'm' + index, indexOf = key => Number(key.slice(1)), nameOf = index => '弟子 ' + (index + 1) + ' ' + HEROES[index % 5];
// The model: who is chosen, who is away, and how often each record changed. A row is bound again when its version is another.
const chosen = new Set(), away = new Set(), versions = new Array(COUNT).fill(0);

const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), stateView = document.querySelector('#state');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
// The cache prepares four lines at a time at most, and a list binds its rows together, so text is prepared one line after another.
const cache = createTextRasterCache(engine.assets, { provider: createCanvasTextRasterProvider() });
let textQueue = Promise.resolve();
const inTurn = work => { const next = textQueue.then(work); textQueue = next.catch(() => {}); return next; };
let renders = 0, failure, queued = false, busy = Promise.resolve(), revision = 0, sent = 0;
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
/** A line of text that can be given other words. */
function line(parent, x, y, fontSize, text, colour, owner = scope) {
  const field = createTextField(engine, owner, cache);
  field.x = x; field.y = y; parent.addChild(field);
  const item = { shown: undefined, prepare(next) {
    if (item.shown === next) return Promise.resolve();
    item.shown = next;
    field.setRequest({ text: next, fontFamily: FAMILY, fontSize, fontWeight: 400, fontStyle: 'normal', lineHeight: Math.round(fontSize * 1.3), locale: 'zh-CN', direction: 'ltr', density: 2, fillColor: colour });
    return inTurn(() => field.prepare());
  } };
  return { item, ready: item.prepare(text) };
}

// The roster. A row shows a member and a box that is marked while the member is chosen.
const pending = new Map(), realized = new Map();
function rosterSource() {
  return { revision,
    records: versions.map((version, index) => ({ key: keyOf(index), contentVersion: version, estimatedHeight: ROW, value: index })),
    async bind(context) {
      const { key, index, width } = context, gone = away.has(key), content = context.scope.use(new DisplayObjectContainer()), back = content.addChild(context.scope.use(new Sprite()));
      await line(content, 40, 6, 14, nameOf(index) + (gone ? ' · 外出 Away' : ''), gone ? COLORS.hint : COLORS.ink, context.scope).ready;
      // The row takes the pointer through its own display object. A member who is away is a row that does nothing.
      const pointed = createHoverControl({ hover, target: context.target, onHoverChange: later });
      const held = createActionControl({ input: pointer, target: context.target, onActivate: () => flip(key), onPressChange: later });
      held.setEnabled(!gone); pointed.setEnabled(!gone);
      const paint = () => {
        const focus = list.getFocus(), focused = focus.focusVisible && focus.key === key, on = chosen.has(key);
        const fill = gone ? COLORS.rowAway : held.pressed ? COLORS.rowPressed : on ? (pointed.hovered ? COLORS.rowChosenHover : COLORS.rowChosen) : pointed.hovered ? COLORS.rowHover : index % 2 ? COLORS.rowAlt : COLORS.row;
        back.graphics.clear();
        if (focused) back.graphics.beginFill(COLORS.ring).drawRect(0, 0, width, ROW - 2).endFill();
        back.graphics.beginFill(fill).drawRect(focused ? 2 : 0, focused ? 2 : 0, width - (focused ? 4 : 0), ROW - 2 - (focused ? 4 : 0)).beginFill(COLORS.box).drawRect(12, 7, 14, 14).endFill();
        if (on) back.graphics.beginFill(COLORS.mark).drawRect(15, 10, 8, 8).endFill();
      };
      // Space or Enter flips the row that holds the focus; the arrow keys move the focus and leave the choice as it is.
      // The keys of a row that is away are taken too and change nothing: left to the page, Space would scroll it.
      const bound = createControlKeys({ keyboard, target: content, kind: 'action', control: { enabled: true, press() {}, release() { flip(key); } } });
      const moves = { ArrowDown: index + 1, ArrowUp: index - 1, PageDown: index + 7, PageUp: index - 7, Home: 0, End: COUNT - 1 };
      const stop = content.on(keyboard.events.keyDown, event => {
        const { code, shiftKey, ctrlKey, metaKey, altKey } = event.payload;
        if (event.defaultPrevented || altKey) return;
        // Control+A, or the platform key with A, chooses everyone who is here. Taken, it does not select the text of the page.
        if (ctrlKey || metaKey) { if (code === 'KeyA') { event.preventDefault(); chooseAll(); } return; }
        if (!Object.hasOwn(moves, code)) return;
        event.preventDefault();
        const to = Math.min(COUNT - 1, Math.max(0, moves[code]));
        // With Shift a movement key chooses every member from the row it leaves to the row it reaches. It lets nobody go.
        if (shiftKey) { for (let at = Math.min(index, to); at <= Math.max(index, to); at++) if (!away.has(keyOf(at))) chosen.add(keyOf(at)); show(); }
        void go(to);
      });
      paint();
      pending.set(key + ':' + context.bindingGeneration, { paint, hovered: () => pointed.hovered, dispose() { stop(); bound.dispose(); held.dispose(); pointed.dispose(); } });
      return { content, measuredHeight: ROW };
    },
    unbind({ key, bindingGeneration }) {
      const id = key + ':' + bindingGeneration;
      pending.get(id)?.dispose(); pending.delete(id);
      if (realized.get(key)?.id === id) { realized.get(key).dispose(); realized.delete(key); }
    } };
}
const root = createUiRoot({
  engine, scope, id: 'roster', viewport: { width: LIST.width, height: LIST.height }, origin: { x: LIST.x, y: LIST.y }, density: 1, input: pointer,
  tree: { id: 'members', kind: 'virtualList', source: rosterSource(), explicitWidth: LIST.width, explicitHeight: LIST.height },
  keyboard: { input: keyboard, idPrefix: 'roster', tabStop: 1 }, limits: { overscan: 1, residentCap: 24 },
});
const list = root.list('members');
function chooseAll() { for (const key of free()) chosen.add(key); show(); }
/** One member is chosen or let go. The others stay as they are. */
function flip(key) { if (away.has(key)) return; if (!chosen.delete(key)) chosen.add(key); show(); }

const barHover = createHoverControl({ hover, target: bar, onHoverChange: later });
const scroll = createScrollControl({ viewportLength: LIST.height, contentLength: COUNT * ROW, wheel: { hover, target: engine.stage, lineLength: ROW },
  thumb: { input: pointer, target: bar, trackLength: TRACK.height, minimumLength: 24 }, onDragChange: later,
  onScroll(offset) { if (offset !== list.snapshot().scrollOffset) { list.setScrollOffset(offset); void publish(); } } });

// The buttons beside the roster.
function button(id, box, text, tabIndex, act) {
  const ring = engine.stage.addChild(scope.use(new Sprite())), sprite = engine.stage.addChild(scope.use(new Sprite()));
  ring.x = box.x - 3; ring.y = box.y - 3; sprite.x = box.x; sprite.y = box.y; sprite.touchEnabled = true; sprite.hitArea = { x: 0, y: 0, width: box.width, height: box.height };
  const caption = line(engine.stage, box.x + 12, box.y + Math.round((box.height - 18) / 2), 14, text, COLORS.ink);
  const part = { id, box, caption: caption.item, ready: caption.ready, pointed: createHoverControl({ hover, target: sprite, onHoverChange: later }),
    action: createActionControl({ input: pointer, target: sprite, onActivate: act, onPressChange: later }),
    paint() {
      ring.visible = ringed(id); ring.graphics.clear(); ring.graphics.beginFill(COLORS.ring).drawRect(0, 0, box.width + 6, box.height + 6).endFill();
      const fill = !part.action.enabled ? COLORS.buttonOff : part.action.pressed || part.keys.pressed ? COLORS.buttonPressed : part.pointed.hovered ? COLORS.buttonHover : COLORS.button;
      sprite.graphics.clear(); sprite.graphics.beginFill(fill).drawRect(0, 0, box.width, box.height).endFill();
    } };
  keyboard.registerTarget({ id, target: sprite, tabIndex });
  part.keys = createControlKeys({ keyboard, target: sprite, kind: 'action', control: part.action, onPressChange: later });
  return part;
}
const free = () => versions.map((_, index) => keyOf(index)).filter(key => !away.has(key));
const buttons = {
  all: button('all', { x: 346, y: 84, width: 114, height: 30 }, '全选 / All', 2, chooseAll),
  clear: button('clear', { x: 346, y: 122, width: 114, height: 30 }, '清除 / Clear', 3, () => { chosen.clear(); show(); }),
  send: button('send', { x: 346, y: 176, width: 114, height: 36 }, '派遣 / Send', 4, () => { void send(); }),
};
const count = line(engine.stage, 346, 50, 14, '', COLORS.hint);
const countText = () => '已选 ' + chosen.size + ' / ' + chosen.size + ' chosen';
/** The chosen members leave: their rows are bound again as away, and nobody is chosen. */
function send() {
  if (chosen.size === 0) return busy;
  for (const key of chosen) { away.add(key); versions[indexOf(key)]++; }
  sent += chosen.size; chosen.clear(); revision++;
  list.setSource(rosterSource());
  return publish();
}

// What the screen is to someone who does not see it: a list box in which several options may be selected.
const semantics = createUiSemantics();
const rows = createUiListSemantics({ semantics, root, list: 'members', id: 'roster', role: 'listbox', name: '名册 / Roster', multiple: true, focusable: true,
  describeRow: (key, index) => ({ name: nameOf(index) + (away.has(key) ? '，外出 Away' : ''), selected: chosen.has(key), disabled: away.has(key) }), onActivateRow: flip });
semantics.add({ id: 'roster-scroll', role: 'scrollbar', describe: () => ({ name: '名册滚动 / Roster scroll', bounds: TRACK, controls: 'roster', range: { now: Math.round(scroll.offset), min: 0, max: scroll.maximum } }) });
semantics.add({ id: 'count', role: 'text', describe: () => ({ name: countText(), bounds: { x: 346, y: 50, width: 114, height: 20 } }) });
for (const [id, name] of [['all', '全选 / All'], ['clear', '清除 / Clear'], ['send', '派遣 / Send']]) semantics.add({ id, role: 'button',
  onActivate: () => { buttons[id].action.press(); buttons[id].action.release(); }, onFocus: () => keyboard.focus(id, { visible: true }),
  describe: () => ({ name, bounds: buttons[id].box, disabled: !buttons[id].action.enabled, focused: holds(id) }) });
const projection = createBrowserSemantics({ semantics, canvas, width: WIDTH, height: HEIGHT, label: 'Send members / 派遣弟子', onError: fail });

function publish() {
  const run = async () => {
    for (let round = 0; ; round++) {
      const preparation = await root.prepare();
      if (preparation.status !== 'pending') { root.commit(preparation); break; }
      if (round === 7) throw new Error('The layout did not settle');
    }
    // After a commit the rows that show are the newest bindings of their keys.
    const shown = new Map(root.snapshot().rows.map(row => [row.key + ':' + row.bindingGeneration, row.key]));
    for (const [id, entry] of pending) if (shown.has(id)) {
      const key = shown.get(id), old = realized.get(key);
      if (old !== undefined && old.id !== id) old.dispose();
      realized.set(key, { id, ...entry }); pending.delete(id);
    }
    scroll.scrollTo(list.snapshot().scrollOffset);
    // A pointer that rests while the rows move under it sends nothing: the input picks again where it is.
    hover.sync();
  };
  busy = busy.then(run).then(show, cause => { fail(cause); show(); });
  return busy;
}
async function go(index) {
  list.reveal(keyOf(index), { align: 'nearest' });
  await publish();
  if (root.snapshot().rows.some(row => row.key === keyOf(index) && row.visible)) list.focus(keyOf(index), { visible: true });
  show();
}

/** What a check reads: plain values only. */
export function readSnapshot() {
  const ui = root.snapshot(), focus = keyboard.getSnapshot();
  return {
    chosen: [...chosen].sort((a, b) => indexOf(a) - indexOf(b)), away: [...away].sort((a, b) => indexOf(a) - indexOf(b)), sent, offset: list.snapshot().scrollOffset,
    thumb: { x: TRACK.x, y: TRACK.y + scroll.thumb.start, width: TRACK.width, height: scroll.thumb.length }, dragging: scroll.dragging,
    focus: focus.focusedId, focusVisible: focus.focusVisible, row: list.getFocus().key,
    rows: ui.rows.filter(row => row.visible).map(row => ({ key: row.key, index: row.index, x: LIST.x + row.box.x, y: LIST.y + row.box.y, width: row.box.width, height: row.box.height })),
    enabled: Object.fromEntries(Object.entries(buttons).map(([id, part]) => [id, part.action.enabled])), hovered: [...realized].filter(([, row]) => row.hovered()).map(([key]) => key),
    renders, failure, realized: realized.size, semantics: { focused: semantics.snapshot.focused, nodes: semantics.snapshot.nodes.length, projection: projection.state },
  };
}
function show() {
  if (scope.state !== 'open') return;
  // A button that has nothing to do is disabled. One that held the focus then gives it to the roster's first stop that can take it.
  const wanted = { all: chosen.size < free().length, clear: chosen.size > 0, send: chosen.size > 0 };
  for (const [id, part] of Object.entries(buttons)) if (part.action.enabled !== wanted[id]) {
    part.action.setEnabled(wanted[id]);
    if (!wanted[id] && holds(id)) keyboard.focus(Object.keys(buttons).find(other => wanted[other]) ?? 'all', { visible: keyboard.getSnapshot().focusVisible });
  }
  page.graphics.clear(); page.graphics.beginFill(COLORS.page).drawRect(0, 0, WIDTH, HEIGHT).beginFill(COLORS.panel).drawRect(LIST.x - 4, LIST.y - 4, LIST.width + 28, LIST.height + 8)
    .beginFill(COLORS.track).drawRect(TRACK.x, TRACK.y, TRACK.width, TRACK.height).endFill();
  const { start, length } = scroll.thumb;
  bar.y = TRACK.y + start; bar.hitArea = { x: 0, y: 0, width: TRACK.width, height: length };
  bar.graphics.clear(); bar.graphics.beginFill(scroll.dragging ? COLORS.thumbHeld : barHover.hovered ? COLORS.buttonHover : COLORS.thumb).drawRect(0, 0, TRACK.width, length).endFill();
  for (const row of realized.values()) row.paint();
  for (const part of Object.values(buttons)) part.paint();
  void count.item.prepare(countText()).then(() => { if (scope.state === 'open') frame(); }, fail);
  try { semantics.publish(rows.sync()); } catch (cause) { fail(cause); }
  status.textContent = failure ? 'Failed / 失败：' + failure : countText() + ' · 外出 ' + away.size + ' away';
  stateView.textContent = JSON.stringify(readSnapshot(), null, 2);
  frame();
}
const drawn = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x000000, clearAlpha: 1 });
function frame() { engine.renderSharedFrame(drawn); renders++; }
globalThis.__egretUiMultiSelectExample = { readSnapshot, settled: () => busy.then(() => textQueue) };
await line(engine.stage, 20, 10, 18, '派遣弟子 / Send members', COLORS.ink).ready;
await Promise.all(Object.values(buttons).map(part => part.ready));
await publish();
