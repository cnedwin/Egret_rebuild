import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, Sprite } from '@egret/engine';

function headlessHost(start = () => {}) {
  const frames = [], trace = [], timers = new Set();
  const adapter = {
    surface: {}, start() { trace.push('start'); return start(); },
    renderFrame(frame) { frames.push(frame); },
    stop() { trace.push('stop'); }, async close() { trace.push('close'); },
    setTimeout(callback, delayMs) { const token = { callback, delayMs }; timers.add(token); return () => timers.delete(token); },
  };
  return { adapter, frames, trace, timers };
}
async function withScene(t, run) {
  const host = headlessHost(), diagnostics = [];
  const engine = await createEngine({ host: host.adapter, onDiagnostic: item => diagnostics.push(item) });
  const scope = engine.createScope();
  const probe = scope.use(new Sprite()); probe.touchEnabled = true;
  probe.hitArea = { x: 0, y: 0, width: 1, height: 1 }; engine.stage.addChild(probe);
  assert.equal(engine.stage.hitTest(0, 0), probe);
  engine.stage.removeChild(probe); probe.dispose();
  t.diagnostic('SDK_SETUP: genuine Engine, open Scope and attached HT1 probe admitted before application import');
  try {
    const { createHitTestScene } = await import('../examples/hit-test/scene.mjs');
    const scene = createHitTestScene(engine, scope);
    await run({ scene, engine, scope, host, diagnostics });
  } finally {
    scope.dispose(); await engine.dispose();
    assert.equal(scope.state, 'closed'); assert.equal(engine.stage.isDisposed, true);
    assert.equal(host.timers.size, 0); assert.deepEqual(host.trace, ['start', 'stop', 'close']);
    assert.deepEqual(diagnostics, []);
    t.diagnostic('SDK_CLEANUP: Scope closed, Stage disposed, host stop/close complete, zero timers');
  }
}
const payload = (globalX, globalY) => ({ globalX, globalY, button: 0, pointerType: 'mouse' });
const route = label => [
  { currentTarget: 'stage', target: label, phase: 'capturing' },
  { currentTarget: label, target: label, phase: 'atTarget' },
  { currentTarget: 'root', target: label, phase: 'bubbling' },
  { currentTarget: 'stage', target: label, phase: 'bubbling' },
];

// Break caught: omitted scene module or no initial genuine scene/render assembly.
test('APP01 genuine SDK setup precedes application import and initial authored frame', async t => {
  await withScene(t, ({ scene, engine, host }) => {
    const state = scene.readSnapshot();
    assert.equal(engine.stage.numChildren, 1);
    assert.equal(state.liveNodes, 9); assert.equal(state.enabledActors, 5);
    assert.equal(state.typedListenerCount, 8); assert.equal(state.renderCount, 1);
    assert.equal(state.lastFrameId, 1); assert.equal(state.feedbackColor, 0x404040);
    assert.equal(host.frames.length, 1); assert.equal(host.frames[0].commands.length, 6);
    assert.deepEqual(host.frames[0].commands.map(command => command.color), [0xff0000, 0x0000ff, 0x00ff00, 0xff00ff, 0xffff00, 0x404040]);
    assert.deepEqual(host.frames[0].commands[2].clips, [{ matrix: { a: 1, b: 0, c: 0, d: 1, tx: 160, ty: 24 }, rect: { x: 0, y: 0, width: 48, height: 48 } }]);
  });
});

// Break caught: handwritten picker, omitted typed dispatch or accumulated feedback.
test('APP02 overlap selects upper and actual event route precedes one repaint', async t => {
  await withScene(t, ({ scene, host }) => {
    const picked = scene.pick(payload(56, 48));
    assert.equal(picked.touchEnabled, true);
    const state = scene.readSnapshot();
    assert.equal(state.selectedLabel, 'upper'); assert.deepEqual(state.route, route('upper'));
    assert.deepEqual(state.lastPayload, payload(56, 48));
    assert.equal(state.dispatchCount, 1); assert.equal(state.pointerCount, 1);
    assert.equal(state.renderCount, 2); assert.equal(state.lastFrameId, 2);
    assert.equal(host.frames.length, 2); assert.equal(host.frames[1].commands.length, 6);
    assert.equal(host.frames[1].commands[5].color, 0x0000ff);
    scene.pick(payload(20, 20)); scene.pick(payload(56, 48));
    assert.equal(host.frames.length, 4); assert.ok(host.frames.every(frame => frame.commands.length === 6));
    assert.equal(scene.readSnapshot().feedbackColor, 0x0000ff);
  });
});

// Break caught: missing CSS-control miss observation, stale route or render on miss.
test('APP03 misses preserve admitted payload and leave rendered feedback unchanged', async t => {
  await withScene(t, ({ scene, host }) => {
    scene.pick(payload(56, 48));
    for (const point of [[112, 96], [216, 32], [300, 180]]) {
      assert.equal(scene.pick(payload(...point)), undefined);
      const state = scene.readSnapshot(); assert.equal(state.selectedLabel, undefined);
      assert.equal(state.status, 'miss'); assert.deepEqual(state.route, []);
      assert.deepEqual(state.lastPayload, payload(...point));
      assert.equal(state.dispatchCount, 1); assert.equal(state.renderCount, 2);
      assert.equal(state.lastFrameId, 2); assert.equal(state.feedbackColor, 0x0000ff);
    }
    assert.equal(host.frames.length, 2);
  });
});

// Break caught: suppressing input wrongly suppresses rendering or retargets to gate.
test('APP04 visibility and touchChildren toggles change only the authored eligible branches', async t => {
  await withScene(t, ({ scene, host }) => {
    scene.toggleUpper(); scene.pick(payload(56, 48));
    assert.equal(scene.readSnapshot().selectedLabel, 'lower');
    assert.equal(host.frames[1].commands.length, 5);
    scene.toggleUpper(); scene.pick(payload(56, 48));
    assert.equal(scene.readSnapshot().selectedLabel, 'upper');
    scene.pick(payload(168, 32)); assert.deepEqual(scene.readSnapshot().route, route('gatedChild'));
    scene.toggleGateVisibility(); assert.equal(scene.pick(payload(168, 32)), undefined);
    assert.equal(host.frames.at(-1).commands.length, 5);
    scene.toggleGateVisibility(); scene.pick(payload(168, 32));
    scene.toggleTouchChildren(); assert.equal(scene.pick(payload(168, 32)), undefined);
    assert.equal(scene.readSnapshot().liveNodes, 9);
    assert.equal(host.frames.at(-1).commands[2].color, 0x00ff00);
    scene.toggleTouchChildren(); scene.pick(payload(168, 32));
    assert.equal(scene.readSnapshot().selectedLabel, 'gatedChild');
    assert.equal(scene.readSnapshot().renderCount, 12);
  });
});

// Break caught: closed edges, bounds inference or neighbor ownership duplication.
test('APP05 adjacent authored half-open rectangles and outer edges have exact owners', async t => {
  await withScene(t, ({ scene }) => {
    scene.pick(payload(16, 128)); assert.equal(scene.readSnapshot().selectedLabel, 'left');
    scene.pick(payload(48, 136)); assert.equal(scene.readSnapshot().selectedLabel, 'right');
    assert.equal(scene.pick(payload(80, 136)), undefined);
    assert.equal(scene.pick(payload(20, 160)), undefined);
    assert.equal(scene.readSnapshot().dispatchCount, 2); assert.equal(scene.readSnapshot().renderCount, 3);
  });
});

// Break caught: omitted Scope listener owner, child teardown or Stage retirement.
test('APP06 real Scope retirement clears eight subscriptions and all nine nodes retire', async t => {
  await withScene(t, async ({ scene, engine, scope, host }) => {
    scene.pick(payload(56, 48)); scope.dispose();
    let state = scene.readSnapshot();
    assert.equal(state.scopeState, 'closed'); assert.equal(state.disposedNodes, 8);
    assert.equal(state.liveNodes, 1); assert.equal(state.enabledActors, 0);
    assert.equal(state.unsubscribeAttempts, 8); assert.equal(state.typedListenerCount, 0);
    assert.equal(engine.stage.numChildren, 0);
    await engine.dispose(); state = scene.readSnapshot();
    assert.equal(state.disposedNodes, 9); assert.equal(state.liveNodes, 0);
    assert.equal(host.timers.size, 0);
  });
});

// Observe real EventTarget registration/removal independently of app counters.
function domPorts(removeFailure = false) {
  const pairs = [], writes = [];
  function target(label) {
    const node = new EventTarget();
    node.disabled = true;
    node.addEventListener = function(type, callback, options) {
      const capture = typeof options === 'boolean' ? options : options?.capture === true;
      pairs.push({ label, node, type, callback, capture, retired: false });
      EventTarget.prototype.addEventListener.call(this, type, callback, options);
    };
    node.removeEventListener = function(type, callback, options) {
      const capture = typeof options === 'boolean' ? options : options?.capture === true;
      EventTarget.prototype.removeEventListener.call(this, type, callback, options);
      const pair = pairs.find(value => value.node === this && value.type === type && value.callback === callback && value.capture === capture && !value.retired);
      if (pair) pair.retired = true;
      if (removeFailure && label === 'canvas') throw undefined;
    };
    return node;
  }
  const canvas = target('canvas'); canvas.width = 320; canvas.height = 200;
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 640, height: 400 });
  canvas.removed = false; canvas.remove = () => { canvas.removed = true; };
  const upperButton = target('upper'), gateButton = target('gate'), childrenButton = target('children'), closeButton = target('close'), windowTarget = target('window');
  const status = { get textContent() { return writes.at(-1); }, set textContent(value) { writes.push(value); } };
  return { ports: { canvas, upperButton, gateButton, childrenButton, closeButton, windowTarget, status }, pairs, writes };
}
function pointer(target, values = {}) {
  const event = new globalThis.Event('pointerdown');
  const fields = { clientX: 122, clientY: 116, button: 0, pointerType: 'mouse', isPrimary: true, ...values };
  for (const [key, value] of Object.entries(fields)) Object.defineProperty(event, key, { value });
  target.dispatchEvent(event);
}
async function ready(app) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise(resolve => setImmediate(resolve));
    if (app.readSnapshot().phase === 'ready') return;
  }
  assert.fail('Application did not become ready within five turns');
}
async function withApplication(run, dom = domPorts(), host = headlessHost()) {
  const { createHitTestApplication } = await import('../examples/hit-test/application.mjs');
  const app = createHitTestApplication({ ...dom.ports, host: host.adapter });
  try { await run({ app, host, ...dom }); }
  finally {
    try { await app.close(); } catch {}
    assert.equal(host.timers.size, 0);
    assert.ok(dom.pairs.every(pair => pair.retired));
  }
}

// Break caught: omitted CSS multipliers or accepting touch/nonprimary/nonleft input.
test('APP07 actual EventTarget mouse admission uses CSS scale and preserves a miss payload', async () => {
  await withApplication(async ({ app, host, ports }) => {
    await ready(app);
    for (const values of [{ pointerType: 'touch' }, { pointerType: 'pen' }, { isPrimary: false }, { button: 1 }, { clientX: NaN }]) pointer(ports.canvas, values);
    assert.equal(app.readSnapshot().pointerCount, 0); assert.equal(host.frames.length, 1);
    pointer(ports.canvas);
    let state = app.readSnapshot();
    assert.equal(state.selectedLabel, 'upper'); assert.deepEqual(state.lastPayload, payload(56, 48));
    assert.deepEqual(state.route, route('upper')); assert.equal(host.frames.length, 2);
    pointer(ports.canvas, { clientX: 234, clientY: 212 });
    state = app.readSnapshot(); assert.equal(state.selectedLabel, undefined);
    assert.deepEqual(state.lastPayload, payload(112, 96)); assert.deepEqual(state.route, []);
    assert.equal(state.status, 'miss'); assert.equal(host.frames.length, 2);
  });
});

// Break caught: six retained native pairs hidden by callback gating/canvas removal.
test('APP08 shared close retires six exact native pairs and prevents post-close mutations', async () => {
  await withApplication(async ({ app, ports, pairs, writes, host }) => {
    await ready(app);
    assert.deepEqual(pairs.map(pair => `${pair.label}:${pair.type}:${pair.capture}`), ['canvas:pointerdown:false', 'upper:click:false', 'gate:click:false', 'children:click:false', 'close:click:false', 'window:pagehide:false']);
    pointer(ports.canvas);
    const first = app.close(); assert.equal(app.close(), first);
    assert.ok(pairs.every(pair => pair.retired));
    await first;
    const state = app.readSnapshot(), written = writes.length;
    assert.equal(state.phase, 'closed'); assert.equal(state.disposedNodes, 9);
    assert.equal(state.scopeState, 'closed'); assert.equal(state.unsubscribeAttempts, 8);
    assert.equal(state.enabledActors, 0); assert.equal(state.typedListenerCount, 0);
    assert.equal(ports.canvas.width, 0); assert.equal(ports.canvas.height, 0); assert.equal(ports.canvas.removed, true);
    for (const pair of pairs) pair.node.dispatchEvent(new globalThis.Event(pair.type));
    pointer(ports.canvas);
    assert.deepEqual(app.readSnapshot(), state); assert.equal(writes.length, written);
    assert.deepEqual(host.trace, ['start', 'stop', 'close']);
  });
});

// Break caught: cyclic startup/close awaits or late startup publishing Ready/scene.
test('APP09 close before genuine Host.start resolution retires late Engine without publishing scene', async () => {
  let resolveStart;
  const pendingStart = new Promise(resolve => { resolveStart = resolve; });
  const host = headlessHost(() => pendingStart);
  await withApplication(async ({ app, ports, pairs, writes }) => {
    assert.deepEqual(host.trace, ['start']); assert.equal(app.readSnapshot().phase, 'starting');
    const closed = app.close(); assert.equal(app.close(), closed);
    assert.equal(app.readSnapshot().phase, 'closing'); assert.ok(pairs.every(pair => pair.retired));
    resolveStart(); await closed;
    const state = app.readSnapshot(); assert.equal(state.phase, 'closed');
    assert.equal(state.scopeState, undefined); assert.equal(state.liveNodes, 0);
    assert.equal(state.disposedNodes, 1); assert.equal(state.typedListenerCount, 0);
    assert.equal(state.renderCount, 0); assert.equal(host.frames.length, 0);
    assert.ok(writes.every(text => !text.startsWith('Ready')));
    assert.equal(ports.canvas.removed, true); assert.equal(host.timers.size, 0);
    // Successful physical host close must permit a real second Engine borrow.
    const successor = await createEngine({ host: host.adapter });
    await successor.dispose(); assert.equal(successor.stage.isDisposed, true);
  }, domPorts(), host);
});

// Break caught: truthiness checks lose throw undefined or stop later cleanup.
test('APP10 listener removal throwing undefined keeps first rejection while remaining cleanup completes', async () => {
  await withApplication(async ({ app, ports, pairs }) => {
    await ready(app);
    const closed = app.close(); assert.equal(app.close(), closed);
    const outcome = await closed.then(() => ({ rejected: false }), cause => ({ rejected: true, cause }));
    assert.equal(outcome.rejected, true); assert.equal(outcome.cause, undefined);
    assert.ok(pairs.every(pair => pair.retired));
    const state = app.readSnapshot(); assert.equal(state.phase, 'failed'); assert.equal(state.failureCount, 1);
    assert.equal(state.disposedNodes, 9); assert.equal(state.scopeState, 'closed');
    assert.equal(state.unsubscribeAttempts, 8); assert.equal(ports.canvas.removed, true);
  }, domPorts(true));
});

// Break caught: main module awaiting user Close instead of publishing its two ports.
test('APP11 main evaluates before user closure with genuine CanvasHost startup failure observed', { timeout: 2000 }, async () => {
  const dom = domPorts(), documentBefore = Object.getOwnPropertyDescriptor(globalThis, 'document'), windowBefore = Object.getOwnPropertyDescriptor(globalThis, 'window');
  dom.ports.canvas.getContext = () => null;
  const selected = new Map([['#scene', dom.ports.canvas], ['#toggle-upper', dom.ports.upperButton], ['#toggle-gate', dom.ports.gateButton], ['#toggle-children', dom.ports.childrenButton], ['#close', dom.ports.closeButton], ['#status', dom.ports.status]]);
  Object.defineProperty(globalThis, 'document', { value: { querySelector: selector => selected.get(selector) }, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: dom.ports.windowTarget, configurable: true });
  try {
    const main = await import('../examples/hit-test/main.mjs');
    assert.deepEqual(Object.keys(main).sort(), ['close', 'readSnapshot']);
    const first = main.close(); assert.equal(main.close(), first);
    const outcome = await first.then(() => ({ rejected: false }), cause => ({ rejected: true, cause }));
    assert.equal(outcome.rejected, true); assert.equal(outcome.cause.code, 'ENGINE_START_FAILED');
    assert.equal(main.readSnapshot().phase, 'failed');
    assert.ok(dom.pairs.every(pair => pair.retired)); assert.equal(dom.ports.canvas.removed, true);
  } finally {
    if (documentBefore) Object.defineProperty(globalThis, 'document', documentBefore); else delete globalThis.document;
    if (windowBefore) Object.defineProperty(globalThis, 'window', windowBefore); else delete globalThis.window;
  }
});

// Break caught: initial render reentry closes the app, then startup publishes Ready.
test('APP12 a pagehide during genuine initial render cannot revive Ready', async () => {
  const dom = domPorts(), host = headlessHost();
  host.adapter.renderFrame = frame => {
    host.frames.push(frame);
    dom.ports.windowTarget.dispatchEvent(new globalThis.Event('pagehide'));
  };
  await withApplication(async ({ app, writes }) => {
    await new Promise(resolve => setImmediate(resolve));
    await app.close();
    assert.ok(writes.every(text => !text.startsWith('Ready')));
    assert.equal(app.readSnapshot().phase, 'closed'); assert.equal(app.readSnapshot().disposedNodes, 9);
    assert.equal(host.frames.length, 1);
  }, dom, host);
});
