// SPDX-License-Identifier: Apache-2.0
// A migrated filter belongs to one game and borrows the display tree's existing effect group.
const identity = Object.freeze([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]);
function problem(code, message) {
  return Object.assign(new Error(message), { code });
}
function copyMatrix(source) {
  const m = Array.from(source ?? identity);
  if (m.length !== 20 || !m.every(x => Number.isFinite(x) && Math.abs(x) <= 65536))
    throw new RangeError('Expected a 4 by 5 colour matrix with finite coefficients.');
  return Object.freeze(m);
}

export function createClassicFilters(signal, sharedEffects, HashObject) {
  const byNode = new Map();
  const matrices = new WeakMap();
  class ColorMatrixFilter extends HashObject {
    constructor(matrix = null) {
      super();
      matrices.set(this, { matrix: copyMatrix(matrix), nodes: new Set() });
    }
    get matrix() {
      return matrices.get(this).matrix.slice();
    }
    set matrix(source) {
      const next = copyMatrix(source);
      const state = matrices.get(this);
      // Check every attached node before updating a shared filter. A newer native
      // matrix on any node must keep the previous value on all other nodes.
      const captured = [];
      for (const node of state.nodes) {
        const row = byNode.get(node);
        if (row && !signal.aborted && !node.isDisposed) captured.push([node, row, base(node, row)]);
      }
      for (const [node, row, original] of captured) applyMatrix(node, row, next, original);
      state.matrix = next;
    }
  }
  class BlurFilter extends HashObject {
    constructor(blurX = 4, blurY = 4, quality = 1) {
      super();
      Object.assign(this, { blurX, blurY, quality });
    }
  }
  class GlowFilter extends HashObject {
    constructor(
      color = 0xff0000,
      alpha = 1,
      blurX = 6,
      blurY = 6,
      strength = 2,
      quality = 1,
      inner = false,
      knockout = false
    ) {
      super();
      Object.assign(this, { color, alpha, blurX, blurY, strength, quality, inner, knockout });
    }
  }

  function base(node, row) {
    const current = node.renderEffect;
    if (!current) return undefined;
    if (row && current === row.applied) return row.base;
    const fields = { ...current };
    if (fields.colorMatrix !== undefined) {
      const previous = row?.applied?.colorMatrix;
      if (!previous || !fields.colorMatrix.every((value, i) => value === previous[i]))
        throw problem('LEGACY_FILTER_CONFLICT', 'The display already owns a different colour matrix.');
      delete fields.colorMatrix;
    }
    return Object.keys(fields).some(key => key !== 'blurRadius' || fields.blurRadius !== 0) ? fields : undefined;
  }
  function applyMatrix(node, row, matrix, original) {
    row.base = original;
    node.renderEffect = { ...row.base, colorMatrix: matrix };
    row.applied = node.renderEffect;
  }
  function release(node) {
    const row = byNode.get(node);
    if (row) {
      matrices.get(row.filter).nodes.delete(node);
      byNode.delete(node);
    }
  }
  signal.addEventListener(
    'abort',
    () => {
      for (const node of byNode.keys()) release(node);
    },
    { once: true }
  );
  return {
    types: {
      ColorMatrixFilter,
      BlurFilter,
      GlowFilter,
      BitmapFilterQuality: Object.freeze({ LOW: 1, MEDIUM: 2, HIGH: 3 })
    },
    release,
    read(node) {
      const row = byNode.get(node);
      return row ? [row.filter] : null;
    },
    apply(node, filters) {
      const row = byNode.get(node);
      if (filters == null || (Array.isArray(filters) && filters.length === 0)) {
        if (row) {
          const current = node.renderEffect;
          const replacement = current?.colorMatrix;
          if (!replacement || replacement.every((v, i) => v === row.applied.colorMatrix[i]))
            node.renderEffect = base(node, row);
          release(node);
        }
        return;
      }
      if (signal.aborted || node.isDisposed) throw problem('LEGACY_FILTER_CLOSED', 'The filter owner is closed.');
      if (!Array.isArray(filters) || filters.length !== 1)
        throw problem('LEGACY_FILTER_CHAIN_UNSUPPORTED', 'Supply one migrated filter.');
      if (!sharedEffects)
        throw problem(
          'LEGACY_ANDROID_FILTER_UNSUPPORTED',
          'The GLES3 project format does not encode subtree effect groups.'
        );
      const filter = filters[0];
      if (filter instanceof BlurFilter || filter instanceof GlowFilter) {
        const limit = filter instanceof BlurFilter ? 8 : 16;
        if (filter.blurX !== filter.blurY || filter.blurX > limit || filter.blurY > limit)
          throw problem(
            'LEGACY_FILTER_RADIUS_UNSUPPORTED',
            'The requested classic radii exceed the shared isotropic effect range.'
          );
        throw problem(
          'LEGACY_FILTER_KERNEL_UNVERIFIED',
          'The shared effect uses a different kernel. Select renderEffect explicitly after reviewing the picture.'
        );
      }
      const state = matrices.get(filter);
      if (!state) throw problem('LEGACY_FILTER_UNSUPPORTED', 'Expected a colour matrix from the same game.');
      const record = { filter, base: row?.base, applied: row?.applied };
      applyMatrix(node, record, state.matrix, base(node, row));
      release(node);
      byNode.set(node, record);
      state.nodes.add(node);
    }
  };
}
