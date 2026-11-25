// SPDX-License-Identifier: Apache-2.0
// verticalPlayWords of @egret/engine/play: words written top to bottom in columns from right to left, as the rows a
// text draws for `game.text(words, { vertical })`. The drawing itself is checked in examples/play-taps/verify.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { verticalPlayWords } from '@egret/engine/play';

// Break caught: columns read from left to right, marks left lying down, or a short column shifting the next.
test('PV01 columns from right to left, marks upright, a short column filled with ideographic spaces', () => {
  // One column: each character on a line of its own, the comma upright.
  assert.equal(verticalPlayWords('洗冤笔录，第一案'), '洗\n冤\n笔\n录\n︐\n第\n一\n案');
  // A new line starts a column, to the left of the one before.
  assert.equal(verticalPlayWords('洗冤笔录\n宋慈'), '宋洗\n慈冤\n　笔\n　录');
  // At most three characters a column; brackets and the full stop turn upright.
  assert.deepEqual(verticalPlayWords('提刑（宋）。', 3).split('\n'), ['宋提', '︶刑', '︒︵']);
  assert.equal(verticalPlayWords(''), '');
  assert.throws(() => verticalPlayWords('印', 0), RangeError);
});
