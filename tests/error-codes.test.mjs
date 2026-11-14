// SPDX-License-Identifier: Apache-2.0
// An error says what happened: its message is its code and a sentence, its code stays the code alone, and the two
// error code documents are what tools/error-codes.mjs writes from the sources.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as egret from '@egret/engine';
import { collectErrorCodes, buildErrorCodeDocument, ERROR_CODE_DOCUMENTS } from '../tools/error-codes.mjs';
import { describeErrorCode } from '../packages/runtime/dist/errorHelp.js';

const host = { surface: {}, start() {}, stop() {}, async close() {}, setTimeout() { return () => {}; } };
const thrown = run => { try { run(); } catch (cause) { return cause; } return undefined; };

test('EC01 a thrown error carries its code alone and a message of the code and a sentence', async () => {
  const engine = await egret.createEngine({ host }), scope = engine.createScope();
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
  } finally { scope.dispose(); await engine.dispose(); }
});

test('EC02 a code of no known area has its code as its message, and a cause is kept', () => {
  const cause = new Error('inner');
  const plain = new egret.EgretError('ZZ_NOT_A_CODE', { cause });
  assert.equal(plain.message, 'ZZ_NOT_A_CODE');
  assert.equal(plain.code, 'ZZ_NOT_A_CODE');
  assert.equal(plain.cause, cause);
  assert.equal(describeErrorCode('ZZ_NOT_A_CODE'), '');
  // Put together from an area and an ending, with the name between them kept.
  assert.equal(describeErrorCode('TWEEN_NOT_STARTED'), new egret.EgretError('TWEEN_NOT_STARTED').message.slice('TWEEN_NOT_STARTED: '.length));
  assert.match(describeErrorCode('SPRITE_SHEET_FRAME_UNKNOWN'), /frame/);
  // The same code gives the same sentence each time.
  assert.equal(describeErrorCode('FRAME_RENDER_FAILED'), describeErrorCode('FRAME_RENDER_FAILED'));
  assert.match(describeErrorCode('FRAME_RENDER_FAILED'), /_BACKPRESSURE/);
});

test('EC03 every code the sources name has a sentence, a period at its end and no line break', () => {
  const codes = collectErrorCodes();
  assert.ok(codes.length > 600, 'the scan found ' + codes.length + ' codes');
  for (const code of ['FRAME_RENDER_FAILED', 'FRAME_BUDGET_EXCEEDED', 'OBJECT_DISPOSED', 'WEBGL2_BACKPRESSURE', 'WEBGPU_DEVICE_LOST']) assert.ok(codes.includes(code), code);
  const without = codes.filter(code => describeErrorCode(code) === '');
  assert.deepEqual(without, [], 'write a sentence in packages/runtime/src/errorHelp.ts for each');
  for (const code of codes) assert.match(describeErrorCode(code), /^[^\n|]+\.$/, code);
});

test('EC04 the two error code documents are what the tool writes now', () => {
  const codes = collectErrorCodes();
  for (const language of ['en', 'zh']) {
    const written = fs.readFileSync(new URL('../' + ERROR_CODE_DOCUMENTS[language], import.meta.url), 'utf8');
    assert.ok(written === buildErrorCodeDocument(language, codes), ERROR_CODE_DOCUMENTS[language] + ' is out of date: run node tools/error-codes.mjs');
    // One row for each code, and no code without its meaning in either language.
    for (const code of codes) assert.ok(written.includes('| `' + code + '` | '), language + ' ' + code);
    assert.ok(!written.includes('| — |'), language);
  }
});
