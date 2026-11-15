// SPDX-License-Identifier: Apache-2.0
import { EgretError } from '@egret/runtime';
import { createHoverInput } from '@egret/engine/input/hover';
const ownedSurfaces = new WeakSet();
const units = ['pixel', 'line', 'page'];
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const same = (a, b) => a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
/**
 * Hover and wheel of the page for the canvas of a started Engine, in the same connected,
 * untransformed profile as the pointer adapter. It captures no pointer and sets no style, so it
 * shares the canvas with that adapter.
 */
export function createBrowserHoverInput(options) {
    if (options === null || typeof options !== 'object' || Array.isArray(options))
        throw new EgretError('HOVER_INPUT_OPTIONS_INVALID');
    const { canvas: surface, wheelPage = 'unconsumed', onError, ...configuration } = options;
    if ((wheelPage !== 'unconsumed' && wheelPage !== 'never' && wheelPage !== 'always') ||
        (onError !== undefined && typeof onError !== 'function') ||
        surface === null ||
        typeof surface !== 'object')
        throw new EgretError('HOVER_INPUT_OPTIONS_INVALID');
    const input = createHoverInput(configuration);
    const pairs = [];
    let closed = false, owned;
    /** A failure has nowhere to return to from a listener of the page. */
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
        for (const pair of pairs.splice(0).reverse())
            try {
                pair.target.removeEventListener(pair.type, pair.listener, pair.options);
            }
            catch (cause) {
                failures.push(cause);
            }
        if (owned !== undefined) {
            ownedSurfaces.delete(owned);
            owned = undefined;
        }
        for (const cause of failures)
            report(cause);
    }
    try {
        input.onClose(cleanup);
        const win = globalThis.window, page = globalThis.document;
        if (win === undefined || page === undefined || typeof win.getComputedStyle !== 'function')
            throw new EgretError('HOVER_INPUT_SURFACE_INVALID');
        const { width, height } = input;
        /** The rectangle of the canvas on the page, refused unless one scale and one offset map it. */
        function profile() {
            if (typeof surface?.getBoundingClientRect !== 'function' ||
                surface.ownerDocument !== page ||
                surface.isConnected !== true)
                throw new EgretError('HOVER_INPUT_SURFACE_INVALID');
            let current = surface, depth = 0;
            // Ordinary ancestors only: a transform or a zoom would need a mapping this adapter does not have.
            while (current !== page) {
                if (current === null || current.nodeType !== 1 || ++depth > 64)
                    throw new EgretError('HOVER_INPUT_SURFACE_INVALID');
                const style = win.getComputedStyle(current), read = (name) => style.getPropertyValue(name).trim();
                if (['transform', 'perspective', 'translate', 'rotate', 'scale'].some(name => read(name) !== 'none'))
                    throw new EgretError('HOVER_INPUT_SURFACE_INVALID');
                const zoom = read('zoom');
                if (zoom !== 'normal' && zoom !== '1')
                    throw new EgretError('HOVER_INPUT_SURFACE_INVALID');
                if (current === surface) {
                    const edges = [
                        'padding-top',
                        'padding-right',
                        'padding-bottom',
                        'padding-left',
                        'border-top-width',
                        'border-right-width',
                        'border-bottom-width',
                        'border-left-width'
                    ];
                    if (read('object-fit') !== 'fill' ||
                        edges.some(name => {
                            const value = read(name);
                            return value !== '0px' && value !== '0';
                        }))
                        throw new EgretError('HOVER_INPUT_SURFACE_INVALID');
                }
                current = current.parentNode;
            }
            return measure();
        }
        function measure() {
            const { left, top, width: wide, height: high } = surface.getBoundingClientRect();
            if (!finite(left) || !finite(top) || !finite(wide) || !finite(high) || wide <= 0 || high <= 0)
                throw new EgretError('HOVER_INPUT_SURFACE_INVALID');
            return { left, top, width: wide, height: high };
        }
        let bounds = profile();
        if (ownedSurfaces.has(surface))
            throw new EgretError('HOVER_INPUT_SURFACE_BUSY');
        ownedSurfaces.add(surface);
        owned = surface;
        function fail(cause) {
            cleanup();
            const failures = [cause];
            try {
                input.dispose();
            }
            catch (secondary) {
                failures.push(secondary);
            }
            for (const failure of failures)
                report(failure);
        }
        function guard(action) {
            if (closed)
                return;
            try {
                action();
            }
            catch (cause) {
                // One pointer too many is told and the others go on hovering.
                if (cause instanceof EgretError && cause.code === 'HOVER_INPUT_CAPACITY')
                    report(cause);
                else
                    fail(cause);
            }
        }
        /** What is hovered is told under the old mapping; the next movement uses the new one. */
        function remap() {
            const next = profile();
            if (input.state !== 'closed')
                input.setViewportRevision(input.viewportRevision + 1);
            bounds = next;
        }
        function current() {
            // A layout change without a resize or a scroll shows as a rectangle that moved.
            if (!same(bounds, measure()))
                remap();
            return bounds;
        }
        let observed = 0;
        // The platform orders its events; a clock that steps back is not passed on as a refused sample.
        const time = (event) => (observed = Math.max(observed, finite(event.timeStamp) && event.timeStamp > 0 ? event.timeStamp : 0));
        function place(event) {
            const rect = current();
            if (!finite(event.clientX) || !finite(event.clientY))
                throw new EgretError('HOVER_INPUT_EVENT_INVALID');
            const globalX = ((event.clientX - rect.left) * width) / rect.width, globalY = ((event.clientY - rect.top) * height) / rect.height;
            return globalX >= 0 && globalY >= 0 && globalX < width && globalY < height ? { globalX, globalY } : undefined;
        }
        function identify(event) {
            const { pointerId, pointerType } = event;
            return Number.isSafeInteger(pointerId) && pointerId >= 0 && (pointerType === 'mouse' || pointerType === 'pen')
                ? { pointerId, pointerType }
                : undefined;
        }
        function hover(event) {
            const identity = identify(event);
            if (identity === undefined || input.state !== 'active')
                return;
            // A pressed pointer belongs to the contact that began with the press.
            if (event.buttons !== 0) {
                input.leave(identity.pointerId, 'contact');
                return;
            }
            const point = page.visibilityState === 'visible' ? place(event) : undefined;
            // A captured pointer is still reported after it has left the canvas.
            if (point === undefined) {
                input.leave(identity.pointerId, 'outside');
                return;
            }
            input.sample({ ...identity, ...point, timestamp: time(event) });
        }
        function leave(event, reason) {
            const identity = identify(event);
            if (identity !== undefined && input.state !== 'closed')
                input.leave(identity.pointerId, reason);
        }
        function wheel(event) {
            const point = input.state === 'active' ? place(event) : undefined;
            let consumed = false;
            if (point !== undefined) {
                const unit = units[event.deltaMode];
                if (unit === undefined || !finite(event.deltaX) || !finite(event.deltaY) || !finite(event.deltaZ))
                    throw new EgretError('HOVER_INPUT_EVENT_INVALID');
                consumed = input.wheel({
                    ...point,
                    deltaX: event.deltaX,
                    deltaY: event.deltaY,
                    deltaZ: event.deltaZ,
                    unit,
                    timestamp: time(event),
                    zoom: event.ctrlKey === true
                });
            }
            if ((wheelPage === 'never' || (wheelPage === 'unconsumed' && consumed)) && event.cancelable)
                event.preventDefault();
        }
        function listen(target, type, action, settings = {}) {
            const listener = event => guard(() => {
                if (event.type === type)
                    action(event);
            });
            const pair = { target, type, listener, options: settings };
            pairs.push(pair);
            target.addEventListener(type, listener, settings);
        }
        listen(surface, 'pointermove', event => hover(event));
        listen(surface, 'pointerup', event => hover(event));
        listen(surface, 'pointerdown', event => leave(event, 'contact'));
        listen(surface, 'pointerleave', event => leave(event, 'outside'));
        listen(surface, 'pointercancel', event => leave(event, 'pointercancel'));
        // A passive listener lets the page scroll without waiting for this one. It cannot hold the page.
        listen(surface, 'wheel', event => wheel(event), { passive: wheelPage === 'always' });
        listen(win, 'blur', () => input.leaveAll('blur'));
        listen(win, 'pagehide', () => input.leaveAll('pagehide'));
        listen(page, 'visibilitychange', () => {
            if (page.visibilityState !== 'visible')
                input.leaveAll('hidden');
        });
        listen(win, 'resize', remap);
        listen(win, 'orientationchange', remap);
        listen(win, 'scroll', remap, { capture: true });
        const viewport = win.visualViewport;
        if (viewport !== null && viewport !== undefined) {
            listen(viewport, 'resize', remap);
            listen(viewport, 'scroll', remap);
        }
        // Resuming is the application's to do, once its rendering host is ready again.
        listen(surface, 'webglcontextlost', () => input.setInteractive(false));
        return input;
    }
    catch (cause) {
        cleanup();
        const cleanupErrors = [];
        try {
            input.dispose();
        }
        catch (secondary) {
            cleanupErrors.push(secondary);
        }
        if (cause instanceof EgretError && cause.code === 'HOVER_INPUT_SURFACE_BUSY' && cleanupErrors.length === 0)
            throw cause;
        throw new EgretError('HOVER_INPUT_SURFACE_INVALID', { cause, cleanupErrors });
    }
}
//# sourceMappingURL=BrowserHoverInput.js.map