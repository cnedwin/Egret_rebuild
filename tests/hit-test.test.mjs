import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';

// Public built entry only. Object identities and mathematical points below are
// authored inputs; no target getter, bounds query or collector is the oracle.
function thrown(run) { try { run(); } catch (cause) { return cause; } assert.fail('Expected a thrown outcome'); }
function code(run, expected, ...causes) {
  const error = thrown(run);
  assert.ok(error instanceof egret.EgretError);
  assert.equal(error.code, expected);
  if (causes.length !== 0) assert.equal(error.cause, causes[0]);
  return error;
}
function headlessHost() {
  const trace = [], timers = new Set();
  const adapter = {
    surface: {}, start() { trace.push('start'); }, stop() { trace.push('stop'); },
    async close() { trace.push('close'); },
    setTimeout(callback, delayMs) {
      const timer = { callback, delayMs }; timers.add(timer);
      return () => timers.delete(timer);
    },
  };
  return { adapter, trace, timers };
}
async function withEngine(run) {
  const host = headlessHost(), diagnostics = [];
  const engine = await egret.createEngine({ host: host.adapter, onDiagnostic: value => diagnostics.push(value) });
  try { return await run(engine, host, diagnostics); }
  finally { await engine.dispose(); assert.equal(host.timers.size, 0); }
}
function target(parent, rect = { x: 0, y: 0, width: 10, height: 10 }) {
  const node = new egret.Sprite(); node.touchEnabled = true; node.hitArea = rect;
  parent.addChild(node); return node;
}
function stageQuery(receiver, ...args) { return Reflect.apply(egret.Stage.prototype.hitTest, receiver, args); }
function descriptor(prototype, name) { const value = Object.getOwnPropertyDescriptor(prototype, name); assert.ok(value); return value; }

test('HT01 defaults, genuine Stage query and independently owned finite hit areas', async () => {
  await withEngine(async engine => {
    assert.equal(typeof egret.Stage.prototype.hitTest, 'function');
    const node = new egret.Sprite(); engine.stage.addChild(node);
    assert.equal(node.touchEnabled, false); assert.equal(node.hitArea, undefined);
    assert.equal(node.touchChildren, true); assert.equal(engine.stage.hitTest(2, 3), undefined);
    const source = { x: -2, y: -3, width: 8, height: 9 };
    node.hitArea = source; node.touchEnabled = true;
    assert.notEqual(node.hitArea, source); assert.ok(Object.isFrozen(node.hitArea));
    assert.deepEqual(Reflect.ownKeys(node.hitArea), ['x', 'y', 'width', 'height']);
    source.x = 200; assert.equal(engine.stage.hitTest(2, 3), node);
    assert.throws(() => { node.hitArea.x = 100; }, TypeError);
    node.hitArea = { x: -0, y: -0, width: -0, height: 3 };
    assert.ok(Object.is(node.hitArea.x, -0)); assert.ok(Object.is(node.hitArea.width, -0));
    assert.equal(engine.stage.hitTest(0, 0), undefined);
    node.hitArea = undefined; assert.equal(engine.stage.hitTest(0, 0), undefined);
  });
});

test('HT02 reverse painter order, children before container and current reparenting', async () => {
  await withEngine(async engine => {
    const early = target(engine.stage), container = target(engine.stage), child = target(container);
    assert.equal(engine.stage.hitTest(3, 4), child);
    const late = target(engine.stage); assert.equal(engine.stage.hitTest(3, 4), late);
    engine.stage.setChildIndex(late, 0); assert.equal(engine.stage.hitTest(3, 4), child);
    container.removeChild(child); assert.equal(engine.stage.hitTest(3, 4), container);
    early.addChild(child); assert.equal(engine.stage.hitTest(3, 4), container);
    engine.stage.setChildIndex(early, 2); assert.equal(engine.stage.hitTest(3, 4), child);
    engine.stage.removeChild(early); assert.equal(engine.stage.hitTest(3, 4), container);
    early.dispose();
  });
});

test('HT03 explicit global Stage transform and reflected half-open ownership', async () => {
  await withEngine(async engine => {
    engine.stage.x = 10; engine.stage.y = 20; engine.stage.scaleX = 2; engine.stage.scaleY = 3;
    const node = target(engine.stage, { x: 0, y: 0, width: 4, height: 4 });
    node.x = 5; node.y = 2; node.scaleX = -1;
    assert.equal(engine.stage.hitTest(20, 26), node); // local (0,0), included
    assert.equal(engine.stage.hitTest(16, 29), node); // local (2,1)
    assert.equal(engine.stage.hitTest(12, 29), undefined); // local right=4
    assert.equal(engine.stage.hitTest(16, 38), undefined); // local bottom=4
  });
});

test('HT04 adjacent explicit rectangles have exactly one half-open owner', async () => {
  await withEngine(async engine => {
    const left = target(engine.stage, { x: -10, y: -3, width: 10, height: 6 });
    const right = target(engine.stage, { x: 0, y: -3, width: 10, height: 6 });
    assert.equal(engine.stage.hitTest(-10, 0), left);
    assert.equal(engine.stage.hitTest(0, 0), right);
    assert.equal(engine.stage.hitTest(10, 0), undefined);
    assert.equal(engine.stage.hitTest(-1, -3), left);
    assert.equal(engine.stage.hitTest(-1, 3), undefined);
  });
});

test('HT05 nested rotated clips test literal local rectangles rather than world AABBs', async () => {
  await withEngine(async engine => {
    const behind = target(engine.stage, { x: -20, y: -20, width: 40, height: 40 });
    const outer = new egret.Sprite(); outer.rotation = 45;
    outer.clipRect = { x: -2, y: -2, width: 4, height: 4 }; engine.stage.addChild(outer);
    const inner = new egret.Sprite(); inner.rotation = -45;
    inner.clipRect = { x: -4, y: -1, width: 8, height: 2 }; outer.addChild(inner);
    const child = target(inner, { x: -8, y: -8, width: 16, height: 16 });
    assert.equal(engine.stage.hitTest(1, 0), child);
    assert.equal(engine.stage.hitTest(2.5, 2.5), behind); // inside rotated world AABB, outside outer diamond
    assert.equal(engine.stage.hitTest(0, 1.5), behind); // outer accepts; inner rejects
    assert.equal(engine.stage.hitTest(0, -0.5), child);
  });
});

test('HT06 alpha is ignored, visibility suppresses and touchChildren never retargets', async () => {
  await withEngine(async engine => {
    const parent = target(engine.stage, { x: 0, y: 0, width: 2, height: 2 });
    const child = target(parent, { x: 0, y: 0, width: 8, height: 8 });
    parent.alpha = 0; child.alpha = 0;
    assert.equal(engine.stage.hitTest(3, 3), child); // miss of parent area does not suppress children
    parent.touchChildren = false;
    assert.equal(engine.stage.hitTest(3, 3), undefined);
    assert.equal(engine.stage.hitTest(1, 1), parent);
    parent.touchEnabled = false; assert.equal(engine.stage.hitTest(1, 1), undefined);
    parent.hitArea = undefined; assert.equal(engine.stage.hitTest(1, 1), undefined);
    parent.touchChildren = true; assert.equal(engine.stage.hitTest(3, 3), child);
    parent.visible = false; assert.equal(engine.stage.hitTest(3, 3), undefined);
    parent.visible = true; child.touchEnabled = false; assert.equal(engine.stage.hitTest(3, 3), undefined);
    engine.stage.touchEnabled = true; engine.stage.hitArea = { x: -100, y: -100, width: 200, height: 200 };
    assert.equal(engine.stage.hitTest(90, 90), undefined);
    engine.stage.touchChildren = false; assert.equal(engine.stage.hitTest(1, 1), undefined);
  });
});

test('HT07 source rectangle reads are ordinary, ordered, once each and do not enumerate', () => {
  const node = new egret.DisplayObject(), reads = [];
  const inherited = Object.create(Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, 0])));
  for (const [key, value] of [['x', -2], ['y', -3], ['width', 8], ['height', 9]]) {
    Object.defineProperty(Object.getPrototypeOf(inherited), key, { get() { reads.push(key); return value; }, configurable: true });
  }
  try {
    node.hitArea = new Proxy(inherited, {
      ownKeys() { throw Error('unexpected enumeration'); },
      getPrototypeOf() { throw Error('unexpected prototype inspection'); },
    });
    assert.deepEqual(reads, ['x', 'y', 'width', 'height']);
    assert.deepEqual(node.hitArea, { x: -2, y: -3, width: 8, height: 9 });
    reads.length = 0;
    code(() => { node.hitArea = Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, undefined])); }, 'HIT_TEST_AREA_INVALID');
    const invalid = {};
    for (const [key, value] of [['x', 'bad'], ['y', 0], ['width', 1], ['height', 1]]) {
      Object.defineProperty(invalid, key, { get() { reads.push(key); return value; } });
    }
    code(() => { node.hitArea = invalid; }, 'HIT_TEST_AREA_INVALID');
    assert.deepEqual(reads, ['x', 'y', 'width', 'height']);
  } finally { node.dispose(); }
});

for (const [index, cause] of [undefined, null, { source: 'area' }, new egret.EgretError('ENGINE_CLOSED')].entries()) {
  test(`HT08 throwing area source is wrapped with exact cause ${index}`, () => {
    const node = new egret.DisplayObject(); node.hitArea = { x: 1, y: 2, width: 3, height: 4 };
    const previous = node.hitArea;
    try {
      code(() => { node.hitArea = { get x() { throw cause; }, y: 0, width: 1, height: 1 }; }, 'HIT_TEST_AREA_INVALID', cause);
      assert.equal(node.hitArea, previous);
    } finally { node.dispose(); }
  });
}

test('HT09 area semantics reject shapes, primitive coercion, extents and even zero-height overflow', () => {
  const node = new egret.DisplayObject(); node.hitArea = { x: 1, y: 2, width: 3, height: 4 };
  const previous = node.hitArea; let coercions = 0;
  try {
    for (const input of [null, [], 1, 'x', true, 1n, () => {}, Symbol('area')]) code(() => { node.hitArea = input; }, 'HIT_TEST_AREA_INVALID');
    for (const field of ['x', 'y', 'width', 'height']) for (const value of [undefined, null, NaN, Infinity, '1', new Number(1), { valueOf() { coercions++; return 1; } }]) {
      code(() => { node.hitArea = { x: 0, y: 0, width: 1, height: 1, [field]: value }; }, 'HIT_TEST_AREA_INVALID');
    }
    for (const input of [{ x: 0, y: 0, width: -1, height: 1 }, { x: 0, y: 0, width: 1, height: -1 }, { x: Number.MAX_VALUE, y: 0, width: Number.MAX_VALUE, height: 0 }]) {
      code(() => { node.hitArea = input; }, 'HIT_TEST_AREA_INVALID');
    }
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    const failure = code(() => { node.hitArea = revoked.proxy; }, 'HIT_TEST_AREA_INVALID');
    assert.ok(failure.cause instanceof TypeError); assert.equal(node.hitArea, previous); assert.equal(coercions, 0);
  } finally { node.dispose(); }
});

test('HT10 successful area-read disposal wins semantics and completed nested assignments persist', () => {
  const node = new egret.DisplayObject(); node.hitArea = { x: 0, y: 0, width: 1, height: 1 };
  const nested = { x: 5, y: 6, width: 7, height: 8 };
  code(() => { node.hitArea = { get x() { node.hitArea = nested; return 0; }, y: 0, width: 1, height: -1 }; }, 'HIT_TEST_AREA_INVALID');
  assert.deepEqual(node.hitArea, nested);
  const previous = node.hitArea;
  code(() => { node.hitArea = { x: 0, y: 0, width: 1, get height() { node.dispose(); return -1; } }; }, 'OBJECT_DISPOSED');
  assert.equal(node.hitArea, previous); assert.equal(node.touchEnabled, false);
});

for (const throwing of [false, true]) {
  test(`HT11 deferred Engine shutdown in successful/throwing area source ${throwing}`, async () => {
    await withEngine(async engine => {
      const node = target(engine.stage); let close, inner;
      const sourceCause = new egret.EgretError('AREA_APPLICATION_CAUSE');
      code(() => engine.captureFrame({
        get width() {
          inner = thrown(() => { node.hitArea = { x: 0, y: 0, width: 1, get height() { close = engine.dispose(); if (throwing) throw sourceCause; return -1; } }; });
          assert.equal(node.isDisposed, false); return 16;
        }, height: 16,
      }), 'ENGINE_CLOSED');
      assert.equal(inner.code, throwing ? 'HIT_TEST_AREA_INVALID' : 'ENGINE_CLOSED');
      if (throwing) assert.equal(inner.cause, sourceCause);
      await close;
    });
  });
}

test('HT12 flag setters reject coercion and genuine identity precedes receiver hooks', () => {
  const node = new egret.DisplayObject(), container = new egret.Sprite();
  const enabled = descriptor(egret.DisplayObject.prototype, 'touchEnabled');
  const area = descriptor(egret.DisplayObject.prototype, 'hitArea');
  const children = descriptor(egret.DisplayObjectContainer.prototype, 'touchChildren');
  let reads = 0;
  const forged = new Proxy({}, { get() { reads++; throw Error('receiver read'); } });
  try {
    for (const input of [undefined, null, 0, 1, 'true', new Boolean(true), {}, () => {}]) {
      code(() => { node.touchEnabled = input; }, 'HIT_TEST_VALUE_INVALID');
      code(() => { container.touchChildren = input; }, 'HIT_TEST_VALUE_INVALID');
    }
    for (const operation of [enabled.get, enabled.set, area.get, area.set, children.get, children.set]) {
      code(() => Reflect.apply(operation, forged, [true]), 'HIT_TEST_RECEIVER_INVALID');
    }
    code(() => Reflect.apply(children.get, node, []), 'HIT_TEST_RECEIVER_INVALID');
    code(() => Reflect.apply(children.set, node, [true]), 'HIT_TEST_RECEIVER_INVALID');
    assert.equal(reads, 0); node.dispose(); container.dispose();
    assert.equal(node.touchEnabled, false); assert.equal(container.touchChildren, true);
    code(() => { node.touchEnabled = 'bad'; }, 'OBJECT_DISPOSED');
    code(() => { container.touchChildren = 'bad'; }, 'OBJECT_DISPOSED');
  } finally { node.dispose(); container.dispose(); }
});

test('HT13 query receiver/coordinates/options admission uses fixed primitive and cause priority', async () => {
  await withEngine(async engine => {
    let reads = 0, coercions = 0;
    const options = { get maxNodes() { reads++; throw Error('unread option'); } };
    const proxy = new Proxy(engine.stage, { get() { reads++; throw Error('unread receiver'); } });
    for (const value of [undefined, null, {}, Object.create(egret.Stage.prototype), proxy, new egret.Sprite()]) {
      code(() => stageQuery(value, NaN, 0, options), 'HIT_TEST_RECEIVER_INVALID');
      if (value instanceof egret.Sprite) value.dispose();
    }
    for (const value of [undefined, null, NaN, Infinity, -Infinity, '1', 1n, true, new Number(1), { valueOf() { coercions++; return 1; } }]) {
      code(() => engine.stage.hitTest(value, 0, options), 'HIT_TEST_INPUT_INVALID');
      code(() => engine.stage.hitTest(0, value, options), 'HIT_TEST_INPUT_INVALID');
    }
    assert.equal(reads, 0); assert.equal(coercions, 0);
    for (const input of [null, [], 1, 'x', true, () => {}, 1n, Symbol('options')]) code(() => engine.stage.hitTest(0, 0, input), 'HIT_TEST_INPUT_INVALID');
    for (const maxNodes of [null, 0, -1, 1.5, 65537, NaN, Infinity, '1', new Number(1)]) code(() => engine.stage.hitTest(0, 0, { maxNodes }), 'HIT_TEST_INPUT_INVALID');
    for (const cause of [undefined, null, { source: 'maxNodes' }, new egret.EgretError('ENGINE_CLOSED')]) {
      code(() => engine.stage.hitTest(0, 0, { get maxNodes() { throw cause; } }), 'HIT_TEST_INPUT_INVALID', cause);
    }
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    assert.ok(code(() => engine.stage.hitTest(0, 0, revoked.proxy), 'HIT_TEST_INPUT_INVALID').cause instanceof TypeError);
  });
});

test('HT14 one ordinary inherited/proxied budget read sees the resulting current tree', async () => {
  await withEngine(async engine => {
    const first = target(engine.stage), second = target(engine.stage); let reads = 0;
    const options = new Proxy(Object.create({ get maxNodes() { reads++; engine.stage.removeChild(second); return 2; } }), {
      ownKeys() { throw Error('enumeration'); }, getPrototypeOf() { throw Error('prototype inspection'); },
    });
    assert.equal(engine.stage.hitTest(1, 1, options), first); assert.equal(reads, 1);
    first.addChild(second);
    assert.equal(engine.stage.hitTest(1, 1, { get maxNodes() { second.dispose(); return 2; } }), first);
    assert.equal(second.isDisposed, true);
    const third = target(engine.stage); const parent = new egret.Sprite(); parent.x = 20; engine.stage.addChild(parent);
    assert.equal(engine.stage.hitTest(1, 1, { get maxNodes() { parent.addChild(third); return 4; } }), first);
    assert.equal(engine.stage.hitTest(21, 1), third);
  });
});

test('HT15 full structure budget includes hidden, disabled and suppressed descendants', async () => {
  await withEngine(async engine => {
    const hidden = new egret.Sprite(); hidden.visible = false; hidden.scaleX = Number.MAX_VALUE;
    engine.stage.addChild(hidden); const suppressed = new egret.Sprite(); suppressed.scaleX = 2; hidden.addChild(suppressed);
    const winner = target(engine.stage);
    code(() => engine.stage.hitTest(1, 1, { maxNodes: 3 }), 'HIT_TEST_TREE_LIMIT');
    assert.equal(engine.stage.hitTest(1, 1, { maxNodes: 4 }), winner);
    engine.stage.visible = false; code(() => engine.stage.hitTest(1, 1, { maxNodes: 3 }), 'HIT_TEST_TREE_LIMIT');
    assert.equal(engine.stage.hitTest(1, 1, { maxNodes: 4 }), undefined);
    engine.stage.visible = true; engine.stage.touchChildren = false;
    code(() => engine.stage.hitTest(1, 1, { maxNodes: 3 }), 'HIT_TEST_TREE_LIMIT');
    assert.equal(engine.stage.hitTest(1, 1, { maxNodes: 4 }), undefined);
    engine.stage.touchChildren = true; hidden.visible = true;
    code(() => engine.stage.hitTest(1, 1, { maxNodes: 3 }), 'HIT_TEST_TREE_LIMIT');
    code(() => engine.stage.hitTest(1, 1, { maxNodes: 4 }), 'HIT_TEST_ARITHMETIC_RANGE');
  });
});

test('HT16 valid winner cannot hide active overflow in either sibling order', async () => {
  await withEngine(async engine => {
    const overflow = new egret.Sprite(); overflow.scaleX = Number.MAX_VALUE; engine.stage.addChild(overflow);
    const badChild = new egret.Sprite(); badChild.scaleX = 2; overflow.addChild(badChild);
    const winner = target(engine.stage);
    code(() => engine.stage.hitTest(1, 1), 'HIT_TEST_ARITHMETIC_RANGE');
    engine.stage.setChildIndex(overflow, 1); code(() => engine.stage.hitTest(1, 1), 'HIT_TEST_ARITHMETIC_RANGE');
    overflow.visible = false; assert.equal(engine.stage.hitTest(1, 1), winner);
    overflow.visible = true; overflow.touchChildren = false; assert.equal(engine.stage.hitTest(1, 1), winner);
    overflow.touchChildren = true; overflow.clipRect = { x: 0, y: 10, width: 1, height: 1 };
    assert.equal(engine.stage.hitTest(1, 1), winner);
    overflow.clipRect = undefined; overflow.alpha = 0;
    code(() => engine.stage.hitTest(1, 1), 'HIT_TEST_ARITHMETIC_RANGE');
  });
});

test('HT17 active clip endpoints overflow before empty suppression, hidden clips are not evaluated', async () => {
  await withEngine(async engine => {
    const node = target(engine.stage);
    node.clipRect = { x: Number.MAX_VALUE, y: 0, width: Number.MAX_VALUE, height: 0 };
    code(() => engine.stage.hitTest(1, 1), 'HIT_TEST_ARITHMETIC_RANGE');
    node.visible = false; assert.equal(engine.stage.hitTest(1, 1), undefined);
    node.visible = true; node.scaleX = 0; assert.equal(engine.stage.hitTest(Number.MAX_VALUE, 1), undefined);
    node.scaleX = 1; node.clipRect = { x: 0, y: 0, width: 0, height: 1 };
    assert.equal(engine.stage.hitTest(Number.MAX_VALUE, 1), undefined);
  });
});

test('HT18 area-less/disabled ancestors probe rank without inverting a huge local point', async () => {
  await withEngine(async engine => {
    const parent = new egret.Sprite(); parent.scaleX = Number.MIN_VALUE; engine.stage.addChild(parent);
    const child = target(parent, { x: 0, y: 0, width: 2 ** 51, height: 2 }); child.scaleX = Number.MAX_VALUE;
    assert.equal(engine.stage.hitTest(1, 1), child);
    parent.hitArea = { x: 0, y: 0, width: 1, height: 2 };
    assert.equal(engine.stage.hitTest(1, 1), child); // disabled own area still needs no point inverse
    parent.touchEnabled = true;
    const enabledFailure = code(() => engine.stage.hitTest(1, 1), 'HIT_TEST_ARITHMETIC_RANGE');
    assert.equal(enabledFailure.cause.code, 'COORDINATE_ARITHMETIC_RANGE');
    parent.touchEnabled = false; parent.clipRect = { x: 0, y: 0, width: 1, height: 2 };
    code(() => engine.stage.hitTest(1, 1), 'HIT_TEST_ARITHMETIC_RANGE');
  });
});

test('HT19 exact stored rank survives naive determinant underflow and overflow', async () => {
  await withEngine(async engine => {
    const tiny = target(engine.stage, { x: 0, y: 0, width: 4, height: 4 });
    tiny.scaleX = 2 ** -600; tiny.scaleY = 2 ** -600;
    assert.equal(engine.stage.hitTest(2 ** -599, 2 ** -599), tiny);
    engine.stage.removeChild(tiny); tiny.dispose();
    const large = target(engine.stage, { x: 0, y: 0, width: 4, height: 4 });
    large.scaleX = 2 ** 600; large.scaleY = 2 ** 600;
    assert.equal(engine.stage.hitTest(2 ** 601, 2 ** 601), large);
    large.scaleX = 0; assert.equal(engine.stage.hitTest(Number.MAX_VALUE, Number.MAX_VALUE), undefined);
  });
});

test('HT20 query uses private current state and invokes no overridable display or Scope hooks', async () => {
  await withEngine(async engine => {
    const scope = engine.createScope(); const parent = scope.use(new egret.Sprite()); engine.stage.addChild(parent);
    const child = scope.use(new egret.Sprite()); child.touchEnabled = true;
    child.hitArea = { x: 0, y: 0, width: 8, height: 8 }; parent.addChild(child);
    let reads = 0;
    for (const node of [engine.stage, parent, child]) {
      for (const name of ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'parent', 'numChildren', 'visible', 'alpha', 'clipRect', 'touchEnabled', 'hitArea', 'touchChildren']) {
        Object.defineProperty(node, name, { get() { reads++; throw Error('unexpected public getter'); }, configurable: true });
      }
      for (const name of ['getBounds', 'globalToLocal', 'assertUsable']) Object.defineProperty(node, name, { value() { reads++; throw Error('unexpected public hook'); }, configurable: true });
    }
    Object.defineProperty(scope, 'state', { get() { reads++; throw Error('unexpected Scope getter'); }, configurable: true });
    assert.equal(engine.stage.hitTest(1, 1), child); assert.equal(reads, 0);
    scope.dispose(); assert.equal(reads, 0);
  });
});

test('HT21 node/Engine terminal states precede invalid values and throwing options', async () => {
  await withEngine(async engine => {
    const child = target(engine.stage); const detached = engine.stage.removeChild(child);
    assert.equal(engine.stage.hitTest(1, 1), undefined); assert.equal(detached, child);
    child.dispose(); code(() => { child.hitArea = null; }, 'OBJECT_DISPOSED');
    engine.stage.dispose(); let reads = 0;
    code(() => engine.stage.hitTest(NaN, 0, { get maxNodes() { reads++; throw Error('unread'); } }), 'OBJECT_DISPOSED');
    assert.equal(reads, 0);
  });
});

for (const throwing of [false, true]) {
  test(`HT22 options shutdown priority while Stage is live ${throwing}`, async () => {
    await withEngine(async engine => {
      target(engine.stage); let close, inner, reads = 0;
      const cause = new egret.EgretError('OPTION_APPLICATION_CAUSE');
      code(() => engine.captureFrame({
        get width() {
          inner = thrown(() => engine.stage.hitTest(1, 1, { get maxNodes() { reads++; close = engine.dispose(); if (throwing) throw cause; return 0; } }));
          assert.equal(engine.stage.isDisposed, false);
          code(() => engine.stage.hitTest(NaN, 0, { get maxNodes() { reads++; throw Error('unread'); } }), 'ENGINE_CLOSED');
          return 16;
        }, height: 16,
      }), 'ENGINE_CLOSED');
      assert.equal(reads, 1); assert.equal(inner.code, throwing ? 'HIT_TEST_INPUT_INVALID' : 'ENGINE_CLOSED');
      if (throwing) assert.equal(inner.cause, cause);
      await close;
    });
  });
}

test('HT23 hit queries do not change frames, clock/Tween, host calls or diagnostics', async () => {
  await withEngine(async (engine, host, diagnostics) => {
    const scope = engine.createScope(), samples = [];
    const tween = engine.createTween(scope, { from: 1, to: 5, durationSeconds: 2, onUpdate(value) { samples.push(value); return undefined; } });
    tween.start(); const node = target(engine.stage);
    const frameA = engine.captureFrame({ width: 16, height: 16 });
    const before = { trace: [...host.trace], tick: engine.clock.tickId, elapsed: engine.clock.elapsedSeconds, tween: tween.value, samples: [...samples], scope: scope.state };
    assert.equal(engine.stage.hitTest(1, 1), node);
    assert.equal(engine.stage.hitTest(99, 99), undefined);
    code(() => engine.stage.hitTest(NaN, 1), 'HIT_TEST_INPUT_INVALID');
    assert.deepEqual({ trace: [...host.trace], tick: engine.clock.tickId, elapsed: engine.clock.elapsedSeconds, tween: tween.value, samples: [...samples], scope: scope.state }, before);
    assert.deepEqual(diagnostics, []); assert.equal(host.timers.size, 0);
    const frameB = engine.captureFrame({ width: 16, height: 16 });
    assert.equal(frameB.frameId, frameA.frameId + 1);
  });
});

test('HT24 rectangular picking never reads a released Bitmap image lease', async () => {
  await withEngine(async engine => {
    const image = egret.createImageData2D({ width: 1, height: 1, pixels: new Uint8Array([255, 255, 255, 255]) });
    const texture = egret.createTexture(image), type = egret.createAssetType('ht1.texture', egret.isTexture);
    const ref = egret.createAssetRef(type, 'ht1.image'); let loads = 0, disposals = 0;
    engine.assets.register(type, { async load() { loads++; return texture; }, dispose() { disposals++; } });
    const lease = await engine.assets.acquire(ref), bitmap = new egret.Bitmap(lease);
    bitmap.touchEnabled = true; bitmap.hitArea = { x: 0, y: 0, width: 4, height: 4 }; engine.stage.addChild(bitmap);
    lease.release();
    assert.equal(engine.stage.hitTest(2, 2), bitmap);
    assert.equal(loads, 1); assert.equal(disposals, 1);
    assert.equal(engine.stage.hitTest(5, 5), undefined);
  });
});

test('HT25 omitted and explicit undefined budgets enforce the receiver-inclusive 4096 default', async () => {
  await withEngine(async engine => {
    for (let index = 0; index < 4095; index++) {
      const node = new egret.DisplayObject(); node.visible = false; engine.stage.addChild(node);
    }
    assert.equal(engine.stage.hitTest(0, 0), undefined);
    engine.stage.addChild(new egret.DisplayObject());
    code(() => engine.stage.hitTest(0, 0), 'HIT_TEST_TREE_LIMIT');
    code(() => engine.stage.hitTest(0, 0, { maxNodes: undefined }), 'HIT_TEST_TREE_LIMIT');
    assert.equal(engine.stage.hitTest(0, 0, { maxNodes: 65536 }), undefined);
  });
});

test('HT26 Stage-owned transformed clip has half-open edges and never makes Stage a target', async () => {
  await withEngine(async engine => {
    const stage = engine.stage;
    stage.x = 10; stage.y = 20; stage.scaleX = 2; stage.scaleY = 3;
    stage.clipRect = { x: 0, y: 0, width: 4, height: 4 };
    stage.touchEnabled = true; stage.hitArea = { x: -10, y: -10, width: 30, height: 30 };
    const child = target(stage, { x: -10, y: -10, width: 30, height: 30 });
    assert.equal(stage.hitTest(10, 20), child); // Stage-local (0,0), included
    assert.equal(stage.hitTest(16, 29), child); // Stage-local (3,3)
    assert.equal(stage.hitTest(18, 29), undefined); // Stage-local right=4
    assert.equal(stage.hitTest(16, 32), undefined); // Stage-local bottom=4
    assert.equal(stage.hitTest(8, 23), undefined); // Stage-local x=-1
    child.visible = false;
    assert.equal(stage.hitTest(16, 29), undefined);
  });
});

test('HT27 area-less singular ancestor prunes a rounded rank-regaining descendant', async () => {
  await withEngine(async engine => {
    const behind = target(engine.stage, { x: -1, y: -1, width: 2, height: 2 });
    const parent = new egret.Sprite(); parent.rotation = 45; parent.scaleY = 0;
    engine.stage.addChild(parent);
    const child = target(parent, { x: 0.25, y: 0.25, width: 1, height: 1 });
    child.rotation = 45;
    // Ordinary composition can give these child coefficients. Rounded products
    // cancel, but exact dyadic rank regains a determinant of 2**-106. The stored
    // singular parent still suppresses the entire branch.
    const a = 0.5 + 2 ** -53, b = 0.5, c = -0.5, d = -0.5 + 2 ** -53;
    assert.equal(a * d - b * c, 0);
    const halfUnits = 1n << 52n; // Integer coefficient units are exactly 2**-53.
    assert.equal((halfUnits + 1n) * (-halfUnits + 1n) - halfUnits * (-halfUnits), 1n);
    assert.equal(engine.stage.hitTest(0, 2 ** -106), behind);
  });
});
