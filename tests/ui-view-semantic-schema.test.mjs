// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { checkView, planView } from '@egret/engine/web/view';

const frame = {
  screen: { x: -72, y: 0, width: 784, height: 360 },
  safe: { x: -60, y: 0, width: 760, height: 340 },
  orientation: 'landscape'
};

test('explicit panel role and decorative children do not change authored view geometry', () => {
  const panel = {
    type: 'panel',
    name: 'tile',
    label: 'Workshop',
    x: 20,
    y: 18,
    width: 132,
    height: 76,
    children: [{ type: 'text', name: 'icon', text: 'Decorative text', width: 100, height: 24 }]
  };
  const withSemantics = {
    ...panel,
    role: 'button',
    children: [{ ...panel.children[0], semantic: false }]
  };
  const base = planView({ root: panel }, frame);
  const described = planView({ root: withSemantics }, frame);
  assert.deepEqual(
    described.parts.map(({ rect }) => rect),
    base.parts.map(({ rect }) => rect)
  );
  assert.deepEqual(
    [...checkView({ root: withSemantics })],
    [
      ['tile', 'panel'],
      ['icon', 'text']
    ]
  );
  assert.equal(described.parts[0].part.role, 'button');
  assert.equal(described.parts[1].part.semantic, false);
});

test('semantic decorators and button roles retain strict admission', () => {
  for (const root of [
    { type: 'panel', name: 'tile', role: 'menu' },
    { type: 'panel', role: 'button' },
    { type: 'panel', name: 'tile', role: 'button', semantic: false },
    { type: 'button', name: 'tile', text: 'Build', role: 'button' },
    { type: 'text', name: 'tile', text: 'Build', semantic: true },
    { type: 'text', name: 'tile', text: 'Build', semantic: 'false' }
  ])
    assert.throws(() => checkView({ root }), { code: 'UI_VIEW_INVALID' });
});
