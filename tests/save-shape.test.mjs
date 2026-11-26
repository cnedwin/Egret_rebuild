// SPDX-License-Identifier: Apache-2.0
// shapeOf of @egret/engine/kit: the check and the fill of a save, from its defaults. Twelve games of the games repository
// wrote both by hand, a field at a time; the saves here have the shapes three of them keep (Canal Watch's stars by
// difficulty, Night Wardens' table of nights, Sand Scroll's fields added in later builds).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemorySaveStorage, createSaveStore, shapeOf } from '@egret/engine/kit';

const fresh = (language = 'zh') => ({
  best: { normal: 0, hard: 0 },
  plays: 0,
  finished: [],
  nights: {},
  daily: null,
  settings: { language, sound: true, reducedMotion: false }
});
const rules = {
  'best.*': { int: true, min: 0, max: 3 },
  plays: { int: true, min: 0 },
  'finished.*': value => typeof value === 'string',
  'nights.*': night => night !== null && typeof night === 'object' && Number.isInteger(night.stars),
  daily: value => value === null || (typeof value === 'object' && typeof value.day === 'string'),
  'settings.language': ['zh', 'en']
};

// Break caught: a save of another shape taken, a good one refused, or a problem told without where it is.
test('SS01 a save is held to the shape of its defaults and to the rules, and each problem says where', () => {
  const shape = shapeOf(fresh, rules);
  assert.equal(shape.validate(fresh()), true);
  const good = {
    ...fresh('en'),
    best: { normal: 3, hard: 1 },
    plays: 7,
    finished: ['a', 'b'],
    nights: { 1: { stars: 2 } }
  };
  assert.deepEqual(shape.problems(good), []);
  assert.deepEqual(
    shape.problems({
      ...fresh(),
      best: { normal: 4, hard: 1.5 },
      plays: '7',
      finished: ['a', 3],
      nights: { 2: { stars: 'x' } },
      daily: { day: 5 },
      settings: { language: 'fr', sound: 'yes', reducedMotion: false }
    }),
    [
      'best.normal: a whole number from 0 to 3',
      'best.hard: a whole number from 0 to 3',
      'plays: a whole number from 0',
      'finished.1: what its check accepts',
      'nights.2: what its check accepts',
      'daily: what its check accepts',
      'settings.language: one of "zh", "en"',
      'settings.sound: true or false'
    ]
  );
  assert.deepEqual(shapeOf(fresh).problems([]), ['(the save): a table of fields']);
  assert.deepEqual(shapeOf(fresh).problems({ ...fresh(), settings: null }), ['settings: a table of fields']);
  assert.deepEqual(shapeOf(fresh).problems({ ...fresh(), finished: 'none' }), ['finished: a list']);
  assert.deepEqual(shapeOf(fresh).problems({ ...fresh(), plays: Number.NaN }), ['plays: a number']);
  assert.throws(() => shapeOf(() => 5), { code: 'SAVE_STORE_OPTIONS_INVALID' });
  assert.throws(() => shapeOf(fresh, { plays: 'big' }), { code: 'SAVE_STORE_OPTIONS_INVALID' });
});

// Break caught: a save from an older build, without the fields added since, refused or left without them; a fill
// that overwrites what a save has, or shares the defaults' objects.
test('SS02 a save from an older build gets the fields added since, and keeps what it has', () => {
  const shape = shapeOf(fresh, rules);
  const old = { best: { normal: 2 }, plays: 3, finished: ['a'], settings: { language: 'en' } };
  assert.equal(shape.validate(old), true);
  assert.deepEqual(old, {
    best: { normal: 2, hard: 0 },
    plays: 3,
    finished: ['a'],
    settings: { language: 'en', sound: true, reducedMotion: false },
    nights: {},
    daily: null
  });
  const a = shape.fill({}),
    b = shape.fill({});
  a.best.normal = 3;
  assert.equal(b.best.normal, 0, 'each fill has its own copy of the defaults');
  assert.equal(shape.fill('not a save'), 'not a save');
});

// Break caught: the shape not working as a save store's validate: an older save not loaded with its new fields, or a
// broken one kept instead of starting again with the old text set aside.
test('SS03 as a save store validate, an older save loads filled and a broken one starts again', () => {
  const shape = shapeOf(fresh, rules);
  const write = data => JSON.stringify({ version: 1, savedAt: '2026-11-01T00:00:00.000Z', data });
  const storage = createMemorySaveStorage({
    game: write({ best: { normal: 1 }, plays: 2, settings: { language: 'en' } })
  });
  const problems = [];
  const store = createSaveStore({
    key: 'game',
    version: 1,
    defaults: fresh,
    storage,
    validate: shape.validate,
    onProblem: problem => problems.push(problem.kind)
  });
  assert.equal(store.data.best.hard, 0);
  assert.equal(store.data.settings.language, 'en');
  assert.deepEqual(problems, []);
  assert.equal(
    store.update(data => {
      data.best.normal = 9;
    }),
    false,
    'a change that breaks a rule is refused'
  );
  assert.equal(store.data.best.normal, 1);
  const broken = createMemorySaveStorage({ game: write({ ...fresh(), settings: { language: 'fr' } }) });
  const again = createSaveStore({
    key: 'game',
    version: 1,
    defaults: fresh,
    storage: broken,
    validate: shape.validate,
    onProblem: problem => problems.push(problem.kind)
  });
  assert.equal(again.data.settings.language, 'zh');
  assert.deepEqual(problems, ['invalid', 'invalid']);
  assert.ok(broken.getItem('game.unread'), 'the old text is kept aside');
});
