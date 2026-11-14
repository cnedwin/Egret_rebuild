// SPDX-License-Identifier: Apache-2.0
// A switch, a group of three options and a button, drawn by the engine in each of their states.
// The controls of `@egret/engine/ui` hold the state; this page paints it, binds the keys, and
// describes the same controls to assistive technology. A gamepad drives the same keys.
import { createEngineForProfile, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createActionControl, createControlKeys, createHoverControl, createSelectionGroup, createToggleControl, createUiTheme, selectUiSkin } from '@egret/engine/ui';
import { createUiSemantics } from '@egret/engine/ui/semantics';
import { createBrowserHoverInput } from '@egret/engine/web/hover';
import { createBrowserSemantics } from '@egret/engine/web/semantics';
import { createBrowserPointerInput } from '@egret/engine/web/pointer';
import { createBrowserKeyboardInput } from '@egret/engine/web/keyboard';
import { bindGamepadKeys } from '@egret/engine/input/gamepad';
import { createBrowserGamepadInput } from '@egret/engine/web/gamepad';
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
function surface(x, y, width, height, parent = engine.stage) {
  const ring = parent.addChild(scope.use(new Sprite())), sprite = parent.addChild(scope.use(new Sprite())), mark = sprite.addChild(scope.use(new Sprite()));
  ring.x = x - 3; ring.y = y - 3; sprite.x = x; sprite.y = y; sprite.touchEnabled = true; sprite.hitArea = { x: 0, y: 0, width, height };
  ring.graphics.beginFill(PAINT.ring).drawRect(0, 0, width + 6, height + 6).endFill();
  return { sprite, ring, mark, width, height };
}
// What each state looks like is the theme's: a skin names a paint for each state it has one for. A control
// that is set has a skin of its own, so that it stays set under the pointer.
const theme = createUiTheme({ id: 'controls', colors: { idle: PAINT.idle, hover: PAINT.hover, pressed: PAINT.pressed, on: PAINT.on, onHover: PAINT.onHover, disabled: PAINT.disabled },
  skins: { control: { default: 'idle', hover: 'hover', pressed: 'pressed', disabled: 'disabled' }, controlOn: { default: 'on', hover: 'onHover', pressed: 'pressed', disabled: 'disabled' } } });
/** The colour of a state. `selectUiSkin` reads the states in the order a player does: unavailable, held, pointed at. */
function fill(state) {
  return theme.colors[selectUiSkin(theme.skins[state.on ? 'controlOn' : 'control'], { disabled: !state.enabled, pressed: state.pressed, hover: state.hovered })];
}
function paint(part, state, focused) {
  part.sprite.graphics.clear(); part.sprite.graphics.beginFill(fill(state)).drawRect(0, 0, part.width, part.height).endFill();
  part.ring.visible = focused;
  // The mark sits right when the control is on, left when it is off.
  part.mark.graphics.clear(); part.mark.graphics.beginFill(state.on ? PAINT.mark : PAINT.markOff).drawRect(state.on ? part.width - 22 : 8, part.height / 2 - 7, 14, 14).endFill();
}

// The three options are inside one display object, which is what the keyboard stops at.
const group = engine.stage.addChild(scope.use(new Sprite()));
const parts = { sound: surface(40, 40, 140, 44), easy: surface(40, 120, 120, 44, group), normal: surface(180, 120, 120, 44, group), hard: surface(320, 120, 120, 44, group), apply: surface(40, 200, 140, 44) };
const levels = ['easy', 'normal', 'hard'], changes = [];
const sound = createToggleControl({ input: pointer, target: parts.sound.sprite, checked: true, onChange: () => show(), onPressChange: () => show() });
const level = createSelectionGroup({ input: pointer, items: levels.map(key => ({ key, target: parts[key].sprite })), selected: 'normal', onChange: (selected, previous) => { changes.push([selected, previous]); show(); } });
// Applying is felt on a pad that can shake.
const apply = createActionControl({ input: pointer, target: parts.apply.sprite, onActivate: () => { for (const pad of pads.input.pads) pads.rumble(pad.index, { duration: 80 }); show(); }, onPressChange: () => show() });
const hovered = Object.fromEntries(Object.entries(parts).map(([name, part]) => [name, createHoverControl({ hover, target: part.sprite, onHoverChange: () => show() })]));

// Keys reach the same methods a pointer reaches. A binding takes the usual keys of its control from the
// display object that holds the focus: Space or Enter activates when the key is released, the arrows,
// Home and End move the selection, and a key that was taken does not scroll the page.
const stops = { sound: parts.sound.sprite, level: group, apply: parts.apply.sprite };
const registrations = Object.fromEntries(Object.entries(stops).map(([id, target]) => [id, keyboard.registerTarget({ id, target })]));
const keys = {
  sound: createControlKeys({ keyboard, target: stops.sound, kind: 'toggle', control: sound, onPressChange: () => show() }),
  apply: createControlKeys({ keyboard, target: stops.apply, kind: 'action', control: apply, onPressChange: () => show() }),
};
// A gamepad is another way to the same keys: the cross and the left stick are the arrows, and an arrow nobody
// took moves the focus; the lower face button is Enter, the right one Escape, the shoulders move the focus.
const pads = scope.use(createBrowserGamepadInput({ onError: fail, onConnection: () => show() }));
const padKeys = bindGamepadKeys({ gamepad: pads.input, keyboard });
// The group is one stop and one binding, on the display object that holds its options. The focus stays on the
// group while the selection moves inside it, so a held arrow key goes on through the options, and the ring is
// drawn on the option that is selected, as it is in a native radio group.
createControlKeys({ keyboard, target: group, kind: 'selection', control: level });

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
    sound: { checked: sound.checked, pressed: sound.pressed, held: keys.sound.pressed, enabled: sound.enabled },
    level: { selected: level.selected, enabled: level.enabled, items: Object.fromEntries(levels.map(key => [key, level.isItemEnabled(key)])), changes: [...changes] },
    apply: { pressed: apply.pressed, held: keys.apply.pressed, activations: apply.activationCount, enabled: apply.enabled },
    hovered: Object.entries(hovered).filter(([, control]) => control.hovered).map(([name]) => name),
    focus: focus.focusVisible ? focus.focusedId : undefined, focused: focus.focusedId, renders, failure,
    pads: pads.input.pads.map(pad => pad.id), padKeys: [...padKeys.held],
    semantics: { revision: semantics.snapshot.revision, focused: semantics.snapshot.focused, nodes: semantics.snapshot.nodes.length, projection: projection.state },
  };
}
function show() {
  const focus = keyboard.getSnapshot(), ringed = focus.focusVisible ? focus.focusedId : undefined;
  // A key that is held paints as a press does.
  paint(parts.sound, { enabled: sound.enabled, pressed: sound.pressed || keys.sound.pressed, hovered: hovered.sound.hovered, on: sound.checked }, ringed === 'sound');
  for (const key of levels) paint(parts[key], { enabled: level.enabled && level.isItemEnabled(key), pressed: false, hovered: hovered[key].hovered, on: level.selected === key }, ringed === 'level' && level.selected === key);
  paint(parts.apply, { enabled: apply.enabled, pressed: apply.pressed || keys.apply.pressed, hovered: hovered.apply.hovered, on: false }, ringed === 'apply');
  // Published with the frame that shows the same state.
  semantics.publish();
  const snapshot = readSnapshot();
  status.textContent = failure ? 'Failed / 失败：' + failure : 'Sound / 声音：' + (snapshot.sound.checked ? 'on / 开' : 'off / 关') + ' · Level / 难度：' + snapshot.level.selected + ' · Applied / 已应用：' + snapshot.apply.activations;
  stateView.textContent = JSON.stringify(snapshot, null, 2);
  if (scope.state === 'open') { engine.renderSharedFrame(frame); renders++; }
}
globalThis.__egretUiControlsExample = { readSnapshot };
show();
// A browser tells nothing of a pad by itself, so the page looks once a frame, from the first frame it has drawn.
(function look(time) {
  if (scope.state !== 'open') return;
  try { pads.poll(time); } catch (cause) { fail(cause); show(); }
  requestAnimationFrame(look);
})(performance.now());
