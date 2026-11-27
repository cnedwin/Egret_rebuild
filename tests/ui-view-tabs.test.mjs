// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { checkView, planView } from '@egret/engine/web/view';

const frame = {
  screen: { x: -72, y: 0, width: 784, height: 360 },
  safe: { x: -60, y: 0, width: 760, height: 340 },
  orientation: 'landscape'
};
const tab = (name, text, selected) => ({ type: 'button', role: 'tab', name, text, width: 120, height: 52, selected });
const list = (...children) => ({
  type: 'panel',
  role: 'tablist',
  name: 'marketTabs',
  label: 'Market pages',
  layout: 'row',
  children
});
const ordinary = { type: 'button', name: 'close', text: 'Close', width: 100, height: 44 };
const root = (...children) => ({ type: 'panel', children });

test('named tabs and a named tablist retain normal button and panel layout', () => {
  const description = { root: root(list(tab('offers', 'Offers', true), tab('gear', 'Relics', false)), ordinary) };
  const geometry = planView(description, frame);
  const unadorned = {
    root: root(
      {
        ...description.root.children[0],
        role: undefined,
        children: [
          { ...description.root.children[0].children[0], role: undefined, selected: undefined },
          { ...description.root.children[0].children[1], role: undefined, selected: undefined }
        ]
      },
      ordinary
    )
  };
  // Do not leave unknown fields in the old control description.
  delete unadorned.root.children[0].role;
  for (const child of unadorned.root.children[0].children) {
    delete child.role;
    delete child.selected;
  }
  assert.deepEqual(
    geometry.parts.map(({ rect }) => rect),
    planView(unadorned, frame).parts.map(({ rect }) => rect)
  );
  assert.deepEqual(
    [...checkView(description)],
    [
      ['marketTabs', 'panel'],
      ['offers', 'button'],
      ['gear', 'button'],
      ['close', 'button']
    ]
  );
  assert.equal(geometry.parts.find(p => p.part.name === 'offers').part.selected, true);
  assert.equal(geometry.parts.find(p => p.part.name === 'gear').part.role, 'tab');
});

test('tab admission rejects missing semantic ancestry and selection on unrelated controls', () => {
  for (const bad of [
    tab('loose', 'Loose', true),
    list({ ...tab('bad', 'Bad', true), name: undefined }),
    list({ ...tab('bad', 'Bad', true), semantic: false }),
    list({ ...tab('bad', 'Bad', true), selected: 'yes' }),
    { ...list(tab('bad', 'Bad', true)), name: undefined },
    { ...list(tab('bad', 'Bad', true)), semantic: false },
    root({ type: 'panel', semantic: false, children: [list(tab('bad', 'Bad', true))] }),
    list({ type: 'panel', name: 'nested', children: [tab('bad', 'Bad', true)] }),
    { ...ordinary, selected: true },
    { ...ordinary, role: 'button' }
  ]) {
    assert.throws(() => checkView({ root: bad }), { code: 'UI_VIEW_INVALID' });
  }
  assert.doesNotThrow(() => checkView({ root: list({ type: 'panel', children: [tab('okay', 'Okay', false)] }) }));
});

test('a tab role must stay a tab in every available view variant', () => {
  const description = {
    root: root(list(tab('offers', 'Offers', true), tab('gear', 'Relics', false)), ordinary),
    portrait: root(list(tab('offers', 'Offers', false), tab('gear', 'Relics', true)), ordinary)
  };
  assert.doesNotThrow(() => checkView(description));
  const wrongButton = { type: 'button', name: 'gear', text: 'Relics', width: 120, height: 52 };
  assert.throws(
    () =>
      checkView({
        ...description,
        tablet: root(list(tab('offers', 'Offers', true), wrongButton), ordinary)
      }),
    { code: 'UI_VIEW_VARIANT_MISMATCH' }
  );
  const withoutTabs = {
    type: 'panel',
    name: 'marketTabs',
    layout: 'row',
    children: [{ type: 'button', name: 'offers', text: 'Offers' }, wrongButton]
  };
  assert.throws(
    () =>
      checkView({
        ...description,
        tabletPortrait: root(withoutTabs, ordinary)
      }),
    { code: 'UI_VIEW_VARIANT_MISMATCH' }
  );
});
