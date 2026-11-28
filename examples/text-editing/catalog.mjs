// SPDX-License-Identifier: Apache-2.0
import { createUiTheme } from '@egret/engine/ui';
import { createUiListSemantics, createUiSemantics } from '@egret/engine/ui/semantics';
import { createBrowserSemantics } from '@egret/engine/web/semantics';

// Keep the two editable records well inside the catalogue so index zero cannot
// accidentally satisfy anchor preservation after a height change.
const firstField = 25002;
const heights = [40, 52, 64];
const records = Array.from({ length: 50000 }, (_, index) => ({
  key: 'note-' + index,
  value: 'note-' + index,
  estimatedHeight: heights[index % heights.length],
  contentVersion: 1
}));

export const catalog = {
  initialScrollOffset: (firstField - 3) * 52 + 7,
  rowHeight: index => heights[index % heights.length],
  records(fields) {
    const result = records.slice();
    for (const [index, key] of ['name', 'description'].entries()) {
      result[firstField + index] = {
        key,
        value: key,
        estimatedHeight: key === 'name' ? 48 : 112,
        contentVersion: fields.get(key).content.revision
      };
    }
    return result;
  },
  roomyTheme: createUiTheme({
    id: 'reading',
    colors: { row: 0x3a5060 },
    typography: { fields: { fontFamily: 'Noto Sans', fontSize: 24, lineHeight: 46 } }
  }),
  project(root, canvas, size) {
    const semantics = createUiSemantics({ maxNodes: 13 });
    const rows = createUiListSemantics({
      semantics,
      root,
      list: 'fields',
      id: 'catalog',
      role: 'list',
      name: 'Catalogue',
      focusable: true,
      describeRow: key => ({ name: key })
    });
    const surface = createBrowserSemantics({ semantics, canvas, width: size.width, height: size.height });
    return {
      sync: () => semantics.publish(rows.sync()),
      snapshot: () => semantics.snapshot,
      dispose() {
        surface.dispose();
        rows.dispose();
        semantics.dispose();
      }
    };
  }
};
