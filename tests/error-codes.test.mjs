// SPDX-License-Identifier: Apache-2.0
// An error says what happened: its message is its code and a sentence, its code stays the code alone, and the two
// error code documents are what tools/error-codes.mjs writes from the sources.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as egret from '@egret/engine';
import { collectErrorCodes, buildErrorCodeDocument, ERROR_CODE_DOCUMENTS } from '../tools/error-codes.mjs';
const { describeErrorCode, setErrorLanguage, getErrorLanguage } = egret;

const host = {
  surface: {},
  start() {},
  stop() {},
  async close() {},
  setTimeout() {
    return () => {};
  }
};
const thrown = run => {
  try {
    run();
  } catch (cause) {
    return cause;
  }
  return undefined;
};

test('EC01 a thrown error carries its code alone and a message of the code and a sentence', async () => {
  const engine = await egret.createEngine({ host }),
    scope = engine.createScope();
  try {
    const sprite = scope.use(new egret.Sprite());
    const unfilled = thrown(() => sprite.graphics.drawRect(0, 0, 4, 4));
    assert.ok(unfilled instanceof egret.EgretError);
    assert.equal(unfilled.code, 'GRAPHICS_FILL_REQUIRED');
    assert.equal(unfilled.message, 'GRAPHICS_FILL_REQUIRED: ' + describeErrorCode('GRAPHICS_FILL_REQUIRED'));
    assert.match(unfilled.message, /beginFill/);
    const cyclic = thrown(() => engine.stage.addChild(engine.stage));
    assert.equal(cyclic.code, 'STAGE_ROOT_ONLY');
    assert.match(cyclic.message, /^STAGE_ROOT_ONLY: The stage is the root/);
    const late = thrown(() => engine.advanceTime(-1));
    assert.equal(late.message, late.code + ': ' + describeErrorCode(late.code));
  } finally {
    scope.dispose();
    await engine.dispose();
  }
});

test('EC02 a code of no known area has its code as its message, and a cause is kept', () => {
  const cause = new Error('inner');
  const plain = new egret.EgretError('ZZ_NOT_A_CODE', { cause });
  assert.equal(new egret.EgretError('ZZ_NOT_A_CODE').message, 'ZZ_NOT_A_CODE');
  // The cause is told after it; see EC-cause.
  assert.equal(plain.message, 'ZZ_NOT_A_CODE Cause: Error: inner');
  assert.equal(plain.code, 'ZZ_NOT_A_CODE');
  assert.equal(plain.cause, cause);
  assert.equal(describeErrorCode('ZZ_NOT_A_CODE'), '');
  // Put together from an area and an ending, with the name between them kept.
  assert.equal(
    describeErrorCode('TWEEN_NOT_STARTED'),
    new egret.EgretError('TWEEN_NOT_STARTED').message.slice('TWEEN_NOT_STARTED: '.length)
  );
  assert.match(describeErrorCode('SPRITE_SHEET_FRAME_UNKNOWN'), /frame/);
  // The same code gives the same sentence each time.
  assert.equal(describeErrorCode('FRAME_RENDER_FAILED'), describeErrorCode('FRAME_RENDER_FAILED'));
  assert.match(describeErrorCode('FRAME_RENDER_FAILED'), /_BACKPRESSURE/);
});

test('EC03 every code the sources name has a sentence, a period at its end and no line break', () => {
  const codes = collectErrorCodes();
  assert.ok(codes.length > 600, 'the scan found ' + codes.length + ' codes');
  for (const code of [
    'FRAME_RENDER_FAILED',
    'FRAME_BUDGET_EXCEEDED',
    'OBJECT_DISPOSED',
    'WEBGL2_BACKPRESSURE',
    'WEBGPU_DEVICE_LOST'
  ])
    assert.ok(codes.includes(code), code);
  const without = codes.filter(code => describeErrorCode(code) === '');
  assert.deepEqual(without, [], 'write a sentence in packages/runtime/src/errorHelp.ts for each');
  for (const code of codes) assert.match(describeErrorCode(code), /^[^\n|]+\.$/, code);
  // In Chinese too, and in neither language the short form that only spells the code out again.
  const vague = codes.filter(
    code =>
      describeErrorCode(code, 'zh') === '' ||
      describeErrorCode(code, 'zh').includes('出现问题') ||
      describeErrorCode(code, 'en').startsWith('A problem with')
  );
  assert.deepEqual(
    vague,
    [],
    'a code whose ending is not one of the usual kinds needs a sentence of its own, in errorHelp.ts and errorHelpZh.ts'
  );
  for (const code of codes) assert.match(describeErrorCode(code, 'zh'), /^[^\n|]+。$/, code);
});

test('EC04 the two error code documents are what the tool writes now', () => {
  const codes = collectErrorCodes();
  for (const language of ['en', 'zh']) {
    const written = fs.readFileSync(new URL('../' + ERROR_CODE_DOCUMENTS[language], import.meta.url), 'utf8');
    assert.ok(
      written === buildErrorCodeDocument(language, codes),
      ERROR_CODE_DOCUMENTS[language] + ' is out of date: run node tools/error-codes.mjs'
    );
    // One row for each code, and no code without its meaning in either language.
    for (const code of codes) assert.ok(written.includes('| `' + code + '` | '), language + ' ' + code);
    assert.ok(!written.includes('| — |'), language);
  }
});

test('EC05 the sentence of a message is in the language that was set, and the code is the same in both', () => {
  assert.equal(getErrorLanguage(), 'en');
  const english = new egret.EgretError('FRAME_RENDER_FAILED');
  try {
    setErrorLanguage('zh');
    assert.equal(getErrorLanguage(), 'zh');
    const chinese = new egret.EgretError('FRAME_RENDER_FAILED');
    assert.equal(chinese.code, english.code);
    assert.equal(chinese.message, 'FRAME_RENDER_FAILED: ' + describeErrorCode('FRAME_RENDER_FAILED', 'zh'));
    assert.match(chinese.message, /Host 拒绝或未能绘制这一帧/);
    // An error made before keeps the message it was made with, and a code this SDK does not know has no sentence.
    assert.match(english.message, /^FRAME_RENDER_FAILED: The Host refused/);
    assert.equal(new egret.EgretError('ZZ_NOT_A_CODE').message, 'ZZ_NOT_A_CODE');
    // Put together from an area and an ending, like the English one.
    assert.equal(describeErrorCode('TWEEN_NOT_STARTED'), '缓动还没有开始。');
    assert.equal(describeErrorCode('TWEEN_NOT_STARTED', 'en'), 'A tween has not been started.');
    // An area that begins a sentence begins with a capital, and one inside it does not.
    assert.equal(describeErrorCode('AUDIO_CLOSED', 'en'), 'The audio mixer was closed and takes nothing more.');
    assert.equal(
      describeErrorCode('AUDIO_OPTIONS_INVALID', 'en'),
      'The options given to the audio mixer are not valid: one is missing, of the wrong type or out of range.'
    );
    assert.throws(() => setErrorLanguage('fr'), TypeError);
    assert.equal(getErrorLanguage(), 'zh');
  } finally {
    setErrorLanguage('en');
  }
  assert.equal(new egret.EgretError('FRAME_RENDER_FAILED').message, english.message);
  assert.equal(describeErrorCode('FRAME_RENDER_FAILED', 'de'), '');
});

test('EC-cause a message ends with what caused the error, so a log of the message alone names the first failure', () => {
  const { EgretError } = egret;
  const plain = new EgretError('CLOCK_CALLBACK_FAILED');
  assert.equal(plain.message, 'CLOCK_CALLBACK_FAILED: ' + describeErrorCode('CLOCK_CALLBACK_FAILED'));
  // Another error is told by its name and message.
  const bug = new ReferenceError("Cannot access 'state' before initialization");
  const stopped = new EgretError('CLOCK_CALLBACK_FAILED', { cause: bug });
  assert.equal(stopped.cause, bug);
  assert.equal(stopped.code, 'CLOCK_CALLBACK_FAILED');
  assert.equal(stopped.message, plain.message + " Cause: ReferenceError: Cannot access 'state' before initialization");
  // An SDK error is told by its own message, which carries its own cause: the chain reads to the first failure.
  const value = new EgretError('DISPLAY_VALUE_INVALID', { cause: new RangeError('alpha was given 1.07') });
  const outer = new EgretError('FRAME_RENDER_FAILED', {
    cause: new EgretError('CLOCK_CALLBACK_FAILED', { cause: value })
  });
  assert.match(
    outer.message,
    /^FRAME_RENDER_FAILED: .* Cause: CLOCK_CALLBACK_FAILED: .* Cause: DISPLAY_VALUE_INVALID: .* Cause: RangeError: alpha was given 1\.07$/
  );
  // The same code wrapped again is not said twice.
  const twice = new EgretError('DISPLAY_VALUE_INVALID', { cause: value });
  assert.equal(twice.message, value.message);
  // What is not an error, or says nothing, adds nothing; a long cause is cut.
  assert.equal(new EgretError('CLOCK_CALLBACK_FAILED', { cause: 'text' }).message, plain.message);
  assert.equal(new EgretError('CLOCK_CALLBACK_FAILED', { cause: new Error('') }).message, plain.message);
  const long = new EgretError('CLOCK_CALLBACK_FAILED', { cause: new Error('x'.repeat(2000)) });
  assert.ok(long.message.length < plain.message.length + 520 && long.message.endsWith('…'));
});
