import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createEngine, Sprite } from '@egret/engine';
import { host } from './helpers.mjs';

// Controlled WebIDL boundary units use genuine public Engine/Scope/display state.
// They establish adapter behavior only; native browser qualification is separate.
async function publicFactory() {
  const metadata = JSON.parse(await readFile(new URL('../packages/engine/package.json', import.meta.url), 'utf8'));
  assert.ok(metadata.exports['./web/pointer'], 'public browser pointer entry must exist');
  const module = await import('@egret/engine/web/pointer');
  return module.createBrowserPointerInput;
}
function controlledBrowser() {
  const BaseEvent = globalThis.Event, BaseTarget = globalThis.EventTarget;
  const values = new WeakMap(), styles = new WeakMap(), rects = new WeakMap(), eventValues = new WeakMap();
  const installed = [], captures = new Set(), trace = [], hooks = {};
  const rectValue = { left: 10, top: 20, width: 200, height: 160 };
  const css = { transform: 'none', perspective: 'none', translate: 'none', rotate: 'none', scale: 'none', zoom: '1', 'object-fit': 'fill', 'padding-top': '0px', 'padding-right': '0px', 'padding-bottom': '0px', 'padding-left': '0px', 'border-top-width': '0px', 'border-right-width': '0px', 'border-bottom-width': '0px', 'border-left-width': '0px' };
  function read(map, object, key) { const value = map.get(object); if (!value) throw new TypeError('controlled WebIDL receiver'); return value[key]; }
  class Target extends BaseTarget {
    addEventListener(type, callback, options) { const pair = { target: this, type, callback, options, removed: false }; installed.push(pair); hooks.add?.(pair); super.addEventListener(type, callback, options); }
    removeEventListener(type, callback, options) { super.removeEventListener(type, callback, options); for (const pair of installed) if (pair.target === this && pair.type === type && pair.callback === callback) pair.removed = true; hooks.remove?.({ target: this, type, callback, options }); }
  }
  class Style {
    constructor(initial = {}) { styles.set(this, { ...initial }); }
    getPropertyValue(name) { return read(styles, this, name)?.value ?? ''; }
    getPropertyPriority(name) { return read(styles, this, name)?.priority ?? ''; }
    setProperty(name, value, priority = '') { if (!styles.has(this)) throw new TypeError('style'); styles.get(this)[name] = { value, priority }; }
    removeProperty(name) { const value = this.getPropertyValue(name); delete styles.get(this)[name]; return value; }
  }
  class Node extends Target {
    get ownerDocument() { return read(values, this, 'ownerDocument'); }
    get parentNode() { return read(values, this, 'parentNode'); }
    get nodeType() { return read(values, this, 'nodeType'); }
    get isConnected() { let current = this; for (let n = 0; n < 100 && current; n++) { if (current === document) return true; current = values.get(current)?.parentNode; } return false; }
  }
  class Element extends Node {
    getBoundingClientRect() { return new Rect(rectValue); }
    setPointerCapture(id) { hooks.capture?.(id); captures.add(id); trace.push(['capture', id]); hooks.afterCapture?.(id); }
    releasePointerCapture(id) { captures.delete(id); trace.push(['release', id]); hooks.release?.(id); emit(canvas, 'lostpointercapture', { pointerId: id }); }
    hasPointerCapture(id) { return captures.has(id); }
  }
  class HTMLElement extends Element { get style() { return read(values, this, 'style'); } }
  class Canvas extends HTMLElement { get width() { if (!values.has(this)) throw new TypeError('canvas'); return 100; } }
  class Document extends Node {
    get defaultView() { return read(values, this, 'defaultView'); }
    get visibilityState() { return read(values, this, 'visibilityState'); }
  }
  class Window extends Target { getComputedStyle(element) { return read(values, element, 'computedStyle'); } }
  class Rect {
    constructor(value) { rects.set(this, { ...value }); }
    get left() { return read(rects, this, 'left'); } get top() { return read(rects, this, 'top'); }
    get width() { return read(rects, this, 'width'); } get height() { return read(rects, this, 'height'); }
  }
  class MouseEvent extends BaseEvent {
    get clientX() { return read(eventValues, this, 'clientX'); } get clientY() { return read(eventValues, this, 'clientY'); }
    get buttons() { return read(eventValues, this, 'buttons'); }
  }
  class PointerEvent extends MouseEvent {
    constructor(type, fields) { super(type); eventValues.set(this, { pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 60, buttons: 1, isPrimary: false, pressure: 0.5, width: 2, height: 4, ...fields }); }
    get pointerId() { return read(eventValues, this, 'pointerId'); } get pointerType() { return read(eventValues, this, 'pointerType'); }
    get pressure() { return read(eventValues, this, 'pressure'); } get width() { return read(eventValues, this, 'width'); } get height() { return read(eventValues, this, 'height'); }
  }
  const document = new Document(), window = new Window(), html = new HTMLElement(), parent = new HTMLElement(), canvas = new Canvas();
  values.set(document, { nodeType: 9, ownerDocument: null, parentNode: null, defaultView: window, visibilityState: 'visible' });
  for (const [element, ancestor] of [[html, document], [parent, html], [canvas, parent]]) values.set(element, { nodeType: 1, ownerDocument: document, parentNode: ancestor, style: new Style(), computedStyle: new Style(Object.fromEntries(Object.entries(css).map(([k, value]) => [k, { value, priority: '' }]))) });
  window.visualViewport = new Target(); window.devicePixelRatio = 3;
  const globals = { EventTarget: Target, Event: BaseEvent, Node, Element, HTMLElement, HTMLCanvasElement: Canvas, Document, Window, CSSStyleDeclaration: Style, DOMRectReadOnly: Rect, MouseEvent, PointerEvent, window, document };
  const originals = new Map();
  function emit(target, type, fields = {}) { const event = type.startsWith('pointer') || type === 'lostpointercapture' ? new PointerEvent(type, fields) : new BaseEvent(type); BaseTarget.prototype.dispatchEvent.call(target, event); return event; }
  return {
    canvas, parent, window, document, captures, installed, trace, hooks, emit,
    install() { for (const [key, value] of Object.entries(globals)) { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); } },
    restore() { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } },
    rect(next) { Object.assign(rectValue, next); },
    css(element, name, value) { values.get(element).computedStyle.setProperty(name, value); },
    hidden() { values.get(document).visibilityState = 'hidden'; emit(document, 'visibilitychange'); },
    active() { return installed.filter(pair => !pair.removed); },
  };
}
async function fixture(run, options = {}) {
  const factory = await publicFactory(), browser = controlledBrowser(); browser.install();
  const fixtureHost = host({ surface: browser.canvas }), diagnostics = [], notifications = [];
  let engine, input;
  try {
    engine = await createEngine({ host: fixtureHost.adapter, onDiagnostic: value => diagnostics.push(value) });
    const scope = engine.createScope();
    const left = scope.use(new Sprite()), right = scope.use(new Sprite());
    for (const [node, x] of [[left, 0], [right, 50]]) { node.x = x; node.touchEnabled = true; node.hitArea = { x: 0, y: 0, width: 50, height: 80 }; engine.stage.addChild(node); }
    browser.canvas.style.setProperty('touch-action', 'pan-x', 'important');
    const settings = { engine, scope, width: 100, height: 80, onContact: n => { notifications.push(n); options.onContact?.(n); }, ...(options.capacity ? { capacity: options.capacity } : {}) };
    if (options.setup) options.setup(browser);
    if (options.create !== false) input = factory(settings);
    await run({ factory, settings, browser, engine, scope, input, left, right, diagnostics, notifications });
  } finally {
    input?.dispose(); await engine?.dispose(); browser.restore();
  }
}

test('MP browser admits both non-primary touches and maps CSS to logical coordinates once', async () => fixture(f => {
  f.browser.emit(f.browser.canvas, 'pointerdown', { pointerId: 10, clientX: 50, clientY: 60 });
  f.browser.emit(f.browser.canvas, 'pointerdown', { pointerId: 11, clientX: 170, clientY: 100 });
  assert.equal(f.input.contacts.length, 2);
  assert.deepEqual(f.notifications.map(n => [n.kind, n.contact.globalX, n.contact.globalY, n.target === f.left ? 'left' : 'right']), [['begin', 20, 20, 'left'], ['begin', 80, 40, 'right']]);
  assert.deepEqual([...f.browser.captures], [10, 11]);
  f.browser.emit(f.browser.window, 'pointermove', { pointerId: 10, clientX: 230, clientY: 180 });
  assert.deepEqual([f.notifications.at(-1).contact.globalX, f.notifications.at(-1).contact.globalY, f.notifications.at(-1).target], [110, 80, f.left]);
  f.browser.emit(f.browser.window, 'pointerup', { pointerId: 10, buttons: 0 });
  assert.deepEqual(f.notifications.map(n => n.kind), ['begin', 'begin', 'move', 'end']);
  assert.deepEqual([...f.browser.captures], [11]);
  assert.equal(f.input.contacts.length, 1);
}));
for (const [event, reason, target] of [['pointercancel', 'pointercancel', 'window'], ['lostpointercapture', 'lostcapture', 'canvas'], ['blur', 'blur', 'window'], ['pagehide', 'pagehide', 'window']]) test('MP browser cancels on ' + event, async () => fixture(f => {
  f.browser.emit(f.browser.canvas, 'pointerdown'); f.browser.emit(f.browser[target], event);
  assert.deepEqual(f.notifications.map(n => [n.kind, n.reason]), [['begin', undefined], ['cancel', reason]]);
  assert.equal(f.input.contacts.length, 0); assert.equal(f.browser.captures.size, 0);
}));
test('MP browser hidden page cancels active contacts', async () => fixture(f => {
  f.browser.emit(f.browser.canvas, 'pointerdown'); f.browser.hidden();
  assert.equal(f.notifications.at(-1).reason, 'hidden'); assert.equal(f.input.contacts.length, 0);
}));
test('MP browser viewport cancels before revision changes and only fresh downs resume', async () => fixture(f => {
  f.browser.emit(f.browser.canvas, 'pointerdown'); const revision = f.input.viewportRevision;
  f.browser.rect({ width: 100 }); f.browser.emit(f.browser.window, 'pointermove');
  assert.equal(f.notifications.at(-1).reason, 'viewport'); assert.equal(f.notifications.at(-1).contact.viewportRevision, revision);
  assert.equal(f.input.viewportRevision, revision + 1); assert.equal(f.input.contacts.length, 0);
  f.browser.emit(f.browser.canvas, 'pointerdown', { pointerId: 2 });
  assert.equal(f.notifications.at(-1).contact.globalX, 40); assert.equal(f.notifications.at(-1).contact.viewportRevision, revision + 1);
}));
test('MP browser unsupported ancestor transform retires input and reports', async () => fixture(f => {
  f.browser.emit(f.browser.canvas, 'pointerdown'); f.browser.css(f.browser.parent, 'transform', 'matrix(1, 0, 0, 1, 1, 0)');
  f.browser.emit(f.browser.window, 'pointermove');
  assert.equal(f.input.state, 'closed'); assert.equal(f.input.contacts.length, 0); assert.ok(f.diagnostics.length > 0); assert.equal(f.browser.active().length, 0);
}));
test('MP browser owner closure releases captures and restores exact touch-action priority', async () => fixture(f => {
  assert.equal(f.browser.canvas.style.getPropertyValue('touch-action'), 'none');
  f.browser.emit(f.browser.canvas, 'pointerdown'); f.scope.dispose();
  assert.equal(f.input.state, 'closed'); assert.equal(f.browser.captures.size, 0); assert.equal(f.browser.active().length, 0);
  assert.equal(f.browser.canvas.style.getPropertyValue('touch-action'), 'pan-x'); assert.equal(f.browser.canvas.style.getPropertyPriority('touch-action'), 'important');
}));
test('MP browser failed setup rolls back attempted listeners and local style', async () => fixture(f => {
  assert.throws(() => f.factory(f.settings));
  assert.equal(f.browser.active().length, 0); assert.equal(f.browser.canvas.style.getPropertyValue('touch-action'), 'pan-x');
}, { create: false, setup: b => { b.hooks.add = pair => { if (pair.type === 'pointermove') throw new Error('assigned native add failure'); }; } }));
test('MP browser callback failure closes native delivery and reports', async () => fixture(f => {
  f.browser.emit(f.browser.canvas, 'pointerdown');
  assert.equal(f.input.state, 'closed'); assert.equal(f.browser.active().length, 0); assert.equal(f.browser.captures.size, 0); assert.ok(f.diagnostics.length > 0);
}, { onContact: () => { throw new Error('assigned user callback failure'); } }));
test('MP browser capacity refusal preserves already accepted contact', async () => fixture(f => {
  for (const pointerId of [1, 2, 3, 4, 5, 6]) f.browser.emit(f.browser.canvas, 'pointerdown', { pointerId });
  assert.equal(f.input.state, 'active'); assert.equal(f.input.contacts.length, 5); assert.deepEqual([...f.browser.captures], [1, 2, 3, 4, 5]);
  f.browser.emit(f.browser.window, 'pointerup', { pointerId: 1, buttons: 0 }); assert.equal(f.input.contacts.length, 4);
}, { capacity: 5 }));
test('MP browser WebGL loss suspends until explicit interactive readiness', async () => fixture(f => {
  f.browser.emit(f.browser.canvas, 'pointerdown'); f.browser.emit(f.browser.canvas, 'webglcontextlost');
  assert.equal(f.input.state, 'suspended'); assert.equal(f.notifications.at(-1).reason, 'suspended'); assert.equal(f.browser.captures.size, 0);
  f.browser.emit(f.browser.canvas, 'webglcontextrestored'); f.browser.emit(f.browser.canvas, 'pointerdown', { pointerId: 2 }); assert.equal(f.input.contacts.length, 0);
  f.input.setInteractive(true); f.browser.emit(f.browser.canvas, 'pointerdown', { pointerId: 3 }); assert.equal(f.input.contacts.length, 1);
}));

test('MP browser refuses a second bridge for one live canvas without changing the first', async () => fixture(f => {
  assert.throws(() => f.factory(f.settings));
  assert.equal(f.input.state, 'active'); assert.equal(f.browser.canvas.style.getPropertyValue('touch-action'), 'none');
  f.browser.emit(f.browser.canvas, 'pointerdown'); assert.equal(f.input.contacts.length, 1); assert.equal(f.notifications.length, 1);
  f.input.dispose(); const next = f.factory(f.settings);
  try { f.input.dispose(); assert.equal(next.state, 'active'); assert.equal(f.browser.canvas.style.getPropertyValue('touch-action'), 'none'); }
  finally { next.dispose(); }
  assert.equal(f.browser.canvas.style.getPropertyValue('touch-action'), 'pan-x'); assert.equal(f.browser.active().length, 0);
}));

test('MP browser native capture failure closes and releases delivery', async () => fixture(f => {
  f.browser.emit(f.browser.canvas, 'pointerdown');
  assert.equal(f.input.state, 'closed'); assert.equal(f.input.contacts.length, 0); assert.equal(f.browser.active().length, 0); assert.equal(f.browser.captures.size, 0); assert.ok(f.diagnostics.length > 0);
}, { setup: b => { b.hooks.capture = () => { throw new Error('assigned native capture failure'); }; } }));

test('MP browser terminal observer still clears application action when native release throws', async () => fixture(f => {
  f.browser.emit(f.browser.canvas, 'pointerdown'); f.browser.hooks.release = () => { throw new Error('assigned native release failure'); };
  f.browser.emit(f.browser.window, 'pointerup', { buttons: 0 });
  assert.deepEqual(f.notifications.map(n => n.kind), ['begin', 'end']); assert.equal(f.input.state, 'closed'); assert.equal(f.browser.active().length, 0); assert.ok(f.diagnostics.length > 0);
}));

test('MP browser retains admitted dimensions and observer after caller options mutate', async () => fixture(f => {
  f.settings.width = 1; f.settings.height = 1; f.settings.onContact = () => { throw new Error('replacement callback must not run'); };
  f.browser.emit(f.browser.canvas, 'pointerdown');
  assert.equal(f.input.state, 'active'); assert.equal(f.notifications.length, 1); assert.equal(f.notifications[0].contact.globalX, 20); assert.equal(f.notifications[0].contact.globalY, 20);
}));

test('MP browser rechecks mapping after a viewport-cancel observer changes layout', async () => {
  let browser;
  await fixture(f => {
    browser = f.browser; browser.emit(browser.canvas, 'pointerdown'); browser.rect({ width: 100 });
    browser.emit(browser.canvas, 'pointerdown', { pointerId: 2 });
    assert.equal(f.notifications.at(-1).kind, 'begin'); assert.equal(f.notifications.at(-1).contact.globalX, 10);
  }, { onContact: n => { if (n.reason === 'viewport') browser.rect({ width: 400 }); } });
});

test('MP browser closure during native listener acquisition removes the final in-flight pair', async () => fixture(f => {
  f.browser.hooks.add = pair => { if (pair.type === 'pointermove') f.scope.dispose(); };
  assert.throws(() => f.factory(f.settings));
  assert.equal(f.browser.active().length, 0); assert.equal(f.browser.captures.size, 0);
  assert.equal(f.browser.canvas.style.getPropertyValue('touch-action'), 'pan-x'); assert.equal(f.browser.canvas.style.getPropertyPriority('touch-action'), 'important');
}, { create: false }));

test('MP browser compensates late native capture when disposal occurs during acquisition', async () => fixture(f => {
  f.browser.hooks.capture = () => f.input.dispose();
  f.browser.emit(f.browser.canvas, 'pointerdown');
  assert.equal(f.input.state, 'closed'); assert.equal(f.input.contacts.length, 0); assert.equal(f.browser.captures.size, 0); assert.equal(f.browser.active().length, 0);
  assert.deepEqual(f.browser.trace, [['capture', 1], ['release', 1]]);
}));

test('MP browser compensates late capture when its session cancels during acquisition', async () => fixture(f => {
  f.browser.hooks.capture = () => f.input.cancel(f.input.contacts[0].session, 'pointercancel');
  f.browser.emit(f.browser.canvas, 'pointerdown');
  assert.equal(f.input.state, 'active'); assert.equal(f.input.contacts.length, 0); assert.equal(f.browser.captures.size, 0);
  assert.deepEqual(f.notifications.map(n => n.kind), ['begin', 'cancel']);
}));

test('MP browser preserves capture failure while releasing capture acquired after closure', async () => fixture(f => {
  const marker = Object.freeze({ assignedCaptureFailure: true });
  f.browser.hooks.capture = () => f.input.dispose();
  f.browser.hooks.afterCapture = () => { throw marker; };
  f.browser.emit(f.browser.canvas, 'pointerdown');
  assert.equal(f.input.state, 'closed'); assert.equal(f.browser.captures.size, 0); assert.equal(f.browser.active().length, 0);
  assert.equal(f.diagnostics.at(-1).cause, marker);
}));

test('MP browser capture compensation preserves original and secondary release failures', async () => fixture(f => {
  const first = Object.freeze({ assignedCaptureFailure: true }), secondary = Object.freeze({ assignedCompensationFailure: true });
  f.browser.hooks.capture = () => f.input.dispose();
  f.browser.hooks.afterCapture = () => { throw first; };
  f.browser.hooks.release = () => { throw secondary; };
  f.browser.emit(f.browser.canvas, 'pointerdown');
  const failure = f.diagnostics.at(-1).cause;
  assert.equal(f.input.state, 'closed'); assert.equal(f.browser.captures.size, 0); assert.equal(f.browser.active().length, 0);
  assert.equal(failure.cause, first); assert.deepEqual(failure.cleanupErrors, [secondary]);
}));

test('MP browser listener acquisition preserves first failure when compensating removal also fails', async () => fixture(f => {
  const first = Object.freeze({ assignedAddFailure: true }), secondary = Object.freeze({ assignedRemoveFailure: true });
  f.browser.hooks.add = pair => { if (pair.type === 'pointermove') { f.scope.dispose(); throw first; } };
  f.browser.hooks.remove = pair => { if (pair.type === 'pointermove') throw secondary; };
  let failure;
  try { f.factory(f.settings); } catch (cause) { failure = cause; }
  assert.ok(failure); assert.equal(failure.cause.cause, first); assert.deepEqual(failure.cause.cleanupErrors, [secondary]);
  assert.equal(f.browser.active().length, 0); assert.equal(f.browser.canvas.style.getPropertyValue('touch-action'), 'pan-x');
}, { create: false }));
