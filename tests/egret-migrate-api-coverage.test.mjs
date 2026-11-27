// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { collectLegacyUses } from '../tools/egret-migrate/api-usage.mjs';
import { checkLegacyBindings } from '../tools/egret-migrate/compat/coverage.mjs';

test('a host surface report identifies missing bindings without invoking getters', () => {
  const egret = { ByteArray: class ByteArray {} };
  Object.defineProperty(egret, 'network', {
    get() {
      throw new Error('Getter must remain idle');
    }
  });
  const input = [
    { namespace: 'egret', members: ['ByteArray'], dynamic: false },
    { namespace: 'egret', members: ['Timer'], dynamic: false },
    { namespace: 'egret', members: ['network', 'open'], dynamic: false },
    { namespace: 'egret', members: [], dynamic: true }
  ];
  assert.deepEqual(
    checkLegacyBindings({ egret }, input).map(item => item.status),
    ['present', 'requires-binding', 'runtime-value', 'runtime-value']
  );
});

test('classic output collects dotted names, literal indexes and dynamic lookups with JS positions', {
  skip: !process.env.EGRET_LEGACY_TYPESCRIPT_PLUS && 'Requires the original Egret compiler'
}, () => {
  const ts = createRequire(import.meta.url)(process.env.EGRET_LEGACY_TYPESCRIPT_PLUS);
  const rows = new Map();
  collectLegacyUses(
    ts,
    rows,
    'new egret.ByteArray();\nnew egret["ByteArray"]();\nRES[name](); eui.State.key;',
    'classic/0001.js'
  );
  assert.deepEqual(
    [...rows.values()].map(e => [e.namespace, e.members, e.dynamic, e.uses]),
    [
      ['egret', ['ByteArray'], false, 2],
      ['RES', [], true, 1],
      ['eui', ['State', 'key'], false, 1]
    ]
  );
  assert.equal([...rows.values()][0].examples[1].line, 2);
});
