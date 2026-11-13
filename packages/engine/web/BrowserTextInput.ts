// SPDX-License-Identifier: Apache-2.0
import {EgretError} from '@egret/runtime';

/** Rectangle in logical stage units, the units of the display tree and of pointer input. */
export interface BrowserTextInputRectangle {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
export type BrowserTextInputMode = 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url' | 'search' | 'none';
export type BrowserTextInputEnterHint = 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
export interface BrowserTextInputChange {
    readonly value: string;
    /** True while the input method still holds provisional text, such as pinyin before a candidate is chosen. */
    readonly composing: boolean;
}
/** One editing session. Every length is in logical stage units and every colour is 0xRRGGBB. */
export interface BrowserTextInputRequest extends BrowserTextInputRectangle {
    readonly value?: string;
    readonly multiline?: boolean;
    readonly password?: boolean;
    /** Counted in characters (code points), so one Chinese character or one emoji counts once. */
    readonly maxLength?: number;
    readonly placeholder?: string;
    readonly placeholderColor?: number;
    /** Accessible name of the field. */
    readonly label?: string;
    /** BCP 47 tag, for example 'zh-CN'. */
    readonly locale?: string;
    readonly inputMode?: BrowserTextInputMode;
    readonly enterKeyHint?: BrowserTextInputEnterHint;
    readonly fontFamily?: string;
    readonly fontSize?: number;
    readonly fontWeight?: number | 'normal' | 'bold';
    readonly lineHeight?: number;
    readonly color?: number;
    /** Omitted: transparent, so that what the game drew under the field shows through. */
    readonly backgroundColor?: number;
    readonly textAlign?: 'left' | 'center' | 'right';
    readonly padding?: number;
    readonly select?: 'all' | 'end';
    /** What ends the session when the field loses focus or the player presses elsewhere. Default 'commit'. */
    readonly blur?: 'commit' | 'cancel';
    readonly onChange?: (change: BrowserTextInputChange) => void;
    readonly onCommit?: (value: string) => void;
    readonly onCancel?: () => void;
}
export interface BrowserTextInputOptions {
    readonly canvas: HTMLCanvasElement;
    readonly logicalWidth: number;
    readonly logicalHeight: number;
    /** Element that receives the field. Default: the parent of the canvas, so that a fullscreen container keeps it. */
    readonly parent?: HTMLElement;
    readonly zIndex?: number;
    /** Keeps key events of the field from bubbling to game shortcuts on the document or the window. Default true. */
    readonly isolateKeys?: boolean;
    readonly onError?: (error: unknown) => void;
}
export interface BrowserTextInputSnapshot {
    readonly state: 'idle' | 'open' | 'disposed';
    readonly value: string;
    readonly composing: boolean;
}
export interface BrowserTextInput {
    /** Opens a field and focuses it. A session that is still open is cancelled first. */
    open(request: BrowserTextInputRequest): void;
    commit(): void;
    cancel(): void;
    setValue(value: string): void;
    /** Moves the open field, for example with a panel that slides. */
    move(rectangle: BrowserTextInputRectangle): void;
    /** New logical size of the stage. */
    resize(logicalWidth: number, logicalHeight: number): void;
    /** Places the open field again. Window, viewport and canvas size changes do this by themselves. */
    sync(): void;
    getSnapshot(): BrowserTextInputSnapshot;
    dispose(): void;
}

const MODES: readonly string[] = ['text', 'numeric', 'decimal', 'tel', 'email', 'url', 'search', 'none'];
const HINTS: readonly string[] = ['enter', 'done', 'go', 'next', 'previous', 'search', 'send'];
const PLACEHOLDER = '--egret-text-input-placeholder', MARK = 'data-egret-text-input', PROBE = 100, TEXT_LIMIT = 1048576;
function fault(code: string): EgretError { return new EgretError('BROWSER_TEXT_INPUT_' + code); }
function scalar(value: unknown, minimum: number, maximum: number, code: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) throw fault(code);
    return value;
}
function text(value: unknown, maximum: number, code: string): string {
    if (typeof value !== 'string' || value.length > maximum || value.includes('\0')) throw fault(code);
    return value;
}
function colour(value: unknown, code: string): string {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 0xffffff) throw fault(code);
    return '#' + value.toString(16).padStart(6, '0');
}
function rectangle(value: BrowserTextInputRectangle, code: string): BrowserTextInputRectangle {
    if (!value || typeof value !== 'object') throw fault(code);
    return { x: scalar(value.x, -1048576, 1048576, code), y: scalar(value.y, -1048576, 1048576, code), width: scalar(value.width, 1, 16384, code), height: scalar(value.height, 1, 16384, code) };
}
function points(value: string): number { let count = 0; for (const _ of value) count++; return count; }
/** Index that lies `count` characters before `index`, never inside a surrogate pair. */
function back(value: string, index: number, count: number): number {
    let at = index;
    while (count > 0 && at > 0) {
        at--;
        const unit = value.charCodeAt(at);
        if (unit >= 0xdc00 && unit <= 0xdfff && at > 0) { const lead = value.charCodeAt(at - 1); if (lead >= 0xd800 && lead <= 0xdbff) at--; }
        count--;
    }
    return at;
}
function head(value: string, count: number): string { let at = 0; for (const point of value) { if (count-- <= 0) break; at += point.length; } return value.slice(0, at); }

interface Session {
    readonly node: HTMLInputElement | HTMLTextAreaElement;
    readonly wrapper: HTMLDivElement;
    readonly request: BrowserTextInputRequest;
    readonly multiline: boolean;
    readonly maxLength: number | undefined;
    readonly blur: 'commit' | 'cancel';
    readonly openedAt: number;
    readonly removals: (() => void)[];
    place: BrowserTextInputRectangle;
    composing: boolean;
    /** No press newer than the session has been seen: a mousedown now still belongs to the press that opened it. */
    fresh: boolean;
    reported: string;
}

/**
 * Platform text entry over a canvas: a native field placed on a rectangle of the stage, so that input methods
 * (Chinese, Japanese, Korean), on-screen keyboards, paste and accessibility work as the platform provides them.
 * Importing performs no host work, and nothing is added to the page until a session opens.
 */
export function createBrowserTextInput(options: BrowserTextInputOptions): BrowserTextInput {
    if (!options || typeof options !== 'object') throw fault('OPTIONS');
    const canvas = options.canvas, zIndex = options.zIndex ?? 1, isolate = options.isolateKeys ?? true, onError = options.onError;
    const win = globalThis.window, doc = globalThis.document;
    if (win === undefined || doc === undefined || typeof globalThis.HTMLCanvasElement !== 'function' || !(canvas instanceof globalThis.HTMLCanvasElement) || canvas.ownerDocument !== doc) throw fault('SURFACE');
    if (!Number.isInteger(zIndex) || zIndex < 0 || zIndex > 1000000 || typeof isolate !== 'boolean' || onError !== undefined && typeof onError !== 'function') throw fault('OPTIONS');
    if (options.parent !== undefined && (!(options.parent instanceof globalThis.HTMLElement) || options.parent.ownerDocument !== doc)) throw fault('OPTIONS');
    let logicalWidth = scalar(options.logicalWidth, 0.25, 16384, 'OPTIONS'), logicalHeight = scalar(options.logicalHeight, 0.25, 16384, 'OPTIONS');
    let disposed = false, session: Session | undefined, sheet: CSSStyleSheet | undefined, releaseFocus = (): void => {};

    function report(cause: unknown): void {
        try { if (onError) { onError(cause); return; } } catch (secondary) { cause = secondary; }
        if (typeof globalThis.reportError === 'function') globalThis.reportError(cause); else queueMicrotask(() => { throw cause; });
    }
    function guard(action: () => void): void { try { action(); } catch (cause) { report(cause); } }
    function placeholderSheet(): void {
        // A constructed sheet styles ::placeholder without an inline <style>, which a content security policy may refuse.
        if (sheet || typeof globalThis.CSSStyleSheet !== 'function' || !Array.isArray(doc.adoptedStyleSheets)) return;
        try {
            const next = new globalThis.CSSStyleSheet();
            next.replaceSync('[' + MARK + ']::placeholder{color:var(' + PLACEHOLDER + ',GrayText);opacity:1}');
            doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, next]; sheet = next;
        } catch { /* The platform colour of a placeholder remains. */ }
    }
    function layout(): void {
        const current = session;
        if (!current) return;
        const box = canvas.getBoundingClientRect(), node = current.node, style = node.style;
        if (!(box.width > 0) || !(box.height > 0) || !canvas.isConnected) { style.visibility = 'hidden'; return; }
        // The wrapper is a fixed square of known size. Where it lands and how large it measures give the offset
        // and scale that an ancestor imposes on fixed content, which the field's own placement then undoes.
        const probe = current.wrapper.getBoundingClientRect();
        const ax = probe.width > 0 ? probe.width / PROBE : 1, ay = probe.height > 0 ? probe.height / PROBE : 1;
        const sx = box.width / logicalWidth, sy = box.height / logicalHeight, place = current.place;
        style.visibility = 'visible';
        style.left = (box.left + place.x * sx - probe.left) / ax + 'px'; style.top = (box.top + place.y * sy - probe.top) / ay + 'px';
        style.width = place.width + 'px'; style.height = place.height + 'px';
        style.transform = 'scale(' + sx / ax + ',' + sy / ay + ')';
    }
    function limit(current: Session): void {
        const node = current.node, maximum = current.maxLength;
        if (maximum === undefined || current.composing) return;
        let value = node.value, excess = points(value) - maximum;
        if (excess <= 0) return;
        // What was just typed, pasted or composed ends at the caret: the excess is taken from there, not from the tail.
        const end = Math.min(node.selectionEnd ?? value.length, value.length), start = back(value, end, excess);
        value = value.slice(0, start) + value.slice(end);
        if (points(value) > maximum) value = head(value, maximum);
        node.value = value;
        const caret = Math.min(start, value.length);
        node.setSelectionRange(caret, caret);
    }
    function changed(current: Session): void {
        limit(current);
        const value = current.node.value, key = (current.composing ? '1' : '0') + value;
        if (key === current.reported) return;
        current.reported = key;
        const notify = current.request.onChange;
        if (notify) guard(() => notify({ value, composing: current.composing }));
    }
    function focusCanvas(): void {
        const active = doc.activeElement;
        if ((active === null || active === doc.body) && canvas.isConnected && canvas.hasAttribute('tabindex')) canvas.focus({ preventScroll: true });
    }
    function end(kind: 'commit' | 'cancel', key?: string): void {
        const current = session;
        if (!current) return;
        session = undefined;
        if (kind === 'commit') { current.composing = false; guard(() => limit(current)); }
        const value = current.node.value, focused = doc.activeElement === current.node;
        for (const remove of current.removals.splice(0).reverse()) guard(remove);
        guard(() => current.wrapper.remove());
        if (focused) {
            if (key === undefined) guard(focusCanvas);
            else {
                // The key that ended the session is still down. Its repeats and its release are not a key of the
                // game: they stop here, and the canvas takes focus only when the key is released.
                const held = (event: Event): void => {
                    if ((event as KeyboardEvent).key !== key) return;
                    if (isolate) event.stopPropagation();
                    if (event.type === 'keydown') event.preventDefault(); else { releaseFocus(); guard(focusCanvas); }
                };
                const lost = (): void => releaseFocus();
                win.addEventListener('keydown', held, true); win.addEventListener('keyup', held, true); win.addEventListener('blur', lost);
                releaseFocus = () => { releaseFocus = () => {}; win.removeEventListener('keydown', held, true); win.removeEventListener('keyup', held, true); win.removeEventListener('blur', lost); };
            }
        }
        const request = current.request;
        if (kind === 'commit') { if (request.onCommit) guard(() => request.onCommit!(value)); } else if (request.onCancel) guard(() => request.onCancel!());
    }
    function listen(current: Session, target: EventTarget, type: string, action: (event: Event) => void, capture = false): void {
        const listener = (event: Event): void => { if (session === current) guard(() => action(event)); };
        target.addEventListener(type, listener, capture);
        current.removals.push(() => target.removeEventListener(type, listener, capture));
    }
    function alive(): void { if (disposed) throw fault('DISPOSED'); }

    return {
        open(request) {
            alive();
            if (!request || typeof request !== 'object') throw fault('REQUEST');
            const place = rectangle(request, 'REQUEST'), multiline = request.multiline ?? false, password = request.password ?? false, blur = request.blur ?? 'commit';
            if (typeof multiline !== 'boolean' || typeof password !== 'boolean' || multiline && password || blur !== 'commit' && blur !== 'cancel') throw fault('REQUEST');
            const maxLength = request.maxLength;
            if (maxLength !== undefined && (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > TEXT_LIMIT)) throw fault('REQUEST');
            let value = text(request.value ?? '', TEXT_LIMIT, 'REQUEST');
            if (maxLength !== undefined) value = head(value, maxLength);
            const placeholder = text(request.placeholder ?? '', 1024, 'REQUEST'), label = text(request.label ?? '', 256, 'REQUEST'), locale = text(request.locale ?? '', 64, 'REQUEST');
            const fontFamily = text(request.fontFamily ?? 'sans-serif', 1024, 'REQUEST'), fontSize = scalar(request.fontSize ?? 16, 1, 4096, 'REQUEST'), padding = scalar(request.padding ?? 0, 0, 4096, 'REQUEST');
            const lineHeight = request.lineHeight === undefined ? undefined : scalar(request.lineHeight, 1, 16384, 'REQUEST');
            const weight = request.fontWeight ?? 'normal', align = request.textAlign ?? 'left', select = request.select ?? 'end';
            if (weight !== 'normal' && weight !== 'bold' && !(typeof weight === 'number' && Number.isInteger(weight) && weight >= 1 && weight <= 1000)) throw fault('REQUEST');
            if (!['left', 'center', 'right'].includes(align) || select !== 'all' && select !== 'end') throw fault('REQUEST');
            if (request.inputMode !== undefined && !MODES.includes(request.inputMode) || request.enterKeyHint !== undefined && !HINTS.includes(request.enterKeyHint)) throw fault('REQUEST');
            const ink = colour(request.color ?? 0, 'REQUEST'), paper = request.backgroundColor === undefined ? 'transparent' : colour(request.backgroundColor, 'REQUEST');
            const hint = request.placeholderColor === undefined ? undefined : colour(request.placeholderColor, 'REQUEST');
            for (const callback of [request.onChange, request.onCommit, request.onCancel]) if (callback !== undefined && typeof callback !== 'function') throw fault('REQUEST');
            const parent = options.parent ?? canvas.parentElement;
            if (!canvas.isConnected || !parent || !parent.isConnected) throw fault('SURFACE');
            end('cancel'); releaseFocus();
            if (disposed) throw fault('DISPOSED');
            if (session) throw fault('REENTRANT');

            const wrapper = doc.createElement('div'), node = doc.createElement(multiline ? 'textarea' : 'input');
            Object.assign(wrapper.style, { all: 'initial', display: 'block', position: 'fixed', left: '0', top: '0', width: PROBE + 'px', height: PROBE + 'px', margin: '0', padding: '0', border: '0', overflow: 'visible', pointerEvents: 'none', zIndex: String(zIndex) });
            Object.assign(node.style, {
                all: 'initial', display: 'block', position: 'absolute', boxSizing: 'border-box', margin: '0', border: '0', outline: 'none', resize: 'none', appearance: 'none', minWidth: '0', minHeight: '0',
                borderRadius: '0', pointerEvents: 'auto', transformOrigin: '0 0', visibility: 'hidden', overflow: multiline ? 'auto' : 'hidden', whiteSpace: multiline ? 'pre-wrap' : 'pre', overflowWrap: multiline ? 'break-word' : 'normal',
                padding: multiline ? padding + 'px' : '0 ' + padding + 'px', fontFamily, fontSize: fontSize + 'px', fontWeight: String(weight), lineHeight: lineHeight === undefined ? 'normal' : lineHeight + 'px',
                color: ink, caretColor: ink, background: paper, textAlign: align, userSelect: 'text', touchAction: 'manipulation'
            });
            node.style.setProperty('-webkit-user-select', 'text');
            if (hint !== undefined) { placeholderSheet(); node.style.setProperty(PLACEHOLDER, hint); }
            if (!multiline) (node as HTMLInputElement).type = password ? 'password' : 'text';
            node.setAttribute(MARK, ''); node.setAttribute('autocomplete', 'off'); node.setAttribute('autocorrect', 'off'); node.setAttribute('autocapitalize', 'off'); node.spellcheck = false;
            if (placeholder) node.placeholder = placeholder;
            if (label) node.setAttribute('aria-label', label);
            if (locale) node.lang = locale;
            if (request.inputMode !== undefined) node.inputMode = request.inputMode;
            if (request.enterKeyHint !== undefined) node.enterKeyHint = request.enterKeyHint;
            node.value = value;

            const current: Session = { node, wrapper, request, multiline, maxLength, blur, openedAt: win.performance.now(), removals: [], place, composing: false, fresh: true, reported: '0' + node.value };
            session = current;
            try {
                listen(current, node, 'input', () => changed(current));
                listen(current, node, 'compositionstart', () => { current.composing = true; });
                listen(current, node, 'compositionend', () => { current.composing = false; changed(current); });
                listen(current, node, 'keydown', event => {
                    const key = event as KeyboardEvent;
                    if (isolate) key.stopPropagation();
                    // A key that the input method consumes confirms or rejects a candidate; it is not the player's Enter.
                    if (key.isComposing || current.composing || key.keyCode === 229) return;
                    if (key.key === 'Escape') { key.preventDefault(); end('cancel', 'Escape'); }
                    else if (key.key === 'Enter' && (!current.multiline || key.ctrlKey || key.metaKey)) { key.preventDefault(); end('commit', 'Enter'); }
                });
                if (isolate) for (const type of ['keyup', 'keypress']) listen(current, node, type, event => event.stopPropagation());
                // An on-screen keyboard may deliver its Enter as a line break to insert, with no usable key event.
                if (!multiline) listen(current, node, 'beforeinput', event => {
                    if ((event as InputEvent).inputType === 'insertLineBreak' && !current.composing) { event.preventDefault(); end('commit', 'Enter'); }
                });
                listen(current, node, 'blur', () => {
                    // A window that loses focus keeps the field as its active element, and gives focus back to it.
                    if (doc.activeElement !== node) end(current.blur);
                });
                listen(current, doc, 'pointerdown', event => {
                    if (event.timeStamp <= current.openedAt) return;
                    current.fresh = false;
                    // Not every platform takes focus from a field when the player touches something else.
                    if (event.target !== node) end(current.blur);
                }, true);
                listen(current, doc, 'mousedown', event => {
                    // The press that opened the session would now move focus to what was pressed, and close it again.
                    if (current.fresh && event.target !== node) event.preventDefault();
                }, true);
                listen(current, win, 'resize', layout);
                listen(current, doc, 'scroll', layout, true);
                const viewport = win.visualViewport;
                if (viewport) { listen(current, viewport, 'resize', layout); listen(current, viewport, 'scroll', layout); }
                if (typeof globalThis.ResizeObserver === 'function') {
                    const observer = new globalThis.ResizeObserver(() => { if (session === current) guard(layout); });
                    observer.observe(canvas); current.removals.push(() => observer.disconnect());
                }
                wrapper.appendChild(node); parent.appendChild(wrapper);
                layout();
                // The page may scroll to show the field: on a phone that keeps it clear of the on-screen keyboard.
                node.focus();
                if (session === current) { const length = node.value.length; node.setSelectionRange(select === 'all' ? 0 : length, length); }
            } catch (cause) {
                if (session === current) { session = undefined; for (const remove of current.removals.splice(0).reverse()) guard(remove); guard(() => wrapper.remove()); }
                throw cause;
            }
        },
        commit() { alive(); end('commit'); },
        cancel() { alive(); end('cancel'); },
        setValue(value) {
            alive();
            const current = session;
            if (!current) throw fault('IDLE');
            let next = text(value, TEXT_LIMIT, 'VALUE');
            if (current.maxLength !== undefined) next = head(next, current.maxLength);
            current.node.value = next; current.composing = false; current.reported = '0' + current.node.value;
        },
        move(place) { alive(); const current = session; if (!current) throw fault('IDLE'); current.place = rectangle(place, 'RECTANGLE'); layout(); },
        resize(width, height) {
            alive();
            const nextWidth = scalar(width, 0.25, 16384, 'SIZE'), nextHeight = scalar(height, 0.25, 16384, 'SIZE');
            logicalWidth = nextWidth; logicalHeight = nextHeight; layout();
        },
        sync() { alive(); layout(); },
        getSnapshot() {
            if (disposed) return { state: 'disposed', value: '', composing: false };
            return session ? { state: 'open', value: session.node.value, composing: session.composing } : { state: 'idle', value: '', composing: false };
        },
        dispose() {
            if (disposed) return;
            end('cancel'); disposed = true; releaseFocus();
            const owned = sheet; sheet = undefined;
            if (owned) guard(() => { doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter(item => item !== owned); });
        }
    };
}
