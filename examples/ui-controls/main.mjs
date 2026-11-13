// SPDX-License-Identifier: Apache-2.0
// A switch, a group of three options and a button, drawn by the engine in each of their states.
// The controls of `@egret/engine/ui` hold the state; this page paints it, binds the keys, and
// describes the same controls to assistive technology.
import { createEngineForProfile, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createActionControl, createHoverControl, createSelectionGroup, createToggleControl } from '@egret/engine/ui';
import { createUiSemantics } from '@egret/engine/ui/semantics';
import { createBrowserHoverInput } from '@egret/engine/web/hover';
import { createBrowserSemantics } from '@egret/engine/web/semantics';
import { createBrowserPointerInput } from '@egret/engine/web/pointer';
import { createBrowserKeyboardInput } from '@egret/engine/web/keyboard';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 300;
const PAINT = { idle: 0x3d4a63, hover: 0x56689a, pressed: 0x27314a, on: 0x2f8f6b, onHover: 0x3fae84, disabled: 0x2a2d33, ring: 0xf2c14e, mark: 0xe9edf5, markOff: 0x7f8aa3 };
const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), stateView = document.querySelector('#state');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
const frame = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x161a22, clearAlpha: 1 });
let renders = 0, failure;
const fail = cause => { failure = String(cause?.code ?? cause); };
const pointer = createBrowserPointerInput({ engine, scope, width: WIDTH, height: HEIGHT });
const hover = createBrowserHoverInput({ engine, scope, canvas, width: WIDTH, height: HEIGHT, onError: fail });
const keyboard = createBrowserKeyboardInput({ engine, scope, onFocusChange: () => queueMicrotask(show) });

/** A surface of a control: a focus ring behind a filled rectangle that can be pointed at. */
function surface(x, y, width, height) {
  const ring = engine.stage.addChild(scope.use(new Sprite())), sprite = engine.stage.addChild(scope.use(new Sprite())), mark = sprite.addChild(scope.use(new Sprite()));
  ring.x = x - 3; ring.y = y - 3; sprite.x = x; sprite.y = y; sprite.touchEnabled = true; sprite.hitArea = { x: 0, y: 0, width, height };
  ring.graphics.beginFill(PAINT.ring).drawRect(0, 0, width + 6, height + 6).endFill();
  return { sprite, ring, mark, width, height };
}
/** The colour of a state, in the order a player reads it: unavailable, held, pointed at, set. */
function fill(state) {
  if (!state.enabled) return PAINT.disabled;
  if (state.pressed) return PAINT.pressed;
  if (state.on) return state.hovered ? PAINT.onHover : PAINT.on;
  return state.hovered ? PAINT.hover : PAINT.idle;
}
function paint(part, state, focused) {
  part.sprite.graphics.clear(); part.sprite.graphics.beginFill(fill(state)).drawRect(0, 0, part.width, part.height).endFill();
  part.ring.visible = focused;
  // The mark sits right when the control is on, left when it is off.
  part.mark.graphics.clear(); part.mark.graphics.beginFill(state.on ? PAINT.mark : PAINT.markOff).drawRect(state.on ? part.width - 22 : 8, part.height / 2 - 7, 14, 14).endFill();
}

const parts = { sound: surface(40, 40, 140, 44), easy: surface(40, 120, 120, 44), normal: surface(180, 120, 120, 44), hard: surface(320, 120, 120, 44), apply: surface(40, 200, 140, 44) };
const levels = ['easy', 'normal', 'hard'], changes = [];
const sound = createToggleControl({ input: pointer, target: parts.sound.sprite, checked: true, onChange: () => show(), onPressChange: () => show() });
const level = createSelectionGroup({ input: pointer, items: levels.map(key => ({ key, target: parts[key].sprite })), selected: 'normal', onChange: (selected, previous) => { changes.push([selected, previous]); followSelection(); show(); } });
const apply = createActionControl({ input: pointer, target: parts.apply.sprite, onActivate: () => show(), onPressChange: () => show() });
const hovered = Object.fromEntries(Object.entries(parts).map(([name, part]) => [name, createHoverControl({ hover, target: part.sprite, onHoverChange: () => show() })]));

// Keys reach the same methods a pointer reaches. Space or Enter activates when the key is released,
// and the key down is taken so that the page does not scroll.
const stops = { sound: parts.sound.sprite, level: parts.normal.sprite, apply: parts.apply.sprite };
const registrations = Object.fromEntries(Object.entries(stops).map(([id, target]) => [id, keyboard.registerTarget({ id, target })]));
const activates = code => code === 'Space' || code === 'Enter' || code === 'NumpadEnter';
for (const [target, activate] of [[stops.sound, () => sound.toggle()], [stops.apply, () => { apply.press(); apply.release(); }]]) {
  target.on(keyboard.events.keyDown, event => { if (activates(event.payload.code)) event.preventDefault(); });
  target.on(keyboard.events.keyUp, event => { if (activates(event.payload.code)) { event.preventDefault(); activate(); } });
}
const moves = { ArrowRight: 'next', ArrowDown: 'next', ArrowLeft: 'previous', ArrowUp: 'previous', Home: 'first', End: 'last' };
// The group is one stop. Its keys arrive at whichever option holds the focus, so every option listens.
for (const key of levels) parts[key].sprite.on(keyboard.events.keyDown, event => {
  const action = moves[event.payload.code];
  if (action === undefined) return;
  event.preventDefault(); level[action]();
});
// The focus follows the selection, as it does in a native radio group. The stop is moved after the key that
// changed the selection has been delivered.
function followSelection() { queueMicrotask(() => { registrations.level.update({ target: parts[level.selected].sprite }); show(); }); }

// What the controls are to someone who does not see them. Each node reads the control that is drawn, at
// every publication, and its actions are the ones a press and a key already reach.
const semantics = createUiSemantics();
const area = part => ({ x: part.sprite.x, y: part.sprite.y, width: part.width, height: part.height });
const holds = id => keyboard.getSnapshot().focusedId === id;
const names = { easy: 'Easy / 简单', normal: 'Normal / 普通', hard: 'Hard / 困难' };
semantics.add({ id: 'panel', role: 'group', describe: () => ({ name: 'Settings / 设置', bounds: { x: 0, y: 0, width: WIDTH, height: HEIGHT } }) });
semantics.add({ id: 'sound', role: 'switch', parent: 'panel', onActivate: () => sound.toggle(), onFocus: () => keyboard.focus('sound', { visible: true }),
  describe: () => ({ name: 'Sound / 声音', bounds: area(parts.sound), checked: sound.checked, disabled: !sound.enabled, focused: holds('sound') }) });
semantics.add({ id: 'level', role: 'radiogroup', parent: 'panel', describe: () => ({ name: 'Level / 难度', bounds: { x: 40, y: 120, width: 400, height: 44 }, disabled: !level.enabled }) });
for (const [index, key] of levels.entries()) semantics.add({ id: 'level-' + key, role: 'radio', parent: 'level',
  onActivate: () => { level.select(key); },
  // The group is one stop of the keyboard: the focus goes to the option that is selected.
  onFocus: () => keyboard.focus('level', { visible: true }),
  describe: () => ({ name: names[key], bounds: area(parts[key]), checked: level.selected === key, disabled: !level.enabled || !level.isItemEnabled(key),
    focused: holds('level') && level.selected === key, position: { index: index + 1, size: levels.length } }) });
semantics.add({ id: 'apply', role: 'button', parent: 'panel', onActivate: () => { apply.press(); apply.release(); }, onFocus: () => keyboard.focus('apply', { visible: true }),
  describe: () => ({ name: 'Apply / 应用', bounds: area(parts.apply), disabled: !apply.enabled, focused: holds('apply') }) });
const projection = createBrowserSemantics({ semantics, canvas, width: WIDTH, height: HEIGHT, label: 'Control states / 控件状态', onError: fail });

let everything = true;
document.querySelector('#disable-hard').addEventListener('click', () => { level.setItemEnabled('hard', !level.isItemEnabled('hard')); show(); });
document.querySelector('#disable-all').addEventListener('click', () => {
  everything = !everything;
  sound.setEnabled(everything); level.setEnabled(everything); apply.setEnabled(everything);
  for (const control of Object.values(hovered)) control.setEnabled(everything);
  for (const registration of Object.values(registrations)) registration.update({ disabled: !everything });
  show();
});

/** What a check reads: plain values only. */
export function readSnapshot() {
  const focus = keyboard.getSnapshot();
  return {
    sound: { checked: sound.checked, pressed: sound.pressed, enabled: sound.enabled },
    level: { selected: level.selected, enabled: level.enabled, items: Object.fromEntries(levels.map(key => [key, level.isItemEnabled(key)])), changes: [...changes] },
    apply: { pressed: apply.pressed, activations: apply.activationCount, enabled: apply.enabled },
    hovered: Object.entries(hovered).filter(([, control]) => control.hovered).map(([name]) => name),
    focus: focus.focusVisible ? focus.focusedId : undefined, focused: focus.focusedId, renders, failure,
    semantics: { revision: semantics.snapshot.revision, focused: semantics.snapshot.focused, nodes: semantics.snapshot.nodes.length, projection: projection.state },
  };
}
function show() {
  const focus = keyboard.getSnapshot(), ringed = focus.focusVisible ? focus.focusedId : undefined;
  paint(parts.sound, { enabled: sound.enabled, pressed: sound.pressed, hovered: hovered.sound.hovered, on: sound.checked }, ringed === 'sound');
  for (const key of levels) paint(parts[key], { enabled: level.enabled && level.isItemEnabled(key), pressed: false, hovered: hovered[key].hovered, on: level.selected === key }, ringed === 'level' && level.selected === key);
  paint(parts.apply, { enabled: apply.enabled, pressed: apply.pressed, hovered: hovered.apply.hovered, on: false }, ringed === 'apply');
  // Published with the frame that shows the same state.
  semantics.publish();
  const snapshot = readSnapshot();
  status.textContent = failure ? 'Failed / 失败：' + failure : 'Sound / 声音：' + (snapshot.sound.checked ? 'on / 开' : 'off / 关') + ' · Level / 难度：' + snapshot.level.selected + ' · Applied / 已应用：' + snapshot.apply.activations;
  stateView.textContent = JSON.stringify(snapshot, null, 2);
  if (scope.state === 'open') { engine.renderSharedFrame(frame); renders++; }
}
globalThis.__egretUiControlsExample = { readSnapshot };
show();
