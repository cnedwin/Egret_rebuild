// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { createAssetRef, createAssetType, CancellationController, isTexture } from '@egret/engine';

// These original bytes exercise structural admission with supplied test ports.
// CRC fields are stored but not calculated; IDAT is not a native codec fixture.
export const STRUCTURAL_RGBA = Object.freeze([
  137,80,78,71,13,10,26,10,
  0,0,0,13,73,72,68,82,0,0,0,2,0,0,0,1,8,6,0,0,0,0,0,0,0,
  0,0,0,1,73,68,65,84,0,0,0,0,0,
  0,0,0,0,73,69,78,68,0,0,0,0,
]);
export const RGBA_PIXELS = Object.freeze([255,0,0,255,0,0,0,0]);
export const RGB_PIXELS = Object.freeze([255,0,0,255,0,255,0,255]);
export const SIGNATURE = Object.freeze([137,80,78,71,13,10,26,10]);
export const word = value => new Uint8Array([
  (value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255,
]);
export function concat(parts) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
/** Test framing only: no CRC, inflate, filtering, parser or product algorithm. */
export function chunk(type, data = []) {
  return concat([word(data.length), new Uint8Array([...type].map(char => char.charCodeAt(0))), new Uint8Array(data), new Uint8Array(4)]);
}
export function header({ width = 2, height = 1, depth = 8, color = 6, compression = 0, filter = 0, interlace = 0 } = {}) {
  return chunk('IHDR', concat([word(width), word(height), new Uint8Array([depth,color,compression,filter,interlace])]));
}
export function structuralPng(options = {}) {
  return concat([new Uint8Array(SIGNATURE), header(options),
    ...(options.before ?? []), ...(options.idats ?? [chunk('IDAT', [0])]),
    ...(options.after ?? []), chunk('IEND'), ...(options.trailing ?? [])]);
}
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
/** Observe immediately, including a rejected value that is itself undefined. */
export function observe(promise) {
  return Promise.resolve(promise).then(value => ({ fulfilled: true, value }), cause => ({ fulfilled: false, cause }));
}
export function errorIs(code, expected = {}) {
  return error => {
    assert.equal(error.code, code);
    if (Object.hasOwn(expected, 'cause')) assert.equal(error.cause, expected.cause);
    if (Object.hasOwn(expected, 'cleanupErrors')) assert.deepEqual(error.cleanupErrors, expected.cleanupErrors);
    assert.ok(Object.isFrozen(error.cleanupErrors));
    return true;
  };
}
export async function rejection(promise, code, expected = {}) {
  return assert.rejects(promise, errorIs(code, expected));
}
/** Only these supplied operations are simulated; SDK resources stay genuine. */
export function controlledFixture(overrides = {}) {
  const fixture = {
    events: [], readerCalls: [], decodeCalls: [], bitmaps: [], canvases: [], issued: [], controls: overrides,
    bytes: overrides.bytes ?? new Uint8Array(STRUCTURAL_RGBA),
    pixels: overrides.pixels ?? new Uint8ClampedArray(RGBA_PIXELS),
    width: overrides.width ?? 2, height: overrides.height ?? 1,
  };
  fixture.controller = new CancellationController();
  fixture.type = createAssetType('bip1-controlled-texture', isTexture);
  fixture.ref = createAssetRef(fixture.type, 'bip1/original.png');
  // A direct invocation needs a structurally legal context; it is not a forged
  // manager-issued authority. Integration tests use the manager's actual object.
  fixture.context = Object.freeze({ signal: fixture.controller.signal, resourceGeneration: 1, taskId: 1 });
  fixture.makeBitmap = () => {
    const bitmap = { closed: 0 };
    const close = function () {
      assert.equal(this, bitmap);
      fixture.events.push('bitmap.close');
      bitmap.closed++;
    };
    Object.defineProperties(bitmap, {
      width: { configurable: true, get() { fixture.events.push('bitmap.width'); return fixture.width; } },
      height: { configurable: true, get() { fixture.events.push('bitmap.height'); return fixture.height; } },
      close: { configurable: true, get() { fixture.events.push('bitmap.close.read'); return close; } },
    });
    fixture.bitmaps.push(bitmap);
    return bitmap;
  };
  fixture.makeCanvas = () => {
    let width = 300, height = 150;
    const canvas = { resets: [] };
    const context = {
      globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: true,
      filter: 'none', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
      shadowColor: 'rgba(0, 0, 0, 0)',
      getContextAttributes() { assert.equal(this, context); fixture.events.push('context.attributes'); return { alpha: true, colorSpace: 'srgb' }; },
      setTransform(...args) { assert.equal(this, context); assert.deepEqual(args, [1,0,0,1,0,0]); fixture.events.push('context.transform'); },
      drawImage(bitmap, x, y) { assert.equal(this, context); assert.ok(fixture.bitmaps.includes(bitmap)); assert.deepEqual([x,y], [0,0]); fixture.events.push('context.draw'); },
      getImageData(...args) {
        assert.equal(this, context); assert.deepEqual(args, [0,0,fixture.width,fixture.height]);
        fixture.events.push('context.readback');
        return { width: fixture.width, height: fixture.height, data: fixture.pixels, colorSpace: 'srgb' };
      },
    };
    Object.defineProperties(canvas, {
      isConnected: { configurable: true, get() { fixture.events.push('canvas.connected'); return false; } },
      width: { configurable: true, get() { fixture.events.push('canvas.width.read'); return width; },
        set(value) { fixture.events.push('canvas.width=' + value); width = value; if (value === 0) canvas.resets.push('width'); } },
      height: { configurable: true, get() { fixture.events.push('canvas.height.read'); return height; },
        set(value) { fixture.events.push('canvas.height=' + value); height = value; if (value === 0) canvas.resets.push('height'); } },
      getContext: { configurable: true, writable: true, value: function (kind, options) {
        assert.equal(this, canvas); assert.equal(kind, '2d');
        assert.deepEqual(options, { alpha: true, colorSpace: 'srgb', willReadFrequently: true });
        fixture.events.push('canvas.context'); return context;
      } },
    });
    canvas.context = context;
    fixture.canvases.push(canvas);
    return canvas;
  };
  fixture.ports = {
    decode(blob, options) {
      assert.equal(this, fixture.ports);
      fixture.events.push('decode');
      fixture.decodeCalls.push({ blob, options, receiver: this });
      return overrides.decode === undefined ? Promise.resolve(fixture.makeBitmap()) : Reflect.apply(overrides.decode, this, [blob, options, fixture]);
    },
    createCanvas() {
      assert.equal(this, fixture.ports); fixture.events.push('canvas.create');
      return overrides.createCanvas === undefined ? fixture.makeCanvas() : Reflect.apply(overrides.createCanvas, this, [fixture]);
    },
  };
  fixture.options = {
    readBytes(ref, context) {
      assert.equal(this, fixture.options); fixture.events.push('readBytes');
      fixture.readerCalls.push({ ref, context, receiver: this });
      return overrides.readBytes === undefined ? Promise.resolve(fixture.bytes) : Reflect.apply(overrides.readBytes, this, [ref, context, fixture]);
    },
    ports: fixture.ports,
  };
  return fixture;
}
/** Preserve primary and cleanup occurrences; unexpected close failure is fatal. */
export async function runProvider(createProvider, body, { fixture: overrides = {}, closeCode } = {}) {
  const fixture = controlledFixture(overrides), provider = createProvider(fixture.options);
  fixture.load = async (ref = fixture.ref, context = fixture.context) => {
    const value = await provider.load(ref, context); fixture.issued.push(value); return value;
  };
  let primary, cleanup;
  try { await body(provider, fixture); }
  catch (cause) { primary = { cause }; }
  try {
    for (const value of fixture.issued) provider.dispose(value);
    if (closeCode === undefined) await provider.close();
    else await rejection(provider.close(), closeCode);
  } catch (cause) { cleanup = { cause }; }
  if (primary && cleanup) throw new AggregateError([primary.cause, cleanup.cause], 'BIP1_PRIMARY_AND_TEST_CLEANUP_FAILED');
  if (cleanup) throw cleanup.cause;
  if (primary) throw primary.cause;
}
