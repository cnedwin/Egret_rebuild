// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import type { SemanticBounds, SemanticNode, UiSemantics } from './semanticTypes.js';

/**
 * The rows of a managed virtual list, as nodes of a semantic tree.
 *
 * A virtual list realizes the rows that show and recycles the rest, so its nodes come and go with
 * every commit. This keeps one node for the list and one for each row that shows, reads their
 * places from what the root committed, and reports each row's position in the whole set of
 * records. It reads the root; it changes nothing in it but the focus a row is asked to take.
 */

/** What is read of a managed UI root. The root `createUiRoot` returns is one. */
export interface SemanticListSource {
  readonly id: string;
  snapshot(): {
    readonly committedRevision: number;
    readonly origin: { readonly x: number; readonly y: number };
    readonly boxes: readonly { readonly id: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number }[];
  };
  list(id: string): {
    snapshot(): {
      readonly rows: readonly { readonly key: string; readonly index: number; readonly visible: boolean; readonly box: SemanticBounds }[];
      readonly counters: { readonly recordCount: number };
    };
    getFocus(): { readonly key: string | undefined };
    focus(key: string | undefined, options?: { readonly visible?: boolean }): void;
  };
}

export interface SemanticListRow {
  /** What the row is called. An option and a menu item need a name; a list item may leave it to the nodes inside it. */
  readonly name?: string;
  /** Options, where one that does not say is not selected, and the rows of a grid and the items of a tree, where saying it means that they are what is selected. */
  readonly selected?: boolean;
  /** Options, menu items, the rows of a grid and the items of a tree. */
  readonly disabled?: boolean;
  /** The items of a tree, which need it: how deep the item is, from one. */
  readonly level?: number;
  /** The items of a tree: whether what is under the item shows. One with nothing under it does not say. */
  readonly expanded?: boolean;
  /** The items of a tree: where the item stands among those under the same item, which is not where its row stands in the list. */
  readonly position?: { readonly index: number; readonly size: number };
}

export interface UiListSemanticsOptions {
  readonly semantics: UiSemantics;
  readonly root: SemanticListSource;
  /** The id of the virtual list in the tree of the root. */
  readonly list: string;
  /** The id of the list node. Defaults to the id of the root, a slash, and the id of the list. A row adds a slash and its key. */
  readonly id?: string;
  /** The node the list is inside. */
  readonly parent?: string;
  /**
   * A 'list' of list items, which may hold other nodes, a 'listbox' of options, a 'menu' of menu items, a 'grid'
   * whose rows are the rows of the list and hold the cells the application adds, or a 'tree' whose items are the
   * rows that show, each at the depth it says. Defaults to 'list'.
   */
  readonly role?: 'list' | 'listbox' | 'menu' | 'grid' | 'tree';
  readonly name?: string;
  /** A list box, a grid or a tree only: several of its options, rows or items may be selected at once. Each still says whether it is. Defaults to false. */
  readonly multiple?: boolean;
  /** A grid only, which needs it: how many columns it has. */
  readonly columns?: number;
  /** A grid only: how many rows the application publishes above the first row of the list, such as a row of headers. Defaults to 0. */
  readonly rowOffset?: number;
  /**
   * Read at each publication. A list that says it is hidden is left out with its rows: the list of a
   * popup or a modal layer while that layer is closed. Its rows are then not asked.
   */
  readonly hidden?: () => boolean;
  /** Read at each publication for each row that shows. */
  readonly describeRow?: (key: string, index: number) => SemanticListRow;
  /** The activation of a row, the one a press or a key on it reaches. Without it a row cannot be activated. */
  readonly onActivateRow?: (key: string) => void;
  /** Whether a row may be asked to take the keyboard focus. The root then needs a keyboard. Defaults to false. */
  readonly focusable?: boolean;
  /** Called after the node of a row was added, so that nodes inside it can be added under `id`. They go with the row. */
  readonly onRowAdded?: (key: string, id: string) => void;
}

export interface UiListSemantics {
  readonly id: string;
  /** The id of the node of a row, whether or not the row shows now. */
  rowId(key: string): string;
  /** The part of a row that the list shows, on the stage, as of the last synchronization: what a cell inside it is measured from. Nothing for a row that does not show. */
  rowBounds(key: string): SemanticBounds | undefined;
  /**
   * Brings the nodes to the rows of the last commit: removes those that no longer show, moves those
   * that stayed, adds those that show now. Returns the committed revision, which is what `publish`
   * takes. When the tree refuses a new row, none of the new rows is added and the refusal is thrown.
   */
  sync(): number;
  /** Removes the list node and every row. */
  dispose(): void;
}

interface Row { readonly node: SemanticNode; index: number; box: SemanticBounds; }

/**
 * The rectangle on the stage of a box a managed UI root laid out: a leaf, a row, a column or a
 * list, by its id in the tree of the root. It is read from the last commit when it is called, so
 * call it from `describe`. A box the root has not laid out has no size, at the origin of the root.
 */
export function semanticBoxOf(root: Pick<SemanticListSource, 'snapshot'>, id: string): SemanticBounds {
  if (root === null || typeof root !== 'object' || typeof root.snapshot !== 'function' || !text(id)) throw new EgretError('UI_SEMANTICS_OPTIONS');
  const { origin, boxes } = root.snapshot(), box = boxes.find(candidate => candidate.id === id);
  return Object.freeze(box === undefined ? { x: origin.x, y: origin.y, width: 0, height: 0 } : { x: origin.x + box.x, y: origin.y + box.y, width: box.width, height: box.height });
}

const text = (value: unknown): value is string => typeof value === 'string' && value.length >= 1 && value.length <= 128 && !value.includes('\0');
const optional = (value: unknown, type: string): boolean => value === undefined || typeof value === type;

export function createUiListSemantics(options: UiListSemanticsOptions): UiListSemantics {
  if (options === null || typeof options !== 'object') throw new EgretError('UI_SEMANTICS_OPTIONS');
  const { semantics, root, list, parent, role = 'list', name, multiple, columns, rowOffset = 0, hidden, describeRow, onActivateRow, focusable = false, onRowAdded } = options;
  if (semantics === null || typeof semantics !== 'object' || typeof semantics.add !== 'function' || root === null || typeof root !== 'object' || typeof root.snapshot !== 'function'
    || typeof root.list !== 'function' || !text(list) || (role !== 'list' && role !== 'listbox' && role !== 'menu' && role !== 'grid' && role !== 'tree') || !optional(name, 'string') || !optional(parent, 'string')
    || !optional(hidden, 'function') || !optional(describeRow, 'function') || !optional(onActivateRow, 'function') || !optional(onRowAdded, 'function') || typeof focusable !== 'boolean'
    // An option and a menu item are read as one thing and need a name of their own.
    || ((role === 'listbox' || role === 'menu' || role === 'tree') && describeRow === undefined)
    // Only a list box, a grid and a tree have a selection for there to be several of.
    || !optional(multiple, 'boolean') || (multiple !== undefined && role !== 'listbox' && role !== 'grid' && role !== 'tree')
    // A grid says how many columns it has, and nothing else has columns or rows above its own.
    || (role === 'grid' ? !Number.isSafeInteger(columns) || columns! < 1 || !Number.isSafeInteger(rowOffset) || rowOffset < 0 : columns !== undefined || options.rowOffset !== undefined)) throw new EgretError('UI_SEMANTICS_OPTIONS');
  const id = options.id ?? root.id + '/' + list;
  if (!text(id)) throw new EgretError('UI_SEMANTICS_OPTIONS');
  const handle = root.list(list), rows = new Map<string, Row>();
  let closed = false, size = 0;
  /** The rectangle of the list on the stage, as of the last synchronization. Rows are cut to it. */
  let frame: SemanticBounds = { x: 0, y: 0, width: 0, height: 0 };
  const rowId = (key: string): string => id + '/' + key;
  /** The part of a row that the list shows. */
  function visiblePart(box: SemanticBounds): SemanticBounds {
    const x = Math.max(box.x, frame.x), y = Math.max(box.y, frame.y);
    return { x, y, width: Math.max(0, Math.min(box.x + box.width, frame.x + frame.width) - x), height: Math.max(0, Math.min(box.y + box.height, frame.y + frame.height) - y) };
  }
  const node = semantics.add({ id, role, ...(parent === undefined ? {} : { parent }), describe: () => ({ bounds: frame, ...(name === undefined ? {} : { name }), ...(hidden === undefined ? {} : { hidden: hidden() }), ...(multiple === true ? { multiple } : {}),
    // A grid with no row at all has no extent to speak of.
    ...(role === 'grid' && size + rowOffset > 0 ? { extent: { rows: size + rowOffset, columns: columns! } } : {}) }) });

  function addRow(key: string, index: number, box: SemanticBounds): Row {
    const row: Row = { index, box, node: semantics.add({
      id: rowId(key), role: role === 'list' ? 'listitem' : role === 'listbox' ? 'option' : role === 'menu' ? 'menuitem' : role === 'grid' ? 'row' : 'treeitem', parent: id,
      describe: () => {
        const described = describeRow?.(key, row.index) ?? {};
        return { ...described, ...(role === 'listbox' ? { selected: described.selected ?? false } : {}), bounds: visiblePart(row.box),
          // The place of an item of a tree is among the items under the same item, which only the application knows.
          ...(role === 'tree' ? {} : { position: { index: row.index + 1 + rowOffset, size: size + rowOffset } }), focused: handle.getFocus().key === key, order: row.index };
      },
      ...(onActivateRow === undefined ? {} : { onActivate: () => onActivateRow(key) }),
      ...(focusable ? { onFocus: () => handle.focus(key, { visible: true }) } : {}),
    }) };
    return row;
  }

  function sync(): number {
    if (closed) throw new EgretError('UI_SEMANTICS_CLOSED');
    const { committedRevision, origin } = root.snapshot(), listed = handle.snapshot();
    const placed = (inner: SemanticBounds): SemanticBounds => ({ x: origin.x + inner.x, y: origin.y + inner.y, width: inner.width, height: inner.height });
    const showing = listed.rows.filter(row => row.visible), keys = new Set(showing.map(row => row.key)), added = new Map<string, Row>();
    // The rows that left go first, so that the tree never needs room for the old rows and the new ones together.
    for (const [key, row] of rows) if (!keys.has(key)) { row.node.remove(); rows.delete(key); }
    for (const { key, index, box: inner } of showing) { const known = rows.get(key); if (known !== undefined) { known.index = index; known.box = placed(inner); } }
    size = listed.counters.recordCount;
    // A list that is not laid out has no place, and its rows have no part that shows.
    frame = semanticBoxOf(root, list);
    try {
      for (const { key, index, box: inner } of showing) if (!rows.has(key)) added.set(key, addRow(key, index, placed(inner)));
    } catch (cause) {
      // None of the new rows is kept. What stays in the tree is true of this commit: only the new rows are missing from it.
      for (const row of added.values()) row.node.remove();
      throw cause;
    }
    for (const [key, row] of added) { rows.set(key, row); onRowAdded?.(key, rowId(key)); }
    return committedRevision;
  }

  return Object.freeze({
    id, rowId, sync,
    rowBounds(key: string): SemanticBounds | undefined { const row = rows.get(key); return row === undefined ? undefined : Object.freeze(visiblePart(row.box)); },
    dispose() {
      if (closed) return;
      closed = true;
      rows.clear();
      node.remove();
    },
  });
}
