// SPDX-License-Identifier: Apache-2.0
// One screen that joins the pieces of the UI: a switch, a group of options, a text field, a slider, a button, a
// managed list of two hundred profiles, and a modal card that asks before a reset. A theme names every
// paint, and changing it repaints the drawn controls and both managed roots in one frame. Every control
// answers a press, its usual keys, and a request of assistive technology through the same state.
import { createEngineForProfile, DisplayObjectContainer, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createTextRasterCache, createTextField } from '@egret/engine/text';
import { createActionControl, createControlKeys, createHoverControl, createRangeControl, createSelectionGroup, createTextFieldControl, createToggleControl, createUiLayerManager, createUiRoot, createUiTheme, selectUiSkin } from '@egret/engine/ui';
import { createUiListSemantics, createUiSemantics, semanticBoxOf } from '@egret/engine/ui/semantics';
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { createBrowserTextInput } from '@egret/engine/web/text-input';
import { createBrowserSemantics } from '@egret/engine/web/semantics';
import { createBrowserHoverInput } from '@egret/engine/web/hover';
import { createBrowserPointerInput } from '@egret/engine/web/pointer';
import { createBrowserKeyboardInput } from '@egret/engine/web/keyboard';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 320, FAMILY = 'Arial', ROW = 25, COUNT = 200, LIST = { x: 270, y: 40, width: 190, height: 250 };
// Two generations of one theme. A skin names the paint of each state; a control that is set has a skin of its own.
const skins = { control: { default: 'surface', hover: 'surfaceHover', pressed: 'surfacePressed', disabled: 'surfaceOff' },
  controlOn: { default: 'on', hover: 'onHover', pressed: 'surfacePressed', disabled: 'surfaceOff' } };
const THEMES = {
  dark: createUiTheme({ id: 'dark', skins, colors: { page: 0x161a22, panel: 0x1f2633, surface: 0x3d4a63, surfaceHover: 0x56689a, surfacePressed: 0x27314a, surfaceOff: 0x2a2d33,
    on: 0x2f8f6b, onHover: 0x3fae84, field: 0x10141b, row: 0x2b2f3a, rowAlt: 0x343a48, rowHover: 0x454c5e, rowPressed: 0x232730, rowChosen: 0x2f8f6b, ink: 0xf3e9d2, hint: 0x9aa7c4, ring: 0xf2c14e } }),
  light: createUiTheme({ id: 'light', skins, colors: { page: 0xe9edf5, panel: 0xffffff, surface: 0xc9d3e6, surfaceHover: 0xaebcd8, surfacePressed: 0x8fa0c2, surfaceOff: 0xdcdfe6,
    on: 0x4cb58b, onHover: 0x3fa37b, field: 0xf4f6fa, row: 0xf0f2f7, rowAlt: 0xe2e7f0, rowHover: 0xd3dae8, rowPressed: 0xbfc8da, rowChosen: 0x4cb58b, ink: 0x172033, hint: 0x5b6577, ring: 0xc77d00 } }),
};
const DEFAULTS = { sound: true, level: 'normal', name: '侠客', volume: 60 };
const LEVELS = ['easy', 'normal', 'hard'], LEVEL_NAMES = { easy: '易 Easy', normal: '中 Normal', hard: '难 Hard' };
const HEROES = ['青锋', '白露', '玄霜', '赤霄', '紫电'];
/** The settings a profile holds. They are made up from its number. */
const profileOf = index => ({ sound: index % 2 === 0, level: LEVELS[index % 3], name: HEROES[index % 5] + (index + 1), volume: index * 15 % 105 });
const keyOf = index => 'p' + index, indexOf = key => Number(key.slice(1));

const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), stateView = document.querySelector('#state');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
// Every line of text on the screen is one entry of this cache. The cache prepares four at a time at most, and the
// rows of a list are bound together, so the screen prepares its text one line after another.
const cache = createTextRasterCache(engine.assets, { provider: createCanvasTextRasterProvider() });
let textQueue = Promise.resolve();
const inTurn = work => { const next = textQueue.then(work); textQueue = next.catch(() => {}); return next; };
let renders = 0, mixedFrames = 0, painted, failure, loaded, queued = false, byKey = false, switching = false, busy = Promise.resolve(), layersReady = false, wanted = THEMES.dark;
const fail = cause => { failure = String(cause?.code ?? cause); };
/** Paints once after the callbacks that are running: a row reports its hover and its press from inside the input, and from inside a commit when it is recycled. */
const later = () => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; show(); }); };
const pointer = createBrowserPointerInput({ engine, scope, width: WIDTH, height: HEIGHT });
const hover = createBrowserHoverInput({ engine, scope, canvas, width: WIDTH, height: HEIGHT, onError: fail });
const keyboard = createBrowserKeyboardInput({ engine, scope, onFocusChange: () => queueMicrotask(show) });
const editor = createBrowserTextInput({ canvas, logicalWidth: WIDTH, logicalHeight: HEIGHT, onError: fail });
/** The theme the picture is drawn with: the one both roots have committed. */
const theme = () => root.snapshot().theme ?? THEMES.dark;
const holds = id => keyboard.getSnapshot().focusedId === id;
const ringed = id => { const focus = keyboard.getSnapshot(); return focus.focusVisible && focus.focusedId === id; };

const page = engine.stage.addChild(scope.use(new Sprite()));
/** A line of text drawn by the engine, in the ink or the hint of the theme. */
function line(parent, x, y, fontSize, text, tone = 'ink', owner = scope) {
  const field = createTextField(engine, owner, cache);
  field.x = x; field.y = y; parent.addChild(field);
  const item = { text, tone, shown: undefined, async prepare(colors) {
    const colour = colors[item.tone], next = item.text + '\n' + colour;
    if (item.shown === next) return;
    item.shown = next;
    field.setRequest({ text: item.text, fontFamily: FAMILY, fontSize, fontWeight: 400, fontStyle: 'normal', lineHeight: Math.round(fontSize * 1.3), locale: 'zh-CN', direction: 'ltr', density: 2, fillColor: colour });
    await inTurn(() => field.prepare());
  } };
  return item;
}
/** A surface a pointer can press, with a focus ring behind it and its hover. */
function surface(id, box, parent = engine.stage) {
  const ring = parent.addChild(scope.use(new Sprite())), sprite = parent.addChild(scope.use(new Sprite()));
  ring.x = box.x - 3; ring.y = box.y - 3; sprite.x = box.x; sprite.y = box.y; sprite.touchEnabled = true; sprite.hitArea = { x: 0, y: 0, width: box.width, height: box.height };
  const part = { id, box, sprite, ring, hover: createHoverControl({ hover, target: sprite, onHoverChange: () => show() }),
    paint(colors, fill, focused) {
      ring.visible = focused; ring.graphics.clear(); ring.graphics.beginFill(colors.ring).drawRect(0, 0, box.width + 6, box.height + 6).endFill();
      sprite.graphics.clear(); sprite.graphics.beginFill(fill).drawRect(0, 0, box.width, box.height).endFill();
    } };
  return part;
}
/** The paint of a control: its skin by whether it is set, and the name the skin has for its state. */
const paintOf = (colors, on, state) => colors[selectUiSkin(theme().skins[on ? 'controlOn' : 'control'], state)];

// The settings.
const labels = [line(engine.stage, 20, 10, 18, '设置 / Settings'), line(engine.stage, 20, 50, 14, '声音 / Sound', 'hint'), line(engine.stage, 20, 88, 14, '难度 / Level', 'hint'),
  line(engine.stage, 20, 148, 14, '名字 / Name', 'hint'), line(engine.stage, 20, 216, 14, '深色 / Dark', 'hint'), line(engine.stage, 20, 243, 14, '音量 / Volume', 'hint'), line(engine.stage, 270, 14, 14, '存档 / Profiles', 'hint')];
// The three options are inside one display object, which is what the keyboard stops at.
const options = engine.stage.addChild(scope.use(new Sprite()));
const parts = { sound: surface('sound', { x: 150, y: 44, width: 90, height: 28 }), easy: surface('easy', { x: 20, y: 108, width: 70, height: 28 }, options), normal: surface('normal', { x: 95, y: 108, width: 70, height: 28 }, options),
  hard: surface('hard', { x: 170, y: 108, width: 70, height: 28 }, options), name: surface('name', { x: 20, y: 168, width: 220, height: 32 }), dark: surface('dark', { x: 150, y: 210, width: 90, height: 28 }),
  volume: surface('volume', { x: 120, y: 244, width: 120, height: 16 }), reset: surface('reset', { x: 20, y: 268, width: 100, height: 28 }) };
const captions = { easy: line(engine.stage, 28, 114, 13, LEVEL_NAMES.easy), normal: line(engine.stage, 100, 114, 13, LEVEL_NAMES.normal), hard: line(engine.stage, 178, 114, 13, LEVEL_NAMES.hard),
  name: line(engine.stage, 28, 174, 16, DEFAULTS.name), reset: line(engine.stage, 34, 273, 14, '重置 / Reset') };
labels.push(...Object.values(captions));
const sound = createToggleControl({ input: pointer, target: parts.sound.sprite, checked: DEFAULTS.sound, onChange: () => edited(), onPressChange: () => show() });
const level = createSelectionGroup({ input: pointer, items: LEVELS.map(key => ({ key, target: parts[key].sprite })), selected: DEFAULTS.level, onChange: () => edited() });
const name = createTextFieldControl({ input: pointer, target: parts.name.sprite, editor, value: DEFAULTS.name, maxLength: 8, label: '名字 / Name',
  field: () => ({ ...parts.name.box, locale: 'zh-CN', fontFamily: '"' + FAMILY + '"', fontSize: 16, lineHeight: 21, color: theme().colors.ink, padding: 8 }),
  onChange: () => edited(), onPressChange: () => show(),
  onEditingChange(editing) {
    // The focus of the application comes back to the field it left for the platform's.
    if (!editing && name.enabled && keyboard.getSnapshot().state === 'active') keyboard.focus('name', { visible: byKey });
    show();
  } });
const dark = createToggleControl({ input: pointer, target: parts.dark.sprite, checked: true, onChange: checked => { void applyTheme(checked ? THEMES.dark : THEMES.light); }, onPressChange: () => show() });
// The track is the surface: a press on it moves the volume there, and the same finger drags it.
const volume = createRangeControl({ input: pointer, target: parts.volume.sprite, length: parts.volume.box.width, min: 0, max: 100, step: 5, value: DEFAULTS.volume, onChange: () => edited(), onDragChange: () => show() });
const reset = createActionControl({ input: pointer, target: parts.reset.sprite, onActivate: () => { void openConfirm(); }, onPressChange: () => show() });
/** A setting changed by hand: the picture no longer shows a profile as it was saved. */
function edited() { if (loaded !== undefined && !sameAs(profileOf(indexOf(loaded)))) loaded = undefined; show(); }
const current = () => ({ sound: sound.checked, level: level.selected, name: name.value, volume: volume.value });
const sameAs = other => { const now = current(); return now.sound === other.sound && now.level === other.level && now.name === other.name && now.volume === other.volume; };
function assign(values) { sound.setChecked(values.sound); level.select(values.level); name.setValue(values.name); volume.setValue(values.volume); }
canvas.addEventListener('pointerdown', () => { byKey = false; });

// The keyboard: each control is a stop with its place, and the list is one stop after them.
const stops = { sound: parts.sound.sprite, level: options, name: parts.name.sprite, dark: parts.dark.sprite, volume: parts.volume.sprite, reset: parts.reset.sprite };
const registrations = Object.fromEntries(Object.entries(stops).map(([id, target], index) => [id, keyboard.registerTarget({ id, target, tabIndex: index + 1 })]));
const keys = {
  sound: createControlKeys({ keyboard, target: stops.sound, kind: 'toggle', control: sound, onPressChange: () => show() }),
  dark: createControlKeys({ keyboard, target: stops.dark, kind: 'toggle', control: dark, onPressChange: () => show() }),
  reset: createControlKeys({ keyboard, target: stops.reset, kind: 'action', control: reset, onPressChange: () => show() }),
  name: createControlKeys({ keyboard, target: stops.name, kind: 'textField', onPressChange: () => show(),
    control: { get enabled() { return name.enabled; }, edit() { byKey = true; return name.edit(); } } }),
};
// The group is one stop and one binding, on the display object that holds its options: the focus stays on the
// group while the selection moves inside it, and the ring is drawn on the option that is selected.
createControlKeys({ keyboard, target: options, kind: 'selection', control: level, orientation: 'horizontal' });
// The arrows move the volume by a step, Page Up and Page Down by four, Home and End to its ends.
createControlKeys({ keyboard, target: stops.volume, kind: 'range', control: volume, page: 4 });

// The profiles: a managed list. Each row draws its own text in the ink of the theme it was bound with.
const realized = new Map();
const source = {
  revision: 0,
  records: Array.from({ length: COUNT }, (_, index) => ({ key: keyOf(index), contentVersion: 0, estimatedHeight: ROW, value: index })),
  async bind(context) {
    const { key, index, width } = context, colors = (context.theme ?? THEMES.dark).colors, content = context.scope.use(new DisplayObjectContainer()), back = content.addChild(context.scope.use(new Sprite()));
    const text = line(content, 8, 4, 13, '存档 ' + (index + 1) + ' · ' + profileOf(index).name, 'ink', context.scope);
    await text.prepare(colors);
    // The row takes the pointer through the display object its binding is given: pointed at, held, and chosen by a completed press.
    const pointed = createHoverControl({ hover, target: context.target, onHoverChange: later });
    const held = createActionControl({ input: pointer, target: context.target, onActivate: () => load(key), onPressChange: later });
    const paint = () => {
      const focus = list.getFocus(), focused = focus.focusVisible && focus.key === key;
      back.graphics.clear();
      if (focused) back.graphics.beginFill(colors.ring).drawRect(0, 0, width, ROW - 2).endFill();
      back.graphics.beginFill(held.pressed ? colors.rowPressed : key === loaded ? colors.rowChosen : pointed.hovered ? colors.rowHover : index % 2 ? colors.rowAlt : colors.row).drawRect(focused ? 2 : 0, focused ? 2 : 0, width - (focused ? 4 : 0), ROW - 2 - (focused ? 4 : 0)).endFill();
    };
    const bound = createControlKeys({ keyboard, target: content, kind: 'action', control: { enabled: true, press() {}, release() { load(key); } } });
    const moves = { ArrowDown: index + 1, ArrowUp: index - 1, PageDown: index + 9, PageUp: index - 9, Home: 0, End: COUNT - 1 };
    const stop = content.on(keyboard.events.keyDown, event => {
      if (event.defaultPrevented || !Object.hasOwn(moves, event.payload.code)) return;
      event.preventDefault(); void go(Math.min(COUNT - 1, Math.max(0, moves[event.payload.code])));
    });
    // A theme change binds the row again before the old binding is let go: the newest one that is committed is the row.
    paint();
    pending.set(key + ':' + context.bindingGeneration, { paint, hovered: () => pointed.hovered, dispose() { stop(); bound.dispose(); held.dispose(); pointed.dispose(); } });
    return { content, measuredHeight: ROW };
  },
  // Called for a binding that was recycled, replaced or never committed.
  unbind({ key, bindingGeneration }) {
    const id = key + ':' + bindingGeneration;
    pending.get(id)?.dispose(); pending.delete(id);
    if (realized.get(key)?.id === id) { realized.get(key).dispose(); realized.delete(key); }
  },
};
/** Bindings by key and generation, from the moment a row is bound until the commit that shows or drops it. */
const pending = new Map();
const root = createUiRoot({
  engine, scope, id: 'profiles', theme: THEMES.dark, viewport: { width: LIST.width, height: LIST.height }, origin: { x: LIST.x, y: LIST.y }, density: 1,
  tree: { id: 'list', kind: 'virtualList', source, explicitWidth: LIST.width, explicitHeight: LIST.height },
  keyboard: { input: keyboard, idPrefix: 'profiles', tabStop: 7 }, limits: { overscan: 1, residentCap: 24 },
  input: pointer,
});
const list = root.list('list');
/** After a commit: the rows that show are the newest bindings of their keys. */
function adopt() {
  const rows = new Map(root.snapshot().rows.map(row => [row.key + ':' + row.bindingGeneration, row.key]));
  for (const [id, entry] of pending) if (rows.has(id)) {
    const key = rows.get(id), old = realized.get(key);
    if (old !== undefined && old.id !== id) old.dispose();
    realized.set(key, { id, ...entry }); pending.delete(id);
  }
}

// The card that asks before a reset: a second root, shown by the layer manager as a modal layer.
const cardParts = {}, cardLines = [];
function leaf(id, height, text, paint) {
  return { revision: 0, async prepare(context) {
    const colors = (context.theme ?? THEMES.dark).colors, content = context.scope.use(new DisplayObjectContainer()), sprite = content.addChild(context.scope.use(new Sprite()));
    sprite.touchEnabled = true; sprite.hitArea = { x: 0, y: 0, width: context.width, height };
    const caption = line(content, 10, Math.round((height - 18) / 2), 14, text, 'ink', context.scope);
    await caption.prepare(colors);
    const part = { sprite, paint: () => { sprite.graphics.clear(); paint(sprite.graphics, colors, context.width, height); } };
    part.paint();
    cardPending.set(id, part);
    return { content, measuredHeight: height };
  } };
}
const cardPending = new Map();
const buttonPaint = id => (graphics, colors, width, height) => {
  const focused = ringed('confirm-' + id);
  if (focused) graphics.beginFill(colors.ring).drawRect(0, 0, width, height).endFill();
  const held = cardButtons[id]?.action.pressed || cardButtons[id]?.keys.pressed, pointed = cardButtons[id]?.hover.hovered;
  graphics.beginFill(colors[selectUiSkin(skins.control, { pressed: held, hover: pointed })]).drawRect(focused ? 3 : 0, focused ? 3 : 0, width - (focused ? 6 : 0), height - (focused ? 6 : 0)).endFill();
};
const card = createUiRoot({
  engine, scope, id: 'confirm', theme: THEMES.dark, viewport: { width: 260, height: 140 }, density: 1, input: pointer, keyboard: { input: keyboard, idPrefix: 'confirm' },
  tree: { id: 'card', kind: 'column', explicitWidth: 260, padding: 15, gap: 10, children: [
    { id: 'question', kind: 'leaf', explicitWidth: 230, explicitHeight: 34, content: leaf('question', 34, '恢复默认设置？/ Restore the defaults?', (graphics, colors, width, height) => graphics.beginFill(colors.panel).drawRect(0, 0, width, height).endFill()) },
    { id: 'yes', kind: 'leaf', explicitWidth: 230, explicitHeight: 30, content: leaf('yes', 30, '恢复 / Restore', buttonPaint('yes')) },
    { id: 'no', kind: 'leaf', explicitWidth: 230, explicitHeight: 30, content: leaf('no', 30, '取消 / Cancel', buttonPaint('no')) },
  ] },
});
const layers = createUiLayerManager({ engine, scope, input: pointer, keyboard, viewport: { x: 0, y: 0, width: WIDTH, height: HEIGHT }, onInvalidate: () => { void publish(); } });
const confirmOpen = () => layers.snapshot().layers.find(layer => layer.id === 'confirm')?.visible === true;
let cardButtons = {};
const answers = { yes: () => { assign(DEFAULTS); return closeConfirm(); }, no: () => closeConfirm() };
/** The buttons of the card take a press, a hover, the keyboard and their keys. They are made again when a theme binds the card again. */
function wireCard() {
  for (const [id, part] of cardPending) cardParts[id] = part;
  cardPending.clear();
  for (const id of ['yes', 'no']) {
    const target = cardParts[id].sprite;
    if (cardButtons[id]?.target === target) continue;
    cardButtons[id]?.dispose();
    const action = createActionControl({ input: pointer, target, onActivate: () => { void answers[id](); }, onPressChange: () => show() });
    const pointed = createHoverControl({ hover, target, onHoverChange: () => show() });
    const registration = keyboard.registerTarget({ id: 'confirm-' + id, target });
    const bound = createControlKeys({ keyboard, target, kind: 'action', control: action, onPressChange: () => show() });
    cardButtons[id] = { target, action, hover: pointed, keys: bound, dispose() { bound.dispose(); registration.dispose(); pointed.dispose(); action.dispose(); } };
  }
}

// What the screen is to someone who does not see it.
const semantics = createUiSemantics();
semantics.add({ id: 'settings', role: 'group', describe: () => ({ name: '设置 / Settings', bounds: { x: 12, y: 40, width: 240, height: 264 } }) });
semantics.add({ id: 'sound', role: 'switch', parent: 'settings', onActivate: () => sound.toggle(), onFocus: () => keyboard.focus('sound', { visible: true }),
  describe: () => ({ name: '声音 / Sound', bounds: parts.sound.box, checked: sound.checked, focused: holds('sound') }) });
semantics.add({ id: 'level', role: 'radiogroup', parent: 'settings', describe: () => ({ name: '难度 / Level', bounds: { x: 20, y: 108, width: 220, height: 28 } }) });
for (const [index, key] of LEVELS.entries()) semantics.add({ id: 'level-' + key, role: 'radio', parent: 'level', onActivate: () => { level.select(key); }, onFocus: () => keyboard.focus('level', { visible: true }),
  describe: () => ({ name: LEVEL_NAMES[key], bounds: parts[key].box, checked: level.selected === key, focused: holds('level') && level.selected === key, position: { index: index + 1, size: LEVELS.length } }) });
// A field that is being edited is the platform's own element, so its node is hidden until the edit ends.
semantics.add({ id: 'name', role: 'textbox', parent: 'settings', onActivate: () => { byKey = true; name.edit(); }, onFocus: () => keyboard.focus('name', { visible: true }),
  describe: () => ({ name: '名字 / Name', bounds: parts.name.box, value: name.value, hidden: name.editing, focused: holds('name') }) });
semantics.add({ id: 'dark', role: 'switch', parent: 'settings', onActivate: () => dark.toggle(), onFocus: () => keyboard.focus('dark', { visible: true }),
  describe: () => ({ name: '深色 / Dark', bounds: parts.dark.box, checked: dark.checked, focused: holds('dark') }) });
// A slider is moved by its keys, as a native one is: a request to focus it puts the keyboard there.
semantics.add({ id: 'volume', role: 'slider', parent: 'settings', onFocus: () => keyboard.focus('volume', { visible: true }),
  describe: () => ({ name: '音量 / Volume', bounds: parts.volume.box, range: { now: volume.value, min: volume.min, max: volume.max }, focused: holds('volume') }) });
semantics.add({ id: 'reset', role: 'button', parent: 'settings', onActivate: () => { reset.press(); reset.release(); }, onFocus: () => keyboard.focus('reset', { visible: true }),
  describe: () => ({ name: '重置 / Reset', bounds: parts.reset.box, focused: holds('reset') }) });
const rows = createUiListSemantics({ semantics, root, list: 'list', id: 'profiles', role: 'listbox', name: '存档 / Profiles', focusable: true,
  describeRow: (key, index) => ({ name: '存档 ' + (index + 1) + ' ' + profileOf(index).name, selected: key === loaded }), onActivateRow: key => load(key) });
semantics.add({ id: 'confirm', role: 'dialog', describe: () => ({ name: '恢复默认设置？/ Restore the defaults?', modal: true, hidden: !confirmOpen(), bounds: semanticBoxOf(card, 'card') }) });
for (const [id, text] of [['yes', '恢复 / Restore'], ['no', '取消 / Cancel']]) semantics.add({ id: 'confirm/' + id, role: 'button', parent: 'confirm',
  onActivate: () => { void answers[id](); }, onFocus: () => keyboard.focus('confirm-' + id, { visible: true }),
  describe: () => ({ name: text, bounds: semanticBoxOf(card, id), focused: holds('confirm-' + id) }) });
const projection = createBrowserSemantics({ semantics, canvas, width: WIDTH, height: HEIGHT, label: 'Settings / 设置', onError: fail });

/** Commits what was asked of both roots, then the layers. One at a time, and nothing is drawn in between. */
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
    // The text of the drawn controls is prepared in the ink of the theme that is about to be committed.
    for (const item of labels) await item.prepare(wanted.colors);
    await settle(root); await settle(card);
    adopt(); wireCard();
    if (layersReady) layers.sync();
    // A pointer that rests while the rows change under it sends nothing: the input picks again where it is.
    hover.sync();
  };
  busy = busy.then(run).then(show, cause => { fail(cause); show(); });
  return busy;
}
/** A theme is a generation of both roots and of everything drawn here. It is shown when all of it is ready. */
async function applyTheme(next) {
  wanted = next; switching = true;
  root.setTheme(next); card.setTheme(next);
  try { await publish(); } finally { switching = false; show(); }
}
/** A profile is chosen: its settings become the settings. */
function load(key) { loaded = key; assign(profileOf(indexOf(key))); loaded = key; show(); }
async function go(index, focus = true) {
  list.reveal(keyOf(index), { align: 'nearest' });
  await publish();
  if (focus && root.snapshot().rows.some(row => row.key === keyOf(index) && row.visible)) list.focus(keyOf(index), { visible: true });
  show();
}
function openConfirm() { layers.open('confirm'); return publish(); }
function closeConfirm() { layers.close('confirm'); return publish(); }

/** What a check reads: plain values only. */
export function readSnapshot() {
  const ui = root.snapshot(), focus = keyboard.getSnapshot();
  return {
    settings: current(), loaded, theme: theme().id, wanted: wanted.id, editing: name.editing, draft: name.draft, dragging: volume.dragging,
    held: Object.fromEntries(Object.entries(keys).map(([id, bound]) => [id, bound.pressed])), hovered: Object.values(parts).filter(part => part.hover.hovered).map(part => part.id),
    focus: focus.focusedId, focusVisible: focus.focusVisible, row: list.getFocus().key,
    rows: ui.rows.filter(row => row.visible).map(row => ({ key: row.key, index: row.index, x: LIST.x + row.box.x, y: LIST.y + row.box.y, width: row.box.width, height: row.box.height })),
    confirm: { open: confirmOpen(), card: semanticBoxOf(card, 'card'), yes: semanticBoxOf(card, 'yes'), no: semanticBoxOf(card, 'no') },
    hoveredRows: [...realized].filter(([, row]) => row.hovered()).map(([key]) => key),
    renders, mixedFrames, failure, realized: realized.size,
    semantics: { focused: semantics.snapshot.focused, nodes: semantics.snapshot.nodes.length, projection: projection.state },
  };
}
function show() {
  // While a theme is being prepared the picture stays whole in the old one.
  if (scope.state !== 'open' || switching) return;
  painted = theme();
  const colors = painted.colors;
  page.graphics.clear(); page.graphics.beginFill(colors.page).drawRect(0, 0, WIDTH, HEIGHT).beginFill(colors.panel).drawRect(12, 40, 240, 264).drawRect(LIST.x - 4, LIST.y - 4, LIST.width + 8, LIST.height + 8).endFill();
  parts.sound.paint(colors, paintOf(colors, sound.checked, { pressed: sound.pressed || keys.sound.pressed, hover: parts.sound.hover.hovered }), ringed('sound'));
  for (const key of LEVELS) parts[key].paint(colors, paintOf(colors, level.selected === key, { hover: parts[key].hover.hovered }), ringed('level') && level.selected === key);
  parts.name.paint(colors, name.pressed || keys.name.pressed ? colors.surfacePressed : colors.field, ringed('name') || name.editing);
  parts.dark.paint(colors, paintOf(colors, dark.checked, { pressed: dark.pressed || keys.dark.pressed, hover: parts.dark.hover.hovered }), ringed('dark'));
  // The track, the part of it that is filled, and the thumb.
  const track = parts.volume.box, thumb = Math.round(volume.fraction * (track.width - 6));
  parts.volume.paint(colors, colors[selectUiSkin(skins.control, { pressed: volume.dragging, hover: parts.volume.hover.hovered })], ringed('volume'));
  parts.volume.sprite.graphics.beginFill(colors.on).drawRect(0, 4, thumb, track.height - 8).beginFill(colors.ink).drawRect(thumb, 0, 6, track.height).endFill();
  parts.reset.paint(colors, paintOf(colors, false, { pressed: reset.pressed || keys.reset.pressed, hover: parts.reset.hover.hovered }), ringed('reset'));
  for (const row of realized.values()) row.paint();
  for (const part of Object.values(cardParts)) part.paint();
  // The text of the field is the platform's while it is edited, and is not drawn twice.
  captions.name.text = name.editing ? '' : name.value;
  void captions.name.prepare(colors).then(() => { if (scope.state === 'open' && !switching) frame(); }, fail);
  try { rows.sync(); semantics.publish(layers.snapshot().committedRevision); } catch (cause) { fail(cause); }
  const now = current();
  status.textContent = failure ? 'Failed / 失败：' + failure
    : (now.sound ? '声音开' : '声音关') + ' ' + now.volume + ' · ' + LEVEL_NAMES[now.level] + ' · ' + now.name + ' · ' + (loaded === undefined ? '未存档 / not a profile' : '存档 / profile ' + (indexOf(loaded) + 1)) + ' · ' + theme().id;
  stateView.textContent = JSON.stringify(readSnapshot(), null, 2);
  frame();
}
const drawn = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x000000, clearAlpha: 1 });
function frame() {
  // A frame in which the two roots, or the roots and the drawn controls, are of different themes would be a mixed one.
  if (root.snapshot().theme !== card.snapshot().theme || root.snapshot().theme !== painted) mixedFrames++;
  engine.renderSharedFrame(drawn); renders++;
}
globalThis.__egretUiSettingsExample = { readSnapshot, settled: () => busy };
await publish();
layers.register({ id: 'profiles', root, kind: 'base' });
layers.register({ id: 'confirm', root: card, kind: 'modal', closeOnEscape: true, backdropColor: 0x000000, backdropAlpha: 0.5 });
layersReady = true;
await publish();
