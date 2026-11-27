// SPDX-License-Identifier: Apache-2.0
// EXML and mutable layout objects share the same descriptor consumed by EUI's layout pass.
const layouts = new WeakMap();
function unsupported(message) {
  throw Object.assign(new Error(message), { code: 'LEGACY_EUI_UNSUPPORTED' });
}
class Layout {
  constructor(type) {
    layouts.set(this, { descriptor: { type, properties: {} } });
  }
  get target() {
    return layouts.get(this).owner ?? null;
  }
}
export class HorizontalLayout extends Layout {
  constructor() {
    super('HorizontalLayout');
  }
}
export class VerticalLayout extends Layout {
  constructor() {
    super('VerticalLayout');
  }
}
export class TileLayout extends Layout {
  constructor() {
    super('TileLayout');
  }
}

function field(prototype, name, fallback, valid) {
  Object.defineProperty(prototype, name, {
    get() {
      return layouts.get(this).descriptor.properties[name] ?? fallback;
    },
    set(value) {
      if (!valid(value)) unsupported('Unsupported ' + name + ' for this EUI layout.');
      const row = layouts.get(this);
      if ((row.descriptor.properties[name] ?? fallback) === value) return;
      row.descriptor.properties[name] = value;
      row.invalidate?.();
    }
  });
}
for (const key of ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'])
  field(Layout.prototype, key, 0, n => Number.isFinite(n) && n >= 0);
for (const Kind of [HorizontalLayout, VerticalLayout]) {
  field(Kind.prototype, 'gap', 6, Number.isFinite);
  field(
    Kind.prototype,
    'horizontalAlign',
    'left',
    v => ['left', 'center', 'right'].includes(v) || (Kind === HorizontalLayout && v === 'justify')
  );
  field(
    Kind.prototype,
    'verticalAlign',
    'top',
    v => ['top', 'middle', 'bottom'].includes(v) || (Kind === HorizontalLayout && v === 'contentJustify')
  );
}
for (const key of ['horizontalGap', 'verticalGap'])
  field(TileLayout.prototype, key, 6, n => Number.isFinite(n) && n >= 0);
field(TileLayout.prototype, 'requestedColumnCount', 0, n => Number.isSafeInteger(n) && n >= 0);
field(TileLayout.prototype, 'orientation', 'rows', value => value === 'rows');

export const ScrollPolicy = Object.freeze({ AUTO: 'auto', OFF: 'off', ON: 'on' });
export function checkScrollPolicy(value) {
  if (!Object.values(ScrollPolicy).includes(value)) unsupported('Unknown EUI scroll policy.');
  return value;
}

export function layoutFromDescriptor(descriptor) {
  const Kind = { HorizontalLayout, VerticalLayout, TileLayout }[descriptor?.type];
  if (!Kind) return null;
  const layout = new Kind();
  Object.assign(layout, descriptor.properties);
  return layout;
}

export function bindLayout(layout, owner, invalidate) {
  const row = layouts.get(layout);
  if (!row || (row.owner && row.owner !== owner)) unsupported('Expected a layout belonging to this group only.');
  row.owner = owner;
  row.invalidate = invalidate;
  return row.descriptor;
}
export function releaseLayout(layout, owner) {
  const row = layouts.get(layout);
  if (row?.owner === owner) {
    row.owner = undefined;
    row.invalidate = undefined;
  }
}
