// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
/**
 * The rectangle on the stage of a box a managed UI root laid out: a leaf, a row, a column or a
 * list, by its id in the tree of the root. It is read from the last commit when it is called, so
 * call it from `describe`. A box the root has not laid out has no size, at the origin of the root.
 */
export function semanticBoxOf(root, id) {
    if (root === null || typeof root !== 'object' || typeof root.snapshot !== 'function' || !text(id))
        throw new EgretError('UI_SEMANTICS_OPTIONS');
    const { origin, boxes } = root.snapshot(), box = boxes.find(candidate => candidate.id === id);
    return Object.freeze(box === undefined
        ? { x: origin.x, y: origin.y, width: 0, height: 0 }
        : { x: origin.x + box.x, y: origin.y + box.y, width: box.width, height: box.height });
}
const text = (value) => typeof value === 'string' && value.length >= 1 && value.length <= 128 && !value.includes('\0');
const optional = (value, type) => value === undefined || typeof value === type;
export function createUiListSemantics(options) {
    if (options === null || typeof options !== 'object')
        throw new EgretError('UI_SEMANTICS_OPTIONS');
    const { semantics, root, list, parent, role = 'list', name, multiple, columns, rowOffset = 0, hidden, describeRow, onActivateRow, focusable = false, onRowAdded } = options;
    if (semantics === null ||
        typeof semantics !== 'object' ||
        typeof semantics.add !== 'function' ||
        root === null ||
        typeof root !== 'object' ||
        typeof root.snapshot !== 'function' ||
        typeof root.list !== 'function' ||
        !text(list) ||
        (role !== 'list' && role !== 'listbox' && role !== 'menu' && role !== 'grid' && role !== 'tree') ||
        !optional(name, 'string') ||
        !optional(parent, 'string') ||
        !optional(hidden, 'function') ||
        !optional(describeRow, 'function') ||
        !optional(onActivateRow, 'function') ||
        !optional(onRowAdded, 'function') ||
        typeof focusable !== 'boolean' ||
        // An option and a menu item are read as one thing and need a name of their own.
        ((role === 'listbox' || role === 'menu' || role === 'tree') && describeRow === undefined) ||
        // Only a list box, a grid and a tree have a selection for there to be several of.
        !optional(multiple, 'boolean') ||
        (multiple !== undefined && role !== 'listbox' && role !== 'grid' && role !== 'tree') ||
        // A grid says how many columns it has, and nothing else has columns or rows above its own.
        (role === 'grid'
            ? !Number.isSafeInteger(columns) || columns < 1 || !Number.isSafeInteger(rowOffset) || rowOffset < 0
            : columns !== undefined || options.rowOffset !== undefined))
        throw new EgretError('UI_SEMANTICS_OPTIONS');
    const id = options.id ?? root.id + '/' + list;
    if (!text(id))
        throw new EgretError('UI_SEMANTICS_OPTIONS');
    const handle = root.list(list), rows = new Map();
    let closed = false, size = 0;
    /** The rectangle of the list on the stage, as of the last synchronization. Rows are cut to it. */
    let frame = { x: 0, y: 0, width: 0, height: 0 };
    const rowId = (key) => id + '/' + key;
    /** The part of a row that the list shows. */
    function visiblePart(box) {
        const x = Math.max(box.x, frame.x), y = Math.max(box.y, frame.y);
        return {
            x,
            y,
            width: Math.max(0, Math.min(box.x + box.width, frame.x + frame.width) - x),
            height: Math.max(0, Math.min(box.y + box.height, frame.y + frame.height) - y)
        };
    }
    const node = semantics.add({
        id,
        role,
        ...(parent === undefined ? {} : { parent }),
        describe: () => ({
            bounds: frame,
            ...(name === undefined ? {} : { name }),
            ...(hidden === undefined ? {} : { hidden: hidden() }),
            ...(multiple === true ? { multiple } : {}),
            // A grid with no row at all has no extent to speak of.
            ...(role === 'grid' && size + rowOffset > 0 ? { extent: { rows: size + rowOffset, columns: columns } } : {})
        })
    });
    function addRow(key, index, box) {
        const row = {
            index,
            box,
            node: semantics.add({
                id: rowId(key),
                role: role === 'list'
                    ? 'listitem'
                    : role === 'listbox'
                        ? 'option'
                        : role === 'menu'
                            ? 'menuitem'
                            : role === 'grid'
                                ? 'row'
                                : 'treeitem',
                parent: id,
                describe: () => {
                    const described = describeRow?.(key, row.index) ?? {};
                    return {
                        ...described,
                        ...(role === 'listbox' ? { selected: described.selected ?? false } : {}),
                        bounds: visiblePart(row.box),
                        // The place of an item of a tree is among the items under the same item, which only the application knows.
                        ...(role === 'tree' ? {} : { position: { index: row.index + 1 + rowOffset, size: size + rowOffset } }),
                        focused: handle.getFocus().key === key,
                        order: row.index
                    };
                },
                ...(onActivateRow === undefined ? {} : { onActivate: () => onActivateRow(key) }),
                ...(focusable ? { onFocus: () => handle.focus(key, { visible: true }) } : {})
            })
        };
        return row;
    }
    function sync() {
        if (closed)
            throw new EgretError('UI_SEMANTICS_CLOSED');
        const { committedRevision, origin } = root.snapshot(), listed = handle.snapshot();
        const placed = (inner) => ({
            x: origin.x + inner.x,
            y: origin.y + inner.y,
            width: inner.width,
            height: inner.height
        });
        const showing = listed.rows.filter(row => row.visible), keys = new Set(showing.map(row => row.key)), added = new Map();
        // The rows that left go first, so that the tree never needs room for the old rows and the new ones together.
        for (const [key, row] of rows)
            if (!keys.has(key)) {
                row.node.remove();
                rows.delete(key);
            }
        for (const { key, index, box: inner } of showing) {
            const known = rows.get(key);
            if (known !== undefined) {
                known.index = index;
                known.box = placed(inner);
            }
        }
        size = listed.counters.recordCount;
        // A list that is not laid out has no place, and its rows have no part that shows.
        frame = semanticBoxOf(root, list);
        try {
            for (const { key, index, box: inner } of showing)
                if (!rows.has(key))
                    added.set(key, addRow(key, index, placed(inner)));
        }
        catch (cause) {
            // None of the new rows is kept. What stays in the tree is true of this commit: only the new rows are missing from it.
            for (const row of added.values())
                row.node.remove();
            throw cause;
        }
        for (const [key, row] of added) {
            rows.set(key, row);
            onRowAdded?.(key, rowId(key));
        }
        return committedRevision;
    }
    return Object.freeze({
        id,
        rowId,
        sync,
        rowBounds(key) {
            const row = rows.get(key);
            return row === undefined ? undefined : Object.freeze(visiblePart(row.box));
        },
        dispose() {
            if (closed)
                return;
            closed = true;
            rows.clear();
            node.remove();
        }
    });
}
//# sourceMappingURL=semanticList.js.map