// SPDX-License-Identifier: Apache-2.0
// A form drawn by the engine: two text fields and a button. `createTextFieldControl` holds the text
// of each field and opens the platform text input over it, so a player types with whatever input
// method the platform has. A press, a key and a request of assistive technology all begin the same edit.
import { createEngineForProfile, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createTextRasterCache, createTextField } from '@egret/engine/text';
import { createActionControl, createControlKeys, createTextFieldControl } from '@egret/engine/ui';
import { createUiSemantics } from '@egret/engine/ui/semantics';
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { createBrowserTextInput } from '@egret/engine/web/text-input';
import { createBrowserSemantics } from '@egret/engine/web/semantics';
import { createBrowserPointerInput } from '@egret/engine/web/pointer';
import { createBrowserKeyboardInput } from '@egret/engine/web/keyboard';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 300, FAMILY = 'Arial', INK = 0xf3e9d2, HINT = 0x8d8676, RING = 0xf2c14e;
const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), stateView = document.querySelector('#state');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
const cache = createTextRasterCache(engine.assets, { provider: createCanvasTextRasterProvider() });
let failure;
const fail = cause => { failure = String(cause?.code ?? cause); };
const pointer = createBrowserPointerInput({ engine, scope, width: WIDTH, height: HEIGHT });
const keyboard = createBrowserKeyboardInput({ engine, scope, onFocusChange: () => queueMicrotask(redraw) });
// The editor of both fields. It shows one field at a time, and nothing until a field is opened.
const editor = createBrowserTextInput({ canvas, logicalWidth: WIDTH, logicalHeight: HEIGHT, onError: fail });

const panel = engine.stage.addChild(scope.use(new Sprite()));
panel.graphics.beginFill(0x1d1a16).drawRect(0, 0, WIDTH, HEIGHT).beginFill(0x2b2620).drawRect(24, 16, 432, 268);

/** A line of text drawn by the engine. */
function label(x, y, fontSize, lineHeight) {
  const field = createTextField(engine, scope, cache);
  field.x = x; field.y = y;
  engine.stage.addChild(field);
  return { field, fontSize, lineHeight, text: undefined, color: undefined };
}
async function write(line, text, color = INK) {
  if (line.text === text && line.color === color) return;
  line.text = text; line.color = color;
  line.field.setRequest({ text, fontFamily: FAMILY, fontSize: line.fontSize, fontWeight: 400, fontStyle: 'normal', lineHeight: line.lineHeight, locale: 'zh-CN', direction: 'ltr', density: 2, fillColor: color });
  await line.field.prepare();
}
/** A surface a pointer can press, with a focus ring behind it. */
function surface(box, fill) {
  const ring = engine.stage.addChild(scope.use(new Sprite())), sprite = engine.stage.addChild(scope.use(new Sprite()));
  ring.graphics.beginFill(RING).drawRect(box.x - 3, box.y - 3, box.width + 6, box.height + 6).endFill(); ring.visible = false;
  sprite.x = box.x; sprite.y = box.y; sprite.touchEnabled = true; sprite.hitArea = { x: 0, y: 0, width: box.width, height: box.height };
  const paint = colour => { sprite.graphics.clear(); sprite.graphics.beginFill(colour).drawRect(0, 0, box.width, box.height).endFill(); };
  paint(fill);
  return { sprite, ring, paint };
}

let saved, byKey = false;
/** A text field: its surface, the text the engine draws in it, and the control that holds the text. */
function entry(id, caption, box, options) {
  const part = surface(box, 0x15120f), line = label(box.x + 8, box.y + (options.multiline ? 6 : (box.height - 26) / 2), 20, 26);
  const control = createTextFieldControl({
    input: pointer, target: part.sprite, editor, label: caption, ...options,
    // Asked when an edit begins: the box on the stage, and how the platform field should look over it.
    field: () => ({ ...box, locale: 'zh-CN', fontFamily: '"' + FAMILY + '"', fontSize: 20, lineHeight: 26, color: INK, placeholderColor: HINT, padding: 8 }),
    onInput: change => { status.textContent = change.composing ? 'Composing… / 输入法组字中：' + change.value : 'Editing / 编辑中：' + change.value; },
    onChange: () => { status.textContent = 'Changed / 已更改：' + caption; },
    onEditingChange(editing) {
      // The focus of the application comes back to the field it left for the platform's.
      if (!editing && control.enabled && keyboard.getSnapshot().state === 'active') keyboard.focus(id, { visible: byKey });
      redraw();
    },
  });
  return { id, caption, box, options, part, line, control };
}
const title = label(40, 24, 22, 28), nameCaption = label(40, 58, 14, 18), mottoCaption = label(40, 128, 14, 18);
const entries = [
  entry('name', '门派名称 / Name', { x: 40, y: 78, width: 400, height: 40 }, { maxLength: 8, placeholder: '最多 8 个字' }),
  entry('motto', '门派宣言 / Motto', { x: 40, y: 148, width: 400, height: 84 }, { multiline: true, maxLength: 60, placeholder: '写一句门派宣言' }),
];
const saveBox = { x: 40, y: 240, width: 120, height: 36 }, savePart = surface(saveBox, 0x3d4a63);
// Drawn after the surface of the button, so that the caption lies on it.
const saveCaption = label(58, 247, 16, 22), savedLine = label(180, 249, 14, 22);
const save = createActionControl({ input: pointer, target: savePart.sprite, onPressChange: () => redraw(), onActivate() {
  saved = Object.fromEntries(entries.map(item => [item.id, item.control.value]));
  status.textContent = 'Saved / 已保存'; redraw();
} });

// Keys: Tab moves between the three. A binding opens a field or presses the button when Enter or Space
// is released, and takes the key down so that the page does not act on it.
const targets = { name: entries[0].part.sprite, motto: entries[1].part.sprite, save: savePart.sprite };
const registrations = Object.fromEntries(Object.entries(targets).map(([id, target]) => [id, keyboard.registerTarget({ id, target })]));
// A binding takes anything with the methods of its kind: here the edit that began from a key is remembered.
for (const item of entries) createControlKeys({ keyboard, target: item.part.sprite, kind: 'textField',
  control: { get enabled() { return item.control.enabled; }, edit() { byKey = true; return item.control.edit(); } } });
createControlKeys({ keyboard, target: targets.save, kind: 'action', control: save });
// A press begins an edit that did not come from a key.
canvas.addEventListener('pointerdown', () => { byKey = false; });

// What the form is to someone who does not see it. A field that is being edited is the platform's own
// element, so its node is hidden until the edit ends and nothing is announced twice.
const semantics = createUiSemantics(), holds = id => keyboard.getSnapshot().focusedId === id;
semantics.add({ id: 'form', role: 'group', describe: () => ({ name: '门派登记 / Register a sect', bounds: { x: 24, y: 16, width: 432, height: 268 } }) });
for (const item of entries) semantics.add({ id: item.id, role: 'textbox', parent: 'form',
  onActivate: () => { byKey = true; item.control.edit(); }, onFocus: () => keyboard.focus(item.id, { visible: true }),
  describe: () => ({ name: item.caption, bounds: item.box, value: item.control.value, multiline: item.options.multiline === true, hidden: item.control.editing, disabled: !item.control.enabled, focused: holds(item.id) }) });
semantics.add({ id: 'save', role: 'button', parent: 'form', onActivate: () => { save.press(); save.release(); }, onFocus: () => keyboard.focus('save', { visible: true }),
  describe: () => ({ name: '保存 / Save', bounds: saveBox, disabled: !save.enabled, focused: holds('save') }) });
const projection = createBrowserSemantics({ semantics, canvas, width: WIDTH, height: HEIGHT, label: 'Text fields / 文本框控件', onError: fail });

let enabled = true;
document.querySelector('#disable').addEventListener('click', () => {
  enabled = !enabled;
  for (const item of entries) item.control.setEnabled(enabled);
  save.setEnabled(enabled);
  for (const registration of Object.values(registrations)) registration.update({ disabled: !enabled });
  redraw();
});

/** What the engine draws wraps nowhere by itself: a long line is broken every eighteen characters for display. */
function shown(item) {
  const value = item.control.value;
  if (value === '') return item.options.placeholder;
  return value.split('\n').flatMap(row => { const points = [...row], rows = []; for (let at = 0; at < points.length || at === 0; at += 18) rows.push(points.slice(at, at + 18).join('')); return rows; }).slice(0, 3).join('\n');
}
/** What a check reads: plain values only. */
export function readSnapshot() {
  const focus = keyboard.getSnapshot();
  return {
    fields: Object.fromEntries(entries.map(item => [item.id, { value: item.control.value, draft: item.control.draft, editing: item.control.editing, composing: item.control.composing, enabled: item.control.enabled }])),
    saved, save: { pressed: save.pressed, activations: save.activationCount, enabled: save.enabled },
    focus: focus.focusVisible ? focus.focusedId : undefined, focused: focus.focusedId, editor: editor.getSnapshot(), status: status.textContent, failure,
    semantics: { focused: semantics.snapshot.focused, nodes: semantics.snapshot.nodes.map(node => node.id), projection: projection.state },
  };
}
async function draw() {
  const focus = keyboard.getSnapshot(), ringed = focus.focusVisible ? focus.focusedId : undefined;
  await write(title, '门派登记 / Register a sect');
  await write(nameCaption, entries[0].caption, HINT);
  await write(mottoCaption, entries[1].caption, HINT);
  for (const item of entries) {
    const { control } = item;
    item.part.paint(!control.enabled ? 0x24211d : control.pressed ? 0x0d0b09 : 0x15120f);
    item.part.ring.visible = ringed === item.id || control.editing;
    // The platform field shows the text of the field being edited, so the engine draws nothing there meanwhile.
    item.line.field.visible = !control.editing;
    await write(item.line, shown(item), control.value === '' || !control.enabled ? HINT : INK);
  }
  savePart.paint(!save.enabled ? 0x2a2d33 : save.pressed ? 0x27314a : 0x3d4a63); savePart.ring.visible = ringed === 'save';
  await write(saveCaption, '保存 / Save', save.enabled ? INK : HINT);
  await write(savedLine, saved === undefined ? '' : '已保存 / Saved: ' + (saved.name === '' ? '—' : saved.name), HINT);
  // Published with the frame that shows the same state.
  semantics.publish();
  if (scope.state === 'open') engine.renderSharedFrame({ width: WIDTH, height: HEIGHT, clearColor: 0x1d1a16, clearAlpha: 1 });
  if (failure) status.textContent = 'Failed / 失败：' + failure;
  stateView.textContent = JSON.stringify(readSnapshot(), null, 2);
}
let drawing = Promise.resolve();
function redraw() { drawing = drawing.then(draw).catch(cause => { console.error(cause); fail(cause); }); return drawing; }
await redraw();
status.textContent = 'Ready. Press a field. / 已就绪，请点击输入框。';

/** Settles when everything asked for so far has been drawn. */
export const whenDrawn = () => drawing;
globalThis.__egretUiTextFieldExample = { readSnapshot, whenDrawn };
