// SPDX-License-Identifier: Apache-2.0
// The parts most game screens need, from @egret/engine/web/view, as plain logic: red dots that add up, numbers
// written short in English and in Chinese, a request a button cannot send twice, and the words of key caps.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createBadges, createRequest, formatCompact, keyCap } from '@egret/engine/web/view';

// Break caught: a dot deep in a tree that its parent does not show, a dot on a sibling counted, or a clear that
// leaves dots under it.
test('VP01 red dots add up from what they hold, and are told when they change', () => {
  const badges = createBadges();
  let changes = 0;
  const stop = badges.onChange(() => changes++);
  badges.set('mail/system', 3);
  badges.set('mail/friends', true);
  badges.set('mailbox', 7);
  badges.set('bag/new/sword', 1);
  assert.equal(badges.count('mail'), 4, 'three and a dot; mailbox is not under mail');
  assert.equal(badges.has('mail'), true);
  assert.equal(badges.count('mail/system'), 3);
  assert.equal(badges.count('bag'), 1);
  assert.equal(badges.has('shop'), false);
  assert.deepEqual(badges.paths(), ['bag/new/sword', 'mail/friends', 'mail/system', 'mailbox']);
  assert.equal(changes, 4);
  badges.set('mail/system', 3);
  assert.equal(changes, 4, 'the same count is no change');
  badges.clear('mail');
  assert.equal(badges.count('mail'), 0);
  assert.equal(badges.count('mailbox'), 7);
  badges.set('mailbox', false);
  assert.equal(badges.has('mailbox'), false);
  stop();
  badges.clear();
  assert.equal(changes, 6, 'a removed listener is not told');
  for (const path of ['', '/mail', 'mail/', 'mail//x', 'mail box', 7])
    assert.throws(() => badges.set(path, 1), { code: 'UI_BADGE_PATH_INVALID' });
  assert.throws(() => badges.set('mail', 'many'), { code: 'UI_BADGE_PATH_INVALID' });
});

// Break caught: 9999 written as 10K, a Chinese count in thousands, a rounding that grows a number, or a step skipped.
test('VP02 numbers are written short in English and in Chinese, cut rather than rounded up', () => {
  const en = value => formatCompact(value),
    zh = value => formatCompact(value, { locale: 'zh' });
  assert.deepEqual(
    [0, 7, 999, 1000, 1250, 9999, 12_345, 999_999, 1_000_000, 4_560_000, 2_000_000_000, 3.2e12].map(en),
    ['0', '7', '999', '1K', '1.2K', '9.9K', '12.3K', '999.9K', '1M', '4.5M', '2B', '3.2T']
  );
  assert.deepEqual([999, 9999, 10_000, 12_345, 99_999_999, 100_000_000, 345_000_000, 1.5e12].map(zh), [
    '999',
    '9999',
    '1万',
    '1.2万',
    '9999.9万',
    '1亿',
    '3.4亿',
    '1.5万亿'
  ]);
  assert.equal(formatCompact(-12_345), '-12.3K');
  assert.equal(formatCompact(12_345, { digits: 0 }), '12K');
  assert.equal(formatCompact(12_345, { locale: 'zh', digits: 2 }), '1.23万');
  assert.equal(formatCompact(7.8), '7');
  assert.equal(formatCompact(Infinity), '∞');
  assert.throws(() => formatCompact(Number.NaN), { code: 'UI_COMPACT_INVALID' });
  assert.throws(() => formatCompact(1, { locale: 'fr' }), { code: 'UI_COMPACT_INVALID' });
  assert.throws(() => formatCompact(1, { digits: 4 }), { code: 'UI_COMPACT_INVALID' });
});

// Break caught: a purchase sent twice by a double press, a failure that rejects into the game, or a button left
// busy after a failure.
test('VP03 a request is sent once at a time, and its state can be shown', async () => {
  let calls = 0,
    finish;
  const buy = createRequest(item => {
    calls++;
    return new Promise((resolve, reject) => (finish = { resolve: () => resolve('bought ' + item), reject }));
  });
  assert.equal(buy.busy, false);
  const first = buy.run('sword'),
    second = buy.run('shield');
  assert.equal(first, second, 'a second press while it is out gets the same promise');
  assert.equal(buy.busy, true);
  assert.equal(calls, 1);
  finish.resolve();
  assert.equal(await first, 'bought sword');
  assert.equal(buy.busy, false);
  assert.equal(buy.result, 'bought sword');
  const failing = buy.run('bow');
  finish.reject(new Error('no money'));
  assert.equal(await failing, undefined, 'a failure is not thrown');
  assert.equal(buy.error.message, 'no money');
  assert.equal(buy.busy, false);
  assert.equal(buy.sent, 2);
  const sync = createRequest(() => {
    throw new Error('at once');
  });
  assert.equal(await sync.run(), undefined);
  assert.equal(sync.error.message, 'at once');
  assert.throws(() => createRequest('buy'), { code: 'UI_REQUEST_INVALID' });
});

// Break caught: a key cap that shows a code instead of what is printed on the key, or a pad button by its index.
test('VP04 key caps read as a player reads them', () => {
  assert.deepEqual(
    ['space', 'escape', 'enter', 'z', 'KeyQ', 'Digit3', 'ArrowLeft', 'left', 'shift'].map(key =>
      keyCap(key, 'keyboard')
    ),
    ['Space', 'Esc', 'Enter', 'Z', 'Q', '3', 'Left', 'Left', 'Shift']
  );
  assert.deepEqual(
    ['a', 'b', 'pad:x', 'start', 'select', 'l1', 'r2', 'up'].map(key => keyCap(key, 'gamepad')),
    ['A', 'B', 'X', 'Menu', 'View', 'LB', 'RT', 'D-pad Up']
  );
});
