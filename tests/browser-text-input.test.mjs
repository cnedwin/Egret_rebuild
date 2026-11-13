// SPDX-License-Identifier: Apache-2.0
// Platform text entry over a canvas, against a small stand-in for the page: what it adds to the page, where it
// puts the field, and which events end a session. The behaviour of real input methods is checked in a browser
// by examples/text-input/verify.mjs.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// The stand-in takes these seven names of the global object for the length of this file, and gives them back.
const NAMES = ['window', 'document', 'HTMLElement', 'HTMLCanvasElement', 'CSSStyleSheet', 'ResizeObserver', 'reportError'];
const original = NAMES.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
after(() => { for (const [name, descriptor] of original) if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; });

class Target {
  listeners = [];
  addEventListener(type, listener, capture = false) { this.listeners.push({ type, listener, capture: capture === true }); }
  removeEventListener(type, listener, capture = false) { this.listeners = this.listeners.filter(row => !(row.type === type && row.listener === listener && row.capture === (capture === true))); }
  count(type) { return this.listeners.filter(row => type === undefined || row.type === type).length; }
}
/** Calls the listeners of one target, as the page would for an event that reaches it. */
function fire(target, type, fields = {}) {
  const event = { type, target, timeStamp: page.clock, key: '', keyCode: 0, isComposing: false, ctrlKey: false, metaKey: false, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...fields };
  for (const row of target.listeners.slice()) if (row.type === type) row.listener(event);
  return event;
}
class Style { setProperty(name, value) { this[name] = value; } }
class HTMLElement extends Target {
  style = new Style(); attributes = new Map(); children = []; parentElement = null; box = { left: 0, top: 0, width: 100, height: 100 };
  value = ''; selectionStart = 0; selectionEnd = 0; ownerDocument;
  constructor(tagName, ownerDocument) { super(); this.tagName = tagName; this.ownerDocument = ownerDocument; }
  get isConnected() { for (let node = this; node; node = node.parentElement) if (node === this.ownerDocument.body) return true; return false; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  hasAttribute(name) { return this.attributes.has(name); }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  contains(other) { for (let node = other; node; node = node.parentElement) if (node === this) return true; return false; }
  // The page gives focus to the body when the focused element leaves it.
  remove() { const parent = this.parentElement, document = this.ownerDocument; if (!parent) return; if (this.contains(document.activeElement)) document.activeElement = document.body; parent.children = parent.children.filter(child => child !== this); this.parentElement = null; }
  getBoundingClientRect() { return { ...this.box }; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  focus() { const document = this.ownerDocument, previous = document.activeElement; if (previous === this) return; document.activeElement = this; if (previous && previous !== document.body) fire(previous, 'blur'); }
}
class HTMLCanvasElement extends HTMLElement {}
class Sheet { rules = ''; replaceSync(text) { this.rules = text; } }
let page;
/** A page with one canvas of 800 x 600 CSS pixels at (60, 40). */
function install({ tabindex = false, sheets = true } = {}) {
  const document = new Target(), window = new Target();
  Object.assign(document, { activeElement: null, adoptedStyleSheets: sheets ? [] : undefined, createElement: tag => new HTMLElement(tag.toUpperCase(), document) });
  document.body = new HTMLElement('BODY', document); document.activeElement = document.body;
  const holder = document.body.appendChild(new HTMLElement('DIV', document)), canvas = holder.appendChild(new HTMLCanvasElement('CANVAS', document));
  canvas.box = { left: 60, top: 40, width: 800, height: 600 };
  if (tabindex) canvas.setAttribute('tabindex', '0');
  page = { document, window, holder, canvas, clock: 1000, reported: [] };
  window.performance = { now: () => page.clock }; window.visualViewport = new Target();
  const values = { window, document, HTMLElement, HTMLCanvasElement, CSSStyleSheet: sheets ? Sheet : undefined, ResizeObserver: undefined, reportError: cause => page.reported.push(cause) };
  for (const name of NAMES) Object.defineProperty(globalThis, name, { value: values[name], writable: true, configurable: true, enumerable: false });
  return page;
}
const { createBrowserTextInput } = await import('@egret/engine/web/text-input');
function create(extra = {}) { return createBrowserTextInput({ canvas: page.canvas, logicalWidth: 400, logicalHeight: 300, ...extra }); }
/** A request that records what the session reports. */
function request(log, extra = {}) {
  return { x: 100, y: 50, width: 200, height: 40, onChange: change => log.push(['change', change.value, change.composing]), onCommit: value => log.push(['commit', value]), onCancel: () => log.push(['cancel']), ...extra };
}
function field() { const wrapper = page.holder.children.find(child => child.tagName === 'DIV'); return wrapper?.children[0]; }
/** Text arrives at the caret, as typing, pasting and a finished composition deliver it. */
function type(node, text, fields = {}) {
  const start = node.selectionStart, end = node.selectionEnd;
  node.value = node.value.slice(0, start) + text + node.value.slice(end); node.selectionStart = node.selectionEnd = start + text.length;
  return fire(node, 'input', fields);
}
function code(action) { try { action(); } catch (cause) { return cause.code; } return undefined; }

test('TI01 importing and creating add nothing to the page, and options are checked', () => {
  install();
  const input = create();
  assert.deepEqual(input.getSnapshot(), { state: 'idle', value: '', composing: false });
  assert.equal(page.holder.children.length, 1);
  assert.equal(page.document.count() + page.window.count() + page.canvas.count(), 0);
  assert.equal(page.document.adoptedStyleSheets.length, 0);
  for (const options of [undefined, {}, { canvas: {}, logicalWidth: 400, logicalHeight: 300 }, { canvas: page.canvas, logicalWidth: 0, logicalHeight: 300 }, { canvas: page.canvas, logicalWidth: 400, logicalHeight: Number.NaN },
    { canvas: page.canvas, logicalWidth: 400, logicalHeight: 300, zIndex: 1.5 }, { canvas: page.canvas, logicalWidth: 400, logicalHeight: 300, isolateKeys: 1 }, { canvas: page.canvas, logicalWidth: 400, logicalHeight: 300, onError: 1 },
    { canvas: page.canvas, logicalWidth: 400, logicalHeight: 300, parent: {} }])
    assert.match(code(() => createBrowserTextInput(options)), /^BROWSER_TEXT_INPUT_(?:OPTIONS|SURFACE)$/);
  for (const bad of [undefined, { x: 0, y: 0, width: 0, height: 10 }, { x: 0, y: 0, width: 10 }, request([], { multiline: true, password: true }), request([], { maxLength: 0 }), request([], { maxLength: 1.5 }), request([], { value: 1 }),
    request([], { value: 'a\0' }), request([], { color: -1 }), request([], { backgroundColor: 0x1000000 }), request([], { fontSize: 0 }), request([], { fontWeight: 'heavy' }), request([], { textAlign: 'justify' }), request([], { select: 'start' }),
    request([], { blur: 'keep' }), request([], { inputMode: 'kana' }), request([], { enterKeyHint: 'ok' }), request([], { onCommit: 1 }), request([], { placeholder: 1 })])
    assert.equal(code(() => input.open(bad)), 'BROWSER_TEXT_INPUT_REQUEST');
  assert.equal(page.holder.children.length, 1);
  assert.equal(code(() => input.setValue('a')), 'BROWSER_TEXT_INPUT_IDLE');
  assert.equal(code(() => input.move({ x: 0, y: 0, width: 1, height: 1 })), 'BROWSER_TEXT_INPUT_IDLE');
  input.commit(); input.cancel(); input.sync(); input.resize(400, 300);
  page.canvas.remove();
  assert.equal(code(() => input.open(request([]))), 'BROWSER_TEXT_INPUT_SURFACE');
});

test('TI02 the field covers its rectangle of the stage, whatever the size of the canvas', () => {
  install();
  const input = create(), log = [];
  input.open(request(log));
  const node = field(), wrapper = node.parentElement;
  assert.equal(wrapper.parentElement, page.holder);
  assert.equal(wrapper.style.position, 'fixed'); assert.equal(wrapper.style.pointerEvents, 'none'); assert.equal(wrapper.style.zIndex, '1');
  // 800 x 600 CSS pixels show 400 x 300 logical units: the field keeps its logical size and is scaled by two.
  assert.deepEqual([node.style.left, node.style.top, node.style.width, node.style.height, node.style.transform, node.style.visibility], ['260px', '140px', '200px', '40px', 'scale(2,2)', 'visible']);
  input.move({ x: 0, y: 10, width: 400, height: 30 });
  assert.deepEqual([node.style.left, node.style.top, node.style.width, node.style.height], ['60px', '60px', '400px', '30px']);
  page.canvas.box = { left: 0, top: 0, width: 400, height: 150 }; fire(page.window, 'resize');
  assert.deepEqual([node.style.left, node.style.top, node.style.transform], ['0px', '5px', 'scale(1,0.5)']);
  input.resize(800, 300);
  assert.deepEqual([node.style.left, node.style.top, node.style.transform], ['0px', '5px', 'scale(0.5,0.5)']);
  // An ancestor that moves and halves fixed content: the wrapper measures it, and the field undoes it.
  wrapper.box = { left: 10, top: 20, width: 50, height: 50 }; fire(page.window.visualViewport, 'scroll');
  assert.deepEqual([node.style.left, node.style.top, node.style.transform], ['-20px', '-30px', 'scale(1,1)']);
  page.canvas.box = { left: 0, top: 0, width: 0, height: 0 }; fire(page.document, 'scroll');
  assert.equal(node.style.visibility, 'hidden');
  page.canvas.box = { left: 0, top: 0, width: 800, height: 300 }; input.sync();
  assert.equal(node.style.visibility, 'visible');
  assert.equal(code(() => input.move({ x: 0, y: 0, width: 0, height: 1 })), 'BROWSER_TEXT_INPUT_RECTANGLE');
  assert.equal(code(() => input.resize(0, 1)), 'BROWSER_TEXT_INPUT_SIZE');
  const other = page.document.body.appendChild(new HTMLElement('DIV', page.document)), second = create({ parent: other, zIndex: 7 });
  second.open(request([]));
  assert.equal(other.children.length, 1); assert.equal(other.children[0].style.zIndex, '7');
});

test('TI03 the request decides the kind of field and how it looks', () => {
  install();
  const input = create(), log = [];
  input.open(request(log, { value: '掌门', placeholder: '请输入门派名', placeholderColor: 0x8899aa, label: '门派名', locale: 'zh-CN', inputMode: 'text', enterKeyHint: 'done', fontFamily: '"Noto Sans SC", sans-serif', fontSize: 24,
    fontWeight: 700, lineHeight: 32, color: 0xffeecc, backgroundColor: 0x102030, textAlign: 'center', padding: 6, select: 'all' }));
  let node = field();
  assert.equal(node.tagName, 'INPUT'); assert.equal(node.type, 'text'); assert.equal(node.value, '掌门'); assert.equal(page.document.activeElement, node);
  assert.deepEqual([node.selectionStart, node.selectionEnd], [0, 2]);
  assert.deepEqual([node.placeholder, node.lang, node.inputMode, node.enterKeyHint, node.attributes.get('aria-label'), node.spellcheck], ['请输入门派名', 'zh-CN', 'text', 'done', '门派名', false]);
  assert.deepEqual([node.style.fontFamily, node.style.fontSize, node.style.fontWeight, node.style.lineHeight, node.style.color, node.style.caretColor, node.style.background, node.style.textAlign, node.style.padding],
    ['"Noto Sans SC", sans-serif', '24px', '700', '32px', '#ffeecc', '#ffeecc', '#102030', 'center', '0 6px']);
  assert.equal(node.style['--egret-text-input-placeholder'], '#8899aa');
  assert.equal(page.document.adoptedStyleSheets.length, 1); assert.match(page.document.adoptedStyleSheets[0].rules, /::placeholder/);
  input.open(request(log, { password: true, value: 'abc' }));
  node = field(); assert.equal(node.type, 'password'); assert.deepEqual([node.selectionStart, node.selectionEnd], [3, 3]); assert.equal(node.style.background, 'transparent');
  input.open(request(log, { multiline: true, value: '一\n二', padding: 4, placeholderColor: 0 }));
  node = field(); assert.equal(node.tagName, 'TEXTAREA'); assert.equal(node.value, '一\n二'); assert.equal(node.style.padding, '4px'); assert.equal(node.style.whiteSpace, 'pre-wrap');
  // One sheet serves every session, and opening a field ends the one before it.
  assert.equal(page.document.adoptedStyleSheets.length, 1);
  assert.deepEqual(log, [['cancel'], ['cancel']]);
  assert.equal(page.holder.children.filter(child => child.tagName === 'DIV').length, 1);
  // A page without constructed sheets keeps the platform colour of a placeholder.
  install({ sheets: false });
  create().open(request([], { placeholder: '名', placeholderColor: 0xff0000 }));
  assert.equal(field().placeholder, '名');
});

test('TI04 changes are reported with the state of the input method, and a composition is never cut short', () => {
  install();
  const input = create(), log = [];
  input.open(request(log, { maxLength: 4 }));
  const node = field();
  type(node, 'a'); fire(node, 'input');
  assert.deepEqual(log.splice(0), [['change', 'a', false]]);
  // Pinyin is provisional text: longer than the limit, and left alone until the candidate is chosen.
  fire(node, 'compositionstart'); type(node, 'nihaoshijie');
  assert.deepEqual(log.splice(0), [['change', 'anihaoshijie', true]]);
  assert.deepEqual(input.getSnapshot(), { state: 'open', value: 'anihaoshijie', composing: true });
  for (const fields of [{ key: 'Enter', isComposing: true }, { key: 'Enter', keyCode: 229 }, { key: 'Escape', isComposing: true }, { key: 'Enter' }]) assert.equal(fire(node, 'keydown', fields).prevented, false);
  assert.equal(input.getSnapshot().state, 'open');
  node.value = 'a你好世界'; node.selectionStart = node.selectionEnd = 5; fire(node, 'compositionend');
  // The excess is taken from what was just entered, before the caret, and the earlier text stays.
  assert.deepEqual(log.splice(0), [['change', 'a你好世', false]]);
  assert.deepEqual([node.selectionStart, node.selectionEnd], [4, 4]);
  // Inserted in the middle: the insertion is refused, not the tail.
  node.setSelectionRange(1, 1); type(node, '大');
  assert.equal(node.value, 'a你好世'); assert.deepEqual([node.selectionStart, node.selectionEnd], [1, 1]); assert.deepEqual(log.splice(0), []);
  // A character outside the basic plane counts once and is never split.
  node.value = '你好'; node.setSelectionRange(1, 1); fire(node, 'input'); type(node, '😀😀😀');
  assert.equal(node.value, '你😀😀好'); assert.deepEqual([node.selectionStart, node.selectionEnd], [5, 5]);
  assert.deepEqual(log.splice(0), [['change', '你好', false], ['change', '你😀😀好', false]]);
  input.setValue('一二三四五六');
  assert.equal(input.getSnapshot().value, '一二三四'); assert.deepEqual(log, []);
  assert.equal(code(() => input.setValue(1)), 'BROWSER_TEXT_INPUT_VALUE');
  input.open(request(log, { maxLength: 2, value: '😀一二' }));
  assert.equal(field().value, '😀一');
});

test('TI05 Enter commits, Escape cancels, and the field is gone before the game is told', () => {
  install();
  const input = create(), log = [];
  input.open(request(log, { onCommit(value) { log.push(['commit', value, input.getSnapshot().state, field() === undefined]); input.open(request(log, { value: 'next' })); } }));
  let node = field(); type(node, '青云门');
  const enter = fire(node, 'keydown', { key: 'Enter' });
  assert.equal(enter.prevented, true);
  assert.deepEqual(log.splice(0), [['change', '青云门', false], ['commit', '青云门', 'idle', true]]);
  assert.equal(node.count(), 0);
  node = field(); assert.equal(node.value, 'next'); assert.equal(page.document.activeElement, node);
  // Some platforms deliver the Enter that chose a candidate after the composition has ended, marked only by this key code.
  assert.equal(fire(node, 'keydown', { key: 'Enter', keyCode: 229 }).prevented, false); assert.equal(input.getSnapshot().state, 'open');
  // The key that begins a composition arrives before the composition is announced, marked as part of it.
  assert.equal(fire(node, 'keydown', { key: 'Enter', isComposing: true }).prevented, false); assert.equal(input.getSnapshot().state, 'open');
  assert.equal(fire(node, 'keydown', { key: 'Escape' }).prevented, true);
  assert.deepEqual(log.splice(0), [['cancel']]);
  assert.deepEqual(input.getSnapshot(), { state: 'idle', value: '', composing: false });
  assert.equal(page.document.count('pointerdown') + page.document.count('mousedown') + page.document.count('scroll') + page.window.count('resize') + page.window.visualViewport.count(), 0);
  // In a field of several lines Enter is a line break; Ctrl or Command with Enter commits.
  input.open(request(log, { multiline: true })); node = field(); type(node, 'a');
  assert.equal(fire(node, 'keydown', { key: 'Enter' }).prevented, false);
  assert.equal(fire(node, 'beforeinput', { inputType: 'insertLineBreak' }).prevented, false); assert.equal(input.getSnapshot().state, 'open');
  fire(node, 'keydown', { key: 'Enter', metaKey: true });
  assert.deepEqual(log.splice(0), [['change', 'a', false], ['commit', 'a']]);
  input.open(request(log, { value: 'b' })); input.commit(); input.commit(); input.open(request(log, { value: 'c' })); input.cancel();
  assert.deepEqual(log.splice(0), [['commit', 'b'], ['cancel']]);
  // An on-screen keyboard may send its Enter only as a line break to insert: in a single line that commits too.
  input.open(request(log, { value: 'd' })); node = field();
  assert.equal(fire(node, 'beforeinput', { inputType: 'insertText' }).prevented, false);
  fire(node, 'compositionstart'); assert.equal(fire(node, 'beforeinput', { inputType: 'insertLineBreak' }).prevented, false); fire(node, 'compositionend');
  assert.equal(input.getSnapshot().state, 'open');
  assert.equal(fire(node, 'beforeinput', { inputType: 'insertLineBreak' }).prevented, true);
  assert.deepEqual(log, [['commit', 'd']]);
});

test('TI06 a press elsewhere ends the session, but not the press that opened it', () => {
  install();
  const input = create(), log = [];
  page.clock = 2000; input.open(request(log, { value: 'x' }));
  const node = field();
  // The press that opened the session is older than it: its events arrive now, and must not close it.
  fire(page.document, 'pointerdown', { target: page.canvas, timeStamp: 1990 });
  assert.equal(fire(page.document, 'mousedown', { target: page.canvas, timeStamp: 1990 }).prevented, true);
  assert.equal(input.getSnapshot().state, 'open');
  assert.equal(fire(page.document, 'mousedown', { target: node }).prevented, false);
  // A press inside the field is the player's, and so is every press after it.
  fire(page.document, 'pointerdown', { target: node, timeStamp: 2100 });
  assert.equal(input.getSnapshot().state, 'open');
  assert.equal(fire(page.document, 'mousedown', { target: page.canvas, timeStamp: 2100 }).prevented, false);
  fire(page.document, 'pointerdown', { target: page.canvas, timeStamp: 2200 });
  assert.deepEqual(log.splice(0), [['commit', 'x']]);
  input.open(request(log, { value: 'y', blur: 'cancel' }));
  fire(page.document, 'pointerdown', { target: page.canvas, timeStamp: 2300 });
  assert.deepEqual(log.splice(0), [['cancel']]);
});

test('TI07 losing focus ends the session, except when the whole window loses it', () => {
  install();
  const input = create(), log = [], button = page.document.body.appendChild(new HTMLElement('BUTTON', page.document));
  input.open(request(log, { value: 'x' }));
  let node = field();
  // The window lost focus: the field is told, and is still the active element of the page.
  fire(node, 'blur');
  assert.equal(input.getSnapshot().state, 'open');
  button.focus();
  assert.deepEqual(log.splice(0), [['commit', 'x']]); assert.equal(page.document.activeElement, button);
  input.open(request(log, { value: 'y', blur: 'cancel' })); node = field(); button.focus();
  assert.deepEqual(log.splice(0), [['cancel']]);
});

test('TI08 a canvas that takes keys gets focus back, after the key that ended the session is released', () => {
  install({ tabindex: true });
  const input = create(), log = [];
  input.open(request(log, { value: 'a' })); input.commit();
  assert.equal(page.document.activeElement, page.canvas);
  input.open(request(log, { value: 'b' }));
  let node = field(); fire(node, 'keydown', { key: 'Enter' });
  page.document.activeElement = page.document.body;
  // Still held: the repeats and the release of Enter are not a key of the game.
  const repeat = fire(page.window, 'keydown', { key: 'Enter', target: page.document.body });
  assert.deepEqual([repeat.prevented, repeat.stopped], [true, true]);
  assert.equal(fire(page.window, 'keydown', { key: 'w', target: page.document.body }).stopped, false);
  assert.equal(page.document.activeElement, page.document.body);
  assert.equal(fire(page.window, 'keyup', { key: 'Enter', target: page.document.body }).stopped, true);
  assert.equal(page.document.activeElement, page.canvas);
  assert.equal(page.window.count('keydown') + page.window.count('keyup') + page.window.count('blur'), 0);
  // A window that loses focus never delivers the release.
  input.open(request(log)); fire(field(), 'keydown', { key: 'Escape' }); fire(page.window, 'blur');
  assert.equal(page.window.count('keydown') + page.window.count('keyup') + page.window.count('blur'), 0);
  // Focus that went elsewhere by the player's choice is left there.
  const button = page.document.body.appendChild(new HTMLElement('BUTTON', page.document));
  input.open(request(log)); button.focus();
  assert.equal(page.document.activeElement, button);
  install();
  const plain = create(); plain.open(request([])); page.document.activeElement = field(); plain.commit();
  assert.notEqual(page.document.activeElement, page.canvas);
});

test('TI09 keys typed into the field do not bubble to the shortcuts of the game, unless asked', () => {
  install();
  let input = create();
  input.open(request([]));
  let node = field();
  for (const type of ['keydown', 'keyup', 'keypress']) assert.equal(fire(node, type, { key: 'w' }).stopped, true);
  input.dispose();
  input = create({ isolateKeys: false }); input.open(request([])); node = field();
  for (const type of ['keydown', 'keyup', 'keypress']) assert.equal(fire(node, type, { key: 'w' }).stopped, false);
  fire(node, 'keydown', { key: 'Enter' });
  assert.equal(fire(page.window, 'keyup', { key: 'Enter' }).stopped, false);
});

test('TI10 an error thrown by the game is reported and does not leave a field behind', () => {
  install();
  const errors = [], input = create({ onError: cause => errors.push(cause.message) });
  input.open({ x: 0, y: 0, width: 10, height: 10, onChange() { throw new Error('change'); }, onCommit() { throw new Error('commit'); } });
  type(field(), 'a'); input.commit();
  assert.deepEqual(errors, ['change', 'commit']); assert.equal(field(), undefined); assert.equal(input.getSnapshot().state, 'idle');
  const silent = create();
  silent.open({ x: 0, y: 0, width: 10, height: 10, onCancel() { throw new Error('cancel'); } }); silent.cancel();
  assert.deepEqual(page.reported.map(cause => cause.message), ['cancel']);
});

test('TI11 dispose cancels the session, removes what was added, and refuses later use', () => {
  install();
  const input = create(), log = [];
  input.open(request(log, { placeholderColor: 0x123456 }));
  input.dispose(); input.dispose();
  assert.deepEqual(log, [['cancel']]);
  assert.equal(field(), undefined); assert.equal(page.document.adoptedStyleSheets.length, 0);
  assert.equal(page.document.count() + page.window.count() + page.window.visualViewport.count(), 0);
  assert.deepEqual(input.getSnapshot(), { state: 'disposed', value: '', composing: false });
  // A field that is replaced may answer by opening another, or by disposing: the opening that replaced it is refused.
  install();
  const busy = create();
  busy.open(request([], { onCancel() { busy.open(request([], { value: 'inner' })); } }));
  assert.equal(code(() => busy.open(request([], { value: 'outer' }))), 'BROWSER_TEXT_INPUT_REENTRANT');
  assert.equal(busy.getSnapshot().value, 'inner'); assert.equal(page.holder.children.filter(child => child.tagName === 'DIV').length, 1);
  const gone = create();
  gone.open(request([], { onCancel() { gone.dispose(); } }));
  assert.equal(code(() => gone.open(request([]))), 'BROWSER_TEXT_INPUT_DISPOSED');
  for (const action of [() => input.open(request(log)), () => input.commit(), () => input.cancel(), () => input.sync(), () => input.resize(1, 1), () => input.setValue(''), () => input.move({ x: 0, y: 0, width: 1, height: 1 })])
    assert.equal(code(action), 'BROWSER_TEXT_INPUT_DISPOSED');
});

test('TI13 a strict consumer compiles against the entry, and five misuses are refused', () => {
  const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--project', 'tests/types/text-input.json', '--pretty', 'false'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('TI12 the entry exports its factory and nothing else, and no other entry has it', async () => {
  assert.deepEqual(Object.keys(await import('@egret/engine/web/text-input')), ['createBrowserTextInput']);
  for (const entry of ['@egret/engine', '@egret/engine/webgl2', '@egret/engine/webgpu', '@egret/engine/web/keyboard', '@egret/engine/web/text', '@egret/runtime']) assert.equal('createBrowserTextInput' in await import(entry), false);
});
