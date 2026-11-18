// SPDX-License-Identifier: Apache-2.0
// The browser half of the game kit, driven by stand-in event targets: keys,
// mouse buttons, gamepads, focus loss, touch sticks and buttons, and storage.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createInputActions } from '@egret/engine/kit';
import {
  bindBrowserInputActions,
  browserSaveStorage,
  createTouchButton,
  createTouchStick
} from '@egret/engine/web/kit';

class Target {
  listeners = new Map();
  addEventListener(type, handler) {
    (this.listeners.get(type) ?? this.listeners.set(type, new Set()).get(type)).add(handler);
  }
  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }
  fire(type, fields = {}) {
    const event = {
      type,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...fields
    };
    for (const handler of [...(this.listeners.get(type) ?? [])]) handler(event);
    return event;
  }
  get count() {
    let n = 0;
    for (const set of this.listeners.values()) n += set.size;
    return n;
  }
}

function element() {
  const node = new Target();
  Object.assign(node, {
    children: [],
    style: {},
    dataset: {},
    hidden: false,
    ownerDocument: {
      createElement: () => {
        const child = element();
        return child;
      }
    },
    appendChild(child) {
      this.children.push(child);
      child.parent = this;
    },
    remove() {
      this.removed = true;
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 }),
    setPointerCapture() {}
  });
  return node;
}

const MAP = {
  jump: { bindings: ['Key:Space', 'Pad:a', 'Touch:jump'] },
  fire: { bindings: ['Mouse:0'] },
  move: {
    kind: 'vector',
    up: ['Key:KeyW'],
    down: ['Key:KeyS'],
    left: ['Key:KeyA'],
    right: ['Key:KeyD'],
    sticks: ['Pad:leftStick', 'Touch:stick']
  }
};

test('GB01 keys and mouse buttons drive actions; bound keys do not scroll the page; typing is left alone', () => {
  const saved = { window: globalThis.window, document: globalThis.document };
  const win = new Target();
  globalThis.addEventListener = win.addEventListener.bind(win);
  globalThis.removeEventListener = win.removeEventListener.bind(win);
  try {
    const keys = new Target(),
      canvas = new Target();
    const actions = createInputActions(MAP);
    const binding = bindBrowserInputActions(actions, { keyTarget: keys, pointerTarget: canvas, gamepads: false });
    const space = keys.fire('keydown', { code: 'Space', target: {} });
    assert.equal(actions.pressed('jump'), true);
    assert.equal(space.defaultPrevented, true);
    const free = keys.fire('keydown', { code: 'KeyZ', target: {} });
    assert.equal(free.defaultPrevented, false, 'an unbound key is passed on');
    keys.fire('keyup', { code: 'Space' });
    assert.equal(actions.pressed('jump'), false);
    keys.fire('keydown', { code: 'Space', target: { tagName: 'INPUT' } });
    assert.equal(actions.pressed('jump'), false, 'typing in a field is not a jump');
    canvas.fire('pointerdown', { button: 0, pointerType: 'mouse' });
    assert.equal(actions.pressed('fire'), true);
    win.fire('pointerup', { button: 0, pointerType: 'mouse' });
    assert.equal(actions.pressed('fire'), false);
    keys.fire('keydown', { code: 'KeyD', target: {} });
    win.fire('blur');
    assert.deepEqual(actions.vector('move'), { x: 0, y: 0 }, 'losing focus lets every key go');
    binding.dispose();
    assert.equal(keys.count + canvas.count, 0);
  } finally {
    delete globalThis.addEventListener;
    delete globalThis.removeEventListener;
    Object.assign(globalThis, saved);
  }
});

test('chorded mouse buttons keep independent action edges inside and outside the bound target', t => {
  const win = new Target(),
    canvas = new Target();
  for (const key of ['addEventListener', 'removeEventListener']) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value: win[key].bind(win) });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    });
  }
  const actions = createInputActions({
    attack: { bindings: ['Mouse:0'] },
    guard: { bindings: ['Mouse:2'] },
    aim: { bindings: ['Mouse:1'] }
  });
  const binding = bindBrowserInputActions(actions, { keyTarget: win, pointerTarget: canvas, gamepads: false });
  const edges = [];
  actions.subscribe((name, held) => edges.push([name, held]));
  const pointer = (type, button, buttons, inside = true, pointerType = 'mouse') => {
    if (inside) canvas.fire(type, { button, buttons, pointerType });
    win.fire(type, { button, buttons, pointerType });
  };
  pointer('pointerdown', 0, 1);
  actions.endFrame();
  pointer('pointermove', 2, 3);
  assert.ok(actions.justPressed('guard') && actions.pressed('attack'));
  actions.endFrame();
  pointer('pointermove', -1, 3);
  assert.equal(actions.lastPressed, undefined);
  pointer('pointermove', 0, 2, false);
  assert.ok(actions.justReleased('attack') && actions.pressed('guard'));
  pointer('pointermove', 1, 6);
  assert.ok(actions.justPressed('aim'));
  pointer('pointermove', 2, 4);
  pointer('pointerup', 1, 0, false);
  assert.deepEqual(edges, [
    ['attack', true],
    ['guard', true],
    ['attack', false],
    ['aim', true],
    ['guard', false],
    ['aim', false]
  ]);

  pointer('pointerdown', 0, 1, false);
  pointer('pointermove', -1, 1);
  pointer('pointermove', 2, 3, false);
  pointer('pointermove', 0, 1, true, 'touch');
  assert.equal(edges.length, 6, 'hover, touch and presses outside the target do not start actions');
  binding.dispose();
  assert.equal(win.count + canvas.count, 0);
});

test('GB02 gamepads are read on poll, by standard name and by number, and let go when released', () => {
  const pads = [{ connected: true, mapping: 'standard', buttons: [{ pressed: true, value: 1 }], axes: [0.8, 0, 0, 0] }];
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => pads }, configurable: true });
  try {
    const actions = createInputActions({ ...MAP, zero: { bindings: ['Pad:0'] } });
    const binding = bindBrowserInputActions(actions, { keyTarget: new Target() });
    binding.poll();
    assert.equal(actions.pressed('jump'), true);
    assert.equal(actions.pressed('zero'), true);
    assert.ok(actions.vector('move').x > 0.7);
    pads[0] = { connected: true, mapping: 'standard', buttons: [{ pressed: false, value: 0 }], axes: [0.05, 0, 0, 0] };
    binding.poll();
    assert.equal(actions.pressed('jump'), false);
    assert.deepEqual(actions.vector('move'), { x: 0, y: 0 });
    binding.dispose();
  } finally {
    if (nav) Object.defineProperty(globalThis, 'navigator', nav);
  }
});

test('GB03 a touch stick appears under the finger in its zone and follows it', () => {
  const area = element();
  const actions = createInputActions(MAP);
  const stick = createTouchStick(area, actions, { radius: 50 });
  const [base] = stick.elements;
  assert.equal(base.hidden, true);
  area.fire('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 600, clientY: 200 });
  assert.equal(base.hidden, true, 'the right half is not the stick zone');
  area.fire('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 100, clientY: 300 });
  assert.equal(base.hidden, false);
  area.fire('pointermove', { pointerId: 2, clientX: 200, clientY: 300 });
  const v = actions.vector('move');
  assert.ok(v.x > 0.99 && Math.abs(v.y) < 1e-9, 'pushed past the radius is full tilt');
  area.fire('pointerup', { pointerId: 2 });
  assert.equal(base.hidden, true);
  assert.deepEqual(actions.vector('move'), { x: 0, y: 0 });
  stick.dispose();
  assert.equal(area.count, 0);
  assert.equal(base.removed, true);
});

test('GB04 a touch button holds its binding while any finger is on it', () => {
  const button = element();
  const actions = createInputActions(MAP);
  const control = createTouchButton(button, actions, 'Touch:jump');
  button.fire('pointerdown', { pointerId: 1 });
  button.fire('pointerdown', { pointerId: 2 });
  assert.equal(actions.pressed('jump'), true);
  assert.equal('pressed' in button.dataset, true);
  button.fire('pointerup', { pointerId: 1 });
  assert.equal(actions.pressed('jump'), true);
  button.fire('pointercancel', { pointerId: 2 });
  assert.equal(actions.pressed('jump'), false);
  control.dispose();
  assert.equal(button.count, 0);
});

test('GB05 browser storage falls back to memory where the page has none', () => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    get() {
      throw new Error('SecurityError');
    },
    configurable: true
  });
  try {
    const storage = browserSaveStorage();
    assert.equal(storage.persistent, false);
    storage.setItem('a', '1');
    assert.equal(storage.getItem('a'), '1');
    storage.removeItem('a');
    assert.equal(storage.getItem('a'), null);
  } finally {
    if (had) Object.defineProperty(globalThis, 'localStorage', had);
    else delete globalThis.localStorage;
  }
});
