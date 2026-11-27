// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { createLegacyGameServices } from '../tools/egret-migrate/compat/game-services.mjs';

function host() {
  const lifetime = new AbortController(),
    listeners = new Set();
  let time = 1000;
  const clock = {
    onTick(_scope, callback) {
      listeners.add(callback);
      return { dispose: () => listeners.delete(callback) };
    }
  };
  const api = createLegacyGameServices(
    { scope: { signal: lifetime.signal }, engine: { clock } },
    () => undefined,
    () => time
  );
  return {
    api,
    count: () => listeners.size,
    close: () => lifetime.abort(),
    wall: ms => {
      time += ms;
    },
    tick: ms => {
      time += ms;
      for (const callback of [...listeners]) callback({ deltaSeconds: ms / 1000 });
    }
  };
}

function sequence(api, tick) {
  const target = { x: 0, alpha: 1 },
    calls = [],
    rows = [];
  api.Tween.get(target, { loop: true })
    .to({ x: 10 }, 100, api.Ease.quadInOut)
    .wait(30)
    .call(
      function (n) {
        calls.push([this.x, n]);
      },
      target,
      [7]
    )
    .set({ alpha: 0.5 })
    .to({ x: 0 }, 50, api.Ease.sineInOut)
    .call(() => calls.push(['done', target.x]));
  for (const ms of [25, 50, 35, 25, 35, 10, 20, 45]) {
    tick(ms);
    rows.push([+target.x.toFixed(7), target.alpha, JSON.stringify(calls)]);
  }
  api.Tween.removeTweens(target);
  tick(1000);
  rows.push([+target.x.toFixed(7), target.alpha, JSON.stringify(calls)]);
  return rows;
}

test('legacy timelines share one game clock and release callbacks on pause, override and close', () => {
  const h = host(),
    other = {},
    target = { x: 0 };
  assert.equal(h.api.getTimer(), 0);
  const motion = h.api.Tween.get(target)
    .to({ x: 10 }, 100)
    .call(() => assert.fail('removed callback'));
  h.api.Tween.get(other).wait(1000);
  assert.equal(h.count(), 1);
  h.tick(25);
  assert.equal(target.x, 2.5);
  motion.setPaused(true);
  h.wall(1000);
  h.tick(25);
  assert.equal(h.api.getTimer(), 1050);
  assert.equal(target.x, 2.5);
  motion.setPaused(false);
  const chain = h.api.Tween.get(target, { override: true }).to({ x: 20 }, 50);
  h.tick(25);
  assert.equal(target.x, 11.25);
  assert.equal(chain.position, 25);
  assert.throws(() => h.api.Tween.get(target, { useTicks: true }), { code: 'LEGACY_TWEEN_UNSUPPORTED' });
  h.close();
  assert.equal(h.count(), 0);
  h.tick(1000);
  assert.equal(target.x, 11.25);
});

test('closing a scope within a crossed action stops later callbacks and assignments in the same tick', () => {
  const h = host(),
    target = { x: 0 },
    calls = [];
  h.api.Tween.get(target)
    .wait(1)
    .call(() => {
      calls.push('close');
      h.close();
    })
    .wait(1)
    .set({ x: 3 })
    .call(() => calls.push('late'));
  h.tick(10);
  assert.deepEqual(calls, ['close']);
  assert.equal(target.x, 0);
  assert.throws(() => h.api.registerClass(class Late {}, 'Late'), { code: 'LEGACY_BINDINGS_CLOSED' });
  assert.equal(h.api.getDefinitionByName('Late'), null);
  assert.throws(() => h.api.Tween.get(target), { code: 'LEGACY_BINDINGS_CLOSED' });
});

test('resolves registered legacy types and keeps per-session ownership', () => {
  const h = host();
  class Box {}
  class Part extends Box {}
  h.api.registerClass(Box, 'ui.Box', ['IBox']);
  h.api.registerClass(Part, 'ui.Part', ['IPart']);
  assert.equal(h.api.getDefinitionByName('ui.Box'), Box);
  assert.deepEqual(new Part().__types__, ['ui.Part', 'IPart', 'ui.Box', 'IBox']);
  class Market {}
  h.api.registerClass(Market, '城内.集市2');
  assert.equal(h.api.getDefinitionByName('城内.集市2'), Market);
  assert.throws(() => h.api.registerClass(Market, '城内..集市'));
  assert.equal(h.api.getDefinitionByName('ui.unknown'), null);
  assert.equal(h.api.getDefinitionByName('__proto__.x'), null);
  h.close();
  assert.equal(h.api.getDefinitionByName('ui.Part'), null);
});

test('sampled chain, loop, wait and callback observations agree with the operator-supplied 5.x tween SDK', {
  skip: !process.env.EGRET_LEGACY_TWEEN_JS && 'Supply a trusted legacy SDK tween.js'
}, () => {
  function Dispatcher() {}
  Dispatcher.prototype.dispatchEventWith = () => {};
  const context = vm.createContext({
    egret: {
      EventDispatcher: Dispatcher,
      Event: { CHANGE: 'change' },
      getTimer: () => 0,
      ticker: { $startTick() {} },
      registerClass: () => {}
    }
  });
  new vm.Script(fs.readFileSync(process.env.EGRET_LEGACY_TWEEN_JS, 'utf8')).runInContext(context);
  let time = 0;
  const reference = sequence(context.egret, dt => context.egret.Tween.tick((time += dt)));
  const h = host();
  assert.deepEqual(sequence(h.api, h.tick), reference);
  assert.equal(h.count(), 0);
  for (const name of ['sineInOut', 'sineIn', 'circInOut', 'cubicOut', 'quadInOut', 'sineOut'])
    for (const t of [0, 0.25, 0.5, 0.75, 1])
      assert.ok(Math.abs(h.api.Ease[name](t) - context.egret.Ease[name](t)) < 1e-9);
});
