// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
/** Roles a native button carries well: it is activated by a click from any assistive technology. */
const pressable = [
    'button',
    'checkbox',
    'switch',
    'radio',
    'option',
    'tab',
    'menuitem',
    'gridcell',
    'columnheader',
    'treeitem'
];
const aria = {
    group: 'group',
    image: 'img',
    checkbox: 'checkbox',
    switch: 'switch',
    radiogroup: 'radiogroup',
    radio: 'radio',
    listbox: 'listbox',
    option: 'option',
    list: 'list',
    listitem: 'listitem',
    scrollbar: 'scrollbar',
    slider: 'slider',
    spinbutton: 'spinbutton',
    progressbar: 'progressbar',
    tablist: 'tablist',
    tab: 'tab',
    tabpanel: 'tabpanel',
    menu: 'menu',
    menuitem: 'menuitem',
    dialog: 'dialog',
    textbox: 'textbox',
    status: 'status',
    alert: 'alert',
    grid: 'grid',
    row: 'row',
    gridcell: 'gridcell',
    columnheader: 'columnheader',
    tree: 'tree',
    treeitem: 'treeitem',
    heading: 'heading'
};
/** Roles whose name is their content: a reader reads the text, and says a message when the text changes. */
const worded = ['text', 'status', 'alert', 'heading'];
const ownedSurfaces = new WeakSet();
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
let containers = 0;
/**
 * Projects a semantic tree to the page, for assistive technology. The canvas stays the one element
 * with the keyboard: it owns an invisible container of elements laid over it, one for each
 * published node, and names the focused one as its active descendant. Nothing here draws, and a
 * pointer goes through to the canvas.
 */
export function createBrowserSemantics(options) {
    if (options === null || typeof options !== 'object')
        throw new EgretError('UI_SEMANTICS_OPTIONS');
    const { semantics, canvas: surface, width, height, label, onError } = options;
    if (semantics === null ||
        typeof semantics !== 'object' ||
        typeof semantics.observe !== 'function' ||
        typeof semantics.perform !== 'function' ||
        surface === null ||
        typeof surface !== 'object' ||
        !finite(width) ||
        width <= 0 ||
        !finite(height) ||
        height <= 0 ||
        (label !== undefined && (typeof label !== 'string' || !/\S/.test(label) || label.length > 1024)) ||
        (onError !== undefined && typeof onError !== 'function'))
        throw new EgretError('UI_SEMANTICS_OPTIONS');
    if (semantics.state === 'closed')
        throw new EgretError('UI_SEMANTICS_CLOSED');
    const win = globalThis.window, page = globalThis.document;
    if (win === undefined || page === undefined || typeof win.getComputedStyle !== 'function')
        throw new EgretError('UI_SEMANTICS_SURFACE_INVALID');
    const projected = new Map(), identities = new WeakMap();
    const pairs = [], restores = [];
    let closed = false, owned, container, elements = 0, placed = '';
    function report(cause) {
        if (onError !== undefined)
            onError(cause);
        else if (typeof globalThis.reportError === 'function')
            globalThis.reportError(cause);
    }
    function cleanup() {
        if (closed)
            return;
        closed = true;
        const failures = [];
        const attempt = (action) => {
            try {
                action();
            }
            catch (cause) {
                failures.push(cause);
            }
        };
        for (const pair of pairs.splice(0).reverse())
            attempt(() => pair.target.removeEventListener(pair.type, pair.listener, pair.options));
        for (const restore of restores.splice(0).reverse())
            attempt(restore);
        attempt(() => container?.remove());
        projected.clear();
        if (owned !== undefined) {
            ownedSurfaces.delete(owned);
            owned = undefined;
        }
        for (const cause of failures)
            report(cause);
    }
    function fail(cause) {
        cleanup();
        report(cause);
    }
    /** The rectangle of the canvas on the page, refused unless one scale and one offset map it. */
    function profile() {
        if (typeof surface.getBoundingClientRect !== 'function' ||
            surface.ownerDocument !== page ||
            surface.isConnected !== true)
            throw new EgretError('UI_SEMANTICS_SURFACE_INVALID');
        let current = surface, depth = 0;
        while (current !== page) {
            if (current === null || current.nodeType !== 1 || ++depth > 64)
                throw new EgretError('UI_SEMANTICS_SURFACE_INVALID');
            const style = win.getComputedStyle(current), read = (name) => style.getPropertyValue(name).trim();
            if (['transform', 'perspective', 'translate', 'rotate', 'scale'].some(name => read(name) !== 'none'))
                throw new EgretError('UI_SEMANTICS_SURFACE_INVALID');
            const zoom = read('zoom');
            if (zoom !== 'normal' && zoom !== '1')
                throw new EgretError('UI_SEMANTICS_SURFACE_INVALID');
            current = current.parentNode;
        }
        const rect = measure(surface);
        if (rect.width <= 0 || rect.height <= 0)
            throw new EgretError('UI_SEMANTICS_SURFACE_INVALID');
        return rect;
    }
    function measure(element) {
        const rect = element.getBoundingClientRect();
        if (!finite(rect.left) || !finite(rect.top) || !finite(rect.width) || !finite(rect.height))
            throw new EgretError('UI_SEMANTICS_SURFACE_INVALID');
        return rect;
    }
    /** Lays the container over the canvas: logical units inside it, one scale to the page outside. */
    function place() {
        const rect = measure(surface);
        // A canvas the page is not showing has nothing over it to read, until it is shown again.
        if (rect.width <= 0 || rect.height <= 0) {
            if (placed !== 'display:none')
                container.style.cssText = placed = 'display:none';
            return;
        }
        const style = (left, top) => 'position:fixed;left:' +
            left +
            'px;top:' +
            top +
            'px;width:' +
            width +
            'px;height:' +
            height +
            'px;transform-origin:0 0;transform:scale(' +
            rect.width / width +
            ',' +
            rect.height / height +
            ');overflow:hidden;pointer-events:none;opacity:0;margin:0;padding:0;border:0';
        const wanted = style(rect.left, rect.top);
        if (wanted === placed)
            return;
        container.style.cssText = wanted;
        placed = wanted;
        // An ancestor can be what a fixed element is placed against. Where it landed says by how much.
        const landed = measure(container), dx = rect.left - landed.left, dy = rect.top - landed.top;
        if (dx !== 0 || dy !== 0)
            container.style.cssText = style(rect.left + dx, rect.top + dy);
    }
    function write(item, name, value) {
        if (item.written.get(name) === value && item.written.has(name))
            return;
        item.written.set(name, value);
        if (name === 'text')
            item.element.textContent = value ?? '';
        else if (name === 'style')
            item.element.style.cssText = value ?? '';
        else if (value === undefined)
            item.element.removeAttribute(name);
        else
            item.element.setAttribute(name, value);
    }
    function create(node) {
        const native = pressable.includes(node.role), element = page.createElement(native ? 'button' : 'div');
        element.id = container.id + '-' + ++elements;
        // A native button is a stop of the Tab key unless it says otherwise, and no element here is one: the canvas keeps the keyboard.
        if (native) {
            element.setAttribute('type', 'button');
            element.setAttribute('tabindex', '-1');
        }
        const role = aria[node.role];
        if (role !== undefined)
            element.setAttribute('role', role);
        const item = { id: node.id, role: node.role, element, written: new Map() };
        projected.set(node.id, item);
        identities.set(element, node.id);
        return item;
    }
    function drop(item) {
        if (projected.get(item.id) === item)
            projected.delete(item.id);
        identities.delete(item.element);
        item.element.remove();
    }
    const text = (value) => value === undefined ? undefined : String(value);
    function apply(snapshot) {
        place();
        const nodes = new Map(snapshot.nodes.map(node => [node.id, node]));
        for (const item of [...projected.values()])
            if (nodes.get(item.id)?.role !== item.role)
                drop(item);
        const cursors = new Map();
        for (const node of snapshot.nodes) {
            const item = projected.get(node.id) ?? create(node), parent = node.parent === undefined ? undefined : nodes.get(node.parent);
            const holder = parent === undefined ? container : projected.get(parent.id).element, cursor = cursors.get(holder) ?? 0;
            // Reading order is the order of the elements.
            if (holder.children[cursor] !== item.element)
                holder.insertBefore(item.element, holder.children[cursor] ?? null);
            cursors.set(holder, cursor + 1);
            const { bounds } = node;
            write(item, 'style', 'position:absolute;box-sizing:border-box;margin:0;padding:0;border:0;left:' +
                (bounds.x - (parent?.bounds.x ?? 0)) +
                'px;top:' +
                (bounds.y - (parent?.bounds.y ?? 0)) +
                'px;width:' +
                bounds.width +
                'px;height:' +
                bounds.height +
                'px');
            if (worded.includes(node.role))
                write(item, 'text', node.name);
            else {
                write(item, 'aria-label', node.name === '' ? undefined : node.name);
                if (node.role === 'textbox')
                    write(item, 'text', node.value);
            }
            write(item, 'aria-disabled', node.disabled ? 'true' : undefined);
            write(item, 'aria-checked', text(node.checked));
            write(item, 'aria-selected', text(node.selected));
            write(item, 'aria-expanded', text(node.expanded));
            write(item, 'aria-modal', node.modal === true ? 'true' : undefined);
            write(item, 'aria-multiline', node.multiline === true ? 'true' : undefined);
            write(item, 'aria-multiselectable', node.multiple === true ? 'true' : undefined);
            write(item, 'aria-valuenow', text(node.range?.now));
            write(item, 'aria-valuemin', text(node.range?.min));
            write(item, 'aria-valuemax', text(node.range?.max));
            write(item, 'aria-orientation', node.orientation);
            // A row says which row of the grid it is and a cell which column it is in; the grid says how many there are. Elsewhere a position is a place in a set.
            const placed = node.role === 'row'
                ? 'aria-rowindex'
                : node.role === 'gridcell' || node.role === 'columnheader'
                    ? 'aria-colindex'
                    : undefined;
            write(item, 'aria-posinset', placed === undefined ? text(node.position?.index) : undefined);
            write(item, 'aria-setsize', placed === undefined ? text(node.position?.size) : undefined);
            if (placed !== undefined)
                write(item, placed, text(node.position?.index));
            write(item, 'aria-rowcount', text(node.extent?.rows));
            write(item, 'aria-colcount', text(node.extent?.columns));
            write(item, 'aria-sort', node.sort);
            write(item, 'aria-level', text(node.level));
            // Set on the outermost inert element: the page then keeps everything under it away from every user.
            write(item, 'inert', node.inert && parent?.inert !== true ? '' : undefined);
            // Reachable by a request of assistive technology, never by the Tab key. A native button says so from the start, whatever it can do.
            if (!pressable.includes(node.role))
                write(item, 'tabindex', node.actions.includes('focus') && !node.disabled ? '-1' : undefined);
        }
        // A relation is written once every element it can name exists.
        for (const node of snapshot.nodes)
            write(projected.get(node.id), 'aria-controls', node.controls === undefined ? undefined : projected.get(node.controls).element.id);
        const active = snapshot.focused === undefined ? undefined : projected.get(snapshot.focused).element.id;
        if (active === undefined) {
            if (surface.getAttribute('aria-activedescendant')?.startsWith(container.id + '-') === true)
                surface.removeAttribute('aria-activedescendant');
        }
        else if (surface.getAttribute('aria-activedescendant') !== active)
            surface.setAttribute('aria-activedescendant', active);
    }
    /** The node an event of the page is about: the nearest projected element at or above its target. */
    function identify(event) {
        for (let at = event.target; at !== null && at !== container; at = at.parentNode) {
            const id = identities.get(at);
            if (id !== undefined)
                return id;
        }
        return undefined;
    }
    function perform(event, action) {
        const id = identify(event);
        if (id === undefined)
            return;
        if (action === 'activate')
            event.preventDefault();
        // A control that fails its own activation is told; the projection goes on for the others.
        try {
            semantics.perform(id, action);
        }
        catch (cause) {
            report(cause);
        }
        // The keys stay with the canvas, which names the focused node as its active descendant.
        if (action === 'focus' && !closed && typeof surface.focus === 'function')
            surface.focus({ preventScroll: true });
    }
    function listen(target, type, action, settings = {}) {
        // A listener the page failed to remove does nothing once the projection has closed.
        const listener = event => {
            if (!closed)
                try {
                    action(event);
                }
                catch (cause) {
                    fail(cause);
                }
        };
        pairs.push({ target, type, listener, options: settings });
        target.addEventListener(type, listener, settings);
    }
    /** Sets an attribute of the canvas the application left unset, and takes it back only while it is still ours. */
    function claim(name, value) {
        if (surface.getAttribute(name) !== null)
            return;
        surface.setAttribute(name, value);
        restores.push(() => {
            if (surface.getAttribute(name) === value)
                surface.removeAttribute(name);
        });
    }
    try {
        profile();
        if (ownedSurfaces.has(surface))
            throw new EgretError('UI_SEMANTICS_SURFACE_BUSY');
        ownedSurfaces.add(surface);
        owned = surface;
        const holder = page.createElement('div');
        do
            holder.id = 'egret-semantics-' + ++containers;
        while (page.getElementById(holder.id) !== null);
        container = holder;
        surface.after(holder);
        // The canvas owns the container: the nodes are read as what is inside the application.
        const owns = surface.getAttribute('aria-owns');
        surface.setAttribute('aria-owns', owns === null ? holder.id : owns + ' ' + holder.id);
        restores.push(() => {
            if (surface.getAttribute('aria-owns') !== (owns === null ? holder.id : owns + ' ' + holder.id))
                return;
            if (owns === null)
                surface.removeAttribute('aria-owns');
            else
                surface.setAttribute('aria-owns', owns);
        });
        restores.push(() => {
            if (surface.getAttribute('aria-activedescendant')?.startsWith(holder.id + '-') === true)
                surface.removeAttribute('aria-activedescendant');
        });
        claim('role', 'application');
        if (label !== undefined)
            claim('aria-label', label);
        listen(holder, 'click', event => perform(event, 'activate'));
        listen(holder, 'focusin', event => perform(event, 'focus'));
        listen(win, 'resize', place);
        listen(win, 'orientationchange', place);
        listen(win, 'scroll', place, { capture: true });
        const viewport = win.visualViewport;
        if (viewport !== null && viewport !== undefined) {
            listen(viewport, 'resize', place);
            listen(viewport, 'scroll', place);
        }
        const stop = semantics.observe(snapshot => {
            if (!closed)
                try {
                    apply(snapshot);
                }
                catch (cause) {
                    fail(cause);
                }
        });
        restores.push(stop);
        restores.push(semantics.onClose(cleanup));
        apply(semantics.snapshot);
        return Object.freeze({
            get state() {
                return closed ? 'closed' : 'active';
            },
            container: holder,
            elementOf: (id) => (closed ? undefined : projected.get(id)?.element),
            sync() {
                if (!closed)
                    try {
                        place();
                    }
                    catch (cause) {
                        fail(cause);
                        throw cause;
                    }
            },
            dispose: cleanup
        });
    }
    catch (cause) {
        cleanup();
        if (cause instanceof EgretError)
            throw cause;
        throw new EgretError('UI_SEMANTICS_SURFACE_INVALID', { cause });
    }
}
//# sourceMappingURL=BrowserSemantics.js.map