// SPDX-License-Identifier: Apache-2.0
// A dropdown for each row of a managed list: a roster of forty members, each with a job. Activating a
// row opens a second managed root as a popup layer anchored to that row, outside the clip of the
// roster. The popup is a listbox of the jobs. A press, the keyboard and a request of assistive
// technology all reach the same two functions: `openFor` and `choose`.
import { createEngineForProfile, DisplayObjectContainer, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createTextRasterCache, createTextField } from '@egret/engine/text';
import { createControlKeys, createScrollControl, createUiLayerManager, createUiRoot } from '@egret/engine/ui';
import { createUiListSemantics, createUiSemantics } from '@egret/engine/ui/semantics';
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { createBrowserSemantics } from '@egret/engine/web/semantics';
import { createBrowserHoverInput } from '@egret/engine/web/hover';
import { createBrowserPointerInput } from '@egret/engine/web/pointer';
import { createBrowserKeyboardInput } from '@egret/engine/web/keyboard';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 320, FAMILY = 'Arial', ROW = 30, COUNT = 40, OPTION = 26, LIST = { x: 20, y: 44, width: 420, height: 240 }, CHIP = { x: 260, width: 160 };
const COLORS = { page: 0x161a22, panel: 0x1f2633, row: 0x2b2f3a, rowAlt: 0x343a48, chip: 0x3d4a63, chipOpen: 0x56689a, option: 0x3d4a63, optionChosen: 0x2f8f6b, ink: 0xf3e9d2, hint: 0x9aa7c4, ring: 0xf2c14e, thumb: 0x56689a };
const JOBS = ['idle', 'herbs', 'forge', 'guard', 'study'], JOB_NAMES = { idle: '待命 Idle', herbs: '采药 Herbs', forge: '锻造 Forge', guard: '守山 Guard', study: '修习 Study' };
const HEROES = ['青锋', '白露', '玄霜', '赤霄', '紫电'];
const keyOf = index => 'm' + index, indexOf = key => Number(key.slice(1)), nameOf = index => '弟子 ' + (index + 1) + ' ' + HEROES[index % 5];
// The model: the job of each member, and how often it changed. A row is bound again when its version is another.
const jobs = Array.from({ length: COUNT }, (_, index) => JOBS[index % JOBS.length]), versions = new Array(COUNT).fill(0);

const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), stateView = document.querySelector('#state');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
// The cache prepares four lines at a time at most, and a list binds its rows together, so text is prepared one line after another.
const cache = createTextRasterCache(engine.assets, { provider: createCanvasTextRasterProvider() });
let textQueue = Promise.resolve();
const inTurn = work => { const next = textQueue.then(work); textQueue = next.catch(() => {}); return next; };
let renders = 0, failure, opened, registration, pressedRow, pressedOption, busy = Promise.resolve(), layersReady = false, revision = 0;
const fail = cause => { failure = String(cause?.code ?? cause?.message ?? cause); };
const pointer = createBrowserPointerInput({ engine, scope, width: WIDTH, height: HEIGHT });
const hover = createBrowserHoverInput({ engine, scope, canvas, width: WIDTH, height: HEIGHT, onError: fail });
const keyboard = createBrowserKeyboardInput({ engine, scope, onFocusChange: () => queueMicrotask(show) });

const page = engine.stage.addChild(scope.use(new Sprite())), bar = engine.stage.addChild(scope.use(new Sprite()));
async function line(parent, x, y, fontSize, text, colour, owner) {
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
    /** After a commit: the rows that show are the newest bindings of their keys. */
    adopt(owner) {
      const rows = new Map(owner.snapshot().rows.map(row => [row.key + ':' + row.bindingGeneration, row.key]));
      for (const [id, entry] of pending) if (rows.has(id)) {
        const key = rows.get(id), old = realized.get(key);
        if (old !== undefined && old.id !== id) old.dispose();
        realized.set(key, { id, ...entry }); pending.delete(id);
      }
    } };
}

// The roster. A row shows a member and, in a chip, the job. The whole row is what is pressed.
const members = bindings();
function rosterSource() {
  return { revision,
    records: jobs.map((_, index) => ({ key: keyOf(index), contentVersion: versions[index], estimatedHeight: ROW, value: index })),
    async bind(context) {
      const { key, index, width } = context, content = context.scope.use(new DisplayObjectContainer()), back = content.addChild(context.scope.use(new Sprite()));
      await line(content, 10, 6, 14, nameOf(index), COLORS.ink, context.scope);
      await line(content, CHIP.x + 8, 6, 14, JOB_NAMES[jobs[index]], COLORS.ink, context.scope);
      const paint = () => {
        const focus = list.getFocus(), focused = focus.focusVisible && focus.key === key && opened === undefined;
        back.graphics.clear();
        if (focused) back.graphics.beginFill(COLORS.ring).drawRect(0, 0, width, ROW - 2).endFill();
        back.graphics.beginFill(index % 2 ? COLORS.rowAlt : COLORS.row).drawRect(focused ? 2 : 0, focused ? 2 : 0, width - (focused ? 4 : 0), ROW - 2 - (focused ? 4 : 0))
          .beginFill(opened === key ? COLORS.chipOpen : COLORS.chip).drawRect(CHIP.x, 4, CHIP.width, ROW - 10).beginFill(COLORS.ink).drawRect(CHIP.x + CHIP.width - 16, 12, 8, 2).drawRect(CHIP.x + CHIP.width - 14, 14, 4, 2).endFill();
      };
      // Enter or Space opens the jobs of the row; the arrow keys move through the roster, which scrolls under the focus.
      const bound = createControlKeys({ keyboard, target: content, kind: 'action', control: { enabled: true, press() {}, release() { void openFor(key); } } });
      const moves = { ArrowDown: index + 1, ArrowUp: index - 1, PageDown: index + 7, PageUp: index - 7, Home: 0, End: COUNT - 1 };
      const stop = content.on(keyboard.events.keyDown, event => {
        if (event.defaultPrevented || !Object.hasOwn(moves, event.payload.code)) return;
        event.preventDefault(); void go(Math.min(COUNT - 1, Math.max(0, moves[event.payload.code])));
      });
      paint();
      members.pending.set(key + ':' + context.bindingGeneration, { paint, dispose() { stop(); bound.dispose(); } });
      return { content, measuredHeight: ROW };
    },
    unbind: members.unbind };
}
const root = createUiRoot({
  engine, scope, id: 'roster', viewport: { width: LIST.width, height: LIST.height }, origin: { x: LIST.x, y: LIST.y }, density: 1,
  tree: { id: 'members', kind: 'virtualList', source: rosterSource(), explicitWidth: LIST.width, explicitHeight: LIST.height },
  keyboard: { input: keyboard, idPrefix: 'roster', tabStop: 1 }, limits: { overscan: 1, residentCap: 24 }, input: pointer,
  onRowPointer(notification) {
    if (notification.kind === 'begin') pressedRow = notification.key;
    else if (notification.kind === 'end') { if (pressedRow === notification.key) void openFor(notification.key); pressedRow = undefined; }
    else if (notification.kind === 'cancel') pressedRow = undefined;
  },
});
const list = root.list('members');

// The jobs: a second root with five rows. It is shown by the layer manager, anchored to the row it was opened for.
const choices = bindings();
const popup = createUiRoot({
  engine, scope, id: 'jobs', viewport: { width: CHIP.width, height: JOBS.length * OPTION }, density: 1, input: pointer, keyboard: { input: keyboard, idPrefix: 'jobs' },
  tree: { id: 'options', kind: 'virtualList', explicitWidth: CHIP.width, explicitHeight: JOBS.length * OPTION, source: { revision: 0,
    records: JOBS.map(job => ({ key: job, contentVersion: 0, estimatedHeight: OPTION, value: job })),
    async bind(context) {
      const { key, index, width } = context, content = context.scope.use(new DisplayObjectContainer()), back = content.addChild(context.scope.use(new Sprite()));
      await line(content, 8, 4, 14, JOB_NAMES[key], COLORS.ink, context.scope);
      const paint = () => {
        const focus = options.getFocus(), focused = focus.focusVisible && focus.key === key, chosen = opened !== undefined && jobs[indexOf(opened)] === key;
        back.graphics.clear();
        if (focused) back.graphics.beginFill(COLORS.ring).drawRect(0, 0, width, OPTION).endFill();
        back.graphics.beginFill(chosen ? COLORS.optionChosen : COLORS.option).drawRect(focused ? 2 : 0, focused ? 2 : 0, width - (focused ? 4 : 0), OPTION - (focused ? 4 : 0)).endFill();
      };
      const bound = createControlKeys({ keyboard, target: content, kind: 'action', control: { enabled: true, press() {}, release() { void choose(key); } } });
      const moves = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: JOBS.length - 1 };
      const stop = content.on(keyboard.events.keyDown, event => {
        if (event.defaultPrevented || !Object.hasOwn(moves, event.payload.code)) return;
        // The keys of a listbox are its own also at an end.
        event.preventDefault(); options.focus(JOBS[Math.min(JOBS.length - 1, Math.max(0, moves[event.payload.code]))], { visible: true }); show();
      });
      paint();
      choices.pending.set(key + ':' + context.bindingGeneration, { paint, dispose() { stop(); bound.dispose(); } });
      return { content, measuredHeight: OPTION };
    },
    unbind: choices.unbind } },
  onRowPointer(notification) {
    if (notification.kind === 'begin') pressedOption = notification.key;
    else if (notification.kind === 'end') { if (pressedOption === notification.key) void choose(notification.key); pressedOption = undefined; }
    else if (notification.kind === 'cancel') pressedOption = undefined;
  },
});
const options = popup.list('options');
// The popup may lie anywhere on the stage, so it escapes the clip of the roster; it flips above a row near the bottom.
// Its end meets the end of the row, which is where the chip of the job is.
const layers = createUiLayerManager({ engine, scope, input: pointer, keyboard, viewport: { x: 0, y: 0, width: WIDTH, height: HEIGHT }, onInvalidate: () => { void publish(); } });
const popupOpen = () => layers.snapshot().openStack.includes('jobs');

// The wheel scrolls the roster wherever the pointer is. A finger does not pan it: panning is a gesture, and none is recognized here.
const scroll = createScrollControl({ viewportLength: LIST.height, contentLength: COUNT * ROW, wheel: { hover, target: engine.stage, lineLength: ROW },
  onScroll(offset) { if (offset !== list.snapshot().scrollOffset) { list.setScrollOffset(offset); void publish(); } } });

// What the screen is to someone who does not see it: a list of members, and a listbox of jobs that is there while the popup is.
const semantics = createUiSemantics();
const rosterNodes = createUiListSemantics({ semantics, root, list: 'members', id: 'roster', role: 'list', name: '名册 / Roster', focusable: true,
  describeRow: (key, index) => ({ name: nameOf(index) + '，' + JOB_NAMES[jobs[index]] }), onActivateRow: key => { void openFor(key); } });
const jobNodes = createUiListSemantics({ semantics, root: popup, list: 'options', id: 'jobs', role: 'listbox', name: '职务 / Job', focusable: true, hidden: () => !popupOpen(),
  describeRow: key => ({ name: JOB_NAMES[key], selected: opened !== undefined && jobs[indexOf(opened)] === key }), onActivateRow: key => { void choose(key); } });
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
    await settle(root); await settle(popup);
    members.adopt(root); choices.adopt(popup);
    if (layersReady) layers.sync();
    // A popup that was dismissed, or whose row is gone, is closed by the layers: the row is then no longer the open one.
    if (opened !== undefined && !popupOpen()) opened = undefined;
    scroll.scrollTo(list.snapshot().scrollOffset);
  };
  busy = busy.then(run).then(show, cause => { fail(cause); show(); });
  return busy;
}
/** Opens the jobs under a row. A second activation of the same row closes them. */
function openFor(key) {
  // The layers are changed after the commits that are under way, and never inside a routed callback.
  return (busy = busy.then(() => {
    const same = opened === key && popupOpen();
    if (popupOpen()) layers.close('jobs');
    if (same) return;
    registration?.dispose();
    registration = layers.register({ id: 'jobs', root: popup, kind: 'popup', closeOnEscape: true,
      anchor: { root, target: { kind: 'row', listId: 'members', key }, gap: 0, align: 'end' }, initialFocus: { listId: 'options', key: jobs[indexOf(key)] } });
    opened = key; layers.open('jobs');
  }).catch(fail)).then(publish);
}
/** A job is chosen for the member whose jobs are open: the row is bound again with it, and the popup closes. */
function choose(job) {
  return (busy = busy.then(() => {
    if (opened === undefined || !popupOpen()) return;
    const index = indexOf(opened);
    if (jobs[index] !== job) { jobs[index] = job; versions[index]++; revision++; list.setSource(rosterSource()); }
    layers.close('jobs');
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
  const ui = root.snapshot(), focus = keyboard.getSnapshot(), layer = layers.snapshot().layers.find(entry => entry.id === 'jobs'), place = popup.snapshot();
  return {
    jobs: [...jobs], opened, open: popupOpen(), offset: list.snapshot().scrollOffset,
    focus: focus.focusedId, focusVisible: focus.focusVisible, row: list.getFocus().key, option: options.getFocus().key,
    rows: ui.rows.filter(row => row.visible).map(row => ({ key: row.key, index: row.index, x: LIST.x + row.box.x, y: LIST.y + row.box.y, width: row.box.width, height: row.box.height })),
    popup: layer === undefined || !layer.visible ? undefined : { x: place.origin.x, y: place.origin.y, width: CHIP.width, height: JOBS.length * OPTION },
    renders, failure, realized: members.realized.size,
    semantics: { focused: semantics.snapshot.focused, nodes: semantics.snapshot.nodes.length, projection: projection.state },
  };
}
function show() {
  if (scope.state !== 'open') return;
  page.graphics.clear(); page.graphics.beginFill(COLORS.page).drawRect(0, 0, WIDTH, HEIGHT).beginFill(COLORS.panel).drawRect(LIST.x - 4, LIST.y - 4, LIST.width + 20, LIST.height + 8).endFill();
  // Where the roster is in its whole length.
  const length = Math.round(LIST.height * LIST.height / (COUNT * ROW)), start = scroll.maximum === 0 ? 0 : Math.round(scroll.offset / scroll.maximum * (LIST.height - length));
  bar.graphics.clear(); bar.graphics.beginFill(COLORS.thumb).drawRect(LIST.x + LIST.width + 6, LIST.y + start, 6, length).endFill();
  for (const row of members.realized.values()) row.paint();
  for (const row of choices.realized.values()) row.paint();
  try { rosterNodes.sync(); jobNodes.sync(); semantics.publish(layersReady ? layers.snapshot().committedRevision : undefined); } catch (cause) { fail(cause); }
  const counts = JOBS.map(job => JOB_NAMES[job].split(' ')[0] + ' ' + jobs.filter(value => value === job).length).join(' · ');
  status.textContent = failure ? 'Failed / 失败：' + failure : counts + (opened === undefined ? '' : ' · ' + nameOf(indexOf(opened)) + ' …');
  stateView.textContent = JSON.stringify({ ...readSnapshot(), jobs: undefined }, null, 2);
  engine.renderSharedFrame(drawn); renders++;
}
const drawn = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x000000, clearAlpha: 1 });
globalThis.__egretUiDropdownExample = { readSnapshot, settled: () => busy };
const title = scope.use(new DisplayObjectContainer()); engine.stage.addChild(title);
await line(title, 20, 10, 18, '名册 / Roster', COLORS.ink, scope);
await line(title, 270, 14, 14, '职务 / Job', COLORS.hint, scope);
await publish();
layers.register({ id: 'roster', root, kind: 'base' });
layersReady = true;
await publish();
