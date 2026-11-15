// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import { bindTextEditorHost, requireEditorEngine } from '#egret-text-editor';
import { assertEditorFonts, borrowEditorFonts } from './editorFonts.js';
const apply = Reflect.apply;
const fault = (code, cause) => new EgretError('BROWSER_TEXT_EDITOR_' + code, { cause });
function method(prototype, name) {
    const value = prototype && Object.getOwnPropertyDescriptor(prototype, name)?.value;
    if (typeof value !== 'function')
        throw fault('UNSUPPORTED');
    return value;
}
function getter(prototype, name) {
    const value = prototype && Object.getOwnPropertyDescriptor(prototype, name)?.get;
    if (typeof value !== 'function')
        throw fault('UNSUPPORTED');
    return value;
}
function scalar(value, minimum, maximum) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum)
        throw fault('OPTIONS');
    return value;
}
function captureTarget(value) {
    if (!value || typeof value !== 'object')
        throw fault('TARGET');
    const id = (name) => {
        if (typeof name !== 'string' || !name.length || name.length > 128 || name.includes('\0'))
            throw fault('TARGET');
        return name;
    };
    if (value.kind === 'leaf')
        return Object.freeze({ kind: 'leaf', id: id(value.id) });
    if (value.kind === 'row')
        return Object.freeze({ kind: 'row', listId: id(value.listId), key: id(value.key) });
    throw fault('TARGET');
}
/** One visible native editor over an authenticated committed UI binding. Importing performs no host work. */
export function createBrowserTextEditor(options) {
    if (!options || typeof options !== 'object')
        throw fault('OPTIONS');
    let closed = false, interactive = true, busy = false, pending = false, settling = false, layoutRevision = 0, draining = false;
    let deferredEnd;
    let port, root, fonts = options.fonts;
    let token, nativeRevision = 0;
    let node, overlay, lease;
    let removeRoot = () => { }, removeLayer = () => { }, observer, mutation;
    let retained;
    let keyboardId;
    let width = scalar(options.logicalWidth, 0.25, 16384), height = scalar(options.logicalHeight, 0.25, 16384);
    const target = captureTarget(options.target), canvas = options.canvas, label = options.label, zIndex = options.zIndex ?? 1, onError = options.onError;
    if (typeof label !== 'string' ||
        !label.length ||
        label.length > 256 ||
        !Number.isInteger(zIndex) ||
        zIndex < 0 ||
        zIndex > 1000000 ||
        (onError !== undefined && typeof onError !== 'function') ||
        (options.onInvalidate !== undefined && typeof options.onInvalidate !== 'function'))
        throw fault('OPTIONS');
    const onInvalidate = options.onInvalidate;
    const permanent = [], editing = [];
    let add = () => { }, remove = () => { }, removeChild = () => { }, parentNode = () => undefined;
    let readValue = () => '', writeValue = () => { }, readStart = () => 0, readEnd = () => 0, readDirection = () => 'none', setSelection = () => { };
    let nativeFocus = () => { }, nativeBlur = () => { }, active = () => undefined;
    let nativeConnected = () => true;
    let document, window, keyboard;
    function report(cause) {
        try {
            onError?.(cause);
        }
        catch {
            /* Reporting cannot replace the original state/lifetime result. */
        }
    }
    function detach(rows) {
        for (const pair of rows.splice(0).reverse())
            try {
                apply(remove, pair.target, [pair.type, pair.listener, pair.capture]);
            }
            catch (cause) {
                report(cause);
            }
    }
    function retireNative(restore = true) {
        const previous = node, previousOverlay = overlay, previousLease = lease, previousRetention = retained;
        node = undefined;
        overlay = undefined;
        lease = undefined;
        retained = undefined;
        settling = false;
        mutation?.disconnect();
        mutation = undefined;
        detach(editing);
        try {
            if (previous)
                apply(writeValue, previous, ['']);
        }
        catch (cause) {
            report(cause);
        }
        try {
            if (previousOverlay) {
                const parent = apply(parentNode, previousOverlay, []);
                if (parent)
                    apply(removeChild, parent, [previousOverlay]);
            }
        }
        catch (cause) {
            report(cause);
        }
        try {
            previousLease?.release();
        }
        catch (cause) {
            report(cause);
        }
        try {
            previousRetention?.release();
        }
        catch (cause) {
            report(cause);
        }
        if (restore && port)
            try {
                port.showNative(false);
            }
            catch (cause) {
                report(cause);
            }
        if (previous)
            try {
                onInvalidate?.();
            }
            catch (cause) {
                report(cause);
            }
    }
    function end(how, force = false) {
        if (!token) {
            if (force)
                retireNative();
            return;
        }
        const current = token;
        token = undefined;
        try {
            port.end(current, nativeRevision, how, node ? nativeSample() : undefined);
        }
        catch (cause) {
            // A refused final native sample must not leave an unreachable active session.
            try {
                port.end(current, port.snapshot().revision, 'cancel');
            }
            catch {
                /* Preserve the primary refusal. */
            }
            throw cause;
        }
        finally {
            if (node && !force) {
                settling = true;
                node.readOnly = true;
                node.tabIndex = -1;
                node.style.pointerEvents = 'none';
                node.setAttribute('aria-busy', 'true');
                apply(nativeBlur, node, []);
            }
            if (force)
                retireNative();
        }
    }
    function fail(cause) {
        dispose();
        report(cause);
    }
    function drain() {
        if (closed || busy || draining)
            return;
        draining = true;
        try {
            for (let count = 0; count < 8 && !closed && (pending || deferredEnd !== undefined); count++) {
                const terminal = deferredEnd;
                deferredEnd = undefined;
                pending = false;
                perform(() => {
                    if (terminal !== undefined)
                        end(terminal);
                });
            }
            if (!closed && (pending || deferredEnd !== undefined))
                fail(fault('REENTRANT'));
        }
        finally {
            draining = false;
        }
    }
    function requestEnd(how) {
        if (closed)
            return;
        if (busy) {
            if (deferredEnd !== 'cancel')
                deferredEnd = how;
            return;
        }
        perform(() => end(how));
    }
    function perform(action) {
        if (closed)
            return;
        if (busy) {
            pending = true;
            return;
        }
        busy = true;
        try {
            action();
            if (!closed)
                synchronize();
        }
        catch (cause) {
            fail(cause);
        }
        finally {
            busy = false;
            drain();
        }
    }
    function listen(rows, eventTarget, type, action, capture = false) {
        const listener = event => {
            const inputEvent = ['beforeinput', 'input', 'compositionstart', 'compositionupdate', 'compositionend'].includes(type);
            // Readonly/blur may synchronously flush a terminal IME event after end retired its token.
            // Such events belong to the ended session; active-session reentry still refuses below.
            if (inputEvent && token === undefined)
                return;
            if (busy && inputEvent) {
                fail(fault('REENTRANT'));
                return;
            }
            if (busy && token !== undefined && type === 'blur') {
                requestEnd('commit');
                return;
            }
            if (busy && token !== undefined && type === 'pagehide') {
                requestEnd('cancel');
                return;
            }
            perform(() => action(event));
        };
        rows.push({ target: eventTarget, type, listener, capture });
        apply(add, eventTarget, [type, listener, capture]);
    }
    function nativeSample() {
        if (!node)
            throw fault('INACTIVE');
        const value = apply(readValue, node, []), start = apply(readStart, node, []), end = apply(readEnd, node, []);
        const backward = apply(readDirection, node, []) === 'backward';
        return {
            value,
            selection: { anchor: backward ? end : start, focus: backward ? start : end, affinity: 'downstream' }
        };
    }
    function writeSelection(selection) {
        if (!node)
            return;
        const start = Math.min(selection.anchor, selection.focus), end = Math.max(selection.anchor, selection.focus), direction = selection.anchor > selection.focus ? 'backward' : 'forward';
        if (apply(readStart, node, []) !== start ||
            apply(readEnd, node, []) !== end ||
            (start !== end && apply(readDirection, node, []) !== direction))
            apply(setSelection, node, [start, end, direction]);
    }
    function observeSelection() {
        const state = port.snapshot();
        if (!token ||
            !node ||
            state.state === 'composing' ||
            apply(active, document, []) !== node ||
            apply(readValue, node, []) !== state.value)
            return;
        port.observe(token, nativeRevision, nativeSample());
        nativeRevision = port.snapshot().revision;
    }
    function input(composing) {
        if (!token || !node)
            return;
        let state = port.snapshot();
        if (composing && state.state !== 'composing')
            port.compositionStart(token, nativeRevision);
        state = port.snapshot();
        if (state.state === 'composing')
            port.compositionUpdate(token, nativeRevision, nativeSample());
        else
            port.observe(token, nativeRevision, nativeSample());
        nativeRevision = port.snapshot().revision;
    }
    function dispose() {
        if (closed)
            return;
        closed = true;
        try {
            end('cancel', true);
        }
        catch (cause) {
            report(cause);
        }
        finally {
            retireNative();
            detach(permanent);
            try {
                observer?.disconnect();
            }
            catch (cause) {
                report(cause);
            }
            try {
                removeLayer();
            }
            catch (cause) {
                report(cause);
            }
            try {
                removeRoot();
            }
            catch (cause) {
                report(cause);
            }
            port?.release();
        }
    }
    let place = () => { };
    function synchronize() {
        if (closed || !node)
            return;
        if (apply(nativeConnected, node, []) !== true)
            throw fault('ELEMENT_DETACHED');
        const state = port.snapshot();
        if (state.state === 'closed' || root.state() !== 'open') {
            dispose();
            return;
        }
        if (token && state.session !== token) {
            token = undefined;
            settling = true;
            node.readOnly = true;
            apply(nativeBlur, node, []);
        }
        const presentation = port.presentation(root, target);
        if (!presentation ||
            !interactive ||
            !root.editorInteractive() ||
            !presentation.rowVisible ||
            !presentation.clip.width ||
            !presentation.clip.height) {
            end('cancel', true);
            retireNative();
            return;
        }
        if (settling && presentation.contentRevision === port.contentRevision() && presentation.source === state.value) {
            retireNative();
            return;
        }
        const style = port.style();
        if (!lease || lease.isDisposed || style.fontSet !== lease.key)
            throw fault('FONT_GENERATION');
        const source = state.state === 'composing' ? state.draft : state;
        if (source && state.state !== 'composing') {
            // Equal writes would reset the browser's undo history. Only explicit model divergence writes a value.
            if (apply(readValue, node, []) !== source.value)
                apply(writeValue, node, [source.value]);
            writeSelection(source.selection);
        }
        nativeRevision = state.revision;
        node.lang = style.locale;
        node.dir = style.direction;
        node.style.fontFamily = lease.families(style.fontFamilies);
        node.style.fontSize = style.fontSize + 'px';
        node.style.lineHeight = style.lineHeight === undefined ? 'normal' : style.lineHeight + 'px';
        node.style.color = '#' + style.fillColor.toString(16).padStart(6, '0');
        node.style.textAlign = style.textAlign ?? 'left';
        place(presentation);
        layoutRevision = root.snapshot().committedRevision;
    }
    try {
        port = bindTextEditorHost(options.editor, {
            changed() {
                if (busy)
                    pending = true;
                else
                    perform(() => { });
            },
            dispose,
            viewRetired() {
                if (busy)
                    pending = true;
                else
                    perform(() => { });
            }
        });
        root = port.root(options.root);
        assertEditorFonts(fonts, port.engine);
        if (options.keyboard !== undefined)
            keyboard = requireEditorEngine(port.engine).requireKeyboard(options.keyboard);
        window = globalThis.window;
        document = globalThis.document;
        if (!window || !document)
            throw fault('UNSUPPORTED');
        const canvasWidth = getter(globalThis.HTMLCanvasElement?.prototype, 'width'), ownerDocument = getter(globalThis.Node?.prototype, 'ownerDocument'), connected = getter(globalThis.Node?.prototype, 'isConnected');
        nativeConnected = connected;
        active = getter(globalThis.Document?.prototype, 'activeElement');
        parentNode = getter(globalThis.Node?.prototype, 'parentNode');
        const nativeRect = method(globalThis.Element?.prototype, 'getBoundingClientRect'), create = method(globalThis.Document?.prototype, 'createElement'), append = method(globalThis.Node?.prototype, 'appendChild');
        removeChild = method(globalThis.Node?.prototype, 'removeChild');
        add = method(globalThis.EventTarget?.prototype, 'addEventListener');
        remove = method(globalThis.EventTarget?.prototype, 'removeEventListener');
        const prevent = method(globalThis.Event?.prototype, 'preventDefault'), eventCancelable = getter(globalThis.Event?.prototype, 'cancelable');
        const composing = getter(globalThis.InputEvent?.prototype, 'isComposing'), visibility = getter(globalThis.Document?.prototype, 'visibilityState');
        const prototype = port.mode === 'single-line' ? globalThis.HTMLInputElement?.prototype : globalThis.HTMLTextAreaElement?.prototype;
        readValue = getter(prototype, 'value');
        writeValue = Object.getOwnPropertyDescriptor(prototype, 'value').set;
        readStart = getter(prototype, 'selectionStart');
        readEnd = getter(prototype, 'selectionEnd');
        readDirection = getter(prototype, 'selectionDirection');
        setSelection = method(prototype, 'setSelectionRange');
        nativeFocus = method(globalThis.HTMLElement?.prototype, 'focus');
        nativeBlur = method(globalThis.HTMLElement?.prototype, 'blur');
        function authentic() {
            if (apply(canvasWidth, canvas, []) === 0 ||
                apply(ownerDocument, canvas, []) !== document ||
                apply(connected, canvas, []) !== true ||
                document.defaultView !== window)
                throw fault('SURFACE');
        }
        function bounds() {
            authentic();
            const rectangle = apply(nativeRect, canvas, []);
            if (rectangle.width <= 0 || rectangle.height <= 0)
                throw fault('PLACEMENT_UNSUPPORTED');
            let left = rectangle.left, top = rectangle.top, right = rectangle.right, bottom = rectangle.bottom, node = canvas, depth = 0, reachedRoot = false;
            while (node) {
                if (++depth > 128)
                    throw fault('PLACEMENT_UNSUPPORTED');
                const style = window.getComputedStyle(node);
                if (node === document.documentElement)
                    reachedRoot = true;
                // A transformed/contained body or root also transforms a fixed body child.
                // Viewport coordinates are valid only when that overlay keeps the viewport owner.
                if ((node === document.body || node === document.documentElement) &&
                    (style.transform !== 'none' ||
                        style.translate !== 'none' ||
                        style.contain !== 'none' ||
                        style.contentVisibility !== 'visible' ||
                        style.backdropFilter !== 'none' ||
                        /\b(?:transform|perspective|filter|backdrop-filter|contain)\b/u.test(style.willChange)))
                    throw fault('PLACEMENT_UNSUPPORTED');
                if (style.opacity !== '1' ||
                    style.filter !== 'none' ||
                    style.perspective !== 'none' ||
                    style.writingMode !== 'horizontal-tb' ||
                    style.clipPath !== 'none' ||
                    style.clip !== 'auto' ||
                    style.maskImage !== 'none' ||
                    style.backdropFilter !== 'none' ||
                    style.rotate !== 'none' ||
                    style.scale !== 'none' ||
                    !['1', 'normal'].includes(style.zoom))
                    throw fault('PLACEMENT_UNSUPPORTED');
                if (style.transform !== 'none') {
                    const match = /^matrix\(([^)]+)\)$/u.exec(style.transform), values = match?.[1].split(',').map(Number);
                    if (!values ||
                        values.length !== 6 ||
                        values.some(n => !Number.isFinite(n)) ||
                        values[1] !== 0 ||
                        values[2] !== 0 ||
                        values[0] <= 0 ||
                        values[3] <= 0)
                        throw fault('PLACEMENT_UNSUPPORTED');
                }
                const clipsX = ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX), clipsY = ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY);
                if (node === canvas || clipsX || clipsY) {
                    if ([
                        style.borderTopLeftRadius,
                        style.borderTopRightRadius,
                        style.borderBottomLeftRadius,
                        style.borderBottomRightRadius
                    ].some(n => n.split(/\s+/u).some(value => Number.parseFloat(value) !== 0)))
                        throw fault('PLACEMENT_UNSUPPORTED');
                    if ([
                        style.paddingTop,
                        style.paddingRight,
                        style.paddingBottom,
                        style.paddingLeft,
                        style.borderTopWidth,
                        style.borderRightWidth,
                        style.borderBottomWidth,
                        style.borderLeftWidth
                    ].some(n => Number.parseFloat(n) !== 0))
                        throw fault('PLACEMENT_UNSUPPORTED');
                    const box = apply(nativeRect, node, []);
                    if (clipsX) {
                        left = Math.max(left, box.left);
                        right = Math.min(right, box.right);
                    }
                    if (clipsY) {
                        top = Math.max(top, box.top);
                        bottom = Math.min(bottom, box.bottom);
                    }
                }
                node = node.parentElement;
            }
            // A shadow tree stops parentElement before its host's clipping/transform ancestors.
            if (!reachedRoot)
                throw fault('PLACEMENT_UNSUPPORTED');
            const viewport = window.visualViewport;
            if (viewport && viewport.scale !== 1)
                throw fault('PLACEMENT_UNSUPPORTED');
            left = Math.max(left, viewport?.offsetLeft ?? 0);
            top = Math.max(top, viewport?.offsetTop ?? 0);
            right = Math.min(right, (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth));
            bottom = Math.min(bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight));
            return { rectangle, left, top, right, bottom };
        }
        place = presentation => {
            if (!node || !overlay)
                return;
            const { rectangle, left, top, right, bottom } = bounds(), sx = rectangle.width / width, sy = rectangle.height / height;
            const x = rectangle.left + presentation.box.x * sx, y = rectangle.top + presentation.box.y * sy;
            const clipLeft = Math.max(left, rectangle.left + presentation.clip.x * sx), clipTop = Math.max(top, rectangle.top + presentation.clip.y * sy);
            const clipRight = Math.min(right, rectangle.left + (presentation.clip.x + presentation.clip.width) * sx), clipBottom = Math.min(bottom, rectangle.top + (presentation.clip.y + presentation.clip.height) * sy);
            if (clipRight <= clipLeft || clipBottom <= clipTop) {
                end('cancel', true);
                return;
            }
            Object.assign(overlay.style, {
                left: clipLeft + 'px',
                top: clipTop + 'px',
                width: clipRight - clipLeft + 'px',
                height: clipBottom - clipTop + 'px'
            });
            Object.assign(node.style, {
                left: x - clipLeft + 'px',
                top: y - clipTop + 'px',
                width: presentation.localWidth + 'px',
                height: presentation.localHeight + 'px',
                transform: 'scale(' + sx * presentation.scaleX + ',' + sy * presentation.scaleY + ')'
            });
        };
        authentic();
        removeRoot = root.onClose(dispose);
        removeLayer = root.onInteractionChange((active, policy) => {
            if (active)
                return; // Resumption never fabricates native focus or an edit session.
            if (busy) {
                requestEnd(policy);
                pending = true;
            }
            else
                perform(() => end(policy, true));
        });
        listen(permanent, window, 'resize', () => { });
        listen(permanent, window, 'scroll', () => { }, true);
        if (window.visualViewport) {
            listen(permanent, window.visualViewport, 'resize', () => { });
            listen(permanent, window.visualViewport, 'scroll', () => { });
        }
        listen(permanent, window, 'pagehide', () => end('cancel'));
        listen(permanent, window, 'blur', () => end('commit'));
        listen(permanent, document, 'visibilitychange', () => {
            if (apply(visibility, document, []) !== 'visible')
                end('cancel');
        });
        if (typeof globalThis.ResizeObserver === 'function') {
            observer = new ResizeObserver(() => perform(() => { }));
            observer.observe(canvas);
        }
        function activate(point) {
            if (closed || !interactive || !root.editorInteractive())
                throw fault('INACTIVE');
            if (busy)
                throw fault('BUSY');
            if (token) {
                synchronize();
                return;
            }
            if (settling)
                throw fault('PRESENTATION_PENDING');
            const presentation = port.presentation(root, target), state = port.snapshot();
            if (!presentation ||
                presentation.contentRevision !== port.contentRevision() ||
                presentation.source !== state.value ||
                !presentation.rowVisible)
                throw fault('PRESENTATION_PENDING');
            if (!presentation.clip.width || !presentation.clip.height || port.style().fontSet !== fonts.key)
                throw fault('PLACEMENT_UNSUPPORTED');
            bounds();
            busy = true;
            let retention;
            try {
                lease = borrowEditorFonts(fonts, port.engine, () => perform(() => end('cancel', true)));
                if (lease.document !== document)
                    throw fault('SURFACE');
                if (target.kind === 'row') {
                    retention = root.retain(target.listId, target.key);
                    retained = retention;
                }
                overlay = apply(create, document, ['div']);
                node = apply(create, document, [port.mode === 'single-line' ? 'input' : 'textarea']);
                if (node instanceof HTMLInputElement)
                    node.type = 'text';
                else
                    node.wrap = 'soft';
                node.maxLength = port.maxLength;
                node.spellcheck = false;
                node.autocomplete = 'off';
                node.setAttribute('aria-label', label);
                node.setAttribute('data-egret-text-editor', '');
                Object.assign(overlay.style, {
                    position: 'fixed',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                    zIndex: String(zIndex)
                });
                Object.assign(node.style, {
                    all: 'initial',
                    display: 'block',
                    position: 'absolute',
                    boxSizing: 'border-box',
                    margin: '0',
                    padding: '0',
                    border: '0',
                    background: 'transparent',
                    outline: 'none',
                    resize: 'none',
                    pointerEvents: 'auto',
                    transformOrigin: '0 0',
                    minWidth: '0',
                    minHeight: '0',
                    appearance: 'none',
                    whiteSpace: port.mode === 'single-line' ? 'pre' : 'pre-wrap'
                });
                const selected = point === undefined
                    ? state.selection
                    : (() => {
                        const hit = presentation.geometry?.hitTest((scalar(point.x, -1048576, 1048576) - presentation.box.x) / presentation.scaleX, (scalar(point.y, -1048576, 1048576) - presentation.box.y) / presentation.scaleY);
                        return hit ? { anchor: hit.offset, focus: hit.offset, affinity: hit.affinity } : state.selection;
                    })();
                token = port.begin();
                nativeRevision = port.snapshot().revision;
                keyboardId = keyboard?.getSnapshot().focusedId;
                apply(writeValue, node, [state.value]);
                writeSelection(selected);
                port.observe(token, nativeRevision, { value: state.value, selection: selected });
                nativeRevision = port.snapshot().revision;
                listen(editing, node, 'beforeinput', event => {
                    const current = port.snapshot();
                    if (current.session !== token || current.revision !== nativeRevision) {
                        if (apply(eventCancelable, event, []) === true)
                            apply(prevent, event, []);
                        synchronize();
                    }
                });
                listen(editing, node, 'input', event => {
                    let isComposing = false;
                    try {
                        isComposing = apply(composing, event, []) === true;
                    }
                    catch {
                        /* Some native autofill paths use Event rather than InputEvent. */
                    }
                    input(isComposing);
                });
                listen(editing, node, 'compositionstart', () => {
                    if (token)
                        port.compositionStart(token, nativeRevision);
                });
                listen(editing, node, 'compositionupdate', () => {
                    if (token)
                        port.compositionUpdate(token, nativeRevision, nativeSample());
                });
                listen(editing, node, 'compositionend', () => {
                    if (token) {
                        port.compositionEnd(token, nativeRevision, nativeSample());
                        nativeRevision = port.snapshot().revision;
                    }
                });
                listen(editing, node, 'select', observeSelection);
                listen(editing, document, 'selectionchange', observeSelection);
                listen(editing, node, 'blur', () => end('commit'));
                listen(editing, node, 'keydown', event => {
                    const key = event;
                    if (key.isComposing || key.key === 'Process' || key.keyCode === 229 || port.snapshot().state === 'composing')
                        return;
                    const tab = key.key === 'Tab' && keyboard !== undefined && !key.altKey && !key.ctrlKey && !key.metaKey;
                    if (key.key === 'Escape' || (key.key === 'Enter' && port.mode === 'single-line') || tab) {
                        apply(prevent, event, []);
                        end(key.key === 'Escape' ? 'cancel' : 'commit');
                        apply(nativeFocus, canvas, [{ preventScroll: true }]);
                        if (key.key === 'Escape')
                            root.requestDismiss();
                        if (tab) {
                            // The existing canvas keyboard bridge cancels focus on native blur.
                            // Restore only the genuine logical target captured at activation.
                            if (keyboardId !== undefined)
                                keyboard?.focus(keyboardId, { reason: 'programmatic' });
                            keyboard?.moveFocus(key.shiftKey ? 'previous' : 'next');
                        }
                    }
                });
                apply(append, overlay, [node]);
                apply(append, document.body, [overlay]);
                if (typeof globalThis.MutationObserver === 'function') {
                    mutation = new MutationObserver(() => {
                        if (apply(connected, canvas, []) !== true || (node && apply(connected, node, []) !== true))
                            perform(() => {
                                throw fault('ELEMENT_DETACHED');
                            });
                    });
                    mutation.observe(document.documentElement, { childList: true, subtree: true });
                }
                synchronize();
                if (closed || !node || !token)
                    throw fault('ACTIVATION_CANCELLED');
                apply(nativeFocus, node, [{ preventScroll: true }]);
                if (closed || apply(active, document, []) !== node)
                    throw fault('FOCUS');
                port.showNative(true);
                onInvalidate?.();
            }
            catch (cause) {
                try {
                    end('cancel', true);
                }
                finally {
                    retention?.release();
                    retireNative();
                }
                throw cause;
            }
            finally {
                busy = false;
                drain();
            }
        }
        return Object.freeze({
            activate,
            finish() {
                requestEnd('commit');
            },
            cancel() {
                requestEnd('cancel');
            },
            sync(viewport) {
                if (closed)
                    return;
                if (viewport) {
                    const nextWidth = scalar(viewport.width, 0.25, 16384), nextHeight = scalar(viewport.height, 0.25, 16384);
                    width = nextWidth;
                    height = nextHeight;
                }
                if (busy) {
                    pending = true;
                    return;
                }
                perform(() => { });
            },
            setFontSet(candidate) {
                if (closed)
                    throw fault('CLOSED');
                if (port.snapshot().state === 'composing')
                    throw fault('COMPOSING');
                assertEditorFonts(candidate, port.engine);
                const next = borrowEditorFonts(candidate, port.engine, () => perform(() => end('cancel', true))), previous = lease;
                if (next.document !== document) {
                    next.release();
                    throw fault('SURFACE');
                }
                if (busy) {
                    next.release();
                    throw fault('BUSY');
                }
                busy = true;
                try {
                    fonts = candidate;
                    if (node)
                        lease = next;
                    port.setStyle({ ...port.style(), fontSet: candidate.key, fontFamilies: candidate.fontFamilies });
                    if (closed || next.isDisposed)
                        throw fault('FONT_GENERATION');
                    if (node) {
                        previous?.release();
                        synchronize();
                    }
                    else
                        next.release();
                }
                catch (cause) {
                    next.release();
                    fail(cause);
                    throw cause;
                }
                finally {
                    previous?.release();
                    busy = false;
                    drain();
                }
            },
            setInteractive(value) {
                if (typeof value !== 'boolean')
                    throw fault('OPTIONS');
                interactive = value;
                if (!value)
                    perform(() => end('cancel', true));
            },
            snapshot() {
                return Object.freeze({
                    state: closed
                        ? 'closed'
                        : settling
                            ? 'settling'
                            : token
                                ? port.snapshot().state === 'composing'
                                    ? 'composing'
                                    : 'editing'
                                : 'inactive',
                    interactive: interactive && root.editorInteractive(),
                    contentRevision: port.contentRevision(),
                    layoutRevision,
                    nativeElement: node !== undefined,
                    fontKey: fonts.key
                });
            },
            dispose
        });
    }
    catch (cause) {
        dispose();
        throw cause;
    }
}
//# sourceMappingURL=BrowserTextEditor.js.map