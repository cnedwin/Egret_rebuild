import test from 'node:test';
import assert from 'node:assert/strict';
import { planLegacyMovieClipConversion as plan } from '../packages/project/dist/legacy-movieclip-plan.js';
import { createSequenceClip, sampleSequenceClip } from '../packages/runtime/dist/sequenceClip.js';

// Expected output and timing boundaries are literal, independently hand-derived.
const BASE = '{"mc":{"walk":{"frameRate":4,"frames":[{"res":"A","x":-2,"y":3,"duration":3},{"res":"B"},{"res":"A","duration":2}],"labels":[],"events":[]}},"res":{"A":{"x":0,"y":0,"w":2,"h":2},"B":{"x":2,"y":0,"w":2,"h":2}}}';
const EXPECTED = {
  clipName: 'walk', atlasPath: 'assets/walk.png', totalLegacyFrames: 6,
  sequenceInput: { atlasWidth: 4, atlasHeight: 2, frames: [
    { x: 0, y: 0, width: 2, height: 2, durationSeconds: 0.75 },
    { x: 2, y: 0, width: 2, height: 2, durationSeconds: 0.25 },
    { x: 0, y: 0, width: 2, height: 2, durationSeconds: 0.5 },
  ] },
  holds: [
    { resourceName: 'A', offsetX: -2, offsetY: 3, firstLegacyFrame: 1, durationFrames: 3 },
    { resourceName: 'B', offsetX: 0, offsetY: 0, firstLegacyFrame: 4, durationFrames: 1 },
    { resourceName: 'A', offsetX: 0, offsetY: 0, firstLegacyFrame: 5, durationFrames: 2 },
  ],
};
const ACCEPTANCE = { fileExistence: 'unverified', decoding: 'unverified', execution: 'unverified', migration: 'unverified' };
const CODE = name => `LEGACY_MOVIECLIP_${name}`;
const at = (name, pointer, source = 'text') => ({ code: CODE(name), jsonPointer: pointer, source });
const call = (text = BASE, name = 'walk', atlas = 'assets/walk.png', width = 4, height = 2) => plan(text, name, atlas, width, height);
// These helpers construct inputs only; they never derive planner expectations.
const fixture = (frames = [{ res: 'A' }], extras = {}, regions = { A: { x: 0, y: 0, w: 2, h: 2 } }) =>
  JSON.stringify({ mc: { walk: { frames, ...extras } }, res: regions });
function frozenTree(value) {
  if (value === null || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) frozenTree(child);
}
function envelope(result) {
  assert.deepEqual(Object.keys(result).sort(), ['acceptance', 'diagnostics', 'plan', 'planVersion', 'profile', 'status']);
  assert.equal(result.planVersion, '0.1');
  assert.equal(result.profile, 'legacy-movieclip-single-atlas-0.1');
  assert.deepEqual(result.acceptance, ACCEPTANCE);
  frozenTree(result);
}
function planned(result) {
  envelope(result);
  assert.equal(result.status, 'planned');
  assert.deepEqual(result.diagnostics, []);
  assert.notEqual(result.plan, null);
  assert.deepEqual(Object.keys(result.plan).sort(), ['atlasPath', 'clipName', 'holds', 'sequenceInput', 'totalLegacyFrames']);
  return result.plan;
}
function refused(result, status, expected) {
  envelope(result);
  assert.equal(result.status, status);
  assert.equal(result.plan, null);
  assert.equal(result.diagnostics.length, 1);
  const diagnostic = result.diagnostics[0];
  assert.deepEqual(Object.keys(diagnostic).sort(), ['code', 'jsonPointer', 'message', 'severity', 'source']);
  assert.deepEqual({ code: diagnostic.code, jsonPointer: diagnostic.jsonPointer, source: diagnostic.source }, expected);
  assert.equal(diagnostic.severity, status === 'unsupported' ? 'warning' : 'error');
  assert.equal(typeof diagnostic.message, 'string');
  assert.ok(diagnostic.message.length > 0 && diagnostic.message.length <= 160);
}

test('M01: authored holds preserve literal crop, offset and one-based logical spans without expansion', () => {
  assert.deepEqual(planned(call()), EXPECTED);
});

test('M02: the real sequence factory admits the owned plan and literal boundaries, without planner identity authority', () => {
  const input = planned(call()).sequenceInput;
  const clip = createSequenceClip(input);
  assert.deepEqual(clip, { atlasWidth: 4, atlasHeight: 2, frameCount: 3, durationSeconds: 1.5 });
  const boundaries = [[0, 0, false], [0.5, 0, false], [0.75, 1, false], [1, 2, false], [1.5, 2, true]];
  for (const [time, index, end] of boundaries) {
    const sample = sampleSequenceClip(clip, time, { mode: 'once' });
    assert.equal(sample.frameIndex, index); assert.equal(sample.atEnd, end);
  }
  assert.equal(sampleSequenceClip(clip, 1.5, { mode: 'loop' }).frameIndex, 0);
  const stopped = sampleSequenceClip(clip, 999, { mode: 'once', stopAtSeconds: 0.75 });
  assert.equal(stopped.frameIndex, 1); assert.equal(stopped.stopped, true);
  for (const counterfeit of [input, { ...clip }, new Proxy(clip, {})]) {
    assert.throws(() => sampleSequenceClip(counterfeit, 0, { mode: 'once' }), error => error.code === 'SEQ_CLIP_INVALID');
  }
});

test('M03: omitted values default, fractional rates survive, and adjacent equal records do not merge', () => {
  const defaults = planned(call(fixture([{ res: 'A', duration: 24 }])));
  assert.deepEqual(defaults.sequenceInput.frames, [{ x: 0, y: 0, width: 2, height: 2, durationSeconds: 1 }]);
  assert.deepEqual(defaults.holds, [{ resourceName: 'A', offsetX: 0, offsetY: 0, firstLegacyFrame: 1, durationFrames: 24 }]);
  const fractional = planned(call(fixture([{ res: 'A', duration: 5 }], { frameRate: 2.5 })));
  assert.equal(fractional.sequenceInput.frames[0].durationSeconds, 2);
  const adjacent = planned(call(fixture([{ res: 'A' }, { res: 'A' }], { frameRate: 4 })));
  assert.deepEqual(adjacent.sequenceInput.frames, [
    { x: 0, y: 0, width: 2, height: 2, durationSeconds: 0.25 },
    { x: 0, y: 0, width: 2, height: 2, durationSeconds: 0.25 },
  ]);
  assert.equal(adjacent.holds[1].firstLegacyFrame, 2);
});

test('M04: binary64 hold division distinguishes the hand-proved 0.3 and 0.30000000000000004 boundaries', () => {
  const two = planned(call(fixture([{ res: 'A' }, { res: 'A', duration: 2 }], { frameRate: 10 })));
  assert.deepEqual(two.sequenceInput.frames.map(frame => frame.durationSeconds), [0.1, 0.2]);
  const twoClip = createSequenceClip(two.sequenceInput);
  assert.equal(twoClip.durationSeconds, 0.30000000000000004);
  assert.equal(sampleSequenceClip(twoClip, 0.3, { mode: 'once' }).atEnd, false);
  const one = planned(call(fixture([{ res: 'A', duration: 3 }], { frameRate: 10 })));
  assert.equal(one.sequenceInput.frames[0].durationSeconds, 0.3);
  assert.equal(sampleSequenceClip(createSequenceClip(one.sequenceInput), 0.3, { mode: 'once' }).atEnd, true);
});

test('M05: positive subnormal seconds are retained but quotient and cumulative overflow refuse atomically', () => {
  const tiny = planned(call(fixture([{ res: 'A' }], { frameRate: 1.7976931348623157e308 })));
  const seconds = tiny.sequenceInput.frames[0].durationSeconds;
  assert.ok(seconds > 0 && seconds < 2.2250738585072014e-308 && Number.isFinite(seconds));
  assert.equal(createSequenceClip(tiny.sequenceInput).durationSeconds, seconds);
  refused(call(fixture([{ res: 'A' }], { frameRate: 5e-324 })), 'invalid', at('TIME_INVALID', '/mc/walk/frames/0/duration'));
  refused(call(fixture([{ res: 'A' }, { res: 'A' }, { res: 'A' }, { res: 'A' }], { frameRate: 2.2250738585072014e-308 })),
    'invalid', at('TIME_INVALID', '/mc/walk/frames/3/duration'));
});

test('M06: all five primitive gates refuse objects without coercion and use argument order', () => {
  let probes = 0;
  const hostile = new Proxy({}, { get() { probes++; throw undefined; }, ownKeys() { probes++; throw undefined; }, getPrototypeOf() { probes++; throw undefined; } });
  const args = [BASE, 'walk', 'assets/walk.png', 4, 2];
  for (const [index, source] of [[0, 'text'], [1, 'clipName'], [2, 'atlasPath'], [3, 'atlasWidth'], [4, 'atlasHeight']]) {
    const values = [...args]; values[index] = hostile;
    refused(plan(...values), 'invalid', at('INPUT_INVALID', '', source));
    for (const value of [undefined, null, true, 1n, Symbol('refuse'), () => {}, [], Object('boxed')]) {
      const wrong = [...args]; wrong[index] = value;
      refused(plan(...wrong), 'invalid', at('INPUT_INVALID', '', source));
    }
    if (index < 3) {
      const wrong = [...args]; wrong[index] = 24;
      refused(plan(...wrong), 'invalid', at('INPUT_INVALID', '', source));
    } else {
      const wrong = [...args]; wrong[index] = '24';
      refused(plan(...wrong), 'invalid', at('INPUT_INVALID', '', source));
    }
  }
  refused(plan(hostile, hostile, hostile, hostile, hostile), 'invalid', at('INPUT_INVALID', '', 'text'));
  refused(plan('{', 'walk', 'bad%path', '4', 2), 'invalid', at('INPUT_INVALID', '', 'atlasWidth'));
  assert.equal(probes, 0);
});

test('M07: strict parser mappings precede later semantic input checks', () => {
  for (const text of ['{', '\ufeff' + BASE, BASE + '//x', BASE.replace('"frameRate":4,', '"frameRate":4,"frameRate":8,'),
    BASE.replace('"frameRate":4,', '"frameRate":4,"\\u0066rameRate":8,'), BASE.replace('"events":[]', '"events":[],')]) {
    refused(call(text, '', 'bad%path', 0, 0), 'invalid', at('SYNTAX_INVALID', ''));
  }
  refused(call(BASE + '\ud800'), 'invalid', at('INPUT_INVALID', ''));
  refused(call(' '.repeat(1048577)), 'invalid', at('LIMIT_EXCEEDED', ''));
  refused(call('{"mc":{"walk":{"frames":[{"res":"\\ud800"}]}},"res":{}}'), 'invalid', at('INPUT_INVALID', '/mc/walk/frames/0/res'));
});

test('M08: parser byte, decoded-string and depth limits map without executing or normalizing input', () => {
  const overBytes = JSON.stringify({ mc: { walk: { frames: [{ res: 'A' }] }, other: Array.from({ length: 512 }, () => 'é'.repeat(1024)) }, res: { A: { x: 0, y: 0, w: 2, h: 2 } } });
  assert.ok(overBytes.length < 1048576);
  refused(call(overBytes), 'invalid', at('LIMIT_EXCEEDED', ''));
  const longString = JSON.stringify({ mc: { walk: { frames: [{ res: 'A' }] }, other: 'x'.repeat(4097) }, res: { A: { x: 0, y: 0, w: 2, h: 2 } } });
  refused(call(longString), 'invalid', at('LIMIT_EXCEEDED', '/mc/other'));
  const deep = '['.repeat(17) + '0' + ']'.repeat(17);
  refused(call(deep), 'invalid', at('LIMIT_EXCEEDED', ''));
  let nested = 0;
  for (let index = 0; index < 14; index++) nested = [nested];
  const depth16 = { mc: { walk: { frames: [{ res: 'A' }] }, other: nested }, res: { A: { x: 0, y: 0, w: 2, h: 2 } } };
  planned(call(JSON.stringify(depth16)));
  depth16.mc.other = [nested];
  refused(call(JSON.stringify(depth16)), 'invalid', at('LIMIT_EXCEEDED', ''));
  const decodedKey = 'é'.repeat(2048);
  const unused = { mc: { walk: { frames: [{ res: 'A' }] }, [decodedKey]: null }, res: { A: { x: 0, y: 0, w: 2, h: 2 } } };
  planned(call(JSON.stringify(unused)));
  delete unused.mc[decodedKey]; unused.mc[decodedKey + 'x'] = null;
  refused(call(JSON.stringify(unused)), 'invalid', at('LIMIT_EXCEEDED', '/mc/' + decodedKey + 'x'));
  const justBytes = BASE + ' '.repeat(1048576 - BASE.length);
  assert.equal(planned(call(justBytes)).totalLegacyFrames, 6);
});

test('M09: parser is invoked once only after primitive gates and its foreign fault is never inspected', () => {
  const original = JSON.parse;
  let calls = 0;
  try {
    JSON.parse = function (...args) { calls++; return Reflect.apply(original, JSON, args); };
    planned(call()); assert.equal(calls, 1);
    calls = 0;
    refused(call(BASE, 'walk', '../bad.png'), 'invalid', at('PATH_INVALID', '', 'atlasPath')); assert.equal(calls, 1);
    calls = 0;
    refused(call('{'), 'invalid', at('SYNTAX_INVALID', '')); assert.equal(calls, 0);
    refused(call({}), 'invalid', at('INPUT_INVALID', '', 'text')); assert.equal(calls, 0);
  } finally { JSON.parse = original; }
  let probes = 0;
  const payload = new Proxy({}, { get() { probes++; throw undefined; }, ownKeys() { probes++; throw undefined; }, getPrototypeOf() { probes++; throw undefined; } });
  calls = 0;
  try {
    JSON.parse = () => { calls++; throw payload; };
    refused(call(), 'incomplete', at('INTERNAL_FAILED', ''));
    assert.equal(calls, 1); assert.equal(probes, 0);
  } finally { JSON.parse = original; }
});

test('M10: selector Unicode and UTF-8 bounds are exact and case-sensitive with no first-clip fallback', () => {
  refused(call(BASE, ''), 'invalid', at('INPUT_INVALID', '', 'clipName'));
  refused(call(BASE, '\ud800'), 'invalid', at('INPUT_INVALID', '', 'clipName'));
  refused(call(BASE, '😀'.repeat(65)), 'invalid', at('LIMIT_EXCEEDED', '', 'clipName'));
  const name = '😀'.repeat(64);
  const text = JSON.stringify({ mc: { [name]: { frames: [{ res: 'A' }] } }, res: { A: { x: 0, y: 0, w: 2, h: 2 } } });
  assert.equal(planned(call(text, name)).clipName, name);
  const exactNames = '{"mc":{"é":{"frames":[{"res":"A"}]},"e\\u0301":{"frames":[{"res":"B"}]}},"res":{"A":{"x":0,"y":0,"w":2,"h":2},"B":{"x":2,"y":0,"w":2,"h":2}}}';
  assert.equal(planned(call(exactNames, 'é')).sequenceInput.frames[0].x, 0);
  assert.equal(planned(call(exactNames, 'e\u0301')).sequenceInput.frames[0].x, 2);
  refused(call(BASE, 'Walk'), 'invalid', at('CLIP_NOT_FOUND', '/mc/Walk'));
  refused(call(BASE, 'constructor'), 'invalid', at('CLIP_NOT_FOUND', '/mc/constructor'));
});

test('M11: own __proto__ and constructor names resolve without prototype authority or pointer corruption', () => {
  const text = '{"mc":{"__proto__":{"frames":[{"res":"constructor"}]},"constructor":{"frames":[{"res":"__proto__"}]}},"res":{"constructor":{"x":0,"y":0,"w":2,"h":2},"__proto__":{"x":2,"y":0,"w":2,"h":2}}}';
  assert.equal(planned(call(text, '__proto__')).holds[0].resourceName, 'constructor');
  assert.equal(planned(call(text, 'constructor')).sequenceInput.frames[0].x, 2);
  refused(call(BASE, 'w/~'), 'invalid', at('CLIP_NOT_FOUND', '/mc/w~1~0'));
  const escaped = '{"mc":{"w/~":{"frames":[{"res":"r/~"}]}},"res":{"r/~":{"x":0,"y":0,"w":0,"h":2}}}';
  refused(call(escaped, 'w/~'), 'invalid', at('REGION_INVALID', '/res/r~1~0/w'));
});

test('M12: portable atlas paths preserve spelling and reject URL, traversal and reserved forms', () => {
  for (const path of ['', '/a.png', '//a/a.png', 'https://x/a.png', 'C:/a.png', 'a\\b.png', '../a.png', './a.png', 'a//b.png',
    'a/../b.png', 'a?b.png', 'a#b.png', 'a%20b.png', 'a/CON.png', 'a/aux', 'a/b. ', 'a/b.', 'a/\u0000b']) {
    refused(call(BASE, 'walk', path), 'invalid', at('PATH_INVALID', '', 'atlasPath'));
  }
  refused(call(BASE, 'walk', '\ud800'), 'invalid', at('INPUT_INVALID', '', 'atlasPath'));
  refused(call(BASE, 'walk', 'a'.repeat(1021) + '.png'), 'invalid', at('LIMIT_EXCEEDED', '', 'atlasPath'));
  const exact = 'a'.repeat(1020) + '.png';
  assert.equal(planned(call(BASE, 'walk', exact)).atlasPath, exact);
  assert.equal(planned(call(BASE, 'walk', 'assets/e\u0301.png')).atlasPath, 'assets/e\u0301.png');
});

test('M13: selector then path then dimensions semantic order is fixed after strict parsing', () => {
  refused(call(BASE, '', '../bad', 0, 0), 'invalid', at('INPUT_INVALID', '', 'clipName'));
  refused(call(BASE, 'walk', '../bad', 0, 0), 'invalid', at('PATH_INVALID', '', 'atlasPath'));
  for (const invalid of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    refused(call(BASE, 'walk', 'assets/walk.png', invalid, 0), 'invalid', at('INPUT_INVALID', '', 'atlasWidth'));
    refused(call(BASE, 'walk', 'assets/walk.png', 4, invalid), 'invalid', at('INPUT_INVALID', '', 'atlasHeight'));
  }
});

test('M14: root, dictionaries, selected clip and frame shapes are invalid before unknown fields', () => {
  for (const [text, pointer] of [
    ['null', ''], ['[]', ''], ['1', ''], ['{}', '/mc'], ['{"mc":[],"res":{}}', '/mc'], ['{"mc":{},"res":null}', '/res'],
    ['{"mc":{"walk":null},"res":{}}', '/mc/walk'], ['{"mc":{"walk":{}},"res":{}}', '/mc/walk/frames'],
    ['{"mc":{"walk":{"frames":{}}},"res":{}}', '/mc/walk/frames'], ['{"mc":{"walk":{"frames":[]}},"res":{}}', '/mc/walk/frames'],
    ['{"mc":{"walk":{"frames":[null]}},"res":{}}', '/mc/walk/frames/0'],
  ]) refused(call(text), 'invalid', at('INPUT_INVALID', pointer));
});

test('M15: rate validation rejects coercion, null, zero, negatives and JSON numeric overflow', () => {
  for (const rate of [0, -1, null, '24', false, {}, []]) {
    refused(call(fixture([{ res: 'A' }], { frameRate: rate })), 'invalid', at('RATE_INVALID', '/mc/walk/frameRate'));
  }
  refused(call(fixture().replace('"frames":', '"frameRate":1e400,"frames":')), 'invalid', at('RATE_INVALID', '/mc/walk/frameRate'));
});

test('M16: labels and events types validate before frames, while empty/null lists admit no playback claim', () => {
  for (const values of [{}, { labels: null, events: null }, { labels: [], events: [] }]) planned(call(fixture([{ res: 'A' }], values)));
  for (const field of ['labels', 'events']) for (const value of [0, '', {}, false]) {
    refused(call(fixture([{ res: 'missing' }], { [field]: value })), 'invalid', at('INPUT_INVALID', `/mc/walk/${field}`));
  }
  refused(call(fixture([{ res: 'A' }], { frameRate: 0, labels: {}, events: {} })), 'invalid', at('RATE_INVALID', '/mc/walk/frameRate'));
  refused(call(fixture([{ res: 'A' }], { labels: {}, events: {} })), 'invalid', at('INPUT_INVALID', '/mc/walk/labels'));
  refused(call(fixture([{ res: 'A' }], { labels: [{ name: 'a', frame: 1 }] })), 'unsupported', at('FEATURE_UNSUPPORTED', '/mc/walk/labels'));
  refused(call(fixture([{ res: 'A' }], { events: [null] })), 'unsupported', at('FEATURE_UNSUPPORTED', '/mc/walk/events'));
});

test('M17: frame resource, x, y and duration validate in order with strict signed offsets', () => {
  for (const value of [null, 0, false, {}, []]) refused(call(fixture([{ res: value }])), 'invalid', at('INPUT_INVALID', '/mc/walk/frames/0/res'));
  for (const field of ['x', 'y']) for (const value of [null, '2', 1.5, -2147483649, 2147483648]) {
    refused(call(fixture([{ res: 'A', [field]: value }])), 'invalid', at('INPUT_INVALID', `/mc/walk/frames/0/${field}`));
  }
  const boundary = planned(call(fixture([{ res: 'A', x: -2147483648, y: 2147483647 }])));
  assert.equal(boundary.holds[0].offsetX, -2147483648); assert.equal(boundary.holds[0].offsetY, 2147483647);
  const zero = planned(call('{"mc":{"walk":{"frames":[{"res":"A","x":-0,"y":-0}]}},"res":{"A":{"x":-0,"y":-0,"w":2,"h":2}}}'));
  assert.equal(Object.is(zero.holds[0].offsetX, -0), false); assert.equal(Object.is(zero.holds[0].offsetY, -0), false);
  assert.equal(Object.is(zero.sequenceInput.frames[0].x, -0), false);
  refused(call(fixture([{ res: null, x: 'bad', y: 'bad', duration: 0 }])), 'invalid', at('INPUT_INVALID', '/mc/walk/frames/0/res'));
  refused(call(fixture([{ res: 'A', x: 'bad', y: 'bad', duration: 0 }])), 'invalid', at('INPUT_INVALID', '/mc/walk/frames/0/x'));
  refused(call(fixture([{ res: 'A', y: 'bad', duration: 0 }])), 'invalid', at('INPUT_INVALID', '/mc/walk/frames/0/y'));
});

test('M18: explicit durations are positive safe integers, never parseInt-compatible values', () => {
  for (const duration of [0, -1, 1.5, null, '3', false, {}, [], Number.MAX_SAFE_INTEGER + 1]) {
    refused(call(fixture([{ res: 'A', duration }])), 'invalid', at('DURATION_INVALID', '/mc/walk/frames/0/duration'));
  }
  refused(call(fixture([{ res: 'missing', duration: 0 }])), 'invalid', at('DURATION_INVALID', '/mc/walk/frames/0/duration'));
});

test('M19: missing references refuse own-key resolution and resource-name bytes at the frame pointer', () => {
  refused(call(fixture([{ res: 'missing' }])), 'invalid', at('REFERENCE_UNRESOLVED', '/mc/walk/frames/0/res'));
  refused(call(fixture([{ res: 'constructor' }])), 'invalid', at('REFERENCE_UNRESOLVED', '/mc/walk/frames/0/res'));
  const name = '😀'.repeat(64);
  assert.equal(planned(call(fixture([{ res: name }], {}, { [name]: { x: 0, y: 0, w: 2, h: 2 } }))).holds[0].resourceName, name);
  refused(call(fixture([{ res: '😀'.repeat(65) }])), 'invalid', at('LIMIT_EXCEEDED', '/mc/walk/frames/0/res'));
});

test('M20: region required values and safe extent fit use separately declared width and height', () => {
  for (const region of [null, [], 0]) refused(call(fixture([{ res: 'A' }], {}, { A: region })), 'invalid', at('REGION_INVALID', '/res/A'));
  for (const [field, values] of [['x', [-1, 0.5, null, '0']], ['y', [-1, null]], ['w', [0, -1, 0.5, null, '2']], ['h', [0, -1, null]]]) {
    for (const value of values) refused(call(fixture([{ res: 'A' }], {}, { A: { x: 0, y: 0, w: 2, h: 2, [field]: value } })), 'invalid', at('REGION_INVALID', `/res/A/${field}`));
  }
  refused(call(fixture([{ res: 'A' }], {}, { A: { y: 0, w: 2, h: 2 } })), 'invalid', at('REGION_INVALID', '/res/A/x'));
  refused(call(fixture([{ res: 'A' }], {}, { A: { x: 0, y: 0, w: Number.MAX_SAFE_INTEGER + 1, h: 2 } })), 'invalid', at('REGION_INVALID', '/res/A/w'));
  refused(call(BASE, 'walk', 'assets/walk.png', 3, 2), 'invalid', at('REGION_INVALID', '/res/B/w'));
  refused(call(BASE, 'walk', 'assets/walk.png', 4, 1), 'invalid', at('REGION_INVALID', '/res/A/h'));
  refused(call(fixture([{ res: 'A' }], {}, { A: { x: Number.MAX_SAFE_INTEGER, y: 0, w: 1, h: 1 } }), 'walk', 'assets/walk.png', Number.MAX_SAFE_INTEGER, 1), 'invalid', at('REGION_INVALID', '/res/A/w'));
  const narrow = planned(call(fixture([{ res: 'A' }], {}, { A: { x: 0, y: 0, w: 1, h: 4 } }), 'walk', 'assets/walk.png', 1, 4));
  assert.deepEqual(narrow.sequenceInput.frames[0], { x: 0, y: 0, width: 1, height: 4, durationSeconds: 0.041666666666666664 });
});

test('M21: every later invalid selected value beats earlier unsupported declarations and leaves no partial plan', () => {
  const text = '{"z":0,"mc":{"walk":{"labels":[null],"frames":[{"res":"A","rotated":true},{"res":"B"}]}},"res":{"A":{"x":0,"y":0,"w":2,"h":2,"trim":true},"B":{"x":2,"y":0,"w":0,"h":2}}}';
  refused(call(text), 'invalid', at('REGION_INVALID', '/res/B/w'));
  refused(call(fixture([{}, { res: 'A', duration: 0 }], { events: [null] })), 'invalid', at('DURATION_INVALID', '/mc/walk/frames/1/duration'));
  refused(call(fixture([{ res: 'A', unknown: true }, { res: 'missing' }])), 'invalid', at('REFERENCE_UNRESOLVED', '/mc/walk/frames/1/res'));
});

test('M22: deferred unknown keys use root/clip/frame/first-referenced-region phase order and sorted pointers', () => {
  refused(call('{"z":0,"a/~":0,"mc":{"walk":{"frames":[{"res":"A"}],"extra":true}},"res":{"A":{"x":0,"y":0,"w":2,"h":2}}}'), 'unsupported', at('SCHEMA_UNSUPPORTED', '/a~1~0'));
  refused(call(fixture([{ res: 'A', aaa: 0 }], { zzz: 0, 'a/~': 0 })), 'unsupported', at('SCHEMA_UNSUPPORTED', '/mc/walk/a~1~0'));
  refused(call(fixture([{ res: 'A', z: 0, 'a/~': 0 }, { res: 'A', a: 0 }])), 'unsupported', at('SCHEMA_UNSUPPORTED', '/mc/walk/frames/0/a~1~0'));
  const regions = { A: { x: 0, y: 0, w: 2, h: 2, a: 0 }, B: { x: 2, y: 0, w: 2, h: 2, z: 0, 'a/~': 0 } };
  refused(call(fixture([{ res: 'B' }, { res: 'A' }], {}, regions)), 'unsupported', at('SCHEMA_UNSUPPORTED', '/res/B/a~1~0'));
  refused(call(fixture([{ res: 'A', frame: 1 }])), 'unsupported', at('SCHEMA_UNSUPPORTED', '/mc/walk/frames/0/frame'));
});

test('M23: blank frames and nonempty lists refuse after unknown keys and all supported blank values validate', () => {
  for (const frame of [{}, { res: '' }]) refused(call(fixture([frame])), 'unsupported', at('FEATURE_UNSUPPORTED', '/mc/walk/frames/0/res'));
  refused(call(fixture([{}, { res: 'A' }], { labels: [null], events: [null] })), 'unsupported', at('FEATURE_UNSUPPORTED', '/mc/walk/frames/0/res'));
  refused(call(fixture([{ res: '', x: 'bad' }])), 'invalid', at('INPUT_INVALID', '/mc/walk/frames/0/x'));
  refused(call(fixture([{ duration: 1048577 }])), 'invalid', at('LIMIT_EXCEEDED', '/mc/walk/frames/0/duration'));
  refused(call(fixture([{}, { res: 'A', extra: true }])), 'unsupported', at('SCHEMA_UNSUPPORTED', '/mc/walk/frames/1/extra'));
  refused(call(fixture([{ res: 'A' }], { labels: [null], events: [null] })), 'unsupported', at('FEATURE_UNSUPPORTED', '/mc/walk/labels'));
});

test('M24: unselected clips and unreferenced region contents remain uncertified while selected data converts', () => {
  const text = '{"mc":{"walk":{"frames":[{"res":"A"}]},"other":{"frameRate":0,"frames":[null],"unknown":true}},"res":{"A":{"x":0,"y":0,"w":2,"h":2},"unused":null,"constructor":{"rotated":true}}}';
  const result = planned(call(text));
  assert.equal(result.sequenceInput.frames.length, 1);
  assert.equal(result.holds[0].resourceName, 'A');
  assert.deepEqual(Object.keys(result.sequenceInput).sort(), ['atlasHeight', 'atlasWidth', 'frames']);
  refused(call(text, 'other'), 'invalid', at('RATE_INVALID', '/mc/other/frameRate'));
});

test('M25: 1024 authored frames admit through the real core and 1025 refuse before frame interpretation', () => {
  const frames = Array.from({ length: 1024 }, () => ({ res: 'A' }));
  const result = planned(call(fixture(frames, { frameRate: 1024 })));
  assert.equal(result.holds.length, 1024); assert.equal(result.totalLegacyFrames, 1024);
  assert.equal(result.holds[1023].firstLegacyFrame, 1024);
  assert.equal(createSequenceClip(result.sequenceInput).durationSeconds, 1);
  refused(call(fixture([...frames, null])), 'invalid', at('LIMIT_EXCEEDED', '/mc/walk/frames'));
});

test('M26: logical ticks are bounded before output expansion and later sum overflow reports its authored hold', () => {
  const one = planned(call(fixture([{ res: 'A', duration: 1048576 }], { frameRate: 1048576 })));
  assert.equal(one.totalLegacyFrames, 1048576); assert.equal(one.holds.length, 1);
  assert.equal(one.sequenceInput.frames[0].durationSeconds, 1);
  refused(call(fixture([{ res: 'A', duration: 1048577 }])), 'invalid', at('LIMIT_EXCEEDED', '/mc/walk/frames/0/duration'));
  refused(call(fixture([{ res: 'A', duration: 1048576 }, { res: 'A' }])), 'invalid', at('LIMIT_EXCEEDED', '/mc/walk/frames/1/duration'));
});

test('M27: clip and region dictionary counts bound even unselected declarations before selected validation', () => {
  const mc = { walk: { frames: [{ res: 'A' }] } };
  for (let index = 0; index < 63; index++) mc[`other${index}`] = null;
  const regions = { A: { x: 0, y: 0, w: 2, h: 2 } };
  for (let index = 0; index < 4095; index++) regions[`other${index}`] = null;
  planned(call(JSON.stringify({ mc, res: regions })));
  refused(call(JSON.stringify({ mc: { ...mc, extra: null }, res: regions })), 'invalid', at('LIMIT_EXCEEDED', '/mc'));
  refused(call(JSON.stringify({ mc, res: { ...regions, extra: null } })), 'invalid', at('LIMIT_EXCEEDED', '/res'));
});

test('M28: results are fresh deeply frozen data and retain no parsed graph or authentic clip', () => {
  const original = JSON.parse;
  let parsed;
  let first;
  try {
    JSON.parse = function (...args) { parsed = Reflect.apply(original, JSON, args); return parsed; };
    first = call(); planned(first);
  } finally { JSON.parse = original; }
  const second = call(); planned(second);
  assert.notEqual(first, second); assert.notEqual(first.acceptance, second.acceptance);
  assert.notEqual(first.diagnostics, second.diagnostics); assert.notEqual(first.plan, second.plan);
  assert.notEqual(first.plan.sequenceInput, second.plan.sequenceInput);
  assert.notEqual(first.plan.sequenceInput.frames, second.plan.sequenceInput.frames);
  assert.notEqual(first.plan.sequenceInput.frames[0], second.plan.sequenceInput.frames[0]);
  assert.notEqual(first.plan.holds, second.plan.holds); assert.notEqual(first.plan.holds[0], second.plan.holds[0]);
  parsed.res.A.x = 99; parsed.mc.walk.frames[0].x = 99; parsed.mc.walk.frames.length = 0;
  assert.deepEqual(first.plan, EXPECTED);
  assert.throws(() => { first.plan.holds[0].offsetX = 999; }, TypeError);
  const one = call('{'); const two = call('{');
  refused(one, 'invalid', at('SYNTAX_INVALID', '')); refused(two, 'invalid', at('SYNTAX_INVALID', ''));
  assert.notEqual(one, two); assert.notEqual(one.diagnostics, two.diagnostics); assert.notEqual(one.diagnostics[0], two.diagnostics[0]);
  assert.notEqual(one.acceptance, two.acceptance);
});
