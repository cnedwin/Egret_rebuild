// SPDX-License-Identifier: Apache-2.0
// A list of fifty thousand servers, of which the managed UI realizes the eight that show.
// `createUiListSemantics` keeps one semantic node for each row that shows, so assistive technology is
// given a listbox whose options say where they stand in the whole list. A press, a key and a request
// of assistive technology all reach the same selection.
// The details of a server open in a modal layer of the layer manager. Its semantic node is a dialog that
// is hidden while the layer is closed, and while it is open everything outside it is inert.
import { createEngineForProfile, DisplayObjectContainer, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createActionControl, createControlKeys, createUiLayerManager, createUiRoot } from '@egret/engine/ui';
import { createUiListSemantics, createUiSemantics, semanticBoxOf } from '@egret/engine/ui/semantics';
import { createBrowserSemantics } from '@egret/engine/web/semantics';
import { createBrowserPointerInput } from '@egret/engine/web/pointer';
import { createBrowserKeyboardInput } from '@egret/engine/web/keyboard';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 300, ROW = 30, COUNT = 50000, VIEW = { x: 40, y: 30, width: 400, height: 240 };
const PAINT = { even: 0x2b2f3a, odd: 0x343a48, selected: 0x2f8f6b, ring: 0xf2c14e, pip: 0x9aa7c4, button: 0x3d4a63, held: 0x27314a };
const CARD = { width: 260, padding: 15, gap: 10, inner: 230 };
const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), stateView = document.querySelector('#state');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
const frame = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x161a22, clearAlpha: 1 });
let renders = 0, failure, selected = 'k2', detail = 'k2', pressed, busy = Promise.resolve(), layersReady = false, buttons = {};
const fail = cause => { failure = String(cause?.code ?? cause); };
const pointer = createBrowserPointerInput({ engine, scope, width: WIDTH, height: HEIGHT });
const keyboard = createBrowserKeyboardInput({ engine, scope, onFocusChange: () => queueMicrotask(show) });

/** The rows that are realized now, by key: how to paint each, and what to dispose when it is recycled. */
const realized = new Map();
const keyOf = index => 'k' + index, indexOf = key => Number(key.slice(1));
const source = {
  revision: 0,
  records: Array.from({ length: COUNT }, (_, index) => ({ key: keyOf(index), contentVersion: 0, estimatedHeight: ROW, value: index })),
  bind(context) {
    const { key, index, width } = context, content = context.scope.use(new Sprite());
    const paint = () => {
      const focus = list.getFocus(), focused = focus.focusVisible && focus.key === key;
      content.graphics.clear();
      if (focused) content.graphics.beginFill(PAINT.ring).drawRect(0, 0, width, ROW - 2).endFill();
      content.graphics.beginFill(key === selected ? PAINT.selected : index % 2 ? PAINT.odd : PAINT.even).drawRect(focused ? 3 : 0, focused ? 3 : 0, width - (focused ? 6 : 0), ROW - 2 - (focused ? 6 : 0)).endFill();
      // A mark that tells the rows apart without text: the last digit of the row's number, as pips.
      for (let pip = 0; pip <= index % 10; pip++) content.graphics.beginFill(PAINT.pip).drawRect(10 + pip * 10, 11, 6, 6).endFill();
    };
    // Space or Enter, released, chooses the row: the binding takes anything with the methods of an action.
    const keys = createControlKeys({ keyboard, target: content, kind: 'action', control: { enabled: true, press() {}, release() { select(key); } } });
    // The arrows move the focus through the whole list, not only through the rows that show.
    const moves = { ArrowDown: index + 1, ArrowUp: index - 1, PageDown: index + 7, PageUp: index - 7, Home: 0, End: COUNT - 1 };
    const stop = content.on(keyboard.events.keyDown, event => {
      if (event.defaultPrevented) return;
      // Arrow Right opens the details of the row, as it opens what a row leads to elsewhere.
      if (event.payload.code === 'ArrowRight') { event.preventDefault(); openDetails(key); return; }
      if (!Object.hasOwn(moves, event.payload.code)) return;
      event.preventDefault();
      go(Math.min(COUNT - 1, Math.max(0, moves[event.payload.code])));
    });
    realized.get(key)?.dispose();
    realized.set(key, { paint, dispose() { stop(); keys.dispose(); } });
    paint();
    return { content, measuredHeight: ROW };
  },
  unbind({ key }) { realized.get(key)?.dispose(); realized.delete(key); },
};
const root = createUiRoot({
  engine, scope, id: 'servers', viewport: { width: VIEW.width, height: VIEW.height }, origin: { x: VIEW.x, y: VIEW.y }, density: 1,
  tree: { id: 'list', kind: 'virtualList', source, explicitWidth: VIEW.width, explicitHeight: VIEW.height },
  // The list is one stop of the keyboard, as a native list box is: Tab enters it at the row that last held the
  // focus and leaves it from there, and the arrow keys move among the rows.
  keyboard: { input: keyboard, idPrefix: 'servers', tabStop: 1 }, limits: { overscan: 1, residentCap: 24 },
  // The root owns the rows and tells which one a contact is on. A press that ends on the row it began on chooses it.
  input: pointer,
  onRowPointer(notification) {
    if (notification.kind === 'begin') pressed = notification.key;
    else if (notification.kind === 'end') { if (pressed === notification.key) select(notification.key); pressed = undefined; }
    else if (notification.kind === 'cancel') pressed = undefined;
  },
});
const list = root.list('list');

// The details: a card of the managed UI with a summary and two buttons, shown as a modal layer.
const parts = {};
/** The content of a leaf: a rectangle the card paints again when its state changes. */
function leaf(id, height, paint) {
  return { revision: 0, prepare(context) {
    const content = context.scope.use(new DisplayObjectContainer()), sprite = content.addChild(context.scope.use(new Sprite()));
    sprite.touchEnabled = true; sprite.hitArea = { x: 0, y: 0, width: context.width, height };
    parts[id] = { sprite, width: context.width, height, paint: () => paint(sprite.graphics, context.width, height) };
    return { content, measuredHeight: height };
  } };
}
const buttonPaint = id => (graphics, width, height) => {
  const focus = keyboard.getSnapshot(), ringed = focus.focusVisible && focus.focusedId === 'details-' + id;
  graphics.clear();
  if (ringed) graphics.beginFill(PAINT.ring).drawRect(0, 0, width, height).endFill();
  graphics.beginFill(buttons[id]?.action.pressed || buttons[id]?.keys.pressed ? PAINT.held : PAINT.button).drawRect(ringed ? 3 : 0, ringed ? 3 : 0, width - (ringed ? 6 : 0), height - (ringed ? 6 : 0)).endFill();
};
const card = createUiRoot({
  engine, scope, id: 'details', viewport: { width: CARD.width, height: 150 }, density: 1, input: pointer, keyboard: { input: keyboard, idPrefix: 'details' },
  tree: { id: 'card', kind: 'column', explicitWidth: CARD.width, padding: CARD.padding, gap: CARD.gap, children: [
    { id: 'summary', kind: 'leaf', explicitWidth: CARD.inner, explicitHeight: 40, content: leaf('summary', 40, (graphics, width, height) => {
      // The row the card is about, drawn as the row is.
      graphics.clear(); graphics.beginFill(detail === selected ? PAINT.selected : PAINT.odd).drawRect(0, 0, width, height).endFill();
      for (let pip = 0; pip <= indexOf(detail) % 10; pip++) graphics.beginFill(PAINT.pip).drawRect(10 + pip * 10, 17, 6, 6).endFill();
    }) },
    { id: 'choose', kind: 'leaf', explicitWidth: CARD.inner, explicitHeight: 30, content: leaf('choose', 30, buttonPaint('choose')) },
    { id: 'close', kind: 'leaf', explicitWidth: CARD.inner, explicitHeight: 30, content: leaf('close', 30, buttonPaint('close')) },
  ] },
});
const layers = createUiLayerManager({ engine, scope, input: pointer, keyboard, viewport: { x: 0, y: 0, width: WIDTH, height: HEIGHT }, onInvalidate: () => { void publish(); } });
const layerOf = id => layers.snapshot().layers.find(layer => layer.id === id);
const detailsOpen = () => layerOf('details')?.visible === true;

// What the list is to someone who does not see it. The rows come and go with every commit; each says its
// place among the fifty thousand, and the row that holds the focus is always a node that exists.
const semantics = createUiSemantics();
const rows = createUiListSemantics({
  semantics, root, list: 'list', role: 'listbox', name: 'Servers / 服务器', focusable: true,
  describeRow: (key, index) => ({ name: 'Server ' + (index + 1) + ' / 服务器 ' + (index + 1), selected: key === selected }),
  onActivateRow: key => select(key),
});
// The dialog is a node of the application's own. It reads the layer and the card: hidden while the layer is
// closed, modal while it is open, and where the card was laid out. Its buttons are leaves of the card.
const labels = { choose: 'Choose this server / 选择这台服务器', close: 'Close / 关闭' };
semantics.add({ id: 'details', role: 'dialog', describe: () => ({ name: 'Server ' + (indexOf(detail) + 1) + ' / 服务器 ' + (indexOf(detail) + 1), modal: true, hidden: !detailsOpen(), bounds: semanticBoxOf(card, 'card') }) });
for (const id of ['choose', 'close']) semantics.add({ id: 'details/' + id, role: 'button', parent: 'details',
  onActivate: () => actions[id](), onFocus: () => keyboard.focus('details-' + id, { visible: true }),
  describe: () => ({ name: labels[id], bounds: semanticBoxOf(card, id), focused: keyboard.getSnapshot().focusedId === 'details-' + id }) });
const projection = createBrowserSemantics({ semantics, canvas, width: WIDTH, height: HEIGHT, label: 'Server list / 服务器列表', onError: fail });

/** Lays out what was asked, commits it, brings the semantic rows to the commit and shows the frame. One at a time. */
function publish() {
  const settle = async owner => {
    for (let round = 0; round < 8; round++) {
      const preparation = await owner.prepare();
      if (preparation.status === 'pending') continue;
      owner.commit(preparation);
      return;
    }
    throw new Error('The layout did not settle');
  };
  // Both roots are committed, then the layers are brought to what was asked of them.
  const run = async () => { await settle(root); await settle(card); if (layersReady) layers.sync(); };
  busy = busy.then(run).then(show, cause => { fail(cause); show(); });
  return busy;
}
function select(key) { selected = key; show(); }
/** Brings a row into view and gives it the keyboard. The focus is given after the commit that realizes the row. */
async function go(index, focus = true) {
  list.reveal(keyOf(index), { align: 'nearest' });
  await publish();
  if (focus && root.snapshot().rows.some(row => row.key === keyOf(index) && row.visible)) list.focus(keyOf(index), { visible: true });
  show();
}
const actions = { choose: () => { select(detail); closeDetails(); }, close: () => closeDetails() };
function openDetails(key) { detail = key; layers.open('details'); return publish(); }
function closeDetails() { layers.close('details'); return publish(); }
document.querySelector('#details').addEventListener('click', () => { canvas.focus(); void openDetails(selected); });
document.querySelector('#jump').addEventListener('click', () => { canvas.focus(); void go(39999); });
document.querySelector('#top').addEventListener('click', () => { void go(0, false); });

/** What a check reads: plain values only. */
export function readSnapshot() {
  const ui = root.snapshot(), focus = list.getFocus();
  return {
    selected, focus: focus.key, focusVisible: focus.focusVisible, committed: ui.committedRevision, scrollOffset: ui.scrollOffset,
    rows: ui.rows.filter(row => row.visible).map(row => ({ key: row.key, index: row.index, x: VIEW.x + row.box.x, y: VIEW.y + row.box.y, width: row.box.width, height: row.box.height })),
    realized: realized.size, records: ui.counters.recordCount, renders, failure,
    details: { open: detailsOpen(), of: detail, card: semanticBoxOf(card, 'card'), choose: semanticBoxOf(card, 'choose'), close: semanticBoxOf(card, 'close'), stack: [...layers.snapshot().openStack] },
    keyboard: keyboard.getSnapshot().focusedId,
    semantics: { revision: semantics.snapshot.revision, layoutRevision: semantics.snapshot.layoutRevision, focused: semantics.snapshot.focused, nodes: semantics.snapshot.nodes.length, held: semantics.size, projection: projection.state },
  };
}
function show() {
  if (scope.state !== 'open') return;
  for (const row of realized.values()) row.paint();
  for (const part of Object.values(parts)) part.paint();
  // Published with the frame that shows the same rows.
  try { semantics.publish(rows.sync()); } catch (cause) { fail(cause); }
  const snapshot = readSnapshot();
  status.textContent = failure ? 'Failed / 失败：' + failure
    : 'Selected / 已选：' + (indexOf(selected) + 1) + ' · Focus / 焦点：' + (snapshot.focus === undefined ? '—' : indexOf(snapshot.focus) + 1) + ' · Rows / 行：' + snapshot.rows.length + ' of / 共 ' + snapshot.records;
  stateView.textContent = JSON.stringify(snapshot, null, 2);
  engine.renderSharedFrame(frame); renders++;
}
globalThis.__egretUiListSemanticsExample = { readSnapshot, settled: () => busy };
// The first commit lays the card out. Its buttons then take a press, the keyboard and their usual keys,
// and the layers are registered: the list stays, the card opens over it.
await publish();
buttons = Object.fromEntries(['choose', 'close'].map(id => {
  const target = parts[id].sprite, action = createActionControl({ input: pointer, target, onActivate: () => actions[id](), onPressChange: () => show() });
  keyboard.registerTarget({ id: 'details-' + id, target });
  return [id, { action, keys: createControlKeys({ keyboard, target, kind: 'action', control: action, onPressChange: () => show() }) }];
}));
layers.register({ id: 'servers', root, kind: 'base' });
layers.register({ id: 'details', root: card, kind: 'modal', closeOnEscape: true, backdropColor: 0x000000, backdropAlpha: 0.5 });
layersReady = true;
await publish();
