// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import * as sdk from '@egret/engine';
import { createLegacyBindings } from '../tools/egret-migrate/legacy-web.mjs';
import { createLegacyGameServices } from '../tools/egret-migrate/compat/game-services.mjs';

function current() {
  const listeners = new Set(),
    scope = new AbortController();
  let time = 0,
    invalidations = 0;
  const game = {
    scope: { signal: scope.signal },
    engine: {
      clock: {
        onTick(_scope, callback) {
          listeners.add(callback);
          return { dispose: () => listeners.delete(callback) };
        }
      }
    },
    invalidate() {
      invalidations++;
    }
  };
  class LegacyEvent extends Event {
    constructor(type, bubbles, cancelable) {
      super(type, { bubbles, cancelable });
    }
  }
  const api = createLegacyGameServices(
    game,
    () => undefined,
    () => time,
    { Event: LegacyEvent, EventDispatcher: EventTarget }
  );
  return {
    api,
    wall(delta) {
      time += delta;
    },
    tick(delta, sincePrevious = delta) {
      time += delta;
      for (const fn of [...listeners]) fn({ deltaSeconds: sincePrevious / 1000 });
    },
    close: () => scope.abort(),
    active: () => listeners.size,
    invalidations: () => invalidations
  };
}

function old(modules) {
  const context = vm.createContext({ console });
  vm.runInContext('window=this;self=this;', context);
  for (const entry of ['egret/egret.js', 'game/game.js']) {
    const source = path.join(modules, entry);
    new vm.Script(fs.readFileSync(source, 'utf8'), { filename: source }).runInContext(context);
  }
  const api = context.egret;
  const callbacks = [];
  let time = 0;
  api.getTimer = () => time;
  const driver = {
    $startTick(fn, receiver) {
      callbacks.push({ fn, receiver });
    },
    $stopTick(fn, receiver) {
      const at = callbacks.findIndex(row => row.fn === fn && row.receiver === receiver);
      if (at >= 0) callbacks.splice(at, 1);
    }
  };
  api.ticker = driver;
  return {
    api,
    wall(delta) {
      time += delta;
    },
    tick(delta) {
      time += delta;
      for (const row of [...callbacks]) if (callbacks.includes(row)) row.fn.call(row.receiver, time);
      api.sys.SystemTicker.prototype.callLaters.call(driver);
    }
  };
}

function betweenFrames(host) {
  const calls = [],
    { api } = host;
  host.tick(1);
  host.wall(55);
  const timer = new api.Timer(40, 1);
  timer.addEventListener('timer', () => calls.push('timer'), null);
  timer.start();
  api.setTimeout(() => calls.push('timeout'), null, 40);
  const handle = api.setInterval(
    () => {
      calls.push('interval');
      api.clearInterval(handle);
    },
    null,
    40
  );
  host.tick(5, 60);
  calls.push('frame 1');
  host.tick(35);
  return calls;
}
test('a timer installed between frames only charges elapsed time since it was started', () => {
  assert.deepEqual(betweenFrames(current()), ['frame 1', 'timer', 'timeout', 'interval']);
});

function observe(host) {
  const { api, tick } = host;
  const output = [];
  const timer = new api.Timer(50, 3);
  for (const type of [api.TimerEvent.TIMER, api.TimerEvent.TIMER_COMPLETE]) {
    timer.addEventListener(type, event => output.push([event.type, timer.currentCount, timer.running]), null);
  }
  timer.start();
  for (const ms of [5, 5, 5, 150]) tick(ms);
  timer.stop();
  tick(200);
  timer.start();
  tick(50);
  timer.reset();
  const receiver = { name: 'day' };
  let times = 0;
  const handle = api.setInterval(
    function (n) {
      output.push([this.name, n, ++times]);
      if (times === 2) api.clearInterval(handle);
    },
    receiver,
    20,
    7
  );
  const dropped = api.setTimeout(() => output.push('cleared'), null, 5);
  api.clearTimeout(dropped);
  api.setTimeout(
    function (a, b) {
      output.push([this.name, a + b]);
    },
    receiver,
    25,
    2,
    3
  );
  for (const ms of [10, 70, 10, 10, 100]) tick(ms);
  api.callLater(
    function (arg) {
      output.push([this.name, arg]);
      api.callLater(() => output.push('next'), null);
    },
    receiver,
    9
  );
  api.callLater(() => output.push('same'), null);
  tick(1);
  output.push('boundary');
  tick(1);
  api.callLater(() => output.push('earlyLater'), null);
  api.setTimeout(
    () => {
      output.push('fromTimer');
      api.callLater(() => output.push('fromTimerLater'), null);
    },
    null,
    1
  );
  tick(1);
  output.push('afterCallbacks');
  return output;
}

test('classic timer cadence, completion, receiver, cancellation and nested deferral', () => {
  assert.deepEqual(observe(current()), [
    ['timer', 1, true],
    ['timer', 2, true],
    ['timer', 3, true],
    ['timerComplete', 3, false],
    ['day', 7, 1],
    ['day', 5],
    ['day', 7, 2],
    ['day', 9],
    'same',
    'boundary',
    'next',
    'fromTimer',
    'earlyLater',
    'fromTimerLater',
    'afterCallbacks'
  ]);
});

test('owner close from a callback suppresses other callbacks, scope-held handles and completion', () => {
  const h = current(),
    { api } = h,
    reached = [];
  const timer = new api.Timer(1, 1);
  timer.addEventListener('timer', event => {
    event.updateAfterEvent();
    reached.push('tick');
    h.close();
  });
  timer.addEventListener('timerComplete', () => reached.push('complete'));
  timer.start();
  api.setTimeout(() => reached.push('timeout'), null, 0);
  api.setInterval(() => reached.push('interval'), null, 0);
  api.callLater(() => reached.push('later'), null);
  h.tick(10);
  h.tick(50);
  assert.deepEqual(reached, ['tick']);
  assert.equal(timer.running, false);
  assert.equal(h.invalidations(), 1);
  assert.equal(h.active(), 0);
  assert.throws(() => timer.start(), { code: 'LEGACY_BINDINGS_CLOSED' });
  assert.throws(() => api.callLater(() => {}, null), { code: 'LEGACY_BINDINGS_CLOSED' });
});

test('the real shared binding delivers TimerEvent through legacy listeners and resumes from a fresh clock anchor', async () => {
  const engine = await sdk.createEngine({
    host: { surface: {}, start() {}, stop() {}, async close() {}, setTimeout: () => () => {} }
  });
  try {
    const scope = engine.createScope();
    let now = 1000;
    const pointer = { events: { tap: sdk.createEventType('tap', { bubbles: true }) } };
    const {
      api: { egret }
    } = createLegacyBindings(
      sdk,
      { scope, engine, stage: engine.stage, pointer },
      {
        width: 320,
        height: 180,
        projectId: 'timer_test',
        resources: { assets: [], groups: [] }
      },
      { storage: () => ({}), now: () => now }
    );
    const timer = new egret.Timer(50, 1),
      trace = [],
      observer = {};
    timer.addEventListener(
      egret.TimerEvent.TIMER,
      function (event) {
        trace.push([
          this === observer,
          event instanceof egret.TimerEvent,
          event.target === timer,
          event.currentTarget === timer
        ]);
      },
      observer
    );
    assert.equal(egret.getQualifiedClassName(timer), 'egret.Timer');
    assert.equal(egret.is(timer, 'egret.Timer'), true);
    timer.start();
    engine.advanceTime(1);
    engine.clock.pause();
    now = 20000;
    engine.advanceTime(20);
    engine.clock.resume();
    engine.advanceTime(20);
    assert.deepEqual(trace, []);
    now = 20060;
    engine.advanceTime(20.06);
    assert.deepEqual(trace, [[true, true, true, true]]);
    assert.equal(timer.running, false);
  } finally {
    await engine.dispose();
  }
});

function reflection(api) {
  function Inventory() {}
  function Shop() {}
  Shop.prototype = Object.create(Inventory.prototype, {
    constructor: { value: Shop, writable: true, configurable: true }
  });
  api.registerClass(Inventory, 'town.Inventory', ['town.IStock']);
  api.registerClass(Shop, 'town.Shop', ['town.IShop']);
  const shop = new Shop();
  api.registerImplementation('town.IStock', shop);
  const first = api.getImplementation('town.IStock') === shop;
  api.registerImplementation('town.IStock', 42);
  return [
    api.getQualifiedClassName(shop),
    api.getQualifiedClassName(Shop),
    api.getQualifiedSuperclassName(shop),
    api.getQualifiedClassName(3),
    api.getQualifiedClassName(null),
    api.is(shop, 'town.IStock'),
    api.is(shop, 'town.Shop'),
    api.is(shop, 'town.Unknown'),
    api.is(Shop, 'town.Shop'),
    first,
    api.getImplementation('town.IStock')
  ];
}

test('registered reflection and singleton bindings are scoped to each game', () => {
  const h = current();
  assert.deepEqual(reflection(h.api), [
    'town.Shop',
    'town.Shop',
    'town.Inventory',
    'number',
    'object',
    true,
    true,
    false,
    false,
    true,
    42
  ]);
  h.close();
  assert.equal(h.api.getImplementation('town.IStock'), undefined);
});

test('timer, deferred callback and reflection observations match a supplied Egret 5 SDK', {
  skip: !process.env.EGRET_LEGACY_MODULES && 'Supply a trusted Egret 5 SDK modules directory.'
}, () => {
  const reference = old(process.env.EGRET_LEGACY_MODULES);
  assert.deepEqual(observe(current()), observe(reference));
  assert.deepEqual(betweenFrames(current()), betweenFrames(reference));
  assert.deepEqual(reflection(current().api), reflection(reference.api));
});
