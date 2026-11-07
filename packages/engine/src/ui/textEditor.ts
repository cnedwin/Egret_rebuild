// SPDX-License-Identifier: Apache-2.0
import { DisplayObject, EgretError, Sprite } from '@egret/runtime';
import type { DisplayObjectContainer } from '@egret/runtime';
import { createTextEditState } from '@egret/runtime/ui/editing';
import type { TextEditState, TextEditSession, TextEditSample, TextEditSelection, TextEditResult } from '@egret/runtime/ui/editing';
import type { Paragraph, ParagraphTextGeometry } from '@egret/runtime/paragraph';
import { createParagraph } from '../paragraph.js';
import { requireUiEngine } from '../internal/uiFactoryState.js';
import { requireUiRoot } from '../internal/uiRootState.js';
import type { UiRootAccess } from '../internal/uiRootState.js';
import type { RowBinding, UiLeafPrepareContext, UiRoot } from './types.js';
import type { UiTextEditor, UiTextEditorOptions, UiTextEditorStyle, UiTextEditorSnapshot, UiTextEditorTarget, UiTextEditorChange, UiTextEditorSetOptions } from './textEditorTypes.js';

const freeze = Object.freeze, apply = Reflect.apply;
const fail = (code: string): never => { throw new EgretError('UI_TEXT_EDITOR_' + code); };
const parent = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'parent')!.get!;
const disposed = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'isDisposed')!.get!;
const visible = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'visible')!.get!;
const setVisible = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'visible')!.set!;
const alpha = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'alpha')!.get!;
const effect = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'renderEffect')!.get!;
const clip = Object.getOwnPropertyDescriptor(DisplayObject.prototype, 'clipRect')!.get!;
const toGlobal = DisplayObject.prototype.localToGlobal;
function number(value: unknown, low: number, high: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) return fail('OPTIONS');
    return value === 0 ? 0 : value;
}
function text(value: unknown, maximum: number): string {
    if (typeof value !== 'string' || !value.length || value.length > maximum || /[\u0000-\u001f\u007f]/u.test(value)) return fail('OPTIONS'); return value;
}
function captureStyle(input: UiTextEditorStyle): UiTextEditorStyle {
    if (input === null || typeof input !== 'object' || !Array.isArray(input.fontFamilies)) return fail('STYLE');
    const fontSet = text(input.fontSet, 256), count = input.fontFamilies.length;
    if (!Number.isInteger(count) || count < 1 || count > 16) return fail('STYLE');
    const fontFamilies: string[] = []; for (let index = 0; index < count; index++) fontFamilies.push(text(input.fontFamilies[index], 256));
    const fontSize = number(input.fontSize, 1, 512), locale = text(input.locale, 64), direction = input.direction;
    const lineHeight = input.lineHeight === undefined ? undefined : number(input.lineHeight, 1, 1024);
    const fillColor = number(input.fillColor, 0, 0xffffff), backgroundColor = input.backgroundColor === undefined ? undefined : number(input.backgroundColor, 0, 0xffffff), textAlign = input.textAlign;
    if (!Number.isInteger(fillColor) || backgroundColor !== undefined && !Number.isInteger(backgroundColor)
        || !['ltr', 'rtl'].includes(direction) || textAlign !== undefined && !['left', 'right', 'center', 'start', 'end'].includes(textAlign)) return fail('STYLE');
    return freeze({ fontSet, fontFamilies: freeze(fontFamilies), fontSize, locale, direction, fillColor,
        ...(lineHeight === undefined ? {} : { lineHeight }), ...(backgroundColor === undefined ? {} : { backgroundColor }), ...(textAlign === undefined ? {} : { textAlign }) });
}
interface View {
    readonly wrapper: DisplayObjectContainer;
    readonly paragraph: Paragraph;
    readonly status: Paragraph['getStatus'];
    readonly contentRevision: number;
    readonly style: UiTextEditorStyle;
    readonly source: string;
    readonly innerWidth: number;
    innerHeight: number;
    ready: boolean;
    aborted(): boolean;
}
export interface EditorLogicalBox { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
export interface EditorPresentation {
    readonly contentRevision: number;
    readonly source: string;
    readonly style: UiTextEditorStyle;
    readonly geometry: ParagraphTextGeometry | undefined;
    readonly box: EditorLogicalBox;
    readonly clip: EditorLogicalBox;
    readonly scaleX: number;
    readonly scaleY: number;
    readonly localWidth: number;
    readonly localHeight: number;
    readonly rowVisible: boolean;
}
interface HostHooks { changed(): void; dispose(): void; viewRetired(): void; }
export interface TextEditorHostPort {
    readonly engine: object;
    readonly mode: UiTextEditor['mode']; readonly maxLength: number;
    snapshot(): ReturnType<TextEditState['snapshot']>;
    contentRevision(): number;
    style(): UiTextEditorStyle;
    begin(): TextEditSession;
    observe(session: TextEditSession, revision: number, sample: TextEditSample): TextEditResult;
    compositionStart(session: TextEditSession, revision: number): boolean;
    compositionUpdate(session: TextEditSession, revision: number, sample: TextEditSample): boolean;
    compositionEnd(session: TextEditSession, revision: number, sample: TextEditSample): TextEditResult;
    end(session: TextEditSession, revision: number, how: 'commit' | 'cancel', sample?: TextEditSample): TextEditResult;
    root(root: UiRoot): UiRootAccess;
    presentation(root: UiRootAccess, target: UiTextEditorTarget): EditorPresentation | undefined;
    showNative(value: boolean): void;
    setStyle(style: UiTextEditorStyle): void;
    release(): void;
}
interface EditorRecord { bind(hooks: HostHooks): TextEditorHostPort; }
const records = new WeakMap<object, EditorRecord>();
/** Browser-only package alias; the public UI entry never exposes native session operations. */
export function bindTextEditorHost(editor: UiTextEditor, hooks: HostHooks): TextEditorHostPort {
    const record = records.get(editor); if (!record) return fail('INVALID'); return record.bind(hooks);
}

export function createUiTextEditor(options: UiTextEditorOptions): UiTextEditor {
    if (options === null || typeof options !== 'object') return fail('OPTIONS');
    const engine = options.engine, port = requireUiEngine(engine), owner = port.scope(options.scope);
    port.assertIdle(); owner.assertOpen();
    const state = createTextEditState({ mode: options.mode, ...(options.value === undefined ? {} : { value: options.value }),
        ...(options.selection === undefined ? {} : { selection: options.selection }), ...(options.maxLength === undefined ? {} : { maxLength: options.maxLength }) });
    const cache = options.cache, padding = number(options.padding ?? 8, 0, 256), minimum = number(options.minHeight ?? (options.mode === 'single-line' ? 32 : 96), 1, 4096);
    const lines = options.mode === 'single-line' ? 1 : number(options.visibleLines ?? 6, 1, 128), onChange = options.onChange;
    if (!Number.isInteger(lines) || onChange !== undefined && typeof onChange !== 'function') return fail('OPTIONS');
    let style = captureStyle(options.style), contentRevision = 1, closed = false, nativeVisible = false, host: HostHooks | undefined;
    const views = new Set<View>();
    function live(): void { if (closed) fail('CLOSED'); owner.assertOpen(); }
    function increment(): void { if (!Number.isSafeInteger(contentRevision + 1)) fail('REVISION_EXHAUSTED'); contentRevision++; }
    function changed(kind: UiTextEditorChange['kind'], source: UiTextEditorChange['source']): void {
        const next = state.snapshot();
        try { onChange?.(freeze({ kind, source, revision: next.revision, contentRevision, value: next.value, selection: next.selection })); }
        catch (cause) { try { host?.dispose(); } catch { /* Preserve the original callback failure. */ } throw cause; }
        host?.changed();
    }
    function mutate<T>(source: UiTextEditorChange['source'], operation: () => T): T {
        live(); const before = state.snapshot().value, result = operation();
        if (state.snapshot().value !== before) { increment(); changed('value', source); }
        else host?.changed();
        return result;
    }
    function showNative(value: boolean): void {
        nativeVisible = value; let failure: unknown;
        for (const view of views) if (!view.aborted() && apply(disposed, view.paragraph, []) !== true) {
            try { apply(setVisible, view.paragraph, [!value]); } catch (cause) { failure ??= cause; }
        }
        if (failure !== undefined) throw failure;
    }
    async function prepare(context: UiLeafPrepareContext): Promise<RowBinding> {
        live(); const bindingOwner = port.scope(context.scope); bindingOwner.assertOpen();
        if (views.size >= 8) return fail('LIMIT');
        const width = number(context.width - padding * 2, 0.25, 4096), density = number(context.density, 0.25, 4);
        const version = contentRevision, source = state.snapshot().value, capturedStyle = style;
        const paragraph = createParagraph(engine, context.scope, cache), wrapper = new Sprite(); bindingOwner.use(wrapper);
        paragraph.x = padding; paragraph.y = padding; wrapper.addChild(paragraph);
        const view: View = { wrapper, paragraph, status: paragraph.getStatus, contentRevision: version, style: capturedStyle, source, innerWidth: width, innerHeight: minimum, ready: false, aborted: () => context.signal.aborted || bindingOwner.signal.aborted };
        const retired = () => { views.delete(view); bindingOwner.remove(retired); if (nativeVisible) host?.viewRetired(); };
        views.add(view); bindingOwner.add(retired);
        try {
            paragraph.setRequest({ ...capturedStyle, text: source, width, density, maxLines: lines, textGeometry: true });
            const metrics = await paragraph.prepare();
            live(); bindingOwner.assertOpen();
            if (view.aborted() || version !== contentRevision) return fail('STALE');
            view.innerHeight = Math.max(minimum, metrics.height);
            if (view.innerHeight > 16384) return fail('LIMIT');
            const height = view.innerHeight + padding * 2;
            if (capturedStyle.backgroundColor !== undefined) wrapper.graphics.beginFill(capturedStyle.backgroundColor).drawRect(0, 0, context.width, height).endFill();
            wrapper.hitArea = freeze({ x: 0, y: 0, width: context.width, height });
            apply(setVisible, paragraph, [!nativeVisible]); view.ready = true;
            return freeze({ content: wrapper, measuredHeight: height });
        } catch (cause) {
            views.delete(view); bindingOwner.remove(retired);
            try { wrapper.dispose(); } catch { /* The preparation failure remains authoritative. */ }
            throw cause;
        }
    }
    function setStyle(input: UiTextEditorStyle): void {
        live(); const next = captureStyle(input); live();
        if (state.snapshot().state === 'composing') return fail('COMPOSING');
        if (JSON.stringify(next) === JSON.stringify(style)) return;
        increment(); style = next; changed('style', 'programmatic');
    }
    function find(root: UiRootAccess, target: UiTextEditorTarget): View | undefined {
        if (root.state() !== 'open') return undefined;
        const current = root.lookup(target); if (!current) return undefined;
        return [...views].find(view => view.wrapper === current.content && view.ready && !view.aborted());
    }
    function globalBox(node: DisplayObject, x: number, y: number, width: number, height: number) {
        const a = apply(toGlobal, node, [x, y]), b = apply(toGlobal, node, [x + width, y]), c = apply(toGlobal, node, [x, y + height]);
        if (b.y !== a.y || c.x !== a.x || b.x <= a.x || c.y <= a.y) return fail('PLACEMENT_UNSUPPORTED');
        return { x: a.x, y: a.y, width: b.x - a.x, height: c.y - a.y, scaleX: (b.x - a.x) / width, scaleY: (c.y - a.y) / height };
    }
    function presentation(root: UiRootAccess, target: UiTextEditorTarget): EditorPresentation | undefined {
        const view = find(root, target); if (!view || root.lookup(target)?.visible !== true) return undefined;
        const box = globalBox(view.paragraph, 0, 0, view.innerWidth, view.innerHeight);
        let left = box.x, top = box.y, right = left + box.width, bottom = top + box.height, node: DisplayObject | undefined = view.wrapper, foundRoot = false, depth = 0;
        while (node !== undefined) {
            if (++depth > 4096 || apply(visible, node, []) !== true || apply(alpha, node, []) !== 1 || apply(effect, node, []) !== undefined) return fail('PLACEMENT_UNSUPPORTED');
            if (node === root.wrapper) foundRoot = true;
            const rectangle = apply(clip, node, []) as DisplayObject['clipRect'];
            if (rectangle !== undefined) {
                if (rectangle.width === 0 || rectangle.height === 0) { right = left; bottom = top; }
                else { const bound = globalBox(node, rectangle.x, rectangle.y, rectangle.width, rectangle.height); left = Math.max(left, bound.x); top = Math.max(top, bound.y); right = Math.min(right, bound.x + bound.width); bottom = Math.min(bottom, bound.y + bound.height); }
            }
            node = apply(parent, node, []) as DisplayObjectContainer | undefined;
        }
        if (!foundRoot) return undefined;
        const status = apply(view.status, view.paragraph, []);
        return freeze({ contentRevision: view.contentRevision, source: view.source, style: view.style, geometry: status.geometry,
            box: freeze({ x: box.x, y: box.y, width: box.width, height: box.height }), clip: freeze({ x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }),
            scaleX: box.scaleX, scaleY: box.scaleY, localWidth: view.innerWidth, localHeight: view.innerHeight, rowVisible: root.lookup(target)?.visible === true });
    }
    const content = freeze({ get revision() { return contentRevision; }, prepare });
    const editor = freeze({
        mode: state.mode, maxLength: state.maxLength, content, prepare,
        snapshot(): UiTextEditorSnapshot { const { session: ignored, ...snapshot } = state.snapshot(); return freeze({ ...snapshot, contentRevision, style, nativeVisible, livePresentations: views.size }); },
        setValue(value: string, settings?: UiTextEditorSetOptions): void { mutate('programmatic', () => state.setValue(value, settings?.selection, settings?.expectedRevision, settings?.cancelComposition)); },
        setSelection(value: TextEditSelection, expectedRevision?: number): void { mutate('programmatic', () => state.setSelection(value, expectedRevision)); },
        setStyle,
        getTextGeometry(root: UiRoot, target: UiTextEditorTarget): ParagraphTextGeometry | undefined { live(); const view = find(requireUiRoot(root, engine), target); return view === undefined ? undefined : apply(view.status, view.paragraph, []).geometry; },
        dispose(): void {
            if (closed) return; closed = true; owner.remove(abort); state.dispose();
            const attached = host; host = undefined;
            try { attached?.dispose(); } finally { views.clear(); nativeVisible = false; }
        },
    }) as UiTextEditor;
    function abort(): void { editor.dispose(); }
    records.set(editor, { bind(hooks) {
        live(); if (host !== undefined) return fail('HOST_IN_USE'); host = hooks;
        const identity = hooks; let released = false;
        return freeze({ engine, mode: state.mode, maxLength: state.maxLength, snapshot: () => state.snapshot(), contentRevision: () => contentRevision, style: () => style,
            begin: () => { live(); return state.begin(); },
            observe: (token: TextEditSession, revision: number, sample: TextEditSample) => mutate('native', () => state.observe(token, revision, sample)),
            compositionStart: (token: TextEditSession, revision: number) => state.beginComposition(token, revision),
            compositionUpdate: (token: TextEditSession, revision: number, sample: TextEditSample) => state.updateComposition(token, revision, sample),
            compositionEnd: (token: TextEditSession, revision: number, sample: TextEditSample) => mutate('native', () => state.endComposition(token, revision, sample)),
            end: (token: TextEditSession, revision: number, how: 'commit' | 'cancel', sample?: TextEditSample) => closed ? 'stale' : mutate('native', () => state.end(token, revision, how, sample)),
            root: (root: UiRoot) => requireUiRoot(root, engine), presentation, showNative, setStyle,
            release() { if (released) return; released = true; if (host === identity) host = undefined; },
        });
    } });
    owner.assertOpen(); owner.use({ dispose: () => editor.dispose() }); owner.add(abort);
    return editor;
}
export { requireUiEngine as requireEditorEngine } from '../internal/uiFactoryState.js';
