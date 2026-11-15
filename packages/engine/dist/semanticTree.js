// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
const rules = Object.freeze({
    group: { leaf: false, named: false, fields: ['disabled'] },
    image: { leaf: true, named: true, fields: [] },
    text: { leaf: true, named: true, fields: [] },
    button: { leaf: true, named: true, fields: ['disabled', 'expanded'] },
    checkbox: { leaf: true, named: true, fields: ['disabled', 'checked'] },
    switch: { leaf: true, named: true, fields: ['disabled', 'checked'] },
    radiogroup: { leaf: false, named: false, fields: ['disabled'] },
    radio: { leaf: true, named: true, inside: 'radiogroup', fields: ['disabled', 'checked', 'position'] },
    listbox: { leaf: false, named: false, fields: ['disabled', 'multiple'] },
    option: { leaf: true, named: true, inside: 'listbox', fields: ['disabled', 'selected', 'position'] },
    list: { leaf: false, named: false, fields: [] },
    listitem: { leaf: false, named: false, inside: 'list', fields: ['position'] },
    scrollbar: { leaf: true, named: true, fields: ['disabled', 'range', 'orientation', 'controls'] },
    slider: { leaf: true, named: true, fields: ['disabled', 'range', 'orientation'] },
    spinbutton: { leaf: true, named: true, fields: ['disabled', 'range'] },
    progressbar: { leaf: true, named: true, fields: ['range'] },
    tablist: { leaf: false, named: false, fields: ['disabled', 'orientation'] },
    tab: { leaf: true, named: true, inside: 'tablist', fields: ['disabled', 'selected', 'position', 'controls'] },
    tabpanel: { leaf: false, named: true, fields: [] },
    menu: { leaf: false, named: false, fields: ['disabled', 'orientation'] },
    menuitem: { leaf: true, named: true, inside: 'menu', fields: ['disabled', 'position'] },
    dialog: { leaf: false, named: true, fields: ['modal'] },
    textbox: { leaf: true, named: true, fields: ['disabled', 'value', 'multiline'] },
    // A message that is said when it changes. Its name is the message, and it is there, empty, before the first one.
    status: { leaf: true, named: false, fields: [] },
    alert: { leaf: true, named: false, fields: [] },
    // Cells in rows and columns. A row is which row it is, and a cell which column it is in.
    grid: { leaf: false, named: false, fields: ['disabled', 'multiple', 'extent'] },
    // Rows are what is selected in a table, and cells in a board: either says so where it is the one.
    row: { leaf: false, named: false, inside: 'grid', fields: ['disabled', 'selected', 'position'], loose: ['selected'] },
    gridcell: {
        leaf: true,
        named: true,
        inside: 'row',
        fields: ['disabled', 'selected', 'position'],
        loose: ['selected']
    },
    columnheader: { leaf: true, named: true, inside: 'row', fields: ['disabled', 'position', 'sort'] },
    // The items of a tree are all inside the tree itself: how deep one is, is said by its level, so that the items of a list can be a tree.
    tree: { leaf: false, named: false, fields: ['disabled', 'multiple'] },
    treeitem: {
        leaf: true,
        named: true,
        inside: 'tree',
        fields: ['disabled', 'selected', 'expanded', 'position', 'level'],
        loose: ['selected']
    },
    heading: { leaf: true, named: true, fields: ['level'] }
});
/** State that belongs to some roles only. A description that sets one its role does not have is refused. */
const particular = [
    'disabled',
    'checked',
    'selected',
    'expanded',
    'modal',
    'multiline',
    'multiple',
    'extent',
    'sort',
    'level',
    'range',
    'orientation',
    'controls',
    'position',
    'value'
];
const offers = Object.freeze({
    '': Object.freeze([]),
    a: Object.freeze(['activate']),
    f: Object.freeze(['focus']),
    af: Object.freeze(['activate', 'focus'])
});
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const flag = (value) => value === undefined || typeof value === 'boolean';
const identifier = (value) => typeof value === 'string' && value.length >= 1 && value.length <= 128 && !value.includes('\0');
function sameNode(a, b) {
    return (a.id === b.id &&
        a.role === b.role &&
        a.parent === b.parent &&
        a.name === b.name &&
        a.disabled === b.disabled &&
        a.focused === b.focused &&
        a.inert === b.inert &&
        a.actions === b.actions &&
        a.value === b.value &&
        a.checked === b.checked &&
        a.selected === b.selected &&
        a.expanded === b.expanded &&
        a.modal === b.modal &&
        a.multiline === b.multiline &&
        a.multiple === b.multiple &&
        a.orientation === b.orientation &&
        a.controls === b.controls &&
        a.bounds.x === b.bounds.x &&
        a.bounds.y === b.bounds.y &&
        a.bounds.width === b.bounds.width &&
        a.bounds.height === b.bounds.height &&
        a.range?.now === b.range?.now &&
        a.range?.min === b.range?.min &&
        a.range?.max === b.range?.max &&
        a.position?.index === b.position?.index &&
        a.position?.size === b.position?.size &&
        a.extent?.rows === b.extent?.rows &&
        a.extent?.columns === b.extent?.columns &&
        a.sort === b.sort &&
        a.level === b.level);
}
/**
 * The rectangle on the stage that encloses a display object and what it holds, for the bounds of
 * a node. It is measured when it is called, so call it from `describe`.
 */
export function semanticBoundsOf(target) {
    const local = target.getBounds(), right = local.x + local.width, bottom = local.y + local.height;
    const corners = [
        target.localToGlobal(local.x, local.y),
        target.localToGlobal(right, local.y),
        target.localToGlobal(right, bottom),
        target.localToGlobal(local.x, bottom)
    ];
    const xs = corners.map(point => point.x), ys = corners.map(point => point.y), x = Math.min(...xs), y = Math.min(...ys);
    return Object.freeze({ x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y });
}
/** A semantic tree for the controls an application draws. It reads them; it holds no state of theirs. */
export function createUiSemantics(options = {}) {
    if (options === null || typeof options !== 'object' || Array.isArray(options))
        throw new EgretError('UI_SEMANTICS_OPTIONS');
    const maxNodes = options.maxNodes ?? 256;
    if (!Number.isInteger(maxNodes) || maxNodes < 1 || maxNodes > 4096)
        throw new EgretError('UI_SEMANTICS_OPTIONS');
    const entries = new Map(), roots = [];
    const listeners = new Set(), closers = new Set();
    let snapshot = Object.freeze({
        revision: 0,
        layoutRevision: undefined,
        nodes: Object.freeze([]),
        focused: undefined
    });
    /** The entry each published node was read from: an id may since have been removed and used again. */
    let published = new Map();
    let state = 'active', publishing = false, telling = false;
    function open() {
        if (state === 'closed')
            throw new EgretError('UI_SEMANTICS_CLOSED');
        if (publishing)
            throw new EgretError('UI_SEMANTICS_REENTRANT');
    }
    function detach(entry) {
        entry.attached = false;
        entries.delete(entry.id);
        for (const child of entry.children.splice(0))
            detach(child);
    }
    function add(node) {
        open();
        if (node === null || typeof node !== 'object')
            throw new EgretError('UI_SEMANTICS_OPTIONS');
        const { id, role, parent: parentId, describe, onActivate, onFocus } = node;
        if (!identifier(id) ||
            typeof role !== 'string' ||
            !Object.hasOwn(rules, role) ||
            typeof describe !== 'function' ||
            (parentId !== undefined && !identifier(parentId)) ||
            (onActivate !== undefined && typeof onActivate !== 'function') ||
            (onFocus !== undefined && typeof onFocus !== 'function'))
            throw new EgretError('UI_SEMANTICS_OPTIONS');
        if (entries.has(id))
            throw new EgretError('UI_SEMANTICS_DUPLICATE');
        const parent = parentId === undefined ? undefined : entries.get(parentId), rule = rules[role];
        // A leaf is read as one thing, and a radio, an option or a list item means nothing outside its container.
        if ((parentId !== undefined && parent === undefined) ||
            (parent !== undefined && rules[parent.role].leaf) ||
            (rule.inside !== undefined && parent?.role !== rule.inside))
            throw new EgretError('UI_SEMANTICS_PARENT');
        if (entries.size >= maxNodes)
            throw new EgretError('UI_SEMANTICS_CAPACITY');
        const entry = {
            id,
            role,
            parent,
            children: [],
            describe,
            onActivate,
            onFocus,
            attached: true,
            handle: Object.freeze({
                id,
                role,
                parent: parentId,
                get attached() {
                    return entry.attached;
                },
                remove() {
                    if (!entry.attached)
                        return;
                    if (publishing)
                        throw new EgretError('UI_SEMANTICS_REENTRANT');
                    const siblings = entry.parent === undefined ? roots : entry.parent.children, index = siblings.indexOf(entry);
                    if (index >= 0)
                        siblings.splice(index, 1);
                    detach(entry);
                }
            })
        };
        entries.set(id, entry);
        (parent === undefined ? roots : parent.children).push(entry);
        return entry.handle;
    }
    /** One description, checked against its role. Undefined for a hidden node. */
    function read(entry) {
        let described;
        try {
            described = entry.describe();
        }
        catch (cause) {
            throw new EgretError('UI_SEMANTICS_DESCRIBE_FAILED', { cause });
        }
        const refuse = (field) => new EgretError('UI_SEMANTICS_DESCRIPTION', { cause: new TypeError(entry.id + ': ' + field) });
        if (described === null || typeof described !== 'object' || Array.isArray(described))
            throw refuse('description');
        const rule = rules[entry.role];
        const { bounds, name = '', hidden, focused, order = 0, disabled, checked, selected, expanded, modal, multiline, multiple, extent, sort, level, range, orientation, controls, position, value } = described;
        if (!flag(hidden))
            throw refuse('hidden');
        if (hidden === true)
            return undefined;
        for (const field of particular)
            if (described[field] !== undefined && !rule.fields.includes(field))
                throw refuse(field);
        if (bounds === null ||
            typeof bounds !== 'object' ||
            !finite(bounds.x) ||
            !finite(bounds.y) ||
            !finite(bounds.width) ||
            !finite(bounds.height) ||
            bounds.width < 0 ||
            bounds.height < 0)
            throw refuse('bounds');
        if (typeof name !== 'string' || name.length > 1024 || (rule.named && !/\S/.test(name)))
            throw refuse('name');
        if (!flag(focused))
            throw refuse('focused');
        if (!finite(order))
            throw refuse('order');
        if (!flag(disabled))
            throw refuse('disabled');
        if (!flag(expanded))
            throw refuse('expanded');
        if (!flag(modal))
            throw refuse('modal');
        if (!flag(multiline))
            throw refuse('multiline');
        if (!flag(multiple))
            throw refuse('multiple');
        const checkable = rule.fields.includes('checked');
        if (checkable
            ? typeof checked !== 'boolean' && !(checked === 'mixed' && entry.role === 'checkbox')
            : checked !== undefined)
            throw refuse('checked');
        if (rule.fields.includes('selected')
            ? typeof selected !== 'boolean' && !(selected === undefined && rule.loose?.includes('selected') === true)
            : selected !== undefined)
            throw refuse('selected');
        if (sort !== undefined && sort !== 'ascending' && sort !== 'descending' && sort !== 'none')
            throw refuse('sort');
        // An item of a tree is at some depth. A heading has one of six ranks, or does not say.
        if (entry.role === 'treeitem' || level !== undefined
            ? !Number.isSafeInteger(level) || level < 1 || (entry.role === 'heading' && level > 6)
            : false)
            throw refuse('level');
        if (value !== undefined && (typeof value !== 'string' || value.length > 16384))
            throw refuse('value');
        // A scroll bar, a slider and a spin button are somewhere in their range. A progress bar without one shows work of unknown length.
        const ranged = entry.role === 'scrollbar' || entry.role === 'slider' || entry.role === 'spinbutton';
        if (ranged || range !== undefined
            ? range === null ||
                typeof range !== 'object' ||
                !finite(range.now) ||
                !finite(range.min) ||
                !finite(range.max) ||
                range.min > range.now ||
                range.now > range.max
            : false)
            throw refuse('range');
        if (extent !== undefined &&
            (extent === null ||
                typeof extent !== 'object' ||
                !Number.isSafeInteger(extent.rows) ||
                !Number.isSafeInteger(extent.columns) ||
                extent.rows < 1 ||
                extent.columns < 1))
            throw refuse('extent');
        if (orientation !== undefined && orientation !== 'horizontal' && orientation !== 'vertical')
            throw refuse('orientation');
        if (controls !== undefined && (!identifier(controls) || controls === entry.id))
            throw refuse('controls');
        if (position !== undefined &&
            (position === null ||
                typeof position !== 'object' ||
                !Number.isSafeInteger(position.index) ||
                !Number.isSafeInteger(position.size) ||
                position.index < 1 ||
                position.index > position.size))
            throw refuse('position');
        return {
            entry,
            order,
            node: {
                id: entry.id,
                role: entry.role,
                parent: entry.parent?.id,
                name,
                bounds: Object.freeze({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }),
                disabled: disabled === true,
                focused: focused === true,
                actions: offers[(entry.onActivate === undefined ? '' : 'a') + (entry.onFocus === undefined ? '' : 'f')],
                value: entry.role === 'textbox' ? (value ?? '') : undefined,
                checked: checked,
                selected,
                expanded,
                modal: entry.role === 'dialog' ? modal === true : undefined,
                multiline: entry.role === 'textbox' ? multiline === true : undefined,
                multiple: rule.fields.includes('multiple') ? multiple === true : undefined,
                extent: extent === undefined
                    ? undefined
                    : Object.freeze({ rows: extent.rows, columns: extent.columns }),
                sort: sort,
                level,
                range: range === undefined
                    ? undefined
                    : Object.freeze({ now: range.now, min: range.min, max: range.max }),
                // A scroll bar stands beside what it scrolls and a menu lists its items downward; a slider and a row of tabs lie along the line they are read in.
                orientation: rule.fields.includes('orientation')
                    ? (orientation ??
                        (entry.role === 'scrollbar' || entry.role === 'menu' ? 'vertical' : 'horizontal'))
                    : undefined,
                controls,
                position: position === undefined
                    ? undefined
                    : Object.freeze({ index: position.index, size: position.size })
            }
        };
    }
    function collect(siblings, into) {
        const drafts = [];
        // A snapshot of the list: a description may not change the tree, and is refused if it tries.
        for (const entry of [...siblings]) {
            const draft = read(entry);
            if (draft !== undefined)
                drafts.push(draft);
        }
        // The sort is stable: nodes of equal order stay in the order they were added.
        drafts.sort((a, b) => a.order - b.order);
        for (const draft of drafts) {
            into.push(draft);
            collect(draft.entry.children, into);
        }
    }
    function publish(layoutRevision) {
        open();
        if (telling)
            throw new EgretError('UI_SEMANTICS_REENTRANT');
        if (layoutRevision !== undefined &&
            (!Number.isSafeInteger(layoutRevision) ||
                layoutRevision < 0 ||
                (snapshot.layoutRevision !== undefined && layoutRevision < snapshot.layoutRevision)))
            throw new EgretError('UI_SEMANTICS_REVISION');
        const drafts = [];
        publishing = true;
        try {
            collect(roots, drafts);
        }
        finally {
            publishing = false;
        }
        const present = new Map(drafts.map(draft => [draft.entry.id, draft]));
        // The modal dialog read last is the one in front. It, what is inside it and what it is inside stay live.
        let modal;
        for (const draft of drafts)
            if (draft.node.modal === true)
                modal = draft;
        const live = new Set();
        for (let entry = modal?.entry; entry !== undefined; entry = entry.parent)
            live.add(entry);
        const within = (entry) => {
            for (let at = entry; at !== undefined; at = at.parent)
                if (at === modal.entry)
                    return true;
            return false;
        };
        const next = new Map(), nodes = [];
        let focused, changed = drafts.length !== snapshot.nodes.length || layoutRevision !== snapshot.layoutRevision;
        for (const [index, draft] of drafts.entries()) {
            const inert = modal !== undefined && !live.has(draft.entry) && !within(draft.entry);
            if (draft.node.controls !== undefined && !present.has(draft.node.controls))
                throw new EgretError('UI_SEMANTICS_RELATION', { cause: new TypeError(draft.entry.id + ': controls') });
            if (draft.node.focused) {
                // One node holds the focus, and never one a modal dialog has made inert.
                if (focused !== undefined || inert)
                    throw new EgretError('UI_SEMANTICS_FOCUS', { cause: new TypeError(draft.entry.id + ': focused') });
                focused = draft.entry.id;
            }
            const fresh = { ...draft.node, inert }, before = snapshot.nodes[index];
            const node = before !== undefined && sameNode(before, fresh) ? before : Object.freeze(fresh);
            if (node !== before)
                changed = true;
            nodes.push(node);
            next.set(node.id, { node, entry: draft.entry });
        }
        published = next;
        if (!changed)
            return snapshot;
        if (!Number.isSafeInteger(snapshot.revision + 1))
            throw new EgretError('UI_SEMANTICS_EXHAUSTED');
        const previous = snapshot;
        snapshot = Object.freeze({ revision: previous.revision + 1, layoutRevision, nodes: Object.freeze(nodes), focused });
        // Published before anyone is told: a listener that fails does not undo it.
        let first, failed = false;
        const rest = [];
        telling = true;
        try {
            for (const listener of [...listeners]) {
                if (state === 'closed')
                    break;
                if (listeners.has(listener))
                    try {
                        listener(snapshot, previous);
                    }
                    catch (cause) {
                        if (failed)
                            rest.push(cause);
                        else {
                            failed = true;
                            first = cause;
                        }
                    }
            }
        }
        finally {
            telling = false;
        }
        if (failed)
            throw new EgretError('UI_SEMANTICS_LISTENER_FAILED', { cause: first, cleanupErrors: rest });
        return snapshot;
    }
    function perform(id, action) {
        if (!identifier(id) || (action !== 'activate' && action !== 'focus'))
            throw new EgretError('UI_SEMANTICS_OPTIONS');
        if (state === 'closed')
            return false;
        if (publishing)
            throw new EgretError('UI_SEMANTICS_REENTRANT');
        const found = published.get(id);
        if (found === undefined || !found.entry.attached || found.node.disabled || found.node.inert)
            return false;
        const handler = action === 'activate' ? found.entry.onActivate : found.entry.onFocus;
        if (handler === undefined)
            return false;
        handler();
        return true;
    }
    function dispose() {
        if (state === 'closed')
            return;
        if (publishing)
            throw new EgretError('UI_SEMANTICS_REENTRANT');
        state = 'closed';
        for (const entry of roots.splice(0))
            detach(entry);
        published = new Map();
        listeners.clear();
        const callbacks = [...closers];
        closers.clear();
        let first, failed = false;
        const rest = [];
        for (const callback of callbacks)
            try {
                callback();
            }
            catch (cause) {
                if (failed)
                    rest.push(cause);
                else {
                    failed = true;
                    first = cause;
                }
            }
        if (failed)
            throw new EgretError('UI_SEMANTICS_CLEANUP_FAILED', { cause: first, cleanupErrors: rest });
    }
    return Object.freeze({
        get state() {
            return state;
        },
        get snapshot() {
            return snapshot;
        },
        get size() {
            return entries.size;
        },
        add,
        publish,
        perform,
        observe(listener) {
            if (typeof listener !== 'function')
                throw new EgretError('UI_SEMANTICS_OPTIONS');
            if (state === 'closed')
                return () => { };
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        onClose(listener) {
            if (typeof listener !== 'function')
                throw new EgretError('UI_SEMANTICS_OPTIONS');
            if (state === 'closed') {
                listener();
                return () => { };
            }
            closers.add(listener);
            return () => {
                closers.delete(listener);
            };
        },
        dispose
    });
}
//# sourceMappingURL=semanticTree.js.map