// SPDX-License-Identifier: Apache-2.0
// A panel drawn by the engine with two fields a player can type into, in any language the platform can enter.
// The engine draws the committed text; while a field is edited, a platform field lies exactly over it.
import { createEngineForProfile, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createTextRasterCache, createTextField } from '@egret/engine/text';
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { createBrowserTextInput } from '@egret/engine/web/text-input';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 300, FAMILY = 'Arial', INK = 0xf3e9d2, HINT = 0x8d8676;
const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), committed = document.querySelector('#committed');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
const cache = createTextRasterCache(engine.assets, { provider: createCanvasTextRasterProvider() });
const input = createBrowserTextInput({ canvas, logicalWidth: WIDTH, logicalHeight: HEIGHT, onError: cause => { status.textContent = String(cause); } });

const panel = engine.stage.addChild(new Sprite());
panel.graphics.beginFill(0x1d1a16).drawRect(0, 0, WIDTH, HEIGHT).beginFill(0x2b2620).drawRect(24, 20, 432, 260);

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

/** A field: a box and the text the engine draws in it. `box` is in stage units, as pointer positions are. */
function entry(name, box, options) {
  const frame = engine.stage.addChild(new Sprite());
  frame.graphics.beginFill(0x5a4f3f).drawRect(box.x - 1, box.y - 1, box.width + 2, box.height + 2).beginFill(0x15120f).drawRect(box.x, box.y, box.width, box.height);
  const line = label(box.x + 8, box.y + (options.multiline ? 6 : (box.height - 26) / 2), 20, 26);
  return { name, box, options, line, value: '' };
}
const title = label(40, 30, 22, 28), nameCaption = label(40, 72, 14, 18), mottoCaption = label(40, 146, 14, 18);
const entries = [
  entry('name', { x: 40, y: 94, width: 400, height: 40 }, { maxLength: 8, placeholder: '最多 8 个字', enterKeyHint: 'done' }),
  entry('motto', { x: 40, y: 168, width: 400, height: 96 }, { multiline: true, maxLength: 60, placeholder: '写一句门派宣言' }),
];
let editing;

/** What the engine draws wraps nowhere by itself: a long line is broken every eighteen characters for display. */
function shown(item) {
  if (item.value === '') return item.options.placeholder;
  return item.value.split('\n').flatMap(row => { const points = [...row], rows = []; for (let at = 0; at < points.length || at === 0; at += 18) rows.push(points.slice(at, at + 18).join('')); return rows; }).slice(0, 3).join('\n');
}
async function draw() {
  await write(title, '门派登记 / Register a sect');
  await write(nameCaption, '门派名称 / Name', HINT);
  await write(mottoCaption, '门派宣言 / Motto', HINT);
  // The platform field shows the text of the field being edited, so the engine draws nothing there meanwhile.
  for (const item of entries) { item.line.field.visible = item !== editing; await write(item.line, shown(item), item.value === '' ? HINT : INK); }
  engine.renderSharedFrame({ width: WIDTH, height: HEIGHT, clearColor: 0x1d1a16, clearAlpha: 1 });
  committed.textContent = entries.map(item => item.name + ': ' + JSON.stringify(item.value)).join('\n');
}
let drawing = Promise.resolve();
function redraw() { drawing = drawing.then(draw).catch(cause => { console.error(cause); status.textContent = String(cause); }); return drawing; }

function edit(item) {
  editing = item;
  input.open({
    ...item.box, ...item.options, value: item.value, label: item.name, locale: 'zh-CN',
    fontFamily: '"' + FAMILY + '"', fontSize: 20, lineHeight: 26, color: INK, placeholderColor: HINT, padding: 8,
    onChange(change) { status.textContent = change.composing ? 'Composing… / 输入法组字中：' + change.value : 'Editing / 编辑中：' + change.value; },
    onCommit(value) { item.value = value; editing = undefined; status.textContent = 'Committed / 已提交'; redraw(); },
    onCancel() { editing = undefined; status.textContent = 'Cancelled / 已取消'; redraw(); },
  });
  redraw();
}
canvas.addEventListener('pointerdown', event => {
  const bounds = canvas.getBoundingClientRect(), x = (event.clientX - bounds.left) * WIDTH / bounds.width, y = (event.clientY - bounds.top) * HEIGHT / bounds.height;
  const item = entries.find(({ box }) => x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height);
  if (item) edit(item);
});
await redraw();
status.textContent = 'Ready. Press a field. / 已就绪，请点击输入框。';

/** What a check reads: plain values only. */
export const readSnapshot = () => ({ status: status.textContent, input: input.getSnapshot(), values: Object.fromEntries(entries.map(item => [item.name, item.value])) });
/** Settles when everything asked for so far has been drawn. */
export const whenDrawn = () => drawing;
globalThis.__egretTextInputExample = { readSnapshot, whenDrawn };
