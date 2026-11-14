// SPDX-License-Identifier: Apache-2.0
// Three tabs and their panels, drawn by the application. The tabs are one selection group and one
// keyboard stop: the arrow keys move the selection and the panel follows it. One panel has progress
// bars and a button that advances them. The semantic tree says the same as a row of tabs, a tab
// panel and progress bars.
import { createEngineForProfile, DisplayObjectContainer, SHARED_FRAME_PROFILE_2D, Sprite } from '@egret/engine';
import { createTextRasterCache, createTextField } from '@egret/engine/text';
import { createActionControl, createControlKeys, createHoverControl, createSelectionGroup } from '@egret/engine/ui';
import { createUiSemantics } from '@egret/engine/ui/semantics';
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { createBrowserSemantics } from '@egret/engine/web/semantics';
import { createBrowserHoverInput } from '@egret/engine/web/hover';
import { createBrowserPointerInput } from '@egret/engine/web/pointer';
import { createBrowserKeyboardInput } from '@egret/engine/web/keyboard';
import { createExampleHost } from '../host.mjs';

const WIDTH = 480, HEIGHT = 320, FAMILY = 'Arial', PANEL = { x: 20, y: 78, width: 440, height: 222 }, BAR = { x: 150, width: 250, height: 14 };
const COLORS = { page: 0x161a22, panel: 0x1f2633, tab: 0x2b2f3a, tabHover: 0x3d4a63, tabOn: 0x1f2633, track: 0x10141b, fill: 0x2f8f6b, button: 0x3d4a63, buttonHover: 0x56689a, buttonPressed: 0x27314a, ink: 0xf3e9d2, hint: 0x9aa7c4, ring: 0xf2c14e };
const TABS = [{ key: 'members', name: '弟子 Members' }, { key: 'training', name: '修炼 Training' }, { key: 'stores', name: '库房 Stores' }];
const LINES = { members: ['青锋 · 守山 Guard', '白露 · 采药 Herbs', '玄霜 · 锻造 Forge'], stores: ['灵草 Herbs × 12', '精铁 Iron × 7', '丹药 Pills × 3'] };
// What is trained, how far each has come, and how much one session adds.
const SKILLS = [{ key: 'inner', name: '内功 Inner', gain: 10 }, { key: 'outer', name: '外功 Outer', gain: 15 }, { key: 'light', name: '轻功 Lightness', gain: 25 }];
const progress = { inner: 20, outer: 40, light: 55 };

const canvas = document.querySelector('#scene'), status = document.querySelector('#status'), stateView = document.querySelector('#state');
const engine = await createEngineForProfile({ host: await createExampleHost({ canvas, pixelRatio: 1.5 }) }, SHARED_FRAME_PROFILE_2D);
const scope = engine.createScope();
const cache = createTextRasterCache(engine.assets, { provider: createCanvasTextRasterProvider() });
let renders = 0, failure, sessions = 0;
const fail = cause => { failure = String(cause?.code ?? cause?.message ?? cause); };
const pointer = createBrowserPointerInput({ engine, scope, width: WIDTH, height: HEIGHT });
const hover = createBrowserHoverInput({ engine, scope, canvas, width: WIDTH, height: HEIGHT, onError: fail });
const keyboard = createBrowserKeyboardInput({ engine, scope, onFocusChange: () => queueMicrotask(show) });
const holds = id => keyboard.getSnapshot().focusedId === id;
const ringed = id => { const focus = keyboard.getSnapshot(); return focus.focusVisible && focus.focusedId === id; };

const page = engine.stage.addChild(scope.use(new Sprite()));
/** A line of text. The cache prepares four at a time at most, so the lines are prepared one after another. */
async function line(parent, x, y, fontSize, text, colour = COLORS.ink) {
  const field = createTextField(engine, scope, cache);
  field.x = x; field.y = y; parent.addChild(field);
  field.setRequest({ text, fontFamily: FAMILY, fontSize, fontWeight: 400, fontStyle: 'normal', lineHeight: Math.round(fontSize * 1.3), locale: 'zh-CN', direction: 'ltr', density: 2, fillColor: colour });
  await field.prepare();
}
function surface(parent, box) {
  const ring = parent.addChild(scope.use(new Sprite())), sprite = parent.addChild(scope.use(new Sprite()));
  ring.x = box.x - 3; ring.y = box.y - 3; sprite.x = box.x; sprite.y = box.y; sprite.touchEnabled = true; sprite.hitArea = { x: 0, y: 0, width: box.width, height: box.height };
  return { box, sprite, ring, hover: createHoverControl({ hover, target: sprite, onHoverChange: () => show() }),
    paint(fill, focused) {
      ring.visible = focused; ring.graphics.clear(); ring.graphics.beginFill(COLORS.ring).drawRect(0, 0, box.width + 6, box.height + 6).endFill();
      sprite.graphics.clear(); sprite.graphics.beginFill(fill).drawRect(0, 0, box.width, box.height).endFill();
    } };
}

await line(engine.stage, 20, 10, 18, '门派 / Sect');
// The tabs are inside one display object, which is what the keyboard stops at.
const strip = engine.stage.addChild(scope.use(new Sprite()));
const tabs = Object.fromEntries(TABS.map(({ key }, index) => [key, surface(strip, { x: 20 + index * 126, y: 44, width: 120, height: 30 })]));
for (const [index, { name }] of TABS.entries()) await line(engine.stage, 30 + index * 126, 50, 14, name);
const group = createSelectionGroup({ input: pointer, items: TABS.map(({ key }) => ({ key, target: tabs[key].sprite })), selected: 'members', onChange: () => show() });
keyboard.registerTarget({ id: 'tabs', target: strip, tabIndex: 1 });
// The arrow keys move the selection, and the panel follows it at once: nothing more is pressed to show a panel.
createControlKeys({ keyboard, target: strip, kind: 'selection', control: group, orientation: 'horizontal' });

// One container for each panel. Only the one that is selected is visible: what is not visible takes no press and no focus.
const panels = Object.fromEntries(TABS.map(({ key }) => [key, engine.stage.addChild(scope.use(new DisplayObjectContainer()))]));
for (const key of ['members', 'stores']) for (const [index, text] of LINES[key].entries()) await line(panels[key], PANEL.x + 16, PANEL.y + 18 + index * 30, 15, text);
const bars = {};
for (const [index, skill] of SKILLS.entries()) {
  await line(panels.training, PANEL.x + 16, PANEL.y + 16 + index * 36, 14, skill.name, COLORS.hint);
  bars[skill.key] = { sprite: panels.training.addChild(scope.use(new Sprite())), box: { x: PANEL.x + BAR.x, y: PANEL.y + 20 + index * 36, width: BAR.width, height: BAR.height } };
  bars[skill.key].sprite.x = bars[skill.key].box.x; bars[skill.key].sprite.y = bars[skill.key].box.y;
}
const train = surface(panels.training, { x: PANEL.x + 16, y: PANEL.y + 140, width: 130, height: 32 });
await line(panels.training, PANEL.x + 30, PANEL.y + 147, 14, '修炼 / Train');
const training = createActionControl({ input: pointer, target: train.sprite, onPressChange: () => show(),
  onActivate() { sessions++; for (const skill of SKILLS) progress[skill.key] = Math.min(100, progress[skill.key] + skill.gain); show(); } });
keyboard.registerTarget({ id: 'train', target: train.sprite, tabIndex: 2 });
const trainKeys = createControlKeys({ keyboard, target: train.sprite, kind: 'action', control: training, onPressChange: () => show() });
const done = () => SKILLS.every(skill => progress[skill.key] === 100);

// What the screen is to someone who does not see it.
const semantics = createUiSemantics();
semantics.add({ id: 'tabs', role: 'tablist', describe: () => ({ name: '门派 / Sect', bounds: { x: 20, y: 44, width: 372, height: 30 } }) });
for (const [index, { key, name }] of TABS.entries()) semantics.add({ id: 'tab-' + key, role: 'tab', parent: 'tabs',
  onActivate: () => { group.select(key); },
  // A tab that is asked to take the focus is selected, as it is when the arrow keys reach it.
  onFocus: () => { group.select(key); keyboard.focus('tabs', { visible: true }); },
  describe: () => ({ name, bounds: tabs[key].box, selected: group.selected === key, position: { index: index + 1, size: TABS.length }, focused: holds('tabs') && group.selected === key,
    // Only the panel of the selected tab is there to be named.
    ...(group.selected === key ? { controls: 'panel-' + key } : {}) }) });
for (const { key, name } of TABS) semantics.add({ id: 'panel-' + key, role: 'tabpanel', describe: () => ({ name, hidden: group.selected !== key, bounds: PANEL }) });
for (const key of ['members', 'stores']) for (const [index, text] of LINES[key].entries()) semantics.add({ id: key + '-' + index, role: 'text', parent: 'panel-' + key,
  describe: () => ({ name: text, bounds: { x: PANEL.x + 16, y: PANEL.y + 18 + index * 30, width: 300, height: 20 } }) });
for (const skill of SKILLS) semantics.add({ id: 'skill-' + skill.key, role: 'progressbar', parent: 'panel-training',
  describe: () => ({ name: skill.name, bounds: bars[skill.key].box, range: { now: progress[skill.key], min: 0, max: 100 } }) });
semantics.add({ id: 'train', role: 'button', parent: 'panel-training', onActivate: () => { training.press(); training.release(); }, onFocus: () => keyboard.focus('train', { visible: true }),
  describe: () => ({ name: '修炼 / Train', bounds: train.box, disabled: !training.enabled, focused: holds('train') }) });
const projection = createBrowserSemantics({ semantics, canvas, width: WIDTH, height: HEIGHT, label: 'Sect / 门派', onError: fail });

/** What a check reads: plain values only. */
export function readSnapshot() {
  const focus = keyboard.getSnapshot();
  return { selected: group.selected, progress: { ...progress }, sessions, trainEnabled: training.enabled, focus: focus.focusedId, focusVisible: focus.focusVisible,
    hovered: [...TABS.map(({ key }) => [key, tabs[key]]), ['train', train]].filter(([, part]) => part.hover.hovered).map(([key]) => key),
    renders, failure, semantics: { focused: semantics.snapshot.focused, nodes: semantics.snapshot.nodes.length, projection: projection.state } };
}
function show() {
  if (scope.state !== 'open') return;
  for (const { key } of TABS) panels[key].visible = group.selected === key;
  // Trained to the end, the button has nothing more to do. A button that held the focus gives it to the tabs.
  if (training.enabled === done()) { training.setEnabled(!done()); if (done() && holds('train')) keyboard.focus('tabs', { visible: keyboard.getSnapshot().focusVisible }); }
  page.graphics.clear(); page.graphics.beginFill(COLORS.page).drawRect(0, 0, WIDTH, HEIGHT).beginFill(COLORS.panel).drawRect(PANEL.x, PANEL.y - 4, PANEL.width, PANEL.height + 4).endFill();
  for (const { key } of TABS) tabs[key].paint(group.selected === key ? COLORS.tabOn : tabs[key].hover.hovered ? COLORS.tabHover : COLORS.tab, ringed('tabs') && group.selected === key);
  for (const skill of SKILLS) {
    const { sprite, box } = bars[skill.key];
    sprite.graphics.clear(); sprite.graphics.beginFill(COLORS.track).drawRect(0, 0, box.width, box.height).beginFill(COLORS.fill).drawRect(0, 0, Math.round(box.width * progress[skill.key] / 100), box.height).endFill();
  }
  train.paint(!training.enabled ? COLORS.tab : training.pressed || trainKeys.pressed ? COLORS.buttonPressed : train.hover.hovered ? COLORS.buttonHover : COLORS.button, ringed('train'));
  try { semantics.publish(); } catch (cause) { fail(cause); }
  status.textContent = failure ? 'Failed / 失败：' + failure : TABS.find(({ key }) => key === group.selected).name + ' · ' + SKILLS.map(skill => skill.name.split(' ')[0] + ' ' + progress[skill.key] + '%').join(' · ');
  stateView.textContent = JSON.stringify(readSnapshot(), null, 2);
  engine.renderSharedFrame(drawn); renders++;
}
const drawn = Object.freeze({ width: WIDTH, height: HEIGHT, clearColor: 0x000000, clearAlpha: 1 });
globalThis.__egretUiTabsExample = { readSnapshot };
show();
