// SPDX-License-Identifier: Apache-2.0
import { EgretError, Sprite } from '@egret/runtime';
import type { DisplayObject, Scope } from '@egret/runtime';
import type { Rectangle2D } from '@egret/contracts';
import { requireUiEngine } from '../internal/uiFactoryState.js';
import { requireUiRoot } from '../internal/uiRootState.js';
import type { UiRootAccess, UiRootLayerState } from '../internal/uiRootState.js';
import type { KeyboardTargetRegistration } from '../keyboardInputTypes.js';
import type { UiLayerManager, UiLayerManagerOptions, UiLayerOptions, UiLayerCommitResult, UiLayerSnapshot } from './layerTypes.js';

interface Entry {
    readonly id: string; readonly kind: UiLayerOptions['kind']; readonly root: UiLayerOptions['root']; readonly port: UiRootAccess;
    readonly anchor: Readonly<{ parent: Entry; target: NonNullable<UiLayerOptions['anchor']>['target']; placement: 'above' | 'below'; align: 'start' | 'center' | 'end'; gap: number }> | undefined;
    readonly initialFocus: UiLayerOptions['initialFocus']; readonly escape: boolean; readonly outside: boolean;
    readonly scope: Scope | undefined; readonly backdrop: Sprite | undefined; readonly sentinel: string | undefined;
    readonly keyboardRegistration: KeyboardTargetRegistration | undefined; readonly release: () => void;
    readonly unsubscribe: () => void; readonly listeners: readonly (() => void)[];
    savedFocus: Readonly<{ id: string | undefined; visible: boolean }> | undefined;
}
interface Pose { readonly entry: Entry; readonly x: number; readonly y: number; readonly visible: boolean; readonly pointer: boolean; readonly keyboard: boolean; readonly content: UiRootLayerState; }
const managers = new WeakMap<object, object>();
let nextManager = 0;
function fail(code: string): never { throw new EgretError(code); }
function object(value: unknown): value is object { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function number(value: unknown, min: number, max: number): number { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail('UI_VALUE_INVALID'); return value; }
function id(value: unknown): string { if (typeof value !== 'string' || value.length < 1 || value.length > 80 || value.includes('\0')) fail('UI_LAYER_ID_INVALID'); return value; }
function rect(value: Rectangle2D): Rectangle2D {
    if (!object(value)) fail('UI_VALUE_INVALID');
    const x = number(value.x, -1e7, 1e7), y = number(value.y, -1e7, 1e7), width = number(value.width, 1, 1e7), height = number(value.height, 1, 1e7);
    if (Math.abs(x + width) > 1e7 || Math.abs(y + height) > 1e7) fail('UI_VALUE_INVALID');
    return Object.freeze({ x, y, width, height });
}

/** Optional Root composition. Intent changes never publish during routed application callbacks. */
export function createUiLayerManager(options: UiLayerManagerOptions): UiLayerManager {
    if (!object(options)) fail('UI_VALUE_INVALID');
    const engine = options.engine, owner = {}, port = requireUiEngine(engine), scope = port.scope(options.scope);
    const input = options.input, inputPort = port.requireInput(input), keyboardIdentity=options.keyboard, keyboard = keyboardIdentity === undefined ? undefined : port.requireKeyboard(keyboardIdentity);
    const limit = number(options.maxLayers ?? 16, 1, 32), policy = options.editorPolicy ?? 'commit', invalidate = options.onInvalidate;
    let viewport = rect(options.viewport);
    if (!Number.isInteger(limit) || !['commit', 'cancel'].includes(policy) || invalidate !== undefined && typeof invalidate !== 'function') fail('UI_VALUE_INVALID');
    port.assertIdle(); scope.assertOpen();
    if (managers.has(engine)) fail('UI_LAYER_MANAGER_OWNED');
    const keyboardScope = keyboard === undefined ? undefined : port.keyboardScope(keyboard, owner), sequence = ++nextManager;
    const entries = new Map<string, Entry>(), errors: unknown[] = [];
    let desired: Entry[] = [], stack: Entry[] = [], poses: readonly Pose[] = [], revision = 0, wanted = 1, closed = false, admitting = false, syncing = false, notifying = false;
    let removeEngine = () => {}, removeEscape = () => {};
    const attempt = (action: () => void, out = errors): void => { try { action(); } catch (cause) { out.push(cause); } };
    function open(): void { if (closed) fail('UI_LAYER_CLOSED'); port.assertOpen(); scope.assertOpen(); }
    function admission(): void { open(); if (admitting || syncing) fail('UI_BUSY'); }
    function request(): void {
        wanted++; if (!Number.isSafeInteger(wanted)) fail('UI_LIMIT');
        // An observer failure cannot roll back a staged intent, or hide the original thrown value.
        if (invalidate !== undefined&&!notifying) {notifying=true;try{invalidate();}catch(cause){if(errors.length<64)errors.push(cause);}finally{notifying=false;}}
    }
    function resolve(name: string): Entry { const entry = entries.get(name); return entry ?? fail('UI_LAYER_UNKNOWN'); }
    function closeEntry(entry: Entry): void {
        const index = desired.indexOf(entry); if (index < 0) return;
        desired = desired.slice(0, index); request();
    }
    function dismiss(entry: Entry): boolean {
        if (closed || !entry.escape || desired.at(-1) !== entry) return false;
        closeEntry(entry); return true;
    }
    function retire(entry: Entry, restore: boolean): void {
        if (entries.get(entry.id) !== entry) return;
        entries.delete(entry.id);
        const at = desired.indexOf(entry); if (at >= 0) desired = desired.slice(0, at);
        // Anchors hold registration identity, so reusing an id cannot revive an old popup.
        desired = desired.filter((value, index, all) => value.anchor === undefined || entries.get(value.anchor.parent.id) === value.anchor.parent && (value.anchor.parent.kind === 'base' || all.indexOf(value.anchor.parent) < index));
        for (const listener of entry.listeners) attempt(listener);
        attempt(entry.unsubscribe); attempt(entry.release); attempt(() => entry.keyboardRegistration?.dispose());
        if (restore && entry.port.state() === 'open') {
            attempt(() => entry.port.releaseLayer(entry.kind === 'base'));
            attempt(() => { errors.push(...entry.port.notifyInteraction(policy)); });
        }
        attempt(() => entry.scope?.dispose());
        // Unregister publishes lifetime revocation immediately; held contacts cannot wait for another sync.
        if(!port.terminal()&&inputPort.state()==='active')attempt(()=>inputPort.sync());
        if (!closed) request();
    }
    function plan(): readonly Pose[] | undefined {
        const active: Entry[] = [];
        // Missing/recycled anchors retire their popup and the complete descendant stack.
        for (const entry of desired) {
            if (entries.get(entry.id) !== entry || entry.port.state() !== 'open') break;
            if (entry.anchor !== undefined) {
                const parent = entry.anchor.parent;
                if (entries.get(parent.id) !== parent || parent.kind !== 'base' && !active.includes(parent) || parent.port.anchor(entry.anchor.target) === undefined) break;
            }
            active.push(entry);
        }
        // sync is already the publication request; automatic retirement has no observer callout.
        if (active.length !== desired.length) { desired = active; wanted++; }
        const top = active.at(-1); let modal = -1;
        for (let index=0;index<active.length;index++) if(active[index]!.kind==='modal') modal=index;
        const values: Pose[] = [], byEntry = new Map<Entry, Pose>();
        const ordered = [...entries.values()].filter(e => e.kind === 'base').concat(active, [...entries.values()].filter(e => e.kind !== 'base' && !active.includes(e)));
        for (const entry of ordered) {
            const state = entry.port.layerState();
            if(state.input!==input||state.keyboard!==keyboard)fail('UI_LAYER_INPUT_MISMATCH');
            const visible = entry.kind === 'base' || active.includes(entry);
            if (!state.mutable || visible && entry.kind !== 'base' && !stack.includes(entry) && !state.ready) return undefined;
            const size = state.snapshot.viewport; let x = state.snapshot.origin.x, y = state.snapshot.origin.y;
            if (visible && entry.kind !== 'base') {
                if (size.width > viewport.width || size.height > viewport.height) fail('UI_LAYER_VIEWPORT_TOO_SMALL');
                if (entry.anchor !== undefined) {
                    const parent = byEntry.get(entry.anchor.parent), box = entry.anchor.parent.port.anchor(entry.anchor.target);
                    if (parent === undefined || !parent.visible || box === undefined) return undefined;
                    x = parent.x + box.x + (entry.anchor.align === 'start' ? 0 : (box.width - size.width) / (entry.anchor.align === 'end' ? 1 : 2));
                    const below = parent.y + box.y + box.height + entry.anchor.gap, above = parent.y + box.y - size.height - entry.anchor.gap;
                    y = entry.anchor.placement === 'below' ? below : above;
                    if (y + size.height > viewport.y + viewport.height && above >= viewport.y) y = above;
                    else if (y < viewport.y && below + size.height <= viewport.y + viewport.height) y = below;
                } else { x = viewport.x + (viewport.width - size.width) / 2; y = viewport.y + (viewport.height - size.height) / 2; }
                x = Math.max(viewport.x, Math.min(x, viewport.x + viewport.width - size.width));
                y = Math.max(viewport.y, Math.min(y, viewport.y + viewport.height - size.height));
            }
            const index = active.indexOf(entry), pointer = visible && (modal < 0 || index >= modal), key = visible && (top === undefined || entry === top);
            const value: Pose = { entry, x, y, visible, pointer, keyboard: key, content: state };
            values.push(value); byEntry.set(entry, value);
        }
        return values;
    }
    function same(a: readonly Pose[], b: readonly Pose[]): boolean {
        return a.length === b.length && a.every((x, i) => { const y = b[i]!; return x.entry === y.entry && x.x === y.x && x.y === y.y && x.visible === y.visible && x.pointer === y.pointer && x.keyboard === y.keyboard; });
    }
    function order(values: readonly Pose[]): readonly DisplayObject[] {
        return values.filter(value => value.visible).flatMap(value => value.entry.backdrop === undefined ? [value.entry.port.wrapper] : [value.entry.backdrop, value.entry.port.wrapper]);
    }
    function ordered(nodes: readonly DisplayObject[]): boolean {
        const start = port.stage.numChildren - nodes.length;
        return start >= 0 && nodes.every((node, index) => port.stage.getChildAt(start + index) === node);
    }
    function focus(top: Entry | undefined, restore: Entry['savedFocus'], out: unknown[]): void {
        if (keyboard === undefined || keyboard.getSnapshot().state !== 'active') return;
        function accept(action: () => void): boolean {
            try { action(); return true; } catch (cause) { if (!(cause instanceof EgretError && (cause.code === 'KEYBOARD_TARGET_INELIGIBLE' || cause.code === 'UI_ROW_NOT_REALIZED'))) out.push(cause); return false; }
        }
        if (restore?.id !== undefined && accept(() => keyboard!.focus(restore.id, { visible: restore.visible }))) return;
        if (top?.initialFocus !== undefined && accept(() => top.root.list(top.initialFocus!.listId).focus(top.initialFocus!.key, { visible: true }))) return;
        if (keyboard.getSnapshot().focusedId !== undefined) return;
        accept(() => { keyboardScope!.focusFirst(); });
        if (keyboard.getSnapshot().focusedId === undefined && top?.sentinel !== undefined) accept(() => keyboard.focus(top.sentinel));
    }
    function sync(): UiLayerCommitResult {
        if (closed) return Object.freeze({ kind: 'closed', revision, postCommitErrors: Object.freeze([]) });
        admission(); port.assertIdle(); syncing = true;
        const out = errors.splice(0);
        const result = (kind: UiLayerCommitResult['kind']): UiLayerCommitResult => Object.freeze({ kind, revision, postCommitErrors: Object.freeze(out.concat(errors.splice(0))) });
        try {
            let next = plan(); if (closed) return result('closed'); if (next === undefined) return result('pending');
            let reorder = !ordered(order(next)); const topology = stack.length !== desired.length || stack.some((entry, index) => entry !== desired[index]);
            if (!topology && !reorder && same(poses, next) && revision === wanted) return result('unchanged');
            const epoch = wanted, roots = next.map(value => [value.entry, value.content.snapshot.committedRevision, value.content.snapshot.desiredRevision] as const);
            const previousFocus = keyboard?.getSnapshot();
            if (inputPort.activeContacts() !== 0) attempt(() => input.cancelAll('suspended'), out);
            if (closed) return result('closed');
            // Cancellation is a user-code boundary. Reject a stale continuation, never overwrite its intent.
            if (epoch !== wanted || roots.some(([entry, committed, pending]) => entries.get(entry.id) !== entry || entry.port.state() !== 'open' || entry.port.layerState().snapshot.committedRevision !== committed || entry.port.layerState().snapshot.desiredRevision !== pending)) return result('pending');
            next = plan(); if (closed) return result('closed'); if (next === undefined || epoch !== wanted) return result('pending');
            reorder=!ordered(order(next));
            let common = 0; while (common < stack.length && common < desired.length && stack[common] === desired[common]) common++;
            const restore = stack[common]?.savedFocus;
            for (const entry of desired.slice(common)) entry.savedFocus = Object.freeze({ id: previousFocus?.focusedId, visible: previousFocus?.focusVisible ?? false });
            const top = desired.at(-1);
            // From here through publication there are no application callbacks or resource acquisitions.
            for (const value of next) {
                const { entry } = value;
                if (entry.backdrop !== undefined) {
                    entry.backdrop.x = viewport.x; entry.backdrop.y = viewport.y; entry.backdrop.visible = value.visible;
                    entry.backdrop.touchEnabled = value.visible; entry.backdrop.touchChildren = false;
                    entry.backdrop.scaleX = viewport.width; entry.backdrop.scaleY = viewport.height;
                    entry.backdrop.hitArea = { x: 0, y: 0, width: 1, height: 1 };
                    if (value.visible && reorder) port.stage.setChildIndex(entry.backdrop, port.stage.numChildren - 1);
                }
                if (value.content.visible !== value.visible || value.content.pointerEnabled !== value.pointer || value.content.keyboardEnabled !== value.keyboard || value.entry.root.snapshot().origin.x !== value.x || value.entry.root.snapshot().origin.y !== value.y || value.visible && reorder) {
                    entry.port.presentLayer({ x: value.x, y: value.y, visible: value.visible, pointerEnabled: value.pointer, keyboardEnabled: value.keyboard, ...(value.visible && reorder ? { index: port.stage.numChildren - 1 } : {}) });
                }
            }
            poses = next; stack = [...desired]; revision = epoch;
            // Native sessions retire against the new eligibility before logical focus can move.
            for (const value of next) { if (closed) break; if (entries.get(value.entry.id) === value.entry && value.entry.port.state() === 'open') out.push(...value.entry.port.notifyInteraction(policy)); }
            if (!closed) {
                attempt(() => keyboardScope?.setRoots(top === undefined ? undefined : [top.port.wrapper, top.backdrop!]), out);
                if (topology) focus(top, restore, out);
                attempt(() => inputPort.sync(), out);
            }
            return result(closed ? 'closed' : 'committed');
        } finally { syncing = false; }
    }
    const api: UiLayerManager = Object.freeze({
        register(configuration: UiLayerOptions) {
            admission(); port.assertIdle(); admitting = true;
            let entry: Entry | undefined, ownScope: Scope | undefined, release = () => {}, unsubscribe = () => {}, registration: KeyboardTargetRegistration | undefined;
            const listeners: (() => void)[] = [];
            try {
                if (!object(configuration)) fail('UI_VALUE_INVALID');
                const name = id(configuration.id), root = configuration.root, kind = configuration.kind, rawAnchor = configuration.anchor, rawFocus = configuration.initialFocus;
                const escape = configuration.closeOnEscape ?? true, outside = configuration.closeOnOutside ?? kind === 'popup';
                const color = number(configuration.backdropColor ?? 0x0b1320, 0, 0xffffff), alpha = number(configuration.backdropAlpha ?? (kind === 'modal' ? 0.45 : 0), 0, 1);
                if (!['base', 'popup', 'modal'].includes(kind) || typeof escape !== 'boolean' || typeof outside !== 'boolean' || !Number.isInteger(color) || kind === 'base' && rawAnchor !== undefined) fail('UI_VALUE_INVALID');
                if (entries.has(name)) fail('UI_LAYER_ID_DUPLICATE'); if (entries.size >= limit) fail('UI_LIMIT');
                const access = requireUiRoot(root, engine), state = access.layerState();
                if (state.input !== input || state.keyboard !== keyboard) fail('UI_LAYER_INPUT_MISMATCH');
                let anchor: Entry['anchor'];
                if (rawAnchor !== undefined) {
                    if (!object(rawAnchor) || !object(rawAnchor.target)) fail('UI_VALUE_INVALID');
                    const parentRoot = rawAnchor.root, placement = rawAnchor.placement ?? 'below', align = rawAnchor.align ?? 'start', gap = number(rawAnchor.gap ?? 4, 0, 4096), target = rawAnchor.target;
                    const parent = [...entries.values()].find(value => value.root === parentRoot);
                    if (parent === undefined || !['above', 'below'].includes(placement) || !['start', 'center', 'end'].includes(align)) fail('UI_LAYER_ANCHOR_INVALID');
                    const captured = target.kind === 'leaf' ? Object.freeze({ kind: 'leaf' as const, id: id(target.id) }) : target.kind === 'row' ? Object.freeze({ kind: 'row' as const, listId: id(target.listId), key: id(target.key) }) : fail('UI_LAYER_ANCHOR_INVALID');
                    anchor = Object.freeze({ parent, target: captured, placement, align, gap });
                }
                const initialFocus = rawFocus === undefined ? undefined : Object.freeze({ listId: id(rawFocus.listId), key: id(rawFocus.key) });
                open(); port.assertIdle(); if (entries.has(name) || entries.size >= limit) fail('UI_LIMIT');
                release = access.claimLayer(owner, () => entry !== undefined && dismiss(entry));
                let backdrop: Sprite | undefined, sentinel: string | undefined;
                if (kind !== 'base') {
                    ownScope = port.createScope(); backdrop = ownScope.use(new Sprite());
                    backdrop.graphics.beginFill(color, alpha).drawRect(0, 0, 1, 1).endFill(); backdrop.visible = false; backdrop.touchEnabled = false;
                    port.stage.addChild(backdrop); sentinel = 'egret.layer.' + sequence + '.' + name;
                    registration = keyboard?.registerTarget({ id: sentinel, target: backdrop, tabIndex: -1 });
                    const bg = backdrop;
                    listeners.push(bg.on(input.events.begin, event => { event.stopPropagation(); event.preventDefault(); input.capture(event.payload.session, bg); }));
                    listeners.push(bg.on(input.events.end, event => { event.stopPropagation(); event.preventDefault(); if (entry !== undefined && entry.outside && stack.at(-1) === entry) closeEntry(entry); }));
                    listeners.push(bg.on(input.events.cancel, event => { event.stopPropagation(); }));
                }
                unsubscribe = access.onClose(() => { if (entry !== undefined) retire(entry, false); });
                entry = { id: name, kind, root, port: access, anchor, initialFocus, escape, outside, scope: ownScope, backdrop, sentinel, keyboardRegistration: registration, release, unsubscribe, listeners: Object.freeze(listeners), savedFocus: undefined };
                entries.set(name, entry); request();
                return Object.freeze({ id: name, dispose() { if (entry !== undefined) retire(entry, true); } });
            } catch (cause) {
                for (const listener of listeners) attempt(listener); attempt(unsubscribe); attempt(release); attempt(() => registration?.dispose()); attempt(() => ownScope?.dispose()); throw cause;
            } finally { admitting = false; }
        },
        open(name: string) { open(); const entry = resolve(id(name)); if (entry.kind === 'base') fail('UI_LAYER_BASE'); if (desired.includes(entry)) return; if (entry.anchor !== undefined && entry.anchor.parent.kind !== 'base' && !desired.includes(entry.anchor.parent)) fail('UI_LAYER_ANCHOR_INVALID'); desired = [...desired, entry]; request(); },
        close(name: string) { open(); const entry = resolve(id(name)); if (entry.kind === 'base') fail('UI_LAYER_BASE'); closeEntry(entry); },
        setViewport(value: Rectangle2D) { admission(); const next = rect(value); open(); if (next.x === viewport.x && next.y === viewport.y && next.width === viewport.width && next.height === viewport.height) return; viewport = next; request(); },
        sync,
        snapshot(): UiLayerSnapshot {
            return Object.freeze({ state: closed ? 'closed' : 'open', committedRevision: revision, desiredRevision: wanted, viewport, openStack: Object.freeze(stack.map(entry => entry.id)), desiredStack: Object.freeze(desired.map(entry => entry.id)), layers: Object.freeze([...entries.values()].map(entry => { const pose = poses.find(value => value.entry === entry); return Object.freeze({ id: entry.id, kind: entry.kind, visible: pose?.visible ?? false, pointerEnabled: pose?.pointer ?? false, keyboardEnabled: pose?.keyboard ?? false, origin: Object.freeze({ x: pose?.x ?? 0, y: pose?.y ?? 0 }) }); })), counters: Object.freeze({ registered: entries.size, open: stack.length, backdrops: [...entries.values()].filter(entry => entry.backdrop !== undefined).length }) });
        },
        dispose() {
            if (closed) return; closed = true;
            scope.remove(onAbort); attempt(removeEngine); attempt(removeEscape); attempt(() => keyboardScope?.release());
            if(!port.terminal()&&inputPort.state()==='active')attempt(()=>input.cancelAll('owner'));
            for (const entry of [...entries.values()]) retire(entry, true);
            entries.clear(); desired = []; stack = []; poses = []; if (managers.get(engine) === owner) managers.delete(engine);
            const failure = errors.splice(0); if (failure.length !== 0) throw new EgretError('UI_LAYER_CLEANUP_FAILED', { cause: failure[0], cleanupErrors: failure.slice(1) });
        },
    });
    function onAbort(): void { api.dispose(); }
    try {
        managers.set(engine, owner); removeEngine = port.onClose(onAbort); scope.add(onAbort); scope.use(api);
        if (keyboard !== undefined) removeEscape = port.stage.on(keyboard.events.keyDown, event => {
            const top = stack.at(-1); if (top !== undefined && event.payload.key === 'Escape' && !event.payload.repeat && dismiss(top)) { event.preventDefault(); event.stopPropagation(); }
        }, { capture: true });
        scope.assertOpen(); return api;
    } catch (cause) { try { api.dispose(); } catch { /* Preserve the setup failure. */ } throw cause; }
}
