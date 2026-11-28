// SPDX-License-Identifier: Apache-2.0
// Controlled clock/Canvas ports exercise native text budget and lifetime, not device performance.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrowserGame } from '@egret/engine/web/game';
import { createCanvasParagraphProvider } from '@egret/engine/web/paragraph';
import { createParagraphCache } from '@egret/engine/paragraph';
import { createTextRasterCache } from '@egret/engine/text';
import { createCanvasTextRasterProvider } from '@egret/engine/web/text';
import { request } from './text-raster-public-helpers.mjs';
import { glPorts } from './fixtures/gl-shared-rendering.mjs';
import { realm } from './canvas-text-provider-double-helpers.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
async function fixture(t, budget) {
  const frames = new Map();
  let handle = 0,
    time = 0;
  const double = realm(t, {
    measure(text, call) {
      time += 2;
      const size = Number(/([\d.]+)px/.exec(call.state.font)?.[1] ?? 10),
        width = Array.from(text).length * size * 0.6;
      return {
        width,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: width,
        actualBoundingBoxAscent: size * 0.7,
        actualBoundingBoxDescent: size * 0.1,
        fontBoundingBoxAscent: size * 0.8,
        fontBoundingBoxDescent: size * 0.2
      };
    },
    read() {
      time += 2;
    }
  });
  for (const [key, value] of Object.entries({
    performance: { now: () => time },
    requestAnimationFrame: fn => {
      frames.set(++handle, fn);
      return handle;
    },
    cancelAnimationFrame: id => frames.delete(id),
    createImageBitmap() {},
    ImageBitmap: class {
      close() {}
    }
  })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    t.after(() => (old ? Object.defineProperty(globalThis, key, old) : Reflect.deleteProperty(globalThis, key)));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const listeners = new Set();
  double.document.hidden = false;
  double.document.addEventListener = (type, fn) => {
    if (type === 'visibilitychange') listeners.add(fn);
  };
  double.document.removeEventListener = (type, fn) => {
    if (type === 'visibilitychange') listeners.delete(fn);
  };
  const { canvas } = glPorts();
  canvas.ownerDocument = double.document;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 180 });
  const game = await createBrowserGame({
    canvas,
    width: 320,
    height: 180,
    backend: 'webgl2',
    pixelRatio: 1,
    autoStart: false,
    pointer: false,
    keyboard: false,
    ...(budget === undefined ? {} : { textWorkBudgetMs: budget })
  });
  return {
    game,
    double,
    frames,
    hidden(value) {
      double.document.hidden = value;
      for (const fn of listeners) fn();
    },
    advance: ms => {
      time += ms;
    },
    step() {
      time += 16;
      const batch = [...frames.values()];
      frames.clear();
      for (const fn of batch) fn(time);
    }
  };
}

test('opt-in browser text scheduling uses a real frame boundary, FIFO, cancellation and disposal', async t => {
  const f = await fixture(t, 4),
    g = f.game,
    signal = new AbortController().signal,
    ran = [];
  try {
    assert.equal(typeof g.scheduleTextWork, 'function');
    const submit = (name, ms = 2, owner = signal) =>
      g.scheduleTextWork(() => {
        ran.push(name);
        f.advance(ms);
        return name;
      }, owner);
    const a = submit('a'),
      b = submit('b');
    const cancelled = new AbortController();
    const c = submit('cancelled', 2, cancelled.signal),
      cancelledDone = assert.rejects(c);
    const d = submit('d');
    assert.deepEqual(ran, ['a', 'b']);
    cancelled.abort();
    await cancelledDone;
    await flush();
    assert.deepEqual(ran, ['a', 'b']);
    f.step();
    assert.equal(await d, 'd');
    assert.deepEqual(ran, ['a', 'b', 'd']);
    assert.deepEqual(await Promise.all([a, b]), ['a', 'b']);
    const pending = [];
    for (let i = 0; i < 20; i++) pending.push(submit('z' + i, 0));
    await flush();
    assert(ran.filter(s => s.startsWith('z')).length < 20, 'even zero-duration tasks have a per-slice count bound');
    const close = Promise.allSettled(pending);
    await g.dispose();
    const settled = await close;
    assert(
      settled.some(r => r.status === 'rejected'),
      'closing without another frame releases queued work'
    );
    assert.equal(f.frames.size, 0);
  } finally {
    await g.dispose();
  }
});

test('the public queue is bounded and malformed signal listener retirement settles the caller', async t => {
  const f = await fixture(t, 4),
    g = f.game,
    signal = new AbortController().signal;
  try {
    await g.scheduleTextWork(() => f.advance(4), signal);
    const failures = [];
    const jobs = [];
    for (let i = 0; i < 520; i++)
      jobs.push(g.scheduleTextWork(() => i, signal).catch(cause => failures.push(cause.code)));
    await flush();
    assert.equal(failures.filter(code => code === 'TEXT_CACHE_BUDGET').length, 8);
    await g.dispose();
    await Promise.all(jobs);
    assert.equal(failures.length, 520);
  } finally {
    await g.dispose();
  }
});

test('hidden work resumes via a browser task; foreground returns to display boundaries', async t => {
  const f = await fixture(t, 4),
    g = f.game,
    signal = new AbortController().signal;
  try {
    await g.scheduleTextWork(() => f.advance(4), signal);
    const next = g.scheduleTextWork(() => {
      f.advance(4);
      return 7;
    }, signal);
    assert(f.frames.size);
    f.hidden(true);
    assert.equal(f.frames.size, 0, 'suspended display frame cancelled');
    assert.equal(await next, 7);
    f.hidden(false);
    assert(f.frames.size, 'return to a display boundary');
    let ran = false;
    const p = g.scheduleTextWork(() => {
      ran = true;
    }, signal);
    await flush();
    assert.equal(ran, false);
    f.step();
    await p;
    assert.equal(ran, true);
    const aborted = new AbortController();
    aborted.abort();
    await assert.rejects(g.scheduleTextWork(() => assert.fail('cancelled job ran'), aborted.signal));
    const broken = {
      aborted: false,
      reason: undefined,
      addEventListener() {
        throw Error('cannot subscribe');
      },
      removeEventListener() {
        throw Error('cannot unsubscribe');
      }
    };
    await assert.rejects(g.scheduleTextWork(() => assert.fail('broken signal ran'), broken));
  } finally {
    await g.dispose();
  }
});

test('a signal getter failure after queue admission cannot strand the next job', async t => {
  const f = await fixture(t, 4),
    g = f.game,
    standard = new AbortController().signal;
  try {
    await g.scheduleTextWork(() => f.advance(4), standard);
    let corrupt = false,
      listener;
    const signal = {
      get aborted() {
        if (corrupt) throw Error('getter failed');
        return false;
      },
      reason: undefined,
      addEventListener(_, fn) {
        listener = fn;
      },
      removeEventListener() {
        listener = undefined;
      }
    };
    const a = assert.rejects(
      g.scheduleTextWork(() => assert.fail('bad signal ran'), signal),
      /getter failed/
    );
    const b = g.scheduleTextWork(() => 7, standard);
    corrupt = true;
    f.step();
    await a;
    assert.equal(await b, 7);
    assert.equal(listener, undefined);
    await g.scheduleTextWork(() => f.advance(4), standard);
    const abortSignal = {
      aborted: false,
      get reason() {
        throw Error('reason failed');
      },
      addEventListener(_, fn) {
        listener = fn;
      },
      removeEventListener() {
        listener = undefined;
      }
    };
    const c = assert.rejects(
      g.scheduleTextWork(() => assert.fail('aborted job ran'), abortSignal),
      /reason failed/
    );
    listener();
    await c;
    assert.equal(listener, undefined);
    const d = g.scheduleTextWork(() => 8, standard);
    f.step();
    assert.equal(await d, 8);
  } finally {
    await g.dispose();
  }
});

for (const value of [0, -1, NaN, Infinity, 17, '4'])
  test('invalid opt-in budget ' + String(value) + ' is refused', async t => {
    await assert.rejects(fixture(t, value));
  });

test('ordinary atlas labels and built-in paragraphs share scheduled Canvas work', async t => {
  const f = await fixture(t, 4),
    g = f.game;
  try {
    assert.equal(typeof g.scheduleTextWork, 'function');
    const labels = await Promise.all(
      ['山门甲', '江湖乙', 'Chronicle C', 'Disciple D'].map(text =>
        g.createAtlasLabel({ text, fontFamily: 'sans-serif', fontSize: 12, locale: 'zh' })
      )
    );
    const para = await g.createParagraphLabel({
      text: '武林进度 — Chronicle',
      width: 100,
      fontFamily: 'sans-serif',
      fontSize: 12,
      locale: 'zh'
    });
    let done = false;
    const complete = Promise.all([...labels.map(l => l.ready), para.ready]).then(() => {
      done = true;
    });
    await flush();
    assert(!done, 'one microtask drain must not finish every Canvas raster');
    for (let i = 0; i < 120 && !done; i++) {
      f.step();
      await flush();
    }
    assert(done, 'all text becomes ready at subsequent display boundaries');
    await complete;
    assert(labels.every(label => label.bounds.width > 0));
    assert(para.metrics?.lines.length);
  } finally {
    await g.dispose();
  }
});

test('a caller-owned paragraph cache can opt into the same browser budget', async t => {
  const f = await fixture(t, 4),
    g = f.game;
  try {
    const provider = createCanvasParagraphProvider({ schedule: g.scheduleTextWork });
    const cache = createParagraphCache(g.engine.assets, { provider }),
      owner = g.engine.createScope();
    const { createParagraph } = await import('@egret/engine/paragraph');
    const prior = g.scheduleTextWork(() => f.advance(4), owner.signal);
    await prior;
    const display = createParagraph(g.engine, owner, cache);
    display.setRequest({
      text: '共同段落内容 — Shared words',
      width: 104,
      fontFamilies: ['sans-serif'],
      fontSize: 12,
      locale: 'zh',
      direction: 'ltr',
      density: 1,
      fillColor: 0xffffff
    });
    let done = false;
    const complete = display.prepare().then(metrics => {
      done = true;
      return metrics;
    });
    await flush();
    assert(!done, 'caller paragraph respects the spent shared budget');
    for (let i = 0; i < 120 && !done; i++) {
      f.step();
      await flush();
    }
    assert(done);
    assert((await complete).lines.length);
    owner.dispose();
    cache.dispose();
    provider.dispose();
  } finally {
    await g.dispose();
  }
});

test('cancellation after a scheduled measure issues its plan, or after rasterization, retires all Canvas slots', async t => {
  const f = await fixture(t, 4),
    g = f.game;
  let caller,
    phase = 0,
    abortAt = 0,
    entered = 0;
  const provider = createCanvasTextRasterProvider({
    schedule: (job, signal) =>
      g.scheduleTextWork(() => {
        const value = job();
        entered++;
        phase++;
        // The work has completed, but the provider has not yet received the
        // schedule promise's result. The cache must release the authentic plan.
        if (phase === abortAt) caller.abort();
        return value;
      }, signal)
  });
  const cache = createTextRasterCache(g.engine.assets, { provider, maxResidentEntries: 0 });
  try {
    async function settle(p) {
      let done = false;
      const observed = p
        .then(
          value => ({ value }),
          error => ({ error })
        )
        .finally(() => {
          done = true;
        });
      for (let i = 0; i < 40 && !done; i++) {
        await flush();
        f.step();
      }
      assert(done, 'work settled');
      const result = await observed;
      await cache.whenIdle();
      return result;
    }
    for (const after of [1, 2]) {
      for (let i = 0; i < 6; i++) {
        caller = new AbortController();
        phase = 0;
        abortAt = after;
        const before = entered;
        const result = await settle(
          cache.acquire(request({ text: '取消' + after + '-' + i, fontSize: 12 }), { signal: caller.signal })
        );
        assert.ok(result.error);
        assert.equal(entered - before, after, 'all attempts entered the provider, so no Canvas plan slot leaked');
        const status = cache.getStatus();
        assert.equal(status.pendingJobs, 0);
        assert.equal(status.activeCallerLeases, 0);
        assert.equal(status.quarantinedGenerations, 0);
      }
    }
    caller = new AbortController();
    phase = 0;
    abortAt = 0;
    const good = await settle(cache.acquire(request({ text: '安然', fontSize: 12 }), { signal: caller.signal }));
    assert.equal(good.value?.kind, 'image');
    good.value.lease.release();
  } finally {
    cache.dispose();
    await g.dispose();
  }
});

test('direct scheduled paragraph completion rejects cancellation or disposal before delivery', async t => {
  const f = await fixture(t, 4),
    g = f.game;
  const r = {
    text: '文字 — Words',
    width: 100,
    fontFamilies: ['sans-serif'],
    fontSize: 12,
    locale: 'zh',
    direction: 'ltr',
    density: 1,
    fillColor: 0xffffff,
    textGeometry: true
  };
  try {
    const controller = new AbortController();
    const cancelled = createCanvasParagraphProvider({
      schedule: (job, signal) =>
        g.scheduleTextWork(() => {
          const made = job();
          controller.abort();
          return made;
        }, signal)
    });
    await assert.rejects(cancelled.prepare(r, { signal: controller.signal }), { code: 'PARAGRAPH_PREPARE_CANCELLED' });
    cancelled.dispose();
    f.step();
    let disposed;
    const signal = new AbortController().signal;
    disposed = createCanvasParagraphProvider({
      schedule: (job, token) =>
        g.scheduleTextWork(() => {
          const made = job();
          disposed.dispose();
          return made;
        }, token)
    });
    await assert.rejects(disposed.prepare(r, { signal }), { code: 'PARAGRAPH_PROVIDER_DISPOSED' });
  } finally {
    await g.dispose();
  }
});

test('omitting the opt-in preserves immediate default native text path', async t => {
  const { game } = await fixture(t);
  try {
    assert.equal(game.scheduleTextWork, undefined);
    const label = await game.createLabel({ text: 'default', fontSize: 11 });
    await label.ready;
    assert(label.text === 'default');
  } finally {
    await game.dispose();
  }
});
