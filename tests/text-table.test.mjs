// A game's words in each of its languages, chosen and changed while it runs: so that no Chinese is left on an
// English screen, which the quality checklist of the games repository found in every game.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createTextTable, pickLanguage } from '@egret/engine/kit';

const coded = code => error => error?.code === code;
const words = {
  zh: { start: '开始', coins: '{n} 枚铜钱', only: '仅中文' },
  en: { start: 'Start', coins: '{n} coins', settings: 'Settings' }
};

test('TT01 a word by key in the current language, values put in, falling back, and the key itself last', () => {
  const missing = [];
  const table = createTextTable({
    languages: words,
    language: 'en',
    onMissing: (key, language) => missing.push(language + ':' + key)
  });
  assert.deepEqual(table.languages, ['zh', 'en']);
  assert.equal(table.text('start'), 'Start');
  assert.equal(table.text('coins', { n: 12 }), '12 coins');
  assert.equal(table.text('coins', {}), '{n} coins', 'a value not given leaves its place');
  assert.equal(table.text('only'), '仅中文', 'missing in English: the fallback, Chinese');
  assert.equal(table.text('only'), '仅中文');
  assert.equal(table.text('nowhere'), 'nowhere');
  assert.deepEqual(missing, ['en:only', 'en:nowhere'], 'told once per key');
  assert.equal(table.has('only'), false);
  assert.deepEqual(table.missing(), { zh: ['settings'], en: ['only'] });
  // Inherited names are not words.
  assert.equal(table.text('toString'), 'toString');
});

test('TT02 changing the language tells every listener, and one that fails does not stop the others', () => {
  const table = createTextTable({ languages: words, fallback: 'en' });
  assert.equal(table.language, 'zh');
  assert.equal(table.text('settings'), 'Settings');
  const heard = [];
  const stop = table.onChange(language => heard.push('a:' + language));
  table.onChange(() => {
    throw new Error('redraw failed');
  });
  table.onChange(language => heard.push('c:' + language));
  assert.throws(() => table.setLanguage('en'), /redraw failed/);
  assert.deepEqual(heard, ['a:en', 'c:en']);
  assert.equal(table.language, 'en');
  table.setLanguage('en');
  assert.equal(heard.length, 2, 'the same language is no change');
  stop();
  assert.throws(() => table.setLanguage('fr'), coded('TEXT_TABLE_INVALID'));
  for (const bad of [
    null,
    {},
    { languages: {} },
    { languages: words, language: 'fr' },
    { languages: { zh: { a: 1 } } },
    { languages: words, fallback: 'fr' }
  ])
    assert.throws(() => createTextTable(bad), coded('TEXT_TABLE_INVALID'), JSON.stringify(bad));
});

test('TT03 the language that best matches what the browser asks for', () => {
  assert.equal(pickLanguage(['zh', 'en'], ['en-GB', 'zh']), 'en');
  assert.equal(pickLanguage(['zh', 'en'], ['zh-TW']), 'zh');
  assert.equal(pickLanguage(['zh-CN', 'zh-TW', 'en'], ['zh-TW', 'en']), 'zh-TW');
  assert.equal(pickLanguage(['zh', 'en'], ['fr', 'de']), 'zh');
  assert.equal(pickLanguage(['zh', 'en'], []), 'zh');
  assert.throws(() => pickLanguage([], ['en']), coded('TEXT_TABLE_INVALID'));
});

test('TT04 the browser kit reads, and watches, the player asking for less motion, and the languages asked for', async () => {
  const { prefersReducedMotion, watchReducedMotion, browserLanguages } = await import('@egret/engine/web/kit');
  assert.equal(prefersReducedMotion(), false, 'no page: no');
  assert.deepEqual(
    browserLanguages(),
    Array.isArray(globalThis.navigator?.languages) ? [...globalThis.navigator.languages] : []
  );
  const listeners = new Set();
  const list = {
    matches: true,
    addEventListener: (type, listener) => listeners.add(listener),
    removeEventListener: (type, listener) => listeners.delete(listener)
  };
  globalThis.matchMedia = query => {
    assert.equal(query, '(prefers-reduced-motion: reduce)');
    return list;
  };
  try {
    assert.equal(prefersReducedMotion(), true);
    const heard = [];
    const stop = watchReducedMotion(reduced => heard.push(reduced));
    for (const listener of listeners) listener({ matches: false });
    assert.deepEqual(heard, [false]);
    stop();
    assert.equal(listeners.size, 0);
  } finally {
    delete globalThis.matchMedia;
  }
});
