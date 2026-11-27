// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createClassicFilters } from '../tools/egret-migrate/compat/filters.mjs';

test('a live classic colour matrix follows both nodes, clearing owns only the matrix', () => {
  const ctx = createClassicFilters(new AbortController().signal, true, class {});
  const { ColorMatrixFilter, BlurFilter, GlowFilter } = ctx.types;
  const a = { renderEffect: { blurRadius: 2 } },
    b = {};
  const colored = new ColorMatrixFilter();
  ctx.apply(a, [colored]);
  ctx.apply(b, [colored]);
  const matrix = colored.matrix;
  matrix[4] = 25;
  colored.matrix = matrix;
  assert.equal(a.renderEffect.colorMatrix[4], 25);
  assert.equal(b.renderEffect.colorMatrix[4], 25);
  assert.equal(a.renderEffect.blurRadius, 2);
  assert.throws(() => ctx.apply(a, [new BlurFilter(10, 10, 2)]), { code: 'LEGACY_FILTER_RADIUS_UNSUPPORTED' });
  assert.throws(() => ctx.apply(a, [new GlowFilter(123, 0.8, 35, 35, 2, 3)]), {
    code: 'LEGACY_FILTER_RADIUS_UNSUPPORTED'
  });
  assert.equal(a.renderEffect.colorMatrix[4], 25);
  ctx.apply(a, null);
  ctx.apply(b, []);
  assert.deepEqual(a.renderEffect, { blurRadius: 2 });
  assert.equal(b.renderEffect, undefined);
});
test('a native colour override keeps a shared update atomic and can be detached', () => {
  const ctx = createClassicFilters(new AbortController().signal, true, class {});
  const filter = new ctx.types.ColorMatrixFilter(),
    a = {},
    b = {};
  ctx.apply(a, [filter]);
  ctx.apply(b, [filter]);
  const changed = filter.matrix;
  changed[4] = 27;
  const external = filter.matrix;
  external[4] = 90;
  b.renderEffect = { colorMatrix: external };
  assert.throws(
    () => {
      filter.matrix = changed;
    },
    { code: 'LEGACY_FILTER_CONFLICT' }
  );
  assert.equal(filter.matrix[4], 0);
  assert.equal(a.renderEffect.colorMatrix[4], 0);
  ctx.apply(b, null);
  assert.equal(b.renderEffect.colorMatrix[4], 90);
  filter.matrix = changed;
  assert.equal(a.renderEffect.colorMatrix[4], 27);
});
test('a GLES3 project refuses effects before publishing a frame', () => {
  const ctx = createClassicFilters(new AbortController().signal, false, class {});
  const node = {};
  assert.throws(() => ctx.apply(node, [new ctx.types.ColorMatrixFilter()]), {
    code: 'LEGACY_ANDROID_FILTER_UNSUPPORTED'
  });
  assert.equal(node.renderEffect, undefined);
  assert.equal(ctx.read(node), null);
});
