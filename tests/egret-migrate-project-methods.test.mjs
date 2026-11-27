// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { collectLegacyUses } from '../tools/egret-migrate/api-usage.mjs';
import { installProjectMethods, readProjectMethod } from '../tools/egret-migrate/compat/project-methods.mjs';

test('only literal assignments of callables become proposed project methods', {
  skip: !process.env.EGRET_LEGACY_TYPESCRIPT_PLUS && 'Set EGRET_LEGACY_TYPESCRIPT_PLUS to the original game compiler'
}, () => {
  const ts = require(process.env.EGRET_LEGACY_TYPESCRIPT_PLUS);
  const definitions = [];
  collectLegacyUses(
    ts,
    new Map(),
    [
      'RES["projectBadge"] = function () {};',
      'RES.projectBadge = () => 2;',
      'RES[name] = function () {};',
      'RES.value = 2;',
      'RES.host.someHook = function () {};',
      'egret.register = function () {};'
    ].join('\n'),
    'classic/sample.js',
    definitions
  );
  assert.deepEqual(
    definitions.map(d => [d.namespace, d.name, d.line]),
    [
      ['RES', 'projectBadge', 1],
      ['RES', 'projectBadge', 2],
      ['egret', 'register', 6]
    ]
  );
});

test('approved slots accept original script functions only in their owning game', () => {
  const scope = new AbortController();
  const source = Object.freeze({
    RES: Object.freeze({
      load() {
        return 1;
      }
    })
  });
  const entries = [{ namespace: 'RES', name: 'projectBadge' }];
  const { RES } = installProjectMethods(source, scope, entries);
  const other = installProjectMethods(source, new AbortController(), entries);
  assert.equal(readProjectMethod(RES, 'projectBadge'), undefined);
  RES.projectBadge = () => 3;
  assert.equal(RES.projectBadge(), 3);
  assert.equal(readProjectMethod(RES, 'projectBadge')(), 3);
  assert.equal(other.RES.projectBadge, undefined);
  assert.equal(source.RES.projectBadge, undefined);
  assert.throws(() => {
    RES.projectBadge = 7;
  }, TypeError);
  assert.throws(() => {
    RES.extra = () => 0;
  }, TypeError);
  for (const name of ['load', 'constructor', '__proto__'])
    assert.throws(() => installProjectMethods(source, scope, [{ namespace: 'RES', name }]), TypeError);
  assert.throws(() => installProjectMethods(source, scope, [...entries, ...entries]), TypeError);
  scope.abort();
  assert.equal(RES.projectBadge, undefined);
  assert.throws(() => {
    RES.projectBadge = () => 4;
  }, /closed/);
});
