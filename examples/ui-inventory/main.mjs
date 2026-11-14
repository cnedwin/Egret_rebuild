// SPDX-License-Identifier: Apache-2.0
// A bag of items: twenty-four slots in four rows of six, drawn by the application. The bag is one
// keyboard stop with a cursor that the arrow keys move in two directions; a press moves it too.
// Beside the bag are what the item under the cursor is and three buttons, and under it a line that
// says what happened. The semantic tree says the same as a grid of rows and cells, a group of
// text, a status message and buttons.
import { createEngineForProfile, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createTextRasterCache, createTextField } from '@egret/engine/text';
import { createActionControl, createControlKeys, createHoverControl } from '@egret/engine/ui';
import { createUiSemantics } from '@egret/engine/ui/semantics';
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { createBrowserSemantics } from '@egret/engine/web/semantics';
import { createBrowserHoverInput } from '@egret/engine/web/hover';
import { createBrowserPointerInput } from '@egret/engine/web/pointer';
import { createBrowserKeyboardInput } from '@egret/engine/web/keyboard';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 320, FAMILY = 'Arial', COLUMNS = 6, ROWS = 4, COUNT = COLUMNS * ROWS, CELL = 44, PITCH = 48, BAG = { x: 16, y: 44, width: COLUMNS * PITCH - 4, height: ROWS * PITCH - 4 };
const SIDE = { x: 316, y: 44, width: 148, height: 120 };
const COLORS = { page: 0x161a22, panel: 0x1f2633, slot: 0x3d4a63, slotEmpty: 0x252b38, slotHover: 0x56689a, chosen: 0x9aa7c4, button: 0x3d4a63, buttonHover: 0x56689a, buttonPressed: 0x27314a, buttonOff: 0x2a2d33,
  ink: 0xf3e9d2, hint: 0x9aa7c4, ring: 0xf2c14e };
const KINDS = {
  herb: { glyph: '草', zh: '灵草', en: 'Herb', usable: true, about: ['服用后恢复气血', 'Restores vigour'] },
  pill: { glyph: '丹', zh: '丹药', en: 'Pill', usable: true, about: ['服用后增长修为', 'Raises cultivation'] },
  iron: { glyph: '铁', zh: '精铁', en: 'Iron', usable: false, about: ['锻造兵器的材料', 'Material for the forge'] },
  stone: { glyph: '石', zh: '灵石', en: 'Stone', usable: false, about: ['门派通用的货币', 'The coin of the sect'] },
  manual: { glyph: '卷', zh: '功法', en: 'Manual', usable: true, about: ['研读后领悟招式', 'Teaches a technique'] },
};
// The model: what each slot holds, where the cursor is, and what happened last.
const slots = new Array(COUNT).fill(undefined);
for (const [index, kind, count] of [[0, 'herb', 12], [1, 'pill', 3], [3, 'iron', 7], [6, 'stone', 40], [8, 'manual', 1], [13, 'herb', 2], [20, 'pill', 1]]) slots[index] = { kind, count };
let cursor = 0, message = '', used = 0;
const nameOf = index => slots[index] === undefined ? '空 / Empty' : KINDS[slots[index].kind].zh + ' / ' + KINDS[slots[index].kind].en + ' × ' + slots[index].count;
const can = { use: () => slots[cursor] !== undefined && KINDS[slots[cursor].kind].usable, drop: () => slots[cursor] !== undefined, sort: () => slots.some((slot, index) => slot !== undefined && slots.slice(0, index).includes(undefined)) };

const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), stateView = document.querySelector('#state');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
const cache = createTextRasterCache(engine.assets, { provider: createCanvasTextRasterProvider() });
let renders = 0, failure, textQueue = Promise.resolve(), tidying = false;
const fail = cause => { failure = String(cause?.code ?? cause?.message ?? cause); };
const pointer = createBrowserPointerInput({ engine, scope, width: WIDTH, height: HEIGHT });
const hover = createBrowserHoverInput({ engine, scope, canvas, width: WIDTH, height: HEIGHT, onError: fail });
const keyboard = createBrowserKeyboardInput({ engine, scope, onFocusChange: () => queueMicrotask(show) });
const holds = id => keyboard.getSnapshot().focusedId === id;
const ringed = id => { const focus = keyboard.getSnapshot(); return focus.focusVisible && focus.focusedId === id; };

const page = engine.stage.addChild(scope.use(new Sprite()));
/**
 * A line of text that may change. The cache prepares four lines at a time at most, so the lines are prepared one after
 * another, and a line that changes again while it waits is prepared once more, with what it says last.
 */
function line(parent, x, y, fontSize, text, colour = COLORS.ink) {
  const field = createTextField(engine, scope, cache), entry = { wanted: text, shown: undefined, busy: false };
  field.x = x; field.y = y; parent.addChild(field);
  function write(next) {
    entry.wanted = next;
    if (entry.busy || entry.shown === next) return;
    entry.busy = true;
    textQueue = textQueue.then(async () => {
      while (entry.shown !== entry.wanted) {
        const now = entry.wanted;
        field.setRequest({ text: now === '' ? ' ' : now, fontFamily: FAMILY, fontSize, fontWeight: 400, fontStyle: 'normal', lineHeight: Math.round(fontSize * 1.3), locale: 'zh-CN', direction: 'ltr', density: 2, fillColor: colour });
        await field.prepare();
        entry.shown = now;
      }
    }).catch(fail).then(() => { entry.busy = false; show(); });
  }
  write(text);
  return write;
}

line(engine.stage, 16, 10, 18, '行囊 / Bag');
// The bag is one display object, which is what the keyboard stops at. Each slot inside it takes the pointer.
const bag = engine.stage.addChild(scope.use(new Sprite()));
bag.x = BAG.x; bag.y = BAG.y;
const boxOf = index => ({ x: BAG.x + (index % COLUMNS) * PITCH, y: BAG.y + Math.floor(index / COLUMNS) * PITCH, width: CELL, height: CELL });
const cells = slots.map((_, index) => {
  const frame = bag.addChild(scope.use(new Sprite())), face = bag.addChild(scope.use(new Sprite())), x = (index % COLUMNS) * PITCH, y = Math.floor(index / COLUMNS) * PITCH;
  frame.x = x - 2; frame.y = y - 2; face.x = x; face.y = y; face.touchEnabled = true; face.hitArea = { x: 0, y: 0, width: CELL, height: CELL };
  const pointed = createHoverControl({ hover, target: face, onHoverChange: () => show() });
  // A press moves the cursor to the slot and gives the bag the focus, without a ring.
  const held = createActionControl({ input: pointer, target: face, onActivate: () => { keyboard.focus('bag', { visible: false }); move(index); } });
  return { frame, face, pointed, held, glyph: line(bag, x + 11, y + 6, 20, ''), count: line(bag, x + 24, y + 28, 11, '', COLORS.hint) };
});
keyboard.registerTarget({ id: 'bag', target: bag, tabIndex: 1 });
// Enter and Space use the item under the cursor.
createControlKeys({ keyboard, target: bag, kind: 'action', control: { enabled: true, press() {}, release() { use(); } } });
// The cursor moves in two directions and stops at the edges. These keys are the bag's also at an edge: the page does not scroll under them.
const moves = {
  ArrowRight: at => at % COLUMNS < COLUMNS - 1 ? at + 1 : at, ArrowLeft: at => at % COLUMNS > 0 ? at - 1 : at,
  ArrowDown: at => at + COLUMNS < COUNT ? at + COLUMNS : at, ArrowUp: at => at >= COLUMNS ? at - COLUMNS : at,
  Home: (at, whole) => whole ? 0 : at - at % COLUMNS, End: (at, whole) => whole ? COUNT - 1 : at - at % COLUMNS + COLUMNS - 1,
  PageUp: at => at % COLUMNS, PageDown: at => COUNT - COLUMNS + at % COLUMNS,
};
bag.on(keyboard.events.keyDown, event => {
  const { code, ctrlKey, altKey, metaKey } = event.payload;
  if (event.defaultPrevented || altKey || metaKey || !Object.hasOwn(moves, code) || (ctrlKey && code !== 'Home' && code !== 'End')) return;
  // A key that moves the cursor also shows where it is, as Tab does.
  event.preventDefault(); if (!keyboard.getSnapshot().focusVisible) keyboard.focus('bag', { visible: true }); move(moves[code](cursor, ctrlKey));
});

const about = [line(engine.stage, SIDE.x + 10, SIDE.y + 8, 15, ''), line(engine.stage, SIDE.x + 10, SIDE.y + 36, 12, '', COLORS.hint), line(engine.stage, SIDE.x + 10, SIDE.y + 56, 12, '', COLORS.hint)];
const said = line(engine.stage, BAG.x, BAG.y + BAG.height + 12, 14, '', COLORS.hint);
function button(id, y, text, tabIndex, act) {
  const box = { x: SIDE.x, y, width: SIDE.width, height: 28 }, ring = engine.stage.addChild(scope.use(new Sprite())), face = engine.stage.addChild(scope.use(new Sprite()));
  ring.x = box.x - 3; ring.y = box.y - 3; face.x = box.x; face.y = box.y; face.touchEnabled = true; face.hitArea = { x: 0, y: 0, width: box.width, height: box.height };
  line(engine.stage, box.x + 12, box.y + 5, 14, text);
  const part = { id, box, ring, face, text, off: false, pointed: createHoverControl({ hover, target: face, onHoverChange: () => show() }),
    control: createActionControl({ input: pointer, target: face, onActivate: act, onPressChange: () => show() }), stop: keyboard.registerTarget({ id, target: face, tabIndex }) };
  part.keys = createControlKeys({ keyboard, target: face, kind: 'action', control: part.control, onPressChange: () => show() });
  return part;
}
const buttons = { use: button('use', 176, '使用 / Use', 2, use), drop: button('drop', 210, '丢弃 / Drop', 3, drop), sort: button('sort', 244, '整理 / Sort', 4, sort) };

function move(index) { if (index !== cursor) { cursor = index; message = ''; } show(); }
/** Uses one of the item under the cursor. What cannot be used says so and stays. */
function use() {
  const slot = slots[cursor];
  if (slot === undefined) return;
  const kind = KINDS[slot.kind];
  if (!kind.usable) message = kind.zh + '不能直接使用 / ' + kind.en + ' cannot be used as it is';
  else { used++; message = '用了一份' + kind.zh + ' / Used one ' + kind.en; if (--slot.count === 0) slots[cursor] = undefined; }
  show();
}
function drop() {
  const slot = slots[cursor];
  if (slot === undefined) return;
  message = '丢弃了' + KINDS[slot.kind].zh + ' / Dropped ' + KINDS[slot.kind].en; slots[cursor] = undefined; show();
}
/** Closes the gaps: what the bag holds moves to the front in the order it was in. The cursor stays where it is. */
function sort() {
  const held = slots.filter(slot => slot !== undefined);
  for (let index = 0; index < COUNT; index++) slots[index] = held[index];
  message = '整理好了 / Sorted'; show();
}

// What the screen is to someone who does not see it.
const semantics = createUiSemantics();
semantics.add({ id: 'bag', role: 'grid', describe: () => ({ name: '行囊 / Bag', bounds: BAG, extent: { rows: ROWS, columns: COLUMNS } }) });
for (let row = 0; row < ROWS; row++) semantics.add({ id: 'bag/r' + row, role: 'row', parent: 'bag',
  describe: () => ({ bounds: { x: BAG.x, y: BAG.y + row * PITCH, width: BAG.width, height: CELL }, position: { index: row + 1, size: ROWS } }) });
for (let index = 0; index < COUNT; index++) semantics.add({ id: 'bag/' + index, role: 'gridcell', parent: 'bag/r' + Math.floor(index / COLUMNS),
  onActivate: () => move(index),
  // A cell that is asked to take the focus gets the cursor, and the bag the focus.
  onFocus: () => { keyboard.focus('bag', { visible: true }); move(index); },
  describe: () => ({ name: nameOf(index), bounds: boxOf(index), selected: cursor === index, position: { index: index % COLUMNS + 1, size: COLUMNS }, focused: holds('bag') && cursor === index }) });
semantics.add({ id: 'details', role: 'group', describe: () => ({ name: '详情 / Details', bounds: SIDE }) });
for (const [index, y] of [[0, 8], [1, 36], [2, 56]]) semantics.add({ id: 'details/' + index, role: 'text', parent: 'details',
  describe: () => ({ name: detail()[index], hidden: detail()[index] === '', bounds: { x: SIDE.x + 10, y: SIDE.y + y, width: SIDE.width - 20, height: 18 } }) });
// The message is in the tree from the start, empty: a reader says it when its text changes.
semantics.add({ id: 'said', role: 'status', describe: () => ({ name: message, bounds: { x: BAG.x, y: BAG.y + BAG.height + 12, width: BAG.width, height: 18 } }) });
for (const [id, part] of Object.entries(buttons)) semantics.add({ id, role: 'button', onActivate: () => { part.control.press(); part.control.release(); }, onFocus: () => keyboard.focus(id, { visible: true }),
  describe: () => ({ name: part.text, bounds: part.box, disabled: !part.control.enabled, focused: holds(id) }) });
const projection = createBrowserSemantics({ semantics, canvas, width: WIDTH, height: HEIGHT, label: 'Bag / 行囊', onError: fail });

/** The three lines beside the bag: what the item under the cursor is, and what it is for. */
function detail() { const slot = slots[cursor]; return slot === undefined ? ['空 / Empty', '', ''] : [nameOf(cursor), ...KINDS[slot.kind].about]; }
/**
 * A button that is disabled is no stop of the keyboard, and one that held the focus gives it to the bag. A key may be
 * what disabled it, and the stops are not changed from inside a key: this runs after it.
 */
function tidy() {
  tidying = false;
  if (scope.state !== 'open') return;
  for (const part of Object.values(buttons)) if (part.off === part.control.enabled) {
    part.off = !part.control.enabled;
    if (part.off && holds(part.id)) keyboard.focus('bag', { visible: keyboard.getSnapshot().focusVisible });
    part.stop.update({ disabled: part.off });
  }
  show();
}
/** What a check reads: plain values only. */
export function readSnapshot() {
  const focus = keyboard.getSnapshot();
  return { slots: slots.map(slot => slot === undefined ? null : slot.kind + ' ' + slot.count), cursor, message, used, focus: focus.focusedId, focusVisible: focus.focusVisible,
    enabled: Object.fromEntries(Object.entries(buttons).map(([id, part]) => [id, part.control.enabled])), hovered: cells.flatMap((cell, index) => cell.pointed.hovered ? [index] : []),
    renders, failure, semantics: { focused: semantics.snapshot.focused, nodes: semantics.snapshot.nodes.length, projection: projection.state } };
}
function show() {
  if (scope.state !== 'open') return;
  for (const [id, part] of Object.entries(buttons)) if (part.control.enabled !== can[id]()) part.control.setEnabled(can[id]());
  if (!tidying && Object.values(buttons).some(part => part.off === part.control.enabled)) { tidying = true; queueMicrotask(tidy); }
  page.graphics.clear(); page.graphics.beginFill(COLORS.page).drawRect(0, 0, WIDTH, HEIGHT).beginFill(COLORS.panel).drawRect(BAG.x - 6, BAG.y - 6, BAG.width + 12, BAG.height + 12)
    .beginFill(COLORS.panel).drawRect(SIDE.x, SIDE.y, SIDE.width, SIDE.height).endFill();
  for (const [index, cell] of cells.entries()) {
    const slot = slots[index];
    // The cursor is framed: brightly while the keyboard shows where it is, quietly otherwise.
    cell.frame.visible = index === cursor; cell.frame.graphics.clear(); cell.frame.graphics.beginFill(ringed('bag') ? COLORS.ring : COLORS.chosen).drawRect(0, 0, CELL + 4, CELL + 4).endFill();
    cell.face.graphics.clear(); cell.face.graphics.beginFill(cell.pointed.hovered ? COLORS.slotHover : slot === undefined ? COLORS.slotEmpty : COLORS.slot).drawRect(0, 0, CELL, CELL).endFill();
    cell.glyph(slot === undefined ? '' : KINDS[slot.kind].glyph); cell.count(slot === undefined ? '' : String(slot.count));
  }
  for (const [index, write] of about.entries()) write(detail()[index]);
  said(message);
  for (const [id, part] of Object.entries(buttons)) {
    part.ring.visible = ringed(id); part.ring.graphics.clear(); part.ring.graphics.beginFill(COLORS.ring).drawRect(0, 0, part.box.width + 6, part.box.height + 6).endFill();
    const fill = !part.control.enabled ? COLORS.buttonOff : part.control.pressed || part.keys.pressed ? COLORS.buttonPressed : part.pointed.hovered ? COLORS.buttonHover : COLORS.button;
    part.face.graphics.clear(); part.face.graphics.beginFill(fill).drawRect(0, 0, part.box.width, part.box.height).endFill();
  }
  try { semantics.publish(); } catch (cause) { fail(cause); }
  status.textContent = failure ? 'Failed / 失败：' + failure : nameOf(cursor) + (message === '' ? '' : ' · ' + message);
  stateView.textContent = JSON.stringify(readSnapshot(), null, 2);
  engine.renderSharedFrame(drawn); renders++;
}
const drawn = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x000000, clearAlpha: 1 });
/** Resolves once every line of text that was asked for is drawn. */
async function settled() { let seen; do { seen = textQueue; await seen; } while (seen !== textQueue); }
globalThis.__egretUiInventoryExample = { readSnapshot, settled };
show();
