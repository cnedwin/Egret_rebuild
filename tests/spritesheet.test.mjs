// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as egret from '@egret/engine';
import { host } from './helpers.mjs';

// Original SS1 literals. Transparent bottom-right pixels are intentional.
const PIXELS = Object.freeze([
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,255,255, 0,0,255,255, 0,0,255,255,
  255,0,0,255, 255,0,0,255, 0,255,0,255, 0,0,0,0, 0,0,0,0, 0,0,0,0,
]);
const RED = Object.freeze({ x: 0, y: 0, width: 2, height: 2 });
const GREEN = Object.freeze({ x: 2, y: 0, width: 1, height: 2 });
const BLUE = Object.freeze({ x: 3, y: 0, width: 3, height: 1 });
const FRAME = Object.freeze({ width: 8, height: 4, clearColor: 0, clearAlpha: 0 });
const input = () => [
  { name: 'red', x: 0, y: 0, width: 2, height: 2 },
  { name: 'green', x: 2, y: 0, width: 1, height: 2 },
  { name: 'blue', x: 3, y: 0, width: 3, height: 1 },
  { name: '__proto__', x: 3, y: 0, width: 3, height: 1 },
];
const one = (changes = {}) => [{ name: 'red', x: 0, y: 0, width: 2, height: 2, ...changes }];

function refusal(action, code, cause) {
  const compareCause = arguments.length === 3;
  let observed;
  assert.throws(action, error => {
    observed = error;
    assert.ok(error instanceof egret.EgretError);
    assert.equal(error.code, code);
    if (compareCause) assert.equal(error.cause, cause);
    return true;
  });
  return observed;
}

async function scene() {
  const diagnostics = [], port = host();
  const engine = await egret.createEngine({ host: port.adapter,
    clock: { maxDeltaSeconds: 0.5 }, onDiagnostic(value) { diagnostics.push(value); } });
  try {
    const resources = engine.createScope(), scope = engine.createScope();
    const image = egret.createImageData2D({ width: 6, height: 2, pixels: new Uint8Array(PIXELS) });
    let loads = 0, disposals = 0, nextId = 0;
    const textures = [];
    async function acquire(crop) {
      const id = ++nextId;
      const type = egret.createAssetType(`ss1-public-texture-${id}`, egret.isTexture);
      engine.assets.register(type, {
        async load() { loads++; const value = egret.createTexture(image, crop); textures.push(value); return value; },
        dispose(value) { disposals++; value.dispose(); },
      });
      return resources.use(await engine.assets.acquire(egret.createAssetRef(type, `ss1-public-image-${id}`)));
    }
    const lease = await acquire();
    return { engine, resources, scope, image, lease, acquire, textures, diagnostics, port,
      counts: () => ({ loads, disposals }) };
  } catch (cause) { await engine.dispose(); throw cause; }
}

async function close(f) {
  try { f.scope.dispose(); f.resources.dispose(); }
  finally { await f.engine.dispose(); }
  assert.deepEqual(f.port.trace, ['start', 'stop', 'close']);
  assert.equal(f.port.timers.size, 0);
  const counts = f.counts();
  assert.ok(counts.loads >= 1);
  assert.equal(counts.disposals, counts.loads);
  assert.ok(f.textures.every(texture => texture.isDisposed));
  assert.deepEqual(f.diagnostics, []);
}

const ownSheet = (f, frames = input()) => f.scope.use(egret.createSpriteSheet(f.lease, frames));
function legalControl(f, frames = input()) {
  const sheet = ownSheet(f, frames);
  assert.deepEqual(sheet.getRegion(frames[0].name), RED);
  sheet.dispose();
}

test('SS02 named icons own metadata and borrow the original real lease', async () => {
  const f = await scene();
  try {
    const frames = input(), sheet = ownSheet(f, frames);
    const red = f.scope.use(sheet.createBitmap('red'));
    const icon = f.scope.use(sheet.createBitmap('__proto__'));
    assert.deepEqual(sheet.names, ['red', 'green', 'blue', '__proto__']);
    assert.deepEqual([sheet.frameCount, sheet.atlasWidth, sheet.atlasHeight], [4, 6, 2]);
    assert.deepEqual(sheet.getRegion('red'), RED);
    assert.deepEqual(sheet.getRegion('green'), GREEN);
    assert.deepEqual(sheet.getRegion('blue'), BLUE);
    assert.deepEqual(sheet.getRegion('__proto__'), BLUE);
    assert.ok(Object.isFrozen(sheet) && Object.isFrozen(sheet.names));
    assert.ok(Object.isFrozen(sheet.getRegion('red')));
    assert.equal(sheet.names, sheet.names);
    assert.equal(sheet.getRegion('red'), sheet.getRegion('red'));
    assert.equal(red.textureLease, f.lease); assert.equal(icon.textureLease, f.lease);
    assert.equal(red instanceof egret.Bitmap, true); assert.equal(icon instanceof egret.Bitmap, true);
    assert.deepEqual([red.naturalWidth, red.naturalHeight, icon.naturalWidth, icon.naturalHeight], [2, 2, 3, 1]);
    assert.deepEqual(red.sourceRect, RED); assert.deepEqual(icon.sourceRect, BLUE);
    red.x = 1; red.y = 1; icon.x = 4; icon.y = 1;
    f.engine.stage.addChild(red); f.engine.stage.addChild(icon);
    const captured = f.engine.captureFrame(FRAME);
    assert.equal(captured.commands.length, 2); assert.equal(captured.images.length, 1);
    assert.equal(captured.images[0], f.image);
    assert.deepEqual(captured.commands.map(command => command.sourceRect), [RED, BLUE]);
    assert.deepEqual(captured.commands.map(command => command.rect), [
      { x: 0, y: 0, width: 2, height: 2 }, { x: 0, y: 0, width: 3, height: 1 },
    ]);
    assert.deepEqual(captured.commands.map(command => [command.matrix.tx, command.matrix.ty]), [[1, 1], [4, 1]]);
    frames[0].name = 'changed'; frames[0].width = 6; frames.reverse(); frames.length = 0;
    assert.deepEqual(sheet.names, ['red', 'green', 'blue', '__proto__']);
    assert.deepEqual(sheet.getRegion('red'), RED);
    assert.deepEqual([...egret.copyImageData2DPixels(captured.images[0])], PIXELS);
    assert.deepEqual(f.counts(), { loads: 1, disposals: 0 });
  } finally { await close(f); }
});

test('SS03 exact names preserve case, spaces and UTF-16 code units', async () => {
  const f = await scene();
  try {
    const names = ['a', 'A', ' a ', ' ', '\ud800', '\udc00', 'é', 'e\u0301', '__proto__'];
    const frames = names.map(name => ({ name, x: 0, y: 0, width: 2, height: 2 }));
    frames[1] = { name: 'A', x: 2, y: 0, width: 1, height: 2 };
    const sheet = ownSheet(f, frames);
    assert.deepEqual(sheet.names, names);
    assert.deepEqual(sheet.getRegion('a'), RED); assert.deepEqual(sheet.getRegion('A'), GREEN);
    for (const name of [' a ', ' ', '\ud800', '\udc00', 'é', 'e\u0301', '__proto__']) assert.deepEqual(sheet.getRegion(name), RED);
  } finally { await close(f); }
});

test('SS03 invalid exact lookup names each follow their own genuine legal control', async t => {
  const cases = [
    ['case', 'RED', 'SPRITE_SHEET_FRAME_UNKNOWN'],
    ['space', 'red ', 'SPRITE_SHEET_FRAME_UNKNOWN'],
    ['empty', '', 'SPRITE_SHEET_NAME_INVALID'],
    ['overlength', 'x'.repeat(129), 'SPRITE_SHEET_LIMIT'],
    ['numeric', 7, 'SPRITE_SHEET_INPUT_INVALID'],
    ['no-coercion', null, 'SPRITE_SHEET_INPUT_INVALID'],
  ];
  for (const [label, name, code] of cases) await t.test(label, async () => {
    const f = await scene();
    try {
      const sheet = ownSheet(f); assert.deepEqual(sheet.getRegion('red'), RED);
      let coercions = 0;
      const bad = label === 'no-coercion' ? { toString() { coercions++; return 'red'; } } : name;
      refusal(() => sheet.getRegion(bad), code); assert.equal(coercions, 0);
    } finally { await close(f); }
  });
});

test('SS03 readable proxies and own nonenumerable fields ignore every extra field and iterator', async () => {
  const f = await scene();
  try {
    const record = Object.create({ ignored: 'prototype' });
    for (const [key, value] of Object.entries({ name: 'red', x: 0, y: 0, width: 2, height: 2 })) {
      Object.defineProperty(record, key, { value, enumerable: false });
    }
    let extras = 0;
    Object.defineProperty(record, 'rotated', { get() { extras++; throw new Error('extra must stay unread'); } });
    Object.defineProperty(record, Symbol('extra'), { get() { extras++; throw new Error('symbol must stay unread'); } });
    const proxied = new Proxy(record, { ownKeys() { throw new Error('no field enumeration'); } });
    const frames = [proxied];
    Object.defineProperty(frames, Symbol.iterator, { value() { throw new Error('no caller iterator'); } });
    const sheet = ownSheet(f, new Proxy(frames, {}));
    assert.deepEqual(sheet.names, ['red']); assert.deepEqual(sheet.getRegion('red'), RED);
    assert.equal(extras, 0);
  } finally { await close(f); }
});

test('SS03 frozen arrays and null-prototype own records are admitted without modifying caller input', async () => {
  const f = await scene();
  try {
    const record = Object.freeze(Object.assign(Object.create(null), one()[0]));
    const table = Object.freeze([record]);
    const sheet = ownSheet(f, table);
    assert.deepEqual(sheet.names, ['red']); assert.deepEqual(sheet.getRegion('red'), RED);
    assert.equal(table[0], record); assert.equal(record.name, 'red'); assert.equal(record.width, 2);
    assert.equal(Object.getPrototypeOf(record), null);
  } finally { await close(f); }
});

test('SS04 own tests and gets occur once in the prescribed five-field order', async () => {
  const f = await scene();
  try {
    const trace = [], arrayGets = [];
    const record = new Proxy(one()[0], {
      getOwnPropertyDescriptor(target, key) { trace.push(`own:${String(key)}`); return Reflect.getOwnPropertyDescriptor(target, key); },
      get(target, key, receiver) { trace.push(`get:${String(key)}`); return Reflect.get(target, key, receiver); },
      ownKeys() { throw new Error('no enumeration'); },
    });
    const frames = new Proxy([record], {
      get(target, key, receiver) { arrayGets.push(key); return Reflect.get(target, key, receiver); },
    });
    const sheet = ownSheet(f, frames);
    assert.deepEqual(trace, [
      'own:name', 'get:name', 'own:x', 'get:x', 'own:y', 'get:y',
      'own:width', 'get:width', 'own:height', 'get:height',
    ]);
    assert.deepEqual(arrayGets, ['length', '0']);
    assert.deepEqual(sheet.getRegion('red'), RED);
  } finally { await close(f); }
});

test('SS04 a late record throw precedes an earlier missing field or numeric defect', async t => {
  for (const defect of ['missing-name', 'negative-x']) {
    await t.test(defect, async () => {
      const f = await scene();
      try {
        legalControl(f);
        const first = one()[0], last = { name: 'last', x: 3, y: 0, width: 3 };
        if (defect === 'missing-name') delete first.name;
        else first.x = -1;
        const cause = new egret.EgretError('SPRITE_SHEET_REGION_INVALID');
        let reads = 0;
        Object.defineProperty(last, 'height', { get() { reads++; throw cause; } });
        refusal(() => egret.createSpriteSheet(f.lease, [first, last]), 'SPRITE_SHEET_READ_FAILED', cause);
        assert.equal(reads, 1); assert.deepEqual(f.counts(), { loads: 1, disposals: 0 });
      } finally { await close(f); }
    });
  }
});

test('SS04 successful own-test retirement prevents the following property getter', async t => {
  for (const termination of ['lease', 'engine']) {
    await t.test(termination, async () => {
      const f = await scene();
      try {
        legalControl(f);
        let gets = 0, owns = 0;
        const record = one()[0];
        Object.defineProperty(record, 'x', { get() { gets++; return -1; } });
        const proxied = new Proxy(record, {
          getOwnPropertyDescriptor(target, key) {
            const result = Reflect.getOwnPropertyDescriptor(target, key);
            if (key === 'x') { owns++; if (termination === 'lease') f.lease.release(); else void f.engine.dispose(); }
            return result;
          },
        });
        refusal(() => egret.createSpriteSheet(f.lease, [proxied]), termination === 'lease' ? 'ASSET_LEASE_RELEASED' : 'ENGINE_CLOSED');
        assert.equal(owns, 1); assert.equal(gets, 0);
      } finally { await close(f); }
    });
  }
});

test('SS04 thrown undefined wins over retirement while successful reads revalidate before semantics', async t => {
  for (const mode of ['throw-release', 'throw-close', 'return-release', 'return-dispose-texture']) {
    await t.test(mode, async () => {
      const f = await scene();
      try {
        legalControl(f);
        let laterGets = 0;
        const record = { name: 'red', y: 0, width: 2, height: 2 };
        Object.defineProperty(record, 'x', { get() {
          if (mode === 'throw-close') void f.engine.dispose();
          else if (mode === 'return-dispose-texture') f.lease.value.dispose();
          else f.lease.release();
          if (mode.startsWith('throw-')) throw undefined;
          return -1;
        } });
        Object.defineProperty(record, 'y', { get() { laterGets++; return 0; } });
        if (mode.startsWith('throw-')) refusal(() => egret.createSpriteSheet(f.lease, [record]), 'SPRITE_SHEET_READ_FAILED', undefined);
        else refusal(() => egret.createSpriteSheet(f.lease, [record]), mode === 'return-release' ? 'ASSET_LEASE_RELEASED' : 'TEXTURE_DISPOSED');
        assert.equal(laterGets, 0);
      } finally { await close(f); }
    });
  }
});

test('SS04 independent nested construction cannot replace outer staging or impose a global busy lock', async () => {
  const f = await scene();
  try {
    let nested, reads = 0;
    const record = one()[0];
    Object.defineProperty(record, 'x', { get() {
      reads++; nested = egret.createSpriteSheet(f.lease, [{ name: 'inner', x: 2, y: 0, width: 1, height: 2 }]); return 0;
    } });
    const outer = ownSheet(f, [record]); f.scope.use(nested);
    assert.equal(reads, 1); assert.notEqual(outer, nested);
    assert.deepEqual(outer.names, ['red']); assert.deepEqual(outer.getRegion('red'), RED);
    assert.deepEqual(nested.names, ['inner']); assert.deepEqual(nested.getRegion('inner'), GREEN);
  } finally { await close(f); }
});

test('SS04 array and own-property source throws keep their exact occurrences without retries', async t => {
  for (const point of ['length', 'own-name']) await t.test(point, async () => {
    const f = await scene();
    try {
      legalControl(f);
      const cause = point === 'length' ? 0 : new Error('own-property occurrence');
      let hits = 0;
      const record = point === 'own-name' ? new Proxy(one()[0], {
        getOwnPropertyDescriptor(target, key) {
          if (key === 'name') { hits++; f.lease.release(); throw cause; }
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      }) : one()[0];
      const table = point === 'length' ? new Proxy([record], {
        get(target, key, receiver) {
          if (key === 'length') { hits++; throw cause; }
          return Reflect.get(target, key, receiver);
        },
      }) : [record];
      refusal(() => egret.createSpriteSheet(f.lease, table), 'SPRITE_SHEET_READ_FAILED', cause);
      assert.equal(hits, 1);
    } finally { await close(f); }
  });
});

test('SS03 revoked array and record proxies are source faults after a fresh legal control', async t => {
  for (const kind of ['array', 'record']) await t.test(kind, async () => {
    const f = await scene();
    try {
      legalControl(f);
      const revoked = Proxy.revocable(kind === 'array' ? one() : one()[0], {}); revoked.revoke();
      const table = kind === 'array' ? revoked.proxy : [revoked.proxy];
      const error = refusal(() => egret.createSpriteSheet(f.lease, table), 'SPRITE_SHEET_READ_FAILED');
      assert.ok(error.cause instanceof TypeError);
    } finally { await close(f); }
  });
});

test('SS04 successful array length retirement and count overflow precede indexed payload reads', async t => {
  for (const mode of ['retired', 'over-cap']) await t.test(mode, async () => {
    const f = await scene();
    try {
      legalControl(f);
      let indexedReads = 0;
      const target = mode === 'over-cap' ? new Array(1025) : one();
      const table = new Proxy(target, {
        get(targetArray, key, receiver) {
          if (key === 'length') { const result = Reflect.get(targetArray, key, receiver);
            if (mode === 'retired') f.lease.release(); return result; }
          indexedReads++; throw new Error('indexed payload must stay unread');
        },
        getOwnPropertyDescriptor(targetArray, key) {
          if (key === '0') { indexedReads++; throw new Error('indexed own test must stay unread'); }
          return Reflect.getOwnPropertyDescriptor(targetArray, key);
        },
      });
      refusal(() => egret.createSpriteSheet(f.lease, table), mode === 'retired' ? 'ASSET_LEASE_RELEASED' : 'SPRITE_SHEET_LIMIT');
      assert.equal(indexedReads, 0);
    } finally { await close(f); }
  });
});

test('SS05 structural and scalar boundary inputs each follow a fresh genuine legal control', async t => {
  const cases = [
    ['zero frames', () => [], 'SPRITE_SHEET_INPUT_INVALID'],
    ['non-array', () => ({ length: 1, 0: one()[0] }), 'SPRITE_SHEET_INPUT_INVALID'],
    ['null frames', () => null, 'SPRITE_SHEET_INPUT_INVALID'],
    ['null record', () => [null], 'SPRITE_SHEET_INPUT_INVALID'],
    ['primitive record', () => [7], 'SPRITE_SHEET_INPUT_INVALID'],
    ['inherited slot', () => { const frames = new Array(1); Object.setPrototypeOf(frames, { 0: one()[0] }); return frames; }, 'SPRITE_SHEET_INPUT_INVALID'],
    ['inherited field', () => [{ ...one()[0], name: undefined }].map(value => { delete value.name; return Object.assign(Object.create({ name: 'red' }), value); }), 'SPRITE_SHEET_INPUT_INVALID'],
    ['array record', () => [[]], 'SPRITE_SHEET_INPUT_INVALID'],
    ['function record', () => {
      const fn = () => {};
      Object.defineProperties(fn, Object.getOwnPropertyDescriptors(one()[0]));
      return [fn];
    }, 'SPRITE_SHEET_INPUT_INVALID'],
    ['missing height', () => { const value = one()[0]; delete value.height; return [value]; }, 'SPRITE_SHEET_INPUT_INVALID'],
    ['empty name', () => one({ name: '' }), 'SPRITE_SHEET_NAME_INVALID'],
    ['number name', () => one({ name: 3 }), 'SPRITE_SHEET_INPUT_INVALID'],
    ['boxed name', () => one({ name: new String('red') }), 'SPRITE_SHEET_INPUT_INVALID'],
    ['duplicate exact name', () => [one()[0], { name: 'red', x: 3, y: 0, width: 3, height: 1 }], 'SPRITE_SHEET_NAME_INVALID'],
    ['string coordinate', () => one({ x: '0' }), 'SPRITE_SHEET_INPUT_INVALID'],
    ['boolean y', () => one({ y: false }), 'SPRITE_SHEET_INPUT_INVALID'],
    ['string width', () => one({ width: '2' }), 'SPRITE_SHEET_INPUT_INVALID'],
    ['null height', () => one({ height: null }), 'SPRITE_SHEET_INPUT_INVALID'],
    ['boxed coordinate', () => one({ x: new Number(0) }), 'SPRITE_SHEET_INPUT_INVALID'],
    ['bigint coordinate', () => one({ x: 0n }), 'SPRITE_SHEET_INPUT_INVALID'],
    ['negative x', () => one({ x: -1 }), 'SPRITE_SHEET_REGION_INVALID'],
    ['negative y', () => one({ y: -1 }), 'SPRITE_SHEET_REGION_INVALID'],
    ['fractional width', () => one({ width: 0.5 }), 'SPRITE_SHEET_REGION_INVALID'],
    ['NaN', () => one({ x: NaN }), 'SPRITE_SHEET_REGION_INVALID'],
    ['Infinity', () => one({ y: Infinity }), 'SPRITE_SHEET_REGION_INVALID'],
    ['zero width', () => one({ width: 0 }), 'SPRITE_SHEET_REGION_INVALID'],
    ['negative height', () => one({ height: -1 }), 'SPRITE_SHEET_REGION_INVALID'],
    ['unsafe scalar', () => one({ x: Number.MAX_SAFE_INTEGER + 1 }), 'SPRITE_SHEET_REGION_INVALID'],
    ['unsafe endpoint', () => one({ x: Number.MAX_SAFE_INTEGER, width: 1 }), 'SPRITE_SHEET_REGION_INVALID'],
    ['unsafe bottom', () => one({ y: Number.MAX_SAFE_INTEGER, height: 1 }), 'SPRITE_SHEET_REGION_INVALID'],
    ['right beyond image', () => one({ x: 5, width: 2 }), 'SPRITE_SHEET_REGION_INVALID'],
    ['bottom beyond image', () => one({ y: 1, height: 2 }), 'SPRITE_SHEET_REGION_INVALID'],
  ];
  for (const [label, mutate, code] of cases) await t.test(label, async () => {
    const f = await scene();
    try {
      legalControl(f);
      const frames = mutate();
      refusal(() => egret.createSpriteSheet(f.lease, frames), code);
    }
    finally { await close(f); }
  });
});

test('SS05 caps charge frame occurrences and exact unique name code units independently', async t => {
  const cases = [
    ['frame count', () => Array.from({ length: 1024 }, (_, index) => ({ name: `f${index}`, ...RED })),
      frames => [...frames, { name: 'overflow', ...RED }]],
    ['per-name', () => [{ name: 'x'.repeat(128), ...RED }],
      frames => [{ ...frames[0], name: `${frames[0].name}x` }]],
    ['UTF-16 per-name', () => [{ name: '😀'.repeat(64), ...RED }],
      frames => [{ ...frames[0], name: `${frames[0].name}x` }]],
    ['aggregate', () => Array.from({ length: 256 }, (_, index) => ({ name: `N${String(index).padStart(3, '0')}${'x'.repeat(124)}`, ...RED })),
      frames => [...frames, { name: 'Z', ...RED }]],
  ];
  for (const [label, makeLegal, mutate] of cases) await t.test(label, async () => {
    const f = await scene();
    try {
      const frames = makeLegal();
      assert.equal(new Set(frames.map(frame => frame.name)).size, frames.length);
      if (label === 'aggregate') {
        assert.equal(frames.length, 256); assert.ok(frames.every(frame => frame.name.length === 128));
        assert.equal(frames.reduce((sum, frame) => sum + frame.name.length, 0), 32768);
      }
      legalControl(f, frames);
      const changed = mutate(frames);
      if (label === 'aggregate') {
        assert.equal(new Set(changed.map(frame => frame.name)).size, 257);
        assert.ok(changed.every(frame => frame.name.length <= 128));
        assert.equal(changed.reduce((sum, frame) => sum + frame.name.length, 0), 32769);
      }
      refusal(() => egret.createSpriteSheet(f.lease, changed), 'SPRITE_SHEET_LIMIT');
    } finally { await close(f); }
  });
});

test('SS05 edge equality, negative-zero origins and repeated crops retain distinct exact names', async () => {
  const f = await scene();
  try {
    const sheet = ownSheet(f, [
      { name: 'origin', x: -0, y: -0, width: 2, height: 2 },
      { name: 'edge', x: 5, y: 1, width: 1, height: 1 },
      { name: 'again', x: 0, y: 0, width: 2, height: 2 },
    ]);
    assert.deepEqual(sheet.names, ['origin', 'edge', 'again']);
    assert.deepEqual(sheet.getRegion('origin'), RED); assert.deepEqual(sheet.getRegion('again'), RED);
    assert.equal(Object.is(sheet.getRegion('origin').x, -0), false);
    assert.equal(Object.is(sheet.getRegion('origin').y, -0), false);
    assert.deepEqual(sheet.getRegion('edge'), { x: 5, y: 1, width: 1, height: 1 });
  } finally { await close(f); }
});

test('SS05 cropped and forged leases fail before reading any frame payload', async t => {
  for (const kind of ['cropped', 'lookalike', 'inherited', 'proxy', 'released']) await t.test(kind, async () => {
    const f = await scene();
    try {
      legalControl(f);
      let lease = f.lease, reads = 0;
      if (kind === 'cropped') lease = await f.acquire({ x: 0, y: 0, width: 3, height: 2 });
      else if (kind === 'lookalike') lease = { value: f.lease.value, release() {} };
      else if (kind === 'inherited') lease = Object.create(f.lease);
      else if (kind === 'proxy') lease = new Proxy(f.lease, {});
      else f.lease.release();
      const frames = new Proxy(input(), { get() { reads++; throw new Error('payload must stay unread'); } });
      const code = kind === 'cropped' ? 'SPRITE_SHEET_ATLAS_INVALID'
        : kind === 'released' ? 'ASSET_LEASE_RELEASED' : 'SPRITE_SHEET_LEASE_INVALID';
      refusal(() => egret.createSpriteSheet(lease, frames), code);
      assert.equal(reads, 0);
    } finally { await close(f); }
  });
});

test('SS05 genuine wrong-type and disposed Texture resources retain existing source errors', async t => {
  for (const kind of ['wrong-type', 'disposed-texture']) await t.test(kind, async () => {
    const f = await scene();
    let numberDisposals = 0;
    try {
      legalControl(f);
      let lease = f.lease, reads = 0;
      if (kind === 'wrong-type') {
        const type = egret.createAssetType('ss1-public-number', value => typeof value === 'number');
        f.engine.assets.register(type, { async load() { return 7; }, dispose(value) { assert.equal(value, 7); numberDisposals++; } });
        lease = f.resources.use(await f.engine.assets.acquire(egret.createAssetRef(type, 'ss1-public-number-value')));
      } else f.lease.value.dispose();
      const unread = new Proxy(input(), { get() { reads++; throw new Error('source authority first'); } });
      refusal(() => egret.createSpriteSheet(lease, unread), kind === 'wrong-type' ? 'BITMAP_TEXTURE_INVALID' : 'TEXTURE_DISPOSED');
      assert.equal(reads, 0);
    } finally {
      await close(f);
      if (kind === 'wrong-type') assert.equal(numberDisposals, 1);
    }
  });
});

test('SS07 creation validates exact names after a fresh successful genuine Bitmap control', async t => {
  const cases = [
    ['missing', 'missing', 'SPRITE_SHEET_FRAME_UNKNOWN'],
    ['empty', '', 'SPRITE_SHEET_NAME_INVALID'],
    ['overlength', 'x'.repeat(129), 'SPRITE_SHEET_LIMIT'],
    ['numeric', 7, 'SPRITE_SHEET_INPUT_INVALID'],
    ['dead-texture-before-name', '', 'TEXTURE_DISPOSED'],
  ];
  for (const [label, name, code] of cases) await t.test(label, async () => {
    const f = await scene();
    try {
      const sheet = ownSheet(f), red = f.scope.use(sheet.createBitmap('red'));
      assert.equal(red.textureLease, f.lease); assert.deepEqual(red.sourceRect, RED);
      if (label === 'dead-texture-before-name') f.lease.value.dispose();
      refusal(() => sheet.createBitmap(name), code);
      assert.equal(f.engine.stage.numChildren, 0);
      assert.equal(sheet.isDisposed, false); assert.deepEqual(sheet.getRegion('red'), RED);
    } finally { await close(f); }
  });
});

test('SS03 forged receivers never obtain metadata or cleanup authority', async () => {
  const f = await scene();
  try {
    const sheet = ownSheet(f), inherited = Object.create(sheet), proxy = new Proxy(sheet, {});
    for (const receiver of [null, {}, inherited, proxy]) {
      refusal(() => Reflect.apply(sheet.getRegion, receiver, ['red']), 'SPRITE_SHEET_INVALID');
      refusal(() => Reflect.apply(sheet.createBitmap, receiver, ['red']), 'SPRITE_SHEET_INVALID');
      refusal(() => Reflect.apply(sheet.dispose, receiver, []), 'SPRITE_SHEET_INVALID');
      for (const key of ['names', 'frameCount', 'atlasWidth', 'atlasHeight', 'isDisposed']) {
        refusal(() => Reflect.get(sheet, key, receiver), 'SPRITE_SHEET_INVALID');
      }
    }
    assert.equal(sheet.isDisposed, false); assert.deepEqual(sheet.getRegion('red'), RED);
    assert.deepEqual(f.counts(), { loads: 1, disposals: 0 });
  } finally { await close(f); }
});

test('SS04 successful own array slot revalidates before its indexed get', async () => {
  const f = await scene();
  try {
    const record = one()[0], target = [record];
    assert.equal(Array.isArray(target), true); assert.equal(target.length, 1);
    assert.equal(Object.hasOwn(target, '0'), true);
    let armed = false, ownHits = 0, getHits = 0;
    const table = new Proxy(target, {
      getOwnPropertyDescriptor(array, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(array, key);
        if (key === '0') {
          ownHits++; assert.equal(descriptor.value, record);
          if (armed) f.lease.release();
        }
        return descriptor;
      },
      get(array, key, receiver) {
        if (key === '0') getHits++;
        return Reflect.get(array, key, receiver);
      },
    });
    // The very same ordinary one-slot proxy first reaches a genuine legal sheet.
    const control = ownSheet(f, table);
    assert.deepEqual(control.getRegion('red'), RED);
    assert.equal(ownHits, 1); assert.equal(getHits, 1); control.dispose();
    ownHits = 0; getHits = 0; armed = true;
    refusal(() => egret.createSpriteSheet(f.lease, table), 'ASSET_LEASE_RELEASED');
    assert.equal(ownHits, 1); assert.equal(getHits, 0);
  } finally { await close(f); }
});

test('SS04 successful indexed get revalidates before qualifying its returned record', async () => {
  const f = await scene();
  try {
    const record = one()[0], target = [record];
    assert.equal(Array.isArray(target), true); assert.equal(target.length, 1);
    assert.equal(Object.hasOwn(target, '0'), true);
    const poisoned = Proxy.revocable(one()[0], {}); poisoned.revoke();
    let armed = false, getHits = 0;
    const table = new Proxy(target, {
      get(array, key, receiver) {
        const value = Reflect.get(array, key, receiver);
        if (key === '0') {
          getHits++;
          if (armed) { f.lease.release(); return poisoned.proxy; }
        }
        return value;
      },
    });
    const control = ownSheet(f, table);
    assert.deepEqual(control.getRegion('red'), RED);
    assert.equal(getHits, 1); control.dispose();
    getHits = 0; armed = true;
    // A premature Array.isArray/field read on the revoked record would be READ_FAILED.
    refusal(() => egret.createSpriteSheet(f.lease, table), 'ASSET_LEASE_RELEASED');
    assert.equal(getHits, 1);
  } finally { await close(f); }
});
