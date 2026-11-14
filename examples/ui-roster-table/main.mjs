// SPDX-License-Identifier: Apache-2.0
// A table that sorts. Forty members are the rows of a managed list, under a row of four headers
// drawn by the application. A press on a header sorts by its column, and again turns the order
// round; a press on a row selects its member. The semantic tree says the same as a grid: the list
// helper publishes the rows that show as rows of the grid, the application adds the cells inside
// each and the row of headers above them, and a header says how the rows are sorted.
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

const WIDTH = 480, HEIGHT = 320, FAMILY = 'Arial', ROW = 30, COUNT = 40, HEAD = { x: 20, y: 44, width: 420, height: 26 }, LIST = { x: 20, y: 74, width: 420, height: 210 }, TRACK = { x: 446, y: 74, width: 14, height: 210 };
const COLORS = { page: 0x161a22, panel: 0x1f2633, row: 0x2b2f3a, rowHover: 0x454c5e, rowChosen: 0x2f8f6b, head: 0x3d4a63, headHover: 0x56689a, headPressed: 0x27314a, mark: 0xf3e9d2, ink: 0xf3e9d2, hint: 0x9aa7c4, ring: 0xf2c14e,
  track: 0x10141b, thumb: 0x56689a, thumbHeld: 0x9aa7c4 };
const HEROES = ['青锋', '白露', '玄霜', '赤霄', '紫电'], RANKS = ['外门 Outer', '内门 Inner', '真传 Core'], JOBS = ['待命 Idle', '采药 Herbs', '锻造 Forge', '守山 Guard', '修习 Study'];
// The members never change here: their rank, their job and their level are worked out from their number.
const member = index => ({ name: '弟子 ' + (index + 1) + ' ' + HEROES[index % 5], rank: index * 7 % 3, job: index * 3 % 5, level: index * 37 % 89 + 1 });
const COLUMNS = [
  { key: 'name', zh: '姓名', en: 'Name', x: 0, width: 140, text: index => member(index).name, order: index => index },
  { key: 'rank', zh: '品阶', en: 'Rank', x: 140, width: 95, text: index => RANKS[member(index).rank], order: index => member(index).rank },
  { key: 'job', zh: '职务', en: 'Job', x: 235, width: 95, text: index => JOBS[member(index).job], order: index => member(index).job },
  { key: 'level', zh: '修为', en: 'Level', x: 330, width: 90, text: index => String(member(index).level), order: index => member(index).level },
].map(column => ({ ...column, name: column.zh + ' / ' + column.en }));
const keyOf = index => 'm' + index, indexOf = key => Number(key.slice(1));
// The model: by which column the rows are sorted and which way, the order that gives, and who is selected.
let sorted = { column: 'name', way: 'ascending' }, order = Array.from({ length: COUNT }, (_, index) => index), selected, revision = 0;
const sortText = () => { const column = COLUMNS.find(found => found.key === sorted.column), up = sorted.way === 'ascending'; return '按' + column.zh + (up ? '升序' : '降序') + ' / By ' + column.en.toLowerCase() + ', ' + sorted.way; };

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

// The headers. Each is a button that sorts by its column, and a stop of the keyboard before the rows.
const heads = COLUMNS.map((column, at) => {
  const box = { x: HEAD.x + column.x, y: HEAD.y, width: column.width - 2, height: HEAD.height }, ring = engine.stage.addChild(scope.use(new Sprite())), face = engine.stage.addChild(scope.use(new Sprite())), id = 'head-' + column.key;
  ring.x = box.x - 3; ring.y = box.y - 3; face.x = box.x; face.y = box.y; face.touchEnabled = true; face.hitArea = { x: 0, y: 0, width: box.width, height: box.height };
  const pointed = createHoverControl({ hover, target: face, onHoverChange: later });
  const control = createActionControl({ input: pointer, target: face, onActivate: () => sortBy(column.key), onPressChange: later });
  keyboard.registerTarget({ id, target: face, tabIndex: at + 1 });
  const keys = createControlKeys({ keyboard, target: face, kind: 'action', control, onPressChange: later });
  return { column, id, box, ring, face, pointed, control, keys };
});

// The rows. A row holds nothing but what it shows: where a member stands is read from the order when it is needed.
const pending = new Map(), realized = new Map();
function source() {
  return { revision,
    records: order.map(index => ({ key: keyOf(index), contentVersion: 0, estimatedHeight: ROW, value: index })),
    async bind(context) {
      const { key, width } = context, index = indexOf(key), content = context.scope.use(new DisplayObjectContainer()), back = content.addChild(context.scope.use(new Sprite()));
      for (const column of COLUMNS) await line(content, column.x + 8, 6, 14, column.text(index), column.key === 'name' ? COLORS.ink : COLORS.hint, context.scope);
      const pointed = createHoverControl({ hover, target: context.target, onHoverChange: later });
      const held = createActionControl({ input: pointer, target: context.target, onActivate: () => select(key) });
      const paint = () => {
        const focus = list.getFocus(), focused = focus.focusVisible && focus.key === key;
        back.graphics.clear();
        if (focused) back.graphics.beginFill(COLORS.ring).drawRect(0, 0, width, ROW - 2).endFill();
        back.graphics.beginFill(key === selected ? COLORS.rowChosen : pointed.hovered ? COLORS.rowHover : COLORS.row).drawRect(focused ? 2 : 0, focused ? 2 : 0, width - (focused ? 4 : 0), ROW - 2 - (focused ? 4 : 0)).endFill();
      };
      // Space or Enter selects the row that holds the focus; the arrow keys move the focus through the rows as they are ordered now.
      const bound = createControlKeys({ keyboard, target: content, kind: 'action', control: { enabled: true, press() {}, release() { select(key); } } });
      const stop = content.on(keyboard.events.keyDown, event => {
        const { code, shiftKey, ctrlKey, metaKey, altKey } = event.payload, at = order.indexOf(index);
        const moves = { ArrowDown: at + 1, ArrowUp: at - 1, PageDown: at + 7, PageUp: at - 7, Home: 0, End: COUNT - 1 };
        if (event.defaultPrevented || shiftKey || ctrlKey || metaKey || altKey || !Object.hasOwn(moves, code)) return;
        event.preventDefault(); void go(Math.min(COUNT - 1, Math.max(0, moves[code])));
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
  engine, scope, id: 'roster', viewport: { width: LIST.width, height: LIST.height }, origin: { x: LIST.x, y: LIST.y }, density: 1, input: pointer,
  tree: { id: 'members', kind: 'virtualList', source: source(), explicitWidth: LIST.width, explicitHeight: LIST.height },
  keyboard: { input: keyboard, idPrefix: 'roster', tabStop: COLUMNS.length + 1 }, limits: { overscan: 1, residentCap: 24 },
});
const list = root.list('members');
function select(key) { selected = key; show(); }
/** Sorts by a column: ascending the first time, and the other way when it is the column the rows are sorted by already. Members that are equal keep their numbers' order. */
function sortBy(key) {
  sorted = { column: key, way: sorted.column === key && sorted.way === 'ascending' ? 'descending' : 'ascending' };
  const column = COLUMNS.find(found => found.key === key), turn = sorted.way === 'ascending' ? 1 : -1;
  order = Array.from({ length: COUNT }, (_, index) => index).sort((a, b) => (column.order(a) - column.order(b)) * turn || a - b);
  revision++; list.setSource(source()); list.setScrollOffset(0);
  return publish();
}

const barHover = createHoverControl({ hover, target: bar, onHoverChange: later });
const scroll = createScrollControl({ viewportLength: LIST.height, contentLength: COUNT * ROW, wheel: { hover, target: engine.stage, lineLength: ROW },
  thumb: { input: pointer, target: bar, trackLength: TRACK.height, minimumLength: 24 }, onDragChange: later,
  onScroll(offset) { if (offset !== list.snapshot().scrollOffset) { list.setScrollOffset(offset); void publish(); } } });

// What the screen is to someone who does not see it: a grid of forty-one rows and four columns, of which the first row is the headers.
const semantics = createUiSemantics();
const rows = createUiListSemantics({ semantics, root, list: 'members', id: 'roster', role: 'grid', name: '名册 / Roster', columns: COLUMNS.length, rowOffset: 1, focusable: true,
  describeRow: key => ({ selected: key === selected }), onActivateRow: select,
  // The cells of a row are added when its row is, and go with it. Each is measured from the part of its row that shows.
  onRowAdded(key, id) {
    for (const [at, column] of COLUMNS.entries()) semantics.add({ id: id + '/' + column.key, role: 'gridcell', parent: id, describe: () => {
      const part = rows.rowBounds(key) ?? { x: LIST.x, y: LIST.y, width: 0, height: 0 };
      return { name: column.text(indexOf(key)), bounds: { x: part.x + column.x, y: part.y, width: Math.min(column.width, part.width), height: part.height }, position: { index: at + 1, size: COLUMNS.length }, order: at };
    } });
  } });
semantics.add({ id: 'roster/head', role: 'row', parent: 'roster', describe: () => ({ bounds: HEAD, position: { index: 1, size: COUNT + 1 }, order: -1 }) });
for (const [at, head] of heads.entries()) semantics.add({ id: 'roster/head/' + head.column.key, role: 'columnheader', parent: 'roster/head',
  onActivate: () => { void sortBy(head.column.key); }, onFocus: () => keyboard.focus(head.id, { visible: true }),
  describe: () => ({ name: head.column.name, bounds: head.box, sort: sorted.column === head.column.key ? sorted.way : 'none', position: { index: at + 1, size: COLUMNS.length }, focused: holds(head.id) }) });
semantics.add({ id: 'roster-scroll', role: 'scrollbar', describe: () => ({ name: '名册滚动 / Roster scroll', bounds: TRACK, controls: 'roster', range: { now: Math.round(scroll.offset), min: 0, max: scroll.maximum } }) });
// How the rows are sorted is also said as a message when it changes.
semantics.add({ id: 'sorted', role: 'status', describe: () => ({ name: sortText(), bounds: { x: HEAD.x, y: 14, width: 200, height: 18 } }) });
const projection = createBrowserSemantics({ semantics, canvas, width: WIDTH, height: HEIGHT, label: 'Roster / 名册', onError: fail });

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
    scroll.scrollTo(list.snapshot().scrollOffset);
    // A pointer that rests while the rows move under it sends nothing: the input picks again where it is.
    hover.sync();
  };
  busy = busy.then(run).then(show, cause => { fail(cause); show(); });
  return busy;
}
async function go(at) {
  const key = keyOf(order[at]);
  list.reveal(key, { align: 'nearest' });
  await publish();
  if (root.snapshot().rows.some(row => row.key === key && row.visible)) list.focus(key, { visible: true });
  show();
}

/** What a check reads: plain values only. */
export function readSnapshot() {
  const ui = root.snapshot(), focus = keyboard.getSnapshot();
  return { sorted: { ...sorted }, order: order.map(keyOf), selected, offset: list.snapshot().scrollOffset, focus: focus.focusedId, focusVisible: focus.focusVisible, row: list.getFocus().key,
    rows: ui.rows.filter(row => row.visible).map(row => ({ key: row.key, index: row.index, y: LIST.y + row.box.y, height: row.box.height })),
    renders, failure, semantics: { focused: semantics.snapshot.focused, nodes: semantics.snapshot.nodes.length, projection: projection.state } };
}
function show() {
  if (scope.state !== 'open') return;
  page.graphics.clear(); page.graphics.beginFill(COLORS.page).drawRect(0, 0, WIDTH, HEIGHT).beginFill(COLORS.panel).drawRect(LIST.x - 4, HEAD.y - 4, LIST.width + 28, HEAD.height + LIST.height + 12)
    .beginFill(COLORS.track).drawRect(TRACK.x, TRACK.y, TRACK.width, TRACK.height).endFill();
  const { start, length } = scroll.thumb;
  bar.y = TRACK.y + start; bar.hitArea = { x: 0, y: 0, width: TRACK.width, height: length };
  bar.graphics.clear(); bar.graphics.beginFill(scroll.dragging ? COLORS.thumbHeld : barHover.hovered ? COLORS.headHover : COLORS.thumb).drawRect(0, 0, TRACK.width, length).endFill();
  for (const head of heads) {
    const { box } = head, is = sorted.column === head.column.key;
    head.ring.visible = ringed(head.id); head.ring.graphics.clear(); head.ring.graphics.beginFill(COLORS.ring).drawRect(0, 0, box.width + 6, box.height + 6).endFill();
    head.face.graphics.clear(); head.face.graphics.beginFill(head.control.pressed || head.keys.pressed ? COLORS.headPressed : head.pointed.hovered ? COLORS.headHover : COLORS.head).drawRect(0, 0, box.width, box.height).endFill();
    // The column the rows are sorted by carries a bar: along its top edge when they ascend, along its bottom edge when they descend.
    if (is) head.face.graphics.beginFill(COLORS.mark).drawRect(0, sorted.way === 'ascending' ? 0 : box.height - 3, box.width, 3).endFill();
  }
  for (const row of realized.values()) row.paint();
  try { semantics.publish(rows.sync()); } catch (cause) { fail(cause); }
  status.textContent = failure ? 'Failed / 失败：' + failure : sortText() + (selected === undefined ? '' : ' · ' + member(indexOf(selected)).name);
  stateView.textContent = JSON.stringify({ ...readSnapshot(), order: undefined }, null, 2);
  engine.renderSharedFrame(drawn); renders++;
}
const drawn = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x000000, clearAlpha: 1 });
globalThis.__egretUiRosterTableExample = { readSnapshot, settled: () => busy };
await line(engine.stage, 20, 10, 18, '名册 / Roster', COLORS.ink);
for (const head of heads) await line(engine.stage, head.box.x + 8, head.box.y + 5, 13, head.column.name, COLORS.ink);
await publish();
