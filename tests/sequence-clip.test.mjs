// Independent literal expectations for the internal sequence clip contract.
// Binary64 extremes, read order, identity and immutable ownership are deliberate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSequenceClip, sampleSequenceClip } from '../packages/runtime/dist/sequenceClip.js';

// Inputs may be assembled by helpers. Expected samples below are authored literals:
// no expected-time arithmetic, modulo, accumulated ends, or oracle selection.
function baseInput() {
  return {
    atlasWidth: 8,
    atlasHeight: 4,
    frames: [
      { x: 0, y: 0, width: 2, height: 2, durationSeconds: 0.125 },
      { x: 2, y: 0, width: 2, height: 2, durationSeconds: 0.25 },
      { x: 4, y: 0, width: 2, height: 2, durationSeconds: 0.125 },
    ],
  };
}

function twoFrameInput(firstDuration, secondDuration) {
  return {
    atlasWidth: 4,
    atlasHeight: 2,
    frames: [
      { x: 0, y: 0, width: 2, height: 2, durationSeconds: firstDuration },
      { x: 2, y: 0, width: 2, height: 2, durationSeconds: secondDuration },
    ],
  };
}

function assertSample(actual, expected) {
  assert.deepEqual(actual, expected);
  if (Object.is(expected.positionSeconds, 0)) {
    assert.ok(Object.is(actual.positionSeconds, 0), 'position must be positive zero');
  }
}

// A caught flag also detects throw undefined. Never let a missing throw pass.
function captureError(operation, expectedCode) {
  let caught = false;
  let error;
  try {
    operation();
  } catch (value) {
    caught = true;
    error = value;
  }
  assert.ok(caught, `expected ${expectedCode}`);
  assert.ok(error !== null && typeof error === 'object', 'expected a coded error object');
  assert.equal(error.code, expectedCode);
  return error;
}

function assertReadFailure(operation, cause) {
  const error = captureError(operation, 'SEQ_READ_FAILED');
  assert.equal(error.cause, cause, 'must retain the exact originally thrown value');
  return error;
}

test('S01 once starts at frame zero and positive zero', () => {
  assertSample(sampleSequenceClip(createSequenceClip(baseInput()), 0, { mode: 'once' }), {
    frameIndex: 0, region: { x: 0, y: 0, width: 2, height: 2 },
    positionSeconds: 0, atEnd: false, stopped: false,
  });
});

test('S02 first half-open boundary selects frame one', () => {
  assertSample(sampleSequenceClip(createSequenceClip(baseInput()), 0.125, { mode: 'once' }), {
    frameIndex: 1, region: { x: 2, y: 0, width: 2, height: 2 },
    positionSeconds: 0.125, atEnd: false, stopped: false,
  });
});

test('S03 adjacent value below second boundary stays in frame one', () => {
  assertSample(sampleSequenceClip(createSequenceClip(baseInput()), 0.37499999999999994, { mode: 'once' }), {
    frameIndex: 1, region: { x: 2, y: 0, width: 2, height: 2 },
    positionSeconds: 0.37499999999999994, atEnd: false, stopped: false,
  });
});

test('S04 second half-open boundary selects frame two', () => {
  assertSample(sampleSequenceClip(createSequenceClip(baseInput()), 0.375, { mode: 'once' }), {
    frameIndex: 2, region: { x: 4, y: 0, width: 2, height: 2 },
    positionSeconds: 0.375, atEnd: false, stopped: false,
  });
});

test('S05 once at total retains the terminal frame and position', () => {
  assertSample(sampleSequenceClip(createSequenceClip(baseInput()), 0.5, { mode: 'once' }), {
    frameIndex: 2, region: { x: 4, y: 0, width: 2, height: 2 },
    positionSeconds: 0.5, atEnd: true, stopped: false,
  });
});

test('S06 once at a large finite time clamps to total', () => {
  assertSample(sampleSequenceClip(createSequenceClip(baseInput()), 1000000.1875, { mode: 'once' }), {
    frameIndex: 2, region: { x: 4, y: 0, width: 2, height: 2 },
    positionSeconds: 0.5, atEnd: true, stopped: false,
  });
});

test('S07 a complete loop returns frame zero with independent end flag', () => {
  assertSample(sampleSequenceClip(createSequenceClip(baseInput()), 0.5, { mode: 'loop' }), {
    frameIndex: 0, region: { x: 0, y: 0, width: 2, height: 2 },
    positionSeconds: 0, atEnd: false, stopped: false,
  });
});

test('S08 large loop time preserves the literal residual position', () => {
  assertSample(sampleSequenceClip(createSequenceClip(baseInput()), 1000000.1875, { mode: 'loop' }), {
    frameIndex: 1, region: { x: 2, y: 0, width: 2, height: 2 },
    positionSeconds: 0.1875, atEnd: false, stopped: false,
  });
});

test('S09 an explicit stop is stable across independently supplied elapsed values', () => {
  const clip = createSequenceClip(baseInput());
  for (const elapsed of [0, 1000, Number.MAX_VALUE]) {
    assertSample(sampleSequenceClip(clip, elapsed, { mode: 'loop', stopAtSeconds: 0.1875 }), {
      frameIndex: 1, region: { x: 2, y: 0, width: 2, height: 2 },
      positionSeconds: 0.1875, atEnd: false, stopped: true,
    });
  }
});

test('S10 an explicit terminal stop sets stopped and atEnd independently', () => {
  assertSample(sampleSequenceClip(createSequenceClip(baseInput()), 1000, { mode: 'once', stopAtSeconds: 0.5 }), {
    frameIndex: 2, region: { x: 4, y: 0, width: 2, height: 2 },
    positionSeconds: 0.5, atEnd: true, stopped: true,
  });
});

test('S11 an explicit stop cannot bypass invalid elapsed validation', () => {
  const clip = createSequenceClip(baseInput());
  for (const elapsed of [-0.125, NaN, Infinity]) {
    captureError(() => sampleSequenceClip(clip, elapsed, { mode: 'once', stopAtSeconds: 0 }), 'SEQ_TIME_INVALID');
  }
  let optionReads = 0;
  const unreadOptions = {
    get mode() { optionReads += 1; throw { marker: 'elapsed must fail first' }; },
  };
  captureError(() => sampleSequenceClip(clip, NaN, unreadOptions), 'SEQ_TIME_INVALID');
  assert.equal(optionReads, 0, 'elapsed validation must precede option capture');
});

test('S12 a single frame still reports the literal loop position', () => {
  const clip = createSequenceClip({
    atlasWidth: 1, atlasHeight: 1,
    frames: [{ x: 0, y: 0, width: 1, height: 1, durationSeconds: 0.25 }],
  });
  assertSample(sampleSequenceClip(clip, 0.875, { mode: 'loop' }), {
    frameIndex: 0, region: { x: 0, y: 0, width: 1, height: 1 },
    positionSeconds: 0.125, atEnd: false, stopped: false,
  });
});

test('S13 admit 1024 frames and reject 1025 before indexed payload reads', () => {
  const clip = createSequenceClip({
    atlasWidth: 1, atlasHeight: 1,
    frames: Array.from({ length: 1024 }, () => ({ x: 0, y: 0, width: 1, height: 1, durationSeconds: 1 })),
  });
  assert.equal(clip.frameCount, 1024);
  assert.equal(clip.durationSeconds, 1024);
  assertSample(sampleSequenceClip(clip, 1023.5, { mode: 'once' }), {
    frameIndex: 1023, region: { x: 0, y: 0, width: 1, height: 1 },
    positionSeconds: 1023.5, atEnd: false, stopped: false,
  });
  let indexedReads = 0;
  const sentinel = { marker: 'oversized payload must stay unread' };
  const frames = new Array(1025);
  Object.defineProperty(frames, '0', {
    get() { indexedReads += 1; throw sentinel; },
  });
  captureError(() => createSequenceClip({ atlasWidth: 1, atlasHeight: 1, frames }), 'SEQ_BUDGET');
  assert.equal(indexedReads, 0);
  // Length/budget validation also precedes dimension semantics.
  captureError(() => createSequenceClip({ atlasWidth: 0, atlasHeight: 1, frames }), 'SEQ_BUDGET');
  assert.equal(indexedReads, 0);
  const indexedTrap = new Proxy(frames, {
    get(target, key, receiver) {
      if (key === '0') { indexedReads += 1; throw sentinel; }
      return Reflect.get(target, key, receiver);
    },
    getOwnPropertyDescriptor(target, key) {
      if (key === '0') { indexedReads += 1; throw sentinel; }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  captureError(() => createSequenceClip({ atlasWidth: 1, atlasHeight: 1, frames: indexedTrap }), 'SEQ_BUDGET');
  assert.equal(indexedReads, 0, 'budget must precede indexed ownership-check traps too');
});

test('S14 invalid regions fail before duration semantics or later frame reads', () => {
  for (const patch of [{ x: 7, width: 2 }, { x: 0.5 }, { width: 0 }]) {
    const input = baseInput();
    Object.assign(input.frames[0], patch);
    captureError(() => createSequenceClip(input), 'SEQ_REGION_INVALID');
  }
  const input = baseInput();
  input.frames[0].x = 7;
  input.frames[0].durationSeconds = 0;
  let laterReads = 0;
  Object.defineProperty(input.frames, '1', {
    get() { laterReads += 1; throw { marker: 'later frame must stay unread' }; },
  });
  captureError(() => createSequenceClip(input), 'SEQ_REGION_INVALID');
  assert.equal(laterReads, 0);
});

test('S15 reject nonpositive or nonfinite durations, lost increments and overflow', () => {
  for (const duration of [0, -0.125, NaN, Infinity]) {
    const input = baseInput();
    input.frames[0].durationSeconds = duration;
    captureError(() => createSequenceClip(input), 'SEQ_TIME_INVALID');
  }
  captureError(() => createSequenceClip(twoFrameInput(0.5, Number.MIN_VALUE)), 'SEQ_TIME_INVALID');
  captureError(() => createSequenceClip(twoFrameInput(Number.MAX_VALUE, Number.MAX_VALUE)), 'SEQ_TIME_INVALID');
});

test('S16 capture fields once in order and own immutable snapshots independently of sources', () => {
  const source = baseInput();
  source.frames[0].x = -0;
  source.frames[0].y = -0;
  const events = [];
  const counts = Object.create(null);
  const backingFrames = source.frames;
  const trackedFrames = backingFrames.map((values, index) => {
    const frame = {};
    for (const field of ['x', 'y', 'width', 'height', 'durationSeconds']) {
      Object.defineProperty(frame, field, {
        get() {
          const label = `frame${index}.${field}`;
          events.push(label);
          counts[label] = (counts[label] ?? 0) + 1;
          return values[field];
        },
      });
    }
    Object.defineProperty(frame, 'ignored', { get() { throw { marker: 'unknown frame field' }; } });
    return frame;
  });
  const indexed = [];
  for (const [index, frame] of trackedFrames.entries()) {
    Object.defineProperty(indexed, String(index), {
      configurable: true,
      get() { events.push(`frames[${index}]`); return frame; },
    });
  }
  const input = {};
  const topValues = { atlasWidth: 8, atlasHeight: 4, frames: indexed };
  for (const field of ['atlasWidth', 'atlasHeight', 'frames']) {
    Object.defineProperty(input, field, {
      get() {
        events.push(field);
        counts[field] = (counts[field] ?? 0) + 1;
        return topValues[field];
      },
    });
  }
  Object.defineProperty(input, 'ignored', { get() { throw { marker: 'unknown top field' }; } });
  const clip = createSequenceClip(input);
  assert.deepEqual(events, [
    'atlasWidth', 'atlasHeight', 'frames',
    'frames[0]', 'frame0.x', 'frame0.y', 'frame0.width', 'frame0.height', 'frame0.durationSeconds',
    'frames[1]', 'frame1.x', 'frame1.y', 'frame1.width', 'frame1.height', 'frame1.durationSeconds',
    'frames[2]', 'frame2.x', 'frame2.y', 'frame2.width', 'frame2.height', 'frame2.durationSeconds',
  ]);
  for (const value of Object.values(counts)) assert.equal(value, 1);
  assert.equal(clip.atlasWidth, 8);
  assert.equal(clip.atlasHeight, 4);
  assert.equal(clip.frameCount, 3);
  assert.equal(clip.durationSeconds, 0.5);
  assert.ok(Object.isFrozen(clip));
  assert.equal(Object.isFrozen(input), false, 'caller object must remain unfrozen');
  assert.equal(Object.isFrozen(indexed), false, 'caller array must remain unfrozen');
  for (const frame of trackedFrames) assert.equal(Object.isFrozen(frame), false);

  for (const values of backingFrames) {
    Object.assign(values, { x: 99, y: 99, width: 99, height: 99, durationSeconds: 99 });
  }
  Object.defineProperty(indexed, '0', {
    configurable: true, writable: true,
    value: { x: 0, y: 0, width: 1, height: 1, durationSeconds: 1 },
  });
  indexed.length = 0;
  topValues.atlasWidth = 1;
  topValues.atlasHeight = 1;
  topValues.frames = [];
  events.length = 0;
  const first = sampleSequenceClip(clip, 0.125, { mode: 'once' });
  const second = sampleSequenceClip(clip, 0.125, { mode: 'once' });
  assertSample(first, {
    frameIndex: 1, region: { x: 2, y: 0, width: 2, height: 2 },
    positionSeconds: 0.125, atEnd: false, stopped: false,
  });
  assertSample(second, {
    frameIndex: 1, region: { x: 2, y: 0, width: 2, height: 2 },
    positionSeconds: 0.125, atEnd: false, stopped: false,
  });
  assert.equal(clip.frameCount, 3);
  assert.equal(clip.durationSeconds, 0.5);
  assert.notEqual(first, second, 'each sample needs a fresh wrapper');
  assert.equal(first.region, second.region, 'reuse the owned immutable region');
  assert.notEqual(first.region, trackedFrames[1], 'do not return caller frame objects');
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(second));
  assert.ok(Object.isFrozen(first.region));
  assert.throws(() => { first.region.x = 7; }, TypeError);
  assert.throws(() => { first.frameIndex = 7; }, TypeError);
  assert.throws(() => { clip.durationSeconds = 7; }, TypeError);
  const zero = sampleSequenceClip(clip, -0, { mode: 'loop' });
  assertSample(zero, {
    frameIndex: 0, region: { x: 0, y: 0, width: 2, height: 2 },
    positionSeconds: 0, atEnd: false, stopped: false,
  });
  assert.ok(Object.is(zero.region.x, 0));
  assert.ok(Object.is(zero.region.y, 0));
  assert.deepEqual(events, [], 'sampling must not revisit caller fields or arrays');
  for (const value of Object.values(counts)) assert.equal(value, 1);
});

test('S17 authenticate only genuine clips before foreign fields or elapsed/options', () => {
  const genuine = createSequenceClip(baseInput());
  let foreignReads = 0;
  const forbidden = () => { foreignReads += 1; throw { marker: 'foreign property read' }; };
  const countedProxy = new Proxy(genuine, {
    get: forbidden, getOwnPropertyDescriptor: forbidden, has: forbidden, ownKeys: forbidden,
  });
  const throwingProxy = new Proxy({}, {
    get: forbidden, getOwnPropertyDescriptor: forbidden, has: forbidden, ownKeys: forbidden,
  });
  for (const foreign of [
    { atlasWidth: 8, atlasHeight: 4, frameCount: 3, durationSeconds: 0.5 },
    { ...genuine },
    countedProxy,
    throwingProxy,
  ]) {
    captureError(() => sampleSequenceClip(foreign, 0, { mode: 'once' }), 'SEQ_CLIP_INVALID');
  }
  const unreadOptions = { get mode() { throw { marker: 'foreign identity must fail first' }; } };
  captureError(() => sampleSequenceClip(throwingProxy, NaN, unreadOptions), 'SEQ_CLIP_INVALID');
  assert.equal(foreignReads, 0);
  // Sampling a genuine identity still works after attempts to spoof it.
  assertSample(sampleSequenceClip(genuine, 0, { mode: 'once' }), {
    frameIndex: 0, region: { x: 0, y: 0, width: 2, height: 2 },
    positionSeconds: 0, atEnd: false, stopped: false,
  });
});

test('S18 missing own fields and holes reject without inherited getter reads', () => {
  captureError(() => createSequenceClip({ atlasWidth: 8, atlasHeight: 4, frames: [] }), 'SEQ_INPUT_INVALID');
  captureError(() => createSequenceClip({ atlasWidth: 8, atlasHeight: 4, frames: new Array(1) }), 'SEQ_INPUT_INVALID');
  captureError(() => createSequenceClip({ atlasWidth: 8, atlasHeight: 4, frames: {} }), 'SEQ_INPUT_INVALID');
  for (const frame of [null, [], 0, function rejectedFrame() {}]) {
    captureError(() => createSequenceClip({ atlasWidth: 8, atlasHeight: 4, frames: [frame] }), 'SEQ_INPUT_INVALID');
  }
  let inheritedReads = 0;
  const inherited = {
    get x() { inheritedReads += 1; throw { marker: 'inherited x must stay unread' }; },
  };
  const frame = Object.assign(Object.create(inherited), { y: 0, width: 2, height: 2, durationSeconds: 0.125 });
  captureError(() => createSequenceClip({ atlasWidth: 8, atlasHeight: 4, frames: [frame] }), 'SEQ_INPUT_INVALID');
  assert.equal(inheritedReads, 0);

  // Even a missing x is reported after the remaining own fields are captured.
  const sentinel = { marker: 'capture remaining fields before missing-field semantics' };
  const captureOrder = [];
  const missingX = {
    get y() { captureOrder.push('y'); return 0; },
    get width() { captureOrder.push('width'); return 2; },
    get height() { captureOrder.push('height'); return 2; },
    get durationSeconds() { captureOrder.push('durationSeconds'); throw sentinel; },
  };
  assertReadFailure(() => createSequenceClip({ atlasWidth: 8, atlasHeight: 4, frames: [missingX] }), sentinel);
  assert.deepEqual(captureOrder, ['y', 'width', 'height', 'durationSeconds']);
  const missingAtlasWidth = {
    atlasHeight: 4,
    get frames() { throw sentinel; },
  };
  assertReadFailure(() => createSequenceClip(missingAtlasWidth), sentinel);

  const prototypeArray = [];
  Object.defineProperty(prototypeArray, '0', { get() { inheritedReads += 1; throw sentinel; } });
  const inheritedIndex = new Array(1);
  Object.setPrototypeOf(inheritedIndex, prototypeArray);
  captureError(() => createSequenceClip({ atlasWidth: 8, atlasHeight: 4, frames: inheritedIndex }), 'SEQ_INPUT_INVALID');
  assert.equal(inheritedReads, 0);
});

test('S19 wrap source faults with exact undefined, object and error-shaped causes', () => {
  const top = { atlasWidth: 8, atlasHeight: 4, get frames() { throw undefined; } };
  assertReadFailure(() => createSequenceClip(top), undefined);
  const objectSentinel = { marker: 'frame width sentinel' };
  const input = baseInput();
  Object.defineProperty(input.frames[0], 'width', { get() { throw objectSentinel; } });
  assertReadFailure(() => createSequenceClip(input), objectSentinel);
  const shapedSentinel = { name: 'SequenceClipError', code: 'SEQ_INPUT_INVALID', cause: { marker: 'caller shape' } };
  const clip = createSequenceClip(baseInput());
  const wrapper = assertReadFailure(() => sampleSequenceClip(clip, 0, {
    mode: 'once', get stopAtSeconds() { throw shapedSentinel; },
  }), shapedSentinel);
  assert.notEqual(wrapper, shapedSentinel, 'caller error shape must not acquire error authority');

  // Capture top fields before invalid dimension semantics.
  const topOrder = [];
  const captureSentinel = { marker: 'top capture before validation' };
  assertReadFailure(() => createSequenceClip({
    get atlasWidth() { topOrder.push('atlasWidth'); return 0; },
    get atlasHeight() { topOrder.push('atlasHeight'); return 4; },
    get frames() { topOrder.push('frames'); throw captureSentinel; },
  }), captureSentinel);
  assert.deepEqual(topOrder, ['atlasWidth', 'atlasHeight', 'frames']);

  // Capture all five frame fields before rejecting an invalid captured region.
  const frameOrder = [];
  const badFrame = {
    get x() { frameOrder.push('x'); return 7; },
    get y() { frameOrder.push('y'); return 0; },
    get width() { frameOrder.push('width'); return 2; },
    get height() { frameOrder.push('height'); return 2; },
    get durationSeconds() { frameOrder.push('durationSeconds'); throw captureSentinel; },
  };
  assertReadFailure(() => createSequenceClip({ atlasWidth: 8, atlasHeight: 4, frames: [badFrame] }), captureSentinel);
  assert.deepEqual(frameOrder, ['x', 'y', 'width', 'height', 'durationSeconds']);
});

test('S20 capture mode then own stop before semantics; absent or undefined stop is not stopped', () => {
  const clip = createSequenceClip(baseInput());
  captureError(() => sampleSequenceClip(clip, 0, { mode: 'unknown' }), 'SEQ_INPUT_INVALID');
  captureError(() => sampleSequenceClip(clip, 0, { mode: 'once', stopAtSeconds: -1 }), 'SEQ_TIME_INVALID');
  const sentinel = { marker: 'option capture precedence' };
  const optionOrder = [];
  assertReadFailure(() => sampleSequenceClip(clip, 0, {
    get mode() { optionOrder.push('mode'); return 'unknown'; },
    get stopAtSeconds() { optionOrder.push('stopAtSeconds'); throw sentinel; },
  }), sentinel);
  assert.deepEqual(optionOrder, ['mode', 'stopAtSeconds']);
  const validOptionOrder = [];
  assertSample(sampleSequenceClip(clip, 1000, {
    get mode() { validOptionOrder.push('mode'); return 'loop'; },
    get stopAtSeconds() { validOptionOrder.push('stopAtSeconds'); return 0.1875; },
    get ignored() { throw sentinel; },
  }), {
    frameIndex: 1, region: { x: 2, y: 0, width: 2, height: 2 },
    positionSeconds: 0.1875, atEnd: false, stopped: true,
  });
  assert.deepEqual(validOptionOrder, ['mode', 'stopAtSeconds']);

  let inheritedReads = 0;
  const inheritedStop = Object.create({
    get stopAtSeconds() { inheritedReads += 1; throw sentinel; },
  });
  inheritedStop.mode = 'loop';
  for (const options of [{ mode: 'loop' }, { mode: 'loop', stopAtSeconds: undefined }, inheritedStop]) {
    assertSample(sampleSequenceClip(clip, 0.125, options), {
      frameIndex: 1, region: { x: 2, y: 0, width: 2, height: 2 },
      positionSeconds: 0.125, atEnd: false, stopped: false,
    });
  }
  assert.equal(inheritedReads, 0);
  captureError(() => sampleSequenceClip(clip, 0, {}), 'SEQ_INPUT_INVALID');
  captureError(() => sampleSequenceClip(clip, 0, Object.create({ mode: 'once' })), 'SEQ_INPUT_INVALID');
  captureError(() => sampleSequenceClip(clip, 0, []), 'SEQ_INPUT_INVALID');
  captureError(() => sampleSequenceClip(clip, 0, null), 'SEQ_INPUT_INVALID');
  for (const stopAtSeconds of [NaN, Infinity]) {
    captureError(() => sampleSequenceClip(clip, 0, { mode: 'loop', stopAtSeconds }), 'SEQ_TIME_INVALID');
  }
  assertSample(sampleSequenceClip(clip, 1000, { mode: 'once', stopAtSeconds: 0 }), {
    frameIndex: 0, region: { x: 0, y: 0, width: 2, height: 2 },
    positionSeconds: 0, atEnd: false, stopped: true,
  });
  // Calls are explicit seeks; an earlier terminal/stop call cannot hold hidden state.
  sampleSequenceClip(clip, 0.5, { mode: 'once' });
  assertSample(sampleSequenceClip(clip, 0.125, { mode: 'once' }), {
    frameIndex: 1, region: { x: 2, y: 0, width: 2, height: 2 },
    positionSeconds: 0.125, atEnd: false, stopped: false,
  });
});

test('S21 reject top-level kinds before fields and admit own-field objects with exact fault wrapping', () => {
  // Isolate atlas dimensions from frame-budget and read-fault error precedence.
  for (const dimension of ['atlasWidth', 'atlasHeight']) {
    for (const value of [0, -1, 0.5, NaN, Infinity, 9007199254740992, '8']) {
      const input = baseInput(); input[dimension] = value;
      captureError(() => createSequenceClip(input), 'SEQ_INPUT_INVALID');
    }
    const input = baseInput(); input[dimension] = Number.MAX_SAFE_INTEGER;
    assert.equal(createSequenceClip(input).frameCount, 3);
  }

  let rejectedFieldReads = 0;
  const rejectedArray = [];
  const rejectedFunction = function rejectedCallable() {};
  for (const rejected of [rejectedArray, rejectedFunction]) {
    for (const [field, value] of Object.entries(baseInput())) {
      Object.defineProperty(rejected, field, {
        get() { rejectedFieldReads += 1; return value; },
      });
    }
  }
  for (const rejected of [null, undefined, false, true, 0, NaN, '', 0n, Symbol('top kind'), rejectedArray, rejectedFunction]) {
    captureError(() => createSequenceClip(rejected), 'SEQ_INPUT_INVALID');
  }
  const callable = Proxy.revocable(function revokedCallable() {}, {});
  callable.revoke();
  captureError(() => createSequenceClip(callable.proxy), 'SEQ_INPUT_INVALID');
  assert.equal(rejectedFieldReads, 0);

  for (const kind of ['ordinary', 'null-prototype', 'live-proxy']) {
    const topReads = { atlasWidth: 0, atlasHeight: 0, frames: 0 };
    const values = baseInput();
    const target = kind === 'null-prototype' ? Object.create(null) : {};
    for (const field of ['atlasWidth', 'atlasHeight', 'frames']) {
      Object.defineProperty(target, field, {
        get() { topReads[field] += 1; return values[field]; },
      });
    }
    const admitted = kind === 'live-proxy' ? new Proxy(target, {}) : target;
    const clip = createSequenceClip(admitted);
    assert.equal(clip.frameCount, 3, kind);
    assert.equal(clip.durationSeconds, 0.5, kind);
    assert.deepEqual(topReads, { atlasWidth: 1, atlasHeight: 1, frames: 1 }, kind);
  }
  const ownCheckSentinel = { marker: 'own-check trap' };
  let ownCheckCalls = 0;
  let propertyReads = 0;
  const ownCheckProxy = new Proxy(baseInput(), {
    getOwnPropertyDescriptor() { ownCheckCalls += 1; throw ownCheckSentinel; },
    get() { propertyReads += 1; throw { marker: 'own check must precede get' }; },
  });
  assertReadFailure(() => createSequenceClip(ownCheckProxy), ownCheckSentinel);
  assert.equal(ownCheckCalls, 1);
  assert.equal(propertyReads, 0);
  assertReadFailure(() => createSequenceClip({
    get atlasWidth() { throw undefined; }, atlasHeight: 4, frames: baseInput().frames,
  }), undefined);

  let revokedTopReads = 0;
  const revokedTarget = {};
  for (const [field, value] of Object.entries(baseInput())) {
    Object.defineProperty(revokedTarget, field, { get() { revokedTopReads += 1; return value; } });
  }
  const revoked = Proxy.revocable(revokedTarget, {});
  revoked.revoke();
  const error = captureError(() => createSequenceClip(revoked.proxy), 'SEQ_READ_FAILED');
  const actualNativeCause = error.cause;
  assert.ok(actualNativeCause instanceof TypeError, 'inspect the retained native admission cause');
  assert.notEqual(error, actualNativeCause, 'native fault must be wrapped');
  assert.equal(revokedTopReads, 0);
  // Never call Array.isArray again to generate a supposed native identity oracle.
  // Exact native-cause retention additionally requires later wrapping-control-flow
  // review. Controlled traps above supply genuine independent identity assertions.
});

test('S22 unstopped MAX on the original total selects terminal or positive-zero loop', () => {
  const clip = createSequenceClip(baseInput());
  assertSample(sampleSequenceClip(clip, Number.MAX_VALUE, { mode: 'once' }), {
    frameIndex: 2, region: { x: 4, y: 0, width: 2, height: 2 },
    positionSeconds: 0.5, atEnd: true, stopped: false,
  });
  assertSample(sampleSequenceClip(clip, Number.MAX_VALUE, { mode: 'loop' }), {
    frameIndex: 0, region: { x: 0, y: 0, width: 2, height: 2 },
    positionSeconds: 0, atEnd: false, stopped: false,
  });
});

test('S23 admit two MIN durations and preserve subnormal boundaries and MAX loops', () => {
  const clip = createSequenceClip(twoFrameInput(Number.MIN_VALUE, Number.MIN_VALUE));
  assert.equal(clip.durationSeconds, 1e-323);
  assert.equal(clip.frameCount, 2);
  for (const mode of ['once', 'loop']) {
    assertSample(sampleSequenceClip(clip, Number.MIN_VALUE, { mode }), {
      frameIndex: 1, region: { x: 2, y: 0, width: 2, height: 2 },
      positionSeconds: 5e-324, atEnd: false, stopped: false,
    });
  }
  for (const elapsed of [1e-323, Number.MAX_VALUE]) {
    assertSample(sampleSequenceClip(clip, elapsed, { mode: 'loop' }), {
      frameIndex: 0, region: { x: 0, y: 0, width: 2, height: 2 },
      positionSeconds: 0, atEnd: false, stopped: false,
    });
  }
  assertSample(sampleSequenceClip(clip, Number.MAX_VALUE, { mode: 'once' }), {
    frameIndex: 1, region: { x: 2, y: 0, width: 2, height: 2 },
    positionSeconds: 1e-323, atEnd: true, stopped: false,
  });
});

test('S24 admit a large finite total and use literal first-end and MAX expectations', () => {
  const clip = createSequenceClip(twoFrameInput(4.4942328371557893e307, 4.4942328371557893e307));
  assert.equal(clip.durationSeconds, 8.988465674311579e307);
  assert.equal(clip.frameCount, 2);
  for (const mode of ['once', 'loop']) {
    assertSample(sampleSequenceClip(clip, 4.4942328371557893e307, { mode }), {
      frameIndex: 1, region: { x: 2, y: 0, width: 2, height: 2 },
      positionSeconds: 4.4942328371557893e307, atEnd: false, stopped: false,
    });
  }
  assertSample(sampleSequenceClip(clip, Number.MAX_VALUE, { mode: 'once' }), {
    frameIndex: 1, region: { x: 2, y: 0, width: 2, height: 2 },
    positionSeconds: 8.988465674311579e307, atEnd: true, stopped: false,
  });
  assertSample(sampleSequenceClip(clip, Number.MAX_VALUE, { mode: 'loop' }), {
    frameIndex: 0, region: { x: 0, y: 0, width: 2, height: 2 },
    positionSeconds: 0, atEnd: false, stopped: false,
  });
});

test('S25 rounded decimal total and adjacent loop times retain authored binary64 literals', () => {
  const clip = createSequenceClip(twoFrameInput(0.1, 0.2));
  assert.equal(clip.durationSeconds, 0.30000000000000004);
  assertSample(sampleSequenceClip(clip, 0.3, { mode: 'loop' }), {
    frameIndex: 1, region: { x: 2, y: 0, width: 2, height: 2 },
    positionSeconds: 0.3, atEnd: false, stopped: false,
  });
  assertSample(sampleSequenceClip(clip, 0.30000000000000004, { mode: 'loop' }), {
    frameIndex: 0, region: { x: 0, y: 0, width: 2, height: 2 },
    positionSeconds: 0, atEnd: false, stopped: false,
  });
  assertSample(sampleSequenceClip(clip, 0.3000000000000001, { mode: 'loop' }), {
    frameIndex: 0, region: { x: 0, y: 0, width: 2, height: 2 },
    positionSeconds: 5.551115123125783e-17, atEnd: false, stopped: false,
  });
});
