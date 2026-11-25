// SPDX-License-Identifier: Apache-2.0
// Views of @egret/engine/web/view: a screen described as data, checked and planned on screens of several shapes.
// Each case gives a description and a frame and reads where the parts go, in the game's units, or what is refused.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_VIEW_SKIN, checkView, planView } from '@egret/engine/web/view';

const landscape = {
  screen: { x: -80, y: 0, width: 800, height: 360 },
  safe: { x: -50, y: 0, width: 760, height: 340 },
  orientation: 'landscape'
};
const at = (plan, name) => ({ ...plan.parts[plan.names.get(name)].rect });

test('a vertical scroll panel plans fixed two-column rows beyond its viewport', () => {
  const market = {
    root: {
      type: 'panel',
      name: 'buildings',
      scroll: 'vertical',
      width: 340,
      height: 110,
      layout: 'column',
      gap: 8,
      padding: 10,
      children: Array.from({ length: 5 }, (_, row) => ({
        type: 'panel',
        height: 50,
        layout: 'row',
        gap: 6,
        children: [
          { type: 'button', name: 'left' + row, text: 'House', width: 'fill' },
          { type: 'button', name: 'right' + row, text: 'Workshop', width: 'fill' }
        ]
      }))
    }
  };
  const plan = planView(market, landscape);
  assert.deepEqual(at(plan, 'buildings'), { x: -50, y: 0, width: 340, height: 110 });
  assert.equal(at(plan, 'left0').y, 10);
  assert.equal(at(plan, 'right4').y, 242);
  assert.equal(at(plan, 'right4').width, 157);
  assert.throws(() => checkView({ root: { ...market.root, scroll: 'horizontal' } }), { code: 'UI_VIEW_INVALID' });
  assert.throws(() => checkView({ root: { type: 'button', text: 'Confirm', scroll: 'vertical' } }), {
    code: 'UI_VIEW_INVALID'
  });
});

// Break caught: rich labels and image leaves must use the same named layout path as the existing parts.
test('VW05 rich text, button details, borders and image leaves share the fixed boxes and narrow validation', () => {
  const paragraph = { fontFamilies: ['Noto Sans', 'Noto Sans CJK SC'], lineHeight: 22, locale: 'zh-CN' };
  const description = {
    root: {
      type: 'panel',
      name: 'sheet',
      layout: 'column',
      width: 232,
      height: 224,
      gap: 4,
      border: { color: 0x224466, width: 2 },
      children: [
        { type: 'text', name: 'detail', text: '营建清单 Construction requirements', width: 136, height: 72, paragraph },
        {
          type: 'button',
          name: 'build',
          text: '营建 Build',
          description: '工坊：木材及石料\nRequires two workers',
          width: 160,
          height: 96,
          paragraph
        },
        { type: 'image', name: 'cover', src: 'cover.webp', label: '工坊图标', width: 48, height: 36 }
      ]
    }
  };
  const plan = planView(description, landscape);
  assert.deepEqual([at(plan, 'detail').width, at(plan, 'detail').height], [136, 72]);
  assert.deepEqual([at(plan, 'cover').width, at(plan, 'cover').height], [48, 36]);
  assert.equal(checkView(description).get('build'), 'button');
  for (const bad of [
    { type: 'text', text: 'a', height: 44, paragraph: { fontFamilies: [] } },
    { type: 'text', text: 'a', height: 44, paragraph: { fontFamilies: ['Ahem'], lineHeight: 0 } },
    { type: 'button', text: 'b', description: 'c', paragraph },
    { type: 'panel', border: { color: -1, width: 2 } },
    { type: 'image', src: '', height: 32 },
    { type: 'image', src: 'foo', height: 0 }
  ])
    assert.throws(
      () => checkView({ root: bad }),
      error => error.code === 'UI_VIEW_INVALID'
    );
});

// Break caught: an anchor measured from the wrong edge, an offset that goes outward, or a share of the wrong room.
test('VW01 a free panel places each part from its anchor, inward, at its size or a share of the panel', () => {
  const plan = planView(
    {
      root: {
        type: 'panel',
        name: 'hud',
        padding: 10,
        children: [
          { type: 'text', name: 'score', text: 0, width: 200 },
          { type: 'button', name: 'pause', text: 'II', anchor: 'top-right', x: 4, y: 4, width: 48, height: 48 },
          { type: 'bar', name: 'hp', anchor: 'bottom', y: 8, width: '50%', height: 12 },
          { type: 'panel', name: 'middle', anchor: 'center', width: 100, height: 60, x: 10 },
          { type: 'space', name: 'all', width: 'fill', height: 'fill' }
        ]
      }
    },
    landscape
  );
  assert.equal(plan.variant, 'landscape');
  // The root fills the safe part.
  assert.deepEqual(at(plan, 'hud'), { x: -50, y: 0, width: 760, height: 340 });
  // Inside the padding: 10 in from each edge of the safe part.
  assert.deepEqual(at(plan, 'score'), { x: -40, y: 10, width: 200, height: Math.ceil(24 * 1.4) });
  assert.deepEqual(at(plan, 'pause'), { x: -50 + 760 - 10 - 48 - 4, y: 14, width: 48, height: 48 });
  assert.deepEqual(at(plan, 'hp'), { x: -40 + (740 - 370) / 2, y: 10 + 320 - 12 - 8, width: 370, height: 12 });
  assert.deepEqual(at(plan, 'middle'), {
    x: -40 + (740 - 100) / 2 + 10,
    y: 10 + (320 - 60) / 2,
    width: 100,
    height: 60
  });
  assert.deepEqual(at(plan, 'all'), { x: -40, y: 10, width: 740, height: 320 });
  // Parents come before what they hold.
  assert.ok(plan.parts.every(part => part.parent < part.index));
  assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.parts[1].rect));
});

// Break caught: fill that ignores the fixed parts or the gaps, a justify that moves filled rows, or align ignored.
test('VW02 a row and a column place parts one after another: fixed sizes, then what fills shares the rest', () => {
  const plan = planView(
    {
      area: 'screen',
      root: {
        type: 'panel',
        layout: 'column',
        gap: 10,
        children: [
          {
            type: 'panel',
            name: 'bar',
            layout: 'row',
            height: 60,
            gap: 8,
            padding: 4,
            align: 'center',
            children: [
              { type: 'button', name: 'back', text: '<', width: 52, height: 40 },
              { type: 'text', name: 'title', text: 'Shop', width: 'fill' },
              { type: 'button', name: 'coins', text: '+', width: '10%', height: 40, y: 2 }
            ]
          },
          { type: 'panel', name: 'list', height: 'fill' },
          {
            type: 'panel',
            name: 'buttons',
            layout: 'row',
            height: 48,
            gap: 20,
            justify: 'center',
            children: [
              { type: 'button', name: 'ok', text: 'OK', width: 100 },
              { type: 'button', name: 'cancel', text: 'Cancel', width: 100 }
            ]
          },
          {
            type: 'panel',
            name: 'spread',
            layout: 'row',
            height: 20,
            justify: 'between',
            children: [
              { type: 'space', name: 'a', width: 20 },
              { type: 'space', name: 'b', width: 20 },
              { type: 'space', name: 'c', width: 20 }
            ]
          }
        ]
      }
    },
    landscape
  );
  // The column: 60, then the list fills what 60 + 48 + 20 and three gaps leave of 360.
  assert.deepEqual(at(plan, 'bar'), { x: -80, y: 0, width: 800, height: 60 });
  assert.deepEqual(at(plan, 'list'), { x: -80, y: 70, width: 800, height: 360 - 60 - 48 - 20 - 30 });
  assert.equal(at(plan, 'buttons').y, 70 + 202 + 10);
  // The row: 52 and 10% of 792 fixed, the title takes the rest less two gaps; each is centred across 52.
  const inner = 800 - 8;
  assert.deepEqual(at(plan, 'back'), { x: -76, y: 4 + 6, width: 52, height: 40 });
  assert.deepEqual(at(plan, 'title'), {
    x: -76 + 52 + 8,
    y: 4 + (52 - Math.ceil(24 * 1.4)) / 2,
    width: inner - 52 - inner * 0.1 - 16,
    height: Math.ceil(24 * 1.4)
  });
  assert.deepEqual(at(plan, 'coins'), { x: -76 + inner - inner * 0.1, y: 4 + 6 + 2, width: inner * 0.1, height: 40 });
  // Gathered in the middle: 220 of 800; spread: the space between the three is shared out.
  assert.equal(at(plan, 'ok').x, -80 + (800 - 220) / 2);
  assert.equal(at(plan, 'cancel').x, -80 + (800 - 220) / 2 + 120);
  assert.deepEqual(
    ['a', 'b', 'c'].map(name => at(plan, name).x),
    [-80, -80 + 20 + 370, -80 + 780]
  );
});

// Break caught: the landscape parts kept on a turned phone, or a view that covers the notch when it should not.
test('VW03 a screen taller than wide takes the portrait parts; area says whether the notch is avoided', () => {
  const description = {
    label: 'Result',
    root: {
      type: 'panel',
      name: 'card',
      card: true,
      width: 400,
      height: 200,
      anchor: 'center',
      children: [{ type: 'text', name: 'won', text: 'You won' }]
    },
    portrait: {
      type: 'panel',
      name: 'card',
      card: true,
      width: 'fill',
      height: 300,
      anchor: 'bottom',
      children: [{ type: 'text', name: 'won', text: 'You won', align: 'center' }]
    }
  };
  const tall = {
    screen: { x: 0, y: -40, width: 360, height: 720 },
    safe: { x: 0, y: 0, width: 360, height: 640 },
    orientation: 'portrait'
  };
  const plan = planView(description, tall);
  assert.equal(plan.variant, 'portrait');
  assert.deepEqual(at(plan, 'card'), { x: 0, y: 340, width: 360, height: 300 });
  assert.equal(planView(description, landscape).variant, 'landscape');
  assert.deepEqual(at(planView({ ...description, area: 'screen' }, tall), 'card'), {
    x: 0,
    y: 380,
    width: 360,
    height: 300
  });
  // A view without portrait parts uses its parts on any screen; the skin is the default with what the view changes.
  const plain = planView({ root: description.root, skin: { button: 0x112233 } }, tall);
  assert.equal(plain.variant, 'landscape');
  assert.equal(plain.skin.button, 0x112233);
  assert.equal(plain.skin.text, DEFAULT_VIEW_SKIN.text);
  assert.ok(Object.isFrozen(DEFAULT_VIEW_SKIN));
});

// Break caught: a misspelt field drawn as nothing, a name used twice binding the wrong part, or portrait parts that
// leave a binding with nothing to bind.
test('VW04 what cannot be drawn or bound is refused, saying where', () => {
  const refused = (description, pattern, code = 'UI_VIEW_INVALID') =>
    assert.throws(
      () => checkView(description),
      error => {
        assert.equal(error.code, code);
        assert.match(String(error.cause), pattern);
        return true;
      }
    );
  refused({ root: { type: 'slider' } }, /root: type is panel/);
  refused({ root: { type: 'text', colour: 1 } }, /root: a text has no colour/);
  refused({ root: { type: 'text', text: 'a', children: [] } }, /a text has no children/);
  refused(
    {
      root: {
        type: 'panel',
        children: [
          { type: 'text', name: 'gold' },
          { type: 'text', name: 'gold' }
        ]
      }
    },
    /root\/1: the name gold is used twice/
  );
  refused({ root: { type: 'text', name: '1st' } }, /name 1st is not a name/);
  refused({ root: { type: 'text', width: '120%' } }, /width/);
  refused({ root: { type: 'button' } }, /a button has text/);
  refused({ root: { type: 'bar', value: 2 } }, /value is 0 to 1/);
  refused({ root: { type: 'panel', layout: 'grid' } }, /layout is free, row, column/);
  refused({ root: { type: 'text' }, skin: { glow: 1 } }, /a skin has no glow/);
  refused({ root: { type: 'text' }, theme: 'dark' }, /a view has no theme/);
  const deep = { type: 'panel', children: [] };
  let at = deep;
  for (let i = 0; i < 40; i++) {
    const next = { type: 'panel', children: [] };
    at.children.push(next);
    at = next;
  }
  refused({ root: deep }, /at most 32 deep/);
  refused(
    {
      root: {
        type: 'panel',
        children: [
          { type: 'text', name: 'gold' },
          { type: 'button', name: 'buy', text: 'Buy' }
        ]
      },
      portrait: {
        type: 'panel',
        children: [
          { type: 'bar', name: 'gold' },
          { type: 'text', name: 'sell' }
        ]
      }
    },
    /not in portrait: buy; only in portrait: sell; of another kind in portrait: gold/,
    'UI_VIEW_VARIANT_MISMATCH'
  );
  assert.throws(() => planView({ root: { type: 'text' } }, { screen: landscape.screen, orientation: 'landscape' }), {
    code: 'UI_VIEW_FRAME_INVALID'
  });
  assert.deepEqual(
    [...checkView({ root: { type: 'panel', name: 'p', children: [{ type: 'toggle', name: 't', text: 'Sound' }] } })],
    [
      ['p', 'panel'],
      ['t', 'toggle']
    ]
  );
});
