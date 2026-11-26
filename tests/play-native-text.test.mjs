// SPDX-License-Identifier: Apache-2.0
// Native label regression: font style is opt-in and a PlayText also has a settlement promise.
import assert from 'node:assert/strict';
import test from 'node:test';
import { PlayText } from '@egret/engine/play';
import { checkView } from '@egret/engine/web/view';

test('PlayText exposes a readiness promise without changing the existing standalone constructor', async () => {
  const changes = [];
  const text = new PlayText('first', value => changes.push(value));
  assert.ok(text.ready instanceof Promise);
  await text.ready;
  text.text = 'next';
  assert.deepEqual(changes, ['next']);
  await text.ready;
  text.dispose();
});

test('short native text styles can be described without changing paragraph styles', () => {
  const words = { type: 'text', text: 'Hello', fontFamily: 'Arial', fontWeight: 650, italic: true };
  assert.doesNotThrow(() =>
    checkView({
      root: { type: 'panel', children: [words, { type: 'button', text: 'Go', fontWeight: 500 }] }
    })
  );
  assert.throws(() => checkView({ root: { ...words, fontWeight: 0 } }), { code: 'UI_VIEW_INVALID' });
  assert.throws(() => checkView({ root: { ...words, italic: 1 } }), { code: 'UI_VIEW_INVALID' });
  assert.throws(() => checkView({ root: { ...words, fontFamily: '' } }), { code: 'UI_VIEW_INVALID' });
});
