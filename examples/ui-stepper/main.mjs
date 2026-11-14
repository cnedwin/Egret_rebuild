// SPDX-License-Identifier: Apache-2.0
// Amounts changed by steps, drawn by the application. A hundred spirit stones are shared among four
// halls. Each amount is a spin button: one keyboard stop with the keys of a range, and a button on
// either side for a pointer. A line under the halls says how many stones are left, and another says
// why an amount did not go up. The semantic tree says the same with spin buttons, a status message
// and an alert.
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

const WIDTH = 480, HEIGHT = 320, FAMILY = 'Arial', TOTAL = 100, STEP = 5, PAGE = 4, TOP = 50, PITCH = 44;
const COLORS = { page: 0x161a22, panel: 0x1f2633, field: 0x10141b, button: 0x3d4a63, buttonHover: 0x56689a, buttonPressed: 0x27314a, buttonOff: 0x2a2d33, ink: 0xf3e9d2, hint: 0x9aa7c4, warn: 0xe07a5f, ring: 0xf2c14e };
const HALLS = [{ key: 'alchemy', zh: '丹房', en: 'Alchemy' }, { key: 'forge', zh: '器坊', en: 'Forge' }, { key: 'library', zh: '藏经阁', en: 'Library' }, { key: 'yard', zh: '演武场', en: 'Yard' }].map(hall => ({ ...hall, name: hall.zh + ' / ' + hall.en }));
// The model: what each hall has, and why the last change was refused, if it was.
const amounts = Object.fromEntries(HALLS.map(({ key }) => [key, 0]));
let fault = '';
const left = () => TOTAL - HALLS.reduce((sum, { key }) => sum + amounts[key], 0);
const leftText = () => left() === 0 ? '已分完 / All shared out' : '剩余 ' + left() + ' / ' + left() + ' left';

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
 * another, and a line that changes again while it waits is prepared once, with what it says last.
 */
function line(x, y, fontSize, text, colour = COLORS.ink) {
  const field = createTextField(engine, scope, cache), entry = { wanted: text, shown: undefined, busy: false };
  field.x = x; field.y = y; engine.stage.addChild(field);
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
function surface(box) {
  const ring = engine.stage.addChild(scope.use(new Sprite())), sprite = engine.stage.addChild(scope.use(new Sprite()));
  ring.x = box.x - 3; ring.y = box.y - 3; sprite.x = box.x; sprite.y = box.y; sprite.touchEnabled = true; sprite.hitArea = { x: 0, y: 0, width: box.width, height: box.height };
  return { box, sprite, ring, hover: createHoverControl({ hover, target: sprite, onHoverChange: () => show() }),
    paint(fill, focused) {
      ring.visible = focused; ring.graphics.clear(); ring.graphics.beginFill(COLORS.ring).drawRect(0, 0, box.width + 6, box.height + 6).endFill();
      sprite.graphics.clear(); sprite.graphics.beginFill(fill).drawRect(0, 0, box.width, box.height).endFill();
    } };
}
/** A button for a pointer: its face, its control, and what it says while it has nothing to do. */
function button(box, text, onActivate, can) {
  const part = surface(box), control = createActionControl({ input: pointer, target: part.sprite, onActivate, onPressChange: () => show() });
  line(box.x + Math.round((box.width - text.length * (text.length === 1 ? 9 : 7.4)) / 2), box.y + Math.round((box.height - 19) / 2), 14, text);
  return { ...part, control, can, keys: undefined, stop: undefined, off: false };
}

/**
 * One change of one amount. An amount is never below nothing and never takes more than is left. A change that would
 * have taken more is refused in part or whole, and says why. Returns whether the amount changed.
 */
function change(key, wanted) {
  const next = Math.max(0, Math.min(wanted, amounts[key] + left()));
  fault = wanted > next ? '灵石不足 / Not enough stones' : '';
  const changed = next !== amounts[key];
  amounts[key] = next;
  show();
  return changed;
}

line(20, 10, 18, '分配灵石 / Share the stones');
const halls = Object.fromEntries(HALLS.map(({ key, name }, index) => {
  const y = TOP + index * PITCH, id = 'amount-' + key;
  line(20, y + 6, 15, name);
  // What the keys of a range call. The far end of an amount is everything that is left.
  const amount = { enabled: true, stepBy: steps => change(key, amounts[key] + steps * STEP), toMin: () => change(key, 0), toMax: () => change(key, amounts[key] + left()) };
  const less = button({ x: 232, y, width: 32, height: 32 }, '−', () => { keyboard.focus(id, { visible: false }); amount.stepBy(-1); }, () => amounts[key] > 0);
  const value = surface({ x: 270, y, width: 64, height: 32 });
  const more = button({ x: 340, y, width: 32, height: 32 }, '+', () => { keyboard.focus(id, { visible: false }); amount.stepBy(1); }, () => amounts[key] < TOTAL);
  const write = line(value.box.x + 10, y + 6, 15, '0');
  // The amount is the keyboard stop. Up and Down move it by a step, Page Up and Page Down by four, Home and End to its ends.
  keyboard.registerTarget({ id, target: value.sprite, tabIndex: index + 1 });
  createControlKeys({ keyboard, target: value.sprite, kind: 'range', control: amount, orientation: 'vertical', page: PAGE });
  return [key, { id, name, amount, less, value, more, write }];
}));
const messageY = TOP + HALLS.length * PITCH + 4;
const writeLeft = line(20, messageY, 15, leftText(), COLORS.hint), writeFault = line(20, messageY + 24, 15, '', COLORS.warn);
const even = button({ x: 20, y: 276, width: 120, height: 30 }, '均分 / Even', () => { for (const { key } of HALLS) amounts[key] = TOTAL / HALLS.length; fault = ''; show(); }, () => HALLS.some(({ key }) => amounts[key] !== TOTAL / HALLS.length));
const reset = button({ x: 150, y: 276, width: 120, height: 30 }, '重置 / Reset', () => { for (const { key } of HALLS) amounts[key] = 0; fault = ''; show(); }, () => left() !== TOTAL);
const buttons = { even, reset };
for (const [index, id] of ['even', 'reset'].entries()) {
  buttons[id].stop = keyboard.registerTarget({ id, target: buttons[id].sprite, tabIndex: HALLS.length + 1 + index });
  buttons[id].keys = createControlKeys({ keyboard, target: buttons[id].sprite, kind: 'action', control: buttons[id].control, onPressChange: () => show() });
}

// What the screen is to someone who does not see it.
const semantics = createUiSemantics();
for (const { key, name, zh, en } of HALLS) {
  const hall = halls[key];
  semantics.add({ id: hall.id, role: 'spinbutton', onFocus: () => keyboard.focus(hall.id, { visible: true }),
    describe: () => ({ name, bounds: hall.value.box, range: { now: amounts[key], min: 0, max: TOTAL }, focused: holds(hall.id) }) });
  // The two buttons are for a pointer, and for assistive technology that activates and has no keys.
  for (const [side, label, steps] of [['less', '减少' + zh + ' / Less ' + en, -1], ['more', '增加' + zh + ' / More ' + en, 1]]) semantics.add({ id: side + '-' + key, role: 'button',
    onActivate: () => { if (hall[side].control.enabled) hall.amount.stepBy(steps); },
    describe: () => ({ name: label, bounds: hall[side].box, disabled: !hall[side].control.enabled }) });
}
// The two messages are in the tree from the start, empty or not: a reader says a message when the text of a node it knows changes.
semantics.add({ id: 'left', role: 'status', describe: () => ({ name: leftText(), bounds: { x: 20, y: messageY, width: 300, height: 20 } }) });
semantics.add({ id: 'fault', role: 'alert', describe: () => ({ name: fault, bounds: { x: 20, y: messageY + 24, width: 300, height: 20 } }) });
for (const [id, name] of [['even', '均分 / Even'], ['reset', '重置 / Reset']]) semantics.add({ id, role: 'button',
  onActivate: () => { buttons[id].control.press(); buttons[id].control.release(); }, onFocus: () => keyboard.focus(id, { visible: true }),
  describe: () => ({ name, bounds: buttons[id].box, disabled: !buttons[id].control.enabled, focused: holds(id) }) });
const projection = createBrowserSemantics({ semantics, canvas, width: WIDTH, height: HEIGHT, label: 'Stones / 灵石', onError: fail });

/** What a check reads: plain values only. */
export function readSnapshot() {
  const focus = keyboard.getSnapshot();
  return { amounts: { ...amounts }, left: left(), fault, focus: focus.focusedId, focusVisible: focus.focusVisible,
    enabled: Object.fromEntries([...HALLS.flatMap(({ key }) => [['less-' + key, halls[key].less.control.enabled], ['more-' + key, halls[key].more.control.enabled]]), ['even', even.control.enabled], ['reset', reset.control.enabled]]),
    renders, failure, semantics: { focused: semantics.snapshot.focused, nodes: semantics.snapshot.nodes.length, projection: projection.state } };
}
/**
 * Keeps a button that is disabled out of the Tab order, and one that held the focus gives it to the first amount.
 * A key may be what disabled it, and the stops of the keyboard are not changed from inside a key: this runs after it.
 */
function tidy() {
  tidying = false;
  if (scope.state !== 'open') return;
  for (const id of ['even', 'reset']) {
    const part = buttons[id], off = !part.control.enabled;
    if (part.off === off) continue;
    if (off && holds(id)) keyboard.focus(halls[HALLS[0].key].id, { visible: keyboard.getSnapshot().focusVisible });
    part.stop.update({ disabled: off }); part.off = off;
  }
  show();
}
const face = part => !part.control.enabled ? COLORS.buttonOff : part.control.pressed || part.keys?.pressed ? COLORS.buttonPressed : part.hover.hovered ? COLORS.buttonHover : COLORS.button;
function show() {
  if (scope.state !== 'open') return;
  // A button that has nothing to do is disabled.
  for (const part of [...HALLS.flatMap(({ key }) => [halls[key].less, halls[key].more]), even, reset]) if (part.control.enabled !== part.can()) part.control.setEnabled(part.can());
  if (!tidying && [even, reset].some(part => part.off === part.control.enabled)) { tidying = true; queueMicrotask(tidy); }
  page.graphics.clear(); page.graphics.beginFill(COLORS.page).drawRect(0, 0, WIDTH, HEIGHT).beginFill(COLORS.panel).drawRect(12, TOP - 8, 372, HALLS.length * PITCH + 4).endFill();
  for (const { key } of HALLS) {
    const hall = halls[key];
    hall.less.paint(face(hall.less), false); hall.more.paint(face(hall.more), false);
    hall.value.paint(COLORS.field, ringed(hall.id)); hall.write(String(amounts[key]));
  }
  even.paint(face(even), ringed('even')); reset.paint(face(reset), ringed('reset'));
  writeLeft(leftText()); writeFault(fault);
  try { semantics.publish(); } catch (cause) { fail(cause); }
  status.textContent = failure ? 'Failed / 失败：' + failure : HALLS.map(({ key, zh }) => zh + ' ' + amounts[key]).join(' · ') + ' · ' + leftText();
  stateView.textContent = JSON.stringify(readSnapshot(), null, 2);
  engine.renderSharedFrame(drawn); renders++;
}
const drawn = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x000000, clearAlpha: 1 });
/** Resolves once every line of text that was asked for is drawn. */
async function settled() { let seen; do { seen = textQueue; await seen; } while (seen !== textQueue); }
globalThis.__egretUiStepperExample = { readSnapshot, settled };
show();
